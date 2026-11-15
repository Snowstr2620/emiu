import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { hashPasscode, verifyPasscode } from '@/lib/auth';
import {
  createInitialSeedData,
  stripSettingsForAdmin,
  stripSettingsForPublic,
} from '@/lib/seed-data';
import {
  sanitizeStorageFileName,
  UploadKind,
  ValidatedMemoryPayload,
  ValidatedSettingsPayload,
} from '@/lib/validation';
import { SignedUploadTarget, StorageRepository } from '@/lib/storage/types';
import {
  AdminSiteData,
  AdminSiteSettings,
  MemoryItem,
  PublicSiteData,
  SiteSettings,
} from '@/types/memories';

interface DbSettingsRow {
  id: number;
  couple_title: string;
  hero_subtitle: string;
  love_start_date: string;
  music_url: string;
  music_enabled: boolean;
  letter_title: string;
  letter_body: string;
  letter_signature: string;
  viewer_passcode_enabled: boolean;
  viewer_passcode_hash: string;
  updated_at: string;
}

interface DbMemoryRow {
  id: string;
  memory_date: string;
  title: string;
  story: string;
  image_url: string;
  image_alt: string;
  sort_order: number;
  created_at: string;
}

function mapSettingsRow(row: DbSettingsRow): SiteSettings {
  return {
    coupleTitle: row.couple_title,
    heroSubtitle: row.hero_subtitle,
    loveStartDate: row.love_start_date,
    musicUrl: row.music_url,
    musicEnabled: row.music_enabled,
    letterTitle: row.letter_title,
    letterBody: row.letter_body,
    letterSignature: row.letter_signature,
    viewerPasscodeEnabled: row.viewer_passcode_enabled,
    viewerPasscodeHash: row.viewer_passcode_hash || '',
    updatedAt: row.updated_at,
  };
}

function mapMemoryRow(row: DbMemoryRow): MemoryItem {
  return {
    id: row.id,
    memoryDate: row.memory_date,
    title: row.title,
    story: row.story,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export class SupabaseStorageRepository implements StorageRepository {
  private readonly client: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly bucket: string;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!url || !key) {
      throw new Error('Supabase environment variables are missing.');
    }
    this.supabaseUrl = url.replace(/\/+$/, '');
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'love-memories';
    this.client = createClient(this.supabaseUrl, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async ensureInitializedAndFetch(): Promise<{
    settings: SiteSettings;
    memories: MemoryItem[];
  }> {
    const { data: settingsRow, error: settingsError } = await this.client
      .from('site_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle<DbSettingsRow>();

    if (settingsError) {
      throw new Error(`Lỗi truy vấn Supabase site_settings: ${settingsError.message}`);
    }

    let settings: SiteSettings;
    if (!settingsRow) {
      const seed = createInitialSeedData();
      const { data: inserted, error: insertError } = await this.client
        .from('site_settings')
        .upsert(
          {
            id: 1,
            couple_title: seed.settings.coupleTitle,
            hero_subtitle: seed.settings.heroSubtitle,
            love_start_date: seed.settings.loveStartDate,
            music_url: seed.settings.musicUrl,
            music_enabled: seed.settings.musicEnabled,
            letter_title: seed.settings.letterTitle,
            letter_body: seed.settings.letterBody,
            letter_signature: seed.settings.letterSignature,
            viewer_passcode_enabled: seed.settings.viewerPasscodeEnabled,
            viewer_passcode_hash: seed.settings.viewerPasscodeHash,
            updated_at: seed.settings.updatedAt,
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single<DbSettingsRow>();

      if (insertError || !inserted) {
        throw new Error(`Không thể khởi tạo dữ liệu mẫu Supabase: ${insertError?.message}`);
      }
      settings = mapSettingsRow(inserted);

      const { count } = await this.client
        .from('memories')
        .select('id', { count: 'exact', head: true });
      if (!count) {
        await this.client.from('memories').insert(
          seed.memories.map((m) => ({
            id: m.id,
            memory_date: m.memoryDate,
            title: m.title,
            story: m.story,
            image_url: m.imageUrl,
            image_alt: m.imageAlt,
            sort_order: m.sortOrder,
          }))
        );
      }
    } else {
      settings = mapSettingsRow(settingsRow);
    }

    const { data: memoryRows, error: memoryError } = await this.client
      .from('memories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('memory_date', { ascending: true })
      .returns<DbMemoryRow[]>();

    if (memoryError) {
      throw new Error(`Lỗi truy vấn Supabase memories: ${memoryError.message}`);
    }

    return {
      settings,
      memories: (memoryRows || []).map(mapMemoryRow),
    };
  }

  async getPublicData(): Promise<PublicSiteData> {
    const { settings, memories } = await this.ensureInitializedAndFetch();
    return {
      settings: stripSettingsForPublic(settings),
      memories,
    };
  }

  async getAdminData(): Promise<AdminSiteData> {
    const { settings, memories } = await this.ensureInitializedAndFetch();
    return {
      settings: stripSettingsForAdmin(settings),
      memories,
    };
  }

  async verifyViewerPasscode(pin: string): Promise<boolean> {
    const { settings } = await this.ensureInitializedAndFetch();
    if (!settings.viewerPasscodeEnabled) return true;
    return verifyPasscode(pin, settings.viewerPasscodeHash);
  }

  async updateSettings(input: ValidatedSettingsPayload): Promise<AdminSiteSettings> {
    const { settings: current } = await this.ensureInitializedAndFetch();
    const nextHash = input.viewerPasscode
      ? hashPasscode(input.viewerPasscode)
      : current.viewerPasscodeHash;

    const { data, error } = await this.client
      .from('site_settings')
      .upsert(
        {
          id: 1,
          couple_title: input.coupleTitle,
          hero_subtitle: input.heroSubtitle,
          love_start_date: input.loveStartDate,
          music_url: input.musicUrl,
          music_enabled: input.musicEnabled,
          letter_title: input.letterTitle,
          letter_body: input.letterBody,
          letter_signature: input.letterSignature,
          viewer_passcode_enabled: input.viewerPasscodeEnabled,
          viewer_passcode_hash: nextHash,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single<DbSettingsRow>();

    if (error || !data) {
      throw new Error(`Không thể lưu cài đặt Supabase: ${error?.message}`);
    }

    if (current.musicUrl && current.musicUrl !== input.musicUrl) {
      await this.deleteStoredFileByUrl(current.musicUrl);
    }

    return stripSettingsForAdmin(mapSettingsRow(data));
  }

  async createMemory(input: ValidatedMemoryPayload): Promise<MemoryItem> {
    const { data: existing } = await this.client
      .from('memories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle<{ sort_order: number }>();

    const nextSortOrder = (existing?.sort_order ?? -1) + 1;

    const { data, error } = await this.client
      .from('memories')
      .insert({
        memory_date: input.memoryDate,
        title: input.title,
        story: input.story,
        image_url: input.imageUrl,
        image_alt: input.imageAlt,
        sort_order: nextSortOrder,
      })
      .select('*')
      .single<DbMemoryRow>();

    if (error || !data) {
      throw new Error(`Không thể thêm kỷ niệm mới: ${error?.message}`);
    }

    return mapMemoryRow(data);
  }

  async updateMemory(id: string, input: ValidatedMemoryPayload): Promise<MemoryItem | null> {
    const { data: existing } = await this.client
      .from('memories')
      .select('image_url')
      .eq('id', id)
      .maybeSingle<{ image_url: string }>();

    if (!existing) return null;

    const { data, error } = await this.client
      .from('memories')
      .update({
        memory_date: input.memoryDate,
        title: input.title,
        story: input.story,
        image_url: input.imageUrl,
        image_alt: input.imageAlt,
      })
      .eq('id', id)
      .select('*')
      .single<DbMemoryRow>();

    if (error || !data) {
      throw new Error(`Không thể cập nhật kỷ niệm: ${error?.message}`);
    }

    if (existing.image_url && existing.image_url !== input.imageUrl) {
      await this.deleteStoredFileByUrl(existing.image_url);
    }

    return mapMemoryRow(data);
  }

  async deleteMemory(id: string): Promise<boolean> {
    const { data: existing } = await this.client
      .from('memories')
      .select('image_url')
      .eq('id', id)
      .maybeSingle<{ image_url: string }>();

    if (!existing) return false;

    const { error } = await this.client.from('memories').delete().eq('id', id);
    if (error) {
      throw new Error(`Không thể xoá kỷ niệm: ${error.message}`);
    }

    await this.deleteStoredFileByUrl(existing.image_url);
    return true;
  }

  async reorderMemories(ids: string[]): Promise<MemoryItem[]> {
    const { memories } = await this.ensureInitializedAndFetch();
    const map = new Map(memories.map((m) => [m.id, m]));
    const orderedIds: string[] = [];

    for (const id of ids) {
      if (map.has(id)) {
        orderedIds.push(id);
        map.delete(id);
      }
    }
    for (const leftover of map.keys()) {
      orderedIds.push(leftover);
    }

    await Promise.all(
      orderedIds.map((id, index) =>
        this.client.from('memories').update({ sort_order: index }).eq('id', id)
      )
    );

    const refreshed = await this.ensureInitializedAndFetch();
    return refreshed.memories;
  }

  async createSignedUploadUrl(input: {
    kind: UploadKind;
    fileName: string;
  }): Promise<SignedUploadTarget> {
    const safeName = sanitizeStorageFileName(input.fileName);
    const objectPath = `${input.kind}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(objectPath);

    if (error || !data) {
      throw new Error(`Không thể cấp quyền tải tệp lên Supabase Storage: ${error?.message}`);
    }

    const { data: pubData } = this.client.storage.from(this.bucket).getPublicUrl(objectPath);

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: objectPath,
      publicUrl: pubData.publicUrl,
    };
  }

  async deleteStoredFileByUrl(url: string): Promise<void> {
    if (!url || url.startsWith('/samples/') || url.includes('..')) {
      return;
    }

    const marker = `/storage/v1/object/public/${this.bucket}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;

    const objectPath = decodeURIComponent(url.slice(idx + marker.length).split('?')[0]);
    if (!objectPath || objectPath.includes('..')) return;

    await this.client.storage.from(this.bucket).remove([objectPath]);
  }
}
