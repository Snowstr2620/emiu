const COMPRESS_THRESHOLD_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
const MAX_DIMENSION_PX = 1920;

/**
 * Optimizes large static photos (JPEG, PNG, WebP) in the browser before upload
 * so mobile 4G viewers load memories swiftly. Leaves GIF and AVIF untouched so
 * animations and modern encodings are preserved.
 */
export async function compressImageIfNeeded(file: File): Promise<File> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  const compressible =
    file.type === 'image/jpeg' || file.type === 'image/png' || file.type === 'image/webp';
  if (!compressible || file.size <= COMPRESS_THRESHOLD_BYTES) {
    return file;
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Không thể đọc ảnh để tối ưu kích thước.'));
      image.src = objectUrl;
    });

    const { naturalWidth, naturalHeight } = img;
    if (!naturalWidth || !naturalHeight) return file;

    const scale = Math.min(1, MAX_DIMENSION_PX / Math.max(naturalWidth, naturalHeight));
    const targetWidth = Math.round(naturalWidth * scale);
    const targetHeight = Math.round(naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const outputMime = file.type === 'image/png' ? 'image/webp' : file.type;
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, outputMime, 0.85)
    );

    if (!blob || blob.size >= file.size) {
      return file;
    }

    const baseName = file.name.replace(/\.[^.]+$/, '');
    const ext = outputMime === 'image/webp' ? 'webp' : 'jpg';
    return new File([blob], `${baseName}.${ext}`, {
      type: outputMime,
      lastModified: Date.now(),
    });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
