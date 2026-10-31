# M7B — Native Ground Glass Failure and Lifecycle Qualification

## Decision

M7B is **partially qualified** for the exact development-only Architecture Rise pilot on Chrome 156.0.8078.76 / Three.js r186. The observed native identity was `rendererFamily=webgpu-renderer`, `actualExecutionApi=webgpu`, `internalFallback=none`. The WebGPU renderer running through WebGL2 is kept as a separate non-native control.

The previous M7A retry timeout was a harness defect: the invocation omitted the trusted `VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true` configuration, so policy remained on WebGL and could not emit `runtime-observed`. With the correct flag, the native retry/new-session scenario completed; this is not evidence of an initialization hang.

## Evidence inventory

The machine-readable [M7B lifecycle report](GROUND_GLASS_M7B_NATIVE_LIFECYCLE_REPORT.json) is validated by `evaluateGroundGlassM7bLifecycleEvidence()` and the unit suite. After Review-Fix Round 1, it records 6 evidence-qualified passed scenarios, 10 blocked scenarios, and 1 not-run scenario. The earlier 12 passed / 4 blocked / 1 not-run inventory is retained as historical test execution evidence, not as the strict qualification count. Historical scenario captures remain pinned to their original source SHA; D1 and D4 were recaptured on implementation commit `ff73a5e35bdddbac9f7dd6b55b64b06ee2fcfef9`. The top-level source SHA identifies the implementation/evaluator used for this report revision, while each scenario source SHA identifies its capture. Validation results and final PR HEAD are recorded in the PR #299 handoff.

Confirmed coverage includes:

- Native WebGPU initialization failure after renderer target setup, ordered cleanup, and fallback.
- Latest-request behavior during held work and retirement.
- Cleanup failure remaining sticky and channel-unavailable.
- Injected loss-equivalent failure and a test-only `GPUDevice.destroy()` whose actual `device.lost` Promise was observed.
- Retry epoch/session behavior, rejected `force-retry`, and new owner-issued pilot session.
- Terminal current WebGL context failure across client navigation/remount.
- Production preview isolation and frozen M5Q/M6 regression locks.

## Limits

The full B1/B2 initialization and runtime failure matrix remains incomplete, including actual queue-completion rejection and all Far/Near/readback failure paths. The full request/resize/scene/remount interleaving cross-product and rapid transition sequence were not run. Spontaneous hardware/driver device loss, multiple browser/device coverage, and native multi-channel browser behavior remain unqualified. Broad local E2E stopped at the known unrelated `architecture-foreground-compound.spec.ts` assertion for the missing “Complete the Photograph” heading; no teaching-scene changes were made.

M5Q remains frozen at `m5q-architecture-rise-r186-v3` with Q1 `reference-not-converged`, Q2 `insufficient-support`, Q3 `bounded-qualified`, Q4 `insufficient-support`, Q5–Q7 `reference-not-converged`. M6D remains `m6d-opaque-presentation-v1`. Photographic quality remains `quality-unqualified`; production WebGPU remains disabled. M7 is incomplete; this report does not authorize M8 or production promotion.

## M7B Review-Fix Round 1 — Evidence Integrity

Reviewed baseline: `f98124f4ec5bd02b3b281b85cbdf96f3450df90e`. Implementation/evaluator commit: `625c560bc095fa41c2a6a457d1169e727102df17`. Native recapture source: `ff73a5e35bdddbac9f7dd6b55b64b06ee2fcfef9`. Evaluator revision: `m7b-lifecycle-evidence-v3`.

- **F1 native runtime consistency:** Native WebGPU qualification now cross-checks `attempt`, `runtime-observed`, and (when a host mount is expected) `renderer-mounted` against the claimed native family/API, revision, fallback and generation/attempt identity. The runtime observation now records `internalFallback`; WebGL2 compatibility evidence is explicitly rejected. Pre-mount failure still requires native runtime observation and rejects a mount for the failed generation.
- **F2 cleanup/fallback consistency:** Adapter cleanup and host acknowledgement must agree on generation, channel, host, outcome and ordering. Successful WebGL fallback additionally requires a replacement mount after confirmed cleanup. Failed/uncertain cleanup cannot qualify as successful fallback.
- **F3 publication freshness:** A development-only `host-frame-result` event records the host's actual completion/publication acceptance, latest accepted request and scene, active generation and renderer family. This distinguishes adapter GPU completion from host acceptance and allows replacement WebGL publication to be checked against the retiring WebGPU generation. Historical scenario source hashes are validated individually rather than being rewritten to match the latest report implementation source.

### Provenance and status

Original native captures remain pinned to source `c5e12ac6d9a6a42e2abcf0983d00a73f98481808`; those event arrays and source identities were retained. D1 and D4 were rerun from source `ff73a5e35bdddbac9f7dd6b55b64b06ee2fcfef9` using the `chrome-native-webgpu` project (Chrome 156.0.8078.76, Three.js revision 186). D1 supplied the observed runtime fallback identity, confirmed adapter and host cleanup, WebGL replacement mount, and accepted current host frame. D4 supplied the observed native runtime identity and failed adapter/host cleanup, with no replacement mount and an unavailable host. Commit `625c560bc095fa41c2a6a457d1169e727102df17` changes source-provenance validation so these explicitly pinned historical and refreshed captures can coexist; it does not change renderer lifecycle behavior. Only the B1 and B4 report entries were recaptured; no events were inferred from test names or summary-only publication IDs.

Six historically successful test scenarios with `publication.status=current` remain `blocked` because their retained event selection does not include real host publication events. Their status is an evidence decision; the underlying tests have not been reclassified as execution failures. B1 was restored to `passed` after the D1 recapture supplied a native runtime observation and a current accepted host frame from the replacement WebGL generation. The aggregate M5Q/M6 native regression-suite row remains blocked because its retained report has no event-level native runtime observation; historical test successes remain documented.

Updated qualified inventory: **6 passed, 0 failed, 10 blocked, 1 not run**; overall **`partially-qualified`**. This is an evidence-integrity correction, not a claim of renderer regression.

The review-fix branch adds focused mutation coverage for runtime/backend/revision/identity conflicts, cleanup acknowledgement and replacement ordering, fabricated publication equality, host rejection, stale requests and retired-generation attribution. D1 and D4 were rerun; other native captures were retained.

### Validation

- M7B evidence evaluator and committed report: **25/25 tests passed**.
- Related host, diagnostics, runtime seam, cleanup and frame tests: **61/61 across 7 files passed**.
- Native D1 and D4 recaptures: **2/2 passed**.
- Production-preview isolation: **2/2 passed**.
- Full `npm test`: **301 files, 3,089 tests passed**.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and `git diff --check`: **passed**.
- Final published PR HEAD and hosted CI outcome are recorded in the PR #299 implementation handoff.

The final PR HEAD includes the report/documentation update and is identified in the PR #299 handoff after publication. M7B's remaining native matrix is not completed by this change.

The development-only observation is gated by the existing test seam. Production WebGPU remains disabled; M5Q and M6D decisions are unchanged. M7 remains incomplete.
