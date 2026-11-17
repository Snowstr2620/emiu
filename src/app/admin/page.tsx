import { redirect } from 'next/navigation';
import { isSessionSecretConfigured, resolveAdminSession } from '@/lib/auth';
import { ProductionSetupError } from '@/lib/seed-data';
import { getStorageRepository, getStorageStatus } from '@/lib/storage';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { ProductionSetupNotice } from '@/components/story/ProductionSetupNotice';
import type { AdminSiteData } from '@/types/memories';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const repository = getStorageRepository();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !isSessionSecretConfigured()) {
    console.error('[NY Startup] Thiếu biến môi trường ADMIN_SESSION_SECRET trong chế độ production.');
    return <ProductionSetupNotice missingSessionSecret />;
  }

  let initialData: AdminSiteData;
  let adminUser = null;
  try {
    adminUser = await resolveAdminSession(repository);
    if (!adminUser) {
      await repository.listUsers();
    } else {
      initialData = await repository.getAdminData(adminUser.id);
    }
  } catch (err) {
    if (err instanceof ProductionSetupError) {
      console.error('[NY Startup] Khởi tạo dữ liệu production thất bại:', err.message);
      return (
        <ProductionSetupNotice
          missingPassword={err.message.includes('ADMIN_PASSWORD')}
          missingSessionSecret={isProd && !isSessionSecretConfigured()}
          detailMessage={err.message.includes('ADMIN_DEFAULT_OTP') ? err.message : undefined}
        />
      );
    }
    throw err;
  }

  if (!adminUser) {
    redirect('/admin/login');
  }

  const storageStatus = getStorageStatus();

  return <AdminDashboard initialData={initialData!} storageStatus={storageStatus} />;
}
