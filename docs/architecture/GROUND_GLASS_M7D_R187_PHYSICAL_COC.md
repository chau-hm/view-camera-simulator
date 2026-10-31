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
| Evaluator | `m7d-physical-coc-evidence-v2`; it independently recomputes the CPU oracle from persisted inputs and checks runtime identity, readback, storage bits, host acceptance and report inventory |

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

The focused evidence run passed **203 tests in 22 suites**, including the M7D capture/report evaluator, M4 policy and contract, backend selection, M5 denial, M6 presentation policy, M7C lifecycle and host-state tests. The full `npm test` run passed **305 files / 3,206 tests**. `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build` all passed. Native E2E passed **3/3 M4 application tests**, **3/3 M4 failure-host tests**, **1/1 M3 Raw pilot regression**, and **8/8 Raw RTT regressions**. Production preview passed **2/2 baseline** and **2/2 hostile-flag** tests. The broad local Playwright suite was not run; focused native lifecycle and production-preview projects exercised this bounded change. Both hosted CI runs passed for published source head `e2e046bfc1d34f70dd20eb6eb6eed504008aa78d` (run IDs `41219180500` and `41219124788`); deployment jobs were skipped.

Qualification is limited to the captured Chrome/macOS arm64 environment. Cross-browser/device behavior and hardware acceleration are not claimed. The M4 code path does not run M5 Gather, B1 reconstruction, the M5 research composite, or M6 presentation. M5/M6 require their own r187 numerical, storage, depth-confidence, lifecycle, and presentation evidence. M4 r187 research qualification does not complete M7, authorize M8/M9, or enable production WebGPU.

## M7D Review-Fix Round 1 — Independent Oracle and Report Integrity

This review-fix closes three report-integrity findings without changing the native renderer, M4 shader, stored measurements, optical math, or frozen GPU tolerances. The persisted native capture remains sourced from `7118694af4a32a0827e5575519dc49be82c3b23e`; no GPU recapture was needed. The report now names evaluator contract `m7d-physical-coc-evidence-v2`, separately from M4 feature evidence `m4-architecture-rise-physical-coc-native-r187-v1`.

### F1 — Recomputed CPU oracle and input integrity

Before the correction, executed mutation tests confirmed the evaluator accepted the committed `ellipse-circular` result after its recorded lens normal was changed to zero and after it was changed to a materially different finite direction. The serialized CPU reference, GPU calculation, storage, and validity fields had remained untouched. The evaluator was using the serialized CPU object as its oracle.

The v2 evaluator rebuilds the `computePhysicalBlurFootprint()` input from each case's persisted controlled object point and full recorded lens/film geometry. It validates all required vector shapes and finite components, positive focal length and f-number, normalized sample coordinates, and finite metre-to-millimetre conversions. Lens centre and film point are converted from metres to millimetres once; the film-plane signed distance is recomputed from the converted point and recorded normal. Normals and bases stay dimensionless. The evaluator does not regenerate fixture values from a case ID and does not use GPU values to calculate the oracle.

Each of the 17 captured vectors is also compared with its committed SHA-256 input identity. This detects edited vectors even when a changed basis is numerically invariant for a circular aperture. These digests identify the controlled vectors; they are not signatures or a substitute for the capture's source SHA and test provenance.

The recomputed `valid`, signed CoC, and ellipse radii must match the serialized CPU reference within `1e-12 mm`; valid orientation is compared modulo π within `1e-12 rad`. The evaluator reports the maximum reference discrepancies separately. GPU values are then checked against the recomputed result using the existing `max(0.0005 mm, 0.00002 × |CPU|)` tolerance and `0.003 rad` modulo-π limit. Those limits were not changed. The required `invalid-geometry-lens-basis` control remains a valid negative-control test only when recomputation independently returns invalid, GPU validity is `3`, and all stored channels are zero. An invalid result in another case, or valid geometry substituted into this control, is rejected.

The permanent tests use the persisted capture, not a second test-only optics implementation. They reject mutated lens/film normals and bases, film point, focal length, aperture, object point, lens centre and unit scale; altered CPU references (including CPU/GPU values changed together); missing or non-finite inputs; invalid-control substitution; unexpected/duplicate CPU references; mismatched GPU probe identity; GPU sign/axis/orientation mutations; and storage/focal-contract violations. Positive controls retain all 17 cases, invalid geometry, exact zero, signed-small values, representable near-limit storage, and zeroed over-range storage.

### F2 — Scenario identity fixes the evidence kind

The report now fixes the eight required scenario IDs to their evidence classes: six native scenarios, `m5-m6-isolation` as `unit`, and `production-webgl-isolation` as `production-preview`. Each report value must match this mapping exactly. Native runtime, ordered-event, artifact, and limitation checks are selected from the trusted scenario mapping, so changing a native scenario's serialized kind cannot bypass those checks. The executed pre-fix mutation changed `native-r187-physical-kernel` from `native` to `unit`; the old evaluator accepted it. New negative controls cover all wrong-kind directions, missing and unknown kinds, unknown/duplicate IDs, and missing runtime evidence after a native label is altered. The unit and production-preview scenarios are not required to provide native GPU identity.

### F3 — Computed inventory and qualification

Before the correction, executed mutations showed that the prior evaluator accepted an independently altered `qualification` and an independently altered `scenarioCount` (including omitted/unknown qualification and 7/9/missing count variants). The v2 evaluator returns report validation status, computed status counts, computed scenario count, and computed qualification as separate fields. It requires exactly the eight known scenario identities, exact status-count keys with finite non-negative integers, and `scenarioCount` equal to the inventory length.

Qualification is derived only after inventory, evidence provenance, runtime requirements, report counts, M4 revision, M5/M6 denial, and production isolation have been validated. A structurally consistent inventory with eight passed scenarios and no evidence issues derives `research-qualified-for-tested-environment`; a consistent inventory containing blocked or not-run cases derives `partially-qualified`; a failed scenario or invalid report/evidence derives `not-qualified`. A declared value that differs from the computed decision fails report validation. Tests cover all three decisions and the requested count, qualification, and passed-to-blocked/failed mutations.

### Review-fix validation and preserved boundaries

The F1, F2, and F3 defects were reproduced with executed tests before the evaluator change. The v2 evaluator and persisted capture/report then passed the focused M7D integrity suite. The M7D evaluator suite contains 71 tests: 65 invalid-evidence mutation cases and six positive/provenance controls. The broader focused validation passed **247 tests in 22 suites**; the full `npm test` passed **3,250 tests in 305 files**. Typecheck, lint, CSS structure, and production build all passed. The focused Vitest JSON artifact, source commit `2538a0f5bcdff247d1bd356140c5e0e61dd8a0d4`, and computed evaluator results are recorded in the machine-readable report. The existing native capture's source SHA and original evaluator provenance `08e4a5d0394f37edb17705f0c4445c545ca5203e` remain historical and unchanged.

No native GPU E2E suite was rerun: the correction changes only the Node-side evidence evaluator, unit regressions, report contract metadata and this document. The checked-in r187 native capture passes v2 with zero CPU-reference recomputation error and zero modulo-π reference orientation error; its existing native provenance is preserved. The report still computes **8 passed, 0 failed, 0 blocked, 0 not-run**, with qualification `research-qualified-for-tested-environment` and compatibility status `research-only`.

M4 remains research-only. M3 Raw RTT retains its separate development authorization. r187 M5/M6 remain unqualified and denied; historical r186 M4/M5/M5Q/M6 records are unchanged. M7 remains incomplete, M8/M9 are not authorized, and production Ground Glass remains WebGL-only.

## Revision-bound decision

**Decision: research-qualified for the tested environment.** The new M4 record is scoped to the r187 Architecture Rise native Raw pilot and remains `research-only`. M3 Raw RTT keeps its independent existing development eligibility. M5/M6 r187 remain unqualified, production remains WebGL-only, M7 remains incomplete, and M8 is not authorized.
