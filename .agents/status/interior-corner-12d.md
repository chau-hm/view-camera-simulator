# Interior Corner 12D — Guided Lesson + Final Integration

## Objective

Turn the validated Interior Corner free-mode foundation into a deterministic Observe → Rise composition → receding-wall Swing + Focus → final Aperture guided lesson.

## Branch / worktree / base / head

`feature/interior-corner-guided-lesson` · `/Users/homan/repo/view-camera-interior-corner-12d` · base `1fd8b0b1e6c9fd4a657c922c3c2af538c82a55b9` · implementation `b701ee3`; pre-publication handoff `96ce222`; final publication commit is this handoff update and is recorded in the completion report

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

Focused Vitest: 125 tests passed. Focused Playwright: 2 tests passed in 1.1 minutes. Full Vitest: 1,581 tests passed. Typecheck, lint, CSS structure, build, and diff check passed.

The repository local CI gate was attempted end to end. All checks and earlier E2E specs passed, but the existing `groundglass-interaction.spec.ts` Architecture Rise drag/re-zoom test timed out at 120 seconds; its neighboring tests passed. No renderer or existing Ground Glass code is changed here.

## Validation not run

No required check was omitted. The local CI gate did not complete because of the unrelated existing E2E timeout above.

## Known limitations

Ground Glass assertions verify the existing RTT surface remains present/contentful; physical success remains evaluator-based. The final stage uses the existing modest f/11 aperture option.

## Publication

Implementation commit `b701ee3` and pre-publication handoff `96ce222` are complete. Draft PR #129 is open as a draft; final handoff publication and remote verification are recorded in the completion report.

## Reviewer focus

Check stage route identity and persistence, public control staging, wrong-sign protection, independent open-aperture focus recheck before stop-down, final Rise/Swing/Focus preservation, bilingual copy, and free-mode non-regression.

## Deferred

No later Interior Corner slice is in scope; this PR is the final guided-lesson integration requested.
