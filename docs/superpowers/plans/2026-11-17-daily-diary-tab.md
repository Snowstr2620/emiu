# Daily Diary Tab & Self-Hosted Server Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dual-author "Nhật ký mỗi ngày" tab on `/` (and management tab in `/admin`) with optional drag-and-drop/paste photo uploads for both `admin` and `viewer` accounts, plus dynamic `/uploads/[filename]` serving and concurrent write safety for dedicated self-hosted Next.js servers.

**Architecture:** Extend `StorageRepository` (`LocalStorageRepository` + `SupabaseStorageRepository`) with `DiaryEntry` CRUD, `isMediaUrlReferenced` checks, and a per-file async write mutex + atomic rename retry in Local Mode. Expose member-authenticated API routes (`/api/diary`, `/api/diary/[id]`, `/api/diary/upload-url`, `/api/diary/upload`) backed by `requireMemberApiSession`, a dynamic `/uploads/[filename]` route for `next start` / custom `LOCAL_UPLOAD_DIR`, a new `<DailyDiarySection />` switched from the floating pill dock in `StoryExperience.tsx`, and a 6th management tab in `AdminDashboard.tsx`.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Framer Motion, Lucide React, Supabase JS, Vitest + Testing Library (`happy-dom`).

**Spec:** `docs/superpowers/specs/2026-11-17-daily-diary-tab-design.md`

## Global Constraints

- Dark Velvet & Crimson-Rose theme strictly enforced: zero `sky-*`, `indigo-*`, `blue-*`, `violet-*`, `purple-*`, `slate-*`, `bg-white`, `to-pink-500`, `hover:brightness-110`, or `placeholder:*/30|35|40|60` classes; all Tailwind `/N` opacities must satisfy `N % 5 === 0`; all `<select> <option>` elements must carry `className="bg-[#16080f] text-rose-50"`.
- Never import `src/lib/validation.ts` (`node:path`) into `'use client'` components.
- Preserve existing `StoryExperience.tsx` dock flex order (`order-1` role badge, `order-2 ml-auto shrink-0 sm:order-last` audio toggle, `order-3 flex-wrap sm:order-2` action group, no extra `.ml-auto` elements) and existing `AdminDashboard.tsx` tab labels.
- Never delete or overwrite `.env.local`, `data/local-db.json`, or `public/uploads/*`.

## Review Focus

1. **`viewer` (`nguoithuong`) attempting `DELETE /api/diary/upload` on an active memory/audio/diary URL:** must return `403` without deleting the file because `isMediaUrlReferenced(url)` is `true`.
2. **Concurrent writes to `local-db.json` on a dedicated server (e.g., `createDiaryEntry` by `admin` + `createDiaryEntry` by `viewer` + `recordActivity` at the same instant, or transient Windows `EPERM` on `fs.renameSync`):** must serialize cleanly via `withWriteLock` and retry `renameSync` without losing any entry.
3. **Newly uploaded `/uploads/<file>` requested in production `next start` or custom `LOCAL_UPLOAD_DIR`:** `GET /uploads/[filename]` must stream `200` (or `206` on `Range`) for whitelisted extensions and reject `..` / `.svg` / `.html` / missing files with `400`/`404` + `X-Content-Type-Options: nosniff`.
4. **`viewer_step1` (password-only, OTP unverified) cookie presented to `/api/diary` or `/api/diary/upload-url`:** `requireMemberApiSession` must reject with `401` so half-authenticated sessions cannot read/write locked diaries or upload files.
5. **Pre-existing Supabase database where `public.diary_entries` table has not been created yet (`42P01` / `PGRST205`):** `getPublicData()` and `getAdminData()` must degrade gracefully to `diaryEntries: []` instead of crashing `/` or `/admin`.

---

### Task 1: Diary Types, Payload Validation & Member Session Guard

**Files:**
- Modify: `src/types/memories.ts`
- Modify: `src/lib/validation.ts`
- Create: `src/lib/member-guard.ts`
- Test: `tests/auth-and-validation.test.ts`

**Interfaces:**
- Produces:
  - `DiaryMood`, `DiaryEntry`, updated `ActivityEventType` (`'diary_saved' | 'diary_deleted'`), `PublicSiteData.diaryEntries?: DiaryEntry[]`, `AdminSiteData.diaryEntries?: DiaryEntry[]` in `src/types/memories.ts`
  - `DIARY_MOODS`, `ValidatedDiaryEntryPayload`, `validateDiaryEntryPayload(raw: unknown)` in `src/lib/validation.ts`
  - `resolveMemberSession(repository: StorageRepository, request?: Request): Promise<SafeAppUser | null>` and `requireMemberApiSession(request: Request, repository?: StorageRepository): Promise<MemberGuardResult>` in `src/lib/member-guard.ts`

- [ ] **Step 1: Write failing tests in `tests/auth-and-validation.test.ts`** covering `validateDiaryEntryPayload` (valid text-only & with-image payloads, default `'loved'` mood, invalid mood rejection, empty content rejection, invalid `entryDate`, clearing `imageAlt` when `imageUrl` is empty) and `requireMemberApiSession` (accepts `viewer_unlocked`, falls back to `admin` session when viewer cookie is missing/expired, rejects `viewer_step1` and revoked `sessionVersion` with `401` and clears stale cookies).
- [ ] **Step 2: Run `npx vitest run tests/auth-and-validation.test.ts` and verify RED failure.**
- [ ] **Step 3: Implement types in `src/types/memories.ts`, `validateDiaryEntryPayload` in `src/lib/validation.ts`, and `resolveMemberSession` + `requireMemberApiSession` in `src/lib/member-guard.ts`.**
- [ ] **Step 4: Run `npx vitest run tests/auth-and-validation.test.ts` and verify GREEN.**

---

### Task 2: Dual-Mode Storage Parity, Dedicated Server Write Mutex & Referential Media Cleanup

**Files:**
- Modify: `src/lib/seed-data.ts`
- Modify: `src/lib/storage/types.ts`
- Modify: `src/lib/storage/local-repository.ts`
- Modify: `src/lib/storage/supabase-repository.ts`
- Modify: `supabase/schema.sql`
- Test: `tests/local-repository.test.ts`, `tests/supabase-repository.test.ts`

**Interfaces:**
- Consumes: `DiaryEntry`, `DiaryMood`, `ValidatedDiaryEntryPayload` from Task 1.
- Produces:
  - `CreateDiaryEntryInput` and `StorageRepository` methods: `listDiaryEntries()`, `getDiaryEntryById(id)`, `createDiaryEntry(input)`, `updateDiaryEntry(id, input)`, `deleteDiaryEntry(id)`, `isMediaUrlReferenced(url)`
  - Backward-compatible `diaryEntries: []` migration in `ensureSeededUsersAndUpgrade`
  - `withWriteLock` + transient `EPERM`/`EBUSY`/`EACCES` rename retry in `LocalStorageRepository`
  - `public.diary_entries` DDL + RLS in `supabase/schema.sql` and graceful missing-table fallback on read in `SupabaseStorageRepository`

- [ ] **Step 1: Write failing tests in `tests/local-repository.test.ts` and `tests/supabase-repository.test.ts`** covering legacy `local-db.json` upgrade without `diaryEntries`, diary CRUD sorted `entryDate DESC, createdAt DESC`, shared-image protection via `isMediaUrlReferenced`, concurrent `Promise.all` diary + activity writes + transient `EPERM` rename retry in `LocalStorageRepository`, and Supabase `diary_entries` CRUD + `42P01` missing-table read fallback.
- [ ] **Step 2: Run `npx vitest run tests/local-repository.test.ts tests/supabase-repository.test.ts` and verify RED failure.**
- [ ] **Step 3: Implement storage changes across `seed-data.ts`, `storage/types.ts`, `local-repository.ts`, `supabase-repository.ts`, and `supabase/schema.sql`.**
- [ ] **Step 4: Run `npx vitest run tests/local-repository.test.ts tests/supabase-repository.test.ts` and verify GREEN.**

---

### Task 3: Diary APIs, Member Image Upload APIs & Dynamic `/uploads/[filename]` Server Route

**Files:**
- Modify: `src/lib/admin-upload.ts`
- Create: `src/app/api/diary/route.ts`
- Create: `src/app/api/diary/[id]/route.ts`
- Create: `src/app/api/diary/upload-url/route.ts`
- Create: `src/app/api/diary/upload/route.ts`
- Create: `src/app/uploads/[filename]/route.ts`
- Test: `tests/api-routes.test.ts`

**Interfaces:**
- Consumes: `requireMemberApiSession` (Task 1), `StorageRepository` diary & `isMediaUrlReferenced` methods (Task 2).
- Produces:
  - `GET / POST /api/diary`, `PUT / DELETE /api/diary/[id]` (ownership enforced: `viewer` only own entries, `admin` all entries; records `'diary_saved'` / `'diary_deleted'` activity)
  - `POST /api/diary/upload-url`, `POST / DELETE /api/diary/upload` (`image`-only for member uploads; `DELETE` refuses with `403` when `isMediaUrlReferenced(url)` is true)
  - `GET / HEAD /uploads/[filename]` (`dynamic = 'force-dynamic'`, serves images/audio from `LOCAL_UPLOAD_DIR || public/uploads` with `Range` `206` support, `nosniff`, and path/extension validation)
  - Optional endpoint overrides on `uploadMediaFile(file, kind, options?)` and `cleanupUploadedUrl(url, cleanupEndpoint?)` in `src/lib/admin-upload.ts`

- [ ] **Step 1: Write failing tests in `tests/api-routes.test.ts`** covering dual-author `POST /api/diary`, `viewer` own-entry `PUT`/`DELETE` vs `403` on partner's entry, `admin` override `PUT`/`DELETE`, `viewer` image upload via `/api/diary/upload-url` + `/api/diary/upload` (rejecting `audio` and `viewer_step1`, blocking `DELETE /api/diary/upload` on referenced URLs), and `GET /uploads/[filename]` (`200` image, `206` audio `Range`, `400` traversal/forbidden `.svg`, `404` missing).
- [ ] **Step 2: Run `npx vitest run tests/api-routes.test.ts` and verify RED failure.**
- [ ] **Step 3: Implement `admin-upload.ts` options, `/api/diary/*` routes, and `/uploads/[filename]/route.ts`.**
- [ ] **Step 4: Run `npx vitest run tests/api-routes.test.ts` and verify GREEN.**

---

### Task 4: Story Top-Dock Tab Switcher, `DailyDiarySection` UI & `HomePage` Session Fallback

**Files:**
- Create: `src/lib/client-dropzone.ts`
- Create: `src/components/story/DailyDiarySection.tsx`
- Modify: `src/components/story/StoryExperience.tsx`
- Modify: `src/app/page.tsx`
- Test: `tests/story-components.test.tsx`

**Interfaces:**
- Consumes: `DiaryEntry`, `DiaryMood` (Task 1), `/api/diary/*` + `uploadMediaFile` with `/api/diary/upload-url` (Task 3).
- Produces:
  - Pure client `validateClientUploadFile` + `createFileDropHandlers` in `src/lib/client-dropzone.ts`
  - `<DailyDiarySection />` with composer (date, 7 mood pills, title, content, optional image pick / drag-drop / `Ctrl+V` paste / clear), date-grouped dual-author cards, author/mood/search filters, photo lightbox modal, 2-click delete, ownership-gated buttons, and guest sign-in prompt when `currentUser === null`
  - Floating dock tab switcher (`Hành trình kỷ niệm` | `Nhật ký mỗi ngày`) in `StoryExperience.tsx`

- [ ] **Step 1: Write failing tests in `tests/story-components.test.tsx`** covering switching between `Hành trình kỷ niệm` and `Nhật ký mỗi ngày`, `viewer` creating a diary entry with dropped/uploaded photo, ownership visibility (`viewer` sees edit/delete only on own entry while `admin` sees on all), mood/author filtering, guest read-only prompt when `currentUser === null`, and strict Dark Velvet & Crimson-Rose compliance.
- [ ] **Step 2: Run `npx vitest run tests/story-components.test.tsx` and verify RED failure.**
- [ ] **Step 3: Implement `src/lib/client-dropzone.ts`, `DailyDiarySection.tsx`, `StoryExperience.tsx` tab switcher, and `src/app/page.tsx` admin fallback when `viewerPasscodeEnabled` is `false`.**
- [ ] **Step 4: Run `npx vitest run tests/story-components.test.tsx` and verify GREEN.**

---

### Task 5: `/admin` Diary Management Tab & Activity Event Badges

**Files:**
- Modify: `src/components/admin/AdminDashboard.tsx`
- Test: `tests/admin-components.test.tsx`

**Interfaces:**
- Consumes: `AdminSiteData.diaryEntries`, `ActivityEventType` (`'diary_saved' | 'diary_deleted'`), `/api/diary/*`, `src/lib/client-dropzone.ts`.
- Produces:
  - `Nhật ký mỗi ngày (${diaryEntries.length})` tab in `AdminDashboard.tsx` with search/mood filter, create/edit form (with drag-and-drop + `Ctrl+V` image upload), and 2-click delete
  - `ACTIVITY_EVENT_META` badges for `diary_saved` and `diary_deleted`

- [ ] **Step 1: Write failing tests in `tests/admin-components.test.tsx`** covering the new `Nhật ký mỗi ngày` tab (create with dropped image, edit partner entry, 2-click delete, `diary_saved` / `diary_deleted` activity badges, and `assertDarkVelvetTheme` across all 6 tabs).
- [ ] **Step 2: Run `npx vitest run tests/admin-components.test.tsx` and verify RED failure.**
- [ ] **Step 3: Implement the new diary tab and activity badges in `src/components/admin/AdminDashboard.tsx` (reusing `src/lib/client-dropzone.ts`).**
- [ ] **Step 4: Run `npx vitest run tests/admin-components.test.tsx` and verify GREEN.**

---

### Task 6: Full Suite Verification, Production Build & Knowledge Graph Sync

**Files:**
- Modify: `README.md` (brief self-hosted server `LOCAL_DATA_DIR` / `LOCAL_UPLOAD_DIR` & single-process note)

- [ ] **Step 1: Run `npm run typecheck` (`tsc --noEmit`) and verify 0 errors.**
- [ ] **Step 2: Run `npm test` (`vitest run`) solo and verify 100% test files and test cases pass.**
- [ ] **Step 3: Run `npm run build` (`next build`) solo and verify production compilation of all routes including `/uploads/[filename]` and `/api/diary/*`.**
- [ ] **Step 4: Run `graphify.exe update .` to update `graphify-out/`.**
