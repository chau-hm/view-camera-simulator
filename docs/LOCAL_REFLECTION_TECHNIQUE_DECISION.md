# Local Reflection Technique Decision

**Decision:** defer a local-reflection implementation until Ground Glass can represent reflected radiance separately from the pane's direct material radiance and carry the corresponding virtual-image depth through focus processing. No candidate was prototyped or selected in this PR.

**Confidence:** high that the current Ground Glass representation is the blocking contract; low about which reflection technique will give the best normal-scale image because no visual candidate was rendered.

Repository base: `fe4a81e4c56ce7969a5982a936dad4b0a696c99f` (`origin/main`, PR #232 merge).

## Problem

PR I added fixed natural daylight to Architecture Rise. PR J added a procedural sky/ground PMREM environment. PR K tested two bounded built-in glazing material responses, then restored the accepted production material because the change was not useful at ordinary Observer or Processed Ground Glass scale. Those steps leave one question: whether nearby scene geometry should contribute recognizable radiance to the glazing.

The current production recipe remains `MeshStandardMaterial(color: #182d37, roughness: 0.24, metalness: 0.08)`. PR I daylight, PR J environment, and presentation lighting remain unchanged. No prototype or production render code is included in this PR.

## Current rendering constraints

### Observer

[`SceneRenderer.tsx`](../src/render/SceneRenderer.tsx) mounts an R3F `<Canvas>` and renders its scene directly. There is no retained Observer color/depth buffer or post-processing chain that a screen-space reflection pass could use. A screen-space technique would add its own scene capture, depth/normal inputs, resolve, and renderer-owned resources. A CubeCamera or planar camera could render from the existing scene, but each needs its own targets on this renderer.

### Ground Glass source and DOF

[`GroundGlassRTT.tsx`](../src/render/GroundGlassRTT.tsx) renders the registered Architecture Rise subject into a separate color/depth target owned by [`groundGlassRttResources.ts`](../src/render/groundGlassRttResources.ts). At the standard-quality baseline that target was 658×527; a depth texture was available. The implemented pass order in [`groundGlassPassGraph.ts`](../src/render/groundGlassPassGraph.ts) is:

```text
sceneRender → cocFootprint → farGather → nearGather → composite
```

The safe color insertion point is after `sceneRender` and before `cocFootprint`, using a separate resolved target rather than sampling from the target currently being rendered. Raw RTT bypass uses `sceneRender → composite`; Raw and Upright are display transforms applied to the same source path.

The CoC shader samples the single source depth texture, reconstructs one world point for each source pixel, and classifies that point against the physical focus state. There is no retained normal buffer; SSR would need to reconstruct normals or add one.

That one-color/one-depth representation is the key limitation. A glazing pixel contains direct pane radiance at the pane depth plus reflected radiance whose apparent virtual image may lie at a different depth. Assigning the pane depth to the blended color makes the reflection follow the pane's focus and blur. Replacing it with reflected depth would instead give the pane's own radiance the wrong focus. Correct handling needs distinct radiance/depth contributions or an equivalent optical representation, not just a color overlay before DOF.

### Existing reflection-related code

- [`worldEnvironmentRig.ts`](../src/render/worldEnvironmentRig.ts) creates an independent PMREM target per scene/renderer for the shared PR J environment. It is a low-frequency environment, not a capture of local Architecture Rise geometry.
- A source search found no application use of `CubeCamera`, `Reflector`, `SSRPass`, `MeshReflectorMaterial`, or `EffectComposer`.
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

For scale only, the standard Ground Glass source is 658×527 (346,766 texels). A full-size RGBA8 color target therefore has about 1.32 MiB of nominal texel payload; a 4-byte depth target adds another 1.32 MiB. At that assumed full resolution, a probe with six 256×256 RGBA8 faces is about 1.5 MiB per renderer, with another 1.5 MiB if a 4-byte depth cube is added. Two planar color/depth pairs would be about 5.3 MiB per renderer. These are arithmetic estimates, not measured GPU allocations; actual format, mip levels, alignment, and driver overhead depend on implementation.

## Candidate 1 — screen-space reflections

**Status: rejected before prototype for this decision.** The existing RTT source/depth is a valid place to experiment with an SSR color resolve, and depth-derived normals are possible. However, the result would still need to keep reflected radiance and its virtual-image depth distinct from the pane's base radiance before CoC classification. The current single color/depth pair cannot do that. A color-only prototype would make a reflected nearby object inherit pane focus and would therefore test the wrong optical behavior.

The Observer would additionally need an isolated color/depth capture and resolve path. Ground Glass would need a reflected-radiance/depth path before `cocFootprint`. Maintaining two separate integrations, then adding the depth-layer contract needed to make the comparison meaningful, is disproportionate for a visual-only SSR spike and crosses the highest-weight criterion. This is a correctness stop, not a claim that SSR cannot be implemented later.

Screen-space visibility would also lose off-screen or hidden geometry, fade or break at screen edges, and change with camera motion and disocclusion. Those failure modes make the front/side result and teaching stability camera-dependent.

## Candidate 2 — local reflection probe / CubeCamera

**Status: rejected before prototype for this decision.** A CubeCamera can capture off-screen scene geometry, and material shading would place its color contribution in the Ground Glass source render before DOF. A direction-only cubemap does not identify the reflected point's distance. The pane's primary depth would consequently drive reflected focus unless the probe also captured depth and the renderer converted that depth to a virtual point for the optical pass.

Observer and RTT would each need their own cube target, capture lifecycle, and explicit recursion exclusion. A static teaching scene could capture once after scene/world changes rather than on every orbit; camera movement alone would not require a new scene capture, but it would change sampled directions. One probe point also creates parallax error across the front and side-return glazing. A second probe may be necessary. Direct `material.envMap` assignment would replace the existing scene environment in Three.js r186; preserving PR J requires an explicit blend.

The capture cost would be six scene renders per update per renderer, plus a depth-cube path if virtual focus is required. No capture resolution, memory delta, or runtime timing is claimed because the technique was not prototyped.

## Candidate 3 — constrained / planar reflection

**Status: rejected before prototype for this decision.** The large front panes are approximately coplanar, but the side-return panes have a different plane and normal. At least two reflection views are therefore needed to avoid using a front capture on side glass. The current mirror lesson provides no reusable reflection camera, render target, clipping, or depth pipeline; it draws manually mirrored teaching objects instead.

Two color captures could feed both orientations before the Ground Glass source target. They would still need separate reflected depth/radiance contributions for physically meaningful DOF, in both renderer graphs. Observer orbit changes require recapturing the reflection views. With no common reflection primitive, the bounded plan is two added scene renders per frame per renderer (four across Observer and Ground Glass), plus renderer-owned color/depth targets and pane assignment. This is a disproportionate first step before the optical representation is specified. The technique remains a candidate after that contract exists, especially because each façade orientation is planar.

## Comparison matrix

Ratings below distinguish current repository evidence from expected technique behavior. “Not measured” means no prototype was run; it must not be read as a visual or performance result.

| Criterion | Environment only | SSR | Probe / CubeCamera | Planar |
| --- | --- | --- | --- | --- |
| Nearby geometry visible | No; baseline capture | On-screen visible geometry only; not prototyped | Capturable from all directions; not prototyped | Visible in plane capture; not prototyped |
| Off-screen geometry | No | No | Yes, subject to capture scene and exclusions | Yes, subject to reflection camera frustum |
| Front glazing | Dark/flat in baseline | Unmeasured | Unmeasured | Unmeasured |
| Side glazing | Dark/flat in alternate orbit | View/screen dependent | One probe point may have parallax; second may be needed | Requires separate side-plane capture |
| Parallax correctness | Not applicable | Screen-space hit position; virtual depth still required | Inherently tied to probe point | Correct for each planar view if camera/plane mapping is correct |
| Camera-motion stability | Stable | Sensitive to view, edges, and disocclusion | Stable for static scene, but point-probe parallax remains | Must update for Observer orbit and camera changes |
| Observer integration | Existing direct render | New color/depth capture and resolve | Separate renderer-owned cube capture | Two reflection cameras/targets for front and side |
| Ground Glass integration | Existing scene render | Resolve before CoC; reflected depth layer required | Probe shading before DOF; depth cube/virtual-point path required | Reflection pass before source completion; reflected depth layer required |
| Pre-DOF compatibility | Yes | Color can be; correct mixed radiance/depth needs a new representation | Color can be; correct focus needs depth plus separated radiance | Color can be; correct focus needs depth plus separated radiance |
| Raw/Upright compatibility | Existing behavior | Preserved if source resolve precedes DOF/display transform | Preserved if material contribution is in source render | Preserved if reflection is in source render |
| Extra renders | 0 | Observer: scene capture plus resolve; RTT: one resolve after its existing source render | Six cube faces per renderer/update | Two reflection scene renders per renderer/frame |
| Extra targets/textures | Existing per-renderer PMREM | Scene color/depth and resolved reflection/depth data | One cube target per renderer; extra depth cube if optics are supported | Two color targets per renderer; extra depth targets for optics |
| GPU cost | Baseline | Observer capture plus per-pixel bounded ray marching; RTT per-pixel resolve; unmeasured | Six-face scene capture on update; unmeasured | Two scene captures per frame per renderer; unmeasured |
| CPU / scene traversal | Existing path | Pass setup and normal/depth reconstruction; unmeasured | Scene traversal/capture and recursion exclusion; unmeasured | Reflection camera setup, clipping, and two captures; unmeasured |
| Memory | Existing scene and PMREM | Full-view buffers at Observer and RTT sizes; exact format/size undecided | Cubemap per renderer; depth adds another cube; size undecided | Two full reflection targets per renderer; depth adds paired targets |
| Lifecycle | Existing explicit PMREM ownership | New targets, shaders, and cameras in both paths | Renderer-owned cube targets, cameras, exclusions, and disposal | Renderer-owned targets/cameras/clipping and pane ownership |
| WebGL r186 fit | Existing path | Possible with current WebGL/GLSL, but no app primitive | Three.js has CubeCamera; no app-owned local probe path | Possible with a custom Reflector-style implementation; none exists |
| WebGPU migration burden | Existing environment is renderer-owned | High: custom screen-space shaders and WebGL buffers | Medium/high: renderer-owned cube capture plus shader blend | High: camera clipping and render-target-specific reflection path |
| Implementation risk | Low | High, with unreliable edge/occlusion cases | Medium/high, especially parallax and correct focus | High, especially duplicate renderer/depth integration |
| Teaching value | Low for local geometry | Potentially useful but view-dependent; unmeasured | Potentially useful but may suggest false focus; unmeasured | Potentially useful across each plane; unmeasured |

## Reflected depth and focus semantics

For a perfect planar reflector, a scene point `Q` has a virtual reflected position `Q' = Q - 2n·dot(Q - P, n)`, where `P` and `n` define the pane plane. Ground Glass needs the apparent reflected point, not just the pane's depth or the color sampled by a reflection technique. With roughness `0.24`, a pane pixel may also integrate radiance from a distribution of directions rather than one exact virtual point.

Because direct pane radiance and reflected-scene radiance can have different apparent depths, one blended source color with one depth value cannot represent both focus responses exactly. A future implementation must first define how those contributions are kept separate through CoC classification and aperture gather, then how they are composited while preserving the existing Raw/Upright transforms and fallback behavior. Do not claim physically correct reflected focus until that contract is implemented and verified.

## Decision and follow-up boundary

**No local-reflection technique is selected in PR L.** The baseline proves the local-geometry gap exists, but this PR did not prove that adding any candidate improves normal-scale presentation. More importantly, each color-only candidate would assign the wrong focus depth to one part of the glazing radiance. Prototyping that output would give appearance evidence while failing the primary optical acceptance criterion.

Recommended next PR: define and test a Ground Glass reflected-radiance/virtual-depth contract with two distinct depth contributions at a glazing pixel. After that contract is concrete, make a bounded technique comparison. The candidate prototypes should then be rendered independently for Observer and Processed Ground Glass, with front and side glazing, normal framing, an alternate orbit, a rise state, Raw/Upright regression checks, and paired resource/timing evidence.

## Scope confirmation

Production behavior is unchanged: glass material, daylight, environment, presentation lighting, geometry, optics, image-circle behavior, task thresholds, exposure, natural shadows, external assets, and WebGPU/TSL. No screenshots, rendering prototypes, or new production abstractions are retained.
