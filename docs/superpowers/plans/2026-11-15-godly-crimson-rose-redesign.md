# Godly Dark Velvet & Crimson-Rose UI Redesign Implementation Plan

**Goal:** Thiết kế lại toàn bộ giao diện `/` theo phong cách **Godly (`godly.website`)** (Dark Velvet nền nhung tối ánh rượu vang `#080306`/`#12070c`, tiêu đề editorial cỡ lớn, viền mảnh `1px`, Floating Pill Dock, Asymmetric Bento Showcase Grid `#01..`, Cinema Lightbox, Ruby Wax-Seal Envelope) và reskin `/admin/login` + 5 tab `/admin` đồng bộ 100% bảng màu **Đỏ & Hồng** (xoá bỏ hoàn toàn mọi tông xanh/sky/indigo/tím/lavender trong UI & mẫu SVG), giữ nguyên toàn bộ logic auth 2 bước + OTP, tracking hoạt động và khả năng kiểm thử.

**Spec:** [`docs/superpowers/specs/2026-11-15-godly-crimson-rose-redesign-design.md`](../specs/2026-11-15-godly-crimson-rose-redesign-design.md)

**Global Constraints:**
- Không dùng xanh dương (`sky-*`, `blue-*`), chàm (`indigo-*`), tím (`violet-*`, `purple-*`) hoặc mã hex xanh/tím nào trong UI hoặc `public/samples/memory-*.svg`.
- Bảo toàn toàn bộ ARIA labels, test selectors, API calls, guard bảo mật, touch targets `>= 36–40px`, `text-base sm:text-sm` chống iOS zoom, và hỗ trợ `prefers-reduced-motion`.
- Đặt nền tối rõ chữ cho mọi `<option>` trong `<select>` của `/admin`.

---

### Task A: Theme Tokens, Sample SVGs, Auth Gate, Pixel Heart, Love Effects & Godly Bento `/` UI (TDD)
- Update `tests/story-components.test.tsx` FIRST (asserting `#01`/`#02` Bento badges, `lg:col-span-7`/`lg:col-span-5` layout, `Bento` <-> `Dòng chảy` mode switcher, and pure crimson/rose palette on `PixelHeartIntro` & `LoveEffectsLayer`).
- Modify `tailwind.config.ts`, `src/app/globals.css`, `src/app/layout.tsx` (Dark Velvet tokens, `.godly-velvet-bg`, frosted dark glass cards with `1px` rose/crimson hairline borders, crimson-rose `.love-shimmer` & `.love-pulse-glow`, preserve `@fontsource` + `@layer components`).
- Restyle `public/samples/memory-1.svg` .. `memory-4.svg` to Dark Velvet & Crimson-Rose.
- Update `src/components/story/PixelHeartIntro.tsx`, `LoveEffectsLayer.tsx`, `ViewerPasscodeGate.tsx`, `StoryExperience.tsx`, `AudioToggle.tsx`, `HeroSection.tsx`, `MemoryTimeline.tsx`, `PhotoLightbox.tsx`, `EnvelopeLetter.tsx`.
- Verify `npm test && npx next typegen && npm run typecheck` -> Commit -> Task A Reviewer (`research`).

### Task B: `/admin/login` & 5-Tab `/admin` Dark Velvet & Crimson-Rose Reskin + Docs (TDD)
- Update `tests/admin-components.test.tsx` FIRST (asserting dark-mode `<option>` styling + absence of `indigo-`/`sky-` classes alongside all 14 existing Admin tests).
- Modify `src/components/admin/AdminLoginForm.tsx`, `src/components/admin/AdminDashboard.tsx`, `README.md`.
- Keep exact 5-tab layout, responsive `min-w-0` grids, `min-h-[40px]` tabs, floating toast, self/last-admin guards, and Vietnam-timezone activity feed intact while reskinning every surface, border, text color, input, and badge to Dark Velvet & Crimson-Rose.
- Verify `npm test && npx next typegen && npm run typecheck` -> Commit -> Task B Reviewer (`research`).

### Task C: Parallel Final Audit (Palette/Contrast/Godly Craft + 3-Viewport Responsive/Accessibility), Cleanup & Build
- Run **2 parallel `research` QA subagents** (`Palette, Contrast & Godly Craft Auditor` + `Desktop/Tablet/Mobile Responsive & Accessibility Auditor`).
- Fix any findings cleanly and commit.
- Clean transient files, confirm clean `git status --short`, run final `npx next typegen && npm run typecheck && npm test && npm run build`.
