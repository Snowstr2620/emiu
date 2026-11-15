import { NextResponse } from 'next/server';
import { isAdminRequestAuthenticated } from '@/lib/auth';
import { getStorageRepository, getStorageStatus } from '@/lib/storage';
import { validateSettingsPayload } from '@/lib/validation';

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập quản trị.' }, { status: 401 });
  }
  try {
    const repo = getStorageRepository();
    const data = await repo.getAdminData();
    return NextResponse.json({ ...data, status: getStorageStatus() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi tải cấu hình.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!(await isAdminRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập quản trị.' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const validated = validateSettingsPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const repo = getStorageRepository();
    const settings = await repo.updateSettings(validated.data);
    return NextResponse.json({ settings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể lưu cài đặt.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
