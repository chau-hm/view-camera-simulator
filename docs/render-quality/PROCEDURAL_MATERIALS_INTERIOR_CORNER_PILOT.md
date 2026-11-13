# Procedural Materials v2 — Interior Corner Pilot

## Decision

**PASS**

Review-Fix Round 1 resolves the two remaining visual blockers. At the normal 514 × 411 Observer canvas, the bench's low-contrast crossed threads are discernible at the selected `[0.5, 0.5]` repeat while remaining subordinate to the teaching targets. The exact Interior Corner ceiling mesh remains visible and lit, but no longer casts the large diagonal shadow onto the walls. Wall and furniture contact shadows remain. The original paper, wood, plaster, rug, geometry, camera, optics, and teaching behavior are preserved.

The rug retains its previous checker recipe because the procedural fabric sample remained flat at ordinary size. No shared texture-generator changes were needed in this review-fix round.

## Source and implementation

| Reference | Commit |
| --- | --- |
| Original `origin/main` baseline | `7d2a5141b6fe9f76ebd30cb5d0c90fec439e0615` |
| A1 shared material library | `43b2f1fb8e82883baea51dcb575cc1eafd904732` |
| A2 Interior Corner integration | `46705e79ea70ed6c1607bd5ecf87604f18f34206` |
| Review-Fix Round 1 implementation | `097c587619641332a364e7198c70aec34d3f0ac6` |

`ProceduralSurfacePattern` now adds `paper` and `fabric`. Both use the existing synchronous, seeded 128 × 128 `DataTexture` path and return `MeshStandardMaterial` with albedo, roughness and normal maps. Albedo remains sRGB; data maps remain untagged. Repeat wrapping, mip filtering and subject-owned disposal are unchanged. No loading, cache, shader, dependency, renderer or lifecycle layer was added.

The five existing map outputs (`limestone`, `cut-stone`, `concrete`, `plaster`, `wood`) match the pre-change albedo, roughness and normal byte hashes. Wood and plaster generator branches were left unchanged.

Interior Corner assignments:

- Art-panel base surfaces use `paper` at the existing teal color (`#66808a`), roughness `0.96`, normal strength `0.035`. Orange artwork accents and wood frames remain unchanged.
- Bench seat and back use `fabric` at the existing muted teal (`#6d7b78`), repeat `[0.5, 0.5]`, roughness `0.98`, normal strength `0.18` after Review-Fix Round 1.
- The rug keeps its former subtle-checker material after the shared fabric sample looked less convincing at the normal Observer size.
- Wall and ceiling plaster, wooden floor and furniture, trim, metal, geometry, light types/positions/intensities, subject registration and disposal ownership are unchanged. The ceiling's shadow-caster participation is the only shadow-policy exception; see Review-Fix Round 1 below.

The new library recipes are suitable for reuse by other registered teaching subjects. `InteriorCornerSubjectFactory` still supplies the one shared subject consumed by Observer and Ground Glass.

## Matched visual and optical evidence

Baseline and final captures used `/simulator/free/interior-corner`, 1440 × 1000 viewport, DPR 1, Standard quality, Chromium, WebGL2 and Three.js r187. The browser selected the existing WebGL Ground Glass RTT/GLSL DOF path with no application fallback. The baseline Observer state was scene view, camera `(-6.6, 2.9, -5.6)`, orbit target `(0.45, 0.85, 6.7)`, focus 8000 mm, f/5.6, and neutral movements. The final capture sidecars record matching Before/After camera, focus, aperture, movement, preview, canvas size and renderer identity for each shared capture ID.

- **Observer clean:** plaster and wood retain their previous appearance; paper stays subordinate to the colored art and accents. The rug retains its prior texture. Bench color stays stable, but its weave does not read clearly enough at the normal canvas size, which is the remaining material-quality blocker.
- **Observer teaching:** the same subject and teaching overlays render. Focus, DOF, legends and optical overlays remain available; no overlay or composition changes were made.
- **Ground Glass:** Processed uses Raw orientation with DOF enabled; Raw uses the existing Raw RTT bypass control; Upright uses Upright Assist with DOF enabled. Film-image orientation was not normalized or edited. All three modes render contentfully with the current completed frame request.
- **Movements:** public Front Rise `33 mm` and Front Swing `3.6°` states were captured in Observer and Ground Glass. Swing used its established public focus value, `38140 mm`.

### Focus and aperture matrix

The targets share the receding wall's x/y position at `x = 2392 mm`, `y = 1850 mm`, with z anchors at 5800, 8000 and 10400 mm. The lens datum is at the origin and the neutral optical axis points along +Z. With rise and swing neutral, the existing model's focused plane is parallel to the film plane at the selected object-depth. The values below therefore focus the actual target plane; they were not inferred from z without the optical model. Each focus setting was entered through the public Focus slider, whose range is 4000–40000 mm with 10 mm steps. Each aperture is an existing public radio value.

| Target | Public focus control | f/5.6 | f/11 | f/22 |
| --- | ---: | --- | --- | --- |
| Near | 5800 mm | Captured | Captured | Captured |
| Middle | 8000 mm | Captured | Captured | Captured |
| Far | 10400 mm | Captured | Captured | Captured |

All nine records have distinct image hashes, focus/aperture states that match their labels, and Ground Glass request IDs equal to the last completed request both before and after screenshot capture. All frames were contentful and reported the same `webgl-renderer / webgl2 / r187` identity. Focus and aperture controls did not change any optics, sharpness scoring, movement policy or task code. Fine surface patterns remain low contrast in these views; no prominent moiré or material detail that obscures the focus comparison was observed at the captured size.

The complete Before/After captures, request metadata, image hashes and baseline lock are under the Git-ignored `.dream-loop/interior-corner/` directory. Screenshot artifacts are intentionally not committed.

## Resources and performance

The repository scene-capacity benchmark ran with 60 fresh samples for Processed and Processed Loupe, and its existing isolated Raw RTT sample. Both runs used Chromium 149, viewport 1440 × 1000 at DPR 1, WebGL with ANGLE/SwiftShader, the CPU-fallback profiler and `cpu-submit-ms` timings.

| Metric | Baseline | Final | Change |
| --- | ---: | ---: | ---: |
| Subject objects / meshes | 82 / 72 | 82 / 72 | — |
| Unique geometries / triangles | 61 / 952 | 61 / 952 | — |
| Unique materials | 10 | 10 | — |
| Unique subject textures | 17 | 22 | +5 |
| Renderer geometries / textures | 62 / 28 | 62 / 33 | +5 textures |

| Ground Glass mode | Frame p95 (ms) | Scene CPU-submit p95 (ms) | RTT CPU-submit p95 (ms) | DOF CPU-submit p95 (ms) |
| --- | ---: | ---: | ---: | ---: |
| Processed, baseline → final | 537.4 → 504.6 | 0.4 → 0.5 | 0.5 → 0.6 | 0.1 → 0.1 |
| Processed Loupe, baseline → final | 672.2 → 632.4 | 0.4 → 0.4 | 0.5 → 0.5 | 0.1 → 0.1 |
| Raw RTT, baseline → final | 75.1 → 66.1 | 0.6 → 0.5 | 0.6 → 0.5 | bypassed |

Approximate frame cadence was 2.05 → 2.10 FPS for Processed, 1.73 → 1.94 FPS for Loupe, and 15.87 → 18.81 FPS for Raw RTT. These are software-rendered frame cadence estimates, not hardware FPS. GPU timers were unavailable, so GPU execution times are `null`. The five extra renderer textures are attributable to the paper maps and the fabric maps replacing the former single upholstery texture; meshes, geometry, triangles and material count did not increase. CPU-submit changes are at most 0.1 ms at p95 in this run.

## Validation

- Procedural material tests: **39 passed**. These cover deterministic bytes, legacy output hashes, distinct signatures, 128 × 128 maps, color spaces, wrapping/filtering, normal construction, restrained variation, boundary continuity and subject-owned disposal.
- Focused scene/render/optics set: **156 passed across 9 files**, including Interior Corner registration/disposal, shared subject remount lifecycle, focus reachability, focus calibration, optics derivation and Ground Glass stage/renderer tests.
- `npm test`: **330 files, 4064 tests passed** on the final full run. One earlier full run had a temporary synthetic-checkout `ENOENT` in the unrelated M7M readiness test; its file passed alone (63 tests), and the subsequent full run passed.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`: passed.
- `npm run dream-loop:capture -- --pilot interior-corner`: passed for the final Observer clean/teaching pair.
- Ground Glass browser matrix: 16 real-app captures including the 9-state focus matrix, three Ground Glass modes and Rise/Swing Observer plus Ground Glass states; 14 frames validated complete/contentful with no page errors.
- `npm run dream-loop:guard -- --pilot interior-corner --base 43b2f1fb8e82883baea51dcb575cc1eafd904732`: passed with only the A2 scene factory in scope.
- Baseline and final `npm run benchmark:scene-capacity`: passed with matching viewport, DPR, backend and sampling configuration.
- `git diff --check`: passed.

`npm run ci:local:e2e` was not run: renderer selection, shaders, RTT ownership and scene lifecycle were unchanged; the requested Ground Glass states were exercised directly through the public route and controls in the real-browser capture. GPU timing and hardware-renderer performance were unavailable because this environment used SwiftShader.

## Reproduction

```bash
npm run dream-loop:capture -- --pilot interior-corner
npm run dream-loop:guard -- --pilot interior-corner --base 43b2f1fb8e82883baea51dcb575cc1eafd904732
npm run benchmark:scene-capacity
npm test -- --run src/tests/unit/proceduralSurfaceMaterials.test.ts
```

The broader final suite also ran `npm test`, `npm run typecheck`, `npm run lint`, `npm run check:css` and `npm run build`.

## Review-Fix Round 1

### Previous findings and selected corrections

The previous review identified insufficient ordinary-size bench-weave readability and a broad diagonal shadow from the ceiling mesh. Review-Fix Round 1 kept the procedural library and lighting rig fixed and changed only the bench material repeat plus the ceiling's caster participation.

| Candidate | Fabric repeat | Ceiling state | Ordinary Observer result |
| --- | ---: | --- | --- |
| PR #334 HEAD | `[2, 2]` | casts | The fine weave is difficult to distinguish on the small, dark bench. |
| First candidate | `[1, 1]` | casts | Slightly larger surface detail, still too subtle at 514 × 411. |
| Second candidate | `[0.75, 0.75]` | casts | The weave continues to filter out at ordinary size. |
| Selected | `[0.5, 0.5]` | casts | Faint crossed threads become discernible without increasing contrast or relief; no obvious checker appearance. |
| Final scene | `[0.5, 0.5]` | ceiling excluded | Same selected fabric scale, with the diagonal wall shadow removed. |

Every fabric candidate kept color `#6d7b78`, roughness `0.98`, and normal strength `0.18`. The selected repeat changes only texture scale. A diagnostic 4× crop confirms the thread structure; ordinary-size Observer captures remain the primary decision evidence.

The shadow cause was the shared `configureTeachingShadowParticipation()` policy, which opts every lit non-helper subject mesh into shadow casting. This round adds an exact-name exclusion for `interior-corner-ceiling` in `TeachingLighting.tsx`. The ceiling remains a visible `MeshStandardMaterial` surface; the lighting rig and all other caster/receiver decisions remain unchanged. A focused unit test proves that the ceiling does not cast while the wall still casts and receives, and that the ceiling remains visible and lit. The same registered subject and helper serve Observer and Ground Glass.

### Observer evidence

The final clean Observer capture at 514 × 411 shows the ceiling shadow removed from the walls. The room reads more evenly while contact shadows under the bench and furniture and shadows around the wall trim/art remain. Teaching Observer overlays remain present and legible.

Small actual-browser contact sheets (each source panel is the original 514 × 411 canvas at 1:1) are in the ignored local evidence directory:

- Fabric A/B: `.dream-loop/interior-corner/review-fix-1/observer-fabric-ab.png` — PR HEAD `[2, 2]` versus selected `[0.5, 0.5]`, with the ceiling casting in both.
- Ceiling A/B: `.dream-loop/interior-corner/review-fix-1/observer-ceiling-shadow-ab.png` — `[0.5, 0.5]` with ceiling casting versus the same material with the ceiling excluded.
- Final Clean/Teaching pair: `.dream-loop/interior-corner/review-fix-1/observer-final-clean-teaching.png`.

The browser images are real application captures; no target image or screenshot content was generated or edited. The GitHub connector does not support image upload, so these images were not attached to the PR. They can be attached manually from this worktree with:

```bash
swift -module-cache-path .dream-loop/interior-corner/review-fix-1/swift-module-cache .dream-loop/interior-corner/review-fix-1/make-contact-sheets.swift
```

### Focus, aperture, and Ground Glass

The real-browser run used `/simulator/free/interior-corner`, 1440 × 1000 viewport, DPR 1, Standard quality, and WebGL2/r187. The nine publicly reachable states remain unchanged:

| Target | Focus control | f/5.6 | f/11 | f/22 |
| --- | ---: | --- | --- | --- |
| Near | 5800 mm | Completed/contentful | Completed/contentful | Completed/contentful |
| Middle | 8000 mm | Completed/contentful | Completed/contentful | Completed/contentful |
| Far | 10400 mm | Completed/contentful | Completed/contentful | Completed/contentful |

Each matrix capture used neutral Front Rise/Front Swing, the labelled public focus/aperture control values, and a completed current Ground Glass request ID before and after its screenshot. All nine images are distinct; all Ground Glass captures were contentful on the same `webgl-renderer / webgl2 / r187` backend, with no browser page errors. The captured fabric remains subordinate and does not leave high-frequency detail unnaturally sharp in the defocused states. No new moiré or aliasing was visible at ordinary canvas size.

Processed, Raw RTT bypass, and Upright captures have distinct hashes and retain their existing film-image orientation behavior. Front Rise `33 mm` and Front Swing `3.6°` (focus `38140 mm`) were captured in Observer and Ground Glass. The shadow change brightens the wall area in the same way in Ground Glass; no RTT, coordinate, optics, focus, or orientation code changed. The 16 matrix captures and sidecars are in `.dream-loop/interior-corner/review-fix-1/final/`.

### Resource and performance comparison

The scene-capacity benchmark compared A2 commit `46705e79ea70ed6c1607bd5ecf87604f18f34206` with review-fix source commit `097c587619641332a364e7198c70aec34d3f0ac6` using Chromium 149, 1440 × 1000, DPR 1, WebGL/ANGLE SwiftShader, and the same 60-sample scene-capacity settings.

| Metric | A2 | Review-Fix 1 | Change |
| --- | ---: | ---: | ---: |
| Objects / meshes | 82 / 72 | 82 / 72 | — |
| Unique geometries / triangles | 61 / 952 | 61 / 952 | — |
| Unique materials | 10 | 10 | — |
| Unique subject textures | 22 | 22 | — |
| Renderer geometries / textures | 62 / 33 | 62 / 33 | — |

| Ground Glass mode | Frame p95 (ms) | RTT CPU-submit p95 (ms) | DOF CPU-submit p95 (ms) |
| --- | ---: | ---: | ---: |
| Processed, A2 → final | 504.6 → 509.6 | 0.6 → 0.5 | 0.1 → 0.2 |
| Processed Loupe, A2 → final | 632.4 → 559.3 | 0.5 → 0.5 | 0.1 → 0.1 |
| Raw RTT, A2 → final | 66.1 → 60.1 | 0.5 → 0.5 | bypassed |

The benchmark found no additional texture, geometry, material, or renderer-resource allocation from the repeat or caster change. GPU timer queries were unavailable: the reported RTT and DOF values are CPU-submit timing, while frame cadence is from SwiftShader and is not hardware FPS or GPU execution time.

### Validation and write-scope exception

- Focused material, registered-subject, disposal/remount, teaching-shadow, optics, and Ground Glass suites: **164 tests across 10 files passed**.
- `npm test`: **330 files, 4,065 tests passed**.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and `git diff --check`: passed.
- Final `npm run dream-loop:capture -- --pilot interior-corner`: passed for Clean and Teaching Observer.
- Final 16-capture browser matrix: passed; 14 Ground Glass requests were completed/contentful and all request IDs matched at screenshot time.
- Final `npm run benchmark:scene-capacity`: passed with 60 samples per principal mode.
- The per-pilot guard passed during the isolated factory-only fabric iteration against reviewed HEAD `865ed077e4414da274a3a10f40d17806220c4890`. After the authorized ceiling fix, the same guard reported only `src/render/TeachingLighting.tsx` and `src/tests/unit/teachingLighting.test.ts` outside the existing allowlist. The manifest was not changed; this exact shared-helper/test exception is necessary because the helper reapplies caster state to both Observer and RTT subjects.
- The original A1-based cumulative guard was not rerun: its full diff already includes the existing report document outside the allowlist, so it cannot isolate Round 1. The reviewed-HEAD baseline was used for the new round.
- GitHub Actions on the previously reviewed PR head `865ed077e4414da274a3a10f40d17806220c4890` and review-fix implementation commit `097c587619641332a364e7198c70aec34d3f0ac6` completed successfully. The implementation run was workflow run `43473665553` (run 2029); the final documentation-only PR head check is recorded in the PR handoff.

The remaining limitation is that the weave is intentionally low-contrast and subtle. The selected texture scale makes it discernible on the normal canvas without making the small bench visually dominant.
