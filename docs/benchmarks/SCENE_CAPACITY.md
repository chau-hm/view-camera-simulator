# Scene capacity benchmark

Run the opt-in matrix with:

```bash
npm run benchmark:scene-capacity
```

The command runs `scene-capacity-benchmark.spec.ts` serially at 1440×1000 with device pixel ratio 1. It owns a dedicated Vite dev server on port 4174 with `reuseExistingServer: false`, so it does not reuse the ordinary E2E server on port 4173. It writes ignored artifacts to:

```text
test-results/scene-capacity-benchmark.json
test-results/scene-capacity-benchmark.md
```

The collector measures the registered photographic subject separately in the main viewport and Ground Glass RTT. Geometry, material, and texture counts are identity-deduplicated. Triangle counts come from `BufferGeometry`; instanced meshes report base geometry triangles and effective triangles after multiplying by instance count.

Each capacity snapshot also records a Ground Glass-scoped report. Its `renderer` section contains runtime observations from the mounted Ground Glass Three.js renderer: backend identity, the existing Ground Glass framebuffer probe result, shadow-map state/type, tone mapping, exposure, and output color space. Render-target status is not inferred from browser API availability. Its `groundGlassPipeline` section contains the current RTT and processed-DOF implementation facts, including their WebGL coupling. The report does not inspect the observer Canvas or infer application-wide backend, material, environment-lighting, or post-processing state. The separate first-canvas WebGL vendor/renderer fields are environment diagnostics, not renderer capability declarations. This is evidence for later visual-enrichment comparisons, not a feature gate.

Ground Glass timing reuses the existing opt-in profiler (`?dofProfiling=1`). Each record waits for the requested scene/mode to be contentful, captures a post-state progress marker, and waits for at least one complete authoritative 60-sample rolling window before recording. Processed, Focus Loupe, and Raw RTT records use fresh navigation/state setup, so startup samples and prior-mode windows are not reused. First-canvas WebGL vendor/renderer metadata is read only after the first simulator canvas mounts, using that existing canvas; it is environment qualification data and does not identify the Ground Glass renderer surface. GPU-query values are GPU milliseconds. CPU fallback values are CPU-submit milliseconds and are not directly comparable to GPU timings. Frame cadence is observed active R3F frame cadence, not pure GPU execution time. Renderer geometry and texture values come from `renderer.info.memory`; they are resource counts, not VRAM byte measurements.

The benchmark includes processed Ground Glass for the current scene matrix, Raw RTT comparisons for a bounded subset, and Focus Loupe checks for two richer scenes. It has no hardware-specific performance threshold; the output is evidence for deciding whether a later optimization PR is justified.

For scene-quality work, compare the same scene and Ground Glass mode before and after enrichment at the same viewport, DPR, render-quality profile, browser, and machine/workload. Review scene graph counts, effective triangles, renderer resource counts, frame cadence, and like-for-like Ground Glass pass timings alongside the runtime Ground Glass renderer evidence and pipeline implementation facts. Current observer/application architecture declarations are documented separately in [Visual pipeline readiness](../VISUAL_PIPELINE_READINESS.md); they are not measured by this benchmark report. Do not compare CPU-submit timing values directly with GPU-query timings.

## Hardware-backed run

Run the local hardware path with:

```bash
npm run benchmark:scene-capacity:hardware
```

This builds the production bundle, starts a dedicated preview server on port 4175, and runs the existing benchmark in headed stable Google Chrome (`channel: "chrome"`) without reusing another server. A visible desktop session and Chrome hardware acceleration are required; AC power and a stable display/workload setup are recommended. The runner does not disable GPU acceleration or force a platform-specific ANGLE backend. Production bundles omit the development-only render-sanity readback, so this runner uses the renderer-owned camera/readiness and populated-profiler attributes as its non-invasive contentfulness boundary while keeping the same fresh 60-sample protocol.

The output records two separate qualifications. A known software renderer such as SwiftShader, llvmpipe, or Software Rasterizer fails the hardware command. A non-software renderer is a hardware-renderer candidate. `gpu-query` with `gpu-ms` is the preferred full GPU-timing qualification. If the renderer is hardware-backed but profiling falls back to `cpu-submit-ms`, the run is reported as hardware-rendered with GPU timing unavailable; those values remain CPU-submit observations and cannot identify GPU pass cost. Unknown renderer strings are not rejected through an allow-list.

The normal `npm run benchmark:scene-capacity` command remains software-compatible, uses its isolated port 4174 dev server, and does not require hardware. A useful local hardware baseline is normally several consecutive runs on the same commit, Chrome version, machine, and display configuration. This benchmark is intentionally local/manual and is not part of ordinary CI.
