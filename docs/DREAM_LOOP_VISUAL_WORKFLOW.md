# Dream Loop Visual Workflow

## Purpose and authority

This document prepares a bounded visual-quality pilot. It does not start a production visual redesign. The first pilot is the registered Architecture Rise asset:

- scene: `architecture-rise`
- asset key: `architecture-rise-subject`
- implementation: `src/render/ArchitectureRiseSubjectFactory.tsx`
- optimization surface: the real simulator's observer 3D scene canvas

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

The VCS overlay is at `.agents/skills/vcs-dream-loop-visual-quality/SKILL.md`. Use the separate upstream Dream Loop skill only when an actual user-authorized visual iteration begins. This repository does not vendor the upstream workflow. PR B prepares tools and constraints only; the production pilot follows the Shared Lighting Profile Architecture PR.

## Pilot manifest and write scope

`scripts/dream-loop/pilots/architecture-rise.json` is the machine-readable source for pilot identity, optimization surface, permitted paths, protected paths, verification views, and capture settings.

The only permitted production source path is `src/render/ArchitectureRiseSubjectFactory.tsx`. `.dream-loop/**` holds ignored working artifacts. Every other changed path is outside scope and fails closed, including untracked non-ignored files. The guard reports violations and never reverts them.

The factory contains both visual construction and geometry tied to teaching references. Path approval is not semantic approval: preserve presentation-derived façade placement, focus chart/targets, composition bounds, and all existing optics and task contracts. Reuse `sceneRichnessCoreFoundation.test.ts` and `sceneAssetRegistry.test.ts` for asset placement, registered identity, and lifecycle; keep the existing Architecture Rise focus-range, image-circle, projection, and task tests as regression evidence. Do not copy canonical geometry constants into the manifest.

Do not bypass `ARCHITECTURE_RISE_ASSET_KEY` → `sceneAssetRegistry` → `createArchitectureRiseGroup(...)` → registered observer/RTT consumers. The registered asset remains instance-owned; any later geometry, material, or texture must follow its paired creation/disposal lifecycle. Do not add a Dream Loop-only loader, renderer, or viewport asset.

The explicit protected patterns document the most sensitive paths. The allowlist is broader protection: any file not explicitly permitted fails regardless of whether it is named in `protectedPaths`.

## Deterministic capture

Capture through the public route and the real app:

```bash
npm run dream-loop:capture -- --pilot architecture-rise
```

The harness starts its own Vite server on a dedicated port, uses the viewport and DPR declared in the pilot manifest (1440×1000 CSS pixels and DPR 1 for this pilot), sets observer render quality to `standard`, and uses the public movement-reset and 3D-view-reset controls. A fresh Playwright page supplies isolated browser state; the movement reset establishes the camera preset, and the test checks movement values against that existing scene definition plus focus at its control-declared lower bound. Architecture Rise has no randomized or time-driven subject animation. With `?sceneCapacityProfiling=1`, the harness waits for the existing `scene-capacity-snapshot` and accepts capture only when its `viewportSubject` metrics report non-empty, renderable mesh content. Those metrics come from `TeachingShadowParticipation` collecting the mounted registered-subject root; the camera, ghost camera, lighting, and overlays are outside that root. Renderable metrics respect hidden ancestors, hidden/zero-opacity materials, geometry draw ranges, and instancing. The capture checks the route, registered scene identity, non-fallback state, observer view reset, and canvas dimensions. Sampled screenshot pixel diversity is only a secondary blank/flat-canvas sanity check. There is no arbitrary sleep readiness check.

One run creates two Observer screenshots from the same reset scene state:

1. `observer-teaching.png` is captured first with the normal teaching overlays active. It is a regression and human-review view.
2. The harness uses the existing overlay controls in the public UI to turn off every active scene overlay, including focus plane, DOF region, optical geometry/finite coverage, legends, and Scheimpflug construction when available. It verifies that no overlay choice remains active and that movement, focus, aperture, camera/orbit, render quality, and mounted-subject capacity are unchanged. It then saves `observer-clean.png`, the sole Dream Loop optimization target.

The harness opens the existing `View overlays` menu when the responsive collapsed controls are in use. It does not set app state directly or hide WebGL geometry with CSS. Each screenshot is taken from the observer canvas locator itself, so surrounding DOM controls and diagnostics are not part of the image. Each ignored sidecar records its view role, active overlay choices, deterministic state, mounted-subject evidence, and canvas sanity metrics.

Both outputs, sidecars, and Playwright output remain under ignored `.dream-loop/architecture-rise/`. The canvas screenshots exclude navigation, controls, tasks, feedback, Ground Glass, and 2D Geometry. Ground Glass Processed, Raw, and Upright remain separate regression views; they are not optimization targets.

## Baseline and target

Start each later pilot from a clean, known worktree:

1. Record the baseline commit that the visual worker will build on.
2. Open Architecture Rise at `/simulator/free/architecture-rise` through the simulator capture harness.
3. Confirm the scene identity and reset/default movement and observer state.
4. Capture both Observer views under `.dream-loop/`; use the clean screenshot for appearance work and retain the teaching screenshot for regressions.
5. For this pilot's corrected visual evaluation, make the clean baseline represent `main @ 68f9c6f2a5ee29b379d252ee71009c15c54fe5f6`, not the earlier weak PR image.
6. Use `baseline-main-clean.png` as the image-generation starting point so the target remains the same teaching scene.
7. Save and lock the new target as `.dream-loop/architecture-rise/target-clean.png`. Do not reuse a target generated from an overlay-dominated capture.

Target images may influence material appearance, surface/decorative detail, visual density, realism, texture character, and visual hierarchy. They may not redefine teaching geometry, perspective lesson outcome, lens/camera state, focus-plane behavior, rise amount, image-circle physics, or film orientation. A target that conflicts with a protected contract is invalid even if it looks better.

## Worker and critic loop

For each of at most three worker/critic rounds:

1. Give the worker the current clean Observer capture, locked clean target, user visual direction, manifest write scope, and immutable constraints. Keep the teaching Observer as a regression view.
2. Allow edits only to the permitted Architecture Rise asset implementation path.
3. Run the write-scope guard against the clean iteration baseline:

   ```bash
   npm run dream-loop:guard -- --pilot architecture-rise --base <baseline-commit>
   ```

4. Run focused semantic and registered-asset regression tests.
5. Capture the live Observer pair again with the deterministic harness.
6. Have the critic compare the clean Observer capture to the target. Review the teaching capture for regressions only.
7. Translate critic notes into visual-only changes. Reject any recommendation that moves a protected semantic feature.

After three rounds, stop for human review. There is no autonomous unbounded loop.

The observer is the sole optimization target. Ground Glass Raw and Ground Glass Upright are regression views only; preserve their physical orientation and film mapping. Use existing Ground Glass tests to check both modes after an asset change. Both consumers continue using the same registered asset factory.

## Lighting and performance boundaries

PR C establishes two illumination categories: physical/in-world sources owned by the represented scene (including Interior Corner's registered practical light), and the shared `teaching-default` presentation-assist rig. The rig recipe, scene placement resolver, and current light sources are fixed for this pilot. Dream Loop may not arbitrarily modify either physical/in-world or presentation-assist lighting unless a later PR explicitly grants that permission. A target screenshot does not define lighting physics or teaching semantics. Do not change light direction/intensity, shadow-map policy, tone mapping, renderer exposure, environment lighting, or lighting architecture, and do not reshape scene geometry to compensate for the current lighting.

Later visual-enrichment work should compare before/after with the existing `npm run benchmark:scene-capacity` and, where useful, `npm run benchmark:scene-capacity:hardware` infrastructure. Treat mesh/object/geometry/material/texture/triangle counts, effective instanced triangles, available renderer resource counts, Ground Glass RTT timing, and frame cadence as decision evidence. Do not invent FPS or capacity pass/fail thresholds, and do not run the full scene-capacity matrix for every ordinary visual iteration.

## Human review and next boundary

PR B should leave every production scene visually unchanged. Its capture is a working baseline, not a committed target. After PR B, the next architecture step is Shared Lighting Profile Architecture. Only after that is merged should a separately authorized Architecture Rise Visual Quality Pilot use Dream Loop, the bounded manifest, deterministic observer capture, Raw/Upright regression checks, and before/after capacity evidence.
