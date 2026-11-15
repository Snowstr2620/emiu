import crypto from 'node:crypto';
import { describe, expect, test } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { verifyPasscode } from '@/lib/auth';
import { SupabaseStorageRepository } from '@/lib/storage/supabase-repository';
import { createInitialSeedData } from '@/lib/seed-data';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function createMockSupabaseClient(options?: {
  initialSettingsRow?: Record<string, unknown> | null;
  initialMemoryRows?: Record<string, unknown>[];
  initialUserRows?: Record<string, unknown>[];
  initialActivityRows?: Record<string, unknown>[];
  failSeedMemoriesError?: string | null;
  failReorderOnIndex?: number | null;
}) {
  const seed = createInitialSeedData();
  let settingsRow: Record<string, unknown> | null =
    options?.initialSettingsRow === undefined
      ? {
          id: 1,
          couple_title: seed.settings.coupleTitle,
          hero_subtitle: seed.settings.heroSubtitle,
          love_start_date: seed.settings.loveStartDate,
          music_url: seed.settings.musicUrl,
          music_enabled: seed.settings.musicEnabled,
          letter_title: seed.settings.letterTitle,
          letter_body: seed.settings.letterBody,
          letter_signature: seed.settings.letterSignature,
          viewer_passcode_enabled: true,
          viewer_passcode_hash: '',
          updated_at: seed.settings.updatedAt,
        }
      : options.initialSettingsRow;

  let memoryRows: Record<string, unknown>[] =
    options?.initialMemoryRows ??
    seed.memories.map((m) => ({
      id: m.id,
      memory_date: m.memoryDate,
      title: m.title,
      story: m.story,
      image_url: m.imageUrl,
      image_alt: m.imageAlt,
      sort_order: m.sortOrder,
      created_at: m.createdAt,
    }));

  let userRows: Record<string, unknown>[] =
    options?.initialUserRows ??
    seed.users.map((u) => ({
      id: u.id,
      username: u.username,
      display_name: u.displayName,
      role: u.role,
      password_hash: u.passwordHash,
      otp_hash: u.otpHash,
      otp_hint: u.otpHint,
      is_active: u.isActive,
      session_version: u.sessionVersion,
      last_login_at: u.lastLoginAt,
      created_at: u.createdAt,
      updated_at: u.updatedAt,
    }));

  let activityRows: Record<string, unknown>[] = options?.initialActivityRows ?? [];

  const calls: string[] = [];
  const removedPaths: string[][] = [];
  let updateCallCount = 0;

  function makeSelectFilterBuilder(rowsGetter: () => Record<string, unknown>[]) {
    const filters: Array<{ col: string; val: unknown }> = [];
    let orderCol: string | null = null;
    let orderAsc = true;
    let limitCount: number | null = null;

    const execute = () => {
      let result = [...rowsGetter()].filter((row) =>
        filters.every((f) => row[f.col] === f.val)
      );
      if (orderCol) {
        const col = orderCol;
        result.sort((a, b) => {
          const av = String(a[col] ?? '');
          const bv = String(b[col] ?? '');
          return orderAsc ? av.localeCompare(bv) : bv.localeCompare(av);
        });
      }
      if (limitCount !== null) {
        result = result.slice(0, limitCount);
      }
      return result;
    };

    const builder = {
      eq(col: string, val: unknown) {
        filters.push({ col, val });
        return builder;
      },
      order(col: string, opts?: { ascending?: boolean }) {
        orderCol = col;
        orderAsc = opts?.ascending ?? true;
        return builder;
      },
      limit(count: number) {
        if (!Number.isFinite(count)) {
          throw new Error(`Invalid non-finite limit passed to Supabase query: ${count}`);
        }
        limitCount = count;
        return builder;
      },
      maybeSingle: async () => {
        const idFilter = filters.find((f) => f.col === 'id' && typeof f.val === 'string');
        if (idFilter && !UUID_PATTERN.test(String(idFilter.val))) {
          return {
            data: null,
            error: {
              code: '22P02',
              message: `invalid input syntax for type uuid: "${idFilter.val}"`,
            },
          };
        }
        return { data: execute()[0] ?? null, error: null };
      },
      returns: async () => ({ data: execute(), error: null }),
      then(resolve: (value: { data: Record<string, unknown>[]; error: null }) => void) {
        resolve({ data: execute(), error: null });
      },
    };
    return builder;
  }

  const client = {
    from(table: string) {
      if (table === 'site_settings') {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({ data: settingsRow, error: null }),
                };
              },
            };
          },
          upsert(row: Record<string, unknown>, opts?: { onConflict?: string }) {
            calls.push(`site_settings.upsert:${opts?.onConflict || ''}`);
            settingsRow = { ...row };
            return {
              select() {
                return {
                  single: async () => ({ data: settingsRow, error: null }),
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            const filters: Array<{ col: string; val: unknown }> = [];
            const updateBuilder = {
              eq(col: string, val: unknown) {
                filters.push({ col, val });
                return updateBuilder;
              },
              then(resolve: (res: { error: null }) => void) {
                if (
                  settingsRow &&
                  filters.every((f) => settingsRow![f.col] === f.val)
                ) {
                  settingsRow = { ...settingsRow, ...patch };
                }
                resolve({ error: null });
              },
            };
            return updateBuilder;
          },
        };
      }

      if (table === 'memories') {
        return {
          select(_cols?: string, opts?: { count?: string; head?: boolean }) {
            if (opts?.head) {
              return Promise.resolve({ count: memoryRows.length, error: null });
            }
            return {
              order() {
                return {
                  order() {
                    return {
                      returns: async () => ({
                        data: [...memoryRows].sort(
                          (a, b) => Number(a.sort_order) - Number(b.sort_order)
                        ),
                        error: null,
                      }),
                    };
                  },
                };
              },
            };
          },
          upsert: async (
            rows: Record<string, unknown>[],
            opts?: { onConflict?: string; ignoreDuplicates?: boolean }
          ) => {
            calls.push(
              `memories.upsert:${opts?.onConflict || ''}:${Boolean(opts?.ignoreDuplicates)}`
            );
            if (options?.failSeedMemoriesError) {
              return { error: { message: options.failSeedMemoriesError } };
            }
            memoryRows = rows.map((r) => ({ ...r, created_at: '2026-11-15T00:00:00.000Z' }));
            return { error: null };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq: async (_col: string, id: string) => {
                const idx = updateCallCount++;
                if (options?.failReorderOnIndex === idx) {
                  return { error: { message: 'Simulated update failure' } };
                }
                memoryRows = memoryRows.map((row) =>
                  row.id === id ? { ...row, ...patch } : row
                );
                return { error: null };
              },
            };
          },
        };
      }

      if (table === 'app_users') {
        return {
          select(_cols?: string, opts?: { count?: string; head?: boolean }) {
            if (opts?.head) {
              return Promise.resolve({ count: userRows.length, error: null });
            }
            return makeSelectFilterBuilder(() => userRows);
          },
          upsert: async (
            rows: Record<string, unknown>[],
            opts?: { onConflict?: string; ignoreDuplicates?: boolean }
          ) => {
            calls.push(
              `app_users.upsert:${opts?.onConflict || ''}:${Boolean(opts?.ignoreDuplicates)}`
            );
            for (const row of rows) {
              const exists = userRows.some((u) => u.username === row.username);
              if (!exists || !opts?.ignoreDuplicates) {
                userRows.push({ ...row });
              }
            }
            return { error: null };
          },
          insert(row: Record<string, unknown>) {
            const inserted = {
              id: row.id || crypto.randomUUID(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              last_login_at: null,
              ...row,
            };
            userRows.push(inserted);
            return {
              select() {
                return {
                  single: async () => ({ data: inserted, error: null }),
                };
              },
            };
          },
          update(patch: Record<string, unknown>) {
            return {
              eq(col: string, val: unknown) {
                let updatedRow: Record<string, unknown> | null = null;
                userRows = userRows.map((row) => {
                  if (row[col] === val) {
                    updatedRow = { ...row, ...patch };
                    return updatedRow;
                  }
                  return row;
                });
                return {
                  select() {
                    return {
                      single: async () => ({ data: updatedRow, error: null }),
                    };
                  },
                  then(resolve: (res: { error: null }) => void) {
                    resolve({ error: null });
                  },
                };
              },
            };
          },
          delete() {
            return {
              eq: async (col: string, val: unknown) => {
                userRows = userRows.filter((r) => r[col] !== val);
                return { error: null };
              },
            };
          },
        };
      }

      if (table === 'activity_logs') {
        return {
          select() {
            return makeSelectFilterBuilder(() => activityRows);
          },
          insert(row: Record<string, unknown>) {
            const inserted = {
              id: row.id || crypto.randomUUID(),
              created_at: new Date().toISOString(),
              ...row,
            };
            activityRows.unshift(inserted);
            return {
              select() {
                return {
                  single: async () => ({ data: inserted, error: null }),
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table ${table}`);
    },
    storage: {
      from(_bucket: string) {
        return {
          createSignedUploadUrl: async (objectPath: string) => ({
            data: { signedUrl: `https://example.supabase.co/upload/${objectPath}`, token: 'tok' },
            error: null,
          }),
          getPublicUrl: (objectPath: string) => ({
            data: {
              publicUrl: `https://example.supabase.co/storage/v1/object/public/love-memories/${objectPath}`,
            },
          }),
          remove: async (paths: string[]) => {
            removedPaths.push(paths);
            return { data: [], error: null };
          },
        };
      },
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    calls,
    removedPaths,
  };
}

describe('SupabaseStorageRepository', () => {
  test('seeds cold start idempotently (settings, memories, app_users) and throws on seed insert error', async () => {
    const okMock = createMockSupabaseClient({
      initialSettingsRow: null,
      initialMemoryRows: [],
      initialUserRows: [],
    });
    const repo = new SupabaseStorageRepository({
      client: okMock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    const pub = await repo.getPublicData();
    expect(pub.memories).toHaveLength(4);
    expect(pub.settings.viewerPasscodeEnabled).toBe(true);
    expect('viewerPasscodeHash' in pub.settings).toBe(false);
    expect(okMock.calls).toContain('memories.upsert:id:true');
    expect(okMock.calls).toContain('app_users.upsert:username:true');

    const admin = await repo.getAdminData();
    expect(admin.settings.hasViewerPasscode).toBe(false);
    expect('viewerPasscodeHash' in admin.settings).toBe(false);
    expect(admin.users).toHaveLength(2);
    expect(admin.trafficSummary.activeUsersCount).toBe(2);

    const errMock = createMockSupabaseClient({
      initialSettingsRow: null,
      initialMemoryRows: [],
      initialUserRows: [],
      failSeedMemoriesError: 'duplicate key value',
    });
    const failingRepo = new SupabaseStorageRepository({
      client: errMock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });
    await expect(failingRepo.getPublicData()).rejects.toThrow(/kỷ niệm mẫu/i);
  });

  test('propagates database errors during reorderMemories instead of silently returning stale order', async () => {
    const mock = createMockSupabaseClient({ failReorderOnIndex: 1 });
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    const initial = (await repo.getAdminData()).memories;
    await expect(
      repo.reorderMemories([...initial].reverse().map((m) => m.id))
    ).rejects.toThrow();
  });

  test('allows enabling viewerPasscodeEnabled without legacy passcode because auth uses app_users', async () => {
    const mock = createMockSupabaseClient({
      initialSettingsRow: {
        id: 1,
        couple_title: 'Minh & Lan',
        hero_subtitle: 'Subtitle',
        love_start_date: '2024-10-12',
        music_url: '/samples/gentle-memories.wav',
        music_enabled: true,
        letter_title: 'Gửi em',
        letter_body: 'Nội dung thư.',
        letter_signature: 'Minh',
        viewer_passcode_enabled: false,
        viewer_passcode_hash: '',
        updated_at: '2026-11-15T00:00:00.000Z',
      },
    });
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    const updated = await repo.updateSettings({
      coupleTitle: 'Minh & Lan',
      heroSubtitle: 'Subtitle',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Nội dung thư.',
      letterSignature: 'Minh',
      viewerPasscodeEnabled: true,
    });
    expect(updated.viewerPasscodeEnabled).toBe(true);
  });

  test('supports user CRUD, active-admin guard, and activity logging on Supabase repository', async () => {
    const mock = createMockSupabaseClient({ initialUserRows: [], initialActivityRows: [] });
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    // Cold fetch seeds default users
    await repo.getPublicData();
    const users = await repo.listUsers();
    expect(users).toHaveLength(2);
    const onlyAdmin = users.find((u) => u.username === 'admin')!;

    await expect(repo.updateUser(onlyAdmin.id, { isActive: false })).rejects.toThrow(
      /quản trị hoạt động cuối cùng/
    );
    await expect(repo.updateUser(onlyAdmin.id, { role: 'viewer' })).rejects.toThrow(
      /quản trị hoạt động cuối cùng/
    );
    await expect(repo.deleteUser(onlyAdmin.id)).rejects.toThrow(/quản trị hoạt động cuối cùng/);

    // Non-UUID getUserById returns null instead of crashing with Postgres 22P02
    expect(await repo.getUserById('not-a-uuid')).toBeNull();

    // Inactive second admin must not allow locking/deleting the sole active admin
    await repo.createUser({
      username: 'inactive.admin',
      displayName: 'Admin khóa',
      role: 'admin',
      password: 'password123',
      otpCode: '111222',
      otpHint: '',
      isActive: false,
    });
    await expect(repo.updateUser(onlyAdmin.id, { isActive: false })).rejects.toThrow(
      /quản trị hoạt động cuối cùng/
    );

    const created = await repo.createUser({
      username: 'ban.nho',
      displayName: 'Bạn nhỏ',
      role: 'viewer',
      password: 'password123',
      otpCode: '123456',
      otpHint: 'Gợi ý',
      isActive: true,
    });
    expect(created.username).toBe('ban.nho');

    const updated = await repo.updateUser(created.id, { revokeSession: true });
    expect(updated?.sessionVersion).toBe(2);

    const pwUpdated = await repo.updateUser(created.id, { password: 'newpassword123' });
    expect(pwUpdated?.sessionVersion).toBe(3);
    expect(verifyPasscode('newpassword123', (await repo.getUserById(created.id))!.passwordHash)).toBe(
      true
    );

    const otpUpdated = await repo.updateUser(created.id, { otpCode: '654321' });
    expect(otpUpdated?.sessionVersion).toBe(4);
    expect(verifyPasscode('654321', (await repo.getUserById(created.id))!.otpHash)).toBe(true);

    const lockedViewer = await repo.updateUser(created.id, { isActive: false });
    expect(lockedViewer?.isActive).toBe(false);
    expect(lockedViewer?.sessionVersion).toBe(5);

    await repo.recordUserLoginSuccess(created.id);
    expect((await repo.getUserById(created.id))?.lastLoginAt).toBeTruthy();

    expect(await repo.deleteUser(created.id)).toBe(true);
    expect(await repo.getUserById(created.id)).toBeNull();

    await repo.recordActivity({
      userId: null,
      username: 'khach',
      userRole: 'guest',
      eventType: 'memory_viewed',
      detail: 'Xem kỷ niệm đầu tiên',
      deviceSummary: 'Safari · iPhone',
      metadata: { memoryId: 'm1' },
    });

    const logs = await repo.listActivityLogs({ eventType: 'memory_viewed', search: 'đầu tiên' });
    expect(logs).toHaveLength(1);
    expect(logs[0].username).toBe('khach');

    // NaN limit falls back safely to 100 without passing NaN to Supabase .limit()
    const nanLogs = await repo.listActivityLogs({ limit: Number.NaN });
    expect(nanLogs).toHaveLength(1);
  });

  test('upgrades Phase 1 site_settings once even when getUserByUsername runs before getPublicData, and preserves subsequent false', async () => {
    const mock = createMockSupabaseClient({
      initialSettingsRow: {
        id: 1,
        couple_title: 'Minh & Lan',
        hero_subtitle: 'Subtitle cũ',
        love_start_date: '2024-10-12',
        music_url: '/samples/gentle-memories.wav',
        music_enabled: true,
        letter_title: 'Gửi em',
        letter_body: 'Nội dung thư.',
        letter_signature: 'Minh',
        viewer_passcode_enabled: false,
        viewer_passcode_hash: '',
        updated_at: '2026-11-15T00:00:00.000Z',
      },
      initialUserRows: [],
    });
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    // Trigger user seeding BEFORE getPublicData()
    const seededAdmin = await repo.getUserByUsername('admin');
    expect(seededAdmin?.username).toBe('admin');

    const pub = await repo.getPublicData();
    expect(pub.settings.viewerPasscodeEnabled).toBe(true);
    expect(pub.settings.coupleTitle).toBe('Minh & Lan');

    // Subsequent explicit disable must remain false
    await repo.updateSettings({
      coupleTitle: 'Minh & Lan',
      heroSubtitle: 'Subtitle cũ',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Nội dung thư.',
      letterSignature: 'Minh',
      viewerPasscodeEnabled: false,
    });
    const pubAfter = await repo.getPublicData();
    expect(pubAfter.settings.viewerPasscodeEnabled).toBe(false);
  });

  test('protects /samples/ URLs and strips bucket path cleanly when deleting stored Supabase media', async () => {
    const mock = createMockSupabaseClient();
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    await repo.deleteStoredFileByUrl('/samples/memory-1.svg');
    expect(mock.removedPaths).toHaveLength(0);

    await repo.deleteStoredFileByUrl(
      'https://example.supabase.co/storage/v1/object/public/love-memories/image/123-photo.jpg'
    );
    expect(mock.removedPaths).toEqual([['image/123-photo.jpg']]);
  });
});
