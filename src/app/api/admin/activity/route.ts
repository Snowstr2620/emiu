import { NextResponse } from 'next/server';
import { requireAdminApiSession } from '@/lib/admin-guard';
import { computeTrafficSummary } from '@/lib/seed-data';
import { getStorageRepository } from '@/lib/storage';
import type { ActivityEventType } from '@/types/memories';

export async function GET(request: Request) {
  try {
    const repo = getStorageRepository();
    const auth = await requireAdminApiSession(request, repo);
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const rawEventType = searchParams.get('eventType')?.trim() || undefined;
    const rawUsername = searchParams.get('username')?.trim() || undefined;
    const rawSearch = searchParams.get('search')?.trim() || undefined;
    const rawLimit = searchParams.get('limit');
    const parsedLimit = rawLimit ? Number.parseInt(rawLimit, 10) : undefined;
    const limit =
      parsedLimit !== undefined && Number.isFinite(parsedLimit) ? parsedLimit : undefined;

    const [logs, recentLogs, users] = await Promise.all([
      repo.listActivityLogs({
        eventType: rawEventType as ActivityEventType | 'all' | undefined,
        username: rawUsername,
        search: rawSearch,
        limit,
      }),
      repo.listActivityLogs({ limit: 500 }),
      repo.listUsers(),
    ]);

    const trafficSummary = computeTrafficSummary(recentLogs, users);
    return NextResponse.json({ logs, trafficSummary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Không thể tải nhật ký hoạt động.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
