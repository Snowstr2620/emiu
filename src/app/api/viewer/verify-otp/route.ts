import { NextResponse } from 'next/server';
import {
  clearCookieOnResponse,
  DEFAULT_SESSION_TTL_SECONDS,
  GUEST_COOLDOWN_COOKIE_NAME,
  isSessionSecretConfigured,
  parseCookieFromHeader,
  sanitizeUserForClient,
  setCookieOnResponse,
  signSessionPayload,
  summarizeUserAgent,
  type UserSessionTokenPayload,
  verifyPasscode,
  verifyViewerTokenWithRepo,
  VIEWER_STEP1_COOKIE_NAME,
  VIEWER_UNLOCKED_COOKIE_NAME,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { validateOtpVerifyPayload } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    if (process.env.NODE_ENV === 'production' && !isSessionSecretConfigured()) {
      return NextResponse.json(
        { error: 'Chưa cấu hình biến môi trường ADMIN_SESSION_SECRET trên máy chủ.' },
        { status: 500 }
      );
    }

    const repo = getStorageRepository();
    const step1Token = parseCookieFromHeader(
      request.headers.get('cookie'),
      VIEWER_STEP1_COOKIE_NAME
    );
    const user = await verifyViewerTokenWithRepo(step1Token, 'viewer_step1', repo);

    if (!user) {
      const response = NextResponse.json(
        { error: 'Phiên đăng nhập bước 1 đã hết hạn hoặc bị thu hồi. Hãy đăng nhập lại nhé.' },
        { status: 401 }
      );
      clearCookieOnResponse(response, VIEWER_STEP1_COOKIE_NAME, request);
      return response;
    }

    const body = await request.json().catch(() => null);
    const validated = validateOtpVerifyPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const deviceSummary = summarizeUserAgent(request.headers.get('user-agent'));
    if (!verifyPasscode(validated.data.otp, user.otpHash)) {
      await repo.recordActivity({
        userId: user.id,
        username: user.username,
        userRole: user.role,
        eventType: 'otp_failed',
        detail: 'Nhập sai mã OTP 6 số',
        deviceSummary,
      });
      return NextResponse.json(
        { error: 'Mã OTP 6 số chưa khớp rồi, thử xem lại gợi ý nhé.' },
        { status: 401 }
      );
    }

    await repo.recordUserLoginSuccess(user.id);
    const updated = (await repo.getUserById(user.id)) ?? user;

    await repo.recordActivity({
      userId: updated.id,
      username: updated.username,
      userRole: updated.role,
      eventType: 'otp_verified',
      detail: 'Xác thực OTP thành công, mở khoá trang kỷ niệm',
      deviceSummary,
    });

    const unlockedToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: updated.id,
        usr: updated.username,
        ver: updated.sessionVersion,
        role: updated.role,
        exp: 0,
      },
      DEFAULT_SESSION_TTL_SECONDS
    );

    const response = NextResponse.json({
      ok: true,
      user: sanitizeUserForClient(updated),
    });
    setCookieOnResponse(
      response,
      VIEWER_UNLOCKED_COOKIE_NAME,
      unlockedToken,
      DEFAULT_SESSION_TTL_SECONDS,
      request
    );
    clearCookieOnResponse(response, VIEWER_STEP1_COOKIE_NAME, request);
    clearCookieOnResponse(response, GUEST_COOLDOWN_COOKIE_NAME, request);
    return response;
  } catch {
    return NextResponse.json({ error: 'Không thể xác thực mã OTP lúc này.' }, { status: 500 });
  }
}
