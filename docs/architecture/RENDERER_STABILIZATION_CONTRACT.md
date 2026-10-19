# Renderer Stabilization Contract

This document records the current production rendering boundary and the bounded hardening in the Renderer Architecture Stabilization PR. It is an implementation contract for later renderer work, not a proposal for a new rendering architecture.

## Existing implemented boundaries

### Observer renderer

`SceneViewport` resolves a requested Observer backend against scene eligibility and development-only pilot policy; `SceneRenderer` mounts the selected R3F Canvas using the backend factory in `observerBackend.ts`. Requests default to WebGL. WebGPU pilots are opt-in and limited to the scenes registered in `observerSceneCompatibility.ts`; capability detection alone does not authorize a pilot. `observerRendererInitialization.ts` initializes the selected renderer and disposes a partial renderer if initialization fails. `observerVisualPipelineCapabilities.ts` reports the mounted family and API from the actual R3F `gl` instance, not from the request. Output policy remains a separate, development-gated decision in `observerOutputPolicy.ts`. Applicable WebGPU failures retain the existing one-shot WebGL fallback.

The production Observer path remains WebGL. The pilot request, eligibility, mounted identity, output policy, fallback and generation-scoped lifecycle diagnostics are separate decisions and must remain separate. Anatomy material-aware transparency/compositing investigations are outside this contract.

### Ground Glass renderer

Ground Glass owns an independent WebGL R3F renderer and imperative frame executor in `GroundGlassRTT.tsx`. `groundGlassPassGraph.ts` names semantic stages; it documents intended stages but is not a scheduler or runtime command graph. The normal order is:

1. full-resolution scene color and depth;
2. full-resolution physical CoC and footprint classification;
3. far gather;
4. near gather;
5. full-resolution composite;
6. display blit.

The owned WebGL target bundle retains full-resolution scene color/depth, the CoC target, far/near gathers, composite output and fixed diagnostic targets. CoC storage keeps its current half-float or encoded-byte fallback, and render quality continues to control target sizing and gather limits. Raw Debug renders the source scene, bypasses CoC classification and both gather passes, and composites from the source color. Orientation, film-window display, Focus Loupe, Image Circle coverage and vignetting continue through the existing composite/display path. `GroundGlassRenderSurface.tsx` exposes the runtime diagnostics produced by `GroundGlassRTT.tsx`. Ground Glass is WebGL-specific; its targets, shaders, materials and execution are not backend-neutral.

### Physical inputs and rendered outputs

`deriveOpticsState()` and the canonical domain layer remain the physical authority. Ground Glass adapts canonical camera, scene, focus, film-window, physical CoC, blur-footprint, lens-coverage and image-circle values into target sizes, uniforms and pixels. Shader execution, texture storage, gather and display transforms are renderer responsibilities. No renderer pass may recalculate optical geometry, calibration, movement conventions or teaching thresholds. Heuristic sharpness and depth-of-field output remains illustrative.

## Resource ownership and lifetime

| Resource | Owner and lifetime |
| --- | --- |
| Ground Glass color/depth, CoC, far/near gather, composite and fixed diagnostic targets | One `GroundGlassRTT` resource bundle; construction rolls back partial allocations, resize updates owned targets in place, and bundle disposal is idempotent. |
| Ground Glass post-processing materials, quads, scenes, cameras and local environment rigs | The mounted `GroundGlassRTT` instance; dispose with that instance. |
| Registered scene-subject resources | The registered subject factory/disposer. Instance-owned assets are released with their subject; explicitly module-shared assets are borrowed and remain alive when a consumer unmounts. |
| Observer renderer and R3F-managed scene resources | Observer Canvas / R3F lifecycle. Do not dispose these through Ground Glass cleanup. |

The bundle and registered subject contracts are the ownership boundary. A consumer may detach borrowed objects from its local graph but must not dispose module-shared geometry, materials or textures. Do not add reference counting or another global resource manager without evidence that these contracts fail.

## Frame state and failure contract

A Ground Glass frame temporarily changes the active render target while executing its source, classification, gather, composite and optional diagnostic readback work. The frame callback does not change viewport, scissor, scissor-test or `autoClear`. It intentionally resets `renderer.info` counters for its own frame metrics. With `rttDiagnostics=1`, a separate effect temporarily disables `renderer.info.autoReset` and restores its prior value when that effect cleans up.

The prior render target is saved before frame work. On every exit, the guard attempts to restore that target and set the existing sky clear color with alpha 1. Clear color is intentionally persistent renderer configuration, not a value to restore to the incoming frame state. Profiling scopes close on pass failure, and an unsuccessful frame invalidates its profile and current-frame diagnostics rather than leaving stale output presented as a successful frame. If frame work fails, its original error remains observable and is rethrown after cleanup; a cleanup error is surfaced when there is no earlier frame error. Target-bundle cleanup remains safe after a frame failure.

## Boundaries strengthened in this PR

This PR adds a narrow WebGL-specific execution guard around the existing imperative executor. It attempts to restore the prior render target and intentional clear-color end state on every exit, invalidates profiling on failure, clears stale frame evidence, records the failed semantic pass when known and rethrows the original error. Regression evidence invokes the actual captured R3F frame callback and injects a renderer failure after target switching. Existing target-bundle construction rollback, in-place resize, idempotent disposal and borrowed-subject behavior are retained; they are changed only if a concrete defect is demonstrated.

## Deferred migration boundaries

Future Ground Glass backend work must first preserve the current physical-input contract, semantic pass behavior, Raw Debug bypass, output transforms, diagnostics and resource lifetime. WebGPU would require explicit alternate target formats, shader/pass implementations, capability and fallback policy, mounted-runtime evidence and lifecycle coverage. This PR does not add those abstractions or migrate Ground Glass. The semantic pass list remains descriptive while runtime execution stays imperative. A general render graph, backend adapter hierarchy, renderer-wide material conversion and large `SceneRenderer` or `GroundGlassRTT` decomposition are deferred until a concrete migration need justifies them.

## Related authority

- [Visual Pipeline Readiness](../VISUAL_PIPELINE_READINESS.md) — implementation and pilot history.
- [Architecture Diagnosis](../ARCHITECTURE_DIAGNOSIS.md) — current architecture and known investigations.
- [DOF Focus Physics Convergence](../DOF_FOCUS_PHYSICS_CONVERGENCE.md) — canonical optical and physical-DOF dataflow.
- [Scene Asset Resource Lifecycle](../SCENE_ASSET_RESOURCE_LIFECYCLE.md) — registered subject ownership and cleanup.
- `src/render/groundGlassPassGraph.ts` — current semantic pass names and order.
