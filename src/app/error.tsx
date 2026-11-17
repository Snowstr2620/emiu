'use client';

import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorProps) {
  return (
    <main className="godly-velvet-bg flex min-h-screen items-center justify-center px-4 py-10 text-stone-900">
      <section className="glass-card w-full max-w-lg rounded-3xl p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-300 bg-red-50 text-red-600">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900">
          Không thể tải trang lúc này
        </h1>

        <p className="mt-2.5 text-sm leading-relaxed text-stone-700">
          Máy chủ vừa gặp sự cố khi xử lý yêu cầu. Nếu bạn vừa triển khai hoặc khởi động lần đầu ở chế độ production, hãy kiểm tra log máy chủ và cấu hình <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-stone-900">.env.local</code> (<code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-stone-900">ADMIN_PASSWORD</code>, <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-stone-900">ADMIN_SESSION_SECRET</code>).
        </p>

        {error.digest ? (
          <p className="mt-3 text-xs text-stone-600">
            Mã tham chiếu lỗi: <code className="rounded bg-amber-100/80 px-2 py-0.5 text-stone-900">{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_26px_rgba(220,38,38,0.25)] transition hover:shadow-[0_14px_34px_rgba(220,38,38,0.38)] hover:ring-1 hover:ring-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Thử tải lại</span>
          </button>

          <Link
            href="/admin/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-amber-300/80 bg-amber-100/75 px-5 py-2.5 text-sm font-medium text-stone-800 transition hover:border-amber-400 hover:bg-amber-200/80 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            Trang quản trị
          </Link>
        </div>
      </section>
    </main>
  );
}
