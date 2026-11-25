# M7C — Three.js r187 Native Raw RTT Lifecycle Qualification

## Decision

M7C is **partially qualified** for the development-only Architecture Rise M3 Raw RTT pilot on the captured Chrome/macOS runtime. The report inventory contains **18 passed, 0 failed, 2 blocked, and 1 not run** scenario. This qualifies the captured r187 Raw lifecycle paths only. It does not complete M7.

The installed `three` package reported revision `187`. Native captures observed `rendererFamily=webgpu-renderer`, `actualExecutionApi=webgpu`, and `internalFallback=none`. The selected policy evidence and mounted renderer evidence both identify `m3-architecture-rise-raw-rtt-native-r187-v1`. The separate WebGL2 compatibility control records `actualExecutionApi=webgl2` and `internalFallback=webgl2-compatibility`; it is not counted as native WebGPU.

Captured environment: Chrome 156.0.8078.76, macOS runtime `darwin 27.0.0` on arm64, Node v24.3.0. No hardware-acceleration claim is made. Each native scenario records its capture source SHA, test project, test ID, exact invocation, browser/runtime identity, ordered events, and supporting JSON artifact in the [machine-readable report](GROUND_GLASS_M7C_R187_RAW_LIFECYCLE_REPORT.json).

## Revision and production boundary

- r187 M3 Raw RTT is eligible only for the trusted development gate and Architecture Rise.
- r187 M4/M5/M6 remain denied. The r186 research and presentation records do not authorize r187 execution.
- Unsupported scene/revision combinations fail closed.
- Production Ground Glass remains WebGL-only. The production preview test confirms that a query request or development compatibility record cannot activate WebGPU.
- The native WebGPU backend running internally through WebGL2 is a negative control, not native qualification.

Historical M7B evidence remains in [the M7B report](GROUND_GLASS_M7B_NATIVE_LIFECYCLE_REPORT.json), unchanged: **6 passed, 0 failed, 10 blocked, 1 not run**, `partially-qualified`. The old roadmap count of 12 passed / 4 blocked / 1 not run describes a pre-review-fix execution snapshot. The M5Q revision remains `m5q-architecture-rise-r186-v3`, M6D remains `m6d-opaque-presentation-v1`, and the existing r186 feature evidence remains historical.

## Scenario inventory

The evaluator requires the exact 21-scenario inventory and compares declared totals with computed statuses.

| Coverage | Result | Recorded evidence |
| --- | --- | --- |
| Native r187 Raw baseline and renderer identity | Passed | Native runtime, policy evidence, mounted renderer and accepted frame agree. |
| Initialization after target setup | Blocked | Native stage, cleanup and replacement ordering were observed, and the seam recorded `initialization-after-target`; the runtime failure event reports `operation=unknown`, so operation-level qualification is withheld. |
| Scene render submission failure | Passed | Failure stage, cleanup outcome, host acknowledgement, replacement and accepted publication are ordered. |
| Queue completion rejection | Passed | The rejected queue completion enters the native failure path and falls back after confirmed cleanup. |
| Display/presentation submission failure | Passed | The frame fails as a whole and fallback follows confirmed cleanup. |
| Adapter-owned disposal failure | Passed | Failed disposal leaves the host unavailable without a replacement generation. |
| Injected device-loss equivalent | Passed | `test-callback-equivalent` follows the normal native cleanup path. |
| Actual `GPUDevice.lost` after test destruction | Passed | The owned device is destroyed by the test and its actual Promise is observed. |
| Spontaneous or external device loss | Blocked | No spontaneous loss was observed; the test-destroyed Promise is not reported as one. |
| Pending queue retirement | Passed | Replacement waits for the adapter operation to settle and cleanup to be acknowledged. |
| Latest request and stale result | Passed | Focus, aperture, stage pan and quality change while work is held; the host accepts the latest result before rejecting the stale completion, then remains `ready` with the newer request still current and last completed. |
| Sticky fallback and remount | Passed | Remount preserves the consumed session and does not create another native attempt. |
| Explicit retry, rejected action and new session | Passed | The capture records the exact native attempt generations for the initial session, authorized retry and new session; an unknown action adds no attempt. |
| WebGL2 compatibility negative control | Passed | WebGPURenderer using its internal WebGL2 compatibility path is explicitly rejected as native WebGPU. |
| Terminal WebGL failure across remount | Passed | Terminal WebGL failure has no successful later publication and does not recursively replace WebGL. |
| Scene navigation during pending cleanup | Passed | The retiring generation does not publish after unmount; remount does not consume another native attempt. |
| Uncertain cleanup and replacement denial | Passed | Focused host tests verify failed/uncertain cleanup prevents replacement. |
| Independent channel state | Passed | Focused host tests preserve per-channel retry and publication ownership. |
| r186/r187 policy boundary | Passed | r186 M4/M5/M6 records and unsupported revisions do not authorize r187. |
| Production preview isolation | Passed | Two production-preview tests keep Ground Glass on WebGL and deny query/test-flag activation. |
| Broad local E2E | Not run | No current clean-main baseline claim is made for the previous missing-heading failure. |

The 13 native failure-host test results were **13 passed, 3 skipped**; the skipped cases are M4 rows excluded by the trusted Raw-only test configuration. The application pilot was **1 passed**. The production-preview suite was **2 passed**. An existing Raw RTT regression run was **8 passed** on r187 before this new capture set; it is recorded as regression-only and contributes no M7C lifecycle scenarios.

## Event integrity

M7C reuses the M7B runtime, cleanup and publication validators. The revision-specific evaluator additionally checks r187 policy authorization, exact inventory counts, native runtime provenance, the latest-request chain, the retry/session attempt inventory, pending unmount behavior, WebGL2 negative-control identity, terminal WebGL behavior, and complete capture provenance.

The original M7C v1 evaluator unit evidence contained one positive committed-report control and 19 evidence mutations. The review-fix validation below supersedes its evaluator revision and test counts while preserving the original capture provenance.

The exact raw native test invocation used trusted gates and the `chrome-native-webgpu` Playwright project:

```bash
PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH \
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 \
GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true \
VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true \
npm run test:e2e -- --project=chrome-native-webgpu \
  src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts
```

Hosted workflow run 1803 passed its CI job on published head `a453a406e1596838db409a97146a7e8774c31b49`; its deploy job was skipped because this was a pull request. The report records that run SHA explicitly.

## M7C Review-Fix Round 1 — Event Integrity

The v2 evaluator closes the review findings without changing M7B's evaluator or the renderer lifecycle:

- **F1:** The test-destroy scenario now requires exactly one `device-destroy-requested` and one `device-lost-observed` event for its native generation and attempt, both caused by `test-destroy`. The lost event must carry `reason=destroyed` and a message. Destroy, observed loss, runtime failure, adapter cleanup, host acknowledgement, WebGL replacement and current replacement publication must appear in that order. The adapter event is emitted by the `GPUDevice.lost` Promise callback.
- **F2:** Intentional retirement now requires an observed held queue, release request, and `queue-completion-settled` event recorded after the real `device.queue.onSubmittedWorkDone()` resolves. Adapter cleanup and host acknowledgement must both be confirmed before the replacement mount. Missing, duplicate, contradictory or misattributed events fail the scenario.
- **F3:** The loss-equivalent scenario requires one `device-loss-equivalent-requested` event with `cause=test-callback-equivalent`, tied to the mounted generation and attempt and ordered before failure and the same cleanup/publication chain. It rejects substitution of the test-destroy Promise path.
- **F4:** The initial, explicit-retry and new-session native generations are each checked for r187 `webgpu-renderer` / `webgpu` / `none` identity, attempt, request and scene attribution. Failed attempts require runtime failure, confirmed adapter cleanup, confirmed host acknowledgement and an intervening WebGL replacement before the next native attempt. The final new-session generation must mount natively and publish its accepted current frame.
- **Pending cleanup navigation:** The event chain must independently match the summary acknowledgement, place unmount before confirmed adapter cleanup and host acknowledgement, reject retired output after unmount, and show a WebGL remount on a host attached after acknowledgement without another native attempt.

Before these evaluator changes, ten targeted evidence mutations were executed against v1 and all ten were accepted: three F1, two F2, two F3, two F4 and one pending-cleanup acknowledgement mutation. The permanent v2 suite now passes **59 tests**: two positive controls and 57 rejection tests. It includes those reproduced cases plus identity, chronology, duplicate-event, cleanup, replacement, publication, retry and remount mutations. The focused M7B/M7C, backend-policy, presentation-policy and host suites pass **155 tests across five files**; M7B's 34-test evaluator suite remains unchanged and passes.

F1, F3, F4 and pending-cleanup navigation use their existing captures. The original D5 pending-queue capture did not contain a durable observation of the held state and actual queue settlement, so one bounded native recapture was performed. The test-only adapter event is recorded only after the actual `onSubmittedWorkDone()` Promise resolves. The new capture is [M7C D5 retirement-integrity R1](ground-glass-m7c-r187/native-failure-host/m7c-r187-d5-pending-queue-retirement-integrity-r1.json), from source SHA `fd096b74a031579c89b3b474907c9a6a3ea45637`, with Chrome `156.0.8078.76`, Three.js `187`, native WebGPU required, and project `chrome-native-webgpu`; the focused scenario passed. The original D5 artifact and source SHA remain preserved alongside it. No other native scenario was recaptured in this review-fix round.

The report uses evaluator revision `m7c-r187-lifecycle-evidence-v2`; the 21-scenario inventory remains **18 passed, 0 failed, 2 blocked, 1 not run**, `partially-qualified`. The blocked initialization operation and spontaneous/external device-loss cases remain unchanged. This review fix does not qualify r187 M4/M5/M6, change production WebGL, complete M7, or authorize M8/M9.

New captures are stored under [`ground-glass-m7c-r187/`](ground-glass-m7c-r187/): 13 failure-host event records, the application baseline, production preview evidence, and focused unit-validation summary. The report pins native/production capture source SHA `5dc1339cca7dc0470a9883e8c870353b4fe0191c`; evaluator and focused unit evidence use source SHA `e4c9f1d2b4875bd9c5dfe21841f061b42fde2f06`. The top-level report source SHA identifies the evaluator code; scenario-level source SHAs identify their actual capture code.

## Qualification limits and next stage

Remaining r187 Raw lifecycle gaps are operation-level qualification of the initialization-after-target failure, spontaneous/external device loss, broad local E2E, and coverage on other browser/device environments. The broad suite was not run, and no prior missing-heading assertion is asserted as a current `main` baseline.

M4 Physical CoC/footprint research, M5 Far/Near Gather and B1 reconstruction, M5Q, and M6 presentation/alpha work require distinct r187 evidence. Their current r186 records remain historical and denied for r187. M7 remains incomplete, and **M8 is not authorized** because the full Raw/DOF/presentation milestone and the later scene/material parity gates remain open.

Production WebGL behavior was not changed. No renderer or host correction was needed for these captures.
