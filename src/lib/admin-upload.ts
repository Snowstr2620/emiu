import { compressImageIfNeeded } from '@/lib/image-compress';
import type { UploadKind } from '@/lib/validation';

interface SignedUploadResponse {
  mode: 'supabase';
  signedUrl: string;
  token: string;
  path: string;
  publicUrl: string;
}

interface LocalUploadResponse {
  mode: 'local';
  uploadEndpoint: string;
}

function inferMimeType(file: File): string {
  if (file.type?.trim()) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.avif')) return 'image/avif';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.wav')) return 'audio/wav';
  return '';
}

export async function uploadMediaFile(file: File, kind: UploadKind): Promise<string> {
  const processed = kind === 'image' ? await compressImageIfNeeded(file) : file;
  const mimeType = inferMimeType(processed);

  const prepRes = await fetch('/api/admin/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      kind,
      mimeType,
      size: processed.size,
      fileName: processed.name || 'upload',
    }),
  });

  const prepPayload = (await prepRes.json().catch(() => ({}))) as
    | SignedUploadResponse
    | LocalUploadResponse
    | { error?: string };

  if (!prepRes.ok) {
    const errMsg = 'error' in prepPayload ? prepPayload.error : undefined;
    throw new Error(errMsg || 'Không thể chuẩn bị tải tệp lên.');
  }

  if ('mode' in prepPayload && prepPayload.mode === 'supabase') {
    const putRes = await fetch(prepPayload.signedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        'cache-control': 'max-age=3600',
        'x-upsert': 'false',
      },
      body: processed,
    });

    if (!putRes.ok) {
      throw new Error('Tải tệp lên Supabase Storage thất bại. Vui lòng thử lại.');
    }

    return prepPayload.publicUrl;
  }

  if ('mode' in prepPayload && prepPayload.mode === 'local') {
    const formData = new FormData();
    formData.append('kind', kind);
    formData.append('file', processed);

    const localRes = await fetch(prepPayload.uploadEndpoint, {
      method: 'POST',
      body: formData,
    });

    const localPayload = (await localRes.json().catch(() => ({}))) as {
      publicUrl?: string;
      error?: string;
    };

    if (!localRes.ok || !localPayload.publicUrl) {
      throw new Error(localPayload.error || 'Không thể lưu tệp vào thư mục cục bộ.');
    }

    return localPayload.publicUrl;
  }

  throw new Error('Phản hồi máy chủ tải tệp không hợp lệ.');
}

export async function cleanupUploadedUrl(url: string): Promise<void> {
  if (!url) return;
  await fetch('/api/admin/upload', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  }).catch(() => undefined);
}
