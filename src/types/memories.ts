export type UserRole = 'admin' | 'viewer';

export type ActivityActorRole = UserRole | 'guest';

export type ActivityEventType =
  | 'page_visit'
  | 'page_leave'
  | 'login_step1_ok'
  | 'login_failed'
  | 'otp_verified'
  | 'otp_failed'
  | 'pixel_heart_viewed'
  | 'music_toggled'
  | 'memory_viewed'
  | 'letter_opened'
  | 'diary_saved'
  | 'diary_deleted'
  | 'logout';

export type DiaryMood =
  | 'loved'
  | 'happy'
  | 'peaceful'
  | 'miss_you'
  | 'grateful'
  | 'excited'
  | 'tired';

export interface AppUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  passwordHash: string;
  otpHash: string;
  otpHint: string;
  isActive: boolean;
  sessionVersion: number;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SafeAppUser {
  id: string;
  username: string;
  displayName: string;
  role: UserRole;
  otpHint: string;
  isActive: boolean;
  sessionVersion: number;
  hasPassword: boolean;
  hasOtp: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogItem {
  id: string;
  userId: string | null;
  username: string;
  userRole: ActivityActorRole;
  eventType: ActivityEventType;
  detail: string;
  deviceSummary: string;
  metadata: Record<string, string | number | boolean> | null;
  createdAt: string;
}

export interface TrafficSummary {
  visitsToday: number;
  otpVerifiedToday: number;
  failedAuthToday: number;
  activeUsersCount: number;
}

export interface SiteSettings {
  coupleTitle: string;
  heroSubtitle: string;
  loveStartDate: string; // YYYY-MM-DD
  /** First track of the playlist (kept for older data and single-track setups). */
  musicUrl: string;
  /** Ordered background-music playlist; plays in order and loops back to the first track. */
  musicPlaylist?: string[];
  musicEnabled: boolean;
  letterTitle: string;
  letterBody: string;
  letterSignature: string;
  viewerPasscodeEnabled: boolean;
  /** @deprecated Legacy global PIN hash kept optional for backward compatibility. */
  viewerPasscodeHash?: string;
  updatedAt: string;
}

export type PublicSiteSettings = Omit<SiteSettings, 'viewerPasscodeHash'>;

export type AdminSiteSettings = Omit<SiteSettings, 'viewerPasscodeHash'> & {
  usingDefaultAdminPassword?: boolean;
  usingDefaultSessionSecret?: boolean;
};

export interface MemoryImageItem {
  url: string;
  alt: string;
  mediaType?: 'image' | 'video';
}

export interface MemoryItem {
  id: string;
  memoryDate: string; // YYYY-MM-DD
  title: string;
  story: string;
  imageUrl: string;
  imageAlt: string;
  images?: MemoryImageItem[];
  sortOrder: number;
  createdAt: string;
}

export interface DiaryEntry {
  id: string;
  entryDate: string; // YYYY-MM-DD
  title: string;
  content: string;
  mood: DiaryMood;
  imageUrl: string;
  imageAlt: string;
  authorId: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorRole: UserRole;
  createdAt: string;
  updatedAt: string;
}

export interface PublicSiteData {
  settings: PublicSiteSettings;
  memories: MemoryItem[];
  diaryEntries?: DiaryEntry[];
}

export interface AdminSiteData {
  settings: AdminSiteSettings;
  memories: MemoryItem[];
  diaryEntries?: DiaryEntry[];
  users: SafeAppUser[];
  activityLogs: ActivityLogItem[];
  trafficSummary: TrafficSummary;
  currentUser?: SafeAppUser | null;
}

export interface ViewerSessionState {
  stage: 'unlocked' | 'otp_pending' | 'login_required';
  user: SafeAppUser | null;
  otpHint?: string;
}

export interface StorageStatus {
  mode: 'supabase' | 'local';
  readOnlyServerlessWarning: boolean;
  usingDefaultAdminPassword: boolean;
  usingDefaultSessionSecret: boolean;
}
