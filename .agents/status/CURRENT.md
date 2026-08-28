# Ground Glass rendering boundary — PR #99

- Work identifier: `refactor/self-contained-ground-glass-viewport` / PR #99.
- Branch: `refactor/self-contained-ground-glass-viewport`.
- Base: `origin/main` at `ea574cc97d002c0b5cc1057ca339bf99a5a746be` (PR #98 present).
- Substantive HEAD: `93e7e4356ddbc7684d65cf748ecbc06bb4ade25c`.
- Objective: make the Ground Glass viewport/rendering stack explicit-input and preserve RTT optical/GPU behavior.

## Boundary decision

- `SimulatorWorkspace` resolves scene, camera/optics, assist, effective calibration, and presentation inputs; `GroundGlassViewport` forwards them.
- `GroundGlassRenderer` and `GroundGlassRTT` no longer acquire Zustand state or resolve application scenes. `GroundGlassRTT` publishes owner-aware runtime info through an explicit callback.
- `GroundGlassRenderSurface` remains the small application-connected diagnostics adapter, preserving per-channel store actions and stale-owner cleanup.

## Changed surfaces

- Viewport/application inputs: `SimulatorWorkspace.tsx`, `GroundGlassViewport.tsx`.
- Renderer/RTT contract: `GroundGlassRenderer.tsx`, `GroundGlassRenderSurface.tsx`, `GroundGlassRTT.tsx`, `groundGlassRttDimensions.ts`.
- Evidence: `GroundGlassRTT.test.ts`, `groundGlassRenderer.test.tsx`, `cameraMovementPublicControls.test.tsx`, `focus-fundamentals-selectable-focus.spec.ts`.

## Validation

- Pass: focused unit/integration — 3 files / 48 tests.
- Pass: full unit/integration — 141 files / 1,349 tests; typecheck; lint; CSS check; build; `git diff --check`.
- Pass: focused browser coverage — Ground Glass comparison 2/2, Mirror Shift lateral 2/2, Scene View Focus 5/5 after isolated interaction rerun, Focus Fundamentals lifecycle 2/2, DOF stability 2/2, profiling 2/2, Ground Glass interaction 3/3.
- Incomplete: `npm run ci:local:e2e` passed all standard gates and stopped at unchanged `mirror-shift-teaching-geometry.spec.ts:32`, which expects Ground Glass diagnostics while Geometry-only expansion intentionally unmounts that viewport; baseline `origin/main` has the same assertion.
- Remote Actions: PR #99 CI has a failed `npm ci` job for unresolved `eslint-plugin-react-hooks@^6.8.0`; no code checks ran in that job. Dependency changes are out of scope.

## Reviewer focus

- Verify application inputs are resolved once above the renderer and that the RTT callback preserves default/comparison channel identity, mount/update/unmount cleanup, and resource-generation stability.
- Confirm scene registry/subject-specific rendering branches and physical CoC/post-processing order remain unchanged; no optics, shader, projection, or GPU-lifecycle changes were intended.
