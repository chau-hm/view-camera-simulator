# Ground Glass WebGPU B1 Interior Large-CoC Feasibility

**Status:** bounded Phase L research; public Ground Glass remains WebGL-only.
**Base:** Phase K merge `670fa7b168c2d1981f94f008b77d19bc94550489`.
**Decision:** The original run is exploratory; its unconditional L-A label is withdrawn. The corrected native confirmatory rerun qualifies one candidate (`m8-y0`) under the interior-only high-contrast rule and computes **L-A** from matched cap-12 references, bounded B1 error, valid ROI populations, Near RGBA invariance, and fallback diagnostics. This is a fixture-specific result, not production readiness or a general B1 quality claim.

## A. Executive decision

The first native run found a physically coherent Macro crop with a large connected region of 12 px radius-cap activation. Its then-reported 78 high-contrast edge pairs used a global mask, so that run did not prove the pairs were in the declared interior support. Its unconditional `L-A` assignment was not gated by numerical error bounds and is withdrawn; those results remain exploratory observations only.

The corrective run re-evaluated all 12 geometry-only candidates using the interior-support rule and ran the matched quality matrix for the sole qualified candidate. The measured result satisfies the fixed reference-convergence and candidate-error bounds, matched ROI populations, Near RGBA and fallback checks, so the evaluator returns `L-A`. No production-readiness or general B1 quality claim follows from this one bounded Phase L result.

### Confirmatory acceptance contract frozen after exploration

These bounded engineering thresholds were selected after the exploratory run and are prospectively fixed for the corrective confirmatory run. They were not predeclared before the original measurements and are not universal photographic quality standards. All RGB values and RMSEs are normalized linear values from native readbacks.

| Criterion | Frozen limit | Rationale |
|---|---:|---|
| Interior cap/far ROI population | ≥200 pixels | Retains the existing geometry qualification minimum so an aggregate cannot be decided from a small accidental fragment. |
| Interior cap/far depth-edge ROI population | ≥32 pixels | Retains the existing minimum paired-edge support for an edge-specific comparison. |
| Full ×32 / Full ×64 RMSE, interior far | ≤0.001 | Requires the broad physically capped far reference region to agree within 0.1% of normalized RGB full scale. |
| Full ×32 / Full ×64 RMSE, edge | ≤0.002 | Allows more edge-local finite-sample variation while requiring agreement within 0.2% of normalized RGB full scale. |
| B1 / Full ×32 RMSE, interior far | ≤0.003 | Caps candidate error at 0.3% of full scale while accounting for half-resolution reconstruction. |
| B1 / Full ×32 RMSE, edge | ≤0.005 | Caps edge-local candidate error at 0.5% of full scale. |
| Candidate/reference uncertainty ratio | ≤3 | Requires candidate error to remain bounded by three times Full ×32/×64 disagreement, with a 0.0005 floor to avoid an unstable ratio near zero. The floor is an acceptance allowance, not measured reference noise. |
| Near target RGB and alpha RMS/max error | ≤0.0001 each | Keeps the existing near-layer invariance requirement explicit in the computed decision. |

The decision uses same-cap Full ×32/×64 reference convergence and same-cap B1/Full ×32 comparisons. The confirmatory run adds a cap-12 Full ×64 operation; no convergence conclusion is transferred from cap 60 to cap 12. Thresholds will not be adjusted after seeing confirmatory results without invalidating the confirmatory claim.

Native runtime evidence came from the corrective headed-Chrome run with Three.js r186 reporting `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`, and `threeRevision=186`. Adapter identity and hardware acceleration were not established.

## B. Phase K baseline

Phase K used Macro `macro-focus-middle-f5_6`, 150 mm focal length, 400 mm focus, f/5.6, a 512 × 384 source, and a centered 16× crop. Its uncapped maximum radius was 24.672 px; the 12 px cap affected 218 far pixels in a 109-pixel largest component located at the raster edge. The cap 60/12 comparisons changed 218 Full ×32 pixels and 244 Half ×32 B0/B1 pixels; 29 low-level changes also appeared in the uncapped control and were not automatically attributed to clipping.

Phase K measured B1 lower than B0 in full-frame RGB RMSE (0.003389 vs 0.061182), valid-far RMSE (0.005218 vs 0.006642), and valid-far depth-edge RMSE (0.014547 vs 0.018521). Those results remain specific to the centered edge-concentrated configuration.

## C. Crop/pan architecture

The fixture reuses `resolveGroundGlassInspectionWindow()` and the Phase J optical-state bridge. `cropPan` is normalized in `[-1, 1]`. For window fraction `q`, the center is `0.5 - pan * (1 - q) / 2`; positive X/Y selects toward the top/left of the full-film source convention. The capture camera uses that inspection window directly. Raw/Upright display orientation is a separate transform and is not applied again to the capture projection.

Crop and pan change sampled film/projection, not lens pose, subject geometry, focus, or the physical CoC model. At fixed magnification, pan candidates report equal sampled-film dimensions and canonical camera state/matrix. The final candidate is selected from GPU source, world/depth, validity, physical CoC/radius, edge, border, component, and source-contrast data, never from B0/B1 quality metrics.

## D. Candidate search

Twelve bounded candidates were rerun: 8×, 12×, and 16× at normalized pan `(0, 0)`, `(0, -0.5)`, `(0, -0.75)`, and `(0, -1)`. Qualification required at least 200 interior capped pixels, a 128-pixel largest 4-connected interior component, at least 32 interior cap/far-depth-edge pixels, at least 32 **interior** high-contrast cap/far edge pairs, and a 16 px capped-support border margin. The global high-contrast count remains diagnostic only.

| Candidate | Pan `(x, y)` | Total capped | Interior capped | Largest interior component | Interior cap/far edge pixels | Global high-contrast pairs | Interior high-contrast pairs | Interior clearance | Qualified / rejection reason |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| `m8-y0` | `(0, 0)` | 61,394 | 47,058 | 47,058 | 530 | 78 | 46 | 16 px | Yes; sole qualified candidate, selected. |
| `m8-yn0p5` | `(0, -0.5)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m8-yn0p75` | `(0, -0.75)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m8-yn1` | `(0, -1)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m12-y0` | `(0, 0)` | 17,816 | 8,780 | 4,390 | 276 | 0 | 0 | 16 px | No; zero interior high-contrast pairs, below 32. |
| `m12-yn0p5` | `(0, -0.5)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m12-yn0p75` | `(0, -0.75)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m12-yn1` | `(0, -1)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m16-y0` | `(0, 0)` | 218 | 0 | 0 | 0 | 0 | 0 | — | No; no interior cap support, below 200 pixels. |
| `m16-yn0p5` | `(0, -0.5)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m16-yn0p75` | `(0, -0.75)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |
| `m16-yn1` | `(0, -1)` | 0 | 0 | 0 | 0 | 0 | 0 | — | No valid visible content in the required interior window. |

The `m8-y0` candidate has 32 fewer qualifying high-contrast pairs than its global count: 78 global pairs, of which 46 have a capped far-side endpoint inside the 16 px interior-support mask. `m12-y0` demonstrates why the distinction matters: it has enough interior cap pixels, component size, and cap/far edge pixels, but no pair exceeds the 0.05 contrast threshold. The ranking remains lexicographic over geometry/physical counts only; B0/B1 quality outputs were not consulted. `m8-y0` is the sole qualified candidate.

## E. Interior-region qualification

Selected candidate `m8-y0` has 191,946 valid pixels; 61,394 pixels activate the 12 px cap, all classified far-side. Of these, 47,058 are interior cap pixels; the largest connected component is 47,058 pixels. The preflight interior cap/far-depth-edge mask contains 530 pixels. There are 798 global cap/far depth-edge pairs and 766 interior cap/far pairs; 78 global pairs exceed the declared source-contrast threshold, and 46 of those also have a capped far-side endpoint at least 16 px from the raster border. Both edge endpoints are valid and their depth delta is at least 1 mm. Only this corrected interior count satisfies the 32-pair qualification requirement.

The selected image has some cap-activated pixels touching the raster border (minimum global cap border distance 0 px), so the entire cap mask is not boundary-free. The independently measured interior component begins at the required 16 px margin. The stricter local uncapped-support criterion, `border distance >= ceil(local uncapped radius) + 2`, is met for 47,924 cap pixels; its minimum qualifying clearance is 15 px for the measured maximum local radius of 12.3359 px. These definitions are reported separately; the 16 px cap margin is not treated as proof that every uncapped footprint is unclipped. The later paired-endpoint quality ROI marks both endpoints of the interior qualifying depth edges and contains 1,058 pixels. The 530-pixel preflight mask and 1,058-pixel paired-endpoint quality ROI are different populations and are not interchanged.

## F. Optical-state fidelity

The applied state is Macro `macro-depth-of-field`, focus case `macro-focus-middle-f5_6`, 150 mm focal length, 400 mm focus, f/5.6, 512 × 384 source, zero film tilt and focus offset, and the canonical 8× centered crop. The sampled film is 15.875 × 12.7 mm (from the canonical 127 × 101.6 mm film). Full/B0/B1 and cap 12/60 operations use the same camera matrices and source/depth/validity/physical input fingerprints within each matched crop.

The physical readback has 55,992 near-sign, 36,738 neutral, and 99,216 far-sign pixels. The cap activates only on far-sign pixels. The maximum signed CoC magnitude is 0.76514 mm, about 7.65 times the application's 0.1 mm physical-sharpness reference. The maximum uncapped pixel radius is 12.33594 px, so this candidate establishes physical large CoC and cap activation but only a modest radius overrun. Pan-only candidate checks preserve film size, camera state, lens/film/focus geometry, and world matrix.

## G. Depth-edge geometry

The actual registered Macro subject supplies the visible edge. Ray/surface diagnostics identify the front lip near 417.500 mm and the adjacent chassis near 420.000 mm, about 2.499 mm apart, with distinguishable source colors. Both surfaces are behind the focus plane and have positive/far-side CoC: approximately +0.67334 mm at the lip and +0.76514 mm at the chassis. This is a meaningful geometric depth and color edge under physical defocus, but it is **not** a near/far signed-CoC transition. Single-layer depth does not reveal the hidden background behind either visible surface.

## H. Reference convergence

Full ×32 and Full ×64 are finite-sample native renderer references, not optical ground truth. The corrected decision uses a **same-cap 12** Full ×32/×64 pair, not the cap-60 reference. In the 47,058-pixel interior cap/far ROI, their RGB RMSE is **0.00032565**, below the frozen 0.001 limit. In the matched 1,058-pixel interior cap/far depth-edge ROI, RMSE is **0.00106331**, below the 0.002 limit; MAE is 0.00039931, maximum channel error 0.01361084, mean absolute linear-luma error 0.00027966, and maximum absolute luma error 0.00515669. Thus the two numerical reference-convergence checks pass for this cap-12 ROI.

The cap-60 matrix also contains a same-cap Full ×32/×64 pair, but its result is not transferred to cap 12. These values do not establish convergence for other crops, adapters, scenes, or optical states.

## I. B0/B1 quality

Errors below are against the same-crop, same-cap Full ×32 reference. RGB is measured from native readbacks in linear space. The 47,058-pixel interior cap/far and 1,058-pixel paired-endpoint edge populations match across Full ×32, Full ×64, B0, and B1.

| Path | Full-frame RMSE / MAE | Valid-far RMSE / MAE | Interior cap/far RMSE / MAE | Interior cap/far edge RMSE / MAE |
|---|---:|---:|---:|---:|
| Half ×32 B0, cap 12 | 0.0362179 / 0.0068863 | 0.0061333 / 0.0006232 | 0.00038034 / 0.00005447 | 0.00137589 / 0.00050021 |
| Half ×32 B1, cap 12 | 0.00390627 / 0.00033530 | 0.00317100 / 0.00033617 | 0.00038034 / 0.00005447 | 0.00137589 / 0.00050021 |

The frozen numerical criteria were fixed after the exploratory run and before this corrective rerun. For the interior far ROI, reference RMSE ≤0.001, B1 absolute RMSE ≤0.003, and B1 ≤`min(0.003, 3 × max(reference RMSE, 0.0005))` (measured upper bound 0.0015). For the edge ROI, the corresponding limits are 0.002, 0.005, and `min(0.005, 3 × max(reference RMSE, 0.0005))` (measured upper bound 0.00318992). Reference convergence passes both limits. B1 passes both absolute limits and both uncertainty-relative limits: interior 0.00038034 ≤0.0015, edge 0.00137589 ≤0.00318992. The B1/B0 equality is a separate observation, not an acceptance criterion.

In the interior cap/far and cap/far-edge ROI, B0 and B1 output are identical at measured precision (zero changed pixels and zero RGB error), but both are also close to the matched Full ×32 reference and within the frozen B1 bounds. B1 is substantially closer in full-frame and valid-far metrics, but this difference occurs outside the selected interior stress ROI; it must not be presented as local B1 superiority. The final composite's edge metric follows the far result here because the paired near contribution is unchanged.

The native evaluator computed `L-A`; all nine checks passed: candidate qualification, matched native provenance, finite measurements, matched nonempty ROI populations, reference convergence, B1 absolute and uncertainty-relative bounds, Near RGBA invariance, and fallback evidence. `failedCriteria` was empty. If any confidence or measurement check fails, the evaluator returns L-E; if the candidate or near/fallback quality contract fails, it returns L-B; no qualified geometry returns L-D.

## J. B1 fallback behavior

B1 has 607 far source-fallback pixels globally in this fixture, and all have exact source RGB parity (zero source mismatch). Their valid-far depth-boundary distance bands are: 0–1 px: 461; 2–4 px: 2; 5–8 px: 1; 9–12 px: 93; 13+ px: 50. The selected interior cap/far ROI contains zero fallback pixels and zero classified sharp-fallback samples. A separate global comparison found 54 source-like samples meeting the historical full-reference sharp-fallback diagnostic; all are outside the selected interior cap/far ROI. The source-equality diagnostic alone is not treated as a halo classification.

## K. Sharp-halo analysis

Within the selected interior cap/far and interior cap/far-edge masks, fallback count and sharp-fallback count are both zero. No fallback samples were available in the target region for local color/profile inspection, so a local halo width cannot be estimated from this run. This is a bounded statement about the selected masks, not proof that halo width is zero or that no halo exists elsewhere. The global fallback distribution remains concentrated at depth boundaries and is reported separately. The experiment does not equate source-color parity with a visual halo without checking valid far classification, CoC, radius, local reference blur, and spatial location.

## L. Blur preservation

The interior cap/far region has nontrivial physical CoC and cap activation, and its reference difference is small. B0 and B1 are identical there; both remain within the measured error to Full ×32 above. The cap 60-to-12 comparison changes 27,073 interior cap pixels for Half ×32 B1, with edge-local output changes measured separately below. These are image-space comparisons, not a measured optical PSF. No separate PSF claim is made. The fixture's covariance/spread diagnostic is a comparative proxy and must not be interpreted as an optical point-spread function.

## M. Near/far composition

The near target is identical between matched B0/B1 paths across 49,152 samples: maximum RGB and alpha error are both zero. Far-only results and final composite results are recorded separately in operation diagnostics. This exact near RGBA invariance demonstrates that the far reconstruction toggle did not change the existing near gather for the selected fixture state; it does not establish production near-coverage or hidden-background behavior.

## N. Cap 60 versus cap 12

For Half ×32 B1, cap 60→12 changes 33,960 full-frame pixels (RGB RMSE 0.00013338), 27,073 interior cap pixels (interior cap RMSE 0.00021739), and 643 pixels in the 1,058-pixel interior cap/far-edge ROI (edge RMSE 0.00039115, maximum channel 0.00509644, mean absolute luma 0.00005555, maximum luma 0.0019777). The uncapped valid control changes 183 pixels but remains very close (RMSE 0.000004804, maximum channel 0.00042725, mean absolute luma about 0.0000000772, maximum luma 0.0001727); these low-level differences are not attributed automatically to radius clipping.

The Full ×32 cap comparison changes 22,928 full-frame pixels. Half ×32 B0 cap deltas match the B1 counts/metrics in the measured interior region. Both far-gather and final-composite regions are reported; near output is unchanged. The unchanged `0.00001` linear-RGB changed-pixel threshold is used by the fixture.

## O. Performance and resources

The matrix is a serial one-off quality experiment, not a performance benchmark. The eight measured operations use source 512 × 384, half gather 256 × 192, 32 proposals, and 42 owned resources per active handle. Estimated target storage is 13.5 MiB for full gather and 11.25 MiB for half gather under the fixture's target inventory. The corrective native run is recorded below; operation IDs refer to the single native handle used for the matrix.

| Operation | Operation ID | Wall / readback ms | CPU submission sum ms | Observed queue completion sum ms | Queue wait sum ms | Recorded stages | Target estimate |
|---|---|---:|---:|---:|---:|---:|---:|
| Cap 60 Full ×32 | `op-14` | 862.7 / 27.5 | 2.9 | 272.1 | 269.2 | 10 | 13.5 MiB |
| Cap 60 Full ×64 | `op-15` | 864.6 / 30.7 | 2.5 | 286.5 | 284.0 | 10 | 13.5 MiB |
| Cap 60 Half ×32 B0 | `op-16` | 949.4 / 34.5 | 2.8 | 369.5 | 366.7 | 10 | 11.25 MiB |
| Cap 60 Half ×32 B1 | `op-17` | 984.5 / 37.8 | 5.4 | 348.7 | 343.3 | 12 | 11.25 MiB |
| Cap 12 Full ×32 | `op-18` | 1,277.5 / 92.6 | 2.6 | 648.8 | 646.2 | 10 | 13.5 MiB |
| Cap 12 Full ×64 | `op-19` | 1,073.2 / 85.9 | 2.2 | 599.0 | 596.8 | 10 | 13.5 MiB |
| Cap 12 Half ×32 B0 | `op-20` | 1,438.1 / 57.1 | 2.5 | 863.9 | 861.4 | 10 | 11.25 MiB |
| Cap 12 Half ×32 B1 | `op-21` | 1,952.7 / 87.9 | 2.9 | 1,217.5 | 1,214.6 | 12 | 11.25 MiB |

The B1 paths record two additional Phase H passes: compatible-far reconstruction and candidate composite. The submission, observed-queue, and queue-wait values are sums of per-stage browser measurements; they are not isolated shader durations or exclusive GPU time. Readback varied from 27.5 to 92.6 ms, further showing that these values are browser/queue/readback observations, not comparable GPU frame times. No validated GPU timestamp is available; `gpuTimestampDurationMs` remains null. Do not infer FPS.

The matrix ran on native handle `aperture-g1-57e62380-55d2-4955-89ea-547428500824`, with operation IDs `op-14` through `op-21`. The native SPA test retired that handle with all 42/42 owned resources disposed, returned to the route with distinct native handle `aperture-g2-7aa1be17-b52b-445a-80b0-9e945401bd5d`, and independently disposed that handle's 42/42 resources. The document `performance.timeOrigin` remained unchanged through route navigation.

## P. Negative controls and test integrity

The Phase L unit tests verify canonical pan direction, bounded candidate enumeration, border-only and mixed interior-low-contrast/border-high-contrast rejection, a positive interior high-contrast candidate, physical far-only depth-edge masks, separate near/far ROI metrics, and the computed quality decision. The identically wrong B0/B1 control returns L-B despite zero fallback; poor reference convergence, empty/mismatched ROIs, and missing/non-finite metrics return L-E; a candidate error over the fixed limit and invalid Near RGBA return L-B; no qualified candidate returns L-D. The native spec verifies all 12 candidate counts, corrected qualification, geometry-only selection, same-magnification pan invariance, source/depth/validity/physical fingerprints, cap-12 Full ×32 reference identity, cap-12 Full ×32/×64 convergence, B1 error bounds, CPU/GPU radius diagnostic agreement, B1 fallback source-color parity, and near RGB/alpha invariance.

No deliberate source mutation was left in the branch. A temporary restoration of the old global-only high-contrast qualification caused the mixed regression to fail because the invalid candidate became qualified; the corrected predicate was restored and the focused suite passed. The B1 quality negative control changes a good fixture candidate's measured edge RMSE to 0.006 (>0.005), and the evaluator returns L-B. A temporary normalized-pan mutation also caused the focused assertion to fail (`centerV` became `0.9375` instead of remaining above `0.5`); the helper was restored. A separate temporary mutation of the declared 16 px clearance threshold was not run because the approval gate rejected editing that predeclared threshold; threshold-mutation sensitivity for that threshold is not claimed. Phase K's pre-existing luma and B1 fixed-case assertions remain unchanged.

## Q. Regression and production isolation

The Phase L fixture is enabled only by the research query `?phaseL=1` and lives in the existing test fixture. No production `GroundGlassRTT`, shader, optics calculation, public route, scene registration, backend policy, or product control is changed. Native evidence is distinct from the ordinary Chromium compatibility run, which may execute Three.js WebGPU code on a WebGL2 fallback.

For this review-fix execution, the focused Phase L native suite passed (1 passed, 1 native-only skip) and asserted `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`, and Three.js r186. The ordinary Phase L control passed separately (1 passed, 1 native-only skip) under WebGL2 fallback. The Phase C–K native regression batch passed 28 tests with 5 ordinary-Chromium controls skipped; the separately run ordinary Chromium batch passed 15 controls with 18 native-only tests skipped. The production-preview isolation spec passed 2 tests. The full unit suite passed 2,556 tests across 275 files; typecheck, lint, CSS check, and production build passed. A first native C–K attempt used a restricted PATH that resolved an unusable system Git shim in two diagnostic specs; rerunning with the actual Homebrew Git on PATH passed those specs. The production-preview test used its `/` base-path configuration; no production renderer changes were needed.

## R. Known limitations

- One view and one-layer depth cannot reconstruct background hidden behind a foreground surface.
- Full ×32/×64 are finite-sample renderer references, not photographic ground truth.
- The qualifying selected radius only exceeds the configured cap by 0.3359 px; 12× had larger radius but failed the predeclared high-contrast edge criterion.
- Only one Macro optical state, crop, source resolution, adapter/runtime, and 32-sample gather was evaluated in Phase L.
- A geometric front-lip/chassis boundary was tested, but both sides had far-side CoC; a near/far CoC sign boundary was not tested.
- Binary16 physical storage retains its finite-range and quantization limitations.
- Near coverage is a finite-proposal approximation.
- Production materials, lighting, transparency, Image Circle/vignetting, exposure, DOF gather/composite, adapter parity, hardware acceleration, and public router integration are not established.
- No production WebGPU Ground Glass renderer or GPU timestamp performance budget exists.

## S. Next-phase decision

The corrected measured result supports proceeding to a bounded **WebGPU Ground Glass architecture integration design**: define backend boundaries, capability reporting, fallback semantics, resource ownership, and staged parity criteria before any production implementation. The result is L-A only for this one interior cap/far state under the frozen fixture-specific acceptance contract. B1 and B0 were identical in that ROI, and the selected radius exceeds the 12 px cap by only 0.3359 px. The 12× candidate had more radius but no high-contrast interior edge support. Broader quality stress and production scene/material parity remain required before exposing a backend to users.

## T. Reproduction

Base: `670fa7b168c2d1981f94f008b77d19bc94550489`; feature branch: `research/ground-glass-webgpu-b1-interior-coc-l`.

Native required headed Chrome:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-interior-coc-quality.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

Ordinary Chromium compatibility control:

```bash
npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-interior-coc-quality.spec.ts \
  --project=chromium --workers=1
```

Focused unit tests:

```bash
npm test -- src/tests/unit/groundGlassWebGpuInteriorCoc.test.ts
```

The corrective native run evaluated the 12 fixed candidates and froze `m8-y0` (8×, normalized pan `(0,0)`, inspection center `(0.5,0.5)`) before the eight-operation matrix. The frozen numerical acceptance contract is the table in Section A; it was set after the exploratory run and before the corrective rerun. The recorded matrix operation IDs are `aperture-g1-57e62380-55d2-4955-89ea-547428500824:op-14` through `:op-21`. The Playwright run emitted candidate, quality, and lifecycle JSON plus image attachments under ignored `test-results/`; later Playwright invocations replace that directory, so rerunning the native command regenerates these artifacts. They are runtime output, not committed golden images.
