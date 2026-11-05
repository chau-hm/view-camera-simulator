# M7N — Renderer Initialization Lifecycle Trace

**Capture date:** 2026-11-06

**Base:** `8a383e740d6a3f14b7673ae3adb18471b7d55d4c` (PR #311 merge)

**Three.js:** `0.187.0`

**Runtime:** Node `v26.12.1`, headless Playwright Chromium `149.0.7827.55`, macOS arm64

**Rendering path:** production-default WebGL; no WebGPU research flags

## Result

M7N adds an opt-in, bounded lifecycle trace and records a matched target-alone, lightweight-peer, and renderer-heavy-peer comparison. The target passes alone with tracing both off and on. Under four workers the target fails its existing Canvas-count assertion in both peer workloads, while the event trace observes the Canvas attachment, R3F WebGL renderer creation, active Observer capabilities, and a Ground Glass current-frame publication.

At the failure boundary the Playwright assertion context says the Canvas count was zero. The synchronous diagnostic snapshot taken from the assertion catch sees one connected Canvas and an active Observer renderer for `architecture-rise`, generation `0`. This conflict means the trace does **not** identify a stable missing application lifecycle boundary. It does not prove a WebGL context failure, GPU saturation, or an application renderer defect. Root cause remains unresolved and no product behavior was changed.

## Lifecycle ownership

| Stage | Owner | Observation | Limit |
|---|---|---|---|
| Navigation and initial loading | Browser navigation timing and passive Playwright observers | Document start, route URL, loading fallback, requests, page errors | Browser measurements remain separate from app trace time |
| Lazy route/workspace module | `src/app/pages.tsx` lazy loader | Module load start/completion | The app trace begins when its development-only module evaluates |
| Route component | `SimulatorRoutePage` | Route component commit | A commit is not the same as scene readiness |
| Suspense/workspace | Trace-only Suspense fallback and `SimulatorWorkspace` | Fallback commit, workspace commit, scene initialization request | Does not infer renderer state |
| Scene and viewport | `SceneViewport` and `SceneRenderer` | Scene renderer commit and asset configuration | Asset configuration does not claim GPU upload completion |
| Observer request/generation | Backend selection and `useObserverRendererLifecycle` | Requested backend and generation authority | Uses existing generation ownership |
| Canvas DOM attachment | `SceneRenderer` container observation and passive browser observer | Connected Canvas DOM node | DOM insertion alone is not WebGL initialization |
| Three.js renderer creation | R3F `<Canvas onCreated>` | Renderer object available and Canvas connected | No separate context-acquired event is claimed |
| Observer active | `ObserverRendererCapabilityReporter` | Active capabilities published for the Observer generation | Kept distinct from Ground Glass state |
| Ground Glass frame | `GroundGlassRenderHost` | Separate RTT generation active, renderer mounted, current frame published | Uses existing request/generation identity; no extra render loop or readback |

The conceptual path is:

```text
Navigation → route/module → workspace/Suspense → scene/viewport
  → Observer request → Canvas attached → R3F renderer created
  → Observer capabilities active → Ground Glass generation/frame published
```

Each signal above belongs to its listed owner. A Canvas node, R3F renderer object, Observer active publication, scene readiness, and Ground Glass publication are separate observations.

## Instrumentation contract

- App tracing requires `import.meta.env.DEV` **and** `VITE_M7N_RENDERER_LIFECYCLE_TRACE=true`.
- The read-only test surface is `window.__m7nRendererLifecycleTrace.snapshot()`.
- Events use page-local `performance.now()` timestamps, a recorded `timeOrigin`, and increasing sequence numbers.
- The ring buffer holds at most 512 events. Overflow increments `droppedEventCount`; no overflow occurred in the retained primary or A→B→A traces.
- Events carry surface, route, scene, viewport mount identity, and renderer generation. Observer and Ground Glass generation identities remain separate.
- Event detail is limited to scalar values. The collector does not inspect WebGL state, allocate a context, poll per frame, or read pixels.
- With the flag off no application trace API or event buffer is created. Passive Playwright measurements are separately labeled.
- The production-preview WebGL test asserts that the trace global is absent.

The trace-enabled and trace-disabled controls used the same app execution source, browser, viewport, worker count, and target test. The single paired comparison recorded 15,215.31 ms with tracing off and 15,189.22 ms with tracing on, a -26.09 ms (-0.17%) difference. Workspace-mounted timings were 571.6 ms off and 567.4 ms on; passive Observer-active timings were 1,294.2 ms off and 1,287.0 ms on. One pair is insufficient to estimate timing variance or any change in failure probability.

## Controlled captures

The target identity was `architecture-rise-focus-range.spec.ts::Architecture Rise focus control stays within scene depth and preserves thin-lens extension`.

| Capture | Selected peers | Configured / observed concurrency | Outcome | Retries | App trace |
|---|---|---:|---|---:|---:|
| Target solo, trace off | None | 1 / 1 | 1/1 passed | 0 | Disabled; passive browser observations retained |
| Target solo, trace on | None | 1 / 1 | 1/1 passed | 0 | 77 events, 0 dropped |
| Target + lightweight peers | Home responsive grid; simulator header context; app smoke | 4 / 4 | 3/4 passed; target failed | 0 | 46 events, 0 dropped |
| Target + renderer-heavy peers | Macro Bellows; Macro Compound; Mirror Shift | 4 / 4 | 1/4 passed; target, Macro Bellows, and Macro Compound failed; Mirror Shift passed | 0 | 46 events, 0 dropped |

All runs used ordinary Chromium and production-default WebGL. These are one primary attempt per configuration; the earlier first capture group remains separately labeled preliminary and excluded from primary comparison. Raw Playwright JSON contains machine-specific runtime data and remains private-local-only; raw hashes and byte counts are in the [machine-readable report](GROUND_GLASS_M7N_RENDERER_LIFECYCLE_REPORT.json). The committed diagnostic and outcome artifacts are normalized JSON, not byte-for-byte copies of the raw reports. Their individual SHA-256 values are checked by `npm run evidence:check:m7n`.

## Lifecycle comparison

| Boundary | Target alone, tracing off | Target alone, tracing on | Lightweight peers | Renderer-heavy peers |
|---|---|---|---|---|
| Navigation / route | Browser observed requested Architecture Rise URL; app trace disabled | Route module began at 237.7 ms; route component committed at 249.4 ms | URL observed; route module began at 570.7 ms | URL observed; route module began at 487.0 ms |
| Workspace | Passive DOM observer: 577.2 ms after navigation start | Passive DOM observer: 573.1 ms; Suspense visible at 244.1 ms | Passive DOM observer: 1,053.4 ms; Suspense visible at 577.3 ms | Passive DOM observer: 1,007.7 ms; Suspense visible at 494.2 ms |
| Canvas attached | Passive observer: 577.2 ms | App trace: 576.2 ms | App trace: 1,058.7 ms | App trace: 1,011.5 ms |
| R3F renderer created | Not exposed by app trace; terminal DOM showed active WebGL | 744.1 ms, connected Canvas | 1,250.5 ms, connected Canvas | 1,195.6 ms, connected Canvas |
| Observer active | Passive DOM status: 1,299.8 ms | App publication: 744.5 ms; passive DOM status: 1,292.7 ms | App publication: 1,251.0 ms; passive DOM status: 1,815.6 ms | App publication: 1,196.1 ms; passive DOM status: 1,821.1 ms |
| Ground Glass frame | Terminal DOM showed completed frame; app trace disabled | First current frame: 1,554.4 ms | First current frame: 2,078.6 ms | First current frame: 2,099.5 ms |
| Test outcome | Passed | Passed | Failed at Canvas-count assertion; Playwright failure context expected 1, received 0 | Failed at Canvas-count assertion; Playwright failure context expected 1, received 0 |

Times are page-local monotonic offsets from each document's start observation. App trace publication and passive DOM attribute visibility are reported separately because they are distinct events; the difference between those signals is not interpreted as a renderer delay by itself.

### Failure-boundary evidence

The target assertion is the existing `scene-canvas` descendant Canvas count assertion. In both four-worker captures, its Playwright error context reports expected `1`, received `0`. The synchronous catch records a `canvas-count-assertion-failure` diagnostic snapshot before teardown. That snapshot reports:

- route `/simulator/free/architecture-rise`, scene `architecture-rise`;
- one connected Observer Canvas, renderer status `active`, Observer generation `0`;
- R3F renderer creation with `webgl-renderer` / `webgl2` and `canvasDomAttached=true`;
- active Observer capabilities and a published Ground Glass current frame;
- zero page errors, console errors, failed requests, and trace drops.

The capture contains contradictory observations at the assertion boundary. It does not establish that the assertion simply ran too early; the snapshot is collected after the assertion failure and may observe a later DOM state. Nor does the trace show renderer creation stopping. The next targeted experiment should capture the locator's count and element attachment on the exact failed retry-poll boundary, using a passive Playwright assertion hook, while retaining the immediate catch snapshot. It should compare those two observations within the same page and test attempt. Do not change the assertion, add sleeps, or raise timeouts until that experiment identifies a stable synchronization mismatch.

## SPA generation control

The separate A→B→A probe performed one document load into Architecture Rise, then two client-side scene-card navigations through Macro Bellows back to Architecture Rise. It recorded 208 events and zero drops, with three distinct Architecture Rise viewport mount identities. Two delayed Observer callbacks targeting retired generations and 45 stale Ground Glass frame results were rejected by existing generation/request guards. The latter are normal stale-result suppression observations, not failures. Page errors and failed requests were zero. The probe demonstrates trace ownership across those transitions; it does not qualify the four-worker workload.

## Diagnosis and remediation

The solo target passes with tracing off and on. The target fails under both four-worker workloads, and the heavy cohort has more failures overall. This is consistent with the M7M association between concurrent renderer-heavy work and readiness-sensitive failures, but M7N's single attempt per workload cannot establish a cause or a stable heavy-versus-light effect.

Supported observations:

- workspace and scene mount occurred in every primary capture;
- Canvas DOM attachment, R3F renderer creation, active Observer capabilities, and Ground Glass frame publication were observed in both concurrent target traces;
- the two failing Playwright assertion contexts report no Canvas while immediate snapshots report an attached Canvas and active renderer;
- the target pages had no page errors, console errors, or failed requests;
- long-task monitoring observed a 3,895 ms maximum in the light target page and 5,680 ms in the heavy target page.

Not established: WebGL context acquisition failure, GPU saturation, context allocation exhaustion, memory pressure, renderer leak, application renderer defect, or stale-generation publication. Long tasks demonstrate main-thread scheduling stalls but do not attribute the work to GPU pressure. No product fix or test synchronization change is included; verified application fixes remain zero.

## Evidence validation

The offline evaluator is `m7n-renderer-lifecycle-evaluator-v1`. It checks source commits and Git tree-file digests, normalized artifact digests, exact selected identities, outcomes, worker counts, trace ordering and identities, A→B→A scene sequence, instrumentation gate, failure claims, and unchanged authorization boundaries. The production-facing command is:

```bash
npm run evidence:check:m7n
```

It accepts failed test outcomes as evidence while rejecting unsupported causal and qualification claims. A valid report means the retained investigation is internally consistent; it does not mean the target or Broad E2E passed.

During validation, the trace-off normalizer initially marked the app trace available because it had produced passive browser-diagnostic JSON. The normalizer now marks the app trace unavailable when that app-level field is absent, even though browser-side observations remain available. All four unchanged raw primary captures were re-normalized from their private temporary files with the corrected normalizer; test outcomes and raw SHA-256 values are unchanged. The superseded local normalized copies are not retained; only the corrected digest-pinned normalizations are in the report.

## Local validation record

| Check | Result |
|---|---|
| Focused lifecycle, evidence, and Observer tests | 19/19 passed across 3 files on Node `v24.3.0` |
| Full unit/integration suite | 3,815/3,815 passed across 322 files on Node `v24.3.0` |
| Typecheck, lint, CSS structure, production build | Passed |
| Production-preview WebGL isolation | 4/4 passed; M7N trace global absent and WebGPU selection denied |
| M7F replay | 17/17 scenarios passed to a temporary report path |
| M7G diagnostic report | Evidence integrity passed; M7E and M7F predecessor replays valid; temporary outputs removed |
| M7H, M7I, M7J, M7K schema v1, M7K schema v2 selected, M7L, M7M, M7N | Passed; the schema-v2 selected report remains incomplete/blocked |
| M7N CLI positive / negative controls | Valid report printed `PASS`; qualified mutation exited nonzero with the qualification-boundary issue |
| Hosted CI | Pending final PR head |

An initial full-suite attempt under Node `v26.12.1` failed 53 localization integration tests in shared setup because that runtime did not expose `window.localStorage` to the test environment. The repository workflow uses Node 24; rerunning with Node `v24.3.0` passed the complete 3,815-test suite. The first run is retained here as an environment mismatch, not reported as a product regression.

## Qualification boundary

M7N adds diagnostics only. It preserves the historical findings: M7K has 278 discovered tests with 121 passed, 82 unexpected, and 75 skipped; M7L investigated 11 identities with zero verified fixes; M7M investigated 12 identities with zero verified fixes. The full Broad E2E suite was not run and remains **not-qualified**. M7 remains **partially-qualified**, M8 remains denied, spontaneous/external GPU loss remains blocked, M5Q remains partially-qualified, M6 remains development-only, production Ground Glass remains WebGL-only, and production WebGPU remains disabled.
