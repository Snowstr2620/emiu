import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  clearCookieOnResponse,
  resolveAdminSession,
  summarizeUserAgent,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const adminUser = await resolveAdminSession(repo, request);

    if (adminUser) {
      await repo.recordActivity({
        userId: adminUser.id,
        username: adminUser.username,
        userRole: adminUser.role,
        eventType: 'logout',
        detail: 'Đăng xuất khỏi trang quản trị',
        deviceSummary: summarizeUserAgent(request.headers.get('user-agent')),
      });
    }
  } catch {
    // Always clear cookie even if logging audit fails
  }

  const response = NextResponse.json({ ok: true });
  clearCookieOnResponse(response, ADMIN_COOKIE_NAME, request);
  return response;
}
