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

- Pre-sync branch-local full Vitest: `164` files / `1601` tests passed.
- Pre-sync focused renderer/RTT Vitest: `15` files / `173` tests passed; public-control/workspace integration: `2` files / `31` tests passed.
- Typecheck, lint, CSS structure, and production build passed; the default build output directory was sandbox-protected, so the same build completed successfully with an isolated temporary `--outDir`.
- Focused Chromium: Oblique guided lesson and teaching geometry `2/2` passed; Ground Glass interaction `3/3` passed, including 4× pan/reset and unchanged RTT identity.
- Post-sync full validation and `CI=1 npm run ci:local:e2e` remain required before publication; update this section with exact post-sync totals and any clean-main baseline classification.

## Scope / known gaps

The branch contains the PR136 Ground Glass presentation correction plus the latest `origin/main` landing changes as base history. No PR11E files are part of the PR136 diff against current main. The remaining work is post-sync validation, final handoff/PR-body refresh, explicit safe publication, and current-head GitHub CI verification.
