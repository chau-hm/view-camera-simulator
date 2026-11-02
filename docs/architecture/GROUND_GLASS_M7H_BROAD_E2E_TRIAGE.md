# M7H — Broad E2E Failure Triage and Baseline Stabilization

## Decision

M7H establishes a digest-bound inventory of the retained M7G broad run and classifies all 99 historical failures. The M7H evaluator accepts the inventory, classification schema, reproduction provenance, and current-discovery drift. The broad suite itself remains **not qualified** because it was not rerun as a whole and 67 failures remain unclassified.

The current classification is 16 verified fixes, one verified failure still present but partially addressed, 15 tentative members of a collapsed task-drawer cohort, and 67 unclassified failures. No newly introduced regression was verified. A targeted four-worker scene-readiness failure was reproduced and then passed after a local readiness wait; it is retained as an intermediate candidate observation.

M7 remains `partially-qualified`. M8 remains denied. The external or spontaneous GPU device-loss limitation remains separate and was not reopened. Production Ground Glass remains WebGL-only.

## Baseline and discovery

| Evidence | Identity |
|---|---|
| PR #305 / current merged main | `cf5d91ab879208ea123a5b9a5d046cb5178217cf` |
| Historical M7G broad-run source | `095d9725a1ddb272bf780bd5e7e9e2a2b8f61837` |
| Historical raw report | `ground-glass-m7g-r187/validation/broad-e2e-playwright.json` |
| Historical raw SHA-256 | `393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6` |
| Historical result | 277 discovered, 103 expected, 99 unexpected, 75 skipped, 0 flaky |
| Older clean-main comparison source | `bda4ce9244111517e0898a0ead3b61d5faba7eb2` |

Current discovery at source `ac2ba26b988bcd2d68637bf80f43bb4ad09ad30b` contains **278 tests across 80 spec files**. It adds one Architecture Rise smoke test; no historical test IDs were removed or renamed. The captured test-list SHA-256 is `60f4b1997b883442d8bdb3ee1bc67302021e2c636ccc00d3733a8176e3e28b9e`. The new smoke test is additive and is not counted as a historical failure.

## E2E architecture audit

- The ordinary `chromium` project uses Playwright's bundled Chromium and the Vite development server. It is not the native-required `chrome-native-webgpu` project.
- Ordinary runs of the research fixtures observed WebGPURenderer reporting that WebGPU was unavailable and running with its WebGL2 backend. These are fallback compatibility checks and do not qualify native WebGPU.
- `playwright.config.ts` forwards process variables to Vite and explicitly sets trusted development flags. The separate native project is selected only by native-required environment flags. Test-seam assumptions are not enabled by the ordinary configuration.
- `scripts/e2e-spec-policy.mjs` keeps production-preview specs separate. `playwright.production.config.ts` builds and serves a production preview on its own port and has its own project.
- Each Playwright test has an isolated page/context, but tests in one worker pool share browser and host resources. The historical broad run used four workers; selected M7H comparisons use fresh Vite servers, isolated ports, and explicitly recorded worker counts.
- Tests use a mix of direct route entry and public scene navigation, fixed and responsive viewports, development fixtures, and production preview. No evidence in the retained failures shows an optimized Vite dependency or module-load error. The WebGPU-module cohort was a test asserting that no development source modules were requested, even though the renderer remained WebGL.
- The M7H runs are ordinary Chromium only. They make no claim about external GPU hardware acceleration, native WebGPU, or spontaneous device loss.

## Failure landscape

All 99 failures appear exactly once in the machine-readable inventory. The evaluator independently checks the source digest, 277 historical tests, result totals, failure identities, attached raw reproduction reports, and the current discovery artifact.

### Evidence-supported cohorts

| Cohort | Count | Evidence and disposition |
|---|---:|---|
| Fixed r186 expectations in ordinary fallback tests | 12 | All 12 fail at current main because the installed revision is 187; all 12 pass after assertions use the installed `REVISION`. Native-required r186 expectations remain revision-specific. |
| Task and lesson content hidden in the collapsed learning drawer | 17 | The cumulative Architecture + Foreground objective is fixed by opening the drawer through the public interaction. The compound task gets past the hidden heading but still times out at Restart task. Fifteen related visibility failures are tentative cohort members and were not individually compared. |
| Development module requests confused with renderer selection | 1 | The ordinary route now asserts renderer attempt, family, and execution backend. The production zero-module-request control is unchanged. |
| Scroll expectation without a constrained viewport | 1 | At 1440px, `scrollHeight` and `clientHeight` were both 404px. A 1024px viewport creates actual overflow; the four-worker candidate run passes. |
| Scene catalog order assumption | 1 | Clean main fails an array-index assertion. The candidate checks required scene-card membership without relying on catalog order. A bounded 15-second scene-canvas readiness wait passed in the matched four-worker candidate run. |
| Unclassified | 67 | No matched per-test baseline/candidate reproduction was completed. Historical error signatures and original messages remain in the inventory. |

The 17 task/lesson visibility symptoms are a shared candidate cohort, not 17 verified root causes. The 15 unpaired members retain `tentative` confidence. The compound-task test is `partially-addressed`, not fixed.

### Historical error signatures

| Signature | Count |
|---|---:|
| Test timeout | 32 |
| Visibility assertion | 25 |
| Renderer revision assertion | 12 |
| Attribute assertion | 10 |
| Predicate timeout | 8 |
| Count assertion | 5 |
| CSS assertion | 2 |
| Value-equality assertion | 1 |
| WebGPU policy/runtime assertion | 1 |
| Value assertion | 1 |
| Text assertion | 1 |
| Other assertion | 1 |

The most failure-dense specs were `table-tilt` (7), `oblique-architecture` (5), `scene-view-focus` (5), and `camera-controls-compact`, `fringe-club-dev-integration`, `ground-glass-webgpu-coc-footprint`, `shelf-swing`, and `viewport-learning-overlay` (4 each). These are counts by historical test file, not causal assignments.

## Controlled reproductions

The captured environment was macOS 27.0.1 arm64, Node.js 24.3.0, Playwright 1.61.1, Chromium 149.0.7827.55, and Three.js 0.187.0 (`REVISION === "187"`). All development comparisons use project `chromium`, fresh Vite servers, and ordinary non-native flags. Raw test reports retain the actual Playwright arguments, worker configuration, project, output path, and source SHA. The report records the full command for every selected run.

- The 12-test fallback revision cohort failed 12/12 on current main `cf5d91a` and passed 12/12 at candidate source `d560fd1`.
- A five-test current-main UI/module sample failed 5/5 at one worker. The candidate at `fdb2f46` passed the objective and scene-card checks, but its compound task still failed later at the restart action. That intermediate run also exposed two incorrect candidate assertions; final module and scrolling evidence comes from the subsequent `4a17fb6` capture.
- On current main, the same three UI representatives (objective visibility, scene-card discoverability, and drawer scrolling) failed under both one and four workers. At candidate source `ac2ba26`, all three passed under both one and four workers. The candidate first failed the scene-canvas readiness assertion at five seconds under four workers while the route showed “Loading simulator workspace…”. A targeted 15-second assertion then passed; no suite-wide timeout was changed.
- An ordinary Chromium smoke run at `ac2ba26` passed 2/2 tests: home route and client-side navigation to contentful Architecture Rise WebGL Ground Glass, including Raw/Upright controls and Focus Loupe state.
- The production-preview isolation run at `ac2ba26` first timed out while the test decoded and classified every pixel from a later Ground Glass screenshot; its second test passed. The failure was in test-side screenshot analysis, not a backend-isolation assertion. Commit `13ea2d5` bounded analysis to a regular sample grid (at most about 100,000 sample positions) while preserving the 12-color and 20-foreground-pixel contentfulness thresholds. The next capture passed 2/2 in 2.6 minutes, but a later screenshot-heavy capture still hit the 120-second test timeout after WebGL page work. Commit `01bace8` kept the contentfulness proof on the initial WebGL output and removed redundant screenshots after hostile URL requests; those requests remain checked through renderer family, execution API, attempt count, material-output policy, and module-request evidence. The final production-preview run passed 2/2 in 1.9 minutes. Hostile WebGPU query requests kept Observer and Ground Glass on WebGL, with zero WebGPU attempts, zero WebGPU module requests, no test seam, and contentful WebGL output.

These are bounded selected tests, not a rerun of the 277-test broad suite. The captures intentionally keep each source revision explicit; the runs at `d560fd1`, `4a17fb6`, and `ac2ba26` are not relabeled as a later documentation/CI commit.

## Implemented changes

- Updated ordinary Chromium fallback tests to compare against installed Three.js `REVISION` and assert that execution is not native WebGPU. Native-required branches retain their exact native revision contract.
- Changed the Architecture Rise route test to observe selected renderer identity and keep development source-module requests as diagnostics. Production module isolation remains independently asserted.
- Added shared public drawer-opening and pinning helpers for tests that need task or lesson content. The helpers wait for observable open state and preserve keyboard accessibility paths.
- Corrected the objective visibility test to prove that the objective exists while the drawer is collapsed, then open the drawer and verify that it becomes visible.
- Replaced scene-array position assumptions with required-card membership checks; added a route-specific readiness wait for the scene canvas.
- Constrained the drawer-scroll test to a viewport that produces real content overflow.
- Added an Architecture Rise WebGL smoke flow and hosted Chromium smoke/production-isolation steps. Captured timeouts in repeated test-side screenshot analysis led to bounded sampling and a single contentfulness proof; the production identity and authorization checks remain on every hostile URL request. The final production isolation run passed 2/2. The workflow also validates the offline M7H report.
- Added the M7H inventory extractor, strict offline evaluator, comparison CLI, mutation tests, raw selected-run captures, and this report. Historical M7G files were not modified.

No application renderer, optics, scene, or production backend implementation was changed.

## Reproducibility commands

```bash
npm run e2e:triage:m7h
npm run evidence:check:m7h
npm run e2e:compare:m7h -- --compare-report=<raw-playwright-json> \
  --source-commit-sha=<40-hex-source-sha> \
  --browser-version=<browser-version> \
  --invocation='<exact-playwright-invocation>'

npm run test:e2e -- --project=chromium --workers=1 src/tests/e2e/smoke.spec.ts
npm run test:e2e -- --config=playwright.production.config.ts \
  --project=chromium-production-preview --workers=1 \
  src/tests/e2e/architecture-rise-webgpu-production.spec.ts
```

The CLI is offline unless an explicit raw report is supplied. It does not run browser tests. Live Playwright runs require the local browser and a Vite server bound to loopback.

## Initial PR #306 validation at the reviewed HEAD

- `npm test`: **313 files, 3,514 tests passed**.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`: all passed on the final test implementation.
- `npm run evidence:check:m7h`: passed; historical inventory 277/277 and failure inventory 99/99 reconcile, with 16 verified fixes, 1 partially addressed, 15 tentative, and 67 unclassified. Broad E2E remains `not-qualified`.
- Focused M7H evaluator mutation tests: **13 passed**.
- Ordinary Chromium application smoke: **2/2 passed** at candidate source `ac2ba26`.
- Production-preview WebGL isolation: final **2/2 passed** at candidate source `01bace8`; the first timeout and intermediate harness runs are retained as separate captures.
- `npm run evidence:replay:m7e -- --no-write-report`: passed all **12/12** offline capture scenarios.
- `npm run evidence:replay:m7f`: passed all **17/17** presentation scenarios.
- `npm run evidence:report:m7g`: evidence integrity passed; **5 passed, 2 blocked**, M7 `partially-qualified`, M8 denied. Replay-generated changes to historical M7F/M7G reports were restored; those files remain unchanged in this PR.
- The 277-test broad Playwright suite was not rerun. The new selected smoke and production-preview runs are recorded separately and do not qualify the full suite.
- Hosted run `41326981743` passed all configured checks on reviewed HEAD `264007ab84b48a5b1f90ce668c4ec8f7c56ee3f3`; that prior result does not validate the v3 review-fix commit.

## Outstanding backlog and priority

1. Reproduce and classify the 67 remaining historical failures on matched clean-main and candidate runs, beginning with production WebGL controls, routing/accessibility, and renderer-resource tests.
2. Individually validate the 15 tentative learning-drawer failures. Keep product behavior unchanged unless a user-facing defect is demonstrated.
3. Stabilize the Architecture + Foreground compound task's Restart task action; it remains the one verified baseline failure that is only partially addressed.
4. Compare further timeout and predicate-timeout representatives under isolated and concurrent runs before assigning timing, resource, or application causes.
5. Do not infer a Vite dependency-loading defect from the module-request assertion. No optimized-module failure was observed in the retained raw errors.
6. The full broad suite was not rerun. M7 broad E2E therefore remains `not-qualified`.

Spontaneous/external GPU device loss remains the separate M7G blocker. M5Q remains partially qualified, M6 photographic quality remains unqualified, M8 entry remains denied, and production WebGPU remains disabled.

## M7H Review-Fix Round 1 — Verified Fix and Raw Outcome Integrity

### F1 — Verified fixes require an actual deterministic pass

The review reproduction changed a matched candidate from an ordinary pass to `expectedStatus: "failed"` with a final raw `failed` result, then recomputed the attached artifact digest. The v2 evaluator still accepted the `verified-fixed-on-head` classification because it only compared Playwright's expected/unexpected label. This isolated mutation did not alter any committed capture.

Evaluator v3 now requires the candidate's declared expectation and final result to both be `passed`, its Playwright outcome to be expected, and its result history to have no retries. The baseline must show a corresponding expected-pass failure, timeout, or interruption-only run; the raw status remains distinct from Playwright's aggregate skipped label. Expected failures, skips, unexpected passes, timeouts, interruptions, missing results, invalid statuses, and retry-dependent passes cannot satisfy the candidate-pass predicate. Existing-on-base and introduced-on-head classifications also require the appropriate raw failure/pass pair.

The mutation suite rejects the expected-failure attack and the other candidate outcome variants while retaining positive controls for a single actual pass and matched existing-on-base failures. Replaying the accepted M7H report keeps all **16 verified fixes**, **16 remediated entries**, **1 existing/partially addressed failure**, **15 tentative cohort members**, and **67 unclassified failures**. The stronger predicate did not require downgrading a submitted fixed claim.

### F2 — Raw test results are the comparison authority

The review reproduction supplied a complete 278-test ordinary-Chromium report with one actual failure while declaring `stats.unexpected: 0`. The old CLI exited successfully. The inverse all-pass raw tree with `stats.unexpected: 1` was also added as a negative control.

Evaluator v3 derives `expected`, `unexpected`, `skipped`, `flaky`, and `incomplete` from ordered raw test results, validates stable identities and duplicates, and checks every declared Playwright statistic against the derived counts. The implementation follows the installed Playwright 1.61.1 `computeTestCaseOutcome` semantics: retries are flaky only when the history contains both expected and unexpected attempts; an interruption-only history is reported as skipped while its raw status remains visible. Missing or malformed results are incomplete and block qualification.

The comparison CLI emits machine-readable diagnostics for invalid reports and exits nonzero when raw outcomes, summary statistics, or the expected current inventory disagree. A statistics-consistent expected failure remains classified as an expected Playwright outcome, but it is not counted as an actual passing test. The process-level CLI cases cover all-pass success, hidden and contradictory failures, missing/malformed stats and results, flaky/skipped outcomes, inventory drift, duplicate identities, project mismatch, expected-failure behavior, and digest recomputation.

### Provenance and remaining limitations

The evaluator revision is `m7h-broad-e2e-triage-evaluator-v3`. The retained historical M7G report remains SHA-256 `393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6`, sourced from `095d9725a1ddb272bf780bd5e7e9e2a2b8f61837`; the accepted PR #305 base identity remains `cf5d91ab879208ea123a5b9a5d046cb5178217cf`. Baseline and candidate source commits and report digests in the selected-run inventory are unchanged.

This was an offline evaluator correction. No new browser or native GPU capture was taken, and the 277-test broad suite was not rerun. Therefore broad E2E remains `not-qualified`; the 15 tentative and 67 unclassified outcomes remain open. M7 remains `partially-qualified`, spontaneous/external device loss remains blocked, M8 entry remains denied, and production Ground Glass remains WebGL-only.

### Review-fix validation

- Focused evaluator and process-level CLI tests: **57 passed** (28 evaluator tests and 29 CLI process cases).
- `npm test`: **314 files, 3,558 tests passed**.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`: passed.
- `npm run evidence:check:m7h`: passed; 277 discovered, 103 expected, 99 unexpected, 75 skipped, 0 flaky; 99 failure classifications reconcile; 16 verified fixed, 1 partially addressed, 15 tentative, and 67 unclassified.
- `npm run evidence:replay:m7f`: **17/17 passed**. The regenerated report was directed to a temporary output path; the committed M7F report was not rewritten.
- `npm run evidence:report:m7g`: result is recorded after this review-fix commit; generated report and evaluation use temporary worktree paths so historical M7G records remain unchanged.
- `git diff --check`: passed. No browser tests or full broad E2E rerun were required for this offline evaluator-only correction.

## Machine-readable evidence

The report's evaluator is `m7h-broad-e2e-triage-evaluator-v3`; inventory, classification, and reproduction integrity pass, while `broadE2eQualification` remains `not-qualified`. See [the M7H report JSON](GROUND_GLASS_M7H_BROAD_E2E_TRIAGE_REPORT.json) and [persisted selected-run artifacts](ground-glass-m7h-broad-e2e/).
