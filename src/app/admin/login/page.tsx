import { redirect } from 'next/navigation';
import { isAdminRequestAuthenticated, isUsingDefaultAdminPassword } from '@/lib/auth';
import { AdminLoginForm } from '@/components/admin/AdminLoginForm';

export const dynamic = 'force-dynamic';

export default async function AdminLoginPage() {
  if (await isAdminRequestAuthenticated()) {
    redirect('/admin');
  }

  const showDevDefaultHint =
    process.env.NODE_ENV !== 'production' && isUsingDefaultAdminPassword();

  return <AdminLoginForm showDevDefaultHint={showDevDefaultHint} />;
}
