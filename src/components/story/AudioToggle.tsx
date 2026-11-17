'use client';

import React, { useCallback, useEffect, useRef } from 'react';
import { Volume2 } from 'lucide-react';

const DEFAULT_MUSIC_URL = '/samples/gentle-memories.wav';
const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'click'] as const;

interface AudioToggleProps {
  musicUrl: string;
  inline?: boolean;
  onAutoStart?: () => void;
}

export function AudioToggle({
  musicUrl,
  inline = false,
  onAutoStart,
}: AudioToggleProps) {
  const effectiveMusicUrl = (musicUrl || '').trim() || DEFAULT_MUSIC_URL;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pausedForVideoRef = useRef(false);
  const unmountedRef = useRef(false);
  const hasReportedAutoStartRef = useRef(false);
  const gestureAttachedRef = useRef(false);
  const onAutoStartRef = useRef(onAutoStart);
  onAutoStartRef.current = onAutoStart;

  const attemptPlayRef = useRef<() => void>(() => {});

  const detachGestureListeners = useCallback(() => {
    if (!gestureAttachedRef.current) return;
    gestureAttachedRef.current = false;
    for (const evt of GESTURE_EVENTS) {
      document.removeEventListener(evt, handleFirstGesture, true);
    }
  }, []);

  function handleFirstGesture() {
    if (unmountedRef.current || pausedForVideoRef.current) return;
    attemptPlayRef.current();
  }

  const attachGestureListeners = useCallback(() => {
    if (gestureAttachedRef.current || unmountedRef.current) return;
    gestureAttachedRef.current = true;
    for (const evt of GESTURE_EVENTS) {
      document.addEventListener(evt, handleFirstGesture, true);
    }
  }, []);

  const attemptPlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || unmountedRef.current || pausedForVideoRef.current) return;

    audio.volume = 0.35;
    audio.loop = true;

    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            detachGestureListeners();
            if (!hasReportedAutoStartRef.current) {
              hasReportedAutoStartRef.current = true;
              onAutoStartRef.current?.();
            }
          })
          .catch(() => {
            if (!unmountedRef.current && !pausedForVideoRef.current) {
              attachGestureListeners();
            }
          });
      } else {
        detachGestureListeners();
        if (!hasReportedAutoStartRef.current) {
          hasReportedAutoStartRef.current = true;
          onAutoStartRef.current?.();
        }
      }
    } catch {
      if (!unmountedRef.current && !pausedForVideoRef.current) {
        attachGestureListeners();
      }
    }
  }, [attachGestureListeners, detachGestureListeners]);

  attemptPlayRef.current = attemptPlay;

  useEffect(() => {
    unmountedRef.current = false;
    attemptPlay();

    return () => {
      unmountedRef.current = true;
      detachGestureListeners();
    };
  }, [effectiveMusicUrl, attemptPlay, detachGestureListeners]);

  useEffect(() => {
    function handleVideoPlay(event: Event) {
      const target = event.target;
      if (
        target instanceof Element &&
        target.tagName === 'VIDEO' &&
        !(target as HTMLVideoElement).muted
      ) {
        pausedForVideoRef.current = true;
        audioRef.current?.pause();
      }
    }

    function handleVideoStop(event: Event) {
      const target = event.target;
      if (!(target instanceof Element) || target.tagName !== 'VIDEO') return;
      if (!pausedForVideoRef.current) return;

      const videos = Array.from(document.querySelectorAll('video'));
      const hasOtherActiveVideo = videos.some(
        (v) => v !== target && !v.paused && !v.ended && !v.muted
      );
      if (!hasOtherActiveVideo) {
        pausedForVideoRef.current = false;
        attemptPlay();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      const videos = Array.from(document.querySelectorAll('video'));
      const hasActiveVideo = videos.some((v) => !v.paused && !v.ended && !v.muted);
      if (!hasActiveVideo) {
        pausedForVideoRef.current = false;
        attemptPlay();
      }
    }

    document.addEventListener('play', handleVideoPlay, true);
    document.addEventListener('pause', handleVideoStop, true);
    document.addEventListener('ended', handleVideoStop, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('play', handleVideoPlay, true);
      document.removeEventListener('pause', handleVideoStop, true);
      document.removeEventListener('ended', handleVideoStop, true);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [attemptPlay]);

  function handleUnexpectedPause() {
    if (
      unmountedRef.current ||
      pausedForVideoRef.current ||
      document.visibilityState === 'hidden'
    ) {
      return;
    }
    const audio = audioRef.current;
    if (!audio || audio.ended) return;
    attemptPlay();
  }

  const wrapperClassName = inline
    ? 'relative shrink-0'
    : 'fixed right-3 top-3 z-40 sm:right-6 sm:top-5';

  return (
    <div className={wrapperClassName}>
      <audio
        ref={audioRef}
        src={effectiveMusicUrl}
        autoPlay
        loop
        preload="auto"
        data-testid="ambient-audio"
        onPlay={detachGestureListeners}
        onPause={handleUnexpectedPause}
      />
      <div
        role="status"
        data-testid="ambient-music-pill"
        aria-label="Nhạc nền đang phát tự động"
        className="glass-pill inline-flex min-h-[36px] items-center gap-1.5 whitespace-nowrap rounded-full border-red-300/80 px-2.5 py-1.5 text-[11px] font-semibold text-red-900 shadow-[0_4px_16px_rgba(220,38,38,0.12)] sm:px-3.5 sm:py-2 sm:text-xs"
      >
        <Volume2
          aria-hidden="true"
          className="h-3.5 w-3.5 shrink-0 text-red-600 animate-pulse motion-reduce:animate-none sm:h-4 sm:w-4"
        />
        <span className="hidden 2xl:inline">Đang phát nhạc nền</span>
        <span className="2xl:hidden">Nhạc nền</span>
      </div>
    </div>
  );
}
