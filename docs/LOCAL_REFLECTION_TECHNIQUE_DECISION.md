# Local Reflection Technique Decision

**Decision:** no local-reflection technique is selected. PR M validates the renderer-side synthetic contract for independently focusing overlapping Ground Glass radiance contributions before combination. PR N temporarily rendered planar, SSR, and local CubeCamera candidates against Architecture Rise, then removed the prototype code. Planar and probe color captures did not show a useful normal-scale benefit; SSR did not establish a reliable hit in the tested views. None supplied the independent Ground Glass focus behavior needed for selection. The ordinary production RTT retains its unchanged one-source path. Observer needs local-reflection radiance/color integration, but has no physical focus pass and does not require reflected virtual depth for focus.

**Confidence:** high that Ground Glass needs independent reflected-focus semantics to combine direct pane and reflected-scene radiance correctly; low about which reflection technique will give the best normal-scale image or performance. The temporary candidates were visually exercised, but none demonstrated a compelling normal-scale benefit with a focus-correct Ground Glass path.

PR N base: `7d7ad4f5566780d6ed51e7030e2592016dba35c8` (`origin/main`, confirmed before finalization). Earlier PR L base: `fe4a81e4c56ce7969a5982a936dad4b0a696c99f` (PR #232 merge).

## Problem

PR I added fixed natural daylight to Architecture Rise. PR J added a procedural sky/ground PMREM environment. PR K tested two bounded built-in glazing material responses, then restored the accepted production material because the change was not useful at ordinary Observer or Processed Ground Glass scale. Those steps leave one question: whether nearby scene geometry should contribute recognizable radiance to the glazing.

The current production recipe remains `MeshStandardMaterial(color: #182d37, roughness: 0.24, metalness: 0.08)`. PR I daylight, PR J environment, and presentation lighting remain unchanged. PR N's development-only render prototypes are temporary evidence and are removed from the final PR diff.

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
- The re-audit of `origin/main` at `7d7ad4f5566780d6ed51e7030e2592016dba35c8` (PR #236) found no production use of `CubeCamera`, `WebGLCubeRenderTarget`/`CubeRenderTarget`, `Reflector`, `SSRPass`, `MeshReflectorMaterial`, or `EffectComposer`. PR #235 adds a development-only Ground Glass subject profile and diagnostics lifecycle; PR #236 adds the reflected-focus contract and synthetic proof, not a scene reflection producer. `EffectComposer` appears only in `docs/SDD.md` as a suggested post-processing option. The PR N candidate primitives below were development-only and are reverted from the final tree.
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

Measured baseline: the standard Ground Glass source is 658×527 (346,766 texels). The following are nominal texel payloads for the temporary prototypes, not measured VRAM; renderbuffer attachments, alignment, and driver overhead are excluded:

- Planar: two 256×256 RGBA16F color targets per renderer = 1 MiB per renderer (2 MiB across Observer and Ground Glass). No reflected-focus resource was implemented.
- SSR: one 256×256 RGBA16F color target plus one 256×256 32-bit depth texture per renderer = 0.75 MiB per renderer (1.5 MiB total). This depth is SSR input data, not reflected virtual depth.
- Local probe resource model: Observer needs one 128² RGBA8 color cube (0.375 MiB) and no focus-distance cube. Ground Glass needs the same color cube plus one 128² RGBA16F radial-distance cube (0.75 MiB) if the selected focus contract uses captured distance: 1.125 MiB for Ground Glass and 1.5 MiB total across both renderers. The temporary harness redundantly allocated the distance cube in Observer too; that 0.75 MiB is not an Observer requirement and is excluded from this corrected ownership estimate.

The measured dimensions above describe the Ground Glass source target, not the temporary candidate target sizes. Candidate performance was not measured; the short software-renderer baseline timings above are not candidate comparisons or hardware evidence.

## Candidate comparison protocol

The temporary candidates used the same `0.18` reflected-color weight and pane geometry assignments. Browser captures covered normal Observer framing, Processed Ground Glass with the pane-focused setting (8,890 mm), the estimated reflected-point setting (12,470 mm, within the 13,000 mm public control range), a 22 mm rise state, and an alternate orbit. The alternate orbit was repeated with the same 24 px drag for the clean probe/baseline pair (Observer camera position `11.037666, 3.000000, 0.323947`). The Ground Glass test source remained 1032×826 in those captures.

These were bounded appearance/resource pilots, not candidate performance benchmarks. Each Ground Glass color overlay was combined into the existing single-depth source render. None connected a reflected contribution and its virtual-position field to an independent CoC/gather path, so none proves reflected focus. No candidate's Raw/Upright behavior was separately changed or used to establish selection.

## Candidate 1 — constrained / planar reflection

**Status: rendered, not selected.** The prototype derived front and side reflection planes from their glazing meshes, rendered two 256×256 RGBA16F color targets per renderer, and assigned the corresponding pane masks. It exercised Observer and Ground Glass, including default focus, the 12,470 mm focus setting, rise, and an alternate-orbit capture. The default clean Observer comparison did not show a useful normal-scale appearance improvement. The alternate-orbit attempt used a camera state mostly behind the building, so that frame is retained as a diagnostic capture but excluded from visual comparison.

Both renderers need front/side reflection radiance and their own camera, clipping, pane assignment, and color resources. The prototype added two reflection renders per frame per renderer. Its Ground Glass color was present before the existing CoC pass but remained associated with the pane's source depth. Observer needs no reflected virtual-depth resource; Ground Glass still needs independent reflected-focus semantics or an equivalent representation. The prototype supplied neither.

The nominal color-target payload was 1 MiB per renderer (two 256² RGBA16F targets), 2 MiB total, excluding renderbuffer and driver overhead. The normal-scale image did not justify selecting planar reflection before the Ground Glass contribution path can represent its focus behavior.

## Candidate 2 — screen-space reflections

**Status: bounded prototype rendered, no usable local reflection established.** Each renderer captured scene color into one 256×256 RGBA HalfFloat target and ordinary scene depth into one 256×256 UnsignedInt depth texture. On the Chromium WebGL2 runner, `EXT_color_buffer_float` was present and the color framebuffer was complete (`0x8cd5`). The pane-only shader used a bounded 64-step screen-space ray march. The correct reflected-ray orientation did not produce a reliable visible hit in the captured default or alternate views. A diagnostic run with the opposite direction found façade self-geometry, so those hits were not counted as reflected scene content.

Observer needs SSR's ordinary scene color/depth algorithm inputs and reflection-color resolve; that depth is not Ground Glass virtual-image depth. The Ground Glass prototype likewise used its own renderer-local color/depth capture. A real Ground Glass integration could reuse the existing source depth for SSR reconstruction, but it would still need to route reflected radiance through independent focus semantics before `cocFootprint`. No virtual-position field or contribution-local focus pass was produced by this prototype. Off-screen geometry remains unavailable to SSR, and screen-edge, occlusion, and disocclusion behavior remain view-dependent.

The nominal captured color-plus-depth texture payload was 0.75 MiB per renderer (0.5 MiB RGBA16F color plus 0.25 MiB 32-bit depth), 1.5 MiB total. The extra scene capture was rendered each frame; candidate GPU time and hit coverage were not measured. The framebuffer capability passing does not establish a visually useful SSR result.

## Candidate 3 — local reflection probe / CubeCamera

**Status: color and distance capture rendered, not selected.** The temporary harness captured one local 128² CubeCamera color cube at `(1.45, 8.8, 8.55)` m and one RGBA HalfFloat radial-distance cube in each renderer. The probe excluded the pane meshes and reflection masks during capture. A pane shader sampled both cubes and computed an approximate mirrored point using the pane plane; that value was not written into a Ground Glass contribution or CoC target. The harness allocated distance data in Observer as well, but that is unnecessary: Observer needs the color cube only. A chosen Ground Glass focus contract may use the distance cube or an equivalent focus representation.

On Chromium WebGL2, `EXT_color_buffer_float` was present and both color and distance framebuffers were complete (`0x8cd5`). Half-float linear filtering was unavailable, so the distance cube used nearest filtering; the color cube was UnsignedByteType with linear filtering. No half-float linear-filtering fallback was needed. The local probe color was only subtly different from the same-camera baseline at normal display scale: the pane crop's absolute luminance difference averaged 1.85/255 in the default view and 1.11/255 in the matched alternate orbit, with a maximum of 35/255 in each crop. This did not yield a clearly recognizable façade reflection at normal scale.

Ground Glass captures at 8,890 mm and 12,470 mm confirmed only the existing source/DOF path; the reflected color remained on the pane-depth source pixel. It did not pass Case A/B-style independent focus evidence. The single probe point also has parallax across front and side glazing, and the distance-to-point reconstruction is approximate. Current roughness near 0.24 may require distributed apparent-focus semantics rather than one point.

The harness's actual nominal payload was 1.125 MiB per renderer: 0.375 MiB for the RGBA8 color cube and 0.75 MiB for the RGBA16F distance cube (2.25 MiB across both renderers), excluding per-face depth attachments and driver overhead. Correcting ownership removes the redundant Observer distance cube, giving the resource-model estimate of 0.375 MiB for Observer and 1.125 MiB for Ground Glass (1.5 MiB total). The harness updated six faces for each target in both renderers: 12 scene renders per renderer on initialization/world update. With the corrected ownership, Observer would render six color faces and Ground Glass twelve faces for color plus distance. Performance was not measured; a production lifecycle would need to invalidate the capture when reflected world content changes.

## Comparison matrix

Ratings distinguish prototype observations from unmeasured performance or unimplemented focus behavior.

| Criterion | Environment only | Planar | SSR | Probe / CubeCamera |
| --- | --- | --- | --- | --- |
| Nearby geometry at normal scale | No; baseline capture | Captured, but no useful normal-scale improvement | No reliable hit in the tested views | Small pane-region difference; not clearly recognizable |
| Off-screen geometry | No | Only within reflection-camera frustum | No | Available in the captured cube, subject to exclusions |
| Front glazing | Dark/flat baseline | Color capture rendered; pane-depth focus only | No reliable correct-direction hit | Small visual difference in clean comparison |
| Side glazing | Dark/flat baseline | Separate side-plane capture required; alternate attempt was not a useful view | View/screen dependent; no reliable hit | Sampled by same local probe; parallax remains |
| Parallax / image mapping | Not applicable | Plane-specific projective mapping | Screen-space hit position | Tied to one probe point; approximate distance-to-point reconstruction |
| Observer focus/depth need | None | Color/radiance only | Ordinary scene depth may be an SSR input; no reflected virtual depth for focus | Color cube for appearance; distance is not required for Observer focus |
| Ground Glass focus need | Existing pane depth | Independent reflected-focus semantics still required | Independent reflected-focus semantics still required; SSR input depth is distinct | Independent reflected-focus semantics still required; distance cube alone was not integrated |
| Candidate Ground Glass result | Existing pane path | Reflection color inherited pane depth | No useful color hit; no virtual-position output | Reflection color inherited pane depth; approximate virtual point not connected to CoC |
| Production pre-CoC integration | Existing one-source path | None retained | None retained | None retained |
| Raw/Upright candidate validation | Existing behavior | Not separately validated | Not separately validated | Not separately validated |
| Extra renders in prototype | 0 | Two reflection views per renderer per frame | One scene color/depth capture per renderer per frame, plus pane ray march | Harness: 12 per renderer (six color, six distance); corrected ownership: Observer 6, Ground Glass 12 |
| Extra targets per renderer | Existing PMREM | Two 256² RGBA16F color targets | One 256² RGBA16F color target + one 256² UnsignedInt depth texture | Observer: one 128² RGBA8 color cube; Ground Glass: color cube + optional 128² RGBA16F distance cube |
| Nominal candidate target payload | Existing scene and PMREM | 1 MiB per renderer | 0.75 MiB per renderer | Observer: 0.375 MiB; Ground Glass: 1.125 MiB when distance is selected |
| GPU performance | Baseline only; not decision-grade | Unmeasured | Unmeasured | Unmeasured |
| Lifecycle concern | Existing PMREM ownership | Camera/clipping update per renderer | Capture and depth/normal reconstruction per renderer | Recapture when reflected world content changes; parallax persists |
| Main limitation | No local geometry response | Ground Glass focus plus two orientations | On-screen visibility, edges, disocclusion, and no reliable tested hit | Single-point parallax and no connected Ground Glass focus path |
| Selection result | Baseline | Not selected | Not selected | Not selected |

## Ground Glass reflected-focus semantics

For a perfect planar reflector, a scene point `Q` has a virtual reflected position `Q' = Q - 2n·dot(Q - P, n)`, where `P` and `n` define the pane plane. This describes an ideal mirror point; it does not prescribe a depth texture. Observer needs the resulting reflection radiance for appearance, while Ground Glass also needs a defined focus response for reflected radiance. With roughness `0.24`, a pane pixel may integrate radiance from a distribution of directions rather than one exact virtual point, so its focus behavior may not reduce to one depth per pixel.

A Ground Glass reflected-radiance/reflected-focus contract must preserve direct-pane and reflected contributions' focus semantics independently through CoC classification and aperture gather, then composite them while preserving existing Raw/Upright transforms and fallback behavior. Separate radiance/depth contributions or an equivalent optical representation may satisfy this contract; the exact number of depth textures, buffers, or CoC values is not established. Do not claim physically correct reflected focus until a dedicated optical representation is implemented and verified.

### PR M synthetic contract proof

**Status: contract validated for single-apparent-point contributions.** The renderer-local `GroundGlassRadianceContribution` input carries preweighted linear radiance and an RGBA apparent-world-position texture in renderer metres. The existing physical footprint kernel consumes those positions directly; each contribution then passes through its own existing far/near aperture gather. Focused radiance is added in linear space, and the shared film-level composite runs once afterward. Optional gather visibility depth is separate from focus position, remains local to a contribution, and is never used to occlude another contribution.

The test-only browser fixture is served directly by Vite and is not a public route or production build entry. It uses the current `groundGlassApparentWorldPositionCocFragmentShader`, `calculatePhysicalBlurFootprintFromWorldPosition`, `groundGlassApertureGatherFragmentShader`, and `groundGlassCompositeFragmentShader`; it does not generate reflection radiance from scene geometry. CPU reference uses `computePhysicalBlurFootprint` with a 150 mm lens at f/2.8:

| Case | Film focus | Direct CoC / major radius | Secondary CoC / major radius | Browser result |
| --- | ---: | ---: | ---: | --- |
| A — direct sharp | 1000 mm | 0 / 0 mm | −9.454 / 4.727 mm | Direct display hash `eedd195d`; secondary changed 16,381 / 16,384 pixels from its equal-focus reference |
| B — secondary sharp | 500 mm | +11.480 / 5.740 mm | 0 / 0 mm | Secondary display hash `ed904365`; direct changed 16,384 / 16,384 pixels from its equal-focus reference |
| C — equal focus | 1000 mm | 0 / 0 mm | 0 / 0 mm | Direct display hash `eedd195d` matches the one-contribution reference; secondary display hash `ed904365` |

The Chromium runner used ANGLE / Vulkan **SwiftShader**. The proof verified WebGL2, `EXT_color_buffer_float`, and an RGBA32F framebuffer status of `0x8cd5` (complete); the combined radiance target was read directly into a `Float32Array`. Unsupported float color targets fail the fixture; it has no RGBA8 fallback. Float radiance inputs and intermediate targets use nearest filtering, so this proof does not depend on float linear filtering. The CoC/footprint target remains encoded RGBA8 / UnsignedByteType and continues to use `decodeGroundGlassSignedCoCByte()` and `decodeGroundGlassFootprintAxesMm()`.

### Case C unclamped radiance accumulation

The sharp central probe at pixel (64, 64) writes direct red 0.75 and secondary red 0.75 from Float32 linear-radiance inputs. Their focused RGBA32F target readbacks are each 0.75. The pre-display combined RGBA32F target reads 1.50, matching the expected sum within 0.0001 and exceeding 1.0. No byte conversion participates in this assertion.

A separate 1×1 legacy RGBA8 accumulator control writes the same focused inputs and reads red byte 255, its maximum normalized value of 1.0; this reproduces the old intermediate-clipping defect. The final shared composite also writes the central 1.50 result to its RGBA8 display target, where red is byte 255. That downstream display clipping is allowed and is not used as the radiometric oracle.

Display-only FNV-1a hashes are: direct A/C `eedd195d`, secondary A `9c1ed726`, direct B `080ef2c0`, secondary B/C `ed904365`, and combined display A/B/C `497d7ad2` / `e92fd095` / `a3401aa1`. These hashes and visible A/B states describe bounded display output on SwiftShader, not numeric radiance or hardware-GPU performance.

Resource report for the 128×128 fixture: two RGBA8/UnsignedByteType CoC targets; six RGBA32F/FloatType contribution targets (two each for far gather, near gather, and focused contribution); one RGBA32F combined-radiance target; one RGBA8 display target; and one 1×1 RGBA8 legacy accumulator control. Inputs are two RGBA32F radiance textures, two RGBA32F apparent-position textures, and one 1×1 RGBA8 visibility-depth texture. `renderer.info.memory.textures` reported 16. Nominal target texel payload is 2,031,620 bytes (1.9375 MiB + 4 bytes); nominal input texel payload is 1,048,580 bytes (1 MiB + 4 bytes), about 2.9375 MiB + 8 bytes combined. These are nominal texel estimates, not measured VRAM.

Each two-contribution frame executes ten full-resolution passes (two CoC, four gathers, two per-contribution focus resolves, one radiance sum, one shared composite); the single-contribution fixture path executes five and skips the sum. The one-pixel legacy byte control is an additional proof-only pass. These are test-fixture costs only. Production scenes still use the unchanged five-stage path and add zero targets or passes.

The ordinary `GroundGlassRTT` and `groundGlassPassGraph` were not changed: public scenes keep the same five-stage normal path, and Raw RTT Debug keeps `sceneRender → composite`. Therefore PR M adds zero recurring targets or passes to ordinary scenes. Raw/Upright, image circle, natural illumination, relative illuminance, Focus Loupe, Architecture Rise, and Interior Corner continue through their existing production implementation. The synthetic proof does not validate rough reflected radiance: with current glass roughness near `0.24`, real reflected energy may need a distribution of apparent focus positions rather than one point per sample.

## Decision and follow-up boundary

**No local-reflection technique is selected.** PR L established the local-geometry appearance gap. PR M validates the Ground Glass focus contract with synthetic radiance. PR N rendered candidates, but planar and probe color captures did not produce a useful normal-scale appearance change, SSR did not establish reliable hits in the tested views, and none provided independent reflected focus to Ground Glass. The candidate appearance was measured qualitatively and remains unconvincing; candidate performance remains unmeasured. Observer still needs only reflection color/radiance integration, while Ground Glass requires a separate reflected-focus representation or equivalent optical contract.

Recommended follow-up: connect a candidate's reflected radiance and apparent-focus inputs to the validated Ground Glass contribution seam, then compare the candidate on Observer appearance and Processed Ground Glass focus behavior. Candidate focus adapters may provide apparent-world-position fields or an equivalent optical representation; current evidence does not justify exactly two depth textures, buffers, or CoC values. Keep the rough-reflection distribution limitation explicit and do not claim physically correct reflected focus until the selected optical representation is verified. Revisit technique selection only after a candidate shows a useful normal-scale Observer result and passes independent Ground Glass focus evidence.

## Scope confirmation

Production behavior is unchanged: glass material, daylight, environment, presentation lighting, geometry, optics, image-circle behavior, task thresholds, exposure, natural shadows, external assets, and WebGPU/TSL. All temporary reflection renderer code was reverted; capture artifacts remain ignored worktree evidence under `.dream-loop/architecture-rise/` and are not part of the PR. PR M intentionally retains the renderer-local `GroundGlassRadianceContribution` contract and apparent-world-position CoC shader/binding seam as durable architecture output, exercised by tests and the synthetic proof; these seams are not connected to the production Ground Glass executor. No production reflection technique or production multi-contribution executor is enabled or retained.
