'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Heart, Images, X } from 'lucide-react';
import { formatMemoryLongDateVi } from '@/lib/date-utils';
import {
  formatAlbumMediaCountVi,
  getMemoryImages,
  isVideoMediaItem,
  isVideoMediaUrl,
} from '@/lib/memory-album';
import { useModalFocusTrap } from '@/lib/useModalFocusTrap';
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
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useModalFocusTrap({
    isOpen,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });

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

  const albumImages = getMemoryImages(memory);
  const coverIsVideo =
    (albumImages[0] ? isVideoMediaItem(albumImages[0]) : false) ||
    isVideoMediaUrl(memory.imageUrl);
  const hasMultiple = memories.length > 1;
  const counterLabel = `#${String(selectedIndex + 1).padStart(2, '0')} / ${String(
    memories.length
  ).padStart(2, '0')}`;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={memory.title || 'Xem ảnh kỷ niệm'}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-stone-950/60 p-4 backdrop-blur-lg sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="glass-card relative my-auto flex w-full max-w-3xl flex-col overflow-hidden rounded-3xl p-4 sm:p-6 [@media(min-height:560px)]:max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-semibold tracking-wider text-amber-950">
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(220,38,38,0.75)]"
              />
              {counterLabel}
            </span>
            {hasMultiple && (
              <span className="hidden text-[11px] font-medium tracking-wider text-stone-600 sm:inline">
                ← · → · ESC
              </span>
            )}
          </div>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Đóng xem ảnh"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-amber-300/80 bg-[#FFFDF5]/95 text-stone-800 shadow-sm transition hover:border-red-300 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="relative flex min-h-[160px] max-h-[48vh] shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-amber-300/70 bg-[#FEF9C3]/55 p-2 sm:max-h-[56vh] [@media(min-height:560px)]:sm:min-h-[200px]">
          {hasMultiple && (
            <button
              type="button"
              onClick={() =>
                onSelectIndex((selectedIndex - 1 + memories.length) % memories.length)
              }
              aria-label="Ảnh trước"
              className="absolute left-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/85 bg-[#FFFDF5]/95 text-stone-800 shadow-md transition hover:border-red-400 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}

          {coverIsVideo ? (
            <video
              key={memory.imageUrl}
              src={memory.imageUrl}
              controls
              autoPlay
              playsInline
              preload="metadata"
              aria-label={memory.imageAlt || memory.title || 'Video kỷ niệm'}
              className="max-h-[calc(48vh-1rem)] w-auto max-w-full rounded-xl object-contain sm:max-h-[calc(56vh-1rem)]"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={memory.imageUrl}
              alt={memory.imageAlt || memory.title || 'Ảnh kỷ niệm'}
              className="max-h-[calc(48vh-1rem)] w-auto max-w-full rounded-xl object-contain sm:max-h-[calc(56vh-1rem)]"
            />
          )}

          {hasMultiple && (
            <button
              type="button"
              onClick={() => onSelectIndex((selectedIndex + 1) % memories.length)}
              aria-label="Ảnh tiếp theo"
              className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-amber-300/85 bg-[#FFFDF5]/95 text-stone-800 shadow-md transition hover:border-red-400 hover:bg-amber-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-3 py-1 text-xs font-semibold text-amber-950">
              <Heart className="h-3 w-3 fill-red-500 text-red-500" />
              {formatMemoryLongDateVi(memory.memoryDate)}
            </span>
            {hasMultiple && (
              <span className="text-xs font-medium text-stone-600">
                Khoảnh khắc {selectedIndex + 1} / {memories.length}
              </span>
            )}
          </div>
          {memory.title && (
            <h3 className="mt-2.5 break-words [overflow-wrap:anywhere] font-serif text-xl font-bold text-stone-900 sm:text-2xl">
              {memory.title}
            </h3>
          )}
          <p className="mt-1.5 whitespace-pre-line break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-stone-700 sm:text-base">
            {memory.story}
          </p>
          {albumImages.length > 1 && (
            <div className="mt-3">
              <Link
                href={`/memories/${memory.id}`}
                onClick={onClose}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-amber-300/80 bg-amber-100/80 px-4 py-1.5 text-xs font-semibold text-stone-900 transition hover:border-red-300 hover:bg-amber-200/80 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <Images className="h-3.5 w-3.5 shrink-0 text-red-600" />
                <span>Xem trọn bộ album ({formatAlbumMediaCountVi(albumImages)})</span>
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
