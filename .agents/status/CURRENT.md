# Current Work Handoff

## Work

PR 6E — Oblique Architecture Guided Lesson + Final Integration

Branch: `feature/oblique-architecture-guided-integration`
Base: `main` (`origin/main` @ `fb2c33a`)
Substantive implementation commit: `e2c94ee`

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
  Focus `13200 mm`, level rear standard, fixed `f/5.6` aperture. It shows the
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

## Preserved foundation

- Current Settings continues to show simultaneous Front Rise, Front Swing, and
  Focus in the multi-movement Oblique scene.
- Existing PR 6B–6D task criteria, initial states, reset semantics, direct
  routes, public copy, scene ordering, thumbnail, RTT subject registration,
  optics fallback behavior, and calibration remain unchanged.
- PR 6E adds no new optical model, calibration, focus threshold, or graded
  photographic outcome.

## Validation

- Focused lesson/catalog/route/store/UI tests: passed — 5 files, 61 tests.
- `npm test`: passed — 121 test files, 1,123 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Focused Chromium Oblique Architecture E2E: passed — 5 tests covering
  ordinary Free Practice, all three direct guided task workflows, and the
  complete Observe → Compose → Align Focus → Final Challenge journey.
- `git diff --check`: passed.
- Working tree was clean before the final status update.

## Checks not run

- Full `npm run ci:local:e2e` was not run. The focused Chromium suite covers the
  changed lesson entry/progression and all existing Oblique workflows; no
  renderer, scene lifecycle, or cross-scene control architecture changed.

## PR 6E handoff

This is the final planned Oblique Architecture integration slice. No PR 6F or
post-6E feature work is started.

## Commit references

- Substantive implementation: `e2c94ee` (`feat(scene): integrate Oblique
  Architecture guided lesson`).
- The final status update commit is bookkeeping-only and intentionally does
  not self-reference its own SHA.
