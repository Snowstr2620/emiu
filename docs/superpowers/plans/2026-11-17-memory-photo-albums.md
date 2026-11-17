# Kế Hoạch Triển Khai: Album Nhiều Ảnh & Trang Chi Tiết `/memories/[id]` (Cách 2)

- **Ngày thực hiện:** 2026-11-17
- **Thiết kế tham chiếu:** [2026-11-17-memory-photo-albums-design.md](file:///c:/Users/Snow/Desktop/NY/docs/superpowers/specs/2026-11-17-memory-photo-albums-design.md)
- **Phương án được chọn:** Cách 2 — Trang chi tiết album 2 cột phong cách trang sản phẩm tại `/memories/[id]` kết hợp Popup Lightbox toàn màn hình lướt trái/phải.

## Các bước đã triển khai

### Bước 1: Mô hình dữ liệu Album, Helper & Validation nhiều ảnh
- `src/types/memories.ts`: Thêm `MemoryImageItem` (`{ url: string; alt: string }`) và trường tùy chọn `images?: MemoryImageItem[]` trên `MemoryItem`.
- `src/lib/memory-album.ts`: Tạo helper thuần TypeScript dùng chung cho cả Server và Client Component (`MAX_ALBUM_IMAGES = 30`, `getMemoryImages`).
- `src/lib/client-dropzone.ts`: Bổ sung `getDroppedOrPastedFiles` và `createManagedMultiDropHandlers` để nhận nhiều ảnh cùng lúc khi kéo thả, chọn nhiều tệp hoặc dán `Ctrl+V` (giữ nguyên tương thích ngược `getDroppedOrPastedFile` và `createManagedDropHandlers`).
- `src/lib/validation.ts`: Bổ sung `images: MemoryImageItem[]` vào `ValidatedMemoryPayload` và kiểm tra danh sách `1..30` ảnh trong `validateMemoryPayload`, tự chuẩn hóa dữ liệu cũ chỉ có `imageUrl` / `imageAlt`.

### Bước 2: Lưu trữ song song Local JSON & Supabase Postgres
- `src/lib/seed-data.ts`: Bổ sung `images` cho dữ liệu mẫu và nâng cấp tương thích dữ liệu cũ trong `ensureSeededUsersAndUpgrade`.
- `src/lib/storage/types.ts`: Thêm `MemoryMutationInput` và `getMemoryById(id: string)`.
- `src/lib/storage/local-repository.ts`: Hỗ trợ CRUD đa ảnh (`createMemory`, `updateMemory`, `deleteMemory`), `getMemoryById`, và kiểm tra tham chiếu `isUrlReferencedInDb` trên toàn bộ mảng `images` để chỉ dọn tệp upload khi không còn kỷ niệm/nhật ký nào dùng.
- `supabase/schema.sql` & `src/lib/storage/supabase-repository.ts`: Bổ sung cột `images jsonb not null default '[]'::jsonb`, map dữ liệu `DbMemoryRow.images`, có fallback khi cột `images` chưa được migrate (`42703` / `PGRST204`), và kiểm tra tham chiếu ảnh trước khi xóa trên Storage.

### Bước 3: Trình chỉnh sửa Album kéo thả nhiều ảnh tại `/admin`
- `src/components/admin/AdminDashboard.tsx`:
  - Cho phép kéo thả nhiều ảnh một lúc, chọn nhiều ảnh (`multiple` trên `#memory-file-upload`), dán nhiều ảnh `Ctrl+V`, hoặc nhấn `"Thêm URL"`.
  - Hiển thị lưới `data-testid="memory-album-grid"` với huy hiệu `Ảnh bìa`, nút `Đặt làm bìa`, sắp xếp thứ tự `←`/`→`, nhập `alt` cho từng ảnh, xóa từng ảnh và upload tuần tự kèm rollback khi lỗi.
  - Hiển thị huy hiệu số lượng ảnh và liên kết `"Xem album"` tại bảng kỷ niệm ở Tab 1.

### Bước 4: Thẻ Timeline album, trang `/memories/[id]` & Popup Lightbox lướt trái/phải
- `src/components/story/MemoryTimeline.tsx` & `src/components/story/PhotoLightbox.tsx`: Hiển thị huy hiệu `N ảnh`, dải ảnh thu nhỏ xem trước, thu gọn bài viết dài trên thẻ timeline kèm liên kết `"Xem chi tiết album"` tới `/memories/[id]` (và nút chuyển nhanh trong lightbox), đồng thời giữ nguyên phóng to nhanh ảnh bìa.
- `src/components/story/MemoryAlbumDetailView.tsx` & `src/app/memories/[id]/page.tsx`: Xây dựng trang chi tiết SSR `force-dynamic` 2 cột Dark Velvet & Crimson-Rose (cột trái sticky gồm sân khấu ảnh chính + dải thumbnail ngang; cột phải gồm toàn bộ bài viết kỷ niệm, thông tin album, nút mở popup và điều hướng album trước/sau) cùng `AlbumLightboxModal` hỗ trợ vuốt cảm ứng, kéo chuột, nút trái/phải, phím mũi tên/`Escape` và dải thumbnail bên dưới.
