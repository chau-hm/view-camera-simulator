# PR136 — Ground Glass focus inspection fidelity

## Branch / base

- Branch: `fix/ground-glass-focus-inspection-fidelity`
- Worktree: `/Users/homan/repo/view-camera-ground-glass-focus-inspection-fidelity`
- Reviewed starting head: `42bb61dc4ee95e3b8d40d144f68adadb24c50789`
- Presentation correction commit: `23f1a8d`
- Base after sync: `origin/main` at `8d8d378bcaa92b76ae1372555f480e2de00f158a` (PR11E merged)

## Objective and correction

PR136 makes the Ground Glass focus inspection a true presentation-only 4× loupe. The reviewed implementation had incorrectly routed `inspectionMagnification` through physical CoC conversion, blur footprints, storage normalization, shader uniforms, RTT dimensions, and diagnostics. The correction removes that coupling: physical CoC/DOF, RTT source resolution, learner scores, thresholds, and calibration remain unchanged; the completed RTT image plus transformed overlays are scaled together by `GroundGlassStage` at 4×, while fixed overlays remain outside the transformed image layer.

## Runtime contract

- Physical path: physical CoC in millimetres → film-mm-to-RTT-pixel conversion → physical source blur/storage/gather.
- Presentation path: `GroundGlassStage` owns the 4× focus loupe, anchored pan, keyboard/pointer interaction, reset, and accessibility state.
- RTT dimensions, resource generation, render sanity key, profiler identity, and raw RTT bypass are loupe-independent.
- The active indicator is Stage-owned and localized as `Focus loupe · 4×` / `對焦放大鏡 · 4×`; the inactive control exposes the same localized 4× action. The outer Ground Glass expand control remains separate.
- No optics, scene geometry, calibration, CoC threshold, task criterion, or aperture-policy changes were introduced.

## Evidence

- CPU and GLSL blur/footprint helpers no longer accept or apply inspection magnification; physical storage maximums use only the source render cap.
- RTT unit coverage proves loupe toggles do not change source dimensions, resize resources, or physical sanity identity.
- Stage unit coverage proves 4× anchoring, pan bounds, reset, keyboard/pointer behavior, and fixed-overlay separation.
- Public Oblique Tabletop checks exercise neutral, guided, teaching-geometry, and Ground Glass interaction routes with the loupe at 4×.

## Validation

- Post-sync full Vitest: `165` files / `1605` tests passed.
- Post-sync typecheck, lint, CSS structure, and production build passed.
- `git diff --check` passed before final handoff updates.
- Focused Ground Glass/renderer/RTT validation: `23` files / `216` tests passed.
- Focused Chromium on the merged branch: `5/5` passed across Oblique teaching geometry, Oblique guided lesson, Ground Glass Architecture Rise reset/off-center flows, and Focus Fundamentals loupe/reset. The Ground Glass loupe remained presentation-only and the RTT identity stayed unchanged.
- `CI=1 npm run ci:local:e2e` passed CSS, lint, typecheck, unit/integration (`165` / `1605`), and build, then stopped at `src/tests/e2e/mirror-shift-teaching-geometry.spec.ts` test `Mirror Shift top-view geometry follows canonical A/B/C state relationships` because `ground-glass-rtt` disappeared after the Front Shift update. The exact two-test spec was rerun on clean latest `origin/main` `8d8d378bcaa92b76ae1372555f480e2de00f158a` with the same result: one pass and the same failure. This is a current-main baseline failure, not a PR136 failure.

## Scope / known gaps

The branch contains the PR136 Ground Glass presentation correction plus the latest `origin/main` landing changes as base history. No PR11E files are part of the PR136 diff against current main. The physical CoC/DOF/RTT path remains unchanged; the 4× loupe is owned by `GroundGlassStage`. Full local E2E is not green because of the reproduced unrelated Mirror Shift baseline failure above; no test was weakened or skipped.
