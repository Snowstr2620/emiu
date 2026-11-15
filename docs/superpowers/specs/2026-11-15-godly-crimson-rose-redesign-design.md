# Thiết kế Giao diện Godly — Dark Velvet & Crimson-Rose (Đỏ & Hồng)

**Ngày:** 2026-11-15  
**Phạm vi:** Làm mới toàn bộ giao diện công khai (`/` — Auth Gate, Pixel Heart, Love Effects, Hero, Bento Showcase, Lightbox, Phong thư) theo phong cách **Godly (`godly.website`)** với tông **Dark Velvet & Crimson-Rose**, đồng thời đồng bộ bảng màu Đỏ & Hồng sang `/admin/login` và 5 tab `/admin` (giữ nguyên bố cục quản trị hiện có và 100% logic xác thực/nhật ký).

## 1. Hệ thống Màu sắc & Bề mặt (Design Tokens)
- **Nền chủ đạo (`velvet.bg`):** `#080306` chuyển sắc rượu vang tối sâu `#12070c` → `#090307`, kèm lớp lưới editorial cực mảnh (`1px`, opacity thấp) và quầng sáng mờ Đỏ Thẫm (`#dc2626`) + Hồng Cánh Sen (`#f43f5e`, `#ec4899`).
- **Thẻ kính mờ Godly (`.glass-card`, `.godly-bento-card`):** Nền bán trong suốt `rgba(20, 8, 14, 0.78)` (`backdrop-filter: blur(18px)`), viền mảnh `1px solid rgba(251, 113, 133, 0.18)`, ánh sáng specular viền trên và viền sáng Đỏ–Hồng khi hover (`rgba(244, 63, 94, 0.42)`).
- **Chữ & Độ tương phản:** Tiêu đề trắng hồng ngà `#fff1f2`, nội dung `#fecdd3` / `#fda4af`, nhãn phụ `#f472b6` / `text-rose-300/80`.
- **Quy tắc triệt để:** Loại bỏ 100% các sắc xanh dương (`sky`, `blue`), chàm (`indigo`), tím (`violet`, `purple`, lavender `#c4b5fd`, `#ddd6fe`, `#e9d5ff`) ở cả UI React, CSS, SVG mẫu (`public/samples/memory-1.svg`..`4.svg`), `PixelHeartIntro`, và `LoveEffectsLayer`.

## 2. Cấu trúc Bố cục Godly trên `/`
1. **Floating Top Pill Dock:** Thanh nổi `fixed inset-x-0 top-0 z-40` gồm các viên kính mờ Đỏ–Hồng tối (`min-h-[36px]`), chấm đỏ phát nhịp trực tiếp, liên kết `/admin` (chỉ hiển thị với role `admin`), nút ngắm lại trái tim, nút Đăng xuất và pill nhạc nền (`AudioToggle` inline).
2. **Cinematic Editorial Hero + Bento Metrics Strip (`HeroSection`):**
   - Nhãn ngày kỷ niệm dạng issue badge (`TỪ DD/MM/YYYY ĐẾN MÃI SAU`).
   - Tiêu đề serif `Cormorant Garamond` cỡ lớn (`text-4xl sm:text-6xl md:text-7xl`), đậm nét nổi bật trên nền tối.
   - Dải **Bento Metrics** 2 ô bất đối xứng: ô chính phát sáng Đỏ–Hồng hiển thị số ngày bên nhau (`.love-shimmer`) + ô phụ hiển thị số khoảnh khắc lưu giữ / trạng thái đồng hành.
3. **Asymmetric Bento Showcase Grid (`MemoryTimeline`):**
   - Nút chuyển đổi chế độ xem: **Bento** (mặc định, lưới 12 cột `lg:col-span-7` & `lg:col-span-5` xen kẽ trên desktop, 2 cột trên tablet, 1 cột trên mobile) và **Dòng chảy** (cuộn dọc editorial 1 cột).
   - Mỗi thẻ kỷ niệm là một showcase card có header `#01`, `#02`... + ngày kỷ niệm + chấm đỏ phát sáng, khung ảnh nền `#0b0408` giữ nguyên tỉ lệ ảnh (`object-contain`, không crop), và phần chú thích thơ mộng bên dưới (`break-words [overflow-wrap:anywhere]`).
4. **Cinema Lightbox & Ruby Wax-Seal Envelope:**
   - `PhotoLightbox`: Hộp thoại thư viện tối sâu, bộ đếm `#01 / 04`, gợi ý phím mũi tên `←` `→` `ESC`, vùng ảnh `shrink-0` và phần mô tả cuộn độc lập `min-h-0 flex-1 overflow-y-auto`.
   - `EnvelopeLetter`: Phong bì nhung đỏ sẫm với con dấu sáp Đỏ Ruby phát sáng (`Chạm để mở thư...`) và hiệu ứng tim Đỏ–Hồng toả ra từ `top-16` khi mở.
5. **Cổng Auth 2 bước (`ViewerPasscodeGate`) & `PixelHeartIntro` & `LoveEffectsLayer`:**
   - Cổng nhập tài khoản + mật khẩu + 6 ô OTP giữ nguyên hoàn toàn contract API & bảo mật, khoác giao diện Dark Velvet phát sáng viền Đỏ–Hồng.
   - `PixelHeartIntro`: Bảng màu 100% Đỏ–Hồng (`#dc2626` → `#ffe4e6`), tương thích cả bước 3 sau OTP (`<h1>`) lẫn hộp thoại xem lại có scroll (`<h2>`, `pt-12 sm:pt-8`).
   - `LoveEffectsLayer`: Cánh hoa hồng, tim đỏ & burst click chỉ dùng sắc Đỏ–Hồng; render sau mount để không nhấp nháy SSR với `prefers-reduced-motion`.

## 3. Đồng bộ Dark Velvet & Crimson-Rose trên `/admin/login` & `/admin`
- Giữ nguyên cấu trúc `/admin/login` và 5 tab `/admin` (`Kỷ niệm & Ảnh`, `Mở đầu, Nhạc nền & Riêng tư`, `Phong thư tâm sự`, `Tài khoản & Kiểm soát truy cập`, `Nhật ký ra vào & Hành động`), mọi guard tự khoá/xoá, floating toast và `<audio>` width trên mobile.
- Chuyển toàn bộ card, input, textarea, `<select>` + `<option className="bg-[#16080f] text-rose-50">`, dropzone, live letter preview, user cards, stat cards và bảng nhật ký sang nền nhung tối + nhấn Đỏ–Hồng rõ nét, dễ đọc trên Mobile (`375×812`), Tablet (`768×1024`) và Desktop (`1440×900`).
