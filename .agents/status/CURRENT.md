# PR #135 — Motion + Accessibility Polish / final review fix

- Objective: remove the landing-motion review defects and replace the application/browser icon family from the user-supplied source. Static landing design, copy, and section order remain unchanged.
- Branch/worktree: `feature/landing-redesign-motion` / `/Users/homan/repo/view-camera-landing-motion`.
- Main sync: latest `origin/main` `13c2ad9c46b473584162b2eb05c7cd65a113d61a` merged non-destructively in merge commit `eae158fbe621279771def78deb4d6d1b8620beef`. No rebase was performed.

## Since previous review

- `useLandingMotion` now uses `useLayoutEffect` so the enhancement marker is established before the capable-browser motion state can paint; static, reduced-motion, missing-`IntersectionObserver`, construction-failure, and Strict Mode cleanup paths remain safe.
- Final CTA artwork has an explicit revealed state with computed opacity `1`.
- Why It Matters header/cards have an explicit revealed state with computed transform `none` on desktop and mobile.
- Motion E2E coverage now checks computed CTA opacity, desktop/mobile Why transforms, and first root-mutation marker timing.
- `public/assets/icon-original.png` is the current user-selected 1254×1254 RGB PNG source with no alpha (`17551eb0a82ad1bd83f9b9d00266d2ebcad22c1f267f0435050c95c3a98e4608`, 1,456,412 bytes). Direct Lanczos-derived PNGs are present at canonical 1024×1024 (1,010,615 bytes), 16×16 (729), 32×32 (2,013), 128×128 (19,320), 180×180 (35,137), 192×192 (39,349), and 512×512 (255,046). `public/assets/favicon.ico` and the legacy `public/favicon.ico` are synchronized 7,467-byte ICO files containing 16/32/48px PNG entries.
- Browser/runtime verification covered the 28×28 AppBrand, successful base-relative icon requests, zero landing overflow, and a light/dark 16/28/32/64/128/180px contact sheet. The current source-derived silhouette remained recognizable at native small sizes.

## Validation

- Focused integration: 4 files, 16 tests passed.
- Focused Chromium Home/landing/responsive E2E: 17/17 passed against an isolated PR-worktree server, including reduced-motion/fallback behavior, first-paint evidence, CTA opacity, and desktop/mobile Why transform end states.
- `npm run ci:local`: passed CSS structure, lint, typecheck, 165 test files / 1,603 tests, and production build. Hosted push and pull-request CI pass for the current published head; deploy was skipped.
- `git diff --check`: passed. Production output contains the referenced PNG family and both favicon paths.

Unchanged: static landing design, copy/i18n, spacing/typography, landing production imagery, routes, simulator, optics, RTT, renderer, camera state, and scene definitions. No ImageGen work was performed; renderer-wide E2E remains out of scope. Independent PR review remains the merge-gate step.
