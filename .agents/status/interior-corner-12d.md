# Interior Corner 12D — Guided Lesson + Final Integration

## Objective

Turn the validated Interior Corner free-mode foundation into a deterministic Observe → Rise composition → receding-wall Swing + Focus → final Aperture guided lesson.

## Branch / worktree / base / head

`feature/interior-corner-guided-lesson-12d` · `/private/tmp/view-camera-interior-corner-12d-fresh` · base `13c2ad9c46b473584162b2eb05c7cd65a113d61a` · pre-reconciliation head `69bb824`; reconciliation commit `cd6f3bd`; current head is recorded in the completion report

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

Focused and full Vitest: 1,615 tests passed. Focused Interior Corner Playwright: 2 tests passed, including backward navigation from Aperture through Refine Focus to Swing. Typecheck, lint, CSS structure, build, and diff check passed.

The full local CI gate passed CSS, lint, typecheck, full Vitest, and build, then stopped at the unrelated `groundglass-interaction.spec.ts` Architecture Rise test after its 120-second timeout. The same named test timed out on clean current `origin/main` `8d8d378bcaa92b76ae1372555f480e2de00f158a`; no affected Interior Corner test failed.

## Validation not run

The full local E2E gate did not complete because the clean-main baseline reproduced the unrelated Architecture Rise Ground Glass timeout. The monotonic Swing criterion and route-backed backward-navigation regression passed.

## Since review

- The previous head `62e2cebc5062bc4cd9bfb6fbb71662a68877d662` lost solved Rise when route cleanup cleared the initialization marker during the free Observe → guided Compose transition.
- Interior Corner guided task routes now preserve the in-session photographic state in either navigation direction; returning to Align Focus restores f/5.6 without resetting Rise, Swing, or Focus.
- Fresh lesson deep links/reloads to later stages restart at canonical Observe when no recoverable prerequisite session exists.
- Guided Interior Corner stages expose Restart Lesson instead of destructive Reset Movements; free-mode Reset Movements remains unchanged.
- The exact-head full Vitest suite now passes; focused lifecycle and browser regression evidence was added.
- Optics, calibration, CoC thresholds, geometry, RTT, routing identity, and the accepted physical task contracts remain unchanged; Swing prerequisite acceptance is now monotonic for backward navigation.

## Since monotonic-stage review

- The Swing prerequisite now accepts both its intermediate `refine-focus` state and an already aligned state, so backward navigation cannot strand a solved learner at Swing.
- Added unit, route-backed integration, and browser coverage for fully aligned Swing state and Refine Focus → Previous → Swing → Continue, including preserved Rise/Swing/Focus, f/5.6 restoration, and final f/11 completion.
- Full local CI reached the unrelated Architecture Rise timeout; clean current `origin/main` reproduced the same 120-second test timeout. `origin/main` advanced to `8d8d378` during validation and was not merged into this focused fix.
- No optics, calibration, CoC threshold, geometry, RTT, or unrelated task behavior changed.

## Since test reconciliation

- `origin/main` at `13c2ad9c46b473584162b2eb05c7cd65a113d61a` was already integrated; the branch was 0 behind / 4 ahead at the start of this reconciliation.
- Reconciled stale expectations for the PR #131 Oblique Tabletop description, the final five-stage Interior Corner title/order, and safe later-stage lesson deep-link restart behavior.
- Reworked the workspace integration test to drive the actual route transitions through Observe → Compose → Front Swing → Refine Focus → Aperture, preserving Rise/Swing/Focus and final f/11 staging.
- PR128 Oblique Tabletop behavior and PR129 Interior Corner lifecycle protection remain preserved. No production implementation, optics, geometry, RTT, catalog, or localization behavior changed.
- The post-reconciliation broad E2E attempt passed the shared prerequisite checks and stopped only at the unrelated camera-movement-public-controls timeout; affected Interior Corner and Oblique Tabletop browser flows passed.

## Known limitations

Ground Glass assertions verify the existing RTT surface remains present/contentful; physical success remains evaluator-based. The final stage uses the existing modest f/11 aperture option.

## Publication

PR #130 is updated on the same feature branch. No PR state transition was performed; GitHub reported `isDraft=false` before and after publication. Implementation and reconciliation commit details are recorded in the completion report.

## Reviewer focus

Check stage route identity and persistence, public control staging, wrong-sign protection, independent open-aperture focus recheck before stop-down, final Rise/Swing/Focus preservation, bilingual copy, and free-mode non-regression.

## Deferred

No later Interior Corner slice is in scope; this PR is the final guided-lesson integration requested.
