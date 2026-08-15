# Current Work Handoff

## Work

PR / work identifier: PR 6E — Guided Task Copy Alignment
Branch: `content/guided-task-copy`
Base: `origin/main` @ `6fe59a64d0923f6171a922121d537924a835e885`
Head convention: record the substantive implementation commit here; a final
status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Localize the four existing Guided Tasks in `en` and `zh-HK` while keeping task
mechanics, evaluator facts, routes, scene state, readouts, optics, calibration,
rendering, and Free Practice behavior unchanged.

## Implemented

- Added typed Guided Task message catalogs for `en` and `zh-HK`, with English
  defining the shared resource shape and stable semantic message keys.
- Added locale-neutral serializable message references with interpolation
  values, and mapped `rise-01`, `tilt-01`, `swing-01`, and
  `mirror-shift-01` by stable task/criterion IDs.
- Removed learner-facing Guided Task prose from `taskRegistry`; mechanics,
  thresholds, criteria, enabled controls, initial state, and ordering remain
  authoritative there.
- Refactored evaluation and feedback selection to return message references;
  `TaskPanel` and `FeedbackPanel` translate at render time. Existing
  evaluations therefore re-render in a new locale without reevaluation.
- Localized Guided structural labels, control chips, criterion labels/results,
  status/progress, no-evaluation copy, secondary hints, and completion-summary
  labels. Calibrated values remain data-driven through interpolation.
- Preserved Free Practice, simulator readouts/diagnostics, routes, scene/task
  identity, evaluator mechanics, and the existing simulator language-selector
  boundary. Updated only directly affected Guided E2E assertions.
- Updated `docs/I18N.md` with the Guided presentation/evaluator boundary.

## Changed surface

- `src/types/task.ts`
- `src/core/tasks/taskRegistry.ts`, `evaluateTask.ts`, `feedbackEngine.ts`,
  `guidedTaskCopyKeys.ts`
- `src/components/simulator/TaskPanel.tsx`, `FeedbackPanel.tsx`,
  `taskHelpers.ts`
- `src/i18n/guidedTaskMessageKeys.ts` and typed `en`/`zh-HK` task catalogs
- `docs/I18N.md`
- Directly affected unit, integration, and Guided E2E assertions, including
  `src/tests/integration/guidedTaskCopy.test.tsx`

No package, dependency, CI, CSS, route, scene metadata, task criteria,
evaluator calculation, camera-state, optics, calibration, renderer, readout,
or Free Practice source changes were made.

## Validation

- Focused task/evaluator and presentation tests: passed; 6 files, 63 tests.
- Guided localization/completion/no-evaluation integration tests: passed;
  10 tests.
- `npm test`: passed; 113 test files, 1,060 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- Targeted Guided E2E (`mirror-shift-guided-lesson.spec.ts`,
  `shelf-swing.spec.ts`, `table-tilt.spec.ts`): passed; 27 tests.
- `git diff --check`: passed.
- `git status --short`: clean after the substantive commit, before this
  handoff update.

## Validation not run

- Full `npm run ci:local:e2e` was not run; the three affected Guided E2E specs
  provide proportional browser coverage and no renderer/optics behavior
  changed.

## Important decisions

- English is canonical; `zh-HK` satisfies the same typed task-message shape
  and uses the established terms 前組/後組, 視點, 構圖, 清晰焦平面, 底片平面,
  對焦屏, and 視差.
- Task and evaluator layers contain stable message references and numeric
  interpolation data only. They do not call i18next, read the active locale,
  or store translated output.
- Front Rise, Front Tilt, Front Swing, and Mirror Shift copy now preserves the
  current learning model: framing versus viewpoint, plane of sharp focus,
  Top-view relationships, and whole-camera movement versus Front Shift.
- No Guided Tasks were added to Understanding Camera Movements or Focus
  Fundamentals; no curriculum, readout, or simulator language-selector work
  was pulled forward.

## Remaining risks / known gaps

- Remaining simulator controls, Current Settings/Focus Targets readouts,
  diagnostics, and other non-Guided simulator copy remain on their existing
  architecture for later content PRs.
- The new zh-HK Guided copy has automated terminology coverage but still needs
  separate native-language editorial review.
- Full CI-local E2E remains deferred; no domain behavior was changed.

## Reviewer focus

1. Verify all four existing Guided Tasks have complete, semantically aligned
   `en` and `zh-HK` title, objective, notes, criteria, feedback, and control
   copy.
2. Verify task/evaluation core stays locale-neutral and an existing evaluation
   re-renders after locale change without reevaluation.
3. Verify Front Rise/framing, Front Tilt and Front Swing/plane of sharp focus,
   and Mirror Shift/Viewpoint-versus-Framing semantics are accurate.
4. Verify calibrated interpolation values come from existing criteria/calibration
   data and are not duplicated per locale.
5. Verify Guided structural labels, no-evaluation state, criterion results,
   progress, and completion summary are localized at presentation time.
6. Verify task/criterion IDs, thresholds, ordering, evaluator facts, final
   state, routes, scene state, and Free Practice behavior are unchanged.
7. Verify no i18n architecture expansion, simulator-copy migration, CSS,
   package, CI, optics, calibration, or renderer work entered the PR.

## Since previous review

- Addressed finding 1: normalized the remaining English Table Tilt and Shelf
  Swing secondary-feedback references from `focus plane`/`green focus plane`
  to the canonical `plane of sharp focus`/`green plane of sharp focus`.
- Addressed finding 2: changed the zh-HK composition-visibility pass message
  to `構圖目標的可見範圍已足夠`, preserving the existing visibility-coverage
  fail meaning.

## Commit

Substantive implementation: `e4986f1b5bc326921161415435f17eea31f77a46`
Review-fix implementation: `f5f7b59bc1be34fab315a87249ee18e5ed6d90e5`

Final bookkeeping: the status-only commit that records this handoff update;
intentionally not self-referenced to avoid recursive commits.
