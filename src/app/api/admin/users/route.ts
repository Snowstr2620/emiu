import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import { getStorageRepository } from '@/lib/storage';
import { validateCreateUserPayload } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const users = await repo.listUsers();
    return NextResponse.json({ users });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tải danh sách tài khoản.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const validated = validateCreateUserPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const existing = await repo.getUserByUsername(validated.data.username);
    if (existing) {
      return NextResponse.json({ error: 'Tên đăng nhập này đã tồn tại.' }, { status: 409 });
    }

    const user = await repo.createUser(validated.data);
    return NextResponse.json({ user }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tạo tài khoản mới.';
    const status = message.includes('đã tồn tại') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
