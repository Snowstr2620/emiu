import { NextResponse } from 'next/server';
import { summarizeUserAgent } from '@/lib/auth';
import { requireMemberApiSession } from '@/lib/member-guard';
import { getStorageRepository } from '@/lib/storage';
import { validateDiaryEntryPayload } from '@/lib/validation';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const repo = getStorageRepository();
    const auth = await requireMemberApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const existing = await repo.getDiaryEntryById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy trang nhật ký này.' }, { status: 404 });
    }

    if (auth.user.role !== 'admin' && existing.authorId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Bạn chỉ có thể chỉnh sửa hoặc xoá trang nhật ký của chính mình.' },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => null);
    const validated = validateDiaryEntryPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const updated = await repo.updateDiaryEntry(id, validated.data);
    if (!updated) {
      return NextResponse.json({ error: 'Không tìm thấy trang nhật ký này.' }, { status: 404 });
    }

    await repo
      .recordActivity({
        userId: auth.user.id,
        username: auth.user.username,
        userRole: auth.user.role,
        eventType: 'diary_saved',
        detail: `Cập nhật nhật ký ngày ${updated.entryDate}${updated.title ? `: ${updated.title}` : ''}`,
        deviceSummary: summarizeUserAgent(request.headers.get('user-agent')),
        metadata: {
          diaryId: updated.id,
          entryDate: updated.entryDate,
          hasImage: Boolean(updated.imageUrl),
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ entry: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể cập nhật trang nhật ký.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const repo = getStorageRepository();
    const auth = await requireMemberApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const { id } = await context.params;
    const existing = await repo.getDiaryEntryById(id);
    if (!existing) {
      return NextResponse.json({ error: 'Không tìm thấy trang nhật ký này.' }, { status: 404 });
    }

    if (auth.user.role !== 'admin' && existing.authorId !== auth.user.id) {
      return NextResponse.json(
        { error: 'Bạn chỉ có thể chỉnh sửa hoặc xoá trang nhật ký của chính mình.' },
        { status: 403 }
      );
    }

    const deleted = await repo.deleteDiaryEntry(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Không tìm thấy trang nhật ký này.' }, { status: 404 });
    }

    await repo
      .recordActivity({
        userId: auth.user.id,
        username: auth.user.username,
        userRole: auth.user.role,
        eventType: 'diary_deleted',
        detail: `Xoá nhật ký ngày ${existing.entryDate}${existing.title ? `: ${existing.title}` : ''}`,
        deviceSummary: summarizeUserAgent(request.headers.get('user-agent')),
        metadata: {
          diaryId: existing.id,
          entryDate: existing.entryDate,
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể xoá trang nhật ký.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
