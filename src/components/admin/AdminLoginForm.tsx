'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Heart, Lock, User } from 'lucide-react';

interface AdminLoginFormProps {
  showDevDefaultHint?: boolean;
}

export function AdminLoginForm({ showDevDefaultHint = false }: AdminLoginFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !password.trim() || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: normalizedUsername, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setError(payload.error || 'Tài khoản hoặc mật khẩu quản trị chưa đúng.');
        setSubmitting(false);
        return;
      }

      router.push('/admin');
      router.refresh();
    } catch {
      setError('Không thể kết nối máy chủ. Vui lòng thử lại.');
      setSubmitting(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden px-4 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/4 h-72 w-72 rounded-full bg-[#FBCFE8]/50 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 right-1/4 h-80 w-80 rounded-full bg-[#BAE6FD]/45 blur-3xl"
      />

      <section className="glass-card relative z-10 w-full max-w-md rounded-3xl p-8 shadow-glass">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex min-h-[36px] items-center gap-1.5 px-2 py-1.5 text-sm font-medium text-slate-600 transition hover:text-pink-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Về trang kỷ niệm
          </Link>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-pink-50 text-pink-500">
            <Heart className="h-5 w-5 fill-pink-500/20" />
          </span>
        </div>

        <h1 className="font-serif text-3xl font-semibold tracking-tight text-slate-900">
          Quản trị trang kỷ niệm
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Đăng nhập để thêm ảnh kỷ niệm, chỉnh sửa nhạc nền và viết tâm thư gửi người thương.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="admin-username"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Tài khoản quản trị
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="admin-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="VD: admin"
                autoComplete="username"
                required
                className="w-full rounded-2xl border border-slate-200/90 bg-white/90 py-3 pl-10 pr-4 text-base text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Mật khẩu quản trị
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu..."
                autoComplete="current-password"
                required
                className="w-full rounded-2xl border border-slate-200/90 bg-white/90 py-3 pl-10 pr-4 text-base text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-200 sm:text-sm"
              />
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50/90 px-3.5 py-2.5 text-sm text-rose-700"
            >
              {error}
            </p>
          ) : null}

          {process.env.NODE_ENV !== 'production' && showDevDefaultHint ? (
            <p className="rounded-xl border border-indigo-200/80 bg-indigo-50/80 px-3.5 py-2.5 text-xs leading-relaxed text-indigo-800">
              Môi trường cục bộ đang dùng tài khoản mặc định:{' '}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-semibold text-indigo-950">
                admin
              </code>{' '}
              / mật khẩu{' '}
              <code className="rounded bg-white/80 px-1.5 py-0.5 font-semibold text-indigo-950">
                love2026
              </code>
              . Hãy đổi biến <code className="font-semibold">ADMIN_PASSWORD</code> hoặc mật khẩu
              trong trang quản trị trước khi triển khai công khai.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password.trim()}
            className="w-full rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-pink-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Đang đăng nhập...' : 'Vào trang quản trị'}
          </button>
        </form>
      </section>
    </main>
  );
}
