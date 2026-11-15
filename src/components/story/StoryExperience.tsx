'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { Heart, LogOut, ShieldCheck, Sparkles, X } from 'lucide-react';
import { AudioToggle } from '@/components/story/AudioToggle';
import { EnvelopeLetter } from '@/components/story/EnvelopeLetter';
import { HeroSection } from '@/components/story/HeroSection';
import { LoveEffectsLayer } from '@/components/story/LoveEffectsLayer';
import { MemoryTimeline } from '@/components/story/MemoryTimeline';
import { PhotoLightbox } from '@/components/story/PhotoLightbox';
import { PixelHeartIntro } from '@/components/story/PixelHeartIntro';
import { calculateDaysTogether } from '@/lib/date-utils';
import type { ActivityEventType, PublicSiteData, SafeAppUser } from '@/types/memories';

interface StoryExperienceProps {
  data: PublicSiteData;
  currentUser?: SafeAppUser | null;
  viewerPasscodeEnabled?: boolean;
}

function postClientActivity(
  eventType: Extract<
    ActivityEventType,
    'page_visit' | 'pixel_heart_viewed' | 'music_toggled' | 'memory_viewed' | 'letter_opened'
  >,
  detail: string,
  metadata?: Record<string, string | number | boolean>,
  onUnauthorized?: () => void
): void {
  try {
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, detail, metadata }),
      keepalive: true,
    })
      .then((res) => {
        if (res.status === 401) {
          onUnauthorized?.();
        }
      })
      .catch(() => {});
  } catch {
    // Never interrupt story experience if telemetry fails
  }
}

function sendLeaveBeacon(): void {
  const payload = JSON.stringify({
    eventType: 'page_leave',
    detail: 'Rời khỏi miền ký ức yêu thương',
  });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/activity', new Blob([payload], { type: 'application/json' }));
      return;
    }
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignore unload telemetry failures
  }
}

export function StoryExperience({
  data,
  currentUser = null,
  viewerPasscodeEnabled = false,
}: StoryExperienceProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const { settings, memories } = data;
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showHeartModal, setShowHeartModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const hasSentLeaveRef = useRef(false);
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const daysTogether = calculateDaysTogether(settings.loveStartDate);
  const currentUserId = currentUser?.id ?? null;
  const visitStorageKey = `ny_visit_logged:${currentUserId ?? 'guest'}`;

  const trackActivity = useCallback(
    (
      eventType: Extract<
        ActivityEventType,
        'page_visit' | 'pixel_heart_viewed' | 'music_toggled' | 'memory_viewed' | 'letter_opened'
      >,
      detail: string,
      metadata?: Record<string, string | number | boolean>
    ) => {
      postClientActivity(eventType, detail, metadata, () => {
        routerRef.current.refresh();
      });
    },
    []
  );

  useEffect(() => {
    hasSentLeaveRef.current = false;

    try {
      if (!window.sessionStorage.getItem(visitStorageKey)) {
        window.sessionStorage.setItem(visitStorageKey, '1');
        trackActivity(
          'page_visit',
          currentUserId ? 'Bước vào miền ký ức của tụi mình' : 'Ghé thăm trang kỷ niệm'
        );
      }
    } catch {
      // Ignore storage access errors
    }

    function handleLeave() {
      if (hasSentLeaveRef.current) return;
      hasSentLeaveRef.current = true;
      sendLeaveBeacon();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        handleLeave();
      }
    }

    window.addEventListener('pagehide', handleLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', handleLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [visitStorageKey, currentUserId, trackActivity]);

  useEffect(() => {
    if (!showHeartModal) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowHeartModal(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showHeartModal]);

  const handleStartJourney = useCallback(() => {
    const timelineEl = document.getElementById('timeline');
    if (timelineEl && typeof timelineEl.scrollIntoView === 'function') {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      timelineEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
    if (settings.musicEnabled && settings.musicUrl && !isPlayingRef.current) {
      setIsPlaying(true);
      trackActivity('music_toggled', 'Bật giai điệu nền dịu dàng');
    }
  }, [settings.musicEnabled, settings.musicUrl, trackActivity]);

  const handleToggleMusic = useCallback(() => {
    const nextState = !isPlayingRef.current;
    setIsPlaying(nextState);
    trackActivity(
      'music_toggled',
      nextState ? 'Bật giai điệu nền dịu dàng' : 'Tạm dừng nhạc nền'
    );
  }, [trackActivity]);

  const handleOpenPhoto = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const memory = memories[index];
      if (memory) {
        trackActivity(
          'memory_viewed',
          `Ngắm kỷ niệm: ${memory.title || memory.memoryDate}`,
          { memoryId: memory.id, title: memory.title || '' }
        );
      }
    },
    [memories, trackActivity]
  );

  const handleLetterOpen = useCallback(() => {
    trackActivity('letter_opened', 'Mở phong thư tâm sự');
  }, [trackActivity]);

  const handleOpenHeartReplay = useCallback(() => {
    setShowHeartModal(true);
    trackActivity('pixel_heart_viewed', 'Ngắm lại trái tim pixel ngọt ngào');
  }, [trackActivity]);

  const handleLogout = useCallback(async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    hasSentLeaveRef.current = true;
    try {
      await fetch('/api/viewer/logout', { method: 'POST' }).catch(() => {});
      try {
        window.sessionStorage.removeItem(visitStorageKey);
        window.sessionStorage.removeItem('ny_visit_logged:guest');
      } catch {
        // Ignore storage errors
      }
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, router, visitStorageKey]);

  const roleLabel =
    currentUser?.displayName ||
    (currentUser?.role === 'admin' ? 'Anh · Quản trị' : 'Em bé thương yêu');

  const showLogoutButton = Boolean(currentUser) || Boolean(viewerPasscodeEnabled);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-hidden bg-[#080306] text-rose-50">
        <LoveEffectsLayer />

        {/* Luminous crimson & rose velvet atmosphere orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-red-600/20 blur-3xl sm:h-[28rem] sm:w-[28rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -right-24 top-1/3 h-80 w-80 rounded-full bg-rose-500/15 blur-3xl sm:h-[30rem] sm:w-[30rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-0 left-1/3 h-72 w-72 rounded-full bg-pink-600/15 blur-3xl"
        />

        {/* Unified Godly floating pill dock */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex flex-wrap items-center gap-1.5 px-3 pt-3 sm:gap-2 sm:px-6 sm:pt-5">
          {currentUser && (
            <div className="pointer-events-auto order-1 glass-pill inline-flex min-h-[36px] max-w-full items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-rose-100 sm:gap-2 sm:px-3 sm:py-2 sm:text-xs">
              <span
                aria-hidden="true"
                className="h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)] animate-pulse motion-reduce:animate-none"
              />
              <Heart className="h-3 w-3 shrink-0 fill-rose-400 text-rose-400 sm:h-3.5 sm:w-3.5" />
              <span className="max-w-[130px] truncate sm:max-w-[200px]">{roleLabel}</span>
            </div>
          )}

          <div className="pointer-events-auto order-2 ml-auto shrink-0 sm:order-last">
            <AudioToggle
              inline
              musicUrl={settings.musicUrl}
              musicEnabled={settings.musicEnabled}
              isPlaying={isPlaying}
              onToggle={handleToggleMusic}
              onSyncPlayState={setIsPlaying}
            />
          </div>

          <div className="pointer-events-auto order-3 flex flex-wrap items-center gap-1.5 sm:order-2 sm:gap-2">
            {currentUser?.role === 'admin' && (
              <Link
                href="/admin"
                className="glass-pill inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:border-red-400/55 hover:text-white sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs"
              >
                <ShieldCheck className="h-3 w-3 shrink-0 text-red-400 sm:h-3.5 sm:w-3.5" />
                <span>Quản trị</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleOpenHeartReplay}
              aria-label="Ngắm lại trái tim pixel"
              className="glass-pill inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-rose-200 transition hover:border-rose-400/50 hover:text-white sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs"
            >
              <Sparkles className="h-3 w-3 shrink-0 text-rose-400 sm:h-3.5 sm:w-3.5" />
              <span>Trái tim</span>
            </button>

            {showLogoutButton && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="glass-pill inline-flex min-h-[36px] items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-rose-200/85 transition hover:border-red-400/50 hover:text-white disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs"
              >
                <LogOut className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>
        </div>

        <main className="relative z-10">
          <HeroSection
            coupleTitle={settings.coupleTitle}
            heroSubtitle={settings.heroSubtitle}
            loveStartDate={settings.loveStartDate}
            daysTogether={daysTogether}
            memoriesCount={memories.length}
            onStartJourney={handleStartJourney}
          />

          <MemoryTimeline memories={memories} onOpenPhoto={handleOpenPhoto} />

          <EnvelopeLetter
            letterTitle={settings.letterTitle}
            letterBody={settings.letterBody}
            letterSignature={settings.letterSignature}
            onOpen={handleLetterOpen}
          />
        </main>

        <footer className="relative z-10 pb-10 text-center text-xs text-rose-300/65">
          <p className="inline-flex items-center gap-1.5">
            <Heart className="h-3 w-3 fill-rose-400 text-rose-400" />
            <span>Nơi cất giữ từng nhịp tim dịu dàng của {settings.coupleTitle}</span>
          </p>
        </footer>

        <PhotoLightbox
          memories={memories}
          selectedIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
          onSelectIndex={handleOpenPhoto}
        />

        {showHeartModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ngắm lại trái tim pixel"
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-[#060204]/80 p-4 backdrop-blur-md sm:items-center"
            onClick={() => setShowHeartModal(false)}
          >
            <div
              className="relative my-auto w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowHeartModal(false)}
                aria-label="Đóng trái tim pixel"
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-rose-500/30 bg-[#190911]/90 text-rose-200 shadow-sm transition hover:border-rose-400/60 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <PixelHeartIntro
                coupleTitle={settings.coupleTitle}
                displayName={currentUser?.displayName}
                onEnterStory={() => setShowHeartModal(false)}
                buttonLabel="Quay lại miền ký ức"
                isModalReplay
              />
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
