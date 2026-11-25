# Ground Glass M5T — Adaptive Quadrature and Spatial Blur Validation

**Status:** research-only; no M5Q promotion, M6 quality gate, or production WebGPU authorization.
**Experiment revision:** `ground-glass-m5t-native-review-1`
**Implementation source commit:** `2113ee6f480e9564729b02eba967b01c061d0062`
**Spatial metric revision:** `ground-glass-m5t-spatial-lsf-v2` (review-fix correction; quadrature and native numeric captures are unchanged)
**Machine-readable evidence:** [GROUND_GLASS_M5T_QUADRATURE_SPATIAL_VALIDATION_REPORT.json](GROUND_GLASS_M5T_QUADRATURE_SPATIAL_VALIDATION_REPORT.json)

## Scope and reference definition

M5T adds a pure CPU reference for the limiting conditional Far aperture integral. It keeps that integral distinct from the existing finite M5 estimator: the limiting quantity excludes the estimator's O(1) center sample and is undefined when accepted aperture area is zero. The captured physical ellipse, radius cap, observed gather-center IDs and top-origin UVs, nearest-source-texel convention, physical/depth validity, signed-CoC eligibility, view-distance reconstruction, and depth rejection remain authoritative.

The adaptive path is a deterministic midpoint quadtree over the unit disk's containing square. It subdivides disk, source-texel, and eligibility boundaries and records accepted area/color integrals, conditional means, estimator errors, unresolved area, evaluation count, and depth. Its initial levels are 32, 64, 128, and 256; maximum depth is 12; each pixel is capped at 250,000 evaluations; each study is capped at 128 selected pixels. Error estimates are diagnostic, not certified bounds. Exhaustion is an explicit unresolved result.

An independently traversed 512 × 512 midpoint grid supplies a second numerical path. It shares the physical problem definition, not adaptive nodes or M5S proposal points. A single grid resolution does not establish its own convergence.

## Analytic and controlled evidence

The CPU unit suite now has 31 tests covering the grouped N1–N24 controls and M5T-F1–F12 LSF regressions. The previous combined D/E/F/H/K quadrature test is split into five cases; D/E/F/K use resolution 32, adaptive depth 5, and a test-only 25,000 evaluation budget, and explicitly retain `evaluation-budget-exceeded` classification while checking their ordering/phase distinctions. The source-edge clamp case remains at resolution 32/depth 5 and evaluates 87,580 points. These controls are bounded diagnostic estimates, not convergence evidence. The suite also exercises uniform and affine fields, multiple disk/half-plane offsets, compact silhouettes, depth rejection, ellipse orientation, radius caps, image-edge clamping, texture phase/frequency, small and empty accepted area, fixed-grid independence, spatial profile validity, sharp-source substitution, ROI provenance, and preservation of the M5S/M5Q boundaries.

The native test's uniform synthetic control returned RGB `[0.200000003, 0.400000006, 0.600000024]` for expected `[0.2, 0.4, 0.6]`, with accepted area `3.141677856` and 179,720 evaluations. A separate controlled 11-sample edge fixture measured ESF widths of 4.0 px (10–90%) and 2.5 px (20–80%), LSF FWHM 3.0 px and centroid 4.5 px. Replacing it with the sharp source was classified `sharp-source-substitution` (profile RMSE `0.16376`, transition-width ratio `0.20`). These are controlled-fixture checks, not registered-scene qualification.

The corrected LSF integrates its direction-corrected finite differences in raw source-target channel units and compares that integral with the direction-corrected first-to-last sample change. The ESF baseline/plateau medians still define normalized widths and the 50% crossing; they are not substituted for the finite interval endpoints. LSF asymmetry integrates each positive derivative over the geometric portions of its sample interval on either side of that crossing. In spatial metric revision `ground-glass-m5t-spatial-lsf-v2`, the symmetric fixture has positive mass `0.5` on each side, asymmetry `0`, raw integrated signal `1`, expected endpoint signal `1`, and consistency error `0`. These internal consistency metrics do not validate optical blur or establish registered-scene reference authority.

The M5T Review-Fix Round 1 reran the native study from source commit `5848c3651c88538e6af6f80beab939cdcbe7fc13`. The five numerical strata remain `budget-limited-unresolved`, and both registered-app spatial studies remain `spatial-profile-insufficient-support`; these new captures do not promote reference authority. The corrected synthetic LSF values, fresh capture IDs and input fingerprints, test results, and historical comparison are recorded in [GROUND_GLASS_M5T_REVIEW_FIX_1_REPORT.json](GROUND_GLASS_M5T_REVIEW_FIX_1_REPORT.json).

## Native Architecture Rise study

The run used Chrome `156.0.8078.48`, Three.js `r186`, `webgpu-renderer`, native `webgpu` execution, no internal fallback, and no application fallback. Source and gather were both 474 × 379. Each Full32/Full64 pair matched camera, effective optical request, source-color, depth, physical-CoC, and validity provenance. Full capture IDs, request/generation IDs, compact fingerprint tags, and SHA-256 digests are in the JSON report.

The M5S anchor selections were replayed with their existing exact ten-pixel IDs. M5S historical `converged-and-cross-validated` classifications remain intact; M5T did not replace their record. M5T selected 59 pixel slots overall, including the two ten-pixel anchors and three supported priority strata:

| Capture role / stratum | Registered-app candidates | Selected | M5T result | Median unresolved area at 256 |
| --- | ---: | ---: | --- | ---: |
| Primary 4× cap 60 / S1 smooth Far anchor | 60,891 | 10 | `budget-limited-unresolved` | 1.3105% |
| Primary 4× cap 60 / S3 high-gradient Far | 17,967 | 10 | `budget-limited-unresolved` | 1.3081% |
| Full-frame cap 60 / S5 signed-CoC boundary | 61 | 10 | `budget-limited-unresolved` | 0.0308% |
| Focus-distance cap 60 / S4 depth-edge anchor | 3,762 | 10 | `budget-limited-unresolved` | 0.0308% (maximum 0.1076%) |
| Stressed cap 2 / S6 cap-activated Far | 179,646 | 10 | `budget-limited-unresolved` | 0.2711% |

Every one of the 10 pixels in each selected study exhausted its adaptive evaluation budget at all four levels: 40 budget-exceeded pixel-level results per study. Partial RGB and area outputs are retained only as diagnostics. Denominator stability and refinement comparisons are therefore unavailable for classification even where the partial unresolved-area fraction is small. The fixed grid returned estimates for all 50 numerical ROI pixels without exceeding its per-pixel budget, but no adaptive/fixed-grid RMSE or M5S cross-method RMSE is reported because the adaptive values did not qualify as references. Four 1024-sample M5S proposal families were evaluated per ROI (204,800 proposals total); their comparisons are explicitly withheld.

S2 had zero eligible registered-app candidates in all four tested roles. CPU checkerboard and striped controls exercise source-texel discontinuity handling, but they do not manufacture native S2 support. The other unselected stratum populations and per-role candidate counts remain in the report.

## Spatial edge and halo evidence

The primary 4× state had no contiguous nine-pixel line that met the source-contrast, depth-edge, physical, validity, and mapping gates. In the focus-distance state, the source/depth-first selector identified nine contiguous horizontal samples (`depth-edge-horizontal-16256`, source pixel IDs 16256–16264) without consulting candidate quality. The source, Full32, and Full64 lines had no meaningful endpoint transition. Registered-app ESF widths and LSF/FWHM are therefore unresolved; the adaptive reference profile is unavailable because the numerical studies exhausted budget. The readback color-channel signal is not sufficient to attribute foreground leakage or a halo. No registered-app halo or B1 defect is claimed.

Native spatial profiles cover the source, Full32, and Full64 outputs. The study did not capture a contiguous M5S reference profile or B0/B1 output for those line ROIs; the M5S analysis remains pointwise and M5T quadrature was unresolved under its budget. The separate synthetic blurred/sharp profile is fixture evidence only. The machine-readable report records these unavailable comparisons explicitly.

## Authority and boundaries

The registered-app numerical classifications are all `budget-limited-unresolved`; registered-app spatial classifications are `spatial-profile-insufficient-support`. The combined authority remains bounded research only. No tested region is newly promoted as an independent high-accuracy reference, scene-wide blur validation, or general device qualification.

M5Q remains frozen at `m5q-architecture-rise-r186-v3`: Q1 `reference-not-converged`, Q2 `insufficient-support`, Q3 `bounded-qualified`, Q4 `insufficient-support`, Q5 `reference-not-converged`, Q6 `reference-not-converged`, and Q7 `reference-not-converged`. No threshold or qualification was rewritten. Production M5/B1, public WebGL Ground Glass, renderer lifecycle, and production WebGPU activation were not changed. M6 quality-dependent presentation remains blocked.

## Next research step

Recommend a focused M5U on discontinuity-aware reference refinement under the existing per-pixel ceiling, such as geometry-aware source-texel/eligibility-boundary integration, with the same M5S S1/S4 anchors and analytic controls. Acquire a suitable registered-app contiguous edge before making spatial or B1 quality claims. Do not use this report to change M5, frozen M5Q thresholds, or begin M6.
