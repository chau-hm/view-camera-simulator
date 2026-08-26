# PR 8I — physical focus readout alignment

- Branch: `feature/physical-focus-readout-alignment`.
- Base: `origin/main` at `eec7df2c824b761977903a3478af42db0e6bec9a`.
- Scope: add physical film-space focus presentation metrics while preserving
  the legacy task/evaluator sharpness contract.

## Contract

- `computePhysicalBlurFootprint()` is the CPU reference for physical point and
  worst-sample patch metrics.
- Physical presentation sharpness is
  `clamp(1 - abs(signedCoCDiameterMm) / 0.1mm, 0, 1)`; invalid footprints fail
  closed to `0` / `soft`.
- Focus Assist, Ground Glass focus labels, and Table Tilt's closest-target
  presentation prefer the physical metrics, with a legacy-only fixture
  fallback.
- `target.sharpness` and `evaluateFocusTargets()` remain unchanged for task
  compatibility; no thresholds, calibration, quality, shader, or scene
  geometry changes were made.
- Point presentation uses the target point; patch presentation uses the worst
  physical sample. Raw RTT remains independent of diagnostics.

## Validation

- Focused physical readout, renderer, Ground Glass stability/pipeline, and
  scene optics tests pass. Full unit/integration suite: 141 files, 1,332 tests
  passed.
- Typecheck, lint, CSS check, and build pass.
- Bounded Chromium checks passed for Architecture + Foreground, Table Tilt,
  Shelf Swing, Oblique Architecture, and Architecture Rise.
- `npm run ci:local:e2e` stopped at the known unrelated Focus Fundamentals RTT
  diagnostic baseline (`focus-fundamentals-selectable-focus.spec.ts:155`,
  missing owner/resource-generation attributes); its responsive companion
  passed. No affected physical-readout test failed.
