import { AlertTriangle, KeyRound, ShieldAlert } from 'lucide-react';

interface ProductionSetupNoticeProps {
  missingPassword?: boolean;
  missingSessionSecret?: boolean;
  detailMessage?: string;
}

export function ProductionSetupNotice({
  missingPassword = false,
  missingSessionSecret = false,
  detailMessage,
}: ProductionSetupNoticeProps) {
  return (
    <main className="godly-velvet-bg flex min-h-screen items-center justify-center px-4 py-10 text-stone-900">
      <section className="glass-card w-full max-w-2xl rounded-3xl p-6 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/80 bg-amber-100/80 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-amber-950">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <span>CẤU HÌNH KHỞI ĐỘNG PRODUCTION</span>
        </div>

        <h1 className="font-serif text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
          Chưa hoàn tất cấu hình khởi động
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-stone-700 sm:text-base">
          Ứng dụng đang chạy ở chế độ production (<code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-stone-900">npm run start</code>). Để bảo mật khi khởi tạo dữ liệu lần đầu, máy chủ không cho phép dùng mật khẩu mặc định hoặc thiếu khoá phiên đăng nhập.
        </p>

        {detailMessage ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{detailMessage}</span>
          </div>
        ) : null}

        <div className="mt-5 space-y-3 rounded-2xl border border-amber-300/80 bg-[#FFFDF5]/95 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-stone-900">
            <KeyRound className="h-4 w-4 text-red-600" />
            <span>Hãy tạo hoặc cập nhật tệp <code className="rounded bg-amber-100/80 px-1.5 py-0.5 text-stone-900">.env.local</code> ở thư mục gốc dự án:</span>
          </p>

          <ul className="space-y-2 text-xs leading-relaxed text-stone-700 sm:text-sm">
            <li>
              <span className={missingPassword ? 'font-semibold text-red-700' : 'font-semibold text-stone-900'}>
                ADMIN_PASSWORD
              </span>
              : mật khẩu quản trị riêng cho tài khoản <code className="font-semibold text-stone-900">admin</code> (bắt buộc khác <code className="font-semibold text-stone-900">love2026</code>).
            </li>
            <li>
              <span className={missingSessionSecret ? 'font-semibold text-red-700' : 'font-semibold text-stone-900'}>
                ADMIN_SESSION_SECRET
              </span>
              : chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự để ký cookie phiên đăng nhập.
            </li>
          </ul>

          <pre className="overflow-x-auto rounded-xl border border-amber-300/75 bg-amber-50/90 p-3.5 text-xs leading-relaxed text-stone-900">
{`ADMIN_PASSWORD=DatMatKhauManhRiengCuaBan#2026
ADMIN_SESSION_SECRET=tao-chuoi-ngau-nhien-toi-thieu-32-ky-tu-bang-openssl-rand-hex-32`}
          </pre>

          <p className="text-xs leading-relaxed text-stone-600">
            Sau khi lưu <code className="font-semibold text-stone-900">.env.local</code>, hãy khởi động lại tiến trình máy chủ (<code className="font-semibold text-stone-900">npm run start</code>). Nếu chỉ muốn chạy thử nhanh trên máy cá nhân, dùng <code className="font-semibold text-stone-900">npm run dev</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
