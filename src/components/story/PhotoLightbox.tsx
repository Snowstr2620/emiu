'use client';

import React, { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Heart, X } from 'lucide-react';
import { formatMemoryLongDateVi } from '@/lib/date-utils';
import { MemoryItem } from '@/types/memories';

interface PhotoLightboxProps {
  memories: MemoryItem[];
  selectedIndex: number | null;
  onClose: () => void;
  onSelectIndex: (index: number) => void;
}

export function PhotoLightbox({
  memories,
  selectedIndex,
  onClose,
  onSelectIndex,
}: PhotoLightboxProps) {
  const isOpen = selectedIndex !== null && Boolean(memories[selectedIndex]);
  const memory = isOpen && selectedIndex !== null ? memories[selectedIndex] : null;

  useEffect(() => {
    if (!isOpen || selectedIndex === null) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && memories.length > 1) {
        onSelectIndex((selectedIndex! - 1 + memories.length) % memories.length);
      } else if (e.key === 'ArrowRight' && memories.length > 1) {
        onSelectIndex((selectedIndex! + 1) % memories.length);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, memories.length, onClose, onSelectIndex]);

  if (!memory || selectedIndex === null) return null;

  const hasMultiple = memories.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={memory.title || 'Xem ảnh kỷ niệm'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4 backdrop-blur-md sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass-card relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl p-4 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng xem ảnh"
          className="absolute right-4 top-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-600"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="relative flex min-h-[160px] max-h-[48vh] shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/60 p-2 sm:min-h-[200px] sm:max-h-[56vh]">
          {hasMultiple && (
            <button
              type="button"
              onClick={() =>
                onSelectIndex((selectedIndex - 1 + memories.length) % memories.length)
              }
              aria-label="Ảnh trước"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-600"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={memory.imageUrl}
            alt={memory.imageAlt || memory.title || 'Ảnh kỷ niệm'}
            className="max-h-full w-auto max-w-full rounded-xl object-contain"
          />

          {hasMultiple && (
            <button
              type="button"
              onClick={() => onSelectIndex((selectedIndex + 1) % memories.length)}
              aria-label="Ảnh tiếp theo"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow-sm transition hover:bg-pink-50 hover:text-pink-600"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
              <Heart className="h-3 w-3 fill-pink-500 text-pink-500" />
              {formatMemoryLongDateVi(memory.memoryDate)}
            </span>
            {hasMultiple && (
              <span className="text-xs font-medium text-slate-500">
                Khoảnh khắc {selectedIndex + 1} / {memories.length}
              </span>
            )}
          </div>
          {memory.title && (
            <h3 className="mt-2.5 break-words [overflow-wrap:anywhere] font-serif text-xl font-bold text-slate-900 sm:text-2xl">
              {memory.title}
            </h3>
          )}
          <p className="mt-1.5 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-slate-600 sm:text-base">
            {memory.story}
          </p>
        </div>
      </div>
    </div>
  );
}
