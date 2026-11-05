# M7M — Scene / Ground Glass Readiness Cohort

**Status:** Investigated; no application correction was justified. The selected cohort remains worker-sensitive and unresolved.

**Base, candidate, execution, and tooling source:** `0c32f113c1e3d16a8fd42e7748c64909366c6ae8` (the M7L squash merge on `main`). M7M changes evidence tooling and CI only; it does not change application behavior or E2E assertions.

**Evaluator:** `m7m-scene-readiness-evaluator-v1`
**Three.js:** `0.187.0`

## Historical context and current discovery

M7K's accepted complete capture remains 278 discovered tests: 121 passed, 82 unexpected, and 75 skipped, with zero flaky or incomplete outcomes. The 4-test renderer-serial lane passed 4/4. Its complete execution is not Broad E2E qualification because unexpected failures and unapproved skips remain.

M7L investigated 11 identities with zero verified fixes. Its historical raw Playwright captures were not retained for offline replay; that limitation remains explicit in the [M7L report](GROUND_GLASS_M7L_LEARNING_DRAWER_REMEDIATION.md).

M7M preserves 12 selected identities from the M7L historical inventory. Current `--list` discovery is recorded separately from test execution: ordinary Chromium found 274 tests in 80 spec files, and the renderer-serial project found 4 tests in 4 spec files, for 278 combined discovered tests. All 12 selected identities matched the ordinary Chromium discovery list. This is not a completed 278-test run.

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

Normalized captures are under [`ground-glass-m7m-scene-readiness/`](ground-glass-m7m-scene-readiness/). Original Playwright JSON was captured in mode-0600 private temporary files and hashed before normalization. It was excluded from Git because it contains absolute paths and environment data. The report retains the raw digests but marks raw retention and raw-to-normalized replay as unavailable; persisted normalized artifact integrity is verified. Do not represent the original raw capture provenance as independently replayable.

The focused lifecycle regression is persisted as `ground-glass-m7m-scene-readiness/validation/lifecycle-rtt-spa-w1.json`. The existing production-preview WebGL isolation test passed 4/4 with zero retries. The M7M focused suite passed 36/36: 31 required evidence mutations, positive and manifest/source/CLI controls, and an exclusive-create check that preserves an existing normalized artifact. The CLI negative control verifies a contradictory qualification exits nonzero.

CI runs `npm run evidence:check:m7m` after the inherited M7 evidence gates. The twelve-test concurrency matrix is not added to hosted CI, and `deploy` remains dependent on successful `ci`.

## Validation record

| Check | Result |
|---|---|
| Full unit/integration suite | 3,772 passed across 320 files |
| M7M focused evidence suite | 36/36 passed |
| Typecheck / lint / CSS structure / production build | Passed |
| M7M evidence CLI | Passed; 12 identities, zero verified fixes |
| M7H / M7I / M7J / M7K schema v1 / M7L evidence | Passed |
| M7K schema-v2 selected report | Evidence integrity passed; incomplete execution and blocked qualification preserved |
| M7F replay / M7G consolidation report | 17/17 scenarios replayed; M7G integrity passed and qualification remains partial |
| Production-preview WebGL isolation | 4/4 passed, zero retries |
| Focused Ground Glass RTT / SPA lifecycle | 2/2 passed, one worker |
| Full 278-test Broad E2E | Not run |

Replay outputs were written to temporary in-repository paths and removed after validation. The M7K selected report remains incomplete/blocked, and the M7G result remains partially qualified.

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
