// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { POST as activityPost } from '@/app/api/activity/route';
import { GET as adminActivityGet } from '@/app/api/admin/activity/route';
import { POST as loginPost } from '@/app/api/admin/login/route';
import { POST as logoutPost } from '@/app/api/admin/logout/route';
import {
  DELETE as memoryDelete,
  PUT as memoryPut,
} from '@/app/api/admin/memories/[id]/route';
import { PUT as reorderPut } from '@/app/api/admin/memories/reorder/route';
import { GET as memoriesGet, POST as memoriesPost } from '@/app/api/admin/memories/route';
import { GET as settingsGet, PUT as settingsPut } from '@/app/api/admin/settings/route';
import { POST as uploadUrlPost } from '@/app/api/admin/upload-url/route';
import { DELETE as uploadDelete, POST as uploadPost } from '@/app/api/admin/upload/route';
import {
  DELETE as adminUserDelete,
  PATCH as adminUserPatch,
} from '@/app/api/admin/users/[id]/route';
import { GET as adminUsersGet, POST as adminUsersPost } from '@/app/api/admin/users/route';
import { POST as viewerLoginPost } from '@/app/api/viewer/login/route';
import { POST as viewerLogoutPost } from '@/app/api/viewer/logout/route';
import { POST as viewerVerifyOtpPost } from '@/app/api/viewer/verify-otp/route';
import {
  ADMIN_COOKIE_NAME,
  GUEST_COOLDOWN_COOKIE_NAME,
  GUEST_COOLDOWN_TTL_SECONDS,
  type GuestCooldownTokenPayload,
  signSessionPayload,
  VIEWER_STEP1_COOKIE_NAME,
  VIEWER_UNLOCKED_COOKIE_NAME,
} from '@/lib/auth';
import { LocalStorageRepository } from '@/lib/storage/local-repository';

describe('API route handlers', () => {
  let tempRoot: string;
  let origEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    origEnv = { ...process.env };
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ny-api-test-'));
    process.env.LOCAL_DATA_DIR = path.join(tempRoot, 'data');
    process.env.LOCAL_UPLOAD_DIR = path.join(tempRoot, 'uploads');
    process.env.ADMIN_PASSWORD = 'secret-test-password';
    process.env.ADMIN_SESSION_SECRET = 'test-hmac-secret-123456';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = origEnv;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  async function loginAsAdmin(
    username = 'admin',
    password = 'secret-test-password'
  ): Promise<{ cookieHeader: string; user: Record<string, unknown> }> {
    const res = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({ username, password }),
      })
    );
    expect(res.status).toBe(200);
    const cookie = res.cookies.get(ADMIN_COOKIE_NAME);
    expect(cookie?.value).toBeTruthy();
    const payload = (await res.json()) as { ok: boolean; user: Record<string, unknown> };
    return {
      cookieHeader: `${ADMIN_COOKIE_NAME}=${cookie!.value}`,
      user: payload.user,
    };
  }

  test('rejects unauthenticated and stale access to all protected admin routes with 401 and clears stale cookie', async () => {
    const r1 = await settingsGet(new Request('http://localhost/api/admin/settings'));
    expect(r1.status).toBe(401);

    const r2 = await memoriesPost(
      new Request('http://localhost/api/admin/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    expect(r2.status).toBe(401);

    const r3 = await uploadUrlPost(
      new Request('http://localhost/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'image',
          mimeType: 'image/jpeg',
          size: 1024,
          fileName: 'a.jpg',
        }),
      })
    );
    expect(r3.status).toBe(401);

    const r4 = await memoryDelete(
      new Request('http://localhost/api/admin/memories/123', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '123' }) }
    );
    expect(r4.status).toBe(401);

    const r5 = await adminUsersGet(new Request('http://localhost/api/admin/users'));
    expect(r5.status).toBe(401);

    const r6 = await adminUserPatch(
      new Request('http://localhost/api/admin/users/123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: 'Hack' }),
      }),
      { params: Promise.resolve({ id: '123' }) }
    );
    expect(r6.status).toBe(401);

    const r7 = await adminUserDelete(
      new Request('http://localhost/api/admin/users/123', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '123' }) }
    );
    expect(r7.status).toBe(401);

    const r8 = await adminActivityGet(new Request('http://localhost/api/admin/activity'));
    expect(r8.status).toBe(401);

    // Stale/tampered admin cookie is cleared on 401
    const staleRes = await settingsGet(
      new Request('http://localhost/api/admin/settings', {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=tampered.token` },
      })
    );
    expect(staleRes.status).toBe(401);
    expect(staleRes.cookies.get(ADMIN_COOKIE_NAME)?.value).toBe('');
  });

  test('admin login enforces role, password in app_users (not env), and logout records activity', async () => {
    // Missing/short password -> 400
    const invalidRes = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'x' }),
      })
    );
    expect(invalidRes.status).toBe(400);

    // Wrong password -> 401
    const badRes = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'wrong-password' }),
      })
    );
    expect(badRes.status).toBe(401);

    // Viewer account with WRONG password -> 401 (no role enumeration)
    const viewerWrongPw = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nguoithuong', password: 'wrong-password' }),
      })
    );
    expect(viewerWrongPw.status).toBe(401);

    // Viewer account with RIGHT password -> 403
    const viewerRightPw = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nguoithuong', password: 'love2026' }),
      })
    );
    expect(viewerRightPw.status).toBe(403);
    expect(viewerRightPw.cookies.get(ADMIN_COOKIE_NAME)?.value).toBeUndefined();

    // Default username fallback ('admin') works and never returns hashes
    const { cookieHeader, user } = await loginAsAdmin();
    expect(user.username).toBe('admin');
    expect(user.role).toBe('admin');
    expect('passwordHash' in user).toBe(false);
    expect('otpHash' in user).toBe(false);

    // Settings read works & returns currentUser + users without hashes
    const okRes = await settingsGet(
      new Request('http://localhost/api/admin/settings', {
        headers: { cookie: cookieHeader },
      })
    );
    expect(okRes.status).toBe(200);
    const body = await okRes.json();
    expect(body.settings.coupleTitle).toBeTruthy();
    expect(body.currentUser.username).toBe('admin');
    expect('viewerPasscodeHash' in body.settings).toBe(false);

    // Changing env ADMIN_PASSWORD does NOT affect existing app_users login
    process.env.ADMIN_PASSWORD = 'different-env-password';
    const stillWorksRes = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'secret-test-password' }),
      })
    );
    expect(stillWorksRes.status).toBe(200);

    // Logout clears cookie and records logout activity
    const outRes = await logoutPost(
      new Request('http://localhost/api/admin/logout', {
        method: 'POST',
        headers: { cookie: cookieHeader },
      })
    );
    expect(outRes.status).toBe(200);
    expect(outRes.cookies.get(ADMIN_COOKIE_NAME)?.value).toBe('');

    const actRes = await adminActivityGet(
      new Request('http://localhost/api/admin/activity?eventType=logout', {
        headers: { cookie: cookieHeader },
      })
    );
    expect(actRes.status).toBe(200);
    const actData = await actRes.json();
    expect(actData.logs.length).toBeGreaterThanOrEqual(1);
    expect(actData.logs[0].username).toBe('admin');
  });

  test('2-step viewer auth (/api/viewer/login -> /api/viewer/verify-otp -> /api/viewer/logout) works and rejects tampering/wrong OTP', async () => {
    // Missing username -> 400 (no defaultUsername on viewer login)
    const missingUsername = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: 'love2026' }),
      })
    );
    expect(missingUsername.status).toBe(400);

    // Wrong password -> 401 and must NOT reveal otpHint
    const badLogin = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nguoithuong', password: 'wrong' }),
      })
    );
    expect(badLogin.status).toBe(401);
    const badLoginJson = await badLogin.json();
    expect('otpHint' in badLoginJson).toBe(false);

    // Step 1 success for viewer 'nguoithuong'
    const step1Res = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) Version/17.4 Mobile/15E148 Safari/604.1',
        },
        body: JSON.stringify({ username: 'nguoithuong', password: 'love2026' }),
      })
    );
    expect(step1Res.status).toBe(200);
    const step1Json = await step1Res.json();
    expect(step1Json.ok).toBe(true);
    expect(step1Json.step).toBe('otp_required');
    expect(step1Json.otpHint).toContain('12/10/24');
    expect(step1Json.user.username).toBe('nguoithuong');
    expect('passwordHash' in step1Json.user).toBe(false);
    expect('otpHash' in step1Json.user).toBe(false);

    const step1Cookie = step1Res.cookies.get(VIEWER_STEP1_COOKIE_NAME)?.value;
    expect(step1Cookie).toBeTruthy();

    // Verify-otp without cookie -> 401
    const noCookieOtp = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp: '121024' }),
      })
    );
    expect(noCookieOtp.status).toBe(401);

    // Invalid OTP format -> 400
    const invalidFormatOtp = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Cookie}`,
        },
        body: JSON.stringify({ otp: '12ab' }),
      })
    );
    expect(invalidFormatOtp.status).toBe(400);

    // Wrong 6-digit OTP -> 401
    const wrongOtp = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Cookie}`,
        },
        body: JSON.stringify({ otp: '999999' }),
      })
    );
    expect(wrongOtp.status).toBe(401);

    // Correct 6-digit OTP -> 200, sets ny_viewer_unlocked, clears ny_viewer_step1 & ny_guest_cooldown
    const okOtp = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Cookie}; ${GUEST_COOLDOWN_COOKIE_NAME}=some-cooldown`,
        },
        body: JSON.stringify({ otp: '121024' }),
      })
    );
    expect(okOtp.status).toBe(200);
    const okOtpJson = await okOtp.json();
    expect(okOtpJson.ok).toBe(true);
    expect(okOtpJson.user.username).toBe('nguoithuong');
    expect(okOtpJson.user.lastLoginAt).toBeTruthy();
    expect('passwordHash' in okOtpJson.user).toBe(false);
    expect('otpHash' in okOtpJson.user).toBe(false);

    const unlockedCookie = okOtp.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.value;
    expect(unlockedCookie).toBeTruthy();
    expect(okOtp.cookies.get(VIEWER_STEP1_COOKIE_NAME)?.value).toBe('');
    expect(okOtp.cookies.get(GUEST_COOLDOWN_COOKIE_NAME)?.value).toBe('');

    // Token confusion check: passing ny_viewer_unlocked in ny_viewer_step1 must fail
    const confusedRes = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${unlockedCookie}`,
        },
        body: JSON.stringify({ otp: '121024' }),
      })
    );
    expect(confusedRes.status).toBe(401);
    expect(confusedRes.cookies.get(VIEWER_STEP1_COOKIE_NAME)?.value).toBe('');

    // Admin account can also complete 2-step viewer auth for '/'
    const adminViewerStep1 = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: 'secret-test-password' }),
      })
    );
    expect(adminViewerStep1.status).toBe(200);
    const adminStep1Cookie = adminViewerStep1.cookies.get(VIEWER_STEP1_COOKIE_NAME)!.value;
    const adminViewerOtp = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${adminStep1Cookie}`,
        },
        body: JSON.stringify({ otp: '140226' }),
      })
    );
    expect(adminViewerOtp.status).toBe(200);
    expect((await adminViewerOtp.json()).user.role).toBe('admin');

    // Viewer logout clears viewer + cooldown cookies and logs 'logout'
    const viewerOut = await viewerLogoutPost(
      new Request('http://localhost/api/viewer/logout', {
        method: 'POST',
        headers: { cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${unlockedCookie}` },
      })
    );
    expect(viewerOut.status).toBe(200);
    expect(viewerOut.cookies.get(VIEWER_STEP1_COOKIE_NAME)?.value).toBe('');
    expect(viewerOut.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.value).toBe('');
    expect(viewerOut.cookies.get(GUEST_COOLDOWN_COOKIE_NAME)?.value).toBe('');
  });

  test('/api/activity enforces guest cooldown, protects interactive events when locked, rejects forged auth events, and attributes unlocked users', async () => {
    // Malformed raw JSON and array payloads return 400 cleanly on /api/activity & /api/viewer/login
    for (const badBody of ['{invalid', '[]']) {
      const badActivity = await activityPost(
        new Request('http://localhost/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: badBody,
        })
      );
      expect(badActivity.status).toBe(400);

      const badViewerLogin = await viewerLoginPost(
        new Request('http://localhost/api/viewer/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: badBody,
        })
      );
      expect(badViewerLogin.status).toBe(400);
    }

    // Reject forged auth event types
    for (const forged of ['login_step1_ok', 'otp_verified', 'login_failed', 'otp_failed', 'logout']) {
      const forgedRes = await activityPost(
        new Request('http://localhost/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: forged }),
        })
      );
      expect(forgedRes.status).toBe(400);
    }

    // Locked site (viewerPasscodeEnabled = true by default) -> interactive event without unlocked cookie returns 401
    const unauthMemory = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'memory_viewed', detail: 'Xem ảnh' }),
      })
    );
    expect(unauthMemory.status).toBe(401);

    // Step1-only user cannot log interactive events either -> 401
    const step1Res = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'nguoithuong', password: 'love2026' }),
      })
    );
    const step1Cookie = step1Res.cookies.get(VIEWER_STEP1_COOKIE_NAME)!.value;

    const step1OnlyEvent = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Cookie}`,
        },
        body: JSON.stringify({ eventType: 'letter_opened' }),
      })
    );
    expect(step1OnlyEvent.status).toBe(401);
    // Valid ny_viewer_step1 must be preserved when returning 401
    expect(step1OnlyEvent.cookies.get(VIEWER_STEP1_COOKIE_NAME)).toBeUndefined();

    // 401 preserves valid ny_viewer_step1 while clearing stale/invalid ny_viewer_unlocked
    const validStep1PlusStaleUnlocked = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Cookie}; ${VIEWER_UNLOCKED_COOKIE_NAME}=stale.unlocked.token`,
        },
        body: JSON.stringify({ eventType: 'letter_opened' }),
      })
    );
    expect(validStep1PlusStaleUnlocked.status).toBe(401);
    expect(validStep1PlusStaleUnlocked.cookies.get(VIEWER_STEP1_COOKIE_NAME)).toBeUndefined();
    expect(validStep1PlusStaleUnlocked.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.value).toBe('');
    expect(validStep1PlusStaleUnlocked.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.maxAge).toBe(0);

    // Guest page_leave WITHOUT prior page_visit cookie -> deduped (0 leave logs written)
    const earlyLeave = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: JSON.stringify({ eventType: 'page_leave' }),
      })
    );
    expect(earlyLeave.status).toBe(200);
    expect(await earlyLeave.json()).toEqual({ ok: true, deduped: true });

    // Guest page_visit -> logs once and issues ny_guest_cooldown
    const firstVisit = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1',
        },
        body: JSON.stringify({ eventType: 'page_visit' }),
      })
    );
    expect(firstVisit.status).toBe(200);
    expect(await firstVisit.json()).toEqual({ ok: true });
    const cooldown1 = firstVisit.cookies.get(GUEST_COOLDOWN_COOKIE_NAME)?.value;
    expect(cooldown1).toBeTruthy();

    // Second guest page_visit with cooldown cookie -> deduped
    const secondVisit = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${GUEST_COOLDOWN_COOKIE_NAME}=${cooldown1}`,
        },
        body: JSON.stringify({ eventType: 'page_visit' }),
      })
    );
    expect(secondVisit.status).toBe(200);
    expect(await secondVisit.json()).toEqual({ ok: true, deduped: true });

    // First guest page_leave with cooldown cookie (via sendBeacon text/plain) -> logs once & updates cooldown
    const firstLeave = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          cookie: `${GUEST_COOLDOWN_COOKIE_NAME}=${cooldown1}`,
        },
        body: JSON.stringify({ eventType: 'page_leave' }),
      })
    );
    expect(firstLeave.status).toBe(200);
    expect(await firstLeave.json()).toEqual({ ok: true });
    const cooldown2 = firstLeave.cookies.get(GUEST_COOLDOWN_COOKIE_NAME)?.value;
    expect(cooldown2).toBeTruthy();

    // Second guest page_leave -> deduped
    const secondLeave = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=UTF-8',
          cookie: `${GUEST_COOLDOWN_COOKIE_NAME}=${cooldown2}`,
        },
        body: JSON.stringify({ eventType: 'page_leave' }),
      })
    );
    expect(secondLeave.status).toBe(200);
    expect(await secondLeave.json()).toEqual({ ok: true, deduped: true });

    // page_leave preserves remaining maxAge <= GUEST_COOLDOWN_TTL_SECONDS instead of resetting to 600s
    const shortRemainingCooldown = signSessionPayload<GuestCooldownTokenPayload>(
      {
        typ: 'guest_cooldown',
        visitLogged: true,
        leaveLogged: false,
        exp: 0,
      },
      120
    );
    const shortLeave = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${GUEST_COOLDOWN_COOKIE_NAME}=${shortRemainingCooldown}`,
        },
        body: JSON.stringify({ eventType: 'page_leave' }),
      })
    );
    expect(shortLeave.status).toBe(200);
    const shortLeaveCookie = shortLeave.cookies.get(GUEST_COOLDOWN_COOKIE_NAME);
    expect(shortLeaveCookie?.maxAge).toBeGreaterThan(0);
    expect(shortLeaveCookie?.maxAge).toBeLessThanOrEqual(120);
    expect(shortLeaveCookie?.maxAge).toBeLessThan(GUEST_COOLDOWN_TTL_SECONDS);

    // Expired ny_guest_cooldown cookie allows a new page_visit; stale ny_viewer_unlocked on page_visit is cleared
    const expiredCooldown = signSessionPayload<GuestCooldownTokenPayload>(
      {
        typ: 'guest_cooldown',
        visitLogged: true,
        leaveLogged: true,
        exp: 0,
      },
      -10
    );
    const afterExpiryVisit = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${GUEST_COOLDOWN_COOKIE_NAME}=${expiredCooldown}; ${VIEWER_UNLOCKED_COOKIE_NAME}=stale.unlocked.token`,
        },
        body: JSON.stringify({ eventType: 'page_visit' }),
      })
    );
    expect(afterExpiryVisit.status).toBe(200);
    expect(await afterExpiryVisit.json()).toEqual({ ok: true });
    expect(afterExpiryVisit.cookies.get(GUEST_COOLDOWN_COOKIE_NAME)?.value).toBeTruthy();
    expect(afterExpiryVisit.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.value).toBe('');
    expect(afterExpiryVisit.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.maxAge).toBe(0);

    // Complete OTP to get unlocked session and log interactive events attributed to user
    const otpRes = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Cookie}`,
        },
        body: JSON.stringify({ otp: '121024' }),
      })
    );
    const unlockedCookie = otpRes.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)!.value;

    const unlockedMem = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${unlockedCookie}`,
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/128.0.0.0 Safari/537.36',
        },
        body: JSON.stringify({
          eventType: 'memory_viewed',
          detail: 'Xem ảnh: Chiều mưa đầu tiên',
          metadata: { memoryId: '11111111-1111-4111-8111-111111111101' },
        }),
      })
    );
    expect(unlockedMem.status).toBe(200);

    // Check admin activity API sees exact counts, attribution, filters, and trafficSummary
    const { cookieHeader } = await loginAsAdmin();
    const visitLogsRes = await adminActivityGet(
      new Request('http://localhost/api/admin/activity?eventType=page_visit', {
        headers: { cookie: cookieHeader },
      })
    );
    const visitLogsJson = await visitLogsRes.json();
    expect(visitLogsJson.logs).toHaveLength(2);
    expect(visitLogsJson.logs[0].username).toBe('khach');
    expect(visitLogsJson.logs[0].userRole).toBe('guest');

    const leaveLogsRes = await adminActivityGet(
      new Request('http://localhost/api/admin/activity?eventType=page_leave', {
        headers: { cookie: cookieHeader },
      })
    );
    expect((await leaveLogsRes.json()).logs).toHaveLength(2);

    const memLogsRes = await adminActivityGet(
      new Request(
        'http://localhost/api/admin/activity?username=nguoithuong&eventType=memory_viewed&search=Chiều&limit=not-a-number',
        { headers: { cookie: cookieHeader } }
      )
    );
    const memLogsJson = await memLogsRes.json();
    expect(memLogsJson.logs).toHaveLength(1);
    expect(memLogsJson.logs[0].username).toBe('nguoithuong');
    expect(memLogsJson.logs[0].deviceSummary).toBe('Chrome · macOS');
    expect(memLogsJson.trafficSummary).toMatchObject({
      visitsToday: 2,
      otpVerifiedToday: 1,
      activeUsersCount: 2,
    });
  });

  test('/api/admin/users CRUD, self/last-admin guards, and immediate sessionVersion revocation on admin & viewer cookies', async () => {
    const { cookieHeader: admin1Cookie, user: admin1 } = await loginAsAdmin();

    // GET users returns SafeAppUser[] without passwordHash or otpHash
    const listRes = await adminUsersGet(
      new Request('http://localhost/api/admin/users', {
        headers: { cookie: admin1Cookie },
      })
    );
    expect(listRes.status).toBe(200);
    const listJson = await listRes.json();
    expect(listJson.users).toHaveLength(2);
    for (const u of listJson.users) {
      expect('passwordHash' in u).toBe(false);
      expect('otpHash' in u).toBe(false);
      expect(u.hasPassword).toBe(true);
      expect(u.hasOtp).toBe(true);
    }

    // Self-lock, self-demote, and self-delete are blocked with 400
    const selfLockRes = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin1.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: String(admin1.id) }) }
    );
    expect(selfLockRes.status).toBe(400);

    const selfDemoteRes = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin1.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ role: 'viewer' }),
      }),
      { params: Promise.resolve({ id: String(admin1.id) }) }
    );
    expect(selfDemoteRes.status).toBe(400);

    const selfDeleteRes = await adminUserDelete(
      new Request(`http://localhost/api/admin/users/${admin1.id}`, {
        method: 'DELETE',
        headers: { cookie: admin1Cookie },
      }),
      { params: Promise.resolve({ id: String(admin1.id) }) }
    );
    expect(selfDeleteRes.status).toBe(400);

    // Self-revokeSession is blocked with 400
    const selfRevokeRes = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin1.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ revokeSession: true }),
      }),
      { params: Promise.resolve({ id: String(admin1.id) }) }
    );
    expect(selfRevokeRes.status).toBe(400);

    // Duplicate username -> 409
    const dupRes = await adminUsersPost(
      new Request('http://localhost/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({
          username: 'nguoithuong',
          displayName: 'Trùng',
          role: 'viewer',
          password: 'password123',
          otpCode: '111222',
          otpHint: '',
        }),
      })
    );
    expect(dupRes.status).toBe(409);

    // Concurrent createUser race conflict (Error 'đã tồn tại' & Postgres 23505) -> 409
    vi.spyOn(LocalStorageRepository.prototype, 'createUser')
      .mockRejectedValueOnce(new Error('Tên đăng nhập này đã tồn tại.'))
      .mockRejectedValueOnce({ code: '23505', message: 'duplicate key value violates unique constraint' });

    const raceTextConflictRes = await adminUsersPost(
      new Request('http://localhost/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({
          username: 'race.user1',
          displayName: 'Race 1',
          role: 'viewer',
          password: 'password123',
          otpCode: '111222',
          otpHint: '',
        }),
      })
    );
    expect(raceTextConflictRes.status).toBe(409);

    const racePgConflictRes = await adminUsersPost(
      new Request('http://localhost/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({
          username: 'race.user2',
          displayName: 'Race 2',
          role: 'viewer',
          password: 'password123',
          otpCode: '111222',
          otpHint: '',
        }),
      })
    );
    expect(racePgConflictRes.status).toBe(409);

    // Create second admin + test immediate sessionVersion revocation on admin session
    const createAdmin2Res = await adminUsersPost(
      new Request('http://localhost/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({
          username: 'admin2',
          displayName: 'Admin Phụ',
          role: 'admin',
          password: 'admin2-password',
          otpCode: '112233',
          otpHint: 'Gợi ý admin 2',
          isActive: true,
        }),
      })
    );
    expect(createAdmin2Res.status).toBe(201);
    const admin2 = (await createAdmin2Res.json()).user;
    expect('passwordHash' in admin2).toBe(false);
    expect('otpHash' in admin2).toBe(false);

    // Even when a second active admin exists, self-lock & self-delete remain blocked!
    const selfLockWithTwoAdmins = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin1.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: String(admin1.id) }) }
    );
    expect(selfLockWithTwoAdmins.status).toBe(400);

    // Admin 2 logs in -> works
    const { cookieHeader: admin2Cookie } = await loginAsAdmin('admin2', 'admin2-password');
    const admin2SettingsBefore = await settingsGet(
      new Request('http://localhost/api/admin/settings', {
        headers: { cookie: admin2Cookie },
      })
    );
    expect(admin2SettingsBefore.status).toBe(200);

    // Admin 1 revokes Admin 2's session -> Admin 2 immediately gets 401 on /api/admin/settings
    const revokeAdmin2 = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin2.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ revokeSession: true }),
      }),
      { params: Promise.resolve({ id: String(admin2.id) }) }
    );
    expect(revokeAdmin2.status).toBe(200);
    expect((await revokeAdmin2.json()).user.sessionVersion).toBe(2);

    const admin2SettingsAfter = await settingsGet(
      new Request('http://localhost/api/admin/settings', {
        headers: { cookie: admin2Cookie },
      })
    );
    expect(admin2SettingsAfter.status).toBe(401);
    expect(admin2SettingsAfter.cookies.get(ADMIN_COOKIE_NAME)?.value).toBe('');

    // Lock admin2 -> /api/admin/login rejects with 403
    const lockAdmin2 = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin2.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: String(admin2.id) }) }
    );
    expect(lockAdmin2.status).toBe(200);

    const lockedAdmin2Login = await loginPost(
      new Request('http://localhost/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'admin2', password: 'admin2-password' }),
      })
    );
    expect(lockedAdmin2Login.status).toBe(403);

    // Delete admin2 -> 200; deleting or patching again -> 404
    const delAdmin2 = await adminUserDelete(
      new Request(`http://localhost/api/admin/users/${admin2.id}`, {
        method: 'DELETE',
        headers: { cookie: admin1Cookie },
      }),
      { params: Promise.resolve({ id: String(admin2.id) }) }
    );
    expect(delAdmin2.status).toBe(200);

    const patchMissing = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin2.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ displayName: 'Missing' }),
      }),
      { params: Promise.resolve({ id: String(admin2.id) }) }
    );
    expect(patchMissing.status).toBe(404);

    const delMissing = await adminUserDelete(
      new Request(`http://localhost/api/admin/users/${admin2.id}`, {
        method: 'DELETE',
        headers: { cookie: admin1Cookie },
      }),
      { params: Promise.resolve({ id: String(admin2.id) }) }
    );
    expect(delMissing.status).toBe(404);

    // Create viewer, start Step 1, then lock viewer -> /api/viewer/verify-otp fails 401 and login fails 403
    const createViewerRes = await adminUsersPost(
      new Request('http://localhost/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({
          username: 'bannho',
          displayName: 'Bạn nhỏ',
          role: 'viewer',
          password: 'viewer-password',
          otpCode: '654321',
          otpHint: 'Số ngược',
          isActive: true,
        }),
      })
    );
    expect(createViewerRes.status).toBe(201);
    const viewer = (await createViewerRes.json()).user;

    const viewerStep1Res = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bannho', password: 'viewer-password' }),
      })
    );
    expect(viewerStep1Res.status).toBe(200);
    const viewerStep1Cookie = viewerStep1Res.cookies.get(VIEWER_STEP1_COOKIE_NAME)!.value;

    // Lock viewer -> bumps sessionVersion & sets isActive=false
    const lockViewerRes = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${viewer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ isActive: false }),
      }),
      { params: Promise.resolve({ id: String(viewer.id) }) }
    );
    expect(lockViewerRes.status).toBe(200);

    // Existing step1 cookie is immediately rejected on verify-otp
    const lockedVerifyRes = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${viewerStep1Cookie}`,
        },
        body: JSON.stringify({ otp: '654321' }),
      })
    );
    expect(lockedVerifyRes.status).toBe(401);
    expect(lockedVerifyRes.cookies.get(VIEWER_STEP1_COOKIE_NAME)?.value).toBe('');

    // Locked viewer cannot log in at step 1 either -> 403
    const lockedStep1Login = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bannho', password: 'viewer-password' }),
      })
    );
    expect(lockedStep1Login.status).toBe(403);

    // Unlock viewer again, finish OTP, then revokeSession -> /api/activity interactive event immediately fails 401
    await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${viewer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ isActive: true }),
      }),
      { params: Promise.resolve({ id: String(viewer.id) }) }
    );
    const reLoginRes = await viewerLoginPost(
      new Request('http://localhost/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bannho', password: 'viewer-password' }),
      })
    );
    const reOtpRes = await viewerVerifyOtpPost(
      new Request('http://localhost/api/viewer/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_STEP1_COOKIE_NAME}=${reLoginRes.cookies.get(VIEWER_STEP1_COOKIE_NAME)!.value}`,
        },
        body: JSON.stringify({ otp: '654321' }),
      })
    );
    const unlockedViewerCookie = reOtpRes.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)!.value;

    await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${viewer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ revokeSession: true }),
      }),
      { params: Promise.resolve({ id: String(viewer.id) }) }
    );

    const revokedActivityRes = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${unlockedViewerCookie}`,
        },
        body: JSON.stringify({ eventType: 'letter_opened' }),
      })
    );
    expect(revokedActivityRes.status).toBe(401);
    expect(revokedActivityRes.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.value).toBe('');
    expect(revokedActivityRes.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.maxAge).toBe(0);
    expect(revokedActivityRes.cookies.get(VIEWER_STEP1_COOKIE_NAME)).toBeUndefined();
    expect(revokedActivityRes.headers.getSetCookie().join(';')).toContain('Max-Age=0');

    // Admin updating own password refreshes ny_admin_session so active admin isn't locked out
    const selfPasswordUpdateRes = await adminUserPatch(
      new Request(`http://localhost/api/admin/users/${admin1.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: admin1Cookie },
        body: JSON.stringify({ password: 'new-admin-secret-password' }),
      }),
      { params: Promise.resolve({ id: String(admin1.id) }) }
    );
    expect(selfPasswordUpdateRes.status).toBe(200);
    const updatedAdmin1 = (await selfPasswordUpdateRes.json()).user;
    expect(updatedAdmin1.sessionVersion).toBe(2);
    const refreshedAdminCookie = selfPasswordUpdateRes.cookies.get(ADMIN_COOKIE_NAME)?.value;
    expect(refreshedAdminCookie).toBeTruthy();

    // Old admin cookie is now stale (401); refreshed cookie continues working (200)
    const oldCookieRes = await settingsGet(
      new Request('http://localhost/api/admin/settings', {
        headers: { cookie: admin1Cookie },
      })
    );
    expect(oldCookieRes.status).toBe(401);

    const refreshedCookieRes = await settingsGet(
      new Request('http://localhost/api/admin/settings', {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${refreshedAdminCookie}` },
      })
    );
    expect(refreshedCookieRes.status).toBe(200);
  });

  test('authenticated upload, CRUD, reorder, settings update, and orphan cleanup work end-to-end', async () => {
    const { cookieHeader } = await loginAsAdmin();

    // Update settings (e.g. toggling viewerPasscodeEnabled false -> unauth interactive events work as guest)
    const saveSettingsRes = await settingsPut(
      new Request('http://localhost/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          coupleTitle: 'Minh & Lan',
          heroSubtitle: 'Câu chuyện của hai đứa',
          loveStartDate: '2024-10-12',
          musicUrl: '/samples/gentle-memories.wav',
          musicEnabled: true,
          letterTitle: 'Gửi Lan',
          letterBody: 'Cảm ơn em đã đến.',
          letterSignature: 'Minh',
          viewerPasscodeEnabled: false,
        }),
      })
    );
    expect(saveSettingsRes.status).toBe(200);

    // When public mode is enabled, unauthenticated guest can log memory_viewed
    const publicEventRes = await activityPost(
      new Request('http://localhost/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventType: 'memory_viewed', detail: 'Xem công khai' }),
      })
    );
    expect(publicEventRes.status).toBe(200);

    // Ask upload-url in local mode
    const urlRes = await uploadUrlPost(
      new Request('http://localhost/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          kind: 'image',
          mimeType: 'image/jpeg',
          size: 2048,
          fileName: 'trip.jpg',
        }),
      })
    );
    expect(urlRes.status).toBe(200);
    const urlPayload = await urlRes.json();
    expect(urlPayload.mode).toBe('local');
    expect(urlPayload.uploadEndpoint).toBe('/api/admin/upload');

    // Reject SVG in upload-url
    const badMimeRes = await uploadUrlPost(
      new Request('http://localhost/api/admin/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          kind: 'image',
          mimeType: 'image/svg+xml',
          size: 512,
          fileName: 'evil.svg',
        }),
      })
    );
    expect(badMimeRes.status).toBe(400);

    // Upload real bytes via FormData
    const form = new FormData();
    form.append('kind', 'image');
    form.append('file', new File([new Uint8Array([1, 2, 3, 4])], 'trip.jpg', { type: 'image/jpeg' }));

    const upRes = await uploadPost(
      new Request('http://localhost/api/admin/upload', {
        method: 'POST',
        headers: { cookie: cookieHeader },
        body: form,
      })
    );
    expect(upRes.status).toBe(200);
    const { publicUrl } = await upRes.json();
    expect(publicUrl).toMatch(/^\/uploads\/.+\.jpg$/);

    // Create memory
    const createRes = await memoriesPost(
      new Request('http://localhost/api/admin/memories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          memoryDate: '2025-08-20',
          title: 'Biển chiều',
          story: 'Sóng nhẹ và nắng ấm.',
          imageUrl: publicUrl,
          imageAlt: 'Biển chiều',
        }),
      })
    );
    expect(createRes.status).toBe(201);
    const createdMemory = (await createRes.json()).memory;

    // Update memory
    const updateRes = await memoryPut(
      new Request(`http://localhost/api/admin/memories/${createdMemory.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({
          memoryDate: '2025-08-21',
          title: 'Biển chiều cập nhật',
          story: 'Sóng nhẹ và gió mát.',
          imageUrl: publicUrl,
          imageAlt: 'Biển chiều',
        }),
      }),
      { params: Promise.resolve({ id: createdMemory.id }) }
    );
    expect(updateRes.status).toBe(200);

    // List & Reorder
    const listRes = await memoriesGet(
      new Request('http://localhost/api/admin/memories', {
        headers: { cookie: cookieHeader },
      })
    );
    const { memories } = await listRes.json();
    const reversedIds = [...memories].reverse().map((m: { id: string }) => m.id);

    const reorderRes = await reorderPut(
      new Request('http://localhost/api/admin/memories/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ ids: reversedIds }),
      })
    );
    expect(reorderRes.status).toBe(200);
    const reorderedData = await reorderRes.json();
    expect(reorderedData.memories[0].id).toBe(reversedIds[0]);

    // Delete memory -> removes uploaded file
    const delRes = await memoryDelete(
      new Request(`http://localhost/api/admin/memories/${createdMemory.id}`, {
        method: 'DELETE',
        headers: { cookie: cookieHeader },
      }),
      { params: Promise.resolve({ id: createdMemory.id }) }
    );
    expect(delRes.status).toBe(200);

    // Orphan upload + DELETE cleanup
    const orphanForm = new FormData();
    orphanForm.append('kind', 'image');
    orphanForm.append(
      'file',
      new File([new Uint8Array([9, 8, 7])], 'orphan.jpg', { type: 'image/jpeg' })
    );
    const orphanRes = await uploadPost(
      new Request('http://localhost/api/admin/upload', {
        method: 'POST',
        headers: { cookie: cookieHeader },
        body: orphanForm,
      })
    );
    const { publicUrl: orphanUrl } = await orphanRes.json();
    const orphanFile = path.join(process.env.LOCAL_UPLOAD_DIR!, path.basename(orphanUrl));
    expect(fs.existsSync(orphanFile)).toBe(true);

    const cleanupRes = await uploadDelete(
      new Request('http://localhost/api/admin/upload', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', cookie: cookieHeader },
        body: JSON.stringify({ url: orphanUrl }),
      })
    );
    expect(cleanupRes.status).toBe(200);
    expect(fs.existsSync(orphanFile)).toBe(false);
  });
});
