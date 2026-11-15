# Hành Trình Kỷ Niệm Của Tụi Mình

Website lưu giữ những bức ảnh kỷ niệm cũ, bộ đếm ngày bên nhau theo múi giờ Việt Nam, nhạc nền nhẹ nhàng và phong thư tâm sự dành cho người thương — thiết kế theo phong cách **Trắng Tinh Khôi & Kính Mờ Pastel**.

## 1. Chạy ngay trên máy cá nhân (Local Mode)

Không cần tạo tài khoản đám mây trước để xem và sử dụng thử:

```bash
npm install
npm run dev
```

Mở trình duyệt tại:
- **Trang câu chuyện kỷ niệm:** `http://localhost:3000`
- **Trang quản trị nội dung:** `http://localhost:3000/admin`

Mật khẩu quản trị mặc định khi chạy cục bộ (nếu chưa cấu hình `.env.local`):
- `love2026`

Trong chế độ cục bộ, dữ liệu được lưu tại `data/local-db.json` và tệp tải lên nằm trong `public/uploads/`.

## 2. Thay ảnh kỷ niệm thật & nhạc nền

1. Truy cập `http://localhost:3000/admin` và đăng nhập.
2. Tại tab **Kỷ niệm & Ảnh**, nhấn **Thêm kỷ niệm mới** hoặc **Sửa** để tải ảnh thật từ máy lên (`JPG`, `PNG`, `WebP`, `GIF`, `AVIF` tối đa `10MB`). Ảnh tĩnh dung lượng lớn được tự động tối ưu trong trình duyệt trước khi gửi.
3. Tại tab **Mở đầu, Nhạc nền & Riêng tư**, bạn có thể sửa tên hai bạn, chọn ngày bắt đầu yêu, tải file nhạc (`MP3`, `M4A`, `WAV` tối đa `15MB`) hoặc bật **Khoá mã riêng tư** cho trang chính.
4. Tại tab **Phong thư tâm sự**, chỉnh sửa nội dung lá thư và xem trước trực tiếp trước khi lưu.

## 3. Triển khai trực tuyến với Supabase + Vercel (3 bước)

Hệ thống tự động chuyển sang chế độ **Supabase Cloud** khi phát hiện đầy đủ biến môi trường Supabase, sử dụng **Signed Upload URL** để tải ảnh trực tiếp từ trình duyệt lên Supabase Storage (không bị giới hạn payload 4.5MB của Vercel).

1. **Khởi tạo Supabase:** Tạo một project trên Supabase, vào mục **SQL Editor** và chạy toàn bộ nội dung tệp [`supabase/schema.sql`](./supabase/schema.sql). Lệnh SQL sẽ tạo bảng `site_settings`, `memories` và bucket `love-memories` (chế độ đọc công khai, ghi qua signed URL từ server).
2. **Cấu hình biến môi trường trên Vercel (hoặc `.env.local`):** Sao chép từ `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ADMIN_PASSWORD` (mật khẩu quản trị riêng của bạn)
   - `ADMIN_SESSION_SECRET` (chuỗi ngẫu nhiên tối thiểu 32 ký tự để ký session cookie — bắt buộc trong môi trường production)
   - `SUPABASE_STORAGE_BUCKET` (tuỳ chọn, mặc định là `love-memories`)
3. **Deploy lên Vercel:** Push mã nguồn lên GitHub và import vào Vercel (framework Next.js mặc định). Sau khi deploy xong, mở `/admin` để thêm ảnh kỷ niệm và tâm thư trực tuyến.

## 4. Lệnh kiểm tra kỹ thuật

```bash
npm run typecheck
npm test
npm run build
```
