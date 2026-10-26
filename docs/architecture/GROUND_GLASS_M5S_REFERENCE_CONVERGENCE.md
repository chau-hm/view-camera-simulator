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

At the original PR baseline, the 19-test M5S suite exercised N1–N16: one-channel error, provenance mismatch, duplicate/outside proposals, center-biased and uniform-radius distributions, analytic-gate failure, sharp-source substitution, nearer-layer depth rejection, RMSE/max-channel disagreement, per-stratum aggregation, randomized-seed uncertainty, CPU128/256 non-convergence, frozen M5Q outcomes, and ROI/sample/sequence budgets. The review-fix suite below adds the per-method/per-seed authority controls.

At the original PR baseline, the native M5R/M5S capture, separate native M5Q confirmation, three native M5 app-adapter/stale-capture regressions, and two production-preview isolation tests passed. The baseline full `npm test` had 292 files and 2,829 tests; typecheck, lint, CSS, and production build passed. The same known `npm run ci:local:e2e` Architecture/Foreground title assertion is re-evaluated below for this review-fix round. Phase J/K/L native tests were not rerun because M5S changed no optical, M4 physical, B1, or renderer lifecycle behavior.

## Limitations and next research

This is a sparse CPU reference feasibility result with ten selected pixels per stratum. S2 has no support in the tested captures; several high-gradient, signed-boundary, and cap cases remain unresolved or show only one-method convergence. The two cross-validated strata do not establish a universally converged reference, photographic truth, broad registered-scene quality, or complete blur spread. The prior CPU128/CPU256 divergence is unchanged.

The next research PR should test a separately implemented adaptive or deterministic quadrature reference and spatial edge-spread measurements on new predeclared valid-Far ROIs, while preserving the M5 gather and frozen M5Q contract.

## M5S Review-Fix Round 1

### Per-method analytic authority

The prior E2E generator evaluated analytic controls only on Halton N=1024, then passed one global boolean into all method and seed comparisons. The corrected evaluator accepts and tests each actual proposal strategy independently. The required identity is method, sequence ID, N=1024, seed, and proposal algorithm revision; the analytic result must also match the coordinate fingerprint from the strategy used by the native reference matrix. Every required participant must have exactly one result. A missing, duplicate, unexpected, or mismatched method/seed result blocks cross-method qualification. The method-level gate applies to these four high-tier candidates only; lower tiers retain structural audits and measured convergence curves without inheriting N=1024 analytic status.

Structural validity and analytic validity answer different questions. The proposal audit records finite, unique, in-disk coordinates and their distribution summaries. Eight independent analytic controls test uniform-color invariance, symmetric affine integration, a planar boundary, compact silhouette against 512×512 midpoint quadrature, depth rejection, radius-cap mapping, equal-area disk sampling, and sharp-source blur loss. The compact-silhouette midpoint calculation remains a numerical oracle, not photographic truth.

The unit-disk second-moment target is `E[x² + y²] = E[r²] = 0.5`, with a fixed absolute tolerance of `0.03` declared for the N=1024 diagnostic gate. This allowance accommodates finite deterministic and seeded samples while rejecting the tested center-scaled signature (`0.125`) and uniform-radius signature (`about 0.333`). It does not change M5Q thresholds.

| Required strategy | Seed | Measured `E[r²]` | Analytic result |
|---|---:|---:|---|
| Golden-angle count-dependent | — | `0.50000000` | Passed |
| Halton 2/3 progressive | — | `0.49951220` | Passed |
| Seeded stratified square-to-disk | `104729` | `0.49972672` | Passed |
| Seeded stratified square-to-disk | `130363` | `0.50058089` | Passed |

The passing controls apply to these exact sequences and the tested N=1024 tier. They do not establish correctness for every sample count or another algorithm revision. The native analytic PASS is joined to the observed matrix participant's descriptor and coordinate fingerprint before it reaches each stratum decision.

### Mutation controls and corrected strata

The 30-test M5S unit suite includes mutation-sensitive review controls F1–F10. A structurally valid Golden-angle sequence scaled to half-radius measured `E[r²] = 0.125` and was rejected. A seeded sequence changed to uniform radius measured about `0.333` and was rejected. A failing second seed remained distinct from the passing first seed and blocked the aggregate. Missing seed evidence, duplicate/wrong-seed evidence, Halton-only evidence, an altered sample tier, method, or revision, and exact numerical agreement paired with failed analytics all fail closed. The report serialization control checks that per-method status, stratum status, and aggregate classification agree.

The corrected native run re-evaluated the original four capture roles and all six ROI strata, without changing their pixel limit or the 1,048,320-evaluation native study budget. Primary 4× S1 remains `converged-and-cross-validated`; its maximum seed-to-mean variation is RMSE `0.00013531`, maximum channel error `0.00052849`, and blur preservation passes. Focus-distance S4 remains `converged-and-cross-validated`; its maximum seed-to-mean variation is RMSE `0.00036316`, maximum channel error `0.00135078`, and blur preservation passes. Both are restricted to their exact selected ten pixels and captured optical states. Other supported strata remain one-method-only or unresolved; S2 remains insufficiently supported. No native capture was intentionally mutated.

The historical report's previous capture IDs, fingerprints, selected S1/S4 pixel identities, tier metrics, cross-method comparisons, seed variation, and blur results are preserved in the versioned [review-fix report](GROUND_GLASS_M5S_REVIEW_FIX_1_REPORT.json), alongside the corrected decisions. The corrected report also preserves the original native M5S evaluation count and the historical M5R comparisons.

### Compact tracked report and evidence attachments

The native test generator now separates its complete proposal arrays from its tracked summary. `samplingFamilies.samplingPatterns` records method, sequence, revision, N, seed, progressive-prefix flag, proposal count, audit, coordinate checksum, and analytic status. The checksum is FNV-1a 64-bit over ordered x/y IEEE-754 binary64 little-endian coordinates; it is a reproducibility integrity check, not a cryptographic signature or proof of validity. Full proposals and raw per-pixel RGB vectors remain in the ignored Playwright attachments `m5s-sampling-proposals.json` and `m5s-blur-spread.json`. The compact report retains computed blur and spread metrics, convergence curves, selected ROI IDs, accepted proposal counts, capture IDs, native runtime identity, and input fingerprints. A schema regression loads the tracked JSON and checks its method identities, seeds, audits, metrics, provenance, and absence of proposal-coordinate arrays.

At the reviewed baseline, the tracked JSON was 1,439,569 bytes and 45,457 lines; the corrected report is 1,132,556 bytes and 24,988 lines. The prior tracked snapshot already represented proposals through its raw-artifact flag, while the E2E report generator itself emitted the large arrays. This fix moves those generated arrays to the ignored attachment and adds a stable checksum to the tracked summary. The original tracked report's measurements remain available in Git history and are also summarized in the review-fix report.

### Evidence boundary

The native run used `chrome-native-webgpu`, Three.js r186, `rendererFamily=webgpu-renderer`, `actualExecutionApi=webgpu`, no internal fallback, and no application fallback. Source/depth/physical/validity fingerprints and the observed gather-center provenance remain attached to the captured roles. The M5Q frozen revision `m5q-architecture-rise-r186-v3` and Q1–Q7 outcomes are unchanged. The M5S results do not promote Q1/Q6, broaden Q3, qualify M5/B1, establish photographic ground truth, or authorize M6 quality-dependent presentation or production WebGPU.

Detailed native proposal, audit, convergence, cross-method, ROI, and blur-spread files are emitted as ignored Playwright test attachments. The committed report and versioned correction summary are the concise reproducibility and decision record; they are not a substitute for the captured input or an independent optical truth source.

### Review-fix validation

- M5S-focused cases: 30 passed as part of the full 292-file suite; the five focused M5S/M5R/M5Q/aperture-reference suites also passed earlier in this round.
- Full `npm test`: 292 files, 2,840 tests passed with Node Web Storage enabled using a fresh temporary file. Typecheck, lint, CSS structure, production build, and `git diff --check` passed.
- Native M5S confirmation: 1 passed; native M5Q confirmatory test: 1 passed; three native M5 adapter/R3/stale-capture regressions passed in isolated runs.
- Production-preview WebGL isolation: 2 passed. The default route and URL-shaped WebGPU requests did not load the WebGPU adapter.
- `npm run ci:local:e2e`: CSS, lint, typecheck, unit/integration, and build stages passed, then development E2E stopped at `architecture-foreground-compound.spec.ts` because the expected “Complete the Photograph” heading was absent. This matches the recorded clean-main baseline failure at `8cd0d869229de04cf56845d98e93116aa2a92a60`; later development E2E specs were not run.
- Phase J/K/L browser tests were not rerun because this correction changes no optics, M4 physical calculations, B1 behavior, or renderer lifecycle.
