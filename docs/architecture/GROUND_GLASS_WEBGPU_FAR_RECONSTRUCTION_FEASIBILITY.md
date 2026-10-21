# Ground Glass WebGPU Far Reconstruction Feasibility

**Status:** bounded Phase H research; production Ground Glass remains WebGL-only.
**Base:** merged Phase G PR #277, `52fc1fa35ce4c10947567d891a73784ba2cc4135`.
**Native run:** headed Chrome 155, Three.js r186; mounted runtime reported `rendererFamily=webgpu-renderer`, `executionBackend=webgpu`, `applicationFallback=false`. Adapter identity and hardware acceleration were not established.
**Overall result:** **PARTIALLY FEASIBLE**.

## A. Executive conclusion

The native experiment now traces the 36 half-resolution far-red leakage pixels to a valid near-foreground gather center being reconstructed onto a full-resolution blue/background source pixel. The actual source-to-gather selection and selected-center provenance matched the GPU composite's diagnostic IDs. The leakage is therefore consistent with insufficient low-resolution spatial representation at the foreground boundary, rather than a wrong source-to-gather formula or a far-gather sample classified as a valid far surface. All 36 reproduced pixels were Class A; Classes B–E had zero observations in this controlled scene.

An independently computed CPU reference agrees with native gather, baseline reconstruction, and candidate output within the measured tolerances. A bounded center-compatible far reconstruction removes the measured far-red gather contribution, but it also removes roughly 82–86% of the fixture's far-yellow spread at half resolution. It therefore fails the blur-preservation requirement and is **rejected as a viable reconstruction policy**. The near layer is intentionally unchanged; at some of the same source positions, the final research composite can still receive red near-layer contribution. The candidate is a far-layer diagnostic, not a claim that the complete image is artifact-free. The unchanged Phase G baseline remains the comparison reference. No production algorithm or renderer behavior changes.

## B. Phase G baseline

Phase G is available as the parent commit `52fc1fa35ce4c10947567d891a73784ba2cc4135`. Its controlled native case uses a 128 × 96 source, 36 × 24 mm film, f/2 aperture, 12 px maximum CoC radius, linear deterministic color, nearest sampling, full-resolution physical CoC, and 16, 32, or 64 aperture proposals. Full gather is 128 × 96; half gather is 64 × 48.

The untouched Phase G native baseline run reported zero classified far-red leakage pixels for full ×32 and 36 for half ×16/×32/×64. The half ×32 leakage energy was 33.2896728515625. The near-blue leakage count was zero. All 36 pixels were one source pixel from the sharp red foreground mask. The prior baseline run is retained as historical Phase G evidence; Phase H reproduced those measurements before evaluating the candidate.

## C. Native coordinate contract

Diagnostics use top-origin integer source and gather pixel IDs. TSL samples textures with `vec2(uv().x, 1 - uv().y)`; targets use nearest filtering, clamp-to-edge, and no mipmaps. Native readbacks are converted to top-origin arrays before CPU comparison. Source-to-gather selection is the GPU composite's observed selected gather ID, compared independently with the source-pixel-center mapping. A separate GPU identity/provenance pass records the source texel actually selected at each gather center.

Across the full 128 × 96 source, source identity, gather coordinates, selected-gather formula, selected-center provenance, and bounds checks had zero mismatches. Full-resolution gather-center source IDs matched the nominal pixel-center formula. At half resolution, 384 of 3,072 gather-center IDs differed from the nominal source-center formula by one source pixel, with no out-of-bounds IDs and a maximum deviation of one pixel. CPU gather calculations use those observed native gather-center IDs, rather than assuming the nominal formula. This small native raster/sample-boundary deviation is preserved as measured behavior; it did not produce selected-gather or selected-center provenance mismatches.

## D. Root-cause classification

The per-pixel diagnostic assigns a leak to Class A when the source pixel is background, the selected gather mapping agrees with the GPU provenance, the gather-center validity code is valid, and that center has near-side signed CoC. Class B would indicate a far center whose far gather contains foreground color; Class C a source/gather coordinate disagreement; Class D invalid or unresolved surface handling; Class E other or unresolved provenance.

| Gather | Class A | Class B | Class C | Class D | Class E | Total |
|---|---:|---:|---:|---:|---:|---:|
| Full ×32 | 0 | 0 | 0 | 0 | 0 | 0 |
| Half ×16 | 36 | 0 | 0 | 0 | 0 | 36 |
| Half ×32 | 36 | 0 | 0 | 0 | 0 | 36 |
| Half ×64 | 36 | 0 | 0 | 0 | 0 | 36 |

The half-resolution axis-aligned leak pixels occupied top-origin row 26, columns 68–103. Mean and maximum Manhattan distance to the sharp foreground were both 1 px. A representative pixel had blue source color `(0.025, 0.080, 0.850)`, positive source CoC `+0.9258 mm`, and mapped to a valid red near-center at `(69, 27)` with signed CoC `−1.5615 mm`. The center's raw/fallback red value was reused at the blue source pixel. The selected low-resolution result therefore had a valid foreground center but an incompatible full-resolution background destination. The near layer at that same selected texel had red alpha 1, so the far-layer diagnostic does not imply the final composite's red at that point came only from the far layer.

This supports a foreground-boundary representation/reconstruction mismatch. It does not establish that the gather kernel itself is generally incorrect, and the result is specific to this controlled scene and nearest-sampled grid.

The native far target's selected values, the GPU source-to-gather IDs, the gather-center source IDs, near color/alpha, composite values, depth, validity, and signed CoC are included in the bounded per-pixel diagnostics. The fixture writes machine-readable diagnostics as Playwright output/attachment; full-frame arrays are not committed.

## E. Low-resolution gather correctness

The CPU reference independently recomputes golden-angle aperture proposals, physical ellipse-to-source-pixel mapping, depth acceptance, and RGB accumulation from GPU-read-back color, depth/world, physical-footprint, and validity inputs. It uses actual GPU-observed gather-center source IDs. Native gather versus CPU maximum per-channel RGB errors were:

| Configuration | Gather texels compared | Maximum RGB error | Mean RGB error |
|---|---:|---:|---:|
| Full ×32, 128 × 96 | 12,288 | 0.0004883 | 0.00000187 |
| Half ×16, 64 × 48 | 3,072 | 0.0004865 | 0.00000151 |
| Half ×32, 64 × 48 | 3,072 | 0.0004883 | 0.00000195 |
| Half ×64, 64 × 48 | 3,072 | 0.0004883 | 0.00000121 |

These are numerical comparisons in the controlled linear-color fixture, not perceptual scores. They show close gather-kernel agreement for the tested states while leaving the separate question of reconstructing a low-resolution gather onto a finer surface.

## F. Reconstruction correctness

The CPU reconstruction independently applies the observed native gather IDs to each full-resolution source pixel, then composites the near result using the corresponding native near target and coverage alpha. Maximum RGB errors against the native baseline composite were 0.0001341 for full ×32, 0 for half ×16, 0.0001341 for half ×32, and 0.0001966 for half ×64. The zero in the half ×16 case is a measured exact match for this fixture/configuration, not a general guarantee.

This agreement confirms the CPU reference reproduces the existing nearest source-grid reconstruction and composite. It does not make the baseline boundary result physically correct: the same low-resolution far value is intentionally selected for multiple source pixels, including background pixels adjacent to the foreground.

## G. Candidate design

One research-only candidate checks the selected gather texel's recorded center source texel. It samples that center's full-resolution validity and signed CoC. When the center is valid and far-side, it uses the far gather result; otherwise it falls back to the full-resolution source color. The existing near gather and near-alpha composite remain independent and unchanged. The CPU reference recomputes the same eligibility decision from native readbacks. GPU/CPU candidate path-code mismatches were zero in the tested A/B cells.

This is a bounded surface-compatibility probe, not a general reconstruction filter. It demonstrates that foreground-center rejection removes the classified leak, but it does not preserve enough legitimate far blur at half resolution. The candidate is rejected for further adoption in its current form. No larger neighbor search, changed gather, or production behavior is included.

## H. A/B image quality

| Gather | Baseline far-red leaks / energy | Candidate far-red leaks / energy | Baseline far-yellow spread pixels / energy | Candidate far-yellow spread pixels / energy | Energy retained |
|---|---:|---:|---:|---:|---:|
| Full ×32 | 0 / 0 | 0 / 0 | 71 / 20.631 | 71 / 20.631 | 100% |
| Half ×16 | 36 / 33.290 | 0 / 0 | 178 / 125.177 | 58 / 17.515 | 14.0% |
| Half ×32 | 36 / 33.290 | 0 / 0 | 186 / 132.042 | 66 / 24.379 | 18.5% |
| Half ×64 | 36 / 33.290 | 0 / 0 | 186 / 131.028 | 66 / 23.366 | 17.8% |

Leak energy is the fixture's red contribution above the source under its blue-background mask. Far-yellow spread counts/energy use the fixture's deterministic yellow-signal classification; they are comparative diagnostics, not calibrated image-quality metrics. The candidate eliminates all Class A far-red leaks in the half-resolution cases but also erases about 82–86% of this far-spread signal. That is too much blur loss for an acceptable correction.

The near target is reused unchanged in the baseline and candidate composite. Across full ×32 / half ×16 / half ×32 / half ×64, near-red spread was 204 / 36 / 196 / 288 pixels and near-alpha coverage was 1,824 / 1,656 / 1,816 / 1,908 pixels. The near-blue leak count was zero in all four rows. Focused green source mean absolute deviation in the candidate was zero in these measurements. This supports separation of the candidate's far fallback from the existing near foreground contribution for these controlled cases.

## I. Optical invariants

The experiment continues to use the Phase G physical signed CoC, ellipse radii, orientation, and singular-value radius cap unchanged. Phase H adds identity/provenance passes, a bounded source-compatible far reconstruction candidate, CPU diagnostic calculations, and test controls only. It does not change canonical optics, physical millimetre inputs, depth classification, the near gather, or production Ground Glass shaders.

## J. Geometry and crop cases

The native suite retained a horizontal/vertical axis-aligned foreground boundary and added diagonal-edge, thin-foreground, and tilted-film off-center crop cases.

| Case | Baseline far-red leak pixels | Class A | Candidate far-red leak pixels |
|---|---:|---:|---:|
| Axis-aligned half ×32 | 36 | 36 | 0 |
| Diagonal half ×32 | 70 | 70 | 0 |
| Thin foreground half ×32 | 53 | 53 | 0 |
| 12° tilted off-center crop | 0 | 0 | 0 |

The crop sampled a 9 × 6 mm region of the 36 × 24 mm film (4× linear crop). These cases verify the GPU/CPU diagnostic path, coordinate bounds, and candidate execution for those controlled states. The candidate's lack of far-red leaks in the diagonal and thin cases does not establish acceptable image quality because far-yellow spread is substantially reduced. These cases do not establish broad edge quality across arbitrary geometry, production camera states, or materials.

## K. Performance comparison

The half ×32 A/B timing used two warm-ups per path and five measured operations per path, interleaved in one serialized native browser run. It measures operation wall time around rendering, observed queue completion, readback, and diagnostics; it is not a GPU timestamp or production frame-time estimate.

| Path | Measured operation wall times (ms) | Median |
|---|---|---:|
| Baseline | 29.1, 32.3, 25.3, 21.3, 24.7 | 25.3 |
| Candidate | 37.1, 34.9, 33.8, 35.8, 34.0 | 34.9 |

The candidate median was 9.6 ms (38.0%) higher in this run; the five measured ranges did not overlap. Earlier native runs produced materially different medians, so timing remains noisy browser/queue evidence rather than a stable performance estimate. The candidate adds two diagnostic/render passes, and no isolated GPU timestamp was available. This is not a production performance conclusion.

## L. Memory and lifecycle

Phase H allocates two source-sized RGBA32F identity/provenance targets, one gather-sized RGBA32F provenance target, and two source-sized RGBA16F candidate targets. Format-based additional target estimates are 638,976 bytes (about 0.609 MiB) for half gather and 786,432 bytes (0.750 MiB) for full gather; the two source-sized candidate targets account for 196,608 bytes. These estimates exclude browser/driver allocation overhead and are not GPU heap telemetry.

Native lifecycle evidence covers resize, a deliberate failure after the reconstruction pass, resource disposal, SPA navigation away/back, creation of a distinct renderer handle, and successful rendering by the remounted handle. In the latest committed-HEAD run, failed handle `aperture-g1-d4b24649-2400-4b1d-b693-fa19c04664e6` failed after `phase-h-compatible-far-reconstruction`; its owned resources reached disposed state with no cleanup error. SPA return created distinct handle `aperture-g2-37f281aa-9dac-4f83-ba08-7e325b3d2c2c`, which initialized and rendered. This verifies fixture ownership/disposal behavior, not immediate GPU-driver reclamation or absence of all memory leaks.

## M. Remaining limitations

- A single-view gather cannot recover background hidden behind foreground geometry.
- Near coverage remains a sparse-proposal approximation; this experiment does not establish full near-layer quality.
- The tested center-compatible candidate suppresses too much legitimate half-resolution far spread and is rejected.
- Physical footprint storage remains RGBA16F with the Phase D finite-range and precision constraints.
- Gather-radius and quality caps trade work against edge and blur coverage.
- Only one native headed-Chrome WebGPU execution was qualified here; adapter identity and hardware acceleration are unknown.
- Controlled fixture optics are not proof of production camera/film-state parity. Macro and broader representative optical-state coverage remain gaps.
- Materials, lighting, exposure, Image Circle/vignetting, and the full production composite are not tested by this study.
- No matched production WebGL versus native WebGPU visual comparison was performed.
- No isolated GPU timestamp or production frame-rate evidence is available.
- The test-only SPA lifecycle does not prove public simulator router integration.

## N. Next-phase recommendation

Further edge-quality research is needed because the only tested center-compatible candidate removes the measured leak by sacrificing most of the controlled far spread. Representative optical-state validation, including Macro coverage, should be prioritized before claiming scene-level quality. A separately scoped renderer-architecture design phase may assess future integration seams, but this PR does **not** authorize production migration, a Ground Glass WebGPU backend, or DOF shader porting.

## O. Reproduction

Commands used from the Phase H worktree (Node 24 runtime on `PATH` for local commands):

Native Phase H (requires headed Chrome with native WebGPU):

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

Ordinary Chromium control (WebGL2 fallback-compatible only; not native evidence):

```bash
npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-far-reconstruction.spec.ts \
  --project=chromium --workers=1
```

Native Phase C–G regressions:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- \
  src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts \
  src/tests/e2e/ground-glass-webgpu-coc-footprint.spec.ts \
  src/tests/e2e/ground-glass-webgpu-physical-coc.spec.ts \
  src/tests/e2e/ground-glass-webgpu-aperture-gather.spec.ts \
  --project=chrome-native-webgpu --workers=1
```

Production-preview isolation check (the same screenshot stabilization timeout was reproduced at test line 131 on clean `origin/main` `52fc1fa35ce4c10947567d891a73784ba2cc4135`):

```bash
npm run test:e2e -- --config=playwright.production.config.ts \
  src/tests/e2e/architecture-rise-webgpu-production.spec.ts --workers=1
```

Unit test:

```bash
npm exec vitest run src/tests/unit/groundGlassWebGpuFarReconstructionReference.test.ts
```

Machine-readable native Phase H evidence is emitted as the Playwright attachment `phase-h-native-diagnostics.json`; screenshots are attached for the half ×32 baseline and candidate. Artifacts are kept in ignored Playwright output under `test-results/` and are not committed. The latest native attachment was written at `test-results/ground-glass-webgpu-far-re-6c84c-ction-and-bounded-candidate-chrome-native-webgpu/phase-h-native-diagnostics.json`.

Validation completed for this implementation: native Phase H `1 passed, 1 skipped` (the ordinary-browser-only control is skipped in the native project); ordinary Chromium `1 passed, 1 native-only skipped` and explicitly fell back to WebGL2; native Phase C–G regressions `22 passed, 1 skipped`; `npm test` reported 2,514 tests passing across 271 files; typecheck, lint, CSS check, build, and `git diff --check` passed. The production-preview suite had one policy test pass and one screenshot-stabilization timeout at `architecture-rise-webgpu-production.spec.ts:131`; an equivalent run on clean `origin/main` `52fc1fa35ce4c10947567d891a73784ba2cc4135` reproduced the same failure class after policy assertions.
