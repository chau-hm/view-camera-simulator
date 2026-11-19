# Architecture Rise v2 Visual Gap and Screen-Space Audit

**Status:** PR F0 research only. No scene implementation, Dream Loop round, or canonical teaching change is included.

## Executive finding

At the default Observer pose, the building occupies about **22% of the canvas width and 37% of its height**. The current scene already contains deep windows, a layered entry, a coursed stone base, corner quoins, a cornice with returns, and parapet detailing. The main visual gap is therefore not a lack of those component families. It is the weaker *whole-facade hierarchy*: the main elevation has corner pilaster strips and a base string course, but no intermediate storey course to organize the large wall field between the entry/base and upper window groups.

A second, directly measured limit is screen size. In the normal Observer canvas, the six canonical Fine Detail lines project to about **8.81 × 0.37 CSS px each**; an individual top-center sill bracket projects to roughly **1.9 CSS px high**. These objects exist in geometry but sit at or below a stable screen-space reading at the default view. Expanding the 3D viewport increases their pixel extent while preserving the camera pose and facade-to-canvas height ratio. A closer view increases subject scale but changes camera distance.

The evidence supports one bounded PR F1 geometry study: **a shallow front-elevation story course above the entry**, ending flush into the existing corner pilasters. Its proposed 60×58 mm face/depth section projects to a broad, measurable 72.58×7.77 CSS-pixel bounding envelope at the normal camera pose while remaining below the canonical focus-chart quiet zone. Use actual physical-lens raycasts and matched default/expanded/close captures to decide whether it improves the facade hierarchy. The coordinate proposal below is a starting point for that study, not a new teaching or optical contract.

**F0 conclusion:** the current gaps are a combination of a real facade-articulation gap and a default-view screen-space limit. PR E's rejected parameter candidates do not establish that adding a missing structural articulation family cannot help. The approved ImageGen images remain design references only; they are not calibrated comparisons.

## Authority and scope

This audit uses the current `main` implementation at `fda74581fc71467bef5245bdcdeb46f9236b07cc`. The planning authority remains the merged [Architecture Rise v2 contract map](architecture-rise-v2-contract-map.md), [design specification](architecture-rise-v2-design-spec.md), and [PR sequence](architecture-rise-v2-pr-sequence.md). The current implementation evidence is the [subject factory](../../src/render/ArchitectureRiseSubjectFactory.tsx), [presentation layout](../../src/scenes/presentation/architectureRiseLayout.ts), [canonical geometry](../../src/scenes/architectureRiseGeometry.ts), and the detail modules under [`src/render/architecture-rise`](../../src/render/architecture-rise/ArchitectureRiseDetailConfig.ts).

This is a documentation and measurement result. It does not change the scene route, registered asset, task, optics, camera, focus target, checkerboard, fine-detail assembly, light rig, Ground Glass mapping, renderer, or resource lifecycle. It does not start PR F1.

## Capture and measurement method

### Actual Observer captures

The official clean Observer capture was made with the repository Dream Loop harness:

```bash
npm run dream-loop:capture -- --pilot architecture-rise
```

The deterministic capture is byte-identical to the current F0 normal-view image. Additional views were captured in a real Chromium browser through the public scene controls. The 1440×1000 browser viewport, DPR 1, standard quality, WebGL2 / Three.js r187, focus 3090 mm, aperture f/11, and zero Rise/Tilt/Swing were held constant.

| View | Canvas CSS size | Camera position → orbit target (m) | Input |
| --- | ---: | --- | --- |
| Normal Observer | 514×410.4 | `(6.5, 3, -6.5)` → `(0, 0.9, 5.6)` | Official reset, public focus slider Home to 3090 mm, overlays off |
| Expanded Observer | 1074×763 | `(6.5, 3, -6.5)` → `(0, 0.9, 5.6)` | Public Expand 3D Scene button; no camera input |
| Close facade | 514×410.4 | `(4.096621, 2.075947, -2.944276)` → `(0, 0.9, 5.6)` | Public Reset 3D view, then five public wheel zoom steps (`−360`) centered on facade |

The expanded canvas leaves camera position, target, and 45° vertical FOV unchanged. It changes the rendering area, not the viewpoint. Close facade is a different camera distance and is not treated as a matched default-view comparison. The renderer drawing buffer is approximately 1.5× the CSS canvas dimensions; screenshots are browser renders, not hardware-GPU performance measurements.

### Projection from mounted subject geometry

The analysis generates the registered subject using `createArchitectureRiseGroup(ARCHITECTURE_RISE_PRESENTATION)`, walks its actual Three.js meshes, obtains each transformed `Box3`, and projects its corners through a Three.js `PerspectiveCamera` matching the recorded live Observer pose and `SceneRenderer.tsx` camera contract: 45° vertical FOV, near 0.01 m, far 200 m, and +Y up. The R3F camera object is not exposed through the application's DOM, so its matrix was reconstructed from the live public pose and inspected camera properties; overlay alignment was checked against all three browser captures.

The resulting family bounds are **potential projected geometry envelopes**, not segmented visible pixels. A large union envelope can span multiple disjoint objects. The supplementary first-hit diagnostic casts four rays through quarter points on each selected mesh's camera-facing bounding-box face against the actual factory meshes. A hit is only a sampled first-hit surface point; it is not a visibility percentage, full surface test, or pixel coverage measure. The full output and script are retained in the ignored evidence directory listed below.

The generated factory subject is 465 meshes / 6,242 effective triangles / 73 unique geometries / 17 materials / 18 textures. These counts match the official Ground Glass RTT subject snapshot. The official Observer snapshot is 466 meshes / 6,722 triangles and has one additional mesh, one geometry, and one material; the sidecar does not identify that Observer-only object. The projection is of the registered factory asset, not an assertion that it contains every renderer wrapper object.

### PR E evidence

The completed PR E evidence archive SHA-256 was `573565b167f9a55653ac15cdfeb10e1e4e6784c566f82fb21f1474c6d9b363af3`; its internal checksum manifest was verified before selecting the evidence used here. PR E changed only existing window values in Round 1, then stone-base and cornice values in Round 2. Both candidates passed their geometry/material/visibility guards but were rejected by independent critics for no dependable improvement at the actual 514×411 default Observer scale. Round 2 added 13 Observer meshes and 252 triangles without changing unique geometry/material/texture counts. PR E did not perturb material recipes or material parameters; it therefore says nothing causal about the visual leverage of those controls.

The documented PR E conclusion remains `DETAIL_PARAMETER_CAPABILITY_LIMIT`: after two unsuccessful parameter-only candidates, the next useful experiment should test a missing articulation capability, not repeat those candidates. See the selected [PR E parameter audit and round evidence](#evidence-and-reproduction).

## What is already present

The following are actual mounted geometry or material behavior, confirmed in the factory and detail modules:

| Family | Current implementation | Audit implication |
| --- | --- | --- |
| Main facade | 65 segmented wall meshes; upper running-bond brick and a 12-mesh stone base with 14 bed/head joints | Masonry and base geometry exist; broad facade hierarchy remains restrained |
| Base and corners | 28 raised quoins, two 80 mm full-height corner strips, base string-course and foot accents | Classical edge/base cues exist; intermediate front-elevation bay separators do not |
| Front windows | Seven panes; frames/reveals, mullions/transoms, stone jambs/lintels, caps, keystones, sill brackets and recessed glazing | Window detailing is present; much of its relief is small at default screen scale |
| Entry | 18-mesh assembly with leaf, panels, jambs, lintel/cap/keystone, engaged pilasters, plinths, threshold and step | Entry is already a real architectural assembly, not a missing door surround |
| Roofline | 12 cornice band/return pieces, seven support brackets, 17 parapet/coping pieces | Cornice, returns, parapet and coping exist; their default-view projected thickness is modest |
| Service return and context | Attached return with two east windows, sidewalk/curb seams, street sign and depth references | The composition intentionally includes a broad street/context field around the subject |
| Materials | Deterministic running-bond texture with world-aligned UVs, physical 220×68 mm bricks and 8 mm joints; separate limestone base and trim recipes | Existing material systems should be retained; this audit did not vary them |

The current [window construction](../../src/render/architecture-rise/ArchitectureRiseWindowDetails.ts), [masonry](../../src/render/architecture-rise/ArchitectureRiseMasonry.ts), [cornice](../../src/render/architecture-rise/ArchitectureRiseCornice.ts), [entry](../../src/render/architecture-rise/ArchitectureRiseEntrance.ts), and [brick material](../../src/render/architecture-rise/ArchitectureRiseBrickMaterial.ts) implement those families. The principal absence is a main-facade storey transition between the entry/base and upper window groups. The broad inter-storey wall area is available in geometry, but the only continuous horizontal hierarchy is the base and roofline.

## Measured screen-space schedule

All dimensions below are aggregate or individual potential projected envelopes in **CSS pixels**, measured at the stated camera conditions. Normal/expanded are the same pose at different canvas sizes; close is a zoomed pose. Rows with a family union can combine separated pieces. Individual top-center and fine-line rows are provided where the union would overstate any one piece's size.

| Feature | Meshes | Normal 514×410 | Expanded 1074×763 | Close 514×410 | Interpretation |
| --- | ---: | ---: | ---: | ---: | --- |
| Primary building + attached return | 350 | 112.41×150.76 | 208.99×280.29 | 147.88×205.53 | 21.9% canvas width × 36.7% height normally; 28.8% × 50.1% close |
| Main brick wall segments | 65 | 89.72×115.85 | 166.80×215.40 | 118.86×157.53 | Main brick field is readable; the world-space bounding union excludes an interpretation as one contiguous surface |
| Stone base wall segments | 12 | 79.24×26.08 | 147.33×48.48 | 104.62×34.37 | Distinct base band is already present |
| Stone base bed/head joints | 14 | 75.38×16.67 | 140.15×30.99 | 103.86×21.69 | Joint rhythm exists in geometry and is more legible close-up |
| Raised corner quoins | 28 | 79.57×111.87 | 147.93×208.00 | 109.62×151.82 | Strong corner mass is already present |
| Corner pilaster strips | 2 | 79.20×128.43 | 147.25×238.78 | 109.19×174.75 | The union spans both corners; each strip is narrow, while the main elevation has no matching intermediate strips |
| Seven front glazing panes (union) | 7 | 60.58×105.75 | 112.64×196.61 | 83.30×141.63 | Window apertures are already substantial, separated elements |
| Front frames/reveals/mullions/transoms (union) | 42 | 62.58×107.45 | 116.36×199.78 | 85.93×144.22 | Assembly envelope includes full row-to-row spread |
| Front stone surrounds/caps/brackets (union) | 56 | 68.97×115.21 | 128.23×214.21 | 94.92×155.23 | Details exist; this union is not one surround's projected size |
| Top-center window assembly | 16 | 19.30×18.49 | 35.88×34.38 | 26.39×25.21 | Representative individual upper assembly |
| Top-center glazing | 1 | 11.03×9.89 | 20.51×18.38 | 15.13×13.44 | Actual pane remains a small but coherent opening at default scale |
| Top-center lintel cap | 1 | 18.95×0.83 | 35.24×1.54 | 25.93×1.93 | Sub-pixel-to-thin edge in default view |
| Top-center sill cap | 1 | 19.19×1.26 | 35.69×2.34 | 26.25×1.37 | Sub-pixel-to-thin edge in default view |
| Top-center sill brackets (pair union) | 2 | 15.86×1.86 | 29.49×3.46 | 21.68×2.18 | Their projected vertical thickness is small at normal scale |
| Entrance assembly | 18 | 26.93×47.20 | 50.07×87.75 | 36.03×63.39 | Real entry treatment, clearly larger close |
| Main cornice bands and returns | 12 | 95.61×5.83 | 177.77×10.83 | 126.45×14.32 | Continuous line is present but shallow in normal view |
| Cornice brackets (union) | 7 | 75.92×2.64 | 141.16×4.91 | 104.73×6.62 | Repeated bracket silhouettes are near the normal-view pixel limit |
| Roofline/parapet/coping | 17 | 93.68×20.86 | 174.17×38.78 | 124.09×35.29 | The roofline exists; close view reveals greater depth |
| Service return and east windows | 35 | 25.32×89.97 | 47.08×167.27 | 31.51×118.75 | Return is attached and occupies little normal-view width |
| Canonical focus checker + crosshair (union) | 66 | 20.83×23.33 | 38.73×43.37 | 28.73×30.85 | Protected and prominent relative to individual trim pieces |
| Fine-detail assembly (panel, frame/grid, six lines) | 15 | 11.08×13.22 | 20.60×24.58 | 15.35×17.67 | Complete teaching assembly envelope |
| Representative inner vertical grid bar | 1 | 0.98×12.94 | 1.83×24.06 | 1.31×17.53 | Narrow line; horizontal raster support is limited normally |
| Representative inner horizontal grid bar | 1 | 10.64×0.86 | 19.79×1.60 | 14.80×0.78 | Sub-pixel height in normal and close captures |
| Fine-detail lines 1–6 (each) | 1 each | 8.81×0.37 to 8.82×0.40 | 16.38×0.68 to 16.39×0.74 | 12.27×0.24 to 12.28×0.29 | Each line is a real mesh but remains sub-pixel vertically in all three measured views |
| Sidewalk/curb/pavement seams | 13 | 333.86×107.55 | 620.72×199.96 | 506.50×209.90 | Context geometry occupies a wide portion of the image |

The browser renderer uses a drawing buffer approximately 1.5× CSS size, but that does not turn a subpixel CSS feature into a robust multi-pixel feature. It may contribute an antialiased trace; the measurement does not assert a human-recognition threshold. The close view makes the building materially larger, while expansion increases available raster area at the original pose. Neither changes the default composition contract.

The sidecar CSV also records the small diagnostic sample counts. For example, all 60 quarter-face samples across the canonical fine-detail assembly were first hits in the factory geometry. That supports that the assembly is mounted and sampled, but it is not a comprehensive occlusion proof; the production [mounted-geometry regression](../../src/tests/unit/architectureRiseMountedGeometry.test.ts) retains the canonical 111×6 = 666 physical-camera ray checks and intentional obstruction negative controls.

## Visual gap classification

| Rank | Classification | Evidence | Confidence | F0 decision |
| ---: | --- | --- | --- | --- |
| 1 | **GEOMETRY_ARTICULATION_GAP** | Actual facade includes corner pilasters, base string course, openings and cornice, but no intermediate course that separates the entry/base from the upper window groups. The 2/3/2 window rhythm and upper-right quiet bay are deliberate. | High | Test one shallow course in the clear front-elevation gap. Defer full-height intermediate piers because they would intrude on the canonical quiet zones. |
| 2 | **SCREEN_SPACE_LIMIT** | Cornice bands are 5.83 CSS px high as a 12-piece union; a representative bracket is only a few pixels high; individual canonical lines are under 0.4 CSS px vertically at normal view. | High | Favor broad, restrained forms with useful projected extent over extra small caps, joints, or brackets. |
| 3 | **FRAMING_OR_REFERENCE_MISMATCH** | Building+return is 112×151 px on a 514×410 canvas; the concept images show a more image-filling building. But those images have no shared calibrated camera, viewport, lighting, or geometry. | Medium | Do not alter camera or task composition to imitate the reference. Treat reference scale as qualitative. |
| 4 | **MATERIAL_OR_CONTRAST_LIMIT** | Brick/stone separation and procedural masonry are visible; close-up resolves the materials better. Current maps use physical UVs and bounded lighting; PR E did not test material changes. | Low/medium | Keep materials, lighting and tone mapping fixed in F1 so geometry effect is attributable. Revisit only with separately designed material evidence. |
| — | **CANONICAL_CONSTRAINT** | The checkerboard and complete Fine Detail assembly occupy protected facade projection; any relief can change physical-lens first hits. | High consequence | Gate F1 with canonical bounds, six-line preservation, all 666 rays, both obstruction negative controls, and actual mounted mesh ray tests. |

## Recommended PR F1 study

Test one shallow **front-elevation story course** in the open wall above the entry. Use the current trim material and shared box geometry path; end it flush into the two existing corner pilaster strips. This gives the facade a broad horizontal hierarchy cue without adding windows or changing the teaching targets.

An initial coordinate proposal derived from the current geometry is:

- Center `(X, Y, Z) = (0, 354, frontFacadeZ − 20) mm`.
- Size `2640 × 60 × 58 mm`: the 2640 mm front width terminates at the inner edges of the existing corner pilasters; height and depth are appearance-only.
- Retain the building envelope. Do not carry the course across the attached service-return window wall; the course meets the main block's corner pilasters at its ends.
- The hypothetical course projects to about **72.58 × 7.77 CSS px** in the normal Observer view when projecting its complete bounding box. This is a geometry-envelope estimate, not a mounted render or a promise of perceptibility.

This proposal was checked against the source-derived canonical bounds and real presentation layout. The focus-chart quiet zone is `X = −475…475 mm`, `Y = 425…1375 mm`; the Fine Detail quiet zone is `X = 540…1100 mm`, `Y = 1890…2510 mm` (both include the current 100 mm masonry margin). The course overlaps both quiet zones in X but ends at `Y = 384 mm`, leaving **41 mm** to the checkerboard quiet zone. The Fine Detail quiet zone is at least **1506 mm** above it. The canonical focus chart itself begins at `Y = 525 mm`, 141 mm above the proposed course. The entry lintel cap reaches `Y = 284 mm`, leaving **40 mm** to the course. Existing front ground-window upper trim ends at `Y = −154 mm`. The next front-window row's lowest sill brackets begin at about `Y = 1289 mm`, leaving 905 mm above the course. These are numerical design-preflight clearances only; they do not prove runtime occlusion safety.

The course's front edge shares the existing corner-strip relief plane, and its endpoints meet those strips without an exposed floating end. A new box at this location intentionally crosses the checkerboard's X range only below its protected Y range. It remains on the front elevation; it does not wrap across the service-return window wall, whose upper window is near the course's Y coordinate. PR F1 must still mount the actual geometry and verify it with physical-lens rays to the checkerboard, frame/grid and all six Fine Detail lines. The ignored `f1-course-preflight.json` records the candidate's projected bounding envelope.

Do not add intermediate full-height pilasters in F1: the checkerboard quiet-zone X interval and the Fine Detail quiet-zone X interval leave only a 65 mm horizontal corridor between them; an 80 mm pier would enter at least one protected zone at its corresponding Y band. Do not add a belt course near the upper window-row sills; that region is occupied by window trim and the Fine Detail quiet zone.

### F1 acceptance evidence

1. Capture matched normal, expanded, and close Observer views with the same public controls/metadata as F0. The normal view decides whether the feature materially improves the default lesson composition; expanded and close views explain geometry and clearances.
2. Show the course in front, left-oblique, and right-oblique views; confirm it remains attached to the main facade, terminates cleanly into both corner pilasters, and does not collide with existing window or entry trim.
3. Use mounted Three.js raycasts from the derived physical lens center to the checkerboard, the canonical panel/frame/grid, and all six fine-line surfaces. Retain the complete 666-ray suite and both intentional obstruction negative controls.
4. Preserve window openings/glazing/frame positions, fine-detail geometry and quiet-zone bounds, focus target, task outcome, camera movement semantics, lighting, Ground Glass mapping, and renderer/resource lifecycle.
5. Expect one additional mesh submission and 12 box triangles if implemented through the current shared `resources.box` and trim material; verify actual Observer and RTT counts rather than treating this estimate as a budget. Unique geometry/material/texture resource counts should remain unchanged; report any measured deviation.
6. Run focused Architecture Rise and Ground Glass tests, the relevant browser capture, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check`. Do not change the Dream Loop target or conduct a parameter search in F1.

If this course does not create a clear normal-view story transition, stop before adding finer ornament. The evidence would then favor a baseline composition or geometry-system review over continued detail accumulation.

## Evidence and reproduction

All raw images, projections, selected PR E evidence, and helper scripts remain ignored under:

```text
.dream-loop/architecture-rise/pr-f0/
```

The portable local archive is:

```text
.dream-loop/architecture-rise/pr-f0/architecture-rise-v2-visual-gap-audit-evidence.zip
```

Its SHA-256 is `d2905e0be35c79bdf7c70a343522d94a9c030b97219ec15e0d0015da68cf738c`; a relative file manifest is included inside the archive. The local worktree also has `architecture-rise-v2-visual-gap-audit-evidence.zip.sha256`. The audit sheet image SHA-256 is `7cba01a937b85a5dc366d256e452c422312736e03a627a6af34f9e5462ecd063`. Current normal/expanded/close screenshot SHA-256 values are `96ae7fdc33c751217d70d5d8b79d1d8b44f6c38f42d65bf0889ce5ceaa7c5ee7`, `b79e719a6bd03f096c549b1afaf13d59fa973a0dd68e1ad39a48ee885691e62f`, and `71dbb3494508debf90f23cfadcea527de8a7a69ba81c0a05179b8f79eee5c3f4` respectively.

Reproduce geometry projections from the repository root using the F0 ignored helper and installed Vite Node runner:

```bash
PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH ./node_modules/.bin/vite-node .dream-loop/architecture-rise/pr-f0/measure-projection.mts
```

The helper writes `feature-projection.json` and `feature-matrix.csv`. For the real browser captures, use the official command above for the deterministic normal image, then run the ignored `capture-scale-views.mjs` with Node v24.3.0 against the local app to reproduce expanded and close conditions. The exact script and inputs are in the local evidence directory.

**GitHub accessibility:** this environment exposes GitHub PR/review operations but no supported upload/attachment endpoint for a local image archive. The archive is therefore local-only; the GitHub PR does not make it accessible merely by naming its path or checksum. A human reviewer must transfer/upload it separately to inspect the images. The tracked report contains the text findings and measured schedule independently.

## F0 validation and limits

- Confirmed baseline branch/worktree against `origin/main` at `fda74581fc71467bef5245bdcdeb46f9236b07cc` before capture.
- Ran the official deterministic Dream Loop Observer capture; passed and matched the PR E clean-baseline image byte-for-byte.
- Captured normal, expanded, and close real browser Observer views; page errors were empty.
- Verified locked target SHA-256 `fa6d9c8fe11c35f127761caca0dae74ffcabc3637fb785b25d21b42707dcb841` and approved concept SHA-256 `d24336e6ac92eac6b8e704af789973c2df0e51afa3218df3d24c0f65ccd30103`.
- Verified the full internal manifest of the source PR E archive and the F0 bundle manifest.
- No production code, runtime tests, build, lint, or Dream Loop optimization round was run or changed for this documentation-only PR. Browser capture required the application runtime, but this report does not claim repository test-suite validation.

### Remaining limits

- The ImageGen references have no verified common camera, geometry, scale, lighting, or renderer, so visual similarity is qualitative.
- Bounding-box projection is geometric extent, not pixel segmentation. Surface first-hit rays are sparse diagnostic samples, not full visibility measurement.
- The runtime R3F camera cannot be read from the app DOM; projected matrices use the live observed pose and verified camera configuration, then are visually checked against screenshot overlays.
- The registered-factory resource snapshot excludes one unnamed Observer-only mesh/geometry/material reported by the official harness.
- No GPU frame-time or hardware performance measurement was made. The browser used software WebGL fallback support.
- The recommended F1 coordinates are a feasibility starting point only; actual mounted geometry and physical-lens raycasts decide acceptance.
