# M7J — Four-Worker E2E Stability and Renderer Contention Diagnosis

**Status:** evidence integrity passed; unrestricted four-worker stability remains unstable; ready for a controlled broad run under the documented scheduling policy. The complete Broad E2E suite was not run and remains not qualified.

- Base / accepted M7I merge: `b917ad46f99d8de339adbd028f0ae57c4922df1f`
- Candidate scheduling commit: `17a2616b151aa50ad34b2d137eee0a43c5759ad3`
- Evaluator: `m7j-four-worker-stability-evaluator-v1`
- Three.js: `0.187.0`

The machine-readable record is [GROUND_GLASS_M7J_FOUR_WORKER_STABILITY_REPORT.json](GROUND_GLASS_M7J_FOUR_WORKER_STABILITY_REPORT.json). Raw Playwright reports, logs, discovery output, and graphics-path evidence are under [ground-glass-m7j-four-worker](ground-glass-m7j-four-worker/). The evaluator checks artifact digests, raw outcomes, test identities, worker metadata, environment comparability, readiness, and the preserved M7I backlog.

## A. Accepted baseline

PR #307’s merge commit is an ancestor of the M7J branch and was also the `origin/main` SHA recorded when the isolated M7J worktree was created. The preserved M7I report remains byte-for-byte unchanged; its SHA-256 is `486f1c7ac010cd4d4fbede55fdb669f448c26adfaaee6de5717814ddff9bccde`.

The historical M7I selected five-test matrix remains a separate observation: baseline and candidate each passed 5/5 at one worker; baseline passed 1/5 and candidate 2/5 at four workers. M7J captured fresh raw reports on the accepted M7I merge commit:

| Fresh M7J run | Configured / actual workers | Passed | Unexpected | Skipped | Flaky |
|---|---:|---:|---:|---:|---:|
| J1 isolated, one-worker config | 1 / 1 | 1 | 0 | 0 | 0 |
| J1 isolated, four-worker config | 4 / 1 | 1 | 0 | 0 | 0 |
| J2 isolated, one-worker config | 1 / 1 | 1 | 0 | 0 | 0 |
| J2 isolated, four-worker config | 4 / 1 | 1 | 0 | 0 | 0 |
| J3 isolated, one-worker config | 1 / 1 | 1 | 0 | 0 | 0 |
| J3 isolated, four-worker config | 4 / 1 | 1 | 0 | 0 | 0 |
| Five-test cohort | 1 / 1 | 4 | 1 | 0 | 0 |
| Five-test cohort | 2 / 2 | 3 | 2 | 0 | 0 |
| Five-test cohort | 4 / 4 | 2 | 3 | 0 | 0 |
| Three renderer targets | 4 / 3 | 1 | 2 | 0 | 0 |

The configured-four single-test runs actually used one Playwright worker. They are evidence that a configured worker ceiling is not evidence of four concurrent workers. The five-test cohort is the actual four-worker reproduction. Its J1, J2, and J3 results timed out; Fringe and the learning-drawer control passed. All captured runs used zero retries. No run was classified flaky or skipped; timeouts are unexpected failures, not incomplete results.

Current Chromium discovery is **278 tests in 80 spec files**. The scheduling policy places 274 tests in the ordinary `chromium` project and four required renderer-sensitive tests in `chromium-renderer-serial`.

## B. Experiment design

The bounded matrix used isolated J1/J2/J3 runs with one-worker and configured-four-worker limits; the five-test cohort at one, two, and four workers; the three-target cohort at a four-worker limit; and a J2 comparison with either a blank companion page or a live Table Tilt renderer page. The same renderer-page comparison was repeated in headed Chromium. Retries were disabled throughout. One run was captured for each listed configuration; there was no retry loop or claim of a performance distribution.

The environment was macOS 27.0.1 build 26A434 on arm64 / Apple M4 Pro, Node 24.3.0, npm 11.12.0, Playwright 1.61.1, Chromium 149.0.7827.55, and Three.js 0.187.0. The tests used the ordinary Vite development server and a configured desktop viewport of 1280×720; J2 itself then exercised its existing responsive width sequence.

CDP `SystemInfo.getInfo` identified the headless executable as `chrome-headless-shell` using ANGLE SwiftShader software WebGL. The headed control used ANGLE Metal on the Apple M4 Pro. Host process CPU/GPU sampling and memory-size queries were denied by the host permissions. No CPU utilization, GPU utilization, memory-pressure, or GPU-process metric is claimed.

For selected diagnostic attempts, a temporary test-only probe sampled a 1-second timer, bounded `requestAnimationFrame` intervals, `PerformanceObserver` long tasks, visibility, context-loss events, existing renderer DOM attributes, and RTT request/completion IDs. It did not call `getContext`, create a renderer or WebGL context, perform readbacks, or change production code. It was attached after test timeout and explicitly marked as perturbing animation scheduling. The probe patch was removed before the candidate scheduling commit. Probe data is embedded in the digest-bound raw diagnostic Playwright JSON.

## C. Per-test diagnosis

### J1 — Scene View Focus

The isolated test passed with both one and configured four workers; the latter used one actual worker. It timed out in the two- and four-worker cohorts. M7I had already shown progress past initial canvas/renderer readiness and a timeout around the **Reset 3D view** action. The M7J raw timeout preserves the exact test identity and timeout but not the transient Playwright trace body, so it does not establish that the button itself was unclickable.

The post-timeout evaluation completed in 619 ms. At the timeout, the page was visible; the observer renderer reported active WebGL2; the Ground Glass render host was ready; its current and last-completed request IDs matched; and there were no context-loss events. In the instrumented four-worker cohort, 88,495 ms of long tasks accumulated during about 90.6 seconds, with maximum timer and rAF gaps of 6.18 and 5.14 seconds. Those measurements support severe scheduling delay; they do not prove a specific actionability defect.

The test remains required in the serial renderer lane. Scene/Camera independence, selected preset, active-view reset, camera position/orbit assertions, WebGL identity, and WebGPU-policy assertions were preserved.

### J2 — Camera Controls Compact

J2 passed alone with one actual worker and timed out in the two- and four-worker cohorts while the test was evaluating responsive control geometry. The timeout is not evidence that `getBoundingClientRect()` is intrinsically slow. A post-timeout browser evaluation completed in 185 ms in the four-worker diagnostic run; the sampled page accumulated 117,841 ms of long tasks over about 120.1 seconds, with maximum timer/rAF gaps of 4.22/3.30 seconds. Renderer and RTT state were active/complete, and no context loss was observed.

The controlled J2 companion comparison is the clearest discriminator: J2 passed in 103.8 seconds alongside a blank page, timed out at 120 seconds alongside a live renderer page in headless mode, and passed in 5.6 seconds alongside that renderer page in headed Metal mode. These are single bounded comparisons, not a guarantee about all hosts.

J2 remains required in the serial lane. Its measured slider tracks, labels, values, overlap checks, responsive widths, and accessibility assertions are unchanged.

### J3 — Table Tilt RTT resource stress

J3 passed isolated at one actual worker and in the one-/two-worker cohorts, but timed out in the four-worker cohort while the stress test queried live WebGL/RTT state. The probe evaluation completed in 640 ms after timeout. The page remained visible with active WebGL2, ready render-host state, matching current/completed RTT request IDs, and zero context-loss events. It recorded 117,636 ms of long tasks over about 120.6 seconds and a maximum timer gap of 2.77 seconds.

The timeout near live context inspection does not prove `getContext()` caused the stall, nor that a resource leaked. J3 remains required in the serial lane; its RTT contentfulness, focus, preview, zoom, quality, tilt, resource ownership, and context-preservation assertions are unchanged.

### Fringe control

The Stage 2N-A observer/RTT sibling-removal control also timed out during the instrumented four-worker five-test run, although it passed in the uninstrumented five-test four-worker run and in the final serial lane. It is included in the serial policy because it exercises a renderer-heavy multi-instance lifecycle. This is a harness scheduling decision, not a newly verified application fix.

## D. Shared-cause conclusion

The evidence supports a **strongly supported common factor**, not a verified single root cause: concurrent renderer-heavy pages under headless SwiftShader software WebGL coincide with long main-thread tasks and large timer/rAF gaps. The blank-page, renderer-page, and headed-Metal comparisons support that scheduling interpretation. The pages were still visible, renderers reported active WebGL2, RTT requests were completed, and no context loss was observed.

The evidence does not distinguish CPU scheduling from GPU-process synchronization or software-rendering cost. It does not establish hardware GPU contention, memory pressure, renderer leakage, or one proven mechanism shared by all tests. No product-renderer or optical change was justified by these observations.

## E. Remediation and readiness

The original test contracts are retained. Four tests are tagged `@m7j-renderer-contention`; the normal non-native Chromium config runs the 274-test ordinary project first and then runs those four tests in the dependent `chromium-renderer-serial` project, with one worker and no skip or retry policy. `npm run test:e2e:m7j-renderer` provides a focused command for that required lane. Native-required WebGPU mode keeps its existing single native project.

The final-source scheduling commit’s serial-lane raw report recorded **4 passed, 0 unexpected, 0 retries, 0 skipped, 0 incomplete**, with one actual worker. This verifies the serial policy lane result, not a product fix and not unrestricted four-worker stability. The unpartitioned five-test four-worker baseline remains 2 passed / 3 unexpected, and the three-target four-worker diagnostic remains 1 passed / 2 unexpected.

The readiness decision is `ready-for-controlled-broad-run`: the required renderer-sensitive tests have a reproducible, explicit serial lane, the policy is represented in discovery and configuration, and the evidence gate is deterministic. This decision is permission to attempt a future controlled broad run under that policy. **The 278-test suite was not run and remains `not-qualified`.**

No trace ZIP is included. The baseline JSON retains attachment names and paths, but later Playwright output cleanup removed the local trace archives before they were hashed; therefore no trace digest is claimed. Raw JSON/log digests remain recorded in the machine-readable report. The focused serial candidate raw report SHA-256 is `fe4b0621dd4c6803f20e9107d51edda22ded466c92d64ee9ca4b55952ce67ba4`.

Qualification boundaries remain unchanged: M7 is `partially-qualified`; Broad E2E is `not-qualified`; external/spontaneous GPU device loss is blocked; M5Q is partially qualified; M6 is development-only; M8 is denied; production Ground Glass is WebGL-only; production WebGPU is disabled. No native WebGPU test or qualification was performed.

## Validation record

On the M7J implementation worktree, the final local checks recorded:

- Unit/integration: 316 files, 3,635 tests passed.
- Typecheck, lint, CSS structure, and production build: passed.
- M7F replay: 17/17 scenarios passed, source commit verified; report written to `/tmp`.
- M7G report: evidence integrity passed, 5 passed / 0 failed / 2 blocked / 0 not run, M8 denied; temporary report outputs removed.
- M7H and M7I evidence checks: passed; M7I report digest unchanged.
- M7J evaluator: passed across 15 experiment records / 39 raw tests; four-worker stability is still reported `unstable` and Broad E2E `not-qualified`.
- Ordinary Chromium smoke: 2/2 passed, zero retries.
- Production-preview WebGL isolation: 4/4 passed, zero retries.
- Renderer serial lane: 4/4 passed, zero retries, one actual worker.

The exact commands, raw report digests, and logs are retained in the machine-readable report and validation directory. The 278-test broad suite was not run. Hosted CI status is added after the PR is published and checks the final PR HEAD; until then, no hosted result is claimed.
