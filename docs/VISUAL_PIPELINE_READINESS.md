# Visual pipeline readiness

This decision record describes the rendering boundary at the post-SA7 baseline
`232de05d40579d4a64592e5481bc40edf3b95fd7`. It prepares the renderer and
evidence path for scene-quality work; it does not change scene appearance.

## Current capability boundary

The application runs Three.js r186 through React Three Fiber. The production
backend contract remains `"webgl"`. Browser WebGL availability is only a
precondition for mounting the current renderer; it does not identify the
renderer instance or prove that an application feature works. The opt-in
capability report is built from the mounted renderer and, for color render
targets, the existing Ground Glass framebuffer probe.

| Area | Current status | Evidence / boundary |
| --- | --- | --- |
| Active renderer | WebGL | `resolveRendererBackend` accepts the actual WebGL renderer marker. A WebGPU marker alone is rejected. |
| Color render target | Available when the selected Ground Glass target probe succeeds | `resolveRendererCapabilities` binds the candidate, checks framebuffer completeness, restores the previous target, and fails closed. An unprobed target is reported as unverified. |
| Shadow maps | Active | Both R3F canvases enable shadows. `TeachingLighting` owns the PCF directional shadow settings and scene caster/receiver policy. |
| Lit / PBR materials | Available on the current renderer; current scene assets use `MeshStandardMaterial` | Existing materials and lighting already exercise the lit path. `MeshPhysicalMaterial` remains a possible scene-asset choice. |
| Environment lighting | Available, not active | The current renderer can support this presentation path; there is no shared environment-lighting setup today. |
| Tone mapping / exposure | Available; current values are reported from the mounted renderer | Canvas configuration does not override tone mapping or output color space. The runtime report records the actual tone-mapping mode, exposure, and output color space. |
| Global post-processing | Inactive | There is no application-wide post-processing stack. |
| Ground Glass RTT / DOF | RTT active; custom DOF available on the processed path, both WebGL-coupled | Ground Glass owns a custom GLSL multipass path over its WebGL render-target bundle. |
| WebGPU / TSL application backend | Inactive | Three.js containing a WebGPU renderer is not application support. `RendererBackend` remains WebGL-only. |

The development-only report is included in the existing
`?sceneCapacityProfiling=1` snapshot and scene-capacity benchmark output. It is
created from a renderer instance, never from `detectAvailableWebGLBackend()`.
The color-target status carries the existing probe result; reporting creates no
additional renderer, target, framebuffer, or context.

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
- the active application renderer, probed color-target status, shadow path,
  tone mapping/output color space, and inactive WebGPU status.

The benchmark already collects fresh timing windows for processed, Raw RTT,
and selected Focus Loupe modes. CPU-submit timings are not directly comparable
to GPU timings. Use the report as same-session decision evidence; this boundary
adds no arbitrary FPS or scene-complexity pass/fail threshold.

## Next PR boundary

The next work may proceed to **Dream Loop Integration Guardrails / pilot
preparation** on the current WebGL renderer. A WebGPU migration is not a
prerequisite for the near-term material, texture, lighting, shadow, and
non-semantic asset work described here.
