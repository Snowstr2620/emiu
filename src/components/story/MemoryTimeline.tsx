'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { CalendarHeart, Heart, Images, LayoutGrid, List, Play } from 'lucide-react';
import { formatMemoryDateVi } from '@/lib/date-utils';
import {
  formatAlbumMediaCountVi,
  getMemoryImages,
  isVideoMediaItem,
  isVideoMediaUrl,
} from '@/lib/memory-album';
import { MemoryItem } from '@/types/memories';

interface MemoryTimelineProps {
  memories: MemoryItem[];
}

type ViewMode = 'bento' | 'stream';

export function MemoryTimeline({ memories }: MemoryTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('bento');

  function isTrailingOddCard(index: number): boolean {
    return (
      viewMode === 'bento' &&
      memories.length >= 3 &&
      memories.length % 2 === 1 &&
      index === memories.length - 1
    );
  }

  function getBentoSpanClass(index: number): string {
    if (viewMode !== 'bento') return '';
    if (memories.length === 1) {
      return 'md:col-span-2 lg:col-span-12 max-w-3xl mx-auto w-full';
    }
    if (isTrailingOddCard(index)) {
      return 'md:col-span-2 lg:col-span-12';
    }
    return index % 4 === 0 || index % 4 === 3 ? 'lg:col-span-7' : 'lg:col-span-5';
  }

  return (
    <section
      id="timeline"
      className="mx-auto max-w-6xl scroll-mt-20 px-4 py-10 sm:px-8 sm:py-20 md:scroll-mt-20"
    >
      <div className="mb-10 flex flex-col gap-5 sm:mb-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-amber-950 shadow-sm">
            <CalendarHeart className="h-3.5 w-3.5 text-red-600" />
            GIAN TRƯNG BÀY KỶ NIỆM
          </span>
          <h2 className="mt-3 font-serif text-2xl font-bold tracking-tight text-stone-900 sm:text-5xl">
            Từng trang nhật ký nhuốm màu thương nhớ
          </h2>
          <p className="mt-2.5 text-sm text-stone-700 sm:text-base">
            Chạm nhẹ vào từng tấm ảnh để sống lại khoảnh khắc tim mình rung lên vì nhau nhé
          </p>
        </div>

        {memories.length > 0 && (
          <div className="glass-pill grid w-full shrink-0 grid-cols-2 rounded-full p-1 sm:inline-flex sm:w-auto md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('bento')}
              aria-pressed={viewMode === 'bento'}
              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:min-h-[36px] ${
                viewMode === 'bento'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-[0_6px_18px_rgba(220,38,38,0.28)]'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Bento</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('stream')}
              aria-pressed={viewMode === 'stream'}
              className={`inline-flex min-h-[42px] items-center justify-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition sm:min-h-[36px] ${
                viewMode === 'stream'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 text-white shadow-[0_6px_18px_rgba(220,38,38,0.28)]'
                  : 'text-stone-700 hover:text-stone-950'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Dòng chảy</span>
            </button>
          </div>
        )}
      </div>

      {memories.length === 0 ? (
        <div className="glass-card mx-auto max-w-lg rounded-3xl p-8 text-center">
          <p className="text-sm leading-relaxed text-stone-700 sm:text-base">
            Chưa có kỷ niệm nào được thêm vào dòng thời gian. Anh có thể đăng nhập{' '}
            <span className="font-semibold text-red-600">/admin</span> để cất lên bức ảnh ngọt
            ngào đầu tiên của hai đứa mình nhé.
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'bento'
              ? 'grid grid-cols-1 gap-5 sm:gap-6 md:grid-cols-2 lg:grid-cols-12'
              : 'mx-auto max-w-3xl space-y-8'
          }
        >
          {memories.map((memory, index) => {
            const detailLabel = `Xem chi tiết kỷ niệm: ${
              memory.title || formatMemoryDateVi(memory.memoryDate)
            }`;
            const indexLabel = `#${String(index + 1).padStart(2, '0')}`;
            const images = getMemoryImages(memory);
            const photoCount = images.length;
            const hasAnyVideo = images.some(isVideoMediaItem);
            const coverIsVideo = images[0]
              ? isVideoMediaItem(images[0])
              : isVideoMediaUrl(memory.imageUrl);
            const mediaCountLabel = formatAlbumMediaCountVi(images);
            const previewThumbs = images.slice(0, 4);
            const extraCount = Math.max(0, photoCount - 4);

            return (
              <motion.article
                key={memory.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`godly-bento-card group relative flex flex-col overflow-hidden rounded-3xl p-4 transition hover:shadow-[0_16px_40px_rgba(220,38,38,0.14)] sm:p-5 ${getBentoSpanClass(
                  index
                )}`}
              >
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-2.5 py-1 text-[11px] font-semibold tracking-wider text-amber-950 sm:gap-2 sm:px-3 sm:text-xs">
                      <span
                        aria-hidden="true"
                        className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.75)]"
                      />
                      <span>{indexLabel}</span>
                    </span>
                    {(photoCount > 1 || hasAnyVideo) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-900 sm:text-xs">
                        <Images className="h-3 w-3 shrink-0 text-red-600" />
                        <span>{mediaCountLabel}</span>
                      </span>
                    )}
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFDF5] px-2.5 py-1 text-[11px] font-medium text-stone-800 sm:px-3 sm:text-xs">
                    <Heart className="h-3 w-3 fill-red-500 text-red-500" />
                    {formatMemoryDateVi(memory.memoryDate)}
                  </span>
                </div>

                <div
                  data-testid="memory-cover"
                  className={`relative flex w-full items-center justify-center overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2 md:min-h-[240px] ${
                    viewMode === 'bento' && memories.length > 1 && !isTrailingOddCard(index)
                      ? 'md:h-[300px] lg:h-[360px]'
                      : ''
                  }`}
                >
                  {coverIsVideo ? (
                    <>
                      <video
                        src={memory.imageUrl}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        aria-label={memory.imageAlt || memory.title || 'Video kỷ niệm'}
                        className={`mx-auto w-auto max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.018] motion-reduce:transform-none motion-reduce:transition-none ${
                          viewMode === 'bento' && memories.length > 1 && !isTrailingOddCard(index)
                            ? 'max-h-[380px] md:max-h-full'
                            : 'max-h-[380px] lg:max-h-[420px]'
                        }`}
                      />
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-red-300 bg-[#FFFDF5]/95 text-red-600 shadow-[0_0_20px_rgba(220,38,38,0.2)]">
                          <Play className="h-5 w-5 translate-x-0.5 fill-current" />
                        </span>
                      </span>
                    </>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={memory.imageUrl}
                      alt={memory.imageAlt || memory.title || 'Ảnh kỷ niệm'}
                      loading="lazy"
                      decoding="async"
                      className={`mx-auto w-auto max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.018] motion-reduce:transform-none motion-reduce:transition-none ${
                        viewMode === 'bento' && memories.length > 1 && !isTrailingOddCard(index)
                          ? 'max-h-[380px] md:max-h-full'
                          : 'max-h-[380px] lg:max-h-[420px]'
                      }`}
                    />
                  )}
                  <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-[#FFFBEB]/90 px-2.5 py-1 text-[11px] font-medium text-stone-800 shadow-sm backdrop-blur-md">
                    {coverIsVideo ? (
                      <>
                        <Play className="h-3 w-3 fill-red-600 text-red-600" />
                        <span>Phát video</span>
                      </>
                    ) : (
                      <>
                        <Images className="h-3 w-3 text-red-600" />
                        <span>Xem album</span>
                      </>
                    )}
                  </span>
                </div>

                {photoCount > 1 && (
                  <div className="mt-2.5 grid grid-cols-4 gap-2">
                    {previewThumbs.map((thumb, thumbIdx) => {
                      const showMoreOverlay = thumbIdx === 3 && extraCount > 0;
                      const thumbIsVideo = isVideoMediaItem(thumb);
                      return (
                        <div
                          key={`${memory.id}-thumb-${thumbIdx}`}
                          className="relative aspect-square overflow-hidden rounded-xl border border-amber-300/75 bg-[#FEF9C3]/55"
                        >
                          {thumbIsVideo ? (
                            <>
                              <video
                                src={thumb.url}
                                muted
                                playsInline
                                preload="metadata"
                                aria-label={thumb.alt}
                                className="h-full w-full object-cover"
                              />
                              {!showMoreOverlay && (
                                <span
                                  aria-hidden="true"
                                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-stone-950/35"
                                >
                                  <Play className="h-4 w-4 fill-white text-white" />
                                </span>
                              )}
                            </>
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={thumb.url}
                              alt={thumb.alt}
                              loading="lazy"
                              decoding="async"
                              className="h-full w-full object-cover"
                            />
                          )}
                          {showMoreOverlay && (
                            <span className="absolute inset-0 flex items-center justify-center bg-stone-950/65 text-xs font-bold text-white">
                              +{extraCount}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="mt-4 flex flex-1 flex-col justify-between gap-3 px-1">
                  <div>
                    {memory.title && (
                      <h3 className="break-words [overflow-wrap:anywhere] font-serif text-xl font-bold text-stone-900 sm:text-2xl">
                        {memory.title}
                      </h3>
                    )}
                    <p
                      className={`mt-1.5 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-stone-700 sm:text-[15px] ${
                        photoCount > 1 ? 'line-clamp-3' : ''
                      }`}
                    >
                      {memory.story}
                    </p>
                  </div>
                </div>
                <Link
                  href={`/memories/${memory.id}`}
                  aria-label={detailLabel}
                  data-testid="memory-card-link"
                  className="absolute inset-0 z-10 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-red-500"
                />
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
}
