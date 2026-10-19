# Ground Glass WebGPU Raw RTT Feasibility

## A. Executive conclusion

**FEASIBLE** — The bounded native WebGPU Raw RTT path is demonstrated: the existing Architecture Rise registered subject was rendered through the canonical off-axis Ground Glass camera into a native WebGPU render target, then sampled by a separate TSL display operation. Raw/Upright orientation, an off-center 4× film crop, target resize, unmount/remount, a native display-pass failure, and a pending asynchronous readback during teardown were exercised on actual WebGPU execution.

This conclusion applies only to the Raw RTT render-and-display path. It does not establish a production Ground Glass backend or full DOF, image-circle, or final-composite parity. Partial-initialization failure cleanup was exercised in Chromium's WebGL2 fallback environment; native WebGPU display-pass failure and remount are separately covered. CoC/footprint classification, far/near gathering, final DOF composition, and Image Circle/vignetting rendering remain unimplemented and untested here.

No production source file was modified. The fixture and spec live under `src/tests/e2e/fixtures/` and `src/tests/e2e/`; the public Ground Glass route and production renderer remain WebGL-only.

## B. Tested renderer architecture

```text
DEFAULT_CAMERA_STATE + Architecture Rise preset
        |
        v
deriveOpticsState()                         canonical optical authority
        |
        v
configureGroundGlassCamera()                existing reflected off-axis film camera
        |
        +------------------------------+
        |                              |
        v                              v
registered Architecture Rise       Native Three r186 WebGPURenderer
RTT subject + local lighting               |
        |                                   v
        +--------------------------> THREE.RenderTarget
                                            |
                                  async target readback completes
                                            |
                                            v
                               MeshBasicNodeMaterial + TSL texture()
                                            |
                                            v
                                    visible browser canvas
```

The comparison control uses the same camera input and registered subject with `WebGLRenderer`, `WebGLRenderTarget`, and `MeshBasicMaterial`. Both paths use a 320×256 target at pixel ratio 1, sRGB output, and `NoToneMapping`. The candidate target is `THREE.RenderTarget` with RGBA unsigned-byte color and a depth buffer. The display is a separate full-screen mesh whose `MeshBasicNodeMaterial.colorNode` samples the target texture through TSL; the scene is not rendered directly to the visible canvas.

The tested state uses Architecture Rise, 150 mm focal length, 8,890 mm focus distance, f/11, 20 mm front rise, and a 127×101.6 mm film reference. `deriveOpticsState()`, `getGroundGlassClipRangeWorld()`, `configureGroundGlassCamera()`, and the existing inspection-window/source-crop helpers supply the optical camera and framing. The fixture reapplies the returned physical frustum extents with the renderer's r186 coordinate-system convention; this test-only step preserves the physical extents and adapts clip-space depth for WebGPU.

## C. Native execution evidence

| Evidence | Result |
|---|---|
| Host / browser | macOS host (`darwin`), headed Chrome 155; browser UA reports macOS 10.15.7 and `MacIntel` |
| Three.js | r186 |
| WebGPU API / adapter probe | API available; `requestAdapter()` returned an adapter |
| Mounted renderer family | `webgpu-renderer` |
| Actual execution backend | `webgpu` |
| Application fallback | `false` |
| Render target | `THREE.RenderTarget` |
| Target readback | 2,048 samples; luminance range 234.22; 1,073 contentful samples |
| Scene / display operations | Both completed; separate scene and display render counts were recorded |
| Hardware acceleration | Not independently established |

The native-required test checks the mounted runtime using the project's `resolveObserverRendererRuntime()` classifier. A browser API/adapter probe alone is not accepted as native evidence. The regular Chromium project emits Three.js's WebGL2-fallback warning and is reported separately; it is not counted as a native pass.

## D. Coordinate results

The physical film and display contracts in [GROUND_GLASS_COORDINATE_CONTRACT.md](GROUND_GLASS_COORDINATE_CONTRACT.md) remain authoritative. Fixed independent examples include physical film UV `(0.17, 0.28)` mapping to Raw display UV `(0.83, 0.28)` and Upright display UV `(0.17, 0.72)`. Actual raster samples use nine fixed asymmetric Architecture Rise screen positions selected from the rendered scene. The one-sided side return and open opposite context anchor absolute placement; the facade, focus chart, windows, and lower facade provide additional distinguishable regions.

The native Raw/Upright test samples actual canvas pixels. The correct two-axis correspondence had mean RGB patch difference **0.62**. Omitting the horizontal reflection increased it to **55.07**; omitting the vertical reflection increased it to **27.18**. The fixed Raw side-return patch also has the independently expected darker value than the opposite open context. Paired WebGL/native Raw samples from identical camera and scene input had mean difference **0.0009**; deliberately wrong vertical and horizontal mappings differed by **28.32** and **53.75**, respectively.

The first native display sampling attempt exposed a WebGPU render-target Y-origin difference from the WebGL reference. A small Y-origin compensation in the fixture's TSL sampling expression restored the existing project Raw/Upright mapping. No canonical optics or production coordinate helper changed.

For the deterministic off-center Loupe window, the displayed center is `(0.70625, 0.36875)` with width and height fractions `0.25`. The corresponding source crop is `(0.70625, 0.36875)` for Upright and `(0.29375, 0.63125)` for Raw, following the existing display-to-source transform. The camera's off-axis frustum changes with the crop, and the 4× sample area is 31.75×25.4 mm from the 127×101.6 mm physical film.

Full-film-to-crop pixel patches were compared at independently mapped asymmetric points in both modes and both renderer paths. Mean patch differences were **7.57** for Upright and **12.85** for Raw; intentionally interpreting the same window as centered increased the differences to **46.41** and **52.14**. These are bounded patch comparisons, not full-frame RGB equality claims. Same-mode WebGL/native cropped patch differences were below **0.01** in the captured run; wrong-axis sampling was materially worse.

## E. Resource results

- The fixture owns each renderer, render target, display geometry/material/scene, camera, and local lighting/environment rig it creates.
- The Architecture Rise subject is created and disposed through `createRegisteredRttSubject()` / `disposeRegisteredRttSubject()`. Shared asset resources retain their registry ownership and are not disposed by the fixture as borrowed module resources.
- Cleanup waits for pending render/readback work, disposes display resources and the target, releases the registered subject and local rigs, and then disposes the renderer. The cleanup path is idempotent.
- On native WebGPU, `RenderTarget.setSize()` kept the same texture UUID and recorded one target-storage dispose event before rendering at 400×320.
- Native remount evidence recorded renderer, target, subject, presentation, and environment disposal. Remount during an asynchronous target readback recorded one stale readback discarded, then reached ready state on a new native renderer.
- A native WebGPU display-pass failure remained visible as `failedPass: "textureDisplay"`; the error was reported and a subsequent remount returned to native WebGPU. Partial initialization failure after target allocation and disposal was tested in the ordinary Chromium run, where Three r186 used its WebGL2 fallback.

## F. Compatibility blockers and limits

No incompatibility was observed in the tested Architecture Rise subject: its RTT factory uses built-in `MeshStandardMaterial` / `MeshBasicMaterial` and subject-owned procedural `DataTexture` maps; it does not require `ShaderMaterial` or `onBeforeCompile` conversion. The native scene render, target readback, texture sampling, and display completed without a reported render failure.

This pilot intentionally does not implement or measure physical CoC/footprint classification, half-float or encoded-byte DOF storage, far/near gather, the production final composite, Image Circle/vignetting masks, or diagnostic parity. It therefore establishes no WebGPU DOF, image-circle, or complete Ground Glass visual parity. Pixel evidence covers selected stable patches and coordinate landmarks, not full-frame material/color equality. Hardware acceleration was not separately established, and only the recorded Chrome/macOS environment was qualified.

## G. Migration implications

The experiment supports continuing to a bounded physical-data/CoC representation study: determine how existing canonical physical CoC and footprint values can be stored and sampled in a WebGPU pass while preserving their current meaning and precision. That study should leave the production WebGL Ground Glass renderer untouched and should not assume the current GLSL DOF passes can be mechanically ported. Full DOF or Image Circle migration should wait for that evidence and its own native lifecycle and visual conformance checks.

## Reproducible evidence

```bash
npx playwright test src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts --project=chromium
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npx playwright test src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts --project=chrome-native-webgpu -g 'native-required WebGPU'
```

Playwright screenshots and JSON measurements are attached to the test run and remain under the ignored `test-results/` directory; bulky captures are not committed.

## Validation

- `npm test`: passed, 268 files / 2,488 tests.
- `npm run typecheck`, `npm run lint`, `npm run check:css`, and `npm run build`: passed.
- Fixture E2E in default Chromium: 3 passed, 2 native-only tests skipped. Three r186 reported WebGL2 fallback; this is not counted as native evidence.
- Native-required Chrome E2E: 2 passed, including Raw/Upright and crop comparisons, native target resize, async readback remount, and injected display-pass failure/remount.
- Production-preview E2E: the Anatomy material-aware denial test passed. The Architecture Rise isolation test passed its default and explicit WebGPU-request assertions, then timed out when its observer canvas detached during the final standard-output SPA screenshot at `architecture-rise-webgpu-production.spec.ts:131`. This test was not rerun on a separate clean base. No production source changed in this PR. The production build contained no fixture-specific heading or remount-control strings; the existing application may still contain its separately gated Observer WebGPU chunk.
- `git diff --check`: passed. The full `ci:local:e2e` command was not run; the dedicated native/fallback fixture suites and production-preview regression were run directly.

See also [RENDERER_STABILIZATION_CONTRACT.md](RENDERER_STABILIZATION_CONTRACT.md), [ARCHITECTURE_DIAGNOSIS.md](../ARCHITECTURE_DIAGNOSIS.md), and [DOF_FOCUS_PHYSICS_CONVERGENCE.md](../DOF_FOCUS_PHYSICS_CONVERGENCE.md).
