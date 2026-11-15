export interface SiteSettings {
  coupleTitle: string;
  heroSubtitle: string;
  loveStartDate: string; // YYYY-MM-DD
  musicUrl: string;
  musicEnabled: boolean;
  letterTitle: string;
  letterBody: string;
  letterSignature: string;
  viewerPasscodeEnabled: boolean;
  viewerPasscodeHash: string;
  updatedAt: string;
}

export type PublicSiteSettings = Omit<SiteSettings, 'viewerPasscodeHash'>;

export type AdminSiteSettings = Omit<SiteSettings, 'viewerPasscodeHash'> & {
  hasViewerPasscode: boolean;
};

export interface MemoryItem {
  id: string;
  memoryDate: string; // YYYY-MM-DD
  title: string;
  story: string;
  imageUrl: string;
  imageAlt: string;
  sortOrder: number;
  createdAt: string;
}

export interface PublicSiteData {
  settings: PublicSiteSettings;
  memories: MemoryItem[];
}

export interface AdminSiteData {
  settings: AdminSiteSettings;
  memories: MemoryItem[];
}

export interface StorageStatus {
  mode: 'supabase' | 'local';
  readOnlyServerlessWarning: boolean;
  usingDefaultAdminPassword: boolean;
}
