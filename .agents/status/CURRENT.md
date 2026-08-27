# Issue #95 — self-contained Scene viewport framing

- Work identifier: `refactor/self-contained-scene-viewport` / Issue #95.
- Branch: `refactor/self-contained-scene-viewport`.
- Base: `origin/main` at `37415e7032cb7f0861037a09adc581aa6df9ff1c`.
- Substantive HEAD: `c3ad61bcde98aa2ea6f8bf4f4f56e808375bb192`.
- Objective: make Scene/Camera focus consume one explicit viewport framing contract and remove arbitrary camera-inspection pivots.

## Framing contract

- `resolveSceneViewportFraming()` is the shared resolver consumed by `SceneViewport`.
- Scene focus uses the scene-defined observer position/target.
- Camera focus uses the canonical transformed physical body pivot for canonical rig scenes, or the stable generic body midpoint otherwise.
- Inspection calibration now supplies observer position only; Mirror Shift translation is capability-driven and preserves observer-to-target offset.
- `SceneRenderer` receives resolved observer views and retains only OrbitControls state/saved-view mechanics; no framing-specific Mirror Shift or Understanding Camera Movements branches remain.

## Changed surfaces

- Framing contract/types: `src/render/sceneViewFraming.ts`, `src/types/scene.ts`.
- Viewport/renderer integration: `src/components/simulator/SceneViewport.tsx`, `src/render/SceneRenderer.tsx`.
- Scene migration: Mirror Shift, Architecture + Foreground inspection calibration, Understanding Camera Movements inspection calibration.
- Regression evidence: framing unit tests, Understanding static framing tests, saved-view renderer tests, Architecture + Foreground and Mirror Shift browser tests.
- Ground Glass, optics calculations, projection, RTT, GPU lifecycle, movement signs, task semantics, and scene geometry were intentionally unchanged.

## Validation

- Pass: `npm test` — 141 files / 1,344 tests.
- Pass: `npm run typecheck`.
- Pass: `npm run lint`.
- Pass: `npm run check:css`.
- Pass: `npm run build`.
- Pass: focused framing units — 37 tests across three files.
- Pass: isolated Architecture + Foreground browser regression.
- Pass: Mirror Shift browser suite, including neutral physical anchor and lateral follow.
- Pass: isolated saved-view focus browser regression.
- Pass: isolated Understanding Camera Movements canonical focus browser regression on the first post-change run.
- `npm run ci:local:e2e`: pre-E2E checks, unit/integration tests, build, and affected Architecture + Foreground/camera-movement suites passed until `camera-movement-public-controls.spec.ts` test 2 timed out at its existing layout-stability poll; the same test reproduced in isolation. Remaining E2E cases after that stop were not run.

## Remaining risks / reviewer focus

- Review that canonical-vs-generic pivot selection is capability-driven and that neutral canonical pivot translation preserves reset/saved-view offsets.
- Review the narrowed `CameraInspectionPlacement` schema and the exact Architecture + Foreground / Mirror Shift browser assertions.
- The unrelated camera-movement layout-stability E2E timeout remains unresolved; no framing assertion failed.
