import type { MemoryImageItem, MemoryItem } from '@/types/memories';

export const MAX_ALBUM_IMAGES = 30;

export const VIDEO_FILE_EXTENSIONS = ['.mp4', '.webm', '.mov', '.m4v'] as const;

function stripQueryAndHash(raw: string): string {
  return raw.trim().split(/[?#]/)[0].trim().toLowerCase();
}

export function isVideoFileName(fileName: string): boolean {
  if (!fileName) return false;
  const clean = stripQueryAndHash(fileName);
  return VIDEO_FILE_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

export function isVideoMediaUrl(url: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('blob:')) return false;
  return isVideoFileName(trimmed);
}

export function isVideoFile(file: Pick<File, 'name' | 'type'>): boolean {
  const mime = (file.type || '').toLowerCase().split(';')[0].trim();
  if (mime.startsWith('video/')) return true;
  return isVideoFileName(file.name || '');
}

export function isVideoMediaItem(item: { url: string; mediaType?: 'image' | 'video' }): boolean {
  if (item.mediaType === 'video') return true;
  if (item.mediaType === 'image') return false;
  return isVideoMediaUrl(item.url);
}

export function formatAlbumMediaCountVi(
  items: ReadonlyArray<{ url: string; mediaType?: 'image' | 'video' }>
): string {
  const videoCount = items.filter(isVideoMediaItem).length;
  const imageCount = items.length - videoCount;
  if (videoCount === 0) return `${items.length} ảnh`;
  if (imageCount === 0) return `${videoCount} video`;
  return `${imageCount} ảnh · ${videoCount} video`;
}

/**
 * Normalizes a memory record's photo & video gallery into a non-empty ordered array
 * (falling back cleanly to legacy single `imageUrl` / `imageAlt` records).
 * Safe for both Server and Client Components (no Node imports).
 */
export function getMemoryImages(
  memory: Pick<MemoryItem, 'imageUrl' | 'imageAlt' | 'title' | 'images'>
): MemoryImageItem[] {
  const defaultAlt = (memory.title || 'Ảnh kỷ niệm').trim().slice(0, 160);

  if (Array.isArray(memory.images) && memory.images.length > 0) {
    const normalized: MemoryImageItem[] = [];
    for (const item of memory.images) {
      if (!item || typeof item.url !== 'string') continue;
      const url = item.url.trim();
      if (!url) continue;
      const alt = (typeof item.alt === 'string' ? item.alt.trim() : '') || defaultAlt;
      const isVideo = isVideoMediaItem(item);
      normalized.push(
        isVideo
          ? { url, alt: alt.slice(0, 160), mediaType: 'video' }
          : { url, alt: alt.slice(0, 160) }
      );
      if (normalized.length >= MAX_ALBUM_IMAGES) break;
    }
    if (normalized.length > 0) {
      return normalized;
    }
  }

  const coverUrl = typeof memory.imageUrl === 'string' ? memory.imageUrl.trim() : '';
  if (!coverUrl) return [];
  const coverAlt =
    (typeof memory.imageAlt === 'string' ? memory.imageAlt.trim() : '') || defaultAlt;
  return isVideoMediaUrl(coverUrl)
    ? [{ url: coverUrl, alt: coverAlt.slice(0, 160), mediaType: 'video' }]
    : [{ url: coverUrl, alt: coverAlt.slice(0, 160) }];
}
