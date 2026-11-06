# M7O — Canvas Assertion Timing and Browser Main-Thread Stall Diagnosis

## Finding

M7N observed the Architecture Rise Canvas-count assertion fail with `expected 1, received 0`, followed by a catch-time snapshot that found one connected Canvas and an active Observer renderer. Those two reads were not atomic. M7N did not record the timing of Playwright's internal matcher observations.

M7O preserves the original `toHaveCount(1)` assertion and its 5,000 ms effective timeout. The project test timeout remains 30 seconds and retries remain zero. Playwright 1.61.1 exposes no supported callback for the internal `toHaveCount()` retry loop. Its public error aggregates the call log as `5 × locator resolved to 0 elements`, but exposes no timestamp for any of those resolutions. M7O does not label an independent DOM sample or `expect.poll()` call as an internal matcher observation.

The controlled runs support scheduling pressure during the renderer-heavy workload, but do not establish a root cause. No application fix is verified. The M7N discrepancy remains unresolved at the level of the last internal matcher observation.

## Capture design and provenance

The experiment uses ordinary Playwright Chromium and the standard project with its default WebGL path. Instrumentation is enabled only by the M7O test environment flag. It does not change renderer code or readiness state, add sleeps, start another render loop, or perform GPU readbacks. The instrumentation-off condition contains no M7O capture.

The opt-in browser capture uses a bounded `MutationObserver` for scene-container/Canvas transitions, a `PerformanceObserver` for Long Tasks, and a 100 ms heartbeat with a 50 ms excess-delay threshold. It records route/document identity, scene/container/Canvas identities, connectivity, renderer status/generation, browser monotonic time, `performance.timeOrigin`, and dropped-event counts. Node-side records include test/worker identity, assertion entry and settlement, and request/response brackets around browser evaluations. Browser and Node clocks remain separate; browser timestamps are mapped to Node intervals using overlapping request/response anchors, retaining the uncertainty interval.

On target failure, the test records a separate catch-time browser snapshot. A separately labelled public `expect.poll()` then records its own evaluation. That poll runs after the original assertion has failed, and its outcome does not replace the original failure. The per-failure catch evaluation and poll response can be delayed by browser work; their request/response intervals remain explicit.

The final matrix contains 12 independent Playwright invocations. All normalized captures and the capture manifest are committed under `ground-glass-m7o-canvas-timing/capture/final/`. Raw Playwright JSON remains private and local; only its SHA-256 and byte count are retained. The evaluator checks every normalized capture digest, raw-capture digest metadata, source commit/tree paths, test identities, zero retries, and actual worker overlap.

Captured environment: macOS 27.0.1 build 26A434 on arm64; Node v24.3.0; Playwright 1.61.1; bundled Chromium/headless shell revision 1228, browser version 149.0.7827.55. Browser user-agent versions in the instrumented captures agree with the report. Configured workers were 1 for A/B and 4 for C/D; Playwright metadata confirmed actual concurrency of 1 and 4 respectively.

## Controlled matrix

| Condition | Workload | Attempts | Target result | Whole cohort result |
|---|---|---:|---|---|
| A | Target alone, instrumentation off, 1 worker | 3 | 3 passed | 3 passed |
| B | Target alone, instrumentation on, 1 worker | 3 | 3 passed | 3 passed |
| C | Target plus Home grid, Simulator header, and app smoke, 4 workers | 3 | 3 passed | 12 passed |
| D | Target plus Macro Bellows, Macro Compound, and Mirror Shift, 4 workers | 3 | 3 failed at the Canvas assertion | 4 passed, 3 failed, 5 timed out |

Every invocation used zero retries. C's three cohorts all passed 4/4. D's three cohorts each failed the target with the same `toHaveCount(1)` zero-Canvas result. D1 had Macro Bellows time out; Macro Compound and Mirror Shift passed. D2 and D3 had Macro Bellows and Macro Compound time out; Mirror Shift passed. There were no skipped, flaky, or incomplete results in these selected cohorts.

The instrumentation-on solo target test durations had a 16,042 ms median, compared with 14,687 ms off, a 1,355 ms difference across three pairs. These are whole-test durations, and the instrumented test includes capture and diagnostic teardown. They do not isolate instrumentation cost.

## Failure timing evidence

Each assertion had an inferred deadline of its Node monotonic entry time plus 5,000 ms. The deadline is budget-derived; the final internal matcher poll is not observed. The first Canvas time below is the MutationObserver callback observation, mapped into a Node interval. It is not an exact DOM insertion timestamp.

| Attempt | Assertion entry → inferred deadline (Node ms) | First Canvas callback mapped interval (Node ms) | Long Task mapped interval (Node ms) | Catch evaluation request → response (Node ms) | Catch browser sample mapped interval (Node ms) |
|---|---:|---:|---:|---:|---:|
| D1 | 957.5 → 5957.5 | 1507.9–1524.1 | 1908.3–7484.5 (5,560 ms) | 5964.0–7506.8 (1,542.8 ms) | 7490.6–7506.8 |
| D2 | 944.8 → 5944.8 | 1504.8–1520.8 | 1876.5–7156.5 (5,264 ms) | 5952.1–7172.0 (1,219.9 ms) | 7156.0–7172.0 |
| D3 | 956.7 → 5956.7 | 1491.4–1508.2 | 1834.5–7100.3 (5,249 ms) | 5964.3–7162.7 (1,198.4 ms) | 7123.5–7140.3 |

The Canvas was first observed roughly 0.5 seconds after assertion entry and well before the inferred timeout in all three D attempts. Each recorded Long Task overlapped the assertion window and continued beyond its deadline. Browser heartbeat maximum intervals were 5,946 ms, 5,617.5 ms, and 5,590 ms. Node heartbeat maximum excess delays were 24.14 ms, 13.24 ms, and 13.24 ms, all below the 50 ms delay threshold. These Long Task and heartbeat observations establish browser scheduling delay; they do not establish GPU saturation or renderer contention as its cause.

Playwright's assertion call settled 6.5 ms, 7.3 ms, and 7.5 ms after the budget-derived deadline in D1–D3 respectively. These are Node-side call settlement times, not timestamps for a final internal matcher poll.

At the catch-time snapshot, all three failing attempts showed exactly one connected Canvas in the connected Architecture Rise scene container. The scene and Canvas identities matched the first Canvas transition, and no later transition recorded Canvas removal or replacement. The renderer status was active and generation was `0`. M7N had separately recorded renderer initialization and current-frame publication; M7O's bounded DOM observer does not independently treat those earlier lifecycle captures as new M7O frame-publication evidence.

The catch-time evaluation itself began after the inferred assertion deadline and returned 1.2–1.5 seconds later. Its browser-side sample maps after the deadline in all three D attempts. The later independent `expect.poll()` observed a Canvas count of one. Its callback evaluation round trips were approximately 2.49, 2.33, and 2.34 seconds. This explains why a subsequent snapshot can see a Canvas without proving that the same state was visible to the last internal matcher observation.

## Hypothesis assessment

| Hypothesis | Classification | Supporting evidence | Contradictions and remaining unknowns | Smallest useful next probe |
|---|---|---|---|---|
| H1 — Assertion/DOM timing mismatch | Supported but unproven | Canvas callback was observed during the assertion budget; the public call log reports only zero resolutions; later catch snapshot sees one. | The exact final internal `toHaveCount()` observation is unavailable, so it is unknown whether Canvas attached after that observation. | Preserve the matcher while adding a supported browser-protocol trace around the final browser evaluation boundary; do not patch Playwright internals. |
| H2 — Browser main-thread stall | Supported but unproven | All three D attempts had a 5.2–5.6 s Long Task overlapping and crossing the inferred deadline; browser heartbeat intervals reached 5.6–5.9 s. | Correlation does not prove which work blocked assertion servicing or whether the Long Task caused each failure. | Repeat the matched heavy cohort with browser-side scheduling trace and the same zero-retry assertion. |
| H3 — Locator/document/scene identity mismatch | Contradicted by observed snapshots | Same document, connected Architecture Rise container, Canvas identity, and renderer generation at first Canvas observation and catch; no removal/replacement was observed. | The matcher’s own timestamped element resolutions are unavailable. | No separate identity probe is justified unless a future capture records a changed document or container. |
| H4 — Playwright assertion scheduling | Supported but unproven | Catch evaluation round trips exceeded 1.1 s and sampled after the deadline; post-failure poll evaluations also took over 2.3 s. | Node heartbeat delays stayed below threshold; browser execution and protocol scheduling cannot be separated from these brackets. | Add an external protocol scheduling trace while keeping the public matcher unchanged. |
| H5 — Renderer/resource contention | Inconclusive | Failures occurred under renderer-heavy peers; the Canvas and active renderer existed at catch time. | No GPU saturation, WebGL context loss, resource leak, or causal renderer boundary was measured. | Only pursue GPU/resource capture if a future controlled trace identifies a relevant boundary. |

### M7N discrepancy and remediation decision

Measured order: a Canvas transition callback was recorded before the inferred deadline; `toHaveCount()` later failed; the catch evaluation request began after the deadline and returned a connected Canvas snapshot. The matcher’s individual observations are not timestamped, so M7O cannot determine whether attachment occurred after the final unsuccessful matcher observation. The snapshot is not atomic with the matcher and does not contradict Playwright's aggregate failure message.

The selected decision is **scheduling pressure supported, cause unresolved**. No test synchronization fix or application lifecycle fix was verified, and no application change was made. The original test assertion, timeout, and zero-retry policy remain. The capture does not support attributing the Long Tasks to GPU work.

## Offline evidence integrity

`npm run evidence:check:m7o` verifies the 12-capture manifest and its digest, every normalized artifact digest, raw report SHA/byte-count metadata, source commit and source-tree entries, test and peer identities, retry count, actual concurrency, assertion/call-log semantics, DOM identity, clock bounds, Long Task/heartbeat windows, derived counts, and qualification limits. The evaluator rejects contradictory internal-poll claims, a false absent-Canvas claim, inconsistent Long Task overlap, unsupported GPU-causation claims, altered target outcomes, selected-cohort Broad E2E promotion, changed artifact digests, unavailable source commits, and mismatched browser metadata. CLI negative controls assert nonzero exit status for contradictory qualification evidence.

The accepted M7K baseline is unchanged: 278 discovered, 121 passed, 82 unexpected, and 75 skipped; Broad E2E remains not-qualified. M7O records zero verified application fixes. The full 278-test suite was not run.

## Qualification boundary

- Full Broad E2E: **not run / not-qualified**.
- M7 overall: **partially-qualified**.
- M8 entry: **denied**.
- Spontaneous/external GPU device loss: **blocked**.
- Production Ground Glass: **WebGL-only**.
- Production WebGPU: **disabled**.

The M7O evidence check means only that this bounded diagnostic record is internally consistent. It is not a Broad E2E, renderer stability, or GPU qualification.
