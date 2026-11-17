import { NextResponse } from 'next/server';
import { requireMemberApiSession } from '@/lib/member-guard';
import { getStorageRepository } from '@/lib/storage';
import { UploadKind, validateUploadRequest } from '@/lib/validation';

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireMemberApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = (await request.json().catch(() => null)) as {
      kind?: unknown;
      mimeType?: unknown;
      size?: unknown;
      fileName?: unknown;
    } | null;

    const kind: UploadKind | null =
      body?.kind === 'video' ? 'video' : body?.kind === 'image' ? 'image' : null;
    if (!kind) {
      return NextResponse.json(
        { error: 'Nhật ký mỗi ngày chỉ hỗ trợ tải lên tệp hình ảnh hoặc video.' },
        { status: 400 }
      );
    }

    const mimeType = typeof body?.mimeType === 'string' ? body.mimeType : '';
    const size = typeof body?.size === 'number' ? body.size : 0;
    const fileName = typeof body?.fileName === 'string' ? body.fileName : '';

    const check = validateUploadRequest({
      kind,
      mimeType,
      size,
      fileName,
    });
    if (!check.valid) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

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
            'Môi trường Vercel cần cấu hình NEXT_PUBLIC_SUPABASE_URL và SUPABASE_SERVICE_ROLE_KEY để tải ảnh trực tuyến.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      mode: 'local',
      uploadEndpoint: '/api/diary/upload',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể chuẩn bị tải ảnh nhật ký lên.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
