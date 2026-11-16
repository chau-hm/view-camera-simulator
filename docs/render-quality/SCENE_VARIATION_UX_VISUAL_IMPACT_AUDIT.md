# Scene Variation UX & Visual Impact Audit

## 1. Executive Summary

**Audit execution: PASS.** The frozen 12-seed sample for each production consumer was captured from the production preview in Chromium/WebGL2. The audit includes canonical references, Interior Corner schema v1 and v2 comparisons, full seed grids, anonymous pair sheets, capture provenance, plan diagnostics, and pixel/ROI diagnostics. Both fixed-seed fresh-page replays matched byte for byte. No production behavior or accepted variation output was changed.

**Product visual assessment:**

| Scene | Assessment | Free Practice value |
| --- | --- | --- |
| Interior Corner · schema v2 | **ACCEPTABLE** | Recognizable aesthetic and composition variation. Rug treatment and bench cushion arrangements are the clearest differences; seeded material variation alone is subtle. |
| Shelf Swing · schema v1 | **LIMITED** | Reproducible and varied in plan data, but visual changes occupy a small lower-shelf region and are easy to miss without inspection. |

Interior Corner gives learners visibly different room arrangements at the normal Observer size, though it does not create a new optical exercise. Shelf Swing keeps its three teaching charts clear and its props plausible, but its current variation reads mainly as decoration. The highest-value next implementation is a versioned Shelf Swing schema v2 experiment that makes the lower-shelf display objects easier to distinguish while preserving the chart and station layout. Schema v1 must remain unchanged.

No independent human ratings were collected. The anonymous pair sheets and a short review guide are published for follow-up; the qualitative findings below are preliminary agent observations, not usability-test results.

## 2. Scope and Source Baselines

This audit evaluates the production consumers at source commit 126ef906f76c468346c20a9add4e1de4d092a2a5, based on the then-current origin/main.

- Interior Corner schema v1 is the historical seeded-material presentation.
- Interior Corner schema v2 adds seeded props and rug micro-layout alongside seeded materials.
- Shelf Swing schema v1 adds seeded display props to the three stations.
- The canonical Guided presentation is retained as a separate reference for each scene.

The audited pilots are [Interior Corner seeded materials](INTERIOR_CORNER_SEEDED_MATERIALS_PILOT.md), [Interior Corner seeded props and micro-layout](INTERIOR_CORNER_SEEDED_PROPS_LAYOUT_PILOT.md), and [Shelf Swing seeded props](SHELF_SWING_SEEDED_PROPS_PILOT.md). Their existing determinism, placement, subject ownership, Ground Glass, and schema compatibility contracts were not reopened without evidence of a defect.

No variation generator, scene geometry, camera preset, renderer, optics, lighting, task evaluation, or UI code was changed.

## 3. Audit Method

The app was built and served as a Vite production preview at the root base path. Playwright Chromium used the WebGL2 Observer and Ground Glass paths. The capture script asserted route and schema identity, active seed, registered scene subjects, renderer readiness, the public control values, and a completed current Ground Glass request before saving each image.

The visible Observer canvas was captured without overlapping DOM controls. Its CSS bounds were 514 × 410.39 at DPR 1; Chromium rounds the element screenshot to 514 × 411. The WebGL backing buffer was 771 × 615. For the primary evidence, the rendered WebGL canvas was copied in-page to a temporary 2D canvas sized to the visible CSS bounds and exported at 514 × 411. The published contact sheets retain those displayed pixels at native panel scale; they do not upscale, sharpen, retouch, or add explanatory scene annotations. UI screenshots are published separately for the UX review.

All three Observer teaching-overlay flags were asserted false. Every image used the same production build, scene-default lighting, a fresh page, and the default Observer camera after Reset 3D view. No arbitrary post-capture image processing was applied.

Capture totals:

- 15 Interior Corner images: canonical Guided, schema v1 seed 284719, 12 schema v2 seeds, and a schema v2 seed 284719 replay.
- 14 Shelf Swing images: canonical Guided, 12 schema v1 seeds, and a schema v1 seed 284719 replay.
- 29 total canvas captures; all had completed RTT frame IDs and zero browser page errors.

The full capture metadata is in [capture provenance](evidence/scene-variation-visual-audit/capture-provenance.json). Raw screenshots and the full run record remain in the ignored working directory rather than this PR.

## 4. Capture Configuration

| Setting | Interior Corner | Shelf Swing |
| --- | --- | --- |
| Viewport / DPR | 1440 × 1000 / 1 | 1440 × 1000 / 1 |
| Observer display image | 514 × 411 | 514 × 411 |
| Renderer | Production WebGL2 | Production WebGL2 |
| Quality | Standard | Standard |
| Focus / aperture | 8000 mm / f/5.6 | 3400 mm / f/11 |
| Rise / front swing | 0 mm / 0° | 0 mm / −4° |
| Camera position | (−6.600000, 2.900000, −5.600000) | (4.200000, 1.450000, 1.400000) |
| Orbit target | (0.450000, 0.850000, 6.700000) | (0.000000, −0.040000, 3.850000) |

The values are read from the active public controls and scene canvas after reset. Ground Glass requests completed for all captures. The designated representative sanity records are only Interior Corner v2 seed 284719 and Shelf Swing v1 seed 284719.

## 5. Seed Sampling and Blind Review

The sample was locked at 2026-11-16T16:18:17Z, before visual inspection of the new variation captures. Both scenes use this complete seed grid:

0, 1, 284719, 4294967295, 3079748268, 654013979, 4041585854, 2762659077, 2004402848, 1824298367, 2130322642, 4065361417

The four required reference seeds are followed by eight distinct outputs of the documented LCG32 sampler (initial state 0x53435641, recurrence state = (1664525 × state + 1013904223) mod 2^32). Six blind pairs per scene were selected with a seed-only Fisher–Yates shuffle before inspection. The [sampling plan](evidence/scene-variation-visual-audit/seed-sampling-plan.json) records the selection; the [answer key](evidence/scene-variation-visual-audit/blind-pair-answer-key.md) is separate from the [Interior Corner sheet](evidence/scene-variation-visual-audit/blind-pairs-interior-corner.png) and [Shelf Swing sheet](evidence/scene-variation-visual-audit/blind-pairs-shelf-swing.png).

The [review guide](evidence/scene-variation-visual-audit/blind-pair-review-guide.md) asks reviewers to view pairs at normal Observer size, identify differences, compare coherence, and say whether they would explore the scene further. No reviewer responses are claimed.

## 6. Interior Corner Findings

### Materials

The canonical Guided versus schema v1 seed 284719 comparison changes 35.59% of canvas pixels at a zero-difference threshold, but the mean per-pixel maximum channel delta is only 0.463/255, the 95th percentile is 2/255, and the largest channel delta is 5/255. Most changed pixels are low-amplitude seeded surface detail. At normal Observer size, plaster and wood texture differences are restrained; they contribute material character more than a readily identifiable new scene.

Across schema v2 seeds, 36.07–38.72% of pixels differ from seed 284719, with mean per-pixel maximum channel delta 0.58–0.92/255 and a 95th percentile of 2/255. These broad changes should not be read as strong perceptual variation: tiny texture changes affect many pixels.

### Props and rug

The 12 plans contain 12 arrangement IDs and 12 distinct material-role seeds for each of the seven seeded surface roles. The sampled plans include all three rug treatments (5 striped, 4 plain, 3 bordered) and both one- and two-cushion outcomes (6 each). Console plans vary vase profile/palette and sometimes add books or a sculpture. There were no reported plan safety issues.

In the 514 × 411 display-size grid, rug pattern and cushion count/color are the clearest seed-to-seed changes. They alter a large enough area of the central furniture composition to be recognizable in side-by-side comparison. Vase, book, and sculpture changes are much smaller and often need attention. No sample visibly disrupts the room’s architectural identity, apparent support, focus-target visibility, or coherent arrangement.

The same-seed schema v1-to-v2 comparison is useful as a historical presentation reference, but it is **not** a props-only control: schema version is part of the random-stream derivation, so material seeds may differ between v1 and v2 as well as the added prop/layout domains.

**Assessment: ACCEPTABLE.** Across the sample, users can recognize different arrangements at the ordinary Observer size, mainly from the rug and cushions. Material-only randomization is subtler. The change is aesthetically useful and can invite composition, surface, and viewpoint exploration, but it does not create a different focus-plane lesson.

Evidence: [canonical / v1 / v2](evidence/scene-variation-visual-audit/interior-corner-canonical-v1-v2.png), [schema v2 grid](evidence/scene-variation-visual-audit/interior-corner-schema-v2-seed-grid.png).

## 7. Shelf Swing Findings

### Station variation and teaching preservation

The plan sample contains 12 distinct three-station family layouts, 62 display objects total (22 boxes, 23 cylinders, and 17 vessels), 4–6 objects per seed, zero fallback plans, and zero safety issues. This confirms planner diversity and bounded placement, not that users will notice every plan difference.

All three front, middle, and back charts remain readable in the normal Observer view. Their chart patterns and station colors remain distinct, and the station depth ordering stays clear. Props remain on the lower display shelves, away from the chart faces and focus-target region. The canonical Front Swing teaching composition remains intact.

At 514 × 411, generated props are small and concentrated beneath the charts. Side-by-side sheets show object-count, silhouette, placement, and color changes in that lower band, but the chart faces and station bodies dominate the image. Some object colors echo the station palette and blend into the frame. Differences are visible with attention; they do not usually create a substantially new subject or focus cue.

### Screen-space evidence and likely causes

For each of the 11 schema v1 comparisons against seed 284719, 633–896 pixels differ, or 0.30–0.42% of the 211,254-pixel canvas. All differing pixels fall within the three approximate lower-display rectangles used for the ROI check. Together those rectangles cover 8,520 pixels (4.03% of the canvas); 7.4–10.5% of the pixels inside them differ. The rectangles include parts of the shelf/frame and nearby shadow, so this is a display-zone measurement rather than an exact prop mask.

The strongest observed limitation is therefore the small screen-space footprint of the variable display area. Placement below the charts preserves teaching visibility but also lowers prominence. Palette similarity and the limited box/cylinder/vessel silhouette set are plausible additional contributors. This sample does not isolate those factors, so their individual causal contribution remains a hypothesis. The fixed Observer camera is part of the canonical teaching presentation and should not be changed to make props more prominent.

**Assessment: LIMITED.** The variation is technically diverse, plausible, and teaching-safe, but at the normal Observer size it reads mostly as cosmetic. Some pairs are recognizable when attention is directed to the lower shelves; regeneration does not reliably present a meaningfully new photographic or focus opportunity.

Evidence: [canonical / seed 284719](evidence/scene-variation-visual-audit/shelf-swing-canonical-seed-284719.png), [schema v1 grid](evidence/scene-variation-visual-audit/shelf-swing-schema-v1-seed-grid.png).

## 8. Cross-Scene Comparison

| Dimension | Interior Corner v2 | Shelf Swing v1 |
| --- | --- | --- |
| Plan-level variety | 12 unique arrangement IDs; several coupled material, cushion, console, and rug choices | 12 family layouts; 4–6 compact display objects per seed |
| Most visible change | Rug pattern and cushion count/palette | Small object silhouettes/colors below the charts |
| Normal-size recognition | Recognizable with attention; often clear side by side | Difficult without looking at the lower shelves |
| Main quantitative pattern | Many pixels change slightly across surfaces; localized props add larger deltas | 0.30–0.42% of the full Observer image changes per seed pair |
| Teaching preservation | Architectural scene and target details stay recognizable | All three charts and depth ordering stay clear |
| Free Practice value | Aesthetic/compositional exploration | Primarily decorative novelty |

The contrast shows why seed uniqueness and image hashes are insufficient evidence of perceptual value. Interior Corner spends variation across broad materials and a central composition; Shelf Swing concentrates it into small objects while leaving its teaching charts correctly protected.

## 9. Quantitative Diagnostics

The [full-frame diagnostics](evidence/scene-variation-visual-audit/image-diagnostics.json) compare RGB pixels at threshold zero. The [approximate ROI diagnostics](evidence/scene-variation-visual-audit/roi-image-diagnostics.json) use fixed top-left canvas rectangles:

- Interior Corner surface region: x=70, y=95, 330 × 130 px.
- Interior Corner bench/console/rug region: x=175, y=210, 225 × 135 px.
- Shelf Swing lower display zones: x=70–145, x=232–296, and x=382–456; y=224–264.

The Interior Corner regions contain a mix of seeded surfaces, artwork, fixed furniture, floor, and variable decor; they are not exact object masks. The Shelf Swing regions include shelf/frame pixels and nearby shadows. These measurements describe pixel change within useful fixed regions, not the precise projected area of individual props.

Key readings:

| Comparison | Changed pixels | Mean per-pixel max-channel delta | 95th percentile | Interpretation |
| --- | ---: | ---: | ---: | --- |
| Interior Corner canonical vs v1, seed 284719 | 75,193 / 211,254 (35.59%) | 0.463/255 | 2/255 | Many low-amplitude material pixels change. |
| Interior Corner v2, each other seed vs 284719 | 76,196–81,808 (36.07–38.72%) | 0.576–0.925/255 | 2/255 | Broad material changes plus localized arrangement changes. |
| Shelf Swing v1, each other seed vs 284719 | 633–896 (0.30–0.42%) | 0.178–0.286/255 | 0/255 | Strong local object differences occupy a small part of the full view. |
| Same-seed replay, each scene | 0 | 0 | 0/255 | Exact PNG replay in the audited browser/build. |

Interior Corner seed comparisons have local maxima up to 147/255 from changed prop colors/edges; Shelf Swing maxima reach 161–180/255 within its small changed region. Pixel counts weight every pixel equally and cannot express recognizability, coherence, or teaching usefulness. No threshold was selected as a pass/fail target.

## 10. Visual Impact Rubric

Qualitative ratings below are preliminary agent judgments supported by the sheets and diagnostics. Independent human review remains pending.

| Dimension | Interior Corner v2 | Shelf Swing v1 |
| --- | --- | --- |
| Recognizability | **Recognizable with attention** — cushion count/color and rug treatment stand out in side-by-side views; small console changes are harder. | **Difficult to recognize without attention** — most differences are in the narrow lower-shelf zone. |
| Variation diversity | **Broad** — rug treatment, cushion count/palette, console object combinations, and material-role seeds vary. | **Plan-diverse, visually constrained** — all three current families appear in varied station layouts, but objects stay compact. |
| Visual plausibility | **Good in sampled views** — arrangements appear supported and coherent; planner reports no safety issues. | **Good in sampled views** — lower-shelf placement remains credible; planner reports no fallback or safety issues. |
| Teaching preservation | **Preserved** — architecture and visible composition/focus references stay recognizable. | **Strong** — charts remain legible and the front/middle/back relationship remains clear. |
| Exploration value | **Moderate, primarily compositional/aesthetic** — inspect materials, reframe, and compare near/far details. | **Low** — props add little new depth or focus practice without disturbing the charts. |

No ratings are combined into a single score. Teaching preservation is a hard condition, not a tradeoff against visual novelty.

## 11. Regenerate Scene UX

In both Free Exploration workspaces, the active seed/schema identity, **Regenerate scene**, and **Copy share URL** controls sit in the Scene card header. The controls are visible beside the scene title without opening a drawer. The two [Interior Corner](evidence/scene-variation-visual-audit/interior-corner-free-exploration-workspace.png) and [Shelf Swing](evidence/scene-variation-visual-audit/shelf-swing-free-exploration-workspace.png) screenshots show this placement.

The browser exercise used the public controls to set each scene’s focus/aperture/movements, manually orbited the Observer, regenerated, copied the URL, and used Back/Forward. For both scenes:

- The visible seed/schema identity updated, and Back/Forward restored the corresponding seed.
- Camera position, orbit target, focus, aperture, render quality, movements, and overlay flags stayed unchanged across regeneration.
- The Ground Glass request ID advanced and the matching request completed before the post-regeneration observation.
- Copy Share URL announced success and contained the effective scene/seed/schema URL.
- There were no browser page errors.

There was no separate regeneration success status region, and the identity text does not use aria-live. The visible seed changes, but assistive technology is not explicitly told that regeneration completed. A compact polite announcement of the resolved new seed would improve confirmation without redesigning the workspace. A “what changed” summary is optional and may add noise for small or material-only changes.

## 12. Educational Value

- **Interior Corner:** Aesthetically useful, with some compositional exploration. Cushion and rug changes give learners different foreground/interior details to frame and inspect. Material variation can encourage surface inspection. These changes do not materially alter the canonical focus exercise or photographic difficulty.
- **Shelf Swing:** Cosmetic but acceptable. The three charts remain the useful focus targets; lower-shelf props provide little additional depth or focus practice. Their current placement correctly protects the lesson.

The two consumers should not be assigned the same value classification merely because they share the variation foundation.

## 13. Existing Technical Contracts

The audit found no evidence requiring a change to the accepted technical contracts:

- Seed and schema URLs identify replayable variants.
- Both same-seed production-preview replays matched exactly.
- The registered Observer and Ground Glass subjects used the expected scene identity, and every captured RTT request completed.
- The selected Shelf Swing plans reported no fallback or placement-safety issues; Interior Corner plans also reported no safety issues.
- Canonical camera, room/station geometry, focus charts, focus planes, and teaching targets stayed fixed.
- Existing schema outputs, PRNG derivation, ownership, and cleanup behavior were not modified.

This is a sampled appearance/UX audit, not a replacement for the existing unit, lifecycle, or Ground Glass qualification documented in the pilot reports.

## 14. Limitations and Uncertainty

- No independent human ratings were available; the qualitative assessment is preliminary.
- Twelve seeds per scene are a deterministic sample, not exhaustive coverage of the uint32 domain.
- The audit uses one fixed default Observer pose, Standard quality, one Chromium version, and WebGL2. Other screen sizes, browsers, graphics devices, and user-selected camera views may differ.
- Ground Glass readiness was checked for all captures and one fixed representative seed per scene was designated for the sanity review. This was not a focus/aperture matrix or a visual parity test; prior pilot evidence remains the relevant regression evidence.
- Full-frame pixel metrics are diagnostics, not perception scores. ROI bounds are approximate fixed image regions and include stable surfaces/structures.
- The schema v1-to-v2 Interior Corner comparison changes schema-derived random streams as well as available variation domains; it cannot isolate props by itself.
- The auditor did not test users noticing a regenerated seed without showing them a before/after comparison.

## 15. Prioritized Improvement Roadmap

### Next implementation PR — Shelf Swing schema v2 visual-recognition experiment

**Problem and evidence:** Schema v1 produces 12 family layouts and 4–6 objects per seed, but cross-seed changes occupy only 0.30–0.42% of the normal Observer canvas and remain below the protected charts.

**Proposal:** Add a new Shelf Swing schema v2 plan with a small set of more silhouette-distinct display forms and clearer per-station palette separation, staying within a chart-safe display envelope. Evaluate before/after and blind pairs at 514 × 411. Keep the three chart faces, station positions, focus targets, calibration, and canonical camera fixed. Do not alter schema v1 outputs.

**Expected benefit:** More variants should be recognizable during ordinary Free Practice while preserving the teaching hierarchy.

**Risks and scope:** Medium scope. New plans need support, bounds, overlap, and chart-visibility checks. Stronger palette contrast can distract from chart patterns; more complex forms add geometry/material ownership to review. Any change to visual output requires schema v2 and replay coverage; do not mutate the accepted v1 contract. Avoid using object size as the first or only lever.

### Optional follow-up — Announce the resolved regenerated seed

Add a short polite status announcement when the new identity is active, including its seed. This addresses the missing regeneration status and non-live identity observation with a small accessibility/UI scope. Avoid duplicate announcements on route transitions and history restoration. A visible “what changed” panel is not recommended without evidence that users need it.

### Deferred

- Changing Shelf Swing schema v1, canonical camera, focus charts, station geometry, optics, or lighting.
- Increasing prop size without a chart-safe visibility experiment.
- New global visual scoring or screenshot-difference thresholds.
- Adding a history control: browser Back/Forward already restores the tested seeds.
- Reworking the workspace around variation controls.

## 16. Final Decision

**Audit execution: PASS.**

**Product visual assessment:** Interior Corner **ACCEPTABLE**; Shelf Swing **LIMITED**.

Scene Variation already creates perceptible compositional choices in Interior Corner. In Shelf Swing, the current plan is technically varied and teaching-safe, but the default Observer view presents mostly cosmetic differences. The next implementation should focus on making Shelf Swing variation recognizable within its existing chart-safe teaching composition, while preserving schema v1.

## Evidence Index

- [Interior Corner canonical / schema v1 / schema v2](evidence/scene-variation-visual-audit/interior-corner-canonical-v1-v2.png)
- [Interior Corner schema v2 seed grid](evidence/scene-variation-visual-audit/interior-corner-schema-v2-seed-grid.png)
- [Shelf Swing canonical / seed 284719](evidence/scene-variation-visual-audit/shelf-swing-canonical-seed-284719.png)
- [Shelf Swing schema v1 seed grid](evidence/scene-variation-visual-audit/shelf-swing-schema-v1-seed-grid.png)
- [Blind pair review guide](evidence/scene-variation-visual-audit/blind-pair-review-guide.md)
- [Blind pair answer key](evidence/scene-variation-visual-audit/blind-pair-answer-key.md)
- [Capture provenance](evidence/scene-variation-visual-audit/capture-provenance.json)
- [Plan diagnostics](evidence/scene-variation-visual-audit/plan-diagnostics.json)
- [Full-frame image diagnostics](evidence/scene-variation-visual-audit/image-diagnostics.json)
- [Approximate ROI diagnostics](evidence/scene-variation-visual-audit/roi-image-diagnostics.json)
- [Interior Corner Free Exploration workspace](evidence/scene-variation-visual-audit/interior-corner-free-exploration-workspace.png)
- [Shelf Swing Free Exploration workspace](evidence/scene-variation-visual-audit/shelf-swing-free-exploration-workspace.png)
