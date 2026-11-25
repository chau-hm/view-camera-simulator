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
