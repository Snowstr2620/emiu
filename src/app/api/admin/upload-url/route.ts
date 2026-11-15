import { NextResponse } from 'next/server';
import { isAdminRequestAuthenticated } from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { UploadKind, validateUploadRequest } from '@/lib/validation';

export async function POST(request: Request) {
  if (!(await isAdminRequestAuthenticated(request))) {
    return NextResponse.json({ error: 'Bạn cần đăng nhập quản trị.' }, { status: 401 });
  }
  try {
    const body = (await request.json().catch(() => null)) as {
      kind?: unknown;
      mimeType?: unknown;
      size?: unknown;
      fileName?: unknown;
    } | null;

    const kind = body?.kind === 'audio' ? 'audio' : body?.kind === 'image' ? 'image' : null;
    if (!kind) {
      return NextResponse.json({ error: 'Loại tệp tải lên không hợp lệ.' }, { status: 400 });
    }

    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
    const size = typeof body?.size === 'number' ? body.size : 0;
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';

    const check = validateUploadRequest({
      kind: kind as UploadKind,
      mimeType,
      size,
      fileName,
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    const repo = getStorageRepository();
    if (repo.createSignedUploadUrl) {
      const target = await repo.createSignedUploadUrl({
        kind,
        fileName,
        mimeType,
      });
      return NextResponse.json({ mode: 'supabase', ...target });
    }

    if (process.env.VERCEL) {
      return NextResponse.json(
        {
          error:
            'Môi trường Vercel cần cấu hình NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY để tải tệp trực tuyến.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      mode: 'local',
      uploadEndpoint: '/api/admin/upload',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể chuẩn bị tải tệp lên.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
