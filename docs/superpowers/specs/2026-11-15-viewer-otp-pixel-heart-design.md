# Thiết kế tính năng: Đăng nhập User, Xác thực OTP 6 số & Trái tim ghép từ Pixel

**Ngày:** 2026-11-15  
**Nhánh phát triển:** `feat/love-memories-website`  
**Phong cách áp dụng:** B · Trắng Tinh Khôi & Kính Mờ Pastel (`Airy Glass Minimal`)

---

## 1. Mục tiêu & Ý nghĩa (Intent & Why)

Biến khoảnh khắc mở trang web kỷ niệm tại `/` thành một nghi thức riêng tư, ngọt ngào và đáng nhớ dành riêng cho người thương:

1. **Bước 1 — Đăng nhập User:** Người xem nhập **Tên đăng nhập** và **Mật khẩu** của tài khoản dành riêng cho hai bạn.
2. **Bước 2 — Nhập mã OTP 6 chữ số:** Sau khi đăng nhập đúng tài khoản, màn hình chuyển sang nhập **mã OTP 6 số kỷ niệm** (kèm gợi ý nhỏ tuỳ chọn).
3. **Bước 3 — Trái tim ghép từ Pixel (`PixelHeartIntro`):** Khi OTP hợp lệ, màn hình bừng sáng hiệu ứng hàng trăm hạt pixel màu hồng pastel hội tụ từ khắp khung hình, ghép khớp thành một **trái tim pixel đang đập nhẹ nhàng**, kèm lời chào và nút dẫn bước vào dòng thời gian ảnh kỷ niệm & bức tâm thư.

---

## 2. Phạm vi: Goals, Non-Goals & Anti-Goals

### Goals (Cần đạt)
- **Trải nghiệm mặc định chạy ngay:** Bật sẵn yêu cầu đăng nhập User trong dữ liệu khởi tạo mẫu (`createInitialSeedData()`), tự tương thích ngược an toàn với `data/local-db.json` hoặc bảng `site_settings` cũ đã tồn tại.
  - Tài khoản mẫu khởi tạo để thử ngay trên máy:
    - **Tên đăng nhập:** `nguoithuong`
    - **Mật khẩu:** `love2026`
    - **Mã OTP 6 số:** `121024`
    - **Gợi ý OTP:** `Ngày tụi mình bắt đầu thương nhau (12/10/2024)`
- **Giao diện 2 bước xác thực đồng bộ phong cách Pastel Glass:**
  - Bước 1: Card kính mờ nhập `Tên đăng nhập` + `Mật khẩu`.
  - Bước 2: 6 ô nhập mã OTP tự động chuyển con trỏ sang ô kế tiếp khi gõ, hỗ trợ `Backspace` lùi ô và dán (`Paste`) trọn chuỗi 6 chữ số, kèm khung hiển thị gợi ý OTP và nút quay lại bước đăng nhập.
- **Màn hình Trái tim ghép từ Pixel (`PixelHeartIntro`):**
  - Vẽ trên HTML5 `<canvas>` 2D mượt 60fps: các ô pixel vuông nhỏ màu hồng/san hô/pastel (`#EC4899`, `#F472B6`, `#FBCFE8`, `#FB7185`, `#818CF8`) xuất phát rải rác trên màn hình rồi bay hội tụ về đúng toạ độ lưới tạo thành hình trái tim hoàn chỉnh, sau đó chuyển sang nhịp đập dịu nhẹ (`pulse`).
  - Hỗ trợ `prefers-reduced-motion`: hiển thị ngay trái tim pixel hoàn chỉnh không gây chóng mặt.
  - Hiển thị tên hai bạn và nút **"Bước vào hành trình kỷ niệm"** để mở giao diện `StoryExperience` (nên ghi nhớ trạng thái vừa qua intro trong phiên trình duyệt để khi reload trang không bắt xem lặp lại ngoài ý muốn).
- **Điều khiển trên trang kỷ niệm chính (`StoryExperience`):**
  - Thêm nút nhỏ gọn ở góc trên (cạnh nút nhạc nền) để **"Xem lại trái tim Pixel"** và **"Đăng xuất"** bất cứ lúc nào khi chế độ đăng nhập User đang bật.
- **Quản trị trong `/admin` (Tab *Mở đầu, Nhạc nền & Riêng tư*):**
  - Nâng cấp khối khoá riêng tư thành cấu hình **Tài khoản Người thương & Mã OTP 6 số**:
    - Bật/tắt yêu cầu đăng nhập User + OTP.
    - Chỉnh sửa **Tên đăng nhập**.
    - Nhập **Mật khẩu mới** (để trống nếu muốn giữ nguyên mật khẩu hiện tại).
    - Nhập **Mã OTP 6 chữ số mới** (bắt buộc đúng 6 chữ số `^\d{6}$`; để trống nếu giữ nguyên OTP hiện tại).
    - Chỉnh sửa **Lời gợi ý mã OTP** (tuỳ chọn).

### Non-Goals (Không nằm trong phạm vi)
- Không tích hợp dịch vụ gửi OTP qua Email/SMS bên ngoài (SMTP, Resend, Twilio).
- Không xây dựng hệ thống đăng ký mở hoặc quản lý danh sách nhiều tài khoản người dùng độc lập.

### Anti-Goals (Tuyệt đối tránh)
- Không gửi mật khẩu gốc, mã OTP gốc hay các chuỗi `viewerPasswordHash` / `viewerOtpHash` xuống trình duyệt (kể cả trong trang công khai, màn OTP hay API `/api/admin/settings`).
- Không cho phép bỏ qua bước 1 để gọi thẳng API xác thực OTP: bắt buộc phải có cookie phiên chờ OTP ngắn hạn mới được phép xác thực bước 2.

---

## 3. Các phương án kỹ thuật đã cân nhắc (Approaches)

1. **Phương án A (Đã chọn) — Mở rộng trực tiếp `site_settings` + `<canvas>` 2D Pixel Heart:**
   - Thêm các cột/trường tài khoản người thương (`viewerUsername`, `viewerPasswordHash`, `viewerOtpHash`, `viewerOtpHint`) ngay trên cấu hình `site_settings` hiện có trong cả Local JSON và Supabase Postgres, giữ nguyên quy trình tự động seed & không làm gián đoạn hệ thống hiện tại.
   - Dựng hiệu ứng Trái tim Pixel trên HTML5 `<canvas>` 2D giúp kiểm soát từng hạt pixel mượt ở 60fps trên cả điện thoại và máy tính.
   - *Đánh đổi:* Phục vụ đúng 1 tài khoản người thương; gọn nhẹ và bảo mật, phù hợp tuyệt đối với mục đích website tặng riêng cho một cặp đôi.
2. **Phương án B (Loại bỏ) — Bảng `viewer_users` đa tài khoản + Pixel Heart bằng DOM `<div>` Framer Motion:**
   - Phải tạo bảng riêng, UI quản lý thêm/sửa/xoá danh sách nhiều tài khoản và render hàng trăm phần tử DOM chuyển động cùng lúc, gây nặng máy trên mobile.

---

## 4. Thiết kế kỹ thuật & Quyết định của Builder

- **Phiên Cookie 2 giai đoạn tách biệt (`src/lib/auth.ts`):**
  - `ny_viewer_otp_pending`: Cookie `HttpOnly`, HMAC-SHA256 ký với prefix `'viewer_pending'`, thời hạn **5 phút** (`300s`), cấp sau khi `POST /api/viewer/login` xác thực thành công `viewerUsername` + `viewerPasswordHash` (`scrypt` + `timingSafeEqual`).
  - `ny_viewer_unlocked`: Cookie `HttpOnly`, HMAC-SHA256 ký với prefix `'viewer'`, thời hạn **7 ngày**, chỉ được cấp khi `POST /api/viewer/verify-otp` kiểm tra hợp lệ cả cookie `ny_viewer_otp_pending` lẫn mã OTP 6 số (`viewerOtpHash`), đồng thời xoá cookie `ny_viewer_otp_pending`.
- **API Endpoints cho User:**
  - `POST /api/viewer/login`: nhận `{ username, password }` -> kiểm tra khớp tài khoản -> set `ny_viewer_otp_pending`.
  - `POST /api/viewer/verify-otp`: nhận `{ otp }` (6 chữ số) -> kiểm tra có cookie `ny_viewer_otp_pending` hợp lệ và OTP đúng -> set `ny_viewer_unlocked` + xoá `ny_viewer_otp_pending`.
  - `POST /api/viewer/logout`: xoá cả `ny_viewer_otp_pending` và `ny_viewer_unlocked`.
  - (Loại bỏ/chuyển hướng sạch luồng `/api/viewer/unlock` 1 bước cũ sang 2 API mới này và cập nhật kiểm thử tương ứng.)
- **Mở rộng Dữ liệu & Tương thích ngược:**
  - `SiteSettings` bổ sung `viewerUsername`, `viewerPasswordHash`, `viewerOtpHash`, `viewerOtpHint` (thay thế hoặc kế thừa an toàn từ `viewerPasscodeHash` cũ).
  - `PublicSiteSettings` chỉ trả các trường công khai an toàn (`viewerPasscodeEnabled`, `viewerOtpHint`, không chứa username/hash).
  - `AdminSiteSettings` bổ sung `viewerUsername`, `viewerOtpHint`, `hasViewerPassword`, `hasViewerOtp` (không trả hash).
  - `supabase/schema.sql` bổ sung lệnh `ALTER TABLE site_settings ADD COLUMN IF NOT EXISTS ...` để nâng cấp an toàn cả database mới lẫn database Supabase đã tạo trước đó.
- **Điều phối luồng tại `/` (`src/app/page.tsx` & `StoryExperience`):**
  - Nếu `viewerPasscodeEnabled === true`:
    - Đã có `ny_viewer_unlocked` hợp lệ -> hiển thị màn chào **Trái tim ghép từ Pixel** (`PixelHeartIntro`, chỉ hiện lần đầu khi vừa mở khoá hoặc khi người dùng bấm *"Xem lại trái tim Pixel"*) rồi vào `StoryExperience`.
    - Chỉ có `ny_viewer_otp_pending` hợp lệ -> hiển thị bước 2 (**Nhập mã OTP 6 số**).
    - Chưa có cookie -> hiển thị bước 1 (**Đăng nhập User**).
