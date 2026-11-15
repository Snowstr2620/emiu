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
    <header className="relative mx-auto flex min-h-[78vh] max-w-3xl flex-col items-center justify-center px-5 pb-14 pt-20 text-center sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <div className="glass-pill mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium tracking-wide text-slate-600">
          <Sparkles className="h-3.5 w-3.5 text-pink-500" />
          <span>Từ {formatMemoryDateVi(loveStartDate)} đến mãi sau</span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl md:text-6xl">
          {coupleTitle}
        </h1>

        <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
          {heroSubtitle}
        </p>

        <div className="glass-card mt-8 inline-flex items-center gap-3 rounded-2xl px-6 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-50 text-pink-500">
            <Heart className="h-4 w-4 fill-pink-500" />
          </span>
          <div className="text-left">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Cùng nhau đi qua
            </p>
            <p className="text-lg font-bold text-slate-900 sm:text-xl">
              {daysTogether.toLocaleString('vi-VN')} ngày bên nhau
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartJourney}
          className="mt-10 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-pink-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:brightness-105 active:scale-[0.98]"
        >
          <span>Bắt đầu hành trình</span>
          <ArrowDown className="h-4 w-4" />
        </button>
      </motion.div>
    </header>
  );
}
