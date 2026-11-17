import path from 'node:path';
import { parseIsoDateParts } from '@/lib/date-utils';
import { isVideoMediaUrl, MAX_ALBUM_IMAGES } from '@/lib/memory-album';
import { MAX_MUSIC_TRACKS, normalizePlaylist } from '@/lib/music-playlist';
import type { ActivityEventType, DiaryMood, MemoryImageItem, UserRole } from '@/types/memories';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
export const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_MEMORY_STORY_LENGTH = 6000;

export const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

export const ALLOWED_VIDEO_MIMES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
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

export const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);

export const ALLOWED_AUDIO_EXTENSIONS = new Set(['.mp3', '.m4a', '.wav']);

const FORBIDDEN_EXTENSIONS = new Set(['.svg', '.html', '.htm', '.js', '.mjs', '.php', '.exe']);

export type UploadKind = 'image' | 'video' | 'audio';

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

  if (kind === 'video') {
    if (!ALLOWED_VIDEO_MIMES.has(normalizedMime) || !ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
      return {
        valid: false,
        error: 'Chỉ hỗ trợ video định dạng MP4, WebM, MOV hoặc M4V.',
      };
    }
    if (size > MAX_VIDEO_BYTES) {
      return {
        valid: false,
        error: 'Video vượt quá giới hạn tối đa 100MB.',
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
  images: MemoryImageItem[];
}

export function validateMemoryPayload(
  raw: unknown
): { data: ValidatedMemoryPayload } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Dữ liệu kỷ niệm không hợp lệ.' };
  }

  const record = raw as Record<string, unknown>;
  const memoryDate = typeof record.memoryDate === 'string' ? record.memoryDate.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim().slice(0, 120) : '';
  const story = typeof record.story === 'string' ? record.story.trim() : '';
  const fallbackImageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
  const fallbackImageAlt = typeof record.imageAlt === 'string' ? record.imageAlt.trim() : '';

  if (!parseIsoDateParts(memoryDate)) {
    return { error: 'Ngày kỷ niệm chưa đúng định dạng YYYY-MM-DD.' };
  }
  if (!story) {
    return { error: 'Vui lòng nhập đôi dòng câu chuyện kỷ niệm.' };
  }

  const defaultAlt = (title || 'Ảnh kỷ niệm').slice(0, 160);
  let normalizedImages: MemoryImageItem[] = [];

  if (record.images !== undefined) {
    if (!Array.isArray(record.images) || record.images.length === 0) {
      return { error: 'Album kỷ niệm cần ít nhất 1 bức ảnh.' };
    }
    if (record.images.length > MAX_ALBUM_IMAGES) {
      return { error: `Mỗi album kỷ niệm hỗ trợ tối đa ${MAX_ALBUM_IMAGES} ảnh.` };
    }
    for (const rawItem of record.images) {
      if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
        return { error: 'Dữ liệu ảnh trong album không hợp lệ.' };
      }
      const itemRec = rawItem as Record<string, unknown>;
      const url = typeof itemRec.url === 'string' ? itemRec.url.trim() : '';
      const alt = typeof itemRec.alt === 'string' ? itemRec.alt.trim() : '';
      if (
        itemRec.mediaType !== undefined &&
        itemRec.mediaType !== 'image' &&
        itemRec.mediaType !== 'video'
      ) {
        return { error: 'Loại tệp trong album không hợp lệ.' };
      }
      if (!isValidMediaUrl(url)) {
        return { error: 'Có đường dẫn ảnh trong album không hợp lệ.' };
      }
      const isVideo =
        itemRec.mediaType === 'video' || (itemRec.mediaType !== 'image' && isVideoMediaUrl(url));
      const resolvedAlt = (alt || defaultAlt).slice(0, 160);
      normalizedImages.push(
        isVideo ? { url, alt: resolvedAlt, mediaType: 'video' } : { url, alt: resolvedAlt }
      );
    }
  } else {
    if (!isValidMediaUrl(fallbackImageUrl)) {
      return { error: 'Đường dẫn ảnh kỷ niệm không hợp lệ.' };
    }
    const resolvedAlt = (fallbackImageAlt || defaultAlt).slice(0, 160);
    normalizedImages = [
      isVideoMediaUrl(fallbackImageUrl)
        ? { url: fallbackImageUrl, alt: resolvedAlt, mediaType: 'video' }
        : { url: fallbackImageUrl, alt: resolvedAlt },
    ];
  }

  return {
    data: {
      memoryDate,
      title,
      story: story.slice(0, MAX_MEMORY_STORY_LENGTH),
      imageUrl: normalizedImages[0].url,
      imageAlt: normalizedImages[0].alt,
      images: normalizedImages,
    },
  };
}

export const DIARY_MOODS = new Set<DiaryMood>([
  'loved',
  'happy',
  'peaceful',
  'miss_you',
  'grateful',
  'excited',
  'tired',
]);

export interface ValidatedDiaryEntryPayload {
  entryDate: string;
  title: string;
  content: string;
  mood: DiaryMood;
  imageUrl: string;
  imageAlt: string;
}

export function validateDiaryEntryPayload(
  raw: unknown
): { data: ValidatedDiaryEntryPayload } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Dữ liệu nhật ký không hợp lệ.' };
  }

  const record = raw as Record<string, unknown>;
  const entryDate = typeof record.entryDate === 'string' ? record.entryDate.trim() : '';
  const title = typeof record.title === 'string' ? record.title.trim() : '';
  const content = typeof record.content === 'string' ? record.content.trim() : '';
  const rawMood =
    record.mood === undefined || record.mood === ''
      ? 'loved'
      : typeof record.mood === 'string'
        ? record.mood.trim()
        : '';
  const imageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : '';
  const imageAlt = typeof record.imageAlt === 'string' ? record.imageAlt.trim() : '';

  if (!parseIsoDateParts(entryDate)) {
    return { error: 'Ngày viết nhật ký chưa đúng định dạng YYYY-MM-DD.' };
  }
  if (!content) {
    return { error: 'Vui lòng viết đôi dòng nhật ký cho ngày hôm nay.' };
  }
  if (!DIARY_MOODS.has(rawMood as DiaryMood)) {
    return { error: 'Tâm trạng nhật ký không hợp lệ.' };
  }
  if (imageUrl && !isValidMediaUrl(imageUrl)) {
    return { error: 'Đường dẫn ảnh đính kèm không hợp lệ.' };
  }

  return {
    data: {
      entryDate,
      title: title.slice(0, 120),
      content: content.slice(0, 4000),
      mood: rawMood as DiaryMood,
      imageUrl,
      imageAlt: imageUrl ? (imageAlt || title || 'Ảnh nhật ký ngày hôm nay').slice(0, 160) : '',
    },
  };
}

export interface ValidatedSettingsPayload {
  coupleTitle: string;
  heroSubtitle: string;
  loveStartDate: string;
  musicUrl: string;
  musicPlaylist: string[];
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
  if (r.musicPlaylist !== undefined && !Array.isArray(r.musicPlaylist)) {
    return { error: 'Danh sách nhạc nền không hợp lệ.' };
  }
  const musicPlaylist =
    r.musicPlaylist !== undefined ? normalizePlaylist(r.musicPlaylist) : musicUrl ? [musicUrl] : [];
  if (musicPlaylist.length > MAX_MUSIC_TRACKS) {
    return { error: `Danh sách nhạc nền tối đa ${MAX_MUSIC_TRACKS} bài.` };
  }
  if (musicPlaylist.some((url) => !isValidMediaUrl(url))) {
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
      musicUrl: musicPlaylist[0] ?? musicUrl,
      musicPlaylist,
      musicEnabled,
      letterTitle: letterTitle.slice(0, 140),
      letterBody: letterBody.slice(0, 6000),
      letterSignature: letterSignature.slice(0, 120),
      viewerPasscodeEnabled,
      viewerPasscode: viewerPasscode && viewerPasscode.length > 0 ? viewerPasscode : undefined,
    },
  };
}

const USERNAME_REGEX = /^[a-z0-9._-]{3,32}$/;
const OTP_REGEX = /^\d{6}$/;

function parseRole(rawRole: unknown): UserRole | null {
  if (rawRole === 'admin' || rawRole === 'viewer') return rawRole;
  return null;
}

export interface ValidatedUserLoginPayload {
  username: string;
  password: string;
}

export function validateUserLoginPayload(
  raw: unknown,
  options?: { defaultUsername?: string }
): { data: ValidatedUserLoginPayload } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Dữ liệu đăng nhập không hợp lệ.' };
  }

  const r = raw as Record<string, unknown>;
  if (r.username !== undefined && typeof r.username !== 'string') {
    return { error: 'Tên đăng nhập không hợp lệ.' };
  }
  const rawUsername = typeof r.username === 'string' ? r.username.trim().toLowerCase() : '';
  const username =
    !rawUsername && options?.defaultUsername
      ? options.defaultUsername.trim().toLowerCase()
      : rawUsername;
  const password = typeof r.password === 'string' ? r.password : '';

  if (!USERNAME_REGEX.test(username)) {
    return { error: 'Tên đăng nhập gồm 3–32 ký tự chữ thường, số hoặc dấu . _ -.' };
  }
  if (!password.trim() || password.length < 4 || password.length > 128) {
    return { error: 'Mật khẩu cần từ 4 đến 128 ký tự.' };
  }

  return { data: { username, password } };
}

export interface ValidatedOtpVerifyPayload {
  otp: string;
}

export function validateOtpVerifyPayload(
  raw: unknown
): { data: ValidatedOtpVerifyPayload } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Dữ liệu xác thực OTP không hợp lệ.' };
  }
  const r = raw as Record<string, unknown>;
  const otp = typeof r.otp === 'string' ? r.otp.trim() : '';

  if (!OTP_REGEX.test(otp)) {
    return { error: 'Mã OTP phải gồm đúng 6 chữ số.' };
  }

  return { data: { otp } };
}

export interface ValidatedCreateUserPayload {
  username: string;
  displayName: string;
  role: UserRole;
  password: string;
  otpCode: string;
  otpHint: string;
  isActive: boolean;
}

export function validateCreateUserPayload(
  raw: unknown
): { data: ValidatedCreateUserPayload } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Dữ liệu tài khoản không hợp lệ.' };
  }
  const r = raw as Record<string, unknown>;
  const username = typeof r.username === 'string' ? r.username.trim().toLowerCase() : '';
  const displayName = typeof r.displayName === 'string' ? r.displayName.trim() : '';
  const role = parseRole(r.role);
  const password = typeof r.password === 'string' ? r.password : '';
  const otpCode = typeof r.otpCode === 'string' ? r.otpCode.trim() : '';
  const otpHint = typeof r.otpHint === 'string' ? r.otpHint.trim() : '';
  if (r.isActive !== undefined && typeof r.isActive !== 'boolean') {
    return { error: 'Trạng thái hoạt động không hợp lệ.' };
  }
  const isActive = r.isActive ?? true;

  if (!USERNAME_REGEX.test(username)) {
    return { error: 'Tên đăng nhập gồm 3–32 ký tự chữ thường, số hoặc dấu . _ -.' };
  }
  if (username === 'khach') {
    return { error: 'Tên tài khoản "khach" được hệ thống dành riêng cho khách ghé trang.' };
  }
  if (!displayName || displayName.length > 60) {
    return { error: 'Tên hiển thị cần từ 1 đến 60 ký tự.' };
  }
  if (!role) {
    return { error: 'Vai trò tài khoản không hợp lệ.' };
  }
  if (!password.trim() || password.length < 6 || password.length > 128) {
    return { error: 'Mật khẩu mới cần từ 6 đến 128 ký tự.' };
  }
  if (!OTP_REGEX.test(otpCode)) {
    return { error: 'Mã OTP phải gồm đúng 6 chữ số.' };
  }

  return {
    data: {
      username,
      displayName,
      role,
      password,
      otpCode,
      otpHint: otpHint.slice(0, 120),
      isActive,
    },
  };
}

export interface ValidatedUpdateUserPayload {
  displayName?: string;
  role?: UserRole;
  password?: string;
  otpCode?: string;
  otpHint?: string;
  isActive?: boolean;
  revokeSession?: boolean;
}

export function validateUpdateUserPayload(
  raw: unknown
): { data: ValidatedUpdateUserPayload } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Dữ liệu cập nhật tài khoản không hợp lệ.' };
  }
  const r = raw as Record<string, unknown>;
  const data: ValidatedUpdateUserPayload = {};

  if (r.displayName !== undefined) {
    if (typeof r.displayName !== 'string') {
      return { error: 'Tên hiển thị không hợp lệ.' };
    }
    const displayName = r.displayName.trim();
    if (!displayName || displayName.length > 60) {
      return { error: 'Tên hiển thị cần từ 1 đến 60 ký tự.' };
    }
    data.displayName = displayName;
  }

  if (r.role !== undefined) {
    const role = parseRole(r.role);
    if (!role) {
      return { error: 'Vai trò tài khoản không hợp lệ.' };
    }
    data.role = role;
  }

  if (r.password !== undefined) {
    if (typeof r.password !== 'string') {
      return { error: 'Mật khẩu không hợp lệ.' };
    }
    if (r.password.length > 0) {
      if (!r.password.trim() || r.password.length < 6 || r.password.length > 128) {
        return { error: 'Mật khẩu mới cần từ 6 đến 128 ký tự.' };
      }
      data.password = r.password;
    }
  }

  if (r.otpCode !== undefined) {
    if (typeof r.otpCode !== 'string') {
      return { error: 'Mã OTP không hợp lệ.' };
    }
    const otpCode = r.otpCode.trim();
    if (otpCode.length > 0) {
      if (!OTP_REGEX.test(otpCode)) {
        return { error: 'Mã OTP phải gồm đúng 6 chữ số.' };
      }
      data.otpCode = otpCode;
    }
  }

  if (r.otpHint !== undefined) {
    if (typeof r.otpHint !== 'string') {
      return { error: 'Gợi ý OTP không hợp lệ.' };
    }
    data.otpHint = r.otpHint.trim().slice(0, 120);
  }

  if (r.isActive !== undefined) {
    if (typeof r.isActive !== 'boolean') {
      return { error: 'Trạng thái hoạt động không hợp lệ.' };
    }
    data.isActive = r.isActive;
  }

  if (r.revokeSession !== undefined) {
    if (typeof r.revokeSession !== 'boolean') {
      return { error: 'Tham số thu hồi phiên không hợp lệ.' };
    }
    data.revokeSession = r.revokeSession;
  }

  return { data };
}

export type ClientActivityEventType =
  | 'page_visit'
  | 'page_leave'
  | 'pixel_heart_viewed'
  | 'music_toggled'
  | 'memory_viewed'
  | 'letter_opened';

export const ALLOWED_CLIENT_ACTIVITY_EVENTS = new Set<ActivityEventType>([
  'page_visit',
  'page_leave',
  'pixel_heart_viewed',
  'music_toggled',
  'memory_viewed',
  'letter_opened',
]);

export interface ValidatedClientActivityPayload {
  eventType: ClientActivityEventType;
  detail: string;
  metadata: Record<string, string | number | boolean> | null;
}

const FORBIDDEN_METADATA_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function validateClientActivityPayload(
  raw: unknown
): { data: ValidatedClientActivityPayload } | { error: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Dữ liệu nhật ký hoạt động không hợp lệ.' };
  }
  const r = raw as Record<string, unknown>;
  const eventType = typeof r.eventType === 'string' ? r.eventType.trim() : '';

  if (!ALLOWED_CLIENT_ACTIVITY_EVENTS.has(eventType as ActivityEventType)) {
    return { error: 'Loại sự kiện hoạt động không được phép.' };
  }

  const detail = typeof r.detail === 'string' ? r.detail.trim().slice(0, 160) : '';

  let metadata: Record<string, string | number | boolean> | null = null;
  if (r.metadata && typeof r.metadata === 'object' && !Array.isArray(r.metadata)) {
    const clean: Record<string, string | number | boolean> = {};
    let count = 0;
    for (const [rawKey, rawVal] of Object.entries(r.metadata)) {
      if (count >= 6) break;
      const key = rawKey.trim().slice(0, 40);
      if (!key || FORBIDDEN_METADATA_KEYS.has(key)) continue;

      if (typeof rawVal === 'string') {
        clean[key] = rawVal.trim().slice(0, 80);
        count++;
      } else if (typeof rawVal === 'number' && Number.isFinite(rawVal)) {
        clean[key] = rawVal;
        count++;
      } else if (typeof rawVal === 'boolean') {
        clean[key] = rawVal;
        count++;
      }
    }
    if (count > 0) {
      metadata = clean;
    }
  }

  return {
    data: {
      eventType: eventType as ClientActivityEventType,
      detail,
      metadata,
    },
  };
}
