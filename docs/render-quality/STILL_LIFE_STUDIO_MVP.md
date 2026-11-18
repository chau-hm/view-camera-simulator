# Still-Life Studio MVP Qualification

## 1. Scene concept and intended user experience

Still-Life Studio is a Free Practice workspace for choosing a composition and exploring focus, aperture, depth of field, material texture, and large-format camera movements across seeded tabletop subjects. It uses the existing camera and optics controls without introducing scoring or a Guided objective.

**Historical evidence note:** Sections 4–20 below preserve the original PR qualification and its pre-review geometry, captures, and publication decision. Review-Fix Round 1 below records the new baseline, corrections, evidence, and final gate; it supersedes the old geometry and Ground Glass recommendation without replacing the original evidence.

## 2. Why a purpose-built Free Practice scene

Earlier scenes keep teaching targets or room geometry fixed while smaller props vary. Here the seeded objects are the principal subjects, so a seed changes the photographic arrangement itself. This is a bounded scene-specific planner, not a general procedural-world system. Existing catalog groups organize curriculum foundations, movement lessons, and macro topics; a standalone creative workspace does not fit those tracks, so a small Free Practice group is the appropriate catalog home.

## 3. Difference from existing teaching scenes

The studio has no lesson or task identity. The table, backdrop, focus markers, bounds, lighting, and camera preset stay fixed; the object family, composition, object count, placement, dimensions, palette, and surface realization vary with schema v1.

## 4. Canonical environment geometry

Planning uses canonical millimetres with +Z from the lens datum and Y up. The table is 3000 × 80 × 3400 mm, centred at (0, -40, 4100), with its top at Y=0 and tabletop depth from Z=2400 to 5800 mm. The backdrop is 3600 × 2775 × 100 mm, centred at (0, 562.5, 6200); its near face is Z=6150 mm. The restrained floor is 7000 × 50 × 8000 mm, centred at (0, -850, 4100). Scene bounds include the floor and backdrop. See [canonical geometry](../../src/scenes/stillLifeStudioGeometry.ts).

## 5. Focus reference contract

Three fixed rendered tabletop tiles mark near, middle, and far reference surfaces at (-1120, 3000), (1120, 4150), and (-1120, 5300) mm. Their centers and multi-point samples are independent of the seed. These anchors remain visible and protected from generated placements. Focus Distribution measures these stable anchors; it does not claim to measure arbitrary generated object surfaces.

## 6. Still-life object catalog

The curated catalog has four families: ceramic-style vessels, stacked books/paper, wooden forms, and bowls. Variants include two vessel silhouettes, two bowl profiles, two stack heights, and rounded or stepped wooden forms. There are no external model files or physics simulation.

## 7. Composition strategies

Schema v1 selects one of four fixed slot strategies: `vertical-emphasis`, `horizontal-grouping`, `layered-depth`, or `asymmetric-still-life`. Each valid plan contains three or four objects. These are planning choices, not UI modes.

## 8. Seed and schema contract

The scene uses the existing `(still-life-studio, seed, 1)` identity and `SceneVariationDescriptor`. The planner returns serializable positions, dimensions, rotation, family/variant, palette, per-surface variation seed, and fallback status. It uses semantic streams for composition, props, layout, and materials; it does not use `Math.random()` or renderer state. Existing scene variation URL and history handling are reused.

## 9. Deterministic planning

Fixed-seed unit checks compare both plan values and serialized output. Independent semantic streams keep one object's material decision stable when an unrelated optional object consumes a different stream. The frozen browser sample produced 12 distinct plan signatures across all four composition strategies. Details and signatures are in the [qualification report](evidence/still-life-studio/still-life-studio-qualification.json).

## 10. Placement constraints

The planner composes the shared placement geometry and constraint helpers. It validates positive finite dimensions, tabletop support, table bounds, scene bounds, protected focus regions, pairwise intersections, backdrop clearance, and composition depth. A fixed validated fallback is available. A deterministic 256-seed sweep covered all four strategies and 3/4-object counts with zero fallback use.

## 11. Actual mesh contact

Unit tests construct actual Three.js subject geometry for every family found in a bounded seed search and measure each object's `Box3`. The measured bottom is at the tabletop (Y=0 within 0.01 mm test tolerance), with actual X/Z bounds within 10 mm of the planned box and top height within 1 mm. This checks the meshes rather than relying only on nominal half-height.

## 12. Procedural materials

Wooden forms use the existing procedural surface material path with seeded wood variation; book pages use seeded paper maps. Vessels and bowls use a restrained matte palette. Materials and texture maps are created per registered subject, then disposed by that subject's existing lifecycle owner. The studio-specific wood tabletop is softened so the surface grain does not compete with the objects.

## 13. Observer and Ground Glass parity

Observer and RTT are built from the same plan and canonical presentation data. Unit evidence compares stable mesh names/IDs, transforms, materials, texture signatures, and shadow flags while asserting that geometry, material, and texture instances are independent. The browser captured the same schema-v1 seed in both views after a completed WebGL2 Ground Glass frame. The Ground Glass capture has visibly lower contrast than Observer at the selected camera settings, but the same book grouping and scene silhouette are present; see the [parity capture](evidence/still-life-studio/still-life-studio-observer-ground-glass-parity.png).

## 14. Regenerate and URL behavior

Direct seeded and implicit-seed entry, Copy Share URL, reload, and browser Back/Forward are covered. URL query parameters and fragment are preserved. Seed 284719 produced pixel-identical Observer captures before and after page reload. The [side-by-side replay evidence](evidence/still-life-studio/still-life-studio-same-seed-replay.png) shows both genuine captures; the report records the matching SHA-256 result.

## 15. Camera and optics validation

The existing 150 mm lens, thin-lens strategy, focus range 2600–6500 mm, and camera movement plumbing remain unchanged. Browser coverage checks focus at 3000, 4100, and 5300 mm; f/5.6, f/11, and f/22; processed, raw, and upright Ground Glass states; and all eight existing front/rear rise, shift, tilt, and swing controls using public control steps. The control UI is single-selection: changing movement selects one field at a time and resets the previous field, so these checks exercise each movement separately rather than claiming simultaneous movement stacking.

## 16. Resource lifecycle

Observer and RTT subjects own separate resource graphs and are each disposed once. Browser capacity evidence samples 16 points through seed A/B, history restoration, ten successive regenerations, and scene leave/re-enter. Renderer counts vary with composition size (14–29 geometries and 21–27 textures); renderer-minus-current-subject overhead remained exactly one geometry and nine textures for every sample. A→B→A and scene re-entry returned to the same subject/resource signature. Chromium's WebGL2 path reported CPU-fallback submit diagnostics; no hardware-GPU performance claim is made.

## 17. Frozen seed sample

The complete, unfiltered sample is `0, 1, 284719, 4294967295, 3079748268, 654013979, 4041585854, 2762659077, 2004402848, 1824298367, 2130322642, 4065361417`. Each plan had three or four objects, no fallback, and a distinct signature. Per-seed strategy, families, count, and signature are recorded in the report.

## 18. Normal-size visual assessment

Qualification used Chromium production preview at 1440 × 1000, DPR 1, standard quality, with a 514 × 411 Observer canvas, fixed camera, focus 4100 mm, f/11, and overlays disabled. I rate the result **ACCEPTABLE**: the complete grid shows recognizable changes in silhouettes, count, grouping, height, depth, and balance without zooming. Repeated families occur in some seeds (including books-only and bowls-only samples), so the generator does not promise every pair will look unrelated.

![Frozen 12-seed Still-Life Studio grid](evidence/still-life-studio/still-life-studio-12-seed-grid.png)

Also see the [four representative captures](evidence/still-life-studio/still-life-studio-four-representatives.png) and [blind A/B comparisons](evidence/still-life-studio/still-life-studio-blind-pairs.png).

## 19. Known limitations

- Focus diagnostics remain anchored to the three fixed reference tiles, not generated surfaces.
- The existing movement selector exposes one movement field at a time.
- The four stylized families and muted palettes are deliberately small; results are not photorealistic.
- Chromium qualification used a software WebGL2 path. CPU-submit numbers describe submission only, not hardware GPU speed.
- The 256-seed planner sweep is a sample, not exhaustive coverage of the 32-bit seed space.
- Ground Glass is darker/lower contrast than Observer in the parity capture, and merits future renderer-specific visual investigation if users find it hard to read.

## 20. Publication recommendation

At the original PR submission, technical and Observer visual qualification passed and the manual scene-publication flag was enabled. Review-Fix Round 1 temporarily closed that flag while the Ground Glass concern was measured. The final publication decision is recorded below; changing the source flag does not merge or deploy the PR.

The thumbnail is a real Observer capture from frozen seed 4294967295: [still-life-studio.webp](../../public/assets/still-life-studio.webp).

## Review-Fix Round 1 — Ground Glass Photographic Usability

### Finding and diagnostic method

The prior Observer/Raw comparison did not establish that the Ground Glass path was defective. It was captured at a different camera viewpoint and labeled “processed” without independently recording the processing state. Raw is a display orientation; it does not disable DOF. The separate **Raw RTT — bypass DOF** diagnostic sets `rawDebug=true` and bypasses DOF, natural illumination, and image-circle coverage together. The new captures record these states independently and wait for the current requested RTT frame to complete before each screenshot.

The pre-fix baseline was captured at reviewed HEAD `dfaa18dee4cc9a468bea6343ac6abb4f06fa0a86`, seed 284719/schema v1, neutral movements, focus 4100 mm, standard quality, 1440×1000 viewport, and 514×411 Ground Glass display. The actual configured camera had lens centre `(0,0,0)` mm, optical axis `+Z`, film centre `(0,0,-155.696203)` mm, film plane normal `+Z`, and 127×101.6 mm film. The RTT camera was at `(0,0,0)` with up `(0,1,0)` and forward `(0,0,1)`, clip range 0.01–9.12 world units, a finite projection matrix, determinant −0.150461, and `camera-ok=true`; no fallback camera was used.

**Diagnosis: MULTIPLE CONTRIBUTING CAUSES, high confidence.** Geometry/framing was the primary cause: the original tabletop top was at Y=0, the same height as the lens centre, and its projected top edge fell on the image midline. All primary object projections began at or below that line, while the tabletop occupied the centre of the Raw image and obscured the subjects. The standard f/11 scene was also low-key, especially for the wooden form. The renderer camera and shared optics configuration were valid. Raw versus Upright changed orientation as expected. Normal f/11 and bypassed f/11 remained similarly dark, so bypassing DOF did not remove the limitation.

### Correction and geometry

One scene-geometry correction moved the table top down 150 mm to Y=−150 while retaining the global lens datum and optical direction. The table legs, floor, backdrop, scene/composition bounds, planner support height, deterministic fallbacks, and Observer orbit camera were adjusted together. The backdrop centre is now `(0,412.5,6200)` mm and the floor centre `(0,−1000,4100)` mm. Seed identity, schema v1, composition strategy/family/count decisions, object dimensions, X/Z placement, rotation, palette, and material choices were preserved; plan signatures changed because the world Y positions intentionally changed.

The protected focus-reference tiles are 150×190×16 mm and remain fixed at the existing near/middle/far X/Z anchors. They now sit on the tabletop, with focus probes and samples on their camera-facing −Z surfaces. Their centre is 95 mm above the table and their sampled points remain on those real surfaces. Projected tile height is approximately 23–40 pixels in the 514×411 Ground Glass viewport. Projected subjects remain within the film area across the four representative seeds; the table edge now sits above the subject silhouettes instead of crossing through them. Near, middle, and far objects remain visually separated.

### Lighting and image measurements

After the geometry correction, f/11 object-region luminance remained too subdued, so the second and final correction changed only the Still-Life Studio key-light placement from `(-2.5,3.5,-2.5)` to `(-2,3.5,-4.5)` world units. The shared `teaching-default` intensity/profile, natural-illumination algorithm, optics, exposure, shader, and other scenes were unchanged. Observer and RTT continue to resolve the same presentation profile and scene-specific placement.

For seed 284719 at f/11, the median luminance in the projected bounding rectangles rose from 29.3 to 40.1 for the left books, 34.2 to 47.4 for the centre books, and 15.6 to 17.9 for the wooden form (8-bit sRGB relative-luminance code values). The fixed backdrop reference patch rose from 24.1 to 31.2. These rectangles include background and shadow pixels, so they are descriptive samples rather than object-only measurements or universal brightness thresholds. At f/5.6 the book medians were 155.5 and 181.9; at f/11 they were 40.1 and 47.4; at f/22 the measured illumination gain fell to 0.232, consistent with the expected stop-down behavior. At f/11 the independent bypass produced book medians of 47.0 and 50.6, close to ordinary f/11, confirming that DOF processing was not the primary darkness cause. Some dark wooden/bowl regions remain low-key; their silhouettes and the book edges are visible at ordinary display size, and the wider-aperture view gives clearer material contrast.

The actual profile gain was 3.581 at f/5.6, 0.928 at f/11, and 0.232 at f/22, approximately fourfold per stop. This calculation and the screenshots use the existing illumination model; no brightness threshold was added to tests. `ground-glass-pixel-roi-metrics.json` records the sampling method, projected ROI coordinates, near-black fractions, and per-capture values.

### Final photographic evidence

The diagnostic contact sheets are unmodified browser captures from the real Ground Glass viewport. The matrix labels the actual Raw/Upright orientation and whether DOF is on or the Raw RTT bypass is active. Grid and focus loupe were off. The four representative comparisons use the same seeds, focus distance, and f/11 aperture across Observer, Raw, Upright, and bypass panels; f/5.6 captures are also included in the machine-readable report.

- [Before correction Ground Glass matrix](evidence/still-life-studio/review-fix-round-1/baseline-ground-glass-contact-sheet.png) and [baseline runtime/projection report](evidence/still-life-studio/review-fix-round-1/baseline-ground-glass-matrix.json).
- [Final Ground Glass matrix](evidence/still-life-studio/review-fix-round-1/after-lighting-ground-glass-contact-sheet.png) and [final runtime/projection report](evidence/still-life-studio/review-fix-round-1/after-lighting-ground-glass-matrix.json).
- [Seed 0 comparison](evidence/still-life-studio/review-fix-round-1/after-lighting-seed-0-comparison.png), [seed 284719 comparison](evidence/still-life-studio/review-fix-round-1/after-lighting-seed-284719-comparison.png), [seed 4294967295 comparison](evidence/still-life-studio/review-fix-round-1/after-lighting-seed-4294967295-comparison.png), and [seed 2130322642 comparison](evidence/still-life-studio/review-fix-round-1/after-lighting-seed-2130322642-comparison.png).
- [Four-seed capture/runtime report](evidence/still-life-studio/review-fix-round-1/after-lighting-four-seed-ground-glass.json) and [pixel ROI metrics](evidence/still-life-studio/review-fix-round-1/ground-glass-pixel-roi-metrics.json).
- [Regenerated 12-seed Observer grid](evidence/still-life-studio/review-fix-round-1/still-life-studio-12-seed-grid.png), [four Observer representatives](evidence/still-life-studio/review-fix-round-1/still-life-studio-four-representatives.png), [blind comparisons](evidence/still-life-studio/review-fix-round-1/still-life-studio-blind-pairs.png), [Observer/RTT parity](evidence/still-life-studio/review-fix-round-1/still-life-studio-observer-ground-glass-parity.png), [same-seed replay](evidence/still-life-studio/review-fix-round-1/still-life-studio-same-seed-replay.png), and [full qualification report](evidence/still-life-studio/review-fix-round-1/still-life-studio-qualification.json).

At ordinary 514×411 Ground Glass size, I rate the corrected photographic image **ACCEPTABLE**: books remain identifiable by their stacked edges, the vessel and wooden form have usable silhouettes, and the three-bowl arrangement remains distinguishable. The f/5.6 view is visibly brighter; f/11 retains enough local contour contrast to focus on the book edges and fixed tiles; f/22 is very dark as expected from the existing aperture model. Raw and Upright present the expected opposite image orientation. The tabletop no longer hides the centre of the scene. This is a low-key illustrative studio, not a photorealistic exposure preview.

### Regression and final gates

The regenerated frozen 12-seed sample contains the same 12 seeds, composition IDs, object-family lists, and object counts as the original qualification. Only plan signatures changed, due to the documented scene Y translation. Four strategies remain represented, every plan has three or four objects, and all 12 reports record no fallback. The 256-seed placement sweep and actual-mesh contact checks passed after the geometry change. The final Observer thumbnail was regenerated from a real browser capture; English and Traditional Chinese catalog metadata remain attached to the same Free Practice entry.

Technical browser qualification passed for deterministic replay, completed current-seed Ground Glass frames, camera configuration, focus 3000/4100/5300 mm, apertures f/5.6/f/11/f/22, Raw/Upright orientation, all eight front/rear movement controls individually, root deployment, `/view-camera-simulator/` subpath, A→B→A replay, ten regenerations, and leave/re-enter. Sixteen resource samples retained constant renderer overhead of one geometry and nine textures above the current registered subject; no rejected or invalidated frames were reported. Chromium used the software WebGL2 CPU-fallback path; no hardware-GPU timing claim is made.

**Final technical gate: PASS. Final Observer gate: ACCEPTABLE. Final Ground Glass photographic-usability gate: PASS. Publication: ENABLED after both gates passed.** Standard production catalog and route, both deployment bases, localized metadata, and the final thumbnail were checked after re-enabling the manual flag. This review-fix updates the existing PR only; it is not a merge or deployment.

## 21. Next improvement opportunity

A bounded follow-up could add one folded-fabric subject family and evaluate it with the same frozen sample, normal-size view, placement solver, and resource checks. Keep this MVP's fixed studio, optics, focus anchors, and current family set stable until that separate change is qualified.

## Evidence files

- [12-seed grid](evidence/still-life-studio/still-life-studio-12-seed-grid.png)
- [Four representatives](evidence/still-life-studio/still-life-studio-four-representatives.png)
- [Blind pairs](evidence/still-life-studio/still-life-studio-blind-pairs.png)
- [Observer / Ground Glass parity](evidence/still-life-studio/still-life-studio-observer-ground-glass-parity.png)
- [Same-seed reload replay](evidence/still-life-studio/still-life-studio-same-seed-replay.png)
- [Qualification report](evidence/still-life-studio/still-life-studio-qualification.json)

## Technical validation

- `NODE_OPTIONS=--no-experimental-webstorage npm test` — passed, 342 test files and 4,233 tests. The Node 26 flag keeps its experimental global Web Storage API from shadowing jsdom's `window.localStorage` in the existing integration tests.
- `npm run typecheck` — passed.
- `npm run lint` — passed.
- `npm run check:css` — passed.
- `npm run build` and `VITE_BASE_PATH=/ npm run build` — passed for the default subpath and root bundles.
- `npm run build:still-life-studio-qualification` — passed while the manual publication flag was false.
- Ground Glass diagnostic Playwright capture — passed; mode-correct baseline/final matrices and four representative seed comparisons were recorded.
- Root 12-seed Chromium production-preview qualification — passed; all four strategies, current completed frames, focus/aperture/orientation states, eight individual movement controls, URL/history/regeneration, lifecycle, 16 capacity samples, and zero page errors.
- Qualification deployment at `/view-camera-simulator/` — passed while the manual flag was false.
- Standard published Chromium preview at root and `/view-camera-simulator/` — passed; both catalogs show the localized Still-Life Studio entry, its 514×411 WebP thumbnail loads as `image/webp`, and the Free route opens with a configured camera and completed Ground Glass frame.
- `git diff --check` — passed after the final changes.

Chromium used WebGL2 with CPU-fallback submit diagnostics. Those values are reported as CPU submission measurements and are not interpreted as hardware GPU performance.
