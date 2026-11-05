# M7M — Scene / Ground Glass Readiness Cohort

**Status:** Investigated; no application correction was justified. The selected cohort remains worker-sensitive and unresolved.

**Application execution and Playwright runner source:** `0c32f113c1e3d16a8fd42e7748c64909366c6ae8` (the M7L squash merge on `main`). The retained M7M normalizer and initial evaluator source are at `e6c139ef60974a544f75a45d062b92101d31d115`; neither is claimed as the exact uncommitted tooling used at capture time.

**Evaluator:** `m7m-scene-readiness-evaluator-v2`
**Three.js:** `0.187.0`

## Historical context and current discovery

M7K's accepted complete capture remains 278 discovered tests: 121 passed, 82 unexpected, and 75 skipped, with zero flaky or incomplete outcomes. The 4-test renderer-serial lane passed 4/4. Its complete execution is not Broad E2E qualification because unexpected failures and unapproved skips remain.

M7L investigated 11 identities with zero verified fixes. Its historical raw Playwright captures were not retained for offline replay; that limitation remains explicit in the [M7L report](GROUND_GLASS_M7L_LEARNING_DRAWER_REMEDIATION.md).

M7M preserves 12 selected identities from the M7L historical inventory. Current `--list` discovery is recorded separately from test execution: ordinary Chromium found 274 tests in 80 spec files, and the renderer-serial project found 4 tests in 4 spec files, for 278 combined discovered tests. The original ordinary and renderer-serial list outputs are retained under [discovery](ground-glass-m7m-scene-readiness/discovery/); their SHA-256 hashes, project names, counts, spec-file totals, and selected identities are checked offline. All 12 selected identities matched the ordinary Chromium discovery list. This is not a completed 278-test run.

## Controlled results

All cohort captures used ordinary Chromium, configured worker counts 1, 2, and 4, and zero retries. Measured overlap matched each configured count.

| Capture | Discovered | Passed | Failed | Max concurrent | Retries |
|---|---:|---:|---:|---:|---:|
| Cohort, 1 worker | 12 | 11 | 1 | 1 | 0 |
| Cohort, 2 workers | 12 | 9 | 3 | 2 | 0 |
| Cohort, 4 workers | 12 | 4 | 8 | 4 | 0 |

The five representative tests passed 4/5 at one worker. The four representative readiness/focus cases each passed alone; the viewport-ratio case failed alone at one worker with measured ratio `1.1988203216292916` against `1.25`. That geometry failure also reproduced in the 1- and 2-worker cohort and is classified separately from renderer readiness.

A matched four-worker peer probe passed the canvas target with three lightweight peers (4/4). With three renderer-heavy peers, only 1/4 passed; the target lacked a canvas and two peers timed out. Both runs measured four concurrent tests. This associates the failure with that scheduling mix but does not prove a renderer contention mechanism or root cause.

## Readiness and lifecycle observations

- In the four-worker trace subset, the route URL reached `/simulator/free/architecture-rise`, but the heading assertion snapshot still showed the “Loading simulator workspace” fallback. This supports a route/workspace readiness delay for that observation; it does not establish a renderer failure.
- At the canvas failure, the simulator shell, `3D Scene` heading, and `scene-canvas` container were present, but the container had zero canvas descendants at five seconds. Renderer status and generation were not captured, so WebGL initialization failure is unproven.
- The controlled renderer recovery test observed an empty renderer-family attribute at four workers. It passed alone and in the 1/2-worker matrix. Its test seam deliberately injects a material-module failure; it does not exercise native WebGPU.
- Two focused one-worker lifecycle tests passed. They verified valid, contentful Ground Glass RTT output; current scene/RTT identity; detachment of prior scene and RTT nodes; and fresh scene generation after an A→B→A SPA transition. No stale publication was observed in this focused check.
- The physical camera-anchor test passed at 1, 2, and 4 workers. Continuous viewpoint focus passed at 1 and failed at 2 and 4. The separate SPA focus predicate failed at 2. No camera geometry changes were made.
- The trace subset is diagnostic and excluded from clean cohort totals. No GPU readback, native GPU capture, or renderer status/generation instrumentation was added.

The evidence does not establish a shared lower-level cause. In particular, missing canvas does not prove context creation failure, a missing heading is not a renderer diagnosis, and a passing focused SPA lifecycle check does not establish that every transition is stable.

## Remediation decision

No application lifecycle, renderer, RTT, optics, or test-assertion change was justified by the available evidence. There are zero verified fixes. Currently passing cases remain traceable but are not promoted to fixed. The viewport geometry failure remains separate.

The prioritized next step is to capture renderer status/generation and page errors from route navigation through canvas mount under matched lightweight and renderer-heavy load. Keep the viewport ratio investigation separate. Do not repeat the complete suite until targeted mechanisms are better established.

## Evidence integrity and privacy

The [machine-readable report](GROUND_GLASS_M7M_SCENE_READINESS_REPORT.json) pins the M7K report digest, M7L report and historical inventory digests, 13 normalized experiment artifacts, selected identities, outcomes, worker concurrency, and qualification boundaries. The offline evaluator rejects altered capture and discovery digests, source identities, project names, outcomes, worker metadata, historical identities, mutation coverage, and qualification claims.

Normalized captures are under [`ground-glass-m7m-scene-readiness/`](ground-glass-m7m-scene-readiness/). Original Playwright JSON remains private-local-only and uncommitted because it contains absolute paths and environment data. During Review-Fix Round 1, all 13 matching private raw captures were replayed with the retained normalizer and produced normalized output bytes identical to the committed artifacts. This confirms replay with the retained implementation; it does not identify the exact normalizer bytes used at capture time, and independent replay remains unavailable without the private raw inputs.

The focused lifecycle regression is persisted as `ground-glass-m7m-scene-readiness/validation/lifecycle-rtt-spa-w1.json`. The existing production-preview WebGL isolation test passed 4/4 with zero retries. The M7M focused suite passed 63/63: 56 required evidence mutations, positive and manifest/source/CLI controls, and an exclusive-create check that preserves an existing normalized artifact. CLI negative controls verify contradictory qualification and substituted tooling provenance exit nonzero. The synthetic post-squash replay starts with the pinned commits unavailable and passes only after retained source retrieval.

CI runs `npm run evidence:check:m7m` after the inherited M7 evidence gates. The twelve-test concurrency matrix is not added to hosted CI, and `deploy` remains dependent on successful `ci`.

## Validation record

| Check | Result |
|---|---|
| Full unit/integration suite | 3,799 passed across 320 files |
| M7M focused evidence suite | 63/63 passed; 56 named mutation cases |
| Typecheck / lint / CSS structure / production build | Passed |
| M7M evidence CLI | Passed; 12 identities, zero verified fixes |
| M7H / M7I / M7J / M7K schema v1 / M7L evidence | Passed |
| M7K schema-v2 selected report | Evidence integrity passed; incomplete execution and blocked qualification preserved |
| M7F replay / M7G consolidation report | M7F 17/17 scenarios replayed; M7G integrity passed and qualification remains partial |
| Production-preview WebGL isolation | 4/4 passed, zero retries |
| Focused Ground Glass RTT / SPA lifecycle | 2/2 passed, one worker |
| Full 278-test Broad E2E | Not run |

Replay outputs were written to temporary paths and removed after validation. The M7K selected report remains incomplete/blocked, and the M7G result remains partially qualified.

## Qualification boundary

M7M qualifies only the integrity and completeness of this selected investigation, not the application-wide suite.

```text
Full Broad E2E: not run / not-qualified
M7 overall: partially-qualified
M8 entry: denied
Spontaneous/external GPU device loss: blocked
M5Q: partially-qualified
M6: development-only
Production Ground Glass: WebGL-only
Production WebGPU: disabled
```

## M7M Review-Fix Round 1 — Tooling Provenance and Discovery Replay Boundary

### F1 — Separate execution source from evidence tooling

The original report incorrectly reused the M7L execution commit, `0c32f113c1e3d16a8fd42e7748c64909366c6ae8`, as the M7M tooling commit. That commit contains the application, Playwright configuration, and test files used for the investigation, but it predates the M7M normalizer and evaluator. The v2 report now records distinct roles:

- **Execution and Playwright runner:** `0c32f113c1e3d16a8fd42e7748c64909366c6ae8`. The evaluator verifies `playwright.config.ts` and all 84 spec files listed by the retained ordinary and renderer-serial discovery outputs in this commit.
- **Retained normalizer and initial evaluator implementation:** `e6c139ef60974a544f75a45d062b92101d31d115`. The CLI checks the commit, each source path, and the file SHA-256 values recorded in the report.
- **Exact capture-time normalizer and evaluator sources:** unverified. The retained commit is a replayable implementation; its existence does not establish that these exact bytes were used in the earlier uncommitted capture session.

The original private raw inputs are still available only in local temporary storage. Replaying all 13 with the retained normalizer produced exact byte matches for the 13 committed normalized files. This supports normalization replay with the retained source without upgrading the historical source identity claim or making raw evidence independently replayable.

CI uses `scripts/fetch-m7k-execution-source.mjs` to fetch the exact retained tooling commit, with `refs/pull/311/head` as the history fallback, and verifies the normalizer/evaluator paths before the M7M evidence check. It retains the pinned commit under a temporary local Git ref for the duration of the job. The execution commit and its Playwright configuration are fetched and checked separately.

The regression test builds a separate bare remote and a synthetic post-squash main snapshot, then clones main at depth one without an alternates file. Initially, Git cannot resolve the retained tooling commit or its normalizer tree entry, and the actual M7M CLI exits 1. The exact-SHA fetch succeeds in its positive control; a forced retained-PR-ref fallback also fetches the pinned commit, after which the CLI accepts the unchanged report. A remote without the retained ref still produces a nonzero fetch result, and a report that substitutes the execution commit for tooling fails the CLI. These checks exercise the Git object and source-file boundary rather than SHA formatting alone.

### F2 — Retain and verify original discovery bytes

The original `--list` outputs were recovered from the task’s existing capture locations. Their timestamps precede the report generation time, their exit status is zero, and the files contain only relative spec names and test titles; they include no machine paths or environment values. The exact bytes are now committed at:

- `ground-glass-m7m-scene-readiness/discovery/ordinary-chromium.txt`
- `ground-glass-m7m-scene-readiness/discovery/renderer-serial.txt`

The ordinary digest recomputes to `1d24cc0fd985b3c2c41b83ab6c4880699eeeea81c1e4fb97bb8889a38736823d` (274 identities, 80 spec files). The renderer-serial original bytes recompute to `1db87b1ae129b443f369d8ed2538f635ab2289dc73a2cf5d34491339104ec39d` (4 identities, 4 spec files). The first report recorded the serial digest with a final `f`; the recovered bytes establish the correct final `d`, so the report and evaluator now use the recomputed value. All 12 selected identities are present in the ordinary list, both projects remain distinct, and all 84 listed spec files exist at the execution-source commit. No fresh discovery run was substituted for the historical lists.

The evaluator parses the retained bytes, recomputes their SHA-256 values, checks project names, identity/spec-file totals, uniqueness, selected identities, and the original-versus-fresh discovery declaration. Missing bytes, altered digests, duplicate or missing identities, project conflation, and sanitization claims fail closed.

### Revision and validation

The evaluator is `m7m-scene-readiness-evaluator-v2`; the versioned mutation manifest is `m7m-scene-readiness-evidence-mutations-v2`. Its 56 named mutation cases cover source-role and discovery integrity, alongside the positive report/CLI controls. The focused M7M suite contains 63 tests, including the synthetic post-squash replay. CI runs the schema-aware M7M evidence check as a required step on PRs and branch pushes; `deploy` continues to require successful `ci`. Final-head CI status is available from [PR #311 checks](https://github.com/chau-hm/view-camera-simulator/pull/311/checks).

The controlled results remain unchanged: 11/12, 9/12, and 4/12 passes at one, two, and four workers; light peers 4/4; renderer-heavy peers 1/4; focused RTT/SPA 2/2; zero verified application fixes. Full Broad E2E remains not-qualified, M7 remains partially-qualified, M8 remains denied, and production Ground Glass remains WebGL-only with production WebGPU disabled.
