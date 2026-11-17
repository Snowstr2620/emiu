import { describe, expect, test } from 'vitest';
import {
  DEFAULT_FAVICON_URL,
  DEFAULT_SITE_TITLE,
  getSiteBranding,
  MAX_SITE_TITLE_LENGTH,
} from '@/lib/site-branding';
import { validateSettingsPayload } from '@/lib/validation';

const BASE = {
  coupleTitle: 'Anh & Em',
  heroSubtitle: 'Mãi bên nhau',
  loveStartDate: '2024-10-12',
  musicUrl: '/samples/gentle-memories.wav',
  musicEnabled: true,
  letterTitle: 'Gửi em',
  letterBody: 'Thương em nhiều lắm.',
  letterSignature: 'Anh',
  viewerPasscodeEnabled: true,
};

describe('browser tab branding', () => {
  test('falls back to the default title and heart icon when unset', () => {
    expect(getSiteBranding(null)).toEqual({
      siteTitle: DEFAULT_SITE_TITLE,
      faviconUrl: DEFAULT_FAVICON_URL,
    });
    expect(getSiteBranding({ siteTitle: '   ', faviconUrl: '' })).toEqual({
      siteTitle: DEFAULT_SITE_TITLE,
      faviconUrl: DEFAULT_FAVICON_URL,
    });
    expect(getSiteBranding({ siteTitle: 'Nhà của tụi mình', faviconUrl: '/uploads/icon.png' })).toEqual({
      siteTitle: 'Nhà của tụi mình',
      faviconUrl: '/uploads/icon.png',
    });
  });

  test('validates the tab title and icon', () => {
    const ok = validateSettingsPayload({
      ...BASE,
      siteTitle: '  Nhà của tụi mình  ',
      faviconUrl: '/uploads/1731840000000-aaaa1111-icon.png',
    });
    expect('data' in ok && ok.data.siteTitle).toBe('Nhà của tụi mình');
    expect('data' in ok && ok.data.faviconUrl).toBe('/uploads/1731840000000-aaaa1111-icon.png');

    const legacy = validateSettingsPayload(BASE);
    expect('data' in legacy && legacy.data.siteTitle).toBe('');
    expect('data' in legacy && legacy.data.faviconUrl).toBe('');

    expect(
      'error' in validateSettingsPayload({ ...BASE, siteTitle: 'x'.repeat(MAX_SITE_TITLE_LENGTH + 1) })
    ).toBe(true);
    expect('error' in validateSettingsPayload({ ...BASE, faviconUrl: 'javascript:alert(1)' })).toBe(true);
    expect('error' in validateSettingsPayload({ ...BASE, faviconUrl: '/uploads/clip.mp4' })).toBe(true);
  });
});
