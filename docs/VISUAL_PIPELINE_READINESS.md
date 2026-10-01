# Visual pipeline readiness

This decision record describes the rendering boundary at the post-SA7 baseline
`232de05d40579d4a64592e5481bc40edf3b95fd7`. It prepares the renderer and
evidence path for scene-quality work; it does not change scene appearance.

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
- The renderer can support environment lighting, but the application has no
  shared environment-lighting setup today.
- There is no application-wide post-processing stack today.
- `TeachingLighting` provides the shared teaching-light and shadow policy; its
  current setup is described below.

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

## Lighting ownership

[`TeachingLighting.tsx`](../src/render/TeachingLighting.tsx) owns the current
shared hemisphere/key rig, directional shadow configuration, and shadow
participation rules. Scene registrations currently provide placement intent
where the viewport and RTT need different targets. Preserve that implementation
and behavior in this phase. Future lighting work should attach a lighting
intent/profile at the scene or presentation boundary and resolve it through a
shared lighting implementation; scene assets should not grow independent full
lighting rigs. Existing scene-local lights remain explicit subject content,
not substitutes for the shared teaching rig.

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

## Next PR boundary

The next work may proceed to **Dream Loop Integration Guardrails / pilot
preparation** on the current WebGL renderer. A WebGPU migration is not a
prerequisite for the near-term material, texture, lighting, shadow, and
non-semantic asset work described here.
