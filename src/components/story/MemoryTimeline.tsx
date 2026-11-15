'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarHeart, Heart, LayoutGrid, List, Maximize2 } from 'lucide-react';
import { formatMemoryDateVi } from '@/lib/date-utils';
import { MemoryItem } from '@/types/memories';

interface MemoryTimelineProps {
  memories: MemoryItem[];
  onOpenPhoto: (index: number) => void;
}

type ViewMode = 'bento' | 'stream';

export function MemoryTimeline({ memories, onOpenPhoto }: MemoryTimelineProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('bento');

  function getBentoSpanClass(index: number): string {
    if (viewMode !== 'bento') return '';
    if (memories.length === 1) {
      return 'md:col-span-2 lg:col-span-12 max-w-3xl mx-auto w-full';
    }
    return index % 4 === 0 || index % 4 === 3 ? 'lg:col-span-7' : 'lg:col-span-5';
  }

  return (
    <section
      id="timeline"
      className="mx-auto max-w-6xl scroll-mt-24 px-4 py-14 sm:scroll-mt-20 sm:px-8 sm:py-20"
    >
      <div className="mb-10 flex flex-col gap-5 sm:mb-12 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl text-left">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/55 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-rose-200 shadow-sm">
            <CalendarHeart className="h-3.5 w-3.5 text-rose-400" />
            GIAN TRƯNG BÀY KỶ NIỆM
          </span>
          <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-rose-50 sm:text-5xl">
            Từng trang nhật ký nhuốm màu thương nhớ
          </h2>
          <p className="mt-2.5 text-sm text-rose-200/75 sm:text-base">
            Chạm nhẹ vào từng tấm ảnh để sống lại khoảnh khắc tim mình rung lên vì nhau nhé
          </p>
        </div>

        {memories.length > 0 && (
          <div className="glass-pill inline-flex shrink-0 self-start rounded-full p-1 md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('bento')}
              aria-pressed={viewMode === 'bento'}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'bento'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-pink-500 text-white shadow-[0_6px_20px_rgba(225,29,72,0.35)]'
                  : 'text-rose-200/75 hover:text-rose-50'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Bento</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('stream')}
              aria-pressed={viewMode === 'stream'}
              className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                viewMode === 'stream'
                  ? 'bg-gradient-to-r from-red-600 via-rose-600 to-pink-500 text-white shadow-[0_6px_20px_rgba(225,29,72,0.35)]'
                  : 'text-rose-200/75 hover:text-rose-50'
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
          <p className="text-sm leading-relaxed text-rose-200/80 sm:text-base">
            Chưa có kỷ niệm nào được thêm vào dòng thời gian. Anh có thể đăng nhập{' '}
            <span className="font-semibold text-rose-400">/admin</span> để cất lên bức ảnh ngọt
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
            const zoomLabel = `Phóng to ảnh: ${
              memory.title || formatMemoryDateVi(memory.memoryDate)
            }`;
            const indexLabel = `#${String(index + 1).padStart(2, '0')}`;

            return (
              <motion.article
                key={memory.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.12 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`godly-bento-card flex flex-col overflow-hidden rounded-3xl p-4 sm:p-5 ${getBentoSpanClass(
                  index
                )}`}
              >
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 bg-rose-950/60 px-3 py-1 text-xs font-semibold tracking-wider text-rose-200">
                    <span
                      aria-hidden="true"
                      className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.85)]"
                    />
                    <span>{indexLabel}</span>
                  </span>

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-pink-500/20 bg-[#12070c]/85 px-3 py-1 text-xs font-medium text-rose-200/90">
                    <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />
                    {formatMemoryDateVi(memory.memoryDate)}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => onOpenPhoto(index)}
                  aria-label={zoomLabel}
                  className="group relative block w-full overflow-hidden rounded-2xl border border-rose-500/15 bg-[#0b0408]/95 p-2 text-left focus:outline-none focus:ring-2 focus:ring-rose-400/60"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={memory.imageUrl}
                    alt={memory.imageAlt || memory.title || 'Ảnh kỷ niệm'}
                    loading="lazy"
                    decoding="async"
                    className="mx-auto max-h-[380px] w-auto max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.018] motion-reduce:transform-none motion-reduce:transition-none lg:max-h-[420px]"
                  />
                  <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-[#12070c]/85 px-2.5 py-1 text-[11px] font-medium text-rose-100 shadow-sm backdrop-blur-md">
                    <Maximize2 className="h-3 w-3 text-rose-400" />
                    <span>Phóng to</span>
                  </span>
                </button>

                <div className="mt-4 flex-1 px-1">
                  {memory.title && (
                    <h3 className="break-words [overflow-wrap:anywhere] font-serif text-xl font-bold text-rose-50 sm:text-2xl">
                      {memory.title}
                    </h3>
                  )}
                  <p className="mt-1.5 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-rose-200/80 sm:text-[15px]">
                    {memory.story}
                  </p>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </section>
  );
}
