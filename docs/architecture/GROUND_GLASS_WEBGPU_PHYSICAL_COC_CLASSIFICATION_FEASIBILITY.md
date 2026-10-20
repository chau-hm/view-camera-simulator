# Ground Glass WebGPU Physical CoC Classification Feasibility

**Status:** bounded native WebGPU feasibility result

**Measured:** 2026-10-20

**Three.js:** r186

## A. Executive conclusion

**FEASIBLE — native WebGPU can reconstruct scene world positions from a GPU depth attachment, compute the existing physical CoC and local-affine footprint model in TSL, and store the result in `rgba16float` for the tested controlled geometry.**

The native-required headed Chrome run reported `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, and `applicationFallback=false`. The depth attachment was reported as `depth24plus`; the physical output target was `rgba16float`, with a separate `rgba8unorm` validity target. This does not establish hardware acceleration.

The experiment verifies numerical and classification parity only. It does not implement production Ground Glass WebGPU, blur gather, Image Circle rendering, or final DOF composition. The production Ground Glass renderer remains WebGL-only.

## B. Existing physical authority

The CPU authority remains [`computePhysicalBlurFootprint()`](../../src/core/optics/computePhysicalBlurFootprint.ts). It resolves orthonormal lens and film bases, projects the object distance onto the lens normal, constructs the thin-lens image point, intersects the oriented film plane, maps local aperture offsets, and computes the covariance ellipse and signed equivalent CoC. The WebGL implementation in [`groundGlassDofShaders.ts`](../../src/render/groundGlassDofShaders.ts) uses an optimized local-affine derivative for the same physical contract.

The fixture's TSL kernel mirrors those operations for comparison. It is research code, not a second application authority. Canonical camera/film geometry and existing physical thresholds are unchanged. World positions are reconstructed in metres, converted explicitly to millimetres before the physical calculation, and stored physical channels remain in millimetres.

Related authority: [Ground Glass coordinate contract](GROUND_GLASS_COORDINATE_CONTRACT.md), [renderer stabilization contract](RENDERER_STABILIZATION_CONTRACT.md), and [DOF/focus physics convergence](../DOF_FOCUS_PHYSICS_CONVERGENCE.md).

## C. Native depth acquisition

The fixture rasterizes four asymmetric, unlit surfaces into a `320 × 240` `THREE.RenderTarget` with a `THREE.DepthTexture` requested as `DepthFormat` / `UnsignedIntType`. Native execution reported the actual depth format as `depth24plus`. The scene pass performs depth testing, including a marker in front of a larger plane. The diagnostic and physical TSL passes sample that depth texture directly; no world-position texture is uploaded.

Six fixed pixel-center probes cover the near plane, far plane, two points on a tilted plane, an occluding marker, and the clear-depth background. Full depth and physical results are read back from GPU render targets. The fixture records the camera matrices, target dimensions, UV/pixel address, sampled depth, expected surface, and reconstructed world point.

## D. WebGPU projection convention

The source camera is initialized with the WebGPU renderer's coordinate system before its projection matrices and TSL uniforms are created. TSL uses Three.js r186 `getViewPosition(sourceUv, depth, inverseProjection)` and then the mounted camera world matrix. WebGPU's depth sample is treated in its native `[0, 1]` NDC convention; the WebGL GLSL `depth * 2 - 1` conversion is not applied.

Expected points come from independent ray/plane intersections against the fixed fixture geometry. The greatest measured XYZ error among the five covered surface probes was `0.0000017242 m` (about `1.72 μm`).

| Probe | Visible surface | GPU depth | World-position error |
|---|---|---:|---:|
| `near-front-center-left` | near-front plane | 0.98907238 | 1.536 μm |
| `far-front-upper-right` | far-front plane | 0.97989959 | 1.724 μm |
| `tilted-plane-left-edge` | tilted plane | 0.98438740 | 0.260 μm |
| `tilted-plane-right-edge` | tilted plane | 0.98539770 | 1.652 μm |
| `occluded-front-marker` | occlusion marker | 0.96132839 | 0.035 μm |
| `empty-background-corner` | no surface | 1.00000000 | invalid / no expected point |

The marker probe's independent ray intersects the hidden `far-front-plane` behind the marker. GPU depth reconstructs the visible marker, not the hidden plane. This is point-sample evidence, not a claim about antialiased depth edges.

## E. Physical TSL kernel

The GPU receives actual reconstructed world position and explicit lens/film parameters. The TSL path implements:

1. Orthonormal lens and film basis resolution.
2. Optical-axis object distance and lateral object offset.
3. Thin-lens image distance and image-point construction, including the finite limiting branch at object distance equal to focal length.
4. Intersection with the oriented film plane.
5. Local aperture-offset mapping into the film basis.
6. Covariance eigenvalues, major/minor ellipse radii, orientation modulo π, and signed equivalent CoC diameter.
7. Separate depth, geometry, and binary16 representability classification.

The TSL pass writes `R=signed CoC diameter (mm)`, `G=major semi-axis (mm)`, `B=minor semi-axis (mm)`, and `A=orientation (rad)` to a native `rgba16float` target. A separate `rgba8unorm` target uses code `0` for no depth, `1` for valid/storable values, `2` for valid physical values outside finite binary16 range, and `3` for invalid physical geometry. Unsupported values fail closed to zero in the data target while remaining distinguishable in the validity target.

## F. Numerical comparisons

The independent oracle is `computePhysicalBlurFootprint()` applied to the analytical ray/plane result, not to the GPU-reconstructed point. The following values are measured from the native GPU target and compared to that CPU result. CoC and radii are millimetres; orientation is radians modulo π.

| Case | GPU CoC | CPU CoC | GPU major/minor | CPU major/minor | GPU angle | Classification |
|---|---:|---:|---:|---:|---:|---|
| Near-side, f/4 | -0.781250 | -0.781250 | 0.390625 / 0.390625 | 0.390625 / 0.390625 | 0 | near |
| Same point, f/8 | -0.390625 | -0.390625 | 0.195313 / 0.195313 | 0.195313 / 0.195313 | 0 | near |
| In-focus film plane | -0.00000292 | 0 | 0.00000143 / 0.00000143 | 0 / 0 | 0 | neutral |
| Far-side | +0.126221 | +0.126263 | 0.063110 / 0.063110 | 0.063131 / 0.063131 | 0 | far |
| Tilted film | -0.418701 | -0.418933 | 0.217773 / 0.201294 | 0.217873 / 0.201384 | 0.931152 | near |
| Swing / oblique film | -0.996582 | -0.997013 | 0.518555 / 0.478760 | 0.518990 / 0.478831 | 1.325195 | near |
| Compound lens/film | -2.361328 | -2.362220 | 1.325195 / 1.051758 | 1.325502 / 1.052448 | 2.125000 | near |
| Object distance = focal length | -80.000000 | -80.000000 | 40.000000 / 40.000000 | 40.000000 / 40.000000 | 0 | near |

Changing only f-number from 4 to 8 halves the near-side CoC and both radii; the sign is retained. The in-focus case derives its film-plane position from the thin-lens image distance for the same far-front object used by the far-side case. Across finite, representable cases, measured maximum absolute CPU/GPU errors were `0.000893 mm` for signed CoC, `0.000436 mm` for the major radius, `0.000690 mm` for the minor radius, and `0.000705 rad` for periodic orientation. Tests also reject wrong surface selection, wrong source UV, wrong projection/depth reconstruction, sign changes, and collapsed oriented footprints through independent position and channel comparisons.

## G. Precision and classification

Native binary16 readback was observed as `Uint16Array` values and decoded from the stored target. Exact near-side values happened to be exactly representable in the test vectors; other cases show expected quantization at the measured errors above. The in-focus GPU result has a small `-2.92e-6 mm` arithmetic residue and is classified neutral under the fixture's `0.0001 mm` sign deadband.

The `outside-binary16-range` vector is synthetic, not a realistic optical scene result. The CPU physical result is `-312500 mm` CoC with `156250 mm` axes. The GPU validity target reports code `2`; the `rgba16float` data target stores `[0,0,0,0]` to avoid presenting overflow as valid physical data. This demonstrates a storage representability boundary, not invalid lens geometry.

## H. Failure and invalid samples

| Sample | Native validity | Result |
|---|---:|---|
| `background-no-depth` | 0 | Clear depth; physical target is zero; classified as no depth |
| `invalid-lens-basis` | 3 | Degenerate lens basis; physical target is zero; classified as invalid geometry |
| `outside-binary16-range` | 2 | Finite physical result outside storage range; physical target is zero; classified as unrepresentable |

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

- Native GPU depth acquisition and TSL sampling.
- WebGPU projection convention and independent world-position reconstruction.
- GPU TSL physical CoC and oriented footprint calculation.
- `rgba16float` storage and GPU readback.
- Near/focus/far classification, aperture scaling, film tilt/swing, compound geometry, focal-distance limiting behavior, invalid geometry, background, and an occlusion point.
- Off-center 4× crop with the shared physical point retained.
- Fixture-owned SPA cleanup and failure evidence.

Not verified:

- Production WebGPU Ground Glass routing or public-router lifecycle.
- Full production scene depth reconstruction from the canonical simulator camera.
- Far/near aperture gather, blur composition, Image Circle/vignetting, or visual DOF parity.
- Other GPU adapters or hardware-acceleration status.
- Transparent-object depth policy and edge coverage behavior.

The ordinary Chromium control run uses the configured `WebGPURenderer` WebGL2 fallback and is compatibility evidence only. It is not counted as native WebGPU evidence.

## K. Phase F decision

**Phase F may begin as a separate bounded feasibility study** for physical footprint-to-pixel mapping and far/near gather/compositing. It should use this native depth/physical-output contract as its input baseline and add explicit occlusion, edge, range, and storage diagnostics.

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

This branch's validation recorded 4/4 Phase E tests in native headed Chrome; 1 passed and 3 native-only cases skipped in ordinary Chromium; 13/13 Phase C/D native regression tests; 2/2 production-preview isolation tests; 2,488/2,488 unit/integration tests across 268 files; focused physical/crop tests 37/37; typecheck, lint, CSS structure check, and production build passed.
