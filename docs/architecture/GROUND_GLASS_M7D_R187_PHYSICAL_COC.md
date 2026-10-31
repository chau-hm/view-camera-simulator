# M7D — Three.js r187 M4 Physical CoC Requalification

## Scope and compatibility boundary

This document records a revision-specific research qualification for the registered Architecture Rise M4 Physical CoC/elliptical-footprint pass. The intended evidence revision is `m4-architecture-rise-physical-coc-native-r187-v1`. The M4 record remains `research-only`: it does not authorize selecting WebGPU, M5 Gather/B1, M6 presentation, M8, M9, or production WebGPU. M3 Raw RTT remains separately eligible only under its trusted development gate. Production Ground Glass remains WebGL-only.

Historical r186 evidence, including `m4-architecture-rise-physical-coc-native-v1`, `m5q-architecture-rise-r186-v3`, and `m6d-opaque-presentation-v1`, is retained without relabeling or rewriting.

## Pre-change architecture audit

The following answers were recorded from the `fef36524d6e8f9bcb75699339f9b2ad367bcd035` base before implementation changes.

1. **r186-bound M4 tests:** `ground-glass-webgpu-physical-coc-app.spec.ts` and the native case in `ground-glass-webgpu-physical-coc.spec.ts` assert `REVISION === "186"`. Their previous native outcomes remain historical r186 evidence; they must not be represented as fresh r187 results.
2. **Revision-sensitive assumptions:** The installed package exposes Three.js revision 187, while the historical M4 compatibility record and M6 presentation record still identify r186. The physical TSL/depth and render-target paths must be re-observed at runtime; a dependency version change alone does not establish depth reconstruction or target-storage compatibility. No optical formula or threshold change is authorized.
3. **Research flag on r187:** Yes. Before this PR, `isGroundGlassPhysicalCocResearchEnabled()` enabled the pass for a development Raw pilot when the trusted Physical CoC Vite flag was set, without checking `REVISION` or a revision-matched M4 record.
4. **Revision-specific authorization:** No. The development flag and Architecture Rise Raw request bounded the path, but the pass did not require M4 evidence whose tested renderer revision matched the installed package. The compatibility record was not consulted by the pass gate.
5. **M6 provisioning path:** Yes. An M6-capable build session used the M6 build flag, selected WebGPU/native API, and Architecture Rise identity to provision M4 resources. `isGroundGlassPhysicalCocResearchEnabled()` also accepted an M6 presentation request directly. Those checks did not compare the installed revision with the M6 record, so M6 resource provisioning could bypass the M4 revision boundary if an r187 Raw renderer were mounted under those flags.
6. **Target formats:** The adapter requests a `depth24plus`-compatible depth attachment, `rgba16float` physical target, and `rgba8unorm` validity target. It reads the WebGPU backend's allocated texture format after rendering and reports unsupported formats. The native app test checks those observations, but no r187 capture existed at the base.
7. **Resource ownership:** M4 physical/validity targets, diagnostic scenes/materials, and probe targets are adapter-owned and disposed by the adapter. The scene color target owns its attached depth texture. The registered scene subject uses its separate subject disposer; M4 does not own or directly dispose borrowed scene/module assets. Existing cleanup confirmation is generation-scoped, but M4-specific target/readback claims need fresh r187 lifecycle evidence.
8. **M7C lifecycle authority:** M4 executes as an optional pass inside the existing WebGPU adapter generation. Host attempt, sticky-fallback, request freshness, retirement, cleanup acknowledgement, and publication authority remain owned by M7C's existing host state and are not changed by the M4 gate.

### Test harness environment audit

`playwright.config.ts` consumes `GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1` to select headed `chrome-native-webgpu`. It maps `GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=1` to `VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=true` and enables the development test seam for the Vite server. `VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true` is read by the M4 E2E test and forwarded into the Vite process. Native qualification will additionally use an explicit M4 r187 qualification-harness flag; that flag is test-only and remains separate from compatibility eligibility.

## Native runtime and measurement results

The scoped result is **research-qualified for the tested environment**. Eight report scenarios passed, with no failed, blocked, or not-run scenarios in this bounded M4 inventory. The status does not imply cross-device behavior, photographic quality, M5/M6 readiness, or complete M7 qualification. The strict evaluator and full measurements are in [the machine-readable report](GROUND_GLASS_M7D_R187_PHYSICAL_COC_REPORT.json); source captures are under [`ground-glass-m7d-r187-physical-coc/captures`](ground-glass-m7d-r187-physical-coc/captures/).

### Runtime and provenance

| Observation | Captured result |
| --- | --- |
| Installed Three.js | `0.187.0`, runtime `REVISION === "187"` |
| Browser and project | Chrome `156.0.8078.76`, `chrome-native-webgpu` |
| OS/runtime | M4 capture reports `darwin arm64`; Node `v24.3.0` |
| Scene | `architecture-rise`, source `architecture-rise-raw-rtt-v1` |
| Mounted renderer | `webgpu-renderer` |
| Actual API / internal fallback | `webgpu` / `none` |
| Trusted harness | Native-required, Raw pilot, M4 research, explicit r187 qualification and test seam flags all observed true |
| Native capture source | `7118694af4a32a0827e5575519dc49be82c3b23e` |
| Evaluator | `m7d-physical-coc-evidence-v1`; it independently checks runtime identity, CPU vectors, readback, storage bits, host acceptance and report inventory |

The application test file also contains historical r186 assertions. Those tests were not relabeled or run as r187 evidence. The r187 run used `ground-glass-webgpu-physical-coc-app.spec.ts` with the exact trusted flags stored in each capture. The focused M4 failure-host invocation separately exercised the physical writer, validity writer, and unsupported-storage cases. No native test was skipped for missing WebGPU; the required native project completed all selected tests.

### Physical kernel and optical cases

The native capture contains all 17 required controlled vectors and six separate focal-boundary vectors. Coverage includes circular and near-circular footprints, positive and negative signed CoC, rear tilt, rear swing, compound tilt/swing, off-axis asymmetry, negative and near-π principal angles, exact zero, small signed CoC, finite virtual and real branches, explicit controlled `U=f`, values on both sides of focus, near-maximum binary16 storage, three overflow shapes, and invalid geometry.

`computePhysicalBlurFootprint()` is the independent CPU reference; `deriveOpticsState()` and the canonical optics pipeline remain authoritative. The frozen per-value gate remains `max(0.0005 mm, 0.00002 × |CPU value|)` and the modulo-π orientation limit remains `0.003 rad`.

| Comparison | r187 result | Gate |
| --- | ---: | ---: |
| Maximum CPU-to-TSL absolute error across all vectors | `0.8125 mm` on a `132000 mm` over-range diameter | Passes relative limb: `0.00000616` |
| Maximum CPU-to-TSL relative error | `0.039997` (about 4%) on the `0.01 mm` positive control; absolute error `0.00039997 mm` | Passes unchanged `0.0005 mm` absolute floor |
| Maximum absolute error across representable physical cases | `0.00390625 mm` | Each case passes the frozen max(abs, relative) gate |
| TSL orientation modulo π | `2.50e-7 rad` maximum | `< 0.003 rad` |
| Decoded RGBA16F orientation modulo π | `0.001347985 rad` maximum | `< 0.003 rad` |
| Stored value versus GPU-sampled decode | `0 mm` maximum observed difference | Exact in this capture |

The raw relative maximum is high because the `0.01 mm` vector uses the specified absolute tolerance floor. Neither numerical threshold was changed. The three over-range vectors retain their calculated signed/axis magnitudes for diagnostics, receive validity code `2`, and store zero instead of saturating to an apparently valid half-float. The invalid-basis case receives code `3` and stores zero. The circular cases publish deterministic zero orientation with `orientationDefined=false`.

### Native depth and registered scene probes

Three.js r187 produced native `[0,1]` depth using an observed `depth24plus` attachment. The shader reconstructs view position through `getViewPosition(sourceUv, sampledDepth, inverseProjection)`, transforms to world space, and converts metres to millimetres once at the physical-kernel boundary. Scene-depth observations were compared with independent registered Architecture Rise surface points:

| Surface | Canonical `U` | Reconstructed `U` | Signed `U` error | World-point error | Branches (canonical / reconstructed / kernel) |
| --- | ---: | ---: | ---: | ---: | --- |
| Near foreground plinth | `3090 mm` | `3090.004683 mm` | `+0.004683 mm` | `0.004963 mm` | finite-real / finite-real / finite-real |
| Far street-sign face | `5735 mm` | `5735.013008 mm` | `+0.013008 mm` | `0.013689 mm` | finite-real / finite-real / finite-real |
| Off-axis midground checker | `5045 mm` | `5041.058540 mm` | `−3.941460 mm` | `4.078358 mm` | finite-real / finite-real / finite-real |
| Asymmetric sign edge | `5735 mm` | `5735.013008 mm` | `+0.013008 mm` | `0.013909 mm` | finite-real / finite-real / finite-real |
| Far focus-chart cell | `8884 mm` | `8885.094643 mm` | `+1.094643 mm` | `1.105675 mm` | finite-real / finite-real / finite-real |

All five samples carry independent surface identity, sampled depth, validity code `1`, and `resolved` **probe-only** confidence; this vocabulary is not assigned to arbitrary pixels. Clear depth `1` produced code `0` and zero physical storage. An unreferenced visible pixel remains `not-assessed`.

The separate raster-derived canonical `U=f` probe reconstructs `U−f = −3.941460 mm` for a canonical `0 mm`; it is therefore `depth-limited`, and the kernel reports finite-virtual rather than the parallel-image limit. The explicit parallel-limit case is a separate controlled diagnostic input. The values show why rounded raster depth cannot establish exact `U=f`; they do not justify correcting the reconstructed focal branch. The M5 requalification must account for this depth limit without changing the M4 validity codes or inventing per-pixel confidence.

### Storage and validity

The r187 WebGPU backend reported the allocated/readback formats as `depth24plus`, `rgba16float`, and `rgba8unorm`. The capture retains TSL calculation values, observed 16-bit storage bit patterns, values decoded with Three.js `DataUtils.fromHalfFloat`, and a separate GPU sample of the stored texture. Every valid channel matches `DataUtils.toHalfFloat`; decoded storage and GPU sample differed by `0 mm` in the capture. Valid calculated-to-decoded storage error peaked at `0.00390625 mm` near binary16 maximum. Signed CoC, major/minor axis ordering, normalized modulo-π orientation and zero handling were preserved. Non-finite values do not pass the evidence gate as valid storage.

| Validity code | r187 observation |
| --- | --- |
| `0` no depth | Clear-depth samples use zero physical storage |
| `1` valid computation/storage | Visible registered samples and representable controlled values |
| `2` outside binary16 range | Positive/negative CoC and ellipse-radius overflow; all storage/readback/sample channels zero |
| `3` invalid geometry | Invalid lens basis; all storage/readback channels zero |
| `4` unresolved focal boundary | Existing code contract retained; raster-derived exact `U=f` is instead reported as depth-limited and does not claim parallel authority |

### M4 lifecycle and optional-pass isolation

| Check | Result |
| --- | --- |
| M3 Raw with M4 disabled | Native Raw frame and accepted host results remained valid; M4/M5 timing fields were null |
| M4 physical writer failure | Failure stayed local to the optional M4 writer; Raw frame completed and was accepted; a later request recovered |
| M4 validity writer failure | Failure stayed local; Raw frame completed and was accepted; a later request recovered |
| Unsupported M4 target storage | M4 reports `unsupported`; the native Raw request remains available and accepted |
| Resize during held M4 readback | Old request was rejected after resize; no stale diagnostic was published |
| Unmount during held M4 readback | Settled old readback was rejected; cleanup was confirmed after the work settled |
| Resource ownership | Adapter cleanup disposes its physical and validity render targets and reports confirmed cleanup before host acknowledgement. M4 borrows the source depth texture and registered scene resources; it does not own their disposal. The successful physical and Raw passes exercise those borrowed resources. No per-resource disposal counter was added. |
| Lifecycle authority | M7C host, generation, retry, cleanup and publication authority is unchanged |

These are bounded M4-specific checks, not a repeat of M7C's full failure matrix. The report links each native capture to its source SHA, exact invocation, renderer/runtime identity, request/channel/generation identity and observed host-frame result. M7C remains the lifecycle evidence for device-loss behavior and general failure recovery; M7D does not claim a new spontaneous or test-destroyed device-loss result.

### Revision and feature isolation

The audit found that before this change the M4 development flag could activate the pass without matching the installed renderer revision. An M6-capable session could also provision M4 resources using stale r186 M6 evidence. The new gate requires either a matching research-only M4 evidence revision or the exact trusted r187 qualification harness; an r186 M6 record cannot provision M4 on r187. The qualification harness gathers evidence but does not make M4 selectable as a renderer feature.

The new record is `m4-architecture-rise-physical-coc-native-r187-v1`, `research-only`, for `architecture-rise-raw-rtt-v1`, renderer family `webgpu-renderer`, API `webgpu`, revision `r187`. Backend-policy tests confirm M3 Raw remains independently eligible while M4 by itself, or combined with Raw in a feature-selection request, remains ineligible. r187 M5 Gather/B1 and M6 presentation remain denied; `m5q-architecture-rise-r186-v3` and `m6d-opaque-presentation-v1` remain unchanged. Unknown scenes/revisions fail closed.

Production-preview isolation passed 2 tests normally and 2 more with hostile Raw/M4/M5/M6/test-seam Vite flags. The production capture observed the WebGL renderer and WebGL2 execution, zero WebGPU module requests, no test-seam attributes, no application fallback, and contentful Ground Glass output. Production Ground Glass remains WebGL-only.

### Test results and remaining limits

The focused evidence run passed **203 tests in 22 suites**, including the M7D capture/report evaluator, M4 policy and contract, backend selection, M5 denial, M6 presentation policy, M7C lifecycle and host-state tests. The full `npm test` run passed **305 files / 3,206 tests**. `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build` all passed. Native E2E passed **3/3 M4 application tests**, **3/3 M4 failure-host tests**, **1/1 M3 Raw pilot regression**, and **8/8 Raw RTT regressions**. Production preview passed **2/2 baseline** and **2/2 hostile-flag** tests. The broad local Playwright suite was not run; focused native lifecycle and production-preview projects exercised this bounded change. Hosted CI will run against the published PR head.

Qualification is limited to the captured Chrome/macOS arm64 environment. Cross-browser/device behavior and hardware acceleration are not claimed. The M4 code path does not run M5 Gather, B1 reconstruction, the M5 research composite, or M6 presentation. M5/M6 require their own r187 numerical, storage, depth-confidence, lifecycle, and presentation evidence. M4 r187 research qualification does not complete M7, authorize M8/M9, or enable production WebGPU.

## Revision-bound decision

**Decision: research-qualified for the tested environment.** The new M4 record is scoped to the r187 Architecture Rise native Raw pilot and remains `research-only`. M3 Raw RTT keeps its independent existing development eligibility. M5/M6 r187 remain unqualified, production remains WebGL-only, M7 remains incomplete, and M8 is not authorized.
