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
} from '@/types/memories';
import {
  UploadKind,
  ValidatedCreateUserPayload,
  ValidatedMemoryPayload,
  ValidatedSettingsPayload,
  ValidatedUpdateUserPayload,
} from '@/lib/validation';

export interface SignedUploadTarget {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}

export interface RecordActivityInput {
  userId: string | null;
  username: string;
  userRole: ActivityActorRole;
  eventType: ActivityEventType;
  detail: string;
  deviceSummary: string;
  metadata?: Record<string, string | number | boolean> | null;
}

export interface ListActivityLogsFilter {
  eventType?: ActivityEventType | 'all';
  username?: string;
  search?: string;
  limit?: number;
}

export interface StorageRepository {
  getPublicData(): Promise<PublicSiteData>;
  getAdminData(currentUserId?: string | null): Promise<AdminSiteData>;
  /** @deprecated Legacy global PIN check kept temporarily until Task 2 replaces /api/viewer/unlock. */
  verifyViewerPasscode(pin: string): Promise<boolean>;
  updateSettings(input: ValidatedSettingsPayload): Promise<AdminSiteSettings>;
  createMemory(input: ValidatedMemoryPayload): Promise<MemoryItem>;
  updateMemory(id: string, input: ValidatedMemoryPayload): Promise<MemoryItem | null>;
  deleteMemory(id: string): Promise<boolean>;
  reorderMemories(ids: string[]): Promise<MemoryItem[]>;
  listUsers(): Promise<SafeAppUser[]>;
  getUserByUsername(username: string): Promise<AppUser | null>;
  getUserById(id: string): Promise<AppUser | null>;
  createUser(input: ValidatedCreateUserPayload): Promise<SafeAppUser>;
  updateUser(id: string, input: ValidatedUpdateUserPayload): Promise<SafeAppUser | null>;
  deleteUser(id: string): Promise<boolean>;
  recordUserLoginSuccess(id: string): Promise<void>;
  recordActivity(input: RecordActivityInput): Promise<ActivityLogItem>;
  listActivityLogs(filters?: ListActivityLogsFilter): Promise<ActivityLogItem[]>;
  createSignedUploadUrl?(input: {
    kind: UploadKind;
    fileName: string;
    mimeType: string;
  }): Promise<SignedUploadTarget>;
  saveLocalUpload?(input: { fileName: string; buffer: Buffer }): Promise<{ publicUrl: string }>;
  deleteStoredFileByUrl(url: string): Promise<void>;
}
