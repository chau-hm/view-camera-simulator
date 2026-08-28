# Geometry viewport state boundary — focused refactor

- Work identifier: `refactor/self-contained-geometry-viewport`.
- Branch/base: `refactor/self-contained-geometry-viewport` from latest `origin/main` at `76a98aaee297493ee0dc35bec3fcc91d06dd9299`.
- Substantive HEAD: `741e284` (`refactor(geometry): decouple viewport state boundary`).
- Objective: make `GeometryViewport` a reusable explicit-input boundary with `SimulatorWorkspace` as the application-state adapter.

## Boundary decision

- Before: `GeometryViewport` read `setGeometryView` and `camera.focalLengthMm` from Zustand.
- After: `SimulatorWorkspace` passes required `geometryView`, `onGeometryViewChange`, and `focalLengthMm` props; GeometryViewport retains only presentation-local state (`svgSize`, fit mode, refs, and ResizeObserver).
- Geometry math, scene policy modules, visual behavior, Ground Glass, and SceneViewport are unchanged.

## Changes and evidence

- Changed files: `GeometryViewport.tsx`, `SimulatorWorkspace.tsx`, GeometryViewport unit suites, and `SimulatorWorkspace.test.tsx`.
- GeometryViewport contains no `useAppStore` or `appStore` references.
- Replaced StoreBacked unit harnesses with explicit controlled parents; Workspace integration verifies public view selection updates application state.
- Focused unit/integration: 5 files, 64 passed. Full unit/integration: 143 files, 1,362 passed. Typecheck, lint, CSS check, build, and diff check passed.
- Focused browser batch: 36 passed / 8 failed; failures were existing WebGL/diagnostic/layout-stability cases. `npm run ci:local:e2e` passed all standard checks and stopped at `mirror-shift-teaching-geometry.spec.ts:3`, waiting for `data-rtt-final-contentful="true"` at line 32; the spec's second test passed.
- Remote Actions: PR #103 is open. Run `33206467895` failed before tests during `npm ci` with `No matching version found for eslint-plugin-react-hooks@^6.8.0`; deploy was skipped. Run `33206506901` was queued at last check. No dependency or workflow changes were made.

## Reviewer focus

- Verify the explicit callback/focal-length contract at the Workspace boundary and that Focus Fundamentals reference geometry uses the injected focal length.
- Confirm no geometry formulas, scene policies, Ground Glass code, or visual behavior changed. Remaining risk is the documented WebGL timing/diagnostic baseline, especially the Geometry-only Mirror Shift RTT assertion.
