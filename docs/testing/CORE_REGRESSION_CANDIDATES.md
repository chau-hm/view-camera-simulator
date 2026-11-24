# Core Regression Candidate

## Status and intended use

The candidate is a shadow-validation set for investigation. Run it with:

```bash
npm run ci:local:core
```

Its manifest is `scripts/local-ci/owners.json` under `coreRegressionOwnerIds`. The command resolves those owners to test files and relies on Vitest's configured discovery. The report records what Vitest actually collected. The candidate does not change `npm run test`, GitHub CI routing, Required Checks, historical qualification, or deployment.

## Candidate ownership

| Contract owner and source area | Primary candidate tests | Credible regression | Separate requirements, omissions, and proof needed before a later reduction |
|---|---|---|---|
| Canonical optics — `src/core/optics/**` | `deriveOpticsState`, `thinLensModel`, `lensCoverage`, `imageCircleGeometry`, `physicalLensCoverageGeometry`, `scheimpflugConstruction`, `scheimpflugConstructionGeometry`, `scheimpflugPhysicalFocusPropagation`, `opticalDebugScheimpflug`, plus projection/coordinate and movement-geometry tests | Wrong thin-lens distance, image-circle/conic bounds, tilt/swing plane, focus propagation, or movement projection | Deterministic Node tests use fixed physical inputs. Browser raster and public 2D/3D/Ground Glass behavior are outside this Vitest candidate; retain independent image and public browser evidence before omitting those owners. |
| Ground Glass coordinates — `src/render/**` and canonical projection entry | `groundGlassCoordinateContract`, `groundGlassFilmPlaneProjection`, `groundGlassFootprintCoordinates`, `groundGlassPhysicalGrid`, `groundGlassPhysicalScale`, `groundGlassRttOrientation` | Reversed Raw/Upright axis, left/right or top/bottom mapping, crop origin, or physical calibration | Deterministic Node tests use asymmetric coordinate references. Actual rendered pixels, frame delivery, and public scene output remain E2E requirements; retain independent pixel evidence before omission. |
| WebGL RTT and renderer lifecycle — Ground Glass host, scene renderer, renderer test support | `GroundGlassRenderHost`, `SceneRenderer`, `observerRendererLifecycle`, `groundGlassFrameRequest`, `groundGlassFrameExecution`, `groundGlassRttResources`, `groundGlassRenderer` | Accepting a stale frame, retiring the wrong request/generation, leaking a render target, or skipping disposal | Unit and integration tests are deterministic; SPA replacement and real browser frame delivery require Playwright. A future reduced GitHub lane must retain browser lifecycle evidence. |
| WebGPU adapter/runtime — `src/render/webgpu/**` | `groundGlassWebGpuRuntime`, `groundGlassWebGpuOpticalStateAdapter`, `groundGlassWebGpuTestSeam`, `GroundGlassWebGPUAdapterDiagnostics` | Incorrect adapter state, fallback classification, or lifecycle decision | Candidate tests are Node-level. Native Chrome, supported GPU/backend, device-loss, and headed lifecycle are omitted and remain a specialized qualification; this candidate cannot stand in for them. |
| Scene publication — scene registry and route configuration | `publicScenes`, `sceneDefinitions`, `sceneAssetRegistry`, `simulatorRouteValidation`, scene-publication and route integration tests | A disabled scene becomes public, a valid scene is omitted, or a route resolves to the wrong scene/task | Registry and integration tests run in Node/jsdom. Browser scene switching and public route rendering remain separate proof. Any changed file under `src/scenes/**` currently yields an explicitly `INCOMPLETE` affected result because scene-specific material, geometry, task, and renderer dependencies are not exhaustively mapped; this avoids selecting unrelated WebGPU research suites or claiming narrow coverage is complete. |
| Controls and task evaluation — task engine, movement/focus controls, teaching configuration | `taskEngine`, `physicalTaskEvaluation`, `focusControl`, `movementControls`, public-control and selectable-focus integration tests | Task state accepts unreachable movement values or rejects values the public controls can produce | Unit/integration tests cover reachable values and state transitions. Browser completion and keyboard interaction remain outside this candidate and must stay on a named browser lane. |
| Evidence and CI policy — historical qualification scripts, renderer test support | `historicalQualificationGate`, `m7nRendererLifecycleEvidence`, `m7nRendererLifecycleTrace`, `m7rBroadE2eRecoveryEvidence`, `m7vE2eQualificationPolicy`, `m7wQualificationEvidence` | Invalid/unverified qualification passes, current M7V skip policy weakens, or selected evidence/provenance is contradicted | Node tests cover selected current policy and schemas. Most frozen M7 evaluator/provenance tests are omitted; automatic B2 qualification does not replace their Unit contracts. Keep them mandatory until each has an independent owner and reproducible route. |

The source/test owner map contains the complete selected file list and rationale; the table states plausible failures, runner needs, and evidence omitted by each owner. The manifest is a candidate inventory, not a dependency graph or a sufficient reduction argument.

## Contracts kept outside this Vitest candidate

The following coverage cannot be inferred from a passing candidate Vitest run:

- ordinary Chromium smoke and public frame delivery;
- production-preview WebGL-only isolation;
- rendered-pixel claims for physical image-circle coverage and Ground Glass visual output;
- native WebGPU, device-loss, and GPU-backed resource-lifecycle qualification;
- full E2E behavior and renderer-specific serial scenarios;
- complete historical M7E–M7R/M7W replay, source provenance, and artifact qualification;
- historical evaluator/provenance Unit tests outside the selected M7N/R/V/W set.

These remain covered by current GitHub checks, B2 change-triggered historical qualification, or explicit targeted qualification. A future GitHub regression reduction must preserve the independent browser, production-isolation, M7V, M7R, provenance, and historical-evaluator contracts through named checks. Static manifest or report verification cannot replace current application behavior.

## Candidate inclusion rules

1. One primary owner must name the observable contract and a plausible regression.
2. Fixed-reference optics and asymmetric coordinate values must remain independent of implementation-generated expectations.
3. E2E is retained for transport, public interaction, real frame delivery, or SPA lifecycle risks that Unit tests cannot observe.
4. A candidate pass does not establish mutation sensitivity; record a specific negative control for each critical contract family.
5. Historical evaluator tests stay mandatory until their contract is assigned to a trustworthy, automatic qualification route. Do not treat “historical” as “disposable.”
6. Changes to this manifest, the owner map, runner, test config, or package scripts require full local CI and review of affected historical qualification.

## Reduction decision

The candidate is not approved as a replacement for full GitHub Vitest. See [`CORE_REGRESSION_EVALUATION.md`](./CORE_REGRESSION_EVALUATION.md) for actual discovery counts, matched runtime, negative controls, and remaining review work. Until that report establishes preservation and independent review accepts the omissions, the readiness decision remains `NEEDS_REVIEW`.
