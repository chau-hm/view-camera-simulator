# PR #135 — Review fixes + app icon replacement

- Objective: remove the landing-motion review defects and replace the application/browser icon family from the user-supplied source. Static landing design, copy, and section order remain unchanged.
- Branch/worktree: `feature/landing-redesign-motion` / `/Users/homan/repo/view-camera-landing-motion`.
- Branch base/reference: PR 11D.1 base `8c8a211796ac81f20f560bc5076217251a4a13f2`; current `origin/main` at validation `13c2ad9c46b473584162b2eb05c7cd65a113d61a`. No rebase was performed for this focused review fix.

## Since previous review

- `useLandingMotion` now uses `useLayoutEffect` so the enhancement marker is established before the capable-browser motion state can paint; static, reduced-motion, missing-`IntersectionObserver`, construction-failure, and Strict Mode cleanup paths remain safe.
- Final CTA artwork has an explicit revealed state with computed opacity `1`.
- Why It Matters header/cards have an explicit revealed state with computed transform `none` on desktop and mobile.
- Motion E2E coverage now checks computed CTA opacity, desktop/mobile Why transforms, and first root-mutation marker timing.
- `public/assets/icon-original.png` is the unchanged 1254×1254 RGB PNG source (`17551eb0a82ad1bd83f9b9d00266d2ebcad22c1f267f0435050c95c3a98e4608`). Direct Lanczos-derived PNGs replace the canonical, 16, 32, 128, 180, 192, and 512px icon files. `public/assets/favicon.ico` and the legacy `public/favicon.ico` are synchronized real ICO files containing 16/32/48px PNG entries.
- Browser/runtime verification covered AppBrand at 28×28, successful base-relative icon requests, zero landing overflow, and a light/dark 16/32/64/128/180px contact sheet. The source silhouette remained recognizable at native small sizes.

## Validation

- Focused integration: 4 files, 16 tests passed.
- Focused Chromium Home/landing/responsive E2E: 17/17 passed, including reduced-motion/fallback behavior, first-paint evidence, CTA opacity, and desktop/mobile Why transform end states.
- `npm run ci:local`: passed CSS structure, lint, typecheck, 165 Vitest files / 1,600 tests, and production build.
- `git diff --check`: passed. Production output contains the referenced PNG family and both favicon paths.

Unchanged: static landing design, copy/i18n, spacing/typography, landing production imagery, routes, simulator, optics, RTT, renderer, camera state, and scene definitions. No ImageGen work was performed; renderer-wide E2E remains out of scope. Independent PR review remains the merge-gate step.
