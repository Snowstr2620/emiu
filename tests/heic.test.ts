import { describe, expect, test, vi } from 'vitest';

const mockHeicTo = vi.fn();
vi.mock('heic-to/next', () => ({ heicTo: mockHeicTo }));

import { convertHeicFiles, isHeicFile } from '@/lib/heic';

describe('isHeicFile', () => {
  test('detects HEIC/HEIF by mime type or extension', () => {
    expect(isHeicFile({ name: 'a.jpg', type: 'image/heic' })).toBe(true);
    expect(isHeicFile({ name: 'a.jpg', type: 'image/heif' })).toBe(true);
    expect(isHeicFile({ name: 'IMG_1234.HEIC', type: '' })).toBe(true);
    expect(isHeicFile({ name: 'photo.heif', type: 'application/octet-stream' })).toBe(true);
    expect(isHeicFile({ name: 'photo.jpg', type: 'image/jpeg' })).toBe(false);
    expect(isHeicFile({ name: 'clip.mov', type: 'video/quicktime' })).toBe(false);
  });
});

describe('convertHeicFiles', () => {
  test('converts HEIC files to .jpg, keeps others, and counts failures', async () => {
    mockHeicTo
      .mockResolvedValueOnce(new Blob([new Uint8Array([1, 2])], { type: 'image/jpeg' }))
      .mockRejectedValueOnce(new Error('corrupt'));

    const heic = new File([new Uint8Array([1])], 'IMG_0001.HEIC', { type: 'image/heic' });
    const png = new File([new Uint8Array([2])], 'x.png', { type: 'image/png' });
    const broken = new File([new Uint8Array([3])], 'broken.heic', { type: '' });

    const { files, failed } = await convertHeicFiles([heic, png, broken]);

    expect(failed).toBe(1);
    expect(files).toHaveLength(2);
    expect(files[0].name).toBe('IMG_0001.jpg');
    expect(files[0].type).toBe('image/jpeg');
    expect(files[1]).toBe(png);
    expect(mockHeicTo).toHaveBeenCalledWith(
      expect.objectContaining({ blob: heic, type: 'image/jpeg', quality: 0.9 })
    );
  });
});
