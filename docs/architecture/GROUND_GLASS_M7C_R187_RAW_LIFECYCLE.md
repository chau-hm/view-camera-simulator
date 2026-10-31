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

The evaluator unit suite contains one positive committed-report control and 19 evidence mutations. It rejects WebGL2 misclassified as native, wrong Three.js and policy revisions, r186 evidence reuse, failed or contradictory cleanup, replacement before confirmation, wrong-generation publication, stale acceptance, stale overwrite of final publication state, fabricated request identity, implicit retry, terminal WebGL publication, count mismatch, missing provenance, evaluator revision mismatch, and treating the initialization failure with an unknown operation as fully qualified. The focused M7B/M7C and host/policy suites passed **150 tests across 6 files**. The standalone M7C evaluator suite passed **20 tests**.

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

New captures are stored under [`ground-glass-m7c-r187/`](ground-glass-m7c-r187/): 13 failure-host event records, the application baseline, production preview evidence, and focused unit-validation summary. The report pins native/production capture source SHA `5dc1339cca7dc0470a9883e8c870353b4fe0191c`; evaluator and focused unit evidence use source SHA `8dd6e30fe9841804a0f1d7a726846cbba2dd86c9`. The top-level report source SHA identifies the evaluator code; scenario-level source SHAs identify their actual capture code.

## Qualification limits and next stage

Remaining r187 Raw lifecycle gaps are operation-level qualification of the initialization-after-target failure, spontaneous/external device loss, broad local E2E, and coverage on other browser/device environments. The broad suite was not run, and no prior missing-heading assertion is asserted as a current `main` baseline.

M4 Physical CoC/footprint research, M5 Far/Near Gather and B1 reconstruction, M5Q, and M6 presentation/alpha work require distinct r187 evidence. Their current r186 records remain historical and denied for r187. M7 remains incomplete, and **M8 is not authorized** because the full Raw/DOF/presentation milestone and the later scene/material parity gates remain open.

Production WebGL behavior was not changed. No renderer or host correction was needed for these captures.
