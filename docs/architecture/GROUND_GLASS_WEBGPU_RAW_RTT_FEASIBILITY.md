# Ground Glass WebGPU Raw RTT Feasibility

## A. Executive conclusion

**FEASIBLE** — The bounded native WebGPU Raw RTT path is demonstrated: the existing Architecture Rise registered subject was rendered through the canonical off-axis Ground Glass camera into a native WebGPU render target, then sampled by a separate TSL display operation. Raw/Upright orientation, an off-center 4× film crop, target resize, native display-pass failure, and renderer cleanup across a real client-side route transition have native-required browser evidence. A successful held readback was retired as stale; a separate deterministic readback rejection remained an explicit operation failure while the same native handle's cleanup completed successfully.

This conclusion applies only to the Raw RTT render-and-display path. It does not establish a production Ground Glass backend or full DOF, image-circle, or final-composite parity. Native-specific SPA cleanup is proven only for this isolated test fixture; public simulator route integration remains unimplemented and untested. Partial-initialization failure cleanup was exercised in Chromium's WebGL2 fallback environment. CoC/footprint classification, far/near gathering, final DOF composition, and Image Circle/vignetting rendering remain unimplemented and untested here.

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

The native Raw/Upright test samples actual canvas pixels only after a new matching operation for the exact handle, mode, and crop completed its readback and texture-display pass and published diagnostics. The correct two-axis correspondence in this round had mean RGB patch difference **0.62**. Omitting the horizontal reflection increased it to **54.34**; omitting the vertical reflection increased it to **28.27**. The fixed Raw side-return patch also has the independently expected darker value than the opposite open context. Paired WebGL/native Raw samples from identical camera and scene input had mean difference **0.0009**; deliberately wrong vertical and horizontal mappings differed by **27.12** and **55.03**, respectively. The paired test now requires correctDifference + 8 < wrongDifference independently for both axes, while retaining the absolute < 8 WebGL/native agreement limit and the asymmetric side-return landmark.

The first native display sampling attempt exposed a WebGPU render-target Y-origin difference from the WebGL reference. A small Y-origin compensation in the fixture's TSL sampling expression restored the existing project Raw/Upright mapping. No canonical optics or production coordinate helper changed.

For the deterministic off-center Loupe window, the displayed center is `(0.70625, 0.36875)` with width and height fractions `0.25`. The corresponding source crop is `(0.70625, 0.36875)` for Upright and `(0.29375, 0.63125)` for Raw, following the existing display-to-source transform. The camera's off-axis frustum changes with the crop, and the 4× sample area is 31.75×25.4 mm from the 127×101.6 mm physical film.

Full-film-to-crop pixel patches were compared at independently mapped asymmetric points in both modes and both renderer paths. Mean patch differences were **7.57** for Upright and **12.85** for Raw; intentionally interpreting the same window as centered increased the differences to **46.41** and **52.14**. These are bounded patch comparisons, not full-frame RGB equality claims. Same-mode WebGL/native cropped patch differences were below **0.01** in the captured run; wrong-axis sampling was materially worse.

## E. Resource results

- Lifecycle records identify backend, mount generation, unique handle, renderer execution backend, and each owned resource identity. Allocation, disposal request, successful disposal completion, and disposal failure are recorded separately. Repeated disposal reuses the same completion and does not emit a second successful disposal for an owned resource.
- The following identities were captured across passing headed Chrome/WebGPU runs on 2026-10-20. Each row names its own fixture instance; UUIDs identify that run, and later runs allocate new target and subject UUIDs.

| Backend | Handle / generation | Transition | Renderer | Target | Registered subject | Local rigs | Outcome |
|---|---|---|---|---|---|---|---|
| WebGPU candidate | `webgpu-candidate-g1-i2`, generation 1 | `/experiment` → `/away` with queued work | `webgpu-candidate-g1-i2:renderer` completed once | `adda9332-71ed-4176-925e-44fb07aa80bd` completed once; one dispose event | `8add0ea0-e935-4368-b943-ed11548cd294` completed once | presentation, world-lighting and environment-rig entries each completed once | Native cleanup completed without error; final held operation retired as stale |
| WebGL reference | `webgl-reference-g1-i1`, generation 1 | same `/experiment` → `/away` | `webgl-reference-g1-i1:renderer` completed once | `b510c54f-3552-4c10-85a0-aa23e9ed2039` completed once | `cb760f20-98c6-45a2-8af3-19e8e9644309` completed once | presentation, world-lighting and environment-rig entries each completed once | Cleanup completed; this record does not satisfy the native WebGPU predicate |
| WebGPU candidate | `webgpu-candidate-g2-i4`, generation 2 | remounted `/experiment` → `/away` | `webgpu-candidate-g2-i4:renderer` completed once | `f45760b6-3c19-4c92-801c-bbd64e65a322` completed once; one dispose event | `b933f0e3-64f0-4e30-9fa8-aad17d237052` completed once | presentation, world-lighting and environment-rig entries each completed once | New native handle rendered contentful output, then cleaned up independently |
| WebGPU candidate | `webgpu-candidate-g1-i2`, generation 1 | `/experiment` → `/away`, successful held readback | `webgpu-candidate-g1-i2:renderer` completed once | `641f1704-4b32-4c02-9d62-295002c19387` completed once; one dispose event | `bcb046f2-f175-4cf1-be67-ab9d91fb3e77` completed once | presentation, world-lighting and environment-rig entries each completed once | `op5` succeeded, then ended `retired / stale-readback-discarded`, `error: null`; cleanup disposed without error |
| WebGPU candidate | `webgpu-candidate-g1-i2`, generation 1, separate test page | `/experiment` → `/away`, injected Promise rejection after retirement | `webgpu-candidate-g1-i2:renderer` completed once | `1edf1391-0864-46d0-976b-e74e5244ea7b` completed once; one dispose event | `e71587e8-7b1f-4c04-bf29-b11f0e85b1dc` completed once | presentation, world-lighting and environment-rig entries each completed once | `op5` ended `failed / readback-failed` with the injected error; cleanup disposed without error |

- The native cleanup assertion also passed two negative controls: a fully disposed WebGL reference returned false, and a copied native record with target-disposal evidence withheld returned false.
- The fixture owns each renderer, render target, display geometry/material/scene, camera, and local lighting/environment rig it creates.
- The Architecture Rise subject is created and disposed through `createRegisteredRttSubject()` / `disposeRegisteredRttSubject()`. Shared asset resources retain their registry ownership and are not disposed by the fixture as borrowed module resources.
- All render, readback, and resize calls accepted by a handle enter one ordered queue. Retirement rejects new work, marks queued operations retired before they touch GPU state, waits for in-flight work, then disposes display resources and target, releases the subject and local rigs, and finally disposes the renderer.
- On native WebGPU, `RenderTarget.setSize()` kept the same texture UUID and recorded one target-storage dispose event before rendering at 400×320.
- The successful pending-operation test starts the real `readRenderTargetPixelsAsync()` call, holds its enclosing operation at an explicit test barrier, and navigates away while the operation remains accepted and unresolved. Cleanup stays in `retiring` with renderer and target still active until the barrier releases. The readback resolves successfully, then the retired handle discards its result as `stale-readback-discarded`; the exact operation ID remains inspectable with `readbackOutcome: "succeeded"`, `error: null`, and `resultPublished: false`.
- A separate native-required negative control waits at the same barrier, retires the exact handle, then injects a Promise-level rejection after the real readback resolves. The operation `webgpu-candidate-g1-i2-op5` remains `failed / readback-failed` with `failureKind: "readback"` and the injected error text. The same handle's renderer, target, registered subject, presentation lighting, world lighting, and environment rig all report successful disposal; handle-level `cleanupError` remains null. This injection is not a device-loss test or a hardware failure.
- A native WebGPU display-pass failure remained visible as `failedPass: "textureDisplay"`; the error was reported and a subsequent remount returned to native WebGPU. Partial initialization failure after target allocation and disposal was tested in the ordinary Chromium run, where Three r186 used its WebGL2 fallback.
- Successful `dispose()` completion and the target's disposal event demonstrate the Three.js owner-level disposal contract. They do not prove when or whether the GPU driver reclaims physical memory.

## F. Compatibility blockers and limits

No incompatibility was observed in the tested Architecture Rise subject: its RTT factory uses built-in `MeshStandardMaterial` / `MeshBasicMaterial` and subject-owned procedural `DataTexture` maps; it does not require `ShaderMaterial` or `onBeforeCompile` conversion. The native scene render, target readback, texture sampling, and display completed without a reported render failure.

This pilot intentionally does not implement or measure physical CoC/footprint classification, half-float or encoded-byte DOF storage, far/near gather, the production final composite, Image Circle/vignetting masks, or diagnostic parity. It therefore establishes no WebGPU DOF, image-circle, or complete Ground Glass visual parity. Pixel evidence covers selected stable patches and coordinate landmarks, not full-frame material/color equality. Hardware acceleration was not separately established, and only the recorded Chrome/macOS environment was qualified.

The SPA route exists only inside the isolated feasibility fixture. It proves mount/unmount behavior for the fixture's WebGPU candidate and its paired WebGL control, not integration with the public simulator router. The successful-retirement and injected-rejection barriers verify that the operation queue retains ownership after native readback has been started; they do not prove absence of every possible driver-level memory leak. Native partial-initialization cleanup is not covered; the existing injected partial-init case runs in ordinary Chromium's WebGL2 fallback mode. Browser screenshots are gated on a newly accepted operation ID for the requested handle/mode/crop, successful readback, completed display pass, and published diagnostics. For a native WebGPU candidate, the fixture also awaits `device.queue.onSubmittedWorkDone()` after submitting the display pass; the two-animation-frame wait is only a final browser paint synchronization. Paired raster capture waits for both WebGL and WebGPU proofs before either canvas is sampled.

## G. Migration implications

The experiment supports continuing to a bounded physical-data/CoC representation study: determine how existing canonical physical CoC and footprint values can be stored and sampled in a WebGPU pass while preserving their current meaning and precision. That study should leave the production WebGL Ground Glass renderer untouched and should not assume the current GLSL DOF passes can be mechanically ported. Full DOF or Image Circle migration should wait for that evidence and its own native lifecycle and visual conformance checks.

## Reproducible evidence

```bash
PATH=/Users/homan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts --workers=1
PATH=/Users/homan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH OBSERVER_NATIVE_WEBGPU_REQUIRED=1 npm run test:e2e -- src/tests/e2e/ground-glass-webgpu-raw-rtt.spec.ts --grep 'native-required' --workers=1
```

Playwright screenshots and JSON measurements are attached to the test run and remain under the ignored `test-results/` directory; bulky captures are not committed.

## Validation

- This review-fix round, ordinary Chromium fixture suite: 4 passed and 4 native-only tests were skipped. The first run exposed that the fixture overwrote the final `display-completed` stage with a generic `completed` value; the completion gate correctly rejected that capture. After preserving the final stage, the focused real-canvas control and complete suite passed. Ordinary Chromium reported `executionBackend: "webgl2-fallback"` for the candidate and is not counted as native evidence.
- This review-fix round, native-required headed Chrome: all 4 native-required fixture tests passed. This includes the tightened two-axis raster margin, exact-operation capture gates for Raw/Upright and full/centered/off-center crops, target resizing, successful stale-readback retirement (`webgpu-candidate-g1-i2-op5`), injected readback rejection (`webgpu-candidate-g1-i2-op5` in a separate test handle), per-instance SPA cleanup/remount, and display-failure recovery.
- This review-fix round, production-preview isolation suite: 2 passed. Architecture Rise remained WebGL for default and explicit WebGPU requests, with no WebGPU module requests; the Anatomy material-aware candidate remained denied. The previously reported final-screenshot timeout on this branch and clean main was not reproduced.
- The production build succeeded and the isolation test confirmed the test-only fixture did not become a public route or request its WebGPU module. The existing separately gated Observer WebGPU chunk remains part of the application build; no Ground Glass WebGPU selector or route was added.
- This review-fix round: `npm test` passed, 268 files / 2,488 tests; `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and `git diff --check` passed. Full `ci:local:e2e` was not run; the fixture suite and production-preview isolation suite were run directly.

See also [RENDERER_STABILIZATION_CONTRACT.md](RENDERER_STABILIZATION_CONTRACT.md), [ARCHITECTURE_DIAGNOSIS.md](../ARCHITECTURE_DIAGNOSIS.md), and [DOF_FOCUS_PHYSICS_CONVERGENCE.md](../DOF_FOCUS_PHYSICS_CONVERGENCE.md).
