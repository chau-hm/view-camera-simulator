# Scene Catalog Visual Harmonization

- Objective: align `/scenes` with the merged landing visual language while preserving catalog structure, routes, copy, thumbnails, and simulator boundaries.
- Base: `origin/main` at `8d8d378bcaa92b76ae1372555f480e2de00f158a` (PR #135 contained).
- Worktree / branch: `/Users/homan/repo/view-camera-scene-catalog-style` / `feature/scene-catalog-visual-harmonization`.
- Scope: `ScenesPage` now uses `site-shell--scenes` and `scenes-page-intro`; no `InfoCard` or shared-card refactor.
- SceneCard: scoped navy surface, cool border and edge light, 3:2 framed thumbnails, compact title/description hierarchy, metadata pills, bottom-aligned actions, restrained hover, and neutral non-actionable in-development status.
- DesktopExperienceNotice: compact elevated technical advisory with icon well, restrained cyan-gray border, and preserved role/label, suitability logic, and copy.
- Responsive: horizontal cards on wide desktop; stacked cards below 880px; full-width stacked actions and 3:2 thumbnails on narrow mobile with no horizontal overflow.
- Accessibility: one H1, H2 card titles, explicit keyboard links, non-interactive metadata, preserved notice semantics, and non-actionable in-development status covered by integration tests.
- Browser evidence: Chromium inspection at `1440×900`, `1288×904`, `1024×800`, `768×900`, `390×844`; English at all sizes; zh-HK at `1288×904` and `390×844`; every current public card inspected in full-page passes.
- Validation: Scenes integration `5/5`; marketing responsive Chromium `4/4`; `npm run ci:local` passed CSS, lint, typecheck, `165` test files / `1604` tests, and production build; `git diff --check` passed.
- Deferred: Simulator Shared Visual Skin.
