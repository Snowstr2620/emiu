import { NextResponse } from 'next/server';
import {
  GUEST_COOLDOWN_COOKIE_NAME,
  GUEST_COOLDOWN_TTL_SECONDS,
  type GuestCooldownTokenPayload,
  parseCookieFromHeader,
  setCookieOnResponse,
  signSessionPayload,
  summarizeUserAgent,
  verifySessionPayload,
  verifyViewerTokenWithRepo,
  VIEWER_UNLOCKED_COOKIE_NAME,
} from '@/lib/auth';
import { getStorageRepository } from '@/lib/storage';
import { type ClientActivityEventType, validateClientActivityPayload } from '@/lib/validation';

const DEFAULT_EVENT_DETAILS: Record<ClientActivityEventType, string> = {
  page_visit: 'Mở trang kỷ niệm',
  page_leave: 'Rời khỏi trang kỷ niệm',
  pixel_heart_viewed: 'Ngắm xong trái tim pixel',
  music_toggled: 'Chuyển trạng thái nhạc nền',
  memory_viewed: 'Xem ảnh kỷ niệm',
  letter_opened: 'Chạm mở phong thư tâm sự',
};

export async function POST(request: Request) {
  try {
    const rawText = await request.text().catch(() => '');
    let body: unknown = null;
    if (rawText) {
      try {
        body = JSON.parse(rawText);
      } catch {
        body = null;
      }
    }

    const validated = validateClientActivityPayload(body);
    if ('error' in validated) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const { eventType, detail, metadata } = validated.data;
    const repo = getStorageRepository();
    const unlockedToken = parseCookieFromHeader(
      request.headers.get('cookie'),
      VIEWER_UNLOCKED_COOKIE_NAME
    );
    const unlockedUser = await verifyViewerTokenWithRepo(unlockedToken, 'viewer_unlocked', repo);
    const deviceSummary = summarizeUserAgent(request.headers.get('user-agent'));

    if (unlockedUser) {
      await repo.recordActivity({
        userId: unlockedUser.id,
        username: unlockedUser.username,
        userRole: unlockedUser.role,
        eventType,
        detail: detail || DEFAULT_EVENT_DETAILS[eventType],
        deviceSummary,
        metadata,
      });
      return NextResponse.json({ ok: true });
    }

    const { settings } = await repo.getPublicData();
    if (settings.viewerPasscodeEnabled && eventType !== 'page_visit' && eventType !== 'page_leave') {
      return NextResponse.json(
        { error: 'Vui lòng mở khoá trang trước khi ghi nhận thao tác này.' },
        { status: 401 }
      );
    }

    if (eventType === 'page_visit' || eventType === 'page_leave') {
      const cooldownRaw = parseCookieFromHeader(
        request.headers.get('cookie'),
        GUEST_COOLDOWN_COOKIE_NAME
      );
      const cooldown = verifySessionPayload<GuestCooldownTokenPayload>(
        cooldownRaw,
        'guest_cooldown'
      );

      if (eventType === 'page_visit') {
        if (cooldown?.visitLogged) {
          return NextResponse.json({ ok: true, deduped: true });
        }

        await repo.recordActivity({
          userId: null,
          username: 'khach',
          userRole: 'guest',
          eventType: 'page_visit',
          detail: detail || 'Khách ghé thăm trang kỷ niệm',
          deviceSummary,
          metadata,
        });

        const token = signSessionPayload<GuestCooldownTokenPayload>(
          {
            typ: 'guest_cooldown',
            visitLogged: true,
            leaveLogged: false,
            exp: 0,
          },
          GUEST_COOLDOWN_TTL_SECONDS
        );

        const response = NextResponse.json({ ok: true });
        setCookieOnResponse(
          response,
          GUEST_COOLDOWN_COOKIE_NAME,
          token,
          GUEST_COOLDOWN_TTL_SECONDS,
          request
        );
        return response;
      }

      if (!cooldown || !cooldown.visitLogged || cooldown.leaveLogged) {
        return NextResponse.json({ ok: true, deduped: true });
      }

      await repo.recordActivity({
        userId: null,
        username: 'khach',
        userRole: 'guest',
        eventType: 'page_leave',
        detail: detail || 'Khách rời khỏi trang kỷ niệm',
        deviceSummary,
        metadata,
      });

      const remainingTtl = Math.max(1, cooldown.exp - Math.floor(Date.now() / 1000));
      const updatedToken = signSessionPayload<GuestCooldownTokenPayload>({
        typ: 'guest_cooldown',
        visitLogged: true,
        leaveLogged: true,
        exp: cooldown.exp,
      });

      const response = NextResponse.json({ ok: true });
      setCookieOnResponse(
        response,
        GUEST_COOLDOWN_COOKIE_NAME,
        updatedToken,
        remainingTtl,
        request
      );
      return response;
    }

    await repo.recordActivity({
      userId: null,
      username: 'khach',
      userRole: 'guest',
      eventType,
      detail: detail || DEFAULT_EVENT_DETAILS[eventType],
      deviceSummary,
      metadata,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Không thể ghi nhận hoạt động lúc này.' }, { status: 500 });
  }
}
