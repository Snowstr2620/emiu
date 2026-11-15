import { redirect } from 'next/navigation';
import { resolveAdminSession } from '@/lib/auth';
import { getStorageRepository, getStorageStatus } from '@/lib/storage';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const repository = getStorageRepository();
  const adminUser = await resolveAdminSession(repository);
  if (!adminUser) {
    redirect('/admin/login');
  }

  const initialData = await repository.getAdminData(adminUser.id);
  const storageStatus = getStorageStatus();

  return <AdminDashboard initialData={initialData} storageStatus={storageStatus} />;
}
