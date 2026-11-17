export const DEFAULT_MUSIC_URL = '/samples/gentle-memories.wav';
export const MAX_MUSIC_TRACKS = 30;

/** Trims, drops empty/non-string entries and removes duplicates while keeping order. */
export function normalizePlaylist(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const url = item.trim();
    if (!url || seen.has(url)) continue;
    seen.add(url);
    result.push(url);
  }
  return result;
}

/**
 * The saved playlist. Older data only has a single `musicUrl`, which is
 * treated as a one-track playlist.
 */
export function getMusicPlaylist(settings: {
  musicUrl?: string;
  musicPlaylist?: string[];
}): string[] {
  const list = normalizePlaylist(settings.musicPlaylist);
  if (list.length > 0) return list;
  const single = settings.musicUrl?.trim();
  return single ? [single] : [];
}

/** Like getMusicPlaylist but never empty: falls back to the bundled sample track. */
export function getPlayablePlaylist(settings: {
  musicUrl?: string;
  musicPlaylist?: string[];
}): string[] {
  const list = getMusicPlaylist(settings);
  return list.length > 0 ? list : [DEFAULT_MUSIC_URL];
}

/** Human-friendly track name from a URL, without the upload timestamp/id prefix. */
export function getTrackDisplayName(url: string): string {
  const clean = url.split(/[?#]/)[0];
  const last = clean.split('/').filter(Boolean).pop() || clean;
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    // keep raw segment
  }
  name = name.replace(/^\d{10,}-[0-9a-f]{8}-/i, '');
  return name || url;
}
