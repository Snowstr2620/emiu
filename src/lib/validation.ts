import path from 'node:path';
import { parseIsoDateParts } from '@/lib/date-utils';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export const ALLOWED_AUDIO_MIMES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
]);

export const ALLOWED_IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.avif',
]);

export const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav']);

const FORBIDDEN_EXTENSIONS = new Set(['.svg', '.html', '.htm', '.js', '.mjs', '.php', '.exe']);

export type UploadKind = 'image' | 'audio';

export function validateUploadRequest(input: {
  kind: UploadKind;
  mimeType: string;
  size: number;
  fileName: string;
}): { valid: true } | { valid: false; error: string } {
  const { kind, size, fileName } = input;
  const normalizedMime = input.mimeType.toLowerCase().split(';')[0].trim();
  const ext = path.posix.extname(fileName.trim().toLowerCase());

  if (!Number.isFinite(size) || size <= 0) {
    return { valid: false, error: 'Tệp tải lên bị trống hoặc không hợp lệ.' };
  }

  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return { valid: false, error: 'Định dạng tệp này không được phép tải lên vì lý do bảo mật.' };
  }

  if (kind === 'image') {
    if (!ALLOWED_IMAGE_MIMES.has(normalizedMime) || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: 'Chỉ hỗ trợ ảnh định dạng JPG, PNG, WebP, GIF hoặc AVIF.',
      };
    }
    if (size > MAX_IMAGE_BYTES) {
      return {
        valid: false,
        error: 'Ảnh vượt quá giới hạn tối đa 10MB.',
      };
    }
    return { valid: true };
  }

  if (kind === 'audio') {
    if (!ALLOWED_AUDIO_MIMES.has(normalizedMime) || !ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: 'Chỉ hỗ trợ nhạc nền định dạng MP3, M4A hoặc WAV.',
      };
    }
    if (size > MAX_AUDIO_BYTES) {
      return {
        valid: false,
        error: 'Tệp nhạc vượt quá giới hạn tối đa 15MB.',
      };
    }
    return { valid: true };
  }

  return { valid: false, error: 'Loại tệp tải lên không hợp lệ.' };
}

export function sanitizeStorageFileName(fileName: string): string {
  const baseName = fileName.split(/[\\/]/).pop() || 'file';
  const rawExt = path.posix.extname(baseName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  const rawStem = path.posix.basename(baseName, path.posix.extname(baseName));

  const normalizedStem = rawStem
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  const safeStem = normalizedStem || 'memory';
  const safeExt = rawExt && rawExt.length <= 6 ? rawExt : '';
  return `${safeStem}${safeExt}`;
}

export function isValidMediaUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('/samples/')) {
    return !trimmed.includes('..');
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export interface ValidatedMemoryPayload {
  memoryDate: string;
  title: string;
  story: string;
  imageUrl: string;
  imageAlt: string;
}

export function validateMemoryPayload(
  raw: unknown
): { data: ValidatedMemoryPayload } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Dữ liệu kỷ niệm không hợp lệ.' };
  }

  const record = raw as Record<string, unknown>;
  const memoryDate = typeof record.memoryDate === 'string' ? record.memoryDate.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const story = typeof record.story === 'string' ? record.story.trim() : '';
  const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
  const imageAlt = typeof record.imageAlt === 'string' ? record.imageAlt.trim() : '';

  if (!parseIsoDateParts(memoryDate)) {
    return { error: 'Ngày kỷ niệm chưa đúng định dạng YYYY-MM-DD.' };
  }
  if (!story) {
    return { error: 'Vui lòng nhập đôi dòng câu chuyện kỷ niệm.' };
  }
  if (!isValidMediaUrl(imageUrl)) {
    return { error: 'Đường dẫn ảnh kỷ niệm không hợp lệ.' };
  }

  return {
    data: {
      memoryDate,
      title: title.slice(0, 120),
      story: story.slice(0, 1200),
      imageUrl,
      imageAlt: (imageAlt || title || 'Ảnh kỷ niệm').slice(0, 160),
    },
  };
}

export interface ValidatedSettingsPayload {
  coupleTitle: string;
  heroSubtitle: string;
  loveStartDate: string;
  musicUrl: string;
  musicEnabled: boolean;
  letterTitle: string;
  letterBody: string;
  letterSignature: string;
  viewerPasscodeEnabled: boolean;
  viewerPasscode?: string;
}

export function validateSettingsPayload(
  raw: unknown
): { data: ValidatedSettingsPayload } | { error: string } {
  if (!raw || typeof raw !== 'object') {
    return { error: 'Dữ liệu cài đặt không hợp lệ.' };
  }

  const r = raw as Record<string, unknown>;
  const coupleTitle = typeof r.coupleTitle === 'string' ? r.coupleTitle.trim() : '';
  const heroSubtitle = typeof r.heroSubtitle === 'string' ? r.heroSubtitle.trim() : '';
  const loveStartDate = typeof r.loveStartDate === 'string' ? r.loveStartDate.trim() : '';
  const musicUrl = typeof r.musicUrl === 'string' ? r.musicUrl.trim() : '';
  const musicEnabled = Boolean(r.musicEnabled);
  const letterTitle = typeof r.letterTitle === 'string' ? r.letterTitle.trim() : '';
  const letterBody = typeof r.letterBody === 'string' ? r.letterBody.trim() : '';
  const letterSignature = typeof r.letterSignature === 'string' ? r.letterSignature.trim() : '';
  const viewerPasscodeEnabled = Boolean(r.viewerPasscodeEnabled);
  const viewerPasscode = typeof r.viewerPasscode === 'string' ? r.viewerPasscode.trim() : undefined;

  if (!coupleTitle) {
    return { error: 'Vui lòng nhập tên hai bạn.' };
  }
  if (!parseIsoDateParts(loveStartDate)) {
    return { error: 'Ngày bắt đầu yêu chưa đúng định dạng YYYY-MM-DD.' };
  }
  if (musicUrl && !isValidMediaUrl(musicUrl)) {
    return { error: 'Đường dẫn nhạc nền không hợp lệ.' };
  }
  if (!letterTitle || !letterBody) {
    return { error: 'Vui lòng nhập tiêu đề và nội dung bức tâm thư.' };
  }
  if (viewerPasscode !== undefined && viewerPasscode.length > 0 && viewerPasscode.length < 3) {
    return { error: 'Mã kỷ niệm nên có ít nhất 3 ký tự.' };
  }

  return {
    data: {
      coupleTitle: coupleTitle.slice(0, 100),
      heroSubtitle: heroSubtitle.slice(0, 300),
      loveStartDate,
      musicUrl,
      musicEnabled,
      letterTitle: letterTitle.slice(0, 140),
      letterBody: letterBody.slice(0, 6000),
      letterSignature: letterSignature.slice(0, 120),
      viewerPasscodeEnabled,
      viewerPasscode: viewerPasscode && viewerPasscode.length > 0 ? viewerPasscode : undefined,
    },
  };
}
