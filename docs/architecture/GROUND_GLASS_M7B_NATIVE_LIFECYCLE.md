# M7B — Native Ground Glass Failure and Lifecycle Qualification

## Decision

M7B is **partially qualified** for the exact development-only Architecture Rise pilot on Chrome 156.0.8078.76 / Three.js r186. The observed native identity was `rendererFamily=webgpu-renderer`, `actualExecutionApi=webgpu`, `internalFallback=none`. The WebGPU renderer running through WebGL2 is kept as a separate non-native control.

The previous M7A retry timeout was a harness defect: the invocation omitted the trusted `VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true` configuration, so policy remained on WebGL and could not emit `runtime-observed`. With the correct flag, the native retry/new-session scenario completed; this is not evidence of an initialization hang.

## Evidence inventory

The machine-readable [M7B lifecycle report](GROUND_GLASS_M7B_NATIVE_LIFECYCLE_REPORT.json) is validated by `evaluateGroundGlassM7bLifecycleEvidence()` and the unit suite. It records 12 passed scenarios, 4 blocked scenarios, and 1 not-run scenario. A follow-up full unit/integration rerun after adding the committed-report check passed 301 files / 3,078 tests; this static rerun did not recapture native browser evidence, which remains tied to source `c5e12ac6d9a6a42e2abcf0983d00a73f98481808`. The report keeps source SHA, test identity, runtime identity, lifecycle event order, cleanup/fallback outcomes, request publication status, artifacts, and limits distinct.

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
