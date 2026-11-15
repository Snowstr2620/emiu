import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import { getStorageRepository } from '@/lib/storage';

export async function PUT(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as { ids?: unknown } | null;
    if (!Array.isArray(body?.ids) || body.ids.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Danh sách sắp xếp không hợp lệ.' }, { status: 400 });
    }

    const memories = await repo.reorderMemories(body.ids);
    return NextResponse.json({ memories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể sắp xếp lại kỷ niệm.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
