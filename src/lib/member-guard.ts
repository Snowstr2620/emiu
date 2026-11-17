import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  clearCookieOnResponse,
  parseCookieFromHeader,
  resolveAdminSession,
  resolveViewerSession,
  VIEWER_UNLOCKED_COOKIE_NAME,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import type { StorageRepository } from '@/lib/storage/types';
import type { SafeAppUser } from '@/types/memories';

export type MemberGuardResult =
  | { ok: true; user: SafeAppUser }
  | { ok: false; response: NextResponse };

/**
 * Resolve an active authenticated member session (`admin` or `viewer`):
 * 1. Checks unlocked viewer cookie (`ny_viewer_unlocked`), used on `/`.
 * 2. Falls back to active admin cookie (`ny_admin_session`), used on `/admin`.
 * Never accepts half-authenticated `ny_viewer_step1` tokens.
 */
export async function resolveMemberSession(
  request?: Request | null,
  repository?: StorageRepository
): Promise<SafeAppUser | null> {
  const repo = repository ?? getStorageRepository();
  const viewerSession = await resolveViewerSession(repo, request ?? undefined);
  if (viewerSession.stage === 'unlocked' && viewerSession.user) {
    return viewerSession.user;
  }

  return resolveAdminSession(repo, request ?? undefined);
}

export async function requireMemberApiSession(
  request: Request,
  repository?: StorageRepository
): Promise<MemberGuardResult> {
  const repo = repository ?? getStorageRepository();
  const user = await resolveMemberSession(request, repo);

  if (!user) {
    const response = NextResponse.json(
      { error: 'Vui lòng đăng nhập tài khoản để thực hiện thao tác này.' },
      { status: 401 }
    );
    const cookieHeader = request.headers.get('cookie');
    if (parseCookieFromHeader(cookieHeader, VIEWER_UNLOCKED_COOKIE_NAME)) {
      clearCookieOnResponse(response, VIEWER_UNLOCKED_COOKIE_NAME, request);
    }
    if (parseCookieFromHeader(cookieHeader, ADMIN_COOKIE_NAME)) {
      clearCookieOnResponse(response, ADMIN_COOKIE_NAME, request);
    }
    return { ok: false, response };
  }

  return { ok: true, user };
}
