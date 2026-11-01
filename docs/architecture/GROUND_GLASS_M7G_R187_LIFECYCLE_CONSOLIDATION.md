# M7G — r187 Lifecycle Gap Closure and Consolidated M7 Qualification

**Decision: partially qualified.** The M7G evidence evaluator accepts an inventory of 5 passed, 0 failed, 2 blocked, and 0 not-run scenarios. The report is valid and the inventory counts match. M7 is not complete, and the M8 entry gate remains denied.

## Scope and runtime

This qualification covers the development-only Architecture Rise M3–M6 pilot on Three.js `0.187.0`. Native captures were collected in Playwright's `chrome-native-webgpu` project with Chrome `156.0.8078.76` on macOS `27.0.0` arm64. The observed renderer was `webgpu-renderer`, the execution API was `webgpu`, and internal fallback was `none`. This establishes native WebGPU execution in the tested browser environment; it makes no claim about hardware acceleration or other browser/device combinations.

The M7G report uses evaluator `m7g-r187-consolidation-evaluator-v2`. Run the strict replay with `npm run evidence:replay:m7g`; the diagnostic report command is `npm run evidence:report:m7g`. Strict replay correctly returns a nonzero result while the qualification remains partial. Diagnostic mode succeeds only when evidence integrity is valid. The machine-readable result is [GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION_REPORT.json](GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION_REPORT.json).

## Lifecycle ownership audit

- `GroundGlassRenderHostState` remains the authority for renderer-attempt authorization, pilot session/retry epoch, accepted request state, generation retirement, cleanup acknowledgement, sticky fallback, and terminal unavailable state.
- `GroundGlassRenderHost` attaches host/request identity to accepted requests and frame results. It selects a replacement only after the retiring adapter reports disposal and host state confirms cleanup.
- The WebGPU adapter owns its renderer and M3–M6 targets. It waits for submitted queue work when retirement requires it, disposes adapter-owned resources, and does not dispose borrowed scene resources. Adapter disposal outcome is sent to the host before a replacement can mount.
- Initialization, queue completion, readback, and presentation work can settle asynchronously after a request becomes stale. Adapter generation/request checks and host acceptance checks prevent stale results from replacing current diagnostics or publication.
- The development test seam is gated to the trusted development/test configuration. It provides named failure points, the M5 composite hold boundary, and test-only destruction of the adapter-owned GPU device.
- Raw Debug to the M6 experimental presentation path is a request/presentation transition within the mounted renderer generation; it does not create a separate renderer-attempt authority.
- The r187 initialization capture now reports the actual named operation `initialize-render-target-state`. Its identity and ordered failure/cleanup/acknowledgement/fallback/publication events are captured independently of the older blocked M7C record.

## New M7G evidence

| Scenario | Result | Evidence and source |
|---|---|---|
| Initialization after target setup | Passed | [Native capture](ground-glass-m7g-r187/native/initialization/init-after-target-recheck.json), source `8dfc6e10baf5d03ceb06826a1a9a7ca4498e782d`. Failure sequence 17 identifies attempt, generation, request, channel, scene, stage `initialization`, and operation `initialize-render-target-state`; confirmed adapter cleanup 18, host acknowledgement 19, WebGL replacement 20, current accepted frame 21. |
| Device-loss equivalent | Passed | [Native capture](ground-glass-m7g-r187/native/device-loss/device-loss-equivalent.json), source `8dfc6e10baf5d03ceb06826a1a9a7ca4498e782d`. Explicit test callback classification; this is not a `GPUDevice.lost` observation. |
| Test-destroyed `GPUDevice.lost` Promise | Passed | [Native capture](ground-glass-m7g-r187/native/device-loss/test-destroyed-device-lost-promise.json), source `8dfc6e10baf5d03ceb06826a1a9a7ca4498e782d`. The owned device was destroyed with cause `test-destroy` (sequence 22); its actual `GPUDevice.lost` Promise was observed with the same cause (23), followed by runtime failure (24), cleanup (26), host acknowledgement (27), WebGL replacement (28), and accepted current frame (29). |
| Spontaneous/external device loss | Blocked | [Observation record](ground-glass-m7g-r187/native/device-loss/external-loss-observation.json). No independent external loss mechanism was available. The test-equivalent and test-destroy observations are not relabeled as spontaneous loss. |
| Held M5 composite and latest request | Passed | [Native capture](ground-glass-m7g-r187/native/m5-composite-latest-request.json), source `291974a520b3fc092988b019191f2e2fa3e1b3f5`. R1 was held at M5 composite settlement, R2 was accepted while held, R1 settlement was released and rejected as stale, and R2 completed matching M4/M5/M6 work and became the accepted/displayed request. |
| Broad application E2E | Blocked | [Playwright result](ground-glass-m7g-r187/validation/broad-e2e-playwright.json) and [summary/clean-main comparison](ground-glass-m7g-r187/validation/broad-e2e.json), source `095d9725a1ddb272bf780bd5e7e9e2a2b8f61837`. The run executed 277 tests: 103 passed, 99 failed, 75 skipped. Only representative failures were replayed on clean `origin/main`; the remaining failures are unclassified and are not called baseline failures. |
| Production-preview isolation | Passed | [Production capture](ground-glass-m7g-r187/validation/production-isolation.json), source `095d9725a1ddb272bf780bd5e7e9e2a2b8f61837`. Hostile M3–M6/test-seam Vite flags and a WebGPU query did not enable production WebGPU: the build issued no WebGPU module requests, made no WebGPU attempts, exposed no pilot/test-seam UI, and used the WebGL renderer/API. |

The M5 hold occurs after GPU submission, at the adapter's asynchronous settlement boundary. It proves stale-result and publication rejection while a submitted result is held by the test seam; it does not claim that the GPU queue remained physically busy for the entire hold.

## Lifecycle coverage across M7C–M7G

| Area | Consolidated evidence |
|---|---|
| Initialization/runtime failures | M7C native failure matrix remains accepted for its scoped failure cases. M7G separately closes the initialization operation-identity gap and records the ordered cleanup/fallback chain. |
| Device loss | M7C/M7G cover the injected equivalent and the actual `GPUDevice.lost` Promise after test-only destruction. Spontaneous/external loss remains blocked. |
| Cleanup and sticky fallback | Confirmed cleanup precedes one bounded WebGL replacement; failed/uncertain cleanup, terminal WebGL failure, contradictory acknowledgement, duplicate cleanup, and invalid replacement ordering are rejected by the predecessor and M7G integrity suites. |
| Async retirement/latest request | M7C covers Raw latest-request retirement. M7G adds the held M5 composite interleaving and verifies no stale R1 final publication after R2 becomes authoritative. |
| SPA transitions/remount | M7C evidence covers scene navigation during cleanup, pending unmount, resize invalidation, and remount without implicit retry. These are replayed as predecessor evidence, not recaptured by M7G. |
| Explicit retry/new session | M7C covers authorized retry and new pilot session, including rejection of unknown retry actions and consumed-session remount. |
| Independent channels | M7C's focused channel scenario preserves separate request, generation, publication, and retry identity. |
| Production isolation | M7C production-preview evidence is retained; M7G reruns production preview under hostile M3–M6/test-seam build flags and confirms WebGL-only behavior. |

The M7G evaluator status means the consolidated evidence inventory is internally valid; it does not convert blocked native/environment gaps to passes. Version 2 derives the broad E2E outcome counts from the persisted Playwright test tree and binds the summary to the exact raw JSON SHA-256. A claimed pass cannot override the 99 recorded unexpected outcomes or 75 skipped tests. The current capture remains blocked, with 3 unexpected failures reproduced on clean `main` and 96 still unclassified.

### Device-loss event sequence

The native test-destroy capture records `device-destroy-requested(test-destroy)` → actual `device-lost-observed(test-destroy)` → runtime failure → adapter cleanup → host acknowledgement → WebGL replacement → accepted WebGL frame. Version 2 anchors both device events to the captured attempt and generation, then checks their sequence against the native mount, cleanup acknowledgement, replacement generation, and accepted frame. A spontaneous/external device loss remains unobserved. Duplicate events, joint or individual wrong-generation changes, changed attempt identity, broken chronology, and relabeling test-caused loss are rejected by mutation-sensitive evaluator tests.

## Consolidated predecessor evidence

M7G replays predecessor records without rewriting their historical captures. M7C remains **18 passed, 0 failed, 2 blocked, 1 not-run**. M7D remains scoped r187 M4 research qualification; M7E remains r187 M5 Gather/B1 research qualification with partially-qualified M5Q; and M7F remains scoped r187 presentation conformance with photographic quality unqualified. Offline M7E replay accepted 12/12 persisted scenarios and M7F replay accepted 17/17. The original M7B final strict inventory remains **6 passed, 0 failed, 10 blocked, 1 not-run**; earlier 12/4/1 figures are pre-review-fix history.

The M7G evaluator verifies the seven-scenario inventory and counts, replays M7C lifecycle contracts, and checks M7E/M7F offline replay results. Its focused mutation suite covers runtime identity, cleanup and fallback order, generation/request freshness, loss cause, predecessor replay integrity, production isolation, authorization boundaries, and report metadata. Historical M7B–M7F reports and r186 evidence were not relabeled or overwritten.

## Review-fix round 1 — evidence integrity

- **F1 — Broad E2E status:** the reviewed v1 evaluator accepted a mutation that changed only `status` to `passed`, despite 99 failures and 75 skips. Version 2 reads and hashes the raw Playwright JSON, derives expected/unexpected/skipped/flaky outcomes from its 277 test records, and requires the summary, scenario status, and clean-main classification to agree. Raw report SHA-256 is `393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6`. Skipped cases remain `not-run`; no exclusions are accepted. The current scenario stays blocked.
- **F2 — Device-loss ownership:** the reviewed v1 comparison accepted a mutation that changed the destroy and loss generations together while leaving the failed capture identity unchanged. Version 2 binds test destruction and the resulting `GPUDevice.lost` observation to the native attempt/generation, then orders them through failure, confirmed cleanup, host acknowledgement, WebGL replacement, and the accepted replacement frame. Cause labels distinguish `test-destroy` from external loss.
- **F3 — Fresh predecessor replay:** the former fixed report paths allowed a previous success to remain available after a failed subprocess. M7E and M7F now replay as child processes into unique, initially absent paths under a temporary repository directory. A process-level regression writes a valid report and exits 7; the replay is rejected despite that report. The evaluator also requires no signal/spawn error, a newly written and parsed report, matching report/source identities, valid scenario counts, and a report digest. The committed M7E/M7F snapshots are preserved as historical artifacts and are not inputs to the current replay.
- **F4 — Hosted diagnostic:** CI fetches retained PR #303 and #304 history so both M7E and M7F source commits remain verifiable in the shallow checkout. It runs the M7G diagnostic report after tests and M7F replay, writes report/evaluation outputs to temporary workspace paths, removes them on exit, and prints evidence integrity, partial qualification, M8 denial, and production WebGPU status. Corrupt or missing evidence exits nonzero; the valid partially-qualified report exits successfully in diagnostic mode. Local process validation observed diagnostic exit 0 and strict replay exit 1 while M7 remains partial.

Focused evidence integrity validation: 82 tests passed across the M7G evaluator and subprocess-orchestration suites, including raw-report mutations, device-loss identity/chronology mutations, source-revision binding, and process-level replay failure controls. The full local suite passed 3,498 tests across 312 files; typecheck, lint, CSS structure, and production build also passed. No native captures or predecessor replay snapshots were rewritten in this review-fix round.

## Broad E2E assessment

The current broad Chromium run is blocked by its 99 unexpected failures. On a clean archive of `origin/main` at `bda4ce9244111517e0898a0ead3b61d5faba7eb2`, the known Architecture + Foreground hidden-heading failure reproduced with the same hidden objective paragraph. Two representative additional failures also reproduced: an ordinary-Chromium fallback test expected r186 while r187 is installed, and a route smoke test expected zero development policy/seam module requests but saw four. These comparisons do not classify the other broad-suite failures; those remain unresolved and unclassified. The original Playwright JSON is retained for follow-up.

## Qualification and authorization boundary

- Consolidated M7: **partially-qualified**; strict qualification pass is false.
- M8 entry: **denied**. External device-loss evidence remains blocked, and the broad E2E suite has unresolved failures.
- M5Q photographic/optical quality remains partially qualified; M6 photographic quality remains unqualified.
- M3 Raw RTT remains the renderer-attempt authority for the trusted development pilot. M4/M5 records remain research-only and M6 remains development-only; they do not independently authorize renderer selection.
- Production Ground Glass remains WebGL-only. M7G does not enable production WebGPU, change scene allowlists, or authorize M8/M9.

## Supporting artifacts

- [Consolidation evaluator output](ground-glass-m7g-r187/replay/consolidation-evaluation.json)
- [M7E offline replay](ground-glass-m7g-r187/replay/m7e-offline-replay.json)
- [M7F offline replay](ground-glass-m7g-r187/replay/m7f-offline-replay.json)
- [Focused and broad validation artifacts](ground-glass-m7g-r187/validation/)
