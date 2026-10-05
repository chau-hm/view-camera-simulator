# Stage 2I development-only runtime integration report

**Verdict: READY_STAGE_2J_DEV_INTEGRATION_VALIDATED**

The verified Stage 2H candidate loads asynchronously and becomes available to the
existing synchronous scene-asset factory only after parsing completes. Source,
instance, and image-backing ownership return to zero across one-, two-, and
repeated-instance lifecycles. The fixture is absent from production routing and
normal product navigation.

## Base, head, and imported authority

- Repository: `chau-hm/view-camera-simulator`
- Worktree: `/Users/homan/repo/view-camera-simulator-fringe-2i`
- Feature branch: `feature/fringe-club-stage-2i-integration`
- PR base: `main` at latest fetched `origin/main` `fe4a81e4c56ce7969a5982a936dad4b0a696c99f` (the worktree initially started at `b3c418cad7cd474c60fd244db0f987e799a943bf`)
- PR head: `feature/fringe-club-stage-2i-integration`; the current commit SHA is recorded in the PR metadata and final handoff.
- Stage 2H package version: `stage-2h.1`, verdict `READY_STAGE_2I_INTEGRATION_CANDIDATE` / `OPTIMIZED_PACKAGE_SELECTED`.
- Preferred asset SHA-256: `1f15e04fa6161e327d6f4f89f9b011f3b8f41bcf305e7ee2e3a1a127fef93b8e` (verified).
- Encoded size: 3,379,292 bytes / 3.223 MiB; 32 meshes and primitives; 20,203 asset triangles; 15 materials, eight active semantic families, and seven embedded PNG textures.
- Coordinate authority: metres, +Y up, identity root. The GLB is loaded at scale 1; this independent fixture performs no millimetre conversion and does not read or modify canonical camera state.
- Asset URL: `publicAssetUrl("assets/generated/fringe-club/stage-2h/preferred-runtime-candidate.glb")`. It resolves to `/view-camera-simulator/assets/generated/fringe-club/stage-2h/preferred-runtime-candidate.glb` with the production base path and `/assets/generated/...` when Vite is configured at `/`.

## Integration and ownership

The development route is `/__dev/fringe-club` relative to the Vite base path,
inside `if (import.meta.env.DEV)`. It has no product navigation entry. In a
production build the route and fixture page are absent; the dormant typed
registry slot is not bound to any public scene or scene subject. The GLB is
copied into build assets, which is expected for a file under `public/`.

The fixture owns a `FringeClubSourceAssetLoader`. It fetches with an
`AbortController`, then calls Three.js `GLTFLoader.parseAsync`. Once ready, the
fixture passes the explicit owner lease into the typed registry request. The
registered `create(request)` stays synchronous. No empty group is returned for
later mutation and no module-global parsed asset is used.

- Scene asset key: `fringe-club-runtime-subject`.
- Implementation ID: `threejs-fringe-club-runtime`.
- R3F mounts through the shared `RegisteredSceneAsset` adapter; unmount invokes
  the registered disposer.
- One source owns 32 immutable geometries, 15 material templates, seven texture
  wrappers, and seven image backings. Each instance owns its root and 15 cloned
  materials; geometry and textures are shared within the source.
- The source owner and each instance hold explicit leases. Releasing A disposes
  A's cloned materials and leaves B valid. Releasing the final lease disposes
  source geometries/templates/textures and closes the image backings. Renderer,
  transmission targets, PMREM/LTC, global lighting, and application resources
  stay renderer-owned.
- Requested anisotropy is 4×, clamped to the renderer maximum. The tested
  renderer supports 16×, so 4× was applied once at source initialization.
- Presentation transform: scale 1, zero rotation, model-centering translation,
  plus a stable A/B offset of `±0.56 × model-width` on X. The preview camera
  follows the currently visible instance or the pair's midpoint. Toggling A
  does not recreate B; the browser test confirms B's live Three.js root UUID is
  unchanged. These are fixture-only presentation choices.

Fetch cancellation aborts the request. If parsing has already started and cannot
be interrupted, a generation check makes the result stale; the completed source
is immediately released and cannot mount. The delayed-request browser test
navigates away before the response is released. A loader unit test separately
supersedes a generation during parsing and proves the late result is disposed.
The existing Stage 2H handling of arbitrary malformed external-image packages
remains outside this validated self-contained GLB contract.

## Runtime measurements

Captured in a Playwright development run using Chromium `149.0.7827.55`, Three
`0.186.0`, WebGL 2, viewport 1280×720 at DPR 1. `WEBGL_debug_renderer_info`
reported ANGLE / Vulkan / SwiftShader software rendering; no physical GPU device
was exposed. These values are one local browser-automation observation, not a
hardware performance claim.

The baseline is the development fixture's R3F renderer with Fringe unmounted.
Renderer draw values below include all fixture/application passes. They are not
the GLB's source triangle count.

| State | `renderer.info` geometries | textures | calls | submitted triangles | Fringe meshes | Asset source leases | Instance leases |
|---|---:|---:|---:|---:|---:|---:|---:|
| Fixture baseline | 0 | 2 | 0 | 0 | 0 | 0 | 0 |
| One instance A | 32 | 11 | 76 | 52,038 | 32 | 1 | 1 |
| Instances A + B | 32 | 11 | 130 | 85,996 | 64 | 1 | 2 |
| B after A removal | 32 | 11 | 76 | 52,038 | 32 | 1 | 1 |
| After source release, first cycle | 0 | 4 | 0 | 0 | 0 | 0 | 0 |
| After source release, repeated cycle | 0 | 4 | 0 | 0 | 0 | 0 | 0 |

The single source reports 32 geometries, 15 source material templates, seven
source textures, seven image backings, and 15 cloned materials per instance.
Two instances still use only one source, 32 geometries, and seven source
textures; their 30 cloned materials are independent. All asset-owned counters,
including image backings and instance materials, return to zero on release.

The application texture count rises from 2 to 11 on first render, then returns
to 4 and remains at 4 after the repeated cycle. This is a stable two-texture
increase over the initial fixture baseline after the transmission material has
been rendered. The public renderer counters do not identify those remaining
textures; their persistence and stability are consistent with renderer-owned
transmission infrastructure. The asset disposer deliberately does not dispose
them. No monotonically growing asset-owned resource count was observed.

The loader measured 79.4 ms for the first source load and 42.8 ms for the
repeated load in this run, from request start through parsed source readiness.
These are local software-renderer measurements and are not an FPS, GPU upload,
or target-device performance promise. `renderer.info` exposes counts, not exact
GPU bytes. Stage 2H's separate estimates remain 77,594,624 decoded texture CPU
bytes (74.00 MiB) and 103,459,500 RGBA8 plus full-mip GPU bytes (98.67 MiB); the
Stage 2I browser did not directly measure GPU memory.

## Lifecycle and regression results

- One instance loaded and rendered all 32 meshes; the development audit observed
  one source/owner/instance lease and seven image backings.
- Two instances rendered together. Removing A left B's 32 meshes, geometry,
  textures, material lease, and source alive; removing the source then released
  all asset-owned resources exactly once.
- The SPA test went from the fixture to `/scenes` through its in-app link, checked
  that the document token stayed unchanged, returned with browser history, then
  loaded and released again. Geometry, draw calls, and triangles returned to
  zero; warmed renderer textures stayed stable at four.
- Delayed-fetch navigation aborted the in-flight request. No stale model mounted
  and no page or console lifecycle error remained.
- A normal `architecture-rise` simulator route rendered its 3D subject and one
  Ground Glass RTT renderer before and after the fixture workflow. It issued no
  Fringe request. The built preview under `/view-camera-simulator/` redirected
  the dev URL to `/view-camera-simulator/not-found`; a normal scene and Ground
  Glass still worked, with zero Fringe requests and no page errors.
- With Vite development also configured at `/view-camera-simulator/`, Chromium
  loaded the fixture and fetched the same prefixed asset URL successfully
  (HTTP 200). React StrictMode started two request generations: its superseded
  first request ended with `net::ERR_ABORTED`, and the current request returned
  the GLB. The source then released to zero with no page errors.
- No screenshot-based appearance review was performed. The fixture uses the
  application's presentation lighting/shadow policy and R3F path, not the
  Stage 2H standalone harness or Cycles. Stage 2F material authority, the
  Stage 2G UV/bake authority, and renderer-dependent parity expectations remain
  unchanged.

## Validation and scope

Validation completed:

- `npm test`: 231 files / 2,179 tests passed.
- `npm run lint`, `npm run typecheck`, and `npm run check:css`: passed.
- `npm run build` with `VITE_BASE_PATH=/view-camera-simulator/`: passed.
- Focused Fringe Playwright suite: both SPA/lifecycle and delayed-fetch
  cancellation tests passed.
- Prefixed development fixture browser check: one successful HTTP 200 GLB
  response; the StrictMode superseded request aborted; source release passed.
- Production preview browser check: development route redirected to not-found;
  normal Architecture Rise and Ground Glass worked with zero Fringe requests.
- `git diff --check`: passed before publication.

`npm run ci:local:e2e` passed its CSS, lint, typecheck, 2,179 unit/integration
tests, and production build stages, then stopped on the first E2E file,
`architecture-foreground-compound.spec.ts`. That existing test expects the
“Complete the Photograph” heading while the current page snapshot shows the
Task and Feedback panel closed behind its “Open Task and Feedback” button. The
same failure reproduced when that spec was run alone; no changed file affects
that task or panel. The CI script therefore did not continue through the other
51 E2E spec files. The new focused Fringe E2E suite was run separately and
passed both tests.

A broader E2E run excluding that single title was interrupted after 14.6 minutes
while the fixture/lifecycle change was being reviewed. It reported 13 passes,
nine failures, one interrupted test, and 135 tests not run. The failures were in
existing Architecture + Foreground task-panel expectations, camera-control
layout, and a Ground Glass reset interaction. The focused Fringe suite was rerun
after the final A/B identity correction and passed both tests; the unfinished
broad run is not counted as a pass.

No public catalog, public route definition, scene publication, guided task,
scene/task registry, canonical optics/simulator state, or Ground Glass profile
was added or changed. The new `sceneAssetRegistry` slot has no `sceneSubjectRegistry`
binding or public scene ID. No material redesign, texture rebake, grouping
change, frozen-zone promotion, FCC content, weathering, KTX2, or production
eager-load behavior was added.

## Limitations and next stage

The test renderer is SwiftShader software rendering; mobile, low-end GPU,
WebGPU, and physical-device performance were not tested. Texture bytes are
estimated from Stage 2H; the app does not expose exact GPU allocation. The
held façades remain frozen, glass remains the inherited coarse runtime material,
and the asset is not a scene or lesson.

Recommend Stage 2J-A: validate sharing the registered source/instance lifecycle
with Ground Glass RTT while preserving the simulator as the sole canonical
authority. Keep texture-compression feasibility as a separate follow-up; this
run's renderer counts alone do not establish a device-memory failure.
