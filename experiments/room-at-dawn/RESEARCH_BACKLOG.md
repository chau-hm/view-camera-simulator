# Room-at-Dawn research backlog

These are independent investigations. None is required to close the current development-only feasibility PoC. Every proposal keeps canonical optical state and existing production behavior authoritative.

## J1 — Ground Glass DOF rendering fidelity

- **Observed problem / opportunity:** small CoC support, weak or inaccurate foreground defocus, near-layer ghosting, thin-geometry coverage, near/far occlusion, and the lack of calibrated PSF/edge-spread transfer.
- **Supporting evidence:** the Room focus comparison has visible but imperfect foreground defocus and plant-edge ghosting. High quality uses a Near Gather proposal radius of about 60 internal pixels, 32 samples, and a first noncentral proposal about 7.5 pixels from center; some tested small footprints fall below that spacing. Existing stage readbacks demonstrate that CoC and final Gather output may differ. These facts do not prove one shared cause.
- **Current confidence:** high that the visual limitation exists; moderate that sparse proposals can limit some small footprints; low that this explains every artifact.
- **General applicability:** shared Ground Glass behavior across photographic and teaching scenes.
- **Proposed investigation:** use a small, controlled candidate comparison (adaptive or multiscale proposals are candidates only); capture Raw RTT Debug and Processed from identical request, generation, frame, focus, aperture, composition, and quality; inspect the plant reproduction case without changing its material or hiding it.
- **Acceptance criteria:** quantify small and large CoC, oriented blur ellipses, foreground silhouettes, thin geometry, near/far coverage and occlusion, radiance normalization, macro scenes, GPU cost, and regressions across existing teaching scenes. Demonstrate calibrated PSF or edge-spread transfer with registered, request-matched evidence.
- **Dependencies:** exact rendered scene/depth behavior, reproducible raw/processed capture, current scene baselines, and hardware/performance budget.
- **Explicit exclusions:** no artificial blur amplification, plant-specific workaround, threshold lowering, or production algorithm change in this closeout.

## J2 — Production HDR architecture

- **Observed problem / opportunity:** the experiment validates a synthetic HalfFloat path, but production has no standardized HDR scene-radiance, exposure, and display contract.
- **Supporting evidence:** synthetic linear readback preserves the tested values and display mapping; actual room PBR radiance/highlight parity and backend equivalence remain unmeasured. Production color-target defaults remain byte.
- **Current confidence:** high for the tested synthetic scope; low for production readiness.
- **General applicability:** all scenes and renderer backends.
- **Proposed investigation:** define resource formats, radiance semantics, display exposure, tone mapping, output color space, backend capability contracts, default behavior, and supported hardware.
- **Acceptance criteria:** validated scene-radiance inputs, linear readback across the supported pipeline, predictable exposure/tone-map output, capability/fallback behavior, production-scene visual regressions, and hardware cost measurements.
- **Dependencies:** renderer architecture decision and representative hardware.
- **Explicit exclusions:** do not promote experimental flags or change optical brightness semantics as part of this PoC.

## J3 — Procedural materials and realistic lighting

- **Observed problem / opportunity:** source-room procedural texture, PBR material, and lighting techniques may improve material readability in existing scenes.
- **Supporting evidence:** the Room contains generated wood/fabric/color/normal/roughness detail and baked GI; fine material parity is not established at Ground Glass resolution.
- **Current confidence:** high that the techniques exist; medium that selected techniques will help other scenes.
- **General applicability:** existing teaching scenes, subject to learning goals and performance limits.
- **Proposed investigation:** inventory reusable procedural utilities, then pilot a small material/lighting change in Interior Corner with one controlled surface/lighting matrix.
- **Acceptance criteria:** visible material improvement at intended simulator resolution without obscuring the optical teaching objective, breaking color/contrast accessibility, or exceeding agreed performance budgets.
- **Dependencies:** scene-owner approval, baseline captures, and an explicit visual/performance target.
- **Explicit exclusions:** no teaching-scene modification or room expansion in this closeout.

## J4 — Baked GI and scene-resource architecture

- **Observed problem / opportunity:** the 302/302 scene-specific bake worked with deterministic geometry, while global shader mutation and source/runtime coordinate coupling constrain reuse.
- **Supporting evidence:** source-space GI positions must be reconstructed after room translation; per-view uniforms and reflection resources need independent ownership; current bake matching is not a general pipeline.
- **Current confidence:** high for this experiment's matching and transform evidence; low for a reusable production bake architecture.
- **General applicability:** any future baked-lighting or probe-based scene.
- **Proposed investigation:** compare scene-local GI interfaces, stable geometry IDs, bake provenance, coordinate transforms, material shader isolation, cleanup ownership, failure paths, and optional asynchronous asset preparation.
- **Acceptance criteria:** deterministic bake-to-scene validation, explicit transform semantics, multi-view resource isolation, client-side mount/unmount cleanup, and a documented supported shader/material contract.
- **Dependencies:** renderer ownership decision and representative scene.
- **Explicit exclusions:** do not import upstream GI wholesale or claim a general baking tool exists.

## J5 — Reflection fidelity

- **Observed problem / opportunity:** renderer-owned probe capture contributes supported PBR reflections, but custom glass behavior and upstream parity remain unresolved.
- **Supporting evidence:** the experiment has independent reflection captures and lifecycle tests; earlier visual comparisons did not establish useful custom-glass reflection parity.
- **Current confidence:** high that supported reflection infrastructure exists; low for custom glass/upstream parity.
- **General applicability:** realistic scenes that require reflections beyond current teaching-scene needs.
- **Proposed investigation:** only if a future scene has a measured reflection requirement, compare matched regions and renderer-owned probe outputs, including glass shader behavior.
- **Acceptance criteria:** repeatable matched-frame material ROI, defined reflection contribution, no borrowed-environment contamination, and tested per-renderer disposal.
- **Dependencies:** a concrete scene requirement and valid matched reference.
- **Explicit exclusions:** no custom-glass port or upstream-parity claim in this closeout.

## J6 — Future Free World environments

- **Observed problem / opportunity:** realistic non-teaching environments can support exploration and photographic composition experiments.
- **Supporting evidence:** this isolated room can host canonical optical controls without becoming a guided task or public scene.
- **Current confidence:** exploratory.
- **General applicability:** future free practice environments.
- **Proposed investigation:** define a separate product and scene-ownership proposal after the simulator's public navigation and resource contracts support it.
- **Acceptance criteria:** a bounded product brief, route/catalog/lifecycle design, and validation plan approved before implementation.
- **Dependencies:** explicit product direction.
- **Explicit exclusions:** no Room-at-Dawn public registration, task, navigation redesign, production workspace integration, or catalog work.

## J7 — Deferred optical demonstrations

- **Observed problem / opportunity:** compound Tilt + Swing, broader camera orientation, quantitative optical calibration, and native WebGPU equivalence remain open.
- **Supporting evidence:** current qualitative tilt/swing comparisons establish recognizable redistribution only; current room poses are translation-only; complete PSF and WebGPU comparisons do not exist.
- **Current confidence:** high that these areas are unvalidated; no evidence they block the current feasibility result.
- **General applicability:** future optical and renderer research.
- **Proposed investigation:** create separate, physically bounded studies with explicit canonical-state contracts and matched Ground Glass evidence.
- **Acceptance criteria:** independently derived geometry/sign expectations, public-control-reachable settings, registered image-space evidence, and backend-specific validation where relevant.
- **Dependencies:** resolved camera orientation contract and DOF fidelity work where the study depends on blur.
- **Explicit exclusions:** no compound movement, new optical equations, general camera orientation, or native WebGPU implementation here.

## J8 — Independent regression maintenance

- **Observed problem / opportunity:** public E2E coverage includes Architecture + Foreground Focus interaction timeouts and Interior Corner exact-URL assertions that reject route-generated `seed`/`sv` parameters.
- **Supporting evidence:** the final-branch focused recheck ran 7 cases: 2 passed and 5 failed (two Focus interaction timeouts; three exact-URL assertions). The two timeouts and two URL failures were previously reproduced on immutable main `af680d7f9409bab13c6654abaaa2dad5aeac8079`; the third URL failure was separately rerun against that same baseline and failed with the same appended parameters. Failure stages are distinct, so no shared root cause is established.
- **Current confidence:** high that these specific failures predate the Room-at-Dawn closeout branch; current `origin/main` CI remains the authoritative integration check.
- **General applicability:** public E2E stability and route contracts.
- **Proposed investigation:** maintain a separate production regression follow-up and compare the affected workflows against current main before assigning ownership.
- **Acceptance criteria:** current-main and candidate results with exact test names, URLs, failure stages, and no weakened assertions or arbitrary timeout increases.
- **Dependencies:** immutable/current baseline and CI evidence.
- **Explicit exclusions:** do not broaden Room-at-Dawn closeout into repairing unrelated public E2E tests.
