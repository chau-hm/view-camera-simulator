# Local Reflection Technique Decision

**Decision:** no local-reflection technique is selected. PR M establishes and validates a renderer-side synthetic contract for independently focusing overlapping Ground Glass radiance contributions before combination. The ordinary production RTT still uses its unchanged one-source path, and no real reflection producer was implemented. Observer needs local-reflection radiance/color integration, but has no physical focus pass and does not require reflected virtual depth for focus.

**Confidence:** high that Ground Glass needs independent reflected-focus semantics to combine direct pane and reflected-scene radiance correctly; low about which reflection technique will give the best normal-scale image because no visual candidate was rendered.

Original PR base: `fe4a81e4c56ce7969a5982a936dad4b0a696c99f` (PR #232 merge). Current main at this review-fix sync: `8c1d78437dd20645feea3430f8e58b33a40a98e4` (PR #233 merge).

## Problem

PR I added fixed natural daylight to Architecture Rise. PR J added a procedural sky/ground PMREM environment. PR K tested two bounded built-in glazing material responses, then restored the accepted production material because the change was not useful at ordinary Observer or Processed Ground Glass scale. Those steps leave one question: whether nearby scene geometry should contribute recognizable radiance to the glazing.

The current production recipe remains `MeshStandardMaterial(color: #182d37, roughness: 0.24, metalness: 0.08)`. PR I daylight, PR J environment, and presentation lighting remain unchanged. No prototype or production render code is included in this PR.

## Current rendering constraints

### Observer

[`SceneRenderer.tsx`](../src/render/SceneRenderer.tsx) mounts an R3F `<Canvas>` and renders its scene directly. There is no retained Observer color/depth buffer or post-processing chain that a screen-space reflection pass could use. A screen-space technique would add its own scene capture, depth/normal inputs, resolve, and renderer-owned resources; SSR may use ordinary scene depth to reconstruct visible surfaces and ray-march. A CubeCamera or planar camera could render from the existing scene, but each needs its own targets on this renderer.

Observer is an appearance/rendering consumer: it needs local reflection radiance/color and the resources required by the selected technique. Because it has no physical CoC/DOF path, Observer does not need a separate reflected virtual-depth representation for focus. Any depth used by SSR is an algorithm input, not Ground Glass reflected-focus data.

### Ground Glass source and DOF

[`GroundGlassRTT.tsx`](../src/render/GroundGlassRTT.tsx) renders the registered Architecture Rise subject into a separate color/depth target owned by [`groundGlassRttResources.ts`](../src/render/groundGlassRttResources.ts). At the standard-quality baseline that target was 658×527; a depth texture was available. The implemented pass order in [`groundGlassPassGraph.ts`](../src/render/groundGlassPassGraph.ts) is:

```text
sceneRender → cocFootprint → farGather → nearGather → composite
```

The safe color insertion point is after `sceneRender` and before `cocFootprint`, using a separate resolved target rather than sampling from the target currently being rendered. Raw RTT bypass uses `sceneRender → composite`; Raw and Upright are display transforms applied to the same source path.

The CoC shader samples the single source depth texture, reconstructs one world point for each source pixel, and classifies that point against the physical focus state. There is no retained normal buffer; SSR would need to reconstruct normals or add one. The existing source depth may also be an SSR reconstruction/ray-marching input; that is distinct from reflected virtual-image focus semantics.

This is a Ground Glass limitation. Both renderer paths need reflected radiance/color, but only Ground Glass carries that radiance through physical focus processing. A glazing pixel can combine direct pane radiance at the pane depth with reflected radiance whose apparent virtual image may have different focus semantics. Assigning the pane depth to the blended color makes the reflection follow the pane's focus and blur; replacing it with reflected depth would give the pane's own radiance the wrong focus. Ground Glass therefore needs direct-pane and reflected contributions to retain independent focus semantics through CoC classification and aperture gather. Separate radiance/depth contributions or an equivalent optical representation could provide that. Observer does not require this focus representation unless it later gains a physical focus pass.

### Existing reflection-related code

- [`worldEnvironmentRig.ts`](../src/render/worldEnvironmentRig.ts) creates an independent PMREM target per scene/renderer for the shared PR J environment. It is a low-frequency environment, not a capture of local Architecture Rise geometry.
- A source search after syncing current main through PR #233 found no application/production use of `CubeCamera`, `WebGLCubeRenderTarget`/`CubeRenderTarget`, `Reflector`, `SSRPass`, `MeshReflectorMaterial`, or `EffectComposer`. `EffectComposer` appears only in `docs/SDD.md` as a suggested post-processing option.
- The Mirror Shift lesson uses explicit mirrored teaching geometry and a reflected camera proxy. [`mirrorShiftGeometry.ts`](../src/scenes/mirrorShiftGeometry.ts) has a point-across-plane calculation, and [`MirrorShiftSubjectFactory.tsx`](../src/render/MirrorShiftSubjectFactory.tsx) builds the virtual objects. This is not a reflection camera, clipped render target, or reusable real-time reflection primitive.
- Observer and RTT call the same registered Architecture Rise factory but build separate `Object3D` graphs and own separate renderer resources. A renderer-specific probe or planar target cannot be shared between them.
- Three.js r186 selects `material.envMap || scene.environment` for a material environment map. Assigning a probe directly to the glass would replace its PR J environment contribution unless the shader combines both.

## Candidate 0 — environment-only baseline

The baseline shows the low-frequency PR J environment response, but no recognizable nearby geometry in either façade. Front glazing remains dark at normal Observer scale. The side-return panes are a separate orientation and spatial region; they also remain dark in the alternate orbit. Processed Ground Glass carries the same scene appearance through the physical DOF path.

Baseline capture command: `npm run dream-loop:capture -- --pilot architecture-rise`, followed by standard-quality Ground Glass and interaction captures. Clean Observer and Teaching Observer match the PR K baseline hashes exactly.

| View | Ignored local capture | SHA-256 |
| --- | --- | --- |
| Clean Observer | `.dream-loop/architecture-rise/observer-clean.png` | `34b068da9c62ab9a8003ee6c3df3f518536917b01c18de3ca3c56fe5e00e1ed2` |
| Teaching Observer | `.dream-loop/architecture-rise/observer-teaching.png` | `2a160d700ccb511ce4ca727160ebb0b32186f443626b88a07ef895e5aa1d1bae` |
| Processed Ground Glass | `.dream-loop/architecture-rise/reflection-baseline-groundglass-processed.png` | `a59edb4f457f2ee9c664c7e2c3be9f3acadd924cb872108a0a90dc1443a3c940` |
| Raw Ground Glass | `.dream-loop/architecture-rise/reflection-baseline-groundglass-raw.png` | `a59edb4f457f2ee9c664c7e2c3be9f3acadd924cb872108a0a90dc1443a3c940` |
| Upright Assist | `.dream-loop/architecture-rise/reflection-baseline-groundglass-upright.png` | `859381d97a3ca8d0f249f1e74c5ab92b765de9ad03ab476b4fbb325bfe54727a` |
| Raw RTT bypass | `.dream-loop/architecture-rise/reflection-baseline-groundglass-raw-rtt-bypass.png` | `67986cc935c01215c59f805a8c7367407c3e9527456ad99d06e1241b27b03ed1` |
| Alternate Observer orbit | `.dream-loop/architecture-rise/reflection-baseline-alternate-observer.png` | `9842a1fbca7d7d04058cde1efa40aeb5e2d71fdc467af5283c87c86c1f58c1d6` |
| Rise 22 mm Observer | `.dream-loop/architecture-rise/reflection-baseline-rise-22-observer.png` | `3d7e44df22e16076d88d67ebcf957e350f1ed693fd714f3fdf901de0057161c0` |
| Rise 22 mm Processed Ground Glass | `.dream-loop/architecture-rise/reflection-baseline-rise-22-groundglass-processed.png` | `01a1a02e5b87d50df47340584e38a86e4dc699591bdd29ca2e84f9cf2d9e1764` |

Captures and profile JSON are ignored worktree evidence, not PR assets. The baseline profile used standard quality and the active GPU-query backend on a software-rendered browser. It completed only two timing frames: Ground Glass p50/p95 was 613.5/1,132.4 ms and physical DOF p50/p95 was 130.3/631.7 ms. Those sample counts and the software renderer are not decision-grade hardware performance measurements. No candidate cost is reported as measured.

Measured baseline: the standard Ground Glass source is 658×527 (346,766 texels). Estimated payload only: one full-size RGBA8 color target is about 1.32 MiB; a 4-byte depth target at that size would add about 1.32 MiB. A six-face 256×256 RGBA8 color cube is about 1.5 MiB per renderer. A depth/distance cube of the same assumed size would add about 1.5 MiB only for a Ground Glass focus representation that chooses that technique; Observer has no such focus-driven requirement. Two full-size planar RGBA8 color targets are about 2.64 MiB per renderer at the Ground Glass baseline dimensions. Any additional Ground Glass focus representation is unselected and not estimated; technique-specific depth inputs are also excluded. These are arithmetic estimates, not measured GPU allocations. Actual format, mip levels, alignment, and driver overhead depend on implementation, and Observer target dimensions may differ.

## Candidate 1 — screen-space reflections

**Status: rejected before prototype for this decision.** Ground Glass's existing source color/depth can support SSR reconstruction, and depth-derived normals are possible. Observer SSR would need its own ordinary scene-color/depth inputs and a reflection-color resolve. That depth is an SSR algorithm input, not reflected virtual-depth/focus data. Ground Glass may reuse its existing source color/depth for SSR inputs, but the resolve must preserve reflected radiance's independent focus semantics before `cocFootprint`. Observer has no corresponding DOF requirement. A color-only Observer result could inform appearance; color-only Ground Glass would make the reflected contribution inherit pane focus and would not test physically meaningful focus behavior.

The two renderers still need separate SSR integrations and renderer-owned resources; only Ground Glass additionally needs the reflected-focus contract. This remains a correctness stop for a cross-renderer decision whose acceptance includes Ground Glass focus, not a claim that SSR cannot be implemented later.

Screen-space visibility would also lose off-screen or hidden geometry, fade or break at screen edges, and change with camera motion and disocclusion. Those failure modes make the front/side result and teaching stability camera-dependent.

## Candidate 2 — local reflection probe / CubeCamera

**Status: rejected before prototype for this decision.** A CubeCamera can capture off-screen scene geometry, and its color contribution could enter either renderer's scene radiance. Observer needs that radiance for appearance but no distance representation for focus. A direction-only cubemap does not identify the reflected point's distance, so by itself it cannot provide Ground Glass with independent reflected-focus semantics. If the Ground Glass optical contract derives focus from captured distance, it may need depth/distance data or an equivalent representation; that requirement is Ground Glass-specific and the representation is not selected.

Observer and RTT would each need their own cube color target, capture lifecycle, and explicit recursion exclusion. A static teaching scene could capture once after scene/world changes rather than on every orbit; camera movement alone would not require a new scene capture, but it would change sampled directions. One probe point also creates parallax error across the front and side-return glazing. A second probe may be necessary. Direct `material.envMap` assignment would replace the existing scene environment in Three.js r186; preserving PR J requires an explicit blend.

The capture cost would be six scene renders per update per renderer. At the assumed 256×256 face size, the color cube estimate is about 1.5 MiB per renderer; an additional depth/distance cube is only a possible Ground Glass choice. No candidate allocation or runtime timing is measured because the technique was not prototyped.

## Candidate 3 — constrained / planar reflection

**Status: rejected before prototype for this decision.** The large front panes are approximately coplanar, but the side-return panes have a different plane and normal. At least two reflection views are therefore needed to avoid using a front capture on side glass. The current mirror lesson provides no reusable reflection camera, render target, clipping, or depth pipeline; it draws manually mirrored teaching objects instead.

Both Observer and Ground Glass need front- and side-oriented reflection radiance/color contributions. Only Ground Glass needs the direct pane and reflected contributions to retain independent focus semantics before CoC/DOF. Observer may need reflection cameras, clipping, pane assignment, color targets, and any scene/depth inputs required by the planar technique itself; those algorithm inputs are not Ground Glass virtual-focus data.

Observer orbit changes require recapturing the reflection views. With no common reflection primitive, the bounded plan is two added scene renders per frame per renderer (four across Observer and Ground Glass), plus renderer-owned color targets, camera/clipping setup, and pane assignment. Any extra Ground Glass focus representation remains unselected and is not an Observer depth-pair cost. This is a disproportionate first step before the optical representation is specified. The technique remains a candidate after that contract exists, especially because each façade orientation is planar.

## Comparison matrix

Ratings below distinguish current repository evidence from expected technique behavior. “Not measured” means no prototype was run; it must not be read as a visual or performance result.

| Criterion | Environment only | SSR | Probe / CubeCamera | Planar |
| --- | --- | --- | --- | --- |
| Nearby geometry visible | No; baseline capture | On-screen visible geometry only; not prototyped | Capturable from all directions; not prototyped | Visible in plane capture; not prototyped |
| Off-screen geometry | No | No | Yes, subject to capture scene and exclusions | Yes, subject to reflection camera frustum |
| Front glazing | Dark/flat in baseline | Unmeasured | Unmeasured | Unmeasured |
| Side glazing | Dark/flat in alternate orbit | View/screen dependent | One probe point may have parallax; second may be needed | Requires separate side-plane capture |
| Parallax correctness | Not applicable | Screen-space hit position; Ground Glass focus semantics remain separate | Inherently tied to probe point; Ground Glass focus may need distance data | Correct for each planar view if camera/plane mapping is correct; Ground Glass focus remains separate |
| Camera-motion stability | Stable | Sensitive to view, edges, and disocclusion | Stable for static scene, but point-probe parallax remains | Must update for Observer orbit and camera changes |
| Observer integration | Existing direct render | SSR scene-color/depth inputs plus reflection-color resolve; no focus-depth layer | Renderer-owned cube-color capture; no focus-depth cube | Front/side reflection-color views; depth only if the technique itself needs it |
| Ground Glass integration | Existing scene render and pane focus | Existing scene color/depth may serve as SSR inputs; preserve reflected focus semantics before CoC | Cube-color contribution before DOF; focus-distance input or equivalent may be needed | Reflection radiance before CoC plus independent reflected-focus semantics |
| Shared reflection radiance | Existing environment contribution | Local reflected color is needed in both paths; algorithm inputs are renderer-specific | Cube-color contribution is needed in both paths | Front/side color contributions are needed in both paths |
| Pre-DOF compatibility | Existing pane radiance | Ground Glass needs separate reflected-focus semantics; Observer has no focus pass | Ground Glass needs separate reflected-focus semantics; Observer has no focus pass | Ground Glass needs separate reflected-focus semantics; Observer has no focus pass |
| Raw/Upright compatibility | Existing behavior | Preserved if source resolve precedes DOF/display transform | Preserved if material contribution is in source render | Preserved if reflection is in source render |
| Extra renders | 0 | Observer: scene capture plus resolve; RTT: one resolve after its existing source render | Six cube faces per renderer/update | Two reflection scene renders per renderer/frame |
| Extra targets/textures | Existing per-renderer PMREM | Observer: SSR color/depth inputs and reflection resolve; Ground Glass: source inputs and focus representation (TBD) | One color cube per renderer; any focus-distance resource is Ground-Glass-only and contract-dependent | Two color targets per renderer; technique input depth only if needed; added focus representation is Ground-Glass-only |
| GPU cost | Baseline | Observer capture plus per-pixel bounded ray marching; RTT per-pixel resolve; unmeasured | Six-face scene capture on update; unmeasured | Two scene captures per frame per renderer; unmeasured |
| CPU / scene traversal | Existing path | Pass setup and normal/depth reconstruction; unmeasured | Scene traversal/capture and recursion exclusion; unmeasured | Reflection camera setup, clipping, and two captures; unmeasured |
| Memory | Existing scene and PMREM | Unmeasured; sizes/formats undecided; Ground Glass focus representation TBD | Estimated color cube about 1.5 MiB per renderer at 256² RGBA8; optional Ground-Glass-only depth cube adds about 1.5 MiB | Estimated two RGBA8 color targets about 2.64 MiB per renderer if each is 658×527; Observer size may differ and Ground Glass focus representation is unestimated |
| Lifecycle | Existing explicit PMREM ownership | Separate SSR inputs/resolve in each renderer; focus representation owned only by Ground Glass | Per-renderer cube-color targets/cameras/exclusions; any focus-distance resource only in Ground Glass | Per-renderer color targets/cameras/clipping/pane assignment; focus representation only in Ground Glass |
| WebGL r186 fit | Existing path | Possible with current WebGL/GLSL, but no app primitive | Three.js has CubeCamera; no app-owned local probe path | Possible with a custom Reflector-style implementation; none exists |
| WebGPU migration burden | Existing environment is renderer-owned | High: custom screen-space shaders and WebGL buffers | Medium/high: renderer-owned cube capture plus shader blend | High: camera clipping and render-target-specific reflection path |
| Implementation risk | Low | High: edge/occlusion limits, two integrations, and Ground Glass focus contract | Medium/high: parallax and Ground Glass focus contract | High: plane registration, two integrations, and Ground Glass focus contract |
| Teaching value | Low for local geometry | Potentially useful but view-dependent; unmeasured | Potentially useful, but Ground Glass focus may be misleading until represented; unmeasured | Potentially useful across each plane; unmeasured |

## Ground Glass reflected-focus semantics

For a perfect planar reflector, a scene point `Q` has a virtual reflected position `Q' = Q - 2n·dot(Q - P, n)`, where `P` and `n` define the pane plane. This describes an ideal mirror point; it does not prescribe a depth texture. Observer needs the resulting reflection radiance for appearance, while Ground Glass also needs a defined focus response for reflected radiance. With roughness `0.24`, a pane pixel may integrate radiance from a distribution of directions rather than one exact virtual point, so its focus behavior may not reduce to one depth per pixel.

A Ground Glass reflected-radiance/reflected-focus contract must preserve direct-pane and reflected contributions' focus semantics independently through CoC classification and aperture gather, then composite them while preserving existing Raw/Upright transforms and fallback behavior. Separate radiance/depth contributions or an equivalent optical representation may satisfy this contract; the exact number of depth textures, buffers, or CoC values is not established. Do not claim physically correct reflected focus until a dedicated optical representation is implemented and verified.

### PR M synthetic contract proof

**Status: contract validated for single-apparent-point contributions.** The renderer-local `GroundGlassRadianceContribution` input carries preweighted linear radiance and an RGBA apparent-world-position texture in renderer metres. The existing physical footprint kernel consumes those positions directly; each contribution then passes through its own existing far/near aperture gather. Focused radiance is added in linear space, and the shared film-level composite runs once afterward. Optional gather visibility depth is separate from focus position, remains local to a contribution, and is never used to occlude another contribution.

The test-only browser fixture is served directly by Vite and is not a public route or production build entry. It uses the current `groundGlassApparentWorldPositionCocFragmentShader`, `calculatePhysicalBlurFootprintFromWorldPosition`, `groundGlassApertureGatherFragmentShader`, and `groundGlassCompositeFragmentShader`; it does not generate reflection radiance from scene geometry. CPU reference uses `computePhysicalBlurFootprint` with a 150 mm lens at f/2.8:

| Case | Film focus | Direct CoC / major radius | Secondary CoC / major radius | Browser result |
| --- | ---: | ---: | ---: | --- |
| A — direct sharp | 1000 mm | 0 / 0 mm | −9.454 / 4.727 mm | Direct buffer signature `d35c1dc5`; secondary changed 16,384 / 16,384 pixels from its equal-focus reference |
| B — secondary sharp | 500 mm | +11.480 / 5.740 mm | 0 / 0 mm | Secondary buffer signature `875eff45`; direct changed 16,384 / 16,384 pixels from its equal-focus reference |
| C — equal focus | 1000 mm | 0 / 0 mm | 0 / 0 mm | Direct matches the one-contribution reference exactly; combined output matches the additive focused-layer reference with maximum byte delta 0 |

The current Chromium runner used ANGLE / Vulkan **SwiftShader**, so these hashes and visible A/B states validate shader execution and raster behavior on the software backend; they are not hardware-GPU timing or performance evidence. Images use 128×128 RGBA8 full-resolution targets. The two-contribution fixture owns ten render targets (0.625 MiB nominal target texel payload) plus two RGBA32F position inputs, two RGBA8 radiance inputs, and one 1×1 RGBA8 gather-depth fallback, for about 1.25 MiB nominal texel payload total. `renderer.info.memory.textures` reported 15. Each two-contribution frame executes ten full-resolution fixture passes (two CoC, four gathers, two per-contribution focus resolves, one radiance sum, one final composite); the single-contribution fixture path executes five and skips the sum. These are test-fixture costs only.

The ordinary `GroundGlassRTT` and `groundGlassPassGraph` were not changed: public scenes keep the same five-stage normal path, and Raw RTT Debug keeps `sceneRender → composite`. Therefore PR M adds zero recurring targets or passes to ordinary scenes. Raw/Upright, image circle, natural illumination, relative illuminance, Focus Loupe, Architecture Rise, and Interior Corner continue through their existing production implementation. The synthetic proof does not validate rough reflected radiance: with current glass roughness near `0.24`, real reflected energy may need a distribution of apparent focus positions rather than one point per sample.

## Decision and follow-up boundary

**No local-reflection technique is selected.** PR L established the local-geometry appearance gap. PR M validates the Ground Glass focus contract with synthetic radiance, but no candidate prototype proves that SSR, probe, or planar reflection improves normal-scale presentation. A color-only Observer render could inform appearance, but a color-only Ground Glass result would make reflected radiance inherit pane focus and fail the primary optical acceptance criterion. Candidate appearance and performance remain unmeasured.

Recommended next PR: return to a bounded reflection-technique comparison and connect candidate radiance plus apparent-focus inputs to the validated contribution seam. Candidate focus adapters may provide apparent-world-position fields or an equivalent optical representation; current evidence does not justify exactly two depth textures, buffers, or CoC values. Render candidates for both Observer appearance and Processed Ground Glass focus behavior, with front and side glazing, normal framing, an alternate orbit, a rise state, Raw/Upright regression checks, and paired resource/timing evidence. Keep the rough-reflection distribution limitation explicit and do not claim physically correct reflected focus until the selected optical representation is verified.

## Scope confirmation

Production behavior is unchanged: glass material, daylight, environment, presentation lighting, geometry, optics, image-circle behavior, task thresholds, exposure, natural shadows, external assets, and WebGPU/TSL. No screenshots, rendering prototypes, or new production abstractions are retained.
