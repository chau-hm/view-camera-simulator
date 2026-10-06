# Visual pipeline readiness

This decision record describes the rendering boundary at the post-SA7 baseline
`232de05d40579d4a64592e5481bc40edf3b95fd7`. It prepares the renderer and
evidence path for scene-quality work. PR J later added one opt-in procedural
environment contribution to Architecture Rise; it did not change canonical
simulation or teaching state.

## Runtime Ground Glass renderer evidence

The development-only report is included in the existing
`?sceneCapacityProfiling=1` snapshot and scene-capacity benchmark output. It is
resolved from the mounted renderer supplied by `GroundGlassRTT`, never from
`detectAvailableWebGLBackend()`. Its `renderer` object describes only that
Ground Glass render surface:

| Evidence | Source / boundary |
| --- | --- |
| Backend identity | `resolveRendererBackend` checks the actual mounted Three.js renderer marker. A WebGPU marker alone is rejected. |
| Color render target | The existing Ground Glass candidate probe binds the target, checks framebuffer completeness, restores the previous target, and fails closed. Missing or mismatched probe evidence is `unverified`. |
| Shadow-map state and type | Read from this renderer's `shadowMap` settings. This says nothing about another Canvas. |
| Tone mapping, exposure, output color space | Read from this renderer's live Three.js settings. |

The report's `groundGlassPipeline` object records implementation facts rather
than renderer observations: the RTT uses a WebGL render-target bundle and the
processed path uses custom GLSL multipass DOF. Neither object describes the
observer viewport or declares application-wide capabilities. Reporting creates
no additional renderer, target, framebuffer, or context.

## Current application architecture baseline

These declarations come from the current repository structure, not the mounted
Ground Glass runtime report:

- The observer `SceneRenderer` Canvas and Ground Glass Canvas currently use the
  WebGL rendering path. `RendererBackend` recognizes only WebGL today.
- There is no application-wide WebGPU integration. Three.js containing a
  `WebGPURenderer` does not make it an active application backend.
- Current scene asset factories use `MeshStandardMaterial` on lit surfaces;
  `MeshPhysicalMaterial` remains a possible asset-level choice.
- Architecture Rise opts into one procedural sky/ground environment recipe.
  Observer and Ground Glass create separate renderer-owned PMREM resources;
  the application still has no global environment or visible sky system.
- There is no application-wide post-processing stack today.
- `presentationLightingContract.ts` defines the single active teaching-light
  recipe used by both the Observer React rig and the Ground Glass imperative rig.
- `resolveScenePresentationLighting()` resolves registered placement intent for
  the requested surface; it does not select or create scene-owned lights.

The two Canvas surfaces may migrate independently in a future architecture. A
Ground Glass report must not be used to infer the observer renderer or an
application-wide backend state. Revisit this source-derived baseline when the
renderer architecture changes; do not serialize it as runtime capability data.

## Ownership boundary for visual changes

```text
Canonical simulation / lesson geometry
                │ authoritative
                ▼
       Scene presentation data
                │
                ▼
        Scene asset registry
                │
                ▼
       Visual asset implementation
         geometry · materials · textures · visual metadata
                │
                ▼
         Rendering pipeline
         lighting · shadows · environment · tone mapping · post-processing
```

Canonical optics and lesson geometry remain authoritative. Presentation data
may supply renderer-neutral placement and visual intent. The registered asset
factory owns its visual implementation and follows the existing stable key,
factory, and explicit instance-owned or module-shared resource lifetime in
[`sceneAssetRegistry.ts`](../src/render/assets/sceneAssetRegistry.ts). The
interactive viewport and Ground Glass RTT continue to consume the same
registered implementation. Do not add a parallel asset loader for visual
refinement.

Near-term work can proceed on the current WebGL path: non-semantic mesh detail,
bevels and thickness, material replacement, standard or physical materials,
textures, normal and roughness maps, color variation, shadow participation,
background/environment presentation, and tone mapping or an exposure
multiplier. Decorative props are also safe when they remain render-only.

Keep those changes out of canonical teaching targets, subject-reference and
camera/lens/film geometry, focus targets or focus physics, movement signs and
limits, image-circle physics, task thresholds, scene identity, Ground Glass
orientation, and route/catalog/task publication. Visual-quality tools may
propose asset appearance; they do not gain authority over simulation state.

## Scene illumination ownership

Scene illumination is compositional. Physical/in-world sources and
presentation/teaching assist can be present at the same time:

```text
Scene illumination
├── physical / in-world
│   ├── natural (current: Architecture Rise DirectionalLight)
│   └── artificial / practical (current: Interior Corner PointLight)
└── presentation / teaching assist (current: shared fill + key rig)
```

The current world-source resolver has two scene-owned definitions:
`architecture-rise-daylight` is one natural DirectionalLight aimed at the
canonical Architecture Rise facade anchor, and `interior-corner-local-light`
is one artificial PointLight positioned from Interior Corner presentation
geometry. Observer and Ground Glass each instantiate their own renderer light
objects from the same renderer-neutral source list. The registered subjects
contain neither source. The shared teaching HemisphereLight and DirectionalLight
remain presentation assist, separate from represented-world illumination.
The optional procedural environment is a separate contract field, not a light
source: Architecture Rise alone opts in; Interior Corner and other production
scenes remain environment-free. Source categories are compositional, but no
production scene currently mixes natural and artificial sources; that mixture
is covered only by a synthetic rig test.

[`presentationLightingContract.ts`](../src/render/presentationLightingContract.ts)
owns the one active `teaching-default` presentation recipe. Its profile is
separate from placement; `PRESENTATION_SHADOW_MAP_TYPE` is a renderer-wide
policy constant, not per-scene illumination state.
[`presentationLighting.ts`](../src/render/presentationLighting.ts) resolves
renderer-neutral scene placement intent for either the Observer or Ground
Glass surface. Both the React rig and imperative Ground Glass rig consume the
same profile; imperative updates reapply the full profile as well as
placement.

Scene-subject registrations currently carry teaching-assist placement intent,
but they are not the permanent authority for all world illumination. Camera
Movements derives its key target from its presentation model for both
surfaces. Mirror Shift keeps separate real Observer and reflected Ground
Glass key placement. The hemisphere fill has no position, so unused per-scene
fill offsets are not part of the contract. `TeachingLighting.tsx` applies the
shared teaching shadow-participation rules, while Mirror Shift retains its
explicit Ground Glass shadow override.

Interior Corner's warm PointLight is resolved as artificial world illumination
from renderer-neutral presentation geometry. The Observer `WorldIllumination`
consumer and imperative Ground Glass world-illumination rig both use that same
source list; the registered subject contains no PointLight and its capacity
object count may therefore drop. The source has no exposure authority and is
not part of the presentation lighting profile. Scene assets should not grow
independent complete presentation rigs.

Future physical exposure remains downstream:

```text
physical / in-world illumination
→ scene radiance
→ optical image
→ future metering
→ aperture / shutter / ISO / film response
```

Presentation-assist participation in metering or exposure must be an explicit
future decision; this architecture does not implement an exposure model.
Natural and artificial physical sources may add together. The Architecture
Rise directional source is fixed in scene coordinates, uses the canonical
facade as its target, and does not cast shadows; natural-source shadowing has
not been validated. PR J adds a deterministic 128×64 sRGB procedural source,
converted by Three.js r186 `PMREMGenerator` to a linear-sRGB CubeUV environment
for `scene.environment`; it does not assign `scene.background` or render a
visible sky. The same recipe creates one independent PMREM target per renderer,
and the adapters dispose their source and generator after conversion, then
restore prior scene environment state and dispose the owned target at cleanup.
The environment is an uncalibrated low-frequency reflection/illumination
context: it makes no photometric claim and is not a substitute for the unchanged
`teaching-default` presentation profile. The existing Ground Glass
`resolveGroundGlassNaturalIlluminationRenderState` describes optical relative
illumination/falloff, not scene-world natural light.

PR K tested the glass response under the fixed PR I daylight and PR J environment.
Candidate A used an opaque dielectric `MeshStandardMaterial` with color
`#182d37`, roughness `0.1`, and metalness `0`. Because A remained insufficient,
Candidate B used an opaque `MeshPhysicalMaterial` with the same color, roughness
`0.07`, metalness `0`, IOR `1.5`, and transmission `0`. Neither produced meaningful
glazing response at normal Observer scale: front glazing remained similarly flat
and the front/side orientation difference did not become useful. Processed Ground
Glass showed no visible benefit. Raw and Upright retained their orientation
behavior, teaching overlays remained legible, and Interior Corner control captures
remained byte-identical. Classification: **MATERIAL RESPONSE — negligible**. Both
candidates preserved subject and renderer resource counts; the same-session
Candidate B profile reported 0.8/0.9 ms Ground Glass CPU-submit p50/p95 versus
baseline 0.7/0.8 ms, with GPU timing unavailable. Frame cadence came from a
CPU-fallback backend and is not evidence of GPU cost. This result does not
establish a texture-file requirement.

PR L then audited local reflections as a separate rendering capability. PR M
defines and synthetically validates a renderer-local apparent-world-position
contribution contract through the existing Ground Glass physical footprint
kernel and aperture gather. The ordinary RTT remains on its existing single
color/depth path; no real reflection source or candidate technique was
implemented, and candidate selection remains deferred. See the
[local-reflection decision](LOCAL_REFLECTION_TECHNIQUE_DECISION.md) for the
CPU/browser proof, software-renderer limitations, candidate analysis, and
follow-up boundary. The test fixture does not enter public navigation or the
production bundle.

## Ground Glass migration seam

Ground Glass is the renderer migration boundary that needs the most work before
a backend change:

| Coupling | Current owner / assumption |
| --- | --- |
| Render targets and lifetime | [`groundGlassRttResources.ts`](../src/render/groundGlassRttResources.ts) creates a `WebGLRenderTarget` bundle and disposes only the targets and fallback texture it owns. |
| Framebuffer capability | [`rendererCapabilities.ts`](../src/render/backend/rendererCapabilities.ts) uses WebGL framebuffer status checks and restores the previously bound target. The half-float CoC target can fall back to encoded-byte storage; failure of both candidates stops the path. |
| Renderer API and sizing | [`GroundGlassRTT.tsx`](../src/render/GroundGlassRTT.tsx) calls `getPixelRatio`, `getRenderTarget`, `setRenderTarget`, `render`, and diagnostic `readRenderTargetPixels`; sizing depends on the mounted renderer's pixel ratio and canvas drawing buffer. |
| Shader passes and sampling | Custom `ShaderMaterial` GLSL renders the source scene, CoC classification, near/far aperture gathers, and composite/blit stages. Passes sample textures with the current normalized UV and filtering assumptions. |
| Raw / Upright | The RTT source is upright. Raw applies a physical 180-degree display transform; Upright Assist removes it. Inspection pan maps the displayed UV back to a pre-composite source crop. These transforms must not be applied again to canonical film coordinates. |
| Film window | The off-axis camera and inspection crop use a contained physical film window. CSS sizing and preview orientation do not redefine its film-space coordinates. |
| Scene subjects | RTT and viewport use the same registered asset factories. Registered subject cleanup remains paired with instance-owned resources and preserves module-shared resources. |

A WebGPU migration investigation must replace or adapt the target/framebuffer
probe, pass execution and shader implementation, texture sampling/orientation
contracts, pixel-ratio and canvas assumptions, and owned resource lifecycle as
one tested Ground Glass path. It must keep the current Raw/Upright and physical
film-window semantics. This record does not start that rewrite.

## Baseline evidence for scene enrichment

Reuse the opt-in benchmark:

```bash
npm run benchmark:scene-capacity
```

It writes ignored JSON and Markdown artifacts under
`test-results/scene-capacity-benchmark.*`. Keep the viewport, DPR, browser,
render-quality profile, scene, preview mode, and machine/workload consistent
for before/after runs. Record the commit and renderer environment. Compare:

- viewport and RTT object, mesh, instanced-mesh, light, geometry, material,
  and texture counts;
- base and effective triangle counts, including instanced triangles;
- renderer geometry and texture resource counts (not VRAM bytes);
- Ground Glass scene-render and total/DOF timing, with the same GPU-query or
  CPU-submit timing backend;
- active frame-cadence p50/p95, treating it as observed R3F cadence rather than
  pure GPU time;
- the mounted Ground Glass backend, probed color-target status, shadow path,
  tone mapping/exposure/output color space, and Ground Glass RTT/DOF
  implementation facts.

The structured report separates live `renderer` observations from
`groundGlassPipeline` implementation facts. The application architecture
baseline above is documentation only and is not inferred from either object.

The benchmark already collects fresh timing windows for processed, Raw RTT,
and selected Focus Loupe modes. CPU-submit timings are not directly comparable
to GPU timings. Use the report as same-session decision evidence; this boundary
adds no arbitrary FPS or scene-complexity pass/fail threshold.

## Current rendering boundary

The current WebGL renderer supports the validated procedural-material,
world-light, and procedural environment contribution. PR I established a
fixed natural DirectionalLight path for Architecture Rise; PR J added a
low-frequency reflection/illumination environment without a visible sky. The
pilots did not validate natural world shadows, calibrated environment values,
physical exposure or metering, or WebGPU-specific rendering. PR K found that the
bounded standard and physical material candidates did not materially resolve the
dark glazing at normal scale; its best candidate is classified **MATERIAL
RESPONSE — negligible**.

Select further work from observed visual and teaching limitations rather than
following a mandatory renderer-migration sequence. WebGPU remains conditional on
a demonstrated backend-specific requirement.
