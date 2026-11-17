'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Volume2 } from 'lucide-react';
import { DEFAULT_MUSIC_URL, normalizePlaylist } from '@/lib/music-playlist';

const GESTURE_EVENTS = ['pointerdown', 'touchstart', 'keydown', 'click'] as const;
/** Grace period so the music keeps going while one page swaps to the next. */
const RELEASE_DELAY_MS = 1500;
/** How often to re-check, while paused for a video, whether that video is gone. */
const VIDEO_RESUME_CHECK_MS = 1000;

function toPlayablePlaylist(playlist: string[] | undefined, musicUrl: string | undefined): string[] {
  const list = normalizePlaylist(playlist);
  if (list.length > 0) return list;
  const single = (musicUrl || '').trim();
  return [single || DEFAULT_MUSIC_URL];
}

interface AmbientAudioEngineProps {
  playlist: string[];
  onAutoStart?: () => void;
}

/**
 * The actual <audio> player: autoplays (or waits for the first gesture when
 * the browser blocks autoplay), plays the playlist in order and loops back to
 * the first track, and pauses while an unmuted <video> is playing.
 */
function AmbientAudioEngine({ playlist, onAutoStart }: AmbientAudioEngineProps) {
  const [trackIndex, setTrackIndex] = useState(0);
  const playlistKey = playlist.join('\n');
  const safeIndex = trackIndex < playlist.length ? trackIndex : 0;
  const currentSrc = playlist[safeIndex];

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pausedForVideoRef = useRef(false);
  const unmountedRef = useRef(false);
  const hasReportedAutoStartRef = useRef(false);
  const gestureAttachedRef = useRef(false);
  const consecutiveErrorsRef = useRef(0);
  const onAutoStartRef = useRef(onAutoStart);
  onAutoStartRef.current = onAutoStart;

  const attemptPlayRef = useRef<() => void>(() => {});

  // A changed playlist (edited in admin) starts again from its first track.
  useEffect(() => {
    setTrackIndex(0);
    consecutiveErrorsRef.current = 0;
  }, [playlistKey]);

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
  }, [currentSrc, attemptPlay]);

  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      detachGestureListeners();
    };
  }, [detachGestureListeners]);

  useEffect(() => {
    let watchTimer: ReturnType<typeof setInterval> | null = null;

    function hasSound(v: HTMLVideoElement): boolean {
      return !v.muted && v.volume > 0;
    }

    function isAudibleVideo(v: HTMLVideoElement): boolean {
      return !v.paused && !v.ended && hasSound(v);
    }

    function hasAudibleVideo(): boolean {
      return Array.from(document.querySelectorAll('video')).some(isAudibleVideo);
    }

    function stopWatching() {
      if (watchTimer) {
        clearInterval(watchTimer);
        watchTimer = null;
      }
    }

    function resumeIfNoAudibleVideo() {
      if (!pausedForVideoRef.current || hasAudibleVideo()) return;
      pausedForVideoRef.current = false;
      stopWatching();
      attemptPlay();
    }

    function pauseForVideo() {
      pausedForVideoRef.current = true;
      audioRef.current?.pause();
      // A playing video that is removed from the page (popup closed, next photo, back to
      // the timeline) stops without a `pause` event reaching the document, so keep
      // checking until no audible video is left.
      if (!watchTimer) {
        watchTimer = setInterval(resumeIfNoAudibleVideo, VIDEO_RESUME_CHECK_MS);
      }
    }

    function isVideoEvent(event: Event): event is Event & { target: HTMLVideoElement } {
      return event.target instanceof Element && event.target.tagName === 'VIDEO';
    }

    function handleVideoPlay(event: Event) {
      // A `play` event already means the video is starting, so only its sound matters here.
      if (isVideoEvent(event) && hasSound(event.target)) pauseForVideo();
    }

    function handleVideoStop(event: Event) {
      if (isVideoEvent(event)) resumeIfNoAudibleVideo();
    }

    function handleVolumeChange(event: Event) {
      if (!isVideoEvent(event)) return;
      if (isAudibleVideo(event.target)) {
        pauseForVideo();
      } else {
        resumeIfNoAudibleVideo();
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!hasAudibleVideo()) {
        pausedForVideoRef.current = false;
        stopWatching();
        attemptPlay();
      }
    }

    document.addEventListener('play', handleVideoPlay, true);
    document.addEventListener('pause', handleVideoStop, true);
    document.addEventListener('ended', handleVideoStop, true);
    document.addEventListener('emptied', handleVideoStop, true);
    document.addEventListener('volumechange', handleVolumeChange, true);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopWatching();
      document.removeEventListener('play', handleVideoPlay, true);
      document.removeEventListener('pause', handleVideoStop, true);
      document.removeEventListener('ended', handleVideoStop, true);
      document.removeEventListener('emptied', handleVideoStop, true);
      document.removeEventListener('volumechange', handleVolumeChange, true);
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

  function goToNextTrack() {
    setTrackIndex((prev) => (prev + 1) % playlist.length);
  }

  function handleEnded() {
    consecutiveErrorsRef.current = 0;
    if (playlist.length > 1) {
      goToNextTrack();
    }
  }

  function handleError() {
    // Skip a broken track, but stop trying once every track has failed in a row.
    consecutiveErrorsRef.current += 1;
    if (playlist.length > 1 && consecutiveErrorsRef.current < playlist.length) {
      goToNextTrack();
    }
  }

  return (
    <audio
      ref={audioRef}
      src={currentSrc}
      autoPlay
      loop={playlist.length === 1}
      preload="auto"
      data-testid="ambient-audio"
      data-track-index={safeIndex}
      onPlay={() => {
        consecutiveErrorsRef.current = 0;
        detachGestureListeners();
      }}
      onPause={handleUnexpectedPause}
      onEnded={handleEnded}
      onError={handleError}
    />
  );
}

interface AmbientAudioContextValue {
  register: (playlist: string[], onAutoStart?: () => void) => () => void;
}

const AmbientAudioContext = createContext<AmbientAudioContextValue | null>(null);

/**
 * Lives in the root layout so a single player survives client-side page
 * navigation (e.g. home → memory detail): the music keeps playing instead of
 * restarting. Pages opt in by rendering <AudioToggle>; when no page asks for
 * music (admin, login gate) the player stops after a short grace period.
 */
export function AmbientAudioProvider({ children }: { children: React.ReactNode }) {
  const [playlist, setPlaylist] = useState<string[] | null>(null);
  const ownersRef = useRef(0);
  const releaseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onAutoStartRef = useRef<(() => void) | undefined>(undefined);

  const register = useCallback((nextPlaylist: string[], onAutoStart?: () => void) => {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    ownersRef.current += 1;
    onAutoStartRef.current = onAutoStart;
    const nextKey = nextPlaylist.join('\n');
    setPlaylist((prev) => (prev && prev.join('\n') === nextKey ? prev : nextPlaylist));

    return () => {
      ownersRef.current = Math.max(0, ownersRef.current - 1);
      if (ownersRef.current > 0) return;
      releaseTimerRef.current = setTimeout(() => {
        releaseTimerRef.current = null;
        if (ownersRef.current === 0) setPlaylist(null);
      }, RELEASE_DELAY_MS);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  const value = useMemo(() => ({ register }), [register]);
  const handleAutoStart = useCallback(() => onAutoStartRef.current?.(), []);

  return (
    <AmbientAudioContext.Provider value={value}>
      {children}
      {playlist ? <AmbientAudioEngine playlist={playlist} onAutoStart={handleAutoStart} /> : null}
    </AmbientAudioContext.Provider>
  );
}

interface AudioToggleProps {
  musicUrl?: string;
  /** Ordered tracks; falls back to `musicUrl`, then the bundled sample. */
  playlist?: string[];
  inline?: boolean;
  onAutoStart?: () => void;
}

export function AudioToggle({ musicUrl, playlist, inline = false, onAutoStart }: AudioToggleProps) {
  const context = useContext(AmbientAudioContext);
  const playableKey = toPlayablePlaylist(playlist, musicUrl).join('\n');
  const playable = useMemo(() => playableKey.split('\n'), [playableKey]);
  const onAutoStartRef = useRef(onAutoStart);
  onAutoStartRef.current = onAutoStart;

  useEffect(() => {
    if (!context) return;
    return context.register(playable, () => onAutoStartRef.current?.());
  }, [context, playable]);

  const wrapperClassName = inline
    ? 'relative shrink-0'
    : 'fixed right-3 top-3 z-40 sm:right-6 sm:top-5';

  return (
    <div className={wrapperClassName}>
      {context ? null : (
        <AmbientAudioEngine playlist={playable} onAutoStart={() => onAutoStartRef.current?.()} />
      )}
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
