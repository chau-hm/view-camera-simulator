# Current Work Handoff

## Work

PR / work identifier: PR 6D — Oblique Architecture — Compound Practice
Branch: `feature/oblique-architecture-compound-practice`
Base: `main` (`origin/main` @ `6e92677` when this branch was created)

## Objective

Add the complete Oblique Architecture outcome challenge from the neutral
camera state. The learner uses Front Rise for composition, then Front Swing
and Focus for the receding façade, while the rear standard remains level.
Final guided progression remains deferred to PR 6E.

## Preserved PR 6C foundation

- Explicit Oblique Architecture Focus range: `4540..19020 mm`
- Public Focus step: `10 mm`
- Public Swing range/step: `-10..10°` / `0.1°`
- Public Rise range/step: `0..40 mm` / `1 mm`
- Fixed Aperture: `f/5.6`
- Façade sharpness threshold: `0.8` for near/middle/far targets
- Existing verification state: Rise `20 mm`, Swing `9.7°`, Focus `5260 mm`

No optics model, scene geometry, calibration, threshold, focus-range, or
renderer changes were required for PR 6D.

## Compound task

- Task ID: `oblique-compound-01` — **Complete the Photograph**
- Primary public guided CTA: `oblique-compound-01`
- Initial state: Rise `0 mm`, Swing `0°`, Focus `13200 mm`, Front Tilt `0°`,
  rear movements `0`, fixed Aperture `f/5.6`, Top geometry view.
- Enabled controls: Rise, Swing, Focus, and Geometry View.
- Fixed/unavailable: Front Tilt, rear movements, Aperture, whole-camera pitch,
  and Infinity Reset.
- Observable criteria: projected building-top corners visible, projected
  building-base corners visible, derived rear-standard/film-plane level, and
  near/middle/far façade targets each at least `0.8` sharpness.
- Success does not require exact movement or Focus values.

## Compound regression evidence

- Neutral (`0 / 0 / 13200`): roof fails, base and camera-level pass, façade is
  not uniformly sharp, overall task fails.
- Rise-only (`20 / 0 / 13200`): framing passes but façade sharpness is
  incomplete, overall task fails.
- Swing + Focus without Rise (`0 / 9.7 / 5260`): façade sharpness passes but
  roof composition fails, overall task fails.
- Rise + Swing with canonical Focus (`20 / 9.7 / 13200`): composition may
  pass but focus remains incomplete, overall task fails.
- Full public verification (`20 / 9.7 / 5260`): all six observable criteria
  pass.
- Nearby public state (`20 / 9.6 / 5260`): also passes, protecting against
  exact-answer scoring.
- Current Settings exposes Front Rise, Front Swing, and Focus simultaneously
  at the solved state; Restart returns the complete neutral initial state.

## Previous guided tasks preserved

- `oblique-rise-01`: starts neutral and teaches Rise-only framing.
- `oblique-swing-focus-01`: starts at solved Rise and teaches Swing + Focus.
- `oblique-compound-01`: starts fully neutral and requires both composition
  and façade sharpness.
- All three routes remain directly routable; Oblique Architecture remains the
  final public scene with the approved title, description, topics, and PNG
  thumbnail.

## Since previous review

- Added `oblique-compound-01` with neutral initialization and outcome-based
  projected-corner, camera-level, and near/middle/far sharpness criteria.
- Promoted the compound task to the primary Oblique Architecture guided CTA
  while retaining both earlier guided routes.
- Added English and zh-HK compound-task guidance and criterion-specific
  feedback without exposing calibration answers.
- Added partial-solution unit coverage, route/catalog/copy coverage, and the
  focused neutral-to-solved Chromium workflow.
- Revalidated the current branch HEAD.

## Validation

- Focused compound task/catalog/route/copy/scenes-page checks: passed — 5
  files, 47 tests.
- `npm test`: passed — 119 test files, 1,113 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Focused Chromium Oblique Architecture E2E: passed — 4 tests covering Free
  Practice, `oblique-rise-01`, `oblique-swing-focus-01`, and
  `oblique-compound-01`, including RTT diagnostics, optics fallback false,
  partial states, simultaneous readouts, completion, and Restart.
- `git diff --check`: passed.
- Full `npm run ci:local:e2e`: not run; focused Chromium coverage directly
  exercises all changed Oblique Architecture public guided workflows.

## PR 6E handoff

PR 6E will add the final guided learning sequence / integration across
Observe → Compose → Align Focus → Final Challenge. It must reuse the completed
PR 6B–6D task and optics infrastructure rather than introducing another
optical model.

## Commit references

- PR 6D substantive implementation: `21c8929` (`feat(scene): add Oblique Architecture compound practice challenge`).
- Final status update commit will be bookkeeping-only and intentionally not
  self-referenced.
