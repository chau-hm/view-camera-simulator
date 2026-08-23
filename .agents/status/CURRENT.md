# Focused fix — Ground Glass focus-to-film-plane propagation

- Branch: `fix/ground-glass-focus-film-plane-propagation`.
- Starting reviewed head: `b26e6f3f3d74a308e35cfcf6f2d7222fa1955add`.
- Scope: align finite-focus Scheimpflug scene contracts/calibration with the
  physical film plane consumed by PR 8D Ground Glass rendering.

## Root cause and decision

- Shelf Swing and Table Tilt had no declarative finite-focus strategy, so their
  focus slider moved the teaching focus plane while the renderer kept the
  physical film at the focal-length baseline (`z = -150 mm`).
- The existing rear-standard strategy now resolves the film at the local Z
  depth of the on-axis ideal image (`-v * lensNormalLocal.z`), while retaining
  the thin-lens image distance `v` as the physical conjugate.
- Shelf Swing calibration now solves its coupled swing/focus/film geometry;
  Table Tilt uses the finite-focus conjugate formulas. The shared calibration
  also updates Oblique Architecture's existing physical Swing + Focus values.
- No renderer shader, blur scale, aperture, quality setting, task threshold,
  or legacy DOF path was changed.

## Evidence

- CPU regression covers Shelf front/middle/back: canonical solution collapses
  signed CoC and both footprint radii below `1e-7 mm`; focus at `2000 mm`
  remains above `0.4 mm` signed-CoC magnitude and `0.2 mm` radii.
- Public Shelf control (`-4°`, `3400 mm`) remains below `0.01 mm` footprint
  radius. Table Tilt canonical probes collapse below `1e-7 mm`.
- Focused Chromium Shelf regression: wrong `2000 mm` scores were `0/0/0`,
  RTT variance raw/final `4380.1152/4061.2862`; solved `3397.409 mm` scores
  were `98/98/96`, raw/final `4260.1044/4250.9609`. Raw RTT remained
  contentful through the control transition.

## Validation status

- Focused optics/renderer/scene unit suites pass: 19 files, 168 tests.
- Full unit suite passes: 135 files, 1281 tests; typecheck, lint, CSS check,
  build, and diff check pass.
- Chromium coverage passes for Shelf Swing, Table Tilt, Architecture +
  Foreground, Ground Glass stability, and all five Oblique Architecture cases.
- `npm run ci:local:e2e` reaches the known unrelated Focus Fundamentals
  owner/resource-generation diagnostic failure in
  `focus-fundamentals-selectable-focus.spec.ts:155`; affected PR tests pass
  independently.
- Commit, push, and PR #87 verification remain before delivery.
