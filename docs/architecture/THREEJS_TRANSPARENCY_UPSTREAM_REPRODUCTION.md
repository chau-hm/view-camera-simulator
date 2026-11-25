# Three.js Transparency Upstream Reproduction

**Study:** M-INV10

**Classification:** **UPR-3 — DOCUMENTED COMPOSITING/OUTPUT DIFFERENCE**

**Base:** `main` at `5d88d8f629b062bb1177b68616b86204d5dc152f`

**Production Three.js:** unchanged at `0.186.0`

## 1. Executive summary

The standalone fixture reproduces the opacity-sensitive WebGL/native-WebGPU difference without the Camera Simulator application or its custom material-aware adapter. On the primary opaque B0 background, r186 stock WebGL and native WebGPU differ substantially inside F0–F2, while the separately loaded material-aware adapter makes F0/F1 match stock WebGL exactly at opacity 0.16 and 0.50 and within 0.333 RGB MAE at opacity 1. F2 retains only 0.031–0.276 subject RGB MAE against WebGL across the tested opacities.

The fixture does **not** establish an upstream defect. Stock WebGL and stock WebGPU do not apply their output transformations at the same stage: WebGL material output reaches fixed-function blending after per-material output processing, while the r186 common WebGPU path can transform the completed working-space image afterward. The stock comparison therefore detects a real and repeatable contract difference, but is not a like-for-like defect proof. The adapter result is evidence that moving the output transform to the material output boundary explains most of this controlled fixture’s difference; it does not prove that it is the sole cause in the full Anatomy scene.

**UPR-3** is the supported classification. No upstream issue draft is prepared. The application-level output contract remains a separate design decision; this research does not change production rendering or Three.js.

## 2. M-INV8/M-INV9 evidence

M-INV8 found **TCI-3 — PARTIAL CONTRIBUTION ONLY**: suppressing blending reduced the Bellows-local WebGL/native difference, while the larger dimmed-group residual remained. M-INV9 found **OAR-1 — QUALIFIED OPACITY-DEPENDENT CROSS-RENDERER RESPONSE**, with the selected Bellows-region MAE changing from 35.3978 at opacity 0.16 to 15.8939 at 0.50 and 0.8580 at 1.00.

Those results establish sensitivity in the real Anatomy scene; they do not identify fragment alpha or a unique rendering stage. M-INV10 asks whether a transparency-sensitive signature survives in an application-independent fixture. It does. The previous studies’ measurements and reports remain unchanged: [M-INV8](VIEW_CAMERA_ANATOMY_BELLOWS_COMPOSITING_CAUSAL_INVESTIGATION.md), [M-INV9](VIEW_CAMERA_ANATOMY_BELLOWS_OPACITY_RESPONSE_INVESTIGATION.md).

Retained decisions are **Q2**, **PBI-3**, **N2**, **G2**, and **M2**. M-INV5 native intermediate destination/post-draw pixel measurements remain F2.

## 3. Upstream issue reconnaissance

| Reference | Reported mechanism and version | Upstream fix/status evidence | Relevance to this run and gap |
| --- | --- | --- | --- |
| [#33104](https://github.com/mrdoob/three.js/issues/33104), “Blending with transparent background is incorrect” | Reported against r183; associated with r184. Concerns transparent-canvas blending and browser composition. | Discussed in the compositor-contract follow-up [#33369](https://github.com/mrdoob/three.js/issues/33369). | B1 exercises a transparent canvas and HTML checkerboard. It is secondary: Anatomy uses an opaque authored scene background. Screenshot presentation cannot establish target alpha or source-fragment output. |
| [#33369](https://github.com/mrdoob/three.js/issues/33369), “WebGPURenderer Must Honor the Compositor Contract” | The order of premultiplication, tone mapping, color-space conversion, and browser composition. | [PR #33457](https://github.com/mrdoob/three.js/pull/33457) was merged for the r185 line. The [official migration guide](https://github.com/mrdoob/three.js/wiki/Migration-Guide) documents the r184-to-r185 WebGPURenderer premultiplied-alpha change and recommends opaque backgrounds when HTML composition is not needed. | The B1 r184→r185 WebGPU presentation change is consistent with this history. It does not by itself explain B0’s opaque-background difference. The run did not read the canvas target alpha. |
| [#34837](https://github.com/mrdoob/three.js/issues/34837), “convertToTexture after renderOutput does not preserve alpha” | A specific r186 postprocessing flow using output rendering and texture conversion. | [PR #34855](https://github.com/mrdoob/three.js/pull/34855) addresses the related path on the subsequent development line; stable r187 was not available in this comparison. | The Anatomy on-screen path and this fixture do not invoke that `renderOutput()`→`convertToTexture()` sequence. No conclusion about this issue is drawn here. |

The B1 measurement is a browser-presentation comparison, not an independent test of the exact target-alpha contract behind these issues. None of the references qualifies an upstream defect in the opaque Anatomy path.

## 4. Hypotheses

| Hypothesis | Finding |
| --- | --- |
| H1 — Unmodified Three.js has an unexpected mismatch under equivalent contracts | Stock G and W differ on B0, but the source paths use different output-stage contracts. This is not qualified as a contract violation. |
| H2 — The custom adapter introduces the discrepancy | Not supported. The adapter reduces the controlled mismatch and nearly matches WebGL; it does not create the large stock W difference. |
| H3 — Canvas/background compositor contract contributes | Supported for the B1 transparent-canvas control and its version transition. It is not sufficient to explain the opaque B0 behavior. |
| H4 — Version regression | Version-sensitive behavior appears in B1 from r184 to r185, consistent with the documented compositor change. B0 F1 r184/r185 comparisons are pixel-exact. No first-bad commit is inferred. |
| H5 — Output-pipeline stage explains the difference | Supported as a strong controlled-fixture explanation: stock W differs from G, while the material-aware boundary largely restores agreement. This is not a complete real-scene root-cause proof. |

## 5. Minimal fixture design

The fixture is independent of R3F, Camera Simulator routes/scenes/tasks, Ground Glass, material tracking, application capture events, and production renderer selection. It contains three fixed camera/geometry cases:

- **F0:** one transparent plane over a known background.
- **F1:** two depth-separated, overlapping transparent planes with fixed render order.
- **F2:** a single `BufferGeometry` mesh containing angled pleat quads. A center ray intersects at least two surfaces, so overlap is tested rather than inferred from appearance.

F2 is a compact Bellows analogue, not the authored Bellows mesh or Anatomy lighting/environment. Basic and Standard material families are run separately. No textures or application assets are used.

The runnable source and exact version packages are in [the standalone experiment](../../experiments/threejs-transparency-upstream-reproduction/README.md). The pure upstream entry is `shared/index.html`; the adapter entry is `shared/adapter.html` and loads a separate adapter module.

## 6. Material and renderer contracts

All three modes use opacity 0.16, 0.50, and 1.00 while keeping `transparent=true`, `NormalBlending`, `DoubleSide`, `depthTest=true`, `depthWrite=false`, `premultipliedAlpha=false`, and `forceSinglePass=false`. The Standard fixture uses fixed lights, material roughness/metalness, geometry, camera, and render order. Material state, actual fixture-object `onBeforeRender` order, projected intersections, and renderer counters are recorded per capture.

- **G:** `WebGLRenderer`, stock Three.js materials/output.
- **W:** `WebGPURenderer`, stock NodeMaterial path. Native WebGPU is required; WebGL2 fallback is a hard failure.
- **A:** native `WebGPURenderer` with a separate, minimal reproduction of the app’s material-aware NodeMaterial output boundary.

The adapter performs ACES Filmic tone mapping at exposure 1 when `toneMapped=true`, then converts working RGB to sRGB in `setupOutput()`. Its renderer uses `NoToneMapping` and `LinearSRGBColorSpace`; its background node separately converts the authored background to display sRGB. It copies only the bounded behavior in [the app adapter](../../src/render/backend/materialAwareNodeMaterials.ts) and [output initialization](../../src/render/backend/materialAwareObserverOutput.tsx); it does not import application tracking, scene, or renderer-selection code.

In the inspected r186 path, WebGL material shader output is tone mapped when its material requests it and output-color converted before fixed-function blending. When the common WebGPU renderer requires output processing, it can composite scene objects in a working-space target and apply the `RenderOutputNode` transform to the completed image. The output node clamps alpha, unpremultiplies, tone maps, converts color space, then premultiplies. See the r186 source for [`WebGLPrograms`](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgl/WebGLPrograms.js), [`Renderer`](https://github.com/mrdoob/three.js/blob/r186/src/renderers/common/Renderer.js), [`RenderOutputNode`](https://github.com/mrdoob/three.js/blob/r186/src/nodes/display/RenderOutputNode.js), [`WebGPUBackend`](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/WebGPUBackend.js), [`WebGPUPipelineUtils`](https://github.com/mrdoob/three.js/blob/r186/src/renderers/webgpu/utils/WebGPUPipelineUtils.js), and [`NodeMaterial.setupOutput`](https://github.com/mrdoob/three.js/blob/r186/src/materials/nodes/NodeMaterial.js).

This stage distinction means G and W are not equivalent merely because their material property values match. An RGB screenshot difference alone does not establish that either implementation is wrong.

## 7. Background and alpha controls

- **B0 (primary):** opaque light and dark backgrounds. A green HTML page sentinel is checked to qualify opaque canvas presentation. The actual WebGPU context configuration reports `alphaMode="premultiplied"`.
- **B1 (secondary):** clear alpha zero over an HTML checkerboard. Checker visibility confirms browser-page contribution in the presentation screenshot; it does not measure the canvas target alpha.
- **B2:** r186 F0 stock scene background versus explicit opaque renderer clear. Both WebGL and WebGPU screenshots were pixel-identical in the measured representation.

For every capture, requested clear alpha, context/backend, tone mapping, output space, CSS background, canvas size, DPR, and image representation are stored. The screenshot PNG’s alpha is the page screenshot’s alpha, not the GPU canvas target or fragment alpha. The test makes no target-alpha claim.

## 8. Version isolation

The primary repository dependency and lockfile remain on Three.js `0.186.0`. The research fixture has isolated exact dependencies and lockfiles for `three@0.184.0`, `0.185.0`, and `0.186.0`. Each run starts one Vite server pointing directly to that version’s package and uses fresh browser contexts/renderers; it never imports multiple versions into one renderer runtime. Every capture asserts exact `THREE.REVISION` and selected runtime package resolution.

The browser/OS, viewport (320×320), DPR (1), camera, geometry, colors, and capture representation are held constant. Native WebGPU is qualified via actual `GPUCanvasContext.configure()` / `getCurrentTexture()` methods and the renderer backend; fallback is rejected. Hardware acceleration itself was not independently verified. No r187 nightly/dev build was used. At the time of this report, stable r187 was unavailable; the official npm versions page listed r0.186.1 as the latest stable package.

## 9. r186 reproduction results

The first sizeable opaque-background stock difference appears already on F0, increases on the overlap fixtures at partial opacity, and approaches zero at opacity 1 on F0/F1:

| Fixture | Opacity | Stock G↔W subject RGB MAE | G↔W overlap RGB MAE | G↔A subject RGB MAE |
| --- | ---: | ---: | ---: | ---: |
| F0 | 0.16 | 6.333333 | 6.333333 | 0 |
| F0 | 0.50 | 34.333333 | 34.333333 | 0 |
| F0 | 1.00 | 0.333333 | 0.333333 | 0.333333 |
| F1 | 0.16 | 12.000000 | 12.000000 | 0 |
| F1 | 0.50 | 45.000000 | 45.000000 | 0 |
| F1 | 1.00 | 0.333333 | 0.333333 | 0.333333 |
| F2 | 0.16 | 17.375962 | 19.333333 | 0.030962 |
| F2 | 0.50 | 43.631346 | 47.333333 | 0.275705 |
| F2 | 1.00 | 2.004295 | 0 | 0.030962 |

Values are RGB MAE on matched browser-presentation screenshots and fixed ROIs. For r186 standard F1 at O1, stock G↔W full-frame RGB MAE is 31.869792, subject/overlap MAE 45, background-ROI MAE 24.666667, maximum channel difference 60; all 102,400 screenshot pixels change. G↔A at the same condition is pixel-identical across the full image. A contributes a strong, bounded material-output stage control, not a direct source-alpha measurement.

## 10. r184/r185/r186 comparison

For the primary opaque B0 F1 Standard fixture, stock WebGL and WebGPU were pixel-identical between r184 and r185 at all three opacity values. From r185 to r186, changes were small (maximum full-image RGB-channel difference at most 3 in those selected F1 conditions); the opacity-sensitive G↔W pattern remains present in all tested releases.

The transparent B1 F0 O0.50 WebGPU comparison changes more at r184→r185 than r185→r186:

| Version transition | Full-image RGB MAE | Subject RGB MAE | Max channel difference |
| --- | ---: | ---: | ---: |
| r184→r185 | 4.583333 | 13.333333 | 30 |
| r185→r186 | 0.343750 | 1.000000 | 2 |
| r184→r186 | 4.927083 | 14.333333 | 32 |

WebGL B1 was pixel-identical from r184 to r185 in this control. The WebGPU version transition aligns with the documented r185 compositor-contract update, while the remaining presentation and target-alpha limits prevent a stricter claim. No commit-level bisect was done.

## 11. Stock versus custom adapter

At r186, F0 and F1’s stock G↔W difference is large at opacity 0.50 (subject MAE 34.333333 and 45). The adapter’s G↔A image is exact on both fixtures at 0.50 and also exact at 0.16; at 1.00 it differs by 0.333333 subject MAE. In the folded F2 case, adapter-vs-WebGL subject MAE remains 0.030962, 0.275705, and 0.030962 at O0/O1/O2, respectively; the O1 overlap ROI difference is 0.333333.

The adapter therefore removes nearly all of the controlled difference for these fixtures. The residual on F2 is small and consistent with remaining NodeMaterial/WebGL shader or geometry-family details; this experiment does not isolate those details or prove that the adapter reproduces all Anatomy material behavior.

## 12. Numerical and visual evidence

The expanded evidence JSON stores capture metadata, samples, per-capture renderer counters, repeat comparisons, ROIs, per-channel signed/absolute metrics, max differences, changed pixels, opacity response, background response, version comparisons, and disposal witnesses. The compact committed report is [report.json](threejs-transparency-upstream-reproduction/report.json). Selected screenshots and the 1.3 MB expanded run evidence remain under the ignored `test-results/threejs-transparency-upstream-reproduction/` directory.

All numeric image comparisons use the same 320×320 browser viewport PNG representation. It includes browser page composition. No browser screenshot is labeled raw framebuffer, native target alpha, or source fragment output. The screenshot alpha channel was not used to infer canvas transparency.

## 13. Repeatability

The final full matrix recorded 98 condition captures, each repeated under the same renderer/context, with all 98 repeated screenshot pairs pixel-identical (RGB MAE 0; changed-pixel count 0). Conditions include all three exact Three versions; stock G, stock native W, and adapter A; Standard and r186 Basic material controls; B0 light/dark, B1, and B2; and selected opacity/version pairs. Same-condition repeat checks are reported separately from cross-mode/version comparisons.

## 14. Negative controls and test integrity

The browser suite asserts 11 control groups: exact package/runtime revision; native WebGPU context/backend; material family; allowed opacity and `transparent=true`; blend/depth/side/tone mapping; object order and F1/F2 projected overlap; viewport/camera/DPR/color/tone policy; background/clear/compositor qualification; repeated image consistency; compatible screenshot representations; and exactly-once owned-resource disposal.

The renderer info auto-reset behavior is disabled for statistics only, so each capture can report before/after counters and a per-condition delta. The recorded Three.js counter field is named because WebGL and common WebGPU expose different draw statistics. The fixture’s object-level `onBeforeRender` order remains a separate per-capture assertion. This setting does not change material, render target, output, or GPU submission behavior.

The fixture creates no borrowed application resources. Across 27 teardown sets, 584 owned materials/geometries received exactly one disposal event each. No persistent instrumentation or GPU resource registry is used.

## 15. Classification and confidence

**UPR-3 — DOCUMENTED COMPOSITING/OUTPUT DIFFERENCE.** The strongest evidence is the combination of (a) a reproducible opaque-background stock mismatch, (b) source-verified different output transform stages, (c) near-exact G↔A agreement after a bounded material-aware output change, and (d) a separate B1 version transition corresponding to the known compositor-contract change.

Confidence is **high** in the deterministic fixture, exact version/backend qualification, and repeatability; **moderate** in the output-stage explanation; and **limited** for the exact causal contribution in the full real Anatomy scene. Stock G/W are not an equivalent-output-contract comparison, and browser screenshot pixels do not disclose target alpha.

## 16. Relation to Anatomy

M-INV10 shows that an opacity-sensitive G/W discrepancy does not require Camera Simulator scenes, React, or the custom adapter to appear. The adapter reduces the difference in the minimal F0/F1 controls, so it is not supported as the originating cause. This is qualitatively relevant to M-INV9’s opacity-dependent Anatomy response, but the standalone fixtures do not include the authored Bellows mesh, its full lighting/occlusion, native intermediate target reads, or the complete application output path. It is not an identical-root-cause finding.

## 17. Upstream issue readiness

No UPR-1 defect candidate is qualified. The broad G↔W difference alone is not enough because the stock output-stage contracts differ; the transparent-canvas screenshot is not a target-alpha measurement; and the known r184/r185 behavior has an upstream compositor fix history. **No upstream issue draft is created and no issue is submitted.**

## 18. Recommended next action

Make an explicit application-level output contract decision before any separate correction work. If an opt-in output-stage change is pursued later, qualify it against the real Anatomy scene and relevant material families with the existing resource lifecycle and visual parity gates. M-INV10 does not authorize a production correction or renderer-policy change.

## 19. Production isolation and lifecycle

The experiment lives under `experiments/`, with separate exact-version packages and its own Playwright configuration. It does not add routes or imports to the application, alter root `package.json` or `package-lock.json`, patch Three.js source, change renderer eligibility, or modify application rendering behavior. The app stays on `three@0.186.0`. All temporary scene materials and geometry are disposed exactly once; each browser context, renderer, and version server is torn down after its group. Large evidence remains ignored.

## 20. Remaining unknowns

- Actual render-target/canvas alpha and source-fragment alpha were not independently read.
- Hardware acceleration was not independently verified, though native WebGPU APIs/context were.
- F2 is a controlled folded-pleat analog, not the real Bellows mesh.
- G and W stock output contracts differ, so the cross-backend difference is diagnostic, not defect proof.
- The adapter explains this small fixture’s matching behavior but does not uniquely attribute all M-INV9 real-scene pixels.
- The r187 postprocessing fix path was not run because no stable r187 release was available; it is not exercised by the Anatomy on-screen route in any case.

## Review-Fix — Screenshot Evidence Integrity

The previous review started from `f02ff9f7473771c3c72b8175d007f12294ce684d`. Its in-memory capture key distinguished version, backend/output, fixture, material family, opacity, and background, but the retained screenshot filename omitted material family and opacity. As a result, the r186 F1 light O0.50 Standard and Basic captures shared three paths across G/W/A, and the later Basic images replaced the Standard files.

The corrected runner derives both the in-memory key and screenshot path from one capture identity. Filenames include version, renderer mode (G/W/A), fixture, family, background, and opacity formatted to two decimals. A path is claimed before writing; a second owner fails with both capture identities in the error. The end-of-run manifest checks unique paths, identity-to-path agreement, current-run file existence, and one provenance record per claimed path. Each retained PNG is the exact byte buffer from the measured screenshot capture; the runner decodes the written file and requires its RGBA pixels to equal the in-memory pixels used for measurement.

The full matrix was regenerated from capture source revision `aeb0aba07f12af9e2b06f28a18b371a8183f653b`. It retained 24 screenshot entries at 24 unique paths; all 24 artifacts exist, map to a capture identity, and decode as 320×320 images. The six repaired r186 F1 light O0.50 artifacts are:

- `r186-G-F1-standard-light-o0.50.png` and `r186-G-F1-basic-light-o0.50.png`
- `r186-W-F1-standard-light-o0.50.png` and `r186-W-F1-basic-light-o0.50.png`
- `r186-A-F1-standard-light-o0.50.png` and `r186-A-F1-basic-light-o0.50.png`

The run again qualified 98 captures, 130 pair comparisons, 98/98 pixel-identical same-condition repeats, 65 native WebGPU captures, 27 cleanup sets, and 584 exactly-once owned-resource disposal records. The principal r186 G↔W and G↔A measurements match the historical table above exactly; no experiment condition or numerical result changed. Expanded per-capture identity and path records are in the ignored `test-results/threejs-transparency-upstream-reproduction/evidence.json`, and the committed report lists the same 24 paths and capture identities.

## Validation record

- Standalone native version matrix from source revision `aeb0aba07f12af9e2b06f28a18b371a8183f653b`: **3 passed** (the full matrix plus two pure screenshot-identity tests), 98 captures, 130 pair comparisons, 98/98 pixel-identical same-condition repeats, 65 native WebGPU captures, and 24/24 unique retained screenshots verified against their measured pixels.
- Standalone TypeScript check for `run.spec.ts`, `screenshotIdentity.ts`, and `screenshot-identity.spec.ts`: **passed**.
- Repository `npm run ci:local`: **passed** (CSS, lint, typecheck, 266 test files / 2,471 tests, and production build).
- Production-preview isolation: **2 passed** using `src/tests/e2e/architecture-rise-webgpu-production.spec.ts`.
- Production asset scan: **passed**, with no M-INV10 identifiers, adapter entry names, or r184/r185 experiment package signatures in `dist`.
- Root `package.json` and `package-lock.json`: unchanged.

From the repository root, install the independent package locks as described in the [fixture README](../../experiments/threejs-transparency-upstream-reproduction/README.md), then run the native matrix. The recorded run used Playwright `1.61.1`, Chrome 155, one worker, and exact r184/r185/r186 package resolutions. Hardware acceleration was not independently verified. The screenshot representation and target-alpha limitations remain as stated above.
