# M6 — Development-Only Ground Glass Presentation

## Decision

M6 provides a native WebGPU Architecture Rise presentation path that displays the completed M5 B1 Far/Near research composite through the existing shared Ground Glass Stage. The implementation is **architecture-partially-implemented**: the physical grid and physical target alignment are not supported by the only M6-eligible scene, so that part of the presentation contract still needs a bounded M6 follow-up. Photographic quality is **quality-unqualified**. No M5Q threshold or Q1–Q7 result changes, and production WebGPU remains disabled.

The native run and compact measurements are in [GROUND_GLASS_M6_PRESENTATION_REPORT.json](GROUND_GLASS_M6_PRESENTATION_REPORT.json). Full screenshots and the compressed GPU readback remain in ignored Playwright output.

## Development activation

Use the development server with both pilot gates enabled:

```bash
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true \
VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION=true \
npm run dev
```

Open `/simulator/free/architecture-rise?rttDiagnostics=1` in a browser with native WebGPU enabled. M6 activates automatically for this exact scene when the development build has both documented pilot flags enabled; there is no public renderer selector. Confirm the pilot reports `data-mounted-renderer-family="webgpu-renderer"`, `data-actual-execution-api="webgpu"`, `data-presentation-mode="m6-experimental-dof"`, `data-presentation-source="m5-research-composite"`, and `data-presentation-status="completed"`. To return to the existing WebGL path, stop the server and restart without the M6 and Raw pilot flags.

The build-time gate requires all three conditions: `import.meta.env.DEV`, `VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true"`, and `VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION === "true"`. M6 presentation requests are limited to the exact Architecture Rise scene identity and bounds and exclude Raw Debug. A verified M6-capable pilot session may start on Raw Debug, but other scenes stay on the existing WebGL host. The compatibility records attest implementation only; `qualityQualification` remains `unqualified`.

## Render path and ownership

The adapter keeps the existing M3 scene target, M4 physical CoC and validity targets, and M5 gather/B1/research-composite targets. M6 uses one fullscreen presentation node that samples the already-composited M5 target and applies display orientation, global throughput, natural illumination, and physical coverage before rendering to the canvas. It does not re-blend Near, re-run B1, add a render target, or add a second fullscreen pass. M5 remains the owner of its optical targets; the WebGPU adapter owns and disposes the M6 presentation material and geometry.

The final display only publishes a completed M6 frame after the matching M4 and M5 requests have completed for the same request, channel, scene, and renderer generation and the M6 render plus queue completion succeed. Initialization failure selects the existing host fallback. Presentation or final-display failure cannot be reported as completed M6 output. A held presentation that becomes stale after resize is discarded. These are bounded M6 controls, not the broader M7 device-loss and retry matrix.

## Coordinates and optical effects

- Raw and Upright use the established WebGPU render-target orientation transform. The asymmetric native sample gave mean RGB error 3.59 for the expected 180-degree correspondence, versus 44.06 for a horizontal-only flip and 52.39 for a vertical-only flip.
- Focus Loupe reuses the shared Stage inspection window and the existing camera source crop. Native center and panned captures changed the source crop while retaining the canonical physical window contract; resize regenerated the output at 394×315 with a 256×205 internal target in the final low-quality state.
- The presentation node maps each sampled source coordinate through the cropped physical film window before evaluating coverage and illumination. It reuses canonical coverage and natural-illumination state, including shifted circles and conics. Pure reference tests cover offset signs in both axes, combined offsets, feathering, conic coverage, crop, orientation, disabled coverage, and Raw Debug bypass.
- Global throughput uses `resolveGroundGlassRelativeIlluminance()`. In the native run the reported gain increased from 0.2416 at f/22 to 3.7293 at f/5.6. Natural illumination and coverage were both reported applied for the captured optical state.
- Raw Debug remains the M3 Raw target diagnostic path and does not receive M6 DOF, coverage, or natural illumination.

The M6-eligible Architecture Rise scene does not provide the shared physical film grid; that grid is currently Macro-only. Its visible grid is decorative CSS and has no physical spacing. The native overlay-only transform negative control changed 50,196 screenshot pixels while request identity, completed frame, and canvas geometry stayed unchanged, proving that an overlay transform error is observable. This does not prove physical grid/target alignment. No screenshot is presented as physical-overlay qualification.

## Color and comparison boundary

The M3 scene and M5 optical targets are sampled as unencoded linear values (`NoColorSpace`). M6 multiplies linear RGB and preserves source alpha. The WebGPU renderer writes to its sRGB canvas output; tone mapping is disabled. M6 does not encode sRGB in the presentation node. Unit controls cover black, white, middle gray, saturated and low-intensity patches and the linear-to-sRGB transfer function.

The WebGL and M6 screenshots are both 514×412, but they are not a parity result: mean sRGB luminance was 108.27 for WebGL and 158.86 for M6; 207,557 pixels changed and mean absolute channel error was 55.04. M6 also differed from M3 Raw (207,390 changed pixels; mean absolute channel error 24.47). These comparisons show the candidate output is visible and distinct. They do not establish which result is optically correct. No final M6 GPU readback pixel oracle or physical grid alignment result is claimed.

## Native evidence and remaining work

The committed native run used Playwright `chrome-native-webgpu`, Three.js r186, `rendererFamily=webgpu-renderer`, `actualExecutionApi=webgpu`, `internalFallback=none`, and the Architecture Rise scene. The M5 readback capture `m6-composite-1793201452868` was from request 3 and matched the completed M6 display identity at capture. The tracked JSON records the source, depth, physical, and validity fingerprints, target formats, crop, throughput, timings, screenshot metrics, and negative control.

M6 remains partial until a supported presentation fixture can verify physical grid and target alignment against the displayed image, with actual native raster evidence. This is a bounded **M6 presentation follow-up**, not M7 lifecycle work. A direct M6 output pixel oracle would also strengthen transfer and mapping validation; current controls combine the independent CPU reference, native screenshot landmarks, input target readback, and explicit runtime presentation state.

M7 still owns full development-pilot recovery, device loss, session retry, scene switching, and broader retirement/fallback evidence. M8 still owns broad scene/material support, hardware/browser coverage, and repeatable performance/memory qualification. The M5Q frozen revision `m5q-architecture-rise-r186-v3` remains unchanged: Q1/Q5/Q6/Q7 `reference-not-converged`, Q2/Q4 `insufficient-support`, and Q3 `bounded-qualified` for its exact signed-boundary ROI. No production WebGPU authorization follows from M6.

## Raw-first M6 session provisioning — Review-Fix Round 1

M6 capability is authorized only in a development build with both the Raw pilot and M6 presentation flags set to the exact string `"true"`. The session-level provisioning decision additionally requires the exact Architecture Rise identity and bounds, selected WebGPU, and an observed `WebGPURenderer` using native WebGPU. This decision is independent of the first frame's Raw Debug value. It allocates the M4 physical CoC/validity resources and the M5 gather/B1/composite resources so a later M6 request in the same renderer generation has its inputs.

Provisioning does not enable pass execution. Raw Debug keeps the M3 scene-target display path: its accepted frame has no M4 or M5 optical passes and no completed M6 presentation. When a non-Raw M6 request arrives, M4, M5, and M6 execute for that request and their completed diagnostics must match its request, channel, scene, and renderer generation. Raw/M6 mode changes preserve the pilot session and renderer generation; the existing adapter cleanup owns and disposes the M3, M4, M5, and M6 resources when that generation retires. If M6-session resource initialization or target-format preflight fails, initialization fails through the existing cleanup and application fallback path.

The Raw-first Native regression on `chrome-native-webgpu` / Three.js r186 started with both required flags enabled and the independent M4/M5 research flags disabled. It mounted one native WebGPU adapter generation, published a contentful Raw frame with M4/M5 resources ready but no optical passes, exercised Focus Loupe and viewport-change requests, then completed Raw→M6 and M6→Raw→resize→M6 without fallback or retry consumption. A deliberately held M6 queue discarded an older request and completed only the latest accepted request. At the low-quality test layout, the source target remained 204×163 and the half-scale gather targets were 102×82; the viewport changes produced new request identities even though those nominal target dimensions did not change in that run. The separate M6 resize regression continues to cover a 394×315 displayed output with a 256×205 internal target.

The adapter provisions nine M5 color targets plus two M4 color targets for an M6-capable Raw-first session. At the measured 204×163 source and 102×82 gather sizes, those RGBA attachments have a nominal uncompressed color-storage estimate of 2,529,600 bytes (about 2.412 MiB): M4 uses 12 bytes per source pixel; five full-resolution M5 targets use 52 bytes per source pixel; four half-resolution M5 targets use 48 bytes per gather pixel. This estimate excludes the existing M3 scene color and depth attachments, backend padding, and driver allocation overhead. It describes M4/M5 resources provisioned for the session, not an M6 presentation target: M6 itself still adds zero render targets or color-attachment bytes and retains its existing single fused fullscreen presentation draw.

The Native failure control injects an initialization error after a real M5 Far target allocation, then verifies confirmed adapter cleanup, no completed WebGPU frame, and fallback to the existing WebGL host. The handoff and measured IDs are in [GROUND_GLASS_M6_REVIEW_FIX_1_REPORT.json](GROUND_GLASS_M6_REVIEW_FIX_1_REPORT.json). M6 remains `architecture-partially-implemented` and `quality-unqualified`; this review fix does not establish physical grid alignment, an M6 output pixel oracle, photographic quality, or production readiness.
