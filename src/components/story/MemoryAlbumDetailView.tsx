'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MotionConfig } from 'framer-motion';
import {
  ArrowLeft,
  CalendarHeart,
  ChevronLeft,
  ChevronRight,
  Heart,
  Images,
  Maximize2,
  Play,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AudioToggle } from '@/components/story/AudioToggle';
import { LoveEffectsLayer } from '@/components/story/LoveEffectsLayer';
import { formatMemoryLongDateVi } from '@/lib/date-utils';
import { formatAlbumMediaCountVi, getMemoryImages, isVideoMediaItem } from '@/lib/memory-album';
import { useModalFocusTrap } from '@/lib/useModalFocusTrap';
import type { MemoryItem, PublicSiteSettings, SafeAppUser } from '@/types/memories';

export interface AlbumSiblingLink {
  id: string;
  title: string;
}

interface MemoryAlbumDetailViewProps {
  memory: MemoryItem;
  albumIndex: number;
  totalAlbums: number;
  settings: PublicSiteSettings;
  currentUser?: SafeAppUser | null;
  prevMemory?: AlbumSiblingLink | null;
  nextMemory?: AlbumSiblingLink | null;
}

const SWIPE_THRESHOLD_PX = 40;

export function MemoryAlbumDetailView({
  memory,
  albumIndex,
  totalAlbums,
  settings,
  currentUser = null,
  prevMemory = null,
  nextMemory = null,
}: MemoryAlbumDetailViewProps) {
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const images = getMemoryImages(memory);
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const thumbRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const popupDialogRef = useRef<HTMLDivElement | null>(null);
  const popupCloseBtnRef = useRef<HTMLButtonElement | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeStartYRef = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [memory.id]);

  useEffect(() => {
    try {
      fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'memory_viewed',
          detail: `Mở chi tiết album: ${memory.title || memory.memoryDate}`,
          metadata: { memoryId: memory.id, photoCount: images.length },
        }),
        keepalive: true,
      })
        .then((res) => {
          if (res.status === 401) {
            routerRef.current.refresh();
          }
        })
        .catch(() => { });
    } catch {
      // Ignore telemetry failures
    }
  }, [memory.id, memory.title, memory.memoryDate, images.length]);

  useEffect(() => {
    const btn = thumbRefs.current[activeIndex];
    if (btn && typeof btn.scrollIntoView === 'function') {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      btn.scrollIntoView({
        inline: 'center',
        block: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }
  }, [activeIndex]);

  useModalFocusTrap({
    isOpen: lightboxOpen,
    containerRef: popupDialogRef,
    initialFocusRef: popupCloseBtnRef,
  });

  const goToPrevPhoto = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goToNextPhoto = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
      } else if (e.key === 'ArrowLeft') {
        goToPrevPhoto();
      } else if (e.key === 'ArrowRight') {
        goToNextPhoto();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, goToPrevPhoto, goToNextPhoto]);

  function startSwipe(clientX: number, clientY: number) {
    swipeStartXRef.current = clientX;
    swipeStartYRef.current = clientY;
    didSwipeRef.current = false;
  }

  function finishSwipe(clientX: number, clientY: number) {
    const startX = swipeStartXRef.current;
    const startY = swipeStartYRef.current;
    swipeStartXRef.current = null;
    swipeStartYRef.current = null;
    if (startX === null || startY === null || images.length <= 1) return;

    const deltaX = clientX - startX;
    const deltaY = clientY - startY;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX && Math.abs(deltaX) > Math.abs(deltaY)) {
      didSwipeRef.current = true;
      if (deltaX < 0) {
        goToNextPhoto();
      } else {
        goToPrevPhoto();
      }
    }
  }

  const activePhoto = images[activeIndex] ?? images[0];
  const isActiveVideo = activePhoto ? isVideoMediaItem(activePhoto) : false;
  const hasAnyVideo = images.some(isVideoMediaItem);
  const mediaSummaryLabel = formatAlbumMediaCountVi(images);
  const hasMultiple = images.length > 1;
  const albumTitle = memory.title || 'Khoảnh khắc bình yên';
  const storyParagraphs = memory.story
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-[100dvh] overflow-x-hidden bg-[#FFFBEB] text-stone-900">
        <LoveEffectsLayer />

        {/* Warm sunlit butter-yellow & crimson-blush atmospheric glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -left-24 -top-24 h-80 w-80 rounded-full bg-amber-200/45 blur-3xl sm:h-[28rem] sm:w-[28rem]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -right-24 top-1/3 h-80 w-80 rounded-full bg-yellow-200/45 blur-3xl sm:h-[30rem] sm:w-[30rem]"
        />

        {/* Single-Row Fixed Top App Bar */}
        <div
          data-testid="album-topbar"
          className="fixed inset-x-0 top-0 z-40 border-b border-amber-300/75 bg-[#FFFBEB]/90 pt-[env(safe-area-inset-top)] shadow-[0_6px_24px_rgba(120,53,15,0.06)] backdrop-blur-xl"
        >
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-3 sm:h-16 sm:px-6">
            <Link
              href="/"
              className="glass-pill inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:border-red-300 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:px-3.5"
            >
              <ArrowLeft aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-red-600" />
              <span>
                Quay lại<span className="hidden sm:inline"> hành trình</span>
              </span>
            </Link>

            <div className="flex shrink-0 items-center gap-2">
              {currentUser && (
                <div className="glass-pill hidden min-h-[36px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-900 md:inline-flex">
                  <Heart aria-hidden="true" className="h-3 w-3 shrink-0 fill-red-500 text-red-500" />
                  <span className="max-w-[160px] truncate">{currentUser.displayName}</span>
                </div>
              )}

              {currentUser?.role === 'admin' && (
                <Link
                  href="/admin"
                  className="glass-pill inline-flex min-h-[40px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:border-red-300 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:min-h-[36px]"
                >
                  <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-red-600" />
                  <span>Quản trị</span>
                </Link>
              )}

              <AudioToggle inline musicUrl={settings.musicUrl} playlist={settings.musicPlaylist} />
            </div>
          </div>
        </div>

        {/* E-Commerce Product Detail 2-Column Showcase */}
        <main className="relative z-10 mx-auto max-w-6xl px-3.5 pb-16 pt-20 sm:px-6 sm:pb-20 sm:pt-24 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-12 lg:items-start lg:gap-8">
            {/* Left Column: Product-Style Main Image + Thumbnail Strip */}
            <div className="space-y-4 lg:sticky lg:top-24 lg:col-span-7">
              <div className="glass-card relative overflow-hidden rounded-3xl p-2.5 sm:p-4">
                <div
                  data-testid="album-main-stage"
                  onTouchStart={(e) => {
                    const t = e.touches[0];
                    if (t) startSwipe(t.clientX, t.clientY);
                  }}
                  onTouchEnd={(e) => {
                    const t = e.changedTouches[0];
                    if (t) finishSwipe(t.clientX, t.clientY);
                  }}
                  className="relative flex min-h-[260px] max-h-[62vh] touch-pan-y select-none items-center justify-center overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2 sm:min-h-[400px] sm:max-h-[64vh]"
                >
                  {hasMultiple && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToPrevPhoto();
                      }}
                      aria-label="Ảnh trước trong album"
                      className="absolute left-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/85 bg-[#FFFDF5]/95 text-stone-800 shadow-md transition hover:border-red-400 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:left-3 sm:h-11 sm:w-11"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}

                  {isActiveVideo ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        aria-label={`Phóng to xem video ${activeIndex + 1} / ${images.length}`}
                        className="absolute right-3 top-3 z-10 inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFBEB]/90 px-3 py-1.5 text-xs font-semibold text-stone-800 shadow-sm transition hover:border-red-400 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                      >
                        <Maximize2 className="h-3.5 w-3.5 text-red-600" />
                        <span>Mở popup</span>
                      </button>
                      <video
                        key={activePhoto.url}
                        src={activePhoto.url}
                        controls
                        playsInline
                        preload="metadata"
                        aria-label={activePhoto.alt || albumTitle}
                        className="max-h-[58vh] w-auto max-w-full rounded-xl object-contain"
                      />
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (didSwipeRef.current) {
                          didSwipeRef.current = false;
                          return;
                        }
                        setLightboxOpen(true);
                      }}
                      aria-label={`Phóng to xem ảnh ${activeIndex + 1} / ${images.length}`}
                      className="group flex h-full w-full cursor-pointer items-center justify-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={activePhoto.url}
                        alt={activePhoto.alt || albumTitle}
                        className="max-h-[58vh] w-auto max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.015] motion-reduce:transform-none motion-reduce:transition-none"
                      />
                    </button>
                  )}

                  {hasMultiple && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        goToNextPhoto();
                      }}
                      aria-label="Ảnh sau trong album"
                      className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/85 bg-[#FFFDF5]/95 text-stone-800 shadow-md transition hover:border-red-400 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:right-3 sm:h-11 sm:w-11"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}

                  <div
                    className={`pointer-events-none absolute left-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFBEB]/90 px-3 py-1 text-xs font-semibold text-stone-800 shadow-sm backdrop-blur-md ${isActiveVideo ? 'top-3' : 'bottom-3'
                      }`}
                  >
                    <Images className="h-3.5 w-3.5 text-red-600" />
                    <span>
                      {activeIndex + 1} / {images.length}
                    </span>
                  </div>

                  {!isActiveVideo && (
                    <div className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFBEB]/90 px-3 py-1 text-[11px] font-medium text-stone-800 shadow-sm backdrop-blur-md">
                      <Maximize2 className="h-3 w-3 text-red-600" />
                      <span>
                        <span className="sm:hidden">Phóng to</span>
                        <span className="hidden sm:inline">Bấm vào ảnh để phóng to</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Horizontal Thumbnail Strip */}
                <div
                  data-testid="album-thumbnail-strip"
                  className="mt-3 flex gap-2.5 overflow-x-auto pb-1 pt-0.5"
                >
                  {images.map((img, idx) => {
                    const isSelected = idx === activeIndex;
                    const isThumbVideo = isVideoMediaItem(img);
                    return (
                      <button
                        key={`${img.url}-${idx}`}
                        ref={(el) => {
                          thumbRefs.current[idx] = el;
                        }}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={
                          isThumbVideo
                            ? `Xem video ${idx + 1} trong album`
                            : `Xem ảnh ${idx + 1} trong album`
                        }
                        onClick={() => setActiveIndex(idx)}
                        className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border bg-[#FEF9C3]/55 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 sm:h-20 sm:w-20 ${isSelected
                          ? 'border-red-500 ring-2 ring-red-500/40'
                          : 'border-amber-300/75 opacity-80 hover:border-red-400 hover:opacity-100'
                          }`}
                      >
                        {isThumbVideo ? (
                          <>
                            <video
                              src={img.url}
                              muted
                              playsInline
                              preload="metadata"
                              aria-label={img.alt || `Video ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/35"
                            >
                              <Play className="h-4 w-4 fill-white text-white" />
                            </span>
                          </>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={img.url}
                            alt={img.alt || `Ảnh ${idx + 1}`}
                            loading="lazy"
                            decoding="async"
                            className="h-full w-full object-cover"
                          />
                        )}
                        {idx === 0 && (
                          <span className="absolute bottom-1 left-1 rounded bg-[#FFFBEB]/90 px-1.5 py-0.5 text-[9px] font-semibold text-stone-900">
                            Bìa
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Column: Editorial Story & Album Metadata */}
            <div className="space-y-5 lg:col-span-5">
              <div className="glass-card space-y-5 rounded-3xl p-4 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-950">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.75)]"
                    />
                    <span>
                      Album #{String(albumIndex + 1).padStart(2, '0')} /{' '}
                      {String(totalAlbums).padStart(2, '0')}
                    </span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFDF5] px-3 py-1 text-xs font-medium text-stone-800">
                    <CalendarHeart className="h-3.5 w-3.5 text-red-600" />
                    <span>{formatMemoryLongDateVi(memory.memoryDate)}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-900">
                    <Images className="h-3.5 w-3.5 text-red-600" />
                    <span>{hasAnyVideo ? mediaSummaryLabel : `${images.length} bức ảnh`}</span>
                  </span>
                </div>

                <h1 className="break-words [overflow-wrap:anywhere] font-serif text-2xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                  {albumTitle}
                </h1>

                {activePhoto.alt && activePhoto.alt !== albumTitle && (
                  <div className="rounded-2xl border border-amber-300/75 bg-[#FFFDF5] px-4 py-2.5 text-xs text-stone-700">
                    <span className="font-semibold text-red-700">
                      Khoảnh khắc #{activeIndex + 1}:
                    </span>{' '}
                    {activePhoto.alt}
                  </div>
                )}

                <div className="space-y-4 border-t border-amber-200/80 pt-4 text-sm leading-relaxed text-stone-800 sm:text-base">
                  {storyParagraphs.length > 0 ? (
                    storyParagraphs.map((para, idx) => (
                      <p key={idx} className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                        {para}
                      </p>
                    ))
                  ) : (
                    <p className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                      {memory.story}
                    </p>
                  )}
                </div>

                <div className="border-t border-amber-200/80 pt-4">
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(220,38,38,0.25)] transition hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)] hover:ring-1 hover:ring-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <Maximize2 className="h-4 w-4 shrink-0" />
                    <span>
                      {hasAnyVideo
                        ? `Mở popup lướt xem (${mediaSummaryLabel})`
                        : `Mở popup lướt xem ${images.length} ảnh`}
                    </span>
                  </button>
                </div>
              </div>

              {(prevMemory || nextMemory) && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {prevMemory ? (
                    <Link
                      href={`/memories/${prevMemory.id}`}
                      className="glass-card flex min-w-0 flex-col gap-1 rounded-2xl p-4 transition hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                        <ChevronLeft className="h-3.5 w-3.5" />
                        Album trước
                      </span>
                      <span className="truncate font-serif text-base font-semibold text-stone-900">
                        {prevMemory.title || 'Khoảnh khắc bình yên'}
                      </span>
                    </Link>
                  ) : (
                    <div aria-hidden="true" className="hidden sm:block" />
                  )}

                  {nextMemory && (
                    <Link
                      href={`/memories/${nextMemory.id}`}
                      className="glass-card flex min-w-0 flex-col items-end gap-1 rounded-2xl p-4 text-right transition hover:border-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                    >
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-stone-600">
                        Album tiếp theo
                        <ChevronRight className="h-3.5 w-3.5" />
                      </span>
                      <span className="max-w-full truncate font-serif text-base font-semibold text-stone-900">
                        {nextMemory.title || 'Khoảnh khắc bình yên'}
                      </span>
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Fullscreen Swipeable Popup Lightbox */}
        {lightboxOpen && (
          <div
            ref={popupDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={albumTitle}
            tabIndex={-1}
            onClick={() => setLightboxOpen(false)}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-950/65 p-3 backdrop-blur-lg sm:items-center sm:p-6"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="glass-card relative my-auto flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl p-4 sm:p-6 [@media(min-height:560px)]:max-h-[94vh]"
            >
              <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-950">
                    <Images className="h-3.5 w-3.5 text-red-600" />
                    <span>
                      {activeIndex + 1} / {images.length}
                    </span>
                  </span>
                  {hasMultiple && (
                    <span className="hidden text-[11px] font-medium text-stone-600 sm:inline">
                      Vuốt trái / phải · ← · → · ESC
                    </span>
                  )}
                </div>

                <button
                  ref={popupCloseBtnRef}
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  aria-label="Đóng popup xem ảnh"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-300/80 bg-[#FFFDF5]/95 text-stone-800 transition hover:border-red-300 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div
                data-testid="album-popup-stage"
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (t) startSwipe(t.clientX, t.clientY);
                }}
                onTouchEnd={(e) => {
                  const t = e.changedTouches[0];
                  if (t) finishSwipe(t.clientX, t.clientY);
                }}
                onPointerDown={(e) => startSwipe(e.clientX, e.clientY)}
                onPointerUp={(e) => finishSwipe(e.clientX, e.clientY)}
                className="relative flex min-h-[220px] max-h-[60vh] shrink-0 touch-pan-y select-none items-center justify-center overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2 sm:max-h-[64vh]"
              >
                {hasMultiple && (
                  <button
                    type="button"
                    onClick={goToPrevPhoto}
                    aria-label="Ảnh trước"
                    className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/85 bg-[#FFFDF5]/95 text-stone-800 shadow-md transition hover:border-red-400 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}

                {isActiveVideo ? (
                  <video
                    key={activePhoto.url}
                    src={activePhoto.url}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    aria-label={activePhoto.alt || albumTitle}
                    onPointerDown={(e) => e.stopPropagation()}
                    className="max-h-[56vh] w-auto max-w-full rounded-xl object-contain sm:max-h-[60vh]"
                  />
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={activePhoto.url}
                    alt={activePhoto.alt || albumTitle}
                    draggable={false}
                    className="max-h-[56vh] w-auto max-w-full rounded-xl object-contain sm:max-h-[60vh]"
                  />
                )}

                {hasMultiple && (
                  <button
                    type="button"
                    onClick={goToNextPhoto}
                    aria-label="Ảnh tiếp theo"
                    className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/85 bg-[#FFFDF5]/95 text-stone-800 shadow-md transition hover:border-red-400 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                )}
              </div>

              {activePhoto.alt && (
                <p className="mt-3 text-center text-sm font-medium text-stone-800">
                  {activePhoto.alt}
                </p>
              )}

              {hasMultiple && (
                <div className="mt-3 flex shrink-0 gap-2 overflow-x-auto pb-1">
                  {images.map((img, idx) => {
                    const isThumbVideo = isVideoMediaItem(img);
                    return (
                      <button
                        key={`popup-thumb-${idx}`}
                        type="button"
                        aria-pressed={idx === activeIndex}
                        aria-label={
                          isThumbVideo
                            ? `Chọn video ${idx + 1} trong popup`
                            : `Chọn ảnh ${idx + 1} trong popup`
                        }
                        onClick={() => setActiveIndex(idx)}
                        className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-[#FEF9C3]/55 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${idx === activeIndex
                          ? 'border-red-500 ring-2 ring-red-500/40'
                          : 'border-amber-300/75 opacity-75 hover:opacity-100'
                          }`}
                      >
                        {isThumbVideo ? (
                          <>
                            <video
                              src={img.url}
                              muted
                              playsInline
                              preload="metadata"
                              aria-label={img.alt || `Video ${idx + 1}`}
                              className="h-full w-full object-cover"
                            />
                            <span
                              aria-hidden="true"
                              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/35"
                            >
                              <Play className="h-3.5 w-3.5 fill-white text-white" />
                            </span>
                          </>
                        ) : (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={img.url}
                            alt={img.alt || `Ảnh ${idx + 1}`}
                            className="h-full w-full object-cover"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </MotionConfig>
  );
}
