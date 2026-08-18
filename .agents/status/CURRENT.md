# Current Work Handoff

## Work

PR 6E — Oblique Architecture Guided Lesson + Final Integration

Branch: `fix/oblique-architecture-aperture-tuning`
Base: `main` (`origin/main` @ `b6ef012`)
PR 6E implementation commit: `e2c94ee`
Review-fix implementation commit: `79e4ef5`
Aperture tuning implementation commit: `ba3afbf`

## Objective

Integrate the completed Oblique Architecture slices into one opt-in guided
sequence without changing the optics, calibration, task evaluator, or
renderer architecture.

## Guided Lesson sequence

The public Oblique Architecture card now offers `Guided Lesson`, which enters:

1. Observe — `/simulator/free/oblique-architecture?lesson=1`
2. Compose — `oblique-rise-01`
3. Align Focus — `oblique-swing-focus-01`
4. Final Challenge — `oblique-compound-01`

The three graded task references continue to come from the existing ordered
`guidedTaskIds` list. The lightweight `guidedLesson` metadata only declares
the lesson identity, Observe intro, and aligned stage labels.

Ordinary `/simulator/free/oblique-architecture` remains independent and
unscored. All three direct guided task routes remain valid without the lesson
query marker.

## Stage behavior

- Observe uses the canonical neutral scene state: Rise `0 mm`, Swing `0°`,
  Focus `13200 mm`, level rear standard, fixed `f/11` aperture. It shows the
  cropped roof / uneven façade-sharpness explanation and has an always-enabled
  Continue link.
- Compose reuses `oblique-rise-01`, starts neutral, and enables Continue only
  when the existing task evaluation passes.
- Align Focus reuses `oblique-swing-focus-01`, starts at solved Rise `20 mm`,
  Swing `0°`, Focus `13200 mm`, and is gated by its existing evaluation.
- Final Challenge reuses `oblique-compound-01`, resets to Rise `0 mm`,
  Swing `0°`, Focus `13200 mm`, and is gated by the compound evaluation.

Previous navigation uses normal route initialization, so each task restores
its own deliberate initial state. Completion shows the final outcome copy,
`Lesson complete`, and `Back to Scenes`. There is no automatic navigation or
persistent progress tracking.

Entering the lesson Observe route is a scoped fresh route initialization;
regression coverage proves stale Oblique Free Practice Rise/Swing/Focus values
are cleared only for that lesson entry.

## Since previous review

- Observe explicitly restores finite canonical Focus (`13200 mm`) and
  `lastFiniteFocusDepthMm` after a cross-scene Infinity Reset.
- Leaving Guided Lesson clears the scoped route-initialization guard, so
  re-entering Observe starts from fresh neutral state; same-route rerenders do
  not continuously reset learner changes.
- Prior lesson stages use neutral `previous` presentation rather than
  fabricated completion state; final completion still comes from the current
  `oblique-compound-01` evaluation.
- Added store, progress-component, and focused Chromium regression coverage
  for the review fixes.
- Revalidated the current branch HEAD with the full local CI workflow.

## Preserved foundation

- Current Settings continues to show simultaneous Front Rise, Front Swing, and
  Focus in the multi-movement Oblique scene.
- Existing PR 6B–6D task criteria, initial states, reset semantics, direct
  routes, public copy, scene ordering, thumbnail, RTT subject registration,
  optics fallback behavior, and calibration remain unchanged.
- PR 6E adds no new optical model, calibration, focus threshold, or graded
  photographic outcome.

## Aperture tuning follow-up

- The fixed `f/5.6` opening made too much of the building appear oddly blurred.
- Chose Option A: keep aperture fixed and tune Oblique Architecture to `f/11`
  across Observe, Compose, Align Focus, and Final Challenge. No Final Challenge
  aperture control fallback was added.
- At `f/11`, neutral and Rise-only retain an incomplete façade sharpness result;
  Swing + Focus without Rise still fails composition; the existing public
  `20 mm / 9.7° / 5260 mm` compound verification state still passes.
- Geometry, focus range, movement ranges, task thresholds, routing, and lesson
  structure remain unchanged.
- Current follow-up validation: focused Oblique unit tests `19/19`, full
  `npm test` `121 files / 1,125 tests`, typecheck, lint, CSS check, build, and
  focused Chromium `5/5` all passed.

## Validation

- Focused lesson/catalog/route/store/UI tests: passed — 5 files, 63 tests.
- `npm test`: passed — 121 test files, 1,125 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Focused Chromium Oblique Architecture E2E: passed — 5 tests covering
  ordinary Free Practice, all three direct guided task workflows, and the
  complete Observe → Compose → Align Focus → Final Challenge journey,
  including fresh lesson re-entry.
- `npm run ci:local:e2e`: passed — full local CI workflow, including the
  repository Chromium E2E matrix.
- `git diff --check`: passed.
- Working tree is clean after the final status bookkeeping update.

## Checks not run (PR 6E)

- None.

## Follow-up checks not run

- Full `npm run ci:local:e2e` was not run for the two-file fixed-aperture
  tuning; the focused Chromium suite plus the full unit/integration suite were
  sufficient for this non-shared-behavior change.

## PR 6E handoff

This is the final planned Oblique Architecture integration slice. No PR 6F or
post-6E feature work is started.

## Commit references

- Substantive implementation: `e2c94ee` (`feat(scene): integrate Oblique
  Architecture guided lesson`).
- Review-fix implementation: `79e4ef5` (`fix(scene): stabilize Oblique
  Architecture lesson entry state`).
- Aperture tuning implementation: `ba3afbf` (`fix(scene): tune Oblique
  Architecture aperture behavior`).
- The final status update commit is bookkeeping-only and intentionally does
  not self-reference its own SHA.
