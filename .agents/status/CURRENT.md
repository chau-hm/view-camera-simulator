# Current Work Handoff

## PR 7F — Architecture + Foreground Guided Lesson

- Objective: integrate the four existing Architecture + Foreground guided tasks
  into one public five-stage lesson without changing task calibration,
  evaluators, optics, or rendering.
- Branch: `feature/architecture-foreground-guided-lesson`.
- Base: `origin/main` @ `3a754d3` (`fix(ground-glass): stabilize DOF post-processing`).
- Substantive HEAD: `3377fef` (`feat(scene): add Architecture + Foreground guided lesson`).

## Lesson contract

- Public scene `architecture-foreground` remains available in Free and Guided
  modes, remains the final catalog/Scenes-page card, and retains
  `assets/architecture-foreground.png`.
- `guidedLesson`: id `architecture-foreground`, `includeObserveStage: true`.
- Ordered task stages: `compose`, `align-focus`, `depth-of-field`,
  `final-challenge`.
- Resolved lesson: Observe → Compose → Align Focus → Depth of Field → Final
  Challenge.
- Task mapping remains index-aligned and unchanged:
  `architecture-foreground-rise-01`,
  `architecture-foreground-tilt-focus-01`,
  `architecture-foreground-dof-01`,
  `architecture-foreground-compound-01`.
- Scenes CTA uses the shared `/simulator/free/architecture-foreground?lesson=1`
  behavior. Direct guided task URLs remain standalone without `lesson=1`.

## Implementation

- Added the shared `depth-of-field` stage ID and English/zh-HK stage labels.
- Added data-driven, lesson-aware copy for Architecture + Foreground and
  preserved Oblique Architecture’s existing lesson name, Observe copy, and
  completion copy.
- Generalized lesson Observe initialization to any valid public scene with
  `guidedLesson`; Architecture + Foreground re-entry resets to Rise/Tilt/Swing
  zero, finite canonical focus `9490 mm`, f/11, and no task.
- Reused existing route generation, Continue/Previous gating, restart behavior,
  task evaluators, and Scenes-card CTA. No optics/task calibration or RTT code
  changed.

## Validation

- Focused unit/integration: PASS — 96 tests covering stage construction,
  hrefs, metadata, copy, catalog/routes, progress gating, and neutral state.
- Full unit/integration: PASS — 127 files / 1,198 tests.
- Typecheck, lint, CSS structure check, build, and `git diff --check`: PASS.
- Architecture + Foreground serial Chromium lesson suite: PASS — complete
  five-stage journey, Previous navigation, Final Challenge reset/completion,
  neutral re-entry, standalone DOF route, canvas/RTT presence, and finite
  diagnostics with no NaN/Infinity text.
- Existing Architecture + Foreground Scenes-page CTA regression: PASS.
- Oblique lesson copy/framework unit compatibility: PASS.

## Full E2E status

- `npm run ci:local:e2e` ran all prerequisite checks and all Architecture +
  Foreground PR 7F specs passed. It stopped at the unrelated
  Focus Fundamentals selectable-focus test because RTT owner/resource-generation
  diagnostics were absent after contentful RTT checks; its responsive companion
  passed. Isolated rerun reproduced the same failure.
- The existing Oblique full-lesson browser test also timed out in its pre-task
  re-entry setup while moving Focus from `6100` to `5260 mm`; the same class of
  slider timeout was observed on the baseline work previously. No Oblique task,
  optics, or renderer code changed here.

## Scope and reviewer focus

- Deliberately excluded new tasks, lesson persistence, stage jumping, UI
  redesign, optics recalibration, evaluator changes, renderer/DOF changes, and
  PR 7E task behavior changes.
- Review scene-aware copy-key mapping, valid-lesson gating in route
  initialization, exact five-stage href construction, index alignment between
  `guidedTaskIds` and `taskStageIds`, and preservation of direct standalone
  task routes.
- Remaining risks are the pre-existing Focus Fundamentals RTT diagnostic race
  and Oblique focus-slider E2E timeout noted above; neither is in the PR 7F
  changed surface.
