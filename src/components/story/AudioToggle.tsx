'use client';

import React, { useEffect, useRef } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface AudioToggleProps {
  musicUrl: string;
  musicEnabled: boolean;
  isPlaying: boolean;
  onToggle: () => void;
  onSyncPlayState: (playing: boolean) => void;
}

export function AudioToggle({
  musicUrl,
  musicEnabled,
  isPlaying,
  onToggle,
  onSyncPlayState,
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

  return (
    <div className="fixed right-4 top-4 z-40 sm:right-6 sm:top-6">
      <audio ref={audioRef} src={musicUrl} loop preload="none" />
      <button
        type="button"
        onClick={onToggle}
        aria-label={isPlaying ? 'Tạm dừng nhạc nền' : 'Bật nhạc nền'}
        className="glass-pill inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-pink-200 hover:text-pink-600"
      >
        {isPlaying ? (
          <>
            <Volume2 className="h-4 w-4 text-pink-500 animate-pulse" />
            <span>Đang phát nhạc</span>
          </>
        ) : (
          <>
            <VolumeX className="h-4 w-4 text-slate-400" />
            <span>Bật nhạc nền</span>
          </>
        )}
      </button>
    </div>
  );
}
