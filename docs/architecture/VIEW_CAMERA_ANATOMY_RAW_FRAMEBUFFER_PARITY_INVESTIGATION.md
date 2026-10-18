# Anatomy Native Raw Framebuffer Parity Investigation

## 1. Objective

M-INV6 measures whether the pass segmentation used by M-INV5 changes the final native WebGPU framebuffer for the Front Standard teaching state with the Bellows dimmed under material-aware policy B0. It replaces M-INV5's invalid raw-GPU-versus-CSS-screenshot comparison with two readbacks of the same native attachment. This is a diagnostic measurement; it does not change rendering behavior.

The committed compact measurements are in [`anatomy-raw-framebuffer-parity/report.json`](anatomy-raw-framebuffer-parity/report.json). Full raw RGBA files remain in ignored Playwright `test-results`.

## 2. M-INV5 evidence and limitation

M-INV5 observed two real native `drawIndexed` backend calls for the mounted Bellows surface. Each issued one command for 240 vertices and one instance. The source format was `bgra8unorm`, the render target used 4× MSAA with a resolve target, and depth used `depth24plus`. M-INV5 destination and post-draw pixel values remain F2 because final-frame equivalence had not been established. Draw identity and directly observed pass metadata were F1; blend mapping was F3; source fragment RGB/alpha was F0.

The unresolved comparison mixed a 1028×820 raw attachment with a 514×411 browser screenshot. Its approximately 1.269 RGB MAE exceeded zero screenshot repeat noise, but the representations were incompatible, so the measurement could not attribute that difference to instrumentation.

## 3. A0, A1, and A2

- **A0 — uninstrumented reference:** normal native material-aware scene rendering with no capture operation, hook, or copy. A0 is recorded as matching browser canvas screenshots only; raw GPU bytes are not claimed.
- **A1 — minimum-intervention raw baseline:** normal scene draw order and one copy of the resolved native final attachment at `finishRender`. It installs no selected-draw hook and adds no selected-draw split.
- **A2 — M-INV5 instrumentation:** two before/after copy boundaries around the two real Bellows draws, followed by the same final-frame copy and readback as A1.

A1 is not completely uninstrumented. Its final attachment copy ends the active pass, resolves multisample color, copies the resolved canvas texture, and resumes color/depth with `load` in the same command encoder. A2 uses that same final copy, plus four selected-draw pass splits.

## 4. r186 capture mechanism and ownership

The A1 path wraps the pinned Three.js r186 `WebGPUBackend.finishRender` at the live canvas render context. It verifies the live canvas format, active pass, sample count/resolve shape, and resumed load state, then uses r186 `renderer.copyFramebufferToTexture()` and the existing native texture-to-buffer `mapAsync()` readback helper. The code does not re-render, clear, alter materials, reorder draws, or read multisample storage as a single-sample texture. A2 uses the existing M-INV5 copy/readback path for all selected pre/post snapshots and the final frame.

Only temporary `FramebufferTexture` snapshots and mapped readback buffers are owned. Successful captures dispose snapshot textures after readback settlement. The renderer, device, canvas texture, scene geometry/materials/textures, and Ground Glass RTT are borrowed and are not disposed. The probe routes A1 through the same renderer-generation owner, one-active-capture slot, cancellation gate, result-publication gate, and cleanup registration used by the existing capture methods.

### Finish failure and resource lifetime

Three.js r186 `WebGPUBackend.finishRender()` calls `encoder.finish()` and passes the resulting command buffer to `queue.submit()`. If the wrapped method throws, the capture cannot tell whether the throw occurred before command-buffer creation, before submission, during submission, or later in the method. A1 and A2 therefore mark submission as unknown, do not start a readback, settle an unsupported `native-finish-render-failed` outcome, restore their hooks, and rethrow the renderer exception. Capture-owned snapshots remain alive until `GPUQueue.onSubmittedWorkDone()` confirms prior queue work has completed; if the queue fence rejects, cleanup waits for the owning device-loss promise. This fence governs disposal only and is not treated as evidence that the capture was submitted. The round-one regression tests inject the throw at the original `finishRender` call and verify single disposal after the fence. These lifecycle checks do not rerun or change the recorded Q2 framebuffer measurements.

## 5. State and synchronization

The experiment stayed in renderer generation 1. It used the Front Standard highlighted/Bellows dimmed state, B0 material-aware output, unchanged authored source properties, the M-INV5 camera pose, a 1440×1000 CSS viewport at DPR 1, and a 1028×820 backing buffer. The source Bellows material remained transparent at opacity 0.16. The captured camera, teaching state, scene inputs, viewport, and generation were checked before and after every capture.

The exact order was A1-1, A1-2, A2-1, A2-2, A1-3, A2-3, A1-4, A2-4. The first four captures establish the six pairwise repeat comparisons per mode. The final two interleaved A1/A2 pairs are the raw parity comparisons. Raw readback completion is synchronized by the native `GPUBuffer.mapAsync()` settlement, not by an animation-frame delay. Screenshots are separately compared at matching CSS presentation dimensions.

## 6. Attachment and coordinate normalization

The native attachment was 1028×820 `bgra8unorm`, 4× MSAA with a resolve target, `depth24plus`, `srgb-linear` output space, and no tone mapping. Readback rows were unpadded from WebGPU's 256-byte row alignment and normalized from native BGRA into top-down RGBA bytes. No color-space conversion, CSS resampling, or browser composition was applied to raw comparisons.

The Bellows mask is the intersection of the committed Front Standard dimmed-response and Bellows visibility-response masks. Screenshot mask pixels map to the center native pixel of the corresponding backing-buffer cell; this is explicitly a mapped-center mask, not coverage of every native sample touched by the CSS pixel. Its native region contains 5,444 pixels. The unaffected background mapped-center region contains 189,482 pixels. The nine fixed sample indices are the exact M-INV5 framebuffer indices and are not remapped.

## 7. A0/A1/A2 screenshot controls

A0 repeat noise was zero. A1 repeat screenshot noise and A2 repeat screenshot noise were also zero. The maximum A0-to-A1 screenshot RGB MAE was zero and qualified against its zero repeat threshold. The maximum A0-to-A2 screenshot RGB MAE was zero and also qualified. Thus the capture interventions produced identical browser presentation in this run, even though their raw attachments did not match.

## 8. Raw repeatability and A1/A2 result

Every A1-to-A1 and A2-to-A2 raw comparison was byte-exact: all six pairwise comparisons per condition had zero RGB/alpha MAE, zero maximum error, zero changed pixels, and all 842,960 pixels exactly equal. The Bellows, unaffected, and fixed-sample repeat noise was also zero.

Both interleaved A1/A2 comparisons reported the same five changed pixels. Full-frame RGB MAE was 0.0000019771598494, alpha MAE was zero, maximum channel error was 1, and 842,955 of 842,960 pixels matched exactly. The changed-pixel fraction was 0.00059314795%. All changes were red-channel LSB differences; alpha, green, and blue were exact.

| Native pixel (x, y) | A1 RGBA | A2 RGBA | Region |
| --- | --- | --- | --- |
| (569, 330) | [195, 198, 202, 255] | [194, 198, 202, 255] | Bellows mapped-center |
| (570, 330) | [195, 198, 202, 255] | [194, 198, 202, 255] | Outside mapped masks |
| (571, 331) | [194, 198, 202, 255] | [195, 198, 202, 255] | Outside mapped masks |
| (639, 343) | [193, 196, 200, 255] | [192, 196, 200, 255] | Outside mapped masks |
| (502, 513) | [211, 212, 215, 255] | [210, 212, 215, 255] | Outside mapped masks |

In the 5,444-pixel Bellows mapped-center region, one pixel changed: RGB MAE 0.0000612294881, maximum error 1, and changed-pixel percentage 0.0183688464%. The 189,482-pixel unaffected region was exact. All nine M-INV5 fixed samples matched exactly in both A1/A2 comparisons. Because measured repeat noise was zero, the one-byte changes exceed the criterion; no tolerance was widened.

## 9. Negative controls

- The comparator detected a synthetic one-byte change at one pixel.
- A1/A2 attachment metadata matched exactly, including 4× resolve/depth state, camera, viewport, scene, and output state.
- A2 retained two `native-drawIndexed` Bellows calls, each one command with 240 vertices and one instance. The resumed color/depth attachments used `load`.
- A fresh native calibration passed the asymmetric top-down orientation check, opaque `[191, 64, 26, 255]` control, transparent `[48, 16, 6, 64]` control, changed-blend-state control, and changed-draw-order control. Its targets, geometry, and materials were released (2, 1, and 8 dispose events). This is an F2 controlled fixture, not a measurement of the actual Anatomy draw.
- The calibration restored the canvas exactly (RGB MAE 0). Ground Glass remained contentful; its restoration MAE was 0 against 0.0011112790 repeat noise.
- The deterministic native pending-`mapAsync` SPA teardown, A1/A2 overlap rejection, readback rejection, stale-generation suppression, and resource cleanup regressions passed in the focused suite.

## 10. Result, classification, and limits

**Outcome Q2 — measurable instrumentation perturbation.** The final-only and pass-segmented browser screenshots match, and each raw mode is exactly repeatable, but A1 and A2 raw frames differ by five red-channel LSBs. This directly measures a final-frame instrumentation perturbation under the tested state. It does not prove which pass operation caused each difference.

The likely mechanisms include additional color/depth store-load boundaries and MSAA resolve timing. That is a hypothesis, not a demonstrated subcause. A progressive experiment that adds one boundary at a time would be needed to isolate it. The actual M-INV5 intermediate destination/post-draw pixel values therefore remain F2. The directly observed selected-draw identity and pass metadata remain F1, blend descriptor mapping remains F3, and native source fragment RGB/alpha remains F0. The synthetic and calibration fixtures do not promote actual-scene pixel evidence.

The result retains **N2 — CONTROLLED PROXY IMPROVEMENT**, **G2 — PARTIAL STAGE ATTRIBUTION**, and **M2 — OPT-IN IMPLEMENTATION INCOMPLETE**. No rendering correction or PR N work is started.

## 11. Validation

- Focused native M-INV4/M-INV5/M-INV6 suite: 7 passed, no skips. The M-INV6 report records Chrome 155.0.8059.84 on Darwin arm64, Three.js r186, and no application fallback. The backend did not expose GPU adapter details; hardware acceleration remains unconfirmed.
- PR #263 native four-state output experiment: 1 passed.
- Native-required 13-state Anatomy audit: 2 passed, 1 existing mode-specific skip; all 13 matched states were captured. The skipped two-way legacy case is not counted as passed.
- Architecture Rise strict parity: 1 passed, 0 failures across the unchanged 81 criteria.
- Production preview/isolation: 2 passed. The production routes remained WebGL-only; loaded JavaScript contained no experimental Anatomy capture probe/event identifiers.
- `npm test`: 259 files and 2,407 tests passed.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and `git diff --check`: passed. The build transformed 701 modules.

Ground Glass remained contentful and restored within its measured repeat noise. The raw capture files remain only in ignored Playwright results.

## 12. Smallest next investigation

Keep the current classifications. If the cause of the five final-frame LSB changes matters, compare the same exact native raw output with one selected pass boundary enabled at a time, keeping capture order, scene, camera, and readback identical. Do not infer a physical blend mechanism or begin a rendering correction from this result alone.
