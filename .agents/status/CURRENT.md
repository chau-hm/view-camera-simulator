# Focused fix — Scope finite-focus film-depth semantics

- Branch: `fix/ground-glass-focus-film-plane-propagation`.
- Base: `origin/main` at `6dd36e5b2b60b36990afc70c3b463faba2a7de6b`.
- Transplanted predecessor: `0dc3f53` (`fix(optics): align swing focus
  diagnostics with physical DOF`).
- Scope: make projected optical-axis film-depth behavior explicit per scene
  while restoring historical isolated-movement semantics.

## Contract

- `rear-standard-z` is the default and preserves `film Z = -v`.
- `optical-axis-conjugate` explicitly selects `film Z = -v * lensNormal.z`;
  `imageDistanceMm` remains the physical thin-lens conjugate `v` in both modes.
- Shelf Swing, Table Tilt, Oblique Architecture, and Architecture + Foreground use
  `optical-axis-conjugate` because their calibrated Scheimpflug focus solution
  refocuses a fixed rear film plane against the swung/tilted optical axis.
- Understanding Camera Movements uses `rear-standard-z` so isolated front
  movements do not hide a rear-standard axial translation.
- Architecture + Foreground's guided Tilt + Focus lesson measures focus along
  the current tilted optical axis, so its resolved rear film depth must remain
  optically conjugate. At neutral tilt it remains numerically equivalent to
  `rear-standard-z`.

## Validation status

- Focused strategy/scene/renderer unit suites pass, including the Architecture
  + Foreground non-zero Tilt + Focus physical footprint and optical-axis
  conjugacy regression (16 files, 167 tests).
- Full unit/integration suite passes: 136 files, 1288 tests; typecheck, lint,
  CSS check, build, and diff check pass.
- Serial Chromium validation passes all six Architecture + Foreground cases and
  seven preserved-scene smoke cases (Shelf Swing, Table Tilt, Oblique
  Architecture, and Understanding Camera Movements). A broader 47-test matrix
  was resource-contended under parallel WebGL workers; its deterministic
  legacy failure remains the Architecture Rise omission of
  `data-rtt-focal-length-mm` in the Understanding SPA test.
- `npm run ci:local:e2e` reaches the known unrelated Focus Fundamentals
  owner/resource-generation diagnostic failure in
  `focus-fundamentals-selectable-focus.spec.ts:155`; affected PR tests pass
  independently.
- No renderer, physical CoC, blur calibration, task scoring, or PR 8F scene
  detail changes are in scope.
