# Love Memories & Love Letter Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a modern, light-toned (`B · Trắng Tinh Khôi & Kính Mờ Pastel`), mobile-first love memories storytelling website (`/`) with an authenticated online admin dashboard (`/admin`) backed by Supabase Cloud (Postgres + Storage via Signed Upload URLs) and automatic Local Fallback persistence for instant local testing.

**Architecture:** A Next.js 15 (App Router) + TypeScript full-stack application combining animated pastel glassmorphic storytelling components (Hero + days counter, vertical memory photo timeline + lightbox, interactive sealed love-letter envelope, and gentle audio player) with protected `/admin` management APIs. A `StorageRepository` abstraction seamlessly targets Supabase Postgres/Storage in cloud deployments and falls back to atomic `data/local-db.json` + `public/uploads/` locally.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS v3, Framer Motion, Lucide React, Supabase (`@supabase/supabase-js`), Fontsource (`@fontsource-variable/plus-jakarta-sans`, `@fontsource/cormorant-garamond`), Vitest + Testing Library (`happy-dom`).

**Spec:** `/Users/scott/Documents/NY/docs/superpowers/specs/2026-11-15-love-memories-website-design.md`

## Global Constraints

- Full Vietnamese UI across both the public story page (`/`) and admin console (`/admin`, `/admin/login`), using offline-bundled Vietnamese-ready fonts (`Plus Jakarta Sans Variable` + `Cormorant Garamond`).
- Aesthetic strictly matches `B · Trắng Tinh Khôi & Kính Mờ Pastel`: `#F8FAFC → #FDF2F8 → #EFF6FF` luminous pastel background, frosted glass cards (`rgba(255,255,255,0.76)` + `backdrop-filter: blur(14px)`), rose-pink (`#EC4899` / `#DB2777`) & soft indigo (`#6366F1`) accents, no tacky neon/dark clutter.
- Mobile-first responsive design, honoring `prefers-reduced-motion` and preserving natural portrait/landscape photo aspect ratios without cropping faces.
- No unexpected autoplay shock: audio starts softly only on explicit user interaction (`"Bắt đầu hành trình"` or `AudioToggle`).
- Dual-mode persistence (`Supabase Cloud` via Signed Upload URLs for `<= 10MB` images and `<= 15MB` audio to bypass Vercel's 4.5 MB request body limit; `Local Fallback` when Supabase env vars are absent).
- Strict TDD for every business logic module, repository, API route, and interactive UI component.

## Review Focus

1. **Viewer Passcode Secrecy:** Public data/responses and admin GET responses must never expose `viewerPasscode` or `viewerPasscodeHash` plaintext to the browser; only boolean status flags (`viewerPasscodeEnabled`, `hasPasscode`) are serialized.
2. **Upload Security & Animated GIF Preservation:** Reject dangerous upload MIME types (`image/svg+xml`, `text/html`, executables); strictly allow `JPG/PNG/WebP/GIF/AVIF` (`<= 10MB`) and `MP3/M4A/WAV` (`<= 15MB`); client-side compression skips `GIF` so animations remain intact.
3. **Storage Cleanup & Path Traversal Safety:** Deleting/replacing memories or audio never deletes `/samples/*` seed assets and rejects `..` path traversal; failed DB saves trigger orphan upload cleanup.
4. **Timezone-Safe Days Together Counter:** `calculateDaysTogether` computes whole calendar days in `Asia/Ho_Chi_Minh` (`UTC+7`) even around midnight (`00:30+07:00`) and clamps future dates to `0`.
5. **Empty Timeline Resilience:** Deleting all memories (`memories = []`) renders a gentle Vietnamese empty-state message without breaking timeline or lightbox controls.

---

### Task 1: Project Scaffold, Supabase SQL Schema & Sample Assets

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `vitest.config.ts`, `tests/setup.ts`
- Create: `.env.example`, `supabase/schema.sql`, `scripts/generate-ambient-wav.mjs`
- Create: `public/uploads/.gitkeep`, `public/samples/memory-1.svg` .. `memory-4.svg`, `public/samples/gentle-memories.wav`

**Interfaces:**
- Produces: Next.js + Tailwind + Vitest project environment, SQL schema for `site_settings`, `memories`, and `love-memories` bucket, sample assets under `/samples/*`.

- [ ] **Step 1:** Create config files, `.env.example`, `supabase/schema.sql`, sample SVGs, and `scripts/generate-ambient-wav.mjs`.
- [ ] **Step 2:** Run `npm install` and `node scripts/generate-ambient-wav.mjs`.
- [ ] **Step 3:** Verify `public/samples/gentle-memories.wav` exists and `node_modules` installed cleanly.
- [ ] **Step 4:** Commit scaffold files on `feat/love-memories-website`.

---

### Task 2: Domain Types, Vietnamese Date/Days Counter, Auth & Upload Validation

**Files:**
- Create: `src/types/memories.ts`, `src/lib/date-utils.ts`, `src/lib/auth.ts`, `src/lib/validation.ts`, `src/lib/image-compress.ts`
- Test: `tests/date-utils.test.ts`, `tests/auth-and-validation.test.ts`

**Interfaces:**
- Produces:
  - `SiteSettings`, `PublicSiteSettings`, `MemoryItem`, `PublicSiteData`, `AdminSiteData`
  - `calculateDaysTogether(startDate: string, now?: Date): number`
  - `formatMemoryDateVi(dateStr: string): string`, `formatMemoryLongDateVi(dateStr: string): string`
  - `createAdminSessionToken(ttlSeconds?: number): string`, `verifyAdminSessionToken(token?: string | null): boolean`
  - `createViewerSessionToken(ttlSeconds?: number): string`, `verifyViewerSessionToken(token?: string | null): boolean`
  - `hashPasscode(pin: string): string`, `verifyPasscode(pin: string, storedHash: string): boolean`
  - `validateUploadRequest(input: { kind: 'image' | 'audio'; mimeType: string; size: number; fileName: string }): { valid: true } | { valid: false; error: string }`
  - `sanitizeStorageFileName(fileName: string): string`
  - `compressImageIfNeeded(file: File): Promise<File>`

- [ ] **Step 1 (RED):** Write `tests/date-utils.test.ts` and `tests/auth-and-validation.test.ts`.
- [ ] **Step 2:** Run `npx vitest run tests/date-utils.test.ts tests/auth-and-validation.test.ts` → verify FAIL.
- [ ] **Step 3 (GREEN):** Implement `src/types/memories.ts`, `src/lib/date-utils.ts`, `src/lib/auth.ts`, `src/lib/validation.ts`, `src/lib/image-compress.ts`.
- [ ] **Step 4:** Run `npx vitest run` → verify PASS.
- [ ] **Step 5:** Commit Task 2.

---

### Task 3: Dual-Mode Storage Repository (Local Fallback & Supabase Cloud)

**Files:**
- Create: `src/lib/seed-data.ts`, `src/lib/storage/types.ts`, `src/lib/storage/local-repository.ts`, `src/lib/storage/supabase-repository.ts`, `src/lib/storage/index.ts`
- Test: `tests/local-repository.test.ts`

**Interfaces:**
- Consumes: `src/types/memories.ts`, `src/lib/auth.ts`, `src/lib/validation.ts`
- Produces: `StorageRepository` (`getPublicData`, `getAdminData`, `verifyViewerPasscode`, `updateSettings`, `createMemory`, `updateMemory`, `deleteMemory`, `reorderMemories`, `createSignedUploadUrl`, `saveLocalUpload`, `deleteStoredFileByUrl`), `getStorageRepository()`, `getStorageStatus()`.

- [ ] **Step 1 (RED):** Write `tests/local-repository.test.ts`.
- [ ] **Step 2:** Run `npx vitest run tests/local-repository.test.ts` → verify FAIL.
- [ ] **Step 3 (GREEN):** Implement `seed-data.ts` and `src/lib/storage/*`.
- [ ] **Step 4:** Run `npx vitest run` → verify PASS.
- [ ] **Step 5:** Commit Task 3.

---

### Task 4: Next.js API Routes (Auth, CRUD/Reorder, Signed/Local Upload & Passcode Gate)

**Files:**
- Create: `src/app/api/admin/login/route.ts`, `src/app/api/admin/logout/route.ts`, `src/app/api/admin/settings/route.ts`
- Create: `src/app/api/admin/memories/route.ts`, `src/app/api/admin/memories/reorder/route.ts`, `src/app/api/admin/memories/[id]/route.ts`
- Create: `src/app/api/admin/upload-url/route.ts`, `src/app/api/admin/upload/route.ts`, `src/app/api/viewer/unlock/route.ts`
- Test: `tests/api-routes.test.ts`

**Interfaces:**
- Consumes: `src/lib/auth.ts`, `src/lib/validation.ts`, `src/lib/storage/index.ts`
- Produces: Authenticated REST handlers returning clean Vietnamese JSON errors (`400`/`401`/`404`/`500`) and `httpOnly` session cookies.

- [ ] **Step 1 (RED):** Write `tests/api-routes.test.ts`.
- [ ] **Step 2:** Run `npx vitest run tests/api-routes.test.ts` → verify FAIL.
- [ ] **Step 3 (GREEN):** Implement all API routes in `src/app/api/*`.
- [ ] **Step 4:** Run `npx vitest run` → verify PASS.
- [ ] **Step 5:** Commit Task 4.

---

### Task 5: Airy Glass Minimal (`B`) Frontend, Vietnamese `/admin` Dashboard & README

**Files:**
- Create: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`
- Create: `src/components/story/HeroSection.tsx`, `AudioToggle.tsx`, `MemoryTimeline.tsx`, `PhotoLightbox.tsx`, `EnvelopeLetter.tsx`, `ViewerPasscodeGate.tsx`, `StoryExperience.tsx`
- Create: `src/app/admin/login/page.tsx`, `src/app/admin/page.tsx`, `src/components/admin/AdminLoginForm.tsx`, `AdminDashboard.tsx`
- Create: `README.md`
- Test: `tests/story-components.test.tsx`

**Interfaces:**
- Consumes: `PublicSiteData`, `AdminSiteData`, `MemoryItem`, `/api/admin/*`, `/api/viewer/unlock`, `calculateDaysTogether`, `compressImageIfNeeded`.
- Produces: Full public storytelling page `/`, passcode gate, and admin dashboard `/admin` + `/admin/login`.

- [ ] **Step 1 (RED):** Write `tests/story-components.test.tsx`.
- [ ] **Step 2:** Run `npx vitest run tests/story-components.test.tsx` → verify FAIL.
- [ ] **Step 3 (GREEN):** Implement styles, layout, story components, admin pages, and `README.md`.
- [ ] **Step 4:** Run `npx vitest run` → verify PASS.
- [ ] **Step 5:** Commit Task 5.

---

### Task 6: Full Verification, Whole-Branch Code Review & Live Server Startup

- [ ] **Step 1:** Run `npm run typecheck` → expect exit `0`.
- [ ] **Step 2:** Run `npm test` → expect all tests pass (`0` failures).
- [ ] **Step 3:** Run `npm run build` → expect exit `0`.
- [ ] **Step 4:** Dispatch fresh `research` subagent (`Whole-Branch Code Reviewer`) to review `git diff main..HEAD` against spec and Review Focus.
- [ ] **Step 5:** Fix any Critical/Important findings via RED→GREEN TDD and re-verify full suite + build.
- [ ] **Step 6:** Start `npm run dev` daemon and confirm listening URL from startup log.
