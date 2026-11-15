import { NextResponse } from 'next/server';
import { ADMIN_COOKIE_NAME, shouldUseSecureCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: shouldUseSecureCookie(request),
    maxAge: 0,
  });
  return response;
}
