# M7E r187 M5 Audit

**Audit base:** `f1160754ef8afd15012f9c9f574eb6d189f3b794` (verified `origin/main`, M7D merge)
**Predecessors:** PR #300, #301, and #302 are merged; their merge commits are ancestors of this base.
**Scope:** read-only architecture audit before M7E implementation changes.
**Historical contract:** M5Q stays `m5q-architecture-rise-r186-v3`; M6D stays `m6d-opaque-presentation-v1`.

## Findings

1. **M5 build activation is not revision-aware.** `isGroundGlassApertureGatherResearchEnabled()` and `isGroundGlassApertureGatherResourceProvisioningEnabled()` in `groundGlassApertureGatherPolicy.ts` accept the development gather flag nested under the M3 Raw pilot. They do not check the installed Three revision or M5 evidence. On r187, they can turn on M5 resource allocation. This does not by itself pass M5 authorization: the adapter calls `resolveGroundGlassApertureGatherResearchEligibility()` before submitting the M5 passes.

2. **The adapter's default eligibility record is historical r186.** The normal Raw request path defaults to `GROUND_GLASS_RAW_WEBGPU_COMPATIBILITY`, irrespective of `expectedRendererRevision`. Its M4, Gather, and B1 records identify r186. The r187 compatibility record replaces M3 Raw and M4 evidence, but deliberately retains r186 Gather/B1. Candidate revision matching rejects the stale records, so the current r187 path reports M5 unsupported. The default needs to resolve from the installed renderer revision once M7E has a revision-specific M5 record.

3. **M6 session provisioning can bypass the M5 resource boundary.** The M5 resource helper treats `isGroundGlassM6CapablePilotSessionForBuild()` as sufficient without matching the M6 record to the installed revision. The M6 record itself is r186. A trusted M6 build flag plus a native r187 Architecture Rise session can therefore provision M5 targets despite the stale M6 revision. The separate M6 request/eligibility path is revision-bound; provisioning must also be revision-bound so it cannot allocate on r187.

4. **Existing native M5 tests contain historical r186 assertions.** The revision-specific cases in `ground-glass-webgpu-aperture-gather-app.spec.ts` include M5Q candidate exploration and confirmation, M6D composite probing, M5 B1/app capture, M5R investigation, M5T quadrature, and M5U quadrature. Each of those asserts `REVISION === "186"`. They remain historical r186 tests and must stay gated from the r187 qualification run. The M3/M4 baseline and M5 stale-readback/failure tests are separately identifiable.

5. **Reusable implementation and evidence helpers exist.** The existing test defines native identity checks, `captureGather()`, `captureB1BoundaryProbe()`, current-frame identity assertions, reachable candidate-state selection, `captureM5qMatrix()`, the independent Far/Near/B1 references, and the M5Q dimension evaluator. These allow a narrow r187 test path to reuse the established capture and oracle contracts without copying the full M5R–M5U research suite or relabeling historical reports.

6. **Actual target formats are inspected after allocation.** M5 render targets are initialized through the mounted renderer, then `observeTextureFormat()` reads backend descriptors and `resolveGroundGlassApertureGatherFormatEligibility()` checks the M3/M4 inputs and M5 outputs. Requested descriptors alone do not produce eligibility. The capture path records the observed source, depth, physical, validity, gather, B1, composite, provenance, and decision formats.

7. **Adapter ownership is explicit.** The M5 resource bundle owns nine normal targets (Far, Near, B1, research composite, source identity, gather identity, gather-center provenance, selected provenance, and B1 decision) plus one lazily allocated capture-only depth-readback target. It owns its materials, fullscreen geometry, and scenes. M3 source color/depth and M4 physical/validity textures are borrowed and disposed by their existing owners, not M5.

8. **Failed M5 passes do not publish a successful capture.** Each pass enters the completed list only after queue completion. The capture readback follows the Far, Near, B1, decision, and composite passes. A recoverable failure sets M5 status to failed and records the completed prefix; capture publication occurs only after the readback, CPU comparisons, and current-request check. The M3 Raw display is a distinct target.

9. **Staleness checks exist but M5 transition coverage is incomplete.** The pass runner checks the request while work is pending, and the capture path checks it after asynchronous readbacks. The current M5 stale-readback test holds an M5 readback, changes focus, releases it, and verifies only the latest capture is published. It does not cover M5-specific resize, unmount, and scene-change interleavings; M7C remains the general lifecycle authority but M7E must add bounded M5 readback cases for these invalidations.

10. **Native GPU data is compared with independent CPU implementations.** The adapter reads the actual M3/M4/M5 targets, then runs `referenceGroundGlassApertureGather()` and `reconstructGroundGlassB1Reference()` from those captured arrays. It records Far GPU/CPU RGB errors, Near GPU/CPU RGB and alpha errors, B1 decision/reason/path and source fallback comparisons, near-before/after-B1 invariance, mapping and provenance mismatches, and storage/readback evidence. The test assertions check these measurements and target identities.

11. **M5Q decisions are computed from measured R3 metrics, but the contract accepts structured summaries.** The confirmatory E2E creates matched Full32/Full64/Half32 matrices from actual readbacks, calls `evaluateGroundGlassApertureGatherR3()`, then supplies those results to `evaluateGroundGlassM5qDimensions()`. M5Q unit tests validate decision gates. M7E reporting should retain the raw capture identity/fingerprint and computed metric outputs so its evaluator can reject unsupported or internally contradictory summaries; it must not treat hand-entered status text as evidence.

12. **Validity and sign are distinct from confidence.** Existing M5 uses only validity code 1 plus signed-CoC thresholds to admit Far/Near candidates, as its numerical contract specifies. This does not prove canonical near/far confidence. The M4 confidence classification is probe-only; M7D's depth-limited cases near `U=f` remain an explicit limit. M7E must report branch disagreement and unsupported sign claims without rewriting per-pixel CoC or validity.

## Implementation boundary derived from audit

- Add a trusted development/test-only r187 qualification path requiring the native M3 Raw pilot, r187 M4 research inputs, the M5 research flag, an explicit r187 qualification flag, and the test seam.
- Keep that qualification path separate from M3 renderer-attempt authorization.
- After fresh native evidence is evaluated, add distinct r187 `research-only` Gather and B1 compatibility records. Keep M5Q r186, M5R–M5U, M6D, M7C/M7D, production WebGL, M6 r187 denial, and production WebGPU boundaries intact.
- Do not change canonical optics, M4 confidence, M5 Gather/B1 algorithms, C1, or historical thresholds.
