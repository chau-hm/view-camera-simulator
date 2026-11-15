# Architecture Rise v2 — PR Sequence

**Planning baseline:** origin/main at 8a8b428789b94b4f03f5306549f0b243d49639a9; PR #338 merged at 48bfc7e5ed94006c1f3fbc82bb1ffb70ec930f0d.

**Approved visual input:** architecture-rise-v2-target.png, SHA-256 d24336e6ac92eac6b8e704af789973c2df0e51afa3218df3d24c0f65ccd30103. The exact image is not in the repository; each implementation packet must carry and verify the source bytes before use.

This sequence keeps the public Architecture Rise scene production-safe at each merge. The Dream Loop pilot is not an authorization for canonical scene or test edits.

## PR B1 — Optional layout-authority extraction

**Recommendation: do not create a standalone PR B1 by default.** The appearance-only front window arrays and side-window arrays currently have a small consumer set: the Architecture Rise factory and a Ground Glass host E2E landmark fixture. Moving these values alone would add a behavior-neutral PR and then require another change to consume them.

PR B should make the presentation separation as one cohesive, tested step: move the rebuildable bay/opening layout into the Architecture Rise presentation layout; keep focus, target, bounds, composition and probes in canonical geometry; update the existing window-landmark fixture to read the presentation layout. Do not change SceneDefinition output during this extraction.

Only split out PR B1 if implementation proves that the layout extraction cannot be reviewed independently from the geometry rebuild. If split, its write scope is limited to the presentation data owner, the factory’s read-only adaptation, and the exact Ground Glass fixture that reads the old arrays. Its acceptance is unchanged SceneDefinition, focus range, composition target, focus-chart geometry, asset registration and runtime capture. It must not alter architectureRiseGeometry.ts semantic values or Dream Loop manifest permissions.

## PR B — Clean-sheet procedural architecture

**Goal:** replace the current facade/window/entry/side-return presentation with the design in the [v2 design spec](architecture-rise-v2-design-spec.md), keeping the same public scene and all teaching/optical contracts.

### Write scope

- src/render/ArchitectureRiseSubjectFactory.tsx
- src/scenes/presentation/architectureRise.ts and, if needed, one focused renderer-neutral presentation-layout module
- src/scenes/architectureRiseGeometry.ts only to remove/move explicitly presentation-only window arrays; do not change canonical values
- Exact regression files needed for focus-ray visibility, architecture geometry, current window landmarks, materials, scene definition and Ground Glass behavior; prefer focused files over a broad test-directory allowance
- No scene registry/public route, optics, Ground Glass implementation, lighting, task threshold, shared procedural-material API or Dream Loop manifest changes

This is a normal implementation PR, not a Dream Loop pilot edit. The manifest does not authorize src/scenes/**, tests or renderer changes. Do not run dream-loop:guard by broadening that manifest. If PR B needs any protected shared contract, stop and open a separate scoped proposal first.

### Dependencies and implementation order

1. Reproduce the 8a8b4287 source values from the [contract map](architecture-rise-v2-contract-map.md) in focused contract assertions before replacing geometry.
2. Move only the front/side window presentation arrays to the presentation layout and update their one E2E landmark consumer. Prove no scene definition, target, bounds, focus range or task value changed.
3. Build the complete masses and connected side return; then cut openings into the wall construction; then add entrance, windows, roof courses and surface detail. Integrate both canonical focus regions at their existing coordinates.
4. Add tracked geometric checks against the actual mounted factory group. Ray from the derived physical lens center through all mounted meshes to the canonical checkerboard and full fine-detail assembly. Check default, focus endpoints, Rise task boundaries and a reachable mixed movement state. Keep every decorative mesh in the intersection set. Add a deliberate test-only blocker and assert that the regression assertion catches it.
5. Run the focused Architecture Rise, focus-chart, focus-detail, glazing/reflected-world, task, asset lifecycle and Ground Glass tests; then run relevant focus/Rise and Ground Glass browser coverage.
6. Capture matched clean Observer, teaching Observer, close-front, both oblique sides, side, above-roof, and Ground Glass Processed/Raw/Upright states. Use actual public controls for movement and focus. Retain screenshots only in ignored experiment artifacts.
7. Measure the same 60-sample Architecture Rise scene-capacity fields captured on current main, at the same browser, viewport, DPR, quality, route and public state. Report effective renderables/triangles, viewport and RTT subjects, renderer resources, CPU-submit timing, available GPU timing and frame cadence separately.

The approved brief allows exploring roughly 2–4× the current visible subject mesh instances if useful. Treat that only as a planning hypothesis: mesh count is neither a minimum nor a hard ceiling. Compare the visual gain with effective renderables, likely draw-call implications, shared renderer resources, RTT cost and observed browser performance.

### Acceptance and stop gates

- Scene ID, route, architecture-rise-subject, focus range/reset, camera/lens/film configuration, movement signs/limits/steps, focus target, checkerboard and marker, complete fine-detail panel, reference probes, scene bounds, composition regions and rise-01 thresholds match current main.
- The door and every window aperture are separate. The service wing meets the main wall and roof, and remains attached in both side views.
- The checkerboard and complete fine-detail frame/grid/six-line assembly have no newly introduced physical-lens ray obstruction in the checked states. The test-only negative control fails.
- No detached trim, visible wall gap, floating window, inconsistent return, hidden target or newly exposed roof gap appears in front, side, corner or above-roof views.
- Observer and Ground Glass render the same registered asset. Processed, Raw and Upright Assist retain their existing film mapping, focus/blur behavior and resource lifecycle.
- Performance reporting distinguishes renderable count/draw-call implications, shared renderer resources, CPU-submit measurements and hardware GPU timings. The targeted 472-mesh/6122-triangle snapshot was captured at 48bfc7e and remains applicable to 8a8b4287 because PR #341 did not change the Architecture Rise subject or capture path; PR B must still capture its own current-main parent as the matched baseline. No mesh multiplier is a quota or upper limit.
- Stop and request a separate contract review if fidelity would require moving canonical targets, expanding public bounds/range, changing task outcomes, changing lighting/renderer behavior or weakening an existing regression.

## PR C — Bounded image-guided refinement

Start only after PR B passes architecture, optical, lifecycle and multi-view acceptance and has an accessible clean Observer baseline. Use the exact approved scene brief and image as design context. Re-supply the approved PNG as a work-packet artifact, verify its SHA-256, and keep it in ignored experiment artifacts. It is not a repository production asset.

At PR C entry, create and lock the PR-C visual target from the PR B clean Observer baseline in accordance with the current Dream Loop workflow, using the approved concept image only as design context. Record the baseline commit, target bytes/hash, scene/camera/control state, renderer, viewport and DPR before Worker round 1. Do not use the planning-kit image as a geometric, camera or optical specification.

### Scope and loop

- Retain the existing Architecture Rise pilot route and asset key.
- Permit production edits only to src/render/ArchitectureRiseSubjectFactory.tsx and ignored .dream-loop/** artifacts. Do not add src/scenes/**, tests, shared material, lighting or renderer paths to the manifest implicitly.
- If a later visual improvement requires another path, pause and obtain a separately reviewable scope authorization before the worker starts.
- Run at most three Worker → deterministic capture → independent Critic iterations. After each, check the cumulative write-scope guard, focus/raycast regressions, registry lifecycle, Observer/teaching captures and Ground Glass Raw/Upright regression views.
- Make only geometry/material presentation changes that preserve the accepted PR B architectural layout and every PR B contract test. Stop when further appearance gain would compromise visibility, geometry consistency, runtime stability or authority boundaries.
- Compare the final result with PR B and current main using the same resource and performance measurements. Do not create a mesh-count target and do not claim SwiftShader CPU-submit/frame-cadence values as hardware FPS.

### PR C acceptance

- The locked target and clean Observer baseline are reviewer-accessible as artifacts or have an explicitly documented delivery limitation.
- No change to focus geometry, task meaning, movement range/sign, scene identity, Raw/Upright film mapping, shared RTT/renderer/lighting, or resource ownership.
- The geometry-ray suite and all PR B semantic regressions still pass at final head.
- Clean/teaching Observer and Processed/Raw/Upright captures show no focus-target obstruction, image-orientation change or multi-view geometry defect.
- At most three rounds are recorded individually with baseline comparison, independent Critic findings and stop reason.

## Baseline measurements and known limits

On 48bfc7e, a targeted 60-sample Architecture Rise capacity snapshot reports 507 viewport objects / 472 meshes / 6122 effective triangles; 505 RTT objects / 471 meshes / 5642 effective triangles; 3 renderer geometries / 24 renderer textures; processed Ground Glass scene-render p95 1.4 ms CPU-submit, total p95 1.5 ms CPU-submit, DOF p95 0.1 ms CPU-submit. Capture was Headless Chromium 149 at 1440×1000, DPR 1, using ANGLE SwiftShader; GPU timer queries were unavailable. See the [contract map](architecture-rise-v2-contract-map.md) for full counts and caveats.

The repository’s full npm run benchmark:scene-capacity matrix was attempted on 48bfc7e, the then-current main, and failed at its Interior Corner measurement after the navigation guard observed an unexpected route change; no final matrix report was written. PR B should repeat its Architecture Rise rows with a scoped capture and record the full-matrix outcome. Do not fix or suppress an unrelated harness failure as part of PR A.

The existing [Architecture Rise focus-range E2E](../../src/tests/e2e/architecture-rise-focus-range.spec.ts) has previously failed intermittently at its 5-second canvas-count assertion on cold/combined runs. The standard [Dream Loop runner](../../scripts/dream-loop/capture.mjs) has encountered fixed-port contention. Its [capture spec](../../src/tests/e2e/dream-loop-capture.spec.ts) has also timed out while toggling overlays after writing the teaching frame. PR B/C readiness must demonstrate successful focused real-browser captures without silently loosening these assertions or changing the Dream Loop harness in this documentation PR.

## PR A handoff

PR A contains only these planning documents:

- [Contract map](architecture-rise-v2-contract-map.md)
- [Design spec](architecture-rise-v2-design-spec.md)
- [PR sequence](architecture-rise-v2-pr-sequence.md)

**NO PRODUCTION SCENE OR OPTICS CHANGES IN PR A.** PR B must receive human review of the contract/design boundary before implementation begins. Do not merge PR A automatically as authorization to alter canonical geometry.
