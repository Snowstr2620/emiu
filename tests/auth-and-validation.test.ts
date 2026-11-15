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
  });

  test('sanitizes filenames against path traversal and unsafe characters', () => {
    const safe = sanitizeStorageFileName('../../etc/Kỷ niệm đẹp (1).JPG');
    expect(safe).not.toContain('..');
    expect(safe).not.toContain('/');
    expect(safe).toMatch(/\.jpg$/);
  });
});
