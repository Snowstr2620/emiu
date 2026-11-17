'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import { BookOpen, Heart, LogOut, Menu, ShieldCheck, Sparkles, X } from 'lucide-react';
import { AudioToggle } from '@/components/story/AudioToggle';
import { DailyDiarySection } from '@/components/story/DailyDiarySection';
import { EnvelopeLetter } from '@/components/story/EnvelopeLetter';
import { HeroSection } from '@/components/story/HeroSection';
import { LoveEffectsLayer } from '@/components/story/LoveEffectsLayer';
import { MemoryTimeline } from '@/components/story/MemoryTimeline';
import { PhotoLightbox } from '@/components/story/PhotoLightbox';
import { PixelHeartIntro } from '@/components/story/PixelHeartIntro';
import { useModalFocusTrap } from '@/lib/useModalFocusTrap';
import type { ActivityEventType, DiaryEntry, PublicSiteData, SafeAppUser } from '@/types/memories';

const EMPTY_DIARY_ENTRIES: DiaryEntry[] = [];

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
  const initialDiaryEntries = data.diaryEntries ?? EMPTY_DIARY_ENTRIES;
  const [activeSection, setActiveSection] = useState<'story' | 'diary'>('story');
  const [diaryCount, setDiaryCount] = useState<number>(initialDiaryEntries.length);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showHeartModal, setShowHeartModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    setDiaryCount((data.diaryEntries ?? []).length);
  }, [data.diaryEntries]);

  const hasSentLeaveRef = useRef(false);
  const heartModalRef = useRef<HTMLDivElement | null>(null);
  const heartCloseButtonRef = useRef<HTMLButtonElement | null>(null);

  useModalFocusTrap({
    isOpen: showHeartModal,
    containerRef: heartModalRef,
    initialFocusRef: heartCloseButtonRef,
  });

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
    if (!showHeartModal && !mobileMenuOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        if (showHeartModal) setShowHeartModal(false);
        if (mobileMenuOpen) setMobileMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showHeartModal, mobileMenuOpen]);

  const handleStartJourney = useCallback(() => {
    const timelineEl = document.getElementById('timeline');
    if (timelineEl && typeof timelineEl.scrollIntoView === 'function') {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      timelineEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }, []);

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
    setMobileMenuOpen(false);
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
  const hasAccountMenu = Boolean(currentUser) || showLogoutButton;

  function handleBrandClick() {
    setActiveSection('story');
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      const prefersReducedMotion =
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  }

  // Swapping tabs replaces the whole <main> content, so keeping the old scroll offset would
  // drop the reader mid-way into the new section (hiding its heading & primary CTA).
  function handleSectionChange(section: 'story' | 'diary') {
    setActiveSection(section);
    setMobileMenuOpen(false);
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#FFFBEB] text-stone-900">
        <LoveEffectsLayer />

        {/* Warm sunlit butter-yellow & crimson-blush atmosphere orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-amber-200/45 blur-3xl sm:h-[28rem] sm:w-[28rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -right-24 top-1/3 h-80 w-80 rounded-full bg-yellow-200/45 blur-3xl sm:h-[30rem] sm:w-[30rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed bottom-0 left-1/3 h-72 w-72 rounded-full bg-red-200/30 blur-3xl"
        />

        {/* Mobile drawer scrim */}
        {mobileMenuOpen && (
          <div
            aria-hidden="true"
            onClick={() => setMobileMenuOpen(false)}
            className="fixed inset-0 z-30 bg-stone-950/35 backdrop-blur-sm lg:hidden"
          />
        )}

        {/* Unified sunlit Top App Bar + Responsive Primary Navigation */}
        <div
          data-testid="story-topbar"
          className="fixed inset-x-0 top-0 z-40 pt-[env(safe-area-inset-top)]"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 border-b border-amber-300/75 bg-[#FFFBEB]/90 shadow-[0_6px_24px_rgba(120,53,15,0.06)] backdrop-blur-xl"
          />
          <div className="mx-auto flex h-14 max-w-6xl 2xl:max-w-7xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
            {/* Brand Identity */}
            <button
              type="button"
              onClick={handleBrandClick}
              className="inline-flex min-h-[44px] min-w-0 shrink items-center gap-2 rounded-2xl px-1.5 py-1 text-left transition hover:bg-amber-100/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 shadow-sm">
                <Heart aria-hidden="true" className="h-4 w-4 fill-red-500 text-red-500" />
              </span>
              <span className="max-w-[140px] truncate font-serif text-base font-bold text-stone-900 sm:max-w-[180px] sm:text-lg">
                {settings.coupleTitle}
              </span>
            </button>

            {/* Primary Nav: Fixed Bottom Tab Bar on Mobile (< md) -> Centered Inline Pill Bar on Desktop/Tablet (md+) */}
            <nav
              aria-label="Điều hướng chính"
              data-testid="story-primary-nav"
              className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-3 gap-1.5 border-t border-amber-300/85 bg-[#FFFDF5]/95 px-2.5 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_28px_rgba(120,53,15,0.08)] backdrop-blur-xl md:static md:inset-auto md:bottom-auto md:z-auto md:inline-flex md:w-auto md:shrink-0 md:items-center md:gap-1 md:rounded-full md:border md:border-amber-300/80 md:bg-[#FFFDF5]/95 md:p-1 md:shadow-[0_8px_24px_rgba(120,53,15,0.08)]"
            >
              <button
                type="button"
                aria-pressed={activeSection === 'story'}
                onClick={() => handleSectionChange('story')}
                className={`inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:min-h-[36px] md:flex-row md:gap-1.5 md:rounded-full md:px-3 md:py-1.5 md:text-xs ${
                  activeSection === 'story'
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-[0_6px_18px_rgba(220,38,38,0.28)]'
                    : 'text-stone-700 hover:text-stone-950'
                }`}
              >
                <Heart
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 md:h-3.5 md:w-3.5 ${
                    activeSection === 'story'
                      ? 'fill-white text-white'
                      : 'fill-red-500 text-red-500'
                  }`}
                />
                <span>
                  Hành trình<span className="hidden 2xl:inline"> kỷ niệm</span>
                </span>
              </button>

              <button
                type="button"
                aria-pressed={activeSection === 'diary'}
                onClick={() => handleSectionChange('diary')}
                className={`inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:min-h-[36px] md:flex-row md:gap-1.5 md:rounded-full md:px-3 md:py-1.5 md:text-xs ${
                  activeSection === 'diary'
                    ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-[0_6px_18px_rgba(220,38,38,0.28)]'
                    : 'text-stone-700 hover:text-stone-950'
                }`}
              >
                <BookOpen
                  aria-hidden="true"
                  className={`h-4 w-4 shrink-0 md:h-3.5 md:w-3.5 ${
                    activeSection === 'diary' ? 'text-white' : 'text-red-600'
                  }`}
                />
                <span>
                  Nhật ký<span className="hidden 2xl:inline"> mỗi ngày</span>
                  {diaryCount > 0 ? ` (${diaryCount})` : ''}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenHeartReplay();
                }}
                aria-label="Ngắm lại trái tim pixel"
                className="inline-flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-amber-100/75 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 md:min-h-[36px] md:flex-row md:gap-1.5 md:rounded-full md:px-3 md:py-1.5 md:text-xs"
              >
                <Sparkles
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0 text-red-600 md:h-3.5 md:w-3.5"
                />
                <span>Trái tim</span>
              </button>
            </nav>

            {/* Right Controls: Always-On Ambient Music Pill + Mobile Drawer Trigger + Desktop Account Bar */}
            <div className="flex shrink-0 items-center gap-2">
              <AudioToggle inline musicUrl={settings.musicUrl} />

              {hasAccountMenu && (
                <>
                  <button
                    type="button"
                    aria-label={mobileMenuOpen ? 'Đóng menu tài khoản' : 'Mở menu tài khoản'}
                    aria-expanded={mobileMenuOpen}
                    aria-controls="story-account-menu"
                    onClick={() => setMobileMenuOpen((v) => !v)}
                    className="glass-pill inline-flex h-11 w-11 items-center justify-center rounded-full text-stone-800 transition hover:border-red-300 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:hidden"
                  >
                    {mobileMenuOpen ? (
                      <X aria-hidden="true" className="h-5 w-5" />
                    ) : (
                      <Menu aria-hidden="true" className="h-5 w-5" />
                    )}
                  </button>

                  <div
                    id="story-account-menu"
                    data-testid="story-account-menu"
                    className={
                      mobileMenuOpen
                        ? 'fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+0.5rem)] z-50 flex flex-col gap-2 rounded-3xl border border-amber-300/85 bg-[#FFFDF5]/95 p-4 shadow-[0_20px_48px_rgba(120,53,15,0.18)] backdrop-blur-xl lg:static lg:inset-auto lg:z-auto lg:flex lg:flex-row lg:items-center lg:gap-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none'
                        : 'hidden lg:flex lg:items-center lg:gap-2'
                    }
                  >
                    {currentUser && (
                      <div className="glass-pill inline-flex min-h-[44px] items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-semibold text-stone-900 lg:min-h-[36px] lg:rounded-full lg:px-3 lg:py-1.5">
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.65)] animate-pulse motion-reduce:animate-none"
                        />
                        <Heart
                          aria-hidden="true"
                          className="h-3.5 w-3.5 shrink-0 fill-red-500 text-red-500"
                        />
                        <span className="truncate lg:max-w-[130px] 2xl:max-w-[200px]">
                          {roleLabel}
                        </span>
                      </div>
                    )}

                    {currentUser?.role === 'admin' && (
                      <Link
                        href="/admin"
                        onClick={() => setMobileMenuOpen(false)}
                        className="glass-pill inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-semibold text-stone-800 transition hover:border-red-300 hover:bg-amber-100/70 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 lg:min-h-[36px] lg:rounded-full lg:px-3 lg:py-1.5"
                      >
                        <ShieldCheck
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-red-600 lg:h-3.5 lg:w-3.5"
                        />
                        <span>Quản trị</span>
                      </Link>
                    )}

                    {showLogoutButton && (
                      <div className="border-t border-amber-200/80 pt-2 lg:border-0 lg:pt-0">
                        <button
                          type="button"
                          onClick={handleLogout}
                          disabled={loggingOut}
                          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-red-300/80 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-700 transition hover:border-red-400 hover:bg-red-100 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60 lg:min-h-[36px] lg:w-auto lg:rounded-full lg:px-3 lg:py-1.5"
                        >
                          <LogOut
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 lg:h-3.5 lg:w-3.5"
                          />
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <main className="relative z-10">
          {activeSection === 'story' ? (
            <>
              <HeroSection
                coupleTitle={settings.coupleTitle}
                heroSubtitle={settings.heroSubtitle}
                loveStartDate={settings.loveStartDate}
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
            </>
          ) : (
            <DailyDiarySection
              coupleTitle={settings.coupleTitle}
              initialEntries={initialDiaryEntries}
              currentUser={currentUser}
              onEntriesCountChange={setDiaryCount}
            />
          )}
        </main>

        <footer className="relative z-10 px-4 pb-28 pt-2 text-center text-xs text-stone-600 md:pb-10">
          <p className="inline-flex max-w-full items-center gap-1.5">
            <Heart className="h-3 w-3 shrink-0 fill-red-500 text-red-500" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              Nơi cất giữ từng nhịp tim dịu dàng của {settings.coupleTitle}
            </span>
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
            ref={heartModalRef}
            role="dialog"
            aria-modal="true"
            aria-label="Ngắm lại trái tim pixel"
            tabIndex={-1}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-950/60 p-4 backdrop-blur-md sm:items-center"
            onClick={() => setShowHeartModal(false)}
          >
            <div
              className="relative my-auto w-full max-w-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                ref={heartCloseButtonRef}
                type="button"
                onClick={() => setShowHeartModal(false)}
                aria-label="Đóng trái tim pixel"
                className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-amber-300/80 bg-[#FFFDF5]/95 text-stone-800 shadow-sm transition hover:border-red-300 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
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
