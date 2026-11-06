# M7P — Playwright Assertion Scheduling and Browser Long-Task Causality

## Executive finding

The controlled M7P matrix reproduced the Architecture Rise Canvas-count assertion failure in all three light-peer runs and all six renderer-heavy runs. It passed all three solo runs with CDP tracing disabled, all three solo runs with tracing enabled, and all three synthetic-stall runs.

The traced captures directly show long `CrRendererMain` task intervals that span the inferred five-second assertion deadline. They do not show which private `toHaveCount()` retry observed which DOM state. The evidence supports browser scheduling pressure during the failing workloads, but does not prove that a main-thread stall caused the matcher's zero-count resolutions or establish a renderer-specific defect.

The synthetic control is a useful counterexample. A bounded 5.4-second browser-main-thread task started after the Canvas was observed and just after assertion entry. It spanned the inferred browser deadline, yet the unchanged assertion passed in all three attempts, settling 9.41–9.51 seconds after Node recorded entry. A long browser task can delay a successful assertion result; the stall alone did not reproduce the failure when Canvas was already present.

**Next action: D — further targeted investigation.** Run the same light-peer four-worker condition with CDP tracing off and on, holding the browser-side observers and cohort constant. M7P's light-peer condition was trace-on only, while the accepted M7O light-peer capture passed 3/3. This small matched pair can test whether the divergence tracks CDP tracing. It cannot establish renderer causation.

## Instrumentation boundary

The capture uses Playwright's public `BrowserContext.newCDPSession(page)` interface and Chromium's `Tracing` domain with the bounded categories `blink.user_timing`, `devtools.timeline`, and `toplevel`. It also records public Node-side assertion entry/settlement, public `page.evaluate` request/response intervals, browser Long Task entries, DOM scan snapshots, and heartbeat samples. See the [Playwright CDPSession API](https://playwright.dev/docs/api/class-cdpsession), [Playwright tracing API](https://playwright.dev/docs/api/class-tracing), and [Chromium Tracing protocol](https://chromedevtools.github.io/devtools-protocol/tot/Tracing/).

The original assertion remains unchanged:

```ts
await expect(scene.locator("canvas")).toHaveCount(1, {
  timeout: 5_000,
});
```

No matcher internals are patched. Playwright's public call boundary and its private locator retries are different observations. M7P cannot observe retry timestamps or the result of each individual locator resolution. A MutationObserver scan is not an exact DOM insertion timestamp, and its callback may not expose every transient intermediate state. Chromium `ThreadControllerImpl::RunTask` events are attributed to a renderer process/thread; those generic events do not carry a frame ID. GPU trace categories were not enabled, so no GPU execution or saturation claim is made.

A feasibility probe confirmed that the installed Chromium tracing session can complete after an assertion failure and is available during test teardown. In the retained trace-on captures, tracing completed with both assertion anchors present and no reported data loss, collector overflow, or dropped diagnostic samples.

## Environment and controls

- Node `v24.3.0`; Playwright `1.61.1`; Chromium revision `chromium-1228`, browser `149.0.7827.55`.
- macOS host, Playwright headless Chromium project, application-default WebGL backend. No production WebGPU flags were added.
- Each test receives its own Playwright page/context; worker browser processes may be shared.
- Every condition has three independent attempts and zero retries. The runner records actual test intervals and worker indexes; the four-worker conditions reached four overlapping tests on workers 0–3.
- P1 is a solo control with M7P's browser-side observers active and CDP tracing disabled. P2 enables CDP tracing over the same solo scenario. Thus “tracing off” does not mean the browser-side diagnostic observers were absent.
- P3 uses the original three light peers. P4 uses the original Macro Bellows, Macro Compound Movements, and Mirror Shift Rig Lateral peers. P4 has a matched tracing-off and tracing-on arm.
- P5 uses one worker and a bounded 5,400 ms synthetic browser-side busy task. It starts only after a connected Canvas is observed and after the assertion-entry marker; it does not run work on the Node test thread.
- Raw Playwright JSON and trace files were written under `/private/tmp/m7p-capture-3131da63`, outside the repository. The normalized summary records raw artifact digests and sizes. Raw traces are not committed because they are large; the normalized capture summary is retained at `docs/architecture/ground-glass-m7p-assertion-scheduling/capture/final/normalized-captures.json`.

## Results

| Condition | Target outcome | Peer outcome | Observation |
|---|---:|---|---|
| P1 — solo, CDP tracing off | 3/3 passed | — | Assertion settled in 4.371–4.467 s. |
| P2 — solo, CDP tracing on | 3/3 passed | — | Assertion settled in 4.355–4.525 s. |
| P3 — light peers, four workers, tracing on | 0/3 passed | Each of the three light peers passed 3/3 | Four-way overlap was measured in every attempt. |
| P4-off — original heavy peers, four workers, tracing off | 0/3 passed | Macro Bellows 0/3; Macro Compound 2/3; Mirror Shift 3/3 | Four-way overlap was measured in every attempt; heavy peers also had failures/timeouts. |
| P4-trace — original heavy peers, four workers, tracing on | 0/3 passed | Macro Bellows 0/3; Macro Compound 0/3; Mirror Shift 3/3 | Four-way overlap was measured in every attempt; heavy peers also timed out. |
| P5 — 5.4 s synthetic browser-main-thread task | 3/3 passed | — | Assertion settled 9.413–9.510 s after Node entry, after the inferred five-second deadline. |

All 18 captures recorded a connected Canvas before the inferred browser deadline. For P1/P2 the first DOM scan observed Canvas about 0.36–0.39 s after the assertion-entry anchor; for P3, 0.45–0.54 s; for P4-off, 0.55–0.61 s; and for P4-trace, 0.58–0.63 s. P5 observed Canvas about 32–35 ms before assertion entry. These are observation times, not insertion times, and do not prove what the matcher observed.

In the three traced P3 attempts, a target `CrRendererMain` `ThreadControllerImpl::RunTask` lasted 3.87–4.11 s and spanned the inferred browser deadline. In the three traced P4 attempts, the corresponding interval lasted 5.71–6.27 s and spanned the deadline. P4-off's Long Task observations reached 4.97–6.29 s. The Node heartbeat maximum across captures remained about 54–68 ms against a 50 ms cadence, so the Node event loop did not show a comparable multi-second stall.

P4-trace-r1 provides an observable scheduling example without exposing matcher internals: Node recorded assertion failure at 6,109.7 ms. The subsequent public failure-catch `page.evaluate` request began at 6,109.7 ms and returned at 8,781.5 ms. The traced renderer task ended at page time 8,219.5 ms, and the page-side catch marker followed at 8,241.9 ms. This shows a public browser evaluation request returning only after the renderer main thread became serviceable. It does not reveal the earlier `toHaveCount()` retry schedule.

### Trace overhead, clocks, and coverage

The P1/P2 assertion elapsed-time medians were 4,417.231 ms with CDP tracing off and 4,409.166 ms with tracing on, a descriptive difference of −8.065 ms. The heavy target failed 3/3 both with tracing off and on. These small repeated samples do not estimate causal instrumentation overhead. P3 has no tracing-off arm, so its difference from the historical M7O light-peer result cannot be assigned to tracing.

The 12 CDP traces contained 69,876–74,525 events and occupied 18.52–19.69 MB. Maximum trace buffer use was 12.5–13.5%; all traces completed without data loss or collector overflow and covered both assertion markers. Page/trace offset spread was 0.013–0.145 ms; Node/trace clock-sync brackets were 0.677–3.290 ms. The public assertion-entry `page.evaluate` request/response bracket added 4.17–28.91 ms of uncertainty across traced captures. The report retains the distinct Node, browser-page, and trace clock domains and does not treat those intervals as exact event times.

## Hypothesis assessment

### Q1 — Canvas availability before timeout

**Observed before the inferred deadline in all 18 captures.** A connected Canvas was present in the first scan and later snapshots. Exact insertion time and every intermediate DOM state remain unknown.

### Q2 — Browser main-thread stall

**Directly observed; contribution to the target failure remains unproven.** Tracing identifies long tasks on `CrRendererMain`, including intervals that span the inferred deadline. Public browser evaluations after failure can be delayed until the task ends. Generic RunTask events do not identify the frame or the underlying operation, and the P5 counterexample passed with a comparable synthetic stall.

### Q3 — Playwright assertion scheduling

**Public boundaries observed; matcher internals unavailable.** Node call entry and settlement, browser evaluation requests/responses, trace markers, and clock-sync brackets are recorded. The public interfaces do not expose each private matcher retry or whether a specific query was queued, executing, or awaiting a response. P5 settled after its nominal timeout but passed; M7P does not infer why the matcher accepted the result.

### Q4 — Renderer-heavy workload causality

**Workload correlation observed; renderer-specific mechanism unresolved.** Target failures occurred 3/3 under the light-peer condition and 3/3 under each heavy condition. Heavy peer failures and timeouts also occurred. The synthetic stall did not reproduce the assertion failure when Canvas was already present. There is no evidence here of GPU saturation or a renderer-specific causal path.

### Q5 — Test synchronization

**No synchronization change is justified.** The evidence does not establish a semantic application-ready predicate that should replace the existing Canvas-count assertion. M7P does not change timeout, retries, sleeps, or serialization.

## Decision and limits

The evidence-backed next action is **D — further targeted investigation**: run a matched four-worker light-peer condition with CDP tracing off and on, retaining the same observers, test identities, and zero-retry policy. This isolates whether the P3 divergence tracks the trace toggle. It is a follow-up experiment, not an implementation change in M7P.

M7O remains immutable: its 12 captures and digests are unchanged, its classifications remain H1/H2/H4 supported but unproven and H3/H5 inconclusive, and its remediation decision remains `scheduling-pressure-supported-cause-unresolved`. M7O verified application fixes remain zero.

The accepted M7K full-suite record remains 278 discovered, 121 passed, 82 unexpected, and 75 skipped; Broad E2E remains `not-qualified`. M7 remains `partially-qualified`, M8 entry remains denied, spontaneous/external GPU device loss remains blocked, production Ground Glass remains WebGL-only, and production WebGPU remains disabled. M7P evidence integrity proves only that this controlled diagnostic record is internally consistent.

## Evidence and validation

- Machine-readable report: `docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING_REPORT.json`.
- Normalized capture summary SHA-256: `090ed2e6732b4ca9455e99c459476776aebee6d302326a419f71176d65cb6a6c`.
- Evaluator revision: `m7p-assertion-scheduling-evaluator-v1`.
- Evidence command: `npm run evidence:check:m7p`.
- Focused mutation tests: `src/tests/unit/m7pAssertionSchedulingEvidence.test.ts`.
- Existing M7O evidence command: `npm run evidence:check:m7o`.

The report pins execution and instrumentation to `3131da63a608a4591a345c3b03a072eafd1f8783`, normalizer to `23743c882229d84c3f712cb6dd72346757e58790`, and evaluator to `32f169176324a6d67c81f3028d96d4aa36ca9c6f`. The exact source role and tree-entry checks remain active for post-squash verification.
