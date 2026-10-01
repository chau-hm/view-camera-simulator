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

The harness starts its own Vite server on a dedicated port, uses the viewport and DPR declared in the pilot manifest (1440×1000 CSS pixels and DPR 1 for this pilot), sets observer render quality to `standard`, and uses the public movement-reset and 3D-view-reset controls. A fresh Playwright page supplies isolated browser state; the movement reset establishes the camera preset, and the test checks movement values against that existing scene definition plus focus at its control-declared lower bound. Architecture Rise has no randomized or time-driven subject animation. The harness checks the route, registered scene identity, non-fallback state, observer view reset, canvas dimensions, and sampled screenshot pixel content before saving. It hides only interactive DOM controls whose bounds overlap the canvas, so the observer target excludes viewport buttons without hard-coded desktop crops. A sidecar JSON records the capture state. There is no arbitrary sleep readiness check.

The output is `.dream-loop/architecture-rise/observer-baseline.png`; the sidecar and Playwright output are also ignored. The canvas screenshot excludes navigation, controls, tasks, feedback, Ground Glass, and 2D Geometry.

## Baseline and target

Start each later pilot from a clean, known worktree:

1. Record the baseline commit that the visual worker will build on.
2. Open Architecture Rise at `/simulator/free/architecture-rise` through the simulator capture harness.
3. Confirm the scene identity and reset/default movement and observer state.
4. Capture the observer baseline under `.dream-loop/`.
5. Use that existing scene image as the image-generation starting point so the target remains the same teaching scene.
6. Save the generated target as `.dream-loop/target.png` and lock it for the iteration run.

Target images may influence material appearance, surface/decorative detail, visual density, realism, texture character, and visual hierarchy. They may not redefine teaching geometry, perspective lesson outcome, lens/camera state, focus-plane behavior, rise amount, image-circle physics, or film orientation. A target that conflicts with a protected contract is invalid even if it looks better.

## Worker and critic loop

For each of at most three worker/critic rounds:

1. Give the worker the current observer capture, locked target, user visual direction, manifest write scope, and immutable constraints.
2. Allow edits only to the permitted Architecture Rise asset implementation path.
3. Run the write-scope guard against the clean iteration baseline:

   ```bash
   npm run dream-loop:guard -- --pilot architecture-rise --base <baseline-commit>
   ```

4. Run focused semantic and registered-asset regression tests.
5. Capture the live observer canvas again with the deterministic harness.
6. Have the critic compare the current observer capture to the target.
7. Translate critic notes into visual-only changes. Reject any recommendation that moves a protected semantic feature.

After three rounds, stop for human review. There is no autonomous unbounded loop.

The observer is the sole optimization target. Ground Glass Raw and Ground Glass Upright are regression views only; preserve their physical orientation and film mapping. Use existing Ground Glass tests to check both modes after an asset change. Both consumers continue using the same registered asset factory.

## Lighting and performance boundaries

Current `TeachingLighting` is fixed for capture and belongs to the shared lighting implementation. Do not change lights, direction/intensity, shadow-map policy, tone mapping, renderer exposure, environment lighting, or the lighting architecture during this pilot. Do not reshape scene geometry to compensate for current lighting.

Later visual-enrichment work should compare before/after with the existing `npm run benchmark:scene-capacity` and, where useful, `npm run benchmark:scene-capacity:hardware` infrastructure. Treat mesh/object/geometry/material/texture/triangle counts, effective instanced triangles, available renderer resource counts, Ground Glass RTT timing, and frame cadence as decision evidence. Do not invent FPS or capacity pass/fail thresholds, and do not run the full scene-capacity matrix for every ordinary visual iteration.

## Human review and next boundary

PR B should leave every production scene visually unchanged. Its capture is a working baseline, not a committed target. After PR B, the next architecture step is Shared Lighting Profile Architecture. Only after that is merged should a separately authorized Architecture Rise Visual Quality Pilot use Dream Loop, the bounded manifest, deterministic observer capture, Raw/Upright regression checks, and before/after capacity evidence.
