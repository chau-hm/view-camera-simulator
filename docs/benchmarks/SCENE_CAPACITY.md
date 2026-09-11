# Scene capacity benchmark

Run the opt-in matrix with:

```bash
npm run benchmark:scene-capacity
```

The command runs `scene-capacity-benchmark.spec.ts` serially at 1440×1000 with device pixel ratio 1 and writes ignored artifacts to:

```text
test-results/scene-capacity-benchmark.json
test-results/scene-capacity-benchmark.md
```

The collector measures the registered photographic subject separately in the main viewport and Ground Glass RTT. Geometry, material, and texture counts are identity-deduplicated. Triangle counts come from `BufferGeometry`; instanced meshes report base geometry triangles and effective triangles after multiplying by instance count.

Ground Glass timing reuses the existing opt-in profiler (`?dofProfiling=1`). GPU-query values are GPU milliseconds. CPU fallback values are CPU-submit milliseconds and are not directly comparable to GPU timings. Frame cadence is observed active R3F frame cadence, not pure GPU execution time. Renderer geometry and texture values come from `renderer.info.memory`; they are resource counts, not VRAM byte measurements.

The benchmark includes processed Ground Glass for the current scene matrix, Raw RTT comparisons for a bounded subset, and Focus Loupe checks for two richer scenes. It has no hardware-specific performance threshold; the output is evidence for deciding whether a later optimization PR is justified.
