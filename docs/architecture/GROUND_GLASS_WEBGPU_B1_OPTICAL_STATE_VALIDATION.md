# Ground Glass WebGPU B1 Optical-State Validation

## A. Executive conclusion

**PARTIALLY FEASIBLE.** The test-only native WebGPU fixture can consume canonical optical state and render the actual Macro Depth of Field, Interior Corner, and Architecture Rise subject-factory geometry. In the tested states, B1 Half ×32 has lower full-frame linear-RGB RMSE than both the matched Full ×32 reference comparison for B0 Half ×32 and the B0 candidate itself. The native fixture also verifies physical CoC/ellipse values at rasterized points against the CPU kernel evaluated at independently reconstructed positions.

This is bounded correctness and image-quality evidence. It does not establish production material, lighting, Image Circle, full DOF, adapter-portability, or public-route parity. Interior focus-target coordinates do not land on the target surfaces at the sampled raster pixels: their reconstructed positions differ by about 100–127 mm. That limits claims about target-specific physical sharpness even though the GPU kernel agrees with the CPU calculation at the reconstructed point. A production Ground Glass integration should wait for a focused scene-point/capture correspondence investigation.

## B. Phase I baseline

Phase I PR #279 is in the base history at `7a03796465d13a81dec7aa4d5d390584e271c881`. Its controlled-plane study found B1 to have the strongest match to its matched Full ×32/×64 reference among B0, B1, and C1. Phase J carries B1 forward without changing its shader or reconstruction algorithm.

Phase J compares actual canonical scene factory geometry under matched native fixture lighting and optical inputs. Full ×32 and Full ×64 are finite-sample renderer references, not ideal optical or photographic ground truth. C1 is not rerun in this round; the scene comparisons are B0/B1 against the matched full-resolution output.

## C. Canonical optical-state adapter

The test-only adapter in `src/tests/e2e/fixtures/ground-glass-webgpu-optical-state-cases.ts` uses:

- `deriveOpticsState()` with each scene definition, its camera preset, and explicit case overrides;
- `configureGroundGlassCamera()` and `getGroundGlassClipRangeWorld()` to configure the photographic capture camera from canonical lens/film geometry;
- `createGroundGlassDofRenderState()` as the renderer input snapshot;
- `computePhysicalBlurFootprint()` as the independent CPU footprint oracle;
- scene focus targets and Macro focus-zone points as known physical references.

The Observer `cameraPlacement` is recorded as unused for photographic capture. The Phase J route is query-gated in the existing research fixture; no production routing, optics, shader, or renderer file changes.

The capture camera clears any prior view offset before each canonical operation and uses the actual renderer coordinate system. The adapter records the camera matrices, lens/film planes, focus planes, conjugate distance, movement state, and sampled film size for the operation that rendered the targets.

## D. Coordinate and units audit

| Quantity | Contract in this fixture |
|---|---|
| Scene and canonical optical positions | millimetres |
| Three.js subject/camera world positions | metres |
| Lens and film axes | dimensionless world-space basis vectors |
| Physical signed CoC and ellipse axes | millimetres |
| Focal length, focus distance, sampled film size | millimetres |
| Source and gather dimensions | pixels |

Known subject positions are converted from millimetres to metres for capture-camera projection. The physical kernel reconstructs depth in the capture camera's matrices and converts the reconstructed world position to millimetres before evaluating the footprint. Canonical lens and film plane positions in metres are converted to millimetres at the shader-uniform boundary. Phase J uses the full 127 × 101.6 mm sampled film and 512 × 384 source; Half ×32 uses a 256 × 192 gather target.

Macro has an axis-aligned lens/film reference. Interior front swing rotates the lens normal by 5 degrees while retaining the canonical film normal; front rise moves the lens and capture camera by 12 mm. Architecture front rise moves them by 20 mm. These values are asserted in applied runtime diagnostics. The Observer camera is not used to derive capture projection.

The browser fixture captures top-origin images and projects known points with the recorded capture-camera matrices. It stores source, depth/validity, physical CoC, far, near-alpha, composite, source-fallback, and difference images for the measured cases.

## E. Scene provenance and G/O/Q classifications

The three subject groups are created with their production factories and presentation data. Phase J resets the prior proxy presentation transform to unit scale and zero translation before capture; the Phase J diagnostic reports `placementAdaptation: none`, `proxyScale: 1`. Factory materials and geometry are retained. The fixture adds its own ambient and directional study lights, so these are not production lighting or exposure comparisons.

| Scenario coverage | Geometry (G) | Optical state (O) | Image quality (Q) |
|---|---|---|---|
| Macro Depth of Field: focus 390/400/410 mm at f/5.6; 400 mm at f/16 | **VERIFIED** — actual Macro factory geometry; nonempty color/depth and 688–726 occupied 2 mm depth buckets | **VERIFIED for tested axis-aligned states** — canonical 150 mm lens, conjugate film position, full film, focus, and aperture applied; known stations project in bounds | **MEASURED** — B1 against matched Full ×32, with Full ×64 at 400 mm/f/5.6; B1 also compared with B0 |
| Interior Corner: initial; 5° front swing; swing plus 8500 mm focus; 12 mm rise plus swing | **VERIFIED** — actual Interior factory geometry; 168,204–168,471 occupied depth pixels | **VERIFIED for applied states; target-to-raster correspondence LIMITED** — lens/film/capture state is canonical, but focus-target sample pixels reconstruct 100–127 mm away from the selected target points | **MEASURED** — B1 against matched Full ×32 and B0 for four states; target-local sharpness claims are limited by the correspondence error |
| Architecture Rise: initial; 20 mm front rise; rise plus 9500 mm focus | **VERIFIED** — actual Architecture factory geometry; 103,172–131,902 occupied depth pixels | **VERIFIED for applied states; target-to-raster correspondence LIMITED** — camera, film, rise, and focus state are canonical; façade sample pixels reconstruct about 10.9 mm from the focus target | **MEASURED** — B1 against matched Full ×32 and B0 for three states |

The current public scene lighting, shadow, tone-mapping, Ground Glass coverage/vignetting, and display transforms are not reproduced as an end-to-end production comparison.

## F. Macro Depth of Field

The Macro factory is rendered without geometry scaling or recentering. The canonical f/150 mm, 400 mm focus state places the film at 240 mm image distance, consistent with the scene's finite-focus model. The fixture captures actual source color and depth; the initial Phase G visibility failure is not reproduced under this capture-camera setup, though its former root cause was not independently isolated.

The f/5.6 focus matrix targets the actual near/middle/far focus-zone centers at 390, 400, and 410 mm. The focus target's GPU signed CoC remains within `0.0000192 mm` of zero. The other two target stations change sign around focus as expected: near-side points are negative and far-side points positive. At 400 mm focus, measured known-point CoC values are approximately −0.4119, −0.0000046, and +0.3918 mm for the 390/400/410 mm stations. At 410 mm focus the near/middle points are negative and the far station is within `0.0000072 mm` of zero.

At 400 mm focus, changing f/5.6 to f/16 reduces the far 410 mm station's CoC from about `+0.39185 mm` to `+0.13708 mm`, consistent with inverse f-number scaling. The native footprint field contains both near and far classifications in each tested Macro state.

## G. Interior Corner

The native matrix includes the initial scene state, 5° front swing, 5° front swing at 8500 mm focus, and the combined 12 mm front rise/5° swing state. The 5° swing produces the expected lens normal `(sin 5°, 0, cos 5°)` while the film normal remains `(0,0,1)`; it is not represented as film tilt. The rise translates the lens/capture-camera center by 12 mm.

The CPU footprint evaluated at GPU-reconstructed positions agrees with the GPU values across sampled focus targets: maximum signed CoC discrepancy is `0.0003312 mm`, maximum axis discrepancy is below `0.00024 mm`, and orientation discrepancy is below `0.00017 rad` modulo π. The independently chosen scene focus-target positions and sampled raster positions do not correspond closely: the observed world-position residual is about 100–127 mm. Known-point CPU CoC can therefore differ from the sampled GPU CoC by hundredths of a millimetre. The report does not treat that as physical-kernel failure or as verified target sharpness; it remains a scene-point projection/raster correspondence limitation.

## H. Architecture Rise

The native matrix includes the initial 0 mm rise at the canonical 8890 mm façade focus, 20 mm rise at the same focus, and 20 mm rise at 9500 mm focus. The fixture confirms the lens/capture-camera center translation and records the full camera/film state. The façade target projects in bounds and rendered source/depth is nonempty.

At the 20 mm rise/8890 mm focus state, the sampled façade point is about 10.94 mm from the canonical target. Its GPU CoC is about `−0.000217 mm`; this small raw signed residual is separately measured from the target-point CPU result. The CPU kernel evaluated at the reconstructed point agrees within `0.000001 mm`. Building-top visibility is represented in the actual factory source/depth output, but no separate target-mask or perceptual framing score is claimed.

## I. Physical CoC fidelity

For every reported point, the fixture records the canonical point, projected pixel, GPU depth/world reconstruction, CPU footprint at the canonical point, CPU footprint at the reconstructed point, native GPU footprint, validity, and signed/axis/orientation deltas. E2E assertions compare the GPU result to the CPU footprint evaluated at the reconstructed point with limits of `0.001 mm` for CoC and each semi-axis and `0.001 rad` for orientation modulo π. Sign is asserted when the reconstructed CPU magnitude exceeds `0.001 mm`; near-focus residuals are not promoted to reliable near/far evidence.

Across the Macro focus/aperture matrix, maximum canonical-point CoC error is at most `0.000241 mm`, and maximum known-point depth reconstruction error is `0.273 mm`. For Interior, the maximum reconstructed-point CoC error is `0.000332 mm`; for Architecture it is below `0.000006 mm`. The larger Interior/Architecture canonical-point-to-raster residuals above are reported independently and are not hidden by the reconstructed-point comparison.

## J. B1 image-quality results

The reference is a matched native Full ×32 far gather using the same source, camera, physical footprint, material, and study-light state. The measured ROI is a fixed 33 × 33 pixel region around the selected focus target; the depth-edge metric uses the fixture's source-depth discontinuity mask. Values below are linear-RGB channel errors. Full ×64 is available only for Macro at 400 mm/f/5.6.

| State | B0 Half ×32 RMSE | B1 Half ×32 RMSE | B1 MAE | B1 max channel error | B1 focus ROI RMSE | B1 depth-edge RMSE |
|---|---:|---:|---:|---:|---:|---:|
| Macro 390 mm, f/5.6 | 0.010827 | 0.005661 | 0.000605 | 0.389709 | 0.008795 | 0.028228 |
| Macro 400 mm, f/5.6 | 0.014395 | 0.004879 | 0.000411 | 0.320129 | 0.008401 | 0.025597 |
| Macro 410 mm, f/5.6 | 0.016505 | 0.002191 | 0.000090 | 0.166748 | 0.008426 | 0.010984 |
| Macro 400 mm, f/16 | 0.015254 | 0.007019 | 0.000568 | 0.320129 | 0.008401 | 0.037293 |
| Interior initial, 8000 mm | 0.036257 | 0.019783 | 0.002724 | 0.453125 | 0.069614 | 0.029379 |
| Interior swing 5°, 8000 mm | 0.029531 | 0.016277 | 0.002802 | 0.565796 | 0.033165 | 0.024348 |
| Interior swing 5°, 8500 mm | 0.030933 | 0.015633 | 0.002645 | 0.565796 | 0.024447 | 0.023334 |
| Interior rise 12 mm + swing 5°, 8000 mm | 0.026712 | 0.016341 | 0.002867 | 0.565796 | 0.033275 | 0.026174 |
| Architecture initial, 8890 mm | 0.081571 | 0.033782 | 0.003995 | 0.728882 | 0.000000 | 0.042152 |
| Architecture rise 20 mm, 8890 mm | 0.085694 | 0.029688 | 0.003884 | 0.744995 | 0.000000 | 0.058279 |
| Architecture rise 20 mm, 9500 mm | 0.081716 | 0.014937 | 0.000621 | 0.618164 | 0.000000 | 0.029277 |

B1 has lower full-frame RMSE than B0 for all 11 measured states. Macro 400 mm/f/5.6 B1 RMSE is `0.004879` against Full ×32 and `0.004877` against Full ×64. These are measured renderer comparisons, not perceptual acceptance thresholds. No C1 scene matrix was run.

The native Phase J E2E now enforces `B1 Half ×32 RMSE < B0 Half ×32 RMSE` against the matched Full ×32 reference separately for each of the 11 fixed states above. The assertion rejects missing or non-finite metrics, checks the reference case and pixel count, and confirms identical camera optical state and paired B0/B1 applied state. A regression in any one state therefore fails the test instead of leaving the all-state conclusion dependent on this report table. The review-fix native rerun reproduced the measurements shown above to the reported six decimal places.

## K. Sharp-halo and fallback analysis

The fixture records B1 fallback pixel count, valid far pixels using source fallback, a source-fallback mask, full-frame difference, and depth-edge difference. The valid-far fallback counts range from 92 to 1769 pixels across the 11 states; this is approximately 0.18%–4.46% of the valid far pixels in those states. `fallbackSourceColorMismatchCount` is zero in every B1 case. The largest measured valid-far fallback fraction occurs in the initial Architecture state (1769/39,661, 4.46%).

These diagnostics establish when and where the tested candidate selected its source fallback and whether it returned the source color. They do not separately measure halo width or prove that fallback regions preserve perceptually appropriate blur. Difference and mask artifacts are retained for review.

## L. Near/far composite behavior

Across all 11 paired native B0/B1 operations, source raster RGB RMSE and maximum error are both zero. The Near Target comparison now uses a dedicated complete-RGBA metric; the existing RGB-only image-reference helper retains its original RGB semantics. Across the 49,152 Near Target pixels per state, Near RGB RMSE and maximum error are zero, and Near Alpha RMSE and maximum error are also zero. Thus the measured paired Near Target is exactly unchanged in all four channels for this run.

The Near Target alpha is nontrivial in all 11 states: the number of pixels with coverage alpha greater than `0.02` ranges from 469 (Macro near focus, f/5.6) to 24,217 (Architecture rise plus focus), and maximum coverage is `1` in each state. This confirms the alpha comparison exercises coverage values rather than only an all-zero target. The dedicated comparator rejects mismatched or incomplete RGBA data and non-finite channels, and unit mutation coverage confirms an alpha-only change produces positive alpha error while leaving RGB error at zero. Near/far classifications are present in the native physical field for every selected case. B1 remains a far reconstruction experiment; it does not recover hidden background geometry or change the research composite contract.

| State | Near Target pixels | Coverage pixels (alpha > 0.02) | Maximum alpha | Near RGB RMSE / max | Near alpha RMSE / max |
|---|---:|---:|---:|---:|---:|
| Macro near, f/5.6 | 49,152 | 469 | 1 | 0 / 0 | 0 / 0 |
| Macro middle, f/5.6 | 49,152 | 939 | 1 | 0 / 0 | 0 / 0 |
| Macro far, f/5.6 | 49,152 | 1,487 | 1 | 0 / 0 | 0 / 0 |
| Macro middle, f/16 | 49,152 | 939 | 1 | 0 / 0 | 0 / 0 |
| Interior initial | 49,152 | 21,093 | 1 | 0 / 0 | 0 / 0 |
| Interior front swing | 49,152 | 21,849 | 1 | 0 / 0 | 0 / 0 |
| Interior swing + focus | 49,152 | 22,479 | 1 | 0 / 0 | 0 / 0 |
| Interior rise + swing | 49,152 | 19,295 | 1 | 0 / 0 | 0 / 0 |
| Architecture initial | 49,152 | 23,206 | 1 | 0 / 0 | 0 / 0 |
| Architecture rise | 49,152 | 15,705 | 1 | 0 / 0 | 0 / 0 |
| Architecture rise + focus | 49,152 | 24,217 | 1 | 0 / 0 | 0 / 0 |

## M. Radius-cap sensitivity

Macro's largest tested unclamped gather radius is `2.410 px` at f/5.6 and `0.540 px` at f/16; the tested Interior maximum is `3.276 px`, and Architecture maximum is `0.927 px`. No valid pixel activated the 12 px cap in any reported state. The Macro far-focus B1 operation was repeated with a 32 px cap: the raw physical-footprint fingerprint and maximum CoC stayed identical, and cap activation remained zero. A 60 px cap was not run. Since none of these cases reaches 12 px, this run does not establish B1 quality for large production-sized blur footprints.

## N. Performance and resources

Native browser observations are recorded per operation: operation wall time, readback wall time, per-stage CPU submission, observed queue completion, queue wait, and pass count. Full ×32 operations record 10 stages including Phase H diagnostics; B1 operations record 12 stages, with two additional candidate reconstruction/composite stages. At 512 × 384 source and 256 × 192 gather resolution, the fixture estimates `11.25 MiB` for its research target set, including Phase H provenance targets. This is an allocation estimate, not driver-reported memory.

These are one-shot browser/queue/readback observations from sequential cases. Operation wall time varied materially with case/order and includes setup, submission, queue waits, readback, and diagnostic work. `gpuTimestampDurationMs` is `null`; no isolated GPU shader timing or production FPS is inferred.

Across the 11 matched 12 px states, the latest native run recorded:

| Path | Operations | Operation wall median (range), ms | Readback median (range), ms | Sum of per-stage CPU submission median (range), ms | Sum of observed per-stage queue completion median (range), ms | Stages | Target estimate |
|---|---:|---:|---:|---:|---:|---:|---:|
| Full ×32 | 11 | 194.6 (135.1–290.2) | 5.8 (3.2–15.5) | 2.2 (1.7–25.3) | 24.2 (15.9–119.5) | 10 | 11.25 MiB |
| B1 Half ×32 | 11 | 214.5 (161.2–300.9) | 3.5 (3.2–10.9) | 2.0 (1.5–4.2) | 22.5 (19.2–87.8) | 12 | 11.25 MiB |

B1 adds the two compatible-far reconstruction/composite stages. Queue values are sums of the fixture's observed per-stage intervals, not isolated GPU execution durations; the estimate includes the Phase H provenance targets. The additional Macro 32 px cap run is excluded from this 11-state table.

## O. Lifecycle and regression

The native Macro test uses the fixture's HashRouter to leave `/experiment` for `/away` and return without replacing the browser document. It asserts the old native renderer handle, source target, and Macro subject resources are disposed, all owned resource records become disposed, cleanup has no error, and a new generation with a distinct handle renders content before a second cleanup. The document `performance.timeOrigin` is checked across both route changes. Runtime identity is asserted as `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`, and Three.js `186`.

The unit adapter suite covers Macro conjugate geometry and focus stations, aperture scaling, Observer/capture-camera separation, movement geometry, and the Interior/Architecture state matrix. The final combined Phase C–J native run passed **28 tests**, with **5 ordinary-Chromium controls skipped by the native-only project**. This includes the Phase C Raw RTT path, Phase D storage, Phase E classification, Phase F aperture gather and crop, Phase G quality study, Phase H reconstruction, Phase I order-isolation benchmark, and both Phase J tests. Runtime assertions required `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`, and Three.js revision 186.

For this review-fix round, the focused native Phase J spec passed **2 tests** with its ordinary-Chromium control skipped by the native-only project. Its 11-state quality assertions all passed, including all 7 Interior/Architecture B1-vs-B0 comparisons, and all 11 Near RGBA comparisons reported zero RGB and alpha error with 49,152 pixels each. The updated surface-aware reference unit suite passed **12 tests**, including identical RGBA, alpha-only mutation, RGB-only mutation, mismatched/incomplete dimensions, and non-finite input cases. A temporary native diagnostic alpha-only mutation also failed the Near alpha invariance assertion while RGB remained unchanged; it was removed before final validation.

The current cross-phase rerun was executed as separate native invocations: Phase C–I passed **26 tests**, with **4 ordinary-only cases skipped**, and Phase J passed **2 tests**, with **1 ordinary-only case skipped**. Together these reruns cover the same 28 native tests and 5 native-project skips reported by the earlier combined C–J run, while the Phase J review-fix assertions were independently exercised at the current source state. Ordinary Chromium Phase J separately passed **1 compatibility test**, with **2 native-only tests skipped**; it reported WebGL2 fallback and is not native evidence.

The first combined regression run exposed a real fixture regression: the Phase J extension read the crop flag before applying the current operation's `crop` input, so a newly requested crop rendered at full-film dimensions. The fixture now applies the operation input before selecting the camera view offset and sampled film size. The five affected native Phase F–I crop/order tests passed after the correction, and the complete combined suite passed on the corrected code.

The separate ordinary Chromium Phase C–J controls passed **15 tests**, with **18 native-only tests skipped**. The fixture reported WebGL2 fallback and these runs are compatibility checks, not native execution evidence. The production-preview isolation suite passed **2 tests**; public routes continued to keep Ground Glass on WebGL and did not request the experimental WebGPU modules.

Temporary mutation checks were run and reverted. Removing the millimetre-to-metre film-point conversion caused native output evidence to fail (valid far source-fallback pixels dropped to zero); reversing the applied lens normal produced zero valid depth pixels; displacing the applied film point by 1 mm produced a `0.109845 mm` reconstructed CoC error against the `0.001 mm` bound; removing the Macro near probe reduced the required probe count from three to two; and bypassing B1 source-color fallback produced 1,014 fallback/source mismatches. In this review-fix round, replacing the `interior-initial` B1 RMSE comparison value with the B0 value (`0.03625687`) failed the strict less-than assertion because the values were equal. A temporary `+0.01` Near alpha change failed the native alpha RMSE threshold (`0.00004511` observed) while RGB error remained zero. Both mutations were removed and the clean native suite passed again. These failures show that the corresponding unit, orientation, focus, probe-presence, fallback, B1-reference, and complete Near RGBA assertions detect the injected defects.

Repository validation for this review-fix passed: `npm test` (**273 files / 2,530 tests**), `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`. The report and source diff also passed `git diff --check`.

## P. Known limitations

- Interior known focus target positions do not match the surface at their projected raster pixels; the observed 100–127 mm position mismatch limits target-specific sharpness claims.
- Architecture façade sampling is about 11 mm from its canonical target.
- Factory materials are retained, but the fixture uses test ambient/directional lighting and no production scene lighting/exposure pipeline.
- Full-resolution references are finite aperture-sample outputs, not ideal optical ground truth. Full ×64 is limited to Macro at 400 mm/f/5.6.
- C1 is not compared on representative scenes.
- Fallback masks and edge RMSE are measured, but halo width and perceptual blur suppression are not independently scored.
- Only 12 px and one 32 px radius-cap condition were run; no state activates the 12 px cap, and 60 px was not tested.
- Hidden/disoccluded background recovery, production Image Circle/vignetting parity, production materials/lighting, complete DOF/CoC integration, other GPU adapters, hardware acceleration, and public simulator routing remain unverified.
- Native evidence is for the tested headed Chrome/adapter only. Renderer disposal evidence covers owned fixture resources; it cannot prove immediate physical GPU-memory reclamation.

## Q. Next-phase recommendation

Keep B1 as the leading reduced-resolution candidate for further testing: it improved matched full-frame RMSE over B0 in all measured cases, while preserving source and near-gather outputs. Do not begin production Ground Glass integration from this evidence alone. First resolve Interior focus-target-to-raster correspondence, add an edge-local halo/blur-suppression measure, and test at least one large-radius state that actually reaches the configured cap. A future integration-design PR should remain separate and should make no claim of production material, Image Circle, or full DOF parity without new evidence.

## R. Reproduction

The native-only route is available only in this fixture and is gated by `?phaseJ=1`.

```bash
# Native Three.js r186 WebGPU, headed Chrome
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-b1-optical-validation.spec.ts \
  --project=chrome-native-webgpu --workers=1

# Ordinary Chromium compatibility control (not native evidence)
npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-b1-optical-validation.spec.ts \
  --project=chromium --workers=1

# Canonical optical-state adapter tests
npm test -- src/tests/unit/groundGlassWebGpuOpticalStateAdapter.test.ts

# Near Target RGBA comparison and surface-aware reference tests
npm test -- src/tests/unit/groundGlassWebGpuSurfaceAwareFarReference.test.ts

# Phase C–I native regression set in this review-fix run (26 passed; 4 ordinary-only skips)
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts \
  src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts \
  src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts \
  src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts \
  src/tests/e2e/ground-glass-webgpu-gather-quality.spec.ts \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction.spec.ts \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction-i.spec.ts \
  --project=chrome-native-webgpu --workers=1

# Phase J was rerun separately above (2 passed; 1 ordinary-only skip)

# Public-route / production-bundle isolation
npm run test:e2e -- --config=playwright.production.config.ts \
  src/tests/e2e/architecture-rise-webgpu-production.spec.ts \
  --project=chromium-production-preview --workers=1
```

Native JSON and PNG evidence is written under the ignored `test-results/ground-glass-webgpu-phase-j/` directory and attached to the Playwright report. The Phase J worktree started from base `7a03796465d13a81dec7aa4d5d390584e271c881`; the implementation HEAD is recorded in the PR handoff.
