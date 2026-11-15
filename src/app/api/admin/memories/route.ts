import { NextResponse } from 'next/server';
import { isAdminRequestAuthenticated } from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { validateMemoryPayload } from '@/lib/validation';

export async function GET(request: Request) {
  if (!(await isAdminRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập quản trị.' }, { status: 401 });
  }
  try {
    const repo = getStorageRepository();
    const data = await repo.getAdminData();
    return NextResponse.json({ memories: data.memories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tải danh sách kỷ niệm.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập quản trị.' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => null);
    const validated = validateMemoryPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const repo = getStorageRepository();
    const memory = await repo.createMemory(validated.data);
    return NextResponse.json({ memory }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tạo kỷ niệm mới.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
