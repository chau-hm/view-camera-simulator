# Visual pipeline readiness

This decision record describes the rendering boundary at the post-SA7 baseline
`232de05d40579d4a64592e5481bc40edf3b95fd7`. It prepares the renderer and
evidence path for scene-quality work. PR J later added one opt-in procedural
environment contribution to Architecture Rise; it did not change canonical
simulation or teaching state.

## Observer renderer/backend boundary (PR V)

Before PR V, `SceneViewport` gated the Observer on browser WebGL availability
and `SceneRenderer` supplied WebGL options directly to the R3F Canvas. The
boundary now separates browser availability, pure selection policy, Canvas
initialization, and evidence from the mounted renderer:

```text
browser WebGL availability
        ↓
selectObserverBackend (WebGL only)
        ↓
resolveObserverCanvasInitialization
        ↓
SceneRenderer R3F Canvas
        ↓
useThree().gl
        ↓
Observer mounted-capability report
```

The policy selects WebGL only when the browser availability check succeeds; it
creates no context or renderer. The initialization seam preserves the existing
Canvas configuration. `ObserverRendererCapabilityReporter` resolves identity
and display settings from the actual mounted `useThree().gl` renderer. Browser
availability and a selected backend are not evidence of mounted identity.

Only WebGL is implemented. There is no WebGPU renderer or automatic backend
fallback. Ground Glass remains WebGL-only and its RTT implementation is outside
this Observer boundary.

## Development-only Observer WebGPU coexistence pilot (PR W)

PR V's WebGL-only statement records the boundary at that time. PR W adds an
opt-in development/test pilot through the existing Observer selection and
initialization seam. The normal public Observer still requests the existing
`WebGLRenderer`; `?observerRenderer=webgpu` is honored only in development and
only for `view-camera-anatomy`. No public backend setting or production
WebGPU-selection policy is added.

The pilot dynamically imports Three r186's `three/webgpu` entry point and awaits
`WebGPURenderer.init()` in the R3F async factory. Mounted evidence is read from
the actual `useThree().gl` renderer and separates the request, renderer family,
execution backend, and application fallback. `isWebGPURenderer` identifies the
renderer family; the initialized public coordinate-system signal distinguishes
native WebGPU execution from Three's internal WebGL2 fallback. The tested
Chromium run reported the `navigator.gpu` API hint as present, but Three.js
could not initialize native WebGPU and selected its WebGL2 backend. Mounted
evidence was `webgpu-renderer` / `webgl2-fallback`, with no application
fallback. Native WebGPU is not proven. An initialization failure can trigger
one application remount through the existing WebGL path; a successful internal
fallback is not treated as an application failure.

The production build emits the `three/webgpu` entry as a separate lazy
`three-webgpu` chunk. The browser regression checks that the default WebGL page
does not request it and the explicit pilot does.

The mounted Observer report showed active PCF shadows, ACES Filmic tone mapping,
exposure `1.000000`, and `srgb` output color space. The View Camera Anatomy
pilot remained visible and interactive. A same-viewport screenshot comparison
kept the subject framing and geometry, while the pilot background appeared
slightly grayer than the near-white WebGL baseline; this renderer difference
was recorded without visual tuning. The page also kept the existing Ground
Glass RTT on WebGL, with the existing diagnostic reporting a contentful final
target. Ground Glass source, pass graph, shaders, and resource ownership are
unchanged. At the time of PR W, Architecture Rise's procedural environment used
the WebGL-specific PMREM path and was not included in the pilot. PR C later
verified an Observer-specific native WebGPU PMREM path without validating or
enabling the complete Architecture Rise scene. This evidence validates only
bounded Observer renderer coexistence; it does not claim an application-wide
WebGPU migration or fallback.

## Native Observer WebGPU verification (PR A)

PR #247's original Playwright Chromium result remains the historical baseline:
`navigator.gpu` was present and the mounted renderer reported
`webgpu-renderer` / `webgl2-fallback`. That proved Three.js renderer coexistence,
not native WebGPU execution.

This verification round adds a one-shot, development-only adapter probe for the
explicit Anatomy pilot. It calls the browser's public
`navigator.gpu.requestAdapter()` with a five-second bound, records only whether
the API is absent, an adapter is available/unavailable, the request rejects, or
the probe times out, and never requests a `GPUDevice`. The probe runs only when
the development pilot is requested, is cached for the page, and ignores late
results after the requesting component unmounts. Adapter evidence is kept
separate from the actual mounted renderer classification.

The pinned Three.js version is r186 (`three` 0.186.0). The runtime classifier
uses the renderer identity and public `Renderer.coordinateSystem`: the r186
`WebGPURenderer` constructor sets `isWebGPURenderer`; the common `Renderer`
documents `coordinateSystem` as the selected backend's coordinate system; and
the WebGPU and WebGL fallback backends return their respective public Three.js
coordinate-system constants. In the same pinned source, `WebGPURenderer`
provides a WebGL fallback and `Renderer.init()` catches a backend initialization
failure before initializing that fallback. This explains why `init()` can
resolve while the mounted execution backend is WebGL2. The diagnostic does not
inspect private backend or device fields.

### Runtime evidence

Both environments ran on macOS Darwin 27.0.0, arm64, with Three.js r186. The
headless Chromium row uses the repository's existing Playwright launch defaults
(including Playwright's `--no-sandbox` and `--enable-unsafe-swiftshader` flags); it
is a regression baseline only. Native-required mode launches installed stable
Google Chrome in headed mode and removes those two Playwright defaults. It adds
no WebGPU or GPU-selection flags. The launch command was inspected with
`DEBUG=pw:browser`.

| Evidence | Playwright Chromium baseline | Native-required Google Chrome |
| --- | --- | --- |
| Browser | Chromium 149.0.7827.55, headless | Chrome 155.0.8059.39, headed |
| Browser WebGPU API | Present | Present |
| Adapter probe | Unavailable (`requestAdapter()` returned `null`) | Available |
| Mounted renderer family | `webgpu-renderer` | `webgpu-renderer` |
| Execution backend | `webgl2-fallback` | `webgpu` |
| Application fallback | `none` | `none` |
| Initialization failure | `false` | `false` |
| WebGPU renderer factory attempts | 1 | 1 |
| Observer readiness | Ready: camera subject visible, focus selection and orbit interaction worked, reset restored the view | Ready: same checks passed |
| Ground Glass readiness | Contentful | Contentful |
| Hardware acceleration | Unconfirmed | Unconfirmed |

The automated baseline reproduces PR #247's internal fallback. Its independent
no-options adapter probe returned `null`. Three r186 requests an adapter with
its own power-preference and compatibility options; its public renderer API
does not expose the internal initialization error, so the probe cannot prove
that Three's separate request failed at the adapter step rather than later
during device or backend setup. The mounted report does prove that Three's
WebGL2 fallback became active. In the native-required Chrome run, the actual
mounted renderer reported `webgpu-renderer` / `webgpu`, with no fallback or
initialization failure. The original PR A screenshots and color-bucket check
proved that the Observer canvas was contentful, but did not distinguish pixels
from the Anatomy subject from the conceptual camera, overlays, or background.
That limitation was corrected in review fix round 1 below. The earlier native
screenshot is historical evidence only; the subject-specific differential is
the current readiness gate.

`system_profiler` reported an Apple M4 Pro GPU with Metal support. That is
supporting host information, not evidence that this Chrome session's WebGPU
adapter used hardware acceleration. No browser-specific GPU-process report was
used to make that association, so acceleration remains **unconfirmed**. During
the combined run Chrome logged shared-image mailbox errors after the default
WebGL test closed; an isolated native-only run emitted none. Both runs had no
page errors, and the native pilot rendered and interacted successfully. The
mailbox messages are recorded as browser/test-process diagnostics, not as a
WebGPU initialization failure.

### Reproduction and decision

From the repository root, run the ordinary automated regression:

```bash
npm run test:e2e -- --project=chromium src/tests/e2e/observer-webgpu-pilot.spec.ts
```

On a WebGPU-capable desktop with Google Chrome installed and a headed session,
run the native-required verification:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- src/tests/e2e/observer-webgpu-pilot.spec.ts
```

The native-required mode fails if the browser API/adapter is unavailable, the
mounted renderer is not `webgpu-renderer` / `webgpu`, an application fallback or
initialization failure occurs, more than one WebGPU renderer factory attempt is
recorded, Observer pixels or interactions are not ready, or Ground Glass is not
contentful. It attaches a machine-readable `OBSERVER_RUNTIME_EVIDENCE` result
and Observer/full-page screenshots. Normal CI remains backend-independent and
does not require hardware.

**PR A initial decision (superseded by review fix round 1): NATIVE WEBGPU
VERIFIED — GO.** The real stable Chrome run satisfied the mounted-backend,
no-fallback, generic canvas-readiness, interaction, Ground Glass, and
reproducibility checks. Hardware acceleration remained unconfirmed. The P1
finding showed that the generic canvas check did not prove the Anatomy subject
itself rendered.

### Review fix round 1 — Anatomy subject-rendered evidence

The P1 review finding identified that the registry's
`data-scene-subject-id` and the general color-bucket screenshot did not prove
that the Anatomy subject contributed pixels. The pilot now captures the same
mounted Observer framebuffer with the registered
`view-camera-anatomy-subject` group visible and hidden. It projects the existing
Anatomy presentation bounds through the captured Observer camera to define a
subject region of interest. The E2E requires a meaningful visible/hidden pixel
difference, at least 128 changed pixels inside that projected region, at least
60% of all changed pixels inside it, a still-contentful hidden frame, stable
camera/backend state, and restoration to the original image within 0.5% of
pixels. The comparison does not alter subject materials, lighting, exposure,
Ground Glass, or canonical simulation state. A development-only event seam
targets only the registered Anatomy group and is removed with the subject's
React lifecycle; another development-only event sets deterministic test
framing. Both are unavailable in production builds.

The comparison runs in ordinary WebGL regression and the development pilot,
including native-required Chrome. Test evidence attaches before-hide,
subject-hidden, and restored screenshots alongside the pixel measurements.
Renderer identity, execution backend, application fallback, initialization
attempt count, and camera position/target are checked for stability across the
captures. The generic canvas screenshot remains supplementary evidence.

| Subject-render evidence | Chromium baseline | Native-required Chrome | Native negative control |
| --- | --- | --- | --- |
| Mounted backend | `webgpu-renderer` / `webgl2-fallback` in pilot | `webgpu-renderer` / `webgpu` | `webgpu-renderer` / `webgpu` |
| Browser API / adapter | Present / unavailable | Present / available | Present / available |
| Application fallback / init attempts | `none` / 1 | `none` / 1 | `none` / 1 |
| Anatomy subject visible-vs-hidden | 20,849 changed pixels; all inside projected region | 20,866 changed pixels; all inside projected region | 0 changed pixels in projected region |
| Hidden Observer remains contentful | Yes | Yes | Yes |
| Restore result | Exact initial image | Exact initial image | Subject becomes visible again; 20,866 changed pixels from hidden frame |
| Subject readiness | Verified | Verified | **Missing; native-required test fails** |

The negative control used the same actual WebGPU renderer and real registered
subject visibility event to hide the Anatomy group before capture. The Observer
background remained contentful, controls still worked, and Ground Glass remained
contentful; the test failed specifically at `Anatomy subject must contribute
projected pixels` because the visible/hidden evidence was missing. The normal
subject-visible native run passed the same assertion. Thus registry identity,
unrelated geometry, and background pixels cannot satisfy subject readiness.

The run used macOS Darwin 27.0.0 arm64, Chrome 155.0.8059.39 (headed), and Three
r186. The native adapter was available and the mounted execution backend was
WebGPU. Browser/system evidence did not associate the adapter with hardware
acceleration, so that remains **unconfirmed**. The software-backed Chromium
baseline continued to exercise WebGL2 fallback and passed the same subject
differential. No cross-renderer pixel identity is required.

**Review-fix decision: NATIVE WEBGPU VERIFIED — GO.** The native result now
includes actual Anatomy subject pixels and a real-render negative control that
fails when those pixels are absent. This supports consideration of PR B's
multi-backend Observer architecture; every additional scene still needs its own
subject, interaction, rendering-feature, and fallback evidence. Production
rollout and Ground Glass migration remain separate decisions.

Before enabling WebGPU for another scene, define that scene's backend-neutral
contract and supported rendering features, preserve the normal WebGL default,
and add a native-required run that checks that scene's real subject, controls,
lighting/environment behavior, and fallback boundary. Scenes using additional
renderer-specific paths need their own compatibility evidence. Ground Glass
remains on its unchanged WebGL RTT and requires a separate migration design and
validation.

## Multi-backend Observer architecture (PR B)

PR B consolidates the existing pilot into four small boundaries. Compatibility
declarations describe what has been reviewed; they are not runtime capability
claims. Browser WebGPU API and adapter results remain diagnostic facts and do
not grant scene eligibility.

```mermaid
flowchart LR
  subgraph Observer[Observer surface]
    request[Explicit request + development gate]
    webglAvailability[WebGL availability]
    compatibility[Observer scene compatibility registry]
    policy[Pure renderer selection policy]
    canvas[R3F Canvas initialization boundary]
    init[WebGL factory or lazy WebGPU factory + one-shot app fallback]
    mounted[Mounted useThree().gl runtime evidence]
    visual[Observer visual settings report]
    subject[Scene-specific rendered and interaction verification]
    adapter[Bounded adapter diagnostic]
    request --> policy
    webglAvailability --> policy
    compatibility --> policy
    policy --> canvas --> init --> mounted
    mounted --> visual
    mounted --> subject
    request -. pilot-only diagnostic .-> adapter
  end

  subgraph GroundGlass[Ground Glass surface — independent]
    ggCanvas[Ground Glass Canvas]
    ggRenderer[WebGLRenderer]
    ggRtt[WebGL RTT + existing GLSL DOF passes]
    ggCanvas --> ggRenderer --> ggRtt
  end
```

`observerSceneCompatibility.ts` owns the typed, fail-closed scene declarations.
View Camera Anatomy is the only pilot-eligible scene, based on PR #248's native
mounted-backend, subject-pixel, interaction, and coexistence evidence. That
evidence covers the verified Anatomy requirements; it does not certify every
material or pipeline feature in every scene. Architecture Rise declares its
procedural environment requirement. PR C verifies that environment's PMREM
realization on native WebGPU in an isolated fixture, but the full Architecture
Rise scene remains `not-evaluated` and ineligible. Unknown and unevaluated
scenes remain WebGPU-ineligible without changing their normal WebGL path.

`observerBackend.ts` owns deterministic selection policy. It separates the
requested renderer, policy reason, and selected renderer attempt. The
development gate and declaration are required even when a browser exposes
`navigator.gpu` or an adapter. The adapter probe remains a bounded development
diagnostic; it creates no device and is not a selection input.

`observerRendererInitialization.ts` owns the R3F Canvas factory seam. It keeps
the WebGPU import lazy, awaits `WebGPURenderer.init()`, disposes a partial
renderer after failed initialization, and reports the existing one-shot
application fallback. R3F owns a successfully mounted renderer and its normal
lifecycle. A WebGPURenderer whose public coordinate-system signal reports
WebGL is recorded as Three.js internal `webgl2-fallback`; a failed WebGPU
initialization followed by WebGLRenderer is recorded separately as
`app-webgl`.

`observerVisualPipelineCapabilities.ts` owns mounted runtime evidence, read
from the actual `useThree().gl`. Selection, declared compatibility, browser
availability, renderer family, and execution backend remain distinct.
`useObserverRendererLifecycle.ts` owns a monotonic mount generation for each
Observer host. Its descriptor includes the scene/request, selected renderer
attempt, application-fallback state, and explicit mount key. A conditional
render-phase state update advances the generation only when that descriptor
changes, before descendant Canvas effects can start renderer initialization.
Unrelated React rerenders do not advance it. Initialization-attempt,
initialization-failure, Canvas-error, and mounted-capability callbacks carry
the generation that created them; the host rejects callbacks after a newer
generation becomes active or the host unmounts. Capability state is kept by
the host and filtered to the current generation, so a stale report or cleanup
cannot replace or clear newer mounted `useThree().gl` evidence. The application
fallback changes the selection/mount descriptor and therefore receives a new
generation while preserving the one-shot fallback. PR #248's development-only
Anatomy test events remain attached to their own Observer wrapper and are
removed with their scene subject or controls.

The Ground Glass Canvas remains separately owned by its existing WebGL-only
renderer and RTT code. It does not consume Observer compatibility or selection
policy, and PR B changes none of its renderer, target, shader, orientation, or
resource-ownership contracts.

To evaluate another scene in a later PR, inspect its actual Observer rendering
requirements and backend-specific implementations, resolve those gaps, add an
explicit compatibility record, and only then grant development pilot
eligibility. A native-required run must verify the actual mounted execution
backend, the scene's rendered subject and interactions, its relevant lighting
and environment behavior, Ground Glass coexistence, and fallback behavior.
Cross-scene visual parity and hardware acceleration remain unverified; neither
is inferred from renderer identity or a compatibility declaration.

### PR B verification rerun

The final PR B code was rechecked on macOS Darwin 27.0.0 arm64 with Three.js
r186. Ordinary Playwright Chromium was version 149.0.7827.55; native-required
mode used installed stable Chrome 155.0.8059.39 in headed mode and the existing
launch configuration without forced WebGPU or software-renderer flags.

| Run | Browser API / adapter | Mounted renderer / execution | Application fallback / attempts | Observer and Ground Glass evidence |
| --- | --- | --- | --- | --- |
| Ordinary Chromium WebGL baseline | Present / not requested | `webgl-renderer` / `webgl2` | `none` / 0 | Anatomy differential: 21,016 changed pixels, all inside its projected region; controls and Ground Glass passed |
| Ordinary Chromium WebGPU pilot | Present / unavailable | `webgpu-renderer` / `webgl2-fallback` | `none` / 1 | Anatomy differential: 20,849 pixels, all inside its projected region; controls and Ground Glass passed |
| Native-required Chrome | Present / available | `webgpu-renderer` / `webgpu` | `none` / 1 | Anatomy differential: 20,866 pixels, all inside its projected region; controls and Ground Glass passed |
| Native subject-hidden negative control | Present / available | `webgpu-renderer` / `webgpu` | `none` / 1 | 0 changed pixels; hidden canvas stayed contentful, controls and Ground Glass passed; subject readiness failed as expected |
| Fault-injected application fallback | Present / unavailable | `webgl-renderer` / `webgl2` | `app-webgl`, initialization failure / 1 | Anatomy differential: 21,016 pixels; controls and Ground Glass passed; later Architecture Rise navigation cleared fallback evidence |

The regular Observer E2E also verified that an Architecture Rise request does
not request the WebGPU module or adapter, and that Anatomy → Architecture Rise
→ Anatomy client-side navigation remounts the selected renderer without stale
capability or fallback state. The browser requested the lazy module chunk once;
the later Anatomy mount reused the cached module and still recorded one fresh
renderer initialization. The fault-injected fallback path used a real aborted
lazy-module request and the mounted WebGL fallback, not mocked runtime output.

All successful browser runs reported no page errors. Hardware acceleration
remains **unconfirmed** in both browser environments; adapter availability and
mounted WebGPU execution do not identify whether the browser used a hardware or
software adapter. The deliberate hidden-subject test fails specifically at
`Anatomy subject must contribute projected pixels`, while the background,
controls, and Ground Glass remain available.

Validation passed the CSS check, lint, typecheck, all 2,241 unit/integration
tests, production build, the five-test targeted Chromium Observer suite, and
the four applicable native-required Observer tests. Native-required mode
explicitly skips only the fault-injected app-fallback case. The repository-wide
`ci:local:e2e` run stopped at its first unrelated
`architecture-foreground-compound.spec.ts` assertion: the task panel heading
`Complete the Photograph` was absent from that page. The focused Observer E2E
and native-required suite passed independently.

### Review fix round 1 — mount-generation ABA guard and E2E baseline

The original host guard compared a composite request string built from scene,
renderer selection, and the fallback mount key. Anatomy → Architecture Rise →
Anatomy could restore the first Anatomy string while its asynchronous
initialization was still pending. The capability reporter used a similar
scene/renderer/mount-key string, so a delayed report or cleanup could also
match a later Anatomy mount. `useObserverRendererLifecycle.ts` now advances a
host-owned integer generation on each committed attempt-descriptor transition.
The generation survives same-host SPA navigation without reuse; unmounting
invalidates the old host's active generation. This protects initialization
attempt and failure callbacks, Canvas error-boundary callbacks, and capability
reports/cleanup. Initialization counts and failure status are updated only
while the generation remains active. A real current WebGPU failure still
produces the existing one-shot WebGL application fallback, with a new
generation and pending mounted evidence until the replacement renderer is
reported.

The new lifecycle test holds renderer A's initialization promise pending,
transitions Anatomy A → Architecture Rise → Anatomy B, then delivers A's late
attempt, failure, Canvas-error, capability-report, and cleanup callbacks. A's
events do not change B's count, failure, fallback, or current capability
report. B's own initialization failure still selects one `app-webgl` fallback.
A separate deferred-success case verifies that A's late mounted report and
cleanup cannot overwrite or clear B's `webgpu-renderer` / `webgpu` evidence.
The browser lifecycle test also checks that generations advance over SPA scene
changes and fallback, while camera controls, subject verification, and adapter
diagnostics leave the generation unchanged.

The PR B validation gap is classified as a **BASELINE FAILURE**, not a PR
regression. The exact focused command failed at the same line-35 assertion on
both PR HEAD and the original base `d868770dbf9092bc8bb63633edddb7290dae2f30`:

```bash
npm run test:e2e -- --project=chromium src/tests/e2e/architecture-foreground-compound.spec.ts
```

Both runs used Node 24.19.0, the same unchanged package lock/dependency tree,
Playwright 1.61.1, and Playwright Chromium 149.0.7827.55 with the same local
Vite server configuration. The URL was the requested guided route and the
rendered scene/task identity was `architecture-foreground` /
`architecture-foreground-compound-01`. The accessibility snapshot showed the
Task and Feedback control in its closed state; the test asks for its inner
`Complete the Photograph` heading before opening that panel. A focused
diagnostic on both revisions confirmed that opening the existing panel reveals
the expected heading and task copy. Neither run produced page errors; observed
console warnings were the existing Three.Clock deprecation and WebGL
ReadPixels-stall driver warnings. Screenshots of the closed-panel state were
captured in each worktree's ignored Playwright `test-results` directory. The
test was not changed in this renderer PR. The full local E2E workflow remains
blocked at this pre-existing assertion; later repository E2E files are not
claimed as passed.

Post-fix validation passed the repository CSS check, full lint, typecheck,
2,244 unit/integration tests, and production build. The complete ordinary
Observer suite passed 5 tests; the final pilot and SPA-generation rerun passed
2 tests. Native-required Chrome passed its 4 applicable Observer tests (the
fault-injected application-fallback case is explicitly skipped in native mode).
Its final evidence remained `webgpu-renderer` / `webgpu`, one initialization
attempt, no application fallback, 20,866 Anatomy subject pixels entirely in
the projected region, working interactions, and contentful Ground Glass.
The final native subject-hidden negative control again failed at the intended
subject-pixel assertion with 0 changed pixels while the hidden canvas remained
contentful. Hardware acceleration remains unconfirmed. The full local E2E
workflow reran after the fix and again stopped at the same proven baseline
failure; no later repository E2E files were reached.

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
kernel and aperture gather. PR O establishes a real Architecture Rise
reflected-world street-sign sample. PR P exercises real planar reflected
radiance and its derived `Q_virtual` through the PR M contract in a standalone
development/E2E fixture. PR Q validates the uncorrected single local Probe's
`Q_probe` / `Q_virtual_probe` focus path against that planar reference and
records its parallax/detail limitation. PR R tests one bounded update using the
existing radial-distance cube; it materially reduces error across the fixed
12-sample sign-face region and restores reflected detail toward the Planar
reference. PR S then tested that frozen corrected Probe at normal Observer
scale and rejected this candidate: it produced no local response from the
alternate view and retained substantial false-positive and wrong-surface
mapping in the default view. PR T's CPU-only bounded multi-Probe study
exhaustively scored all 79 valid two-Probe pairings and all 3,081 unique triples
with Probe A fixed, keeping the third view out of placement selection. Two
fixed Probes improve optimized Views A/B but leave material error on the
held-out orbit. The global best triple matches the earlier greedy extension's
origin set, yet adds only three training same-object hits and removes three
false negatives over the global best pair, below the fixed complexity gate;
its holdout still has 54.69% same-object coverage and 20.31% wrong-object
mappings. Outcome B closes local Probe planning for the current Architecture
Rise production path unless new evidence or requirements justify reopening it.
No production reflection technique is selected or integrated, and the ordinary
RTT remains on its existing single color/depth path. The ideal planar reference
does not model rough-glass angular distribution, and these Probe fixtures do not
prove production performance.
For a future Ground Glass path, accepted reflected radiance must pass through
Ground Glass before optical/DOF processing; Observer appearance integration has
no physical focus path. See the
[local-reflection decision](LOCAL_REFLECTION_TECHNIQUE_DECISION.md) for the
CPU/browser proof, software-renderer limitations, candidate analysis, and
follow-up boundary. These test fixtures do not enter public navigation or the
production bundle.

## Local reflection and the broader visual roadmap

PR U closes the current Architecture Rise local-reflection research sequence
with the production baseline retained. Observer keeps current material plus
environment response and existing world/presentation lighting; Ground Glass
keeps its direct scene-radiance and physical-DOF path. No local reflected-world
renderer is active. PR M's independent reflected-radiance / apparent-position
contract and PR P's ideal Planar reference remain inactive architecture and
development evidence.

Local reflection is a deferred side capability, not a prerequisite for
continuing visual-quality or renderer work. Materials, textures, richer scene
geometry, world lighting, environment, shadows, backend modernization, and
future exposure work can be evaluated independently. This decision does not
select which item comes next or prescribe a fixed PR sequence:

```text
shared scene assets
    ├── materials / textures
    ├── world lighting / environment / shadows
    ├── renderer architecture / backend modernization
    └── future visual effects when independently justified

local reflected-world rendering: deferred side capability
```

A future WebGPU/TSL architecture could change the reflection options, but it
does not automatically solve local reflections. Reopen the decision only for a
new teaching requirement, a materially different renderer capability, a scene
class that justifies a bounded reflector, technical evidence across views and
focus behavior, or decision-grade hardware performance evidence. PR M–T fixtures
remain useful research artifacts but do not enable production reflection.

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
or physical exposure or metering. PR C adds isolated native WebGPU evidence for
the environment PMREM and an environment-dependent `MeshStandardMaterial`; it
does not validate Architecture Rise as a complete WebGPU scene. PR K found that
the bounded standard and physical material candidates did not materially
resolve the dark glazing at normal scale; its best candidate is classified
**MATERIAL RESPONSE — negligible**.

Select further work from observed visual and teaching limitations rather than
following a mandatory renderer-migration sequence. WebGPU remains conditional on
a demonstrated backend-specific requirement.

## Backend-aware Observer environment resources (PR C)

PR C preserves the recipe and CPU-generated equirectangular source in
[`worldIlluminationContract.ts`](../src/render/worldIlluminationContract.ts)
and [`proceduralWorldEnvironment.ts`](../src/render/proceduralWorldEnvironment.ts).
The 128×64 RGBA8 source remains sRGB encoded with the existing mapping,
orientation, filters, wrap settings, and deterministic pixel hash. Resource
realization now dispatches from the actual mounted `useThree().gl` identity:

```text
WorldProceduralSkyGroundEnvironment
              ↓
  existing sRGB DataTexture
              ↓
 actual renderer family from useThree().gl
        ┌─────┴─────┐
        ↓           ↓
 WebGLRenderer   WebGPURenderer
 three PMREM     three/webgpu PMREM
        └─────┬─────┘
              ↓
 scene.environment and owned CubeUV target
```

Three r186's `three` entry exports the WebGL `PMREMGenerator` whose constructor
requires `WebGLRenderer`. The `three/webgpu` entry exports the common renderer
PMREM generator, which accepts the initialized common `Renderer`, converts an
equirectangular `Texture` synchronously, and returns a common `RenderTarget`.
Its `fromEquirectangular()` checks that the renderer backend has been
initialized; the Observer's R3F Canvas is mounted only after the existing
`WebGPURenderer.init()` resolves. The asynchronous helper on that class is
deprecated in r186. The pinned source exports are
[`Three.js`](https://github.com/mrdoob/three.js/blob/r186/src/Three.js),
[`Three.WebGPU.js`](https://github.com/mrdoob/three.js/blob/r186/src/Three.WebGPU.js),
and the [common PMREM implementation](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/extras/PMREMGenerator.js).

`WorldEnvironment` is Observer-specific. A WebGL renderer continues through
the existing synchronous `createWorldEnvironmentRig()` path. Any mounted
WebGPURenderer uses the lazily imported `three/webgpu` PMREM, including when
that WebGPURenderer reports its internal `webgl2-fallback` execution backend.
Unknown renderer families fail closed. The normal public Observer does not
load the WebGPU module. Ground Glass and the existing WebGL harnesses continue
calling the legacy WebGL rig directly.

The mounted component owns one source texture, PMREM generator temporaries, and
the returned PMREM target. It disposes the source and generator after
conversion, then assigns only the target texture to `scene.environment`. Its
cleanup restores the previous environment/intensity only while the rig still
owns the assignment, and disposes its target once. The WebGPU module import is
the only asynchronous creation step. The active effect is checked after that
import and again before scene assignment; a stale completion allocates no
source, or disposes its generated target without installing it. Failures are
reported as environment `failed`/`unsupported` in a development-only Observer
attribute and do not masquerade as renderer fallback. No target is cached or
shared between renderers. The visible scene background is unchanged.

### Environment verification evidence

The focused E2E uses the Architecture Rise recipe and actual mounted renderer
in a small R3F test fixture. It renders a metallic `MeshStandardMaterial`
sphere without direct lights, captures the real canvas with the environment
active, unmounts the environment, and compares the same projected center ROI.
This is a negative control for image-based lighting: the center ROI must change
while the unchanged background corner pixels remain stable. It then remounts
the resource, checks a new environment texture identity, and verifies the
environment is removed on final unmount. It does not route the Architecture
Rise public scene through WebGPU or change its registry eligibility.

| Run | Browser/runtime | Mounted family / backend | Environment ROI mean RGB delta | Changed pixels | Background corner delta | Result |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Chromium automated baseline | Playwright Chromium 149.0.7827.55, headless, macOS 27 arm64 | `webgpu-renderer` / `webgl2-fallback` | 80.21 / 255 | 100% | 0 / 255 | Environment contribution verified on fallback path; not native evidence |
| Native-required run | Headed Google Chrome 155.0.8059.39, macOS 27.0.0 arm64 | `webgpu-renderer` / `webgpu` | 80.12 / 255 | 100% | 0 / 255 | Native environment contribution verified |

Both runs kept the fixture background at `#f8fafc`, had no page errors or
console errors, and created a different environment texture after remount.
The latest native Chrome run came from the host's actual `darwin`/`arm64`
runtime; the Playwright Desktop Chrome context supplies a Windows-style
user-agent string. It reported API present, adapter available, and mounted
`webgpu-renderer` / `webgpu`, with no application fallback and one WebGPU
initialization attempt. The automated Chromium run reported its adapter
unavailable. No device was created for the bounded diagnostic. Hardware
acceleration remains **unconfirmed**; neither adapter availability nor renderer
identity distinguishes a hardware-backed adapter from software rendering.

The production Architecture Rise route was separately exercised on its normal
WebGL path: its environment status became `active`, the mounted renderer was
`webgl-renderer` / `webgl2`, the registered Ground Glass RTT remained
contentful, and the route produced no page errors. The isolated environment
fixture is the pixel-level environment contribution evidence; the production
route run is the WebGL regression evidence.

### Lighting and material compatibility inventory

| Rendering feature | Existing WebGL behavior | WebGPU status in this round | Evidence | Remaining risk |
| --- | --- | --- | --- | --- |
| `MeshBasicMaterial` and line materials | Used by Observer overlays, guides, and scene accents | Implementation-compatible; bounded Anatomy output is visible | Existing native Anatomy pilot; source inventory | Not a per-scene visual audit |
| `MeshStandardMaterial` | Used by scene subjects, including Architecture Rise | Environment-dependent reflection/lighting verified in the isolated native fixture | Native `webgpu-renderer` / `webgpu` on/off ROI comparison; production Architecture Rise WebGL route | Complete Architecture Rise scene and material parity are not verified |
| `MeshPhysicalMaterial` | No current production Observer construction found; its name is only used by the shadow-participation classifier | Not tested / not currently applicable | Production source inventory | Revisit only if a scene begins using it |
| Hemisphere and directional lighting | Presentation and scene illumination use built-in lights | Partially verified by the Anatomy pilot | Native Anatomy report and image | Cross-scene contribution and natural-shadow quality are unevaluated |
| Shadow maps | Observer applies its current presentation shadow policy | Partially verified on Anatomy; environment fixture reports the mounted setting but has no shadow-casting object | Mounted capability evidence | Cross-scene map behavior and shadow visual quality remain unevaluated; WebGPU warns that `PCFSoftShadowMap` maps to `PCFShadowMap` |
| Procedural environment / PMREM | Legacy WebGL PMREM and CubeUV target | Native path verified for environment-dependent `MeshStandardMaterial` in the fixture | Native environment on/off screenshot differential | Does not certify the complete Architecture Rise scene |
| Custom GLSL / `ShaderMaterial` / `RawShaderMaterial` / `onBeforeCompile` | Ground Glass owns the production GLSL RTT passes; its shader and target code is unchanged | Not assumed compatible and not migrated | Production Observer source inventory; Ground Glass remains WebGL | Any future Observer GLSL use needs its own renderer audit or TSL work |
| Tone mapping / exposure / output color space | Existing WebGL Observer reports actual renderer settings | Anatomy native pilot and fixture report ACES Filmic, exposure 1, `srgb` output | Mounted runtime evidence | Settings do not prove cross-scene appearance parity or exposure metering |

The Observer source inventory found production `MeshBasicMaterial`,
`LineBasicMaterial`, and `MeshStandardMaterial` use, but no production Observer
`ShaderMaterial`, `RawShaderMaterial`, or `onBeforeCompile` path. Ground Glass
uses `ShaderMaterial` GLSL independently. The Architecture Rise reflection
research fixture contains custom shader hooks, but it is test-only and remains
on WebGL. The fixture and Anatomy result do not establish that every Three.js
built-in material or light is visually compatible across every scene.

### Scene eligibility and follow-up

The old active `procedural-world-environment-uses-webgl-pmrem` constraint is
removed because the renderer-specific PMREM path is now exercised on native
WebGPU. Architecture Rise still has `webgpu.status: not-evaluated`, no verified
full-scene requirements, and `developmentWebGpuPilot: not-eligible`. Its
selection reason is now `scene-compatibility-not-evaluated`. View Camera
Anatomy remains the only development pilot; production remains WebGL.

Before any later PR enables another WebGPU scene, it must verify that complete
scene on a real native WebGPU backend: all registered subjects, built-in and
custom materials, environment and lights, shadow behavior, background/framing,
interactive controls, renderer display settings, and Ground Glass coexistence.
That scene-level E2E must include a meaningful negative control for any new
renderer-specific resource and must keep application fallback distinct from
Three.js internal fallback. PR C does not authorize Architecture Rise or any
other scene for WebGPU.

### Local E2E validation boundary

The PR C environment E2E passed on ordinary Chromium and native-required Chrome;
the focused Observer suite reported seven passes and one failure in the existing
application-fallback SPA navigation test. That failure was reproduced with the
same assertion on the clean `origin/main` snapshot at `e3c2dfd`, so it is a
baseline issue rather than a PR C regression. The repository's
`npm run ci:local:e2e` workflow also passed CSS, lint, typecheck, all 2,252
unit/integration tests, and the production build, then stopped on its first E2E
file: `architecture-foreground-compound.spec.ts` could not find the
“Complete the Photograph” heading. The captured page showed the guided route and
Architecture + Foreground task loaded, while the Task and Feedback panel was
collapsed behind its “Open Task and Feedback” button; the test expected panel
content before opening it. The same focused command failed on the clean base
with Playwright Chromium 149.0.7827.55 on macOS 27 arm64 and Node 24.19.0. The
remaining files in the full E2E workflow were not reached.

## PR #250 review-fix round 1 — typecheck and environment status ownership

The reviewed PR head `8abbadb` failed hosted Actions run `38138212889` in
`npm run typecheck` with three TS2345 errors in
`WorldIllumination.test.tsx`: direct calls omitted the required renderer mount
generation. This was a committed test-contract mismatch, not a TypeScript
version difference; hosted Node was 24.21.0 and the local validation runtime is
24.19.0. The exact reason the earlier local PASS did not catch those committed
calls is not recoverable from the retained run artifacts. The corrected tree
passes the repository's exact `npm run typecheck` command.

Renderer generation alone did not distinguish multiple environment realizations
inside the same Canvas. `SceneRenderer` now owns a monotonic attempt counter and
tags each actual `WorldEnvironment` effect setup with a serializable
`{ rendererGeneration, attempt }` token. Status reports are accepted only for
the current renderer generation and current realization token. A newer pending
attempt supersedes every older token, including a delayed pending report. The
current scene recipe determines `not-configured`; `WorldEnvironment` cleanup
continues to cancel async completion and dispose only its rig, without clearing
a failure diagnostic or overwriting replacement status. The E2E fixture's
toggle now changes only whether the environment is configured; its active and
failed status comes from the mounted component lifecycle.

The status tests cover late completion after removal, same-generation A-to-B
replacement, renderer-generation change, failure followed by cleanup, stale
active/failure/pending reports, and unchanged-input rerenders without PMREM
recreation. `WorldIllumination` tests also assert recipe, mount-generation,
token-factory, and callback forwarding.

| Validation after review fix | Result |
| --- | --- |
| `npm run typecheck` | PASS on Node 24.19.0 |
| Focused environment/illumination/PMREM unit tests | PASS — 24 tests |
| `npm test` | PASS — 243 files, 2,258 tests |
| `npm run lint` / `npm run check:css` | PASS |
| `npm run build` | PASS; WebGPU remains a separate lazy chunk |
| Ordinary Chromium Observer E2E files | PASS — 8 tests |
| Native-required Chrome Observer E2E files | PASS — 7 tests, 1 expected skip for the deliberate app-fallback fault-injection case |

The final native-required run used headed Google Chrome 155.0.8059.39 on
macOS Darwin 27.0.0 arm64 with Three.js r186. It reported WebGPU API present,
adapter available, mounted `webgpu-renderer` / `webgpu`, no application
fallback, one initialization attempt, no initialization failure, Anatomy
subject differential of 20,866 changed pixels entirely inside the projected
subject region, interactive focus/orbit/reset, contentful Ground Glass, and no
page errors. The environment fixture reported `active`, then
`not-configured` after removal, and used a new target after remount. Hardware
acceleration remains unconfirmed.

The rerun of `npm run ci:local:e2e` passed CSS, lint, typecheck, all 2,258
unit/integration tests, and build, then stopped at its first E2E file. The
Architecture + Foreground test again could not find “Complete the Photograph”
before opening the collapsed Task and Feedback panel. Its error context shows
the correct guided route and lesson with the panel behind “Open Task and
Feedback.” This is the same focused failure previously reproduced on the
original base commit `e3c2dfd` with the same Node and Playwright Chromium
environment; it remains a baseline validation issue. Later E2E files in the
full workflow were not reached. The focused Observer E2E files did pass
separately in both ordinary Chromium and native-required Chrome.

The final hosted Actions result for the review-fix head is recorded in the PR
handoff; the review-fix changes do not alter production WebGL selection,
Architecture Rise eligibility, or Ground Glass rendering.

## PR D — Architecture Rise Native WebGPU Scene Validation

PR #250 verified that the Architecture Rise procedural environment could be
realized with native WebGPU in an isolated reflective-material fixture. That
did not verify the registered Architecture Rise building, its complete asset
inventory, lighting, shadows, controls, or Ground Glass coexistence. This round
renders the normal `SceneRenderer` and real `architecture-rise-subject` through
a development-only test fixture. The fixture is restricted to the exact
Playwright HTML entry and `import.meta.env.DEV`; it does not add a route or
query-based compatibility bypass. `selectObserverBackend()` and the
compatibility registry are unchanged: the public Architecture Rise route
continues to use WebGL, `webgpu.status` remains `not-evaluated`, and the scene
remains `not-eligible` for the development pilot.

The verification uses the actual `SceneDefinition`, registered asset factory,
presentation and world lighting, procedural `WorldEnvironment`, Observer
Canvas, and existing Ground Glass WebGL RTT. The test hook targets only the
registered subject and reports runtime mesh/material/texture data from the
mounted scene. Environment and light negative controls modify the actual
mounted scene and restore their values. The shadow comparison uses a second
test-only mount with presentation-key shadows disabled before its first frame;
changing `castShadow` after Three r186 creates a native WebGPU shadow node can
produce a null `depthTexture`, so the test does not mutate that live state. The
comparison uses the same actual WebGPU renderer family/backend, camera pose,
environment, and scene. Its alternate light configuration is restored by the
verification component cleanup. A production build contains none of the
verification fixture path, request identity, selection reason, or shadow-mode
query strings; the existing lazy `three-webgpu` chunk remains for the Anatomy
pilot.

### Runtime and mounted-backend evidence

The native-required command ran headed installed Google Chrome 155.0.8059.39
on macOS Darwin 27.0.0 arm64 with Three.js r186, viewport 1440×1000, and device
pixel ratio 1. The native-mode Playwright context uses Chrome's own user agent
instead of the Desktop Chrome device preset. It adds no WebGPU/software-renderer
flags and removes Playwright's `--no-sandbox` and
`--enable-unsafe-swiftshader` defaults. A browser WebGPU adapter was available.

| Evidence | Public WebGL route | Ordinary Chromium verification | Native-required Chrome verification |
| --- | --- | --- | --- |
| Browser API / adapter | API present; not requested | API present / unavailable | API present / available |
| Mounted renderer family | `webgl-renderer` | `webgpu-renderer` | `webgpu-renderer` |
| Execution backend | `webgl2` | `webgl2-fallback` | `webgpu` |
| Application fallback / failure | `none` / none | `none` / none | `none` / none |
| Renderer factory attempts for active mount | 0 WebGPU | 1 | 1 |
| Environment | Active | Active | Active |
| Architecture Rise public eligibility | `not-eligible` | `not-eligible` | `not-eligible` |
| Ground Glass RTT | Contentful | Contentful | Contentful |
| Page/console errors | None | None | None |
| Hardware acceleration | Unconfirmed | Unconfirmed | Unconfirmed |

The ordinary Chromium run is a fallback regression, not native WebGPU
evidence. Only native-required mode requires the mounted `webgpu-renderer` /
`webgpu` pair and rejects fallback. The native run recorded one renderer
initialization for each active verification mount, no initialization failure,
no application fallback, and generation `0` for the current host attempt.
The shadow negative-control mount also initialized once and retained the same
mounted family and execution backend. The native report records the actual
mounted renderer, not a backend selection prediction. No claim is made about
whether Chrome used a hardware or software adapter.

### Scene and visual compatibility results

The actual registered subject is `architecture-rise-subject` with 334 meshes.
The measured inventory includes `MeshStandardMaterial` and
`MeshBasicMaterial`; facade and sidewalk materials carried 128×128 sRGB color
maps plus 128×128 normal and roughness maps. The front glazing retained the
scene's `#182d37`, roughness `0.24`, metalness `0.08` material. The scene
contained the named facade, roof parapet, front and side glazing, side return,
ground, sidewalk, focus chart, and street sign.

The mounted subject visibility negative control changed 124,282 of 211,254
pixels in the projected scene region. Named feature regions changed for the
facade, roof, glazing, side return, sidewalk, ground, and focus chart. The
focus chart retained red pixels in its projected region. Hiding the subject
left a measured upper-right background patch unchanged (0 of 2,304 pixels),
Ground Glass stayed contentful, the camera pose and mounted renderer remained
stable, and restoring the subject returned the Observer image exactly to the
pre-hide capture. The E2E attaches the WebGL close view, native close view,
subject-hidden negative control, restored frame, and full Observer/Ground Glass
screenshots along with the JSON report.

The WebGL and native WebGPU close captures use the same camera position
`(4.8, 2.7, 4.2)`, target `(0, 1.25, 9.3)`, viewport, device-pixel ratio,
simulation state, tone mapping, exposure, and output color space. A bounded
mean absolute RGB delta under 50/255 was required for each representative
region; measured deltas were:

| Region | Mean absolute RGB delta (0–255) | Visual observation |
| --- | ---: | --- |
| Facade | 21.35 | Full facade and texture detail remain visible; WebGPU is lighter and greener/cooler |
| Roof/parapet | 20.60 | Roof silhouette and trim remain visible |
| Front glazing | 19.60 | Window geometry and environment response remain visible |
| Side glazing | 21.44 | Side-return windows remain visible |
| Side return | 23.54 | Side surface and edges remain visible |
| Ground | 19.82 | Ground plane and depth ordering remain visible |
| Sidewalk | 8.73 | Slab remains visible with the closest mean color match |
| Focus chart | 29.29 | Checker detail and red crosshair pixels remain visible |

The default framing comparison reported 15.04 mean absolute RGB delta. The
visual review found a modest cooler/greener and brighter shift on some lit
facade and ground regions. No subject, glazing, texture, or reference geometry
was missing, and no black, white, magenta, or transparency defect was observed
in the building materials. The captures do not require pixel-identical GPU
output, and no material or lighting values were retuned.

Environment disabled versus enabled changed 657 of 920 front-glazing pixels
(mean RGB delta 22.03); restoring the environment returned that ROI exactly.
The test requires over 100 changed glazing pixels and mean delta above 2/255;
it also requires restoration below 8 changed pixels and 0.25/255 mean delta.
The opposing camera view changed mean glazing luminance by 3.02. Independent
negative controls for the presentation key and Architecture Rise daylight
changed 32,624 and 28,059 pixels respectively in the projected facade region,
with mean deltas 7.78/255 and 7.39/255. Each control must change more than
1,000 facade pixels with mean delta above 1/255, then restore below 8 changed
pixels and 0.25/255 mean delta. These image assertions gate the reported PASS;
the test-hook attributes only confirm which real Three.js object was toggled.
The actual configuration has active `pcf` shadow maps, a presentation key with
`castShadow=true`, and Architecture Rise daylight with `castShadow=false`.
With the presentation key disabled before the negative-control mount's first
frame, 10,179 subject pixels and 8,889 ground pixels changed. This confirms an
observable shadow contribution without attributing shadows to the daylight
source. The scene reported ACES Filmic tone mapping, exposure 1.0, and `srgb`
output.

### Controls, coexistence, and lifecycle

The run began at 8,890 mm focus (public range 3,090–13,000 mm), f/11, and zero
rise, tilt, and swing. Public controls then reached 13,000 mm, f/5.6, 22 mm
rise, 0.4° tilt, and −1.1° swing. Scene/Camera focus, orbit, zoom, and reset
worked without changing the renderer generation. The real Ground Glass frame
changed in 206,230 of 211,768 pixels after the combined focus, aperture, rise,
tilt, and swing changes, while remaining contentful. Ground Glass stayed on
its existing independent WebGL RTT. Raw and Upright Assist were both
contentful; their captures differed in 77,315 pixels, and the run restored
Raw mode. The existing physical optics, Ground Glass render targets, GLSL
passes, and orientation code were not changed.

The verification did not add renderer or PMREM ownership. It observed the
existing native environment as `active`, exercised environment removal/restored
appearance, and checked renderer-generation stability through subject,
environment, light, focus, movement, orbit, zoom, and reset controls. A
client-side BrowserRouter round trip navigated from the verification mount to
public View Camera Anatomy and back without a document reload. The Anatomy
route mounted its default `webgl-renderer / webgl2` with contentful Ground
Glass; returning created a replacement Architecture Rise Observer canvas,
initialized it once, retained the expected native WebGPU or ordinary
`webgl2-fallback` backend, and kept Ground Glass contentful. This round trip
does not hold a renderer or PMREM promise pending across navigation; the stale
callback guards remain covered by the PR #249 lifecycle regression work.
The machine report captures initial-mount environment and subject-differential
renderer stability before navigation; return-mount identity and readiness are
reported separately under `spaSceneNavigation`.
Resource allocation counts and zero-leak behavior were not measured. Existing
PR #250 environment lifecycle tests remain the evidence for stale realization
rejection and target disposal; they do not claim a GPU leak count for this
complete-scene run.

### Readiness matrix and decision

| Category | Result | Evidence / limitation |
| --- | --- | --- |
| Native mounted execution and public-policy isolation | **PASS** | Headed Chrome mounted `webgpu-renderer` / `webgpu`; public route stayed WebGL and denied the request |
| Registered subject and architectural geometry | **PASS** | 334-mesh actual subject, localized visible/hidden/restored framebuffer differential |
| Standard/Basic materials and procedural map assignment | **PASS** | Actual mounted material profiles and mapped feature-region screenshots |
| Facade, roof, frames, side return, ground, sidewalk, signs, focus chart | **PASS** | Named projected regions, subject pixels, matched close-view comparison, crosshair pixels |
| Glazing and environment contribution | **PASS** | Actual environment negative control and view-dependent captures; directional luminance change is subtle |
| Presentation/daylight lighting | **PASS** | Independent actual-light negative controls; daylight correctly does not cast shadows |
| Presentation shadow behavior | **PASS** | Active PCF configuration and measurable same-backend shadow negative control |
| Background/framing and renderer display settings | **PASS** | Matched camera, ACES Filmic, exposure 1.0, `srgb` |
| Rise, focus, aperture, tilt, swing, Scene/Camera, orbit, zoom, reset | **PASS** | Public values changed; combined control changes altered 206,230 Ground Glass pixels without an Observer remount |
| SPA A→B→A scene navigation | **PASS** | BrowserRouter moved from the verification mount to Anatomy and back; renderer identity reinitialized once and Ground Glass stayed contentful |
| Ground Glass coexistence and Raw/Upright modes | **PASS** | Existing WebGL RTT stayed contentful; control and orientation captures changed distinct pixels |
| GPU resource leak count / hardware acceleration | **NOT VERIFIED** | No GPU leak counter or Chrome-adapter acceleration association was collected |
| Other OS/browser/driver combinations | **NOT VERIFIED** | Native scene evidence is from one macOS Chrome environment |

**PR D decision: READY FOR PR E.** The complete registered scene rendered and
interacted under the actual native WebGPU backend with no unresolved critical
compatibility defect. The result supports a separate PR E review to enable
Architecture Rise as a development-only pilot. It does not authorize
production WebGPU selection, other scene eligibility, or Ground Glass
migration. Hardware acceleration remains unconfirmed, cross-platform support
remains unverified, and production WebGL stays the default.

Final repository validation passed `npm run check:css`, `npm run lint`,
`npm run typecheck`, all 243 unit/integration files (2,260 tests), and
`npm run build`. The ordinary Chromium Architecture Rise verification passed
both tests through the expected `webgl2-fallback`; headed Chrome native-required
verification passed both tests through actual `webgpu` execution. The full
`npm run ci:local:e2e` workflow completed those checks and then stopped at its
first E2E file, `architecture-foreground-compound.spec.ts`, because the test
could not find the “Complete the Photograph” heading. No later full-suite E2E
files were reached. The same assertion was previously reproduced on the
pre-PR-D base snapshot documented above; that prior base comparison is the
evidence that this is a baseline issue, and this round did not rerun a separate
clean checkout of commit `9802df4`. The PR D changes do not touch the
guided-task route or its panel. The final focused Architecture Rise E2E passed
2/2 in both browser modes. The existing Anatomy pilot passed 5/5 in ordinary
Chromium and 4 passed / 1 expected application-fallback skip in native-required
Chrome. The local full workflow remains incomplete beyond its first E2E file.

### PR #251 Review-Fix Round 1 — material and glazing evidence

This follow-up strengthens the scene evidence with negative controls on the
actual registered `architecture-rise-primary-facade` mesh and its existing
`MeshStandardMaterial`. The test swaps only the color or normal map for a
neutral 1×1 texture, captures the same projected facade ROI, restores the
original map, and confirms the restored pixels match. A neutral texture is
used instead of a null map because Three.js r186's WebGPU material path can
retain a texture node and fail when that map is removed.

| Backend | Color map disabled | Normal map disabled | Restored image |
| --- | --- | --- | --- |
| Chromium 149, `webgpu-renderer / webgl2-fallback` | 819/992 pixels changed (12-level channel threshold; mean delta 20.25/255) | 355/992 changed (1-level threshold; mean delta 0.237/255) | 0 changed pixels for both maps |
| Chrome 155, `webgpu-renderer / webgpu` | 800/992 pixels changed (12-level channel threshold; mean delta 20.09/255) | 345/992 changed (1-level threshold; mean delta 0.218/255) | 0 changed pixels for both maps |

The normal-map negative control uses an explicit one-level channel threshold
because its real contribution is subtle; it must still change more than 100
pixels and 10% of the ROI and exceed a 0.1/255 mean RGB delta. The test reads
the material and map UUIDs from the mounted facade, keeps the camera and
renderer generation stable, and checks actual framebuffer pixels. Registry or
material metadata alone cannot satisfy this assertion.

The glazing check captures environment-on, suppressed, and restored images at
two fixed camera positions. Suppression uses the live environment rig's owned
intensity value of zero while keeping the PMREM texture assigned; the
suppressed image changes 657/920 front-glazing pixels at view A (22.03/255
mean delta) and 968/1,392 at view B (15.05/255). Both restored ROIs return to
zero changed pixels. The normalized response differs by 0.0298 between views,
so this run reports view-angle dependence as verified. Renderer family,
execution backend, mount generation, glazing material, lighting, and shadow
configuration stay fixed across each comparison.

The environment control now belongs to the component that owns and disposes
the PMREM rig. Suppression changes only that live rig's intensity; disposal
restores the prior environment and intensity if the rig still owns the scene,
then releases its target. Focused lifecycle tests cover suppression, owner
replacement, cleanup while suppressed, and one-time disposal. The development
control remains restricted to the exact E2E fixture and is removed on cleanup.
The probe mount also has a direct compile-time development guard; a production
build scan found no fixture path, material-control event, or facade-control
attribute markers in the emitted JavaScript.

The updated Chromium 149 fallback E2E completed 2/2 tests. Its full scene test
took 10.2 minutes and reported API present / adapter unavailable,
`webgpu-renderer / webgl2-fallback`, no application fallback, one factory
attempt, contentful Ground Glass, and no page or console errors. The
native-required run completed 2/2 tests in headed Chrome 155.0.8059.39 on
macOS Darwin 27.0.0 arm64. It reported API present / adapter available,
`webgpu-renderer / webgpu`, no application fallback or initialization failure,
one factory attempt, contentful Ground Glass, and no page or console errors.
The A→B→A route return created a new renderer generation and one new attempt in
both runs. Hardware acceleration remains unconfirmed; the evidence proves the
native WebGPU API execution path, not the adapter's hardware/software backing.

**Review-fix decision: NATIVE WEBGPU VERIFIED — GO.** The added material and
glazing negative controls passed on the actual native WebGPU backend as well
as the ordinary fallback baseline. This remains evidence for the isolated
Architecture Rise fixture only; public Architecture Rise eligibility and the
production WebGL default are unchanged.

## PR E — Controlled Architecture Rise development WebGPU rollout

PR #251's full-scene native verification is now represented by the distinct
compatibility evidence identifier `pr-251-native-architecture-rise-e2e`.
Architecture Rise declares all four verified requirements:
`observer-scene-subject`, `presentation-lighting`, `shadow-maps`, and
`procedural-world-environment`. Its development pilot eligibility is an
independent, explicit registry decision. View Camera Anatomy retains its own
`pr-248-native-observer-e2e` evidence and eligibility; unevaluated scenes
remain denied.

In development, the ordinary Architecture Rise route continues to select
WebGL. The explicit request
`/simulator/free/architecture-rise?observerRenderer=webgpu` is approved for the
existing WebGPU Observer pipeline. In production builds, the development gate
denies the same query and keeps the mounted renderer on WebGL. Eligibility is
not an automatic renderer selection and is not evidence about the backend
that actually mounted.

The normal-route E2E reads capabilities from the mounted Observer and checks
the registered Architecture Rise facade through a canonical-geometry-projected
region of the real framebuffer. In the native run that 11,550-pixel region had
153 distinct color buckets and luminance standard deviation 38.43. Compared
with the same route's WebGL image, 11,059 pixels changed at a 12-level RGB
threshold (mean absolute RGB delta 23.51/255). This subject-specific pixel
evidence supplements registry identity and the separate PR #251 fixture's
material, lighting, glazing, and shadow negative controls.

| Environment | API / adapter | Mounted family / execution | Fallback / attempts | Observer and Ground Glass |
| --- | --- | --- | --- | --- |
| Headed Chrome 155.0.8059.39, macOS Darwin 27.0.0 arm64, Three.js r186 | Present / available | `webgpu-renderer / webgpu` | None / one | Projected facade ROI verified; focus, aperture, rise, tilt, swing, Scene/Camera focus, orbit, and reset passed; environment active; Ground Glass contentful and changed in 206,299 of 211,768 pixels after optical controls; no page or console errors |
| Playwright Chromium 149.0.7827.55, macOS Darwin 27.0.0 arm64, Three.js r186 | Present / unavailable | `webgpu-renderer / webgl2-fallback` | None / one | Anatomy subject-visibility differential, interactions, and Ground Glass checks passed; this is not native WebGPU evidence |
| Production preview, Playwright Chromium 149.0.7827.55, Three.js r186 | Adapter not requested | `webgl-renderer / webgl2` for both default and explicit WebGPU query | None / zero | No WebGPU module request or development-only test hooks; Observer and Ground Glass screenshots were contentful on both requests (449/205 color buckets respectively) |

The native run reported hardware acceleration as **unconfirmed**. It proves
execution through the WebGPU API, not whether the adapter is hardware or
software backed. Native support on other browser, OS, and driver combinations
and a zero-GPU-leak guarantee remain unverified. Other scenes remain
unevaluated, production remains WebGL-only, Ground Glass remains its existing
independent WebGL RTT, and pixel parity between backends is not claimed.

To roll back only Architecture Rise pilot access, change its registry entry
from `developmentWebGpuPilot: "eligible"` to
`developmentWebGpuPilot: "not-eligible"`. Keep the native evidence and
verified requirements intact. This denies new explicit development requests
while preserving Anatomy eligibility, normal WebGL, production isolation, and
Ground Glass behavior.

### PR E validation and full-E2E boundary

Focused backend selection tests passed (29 tests). Repository validation
passed `npm run check:css`, `npm run lint`, `npm run typecheck`, `npm test`
(243 files / 2,267 tests), and `npm run build`. The full Chromium Observer
pilot E2E passed 6/6 tests, including default WebGL, internal WebGL2 fallback,
one-shot application fallback, Table Tilt denial, and the SPA request/scene
transitions. The Architecture Rise environment regression passed. The normal
Architecture Rise route passed in ordinary Chromium with the expected
`webgpu-renderer / webgl2-fallback`, and in native-required Chrome with
`webgpu-renderer / webgpu`. The preserved PR #251 full-scene fixture also
passed in native-required Chrome. The production-preview smoke passed with
pixel-analyzed Observer and Ground Glass captures for both default and
explicit-WebGPU-query routes.

`npm run ci:local:e2e` passed its CSS, lint, typecheck, unit/integration, and
build stages, then stopped at its first E2E file,
`architecture-foreground-compound.spec.ts`. The failing assertion expected
the `Complete the Photograph` heading at
`/simulator/guided/architecture-foreground/architecture-foreground-compound-01?rttDiagnostics=1`;
the heading was absent. This matches the same failure signature and earlier
pre-PR-D base reproduction documented above. PR E changes no guided task or
Architecture + Foreground route. The full local E2E sequence remains
incomplete after that first test; the rollout E2Es were run separately.

**PR E decision: NATIVE WEBGPU VERIFIED — GO for the explicit development-only
Architecture Rise pilot.** Hardware acceleration remains unconfirmed, and
this result does not enable production WebGPU, additional scenes, or Ground
Glass migration.

## PR F — Observer Backend Comparative Benchmark

PR F adds an opt-in, dedicated Playwright benchmark for paired WebGL2 and
native WebGPU Observer runs on View Camera Anatomy and Architecture Rise. It
uses three paired trials per scene, alternating backend order, fixed 1440 ×
1000 viewport and DPR 1, recorded canonical controls and camera pose, a real
OrbitControls workload, scene-specific framebuffer regions, and bounded
renderer-recovery sequences. The suite runs with
`npm run benchmark:observer-backends`; it is excluded from default and
production-preview E2E discovery. Method details and interpretation are in
[`docs/benchmarks/OBSERVER_BACKEND_COMPARISON.md`](benchmarks/OBSERVER_BACKEND_COMPARISON.md).

### PR F review-fix round 1 — measurement boundaries and evidence

The review identified four benchmark-evidence defects: renderer/capture timing
boundaries were not isolated; a fixed-duration cadence window could include
idle frames or miss a short workload; the Ground Glass restore check used an
overly permissive fixed threshold; and some earlier sample/trial labels did
not match the measured behavior. The benchmark now reports context/page setup,
navigation-to-DOMContentLoaded, navigation-to-mounted-active-renderer,
adapter-diagnostic completion, and navigation-to-verified-subject-capture as
separate monotonic wall-time intervals. Adapter readiness is observed
asynchronously and does not delay renderer or capture timing. The screenshot
milestone is recorded only after actual canvas pixels in the geometry-derived
subject region are meaningful; it is not labeled as a first contentful frame.

Cadence now comes from four real OrbitControls pointer gestures. Only rAF
intervals with both endpoints inside the same pointerdown/up gesture count as
active. Inter-gesture cadence is separate, pre/post idle intervals are
excluded, and every gesture must change camera pose. Ground Glass captures
three same-mode baselines at a one-level channel threshold and accepts
restoration only within the worst repeated-capture variation in pixel fraction,
RGB MAE, and signed luminance; the previous fixed tolerance was removed.

The corrected canonical run used headed Chromium 155.0.8059.39 on macOS Darwin
27.0.0 arm64 with Three.js r186, viewport 1440 × 1000, DPR 1. Its measurement
commit is `91d621b7815b69a142d4543401330ea9f1641c6a`, and its complete report is
in the ignored local artifact directory
`test-results/observer-backend-comparison/2026-10-12T17-08-31.178Z-91d621b7815b/`
(generated `2026-10-12T17:09:22.541Z`). The WebGPU API and adapter were
available. All six WebGPU trials mounted `webgpu-renderer / webgpu` with one
initialization attempt and no application fallback; all six WebGL trials
mounted `webgl-renderer / webgl2`. All 12 trials were valid, with no page or
console errors. Both scenes recovered through WebGL2 → native WebGPU → WebGL2
→ native WebGPU with advancing generations. Architecture Rise environment
readiness remained active. Ground Glass remained WebGL2-backed and contentful,
responded to Raw/Upright mode changes, and restored to the exact initial pixels
in this run.

| Scene | Backend | Navigation to active renderer, median | Navigation to verified subject capture, median | Active-gesture rAF cadence |
| --- | --- | ---: | ---: | --- |
| View Camera Anatomy | WebGL2 | 749 ms | 916 ms | 36 samples/trial; median 16.7 ms; p95 16.8–18.4 ms |
| View Camera Anatomy | Native WebGPU | 1,367 ms | 1,532 ms | 36 samples/trial; median 16.7 ms; p95 17.7–18.2 ms |
| Architecture Rise | WebGL2 | 859 ms | 1,024 ms | 36 samples/trial; median 16.7 ms; p95 17.8–18.6 ms |
| Architecture Rise | Native WebGPU | 1,417 ms | 1,601 ms | 36 samples/trial; median 16.7 ms; p95 16.8–17.9 ms |

These wall times include browser/server scheduling, module loading, renderer
initialization, and scene realization; they are not GPU timings. WebGPU
route-to-active and verified-capture times were higher in these three paired
trials per scene, but this does not establish a sustained rendering-performance
ranking. Active cadence had no intervals over 50 ms. Whole-canvas/subject ROI
MAE was 22.10/15.42 for Anatomy camera inspection and 21.34/14.06 for its
registered target-board view. Architecture Rise facade ROI MAE was 22.76 in
the default view and 21.83 in the close view. The images show tone/background
and facade/glazing differences that need human teaching-use review.

The largest observed same-mode Ground Glass baseline variation was 0.1559%
changed pixels and 0.00112 RGB MAE for Anatomy; Architecture Rise repeat
captures were identical. Restored captures were pixel-identical in all trials.
Chrome DevTools Protocol reported Metal and no software renderer, but does not
identify the adapter actually selected by WebGPU, so hardware acceleration
remains **unconfirmed**. The previous PR F report is superseded for timing,
cadence, and restoration evidence by the run above.

**PR F decision: native WebGPU functional rendering verified for both tested
development pilots; visual equivalence and performance remain inconclusive;
hardware acceleration is unconfirmed.** Continue the development-only pilots
(direction A). This benchmark does not authorize production rollout, further
scene eligibility, or Ground Glass migration.

## PR G — Observer Background and Transparent Overlay Parity

PR G adds a dedicated, opt-in matched-pose visual capture for the existing
Architecture Rise WebGL and native WebGPU pilots. It records the actual mounted
renderer, public canvas configuration, two clear background regions, real
Observer canvas screenshots for overlay-off/focus-only/DOF-only/combined states,
and same-backend overlay-on minus overlay-off response. It does not change
renderer, scene, lighting, material, geometry, or optics behavior. Generated
JSON and PNG evidence stays under the ignored
`test-results/observer-backend-comparison/playwright/` directory.

The six earlier human screenshots identified a visible gray WebGPU background
and weaker/different transparent plane colors. Their camera poses were not
known to match, so the plane-position variation in those screenshots is not
treated as geometry evidence. The new capture uses the existing deterministic
Architecture Rise view event and verifies the mounted camera position
`[4.8, 2.7, 4.2]`, target `[0, 1.25, 9.3]`, 45-degree FOV, near/far `0.01/200`,
1440 × 1000 browser viewport, DPR 1, and identical canonical controls. It
captures the actual canvas after hiding overlapping HTML controls for the
screenshot and restores those controls immediately afterward.

### Matched native baseline

The baseline was run on headed Google Chrome 155.0.8059.40 on macOS Darwin
27.0.0 arm64, Node 24.19.0, Three.js r186. `navigator.gpu` was present and the
adapter probe was available. The actual mounted WebGL route reported
`webgl-renderer / webgl2`, no fallback, and zero WebGPU module requests. The
explicit WebGPU route reported `webgpu-renderer / webgpu`, one initialization
attempt, no application fallback, and one lazy WebGPU module request. Hardware
acceleration remains unconfirmed.

The WebGL context reported alpha, premultiplied alpha, and antialias enabled.
The actual WebGPU canvas configuration was `bgra8unorm`, sRGB, premultiplied
alpha, and tone-mapping mode `standard`. Both mounted renderers reported ACES
filmic, exposure 1, and sRGB output. The Observer screenshots have matching
canvas dimensions (514 × 410.39 CSS pixels; 1028 × 820 backing pixels).

| Evidence | WebGL2 | Native WebGPU |
| --- | --- | --- |
| No-overlay subject ROI | 160 distinct color buckets; façade response baseline | Same projected façade, 164 buckets; cross-backend façade ROI MAE 2.09 |
| Clear top-left background, 3,692 pixels | `[248, 250, 252]`, no variation | `[225, 225, 226]`, no variation |
| Clear top-right background, 3,692 pixels | `[248, 250, 252]`, no variation | `[225, 225, 226]`, no variation |
| Ground Glass | Contentful; WebGL 2 RTT | Contentful; same independent WebGL 2 RTT |
| Page/console errors | None | None |

Each clear background region differs by 24.67 mean absolute RGB levels from
the authored `#f8fafc` / WebGL result. The overlay-only comparison subtracts
each backend's own overlay-off image before comparing response, so it isolates
transparent overlay contribution from the pre-existing background mismatch.
The reported mean absolute response difference is over pixels active in either
backend; mask IoU measures spatial agreement, not color agreement.

| Overlay state | Whole-canvas response difference | Projected façade response difference | Clear background response difference |
| --- | ---: | ---: | --- |
| Focus Plane only | 31.62 RGB | 14.83 RGB; mask IoU 0.985 | Top-left 52.00 RGB; top-right no changed pixels |
| Near/Far DOF planes | 13.58 RGB | 14.42 RGB; mask IoU 1.000 | Top-left 12.42; top-right 14.67 RGB |
| Combined | 28.20 RGB | 20.84 RGB; mask IoU 1.000 | Top-left 54.23; top-right 14.67 RGB |

The same-backend captures prove that focus and DOF geometry contributes
pixels. The cross-backend masks largely overlap, while the visible color
response differs. In the screenshots the focus surface remains visible but its
green contribution and compositing are materially different; near/far DOF
surfaces remain visible, but their fill and overlap response is also different.
The source colors and opacities are still the shared authored values: focus
`#16a34a`/0.42, near DOF `#60a5fa`/0.24, and far DOF `#a78bfa`/0.22. Fill
materials retain double-sided rendering, depth testing, disabled depth write,
polygon offset, and `toneMapped={false}`. Outlines retain the same base color,
opacity `min(1, fill opacity + 0.45)`, disabled depth testing/writing, and
`toneMapped={false}`. The combined-state capture includes the actual fill and
outline together; this run does not claim independent per-outline pixel
isolation.

### Renderer-path diagnosis and decision

The pinned Three.js r186 paths explain the measured background difference.
WebGL's `WebGLBackground.setClear()` converts a Color clear to the renderer's
unlit output color space. The common WebGPU `Background.update()` copies the
scene Color in the working color space. With ACES and sRGB output, the common
renderer needs an intermediate frame buffer and applies tone mapping/output
conversion in `_renderOutput()` after scene rendering. That transform therefore
also sees the WebGPU clear and transparent surfaces after they have been
composited. The WebGL program path selects tone mapping per material; the
shared overlay materials explicitly opt out with `toneMapped={false}`. The
common WebGPU output pass does not provide the same per-material output
boundary. The canvas's `standard` mode is recorded in evidence, but its standard
range clamp alone does not explain the sampled in-range gray values.

A temporary `Scene.backgroundNode` derived from the authored Color was tested
and rejected: it draws through the same transformed scene output and left the
background samples unchanged. No backend-specific color/opacity compensation
or runtime renderer change is included. Correcting the remaining mismatch
requires an output/compositing boundary that preserves the WebGL per-material
semantics for WebGPU; that is a larger renderer-pipeline change than this
verification round and needs its own design and review.

| Teaching-use area | Assessment | Evidence |
| --- | --- | --- |
| Architecture geometry and façade | **ACCEPTABLE** | Matched pose; no-overlay façade ROI MAE 2.09; subject and overlay masks align |
| Focus Plane readability | **INVESTIGATE** | Still visible, but façade response differs by 14.83 RGB and clear-background response by 52 RGB |
| Near/Far DOF readability | **INVESTIGATE** | Both surfaces contribute, but façade and background response differ by about 14 RGB |
| Transparent overlap and outlines | **INVESTIGATE** | Combined façade response differs by 20.84 RGB; fills/outlines were captured together |
| Background/material presentation | **INVESTIGATE** | WebGPU clear is consistently 23–27 levels darker per RGB channel in both clear regions |

**PR G decision: NO-GO for claiming Observer background/overlay parity or
expanding native WebGPU rollout.** The native WebGPU path remains correctly
qualified and the existing WebGL baseline is unchanged, but actual framebuffer
evidence confirms an unresolved presentation mismatch. The next work needs a
bounded output/compositing design that can preserve per-material tone-mapping
semantics and then repeat this matched capture. Do not infer a geometry/optics
defect from the color differences. Ground Glass remains the existing
independent WebGL 2 RTT, no optical state or material authoring changed, and
production remains WebGL-only. This finding does not revise PR F's historical
performance measurements.

To reproduce the diagnostic baseline on a native-capable headed Chrome machine:

```bash
OBSERVER_VISUAL_PARITY_REQUIRED=1 \
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 \
OBSERVER_VISUAL_PARITY_BASELINE=1 \
npx playwright test \
  --config=playwright.observer-backend-benchmark.config.ts \
  src/tests/benchmarks/observer-visual-parity.bench.ts --workers=1
```

The baseline mode records the complete acceptance result without failing on
parity differences, provided the mounted backends and captures are valid. Omit
`OBSERVER_VISUAL_PARITY_BASELINE=1` to enforce the strict gate. The strict mode
attaches the same complete JSON before failing and reports every failed
criterion together; a passing baseline capture is not a parity acceptance
result.

### Review-fix round 1 — complete, fail-closed parity evidence

Review found that the strict test stopped at its first background assertion,
looked only at whole-canvas overlay response, and accidentally compared
no-overlay images for every state's background region. The report now separates
three measurements:

1. **Baseline background parity** compares the matched no-overlay WebGL and
   WebGPU captures in regions that are uniform in both baseline images.
2. **State-composited parity** compares the actual selected-state WebGL and
   WebGPU images for no-overlay, focus-only, DOF-only, and combined states.
   Stable background ROI selection still comes only from the no-overlay
   captures; pixel differences use each state's own images.
3. **Overlay contribution response** subtracts each backend's own no-overlay
   image from its enabled image, then compares the resulting response and
   changed-pixel masks. This separates overlay response from the pre-existing
   clear-color mismatch.

The strict JSON records all measured criteria and their values, thresholds,
pass/fail/not-applicable status, and reason before the test fails. Whole canvas,
the projected Architecture Rise façade, and every applicable background ROI
have independent response and mask checks. Required contribution is enforced
in the whole canvas and façade. For the fixed benchmark view, Focus is expected
in the top-left background ROI; DOF-only and combined overlays are expected in
both top corners. The focus top-right ROI has no contribution in either
backend, so it is reported as not applicable. A missing or invalid measurement
fails closed; it is not treated as a non-participating region. Required
WebGL/WebGPU subject, overlay-geometry, restoration, capture-consistency, and
state-ROI records also fail closed when an entire backend record or field is
absent.

The thresholds are recorded in the JSON. Clear baseline background MAE is at
most 4 RGB levels. Composited whole-canvas MAE is at most 16, the façade is at
most 8, and a clean-reference background ROI is at most 10. These broader
composited limits allow small integration changes while keeping the façade
tighter because it carries the teaching geometry. Overlay-response MAE limits
are 10 for whole canvas, 8 for the façade, and 6 for background ROIs; the
façade and background limits are tighter because local contrast and
transparent-plane color are directly relevant to teaching. Changed-pixel mask
IoU must exceed 0.70. Minimum response counts are also explicit for each
region, and every required region must be measurably active in both backends.

The native-required capture now waits for the adapter probe to reach
`available` (or a terminal failure/timeout), then reads the mounted Observer
attributes again. The report includes the pre-wait and final snapshots and
rejects any renderer generation, status, family, execution-backend, request,
fallback, or initialization-attempt change during the wait. The WebGL capture
does not wait for adapter diagnostics.

On the review-fix run, headed Google Chrome 155.0.8059.40 on macOS Darwin
27.0.0 arm64 with Three.js r186 again reported an available API and adapter,
mounted `webgpu-renderer / webgpu`, one initialization attempt, no application
fallback, and one lazy WebGPU module request. Capture validity passed for both
backends: the façade contained 74,120 samples with 160 WebGL and 164 WebGPU
color buckets; Ground Glass remained contentful and WebGL 2-backed; both runs
had no page or console errors. Hardware acceleration remains unconfirmed.
Baseline-only mode passed as a capture while recording strict parity as FAIL.
Strict mode attached an 81-criterion report and failed 26 criteria, including
the 24.67 RGB clear-background MAE, the façade response differences, and the
overlay-response differences listed above. Its failure is the expected
**NO-GO for parity**, not a native WebGPU initialization or capture failure.

The corresponding unit suite exercises whole-canvas pass with façade fail,
multiple simultaneous failures, missing façade evidence, required versus
non-participating background regions, actual selected-state image comparison,
adapter pending-to-available ordering, terminal adapter outcomes, timeout,
and renderer fallback/generation changes. No renderer, material, Ground Glass,
or optical behavior changed in this review fix.

### PR H — Observer output and compositing architecture

PR H inspected the installed Three.js r186 output pipeline and tested a
test-only, material-aware `NodeMaterial.setupOutput()` candidate. In a headed
Chrome 155 native-required run on macOS Darwin 27.0.0 arm64, the mounted
candidate was `webgpu-renderer / webgpu`, with one initialization attempt, no
application fallback, no initialization failure, and `rendererAlpha=true`.
The candidate matched the WebGL fixture's light, gray, and dark background
samples exactly; its lit subject ROI differed by 0.17 RGB MAE, and its
front/oblique transparent-overlay response differed by at most 0.32 RGB MAE.
The depth negative control preserved opaque-subject occlusion. Hardware
acceleration was not independently confirmed.

**Decision: H2 — architecture provisionally viable.** The experiment is a
synthetic fixture, not the Architecture Rise scene. Real-scene material-family,
environment, fallback, and transparent-canvas integration remain unverified;
this does not authorize a wider rollout. The experiment, source analysis,
integration proposal, report, and native screenshots are in
[`OBSERVER_WEBGPU_OUTPUT_COMPOSITING.md`](architecture/OBSERVER_WEBGPU_OUTPUT_COMPOSITING.md)
and its adjacent `observer-output-compositing/` evidence directory. Normal
Observer rendering, production WebGL behavior, Ground Glass, and canonical
optics were unchanged.

### PR I — Architecture Rise material-aware output integration

PR I integrates the PR #255 material-aware output mechanism into the real
Architecture Rise Observer behind the development-only, explicit URL
`observerRenderer=webgpu&observerOutput=material-aware`. Default WebGL,
standard WebGPU, other scenes, and production keep the standard output path.
The candidate configures `linear` and `flat` through React Three Fiber's
Canvas props, because R3F reapplies renderer defaults after an asynchronous
`gl` factory resolves. A material-aware fallback/remount receives fresh
standard Canvas configuration.

On 2026-10-14 UTC, matched headed Google Chrome 155.0.8059.79 runs on macOS
Darwin 27.0 arm64 with Node 24.19.0 and Three.js r186 compared the standard
PR #254 baseline with the candidate using the unchanged 81-criterion
diagnostic, same camera pose, and DPR 1. Both runs used an available WebGPU
adapter, mounted `webgpu-renderer / webgpu`, initialized once, and had no
application fallback. Standard WebGPU retained ACES/sRGB output; the candidate
reported `toneMapping=none`, `outputColorSpace=srgb-linear`, and active
material-aware output. Both runs used implementation commit
`9378969d3396a72c3da93e445b102dbcbaa49694`; the baseline captured at
`2026-10-14T17:15:18.419Z` and recorded 26 expected parity failures, while
the strict candidate run at `2026-10-14T17:15:34.554Z` passed all 78
applicable criteria (3 conditional criteria were not applicable). No threshold
was changed.

| PR #254 measurement | Standard WebGPU | Material-aware candidate |
| --- | ---: | ---: |
| Clear background RGB / MAE | `[225,225,226]` / `24.67` | `[248,250,252]` / `0` |
| No-overlay façade ROI MAE | `2.09` | `1.09` |
| Combined-overlay façade ROI MAE | `21.82` | `0.72` |
| Focus response MAE (canvas / façade) | `31.62` / `14.83` | `0.26` / `0.63` |
| DOF response MAE (canvas / façade) | `13.58` / `14.42` | `0.16` / `0.33` |
| Combined response MAE (canvas / façade) | `28.20` / `20.84` | `0.25` / `0.56` |
| Strict result | 26 failures / 81 | 78 pass, 0 fail, 3 N/A / 81 |

The complete criterion values, backend qualification, camera/canvas state,
run commands, timestamps, and screenshot SHA-256 values are recorded in the
[machine-readable measurement report](architecture/architecture-rise-material-aware-output/measurement-report.json).

The runtime graph contained 393 mesh/material assignments using 73 distinct
material instances. The controller adapted all 73 with zero unsupported
instances: Standard → `MeshStandardNodeMaterial`, Basic →
`MeshBasicNodeMaterial`, and LineBasic → `LineBasicNodeMaterial`. It preserved
Architecture Rise albedo maps as sRGB and normal/roughness maps as linear data,
along with repeats, normal scales, roughness, metalness, transparency, depth
policy, and shadow participation. The scene environment was active at intensity
0.95; one hemisphere and two directional lights remained present, the key
light cast shadows, and the mounted shadow map reported active PCF. The
environment remains scene-radiance input to Standard shading, not a
display-space material map. The full authored and runtime inventory is in
[`architecture-rise-material-aware-output-inventory.md`](architecture/architecture-rise-material-aware-output-inventory.md)
and its adjacent JSON evidence. The measurement report and selected matched
captures are in
[`architecture-rise-material-aware-output/`](architecture/architecture-rise-material-aware-output/).

The candidate report also recorded a visible subject, active environment,
contentful Ground Glass RTT on WebGL 2, and no page or console errors. The
Observer pilot E2E passed all eight ordinary Chromium cases, including default
WebGL, internal WebGL2 fallback, controlled application fallback, candidate
material coverage, fallback policy restoration, and SPA scene/request changes.
A native-required candidate interaction E2E also passed on headed Chrome:
Camera focus, orbit, reset, navigation to Anatomy with standard output, and a
return to Architecture Rise with a fresh material-aware mount all retained the
actual native backend; Ground Glass remained contentful. The Architecture Rise
validation E2E and production-preview checks are recorded in the PR I handoff.
Browser fallback runs are not counted as native evidence. Hardware
acceleration remains unconfirmed.

**Decision: I1 — REAL-SCENE INTEGRATION VALIDATED.** The candidate passes the
unchanged native PR #254 strict gate with complete observed material coverage,
active environment/shadows, and independent Ground Glass readiness. This only
validates an opt-in development Architecture Rise pilot; it does not change
the standard WebGPU path, production WebGL boundary, scene eligibility, or
authorize rollout to other scenes. Selected matched captures and the compact
machine-readable report are in
[`architecture-rise-material-aware-output/`](architecture/architecture-rise-material-aware-output/).

PR #256 review-fix round 1 corrected Basic and LineBasic NodeMaterial output so
ACES Filmic follows the source material's `toneMapped` flag for all supported
families, with sRGB conversion retained when tone mapping is disabled. Focused
r186 graph tests and geometry-derived Basic/LineBasic pixel comparisons on the
native Architecture Rise WebGPU mount passed. The unchanged PR #254 strict
parity gate passed again: 78 applicable pass, 0 fail, and 3 conditional N/A
out of 81. The native backend was `webgpu-renderer / webgpu`; hardware
acceleration remains unconfirmed. See the review-fix evidence in the
[measurement report](architecture/architecture-rise-material-aware-output/measurement-report.json).

### PR J — Architecture Rise material-aware development pilot promotion

PR J makes the already-integrated material-aware output the development pilot
default only when Architecture Rise is explicitly requested with
`observerRenderer=webgpu` and `observerOutput` is omitted. The normal Observer
renderer remains WebGL; Anatomy keeps standard output; other scenes stay
fail-closed; production continues to deny WebGPU. The query
`observerOutput=standard` remains the rollback path.

On 2026-10-15, headed Chrome 155.0.8059.79 on macOS Darwin 27.0 arm64 with
Three.js r186 reported an available adapter and mounted
`webgpu-renderer / webgpu` for the promoted route, with one initialization,
no application fallback, and active material-aware output. The unchanged
strict parity gate passed: 78 applicable criteria passed, none failed, and
three conditional criteria were not applicable. The Architecture Rise scene
validation and Anatomy subject/interaction checks passed; Ground Glass stayed
contentful on its independent WebGL2 RTT. Hardware acceleration remains
unconfirmed.

The ordinary Chromium pilot passed all eight cases, including its internal
WebGL2 fallback and controlled one-shot application-fallback paths. The
native-required pilot passed its five applicable cases; its three intentional
fallback-injection cases are excluded in that mode and were exercised by the
ordinary suite. The production-preview WebGL-only test also passed. Paired
startup/capture, active-gesture cadence, material-controller CPU work, and
sustained resource-lifecycle measurements are recorded in the
[PR J qualification report](benchmarks/ARCHITECTURE_RISE_WEBGPU_OUTPUT_PROMOTION.md).

**Decision: J1 — PROMOTED DEFAULT FOR THE DEVELOPMENT ARCHITECTURE RISE WEBGPU
PILOT.** This changes output policy only for that explicit development request.
It does not promote WebGPU to the normal Observer default, change production,
or authorize another scene or Ground Glass migration.

### PR K — View Camera Anatomy material-aware compatibility audit

PR K records a matched standard-output baseline for the real Anatomy Observer:
13 WebGL2 captures and 13 native `webgpu-renderer / webgpu` captures on headed
Chrome 155, Three.js r186, macOS Darwin 27 arm64. The Anatomy subject-specific
ROI, camera states, Ground Glass RTT, and page-error results are in the
[machine-readable inventory](architecture/view-camera-anatomy-material-inventory.json)
and its matched
[WebGL/native screenshots](architecture/view-camera-anatomy-material-compatibility/).
Native WebGPU completed one initialization with an available adapter and no
application fallback; hardware acceleration remains unconfirmed. Measurements
are descriptive and do not establish visual parity.

Review-fix round 1 recomputed projected regions from current vertex data with
Three.js r186 precise bounds. Only the Front Rise Bellows ROI changed; the
cross-backend ROI MAE moved from 40.063149 to 39.570796 while the captured
images remained byte-identical. The regenerated report records current world
bounds, cached boxes when present, and per-state Bellows geometry versions at
measurement commit `611a58e3cabbc3f312ff355df2f44440790b5522`. The K2
ownership/readiness decision is unchanged; see the review-fix section in the
[Anatomy compatibility audit](architecture/VIEW_CAMERA_ANATOMY_MATERIAL_AWARE_COMPATIBILITY.md).

The registered target shares one module-owned box geometry and five source
materials between separate Observer and Ground Glass groups. The scene also
uses Standard, Basic, and LineBasic camera/helper materials with dynamic Lesson
0 presentation changes. The Architecture Rise controller’s registered-subject
disposal ownership cannot be reused for those shared Anatomy resources.

**Decision: K2 — ARCHITECTURE WORK REQUIRED.** Keep Anatomy on standard WebGPU
output until the output mechanics are separated from scene-specific ownership
and readiness, and an Anatomy adapter owns independent material copies. The
audit did not install that adapter; production WebGL, Architecture Rise, Ground
Glass, and canonical optics are unchanged. Details are in
[`VIEW_CAMERA_ANATOMY_MATERIAL_AWARE_COMPATIBILITY.md`](architecture/VIEW_CAMERA_ANATOMY_MATERIAL_AWARE_COMPATIBILITY.md).

### PR L — Shared Material-Aware Output Core & Ownership Boundary

PR L extracts material signatures, source-to-NodeMaterial tracking, and
renderer-generation-scoped ownership from the Architecture Rise controller.
Architecture Rise keeps its scene-specific readiness, inventory, and
registered-subject ownership adapter. The new tracker keys adapted copies by
source plus explicit owner and never disposes source materials, source
textures, or geometry. An isolated module-shared Anatomy lifecycle test proves
an Observer-owned copy can update from a shared source while the Ground Glass
consumer stays on that source.

The Anatomy runtime is intentionally unchanged: it still uses standard output
for explicit WebGPU and WebGL by default. PR L adds no Anatomy output query or
eligibility. Production remains WebGL-only, and Ground Glass remains an
independent WebGL2 RTT.

The unchanged native PR #254 strict gate passed on headed Chrome 155.0.8059.84,
macOS Darwin 27.0 arm64, Three.js r186: mounted `webgpu-renderer / webgpu`, one
initialization, no fallback, 78 applicable criteria passed, 0 failed, 3
conditional N/A. The standard-output control also mounted native WebGPU.
Ground Glass remained contentful; hardware acceleration remains unconfirmed.
The native paired performance/lifecycle run measured 393 adapted assignments,
about 72.9 source signatures per frame, 8 inventory builds per 143-frame pair,
and stable 73-material ownership during a 121-second sustained workload. The
matched `origin/main` comparison and measurement commit are recorded in the
[shared-core architecture report](architecture/SHARED_MATERIAL_AWARE_OUTPUT_CORE.md).
Against the matched main run, controller callback mean increased by 0.083 ms
(0.868 to 0.951 ms) and sustained mean by 0.082 ms/frame (0.760 to 0.842 ms).
Assignments, signature evaluations, and inventory cadence were effectively
unchanged; the measured increase is under 0.1 ms/frame and is reported as the
cost of source-plus-owner and attachment-lifecycle tracking. No GPU render-time
advantage or general performance conclusion is claimed.

Focused/full unit, typecheck, lint, CSS, build, Observer pilot, Architecture
Rise validation, Anatomy Lesson 0, and production-preview checks passed. The
standard WebGL route and production denial test remain intact.
The Architecture Rise validation suite was repeated on the final source commit
(2/2); ordinary Chromium used Three.js `webgpu-renderer / webgl2-fallback`, so
that run is recorded as fallback regression coverage. Native claims come from
the strict parity and performance/lifecycle runs above.

Review-fix round 1 corrected attachment retention: each renderable/material
slot now expires after two missed traversal frames even while a sibling keeps
its shared material record active. A deterministic two-mesh regression failed
before the correction, and the fixed tests cover 100 mount/unmount cycles,
reordering/replacement, reattachment, owner boundaries, and restoration.
Matched native Chrome runs on the reviewed and corrected PR commits each
processed 393 Architecture Rise assignments and retained 73 adapted materials.
The corrected run recorded 393 live attachments and renderables. Its sustained
controller mean was 0.913 ms/frame versus 0.871 ms/frame on the reviewed head;
the sampled stale sweep averaged 0.0081 ms (0.1 ms p95). The strict native
parity result remained 78 pass, 0 fail, 3 conditional N/A, with contentful
independent Ground Glass. Hardware acceleration remains unconfirmed.
Details and measurement provenance are in the [shared-core architecture
report](architecture/SHARED_MATERIAL_AWARE_OUTPUT_CORE.md).

**Decision: L1 — SHARED CORE VALIDATED; ANATOMY INTEGRATION NOT ENABLED.** The
shared ownership core is validated for the existing Architecture Rise
integration. Anatomy still needs its own readiness, dynamic material/geometry
coverage, and matched visual validation before a material-aware runtime can be
considered.

### PR M — View Camera Anatomy material-aware WebGPU opt-in integration

PR M adds the real View Camera Anatomy material-aware candidate behind the
explicit development route
`/simulator/free/view-camera-anatomy?observerRenderer=webgpu&observerOutput=material-aware`.
The normal Anatomy route remains WebGL; an explicit Anatomy WebGPU request
without the output parameter remains standard. Architecture Rise keeps its
existing material-aware development default, and production remains WebGL-only.

Three headed Chrome 155.0.8059.84 runs on macOS Darwin 27.0 arm64 with Three.js
r186 mounted the candidate as `webgpu-renderer / webgpu`, with an available
adapter, one initialization, active/ready output, zero unsupported assignments,
and no application fallback. Across 13 matched states, the readiness inventory
contained 47 material attachments, 35 distinct/adapted materials, 17 Anatomy
target renderables, and 30 conceptual-camera renderables. Hardware acceleration
remains unconfirmed.

The candidate uses the shared PR #259 tracker with an Anatomy-specific
readiness, inventory, and Observer-owned material-copy adapter. The five
module-shared Anatomy materials and shared BoxGeometry remained attached to
Ground Glass sources; the adapted Observer NodeMaterials stayed distinct.
Ground Glass remained WebGL2 and contentful in all 13 states, with zero RGB
pixel difference across the three WebGL RTT output comparisons. The production
preview denial test passed, and the unchanged Architecture Rise strict parity
gate remained 78 pass / 0 fail / 3 conditional N/A.

Matched object-aligned measurements show mean RGB MAE 19.7513 for WebGL vs
standard native WebGPU and 33.3534 for WebGL vs material-aware native WebGPU
(138 ROIs across 13 states). Repeat captures measured zero same-mode noise in
all three trials; this does not establish cross-backend parity. Highlighted,
dimmed, aperture, bellows, and rear-back states retain significant candidate
differences. **Decision: M2 — OPT-IN IMPLEMENTATION INCOMPLETE.** Keep the
candidate explicit and experimental; PR N default-promotion work requires an
independently reviewed Anatomy parity criterion and resolution of the measured
material/transparency differences. Hardware acceleration remains unconfirmed.
The provenance, state-level ROI values, runtime timing/cadence, source identity,
Ground Glass, negative-control, and lifecycle evidence are in the
[Anatomy material-aware integration report](architecture/VIEW_CAMERA_ANATOMY_MATERIAL_AWARE_INTEGRATION.md)
and its [machine-readable report](architecture/view-camera-anatomy-material-aware/report.json)
and [three-trial summary](architecture/view-camera-anatomy-material-aware/repeat-trials.json).

### PR #260 Review-Fix Round 1 — material-aware readiness recovery

Anatomy keeps its initial 12-second material-aware readiness deadline. After
first activation, every later incomplete attachment interval now receives its
own fixed 12-second recovery window. Returning to ready clears that interval;
the initial mount-to-ready readinessWaitMs diagnostic is unchanged. The
Observer stays hidden while readiness is incomplete, and unsupported materials
or fatal reconciliation errors still take the immediate one-shot fallback.

Native headed Chrome 155.0.8059.84 on macOS Darwin 27.0 arm64, Three.js r186,
verified the Anatomy candidate on webgpu-renderer / webgpu. After 12,103.2 ms
of active time, an actual Lesson 0 transition produced ready → pending →
ready on generation 1, with no fallback and contentful Ground Glass. A
persistent-readiness negative control fell back after 13,015.7 ms, disposed all
35 candidate NodeMaterials, and left zero candidate attachments. An unsupported
material failed immediately after 166.1 ms. Hardware acceleration remains
unconfirmed. Focused timing tests, full unit/static/build checks, ordinary
Observer E2E, native-required Observer E2E, the 13-state Anatomy audit, strict
Architecture Rise parity, Architecture Rise native validation, and production
preview validation passed. **Decision: M2 — OPT-IN IMPLEMENTATION INCOMPLETE**
remains unchanged; this lifecycle correction does not resolve the measured
Anatomy output differences or authorize promotion.

### PR M-INV — Anatomy transparency and material-output root-cause investigation

A native, isolated WebGL / standard WebGPU / material-aware WebGPU fixture
confirmed that output-transform placement can change RGB for transparent Basic,
Standard, and Line materials while measured alpha remains matched. In the
controlled fixture, material-aware output stayed within one RGB code value of
WebGL. The real 13-state Anatomy audit still showed substantial candidate error
in highlighted, dimmed, aperture, bellows, and rear-assembly states; the
candidate remained worse than standard WebGPU in most high-error states.

The real audit also found an unresolved panel-background patch difference:
WebGL and the material-aware candidate matched, while standard WebGPU differed
by RGB MAE 24.67 in the sampled patch. The cause was not isolated. Ground Glass
remained exact and contentful through its independent WebGL2 RTT. View pose,
source material properties, and normalized renderable inputs matched; no
complete Anatomy root cause was established. Hardware acceleration remains
unconfirmed.

**Decision: I2 — PARTIAL ROOT CAUSE.** Keep PR M at **M2 — OPT-IN
IMPLEMENTATION INCOMPLETE**. Continue with a bounded real-scene material and
overlap contribution study before changing the shared output core. The normal
Observer remains WebGL; material-aware Anatomy remains explicit development
opt-in; production remains WebGL-only. See the [full investigation](architecture/VIEW_CAMERA_ANATOMY_TRANSPARENCY_INVESTIGATION.md)
and [machine-readable evidence](architecture/anatomy-transparency-investigation/report.json).

### PR M-INV2 — real Anatomy renderable contribution and transparency isolation

The follow-up used the actual Anatomy Observer across the same 13 teaching
states in WebGL, standard native WebGPU, and material-aware native WebGPU. On
Chrome 155.0.8059.84 / macOS Darwin 27.0 arm64 / Three.js r186, both WebGPU
modes mounted `webgpu-renderer / webgpu` with one initialization, no
initialization failure, and no application fallback. Material-aware output was
active and ready. All modes completed 13 captures and 16 bounded visibility
transactions with zero page errors; the independent Ground Glass WebGL2 RTT
remained contentful, and visibility restoration matched the captured frame.
Hardware acceleration remains unconfirmed.

The initial scene contained 47 visible renderables, including two explicit
transparent surfaces. Their combined visibility differential changed 1,012
pixels in WebGL, 979 in standard WebGPU, and 1,015 in material-aware WebGPU;
the measured whole-frame RGB MAE contributions were 0.1394, 0.0995, and
0.1395. No initial projected-rectangle overlap candidates met the T5 rule, so
no pairwise transparency interaction mask was generated. These results confirm
visible contributions, not an alpha-blending defect.

Excluding dimmed camera-part groups reduced the matched WebGL-versus-candidate
whole-frame MAE from 6.082 to 0.018 (Front Standard), 9.046 to 0.013 (Lens and
Board), 11.029 to 0.011 (Smaller Aperture), and 9.222 to 1.054 (Bellows
Highlighted). This associates those differences with the changed renderable
sets but does not isolate material output, transparency, depth, or shadow
causality.

A fixed 32×32 top-left probe was unchanged within each mode after all audited
renderables were hidden. Its mean RGB was `[244.50, 246.90, 249.11]` for
WebGL and material-aware WebGPU, versus `[221.89, 222.32, 223.54]` for standard
WebGPU; WebGL-versus-standard MAE in the patch was 24.2542. `SceneRenderer`
attaches `#f8fafc` as the scene background, while the material-aware controller
uses an sRGB-converted background node for that same color. Renderer background
output, canvas alpha, and browser composition were not independently varied;
the source paths are not a root-cause proof.

**Decision: I2 — PARTIAL ROOT CAUSE.** Keep Anatomy at **M2 — OPT-IN
IMPLEMENTATION INCOMPLETE**. The next bounded work should isolate dimmed-part
output behavior and standard-WebGPU background output separately. Do not
promote the candidate or change the shared output implementation from these
visibility differentials alone. See the [full M-INV2 report](architecture/VIEW_CAMERA_ANATOMY_RENDERABLE_CONTRIBUTION_INVESTIGATION.md)
and [machine-readable evidence with representative captures](architecture/anatomy-renderable-contribution-investigation/report.json).
