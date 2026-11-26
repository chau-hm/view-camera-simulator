# CI Runtime Optimization Decision

## Decision summary

Keep full GitHub Vitest, ordinary Chromium smoke, all four Production Preview cases, M7R/M7V checks, B1/B2 routing, the authoritative `ci` identity, and the production deployment condition unchanged. Accept one bounded Production Preview build-preparation optimization: the GitHub preview step can reuse the already completed TypeScript validation and run the identical Vite production bundle without running `tsc -b` a second time.

The local matched comparison showed identical output hashes and four passing real browser tests on both paths, with a repeatable 9.5–10.7s reduction per preview invocation on macOS arm64. Hosted-runner time saved and billed-cost effects remain `NOT_MEASURED`; verify the current-head GitHub result before treating this as a hosted optimization measurement.

The same-source GitHub baseline exposed an M7V ordering failure. Move the existing exact-source fetch before full Vitest so its current Unit tests can resolve the pinned source in the depth-50 checkout. This preserves the source SHA, paths, assertions, policy, and later M7V qualification command.

## Candidate decisions

| Candidate | Decision | Evidence and scope |
|---|---|---|
| Skip duplicate TypeScript build in CI Production Preview | `ACCEPTED` | After mandatory `npm run typecheck`, use `vite build` for the preview server. Same 58-file output manifest, same Vite production mode and `/` base path, all four browser cases passed in two CI-path runs, and forced build failure propagated to Playwright exit 1. Local real-time change was 59.81s standalone to 49.08s / 50.34s optimized. GitHub-hosted savings remain `NOT_MEASURED`. |
| Keep checked standalone Production Preview build | `ACCEPTED` | With no CI marker set, the public standalone config still runs `npm run build`; all four cases passed at 59.81s. It remains independently usable and still type-checks. |
| Fetch M7V reviewed source baseline before full Vitest | `ACCEPTED` | Exact-base GH run failed 11/31 M7V Unit declarations because the pinned tree was unavailable. In an isolated depth-50 checkout, 11 failed without the fetch and all 31 passed after the existing exact-SHA fetch; `evidence:check:m7v` also passed. No source/provenance requirement or qualification logic changed. |
| Change Vitest worker count | `REJECTED` for this PR | Local 2-worker and 4-worker runs passed but were slower than the 13-worker reporter duration. The default process exited 1 from a worker RPC timeout after all reporter cases passed. Single samples, Mac-only behavior, and unknown hosted worker count do not support a CI setting change. Keep the existing full suite and worker configuration. |
| Split browser checks into parallel jobs | `NOT_TESTED` | Would add job startup and duplicate dependency/browser preparation; no matched aggregate runner-time evidence or need to change Required Check identity. |
| Add dependency/browser cache behavior | `NOT_TESTED` | Hosted `npm ci` and Chromium install are measured at 55s and 20s on one failed exact-base run; cache hit/miss behavior and invalidation were not profiled. No speculative cache added. |
| Change ordinary Chromium smoke | `NOT_TESTED` | Local smoke passed in 16.26s with both current contracts. This PR does not change the command, startup path, browser lifecycle, waits, or assertions. Hosted exact-base timing is unavailable because the test was skipped. |
| Optimize individual Production Preview browser assertions or share browser/GPU state | `REJECTED` for this PR | The four cases provide distinct runtime isolation/denial evidence. Per-test durations are similar across A/B; no assertion, test count, context isolation, screenshots, or real pixel observation was removed. |

## Accepted Production Preview implementation

The mandatory CI job still runs `npm run typecheck` before the browser checks. The Production Preview step alone sets `VCS_PREVIEW_TYPECHECK_PASSED=1`; the Playwright config then invokes `npm run build:production-preview:after-typecheck` (`vite build`) before the same preview server. The config still forces `VITE_BASE_PATH=/`, and Vite remains in its default production mode.

The standalone invocation has no such marker and continues to invoke `npm run build` (`tsc -b && vite build`). A forced preview-build command failure was observed to exit Playwright nonzero before any browser result could be reported. No stale `dist` artifact is reused: each path rebuilds it in the same CI job from the checked-out source, with the same build mode and environment.

**Rollback:** remove the `VCS_PREVIEW_TYPECHECK_PASSED` environment entry from the Production Preview step, remove the `build:production-preview:after-typecheck` package script and config selection, and restore the config's server command to `npm run build && npm run preview -- --host 127.0.0.1 --port 4175`. Preserve the M7V source fetch before `npm run test`; reverting that ordering would restore the observed Unit-test failure.

The implementation is in [`pages.yml`](../../.github/workflows/pages.yml), [`package.json`](../../package.json), and [`playwright.production.config.ts`](../../playwright.production.config.ts). The preserved browser proof is in [`architecture-rise-webgpu-production.spec.ts`](../../src/tests/e2e/architecture-rise-webgpu-production.spec.ts).

## Preservation checks

- `npm run test` remains the full mandatory GitHub suite; no files or cases are filtered.
- Ordinary Chromium retains both smoke cases and real WebGL/Ground Glass content, Raw/Upright interaction, and focus-loupe checks.
- Production Preview retains all four tests, bundle/module isolation checks, real WebGL/RTT observation, screenshot/pixel evidence, and WebGPU denial checks.
- M7R and M7V checks remain in the same authoritative job. M7V's reviewed SHA, verified source paths, evaluator, and qualification command are unchanged.
- B1 exact-head routing, B2 historical qualification gates, stable `ci` identity, concurrency, and `deploy` condition were not changed.
- `deploy` remains dependent on successful `ci` and restricted to `push` on `production`.
- Local Preview failure injection (build command exit 23) produced Playwright exit 1, not a green result.

## Follow-up evidence required

The current-head GitHub run must show that the exact-source fetch occurs before full Vitest, the full suite reaches 357-file discovery, ordinary smoke and all four Production Preview tests execute, and M7R/M7V complete. Capture hosted step durations then. Do not call the local 9.5–10.7s saving a hosted-runner saving, and do not infer billed cost.
