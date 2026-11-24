# Core Regression Candidate: Omitted-Test Preservation Ledger

## Scope and disposition

This ledger reviews the strongest suspected omissions from the 48-file Core Regression candidate and records where the candidate demonstrably lacks unique protection. The full 354-file, 4,384-case inventory is in [`CORE_REGRESSION_TEST_INVENTORY.json`](./CORE_REGRESSION_TEST_INVENTORY.json).

At the B4 base, 62 files are Category A mandatory keepers (the 48 candidate files plus 14 reviewed high-impact omissions). The other 292 files are Category D and stay in full mandatory GitHub Vitest. Of those 292, 271 are explicitly `INVENTORY_ONLY`; their contents have not had a complete assertion-body and sibling-overlap review. Categories B and C are empty: no omitted Unit-test group is currently assigned to a proven conditional GitHub owner, and no file is proposed for Local-only execution.

The `preservationCategory` is a planning disposition, not workflow routing. No test is removed, renamed, or moved by this audit.

## Reviewed high-impact files outside the candidate

| Test file | Cases | Distinct contract / realistic regression | Why the candidate is insufficient | Preservation disposition |
|---|---:|---|---|---|
| `src/tests/unit/architectureRiseMountedGeometry.test.ts` | 5 | Mounted Architecture Rise geometry, anchors, and visibility | Generic scene publication and optics tests do not prove scene-specific mounted geometry | A; retain |
| `src/tests/unit/architectureRiseV2Contracts.test.ts` | 3 | Locked Architecture Rise v2 contracts and controls | Candidate coverage does not own these scene-specific assertions | A; retain |
| `src/tests/unit/calculateOffAxisProjection.test.ts` | 8 | Fixed matrix references, finite translated/tilted cases, and column-major layout | Candidate optics tests do not subsume this independent projection-matrix contract | A; retain |
| `src/tests/unit/e2eSpecPolicy.test.ts` | 2 | E2E selection and skip-governance policy | M7V evidence tests protect different policy/report contracts; both must remain effective | A; retain |
| `src/tests/unit/featurePushRouting.test.ts` | 19 | B1 feature-push deduplication decisions and safe fallback | The current workflow's event router has its own direct regression contract | A; retain |
| `src/tests/unit/finiteFocusDomain.test.ts` | 2 | Real-image focus domain, minimum focus beyond focal length, invalid values | Thin-lens and focus-plane calculations do not establish this control-domain boundary | A; retain |
| `src/tests/unit/focalLengthPropagation.test.ts` | 5 | Lens focal length propagation through Ground Glass camera / depth-of-field uniforms | A helper-level optics result does not prove propagation through renderer inputs | A; retain |
| `src/tests/unit/groundGlassCoverageRendering.test.ts` | 7 | Asymmetric conic coverage, physical crop, Raw/Upright, neutral/debug output | Coordinate/orientation tests do not prove the coverage renderer's separate output contract | A; retain |
| `src/tests/unit/groundGlassM7dPhysicalCocEvidence.test.ts` | 71 | M7D physical CoC evaluator controls, including invalid lens normal, mislabeled native scenario, and qualification/count mutations | No equivalent M7D archive validator is present; the 48-file candidate does not include this evaluator | A; retain |
| `src/tests/unit/groundGlassWebGpuB1Reference.test.ts` | 17 | B1 reference output from GPU-observed provenance; binary16 bounds; exact source-color fallback; near alpha/compositing | Runtime/adapter tests do not cover the B1 output algorithm or reference oracle | A; retain |
| `src/tests/unit/groundGlassWebGpuCorrespondenceLargeCoc.test.ts` | 12 | Large-CoC projection drift, unit conversion, raster/readback correspondence, and fallback metrics | General runtime and adapter tests do not assert these output measurements | A; retain |
| `src/tests/unit/historicalEvidenceRouting.test.ts` | 20 | B2 changed-path family selection, dependency closure, fail-closed routing | Archive replay validates artifacts; it does not validate the router that decides which family runs | A; retain |
| `src/tests/unit/localCiContracts.test.ts` | 32 | Local CI arguments, owner selection, runner evidence, report completeness, and source-state behavior | M7V and the selected evidence tests do not protect Local CI report and routing contracts | A; retain |
| `src/tests/unit/sceneVariation.test.ts` | 8 | Seed determinism, schema, and semantic stream invariance | Scene registry and route checks do not validate this data-generation invariant | A; retain |

These 14 files are Category A in addition to the candidate. “A” does not mean they can be run only in the candidate; the current required owner remains the full Vitest job.

## Current-main omitted contract not yet promoted

PR #364 changed `src/render/table-tilt/TableTiltStudioFurnishings.ts` and expanded `src/tests/unit/tableTiltMountedVisibility.test.ts` to 15 cases. The test covers lens-ray visibility at reset/calibrated/public-stop focus states, a temporary occluder, tabletop bounds, room geometry, window placement, and mounted sightlines. At the exact B4 base, `resolveOwnerSelection(["src/render/table-tilt/TableTiltStudioFurnishings.ts"], owners, pathExists)` selects only `ground-glass-coordinates` and its six coordinate Unit tests plus `groundglass-interaction.spec.ts`; it does not select `tableTiltMountedVisibility.test.ts`. The observed result is `incomplete: false` and `fullVitest: false`, so this known render-path change can look complete while omitting its direct test owner. Separately, related `src/scenes/**` changes are explicitly incomplete in Local CI. The current inventory marks this 15-case file Category D / `INVENTORY_ONLY`, so it remains in full mandatory Vitest pending a complete assertion and impact review.

## Candidate-versus-omitted negative control

A controlled experiment was performed in a disposable local clone at the exact current B4 base `af680d7f9409bab13c6654abaaa2dad5aeac8079`:

| Mutation | Candidate result | Omitted test result | Finding |
|---|---|---|---|
| Change `reconstructGroundGlassB1Reference` to return destination source color where a valid far-gather sample is required | Core candidate PASS: 48 files / 611 cases; Vitest step 16.780 s | `groundGlassWebGpuB1Reference.test.ts`: 4 failed / 13 passed; command exit 1 | The omitted test detects a defect the candidate does not. The mutation and clone were discarded. |

This counterexample alone disproves equivalence between the present candidate and full Vitest. The test concerns a research/reference implementation, but its unique evaluator contract remains in the mandatory suite until a separately enforced owner is established. The archived report check is not a replacement for executing this Unit test.

## Historical evaluator, provenance, and archive separation

The following active Unit test groups are present in the current Vitest discovery. Their full case names and per-file counts are in the inventory JSON. Every file listed here remains in full GitHub Vitest under the B4 decision.

| Family / group | Active Unit tests in current Vitest | Archive or current CI relationship | Preservation finding |
|---|---|---|---|
| M7B / M7C lifecycle evidence | `groundGlassM7bLifecycleEvidence.test.ts` (34), `groundGlassM7cR187LifecycleEvidence.test.ts` (59) | Separate native renderer lifecycle E2E and device-loss qualifications; frozen reports are distinct | Keep active lifecycle evaluator tests and the specialized runtime proof; archive reports alone are not current lifecycle coverage. |
| M7D physical CoC | `groundGlassM7dPhysicalCocEvidence.test.ts` (71) | No equivalent M7D archive validator in the current manifest | Unique evaluator and mutation-sensitive controls; mandatory. |
| M7E artifact / gather / JSON | `groundGlassM7eArtifactReplay.test.ts` (26), `groundGlassM7eGatherB1Evidence.test.ts` (44), `groundGlassM7eLosslessEvidenceJson.test.ts` (10) | `evidence:replay:m7e` and M7G child replay; retained source records include PR #303 | Archive replay protects frozen evidence integrity, while Unit tests protect current replay/evaluator semantics. Keep both. |
| M7F presentation / replay CLI | `groundGlassM7fPresentationEvidence.test.ts` (68), `groundGlassM7fReplayCli.test.ts` (10) | M7F replay and M7G child; retained source records include PR #304 and dependency closure | Keep evaluator, normalizer, and CLI contracts; archive lane is not equivalent. |
| M7G orchestration / consolidated report | `groundGlassM7gConsolidatedEvidence.test.ts` (70), `m7gReplayOrchestration.test.ts` (15) | `evidence:report:m7g` replays E/F and combines their report; orchestration is a separate process contract | Keep both the composition evaluator and replay-process tests. |
| M7H / M7I / M7J | `groundGlassM7hBroadE2eTriage.test.ts` (28), `groundGlassM7hCompareCli.test.ts` (29), `groundGlassM7iBroadE2eRemediation.test.ts` (55), `groundGlassM7jFourWorkerStability.test.ts` (22) | `evidence:check:m7h` through `m7j`; dependency closure connects triage, remediation, and stability | Keep the current evaluator/CLI tests and the frozen report validators. |
| M7K / M7L / M7M | `groundGlassM7kBroadE2eQualification.test.ts` (60), `groundGlassM7lLearningDrawerRemediation.test.ts` (33), `groundGlassM7mSceneReadiness.test.ts` (63) | `evidence:check:m7k` through `m7m`; schema v1/v2 and downstream dependency links are distinct | Keep active schema, evaluator, and scene-readiness contracts. Archive qualification does not replace them. |
| M7K capture / source provenance | `m7kCaptureWorkflow.test.ts` (8) | Current test checks depth-1 retrieval of a source more than 50 commits behind, unknown SHA rejection, retained PR ref after main advances, exact source paths, and workflow ownership | This file changed since the PR #358 audit baseline and was reviewed at B4 source. It is omitted from the Core candidate and is a direct provenance/qualification safety owner. Keep mandatory. |
| M7N / M7O / M7P / M7Q | `m7nRendererLifecycleEvidence.test.ts` (6), `m7nRendererLifecycleTrace.test.ts` (10), `m7oCanvasAssertionTimingEvidence.test.ts` (13), `m7pAssertionSchedulingEvidence.test.ts` (53), `m7qLightPeerTraceAbEvidence.test.ts` (18) | Archive integrity checks and exact source-history fetches are routed by B2 for the relevant families | Keep active Unit evaluators and provenance contracts; archive replay is separate evidence. |
| M7R | `m7rBroadE2eRecoveryEvidence.test.ts` (23) | Unconditional ordinary-CI `npm run evidence:check:m7r` and retained source-history step in `pages.yml` | Preserve this unconditional integrity owner. It does not prove current browser behavior. |
| M7V / M7W | `m7vE2eQualificationPolicy.test.ts` (31), `m7wQualificationEvidence.test.ts` (24) | Unconditional ordinary-CI `npm run evidence:check:m7v`; M7W offline archive evidence has a separate qualification owner | Keep M7V current source-policy/skip-governance validation mandatory. W replay does not replace the active policy Unit test. |
| M7S / M7T / M7U policy references | Included in `historicalEvidenceRouting.test.ts` family checks; current browser evidence includes diagnostic and swing-control specs | M7S/T/U evidence is incomplete or specialized; M7S has no archive validator equivalent | Retain current routing and E2E governance; do not infer completed experimental evidence from family naming. |

The inventory also contains `groundGlassM6Presentation.test.ts` (30 cases). It protects an M6 presentation contract; its relationship to an M7F evidence family is only a linkage tag, not a claim that the tests are interchangeable.

`historicalEvidenceRouting.test.ts` (20 cases) and `m7kCaptureWorkflow.test.ts` (8 cases) are particularly important to any future conditional design: they test the routing and exact-source retrieval implementation itself. A changed-path selector that never runs them could silently suppress the checks they are meant to validate. Unknown dependency paths must therefore cause full test execution until a separate route is proven.

## Other critical proof that remains outside Core Vitest

A candidate PASS cannot stand in for these independently observable contracts:

- public ordinary Chromium behavior and real browser frame delivery;
- Production Preview's WebGL-only bundle isolation;
- Raw/Upright rendered-pixel correctness and physical left/right, top/bottom relationships;
- image-circle raster coverage and visual evidence;
- SPA navigation, renderer generation, and resource disposal under real browser lifecycle;
- native WebGPU backend, device-loss, and GPU-backed qualification;
- historical artifact source provenance and exact-SHA replay.

The current full GitHub `ci` job retains its full Vitest, ordinary Chromium smoke, Production Preview, M7R, M7V, and historical source fetches. B2's historical lane is separate and must remain fail-closed. Static manifest validation cannot replace current application or browser behavior.

## Unreviewed inventory declarations

The remaining 271 `INVENTORY_ONLY` files are explicitly listed in the JSON by path, actual case count, assertion names, owner candidates, direct imports, candidate status, confidence, and missing proof. No deletion, Local-only move, or conditional route is recommended for them. Before any future change, a reviewer must inspect each proposed group’s assertion body, source caller, sibling tests, runner evidence, and realistic regression.
