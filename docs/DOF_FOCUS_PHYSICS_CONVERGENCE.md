# DOF / Focus Physics Convergence Diagnosis

## 1. Status and snapshot

- Audit base: origin/main at f2ae64c9fe0e699c971600c9e688a45e74a7c2e0
- Predecessor: PR #203, architecture audit before renderer migration
- Physical Ground Glass baseline: PR #204 is already included in the pinned base
- Branch: docs/dof-focus-physics-convergence
- Scope: documentation and source/test inspection only
- Production files changed: none
- Test files changed: none

The worktree was created from the pinned origin/main commit. This diagnosis records behavior at that snapshot; it does not change or recalibrate it.

## 2. Executive summary

The active focus and blur paths already share one physical model across the public scenes:

1. Scene configuration and CameraState resolve to actual lens and film geometry.
2. **deriveOpticsState()** is the canonical producer of that geometry, the focus plane, and target metrics.
3. **calculateDepthOfField()** uses the thin-lens hyperfocal model to derive near/far subject-space limits and, where geometry permits, focus-related planes.
4. CPU target scoring and active Ground Glass rendering each evaluate the same physical aperture-to-film footprint contract from actual lens/film geometry.
5. UI sharpness percentages and renderer pixels are mappings of those physical results.

The meaningful exceptions are upstream geometry or teaching adapters. Focus Fundamentals intentionally solves front-standard and rear-standard movements differently, then supplies the solved positions to the common downstream optics. Scene configuration also selects a film-depth datum. Those are physical input/configuration semantics, not competing aperture equations.

The main findings on the suspicious paths are:

- **Table Tilt tolerance:** a scene-selected model-classification threshold. It decides whether to construct a Scheimpflug focus/DOF plane or the parallel fallback. It does not alter the constructed lens/film planes or the active GPU footprint. The strict threshold preserves a 0.01° test state, although the public tilt step is 0.1°.
- **Table Tilt and Shelf Swing groundGlassDofModel:** mode metadata reaches debug output, uniform preparation, an unused shader uniform, CPU diagnostic sampling, and runtime metadata. The active shader does not read dofMode and calculates its footprint from lens and film geometry. The mode can affect CPU preflight validation when derived planes are missing, but it does not select a different valid-state GPU blur equation.
- **Architecture Rise DOF branch:** current focus semantics already make focusDistanceMm equal to lens-to-focus-plane distance along the optical axis. The direct-U branch is algebraically equivalent to the general projection on valid states. Its history and tests should be preserved when considering consolidation, but no current evidence shows a different physical meaning.

**Conclusion:** one common physical aperture/film footprint kernel already serves all 15 registered scenes. No physics cleanup is required before starting renderer-backend work. The backend contract should explicitly preserve geometry inputs, signed film-space CoC, oriented footprint axes, and millimetre-to-sampled-film mapping. CPU/GPU numerical parity remains unproven by real GPU readback and should be checked as part of backend work.

## 3. Scope and non-goals

This is a source and test audit, not a new optics derivation or implementation change. It covers focus inputs, lens and film placement, focus/DOF planes, target CoC, active RTT shading, legacy helpers, mode fields, scene presentation settings, and their current consumers.

Out of scope: changing the established physical blur scale; altering camera assembly hierarchy, raw/upright orientation, lens coverage, scene calibration, task policy, render-target ownership, or shader implementation; and designing or implementing WebGPU.

## 4. Target physical principle

The current code supports this target model:

> Scene configuration defines physical starting conditions and what the learner can control. Canonical camera, lens, film, aperture, and object geometry determine focus and blur. Renderers project that state. Teaching and display choices do not silently redefine the optical result.

A scene-specific input adapter is appropriate when the learner is controlling a genuinely different physical quantity or standard. A scene-specific display choice may also be appropriate, but it should remain presentation state. An ID-only branch that selects an optical threshold deserves explicit evidence and a regression contract.

## 5. Current focus/DOF authority map

| Concept | Authority | Produced by | Consumed by | Physical / presentation / diagnostic | Scene-specific? | Notes |
|---|---|---|---|---|---|---|
| Focus and movement inputs | CameraState plus scene capability/configuration | Store, route preset, public controls | deriveOpticsState() | Physical inputs and input semantics | Values/ranges differ; equations mostly do not | Units remain mm and degrees. |
| Finite-focus baseline | SceneFiniteFocusStrategy | Scene definitions and calculateFiniteFocusFilmPlane() | Canonical camera geometry | Physical starting geometry | Yes, explicit configuration | All 12 strategy scenes use rear-standard thin lens and lens-to-focus-plane distance. Two select rear-standard Z; ten select optical-axis-conjugate film depth. |
| Selectable standard focus | focusStandardCapability plus focusDistanceMm | resolveFocusFundamentalsFocusing() | Canonical lens and film plane construction | Input-semantic adapter and physical geometry | Focus Fundamentals and View Camera Anatomy | Front/rear movement differs physically; the downstream model is shared. |
| Lens/film planes and camera pose | deriveOpticsState() | Scene config, CameraState, geometry helpers | Focus plane, target metrics, RTT uniforms | Canonical physical authority | No competing scene equation | Includes actual lens center, normal, aperture basis, film plane, basis, and rig transform. |
| Focus point and focus plane | calculateFocusPoint() and calculateFocusPlaneWithFallback() inside deriveOpticsState() | Solved geometry and selected focus depth | Scene/geometry overlays, diagnostics, derived DOF construction | Derived physical geometry | Table Tilt changes parallel classification; Focus Fundamentals adapts focus depth | The plane is built through the focus point, either parallel to film or through the lens/film hinge. |
| Near/far DOF limits and planes | calculateDepthOfField() | f, aperture N, acceptable CoC c, focus object distance U, optional lens/film/hinge geometry | Overlays, diagnostics, legacy wedge helpers, uniform validation | Derived physical limits and plane representation | Two explicit U branches; otherwise shared | This function does not calculate active per-pixel Ground Glass blur. |
| Target point/patch CoC | computePhysicalBlurFootprint() called by calculateSharpness() | Same canonical lens/film geometry, target sample, f and N | Focus Distribution, readouts, task evaluation, macro teaching | CPU physical evaluation, then presentation | No custom scene CoC threshold | Returns equivalent physical CoC; score is a learner-facing mapping. |
| Per-pixel RTT CoC/ellipse | calculatePhysicalBlurFootprintFromWorldPosition() in shared GLSL | Reconstructed world point and canonical lens/film geometry, f and N | CoC intermediate and gather | Renderer physical evaluation | No | Produces signed CoC diameter and oriented local-affine ellipse in film-space mm. |
| RTT raster and preview | GroundGlassRTT | Physical footprint, sampled-film dimensions, quality profile, preview mode | Final Ground Glass display | Renderer representation and presentation | Quality/display settings only | Direct mm-to-pixel conversion; caps apply after the physical radius is calculated. |
| Sharpness percentage and status | physicalSharpness.ts plus strict resolvers | Physical target CoC | Focus Distribution, task/readout UI | Presentation of physical metric | Table Tilt selects point or patch, not threshold | Shared acceptable CoC is 0.1 mm; sharp/acceptable status cutoffs are shared. |
| groundGlassDofModel | DerivedOpticsState.diagnostics, sometimes rewritten by display settings | Optics derivation or Shelf Swing display adapter | Debug panel, uniform preparation, CPU helper, runtime metadata, tests | Diagnostic/compatibility metadata | Table Tilt and Shelf Swing | Active GLSL contains no read of dofMode. |
| Coverage | DerivedLensCoverage and GroundGlassCoverageState | Lens catalog and actual film/lens geometry | Coverage presentation and renderer masks | Separate physical/presentation contracts | Lens profile and geometry vary | Does not own blur CoC or DOF. |

### Scene focus input configuration

All twelve scenes with finiteFocusStrategy use kind rear-standard-thin-lens, lens datum baseline-origin, and focusDistanceReference lens-to-focus-plane. The strategy changes how baseline film depth is placed after solving the same thin-lens image distance V = fU / (U - f).

| Scene | Film depth reference | Consequence |
|---|---|---|
| Architecture Rise | rear-standard-z | Keeps the scene's rear-standard Z datum fixed. |
| Understanding Camera Movements | rear-standard-z | Keeps the rear-standard Z datum fixed while this lesson isolates camera movements. |
| Table Tilt | optical-axis-conjugate | Places film depth at the on-axis conjugate for the configured lens normal. |
| Shelf Swing | optical-axis-conjugate | Same shared thin-lens geometry; swing is actual lens-plane geometry. |
| Oblique Tabletop | optical-axis-conjugate | Same shared thin-lens geometry for compound focus calibration. |
| Oblique Architecture | optical-axis-conjugate | Same shared thin-lens geometry for scene calibration. |
| Architecture Foreground | optical-axis-conjugate | Same shared thin-lens geometry for scene calibration. |
| Interior Corner | optical-axis-conjugate | Same shared thin-lens geometry for scene calibration. |
| Macro Bellows Extension | optical-axis-conjugate | Same shared thin-lens geometry at close focus. |
| Macro Depth of Field | optical-axis-conjugate | Same shared thin-lens geometry at close focus. |
| Macro Oblique Plane | optical-axis-conjugate | Same shared thin-lens geometry with actual front tilt. |
| Macro Compound Movements | optical-axis-conjugate | Same shared thin-lens geometry with actual tilt and swing. |

The remaining three scenes do not use finiteFocusStrategy: Focus Fundamentals and View Camera Anatomy use focusStandardCapability; Mirror Shift locks focus and aperture while teaching rig translation.

## 6. Physical focus dataflow

The canonical sequence is scene semantics → solved camera geometry → focus plane → DOF limits/planes and physical target metrics. The renderer consumes the same solved geometry for its per-fragment evaluation.

~~~mermaid
flowchart LR
  subgraph Inputs["Input semantics and physical starting conditions"]
    CS["CameraState: focus depth, movements, f, N"]
    CFG["Scene config: finiteFocusStrategy or focusStandardCapability"]
    LES["Camera movement lesson state"]
    CS --> ADAPT["Input-semantic adapters"]
    CFG --> ADAPT
    LES --> ADAPT
  end
  subgraph Core["Canonical physical authority"]
    ADAPT --> GEOM["deriveOpticsState: lens/film planes and camera pose"]
    GEOM --> FP["Focus point and focus plane"]
    GEOM --> DOF["calculateDepthOfField: U limits and near/far planes"]
    FP --> DOF
    GEOM --> TARGET["calculateSharpness: physical target/patch footprint"]
    FP --> OVER["Focus and DOF overlays"]
  end
  subgraph Consumers["Renderer evaluation and presentation"]
    GEOM --> RTT["RTT shader evaluates per-pixel physical footprint"]
    TARGET --> READOUT["Physical sharpness and Focus Distribution"]
    TARGET --> TASK["Guided-task physical criteria"]
    DOF --> OVER
    RTT --> GG["Millimetre-to-sampled-film pixels and gather"]
    GG --> PREVIEW["Raw/Upright Ground Glass presentation"]
  end
~~~

### Focus input adapters

calculateFiniteFocusFilmPlane() resolves the finite thin-lens film position from U and the declared film datum. It does not make a different lens equation for each scene.

Focus Fundamentals is the one explicit front/rear teaching solver. Its control value S is focus-plane depth from a rear datum. Front focus solves U and V and moves the lens while leaving film at the datum. Rear focus holds the lens at the reference front-focused position, derives U = S - lensZ, solves V, and moves film. Infinity mode has its own limiting positions. Invalid rear requests fall back to front geometry and report the fallback.

View Camera Anatomy uses that same solver with placement scene-baseline: it translates the complete solved lens/film coordinates into the scene's existing camera datum. Translating both planes preserves their optical separation. This is a coordinate-placement adapter, not a second focus model.

Understanding Camera Movements materializes its continuous lesson state into canonical standard movements and rig pose before optical derivation. The rig/viewpoint position changes real world geometry; the thin-lens and aperture/film calculations remain shared. Mirror Shift likewise translates the camera rig through its enabled capability while its public focus and aperture controls are fixed.

## 7. Active Ground Glass physical dataflow

Every registered scene ID is in RTT_SCENES; therefore the normal public Ground Glass for the current 15 scenes takes the RTT path. GroundGlassRenderer retains earlier DOM/legacy pipeline code, but for an RTT scene it keeps only presentation metadata and does not render the legacy focus ring.

~~~mermaid
flowchart LR
  subgraph Core["Core canonical physical state"]
    GEO["Lens center, lens plane/basis, film plane/basis, f, N"]
  end
  subgraph RenderEval["Renderer physical evaluation"]
    DEPTH["RTT scene depth sample"] --> WORLD["Reconstruct world position"]
    GEO --> FOOT["Project ideal thin-lens image/aperture onto actual film"]
    WORLD --> FOOT
    FOOT --> MM["Signed equivalent CoC and oriented ellipse in film mm"]
  end
  subgraph Representation["Renderer representation"]
    MM --> STORE["Half-float mm or encoded-byte storage"]
    STORE --> DECODE["Decode physical mm"]
    DECODE --> MAP["Map radii by render pixels / sampled film mm"]
    CAP["Gather-radius cap after physical conversion"] --> GATHER["Gather and composite"]
    MAP --> GATHER
  end
  subgraph Presentation["Display"]
    GATHER --> ORIENT["Raw/Upright orientation and crop"]
    ORIENT --> VIEW["Ground Glass preview"]
  end
~~~

For each pixel, the active path is:

1. The RTT captures color and depth from the registered scene.
2. reconstructWorldPosition() uses that depth plus inverse projection and camera-world matrices.
3. The physical footprint routine uses canonical lens center/normal/basis, film point/normal/basis, focal length, and f-number. It constructs ideal image geometry and maps the circular aperture through the actual film plane.
4. It stores signed equivalent CoC diameter, ellipse semi-axes, and orientation in millimetres (half-float directly; byte storage encodes the same physical values).
5. The gather decodes millimetres and maps each axis with render width or height divided by sampled film width or height. The focus loupe magnifies because the sampled-film crop is smaller.
6. The renderer clamps gather extent to the configured maximum and composites the image. The cap is a display/rendering bound after physics.

No active step normalizes acceptable CoC to one CSS pixel or multiplies by a fixed scene gain. circleOfConfusionMm remains relevant to near/far DOF and teaching sharpness, but the active physical footprint equation derives actual blur from geometry and aperture.

## 8. Focus/DOF field ownership

| Field | Owner and producer | Meaning and consumers | Physical or presentation status | Active GPU physical blur? | Naming assessment |
|---|---|---|---|---|---|
| focusPlaneModel | calculateFocusPlaneWithFallback(); stored in diagnostics | Reports parallel versus Scheimpflug focus-plane construction. Overlay/debug consumers inspect the corresponding focusPlane. | Derived plane classification | No direct shader equation dependency | Meaning is still reasonably accurate. |
| depthOfFieldModel | calculateDepthOfField(); stored in diagnostics | Reports whether near/far limits use parallel planes or derived Scheimpflug wedge construction. Debug and compatibility helpers read it. | Derived plane classification | No | Still useful to describe constructed DOF bounds, not blur kernel. |
| groundGlassDofModel | deriveOpticsState(); Shelf display resolver may overwrite | Selects legacy CPU sample mode, is copied to debug/runtime metadata, and becomes numeric uniform state. | Diagnostic/compatibility mode with validation effect | No valid-state equation branch; indirect preflight validation only | Name overstates current active RTT influence. |
| planeMode | groundGlassVisualSettings.ts scene renderer settings | Requests automatic or derived-plane diagnostic mode for display optics state. | Renderer presentation policy | No | Belongs with renderer presentation settings. |
| nearU / farU | calculateDepthOfField() | Thin-lens subject-space bounds from f, N, c, U; may include farU = Infinity and a renderer-friendly visual cap plane. | Derived physical scalar limits | No | Readable diagnostic outputs. |
| Physical target CoC | computePhysicalBlurFootprint() through calculateSharpness() | Equivalent CoC at a target point or worst sample of a patch; score and task/readout derive from it. | CPU physical evaluation, then presentation | Not a per-pixel shader call; same geometry contract | Physical CoC is clear; score is not CoC. |
| Per-pixel RTT signed CoC | calculatePhysicalBlurFootprintFromWorldPosition() | Signed geometric equivalent CoC and local affine footprint for each depth sample. | Renderer physical evaluation | Yes | Physical meaning is explicit in shader comments and storage contract. |

Do not treat focusPlaneModel, depthOfFieldModel, groundGlassDofModel, and planeMode as synonyms because each says “plane” or “model.” They have separate producers and consumers.

### Concrete groundGlassDofModel consumer graph

~~~mermaid
flowchart LR
  DER["deriveOpticsState diagnostics"]
  DISP["Shelf planeMode display resolver"]
  MODE["groundGlassDofModel"]
  DEBUG["OpticalDebugPanel label"]
  CPU["groundGlassBlur CPU sample branch"]
  UNIFORM["createGroundGlassDofUniformState mode"]
  VALID["Require focus and near planes when mode is derived"]
  APPLY["Write material dofMode uniform"]
  RUNTIME["RTT runtime info and data attribute"]
  GLSL["GLSL physical CoC and footprint"]
  TESTS["Mode and uniform tests"]

  DER --> MODE
  DISP --> MODE
  MODE --> DEBUG
  MODE --> CPU
  MODE --> UNIFORM
  UNIFORM --> VALID
  UNIFORM --> APPLY
  UNIFORM --> RUNTIME
  APPLY -. "declared uniform; no GLSL read" .-> GLSL
  MODE --> TESTS
~~~

The shared shader source declares dofMode and applyGroundGlassDofUniformState() writes it, but repository-wide search finds no shader read of the value. The active CoC shader calls calculatePhysicalBlurFootprintFromWorldPosition() directly. Focus/near/far planes and wedge helpers remain declared in shader source, but the active CoC entry point does not call the legacy wedge functions. Tests that assert helper text exists prove source presence, not runtime use.

createGroundGlassDofUniformState() maps the mode to 0 or 1. Mode 1 requires finite focus and near planes during CPU-side uniform preparation; then mode and plane uniforms are applied and runtime information reports a string mode. For valid canonical scenes, changing the mode does not change the physical CoC equation. For malformed/incomplete state without those planes, the mode can indirectly reject uniform preparation. This is a validation/diagnostics contract, not a second valid-state GPU blur equation.

## 9. Complete scene-specific branch inventory

The repository search covered scene-ID comparisons and capability/configuration branches in core optics, render, state, scene definitions, controls, overlays, target projection, and teaching code. The first table lists every registered scene's focus setup; the second lists special branches that can change or present focus/DOF output.

### Registered scene focus setup

| Scene ID | Focus setup at the pinned base |
|---|---|
| architecture-rise | Rear-standard thin lens; lens-to-focus-plane U; rear-standard-Z film datum; also has a redundant explicit U branch below. |
| understanding-camera-movements | Rear-standard thin lens; rear-standard-Z datum; movement state materializes into real canonical geometry; focus/aperture controls are fixed for the lesson. |
| table-tilt | Rear-standard thin lens; optical-axis-conjugate film datum; stricter lens/film near-parallel policy and derived-plane mode. |
| shelf-swing | Rear-standard thin lens; optical-axis-conjugate film datum; renderer selects derived-plane mode for metadata/legacy compatibility. |
| oblique-tabletop | Rear-standard thin lens; optical-axis-conjugate datum; scene calibration/targets only, common equations. |
| oblique-architecture | Rear-standard thin lens; optical-axis-conjugate datum; scene calibration/targets only, common equations. |
| architecture-foreground | Rear-standard thin lens; optical-axis-conjugate datum; scene calibration/targets only, common equations. |
| interior-corner | Rear-standard thin lens; optical-axis-conjugate datum; scene calibration/targets only, common equations. |
| macro-bellows-extension | Rear-standard thin lens; optical-axis-conjugate datum; macro metrics/teaching consume common physical results. |
| macro-depth-of-field | Rear-standard thin lens; optical-axis-conjugate datum; macro DOF teaching consumes common physical patch metrics. |
| macro-oblique-plane | Rear-standard thin lens; optical-axis-conjugate datum; actual front tilt and common focus/blur equations. |
| macro-compound-movements | Rear-standard thin lens; optical-axis-conjugate datum; actual tilt+swing and common focus/blur equations. |
| focus-fundamentals-two-targets | Selectable front/rear standard capability; rear-datum depth S; shared physical solver. |
| view-camera-anatomy | Selectable front/rear standard capability with scene-baseline placement; shared physical solver. |
| mirror-shift | Fixed focus and aperture; translates the complete camera rig for a viewpoint/mirror lesson. |

### Focus/DOF branch inventory

| Scene | Code location | Trigger | Input meaning | Physical output changed | Active GPU blur affected? | CPU diagnostic affected? | Learner-visible effect | Classification | Evidence | Recommendation |
|---|---|---|---|---|---|---|---|---|---|---|
| Understanding Camera Movements | deriveOpticsState.ts and appStore.ts lesson materializers | Scene ID is understanding-camera-movements and lesson state exists | Continuous lesson movement/viewpoint state | Canonical front/rear movements, camera rig pose, therefore actual world geometry | Yes, through changed geometry; no separate blur equation | Yes, same physical inputs and derived planes | Camera pose and image change with lesson movement; focus/aperture remain locked | I, with physical geometry outputs | cameraMovementLessonState.ts, understandingCameraMovements.test.ts, cameraMovementsRtt.test.ts | Keep lesson-state adapter; preserve canonical geometry ownership. |
| Mirror Shift | appStore.ts rig placement; capability handling in deriveOpticsState.ts | Mirror Shift capability and scene placement | Lateral camera-rig translation | Camera rig/world position; no focus or aperture solution changes | Yes, scene projection changes from actual pose; blur model unchanged | Same geometry-based evaluation if sampled | Learner sees changed viewpoint/reflection | P for physical pose, not distinct optics | mirrorShiftGeometry.test.ts, mirrorShiftTask.test.ts | Keep actual rig translation; no focus/DOF cleanup indicated. |
| Focus Fundamentals | focusFundamentalsFocusing.ts, deriveOpticsState.ts | focusStandardCapability.enabled; state selects front or rear | S: subject/focus-plane depth from rear datum | Solved lens Z and film Z differ by chosen standard; resolved U and V feed common geometry | Yes, because actual lens/film geometry changes; common kernel | Yes, target samples consume solved geometry | Front/rear standard movement and changing image geometry are the lesson | I; necessary physical input adapter | focusFundamentalsFocusing.test.ts, focusFundamentalsSelectableFocus.test.tsx, rearStandardFrame.test.ts | Keep physical front/rear distinction; keep both strategies converging before common optics. |
| View Camera Anatomy | focusStandardCapability plus resolveSceneRelativeSelectableFocus() | Capability placement scene-baseline | Same rear-datum S semantics, translated to scene datum | Translates both solved lens and film coordinates together | Yes, through translated geometry | Same | Camera parts and finite focus remain registered in anatomy layout | I for coordinates, T for layout | sceneDefinitions.test.ts, deriveOpticsState.test.ts | Keep coordinate adapter while anatomy scene uses it. |
| Focus Fundamentals invalid fallback | baseFallbackState() in deriveOpticsState.ts | Invalid input/geometry triggers fallback | Requested focus standard is retained separately; fallback diagnostic resolves to front | Fallback-only diagnostic/geometry, not valid-state solver output | Only fallback geometry can reach rendering; no valid-state mode distinction | Fallback state and diagnostic fields | Error/fallback diagnostics; no normal front/rear transition | C/L | deriveOpticsState.test.ts, focusFundamentalsFocusing.test.ts | Keep fail-closed behavior; do not count as a second model. |
| Table Tilt lens/film tolerance | deriveLensFilmRelationship() called from deriveOpticsState.ts; constants.ts | Table Tilt selects 1e-6°; other scenes select 0.1° | No input value changes; compares actual lens/film normal angle | isParallel, hinge-line availability, focus-plane classification/normal and optional DOF plane construction | No CoC equation change for fixed geometry; may change derived planes passed through validation/diagnostics | Yes for legacy wedge samples and plane metadata | Focus/DOF overlay may be Scheimpflug rather than parallel | T/model-selection tolerance, not a distinct physical law | tableTiltOptics.test.ts; rearStandardFrame.test.ts; commit 6e0fb2c | Do not change here. If generalized, make tolerance an explicit geometry/model policy and retain plane-continuity evidence. |
| Table Tilt groundGlassDofModel | deriveOpticsState.ts finite and fallback diagnostics | isTableTilt or DOF model is scheimpflug-wedge; Table Tilt is always marked derived for finite states | No new focus input meaning | Diagnostic model field and uniform mode; no lens/film point movement | No valid-state equation change; uniform preflight still requires planes in derived mode | Legacy CPU sampler selects wedge if explicitly called | Debug/runtime mode metadata; no learner metric uses this mode | C/L metadata following a presentation model | tableTiltOptics.test.ts, createGroundGlassDofUniformState.ts, shader search | Keep until mode/validation consumers are deliberately retired; not physical authority. |
| Shelf Swing display mode | groundGlassVisualSettings.ts and resolveGroundGlassDisplayOpticsState() | Scene ID shelf-swing, finite focus, focus and near planes available | Same lens-to-focus-plane U as other rear-standard scenes | Copies renderer-selected mode into diagnostics only | No active footprint equation change | Direct groundGlassBlur calls would select wedge; current public caller does not sample Shelf | RTT data-rtt-dof-mode and developer/debug metadata; image equation unchanged | T for renderer policy; C for renderer-to-domain-diagnostics copy | Settings/unit tests; active shader has no dofMode read; RTT runtime metadata | Do not remove here. If removed later, verify zero and calibrated swing through public controls and real RTT. |
| Architecture Rise | deriveOpticsState.ts finite DOF branch | Scene ID architecture-rise | Comment and scene config define focusDistanceMm as U | Recomputes DOF U directly instead of projecting focus-plane point | No difference on valid states: focusPlane.point lies on focus ray at configured distance, so generic dot product yields same U | DOF plane model feeds diagnostics, but U is equivalent | Same focus plane, near/far limits and physical target CoC for matching inputs | C, historical branch with no current distinct semantics | deriveOpticsState.test.ts, architectureRiseFocusChart.test.ts, scene finiteFocusStrategy; branch is present in 405ac82 | Candidate for equivalence-tested consolidation; not a pre-backend blocker. |
| Table Tilt readout policy | SimulatorWorkspace.tsx | Table Tilt in free practice selects point; other contexts use patch | Chooses what target sample learner reads | No physical value; selects point vs patch physical metric | No | No, both physical metrics are computed | Target readout can show point sharpness in free mode; other readouts use patch | T | SimulatorWorkspace.tsx, physicalFocusReadout.test.ts | Keep as teaching/readout policy; do not alter CoC threshold. |
| Focus Fundamentals target projection | groundGlassTargetProjection.ts | Scene ID focus-fundamentals-two-targets | Target marker uses scene baseline thin-lens projection | Target-marker UV/visibility only; physical geometry and target CoC unchanged | No footprint change | No metric change | Marker placement follows lesson's baseline projection convention | T | groundGlassFilmPlaneProjection.test.ts, focusFundamentalsPerspectiveMetric.test.ts | Keep separate from physical focus and blur. |
| Table Tilt overlays | SceneRenderer.tsx, scenePlaneOverlayGeometry.ts, scheimpflugSceneSupport.ts, geometryPresentationProfiles.ts, OpticalSectionDiagram.tsx | Scene ID table-tilt; overlay endpoint and diagram label branches | No focus input change | Overlay extent/label presentation only | No | No | Plane polygon endpoint and focus label use Table Tilt framing | T | scenePlaneOverlayGeometry.test.ts, tableTiltOptics.test.ts | Keep as display policy unless shared overlay contract is introduced. |
| Shelf Swing renderer-to-diagnostics copy | resolveGroundGlassDisplayOpticsState() in groundGlassVisualSettings.ts | planeMode is derived-planes, finite focus and planes present | No physical value change | Replaces one diagnostic field on copied display state | No equation change; can change derived-mode plane validation | Can change legacy CPU sampler branch if called with copied state | Runtime/debug metadata only on current public routes | C/T ownership leak | groundGlassVisualSettings.test.ts; no Shelf runtime caller for sampleGroundGlassBlurAtWorldPoint() | Optional first cleanup candidate; compare actual public RTT before deleting. |
| Scene-specific gather caps | groundGlassVisualSettings.ts, createGroundGlassDofUniformState.ts, active gather shader | Table Tilt 42 px; Shelf Swing 42 px; Oblique Tabletop 48 px; Oblique Architecture 48 px; Architecture Foreground 48 px; default 60 px | No input change | Caps raster gather radius only after physical footprint conversion | Yes only after rendered radius reaches cap; physical CoC/ellipse calculation unchanged | CPU diagnostic helper also receives scene cap at its debug caller | Very large blur saturates at scene gather limit | T, renderer quality/display bound | groundGlassVisualSettings.test.ts, groundGlassPhysicalScale.test.ts, groundGlassDofStability.test.ts | Keep out of optical model. Revisit only with renderer quality study. |
| Geometry scene profiles | geometryPresentationProfiles.ts, OpticalSectionDiagram.tsx, GeometryViewport.tsx | IDs include Focus Fundamentals, Table Tilt, Shelf Swing, Oblique Tabletop, Oblique Architecture, Mirror Shift, Interior Corner | No physical input change | Diagram window, view defaults, labels, fill and framing | No | No | Changes 2D geometry framing and teaching labels | T | geometryPresentationProfiles.test.ts, geometryViewport tests | Keep presentation independent from physical geometry. |
| Macro teaching stages | macro teaching capability resolvers and workspace | Capability kind and target IDs; not scene-ID optics branches | Interprets canonical U, aperture, magnification, bellows or physical patch metrics | Stage/status interpretation only; no focus, DOF or CoC re-solve | No | No | Macro readout explains focus/stopping-down/scale stage | T over shared physical outputs | macroDepthOfFieldTeaching.test.ts, macroObliquePlaneTeaching.test.ts, macroCompoundMovementsTeaching.test.ts, macroBellowsExtensionTeaching.test.ts | Keep teaching thresholds separate from physical CoC. |

No custom scene-specific acceptable CoC threshold was found. Task minimum-sharpness requirements may vary by guided task, but they compare shared physicalPatchSharpness and do not change its physical threshold.

## 10. Table Tilt deep dive

### 10.1 Near-parallel tolerance

deriveOpticsState() passes the Table Tilt identity to deriveLensFilmRelationship() in fallback, infinity, and finite paths. The helper compares the acute angle between actual lens and film normals. The general threshold is 0.1°; Table Tilt uses 1e-6°. The comparison is strict less-than. Plane intersection has a separate numerical epsilon.

Answers to the required questions:

1. **Why the exception exists:** current tests require a 0.01° relative Table Tilt to be represented as nonparallel, preserving a small, continuous Scheimpflug focus-plane response instead of substituting the parallel construction. tableTiltOptics.test.ts checks 0, 0.01, 0.1, 1, and 9 degrees; rearStandardFrame.test.ts names the 0.01° case.
2. **Is 0.01° physically meaningful?** Yes. It is a distinct pair of plane normals, and the physical footprint kernel evaluates actual geometry. Whether the derived focus-plane representation should expose that angle is model policy. It does not imply metrological precision.
3. **What is the threshold?** It is a model-selection threshold, not a physical law or the plane-intersection epsilon. It changes whether the common line is constructed and which focus/DOF plane representation is derived.
4. **Could scene identity be removed?** Yes in principle: carry an explicit near-parallel/model precision policy in scene geometry configuration, or derive a well-defined policy from geometry/model requirements. Do not replace it with an arbitrary universal tolerance without matching intended plane behavior.
5. **Would other scenes change?** A stricter policy would classify relative plane angles from 1e-6° up to but not including 0.1° as nonparallel in other scenes. That can change hinge existence, focus/DOF planes, diagnostics, overlays, and legacy wedge samples. It does not change actual planes or active physical footprint for fixed geometry.
6. **What depends on exact threshold?** The named Table Tilt tests above, plus assertions that focus-plane model is Scheimpflug and DOF/uniforms remain finite at 0.01°. Public tilt control step is 0.1°, so 0.01° is a regression probe, not a currently reachable slider step. At exactly 0.1°, the general strict comparison already considers the state nonparallel.

The threshold is meaningful as a requested plane-model resolution in this scene, but it is not an independent CoC equation. Preserve it until the intended near-parallel policy and sub-step state coverage are explicitly changed.

### 10.2 Table Tilt groundGlassDofModel

The finite optics path sets this diagnostic to derived-planes for all Table Tilt states, including zero movement, or when calculateDepthOfField() returns scheimpflug-wedge. The intent is documented as keeping Ground Glass mode aligned with already-derived focus/near/far planes for the Table Tilt focus control.

Active RTT still calculates its per-pixel footprint from actual lens/film geometry. The mode is written to a uniform, but GLSL does not read it. Removing the flag would not change valid-state GPU physical CoC or ellipse calculations. It would change debug/runtime mode output and relax the CPU-side derived-plane uniform-preparation check. The old CPU helper would also choose its wedge branch if directly invoked. Learner readouts and tasks use physical target metrics and do not read this mode.

Do not remove the Table Tilt mode in this diagnosis. Any later removal should prove that plane validation, mode metadata, and remaining direct CPU diagnostic callers have been intentionally retired.

## 11. Shelf Swing deep dive

Shelf Swing has a 42 px gather cap and planeMode derived-planes. The setting resolver copies that renderer choice into DerivedOpticsState.diagnostics.groundGlassDofModel when finite focus, focus plane, and near plane are present.

1. **Historical problem addressed:** the current comment says the RTT should display canonical scene focus/DOF planes even at 0° swing. History shows derived-plane selection was introduced with the Shelf Swing RTT pipeline. It appears intended to keep zero swing on the derived-plane route rather than the legacy parallel default. Current source does not establish a specific user complaint, so the exact earlier visual defect is unproven.
2. **Active GPU footprint:** unchanged. Current GLSL calculates physical CoC/ellipse from actual geometry and never reads dofMode.
3. **Other consumers:** the mode changes CPU uniform preparation/validation, runtime mode reporting, and data-rtt-dof-mode. It would select the wedge branch in groundGlassBlur.ts if that helper is called with display optics state. Search finds no Shelf Swing runtime caller; the production debug sample is guarded to Architecture Rise.
4. **Physical semantics at zero swing:** no unique Shelf Swing lens or focus equation exists. Focus distance uses the same U meaning and finite-focus strategy as other rear-standard scenes. At zero swing its actual planes are simply the geometry produced by that state.
5. **Is the override required now?** No evidence shows that it is required for the active RTT physical image. It survives as mode metadata, a validation choice, and test-visible compatibility behavior.
6. **Should it remain renderer policy?** If a future renderer truly needs a visual mode, keep the choice in renderer presentation state and avoid writing it back into canonical optics diagnostics.
7. **Evidence before removal:** compare zero-swing and public calibrated-swing states through actual browser RTT output, confirm target CoC and sharpness are invariant, verify Raw/Upright projections and no fallback caused by uniform validation, and confirm no consumer depends on data-rtt-dof-mode. Current unit tests prove setting and metadata behavior, not a real GPU pixel difference.

Classification: Shelf Swing physical scene is shared geometry; planeMode is T; the renderer-to-diagnostics copy is C/T compatibility coupling. Leave it untouched in this PR.

## 12. Focus Fundamentals deep dive

Focus Fundamentals explicitly teaches front-standard versus rear-standard focus. Solved lens and film positions should differ:

- State/control: focusDistanceMm represents S, the target focus-plane depth from the rear datum; focusStandard selects which standard moves.
- Solver: resolveFocusFundamentalsFocusing() solves finite U and V. Front mode moves lens to solved image-distance position and holds film datum at zero. Rear mode keeps the lens at the reference front-focused position, computes selected-object U from S and that lens position, solves V, and moves film.
- Placement: Focus Fundamentals uses rear-datum coordinates. View Camera Anatomy runs the same solver but translates both positions to its scene baseline.
- Canonical derivation: deriveOpticsState() installs solved lens and film positions, rebuilds their real planes, computes focus point/plane and near/far DOF planes, then calls calculateSharpness() with those same planes.
- Consumers: target CoC and active RTT both use resulting canonical lens/film geometry.

This is an I adapter with real physical output. The distinction must remain. Both options already converge to the same downstream geometry-based physical target and Ground Glass kernels. Scene identity remains in lesson presentation paths: reference-camera/standard-movement cues, selectable-focus controls, baseline target projection, and a fallback diagnostic that names front. Those presentation branches do not add a second valid focus equation.

The Focus Fundamentals Ground Glass target marker uses a baseline thin-lens projection special case. That affects marker placement, not physical target CoC or per-pixel RTT blur.

## 13. Architecture Rise deep dive

Architecture Rise's scene definition says its finite-focus strategy is lens-to-focus-plane distance with a rear-standard-Z film datum. The legacy branch in deriveOpticsState() feeds focusDistanceMm directly as U to calculateDepthOfField().

The generic branch constructs a focus point on the optical-axis ray at focusDistanceMm, builds a focus plane through that point, and computes U = dot(focusPlane.point - lensCenterWorld, opticalAxis.direction). For valid Architecture Rise geometry, the plane contains that point on the same ray, so the dot product is the configured distance. The special case does not express a different current control meaning or physical equation.

Historical context: the branch is present in architecture/focus code consolidated by commit 405ac82, whose summary mentions rear-standard focusing, re-enabled DOF, and migrated task IDs. That makes compatibility a plausible reason for retaining the direct branch, but does not prove it is still necessary. PR #200 added a public focus range from the nearest Architecture Rise reference probe to the far scene edge; the canonical facade focus depth is likewise taken from the focus target. Those calibration values are world-Z distances in the neutral, untilted scene, where Z is the lens-to-subject U datum. They depend on preserving that U control meaning, but no evidence shows that they depend on the duplicated DOF branch itself. The generic derivation yields the same U on these valid states. Replacing the branch should preserve target metrics, near/far planes, overlays, and RTT output; invalid/fallback states need separate assertions.

finiteFocusStrategy already expresses its lens-to-focus-plane U meaning and rear-Z film datum, so no new strategy field is needed for current valid behavior. A future cleanup can first assert equivalence over the public Architecture Rise range and movement states, then consolidate. Do not change it here.

## 14. Other tilted and compound scenes

Shelf Swing, Oblique Tabletop, Oblique Architecture, Architecture Foreground, Interior Corner, Macro Oblique Plane, and Macro Compound Movements all construct actual scene/lens/film geometry and feed the common focus-plane, DOF, CPU physical target, and active RTT footprint paths.

The search found scene-specific target calibration, focus-distance ranges, task thresholds, geometry view profiles, and gather caps. It found no additional focus-distance-to-CoC or aperture-to-film equation branch for these scenes. Tilt and swing affect focus because they change actual lens plane or subject position; they do not select a second physical blur model.

This is useful evidence against a broad scene-specific optics rewrite. The tilted/compound scenes already exercise shared geometry across several different physical setups.

## 15. Macro scenes

The four macro scenes use the same finite-focus film strategy and physical footprint kernel. Close-focus ranges and subjects lead to different real U and V values; that changes physical input, not the blur equation.

deriveMacroFocusMetrics() consumes canonical conjugate distances:

- magnification is V / U;
- bellows factor is (V / f)²;
- exposure compensation is log2(bellows factor);
- reported bellows extension is full lens-to-film distance V, not only travel beyond infinity.

The selected lens profile may change image-circle coverage as image distance changes. Coverage remains separate from CoC and DOF. Physical CoC still comes from aperture footprint projected onto actual film. Macro DOF still comes from f, N, acceptable CoC, U, and optional lens/film/hinge geometry.

Macro teaching helpers interpret canonical outputs: Macro DOF, Macro Oblique Plane, and Macro Compound Movements use strict physical patch metrics; Bellows Extension interprets canonical magnification, extension, travel, and image-circle data. They do not re-solve focus, tilt, DOF, or physical CoC.

## 16. calculateDepthOfField() role

calculateDepthOfField() owns:

- thin-lens hyperfocal distance H = f² / (N c) + f;
- scalar near and far object distances derived from U;
- whether far is mathematically infinite;
- parallel near/far planes as fallback/default;
- optional Scheimpflug near/far planes built from lens plane, film plane, their hinge, image distances, and object-side near/far points;
- a depthOfFieldModel label plus fallback diagnostics.

It does not produce the primary focus plane; that comes from focus point plus actual lens/film relationship. It does not calculate target point/patch CoC or active Ground Glass per-pixel blur. It is consumed by overlays and diagnostics and supplies planes to legacy wedge helpers and mode validation.

computePhysicalBlurFootprint() answers another question: given one actual object point, lens/aperture geometry, and actual film plane, what local aperture image footprint reaches film? It returns signed equivalent CoC diameter, ellipse axes, and orientation. The functions are complementary: DOF gives threshold-bounded regions/plane model; footprint gives geometric blur measurement. They are not interchangeable models of the same output.

## 17. Physical sharpness and Focus Distribution

The shared acceptable learner CoC is ACCEPTABLE_COC_DIAMETER_MM = 0.1 mm. calculateSharpness() calls computePhysicalBlurFootprint() on a target point and target patch samples using canonical lens center/plane basis, film plane/basis, focal length, and aperture. It retains legacy wedge fields for compatibility, but also emits physical point/patch CoC/score fields.

The learner scale is clamp(1 - abs(equivalentCoC) / 0.1 mm, 0, 1). Status labels use shared cutoffs: at least 0.8 is “sharp,” at least 0.5 is “acceptable,” otherwise “soft.” This is a presentation mapping over physical CoC, not a per-pixel blur kernel.

FocusAssistPass.resolvePhysicalFocusTargetPresentationMetric() requires both physical score and finite CoC and does not fall back to legacy wedge fields. Guided focus evaluation uses resolvePhysicalTaskPatchSharpness() with the same strict requirement. Focus Distribution receives the physical point/patch-selected metric from the workspace. Macro teaching uses the same physical patch metric. No scene-specific physical sharpness threshold was found; task minimum scores are task policy.

Table Tilt has a scene/mode-dependent sample choice: free practice reads point sharpness, while the other Table Tilt readouts use patch sharpness. Both are physical metrics from the same geometry. This does not modify CoC or learner scale.

## 18. CPU groundGlassBlur.ts role

sampleGroundGlassBlurAtWorldPoint() is not the CPU implementation of the local-affine aperture/film footprint. It has two scalar diagnostic paths selected from mode fields:

- Parallel path: computes axial U, image distance, scalar thin-lens CoC, then maps diameter to pixels.
- Derived-plane path: ray-samples near/focus/far planes with sampleDofWedge(), multiplies normalized wedge defocus by acceptable CoC, then maps scalar CoC to pixels.

It has no per-sample aperture edge projection, oriented footprint ellipse, or direct use of the physical footprint return type. Both are diagnostic approximations; the derived-plane branch is a teaching/wedge scalar and the parallel branch is a scalar thin-lens estimate.

The only non-test production call found is in OpticalDebugPanel.tsx, guarded to Architecture Rise reference-object diagnostics. The regular public Ground Glass path is RTT for all registered scenes; learner readouts and task evaluation do not use this helper. Table Tilt/Shelf Swing uses in tests exercise compatibility/stability behavior, not the production image. Preserve the distinction between this helper and CPU computePhysicalBlurFootprint().

## 19. GPU physical-footprint role

groundGlassPhysicalCocFragmentShader reconstructs a world position and calls calculatePhysicalBlurFootprintFromWorldPosition(). It stores signed equivalent CoC and the oriented ellipse. The gather consumes those physical channels and maps film mm to sampled source pixels. It does not call calculateNormalizedWedgeDefocus() or calculateSignedWedgeCoCDiameterMmFromWorldPosition() from its active entry point.

Shared GLSL still contains legacy wedge helpers and uniforms for focus/near/far planes; those helpers remain available to compatibility/debug paths or historical test assertions. Their textual presence is not evidence that they affect active RTT pixels.

Normal physical scale is direct. Half-float stores mm. Byte fallback encodes and decodes mm within a computed bounded storage interval. Both represent the physical value. The crop changes magnification by changing sampled-film width/height. Gather caps are applied after conversion.

## 20. CPU/GPU relationship and parity evidence

The CPU physical footprint and GPU footprint implement the same geometric contract:

- object point and lens center;
- lens direction and circular aperture radius f / (2N);
- ideal thin-lens image point/direction;
- projection of the circular aperture through image geometry onto actual film plane (CPU uses symmetric edge-ray intersections; GLSL maps local affine aperture directions);
- local-affine ellipse derived in a film-plane basis;
- orientation plus signed equivalent CoC diameter.

CPU uses millimetres throughout. The shader receives world geometry in metres and converts film projection terms back to millimetres. Both sign near/far side from image versus film geometry and both fail closed on unresolved geometry.

They are separate implementations, not one shared executable function. They are not bit-for-bit guaranteed: CPU uses JavaScript double precision and its own small epsilons; GLSL uses float arithmetic and different guards around near-focal and near-parallel/intersection cases. RTT depth reconstruction, storage quantization, source resolution, and gather/compositing are additional GPU/display differences.

| Evidence type | What exists | What it proves | What it does not prove |
|---|---|---|---|
| CPU physical unit tests | physicalBlurFootprint.test.ts, Scheimpflug propagation and scene focus tests | CPU physical geometry behavior, sign, ellipse, monotonic aperture response, invalid-geometry handling | Numeric agreement with a running fragment shader |
| Static shader tests | groundGlassShaders.test.ts | Source includes physical helper, legacy helper text, and expected shader stages/storage | That every helper in source is called or rendered GPU pixels match CPU metrics |
| RTT component tests | GroundGlassRTT.test.ts and related runtime/lifecycle tests | Uniform/state setup, route selection, RTT behavior contracts, resource ownership, mocked renderer integration | Real GPU CoC values or CPU/GPU numerical parity |
| Physical-scale/storage tests | groundGlassPhysicalScale.test.ts, physicalBlurFootprintStorage.test.ts | mm-to-pixel and storage contracts, including crop and encoding | Full rendered pixel footprint shape across hardware |
| Browser/E2E evidence | Existing scene workflows may verify visible functionality | User workflow and rendered availability when run | No test found that reads back shader footprint and compares it with CPU outputs |

Therefore **algebraic/source-contract parity exists; real GPU numerical parity is not established**. Before claiming backend parity, use shared fixtures for ordinary parallel geometry, tilted film, near/far sign, exact focus, aperture scaling, and unresolved geometry, with browser/GPU readback or equivalent measurable output. This can be a backend regression deliverable; it is not a reason to rewrite current optics first.

## 21. Scene-specific renderer settings

groundGlassVisualSettings.ts separates:

- maximumBlurRadiusPx: renderer gather limit. Current overrides are Table Tilt 42 px, Shelf Swing 42 px, Oblique Tabletop 48 px, Oblique Architecture 48 px, Architecture Foreground 48 px. Default is 60 px.
- planeMode: automatic by default; Shelf Swing requests derived-planes.

The cap affects a visible footprint only once its post-physics pixel radius reaches the cap. It bounds gather work and the largest represented output blur; it does not change the physical lens/film calculation. It is a renderer quality/display calibration, not another CoC law. Current code does not prove whether each value is a performance safeguard or historical artifact; per-scene tuning is a future renderer-maintenance concern.

planeMode changes the selected diagnostic/uniform mode through the display-state adapter. It has no active GLSL equation branch. Keep it out of canonical optical authority if that renderer policy is later removed or renamed.

## 22. Classification summary

| Classification | Current paths |
|---|---|
| P — Physical requirement | Real rig translation for Mirror Shift; actual lens/film starting geometry selected by explicit finite-focus datum configuration. These change geometry, not the shared aperture/film equation. |
| I — Input-semantic adapter | Focus Fundamentals front/rear S-to-U/V solve; View Camera Anatomy scene-baseline translation; Understanding Camera Movements structured lesson-state materialization. |
| T — Teaching/presentation policy | Scene target/range choices, Table Tilt point-vs-patch readout, geometry framing/overlays, macro teaching stages, renderer gather caps, Shelf planeMode. |
| C — Compatibility/historical stabilization | Architecture Rise direct-U duplicate branch; Shelf renderer-selected diagnostic copy; Table Tilt forced Ground Glass mode metadata. |
| L — Legacy/diagnostic-only | Scalar CPU groundGlassBlur.ts; legacy wedge fields from calculateSharpness(); shader wedge helper definitions not called by active physical CoC entry point; fallback-only Focus Fundamentals mode diagnostic. |
| U — Unresolved | Exact user-visible defect that originally motivated Shelf Swing derived-plane selection is not established in available current source/history. |

The Table Tilt tolerance is categorized as T/model-selection policy. Underlying lens and film geometry remains physical and exact in the physical footprint path.

## 23. What convergence should mean

The evidence supports this smallest architecture:

~~~mermaid
flowchart LR
  subgraph Input["Input semantics and physical configuration"]
    SCENE["Scene controls, starting geometry, targets"]
    ADAPTER["Explicit focus/placement adapters"]
    SCENE --> ADAPTER
  end
  subgraph Shared["Shared canonical physical model"]
    ADAPTER --> CANON["deriveOpticsState"]
    CANON --> PLANES["Focus and DOF derived planes"]
    CANON --> SCORE["CPU physical target footprint and score"]
  end
  subgraph Backend["Renderer physical evaluation"]
    CANON --> CONTRACT["Geometry and aperture/film footprint contract"]
    CONTRACT --> RTT["Current GLSL RTT"]
    CONTRACT --> FUTURE["Future backend implementation"]
  end
  subgraph Display["Presentation and diagnostics"]
    PLANES --> OVERLAY["Plane overlays and debug"]
    SCORE --> TASK["Readouts and task policy"]
    RTT --> VIEW["Gather, orientation, crop, preview"]
    FUTURE --> VIEW
  end
~~~

Convergence does not mean deleting legitimate input semantics. It means scene adapters produce actual geometry and both target scoring and renderer backends evaluate a clearly stated aperture/film geometry contract. DOF boundaries and teaching modes remain useful derived/presentation data, but must not silently become a competing per-pixel blur equation.

## 24. Minimum cleanup before renderer/WebGPU work

### Required before renderer backend work

No production cleanup is justified as a prerequisite by this audit. The active physical RTT path already takes actual canonical geometry and has no scene-specific blur gain or active mode branch.

Carry forward these contract points in backend work:

- use canonical lens center/plane/basis and film plane/basis;
- calculate signed physical CoC and local oriented aperture footprint from actual geometry;
- preserve millimetres until sampled-film mapping;
- apply any gather cap after physical conversion;
- do not port groundGlassDofModel or legacy wedge model as an independent physical mode;
- add measurable CPU/backend parity cases before claiming numerical equivalence.

The last point is a backend validation requirement because current source/unit tests do not establish real GPU numerical parity; it does not require a pre-backend optics rewrite.

### Useful but independent

- Remove or rename the Shelf Swing renderer-to-diagnostics mode copy after runtime metadata and uniform-validation callers are retired or consciously preserved.
- Consolidate Architecture Rise's direct U branch after equivalence assertions.
- Decide whether Table Tilt's sub-step 0.01° focus-plane policy should remain explicit.
- Replace or remove the old scalar CPU blur diagnostic only if its developer-facing value is no longer needed.
- Reduce/rename groundGlassDofModel after its diagnostic and validation contract is retired.

### Leave alone

- Focus Fundamentals front/rear physical standard movement and its shared solver.
- Scene-selected physical film datum configuration.
- Actual lens and film planes as optical truth.
- Common physical target and active RTT footprint equations.
- Separate lens/film coverage state and Ground Glass coverage state.
- Gather caps as renderer limits and physical-mm storage encoding.

## 25. Candidate cleanup PRs

| Candidate | Current problem | Classification | Behavior risk | Required before WebGPU? | Recommended action |
|---|---|---|---|---|---|
| A. Remove Shelf renderer choice from optics diagnostics | Renderer planeMode writes groundGlassDofModel into copied optics diagnostics; current shader does not need it | T/C | Diagnostic-only on current valid public RTT; may affect preflight validation and direct legacy CPU sampling | No | First optional cleanup if desired. Preserve or explicitly remove the data attribute and validation contract; compare real RTT before/after. |
| B. Replace Table Tilt scene-ID tolerance | A domain calculation receives a scene-ID boolean and selects a stricter focus-plane classification tolerance | T/model policy | Focus/DOF planes, debug and overlays may change for tiny angles; active physical footprint unchanged | No | Investigate public reachability and desired sub-step behavior. Express explicit model policy only if it has a consumer need. |
| C. Retire/converge scalar groundGlassBlur wedge path | Separate diagnostic approximation can be confused with physical aperture/film kernel | L | Debug sample output may disappear/change; active public RTT and task/readout metrics are unaffected | No | Keep unless debug output is replaced with CPU physical footprint metrics or intentionally dropped. |
| D. Make focus semantics explicit and remove redundant Architecture Rise branch | Focus Fundamentals is a real adapter; Architecture Rise direct U duplicates generic projection | I for Fundamentals; C for Architecture Rise | Architecture Rise DOF planes/metrics should be identical; require invalid/fallback checks | No | Preserve Focus Fundamentals. Consolidate Architecture Rise only with range-wide equivalence evidence. |
| E. Rename/reduce mode fields | groundGlassDofModel sounds more authoritative than active behavior; planeMode and diagnostic model are coupled | C/T | Debug/runtime metadata or missing-plane preflight validation may change; no valid-state shader equation change | No | Defer until consumers are deliberately changed. Do not combine with backend equation work without parity coverage. |
| F. Add physical CPU/GPU parity fixtures | Independent TypeScript and GLSL implementations have no numeric readback comparison | Evidence gap | Test infrastructure only unless it uncovers a real divergence | Before claiming a new backend is equivalent; not a pre-backend cleanup gate | Add alongside the first backend vertical slice or its acceptance tests. |

## 26. Contracts that should remain unchanged

This diagnosis provides no evidence to reopen these contracts:

- deriveOpticsState() remains canonical scene-to-camera physical authority.
- Actual lens and film geometry remains authoritative.
- Physical Ground Glass scale stays direct; no fixed 16x gain, acceptable-CoC-to-one-pixel normalization, or scene-specific blur gain.
- Focus Loupe remains geometric magnification through its smaller sampled-film crop.
- DerivedLensCoverage and GroundGlassCoverageState remain separate.
- The #202 camera assembly hierarchy remains untouched.
- Raw/Upright orientation behavior remains untouched.
- 90, 105, 120, and 150 mm coverage profiles remain untouched.
- Macro image-circle growth and bellows exposure remain separate from blur.
- Renderer gather caps remain non-optical limits.
- Encoded-byte storage remains a representation of physical values.

## 27. Regression requirements for future cleanup

- **Shelf mode removal:** zero swing, public calibrated swing, Raw/Upright output, target physical point/patch CoC, mode diagnostics, and no unexpected uniform-preparation fallback. Use real browser RTT evidence for visible output; unit state equality alone is insufficient.
- **Table tolerance change:** exact parallel, sub-step 0.01°, first public 0.1° step, calibrated tilt, matched front/rear planes, finite planes/uniforms, and explicit overlay/target metric expectations. State which sub-step values public controls can reach.
- **Architecture Rise branch consolidation:** sweep the scene's public focus range and representative supported movement states; compare U, near/far scalar limits, plane geometry, physical target CoC, and RTT footprint inputs. Test invalid input/fallback separately.
- **Legacy CPU diagnostic retirement:** confirm Optical Debug Panel replacement/removal and all direct test/debug callers; never treat old wedge fields as task or Focus Distribution fallback.
- **Mode field retirement:** search all uniform, validation, debug, dataset, and test consumers before removing; keep diagnostic and physical meanings distinct.
- **Renderer backend parity:** compare shared physical fixtures for parallel/tilted film, focus, near/far sign, aperture scaling, anisotropy orientation, singular/invalid cases, and sampled-film crop; run a real browser/GPU measurement for the shader path.
- No follow-up should alter the physical 0.1 mm learner CoC threshold without an explicit product requirement.

## 28. Recommended sequence

1. Accept or correct the ownership and branch classifications in this diagnosis.
2. Start renderer work from the documented physical footprint contract. Do not encode legacy mode metadata into the physical shader API.
3. Add measurable backend parity coverage with the first backend vertical slice.
4. If maintainers want a cleanup before then, take only Candidate A first, since it removes the clearest renderer-to-domain-diagnostics coupling. It remains optional and should preserve any mode metadata contract reviewers still need.
5. Consider Architecture Rise consolidation, Table Tilt policy, or legacy CPU helper changes as separate small follow-ups only if their direct consumers justify them.

## 29. Final conclusion

The active Ground Glass already uses one geometry-based physical aperture/film footprint for every registered scene. CPU target scoring uses a separate TypeScript implementation of the same physical contract, while calculateDepthOfField() constructs near/far limits and plane overlays for another purpose. groundGlassDofModel and its dofMode uniform do not switch the valid-state active GPU footprint equation.

The remaining focus exceptions have different roles: Focus Fundamentals and scene placement are legitimate input adapters; Table Tilt's tolerance selects focus/DOF plane representation; Architecture Rise's current direct-U branch duplicates generic U derivation; Shelf Swing's renderer mode copy is historical diagnostic compatibility. The scalar CPU groundGlassBlur path and legacy wedge fields are not the authoritative learner or active Ground Glass metrics.

The minimum justified pre-WebGPU cleanup is **none**. Preserve the shared geometry contract, keep presentation mode out of a new physical kernel, and establish numerical backend parity before claiming equivalence. A broad optics rewrite or deletion of every scene-specific branch is not supported by the evidence.

## Validation at the pinned code snapshot

- Focused evidence: 15 suites passed, 141 tests passed. This included Table Tilt, Shelf Swing, Scheimpflug physical focus propagation, RTT/shader/physical-scale/storage coverage, Focus Fundamentals, Architecture Rise, and Macro DOF.
- npm run typecheck: passed.
- npm test: passed, 215 files and 2,061 tests.
- Tests used bundled Node 24 because the shell's default Node could not import the installed Vite dependency. The repo's installed dependencies were exposed to the isolated worktree with a temporary ignored node_modules symlink; no dependency files were changed.
- git diff --check and final changed-file/status checks are recorded in the PR handoff after the document is added.
- No Playwright/E2E run was needed for this documentation-only diagnosis; browser/GPU numerical parity remains an evidence gap, not a claimed pass.
