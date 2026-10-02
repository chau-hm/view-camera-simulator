# Dream Loop Visual Workflow

## Purpose and authority

This document describes the bounded, manifest-selected visual workflow. The current pilots are the registered Architecture Rise and Interior Corner assets. Each pilot manifest identifies its canonical scene, registered asset key, implementation path, observer route, capture settings, write scope, and regression views.

Run either pilot through the same commands:

```bash
npm run dream-loop:capture -- --pilot architecture-rise
npm run dream-loop:capture -- --pilot interior-corner
npm run dream-loop:guard -- --pilot <pilot-id> --base <worker-baseline-sha>
```

The authority order is:

```text
canonical optics and teaching semantics
→ scene presentation geometry
→ interaction and camera contracts
→ registered scene asset implementation
→ visual appearance
→ Dream Loop target screenshot
```

A target image is a visual optimization reference, never a specification of physical or teaching geometry. Appearance cannot redefine camera state, lens/film geometry, focus geometry or targets, composition targets, movement signs or limits, calibration, task behavior, scene identity, image-circle physics, Ground Glass orientation, or renderer architecture.

The VCS overlay is at `.agents/skills/vcs-dream-loop-visual-quality/SKILL.md`. It adds project-specific authority and write-scope constraints to the separately installed upstream Dream Loop workflow; the upstream repository is not vendored here.

## Pilot manifest and write scope

`scripts/dream-loop/pilots/<pilot-id>.json` is the machine-readable source for pilot identity, optimization surface, permitted paths, protected paths, verification views, and capture settings.

The permitted production source path is the selected manifest's implementation path. For Interior Corner it is only `src/render/InteriorCornerSubjectFactory.tsx`; the manifest protects canonical scene data, renderer/RTT, lighting, material foundations, registries, and UI. `.dream-loop/**` holds ignored working artifacts. Every other changed path is outside scope and fails closed, including untracked non-ignored files. The guard reports violations and never reverts them.

An allowlisted scene factory may still contain geometry tied to teaching references. Path approval is not semantic approval: preserve canonical scene identity, presentation geometry, focus/composition targets, optics, and task contracts. Reuse the existing scene-specific geometry, focus, image-circle, projection, task, registered-subject, and lifecycle tests. Do not copy canonical geometry constants into a pilot manifest.

Do not bypass the selected asset key → `sceneAssetRegistry` → registered subject factory → Observer/RTT consumers. The registered asset remains instance-owned; any geometry, material, or texture must follow its paired creation/disposal lifecycle. Do not add a Dream Loop-only loader, renderer, or viewport asset.

The explicit protected patterns document the most sensitive paths. The allowlist is broader protection: any file not explicitly permitted fails regardless of whether it is named in `protectedPaths`.

## Deterministic capture

Capture through the public route and the real app:

```bash
npm run dream-loop:capture -- --pilot <pilot-id>
```

The harness starts its own Vite server on a dedicated port and uses the viewport, DPR, render-quality setting, route, and selectors declared by the selected manifest. It resolves the canonical `SceneDefinition` from `sceneId`, uses the public movement-reset and 3D-view-reset controls, compares available movement controls and aperture to that scene's definition, and verifies focus against the current scene reset contract and rendered control range. A fresh Playwright page supplies isolated browser state. With `?sceneCapacityProfiling=1`, the harness waits for the existing `scene-capacity-snapshot` and accepts capture only when its `viewportSubject` metrics report non-empty, renderable mesh content. Those metrics come from `TeachingShadowParticipation` collecting the mounted registered-subject root; cameras, lighting, and overlays are outside that root. Renderable metrics respect hidden ancestors, hidden/zero-opacity materials, geometry draw ranges, and instancing. Sampled screenshot pixel diversity is only a secondary blank/flat-canvas sanity check. There is no arbitrary sleep readiness check.

One run creates two Observer screenshots from the same reset scene state:

1. `observer-teaching.png` is captured first with the normal teaching overlays active. It is a regression and human-review view.
2. The harness uses the existing overlay controls in the public UI to turn off every active scene overlay, including focus plane, DOF region, optical geometry/finite coverage, legends, and Scheimpflug construction when available. It verifies that no overlay choice remains active and that movement, focus, aperture, camera/orbit, render quality, and mounted-subject capacity are unchanged. It then saves `observer-clean.png`, the sole Dream Loop optimization target.

The harness opens the existing `View overlays` menu when the responsive collapsed controls are in use. It does not set app state directly or hide WebGL geometry with CSS. Each screenshot is taken from the observer canvas locator itself, so surrounding DOM controls and diagnostics are not part of the image. Each ignored sidecar records its view role, active overlay choices, deterministic state, mounted-subject evidence, and canvas sanity metrics.

Both outputs, sidecars, and Playwright output remain under the selected manifest's ignored `.dream-loop/<pilot-id>/` directory. The canvas screenshots exclude navigation, controls, tasks, feedback, Ground Glass, and 2D Geometry. Ground Glass Processed, Raw, and Upright remain separate regression views; they are not optimization targets.

## Baseline and target

Start each later pilot from a clean, known worktree:

1. Record the baseline commit that the visual worker will build on.
2. Run the selected pilot's public route through the simulator capture harness.
3. Confirm the scene identity and reset/default movement and observer state.
4. Capture both Observer views under `.dream-loop/`; use the clean screenshot for appearance work and retain the teaching screenshot for regressions.
5. Keep the pilot's baseline and both captures in its manifest-owned output directory; record their hashes and mounted-subject evidence.
6. Generate the target from the clean Observer baseline so it remains recognizably the same teaching scene.
7. Save and lock the target under that pilot's ignored directory. Do not use an overlay-dominated capture or a text-only replacement scene.

Target images may influence material appearance, surface/decorative detail, visual density, realism, texture character, and visual hierarchy. They may not redefine teaching geometry, perspective lesson outcome, lens/camera state, focus-plane behavior, rise amount, image-circle physics, or film orientation. A target that conflicts with a protected contract is invalid even if it looks better.

## Worker and critic loop

For each of at most three worker/critic rounds:

1. Give the worker only the current clean Observer capture, locked target, pilot implementation file, shared material API when relevant, latest critic notes, manifest write scope, and immutable constraints.
2. Allow edits only to the selected manifest's permitted implementation path and ignored `.dream-loop/**` artifacts.
3. Run the write-scope guard against the clean iteration baseline:

   ```bash
   npm run dream-loop:guard -- --pilot <pilot-id> --base <worker-baseline-sha>
   ```

4. Run focused semantic and registered-asset regression tests.
5. Capture the live Observer pair again with the deterministic harness.
6. Have the critic compare the clean Observer capture to the target. Review the teaching capture for regressions only.
7. Translate critic notes into visual-only changes. Reject any recommendation that moves a protected semantic feature.

After three rounds, stop for human review. There is no autonomous unbounded loop.

The observer is the sole optimization target. Ground Glass Raw and Ground Glass Upright are regression views only; preserve their physical orientation and film mapping. Use existing Ground Glass tests to check both modes after an asset change. Both consumers continue using the same registered asset factory.

For the Interior Corner pilot, constrain production edits to material recipes and material assignment in `InteriorCornerSubjectFactory.tsx`. Do not add, remove, move, resize, or regroup scene objects. Keep the existing `interior-corner-local-light` PointLight and `teaching-default` presentation lighting unchanged. Reuse `createProceduralSurfaceMaterial` only with a materially appropriate shared pattern; extend the shared API before a worker round only when a locked target demonstrates a real missing pattern. Never copy the procedural generator into a scene factory. When the worker model is specified by the pilot task, use that exact model; do not silently substitute another model.

## Lighting and performance boundaries

PR C establishes two illumination categories: physical/in-world sources owned by the represented scene (including Interior Corner's registered practical light), and the shared `teaching-default` presentation-assist rig. The rig recipe, scene placement resolver, and current light sources are fixed for this pilot. Dream Loop may not arbitrarily modify either physical/in-world or presentation-assist lighting unless a later PR explicitly grants that permission. A target screenshot does not define lighting physics or teaching semantics. Do not change light direction/intensity, shadow-map policy, tone mapping, renderer exposure, environment lighting, or lighting architecture, and do not reshape scene geometry to compensate for the current lighting.

Later visual-enrichment work should compare before/after with the existing `npm run benchmark:scene-capacity` and, where useful, `npm run benchmark:scene-capacity:hardware` infrastructure. Treat mesh/object/geometry/material/texture/triangle counts, effective instanced triangles, available renderer resource counts, Ground Glass RTT timing, and frame cadence as decision evidence. Do not invent FPS or capacity pass/fail thresholds, and do not run the full scene-capacity matrix for every ordinary visual iteration.

## Human review and next boundary

After this pilot, retain the clean/teaching observer pair, Ground Glass regression evidence, guard output, semantic tests, and before/after scene-capacity measurements in ignored working artifacts and the PR handoff. Do not commit screenshots or target images. Stop after at most three visual worker/critic rounds for human review.
