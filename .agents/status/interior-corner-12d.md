# Interior Corner 12D — Guided Lesson + Final Integration

## Objective

Turn the validated Interior Corner free-mode foundation into a deterministic Observe → Rise composition → receding-wall Swing + Focus → final Aperture guided lesson.

## Branch / worktree / base / head

`feature/interior-corner-guided-lesson` · `/Users/homan/repo/view-camera-interior-corner-12d` · base `1fd8b0b1e6c9fd4a657c922c3c2af538c82a55b9` · implementation `b701ee3`; review-fix head is recorded in the completion report

## PR12A–12C prerequisites verified

Merged `origin/main` contains the Interior Corner scene, projected Rise evaluator, widened Focus reachability, generic vertical-plane calibration, accepted raw/public Swing + Focus calibration, and the PR12C handoff. Geometry, 150 mm lens, neutral 8000 mm focus, f/5.6 baseline, shared 0.1 mm CoC threshold, and Near/Middle/Far wall targets are preserved.

## Guided stage sequence

Observe (neutral and non-interactive) → Compose with public-grid Rise → Align the one receding side-wall focus plane with Swing + Focus at f/5.6 → stop down to f/11 while preserving the solved composition and open-aperture focus alignment. The opposite wall remains contextual.

## Control staging

Observe exposes navigation/readout access only; Compose exposes Rise; Align Focus exposes Swing + Focus with Rise preserved; Depth of Field exposes Aperture with Rise/Swing/Focus locked. Direct guided task metadata matches the visible stage controls.

## Completion contracts

Composition reuses `evaluateInteriorCornerRiseComposition`. Wide-aperture alignment reuses `evaluateInteriorCornerSwingFocus`; the final stage rechecks that contract at f/5.6 before accepting the f/11 stop-down. No exact answer is surfaced, no auto-solve is used, and no new optics or renderer logic is introduced.

## Files / surfaces changed

Guided task criteria/registry, Interior Corner guided evaluation adapter, public guided-lesson metadata, route-state persistence, localized task/lesson copy, staged control presentation, restart navigation, focused unit/integration/browser tests, and this work-specific handoff. `CURRENT.md` and prior work-item handoffs are untouched.

## Validation run

Focused Vitest: 74 tests passed. Focused Playwright: 3 tests passed. Full Vitest: 1,582 tests passed. Typecheck, lint, CSS structure, build, and diff check passed.

The repository local CI gate was attempted end to end. Its Interior Corner guided-lesson, Architecture Rise Ground Glass, and preceding E2E groups passed, but the gate stopped on the unrelated `mirror-shift-teaching-geometry.spec.ts` RTT-content assertion (`ground-glass-rtt` was not found). No renderer or existing Ground Glass code is changed here.

## Validation not run

The broader local E2E gate did not complete because of the unrelated Mirror Shift failure above. The previously known Architecture Rise Ground Glass timeout did not recur in this run.

## Since review

- The previous head `62e2cebc5062bc4cd9bfb6fbb71662a68877d662` lost solved Rise when route cleanup cleared the initialization marker during the free Observe → guided Compose transition.
- Interior Corner guided task routes now preserve the in-session photographic state in either navigation direction; returning to Align Focus restores f/5.6 without resetting Rise, Swing, or Focus.
- Fresh lesson deep links/reloads to later stages restart at canonical Observe when no recoverable prerequisite session exists.
- Guided Interior Corner stages expose Restart Lesson instead of destructive Reset Movements; free-mode Reset Movements remains unchanged.
- The exact-head full Vitest suite now passes; focused lifecycle and browser regression evidence was added.
- Optics, calibration, CoC thresholds, geometry, RTT, routing identity, and guided task criteria are unchanged.

## Since main sync

- Integrated `origin/main` at `739b744a880826b3c34200645bac90f988a9436e` with a normal non-fast-forward merge; shared route, store, task, catalog, progress, localization, and test surfaces were reconciled additively.
- PR128 Oblique Tabletop guided metadata, task progression, staged controls, localized copy, and tests are preserved. PR129 Interior Corner bidirectional state persistence, deep-link recovery, Restart Lesson, and guided Reset protection are preserved.
- Post-sync focused Vitest passed (181 tests across the Interior/Oblique/shared suites); full Vitest passed (164 files, 1,593 tests). Typecheck, lint, CSS structure, build, and diff checks passed.
- Focused Interior Corner and Oblique Tabletop Playwright passed (4 tests). The broader local E2E gate passed through Interior Corner and all preceding groups, then stopped at the pre-existing `mirror-shift-teaching-geometry.spec.ts` RTT-content assertion (`ground-glass-rtt` not found); no Interior/Oblique failure occurred.
- Integration commit and current post-sync branch head: `e10d8ae6f8b75005e806ce08064803de0acaf284`.

## Known limitations

Ground Glass assertions verify the existing RTT surface remains present/contentful; physical success remains evaluator-based. The final stage uses the existing modest f/11 aperture option.

## Publication

Implementation commit `b701ee3` and pre-publication handoff `96ce222` remain unchanged. Draft PR #129 remains open as a draft; this focused lifecycle fix updates the same feature branch.

## Reviewer focus

Check stage route identity and persistence, public control staging, wrong-sign protection, independent open-aperture focus recheck before stop-down, final Rise/Swing/Focus preservation, bilingual copy, and free-mode non-regression.

## Deferred

No later Interior Corner slice is in scope; this PR is the final guided-lesson integration requested.
