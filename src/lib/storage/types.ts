import {
  ActivityActorRole,
  ActivityEventType,
  ActivityLogItem,
  AdminSiteData,
  AdminSiteSettings,
  AppUser,
  DiaryEntry,
  MemoryImageItem,
  MemoryItem,
  PublicSiteData,
  SafeAppUser,
  UserRole,
} from '@/types/memories';
import {
  UploadKind,
  ValidatedCreateUserPayload,
  ValidatedDiaryEntryPayload,
  ValidatedMemoryPayload,
  ValidatedSettingsPayload,
  ValidatedUpdateUserPayload,
} from '@/lib/validation';

export type MemoryMutationInput = Omit<ValidatedMemoryPayload, 'images'> & {
  images?: MemoryImageItem[];
};

export interface CreateDiaryEntryInput extends ValidatedDiaryEntryPayload {
  authorId: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorRole: UserRole;
}

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
  updateSettings(input: ValidatedSettingsPayload): Promise<AdminSiteSettings>;
  getMemoryById(id: string): Promise<MemoryItem | null>;
  createMemory(input: MemoryMutationInput): Promise<MemoryItem>;
  updateMemory(id: string, input: MemoryMutationInput): Promise<MemoryItem | null>;
  deleteMemory(id: string): Promise<boolean>;
  reorderMemories(ids: string[]): Promise<MemoryItem[]>;
  listDiaryEntries(): Promise<DiaryEntry[]>;
  getDiaryEntryById(id: string): Promise<DiaryEntry | null>;
  createDiaryEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry>;
  updateDiaryEntry(id: string, input: ValidatedDiaryEntryPayload): Promise<DiaryEntry | null>;
  deleteDiaryEntry(id: string): Promise<boolean>;
  isMediaUrlReferenced(url: string): Promise<boolean>;
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
