# Current Work Handoff

## Work

PR / work identifier: PR 6C — Oblique Architecture — Swing + Façade Focus
Branch: `feature/oblique-architecture-swing-focus`
Base: `main` (`origin/main` @ `9d7fc46` when this branch was created)

## Objective

Add the second Oblique Architecture teaching slice: Free Practice exposes
Front Rise, Front Swing, and Focus, while a guided task starts from the
existing solved Rise composition and teaches alignment of the façade focus
plane. The final neutral-state compound exercise remains deferred to PR 6D.

## Focus-range prerequisite

The previous public Focus minimum (approximately `8200..19000 mm`) came from
the subject world-Z lower bound. That is not a universal lower bound when the
finite-focus reference is `lens-to-focus-plane`: Front Swing can rotate the
focus plane so its optical-axis intersection is closer than the nearest
subject world-Z.

The scene contract now supports an explicit, validated
`SceneFocusDistanceRangeMm` override. Oblique Architecture derives its range
from the shared three-probe Swing calibration plus a depth-based practical
margin, independent of `focusStandardCapability`:

- Public Focus range: `4540..19020 mm`
- Public Focus step: `10 mm`
- Validation: finite values, `min > 0`, and `max >= min`; malformed explicit
  ranges fall back to the existing legacy derivation.
- Scenes without the override preserve the legacy range behavior.

## Current geometry and calibration

- Building depth: `z = 9600..16800 mm`
- Ground: `z = 8200..19000 mm`
- Camera placement:
  - position = `(-6200, 3200, -1200) mm`
  - target = `(1800, 1000, 13000) mm`
- Canonical middle-façade Focus: `13200 mm`
- Reachable calibrated Front Rise: `20 mm`
- Public Front Rise range/step: `0..40 mm` / `1 mm`
- Public Front Swing range/step: `-10..10°` / `0.1°`
- Fixed Oblique Architecture Aperture: `f/5.6`
- Façade sharpness threshold: `0.8` per near/middle/far target.

The continuous shared calibration is approximately `9.6518°` Swing and
`5260.625 mm` Focus. The rounded public verification state is `9.7°` /
`5260 mm`; it is reachable and passes the observable criteria.

## Exhaustive public-grid calibration

The gate searched Rise `20 mm`, Swing `-10..10°` in `0.1°` steps, and Focus
`4540..19020 mm` in `10 mm` steps: `291,249` public states. Required framing,
rear-standard level, and all three façade sharpness thresholds produced `620`
passing states.

- Best passing public-grid state: Swing `9.9°`, Focus `5140 mm`.
- Sharpness at that state: near `0.99904`, middle `0.99810`, far `0.99712`;
  worst `0.99712`.
- Nearby passing evidence includes `9.6° / 5260 mm`, `9.8° / 5140 mm`,
  `9.9° / 5130 mm`, and `10.0° / 5150 mm`.
- Boundary risk: no fail-closed boundary condition; passing states exist on
  both sides of the rounded `9.7° / 5260 mm` verification state and are not
  dependent on changing the global Swing range or sharpness threshold.

## Free Practice

- Public controls: Front Rise, Front Swing, Focus, Geometry View, and the
  existing movement reset behavior.
- Front Tilt, Rear Rise, Rear Tilt, and Aperture remain unavailable/fixed.
- Neutral initialization remains Rise `0 mm`, Swing `0°`, and canonical Focus
  `13200 mm`; Free Practice is not scored.

## Guided task

- Primary task/CTA: `oblique-swing-focus-01` — **Align the Façade Focus**.
- Existing `oblique-rise-01` remains registered and directly routable.
- Initial state: Rise `20 mm`, Swing `0°`, Focus `13200 mm`, fixed Aperture
  `f/5.6`; Rise is supplied as solved composition and is not learner-adjustable.
- Guided controls: Front Swing, Focus, and Geometry View.
- Observable criteria: projected building-top corners visible, projected base
  corners visible, derived rear-standard/film-plane level, and near/middle/far
  façade targets each at least `0.8` sharpness.

Evidence covers the initial solved-Rise state as incomplete, Focus-only and
Swing-only searches at the established public grid as insufficient to solve
all façade depths, a valid non-zero Swing preserving `camera-level`, and a
nearby public-step solution that also passes. Reset/Restart returns the
appropriate Free Practice or guided initial state.

## Public catalog state

- Public title: `Oblique Architecture`
- zh-HK title: `斜向建築攝影`
- Public scene ordering: Oblique Architecture is the final public scene.
- Thumbnail: `public/assets/oblique-architecture.png`
- Primary guided task: `oblique-swing-focus-01`; `oblique-rise-01` remains a
  valid direct guided route.
- Stable catalog description remains the final-facing Rise + Swing compound
  wording in English and zh-HK.

## Since previous review

- Added an explicit per-scene Focus-distance range contract and preserved the
  legacy derivation for scenes without it.
- Recalibrated the public Focus domain using the shared canonical optics
  calibration and verified a robust reachable Swing + Focus region.
- Added the PR 6C Free Practice controls and the solved-Rise guided task
  `oblique-swing-focus-01` with observable façade sharpness criteria.
- Added canonical top-view façade target labels and preserved the shared
  3D/RTT subject, projection, level-camera semantics, and PR 6B Rise task.
- Fixed Current Settings for multi-movement scenes so Oblique Architecture
  exposes actual Rise + Swing values instead of a stale single selected
  movement.
- Preserved the existing selected-movement presentation for single-movement
  scenes.
- Added focused regression coverage for the multi-movement Swing readout.
- Revalidated the current branch HEAD.

## Validation

- Focused readout, Oblique Architecture/task/catalog/route checks: passed —
  4 files, 40 tests.
- `npm test`: passed — 118 test files, 1,107 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Focused Chromium Oblique Architecture E2E: passed — 3 tests covering Free
  Practice Rise + Swing readouts, `oblique-rise-01`, and
  `oblique-swing-focus-01` Swing readout visibility, RTT content, optics
  fallback false, control restrictions, completion, and restart semantics.
- `git diff --check`: passed.
- Full `npm run ci:local:e2e`: not run; focused Chromium coverage directly
  exercises the changed public scene workflows.

## PR 6D handoff

PR 6D will combine Rise + Swing + Focus from the fully neutral state into one
compound free-practice/outcome exercise. PR 6C is not the final compound task.

## Commit references

- PR 6C implementation commit: `5cdedae` (`feat(scene): add Oblique Architecture Swing and façade focus lesson`).
- Review-fix implementation commit: `a9bfe22` (`fix(ui): show multi-movement camera state in Current Settings`).
- Final status update commit will be bookkeeping-only and intentionally not
  self-referenced.
