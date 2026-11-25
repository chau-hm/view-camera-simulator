# Ground Glass WebGPU Physical CoC Classification Feasibility

**Status:** bounded native WebGPU feasibility result

**Measured:** 2026-10-21

**Three.js:** r186

## A. Executive conclusion

**FEASIBLE — native WebGPU can reconstruct scene world positions from a GPU depth attachment, compute the existing physical CoC and local-affine footprint model in TSL, and store the result in `rgba16float` using the Phase D normalized orientation channel for the tested controlled geometry.** The focal-distance branch now keeps every tested nonzero `U − f` input finite, including controlled virtual-image samples inside the former `0.002 mm` band. Depth-derived samples whose measured reconstruction error is as large as the requested offset are explicitly reported as depth-limited. Exact `U = f` depth cases use a fixture-only canonical limit identity because their reconstructed positions are not exactly on the focal plane.

The native-required headed Chrome run reported `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, and `applicationFallback=false`. It reported `depth24plus` scene depth and `rgba16float` physical output with a separate `rgba8unorm` validity target. A native rasterized surface at depth `0.9999995232` remained distinguishable from the exact clear value `1.0` on this adapter. This does not establish hardware acceleration or universal depth precision.

The experiment verifies numerical and classification parity only. It does not implement production Ground Glass WebGPU, blur gather, Image Circle rendering, or final DOF composition. The production Ground Glass renderer remains WebGL-only.

## B. Existing physical authority

The CPU authority remains [`computePhysicalBlurFootprint()`](../../src/core/optics/computePhysicalBlurFootprint.ts). It resolves orthonormal lens and film bases, projects object distance onto the lens normal, constructs the thin-lens image point, intersects the oriented film plane, maps local aperture offsets, and computes the covariance ellipse and signed equivalent CoC. The WebGL implementation in [`groundGlassDofShaders.ts`](../../src/render/groundGlassDofShaders.ts) uses an optimized local-affine derivative for the same physical contract.

For positive object distance `U` along the lens normal and focal length `f`, the canonical thin-lens regimes are `U < f` (finite virtual image, `V < 0`), `U = f` (image at infinity), and `U > f` (finite real image, `V > 0`). Only exact equality is the parallel-image limit in the CPU authority. A nonzero distance from `f`, however small, remains a finite-image input; replacing a band around `f` with the limit changes the physical branch and can reverse signed CoC. The final signed CoC still comes from the ideal image's position relative to the actual oriented film plane, so `U` alone is not a general near/far sign rule.

Physical ellipse orientation is calculated in radians by the CPU oracle and the TSL kernel. The RGBA16F storage contract normalizes the wrapped line angle over π into channel A; consumers recover radians with the existing orientation decoder. World positions are reconstructed in metres, converted explicitly to millimetres before the physical calculation, and stored physical channels R–G remain millimetres.

Related authority: [Ground Glass coordinate contract](GROUND_GLASS_COORDINATE_CONTRACT.md), [renderer stabilization contract](RENDERER_STABILIZATION_CONTRACT.md), and [DOF/focus physics convergence](../DOF_FOCUS_PHYSICS_CONVERGENCE.md).

## C. Native depth acquisition

The fixture rasterizes five asymmetric, unlit surfaces into a `320 × 240` `THREE.RenderTarget` with a `THREE.DepthTexture` requested as `DepthFormat` / `UnsignedIntType`. Native execution reported `depth24plus`. The scene includes the near-far-plane control at world Z `-1.0498 m`; the camera is at Z `0.95 m` with far clip `2 m`, so this plane is inside the far clip by `0.0002 m`. Its selected pixel remains visible and is not overlapped by another fixture surface.

Seven fixed pixel-center probes cover six visible surface locations—including two points on the tilted plane, an occluding marker, and the near-far-plane boundary—and one clear-depth background pixel. The depth and physical passes read the actual GPU depth texture. Surface identity is independently recovered by matching the GPU-reconstructed world point to analytical ray/plane intersections; it is not copied from the requested probe label.

## D. WebGPU projection convention

The source camera is initialized with the WebGPU renderer's coordinate system before its projection matrices and TSL uniforms are created. TSL uses Three.js r186 `getViewPosition(sourceUv, depth, inverseProjection)` and then the mounted camera world matrix. WebGPU's depth sample is treated in its native `[0, 1]` NDC convention; the WebGL GLSL `depth * 2 - 1` conversion is not applied.

Expected points come from independent ray/plane intersections against the fixed fixture geometry. The greatest measured XYZ error among the six GPU-covered surface probes was `0.0000118000 m` (about `11.8 μm`), for the near-far-plane point. The previous five ordinary surface probes retained their earlier micrometre-scale errors.

| Probe | GPU-identified surface | GPU depth | World-position error |
|---|---|---:|---:|
| `near-front-center-left` | near-front plane | 0.98907238 | 1.536 μm |
| `far-front-upper-right` | far-front plane | 0.97989959 | 1.724 μm |
| `tilted-plane-left-edge` | tilted plane | 0.98438740 | 0.260 μm |
| `tilted-plane-right-edge` | tilted plane | 0.98539770 | 1.652 μm |
| `occluded-front-marker` | occlusion marker | 0.96132839 | 0.035 μm |
| `far-clip-upper-right` | far-depth plane | 0.99999952 | 11.800 μm |
| `empty-background-corner` | no surface; exact clear depth | 1.00000000 | invalid / no expected point |

The marker probe's independent ray intersects the hidden `far-front-plane` behind the marker. GPU depth reconstructs the visible marker, not the hidden plane. The far-clip probe demonstrates a valid value above the former `0.999999` rejection threshold while still below clear depth. These are point-sample results for this `depth24plus` adapter, not a claim about antialiased depth edges or other adapters.

## E. Physical TSL kernel

The GPU receives actual reconstructed world position and explicit lens/film parameters. The TSL path implements:

1. Orthonormal lens and film basis resolution.
2. Optical-axis object distance and lateral object offset.
3. Thin-lens image distance and image-point construction, including the parallel-image limit at object distance equal to focal length.
4. Intersection with the oriented film plane.
5. Local aperture-offset mapping into the film basis.
6. Covariance eigenvalues, major/minor ellipse radii, physical orientation in radians modulo π, and signed equivalent CoC diameter.
7. Separate depth, geometry, focal-boundary resolution, and binary16 representability classification.

The TSL kernel no longer has a focal-distance tolerance. Every representable nonzero `U − f` uses the finite-image path. Division intermediates use a safe denominator only when `U − f` is exactly zero; a zero denominator without an authoritative limit identity is reported as fixture validity code `4` (`unresolved focal boundary`) and is not stored as a valid physical result. Existing fixture validity meanings remain `0` no depth, `1` valid/storable, `2` outside finite binary16 range, and `3` invalid physical geometry.

Rasterized depth reconstruction is approximate: for the tested `depth24plus` probe, the observed focal-distance error was `−0.0014953613 mm` (`−1.495 μm`). The depth-driven `U = f` samples therefore do not reconstruct at exact equality. Those explicitly identified cases carry a test-only parallel-limit identity derived from their canonical ray/plane input; the fixture still checks and reports the GPU depth and reconstructed position. This metadata is used only for the canonical exact-limit test cases. It is not inferred from a proximity threshold and is not a production input contract. The controlled-world-point supplemental samples provide known physical coordinates directly to the same TSL optical kernel, without uploading CoC or ellipse results.

Before storage, the kernel wraps the physical angle over π and writes `orientationNormalized = wrappedOrientationRad / π` into A. The native `rgba16float` channels are `R=signed CoC diameter (mm)`, `G=major semi-axis (mm)`, `B=minor semi-axis (mm)`, and `A=orientation normalized over π`. A separate diagnostic target exposes the principal angle, wrapped radians, normalized value, and whether an ellipse direction is defined. The storage target remains `NoColorSpace`, nearest-filtered, without tone mapping or mipmaps.

A separate `rgba8unorm` target preserves code `0` for no depth, `1` for valid/storable values, `2` for valid physical values outside finite binary16 range, `3` for invalid physical geometry, and `4` for a numerically unresolved exact focal boundary without the explicit canonical limit identity. Unsupported or unresolved values fail closed to zero in the data target while remaining distinguishable in the validity target.

## F. Numerical comparisons

The independent oracle is `computePhysicalBlurFootprint()` applied to the analytical ray/plane result, not to the GPU-reconstructed point. The table reports the native GPU physical channels and CPU reference. CoC and radii are millimetres; signed classification uses the raw stored CoC sign, with numerical focus comparison reported separately.

| Case | GPU CoC | CPU CoC | GPU major/minor | CPU major/minor | Raw sign / focus comparison |
|---|---:|---:|---:|---:|---|
| Near-side, f/4 | -0.781250 | -0.781250 | 0.390625 / 0.390625 | 0.390625 / 0.390625 | near / outside tolerance |
| Same point, f/8 | -0.390625 | -0.390625 | 0.195313 / 0.195313 | 0.195313 / 0.195313 | near / outside tolerance |
| In-focus film plane | -0.00000292 | 0 | 0.00000143 / 0.00000143 | 0 / 0 | near / within 0.0001 mm |
| Far-side | +0.126221 | +0.126263 | 0.063110 / 0.063110 | 0.063131 / 0.063131 | far / outside tolerance |
| Far-clip visible surface | +0.727051 | +0.727387 | 0.363525 / 0.363525 | 0.363694 / 0.363694 | far / outside tolerance |
| Tilted film | -0.418701 | -0.418933 | 0.217773 / 0.201294 | 0.217873 / 0.201384 | near / outside tolerance |
| Swing / oblique film | -0.996582 | -0.997013 | 0.518555 / 0.478760 | 0.518990 / 0.478831 | near / outside tolerance |
| Compound lens/film | -2.361328 | -2.362220 | 1.325195 / 1.051758 | 1.325502 / 1.052448 | near / outside tolerance |
| Object distance = focal length | -80.000000 | -80.000000 | 40.000000 / 40.000000 | 40.000000 / 40.000000 | near / outside tolerance |

The existing focused-in-plane input has an exact-zero CPU result while native GPU arithmetic retains `-2.9206276e-6 mm`. Its raw sign is therefore near; its separate numerical comparison is within the fixture's `0.0001 mm` focus tolerance. The tolerance is a diagnostic only and is not a Phase F near/far gathering rule.

### Focal-length boundary evidence

The fixed boundary matrix includes five depth-driven samples at `f − 0.01`, `f − 0.001`, `f`, `f + 0.001`, and `f + 0.01 mm`, plus five controlled-world-point samples at the same offsets around `f = 50 mm`. The pre-existing `focal-plane-parallel-limit` depth case is retained as an additional exact-limit regression, and a sixth controlled sample omits the exact-limit identity to test unresolved fail-closed behavior. CPU values below are from `computePhysicalBlurFootprint()` on the canonical physical point; GPU values are read back from the actual `rgba16float` target. Controlled finite samples also compare the kernel's float32 input against the CPU oracle. CoC is in millimetres.

| Case | Input | Canonical `U−f` | GPU kernel `U−f` | GPU branch / depth evidence | CPU canonical CoC | GPU stored CoC |
|---|---|---:|---:|---|---:|---:|
| `focal-plane-parallel-limit` | depth | 0 | −0.001495361 | parallel limit / explicit identity | −80.000000 | −80.000000 |
| `focal-depth-below-0.01mm` | depth | −0.010000000 | −0.011505127 | finite virtual / resolved | +80.002934 | +80.000000 |
| `focal-depth-below-0.001mm` | depth | −0.001000000 | −0.002502441 | finite virtual / depth-limited | +80.000293 | +80.000000 |
| `focal-depth-exact` | depth | 0 | −0.001495361 | parallel limit / explicit identity | −80.000000 | −80.000000 |
| `focal-depth-above-0.001mm` | depth | +0.001000000 | −0.000488281 | finite virtual / depth-limited | −79.999707 | +79.937500 |
| `focal-depth-above-0.01mm` | depth | +0.010000000 | +0.008514404 | finite real / resolved | −79.997066 | −79.937500 |
| `focal-kernel-below-0.01mm` | controlled point | −0.010000000 | −0.009998322 | finite virtual / direct input | +12.502778 | +12.500000 |
| `focal-kernel-below-0.001mm` | controlled point | −0.001000000 | −0.000999451 | finite virtual / direct input | +12.500278 | +12.500000 |
| `focal-kernel-exact` | controlled point | 0 | 0 | parallel limit / explicit identity | −12.500000 | −12.500000 |
| `focal-kernel-exact-without-limit-identity` | controlled point | 0 | 0 | unresolved / validity code 4 | −12.500000 | 0 (fail closed) |
| `focal-kernel-above-0.001mm` | controlled point | +0.001000000 | +0.000999451 | finite real / direct input | −12.499722 | −12.492188 |
| `focal-kernel-above-0.01mm` | controlled point | +0.010000000 | +0.009998322 | finite real / direct input | −12.497223 | −12.492188 |

The controlled `focal-kernel-below-0.001mm` case is the supplemental evidence within the former `0.002 mm` band: the actual TSL kernel selects a finite virtual image and stores positive signed CoC, matching the independent CPU sign. The positive `f + 0.001 mm` depth case is not reliably resolved by raster depth: its canonical point is a finite real image, but the reconstructed point is `0.000488281 mm` below `f`, so the GPU correctly follows the reconstructed finite virtual-image input and reports `depth-limited`. At that reconstructed point the CPU oracle is `+79.999772 mm`; the GPU stores `+79.937500 mm`, with the difference attributable to binary16 quantization at this magnitude. The canonical CPU value is `−79.999707 mm`; the opposite signs are a depth-reconstruction limitation, not evidence of canonical-input kernel parity for this ambiguous case.

For the exact depth limit, the canonical CPU result is `−80 mm` and the GPU stores `−80 mm` even though reconstructed depth is `1.495 μm` below the focal plane. This is the intentionally explicit canonical-limit case, not a depth-only inference. The exact controlled point also stores the limit result when its identity is present. When the same exact controlled point omits that identity, the TSL diagnostic reports an unresolved branch and validity code `4`, and the physical target remains zero instead of fabricating a near/far sign. No broad equality tolerance is applied to finite inputs.

The orientation storage contract was checked against the existing Phase D encoder/decoder after actual half-float readback. The unwrapped angle is a GPU diagnostic; A is the actual binary16 normalized value; decoded radians are compared modulo π with the CPU oracle.

| Case | CPU angle (rad) | GPU principal angle (rad) | GPU stored A | Decoded GPU angle (rad) | Periodic error (rad) |
|---|---:|---:|---:|---:|---:|
| Circular near-side | 0 | 0 | 0.000000000 | 0.000000000 | 0 |
| Film tilt | 0.931369059 | 0.931369424 | 0.296386719 | 0.931126338 | 0.000242721 |
| Film swing | 1.325900125 | 1.325901031 | 0.421875000 | 1.325359401 | 0.000540724 |
| Compound lens/film | 2.125506604 | -1.016085386 | 0.676269531 | 2.124563391 | 0.000943213 |
| Near-π, negative principal angle | 3.122961713 | -0.018630261 | 0.993652344 | 3.121650903 | 0.001310810 |
| Negative unwrapped principal angle | 2.572961713 | -0.568630338 | 0.818847656 | 2.572485781 | 0.000475932 |
| Off-center 4× crop, near-π angle | 3.126106698 | -0.015487025 | 0.994628906 | 3.124718865 | 0.001387833 |

Across storage-valid finite cases (validity code 1), newly measured maximum absolute CPU/GPU errors were `0.000892180 mm` for signed CoC, `0.000435227 mm` for the major radius, `0.000689904 mm` for the minor radius, and `0.001387834 rad` for periodic orientation after decoding the normalized half-float A channel. The corresponding unquantized TSL wrapped-angle diagnostics agree more closely; the table's error includes normalized-domain binary16 quantization. Changing only f-number from 4 to 8 halves the near-side CoC and both radii; the sign is retained.

## G. Precision and classification

Native binary16 readback was observed as `Uint16Array` values and decoded from the stored target. Physical orientation is calculated in radians but stored as a normalized `[0, 1)` value over the π-periodic line angle; circular footprints use deterministic zero. On the exercised native adapter, the near-π and crop examples stored `0.993652344` and `0.994628906`, respectively, then decoded to `3.121650903 rad` and `3.124718865 rad`. The largest measured periodic CPU error after decode was `0.001387834 rad`, reflecting binary16 quantization in the normalized channel.

The `in-focus` sample retains its raw stored value `-2.9206276e-6 mm` and raw sign classification `near`; independently, it is within the numerical focus tolerance of `0.0001 mm`. That tolerance does not rewrite signed CoC or establish a production gather threshold.

The `outside-binary16-range` vector is synthetic, not a realistic optical scene result. The CPU physical result is `-312500 mm` CoC with `156250 mm` axes. The GPU validity target reports code `2`; the `rgba16float` data target stores `[0,0,0,0]` to avoid presenting overflow as valid physical data. This demonstrates a storage representability boundary, not invalid lens geometry.

The separate `0.0001 mm` near-focus comparison tolerance remains a numerical diagnostic only. It does not select the finite-image versus parallel-limit branch. Focal-boundary depth resolution is reported separately from raw signed CoC classification and binary16 storage validity.

## H. Failure and invalid samples

| Sample | Native validity | Depth evidence | Result |
|---|---:|---|---|
| `background-no-depth` | 0 | `clear-background`, sampled depth exactly `1.0` | Physical target is zero; classified as no depth |
| `far-clip-visible-surface` | 1 | `visible-geometry`, sampled depth `0.9999995232` | GPU identified `far-depth-plane`; physical CoC `+0.7270508 mm` |
| `invalid-lens-basis` | 3 | Visible scene geometry | Degenerate lens basis; physical target is zero; classified as invalid geometry |
| `outside-binary16-range` | 2 | Visible scene geometry | Finite physical result outside storage range; physical target is zero; classified as unrepresentable |

The fixture records `covered-clear-depth-ambiguous` separately when an analytical ray hits geometry but the sampled depth equals the clear value. No probe was ambiguous in this native run: the valid far surface remained below clear depth, and the background was exactly `1.0`. The TSL depth test uses exact clear semantics (`depth < 1`); this finding applies to the tested `depth24plus` adapter and camera range. It does not guarantee every adapter can distinguish every surface arbitrarily close to the far clip. An indistinguishable covered/clear sample is not reported as verified geometry.

The overlap sample confirms the visible marker supplies depth while the far plane remains hidden. The fixture uses non-multisampled targets and point samples away from geometry edges. Antialiased/subpixel depth boundaries, transparent surfaces without depth writes, and missing depth contributions are not solved here.

## I. Resource and browser results

The fixture is isolated at `src/tests/e2e/fixtures/ground-glass-webgpu-physical-coc.html` and uses a test-only `HashRouter`. The experiment route owns each renderer and its local targets, materials, fullscreen geometry, surface geometry, and surface materials. The diagnostic shell remains mounted while navigation removes the renderer route.

Native lifecycle tests passed for:

- Initial classification and native readback.
- SPA navigation with a held, successfully completed readback. The exact retired operation records `state=retired`, `stage=stale-readback-discarded`, `readbackOutcome=succeeded`, `resultPublished=false`, and `error=null`. Resources remain active until the barrier is released, then all recorded owned resources report disposed.
- A second handle whose accepted GPU readback completed before a test-only operation failure was injected after retirement. The operation retains `readbackOutcome=succeeded`, records `state=failed` and `failureClassification=test-injected-readback`, and publishes no result; owned-resource cleanup still completes. This is not a GPU readback rejection or device-loss simulation.
- A native depth-pass failure and a physical TSL-pass failure; both preserve the injected operation error and dispose the handle's owned resources.
- Return navigation to a different native handle, successful classification, and final cleanup.

These are Three.js ownership/disposal observations; they do not prove immediate GPU-driver memory reclamation. The SPA test proves lifecycle behavior of this isolated experiment host, not integration with public simulator routing.

## J. Compatibility blockers and limits

Verified:

- Native GPU depth acquisition and TSL sampling, including a visible surface above the former `0.999999` cutoff.
- WebGPU projection convention and independent world-position reconstruction.
- GPU TSL physical CoC and oriented footprint calculation.
- Finite virtual, exact parallel-limit, and finite real branches for the tested focal-boundary vectors. The controlled `f − 0.001 mm` result is positive and finite, rather than being forced to the negative parallel limit.
- Explicit depth-limited reporting where focal-distance reconstruction uncertainty prevents a canonical-side claim; the tested depth probe error was `1.495 μm`.
- Phase D-compatible normalized orientation storage and decoding through the existing codec.
- `rgba16float` storage and GPU readback.
- Raw near/neutral/far CoC sign semantics, with the fixture's numerical focus tolerance reported separately.
- Aperture scaling, film tilt/swing, compound geometry, focal-distance limiting behavior, invalid geometry, background, and an occlusion point.
- Off-center 4× crop with the shared physical point and nonzero near-π ellipse orientation retained.
- Fixture-owned SPA cleanup and failure evidence.

Not verified:

- Production WebGPU Ground Glass routing or public-router lifecycle.
- Full production scene depth reconstruction from the canonical simulator camera.
- Far/near aperture gather, blur composition, Image Circle/vignetting, or visual DOF parity.
- Other GPU adapters or hardware-acceleration status.
- Transparent-object depth policy, antialiased edge coverage, or universal distinguishability at the far clip. The explicit ambiguous-depth diagnostic is present, but this run produced no ambiguous sample.
- Canonical near/far parity for depth-derived `|U − f|` values at or below the measured focal-distance reconstruction uncertainty. The `f + 0.001 mm` test is explicitly depth-limited and its GPU branch follows its reconstructed finite virtual-image point.
- A depth-only exact `U = f` classifier. The exact depth test uses explicit test metadata derived from the canonical point; it does not infer exact equality from reconstructed depth.

## K. Phase F decision

After this Phase E review gate, a separate bounded Phase F feasibility study may be considered for physical footprint-to-pixel mapping and far/near gather/compositing. It should consume the Phase D-compatible normalized orientation contract and add explicit occlusion, edge, range, and storage diagnostics. Its input contract must carry an authoritative exact-limit identity when exact `U = f` is known from canonical physical state, or preserve an unresolved diagnostic if only depth-reconstructed position is available and equality cannot be established. It must not widen a finite-image branch with a distance tolerance.

This result does not justify enabling a production WebGPU backend. Production Ground Glass, complete DOF behavior, Image Circle parity, and all public scene camera contracts remain future work.

## L. Reproduction and validation

Native-required headed Chrome:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts
```

Ordinary Chromium compatibility/control:

```bash
npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts
```

Phase C/D native regressions:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts \
  src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts
```

Production-preview isolation:

```bash
npm run test:e2e -- --config=playwright.production.config.ts \
  src/tests/e2e/architecture-rise-webgpu-production.spec.ts
```

Validation executed for this review-fix round:

- Focal-boundary test on native-required headed Chrome: **1/1 passed**. The browser reported `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`, and `depth24plus`; the attached measurements include the actual GPU depth reconstruction, selected branch, RGBA16F CoC, and CPU comparisons.
- Full native-required Phase E suite: **5/5 passed**, including native depth/TSL conformance, finite/parallel/unresolved focal-boundary cases, SPA/resource lifecycle, and both failure-cleanup tests.
- Ordinary Chromium Phase E control: **2 passed, 3 native-only cases skipped**. The runtime used the WebGL2 fallback; these passes are compatibility evidence, not native WebGPU evidence.
- Phase C/D native Raw RTT and CoC/footprint regressions: **13/13 passed**.
- Production-preview isolation: **2/2 passed**. The current run generated contentful Architecture Rise Observer and Ground Glass evidence, denied production WebGPU initialization, and requested no WebGPU modules.
- Focused CPU physical-footprint/storage and film/orientation/crop unit suites: **44/44 passed** across 6 files.
- The old `0.002 mm` tolerance was temporarily restored as a mutation. The focused native test failed because a finite `f + 0.001 mm` reconstructed virtual-image input no longer matched the CPU physical result; the mutation was then removed, and the focused test and full native Phase E suite passed on the restored source.
- Full `npm test`: **2,488/2,488 passed** across 268 files. `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and final `git diff --check` passed.

The boundary measurements in Section F were newly captured on the native adapter during this round. Existing non-boundary depth, physical-footprint, orientation, and lifecycle tables above retain the prior Phase E baseline measurements. The complete repository E2E suite was not run; only the focused native, fallback, Phase C/D, and production-preview suites above are reported.
