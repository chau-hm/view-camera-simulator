# Interior Corner 12D — Guided Lesson + Final Integration

## Branch / base

`feature/interior-corner-guided-lesson-12d` · `/private/tmp/view-camera-interior-corner-12d-fresh` · base `origin/main` `739b744a880826b3c34200645bac90f988a9436e`

## Objective

Publish the Interior Corner guided lesson on top of the merged 12A–12C scene, preserving the existing Rise composition and Swing + Focus optical calibration.

## Lesson contract

- Observe: neutral level camera, `Rise 0`, `Swing 0`, `Focus 8000 mm`, `f/5.6`.
- Compose: Front Rise plus Geometry View; the physical Rise composition evaluator first passes at public `33 mm`.
- Front Swing: starts from the composed partial state (`Rise 33`, `Swing 0`, `Focus 8000`), uses positive Swing to orient the focus plane, and deliberately stops before full wall sharpness.
- Refine Focus: starts from useful Swing with Focus still at `8000 mm`; this is the first full near/middle/far receding-wall sharpness gate and passes at the public calibration (`Swing +3.6°`, `Focus 38140 mm`, `f/5.6`).
- Aperture: preserves the aligned state and completes with the modest `f/11` stop-down; movements and Focus are locked.

## Implementation boundaries

Interior Corner is now a public Free Practice + guided lesson catalog entry with four task IDs and an Observe stage. Scene-level Free Practice remains unchanged at fixed `f/5.6`. Custom task criteria delegate to the existing physical Rise and Swing/Focus evaluators; no new lesson engine, optics model, geometry, RTT pipeline, or aperture evaluator was added.

## Validation

- Focused guided/catalog/route/copy/progress tests: `7` files, `117` tests passed.
- Focused Interior Corner optics/store/public-control/copy tests: `8` files, `75` tests passed.
- Full Vitest: `164` files, `1598` tests passed.
- Focused Chromium public lesson flow: `1` test passed in `49.0s`, covering catalog entry, Observe, public Rise `33`, Swing partial completion, Refine Focus, and final `f/11` completion with RTT present.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and `git diff --check` passed.

## Tests not run

Full `npm run ci:local:e2e` was not run; shared renderer, route lifecycle, and existing scene infrastructure were unchanged, and the focused Chromium lesson flow passed.

## Deferred

No further Interior Corner slice is included here. Any later lesson polish or additional teaching work remains outside PR12D.
