# Ground Glass WebGPU Surface-Aware Far Reconstruction Feasibility

**Status:** bounded Phase I research; production Ground Glass remains WebGL-only.
**Base:** merged Phase H, `7766b83e6193f28945fcb4a0294ec5e7a91cad94`.
**Native runtime:** headed Chrome, Three.js r186; the mounted handle reported `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`. Adapter identity and hardware acceleration were not established.
**Decision:** **B1 is better supported than the original assessment suggested. C1 is a useful bounded experiment but does not improve reference fidelity over B1.** No production algorithm or renderer behavior changes.

## A. Executive conclusion

Phase I recalculated the Phase H blur measurements on a fixed 128 × 96 source-grid ROI and compared half-resolution output with matched native Full ×32 and Full ×64 references and an independent CPU aperture-sampling path. Full ×32 and ×64 agree closely: thresholded yellow-signal energy is 20.631 and 21.510, the thresholded spread is 71 and 72 pixels, and their full-raster RGB RMSE is 0.00187.

The Half ×32 baseline B0 has 36 Class A foreground leaks and 132.042 thresholded yellow-signal energy. Its centroid is displaced about 39 px from the feature and its signal covariance is roughly five times the full-resolution covariance. The earlier high energy is therefore not evidence of better blur preservation: nearest reconstruction repeats low-resolution gather results across source pixels and carries near-center color into incompatible far destinations.

Phase H's center-compatible B1 removes the measured far-layer leaks. Against the matched full references, B1 has lower full-raster RGB RMSE than both B0 and Phase I's neighbor-aware C1 at all three half-resolution sample counts. B1's Half ×32 thresholded energy is 24.379, with 66 classified pixels and a centroid within 2 px of the full-reference feature center. The prior 14–18.5% retention figure compared B1 with the inflated B0 baseline and was not a valid standalone quality criterion. B1 is closer in this study, although its half-resolution spread is somewhat tighter than the full references and this controlled result does not establish general scene quality.

C1 uses a 3 × 3 surface-aware neighborhood, rejects invalid/unresolved/non-far and depth-incompatible gather centers, and applies a fixed spatial weight. Native GPU results agree with the independent CPU oracle. C1 also removes the measured leaks, but its Half ×32 energy is 42.092 with 154 classified pixels, its blur covariance is wider than the full references, and its full-raster RMSE is slightly worse than B1. The neighbor coverage audit shows the 36 baseline leak destinations already had at least two compatible neighbors, so lack of nearby background samples did not prevent this bounded reconstruction. C1 is not promoted as the preferred research path.

**Outcome I-A:** B1 is the stronger reference match in this fixture. A separately scoped B1 validation/optimization study is the next useful step. C1 remains a test-only feasibility result; it does not justify production integration or a more general renderer abstraction.

## B. Phase H baseline and merge ancestry

This work is based on Phase H merge `7766b83e6193f28945fcb4a0294ec5e7a91cad94`. It preserves B0, B1, native source/gather provenance, the near gather, Phase D RGBA16F physical footprint storage, and fixture lifecycle behavior. The Phase I controls are behind the fixture-only `?phaseI=1` query and are not added to public simulator routes or settings.

The controlled fixture uses a 128 × 96 source, 36 × 24 mm film, f/2 aperture, 12 px physical-radius cap, linear test colors, nearest texture filtering, and 16/32/64 aperture proposals. Full gather is 128 × 96; half gather is 64 × 48. The added multiple-depth plane is test-only and appears in front of the controlled blue background so that it is actually rasterized.

## C. Full-resolution reference hierarchy

The comparisons retain four distinct reference classes:

| Reference | Role | Limits |
|---|---|---|
| R1 — canonical optics | Physical signed CoC, ellipse axes/orientation, focus and film geometry | Establishes physical inputs, not final RGB appearance |
| R2 — independent CPU aperture sampling | Recomputes gather/reconstruction from actual GPU-read-back source, depth/world, physical, validity, and observed gather-center data | Finite-sample CPU approximation; not perfect optical ground truth |
| R3 — native Full ×32 / Full ×64 | Matched native GPU output at two full-resolution sample counts | Full ×64 is a higher-sample numerical reference, not photographic truth |
| R4 — Half ×16/32/64 B0/B1/C1 | Subjects being compared | None defines correctness by itself |

The signal metrics use one fixed source-grid ROI of 7,198 controlled blue-background pixels for the axis-aligned matrix, identical linear source colors, geometry, film, focus, aperture, radius cap, and camera pose. The full-resolution GPU images are also compared pixel-for-pixel against each other. R2 and R3 are used separately; no composite score hides their different evidence boundaries.

## D. Blur-energy metric reconciliation

The energy calculation preserves Phase H's linear-RGB yellow-signal projection:

```text
max(0,
  0.925 * (far.r - 0.025)
  + 0.54 * (far.g - 0.08)
  - 0.825 * (far.b - 0.85))
```

The ROI and signal weights are shared across all configurations. The report retains total signal energy, energy from pixels above a fixed 0.02 threshold, threshold-classified pixel count, mean/normalized energy per ROI pixel, peak, signal-weighted centroid/covariance, radial profile, and linear RGB errors. There is no independent per-image normalization. The threshold affects the classified-pixel and thresholded-energy fields; it does not define total signal energy.

For the axis-aligned full references, Full ×32 has total energy 22.718, thresholded energy 20.631, mean total signal 0.003156 per ROI pixel, peak 0.628, and 71 thresholded pixels. Full ×64 has 23.597 total energy, 21.510 thresholded energy, mean 0.003278, peak 0.609, and 72 thresholded pixels. Their whole-raster RGB RMSE is 0.001869 (MAE 0.000163; maximum channel difference 0.04932). This small finite-sample difference gives a useful reference-variability bound for this fixture.

The Half ×32 B0 energy is 6.4× Full ×32 thresholded energy. The output grid reuses a 64 × 48 gather result at multiple 128 × 96 source positions. Its signal is not just the desired aperture spread: selected native gather-center identities show near foreground centers being reused at far/background destinations, and the same ROI contains 36 red Class A leaks. The color projection and threshold make spread easy to summarize, but neither alone proves blur shape or source validity. Centroid, covariance, radial profile, edge error, and the full RGB image comparison are evaluated alongside them.

## E. Phase H candidate reassessment

| Path | Half ×16 thresholded energy / pixels | Half ×32 | Half ×64 | Half ×32 centroid (px) | Half ×32 covariance xx / xy / yy (px²) |
|---|---:|---:|---:|---:|---:|
| Full ×32 reference | — | 20.631 / 71 | — | 54.56, 36.75 | 123.79 / 8.58 / 97.72 |
| Full ×64 reference | — | 21.510 / 72 | — | 54.74, 36.99 | 118.48 / 7.75 / 95.50 |
| B0 | 125.177 / 178 | 132.042 / 186 | 131.028 / 186 | 92.39, 36.68 | 621.66 / 140.65 / 343.89 |
| B1 | 17.515 / 58 | 24.379 / 66 | 23.366 / 66 | 54.97, 36.79 | 109.23 / 7.64 / 88.26 |
| C1 | 37.475 / 142 | 42.092 / 154 | 41.351 / 154 | 54.93, 36.99 | 132.67 / 8.97 / 106.24 |

B1 is closer to the full-reference energy and spread counts than B0 and C1. The weighted covariance indicates B1 is somewhat narrower than the full images, while C1 is wider. Centroids are close for both B1 and C1; that alone would miss C1's excess spread. The earlier B1 rejection based on its percentage of B0 energy is therefore revised: B0 is not a trustworthy energy denominator because its spatial reconstruction is invalid at the foreground boundary.

## F. Spatial blur-shape analysis

Radial profiles use the same source-grid feature center, 2 px bins, and 0–48 px range. Each profile is normalized by its own energy inside that measured radius; the reported error is mean absolute or RMS difference between the 24 per-bin energy shares. It therefore compares radial shape separately from total signal magnitude. Half ×32 B1 follows both full-reference profiles more closely than B0 or C1. B0's displaced centroid and broad covariance reveal its excessive spread. C1's energy and covariance exceed both full references, consistent with a broader tail rather than a closer match. The actual native far-only images, signal maps, edge crops, and difference images are attached to the Playwright result under ignored `test-results/` output.

| Half gather | B0 profile MAE vs Full ×32 / ×64 | B1 profile MAE vs Full ×32 / ×64 | C1 profile MAE vs Full ×32 / ×64 |
|---|---:|---:|---:|
| ×16 | 0.05747 / 0.05764 | 0.00558 / 0.00565 | 0.01247 / 0.01255 |
| ×32 | 0.05184 / 0.05201 | 0.00730 / 0.00719 | 0.01353 / 0.01361 |
| ×64 | 0.05261 / 0.05278 | 0.00628 / 0.00617 | 0.01325 / 0.01332 |

These values are dimensionless normalized energy-share errors. They complement, rather than replace, the full-raster RGB errors and the absolute energy measurements above.

| Half ×32 path | RGB RMSE vs Full ×32 | RGB RMSE vs Full ×64 | Edge-mask RGB RMSE vs Full ×32 | Focus-mask RGB RMSE vs source |
|---|---:|---:|---:|---:|
| B0 | 0.07047 | 0.07043 | 0.10224 | 0 |
| B1 | 0.04226 | 0.04219 | 0 | 0 |
| C1 | 0.04357 | 0.04344 | 0.0000721 | 0 |

The fixed edge mask covers 1,786 pixels (5,358 RGB samples); the focus mask covers 324 pixels (972 samples). The zero B1 edge error is a measured match for this fixture's selected mask, not a general edge-quality guarantee. C1 reduces B0's large edge error but does not beat B1 there. These statistics cannot prove absence of every halo, especially on natural materials or lighting.

## G. Native sampling and provenance invariants

Phase H's GPU identity passes remain the authority for observed source-to-gather coordinates and the source texel actually selected at each gather center. The CPU reference consumes those observed IDs and independently recomputes neighbor eligibility, depth compatibility, weights, output RGB, and fallback. It does not use GPU final C1 RGB as its expected value.

The source-to-gather lookup uses the actual native selected gather texel. The C1 neighborhood is centered on that observed selected gather coordinate, not a newly derived nominal center. Each neighbor's native center-source identity is used to read full-resolution validity, signed CoC, and camera-space distance. This preserves the measured half-resolution texel-center discrepancy and avoids hardcoding a CPU center formula as GPU evidence.

## H. Compatible-neighbor availability

Before interpreting C1, the native readbacks audit the 36 Half ×32 B0 Class A destinations using actual selected gather coordinates and actual native gather-center identities. All 36 had at least two valid, positive-CoC, depth-compatible far neighbors in the 3 × 3 area. There were no invalid/unresolved neighbor observations in that affected-pixel set. This supports a bounded local reconstruction experiment; it does not imply that arbitrary hidden backgrounds can be recovered.

The dedicated multiple-depth case rasterizes 855 valid pixels on a test-only second far plane. Within inspected 3 × 3 neighborhoods, the audit observed camera distances of about 740 mm and 870 mm; their 130 mm separation exceeds the test-only compatibility threshold of `max(20 mm, 1.5% of destination distance)`. The audit recorded 487 incompatible and 6,988 compatible far-neighbor observations. This demonstrates that the C1 depth gate distinguishes the two visible far surfaces in the tested configuration. The tolerance is a bounded fixture policy, not a universal physical constant.

## I. C1 reconstruction design

C1 is a native WebGPU TSL far-only reconstruction behind the Phase I fixture gate. For each valid far destination at reduced gather resolution it examines at most nine neighboring gather texels, rejects out-of-bounds, invalid, unresolved, non-far, and depth-incompatible centers, then averages eligible far colors with:

```text
w(dx,dy) = 1 / (1 + dx² + dy²)
center = 1, axial = 1/2, diagonal = 1/3
```

Depth compatibility uses camera-space millimetre distance, with the fixture threshold noted above. If a valid far destination has no accepted positive-weight neighbor, C1 uses the full-resolution source color and records fallback reason 1; this path is not counted as reconstructed blur. Non-far/invalid destinations preserve the baseline far result with reason 2. Full-resolution output is an exact baseline passthrough with reason 3. The candidate changes only the far layer; near gather, near alpha, near color, and composite alpha semantics are reused unchanged.

The 3 × 3 bound is a reconstruction heuristic, not an optical law. No search-radius expansion, hidden-background fill, or adaptive-resolution system is included.

## J. Independent CPU/GPU comparison

The CPU oracle independently uses the native readback arrays, selected gather IDs, and observed gather-center source IDs. Unit tests cover one and multiple accepted neighbors, mixed near/far inputs, depth-separated surfaces, invalid and unresolved neighbors, zero weights/no-neighbor fallback, image bounds, non-centered crop mapping, non-circular physical axes remaining untouched, and half-resolution center identity.

The full-resolution CPU-reference sensitivity controls exercised 16, 32, and 64 aperture samples. At ×16, native GPU versus CPU maximum RGB error was 0.0004865 and mean error 0.00000138. The native Full ×32 and Full ×64 reference errors were respectively:

| Native reference | Mean absolute RGB error | RGB RMSE | Maximum RGB error |
|---|---:|---:|---:|
| Full ×32 vs CPU | 0.00000187 | 0.00002423 | 0.00048828 |
| Full ×64 vs CPU | 0.00001143 | 0.00035389 | 0.01421791 |

For the primary Half ×16/32/64 C1 matrix, native GPU far output versus CPU oracle had maximum RGB error from 0.00055 to 0.00098; mean error was about 0.000105. Accepted-neighbor counts and fallback reasons had zero mismatches, and maximum accepted-weight-sum error remained below 0.037. Full-resolution C1 controls passed as passthrough. The test also compares the composite against an independent CPU far-plus-native-near composite. These results establish numerical agreement for this TSL implementation and fixture inputs; they do not prove the reconstruction rule is physically optimal.

## K. Baseline versus candidate quality matrix

| Gather | Path | Far-red leak pixels / energy | Yellow signal energy (thresholded) / pixels | RMSE vs Full ×32 | RMSE vs Full ×64 |
|---|---|---:|---:|---:|---:|
| Full ×32 | B0 reference | 0 / 0 | 20.631 / 71 | 0 | 0.001869 |
| Full ×64 | B0 reference | 0 / 0 | 21.510 / 72 | 0.001869 | 0 |
| Half ×16 | B0 | 36 / 33.290 | 125.177 / 178 | 0.07058 | 0.07059 |
| Half ×16 | B1 | 0 / 0 | 17.515 / 58 | 0.04243 | 0.04246 |
| Half ×16 | C1 | 0 / 0 | 37.475 / 142 | 0.04341 | 0.04331 |
| Half ×32 | B0 | 36 / 33.290 | 132.042 / 186 | 0.07047 | 0.07043 |
| Half ×32 | B1 | 0 / 0 | 24.379 / 66 | 0.04226 | 0.04219 |
| Half ×32 | C1 | 0 / 0 | 42.092 / 154 | 0.04357 | 0.04344 |
| Half ×64 | B0 | 36 / 33.290 | 131.028 / 186 | 0.07048 | 0.07042 |
| Half ×64 | B1 | 0 / 0 | 23.366 / 66 | 0.04227 | 0.04218 |
| Half ×64 | C1 | 0 / 0 | 41.351 / 154 | 0.04356 | 0.04342 |

The RGB RMSE columns compare full 128 × 96 linear RGB readbacks with identical source-grid dimensions. B1 is the closest half-resolution path in the measured matrix. C1's zero leakage is useful but is not a quality win by itself; it adds more signal spread than the reference and has slightly higher whole-image error than B1.

## L. Far leakage and near spread

The original axis-aligned B0 leakage remains Class A: valid near-foreground centers are selected for incompatible far/background destinations. The half-resolution baseline counts remain 36 / 70 / 53 leaks for axis-aligned, diagonal, and thin-foreground cases respectively. B1 and C1 produce zero classified far-red leaks in those cases. The continuous axis-aligned B0 red contamination energy is 33.2897; both candidates reduce it to zero under the fixture's declared mask.

Near data is independent. B0, B1, and C1 share the same native near target and alpha; the native RGBA16F near-layer readback signature is checked across each matrix row. Phase I adds no near-gather pass and does not alter the near aperture sequence, CoC, ellipse orientation, alpha, or compositing rule. A foreground blur outside a sharp silhouette remains a near-layer effect and is not classified as far contamination.

## M. Edge, depth, and crop cases

| Case | Native GPU/CPU C1 | Key evidence |
|---|---|---|
| Axis-aligned horizontal boundary | Pass | B0 36 leaks; B1/C1 0; 36 problematic pixels have ≥2 compatible neighbors |
| Vertical boundary | Pass | C1 GPU/CPU parity; no classified far-red leak |
| Diagonal foreground | Pass | B0 70 leaks; C1 0; GPU/CPU parity |
| Thin foreground | Pass | B0 53 leaks; C1 0; GPU/CPU parity; near target retained |
| Multiple far depths | Pass | 855 valid second-plane pixels; 740/870 mm centers; 487 rejected depth-incompatible observations |
| Tilted 4× crop | Pass | 9 × 6 mm sampled from 36 × 24 mm; CoC/ellipse input fingerprint unchanged for shared points |
| Invalid/unresolved | Pass | Validity 4 is excluded; stored footprint is zero; unresolved sample does not become trusted far data |

The multiple-depth plane uses a test-only linear-color mesh. It is not a public scene. These controlled cases do not establish quality for arbitrary geometry, transparent materials, illumination, or full simulator optical states.

## N. Performance and resource costs

The Phase I native test serializes B0/B1/C1 at Half ×32, with two warm-ups and five measured operations per path, interleaved in one browser. It records operation wall time, readback wall time, pass submission/observed queue completion, and queue wait. `gpuTimestampDurationMs` remains null; the values include browser scheduling and synchronization and are not GPU frame time or production FPS.

| Path | Operation wall time, median (range), ms | Readback wall time, median (range), ms |
|---|---:|---:|
| B0 | 44.7 (39.3–52.4) | 0.8 (0.8–5.6) |
| B1 | 53.1 (47.8–62.5) | 2.6 (0.8–8.5) |
| C1 | 54.6 (47.6–56.2) | 1.0 (0.9–5.4) |

Across the five C1 measurements, the observed queue-completion values for the additional surface-aware far pass ranged from 0.2 to 4.7 ms (median 0.9 ms); the candidate composite ranged from 0.4 to 5.2 ms (median 4.1 ms). These are synchronization-instrumented queue observations, not GPU timestamp durations. The sample is small and noisy; it is useful only as a bounded cost observation for this fixture.

C1 adds two full-source-grid passes (surface-aware far reconstruction and candidate composite), one candidate TSL material, and at most nine gather-neighbor evaluations per source pixel. It reuses the Phase H candidate far/composite targets; it introduces no additional render-target allocation beyond the targets already allocated for the Phase H research diagnostics. Phase H's RGBA32F provenance targets and other diagnostic readbacks are fixture infrastructure, not a proposed production memory budget. A future implementation would need to choose a compact, production-owned source/gather provenance representation and measure its cost separately.

## O. Lifecycle and regression results

The fixture retains per-handle resource ownership, serialized operations, stale-readback suppression, failure injection, and client-side SPA route transitions. The Phase I controls do not alter public routing or production backend selection. The native lifecycle sequence navigates away, verifies owned resources are disposed, returns to a distinct native handle, renders C1, and retires the remounted handle. Successful `dispose()` evidence proves the fixture's disposal calls and ownership lifecycle; it does not prove immediate GPU-driver memory reclamation.

## P. Known limitations

- A single view cannot recover background hidden behind foreground geometry.
- This is one controlled native Chrome adapter/runtime; adapter identity and hardware acceleration are unknown.
- The 20 mm / 1.5% depth gate and 3 × 3 weighting are test-fixture policies, not validated universal thresholds.
- Near coverage remains a sparse-proposal approximation.
- Physical CoC/ellipse storage remains binary16 with the Phase D finite-range and quantization limits.
- Unresolved focal-boundary samples remain validity code 4 and are excluded; this study does not remove Phase E precision limits.
- Production optical-state parity, Macro scenes, representative material/light behavior, Image Circle/vignetting, and production composite parity are not established.
- No native WebGPU production Ground Glass path or matched production WebGL/WebGPU scene comparison exists.
- No true GPU timestamp or production frame-rate budget is available.
- The fixture's architecture/scene control geometry is not a production optical calibration test.

## Q. Next-phase recommendation

Retain B0 as the historical baseline and B1 as the strongest measured half-resolution reference match. Do not promote C1: it removes leakage but is less faithful to Full ×32/×64 than B1 and broadens the measured far signal. A follow-up should validate B1 against more representative visible surfaces and movement states, then study its quality/cost tradeoff. If those tests reveal persistent spatial bias, compare a bounded, better calibrated reconstruction or an edge-selective full-resolution fallback as a separately measured experiment. No Phase I result authorizes production migration, a public backend selector, or physical DOF shader porting.

| Area | Status | Evidence boundary |
|---|---|---|
| Controlled physical CoC/ellipse inputs | Preserved | GPU point probes and input fingerprints unchanged across B0/B1/C1 |
| Native Full ×32/64 reference consistency | Verified | Same source grid; RGB RMSE 0.001869 |
| Half-resolution B0 contamination | Reproduced | Class A edge provenance and 36/70/53 leak cases |
| B1 versus full-resolution quality | Better supported | Lower whole-image RMSE than B0/C1; spatial metrics closer in tested case |
| C1 native implementation/CPU parity | Verified | Native WebGPU execution and measured GPU/CPU outputs |
| C1 production quality | Not established | C1 does not beat B1 against tested full-resolution references |
| Near-layer independence | Verified in fixture | Same near target/signature and no Phase I near pass |
| Production renderer integration | Not tested | Production Ground Glass stays WebGL-only |

## R. Reproduction commands and artifacts

Run from the repository root with the bundled Node 24 runtime on `PATH`.

Native Phase I (headed Chrome; requires native WebGPU):

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction-i.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

Ordinary Chromium fallback control (not native evidence):

```bash
npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction-i.spec.ts \
  --project=chromium --workers=1
```

Focused CPU oracle:

```bash
npm test -- src/tests/unit/groundGlassWebGpuSurfaceAwareFarReference.test.ts
```

Phase C–H native regressions:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- --project=chrome-native-webgpu --workers=1 \
  src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts \
  src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts \
  src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts \
  src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts \
  src/tests/e2e/ground-glass-webgpu-gather-quality.spec.ts \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction.spec.ts
```

Production-preview isolation:

```bash
npm run test:e2e -- --config=playwright.production.config.ts \
  src/tests/e2e/architecture-rise-webgpu-production.spec.ts --workers=1
```

Ordinary Chromium is a separate fallback-only control. A WebGL2 fallback is not native evidence. Production-preview failures are reported with their exact test and are not relabeled as baseline without a current-base comparison.

Playwright writes the run summary, reference audit, edge/depth diagnostics, timing records, and PNG attachments under ignored `test-results/`. The artifacts include source, Full ×32/×64, Half ×32 B0/B1/C1, difference maps, far signal/leakage maps, near alpha, edge crops, neighbor coverage, fallback regions, and the multiple-depth audit. No generated images or full target arrays are committed.

**Validation provenance:** the latest native Phase I matrix, CPU sensitivity controls, radial-profile checks, and SPA lifecycle case passed in headed Chrome (`1 passed`), with mounted runtime `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, and `applicationFallback=false`. The ordinary Chromium control passed (`1 passed, 1 native-only skipped`) and logged the expected WebGL2 fallback; it is not counted as native evidence. The focused CPU reference suite passed (`10 passed`), and the complete unit suite passed (`2524 passed across 272 files`). Typecheck, lint, CSS structure, and production build passed. The final Phase C–H native regression run passed (`24 passed`); three ordinary-Chromium control cases were skipped under the native project. Production-preview isolation passed (`2 passed`).
