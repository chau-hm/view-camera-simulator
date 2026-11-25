# B5 Local CI Ownership Evidence

This record captures focused routing and mutation evidence for B5. It does not claim that the repository-wide source-to-test dependency graph is complete.

## Source identity and environment

- Implementation base: `cec404a84f9469bd21dbc3813c327f831c370e60` (`origin/main` at B5 start).
- Mutation-control source: `cec404a84f9469bd21dbc3813c327f831c370e60`, in disposable clone `/private/tmp/vcs-b5-mutation-20261125`.
- Runtime used for repository tests: Node `v24.3.0`, macOS arm64.
- Mutation controls used the checked-in tests at the source revision above. No mutation or archived evidence was retained in this branch.

## Controlled mutation results

| Contract | Temporary change | Test command | Result | Interpretation |
|---|---|---|---|---|
| Table Tilt camera mount | Changed the mounted camera's vertical placement from `toWorld(836)` to `toWorld(100)` in `src/render/table-tilt/TableTiltStudioFurnishings.ts`. | `npm run test -- --run src/tests/unit/tableTiltMountedVisibility.test.ts` | **Detected.** The mounted-visibility assertion failed because camera height no longer matched the mounted support. | Keep this direct test as an owner for mounted-camera support and visibility. |
| Table Tilt sideboard anchor | Changed the sideboard horizontal anchor from `centerX = -2160` to `centerX = 0` in `src/render/table-tilt/TableTiltStudioFurnishings.ts`. | `npm run test -- --run src/tests/unit/tableTiltMountedVisibility.test.ts` | **Survived.** The test passed despite the horizontal placement change. | There is no independent horizontal anchor proof in the current owner set. Table Tilt source ownership remains provisional; Affected mode falls back to full Vitest and reports `INCOMPLETE`. A separate geometry-reference test is needed before this owner can establish completion. |
| Ground Glass frame execution | Temporarily omitted restoration of `renderer.setRenderTarget(previousRenderTarget)` in `src/render/groundGlassFrameExecution.ts`. | `npm run test -- --run src/tests/unit/groundGlassFrameExecution.test.ts` | **Detected.** Five of seven tests failed on the missing render-target restoration. | Keep the direct frame-execution test in the renderer lifecycle owner. |

The disposable clone was restored to its source state and removed after these controls. The sideboard result is a surviving mutation and remains an explicit coverage gap; it is not treated as an acceptable test outcome.

## PR #371 review-fix: WebGPU owner routing

The review-fix begins from PR #371 head `bc7b664ea956ffe821129c68fea023d74ff325e2`. No application source, test implementation, GitHub workflow, deployment setting, B2 qualification rule, or Core Candidate owner ID is changed.

The prior broad complete `webgpu-lifecycle` pattern matched every `src/render/webgpu/**` file, so a B1 reference change could omit its direct test while appearing complete. The owner map now distinguishes:

| Source path | Owner and selected contract | Affected result / specialized proof |
|---|---|---|
| `src/render/webgpu/groundGlassB1Reference.ts` | `webgpu-b1-reference`: direct `groundGlassWebGpuB1Reference.test.ts` and the active M7E evaluator Unit consumer | Complete for the CPU reference contract; no E2E/native requirement is inferred locally. The B2 M7E replay-source route still automatically qualifies Evidence-sensitive changes to this file. |
| `src/render/webgpu/groundGlassWebGpuRuntime.ts` | `webgpu-runtime-classification`: direct runtime-classification Unit test | Complete for the pure classification helper; this is not native browser proof. |
| `src/render/webgpu/groundGlassWebGpuDiagnostics.ts` | `webgpu-diagnostic-attribution`: direct diagnostic Unit tests | Complete for the diagnostic helper contract only. |
| `src/render/webgpu/GroundGlassWebGPUAdapter.tsx` | `webgpu-lifecycle`: existing adapter/runtime Unit set and native failure-host spec | Provisional; full Vitest fallback, required browser evidence, and native WebGPU qualification remain separate. |
| `src/render/webgpu/groundGlassWebGpuTestSeam.ts` | `webgpu-test-seam`: direct recovery-action Unit test and native failure-host spec | Provisional; its many capture and synchronization controls are not all covered by that Unit test. Native lifecycle evidence remains required. |
| Other `src/render/webgpu/**` paths | `webgpu-source-supplement` plus the broad renderer supplement | Provisional-only; full Vitest runs, but Affected stays `INCOMPLETE`. The broad supplement adds no native GPU requirement to CPU/reference-only changes. |
| `src/render/webgpu/groundGlassM7eGatherB1Evidence.ts` | `historical-active-unit-contracts` plus broad provisional supplements | Active M7 Unit contracts remain selected. Frozen evidence replay/provenance still belongs to B2's separate automatic qualification route. |

The `webgpu-lifecycle` test list remains unchanged because its owner ID is part of the non-authoritative Core Regression shadow manifest. No `coreRegressionOwnerIds` or candidate test selection was changed. Its source match is now limited to the actual adapter file and its coverage is explicitly provisional.

The B1 owner reuses PR #366's existing controlled mutation evidence: replacing accepted far-gather output with source color was caught by the omitted B1 test (4 failures among 17 cases) while the 48-file/611-case Core Candidate passed. This review-fix does not rerun or alter that historical mutation result.

`src/tests/unit/localCiContracts.test.ts` now checks the checked-in manifest for the B1 direct route, an unknown WebGPU path, the pure runtime helper, adapter and seam native requirements, active M7 ownership, and a mixed change set. Bounded Local CI fixtures also inspect actual JSON reports: B1 direct ownership can pass without native GPU scheduling, while an unknown WebGPU path remains incomplete after the full Vitest fallback reports success. These fake runner fixtures verify routing/report semantics; they are not implementation, browser, or GPU evidence.

No matched runtime/cost comparison or new mutation experiment was made in this review-fix. The WebGPU source-to-test map remains intentionally partial; all paths not named above either match another reviewed owner or remain provisional/unknown until independently mapped.

### Review-fix validation record

Validation ran on the working tree based at `bc7b664ea956ffe821129c68fea023d74ff325e2`, with Node `v24.3.0`, macOS arm64, Vitest `3.2.7`, and source-state fingerprint `f82c6ebbcab980dbadcdb951b09d8d7c6903b294a7f28795ebc23d5236bc8d57` for the four review-fix files at the time of the run.

| Check | Result |
|---|---|
| `npm run test -- --run src/tests/unit/localCiContracts.test.ts` | **PASS**, 50/50 tests after final owner metadata and assertion updates, including the isolated B1 and unknown-WebGPU emitted-report cases. |
| Focused B1/M7E/runtime/diagnostics/seam plus Table Tilt, renderer, M7 routing/provenance tests | **PASS**, 13 files / 260 tests. M7K capture-source and M7M exact-source tests passed. |
| CSS structure check | **PASS** within `npm run ci:local`. |
| ESLint and TypeScript typecheck | **PASS** within `npm run ci:local`, then rerun after final owner metadata and assertion updates. |
| Full `npm run ci:local` Vitest step | **FAIL at process level** after 67.819 seconds: 354 files and 4,405 cases were discovered; all 4,405 passed, but Vitest reported one unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"` error while the M7M replay case was running. The step exited 1 despite a successful case JSON report. This is recorded as unresolved test-process instability, not a passing full Local CI run. |
| `npm run build` | **PASS** when run separately after Local CI stopped at the Vitest error. |
| Native WebGPU and Playwright E2E | **NOT_RUN** locally; this owner-routing correction did not require a full GPU or browser matrix. |

The M7K/M7M focused tests passed independently, but they do not erase the full-suite process error. No retry was used to turn that failed invocation into a PASS. GitHub PR CI remains the independent validation after the review-fix commit is published.

## Active historical-contract evidence

The following focused command passed at the implementation source after dependencies were available:

```sh
npm run test -- --run \
  src/tests/unit/historicalEvidenceRouting.test.ts \
  src/tests/unit/m7kCaptureWorkflow.test.ts \
  src/tests/unit/groundGlassM7mSceneReadiness.test.ts
```

These tests include active routing and exact-source/provenance rejection behavior. They are current Unit contracts and are distinct from B2 archived replay qualification. The B5 owner manifest routes evaluator/normalizer/routing/source-fetch changes to these active tests and the maintained M7 Unit contract set.

## Routing regression evidence

`src/tests/unit/localCiContracts.test.ts` uses the checked-in `scripts/local-ci/owners.json` and executes bounded Local CI runs in isolated temporary Git repositories with controlled Vitest and Playwright report producers. This verifies the emitted JSON fields for selected owners, provisional fallback, browser requirements, status, and `completeForRequestedScope`. It does not substitute fake runner output for the camera-mount or frame-execution mutation controls above.
