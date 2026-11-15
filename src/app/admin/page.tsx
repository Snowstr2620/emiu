import { redirect } from 'next/navigation';
import { isAdminRequestAuthenticated } from '@/lib/auth';
import { getStorageRepository, getStorageStatus } from '@/lib/storage';
import { AdminDashboard } from '@/components/admin/AdminDashboard';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  if (!(await isAdminRequestAuthenticated())) {
    redirect('/admin/login');
  }

  const repository = getStorageRepository();
  const initialData = await repository.getAdminData();
  const storageStatus = getStorageStatus();

  return <AdminDashboard initialData={initialData} storageStatus={storageStatus} />;
}
