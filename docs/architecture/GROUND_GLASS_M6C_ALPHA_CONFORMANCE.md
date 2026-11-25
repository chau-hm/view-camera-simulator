# M6C — Native Alpha Readback and Presentation Contract

## Decision

M6C measured the actual M6 presentation material on native WebGPU. The TSL expression supplies `source.a`, but the opaque Three.js r186 node-material path stores alpha as one. The output is therefore `alpha-observable-contract-different`, not source-alpha-preserving. RGB conformance passes, while M6 final-output conformance remains partial and M6 architecture remains `architecture-partially-implemented`.

M6B's fixture-scoped physical overlay and RGB results remain valid. M6C does not modify the visible canvas, normal material state, M5/B1 behavior, M5Q qualification, or public WebGL. M7 should wait for a separately reviewed M6 material/output contract decision. Production WebGPU remains disabled.

## Review-Fix Round 1 — Evidence-gated RGB qualification

The original `m6c-alpha-rgba8-r1` evaluator could report `rgb-regression-passed` from the measured subset even when the declared capture inventory was incomplete. The corrected `m6c-alpha-rgba8-r2` decision requires a non-empty, unique expected inventory and exactly one valid observation for every expected ID. Duplicate, missing, unexpected, malformed or nonfinite evidence; invalid expected stored alpha; wrong source-sample identity; substituted material evidence; stale/unsupported capture state; or target-storage alpha outside its declared tolerance prevents RGB qualification. Valid partial RGB measurements remain available as diagnostics and do not qualify the capture.

RGB numerical conformance remains independent of source-alpha preservation. The complete native matrix can therefore report `alpha-observable-contract-different` and `rgb-regression-passed` together: the opaque material still stores alpha one while all measured RGB values match. This does not make alpha conformant or complete M6 final-output/architecture work. The material and shader were not changed. The original 195-sample run remains historical evidence; a new corrected-evaluator native run is recorded in [GROUND_GLASS_M6C_REVIEW_FIX_1_REPORT.json](GROUND_GLASS_M6C_REVIEW_FIX_1_REPORT.json).

## Alpha pipeline audit

| Stage | Measured or declared contract |
| --- | --- |
| Controlled source | 512×512 `RGBA32Float`, `NoColorSpace`, nearest sampling, explicit linear RGBA samples; source fingerprint recorded per request. |
| TSL expression | `vec4(source.rgb * throughput * naturalIllumination * coverage, source.a)`. RGB gains do not intentionally multiply alpha. |
| Actual material | The same `MeshBasicNodeMaterial` instance as M6: `transparent=false`, `opacity=1`, `NormalBlending`, `alphaTest=0`, `premultipliedAlpha=false`, `colorWrite=true`. |
| Three.js r186 output | The material is classified opaque. The opaque node-material setup writes alpha one despite the `source.a` expression. The capture's native target readback confirms this. |
| Test target | Temporary `RGBA8Unorm` (`RGBAFormat` + `UnsignedByteType`), `NoColorSpace`, nearest filtering, no depth/stencil, zero samples. Clear RGBA is `[0,0,0,0]`. |
| Readback | `WebGPURenderer.readRenderTargetPixelsAsync()` into `Uint8Array`, one sampled row at a time, after `device.queue.onSubmittedWorkDone()`. Channel order is RGBA; byte values are normalized by 255 for comparison. |
| Renderer output | `outputColorSpace=srgb`; `toneMapping=0`. The offscreen target is `NoColorSpace`; the normal browser canvas reports `alphaMode=opaque`. |

Because the material is opaque and the fullscreen display draw covers the swatches, the zero clear alpha does not supply the measured alpha. `NormalBlending` is retained as the actual material setting; no alpha-only replacement material, `NoBlending` substitution, or change to the normal M6 path is used as evidence.

## Capture isolation and lifecycle

The test-only source/capture path requires all of the following: `import.meta.env.DEV`, `VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true`, `VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION=true`, `VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true`, explicit fixture control, and the exact registered Architecture Rise scene. There is no runtime user setting.

The capture runs on the adapter's serialized operation queue after the presentation work has completed. It binds the readback to request, channel, scene, renderer generation, source and presentation fingerprints, target dimensions, preview mode, and inspection window. A changed identity produces `stale` with no samples. Renderer target, viewport, scissor, clear color/alpha, output color space, and tone mapping are restored; the capture-owned target is disposed in `finally`. The 13 measured captures allocated/disposed 13/13 targets, and the normal frame had zero M6C target allocations before explicit capture.

The native tests held a readback while the accepted preview request changed and while SPA navigation retired the adapter generation. Both old results were rejected as stale, produced no samples, restored the previous target, and disposed their one temporary target.

## Native measurements

The confirmatory browser is Chrome 156 on macOS with Three.js revision 186. Runtime evidence is `rendererFamily=webgpu-renderer`, `actualExecutionApi=webgpu`, `internalFallback=none`, and `applicationFallback=false`. The source/material/request evidence is captured from the actual M6 adapter; it is not inferred from `navigator.gpu` or a test shader.

The 15-sample neutral matrix includes alpha `0`, `0.01`, `0.25`, `0.35`, `0.5`, `0.75`, `0.99`, and `1`, fixed RGB with changing alpha, changing RGB with fixed alpha, nonzero RGB with alpha zero, and dark/bright partial-alpha RGB. The expected fragment alpha comes from the controlled source and independent CPU presentation reference. Under the verified opaque material contract, expected stored target alpha is one.

| Metric | Result |
| --- | ---: |
| Samples measured | 15 / 15 per capture |
| Expected stored target alpha | 1 for each sample under the actual opaque material contract |
| Measured target alpha | 1 for each sample |
| Target-storage maximum error / RMSE | 0 / 0 |
| Source-alpha preservation maximum error | 1 |
| Source-alpha preservation RMSE | 0.6453784431632674 |
| Source-alpha preservation mean absolute error | 0.5633333339045445 |
| RGB maximum error / RMSE at the alpha target | 0 / 0 |
| Alpha target tolerance | maximum absolute alpha error ≤ 2/255; unchanged under evidence gate `m6c-alpha-rgba8-r2` |

The native matrix includes neutral, throughput 0.5, throughput 1.25, natural `parallel-cos4`, centered and shifted circular coverage, conic coverage, combined effects, Upright, Raw return, centered and panned Focus Loupe, and an actual resize from 334×267 to 437×349. Every case retained the same source-alpha result (stored alpha one); each RGB-effect case changed measured GPU RGB and passed its independent CPU comparison. Raw/Upright, loupe crop/pan, and resize retained matching request/source/presentation identities for each capture.

The normal canvas remains opaque. M6B's separate final-canvas RGB oracle remains nine cases / 206 RGB samples, maximum channel error 1 eight-bit code and worst RGB RMSE 0.204125. M6C does not reinterpret that canvas result as alpha evidence.

## Negative controls

The original r1 report recorded 18 M6C unit tests. The corrected suite now has 50 tests and exercises the actual pure evaluator, identity predicate, material gate, build gate, and lifecycle gate. It includes empty/duplicate expected inventories; duplicate, missing and unexpected actual IDs; NaN and infinities in source/reference values; invalid target bytes and expected stored alpha; invalid source identity and absent/false material equivalence; threshold boundary and over-limit RGB; incomplete zero-error evidence; stale/unsupported evidence; and opaque stored alpha with independently passing RGB. The original controls for forced alpha, throughput/illumination/coverage, premultiplication, channel order, ignored source alpha, and material/build/lifecycle gates remain.

The native E2E tests additionally cover the 15-value source matrix, Raw/Upright/crop/resize, effects, held stale readback after request change, adapter retirement during readback, allocation/disposal counts, renderer-state restoration, and production-preview absence of the M6C test seam. The implementation uses RGBA8 only; an RGBA16F decoding control is not applicable to this chosen format. No browser E2E mutates live GPU readbacks to manufacture a result.

## Separate diagnostic experiment

A temporary `NoBlending` variant was investigated and reverted. It changed the existing partial-alpha RGB patch in the M6B independent oracle: maximum channel error 87 codes and RGB RMSE 12.9577. This variant is excluded from M6C code and cannot be used to claim that the normal M6 material preserves alpha. The current normal material, presentation RGB, and opaque canvas remain unchanged.

## Decisions and limits

| Decision | Result |
| --- | --- |
| Alpha observation | `alpha-observable-contract-different` |
| RGB preservation | `rgb-regression-passed` |
| M6 final output | `final-output-partial` |
| M6 architecture | `architecture-partially-implemented` |
| Photographic quality | `quality-unqualified` |
| Production WebGPU | `production-webgpu-disabled` |
| M7 readiness | Blocked on a separately reviewed material/output contract decision; M7 has not started. |

The evidence qualifies only the controlled Architecture Rise fixture on this Chrome/macOS/Three.js r186 runtime. It does not establish broad device or scene compatibility, photographic quality, alpha behavior for other renderers, or production authorization. The temporary readback does not prove that the M6 visible canvas should be transparent. M5Q revision `m5q-architecture-rise-r186-v3` and Q1–Q7 remain unchanged.

The compact measurement, per-capture identities, input fingerprints, and stale controls are in [GROUND_GLASS_M6C_ALPHA_CONFORMANCE_REPORT.json](GROUND_GLASS_M6C_ALPHA_CONFORMANCE_REPORT.json). Original M6B reports remain historical and unmodified.
