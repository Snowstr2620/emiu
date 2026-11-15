import {
  hashPasscode,
  isSessionSecretConfigured,
  isUsingDefaultAdminPassword,
  sanitizeUserForClient,
} from '@/lib/auth';
import { getVietnamCalendarDateParts } from '@/lib/date-utils';
import type { ListActivityLogsFilter } from '@/lib/storage/types';
import type { ValidatedUpdateUserPayload } from '@/lib/validation';
import type {
  ActivityLogItem,
  AdminSiteSettings,
  AppUser,
  MemoryItem,
  PublicSiteSettings,
  SiteSettings,
  TrafficSummary,
  UserRole,
} from '@/types/memories';

export { sanitizeUserForClient };

export interface LocalDbSchema {
  settings: SiteSettings;
  memories: MemoryItem[];
  users: AppUser[];
  activityLogs: ActivityLogItem[];
}

export const SEED_ADMIN_USER_ID = '00000000-0000-4000-8000-000000000001';
export const SEED_VIEWER_USER_ID = '00000000-0000-4000-8000-000000000002';

export function buildInitialUsers(now: string = new Date().toISOString()): AppUser[] {
  const isProd = process.env.NODE_ENV === 'production';
  const configuredAdminPass = process.env.ADMIN_PASSWORD?.trim() || '';

  if (isProd && (!configuredAdminPass || configuredAdminPass === 'love2026')) {
    throw new Error('ADMIN_PASSWORD is required when initializing production database');
  }

  const adminPassword = configuredAdminPass || 'love2026';
  const adminOtp = process.env.ADMIN_DEFAULT_OTP?.trim() || '140226';

  return [
    {
      id: SEED_ADMIN_USER_ID,
      username: 'admin',
      displayName: 'Anh · Người giữ chìa khóa ký ức',
      role: 'admin',
      passwordHash: hashPasscode(adminPassword),
      otpHash: hashPasscode(adminOtp),
      otpHint: 'Ngày lễ tình nhân ngọt ngào của tụi mình (14/02/26)',
      isActive: true,
      sessionVersion: 1,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: SEED_VIEWER_USER_ID,
      username: 'nguoithuong',
      displayName: 'Em bé thương yêu',
      role: 'viewer',
      passwordHash: hashPasscode('love2026'),
      otpHash: hashPasscode('121024'),
      otpHint: 'Ngày đầu tiên mình nắm tay nhau (12/10/24)',
      isActive: !isProd,
      sessionVersion: 1,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export const buildDefaultUsers = buildInitialUsers;

function createSeedSettingsAndMemories(now: string): {
  settings: SiteSettings;
  memories: MemoryItem[];
} {
  return {
    settings: {
      coupleTitle: 'Anh & Em · Chung Một Nhịp Tim',
      heroSubtitle:
        'Gửi em bé nhỏ của anh — nơi cất giữ từng nhịp thở dịu dàng, từng cái nắm tay ấm áp và muôn vàn khoảnh khắc tim mình rung lên vì nhau.',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em bé thương yêu nhất thế gian,',
      letterBody:
        'Em ơi, cảm ơn em vì đã dịu dàng bước đến, sưởi ấm thế giới nhỏ bé của anh bằng nụ cười trong veo và ánh mắt chứa cả bầu trời thương nhớ.\n\nCó những ngày vội vã trôi qua, chỉ cần nghĩ đến bàn tay bé xíu luôn nằm gọn trong tay anh, lòng anh lại hóa bình yên đến lạ. Từng tấm hình ở đây đều mang theo tiếng cười, hơi ấm và lời thì thầm rằng anh thương em nhiều hơn cả những gì câu chữ nói thành lời.\n\nMong rằng dù nắng ấm hay mưa giông, dù năm tháng có đổi thay thế nào, mình vẫn mãi gọi tên nhau thật khẽ và nắm chặt tay nhau đi hết mọi mùa yêu thương em nhé.',
      letterSignature: 'Thương em hơn cả hôm qua,\nAnh của em mãi mãi ♥',
      viewerPasscodeEnabled: true,
      viewerPasscodeHash: '',
      updatedAt: now,
    },
    memories: [
      {
        id: '11111111-1111-4111-8111-111111111101',
        memoryDate: '2024-10-12',
        title: 'Chiều mưa đầu tiên tim lỡ nhịp',
        story:
          'Ngoài hiên mưa rơi tí tách, còn trong tim anh lại rộn ràng nắng ấm từ khoảnh khắc em khẽ cười bên hai ly trà nóng. Từ giây phút ấy, anh biết mình đã thương em mất rồi.',
        imageUrl: '/samples/memory-1.svg',
        imageAlt: 'Hai tách trà ấm trong chiều mưa đầu tiên bên em',
        sortOrder: 0,
        createdAt: now,
      },
      {
        id: '11111111-1111-4111-8111-111111111102',
        memoryDate: '2025-01-19',
        title: 'Hoàng hôn nhuộm hồng má em xinh',
        story:
          'Gió chiều trên đồi khẽ vương mái tóc em bay, ánh nắng cuối ngày đẹp đến nao lòng nhưng vẫn chẳng rực rỡ bằng ánh mắt em nhìn anh lúc ấy.',
        imageUrl: '/samples/memory-2.svg',
        imageAlt: 'Hoàng hôn vàng hồng dịu dàng trên triền đồi',
        sortOrder: 1,
        createdAt: now,
      },
      {
        id: '11111111-1111-4111-8111-111111111103',
        memoryDate: '2025-06-08',
        title: 'Đêm biển nghe sóng hát tên mình',
        story:
          'Bước chân trần in dấu trên cát mịn, tay đan tay thật chặt dưới ánh trăng bạc. Hai đứa khẽ ước thầm năm nào cũng sẽ cùng nhau quay lại nghe biển hát lời yêu.',
        imageUrl: '/samples/memory-3.svg',
        imageAlt: 'Ánh trăng sáng soi trên mặt biển đêm yên bình',
        sortOrder: 2,
        createdAt: now,
      },
      {
        id: '11111111-1111-4111-8111-111111111104',
        memoryDate: '2026-02-14',
        title: 'Bó hoa pastel và lời thương tròn đầy',
        story:
          'Chẳng cần điều gì xa hoa, chỉ một bó hoa dịu dàng, bữa tối anh nấu bằng cả tấm lòng và cái ôm thật lâu từ em — vậy là đủ trọn vẹn cả bầu trời hạnh phúc.',
        imageUrl: '/samples/memory-4.svg',
        imageAlt: 'Bó hoa pastel dịu dàng ngày lễ tình nhân',
        sortOrder: 3,
        createdAt: now,
      },
    ],
  };
}

export function createInitialSeedData(): LocalDbSchema {
  const now = new Date().toISOString();
  const { settings, memories } = createSeedSettingsAndMemories(now);
  return {
    settings,
    memories,
    users: buildInitialUsers(now),
    activityLogs: [],
  };
}

export function stripSettingsForPublic(settings: SiteSettings): PublicSiteSettings {
  const { viewerPasscodeHash: _hidden, ...publicSettings } = settings;
  return publicSettings;
}

export function stripSettingsForAdmin(settings: SiteSettings): AdminSiteSettings {
  const { viewerPasscodeHash, ...rest } = settings;
  return {
    ...rest,
    usingDefaultAdminPassword: isUsingDefaultAdminPassword(),
    usingDefaultSessionSecret: !isSessionSecretConfigured(),
    hasViewerPasscode: Boolean(viewerPasscodeHash),
  };
}

/**
 * Upgrade legacy local-db.json files lacking `users` or `activityLogs`.
 * Enables `viewerPasscodeEnabled` once during the initial user migration,
 * and preserves the stored toggle untouched on subsequent loads once `users` exist.
 */
export function ensureSeededUsersAndUpgrade(raw: Partial<LocalDbSchema>): {
  db: LocalDbSchema;
  migrated: boolean;
} {
  const now = new Date().toISOString();
  const fallback = createSeedSettingsAndMemories(now);
  let migrated = false;

  const hasExistingUsers = Array.isArray(raw.users) && raw.users.length > 0;
  const users: AppUser[] = hasExistingUsers
    ? raw.users!.map((u) => ({
        ...u,
        otpHint: u.otpHint ?? '',
        sessionVersion: typeof u.sessionVersion === 'number' ? u.sessionVersion : 1,
        lastLoginAt: u.lastLoginAt ?? null,
      }))
    : (() => {
        migrated = true;
        return buildInitialUsers(now);
      })();

  const baseSettings = raw.settings ? { ...fallback.settings, ...raw.settings } : fallback.settings;
  if (!raw.settings) {
    migrated = true;
  }

  const settings: SiteSettings = {
    ...baseSettings,
    viewerPasscodeHash: baseSettings.viewerPasscodeHash ?? '',
    viewerPasscodeEnabled: hasExistingUsers ? Boolean(baseSettings.viewerPasscodeEnabled) : true,
  };

  if (!hasExistingUsers && raw.settings && raw.settings.viewerPasscodeEnabled !== true) {
    migrated = true;
  }

  const memories = Array.isArray(raw.memories)
    ? [...raw.memories].sort((a, b) => a.sortOrder - b.sortOrder)
    : (() => {
        migrated = true;
        return fallback.memories;
      })();

  const activityLogs = Array.isArray(raw.activityLogs)
    ? raw.activityLogs
    : (() => {
        migrated = true;
        return [];
      })();

  return {
    db: {
      settings,
      memories,
      users,
      activityLogs,
    },
    migrated,
  };
}

export function computeTrafficSummary(
  logs: ActivityLogItem[],
  users: AppUser[],
  now: Date = new Date()
): TrafficSummary {
  const todayVn = getVietnamCalendarDateParts(now);

  let visitsToday = 0;
  let otpVerifiedToday = 0;
  let failedAuthToday = 0;

  for (const log of logs) {
    const parsedDate = new Date(log.createdAt);
    if (Number.isNaN(parsedDate.getTime())) continue;

    const logVn = getVietnamCalendarDateParts(parsedDate);
    if (
      logVn.year !== todayVn.year ||
      logVn.month !== todayVn.month ||
      logVn.day !== todayVn.day
    ) {
      continue;
    }

    if (log.eventType === 'page_visit') {
      visitsToday++;
    } else if (log.eventType === 'otp_verified') {
      otpVerifiedToday++;
    } else if (log.eventType === 'login_failed' || log.eventType === 'otp_failed') {
      failedAuthToday++;
    }
  }

  return {
    visitsToday,
    otpVerifiedToday,
    failedAuthToday,
    activeUsersCount: users.filter((u) => u.isActive).length,
  };
}

export function assertCanModifyActiveAdmin(
  target: AppUser,
  otherActiveAdminsCount: number,
  action: 'update' | 'delete',
  nextRole?: UserRole,
  nextIsActive?: boolean
): void {
  if (target.role !== 'admin' || !target.isActive) return;
  if (otherActiveAdminsCount > 0) return;

  if (action === 'delete') {
    throw new Error('Không thể xoá tài khoản quản trị hoạt động cuối cùng.');
  }

  const effectiveRole = nextRole ?? target.role;
  const effectiveActive = nextIsActive ?? target.isActive;
  if (effectiveRole !== 'admin' || !effectiveActive) {
    throw new Error('Không thể khoá hoặc hạ quyền tài khoản quản trị hoạt động cuối cùng.');
  }
}

export function shouldBumpSessionVersion(
  current: AppUser,
  input: ValidatedUpdateUserPayload
): boolean {
  return Boolean(
    input.revokeSession ||
      input.password ||
      input.otpCode ||
      (input.role !== undefined && input.role !== current.role) ||
      (current.isActive && input.isActive === false)
  );
}

export function filterActivityLogs(
  logs: ActivityLogItem[],
  filters?: ListActivityLogsFilter
): ActivityLogItem[] {
  const normalizedUsername = filters?.username?.trim().toLowerCase();
  const searchTerm = filters?.search?.trim().toLowerCase();
  const eventTypeFilter =
    filters?.eventType && filters.eventType !== 'all' ? filters.eventType : null;
  const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);

  const filtered = logs.filter((log) => {
    if (eventTypeFilter && log.eventType !== eventTypeFilter) {
      return false;
    }
    if (
      normalizedUsername &&
      normalizedUsername !== 'all' &&
      normalizedUsername !== 'tat-ca' &&
      log.username.toLowerCase() !== normalizedUsername
    ) {
      return false;
    }
    if (searchTerm) {
      const haystack = [log.username, log.detail, log.deviceSummary, log.eventType]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(searchTerm)) {
        return false;
      }
    }
    return true;
  });

  return filtered.slice(0, limit);
}
