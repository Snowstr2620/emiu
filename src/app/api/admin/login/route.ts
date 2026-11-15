import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  DEFAULT_SESSION_TTL_SECONDS,
  getConfiguredAdminPassword,
  isSessionSecretConfigured,
  shouldUseSecureCookie,
  verifyAdminPassword,
} from '@/lib/auth';

export async function POST(request: Request) {
  try {
    if (!getConfiguredAdminPassword()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình biến môi trường ADMIN_PASSWORD trên máy chủ.' },
        { status: 500 }
      );
    }

    if (process.env.NODE_ENV === 'production' && !isSessionSecretConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình biến môi trường ADMIN_SESSION_SECRET trên máy chủ.' },
        { status: 500 }
      );
    }

    const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
    const password = typeof body?.password === 'string' ? body.password : '';

    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: 'Mật khẩu quản trị không đúng.' }, { status: 401 });
    }

    const token = createAdminSessionToken(DEFAULT_SESSION_TTL_SECONDS);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: shouldUseSecureCookie(request),
      maxAge: DEFAULT_SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Không thể đăng nhập lúc này.' }, { status: 500 });
  }
}
