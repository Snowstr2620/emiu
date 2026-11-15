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
  onStartJourney: () => void;
}

export function HeroSection({
  coupleTitle,
  heroSubtitle,
  loveStartDate,
  daysTogether,
  onStartJourney,
}: HeroSectionProps) {
  return (
    <header className="relative mx-auto flex min-h-[82vh] max-w-3xl flex-col items-center justify-center px-5 pb-14 pt-32 text-center sm:px-8 sm:pt-32">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="flex min-w-0 max-w-full flex-col items-center"
      >
        <div className="glass-pill mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-pink-700/90">
          <Sparkles className="h-3.5 w-3.5 text-pink-500" />
          <span>Từ {formatMemoryDateVi(loveStartDate)} đến mãi mãi về sau ♥</span>
        </div>

        <h1 className="max-w-full break-words [overflow-wrap:anywhere] font-serif text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          {coupleTitle}
        </h1>

        <p className="mt-5 max-w-xl break-words [overflow-wrap:anywhere] text-base leading-relaxed text-slate-600 sm:text-lg">
          {heroSubtitle}
        </p>

        <div className="relative mt-8 inline-flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-2 rounded-3xl bg-gradient-to-r from-pink-200/45 via-rose-200/40 to-indigo-200/45 blur-xl"
          />
          <div className="glass-card love-pulse-glow relative inline-flex items-center gap-3.5 rounded-2xl border-pink-100/80 px-6 py-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-rose-100 to-pink-100 text-rose-500 shadow-inner">
              <Heart className="h-5 w-5 fill-rose-500" />
            </span>
            <div className="text-left">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-pink-500">
                Nhịp tim mình chung lối
              </p>
              <p className="love-shimmer bg-gradient-to-r from-slate-900 via-pink-600 to-indigo-600 bg-clip-text text-lg font-bold text-transparent sm:text-xl">
                {daysTogether.toLocaleString('vi-VN')} ngày bên nhau
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartJourney}
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-400 via-pink-500 to-indigo-400 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:brightness-105 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
        >
          <span>Dạo bước vào miền ký ức</span>
          <ArrowDown className="h-4 w-4" />
        </button>
      </motion.div>
    </header>
  );
}
