import { NextResponse } from 'next/server';
import {
  createViewerSessionToken,
  DEFAULT_SESSION_TTL_SECONDS,
  VIEWER_COOKIE_NAME,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { passcode?: unknown } | null;
    const passcode = typeof body?.passcode === 'string' ? body.passcode.trim() : '';

    const repo = getStorageRepository();
    const ok = await repo.verifyViewerPasscode(passcode);
    if (!ok) {
      return NextResponse.json(
        { error: 'Mã kỷ niệm chưa đúng, bạn thử lại nhé.' },
        { status: 401 }
      );
    }

    const token = createViewerSessionToken(DEFAULT_SESSION_TTL_SECONDS);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(VIEWER_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: DEFAULT_SESSION_TTL_SECONDS,
    });
    return response;
  } catch {
    return NextResponse.json({ error: 'Không thể kiểm tra mã kỷ niệm lúc này.' }, { status: 500 });
  }
}
