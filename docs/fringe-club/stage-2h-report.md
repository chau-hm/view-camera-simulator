# Stage 2H runtime packaging report

**READY_STAGE_2I_INTEGRATION_CANDIDATE — OPTIMIZED_PACKAGE_SELECTED.** Select the exact-material/zone merged Hybrid package at 128 px/m, with 4× capability-clamped anisotropy. No material appearance redesign, architectural change, weathering or simulator integration occurred. Stage 2I has not started.

Only **PROW** and **LOWER_ALBERT_OBLIQUE** are stable production candidates. WYNDHAM_LONG, LOWER_ALBERT_LONG and ENTRANCE_REGION remain **FROZEN_STAGE_2B1_NEUTRAL**. SOUTH_TERMINATION remains **UNSUPPORTED / FROZEN / NEUTRAL**. Runtime grouping of contextual geometry does not promote those façades.

## Package and operational cost

| Item | Stage 2G baseline | Preferred Stage 2H |
|---|---:|---:|
| Encoded GLB | 4,189,752 bytes / 3.996 MiB | 3,379,292 bytes / 3.223 MiB |
| GLB meshes / primitives | 525 / 530 | 32 / 32 |
| Render meshes | 530 | 32 |
| Asset triangles | 20,203 | 20,203 |
| Materials | 15 total; 8 active semantic families | Unchanged |
| Embedded runtime PNGs | 7 | Unchanged |
| Decoded RGBA backing estimate | 74.00 MiB | 74.00 MiB |
| GPU RGBA8 + full mip estimate | 98.67 MiB | 98.67 MiB |
| Combined E0 draw calls | 1,002 | 66 |
| Combined submitted triangles, all passes | 39,590 | 40,430 |
| P0 combined CPU submit median | 1.00 ms | 0.30 ms |
| P0 combined GPU query median | 1.587 ms | 1.547 ms |
| Initial local load | 38.7 ms | 29.1 ms |
| Median repeated no-store load | 31.20 ms | 25.35 ms |

Measurements use actual Apple M4 Pro / ANGLE Metal, Chromium 1228, Three 0.186.0, WebGL2. P0 is 1200×840 / DPR1 / 2048 shadows / A8; P1 is 600×420 / DPR1 / 1024 shadows / A4 on the same hardware. P1 is a constrained configuration, not an emulated device benchmark. Thirty paired CPU and GPU samples per cell, with the first three GPU samples excluded; disjoint/invalid queries are rejected. Timing is variable and not an FPS promise.

Calls fall **93.4%** and combined CPU submission about **70%**. GPU improvement is small or mixed across views: union culling submits extra hidden/context triangles. Source triangle count is not the bottleneck. The leading call contributor was held neutral simple-frame fragmentation (716 of 1,002 combined calls). Texture residency remains the main memory cost; the 3.22 MiB network file is not a memory proxy. GPU memory is estimated from dimensions/formats/mips, not directly measured. Environment, glass render targets, shadows, buffers and JS objects are separate costs. First-render wall time includes uploads and compilation; isolated texture-upload time is unavailable.

## Ownership and loader results

PASS: eight baseline and six cycles per experimental candidate return all tracked asset-owned source/instance/geometry/material/texture counts to zero. GL and renderer counts after unloading remain constant within each fixed environment context. No monotonically growing asset-owned resource curve.

A reusable SourceAsset owns immutable geometry/textures/ImageBitmaps and material templates. Each instance owns its root, transform, visibility, metadata and cloned materials. Explicit owner/instance leases release shared resources only at the final lease. Source-owner release followed by A disposal leaves B rendering **identical pixels**. Material and metadata mutations are isolated; texture mutation is prohibited. B's final disposal releases maps, buffers and ImageBitmaps exactly once.

Local cold/second loads, HTTP cache policies, enabled/disabled Three Cache, Blob loading, 404, malformed-header failure, pre/in-flight fetch abort, late-parse abort and concurrent superseded loads pass. Cache in this Three version ignores Blob URL keys, so embedded images do not accumulate. Parsing cannot be interrupted: a late-aborted parsed result is disposed before delivery. The harness generation gate prevents stale attachment. Arbitrary partial corrupt-image decoder failures and actual application mounting are outside this tested validated-package contract.

Renderer/environment ownership is separate. Asset disposal leaves stable PMREM/LTC/background/transmission resources alive. Dedicated harness shutdown disposes captured targets, probes/lights and renderer, then loses its own context. One internal texture and sometimes a shadow program remain before context loss; all observed handles are invalid afterward. This never licenses losing a shared application context for one asset unload.

## Retained and rejected runtime experiments

Retain compatible static grouping only on runtime copies: exact material, explicit zone, compatible attributes. Cross-façade and multi-material architectural shells retain separate ownership. No vertex welding, triangle deletion, normal recomputation, UV rewrite or texture rebake. Independent decode compares all 530 source primitive ranges: every position, normal, UV and tangent is byte-exact. All 20,203 triangles, original face associations, semantic classes and metadata survive through the reverse merge manifest.

Retain **4× anisotropy** with trilinear mipmaps, linear magnification and clamp wrapping. Three 48-frame camera paths cover Prow arc, Oblique approach/recede and side pan. The 720-frame study tests baseline A8/A4/A1 plus merged and lower-cost A4. No transferred Prow seam or dominant joint/band flicker appears in these bounded architectural sequences. A4 versus A8 mean differences are approximately .00994 / .00118 / .00070 RGB byte; A1 loses more grazing-angle detail. GPU sampler timings are non-monotonic, so no guaranteed A4 speed advantage is claimed. Animated sequences and playback are supplied; universal device/velocity assurance is not claimed.

The 64 px/m copy saves 75% texture allocation, but increases boundary/normal filtering differences in the doorway view (mean .522 RGB byte, P99 18/255). **Reject it as the selected authority replacement.** It remains experimental evidence, not a second preferred package. Source materials were never compensated.

KTX2/BasisU is a feasibility study only: supported native compression extensions observed, no installed deterministic encoder or compressed prototype. A hypothetical 16-byte 4×4 format could reduce the same full-mip layout to about 24.67 MiB, but actual quality/transcode cost is untested. Atlas and advanced batching were not justified after grouping solved the measured fragmentation. Per-zone update isolation remains intact.

## Visual, semantic and rebuild regression

Five fixed runtime views preserve layout, silhouette, hierarchy, covered-field opacity, glass identity and restrained frequency. Exact grouping has only tiny raster differences from draw/depth order (fixed-view means about .00003–.00011 RGB byte). It is **LOSSLESS_RUNTIME at meaningful architectural scale**, with those numerical differences disclosed. A4 is explicitly **ACCEPTABLE_RUNTIME_LOSS** versus A8. No source material corrections or appearance Dream Loop iterations.

Stage 2F remains upstream visual authority; Stage 2G actual Three output is the runtime baseline. Cycles GI/interreflection, PMREM/LTC area-light behavior, shadows and transmission do not match pixel-for-pixel. No Cycles-chasing adjustment was made. E0–E3 integration expectations are documented separately.

Official Khronos glTF-Validator 2.0.0-dev.3.10: **zero errors, warnings, infos or hints** for baseline, merged, lower-cost and preferred GLBs. No missing resources, cameras, lights, validation helpers, FCC or unexpected extensions. Glass transmission/IOR remain inherited optional extensions.

Deleted and rebuilt **180 generated outputs**. Package/GLB, concatenated geometry, UV, map hashes, material assignments and manifests reproduce. **171 decoded PNG files match** under the canonical isolated protocol, including all animated PNG frames. All five structural rendering/resource baselines and repeated lifecycle tests reproduce. All **3,318 protected earlier-stage/reference files** remain byte-identical.

The initial comparison mixed full-experiment and isolated capture histories, producing differences in 22 native motion-frame files and one derived sheet. That failed attempt is preserved. Two identical isolated native captures then reproduced 144/144 selected motion frames exactly; the final delete-and-rebuild uses that protocol. Actual changed pixels are never described as PNG metadata. Server ports, timings, frame counters and validator timestamps remain nondeterministic runtime metadata, recorded separately.

Stage 2A.3 massing, Stage 2B/2B.1 openings, Stage 2C detail, Stage 2D segmentation, Stage 2E frequency, Stage 2F appearance, Stage 2G metric U1/tangent UV and original bake authority remain unchanged. Frozen zones retain neutral material authority. SOUTH_TERMINATION has no separately labelled source runtime primitive; all conservative inherited shell geometry is independently preserved. No FCC, weathering or simulator file changes.

Preferred GLB SHA-256: `1f15e04fa6161e327d6f4f89f9b011f3b8f41bcf305e7ee2e3a1a127fef93b8e`.

## Next bounded stage

Recommend Stage 2I: isolated, development-only View Camera Simulator integration behind its existing scene-asset abstraction, with explicit preload/instance/disposal leases, feature flag, target-device resource measurements and neutral environment parity policy. Preserve canonical scene/optics/camera authority. Test mounting/unmounting and cancellation in the real app before wider exposure; evaluate texture compression separately if memory matters on target devices. **Stop here; no integration was performed.**

## Artifacts

- [Package manifest](../runtime/package-manifest.json) / [Preferred GLB](../runtime/preferred-runtime-candidate.glb)
- [Ownership](../runtime/runtime-ownership-contract.md) / [Lifecycle validation](lifecycle-validation.md)
- [Draw calls](draw-call-analysis.md) / [Texture memory](texture-memory-analysis.md)
- [Temporal sampling](temporal-sampling-validation.md) / [Optimization comparison](optimization-comparison.md)
- [Runtime parity expectations](runtime-parity-expectations.md)
- [Motion summary](../renders/comparisons/temporal-sampling-summary.png) / [Motion playback](../renders/motion/index.html)
- [Stable-zone final](../renders/comparisons/stable-zones-stage2h-final.png)
- [Clean rebuild](../analysis/clean-rebuild-verification.json)
