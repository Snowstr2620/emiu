'use client';

import React, { useEffect, useRef, useState } from 'react';

interface FloatingParticle {
  id: number;
  kind: 'petal' | 'heart';
  leftPercent: number;
  sizePx: number;
  durationSec: number;
  delaySec: number;
  driftPx: number;
  rotateDeg: number;
  opacity: number;
  color: string;
  desktopOnly: boolean;
}

interface BurstHeartOffset {
  id: number;
  bx: number;
  by: number;
  rot: number;
  size: number;
  color: string;
}

interface HeartBurst {
  id: number;
  x: number;
  y: number;
  hearts: BurstHeartOffset[];
}

const FLOATING_PARTICLES: FloatingParticle[] = [
  { id: 1, kind: 'petal', leftPercent: 6, sizePx: 14, durationSec: 15, delaySec: -2, driftPx: 34, rotateDeg: 210, opacity: 0.55, color: '#fbcfe8', desktopOnly: false },
  { id: 2, kind: 'heart', leftPercent: 14, sizePx: 12, durationSec: 17, delaySec: -6, driftPx: -26, rotateDeg: 0, opacity: 0.45, color: '#f9a8d4', desktopOnly: false },
  { id: 3, kind: 'petal', leftPercent: 24, sizePx: 12, durationSec: 19, delaySec: -9, driftPx: 28, rotateDeg: 260, opacity: 0.5, color: '#fda4af', desktopOnly: false },
  { id: 4, kind: 'heart', leftPercent: 35, sizePx: 11, durationSec: 16, delaySec: -4, driftPx: 22, rotateDeg: 0, opacity: 0.42, color: '#ddd6fe', desktopOnly: false },
  { id: 5, kind: 'petal', leftPercent: 48, sizePx: 15, durationSec: 18, delaySec: -11, driftPx: -30, rotateDeg: 190, opacity: 0.52, color: '#f9a8d4', desktopOnly: false },
  { id: 6, kind: 'heart', leftPercent: 60, sizePx: 12, durationSec: 15, delaySec: -3, driftPx: -18, rotateDeg: 0, opacity: 0.48, color: '#fb7185', desktopOnly: false },
  { id: 7, kind: 'petal', leftPercent: 72, sizePx: 13, durationSec: 20, delaySec: -7, driftPx: 26, rotateDeg: 240, opacity: 0.46, color: '#e9d5ff', desktopOnly: false },
  { id: 8, kind: 'heart', leftPercent: 83, sizePx: 11, durationSec: 17, delaySec: -13, driftPx: -24, rotateDeg: 0, opacity: 0.44, color: '#fda4af', desktopOnly: false },
  { id: 9, kind: 'petal', leftPercent: 93, sizePx: 14, durationSec: 16, delaySec: -5, driftPx: -28, rotateDeg: 200, opacity: 0.5, color: '#fbcfe8', desktopOnly: false },
  // Extra elements visible >= 640px for richer tablet/desktop density (~15 total)
  { id: 10, kind: 'heart', leftPercent: 10, sizePx: 13, durationSec: 19, delaySec: -10, driftPx: 30, rotateDeg: 0, opacity: 0.45, color: '#f472b6', desktopOnly: true },
  { id: 11, kind: 'petal', leftPercent: 29, sizePx: 14, durationSec: 17, delaySec: -1, driftPx: -22, rotateDeg: 230, opacity: 0.48, color: '#ffe4e6', desktopOnly: true },
  { id: 12, kind: 'heart', leftPercent: 42, sizePx: 10, durationSec: 21, delaySec: -14, driftPx: 18, rotateDeg: 0, opacity: 0.4, color: '#f9a8d4', desktopOnly: true },
  { id: 13, kind: 'petal', leftPercent: 55, sizePx: 13, durationSec: 16, delaySec: -8, driftPx: 32, rotateDeg: 250, opacity: 0.46, color: '#ddd6fe', desktopOnly: true },
  { id: 14, kind: 'heart', leftPercent: 67, sizePx: 12, durationSec: 18, delaySec: -12, driftPx: -28, rotateDeg: 0, opacity: 0.45, color: '#fb7185', desktopOnly: true },
  { id: 15, kind: 'petal', leftPercent: 88, sizePx: 15, durationSec: 20, delaySec: -15, driftPx: 20, rotateDeg: 215, opacity: 0.48, color: '#fbcfe8', desktopOnly: true },
];

const BURST_COLORS = ['#fb7185', '#f472b6', '#f9a8d4', '#fda4af', '#c4b5fd'];
const MAX_CONCURRENT_BURSTS = 5;
const BURST_DURATION_MS = 750;

function createBurstHearts(): BurstHeartOffset[] {
  const angles = [-125, -80, -40, 15, 60];
  return angles.map((deg, idx) => {
    const rad = (deg * Math.PI) / 180;
    const distance = 26 + (idx % 2) * 14;
    return {
      id: idx,
      bx: Math.round(Math.cos(rad) * distance),
      by: Math.round(Math.sin(rad) * distance - 14),
      rot: (idx % 2 === 0 ? 1 : -1) * (10 + idx * 5),
      size: 10 + (idx % 3) * 2,
      color: BURST_COLORS[idx % BURST_COLORS.length],
    };
  });
}

function shouldSkipBurstTarget(target: EventTarget | null): boolean {
  if (!target || typeof Element === 'undefined' || !(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [data-no-heart-burst]')
  );
}

export function LoveEffectsLayer() {
  // Keep initial render aligned with SSR to prevent hydration mismatches;
  // CSS @media (prefers-reduced-motion: reduce) blocks animations before mount.
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [bursts, setBursts] = useState<HeartBurst[]>([]);
  const nextBurstIdRef = useRef(1);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(Boolean(mql?.matches));

    const handleChange = (event: MediaQueryListEvent) => {
      setReducedMotion(Boolean(event.matches));
    };

    mql?.addEventListener?.('change', handleChange);
    return () => {
      mql?.removeEventListener?.('change', handleChange);
    };
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      setBursts([]);
      return;
    }

    const activeTimers = timersRef.current;

    function handlePointerDown(event: PointerEvent) {
      if (shouldSkipBurstTarget(event.target)) return;
      if (typeof event.clientX !== 'number' || typeof event.clientY !== 'number') return;

      const id = nextBurstIdRef.current++;
      const newBurst: HeartBurst = {
        id,
        x: event.clientX,
        y: event.clientY,
        hearts: createBurstHearts(),
      };

      setBursts((prev) => [...prev.slice(-(MAX_CONCURRENT_BURSTS - 1)), newBurst]);

      const timer = setTimeout(() => {
        activeTimers.delete(timer);
        setBursts((prev) => prev.filter((item) => item.id !== id));
      }, BURST_DURATION_MS);

      activeTimers.add(timer);
    }

    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      activeTimers.forEach((timer) => clearTimeout(timer));
      activeTimers.clear();
    };
  }, [reducedMotion]);

  return (
    <div
      aria-hidden="true"
      data-testid="love-effects-layer"
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      className="pointer-events-none"
    >
      {/* Ambient floating petals & hearts */}
      {!reducedMotion && (
        <div className="pointer-events-none fixed inset-0 z-[5] overflow-hidden">
          {FLOATING_PARTICLES.map((particle) => {
            const style = {
              left: `${particle.leftPercent}%`,
              '--petal-duration': `${particle.durationSec}s`,
              '--petal-delay': `${particle.delaySec}s`,
              '--petal-drift': `${particle.driftPx}px`,
              '--petal-rotate': `${particle.rotateDeg}deg`,
              '--petal-opacity': String(particle.opacity),
            } as React.CSSProperties;

            return (
              <span
                key={particle.id}
                data-love-particle="true"
                style={style}
                className={`absolute top-0 select-none ${
                  particle.kind === 'petal' ? 'love-float-petal' : 'love-float-heart'
                } ${particle.desktopOnly ? 'hidden sm:block' : 'block'}`}
              >
                {particle.kind === 'petal' ? (
                  <svg
                    width={particle.sizePx}
                    height={particle.sizePx}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="M12 2C15.8 5.2 19 9.6 18 14.4C17.2 18.2 14.3 21 11.4 21.5C8.5 21 6.1 18 6 14C5.9 9.5 8.8 5.1 12 2Z"
                      fill={particle.color}
                    />
                  </svg>
                ) : (
                  <svg
                    width={particle.sizePx}
                    height={particle.sizePx}
                    viewBox="0 0 24 24"
                    fill={particle.color}
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* Non-blocking tap heart bursts */}
      {!reducedMotion && bursts.length > 0 && (
        <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
          {bursts.map((burst) => (
            <div
              key={burst.id}
              data-love-burst="true"
              style={{ left: burst.x, top: burst.y }}
              className="fixed -translate-x-1/2 -translate-y-1/2"
            >
              {burst.hearts.map((heart) => (
                <span
                  key={heart.id}
                  style={
                    {
                      '--bx': `${heart.bx}px`,
                      '--by': `${heart.by}px`,
                      '--brot': `${heart.rot}deg`,
                    } as React.CSSProperties
                  }
                  className="love-burst-heart absolute left-0 top-0"
                >
                  <svg
                    width={heart.size}
                    height={heart.size}
                    viewBox="0 0 24 24"
                    fill={heart.color}
                  >
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
