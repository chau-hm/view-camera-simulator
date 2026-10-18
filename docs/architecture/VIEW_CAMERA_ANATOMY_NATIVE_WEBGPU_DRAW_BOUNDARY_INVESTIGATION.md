# Anatomy Native WebGPU Draw-Boundary Investigation

## Decision

**N2 — Controlled proxy improvement.** The experiment identified and measured two real native WebGPU draw invocations for the mounted Bellows renderable, and recorded raw attachment samples on both sides of each invocation. The adapter splits the live render pass to obtain those samples. Its output-equivalence check did not qualify, so the destination and post-draw pixel measurements remain **F2**.

Keep **G2 — PARTIAL STAGE ATTRIBUTION** and **M2 — OPT-IN IMPLEMENTATION INCOMPLETE**. This report does not diagnose a dominant cause, authorize a rendering correction, promote WebGPU, or start PR N.

The machine-readable run evidence is [report.json](./anatomy-native-webgpu-draw-boundary/report.json). Its base is `eeda498658df26ab6ceb74d4dff49033774de9bb`; the instrumentation measurement commit is `8369f770985e48b92ebbac2d15d52de98ddc2999`.

## Question and PR #264 baseline

PR #264 established WebGL F1 observations around two actual Bellows `drawElements` calls, but found no supported public API for reading between native WebGPU commands in an open render pass. Its separate RGBA32F replay disabled blending on an owned material clone and was classified F2. Across five shared covered samples, that replay had approximately 0.02003 normalized RGB MAE (5.108 equivalent 8-bit levels) and no measured alpha difference. Those proxy conditions cannot be subtracted from the original approximately 104.128-level Front Standard response to estimate a blend-stage residual.

M-INV5 asked whether the actual native Anatomy pass could expose destination and post-draw values without changing relevant rendering semantics. The work was limited to the mounted Front Standard state with Bellows dimmed, B0 material-aware output, one dynamically selected renderable, and nine preselected framebuffer samples.

## Three.js r186 render path and feasibility

The pinned dependency was inspected in `node_modules/three/src/renderers/common/Renderer.js`, `Pipelines.js`, `RenderList.js`, `RenderObject.js`, `node_modules/three/src/renderers/webgpu/WebGPUBackend.js`, and `utils/WebGPUPipelineUtils.js`.

The mounted scene is collected into the common renderer's render lists. For each selected render object, the pipeline manager prepares the render pipeline and the backend's `draw(renderObject, info)` encodes commands into the active `renderContextData.currentPass`. `finishRender(renderContext)` closes the pass and submits the command encoder. The selected native object and material are available on the backend render object, so the capture can match the exact live object and adapted material rather than a historical UUID.

Three.js r186 configures the default canvas texture with `RENDER_ATTACHMENT | COPY_SRC`. Its `Renderer.copyFramebufferToTexture()` public entry point reaches `WebGPUBackend.copyFramebufferToTexture()`. For an ordinary active pass, the backend ends the pass, copies the current canvas texture into the requested texture using the same command encoder, changes color and enabled depth/stencil load operations to `load`, begins a resumed pass, resets render-context bindings, and reapplies viewport and scissor. This is a viable bounded segmentation point for this pass shape; it does not by itself prove that segmentation is semantically neutral.

Three's common renderer also sends transparent `DoubleSide` material through back-side and front-side passes when `forceSinglePass` is false. The new capture verified two separate native backend invocations for this selected mesh instead of assuming WebGL's two calls mapped one-to-one. Each invocation contained one native indexed draw command.

| Approach | Finding |
| --- | --- |
| A. Record backend draw identity and metadata | F1 for the observed live object/material, direct backend invocation count, draw parameters, active attachment descriptor, and the guarded r186 pipeline utility's blend mapping. It does not expose source fragment output. |
| B. Split the active pass and copy the color attachment | Technically worked through the r186 `copyFramebufferToTexture()` path. Color/depth loads resumed as `load`, but the final-frame equivalence check did not qualify. Its destination/post-draw pixels are F2. |
| C. Controlled equivalent replay | The existing PR #264 F2 replay remains available as a separate proxy. M-INV5 did not change or relabel it. |

The adapter is isolated in [anatomyNativeWebGpuDrawBoundaryCapture.ts](../../src/render/backend/anatomyNativeWebGpuDrawBoundaryCapture.ts). It fails closed unless the runtime is native `webgpu-renderer/webgpu` on Three r186, and for offscreen targets, missing pass/encoder state, render bundles or array cameras, occlusion/timestamp query passes, incompatible canvas formats, unavailable draw metadata, or multi-command draw shapes. It does not patch Three.js, change shared rendering policy, or instrument Ground Glass.

## Captured native state

The browser run used Chrome `155.0.8059.84` on Darwin arm64, viewport 1440×1000 at DPR 1. The mounted renderer reported `webgpu-renderer`, `webgpu`, no application fallback, and material-aware output. Hardware acceleration was not independently confirmed.

The selected object was the live `bellows-folded-surface` Anatomy renderable. Its indexed geometry had 240 indices and 44 position/normal vertices. Its source material was `MeshStandardMaterial`; the active B0 output material was `MeshStandardNodeMaterial` with opacity 0.16, transparent source-over blending, `premultipliedAlpha=false`, depth test enabled, and depth writes disabled. The guarded r186 utility reported the pipeline blend mapping as F3 inference: RGB `src-alpha / one-minus-src-alpha / add`; alpha `one / one-minus-src-alpha / add`; depth compare `less-equal`. The compiled GPU pipeline descriptor itself is not exposed for direct inspection.

| Field | Observed value |
| --- | --- |
| Default-surface color format | `bgra8unorm`; copied bytes are reported in RGBA channel order |
| Color samples | 4× MSAA with a resolve target |
| Depth/stencil | `depth24plus`, depth enabled, stencil disabled |
| Canvas alpha mode | `premultiplied`; captured raw sample alpha was 255 |
| Renderer output color space | `srgb-linear`; the sampled values are raw 8-bit attachment code values |
| Initial pass loads | Color clear; depth clear |
| Resumed selected-draw passes | Color load; depth load; store operations retained |
| Viewport | 1028×820 |
| Scissor | 600×300 box; scissor test disabled at both captured draws |
| Native draw count | Two `drawIndexed` backend invocations; one command each; 240 indices, one instance |
| Pipeline/pass identifiers | Pipeline id and `RenderObject.passId` were null; adapter-local pass ids identify the split passes only |
| Added segmentation passes | Two copies before/after each selected draw plus one final-frame copy: five total |

The material side values were back-side (`1`) for the first call and front-side (`0`) for the second, matching the common renderer's transparent double-sided path. The source material and geometry were not changed. The original command sequence remains in order, but the additional pass boundaries and resolves are part of the experiment and are not claimed equivalent.

## Native destination and post-draw measurements

Nine fixed points were read from the raw 1028×820 attachment. Eight were selected evidence points; one was an unaffected candidate control. Both draw invocations affected the same live renderable and source material. The first changed 5 of 9 samples, with mean absolute RGB code-value difference 13.852 and maximum channel difference 31. The second changed 4 of 9, with mean difference 5.704 and maximum 26. Alpha difference was zero at these opaque attachment samples. Pixel-level values and coordinates are in `report.json`.

These values demonstrate a measurable change at selected samples in the instrumented native pass. They do not reveal source fragment RGB/alpha, and the two draw response summaries include the fixed sample set rather than a full-renderable coverage mask. Source fragment RGB and alpha remain null/F0.

The direct WebGL baseline was captured live with the same teaching state, camera pose, framebuffer dimensions, selected source material, and sample positions. It also observed two real draw calls and is F1 for WebGL draw-boundary readings. Native and WebGL raw bytes are stored as all-pairs numerical candidates: the four per-draw pair means ranged from 140.759 to 150.556 RGB code values, with zero alpha difference. The two native calls are not asserted to correspond one-to-one to the two WebGL calls; these numbers do not answer whether the dominant discrepancy occurs before or during a particular matched draw.

PR #264's five-sample replay result remains separate. The native and WebGL per-draw candidates are not used to revise that result or estimate a blend residual.

## Instrumentation parity and negative controls

The M-INV5 baseline was a repeated same-mode B0 browser canvas screenshot. Repeat RGB MAE was 0. The final native GPU attachment is 1028×820 while the screenshot is 514×411; the run resampled attachment pixel centers to screenshot pixels and included browser canvas resampling/composition. That cross-representation comparison measured MAE 1.269, center-sample MAE 1.513, maximum RGB difference 235, and 5,409 changed pixels out of 211,254. With repeat noise 0, it failed the parity threshold.

This does **not** establish that pass segmentation caused the difference: the comparison uses different representations and resolutions. It also does not qualify unchanged final output. The raw destination/post-draw data therefore remain F2. A raw-to-raw B0 baseline is the smallest next experiment needed to evaluate the segmentation perturbation.

Other controls:

- The selected draws changed fixed Bellows evidence samples, while the designated negative-control sample remained unchanged.
- The source material identity and properties, geometry identity, scene input snapshot, and visibility were preserved/restored.
- The next uninstrumented canvas screenshot matched the pre-capture screenshot at MAE 0.
- Ground Glass remained contentful. Its post-capture image differed from its baseline at MAE 0; repeat noise was 0.00111. No Ground Glass target or source resource was disposed.
- Existing M-INV4 opaque, transparent, blend-state, draw-order, and orientation calibration controls remain in the focused suite and passed.
- Native pipeline blend mapping is F3; it is inferred from the pinned r186 `WebGPUPipelineUtils._getBlending()` mapping and active material, not read back from a compiled `GPUColorTargetState`.
- Wrong or retired generation requests were suppressed. An overlapping request was rejected with `capture-already-active`.

## Capture lifetime and resource ownership

The probe reuses PR #264's per-mount identity, renderer-generation check, abortable lifetime, single-active-capture slot, and result publication gate. The native adapter additionally installs only temporary wrappers on the mounted WebGPU backend's `draw` and `finishRender` methods. Its cancellation callback restores those wrappers synchronously. The wrappers are also restored before asynchronous readback begins.

An already-submitted WebGPU copy/map cannot be physically cancelled. The adapter awaits the readback settlement, checks the owning capture token after the await, and publishes no success or failure result for a retired capture. Each owned readback buffer is destroyed in `finally` after `mapAsync()` resolves or rejects. Owned `FramebufferTexture` snapshots are disposed after all maps settle. The canvas texture, scene materials, geometry, and Ground Glass resources are borrowed and never disposed.

The browser tests replace `GPUBuffer.prototype.mapAsync` only inside the test page. The wrapper invokes the actual native `mapAsync()` immediately, while a deterministic event gate holds the application-visible promise until the test resolves or rejects it. No arbitrary sleeps are used.

- **Calibration cancellation:** navigation retires the original Anatomy probe while its first actual map is held pending. After resolution, `mapAsync` was called exactly once for the retired capture, so no next fixture readback was submitted. The new renderer generation became active, a stale old-container request produced no result, the overlap was rejected, and the cancelled capture released its two targets, geometry, and eight materials.
- **Proxy cancellation:** the test compared authored scene inputs, visibility, source material properties, and geometry identity before resolving the pending readback. The cancelled capture disposed one temporary target and one cloned material and preserved borrowed resources.
- **Native boundary rejection:** the old generation was retired while the five snapshot readbacks were held. The test then forced the application-visible map promise to reject after the underlying native map settled. No old result/error event escaped; all five owned snapshot textures and readback buffers were released once. This is a deterministic rejection-path test, not simulated WebGPU device loss.
- All three lifecycle cases reported no page errors. The normal capture path and overlap policy passed in the same focused run.

## Decision and remaining unknowns

The pass wrapper improves observability of real native draw identity and provides raw destination/post-draw samples. It does not establish pass-segmentation equivalence because the current final-frame check compares a raw GPU attachment with a lower-resolution browser screenshot and fails the measured zero-noise threshold. The measurements cannot isolate whether the WebGL/native difference exists before Bellows, is introduced by a selected draw, or accumulates differently across a matched pair of draws.

Unknowns retained as null or qualified inference:

- Compiled native pipeline blend/depth descriptors are not directly introspectable after pipeline creation; the blend mapping is F3.
- Fragment shader source RGB and alpha are unavailable (F0); opaque destination alpha cannot be rearranged into a source-alpha estimate.
- `RenderObject.passId` and pipeline cache id were null in the capture; adapter-local pass ids are not stable across runs.
- The comparison of raw native attachment values with screenshot pixels includes browser scaling/composition and cannot quantify instrumentation-induced output change.
- The captured scissor enable/value and pass load state describe the instrumented run, not a separate uninstrumented native pass trace.

Recommended next investigation: add a disabled-instrumentation raw-to-raw attachment capture through the same pinned surface-copy/readback path, at the same backing dimensions, output policy, camera, and sample count. Compare that raw baseline to an instrumented final raw attachment and keep the same no-widening noise threshold. Do not expand to more scenes or infer source alpha until that comparison qualifies.

## Validation

- Final focused native M-INV4/M-INV5 Playwright configuration: **5 passed**, native-required, material-aware, no fallback.
- Pending-readback SPA retirement regressions: **3 passed** (calibration resolution, proxy resolution, native draw-boundary rejection).
- Focused native draw-boundary unit tests: **5 passed**.
- `npm test`: **258 files / 2,388 tests passed**.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run check:css`: passed.
- `npm run build`: passed; 700 modules transformed.
- Native-required 13-state Anatomy audit: **2 passed, 1 skipped** by the suite's existing skip condition; the captured state set covered all 13 configured candidates. The skip is not counted as a pass.
- Native-required PR #263 four-state output-mechanism experiment: **1 passed**.
- Architecture Rise strict visual parity: **1 passed**, with zero failures across the existing 81 criteria.
- Final production preview test: **2 passed** after the final build. Default and explicit WebGPU requests remain on/refused from the WebGL-only production policy, and the Anatomy material-aware candidate is denied. The test checks loaded assets for development capture strings.
- `git diff --check`: passed.

No normal WebGL output, production renderer eligibility, shared output policy, Anatomy authored material, teaching state, camera optics, or Ground Glass implementation was changed.
