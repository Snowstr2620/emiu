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
  metadata?: Record<string, string | number | boolean>
): void {
  try {
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, detail, metadata }),
      keepalive: true,
    }).catch(() => {});
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

  useEffect(() => {
    hasSentLeaveRef.current = false;

    try {
      if (!window.sessionStorage.getItem(visitStorageKey)) {
        window.sessionStorage.setItem(visitStorageKey, '1');
        postClientActivity(
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
  }, [visitStorageKey, currentUserId]);

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
      timelineEl.scrollIntoView({ behavior: 'smooth' });
    }
    if (settings.musicEnabled && settings.musicUrl && !isPlayingRef.current) {
      setIsPlaying(true);
      postClientActivity('music_toggled', 'Bật giai điệu nền dịu dàng');
    }
  }, [settings.musicEnabled, settings.musicUrl]);

  const handleToggleMusic = useCallback(() => {
    const nextState = !isPlayingRef.current;
    setIsPlaying(nextState);
    postClientActivity(
      'music_toggled',
      nextState ? 'Bật giai điệu nền dịu dàng' : 'Tạm dừng nhạc nền'
    );
  }, []);

  const handleOpenPhoto = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      const memory = memories[index];
      if (memory) {
        postClientActivity(
          'memory_viewed',
          `Ngắm kỷ niệm: ${memory.title || memory.memoryDate}`,
          { memoryId: memory.id, title: memory.title || '' }
        );
      }
    },
    [memories]
  );

  const handleLetterOpen = useCallback(() => {
    postClientActivity('letter_opened', 'Mở phong thư tâm sự');
  }, []);

  const handleOpenHeartReplay = useCallback(() => {
    setShowHeartModal(true);
    postClientActivity('pixel_heart_viewed', 'Ngắm lại trái tim pixel ngọt ngào');
  }, []);

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
    currentUser?.role === 'admin'
      ? 'Anh · Quản trị'
      : currentUser?.displayName || 'Em bé thương yêu';

  const showLogoutButton = Boolean(currentUser) || Boolean(viewerPasscodeEnabled);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen overflow-x-hidden">
        <LoveEffectsLayer />

        {/* Soft luminous pastel mist orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-pink-200/45 blur-3xl sm:h-[28rem] sm:w-[28rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -right-24 top-1/3 h-80 w-80 rounded-full bg-sky-200/45 blur-3xl sm:h-[30rem] sm:w-[30rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-0 left-1/3 h-72 w-72 rounded-full bg-indigo-100/50 blur-3xl"
        />

        {/* Unified non-overlapping top header bar */}
        <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-start justify-between gap-2 px-3 pt-3 sm:px-6 sm:pt-5">
          <div className="pointer-events-auto flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
            {currentUser && (
              <div className="glass-pill inline-flex max-w-full items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-pink-700 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs">
                <Heart className="h-3 w-3 shrink-0 fill-pink-500 text-pink-500 sm:h-3.5 sm:w-3.5" />
                <span className="max-w-[130px] truncate sm:max-w-[200px]">{roleLabel}</span>
              </div>
            )}

            {currentUser?.role === 'admin' && (
              <Link
                href="/admin"
                className="glass-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-indigo-600 transition hover:border-pink-200 hover:text-pink-600 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs"
              >
                <ShieldCheck className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                <span>Quản trị</span>
              </Link>
            )}

            <button
              type="button"
              onClick={handleOpenHeartReplay}
              aria-label="Ngắm lại trái tim pixel"
              className="glass-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-rose-600 transition hover:border-pink-200 hover:text-pink-700 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs"
            >
              <Sparkles className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
              <span>Trái tim</span>
            </button>

            {showLogoutButton && (
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="glass-pill inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-rose-200 hover:text-rose-600 disabled:opacity-60 sm:gap-1.5 sm:px-3 sm:py-2 sm:text-xs"
              >
                <LogOut className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
                <span>Đăng xuất</span>
              </button>
            )}
          </div>

          <div className="pointer-events-auto shrink-0">
            <AudioToggle
              inline
              musicUrl={settings.musicUrl}
              musicEnabled={settings.musicEnabled}
              isPlaying={isPlaying}
              onToggle={handleToggleMusic}
              onSyncPlayState={setIsPlaying}
            />
          </div>
        </div>

        <main className="relative z-10">
          <HeroSection
            coupleTitle={settings.coupleTitle}
            heroSubtitle={settings.heroSubtitle}
            loveStartDate={settings.loveStartDate}
            daysTogether={daysTogether}
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

        <footer className="relative z-10 pb-10 text-center text-xs text-slate-400">
          <p className="inline-flex items-center gap-1.5">
            <Heart className="h-3 w-3 fill-pink-300 text-pink-300" />
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md"
            onClick={() => setShowHeartModal(false)}
          >
            <div
              className="relative w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setShowHeartModal(false)}
                aria-label="Đóng trái tim pixel"
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-600"
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
