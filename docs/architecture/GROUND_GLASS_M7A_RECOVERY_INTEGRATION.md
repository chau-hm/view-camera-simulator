# M7A — Development Pilot Session and Failure Recovery Integration

**Status:** M7A host integration implemented; M7 Native lifecycle qualification remains pending
**Scope:** Development-only Architecture Rise WebGPU pilot
**Base:** M6D merge `6f24b833566777220eccf8149f3266a40559dd86`

## Objective and boundary

M7A connects the existing `GroundGlassRenderHostState` owner, backend policy, renderer generations, cleanup evidence, and pilot retry latch to one bounded recovery path. It does not introduce a second render manager or change normal rendering. The owner remains above `RouterProvider`, so channel and session state survives ordinary scene-route remounts.

This implementation does not complete M7. In particular, it does not qualify the full failure matrix on native Chrome/WebGPU, real SPA navigation and device lifecycle, or multiple devices. M7B owns that evidence. Production WebGPU remains disabled, the public backend remains WebGL, M6D remains `architecture-implemented` only for the exact development Architecture Rise pilot, photographic quality remains `quality-unqualified`, and frozen M5Q Q1–Q7 statuses are unchanged.

## Baseline gap audit

| Area | Before M7A | Existing evidence | M7A correction |
| --- | --- | --- | --- |
| Authorization and policy | Trusted development flags, exact Architecture Rise feature evidence, expected Three.js revision, capability preflight, channel, and session identity were already assembled by the policy-input builder. Reported `navigator.gpu` availability was only preflight evidence. | Backend policy/compatibility tests; existing native M3/M6 suites. | Preserved. Recovery actions rebuild policy from current trusted build configuration and the latest accepted request. |
| WebGPU initialization/runtime | Adapter errors and `GPUDevice.lost` already reached the host failure callback; renderer, GPU work, and resources were owned by the WebGPU adapter. Queue waits and cleanup injection existed, but queue-completion rejection and a controlled device-loss signal were not directly injectable through one host path. | Existing adapter/host unit and native failure tests. | Added a gated queue-completion failure point and a test-only device-loss equivalent that calls the existing `device.lost` failure handler. No second runtime loss owner was added. |
| Application fallback and runtime identity | Policy selection, attempted backend, mounted renderer family/API, internal WebGL2 compatibility, and application fallback were already separate. | Backend diagnostics tests and the existing fallback native suite. | Preserved; M7A does not infer mount or native execution from authorization or capability evidence. |
| Cleanup and stale publication | Generation retirement, cleanup outcomes, latest-request promotion, and exact frame publication checks already existed. Failed/uncertain cleanup already blocked replacement. | Host handoff, stale completion, latest-request, and cleanup unit tests; existing D1/D6 native cases. | Reused the same owner and cleanup path. Added failure attribution context and retained fail-closed cleanup semantics. |
| Retry policy | Pure channel/session retry state, explicit retry authorization, fresh policy evaluation, cleanup checks, epochs, and failure history already existed. | Backend contract tests. | Missing link was a reachable host action. Added only a development/test-seam action routed through the host owner; there is no public control or automatic retry. |
| WebGL failure | Initialization and runtime failures did not consistently become a terminal state, leaving a possible repeated WebGL mount path. | Existing initialization and lifecycle tests were incomplete for this boundary. | WebGL failure now retires that generation and terminates the channel at unavailable after cleanup; it never selects WebGPU or recursively mounts WebGL. |
| Failure identity | Latest failure carried generation/request/backend/stage/pass/reason, while retry history carried session/epoch/scene/stage/reason. Neither record alone bound the full host-to-request identity. | Existing retry history and diagnostics tests. | Both records now include host, channel/session/epoch, generation, accepted request/scene, stage, failed operation, and reason (request identity remains explicitly nullable only if no accepted request exists). |

## Recovery state machine

| Transition | Owner behavior | Evidence in this branch |
| --- | --- | --- |
| Authorized WebGPU initialization to mounted runtime | Selection authorizes an attempt; only adapter mount evidence populates actual runtime identity. | Existing policy, runtime-identity and adapter tests. |
| WebGPU initialization/runtime failure | Revoke the failed generation, record its request/session context, consume the authorized epoch, and request retirement. | `GroundGlassRenderHost.test.tsx`; existing native D1/D2/D4 controls. |
| Confirmed WebGPU cleanup | Re-evaluate the latest pending request with the consumed session latch, then activate one WebGL generation. | Host latest-request tests; existing D1/D6 controls. |
| Failed or uncertain cleanup | Keep the retiring generation and report unavailable; a later confirmed callback cannot erase a failed/uncertain result. | Host cleanup unit tests. |
| WebGL initialization/runtime failure | Retire the failed WebGL generation and terminate the channel at unavailable; do not select another backend. | New WebGL initialization/runtime, cleanup and remount regression tests. |
| Explicit retry | Require a consumed epoch, same session/channel, confirmed prior cleanup, and a fresh authorized WebGPU policy selection. Retire the current WebGL generation before the new attempt mounts. | New React host-action integration test plus backend retry contract tests. |
| New pilot session | Generate a new owner-scoped identity only after the developer/test action; run the same cleanup and fresh-policy gates; retain old failures. | New React host-action integration test and retry contract tests. |
| Retry failure | Consume the new epoch and return to sticky WebGL after confirmed cleanup; no automatic second retry occurs. | New React host-action integration test; existing retry contract tests. |
| Device loss | Native `device.lost` and the test equivalent share one `reportFailure` path. | Adapter code and a native E2E case added; execution remains pending M7B/native availability. |

## Session and failure identity

`GroundGlassRenderHostState` remains the sole mutable owner. A retry latch is keyed by channel and `pilotSessionId`; frame request, renderer generation, scene, resize, route, and component lifetimes do not reset it. The app owner issues a new trusted development session ID using its owner instance identity and a monotonic sequence. No URL or local-storage value participates.

Every consumed retry failure records `channelId`, `pilotSessionId`, `retryEpoch`, `hostId`, `rendererGenerationId`, `requestId`, `sceneId`, failure `stage`, `failedOperation`, and `failureReason`. The latest-failure diagnostic carries the same context and remains separate from mounted runtime evidence. Retry consumption rejects malformed or cross-channel/request identity context.

The development/test seam accepts only `explicit-retry` and `new-pilot-session`. A rejected action records a reason without changing the retry latch. An authorized action reuses the latest accepted request, and the host owner waits for current-generation cleanup before a replacement is activated. The test seam is available only in a Vite development build with `VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true`; no public UI or route was added.

## Request freshness and channel isolation

The existing owner accepts and stores the latest request while an adapter retires. Confirmed cleanup promotes that latest request and re-runs policy with the session latch. Existing exact generation/request/channel/scene/host publication checks reject stale WebGPU or WebGL completion. Pending-host detach discards its request rather than promoting it. Unit coverage includes latest-request promotion, late completion rejection, pending-host detach, and independent comparison channels. Full route, resize, request-update and real remount coverage under native GPU activity remains in M7B.

## Failure injection and cleanup

M7A reuses the single existing development failure-injection seam. Available controls now include initialization-after-target, render-pass/runtime submission failures, queue-completion rejection, existing readback failure points, target-disposal failure, held adapter work/queue completion, retirement callbacks, explicit recovery actions, and a device-loss equivalent. Injection routes through existing adapter callbacks and the `GroundGlassRenderHostState` owner.

Confirmed cleanup is the only outcome that permits a replacement. Failed and uncertain cleanup stay unavailable and preserve their reason; stale confirmation cannot make them successful. The test seam does not claim that disposal proves driver-memory reclamation.

## Evidence status

Focused owner/retry/diagnostic tests passed (55 tests), as did the full unit/integration suite (3,058 tests), typecheck, lint, CSS check, and production build. Native Chrome/WebGPU checks passed for M7A retry/new-session and device-loss-equivalent recovery (2 cases), queue-completion rejection (1 case), the frozen M5Q regression (1 case), M6/M6B/M6C (6 cases), and M6D output (1 case). The production-preview isolation suite passed both cases. The requested broad local E2E workflow stopped at the known unrelated `architecture-foreground-compound.spec.ts` assertion for the missing “Complete the Photograph” heading; the M7A diff does not touch that teaching route. The device-loss case routes a controlled equivalent through the real failure callback and does not substitute for a physical `GPUDevice.lost` event or the M7B matrix. Exact commands and outcomes are recorded in [GROUND_GLASS_M7A_RECOVERY_REPORT.json](GROUND_GLASS_M7A_RECOVERY_REPORT.json).

M7B must run native Chrome/WebGPU with runtime identity (`webgpu-renderer`, `webgpu`, internal fallback `none`), then cover init/pipeline failure, runtime submission and readback failure, queue delay/rejection, disposal throw, latest request during cleanup and WebGL initialization, actual resize, scene switch, SPA navigation, real remount, explicit retry and failed retry, independent channel behavior, WebGL terminal failure, and production-preview isolation. M7B should validate this host without redesigning it.

## Unchanged decisions

- No optics, coordinate, M5/B1, M6 presentation, M6D output, or WebGL rendering algorithm changed.
- The M6D opaque output contract remains scoped to its exact development Architecture Rise pilot.
- M5Q revision `m5q-architecture-rise-r186-v3` and Q1–Q7 statuses are unchanged.
- Photographic quality remains `quality-unqualified`.
- No public WebGPU selector, retry control, scene allowlist expansion, or production activation was added.
- M7 is not marked complete or fully qualified; M7B Native evidence remains required.
