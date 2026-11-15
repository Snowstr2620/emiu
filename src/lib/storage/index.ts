import { isUsingDefaultAdminPassword } from '@/lib/auth';
import { LocalStorageRepository } from '@/lib/storage/local-repository';
import { SupabaseStorageRepository } from '@/lib/storage/supabase-repository';
import { StorageRepository } from '@/lib/storage/types';
import { StorageStatus } from '@/types/memories';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  );
}

export function getStorageRepository(): StorageRepository {
  if (isSupabaseConfigured()) {
    return new SupabaseStorageRepository();
  }
  return new LocalStorageRepository();
}

export function getStorageStatus(): StorageStatus {
  const cloud = isSupabaseConfigured();
  const runningOnServerless = Boolean(process.env.VERCEL);
  return {
    mode: cloud ? 'supabase' : 'local',
    readOnlyServerlessWarning: !cloud && runningOnServerless,
    usingDefaultAdminPassword: isUsingDefaultAdminPassword(),
  };
}
