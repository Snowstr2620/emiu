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
  { x: -46, y: -24, rotate: -18, delay: 0.02 },
  { x: -22, y: -38, rotate: -8, delay: 0.06 },
  { x: 0, y: -44, rotate: 4, delay: 0.1 },
  { x: 24, y: -36, rotate: 12, delay: 0.14 },
  { x: 48, y: -20, rotate: 20, delay: 0.18 },
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
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/85 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-pink-600 shadow-sm">
          <Mail className="h-3.5 w-3.5" />
          Lời thì thầm cuối trang
        </span>
        <h2 className="mt-3 font-serif text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
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
          {/* Glowing wax heart seal */}
          <div className="mx-auto mb-6 flex h-28 w-44 items-center justify-center rounded-2xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/75 to-rose-50/75 shadow-sm">
            <button
              type="button"
              onClick={handleOpenLetter}
              aria-label="Mở dấu niêm phong trái tim"
              className="love-pulse-glow group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-md shadow-pink-500/25 transition hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none"
            >
              <Heart className="h-6 w-6 fill-white transition group-hover:scale-110 motion-reduce:transform-none motion-reduce:transition-none" />
            </button>
          </div>

          <p className="text-sm leading-relaxed text-slate-600 sm:text-base">
            Có những điều ngọt ngào anh giấu kỹ dưới dấu sáp trái tim này — chạm nhẹ để nghe lòng
            anh thì thầm cùng em nhé.
          </p>

          <button
            type="button"
            onClick={handleOpenLetter}
            className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-rose-400 via-pink-500 to-indigo-400 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:brightness-105 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
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
                <Heart className="h-3.5 w-3.5 fill-rose-400 text-rose-400" />
              </motion.span>
            ))}
          </div>

          <div className="rounded-2xl border border-pink-100/80 bg-gradient-to-b from-[#fffdfd] to-[#fff7fa] p-6 shadow-inner sm:p-10">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-pink-100/70 pb-4">
              <h3 className="break-words [overflow-wrap:anywhere] font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">
                {letterTitle}
              </h3>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-50 text-pink-500">
                <Sparkles className="h-4 w-4" />
              </span>
            </div>

            <div className="space-y-4 font-serif text-lg leading-relaxed text-slate-700 sm:text-xl">
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line break-words [overflow-wrap:anywhere]">
                  {paragraph}
                </p>
              ))}
            </div>

            {letterSignature && (
              <div className="mt-8 whitespace-pre-line break-words [overflow-wrap:anywhere] border-t border-pink-100/70 pt-5 text-right font-serif text-lg italic text-pink-700 sm:text-xl">
                {letterSignature}
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="inline-flex min-h-[36px] items-center rounded-full px-3 py-2 text-xs font-medium text-slate-400 transition hover:text-pink-500"
            >
              Gấp lại phong thư giữ vào tim
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
