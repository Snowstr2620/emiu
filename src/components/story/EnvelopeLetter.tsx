'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Mail, MailOpen, Sparkles } from 'lucide-react';

interface EnvelopeLetterProps {
  letterTitle: string;
  letterBody: string;
  letterSignature: string;
  onOpen?: () => void;
}

const SEAL_BURST_HEARTS = [
  { x: -46, y: -24, rotate: -18, delay: 0.02, color: '#ef4444' },
  { x: -22, y: -38, rotate: -8, delay: 0.06, color: '#f43f5e' },
  { x: 0, y: -44, rotate: 4, delay: 0.1, color: '#fb7185' },
  { x: 24, y: -36, rotate: 12, delay: 0.14, color: '#f472b6' },
  { x: 48, y: -20, rotate: 20, delay: 0.18, color: '#fda4af' },
];

export function EnvelopeLetter({
  letterTitle,
  letterBody,
  letterSignature,
  onOpen,
}: EnvelopeLetterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const paragraphs = letterBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  function handleOpenLetter() {
    if (!isOpen) {
      setIsOpen(true);
      onOpen?.();
    }
  }

  return (
    <section id="letter" className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/55 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-rose-200 shadow-sm">
          <Mail className="h-3.5 w-3.5 text-rose-400" />
          Lời thì thầm cuối trang
        </span>
        <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-rose-50 sm:text-4xl">
          Bức tâm thư ủ đầy thương nhớ gửi em
        </h2>
      </div>

      {!isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card relative mx-auto overflow-hidden rounded-3xl p-8 text-center sm:p-12"
        >
          {/* Glowing ruby wax heart seal */}
          <div className="mx-auto mb-6 flex h-28 w-44 items-center justify-center rounded-2xl border border-rose-500/25 bg-gradient-to-br from-[#1f0914] via-[#15060d] to-[#260b18] shadow-[inset_0_1px_0_rgba(255,228,230,0.08)]">
            <button
              type="button"
              onClick={handleOpenLetter}
              aria-label="Mở dấu niêm phong trái tim"
              className="love-pulse-glow group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-red-600 via-rose-600 to-pink-600 text-white shadow-[0_10px_28px_rgba(225,29,72,0.45)] transition hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <Heart className="h-6 w-6 fill-white transition group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none" />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-rose-200/80 sm:text-base">
            Có những điều ngọt ngào anh giấu kỹ dưới dấu sáp trái tim này — chạm nhẹ để nghe lòng
            anh thì thầm cùng em nhé.
          </p>

          <button
            type="button"
            onClick={handleOpenLetter}
            className="mt-6 inline-flex min-h-[44px] items-center gap-2.5 rounded-full bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 px-7 py-3.5 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(225,29,72,0.36)] transition hover:shadow-[0_14px_38px_rgba(225,29,72,0.5)] hover:ring-1 hover:ring-rose-300/40 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
          >
            <MailOpen className="h-4 w-4" />
            <span>Chạm để mở thư</span>
          </button>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="glass-card relative overflow-hidden rounded-3xl p-5 sm:p-10"
        >
          {/* Animated mini-hearts burst upon opening */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-16 z-10 -translate-x-1/2"
          >
            {SEAL_BURST_HEARTS.map((item, idx) => (
              <motion.span
                key={idx}
                initial={{ opacity: 0.95, x: 0, y: 0, scale: 0.4, rotate: 0 }}
                animate={{
                  opacity: 0,
                  x: item.x,
                  y: item.y,
                  scale: 1.05,
                  rotate: item.rotate,
                }}
                transition={{ duration: 0.85, delay: item.delay, ease: 'easeOut' }}
                className="absolute"
              >
                <Heart
                  className="h-3.5 w-3.5"
                  style={{ color: item.color, fill: item.color }}
                />
              </motion.span>
            ))}
          </div>

          <div className="rounded-2xl border border-rose-400/25 bg-[#16070d]/95 p-6 shadow-[inset_0_1px_0_rgba(255,228,230,0.07)] sm:p-10">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-rose-500/20 pb-4">
              <h3 className="min-w-0 break-words [overflow-wrap:anywhere] font-serif text-2xl font-semibold text-rose-50 sm:text-3xl">
                {letterTitle}
              </h3>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-rose-500/25 bg-rose-950/60 text-rose-400">
                <Sparkles className="h-4 w-4" />
              </span>
            </div>

            <div className="space-y-4 font-serif text-lg leading-relaxed text-rose-100/90 sm:text-xl">
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                  {paragraph}
                </p>
              ))}
            </div>

            {letterSignature && (
              <div className="mt-8 whitespace-pre-line break-words [overflow-wrap:anywhere] border-t border-rose-500/20 pt-5 text-right font-serif text-lg italic text-rose-300 sm:text-xl">
                {letterSignature}
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-[36px] items-center rounded-full px-3 py-2 text-xs font-medium text-rose-300/75 transition hover:text-rose-200"
            >
              Gấp lại phong thư giữ vào tim
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
