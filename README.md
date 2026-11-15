# Hành Trình Kỷ Niệm Của Tụi Mình

Website lưu giữ những bức ảnh kỷ niệm, bộ đếm ngày bên nhau theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), nhạc nền nhẹ nhàng, màn giới thiệu `<canvas>` trái tim pixel ghép nối và phong thư tâm sự dành riêng cho người thương — thiết kế theo phong cách **Godly Dark Velvet & Crimson-Rose (Đỏ & Hồng)**.

## 1. Chạy ngay trên máy cá nhân (Local Mode)

Không cần tạo tài khoản đám mây trước để xem và sử dụng thử:

```bash
npm install
npm run dev
```

Mở trình duyệt tại:
- **Trang câu chuyện kỷ niệm (`/`):** `http://localhost:3000`
- **Trang quản trị nội dung (`/admin`):** `http://localhost:3000/admin` (hoặc `/admin/login`)

Tài khoản mẫu được tự động khởi tạo ở lần thiết lập đầu tiên khi bảng tài khoản còn trống (áp dụng cho cả môi trường cục bộ lẫn lần khởi tạo đầu tiên trên production):
- **Tài khoản Quản trị (`admin` — vừa xem `/` vừa quản trị `/admin`):**
  - Tên đăng nhập: `admin`
  - Mật khẩu khởi tạo: ở chế độ cục bộ (`NODE_ENV !== 'production'`), mặc định là `love2026` nếu chưa đặt `ADMIN_PASSWORD`; ở môi trường **production** (`NODE_ENV === 'production'`), bắt buộc phải cấu hình `ADMIN_PASSWORD` khác `love2026`.
  - Mã OTP 6 số khởi tạo: mặc định `140226` (hoặc giá trị 6 chữ số từ biến tuỳ chọn `ADMIN_DEFAULT_OTP`).
- **Tài khoản Người thương (`viewer` — chỉ xem `/`):**
  - Tên đăng nhập: `nguoithuong`
  - Mật khẩu khởi tạo: `love2026`
  - Mã OTP 6 số khởi tạo: `121024`
  - *Lưu ý bảo mật:* Ở môi trường cục bộ (`dev`), tài khoản `nguoithuong` được kích hoạt sẵn (`isActive: true`) để thử nghiệm ngay. Khi khởi tạo database ở môi trường **production** (`NODE_ENV === 'production'`), tài khoản mẫu `nguoithuong` mặc định ở trạng thái **tạm khoá (`isActive: false`)** cho đến khi bạn đăng nhập `/admin` đổi mật khẩu/OTP riêng và mở khoá.

### Trải nghiệm 2 bước xác thực + Trái tim Pixel tại `/`
1. **Bước 1 — Đăng nhập:** Nhập `Tên đăng nhập` + `Mật khẩu yêu thương`.
2. **Bước 2 — Xác thực OTP 6 số:** Nhập 6 chữ số kỷ niệm (hỗ trợ tự nhảy ô và dán 6 số kèm gợi ý OTP riêng của tài khoản).
3. **Bước 3 — Trái tim Pixel & Hành trình kỷ niệm:** Sau khi OTP hợp lệ, màn hình `<canvas>` trái tim pixel đỏ hồng hội tụ và đập nhịp trước khi bước vào dòng thời gian kỷ niệm cùng hiệu ứng tình yêu dịu nhẹ.

Trong chế độ cục bộ, dữ liệu được lưu tại `data/local-db.json` và tệp tải lên nằm trong `public/uploads/`.

## 2. Quản trị 5 tab tại `/admin`

1. Truy cập `http://localhost:3000/admin/login` và đăng nhập bằng tài khoản có vai trò `admin` (mặc định `admin`).
2. **Tab 1 — Kỷ niệm & Ảnh:** Nhấn **Thêm kỷ niệm mới** hoặc **Sửa** để tải ảnh thật lên (`JPG`, `PNG`, `WebP`, `GIF`, `AVIF` tối đa `10MB`; ảnh tĩnh lớn tự nén tối ưu trên trình duyệt), sắp xếp thứ tự hoặc sắp xếp theo ngày tăng dần.
3. **Tab 2 — Mở đầu, Nhạc nền & Riêng tư:** Tuỳ chỉnh tên hai bạn, lời dẫn, ngày bắt đầu yêu, tải file nhạc (`MP3`, `M4A`, `WAV` tối đa `15MB`) và bật/tắt công tắc **Khoá bảo vệ trang kỷ niệm (Đăng nhập + OTP 6 số)**.
4. **Tab 3 — Phong thư tâm sự:** Soạn thảo tiêu đề, nội dung, chữ ký và xem trước trực tiếp giao diện bức thư trước khi lưu.
5. **Tab 4 — Tài khoản & Kiểm soát truy cập:**
   - Tạo thêm tài khoản mới (`viewer` chỉ xem `/` hoặc `admin` quản trị & xem) kèm mật khẩu, mã OTP 6 chữ số và gợi ý OTP.
   - Chỉnh sửa tên hiển thị, đổi vai trò, đặt lại mật khẩu / mã OTP 6 số.
   - **Khoá / Mở khoá** tài khoản hoặc nhấn **Thu hồi phiên** để đăng xuất từ xa ngay lập tức ở lần tải/tương tác kế tiếp.
   - Tự động bảo vệ an toàn: không cho tự khoá, tự thu hồi phiên, tự xoá tài khoản đang đăng nhập hoặc làm mất tài khoản quản trị hoạt động cuối cùng.
6. **Tab 5 — Nhật ký ra vào & Hành động:**
   - Theo dõi 4 chỉ số trong ngày theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`): lượt ghé trang, lượt xác thực OTP thành công, cảnh báo đăng nhập/OTP sai, và số tài khoản đang hoạt động.
   - Lọc theo loại hành động (ghé/rời trang, đăng nhập, OTP, ngắm trái tim pixel, nhạc nền, xem ảnh, mở thư, đăng xuất), lọc theo tài khoản (bao gồm `Khách ghé trang`), tìm kiếm từ khoá và làm mới dữ liệu theo thời gian thực.

## 3. Triển khai trực tuyến với Supabase + Vercel (3 bước)

Hệ thống tự động chuyển sang chế độ **Supabase Cloud** khi phát hiện đầy đủ biến môi trường Supabase, sử dụng **Signed Upload URL** để tải ảnh trực tiếp từ trình duyệt lên Supabase Storage (không bị giới hạn payload 4.5MB của Vercel).

1. **Khởi tạo Supabase:** Tạo một project trên Supabase, vào mục **SQL Editor** và chạy toàn bộ nội dung tệp [`supabase/schema.sql`](./supabase/schema.sql). Lệnh SQL sẽ tạo 4 bảng có Row Level Security bật chặt (`site_settings`, `memories`, `app_users`, `activity_logs`) cùng bucket `love-memories` (đọc công khai, ghi chỉ qua Signed Upload URL từ server).
2. **Cấu hình biến môi trường trên Vercel (hoặc `.env.local`):** Sao chép từ [`.env.example`](./.env.example):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD` (bắt buộc đặt mật khẩu mạnh khác `love2026` khi khởi tạo DB production lần đầu)
   - `ADMIN_SESSION_SECRET` (chuỗi ngẫu nhiên tối thiểu 32 ký tự để ký session cookie — bắt buộc trong môi trường production)
   - `ADMIN_DEFAULT_OTP` (tuỳ chọn, mã OTP 6 số mặc định cho `admin` khi khởi tạo DB lần đầu; mặc định `140226`)
   - `SUPABASE_STORAGE_BUCKET` (tuỳ chọn, mặc định là `love-memories`)
3. **Deploy lên Vercel:** Push mã nguồn lên GitHub và import vào Vercel (framework Next.js mặc định). Sau khi deploy xong, mở `/admin/login` để đổi OTP/mở khoá tài khoản `nguoithuong`, thêm ảnh kỷ niệm và tâm thư trực tuyến.

## 4. Lệnh kiểm tra kỹ thuật

```bash
npm run typecheck
npm test
npm run build
```
