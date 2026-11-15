import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  setCookieOnResponse,
  signSessionPayload,
  type UserSessionTokenPayload,
} from '@/lib/auth';
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

    if (id === auth.user.id) {
      if (validated.data.isActive === false || validated.data.role === 'viewer') {
        return NextResponse.json(
          { error: 'Bạn không thể tự khoá hoặc hạ quyền tài khoản quản trị đang đăng nhập.' },
          { status: 400 }
        );
      }
      if (validated.data.revokeSession) {
        return NextResponse.json(
          { error: 'Không thể tự thu hồi phiên đang sử dụng; hãy dùng nút Đăng xuất.' },
          { status: 400 }
        );
      }
    }

    const updated = await repo.updateUser(id, validated.data);
    if (!updated) {
      return NextResponse.json(
        { error: 'Không tìm thấy tài khoản cần cập nhật.' },
        { status: 404 }
      );
    }

    const response = NextResponse.json({ user: updated });
    if (id === auth.user.id && updated.sessionVersion !== auth.user.sessionVersion) {
      const refreshedToken = signSessionPayload<UserSessionTokenPayload>(
        {
          typ: 'admin',
          sub: updated.id,
          usr: updated.username,
          ver: updated.sessionVersion,
          role: 'admin',
          exp: 0,
        },
        ADMIN_SESSION_TTL_SECONDS
      );
      setCookieOnResponse(
        response,
        ADMIN_COOKIE_NAME,
        refreshedToken,
        ADMIN_SESSION_TTL_SECONDS,
        request
      );
    }

    return response;
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
