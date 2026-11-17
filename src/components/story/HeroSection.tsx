'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowDown, Heart, Sparkles } from 'lucide-react';
import { formatMemoryDateVi } from '@/lib/date-utils';

interface HeroSectionProps {
  coupleTitle: string;
  heroSubtitle: string;
  loveStartDate: string;
  daysTogether: number;
  memoriesCount?: number;
  onStartJourney: () => void;
}

export function HeroSection({
  coupleTitle,
  heroSubtitle,
  loveStartDate,
  daysTogether,
  memoriesCount,
  onStartJourney,
}: HeroSectionProps) {
  return (
    <header className="relative mx-auto flex max-w-5xl flex-col items-center justify-center px-4 pb-12 pt-20 text-center sm:min-h-[82vh] sm:px-8 sm:pb-16 sm:pt-28">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="flex min-w-0 max-w-full flex-col items-center"
      >
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-300/80 bg-amber-100/80 px-4 py-1.5 text-xs font-semibold tracking-wider text-amber-950 shadow-[0_6px_18px_rgba(120,53,15,0.08)]">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-red-600" />
          <span>Từ {formatMemoryDateVi(loveStartDate)} đến mãi mãi về sau <span className="text-red-600">♥</span></span>
        </div>

        <h1 className="mt-5 max-w-full break-words [overflow-wrap:anywhere] font-serif text-3xl font-bold leading-tight tracking-tight text-stone-900 sm:mt-6 sm:text-6xl md:text-7xl">
          {coupleTitle}
        </h1>

        <p className="mt-3.5 max-w-2xl break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-stone-700 sm:mt-5 sm:text-lg">
          {heroSubtitle}
        </p>

        {/* Hero Bento Metrics Strip */}
        <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-amber-200/60 via-yellow-200/50 to-red-200/40 blur-xl"
            />
            <div className="godly-bento-card love-pulse-glow relative flex h-full items-center gap-3.5 rounded-2xl p-3.5 text-left sm:p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-600 shadow-inner">
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900/80">
                  CÙNG NHAU ĐI QUA
                </p>
                <p className="love-shimmer bg-gradient-to-r from-red-700 via-red-600 to-rose-600 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                  {daysTogether.toLocaleString('vi-VN')} ngày bên nhau
                </p>
              </div>
            </div>
          </div>

          <div className="godly-bento-card relative flex h-full items-center gap-3.5 rounded-2xl p-3.5 text-left sm:p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-300/80 bg-amber-100/80 text-red-600">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900/80">
                KHO LƯU TRỮ KỶ NIỆM
              </p>
              <p className="text-base font-bold text-stone-900 sm:text-lg">
                {typeof memoriesCount === 'number'
                  ? `${memoriesCount.toLocaleString('vi-VN')} khoảnh khắc quý giá`
                  : 'Lưu giữ trọn vẹn từng nhịp tim'}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartJourney}
          className="mt-7 inline-flex min-h-[48px] w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(220,38,38,0.28)] transition hover:shadow-[0_14px_34px_rgba(220,38,38,0.4)] hover:ring-1 hover:ring-red-300 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none sm:mt-10 sm:w-auto"
        >
          <span>Dạo bước vào miền ký ức</span>
          <ArrowDown className="h-4 w-4" />
        </button>
      </motion.div>
    </header>
  );
}
