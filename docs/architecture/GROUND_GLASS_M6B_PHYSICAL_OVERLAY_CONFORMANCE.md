# M6B Physical Overlay and Final-Output Conformance

**Status:** bounded M6B evidence; implementation commit `bdbcd08ae83e5d6114cf7bb4d6ef6d0f27bd8bd7`

**Predecessor:** M6 PR #294, merged at `f831e48121a7e6fdb3106b3a59fcce716143f90a`

**Native runtime:** Chrome `chrome-native-webgpu`, Three.js r186, `webgpu-renderer` / native `webgpu`, no internal or application fallback.

M6B closes the measured physical-overlay alignment gap for a controlled calibration source and adds an independent CPU-to-GPU oracle for the visible M6 presentation output. The calibration source and expected coordinates are test-only. The fixture uses the application’s actual Ground Glass WebGPU adapter, M6 presentation TSL node, shared Stage, physical grid, and target projection contracts. It does not replace the registered Architecture Rise image or qualify that scene’s optical output.

## Scope and fixture

The fixture is authorized only in development with the test seam, both M6 pilot build flags, the exact Architecture Rise identity and bounds, and an explicit fixture control. It is denied for Macro Bellows. The source is a bounded adapter-owned 512×512 `DataTexture`; the test asserts its disposal after route retirement. Normal M6 requests do not require fixture resources.

The physical contract uses a 127×101.6 mm film window, 10 mm grid spacing, origin at film center, +X right and +Y up. Canonical film coordinates are `u = 0.5 + xMm / 127` and `v = 0.5 - yMm / 101.6`; Raw displays `(1-u, v)` and Upright displays `(u, 1-v)`. Thirteen asymmetric landmarks, including film-edge points, are defined in the JSON report. Raster positions are measured from screenshot pixel-cell centers and converted to CSS content-box pixels using the measured canvas scale (DPR 1 in this run).

Before capture, the fixture fixed the raster budget at 1 CSS px expected localization uncertainty, 2 CSS px maximum spatial error, and 1.25 CSS px maximum RMS error. Every expected marker is conserved as measured, outside the current crop, or unsupported.

## Physical overlay results

The native matrix contains 14 capture states: Raw, Upright, Raw round-trip, centered Focus Loupe, horizontal/vertical/diagonal pan, four crop limits, Upright crop, crop reset, and resized full film. It records 77 visible marker measurements, 105 markers outside the active crop, and zero unsupported markers. Each required full-film state measured all 13 markers. The worst capture had 1.5492 CSS px maximum error and 0.7301 CSS px RMS, both within the predeclared limits.

Across measured points:

| Measurement | Count | Maximum error | RMS error |
| --- | ---: | ---: | ---: |
| GPU image landmark to independently projected physical point | 77 | 1.1051 CSS px | 0.6622 CSS px |
| Shared target overlay to expected physical point | 77 | 0.0197 CSS px | 0.0130 CSS px |
| Physical grid intersection to image landmark | 77 | 1.0269 CSS px | 0.6957 CSS px |

Actual internal targets changed from 334×267 to 437×349 px on resize; the displayed output remained 514×411 px. The fixture report records request, channel, scene, generation, source and presentation fingerprints, crop, orientation, and target/output dimensions for every capture.

The controlled fixture result is `physical-overlay-conformant` for these tested states and this raster budget. Native M6 registered-app evidence is recorded separately: the current M6 suite passed 8/8 tests, including the real Architecture Rise M3–M6 path, Raw/Upright, crop/pan/resize, stale-work and failure controls. The registered Architecture Rise scene has no physical grid/target overlay, so this is not reported as registered-scene overlay conformance. Fixture pixels and registered-scene pixels are not pooled.

## Final-output pixel oracle

The oracle samples known source bytes through the real M6 TSL presentation node and reads the final browser canvas. Expected RGB is computed independently from linear source RGBA, canonical orientation/crop/film mapping, coverage, natural illumination, throughput, and the linear-to-sRGB transfer. Source texture sampling is nearest-neighbor in `NoColorSpace`; measured output pixels are sRGB canvas bytes.

Nine native cases cover neutral Raw, half throughput, natural `cos⁴` illumination, centered and shifted circles, conic coverage, combined effects, centered Loupe crop, and the resized target. Across 206 output samples, maximum error was 1 eight-bit channel code and the worst per-case RGB RMSE was `0.204125` code values; both are below the fixed 4-code maximum and 2.5-RMSE limits. The individual case results and measured source/output pixel pairs are in the JSON report. The sampling boundary distinguishes nearest texel `(170, 490)` from adjacent `(171, 490)` and the captured output matched the expected nearest sample.

The partial-alpha source swatch has alpha 0.35, but the visible canvas is opaque. The canvas capture cannot independently establish source-alpha preservation or alpha compositing. Alpha is therefore `unobservable`, not passed. The final-output classification is `final-output-partial`; the RGB sub-result is conformant for the tested cases. An alpha-preserving test target or equivalent independent observation is still needed for full final-output conformance.

## Negative controls

The machine-readable report maps N1–N35 to the evidence that can detect each regression. Coordinate mutations N1–N18 exercise the actual projection, crop, grid, target, and alignment evaluators. N19–N27 are checked against native output from the real presentation node and independent CPU expectations, including coverage, illumination, throughput, sRGB and the nearest-sampling boundary. N29–N30 use actual resized/requested output and the existing native stale-request regression. N31–N33 use production and scene-authorization controls. N34 keeps fixture evidence separate from registered-app integration; the M6 scene-compatibility policy remains exact-scene scoped. N35 is guarded by the M6 policy test and unchanged M5Q qualification evidence.

N25 has no separate linear GPU readback path to misuse: the oracle labels the input target linear and compares it to sRGB bytes read from the visible canvas. N28 remains explicitly unsupported because the canvas is opaque. Neither is reported as a PASS for unobserved alpha or linear-readback behavior.

## Evidence boundaries and decisions

| Decision | Result | Scope |
| --- | --- | --- |
| Physical overlay | `physical-overlay-conformant` | Controlled Architecture Rise calibration fixture, native GPU raster, 14 states |
| Final-output pixel oracle | `final-output-partial` | RGB sub-result passes nine cases / 206 samples; source alpha cannot be independently observed through the opaque canvas |
| M6 architecture | `architecture-partially-implemented` | Final alpha/output evidence remains incomplete |
| Photographic quality | `quality-unqualified` | M6B does not qualify M5 optical quality |
| M7 | Not started | M6B does not implement failure-recovery work |
| Production WebGPU | `production-webgpu-disabled` | Public WebGL behavior and production default are unchanged |

M5Q remains on frozen revision `m5q-architecture-rise-r186-v3`: Q1 `reference-not-converged`, Q2 `insufficient-support`, Q3 `bounded-qualified`, Q4 `insufficient-support`, Q5 `reference-not-converged`, Q6 `reference-not-converged`, Q7 `reference-not-converged`. M6B changes no M5, B1, optics, frozen threshold, scene catalog, public selector, or production renderer behavior.

The focused M6B and M6 native suites, native M5Q/app-adapter regressions, production-preview isolation, and standard checks are recorded in the PR handoff. Large screenshots, canvas bitmaps, SVG overlays, per-capture measurements, and readbacks remain in ignored Playwright output; [GROUND_GLASS_M6B_PHYSICAL_OVERLAY_CONFORMANCE_REPORT.json](GROUND_GLASS_M6B_PHYSICAL_OVERLAY_CONFORMANCE_REPORT.json) contains compact tracked measurements and provenance.

## Remaining work

The only M6B presentation gap left is independent alpha observation. A bounded future test-target/readback addition may close it; this report does not start that work. M6 remains partial pending that evidence. M7 lifecycle recovery, M8 wider scene/device/performance qualification, M9 go/no-go, and any separate production promotion remain future stages.
