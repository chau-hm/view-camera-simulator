# PR #98 — Scene viewport framing review-fix

- Work identifier: `refactor/self-contained-scene-viewport` / PR #98 review-fix round.
- Branch: `refactor/self-contained-scene-viewport`.
- Base: `origin/main` at `37415e7032cb7f0861037a09adc581aa6df9ff1c`.
- Substantive HEAD: `ddf95a8b63983b69884b2aa4d3633a8d9b9ab9fa`.
- Objective: complete the reusable Scene/Camera viewport framing contract without broadening PR #98.

## Framing contract decision

- Mirror Shift and Architecture + Foreground use the shared generic physical body anchor and reusable `0.72` world-unit inspection distance; stale absolute observer calibrations were removed.
- Focus Fundamentals declares the semantic `front` stable inspection anchor; `resolveStableCameraInspectionTarget()` no longer selects by public scene ID.
- Canonical rig scenes and SceneRenderer/SceneViewport boundaries remain unchanged from PR #98.

## Changed surfaces

- Framing/schema: `src/render/sceneViewFraming.ts`, `src/types/scene.ts`.
- Scene migration: Mirror Shift, Architecture + Foreground, Focus Fundamentals.
- Regression evidence: framing unit tests and Scene View Focus/Mirror Shift browser tests.

## Validation

- Pass: focused framing unit tests — 18 tests.
- Pass: focused browser regressions — `scene-view-focus.spec.ts` 5/5 and `mirror-shift-rig-lateral.spec.ts` 2/2.
- Pass: `npm test` — 141 files / 1,348 tests.
- Pass: `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, `git diff --check`.
- Incomplete: `npm run ci:local:e2e` passed its pre-E2E gates and earlier suites, then stopped at `focus-fundamentals-selectable-focus.spec.ts` test 1 with `Ground Glass RTT diagnostics were incomplete` while `ownerId`/`resourceGeneration` were unavailable; the same existing diagnostic failure reproduced in isolation. No RTT code was changed.

## Tests not run / remaining risks

- E2E files after the merge-gate stop were not run.
- Remote Actions remains subject to the existing `npm ci` resolution failure for `eslint-plugin-react-hooks@^6.8.0`; dependency management is outside this fix.

## Reviewer focus

- Verify the generic anchor-side configuration preserves Focus Fundamentals’ positive-side target and that ordinary scenes derive the `0.72` observer distance.
- Verify no framing semantics or named-scene selection moved back into SceneRenderer, and that the existing RTT diagnostic failure is unrelated.
