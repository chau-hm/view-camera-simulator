# Ground Glass WebGPU Gather Quality, Performance and Scene-Coverage Feasibility

**Status:** bounded Phase G research; production Ground Glass remains WebGL-only.
**Native run:** `fe75f7d3d15a62fc9cdf742ee03ebe0276c976e4` (Chrome 155, Three.js r186, 2026-10-21).
**Overall result:** **PARTIALLY FEASIBLE**.

## A. Executive conclusion

The controlled native WebGPU path preserves the tested physical footprint when gather resolution and proposal count change, and its full-resolution 16/32/64-sample outputs agree closely with an independent CPU aperture-sampling reference. The low-resolution path reproduces the Phase F 36-pixel far-red leakage at all three sample counts. The available measurements localize the first observed leakage to the source-grid mapping/reconstruction and final composite; they do not yet isolate the precise shader-stage cause.

The benchmark provides repeatable CPU submission, queue-completion and readback observations, but no isolated GPU timestamp. They are not production frame-time estimates. Architecture Rise and Interior Corner factory geometry can be rendered through the controlled optics adapter, but this is proxy coverage, not production camera-state parity. The Macro attempt produced no depth in this fixture and is excluded.

**Recommendation:** perform one more targeted quality/performance research PR focused on localizing and comparing a reduced-resolution far-layer reconstruction candidate while preserving near foreground spread. Do not begin production Ground Glass integration or change production backend selection from these results.

## B. Research scope and baseline

The baseline is the merged Phase F implementation at `d1c78cb490e553fb5bafe673cf57331a0335b1b4`. Phase G uses a test-only `?phaseG=1` extension of the isolated fixture. It preserves the Phase F four-plane scene, canonical physical CoC/ellipse channels, separate far/near gathers, compositing, resource ownership and operation serialization. The experiment does not import a new renderer into public routes or change production rendering.

The controlled source is 128 × 96 pixels over a 36 × 24 mm film. The lens focal length is 50 mm, focused object distance is 500 mm, the film is parallel in the primary matrix, and the baseline aperture is f/2. The independent factorial uses f/1 to provide a larger controlled blur signal. Its fixed maximum radius cap is 12 px and its aperture proposals use the existing golden-angle sequence (`2.399963229728653` radians). Phase F Standard is full gather ×32; Low is half gather ×16. Both retain a full-resolution physical CoC/validity target.

## C. Experimental design

The primary 2 × 3 factorial changes gather scale and sample count independently at a fixed 128 × 96 source, f/1, full 36 × 24 mm film, cap 12 px, camera/focus and color/depth pipeline. Each cell has two warm-up operations and five measured operations. Full/half cells are interleaved by sample count. The separate source-size run uses 128 × 96, 512 × 384, then 256 × 192; cap-24/cap-60 trials alternate by round. Each has two warm-ups and five measured operations.

The 512 × 384 crop/cap study uses a 9 × 6 mm sampled film window, f/2 and 64 proposals. Representative geometry trials use the two canonical subject factories with uniform scale and recentering into the controlled camera volume, at 256 × 192, full gather, 32 proposals and cap 12; each has two warm-ups and five measured operations.

Native execution was verified from the mounted runtime, not inferred from API availability:

```text
rendererFamily = webgpu-renderer
executionBackend = webgpu
applicationFallback = false
threeRevision = 186
```

Observed formats were scene color `rgba16float`, depth `depth24plus`, physical CoC `rgba16float`, validity `rgba8unorm`, far/near gather `rgba16float`, radius diagnostics `rgba16float`, and composite `rgba16float`. Targets use `NoColorSpace`, no tone mapping, nearest min/mag filtering, clamp-to-edge and no mipmaps. Readback channels are decoded from half-float values. The common source-grid comparison uses the pixel-center mapping `floor((sourcePixel + 0.5) * gatherSize / sourceSize)` with edge clamping.

## D. Foreground leakage localization

The f/2 baseline reproduced Phase F exactly: Standard full ×32 had 0 classified far-red leaks; Low half ×16 had 36. In Low, the mapped source-grid far result had 36 pixels and total red contribution energy 33.290; the final composite had the same 36 pixels and energy. The near-blue-background leak metric was 0. The affected blue region contained 7,198 pixels, so the classified fraction was approximately 0.500%. Mean and maximum Manhattan distance from the sharp foreground mask were both 1 source pixel.

In the factorial, all three full-resolution cells had 0 mapped far-red pixels/energy and all three half-resolution cells had 36 pixels and energy 33.290. The representative native gather-target center samples had 0 classified leaks for both scales. This means the sampled native target texels do not show the same leak, while the source-grid mapping and composite do. The target metric samples a representative source point for each target texel; it does not inspect every sub-texel reconstruction position. Therefore this localizes the first measured difference to the source-grid reconstruction/mapping boundary, but does not prove whether the exact cause is reconstruction, classification alignment, or their interaction. Near alpha did not account for the measured red contribution under the fixture's separate near-blue test.

The fixed pixel-center mapping has independent unit cases that reject an off-by-half-texel mapping. No alternate upsampling shader, depth-aware filter or near/far coverage-aware reconstruction was implemented. The evidence does not justify choosing one before the exact interpolation path is isolated. The machine-readable attachment retains selected source/world/depth/CoC/validity/far/near/composite point probes and CPU-reference patches; complete render-target arrays are consumed for metric calculation but are not serialized. Screenshots show the actual composite. No standalone heatmap bundle is committed.

## E. Sample-count sensitivity

The following values are means of five measured operations per cell. `Near spread` is the count of red pixels outside the sharp red silhouette receiving the near contribution; `far yellow energy` is the sum of yellow-signal contribution outside the blue-background mask. These color-classification metrics are fixture-specific, not universal perceptual scores.

| Gather | Samples | Far-red leaks / energy | Near-red spread (pixels) | Far-yellow signal energy | Operation median (min–max, ms) |
|---|---:|---:|---:|---:|---:|
| Full | 16 | 0 / 0 | 624 | 41.050 | 162.1 (116.0–212.7) |
| Full | 32 | 0 / 0 | 804 | 40.964 | 170.9 (149.0–459.3) |
| Full | 64 | 0 / 0 | 850 | 43.836 | 200.9 (166.4–281.8) |
| Half | 16 | 36 / 33.290 | 624 | 148.530 | 37.1 (20.0–47.1) |
| Half | 32 | 36 / 33.290 | 888 | 149.906 | 24.2 (14.0–45.3) |
| Half | 64 | 36 / 33.290 | 816 | 152.026 | 48.6 (25.2–107.4) |

Increasing samples did not remove the half-resolution leak. Near-spread counts changed non-monotonically with sample count at both scales. Full ×64 is a higher-sample numerical comparison reference, not photographic ground truth.

## F. Gather-resolution sensitivity

At each fixed sample count, full gather had zero classified far-red leaks and half gather had 36, with the same total red contribution energy (33.290) and zero near-blue leak. The result isolates the leakage from sample count for this controlled scene. Far-yellow energy differs substantially between scales (about 41–44 full versus 149–152 half), so the two resolutions are not equivalent in color coverage. This energy is diagnostic signal under the fixture mask, not a normalized image-quality score.

## G. Edge-aware reconstruction experiments

The baseline uses nearest filtering and the tested source-pixel-center mapping. A deterministic unit control shows that the incorrect half-texel mapping would shift source pixel 1 into gather texel 1 when the correct lookup is texel 0. This protects the helper's coordinate definition; it is not an A/B comparison of two GPU reconstruction shaders.

No edge-aware candidate was tested. The native target center-sample metric is clean while mapped output is not, and the current near layer still has a separate meaningful-spread responsibility. Implementing a depth gate before distinguishing those mechanisms could suppress valid near blur. A future experiment should retain the current baseline and compare one explicitly aligned far reconstruction candidate, with near coverage measured separately.

## H. CPU/GPU reference results

For each full-resolution 16/32/64 cell, the test required exactly one non-vacuous far probe and one near probe, then evaluated the independent CPU aperture-sampling reference over the GPU-read-back source, depth/world, validity and physical inputs. Far RGB error was the maximum absolute RGB channel difference; near RGB uses the same measure; near alpha error is absolute coverage difference.

| Samples | Far max RGB error | Near max RGB error | Near alpha error |
|---:|---:|---:|---:|
| 16 | 0.0003214 | 0 | 0.00006592 |
| 32 | 0.0004023 | 0 | 0.00005262 |
| 64 | 0.000008921 | 0 | 0.00001591 |

All were below the test bounds (RGB < 0.04, alpha < 0.025). The 64-sample probe has nontrivial far contribution and near coverage. The CPU/GPU ellipse radius diagnostic agreed within 0.05 px; clamp-scale difference stayed below 0.005. The Phase F reference tests continue to protect the singular-value cap against the old max-axis approximation. Missing far or near probes are rejected by the pair helper; an incorrect half-texel lookup fails its independent fixed-coordinate control.

The CPU gather reference currently requires full-size gather probes. Half-resolution cells are covered by native output metrics and coordinate mapping controls, but not by the same CPU gather image comparison. That is a remaining evidence gap.

## I. Physical invariants

For the fixed far-yellow point in the f/1 matrix, GPU storage was identical for all six gather settings:

```text
R signed CoC: +1.850586 mm
G/B ellipse semi-axes: 0.925293 / 0.925293 mm
A orientation: 0 (normalized over π)
Validity: 1
```

The same physical channels were preserved across 128 × 96, 256 × 192 and 512 × 384 sources. With the 36 × 24 mm film held fixed, measured maximum pixel ellipse radii were 3.7031, 7.4063 and 14.8125 px respectively (approximately 1×, 2× and 4×). No cap activated in that scaling run.

For the 9 × 6 mm crop, the selected point stored `+0.925293 mm` CoC and `0.462646 / 0.462646 mm` axes regardless of cap. The uncapped transformed radius was 29.625 px. Cap 24 was active (`clampScale=0.810059`, final radius 24 px); cap 60 was inactive (`clampScale=1`, final radius 29.625 px). This cap changes sampling extent, not physical CoC/ellipse values. Phase F remains the source of native tilt/crop-specific evidence; Phase G's proxy scenes do not reuse production tilt or focus states. The Phase E exact focal-boundary and unresolved-state limits remain unchanged.

## J. Representative scene coverage

| Scenario | Geometry source and adaptation | Valid / near / far pixels | Result and limit |
|---|---|---:|---|
| Architecture Rise proxy | `createArchitectureRiseGroup` with `ARCHITECTURE_RISE_PRESENTATION`; uniform scale 0.03625 and recenter | 9,781 / 5,012 / 4,769 | Depth and physical classification produced content on architectural geometry. Production camera/film/optics state is not reused. |
| Interior Corner proxy | `createInteriorCornerGroup` with `INTERIOR_CORNER_PRESENTATION`; uniform scale 0.0595483 and recenter | 30,254 / 14,677 / 15,577 | Receding/compound geometry yields valid near/far footprints. Production optical state is not reused. |
| Macro Depth of Field | Factory adaptation attempted; no rasterized depth in this host | excluded | Macro coverage remains incomplete. |

The proxy trials produced five repeated native operations each. Their far/near classification counts were stable, but the fixture's red/blue material classifier reported zero near-spread and zero far-red-leak pixels for both. These are geometry/depth coverage checks, not representative image-quality proof. The fixture does not establish production scene materials, movements, tilt, focal state or public routing parity.

## K. Quality metrics

The following fixture-specific masks define the primary quality counts:

- **Blue background:** source B > 0.5, R < 0.15, G < 0.2.
- **Red foreground contribution:** R > 0.5, G < 0.12, B < 0.12.
- **Far foreground leak:** a blue-background source pixel whose mapped far result meets the red predicate. Energy sums `max(0, farR - sourceR)` over those pixels. Leak fraction divides by the number of blue-background pixels. Distance is Manhattan distance to the foreground mask.
- **Near background leak:** blue-background pixel with near alpha > 0.02, near B > 0.5, near R < 0.15 and near G < 0.2.
- **Near spread:** a non-red source pixel that receives a red near result with alpha > 0.02.
- **Far yellow signal:** contribution satisfying the fixture's yellow classification outside blue pixels, reported as a pixel count and summed signal energy.

These masks quantify the controlled colored-plane fixture. They do not replace spatially normalized perceptual quality or full-scene image comparisons. Playwright records selected source/physical/gather/composite point probes and CPU-reference patches in JSON, and attaches actual composite canvases for the baseline, six factorial cells, three source sizes, both caps and both geometry proxies.

## L. Performance methodology

The native-required run used headed Chrome 155 on macOS (`MacIntel`, arm64), Node 24.19.0 and Three.js 186. Adapter/device identity was not exposed; hardware acceleration is not established. There were two warm-ups and five measured operations for each factorial cell, source size, cap and representative geometry. The cell order alternated full/half; cap order alternated by round. Configuration runs were serialized on one worker.

Each render stage records JavaScript submission duration, `device.queue.onSubmittedWorkDone()` observed completion interval, and queue wait after submission. Readback and overall operation wall time are recorded separately. These intervals include scheduling, queue backlog and synchronization. The fixture reports `gpuTimestampDurationMs: null`; no GPU shader-time claim is made. The test is a research benchmark and has no machine-dependent millisecond pass threshold.

## M. Performance results

Observed steady-state operation medians (with five-run min–max) were:

| Stage | Operation median (min–max, ms) | Readback median (ms) |
|---|---:|---:|
| 128 × 96 full ×16 | 162.1 (116.0–212.7) | 17.2 |
| 128 × 96 full ×32 | 170.9 (149.0–459.3) | 26.4 |
| 128 × 96 full ×64 | 200.9 (166.4–281.8) | 35.4 |
| 128 × 96 half ×16 | 37.1 (20.0–47.1) | 3.8 |
| 128 × 96 half ×32 | 24.2 (14.0–45.3) | 1.8 |
| 128 × 96 half ×64 | 48.6 (25.2–107.4) | 2.0 |
| 512 × 384, full ×32, cap 60 | 3,428.4 (3,235.3–4,072.9) | 410.1 |

Source-size runs measured 1,106 ms median at 128 × 96 (658–1,650.5), 2,783.1 ms at 256 × 192 (2,625.8–3,028.2), and 3,428.4 ms at 512 × 384 (3,235.3–4,072.9). These serialized wall times include diagnostic work and queue/readback synchronization; they are not shader execution time and should not be extrapolated to production. The 256/512 comparison does not scale linearly with source pixel count.

At 512 × 384 crop, cap 24 had an 883.9 ms median (540.8–2,969.7) and cap 60 had 784.5 ms (542.5–2,973.1). The ranges overlap substantially, so no speed advantage is established for either cap. Representative proxy operation medians were 31.0 ms (29.1–102.7) for Architecture Rise and 42.6 ms (37.6–117.4) for Interior Corner; these small adapted proxies are not comparable to the controlled source-scaling study.

For reference, the 512 × 384 full ×32 stage medians for observed queue-completion interval were: scene color/depth 170.0 ms, physical CoC/validity 464.1 ms, far gather 416.4 ms, near gather 480.6 ms, research composite 440.2 ms, and display 392.4 ms. Corresponding JavaScript submission medians were approximately 0.2–0.3 ms. Queue-completion intervals are not isolated GPU pass durations.

## N. Resource and memory analysis

Estimated target storage uses `56 bytes × source pixels + 16 bytes × gather pixels`: source color (8 B), depth estimate (4 B), physical CoC (8 B), validity (4 B), world diagnostics (16 B), radius diagnostics (8 B), composite (8 B), and two RGBA16F gather targets (16 B per gather pixel). The estimate excludes driver allocation granularity, pipelines, browser compositor/swapchain and other implementation overhead; it is not GPU heap telemetry.

| Source/gather | Estimated target storage |
|---|---:|
| 128 × 96 / full | 0.844 MiB |
| 256 × 192 / full | 3.375 MiB |
| 512 × 384 / full | 13.5 MiB |

The native run retained 28 owned resource records through configuration changes and recorded 48 target resize operations without accumulating resource identities. SPA navigation retired handle `aperture-g1-8fbc1a88-5b51-4566-82b9-9b93b0abbe2c`; all owned resources reached disposed state. Returning created independent handle `aperture-g2-d7359fb9-e976-44a3-b158-d8f92938808b`, which rendered and was then disposed. The document token survived both route transitions. This verifies fixture ownership/disposal semantics, not immediate GPU-driver reclamation or absence of all memory leaks.

## O. Known limitations

- A single-view depth gather cannot recover background hidden behind foreground geometry.
- Near coverage remains a sparse-proposal approximation; this study does not establish full near-layer quality.
- Depth discontinuity artifacts remain; half-resolution far leakage is unresolved.
- Physical footprint storage remains binary16 and retains its finite-range/precision constraints documented in the Phase D report.
- Only one native Chrome adapter/runtime was tested; adapter identity and hardware acceleration are unknown.
- Exact focal-boundary inference from approximate raster depth remains limited as documented in Phase E.
- Macro, production scene optical states, comprehensive scene parity, tilt/swing coverage in representative geometry, Image Circle/vignetting, lighting, material behavior and full production composite parity are unverified.
- No production WebGL visual comparison under a matched scene/camera state was performed.
- No GPU timestamp duration was available.
- The ordinary production-preview isolation command completed with one passing policy test and one screenshot timeout at `architecture-rise-webgpu-production.spec.ts:110`; the timeout occurred in `locator.screenshot()` waiting for the canvas to stabilize. This round did not rerun that test on clean `main`, so it is not classified as a confirmed baseline failure.

## P. Integration readiness assessment

The bounded classification and full-resolution gather path have useful native evidence. Reduced-resolution edge quality remains a concrete issue, representative geometry does not yet establish scene-level image behavior, and performance measurements are only serialized browser/queue observations. Production materials, lighting, Image Circle and matched WebGL parity are absent.

**Decision: perform one more targeted quality/performance research PR.** It should isolate the half-resolution far-layer reconstruction defect and compare one bounded candidate while protecting near spread, then expand representative tests to authentic optical states including Macro. Only after those gates pass should an architecture/integration design PR assess production feasibility. This finding does not change the current WebGL production renderer.

| Area | Classification | Evidence |
|---|---|---|
| Physical CoC correctness | Verified | Fixed millimetre channels remain invariant across tested gather settings and source sizes; full CPU reference and prior Phase E authority remain separate. |
| Oriented footprint mapping | Verified | CPU/GPU ellipse radius and cap agree in the tested controlled cases; Phase F singular-value regression remains passing. |
| Far gather sampling | Limited | Full-resolution CPU parity passes; half-resolution output has repeatable classified leakage. |
| Near gather sampling | Limited | Full-resolution CPU RGB/alpha parity passes; sparse coverage and scene spread remain incomplete. |
| Low-resolution edge quality | Blocked | 36-pixel far foreground contamination persists for all sample counts; root cause and mitigation are unresolved. |
| Sample-count quality stability | Limited | Full 16/32/64 CPU parity passes, but color/spread measures change non-monotonically and 64 samples are not ground truth. |
| Representative geometry | Limited | Two factory-geometry proxies produce depth/physical classifications; Macro has no valid depth and production optical states are absent. |
| Crop/focus/tilt parity | Limited | 4× crop invariants are checked here and Phase F covers tilt/crop; representative Phase G proxies do not exercise canonical movement states. |
| Native performance evidence | Limited | Repeated CPU/queue/readback wall observations exist; no isolated GPU timing or production-resolution budget exists. |
| Memory/lifecycle | Verified | Bounded format-based estimates, stable resource identities and native SPA disposal/remount evidence pass. |
| Adapter support | Limited | One headed-Chrome WebGPU execution; no adapter matrix. |
| Production material/composite parity | Blocked | No matched production-scene/material/Image Circle comparison or production Ground Glass integration. |

## Q. Reproduction

Native Phase G (requires headed Chrome with native WebGPU enabled):

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-gather-quality.spec.ts \
  --project=chrome-native-webgpu --workers=1 \
  --grep "native Phase G factorial"
```

Ordinary Chromium control (WebGL2 fallback only; not native evidence):

```bash
npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-gather-quality.spec.ts \
  --project=chromium --workers=1
```

Native Phase C–E:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts \
  src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts \
  src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

Native Phase F:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

Production-preview isolation:

```bash
npm run test:e2e -- \
  --config=playwright.production.config.ts \
  src/tests/e2e/architecture-rise-webgpu-production.spec.ts \
  --workers=1
```

The machine-readable run for the final native implementation is generated under `test-results/ground-glass-webgpu-gather-ce25a-scene-proxies-and-lifecycle-chrome-native-webgpu/` with the commit-prefixed name `ground-glass-webgpu-gather-quality-fe75f7d3d15a-2026-10-21T15-46-53-470Z.json`. Playwright also attaches the measured canvas captures and the JSON to the native test result. The artifacts are ignored and are not committed.

## Related authority

- [Phase F aperture gather feasibility](GROUND_GLASS_WEBGPU_APERTURE_GATHER_FEASIBILITY.md)
- [Ground Glass coordinate contract](GROUND_GLASS_COORDINATE_CONTRACT.md)
- [Phase E physical CoC classification feasibility](GROUND_GLASS_WEBGPU_PHYSICAL_COC_CLASSIFICATION_FEASIBILITY.md)
- [DOF focus physics convergence](../DOF_FOCUS_PHYSICS_CONVERGENCE.md)
