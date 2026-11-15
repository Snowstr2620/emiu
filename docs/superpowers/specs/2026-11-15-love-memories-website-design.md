# Thiết Kế Dự Án: Website Kỷ Niệm Tình Yêu & Tâm Thư Trực Tuyến

- **Ngày lập:** 2026-11-15
- **Quy mô:** Dự án hoàn chỉnh (Full Web Project — Giao diện kể chuyện tương tác + Trang quản trị trực tuyến & Lưu trữ đám mây)
- **Thư mục dự án:** `/Users/scott/Documents/NY`

---

## 1. Mục Đích & Ý Nghĩa (Intent & Why)

Xây dựng một website hiện đại, tông màu sáng, đóng vai trò như món quà tinh thần để bày tỏ tình cảm sâu sắc với người thương đang bên cạnh. Khi mở trang, người thương được dẫn dắt qua dòng thời gian nhìn lại những bức ảnh kỷ niệm cũ kèm câu chuyện nhỏ của hai người, cảm nhận chặng đường đã đi cùng nhau, và khép lại bằng khoảnh khắc chạm mở một phong thư tâm sự chân thành ở cuối trang.

Đồng thời, chủ nhân trang web có thể đăng nhập vào trang quản trị riêng (`/admin`) để tải thêm ảnh kỷ niệm mới, chỉnh sửa câu chuyện hoặc cập nhật lời tâm thư trực tuyến bất cứ lúc nào mà không cần can thiệp vào mã nguồn.

---

## 2. Mục Tiêu, Ngoài Phạm Vi & Điều Cần Tránh

### Mục tiêu (Goals)
1. **Dẫn dắt cảm xúc trọn vẹn qua 3 phần trên trang chính (`/`):**
   - **Mở đầu (Hero):** Tên hai người, lời dẫn dịu dàng, bộ đếm số ngày bên nhau tự động từ ngày bắt đầu yêu, và nút bật/tắt nhạc nền dịu nhẹ.
   - **Dòng thời gian kỷ niệm (Memory Timeline):** Cuộn dọc mượt mà qua các mốc kỷ niệm theo thứ tự thời gian; mỗi mốc hiển thị ảnh, ngày tháng, tiêu đề ngắn và vài dòng chuyện kể; chạm vào ảnh mở chế độ xem phóng to rõ nét (lightbox).
   - **Kết trang (Phong thư tâm sự):** Phong thư niêm phong tương tác ở cuối hành trình — chạm vào để mở nắp phong bì và đọc trọn vẹn bức tâm thư.
2. **Thẩm mỹ đúng phong cách đã chọn (`B · Trắng Tinh Khôi & Kính Mờ Pastel`):** Tông nền sáng trong trẻo pha ánh hồng phấn – lam sương mờ, thẻ kính mờ (glassmorphism) tinh tế, tối giản, hiện đại.
3. **Ưu tiên trải nghiệm điện thoại (Mobile-First):** Hiển thị mượt mà, cân đối trên màn hình điện thoại (nơi người thương thường mở link từ tin nhắn) và tự động dàn trang thoáng đẹp trên máy tính.
4. **Quản trị trực tuyến dễ dùng (`/admin`):** Bảo vệ bằng mật khẩu quản trị; cho phép tải ảnh mới, thêm/sửa/xoá/sắp xếp các mốc kỷ niệm, đổi nhạc nền, cập nhật ngày yêu và sửa bức tâm thư trực tiếp trên trình duyệt.
5. **Chạy thử ngay trên máy & Sẵn sàng lên mây:** Vừa tích hợp lưu trữ đám mây chuẩn để chạy trực tuyến lâu dài, vừa có chế độ lưu cục bộ tự động khi chưa điền khóa đám mây để kiểm thử/xem ngay lập tức trên máy.

### Ngoài phạm vi (Non-Goals)
- Không làm mạng xã hội nhiều tài khoản người dùng (chỉ phục vụ riêng một cặp đôi với một quyền quản trị duy nhất).
- Không làm tính năng bình luận công khai, thả tim đa người dùng, hay chat thời gian thực.
- Không tích hợp bộ công cụ cắt ghép/chỉnh màu ảnh chuyên sâu trên trình duyệt (chỉ kiểm tra định dạng, nén nhẹ/hiển thị chuẩn tỷ lệ).

### Điều cần tránh (Anti-Goals — Làm đúng kỹ thuật nhưng vẫn hỏng trải nghiệm)
- **Không sến hoặc rối mắt:** Tránh tông hồng/đỏ chói gắt, tránh mưa tim rơi dày đặc che khuất ảnh kỷ niệm hoặc gây giật lag trên điện thoại.
- **Không tự phát nhạc gây giật mình:** Không ép phát âm thanh lớn ngay khi chưa có tương tác; nhạc nền chỉ phát êm ái khi người xem bấm nút "Bắt đầu hành trình" hoặc chủ động bật biểu tượng âm nhạc ở góc trang.
- **Không để lộ quyền chỉnh sửa:** Người xem ở trang chính tuyệt đối không thấy các nút sửa/xoá lộn xộn; toàn bộ thao tác quản trị tách biệt hoàn toàn tại `/admin` sau lớp mật khẩu.
- **Không làm vỡ bố cục với ảnh dọc/ngang khác nhau:** Ảnh kỷ niệm thực tế trên điện thoại có cả ảnh dọc (9:16, 3:4) lẫn ảnh ngang (4:3, 16:9); khung hiển thị và chế độ phóng to (lightbox) phải tôn trọng tỷ lệ ảnh gốc, không cắt mất mặt người.

---

## 3. Ràng Buộc (Constraints)

- **Ngôn ngữ hiển thị:** Tiếng Việt hoàn toàn trên giao diện người xem và giao diện quản trị `/admin`; bộ font bắt buộc hỗ trợ đầy đủ dấu tiếng Việt sắc nét.
- **Môi trường máy hiện tại:** macOS, Node.js `v26.7.0`, npm `11.19.0`, Git `2.54.0`; thư mục `/Users/scott/Documents/NY` khởi tạo mới hoàn toàn.
- **Hiệu năng mạng di động:** Ảnh trên timeline cần tải lười (`lazy loading`) và tối ưu hiển thị để trang mở nhanh ngay cả khi xem bằng 4G.

---

## 4. Các Hướng Tiếp Cận Đã Cân Nhắc (Approaches)

1. **Hướng 1 — Web tĩnh gọn nhẹ + 1 file dữ liệu tập trung (`HTML/CSS/JS` + `data/memories.js`):**
   - *Đánh đổi:* Tải cực nhanh, triển khai miễn phí đơn giản nhất, nhưng mỗi lần thêm ảnh hay sửa lời tâm sự phải chép file vào mã nguồn và đẩy lại trang.
2. **Hướng 2 — Web ứng dụng (`React + Vite`) kèm chế độ tự chỉnh sửa & xuất gói tĩnh trên trình duyệt:**
   - *Đánh đổi:* Có giao diện bấm chọn nhưng vẫn phải xuất file và đăng lại thủ công khi cập nhật, dễ phình dung lượng gói trang.
3. **Hướng 3 *(Người dùng đã chọn)* — Web có lưu trữ đám mây & trang quản trị trực tuyến (`Next.js + Cloud Database/Storage`):**
   - *Lý do chọn & Đánh đổi:* Chấp nhận cấu hình hệ thống đầy đủ hơn ban đầu để đổi lấy sự tiện lợi lâu dài: có trang `/admin` đặt mật khẩu riêng, tải ảnh mới và chỉnh sửa lời tâm sự trực tuyến bất cứ lúc nào trên điện thoại hoặc máy tính mà người thương mở link thấy ngay bản mới nhất.

---

## 5. Các Quyết Định Thiết Kế Đã Chốt

### 5.1. Phần do người dùng quyết định
- **Câu chuyện & Mạch cảm xúc:** Hướng *Tâm thư cho người đang bên cạnh* với bố cục 3 phần tuần tự: Mở đầu (tên hai người + đếm ngày yêu + nút nhạc nền) → Dòng thời gian ảnh kỷ niệm cũ (ảnh + ngày tháng + câu chuyện nhỏ + chạm phóng to) → Phong thư tâm sự mở ra ở cuối trang.
- **Phong cách thị giác:** Phương án **B · Trắng Tinh Khôi & Kính Mờ Pastel (`b-airy-minimal`)** — nền sáng trong trẻo pha ánh hồng – lam sương mờ, hiệu ứng thẻ kính mờ (glassmorphism) hiện đại, trẻ trung, tối giản.
- **Thiết bị ưu tiên:** Mobile-first (ưu tiên điện thoại trước, đồng thời hiển thị đẹp trên máy tính).
- **Kiến trúc vận hành:** Hướng 3 — Có cơ sở dữ liệu & kho lưu trữ ảnh trên đám mây kèm trang quản trị trực tuyến bảo vệ bằng mật khẩu.

### 5.2. Đề xuất kỹ thuật do Builder quyết định (Builder's Calls)

1. **Nền tảng ứng dụng (`Builder's Call`):**
   - Sử dụng **Next.js (App Router) + TypeScript + Tailwind CSS + Framer Motion + Lucide Icons**.
   - Lý do: Kết hợp gọn cả giao diện chuyển động mượt lẫn hệ thống API Routes / Server Actions xử lý đăng nhập `/admin`, tải ảnh, lưu dữ liệu trong cùng một dự án duy nhất, triển khai một chạm lên Vercel.

2. **Dịch vụ đám mây & Chế độ chạy cục bộ hai lớp (`Builder's Call`):**
   - **Chế độ Đám mây (Production Cloud): Supabase** (dùng **Supabase Postgres** lưu thông tin chung, danh sách kỷ niệm, bức tâm thư và **Supabase Storage** bucket chỉ mở quyền đọc công khai `SELECT` cho URL ảnh/nhạc, tuyệt đối không mở quyền ghi công khai — mọi lượt tải file lên đều phải xin **Signed Upload URL** một lần từ API `/api/admin/upload-url` đã xác thực phiên quản trị bằng `SUPABASE_SERVICE_ROLE_KEY`). Đi kèm file `supabase/schema.sql` (cấu hình sẵn bảng, chính sách truy cập, giới hạn dung lượng bucket `15MB` và danh sách MIME hợp lệ) cùng hướng dẫn `.env.example` rõ ràng.
   - **Chế độ Cục bộ tự động (Local Fallback Mode):** Khi biến môi trường `NEXT_PUBLIC_SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` chưa được cấu hình, tầng lưu trữ (`StorageRepository`) tự động chuyển sang đọc/ghi tại `data/local-db.json` và tải file trực tiếp qua `/api/admin/upload` vào `public/uploads/`, được khởi tạo sẵn bộ dữ liệu mẫu tinh tế. Nhờ đó toàn bộ tính năng xem trang chính và đăng nhập `/admin` tải ảnh/sửa thư hoạt động trơn tru ngay trên máy từ giây đầu tiên, không bị chặn bởi bước tạo tài khoản mây.
   - *Lưu ý triển khai Serverless (Vercel):* Nhờ cơ chế **Signed Upload URL** ở chế độ Đám mây, trình duyệt tải thẳng file đã cấp phép lên Supabase Storage nên **không bị vướng giới hạn payload 4.5MB của Vercel Serverless**, giữ nguyên khả năng tải ảnh lớn/GIF và nhạc nền tới 15MB. Chế độ Local Fallback chỉ dành cho chạy trên máy cá nhân (ứng dụng sẽ hiển thị cảnh báo rõ trong `/admin` nếu chạy trên môi trường serverless chỉ-đọc mà quên cấu hình Supabase).

3. **Cơ chế xác thực trang `/admin` & Quyền riêng tư trang chính (`Builder's Call`):**
   - **Đăng nhập `/admin`:** Sử dụng mật khẩu quản trị lưu trong biến môi trường `ADMIN_PASSWORD` (mặc định khi chạy local nếu chưa đặt là một mật khẩu dev có cảnh báo rõ trong `.env.example`). Khi nhập đúng mật khẩu tại `/admin/login`, server ký một token phiên (`HMAC-SHA256` bằng `ADMIN_SESSION_SECRET`) lưu vào cookie `httpOnly`, `sameSite=lax`, thời hạn 7 ngày. Không cần tạo hệ thống tài khoản email rườm rà.
   - **Tuỳ chọn khoá mã PIN cho trang người xem (`/`) (`Builder's Call`):** Mặc định **Tắt** để người thương bấm vào link là xem được ngay. Tuy nhiên trong `/admin` có sẵn công tắc bật/tắt *"Yêu cầu mã kỷ niệm khi mở trang"* (ví dụ nhập `1210` hoặc ngày yêu) phòng khi bạn đưa link lên mạng và muốn chỉ hai người xem được ảnh riêng tư.

4. **Mô hình dữ liệu & Quản lý file tải lên (`Builder's Call`):**
   - **Cấu hình chung (`SiteSettings`):**
     - `coupleTitle` (ví dụ: *"Minh & Lan"*), `heroSubtitle` (câu dẫn mở đầu), `loveStartDate` (`YYYY-MM-DD`, dùng tính chính xác số ngày yêu theo múi giờ Việt Nam `Asia/Ho_Chi_Minh`), `musicUrl` (link file nhạc MP3/M4A hoặc bản nhạc nhẹ mặc định đi kèm), `musicEnabled` (`boolean`), `letterTitle`, `letterBody` (hỗ trợ nhiều đoạn văn), `letterSignature`, `viewerPasscodeEnabled` (`boolean`), `viewerPasscode` (`string`, lưu dạng băm hoặc kiểm tra phía server).
   - **Mốc kỷ niệm (`MemoryItem`):**
     - `id` (`UUID`), `memoryDate` (ngày hiển thị linh hoạt dạng `YYYY-MM-DD` để dễ sắp xếp và định dạng sang `DD.MM.YYYY` / `Tháng MM, YYYY`), `title` (tiêu đề ngắn, tuỳ chọn), `story` (vài dòng câu chuyện kỷ niệm), `imageUrl` (đường dẫn ảnh), `imageAlt`, `sortOrder` (`integer`, cho phép sắp xếp theo ngày hoặc chỉnh thứ tự ưu tiên trong `/admin`), `createdAt`.
   - **Ràng buộc & luồng tải file lên:** Hỗ trợ ảnh `JPG, PNG, WebP, GIF, AVIF` (tối đa `10MB`/ảnh; tự động tối ưu kích thước phía trình duyệt cho ảnh tĩnh `JPG/PNG/WebP` quá lớn để người xem tải nhanh bằng 4G, đồng thời giữ nguyên ảnh động `GIF`) và nhạc nền `MP3, M4A, WAV` (tối đa `15MB`, hoặc dán link nhạc trực tiếp vào `musicUrl`). Ở chế độ Supabase Cloud, trình duyệt xin Signed Upload URL một lần từ `/api/admin/upload-url` rồi tải thẳng lên bucket; ở chế độ Local, trình duyệt gửi qua `/api/admin/upload`. Nếu bước lưu thông tin vào cơ sở dữ liệu thất bại sau khi đã tải file lên, hoặc khi quản trị viên xoá/thay thế ảnh kỷ niệm và nhạc nền trong `/admin`, hệ thống tự động xoá dọn file mồ côi/file cũ tương ứng trong kho lưu trữ.

5. **Chi tiết hệ màu & Font chữ cho phong cách `B · Trắng Tinh Khôi & Kính Mờ Pastel` (`Builder's Call`):**
   - **Bảng màu:** Nền trang chuyển sắc cực nhẹ (`#F8FAFC` → `#FDF2F8` → `#EFF6FF`) kèm các đốm sáng pastel mờ (`blur-3xl` hồng phấn `#FBCFE8` và xanh sương `#BAE6FD` độ trong suốt thấp); bề mặt thẻ kính `rgba(255, 255, 255, 0.76)` với `backdrop-filter: blur(14px)` và viền trắng `rgba(255, 255, 255, 0.9)`; màu nhấn hồng cánh sen dịu (`#EC4899` / `#DB2777`) phối tím lam nhẹ (`#6366F1`); màu chữ chính `#0F172A`, chữ phụ `#475569`.
   - **Bộ font tiếng Việt:** `Plus Jakarta Sans` (hoặc `Be Vietnam Pro`) cho giao diện hiện đại, trong trẻo; kết hợp một font chữ mềm mại hỗ trợ tiếng Việt (`Cormorant Garamond` hoặc `Lora` in nghiêng) riêng cho phần nội dung bên trong bức tâm thư cuối trang để tăng chiều sâu cảm xúc.

---

## 6. Phần Dành Cho Bước Thi Công (Left to the Builder)

- Cấu trúc thư mục chi tiết trong `src/` (tách các component Hero, DaysCounter, TimelineList, TimelineCard, PhotoLightbox, EnvelopeLetter, AudioPlayer, AdminDashboard, StorageAdapter).
- Chi tiết thông số đường cong chuyển động (`spring` / `easeOut`) của Framer Motion khi cuộn trang và khi mở nắp phong thư (tuân thủ `prefers-reduced-motion`).
- Bố cục chi tiết các form và thông báo trạng thái (`toast`, `loading skeleton`, trạng thái trống khi chưa có kỷ niệm) bên trong `/admin`.
- Bộ kiểm thử tự động (unit/integration tests cho bộ đếm ngày yêu, xác thực `/admin`, API CRUD kỷ niệm & cơ chế lưu trữ).
