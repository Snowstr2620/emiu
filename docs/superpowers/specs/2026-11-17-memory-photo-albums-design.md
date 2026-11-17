# Thiết Kế Tính Năng: Album Nhiều Ảnh Cho Kỷ Niệm & Trang Chi Tiết `/memories/[id]`

- **Ngày thiết kế:** 2026-11-17
- **Dự án:** Hành Trình Kỷ Niệm Của Tụi Mình (`love-memories-website`)
- **Trạng thái:** Đã triển khai & kiểm chứng

---

## 1. Mục đích & Lý do (Intent & Why)

Hiện tại mỗi mục trong **Kỷ niệm & Ảnh** (`MemoryItem`) chỉ gắn được **1 bức ảnh duy nhất** (`imageUrl` + `imageAlt`). Trong thực tế, một dịp kỷ niệm (buổi hẹn đầu, chuyến du lịch, sinh nhật, lễ tình nhân) luôn có cả một bộ nhiều bức ảnh đi cùng một bài viết tâm sự.

Người dùng muốn nâng cấp mỗi kỷ niệm thành một **Album ảnh nhiều tấm** và chọn **Cách 2**:
- Trong `/admin`: thêm nhiều ảnh vào cùng một kỷ niệm (kéo-thả nhiều tệp một lúc, chọn nhiều tệp, dán `Ctrl+V`, sắp xếp chọn ảnh bìa, xoá từng ảnh lẻ).
- Ngoài trang chính `/`: thẻ kỷ niệm đóng vai trò thẻ bìa album; khi bấm xem chi tiết sẽ chuyển sang **trang riêng `/memories/[id]`** có bố cục **2 cột giống trang chi tiết sản phẩm bán hàng (E-commerce Product Detail)** — cột trái là khung ảnh chính kèm dải ảnh nhỏ (thumbnail strip), cột phải là thông tin ngày tháng, tiêu đề và toàn bộ bài viết.
- Khi bấm vào ảnh chính trong trang chi tiết album: mở **Popup phóng to toàn màn hình** hỗ trợ **vuốt tay trái/phải (touch/pointer swipe)**, nút chuyển trái/phải, phím mũi tên `←/→` và dải thumbnail bên dưới để lướt xem hết các ảnh trong album.

---

## 2. Mục tiêu, Phi mục tiêu & Ràng buộc

### Mục tiêu (Goals)
1. **Mô hình dữ liệu Album tương thích ngược 100%:** Mở rộng `MemoryItem` với mảng `images: MemoryImageItem[]` (`1..30` ảnh mỗi album), đồng thời luôn đồng bộ `imageUrl = images[0].url` và `imageAlt = images[0].alt` để toàn bộ dữ liệu cũ trong `data/local-db.json`, Supabase và bộ kiểm thử hiện tại hoạt động trơn tru không cần xoá tạo lại.
2. **Quản lý Album nhiều ảnh trong `/admin` (`AdminDashboard.tsx`):**
   - Kéo-thả **nhiều ảnh cùng lúc**, chọn nhiều ảnh (`<input multiple>`), dán `Ctrl+V` nối tiếp vào danh sách ảnh của album, hoặc thêm ảnh qua URL.
   - Hiển thị lưới ảnh trực quan ngay trong form: đánh dấu rõ **`Ảnh bìa`** (ảnh đầu tiên), cho phép đặt ảnh bất kỳ làm ảnh bìa / đổi vị trí trái-phải, sửa mô tả riêng từng ảnh (tuỳ chọn) và xoá từng ảnh khỏi album.
   - Hiển thị tiến độ tải từng ảnh (`Đang tải ảnh 2/6...`) và tự động dọn ảnh mới tải lên nếu lưu DB thất bại; khi sửa/xoá album tự động xoá các tệp ảnh cũ không còn được tham chiếu (`isMediaUrlReferenced`).
3. **Trang Chi Tiết Album `/memories/[id]` kiểu E-commerce Product Showcase:**
   - Tuân thủ cổng bảo mật riêng tư: nếu `viewerPasscodeEnabled = true` mà chưa mở khoá OTP, hiển thị `ViewerPasscodeGate` giống hệt `/`.
   - Bố cục 2 cột chuẩn thương mại điện tử cao cấp (`lg:grid-cols-12`, nền nhung tối Dark Velvet & Crimson-Rose):
     - **Cột trái (`lg:col-span-7`, bám dính `lg:sticky lg:top-24`):** Khung ảnh lớn trung tâm (có nút `←/→` chuyển nhanh và nhãn phóng to `1 / N`) + **dải ảnh thu nhỏ (thumbnail strip)** cuộn ngang bên dưới để bấm đổi ảnh chính tức thì.
     - **Cột phải (`lg:col-span-5`):** Huy hiệu thứ tự album (`Album #01`), ngày kỷ niệm, số lượng ảnh, tiêu đề lớn (`font-serif`), chú thích riêng của bức ảnh đang chọn (nếu có), toàn bộ bài viết câu chuyện chia đoạn dễ đọc, nút **"Phóng to toàn bộ ảnh"** và điều hướng **Album trước / Album tiếp theo** + nút **Quay lại hành trình kỷ niệm (`/`)**.
4. **Popup Xem Ảnh Vuốt Trái / Phải (`AlbumLightboxModal`):**
   - Mở ra khi bấm vào khung ảnh chính trên `/memories/[id]`.
   - Hỗ trợ **vuốt cảm ứng & kéo chuột trái/phải (`touch` + `pointer` swipe threshold `40px`)**, nút bấm `Ảnh trước` / `Ảnh tiếp theo`, bàn phím `ArrowLeft` / `ArrowRight` / `Escape`, bẫy tiêu điểm `useModalFocusTrap`, bộ đếm `X / N` và thanh thumbnail chọn nhanh dưới đáy popup.
5. **Kiểm soát hiệu năng & dung lượng khi nhiều ảnh:**
   - Tự động nén ảnh tĩnh lớn (`> 1.5MB`) sang WebP/JPEG `<= 1920px` ngay trên trình duyệt trước khi gửi lên server.
   - Ngoài trang chính `/` chỉ tải **ảnh bìa** (`loading="lazy"`, `decoding="async"`), các ảnh phụ trong album chỉ tải khi người dùng mở trang `/memories/[id]`.

### Phi mục tiêu (Non-Goals)
- Không thêm giỏ hàng/giá tiền thương mại điện tử — chỉ áp dụng **bố cục trưng bày gallery sản phẩm (ảnh lớn + dải thumbnail + cột bài viết chi tiết + popup zoom vuốt trái/phải)** đúng như người dùng mô tả.
- Không cắt cúp mất góc ảnh dọc/ngang (`object-contain` trên nền nhung `#0b0408` cho khung ảnh chính & popup, chỉ dùng `object-cover` cho ô thumbnail nhỏ vuông vức).

### Ràng buộc kỹ thuật & Giao diện (Constraints)
- **Chuẩn màu Dark Velvet & Crimson-Rose (`assertDarkVelvetTheme`):** Cấm tuyệt đối `sky-*`, `indigo-*`, `blue-*`, `violet-*`, `purple-*`, `slate-*`, `bg-white`, `to-pink-500`, `hover:brightness-110`, `placeholder:*/30|35|40|60`; mọi độ trong suốt Tailwind `/N` phải chia hết cho `5`; mọi `<option>` trong `<select>` có `className="bg-[#16080f] text-rose-50"`.
- **Client Bundle Safety:** Không import `src/lib/validation.ts` (`node:path`) vào bất kỳ component `'use client'` nào.
- **Bảo toàn hành vi kiểm thử hiện có trên `/` và `/admin`:**
  - Trên `MemoryTimeline.tsx`: giữ nút phóng to nhanh ảnh bìa (`aria-label="Phóng to ảnh: ..."`) để không phá vỡ kiểm thử `PhotoLightbox` trên `/`, đồng thời thêm nút/liên kết rõ ràng **"Xem chi tiết album"** dẫn sang `/memories/[id]`.
  - Trong `AdminDashboard.tsx`: giữ tương thích trường nhập URL / kéo-thả đơn lẻ lẫn nhiều tệp cùng lúc.

---

## 3. Các hướng tiếp cận đã cân nhắc (Approaches)

| Hướng | Mô tả | Đánh đổi | Quyết định |
|---|---|---|---|
| **Cách 1** | Mở cửa sổ Modal/Drawer chi tiết album 2 cột ngay trên `/` rồi chồng thêm tầng Popup thứ 2 khi bấm phóng to ảnh. | Giữ nguyên trang `/` nhưng phải chồng 2 lớp modal lồng nhau trên màn hình nhỏ và không có đường dẫn URL riêng cho từng album kỷ niệm. | Loại bỏ. |
| **Cách 2 (Đã chọn)** | Tạo trang riêng `/memories/[id]` bố cục 2 cột kiểu trang chi tiết sản phẩm bán hàng (Gallery bên trái + Bài viết bên phải); bấm vào ảnh chính mới mở 1 lớp Popup duy nhất để vuốt trái/phải xem ảnh lớn. | Phân tách tầng xem bài viết và tầng popup phóng to ảnh cực kỳ rõ ràng, có URL riêng `/memories/[id]` dễ chia sẻ/đánh dấu, bố cục thoáng trên cả điện thoại lẫn máy tính. Đính kèm sẵn `AudioToggle` trên thanh đầu trang `/memories/[id]` để người xem vẫn bật nhạc nền êm ái nếu muốn. | **Người dùng đã chọn Cách 2.** |

---

## 4. Thiết kế Kỹ thuật Chi tiết

### 4.1. Quyết định của Người dùng vs Đề xuất của Builder
- **Người dùng đã chốt:**
  - Mỗi kỷ niệm là 1 **Album nhiều ảnh**.
  - Chọn **Cách 2**: bấm vào chi tiết kỷ niệm mở trang `/memories/[id]` bố cục kiểu trang bán hàng (hiển thị gallery + bài viết), bấm vào ảnh mở popup vuốt trái/phải xem các ảnh.
- **Đề xuất mặc định của Builder (Builder's Calls):**
  1. **Giới hạn an toàn mỗi album:** Tối đa `MAX_ALBUM_IMAGES = 30` ảnh / 1 kỷ niệm (đủ rộng cho một chuyến đi dài ngày mà vẫn tránh treo trình duyệt nếu lỡ kéo nhầm hàng trăm file).
  2. **Ảnh đầu tiên (`images[0]`) là Ảnh bìa:** Cho phép nút **"Đặt làm ảnh bìa"** và nút dịch trái/phải ngay trên từng ô ảnh trong `/admin`.
  3. **Ghi nhận hoạt động (`memory_viewed`):** Khi mở trang `/memories/[id]` hoặc phóng to ảnh trong album, tự động gửi sự kiện `memory_viewed` vào nhật ký hoạt động giống như trên trang chính.

### 4.2. Mô hình Dữ liệu & Validation

#### `src/types/memories.ts`
```ts
export interface MemoryImageItem {
  url: string;
  alt: string;
}

export interface MemoryItem {
  id: string;
  memoryDate: string; // YYYY-MM-DD
  title: string;
  story: string;
  imageUrl: string;   // Luôn bằng images[0].url (ảnh bìa)
  imageAlt: string;   // Luôn bằng images[0].alt
  images?: MemoryImageItem[]; // Mảng đầy đủ [ảnh bìa, ...các ảnh khác]
  sortOrder: number;
  createdAt: string;
}
```
- Helper dùng chung (đặt ở module thuần TS không phụ thuộc Node như `src/lib/memory-album.ts` để cả Server và Client đều import được):
  - `MAX_ALBUM_IMAGES = 30`
  - `getMemoryImages(memory: Pick<MemoryItem, 'imageUrl' | 'imageAlt' | 'title' | 'images'>): MemoryImageItem[]`: nếu `Array.isArray(memory.images) && memory.images.length > 0` thì trả danh sách đã lọc hợp lệ; ngược lại trả `memory.imageUrl ? [{ url: memory.imageUrl, alt: memory.imageAlt || memory.title || 'Ảnh kỷ niệm' }] : []`.

#### `src/lib/validation.ts` (`validateMemoryPayload`)
- `ValidatedMemoryPayload`:
  ```ts
  export interface ValidatedMemoryPayload {
    memoryDate: string;
    title: string;
    story: string;
    imageUrl: string;
    imageAlt: string;
    images: MemoryImageItem[];
  }
  ```
- Hỗ trợ cả 2 dạng đầu vào:
  1. Nếu `record.images` được truyền (`Array.isArray(record.images)`):
     - Phải có từ `1` đến `MAX_ALBUM_IMAGES` (`30`) phần tử.
     - Mỗi phần tử phải là object có `url` hợp lệ qua `isValidMediaUrl(url)`, `alt` cắt tối đa `160` ký tự (mặc định `title || 'Ảnh kỷ niệm'`).
     - Gán `imageUrl = images[0].url`, `imageAlt = images[0].alt`.
  2. Nếu không truyền `record.images` (payload cũ chỉ có `imageUrl` & `imageAlt`):
     - Kiểm tra `isValidMediaUrl(imageUrl)` như cũ và tự động chuẩn hoá `images = [{ url: imageUrl, alt: resolvedAlt }]`.

### 4.3. Lưu trữ Kép (Local JSON & Supabase)

#### Local Mode (`src/lib/seed-data.ts` & `src/lib/storage/local-repository.ts`)
- `createSeedSettingsAndMemories`: gắn sẵn `images: [{ url: imageUrl, alt: imageAlt }]` cho các bản ghi mẫu.
- `ensureSeededUsersAndUpgrade`: chuẩn hoá mọi `MemoryItem` trong `local-db.json` hiện có sao cho luôn có `images` đầy đủ mà không mất dữ liệu cũ.
- `isUrlReferencedInDb(db, url)`: kiểm tra `settings.musicUrl`, `diaryEntries[].imageUrl`, và **mọi phần tử trong `getMemoryImages(m)`** của `db.memories`.
- `createMemory` / `updateMemory` / `deleteMemory`:
  - Lưu đầy đủ `images`, `imageUrl: images[0].url`, `imageAlt: images[0].alt`.
  - Khi `updateMemory` hoặc `deleteMemory`: thu thập tập hợp tất cả URL ảnh cũ của kỷ niệm đó; với mỗi URL cũ không còn xuất hiện trong DB sau khi cập nhật (`!isUrlReferencedInDb(db, url)`), gọi `deleteStoredFileByUrl(url)`.
- Thêm `getMemoryById(id: string): Promise<MemoryItem | null>` vào `StorageRepository` (`src/lib/storage/types.ts`).

#### Supabase Mode (`supabase/schema.sql` & `src/lib/storage/supabase-repository.ts`)
- Trong `supabase/schema.sql`:
  - Bổ sung cột `images jsonb not null default '[]'::jsonb` vào bảng `public.memories`, kèm câu lệnh nâng cấp an toàn:
    ```sql
    alter table public.memories
      add column if not exists images jsonb not null default '[]'::jsonb;
    ```
- Trong `SupabaseStorageRepository`:
  - `DbMemoryRow` có thêm `images?: MemoryImageItem[] | null`.
  - `mapMemoryRow`: chuẩn hoá `images` qua `getMemoryImages(...)`, đồng bộ `imageUrl` và `imageAlt`.
  - `createMemory` & `updateMemory`: ghi `image_url`, `image_alt` và `images`. Nếu DB Supabase cũ chưa chạy lệnh thêm cột `images` (lỗi `42703` / `PGRST204`), tự động thử ghi lại với `image_url` + `image_alt` nếu chỉ có 1 ảnh, hoặc trả thông báo tiếng Việt rõ ràng hướng dẫn chạy `supabase/schema.sql` nếu có từ 2 ảnh trở lên.
  - `isMediaUrlReferenced(url)`: kiểm tra tất cả ảnh trong `memories` (cả `image_url` lẫn mảng `images`), `diary_entries` và `site_settings`.
  - `updateMemory` & `deleteMemory`: xoá sạch các file ảnh lẻ không còn được tham chiếu trên Supabase Storage.

### 4.4. Giao diện & Luồng Tương tác (UI/UX)

#### 1. Thẻ Album trên Trang chính `/` (`src/components/story/MemoryTimeline.tsx`)
- Hiển thị huy hiệu số lượng ảnh ở góc trên khung ảnh (ví dụ: icon `Images` + `6 ảnh` khi album có nhiều ảnh).
- Trên thẻ bài viết: hiển thị đoạn trích gọn gàng (`line-clamp-3`) nếu bài viết dài, dải xem trước tối đa 4 ảnh thu nhỏ (nếu album `> 1` ảnh, kèm ô `+N` nếu còn thêm ảnh), và nút liên kết nổi bật **"Xem chi tiết album →"** (`<Link href={`/memories/${memory.id}`}>`).
- Nút bấm trực tiếp vào ảnh bìa (`aria-label="Phóng to ảnh: ..."`) vẫn mở `PhotoLightbox` (cập nhật `PhotoLightbox` để nếu kỷ niệm đó có nhiều ảnh cũng có thể chuyển xem các ảnh ngay hoặc bấm sang trang chi tiết album).

#### 2. Trang Chi Tiết Album `/memories/[id]` (`src/app/memories/[id]/page.tsx` & `src/components/story/MemoryAlbumDetailView.tsx`)
- **Server Page (`src/app/memories/[id]/page.tsx`):**
  - `export const dynamic = 'force-dynamic';`
  - Xử lý `ProductionSetupError` và cổng `ViewerPasscodeGate` giống hệt `src/app/page.tsx`.
  - Tìm album theo `id` trong `data.memories`; nếu không tồn tại thì hiển thị thẻ thông báo *"Không tìm thấy album kỷ niệm này"* kèm nút quay về `/`.
- **Client Showcase (`src/components/story/MemoryAlbumDetailView.tsx`):**
  - Thanh điều hướng đầu trang cố định (`glass-pill`): nút **Quay lại hành trình (`/`)**, huy hiệu người dùng hiện tại, liên kết `/admin` (nếu là `admin`) và nút **Nhạc nền (`AudioToggle`)**.
  - **Cột trái — E-commerce Media Gallery (`lg:col-span-7`):**
    - Khung ảnh chính lớn (`data-testid="album-main-stage"`): bấm vào ảnh mở ngay **Popup phóng to (`AlbumLightboxModal`)** tại đúng bức ảnh đang chọn; có 2 nút mũi tên trái/phải chuyển ảnh nhanh nếu album có `>= 2` ảnh và huy hiệu `Ảnh 1 / 6 · Bấm để phóng to`.
    - **Dải Thumbnail ngang bên dưới (`data-testid="album-thumbnail-strip"`):** các nút `<button type="button" aria-pressed={activePhotoIndex === idx}>` vuông vức bo góc, ảnh đang chọn sáng viền hồng đỏ (`ring-2 ring-rose-400 border-rose-400`), cuộn mượt trên điện thoại.
  - **Cột phải — Thông tin & Bài viết Kỷ niệm (`lg:col-span-5`):**
    - Nhãn `Album #01`, ngày kỷ niệm dài (`10 Tháng 12, 2024`), tổng số ảnh trong album.
    - Tiêu đề album (`<h1>` serif sang trọng), chú thích riêng của tấm ảnh đang xem (nếu khác tiêu đề).
    - Toàn bộ nội dung bài viết (`story`) hiển thị trọn vẹn từng đoạn văn ấm áp.
    - Nút CTA **"Mở xem toàn màn hình (N ảnh)"** + cụm điều hướng **Album trước / Album tiếp theo** để lướt sang kỷ niệm kế tiếp ngay trong chế độ chi tiết.

#### 3. Popup Lướt Trái / Phải Toàn Màn Hình (`AlbumLightboxModal` trong `MemoryAlbumDetailView.tsx`)
- `role="dialog"`, `aria-modal="true"`, quản lý tiêu điểm bằng `useModalFocusTrap` và đóng bằng phím `Escape` hoặc nút `Đóng`.
- Hỗ trợ đầy đủ **3 cách lướt trái/phải**:
  1. **Vuốt tay trên điện thoại / kéo chuột (`onTouchStart` + `onTouchEnd` và `onPointerDown` + `onPointerUp`)**: vuốt sang trái (`deltaX <= -40px`) chuyển sang ảnh kế tiếp; vuốt sang phải (`deltaX >= 40px`) quay lại ảnh trước.
  2. **Nút bấm mũi tên lớn hai bên** (`Ảnh trước` / `Ảnh tiếp theo`, tối thiểu `44×44px`).
  3. **Phím mũi tên bàn phím** (`ArrowLeft` / `ArrowRight`) + **dải thumbnail thu nhỏ ngay dưới đáy popup** để nhảy nhanh tới bất kỳ tấm hình nào.

#### 4. Trình Quản lý Nhiều Ảnh trong `/admin` (`src/components/admin/AdminDashboard.tsx`)
- Nâng cấp `MemoryFormState` chứa mảng `items: AlbumDraftItem[]` (mỗi phần tử là ảnh đã lưu `{ kind: 'existing', url, alt }` hoặc tệp mới chọn `{ kind: 'file', file, previewUrl, alt }`).
- Khung `memory-image-dropzone` hỗ trợ:
  - `<input id="memory-file-upload" type="file" multiple ... />` chọn nhiều ảnh cùng lúc.
  - Kéo-thả **1 hoặc nhiều ảnh cùng lúc** vào cả `memories-quick-dropzone` lẫn `memory-image-dropzone` (thêm hàm `getDroppedOrPastedFiles` trả mảng `File[]` trong `src/lib/client-dropzone.ts`).
  - Dán `Ctrl+V` liên tiếp nhiều lần để cộng dồn thêm ảnh vào album, hoặc nhập đường dẫn URL rồi bấm **"Thêm URL vào album"** (đồng thời nếu album mới có 0–1 ảnh, ô đường dẫn URL vẫn đồng bộ mượt như cũ).
  - Lưới quản lý ảnh trong album: xem trước từng tấm, nhãn **`Ảnh bìa`** ở tấm số 1, nút **`Đặt làm bìa`**, nút dịch `←` / `→`, ô sửa mô tả ảnh và nút **`Xoá ảnh`** trên từng tấm (kèm nút **`Bỏ ảnh vừa chọn`** / **`Xoá toàn bộ ảnh mới chọn`**).
- Danh sách kỷ niệm ở Tab 1 `/admin` hiển thị thêm huy hiệu số lượng ảnh của từng album (`6 ảnh`).

---

## 5. Những chi tiết để mở cho bước Lập kế hoạch & Triển khai (Left to the Builder)
- Hiệu ứng chuyển ảnh mượt (fade/slide nhẹ tôn trọng `prefers-reduced-motion`) khi bấm đổi thumbnail hoặc vuốt trái/phải trong Popup.
- Tự động cuộn thanh thumbnail (`scrollIntoView({ inline: 'center', block: 'nearest' })`) khi người dùng lướt qua album có nhiều ảnh (`> 6` ảnh).
