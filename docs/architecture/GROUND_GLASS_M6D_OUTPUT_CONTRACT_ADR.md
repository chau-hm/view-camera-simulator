# M6D — Opaque Final Presentation Output Contract

**Status:** Accepted for the development-only Architecture Rise pilot
**Revision:** `m6d-opaque-presentation-v1`
**Implementation evidence:** `b5fc75513797707f969813dbcbe89fc892626c23`

## Context

M6 presents the completed M5 Far/Near research composite through the shared Ground Glass Stage. The visible Ground Glass surface is an opaque canvas. M6C found that the presentation TSL expression returns `source.a`, while the actual opaque Three.js r186 `MeshBasicNodeMaterial` stores alpha one. Its measured source-alpha result, `alpha-observable-contract-different`, accurately answers M6C's original question and remains historical evidence.

The stage data flow resolves whether that mismatch is an architecture defect. M5 Near alpha carries optical coverage while the Near image is composed over Far. The M5 research composite consumes that coverage once, writes completed linear RGB and alpha one, and is the registered M6 presentation source. M6 then applies RGB-only throughput, natural illumination, Image Circle coverage, and orientation/crop mapping. No current downstream stage consumes M5 Near coverage or requires transparent final Ground Glass composition.

M6B independently measured final canvas RGB and physical-overlay alignment. M6C independently measured target alpha with the actual M6 material. The `NoBlending` diagnostic variant changed the existing partial-alpha RGB result by as much as 87 eight-bit codes (RMSE `12.9577`) and was reverted.

## Decision

Adopt **Opaque Final Presentation** for the current development-only Architecture Rise pilot:

1. M5 Near alpha means optical Near coverage and remains meaningful only through the M5 Far/Near composite.
2. M5 Far alpha is one. M5 research composite RGB is complete after applying Near coverage exactly once; its alpha is one.
3. M6 samples only `m5-research-composite`. It applies the existing presentation operations to linear RGB and does not blend Far/Near again or read Near coverage.
4. The final M6 target and visible browser canvas are opaque, with alpha one. Coverage, natural illumination, and throughput affect RGB only.
5. The pre-material TSL/reference value `outputLinearRgba` continues to carry `source.a`. The separate expected target value `expectedOpaqueTargetLinearRgba`, produced by `finalizeGroundGlassOpaquePresentationRgba()`, expresses the actual opaque material contract. It is a CPU expectation, not runtime readback.

The contract revision is `m6d-opaque-presentation-v1`. The implementation preserves the existing TSL expression, material settings, RGB math, blending mode, and canvas behavior.

## Alternatives

| Alternative | Fit to current pipeline | Consequences | Decision |
| --- | --- | --- | --- |
| **A. Opaque Final Presentation** | M5 already consumes Near coverage and publishes completed opaque RGB; M6 and the visible canvas are already opaque. No current downstream consumer needs transparency. | Makes final alpha semantics explicit. Retains RGB and normal presentation behavior. Source-alpha preservation is not promised. | **Selected.** |
| **B. Source-Alpha-Preserving Presentation** | `source.a` exists in the intermediate TSL expression, but the registered M5 composite is already opaque and no current consumer requires its alpha to be preserved. | Requires a concrete transparent-composition consumer and a separately reviewed material/blending design. The investigated `NoBlending` variant regressed M6B RGB and cannot serve as an implementation. | Rejected for this pipeline. Reconsider only when a real consumer requires non-opaque output. |

| Decision criterion | Opaque Final Presentation | Source-Alpha-Preserving Presentation |
| --- | --- | --- |
| Existing product requirement | Matches the opaque Ground Glass view. | No current product requirement consumes transparency. |
| M3/M5/M6 data flow | M5 composites Far/Near and outputs alpha one before M6. | Would preserve an alpha that normal M5 input already sets to one. |
| Public WebGL behavior | Matches current opaque presentation. | Would introduce a new output contract not shared by public WebGL. |
| Current browser canvas | Matches WebGPU `alpha: false` and opaque canvas. | Requires a transparent canvas/output target and consumer definition. |
| Near coverage and B1 ownership | M5 consumes Near coverage once; M6 receives completed RGB. | Does not justify passing Near coverage through M6. |
| M6B RGB conformance | Retains the measured RGB pipeline. | Any material/blending change requires a new RGB-safe design and requalification. |
| M6C alpha readback | Stored alpha one is conformant to the selected opaque target contract; historical source-alpha mismatch remains true. | Confirms that the current material does not satisfy this alternative. |
| Color-space/output path | Leaves linear input, renderer sRGB conversion, and tone mapping unchanged. | Would need a material/output design that preserves existing conversion and RGB. |
| Downstream consumers | No current consumer needs non-opaque Ground Glass. | Requires a specific existing consumer; none was found. |
| Complexity and regression risk | Small semantic clarification with unchanged rendering behavior. | Requires material/compositing changes; the diagnostic `NoBlending` path regressed RGB. |
| Future M7 integration | Provides a completed opaque frame contract for this pilot. | Would require a newly specified alpha-capable host/output interface. |
| Future M8 qualification | Does not claim broad scene or material support. | Would need explicit per-scene/material transparency qualification. |

The choice follows the existing product and data-flow requirements, not the convenience of the current material. Near coverage and final presentation alpha represent different quantities. The public WebGL Ground Glass remains opaque; M6's `alpha: false` WebGPU canvas agrees with that presentation requirement. M6B RGB, physical fixture, color conversion, Raw/Upright, and Focus Loupe evidence remain applicable. M6C's alpha-preservation failure is not relabeled as a pass.

## Stage alpha ownership

| Stage | Alpha meaning | Evidence / M6D rule |
| --- | --- | --- |
| M3 scene source | Scene color plus alpha in the `rgba8unorm` source target. For the supported Architecture Rise materials and opaque clear, the scene source is used as opaque scene input. Separate physical/depth/validity data carries optical authority. | The current supported scene does not declare a transparent-scene consumer. Do not generalize this observation to unqualified scenes/materials. |
| M5 Far | Storage/output alpha one; Far alpha does not represent Near coverage. | Native M5 target and implementation return `vec4(selectedFarRgb, 1)`. |
| M5 Near | Optical Near coverage, not display transparency. | Coverage is read from Near alpha by the M5 research composite. M5/B1 qualification remains unchanged. |
| M5 research composite | Completed linear RGB and alpha one. | `Far.rgb * (1 - clamp(Near.a, 0, 1)) + Near.rgb * clamp(Near.a, 0, 1)`. Near coverage is consumed once. |
| M6 presentation | RGB-only display transforms; final alpha one. | Source is the completed `m5-research-composite`; the opaque material stores alpha one. No second Far/Near composition. |
| Visible canvas | Opaque browser output. | WebGPU renderer initializes with `alpha: false`; Native M6C also records opaque canvas alpha mode. |

## Evidence and decisions

The Native controlled composite probe uses the production `createGroundGlassResearchCompositeNode()` with known Far/Near values, and runs on an already-mounted Native WebGPU renderer. At coverage values `0`, `0.25`, `0.5`, `0.75`, and `1`, it measured exact expected RGBA16F outputs:

```text
0.00 → [0.7500, 0.5000, 0.2500, 1]
0.25 → [0.6250, 0.5625, 0.3125, 1]
0.50 → [0.5000, 0.6250, 0.3750, 1]
0.75 → [0.3750, 0.6875, 0.4375, 1]
1.00 → [0.2500, 0.7500, 0.5000, 1]
```

The same test records the registered Architecture Rise M5 capture identity and its completed `researchComposite` pass. Separately, the registered-app M6 Native suite confirms a completed presentation sourced from `m5-research-composite`, native `webgpu-renderer` / `webgpu` execution, and no fallback. The M6B oracle remains nine cases / 206 samples with maximum channel error one code and worst RGB RMSE `0.204125`; its 14-capture physical fixture remains within the per-capture 2 CSS px / 1.25 CSS px RMS limits. M6C remains 13 captures / 195 alpha samples: stored target alpha one, target-storage error zero, source-alpha preservation maximum error one and RMSE `0.6453784431632674`, with independent RGB maximum/RMSE zero.

The M6D contract decision is `opaque-presentation-contract-conformant`. Final-output conformance is `final-output-conformant` for the exact supported pilot boundary. Architecture status is `architecture-implemented` for the registered development-only Architecture Rise pilot and its supported presentation contracts. Photographic quality remains `quality-unqualified`; production WebGPU remains `production-webgpu-disabled`.

Code and evidence references: [`groundGlassApertureGatherNodes.ts`](../../src/render/webgpu/groundGlassApertureGatherNodes.ts) defines Far alpha one, Near coverage alpha, and the final composite equation; [`groundGlassPresentationNodes.ts`](../../src/render/webgpu/groundGlassPresentationNodes.ts) samples the composite and applies RGB presentation gains; [`GroundGlassWebGPUAdapter.tsx`](../../src/render/webgpu/GroundGlassWebGPUAdapter.tsx) selects `m5-research-composite` and creates the renderer with `alpha: false`; [`groundGlassPresentationReference.ts`](../../src/render/webgpu/groundGlassPresentationReference.ts) separates pre-material output from the expected opaque target; [`GROUND_GLASS_M6B_REVIEW_FIX_1_REPORT.json`](GROUND_GLASS_M6B_REVIEW_FIX_1_REPORT.json) and [`GROUND_GLASS_M6C_REVIEW_FIX_1_REPORT.json`](GROUND_GLASS_M6C_REVIEW_FIX_1_REPORT.json) retain the physical/RGB and material/alpha evidence.

## Rejected shortcuts

- Do not use `NoBlending` merely to force source alpha into a target.
- Do not rewrite M6C's measured source-alpha preservation failure as a pass.
- Do not treat alpha one as evidence of optical or photographic quality.
- Do not infer broader scene, material, device, browser, or production support from this Architecture Rise decision.
- Do not add Near blending, a transparency UI, an alpha readback in normal frames, or a new global compositor.

## Consequences and limits

M5 owns optical coverage composition; M6 owns visible RGB presentation and opaque output. A future requirement for transparent Ground Glass composition must identify its real downstream consumer and define a new output/material contract with RGB conformance evidence. Revisit this ADR if such a consumer appears, renderer/material output semantics change, or the M5 research composite stops being completed opaque RGB.

This decision closes the M6 output-contract dependency so M7 can be considered after M6D review and merge. It does not implement M7, qualify photographic blur, change M5Q, support other scenes/materials, establish multi-device compatibility, or authorize production WebGPU. The registered Architecture Rise scene itself still has a decorative CSS grid; the M6B physical overlay result is controlled-fixture scoped.
