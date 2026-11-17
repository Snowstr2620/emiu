export const DEFAULT_SITE_TITLE = 'Miền Ký Ức Yêu Thương · Chỉ Riêng Hai Đứa';
export const DEFAULT_FAVICON_URL = '/samples/favicon-heart.svg';
export const MAX_SITE_TITLE_LENGTH = 80;

/** Browser-tab title and icon, falling back to the built-in defaults when unset. */
export function getSiteBranding(settings: { siteTitle?: string; faviconUrl?: string } | null) {
  return {
    siteTitle: settings?.siteTitle?.trim() || DEFAULT_SITE_TITLE,
    faviconUrl: settings?.faviconUrl?.trim() || DEFAULT_FAVICON_URL,
  };
}
