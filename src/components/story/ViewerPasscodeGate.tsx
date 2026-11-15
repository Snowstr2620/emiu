'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, Lock } from 'lucide-react';

interface ViewerPasscodeGateProps {
  coupleTitle: string;
}

export function ViewerPasscodeGate({ coupleTitle }: ViewerPasscodeGateProps) {
  const router = useRouter();
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/viewer/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(payload.error || 'Mã kỷ niệm chưa đúng.');
        return;
      }
      router.refresh();
    } catch {
      setError('Không thể kết nối máy chủ, thử lại sau nhé.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-pink-200/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-10 h-80 w-80 rounded-full bg-sky-200/50 blur-3xl"
      />

      <div className="glass-card relative w-full max-w-md rounded-3xl p-7 text-center sm:p-9">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-50 text-pink-500">
          <Lock className="h-5 w-5" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900">{coupleTitle}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Trang kỷ niệm riêng tư — nhập mã bí mật của hai đứa để mở album nhé.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Nhập mã kỷ niệm..."
            required
            className="w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-center text-base tracking-widest text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
          />

          {error && <p className="text-sm font-medium text-rose-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 to-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-pink-500/20 transition hover:brightness-105 disabled:opacity-60"
          >
            <Heart className="h-4 w-4 fill-white" />
            <span>{loading ? 'Đang mở khóa...' : 'Mở album kỷ niệm'}</span>
          </button>
        </form>
      </div>
    </main>
  );
}
