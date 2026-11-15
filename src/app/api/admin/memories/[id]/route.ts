import { NextResponse } from 'next/server';
import { isAdminRequestAuthenticated } from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { validateMemoryPayload } from '@/lib/validation';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập quản trị.' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const validated = validateMemoryPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const repo = getStorageRepository();
    const memory = await repo.updateMemory(id, validated.data);
    if (!memory) {
      return NextResponse.json({ error: 'Không tìm thấy kỷ niệm cần cập nhật.' }, { status: 404 });
    }
    return NextResponse.json({ memory });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể cập nhật kỷ niệm.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  if (!(await isAdminRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập quản trị.' }, { status: 401 });
  }
  try {
    const { id } = await context.params;
    const repo = getStorageRepository();
    const deleted = await repo.deleteMemory(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Không tìm thấy kỷ niệm cần xoá.' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể xoá kỷ niệm.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
