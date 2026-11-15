import { describe, expect, test } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseStorageRepository } from '@/lib/storage/supabase-repository';
import { createInitialSeedData } from '@/lib/seed-data';

function createMockSupabaseClient(options?: {
  initialSettingsRow?: Record<string, unknown> | null;
  initialMemoryRows?: Record<string, unknown>[];
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
          viewer_passcode_enabled: false,
          viewer_passcode_hash: 'salt:expectedhash',
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

  const calls: string[] = [];
  const removedPaths: string[][] = [];
  let updateCallCount = 0;

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
  test('seeds cold start idempotently with upsert ignoreDuplicates and throws on seed insert error', async () => {
    const okMock = createMockSupabaseClient({
      initialSettingsRow: null,
      initialMemoryRows: [],
    });
    const repo = new SupabaseStorageRepository({
      client: okMock.client,
      supabaseUrl: 'https://example.supabase.co',
      bucket: 'love-memories',
    });

    const pub = await repo.getPublicData();
    expect(pub.memories).toHaveLength(4);
    expect('viewerPasscodeHash' in pub.settings).toBe(false);
    expect(okMock.calls).toContain('memories.upsert:id:true');

    const admin = await repo.getAdminData();
    expect(admin.settings.hasViewerPasscode).toBe(false);
    expect('viewerPasscodeHash' in admin.settings).toBe(false);

    const errMock = createMockSupabaseClient({
      initialSettingsRow: null,
      initialMemoryRows: [],
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

  test('rejects enabling viewerPasscodeEnabled without an existing or new passcode', async () => {
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

    await expect(
      repo.updateSettings({
        coupleTitle: 'Minh & Lan',
        heroSubtitle: 'Subtitle',
        loveStartDate: '2024-10-12',
        musicUrl: '/samples/gentle-memories.wav',
        musicEnabled: true,
        letterTitle: 'Gửi em',
        letterBody: 'Nội dung thư.',
        letterSignature: 'Minh',
        viewerPasscodeEnabled: true,
      })
    ).rejects.toThrow();
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
