import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import { getStorageRepository } from '@/lib/storage';
import { validateUpdateUserPayload } from '@/lib/validation';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const body = await request.json().catch(() => null);
    const validated = validateUpdateUserPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    if (
      id === auth.user.id &&
      (validated.data.isActive === false || validated.data.role === 'viewer')
    ) {
      return NextResponse.json(
        { error: 'Bạn không thể tự khoá hoặc hạ quyền tài khoản quản trị đang đăng nhập.' },
        { status: 400 }
      );
    }

    const user = await repo.updateUser(id, validated.data);
    if (!user) {
      return NextResponse.json(
        { error: 'Không tìm thấy tài khoản cần cập nhật.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể cập nhật tài khoản.';
    const status = message.includes('cuối cùng') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    if (id === auth.user.id) {
      return NextResponse.json(
        { error: 'Bạn không thể tự xoá tài khoản đang đăng nhập.' },
        { status: 400 }
      );
    }

    const deleted = await repo.deleteUser(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Không tìm thấy tài khoản cần xoá.' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể xoá tài khoản.';
    const status = message.includes('cuối cùng') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
