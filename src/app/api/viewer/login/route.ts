import { NextResponse } from 'next/server';
import {
  isSessionSecretConfigured,
  sanitizeUserForClient,
  setCookieOnResponse,
  signSessionPayload,
  summarizeUserAgent,
  type UserSessionTokenPayload,
  verifyUserPasswordConstantTime,
  VIEWER_STEP1_COOKIE_NAME,
  VIEWER_STEP1_TTL_SECONDS,
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
    const validated = validateUserLoginPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { username, password } = validated.data;
    const repo = getStorageRepository();
    const user = await repo.getUserByUsername(username);
    const passwordMatches = verifyUserPasswordConstantTime(user, password);
    const deviceSummary = summarizeUserAgent(request.headers.get('user-agent'));

    if (!user || !passwordMatches) {
      await repo.recordActivity({
        userId: user?.id ?? null,
        username,
        userRole: user?.role ?? 'guest',
        eventType: 'login_failed',
        detail: 'Đăng nhập bước 1 sai tài khoản hoặc mật khẩu',
        deviceSummary,
      });
      return NextResponse.json(
        { error: 'Tài khoản hoặc mật khẩu chưa khớp mất rồi, kiểm tra lại nhé.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      await repo.recordActivity({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        eventType: 'login_failed',
        detail: 'Đăng nhập khi tài khoản đang bị tạm khoá',
        deviceSummary,
      });
      return NextResponse.json(
        { error: 'Tài khoản này hiện đang được chủ vườn ký ức tạm khoá.' },
        { status: 403 }
      );
    }

    await repo.recordActivity({
      userId: user.id,
      username: user.username,
      userRole: user.role,
      eventType: 'login_step1_ok',
      detail: 'Đăng nhập bước 1 thành công, chờ OTP',
      deviceSummary,
    });

    const token = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_step1',
        sub: user.id,
        usr: user.username,
        ver: user.sessionVersion,
        role: user.role,
        hint: user.otpHint,
        exp: 0,
      },
      VIEWER_STEP1_TTL_SECONDS
    );

    const response = NextResponse.json({
      ok: true,
      step: 'otp_required',
      otpHint: user.otpHint,
      user: sanitizeUserForClient(user),
    });
    setCookieOnResponse(
      response,
      VIEWER_STEP1_COOKIE_NAME,
      token,
      VIEWER_STEP1_TTL_SECONDS,
      request
    );
    return response;
  } catch {
    return NextResponse.json({ error: 'Không thể đăng nhập lúc này.' }, { status: 500 });
  }
}
