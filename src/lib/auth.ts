import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const ADMIN_COOKIE_NAME = 'ny_admin_session';
export const VIEWER_COOKIE_NAME = 'ny_viewer_unlocked';
export const DEFAULT_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEV_DEFAULT_ADMIN_PASSWORD = 'love2026';
const DEV_FALLBACK_SECRET = 'ny-local-dev-session-secret-do-not-use-in-prod';

export function isUsingDefaultAdminPassword(): boolean {
  return !process.env.ADMIN_PASSWORD?.trim();
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
  return `${DEV_FALLBACK_SECRET}:${getConfiguredAdminPassword() || 'unconfigured'}`;
}

function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function verifyAdminPassword(input: string): boolean {
  const expected = getConfiguredAdminPassword();
  if (!expected || !input) return false;
  return safeEqualStrings(input, expected);
}

function signToken(prefix: 'admin' | 'viewer', ttlSeconds = DEFAULT_SESSION_TTL_SECONDS): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${prefix}.${exp}`;
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${signature}`;
}

function verifyToken(token: string | null | undefined, expectedPrefix: 'admin' | 'viewer'): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  const [prefix, expStr, providedSig] = parts;
  if (prefix !== expectedPrefix) return false;

  const exp = Number(expStr);
  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const payload = `${prefix}.${expStr}`;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  return safeEqualStrings(providedSig, expectedSig);
}

export function createAdminSessionToken(ttlSeconds = DEFAULT_SESSION_TTL_SECONDS): string {
  return signToken('admin', ttlSeconds);
}

export function verifyAdminSessionToken(token?: string | null): boolean {
  return verifyToken(token, 'admin');
}

export function createViewerSessionToken(ttlSeconds = DEFAULT_SESSION_TTL_SECONDS): string {
  return signToken('viewer', ttlSeconds);
}

export function verifyViewerSessionToken(token?: string | null): boolean {
  return verifyToken(token, 'viewer');
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
  if (!salt || !expectedHex) return false;

  const derived = crypto.scryptSync(pin, salt, 32);
  const expectedBuf = Buffer.from(expectedHex, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

function parseCookieFromHeader(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const eqIndex = pair.indexOf('=');
    if (eqIndex === -1) continue;
    const key = pair.slice(0, eqIndex).trim();
    if (key === name) {
      return decodeURIComponent(pair.slice(eqIndex + 1).trim());
    }
  }
  return null;
}

export async function isAdminRequestAuthenticated(request?: Request): Promise<boolean> {
  if (request) {
    const token = parseCookieFromHeader(request.headers.get('cookie'), ADMIN_COOKIE_NAME);
    return verifyAdminSessionToken(token);
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  return verifyAdminSessionToken(token);
}

export async function isViewerRequestUnlocked(request?: Request): Promise<boolean> {
  if (request) {
    const token = parseCookieFromHeader(request.headers.get('cookie'), VIEWER_COOKIE_NAME);
    return verifyViewerSessionToken(token);
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(VIEWER_COOKIE_NAME)?.value;
  return verifyViewerSessionToken(token);
}
