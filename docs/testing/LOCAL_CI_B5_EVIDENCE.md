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

## Review-fix Round 2 — historical M7 ownership

This correction starts from reviewed PR head `6f62416fe6305915836088957890ce11bfd7f902`. It does not change the B5 selection algorithm, B2 workflow, active historical validators, GitHub test coverage, or Core Regression candidate.

The broad `historical-active-unit-contracts` owner is now explicitly `coverage: "provisional"`. It still adds the maintained M7 Unit test set for every matching path, but a family prefix alone cannot mark new source complete. The selector treats a provisional-only path as a full-Vitest fallback and retains `INCOMPLETE` even when the fallback runner passes.

| Changed source | Direct owner and evidence | Affected classification |
|---|---|---|
| `src/render/webgpu/groundGlassM7zNewEvidence.ts` | Broad historical, WebGPU, and renderer supplements; no direct owner identified | Full Vitest; provisional path; `INCOMPLETE` |
| `src/render/testing/groundGlassM7zNewEvaluator.ts` | Broad historical and renderer supplements; no direct owner identified | Full Vitest; provisional path; `INCOMPLETE` |
| `scripts/evaluateM7zNewEvaluator.ts` | Broad historical and shared-script supplements; no direct owner identified | Full Local CI including full Vitest; provisional path; `INCOMPLETE` |
| `scripts/normalizeM7zNewCapture.mjs` | Broad historical and shared-script supplements; no direct owner identified | Full Local CI including full Vitest; provisional path; `INCOMPLETE` |
| `src/render/webgpu/groundGlassM7eGatherB1Evidence.ts` | Exact `historical-m7e-gather-b1-evidence` owner and direct `groundGlassM7eGatherB1Evidence.test.ts` | Complete for the active Unit contract; B2 replay remains separate |
| `scripts/evaluateM7mSceneReadiness.ts`, `src/render/testing/groundGlassM7mSceneReadiness.ts` | Exact `historical-m7m-scene-readiness` owner and direct evaluator/CLI test | Complete for the active M7M evaluator contract; full Local CI runs |
| `scripts/evaluateM7nRendererLifecycle.ts` | Exact evaluator owner and direct `m7nRendererLifecycleEvidence.test.ts` | Complete for the active evaluator Unit contract |
| `src/render/testing/m7nRendererLifecycleTrace.ts` | Exact trace owner and direct `m7nRendererLifecycleTrace.test.ts` | Complete for the trace-buffer Unit contract; not browser lifecycle proof |
| `scripts/historical-evidence-routing.mjs` | Exact routing owner and direct `historicalEvidenceRouting.test.ts` | Complete for active routing Unit behavior; full Local CI and B2 checks remain separate |
| `scripts/fetch-m7k-execution-source.mjs` | Existing exact `evidence-and-ci-policy` owner and `m7kCaptureWorkflow.test.ts` | Complete for exact-source fetch contract; archive replay remains separate |
| `scripts/normalizeM7nRendererLifecycleCapture.mjs` | Exact provisional owner and `m7nRendererLifecycleEvidence.test.ts` | Full Local CI fallback; `INCOMPLETE` because current normalization proof covers only sanitized failure paths and unavailable trace behavior |

The complete classifications above are bounded to the named active Unit contracts. The broad historical owner continues to select additional tests additively. In particular, exact active evaluator ownership does not claim that frozen artifacts were replayed, exact archive SHAs and tree entries were revalidated, or a current browser/GPU scenario ran. Those remain separate B2 and specialized qualification responsibilities. Changes to unlisted M7 families, generic replay/runner scripts, declarations, or shared dependencies remain provisional until their direct impact is reviewed.

`src/tests/unit/localCiContracts.test.ts` now exercises the actual checked-in manifest for all four unknown M7 examples, the reviewed M7E/M7M/M7N evaluator/trace/routing/fetch routes, the deliberately provisional M7N normalizer, and a mixed B1 + M7M + unknown-M7 change. Its bounded runner fixtures inspect emitted JSON rather than only selection-helper results:

| Fixture | Emitted report evidence |
|---|---|
| Unknown M7 WebGPU implementation | `status: INCOMPLETE`, exit `2`, `completeForRequestedScope: false`, the changed file in `execution.changedFiles`, broad owners/reasons in `execution.owners` and `execution.selectionReasons`, `fallback.kind: full-vitest`, and a passing full Vitest step. |
| Reviewed M7M evaluator | `status: PASS`, `completeForRequestedScope: true`, direct and broad owners present, no fallback, `repositoryCoverage: full-local-ci`, and a passing full-Vitest report containing the direct M7M test. |
| Mixed B1 reference + M7M evaluator + unknown M7 WebGPU implementation | All direct owners/reasons remain in the report, the unknown source is in `fallback.provisionalPaths`, the full local steps pass, and the overall result remains `INCOMPLETE` with `completeForRequestedScope: false`. |

These execution fixtures verify Local CI routing and report semantics using controlled fake runner output. They do not claim that the application, archived report, browser, or GPU behavior was executed by the fixture.

### Round 2 local validation

The recorded full Local CI run used the Round 2 working tree at commit `6f62416fe6305915836088957890ce11bfd7f902`, Node `v24.3.0`, npm `11.12.0`, macOS arm64, Vitest `3.2.7`, Playwright `1.61.1`, ESLint `9.39.5`, TypeScript `6.0.2`, and Vite `8.1.4`. The report recorded the worktree as dirty and stable during the run; its source-state fingerprint was `1aabe030d13af20f9ee068c9f669b72faa7c0bdce7222610acc5fc38b3fc498d`. Afterward, only this evidence document's validation/CI prose changed; the owner manifest and test code remained identical to the tested versions.

| Check | Result |
|---|---|
| `npm run test -- --run src/tests/unit/localCiContracts.test.ts` | **PASS**, 55/55 tests. Includes actual affected-runner JSON checks for unknown M7, reviewed M7M, and mixed known/unknown M7 changes. |
| Focused B1/M7E/M7M/M7N/routing/M7K/Table Tilt/frame/RTT suite | **PASS**, 13 files / 293 tests. The M7M isolated shallow-checkout replay test passed; the exact-source fetch tests passed. |
| `npm run ci:local` | **PASS**, all five steps; full Vitest discovered 354 files / 4,410 cases, all passed. CSS structure, ESLint, TypeScript, and production build also passed. Vitest took 43.880 s; total Local CI took 71.677 s. |
| Local ordinary Chromium, Production Preview, native WebGPU | **NOT_RUN** for this round. The change only alters affected ownership, and its emitted-report contract is verified by controlled runner fixtures; GitHub CI remains the independent application/browser merge gate. |
| GitHub PR validation | Round 2 authoritative synthetic-merge run [45728760633](https://github.com/chau-hm/view-camera-simulator/actions/runs/45728760633) passed on head `53e43527cb5d86a3386dea09a2abe0dff3035776`, merged for validation with `main` at `7c98b031f289953ac5c638d1973fbe8d7455fe57`. The prior #371 PR failure remains recorded below as historical evidence and was not treated as passed based on feature-push validation. |

### Separate PR merge-context CI investigation

The inherited failure evidence is tied to PR head `6f62416fe6305915836088957890ce11bfd7f902`. At the time of the failed authoritative run, PR metadata still listed base `9e5a71bee8e024a480acf17bb18763f3ef783039`; the actual synthetic merge checkout was `ea875a6f885ea8f14f1f33f35bc0b350bab43bbd`, combining feature head `6f62416...` with main `e96d0aec06a4d530c1dba1a25a8f41daacf111d7`.

The PR change list contained the B5 documentation, owner manifest, Local CI selector/runner, and Local CI contract test; it did not change Free Mode production or test files. On the synthetic merge context, required PR run [45653654754](https://github.com/chau-hm/view-camera-simulator/actions/runs/45653654754) failed in `freeModeSeededMaterialsWave1.test.tsx` with two expected-signature mismatches and one five-second timeout; browser/evidence jobs were skipped. The main baseline run [45646165849](https://github.com/chau-hm/view-camera-simulator/actions/runs/45646165849) at `e96d0...` showed the same Free Mode failures plus a Scene Subject Registry timeout. The successful feature-push run [45653638200](https://github.com/chau-hm/view-camera-simulator/actions/runs/45653638200) was not equivalent to the authoritative PR check.

The mainline issue was subsequently addressed independently by merged PR [#374](https://github.com/chau-hm/view-camera-simulator/pull/374), which restored seeded-material fixture/reference inputs and split grouped seed work without changing production code or increasing timeouts. Its exact-head Actions run [45668270725](https://github.com/chau-hm/view-camera-simulator/actions/runs/45668270725) passed. Current `main` at Round 2 validation was `7c98b031f289953ac5c638d1973fbe8d7455fe57`; its CI run [45725028209](https://github.com/chau-hm/view-camera-simulator/actions/runs/45725028209) passed (`ci` success, deploy skipped). The refreshed authoritative PR run [45728760633](https://github.com/chau-hm/view-camera-simulator/actions/runs/45728760633) then passed on the Round 2 head `53e43527cb5d86a3386dea09a2abe0dff3035776`, using synthetic merge commit `9fbf30f93f688156780e5e73a2c5d6b63e3243e5` against `main` at `7c98b031f289953ac5c638d1973fbe8d7455fe57`. The `ci` job passed all retained source-history fetches, lint, type-check, Unit/Integration, ordinary Chromium smoke, production-preview WebGL isolation, M7R evidence integrity, and M7V policy/skip governance. The separate historical qualification decision passed; deployment was skipped because this was a PR event. This new authoritative result resolves the prior merge-context blocker for the tested head and base; it does not erase the original failure evidence or make a feature-push run a substitute for PR validation.
