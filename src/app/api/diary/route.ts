import { NextResponse } from 'next/server';
import { summarizeUserAgent } from '@/lib/auth';
import { requireMemberApiSession } from '@/lib/member-guard';
import { getStorageRepository } from '@/lib/storage';
import { validateDiaryEntryPayload } from '@/lib/validation';

export async function GET(request: Request) {
  try {
    const repo = getStorageRepository();
    const { settings, diaryEntries } = await repo.getPublicData();

    if (settings.viewerPasscodeEnabled) {
      const auth = await requireMemberApiSession(request, repo);
      if (!auth.ok) return auth.response;
    }

    return NextResponse.json({ entries: diaryEntries ?? [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tải nhật ký lúc này.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireMemberApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => null);
    const validated = validateDiaryEntryPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const entry = await repo.createDiaryEntry({
      ...validated.data,
      authorId: auth.user.id,
      authorUsername: auth.user.username,
      authorDisplayName: auth.user.displayName,
      authorRole: auth.user.role,
    });

    await repo
      .recordActivity({
        userId: auth.user.id,
        username: auth.user.username,
        userRole: auth.user.role,
        eventType: 'diary_saved',
        detail: `Viết nhật ký ngày ${entry.entryDate}${entry.title ? `: ${entry.title}` : ''}`,
        deviceSummary: summarizeUserAgent(request.headers.get('user-agent')),
        metadata: {
          diaryId: entry.id,
          entryDate: entry.entryDate,
          hasImage: Boolean(entry.imageUrl),
        },
      })
      .catch(() => undefined);

    return NextResponse.json({ entry }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể lưu nhật ký mới.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
