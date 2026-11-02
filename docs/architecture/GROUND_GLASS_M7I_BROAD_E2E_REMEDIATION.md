# M7I — Broad E2E Root-Cause Remediation

**Base:** `57eacc0d7c41014a3288cbee63a8b58a7aa08557` (PR #306 merge)
**Candidate implementation:** `5c909376489e44e4c247c8e69372c84f52688421`
**Runtime:** ordinary Chromium, Playwright `1.61.1`, Three.js `0.187.0`
**Decision:** broad E2E remains `not-qualified`; M7 remains `partially-qualified`; M8 entry remains denied.

## Scope and method

M7I starts from the accepted M7H failure inventory. It preserves all 99 historical unexpected-failure identities and records current test outcomes separately. The historical raw Playwright report remains sourced from `095d9725a1ddb272bf780bd5e7e9e2a2b8f61837` with SHA-256 `393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6`. The accepted M7H evaluator remains `m7h-broad-e2e-triage-evaluator-v3`.

The investigation began with the 15 tentative drawer tests, the partially addressed Architecture + Foreground compound task, then representative controls, renderer readiness, lifecycle, and worker-sensitivity tests from the 67 unclassified failures. Each selected run uses a fresh Vite port and records the source SHA, worker count, browser, environment, exact invocation, raw report, and digest. Candidate claims require the same test identity to fail on the four-worker baseline and pass on the candidate with zero retries.

Current Chromium discovery is **278 tests in 80 spec files**. This is distinct from the historical 277-test M7H run.

## Tentative learning-drawer cases

All 15 tests ran to completion on merged main in the selected one-worker run. Each was an actual pass with zero retries, so the historical drawer failures were **not reproduced**. This does not prove a common cause; all 15 remain tentative in the historical disposition. Thirteen tests use the pinned drawer contract. The two transient cases are Shelf Swing's mismatched/free-route checks and Table Tilt's zero-tilt point-focus exercise.

| Test | Drawer contract | Current result |
|---|---|---|
| Architecture + Foreground DOF task, solved start and Aperture-only completion | Pinned | Not reproduced; full test passed |
| Architecture + Foreground five-stage Guided Lesson | Pinned | Not reproduced; full test passed |
| Architecture + Foreground lesson entry and direct task routes | Pinned | Not reproduced; full test passed |
| Architecture + Foreground Rise task | Pinned | Not reproduced; full test passed |
| Architecture + Foreground Tilt + Focus task | Pinned | Not reproduced; full test passed |
| Interior Corner Compose → Swing → Refine → Aperture lesson | Pinned | Not reproduced; full test passed |
| Interior Corner preserves solved focus when returning to Swing | Pinned | Not reproduced; full test passed |
| Oblique Architecture guided Rise task | Pinned | Not reproduced; full test passed |
| Oblique Architecture guided Swing + Focus task | Pinned | Not reproduced; full test passed |
| Oblique Architecture compound Rise, Swing, and Focus task | Pinned | Not reproduced; full test passed |
| Oblique Architecture four-stage lesson | Pinned | Not reproduced; full test passed |
| Oblique Tabletop Focus → Tilt → Swing → Focus → Aperture lesson | Pinned | Not reproduced; full test passed |
| Shelf Swing mismatched/free-route checks | Transient | Not reproduced; full test passed |
| Shelf Swing negative-swing task | Pinned | Not reproduced; full test passed |
| Table Tilt zero-tilt point-focus sequence | Transient | Not reproduced; full test passed |

The per-test historical error, interaction contract, raw outcome, and follow-up are recorded in the machine-readable report.

## Compound Restart task

The complete Architecture + Foreground compound task passed on merged main and on the candidate, including both Restart actions, the Rise/Tilt/Focus/Aperture reset assertions, and final task completion. Both runs used one worker and matching browser/runtime configuration, with separate Vite ports. Because the failure was not reproduced on the baseline, this remains a `not-reproduced` observation, not a candidate fix. The M7H historical `partially-addressed` classification remains preserved.

## Matched worker cohorts and bounded changes

| Run | Workers | Expected | Unexpected | Skipped | Flaky |
|---|---:|---:|---:|---:|---:|
| Baseline selected drawer + compound run | 1 | 16 | 0 | 0 | 0 |
| Candidate compound Restart test | 1 | 1 | 0 | 0 | 0 |
| Baseline C1–C4 representative cohort | 1 | 5 | 0 | 0 | 0 |
| Baseline C1–C4 representative cohort | 4 | 1 | 4 | 0 | 0 |
| Candidate C1–C4 representative cohort | 1 | 5 | 0 | 0 | 0 |
| Candidate C1–C4 representative cohort | 4 | 2 | 3 | 0 | 0 |

Two matched test-harness corrections passed their complete tests at four workers, with zero retries:

- The Fringe Observer remount assertion now waits up to 30 seconds for the specific candidate identity. The baseline four-worker run failed that same identity assertion; the candidate completed the whole sibling-removal lifecycle test.
- The drawer auto-hide test moves focus to the public Scene control before checking pointer-out collapse. This preserves the drawer's rule to remain open while focus is inside it. The matched baseline failed; the candidate completed the whole drawer test.

The Scene View Focus test now uses a bounded 15-second wait for its canvas and active-renderer state. It progressed past its original startup assertion on the candidate, but later timed out waiting for Reset 3D view at 90 seconds. That test is **partially addressed**, not a verified fix.

The responsive Camera Controls test still times out under four workers during browser-side layout inspection. The Table Tilt resource-stress test passes at one worker and on the four-worker baseline, but timed out in the four-worker candidate while querying the live WebGL context. Because the same test passed in both one-worker runs and on the baseline, this comparison is inconclusive; it is not evidence of a resource leak or a product regression.

The worker-count comparison shows a worker-sensitive renderer/browser execution problem, but it does not establish one lower-level cause for all four original failures. No optics, renderer algorithm, canonical state, or production backend code changed.

## Disposition of the original 67 unclassified failures

All 67 identities and original error messages remain in the historical inventory. Two have matched M7I candidate evidence and are recorded as verified fixes: Fringe Observer remount readiness and the drawer pointer-out interaction. One other representative, Scene View Focus, progressed beyond startup but remains incomplete. The controls and Table Tilt representatives remain unresolved or comparison-inconclusive. The other 63 unclassified failures have no M7I reproduction evidence.

The report therefore retains all 67 original entries, with **2 newly verified fixes and 65 unresolved**. The other 62 unclassified cases have no M7I reproduction evidence. The 15 drawer cases remain separate and are not silently promoted from tentative to verified shared-cause fixes.

## Broad-run readiness

The full ordinary Chromium suite was **not run**. The matched four-worker cohort still has three candidate timeouts, and most of the original unclassified inventory has not received matched comparisons. A 278-test run would not provide an interpretable qualification result under those conditions.

The broad suite remains `not-qualified`. The selected one-worker passes and smoke tests do not qualify the full suite. Ordinary Chromium is not native WebGPU evidence.

## Validation

Validation results are tracked in the machine-readable report and supporting artifacts. The M7I offline evidence check verifies:

- the accepted M7H raw and triage report identities and digests;
- all 99 historical failure identities, including the 15 tentative drawer cases and all 67 unknowns;
- raw-report digests, per-test identities, Playwright results, retries, run configuration, and aggregate counts;
- matched baseline/candidate source and environment for every claimed fix;
- full-test actual passes, not skips, expected failures, or retry-dependent outcomes;
- the 278-test discovery artifact and broad-run readiness decision;
- the unchanged M7, M8, M5Q, external-device-loss, and production authorization boundary.

On the implementation candidate, `npm test` passed **3,583 tests across 315 files**; typecheck, lint, CSS checks, and production build passed. M7H integrity passed with the accepted 277 / 103 / 99 / 75 / 0 historical counts. The 25 M7I evaluator mutation tests passed. M7F replay passed **17/17**; M7G integrity passed with **5 passed and 2 blocked**, M7 partially qualified, and M8 denied. Ordinary Chromium smoke passed **2/2**. Production-preview isolation passed **4/4**, including the WebGL-only default and hostile WebGPU-selection denials.

The mutation suite exercises invented passes, expected failures, retry passes, skips, missing/duplicate identities, contradictory stats, mismatched source/environment, omitted historical entries, partial-run-as-broad claims, and unauthorized production/M8 changes.

## Remaining work and authorization

1. Diagnose why the Camera Controls, Scene View Focus, and Table Tilt representatives stall under four workers; determine whether the environment or renderer workload needs isolation before a controlled broad run.
2. Continue matched investigation of the remaining 65 unclassified historical failures.
3. Revisit the 15 drawer cases only if a later full run reproduces their exact identities.

M7 overall remains **partially-qualified**. Spontaneous/external device loss remains **blocked**. M5Q quality remains **partially-qualified**. M8 entry remains **denied**. Production Ground Glass remains **WebGL-only**.

See the [machine-readable M7I report](GROUND_GLASS_M7I_BROAD_E2E_REMEDIATION_REPORT.json), [raw reproductions](ground-glass-m7i-broad-e2e/reproduction/), [current discovery](ground-glass-m7i-broad-e2e/validation/current-chromium-discovery.txt), [validation summary](ground-glass-m7i-broad-e2e/validation/validation-summary.json), and [accepted M7H report](GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json).
