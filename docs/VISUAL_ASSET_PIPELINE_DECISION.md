# Visual Asset Pipeline Decision

## Status

**Current decision for the visual-quality phase; accepted after PR G and rechecked against the PR I, PR J, and PR K illumination/material pilots.**

Date: 2026-10-05
Initial evidence base: `main @ 3a485d86b7de95f302c66fd79e6c82053bc1de7c`
Latest illumination-pilot base: `main @ b3c418cad7cd474c60fd244db0f987e799a943bf`
Scope: registered scene appearance assets after the Architecture Rise and Interior Corner pilots.

## Context

The question is whether current teaching scenes need a formal external texture or model pipeline now. The evidence is the accepted Architecture Rise and Interior Corner material pilots, current source and lifecycle contracts, and the existing scene-capacity diagnostics. The decision is not based on a goal of photorealism.

The pilots established that deterministic `DataTexture` maps can improve materials under the current WebGL, `MeshStandardMaterial`, and fixed presentation lighting. They did not compare those materials against local raster files or imported models. Consequently, the pilots establish the value of the current procedural approach, but do not establish a benefit from an external asset source.

## Evidence from Architecture Rise

[PR #225](https://github.com/chau-hm/view-camera-simulator/pull/225) added deterministic albedo, roughness, and normal maps for limestone, cut stone, and concrete. At the ordinary Observer canvas size (about 514×411), the clean view showed visible façade variation, block joints, and clearer separation among the existing façade, trim, roof, glass/recess, and sidewalk materials. The three visual rounds added no geometry. The result remained visibly better than the baseline and preserved Ground Glass as a regression surface.

The result also exposed limits. Glazing stayed dark and relatively flat without environment reflections, and the final scene was less dimensionally expressive than the generated target. The target's stronger warmth and brightness were not authority to retune lighting. The pilot report also records that tiny geometry additions by themselves did not guarantee a worthwhile visual return; geometry added in the earlier pilot branch was not part of the three material rounds.

The glazing uses a dark scalar `MeshStandardMaterial`; it does not use an authored raster surface map. A brighter or more detailed texture could change its surface color, but it cannot supply a missing reflected environment. PR I added a restrained fixed directional world source: the existing facade materials gained direct-light modeling, while the glazing remained dark and relatively flat.

PR J held the glazing material, geometry, directional daylight, presentation lighting, camera, and visible background constant while adding a deterministic 128×64 procedural sky/ground environment to `scene.environment`. PR K then changed only the shared Architecture Rise glazing material. Candidate A used `MeshStandardMaterial(color: #182d37, roughness: 0.1, metalness: 0)`; after A remained insufficient, Candidate B used opaque `MeshPhysicalMaterial(color: #182d37, roughness: 0.07, metalness: 0, ior: 1.5, transmission: 0, thickness: 0, specularIntensity: 1)`. The r186 thickness and specular values are the built-in defaults; this was an opaque response probe, not a calibrated glass model. At ordinary 514×411 Observer framing, neither candidate made the glazing read more clearly or produced a useful front-versus-side response. Candidate B changed only about 0.76% of clean-frame pixels, with a mean channel delta of 0.0054/255 confined to the glazing patch; the effect was not perceptible at presentation scale. Processed Ground Glass also showed no visible benefit (mean channel delta 0.0030/255; about 0.13% of pixels changed). Teaching overlays remained legible, Raw/Upright orientation behavior remained correct, and Interior Corner control captures were byte-identical. The production recipe was restored to baseline `MeshStandardMaterial(color: #182d37, roughness: 0.24, metalness: 0.08)`. Result: **MATERIAL RESPONSE — negligible**. The remaining absence of recognizable local scene reflections is a reflection-technique boundary, not evidence for raster textures or imported models.

Separate same-session standard-quality baseline/A and baseline/B profiles returned identical resource counts for all three configurations: Observer subject 327 meshes, 3 unique geometries, 15 unique materials, 12 unique textures, and 4,382 effective triangles; Ground Glass subject 326 meshes, 2 unique geometries, 14 unique materials, 12 unique textures, and 3,902 effective triangles; Ground Glass renderer memory 3 geometries and 24 textures. Ground Glass CPU-submit p50/p95 was 0.6/0.8 ms for the baseline and 0.7/0.9 ms for A, then 0.7/0.8 ms for the baseline and 0.8/0.9 ms for B. Physical DOF CPU-submit p95 was 0.1 ms at the B-run baseline and 0.2 ms for B. The baseline/B Chromium profile used a 1440×1000 viewport, standard quality, a 658×527 internal RTT target, and 60 samples. GPU queries were unavailable. Frame cadence p50/p95 was 222.7/251.3 ms at baseline and 238.2/277.4 ms for B on the CPU-fallback backend; this software-renderer timing is not evidence of GPU shader cost. The scalar material change added no scene geometry, textures, or render targets.

## Evidence from Interior Corner

[PR #227](https://github.com/chau-hm/view-camera-simulator/pull/227) reused the shared procedural surface generator for plaster and wood. The accepted clean Observer view showed improved floor, furniture, and frame material identity, while fabric and rug detail stayed restrained. The scene geometry, practical PointLight, and presentation-lighting values were preserved. Processed, Raw, and Upright Ground Glass checks showed that the registered asset change flowed through the existing RTT consumer without a second material path.

The final result intentionally retains some repeated straight wood-grain streaks. Wall and console grain remain subtle, and chair weave remains restrained. These are known limits of the current procedural surface recipe and its chosen contrast; the review accepted the result at normal scene scale. No raster comparison established that another source would improve it.

Interior Corner resource evidence shows that procedural maps have a cost: subject texture identities increased from 3 to 17 and renderer texture counts from 14 to 28. Objects (83), meshes (72), unique geometries (61), unique materials (10), and effective triangles (952) stayed unchanged. The software-rendered frame-cadence p95 changed from 420.0 to 512.5 ms, while scene and RTT CPU-submit timing stayed approximately level. Those cadence values are software-renderer observations, not GPU execution times. They do not show that raster assets would use more or less memory or run faster.

Evidence provenance: the PR #227 review handoff reports these counts and timing values as pilot-local benchmark observations; a benchmark report is not committed in this repository. The Processed, Raw, and Upright Ground Glass findings refer to manual review of the ignored `.dream-loop/interior-corner` working captures, not a checked-in capture artifact. The linked PR and current shared-factory path provide review context, but these observations should not be treated as a reproducible stored report.

## Current material and texture architecture

| Mechanism | Current purpose and implementation | Ownership / interpretation |
| --- | --- | --- |
| [`TeachingTextures`](../src/render/TeachingTextures.ts) and [`TeachingMaterials`](../src/render/TeachingMaterials.ts) | Deterministic 64×64 albedo patterns: `fine-grid`, `linear-grain`, `subtle-checker`, and `bands`. Low-contrast detail supports focus/readability in teaching subjects. | The subject factory owns the returned texture/material. `disposeTeachingSubjectResources()` releases material texture slots, geometry, and materials for an instance-owned subject. |
| [`ProceduralSurfaceMaterials`](../src/render/ProceduralSurfaceMaterials.ts) | Deterministic 128×128 `DataTexture` albedo, roughness, and normal maps for `limestone`, `cut-stone`, `concrete`, `plaster`, and `wood`. Albedo is sRGB; roughness and normal maps use `NoColorSpace`. Maps repeat, use linear/mipmapped filtering, and generate mip levels. | The scene factory chooses colors, patterns, repeats, roughness, and normal strength. Each instance owns its material and maps and uses the existing registered-subject disposal path. No global texture cache exists. |
| [`MacroSubjectMaterials`](../src/render/MacroSubjectMaterials.ts) | Deterministic 64×64 roughness maps add restrained machining variation; scalar roughness and metalness still define the macro material role. | Kept macro-specific because those scenes use roughness modulation for close-up material readability. It is not evidence for merging teaching, surface, and macro semantics into one API. |
| Focus Fundamentals marker maps | Two 64×64 `DataTexture`s provide small marker/crosshair/checker graphics. | Module-shared internal teaching visuals, not a general surface-material source. They follow the explicit module-lifetime registration. |
| Ground Glass depth fallback | One 1×1 `DataTexture` is created with the Ground Glass render-target bundle. | Renderer-internal fallback data; the RTT resource bundle owns and disposes it. It is not a scene appearance asset. |

These are synchronous, deterministic pixel buffers. Current production scene factories do not fetch or decode raster texture files.

PR J's procedural world environment is a renderer-owned lighting/reflection
resource, not a scene material asset: its source is generated in memory, and
each renderer converts the shared Architecture Rise recipe into its own PMREM
target. It does not create a new surface-material ownership path.

## Current scene-asset lifecycle

[`sceneAssetRegistry`](../src/render/assets/sceneAssetRegistry.ts) declares a synchronous factory contract: `create(request)` returns a `THREE.Group`. Instance-owned registrations require a paired disposer; module-shared registrations explicitly declare that lifetime and cannot install a per-instance disposer. The current registry has 15 scene-asset slots: 13 instance-owned and two module-shared (Focus Fundamentals and View Camera Anatomy), as recorded in the [scene asset lifecycle audit](SCENE_ASSET_RESOURCE_LIFECYCLE.md).

[`SceneAssetSubjects`](../src/render/SceneAssetSubjects.tsx) constructs an interactive subject in a layout effect and disposes that exact instance on cleanup. The RTT adapter in [`sceneSubjectRegistry`](../src/render/sceneSubjectRegistry.tsx) calls the same registered factory and its paired disposer. Observer and RTT therefore share the implementation and recipe, while receiving distinct `Object3D` graphs. For instance-owned Architecture Rise and Interior Corner, each factory call creates its own Three.js geometry, material, and texture objects. Module-shared assets are the explicit exception and retain their borrowed resources for module/application lifetime.

That contract currently has no pending, failed, or cancelled external-asset state. Changing a registered factory to await external files would require a loading/readiness/error contract. Starting loads inside the current synchronous factory would instead return a partially populated subject and would need explicit fallback and readiness behavior.

## Current external-loader footprint

A source search on this base found no production use of `THREE.TextureLoader`, `GLTFLoader`, `KTX2Loader`, `DRACOLoader`, `MeshoptDecoder`, `useTexture`, `useGLTF`, `useLoader`, or `loadAsync` in `src/` or `package.json`. Current scene textures are produced as `DataTexture`s. The app does have static marketing/UI raster images rendered through browser image elements and [`publicAssetUrl`](../src/utils/publicAssetUrl.ts); that is not a Three.js scene-texture pipeline and does not define scene asset loading, caching, or GPU disposal. React `lazy()` / `Suspense` in `src/app/pages.tsx` is route code splitting, not image or model loading. There is no production scene-asset raster/model readiness contract.

## Option A — Continue procedural materials

**Decision: CONTINUE.** Keep the current procedural generators as the default for teaching patterns, surface variation, and macro-specific roughness.

Benefits demonstrated by the pilots:

- generation is deterministic and synchronous, without file fetch, decode, or loader failure state;
- output bytes and material properties can be tested directly;
- repeats and map settings are explicit numeric recipe values;
- scene factories remain the owners of scene-specific recipes;
- the same registered factory produces the Observer and RTT subject variants;
- existing subject disposal already releases the generated maps.

Limits also visible in the evidence:

- custom pattern code can become increasingly elaborate;
- periodic patterns can leave repeat streaks, especially for wood;
- procedural patterns are less direct for irregular, high-frequency photographic variation;
- every albedo/roughness/normal map still creates a texture resource. Procedural generation avoids files and async loading; it does not make GPU resources free.

These limits are acceptable for the two completed pilots. The documented wood streaks are a concrete future material-source revisit candidate only if they remain objectionable at normal viewing scale.

## Option B — Local raster surface maps

**Decision: DEFER.** Do not add PNG, JPEG, WebP, or KTX2 maps in this decision PR. A targeted local-raster pilot is the next asset experiment only if a specific surface remains materially deficient under a stable illumination baseline and the trigger below is met.

Raster maps could provide less periodic, authored variation and may be easier than extending custom procedural code for a particular surface. That potential has not been compared against the accepted procedures. It would not, by itself, resolve the Architecture Rise glazing's missing environment reflections.

An implementation would need to decide and verify:

- which map channels are authored, with albedo decoded as sRGB and roughness/normal data treated as non-color maps;
- image dimensions, alpha, UV/repeat behavior, filtering, and mip generation;
- file provenance and licensing, build/repository growth, and deployed URL construction under the app's configured base path (including GitHub Pages). The existing `publicAssetUrl` helper covers current DOM images but not Three.js texture readiness or ownership;
- fetch/decode/upload failure, cancellation on scene navigation, fallback behavior, and when the scene counts as capture-ready;
- whether Observer and RTT load independently or share a decoded source, and how any shared JavaScript/GPU resource lifetime avoids premature disposal;
- deterministic tests and visual comparisons at standard Observer framing and the relevant Ground Glass mode.

PNG/JPEG/WebP source-file size is not GPU-memory evidence: ordinary raster images can decode to uncompressed pixel storage. JPEG/WebP may reduce repository or transfer bytes but are not automatically suitable for data maps. KTX2 may offer GPU-compressed payloads, but adds transcoding, format selection, and loader/worker concerns. No format choice is justified by current measurements.

## Option C — GLTF / GLB model assets

**Decision: DEFER.** No current pilot demonstrates a geometry bottleneck that requires imported models. Revisit separately from raster maps only when a named subject needs geometric richness that a reasonable Three.js factory cannot provide and that difference survives normal Observer framing and the relevant Ground Glass output.

Models can carry richer authored geometry, UVs, and material assignments. They also introduce more than image loading: asynchronous fetch/parse, optional external buffers and images, loading/error/cancellation states, payload and parse-time measurements, decoder dependencies if compressed, asset versioning, and more complex resource disposal. Imported hierarchies may contain transforms, cameras, lights, animation, hidden nodes, or material conventions that need deliberate validation. Observer and RTT need separate usable object graphs; blindly sharing one loaded scene graph is not sufficient because an `Object3D` can have only one parent, while sharing its geometry/material resources needs explicit lifetime ownership.

Most importantly, imported geometry must remain presentation-only. Canonical scene geometry and scene definitions remain the authority for focus targets, camera position, movement calibration, composition targets, task thresholds, image-circle behavior, and optical geometry. Model pivots, dimensions, or mesh names must never become inputs to those contracts. Dream Loop write scope would need explicit authorization for the model files, and review must show that imported transforms preserve the existing semantic placement.

## Visual-gap classification

| Demonstrated observation | Primary class | What the evidence supports |
| --- | --- | --- |
| Architecture Rise glazing remains dark at normal scale after PR I daylight, PR J environment, and the two bounded PR K material candidates. | **MATERIAL RESPONSE — negligible** | Standard dielectric and opaque physical-material candidates did not produce meaningful Observer or Processed Ground Glass improvement. Keep the production baseline; the missing local scene reflections are potentially a reflection-technique question. This does not establish a raster-texture or imported-model need. |
| Some Interior Corner floor grain shows repeated straight streaks. | **MATERIAL SOURCE** | The procedural wood pattern has directional periodic structure; this is the clearest demonstrated source-specific limitation. Its effect was accepted at normal scale, and no raster control was tested. |
| Wall/console grain and chair weave stay subtle. | **TEACHING PRESENTATION** | The final recipes deliberately keep those contrasts restrained. No evidence says stronger or photographic detail would improve the teaching view. |
| Extra tiny geometry did not automatically improve visual quality. | **GEOMETRY** (not a current bottleneck) | More polygons are not a proxy for a better image. The pilots do not establish that existing geometry needs replacement by a model. |
| A required appearance detail cannot be rendered correctly by the current WebGL/material path. | **RENDERER** — none demonstrated | Both pilots rendered their accepted map/material changes on the current path and through Ground Glass. No renderer limitation requiring another backend or asset format was shown. |
| A concrete source-vs-lighting cause for every remaining subjective difference. | **UNKNOWN** | No controlled raster/model comparison or post-illumination comparison exists. Do not label uncertainty as a missing asset pipeline. |

An asset investment must improve the ordinary Observer composition, not only a magnified crop. For photographic surfaces, the improvement should also remain useful in Processed Ground Glass at its normal presentation. Raw and Upright remain physical regression views; they are not separate appearance targets. The accepted pilots show that current procedural material changes can survive into those consumers, but do not justify optimizing beyond what the teaching view can use.

## Resource and lifecycle implications

The scene-capacity benchmark identity-deduplicates subject geometry, materials, and textures and reports renderer geometry/texture counts from `renderer.info.memory`. These are counts, not byte-accurate VRAM, decoded-memory, transfer, or upload measurements. It records Ground Glass and frame-cadence timings, but CPU-submit fallback values are not GPU execution times. A future external-asset pilot would need like-for-like readiness and timing evidence; texture count alone cannot select PNG vs WebP vs KTX2.

The PR J environment experiment added no subject geometry, materials, or
textures. On the same Chromium/SwiftShader session, the existing Ground Glass
renderer resource report changed from 3 geometries / 23 textures to 3 / 24.
Instrumented live WebGL texture objects changed from 19 to 20 for Observer and
27 to 28 for Ground Glass, consistent with one retained PMREM texture per
renderer after temporary source and PMREM scratch resources were disposed.
The Ground Glass CPU-submit p95 remained 0.8 ms; active frame-cadence p95
changed from about 398 to 446 ms on this software renderer and is not GPU
execution time. The 128×64 RGBA8 source contains 32 KiB of pixel data. Three.js
r186 produces a 336×128 RGBA HalfFloat CubeUV target (about 336 KiB of nominal
texel storage); this arithmetic is not a driver/VRAM allocation measurement.

For scale, one current 128×128 RGBA8 procedural map has a base pixel payload of:

```text
128 × 128 × 4 channels × 1 byte = 65,536 bytes = 64 KiB
```

A complete 128→1 mip pyramid has 21,845 texels, or `21,845 × 4 = 87,380` bytes (about 85.3 KiB) per map. Three maps are about 256 KiB of nominal GPU texel storage for one material instance. Four Architecture Rise procedural material recipes therefore represent about 1 MiB at that theoretical mip size per subject instance. This is arithmetic from the `Uint8Array`/RGBA8 source and mip configuration, not a measurement of browser/driver allocation; it excludes alignment, internal copies, and implementation overhead. Observer and RTT instance-owned factories construct their own map objects, so simultaneous consumers can multiply resource counts.

External compressed file size does not remove those ownership questions. A decoded raster may occupy similar uncompressed texture memory, while KTX2 might alter that with device-specific transcoding. A GLTF may bundle images but does not avoid decoding, upload, or cleanup. Measure before drawing a cost conclusion.

## Decision

| Asset category | Decision | Current rule |
| --- | --- | --- |
| Procedural `DataTexture` materials | **CONTINUE** | Default for current appearance work. Preserve specialization among TeachingTextures, ProceduralSurfaceMaterials, and MacroSubjectMaterials. Do not introduce a global cache or profile registry without a current consumer. |
| Local raster surface textures | **DEFER** | No general pipeline now. Revisit as a single-scene, appearance-only pilot after a named material-source blocker remains visible at normal scale under the agreed lighting baseline and improves the relevant Ground Glass view. |
| GLTF/GLB models | **DEFER** | No model pipeline now. Revisit only when a named geometry-richness blocker is demonstrated and imported geometry can remain subordinate to canonical teaching/simulation contracts. |

If a named material-source blocker later justifies raster maps, a single local-raster pilot is the lower-risk asset experiment before establishing a general raster pipeline. Model assets have a separate gate: a proven geometry-richness blocker can justify a model pilot independently and does not require a raster pilot first. Neither decision commits the project to the other asset class.

## Revisit triggers

Reopen the local-raster decision only when all of these are true:

1. A named surface has a visible procedural-source artifact or missing irregularity after reasonable pattern/repeat/roughness/normal adjustments.
2. The limitation is still visible at normal Observer framing with the relevant lighting held stable; it is not a zoom-only preference or an environment-lighting issue.
3. A representative local raster comparison materially improves the appearance and remains useful in the corresponding Processed Ground Glass view.
4. The pilot records file provenance/license, base-path deployment, deterministic loaded/readiness evidence, texture/resource counts, and paired disposal across Observer and RTT.

Reopen the GLTF/GLB decision only when all of these are true:

1. A named scene element has a demonstrated geometry-richness gap that simpler factory geometry cannot reasonably address.
2. The improvement survives ordinary Observer framing and relevant Ground Glass rendering.
3. The imported model is only a presentation asset; camera, focus, task, movement, composition, image-circle, and optical authority stay in canonical modules.
4. Asset identity, axes, units, pivots, bounds, and allowed render features have executable validation, and load readiness, decode/parse cost, texture/material/geometry counts, failure handling, cancellation, and disposal are measured.

Neither external-asset trigger is met. PR I tested direct directional illumination, PR J tested a procedural environment/reflection contribution, and PR K tested two bounded built-in PBR material responses. Architecture Rise's façade modeling improved, but the glazing remained dark and no candidate produced useful normal-scale reflection response. PR L's [local-reflection decision](LOCAL_REFLECTION_TECHNIQUE_DECISION.md) defers technique selection until Ground Glass can represent reflected virtual depth separately from direct glazing radiance. This remains a renderer/optical representation question, not an external material-source need. Any future scene reflection must enter scene radiance before optical/DOF processing so it remains represented in Ground Glass.

## Explicit non-decisions

This decision does not select a raster format, add an asset manifest/registry, add a loader/cache, choose a hosting/CDN strategy, or authorize Dream Loop to create external asset files. It does not merge teaching, procedural surface, and macro material responsibilities. It does not change geometry, materials, lighting, renderer behavior, Ground Glass, optics, task semantics, or scene publication.

## Current status / follow-up boundary

PR H established the world-source foundation, PR I tested fixed directional
daylight, and PR J tested a renderer-owned procedural sky/ground environment.
The environment added broad material integration but did not make glazing
usefully reflective at normal scale. PR K then tested a restrained dielectric
standard material and an opaque physical material under that fixed environment;
neither produced a meaningful normal-scale response, so production retains the
baseline scalar recipe. The result does not validate natural shadows or create a
visible sky.

Procedural surface materials remain the default. Local raster maps and
GLTF/GLB assets stay deferred until their separate documented evidence triggers
are met. The remaining local-reflection gap may justify a future reflection-
technique decision if it becomes a teaching need; no reflection technique is
selected here. Any such radiance must enter scene radiance before Ground Glass
optical/DOF processing.
