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
    <header className="relative mx-auto flex min-h-[82vh] max-w-5xl flex-col items-center justify-center px-4 pb-16 pt-32 text-center sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="flex min-w-0 max-w-full flex-col items-center"
      >
        <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-rose-500/30 bg-rose-950/50 px-4 py-1.5 text-xs font-semibold tracking-wider text-rose-200 shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-rose-400" />
          <span>Từ {formatMemoryDateVi(loveStartDate)} đến mãi mãi về sau ♥</span>
        </div>

        <h1 className="mt-6 max-w-full break-words [overflow-wrap:anywhere] font-serif text-4xl font-bold tracking-tight text-rose-50 sm:text-6xl md:text-7xl">
          {coupleTitle}
        </h1>

        <p className="mt-5 max-w-2xl break-words [overflow-wrap:anywhere] text-base leading-relaxed text-rose-200/80 sm:text-lg">
          {heroSubtitle}
        </p>

        {/* Godly Hero Bento Metrics Strip */}
        <div className="mt-8 grid w-full max-w-xl grid-cols-1 gap-3.5 sm:grid-cols-2">
          <div className="relative">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1.5 rounded-3xl bg-gradient-to-r from-red-600/30 via-rose-500/25 to-pink-500/30 blur-xl"
            />
            <div className="godly-bento-card love-pulse-glow relative flex h-full items-center gap-3.5 rounded-2xl p-4 text-left">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-gradient-to-br from-red-600/30 to-rose-500/20 text-rose-400 shadow-inner">
                <Heart className="h-5 w-5 fill-red-500 text-red-500" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-300/85">
                  CÙNG NHAU ĐI QUA
                </p>
                <p className="love-shimmer bg-gradient-to-r from-rose-100 via-rose-400 to-pink-400 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                  {daysTogether.toLocaleString('vi-VN')} ngày bên nhau
                </p>
              </div>
            </div>
          </div>

          <div className="godly-bento-card relative flex h-full items-center gap-3.5 rounded-2xl p-4 text-left">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-pink-500/25 bg-rose-950/60 text-pink-300">
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-pink-300/85">
                KHO LƯU TRỮ KỶ NIỆM
              </p>
              <p className="text-base font-bold text-rose-50 sm:text-lg">
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
          className="mt-10 inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_14px_36px_rgba(225,29,72,0.38)] transition hover:shadow-[0_14px_38px_rgba(225,29,72,0.5)] hover:ring-1 hover:ring-rose-300/40 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
        >
          <span>Dạo bước vào miền ký ức</span>
          <ArrowDown className="h-4 w-4" />
        </button>
      </motion.div>
    </header>
  );
}
