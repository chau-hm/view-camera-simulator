# Procedural Materials v2 — Interior Corner Pilot

## Decision

**NEEDS_REVISION**

The shared paper and fabric recipes are deterministic, reusable, and follow the existing material and disposal contracts. The art panels keep their authored colors and marks, while walls, ceiling, floor, trim, furniture and frames retain their existing plaster or wood recipes. The bench weave is still too subtle on the normal 514 × 411 Observer canvas to read clearly as woven fabric. The rug was returned to its previous checker recipe after the procedural fabric sample read as a flat patch at this size.

Smallest next correction: tune the bench's scene-specific fabric repeat from `2 × 2` toward `1 × 1` using the existing fabric recipe, then recapture Observer and the focus/aperture matrix to check ordinary-size readability and aliasing. No further material rounds were made after the three-round Dream Loop limit.

## Source and implementation

| Reference | Commit |
| --- | --- |
| Original `origin/main` baseline | `7d2a5141b6fe9f76ebd30cb5d0c90fec439e0615` |
| A1 shared material library | `43b2f1fb8e82883baea51dcb575cc1eafd904732` |
| A2 Interior Corner integration | `46705e79ea70ed6c1607bd5ecf87604f18f34206` |

`ProceduralSurfacePattern` now adds `paper` and `fabric`. Both use the existing synchronous, seeded 128 × 128 `DataTexture` path and return `MeshStandardMaterial` with albedo, roughness and normal maps. Albedo remains sRGB; data maps remain untagged. Repeat wrapping, mip filtering and subject-owned disposal are unchanged. No loading, cache, shader, dependency, renderer or lifecycle layer was added.

The five existing map outputs (`limestone`, `cut-stone`, `concrete`, `plaster`, `wood`) match the pre-change albedo, roughness and normal byte hashes. Wood and plaster generator branches were left unchanged.

Interior Corner assignments:

- Art-panel base surfaces use `paper` at the existing teal color (`#66808a`), roughness `0.96`, normal strength `0.035`. Orange artwork accents and wood frames remain unchanged.
- Bench seat and back use `fabric` at the existing muted teal (`#6d7b78`), repeat `[2, 2]`, roughness `0.98`, normal strength `0.18`.
- The rug keeps its former subtle-checker material after the shared fabric sample looked less convincing at the normal Observer size.
- Wall and ceiling plaster, wooden floor and furniture, trim, metal, geometry, lighting, subject registration and disposal ownership are unchanged.

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
