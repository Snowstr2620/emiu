import type { DragEvent, MutableRefObject } from 'react';
import { isVideoFile } from '@/lib/memory-album';

export interface ClientFileValidationRule {
  allowedExtensions: Set<string>;
  allowedMimes: Set<string>;
  compressibleMimes?: Set<string>;
  maxBytes: number;
  invalidTypeMessage: string;
  tooLargeMessage: string;
}

export const VISUAL_MEDIA_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime,video/x-m4v,.mov,.m4v';

export const VISUAL_MEDIA_INVALID_TYPE_MESSAGE =
  'Chỉ hỗ trợ ảnh (JPG, PNG, WebP, GIF, AVIF) hoặc video (MP4, WebM, MOV, M4V).';

export const CLIENT_IMAGE_RULE: ClientFileValidationRule = {
  allowedExtensions: new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']),
  allowedMimes: new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']),
  compressibleMimes: new Set(['image/jpeg', 'image/png', 'image/webp']),
  maxBytes: 10 * 1024 * 1024,
  invalidTypeMessage: 'Chỉ hỗ trợ ảnh định dạng JPG, PNG, WebP, GIF hoặc AVIF.',
  tooLargeMessage: 'Ảnh vượt quá giới hạn tối đa 10MB.',
};

export const CLIENT_VIDEO_RULE: ClientFileValidationRule = {
  allowedExtensions: new Set(['.mp4', '.webm', '.mov', '.m4v']),
  allowedMimes: new Set(['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']),
  maxBytes: 100 * 1024 * 1024,
  invalidTypeMessage: 'Chỉ hỗ trợ video định dạng MP4, WebM, MOV hoặc M4V.',
  tooLargeMessage: 'Video vượt quá giới hạn tối đa 100MB.',
};

export const CLIENT_AUDIO_RULE: ClientFileValidationRule = {
  allowedExtensions: new Set(['.mp3', '.m4a', '.wav']),
  allowedMimes: new Set([
    'audio/mpeg',
    'audio/mp3',
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/wav',
    'audio/x-wav',
  ]),
  maxBytes: 15 * 1024 * 1024,
  invalidTypeMessage: 'Chỉ hỗ trợ nhạc nền định dạng MP3, M4A hoặc WAV.',
  tooLargeMessage: 'Tệp nhạc vượt quá giới hạn tối đa 15MB.',
};

function getClientFileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const dotIdx = trimmed.lastIndexOf('.');
  return dotIdx >= 0 ? trimmed.slice(dotIdx).toLowerCase() : '';
}

export function validateClientUploadFile(
  file: File,
  rule: ClientFileValidationRule
): string | null {
  if (!file || file.size <= 0) {
    return 'Tệp tải lên bị trống hoặc không hợp lệ.';
  }
  const mime = file.type.toLowerCase().split(';')[0].trim();
  const ext = getClientFileExtension(file.name);
  const validType = mime
    ? rule.allowedMimes.has(mime) && (!ext || rule.allowedExtensions.has(ext))
    : rule.allowedExtensions.has(ext);
  if (!validType) {
    return rule.invalidTypeMessage;
  }
  if (!rule.compressibleMimes?.has(mime) && file.size > rule.maxBytes) {
    return rule.tooLargeMessage;
  }
  return null;
}

export function validateClientVisualMediaFile(file: File): string | null {
  if (!file || file.size <= 0) {
    return 'Tệp tải lên bị trống hoặc không hợp lệ.';
  }
  if (isVideoFile(file)) {
    const err = validateClientUploadFile(file, CLIENT_VIDEO_RULE);
    if (err === CLIENT_VIDEO_RULE.invalidTypeMessage) {
      return VISUAL_MEDIA_INVALID_TYPE_MESSAGE;
    }
    return err;
  }
  const err = validateClientUploadFile(file, CLIENT_IMAGE_RULE);
  if (err === CLIENT_IMAGE_RULE.invalidTypeMessage) {
    return VISUAL_MEDIA_INVALID_TYPE_MESSAGE;
  }
  return err;
}

export function getDroppedOrPastedFiles(
  files?: FileList | File[] | null,
  items?: DataTransferItemList | null
): File[] {
  if (files && files.length > 0) {
    return Array.from(files).filter((f): f is File => Boolean(f));
  }
  const extracted: File[] = [];
  if (items) {
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const f = items[i].getAsFile();
        if (f) extracted.push(f);
      }
    }
  }
  return extracted;
}

export function getDroppedOrPastedFile(
  files?: FileList | null,
  items?: DataTransferItemList | null
): File | null {
  return getDroppedOrPastedFiles(files, items)[0] ?? null;
}

function createSharedDropHandlers<K extends string>(
  dragDepthRef: MutableRefObject<Record<K, number>>,
  zoneKey: K,
  setDragging: (active: boolean) => void,
  onFiles: (files: File[]) => void
) {
  return {
    onDragEnter: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current[zoneKey] = (dragDepthRef.current[zoneKey] ?? 0) + 1;
      setDragging(true);
    },
    onDragOver: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      setDragging(true);
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const nextDepth = Math.max(0, (dragDepthRef.current[zoneKey] ?? 0) - 1);
      dragDepthRef.current[zoneKey] = nextDepth;
      const leftOutside =
        e.relatedTarget === null ||
        (typeof Node !== 'undefined' &&
          e.relatedTarget instanceof Node &&
          !e.currentTarget.contains(e.relatedTarget));
      if (leftOutside || nextDepth === 0) {
        dragDepthRef.current[zoneKey] = 0;
        setDragging(false);
      }
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current[zoneKey] = 0;
      setDragging(false);
      const files = getDroppedOrPastedFiles(e.dataTransfer?.files, e.dataTransfer?.items);
      if (files.length > 0) {
        onFiles(files);
      }
    },
  };
}

export function createManagedMultiDropHandlers<K extends string>(
  dragDepthRef: MutableRefObject<Record<K, number>>,
  zoneKey: K,
  setDragging: (active: boolean) => void,
  onFiles: (files: File[]) => void
) {
  return createSharedDropHandlers(dragDepthRef, zoneKey, setDragging, onFiles);
}

export function createManagedDropHandlers<K extends string>(
  dragDepthRef: MutableRefObject<Record<K, number>>,
  zoneKey: K,
  setDragging: (active: boolean) => void,
  onFile: (file: File) => void
) {
  return createSharedDropHandlers(dragDepthRef, zoneKey, setDragging, (files) => {
    if (files[0]) onFile(files[0]);
  });
}
