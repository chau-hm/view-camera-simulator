# PR 8H — physical Ground Glass blur scale

- Branch: `feature/physical-ground-glass-blur-scale`.
- Base: `origin/main` at `fd019512db7a5013f92c6c09976f76f4865cceac`.
- Scope: remove scene-specific physical blur amplification while preserving
  the existing pixel-radius cap and Shelf Swing `planeMode`.

## Contract

- The active RTT path keeps physical CoC and footprint radii in millimetres
  until film-mm to render-pixel conversion.
- `displayBlurScale` is no longer part of Ground Glass visual settings,
  uniforms, storage-range resolution, CPU Ground Glass diagnostics, or GLSL.
- `maximumBlurRadiusPx` remains a strict post-conversion cap.
- Half-float and RGBA8 footprint storage retain physical millimetre semantics;
  the existing pairwise byte scaling and neutral signed-CoC mapping are
  unchanged.
- Shelf Swing `planeMode: "derived-planes"` is preserved.

## Validation

- Focused physical-scale, footprint-coordinate, CoC-storage, shader, visual
  settings, stability, Table Tilt, Shelf Swing, Oblique Architecture, and
  physical-footprint tests pass, including aperture monotonicity and strict
  pixel-cap coverage.
- Full unit/integration suite: 140 files, 1,321 tests passed. Typecheck, lint,
  CSS check, build, and diff check pass.
- Bounded Chromium checks passed for Architecture Rise, Table Tilt, Shelf
  Swing, Architecture + Foreground, and Oblique Architecture. The full local
  E2E workflow stopped at the known Focus Fundamentals baseline diagnostic
  failure (`focus-fundamentals-selectable-focus.spec.ts:155`, incomplete RTT
  owner/resource diagnostics); its responsive companion test passed.
- No optics equations, scene geometry, task scoring, quality profiles,
  profiler, or PR 8F detail files are changed.
