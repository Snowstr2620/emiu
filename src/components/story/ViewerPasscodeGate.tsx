'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, KeyRound, Lock, Sparkles } from 'lucide-react';
import { LoveEffectsLayer } from '@/components/story/LoveEffectsLayer';
import { PixelHeartIntro } from '@/components/story/PixelHeartIntro';
import type { SafeAppUser } from '@/types/memories';

export interface ViewerPasscodeGateProps {
  coupleTitle: string;
  initialStage?: 'login_required' | 'otp_pending';
  initialOtpHint?: string;
  initialUsername?: string;
  initialDisplayName?: string;
  showDevDefaultHints?: boolean;
}

type GateStep = 'credentials' | 'otp' | 'pixel_heart';

const GUEST_VISIT_STORAGE_KEY = 'ny_visit_logged:guest';
const EMPTY_OTP = ['', '', '', '', '', ''];

function dispatchGuestLeaveBeacon(): void {
  const payload = JSON.stringify({
    eventType: 'page_leave',
    detail: 'Rời khỏi cổng đăng nhập ký ức',
  });
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/activity', new Blob([payload], { type: 'application/json' }));
      return;
    }
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignore telemetry network failures on unload
  }
}

export function ViewerPasscodeGate({
  coupleTitle,
  initialStage = 'login_required',
  initialOtpHint = '',
  initialUsername = '',
  initialDisplayName = '',
  showDevDefaultHints = false,
}: ViewerPasscodeGateProps) {
  const router = useRouter();
  const [step, setStep] = useState<GateStep>(
    initialStage === 'otp_pending' ? 'otp' : 'credentials'
  );
  const [username, setUsername] = useState(initialUsername);
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState(initialDisplayName || initialUsername);
  const [otpHint, setOtpHint] = useState(initialOtpHint);
  const [otpDigits, setOtpDigits] = useState<string[]>([...EMPTY_OTP]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [enteringStory, setEnteringStory] = useState(false);

  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const hasSentLeaveRef = useRef(false);
  const stepRef = useRef<GateStep>(step);
  const enteringStoryRef = useRef(false);

  stepRef.current = step;

  useEffect(() => {
    if (step === 'pixel_heart') return;

    try {
      if (!window.sessionStorage.getItem(GUEST_VISIT_STORAGE_KEY)) {
        window.sessionStorage.setItem(GUEST_VISIT_STORAGE_KEY, '1');
        fetch('/api/activity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            eventType: 'page_visit',
            detail: 'Ghé thăm trước cổng vào ký ức',
          }),
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Ignore storage access restrictions
    }
  }, [step]);

  useEffect(() => {
    function sendGuestLeaveOnce() {
      if (hasSentLeaveRef.current || stepRef.current === 'pixel_heart' || enteringStoryRef.current) {
        return;
      }
      hasSentLeaveRef.current = true;
      dispatchGuestLeaveBeacon();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        sendGuestLeaveOnce();
      }
    }

    window.addEventListener('pagehide', sendGuestLeaveOnce);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('pagehide', sendGuestLeaveOnce);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const normalizedUsername = username.trim().toLowerCase();

    try {
      const res = await fetch('/api/viewer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        otpHint?: string;
        user?: SafeAppUser;
      };

      if (!res.ok) {
        setError(payload.error || 'Tài khoản hoặc mật khẩu chưa khớp mất rồi.');
        return;
      }

      setUsername(payload.user?.username || normalizedUsername);
      setPassword('');
      setDisplayName(payload.user?.displayName || normalizedUsername);
      setOtpHint(payload.otpHint ?? payload.user?.otpHint ?? '');
      setOtpDigits([...EMPTY_OTP]);
      setStep('otp');

      setTimeout(() => {
        otpRefs.current[0]?.focus();
      }, 40);
    } catch {
      setError('Không thể kết nối máy chủ lúc này, mình thử lại nhé.');
    } finally {
      setLoading(false);
    }
  }

  async function handleBackToStep1() {
    if (loading) return;
    setLoading(true);
    try {
      await fetch('/api/viewer/logout', { method: 'POST' }).catch(() => {});
    } finally {
      setPassword('');
      setOtpDigits([...EMPTY_OTP]);
      setOtpHint('');
      setDisplayName('');
      setError('');
      setStep('credentials');
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, rawValue: string) {
    const cleaned = rawValue.replace(/\D/g, '');
    setError('');

    if (!cleaned) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = '';
        return next;
      });
      return;
    }

    if (cleaned.length > 1) {
      const chars = cleaned.slice(0, 6 - index).split('');
      setOtpDigits((prev) => {
        const next = [...prev];
        chars.forEach((char, offset) => {
          next[index + offset] = char;
        });
        return next;
      });
      const nextFocus = Math.min(5, index + chars.length);
      otpRefs.current[nextFocus]?.focus();
      return;
    }

    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = cleaned;
      return next;
    });

    if (index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      if (otpDigits[index]) {
        e.preventDefault();
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index] = '';
          return next;
        });
      } else if (index > 0) {
        e.preventDefault();
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index - 1] = '';
          return next;
        });
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 5) {
      e.preventDefault();
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpPaste(index: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const pastedText = e.clipboardData?.getData('text') || '';
    const digits = pastedText.replace(/\D/g, '').slice(0, 6);
    if (!digits) return;

    e.preventDefault();
    setError('');

    const startIndex = digits.length === 6 ? 0 : index;
    const chars = digits.slice(0, 6 - startIndex).split('');
    setOtpDigits((prev) => {
      const next = digits.length === 6 ? [...EMPTY_OTP] : [...prev];
      chars.forEach((char, offset) => {
        next[startIndex + offset] = char;
      });
      return next;
    });

    const targetFocus = Math.min(5, startIndex + chars.length - 1);
    otpRefs.current[Math.max(0, targetFocus)]?.focus();
  }

  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    const otp = otpDigits.join('');
    if (otp.length !== 6) {
      setError('Nhập đủ 6 chữ số kỷ niệm rồi mình cùng vào nhé.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/viewer/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        user?: SafeAppUser;
      };

      if (!res.ok) {
        setError(payload.error || 'Mã OTP chưa khớp mất rồi, em bé kiểm tra gợi ý lại nhé.');
        return;
      }

      if (payload.user?.displayName) {
        setDisplayName(payload.user.displayName);
      }
      setStep('pixel_heart');
    } catch {
      setError('Không thể xác thực OTP lúc này, thử lại giúp mình nhé.');
    } finally {
      setLoading(false);
    }
  }

  async function handleEnterStory() {
    enteringStoryRef.current = true;
    hasSentLeaveRef.current = true;
    setEnteringStory(true);

    try {
      await fetch('/api/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'pixel_heart_viewed',
          detail: 'Ngắm trái tim pixel và bước vào miền ký ức',
        }),
        keepalive: true,
      }).catch(() => {});

      try {
        window.sessionStorage.removeItem(GUEST_VISIT_STORAGE_KEY);
      } catch {
        // Ignore storage errors
      }
    } finally {
      router.refresh();
    }
  }

  const otpValue = otpDigits.join('');

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden bg-[#080306] px-4 py-10 sm:py-14">
      <LoveEffectsLayer />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-red-600/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-rose-500/20 blur-3xl"
      />

      <div className="relative z-10 w-full max-w-md">
        {step === 'pixel_heart' ? (
          <PixelHeartIntro
            coupleTitle={coupleTitle}
            displayName={displayName || username}
            onEnterStory={handleEnterStory}
            entering={enteringStory}
          />
        ) : (
          <div className="glass-card relative w-full rounded-3xl p-5 text-center sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-950/60 text-rose-400 shadow-[0_0_24px_rgba(225,29,72,0.22)]">
              {step === 'credentials' ? (
                <Lock className="h-5 w-5" />
              ) : (
                <KeyRound className="h-5 w-5" />
              )}
            </div>

            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-950/60 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-rose-200">
              <Sparkles className="h-3 w-3 text-rose-400" />
              <span>{step === 'credentials' ? 'Bước 1 / 2 · Chìa khoá thương yêu' : 'Bước 2 / 2 · Mật mã trái tim'}</span>
            </div>

            <h1 className="break-words [overflow-wrap:anywhere] font-serif text-2xl font-bold tracking-tight text-rose-50 sm:text-3xl">
              {coupleTitle}
            </h1>

            {step === 'credentials' ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-rose-200/80">
                  Khu vườn nhỏ chỉ mở cửa cho hai trái tim chung nhịp — cho anh biết tên và mật mã
                  yêu thương của tụi mình nhé.
                </p>

                <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4 text-left">
                  <div>
                    <label
                      htmlFor="viewer-username"
                      className="mb-1.5 block text-xs font-semibold text-rose-200/90"
                    >
                      Tài khoản của mình
                    </label>
                    <input
                      id="viewer-username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        setError('');
                      }}
                      autoComplete="username"
                      placeholder="Ví dụ: nguoithuong"
                      required
                      className="w-full rounded-2xl border border-rose-500/25 bg-[#0d0408]/90 px-4 py-3 text-base text-rose-50 placeholder:text-rose-300/70 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/25 sm:text-sm"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="viewer-password"
                      className="mb-1.5 block text-xs font-semibold text-rose-200/90"
                    >
                      Mật khẩu yêu thương
                    </label>
                    <input
                      id="viewer-password"
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setError('');
                      }}
                      autoComplete="current-password"
                      placeholder="Nhập mật khẩu bí mật..."
                      required
                      className="w-full rounded-2xl border border-rose-500/25 bg-[#0d0408]/90 px-4 py-3 text-base text-rose-50 placeholder:text-rose-300/70 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/25 sm:text-sm"
                    />
                  </div>

                  {process.env.NODE_ENV !== 'production' && showDevDefaultHints && (
                    <div className="rounded-2xl border border-rose-500/25 bg-rose-950/40 p-3 text-xs text-rose-200">
                      <p className="mb-2 font-semibold text-rose-200">
                        Gợi ý nhanh (Môi trường dev):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setUsername('nguoithuong');
                            setPassword('love2026');
                            setError('');
                          }}
                          className="inline-flex min-h-[36px] items-center rounded-full border border-rose-400/35 bg-[#190911] px-2.5 py-1.5 text-[11px] font-medium text-rose-200 transition hover:border-rose-400/60 hover:bg-rose-950/80"
                        >
                          nguoithuong · love2026 · OTP 121024
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUsername('admin');
                            setPassword('love2026');
                            setError('');
                          }}
                          className="inline-flex min-h-[36px] items-center rounded-full border border-red-400/35 bg-[#190911] px-2.5 py-1.5 text-[11px] font-medium text-red-200 transition hover:border-red-400/60 hover:bg-red-950/80"
                        >
                          admin · love2026 · OTP 140226
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p role="alert" className="text-center text-sm font-medium text-red-400">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(225,29,72,0.34)] transition hover:shadow-[0_14px_38px_rgba(225,29,72,0.5)] hover:ring-1 hover:ring-rose-300/40 disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none"
                  >
                    <Heart className="h-4 w-4 fill-white" />
                    <span>{loading ? 'Đang gõ cửa trái tim...' : 'Tiếp tục đến bước OTP'}</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-rose-200/80">
                  Thương chào{' '}
                  <span className="font-semibold text-rose-400">
                    {displayName || username}
                  </span>
                  , nhập 6 chữ số kỷ niệm để cánh cửa trái tim mở ra nhé.
                </p>

                {otpHint && (
                  <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-rose-400/30 bg-rose-950/55 px-3.5 py-1.5 text-xs font-medium text-rose-200">
                    <span className="break-words [overflow-wrap:anywhere]">Gợi ý OTP: {otpHint}</span>
                  </div>
                )}

                <form onSubmit={handleOtpSubmit} className="mt-6 space-y-5">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2.5">
                    {otpDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          otpRefs.current[index] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        aria-label={`Chữ số OTP thứ ${index + 1}`}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        onPaste={(e) => handleOtpPaste(index, e)}
                        className="h-11 w-10 rounded-xl border border-rose-400/50 bg-[#0d0408]/90 text-center text-lg font-bold text-rose-50 shadow-[inset_0_1px_0_rgba(255,228,230,0.06)] outline-none transition focus:border-rose-400 focus:shadow-[0_0_20px_rgba(225,29,72,0.35)] focus:ring-2 focus:ring-rose-500/30 sm:h-12 sm:w-11"
                      />
                    ))}
                  </div>

                  {error && (
                    <p role="alert" className="text-center text-sm font-medium text-red-400">
                      {error}
                    </p>
                  )}

                  <div className="space-y-2.5">
                    <button
                      type="submit"
                      disabled={loading || otpValue.length < 6}
                      className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_32px_rgba(225,29,72,0.34)] transition hover:shadow-[0_14px_38px_rgba(225,29,72,0.5)] hover:ring-1 hover:ring-rose-300/40 disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transform-none motion-reduce:transition-none"
                    >
                      <Heart className="h-4 w-4 fill-white" />
                      <span>
                        {loading ? 'Đang mở khoá trái tim...' : 'Xác nhận bước vào tim nhau'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleBackToStep1}
                      className="inline-flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-2xl border border-rose-500/25 bg-[#14060c]/85 px-4 py-2.5 text-xs font-semibold text-rose-200 transition hover:border-rose-400/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transform-none motion-reduce:transition-none"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Quay lại bước 1</span>
                    </button>
                  </div>
                </form>
              </>
            )}

            <div className="mt-6 border-t border-rose-500/15 pt-4 text-center">
              <Link
                href="/admin/login"
                className="inline-flex min-h-[36px] items-center px-2 py-1.5 text-xs font-medium text-rose-300/75 transition hover:text-rose-200"
              >
                Góc nhỏ của chủ vườn ký ức · Quản trị
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
