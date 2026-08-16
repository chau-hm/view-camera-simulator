# Current Work Handoff

## Work

PR / work identifier: PR 6B — Oblique Architecture — Rise Composition
Branch: `feature/oblique-architecture-rise`
Base: `main` (`origin/main` @ `dd67e5a` when this branch was created)

## Objective

Turn the Oblique Architecture before-state into a guided composition slice:
Front Rise is the only solving movement, the learner frames the full building
while keeping the camera level, and the oblique façade sharpness problem stays
intentionally unresolved for PR 6C.

## Current geometry and calibration

- Building depth: `z = 9600..16800 mm`
- Ground: `z = 8200..19000 mm`
- Camera placement:
  - position = `(-6200, 3200, -1200) mm`
  - target = `(1800, 1000, 13000) mm`
- Canonical focus: `13200 mm` (`canonicalFocusDistanceMm` in the current implementation).
- Reachable calibrated Front Rise: `20 mm`
- Public Front Rise range: `0..40 mm`
- Public Front Rise step: `1 mm`

Front Rise uses the existing canonical camera state and single-movement
capability path: `available: ["frontRiseMm"]`, default `frontRiseMm`.
The front standard moves through the existing optics/render pipeline; the rear
standard, subject geometry, viewpoint, focus, and aperture remain unchanged.

## Guided task

- Task ID: `oblique-rise-01`
- Learner task: **Frame the Building**
- Allowed movement: Front Rise only; Focus, Aperture, Tilt, Swing, and rear
  movements are unavailable or fixed.
- Observable criteria:
  - projected building-top corners are inside the usable Ground Glass frame;
  - projected building-base corners remain inside the usable frame;
  - camera/rear-standard level state remains neutral;
  - Front Rise is used, without requiring an exact slider value.

The regression coverage proves:

- `0 mm Rise` → roof remains cropped and the guided task is incomplete.
- `20 mm Rise` → required roof corners fit, required base corners remain visible,
  the rear standard remains unchanged, and the guided task passes.
- `19 mm Rise` → also passes when the observable composition remains valid.
- The solved Rise state still has non-uniform near/middle/far façade sharpness.

## Public catalog state

- Public title: `Oblique Architecture`
- zh-HK title: `斜向建築攝影`
- Public scene ordering: Oblique Architecture is the final public scene.
- Thumbnail: `public/assets/oblique-architecture.png`
- Modes: Free Practice and Guided Task (`oblique-rise-01`).

## Since PR 6A

- Enabled the existing public Front Rise capability path without changing
  optics calibration or movement sign conventions.
- Added canonical projected-corner framing evaluation for depth-spanning
  building top/base targets and an explicit level-camera criterion.
- Added guided English/zh-HK task copy, catalog routing, reset/restart coverage,
  and current-head Chromium coverage for Rise-only controls and RTT response.

## Since previous review

- Corrected `camera-level` evaluation to use the derived rear-standard/film-plane
  orientation rather than unrelated front-standard movements.
- Added regression coverage proving Front Swing does not invalidate camera level
  while Rear Tilt does; horizontal yaw remains level as well.
- Restored the final-facing Oblique Architecture scene/catalog description in
  English and zh-HK.
- Preserved the Rise-only PR 6B guided-task copy and behavior.
- Revalidated the current branch HEAD.

## Validation

- Focused Oblique Architecture, rear-standard, scene/catalog/route, task-engine,
  and guided-copy checks: passed — 7 files, 99 tests.
- `npm test`: passed — 117 test files, 1,097 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Focused Chromium E2E: passed — 2 tests covering shared 3D/RTT subject,
  optics fallback false, contentful RTT, non-uniform sharpness, Rise-only
  controls, 20 mm task completion, and restart to neutral.
- Full `npm run ci:local:e2e`: not run; focused Chromium coverage was used for
  this scene because the changed public workflow is directly covered there.
- `git diff --check`: passed.

## Known gaps / PR 6C handoff

- Façade near/middle/far sharpness is still unresolved; PR 6B intentionally
  leaves the solved Rise state with non-uniform sharpness.
- Front Swing and the focus-plane lesson remain unavailable.
- Compound Rise + Swing evaluation and final guided integration remain out of
  scope.

## Commit references

- Substantive implementation commit: `e484602` (`feat(scene): add Oblique Architecture Rise composition lesson`).
- Review-fix substantive commit: `99ddcd3` (`fix(scene): correct Oblique Architecture level criterion and catalog copy`).
- Final status update commit is bookkeeping-only and intentionally not
  self-referenced.
