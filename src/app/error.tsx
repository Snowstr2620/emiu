'use client';

import Link from 'next/link';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalErrorPage({ error, reset }: GlobalErrorProps) {
  return (
    <main className="godly-velvet-bg flex min-h-screen items-center justify-center px-4 py-10 text-rose-50">
      <section className="glass-card w-full max-w-lg rounded-3xl p-6 text-center sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/35 bg-red-950/60 text-red-300">
          <AlertCircle className="h-6 w-6" />
        </div>

        <h1 className="font-serif text-2xl font-bold tracking-tight text-rose-50">
          Không thể tải trang lúc này
        </h1>

        <p className="mt-2.5 text-sm leading-relaxed text-rose-200/80">
          Máy chủ vừa gặp sự cố khi xử lý yêu cầu. Nếu bạn vừa triển khai hoặc khởi động lần đầu ở chế độ production, hãy kiểm tra log máy chủ và cấu hình <code className="rounded bg-[#1a0a11] px-1.5 py-0.5 text-rose-200">.env.local</code> (<code className="rounded bg-[#1a0a11] px-1.5 py-0.5 text-rose-200">ADMIN_PASSWORD</code>, <code className="rounded bg-[#1a0a11] px-1.5 py-0.5 text-rose-200">ADMIN_SESSION_SECRET</code>).
        </p>

        {error.digest ? (
          <p className="mt-3 text-xs text-rose-300/75">
            Mã tham chiếu lỗi: <code className="rounded bg-[#12070c] px-2 py-0.5 text-rose-200">{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(225,29,72,0.35)] transition hover:shadow-[0_12px_32px_rgba(225,29,72,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Thử tải lại</span>
          </button>

          <Link
            href="/admin/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded-2xl border border-rose-500/30 bg-[#190911] px-5 py-2.5 text-sm font-medium text-rose-100 transition hover:border-rose-400/50 hover:bg-rose-950/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
          >
            Trang quản trị
          </Link>
        </div>
      </section>
    </main>
  );
}
