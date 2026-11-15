import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import type { NextResponse } from 'next/server';
import type { StorageRepository } from '@/lib/storage/types';
import type { AppUser, SafeAppUser, UserRole, ViewerSessionState } from '@/types/memories';

export const ADMIN_COOKIE_NAME = 'ny_admin_session';
export const VIEWER_STEP1_COOKIE_NAME = 'ny_viewer_step1';
export const VIEWER_UNLOCKED_COOKIE_NAME = 'ny_viewer_unlocked';
export const GUEST_COOLDOWN_COOKIE_NAME = 'ny_guest_cooldown';

export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
export const ADMIN_SESSION_TTL_SECONDS = 24 * 60 * 60;
export const VIEWER_STEP1_TTL_SECONDS = 10 * 60;
export const GUEST_COOLDOWN_TTL_SECONDS = 10 * 60;

const DEV_DEFAULT_ADMIN_PASSWORD = 'love2026';
const DEV_FALLBACK_SECRET = 'ny-local-dev-session-secret-do-not-use-in-prod';

export type SessionTokenType = 'admin' | 'viewer_step1' | 'viewer_unlocked' | 'guest_cooldown';

export interface UserSessionTokenPayload {
  typ: 'admin' | 'viewer_step1' | 'viewer_unlocked';
  sub: string;
  usr: string;
  ver: number;
  role: UserRole;
  exp: number;
  hint?: string;
}

export interface GuestCooldownTokenPayload {
  typ: 'guest_cooldown';
  visitLogged: boolean;
  leaveLogged: boolean;
  exp: number;
}

export function isUsingDefaultAdminPassword(): boolean {
  return !process.env.ADMIN_PASSWORD?.trim();
}

export function isSessionSecretConfigured(): boolean {
  return Boolean(process.env.ADMIN_SESSION_SECRET?.trim());
}

export function shouldUseSecureCookie(request?: Request): boolean {
  if (request) {
    const forwardedProto = request.headers.get('x-forwarded-proto');
    if (forwardedProto) {
      const firstProto = forwardedProto.split(',')[0]?.trim().toLowerCase();
      if (firstProto) {
        return firstProto === 'https';
      }
    }
    try {
      return new URL(request.url).protocol === 'https:';
    } catch {
      // fall through to environment check
    }
  }
  return process.env.NODE_ENV === 'production';
}

export function getConfiguredAdminPassword(): string {
  const configured = process.env.ADMIN_PASSWORD?.trim();
  if (configured) return configured;
  if (process.env.NODE_ENV !== 'production') {
    return DEV_DEFAULT_ADMIN_PASSWORD;
  }
  return '';
}

function getSessionSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ADMIN_SESSION_SECRET must be configured in production.');
  }
  return `${DEV_FALLBACK_SECRET}:${getConfiguredAdminPassword() || 'unconfigured'}`;
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Strip sensitive password and OTP hashes before returning user objects to client/SSR props.
 */
export function sanitizeUserForClient(user: AppUser): SafeAppUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    otpHint: user.otpHint,
    isActive: user.isActive,
    sessionVersion: user.sessionVersion,
    hasPassword: Boolean(user.passwordHash),
    hasOtp: Boolean(user.otpHash),
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function signSessionPayload<T extends { typ: string; exp: number }>(
  payload: T,
  ttlSeconds?: number
): string {
  const exp =
    ttlSeconds !== undefined
      ? Math.floor(Date.now() / 1000) + ttlSeconds
      : Number.isInteger(payload.exp) && payload.exp !== 0
        ? payload.exp
        : Math.floor(Date.now() / 1000) + DEFAULT_SESSION_TTL_SECONDS;

  const finalPayload = { ...payload, exp };
  const encodedPayload = Buffer.from(JSON.stringify(finalPayload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(encodedPayload)
    .digest('base64url');
  return `${encodedPayload}.${signature}`;
}

export function verifySessionPayload<T extends { typ: string; exp: number }>(
  token: string | undefined | null,
  expectedTyp: T['typ']
): T | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encodedPayload, providedSig] = parts;
  if (!encodedPayload || !providedSig) return null;

  let secret: string;
  try {
    secret = getSessionSecret();
  } catch {
    return null;
  }

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(encodedPayload)
    .digest('base64url');

  if (!safeEqualStrings(providedSig, expectedSig)) {
    return null;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) return null;
  const record = decoded as Record<string, unknown>;

  // Strictly enforce token stage type to prevent cross-stage token confusion.
  if (record.typ !== expectedTyp) return null;
  if (typeof record.exp !== 'number' || !Number.isInteger(record.exp)) return null;
  if (record.exp <= Math.floor(Date.now() / 1000)) return null;

  if (expectedTyp === 'guest_cooldown') {
    if (typeof record.visitLogged !== 'boolean' || typeof record.leaveLogged !== 'boolean') {
      return null;
    }
    return record as unknown as T;
  }

  if (
    typeof record.sub !== 'string' ||
    !record.sub ||
    typeof record.usr !== 'string' ||
    !record.usr ||
    typeof record.ver !== 'number' ||
    !Number.isInteger(record.ver) ||
    record.ver < 1 ||
    (record.role !== 'admin' && record.role !== 'viewer')
  ) {
    return null;
  }

  if (expectedTyp === 'admin' && record.role !== 'admin') {
    return null;
  }

  return record as unknown as T;
}

export function hashPasscode(pin: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(pin, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasscode(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, expectedHex] = parts;
  if (!salt || !expectedHex || !/^[0-9a-f]{64}$/i.test(expectedHex)) return false;

  try {
    const derived = crypto.scryptSync(pin, salt, 32);
    const expectedBuf = Buffer.from(expectedHex, 'hex');
    if (derived.length !== expectedBuf.length) return false;
    return crypto.timingSafeEqual(derived, expectedBuf);
  } catch {
    return false;
  }
}

export function parseCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key === name) {
      try {
        return decodeURIComponent(pair.slice(eqIndex + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

async function readCookieValue(name: string, request?: Request): Promise<string | undefined> {
  if (request) {
    return parseCookieFromHeader(request.headers.get('cookie'), name) ?? undefined;
  }
  const cookieStore = await cookies();
  return cookieStore.get(name)?.value;
}

export async function verifyAdminTokenWithRepo(
  token: string | undefined | null,
  repository: StorageRepository
): Promise<AppUser | null> {
  const payload = verifySessionPayload<UserSessionTokenPayload>(token, 'admin');
  if (!payload || payload.role !== 'admin') return null;

  const user = await repository.getUserById(payload.sub);
  if (!user || !user.isActive || user.role !== 'admin' || user.sessionVersion !== payload.ver) {
    return null;
  }
  return user;
}

export async function verifyViewerTokenWithRepo(
  token: string | undefined | null,
  stage: 'viewer_step1' | 'viewer_unlocked',
  repository: StorageRepository
): Promise<AppUser | null> {
  const payload = verifySessionPayload<UserSessionTokenPayload>(token, stage);
  if (!payload) return null;

  const user = await repository.getUserById(payload.sub);
  if (!user || !user.isActive || user.sessionVersion !== payload.ver) {
    return null;
  }
  return user;
}

export async function resolveAdminSession(
  repository: StorageRepository,
  request?: Request
): Promise<SafeAppUser | null> {
  const token = await readCookieValue(ADMIN_COOKIE_NAME, request);
  const user = await verifyAdminTokenWithRepo(token, repository);
  return user ? sanitizeUserForClient(user) : null;
}

export async function resolveViewerSession(
  repository: StorageRepository,
  request?: Request
): Promise<ViewerSessionState> {
  const unlockedToken = await readCookieValue(VIEWER_UNLOCKED_COOKIE_NAME, request);
  const unlockedUser = await verifyViewerTokenWithRepo(
    unlockedToken,
    'viewer_unlocked',
    repository
  );
  if (unlockedUser) {
    return {
      stage: 'unlocked',
      user: sanitizeUserForClient(unlockedUser),
    };
  }

  const step1Token = await readCookieValue(VIEWER_STEP1_COOKIE_NAME, request);
  const step1User = await verifyViewerTokenWithRepo(step1Token, 'viewer_step1', repository);
  if (step1User) {
    return {
      stage: 'otp_pending',
      user: sanitizeUserForClient(step1User),
      otpHint: step1User.otpHint,
    };
  }

  return {
    stage: 'login_required',
    user: null,
  };
}

export function summarizeUserAgent(ua: string | null | undefined): string {
  const raw = ua?.trim() || '';
  if (!raw) return 'Không rõ thiết bị';

  let browser = 'Trình duyệt';
  if (/Edg(?:A|iOS)?\//i.test(raw)) {
    browser = 'Edge';
  } else if (/OPR\/|Opera/i.test(raw)) {
    browser = 'Opera';
  } else if (/SamsungBrowser\//i.test(raw)) {
    browser = 'Samsung Internet';
  } else if (/Firefox\/|FxiOS\//i.test(raw)) {
    browser = 'Firefox';
  } else if (/Chrome\/|CriOS\//i.test(raw)) {
    browser = 'Chrome';
  } else if (/Safari\//i.test(raw) && !/Android/i.test(raw)) {
    browser = 'Safari';
  } else if (/curl\//i.test(raw)) {
    browser = 'curl';
  }

  let os = 'Thiết bị khác';
  if (/iPhone/i.test(raw)) {
    os = 'iPhone';
  } else if (/iPad/i.test(raw)) {
    os = 'iPad';
  } else if (/Android/i.test(raw)) {
    os = 'Android';
  } else if (/Windows/i.test(raw)) {
    os = 'Windows';
  } else if (/Macintosh|Mac OS X/i.test(raw)) {
    os = 'macOS';
  } else if (/Linux/i.test(raw)) {
    os = 'Linux';
  }

  return `${browser} · ${os}`.slice(0, 48);
}

export function setCookieOnResponse(
  response: NextResponse,
  name: string,
  value: string,
  maxAge: number,
  request?: Request
): void {
  response.cookies.set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: shouldUseSecureCookie(request),
    maxAge,
  });
}

export function clearCookieOnResponse(
  response: NextResponse,
  name: string,
  request?: Request
): void {
  response.cookies.set(name, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: shouldUseSecureCookie(request),
    maxAge: 0,
  });
}

export function clearViewerCookiesOnResponse(response: NextResponse, request?: Request): void {
  clearCookieOnResponse(response, VIEWER_STEP1_COOKIE_NAME, request);
  clearCookieOnResponse(response, VIEWER_UNLOCKED_COOKIE_NAME, request);
}

let cachedDummyHash: string | null = null;

function getDummyScryptHash(): string {
  if (!cachedDummyHash) {
    cachedDummyHash = hashPasscode('ny-dummy-constant-time-secret');
  }
  return cachedDummyHash;
}

/**
 * Always execute scrypt verification even when the username does not exist
 * so response timing does not leak username existence.
 */
export function verifyUserPasswordConstantTime(user: AppUser | null, password: string): boolean {
  const hashToCheck = user?.passwordHash || getDummyScryptHash();
  const matched = verifyPasscode(password, hashToCheck);
  return Boolean(user) && matched;
}
