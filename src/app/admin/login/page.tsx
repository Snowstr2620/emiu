import { redirect } from 'next/navigation';
import { isUsingDefaultAdminPassword, resolveAdminSession } from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  const repository = getStorageRepository();
  if (await resolveAdminSession(repository)) {
    redirect('/admin');
  }

  const showDevDefaultHint =
    process.env.NODE_ENV !== 'production' && isUsingDefaultAdminPassword();

  return <AdminLoginForm showDevDefaultHint={showDevDefaultHint} />;
}
