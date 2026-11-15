'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CalendarHeart, Maximize2 } from 'lucide-react';
import { formatMemoryDateVi } from '@/lib/date-utils';
import { MemoryItem } from '@/types/memories';

interface MemoryTimelineProps {
  memories: MemoryItem[];
  onOpenPhoto: (index: number) => void;
}

export function MemoryTimeline({ memories, onOpenPhoto }: MemoryTimelineProps) {
  return (
    <section id="timeline" className="mx-auto max-w-4xl px-4 py-12 sm:px-8 sm:py-16">
      <div className="mb-12 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-500 shadow-sm">
          <CalendarHeart className="h-3.5 w-3.5 text-pink-500" />
          Dòng thời gian kỷ niệm
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Những khung hình tụi mình từng đi qua
        </h2>
        <p className="mt-2 text-sm text-slate-500 sm:text-base">
          Chạm vào từng bức ảnh để xem rõ hơn nhé
        </p>
      </div>

      {memories.length === 0 ? (
        <div className="glass-card mx-auto max-w-lg rounded-3xl p-8 text-center">
          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Chưa có kỷ niệm nào được thêm vào dòng thời gian. Bạn có thể đăng nhập{' '}
            <span className="font-semibold text-pink-600">/admin</span> để tải lên bức ảnh đầu
            tiên của hai bạn nhé.
          </p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline rail */}
          <div
            aria-hidden="true"
            className="absolute bottom-4 left-4 top-4 w-0.5 bg-gradient-to-b from-pink-200 via-indigo-200 to-sky-200 md:left-1/2 md:-translate-x-1/2"
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
                    className={`absolute top-7 h-3.5 w-3.5 rounded-full border-2 border-white bg-gradient-to-tr from-pink-500 to-indigo-400 shadow-md ${
                      isLeftDesktop
                        ? 'left-[10px] md:left-auto md:right-[-7px]'
                        : 'left-[10px] md:-left-[7px]'
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
                        className="mx-auto max-h-[420px] w-auto max-w-full rounded-xl object-contain transition duration-300 group-hover:scale-[1.015]"
                      />
                      <span className="pointer-events-none absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-sm">
                        <Maximize2 className="h-3 w-3 text-pink-500" />
                        Phóng to
                      </span>
                    </button>

                    <div className="mt-4 px-1">
                      <span className="inline-flex rounded-full bg-pink-50 px-3 py-0.5 text-xs font-semibold text-pink-600">
                        {formatMemoryDateVi(memory.memoryDate)}
                      </span>
                      {memory.title && (
                        <h3 className="mt-2 text-lg font-bold text-slate-900">{memory.title}</h3>
                      )}
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-600 sm:text-[15px]">
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
