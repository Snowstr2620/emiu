import { redirect } from 'next/navigation';
import {
  isSessionSecretConfigured,
  isUsingDefaultAdminPassword,
  resolveAdminSession,
} from '@/lib/auth';
import { ProductionSetupError } from '@/lib/seed-data';
import { getStorageRepository } from '@/lib/storage';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';
import { ProductionSetupNotice } from '@/components/story/ProductionSetupNotice';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const repository = getStorageRepository();
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd && !isSessionSecretConfigured()) {
    console.error('[NY Startup] Thiếu biến môi trường ADMIN_SESSION_SECRET trong chế độ production.');
    return <ProductionSetupNotice missingSessionSecret />;
  }

  let existingAdmin = null;
  try {
    await repository.listUsers();
    existingAdmin = await resolveAdminSession(repository);
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

  if (existingAdmin) {
    redirect('/admin');
  }

  const showDevDefaultHint = !isProd && isUsingDefaultAdminPassword();

  return <AdminLoginForm showDevDefaultHint={showDevDefaultHint} />;
}
