# M5S — Independent Aperture Reference and Sampling Convergence Feasibility

**Status:** Research-only feasibility result. No M5 gather, B1 reconstruction, M5Q threshold, production WebGL path, or M6 behavior changed.

**Evidence report:** [Machine-readable native and convergence data](GROUND_GLASS_M5S_REFERENCE_CONVERGENCE_REPORT.json). Full proposal coordinates, per-run readbacks, and Playwright attachments remain in ignored native test output.

## Question and estimator

M5R found that its same-count GPU/CPU references agree closely while CPU32/64/128/256 remained far above the frozen `0.001` RMSE limit. M5S tests whether a bounded, independently sampled Far aperture reference can converge on predeclared scene strata. A high-sample CPU result remains a candidate estimate, not photographic ground truth.

For an eligible Far center, the existing finite estimator is:

```text
(center RGB + sum of accepted proposal RGB) / (1 + accepted proposal count)
```

The center contributes one fixed weight; its fraction falls as proposal count grows. The limiting target is the conditional aperture-domain mean over accepted samples. It omits the O(1) center contribution and is undefined when no proposal is accepted. Proposals use captured physical CoC axes/orientation, film and source dimensions, the existing pixel-radius cap, observed gather-center IDs/UVs, top-origin nearest texel sampling, validity, signed-CoC, depth reconstruction, and source-target readback color values. Rejected proposals do not contribute.

M5S keeps the finite output and limiting integral separate in every pixel result. It does not change or import the production TSL gather or B1 path.

## Methods and controls

Three aperture proposal families were evaluated at 32, 64, 128, 256, 512, and 1024 samples:

- Existing count-dependent golden-angle disk sequence as the baseline.
- Extensible Halton bases 2/3 mapped to an equal-area polar disk; lower-tier points are exact prefixes.
- Reproducibly seeded jittered equal-area square strata mapped to a disk. Native analysis used seeds `104729` and `130363`.

Proposal audits record duplicate/outside/non-finite counts, radial and angular occupancy, centroid, radius moments, and nearest-neighbor distance. The analytic suite passed uniform-color, symmetric affine-gradient, planar-boundary, compact-silhouette versus independent 512×512 midpoint raster integration, depth rejection, 5 px radius-cap, and sharp-source blur-loss controls. The silhouette sparse estimate was `0.146484375`; independent raster quadrature was `0.1405008451` (absolute error `0.0059835299`).

The native selection used at most ten pixels per stratum, with ten required for adequate support. Selection consults only source gradients, captured physical CoC, validity, depth discontinuities, signed-CoC neighborhoods, and cap activation; it does not consult candidate/reference error. The four capture roles consumed `1,048,320` proposal evaluations against a declared `2,000,000` limit.

## Native evidence

The native-required run used Chrome `155.0.8059.86` on macOS, Three.js `r186`, `rendererFamily=webgpu-renderer`, `actualExecutionApi=webgpu`, `internalFallback=none`, and no application fallback. Full32/Full64 source, depth, physical-CoC, and validity fingerprints matched within each paired state.

| Capture role | Optical state | Cap | Aggregate result | Cross-validated strata |
|---|---|---:|---|---|
| Primary 4× control | `ar-f3200-f5p6-loupe4-rise0` | 60 px | `convergence-trending-but-unresolved` | S1 smooth valid Far interior |
| Full-frame control | `ar-f3200-f5p6-full-rise0` | 60 px | `converged-within-one-method-only` | None |
| Focus-distance control | `ar-f5200-f5p6-full-rise0` | 60 px | `convergence-trending-but-unresolved` | S4 depth discontinuity valid Far |
| Stressed cap | `ar-f3200-f5p6-loupe4-rise0` | 2 px | `convergence-trending-but-unresolved` | None |

S2 had no eligible candidates in these captures and is reported as insufficient support. S5 signed-boundary and S6 cap strata are reported separately; they do not inherit support from other strata. The cap-stress strata show that seed repeatability alone does not establish tier convergence. Aggregate classifications do not turn a passing stratum into scene-wide authority.

For the two narrowly supported strata, maximum seed-to-mean variation was:

- Primary 4× S1: RMSE `0.00013531`, maximum channel error `0.00052849`.
- Focus-distance S4: RMSE `0.00036316`, maximum channel error `0.00135078`.

The latter remains within the declared RMSE and `0.01` maximum-channel limits. Those results apply only to the selected ten pixels and exact captured state. Source-to-reference and local-gradient evidence is retained per stratum in the JSON; it does not establish broad blur, edge-spread, B1, or image-quality qualification.

## Historical evidence and qualification boundary

M5R measurements remain unchanged: Full32/Full64 RGB RMSE was `0.0078575391` in RGBA16F and `0.0078591930` in RGBA32F; matched GPU32/CPU32 and GPU64/CPU64 RMSE were `6.5196391e-8` and `1.3437509e-7`. CPU32/64, CPU64/128, and CPU128/256 RMSE were `0.0116466113`, `0.0057483155`, and `0.0041571304`; CPU128/256 remains above `0.001`, so CPU256 is not ground truth. The existing golden-angle 32/64 overlap remains 0/32; the CPU-only nested experiment remains 32/32.

M5R fallback evidence remains 57,598 fallback pixels with six meeting the meaningful-blur floor. Registered-app fractional Near coverage remains zero; the controlled native fixture remains 1,896 fractional-alpha pixels.

The frozen M5Q revision `m5q-architecture-rise-r186-v3` and statuses remain unchanged: Q1 `reference-not-converged`, Q2 `insufficient-support`, Q3 `bounded-qualified`, Q4 `insufficient-support`, and Q5–Q7 `reference-not-converged`. M5S evidence does not promote Q1/Q6, broaden Q3, qualify R3/R4, or authorize M6 quality-dependent presentation or production WebGPU.

## Negative controls and validation

The 19-test M5S suite exercises N1–N16: one-channel error, provenance mismatch, duplicate/outside proposals, center-biased and uniform-radius distributions, analytic-gate failure, sharp-source substitution, nearer-layer depth rejection, RMSE/max-channel disagreement, per-stratum aggregation, randomized-seed uncertainty, CPU128/256 non-convergence, frozen M5Q outcomes, and ROI/sample/sequence budgets.

The final native M5R/M5S capture, separate native M5Q confirmation, three native M5 app-adapter/stale-capture regressions, and two production-preview isolation tests passed. Full `npm test` passed (292 files, 2,829 tests), along with typecheck, lint, CSS, and production build. `npm run ci:local:e2e` failed at the first unrelated Architecture/Foreground title assertion; the same spec failed at the same assertion on clean `origin/main` `8cd0d869229de04cf56845d98e93116aa2a92a60`. Phase J/K/L native tests were not rerun because M5S changed no optical, M4 physical, B1, or renderer lifecycle behavior.

## Limitations and next research

This is a sparse CPU reference feasibility result with ten selected pixels per stratum. S2 has no support in the tested captures; several high-gradient, signed-boundary, and cap cases remain unresolved or show only one-method convergence. The two cross-validated strata do not establish a universally converged reference, photographic truth, broad registered-scene quality, or complete blur spread. The prior CPU128/CPU256 divergence is unchanged.

The next research PR should test a separately implemented adaptive or deterministic quadrature reference and spatial edge-spread measurements on new predeclared valid-Far ROIs, while preserving the M5 gather and frozen M5Q contract.
