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
    <main className="godly-velvet-bg flex min-h-screen items-center justify-center px-4 py-10 text-rose-50">
      <section className="glass-card w-full max-w-2xl rounded-3xl p-6 sm:p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-rose-500/35 bg-rose-950/70 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-rose-200">
          <ShieldAlert className="h-4 w-4 text-rose-400" />
          <span>CẤU HÌNH KHỞI ĐỘNG PRODUCTION</span>
        </div>

        <h1 className="font-serif text-2xl font-bold tracking-tight text-rose-50 sm:text-3xl">
          Chưa hoàn tất cấu hình khởi động
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-rose-200/85 sm:text-base">
          Ứng dụng đang chạy ở chế độ production (<code className="rounded bg-[#1a0a11] px-1.5 py-0.5 text-rose-200">npm run start</code>). Để bảo mật khi khởi tạo dữ liệu lần đầu, máy chủ không cho phép dùng mật khẩu mặc định hoặc thiếu khoá phiên đăng nhập.
        </p>

        {detailMessage ? (
          <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-red-500/40 bg-red-950/60 px-4 py-3 text-sm text-red-100">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{detailMessage}</span>
          </div>
        ) : null}

        <div className="mt-5 space-y-3 rounded-2xl border border-rose-500/25 bg-[#0f0509]/85 p-4 text-sm">
          <p className="flex items-center gap-2 font-semibold text-rose-100">
            <KeyRound className="h-4 w-4 text-rose-400" />
            <span>Hãy tạo hoặc cập nhật tệp <code className="rounded bg-[#1e0b14] px-1.5 py-0.5 text-rose-200">.env.local</code> ở thư mục gốc dự án:</span>
          </p>

          <ul className="space-y-2 text-xs leading-relaxed text-rose-200/85 sm:text-sm">
            <li>
              <span className={missingPassword ? 'font-semibold text-red-300' : 'font-semibold text-rose-200'}>
                ADMIN_PASSWORD
              </span>
              : mật khẩu quản trị riêng cho tài khoản <code className="text-rose-100">admin</code> (bắt buộc khác <code className="text-rose-100">love2026</code>).
            </li>
            <li>
              <span className={missingSessionSecret ? 'font-semibold text-red-300' : 'font-semibold text-rose-200'}>
                ADMIN_SESSION_SECRET
              </span>
              : chuỗi bí mật ngẫu nhiên tối thiểu 32 ký tự để ký cookie phiên đăng nhập.
            </li>
          </ul>

          <pre className="overflow-x-auto rounded-xl border border-rose-500/20 bg-[#080306] p-3.5 text-xs leading-relaxed text-rose-100">
{`ADMIN_PASSWORD=DatMatKhauManhRiengCuaBan#2026
ADMIN_SESSION_SECRET=tao-chuoi-ngau-nhien-toi-thieu-32-ky-tu-bang-openssl-rand-hex-32`}
          </pre>

          <p className="text-xs leading-relaxed text-rose-200/75">
            Sau khi lưu <code className="text-rose-100">.env.local</code>, hãy khởi động lại tiến trình máy chủ (<code className="text-rose-100">npm run start</code>). Nếu chỉ muốn chạy thử nhanh trên máy cá nhân, dùng <code className="text-rose-100">npm run dev</code>.
          </p>
        </div>
      </section>
    </main>
  );
}
