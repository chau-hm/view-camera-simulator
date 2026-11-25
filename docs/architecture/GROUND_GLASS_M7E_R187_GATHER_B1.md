# M7E — Three.js r187 M5 Gather and B1 Requalification

**Status:** partially-qualified research evidence
**Evidence revision:** `m5-architecture-rise-aperture-gather-r187-v1` and `m5-architecture-rise-far-reconstruction-b1-r187-v1`
**Source SHA exercised by native captures:** `9382217c7820be87a596124fd78c28239d416653`
**Scene/source:** `architecture-rise` / `architecture-rise-raw-rtt-v1`

## Scope and decision

M7E re-executed the registered Architecture Rise M5 Far/Near Gather and B1 research paths using Three.js `0.187.0`. It adds revision-specific research records and native captures; it does not grant M5 independent renderer-selection authority. The existing M3 Raw pilot remains the only renderer-attempt authority for this development path.

The capture matrix and B1 boundary probe passed their numerical, storage, identity, and provenance gates. The broader M5Q quality matrix remains **partially-qualified**: Q3 is bounded-qualified, Q1/Q5/Q6/Q7 did not converge to the Full32/Full64 reference under the frozen limits, and Q2/Q4 had insufficient support. Consequently, both r187 M5 records remain `research-only`. M6 on r187, production WebGPU, and photographic quality remain unqualified.

The historical M5Q revision `m5q-architecture-rise-r186-v3` and M6D revision `m6d-opaque-presentation-v1` are unchanged. The r187 M5Q report identifies the historical M5Q threshold source; all numeric gates are reused without adjustment.

## Native runtime and provenance

The native-required `chrome-native-webgpu` project observed:

| Evidence | Observation |
|---|---|
| Three.js | `0.187.0`, `REVISION === "187"` |
| Renderer family | `webgpu-renderer` |
| Execution API | `webgpu` |
| Renderer internal fallback | `none` |
| Application fallback | not observed during the passing capture matrix |
| Browser | Chrome `156.0.8078.76` |
| Runtime | macOS `darwin arm64`, Node `v24.3.0` |
| Scene/source | Architecture Rise / `architecture-rise-raw-rtt-v1` |
| Native source SHA | `9382217c7820be87a596124fd78c28239d416653` |

The exact native invocation was:

```bash
PATH="/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH" \
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 \
GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH=1 \
GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION=1 \
GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=1 \
GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION=1 \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true \
VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=true \
VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH=true \
VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true \
GROUND_GLASS_M7E_EVIDENCE_DIR=docs/architecture/ground-glass-m7e-r187-gather-b1 \
PLAYWRIGHT_WEB_SERVER_PORT=4173 \
npx playwright test src/tests/e2e/ground-glass-webgpu-aperture-gather-app.spec.ts \
  --project=chrome-native-webgpu --workers=1 \
  --grep 'M7E native r187 requalifies|M7E r187 isolates optional M5 failures|native M5 rejects stale captures and recovers from a local gather failure'
```

The report includes the native run ID, invocation, source SHA, runtime identity, request/channel/scene/generation identities, capture hashes, and paths to the JSON and compressed GPU/CPU readback pairs. The inventory evaluator recomputes required scenario identities and declared counts instead of inferring success from test names.

## Far/Near/B1 capture matrix

The bounded registered-app matrix contains 12 captures, all `passed`, with no failed, blocked, or not-run capture scenarios:

| State group | Radius | Captures |
|---|---:|---|
| Q5 stress cap | 2 px | Half32, Full32, Full64 |
| Q1 control | 60 px | Half32, Full32, Full64 |
| Q2/Q7 shared state | 60 px | Half32, Full32, Full64 |
| Q3/Q4 shared state | 60 px | Half32, Full32, Full64 |

Every capture used current host-accepted request and renderer-generation identities, the completed M4 input, actual native M5 target formats, independent captured-input CPU references, and an independently recomputed B1 decision. Across the 12 captures:

- Far GPU/CPU RMSE maximum: `0.000227783`; maximum channel error: `0.000779212` (the frozen limit is `0.001`).
- Near GPU/CPU RGB RMSE maximum: `0.000060125`; maximum channel error: `0.000482560` (limit `0.001`).
- Near GPU/CPU alpha RMSE and maximum error: `0`.
- B1 GPU/CPU RGB RMSE maximum: `0.000199296`; maximum channel error: `0.000482560`.
- B1 eligibility, fallback reason, selected path, center provenance, and source fallback matched the CPU reference in every capture.
- B1 did not alter the Near output; maximum observed Near RGB/alpha change was `0`.

The observed allocated/readback formats were source color `rgba8unorm`, M4 physical CoC/ellipse `rgba16float`, validity `rgba8unorm`, scene depth `depth24plus`, Far/Near/B1/composite `rgba16float`, gather provenance `rgba32float`, and B1 decisions `rgba8unorm`.

## B1 storage and boundary probe

The native B1 probe accepted all 10 controlled cases. It exercised positive and negative binary16 limits, the largest value below the limit, M4 overflow/validity code 2, NaN and infinity physical inputs, preserved validity code 2, and NaN/infinity Far channels. The probe recorded actual half-float storage bits and decoded values, RGBA8 decisions, GPU B1 storage, and the independent CPU result. Invalid or non-finite inputs failed closed to source fallback; no case had a GPU/CPU decision mismatch.

The explicit overflow case observed `65536` CoC represented by the finite half-float maximum `65504` while retaining M4 validity code `2`. The B1 decision rejected the pixel and selected source fallback, matching the M4 validity contract; the saturated stored value was not treated as valid physical evidence.

## M7E Review-Fix Round 1 — Persisted Evidence Integrity

The review-fix round added a repeatable offline replay command:

```bash
npm run evidence:replay:m7e
```

It verifies all 12 manifest and gzip artifact pairs, checks manifest and compressed-payload SHA-256 values, bounds and typed-array schemas, restores the typed arrays, and reruns the capture evaluator, the standalone and embedded B1 boundary evaluator, and the Q1–Q7 quality evaluator. The replay needs no browser, application server, GPU, or temporary artifact files. The report inventory records the B1 probe only once; the lossless standalone and embedded probe envelopes carry the source SHA and numeric-recovery provenance.

The native captures remain from source SHA `9382217c7820be87a596124fd78c28239d416653`. The committed artifact bundle had been written in `478e19f4b473540a575a18e4498e289644f305fe`; review fix v2 records each pre-repack payload SHA and preserves the capture source SHA. The twelve binary payloads were realigned to typed-array element boundaries by copying their original bytes without numeric conversion. The old JSON writer had converted non-finite B1 values to `null`; the v2 migration recovers those values only from the controlled case IDs and recorded binary16 bits, marks that provenance explicitly, and rejects unexplained nulls or disagreement with the bits. No GPU captures were relabeled or regenerated.

The regressions reproduce all three findings: feeding the legacy null B1 values to the boundary evaluator yields `physical-half-storage`, `boundary-cpu-classification`, and `gather-half-decode`; passing the persisted twelve-row report shape with `readbackBuffers: null` yields twelve `invalid-passed-capture` results containing `missing-readback`; and coordinated edits to stored GPU/CPU outputs, or changes to source color, signed CoC, ellipse axes, depth, film, projection, observed gather IDs/UVs, sample count, or radius cap, are rejected by the independent CPU replay. The full persisted probe now decodes and passes all ten controlled B1 cases, and its standalone and embedded copies compare equal while preserving `NaN`, both infinities, and negative zero.

Replay result: **12 passed, 0 failed, 0 blocked, 0 not-run**, with report counts matching the inventory and no evaluator issues. Recomputed Far and Near CPU reference arrays matched the persisted CPU arrays bit-for-bit in all 12 cases (`maximum absolute difference = 0`). Against those recomputed Far CPU references, the maximum native Far channel error was `0.000779212`; the maximum native Near RGB and alpha channel errors were `0.000482560`. B1 GPU/CPU maximum channel error was `0.000482560`, with maximum B1 RGB RMSE `0.000199295`. The old B1 `0.05` comparison was a photographic-quality style threshold and was not a numerical correctness contract. Evaluator v2 applies `0.001` RMSE and maximum channel error to B1, based on the existing native B1 boundary contract's `0.001` CPU/GPU error limit; actual stored B1 output remains checked against its binary16 bits. The quality replay reproduced the stored Q decisions and remains **partially-qualified**: Q3 bounded-qualified, Q1/Q5/Q6/Q7 reference-not-converged, and Q2/Q4 insufficient-support. The frozen M5Q thresholds and `0.05` quality gate were not changed; Far/Near/B1 native GPU/CPU comparisons use `0.001` limits.

The review-fix evaluator revision is `m7e-r187-gather-b1-evaluator-v2`. The replay record is [M7E_OFFLINE_REPLAY_REPORT.json](ground-glass-m7e-r187-gather-b1/M7E_OFFLINE_REPLAY_REPORT.json). The deterministic artifact repack can be reproduced from its recorded source commits with `npm run evidence:migrate:m7e` before running the offline replay.

## Failure isolation and lifecycle

The M5-specific native failure test passed eight injected points: target initialization, provenance submission, Far submission, Near submission, B1 submission, decision submission, composite submission, and readback. For every point, the M3 Raw frame remained completed and contentful, no application backend fallback occurred, and the failed M5 capture was not published. A later capture recovered.

The held-readback test passed focus/request retirement, resize retirement, and unmount cleanup checks. The old resize readback and the held unmount readback were not published. Adapter-owned M5 cleanup was confirmed; M7C remains the single host lifecycle authority. This M5 test does not replace or expand M7C's host failure/device-loss matrix.

The production-preview isolation suite passed both tests with hostile Raw, M4, M5, M6, and test-seam Vite flags set: Architecture Rise stayed on WebGL for default and explicit WebGPU requests, and the Anatomy WebGPU candidate remained denied. Production Ground Glass remains WebGL-only.

Invocation:

```bash
PATH="/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH" \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true \
VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=true \
VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH=true \
VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION=true \
VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true \
npm run test:e2e -- --config=playwright.production.config.ts \
  --project=chromium-production-preview --workers=1 \
  src/tests/e2e/architecture-rise-webgpu-production.spec.ts
```

## Validation run

- Focused evaluator/policy/M4 contract unit tests: 77 passed across 4 files.
- Full unit/integration suite: 3,282 passed across 306 files.
- Native r187 M5 qualification E2E: 3 passed, including the 12-capture matrix, eight failure injections, and held-readback resize/unmount checks.
- Native r187 M3 Raw/M4 application regressions: 2 passed.
- Hostile-flag production-preview isolation: 2 passed.
- Typecheck, lint, CSS structure check, and production build: passed.
- Broad development E2E was not run; the focused native M3/M4/M5 suites and production-preview suite cover the changed rendering path.

## Revision authorization boundary

- r187 M3 Raw RTT: retains its independent existing development eligibility.
- r187 M4 Physical CoC: retains its separate research-only M7D record.
- r187 M5 Gather and B1: new revision-specific records, both `research-only`, and executable only inside the existing trusted M3 development Raw pilot.
- r187 M5Q: `partially-qualified`; Q3 alone reached `bounded-qualified`.
- r187 M6 presentation: denied; M6D remains tied to historical r186 evidence.
- Production Ground Glass: WebGL-only; hostile build flags and query parameters do not create a production WebGPU attempt.
- Unknown renderer revisions and unsupported scenes: fail closed.

M7 remains incomplete. M5Q dimensions that did not pass require further bounded quality investigation; M6 requires its own r187 requalification. Cross-browser/device behavior, spontaneous loss, photographic quality, M8 scene/material parity, M9 promotion, and production WebGPU are not qualified or authorized by M7E.

## Evidence files

- [Machine-readable report](ground-glass-m7e-r187-gather-b1/GROUND_GLASS_M7E_R187_GATHER_B1_REPORT.json)
- Native B1 storage probe: `ground-glass-m7e-r187-gather-b1/b1-boundary-probe.json`
- M5 failure isolation: `ground-glass-m7e-r187-gather-b1/m5-failure-isolation.json`
- M5 stale-readback/cleanup capture: `ground-glass-m7e-r187-gather-b1/m5-lifecycle-capture.json`
- Twelve paired JSON metadata and compressed GPU/CPU readback artifacts: `ground-glass-m7e-r187-gather-b1/captures/`
- Offline replay report: `ground-glass-m7e-r187-gather-b1/M7E_OFFLINE_REPLAY_REPORT.json`
