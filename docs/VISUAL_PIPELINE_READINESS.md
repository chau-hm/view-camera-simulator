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
unchanged. Architecture Rise's procedural environment/PMREM path remains
WebGL-specific and is not included in the pilot. This evidence validates only
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
procedural environment requirement and the current
`PMREMGenerator(WebGLRenderer)` constraint. It remains ineligible while that
environment path is WebGL-specific. Unknown and unevaluated scenes remain
WebGPU-ineligible without changing their normal WebGL path.

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
availability, renderer family, and execution backend remain distinct. The
request/attempt identity keys the Canvas boundary and capability report, while
request-scoped failure and initialization state plus stale-callback guards
prevent prior scene or fallback evidence from being reused after same-route
scene changes. PR #248's development-only Anatomy test events are attached to
their own Observer wrapper and are removed with their scene subject or controls.

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
physical exposure or metering, or WebGPU-specific rendering. PR K found that the
bounded standard and physical material candidates did not materially resolve the
dark glazing at normal scale; its best candidate is classified **MATERIAL
RESPONSE — negligible**.

Select further work from observed visual and teaching limitations rather than
following a mandatory renderer-migration sequence. WebGPU remains conditional on
a demonstrated backend-specific requirement.
