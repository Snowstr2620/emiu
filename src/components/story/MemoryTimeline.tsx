'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CalendarHeart, Heart, Maximize2 } from 'lucide-react';
import { formatMemoryDateVi } from '@/lib/date-utils';
import { MemoryItem } from '@/types/memories';

interface MemoryTimelineProps {
  memories: MemoryItem[];
  onOpenPhoto: (index: number) => void;
}

export function MemoryTimeline({ memories, onOpenPhoto }: MemoryTimelineProps) {
  return (
    <section id="timeline" className="mx-auto max-w-4xl scroll-mt-24 px-4 py-12 sm:scroll-mt-20 sm:px-8 sm:py-16">
      <div className="mb-12 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-pink-600 shadow-sm">
          <CalendarHeart className="h-3.5 w-3.5 text-pink-500" />
          Dòng thời gian ngập tràn thương nhớ
        </span>
        <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Những khung hình anh nâng niu cất giữ
        </h2>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          Chạm nhẹ vào từng tấm ảnh để sống lại khoảnh khắc tim mình rung lên vì nhau nhé
        </p>
        <div
          aria-hidden="true"
          className="mx-auto mt-4 flex items-center justify-center gap-2 text-pink-300"
        >
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-pink-200" />
          <Heart className="h-3.5 w-3.5 fill-pink-300" />
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-pink-200" />
        </div>
      </div>

      {memories.length === 0 ? (
        <div className="glass-card mx-auto max-w-lg rounded-3xl p-8 text-center">
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Chưa có kỷ niệm nào được thêm vào dòng thời gian. Anh có thể đăng nhập{' '}
            <span className="font-semibold text-pink-600">/admin</span> để cất lên bức ảnh ngọt
            ngào đầu tiên của hai đứa mình nhé.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline rail */}
          <div
            aria-hidden="true"
            className="absolute bottom-4 left-4 top-4 w-0.5 bg-gradient-to-b from-pink-200 via-rose-200 to-indigo-200 md:left-1/2 md:-translate-x-1/2"
          />

          <div className="space-y-10 sm:space-y-14">
            {memories.map((memory, index) => {
              const isLeftDesktop = index % 2 === 0;
              const zoomLabel = `Phóng to ảnh: ${
                memory.title || formatMemoryDateVi(memory.memoryDate)
              }`;

              return (
                <motion.article
                  key={memory.id}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.15 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className={`relative flex flex-col pl-11 md:w-1/2 md:pl-0 ${
                    isLeftDesktop ? 'md:pr-10' : 'md:ml-auto md:pl-10'
                  }`}
                >
                  {/* Timeline node */}
                  <span
                    aria-hidden="true"
                    className={`absolute top-7 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-gradient-to-tr from-rose-400 to-pink-500 shadow-md ${
                      isLeftDesktop
                        ? 'left-[9px] md:left-auto md:right-[-8px]'
                        : 'left-[9px] md:-left-[8px]'
                    }`}
                  />

                  <div className="glass-card overflow-hidden rounded-3xl p-4 transition duration-300 hover:shadow-glass-lg sm:p-5">
                    <button
                      type="button"
                      onClick={() => onOpenPhoto(index)}
                      aria-label={zoomLabel}
                      className="group relative block w-full overflow-hidden rounded-2xl bg-white/65 p-1.5 text-left focus:outline-none focus:ring-2 focus:ring-pink-300"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={memory.imageUrl}
                        alt={memory.imageAlt || memory.title || 'Ảnh kỷ niệm'}
                        loading="lazy"
                        decoding="async"
                        className="mx-auto max-h-[420px] w-auto max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.015] motion-reduce:transform-none motion-reduce:transition-none"
                      />
                      <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
                        <Maximize2 className="h-3 w-3 text-pink-500" />
                        Ngắm kỹ hơn
                      </span>
                    </button>

                    <div className="mt-4 px-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-pink-50 px-3 py-0.5 text-xs font-semibold text-pink-600">
                        <Heart className="h-2.5 w-2.5 fill-pink-500 text-pink-500" />
                        {formatMemoryDateVi(memory.memoryDate)}
                      </span>
                      {memory.title && (
                        <h3 className="mt-2 break-words [overflow-wrap:anywhere] font-serif text-xl font-bold text-slate-900">
                          {memory.title}
                        </h3>
                      )}
                      <p className="mt-1.5 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-slate-600 sm:text-[15px]">
                        {memory.story}
                      </p>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
