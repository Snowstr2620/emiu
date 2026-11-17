/**
 * iPhone photos are often saved as HEIC/HEIF, which only Safari can render.
 * We convert them to JPEG in the browser before preview/upload so every
 * viewer (Chrome, Android, Windows) can see them and the server keeps
 * accepting only web-safe formats.
 */

const HEIC_MIMES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);
const HEIC_EXTENSIONS = ['.heic', '.heif'];

export const HEIC_CONVERT_ERROR_MESSAGE =
  'Không thể chuyển ảnh HEIC sang JPG. Vui lòng thử lại hoặc xuất ảnh sang JPG trước khi tải lên.';

export function isHeicFile(file: Pick<File, 'name' | 'type'>): boolean {
  const mime = (file.type || '').toLowerCase().split(';')[0].trim();
  if (HEIC_MIMES.has(mime)) return true;
  const name = (file.name || '').toLowerCase().trim();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

export async function convertHeicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import('heic-to/next');
  const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  const baseName = (file.name || 'photo').replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${baseName}.jpg`, {
    type: 'image/jpeg',
    lastModified: file.lastModified || Date.now(),
  });
}

/**
 * Converts every HEIC/HEIF file in the list to JPEG, leaving other files
 * untouched. Files that fail to convert are dropped and reported via `failed`.
 */
export async function convertHeicFiles(
  files: File[]
): Promise<{ files: File[]; failed: number }> {
  const results = await Promise.all(
    files.map(async (file) => {
      if (!isHeicFile(file)) return file;
      try {
        return await convertHeicToJpeg(file);
      } catch {
        return null;
      }
    })
  );
  const converted = results.filter((f): f is File => f !== null);
  return { files: converted, failed: results.length - converted.length };
}
