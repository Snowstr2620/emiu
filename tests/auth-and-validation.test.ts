import { describe, expect, test } from 'vitest';
import {
  createAdminSessionToken,
  createViewerSessionToken,
  hashPasscode,
  verifyAdminSessionToken,
  verifyPasscode,
  verifyViewerSessionToken,
} from '@/lib/auth';
import {
  MAX_AUDIO_BYTES,
  MAX_IMAGE_BYTES,
  sanitizeStorageFileName,
  validateUploadRequest,
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
