# Ground Glass WebGPU Aperture Gather Feasibility

**Status:** bounded native WebGPU research fixture; production Ground Glass remains WebGL-only.

## A. Executive conclusion

**FEASIBLE — native WebGPU can execute the bounded physical aperture-gather path tested here.** Three.js r186 rendered scene color and depth, wrote and sampled the Phase D/E-compatible physical CoC/footprint representation, executed separate far and near neighborhood gathers, composited their outputs, and presented a real canvas image on the native WebGPU backend.

This conclusion covers a deterministic four-plane fixture and its tested adapter. It does not establish production Ground Glass readiness, full depth-of-field parity, parity across adapters, or recovery of hidden scene content. The work is test-only. It does not change production optics, shaders, routing, or backend selection.

## B. Existing Ground Glass gather contract

The production WebGL gather remains the behavioral reference. Physical CoC and footprint values are supplied by the canonical optics path. The renderer converts millimetres to source pixels, applies its quality cap, and performs separate far and near sampling. Depth rejection, gather caps, proposal counts, and near coverage estimation are renderer approximations; they do not change the optical inputs.

Phase F retains the Phase D/E physical channels:

| Channel | Meaning |
| --- | --- |
| R | signed equivalent CoC diameter in millimetres; negative near-side, positive far-side |
| G | major ellipse semi-axis in millimetres |
| B | minor ellipse semi-axis in millimetres |
| A | major-axis orientation normalized over π |

The separate validity texture retains `0 = no depth`, `1 = valid representable physical result`, `2 = outside RGBA16F range`, `3 = invalid physical geometry`, and `4 = unresolved focal boundary`. Only code 1 is eligible as a trusted center or neighborhood sample. The research far pass falls back to the center scene color when no valid far contribution exists; the near pass emits zero coverage when no valid near contribution exists. The diagnostic code remains separately inspectable.

## C. Native renderer and input textures

The fixture initialized `THREE.WebGPURenderer` revision 186 with actual runtime evidence:

```text
rendererFamily = webgpu-renderer
executionBackend = webgpu
applicationFallback = false
initialized = true
```

The native-required run used headed Chrome. The observed target formats were:

| Resource | Dimensions | Observed format |
| --- | ---: | --- |
| Scene color | 128 × 96 | `rgba16float` |
| Scene depth | 128 × 96 | `depth24plus` |
| Physical CoC / footprint | 128 × 96 | `rgba16float` |
| Validity | 128 × 96 | `rgba8unorm` |
| Far gather, standard | 128 × 96 | `rgba16float` |
| Near gather, standard | 128 × 96 | `rgba16float` |
| Far and near gather, low | 64 × 48 | `rgba16float` |
| Research composite | 128 × 96 | `rgba16float` |

The scene uses unlit node materials with explicit linear values, `NoColorSpace`, and no tone mapping or exposure adjustment. The test compares numerical render-target readbacks, not sRGB screenshot values. Display screenshots are attached as visual evidence only.

Each pass waits for submitted native queue work before the next pass or readback. The order is scene color/depth, physical CoC/validity, far gather, near gather, research composite, display, then readback.

## D. Physical-to-pixel conversion

The fixture maps each physical ellipse through the full-resolution source dimensions and sampled film dimensions:

```text
major.x = cos(θ) × majorMm × sourceWidthPx / sampledFilmWidthMm
major.y = −sin(θ) × majorMm × sourceHeightPx / sampledFilmHeightMm
minor.x = −sin(θ) × minorMm × sourceWidthPx / sampledFilmWidthMm
minor.y = −cos(θ) × minorMm × sourceHeightPx / sampledFilmHeightMm
```

For the full 36 × 24 mm film at 128 × 96 pixels, the axes use separate horizontal and vertical pixels-per-millimetre factors. The 4× off-center crop reports a 9 × 6 mm sampled region at the same source resolution, so the same physical ellipse maps to four times the pixel extent. The renderer's 12 px maximum radius is applied only after that physical mapping.

CPU tests cover non-square source/film dimensions, a quarter-turn ellipse, invalid dimensions, a 4× crop, deterministic proposal positions, and the post-mapping cap. The browser test confirms that the selected yellow landmark preserves its GPU CoC and millimetre axes across the crop while the independently calculated pixel axes scale by 4×.

## E. Aperture sampling implementation

The fixture uses deterministic golden-angle disk proposals:

```text
rᵢ = sqrt((i + 0.5) / sampleCount)
φᵢ = (i + 0.5) × goldenAngle
```

The far pass maps proposals through the center pixel's oriented CoC ellipse. It accepts valid non-near samples and applies the declared view-depth tolerance. The near pass samples a bounded proposal disk, tests each candidate against that candidate's own oriented ellipse, applies the foreground ordering rule, and accumulates area-compensated coverage.

Quality modes are bounded:

| Mode | Gather dimensions | Proposals | Maximum radius |
| --- | ---: | ---: | ---: |
| Low | 64 × 48 | 16 | ≤ 12 px |
| Standard | 128 × 96 | 32 | ≤ 12 px |
| Stress | 128 × 96 | 64 | ≤ 12 px |

Physical CoC and axes remain full-resolution and do not change with quality. Reduced resolution changes the gather approximation and edge/coverage sampling; it is not a physical blur adjustment.

## F. Far gather

The native output produced a measurable yellow contribution in blue background pixels around the defocused yellow feature. In the baseline standard capture, 128 blue-region pixels had nonzero yellow-direction signal, with total measured signal energy about 40.96 under the fixture's linear-color projection. The selected output pixel at top-origin `(47, 29)` matched the independent CPU sampling reference with maximum RGB absolute error `0.000403` and alpha error `0`.

The CPU reference independently recalculates nearest-neighbor texel selection, oriented ellipse offsets, validity and depth acceptance, and weighted color accumulation from a bounded patch of actual GPU input readbacks. It does not invoke the TSL sampling code. A whole-frame scan found zero red-foreground pixels leaking into the far gather over the tested blue background region.

## G. Near gather

The near layer produced nonzero foreground coverage outside the sharp red silhouette. The standard native capture measured 804 pixels outside the raw red classification with accepted red near-layer contribution; zero pixels in the blue-background region were counted as near-layer blue leakage. The selected top-origin output pixel `(68, 21)` had GPU RGBA `[0.949707, 0.014999, 0.014999, 0.121643]`; the CPU reference produced `[0.949707, 0.014999, 0.014999, 0.121696]`. The maximum RGB absolute error was `0`; alpha error was `0.000053`.

The alpha is coverage, not optical transmission. The CPU oracle independently applies candidate-ellipse membership, the near depth-order rule, area compensation, and coverage accumulation for this fixed output pixel.

## H. Research composite

The composite uses the far gather as the base and overlays near color by the near coverage alpha:

```text
composite = far × (1 − nearAlpha) + near × nearAlpha
```

The fixture preserves the focused green sample within `0.015` linear RGB per channel at its selected point. The initial standard native run retained the sharp red silhouette's classified pixel count at 1,620 while separately recording nonzero near coverage outside the silhouette. The far and near outputs are stored separately so their behavior can be inspected independently of the final composite.

This is a research composition rule. It does not reproduce all production Ground Glass compositing, vignetting, or display behavior.

## I. Quantitative evidence

The selected scene points use the independent CPU `computePhysicalBlurFootprint()` oracle with the GPU-reconstructed world point as its input. This isolates TSL physical-kernel arithmetic from depth reconstruction; the known scene point and reconstructed-position error are recorded separately.

| Scene point | Reconstructed position error | CPU signed CoC | GPU RGBA16F signed CoC | Absolute CoC difference |
| --- | ---: | ---: | ---: | ---: |
| Near red foreground | 0.0692 mm | −3.124974 mm | −3.123047 mm | 0.001927 mm |
| Far yellow feature | 1.1317 mm | +1.851364 mm | +1.850586 mm | 0.000778 mm |
| Focused green target | 1.5317 mm | +0.00001119 mm | +0.00000972 mm | 0.00000147 mm |

The CPU model returned circular axes for these parallel-plane samples. With film and scene fixed, changing f/1 to f/2 changed the selected near CoC from `−3.123047 mm` to `−1.561523 mm`, and the far CoC from `+1.850586 mm` to `+0.925293 mm`. At 12° tilt, the cropped far yellow probe stored axes `0.779297 mm / 0.742676 mm` with normalized orientation `0.430176` (about `1.352 rad`); the native TSL gather at selected tilted pixels also met the CPU sampling bounds. Shifting the film plane by 1 mm changed the focused green probe from `+0.159302 mm` to `−0.299805 mm` under the tilted/cropped setup, matching the CPU model's side classification. The fixture records each resulting physical channel set.

The CPU sampling comparison uses actual GPU source color, reconstructed world/depth diagnostics, validity, and physical texture readback as its input data. It recomputes the gather. This checks sampling behavior independently while the geometry oracle separately checks the physical values. It does not claim a fully independent CPU rasterizer or exact full-image WebGL parity.

## J. Crop and quality behavior

The off-center crop is applied through the camera view offset and a 9 × 6 mm sampled film window. The same yellow subject retains its physical CoC and ellipse axes; the source-pixel mapping changes by 4×. No crop-specific physical calibration is applied.

Low quality uses a half-size gather target and 16 proposals; standard uses full size and 32; the stress control uses full size and 64. The tests assert these dimensions and counts, confirm physical CoC is unchanged by quality changes, and attach per-mode diagnostic metrics. At f/2 and full film, the selected yellow-direction far signal energy was `20.63` at standard quality and `125.18` at low quality, demonstrating substantial sampling/resampling sensitivity rather than visual equivalence. All modes retain the 12 px gather-radius bound.

## K. Invalid and unresolved data

The native scene run contained valid physical pixels and clear-depth pixels, with no invalid-geometry or naturally unresolved focal-boundary pixels. A test-only unresolved-mask control writes code 4 at a small central region; the test confirms the physical RGBA16F footprint is neutral there and the far pass falls back to the source color. The independent CPU gather control also verifies that code 4 cannot be reinterpreted as a valid near or far footprint.

The fixture leaves `explicitParallelLimitIdentity` unset. It therefore does not claim that approximate raster depth can infer exact `U = f`; Phase E's code 4 remains the unresolved result when reconstructed input equals the focal boundary without an explicit identity. This Phase F scene does not contain a dedicated exact-focal-distance subject.

No NaN or infinity is accepted as valid physical data. The normal observed native run reported zero unrepresentable and invalid physical pixels. The test-only forced unresolved case is not a measured physical boundary event.

## L. Lifecycle and native browser evidence

The fixture records allocations and disposal states per renderer handle. It owns the renderer, scene geometries/materials, fullscreen geometry, physical/validity/world diagnostic targets, gather targets, composite target, and TSL materials. Cleanup disposes those resources in reverse allocation order and retains per-resource failure state.

Native-required headed-Chrome coverage performed a real HashRouter transition from `/experiment` to `/away` while a readback was held. The old handle entered retirement before the barrier was released, the readback then settled, its stale result was discarded without publication, and its resources completed disposal. Returning through the SPA created a different WebGPU handle that rendered successfully; the second handle was then retired. Additional injected failures after physical CoC, far gather, near gather, and composite remained observable and each exact handle completed cleanup.

These tests establish the fixture's Three.js disposal/ownership behavior. A `dispose()` completion does not prove immediate GPU-driver memory reclamation or rule out every adapter-level leak.

## M. Limitations

- The fixture uses a small deterministic scene of simple planar subjects, not the complete public simulator scene catalog.
- The only demonstrated native runtime is the headed Chrome/WebGPU adapter used for this run. Ordinary Chromium used Three.js WebGL2 fallback and is compatibility evidence only.
- The 20 mm floor / 1.5% view-depth tolerance, 12 px radius cap, sample counts, and near coverage compensation are renderer research choices, not physical laws.
- A single-view depth gather cannot reconstruct background information hidden behind foreground geometry. The depth gate reduces visible leakage but cannot solve disocclusion.
- Binary16 storage, nearest sampling, reduced-resolution gathers, and finite proposal counts introduce representation and sampling error.
- Exact `U = f` identity is not inferred from approximate depth by this Phase F fixture; no dedicated exact-boundary scene point was included.
- Production WebGPU Ground Glass, scene-depth world-position reconstruction across scenes, production materials, Image Circle/vignetting, full DOF gather/composite parity, hardware acceleration, and other adapters remain unverified.
- The experiment is not registered in public routes. Public Ground Glass remains WebGL-only.

## N. Next-phase recommendation

Proceed with bounded follow-up feasibility work on the sampling and composition differences that matter for production, using the Phase D/E physical representation and CPU optics as authority. Before any production integration, establish representative scene coverage, edge/disocclusion expectations, target adapter support, performance budgets, and an explicit unresolved-focal-boundary input contract.

Do not treat this result as approval to enable a production WebGPU Ground Glass path. Production routing, renderer selection, physical DOF shaders, image-circle behavior, and broad scene parity remain separate work.

## O. Reproduction

Native-required headed Chrome on a host with WebGPU enabled:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

The native suite result in this round was **4 passed, 1 ordinary-Chromium-only test skipped**. Runtime evidence required `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, and `applicationFallback=false`.

Ordinary Chromium compatibility control (WebGL2 fallback is not native evidence):

```bash
npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts \
  --project=chromium --workers=1
```

This round's ordinary Chromium result was **1 passed, 4 native-only tests skipped**.

Native Phase C/D/E regressions:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts \
  src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts \
  src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

The combined regression run completed **18 passed** in this round. Full repository E2E was not run; this fixture is isolated and does not modify production routing or rendering.
