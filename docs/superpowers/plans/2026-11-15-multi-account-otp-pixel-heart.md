# Multi-Account Role Auth, 2-Step OTP, Pixel Heart Canvas, Traffic Monitoring & Mushy Love Effects Implementation Plan

> **For agentic workers:** REQUIRED: Use subagent-driven-development or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp website kỷ niệm tình yêu sang hệ thống tài khoản phân quyền (`admin` = chủ sở hữu vừa xem `/` vừa quản trị `/admin`; `viewer` = tài khoản riêng cho người thương chỉ xem `/`), đăng nhập 2 bước (`username` + `password` → `OTP 6 số`), màn giới thiệu `<canvas>` trái tim pixel ghép nối + đập nhịp, theo dõi lượng vào/ra & hành động chi tiết tại `/admin` (5 tabs), hiệu ứng tình yêu lãng mạn (`LoveEffectsLayer`), và toàn bộ ngôn từ sến súa, ngọt ngào nhất quán trên Desktop, Tablet và Mobile.

**Architecture:** Mở rộng Dual-Storage Repository (`LocalRepository` & `SupabaseRepository`) thêm bảng/mảng `app_users` và `activity_logs` cùng helper mã hoá `scrypt` + token HMAC phân tách rõ 3 loại phiên (`ny_admin_session`, `ny_viewer_step1`, `ny_viewer_unlocked`) kèm `sessionVersion` và `isActive` kiểm tra trực tiếp trên server để hỗ trợ đá phiên tức thì. Toàn bộ hành vi mở trang, đăng nhập, OTP, trái tim pixel, nhạc, xem ảnh, mở thư và rời trang (`sendBeacon`) được ghi log theo múi giờ `Asia/Ho_Chi_Minh` (chống spam khách chưa đăng nhập bằng cookie HMAC `ny_guest_cooldown`), hiển thị trực quan trong 2 tab mới của `/admin`.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind CSS, Framer Motion, HTML5 Canvas 2D (`PixelHeartIntro`), Web Crypto (`scrypt` + HMAC-SHA256), Supabase (`pgcrypto` + RLS), Vitest + Testing Library + jsdom.

**Spec:** [`docs/superpowers/specs/2026-11-15-viewer-otp-pixel-heart-design.md`](../specs/2026-11-15-viewer-otp-pixel-heart-design.md)

**Global Constraints:**
- Ngôn ngữ toàn bộ UI công khai, auth `/` và seed dữ liệu: **Tiếng Việt sến súa, ngọt ngào, âu yếm**. Riêng thông báo lỗi và UI `/admin` giữ rõ ràng, mạch lạc, dễ thao tác.
- Không gọi `next/font/google` (giữ `@fontsource` đã cấu hình trong `src/app/layout.tsx`).
- Bảo vệ môi trường production (`NODE_ENV === 'production'`): bắt buộc có `ADMIN_PASSWORD` khi seed `admin` lần đầu vào DB rỗng; tài khoản mẫu `nguoithuong` mặc định `isActive: true` ở dev và `isActive: false` ở production.
- Tôn trọng `prefers-reduced-motion` cho mọi hiệu ứng (`PixelHeartIntro`, `LoveEffectsLayer`, `EnvelopeLetter`, `HeroSection`).
- Next.js 15 App Router route handlers nhận `(request: Request)` bắt buộc (không dùng `request?: Request`).

**Review Focus (Across Tasks):**
1. Không rò rỉ `passwordHash`, `otpHash`, hay OTP thật ra public/SSR props hoặc JSON response `/api/*`.
2. Kiểm tra `sessionVersion` + `isActive` đối với cả `ny_admin_session` lẫn `ny_viewer_step1` / `ny_viewer_unlocked` để Admin khoá hoặc đá phiên có tác dụng ngay lập tức.
3. Khách chưa đăng nhập (`khach`) chỉ ghi `page_visit`/`page_leave` khi bị khoá (được throttle bằng HttpOnly HMAC `ny_guest_cooldown` 600s); từ chối `401` đối với các event tương tác nội dung (`pixel_heart_viewed`, `memory_viewed`, `letter_opened`, `music_toggled`) khi trang đang khoá và chưa mở khoá.
4. Giữ an toàn bảo mật: không tự ý xoá hoặc hạ quyền Admin cuối cùng; client `/api/activity` không thể tự giả mạo event auth (`login_step1_ok`, `otp_verified`, `login_failed`, `otp_failed`, `logout`).
5. Không tạo tràn ngang trên Mobile (`375px`), Tablet (`768px`), Desktop (`1440px`).

---

### Task 1: Data Types, Auth Tokens & Scrypt OTP, Validation, Seed Migration & Dual Repositories

**Files:**
- Modify: `src/types/memories.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/lib/validation.ts`
- Modify: `src/lib/seed-data.ts`
- Modify: `src/lib/storage/types.ts`
- Modify: `src/lib/storage/local-repository.ts`
- Modify: `src/lib/storage/supabase-repository.ts`
- Modify: `supabase/schema.sql`
- Modify: `tests/auth-and-validation.test.ts`
- Modify: `tests/local-repository.test.ts`

**Objectives & Contracts:**
- [ ] Cập nhật `src/types/memories.ts`:
  - `UserRole = 'admin' | 'viewer'`, `ActivityActorRole = UserRole | 'guest'`.
  - `AppUser` (server internal: `id`, `username`, `displayName`, `role`, `passwordHash`, `otpHash`, `otpHint`, `isActive`, `sessionVersion`, `lastLoginAt`, `createdAt`, `updatedAt`).
  - `SafeAppUser` (UI/Admin DTO bỏ `passwordHash` và `otpHash`, kèm `hasPassword: boolean`, `hasOtp: boolean`).
  - `ActivityEventType = 'page_visit' | 'page_leave' | 'login_step1_ok' | 'login_failed' | 'otp_verified' | 'otp_failed' | 'pixel_heart_viewed' | 'music_toggled' | 'memory_viewed' | 'letter_opened' | 'logout'`.
  - `ActivityLogItem`: `id`, `userId`, `username`, `userRole`, `eventType`, `detail`, `deviceSummary`, `metadata`, `createdAt`.
  - `TrafficSummary`: tổng lượt ghé trang hôm nay (theo giờ VN), lượt mở khoá thành công hôm nay, cảnh báo đăng nhập/OTP sai hôm nay, số tài khoản đang hoạt động.
  - Cập nhật `PublicSiteSettings`, `AdminSiteSettings` (thêm `showDevDefaultHints` hoặc cờ tương đương cho UI), `AdminSiteData` (thêm `users: SafeAppUser[]`, `activityLogs: ActivityLogItem[]`, `currentUser: SafeAppUser | null`, `trafficSummary: TrafficSummary`).
- [ ] Cập nhật `src/lib/auth.ts`:
  - Định nghĩa cookie names: `ADMIN_COOKIE_NAME = 'ny_admin_session'`, `VIEWER_STEP1_COOKIE_NAME = 'ny_viewer_step1'`, `VIEWER_UNLOCKED_COOKIE_NAME = 'ny_viewer_unlocked'`, `GUEST_COOLDOWN_COOKIE_NAME = 'ny_guest_cooldown'`.
  - Giữ `hashPasscode` & `verifyPasscode` (scrypt + random salt + `timingSafeEqual`) dùng chung cho cả password & OTP 6 số.
  - Hàm `signSessionPayload` & `verifySessionPayload` gắn `typ` rõ ràng (`'admin' | 'viewer_step1' | 'viewer_unlocked' | 'guest_cooldown'`), tránh token confusion giữa các stage. Giữ alias `signToken`/`verifyToken` nếu cần tương thích test nội bộ hoặc nâng cấp test song hành.
  - Helper kiểm tra DB: `resolveAdminSession(repository)` (verify HMAC + lookup user trong DB + kiểm tra `role === 'admin' && isActive && sessionVersion === payload.ver`), `resolveViewerSession(repository)` (trả về `{ stage: 'unlocked' | 'otp_pending' | 'login_required'; user: SafeAppUser | null; otpHint?: string }`, trong đó khi kiểm tra DB nếu user bị khoá/revoke hoặc đổi role khỏi active thì cookie tự vô hiệu).
  - Helper `summarizeUserAgent(userAgent: string | null): string` (rút gọn an toàn: trình duyệt + hệ điều hành, ví dụ `Safari · iPhone`, `Chrome · macOS`).
  - Helper `clearViewerCookiesOnResponse` / `setCookieOnResponse` giúp route handlers thao tác đồng bộ.
- [ ] Cập nhật `src/lib/validation.ts`:
  - `validateUserLoginPayload` (`username` lowercase `[a-z0-9._-]{3,32}`, `password` min 4 max 128).
  - `validateOtpVerifyPayload` (`otp`: đúng 6 chữ số `/^\d{6}$/`).
  - `validateCreateUserPayload` & `validateUpdateUserPayload` (cho phép tạo/sửa `displayName`, `role`, `password?`, `otpCode?` 6 số, `otpHint`, `isActive`, `revokeSession?`).
  - `validateClientActivityPayload`: chỉ nhận các client events hợp lệ (`page_visit`, `page_leave`, `pixel_heart_viewed`, `music_toggled`, `memory_viewed`, `letter_opened`), cắt độ dài `detail` <= 160 ký tự, lọc `metadata` chỉ giữ primitive (`string | number | boolean`).
  - Giữ các validation upload, memory, settings hiện hữu (vẫn kiểm tra chặt HTTPS/local URL & upload allowlist).
- [ ] Cập nhật `src/lib/seed-data.ts`:
  - `LocalDbSchema` có `users: AppUser[]`, `activityLogs: ActivityLogItem[]`.
  - Viết lại toàn bộ lời văn seed (`coupleTitle`, `heroSubtitle`, `memories` giữ nguyên 4 mốc ảnh mẫu local nhưng viết caption & tiêu đề thật sến súa, tình cảm; `letterTitle`, `letterBody`, `letterSignature`) theo đúng phong cách ngọt ngào, âu yếm.
  - Seed mặc định `settings.viewerPasscodeEnabled: true`.
  - Helper tạo cặp user mặc định (`buildDefaultUsers()`):
    - `admin`: `role: 'admin'`, `displayName: 'Anh · Chủ vườn ký ức'`, password lấy từ `process.env.ADMIN_PASSWORD` (dev mặc định `'love2026'`; nếu `NODE_ENV === 'production'` mà DB rỗng thiếu `ADMIN_PASSWORD` thì throw rõ ràng), `otpCode`: `process.env.ADMIN_DEFAULT_OTP || '140226'`, `otpHint: 'Ngày lễ tình nhân ngọt ngào của tụi mình (14/02/26)'`, `isActive: true`, `sessionVersion: 1`.
    - `nguoithuong`: `role: 'viewer'`, `displayName: 'Em bé thương yêu'`, password `'love2026'`, `otpCode: '121024'`, `otpHint: 'Ngày đầu tiên mình nắm tay nhau (12/10/24)'`, `isActive: process.env.NODE_ENV !== 'production'`, `sessionVersion: 1`.
  - Helper `sanitizeUserForClient(user: AppUser): SafeAppUser`.
  - Logic nâng cấp `local-db.json` cũ chưa có `users`: seed `admin` + `nguoithuong` và **bật một lần** `viewerPasscodeEnabled = true`; nếu `users` đã tồn tại, luôn tôn trọng giá trị `viewerPasscodeEnabled` đã lưu.
- [ ] Mở rộng `StorageRepository`, `LocalRepository`, `SupabaseRepository`, và `supabase/schema.sql`:
  - Thêm CRUD user (`listUsers`, `getUserByUsername`, `getUserById`, `createUser`, `updateUser`, `deleteUser` — chặn xoá/hạ quyền/khoá Admin active cuối cùng), và `recordActivity` / `listActivityLogs`.
  - Trên `LocalRepository`, giữ lưu nguyên tử (`writeDb`), giới hạn `activityLogs` tối đa `500` bản ghi gần nhất để JSON nhẹ mượt.
  - Trên `SupabaseRepository`, cập nhật `ensureInitializedAndFetch()` bootstrap thêm `app_users` khi rỗng (`onConflict: 'username', ignoreDuplicates: true`), triển khai queries trên bảng `app_users` & `activity_logs`, cập nhật `supabase/schema.sql` với RLS bật chặt cho cả 2 bảng mới.
- [ ] TDD: Viết & mở rộng unit tests trong `tests/auth-and-validation.test.ts` và `tests/local-repository.test.ts` cho token stage confusion, OTP hash/verify, `sessionVersion` revocation, migration `local-db.json` cũ một lần, guard Admin cuối cùng, và `recordActivity` pruning/filtering. Chạy `npm test -- tests/auth-and-validation.test.ts tests/local-repository.test.ts` & `npm run typecheck`.

---

### Task 2: Auth API Routes, Admin Users API, Activity Tracking API & SSR Session Resolution

**Files:**
- Create: `src/app/api/viewer/login/route.ts`
- Create: `src/app/api/viewer/verify-otp/route.ts`
- Create: `src/app/api/viewer/logout/route.ts`
- Create: `src/app/api/activity/route.ts`
- Create: `src/app/api/admin/users/route.ts`
- Create: `src/app/api/admin/users/[id]/route.ts`
- Create: `src/app/api/admin/activity/route.ts`
- Delete/Replace: `src/app/api/viewer/unlock/route.ts` (hoặc giữ 410 / chuyển hoàn toàn sang 2-step `/api/viewer/login` + `/api/viewer/verify-otp`)
- Modify: `src/app/api/admin/login/route.ts`
- Modify: `src/app/api/admin/logout/route.ts`
- Modify: `src/app/api/admin/settings/route.ts`
- Modify: `src/app/api/admin/memories/route.ts`
- Modify: `src/app/api/admin/memories/[id]/route.ts`
- Modify: `src/app/api/admin/memories/reorder/route.ts`
- Modify: `src/app/api/admin/upload/route.ts`
- Modify: `src/app/api/admin/upload-url/route.ts`
- Modify: `src/lib/admin-guard.ts` (khuyến nghị tách helper `requireAdminApiSession()` kiểm tra DB + `sessionVersion` + `isActive` dùng chung cho mọi route `/api/admin/*`)
- Modify: `src/app/admin/login/page.tsx`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `tests/api-routes.test.ts`

**Objectives & Contracts:**
- [ ] Tạo `requireAdminApiSession(repository)` dùng chung trên tất cả 9 route `/api/admin/*` (trừ login/logout): xác thực `ny_admin_session`, đối chiếu DB user còn `role === 'admin' && isActive && sessionVersion === token.ver`, trả về `401` ngay khi bị thu hồi phiên hoặc bị khoá.
- [ ] Cập nhật `POST /api/admin/login`:
  - Nhận `{ username, password }` (`username` nếu client cũ không gửi có thể fallback `'admin'` trong schema validate hoặc bắt buộc trên UI `/admin/login`).
  - Đối chiếu `app_users` (user có `role === 'admin'` và `isActive === true`, xác thực `passwordHash`).
  - Ghi log `login_step1_ok` (hoặc `login_failed` khi sai/tài khoản bị khoá).
  - Cấp `ny_admin_session` (24h).
- [ ] Tạo `POST /api/viewer/login` (Bước 1 tại `/`):
  - Nhận `{ username, password }`.
  - Nếu tìm thấy user `isActive` và đúng password: ghi log `login_step1_ok`, cấp HttpOnly `ny_viewer_step1` (10 phút), trả về `{ ok: true, step: 'otp_required', otpHint: user.otpHint, user: SafeAppUser }`.
  - Nếu sai password hoặc tài khoản bị khoá (`!isActive`): ghi log `login_failed` (`detail` ghi rõ sai mật khẩu hoặc tài khoản đang bị tạm khoá), trả về `401` (hoặc `403` cho tài khoản bị khoá với thông báo Tiếng Việt dịu dàng).
- [ ] Tạo `POST /api/viewer/verify-otp` (Bước 2 tại `/`):
  - Bắt buộc có `ny_viewer_step1` hợp lệ + đối chiếu DB user còn `isActive` + `sessionVersion` khớp.
  - Kiểm tra mã 6 số `otp` qua `verifyPasscode(otp, user.otpHash)`.
  - Nếu đúng: ghi log `otp_verified`, xoá `ny_viewer_step1` và `ny_guest_cooldown`, cấp `ny_viewer_unlocked` (7 ngày), trả về `{ ok: true, user: SafeAppUser }`.
  - Nếu sai: ghi log `otp_failed`, trả về `401` `"Mã OTP chưa khớp mất rồi, bạn nhỏ kiểm tra gợi ý lại nhé"`.
- [ ] Tạo `POST /api/viewer/logout`: ghi log `logout` (nếu có session hợp lệ), xoá `ny_viewer_step1` và `ny_viewer_unlocked`. (Tương tự `POST /api/admin/logout` ghi log `logout` nếu có admin session rồi xoá `ny_admin_session`).
- [ ] Tạo `POST /api/activity`:
  - Parse `validateClientActivityPayload` (`page_visit`, `page_leave`, `pixel_heart_viewed`, `music_toggled`, `memory_viewed`, `letter_opened`).
  - Kiểm tra trạng thái trang (`getPublicData().settings.viewerPasscodeEnabled`) & cookie `ny_viewer_unlocked` (đối chiếu DB user `isActive && sessionVersion`).
  - Nếu có session `viewer_unlocked` hợp lệ: ghi log gắn `userId`, `username`, `userRole` của người dùng đó.
  - Nếu KHÔNG có `viewer_unlocked`:
    - Với các event tương tác nội dung (`pixel_heart_viewed`, `music_toggled`, `memory_viewed`, `letter_opened`): nếu `viewerPasscodeEnabled === true` -> trả về `401`.
    - Với `page_visit` / `page_leave`: kiểm tra cookie HMAC `ny_guest_cooldown` (600s) để chống spam; chỉ ghi tối đa 1 `page_visit` và 1 `page_leave` per cooldown window với `username: 'khach'`, `userRole: 'guest'`, và set/cập nhật HttpOnly `ny_guest_cooldown`.
- [ ] Tạo `/api/admin/users` (`GET`, `POST`) & `/api/admin/users/[id]` (`PATCH`, `DELETE`):
  - `PATCH` hỗ trợ: cập nhật `displayName`, `role`, `otpHint`, `isActive`, đổi `password`, đổi `otpCode` (6 số), hoặc `revokeSession: true` (tăng `sessionVersion`).
  - Ngăn chặn: tự khoá/xoá tài khoản đang thao tác hoặc làm mất tài khoản `admin` active cuối cùng (`400`).
  - `GET /api/admin/activity`: hỗ trợ query `eventType`, `username`, `search`, `limit` + trả về `trafficSummary`.
- [ ] Cập nhật `src/app/page.tsx`: dùng `resolveViewerSession(repository)` để xác định truyền xuống `ViewerPasscodeGate` (kèm `initialStep`, `otpHint`, `viewerPasscodeEnabled`, `devDefaultHints` khi `NODE_ENV !== 'production'`) hoặc `StoryExperience` (kèm `currentUser`, `showPixelHeartIntro`).
- [ ] Cập nhật `src/app/admin/page.tsx` & `src/app/admin/login/page.tsx`: dùng `resolveAdminSession(repository)` để bảo vệ trang quản trị; truyền `currentUser` xuống `AdminDashboard` và hiển thị trường nhập tài khoản + gợi ý dev trên `AdminLoginForm`.
- [ ] TDD: Cập nhật & mở rộng `tests/api-routes.test.ts` kiểm tra đủ: login step 1 + step 2 OTP, guest cooldown `page_visit` & `page_leave`, chặn `401` cho interactive events khi chưa mở khoá, `sessionVersion` revocation & user lock, không cho xoá/khoá Admin cuối cùng, không lộ `passwordHash`/`otpHash`.

---

### Task 3: Frontend `/` Auth Gate, Pixel Heart `<canvas>`, Love Effects Layer & Mushy Romantic Story UI

**Files:**
- Modify: `src/components/story/ViewerPasscodeGate.tsx`
- Create: `src/components/story/PixelHeartIntro.tsx`
- Create: `src/components/story/LoveEffectsLayer.tsx`
- Modify: `src/components/story/StoryExperience.tsx`
- Modify: `src/components/story/HeroSection.tsx`
- Modify: `src/components/story/MemoryTimeline.tsx`
- Modify: `src/components/story/PhotoLightbox.tsx`
- Modify: `src/components/story/EnvelopeLetter.tsx`
- Modify: `src/components/story/AudioToggle.tsx`
- Modify: `src/app/globals.css`
- Modify: `src/app/layout.tsx`
- Modify: `tests/story-components.test.tsx`

**Objectives & Contracts:**
- [ ] Viết lại `ViewerPasscodeGate.tsx` (kính mờ pastel trắng tinh khôi, từ ngữ sến súa âu yếm):
  - **Bước 1 (`credentials`):** Nhập `Tài khoản` (`username`) + `Mật khẩu yêu thương` (`password`). Ở dev (`showDevDefaultHints = true`), hiện pill gợi ý nhanh cho `nguoithuong` (`love2026` / OTP `121024`) và `admin` (`love2026` / OTP `140226`). Không hiện ở production.
  - **Bước 2 (`otp`):** Hiện lời nhắn ngọt ngào + pill gợi ý `otpHint` của tài khoản, kèm **6 ô nhập số OTP rời** (`inputMode="numeric"`, `maxLength={1}`, hỗ trợ auto-focus tiến/lùi, `Backspace`, và `onPaste` 6 chữ số), nút **"Quay lại bước 1"** và nút **"Xác nhận bước vào tim nhau"**.
  - **Bước 3 (`pixel_heart`):** Sau khi OTP đúng, chuyển sang `<PixelHeartIntro />` ngay trước khi vào `StoryExperience` (hoặc khi người dùng vừa xác thực xong / chọn nút xem lại trái tim). Đồng thời gọi `router.refresh()` sau khi bấm nút vào hành trình để SSR load dữ liệu chính thức an toàn!
- [ ] Xây dựng `src/components/story/PixelHeartIntro.tsx`:
  - Dùng HTML5 `<canvas>` 2D với `devicePixelRatio` scaling sắc nét, tự tính kích thước responsive (`220px–260px` trên Mobile 375px, `300px–340px` trên Tablet/Desktop) từ ma trận pixel trái tim chuẩn (`~21×19` ô vuông bo góc pastel hồng–đào–lavender: `#fb7185`, `#f472b6`, `#f9a8d4`, `#fda4af`, `#c4b5fd`).
  - Animation 60fps gồm 3 pha mượt:
    1. Hạt pixel phân tán xoay/tụ nhẹ từ ngoài vào đúng vị trí tạo hình trái tim (~1.2s easeOut).
    2. Tim đập nhịp (`pulse` nhẹ nhàng) + vài pixel lấp lánh phát sáng.
    3. Tôn trọng `prefers-reduced-motion`: vẽ ngay trái tim hoàn chỉnh sắc nét không nhấp nháy.
  - Hiện lời dẫn sến súa ("Nhịp tim này đang ghép từng mảnh ký ức chỉ để đợi em bước vào..."), badge chào tên `displayName`, và nút CTA phát sáng **"Mở khóa miền ký ức của tụi mình"** (bấm để gửi `pixel_heart_viewed` và vào `StoryExperience`).
- [ ] Xây dựng `src/components/story/LoveEffectsLayer.tsx`:
  - Render cánh hoa / trái tim nhỏ pastel rơi/bay dịu (`pointer-events-none`, tắt khi `prefers-reduced-motion`).
  - Lắng nghe click/tap nhẹ trên viewport hoặc callback burst khi chạm vùng trang trí -> tạo `4–6` trái tim nhỏ nở nhẹ rồi mờ dần.
- [ ] Tích hợp vào `StoryExperience.tsx` & cập nhật ngôn từ sến súa + client activity telemetry:
  - Thanh topbar kính mờ gọn nhẹ hiển thị lời chào theo vai trò (`currentUser`: *"Chào anh quản trị · Xem như người thương"* kèm link nhanh `/admin`, hoặc *"Gửi em bé thương yêu"*) + nút **Đăng xuất** gọn đẹp trên Mobile/Tablet/Desktop (hợp lý cùng `AudioToggle` không bị chồng lấn!).
  - Tích hợp tracking an toàn:
    - Khi mount ở `/` (kể cả khi đang ở `ViewerPasscodeGate` lẫn `StoryExperience`): dùng `sessionStorage` theo key phân biệt (`ny_visit_logged:guest` khi chưa login, `ny_visit_logged:${userId}` khi đã login) để gửi `page_visit` một lần mỗi phiên trình duyệt, và gắn listener `pagehide` / `visibilitychange (hidden)` gọi `navigator.sendBeacon('/api/activity', Blob application/json)` ghi `page_leave`.
    - Ghi `music_toggled`, `memory_viewed` (gửi kèm `{ memoryId, title }` khi mở Lightbox), `letter_opened` (khi mở phong thư) bằng `fetch(..., { keepalive: true })` không làm khựng UI.
  - Nâng cấp `HeroSection.tsx`, `MemoryTimeline.tsx`, `PhotoLightbox.tsx`, `EnvelopeLetter.tsx`, `AudioToggle.tsx`: bổ sung hiệu ứng tim lấp lánh quanh badge số ngày bên nhau, dấu niêm phong tim phát sáng & toả tim khi mở thư, ngôn từ sến súa đồng bộ toàn trang.
- [ ] TDD: Cập nhật `tests/story-components.test.tsx` kiểm tra `ViewerPasscodeGate` (2 bước + paste 6 số OTP + chuyển sang `PixelHeartIntro`), `PixelHeartIntro` (canvas & CTA), `LoveEffectsLayer`, `StoryExperience` (tracking `memory_viewed`, `letter_opened`, badge vai trò + link `/admin` cho `admin`), và `prefers-reduced-motion`.

---

### Task 4: Admin Login Upgrade, 5-Tab `/admin` Dashboard (Users & Traffic/Activity Logs) & README

**Files:**
- Modify: `src/components/admin/AdminLoginForm.tsx`
- Modify: `src/components/admin/AdminDashboard.tsx`
- Modify: `README.md` (cập nhật hướng dẫn 2 tài khoản, OTP 6 số, kiểm soát vào/ra và schema Supabase mới)

**Objectives & Contracts:**
- [ ] Cập nhật `AdminLoginForm.tsx`: thêm ô `Tài khoản quản trị` (`username`, mặc định `'admin'`) cùng ô `Mật khẩu`; giữ nguyên gợi ý local dev khi `showDevDefaultHint = true`.
- [ ] Mở rộng `AdminDashboard.tsx` từ 3 tab thành **5 tab** responsive (cuộn ngang mượt hoặc wrap gọn trên Mobile 375px không tràn màn hình):
  1. `Kỷ niệm & Ảnh` (giữ nguyên đầy đủ chức năng upload, sửa, xoá, sắp xếp)
  2. `Mở đầu, Nhạc nền & Riêng tư` (giữ chỉnh sửa mở đầu, ngày bắt đầu, nhạc nền; thay phần PIN cũ thành công tắc bật/tắt khoá đăng nhập 2 bước toàn trang + giải thích liên kết sang tab Tài khoản)
  3. `Phong thư tâm sự` (giữ chỉnh sửa & xem trước trực tiếp)
  4. `Tài khoản & Kiểm soát truy cập`:
     - Bảng/Card danh sách tài khoản (`username`, `displayName`, `role`, trạng thái `Đang hoạt động` / `Đã khoá`, lần đăng nhập cuối, trạng thái có Password & OTP, `otpHint`).
     - Form **Tạo tài khoản mới** (chọn vai trò `admin` / `viewer`, nhập password & OTP 6 số + gợi ý OTP).
     - Thao tác trên từng tài khoản: **Sửa thông tin / Đổi mật khẩu / Đổi OTP 6 số & gợi ý**, nút **Khoá / Mở khoá**, nút **Đăng xuất từ xa (Thu hồi phiên)** (`revokeSession: true`), nút **Xoá** (chặn nút/hiển thị cảnh báo nếu là tài khoản đang dùng hoặc Admin active cuối cùng).
  5. `Nhật ký ra vào & Hành động`:
     - 4 thẻ thống kê nhanh (`Lượt ghé trang hôm nay`, `Đã qua bước OTP`, `Cảnh báo sai mật khẩu / OTP`, `Tài khoản hoạt động`).
     - Bộ lọc theo `Loại sự kiện`, `Tài khoản` (`tat-ca`, `khach`, từng username), từ khoá tìm kiếm, và nút **Làm mới dữ liệu** gọi `GET /api/admin/activity`.
     - Bảng/danh sách timeline nhật ký hiển thị rõ thời gian theo múi giờ Việt Nam (`Asia/Ho_Chi_Minh`), tài khoản & vai trò badge (`Admin`, `Người thương`, `Khách`), icon & nhãn sự kiện Tiếng Việt dễ hiểu, mô tả hành động (`detail`), và `deviceSummary` (`Safari · iPhone`).
- [ ] Đảm bảo Mobile 375px & Tablet 768px không bị tràn ngang khi bảng log hoặc danh sách tài khoản hiển thị (dùng card layout trên Mobile / overflow-x-auto an toàn).
- [ ] Kiểm tra `npm run typecheck && npm test && npm run build`.
