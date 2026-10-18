# Anatomy Bellows Compositing Causal Investigation

## Objective and result

M-INV8 tests whether the large Front Standard WebGL/native WebGPU discrepancy is sensitive to the mounted Bellows' double-sided pass behavior, fixed-function blending, or their interaction. It uses the real `bellows-folded-surface` renderable in the Front Standard state, with the Bellows dimmed.

**Outcome: TCI-3 — partial contribution only.** Disabling blending nearly removed the cross-renderer difference inside the Bellows visibility-response region, while the broad dimmed-group residual remained large. `forceSinglePass` alone was effectively inert. The test does not establish that blending explains the wider Anatomy mismatch or distinguish source-alpha from framebuffer-destination effects. No rendering correction is authorized.

## Prior evidence and baseline

This study resumes the original real-scene discrepancy after M-INV7 qualified the five one-level instrumentation changes. It preserves the earlier classifications: **Q2 — MEASURABLE INSTRUMENTATION PERTURBATION**, **PBI-3 — PERTURBATION REPRODUCED BUT NOT UNIQUELY LOCALIZED**, **N2 — CONTROLLED PROXY IMPROVEMENT**, **G2 — PARTIAL STAGE ATTRIBUTION**, and **M2 — OPT-IN IMPLEMENTATION INCOMPLETE**. Native intermediate destination/post-draw measurements remain F2.

The C0 browser-presentation comparison reproduced the historical **104.1277 RGB MAE** in the fixed 12,287-pixel dimmed-response mask. Full-frame MAE was 6.0819; the selected Bellows visibility-response mask contained 5,421 pixels and had 35.3978 MAE. The unaffected/background candidate mask had 0.0091 MAE. Each same-renderer C0 repeat was exact in this run.

The selected Bellows remained the actual mounted semantic renderable. Its source was a `MeshStandardMaterial` with color `#111827`, opacity 0.16, `transparent = true`, normal blending, `DoubleSide`, `forceSinglePass = false`, depth test enabled, and depth writes disabled. Both renderers used 44 vertices and 240 indices with matching geometry content fingerprints. WebGL used its standard output path; native evidence came from `webgpu-renderer/webgpu`, material-aware B0, with no application fallback.

Chrome 155.0.8059.84 on Darwin arm64, pinned Three.js r186. The viewport was 1440 × 1000 CSS pixels at DPR 1 with 1028 × 820 canvas backing. Screenshots were 514 × 411 browser-presentation images. Hardware acceleration was not exposed by this renderer path and remains unconfirmed. The browser screenshot measurements are kept separate from raw framebuffer measurements.

## Intervention qualification

The primary ROI was fixed before C1–C3 from the committed dimmed-response mask. The Bellows mask is the observed image response to hiding only the Bellows, intersected with the broad dimmed mask. It includes 5,421 pixels; it is not an exact mesh silhouette. The report also retains the historical M3 Bellows mask, unaffected/background candidate, eight high-error screenshot samples, and nine fixed M-INV5 framebuffer positions mapped to screenshot pixels.

| Condition | Bellows pass behavior | Blend state | Actual Bellows draws (WebGL / native) | Cross-renderer dimmed-mask MAE | Cross-renderer Bellows-mask MAE |
| --- | --- | --- | ---: | ---: | ---: |
| C0 | Original two-pass | Enabled | 2 / 2 | 104.1277 | 35.3978 |
| C1 | `forceSinglePass` | Enabled | 1 / 1 | 104.1282 | 35.3989 |
| C2 | Original two-pass | Disabled | 2 / 2 | 88.8707 | 0.8472 |
| C3 | `forceSinglePass` | Disabled | 1 / 1 | 88.8730 | 0.8525 |

C0/C2 recorded BackSide then FrontSide draws. C1/C3 recorded one DoubleSide draw. The native draw-metadata path records actual selected draw materials without framebuffer copies, readbacks, or extra render calls. Three.js r186 represents `NoBlending` by omitting the pipeline `blend` descriptor. The metadata probe records that as disabled and does not call r186's blend-descriptor helper for `NoBlending`.

All conditions kept source opacity, transparency-list classification, depth test/write, geometry, render order, and source color fixed. Blend enablement was verified from WebGL draw-time GL state and the native material plus r186 pipeline mapping. The material family has no explicit `alphaWrite` property in this path; metadata is null, and screenshot alpha was not measured. The controls are intentionally non-equivalent visible interventions, not substitute render modes.

## Response and interpretation

C1 changed the images by less than 0.006 MAE within each renderer's Bellows ROI and did not reduce the cross-renderer discrepancy. C2 caused a large within-renderer Bellows response (118.6097 MAE WebGL; 148.1912 native) and reduced the cross-renderer Bellows-mask difference from 35.3978 to 0.8472. C3 produced essentially the same response as C2. The C2 difference-of-responses MAE was 34.8343 in the Bellows ROI, while the factorial interaction `(C3 − C2) − (C1 − C0)` was 0.1317 on WebGL and 0.1323 on native, below the C2 response and consistent with no material single-pass/blend interaction in this image metric.

The broad dimmed-group MAE fell by about 14.7% under C2 and remained 88.8707; the residual is substantial. Therefore, the evidence supports a strong Bellows-region sensitivity to blend bypass but not a dominant explanation for the entire dimmed-group mismatch. It does not reconstruct source fragments or numerically decompose source alpha and destination RGB.

The D1 selector inspected current mounted visible dimmed transparent renderables whose live projected bounds intersect the Bellows bounds. It found no candidates, so D1 was not executed. This is reported as unsupported (`no current dimmed transparent projected-overlap candidates`), not as evidence that destination context is irrelevant. No opacity-response series was run; the bounded matrix identified a partial blend sensitivity and reached the TCI-3 stop outcome. A later experiment would need independent evidence to distinguish source-alpha from destination/occlusion contributions.

## Ownership, restoration, and production boundary

WebGL interventions use a selected-renderable material clone and restore the original material identity. Native interventions create a generation-scoped output-material variant under the existing material-aware controller. The prior B0 output is retained while a temporary variant is attached, then reattached before its lease is released. The current run restored C0 exactly on both renderers, disposed each WebGL clone once, preserved the borrowed source materials, geometry and textures, and left Ground Glass contentful with exact final image restoration. Ground Glass repeat MAE was 0.00111.

The intervention and metadata routes remain development-only. They do not change renderer selection, authored materials, normal output policy, teaching state, Ground Glass, or Architecture Rise. The machine report retains all condition metadata and metrics without embedding raw framebuffer arrays. Browser captures remain in ignored Playwright results.

## Retained decisions

- **TCI-3 — PARTIAL CONTRIBUTION ONLY** for M-INV8.
- **Q2 — MEASURABLE INSTRUMENTATION PERTURBATION**.
- **PBI-3 — PERTURBATION REPRODUCED BUT NOT UNIQUELY LOCALIZED**.
- **N2 — CONTROLLED PROXY IMPROVEMENT**.
- **G2 — PARTIAL STAGE ATTRIBUTION**.
- **M2 — OPT-IN IMPLEMENTATION INCOMPLETE**.
- M-INV5 native intermediate destination/post-draw pixel evidence remains **F2**.

No production rendering correction, native WebGPU eligibility change, F1 promotion, or PR N work follows from this study. If further attribution is pursued, the next bounded measurement should vary authored opacity while preserving `transparent = true`, with the same fixed Bellows/dimmed/background regions and actual draw-state checks. That would test whether the blend sensitivity follows source alpha without claiming a physical blend decomposition.

## Machine-readable evidence

The complete compact report is in [the M-INV8 report](anatomy-bellows-compositing-causal/report.json). It includes provenance, source/output state, draw metadata, fixed and observed masks, signed responses, difference-of-responses, factorial interaction, the unsupported D1 result, restoration, resource ownership, Ground Glass checks, and retained classifications. Raw pixel arrays are not committed.

## Validation

- M-INV8 native WebGPU browser experiment: **1 passed**, required native backend, no fallback, no page errors, and no native console blend diagnostics.
- Focused M-INV8 unit tests and material-tracker regressions: **31 passed**.
- Repository checks: `npm test` (**262 files, 2,435 tests**), typecheck, lint, CSS check, and production build passed.
- Native Anatomy experiment configuration: all nine tests passed across the full run and the provenance-corrected M-INV6 rerun. The initial M-INV6 invocation lacked its required historical provenance variable and failed that guard; it passed when rerun with the established base and measurement SHAs.
- PR #263 four-state native output study: **1 passed**. The native-required 13-state candidate audit passed on isolated retry after an earlier run's evidence-page closure during final mask packaging.
- Architecture Rise strict native/WebGL parity: **1 passed**, all 81 criteria retained and zero failures.
- Production preview/isolation: **2 passed**. The production test checked loaded JavaScript for the M-INV8 intervention event, compositing module, metadata capture, and existing GPU capture identifiers; `dist` also contains no matching experimental identifiers.
- The native run preserved Ground Glass content and exact final restoration; repeat MAE was 0.00111. No rendering measurements or historical research classifications were changed by these validation runs.

## Review-fix update — Native pipeline and trial qualification

PR #268 review round 1 addresses the P1 pipeline-evidence and P2 trial-qualification findings. The reviewed starting HEAD was `18a94bb798b97934a0c1efdac044fb9e6f0bd877`; the M-INV8 rerun was captured from measurement commit `1527bb7ed8d5e1c748907342549f00fdba2c9a46`, based on `111890173c92106c63f23eda09fbde6ce695a39e` (`main`).

The former native claim came from the material's requested blend flags. That is not independent evidence of the pipeline selected for a native draw. The review-fix observer snapshots the descriptor passed to `GPUDevice.createRenderPipeline()` or `createRenderPipelineAsync()`, associates the exact returned pipeline object with that descriptor, and qualifies only the pipeline object reached through the pinned Three.js r186 `WebGPUBackend.draw()` render-object mapping used by `_draw()`. The record is also scoped to the current renderer device and mount identity and is checked against the render context's color-target format, depth/stencil format, and sample count. Requested material state, renderer-side material state, and creation-descriptor pipeline state remain separate fields. Unsupported, stale, pre-observation, mismatched, or incompatible pipeline evidence fails closed. The observer does not modify descriptors or submit GPU work.

The new run directly recorded two enabled-blend pipelines for C0, one enabled pipeline for C1, two blend-disabled pipelines for C2, and one blend-disabled pipeline for C3. The disabled cases record the actual associated creation descriptor with its color-target `blend` member absent. All four native conditions qualified, including renderer/runtime, generation, camera and viewport, source and effective output state, draw count/order, pipeline descriptor association, output policy, repeatability, image availability/dimensions, restoration, geometry identity, and owned/borrowed resource checks. The exact per-draw evidence and qualification checks are retained in the report; the older run remains under `historicalPriorRun` and is explicitly marked as material-inferred and unqualified for this review contract.

The benchmark now computes a single structured qualification for each trial and uses it for primary-condition eligibility, cross-renderer pairs, difference-of-responses, factorial interactions, aggregate matrix qualification, TCI classification, and the final browser assertion. A failed required check excludes that evidence downstream and yields TCI-0; diagnostic screenshots and metrics may remain in the report but cannot upgrade an unqualified trial. Regression tests cover pipeline/material mismatch, unavailable descriptors, unrelated pipeline creation, cached/pre-observation state, stale mount identity, transition/restoration, and required-check propagation.

The independently qualified rerun retains **TCI-3 — PARTIAL CONTRIBUTION ONLY** and reproduces the same four dimmed-group cross-renderer MAEs: C0 104.1277, C1 104.1282, C2 88.8707, and C3 88.8730. The Bellows response remains 35.3978 for C0 and 0.8472 for C2. This lifecycle/evidence repair does not infer source-alpha or destination contributions and does not change the scientific conclusion. Q2, PBI-3, N2, G2, and M2 remain unchanged; M-INV5 native intermediate destination/post-draw pixel evidence remains F2.

The browser exposed Chrome 155.0.8059.84 and Three.js r186, but hardware acceleration remains unconfirmed. The pipeline claim is based on the recorded API creation descriptor associated with the exact r186 pipeline object selected for the draw, not an API readback of the driver's compiled state. The image comparison remains browser-presentation screenshot evidence, not a raw framebuffer comparison. No F1 promotion, production rendering correction, renderer-eligibility change, or PR N work follows from this review fix.

### Review-fix validation

- M-INV8 native WebGPU experiment at the review-fix measurement commit: **1 passed**, with C0–C3 pipeline and trial qualification complete.
- Native Anatomy configuration: **8 passed, 1 failed**. M-INV5, M-INV6, M-INV7, and M-INV8 passed; the M-INV4 native third-backend capture timed out while waiting for adapter availability. Its isolated retry timed out the same way. The single failure is reported as an adapter-timeout failure, not a pass or a measurement.
- Native-required 13-state audit: **2 passed, 1 skipped**. The material-aware candidate matched all 13 states; the legacy two-way audit was skipped by the existing material-aware-mode guard.
- PR #263 four-state native output study: **not qualified** on the final retry because native adapter availability timed out before the capture started.
- Architecture Rise strict native/WebGL parity: **1 passed**, all 81 criteria retained with zero failing criteria.
- Production preview/isolation: **2 passed**; the production test confirmed the default and explicit WebGPU requests stay on the production WebGL path and deny the Anatomy material-aware candidate.
- Ground Glass remained contentful and restored in the M-INV8 qualified run. The original measurement's repeat MAE remains 0.00111.
- Final repository checks: `npm test` (**264 files, 2,460 tests passed**), `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and `git diff --check` passed. The production JavaScript asset scan found none of the new pipeline observer identifiers.
- Native adapter timeouts were environmental capture-start failures. They are not counted as successful experiment results and do not alter the retained M-INV8 measurements or classifications.
