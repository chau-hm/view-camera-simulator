# Ground Glass WebGPU CoC / Footprint Storage Feasibility

## A. Executive conclusion

**Half-float physical storage: FEASIBLE** for the measured native r186 write, storage, sample, decode, classification, and readback path. The native `rgba16float` target retained signed CoC and ellipse radii in millimetres with maximum measured absolute errors below `0.00041 mm`; orientation's largest measured periodic error was `0.002821 rad` (`0.162°`).

**Encoded-byte storage: PARTIALLY FEASIBLE** as a constrained fallback. Native `rgba8unorm` storage preserved the established neutral code and encoded-byte rules, sampled and decoded correctly, and retained useful values away from zero and range limits. It does not preserve arbitrarily small nonzero CoC signs: both `-0.01 mm` and `+0.01 mm` encoded to neutral code `128`. The tested range also saturated `±50 mm` CoC to approximately `±35.844 mm`; pair scaling limits axes to the configured representable radius while approximately retaining their ratio. These losses are now measured, not hidden.

The supported next-step choice is half-float as the primary Phase E representation. Keep encoded-byte as a documented compatibility/fallback candidate only where its quantization and range limits are acceptable. This is a storage-format decision, not production Ground Glass readiness. No production renderer, optics calculation, or route was changed.

## B. Existing physical authority

The canonical physical outputs remain `computePhysicalBlurFootprint()`'s signed CoC diameter and oriented ellipse radii in millimetres. Negative CoC means near-side, zero means neutral/in focus, and positive means far-side. Footprints require `majorRadiusMm >= minorRadiusMm >= 0`; invalid axis ordering fails closed. Orientation is an unoriented axis line with period `π`, normalized for storage. Millimetres remain independent of render resolution; only a later renderer consumer maps physical radii through sampled film dimensions into pixels.

The WebGL storage reference is [groundGlassCocTarget.ts](../../src/render/groundGlassCocTarget.ts). Its semantic channel order is R signed CoC, G major radius, B minor radius, A normalized orientation. The encoded-byte CoC contract reserves code `128` for exact zero, uses `0..127` for negative and `129..255` for positive. Its positive and negative sides use separate code-grid denominators. Byte footprint axes are uniformly pair-scaled before quantization when they exceed their configured maximum; this preserves approximate anisotropy but loses the original unconstrained size. None of these meanings is replaced in this experiment.

For the fixed test configuration (60 px maximum gather radius, 425 px render width, 127 mm film width), the existing helper resolves a signed CoC diameter range of `35.858824 mm` and a footprint radius range of `17.929412 mm`. This is a renderer storage range, not optical calibration.

## C. Native renderer and format evidence

The final native-required run used the repository's headed Chrome Playwright project on macOS with Three.js r186. The mounted renderer reported `rendererFamily = webgpu-renderer`, `executionBackend = webgpu`, `applicationFallback = false`, and initialized successfully. A WebGPU adapter was available. Hardware acceleration was not independently established.

| Candidate | Requested Three.js target | Observed native GPU format | GPU readback | Render / separate sample / decode |
|---|---|---|---|---|
| Half-float physical | `RGBAFormat` + `HalfFloatType` | `rgba16float` | `Uint16Array` half-float bit patterns | Passed |
| Encoded byte | `RGBAFormat` + `UnsignedByteType` | `rgba8unorm` | `Uint8Array` integer code values | Passed |

Both targets initialized, accepted a GPU writer pass, were sampled by a separate GPU consumer, were read back, and retained their requested native format after resizing from `17×1` to `18×1`. The observed backend texture usage value was `23` for both targets. Format and usage were read from Three r186's runtime backend texture metadata; that observation does not guarantee driver-level physical memory behavior or support on every adapter.

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

The CPU supplies the controlled physical inputs and independently computes expected values from the existing CPU codec helpers for the encoded-byte candidate. It does not upload a pre-encoded image. TSL performs candidate encoding, storage sampling, candidate decoding, classification, and filter probing on the GPU. GPU readback is compared with both the physical inputs and the existing codec contract. Three canonical cases are produced by `computePhysicalBlurFootprint()`; the remaining cases are explicitly synthetic storage-boundary vectors, not claimed optical scenes.

## E. Numerical results

The following native results are from the attached `storage-roundtrip-diagnostics.json` in the final headed run. Orientation errors use periodic distance modulo `π`.

| Case | Physical input `(CoC, major, minor, θ)` | Half-float stored / GPU-decoded | Encoded-byte stored codes / GPU-decoded |
|---|---|---|---|
| Exact neutral | `(0, 0, 0, 0)` | `(0, 0, 0, 0)` | `(128, 0, 0, 0)` → `(0, 0, 0, 0)` |
| Canonical tilted anisotropic | `(-1.677968, 0.885788, 0.794653, 1.505710)` | `(-1.677734, 0.885742, 0.794434, 1.504883)` | `(122,13,11,122)` → `(-1.680664, 0.913574, 0.772949, 1.502930)` |
| Near-threshold negative / positive | `±0.169 mm` CoC; `0.0845 mm` equal axes | `-0.168945` / `+0.168945 mm`; sign preserved | codes `127` / `129` → `-0.280029` / `+0.282227 mm` |
| Sub-byte-sign negative / positive | `±0.01 mm` CoC; `0.005/0.0025 mm` axes | `-0.009995` / `+0.009995 mm`; sign preserved | both code `128` → `0 mm`; axes quantize to zero |
| Over-range negative / positive CoC | `±50 mm` | `±50 mm` stored directly | codes `0` / `255` → `-35.843750` / `+35.843750 mm` |
| Over-range ellipse | `(1.25, 40, 10, -π/4)` | `(1.25, 40, 10, 2.355469)` | `(132,255,64,191)` → `(1.128906,17.921875,4.496094,2.351563)` |

Aggregate observed errors across the 17-sample matrix:

| Measure | Half-float | Encoded byte |
|---|---:|---:|
| Maximum signed CoC absolute error, mm (all samples) | `0.000402` | `14.156250` |
| Maximum signed CoC error, mm (within representable byte range) | `0.000402` | `0.121094` |
| Maximum major-axis error, mm (in-range inputs) | `0.000201` | `0.032227` |
| Maximum minor-axis error, mm (in-range inputs) | `0.000220` | `0.031006` |
| Maximum orientation periodic error | `0.002821 rad` (`0.162°`) | `0.006509 rad` (`0.373°`) |
| Nonzero CoC signs preserved | `15/15` | `13/15` |
| CoC values saturated | `0` | `2` |
| Over-range footprint axes hitting maximum code | `0` | `3` |

The half-float values follow the actual binary16 readback and GPU decoding; zero remains exact, and the canonical tilted sample's CoC error is about `0.000234 mm`. The byte aggregate in-range bounds are checked against the appropriate asymmetric signed-code step, axis code step, and half-float diagnostic decode precision. For byte inputs outside the configured range, the all-sample error intentionally reports lost physical information rather than treating saturation as a precision success. The near-degenerate minor-axis case makes a ratio error poorly conditioned; the measured anisotropy-ratio maximum is therefore reported separately (`0.538` half-float, `0.249` byte) and is not used as the acceptance criterion when the minor axis approaches zero.

## F. Precision findings

Half-float stored the four numerical channels directly: signed CoC diameter in mm, major radius in mm, minor radius in mm, and normalized orientation. Across tested in-range and synthetic cases, maximum signed CoC error was `0.000402 mm`, major/minor radius errors were `0.000201/0.000220 mm`, and periodic orientation error was `0.002821 rad`. It preserved both `±0.01 mm` signs, all 15 nonzero CoC classifications, and the `40/10 mm` ellipse without storage saturation. These values demonstrate this controlled representation path; they do not implement scene-depth reconstruction or a production CoC pass.

For encoded byte, one signed-CoC code step is approximately `35.858824/128 = 0.280147 mm` on the negative side and `35.858824/127 = 0.282353 mm` on the positive side. The nearest code to zero is neutral, so nonzero magnitudes below roughly half a code step (`0.1401 mm` negative, `0.1412 mm` positive) can become zero. The observed `±0.01 mm` samples both became neutral, while `±0.169 mm` landed on codes 127 and 129 and decoded to approximately `-0.2800/+0.2822 mm`. Exact zero remains code 128 and decodes to exact zero.

Each encoded footprint axis has a normalized code step of `17.929412/255 = 0.070311 mm`. The `0.005/0.0025 mm` sample therefore quantized both radii to zero. The `40/10 mm` pair was uniformly scaled before byte encoding; its decoded ratio was about `3.985` versus the input ratio `4`. Byte orientation has a nominal code step of `π/255` radians; observed maximum periodic error, including GPU diagnostic decoding, was `0.006509 rad`. The near-π sample and negative-angle sample passed modulo-π comparisons.

## G. Texture-sampling findings

Both numerical targets use `NoColorSpace`, `NearestFilter` for minification and magnification, and no mipmaps. The renderer uses `NoColorSpace` output and `NoToneMapping`; the numerical node materials disable tone mapping and write their explicit `fragmentNode` output. Runtime evidence reported the `NoColorSpace` value as the empty Three.js string and tone-mapping value `0` (`NoToneMapping`).

The GPU filter probe stores adjacent `-8 mm` and `+8 mm` signed values, then samples their midpoint with the storage target's actual nearest sampler. The sample resolves to the positive `+8 mm` neighbor and classifies positive rather than interpolating to neutral. The test checks that the sample matches one source value and is non-neutral. The known `(8 mm, 2.5 mm, 1 mm, π/3)` vector also verifies that R/G/B/A remain signed CoC, major axis, minor axis, and normalized orientation. This one-row numeric fixture tests texture addresses and channel meaning; it does not redefine film UV or WebGPU's spatial render-target Y-origin contract from [GROUND_GLASS_COORDINATE_CONTRACT.md](GROUND_GLASS_COORDINATE_CONTRACT.md).

## H. Resource and browser results

The native-required storage suite passed all four tests. It checks the actual `webgpu-renderer` / `webgpu` / no-fallback runtime, formats, GPU round trips, numerical semantics, target resize, held readback retirement, injected readback rejection, failure cleanup, SPA navigation, and remount.

The final native lifecycle attachment recorded `webgpu-coc-storage-g1-i1` (generation 1) on `/experiment → /away`. Its held operation `webgpu-coc-storage-g1-i1-op3` completed its accepted readback successfully, then ended `retired / stale-readback-discarded`, with `error: null` and no published result. Its renderer, both storage targets, all six diagnostic targets, writer/consumer geometry, materials, and other owned fixture resources each recorded one successful disposal completion. The same document remounted `webgpu-coc-storage-g2-i2` (generation 2), whose completed half-float and byte roundtrips were followed by a separate successful cleanup.

In the negative control, generation 1's `webgpu-coc-storage-g1-i1-op3` was rejected at the test-only Promise boundary after the real native readback settled and the handle began retirement. It remained `failed / readback-failed` with the injected error text. The exact handle's cleanup still completed with no cleanup error and every owned resource recorded one disposal completion; generation 2 mounted as a distinct native WebGPU handle. This is a deterministic Promise-level rejection test, not device loss or a hardware readback failure.

The post-writer failure test also remained observable and disposed the fixture's owned resources. Resize changed each target from `17×1` to `18×1`, recorded one target-storage disposal event during reallocation, retained `rgba16float` or `rgba8unorm`, and successfully read back 18 samples. These disposal records establish the Three.js ownership/dispose call contract, not immediate GPU-driver reclamation or absence of every possible driver memory leak.

## I. Compatibility blockers and limits

- This study stores controlled physical values; it does not reconstruct world position from scene depth or run the production physical-footprint GLSL kernel on GPU.
- It does not evaluate production CoC classification from scene depth, far/near gathering, aperture sampling, DOF composition, Image Circle coverage, natural illumination, or visual parity.
- The fixture's canonical physical cases use `computePhysicalBlurFootprint()` for near, far, and tilted-anisotropic samples. Synthetic storage vectors exercise exact storage boundaries and must not be read as separate optical scenes.
- Encoded-byte storage loses sufficiently small signed CoC and axes, and cannot recover original values after clipping/pair scaling. Whether this is acceptable depends on later physical acceptance behavior.
- Native format metadata was inspected through Three r186's backend object and the tested headed Chrome adapter. Other browsers/adapters and hardware acceleration were not established.
- Native SPA cleanup is proven inside this isolated fixture, not the public simulator router. The injected failure is not a device-loss test. Partial initialization cleanup on a native WebGPU device was not established by this phase.
- The test validates one-row texture coordinates and selected numerical samples, not general spatial origin parity or all target sizes.

## J. Migration decision

Proceed to **Phase E — Native WebGPU Physical CoC Classification Feasibility**, using half-float millimetre storage as the primary candidate. Keep the current encoded-byte path as a conditional fallback only if Phase E demonstrates that its neutral dead-zone and saturation remain compatible with the chosen classification thresholds. Before any production migration, Phase E must prove scene-depth reconstruction, canonical physical-footprint evaluation, correct near/far classification, and behavior at the film/image-circle boundaries. No Phase E implementation is part of this PR.

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

- Final native-required Phase D browser suite: **4 passed**, headed Chrome, actual runtime `webgpu-renderer` / `webgpu`, `applicationFallback: false`.
- Phase D default Chromium browser suite: **4 passed** in the earlier completed run; the candidate reported Three's `webgl2-fallback` and is not counted as native evidence.
- Phase C Raw RTT, ordinary Chromium: **4 passed, 4 native-only skipped**. The WebGL control and fixture lifecycle cases passed.
- Phase C Raw RTT, native-required headed Chrome: **4 passed**, including actual native target sampling/display, SPA cleanup/remount, and readback rejection cleanup.
- Production-preview isolation suite: **2 passed**. The public Architecture Rise route stayed WebGL for default and explicit WebGPU requests, the Anatomy candidate remained denied, and no WebGPU module request was observed from those production routes.
- `npm test`: **268 files / 2,488 tests passed**.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`: passed.
- `git diff --cached --check`: passed on the complete six-file staged diff.
- Full `npm run ci:local:e2e` was not run; the Phase D and relevant Phase C/production-preview suites above were run directly.

See [GROUND_GLASS_WEBGPU_RAW_RTT_FEASIBILITY.md](GROUND_GLASS_WEBGPU_RAW_RTT_FEASIBILITY.md), [GROUND_GLASS_COORDINATE_CONTRACT.md](GROUND_GLASS_COORDINATE_CONTRACT.md), and [DOF_FOCUS_PHYSICS_CONVERGENCE.md](../DOF_FOCUS_PHYSICS_CONVERGENCE.md) for the retained Phase C, coordinate, and physical-DOF authority.
