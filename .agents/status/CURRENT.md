# Ground Glass focus inspection fidelity

## Objective

Correct the learner-facing Ground Glass presentation mismatch observed in PR131 by adding an explicit presentation-only focus-inspection magnification. Physical optics, task evaluation, calibration, and thresholds remain unchanged.

## Branch / base

- Branch: `fix/ground-glass-focus-inspection-fidelity`
- Worktree: `/Users/homan/repo/view-camera-ground-glass-focus-inspection-fidelity`
- Base: `origin/main` at `13c2ad9c46b473584162b2eb05c7cd65a113d61a` (PR131 merged)
- Starting head: `13c2ad9c46b473584162b2eb05c7cd65a113d61a`.
- Published implementation head: `e89b06fe05e7a8e5308b11f18b25b69239efe37b`.

## Presentation model

- `inspectionMagnification` is owned by Ground Glass visual settings and defaults to `4×` for all scenes; no scene-specific blur multiplier was added.
- The display path is physical CoC/ellipse in millimetres → film-mm-to-pixel conversion → `4×` inspection magnification → existing display-radius cap → gather. Scalar and oriented ellipse paths use the same factor, with orientation and signed physical values preserved.
- The CPU display helpers and GLSL uniforms share the same conversion. `signedCocMm`, physical ellipse radii, equivalent CoC, learner sharpness, task thresholds, and the `0.1 mm` acceptable CoC contract remain unchanged.
- Encoded-byte storage accounts for magnification when resolving the physical range represented by the display cap; half-float physical-mm storage remains unchanged. `displayBlurScale` remains rejected.
- Raw RTT developer bypass remains an unmodified sharp-source path; the public focus-inspection label is localized as `Focus inspection · 4×` / `對焦檢視 · 4×`.

## Evidence

- Pre-change neutral Oblique Tabletop evidence showed physical CoCs from `0.000303 mm` (middle) to `0.145038 mm` (near-right), while at 1× the `0.1 mm` boundary was only about `0.307 CSS px` diameter on the normal Ground Glass. The learner scores were unchanged: middle `100%`, near-centre `25%`, near-right `0%`, far-left `11%`.
- Magnification candidates `1×`, `2×`, `4×`, and `6×` were evaluated; `4×` was selected as the smallest plausible setting that made the accepted neutral ordering inspectable without changing the physics. Normal and expanded Oblique Tabletop browser captures showed the middle reference visibly sharper than the soft targets.
- Accepted Oblique states were visually checked: neutral, Tilt-only `+3.6° / 3530 mm`, compound `+7.1° / +2.1° / 2500 mm`, Swing partial `2440 mm`, Refine `2500 mm`, and f/11 versus f/22. Existing physical score and calibration assertions remain green.
- Cross-scene focused rendering/profiling remains on the shared pipeline; no scene geometry or calibration was changed.

## Performance

At normal/high Ground Glass quality in the real browser profiling path (CPU fallback, DPR 2, internal/gather `784×628`, 32 samples): neutral averaged `434.7 ms` frame, Tilt-only `418.5 ms`, and compound `383.1 ms`; physical DOF submit averages were `3.01 ms`, `0.03 ms`, and `0.04 ms` respectively in the sampled windows. The gather configuration and sample count did not increase.

## Validation

- Focused Ground Glass Vitest: `7` files / `72` tests passed, including settings, shader, uniform, storage, footprint, CPU/RTT, renderer, stability, physical invariance, and byte-ordering coverage.
- Full `npm test`: `164` files / `1607` tests passed in `19.81 s`.
- Typecheck, lint, `check:css`, build, and `git diff --check`: passed.
- Focused Oblique Tabletop Chromium: `2/2` passed (`oblique-tabletop-guided-lesson.spec.ts`, `oblique-tabletop-teaching-geometry.spec.ts`); the real route showed the inspection indicator, healthy canvas, and normal/expanded presentation.
- Cross-scene Chromium smoke: `8/8` passed across Oblique Architecture, Interior Corner, Ground Glass profiling, and Raw RTT bypass.
- Temporary three-state profiling probe passed and was removed before commit. At high quality / CPU fallback / DPR 2 / internal-gather `784×628` / 32 samples, neutral/Tilt-only/compound averaged `434.7/418.5/383.1 ms` per frame.
- `CI=1 npm run ci:local:e2e`: CSS, lint, typecheck, `164/1607` unit/integration tests, build, and preceding browser specs passed; it stopped in `groundglass-interaction.spec.ts` with the Architecture Rise re-zoom/reset test timing out. The exact test was rerun on clean current `origin/main` `13c2ad9c46b473584162b2eb05c7cd65a113d61a`: one run passed, while a two-worker repeat reproduced the same test's timeout twice at separate interaction points. This is retained as an existing intermittent baseline issue; no unrelated test was weakened.
- GitHub CI for the published implementation head: `ci` passed in 2m11s (PR run `34048416606`); the push-triggered `ci` also passed in 2m04s (run `34048370091`), with deploy skipped as expected.

## Scope / known gaps

This work changes only the Ground Glass presentation layer, its shared shader/CPU conversion path, a localized transparency indicator, related tests, and this handoff. It does not change camera state, optics, scene geometry, calibration, task thresholds, aperture policy, or the catalog asset. The full local E2E result is limited by the clean-main-reproduced `groundglass-interaction` baseline timeout; the published implementation head is green in GitHub CI.
