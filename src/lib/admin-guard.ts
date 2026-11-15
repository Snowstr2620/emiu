import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE_NAME,
  clearCookieOnResponse,
  parseCookieFromHeader,
  resolveAdminSession,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import type { StorageRepository } from '@/lib/storage/types';
import type { SafeAppUser } from '@/types/memories';

export type AdminGuardResult =
  | { ok: true; user: SafeAppUser }
  | { ok: false; response: NextResponse };

/**
 * Verify the active admin HMAC session cookie against the repository user record
 * (checking active status, admin role, and sessionVersion). Clears stale cookies on 401.
 */
export async function requireAdminApiSession(
  request: Request,
  repository?: StorageRepository
): Promise<AdminGuardResult> {
  const repo = repository ?? getStorageRepository();
  const user = await resolveAdminSession(repo, request);

  if (!user) {
    const response = NextResponse.json(
      { error: 'Chưa xác thực hoặc phiên quản trị đã hết hạn.' },
      { status: 401 }
    );
    if (parseCookieFromHeader(request.headers.get('cookie'), ADMIN_COOKIE_NAME)) {
      clearCookieOnResponse(response, ADMIN_COOKIE_NAME, request);
    }
    return { ok: false, response };
  }

  return { ok: true, user };
}
