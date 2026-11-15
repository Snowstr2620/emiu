'use client';

import React, { useEffect, useRef } from 'react';
import { Heart, Sparkles } from 'lucide-react';

export interface PixelHeartIntroProps {
  coupleTitle: string;
  displayName?: string;
  onEnterStory: () => void;
  entering?: boolean;
  buttonLabel?: string;
  isModalReplay?: boolean;
}

const HEART_GRID: readonly string[] = [
  '...RRRRR.....RRRRR...',
  '..RLLLLLR...RBBBBBR..',
  '.RLHHLLLLR.RPPPPPPPR.',
  'DRLHHLLPPPPPPPPBBBBBD',
  'DRLHHLLPPPPPBBBBBBBBD',
  'DRLLLLPPPPPPBBBBBBPPD',
  'DRPPPPPPPPPBBBBPPPPVD',
  '.DRPPPPPPPBBBBPPPVVD.',
  '.DRPPPPPPBBBBBPPVVMD.',
  '..DRRPPPBBBBPPPVVMD..',
  '...DRRPPBBBPPPVVMD...',
  '....DRRPPPPPPVVMD....',
  '.....DRRPPPPVVMD.....',
  '......DRRPPVVMD......',
  '.......DRRVVMD.......',
  '........DRVMD........',
  '.........DMD.........',
  '..........D..........',
  '.....................',
];

const PALETTE: Record<string, string> = {
  H: '#ffe4e6',
  L: '#f9a8d4',
  B: '#fda4af',
  P: '#f472b6',
  R: '#fb7185',
  D: '#f43f5e',
  V: '#c4b5fd',
  M: '#e879f9',
};

interface HeartPixel {
  col: number;
  row: number;
  color: string;
  angle: number;
  radius: number;
  phaseOffset: number;
  isHighlight: boolean;
}

interface FloatingSparkle {
  nx: number;
  ny: number;
  size: number;
  speed: number;
  phase: number;
  color: string;
}

function buildHeartPixels(): HeartPixel[] {
  const pixels: HeartPixel[] = [];
  const rows = HEART_GRID.length;
  const cols = HEART_GRID[0]?.length ?? 21;

  for (let row = 0; row < rows; row++) {
    const line = HEART_GRID[row];
    for (let col = 0; col < cols; col++) {
      const code = line[col];
      const color = PALETTE[code];
      if (!color) continue;

      const seed = (row * 31 + col * 17) % 97;
      const angle = ((seed / 97) * Math.PI * 2) + (col - cols / 2) * 0.08;
      const radius = 0.55 + (seed % 19) * 0.045;
      pixels.push({
        col,
        row,
        color,
        angle,
        radius,
        phaseOffset: (seed / 97) * Math.PI * 2,
        isHighlight: code === 'H' || code === 'V',
      });
    }
  }
  return pixels;
}

const HEART_PIXELS = buildHeartPixels();

const AMBIENT_SPARKLES: FloatingSparkle[] = [
  { nx: 0.14, ny: 0.22, size: 4, speed: 1.4, phase: 0.4, color: '#fbcfe8' },
  { nx: 0.86, ny: 0.2, size: 4.5, speed: 1.7, phase: 1.5, color: '#ddd6fe' },
  { nx: 0.1, ny: 0.68, size: 3.5, speed: 1.3, phase: 2.3, color: '#fda4af' },
  { nx: 0.9, ny: 0.72, size: 4, speed: 1.6, phase: 3.1, color: '#f9a8d4' },
  { nx: 0.24, ny: 0.88, size: 3.5, speed: 1.5, phase: 4.2, color: '#c4b5fd' },
  { nx: 0.78, ny: 0.86, size: 4, speed: 1.2, phase: 5.0, color: '#ffe4e6' },
];

/**
 * Draw a rounded square using standard quadratic path curves so older browsers
 * and minimal jsdom/happy-dom 2D contexts without `ctx.roundRect` render safely.
 */
function fillRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function PixelHeartIntro({
  coupleTitle,
  displayName,
  onEnterStory,
  entering = false,
  buttonLabel,
  isModalReplay = false,
}: PixelHeartIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext?.('2d');
    if (!ctx) return;

    const cols = HEART_GRID[0]?.length ?? 21;
    const rows = HEART_GRID.length;
    const assemblyDurationMs = 1150;

    let rafId: number | null = null;
    let startTimestamp: number | null = null;
    let disposed = false;

    const mql =
      typeof window !== 'undefined' && typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    let reducedMotion = Boolean(mql?.matches);

    const configureCanvasSize = () => {
      const fallbackWidth = typeof window !== 'undefined' && window.innerWidth < 640 ? 240 : 320;
      const fallbackHeight = typeof window !== 'undefined' && window.innerWidth < 640 ? 220 : 296;
      const logicalWidth = canvas.clientWidth > 0 ? canvas.clientWidth : fallbackWidth;
      const logicalHeight = canvas.clientHeight > 0 ? canvas.clientHeight : fallbackHeight;
      const dpr = Math.min(
        typeof window !== 'undefined' && window.devicePixelRatio ? window.devicePixelRatio : 1,
        2
      );

      canvas.width = Math.round(logicalWidth * dpr);
      canvas.height = Math.round(logicalHeight * dpr);
      if (typeof ctx.setTransform === 'function') {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      } else if (typeof ctx.scale === 'function') {
        ctx.scale(dpr, dpr);
      }

      return { logicalWidth, logicalHeight };
    };

    let { logicalWidth, logicalHeight } = configureCanvasSize();

    const renderFrame = (elapsedMs: number, staticMode: boolean) => {
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      const centerX = logicalWidth / 2;
      const centerY = logicalHeight / 2;

      // Soft pastel aura behind the pixel heart
      if (typeof ctx.createRadialGradient === 'function') {
        const pulseGlow = staticMode ? 1 : 0.94 + Math.sin(elapsedMs * 0.0036) * 0.06;
        const glowRadius = Math.min(logicalWidth, logicalHeight) * 0.44 * pulseGlow;
        const gradient = ctx.createRadialGradient(centerX, centerY, 4, centerX, centerY, glowRadius);
        gradient.addColorStop(0, 'rgba(244, 114, 182, 0.28)');
        gradient.addColorStop(0.55, 'rgba(251, 113, 133, 0.12)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, glowRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      const paddingX = logicalWidth * 0.12;
      const paddingY = logicalHeight * 0.1;
      const step = Math.min(
        (logicalWidth - paddingX * 2) / cols,
        (logicalHeight - paddingY * 2) / rows
      );
      const gap = Math.max(1.2, step * 0.16);
      const pixelSize = Math.max(3, step - gap);
      const cornerRadius = Math.max(1.5, pixelSize * 0.25);

      const assemblyProgress = staticMode ? 1 : Math.min(1, elapsedMs / assemblyDurationMs);
      const eased = easeOutCubic(assemblyProgress);
      const heartbeatTime = Math.max(0, elapsedMs - assemblyDurationMs);
      const pulseScale =
        staticMode || assemblyProgress < 1
          ? 1
          : 1 +
            0.042 * Math.sin(heartbeatTime * 0.0042) +
            0.015 * Math.sin(heartbeatTime * 0.0084);

      const gridWidth = cols * step;
      const gridHeight = rows * step;
      const originX = centerX - (gridWidth * pulseScale) / 2;
      const originY = centerY - (gridHeight * pulseScale) / 2;
      const maxScatter = Math.min(logicalWidth, logicalHeight) * 0.48;

      for (const pixel of HEART_PIXELS) {
        const targetX = originX + (pixel.col * step + gap / 2) * pulseScale;
        const targetY = originY + (pixel.row * step + gap / 2) * pulseScale;

        let drawX = targetX;
        let drawY = targetY;
        let alpha = 1;

        if (eased < 1) {
          const scatterProgress = 1 - eased;
          const spiralAngle = pixel.angle + scatterProgress * 1.35;
          const offsetDistance = maxScatter * pixel.radius * scatterProgress;
          drawX = targetX + Math.cos(spiralAngle) * offsetDistance;
          drawY = targetY + Math.sin(spiralAngle) * offsetDistance;
          alpha = 0.25 + 0.75 * eased;
        } else if (!staticMode && pixel.isHighlight) {
          alpha = 0.8 + 0.2 * Math.sin(heartbeatTime * 0.005 + pixel.phaseOffset);
        }

        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
        ctx.fillStyle = pixel.color;
        const scaledSize = pixelSize * pulseScale;
        fillRoundedRect(ctx, drawX, drawY, scaledSize, scaledSize, cornerRadius);
        ctx.restore();
      }

      if (!staticMode && assemblyProgress >= 0.85) {
        for (const sparkle of AMBIENT_SPARKLES) {
          const driftY = Math.sin(elapsedMs * 0.0018 * sparkle.speed + sparkle.phase) * 7;
          const twinkle = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(elapsedMs * 0.003 + sparkle.phase));
          ctx.save();
          ctx.globalAlpha = twinkle;
          ctx.fillStyle = sparkle.color;
          fillRoundedRect(
            ctx,
            sparkle.nx * logicalWidth,
            sparkle.ny * logicalHeight + driftY,
            sparkle.size,
            sparkle.size,
            sparkle.size * 0.35
          );
          ctx.restore();
        }
      }
    };

    const stopLoop = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    const tick = (timestamp: number) => {
      if (disposed || reducedMotion) return;
      if (startTimestamp === null) {
        startTimestamp = timestamp;
      }
      renderFrame(timestamp - startTimestamp, false);
      rafId = requestAnimationFrame(tick);
    };

    const startOrRenderStatic = () => {
      stopLoop();
      if (reducedMotion) {
        renderFrame(assemblyDurationMs, true);
      } else {
        startTimestamp = null;
        renderFrame(0, false);
        rafId = requestAnimationFrame(tick);
      }
    };

    startOrRenderStatic();

    const handleResize = () => {
      ({ logicalWidth, logicalHeight } = configureCanvasSize());
      if (reducedMotion) {
        renderFrame(assemblyDurationMs, true);
      }
    };

    const handleMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = Boolean(event.matches);
      startOrRenderStatic();
    };

    window.addEventListener('resize', handleResize);
    mql?.addEventListener?.('change', handleMotionChange);

    return () => {
      disposed = true;
      stopLoop();
      window.removeEventListener('resize', handleResize);
      mql?.removeEventListener?.('change', handleMotionChange);
    };
  }, []);

  const greetingName = displayName?.trim() || 'người thương';

  return (
    <div
      className={`glass-card relative mx-auto w-full max-w-md overflow-hidden rounded-3xl px-5 pb-7 text-center sm:px-8 sm:pb-9 ${
        isModalReplay ? 'pt-12 sm:pt-8' : 'pt-7 sm:pt-9'
      }`}
    >
      <div
        className={`mx-auto inline-flex items-center gap-1.5 rounded-full bg-pink-50/90 px-3.5 py-1 text-xs font-semibold text-pink-600 shadow-sm ${
          isModalReplay ? 'max-w-[68%]' : 'max-w-[82%]'
        }`}
      >
        <Sparkles className="h-3.5 w-3.5 shrink-0 text-pink-500" />
        <span className="truncate">
          {isModalReplay ? `Dành riêng cho ${greetingName}` : `Thương chào ${greetingName}`}
        </span>
      </div>

      {isModalReplay ? (
        <h2 className="mt-3 break-words [overflow-wrap:anywhere] font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {coupleTitle}
        </h2>
      ) : (
        <h1 className="mt-3 break-words [overflow-wrap:anywhere] font-serif text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {coupleTitle}
        </h1>
      )}

      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
        {isModalReplay
          ? 'Mỗi nhịp đập nhỏ bé này đều đang khẽ gọi tên mình, ngắm thêm chút nữa nhé.'
          : 'Nhịp tim này đang ghép từng mảnh ký ức chỉ để đợi em bước vào...'}
      </p>

      <div className="my-4 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Trái tim pixel đang ghép nối và đập nhịp yêu thương"
          className="h-[220px] w-[240px] sm:h-[296px] sm:w-[320px]"
        />
      </div>

      <p className="mb-5 text-xs font-medium italic text-pink-500/90 sm:text-sm">
        ♥ Từng mảnh nhỏ đều mang theo một ngày anh thương em thật nhiều ♥
      </p>

      <button
        type="button"
        onClick={onEnterStory}
        disabled={entering}
        className="love-pulse-glow inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-400 via-pink-500 to-indigo-400 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-pink-500/25 transition hover:brightness-105 active:scale-[0.98] disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none"
      >
        <Heart className="h-4 w-4 fill-white" />
        <span>
          {entering
            ? 'Đang mở cửa miền ký ức...'
            : buttonLabel || 'Mở khoá miền ký ức của tụi mình'}
        </span>
      </button>
    </div>
  );
}
