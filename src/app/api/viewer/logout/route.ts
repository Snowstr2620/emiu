import { NextResponse } from 'next/server';
import {
  clearCookieOnResponse,
  clearViewerCookiesOnResponse,
  GUEST_COOLDOWN_COOKIE_NAME,
  resolveViewerSession,
  summarizeUserAgent,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const session = await resolveViewerSession(repo, request);

    if (session.user) {
      await repo.recordActivity({
        userId: session.user.id,
        username: session.user.username,
        userRole: session.user.role,
        eventType: 'logout',
        detail: 'Đăng xuất khỏi trang kỷ niệm',
        deviceSummary: summarizeUserAgent(request.headers.get('user-agent')),
      });
    }
  } catch {
    // Always clear cookies even if logging audit fails
  }

  const response = NextResponse.json({ ok: true });
  clearViewerCookiesOnResponse(response, request);
  clearCookieOnResponse(response, GUEST_COOLDOWN_COOKIE_NAME, request);
  return response;
}
