// @vitest-environment node
import { NextResponse } from 'next/server';
import { describe, expect, test } from 'vitest';
import {
  ADMIN_COOKIE_NAME,
  clearViewerCookiesOnResponse,
  GUEST_COOLDOWN_COOKIE_NAME,
  hashPasscode,
  resolveAdminSession,
  resolveViewerSession,
  sanitizeUserForClient,
  signSessionPayload,
  summarizeUserAgent,
  verifyAdminTokenWithRepo,
  verifyPasscode,
  verifySessionPayload,
  verifyUserPasswordConstantTime,
  verifyViewerTokenWithRepo,
  VIEWER_STEP1_COOKIE_NAME,
  VIEWER_UNLOCKED_COOKIE_NAME,
  type GuestCooldownTokenPayload,
  type UserSessionTokenPayload,
} from '@/lib/auth';
import { buildInitialUsers } from '@/lib/seed-data';
import {
  getDroppedOrPastedFiles,
  validateClientVisualMediaFile,
  VISUAL_MEDIA_INVALID_TYPE_MESSAGE,
} from '@/lib/client-dropzone';
import {
  formatAlbumMediaCountVi,
  getMemoryImages,
  isVideoFile,
  isVideoMediaItem,
  isVideoMediaUrl,
  MAX_ALBUM_IMAGES,
} from '@/lib/memory-album';
import { requireMemberApiSession, resolveMemberSession } from '@/lib/member-guard';
import { StorageRepository } from '@/lib/storage/types';
import { AppUser } from '@/types/memories';
import {
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  MAX_MEMORY_STORY_LENGTH,
  MAX_VIDEO_BYTES,
  sanitizeStorageFileName,
  validateClientActivityPayload,
  validateCreateUserPayload,
  validateDiaryEntryPayload,
  validateMemoryPayload,
  validateOtpVerifyPayload,
  validateSettingsPayload,
  validateUpdateUserPayload,
  validateUploadRequest,
  validateUserLoginPayload,
} from '@/lib/validation';

describe('auth & session tokens', () => {
  const sampleAdminPayload: UserSessionTokenPayload = {
    typ: 'admin',
    sub: 'admin-id-1',
    usr: 'admin',
    ver: 1,
    role: 'admin',
    exp: 0,
  };

  test('creates and verifies valid admin session token, rejecting tampered or expired tokens', () => {
    const token = signSessionPayload<UserSessionTokenPayload>(sampleAdminPayload, 3600);
    expect(verifySessionPayload<UserSessionTokenPayload>(token, 'admin')?.sub).toBe('admin-id-1');
    expect(verifySessionPayload<UserSessionTokenPayload>(`${token}tampered`, 'admin')).toBeNull();
    expect(verifySessionPayload<UserSessionTokenPayload>('', 'admin')).toBeNull();
    expect(verifySessionPayload<UserSessionTokenPayload>(null, 'admin')).toBeNull();

    const expired = signSessionPayload<UserSessionTokenPayload>(sampleAdminPayload, -10);
    expect(verifySessionPayload<UserSessionTokenPayload>(expired, 'admin')).toBeNull();
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
      const devToken = signSessionPayload<UserSessionTokenPayload>(sampleAdminPayload, 3600);
      expect(verifySessionPayload<UserSessionTokenPayload>(devToken, 'admin')?.sub).toBe(
        'admin-id-1'
      );

      // In production without ADMIN_SESSION_SECRET, signing must throw and verification must reject dev tokens
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      expect(() => signSessionPayload<UserSessionTokenPayload>(sampleAdminPayload, 3600)).toThrow(
        /ADMIN_SESSION_SECRET/
      );
      expect(verifySessionPayload<UserSessionTokenPayload>(devToken, 'admin')).toBeNull();

      // With ADMIN_SESSION_SECRET set in production, signing and verifying succeed
      process.env.ADMIN_SESSION_SECRET = 'prod-strong-random-secret-key-32-chars';
      const prodToken = signSessionPayload<UserSessionTokenPayload>(sampleAdminPayload, 3600);
      expect(verifySessionPayload<UserSessionTokenPayload>(prodToken, 'admin')?.sub).toBe(
        'admin-id-1'
      );
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

  test('sanitizeUserForClient strips sensitive hashes and clearViewerCookiesOnResponse clears viewer cookies', () => {
    const safe = sanitizeUserForClient(activeAdmin);
    expect('passwordHash' in safe).toBe(false);
    expect('otpHash' in safe).toBe(false);
    expect(safe).toMatchObject({
      id: activeAdmin.id,
      username: 'admin',
      displayName: activeAdmin.displayName,
      role: 'admin',
      hasPassword: true,
      hasOtp: true,
    });

    const response = NextResponse.json({ ok: true });
    clearViewerCookiesOnResponse(response);
    expect(response.cookies.get(VIEWER_STEP1_COOKIE_NAME)?.value).toBe('');
    expect(response.cookies.get(VIEWER_UNLOCKED_COOKIE_NAME)?.value).toBe('');
  });

  test('verifySessionPayload rejects array payloads, empty usr, ver < 1, and admin token with viewer role', () => {
    const arrayToken = signSessionPayload([] as unknown as { typ: string; exp: number }, 3600);
    expect(verifySessionPayload<UserSessionTokenPayload>(arrayToken, 'viewer_unlocked')).toBeNull();

    const emptyUsrToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: activeViewer.id,
        usr: '',
        ver: 1,
        role: 'viewer',
        exp: 0,
      },
      3600
    );
    expect(verifySessionPayload<UserSessionTokenPayload>(emptyUsrToken, 'viewer_unlocked')).toBeNull();

    const zeroVerToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: activeViewer.id,
        usr: 'nguoithuong',
        ver: 0,
        role: 'viewer',
        exp: 0,
      },
      3600
    );
    expect(verifySessionPayload<UserSessionTokenPayload>(zeroVerToken, 'viewer_unlocked')).toBeNull();

    const adminWithViewerRole = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: activeAdmin.id,
        usr: 'admin',
        ver: 1,
        role: 'viewer',
        exp: 0,
      },
      3600
    );
    expect(verifySessionPayload<UserSessionTokenPayload>(adminWithViewerRole, 'admin')).toBeNull();
  });

  test('resolveAdminSession and resolveViewerSession handle unlocked, otp_pending, and login_required states', async () => {
    const users = [activeAdmin, activeViewer];
    const repo = makeMockRepo(users);

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

    const adminSession = await resolveAdminSession(
      repo,
      new Request('http://localhost/admin', {
        headers: { cookie: `${ADMIN_COOKIE_NAME}=${adminToken}` },
      })
    );
    expect(adminSession?.username).toBe('admin');
    expect(adminSession && 'passwordHash' in adminSession).toBe(false);

    const unlockedState = await resolveViewerSession(
      repo,
      new Request('http://localhost/', {
        headers: {
          cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${unlockedToken}; ${VIEWER_STEP1_COOKIE_NAME}=${step1Token}`,
        },
      })
    );
    expect(unlockedState).toMatchObject({
      stage: 'unlocked',
      user: { username: 'nguoithuong' },
    });

    const pendingState = await resolveViewerSession(
      repo,
      new Request('http://localhost/', {
        headers: { cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Token}` },
      })
    );
    expect(pendingState).toMatchObject({
      stage: 'otp_pending',
      user: { username: 'nguoithuong' },
      otpHint: '14/02',
    });

    // Simulate session revocation and lock -> falls back to login_required
    const revokedRepo = makeMockRepo([{ ...activeViewer, sessionVersion: 99 }]);
    const afterRevoke = await resolveViewerSession(
      revokedRepo,
      new Request('http://localhost/', {
        headers: { cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${unlockedToken}` },
      })
    );
    expect(afterRevoke).toEqual({ stage: 'login_required', user: null });

    const lockedRepo = makeMockRepo([{ ...activeViewer, isActive: false }]);
    const afterLock = await resolveViewerSession(
      lockedRepo,
      new Request('http://localhost/', {
        headers: { cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1Token}` },
      })
    );
    expect(afterLock).toEqual({ stage: 'login_required', user: null });
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
    expect('error' in validateUserLoginPayload({ username: 'admin', password: '      ' })).toBe(
      true
    );
    expect(
      'error' in
        validateUserLoginPayload({ username: 123, password: 'secret' }, { defaultUsername: 'admin' })
    ).toBe(true);
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
      'error' in
        validateCreateUserPayload({
          username: 'emyeu',
          displayName: 'Em',
          role: 'viewer',
          password: '        ',
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
          otpCode: '121024',
          isActive: 'false',
        })
    ).toBe(true);

    expect(
      validateCreateUserPayload({
        username: 'emyeu',
        displayName: 'Em',
        role: 'viewer',
        password: 'password123',
        otpCode: '121024',
        isActive: false,
      })
    ).toEqual({
      data: {
        username: 'emyeu',
        displayName: 'Em',
        role: 'viewer',
        password: 'password123',
        otpCode: '121024',
        otpHint: '',
        isActive: false,
      },
    });

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
    expect('error' in validateUpdateUserPayload({ password: '      ' })).toBe(true);
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

    const protoPayload = JSON.parse(
      '{"eventType":"memory_viewed","metadata":{"__proto__":"bad","constructor":"bad","prototype":"bad","safeKey":"ok"}}'
    );
    const sanitized = validateClientActivityPayload(protoPayload);
    expect('data' in sanitized).toBe(true);
    if ('data' in sanitized) {
      expect(sanitized.data.metadata).toEqual({ safeKey: 'ok' });
      expect(Object.prototype.hasOwnProperty.call(sanitized.data.metadata, '__proto__')).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(sanitized.data.metadata, 'constructor')).toBe(
        false
      );
      expect(Object.prototype.hasOwnProperty.call(sanitized.data.metadata, 'prototype')).toBe(false);
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

  test('rejects JSON array payloads across user, OTP, and activity validators', () => {
    expect('error' in validateUserLoginPayload([])).toBe(true);
    expect('error' in validateOtpVerifyPayload([])).toBe(true);
    expect('error' in validateCreateUserPayload([])).toBe(true);
    expect('error' in validateUpdateUserPayload([])).toBe(true);
    expect('error' in validateClientActivityPayload([])).toBe(true);
  });

  test('rejects reserved username "khach" in validateCreateUserPayload', () => {
    for (const candidate of ['khach', ' KHACH ']) {
      const res = validateCreateUserPayload({
        username: candidate,
        displayName: 'Khách',
        role: 'viewer',
        password: 'password123',
        otpCode: '123456',
      });
      expect(res).toEqual({
        error: 'Tên tài khoản "khach" được hệ thống dành riêng cho khách ghé trang.',
      });
    }
  });

  test('verifyUserPasswordConstantTime rejects users with empty passwordHash and buildInitialUsers validates ADMIN_DEFAULT_OTP', () => {
    const userWithoutPasswordHash: AppUser = {
      id: 'user-empty-hash',
      username: 'broken',
      displayName: 'Broken',
      role: 'viewer',
      passwordHash: '',
      otpHash: hashPasscode('123456'),
      otpHint: '',
      isActive: true,
      sessionVersion: 1,
      lastLoginAt: null,
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    };
    expect(verifyUserPasswordConstantTime(null, 'love2026')).toBe(false);
    expect(verifyUserPasswordConstantTime(userWithoutPasswordHash, '')).toBe(false);
    expect(
      verifyUserPasswordConstantTime(userWithoutPasswordHash, 'ny-dummy-constant-time-secret')
    ).toBe(false);

    const origOtp = process.env.ADMIN_DEFAULT_OTP;
    try {
      process.env.ADMIN_DEFAULT_OTP = '12345';
      expect(() => buildInitialUsers()).toThrow(/ADMIN_DEFAULT_OTP/);

      process.env.ADMIN_DEFAULT_OTP = '12ab56';
      expect(() => buildInitialUsers()).toThrow(/ADMIN_DEFAULT_OTP/);

      process.env.ADMIN_DEFAULT_OTP = '654321';
      const seeded = buildInitialUsers();
      const admin = seeded.find((u) => u.username === 'admin')!;
      expect(verifyPasscode('654321', admin.otpHash)).toBe(true);
    } finally {
      if (origOtp === undefined) {
        delete process.env.ADMIN_DEFAULT_OTP;
      } else {
        process.env.ADMIN_DEFAULT_OTP = origOtp;
      }
    }
  });
});

describe('diary entry validation & member session guard', () => {
  test('validateDiaryEntryPayload accepts text-only and photo-attached entries, defaults mood to loved, and clears imageAlt when imageUrl is empty', () => {
    const textOnly = validateDiaryEntryPayload({
      entryDate: '2026-11-17',
      title: '  Một ngày bình yên  ',
      content: '  Hôm nay tụi mình cùng nấu bữa tối ấm áp.  ',
      imageAlt: 'Không nên giữ lại khi chưa có ảnh',
    });
    expect(textOnly).toEqual({
      data: {
        entryDate: '2026-11-17',
        title: 'Một ngày bình yên',
        content: 'Hôm nay tụi mình cùng nấu bữa tối ấm áp.',
        mood: 'loved',
        imageUrl: '',
        imageAlt: '',
      },
    });

    const withImage = validateDiaryEntryPayload({
      entryDate: '2026-11-17',
      title: 'Đi dạo phố đêm',
      content: 'Trời se lạnh nhưng nắm tay anh ấm lắm.',
      mood: 'happy',
      imageUrl: '/uploads/1731814000-abcd1234-night.webp',
      imageAlt: '',
    });
    expect(withImage).toEqual({
      data: {
        entryDate: '2026-11-17',
        title: 'Đi dạo phố đêm',
        content: 'Trời se lạnh nhưng nắm tay anh ấm lắm.',
        mood: 'happy',
        imageUrl: '/uploads/1731814000-abcd1234-night.webp',
        imageAlt: 'Đi dạo phố đêm',
      },
    });
  });

  test('validateDiaryEntryPayload rejects invalid dates, empty content, unknown moods, and unsafe imageUrl; client activity blocks diary_saved forgery', () => {
    expect('error' in validateDiaryEntryPayload(null)).toBe(true);
    expect('error' in validateDiaryEntryPayload([])).toBe(true);
    expect(
      'error' in
        validateDiaryEntryPayload({
          entryDate: '2026-02-30',
          content: 'Ngày không tồn tại',
        })
    ).toBe(true);
    expect(
      'error' in
        validateDiaryEntryPayload({
          entryDate: '2026-11-17',
          content: '   ',
        })
    ).toBe(true);
    expect(
      'error' in
        validateDiaryEntryPayload({
          entryDate: '2026-11-17',
          content: 'Tâm trạng lạ',
          mood: 'angry_unknown',
        })
    ).toBe(true);
    expect(
      'error' in
        validateDiaryEntryPayload({
          entryDate: '2026-11-17',
          content: 'Đường dẫn ảnh xấu',
          imageUrl: '/uploads/../secret.json',
        })
    ).toBe(true);

    // Server-only diary events cannot be forged via /api/activity
    expect(
      'error' in
        validateClientActivityPayload({
          eventType: 'diary_saved',
          detail: 'Giả mạo ghi nhật ký',
        })
    ).toBe(true);
    expect(
      'error' in
        validateClientActivityPayload({
          eventType: 'diary_deleted',
          detail: 'Giả mạo xoá nhật ký',
        })
    ).toBe(true);
  });

  test('requireMemberApiSession accepts viewer_unlocked, falls back to admin cookie, and rejects viewer_step1 or stale cookies', async () => {
    const adminUser: AppUser = {
      id: 'admin-1',
      username: 'admin',
      displayName: 'Anh',
      role: 'admin',
      passwordHash: 's:h',
      otpHash: 's:o',
      otpHint: '',
      isActive: true,
      sessionVersion: 2,
      lastLoginAt: null,
      createdAt: '2026-11-15T00:00:00.000Z',
      updatedAt: '2026-11-15T00:00:00.000Z',
    };
    const viewerUser: AppUser = {
      ...adminUser,
      id: 'viewer-1',
      username: 'nguoithuong',
      displayName: 'Em bé',
      role: 'viewer',
      sessionVersion: 4,
    };
    const repo = {
      getUserById: async (id: string) =>
        [adminUser, viewerUser].find((u) => u.id === id) ?? null,
    } as unknown as StorageRepository;

    const viewerUnlockedToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: viewerUser.id,
        usr: viewerUser.username,
        ver: viewerUser.sessionVersion,
        role: 'viewer',
        exp: 0,
      },
      3600
    );
    const adminSessionToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: adminUser.id,
        usr: adminUser.username,
        ver: adminUser.sessionVersion,
        role: 'admin',
        exp: 0,
      },
      3600
    );
    const step1OnlyToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_step1',
        sub: viewerUser.id,
        usr: viewerUser.username,
        ver: viewerUser.sessionVersion,
        role: 'viewer',
        exp: 0,
      },
      600
    );
    const staleViewerToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'viewer_unlocked',
        sub: viewerUser.id,
        usr: viewerUser.username,
        ver: viewerUser.sessionVersion - 1,
        role: 'viewer',
        exp: 0,
      },
      3600
    );

    // 1. Unlocked viewer succeeds
    const viewerReq = new Request('http://localhost/api/diary', {
      headers: { cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${viewerUnlockedToken}` },
    });
    const viewerAuth = await requireMemberApiSession(viewerReq, repo);
    expect(viewerAuth.ok).toBe(true);
    if (viewerAuth.ok) {
      expect(viewerAuth.user.username).toBe('nguoithuong');
      expect(viewerAuth.user.role).toBe('viewer');
    }

    // 2. Stale viewer cookie + valid admin cookie falls back cleanly to admin
    const fallbackReq = new Request('http://localhost/api/diary', {
      headers: {
        cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${staleViewerToken}; ${ADMIN_COOKIE_NAME}=${adminSessionToken}`,
      },
    });
    const fallbackUser = await resolveMemberSession(fallbackReq, repo);
    expect(fallbackUser?.username).toBe('admin');
    const fallbackAuth = await requireMemberApiSession(fallbackReq, repo);
    expect(fallbackAuth.ok).toBe(true);
    if (fallbackAuth.ok) {
      expect(fallbackAuth.user.role).toBe('admin');
    }

    // 3. Step-1-only cookie (OTP unverified) is strictly rejected with 401
    const step1Req = new Request('http://localhost/api/diary', {
      headers: { cookie: `${VIEWER_STEP1_COOKIE_NAME}=${step1OnlyToken}` },
    });
    const step1Auth = await requireMemberApiSession(step1Req, repo);
    expect(step1Auth.ok).toBe(false);
    if (!step1Auth.ok) {
      expect(step1Auth.response.status).toBe(401);
    }

    // 4. Stale viewer + stale admin cookies return 401 and clear both stale cookies
    const staleAdminToken = signSessionPayload<UserSessionTokenPayload>(
      {
        typ: 'admin',
        sub: adminUser.id,
        usr: adminUser.username,
        ver: adminUser.sessionVersion - 1,
        role: 'admin',
        exp: 0,
      },
      3600
    );
    const staleReq = new Request('http://localhost/api/diary', {
      headers: {
        cookie: `${VIEWER_UNLOCKED_COOKIE_NAME}=${staleViewerToken}; ${ADMIN_COOKIE_NAME}=${staleAdminToken}`,
      },
    });
    const staleAuth = await requireMemberApiSession(staleReq, repo);
    expect(staleAuth.ok).toBe(false);
    if (!staleAuth.ok) {
      expect(staleAuth.response.status).toBe(401);
      const setCookie = staleAuth.response.headers.get('set-cookie') ?? '';
      expect(setCookie).toContain(`${VIEWER_UNLOCKED_COOKIE_NAME}=;`);
      expect(setCookie).toContain(`${ADMIN_COOKIE_NAME}=;`);
    }
  });
});

describe('multi-photo memory album helpers & validation', () => {
  test('validateMemoryPayload accepts 1..MAX_ALBUM_IMAGES photos, syncs cover imageUrl/imageAlt, normalizes legacy payload, and rejects empty or oversized albums', () => {
    const multi = validateMemoryPayload({
      memoryDate: '2026-04-05',
      title: 'Đà Lạt cuối tuần',
      story: 'Ba bức ảnh đầy nắng.',
      images: [
        { url: '/uploads/cover.jpg', alt: 'Ảnh bìa Đà Lạt' },
        { url: '/uploads/pic-2.jpg', alt: '' },
        { url: 'https://cdn.example.com/pic-3.webp', alt: 'Cà phê sáng' },
      ],
    });
    expect(multi).toEqual({
      data: {
        memoryDate: '2026-04-05',
        title: 'Đà Lạt cuối tuần',
        story: 'Ba bức ảnh đầy nắng.',
        imageUrl: '/uploads/cover.jpg',
        imageAlt: 'Ảnh bìa Đà Lạt',
        images: [
          { url: '/uploads/cover.jpg', alt: 'Ảnh bìa Đà Lạt' },
          { url: '/uploads/pic-2.jpg', alt: 'Đà Lạt cuối tuần' },
          { url: 'https://cdn.example.com/pic-3.webp', alt: 'Cà phê sáng' },
        ],
      },
    });

    const legacy = validateMemoryPayload({
      memoryDate: '2024-10-12',
      title: 'Kỷ niệm cũ',
      story: 'Một bức ảnh.',
      imageUrl: '/samples/memory-1.svg',
      imageAlt: 'Ảnh cũ',
    });
    expect(legacy).toEqual({
      data: {
        memoryDate: '2024-10-12',
        title: 'Kỷ niệm cũ',
        story: 'Một bức ảnh.',
        imageUrl: '/samples/memory-1.svg',
        imageAlt: 'Ảnh cũ',
        images: [{ url: '/samples/memory-1.svg', alt: 'Ảnh cũ' }],
      },
    });

    expect(
      'error' in
        validateMemoryPayload({
          memoryDate: '2026-04-05',
          title: 'Trống',
          story: 'Không ảnh nào',
          images: [],
        })
    ).toBe(true);

    expect(
      'error' in
        validateMemoryPayload({
          memoryDate: '2026-04-05',
          title: 'Quá giới hạn',
          story: 'Quá nhiều ảnh',
          images: Array.from({ length: MAX_ALBUM_IMAGES + 1 }, (_, idx) => ({
            url: `/uploads/${idx}.jpg`,
            alt: '',
          })),
        })
    ).toBe(true);

    expect(
      'error' in
        validateMemoryPayload({
          memoryDate: '2026-04-05',
          title: 'Sai URL',
          story: 'Có 1 ảnh lỗi',
          images: [
            { url: '/uploads/ok.jpg', alt: 'OK' },
            { url: '/uploads/../bad.jpg', alt: 'Bad' },
          ],
        })
    ).toBe(true);
  });

  test('getMemoryImages returns normalized images or single-image fallback, and getDroppedOrPastedFiles extracts multiple dropped or pasted files', () => {
    expect(
      getMemoryImages({
        title: 'Bức cũ',
        imageUrl: '/samples/memory-2.svg',
        imageAlt: '',
      })
    ).toEqual([{ url: '/samples/memory-2.svg', alt: 'Bức cũ' }]);

    expect(
      getMemoryImages({
        title: 'Album mới',
        imageUrl: '/uploads/1.jpg',
        imageAlt: '1',
        images: [
          { url: '/uploads/1.jpg', alt: '1' },
          { url: '/uploads/2.jpg', alt: '' },
        ],
      })
    ).toEqual([
      { url: '/uploads/1.jpg', alt: '1' },
      { url: '/uploads/2.jpg', alt: 'Album mới' },
    ]);

    const f1 = new File(['a'], 'a.jpg', { type: 'image/jpeg' });
    const f2 = new File(['b'], 'b.png', { type: 'image/png' });
    expect(getDroppedOrPastedFiles([f1, f2])).toEqual([f1, f2]);

    const fakeItems = [
      { kind: 'string', getAsFile: () => null },
      { kind: 'file', getAsFile: () => f1 },
      { kind: 'file', getAsFile: () => f2 },
    ] as unknown as DataTransferItemList;
    expect(getDroppedOrPastedFiles(null, fakeItems)).toEqual([f1, f2]);
  });

  test('validateUploadRequest, video detection helpers, and client visual validation support MP4/WebM/MOV/M4V up to 100MB while preserving image .toEqual parity', () => {
    expect(MAX_VIDEO_BYTES).toBe(100 * 1024 * 1024);

    // Server upload validation for video kind
    for (const sample of [
      { mimeType: 'video/mp4', size: 25 * 1024 * 1024, fileName: 'ky-niem.mp4' },
      { mimeType: 'video/webm', size: 50 * 1024 * 1024, fileName: 'clip.webm' },
      { mimeType: 'video/quicktime', size: MAX_VIDEO_BYTES, fileName: 'iphone.MOV' },
      { mimeType: 'video/x-m4v', size: 8 * 1024 * 1024, fileName: 'clip.m4v' },
    ]) {
      expect(validateUploadRequest({ kind: 'video', ...sample })).toEqual({ valid: true });
    }

    expect(
      validateUploadRequest({
        kind: 'video',
        mimeType: 'video/mp4',
        size: MAX_VIDEO_BYTES + 1,
        fileName: 'too-big.mp4',
      })
    ).toEqual({ valid: false, error: 'Video vượt quá giới hạn tối đa 100MB.' });

    for (const badVideo of [
      { mimeType: 'video/x-msvideo', size: 1024, fileName: 'old.avi' },
      { mimeType: 'image/svg+xml', size: 1024, fileName: 'xss.svg' },
    ]) {
      expect(validateUploadRequest({ kind: 'video', ...badVideo }).valid).toBe(false);
    }

    // URL & File video detection helpers
    expect(isVideoMediaUrl('/uploads/sunset.mp4?v=1#t=2')).toBe(true);
    expect(isVideoMediaUrl('https://cdn.example.com/clip.MOV')).toBe(true);
    expect(isVideoMediaUrl('blob:http://localhost:3000/abc')).toBe(false);
    expect(isVideoMediaUrl('/uploads/photo.jpg')).toBe(false);

    const validVid = new File([new Uint8Array([1, 2])], 'clip.mp4', { type: 'video/mp4' });
    const movVid = new File([new Uint8Array([1, 2])], 'iphone.mov', { type: '' });
    const badTxt = new File(['abc'], 'notes.txt', { type: 'text/plain' });
    expect(isVideoFile(validVid)).toBe(true);
    expect(isVideoFile(movVid)).toBe(true);
    expect(validateClientVisualMediaFile(validVid)).toBeNull();
    expect(validateClientVisualMediaFile(movVid)).toBeNull();
    expect(validateClientVisualMediaFile(badTxt)).toBe(VISUAL_MEDIA_INVALID_TYPE_MESSAGE);

    expect(isVideoMediaItem({ url: '/uploads/photo.jpg' })).toBe(false);
    expect(isVideoMediaItem({ url: '/uploads/clip.mp4' })).toBe(true);
    expect(formatAlbumMediaCountVi([{ url: '/a.jpg' }, { url: '/b.jpg' }])).toBe('2 ảnh');
    expect(formatAlbumMediaCountVi([{ url: '/a.mp4', mediaType: 'video' }])).toBe('1 video');
    expect(
      formatAlbumMediaCountVi([
        { url: '/a.jpg' },
        { url: '/b.mp4', mediaType: 'video' },
        { url: '/c.png' },
      ])
    ).toBe('2 ảnh · 1 video');

    // validateMemoryPayload & getMemoryImages tag videos while keeping images omitted-mediaType
    const mixed = validateMemoryPayload({
      memoryDate: '2026-05-01',
      title: 'Kỷ niệm có video',
      story: 'Cả ảnh và video.',
      images: [
        { url: '/uploads/cover.jpg', alt: 'Ảnh bìa' },
        { url: '/uploads/sunset.mp4', alt: 'Video hoàng hôn' },
      ],
    });
    expect(mixed).toEqual({
      data: {
        memoryDate: '2026-05-01',
        title: 'Kỷ niệm có video',
        story: 'Cả ảnh và video.',
        imageUrl: '/uploads/cover.jpg',
        imageAlt: 'Ảnh bìa',
        images: [
          { url: '/uploads/cover.jpg', alt: 'Ảnh bìa' },
          { url: '/uploads/sunset.mp4', alt: 'Video hoàng hôn', mediaType: 'video' },
        ],
      },
    });

    expect(
      getMemoryImages({
        title: 'Chỉ video',
        imageUrl: '/uploads/clip.mov',
        imageAlt: '',
      })
    ).toEqual([{ url: '/uploads/clip.mov', alt: 'Chỉ video', mediaType: 'video' }]);

    // Long multi-paragraph album stories (>1200 chars) are preserved up to MAX_MEMORY_STORY_LENGTH (6000)
    expect(MAX_MEMORY_STORY_LENGTH).toBe(6000);
    const longStory = `${'Đoạn kỷ niệm dài. '.repeat(90)}\n\n${'Kết thư ngọt ngào.'.repeat(20)}`.trim();
    expect(longStory.length).toBeGreaterThan(1500);
    const longRes = validateMemoryPayload({
      memoryDate: '2026-05-01',
      title: 'Album câu chuyện dài',
      story: longStory,
      imageUrl: '/uploads/cover.jpg',
    });
    expect('data' in longRes && longRes.data.story).toBe(longStory);
  });
});
