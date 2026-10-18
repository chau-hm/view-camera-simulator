# Anatomy Progressive Native WebGPU Pass-Boundary Investigation

## Objective and result

M-INV7 tested which of four additional framebuffer-copy boundaries reproduce the five one-level red-channel differences measured by M-INV6 between A1 final-frame-only capture and A2 full selected-draw instrumentation.

**Outcome: PBI-3 — perturbation reproduced but not uniquely localized.** The experiment preserves the M-INV6 measurement method and makes no claim that the copy-boundary effect dominates the original WebGL/native WebGPU compositing discrepancy.

The full M-INV6 difference reappeared in two interleaved, repeatable capture sequences. The first progressive split (S1) changed only (502, 513). Adding S2 in P2 introduced the other four historical pixels. The isolated S2 and S3 controls each reproduced those same four pixels; S4 alone produced no changed pixels. This identifies stable partial signatures, but the four-pixel group cannot be assigned uniquely to S2 versus S3 from this experiment.

| Control | Enabled boundary copies | Changed final pixels vs P0 |
| --- | --- | ---: |
| P0 | none | 0 |
| P1 | S1 | 1: (502, 513) |
| P2 | S1, S2 | 5: all historical pixels |
| P3 | S1, S2, S3 | 5 |
| P4 | S1, S2, S3, S4 | 5 |
| I1 | S1 only | 1: (502, 513) |
| I2 | S2 only | 4: (569, 330), (570, 330), (571, 331), (639, 343) |
| I3 | S3 only | the same 4 as I2 |
| I4 | S4 only | 0 |

The S1 result is reproducible and isolated to its single coordinate. The full five-pixel difference is not unique to one boundary: I1 produces one pixel, I2 and I3 each produce the other four. P2 is the first cumulative mode containing all five, and P3/P4 add no further final-frame changes.

## Boundaries and modes

The selection is based on the actual selected Anatomy renderable and the observed order of its two native backend invocations. Three.js r186 runs this transparent DoubleSide material in back-side then front-side order.

- **S1:** immediately before the first selected draw.
- **S2:** immediately after the first selected draw.
- **S3:** immediately before the second selected draw. It is kept as a separate copy even when adjacent to S2.
- **S4:** immediately after the second selected draw.

The progressive modes enable S1; then S1+S2; then S1+S2+S3; then all four boundaries. P0 enables no selected-draw copies. The optional isolated series enables exactly one boundary per mode. Every mode uses the same final-frame copy. A disabled boundary performs no `copyFramebufferToTexture()` call.

## Measurement evidence

The native browser run used Chrome 155.0.8059.84 on Darwin arm64, Three.js r186, material-aware B0 output, and the native `webgpu-renderer/webgpu` backend. The raw target was 1028 × 820 `bgra8unorm`, 4× MSAA with resolve, and `depth24plus`. Hardware acceleration is unconfirmed because the mounted renderer does not expose adapter diagnostics.

P0 matched A1 byte-for-byte in both paired comparisons. P4 matched A2 byte-for-byte in both paired comparisons. All same-mode raw repeats for A1, A2, P0–P4 and I1–I4 were exact. Each progressive capture recorded two indexed native draws, 240 indices each, one instance each, with the expected source material identity. The nine existing M-INV5 sample positions remained exact across the progressive final frames.

The P0/P4 comparison changed 5 of 842,960 pixels, with RGB MAE 0.0000019771598494, alpha MAE 0, and maximum channel difference 1. All differences were red-channel changes of one 8-bit level:

| Pixel | P0/A1 RGBA | P2–P4/A2 RGBA | Signed RGBA delta |
| --- | --- | --- | --- |
| (569, 330) | [195, 198, 202, 255] | [194, 198, 202, 255] | [-1, 0, 0, 0] |
| (570, 330) | [195, 198, 202, 255] | [194, 198, 202, 255] | [-1, 0, 0, 0] |
| (571, 331) | [194, 198, 202, 255] | [195, 198, 202, 255] | [+1, 0, 0, 0] |
| (639, 343) | [193, 196, 200, 255] | [192, 196, 200, 255] | [-1, 0, 0, 0] |
| (502, 513) | [211, 212, 215, 255] | [210, 212, 215, 255] | [-1, 0, 0, 0] |

P1/I1 changed only (502, 513). I2 and I3 each changed the first four coordinates in the table, and I4 changed none. The same signatures repeated exactly in both ordinal captures. The unaffected background control region remained unchanged in the progressive comparisons. Browser screenshots remained byte-exact against A0 in this run. Ground Glass stayed contentful; its restoration MAE was 0 against measured repeat noise of 0.0011112790.

Machine-readable evidence, including all mode captures, complete changed-coordinate lists, signed differences, nine fixed samples, pass metadata, and resource cleanup results, is recorded in [the M-INV7 report](anatomy-progressive-pass-boundary/report.json). Full RGBA capture files remain under ignored Playwright test-results output and are not committed.

## Capture lifecycle and ownership

The implementation extends the development-only M-INV5/M-INV6 capture path with an optional boundary selection. Omitting the selection preserves existing full A2 behavior. P0–P4 and I1–I4 are represented by selection booleans; the capture records actual native draw metadata independently from any captured boundary snapshots, so a partial mode does not fabricate a before/after pair.

Each enabled boundary uses the pinned r186 framebuffer copy, same command encoder, and existing color/depth load-preserving pass resume. Final-frame capture and readback are unchanged. Partial modes allocate and map only their selected boundary textures plus the final texture. Capture-owned textures and readback buffers are released once after readback settles. Existing PR #266 handling remains in effect for cancellation, device loss, and unknown submission: normal return from `finishRender()` confirms submission; an exception leaves submission unknown, prevents readback, and fences owned texture cleanup without treating the queue fence as proof that submission occurred. Borrowed renderer, device, surface texture, scene material, geometry, and Ground Glass resources remain undisposed.

Focused tests cover malformed selection rejection, P0–P4 and I1–I4 copy counts, two-draw identity/order, exact resource disposal for zero/one/multiple selected boundaries, pending partial-readback cancellation, and a `finishRender()` exception after a partial snapshot is encoded. The native M-INV7 browser test also checks copy counts, pass-load metadata, captured final frames, Ground Glass, and page errors.

## Interpretation and retained decisions

This experiment measures a small final-frame perturbation caused by the added instrumentation sequence. It does not identify whether the underlying mechanism is color/depth store-load behavior, MSAA resolve behavior, or their interaction. The overlapping I2/I3 pixel signatures are evidence of non-unique boundary attribution under the tested state, not evidence that S2 and S3 are physically interchangeable.

Preserve:

- **Q2 — MEASURABLE INSTRUMENTATION PERTURBATION**
- **N2 — CONTROLLED PROXY IMPROVEMENT**
- **G2 — PARTIAL STAGE ATTRIBUTION**
- **M2 — OPT-IN IMPLEMENTATION INCOMPLETE**
- Native M-INV5 destination/post-draw pixel observations remain **F2**.

Do not promote intermediate observations to F1 based on the final-frame experiment. Given the five one-LSB changes, stable controls, and unresolved distinction between S2 and S3 for four pixels, further optimization of these diagnostic copies is not justified unless a later measurement requires it. Return research effort to the original semi-transparent Anatomy rendering discrepancy using independently qualified evidence.
