import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import { getStorageRepository, getStorageStatus } from '@/lib/storage';
import { validateSettingsPayload } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const data = await repo.getAdminData(auth.user.id);
    return NextResponse.json({ ...data, status: getStorageStatus() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi tải cấu hình.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const validated = validateSettingsPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const settings = await repo.updateSettings(validated.data);
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể lưu cài đặt.';
    const status = message.includes('mã mở khoá') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
