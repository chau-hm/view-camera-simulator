# Local Reflection Technique Decision

**Decision:** no production local-reflection technique is selected. PR M validates the renderer-side synthetic contract for independently focusing overlapping Ground Glass radiance contributions before combination. PR N rendered planar, SSR, and local CubeCamera candidates against Architecture Rise, then removed the prototype code. PR O establishes a real in-range street-sign sample. PR P validates that sample through a development-only planar radiance and `Q_virtual` reference using the PR M contribution contract. PR Q validates the uncorrected single-Probe focus path and records its parallax/detail limits. PR R finds that one bounded update from the existing radial-distance cube materially corrects those errors in the tested Architecture Rise region. PR S rejects the frozen corrected single-Probe candidate for Observer use. PR T finds that two fixed corrected Probes substantially improve the optimized views but leave material holdout error, while a third adds only a small training gain; local Probe planning is closed for the current Architecture Rise production path unless new evidence or requirements justify reopening it. No production technique is selected. The ordinary production RTT retains its unchanged one-source path. Observer needs local-reflection radiance/color integration, but has no physical focus pass and does not require reflected virtual depth for focus.

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
- Local probe resource model: the historical PR N Observer candidate was color-only (one 128² RGBA8 cube, 0.375 MiB); PR N did not use distance for Observer parallax correction. The corrected PR R/S candidate requires one 128² RGBA16F color cube plus one 128² RGBA16F radial-distance cube per renderer instance: 1.50 MiB nominal texel payload. In Observer the radial-distance cube is parallax-correction geometry data, not focus data. Ground Glass may also use radial distance for Probe mapping, but still needs the independent reflected-focus contract or equivalent optical representation. These candidate texel payloads exclude depth attachments, diagnostics, and driver overhead.

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

Aggregate fixture pass counts are 2 direct scene renders, 2 planar color renders, 4 world-position scene renders, 2 pane-mask renders, 4 full-screen mapping resolves, 2 radiance-validity masks, 4 CoC passes, 8 gathers, 4 contribution focus resolves, 2 float radiance sums, and 2 shared composites (plus 4 CoC decode diagnostics). Nominal target texel payload is `130,148,352 bytes` (`124.12 MiB`), not measured VRAM. Disposal events were observed for 20/20 owned `WebGLRenderTarget` objects (the 19 proof targets plus the temporary 2×2 float-capability target), 1/1 direct texture, 15/15 materials, and 1/1 geometry, with no duplicate dispose events. The 4/4 registered custom disposer callbacks ran; this observes callback invocation, not every allocation internal to those rigs. `renderer.dispose()` was invoked separately. The renderer reported 36 textures before teardown.

The backend reported Chromium WebGL2 / OpenGL ES 3.0, `EXT_color_buffer_float` present, and a complete Float32 framebuffer (`0x8cd5`). A diagnostic write of `1.25` was read back as `1.25` through `Float32Array`. Float32 linear filtering was supported and used for radiance; positions used nearest filtering. The fixture fails instead of falling back if float renderability or readback fails.

The E2E checks the imported production `GROUND_GLASS_PASS_ORDER` against `sceneRender → cocFootprint → farGather → nearGather → composite`. PR P changes no production renderer implementation files; its 19 proof targets belong only to the standalone development/E2E fixture and are not wired into public `GroundGlassRTT`. The fixture does not measure production target or pass counts. Repository diff and architecture review show that no public Observer reflection execution path is added. This reference represents one ideal planar reflected point per valid sample. It does not model current glazing roughness near `0.24` or its possible angular/distributed-focus response. No production scene, material, lighting, environment, optics, or public visual behavior is changed by PR P.

## PR Q — local probe vs planar optical reference

**Status: PROBE FOCUS PATH VALIDATED — SINGLE-PROBE APPROXIMATION LIMITED.** The comparison starts by opening the existing frozen PR P fixture and retaining its current browser proof, then opens a separate Probe fixture. The PR P HTML, harness, and test are unchanged. Both fixtures use the same Architecture Rise scene, production Ground Glass camera, named front pane and `(u, v) = (0.3, 0.3)` sample, 768×614 source, 0.18 diagnostic weight, and focus states of 8,890 mm and 11,810 mm. The Probe color and radial-distance cubes are captured once, then reused for both focus states.

The bounded CPU study derives its open search volume from front-glazing, façade, and sign bounds and evaluates 60 clear grid points. On the current geometry, strict filtering to `architecture-rise-street-sign-face-back` yields 12/256 Planar pane samples; the older PR O count of 20/256 counted hits on any street-sign mesh, including the post. The target-face sample set retains a complete 2×2 cluster. The historical PR N origin `(1.45, 8.8, 8.55) m` hits no target face on these 12 rays. The selected origin `(-1.2725, 1.5000, 6.9720) m` was chosen from regional coverage first, then p95 virtual-position error; it hits the same face for 12/12 samples with no wrong-object or no-hit samples. It was not selected from the named point alone.

| Bounded CPU origin metrics | Historical PR N origin | Selected Probe origin |
| --- | ---: | ---: |
| Position | `(1.45, 8.8, 8.55) m` | `(-1.2725, 1.5000, 6.9720) m` |
| Same target-face hits | `0/12` | `12/12` (`100%`) |
| Wrong object / no hit | `0 / 12` | `0 / 0` |
| 2×2 adjacent cluster | `0/4` | `4/4` |
| Median / p95 `|Q_probe − Q_planar|` | unavailable (no hit) | `0.127152 / 0.326599 m` |
| Median / p95 `|Q_virtual_probe − Q_virtual_planar|` | unavailable (no hit) | `0.127152 / 0.326599 m` |
| Median / p95 optical-axis focus error | unavailable (no hit) | `0 / <0.000001 mm` |
| Median / p95 angular parallax | unavailable (no hit) | `2.379° / 6.163°` |

The selected origin preserves the full target-face sample region and focus-axis distance, but the regional lateral point errors remain substantial. The named sample decomposes as follows:

| Quantity | Planar reference | Ideal Probe CPU ray | Probe GPU cubemap | CPU Probe vs Planar | GPU vs CPU Probe | GPU Probe vs Planar |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `Q` (m) | `(-1.523311, 1.354945, 5.865000)` | `(-1.415323, 1.627037, 5.865000)` | `(-1.415949, 1.626701, 5.864392)` | `0.292738 m` | `0.000935 m` | `0.292196 m` |
| `Q_virtual` (m) | `(-1.523311, 1.354945, 11.807000)` | `(-1.415323, 1.627037, 11.807000)` | `(-1.415949, 1.626701, 11.807608)` | `0.292738 m` | `0.000935 m` | `0.292196 m` |
| Optical-axis focus distance | `11,807 mm` | `11,807 mm` | `11,807.608 mm` | `0 mm` | `0.608 mm` | `0.608 mm` |
| Rounded public focus | `11,810 mm` | `11,810 mm` | `11,810 mm` | `0 mm` | `0 mm` | `0 mm` |

At this named sample the ideal Probe CPU ray and GPU distance lookup both hit or lie within the `architecture-rise-street-sign-face-back`; the GPU cubemap point is within `0.000935 m` of its CPU ray hit. Its angular parallax is `5.505°`, and the virtual-image projection is displaced `22.817 px` from the Planar point at 768×614. The GPU/CPU match validates the cube-distance reconstruction. The approximately 0.292 m Probe-to-Planar position error is the single-probe origin approximation and is not a cubemap quantization error.

The Probe uses `Q_virtual_probe` from its own radial-distance cube for CoC; it does not reuse Planar `Q`. The existing PR M apparent-position CoC shader/binding, half-float physical CoC storage, far/near gathers, contribution resolve, float linear sum, and shared film composite are exercised unchanged. Probe GPU CoC matches its CPU physical-footprint result within the existing `0.001 mm` storage tolerance at both fixed states:

| State | Planar CPU / GPU reflected CoC | Probe CPU / GPU reflected CoC | Probe GPU − Planar GPU |
| --- | ---: | ---: | ---: |
| Pane focus, `8,890 mm` | `+0.05781962 / +0.05783081 mm` | `+0.05782869 / +0.05783081 mm` | `<0.000001 mm` |
| Reflection focus, `11,810 mm` | `−0.00004457 / −0.00004554 mm` | `−0.00003546 / −0.00003576 mm` | `+0.00000978 mm` |

The optical focus lesson remains: the Probe contribution has about `+0.05783 mm` signed CoC at pane focus and approximately zero CoC at the validated reflected-focus control. That does not preserve the measured Planar sign-detail sharpness response. Using the same bounded edge-gradient metric, Planar rises from `0.000107956` to `0.000131275` (`1.216×`) between the two states; Probe measures `2.06773e−7` to `1.17965e−13` (`5.705e−7×`). Probe's reflection-focus crop has samples but essentially no edge energy, so its control-state CoC is physically sharp while this scene patch does not demonstrate retained sign detail. The 768×614 screenshots show a small, low-detail reflection patch. Thus the focus math is validated, but visible sign sharpness/recognizability does not match the Planar reference.

At the named pane pixel, Planar radiance is `(0.04920750, 0.05475029, 0.05529296)` and Probe radiance is `(0.04921875, 0.05475586, 0.05528320)`. Absolute per-channel RGB differences are `(0.00001125, 0.00000557, 0.00000975)`; the luma difference is `0.00000567` (about `0.0106%` relative). That local color match does not cancel the 22.8 px spatial displacement or weak region-detail result. The E2E saves Planar and Probe pane-focus/reflection-focus screenshots in its Playwright output; hashes are not used as optical assertions.

The selected capture is one 128² color cubemap and one matching radial-distance cubemap, both RGBA16F / `HalfFloatType`, `NoColorSpace`, and nearest sampled. The color cube stores captured scene radiance; the distance cube stores renderer-metre radial distance in red and validity in alpha. The 20 glazing meshes are excluded, scene background is cleared rather than copied into the cube, and the same world environment rig remains active. Chromium WebGL2 reports `EXT_color_buffer_float`; all six faces on each cube are framebuffer-complete (`0x8cd5`). Readback resolves a cube sample into an RGBA32F target and reads it as `Float32Array`. Nearest cube sampling is used, so the comparison does not depend on float linear filtering.

At 768×614, the Probe fixture owns 19 proof targets and its nominal target texel payload is `116,631,552 bytes` (`111.23 MiB`, not measured VRAM). The two capture cubes account for `1,572,864 bytes` (`1.50 MiB`) before per-face depth attachments and driver overhead. The full PR P fixture reports `130,148,352 bytes` (`124.12 MiB`); this is a fixture-wide topology comparison, not a production or candidate-only VRAM benchmark. The Probe capture renders six color faces and six distance faces once (12 face renders total), with no recapture for the second focus state. Across both focus states the test also records 2 direct scene renders, 4 world-position scene renders, 2 pane-mask renders, 4 mapping resolves, 2 validity passes, 4 CoC passes, 8 gathers, 4 focus resolves, 2 linear sums, and 2 shared composites. Candidate GPU performance remains unmeasured.

Observed teardown events reconcile: 20/20 owned render targets (19 proof targets plus the temporary float-capability target), 1/1 direct texture, 16/16 materials, and 1/1 geometry; no duplicate disposal events occurred. All 4/4 registered custom disposer callbacks ran, and `renderer.dispose()` was invoked separately. The renderer reported 36 textures before teardown. These counts describe the development fixture only.

The comparison test changes no production renderer or scene source. It asserts the imported `GROUND_GLASS_PASS_ORDER`; production `GroundGlassRTT` remains the unchanged single-contribution path. No Observer reflection, production Probe, multi-probe blend, box correction, SSR, or planar renderer is introduced. Current glass roughness near `0.24` may require distributed apparent-focus semantics, which this single-point cube study does not represent. Final classification is **PROBE FOCUS PATH VALIDATED — SINGLE-PROBE APPROXIMATION LIMITED**; no production technique is selected.

## PR R — distance-cube parallax correction feasibility

**Base:** `main @ aac756056868f61cc87b224e50e12285d2dc1ce0` (the PR #240 merge). PR P and PR Q were rerun first and remained green. The selected Probe origin, 128² RGBA16F color/distance cubes, nearest sampling, scene, focus states, and reflection weight remain frozen.

The CPU ideal study starts with the physical pane-reflected direction `d₀ = R`. Each radial sample is an actual raycast from the fixed Probe origin `O`; it reconstructs `Qₖ`, projects `(Qₖ − P)` onto the physical ray `R`, then updates `dₖ₊₁ = normalize(P + max(dot(Qₖ − P, R), ε)R − O)`. It never raycasts from `P` to create a corrected hit. Planar `Q` and `Q_virtual` are read only after the final Probe raycast, for comparison. The region remains PR Q's strict 12-sample `architecture-rise-street-sign-face-back` subset.

### CPU ideal iteration study

All five bounded iteration counts kept 12/12 same-face hits, with zero wrong objects, no-hit samples, invalid intermediate samples, and detected two-cycle oscillations. For these front panes, `Q` and `Q_virtual` error magnitudes are equal because the pane normals are parallel. Optical-axis focus error is effectively zero at every count.

| Iterations | Median / p95 Q and Q_virtual error (m) | Median / p95 angular parallax | Median / p95 focus-axis error (mm) | Named Q / Q_virtual error (m) | Named displacement at 768×614 |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | `0.127152 / 0.326599` | `2.379° / 6.163°` | `0 / <0.000001` | `0.292738 / 0.292738` | `22.863 px` |
| 1 | `0.002016 / 0.010758` | `0.0376° / 0.2026°` | `0 / <0.000001` | `0.004374 / 0.004374` | `0.342 px` |
| 2 | `0.0000346 / 0.0004088` | `0.000647° / 0.007704°` | `0 / <0.000001` | `0.0000663 / 0.0000663` | `0.00518 px` |
| 4 | `7.29e−9 / 5.92e−7` | `0° / 0.0000111°` | `0 / <0.000001` | `1.53e−8 / 1.53e−8` | `<0.000002 px` |
| 8 | `7.02e−16 / 1.24e−12` | `0° / 0°` | `0 / <0.000001` | `9.42e−16 / 9.42e−16` | `<0.000001 px` |

At one iteration, the CPU region p95 `Q_virtual` error falls by `96.7%` from the PR Q baseline. The final direction update is not yet angularly stable at the `0.01°` reporting threshold for 12/12 samples; it has zero detected oscillations. At two iterations, 11/12 samples still exceed that direction-change threshold even though the geometric error is already sub-millimetre. Four iterations stabilize all 12 samples. The iteration count is therefore bounded by measured output quality, not described as a converged fixed point.

### Named three-way comparison

The corrected full-screen Probe GPU path uses the production Ground Glass camera and the same `Q_virtual` CoC/gather/resolve path as PR P and PR Q. The CPU and GPU correction-region rows use the exact `(0.3, 0.3)` geometry sample; the full-screen GPU row uses the pane source pixel selected from the rendered position target.

For a corrected fixture invocation, the top-level named CPU fields come from the CPU study row matching the requested correction count, and the full-screen GPU fields use that same count. With no correction query, both remain at the PR Q zero-iteration baseline. At one iteration, the exact `(0.3, 0.3)` CPU-to-region-GPU `Q` error is `0.001115 m`; the top-level one-step CPU-to-full-screen-GPU `Q` and `Q_virtual` errors are each `0.006973 m`. The latter comparison includes full-screen pane-source pixel selection, while the region diagnostic uses the exact geometry sample.

| Quantity | Planar reference | PR Q uncorrected Probe GPU | PR R one-step ideal CPU | PR R one-step full-screen Probe GPU |
| --- | ---: | ---: | ---: | ---: |
| `Q` (m) | `(-1.523311, 1.354945, 5.865000)` | `(-1.415949, 1.626701, 5.864392)` | `(-1.521698, 1.359011, 5.865000)` | `(-1.527284, 1.354891, 5.865665)` |
| `Q` error vs Planar | `0 m` | `0.292196 m` | `0.004374 m` | `0.004028 m` |
| `Q_virtual` (m) | `(-1.523311, 1.354945, 11.807000)` | `(-1.415949, 1.626701, 11.807608)` | `(-1.521698, 1.359011, 11.807000)` | `(-1.527284, 1.354891, 11.806335)` |
| `Q_virtual` error vs Planar | `0 m` | `0.292196 m` | `0.004374 m` | `0.004028 m` |
| Named angular parallax | `0°` | `5.505°` | `0.0830°` | `0.0806°` |
| Virtual-image displacement | `0 px` | `22.817 px` | `0.342 px` | `0.317 px` |
| Optical-axis focus distance | `11,807 mm` | `11,807.608 mm` | `11,807.000 mm` | `11,806.335 mm` |
| Focus-axis error vs Planar | `0 mm` | `0.608 mm` | `<0.000001 mm` | `0.665 mm` |
| Rounded public focus | `11,810 mm` | `11,810 mm` | `11,810 mm` | `11,810 mm` |

The one-step corrected GPU's exact 12-point diagnostic region retains 12/12 target-face directions, with zero wrong-object or no-hit samples. Median/p95 Planar `Q_virtual` error is `0.004457 / 0.010773 m`; median/p95 CPU-ideal-to-GPU reconstruction error is `0.001031 / 0.009517 m`. Regional median/p95 angular parallax is `0.02696° / 0.20494°`, and focus-axis error is `1.011 / 9.456 mm`. Its GPU sample at the exact named point is `0.001115 m` from the CPU ideal; the full-screen source-pixel result is `0.004028 m` from Planar.

The CPU study's two-iteration p95 error is lower, but it does not justify doubling GPU samples for this candidate. An **exploratory measured comparison, not regression-protected decision authority**, found that a two-step GPU run reduced region p95 from `0.010773 m` to `0.009449 m` (about `12%`) while the named full-screen Planar error rose from `0.004028 m` to `0.007116 m`. The one-step count is the smallest bounded update that captures most of the measurable GPU improvement in the current measurements.

### Focus and detail

The fixed focus states remain `8,890 mm` and `11,810 mm`. Corrected GPU reflected CoC is `+0.057800 mm` at pane focus and `−0.0000252 mm` at reflection focus; both remain inside the existing half-float storage tolerance and within `0.002 mm` of the Planar GPU result. The focus axis rounds to `11,810 mm`.

| Reflected-sign edge-gradient energy | Pane focus | Reflection focus | Reflection / pane |
| --- | ---: | ---: | ---: |
| Planar | `0.000107956` | `0.000131275` | `1.216×` |
| PR Q uncorrected Probe | `2.06773e−7` | `1.17965e−13` | near zero |
| PR R one-step corrected Probe GPU | `0.000114086` | `0.000137465` | `1.205×` |

The corrected reflection-focus edge energy is about `1.05×` Planar and vastly above the uncorrected Probe result. The fixture saves normal-scale Planar, uncorrected Probe, and corrected Probe reflection-focus screenshots in ignored Playwright output. Radiance is sampled from the same corrected cube direction; this local RGB measurement is diagnostic and does not replace the spatial/detail evidence.

### Cost, resources, and limits

One iteration adds one radial-distance cube sample per fragment in each existing mapping resolve. The radiance and apparent-position outputs together therefore add two distance-cube samples per source pane pixel per focus state. It adds no color-cube sample, no candidate fullscreen pass, no scene capture, and no recapture for focus changes. The existing capture remains six color plus six distance cube faces: 12 scene renders total.

The candidate capture resources remain one 128² RGBA16F color cube and one 128² RGBA16F radial-distance cube, both linear `NoColorSpace` and nearest sampled, for `1,572,864 bytes` (`1.50 MiB`) nominal texel payload. The WebGL2 `EXT_color_buffer_float` path, half-float cube framebuffer checks, and nearest-filter support are unchanged. The separate E2E region diagnostic adds one 12×1 Float32 point target, two 12×1 Float32 input textures, one shader material, and one diagnostic pass; its target payload is 192 bytes and it is not part of the candidate mapping path. Its framebuffer was complete (`0x8cd5`) and read back through `Float32Array`.

Corrected-fixture disposal events reconcile: 21/21 owned render targets, 3/3 direct textures, 17/17 materials, 1/1 geometry, and 4/4 custom disposers; there were no duplicate disposal events, and renderer teardown was invoked. These and the small region target are development-fixture evidence. Chromium/SwiftShader timing is not hardware GPU performance evidence; candidate performance remains **unmeasured**.

**Outcome at the PR R stage: DISTANCE-CUBE PARALLAX CORRECTION PROMISING.** In this tested 12-sample region, one fixed Probe and one radial-distance update materially reduce parallax while preserving same-face coverage, focus-axis control, the PR M focus path, and sign detail. This did not select Probe for production. PR S subsequently tested the frozen candidate at normal Observer scale and rejected it; see the next section. The study covers a fixed scene and strict sign-face region, uses a 128² nearest-sampled cube, and does not model current roughness near `0.24` as a distribution of reflection directions. The correction shader does not consume Planar points, sign bounds, or target-specific data. No production renderer, scene, optics, or public behavior changed; hardware timing and broader scene coverage remain unmeasured.

## PR S — corrected Probe Observer-scale appearance pilot

**Base:** `main @ 30098d044ff5fd8b2a14693c6d310980c5459455` (PR #241 merge). The standalone development/E2E fixture uses the current Architecture Rise Observer subject, Observer lighting/shadow/environment authorities, the front façade glazing, and the frozen PR R candidate. It does not use Ground Glass lens/CoC/gather behavior or derive `Q_virtual`; the radial-distance cube supplies Probe parallax correction only.

The candidate remains fixed at Probe origin `(-1.2725, 1.5000, 6.9720) m`, 128×128×6 RGBA16F `HalfFloatType` color and radial-distance cubes, `NoColorSpace`, nearest sampling, one bounded correction update, and reflection weight `0.18`. The original glass remains `MeshStandardMaterial(#182d37, roughness 0.24, metalness 0.08)`; its environment response is preserved while the local linear Probe radiance is added before output conversion. The shader gate checks the actual object-space `-Z` face of the front glazing only. No candidate parameter was adjusted from the captures.

The normal-scale decision surface is 514×411. View A uses the production Architecture Rise camera placement: position `(6.5, 3, -6.5) m`, target `(0, 0.9, 5.6) m`. View B uses the fixed comparison orbit: position `(11.037666, 3, 0.323947) m`, same target. Both use FOV 45°, near 0.01 m, far 200 m. The 4×4-per-pane sample domain includes only projected front-face `-Z` glazing samples reached by the direct camera ray.

### Observer geometry

Each visible-pane sample was compared with the real scene reflected ray, with glazing excluded from self-hit tests. Physical no-hit samples remain in the denominator. The table reports candidate hit counts as same-object / wrong-object / candidate-no-hit; false positives are valid local Probe hits where the physical ray has no local hit, and false negatives are Probe no-hits where the physical ray does hit.

| View | Visible panes samples | Physical hit / no-hit | Uncorrected CPU: same / wrong / no-hit; FP / FN | Corrected CPU: same / wrong / no-hit; FP / FN | Corrected GPU: same / wrong / no-hit; FP / FN |
| --- | ---: | ---: | ---: | ---: | ---: |
| Default | 238 / 256 | 54 / 184 | 2 / 44 / 52; 140 / 8 | 22 / 24 / 146; 46 / 8 | 22 / 24 / 146; 46 / 8 |
| Alternate | 171 / 256 | 29 / 142 | 0 / 0 / 171; 0 / 29 | 0 / 0 / 171; 0 / 29 | 0 / 0 / 171; 0 / 29 |

| View A geometry error against physical hits | Median / p95 Q error | Median / p95 angular error |
| --- | ---: | ---: |
| Uncorrected Probe CPU | 5.609 / 8.235 m | 29.872° / 34.700° |
| One-step corrected Probe CPU | 4.812 / 7.196 m | 14.046° / 18.125° |
| One-step corrected Probe GPU | 4.817 / 7.206 m | 14.171° / 18.016° |

For View A, corrected GPU-to-CPU Q reconstruction error is 0.010589 m median / 0.111673 m p95, so the GPU follows the corrected CPU candidate. However, only 22 of 54 physical local hits land on the same object, 24 hit a different object, and 46 of 184 physical no-hit samples produce a false local reflection (25%). The alternate view is a stronger failure: it has 29 physical local hits, but all 171 visible samples lack an initial distance-cube sample, leaving 29/29 false negatives and no local Probe output. This is not a Ground Glass focus failure; it is Observer view coverage/mapping.

### Normal-scale appearance at 514×411

Image deltas are normalized mean absolute RGB display-channel differences over `[0,1]`. A changed pixel is one where the maximum absolute difference across its Uint8 RGB channels is strictly greater than 2 display-byte levels (`>2/255` in normalized display-domain values); this threshold defines the full-frame, front-glazing, and outside-mask changed-pixel fractions. The front-glazing mask comes from the actual glazing geometry, and the outside metric excludes a small antialiasing expansion around that mask.

| View | Comparison | Full-frame mean delta | Changed frame pixels | Glazing mean / p95 delta | Changed glazing pixels | Outside expanded glazing mean delta |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Default | Baseline → uncorrected | 0.000631 | 0.634% | 0.077738 / 0.151634 | 78.08% | 0 |
| Default | Baseline → corrected | 0.000509 | 0.296% | 0.062712 / 0.244444 | 36.50% | 0 |
| Default | Uncorrected → corrected | 0.000570 | 0.631% | 0.070161 / 0.150327 | 77.78% | 0 |
| Alternate | Baseline → uncorrected | 0 | 0% | 0 / 0 | 0% | 0 |
| Alternate | Baseline → corrected | 0 | 0% | 0 / 0 | 0% | 0 |
| Alternate | Uncorrected → corrected | 0 | 0% | 0 / 0 | 0% | 0 |

| View | Baseline glazing edge energy | Uncorrected Probe | Corrected Probe |
| --- | ---: | ---: | ---: |
| Default | 0.090309 | 0.077127 | 0.079633 |
| Alternate | 0.100672 | 0.100672 | 0.100672 |

At this decision scale the default view has a visible but low-detail glazing tone change; the sign and local scene are not clearly recognizable as reflected-world detail. The alternate view is identical to baseline. All measured outside-mask deltas are zero. The same captured Probe is reused across both cameras; view-change RGB signal is 0.078347 corrected and 0.098154 uncorrected over 171 shared physical pane samples, with no recapture. This proves camera-dependent output, but the zero-output alternate view shows that the fixed Probe does not behave coherently across these normal Observer views.

### Capture, environment, resources, and lifecycle

The fixture captured six color and six radial-distance faces once (12 scene renders total), excluded every `*-glazing` mesh, cleared the local background, and kept the same world environment active. Both cubes have matching origin, orientation, near/far, and scene visibility. The WebGL2 SwiftShader runner supported `EXT_color_buffer_float`; all 12 cube faces and both Float32 diagnostic targets were framebuffer-complete. Corrected GPU Q was read directly from `Float32Array`; 92 View A samples resolve to nonzero linear color (mean RGB 0.503), while View B resolves none. No display-domain readback is used as geometry evidence.

The corrected Observer candidate needs one RGBA16F color cube (786,432 bytes / 0.75 MiB) plus one RGBA16F radial-distance cube of the same size: 1,572,864 bytes / 1.50 MiB nominal texel payload, excluding depth attachments, diagnostics, and driver overhead. Two variable-width one-row Float32 geometry/radiance diagnostic targets are fixture-only. A corrected front-glazing fragment uses two distance-cube samples and one color-cube sample; relative to uncorrected, one correction adds one distance sample. The material-injection path adds no per-frame scene render or fullscreen pass. Capture remains 12 scene renders; no hardware timing is claimed.

Fixture lifecycle observations reconcile: 5/5 owned render targets, 16/16 direct textures, 19/19 materials, 3/3 geometries, 4/4 custom disposers, zero duplicate disposal events, and renderer teardown invoked. These are development-fixture counts, not production resources.

**Outcome: OBSERVER-SCALE CORRECTED PROBE REJECTED.** The default view proves the corrected radiance shader and GPU geometry path can produce an image change, and corrected GPU Q remains close to corrected CPU Q. The fixed candidate nevertheless has a 25% false-positive rate over default physical no-hit samples, substantial same-object misses/wrong-object mappings, and no local Probe response for 29 physical local hits in the alternate view. The 514×411 captures show no recognizable reflected subject detail and no transfer to the alternate view. Do not proceed with production planning for this frozen single-Probe candidate; reconsider whether Observer local reflection is worth pursuing and evaluate a different mapping/technique in a separately scoped study. Do not increase reflection weight or alter the Probe in this result.

## PR T — bounded multi-Probe coverage feasibility

**Base:** `main @ 635fd868063759e61c284046d0bac0515ee82632` (PR #242 merge). The CPU-only study first reran the PR S Observer fixture. Probe A remained frozen at `(-1.2725, 1.5000, 6.9720) m`, and every candidate used exactly one update from the existing PR R distance-cube correction helper. No color or distance cubemaps were allocated for PR T.

The 514×411 evaluation uses View A, the PR S default camera `(6.5, 3.0, -6.5) m`, and View B, the PR S alternate camera `(11.037666, 3.0, 0.323947) m`; both look at `(0, 0.9, 5.6) m` with 45° FOV, 0.01 m near, and 200 m far. View C is the deterministic midpoint `(8.768833, 3.0, -3.0880265) m` with the same target and is held out from placement scoring. Each view uses the PR S rules: 4×4 samples per visible front-glazing pane, direct camera visibility, object-space `-Z` face only, and physical reflected-ray samples that exclude glazing while retaining physical no-hit cases.

The deterministic `5×4×4` origin grid was derived from the front-pane, façade, reflected-world, ground/support, and Observer-target geometry. Its bounded corridor was `x=[−3.35, 3.35] m`, `y=[−0.80, 2.8775] m`, `z=[5.80, 8.7735] m`. Of 80 grid points, 79 were valid. Rejections were: outside corridor `0`, duplicate of Probe A `0`, glazing intersection `0`, inside a scene-mesh AABB `1`, and too near solid geometry `0`. All 79 valid origins were evaluated for Probe B. The offline placement ranking used physical same-object, false-negative, false-positive, wrong-object, p95 Q-error, and p95 angular-error evidence in that order, with stable grid order resolving candidate ties. Probe count was selected separately through an explicit marginal-benefit gate favoring two when a third did not add enough decision-driving coverage. This is an **offline placement oracle** only. At runtime, the test selector sees each candidate's validity and perpendicular distance from its reconstructed Q to the pane's physical reflected ray; it chooses the valid candidate with the smallest residual and breaks ties by lower Probe index. It receives no physical Q, hit-object identity, Planar data, sign bounds, or expected object, and it does not blend candidates.

The Probe A-only CPU reproduction matched PR S: View A had 238 visible samples, 54 physical hits and 184 no-hits; Probe A produced 22 same-object hits, 24 wrong-object hits, 46 false positives, and 8 false negatives. View B had 171 visible samples, 29 physical hits, and no valid Probe A candidates, so all 29 were false negatives. The study fails closed before multi-Probe scoring if this baseline changes.

Every A+B pairing was scored on Views A+B, then ranked by the declared priority. The best second origin ranked first of 79 at grid candidate 71, `(3.3500, 0.4258, 8.7735) m`. The A+B gate for evaluating a third Probe required at least 8 additional same-object training hits, at least 10 fewer View B false negatives, and no more than a 10-percentage-point increase in training false-positive rate; the selected pair passed with +50, −26, and +1.22 points respectively. Across the 409 training samples, the selected pair produced 72 same-object hits, 8 wrong-object hits, 50 false positives, and 3 false negatives from 83 physical hits and 326 physical no-hits. Same-object coverage was `86.75%`, false-positive rate `15.34%`, false-negative rate `3.61%`, and wrong-object rate `9.64%`; median/p95 Q error was `0.36025 / 1.14945 m`, and median/p95 angular error was `2.550° / 5.667°`. Probe A alone produced 22 same-object, 24 wrong-object, 46 false-positive, and 37 false-negative samples over the combined training views, with p95 Q error `7.1963 m`.

| Selected two-Probe view | Same / wrong object | False positive / false negative | Coverage / FP rate / FN rate / wrong-object rate | Median / p95 Q error | Median / p95 angular error |
| --- | ---: | ---: | ---: | ---: | ---: |
| A, 238 visible; 54 physical hits / 184 no-hits | 46 / 8 | 46 / 0 | 85.19% / 25.00% / 0% / 14.81% | 0.32817 / 1.05076 m | 2.380° / 5.349° |
| B, 171 visible; 29 physical hits / 142 no-hits | 26 / 0 | 4 / 3 | 89.66% / 2.82% / 10.34% / 0% | 0.61640 / 1.32115 m | 3.312° / 6.257° |
| A+B training | 72 / 8 | 50 / 3 | 86.75% / 15.34% / 3.61% / 9.64% | 0.36025 / 1.14945 m | 2.550° / 5.667° |

The selector chose Probe A/B `48/52` times in View A, Probe B `30` times in View B, and Probe B `42` times in holdout View C. In View A, `138` samples had no valid Probe, `56` had one, and `44` had both; on those 44 multi-valid samples, the residual selector chose the physical same-object candidate 36 times (`81.82%`). View B had 141 zero-valid and 30 one-valid samples; View C had 192 zero-valid and 42 one-valid samples. Probe A alone had no valid candidate for the 64 physical View C hits. With the selected pair, holdout C had 64 physical hits and 170 no-hits: 27 same-object, 15 wrong-object, 22 false-negative, and zero false-positive results. That is `42.19%` same-object coverage, `34.38%` false-negative rate, and `23.44%` wrong-object rate, with median/p95 Q error `0.83871 / 4.18800 m` and angular error `3.756° / 7.472°`. The pair materially repairs the optimized endpoint views but does not generalize sufficiently to the held-out orbit.

Because the A+B training gain passed that gate, 78 remaining origins were evaluated as Probe C candidates using A+B only. The top third origin ranked first of 78 at grid candidate 68, `(3.3500, 0.4258, 5.8000) m`. The third-Probe complexity gate required at least 5 additional same-object hits or 5 fewer false negatives, while limiting added false positives to 5 percentage points and added wrong-object hits to 5. The best C added only 3 same-object training hits, removed 3 false negatives, and added no false positives relative to the selected pair; p95 training Q error moved from `1.14945 m` to `0.86468 m`. The fixed complexity rule therefore kept the two-Probe configuration.

| Best-three configuration view | Same / wrong object | False positive / false negative | Coverage / FP rate / FN rate / wrong-object rate | Median / p95 Q error | Median / p95 angular error |
| --- | ---: | ---: | ---: | ---: | ---: |
| A | 46 / 8 | 46 / 0 | 85.19% / 25.00% / 0% / 14.81% | 0.32817 / 1.05076 m | 2.380° / 5.349° |
| B | 29 / 0 | 4 / 0 | 100% / 2.82% / 0% / 0% | 0.21227 / 0.42787 m | 1.530° / 3.159° |
| A+B training | 75 / 8 | 50 / 0 | 90.36% / 15.34% / 0% / 9.64% | 0.30859 / 0.86468 m | 1.946° / 4.574° |
| C holdout | 35 / 13 | 0 / 16 | 54.69% / 0% / 25.00% / 20.31% | 0.38161 / 3.34945 m | 1.825° / 4.870° |

For the best-three selector, View A chose A/B/C `48/52/0` times, View B chose `0/13/20`, and holdout C chose `0/19/29`. Valid candidate counts for Views A/B/C were respectively `138/56/44/0`, `138/7/26/0`, and `186/6/42/0` for zero/one/two/three valid Probes. Among multiple-valid samples, the selector chose a same-object candidate `36/44` times in View A, `26/26` in View B, and `29/42` in holdout C. After freezing the two-Probe choice, holdout C had 64 physical hits and 170 no-hits: 27 same-object, 15 wrong-object, 22 false-negative, and zero false-positive results. That is `42.19%` same-object coverage, `34.38%` false-negative rate, and `23.44%` wrong-object rate, with median/p95 Q error `0.83871 / 4.18800 m` and angular error `3.756° / 7.472°`. The pair materially repairs the optimized endpoint views but does not generalize sufficiently to the held-out orbit. The best three improves C to 35 same-object hits, but still misses one quarter of physical hits and has a 20.31% wrong-object rate. Holdout evidence was not used to choose Probe C's location or the selected Probe count.

The **Outcome is MULTI-PROBE COVERAGE IMPROVES BUT COMPLEXITY / VALIDITY IS NOT JUSTIFIED**. No GPU phase was started. A corrected Probe pair would nominally own `3.00 MiB` of candidate cube texels and require 24 color-plus-distance face renders when reflected world content changes; a camera orbit alone would not require recapture of fixed world-space cubes. Evaluating both candidates would use four radial-distance samples per pane pixel plus one winning color sample. Three Probes would scale to `4.50 MiB`, 36 face renders, and six radial-distance samples. These are resource/sample-count estimates, not measured GPU time; PR T itself allocates no GPU resources and runs no render passes. The changes are confined to tests and decision documentation. Close local Probe planning for the current Architecture Rise production path and return to the architecture choice among Planar, another technique, or no local Observer reflection.

## Candidate 1 — constrained / planar reflection

**Status: PR N's appearance prototype was not selected; PR P validates a separate bounded optical reference.** PR N derived front and side reflection planes from their glazing meshes and rendered two 256×256 RGBA16F color targets per renderer. Its Ground Glass images used the pane-depth source path, and its PR N scene scan found 0/144 front and 0/36 side finite hits. PR P now uses the real PR O street-sign sample to verify ideal planar reflected radiance and independent focus in a standalone test fixture. It does not retain PR N's prototype, implement a production planar renderer, or compare planar against another technique. PR N's fixed-weight clean Observer comparison still showed no useful normal-scale appearance improvement; its alternate planar frame mostly behind the building remains excluded.

Both renderers need front/side reflection radiance and their own camera, clipping, pane assignment, and color resources. The prototype added two reflection renders per frame per renderer. Its Ground Glass color was present before the existing CoC pass but remained associated with the pane's source depth. Observer needs no reflected virtual-depth resource; Ground Glass still needs independent reflected-focus semantics or an equivalent representation. The prototype supplied neither.

The nominal color-target payload was 1 MiB per renderer (two 256² RGBA16F targets), 2 MiB total, excluding renderbuffer and driver overhead. The normal-scale image did not justify selecting planar reflection before the Ground Glass contribution path can represent its focus behavior.

## Candidate 2 — screen-space reflections

**Status: bounded prototype rendered, no usable local reflection established.** Each renderer captured scene color into one 256×256 RGBA HalfFloat target and ordinary scene depth into one 256×256 UnsignedInt depth texture. On the Chromium WebGL2 runner, `EXT_color_buffer_float` was present and the color framebuffer was complete (`0x8cd5`). The pane-only shader used a bounded 64-step screen-space ray march. The correct reflected-ray orientation did not produce a reliable visible hit in the captured default or alternate views. A diagnostic run with the opposite direction found façade self-geometry, so those hits were not counted as reflected scene content.

Observer needs SSR's ordinary scene color/depth algorithm inputs and reflection-color resolve; that depth is not Ground Glass virtual-image depth. The Ground Glass prototype likewise used its own renderer-local color/depth capture. A real Ground Glass integration could reuse the existing source depth for SSR reconstruction, but it would still need to route reflected radiance through independent focus semantics before `cocFootprint`. No virtual-position field or contribution-local focus pass was produced by this prototype. Off-screen geometry remains unavailable to SSR, and screen-edge, occlusion, and disocclusion behavior remain view-dependent.

The nominal captured color-plus-depth texture payload was 0.75 MiB per renderer (0.5 MiB RGBA16F color plus 0.25 MiB 32-bit depth), 1.5 MiB total. The extra scene capture was rendered each frame; candidate GPU time and hit coverage were not measured. The framebuffer capability passing does not establish a visually useful SSR result.

## Candidate 3 — local reflection probe / CubeCamera

**Status: PR N's capture-only candidate was not validated; PR Q validates the uncorrected development-only focus path and measures its single-Probe approximation as limited. PR R finds a bounded distance-cube correction promising in its fixed Ground Glass region. PR S rejects the frozen corrected Probe for normal-scale Observer use. PR T finds that two Probes improve the optimized views but do not justify multi-Probe complexity because holdout coverage remains limited; local Probe planning is closed for the current Architecture Rise production path.** PR N's temporary harness captured one local 128² CubeCamera color cube at `(1.45, 8.8, 8.55)` m and one RGBA HalfFloat radial-distance cube in each renderer. Its sidecar did not retain a numeric sample-to-radiance mapping or route the value into a Ground Glass contribution/CoC target. PR Q is separate: it verifies a single renderer-local color and distance cube, reconstructs `Q_probe` / `Q_virtual_probe`, and sends Probe radiance plus its own apparent position through the PR M focus path in an E2E fixture. PR R adds one bounded distance-cube update in the development mapping path; the correction materially reduces the tested parallax and restores reflected-sign detail toward the Planar reference. PR N's Observer candidate was color-only, but the corrected PR R/S Observer candidate needs both color and radial-distance cubes; Observer uses distance for parallax, not focus. None of these fixtures enables production Probe reflections.

On Chromium WebGL2, `EXT_color_buffer_float` was present and both color and distance framebuffers were complete (`0x8cd5`). Half-float linear filtering was unavailable, so the distance cube used nearest filtering; the color cube was UnsignedByteType with linear filtering. No half-float linear-filtering fallback was needed. The local probe color was only subtly different from the same-camera baseline at normal display scale: the pane crop's absolute luminance difference averaged 1.85/255 in the default view and 1.11/255 in the matched alternate orbit, with a maximum of 35/255 in each crop. This did not yield a clearly recognizable façade reflection at normal scale.

PR N's Ground Glass captures at 8,890 mm and 12,470 mm confirmed only the existing source/DOF path; the reflected color remained on the pane-depth source pixel. That prototype did not pass independent-focus evidence. PR Q later verified the contribution/CoC path at the fixed 8,890 mm and 11,810 mm states, but found the single probe's position and detail errors listed above. Current roughness near 0.24 may require distributed apparent-focus semantics rather than one point.

PR N's historical harness payload estimate was 1.125 MiB per renderer: 0.375 MiB for the RGBA8 color cube and 0.75 MiB for the RGBA16F distance cube (2.25 MiB across both renderers), excluding per-face depth attachments and driver overhead. Its corrected ownership estimate was 0.375 MiB for Observer and 1.125 MiB for Ground Glass. PR Q instead measured its development fixture's two RGBA16F capture cubes at 1.50 MiB total; the full fixture payload is reported in the PR Q section above. These different harness formats are not hardware performance evidence. A production lifecycle would need to invalidate a capture when reflected world content changes.

## Comparison matrix

Ratings distinguish prototype observations from unmeasured performance or unimplemented focus behavior. Candidate appearance rows distinguish PR N's visual pilot from PR Q's measured Probe/Planar fixture comparison. PR P remains the ideal planar optical reference; neither fixture is production execution. PR T adds CPU-only bounded Observer geometry evidence and does not add a candidate renderer.

| Criterion | Environment only | Planar | SSR | Probe / CubeCamera |
| --- | --- | --- | --- | --- |
| Nearby geometry at normal scale | No; baseline capture | Captured, but no useful normal-scale improvement | No reliable hit in the tested views | PR S rejects one frozen Probe; PR T's pair improves Views A/B but remains materially incomplete on holdout C |
| Off-screen geometry | No | Only within reflection-camera frustum | No | Available in the captured cube, subject to exclusions |
| Front glazing | Dark/flat baseline | PR N captured appearance with pane-depth focus; PR P validates a test-only `Q_virtual` reference | No reliable correct-direction hit | PR Q/R validate the Ground Glass focus path; PR T's offline selected pair reaches 86.75% training same-object coverage but 42.19% on holdout C |
| Side glazing | Dark/flat baseline | Separate side-plane capture required; alternate attempt was not a useful view | View/screen dependent; no reliable hit | Not tested by PR S; front-façade only |
| Parallax / image mapping | Not applicable | Plane-specific projective mapping | Screen-space hit position | PR Q baseline: 12/12 strict target-face hits, p95 `Q_virtual` error `0.327 m`, named offset `22.817 px`; PR R one-step correction: 12/12, p95 `0.0108 m`, named GPU offset `0.317 px`; PR T's two-Probe holdout p95 Q error is `4.188 m` |
| Observer focus/depth need | None | Color/radiance only | Ordinary scene depth may be an SSR input; no reflected virtual depth for focus | Corrected PR R/S candidate uses color + radial-distance cubes for appearance/parallax; distance is not focus data |
| Ground Glass focus need | Existing pane depth | Independent reflected-focus semantics required; PR P verifies it for one front-pane sample | Independent reflected-focus semantics required if a valid SSR hit exists; SSR input depth is distinct | Independent reflected-focus semantics required; a distance cube alone does not establish a mapped contribution |
| Focus-correct integration result | Existing one-source path | PR P validates real front-pane `Q` / `Q_virtual` through the PR M contribution and focus path in a test fixture; no production renderer selected | Inconclusive: correct direction had no reliable hit; opposite self-hit rejected | PR Q validates uncorrected Probe `Q_virtual` through the physical CoC path; PR R preserves the same focus path after correction; no production renderer selected |
| Candidate Ground Glass result | Existing pane path | PR P's ideal planar reference focuses at `Q_virtual`; PR N's candidate overlay remained pane-depth and was not focus-correct | No validated color hit or virtual-position output | PR Q's uncorrected Probe has weak reflected detail; PR R one-step correction restores the focus-state response to about `1.205×` and reaches about `1.05×` Planar reflection-focus edge energy in the fixed fixture |
| Production pre-CoC integration | Existing one-source path | None retained | None retained | None retained |
| Raw/Upright candidate validation | Existing behavior | Not run: no candidate contribution path | Not run: no candidate contribution path | Not run: no candidate contribution path |
| Extra renders in prototype | 0 | PR N: two reflection views per renderer per frame; PR P: 2 planar color renders across two test states | One scene color/depth capture per renderer per frame, plus pane ray march | PR Q/R: 6 color + 6 distance faces once, reused across focus states; correction adds one distance-cube sample per output pixel, no candidate fullscreen pass or recapture. PR T is CPU-only with no scene render/capture |
| Extra targets per renderer | Existing PMREM | Two 256² RGBA16F color targets | One 256² RGBA16F color target + one 256² UnsignedInt depth texture | PR Q/R Ground Glass fixture: one 128² color + radial-distance cube; PR S Observer fixture: same pair plus two test-only geometry/radiance diagnostic targets; PR T allocates no GPU Probe resources |
| Nominal candidate target payload | Existing scene and PMREM | 1 MiB per renderer | 0.75 MiB per renderer | Corrected Probe: 1.50 MiB per renderer for the two RGBA16F cubes; PR S diagnostics excluded; PR Q full fixture 111.23 MiB is not measured VRAM |
| GPU performance | Baseline only; not decision-grade | Unmeasured | Unmeasured | Unmeasured |
| Lifecycle concern | Existing PMREM ownership | Camera/clipping update per renderer | Capture and depth/normal reconstruction per renderer | Recapture when reflected world content changes; PR Q observes disposal only in its development fixture |
| Main limitation | No local geometry response | PR P covers one ideal planar front-pane point only; rough-reflection distribution, side panes, production lifecycle, and candidate comparison remain unvalidated | On-screen visibility, edges, disocclusion, and no reliable tested hit | PR T's selected pair retains 23.44% wrong-object and 34.38% false-negative rates on holdout C; no GPU, appearance, lifecycle, or hardware performance evidence |
| Selection result | Baseline | Not selected | Not selected | PR T Outcome B: multi-Probe coverage improves but complexity/validity is not justified for current Architecture Rise planning; no production technique selected |

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

Each two-contribution frame executes ten full-resolution passes (two CoC, four gathers, two per-contribution focus resolves, one radiance sum, one shared composite); the single-contribution fixture path executes five and skips the sum. The one-pixel legacy byte control is an additional proof-only pass. These are test-fixture costs only. Production scenes still use the unchanged five-stage path; this fixture does not measure their target or pass counts.

The ordinary `GroundGlassRTT`, `groundGlassRttResources`, and `groundGlassPassGraph` were not changed by PR M: public scenes keep the existing five-stage normal path, and Raw RTT Debug keeps `sceneRender → composite`. This source-scope and imported pass-contract evidence does not claim a measured production target/pass count. Raw/Upright, image circle, natural illumination, relative illuminance, Focus Loupe, Architecture Rise, and Interior Corner continue through their existing production implementation. The synthetic proof does not validate rough reflected radiance: with current glass roughness near `0.24`, real reflected energy may need a distribution of apparent focus positions rather than one point per sample.

## Decision and follow-up boundary

**No production local-reflection technique is selected.** PR L established the local-geometry appearance gap. PR M validates the Ground Glass focus contract with synthetic radiance. PR N's candidate captures remain historical appearance-only evidence at the fixed 0.18 diagnostic weight; SSR remains technically inconclusive with no validated hit. PR O established a real `Q` and in-range `Q_virtual`; PR P validates one ideal planar radiance sample through the PR M focus path. PR Q validates the uncorrected single-Probe focus path and records its parallax/detail limitation. PR R shows that one update from the existing radial-distance cube materially reduces those errors in the fixed Ground Glass fixture. PR S rejects the frozen corrected single Probe at normal Observer scale. PR T finds that a two-Probe CPU selector substantially improves optimized A+B views but leaves only 42.19% same-object coverage and 23.44% wrong-object mappings on holdout C; the third Probe adds only three training hits and removes three false negatives. The local Probe family is closed for the current Architecture Rise production path unless new evidence or requirements justify reopening it. This does not select Probe, Planar, or another technique for production. Observer still needs reflection color/radiance integration and technique-appropriate resources, while Ground Glass also requires a separate reflected-focus representation or equivalent optical contract.

Recommended follow-up: close Probe planning for the current Architecture Rise production path and resume the technique decision between the retained Planar reference, another separately scoped candidate, or no local Observer reflection. Reopen Probe research only with new evidence or requirements. The CPU feasibility study does not validate a GPU selector, appearance, lifecycle, broader scene coverage, rough-reflection distribution, or hardware performance. Do not claim physically correct rough-reflection focus until the selected optical representation is rendered and verified. Current evidence still does not justify exactly two depth textures, buffers, or CoC values.

## Scope confirmation

PR O adds one presentation-only street sign; the building, canonical focus target, public focus range, task thresholds, glass material, daylight, environment, presentation lighting, optics, image-circle behavior, exposure, natural-shadow policy, external assets, and WebGPU/TSL remain unchanged. PR N's temporary renderer prototype was removed. PR P, PR Q, PR R, PR S, and PR T add only standalone development/E2E fixtures and tests plus decision evidence; their capture artifacts remain ignored Playwright outputs and are not part of the production build. PR T is a CPU-only geometry feasibility study and does not add GPU Probe resources. PR M intentionally retains the renderer-local `GroundGlassRadianceContribution` contract and apparent-world-position CoC shader/binding seam as durable architecture output, exercised by tests and the synthetic proof; these seams are not connected to the production Ground Glass executor. No production reflection technique or production multi-contribution executor is enabled or retained.
