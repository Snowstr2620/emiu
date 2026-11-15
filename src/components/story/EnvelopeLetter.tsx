'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Mail, MailOpen } from 'lucide-react';

interface EnvelopeLetterProps {
  letterTitle: string;
  letterBody: string;
  letterSignature: string;
}

export function EnvelopeLetter({
  letterTitle,
  letterBody,
  letterSignature,
}: EnvelopeLetterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const paragraphs = letterBody
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section id="letter" className="mx-auto max-w-2xl px-4 pb-24 pt-10 sm:px-6">
      <div className="mb-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-pink-600 shadow-sm">
          <Mail className="h-3.5 w-3.5" />
          Lời nhắn cuối trang
        </span>
        <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Có một bức thư dành riêng cho bạn
        </h2>
      </div>

      {!isOpen ? (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass-card relative mx-auto overflow-hidden rounded-3xl p-8 text-center sm:p-12"
        >
          {/* Envelope top flap accent */}
          <div
            aria-hidden="true"
            className="mx-auto mb-6 flex h-24 w-36 items-center justify-center rounded-2xl border border-pink-100 bg-gradient-to-br from-white via-pink-50/70 to-sky-50/70 shadow-sm"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-500/10 text-pink-500">
              <Heart className="h-6 w-6 fill-pink-500" />
            </div>
          </div>

          <p className="text-sm text-slate-600 sm:text-base">
            Chạm nhẹ vào chiếc phong thư bên dưới để mở những lời mình muốn nói.
          </p>

          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className="mt-6 inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-pink-500 to-indigo-500 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/20 transition hover:brightness-105 active:scale-[0.98]"
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
          className="glass-card relative overflow-hidden rounded-3xl p-6 sm:p-10"
        >
          <div className="rounded-2xl border border-pink-100/80 bg-white/90 p-6 shadow-inner sm:p-10">
            <div className="mb-5 flex items-center justify-between border-b border-slate-100 pb-4">
              <h3 className="font-serif text-2xl font-semibold text-slate-900 sm:text-3xl">
                {letterTitle}
              </h3>
              <Heart className="h-5 w-5 shrink-0 fill-pink-400 text-pink-400" />
            </div>

            <div className="space-y-4 font-serif text-lg leading-relaxed text-slate-700 sm:text-xl">
              {paragraphs.map((paragraph, i) => (
                <p key={i} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
            </div>

            {letterSignature && (
              <div className="mt-8 border-t border-slate-100 pt-5 text-right font-serif text-lg italic text-pink-700 whitespace-pre-line sm:text-xl">
                {letterSignature}
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
            >
              Gấp lại phong thư
            </button>
          </div>
        </motion.div>
      )}
    </section>
  );
}
