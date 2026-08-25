# PR 8G — finite-focus real-image domain guard

- Branch: `fix/finite-focus-real-image-domain`.
- Base: `origin/main` at `8dd58dbfa714de4b1af52662036dd9b96a5f4080`.
- Scope: prevent real-image finite-focus controls from entering `U <= f`.

## Contract

- `minimumRealImageFiniteFocusDistanceMm()` returns the next configured focus
  control step strictly above the current focal length.
- Scene ranges, the Focus control selector, and `setFocusDistance()` share the
  same effective lower bound for `rear-standard-thin-lens` scenes whose focus
  distance is measured lens-to-focus-plane.
- Architecture Rise now declares its historical rear-standard-Z finite-focus
  strategy; the derive-time scene special case was removed.
- Direct invalid Architecture Rise `U <= f` input remains fail-closed through
  `Invalid finite-focus image distance` diagnostics. No virtual-image model or
  infinity reinterpretation was added.
- Focus Fundamentals and its separate front/rear focus contract remain outside
  this guard.

## Validation

- Focused real-image domain, scene-range, store, selector, and optics tests pass.
- Full unit/integration suite: 139 files, 1,311 tests passed.
- Typecheck, lint, CSS check, build, and diff check pass.
- Table Tilt Chromium suite: 18 passed. Architecture Rise guided checks: 2
  passed. The full local E2E workflow stopped at the known Focus Fundamentals
  baseline diagnostic failure (`focus-fundamentals-selectable-focus.spec.ts:155`,
  incomplete RTT owner/resource diagnostics); its second test passed.
- No DOF, shader, calibration, scene-detail, profiler, or PR 8F changes are
  included.
