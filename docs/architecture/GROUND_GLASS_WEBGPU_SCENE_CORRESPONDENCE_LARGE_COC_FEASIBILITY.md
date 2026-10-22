# Ground Glass WebGPU Scene Correspondence and Large-CoC Feasibility

**Status:** bounded native research result; no production renderer changes
**Base:** Phase J merge `b3e4814d1df71f4382f9857eafc2684389ec8f59`
**Runtime tested:** Three.js r186 `WebGPURenderer`, native `webgpu`, application fallback `false`

## A. Executive conclusion

| Research track | Result | Conclusion |
|---|---|---|
| Scene-point correspondence | **FEASIBLE — attributed for the seven tested Interior/Architecture states** | The large Interior residuals are occlusion by the first visible mesh surface. Architecture Rise's approximately 10 mm difference is the intentional anti-z-fighting target offset plus pixel-center/raster displacement. GPU depth reconstruction agrees with the first ray/mesh hit. |
| Large-CoC B1 quality | **PARTIALLY FEASIBLE — bounded evidence** | The test creates a real 12 px cap region and B1 is closer than B0 to matched full-resolution output. The capped population is small and touches the raster edge; one Macro case cannot establish general large-CoC quality. B1 remains a research candidate. |

The correspondence audit does not justify moving canonical focus targets or changing scene geometry. The cap study supports further bounded B1 quality work, but not production integration. The next useful test is a second optically valid Macro crop/pan that places a larger capped depth-edge region wholly inside the raster.

## B. Phase J baseline

Phase K is based on merged Phase J PR #280 (`b3e4814d1df71f4382f9857eafc2684389ec8f59`). Phase J verified native camera/film state, depth-derived physical footprints and B1-versus-full-reference behavior. It left two evidence gaps: focus-target/raster residuals were not attributed to visibility, and the tested maximum pixel radius did not activate the 12 px clamp. Phase J's approximate Interior 100–127 mm and Architecture 10.9 mm values are historical observations; Phase K remeasured them with a globally fixed readback convention and first-visible-surface evidence.

## C. Readback coordinate audit

The fixture renders a GPU-authored source-identity image into the same target family and compares `readRenderTargetPixelsAsync()` output against known `(x, y)` source coordinates. For each 512 × 384 calibration operation:

| Candidate row convention | Identity mismatches |
|---|---:|
| Fixed top-origin | 0 / 196,608 |
| Vertically flipped / bottom-origin | 196,608 / 196,608 |

The research fixture therefore uses one fixed top-origin array-row convention for source, depth, world-position and physical diagnostic indexing. It does not select an orientation per focus target by minimizing its expected-point error. Source-pixel locations are top-origin, integer pixels identify texels, and projected coordinates retain continuous, integer-pixel and pixel-center values separately. This convention is measured for the tested native r186 path; it is not a claim about every renderer/readback API. Raw target arrays are kept distinct from the browser canvas/display orientation.

## D. Focus-target semantics

Interior Corner focus points are teaching targets positioned 18 mm inward from the side-wall datum; they are not guaranteed to coincide with the first camera-visible surface. Architecture Rise places its facade focus target 10 mm in front of the facade to avoid z-fighting. That target is a deliberately displaced teaching/focus probe. Neither target definition was changed.

## E. Geometry ray-intersection evidence

For each of seven optical states, the test projects each canonical target through the actual capture-camera world and projection matrices, casts a ray through the selected pixel center against the registered subject proxy, and compares the first eligible hit with native GPU depth/world-position readback. Records include the target in millimetres/metres, camera-space/clip/NDC coordinates, continuous and pixel-center coordinates, ray origin/direction, hit object/face, hit depth/position, GPU depth/position, and residual attribution.

The independent matrix calculation agrees with the existing canonical projection helper for every tested target. Pixel-center quantization is 0.256–0.552 source pixels (the bound is √0.5 px). GPU reconstructed positions are 0.05–0.410 mm from the first ray intersection, and along-ray distance agrees within the 0.5 mm test bound. The GPU point and first hit produce matching surface classifications. These measurements separate screen-pixel quantization from 3D target-to-surface distance; the whole target-to-GPU residual is not treated as a projection error.

## F. Interior Corner correspondence

All three focus targets in all four states classify as **C — Occluded target**: initial, front swing, front swing plus focus, and rise plus swing. The projected pixel's first visible geometry is an intervening wall/detail surface, so its depth cannot represent the hidden canonical target. Across those probes, target-to-first-hit distances range from 99.82 to 126.90 mm; GPU-to-first-hit distances remain below 0.5 mm. The measured residual is explained by visibility/occlusion, not by a 100 mm camera error or an incorrectly moved focus marker. The target's separate documented 18 mm side-wall offset remains part of its semantics and is not confused with the much larger occluder distance.

## G. Architecture Rise correspondence

The building mid-facade target in initial, rise, and rise-plus-focus states classifies as **B — Deliberately offset teaching target**. The first visible surface is the facade focus crosshair; measured target-to-hit distances are 11.160–11.197 mm, within 1.2 mm of the documented 10 mm offset. GPU-to-hit distance is approximately 0.306 mm. The target is intentionally offset; no geometry realization or projection correction is indicated.

## H. Surface-specific optical probes

The visible intersections above are promoted to surface-verified probes only after the ray/mesh and GPU depth checks pass. The canonical CPU `computePhysicalBlurFootprint()` result is evaluated at each actual visible hit, independently of the focus-target value. GPU-versus-CPU signed CoC and major-radius differences stay below 0.001 mm for all accepted probes. This validates the physical kernel at the reconstructed visible surface; it does not claim that an occluded target's own depth was rendered. Focus-specific image quality is not inferred from target alignment alone.

## I. Large-CoC feasibility

The stress state uses the canonical `macro-focus-middle-f5_6` case, f/5.6, 400 mm focus, 512 × 384 source, 32 aperture samples, and a modeled 16× centered inspection crop. The sampled film is 7.9375 × 6.35 mm (127 × 101.6 mm divided by 16). `configureGroundGlassCamera()` applies the crop to the capture projection; the same crop state is used for source/depth and gathering. No CoC texture multiplier or inconsistent lens/film/subject movement is used.

The study keeps these stages explicit: S0 full-film continuity at cap 12; S1 cropped full ×32/×64 and half B0/B1 references at cap 60; S2 identical crop and optics at cap 12; S3 the same optical crop at cap 32. The cap is the changed variable between S1/S2/S3. All paths use the same scene, source resolution, focus, aperture, source/depth projection and physical storage contract within a matched state.

## J. Optical invariants

For the `macro-depth-middle` known point, the full-film and 16× cropped operations both reconstruct a valid nearby pixel-center surface (world-position errors 0.219 mm and 0.013 mm). Canonical CPU CoC is 0 mm in both. GPU CoC is −0.000004590 mm, with both ellipse semi-axes 0.000002265 mm and orientation 0 rad in both readbacks. The source pixel moves from `(256, 180)` to `(256, 10)`; the physical footprint does not gain crop magnification.

Across S1/S2/S3, the raw RGBA16F physical fingerprint is identical while only the renderer radius cap changes. The maximum physical CoC is 0.765137 mm and maximum physical semi-axis is 0.382568 mm. The uncapped source-space maximum radius is 24.672 px (CPU ellipse calculation 24.677 px). Clamping changes sampling axes only: a selected S2 sample scales by 0.486084 on GPU versus 0.486280 in the CPU diagnostic, reaches 12 px, and preserves orientation with 0 rad modulo π.

## K. Radius-cap activation

| State | Configured cap | Maximum unclamped radius | Capped valid pixels | Capped fraction | Near / far capped |
|---|---:|---:|---:|---:|---:|
| S0, full film | 12 px | 1.542 px | 0 | 0 | 0 / 0 |
| S1, cropped reference | 60 px | 24.672 px | 0 | 0 | 0 / 0 |
| S2, same crop/optics | 12 px | 24.672 px | 218 | 0.001109 | 0 / 218 |
| S3, same crop/optics | 32 px | 24.672 px | 0 | 0 | 0 / 0 |

All 218 S2 cap pixels contain nonblack scene color; 38 lie on detected depth boundaries and 112 are interior pixels. The largest connected component has 109 pixels over a 19 × 11 px bounding box at the lower-left raster edge; a mirrored component appears on the opposite side. This is more than an isolated pixel and includes scene/depth-edge content, but it is still a small edge strip rather than a large central capped surface. The cap therefore demonstrably executes, while stress coverage remains limited.

## L. B0/B1 reference quality

The Full ×32/×64 comparison in S1 has 196,608 pixels, full-frame RGB RMSE 0.0001344 and maximum channel error 0.003174. This establishes close finite-sample agreement for the tested reference pair; neither reference is photographic ground truth.

| State/path | Full-frame RGB RMSE | Valid far RGB RMSE | Depth-edge RGB RMSE |
|---|---:|---:|---:|
| S1 cap 60, B0 half ×32 vs Full ×32 | 0.061182 | 0.006642 | 0.092037 |
| S1 cap 60, B1 half ×32 vs Full ×32 | 0.003389 | 0.005218 | 0.005104 |
| S2 cap 12, B0 half ×32 vs Full ×32 | 0.061182 | 0.006642 | 0.092037 |
| S2 cap 12, B1 half ×32 vs Full ×32 | 0.003389 | 0.005218 | 0.005104 |

B1 is numerically closer than B0 in these matched metrics, including at the S2 cap. The source-to-output signal-weighted spatial spread proxy in S2 is 165.001 px for Full ×32, 158.222 px for B0, and 161.657 px for B1; B1's signal-energy ratio is 1.141 relative to Full ×32. This proxy describes image-space luma-change covariance, not an optical PSF. The result supports B1 over B0 for this controlled state, not a general quality guarantee.

## M. Sharp-halo and fallback behavior

In S1/S2/S3, B1 uses source-color fallback on 331 far pixels. The independent source comparison finds zero RGB mismatches. All 331 are within the 0–1 px detected depth-boundary band; none are in the 2–4, 5–8, or 9+ px bands. Nineteen are classified as sharp background fallback by the test's explicit 0.01 luma-change threshold. `farFallbackBeyondBoundaryPx` is 0 and `farHaloWidthPx` is 0 under the documented distance/threshold definition. The total nonnegative blur-suppression sum and the 0–4 px boundary luma-discrepancy sum are each 0.983282 linear-luma units over the fallback pixels. These are unnormalized sums, not percentages; the boundary discrepancy is not by itself proof of foreground-color contamination. The maximum localized RGB error is retained in the JSON artifact. No broad halo away from the measured boundary is observed in this fixture, but natural-material and interior-boundary behavior remain untested.

## N. Near RGBA preservation

The matched S2 B0/B1 near target contains 49,152 pixels. RGB RMSE/max error and alpha RMSE/max error are all exactly 0. Near alpha coverage is 24,619 pixels with maximum alpha 1.0. The large-CoC far reconstruction therefore leaves the near RGBA output unchanged for this operation pair. S2 has no near-side pixels reaching the 12 px cap; near blur remains present and is evaluated separately from far contamination.

## O. Performance and resources

The final restored-code native run recorded one serialized operation per state/path (`n=1` each); no medians or observed ranges can be estimated. The Phase H provenance and diagnostic passes remain enabled and are included. CPU submission sums and queue-completion sums are reported from per-stage diagnostics. These are browser/queue/readback observations, not isolated GPU shader times; `gpuTimestampDurationMs` is `null`.

| State / path | Operation wall | Readback wall | Summed CPU submission | Summed observed queue completion | Diagnostic stages | Estimated target memory | Owned resources |
|---|---:|---:|---:|---:|---:|---:|---:|
| S0 Full ×32 | 407.8 ms | 14.0 ms | 26.1 ms | 135.9 ms | 10 | 13.50 MiB | 42 |
| S0 Half ×32 B0 | 230.0 ms | 6.0 ms | 4.3 ms | 33.8 ms | 10 | 11.25 MiB | 42 |
| S0 Half ×32 B1 | 314.1 ms | 7.2 ms | 4.3 ms | 45.7 ms | 12 | 11.25 MiB | 42 |
| S1 Full ×32 | 457.3 ms | 10.6 ms | 1.9 ms | 46.4 ms | 10 | 13.50 MiB | 42 |
| S1 Full ×64 | 430.9 ms | 5.0 ms | 1.1 ms | 43.0 ms | 10 | 13.50 MiB | 42 |
| S1 Half ×32 B0 | 327.5 ms | 9.6 ms | 2.1 ms | 48.1 ms | 10 | 11.25 MiB | 42 |
| S1 Half ×32 B1 | 360.8 ms | 4.7 ms | 2.3 ms | 72.6 ms | 12 | 11.25 MiB | 42 |
| S2 Full ×32 | 449.5 ms | 12.0 ms | 2.0 ms | 129.2 ms | 10 | 13.50 MiB | 42 |
| S2 Half ×32 B0 | 581.5 ms | 18.9 ms | 2.1 ms | 159.9 ms | 10 | 11.25 MiB | 42 |
| S2 Half ×32 B1 | 654.7 ms | 30.7 ms | 2.3 ms | 208.2 ms | 12 | 11.25 MiB | 42 |
| S3 Full ×32 | 656.5 ms | 22.0 ms | 2.0 ms | 243.4 ms | 10 | 13.50 MiB | 42 |
| S3 Half ×32 B1 | 475.2 ms | 3.4 ms | 2.0 ms | 97.6 ms | 12 | 11.25 MiB | 42 |

B1 uses two additional diagnostic stage records (`phase-h-compatible-far-reconstruction` and `phase-h-candidate-composite`) relative to B0. The target estimator reports total fixture target memory, including research targets, rather than an isolated incremental B1-only allocation; no separate extra-target byte estimate is claimed. These estimates are not driver-memory measurements. Variability and diagnostic overhead make the one-shot data unsuitable for production FPS claims or hardware performance ranking.

## P. Lifecycle and regression evidence

Phase K adds no new GPU resource owner; it uses the Phase J serialized handle and registered scene subjects. The native Phase K tests completed correspondence and stress operations on one active handle. The Phase C–J native regression run covered renderer retirement, held/rejected readback, failure cleanup, remount, Phase D storage, Phase E validity/CoC, Phase F aperture gathering, Phase G quality, Phase H/I far reconstruction, and Phase J optical-state contracts: **28 passed, 5 ordinary-Chromium controls skipped** across 33 tests. During integration, applying Phase K's fixed top-origin convention to the shared older CPU-reference probe builder caused the Phase F/G pixel comparisons to fail. The readback policy is now conditional: Phase K uses its identity-calibrated top-origin mapping; earlier phases retain their established per-handle evidence mapping. The focused Phase F/G rerun passed **5 tests with 2 ordinary-Chromium controls skipped**. The full C–J rerun then passed with no failures.

All eight requested negative controls were checked. Temporary mutations were restored before final validation: changing the readback origin to bottom failed the top-origin contract; shifting projected X by one pixel failed the fixed projected-pixel expectation; passing millimetres as metres in the native point record failed the `worldM × 1000 = worldMm` assertion; selecting the second ray intersection caused `SURFACE_VERIFIED` to fail; doubling the sampled-film width in the pixel mapping failed its fixed `512/36` reference; doubling the cap denominator failed the 12 px scale expectation; ignoring alpha in the Near RGBA comparator failed the alpha-only control; and suppressing fallback mismatch counts failed the corrupted-source-pixel control. These mutations were not committed. The final unit/E2E runs use the restored implementations.

## Q. Known limitations

- Hidden/background pixels revealed by large blur are unavailable to the single-layer source and cannot be reconstructed by B1.
- Capped pixels are only 0.11% of valid pixels and are concentrated at the raster edge in this one Macro state.
- The scene has sparse near-layer coverage; the near layer did not itself reach the radius cap.
- Results use RGBA16F physical storage and finite 32/64 aperture proposals.
- Production scene lighting/material parity, Image Circle/vignetting, exposure, and production Ground Glass compositing are not tested.
- Only the tested native Chrome/adapter path is measured. This does not qualify other adapters or prove hardware acceleration.
- Queue completion and readback timers are not GPU timestamps.
- There is no public simulator router integration or production WebGPU Ground Glass backend.

## R. Next-phase decision

Correspondence is understood for the seven tested states, so K-A is **FEASIBLE**. Large-CoC cap execution and B1-vs-B0 behavior are demonstrated, but coverage is **PARTIAL** because the cap population is small and edge-concentrated. Before an architecture-integration design, add one bounded Macro crop/pan state that creates a larger capped depth-edge region inside the raster while preserving the same canonical optical state; retain the same matched Full ×32/B0/B1 comparison and near RGBA checks. No production migration is authorized by this report.

## S. Reproduction and evidence

Focused native Phase K run:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-correspondence-large-coc.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

Ordinary Chromium fallback control:

```bash
env -u OBSERVER_NATIVE_WEBGPU_REQUIRED npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-correspondence-large-coc.spec.ts \
  --project=chromium --workers=1 --grep 'ordinary Chromium'
```

The current native Phase K run passed **2 native tests** (the ordinary-Chromium control was skipped in the native project); the separately run Chromium control passed **1 test** and reported the expected WebGL2 fallback. The native run reported `webgpu-renderer`, `webgpu`, `applicationFallback=false`, and Three.js `186`.

Phase C–J native regression command:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts \
  src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts \
  src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts \
  src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts \
  src/tests/e2e/ground-glass-webgpu-gather-quality.spec.ts \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction.spec.ts \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction-i.spec.ts \
  src/tests/e2e/ground-glass-webgpu-b1-optical-validation.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

The Phase C–J command completed with **28 passed, 5 skipped**. The skips are ordinary-Chromium compatibility controls excluded by the native-required project. Production-preview isolation ran separately with `--config=playwright.production.config.ts`; both Architecture Rise WebGL-isolation and Anatomy WebGPU-denial tests passed (2/2).

The focused Phase K unit command is:

```bash
npm test -- src/tests/unit/groundGlassWebGpuCorrespondenceLargeCoc.test.ts
```

It passed all 8 tests after the negative-control mutation checks were restored. Repository-wide unit/integration, typecheck, lint, CSS, and build results are recorded in the PR handoff.

The native run requires the repository's headed Chrome WebGPU setup and must report `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`, and Three.js revision `186`. Ordinary Chromium reported the expected WebGPU-unavailable/WebGL2 fallback warning and is not native evidence. JSON measurements, readback arrays, and PNGs are written under ignored `test-results/ground-glass-webgpu-phase-k/`; no generated raster collection is committed.

Relevant references: [Phase J optical validation](GROUND_GLASS_WEBGPU_B1_OPTICAL_STATE_VALIDATION.md), [Phase I far reconstruction](GROUND_GLASS_WEBGPU_SURFACE_AWARE_FAR_RECONSTRUCTION_FEASIBILITY.md), [Ground Glass coordinate contract](GROUND_GLASS_COORDINATE_CONTRACT.md), and [physical DOF convergence](../DOF_FOCUS_PHYSICS_CONVERGENCE.md).
