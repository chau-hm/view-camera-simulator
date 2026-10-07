# Local Reflection Technique Decision

**Decision:** no production local-reflection technique is selected. PR M validates the renderer-side synthetic contract for independently focusing overlapping Ground Glass radiance contributions before combination. PR N rendered planar, SSR, and local CubeCamera candidates against Architecture Rise, then removed the prototype code. Its scene scan found no finite Ground Glass hit. PR O establishes a real in-range street-sign sample. PR P now validates that sample through a development-only planar radiance and `Q_virtual` reference using the PR M contribution contract; it does not enable production reflections or compare planar against another candidate. The ordinary production RTT retains its unchanged one-source path. Observer needs local-reflection radiance/color integration, but has no physical focus pass and does not require reflected virtual depth for focus.

**Confidence:** high that Ground Glass needs independent reflected-focus semantics and that the named Architecture Rise planar reference maps real reflected radiance and `Q_virtual` through the contribution focus path; low about which production reflection technique will give the best normal-scale image or performance. The validated planar reference is an ideal front-pane optical comparison, not a rough-glass or production reflection implementation.

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

The temporary candidates used the same `0.18` reflected-color weight and pane geometry assignments. Browser captures covered normal Observer framing, Processed Ground Glass with the pane-focused setting (8,890 mm), a provisional 12,470 mm focus-slider state, a 22 mm rise state, and an alternate orbit. The 12,470 mm value was not recomputed from an actual reflected scene point and is not a reflected-focus validation state. The clean probe/baseline alternate orbit used Observer camera position `11.037666, 3.000000, 0.323947`; its target was `(0, 0.9, 5.6)`. The Ground Glass test source remained 1032×826 in those captures.

PR N's captures were bounded appearance/resource pilots, not candidate performance benchmarks. Its Ground Glass color overlay was combined into the existing single-depth source render. PR P later added a test-only planar optical reference through the PR M contribution contract; it does not reuse or retain a production candidate path. No candidate's Raw/Upright behavior was separately changed or used to establish selection.

## PR N review-fix — focus-correct integration attempt

The review-fix stopped at the packet's scene-geometry boundary instead of inventing a reflected point. A CPU Three.js ray scan used the current `ARCHITECTURE_RISE_PRESENTATION` geometry and the production `configureGroundGlassCamera` pose/projection. The lens is at `(0, 0, 0)` m with optical axis `+Z`; the public focus range is 3,090–13,000 mm. The sampled front-pane plane is at `z = 8.837` m with normal `(0, 0, -1)` and pane `y` range 0.085–2.915 m; the side-pane normal toward the lens is `(-1, 0, 0)`.

Across 144 front-pane samples, the exact Ground Glass reflected rays produced **0 finite scene hits**. Across 36 side-return samples, they produced **0 finite scene hits**. The scan excluded pane/frame self-geometry and a 0.12 m near-origin interval. This was CPU geometry evidence, not a GPU color/depth candidate render. With no finite scene point `Q`, the planar path has no valid `Q_virtual`, and neither its physical CoC/footprint nor the required two-focus-state response can be computed. Planar focus-correct integration is therefore **blocked by current scene geometry**, not passed.

The old probe sidecar records that a focus position was once reconstructed, but it contains no numeric `Q_probe` / `Q_virtual_probe` sample or sample-to-radiance mapping; it explicitly records `virtualPositionFieldGenerated: false` and `focusedContributionPathIntegrated: false`. That metadata and the old 12,470 mm slider capture do not establish a Ground Glass contribution. A point recovered from an Observer ray or from the probe's distinct origin would describe a different reflected sample and cannot substitute for the missing planar `Q`. Probe focus integration and probe-versus-planar error are consequently **not validated**.

For the valid alternate Observer orbit, the camera state was position `(11.037666, 3.000000, 0.323947)` m looking at `(0, 0.9, 5.6)` m. The Observer-only scan found 31/144 finite ground/sidewalk hits with Euclidean lens-to-point geometric ranges of 13,259.5–16,574.6 mm; the default Observer scan found 36/144 at 15,581.0–20,032.7 mm. These Observer-only geometric measurements are not Ground Glass `Q` samples and do not establish focus-control distances. The earlier planar alternate frame mostly behind the building remains excluded; the valid orbit does not repair the absence of Ground Glass hits at the PR N head.

The prior bounded SSR attempt remains **technically inconclusive / no validated hit**: the correct reflected direction did not establish a reliable hit, while the opposite-direction diagnostic hit façade self-geometry and was rejected. The PR N geometry scan found no finite Ground Glass target for another SSR attempt at that head. No focus-correct candidate path existed for Raw/Upright regression, so candidate-specific Raw, Upright, and Raw RTT bypass checks were not run. Existing repository regressions cover the unchanged production path; they do not validate the absent candidate path.

## PR O — reflected-world context prerequisite

PR N's scan is retained as the before-change result. On PR O's verified base, `main @ eb1b05eb63428009a0ef4dc1c4b59bf74964cb31` (PR #237), the production `configureGroundGlassCamera` pose/projection and current Architecture Rise subject geometry reproduced **0/144 front-pane hits** and **0/36 side-return hits**. The lens remained at `(0, 0, 0)` m on `+Z`; the actual front-glazing near plane was `z = 8.836` m with normal `(0, 0, -1)`. The focus range remained 3,090–13,000 mm. The scan excluded window/frame assemblies and started 0.12 m beyond each pane sample.

A bounded CPU search evaluated 8,064 sign placements over `x = ±1.1–2.3 m`, `z = 4.8–7.0 m`, panel widths 500/600/700 mm, heights 350/450/500/550 mm, and panel centers at `y = 1.25/1.50/1.75/2.00 m`. A follow-up depth sweep tested 60/90/120 mm panels at the selected placement. The sign was evaluated with 4×4 samples per front window (256 total), placed through the current Ground Glass camera projection. The search screen grouped candidates with at least a 2×2 block of adjacent hits in one pane and recorded Euclidean `Q_virtual` geometric ranges. Those radial ranges are search evidence only; the named sample's public focus eligibility is established separately below by projecting onto the production optical axis.

| Candidate | Placement and bounds | Front search hits | Focus / direct-view result | Decision |
| --- | --- | ---: | --- | --- |
| Double-sided street sign | Center `(-1500, 1500, 5800)` mm; 600×500×90 mm panel; 70 mm post | 20/256; one pane contains a complete 2×2 adjacent sample block | Search Q_virtual points have Euclidean geometric ranges 11,936.3–12,076.1 mm; the named sample's optical-axis focus distance is 11,807 mm, leaving 1,193 mm to the focus maximum; no direct pane-ray, focus-chart, or façade overlap | Accepted; ordinary street-context object |
| Compact lamp post | Pole `x=-1650 mm`, `z=5600 mm`, with a short arm and head | 11/256; largest adjacent block was 2/4 | No durable focus-reference sample was retained; its connected hit region was narrower than the sign's | Rejected in favor of the sign's broader recognizable region |
| Existing foreground planter | Existing center `(+1450, -920, 2800)` mm; even a taller version keeps this depth | Existing production planter produced no hit | At the neutral `+Z` optical axis, a point at `z=2800 mm` mirrors to an optical-axis focus distance of 14,872 mm before lateral displacement, outside the 13,000 mm maximum | Rejected; height cannot fix its focus-range failure |

The selected production subject is an ordinary two-sided street information sign, not reflection-only geometry. It is in `streetContext` and is created by the shared `ArchitectureRiseSubjectFactory` path used by both Observer and Ground Glass. Its 8 box meshes reuse the factory's box geometry and existing reference, light-reference, and recess materials; it creates no geometry/material resource and adds 8 mesh drawables. The post's world-bounds bottom is `-1200.0000000000002 mm`, matching the actual ground support surface at `geometry.ground.y = -1200 mm`; its top remains at `1310 mm`, overlapping the panel by 60 mm. The extended post remains inside existing scene bounds, so the public focus range and canonical building/focus/task geometry did not move.

The same 144/36 reflected-ray scan after adding the subject produced **9/144 front-pane scene hits** and **0/36 side-return hits**. The denser search finds 20/256 sign hits, including a complete four-sample cluster. One named sample, `bay-2-1`, `(u, v) = (0.3, 0.3)`, is:

| Quantity | World position |
| --- | --- |
| Pane point `P` | `(-1.140000, 1.014000, 8.836000) m` |
| Pane normal toward lens `n` | `(0, 0, -1)` |
| Real hit `Q` | `(-1.523311, 1.354945, 5.865000) m` on `architecture-rise-street-sign-face-back` |
| Planar virtual point `Q_virtual` | `(-1.523311, 1.354945, 11.807000) m` |

The Euclidean lens-to-`Q_virtual` geometric range is `11,981.719574 mm`; this is a point-range measurement, not the public focus-control distance. Projecting the lens-to-point vector onto the production `optics.opticalAxis.direction` gives a `Q_virtual` optical-axis focus distance of `11,807 mm`. This optical-axis value is the Architecture Rise focus-control authority: it lies inside the 3,090–13,000 mm domain with a `1,193 mm` margin to the upper limit. Rounding with the existing `CAMERA_CONTROL_STEPS.focusDistanceMm` and `roundToStep` authorities selects `11,810 mm`, leaving a `1,190 mm` control margin.

Using the existing CPU `computePhysicalBlurFootprint` authority, the signed CoC / footprint at the 8,890 mm pane-focused state is `+0.057820 mm` with major/minor semi-axes of `0.028910 mm`; at the 11,810 mm reflected-focus state it is `-0.000045 mm` with major/minor semi-axes of `0.000022 mm`. The same-sample direct lens ray does not intersect the sign before reaching the pane. In the production Observer camera projection, the sign bounds have zero overlap with the focus chart and primary façade; updated visual captures show the sign beside the building, with the focus chart and important window regions clear. The direct sign appears near the edge of Processed Ground Glass and does not cover its focus chart.

Clean and teaching Observer captures use the standard Architecture Rise Dream Loop. The refreshed Processed Ground Glass canvas capture is 1028×822 at 8,890 mm focus, with `data-rtt-final-contentful="true"` and no page errors. These are visual evidence, not reflection-renderer evidence:

| View | Baseline SHA-256 | PR O SHA-256 |
| --- | --- | --- |
| Clean Observer | `34b068da9c62ab9a8003ee6c3df3f518536917b01c18de3ca3c56fe5e00e1ed2` | `b738632b4b9f1bb2273912237207251b1ec922057d82d19c19bc8d89da24c10b` |
| Teaching Observer | `2a160d700ccb511ce4ca727160ebb0b32186f443626b88a07ef895e5aa1d1bae` | `6340aa1fe5036cacf1d0d0c8bda787e4ce0c9db85256e0987d8da2badcceffc8` |
| Processed Ground Glass | `bc78361a489fbc202769eb844ea2b7fada41472161b244e412674f03931117c4` | `9327003b3818d7b2a4aeb034b54b97598a97add9f1414245b7ec45c2b059cb45` |

PR O changes only scene presentation geometry. It adds no reflection camera, SSR, probe/CubeCamera, planar renderer, reflection targets, reflection shader/composite, exposure or lighting changes. PR P uses the known `Q → Q_virtual` sample in a standalone test fixture; that does not change the production scene or select a reflection technique.

## PR P — planar focus-correct reference

**Status: PLANAR OPTICAL REFERENCE VALIDATED.** The serial Chromium/WebGL2 fixture uses the shared Architecture Rise subject, `ARCHITECTURE_RISE_PRESENTATION`, production world/presentation lighting and environment rigs, `deriveOpticsState`, `getGroundGlassClipRangeWorld`, and `configureGroundGlassCamera`. It remains under `src/tests/e2e/fixtures/` and is opened only by its E2E. No public route or production reflection path was added. The fixture derives the reflected camera by reflecting the production Ground Glass camera position, forward, and up across the real front-pane plane, and carries the production camera projection matrix over to it.

At the 8,890 mm pane-focus state, the production Ground Glass camera is at `(0, 0, 0) m`, looks along its derived `+Z` optical axis, and uses the derived off-axis projection (`near = 0.01 m`, `far = 14 m`). The planar camera is at `(0, 0, 17.672) m`, looks along `−Z`, and preserves the reflected up orientation. The reflection capture hides only the named target glazing and clips the camera-side half-space beginning 0.12 m beyond the pane, matching PR O's sample ray offset; the street sign remains in the real Architecture Rise scene. Color and transformed world-position captures use the same camera and clipping. The pane mask is rendered from the actual pane mesh into the Ground Glass source grid.

### Named sample and mapping

The fixture recomputes the PR O sample from current scene geometry and production optics. At the named source sample, the pane mask is active and the reflected camera resolves the real street-sign face. The source pixel, reflected-camera projection, radiance, and captured position are sampled as one mapping:

| Measurement | Value |
| --- | --- |
| Pane / `(u, v)` | `architecture-rise-facade-window-bay-bay-2-1-glazing` / `(0.3, 0.3)` |
| Ground Glass source pixel (bottom origin) | `(503, 412)` at pane focus; `(502, 412)` at reflection focus |
| Reflected-camera UV / target pixel | `(0.34440735, 0.67178403)` / `(264, 412)` at the named pane-focus sample |
| Pane point `P` / normal `n` | `(-1.140000, 1.014000, 8.836000) m` / `(0, 0, -1)` |
| CPU real point `Q` | `(-1.523311453, 1.354945450, 5.865000) m` |
| GPU captured real point `Q` | `(-1.529155135, 1.350800037, 5.864998886) m` |
| CPU `Q_virtual` | `(-1.523311453, 1.354945450, 11.807000) m` |
| GPU resolved `Q_virtual` | `(-1.529155135, 1.350800037, 11.807001114) m` |
| CPU/GPU position difference | `0.007165 m` for both `Q` and `Q_virtual`; the GPU point lies within the sign face |
| `Q_virtual` Euclidean lens-to-point geometric range | `11,981.719574 mm` CPU; `11,981.996973 mm` from GPU `Q_virtual` |
| `Q_virtual` optical-axis focus distance | `11,807 mm` |
| Rounded public reflected-focus control | `11,810 mm`, derived with `CAMERA_CONTROL_STEPS.focusDistanceMm` and `roundToStep` |

The direct pane ray first hits the named glazing and misses the street sign; the pane-to-`Q` ray first hits `architecture-rise-street-sign-face-back`. The fixture rejects out-of-frustum or invalid reflected positions, and it fails if reflected RGB remains nonzero where the apparent-position alpha is invalid. At the named pixel, the reflected preweighted linear radiance is `(0.04920750, 0.05475029, 0.05529296)` at weight `0.18`.

### Contribution and independent focus result

The fixture submits `architecture-rise-planar-reference` as `preweighted-linear-radiance`, with the mapped radiance and same-sized `Q_virtual` texture through `resolveGroundGlassRadianceContributions`. It uses the production apparent-world-position CoC shader and binder, the existing physical footprint GLSL, the aperture gather, and the existing shared composite. Its contribution-local gather visibility input is a neutral 1×1 white UnsignedByte texture; it is visibility-only and is not focus authority. Direct radiance keeps the direct scene's captured world position. The reflected contribution does not inherit that pane position: in the 8,890 mm state it matches the CPU `Q_virtual` CoC near `+0.05782 mm` while the direct pane CoC is near zero; at 11,810 mm the reflected CoC is near zero while the direct pane CoC is about `−0.05905 mm`.

The CoC target selected the repository's `half-float-mm` storage path. Its named-sample GPU values agree with `computePhysicalBlurFootprint` for canonical CPU `Q_virtual` within the `0.001 mm` storage tolerance:

| State | Focus | Direct pane CPU / GPU signed CoC | Reflected `Q_virtual` CPU / GPU signed CoC | Reflected CPU / GPU major = minor radius | GPU-vs-CPU difference / tolerance | Reflected sign edge-gradient energy (samples) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Pane focused | `8,890 mm` | `−0.00143028 / −0.00143051 mm` | `+0.05781962 / +0.05783081 mm` | `0.02890981 / 0.02891541 mm` | `0.00001119 / 0.001 mm` | `0.000107956` (`2,220`) |
| Reflection focused | `11,810 mm` | `−0.05904412 / −0.05905151 mm` | `−0.00004457 / −0.00004554 mm` | `0.00002229 / 0.00002277 mm` | `0.000000965 / 0.001 mm` | `0.000131275` (`2,293`) |

The bounded crop around the street-sign face has 21.6% higher edge-gradient energy in the reflected-focus state. This objective metric and the reflection-only screenshots distinguish the two focus states without tuning the sign or blurring the planar reference to imitate roughness. The captured display-only hashes are pane-focus: pre-focus `40e48b4a`, focused reflection `e64b62e9`; reflection-focus: pre-focus `748c0072`, focused reflection `748c0072`. The combined display hashes are `10788702` and `0e3ad0bb`, respectively. These hashes identify this bounded fixture output; the numeric CoC and radiance readbacks are the optical evidence.

### Linear radiance and shared film stage

Each contribution is focused into an RGBA32F target, added to the other focused contribution in an RGBA32F / `NoColorSpace` / `NoToneMapping` target, and only then passed once through the existing composite per focus state. The maximum per-pixel RGB difference between the combined target and the sum of the two focused targets is `0.000056684`. At the named pane pixel:

| State | Direct focused linear RGB | Reflected focused linear RGB | Pre-display combined linear RGB | Final RGBA8 display sample |
| --- | --- | --- | --- | --- |
| Pane focused | `(0.01215831, 0.02357137, 0.03052085)` | `(0.04920749, 0.05475030, 0.05529296)` | `(0.06136581, 0.07832167, 0.08581381)` | `(14, 18, 20, 255)` |
| Reflection focused | `(0.01215949, 0.02357281, 0.03052266)` | `(0.04920753, 0.05475032, 0.05529299)` | `(0.06136703, 0.07832313, 0.08581565)` | `(14, 18, 20, 255)` |

The shared composite applies the current relative-illuminance gain (`0.966539`), natural-illumination gain (`0.942840`) and image-circle coverage (`1.0`) once after the sum, then applies the existing Raw display orientation. The float readback is the radiometric oracle; the final RGBA8 target is display-only. PR M's separate synthetic proof remains the evidence for unclamped values above `1.0`.

### Fixture resources and capability

The bounded fixture renders at `768×614`. Across both focus states it owns 19 render targets: 2 scene-radiance, 2 world-position captures, 1 pane-position mask, 1 masked direct contribution, 1 resolved reflected radiance, 1 reflected apparent-position, 2 CoC, 4 far/near gather, 2 focused contribution, 1 combined-radiance, 1 final-display, and 1 CoC diagnostic target. Radiance and position resources are RGBA32F / `FloatType`; radiance uses `LinearFilter` and positions use `NearestFilter`. CoC uses 2 RGBA / `HalfFloatType` `half-float-mm` targets. The visibility input is 1×1 RGBA8 / `UnsignedByteType`; the final display is RGBA8 / `UnsignedByteType`.

Aggregate fixture pass counts are 2 direct scene renders, 2 planar color renders, 4 world-position scene renders, 2 pane-mask renders, 4 full-screen mapping resolves, 2 radiance-validity masks, 4 CoC passes, 8 gathers, 4 contribution focus resolves, 2 float radiance sums, and 2 shared composites (plus 4 CoC decode diagnostics). Nominal target texel payload is `130,148,352 bytes` (`124.12 MiB`), not measured VRAM. All 19 targets and owned scene/material/geometry/light/environment resources are disposed; the renderer reports 36 textures before teardown.

The backend reported Chromium WebGL2 / OpenGL ES 3.0, `EXT_color_buffer_float` present, and a complete Float32 framebuffer (`0x8cd5`). A diagnostic write of `1.25` was read back as `1.25` through `Float32Array`. Float32 linear filtering was supported and used for radiance; positions used nearest filtering. The fixture fails instead of falling back if float renderability or readback fails.

The E2E asserts production pass order remains `sceneRender → cocFootprint → farGather → nearGather → composite`, with zero extra production targets and passes and no Observer reflection. This reference represents one ideal planar reflected point per valid sample. It does not model current glazing roughness near `0.24` or its possible angular/distributed-focus response. No production `GroundGlassRTT`, scene, material, lighting, environment, optics, or public visual behavior is changed by PR P.

## Candidate 1 — constrained / planar reflection

**Status: PR N's appearance prototype was not selected; PR P validates a separate bounded optical reference.** PR N derived front and side reflection planes from their glazing meshes and rendered two 256×256 RGBA16F color targets per renderer. Its Ground Glass images used the pane-depth source path, and its PR N scene scan found 0/144 front and 0/36 side finite hits. PR P now uses the real PR O street-sign sample to verify ideal planar reflected radiance and independent focus in a standalone test fixture. It does not retain PR N's prototype, implement a production planar renderer, or compare planar against another technique. PR N's fixed-weight clean Observer comparison still showed no useful normal-scale appearance improvement; its alternate planar frame mostly behind the building remains excluded.

Both renderers need front/side reflection radiance and their own camera, clipping, pane assignment, and color resources. The prototype added two reflection renders per frame per renderer. Its Ground Glass color was present before the existing CoC pass but remained associated with the pane's source depth. Observer needs no reflected virtual-depth resource; Ground Glass still needs independent reflected-focus semantics or an equivalent representation. The prototype supplied neither.

The nominal color-target payload was 1 MiB per renderer (two 256² RGBA16F targets), 2 MiB total, excluding renderbuffer and driver overhead. The normal-scale image did not justify selecting planar reflection before the Ground Glass contribution path can represent its focus behavior.

## Candidate 2 — screen-space reflections

**Status: bounded prototype rendered, no usable local reflection established.** Each renderer captured scene color into one 256×256 RGBA HalfFloat target and ordinary scene depth into one 256×256 UnsignedInt depth texture. On the Chromium WebGL2 runner, `EXT_color_buffer_float` was present and the color framebuffer was complete (`0x8cd5`). The pane-only shader used a bounded 64-step screen-space ray march. The correct reflected-ray orientation did not produce a reliable visible hit in the captured default or alternate views. A diagnostic run with the opposite direction found façade self-geometry, so those hits were not counted as reflected scene content.

Observer needs SSR's ordinary scene color/depth algorithm inputs and reflection-color resolve; that depth is not Ground Glass virtual-image depth. The Ground Glass prototype likewise used its own renderer-local color/depth capture. A real Ground Glass integration could reuse the existing source depth for SSR reconstruction, but it would still need to route reflected radiance through independent focus semantics before `cocFootprint`. No virtual-position field or contribution-local focus pass was produced by this prototype. Off-screen geometry remains unavailable to SSR, and screen-edge, occlusion, and disocclusion behavior remain view-dependent.

The nominal captured color-plus-depth texture payload was 0.75 MiB per renderer (0.5 MiB RGBA16F color plus 0.25 MiB 32-bit depth), 1.5 MiB total. The extra scene capture was rendered each frame; candidate GPU time and hit coverage were not measured. The framebuffer capability passing does not establish a visually useful SSR result.

## Candidate 3 — local reflection probe / CubeCamera

**Status: color and distance capture rendered, focus-correct integration not validated, not selected.** The temporary harness captured one local 128² CubeCamera color cube at `(1.45, 8.8, 8.55)` m and one RGBA HalfFloat radial-distance cube in each renderer. The probe excluded the pane meshes and reflection masks during capture. Its pane shader sampled both cubes and computed an approximate mirrored point, but no numeric sample-to-radiance mapping was retained and the value was not written into a Ground Glass contribution or CoC target. The sidecar's `focusPositionReconstructed: true` flag is not sufficient to recover or independently verify `Q_probe` / `Q_virtual_probe`; it also states that no virtual-position field or focused contribution path was generated. Observer needs the color cube only. A chosen Ground Glass focus contract may use distance or an equivalent focus representation, but this pilot did not validate one.

On Chromium WebGL2, `EXT_color_buffer_float` was present and both color and distance framebuffers were complete (`0x8cd5`). Half-float linear filtering was unavailable, so the distance cube used nearest filtering; the color cube was UnsignedByteType with linear filtering. No half-float linear-filtering fallback was needed. The local probe color was only subtly different from the same-camera baseline at normal display scale: the pane crop's absolute luminance difference averaged 1.85/255 in the default view and 1.11/255 in the matched alternate orbit, with a maximum of 35/255 in each crop. This did not yield a clearly recognizable façade reflection at normal scale.

Ground Glass captures at 8,890 mm and 12,470 mm confirmed only the existing source/DOF path; the reflected color remained on the pane-depth source pixel. It did not pass Case A/B-style independent focus evidence. The single probe point also has parallax across front and side glazing, and the distance-to-point reconstruction is approximate. Current roughness near 0.24 may require distributed apparent-focus semantics rather than one point.

The harness's actual nominal payload was 1.125 MiB per renderer: 0.375 MiB for the RGBA8 color cube and 0.75 MiB for the RGBA16F distance cube (2.25 MiB across both renderers), excluding per-face depth attachments and driver overhead. Correcting ownership removes the redundant Observer distance cube, giving the resource-model estimate of 0.375 MiB for Observer and 1.125 MiB for Ground Glass (1.5 MiB total). The harness updated six faces for each target in both renderers: 12 scene renders per renderer on initialization/world update. With the corrected ownership, Observer would render six color faces and Ground Glass twelve faces for color plus distance. Performance was not measured; a production lifecycle would need to invalidate the capture when reflected world content changes.

## Comparison matrix

Ratings distinguish prototype observations from unmeasured performance or unimplemented focus behavior. Candidate appearance rows record PR N's tested state; PR P separately validates an ideal planar focus reference at PR O's sample and is not a candidate-quality or production comparison.

| Criterion | Environment only | Planar | SSR | Probe / CubeCamera |
| --- | --- | --- | --- | --- |
| Nearby geometry at normal scale | No; baseline capture | Captured, but no useful normal-scale improvement | No reliable hit in the tested views | Small pane-region difference; not clearly recognizable |
| Off-screen geometry | No | Only within reflection-camera frustum | No | Available in the captured cube, subject to exclusions |
| Front glazing | Dark/flat baseline | PR N captured appearance with pane-depth focus; PR P separately validates a test-only `Q_virtual` focus reference | No reliable correct-direction hit | Small visual difference in clean comparison |
| Side glazing | Dark/flat baseline | Separate side-plane capture required; alternate attempt was not a useful view | View/screen dependent; no reliable hit | Sampled by same local probe; parallax remains |
| Parallax / image mapping | Not applicable | Plane-specific projective mapping | Screen-space hit position | Tied to one probe point; approximate distance-to-point reconstruction |
| Observer focus/depth need | None | Color/radiance only | Ordinary scene depth may be an SSR input; no reflected virtual depth for focus | Color cube for appearance; distance is not required for Observer focus |
| Ground Glass focus need | Existing pane depth | Independent reflected-focus semantics required; PR P verifies it for one front-pane sample | Independent reflected-focus semantics required if a valid SSR hit exists; SSR input depth is distinct | Independent reflected-focus semantics required; a distance cube alone does not establish a mapped contribution |
| Focus-correct integration result | Existing one-source path | PR P validates real front-pane `Q` / `Q_virtual` through the PR M contribution and focus path in a test fixture; no production renderer selected | Inconclusive: correct direction had no reliable hit; opposite self-hit rejected | Not validated: no persisted matched numeric `Q_probe` / `Q_virtual_probe` or PR M contribution path |
| Candidate Ground Glass result | Existing pane path | PR P's ideal planar reference focuses at `Q_virtual`; PR N's candidate overlay remained pane-depth and was not focus-correct | No validated color hit or virtual-position output | Earlier color remained on pane-depth path; sidecar says no focus contribution was integrated |
| Production pre-CoC integration | Existing one-source path | None retained | None retained | None retained |
| Raw/Upright candidate validation | Existing behavior | Not run: no candidate contribution path | Not run: no candidate contribution path | Not run: no candidate contribution path |
| Extra renders in prototype | 0 | PR N: two reflection views per renderer per frame; PR P: 2 planar color renders across two test states | One scene color/depth capture per renderer per frame, plus pane ray march | Harness: 12 per renderer (six color, six distance); corrected ownership: Observer 6, Ground Glass 12 |
| Extra targets per renderer | Existing PMREM | Two 256² RGBA16F color targets | One 256² RGBA16F color target + one 256² UnsignedInt depth texture | Observer: one 128² RGBA8 color cube; Ground Glass: color cube + optional 128² RGBA16F distance cube |
| Nominal candidate target payload | Existing scene and PMREM | 1 MiB per renderer | 0.75 MiB per renderer | Observer: 0.375 MiB; Ground Glass: 1.125 MiB when distance is selected |
| GPU performance | Baseline only; not decision-grade | Unmeasured | Unmeasured | Unmeasured |
| Lifecycle concern | Existing PMREM ownership | Camera/clipping update per renderer | Capture and depth/normal reconstruction per renderer | Recapture when reflected world content changes; parallax persists |
| Main limitation | No local geometry response | PR P covers one ideal planar front-pane point only; rough-reflection distribution, side panes, production lifecycle, and candidate comparison remain unvalidated | On-screen visibility, edges, disocclusion, and no reliable tested hit | No verified mapped sample for focus; single-point parallax remains |
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

**No production local-reflection technique is selected.** PR L established the local-geometry appearance gap. PR M validates the Ground Glass focus contract with synthetic radiance. PR N's candidate captures remain appearance-only at the fixed 0.18 diagnostic weight; SSR remains technically inconclusive with no validated hit. PR O established a real `Q` and in-range `Q_virtual`; PR P validates one ideal planar radiance sample through the PR M focus path. This is an optical reference, not a comparison proving planar's normal-scale quality or performance. Observer still needs only reflection color/radiance integration, while Ground Glass requires a separate reflected-focus representation or equivalent optical contract.

Recommended follow-up: compare a local probe against PR P's exact front-pane sample and validated planar reference, measuring position, focus, parallax, and normal-scale appearance. Candidate focus adapters may provide apparent-world-position fields or an equivalent optical representation; current evidence does not justify exactly two depth textures, buffers, or CoC values. Keep the rough-reflection distribution limitation explicit and do not claim physically correct rough-reflection focus until the selected optical representation is rendered and verified. Revisit production technique selection only after a candidate shows a useful normal-scale Observer result and passes independent Ground Glass focus evidence.

## Scope confirmation

PR O adds one presentation-only street sign; the building, canonical focus target, public focus range, task thresholds, glass material, daylight, environment, presentation lighting, optics, image-circle behavior, exposure, natural-shadow policy, external assets, and WebGPU/TSL remain unchanged. PR N's temporary renderer prototype was removed. PR P adds only the standalone development/E2E reference fixture and its test; the capture artifacts remain ignored worktree evidence and are not part of the production build. PR M intentionally retains the renderer-local `GroundGlassRadianceContribution` contract and apparent-world-position CoC shader/binding seam as durable architecture output, exercised by tests and the synthetic proof; these seams are not connected to the production Ground Glass executor. No production reflection technique or production multi-contribution executor is enabled or retained.
