# Depth attachment controlled comparison

Source: clean `git archive bc85950864046c70c68492aaa2f1be17f1c085e9`; local dependencies symlinked from the feature worktree. The 16-bit copy differs by exactly one line: `THREE.UnsignedIntType` changed to `THREE.UnsignedShortType` in `groundGlassRttResources.ts`. The 24-bit run restores that line. No asset, camera, material, lighting, optical or cage code was edited. Two sequential complete runs of `playwright.macro-tourbillon-hardware.config.ts` each passed 1/1 on Chrome 158, WebGL2 ANGLE Metal Apple M4 Pro, using the static cage query. Output directories were separate. The capture manifest records actual state and diagnostics. Images are actual application Ground Glass output; Standard B3 and source are 450 × 361 with CSS border, High B3 is 900 × 722 including CSS border, and High loupe is 900 × 720.

| View | 16-bit | 24-bit |
| --- | --- | --- |
| Standard B3, 300 mm f/5.6 | [16](16/standard-b3-life-size.png) | [24](24/standard-b3-life-size.png) |
| High B3, 300 mm f/5.6 | [16](16/high-b3-life-size.png) | [24](24/high-b3-life-size.png) |
| High 4× loupe | [16](16/high-b3-focus-loupe-4x.png) | [24](24/high-b3-focus-loupe-4x.png) |
| Standard scene color before DOF | [16](16/standard-b3-source-before-dof.png) | [24](24/standard-b3-source-before-dof.png) |

At 16 bits Roman numerals, minute markings and the hobnail field disappear in both pre-DOF color and final images; at 24 bits these are visible. Hand silhouette, case and tourbillon bridge remain visible in both. This controlled result establishes depth representation as a cause of lost surface detail before physical DOF, rather than merely a reconstruction/CoC difference. The captures do not independently prove which individual fragments tie or quantify depth reconstruction error, nor do they rule out other contributors. No direct CoC/depth image was captured. Active camera near/far in manifests: 0.01 m / 4 m; at 0.3 m the approximate quantization step is 0.137 mm at 16 bits and 0.000535 mm at 24 bits.

## Realized attachment probe

`framebuffer-probe.mjs` calls the real `createGroundGlassRttResources`, binds its scene target and reads `FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE`, attachment type, completeness, GL error and renderer. A local Vite server with `VITE_BASE_PATH=/` is required; change port 4188 as needed. For 16-bit the same isolated one-line substitution was made before running the probe. Results:

| Backend | Requested type | Depth bits | Framebuffer status | GL error |
| --- | --- | --- | --- | --- |
| Chrome 158 WebGL2 ANGLE Metal Apple M4 Pro | UnsignedIntType (1014) | 24 | COMPLETE (36053) | 0 |
| Chromium WebGL2 ANGLE SwiftShader Vulkan | UnsignedIntType (1014) | 24 | COMPLETE (36053) | 0 |
| Chrome 158 WebGL2 ANGLE Metal Apple M4 Pro | UnsignedShortType (1012) | 16 | COMPLETE (36053) | 0 |
| Chromium WebGL2 ANGLE SwiftShader Vulkan | UnsignedShortType (1012) | 16 | COMPLETE (36053) | 0 |

Three.js r187 `WebGLTextures.js` maps these types to `DEPTH_COMPONENT24` and `DEPTH_COMPONENT16` respectively. The probe reads actual attachment depth size and completeness; WebGL2 does not expose a texture internal-format query here, so the internal format is established from the installed Three.js mapping rather than claimed as directly queried GPU state. The experiment does not qualify all other scenes or device classes. The near/far gather and reconstruction shaders sample normalized depth and use projection/near/far parameters; no hard-coded 16-bit decoding was identified. Full shared renderer qualification requires the cross-scene evidence requested in the main report.

## Additional checks and remaining qualification

Seven focused suites passed (47 tests): `groundGlassRttResources`, `groundGlassPhysicalCocContract`, `groundGlassDofRenderState`, `groundGlassDofCoverage`, `groundGlassDofStability`, `groundGlassRttOrientation`, and `groundGlassRttDimensions`. These are resource and numerical tests, not cross-scene image comparisons.

A separate RQ3G hardware capture using the 16-bit checkout passed and produced the Macro Depth of Field, Oblique Plane, and Compound Movements controls. The corresponding 24-bit RQ3G run timed out after 120 seconds in `readAcceptedFrame` at test line 278 while capturing the Macro Bellows B5 state, before the secondary scenes. This is a single observation, and no cause or regression is established; the dedicated 24-bit B1–B5 hardware capture above did pass. A follow-up cross-scene browser attempt was intentionally interrupted to avoid concurrent browser interference with the Architecture attribution runs. Matched cross-scene comparison remains outstanding. The failed run's trace is retained locally at `/private/tmp/tourbillon-depth-ab/cross24/rq3g-macro-bellows-capture-562a4--Extension-WebGL-references/trace.zip` (239 MiB) and is not committed.

**Decision: `DEPTH24_NEEDS_REFINEMENT`** for shared renderer qualification: the direct attachment and watch A/B evidence supports 24-bit precision, but the required cross-scene visual comparison and the separate observed accepted-frame timeout have not been resolved.
