# Ground Glass WebGPU Integration Architecture Decision

**Status:** Proposed architecture for review; no implementation approved by this document

**Date:** 2026-10-24

**Base:** Phase L merge `a9114a791e8c6790221c6d6732e0b2872020211a`

## 1. Context

Production Ground Glass is an independent WebGL render-to-texture pipeline. It owns its own React Three Fiber canvas, WebGL render targets, GLSL post-processing materials, scene-camera setup, frame execution, diagnostics, and display output. Observer has a separate canvas and backend policy. Native WebGPU has been exercised in isolated research fixtures through Phases C–L, but no production Ground Glass WebGPU backend exists.

The research establishes bounded feasibility for raw render-and-display, physical CoC/footprint storage and classification, aperture gathering, and selected far-reconstruction states. It does not establish full production parity across public scenes, material families, Image Circle presentation, adapters, or interaction states. See the [research evidence index](#16-evidence-and-limits) and [integration blueprint](GROUND_GLASS_WEBGPU_INTEGRATION_BLUEPRINT.md).

## 2. Current architecture

`GroundGlassRenderer` combines canonical optics and view intent, then renders a shared Ground Glass stage, physical overlays, and `GroundGlassRenderSurface`. RTT-registered scenes mount `GroundGlassRTT`, which owns an independent WebGL/R3F canvas and executes the semantic stages listed by `groundGlassPassGraph.ts`. That file declares pass names and order; it is not an executable graph or scheduler. The Ground Glass surface is separate from the Observer `SceneRenderer` canvas.

`GroundGlassRTT` consumes the existing canonical optics state and derives renderer inputs. `GroundGlassDofRenderState` and `GroundGlassPhysicalRenderState` already express useful semantic values, but neither is a complete cross-backend renderer API. The current target bundle is concretely typed to `THREE.WebGLRenderTarget`.

## 3. Decision drivers

- Preserve `deriveOpticsState()` and existing physical domain calculations as the sole optical authority.
- Keep production WebGL independently functional and the default throughout incremental work.
- Make backend selection, actual runtime identity, failure, cleanup, and fallback independently observable.
- Isolate WebGPU resources and shader technology from existing WebGL resources.
- Make each research-derived feature gate specific to its actual evidence.
- Support reversible, reviewable integration increments without building a speculative renderer framework.

## 4. Alternatives

| Option | Benefits | Costs and risks | Decision |
|---|---|---|---|
| **A. Separate WebGPU Ground Glass renderer behind a small application host** | Limits regression exposure to current WebGL; explicit resource ownership; backend-specific shaders and targets; clean rollback; testable actual runtime identity | Some host and lifecycle glue is shared; semantic inputs and scene realization need explicit adapters | **Choose** |
| **B. Backend-neutral renderer/pass framework** | Could centralize lifecycle and pass contracts after multiple mature backends exist | Prematurely abstracts incompatible APIs and resource lifetimes; large refactor before production WebGPU exists; obscures which contracts are genuinely shared | Reject for now |
| **C. Add backend branches inside `GroundGlassRTT`** | Reuses the current application component and props | Mixes WebGL assumptions with WebGPU pipeline/resource behavior; complicates exception paths and tests; increases risk to the validated renderer | Reject |

## 5. Chosen architecture

Introduce a small `GroundGlassRenderHost` at the application boundary only when M2 is implemented. It receives a frozen semantic frame request, a Ground Glass-specific backend decision, and a channel identity. It mounts one concrete renderer implementation for that channel. The existing `GroundGlassRTT` remains the WebGL adapter. A distinct WebGPU implementation owns its own renderer, canvas/context, pipeline resources, scene realization, and lifecycle.

`GroundGlassRenderer` remains responsible for shared stage layout and overlays. `GroundGlassStage` continues to own pan/zoom interaction and inspection-window state. The host must keep these presentation responsibilities independent from backend-specific target and shader code.

The first shared contract should be an immutable **accepted frame request snapshot**, not a renderer object, persistent mutable state bag, command interface, or public abstraction. Its `requestId` identifies the complete frozen state used by a frame, including canonical optics, scene identity, inspection window, quality intent, Raw/Upright and Raw Debug intent, and channel. A scene ID by itself is not a request version: focus, aperture, crop, pan, or any other frame-relevant update produces a new accepted request identity. Any scalar input not contained in existing domain values must be justified by an existing consumer. The request must not contain WebGL or WebGPU handles.

Renderer-generation publication authority and accepted-request authority are separate. A generation may publish only while its generation token is current and the exact `(requestId, channelId, sceneId)` remains the host's latest accepted request for a still-mounted channel. A pilot session identity additionally scopes opt-in and fallback retry policy; it stays stable across renderer-generation replacement and incidental component remount. Diagnostics and asynchronous operation results carry both identities so a new renderer cannot make an old request current again.

Backend-specific camera matrices, scene realization, textures, targets, shaders/materials, command submission, readback, and backend caches stay inside the concrete renderer. A common diagnostic envelope may report lifecycle and frame facts, with typed backend-specific details rather than an untyped generic record.

## 6. Optical authority and parity

`deriveOpticsState()` and the existing canonical domain functions remain authoritative for lens/film geometry, movement conventions, focus plane, CoC, blur footprint, coverage, and physical coordinates. WebGPU adapters may encode those values for GPU storage but may not recalculate optical geometry or define independent teaching thresholds.

Parity must be established by explicit state fingerprints, physical values, reconstructed-position checks, and asymmetric landmarks. Similar screenshots alone are insufficient. The coordinate authority is [`GROUND_GLASS_COORDINATE_CONTRACT.md`](GROUND_GLASS_COORDINATE_CONTRACT.md); it documents current WebGL mappings. A WebGPU implementation must independently prove its framebuffer, texture, readback, overlay, and crop orientation against the same physical reference.

## 7. Pass and shader strategy

Keep `groundGlassPassGraph.ts` descriptive. Its semantic sequence helps name contracts and diagnostics but does not justify a runtime scheduler. Add a small scheduler only if an implemented backend has a concrete dependency, cancellation, or inspection requirement that cannot be expressed with direct ordered calls.

Use Three.js Node/TSL materials where the tested WebGPU rendering API and material operations fit. Use explicit WebGPU-specific code only where a necessary operation cannot be expressed clearly through the supported Three.js API. Do not expect production GLSL `ShaderMaterial` to run unchanged on `WebGPURenderer`; every port needs separate semantic/numerical parity evidence. A hybrid is acceptable when scene rendering uses Three.js WebGPU and an explicitly owned set of TSL or WebGPU passes performs post-processing.

## 8. Ownership and lifecycle

The application owns canonical state, the frozen frame request, channel identities, policy, and the selected host generation. Each renderer generation owns exactly one backend renderer/canvas lifecycle and all instance-local targets, pipelines/materials, intermediate textures, readback buffers, and backend caches it creates. Registered scene-subject factories continue to own subject-specific allocations through their matching disposer. Shared module assets are borrowed and are not disposed by a renderer generation.

Resize is an operation on the active generation; it may resize/reuse its owned allocations according to that backend's contract. Initialization failure rolls back partially created owned resources. Runtime failure invalidates the current generation, prevents stale results from being published, drains or safely invalidates accepted asynchronous work, and disposes owned resources before a replacement generation starts. SPA unmount follows the same retirement/disposal contract. The Observer renderer is never transferred into or disposed by Ground Glass.

## 9. Backend policy

Production Ground Glass remains WebGL by default. A future WebGPU request must be explicitly authorized for development/test and eligible for the exact scene and requested feature set. Unknown or unevaluated scenes fail closed. `navigator.gpu` is capability preflight evidence only, not evidence of adapter initialization or active execution.

Diagnostics must distinguish requested backend, policy result, attempted renderer, renderer family, execution API, internal renderer fallback, application fallback, active generation, and completed frame. WebGPURenderer using its WebGL2 compatibility path is not native WebGPU execution. A WebGL fallback is an application decision and must be reported separately.

## 10. Scene compatibility

Use a Ground Glass-specific, feature-scoped compatibility record. Each claim is tied to scene ID, feature set, source revision, renderer/runtime, test evidence, and status such as `not-evaluated`, `research-only`, or `verified`. Eligibility is derived from all required feature gates; no unqualified `webgpuSupported: true` property is recommended. Observer scene eligibility does not establish Ground Glass RTT compatibility.

Macro Depth of Field, Interior Corner, Architecture Rise, Understanding Camera Movements, a mirror/reflection scene, and a scene with representative complex materials/lighting are useful validation categories. Prior fixture use does not make a public scene production compatible. Each requires the production scene hooks, relevant display/DOF features, and lifecycle to be exercised under the candidate backend.

## 11. Failure and fallback decision

Initialization fallback and runtime fallback are separate, but both consume the WebGPU retry budget for the current logical pilot session when an authorized WebGPU attempt fails. Record each attempt failure by `(channelId, sceneId, pilotSessionId)`, and keep the exhausted retry latch on `(channelId, pilotSessionId)` across scene changes. Renderer-generation replacement, focus/aperture/crop/pan/frame updates, resize, incidental remount, and scene-ID change do not reset it. After safe retirement, the channel stays on sticky WebGL for that session. A different channel has an independent retry budget.

For an explicitly authorized development pilot, failure may trigger WebGL fallback only **after** the WebGPU generation is retired, all accepted operations are settled or invalidated, and owned cleanup has completed. The host then verifies that the channel is still mounted, rereads its latest accepted immutable request, and reevaluates scene/channel/session fallback authorization. It creates a fresh WebGL generation for that current request. The generation ID does not authorize publishing stale work: immediately before publication the host checks the active generation, request ID, channel ID, scene ID, mounted state, and successful completion of all required passes/display work. A request that changes during WebGL initialization/render is discarded as stale; the latest accepted request is rendered before output is published. A failed frame is never a successful new output. If retirement, cleanup, or authorization is uncertain, fail closed. If WebGL initialization or rendering fails, report unavailable and do not recurse into another fallback.

Sticky fallback is reset only by an explicit retry or a deliberate new pilot session, after fresh development authorization, exact-scene eligibility, capability preflight, and safe prior cleanup are checked. An explicit retry that fails consumes the new session's attempt and returns to sticky WebGL if safe fallback succeeds; it does not auto-retry. A cleanup failure remains unavailable. Global device-loss diagnostics may inform all channels, but a failure in one channel does not silently disable or reset another channel's policy.

Every replacement generation receives a new token. Late completion from a retired generation cannot publish output, diagnostics as current, or a success event into the replacement generation.

## 12. Coordinate and display contract

Preserve physical film UV, RTT source/crop UV, sampler UV, display UV, Raw/Upright transforms, Focus Loupe crop/pan, off-axis projection, grid, and target overlays as distinct mappings. Use the current coordinate contract for WebGL behavior; do not copy its sampler flips into WebGPU. WebGPU raster/readback orientation must be established globally from independent asymmetric points, not chosen per target by minimum error. Image Circle, vignetting, natural illumination, film clipping, and display brightness are distinct consumers and each needs parity evidence.

## 13. B1 readiness

M5 selects **B1: Phase H center-compatible far reconstruction** as the integration candidate. Its reduced-resolution gather-center mapping and source-provenance contract are preserved; incompatible or unusable selected-center results use the declared full-resolution source-color fallback, while the existing near gather remains unchanged. The exact fallback and validity rules must be taken from the Phase H contract and independently reproduced in a CPU B1 oracle. C1 is the distinct Phase I 3×3 surface-aware neighbor-search experiment and CPU C1 oracle; it is not substituted for B1, and its oracle is not evidence that a B1 implementation is correct. B1 and C1 are not interchangeable.

B1 is appropriate only for a controlled research/development pilot with feature and scene quality gates. It is not a production default. Phase K showed gains in tested reference agreement but also source-fallback and blur-preservation concerns. Phase L validated one selected 8× centered Macro crop/state: 47,058 interior capped pixels, 46 qualified interior high-contrast depth-edge pairs, approximately 12.336 px maximum uncapped radius, B1/B0 equality in the chosen interior ROI, no selected-ROI fallback, and no strong cap overrun. That result does not establish broad quality. The Phase H/I matched Full ×32/×64 comparison found B1 closer than B0 and C1 for the measured fixture; that image-quality result is distinct from B1 algorithm correctness and does not make C1 semantics an acceptable integration substitute.

Before integration readiness, an independent CPU B1 oracle must reproduce the selected gather-center ID and source provenance; source/center surface compatibility and validity; signed-CoC/far eligibility; exact source-color fallback and its diagnostics; far gather selection; image-edge behavior; unchanged near RGB/alpha; and relevant composite semantics. The oracle must not call GPU TSL or the C1 neighbor-search oracle. A staged evidence hierarchy is required: R1 canonical optical inputs establish physical CoC, axes/orientation, position/validity and film-window scale; R2 the independent CPU B1 oracle establishes GPU contract conformance; R3 native matched Full ×32/×64 renderer references establish bounded image quality (including RGB error, interior far/edge ROIs, spread, fallback halos, contamination and suppression); R4 production WebGL comparison establishes application-visible and teaching parity. None substitutes for another, and a finite-sample reference is not photographic truth.

Before broader pilot claims, test strong CoC overrun, interior near/far sign boundaries, fallback where meaningful expected blur exists, sharp halos/blur suppression, production materials/transparency, Image Circle and illumination, multiple quality profiles, and additional adapters/browsers. B1-specific negative controls include wrong gather-center identity, sign inversion, incorrect source fallback, foreground leakage, an unjustified sharp fallback where blur is expected, Near alpha mutation, strong radius-cap overrun, and mismatched reference provenance. Tolerances must be supported by the measured fixture and separately reported by evidence class; no universal threshold is implied.

## 14. Consequences

**Positive:** WebGL rollback remains local; backend identities and lifetimes are explicit; research adapters can evolve without making WebGL code conditional; the host exposes a narrow review boundary; production remains releasable during M1–M8.

**Costs:** A small amount of host and lifecycle glue is duplicated; every scene/backend/feature combination needs evidence; shader semantics need independent ports and tests; side-by-side comparisons consume separate renderer and target memory.

**Do not abstract yet:** a universal render graph, cross-backend texture sharing, generic command encoder interface, universal material conversion layer, cross-backend resource registry, global GPU scheduler, generalized scene adapter framework, or a second copy of optics calculations.

## 15. Open questions

- Which exact scene/material combinations form the first M3 pilot allowlist after its Raw RTT integration tests?
- Which TSL operations can cover each production pass without backend-specific shader code, and where is explicit WebGPU code justified?
- What physical storage formats and limits meet downstream near-zero CoC sensitivity across supported adapters?
- What quality, memory, and latency budgets are acceptable? Establish baselines before setting numeric targets.
- What explicit development action starts a new pilot session and resets its sticky WebGL retry latch?

These questions block only the stages that depend on them; they do not block the WebGL-only M1/M2 increments.

## 16. Evidence and limits

| Evidence | Classification | Boundary |
|---|---|---|
| Existing Ground Glass RTT passes, target bundle, frame guard, display stage | Implemented fact | Current production WebGL only |
| Observer backend policy and runtime classification | Implemented fact | Observer only; not reusable as Ground Glass policy |
| Phase C native raw RTT/render-display | Native-tested research fact | Isolated fixture, Architecture Rise path and tested adapter |
| Phases D–E storage/classification | Native-tested research fact | Bounded formats, test vectors, depth/precision constraints |
| Phases F–L gather/reconstruction | Native-tested research fact | Selected scenes, states, ROIs, and quality contracts |
| Canonical optics and current coordinate mapping | Documented contract | Existing domain and WebGL mapping; no WebGPU parity implied |
| Separate adapter behind a small host is safest | Design inference | Recommended architecture, not implemented |
| Development-only scene/feature gates and bounded fallback | Proposed future behavior | To be implemented and tested in future PRs |
| Cross-adapter performance/material parity | Unresolved | No broad supported-hardware evidence |

For traceable source references, see the [integration blueprint evidence matrix](GROUND_GLASS_WEBGPU_INTEGRATION_BLUEPRINT.md#17-evidence-traceability). M1–M8 remain research/development-only with no public WebGPU activation. M9 produces a go/no-go recommendation only; any production activation requires explicit authorization and a separate production-promotion PR followed by its own validation, independent review, and controlled rollout.
