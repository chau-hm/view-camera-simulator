# C2 — Observer image-circle and nonparallel-conic raster evidence

Implementation base `3a0f92e5af25ce75e8b8b139c98027e67181661d` from `origin/main`, including C1 (#377).

## Audit finding and rendering path

The Test Audit Ledger marked both visual claims **F**. The existing 3D Observer diagnostics, Ground Glass state, legends and public movements protect important interaction and optical contracts. They can all report the intended coverage when a Three.js group draws nothing. Saving a page screenshot alone also leaves that defect undetected.

The Observer's `SceneRenderer` computes diagnostics from the coverage geometry separately from `SceneContent`. `SceneContent` mounts `PhysicalImageCircleOverlay` for a finite parallel circle or `PhysicalCoverageConicOverlay` for a finite nonparallel conic when optical geometry is visible. Each uses a strong rose outline, more translucent rays and a faint surface. The Ground Glass RTT coverage shader has a separate render path. C2 samples only the composited Observer canvas.

## Method

Use the Chromium project with a 1280 × 720 viewport and device scale factor 1. Set the public render quality to Low (Observer drawing-buffer ratio 1) and the public 3D View Focus to Camera. Capture the same scene, optics and camera pose with optical geometry hidden and restored through its public control. The capture crosses two animation callbacks on the continuously rendered Observer. CSS applied only during screenshot capture excludes controls and legends from the capture while preserving layout. The Locator screenshot targets the canvas below `scene-canvas`.

The visibility button also affects other optical helpers. The per-pixel classifier therefore requires strong rose chroma and a rise in red-minus-green relative to the matched hidden screenshot, followed by local coverage of multiple separated outline landmarks. A nonzero difference or a global rose count alone cannot pass this test.

## Independent reference and tolerance

`coveragePixelReferences.ts` stores literal top-origin points read from the reviewed contour captures at the implementation base. The references are independent of the test run. They come from annotated Observer frames with fixed public camera poses and movements, rather than production contour data, a diagnostic center, or a projected copy of the renderer's vertices. Architecture Rise uses public seed 284719 (schema v1) for repeatable background materials. The references assume a 450 × 360 CSS-pixel canvas. Each matched pair asserts equality of the visible and hidden camera position, orbit target, focus and backend, and both screenshots must match the reference dimensions. The table lists the observed reference pose values, which are also recorded in the capture JSON.

| Observer scene | Camera position (world units) | Fixed orbit target |
| --- | --- | --- |
| Architecture Rise | (0.336813, 0.108816, −0.701990) | (0, 0, −0.075) |
| Oblique Architecture | (−0.350231, 0.096314, −0.696660) | (0, 0, −0.075) |
| Macro Oblique Plane | (−0.330848, 0.177240, −0.689431) | (0, 0, −0.075) |
| Macro Compound Movements | (−0.312985, 0.169122, −0.700970) | (0, 0, −0.075) |

For each pixel, the visible image must satisfy RGB thresholds `R ≥ 150`, `R−G ≥ 100`, `R−B ≥ 85`, `B > G`. The red-minus-green chroma must also grow by at least 30 relative to the hidden capture. These thresholds select the dark and bright portions of the observed rose line across the scene backgrounds. The matched delta rejects static rose-colored content.

A 9 × 9 window (±4 pixels per axis) around each fixed landmark accommodates small raster shifts along a one-pixel contour. At least four selected pixels support a landmark. All but one landmark must be supported, to accommodate a weak line segment over a dark background. The hidden capture must have fewer than four strong rose pixels at every expected landmark. When checking a transition, at least two landmarks of the competing contour must lack support. That prevents the same mask from meeting the previous state's presence rule. The limits were chosen against positive reference and repeat captures before renderer suppression. Background shifts, individual rays and isolated colored pixels lack the required spread across the contour.

Architecture Rise has a fixed top landmark near canvas x=200 at y=113, 101 and 90 for neutral, +20 mm and +40 mm Rise. Other landmarks cover both sides of the projected circle. The same pose and Rise +40 mm are used for the original hide and show interaction, followed by a distinct Tilt +5° conic reference. Oblique Architecture samples curve segments on both sides of the positive and negative Swing contours and checks against the prior footprint at each transition. At Swing 0° the risen circle reference is reused and the negative conic reference is rejected. Both Macro scenes use spatially separated conic landmarks. Macro Compound checks the compound footprint against the Tilt-only landmark reference and retains the existing orientation diagnostic. The original declaration title is kept as a registered M7V identity. The raster claim is limited to the compound footprint. This perspective does not independently measure the film-local ellipse rotation angle.

## Baseline

Clean production and original specs at the implementation base. macOS 27.0.1 arm64, Node 24.3.0, Playwright 1.61.1, bundled headless Chromium 149.0.7827.55, standard development project, one worker and zero retries. Original browser tests used default High graphics quality.

```bash
npm run test:e2e -- --project=chromium --workers=1 --retries=0 \
  --reporter=list,json --output=/private/tmp/vcs-c2-baseline \
  src/tests/e2e/physical-image-circle.spec.ts src/tests/e2e/nonparallel-coverage.spec.ts
```

Four discovered, three passed and one timed out, zero skipped or flaky, exit 1. Total run 381.85 s. Oblique Architecture passed in 144.09 s, Macro Oblique in 27.74 s, and Macro Compound in 88.35 s. Architecture Rise reached the Tilt step and exhausted its existing 120 s timeout. The baseline folder retains the seven original page screenshots from the three passing cases and the Architecture Rise timeout context.

## Enhanced browser run and artifacts

```bash
PLAYWRIGHT_WEB_SERVER_PORT=4192 npm run test:e2e -- --project=chromium \
  --workers=1 --retries=0 --reporter=list --output=/private/tmp/vcs-c2-enhanced \
  src/tests/e2e/physical-image-circle.spec.ts src/tests/e2e/nonparallel-coverage.spec.ts
```

Four discovered and passed, zero skips, flakes or retries. The pre-commit run used the enhanced test files over the base renderer. Its JSON source SHA identifies the base revision. It took 132.41 s overall. The 22 screenshots took 25.31 s in total inside the screenshot API. PNG decode and pixel analysis took 116 ms across 11 matched pairs, excluding PNG encoding, attachment I/O, WebGL frame waits and control actions.

| Browser case | Original default High | Enhanced Low |
| --- | ---: | ---: |
| Architecture Rise | 120.13 s, timeout | 51.16 s |
| Oblique Architecture | 144.09 s | 60.83 s |
| Macro Oblique Plane | 27.74 s | 7.67 s |
| Macro Compound Movements | 88.35 s | 11.92 s |
| Total with startup | 381.85 s | 132.41 s |

The quality and observer setup differ between the two runs, and the baseline includes a timeout. The timings report observed elapsed time and direct capture costs. `RUNTIME_SAVING_NOT_ESTABLISHED`.

Every expected contour passed at its sampled movement state. All hidden references had zero strong rose pixels at their expected landmarks. Oblique Swing +5° and −5° each supported six landmarks, and the restored circle supported four. Both Macro frames supported six each. The Macro Compound frame supported only two of the six competing Tilt-only landmarks. Offline replay of actual prior-state masks rejected all six checked stale frames, including the Rise sequence, the Tilt transition, both Swing directions tested in sequence, and the return to parallel. The stale masks supported zero to two of the requested landmarks, below the required three to five.

Playwright writes the following within each case's output directory and attaches them to the test result:

- `<state>-visible.png` and `<state>-hidden.png` capture the real Observer pixels.
- `<state>-rose-delta.png` shows the selected pixels.
- `<state>-evidence.json` records state, source revision, browser, pose, diagnostics, region hits, rule and timings.

Local artifacts are under `/private/tmp/vcs-c2-baseline`, `/private/tmp/vcs-c2-survey`, `/private/tmp/vcs-c2-enhanced` and `/private/tmp/vcs-c2-negative`. The enhanced folder contains a sanitized `summary.json` and `stale-frame-controls.json`. To reproduce a calibration pair, select the public Camera focus and Low render quality at the base revision, apply the listed movement, and capture the Observer with Optical geometry visible and hidden. The survey filenames identify the route and movement, for example `oblique-architecture-plus-true.png`, `oblique-architecture-plus-false.png`, and `oblique-architecture-plus-mask.png`. The literal coordinates in the fixture and the rectangles reported in its JSON map directly to those 450 × 360 canvas images.

## Renderer negative controls

The disposable worktree started at `3a0f92e5af25ce75e8b8b139c98027e67181661d` and used the exact enhanced test files. Each isolated edit changed only `src/render/SceneRenderer.tsx` and was reverted before the next run. The target tests reached the fixed-landmark pixel assertion. The visible frames still reported coverage visible, the expected class, 72 perimeter points and 12 rays. All five Playwright invocations discovered one case, failed at that assertion and exited 1. There were zero skips or retries. The renderer bytes were checked against the base after each run, and the disposable worktree was removed. The Macro Compound title was restored subsequently for M7V inventory compatibility. The test body and pixel rules are identical to those run in the controls.

| Control | Temporary renderer defect | Test selection | Pixels changed by ≥10 RGB levels | Qualified rose pixels in canvas | Landmark hits |
| --- | --- | --- | ---: | ---: | --- |
| A | `PhysicalImageCircleOverlay` group set invisible | `3D Image Circle` | 6,775 | 0 | 0 at all six |
| B | `PhysicalCoverageConicOverlay` group set invisible | `Macro Oblique Plane` | 9,616 | 0 | 0 at all six |
| C | `PhysicalCoverageConicOverlay` group translated by (0.08, 0.04, 0) world units | `Macro Compound Movements` | 34,995 | 424 | 0 at all six |
| D | `physical-image-circle-outline` line set invisible, retaining rays and fill | `3D Image Circle` | 12,415 | 10 | 2 pixels at one landmark, below threshold |
| E | `physical-coverage-conic-outline` line set invisible, retaining rays and fill | `Macro Oblique Plane` | 46,488 | 36 | 0 at all six |

Each control used:

```bash
PLAYWRIGHT_WEB_SERVER_PORT=4193 npm run test:e2e -- --project=chromium \
  --workers=1 --retries=0 --reporter=list \
  --output="/private/tmp/vcs-c2-negative/<control>" "<spec>" -g "<test selection>"
```

Use `src/tests/e2e/physical-image-circle.spec.ts` for A and D, and `src/tests/e2e/nonparallel-coverage.spec.ts` for B, C and E. The negative artifact directory contains logs, both frame screenshots, masks, per-run JSON and `summary.json` with the full executed commands. The unchanged diagnostics and real canvas differences in A and B show that changes to other rendered overlays cannot satisfy the contour check. C shows why global rose counts are insufficient. D and E isolate the outline from the rest of the coverage display.

The two audit **F** findings are satisfied for missing or incorrectly located outlines at the sampled states. The original interaction, legend and numerical assertions remain in the specs.

## Numerical and CI validation

Seven adjacent Unit files passed all 50 cases. The standalone M7V policy check passed all 31 cases. The first full Local CI run caught the attempted Macro Compound title change as M7V discovery drift. Restoring the registered identity resolved it without changing M7V policy, the test body, or the raster proof.

```bash
npm run test -- --run \
  src/tests/unit/groundGlassCoverage.test.ts \
  src/tests/unit/groundGlassCoverageConic.test.ts \
  src/tests/unit/groundGlassCoverageRendering.test.ts \
  src/tests/unit/imageCircleGeometry.test.ts \
  src/tests/unit/physicalLensCoverageGeometry.test.ts \
  src/tests/unit/groundGlassCoordinateContract.test.ts \
  src/tests/unit/groundGlassRttOrientation.test.ts
npm run test -- --run src/tests/unit/m7vE2eQualificationPolicy.test.ts
npm run ci:local -- --workers=4
git diff --check
git status --short
```

Full Local CI passed CSS structure, lint, typecheck, all 4,501 Vitest cases across 359 files, and the production build in 119.85 s. The first GitHub attempt classified the helper's original `coveragePixelEvidence.ts` filename as an unmapped historical evidence dependency. Its final name, `observerCoverageContour.ts`, reflects its role as an assertion for these two current browser specs. The existing classifier then identifies the complete diff as non-evidence for historical replay. No qualification rules were changed. The development E2E helper is used by these two specs only. No scene-switching infrastructure changed. The default GitHub workflow's existing browser checks and the explicit C2 Chromium run provide separate evidence.

## Independent preservation review

The reviewer inspected the original declarations, current code, calibration images, final positive captures and negative-control masks. The reviewer confirmed the fixed Observer landmarks and the separation between raster observations and diagnostic claims, and found the five negative controls and retained public interactions sufficient for the sampled scope. The review asked for precise wording on the pairwise pose assertion and a committed-head browser capture. The latter is retained in the PR handoff and local evidence package.

## Limits and rollback

This is a sampled contour regression test on Chromium WebGL2 and the documented viewport and poses. It checks the rendered pixels against reviewed raster references. It does not measure the full perimeter, fill density, ray rendering, physical radius or film-local conic angle from the raster. The existing numerical suites still own those geometry calculations. Chromium/Mac was qualified directly. Individual line pixels may differ across graphics stacks, which is why the test uses neighborhoods and allows a weak segment. Exact dimensions are checked so a layout change cannot silently reinterpret the landmarks. Baseline and enhanced runs reported the existing Three.js Clock deprecation.

Revert the C2 commit to restore the original browser tests and remove the C2-only support files. The numerical owners and GitHub routing need no rollback.
