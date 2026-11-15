# Thiết kế tính năng: Tài khoản phân quyền (Admin + User), Xác thực OTP 6 số, Trái tim ghép từ Pixel & Nhật ký ra vào

**Ngày:** 2026-11-15  
**Nhánh phát triển:** `feat/love-memories-website`  
**Phong cách áp dụng:** B · Trắng Tinh Khôi & Kính Mờ Pastel (`Airy Glass Minimal`)

---

## 1. Mục tiêu & Bối cảnh (Intent & Why)

Mở rộng website kỷ niệm hiện tại để:
1. **Phân quyền rõ ràng giữa Chủ trang (`Admin + User`) và Người thương (`User`):**
   - Chủ trang sử dụng tài khoản `admin` (hoặc bất kỳ tài khoản nào có `role = 'admin'`) để vừa đăng nhập ngoài trang chính `/` (trải nghiệm đủ OTP → Trái tim ghép từ Pixel → Dòng thời gian ảnh & tâm thư), vừa truy cập khu vực `/admin` quản trị nội dung, quản lý tài khoản và theo dõi hoạt động.
   - Người thương sử dụng tài khoản `viewer` do Admin tạo và cấp riêng (`username`, `password`, `mã OTP 6 chữ số`, `lời gợi ý OTP`) để vào xem trang chính `/`, hoàn toàn không có quyền truy cập `/admin` hay các API quản trị.
2. **Nghi thức mở trang 3 bước ngọt ngào tại `/`:**
   - **Bước 1 — Đăng nhập User:** Nhập `Tên đăng nhập` + `Mật khẩu`.
   - **Bước 2 — Xác thực OTP 6 chữ số:** Nhập 6 ô số kỷ niệm (tự động nhảy ô, hỗ trợ dán 6 số, hiển thị gợi ý OTP tuỳ chọn của chính tài khoản đó hoặc cấu hình chung).
   - **Bước 3 — Trái tim ghép từ Pixel (`PixelHeartIntro`):** Khi OTP hợp lệ, màn hình hiển thị hiệu ứng HTML5 `<canvas>` 2D mượt 60fps với hàng trăm hạt pixel pastel bay hội tụ ghép khớp thành hình **Trái tim đang đập nhẹ**, kèm lời chào theo `displayName` và nút **"Bước vào hành trình kỷ niệm"**.
3. **Kiểm soát ra vào & Nhật ký hành động của User trong `/admin`:**
   - Admin chủ động bật/tắt cổng đăng nhập bắt buộc, tạo/sửa/khoá tài khoản người xem, hoặc bấm **Thu hồi phiên đăng nhập** để buộc tài khoản đang mở trang phải xác thực lại ngay lập tức.
   - Admin theo dõi được **thống kê lượt ra vào** và **nhật ký hành động chi tiết theo giờ Việt Nam (`Asia/Ho_Chi_Minh`)**: vào trang, đăng nhập thành công/thất bại, xác thực OTP thành công/thất bại, xem xong Trái tim Pixel, bật/tắt nhạc nền, phóng to xem bức ảnh kỷ niệm nào, chạm mở phong thư tâm sự, đăng xuất và rời trang.

---

## 2. Phạm vi: Goals, Non-Goals & Anti-Goals

### Goals (Cần đạt)
- **Quản lý đa tài khoản phân quyền (`app_users`):**
  - Mỗi tài khoản gồm: `id`, `username` (chuẩn hoá chữ thường, không khoảng trắng, 3–32 ký tự `[a-z0-9._-]`, duy nhất), `displayName`, `role` (`'admin' | 'viewer'`), `passwordHash` (`scrypt`), `otpHash` (`scrypt` của đúng 6 chữ số `^\d{6}$`), `otpHint`, `isActive`, `sessionVersion` (số nguyên tăng mỗi lần thu hồi phiên/đổi mật khẩu/đổi OTP/khoá), `createdAt`, `updatedAt`.
  - **Khởi tạo mặc định (auto-seed) 2 tài khoản sẵn sàng chạy ngay trên máy:**
    1. `admin` (`role: 'admin'`, `isActive: true`, tên hiển thị `"Chủ nhân trang kỷ niệm"`, mật khẩu khởi tạo lấy từ `process.env.ADMIN_PASSWORD` — nếu `NODE_ENV === 'production'` mà thiếu `ADMIN_PASSWORD` lúc khởi tạo lần đầu thì fail-closed báo lỗi 500; ở môi trường dev cục bộ mặc định `love2026`; OTP khởi tạo `121024`, gợi ý `"Ngày kỷ niệm mặc định (121024)"`).
    2. `nguoithuong` (`role: 'viewer'`, tên hiển thị `"Người thương"`, mật khẩu khởi tạo `love2026`, OTP `121024`, gợi ý `"Ngày tụi mình bắt đầu thương nhau (12/10/2024)"`).
       - **Quy tắc theo môi trường (Người dùng đã chốt):** Ở máy cá nhân / dev (`NODE_ENV !== 'production'`), `nguoithuong` được khởi tạo ở trạng thái **hoạt động (`isActive: true`)** để test ngay. Khi triển khai online (`NODE_ENV === 'production'`), `nguoithuong` được khởi tạo ở trạng thái **tạm khoá (`isActive: false`)** để tránh người ngoài vào trước khi bạn đăng nhập `/admin` đặt mật khẩu/OTP riêng và mở khoá.
  - **Tương thích ngược, Nguồn chân lý `ADMIN_PASSWORD` & Chống tự khoá mình:**
    - *(Builder's call về `ADMIN_PASSWORD`):* `ADMIN_PASSWORD` **chỉ là mật khẩu seed ban đầu** khi tạo tài khoản `admin` lúc `app_users` đang trống. Sau khi `app_users` đã có dữ liệu, bảng `app_users` (`passwordHash`, `isActive`, `sessionVersion`) là **nguồn chân lý duy nhất** cho cả `/api/admin/login` lẫn `/api/viewer/login` — nhờ đó việc đổi mật khẩu hay thu hồi phiên trong `/admin` có hiệu lực thật ngay lập tức. (Ngoại lệ duy nhất là chế độ Vercel chỉ đọc chưa nối Supabase, vì `createInitialSeedData()` tạo dữ liệu mẫu trong RAM mỗi request dựa trên `ADMIN_PASSWORD`.)
    - Nếu `data/local-db.json` hoặc DB Supabase cũ chưa có bảng/mảng `users` & `activityLogs`, hệ thống tự động bổ sung 2 tài khoản mặc định mà không làm mất `settings` và `memories` hiện có.
    - Hệ thống chặn không cho xoá, khoá (`isActive = false`) hoặc hạ quyền tài khoản `admin` đang hoạt động cuối cùng trong hệ thống.
    - Trang `/admin/login` hỗ trợ đăng nhập bằng `Tên đăng nhập` (mặc định `'admin'` để giữ tương thích) + `Mật khẩu` của bất kỳ tài khoản `role === 'admin'` nào đang `isActive`.
- **Xác thực 2 bước & Kiểm soát phiên theo thời gian thực tại `/`:**
  - `viewerPasscodeEnabled` (tên gọi hiển thị UI: **"Yêu cầu đăng nhập tài khoản & OTP khi vào trang"**) mặc định được **bật (`true`)** ở seed mới để đúng trải nghiệm mở trang có đăng nhập -> OTP -> Trái tim Pixel (Admin có thể tắt công tắc này bất cứ lúc nào trong `/admin` để mở trang công khai không cần đăng nhập).
  - *Quyết định mặc định khi migrate `local-db.json` cũ (chưa có trường `users`):* Tự động seed cặp tài khoản mặc định (`admin` + `nguoithuong`) và **bật một lần** `viewerPasscodeEnabled = true` khi nâng cấp từ file `local-db.json` giai đoạn trước chưa có `users` (tương tự khi DB mới hoàn toàn / rỗng), sau đó luôn tôn trọng trạng thái Admin lưu trong `/admin` tab *Tài khoản & Kiểm soát vào ra*.
  - **Bước 1 (`POST /api/viewer/login`):** Kiểm tra `username` + `password` khớp tài khoản `isActive === true`. Nếu đúng -> cấp cookie `ny_viewer_otp_pending` (HMAC-SHA256 ký ở server, `HttpOnly`, `SameSite=Lax`, thời hạn **5 phút**, payload gồm `userId`, `username`, `role`, `sessionVersion`, `exp`). Ghi log `login_step1_ok` (hoặc `login_failed` nếu sai/bị khoá).
  - **Bước 2 (`POST /api/viewer/verify-otp`):** Bắt buộc phải có cookie `ny_viewer_otp_pending` hợp lệ + tài khoản còn `isActive` và đúng `sessionVersion`. Kiểm tra mã OTP 6 chữ số khớp `otpHash`. Nếu đúng:
    - Cấp cookie `ny_viewer_unlocked` (`HttpOnly`, `SameSite=Lax`, thời hạn **7 ngày**, chứa `userId`, `username`, `role`, `sessionVersion`, `exp`).
    - Xoá cookie `ny_viewer_otp_pending`.
    - Nếu tài khoản có `role === 'admin'`, đồng thời cấp luôn cookie `ny_admin_session` (cùng `userId`, `username`, `role: 'admin'`, `sessionVersion`) để Admin có thể bấm nút chuyển thẳng sang `/admin` mà không phải đăng nhập lại.
    - Ghi log `otp_verified` (hoặc `otp_failed` nếu sai OTP).
  - **Kiểm tra phiên live ở Server Component & API:** Mỗi lần kiểm tra `isViewerRequestUnlocked()` hoặc `isAdminRequestAuthenticated()`, ngoài chữ ký HMAC & hạn `exp`, hệ thống đối chiếu `userId` còn tồn tại, `isActive === true`, `user.sessionVersion === token.sessionVersion` (và với `/admin`, bắt buộc `user.role === 'admin'`). Do đó khi Admin khoá user hoặc thu hồi phiên (`sessionVersion + 1`), user đang mở web sẽ bị đá ra màn hình đăng nhập ở lần tải/tương tác kế tiếp ngay lập tức.
- **Trái tim ghép từ Pixel (`PixelHeartIntro`) & Thanh điều hướng nhỏ trên `/`:**
  - Khi user vừa vượt qua bước OTP (hoặc chưa xem intro trong tab hiện tại — theo dõi qua `sessionStorage` theo `userId`), `/` hiển thị `PixelHeartIntro` trước khi vào `StoryExperience`.
  - Vẽ trên `<canvas>` 2D responsive (hỗ trợ `devicePixelRatio`): lưới ma trận hình trái tim kinh điển (~180–260 ô pixel vuông bo nhẹ góc `2px` màu hồng/san hô/indigo pastel), lúc đầu phân tán ngẫu nhiên quanh khung hình rồi dùng easing bay hội tụ khớp thành trái tim trong ~1.4 giây, tiếp nối bằng nhịp đập dịu nhẹ (`scale` / glow nhẹ) cùng tên hai bạn, lời chào `"Chào mừng ${displayName}"` và nút **"Bước vào hành trình kỷ niệm"**.
  - Nếu trình duyệt bật `prefers-reduced-motion: reduce`, vẽ ngay trái tim pixel hoàn chỉnh không chuyển động bay.
  - Khi người dùng đã bấm bước vào `StoryExperience`: góc trên trang chính có cụm nút kính mờ gọn gồm **Bật/tắt nhạc nền** + **Xem lại trái tim Pixel** + (nếu `role === 'admin'`) nút **Quản trị `/admin`** + nút **Đăng xuất** (`POST /api/viewer/logout`, xoá cookie và ghi log `logout`).
- **Kiểm soát ra vào & Nhật ký hành động (`activity_logs`):**
  - Các loại `action` chuẩn hoá:
    - `page_visit` (mở trang `/` — ghi nhận cả khi khách vãng lai mở màn hình đăng nhập lẫn khi user đã đăng nhập mở trang kỷ niệm. Phía client tách riêng khoá `sessionStorage` theo `'guest'` vs `userId` để sau khi đăng nhập thành công vẫn ghi đúng lượt vào của tài khoản thật và không lặp khi `router.refresh()`).
    - `login_step1_ok`, `login_failed`
    - `otp_verified`, `otp_failed`
    - `pixel_heart_viewed` (bấm vào câu chuyện từ màn hình Trái tim Pixel)
    - `music_toggled` (`detail`: `"Bật nhạc nền"` / `"Tắt nhạc nền"`)
    - `memory_viewed` (`detail`: tiêu đề/ngày kỷ niệm khi mở Lightbox)
    - `letter_opened` (`detail`: `"Chạm mở phong thư tâm sự"`)
    - `logout`
    - `page_leave` (gửi qua `navigator.sendBeacon('/api/viewer/activity', ...)` khi đóng/ẩn tab ở `visibilitychange === 'hidden'`, chống trùng lặp phía client + server trong cửa sổ 5 giây)
  - **Ghi nhận khách ghé màn đăng nhập & chống spam (Người dùng đã chốt):**
    - Khi cổng đăng nhập đang bật và người xem chưa đăng nhập, `POST /api/viewer/activity` vẫn nhận `page_visit` và `page_leave` dưới danh nghĩa `"Khách ghé trang"` (`username: 'khach'`, `userRole: 'guest'`) để Admin nắm được đầy đủ lượng truy cập vào trang.
    - Để chống spam DB từ request ẩn danh, server gắn kèm cookie HMAC `ny_guest_activity_cooldown` (TTL **10 phút**): mỗi trình duyệt khách chỉ ghi tối đa 1 `page_visit` và 1 `page_leave` trong mỗi 10 phút.
    - Toàn bộ sự kiện tương tác bên trong nội dung (`pixel_heart_viewed`, `music_toggled`, `memory_viewed`, `letter_opened`) vẫn bắt buộc phải có cookie phiên `ny_viewer_unlocked` hợp lệ (hoặc `viewerPasscodeEnabled === false`).
  - Mỗi bản ghi lưu: `id`, `userId`, `username`, `displayName`, `userRole`, `action`, `detail`, `deviceSummary` (rút gọn sạch từ `User-Agent`, ví dụ `"iPhone · Safari"`, `"Android · Chrome"`, `"macOS · Chrome"`, `"Desktop · Browser"`), `createdAt`.
  - Lưu trữ:
    - Local JSON: lưu tối đa **500 bản ghi mới nhất** (tự cắt gọn khi vượt ngưỡng để file JSON luôn nhẹ).
    - Supabase Postgres: bảng `activity_logs` có chỉ mục `(created_at desc)` và `(user_id, created_at desc)`; trang quản trị đọc tối đa 200 bản ghi gần nhất kèm bộ lọc theo tài khoản & loại hành động, cùng nút **"Xoá nhật ký"**.

### Non-Goals (Không nằm trong phạm vi)
- Không tích hợp gửi mã OTP ra ngoài qua Email/SMS/Zalo.
- Không thu thập địa chỉ IP thô, toạ độ GPS hay gắn mã theo dõi của bên thứ ba.
- Không cho phép người lạ tự đăng ký tài khoản công khai từ màn hình đăng nhập.

### Anti-Goals (Tuyệt đối tránh)
- Không gửi `passwordHash`, `otpHash`, mã OTP thật hay bí mật phiên xuống trình duyệt ở bất kỳ API nào.
- Không để tài khoản `role = 'viewer'` truy cập được `/admin` hoặc gọi thành công `/api/admin/*` (bắt buộc trả `401`/`403` hoặc chuyển hướng về `/admin/login`).
- Không để bảng `activity_logs` chưa xác thực trở thành lỗ hổng spam DB: kiểm soát độ dài `detail` (`<= 160` ký tự), chỉ cho phép các `action` nằm trong enum `ALLOWED_VIEWER_ACTIONS`, áp dụng cookie cooldown 10 phút cho `page_visit`/`page_leave` của khách chưa đăng nhập, và bắt buộc phiên `ny_viewer_unlocked` cho toàn bộ sự kiện tương tác trong trang.

---

## 3. Các phương án kiến trúc đã cân nhắc (Approaches)

1. **Phương án 1 (Đã chọn) — Quản lý `app_users` & `activity_logs` thống nhất trên Dual-Mode Storage (Local JSON + Supabase) + `<canvas>` Pixel Heart:**
   - **Ưu điểm:** Chạy hoàn chỉnh ngay trên máy cá nhân (`npm start` / `npm run dev`) không cần Internet hay tài khoản Supabase; khi deploy lên Vercel + Supabase chỉ cần chạy 1 lần `supabase/schema.sql`; dùng username ngắn gọn thân mật; đặt mã OTP 6 số mang ý nghĩa kỷ niệm tuỳ ý; kiểm soát khoá/thu hồi phiên real-time; vẽ trái tim pixel trên `<canvas>` siêu nhẹ 60fps.
   - **Đánh đổi:** Tự quản lý vòng đời cookie HMAC và bảng `app_users` thay vì dùng dịch vụ Auth đóng gói sẵn; phù hợp hoàn hảo với quy mô ứng dụng riêng tư cho cặp đôi/gia đình nhỏ.
2. **Phương án 2 (Loại bỏ) — Dùng Supabase Auth (GoTrue) cho tài khoản + bảng log riêng:**
   - **Lý do loại:** Bắt buộc phải cấu hình Supabase ngay cả khi chạy cục bộ, ép dùng email thay vì tên đăng nhập thân mật và không hỗ trợ mã OTP 6 số cố định mang tính kỷ niệm.

---

## 4. Thiết kế Kỹ thuật, Dữ liệu & Giao diện Quản trị (Builder Specification & Decisions)

### 4.1. Cấu trúc Dữ liệu & SQL (`src/types/memories.ts` & `supabase/schema.sql`)
- **`AppUser` (`app_users`):**
  - Postgres table `app_users`:
    - `id uuid primary key default gen_random_uuid()`
    - `username text unique not null`
    - `display_name text not null`
    - `role text not null check (role in ('admin', 'viewer'))`
    - `password_hash text not null`
    - `otp_hash text not null`
    - `otp_hint text not null default ''`
    - `is_active boolean not null default true`
    - `session_version integer not null default 1`
    - `created_at timestamptz not null default now()`
    - `updated_at timestamptz not null default now()`
- **`ActivityLog` (`activity_logs`):**
  - Postgres table `activity_logs`:
    - `id uuid primary key default gen_random_uuid()`
    - `user_id uuid null references app_users(id) on delete set null`
    - `username text not null default 'khach'`
    - `display_name text not null default 'Khách'`
    - `user_role text not null default 'guest'`
    - `action text not null`
    - `detail text not null default ''`
    - `device_summary text not null default ''`
    - `created_at timestamptz not null default now()`
  - RLS bật (`enable row level security`) và **không mở policy `anon`** giống `site_settings` / `memories`: toàn bộ thao tác đọc/ghi đi qua Next.js server với `SUPABASE_SERVICE_ROLE_KEY`.
- **`LocalDbSchema` (`data/local-db.json`):**
  - Gồm `{ settings, memories, users, activityLogs }`.
  - Khi `readDb()` đọc file JSON cũ thiếu `users` hoặc `activityLogs`, tự động chuẩn hoá và seed sẵn `admin` + `nguoithuong` an toàn mà không ghi đè ảnh/thư đã nhập.

### 4.2. Cơ chế Cookie Phiên 2 Giai đoạn (`src/lib/auth.ts`)
- Payload JSON được mã hoá `base64url` + chữ ký HMAC-SHA256 (khác prefix `'admin' | 'viewer' | 'viewer_pending'`):
  - `AdminToken`: `{ typ: 'admin', uid, usr, rol: 'admin', ver, exp }`.
  - `ViewerPendingToken`: `{ typ: 'viewer_pending', uid, usr, rol, ver, exp }` (TTL 300s).
  - `ViewerToken`: `{ typ: 'viewer', uid, usr, rol, ver, exp }` (TTL 7 ngày).
- Server helper xác thực kèm đối chiếu DB (`resolveAuthenticatedViewer(request?)` và `resolveAuthenticatedAdmin(request?)`):
  - Xác minh chữ ký HMAC + `exp` -> gọi `repo.findUserById(uid)` -> kiểm tra `user && user.isActive && user.sessionVersion === token.ver` (và với admin: `user.role === 'admin'`).
  - *Lưu ý Vercel Read-Only fallback:* Nếu hệ thống chạy ở chế độ Local trên serverless chỉ đọc (`process.env.VERCEL` không có Supabase), `users` seed mặc định vẫn tồn tại trong bộ nhớ cho phép thử giao diện xem trước, và banner cảnh báo Supabase vẫn hiển thị ở `/admin`.

### 4.3. Danh sách API Routes mới & nâng cấp
- **Public / Viewer:**
  - `POST /api/viewer/login`: nhận `{ username, password }` -> kiểm tra tài khoản trong `app_users` -> set `ny_viewer_otp_pending` -> trả `{ ok: true, otpHint, displayName }` -> ghi log `login_step1_ok` / `login_failed`.
  - `POST /api/viewer/verify-otp`: nhận `{ otp }` (6 số) -> kiểm tra `ny_viewer_otp_pending` + user hợp lệ + khớp `otpHash` -> set `ny_viewer_unlocked` (và nếu `role === 'admin'` set luôn `ny_admin_session`), xoá `ny_viewer_otp_pending` -> trả `{ ok: true, role, displayName, username }` -> ghi log `otp_verified` / `otp_failed`.
  - `POST /api/viewer/logout`: đọc phiên hiện tại để ghi log `logout` -> xoá sạch `ny_viewer_unlocked`, `ny_viewer_otp_pending` và `ny_admin_session` (đăng xuất ở `/` xoá cả admin session trên trình duyệt để đảm bảo an toàn khi đưa máy cho người khác).
  - `POST /api/viewer/activity`: nhận `{ action, detail }` (hoặc `text/plain` JSON từ `navigator.sendBeacon`), kiểm tra enum hợp lệ, lấy `deviceSummary` từ `User-Agent`: nếu có phiên `ny_viewer_unlocked` hợp lệ -> ghi log theo user thật; nếu là `page_visit` / `page_leave` chưa đăng nhập -> kiểm tra/cấp cookie `ny_guest_activity_cooldown` (10 phút) để chống spam rồi ghi log `"Khách ghé trang"`; các action tương tác sâu khi chưa đăng nhập trả `401`.
- **Admin (`/api/admin/*` — bắt buộc `role === 'admin'`):**
  - `POST /api/admin/login`: nhận `{ username?, password }` (`username` mặc định `'admin'` nếu bỏ trống); kiểm tra user `role === 'admin'` + `isActive` trong `app_users` -> cấp cookie `ny_admin_session` + `ny_viewer_unlocked` (để admin xem được `/` ngay không vướng khoá).
  - `GET /api/admin/users`: trả danh sách `AdminUserView[]` (đã loại bỏ `passwordHash` & `otpHash`).
  - `POST /api/admin/users`: tạo tài khoản mới (`username`, `displayName`, `role`, `password` >= 6 ký tự, `otp` đúng 6 chữ số, `otpHint`).
  - `PUT /api/admin/users/[id]`: cập nhật `displayName`, `role`, `isActive`, `otpHint`, tuỳ chọn đổi `password` hoặc đổi `otp` 6 chữ số, tự động tăng `sessionVersion` nếu khoá tài khoản, hạ quyền hoặc đổi mật khẩu/OTP; chặn tự khoá/hạ quyền admin cuối cùng.
  - `DELETE /api/admin/users/[id]`: xoá tài khoản (chặn tự xoá chính mình hoặc admin cuối cùng).
  - `POST /api/admin/users/revoke-sessions`: nhận `{ userId? }` -> tăng `sessionVersion` cho user chỉ định (hoặc toàn bộ `viewer`) để ép đăng xuất ngay lập tức.
  - `GET /api/admin/activity`: trả `{ summary, logs }` gồm tổng lượt mở trang, lượt đăng nhập thành công/thất bại, lượt mở tâm thư, danh sách người dùng gần đây và 200 bản ghi mới nhất (hỗ trợ filter `?userId=...&action=...`).
  - `DELETE /api/admin/activity`: dọn sạch bảng `activity_logs`.

### 4.4. Giao diện Người dùng (`/`) & Quản trị (`/admin`)
- **`src/components/story/ViewerAuthFlow.tsx` (thay thế `ViewerPasscodeGate`):**
  - **Trạng thái Step 1 (`login`):** Form kính mờ nhập `Tên đăng nhập` & `Mật khẩu`, báo lỗi rõ bằng tiếng Việt.
  - **Trạng thái Step 2 (`otp`):** 6 ô vuông nhập từng chữ số (`inputMode="numeric"`, auto-focus ô tiếp theo, hỗ trợ paste chuỗi 6 số), hiển thị tên chào mừng + khung **Gợi ý mã OTP** (nếu có), nút `"Đổi tài khoản khác"` để quay lại bước 1 (gọi `/api/viewer/logout`).
  - Có nút dẫn nhỏ ở chân card (`"Dành cho quản trị viên"`) trỏ tới `/admin/login`.
- **`src/components/story/PixelHeartIntro.tsx`:**
  - HTML5 `<canvas>` vẽ hình trái tim pixel độ phân giải lưới `19 x 17` ô (tâm chuẩn đẹp, đối xứng, kích thước từng pixel tự co giãn theo màn hình mobile/desktop), hiệu ứng:
    - Phase 1 (`0 -> 1.4s`): ~200 viên pixel bay từ vị trí ngẫu nhiên với easing bậc 3 về đúng ô lưới trái tim, kèm ánh sáng glow nhẹ pastel.
    - Phase 2 (`> 1.4s`): Trái tim nhịp đập nhẹ nhàng (`1 + 0.045 * sin(...)`) và lấp lánh vài hạt sáng bay nhẹ xung quanh.
  - Nút CTA kính mờ: **"Bước vào hành trình kỷ niệm ♥"** (gọi callback + gửi sự kiện `pixel_heart_viewed`).
- **`src/components/admin/AdminDashboard.tsx` (mở rộng từ 3 lên 5 tab gọn gàng, tách component con theo tab để dễ bảo trì):**
  1. **Kỷ niệm & Ảnh** (giữ nguyên đầy đủ CRUD + sắp xếp)
  2. **Mở đầu & Nhạc nền** (tên hai bạn, lời dẫn, ngày yêu VN, nhạc nền)
  3. **Phong thư tâm sự** (soạn thảo + xem trước live Cormorant Garamond)
  4. **Tài khoản & Kiểm soát vào ra:**
     - Công tắc bật/tắt **Yêu cầu đăng nhập User + OTP tại trang chính**.
     - Nút **"Thu hồi tất cả phiên người xem"** (bắt đăng nhập & OTP lại ngay).
     - Danh sách tài khoản (huy hiệu `Admin + User` vs `User Người thương`, trạng thái `Đang hoạt động` / `Đã khoá`), form thêm/sửa tài khoản (`username`, `tên hiển thị`, `vai trò`, `mật khẩu mới`, `mã OTP 6 chữ số`, `gợi ý OTP`), nút **Khoá/Mở khoá**, **Thu hồi phiên riêng**, và **Xoá**.
  5. **Nhật ký hoạt động:**
     - 4 thẻ thống kê tổng quan: *Lượt mở trang*, *Đăng nhập thành công*, *Cảnh báo sai mật khẩu / OTP*, *Lượt mở phong thư*.
     - Bộ lọc theo tài khoản & loại sự kiện + nút **Làm mới** + nút **Xoá nhật ký**.
     - Bảng/danh sách nhật ký tiếng Việt hiển thị thời gian theo múi giờ Việt Nam (`HH:mm:ss dd/MM/yyyy`), tài khoản, huy hiệu hành động, chi tiết (ví dụ `"Xem ảnh: Buổi chiều mưa đầu tiên"`) và thiết bị (`iPhone · Safari`).


### 4.4 Bổ sung Hiệu ứng Tình yêu (`LoveEffectsLayer`) & Ngôn từ Sến súa ("Mushy Romantic Copy")
- **Thành phần `src/components/story/LoveEffectsLayer.tsx`:**
  - Lớp hiệu ứng lãng mạn nhẹ (pointer-events-none, `z-20` hoặc dưới modal `z-50`), hiển thị cánh hoa sakura & trái tim pastel bay lên dịu dàng ở mật độ tinh tế (`8–12` phần tử trên mobile, `14–18` trên desktop/tablet) để không che chữ hay gây giật lag.
  - Khi người dùng chạm / click nhẹ vào vùng nền trên `/` (hoặc chạm vào trái tim đếm ngày, dấu niêm phong phong thư), bung hiệu ứng **heart-burst** (4–6 trái tim nhỏ toả nhẹ rồi tan biến mượt).
  - Bắt buộc tôn trọng `@media (prefers-reduced-motion: reduce)` / hook `prefersReducedMotion`: khi reduced-motion bật, dừng chuyển động bay/rung liên tục và chỉ giữ tĩnh trang trí nhẹ.
- **Tăng cường hiệu ứng ở Hero, Timeline & Phong thư:**
  - `HeroSection`: Nhịp tim phát sáng dịu quanh badge đếm ngày bên nhau, shimmer lấp lánh nhẹ trên con số ngày, trái tim nhỏ vương quanh nút "Mở khóa miền ký ức" / "Bước vào khu vườn kỷ niệm của tụi mình".
  - `EnvelopeLetter`: Dấu niêm phong trái tim phát sáng lấp lánh nhẹ và hiệu ứng toả tim hồng khi nhấn mở thư; phong thư mở mượt với tông giấy ấm dịu.
- **Ngôn từ sến súa, ngọt ngào nhất quán (`seed-data.ts`, `ViewerPasscodeGate`, `PixelHeartIntro`, `HeroSection`, `MemoryTimeline`, `EnvelopeLetter`, `globals.css` / `layout.tsx` metadata):**
  - Toàn bộ lời chào, gợi ý đăng nhập, màn hình nhập OTP, lời dẫn màn trái tim pixel, tiêu đề & dòng mô tả seed mẫu, chú thích timeline và phong thư mẫu dùng giọng văn tình cảm sâu lắng, ngọt ngào, âu yếm ("anh thương em", "trái tim nhỏ bé", "từng nhịp thở ký ức", "mãi mãi chung một bầu trời"...).
  - Các câu thông báo lỗi xác thực và UI quản trị `/admin` vẫn giữ rõ ràng, mạch lạc, dễ thao tác.
