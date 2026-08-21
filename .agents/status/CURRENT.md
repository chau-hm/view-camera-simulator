# Current Work Handoff

## PR 7E — Architecture + Foreground: Compound Movement Challenge

- Branch: `feature/architecture-foreground-compound`
- Base: `origin/main` @ `b735850` (completed PR 7D baseline).
- Substantive implementation HEAD: pending commit; working tree is based on
  `b735850`.
- Objective: add one outcome-based compound guided task that starts at the
  neutral Architecture + Foreground problem and requires composition, focus
  plane alignment, and usable depth of field together.

## Implemented surfaces

- Guided task: registered `architecture-foreground-compound-01` with Rise,
  Tilt, Focus, Aperture, and Geometry View enabled. Swing and rear movements
  remain unavailable; no guided stage or lesson integration was added.
- Evaluator: reuses the canonical projected roof/base targets, level-camera
  criterion, and the PR 7D illustrative `0.6` sharpness threshold across
  foreground-near, foreground-middle, building-base, and building-middle.
  It does not require one exact four-value solution.
- Public integration: Architecture + Foreground now has four direct guided
  tasks in pedagogical order, with the compound task as the primary Guided CTA.
  The card is last in the public catalog after Oblique Architecture and still
  uses `public/assets/architecture-foreground.png`.
- Copy/tests: English and zh-HK compound task copy, cumulative Free Practice
  guidance, route/catalog/Scenes-page ordering assertions, compound evaluator
  probes, and focused Chromium coverage were added. A stale Rise-era E2E
  capability assertion was updated to reflect the cumulative Aperture control
  already provided by PR 7D.
- Shared scene/optics/RTT code was not changed; the existing canonical subject
  and renderer remain the source of truth.

## Compound calibration and evidence

- Guided initial state: Front Rise `0 mm`, Front Tilt `0°`, Focus `9490 mm`,
  Aperture `f/11`; composition and focus-target criteria fail as expected.
- Canonical reference outcome: Rise `+20 mm`, Tilt `+2.0°`, Focus `6830 mm`,
  Aperture `f/22`; all roof/base and four focus-target criteria pass while the
  rear standard remains level.
- Nearby passing outcomes: `(Rise 20, Tilt 1.8°, Focus 6750 mm, f/22)` and
  `(Rise 25, Tilt 2.2°, Focus 6930 mm, f/22)` also pass. The evaluator is not
  exact-value-only.
- Negative probes: neutral, Rise-only, Rise + Tilt, and Rise + Tilt + Focus at
  f/11 fail; excessive Rise loses the building base; f/32 with Tilt reset to
  `0°` or Focus reset to `9490 mm` fails the sharpness criterion; a rear tilt
  fails the level-camera criterion.
- Manual Ground Glass checkpoints: neutral shows the cropped composition and
  soft foreground; Rise/Tilt/Focus at f/11 shows the corrected framing and
  focus plane with residual DOF limitation; f/22 completes the photograph
  without changing perspective. RTT remained contentful at every checkpoint.

## Validation

- `npm test -- --run`: PASS — 126 files / 1,175 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:css`: PASS.
- `npm run build`: PASS.
- Focused unit/integration suites: PASS — 10 files / 97 tests, including all
  prior Architecture + Foreground task regressions, catalog/order, routes,
  Scenes page, and localized copy.
- Focused Chromium E2E: PASS — 9 serial tests covering Scenes-page discovery
  and ordering, Free Practice, Rise, Tilt + Focus, DOF, and compound task
  completion/restart. A prior parallel run had one transient Scenes navigation
  failure; the isolated test and the serial matrix both passed.
- `git diff --check`: PASS.

## Checks not run / deliberate exclusions

- Full `npm run ci:local:e2e` was not run: no renderer lifecycle, shared RTT
  architecture, GPU ownership, or broad route/lifecycle changes were made;
  focused Chromium coverage passed.
- PR 7F remains deliberately deferred: guided lesson/stage integration,
  `guidedLesson`, and any `PublicGuidedLessonTaskStageId` extension.

## Reviewer focus / known risks

- Confirm the four-target `0.6` illustrative threshold and nearby solution
  envelope remain legible in the current Ground Glass presentation.
- Confirm the compound task remains solvable through ordinary public slider
  steps without implying an exact Rise/Tilt/Focus/Aperture recipe.
- Confirm the final public ordering and newest-task Scenes-page Guided CTA
  match the project convention; all four direct Architecture + Foreground
  guided routes are valid and future lesson integration remains absent.
- No global optics formulas, movement signs, shared RTT architecture,
  renderer lifecycle, thumbnail asset, or unrelated scene behavior changed.
