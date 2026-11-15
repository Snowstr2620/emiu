import crypto from 'node:crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { hashPasscode, verifyPasscode } from '@/lib/auth';
import {
  assertCanModifyActiveAdmin,
  buildInitialUsers,
  computeTrafficSummary,
  createSeedSettingsAndMemories,
  filterActivityLogs,
  normalizeActivityLimit,
  sanitizeUserForClient,
  shouldBumpSessionVersion,
  stripSettingsForAdmin,
  stripSettingsForPublic,
} from '@/lib/seed-data';
import {
  sanitizeStorageFileName,
  UploadKind,
  ValidatedCreateUserPayload,
  ValidatedMemoryPayload,
  ValidatedSettingsPayload,
  ValidatedUpdateUserPayload,
} from '@/lib/validation';
import {
  ListActivityLogsFilter,
  RecordActivityInput,
  SignedUploadTarget,
  StorageRepository,
} from '@/lib/storage/types';
import {
  ActivityActorRole,
  ActivityEventType,
  ActivityLogItem,
  AdminSiteData,
  AdminSiteSettings,
  AppUser,
  MemoryItem,
  PublicSiteData,
  SafeAppUser,
  SiteSettings,
  UserRole,
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

interface DbAppUserRow {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  password_hash: string;
  otp_hash: string;
  otp_hint: string;
  is_active: boolean;
  session_version: number;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

interface DbActivityLogRow {
  id: string;
  user_id: string | null;
  username: string;
  user_role: ActivityActorRole;
  event_type: ActivityEventType;
  detail: string;
  device_summary: string;
  metadata: Record<string, string | number | boolean> | null;
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

function mapUserRow(row: DbAppUserRow): AppUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    passwordHash: row.password_hash,
    otpHash: row.otp_hash,
    otpHint: row.otp_hint || '',
    isActive: row.is_active,
    sessionVersion: row.session_version,
    lastLoginAt: row.last_login_at ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapActivityRow(row: DbActivityLogRow): ActivityLogItem {
  return {
    id: row.id,
    userId: row.user_id ?? null,
    username: row.username,
    userRole: row.user_role,
    eventType: row.event_type,
    detail: row.detail || '',
    deviceSummary: row.device_summary || '',
    metadata: row.metadata ?? null,
    createdAt: row.created_at,
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class SupabaseStorageRepository implements StorageRepository {
  private readonly client: SupabaseClient;
  private readonly supabaseUrl: string;
  private readonly bucket: string;

  constructor(options?: {
    client?: SupabaseClient;
    supabaseUrl?: string;
    bucket?: string;
  }) {
    const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const envKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

    this.bucket =
      options?.bucket?.trim() || process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'love-memories';

    if (options?.client) {
      this.client = options.client;
      this.supabaseUrl = (options.supabaseUrl || envUrl || 'https://supabase.local').replace(
        /\/+$/,
        ''
      );
      return;
    }

    if (!envUrl || !envKey) {
      throw new Error('Supabase environment variables are missing.');
    }
    this.supabaseUrl = envUrl.replace(/\/+$/, '');
    this.client = createClient(this.supabaseUrl, envKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async ensureUsersSeeded(): Promise<void> {
    const { count: userCount, error: userCountError } = await this.client
      .from('app_users')
      .select('id', { count: 'exact', head: true });

    if (userCountError) {
      throw new Error(`Lỗi kiểm tra bảng app_users trên Supabase: ${userCountError.message}`);
    }

    if (!userCount) {
      const initialUsers = buildInitialUsers();
      const { error: seedUserError } = await this.client.from('app_users').upsert(
        initialUsers.map((u) => ({
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
        })),
        { onConflict: 'username', ignoreDuplicates: true }
      );
      if (seedUserError) {
        throw new Error(`Không thể khởi tạo tài khoản mẫu Supabase: ${seedUserError.message}`);
      }

      // One-time upgrade for Phase 1 site_settings rows existing before app_users was seeded.
      const { error: upgradeErr } = await this.client
        .from('site_settings')
        .update({ viewer_passcode_enabled: true, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .eq('viewer_passcode_enabled', false);
      if (upgradeErr) {
        throw new Error(`Không thể nâng cấp cấu hình bảo mật Supabase: ${upgradeErr.message}`);
      }
    }
  }

  private async ensureInitializedAndFetch(): Promise<{
    settings: SiteSettings;
    memories: MemoryItem[];
  }> {
    await this.ensureUsersSeeded();

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
      const seed = createSeedSettingsAndMemories();
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
            viewer_passcode_hash: seed.settings.viewerPasscodeHash ?? '',
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

      const { count, error: countError } = await this.client
        .from('memories')
        .select('id', { count: 'exact', head: true });
      if (countError) {
        throw new Error(`Lỗi kiểm tra bảng memories trên Supabase: ${countError.message}`);
      }
      if (!count) {
        const { error: memSeedError } = await this.client.from('memories').upsert(
          seed.memories.map((m) => ({
            id: m.id,
            memory_date: m.memoryDate,
            title: m.title,
            story: m.story,
            image_url: m.imageUrl,
            image_alt: m.imageAlt,
            sort_order: m.sortOrder,
          })),
          { onConflict: 'id', ignoreDuplicates: true }
        );
        if (memSeedError) {
          throw new Error(`Không thể khởi tạo dữ liệu kỷ niệm mẫu Supabase: ${memSeedError.message}`);
        }
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

  private async listRawUsers(): Promise<AppUser[]> {
    const { data, error } = await this.client
      .from('app_users')
      .select('*')
      .order('created_at', { ascending: true })
      .returns<DbAppUserRow[]>();

    if (error) {
      throw new Error(`Lỗi truy vấn Supabase app_users: ${error.message}`);
    }
    return (data || []).map(mapUserRow);
  }

  private async countOtherActiveAdmins(excludeId: string): Promise<number> {
    const { data, error } = await this.client
      .from('app_users')
      .select('id')
      .eq('role', 'admin')
      .eq('is_active', true)
      .returns<{ id: string }[]>();

    if (error) {
      throw new Error(`Lỗi kiểm tra tài khoản quản trị Supabase: ${error.message}`);
    }
    return (data || []).filter((row) => row.id !== excludeId).length;
  }

  async getPublicData(): Promise<PublicSiteData> {
    const { settings, memories } = await this.ensureInitializedAndFetch();
    return {
      settings: stripSettingsForPublic(settings),
      memories,
    };
  }

  async getAdminData(currentUserId?: string | null): Promise<AdminSiteData> {
    const { settings, memories } = await this.ensureInitializedAndFetch();
    const [rawUsers, activityLogs] = await Promise.all([
      this.listRawUsers(),
      this.listActivityLogs({ limit: 200 }),
    ]);

    const users = rawUsers.map(sanitizeUserForClient);
    const currentUser = currentUserId ? (users.find((u) => u.id === currentUserId) ?? null) : null;

    return {
      settings: stripSettingsForAdmin(settings),
      memories,
      users,
      activityLogs,
      trafficSummary: computeTrafficSummary(activityLogs, rawUsers),
      currentUser,
    };
  }

  /** @deprecated Legacy global PIN check kept temporarily until Task 2 replaces /api/viewer/unlock. */
  async verifyViewerPasscode(pin: string): Promise<boolean> {
    const { settings } = await this.ensureInitializedAndFetch();
    if (!settings.viewerPasscodeEnabled) return true;
    return verifyPasscode(pin, settings.viewerPasscodeHash || '');
  }

  async updateSettings(input: ValidatedSettingsPayload): Promise<AdminSiteSettings> {
    const { settings: current } = await this.ensureInitializedAndFetch();
    const nextHash = input.viewerPasscode
      ? hashPasscode(input.viewerPasscode)
      : (current.viewerPasscodeHash ?? '');

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

    const reorderResults = await Promise.all(
      orderedIds.map((id, index) =>
        this.client.from('memories').update({ sort_order: index }).eq('id', id)
      )
    );
    const failedUpdate = reorderResults.find((result) => result.error);
    if (failedUpdate?.error) {
      throw new Error(`Không thể sắp xếp lại kỷ niệm trên Supabase: ${failedUpdate.error.message}`);
    }

    const refreshed = await this.ensureInitializedAndFetch();
    return refreshed.memories;
  }

  async listUsers(): Promise<SafeAppUser[]> {
    await this.ensureUsersSeeded();
    const users = await this.listRawUsers();
    return users.map(sanitizeUserForClient);
  }

  async getUserByUsername(username: string): Promise<AppUser | null> {
    const normalized = username.trim().toLowerCase();
    if (!normalized) return null;
    await this.ensureUsersSeeded();

    const { data, error } = await this.client
      .from('app_users')
      .select('*')
      .eq('username', normalized)
      .maybeSingle<DbAppUserRow>();

    if (error) {
      throw new Error(`Lỗi truy vấn tài khoản Supabase: ${error.message}`);
    }
    return data ? mapUserRow(data) : null;
  }

  async getUserById(id: string): Promise<AppUser | null> {
    if (!id || !UUID_REGEX.test(id)) return null;
    const { data, error } = await this.client
      .from('app_users')
      .select('*')
      .eq('id', id)
      .maybeSingle<DbAppUserRow>();

    if (error) {
      if (error.code === '22P02') return null;
      throw new Error(`Lỗi truy vấn tài khoản Supabase: ${error.message}`);
    }
    return data ? mapUserRow(data) : null;
  }

  async createUser(input: ValidatedCreateUserPayload): Promise<SafeAppUser> {
    await this.ensureUsersSeeded();
    const username = input.username.trim().toLowerCase();

    const existing = await this.getUserByUsername(username);
    if (existing) {
      throw new Error('Tên đăng nhập này đã tồn tại.');
    }

    const now = new Date().toISOString();
    const { data, error } = await this.client
      .from('app_users')
      .insert({
        username,
        display_name: input.displayName.trim(),
        role: input.role,
        password_hash: hashPasscode(input.password),
        otp_hash: hashPasscode(input.otpCode),
        otp_hint: input.otpHint.trim(),
        is_active: input.isActive,
        session_version: 1,
        last_login_at: null,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single<DbAppUserRow>();

    if (error || !data) {
      if (error?.code === '23505') {
        throw new Error('Tên đăng nhập này đã tồn tại.');
      }
      throw new Error(`Không thể tạo tài khoản Supabase: ${error?.message}`);
    }

    return sanitizeUserForClient(mapUserRow(data));
  }

  async updateUser(id: string, input: ValidatedUpdateUserPayload): Promise<SafeAppUser | null> {
    const current = await this.getUserById(id);
    if (!current) return null;

    const otherActiveAdminsCount = await this.countOtherActiveAdmins(id);
    assertCanModifyActiveAdmin(
      current,
      otherActiveAdminsCount,
      'update',
      input.role,
      input.isActive
    );

    const nextSessionVersion = shouldBumpSessionVersion(current, input)
      ? current.sessionVersion + 1
      : current.sessionVersion;

    const patch: Record<string, unknown> = {
      display_name: input.displayName !== undefined ? input.displayName.trim() : current.displayName,
      role: input.role ?? current.role,
      password_hash: input.password ? hashPasscode(input.password) : current.passwordHash,
      otp_hash: input.otpCode ? hashPasscode(input.otpCode) : current.otpHash,
      otp_hint: input.otpHint !== undefined ? input.otpHint.trim() : current.otpHint,
      is_active: input.isActive ?? current.isActive,
      session_version: nextSessionVersion,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.client
      .from('app_users')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single<DbAppUserRow>();

    if (error || !data) {
      throw new Error(`Không thể cập nhật tài khoản Supabase: ${error?.message}`);
    }

    return sanitizeUserForClient(mapUserRow(data));
  }

  async deleteUser(id: string): Promise<boolean> {
    const target = await this.getUserById(id);
    if (!target) return false;

    const otherActiveAdminsCount = await this.countOtherActiveAdmins(id);
    assertCanModifyActiveAdmin(target, otherActiveAdminsCount, 'delete');

    const { error } = await this.client.from('app_users').delete().eq('id', id);
    if (error) {
      throw new Error(`Không thể xoá tài khoản Supabase: ${error.message}`);
    }
    return true;
  }

  async recordUserLoginSuccess(id: string): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.client
      .from('app_users')
      .update({ last_login_at: now, updated_at: now })
      .eq('id', id);

    if (error) {
      throw new Error(`Không thể cập nhật lần đăng nhập cuối: ${error.message}`);
    }
  }

  async recordActivity(input: RecordActivityInput): Promise<ActivityLogItem> {
    const { data, error } = await this.client
      .from('activity_logs')
      .insert({
        user_id: input.userId,
        username: input.username,
        user_role: input.userRole,
        event_type: input.eventType,
        detail: input.detail.slice(0, 160),
        device_summary: input.deviceSummary.slice(0, 48),
        metadata: input.metadata ?? null,
      })
      .select('*')
      .single<DbActivityLogRow>();

    if (error || !data) {
      throw new Error(`Không thể ghi nhật ký hoạt động Supabase: ${error?.message}`);
    }
    return mapActivityRow(data);
  }

  async listActivityLogs(filters?: ListActivityLogsFilter): Promise<ActivityLogItem[]> {
    const limit = normalizeActivityLimit(filters?.limit);
    const hasSearch = Boolean(filters?.search?.trim());

    let query = this.client
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.eventType && filters.eventType !== 'all') {
      query = query.eq('event_type', filters.eventType);
    }

    const normalizedUsername = filters?.username?.trim().toLowerCase();
    if (
      normalizedUsername &&
      normalizedUsername !== 'all' &&
      normalizedUsername !== 'tat-ca'
    ) {
      query = query.eq('username', normalizedUsername);
    }

    const { data, error } = await query
      .limit(hasSearch ? 500 : limit)
      .returns<DbActivityLogRow[]>();

    if (error) {
      throw new Error(`Lỗi truy vấn nhật ký hoạt động Supabase: ${error.message}`);
    }

    return filterActivityLogs((data || []).map(mapActivityRow), filters);
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
