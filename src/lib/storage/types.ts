import { AdminSiteData, AdminSiteSettings, MemoryItem, PublicSiteData } from '@/types/memories';
import { UploadKind, ValidatedMemoryPayload, ValidatedSettingsPayload } from '@/lib/validation';

export interface SignedUploadTarget {
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}

export interface StorageRepository {
  getPublicData(): Promise<PublicSiteData>;
  getAdminData(): Promise<AdminSiteData>;
  verifyViewerPasscode(pin: string): Promise<boolean>;
  updateSettings(input: ValidatedSettingsPayload): Promise<AdminSiteSettings>;
  createMemory(input: ValidatedMemoryPayload): Promise<MemoryItem>;
  updateMemory(id: string, input: ValidatedMemoryPayload): Promise<MemoryItem | null>;
  deleteMemory(id: string): Promise<boolean>;
  reorderMemories(ids: string[]): Promise<MemoryItem[]>;
  createSignedUploadUrl?(input: {
    kind: UploadKind;
    fileName: string;
    mimeType: string;
  }): Promise<SignedUploadTarget>;
  saveLocalUpload?(input: { fileName: string; buffer: Buffer }): Promise<{ publicUrl: string }>;
  deleteStoredFileByUrl(url: string): Promise<void>;
}
