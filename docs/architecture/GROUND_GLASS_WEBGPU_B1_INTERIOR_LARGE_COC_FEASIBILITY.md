# Ground Glass WebGPU B1 Interior Large-CoC Feasibility

**Status:** bounded Phase L research; public Ground Glass remains WebGL-only.
**Base:** Phase K merge `670fa7b168c2d1981f94f008b77d19bc94550489`.
**Decision:** **L-A for the tested Macro crop and radius-cap state.** The selected native case has a qualified interior cap/far-depth-edge region, convergent full-resolution references, no measured B1 fallback or sharp-fallback pixels in that ROI, and B1 is no worse than B0 there. This does not establish general B1 quality or production readiness.

## A. Executive decision

The native WebGPU Phase L fixture found a physically coherent Macro crop with a large connected region of 12 px radius-cap activation and high-contrast depth boundaries inside the raster. In the selected stress ROI, Full ×32 and Full ×64 agree closely. Half ×32 B1 matches B0 exactly in the interior cap/far-edge ROI, remains close to Full ×32, and has no source-color fallback or classified sharp-fallback samples in that ROI. Across the broader valid-far image, B1 has lower Full ×32 error than B0.

This is a bounded acceptable result, not proof that B1 wins every local metric. It did not improve B0 in the selected interior cap region, and the strongest candidate with larger uncapped radii failed the predeclared source-contrast qualification. The selected maximum uncapped radius is only 12.3359 px, 0.3359 px above the 12 px cap. The evidence therefore supports further **WebGPU Ground Glass architecture integration design**, with broader optical-state, material, adapter, and quality validation required before implementation or production promotion.

Native runtime evidence came from headed Chrome with Three.js r186 reporting `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`, and `threeRevision=186`. Adapter identity and hardware acceleration were not established.

## B. Phase K baseline

Phase K used Macro `macro-focus-middle-f5_6`, 150 mm focal length, 400 mm focus, f/5.6, a 512 × 384 source, and a centered 16× crop. Its uncapped maximum radius was 24.672 px; the 12 px cap affected 218 far pixels in a 109-pixel largest component located at the raster edge. The cap 60/12 comparisons changed 218 Full ×32 pixels and 244 Half ×32 B0/B1 pixels; 29 low-level changes also appeared in the uncapped control and were not automatically attributed to clipping.

Phase K measured B1 lower than B0 in full-frame RGB RMSE (0.003389 vs 0.061182), valid-far RMSE (0.005218 vs 0.006642), and valid-far depth-edge RMSE (0.014547 vs 0.018521). Those results remain specific to the centered edge-concentrated configuration.

## C. Crop/pan architecture

The fixture reuses `resolveGroundGlassInspectionWindow()` and the Phase J optical-state bridge. `cropPan` is normalized in `[-1, 1]`. For window fraction `q`, the center is `0.5 - pan * (1 - q) / 2`; positive X/Y selects toward the top/left of the full-film source convention. The capture camera uses that inspection window directly. Raw/Upright display orientation is a separate transform and is not applied again to the capture projection.

Crop and pan change sampled film/projection, not lens pose, subject geometry, focus, or the physical CoC model. At fixed magnification, pan candidates report equal sampled-film dimensions and canonical camera state/matrix. The final candidate is selected from GPU source, world/depth, validity, physical CoC/radius, edge, border, component, and source-contrast data, never from B0/B1 quality metrics.

## D. Candidate search

Twelve bounded candidates were evaluated: 8×, 12×, and 16× at normalized pan `(0, 0)`, `(0, -0.5)`, `(0, -0.75)`, and `(0, -1)`. Predeclared qualification required at least 200 interior capped pixels, a 128-pixel largest 4-connected interior component, at least 32 interior cap/far-depth-edge pixels, at least 32 high-contrast far-edge pairs, and a 16 px capped-support border margin.

| Candidate | Result | Reason |
|---|---|---|
| 8×, centered (`m8-y0`) | Qualified and selected | Satisfied all geometry/physical thresholds; richest high-contrast interior cap/far edge. |
| 12×, centered (`m12-y0`) | Rejected | Larger radius (18.5 px) and interior cap population, but zero pairs at the predeclared 0.05 source-contrast threshold. |
| 16×, centered (`m16-y0`) | Rejected | Maximum radius 24.6719 px but only 218 cap pixels and no qualifying interior cap region. |
| 8×/12×/16×, negative Y pans | Rejected | No valid visible content for the required interior region in the tested windows. |

The ranking is lexicographic by interior cap population, largest component, interior cap/far-edge population, high-contrast edge pairs, and locally uncapped-reference-clear cap population. Quality outputs were not consulted. The 8× candidate was the only qualified candidate.

## E. Interior-region qualification

Selected candidate `m8-y0` has 191,946 valid pixels; 61,394 pixels activate the 12 px cap, all classified far-side. Of these, 47,058 are interior cap pixels; the largest connected component is 47,058 pixels. The interior cap/far-depth-edge mask contains 530 pixels, and the preflight found 78 high-contrast cap/far edge pairs above the declared source-contrast threshold.

The selected image has some cap-activated pixels touching the raster border (minimum global cap border distance 0 px), so the entire cap mask is not boundary-free. The independently measured interior component begins at the required 16 px margin. The stricter local uncapped-support criterion, `border distance >= ceil(local uncapped radius) + 2`, is met for 47,924 cap pixels; its minimum qualifying clearance is 15 px for the measured maximum local radius of 12.3359 px. These definitions are reported separately; the 16 px cap margin is not treated as proof that every uncapped footprint is unclipped. The geometry-only preflight counted 530 interior cap/far edge pixels; the later quality ROI marks both endpoints of paired valid depth edges and contains 1,058 pixels.

## F. Optical-state fidelity

The applied state is Macro `macro-depth-of-field`, focus case `macro-focus-middle-f5_6`, 150 mm focal length, 400 mm focus, f/5.6, 512 × 384 source, zero film tilt and focus offset, and the canonical 8× centered crop. The sampled film is 15.875 × 12.7 mm (from the canonical 127 × 101.6 mm film). Full/B0/B1 and cap 12/60 operations use the same camera matrices and source/depth/validity/physical input fingerprints within each matched crop.

The physical readback has 55,992 near-sign, 36,738 neutral, and 99,216 far-sign pixels. The cap activates only on far-sign pixels. The maximum signed CoC magnitude is 0.76514 mm, about 7.65 times the application's 0.1 mm physical-sharpness reference. The maximum uncapped pixel radius is 12.33594 px, so this candidate establishes physical large CoC and cap activation but only a modest radius overrun. Pan-only candidate checks preserve film size, camera state, lens/film/focus geometry, and world matrix.

## G. Depth-edge geometry

The actual registered Macro subject supplies the visible edge. Ray/surface diagnostics identify the front lip near 417.500 mm and the adjacent chassis near 420.000 mm, about 2.499 mm apart, with distinguishable source colors. Both surfaces are behind the focus plane and have positive/far-side CoC: approximately +0.67334 mm at the lip and +0.76514 mm at the chassis. This is a meaningful geometric depth and color edge under physical defocus, but it is **not** a near/far signed-CoC transition. Single-layer depth does not reveal the hidden background behind either visible surface.

## H. Reference convergence

Full ×32 and Full ×64 are finite-sample native renderer references, not optical ground truth. In the interior cap/far ROI, their RGB RMSE is 0.00028815 and MAE is 0.00005073. In the interior cap/far depth-edge ROI, RMSE is 0.00107362, MAE 0.00040957, maximum channel error 0.0132446, mean absolute linear-luma error 0.00028662, and maximum absolute luma error 0.00499814. Full-frame agreement is RMSE 0.00048824, MAE 0.00005662, maximum channel error 0.0161743.

These values support comparisons at the reported scale for this one ROI. They do not establish convergence for other crops, adapters, scenes, or optical states.

## I. B0/B1 quality

Errors below are against the same-crop Full ×32 reference. RGB is measured from native readbacks in linear space.

| Path | Full-frame RMSE / MAE | Valid-far RMSE / MAE | Interior cap/far RMSE / MAE | Interior cap/far edge RMSE / MAE |
|---|---:|---:|---:|---:|
| Half ×32 B0, cap 12 | 0.0362179 / 0.0068863 | 0.0061333 / 0.0006232 | 0.00038034 / 0.00005447 | 0.00137589 / 0.00050021 |
| Half ×32 B1, cap 12 | 0.00390627 / 0.00033530 | 0.00317100 / 0.00033617 | 0.00038034 / 0.00005447 | 0.00137589 / 0.00050021 |

In the interior cap/far and cap/far-edge ROI, B0 and B1 output are identical at measured precision (zero changed pixels and zero RGB error). B1 is substantially closer in full-frame and valid-far metrics, but this difference occurs outside the selected interior stress ROI; it must not be presented as local B1 superiority. The final composite's edge metric follows the far result here because the paired near contribution is unchanged.

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

The matrix is a serial one-off quality experiment, not a performance benchmark. The seven measured operations use source 512 × 384, half gather 256 × 192, 32 proposals, and 42 owned resources per active handle. Estimated target storage is 13.5 MiB for full gather and 11.25 MiB for half gather under the fixture's target inventory. The final native run is recorded below; operation IDs refer to the single native handle used for the matrix.

| Operation | Operation ID | Wall / readback ms | CPU submission sum ms | Observed queue completion sum ms | Queue wait sum ms | Recorded stages | Target estimate |
|---|---|---:|---:|---:|---:|---:|---:|
| Cap 60 Full ×32 | `op-14` | 776.9 / 31.8 | 2.6 | 222.8 | 220.2 | 10 | 13.5 MiB |
| Cap 60 Full ×64 | `op-15` | 823.9 / 31.3 | 2.1 | 276.5 | 274.4 | 10 | 13.5 MiB |
| Cap 60 Half ×32 B0 | `op-16` | 723.5 / 32.3 | 1.8 | 261.2 | 259.4 | 10 | 11.25 MiB |
| Cap 60 Half ×32 B1 | `op-17` | 948.0 / 32.1 | 4.3 | 356.8 | 352.5 | 12 | 11.25 MiB |
| Cap 12 Full ×32 | `op-18` | 943.3 / 53.0 | 2.3 | 430.9 | 428.6 | 10 | 13.5 MiB |
| Cap 12 Half ×32 B0 | `op-19` | 1,110.3 / 101.9 | 2.1 | 547.2 | 545.1 | 10 | 11.25 MiB |
| Cap 12 Half ×32 B1 | `op-20` | 1,330.5 / 5.2 | 2.2 | 771.5 | 769.3 | 12 | 11.25 MiB |

The B1 paths record two additional Phase H passes: compatible-far reconstruction and candidate composite. The submission, observed-queue, and queue-wait values are sums of per-stage browser measurements; they are not isolated shader durations or exclusive GPU time. Readback varied from 5.2 to 101.9 ms, further showing that these values are browser/queue/readback observations, not comparable GPU frame times. No validated GPU timestamp is available; `gpuTimestampDurationMs` remains null. Do not infer FPS.

The matrix ran on native handle `aperture-g1-6a85cbd3-0946-4581-b433-5081fbbe1fdc`, with operation IDs `op-14` through `op-20`. The native SPA test retired that handle with all 42/42 owned resources disposed, returned to the route with distinct native handle `aperture-g2-369e6f62-4ec3-4eb3-8d8e-bc72041e1b94`, and independently disposed that handle's 42/42 resources. The document `performance.timeOrigin` remained unchanged through route navigation.

## P. Negative controls and test integrity

The Phase L unit tests verify canonical pan direction, bounded candidate enumeration, border-only cap rejection, physical far-only depth-edge masks, and separate near/far ROI metrics. The native spec verifies actual candidate state, same-magnification pan invariance, source/depth/validity/physical fingerprints, Full ×32 reference identity, CPU/GPU radius diagnostic agreement, B1 fallback source-color parity, and near RGB/alpha invariance. These checks are sensitive to the listed classes of bad state and data mismatch.

No deliberate source mutation was left in the branch. A temporary normalized-pan mutation caused the focused Phase L unit assertion to fail (`centerV` became `0.9375` instead of remaining above `0.5` for the same pan direction); the production helper was restored and the passing test rerun. The synthetic border-only cap fixture also remains an explicit negative control. A separate temporary mutation of the declared 16 px clearance threshold was not run because the approval gate rejected editing that predeclared threshold; therefore threshold-mutation sensitivity is not claimed. No separate mutation campaign was executed for every N1–N10 item. Phase K's pre-existing luma and B1 fixed-case assertions remain unchanged.

## Q. Regression and production isolation

The Phase L fixture is enabled only by the research query `?phaseL=1` and lives in the existing test fixture. No production `GroundGlassRTT`, shader, optics calculation, public route, scene registration, backend policy, or product control is changed. Native evidence is distinct from the ordinary Chromium compatibility run, which may execute Three.js WebGPU code on a WebGL2 fallback.

The focused Phase L native test passed in headed Chrome (1 passed, 1 native-only skip) and asserted native backend identity. The ordinary Chromium control passed separately (1 passed, 1 native-only skip) under WebGL2 fallback and is compatibility evidence only. The Phase C–K native regression run passed 30 tests with 6 ordinary-Chromium controls skipped in the native project. Focused Phase L and Phase K unit tests passed (16 tests); the full unit suite passed 2,546 tests across 275 files. Typecheck, lint, CSS check, and production build passed. The production-preview isolation spec passed 2 tests using the test's `/` base-path configuration. This was a corrected local preview configuration; no production renderer changes were needed.

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

The measured result supports proceeding to a bounded **WebGPU Ground Glass architecture integration design**: define backend boundaries, capability reporting, fallback semantics, resource ownership, and staged parity criteria before any production implementation. Preserve the stricter quality boundary as an explicit design input: this Phase L test demonstrates acceptable behavior at one interior cap/far edge, while B1 and B0 were identical in that ROI and the stronger-radius/high-contrast candidate did not qualify. Broader stress cases and production scene/material parity remain required before exposing a backend to users.

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

The native fixture evaluates the 12 candidates and freezes `m8-y0` (8×, normalized pan `(0,0)`, inspection center `(0.5,0.5)`) before the seven-operation matrix. The recorded matrix operation IDs are `aperture-g1-6a85cbd3-0946-4581-b433-5081fbbe1fdc:op-14` through `:op-20`. Playwright JSON and image attachments are stored in ignored `test-results/` output; they are runtime evidence, not committed golden images.
