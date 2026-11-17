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
  initialDiaryRows?: Record<string, unknown>[];
  initialUserRows?: Record<string, unknown>[];
  initialActivityRows?: Record<string, unknown>[];
  failSeedMemoriesError?: string | null;
  failReorderOnIndex?: number | null;
  missingDiaryTable?: boolean;
  missingImagesColumn?: boolean;
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
  let diaryRows: Record<string, unknown>[] = options?.initialDiaryRows ?? [];

  const calls: string[] = [];
  const removedPaths: string[][] = [];
  let updateCallCount = 0;

  function makeSelectFilterBuilder(rowsGetter: () => Record<string, unknown>[]) {
    const filters: Array<{ col: string; val: unknown }> = [];
    const orders: Array<{ col: string; asc: boolean }> = [];
    let limitCount: number | null = null;

    const execute = () => {
      let result = [...rowsGetter()].filter((row) =>
        filters.every((f) => row[f.col] === f.val)
      );
      if (orders.length > 0) {
        result.sort((a, b) => {
          for (const ord of orders) {
            const av = a[ord.col];
            const bv = b[ord.col];
            if (typeof av === 'number' && typeof bv === 'number') {
              if (av !== bv) return ord.asc ? av - bv : bv - av;
            } else {
              const cmp = String(av ?? '').localeCompare(String(bv ?? ''));
              if (cmp !== 0) return ord.asc ? cmp : -cmp;
            }
          }
          return 0;
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
        orders.push({ col, asc: opts?.ascending ?? true });
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
            return makeSelectFilterBuilder(() => memoryRows);
          },
          insert(row: Record<string, unknown>) {
            if (options?.missingImagesColumn && 'images' in row) {
              return {
                select() {
                  return {
                    single: async () => ({
                      data: null,
                      error: {
                        code: '42703',
                        message: 'column memories.images does not exist',
                      },
                    }),
                  };
                },
              };
            }
            const inserted = {
              id: row.id || crypto.randomUUID(),
              created_at: new Date().toISOString(),
              ...row,
            };
            memoryRows.push(inserted);
            return {
              select() {
                return {
                  single: async () => ({ data: inserted, error: null }),
                };
              },
            };
          },
          delete() {
            return {
              eq: async (_col: string, id: string) => {
                memoryRows = memoryRows.filter((row) => row.id !== id);
                return { error: null };
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
              eq(_col: string, id: string) {
                const missingImgErr =
                  options?.missingImagesColumn && 'images' in patch
                    ? { code: '42703', message: 'column memories.images does not exist' }
                    : null;
                let updatedRow: Record<string, unknown> | null = null;
                if (!missingImgErr) {
                  const idx = updateCallCount++;
                  if (options?.failReorderOnIndex === idx) {
                    const failErr = { message: 'Simulated update failure' };
                    return {
                      select() {
                        return { single: async () => ({ data: null, error: failErr }) };
                      },
                      then(resolve: (res: { error: typeof failErr }) => void) {
                        resolve({ error: failErr });
                      },
                    };
                  }
                  memoryRows = memoryRows.map((row) => {
                    if (row.id === id) {
                      updatedRow = { ...row, ...patch };
                      return updatedRow;
                    }
                    return row;
                  });
                }
                return {
                  select() {
                    return {
                      single: async () => ({
                        data: missingImgErr ? null : updatedRow,
                        error: missingImgErr,
                      }),
                    };
                  },
                  then(resolve: (res: { error: typeof missingImgErr }) => void) {
                    resolve({ error: missingImgErr });
                  },
                };
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

      if (table === 'diary_entries') {
        const missingErr = {
          code: '42P01',
          message: 'relation "public.diary_entries" does not exist',
        };
        return {
          select() {
            if (options?.missingDiaryTable) {
              const errBuilder = {
                eq: () => errBuilder,
                order: () => errBuilder,
                limit: () => errBuilder,
                maybeSingle: async () => ({ data: null, error: missingErr }),
                returns: async () => ({ data: null, error: missingErr }),
              };
              return errBuilder;
            }
            return makeSelectFilterBuilder(() => diaryRows);
          },
          insert(row: Record<string, unknown>) {
            if (options?.missingDiaryTable) {
              return {
                select() {
                  return {
                    single: async () => ({ data: null, error: missingErr }),
                  };
                },
              };
            }
            const nowIso = new Date().toISOString();
            const inserted = {
              id: row.id || crypto.randomUUID(),
              created_at: nowIso,
              updated_at: nowIso,
              ...row,
            };
            diaryRows.push(inserted);
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
                diaryRows = diaryRows.map((row) => {
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
                };
              },
            };
          },
          delete() {
            return {
              eq: async (col: string, val: unknown) => {
                diaryRows = diaryRows.filter((row) => row[col] !== val);
                return { error: null };
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
    expect('hasViewerPasscode' in admin.settings).toBe(false);
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
      musicPlaylist: ['/samples/gentle-memories.wav'],
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
      musicPlaylist: ['/samples/gentle-memories.wav'],
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

  test('computes trafficSummary over up to 500 logs while slicing activityLogs to 200, and handles non-UUID/error in updateMemory & deleteMemory', async () => {
    const nowIso = new Date().toISOString();
    const manyLogs = Array.from({ length: 250 }, (_, idx) => ({
      id: `00000000-0000-4000-8000-${String(idx + 1).padStart(12, '0')}`,
      user_id: null,
      username: 'khach',
      user_role: 'guest',
      event_type: 'page_visit',
      detail: `Visit ${idx}`,
      device_summary: 'Chrome · macOS',
      metadata: null,
      created_at: nowIso,
    }));

    const mock = createMockSupabaseClient({ initialActivityRows: manyLogs });
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    const adminData = await repo.getAdminData();
    expect(adminData.activityLogs).toHaveLength(200);
    expect(adminData.trafficSummary.visitsToday).toBe(250);

    // Non-UUID id returns null/false cleanly without crashing
    expect(
      await repo.updateMemory('not-a-uuid', {
        memoryDate: '2025-01-01',
        title: 't',
        story: 's',
        imageUrl: '/samples/memory-1.svg',
        imageAlt: 'a',
      })
    ).toBeNull();
    expect(await repo.deleteMemory('not-a-uuid')).toBe(false);

    // Unexpected DB error on lookup in updateMemory/deleteMemory is propagated, not swallowed as null/false
    const failingClient = {
      from(table: string) {
        if (table === 'memories') {
          return {
            select() {
              return {
                eq() {
                  return {
                    maybeSingle: async () => ({
                      data: null,
                      error: { code: 'XX000', message: 'db connection dropped' },
                    }),
                  };
                },
              };
            },
          };
        }
        throw new Error(`Unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;
    const failingRepo = new SupabaseStorageRepository({
      client: failingClient,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });
    const validUuid = '11111111-1111-4111-8111-111111111101';
    await expect(
      failingRepo.updateMemory(validUuid, {
        memoryDate: '2025-01-01',
        title: 't',
        story: 's',
        imageUrl: '/samples/memory-1.svg',
        imageAlt: 'a',
      })
    ).rejects.toThrow(/db connection dropped/);
    await expect(failingRepo.deleteMemory(validUuid)).rejects.toThrow(/db connection dropped/);

    // PGRST116 returns null / false cleanly
    const notFoundClient = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: null,
                    error: { code: 'PGRST116', message: 'Results contain 0 rows' },
                  }),
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;
    const notFoundRepo = new SupabaseStorageRepository({
      client: notFoundClient,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });
    expect(
      await notFoundRepo.updateMemory(validUuid, {
        memoryDate: '2025-01-01',
        title: 't',
        story: 's',
        imageUrl: '/samples/memory-1.svg',
        imageAlt: 'a',
      })
    ).toBeNull();
    expect(await notFoundRepo.deleteMemory(validUuid)).toBe(false);
  });

  test('supports diary_entries CRUD, shared Storage object protection, and graceful 42P01 fallback when diary_entries table is not yet created', async () => {
    const sharedCloudUrl =
      'https://example.supabase.co/storage/v1/object/public/love-memories/image/shared-pic.jpg';
    const diaryOnlyCloudUrl =
      'https://example.supabase.co/storage/v1/object/public/love-memories/image/diary-only.jpg';

    const mock = createMockSupabaseClient({
      initialMemoryRows: [
        {
          id: '11111111-1111-4111-8111-111111111101',
          memory_date: '2026-11-15',
          title: 'Kỷ niệm dùng ảnh chung',
          story: 'Ảnh chung trên cloud',
          image_url: sharedCloudUrl,
          image_alt: 'Ảnh chung',
          sort_order: 0,
          created_at: '2026-11-15T00:00:00.000Z',
        },
      ],
    });
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    const d1 = await repo.createDiaryEntry({
      entryDate: '2026-11-16',
      title: 'Ngày của Em',
      content: 'Thương anh thật nhiều.',
      mood: 'miss_you',
      imageUrl: sharedCloudUrl,
      imageAlt: 'Ảnh chung',
      authorId: '00000000-0000-4000-8000-000000000002',
      authorUsername: 'nguoithuong',
      authorDisplayName: 'Em bé',
      authorRole: 'viewer',
    });
    const d2 = await repo.createDiaryEntry({
      entryDate: '2026-11-17',
      title: 'Ngày của Anh',
      content: 'Hẹn em cuối tuần đi dạo nhé.',
      mood: 'excited',
      imageUrl: diaryOnlyCloudUrl,
      imageAlt: 'Ảnh riêng nhật ký',
      authorId: '00000000-0000-4000-8000-000000000001',
      authorUsername: 'admin',
      authorDisplayName: 'Anh',
      authorRole: 'admin',
    });

    expect((await repo.getPublicData()).diaryEntries?.map((e) => e.id)).toEqual([d2.id, d1.id]);
    expect(await repo.isMediaUrlReferenced(sharedCloudUrl)).toBe(true);
    expect(await repo.isMediaUrlReferenced(diaryOnlyCloudUrl)).toBe(true);

    // Deleting d1 MUST NOT remove sharedCloudUrl from Storage because memory still uses it
    expect(await repo.deleteDiaryEntry(d1.id)).toBe(true);
    expect(mock.removedPaths).toEqual([]);

    // Updating d2 to remove diaryOnlyCloudUrl removes image/diary-only.jpg from Storage
    const updatedD2 = await repo.updateDiaryEntry(d2.id, {
      entryDate: '2026-11-17',
      title: 'Ngày của Anh (cập nhật)',
      content: 'Hẹn em tối nay luôn.',
      mood: 'happy',
      imageUrl: '',
      imageAlt: '',
    });
    expect(updatedD2?.title).toBe('Ngày của Anh (cập nhật)');
    expect(mock.removedPaths).toEqual([['image/diary-only.jpg']]);

    // Missing table 42P01 degrades gracefully on read and gives actionable error on write
    const unmigratedMock = createMockSupabaseClient({ missingDiaryTable: true });
    const unmigratedRepo = new SupabaseStorageRepository({
      client: unmigratedMock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });
    expect((await unmigratedRepo.getPublicData()).diaryEntries).toEqual([]);
    expect((await unmigratedRepo.getAdminData()).diaryEntries).toEqual([]);
    await expect(
      unmigratedRepo.createDiaryEntry({
        entryDate: '2026-11-17',
        title: '',
        content: 'Thử ghi khi chưa chạy SQL',
        mood: 'loved',
        imageUrl: '',
        imageAlt: '',
        authorId: null,
        authorUsername: 'admin',
        authorDisplayName: 'Anh',
        authorRole: 'admin',
      })
    ).rejects.toThrow(/supabase\/schema\.sql/);
  });

  test('supports multi-photo album CRUD, getMemoryById, multi-image reference checks, Storage orphan cleanup, and 42703 column fallback', async () => {
    const u1 = 'https://example.supabase.co/storage/v1/object/public/love-memories/image/a1.jpg';
    const u2 = 'https://example.supabase.co/storage/v1/object/public/love-memories/image/a2.jpg';
    const u3 = 'https://example.supabase.co/storage/v1/object/public/love-memories/image/a3.jpg';

    const mock = createMockSupabaseClient({ initialMemoryRows: [] });
    const repo = new SupabaseStorageRepository({
      client: mock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    const album = await repo.createMemory({
      memoryDate: '2026-04-05',
      title: 'Album cloud',
      story: 'Ba bức ảnh trên cloud.',
      imageUrl: u1,
      imageAlt: 'Bìa',
      images: [
        { url: u1, alt: 'Bìa' },
        { url: u2, alt: 'Ảnh 2' },
        { url: u3, alt: 'Ảnh 3' },
      ],
    });

    expect(album.images).toHaveLength(3);
    expect((await repo.getMemoryById(album.id))?.images?.map((i) => i.url)).toEqual([u1, u2, u3]);
    expect(await repo.isMediaUrlReferenced(u2)).toBe(true);
    expect(await repo.isMediaUrlReferenced(u3)).toBe(true);

    // Update album dropping u1 -> removes image/a1.jpg while keeping u2 & u3
    const updated = await repo.updateMemory(album.id, {
      memoryDate: '2026-04-05',
      title: 'Album cloud (cập nhật)',
      story: 'Chỉ giữ ảnh 2 và 3.',
      imageUrl: u2,
      imageAlt: 'Bìa 2',
      images: [
        { url: u2, alt: 'Bìa 2' },
        { url: u3, alt: 'Ảnh 3' },
      ],
    });
    expect(updated?.images).toHaveLength(2);
    expect(mock.removedPaths).toEqual([['image/a1.jpg']]);

    // Delete album -> removes u2 and u3
    expect(await repo.deleteMemory(album.id)).toBe(true);
    expect(mock.removedPaths).toEqual([['image/a1.jpg'], ['image/a2.jpg'], ['image/a3.jpg']]);

    // Missing images column fallback: 1-photo succeeds via image_url/image_alt, >=2 photos throws actionable SQL error
    const unmigratedClient = createMockSupabaseClient({ missingImagesColumn: true });
    const unmigratedRepo = new SupabaseStorageRepository({
      client: unmigratedClient.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });
    const singleFallback = await unmigratedRepo.createMemory({
      memoryDate: '2026-04-05',
      title: '1 ảnh',
      story: 'Fallback tương thích ngược.',
      imageUrl: u1,
      imageAlt: 'Ảnh 1',
      images: [{ url: u1, alt: 'Ảnh 1' }],
    });
    expect(singleFallback.images).toEqual([{ url: u1, alt: 'Ảnh 1' }]);

    await expect(
      unmigratedRepo.createMemory({
        memoryDate: '2026-04-05',
        title: 'Nhiều ảnh',
        story: 'Chưa nâng cấp cột images.',
        imageUrl: u1,
        imageAlt: 'Ảnh 1',
        images: [
          { url: u1, alt: 'Ảnh 1' },
          { url: u2, alt: 'Ảnh 2' },
        ],
      })
    ).rejects.toThrow(/supabase\/schema\.sql/);
  });
});
