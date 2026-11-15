import { describe, expect, test } from 'vitest';
import {
  ADMIN_COOKIE_NAME,
  createAdminSessionToken,
  createViewerSessionToken,
  GUEST_COOLDOWN_COOKIE_NAME,
  hashPasscode,
  signSessionPayload,
  summarizeUserAgent,
  verifyAdminSessionToken,
  verifyAdminTokenWithRepo,
  verifyPasscode,
  verifySessionPayload,
  verifyViewerSessionToken,
  verifyViewerTokenWithRepo,
  VIEWER_STEP1_COOKIE_NAME,
  VIEWER_UNLOCKED_COOKIE_NAME,
  type GuestCooldownTokenPayload,
  type UserSessionTokenPayload,
} from '@/lib/auth';
import { StorageRepository } from '@/lib/storage/types';
import { AppUser } from '@/types/memories';
import {
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  sanitizeStorageFileName,
  validateClientActivityPayload,
  validateCreateUserPayload,
  validateOtpVerifyPayload,
  validateSettingsPayload,
  validateUpdateUserPayload,
  validateUploadRequest,
  validateUserLoginPayload,
} from '@/lib/validation';

describe('auth & session tokens', () => {
  test('creates and verifies valid admin session token, rejecting tampered or expired tokens', () => {
    const token = createAdminSessionToken(3600);
    expect(verifyAdminSessionToken(token)).toBe(true);
    expect(verifyAdminSessionToken(`${token}tampered`)).toBe(false);
    expect(verifyAdminSessionToken('')).toBe(false);
    expect(verifyAdminSessionToken(null)).toBe(false);

    const expired = createAdminSessionToken(-10);
    expect(verifyAdminSessionToken(expired)).toBe(false);
  });

  test('viewer session tokens are scoped separately from admin session tokens', () => {
    const adminToken = createAdminSessionToken(3600);
    const viewerToken = createViewerSessionToken(3600);

    expect(verifyViewerSessionToken(viewerToken)).toBe(true);
    expect(verifyViewerSessionToken(adminToken)).toBe(false);
    expect(verifyAdminSessionToken(viewerToken)).toBe(false);
  });

  test('hashes and verifies viewer passcodes securely', () => {
    const hash = hashPasscode('1210');
    expect(hash).not.toContain('1210');
    expect(verifyPasscode('1210', hash)).toBe(true);
    expect(verifyPasscode('0000', hash)).toBe(false);
    expect(verifyPasscode('', hash)).toBe(false);
  });

  test('fails closed in production when ADMIN_SESSION_SECRET is missing', () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origSecret = process.env.ADMIN_SESSION_SECRET;
    try {
      // Mint token using dev fallback first
      (process.env as Record<string, string | undefined>).NODE_ENV = 'development';
      delete process.env.ADMIN_SESSION_SECRET;
      const devToken = createAdminSessionToken(3600);
      expect(verifyAdminSessionToken(devToken)).toBe(true);

      // In production without ADMIN_SESSION_SECRET, signing must throw and verification must reject dev tokens
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      expect(() => createAdminSessionToken(3600)).toThrow(/ADMIN_SESSION_SECRET/);
      expect(verifyAdminSessionToken(devToken)).toBe(false);

      // With ADMIN_SESSION_SECRET set in production, signing and verifying succeed
      process.env.ADMIN_SESSION_SECRET = 'prod-strong-random-secret-key-32-chars';
      const prodToken = createAdminSessionToken(3600);
      expect(verifyAdminSessionToken(prodToken)).toBe(true);
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
      if (origSecret === undefined) {
        delete process.env.ADMIN_SESSION_SECRET;
      } else {
        process.env.ADMIN_SESSION_SECRET = origSecret;
      }
    }
  });
});

describe('upload validation & sanitization', () => {
  test('accepts allowed image and audio MIME types within size limits', () => {
    expect(
      validateUploadRequest({
        kind: 'image',
        mimeType: 'image/jpeg',
        size: 4 * 1024 * 1024,
        fileName: 'photo.jpg',
      })
    ).toEqual({ valid: true });

    expect(
      validateUploadRequest({
        kind: 'image',
        mimeType: 'image/gif',
        size: 9 * 1024 * 1024,
        fileName: 'funny.gif',
      })
    ).toEqual({ valid: true });

    expect(
      validateUploadRequest({
        kind: 'audio',
        mimeType: 'audio/mpeg',
        size: 12 * 1024 * 1024,
        fileName: 'song.mp3',
      })
    ).toEqual({ valid: true });
  });

  test('rejects dangerous MIME types like SVG/HTML and oversized files', () => {
    const svgRes = validateUploadRequest({
      kind: 'image',
      mimeType: 'image/svg+xml',
      size: 2048,
      fileName: 'xss.svg',
    });
    expect(svgRes.valid).toBe(false);

    const htmlRes = validateUploadRequest({
      kind: 'image',
      mimeType: 'text/html',
      size: 1024,
      fileName: 'bad.html',
    });
    expect(htmlRes.valid).toBe(false);

    const bigImgRes = validateUploadRequest({
      kind: 'image',
      mimeType: 'image/png',
      size: MAX_IMAGE_BYTES + 1,
      fileName: 'huge.png',
    });
    expect(bigImgRes.valid).toBe(false);

    const bigAudioRes = validateUploadRequest({
      kind: 'audio',
      mimeType: 'audio/wav',
      size: MAX_AUDIO_BYTES + 1,
      fileName: 'huge.wav',
    });
    expect(bigAudioRes.valid).toBe(false);

    const emptyRes = validateUploadRequest({
      kind: 'image',
      mimeType: 'image/jpeg',
      size: 0,
      fileName: 'empty.jpg',
    });
    expect(emptyRes.valid).toBe(false);

    // Extension allowlist blocks spoofed XHTML/XML/SVGZ/extensionless files even with allowed MIME
    for (const badName of ['payload.xhtml', 'bad.xml', 'pic.svgz', 'shell.phtml', 'noext']) {
      const spoofed = validateUploadRequest({
        kind: 'image',
        mimeType: 'image/jpeg',
        size: 1024,
        fileName: badName,
      });
      expect(spoofed.valid).toBe(false);
    }

    expect(
      validateUploadRequest({
        kind: 'audio',
        mimeType: 'audio/m4a',
        size: 2048,
        fileName: 'voice.m4a',
      })
    ).toEqual({ valid: true });
  });

  test('sanitizes filenames against path traversal and unsafe characters', () => {
    const safe = sanitizeStorageFileName('../../etc/Kỷ niệm đẹp (1).JPG');
    expect(safe).not.toContain('..');
    expect(safe).not.toContain('/');
    expect(safe).toMatch(/\.jpg$/);
  });
});

describe('multi-account session payloads, repo verification & UA summary', () => {
  const activeAdmin: AppUser = {
    id: 'user-admin-1',
    username: 'admin',
    displayName: 'Anh chủ trang',
    role: 'admin',
    passwordHash: 'salt:hash',
    otpHash: 'salt:otp',
    otpHint: '14/02',
    isActive: true,
    sessionVersion: 2,
    lastLoginAt: null,
    createdAt: '2026-11-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
  };

  const activeViewer: AppUser = {
    ...activeAdmin,
    id: 'user-viewer-1',
    username: 'nguoithuong',
    displayName: 'Em bé thương yêu',
    role: 'viewer',
    sessionVersion: 3,
  };

  function makeMockRepo(users: AppUser[]): StorageRepository {
    return {
      getUserById: async (id: string) => users.find((u) => u.id === id) ?? null,
    } as unknown as StorageRepository;
  }

  test('exports expected cookie names and isolates session payload stages against token confusion', () => {
    expect(ADMIN_COOKIE_NAME).toBe('ny_admin_session');
    expect(VIEWER_STEP1_COOKIE_NAME).toBe('ny_viewer_step1');
    expect(VIEWER_UNLOCKED_COOKIE_NAME).toBe('ny_viewer_unlocked');
    expect(GUEST_COOLDOWN_COOKIE_NAME).toBe('ny_guest_cooldown');

    const step1Token = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_step1',
        sub: activeViewer.id,
        usr: activeViewer.username,
        ver: activeViewer.sessionVersion,
        role: 'viewer',
        hint: activeViewer.otpHint,
        exp: 0,
      },
      600
    );

    const unlockedToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: activeViewer.id,
        usr: activeViewer.username,
        ver: activeViewer.sessionVersion,
        role: 'viewer',
        exp: 0,
      },
      3600
    );

    const adminToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: activeAdmin.id,
        usr: activeAdmin.username,
        ver: activeAdmin.sessionVersion,
        role: 'admin',
        exp: 0,
      },
      3600
    );

    const cooldownToken = signSessionPayload<GuestCooldownTokenPayload>(
      {
        typ: 'guest_cooldown',
        visitLogged: true,
        leaveLogged: false,
        exp: 0,
      },
      600
    );

    expect(verifySessionPayload<UserSessionTokenPayload>(step1Token, 'viewer_step1')?.sub).toBe(
      activeViewer.id
    );
    expect(verifySessionPayload<UserSessionTokenPayload>(step1Token, 'viewer_unlocked')).toBeNull();
    expect(verifySessionPayload<UserSessionTokenPayload>(step1Token, 'admin')).toBeNull();

    expect(
      verifySessionPayload<UserSessionTokenPayload>(unlockedToken, 'viewer_unlocked')?.sub
    ).toBe(activeViewer.id);
    expect(verifySessionPayload<UserSessionTokenPayload>(unlockedToken, 'viewer_step1')).toBeNull();
    expect(verifySessionPayload<UserSessionTokenPayload>(unlockedToken, 'admin')).toBeNull();

    expect(verifySessionPayload<UserSessionTokenPayload>(adminToken, 'admin')?.sub).toBe(
      activeAdmin.id
    );
    expect(verifySessionPayload<UserSessionTokenPayload>(adminToken, 'viewer_unlocked')).toBeNull();

    expect(
      verifySessionPayload<GuestCooldownTokenPayload>(cooldownToken, 'guest_cooldown')
    ).toMatchObject({ typ: 'guest_cooldown', visitLogged: true, leaveLogged: false });

    const expired = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: activeViewer.id,
        usr: activeViewer.username,
        ver: activeViewer.sessionVersion,
        role: 'viewer',
        exp: 0,
      },
      -10
    );
    expect(verifySessionPayload<UserSessionTokenPayload>(expired, 'viewer_unlocked')).toBeNull();
    expect(
      verifySessionPayload<UserSessionTokenPayload>(`${unlockedToken}x`, 'viewer_unlocked')
    ).toBeNull();
  });

  test('hashes and verifies 6-digit OTP codes with scrypt', () => {
    const otpHash = hashPasscode('140226');
    expect(otpHash).not.toContain('140226');
    expect(verifyPasscode('140226', otpHash)).toBe(true);
    expect(verifyPasscode('121024', otpHash)).toBe(false);
  });

  test('verifyAdminTokenWithRepo and verifyViewerTokenWithRepo enforce role, isActive, and sessionVersion', async () => {
    const repo = makeMockRepo([
      activeAdmin,
      activeViewer,
      { ...activeViewer, id: 'locked-viewer', isActive: false },
      { ...activeAdmin, id: 'locked-admin', isActive: false },
    ]);

    const adminToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: activeAdmin.id,
        usr: activeAdmin.username,
        ver: activeAdmin.sessionVersion,
        role: 'admin',
        exp: 0,
      },
      3600
    );
    expect((await verifyAdminTokenWithRepo(adminToken, repo))?.id).toBe(activeAdmin.id);

    // Revoked sessionVersion fails immediately
    const staleAdminToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: activeAdmin.id,
        usr: activeAdmin.username,
        ver: activeAdmin.sessionVersion - 1,
        role: 'admin',
        exp: 0,
      },
      3600
    );
    expect(await verifyAdminTokenWithRepo(staleAdminToken, repo)).toBeNull();

    // Locked admin fails immediately
    const lockedAdminToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: 'locked-admin',
        usr: 'admin2',
        ver: activeAdmin.sessionVersion,
        role: 'admin',
        exp: 0,
      },
      3600
    );
    expect(await verifyAdminTokenWithRepo(lockedAdminToken, repo)).toBeNull();

    // Viewer cannot verify as admin even if token typ were 'admin'
    const spoofedViewerAsAdmin = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: activeViewer.id,
        usr: activeViewer.username,
        ver: activeViewer.sessionVersion,
        role: 'admin',
        exp: 0,
      },
      3600
    );
    expect(await verifyAdminTokenWithRepo(spoofedViewerAsAdmin, repo)).toBeNull();

    // Both viewer and admin can unlock '/' via viewer_unlocked / viewer_step1
    const viewerUnlocked = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: activeViewer.id,
        usr: activeViewer.username,
        ver: activeViewer.sessionVersion,
        role: 'viewer',
        exp: 0,
      },
      3600
    );
    const adminAsViewerUnlocked = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: activeAdmin.id,
        usr: activeAdmin.username,
        ver: activeAdmin.sessionVersion,
        role: 'admin',
        exp: 0,
      },
      3600
    );
    const step1Token = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_step1',
        sub: activeViewer.id,
        usr: activeViewer.username,
        ver: activeViewer.sessionVersion,
        role: 'viewer',
        exp: 0,
      },
      600
    );

    expect((await verifyViewerTokenWithRepo(viewerUnlocked, 'viewer_unlocked', repo))?.id).toBe(
      activeViewer.id
    );
    expect(
      (await verifyViewerTokenWithRepo(adminAsViewerUnlocked, 'viewer_unlocked', repo))?.id
    ).toBe(activeAdmin.id);
    expect(await verifyViewerTokenWithRepo(step1Token, 'viewer_unlocked', repo)).toBeNull();
    expect((await verifyViewerTokenWithRepo(step1Token, 'viewer_step1', repo))?.id).toBe(
      activeViewer.id
    );

    // Revoked or locked viewer rejected
    const staleViewer = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: activeViewer.id,
        usr: activeViewer.username,
        ver: activeViewer.sessionVersion - 1,
        role: 'viewer',
        exp: 0,
      },
      3600
    );
    expect(await verifyViewerTokenWithRepo(staleViewer, 'viewer_unlocked', repo)).toBeNull();

    const lockedViewer = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: 'locked-viewer',
        usr: 'nguoithuong',
        ver: activeViewer.sessionVersion,
        role: 'viewer',
        exp: 0,
      },
      3600
    );
    expect(await verifyViewerTokenWithRepo(lockedViewer, 'viewer_unlocked', repo)).toBeNull();
  });

  test('summarizeUserAgent produces concise readable labels capped at 48 chars', () => {
    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1'
      )
    ).toBe('Safari · iPhone');

    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      )
    ).toBe('Chrome · macOS');

    expect(
      summarizeUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0'
      )
    ).toBe('Edge · Windows');

    expect(
      summarizeUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36')
    ).toBe('Trình duyệt · Android');

    expect(summarizeUserAgent(null)).toBe('Không rõ thiết bị');
    expect(summarizeUserAgent('')).toBe('Không rõ thiết bị');
    expect(summarizeUserAgent('X'.repeat(200)).length).toBeLessThanOrEqual(48);
  });
});

describe('multi-account & activity payload validation', () => {
  test('validates user login payload and optional defaultUsername', () => {
    expect(validateUserLoginPayload({ username: ' NguoiThuong ', password: 'love2026' })).toEqual({
      data: { username: 'nguoithuong', password: 'love2026' },
    });

    expect(
      validateUserLoginPayload({ password: 'secret' }, { defaultUsername: 'admin' })
    ).toEqual({
      data: { username: 'admin', password: 'secret' },
    });

    expect('error' in validateUserLoginPayload({ username: 'a', password: 'love2026' })).toBe(true);
    expect('error' in validateUserLoginPayload({ username: 'bad name!', password: 'love2026' })).toBe(
      true
    );
    expect('error' in validateUserLoginPayload({ username: 'admin', password: '123' })).toBe(true);
  });

  test('validates 6-digit OTP payload', () => {
    expect(validateOtpVerifyPayload({ otp: ' 140226 ' })).toEqual({ data: { otp: '140226' } });
    expect('error' in validateOtpVerifyPayload({ otp: '12345' })).toBe(true);
    expect('error' in validateOtpVerifyPayload({ otp: '1234567' })).toBe(true);
    expect('error' in validateOtpVerifyPayload({ otp: '12ab56' })).toBe(true);
    expect('error' in validateOtpVerifyPayload({})).toBe(true);
  });

  test('validates create & update user payloads', () => {
    expect(
      validateCreateUserPayload({
        username: ' Em.Yeu_1 ',
        displayName: 'Em bé',
        role: 'viewer',
        password: 'password123',
        otpCode: '121024',
        otpHint: 'Ngày kỷ niệm',
      })
    ).toEqual({
      data: {
        username: 'em.yeu_1',
        displayName: 'Em bé',
        role: 'viewer',
        password: 'password123',
        otpCode: '121024',
        otpHint: 'Ngày kỷ niệm',
        isActive: true,
      },
    });

    expect(
      'error' in
        validateCreateUserPayload({
          username: 'emyeu',
          displayName: '',
          role: 'viewer',
          password: 'password123',
          otpCode: '121024',
        })
    ).toBe(true);

    expect(
      'error' in
        validateCreateUserPayload({
          username: 'emyeu',
          displayName: 'Em',
          role: 'superadmin',
          password: 'password123',
          otpCode: '121024',
        })
    ).toBe(true);

    expect(
      'error' in
        validateCreateUserPayload({
          username: 'emyeu',
          displayName: 'Em',
          role: 'viewer',
          password: '12345',
          otpCode: '121024',
        })
    ).toBe(true);

    expect(
      'error' in
        validateCreateUserPayload({
          username: 'emyeu',
          displayName: 'Em',
          role: 'viewer',
          password: 'password123',
          otpCode: '1234',
        })
    ).toBe(true);

    expect(
      validateUpdateUserPayload({
        displayName: 'Thương em',
        password: '',
        otpCode: '',
        revokeSession: true,
      })
    ).toEqual({
      data: {
        displayName: 'Thương em',
        revokeSession: true,
      },
    });

    expect('error' in validateUpdateUserPayload({ password: '123' })).toBe(true);
    expect('error' in validateUpdateUserPayload({ otpCode: 'abc' })).toBe(true);
  });

  test('validates client activity allowlist and sanitizes detail + metadata', () => {
    const valid = validateClientActivityPayload({
      eventType: 'memory_viewed',
      detail: `  ${'a'.repeat(200)}  `,
      metadata: {
        memoryId: 'mem-1',
        longTitle: 'b'.repeat(120),
        index: 2,
        liked: true,
        ignoredObj: { nested: 1 },
        ignoredNull: null,
        k5: 'v5',
        k6: 'v6',
        k7: 'dropped-over-6-limit',
      },
    });

    expect('data' in valid).toBe(true);
    if ('data' in valid) {
      expect(valid.data.eventType).toBe('memory_viewed');
      expect(valid.data.detail.length).toBe(160);
      expect(Object.keys(valid.data.metadata || {})).toHaveLength(6);
      expect(valid.data.metadata?.longTitle).toBe('b'.repeat(80));
      expect(valid.data.metadata?.ignoredObj).toBeUndefined();
      expect(valid.data.metadata?.ignoredNull).toBeUndefined();
    }

    for (const forbidden of [
      'login_step1_ok',
      'login_failed',
      'otp_verified',
      'otp_failed',
      'logout',
      'unknown',
    ]) {
      expect('error' in validateClientActivityPayload({ eventType: forbidden })).toBe(true);
    }
  });

  test('allows enabling viewerPasscodeEnabled in settings without legacy PIN', () => {
    const res = validateSettingsPayload({
      coupleTitle: 'Anh & Em',
      heroSubtitle: 'Mãi bên nhau',
      loveStartDate: '2024-10-12',
      musicUrl: '/samples/gentle-memories.wav',
      musicEnabled: true,
      letterTitle: 'Gửi em',
      letterBody: 'Thương em nhiều lắm.',
      letterSignature: 'Anh',
      viewerPasscodeEnabled: true,
    });
    expect('data' in res).toBe(true);
  });
});
