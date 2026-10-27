# M5U — Discontinuity-Aware Quadrature Efficiency and Reference Research Closure

**Decision:** `reference-efficiency-improved` for the exact registered-app pixels below. This is bounded support, not global reference authority.

**Native evidence:** Chrome 156.0.8078.48 on macOS 27.0.1; Three.js r186; `webgpu-renderer` using native `webgpu`; no internal or application fallback. Source resolution was 474×379. The tested scene source revision was `architecture-rise-raw-rtt-v1`.

The implementation and measurements are recorded in [GROUND_GLASS_M5U_QUADRATURE_EFFICIENCY_REPORT.json](GROUND_GLASS_M5U_QUADRATURE_EFFICIENCY_REPORT.json). It retains the Full32/Full64 capture IDs, input fingerprints, matched camera/effective-request fingerprint digests, exact selected gather-center IDs and UVs, costs, and per-ROI evidence. Full readbacks and adaptive cell traces remain in ignored Playwright output.

## M5T cost baseline

M5T retains its original 32/64/128/256 initial-resolution contract, depth 12, and 250,000 charged-evaluation ceiling per pixel. M5U measured three repeated runs over two preselected pixels in each supported stratum before choosing its strategy. Initial 8 and 16 grids were sensitivity-only experiments; all measured resolution runs remained budget-limited.

At resolution 32, each two-pixel stratum starts with 2,048 root cells: 336 outside the aperture disk, 1,464 inside, and 248 crossing its boundary. The table reports M5T actual in-disk evaluations and charged point calls separately. Boundary categories and unresolved-area causes overlap.

| Stratum | Source-texel boundary cells | Disk + texel overlap | Actual evaluations | Charged calls | Median time | Unresolved area: source / disk / budget |
|---|---:|---:|---:|---:|---:|---:|
| S1 smooth Far | 217,828 | 1,230 | 477,526 | 499,994 | 227.945 ms | 0.062254 / 0.012188 / 0.074338 |
| S3 high gradient Far | 217,834 | 1,181 | 477,526 | 499,994 | 230.567 ms | 0.061980 / 0.012188 / 0.074071 |
| S5 signed-CoC boundary | 0 | 0 | 338,010 | 499,998 | 268.905 ms | 0 / 0.001698 / 0.001698 |
| S4 depth edge | 59,765 | 148 | 376,887 | 499,997 | 243.112 ms | 0.001166 / 0.002491 / 0.003656 |
| S6 cap activated | 172,256 | 439 | 449,872 | 499,996 | 231.096 ms | 0.008799 / 0.005544 / 0.014336 |

The unresolved-area values are measured in the implementation’s normalized aperture-area accounting. Categories overlap and must not be summed. Source-texel boundaries dominate the S1 and S3 selected subset. S5 shows disk-boundary work without source-texel crossings; S4 and S6 are mixed. No UV-dependent depth probes were needed for these selected inputs. Per-run mapping operations, predicates, fetches, refinements, frontier size, estimated memory, and budget-depth counts are retained in the JSON report.

Resolution sensitivity (median across the five strata) was 224,422 / 224,746 / 224,936 / 225,066 actual point evaluations per pixel at initial resolutions 8 / 16 / 32 / 64. Corresponding median elapsed times were 252.874 / 233.359 / 231.096 / 246.202 ms. The 8/16 measurements do not change the historical M5T configuration.

## Strategy A and stop rule

Strategy A maps source-texel footprints into aperture coordinates using the established nearest-source-pixel mapping, locates the Float32-sensitive thresholds, clips each footprint against the unit disk, and integrates each circle/polygon region once. It retains the captured physical ellipse and cap, observed gather-center identity and UV, top-origin convention, source-edge clamping, source validity, signed-CoC Far test, and depth acceptance.

For UV-dependent view-distance reconstruction, M5U fails closed with `unsupported-uv-dependent-view-distance`; a same-texel shortcut cannot prove depth eligibility in that case. Incomplete or invalid partitions remain unresolved. Analytic tests cover uniform and affine surfaces, two-color boundaries, offset regions, compact silhouettes, high-frequency changes, thin strips, rotated ellipses, source-edge clamping, Float32 boundaries, tangent intersections, cap activation, validity/CoC rejection, small or empty accepted area, overlapping boundaries, and the UV-dependent negative case.

Across five repeated, matched two-pixel diagnostics, Strategy A reduced actual integrand evaluations by 99.930–99.999% per stratum. Candidate median CPU time was 0.343–1.291 ms versus 227.945–268.905 ms for the corresponding M5T median; the median candidate/baseline elapsed ratio was 0.001647. Estimated peak working memory was 7,352 bytes for each two-pixel diagnostic run, compared with approximately 34.2–43.4 MB estimated for M5T. Both memory values are model estimates, not heap measurements. The timings are CPU research measurements, not production FPS claims.

Strategy B was not attempted: Strategy A removed the measured dominant source-texel subdivision and passed the predeclared efficiency gate, so the stop rule was met.

## Registered-app confirmation and evidence

The confirmation reused the preselected ten-pixel sets for S1, S3, S5, S4, and S6, with matched source, depth, physical, validity, camera, and optical-request provenance. Every selected pixel exhausted M5T’s budget at each original resolution (32, 64, 128, and 256). M5U integrated all 50 pixels with a maximum unresolved area of `4.01e-11`.

| Stratum | M5U supported | Still unresolved |
|---|---:|---|
| S1 smooth Far | 9/10 | 17781 |
| S3 high-gradient Far | 7/10 | 24995, 39911, 53175 |
| S5 signed-CoC boundary | 10/10 | — |
| S4 depth edge | 9/10 | 63186 |
| S6 cap activated | 9/10 | 26946 |

Across these pixels, M5U’s maximum accepted-area difference from the independent 512×512 midpoint estimate was `0.001308`, below the M5U diagnostic limit `0.005`. Maximum RGB RMSE against that grid was `0.000530`, and maximum channel error was `0.000611`, both below the diagnostic RGB limits `0.001` and `0.01`. The 512 grid is one finite approximation, not ground truth.

Each 1024-sample M5S method/seed was compared independently. Maximum RGB RMSE and pixel counts above the `0.001` diagnostic limit were: Golden-angle `0.001430` (1), Halton `0.002504` (3), stratified seed `104729` `0.001318` (3), and stratified seed `130363` `0.003010` (4). There are 11 method/pixel exceedances across six distinct unresolved pixels. The other 44 pixels passed analytic controls, accepted-area stability, fixed-grid comparisons, and all four M5S method comparisons. All ten selected S5 pixels are supported; no broader ROI or scene-wide claim follows.

The full 50-pixel confirmation recorded 42,395,885 M5T actual point evaluations and 49,999,612 budget-charged point calls, versus 3,607 M5U integrand evaluations: a 99.9915% reduction in actual integrand evaluations. Summed elapsed time was 24,539.843 ms for M5T and 5.066 ms for M5U; this single-run aggregate is secondary to repeated matched diagnostic medians. M5U also recorded 362,848 geometric operations and 272,320 source-boundary-search evaluations. The separate 512 grid used 10,294,600 evaluations; the four M5S methods used 204,800 proposals.

## Research closure and limits

The selected outcome is `reference-efficiency-improved`: Strategy A resolved all 50 formerly budget-limited pixels, and 44 passed the independent per-pixel diagnostic gates. Six remain unresolved due to finite M5S disagreements. The result does not establish a validated high-accuracy or photographic ground truth, universal sampling attribution, or quality across other scenes/devices. M5Q’s frozen reference-convergence outcomes are unchanged.

The planned M5 numerical-reference sequence is closed. Do not create an automatic M5V follow-up. New numerical research requires a concrete hypothesis, new evidence, or a demonstrated production blocker. M6 architecture-only work may proceed independently; quality-dependent presentation remains blocked. Production WebGPU remains disabled.

M5Q remains frozen at `m5q-architecture-rise-r186-v3`: Q1 `reference-not-converged`, Q2 `insufficient-support`, Q3 `bounded-qualified`, Q4 `insufficient-support`, Q5 `reference-not-converged`, Q6 `reference-not-converged`, Q7 `reference-not-converged`.

## Validation

- `npm test` — passed, 294 files / 2,893 tests.
- Focused M5U/M5T/M5S/M5R/M5Q unit suites — passed, 118 tests across six files.
- `npm run typecheck`, `npm run lint`, `npm run check:css` — passed.
- `npm run build -- --outDir /private/tmp/vcs-m5u-build-final` — passed; local CI also completed its standard production build.
- Native Chrome WebGPU matrix — passed 5 tests covering M5Q, M5 app adapter, M5T, and M5U.
- Production-preview isolation — passed 2/2; no WebGPU activation path appeared in production.
- `npm run ci:local:e2e` — CSS, lint, typecheck, unit tests, and build passed; the first development E2E failed on the known missing “Complete the Photograph” heading. The same failure was reproduced against a clean archive of base `c80f7d297ec5f044a87e37d870af16b4b0b00e1e`.
- Hosted CI is reported separately after PR publication.
