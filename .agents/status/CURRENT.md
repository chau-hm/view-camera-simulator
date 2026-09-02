# Oblique Tabletop foundation (PR 10A)

- Branch: `feature/oblique-tabletop-foundation`; baseline: `origin/main` `ae9b5c33358449d18c65b0282bd9fce747dd512c`.
- Objective: add the public, free-only Oblique Tabletop scene as the neutral foundation for later compound Tilt + Swing work.
- Scope: canonical millimetre geometry, 3D/RTT shared subject factory, scene/catalog/i18n registration, fixed f/11 neutral preset, focus-only public controls, and ImageGen raster catalog card. No guided task or Tilt/Swing solution is included.
- Geometry: a 2800 × 3800 mm tabletop at 9° X / -8° Y with near-left, middle, and far-right focus markers; the middle marker supplies the rounded neutral focus distance and the tabletop surface supplies the composition target/bounds.
- Neutral problem: the existing physical thin-lens focus/sharpness pipeline receives marker/sample world positions spanning depth in both tabletop directions; at neutral focus and f/11 the middle region is sharper while near/far regions are measurably soft.
- Validation: `npm test` (154 files / 1,499 tests), `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, `git diff --check`, and the focused Chromium `scene-switching.spec.ts` smoke (1 passed).
- Remaining handoff: PR 10B/10C can add compound movement calibration and guided tasks against the registered tabletop plane; those behaviors are intentionally absent here.
