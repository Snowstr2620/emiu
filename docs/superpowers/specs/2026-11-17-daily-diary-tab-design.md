# Thiết Kế Tính Năng: Tab "Nhật Ký Mỗi Ngày" (Daily Couple Diary)

- **Ngày thiết kế:** 2026-11-17
- **Dự án:** Hành Trình Kỷ Niệm Của Tụi Mình (`love-memories-website`)
- **Trạng thái:** Đã chốt hướng triển khai bằng TDD (bao gồm tải ảnh nhật ký & gia cố chạy Server Riêng)

---

## 1. Mục đích & Lý do (Intent & Why)

Người dùng muốn có một **không gian ghi nhật ký hằng ngày chung của hai người** nằm ở một tab riêng trên thanh menu (*"thêm cho tôi chức năng ghi nhật ký ở 1 tab khác trong menu. chúng tôi sẽ ghi lại mỗi ngày của chúng tôi ở đó"*).

Khác với **Hành trình kỷ niệm** (`MemoryItem`) vốn dùng để trưng bày những cột mốc lớn bắt buộc kèm ảnh (kỷ niệm quen nhau, chuyến đi chơi, lễ tình nhân), **Nhật ký mỗi ngày** là cuốn sổ chung đời thường để cả hai (`admin` và `viewer`) đều có thể ghé vào mỗi ngày, viết lại chuyện hôm nay, tâm trạng, lời nhắn nhủ cho nhau (có thể chỉ là chữ hoặc đính kèm thêm một bức ảnh chụp nhanh trong ngày).

---

## 2. Mục tiêu, Phi mục tiêu & Ràng buộc

### Mục tiêu (Goals)
1. **Chuyển tab mượt trên menu trang chính `/`:** Bổ sung thanh chuyển tab pill ngay trên thanh dock đầu trang chính ([StoryExperience.tsx](file:///c:/Users/Snow/Desktop/NY/src/components/story/StoryExperience.tsx)): **Hành trình kỷ niệm** | **Nhật ký mỗi ngày** mà vẫn giữ nhạc nền phát xuyên suốt, hiệu ứng hạt tim rơi và các nút điều khiển hiện hữu.
2. **Nhật ký đôi — cả hai tài khoản đều viết được trên `/`:** Khi đã đăng nhập (`admin` hoặc `viewer`), cả hai người đều có thể viết bài mới trong ngày, chọn tâm trạng (mood), đính kèm ảnh tuỳ chọn (kéo-thả, chọn tệp hoặc `Ctrl+V`). Nhiều bài viết trong cùng một ngày được gom nhóm dưới mốc ngày đó để cả "Anh" và "Em" đều viết được phần riêng của mình.
3. **Phân quyền sở hữu rõ ràng:**
   - Tài khoản `viewer` (`nguoithuong`): tạo bài viết mới mang tên mình, chỉnh sửa hoặc xoá **chỉ bài do chính mình viết** (`authorId === currentUser.id`).
   - Tài khoản `admin`: tạo bài viết mới và có toàn quyền chỉnh sửa/xoá mọi bài nhật ký (ngay trên `/` hoặc trong tab quản trị mới **Nhật ký mỗi ngày** tại `/admin`).
   - Khách chưa đăng nhập (khi `viewerPasscodeEnabled = false`): chỉ được đọc, không hiện form ghi/xoá; có khung đăng nhập nhanh 2 bước ngay tại tab Nhật ký nếu muốn bắt đầu viết.
4. **Đồng bộ lưu trữ kép (Dual-Mode Storage Parity):** Hoạt động đầy đủ ở cả chế độ Local (`data/local-db.json` + `public/uploads/`, tự động nâng cấp an toàn cho file `local-db.json` cũ chưa có `diaryEntries`) lẫn chế độ Supabase Cloud (`public.diary_entries` có bật RLS + Signed Upload URL trên bucket `love-memories`).

### Phi mục tiêu (Non-Goals)
- Không biến nhật ký thành mạng xã hội công khai nhiều người dùng bình luận/thả tim phức tạp; đây là cuốn sổ riêng tư dành cho cặp đôi.
- Không bắt buộc phải có ảnh mới lưu được nhật ký (ảnh là tuỳ chọn).

### Phản mục tiêu & Ràng buộc kỹ thuật (Anti-Goals & Constraints)
- **Giao diện Dark Velvet & Crimson-Rose nghiêm ngặt (`assertDarkVelvetTheme`):**
  - Tuyệt đối không dùng các class `sky-*`, `indigo-*`, `blue-*`, `violet-*`, `purple-*`, `slate-*`, `bg-white`, `to-pink-500`, `hover:brightness-110`, hoặc `placeholder:*/30|35|40|60` (dùng `placeholder:text-rose-300/70`).
  - Mọi hậu tố độ trong suốt Tailwind `/N` (`bg-*/N`, `text-*/N`, `border-*/N`, `ring-*/N`, ...) **bắt buộc chia hết cho 5** (`N % 5 === 0`).
  - Mọi thẻ `<option>` bên trong `<select>` phải có `className="bg-[#16080f] text-rose-50"`.
- **Ràng buộc đóng gói Client Component:** Tuyệt đối không import `src/lib/validation.ts` (có `node:path`) vào các component `'use client'`.
- **Bảo toàn cấu trúc DOM đã được kiểm thử trên `/` và `/admin`:**
  - Trên `StoryExperience.tsx`: giữ nguyên thứ tự `order-1` (`roleBadge`), `order-2 ml-auto shrink-0 sm:order-last` (`AudioToggle`), và `order-3 flex-wrap sm:order-2` (cụm nút hành động), không thêm `.ml-auto` phụ làm hỏng bố cục khi tắt nhạc nền.
  - Trên `AdminDashboard.tsx`: giữ nguyên tên 5 tab hiện có để không ảnh hưởng bộ kiểm thử hiện hữu; thêm tab thứ 6 `Nhật ký mỗi ngày (${diaryEntries.length})`.
- **An toàn dữ liệu (`accidental-data-loss-prevention`):** Không ghi đè hay làm mất dữ liệu trong `.env.local`, `data/local-db.json` và `public/uploads/*`.

---

## 3. Các hướng tiếp cận đã cân nhắc (Approaches)

| Hướng | Mô tả | Đánh đổi | Quyết định |
|---|---|---|---|
| **Hướng A (Đã chọn)** | Thêm thanh chuyển tab ngay trên menu đầu trang chính `/` (**Hành trình kỷ niệm** \| **Nhật ký mỗi ngày**). Cả `admin` và `viewer` khi đăng nhập vào `/` đều viết nhật ký trực tiếp tại đó (gắn nhãn tác giả, tự sửa/xoá bài của mình), đồng thời có thêm tab quản lý trong `/admin`. | Cần thêm tầng xác thực API cho thành viên đã đăng nhập (`viewer_unlocked` hoặc `admin`) và endpoint tải ảnh dành riêng cho ảnh nhật ký (chỉ cho phép `image`, kiểm tra an toàn khi xoá tệp tạm). Đổi lại đúng trọn vẹn tinh thần *"chúng tôi sẽ ghi lại mỗi ngày của chúng tôi ở đó"*. | **Người dùng đã chọn Hướng A.** |
| **Hướng B** | Chỉ đặt chức năng viết nhật ký trong `/admin` và hiển thị tab chỉ-đọc ở `/`. | Đơn giản hơn về phân quyền API nhưng khiến tài khoản `viewer` (`nguoithuong`) không tự viết nhật ký được trừ khi cấp quyền quản trị toàn hệ thống. | Loại bỏ. |

---

## 4. Thiết kế chi tiết

### 4.1. Quyết định từ người dùng vs Đề xuất kỹ thuật của Builder
- **Người dùng đã chốt:**
  - Chọn **Hướng A**: đặt tab chuyển đổi trên menu trang chính `/` và cho phép cả hai người cùng ghi lại mỗi ngày tại đó, kèm quản lý trong `/admin`.
- **Các lựa chọn thiết kế do Builder đề xuất (Builder's Calls — có thể điều chỉnh nếu người dùng muốn):**
  1. **Nhật ký đôi theo ngày:** Cho phép nhiều bài viết trong cùng một ngày (`entryDate`), gom nhóm theo ngày giảm dần (ngày mới nhất ở trên cùng) để mỗi ngày cả Anh và Em đều viết được cảm nhận riêng mà không ghi đè bài của nhau.
  2. **Biểu tượng tâm trạng (Mood) & Ảnh đính kèm tuỳ chọn:** Mỗi bài có trường `mood` (7 trạng thái tình cảm nhẹ nhàng dùng icon Lucide, không dùng emoji thô làm icon giao diện), `title` ngắn tuỳ chọn, `content` bắt buộc, và `imageUrl` tuỳ chọn hỗ trợ kéo-thả + dán `Ctrl+V` + nén ảnh phía trình duyệt.
  3. **Ghi nhận lịch sử hoạt động:** Các thao tác thêm/sửa/xoá nhật ký tự động ghi vào `activity_logs` (`diary_saved`, `diary_deleted`) để hiển thị trong tab *Nhật ký ra vào & Hành động* của `/admin`.

### 4.2. Mô hình dữ liệu & Validation

#### Kiểu dữ liệu mới trong `src/types/memories.ts`
```ts
export type DiaryMood =
  | 'loved'      // Được thương
  | 'happy'      // Hạnh phúc
  | 'peaceful'   // Bình yên
  | 'miss_you'   // Nhớ nhau
  | 'grateful'   // Biết ơn
  | 'excited'    // Háo hức
  | 'tired';     // Hơi mệt, cần ôm

export interface DiaryEntry {
  id: string;
  entryDate: string; // YYYY-MM-DD (theo múi giờ Việt Nam khi tạo mặc định)
  title: string;     // 0..120 ký tự (tuỳ chọn)
  content: string;   // 1..4000 ký tự (bắt buộc)
  mood: DiaryMood;
  imageUrl: string;  // "" nếu không đính kèm ảnh, hoặc URL hợp lệ (/uploads/..., /samples/..., http(s)://...)
  imageAlt: string;  // 0..160 ký tự ("" khi imageUrl rỗng)
  authorId: string | null;
  authorUsername: string;
  authorDisplayName: string;
  authorRole: UserRole;
  createdAt: string;
  updatedAt: string;
}
```
- Mở rộng `ActivityEventType` thêm `'diary_saved' | 'diary_deleted'`.
- Mở rộng `PublicSiteData` và `AdminSiteData` thêm `diaryEntries?: DiaryEntry[]` (các hàm `getPublicData()` và `getAdminData()` luôn trả mảng `DiaryEntry[]` đã sắp xếp `entryDate DESC, createdAt DESC`; để `?` trên kiểu prop giúp tương thích ngược với các fixture test cũ nếu không truyền).

#### Validation trong `src/lib/validation.ts`
- `DIARY_MOODS`: tập hợp 7 giá trị `DiaryMood` hợp lệ (mặc định `'loved'` nếu không truyền; báo lỗi `400` nếu truyền giá trị lạ).
- `validateDiaryEntryPayload(raw: unknown)`:
  - `entryDate`: bắt buộc đúng `YYYY-MM-DD` qua `parseIsoDateParts`.
  - `title`: chuỗi tuỳ chọn, `.trim().slice(0, 120)`.
  - `content`: bắt buộc khác rỗng sau `.trim()`, cắt tối đa `4000` ký tự.
  - `mood`: kiểm tra thuộc `DIARY_MOODS` (nếu `undefined` hoặc `""` thì gán `'loved'`).
  - `imageUrl`: chuỗi tuỳ chọn; nếu khác rỗng phải thoả `isValidMediaUrl(imageUrl)`.
  - `imageAlt`: nếu `imageUrl` rỗng thì trả `""`; nếu có `imageUrl` thì `(imageAlt || title || 'Ảnh nhật ký ngày hôm nay').slice(0, 160)`.

### 4.3. Lưu trữ kép (Local JSON & Supabase)

#### `LocalDbSchema` (`src/lib/seed-data.ts` & `src/lib/storage/local-repository.ts`)
- Thêm `diaryEntries: DiaryEntry[]` vào `LocalDbSchema` (khởi tạo mảng rỗng `[]` cho DB mới để cuốn nhật ký hoàn toàn dành riêng cho hai bạn tự viết; không nhồi dữ liệu giả gây rối).
- Trong `ensureSeededUsersAndUpgrade(raw)`: nếu `!Array.isArray(raw.diaryEntries)` thì gán `diaryEntries = []` và đánh dấu `migrated = true` mà không chạm tới `settings`, `memories`, `users`, `activityLogs` sẵn có.
- Các phương thức mới trong `StorageRepository` (`src/lib/storage/types.ts`):
  - `listDiaryEntries(): Promise<DiaryEntry[]>`
  - `getDiaryEntryById(id: string): Promise<DiaryEntry | null>`
  - `createDiaryEntry(input: CreateDiaryEntryInput): Promise<DiaryEntry>` (trong đó `CreateDiaryEntryInput = ValidatedDiaryEntryPayload & { authorId: string | null; authorUsername: string; authorDisplayName: string; authorRole: UserRole }`)
  - `updateDiaryEntry(id: string, input: ValidatedDiaryEntryPayload): Promise<DiaryEntry | null>` (nếu `previousImageUrl` khác rỗng và khác `input.imageUrl` thì dọn file cũ qua `deleteStoredFileByUrl` khi không còn bản ghi nào tham chiếu)
  - `deleteDiaryEntry(id: string): Promise<boolean>` (xoá bản ghi và dọn ảnh đính kèm nếu không còn bản ghi nào tham chiếu)
  - `isMediaUrlReferenced(url: string): Promise<boolean>` (kiểm tra URL có đang nằm trong `settings.musicUrl`, `memories[].imageUrl`, hoặc `diaryEntries[].imageUrl` hay không — dùng để bảo vệ xoá file an toàn).

#### Supabase (`supabase/schema.sql` & `src/lib/storage/supabase-repository.ts`)
- Bổ sung bảng `public.diary_entries` vào `supabase/schema.sql`:
  ```sql
  create table if not exists public.diary_entries (
    id uuid primary key default gen_random_uuid(),
    entry_date date not null,
    title text not null default '',
    content text not null,
    mood text not null default 'loved' check (
      mood in ('loved', 'happy', 'peaceful', 'miss_you', 'grateful', 'excited', 'tired')
    ),
    image_url text not null default '',
    image_alt text not null default '',
    author_id uuid null references public.app_users(id) on delete set null,
    author_username text not null,
    author_display_name text not null,
    author_role text not null check (author_role in ('admin', 'viewer')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );

  create index if not exists idx_diary_entries_entry_date
    on public.diary_entries (entry_date desc, created_at desc);

  alter table public.diary_entries enable row level security;
  ```
- Trong `SupabaseStorageRepository`: ánh xạ đầy đủ `DbDiaryEntryRow <-> DiaryEntry`, truy vấn sắp xếp `order('entry_date', { ascending: false }).order('created_at', { ascending: false })`. Nếu dự án Supabase cũ chưa kịp chạy đoạn SQL tạo bảng `diary_entries` (mã lỗi Postgres `42P01` / `PGRST205` khi `getPublicData` hoặc `getAdminData` đọc lần đầu), trả về `diaryEntries: []` êm ái để không làm sập trang chính, và báo lỗi tiếng Việt rõ ràng hướng dẫn chạy `supabase/schema.sql` khi người dùng thực hiện ghi nhật ký.

### 4.4. Xác thực Thành viên & Các API Route

#### Guard dùng chung `src/lib/member-guard.ts`
- `resolveMemberSession(repository, request?)`:
  1. Kiểm tra cookie `VIEWER_UNLOCKED_COOKIE_NAME` (`ny_viewer_unlocked`) qua `verifyViewerTokenWithRepo(token, 'viewer_unlocked', repo)`. Nếu hợp lệ -> trả về `sanitizeUserForClient(user)`.
  2. Nếu không có hoặc hết hạn -> kiểm tra tiếp cookie `ADMIN_COOKIE_NAME` (`ny_admin_session`) qua `resolveAdminSession(repo, request)`. Nếu hợp lệ -> trả về user `admin`.
  3. Ngược lại trả về `null`.
- `requireMemberApiSession(request, repository?)`:
  - Trả `{ ok: true, user }` nếu `resolveMemberSession` tìm thấy tài khoản đang hoạt động (`admin` hoặc `viewer`).
  - Trả `{ ok: false, response: NextResponse(401) }` (kèm xoá cookie `ny_viewer_unlocked` / `ny_admin_session` bị hỏng/thu hồi nếu có) khi chưa xác thực.
- Cập nhật nhỏ trong `src/app/page.tsx` (`HomePage`):
  - Giữ nguyên cổng `ViewerPasscodeGate` khi `viewerPasscodeEnabled === true` và `session.stage !== 'unlocked'`.
  - Khi `viewerPasscodeEnabled === false` và `session.user === null`, gọi dự phòng `resolveAdminSession(repository)` để nếu `admin` đang đăng nhập `/admin` rồi mở `/` thì vẫn nhận diện được `currentUser` để viết nhật ký ngay.

#### Các Route mới
1. `GET /api/diary` & `POST /api/diary` (`src/app/api/diary/route.ts`):
   - `GET`: Nếu `settings.viewerPasscodeEnabled === true`, yêu cầu `requireMemberApiSession`; nếu `false`, cho phép đọc công khai `{ entries }`.
   - `POST`: Bắt buộc `requireMemberApiSession`. Validate payload qua `validateDiaryEntryPayload`. Ghi bản ghi với thông tin tác giả lấy từ phiên xác thực server (`user.id`, `user.username`, `user.displayName`, `user.role` — không bao giờ tin dữ liệu tác giả gửi từ client). Ghi `recordActivity` sự kiện `'diary_saved'`. Trả `201 { entry }`.
2. `PUT /api/diary/[id]` & `DELETE /api/diary/[id]` (`src/app/api/diary/[id]/route.ts`):
   - Bắt buộc `requireMemberApiSession`.
   - Đọc `existing = await repo.getDiaryEntryById(id)`; nếu không có trả `404`.
   - Kiểm tra quyền sở hữu: nếu `auth.user.role !== 'admin' && existing.authorId !== auth.user.id` -> trả `403` (`"Bạn chỉ có thể chỉnh sửa hoặc xoá trang nhật ký của chính mình."`).
   - `PUT`: validate payload, cập nhật bài viết (giữ nguyên tác giả gốc của bài viết), ghi `recordActivity('diary_saved', ...)`, trả `200 { entry }`.
   - `DELETE`: xoá bài viết, ghi `recordActivity('diary_deleted', ...)`, trả `200 { ok: true }`.
3. `POST /api/diary/upload-url` (`src/app/api/diary/upload-url/route.ts`) & `POST, DELETE /api/diary/upload` (`src/app/api/diary/upload/route.ts`):
   - Bảo vệ bởi `requireMemberApiSession`.
   - **Chỉ cho phép `kind === 'image'`** (từ chối `audio` với `400`).
   - `DELETE /api/diary/upload` (dọn ảnh mồ côi khi lưu DB thất bại): kiểm tra `await repo.isMediaUrlReferenced(url)` — nếu URL đang được dùng bởi bất kỳ kỷ niệm, nhạc nền hay trang nhật ký nào thì từ chối `403` không xoá, chỉ xoá tệp tạm chưa gắn vào DB.
   - Mở rộng tuỳ chọn `endpoints?: { uploadUrlEndpoint?: string; cleanupEndpoint?: string }` cho `uploadMediaFile` và `cleanupUploadedUrl` trong `src/lib/admin-upload.ts` (mặc định giữ nguyên `/api/admin/upload-url` và `/api/admin/upload` để không ảnh hưởng code cũ).

### 4.5. Thiết kế Giao diện (UI/UX)

#### 1. Thanh chuyển Tab trên `/` (`src/components/story/StoryExperience.tsx`)
```text
┌──────────────────────────────────────────────────────────────────────────────┐
│ [♥ Em bé thương yêu]  [ Hành trình kỷ niệm | Nhật ký (12) ] [✨ Trái tim] ... │
└──────────────────────────────────────────────────────────────────────────────┘
```
- Đặt cụm pill chuyển tab (`Hành trình kỷ niệm` | `Nhật ký mỗi ngày`) nằm gọn trong thanh dock đầu trang (cạnh các nút điều khiển trong nhóm `order-3 sm:order-2`, dùng `aria-pressed` hoặc `role="tablist"` chuẩn trợ năng, chiều cao tối thiểu `min-h-[36px]`, viền kính mờ `glass-pill`, tab đang chọn nổi bật với dải gradient `from-red-600 via-rose-600 to-pink-600 text-white`).
- Khi ở tab **Hành trình kỷ niệm** (mặc định): hiển thị nguyên vẹn `HeroSection`, `MemoryTimeline`, `EnvelopeLetter`.
- Khi chuyển sang tab **Nhật ký mỗi ngày**: hiển thị component mới `<DailyDiarySection />` (cuộn mượt lên đầu trang, nhạc nền vẫn tiếp tục phát không bị ngắt).

#### 2. Trang `DailyDiarySection` (`src/components/story/DailyDiarySection.tsx`)
- **Phần mở đầu (Header & Quick Dropzone):**
  - Tiêu đề serif lãng mạn: *"Nhật Ký Mỗi Ngày Của Tụi Mình"*, bộ đếm tổng số trang nhật ký & số ngày đã cùng ghi chép.
  - Nếu `currentUser` đã đăng nhập: nút chính **"Viết cho hôm nay"** (và hỗ trợ kéo-thả nhanh một bức ảnh vào khung đầu mục để mở ngay khung viết kèm sẵn ảnh xem trước).
  - Nếu `currentUser === null` (chỉ xảy ra khi tắt khoá trang công khai): hiển thị thẻ mời đăng nhập nhẹ nhàng kèm form đăng nhập 2 bước thu gọn (Tài khoản + Mật khẩu -> OTP 6 số -> `router.refresh()`) ngay tại chỗ.
- **Khung Viết / Chỉnh sửa Nhật ký:**
  - Chọn ngày (`input type="date"`, mặc định ngày hôm nay theo múi giờ `Asia/Ho_Chi_Minh`).
  - Hàng chọn tâm trạng (`7` pill cảm xúc có icon Lucide + nhãn tiếng Việt: *Được thương, Hạnh phúc, Bình yên, Nhớ nhau, Biết ơn, Háo hức, Hơi mệt*).
  - Ô tiêu đề ngắn tuỳ chọn (*"Tiêu đề nhỏ hôm nay (tuỳ chọn)"*) và ô nội dung tâm sự (*"Hôm nay của mình có gì vui, nhớ thương hay muốn kể nhau nghe..."*).
  - Khung ảnh tuỳ chọn bên cạnh: hỗ trợ bấm chọn tệp, kéo-thả ảnh (`diary-image-dropzone`), dán ảnh `Ctrl+V`, xem trước ảnh ngay lập tức, nút *"Bỏ ảnh đính kèm"* (hoặc xoá ảnh cũ khi đang sửa bài).
- **Bộ lọc & Dòng chảy Nhật ký theo ngày:**
  - Thanh lọc gọn: Tìm kiếm từ khoá, lọc theo người viết (*Tất cả / Anh / Em*), lọc theo tâm trạng (`<select>` với `<option className="bg-[#16080f] text-rose-50">`).
  - Các bài viết được gom theo từng mốc ngày (`20 Tháng 12, 2025`):
    - Nếu trong một ngày cả hai người cùng viết, hai thẻ bài viết nằm cạnh nhau trên màn hình lớn (`lg:grid-cols-2`, *"Nhật ký đôi"*), hoặc trải rộng toàn chiều ngang nếu ngày đó có 1 bài.
    - Mỗi thẻ hiển thị nhãn người viết (hồng phấn cho `viewer`, đỏ nhung cho `admin`), huy hiệu tâm trạng, giờ viết theo giờ Việt Nam, nội dung chia đoạn rõ ràng, ảnh đính kèm (bấm vào phóng to trong hộp thoại Lightbox có bẫy tiêu điểm bàn phím `useModalFocusTrap`), và nút **Sửa** / **Xoá** (xác nhận 2 bước) nếu người xem có quyền trên bài đó.

#### 3. Tab Quản lý trong `/admin` (`src/components/admin/AdminDashboard.tsx`)
- Thêm tab **`Nhật ký mỗi ngày (${diaryEntries.length})`** vào thanh điều hướng `/admin`.
- Cung cấp bộ lọc tìm kiếm, thêm mới, chỉnh sửa bất kỳ bài nhật ký nào (hỗ trợ kéo-thả & `Ctrl+V` ảnh qua `/api/diary` hoặc `/api/admin/upload-url`), và xoá xác nhận 2 bước đồng bộ hoàn toàn với phong cách 5 tab hiện tại.

### 4.6. Gia cố ổn định cho Server Riêng (Self-Hosted Next.js Production)
1. **Phục vụ ảnh & nhạc động ngay lập tức sau `next build && next start` (`src/app/uploads/[filename]/route.ts`):**
   - Trong chế độ `next start` trên VPS/PC riêng (hoặc khi cấu hình `LOCAL_UPLOAD_DIR` ra ổ đĩa ngoài để backup độc lập), Next.js chỉ quét tĩnh thư mục `public/` lúc khởi động nên tệp tải lên sau đó dễ gặp `404`.
   - Bổ sung Route Handler `GET` & `HEAD` tại `/uploads/[filename]` (`dynamic = 'force-dynamic'`): kiểm tra chặt tên tệp (chặn `..`, `/`, `\`, tệp ẩn, chỉ chấp nhận đuôi trong `ALLOWED_IMAGE_EXTENSIONS` & `ALLOWED_AUDIO_EXTENSIONS`), trả đúng `Content-Type`, `X-Content-Type-Options: nosniff`, `Cache-Control: public, max-age=31536000, immutable`, và hỗ trợ `Range` (`206 Partial Content`) cho tệp âm thanh.
2. **Chống xung đột ghi đồng thời `data/local-db.json` (`LocalStorageRepository`):**
   - Bổ sung hàng đợi khoá tuần tự bất đồng bộ theo đường dẫn DB (`withWriteLock`) bao quanh các thao tác đọc-sửa-ghi để khi cả hai tài khoản (`admin` và `nguoithuong`) cùng lưu nhật ký hoặc ghi log hoạt động cùng lúc không bao giờ ghi đè mất bài của nhau.
   - Bổ sung cơ chế thử lại ngắn khi `fs.renameSync` gặp khoá tệp tạm thời (`EPERM` / `EBUSY` / `EACCES` trên Windows Server/PC) và tự dọn tệp `.tmp` nếu lỗi.
3. **Bảo toàn tham chiếu tệp đính kèm (`isMediaUrlReferenced`):**
   - Trước khi xoá tệp vật lý khi sửa/xoá kỷ niệm, sửa/xoá nhật ký hoặc dọn tệp tạm qua `DELETE /api/diary/upload`, luôn kiểm tra xem URL đó còn được tham chiếu bởi bất kỳ `memories`, `diaryEntries` hay `settings.musicUrl` nào khác không.

---

## 5. Những chi tiết để mở cho bước Lập kế hoạch & Triển khai (Left to the Builder)
- Cấu trúc chia nhỏ helper dùng chung cho drag-and-drop / paste ảnh giữa `AdminDashboard.tsx` và `DailyDiarySection.tsx` (ví dụ tách pure client helper sang `src/lib/client-upload-Dropzone.ts` hoặc đặt trong `src/lib/admin-upload.ts` không chứa module Node).
- Hiệu ứng chuyển cảnh Framer Motion nhẹ nhàng (tôn trọng `prefers-reduced-motion`) khi chuyển đổi giữa tab *Hành trình kỷ niệm* và *Nhật ký mỗi ngày*.
