'use client';

import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface AudioToggleProps {
  musicUrl: string;
  musicEnabled: boolean;
  isPlaying: boolean;
  onToggle: () => void;
  onSyncPlayState: (playing: boolean) => void;
  inline?: boolean;
}

export function AudioToggle({
  musicUrl,
  musicEnabled,
  isPlaying,
  onToggle,
  onSyncPlayState,
  inline = false,
}: AudioToggleProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicEnabled || !musicUrl) return;

    audio.volume = 0.35;
    if (isPlaying) {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          onSyncPlayState(false);
        });
      }
    } else {
      audio.pause();
    }
  }, [isPlaying, musicEnabled, musicUrl, onSyncPlayState]);

  if (!musicEnabled || !musicUrl) {
    return null;
  }

  const wrapperClassName = inline
    ? 'relative shrink-0'
    : 'fixed right-4 top-4 z-40 sm:right-6 sm:top-6';

  return (
    <div className={wrapperClassName}>
      <audio ref={audioRef} src={musicUrl} loop preload="none" />
      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? 'Tạm dừng nhạc nền' : 'Bật nhạc nền'}
        className="glass-pill inline-flex min-h-[36px] items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-pink-200 hover:text-pink-600 sm:gap-2 sm:px-3.5 sm:py-2 sm:text-xs"
      >
        {isPlaying ? (
          <>
            <Volume2 className="h-3 w-3 text-pink-500 animate-pulse motion-reduce:animate-none sm:h-4 sm:w-4" />
            <span>Đang phát nhạc</span>
          </>
        ) : (
          <>
            <VolumeX className="h-3 w-3 text-slate-400 sm:h-4 sm:w-4" />
            <span>Bật nhạc nền</span>
          </>
        )}
      </button>
    </div>
  );
}
