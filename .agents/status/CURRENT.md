# PR #99 review-fix — explicit Ground Glass rendering boundary

- Work identifier: PR #99 review-fix, `refactor/self-contained-ground-glass-viewport`.
- Branch/base: `refactor/self-contained-ground-glass-viewport` from `origin/main` at `ea574cc97d002c0b5cc1057ca339bf99a5a746be`.
- Substantive HEAD: `a953a52` (`fix(render): complete Ground Glass explicit boundary`).
- Findings fixed: `SceneDefinition` and `focalLengthMm` are required at the reusable viewport/renderer/RTT boundary; stale scene-ID/implicit focal inputs are removed.

## Boundary

- `SimulatorWorkspace` is the only connected Ground Glass adapter: it maps default/Original/Current runtime diagnostics and preserves owner-aware store actions.
- `GroundGlassViewport`, `GroundGlassRenderer`, `GroundGlassRenderSurface`, and `GroundGlassRTT` consume explicit scene, physical focal length, presentation/calibration, runtime-info, and callback inputs; no direct Zustand imports remain in the pure stack.
- Explicit `runtimeInfo={null}` remains null. RTT publication continues as `(channel, info, ownerId)` with per-channel stale-owner protection.

## Evidence

- Pure RTT lifecycle tests now inject callback collectors; only dedicated adapter tests mount the small connected diagnostics wrapper. Comparison channels remain independent.
- Focused unit/integration: pass, 4 files / 56 tests. Full unit/integration: pass, 141 files / 1,351 tests. Typecheck, lint, CSS check, build, and `git diff --check`: pass.
- Focused browser suites: Ground Glass comparison 2/2, Focus Fundamentals 2/2, Ground Glass interaction 3/3, DOF stability/profiling 4/4, Mirror Shift lateral 2/2, Scene View Focus 5/5: pass. Understanding Camera Movements: 3/4; unchanged SPA-route diagnostic assertion misses `data-rtt-focal-length-mm` after the route drops `rttDiagnostics=1`.
- `npm run ci:local:e2e`: standard gates and preceding suites passed; stopped at unrelated `mirror-shift-teaching-geometry.spec.ts:32` after 30s waiting for `getByTestId("ground-glass-rtt")` while Geometry-only expansion intentionally unmounts the viewport.
- Remote Actions: known PR install failure resolving `eslint-plugin-react-hooks@^6.8.0`; no dependency/CI changes made.

## Reviewer focus

- Verify the Workspace diagnostics adapter is the sole Zustand bridge, required SceneDefinition/focal-length props are propagated through comparison and default paths, explicit null is preserved, and RTT resource-generation/owner cleanup remains instance-owned.
- Confirm no shader, optics, projection, CoC, scene geometry, or GPU ownership changes; remaining validation risk is the pre-existing unrelated E2E failure described above.
