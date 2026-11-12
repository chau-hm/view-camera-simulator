# RQ3 — Four Macro Scene Visual Acceptance Review

## Review scope

This review consolidates the four scene-local Macro readability passes. It compares matched production WebGL Ground Glass references at the normal 450 × 360 display size. Each Before/After pair is linked below; detailed state, provenance, hashes, metrics, and test evidence remain in the individual reports.

RQ3D, RQ3E, and RQ3F are accepted on `main` through PRs #329–#331. RQ3G is the current feature-branch candidate and remains pending hosted CI and external PR review. This is a visual acceptance summary, not a new renderer qualification or production promotion.

## Matched appearance references

| Scene and representative state | Before | After |
|---|---|---|
| Macro Depth of Field — middle station, 400 mm / f/5.6 | ![RQ3D Before](rq3d-macro-readability/before/ground-glass/macro-m1-middle-shallow.png) | ![RQ3D After](rq3d-macro-readability/after/ground-glass/macro-m1-middle-shallow.png) |
| Macro Oblique Plane — aligned PCB, 390 mm / +6.3° | ![RQ3E Before](rq3e-macro-oblique/before/ground-glass/o4-aligned.png) | ![RQ3E After](rq3e-macro-oblique/after/ground-glass/o4-aligned.png) |
| Macro Compound Movements — aligned targets, 490 mm / +3.4° / −2.8° | ![RQ3F Before](rq3f-macro-compound/before/ground-glass/c5-aligned.png) | ![RQ3F After](rq3f-macro-compound/after/ground-glass/c5-aligned.png) |
| Macro Bellows Extension — 1:1 specimen, 300 mm / f/5.6 | ![RQ3G Before](rq3g-macro-bellows/before/ground-glass/b3-life-size.png) | ![RQ3G After](rq3g-macro-bellows/after/ground-glass/b3-life-size.png) |

## Acceptance summary

| Scene | Visible refinement | Preserved lesson and controls | Evidence |
|---|---|---|---|
| Depth of Field | Station faces, machined details, and warm fasteners have more readable material shading. | 390 / 400 / 410 mm focus progression, physical aperture dimming, and out-of-focus station softness remain. | [RQ3D report](RQ3D_MACRO_DOF_VISUAL_READABILITY.md) |
| Oblique Plane | Copper routes, plated pads, and silkscreen separate more clearly from the PCB. | The existing +6.2° partial and +6.3° full alignment teaching results remain unchanged; the 0.1° difference is not visually exaggerated. | [RQ3E report](RQ3E_MACRO_OBLIQUE_VISUAL_READABILITY.md) |
| Compound Movements | Gear scale, centre target, and far array show improved local detail contrast. | Tilt-only, swing-only, partial alignment, and the calibrated three-target aligned state remain unchanged. | [RQ3F report](RQ3F_MACRO_COMPOUND_VISUAL_READABILITY.md) |
| Bellows Extension | At 1:1, radial ticks, central relief, and fasteners have increased local contrast without background brightening. The improvement is real but moderate; some face and inset regions remain dark. | 0.20× / 0.50× / 1:1 magnification, bellows exposure loss, aperture throughput, Image Circle, physical grid, and initial defocus remain unchanged. | [RQ3G report](RQ3G_MACRO_BELLOWS_VISUAL_READABILITY.md) |

## Shared boundaries

- Each scene was evaluated from actual WebGL Ground Glass captures with matched Before/After camera and optical states. Images were not exposure-normalized to conceal aperture or material differences.
- The improvements are scene-specific PBR material and bounded presentation-light refinements. No shared optical equations, focus scoring, teaching thresholds, or canonical geometry were changed.
- All four scene-specific reports retain their capture provenance and SHA-256 manifests. Cross-scene regression captures in each relevant pass remained unchanged.
- Ground Glass production remains WebGL-only. Architecture Rise native M3 remains a separate development-only authorization; M4/M5/M6 and other WebGPU scene eligibility were not expanded.
- Metrics describe image readability and local contrast, not photographic ground truth or physical sharpness.

## Review disposition

The accepted RQ3D–RQ3F evidence supports the first three scene refinements. The current RQ3G capture and metric set supports a restrained 1:1 material-readability improvement while honestly retaining its dark-detail limitations. Complete the RQ3G disposition after its final-head hosted CI and external PR review; no further individual Macro scene-quality pass is proposed by this series.
