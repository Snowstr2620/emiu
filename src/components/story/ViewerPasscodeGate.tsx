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
        setError(payload.error || 'Mã OTP chưa khớp mất rồi, bạn nhỏ kiểm tra gợi ý lại nhé.');
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
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-4 py-10 sm:py-14">
      <LoveEffectsLayer />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pink-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl"
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
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-50 to-rose-100 text-pink-500 shadow-sm">
              {step === 'credentials' ? (
                <Lock className="h-5 w-5" />
              ) : (
                <KeyRound className="h-5 w-5" />
              )}
            </div>

            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-pink-50/90 px-3 py-1 text-[11px] font-semibold text-pink-600">
              <Sparkles className="h-3 w-3" />
              <span>{step === 'credentials' ? 'Bước 1 / 2 · Chìa khóa thương yêu' : 'Bước 2 / 2 · Mật mã trái tim'}</span>
            </div>

            <h1 className="font-serif text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {coupleTitle}
            </h1>

            {step === 'credentials' ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Khu vườn nhỏ chỉ mở cửa cho hai trái tim chung nhịp — cho anh biết tên và mật mã
                  yêu thương của tụi mình nhé.
                </p>

                <form onSubmit={handleCredentialsSubmit} className="mt-6 space-y-4 text-left">
                  <div>
                    <label
                      htmlFor="viewer-username"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
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
                      className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="viewer-password"
                      className="mb-1.5 block text-xs font-semibold text-slate-700"
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
                      className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                    />
                  </div>

                  {process.env.NODE_ENV !== 'production' && showDevDefaultHints && (
                    <div className="rounded-2xl border border-pink-100 bg-pink-50/60 p-3 text-xs text-slate-600">
                      <p className="mb-2 font-semibold text-pink-700">
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
                          className="rounded-full border border-pink-200 bg-white px-2.5 py-1 text-[11px] font-medium text-pink-700 transition hover:bg-pink-100"
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
                          className="rounded-full border border-indigo-200 bg-white px-2.5 py-1 text-[11px] font-medium text-indigo-700 transition hover:bg-indigo-50"
                        >
                          admin · love2026 · OTP 140226
                        </button>
                      </div>
                    </div>
                  )}

                  {error && (
                    <p role="alert" className="text-center text-sm font-medium text-rose-600">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-400 via-pink-500 to-indigo-400 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-pink-500/20 transition hover:brightness-105 disabled:opacity-60"
                  >
                    <Heart className="h-4 w-4 fill-white" />
                    <span>{loading ? 'Đang gõ cửa trái tim...' : 'Tiếp tục đến bước OTP'}</span>
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">
                  Thương chào{' '}
                  <span className="font-semibold text-pink-600">
                    {displayName || username}
                  </span>
                  , nhập 6 chữ số kỷ niệm để cánh cửa trái tim mở ra nhé.
                </p>

                {otpHint && (
                  <div className="mt-3 inline-flex max-w-full items-center gap-1.5 rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 to-pink-50/90 px-3.5 py-1.5 text-xs font-medium text-amber-800">
                    <span>Gợi ý OTP: {otpHint}</span>
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
                        className="h-11 w-10 rounded-xl border border-pink-200 bg-white/95 text-center text-lg font-bold text-slate-900 shadow-sm outline-none transition focus:border-pink-500 focus:ring-2 focus:ring-pink-200 sm:h-12 sm:w-11"
                      />
                    ))}
                  </div>

                  {error && (
                    <p role="alert" className="text-center text-sm font-medium text-rose-600">
                      {error}
                    </p>
                  )}

                  <div className="space-y-2.5">
                    <button
                      type="submit"
                      disabled={loading || otpValue.length < 6}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-rose-400 via-pink-500 to-indigo-400 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-pink-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <Heart className="h-4 w-4 fill-white" />
                      <span>
                        {loading ? 'Đang mở khóa trái tim...' : 'Xác nhận bước vào tim nhau'}
                      </span>
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={handleBackToStep1}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-2xl border border-slate-200/80 bg-white/75 px-4 py-2.5 text-xs font-semibold text-slate-600 transition hover:border-pink-200 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-55"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      <span>Quay lại bước 1</span>
                    </button>
                  </div>
                </form>
              </>
            )}

            <div className="mt-6 border-t border-slate-100 pt-4 text-center">
              <Link
                href="/admin/login"
                className="text-xs font-medium text-slate-400 transition hover:text-pink-500"
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
