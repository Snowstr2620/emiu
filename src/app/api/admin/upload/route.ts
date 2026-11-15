import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import { getStorageRepository } from '@/lib/storage';
import { UploadKind, validateUploadRequest } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const rawKind = formData.get('kind');
    const file = formData.get('file');

    const kind: UploadKind | null =
      rawKind === 'audio' ? 'audio' : rawKind === 'image' ? 'image' : null;

    if (!kind || !(file instanceof File)) {
      return NextResponse.json({ error: 'Thiếu tệp hoặc loại tệp không hợp lệ.' }, { status: 400 });
    }

    const check = validateUploadRequest({
      kind,
      mimeType: file.type || '',
      size: file.size,
      fileName: file.name || 'upload',
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    if (!repo.saveLocalUpload) {
      return NextResponse.json(
        { error: 'Chế độ đám mây sử dụng Signed Upload URL thay cho endpoint cục bộ.' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const saved = await repo.saveLocalUpload({
      fileName: file.name || 'upload',
      buffer,
    });

    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể lưu tệp tải lên.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'Thiếu đường dẫn tệp cần dọn.' }, { status: 400 });
    }

    await repo.deleteStoredFileByUrl(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể xoá tệp.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
