# Current Work Handoff

## Work

PR / work identifier: PR 6A — Oblique Architecture — Static Problem
Branch: `feature/oblique-architecture-scene`
Base: `origin/main` @ `389c27f`

## Objective

Add the first public, free-only Oblique Architecture learning scene as a stable
before-state. It presents a level camera facing a receding building corner so
the verticals remain vertical, the building top is cropped, and near/middle/far
façade samples are not uniformly sharp. No Rise/Swing lesson or evaluator is
included.

## Since previous review

- Recalibrated the subject depth so a 20 mm Front Rise, reachable on the
  existing 1 mm / 0–40 mm public control, fits the roof and base corners.
- Moved Oblique Architecture to the final public scene position and updated
  scene-order/preload assertions.
- Replaced the temporary development title, description, and topics with
  final-facing compound-movement copy in English and zh-HK.
- Replaced the temporary SVG card art with the supplied approved
  `public/assets/oblique-architecture.png` ImageGen asset.

## Implemented

- Added canonical millimetre geometry for a rectilinear teaching building with
  a visible corner, four repeated window rows, front windows, and a seven-stop
  target façade extending in depth.
- Added a shared Three.js subject factory for the interactive scene and Ground
  Glass RTT, including named near/middle/far focus probes and unique-resource
  disposal.
- Added a fixed scene definition: zero rise/tilt/swing, finite focus at the
  middle façade sample, level rear standard, stable observer placement, no
  movement/reset controls, and locked focus/aperture controls.
- Registered the scene in the definitions, public catalog, free route
  validation, RTT scene set, scene geometry view, top-view façade guide,
  English/zh-HK copy, and free-practice observation copy. No guided task ID is
  published.
- Added scene-specific Ground Glass display calibration while preserving the
  canonical physical CoC/optics state.
- Added unit/integration coverage for projection/framing/sharpness, subject
  identity/disposal, catalog/route consistency, localization, and RTT
  registration, plus a focused Chromium runtime check.

## Root design and calibration decisions

- Building ground is at `y = -1200 mm`; the mass spans `z = 9600..16800 mm`
  with the target façade on `x = 900 mm`, making the side-oblique viewpoint
  legible without changing the building's physical proportions. The ground
  spans `z = 8200..19000 mm`.
- Camera placement is `(-6200, 3200, -1200) mm` looking toward
  `(1800, 1000, 13000) mm`; rear movements remain zero so the canonical film
  frame stays level.
- Focus is `13200 mm`, the middle of the target façade. Canonical focus targets
  are near/middle/far side windows; the Ground Glass display uses the existing
  physical CoC path with a bounded `48 px` blur radius and `3.6` display scale
  so the derived sharpness falloff remains legible at RTT resolution.
- The calibrated future Rise value is `20 mm`; full roof and base corner
  projections are inside the usable frame at that value, while the neutral
  roof remains cropped.
- The scene uses the generic rear-standard thin-lens finite-focus strategy;
  no new optics or sign convention was introduced.

## Changed surface

- Scene definition and canonical geometry:
  `src/scenes/definitions/oblique-architecture.ts`,
  `src/scenes/obliqueArchitectureGeometry.ts`,
  `src/scenes/definitions/index.ts`
- Shared 3D/RTT subject and registry:
  `src/render/ObliqueArchitectureSubjectFactory.tsx`,
  `src/render/sceneSubjectRegistry.tsx`,
  `src/render/groundGlassRttScenes.ts`,
  `src/render/groundGlassVisualSettings.ts`
- Public catalog, route/geometry wiring, thumbnail, and copy:
  `src/app/publicScenes.ts`, `src/components/geometry/*`,
  `src/components/simulator/taskHelpers.ts`, `src/i18n/*`,
  `public/assets/oblique-architecture.png`
- Tests:
  `src/tests/unit/obliqueArchitectureScene.test.ts`,
  `src/tests/e2e/oblique-architecture.spec.ts`, and the related scene,
  registry, route, catalog, i18n, and RTT tests.

## Validation

- Focused review-fix tests: passed — 6 files, 66 tests.
- `npm test`: passed — 116 files, 1,088 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Focused Chromium E2E: passed — shared 3D/RTT subject, finite RTT
  diagnostics, contentful Ground Glass, near/middle/far sharpness falloff,
  and no Rise/Swing/reset controls.
- `git diff --check`: passed.

## Known gaps / PR 6B follow-up

- Rise remains intentionally unavailable; PR 6B should introduce the Rise
  control and its guided framing lesson from this fixed before-state.
- Swing/focus-plane teaching, compound evaluation, and final guided
  integration remain out of scope for PR 6A.
- Full `npm run ci:local:e2e` was not run; the new RTT-backed public workflow
  has focused Chromium coverage and the full unit/integration suite is green.

## Commit

Substantive review-fix implementation: `0f35f12`.
Final status-only bookkeeping commit: pending; intentionally not self-referenced.
