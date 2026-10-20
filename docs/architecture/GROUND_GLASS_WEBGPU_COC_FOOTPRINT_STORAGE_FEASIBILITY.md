# Ground Glass WebGPU CoC / Footprint Storage Feasibility

## A. Executive conclusion

**Half-float physical storage: FEASIBLE for inputs inside its finite binary16 range** on the measured native r186 write, storage, sample, decode, classification, and readback path. The native `rgba16float` target retained signed CoC and ellipse radii in millimetres with maximum measured absolute errors below `0.00041 mm`; orientation's largest measured periodic error was `0.002821 rad` (`0.162°`). The maximum finite binary16 magnitude is `65504`. On the tested native Chrome adapter, finite float32 inputs above that range were stored as signed `65504`, so downstream code must mark them unsupported rather than treat the saturated value as the original physical measurement.

**Encoded-byte storage: PARTIALLY FEASIBLE as an explicitly lossy candidate.** Native `rgba8unorm` storage preserved the established neutral code and encoded-byte rules, sampled and decoded correctly, and retained useful values away from zero and range limits. Under this test's configured storage range, `-0.1 mm`, `0 mm`, and `+0.1 mm` all decoded as neutral `0 mm`; the positive/negative sign transition was not retained until `±0.15 mm`. The tested range also saturated `±50 mm` CoC to approximately `±35.844 mm`; pair scaling limits axes to the configured representable radius while approximately retaining their ratio. These losses are now measured, not hidden.

The supported next-step choice is half-float as the primary Phase E representation, with an explicit finite-range check before values are accepted as physical data. Do not treat encoded byte as an equivalent physical-data fallback unless downstream consumers tolerate its measured neutral dead-zone, quantization, and range limits. This is a storage-format decision, not production Ground Glass readiness. No production renderer, optics calculation, or route was changed.

## B. Existing physical authority

The canonical physical outputs remain `computePhysicalBlurFootprint()`'s signed CoC diameter and oriented ellipse radii in millimetres. Negative CoC means near-side, zero means neutral/in focus, and positive means far-side. Footprints require `majorRadiusMm >= minorRadiusMm >= 0`; invalid axis ordering fails closed. Orientation is an unoriented axis line with period `π`, normalized for storage. Millimetres remain independent of render resolution; only a later renderer consumer maps physical radii through sampled film dimensions into pixels.

The WebGL storage reference is [groundGlassCocTarget.ts](../../src/render/groundGlassCocTarget.ts). Its semantic channel order is R signed CoC, G major radius, B minor radius, A normalized orientation. The encoded-byte CoC contract reserves code `128` for exact zero, uses `0..127` for negative and `129..255` for positive. Its positive and negative sides use separate code-grid denominators. Byte footprint axes are uniformly pair-scaled before quantization when they exceed their configured maximum; this preserves approximate anisotropy but loses the original unconstrained size. None of these meanings is replaced in this experiment.

The existing learner sharpness reference is [`ACCEPTABLE_COC_DIAMETER_MM = 0.1`](../../src/core/optics/physicalSharpness.ts). This experiment probes how storage retains signed CoC around that physical value. It does not execute the learner-facing sharpness or task-evaluation pipeline.

For the fixed test configuration (60 px maximum gather radius, 425 px render width, 127 mm film width), the existing helper resolves a signed CoC diameter range of `35.858824 mm` and a footprint radius range of `17.929412 mm`. This is a renderer storage range, not optical calibration.

## C. Native renderer and format evidence

The final native-required run used the repository's headed Chrome Playwright project on macOS with Three.js r186. The mounted renderer reported `rendererFamily = webgpu-renderer`, `executionBackend = webgpu`, `applicationFallback = false`, and initialized successfully. A WebGPU adapter was available. Hardware acceleration was not independently established.

| Candidate | Requested Three.js target | Observed native GPU format | GPU readback | Render / separate sample / decode |
|---|---|---|---|---|
| Half-float physical | `RGBAFormat` + `HalfFloatType` | `rgba16float` | `Uint16Array` half-float bit patterns | Passed |
| Encoded byte | `RGBAFormat` + `UnsignedByteType` | `rgba8unorm` | `Uint8Array` integer code values | Passed |

Both targets initialized, accepted a GPU writer pass, were sampled by a separate GPU consumer, and were read back. The 23-sample physical matrix allocated `23×1` targets; resizing retained each requested native format at `24×1` and completed a 24-sample readback. The observed backend texture usage value was `23` for both targets. Format and usage were read from Three r186's runtime backend texture metadata; that observation does not guarantee driver-level physical memory behavior or support on every adapter.

Ordinary Chromium was also run separately. It reported Three's `WebGPURenderer` WebGL2 fallback and is compatibility/control evidence only, not native feasibility evidence.

## D. GPU write/read architecture

```text
Fixed physical samples
  ├─ 3 cases derived once with computePhysicalBlurFootprint()
  └─ synthetic storage-boundary vectors
              |
              v
TSL writer reads physical-value uniform arrays and encodes on GPU
              |
              v
Native THREE.RenderTarget (rgba16float or rgba8unorm)
              |
              ├─ actual target storage readback for stored codes/values
              v
Separate TSL consumer samples the storage texture
  ├─ decodes R/G/B/A to mm / normalized orientation
  ├─ classifies signed CoC as negative / neutral / positive
  └─ nearest-filter probe samples adjacent -8 mm / +8 mm values
              |
              v
GPU diagnostic targets → native async readback
              |
              v
CPU comparison against fixed physical inputs and existing codec reference
```

The CPU supplies the controlled physical inputs and independently computes expected values from the existing CPU codec helpers for the encoded-byte candidate. It does not upload a pre-encoded image. TSL performs candidate encoding, storage sampling, candidate decoding, classification, and filter probing on the GPU. GPU readback is compared with both the physical inputs and the existing codec contract. Three canonical cases are produced by `computePhysicalBlurFootprint()`; the remaining cases are explicitly synthetic storage-boundary vectors, not claimed optical scenes. A separate, lazily run half-float range operation writes fixed float32 inputs to dedicated `rgba16float` storage and decode targets so overflow observations do not affect the ordinary accuracy aggregates.

## E. Numerical results

The following native results were measured in the headed Chrome run. Orientation errors use periodic distance modulo `π`.

| Case | Physical input `(CoC, major, minor, θ)` | Half-float stored / GPU-decoded | Encoded-byte stored codes / GPU-decoded |
|---|---|---|---|
| Exact neutral | `(0, 0, 0, 0)` | `(0, 0, 0, 0)` | `(128, 0, 0, 0)` → `(0, 0, 0, 0)` |
| Canonical tilted anisotropic | `(-1.677968, 0.885788, 0.794653, 1.505710)` | `(-1.677734, 0.885742, 0.794434, 1.504883)` | `(122,13,11,122)` → `(-1.680664, 0.913574, 0.772949, 1.502930)` |
| Near-threshold negative / positive | `±0.169 mm` CoC; `0.0845 mm` equal axes | `-0.168945` / `+0.168945 mm`; sign preserved | codes `127` / `129` → `-0.280029` / `+0.282227 mm` |
| Sub-byte-sign negative / positive | `±0.01 mm` CoC; `0.005/0.0025 mm` axes | `-0.009995` / `+0.009995 mm`; sign preserved | both code `128` → `0 mm`; axes quantize to zero |
| Existing physical sharpness reference | `-0.1 / +0.1 mm`; axes `0.05/0.025 mm` | `-0.099976 / +0.099976 mm`; classifications `-1 / +1`; absolute CoC error `0.000024 mm` each | both code `128` → `0 mm`; classifications `0 / 0`; absolute CoC error `0.1 mm` each |
| Byte neutral transition | `±0.14 mm` | `-0.139893 / +0.139893 mm`; signs preserved; absolute CoC error `0.000107 mm` each | both code `128` → `0 mm`; classifications neutral; absolute CoC error `0.14 mm` each |
| Byte signed transition | `-0.15 / +0.15 mm` | `-0.149902 / +0.149902 mm`; signs preserved; absolute CoC error `0.000098 mm` each | codes `127 / 129` → `-0.280029 / +0.282227 mm`; signs preserved; absolute CoC error `0.130029 / 0.132227 mm` |
| Over-range negative / positive CoC | `±50 mm` | `±50 mm` stored directly | codes `0` / `255` → `-35.843750` / `+35.843750 mm` |
| Over-range ellipse | `(1.25, 40, 10, -π/4)` | `(1.25, 40, 10, 2.355469)` | `(132,255,64,191)` → `(1.128906,17.921875,4.496094,2.351563)` |

The `0.1 mm` value is the existing physical learner-sharpness reference, not a new storage threshold. At that input, half-float retained a nonzero signed sample after binary16 rounding. The current byte range stored both signs as neutral. The `±0.14 mm` and `±0.15 mm` samples bracket the measured byte transition without relying on a tie value.

The separate synthetic binary16 boundary probe used an actual native `rgba16float` target and a second GPU sampler/decode pass. Stored values and GPU-decoded values matched. Values in this table are physical channels `(signed CoC, major radius, minor radius)` in millimetres; orientation was also stored and sampled in every row.

| Fixed float32 input `(CoC, major, minor)` | Native `rgba16float` stored / GPU-decoded `(CoC, major, minor)` | Absolute error `(CoC, major, minor)` | GPU CoC classification |
|---|---|---|---|
| `(0, 0, 0)` | `(0, 0, 0)` | `(0, 0, 0)` | neutral |
| `(0.01, 0.01, 0.005)` | `(0.0099945, 0.0099945, 0.0049973)` | `(0.0000055, 0.0000055, 0.0000027)` | positive |
| `(1, 1, 0.5)` | `(1, 1, 0.5)` | `(0, 0, 0)` | positive |
| `(1000, 1000, 500)` | `(1000, 1000, 500)` | `(0, 0, 0)` | positive |
| `(65504, 65504, 32752)` | `(65504, 65504, 32752)`; stored CoC bits `0x7bff` | `(0, 0, 0)` | positive |
| `(-65504, 65504, 32752)` | `(-65504, 65504, 32752)`; stored CoC bits `0xfbff` | `(0, 0, 0)` | negative |
| `(±65505, 65505, 32752)` | `(±65504, 65504, 32752)` | `(1, 1, 0)` | sign retained; magnitude saturated |
| `(±65520, 65520, 32760)` | `(±65504, 65504, 32752)` | `(16, 16, 8)` | sign retained; magnitude saturated |
| `(±100000, 100000, 50000)` | `(±65504, 65504, 49984)` | `(34496, 34496, 16)` | sign retained; magnitude saturated |
| `(1, 100000, 65520)` | `(1, 65504, 65504)` | `(0, 34496, 16)` | positive |

The fixed probe contained 13 cases: 7 had at least one channel outside finite binary16 range; 14 physical channels were unrepresentable, and all 14 read back as the signed/positive finite maximum `65504` rather than infinity. Each per-sample diagnostic records physical inputs, stored half bits and values, GPU-decoded values, per-channel absolute error, classification, and an explicit supported/unsupported physical interpretation. Their records remained marked `unsupported-binary16-range`. These are synthetic storage vectors, not realistic optical scene outputs. The observed max-finite saturation is evidence for the tested native adapter only; Phase D treats every out-of-range input as unsupported even when the stored result is finite.

Aggregate observed errors across the 23-sample physical matrix:

| Measure | Half-float | Encoded byte |
|---|---:|---:|
| Maximum signed CoC absolute error, mm (all samples) | `0.000402` | `14.156250` |
| Maximum signed CoC error, mm (within representable byte range) | `0.000402` | `0.140000` |
| Maximum major-axis error, mm (in-range inputs) | `0.000201` | `0.032227` |
| Maximum minor-axis error, mm (in-range inputs) | `0.000220` | `0.035000` |
| Maximum orientation periodic error | `0.002821 rad` (`0.162°`) | `0.006509 rad` (`0.373°`) |
| Nonzero CoC signs preserved | `21/21` | `15/21` |
| CoC values saturated | `0` | `2` |
| Over-range footprint axes hitting maximum code | `0` | `3` |

The half-float values follow actual binary16 readback and GPU decoding; zero remains exact, and the canonical tilted sample's CoC error is about `0.000234 mm`. The byte aggregate in-range bounds are checked against the asymmetric signed-code step, axis code step, and half-float diagnostic decode precision. For byte inputs outside the configured range, the all-sample error intentionally reports lost physical information rather than treating saturation as precision success. The near-degenerate minor-axis case makes a ratio error poorly conditioned; the measured anisotropy-ratio maximum is therefore reported separately (`0.538` half-float, `1.000` byte) and is not used as the acceptance criterion when the minor axis approaches zero.

## F. Precision findings

The former fixture constant `HALF_FLOAT_MAX = 3.402823e38` described the float32 finiteness guard, not binary16 storage capacity. It is now named `MAX_FINITE_FLOAT32`; binary16 input representability is checked separately against `65504`. Half-float stores signed CoC diameter in mm, major radius in mm, minor radius in mm, and normalized orientation as binary16 values. Inside the finite range, the expanded physical matrix had maximum signed CoC error `0.000402 mm`, major/minor radius errors `0.000201/0.000220 mm`, and periodic orientation error `0.002821 rad`. It preserved both `±0.01 mm` and `±0.1 mm` signs and all 21 nonzero classifications. The additional native boundary probe established that finite float32 values above `65504` are stored as signed `65504` on the tested adapter. This is representational saturation, not a supported physical clamp: an out-of-range finite physical input is not necessarily invalid optical geometry, but its encoding remains unsupported even when its GPU result is finite. These controlled tests do not implement scene-depth reconstruction or a production CoC pass.

For encoded byte, one signed-CoC code step under this specific storage configuration is approximately `35.858824/128 = 0.280147 mm` on the negative side and `35.858824/127 = 0.282353 mm` on the positive side. The nearest code to zero is neutral, so nonzero magnitudes below roughly half a code step (`0.1401 mm` negative, `0.1412 mm` positive) become zero under this configuration. The GPU measured `±0.01 mm`, `±0.1 mm`, and `±0.14 mm` as code `128` and decoded zero. The `-0.15/+0.15 mm` values reached codes `127/129` and decoded to `-0.280029/+0.282227 mm`. Exact zero remains code 128 and decodes to exact zero. The dead-zone changes with `resolveGroundGlassCocStorageMaxMm()` inputs; these thresholds are not universal properties of every RGBA8 setup.

Each encoded footprint axis has a normalized code step of `17.929412/255 = 0.070311 mm`. The `0.005/0.0025 mm` sample therefore quantized both radii to zero. The `40/10 mm` pair was uniformly scaled before byte encoding; its decoded ratio was about `3.985` versus the input ratio `4`. Byte orientation has a nominal code step of `π/255` radians; observed maximum periodic error, including GPU diagnostic decoding, was `0.006509 rad`. The near-π sample and negative-angle sample passed modulo-π comparisons.

These results separate three numerical limits: finite range, quantization inside range, and saturation outside range. Binary16 directly represents signed values only through magnitude `65504`; the tested adapter saturated finite over-range inputs at its maximum finite value. Encoded byte has a much smaller range here (`±35.858824 mm`) and coarser near-zero quantization; its observed neutral interval contains the existing `0.1 mm` physical sharpness reference. Neither storage form's renderer-level CoC sign classification is the learner's separate physical sharpness/task evaluation. The byte loss demonstrates physical information unavailable to downstream consumers, not a measured production task-evaluation failure.

## G. Texture-sampling findings

Both numerical targets use `NoColorSpace`, `NearestFilter` for minification and magnification, and no mipmaps. The renderer uses `NoColorSpace` output and `NoToneMapping`; the numerical node materials disable tone mapping and write their explicit `fragmentNode` output. Runtime evidence reported the `NoColorSpace` value as the empty Three.js string and tone-mapping value `0` (`NoToneMapping`).

The GPU filter probe stores adjacent `-8 mm` and `+8 mm` signed values, then samples their midpoint with the storage target's actual nearest sampler. The sample resolves to the positive `+8 mm` neighbor and classifies positive rather than interpolating to neutral. The test checks that the sample matches one source value and is non-neutral. The known `(8 mm, 2.5 mm, 1 mm, π/3)` vector also verifies that R/G/B/A remain signed CoC, major axis, minor axis, and normalized orientation. This one-row numeric fixture tests texture addresses and channel meaning; it does not redefine film UV or WebGPU's spatial render-target Y-origin contract from [GROUND_GLASS_COORDINATE_CONTRACT.md](GROUND_GLASS_COORDINATE_CONTRACT.md).

## H. Resource and browser results

The native-required storage suite passed all five Phase D tests:

- `GPU CoC/footprint writers and TSL consumers match the CPU codec contract`
- `native binary16 range probe records finite and saturated storage separately`
- `successful readback retirement and handle-owned resource cleanup survive SPA remount`
- `a rejected accepted readback remains a failure while SPA cleanup succeeds`
- `post-writer failure is explicit and does not prevent resource cleanup`

Together they check the actual `webgpu-renderer` / `webgpu` / no-fallback runtime, formats, GPU round trips, numerical semantics, binary16 range, target resize, held readback retirement, injected readback rejection, failure cleanup, SPA navigation, and remount. Ordinary Chromium separately passed four tests and skipped the native-only binary16 range probe; its WebGL2 fallback is not native evidence.

The final native lifecycle attachment recorded `webgpu-coc-storage-g1-i1` (generation 1) on `/experiment → /away`. Its held operation `webgpu-coc-storage-g1-i1-op3` completed its accepted readback successfully, then ended `retired / stale-readback-discarded`, with `error: null` and no published result. Its renderer, both storage targets, all six diagnostic targets, writer/consumer geometry, materials, and other owned fixture resources each recorded one successful disposal completion. The same document remounted `webgpu-coc-storage-g2-i2` (generation 2), whose completed half-float and byte roundtrips were followed by a separate successful cleanup.

In the negative control, generation 1's `webgpu-coc-storage-g1-i1-op3` was rejected at the test-only Promise boundary after the real native readback settled and the handle began retirement. It remained `failed / readback-failed` with the injected error text. The exact handle's cleanup still completed with no cleanup error and every owned resource recorded one disposal completion; generation 2 mounted as a distinct native WebGPU handle. This is a deterministic Promise-level rejection test, not device loss or a hardware readback failure.

The post-writer failure test also remained observable and disposed the fixture's owned resources. Resize changed each target from `23×1` to `24×1`, recorded one target-storage disposal event during reallocation, retained `rgba16float` or `rgba8unorm`, and successfully read back 24 samples. These disposal records establish the Three.js ownership/dispose call contract, not immediate GPU-driver reclamation or absence of every possible driver memory leak.

The dedicated binary16 range test allocates separate storage/decode/classification targets on the exact native handle, captures the range evidence, then navigates through the fixture's SPA route and verifies every handle-owned resource is disposed. The probe does not alter the normal physical-matrix metrics or the Phase C production routes.

## I. Compatibility blockers and limits

- This study stores controlled physical values; it does not reconstruct world position from scene depth or run the production physical-footprint GLSL kernel on GPU.
- It does not evaluate production CoC classification from scene depth, far/near gathering, aperture sampling, DOF composition, Image Circle coverage, natural illumination, or visual parity.
- The fixture's canonical physical cases use `computePhysicalBlurFootprint()` for near, far, and tilted-anisotropic samples. Synthetic storage vectors exercise exact storage boundaries and must not be read as separate optical scenes.
- Half-float has a finite numerical range. On the tested native Chrome adapter, out-of-range finite float32 inputs saturated to signed/positive `65504`; behavior on other adapters is untested. Phase D records these inputs as unsupported physical values even when storage returns a finite maximum.
- Encoded-byte storage loses signed CoC at the current `0.1 mm` physical reference and at `±0.14 mm`, loses sufficiently small axes, and cannot recover values after byte clipping/pair scaling. The observed dead-zone is specific to the current `resolveGroundGlassCocStorageMaxMm()` configuration.
- The tests demonstrate loss of physical information needed by downstream consumers; they do not execute the production learner sharpness mapping, task evaluator, or production DOF shader.
- Native format metadata was inspected through Three r186's backend object and the tested headed Chrome adapter. Other browsers/adapters and hardware acceleration were not established.
- Native SPA cleanup is proven inside this isolated fixture, not the public simulator router. The injected failure is not a device-loss test. Partial initialization cleanup on a native WebGPU device was not established by this phase.
- The test validates one-row texture coordinates and selected numerical samples, not general spatial origin parity or all target sizes.

## J. Migration decision

Proceed to **Phase E — Native WebGPU Physical CoC Classification Feasibility**, using half-float millimetre storage as the preferred candidate and requiring an explicit range check before a value is accepted as physical data. Do not adopt encoded byte as an equivalent Phase E fallback based only on legacy WebGL support. Evaluate the relevant physical CoC range, near-zero sign/classification sensitivity, range selection, allowed saturation, and downstream physical consumers first. Before any production migration, Phase E must prove scene-depth reconstruction, canonical physical-footprint evaluation, correct near/far classification, and behavior at film/image-circle boundaries. No Phase E implementation is part of this PR.

## K. Reproduction

Use the repository's bundled Node 24 runtime for this host. These commands run the isolated Phase D fixture in default Chromium and native-required headed Chrome:

```bash
PATH=/Users/homan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts --workers=1
PATH=/Users/homan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts --workers=1
PATH=/Users/homan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run test:e2e -- --config=playwright.production.config.ts --workers=1
```

Phase C regressions are reproducible with:

```bash
PATH=/Users/homan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts --workers=1
PATH=/Users/homan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts --grep 'native-required' --workers=1
```

The final native diagnostic report and its lifecycle attachments were written outside the repository to `/private/tmp/vcs-phase-d-native-final.json` and `/private/tmp/vcs-phase-d-native-final/`. Playwright artifacts are generated per run; no large capture artifact is committed.

## Validation

- Final native-required Phase D browser suite: **5 passed**, headed Chrome, actual runtime `webgpu-renderer` / `webgpu`, `applicationFallback: false`. This includes the 23-sample matrix, dedicated 13-vector binary16 range probe, native SPA cleanup, and failure/remount controls.
- Final Phase D default Chromium suite: **4 passed, 1 native-only test skipped**. Three reported its `webgl2-fallback`; this is compatibility/control evidence only, not native range evidence.
- Phase C Raw RTT, ordinary Chromium: **4 passed, 4 native-only skipped**. The WebGL control and fixture lifecycle cases passed.
- Phase C Raw RTT, native-required headed Chrome: **4 passed**, including actual native target sampling/display, SPA cleanup/remount, and readback rejection cleanup.
- Production-preview isolation, newly rerun: **1 passed, 1 failed**. Anatomy material-aware WebGPU denial passed. Architecture Rise timed out at `src/tests/e2e/architecture-rise-webgpu-production.spec.ts:133` while decoding the screenshot returned by `analyzeScreenshot()`; its error was `page.evaluate: Target page, context or browser has been closed` after the 120 s test timeout. This matches the earlier reported clean-main baseline failure signature; clean main was not rerun in this round. No production file was changed.
- `npm test`: **268 files / 2,488 tests passed**.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`: passed.
- Mutation sensitivity: temporarily shifting the TSL positive-code base from `128` to `129` made the native conformance test fail (`adjacent-positive` expected byte code `156`, received `157`). The mutation was removed and the clean native suite passed afterward.
- `git diff --check`: passed on the review-fix diff.
- Full `npm run ci:local:e2e` was not run; focused Phase D, Phase C, and production-preview checks above were run directly.

See [GROUND_GLASS_WEBGPU_RAW_RTT_FEASIBILITY.md](GROUND_GLASS_WEBGPU_RAW_RTT_FEASIBILITY.md), [GROUND_GLASS_COORDINATE_CONTRACT.md](GROUND_GLASS_COORDINATE_CONTRACT.md), and [DOF_FOCUS_PHYSICS_CONVERGENCE.md](../DOF_FOCUS_PHYSICS_CONVERGENCE.md) for the retained Phase C, coordinate, and physical-DOF authority.
