# Environment cost and resource lifecycle

Use measured CPU factory time, Observer submission and physical Ground Glass pass cost independently. Compare changes at fixed camera, render quality, device, DPR, variant and measured readiness. The current environments show that triangle count alone cannot predict frame or submission cost.

## Historical comparisons

These measurements are workload context. The observations came from different revisions, camera states and profiles.

| Merged scene | Supporting buildings | Environment triangles | Total effective triangles | Observer draws | Physical draws |
| --- | ---: | ---: | ---: | ---: | ---: |
| Architecture Rise | 11 | 51,178 | 57,876 | 1,236 | 1,075 |
| Oblique Architecture | 9 | 27,572 | 43,904 | 519 | 439 |
| Architecture Foreground | 8 | 99,198 | 126,716 | 502 | 254 |

Sources are the local #367 metrics at façade focus, #368 metrics at calibrated focus and #369 validated reset metrics. PRs supply the published identities. [#367](https://github.com/chau-hm/view-camera-simulator/pull/367) · [#368](https://github.com/chau-hm/view-camera-simulator/pull/368) · [#369](https://github.com/chau-hm/view-camera-simulator/pull/369)

## Current matched sample

Baseline `35212892d5a359213f68f984bc68ad47c4520886`. Four new headless Chromium 149.0.7827.55 tabs on macOS arm64, Apple M4 Pro ANGLE Metal, WebGL2, Three r187. The browser viewport is 1440 × 1000 at device DPR 1. All settled samples use the public Standard option, default scene optics and processed Ground Glass with no loupe. Scoped browser instrumentation read the registered subject at its actual perspective draw. The canvas is 514 × 411 CSS pixels, internal physical render targets are 655 × 524, and the respective Observer/RTT drawing buffers are 771 × 615 and 771 × 616. Every supported Free Mode variant is pinned to seed `284719`, schema 1. Oblique remains unseeded. #350 added material variation for Architecture Foreground and Table Tilt after the original archives. [Variant contract](../../render-quality/FREE_MODE_SEEDED_MATERIALS_WAVE1.md)

The named environment root defines context. Hero/canonical counts include broad teaching ground and fixture support outside that root. Table Tilt context is the studio-room group. Material and texture counts count distinct identities within each group. A material referenced by both groups contributes to each group and once to the total.

| Current scene | Hero and canonical meshes / triangles | Context meshes / triangles | Total meshes / triangles | Total materials / textures | Context materials / textures |
| --- | --- | --- | --- | --- | --- |
| Rise | 471 / 6,698 | 142 / 51,178 | 613 / 57,876 | 42 / 27 | 25 / 9 |
| Oblique | 40 / 16,332 | 215 / 27,572 | 255 / 43,904 | 20 / 5 | 14 / 4 |
| Foreground | 64 / 27,518 | 116 / 99,198 | 180 / 126,716 | 27 / 14 | 16 / 8 |
| Table Tilt | 125 / 6,462 | 24 / 950 | 149 / 7,412 | 36 / 29 | 8 / 7 |

Counts match between consumers for each sampled scene. An Observer renderer also draws reference cameras, handles and teaching overlays. Ground Glass source-pass draw counts include physical-subject shadows and exclude full-screen post-pass draws. Both use renderer counters read immediately after the matching Three.js perspective call.

| Scene | Observer / physical draws, median | Shadow draws within those totals | Observer / physical CPU submission p50 (ms) | Physical scene GPU p50 (ms) | Profiled Ground Glass GPU p50 (ms) | Cadence p50 / p95 (ms) |
| --- | --- | --- | --- | --- | --- | --- |
| Rise | 1,236 / 1,075 | 524 / 523 | 2.2 / 1.4 | 0.73 | 7.48 | 16.6 / 44.9 |
| Oblique | 519 / 438 | 253 / 253 | 1.1 / 0.7 | 0.58 | 8.40 | 16.6 / 44.9 |
| Foreground | 502 / 254 | 172 / 168 | 1.9 / 0.5 | 0.68 | 6.21 | 16.7 / 49.3 |
| Table Tilt | 222 / 201 | 57 / 57 | 0.9 / 0.5 | 0.41 | 12.22 | 16.7 / 39.8 |

CPU samples time 24 actual calls per consumer from just before `WebGLRenderer.render` through its return. Shadow draw counts are before/after deltas around the nested shadow renderer. The application profiler completed 30–31 times per pass with no disjoint events in these snapshots. The Ground Glass aggregate measures profiled renderer passes, with scene GPU measured separately. Cadence spans renderer frames and includes browser scheduling. The snapshot provides no independent Observer GPU time. The single device, short windows, fixed route order, a dev server and enabled diagnostics limit transfer to other hardware. [Capacity counters](../../../src/render/sceneCapacityProfiling.ts#L163) · [App timing aggregation](../../../src/render/groundGlassProfiling.ts) · [Shadow participation](../../../src/render/TeachingLighting.tsx#L63)

Initial new-tab navigation to both renderer readiness signals took 1.117–1.414 s at the default High quality before the Standard measurement. This includes module and UI startup, renderer initialization and Playwright wait polling. A warmed dev server and first-route dependency compilation make it unsuitable as a cold-start budget. In a separate real SPA transition, Foreground to directory took 42 ms, directory to Oblique ready took 563 ms, and two back navigations took 472 ms to recover ready Foreground. Same-document identity and the original explicit seed were verified. These are individual event samples.

A Vite SSR probe timed six fresh registered factories per scene after two warmups. The interval covers the factory call before renderer upload. Current p50 creation was 51.8 ms Rise, 10.9 ms Oblique, 65.3 ms Foreground and 20.4 ms Table Tilt. Unique live DataTexture array bytes were about 5.06 MB, 0.72 MB, 1.11 MB and 2.07 MB, respectively. These are referenced CPU arrays, without mip/upload/driver overhead. The preceding two-owner check observed zero shared geometry, material or texture identities for all four factories. See `performance/registered-cost.json` and `performance/current-runtime.json` for per-op values and backend evidence.

## Attribution and decisions

- **Submission pressure and shadows.** Rise produced the largest Observer and physical-source submission counts, even though Foreground produced more total triangles. The shadow pass accounted for 524 of 1,236 Rise Observer draws and 523 of 1,075 Rise physical draws. A useful optimization experiment would separate visible scene, shadow caster and overlay contributions at the same pose before changing participation. The established lighting and occlusion semantics constrain any subsequent change. [Shadow participant policy](../../../src/render/TeachingLighting.tsx#L56)
- **Geometry batching and foliage.** The #369 retained unbatched Cycle 1 ran at 854 Observer and 493 physical draws. The final per-building batch measured 502/254 at reset with more triangles and other layout changes, so the paired observations establish plausibility rather than an isolated batching treatment. The live courtyard's eight leaf meshes account for 45,844 of 99,198 context triangles. This is a measured geometry contribution. A standalone foliage frame-time bottleneck is unverified. The factory allocates leaf vertices and calculates normals before building owned materials and drawing, so compare factory phases and GPU visibility before introducing representation changes. [Courtyard batching](../../../src/render/architecture-foreground/environment/CourtyardBuildings.ts#L199) · [Foliage construction](../../../src/render/architecture-foreground/environment/CourtyardGardens.ts#L29)
- **Physical rendering dominates different work.** In each sampled GPU window, near gather and composite medians exceed the physical scene pass median. Table Tilt had the smallest scene-level draw and triangle counts while reporting the largest Ground Glass aggregate in this short sample. Separate CoC/gather/composite and workload characteristics before attributing physical preview time to environment geometry. [Physical post passes](../../../src/render/GroundGlassRTT.tsx#L1777)
- **Rebuilds and texture duplication.** Observer creates per request in `useLayoutEffect`, and RTT creates an independent owner through its profile. Texture counts within the subject show distinct identities rather than identical bytes. The sampled SSR costs establish a factory CPU interval without assigning it to surface generation, triangulation or GC. Measure phase cost and byte-level duplicate roles before proposing immutable CPU data reuse or adding any shared GPU owner. [Observer owner](../../../src/render/SceneAssetSubjects.tsx#L48) · [RTT owner](../../../src/render/groundGlassSceneProfiles.ts#L69) · [Material map generation](../../../src/render/ProceduralSurfaceMaterials.ts)
- **Diagnostic overhead.** The app uses a dev-only, state-keyed pair of 32 × 32 GPU readbacks. They can stall CPU submission when the measurement key changes. The profiler allocates and polls nested timer queries, and scene capacity traverses the registered assets around mounts. A separate pinned Foreground run took six identical public focus increments with diagnostics enabled and disabled. The enabled run issued two 32 × 32 reads per completed frame whose combined synchronous call time had a median of 7.05 ms. The disabled run issued zero. This local call interval includes driver synchronization. It gives no total gesture latency or steady-state frame-rate estimate. See `performance/readback-cost.json`. [Readbacks](../../../src/render/GroundGlassRTT.tsx#L1957) · [Profiling query lifecycle](../../../src/render/groundGlassProfiling.ts)

## Ownership and timeout evidence

Current same-document navigation away from the pinned Foreground released all 220 observed geometry, material and texture resources once in each consumer. The two consumers had disjoint identities, and the return mounted fresh resources of the same counts. This observes disposer events and registered part replacement. Whole-application retained memory and eventual GPU driver reclamation require separate measurements. Future renderer-neutral batching helpers should return instance-owned final resources and release owned temporary pieces even on errors. Keep lighting, render targets and renderer-generation allocation under their current owners. [Registered subject disposer](../../../src/render/TeachingMaterials.ts#L68) · [Asset ownership and variation](../../../src/render/SceneAssetSubjects.tsx#L48) · [RTT disposal entry](../../../src/render/sceneSubjectRegistry.tsx#L514)

The #369 first hosted run timed out at 5.301 s in one shared unit case that mounts eleven registered scenes. Exact-head retry passed at 4.385 s. The same case was approximately 1.26 s at the local baseline and 1.50 s at local final head. This is evidence of workload sensitivity in a CPU construction/registration test. It did not measure GPU or frame time. Keep its assertions and investigate per-scene test timing or isolate cases if shared-fixture contention recurs. A blanket timeout increase would conceal where cost changed. [Registry test](../../../src/tests/unit/sceneSubjectRegistry.test.tsx#L571) · [#369 workflow](https://github.com/chau-hm/view-camera-simulator/actions/runs/45634725819)

## Future budgets

Establish representative devices and repeat cold-route, warm-gesture and same-document transition samples. Pair each measured acceptance band with an experienced task such as orbit latency or actively changing focus. Track p50/p95 frame intervals and pass durations, factory and rebuild time, draw calls, resource counts and rendered visibility alongside visual benefit. Aim first at measured construction, submission and post-pass hotspots. Evidence of a cost regression should identify the responsible pass or lifecycle step and the fidelity/teaching trade-off. A larger environment is acceptable when its measured workload and representative interactions meet those criteria.
