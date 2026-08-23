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
- Shelf Swing, Table Tilt, and Oblique Architecture use
  `optical-axis-conjugate` because their calibrated Scheimpflug focus solution
  refocuses a fixed rear film plane against the swung/tilted optical axis.
- Understanding Camera Movements and Architecture + Foreground use
  `rear-standard-z` so isolated front movements do not hide a rear-standard
  axial translation. Architecture + Foreground remains numerically equivalent
  at its neutral focus state.

## Validation status

- Focused strategy/scene/renderer unit suites pass: 18 files, 181 tests.
- Full unit/integration suite passes: 136 files, 1287 tests; typecheck, lint,
  CSS check, build, and diff check pass.
- Chromium passes Shelf Swing (2), Table Tilt (4), Oblique Architecture (3),
  and Architecture + Foreground (2). Understanding Camera Movements passes
  its neutral/tilt/reset tests (3); its existing SPA legacy diagnostic test
  still fails because Architecture Rise omits `data-rtt-focal-length-mm`.
- `npm run ci:local:e2e` reaches the known unrelated Focus Fundamentals
  owner/resource-generation diagnostic failure in
  `focus-fundamentals-selectable-focus.spec.ts:155`; affected PR tests pass
  independently.
- No renderer, physical CoC, blur calibration, task scoring, or PR 8F scene
  detail changes are in scope.
