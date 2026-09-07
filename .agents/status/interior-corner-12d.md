# Interior Corner 12D — Guided Lesson + Final Integration

## Objective

Turn the validated Interior Corner free-mode foundation into a deterministic Observe → Rise composition → receding-wall Swing + Focus → final Aperture guided lesson.

## Branch / worktree / base / head

`feature/interior-corner-guided-lesson-12d` · `/private/tmp/view-camera-interior-corner-12d-fresh` · base `13c2ad9c46b473584162b2eb05c7cd65a113d61a` · main syncs `8d8d378bcaa92b76ae1372555f480e2de00f158a`, `ee92962fa9ee0de46f6185b7bb70dec8ace830c9`; review-fix implementation `22063c4`; handoff correction `10016f08461fc230614a508b802030d7a66ad6fa`

## PR12A–12C prerequisites verified

Merged `origin/main` contains the Interior Corner scene, projected Rise evaluator, widened Focus reachability, generic vertical-plane calibration, accepted raw/public Swing + Focus calibration, and the PR12C handoff. Geometry, 150 mm lens, neutral 8000 mm focus, f/5.6 baseline, shared 0.1 mm CoC threshold, and Near/Middle/Far wall targets are preserved.

## Guided stage sequence

Observe (neutral and non-interactive) → Compose with public-grid Rise → Front Swing orientation → Refine Focus placement on the one receding side-wall plane at f/5.6 → stop down to f/11 while preserving the solved composition and open-aperture focus alignment. The opposite wall remains contextual.

## Control staging

Observe exposes navigation/readout access only; Compose exposes Rise; Front Swing exposes Swing; Refine Focus exposes Swing + Focus; Aperture exposes only Aperture with Rise/Swing/Focus locked. Direct guided task metadata matches the visible stage controls.

## Completion contracts

Composition reuses `evaluateInteriorCornerRiseComposition`. Wide-aperture alignment reuses `evaluateInteriorCornerSwingFocus`; the final stage rechecks that contract at f/5.6 before accepting the f/11 stop-down. No exact answer is surfaced, no auto-solve is used, and no new optics or renderer logic is introduced.

## Files / surfaces changed

Guided task criteria/registry, Interior Corner guided evaluation adapter, public guided-lesson metadata, route-state persistence, localized task/lesson copy, staged control presentation, restart navigation, focused unit/integration/browser tests, and this work-specific handoff. `CURRENT.md` and prior work-item handoffs are untouched.

## Validation run

Focused Vitest: 6 files, 103 tests passed. Full Vitest: 166 files, 1,621 tests passed. Typecheck, lint, CSS structure, build, and diff check passed. The focused Interior Corner Playwright scenarios each passed independently, and the final full local gate passed both Interior Corner E2E tests, including completed f/11 → Previous → Refine f/5.6 → Previous → Swing.

The final `CI=1 npm run ci:local:e2e` run passed all checks and reached the Interior Corner and Swing + Focus specs, then stopped at `mirror-shift-teaching-geometry.spec.ts:3` because its first test could not find the RTT element within 30 seconds; its second test passed. The exact same spec/test/line-32 RTT failure reproduced on clean current `origin/main` `ee92962fa9ee0de46f6185b7bb70dec8ace830c9`, establishing the documented baseline.

## Validation not run

The full local E2E matrix did not complete because of the reproduced clean-main Mirror Shift RTT baseline failure. No PR-owned Interior Corner failure remained; all PR-owned focused and full Vitest/browser checks passed.

## Since review

- The previous head `62e2cebc5062bc4cd9bfb6fbb71662a68877d662` lost solved Rise when route cleanup cleared the initialization marker during the free Observe → guided Compose transition.
- Interior Corner guided task routes now preserve the in-session photographic state in either navigation direction; returning to Align Focus restores f/5.6 without resetting Rise, Swing, or Focus.
- Fresh lesson deep links/reloads to later stages restart at canonical Observe when no recoverable prerequisite session exists.
- Guided Interior Corner stages expose Restart Lesson instead of destructive Reset Movements; free-mode Reset Movements remains unchanged.
- The exact-head full Vitest suite now passes; focused lifecycle and browser regression evidence was added.
- Optics, calibration, CoC thresholds, geometry, RTT, routing identity, and the accepted physical task contracts remain unchanged; Swing prerequisite acceptance is now monotonic for backward navigation.

## Since current review

- Synced current main through normal non-rebasing merges at `8d8d378` and `ee92962`; the branch is 0 behind main.
- Completed-Aperture browser coverage now sets f/11, verifies the solved Rise/Swing/Focus state, then proves Previous restores f/5.6 while preserving those movements and focus; revisited Swing remains passed with Continue available.
- The stage-entry guard evaluates the existing f/5.6 calibration contract before restoring f/5.6 on a backward Aperture → Refine transition, preventing a valid completed state from redirecting to Observe.
- The monotonic Swing prerequisite remains intact: both `refine-focus` and `aligned` pass, while neutral and wrong-sign Swing still fail.
- No optics, calibration, CoC threshold, geometry, RTT, or unrelated task behavior changed.

## Known limitations

Ground Glass assertions verify the existing RTT surface remains present/contentful; physical success remains evaluator-based. The final stage uses the existing modest f/11 aperture option.

## Publication

PR #130 is updated on the same feature branch. No PR state transition was performed; GitHub reported `isDraft=false` before and after publication. Implementation and reconciliation commit details are recorded in the completion report.

## Reviewer focus

Check stage route identity and persistence, monotonic Swing prerequisite acceptance, backward-navigation preservation, public control staging, wrong-sign protection, independent open-aperture focus recheck before stop-down, final Rise/Swing/Focus preservation, bilingual copy, and free-mode non-regression.

## Deferred

No later Interior Corner slice is in scope; this PR is the final guided-lesson integration requested.
