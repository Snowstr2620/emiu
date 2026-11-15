import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import { getStorageRepository } from '@/lib/storage';
import { validateMemoryPayload } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const data = await repo.getAdminData(auth.user.id);
    return NextResponse.json({ memories: data.memories });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tải danh sách kỷ niệm.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const validated = validateMemoryPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const memory = await repo.createMemory(validated.data);
    return NextResponse.json({ memory }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tạo kỷ niệm mới.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
