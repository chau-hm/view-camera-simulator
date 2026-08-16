# Current Work Handoff

## Work

PR / work identifier: PR 6A — Oblique Architecture — Static Problem
Branch: `feature/oblique-architecture-scene`
Base: `main` (`origin/main` @ `389c27f`)

## Objective

Provide the stable, free-only before-state for the Oblique Architecture
learning scene: a level camera keeps the building verticals parallel, neutral
framing crops the roof, and the oblique target façade is not uniformly sharp
from near to far. Rise/Swing solving and guided evaluation remain out of scope.

## Since previous review

- Recalibrated the subject depth so the framing problem is solvable through the existing public Front Rise range.
- Added a publicly reachable 20 mm / 1 mm-step Rise solution regression test.
- Moved Oblique Architecture to the final public scene position.
- Replaced temporary static-problem catalog copy with final-facing compound-movement copy.
- Replaced the temporary SVG thumbnail with the approved PNG asset.
- Revalidated the latest branch HEAD.

## Current geometry and calibration

- Building depth: `z = 9600..16800 mm`
- Ground: `z = 8200..19000 mm`
- Camera placement:
  - position = `(-6200, 3200, -1200) mm`
  - target = `(1800, 1000, 13000) mm`
- Rear standard remains level and unchanged in the initial state; initial Rise,
  Tilt, and Swing are zero.
- Canonical focus: `13200 mm`, derived from the middle target-façade sample in
  the current implementation.
- Reachable Front Rise: `20 mm`
- Public Rise range: `0..40 mm`
- Public Rise step: `1 mm`

The regression test proves:

- `0 mm Rise` → roof remains cropped.
- `20 mm Rise` → required roof corners fit, required base corners remain visible,
  and the rear standard remains unchanged.

## Public catalog state

- Public title: `Oblique Architecture`
- zh-HK title: `斜向建築攝影`
- Public scene ordering: Oblique Architecture is the final public scene.
- Thumbnail: `public/assets/oblique-architecture.png`
- Availability is free-only with no guided task ID; Rise/Swing solving controls
  and movement reset remain unavailable in PR 6A.

## Implemented surfaces

- Canonical building, ground, camera placement, focus targets, and composition
  bounds in `src/scenes/obliqueArchitectureGeometry.ts` and the scene definition.
- One registered Three.js subject shared by the 3D scene and Ground Glass RTT,
  including near/middle/far focus probes and owned-resource disposal.
- Public catalog, scene ordering, free route validation, RTT registration,
  scene geometry/top-view support, English/zh-HK copy, and the approved PNG.
- Focused unit/integration coverage plus Chromium coverage for the shared
  subject, RTT diagnostics/content, sharpness falloff, and unavailable controls.

## Validation

- Focused Oblique Architecture and related scene/catalog/route tests: passed —
  6 files, 66 tests.
- `npm test`: passed — 116 files, 1,088 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Focused Chromium E2E: passed — scene mount, shared 3D/RTT subject, optics
  fallback false, contentful Ground Glass, non-uniform near/middle/far
  sharpness, and unavailable Rise/Swing/reset controls.
- `git diff --check`: passed.

## Known gaps / PR 6B follow-up

- PR 6B should introduce the public Rise control and guided framing lesson
  using the reachable 20 mm calibration evidence.
- Swing/focus-plane teaching, compound evaluation, and final guided integration
  remain out of scope for PR 6A.
- Full `npm run ci:local:e2e` was not run; focused Chromium coverage was used
  for this scene and the full unit/integration suite is green.

## Commit references

- Substantive implementation/review-fix commit: `0f35f12`.
- Final status update commit: pending; bookkeeping only and intentionally not
  self-referenced.
