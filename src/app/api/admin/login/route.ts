import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  isSessionSecretConfigured,
  sanitizeUserForClient,
  setCookieOnResponse,
  signSessionPayload,
  summarizeUserAgent,
  type UserSessionTokenPayload,
  verifyUserPasswordConstantTime,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { validateUserLoginPayload } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production' && !isSessionSecretConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình biến môi trường ADMIN_SESSION_SECRET trên máy chủ.' },
        { status: 500 }
      );
    }

    const body = await request.json().catch(() => null);
    const validated = validateUserLoginPayload(body, { defaultUsername: 'admin' });
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { username, password } = validated.data;
    const repo = getStorageRepository();
    const user = await repo.getUserByUsername(username);
    const passwordValid = verifyUserPasswordConstantTime(user, password);
    const deviceSummary = summarizeUserAgent(request.headers.get('user-agent'));

    if (!user || !passwordValid) {
      await repo.recordActivity({
        userId: user?.id ?? null,
        username,
        userRole: user?.role ?? 'guest',
        eventType: 'login_failed',
        detail: 'Đăng nhập quản trị sai thông tin',
        deviceSummary,
      });
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu quản trị chưa đúng.' },
        { status: 401 }
      );
    }

    if (user.role !== 'admin') {
      await repo.recordActivity({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        eventType: 'login_failed',
        detail: 'Tài khoản viewer cố gắng đăng nhập /admin',
        deviceSummary,
      });
      return NextResponse.json(
        { error: 'Tài khoản này chỉ có quyền xem trang kỷ niệm, không có quyền quản trị.' },
        { status: 403 }
      );
    }

    if (!user.isActive) {
      await repo.recordActivity({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        eventType: 'login_failed',
        detail: 'Tài khoản quản trị đang bị tạm khoá',
        deviceSummary,
      });
      return NextResponse.json({ error: 'Tài khoản này đang bị tạm khoá.' }, { status: 403 });
    }

    await repo.recordUserLoginSuccess(user.id);
    const updated = (await repo.getUserById(user.id)) ?? user;

    await repo.recordActivity({
      userId: updated.id,
      username: updated.username,
      userRole: updated.role,
      eventType: 'login_step1_ok',
      detail: 'Đăng nhập khu vực quản trị thành công',
      deviceSummary,
    });

    const token = signSessionPayload<UserSessionTokenPayload>(
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

    const response = NextResponse.json({
      ok: true,
      user: sanitizeUserForClient(updated),
    });
    setCookieOnResponse(response, ADMIN_COOKIE_NAME, token, ADMIN_SESSION_TTL_SECONDS, request);
    return response;
  } catch {
    return NextResponse.json({ error: 'Không thể đăng nhập lúc này.' }, { status: 500 });
  }
}
