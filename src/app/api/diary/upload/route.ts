import { NextResponse } from 'next/server';
import { requireMemberApiSession } from '@/lib/member-guard';
import { getStorageRepository } from '@/lib/storage';
import { validateUploadRequest } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireMemberApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const formData = await request.formData();
    const rawKind = formData.get('kind');
    const file = formData.get('file');

    const kind = rawKind === 'video' ? 'video' : rawKind === 'image' ? 'image' : null;
    if (!kind || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'Thiếu tệp hình ảnh/video hoặc loại tệp nhật ký không hợp lệ.' },
        { status: 400 }
      );
    }

    const check = validateUploadRequest({
      kind,
      mimeType: file.type || '',
      size: file.size,
      fileName: file.name || 'diary-media',
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
      fileName: file.name || 'diary-image',
      buffer,
    });

    return NextResponse.json(saved);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể lưu ảnh nhật ký lên máy chủ.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireMemberApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
    const url = typeof body?.url === 'string' ? body.url.trim() : '';
    if (!url) {
      return NextResponse.json({ error: 'Thiếu đường dẫn ảnh tạm cần dọn.' }, { status: 400 });
    }

    if (await repo.isMediaUrlReferenced(url)) {
      return NextResponse.json(
        { error: 'Không thể xoá tệp đang được sử dụng trong kỷ niệm hoặc nhật ký.' },
        { status: 403 }
      );
    }

    await repo.deleteStoredFileByUrl(url);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể dọn tệp ảnh tạm.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
