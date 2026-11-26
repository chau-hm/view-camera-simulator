# CI Runtime Profile

## Source identity and environment

The implementation base and exact-source GitHub baseline are both `879a50f9607bed848de02a7c358b8b9e2501d1a2` (`origin/main`, fetched for B6). Local measurements have two source states; the diff digest below applies only to the post-change measurements, not to the clean-base baselines.

| Local evidence | Source state |
|---|---|
| Original Production Preview baseline, ordinary Chromium smoke baseline, initial typecheck/build measurements, and Vitest worker matrix | Clean checkout at `879a50f9607bed848de02a7c358b8b9e2501d1a2` |
| Post-change standalone Preview, both CI-path Preview runs, build-output equivalence, post-change typecheck/lint, and Preview failure-propagation control | Base commit plus the B6 implementation diff in `.github/workflows/pages.yml`, `package.json`, and `playwright.production.config.ts`; diff SHA-256 `370f0a3b8ca88f6fbd96379d6f77ca6ef856ead6d8671579ebd468af7f3863f4` |
| M7V before/after exact-SHA controls | Two isolated depth-50 checkouts of the same clean base SHA; one lacked the pinned source object and one ran the existing fetch before the test |

No application or test source was changed. The local A/B used the same post-change source state, lockfile, Node version, browser, worker count, Playwright project, and `VITE_BASE_PATH=/`. GitHub and local durations are reported separately and are not treated as equivalent environments.

| Environment | Value |
|---|---|
| Local host | macOS arm64; 14 available logical processors |
| Node / npm | Node 24.3.0 / npm 11.12.0 |
| Vitest / Vite / Playwright | 3.2.7 / 8.1.4 / 1.61.1 |
| Browser | Chromium 149.0.7827.55 (Playwright browser revision 1228) |
| GitHub host | Ubuntu 26.04, image `ubuntu-26.04` version `20261116.202.1`; Node 24.22.3 |
| GitHub billing data | `NOT_MEASURED` |

## Mandatory GitHub path at the baseline

The authoritative `ci` job remains the same stable job and validation path. It performs the historical qualification gate and exact-source fetches, Node 24 setup, `npm ci`, Chromium installation, lint, typecheck, full `npm run test`, ordinary Chromium smoke, Production Preview, M7R integrity, and M7V policy/skip governance. Production deployment remains a separate job gated by successful `ci` and a push to `production`.

The current exact-base run is [GitHub Actions run 45813283621](https://github.com/chau-hm/view-camera-simulator/actions/runs/45813283621). It used the exact baseline SHA above. The workflow lasted 20m09s from creation to completion; the `ci` job ran 7m24s after queueing. Those wall-clock figures include scheduling and are not billed runner minutes.

| CI stage | Elapsed | Result / evidence |
|---|---:|---|
| Checkout | 7s | Passed; fetch depth 50 |
| Retained historical source fetches | 0–2s per recorded fetch step | Passed; cumulative aggregate `NOT_MEASURED` |
| `npm ci` | 55s | Passed |
| Chromium installation | 20s | Passed; browser 149.0.7827.55 |
| ESLint | 20s | Passed |
| TypeScript check | 25s | Passed |
| Full Vitest | 306s step; 304.67s runner summary | Failed as described below |
| Ordinary Chromium smoke | `NOT_MEASURED` | Skipped after Vitest failure |
| Production Preview | `NOT_MEASURED` | Skipped after Vitest failure |
| M7R / M7V final checks | `NOT_MEASURED` | Skipped after Vitest failure |
| Whole `ci` job | 7m24s | Failed |
| Workflow create-to-completion | 20m09s | Includes queue delay; not runner usage |

Vitest discovered 357 files and 4,470 cases: 4,459 passed and 11 failed in `m7vE2eQualificationPolicy.test.ts`. Each failure reported `m7v-source-policy-baseline-file-unavailable` for the reviewed source tree at `6e236d2ef4f248bfd3ad081d8d1786a7c0f8f382`. The pinned-source fetch was originally after Vitest, so the depth-50 checkout could not satisfy this active Unit contract. This is an observed CI failure, not a runtime estimate.

The ordering change was checked in isolated depth-50 checkouts of the same baseline. Before the exact-SHA fetch, the M7V Unit file had 11 failures and 20 passes. After running the existing fetch command with the same SHA and three path verifications, all 31 tests passed, and `npm run evidence:check:m7v` passed. The fetch, SHA, paths, policy, and qualification command are unchanged; only the fetch now precedes full Vitest.

For context only, [successful run 45731018804](https://github.com/chau-hm/view-camera-simulator/actions/runs/45731018804) is from a different source revision (`5d837274f50986e366f1d6de00ee46c2538c008d`) and is not a matched comparison. It recorded full Vitest at 326s (357 files / 4,469 cases), ordinary smoke at about 136s, Production Preview at about 462s, and the `ci` job at 17m53s. Runner-minute billing remains `NOT_MEASURED`.

## B6 hosted validation samples

[Implementation-head PR run 45821749289](https://github.com/chau-hm/view-camera-simulator/actions/runs/45821749289) validated head `dc750f922752d2a4a574affd4721b675ca41da99` against base `879a50f9607bed848de02a7c358b8b9e2501d1a2`; GitHub used synthetic merge checkout `ba650da8447a3404d06510a3f956dfed9c5eac61`. The run and authoritative `ci` job both succeeded. The Production Preview step used `VCS_PREVIEW_TYPECHECK_PASSED=1` after the mandatory typecheck.

| Hosted stage | Elapsed | Result |
|---|---:|---|
| Historical qualification decision | 5m25s evaluator step; 5m38s job | Passed; shared CI/package changes selected the required historical lane |
| Main `ci` job | 10m04s | Passed |
| `npm ci` | 37s | Passed |
| Chromium installation | 17s | Passed |
| ESLint | 18s | Passed |
| TypeScript check | 19s | Passed |
| M7V exact-source fetch | <1s | Passed; exact SHA and all three paths verified before Vitest |
| Full Vitest | 228s step; 226.98s runner duration | 357 files / 4,470 cases passed |
| Ordinary Chromium smoke | 65s | 2/2 passed |
| Production Preview | 194s | 4/4 passed |
| M7R integrity | <1s | Passed; complete execution integrity, archived qualification remains `not-qualified` |
| M7V policy | 4s | Passed |
| Workflow create-to-completion | 15m53s | Includes the historical decision job; not runner usage |

The historical decision, full suite, ordinary smoke, Preview, M7R and M7V all ran on this PR event; none of those results is inferred from the feature-push run. The Production Preview step was 194s in this sample. A matched hosted run of the same source with the original checked build is unavailable, so hosted time saved remains `NOT_MEASURED`.

[Final documentation-head run 45824795513](https://github.com/chau-hm/view-camera-simulator/actions/runs/45824795513) validated head `56b18ae5d21378ea567752a0cf4c50c8c356b241` against the same base; the synthetic merge checkout was `9722649106ff9337a7cdf3c050e38e10c94935a0`. The diff from the previous run was documentation-only; workflow, application, and test code were unchanged.

| Hosted stage | Elapsed | Result |
|---|---:|---|
| Historical qualification decision | 4m34s job | Passed |
| Main `ci` job | 18m28s | Passed |
| `npm ci` | 54s | Passed |
| Chromium installation | 19s | Passed |
| ESLint | 22s | Passed |
| TypeScript check | 28s | Passed |
| M7V exact-source fetch | <1s | Passed before Vitest |
| Full Vitest | 344s step; 343.52s runner duration | 357 files / 4,470 cases passed |
| Ordinary Chromium smoke | 145s | 2/2 passed |
| Production Preview | 468s | 4/4 passed with the CI-selected build path |
| M7R integrity | <1s | Passed; execution integrity complete, archived qualification remains `not-qualified` |
| M7V policy | 5s | Passed |
| Workflow create-to-completion | 23m14s | Includes historical qualification; not runner usage |

The 194s and 468s Preview durations, and 65s and 145s smoke durations, are two hosted samples with identical workflow/test code but different runs. This shows substantial run-to-run timing variation. The hosted logs do not separate Preview build, server startup, browser, rendering, screenshot, and teardown phases for the slower sample. Do not attribute the difference between those samples to the TypeScript-build change. The older 462s Preview run is another revision and also cannot establish a reduction. Hosted time saved, aggregate runner minutes, and billed cost remain `NOT_MEASURED`.

## Production Preview profile

The existing standalone path is `npm run build && npm run preview -- --host 127.0.0.1 --port 4175`. `npm run build` runs `tsc -b && vite build`; the mandatory CI typecheck already ran before the Production Preview step. Both preview builds inherit `VITE_BASE_PATH=/` from `playwright.production.config.ts` and use Vite's default production mode.

| Local measurement, exact source and environment | Elapsed |
|---|---:|
| `npm run typecheck` | 10.70s |
| Checked `npm run build` | 10.82s |
| `vite build` after the same-source typecheck | 0.33s |
| Original full Production Preview baseline | 59.07s real; 58.65s Playwright |
| Standalone checked path after the change, all 4 cases | 59.81s real; 59.40s Playwright |
| CI-selected bundle-only path, run 1, all 4 cases | 49.08s real; 48.73s Playwright |
| CI-selected bundle-only path, run 2, all 4 cases | 50.34s real; 49.98s Playwright |

The two production builds generated identical SHA-256 manifests for all 58 files under `dist` when run with the same source and `VITE_BASE_PATH=/`. Vite transformed 792 modules in each comparison. The checked build reported Vite bundling at 286ms; the bundle-only run reported 237ms. The measured local wall-time difference is 9.5–10.7s per preview invocation (about 16–18% of this local step). This is a local macOS result; hosted-runner savings and billed cost are `NOT_MEASURED`.

All four real browser tests passed in each of the original baseline, post-change standalone, and two CI-path runs, with zero skips, failures, or flakes. The first Architecture Rise case retained Observer and Ground Glass screenshots plus production bundle-isolation JSON. The Anatomy denial case retained its screenshot and WebGPU-denial JSON. The individual Playwright test durations were similar between paths (roughly 16s, 9.2–9.8s, 9.3–9.9s, and 11.5–12.3s); the reduction came from setup before the browser test cases, consistent with skipping the repeated TypeScript build.

| Production Preview phase | Evidence |
|---|---|
| TypeScript validation | Separately measured at 10.70s; mandatory typecheck remains before the CI browser step |
| Vite production bundling | Full checked build 10.82s including TypeScript; Vite-only 0.33s after typecheck |
| Preview readiness, browser launch/context, Observer frame, Ground Glass RTT frame, pixel analysis, bundle inspection, teardown | Individual phase durations `NOT_MEASURED`; covered by real passing browser tests and per-test Playwright durations |
| Screenshots and isolation artifacts | Present in all runs; names listed in Playwright JSON reports |
| Failure propagation | A temporary fake `npm` returned 23 for the preview build; Playwright exited 1 with “Process from config.webServer was not able to start. Exit code: 23”. No browser test was reported as passing |

The optimized command is only selected by the Production Preview workflow step after the mandatory CI typecheck has passed. The ordinary standalone command, when run without `VCS_PREVIEW_TYPECHECK_PASSED=1`, still uses the fully checked `npm run build` path and passed all four cases.

## Ordinary Chromium smoke

The exact-source local baseline used the existing `smoke.spec.ts` with the ordinary Chromium project, one worker, and the normal Vite development server. It passed both tests in 16.26s real / 15.91s Playwright time. Home startup took 640ms; Architecture Rise navigation, WebGL execution, contentful Ground Glass frame, Raw/Upright interaction, and focus loupe assertions took 14.26s. Server startup, browser launch, and teardown were not separately instrumented. The B6 change does not alter this command or its test.

The prior successful hosted run measured this step at about 136s, but that was a different revision and is not a matched comparison. The exact-base hosted run skipped it, so current hosted smoke duration is `NOT_MEASURED`.

## Full Vitest and worker experiment

The full local suite discovered 357 files and 4,470 cases at the exact B6 base. `vitest.config.ts` does not set worker count. On this 14-processor Mac, Vitest's default selected 13 workers.

| Local run | Vitest duration | Process real time | Cases | Process outcome |
|---|---:|---:|---:|---|
| Default, 13 workers | 66.71s | 67.42s | 357 files; 4,470 reporter cases passed | **Exit 1**: unhandled `[vitest-worker]: Timeout calling "onTaskUpdate"` after reporter cases passed; not a successful run |
| 4 workers | 115.74s | 116.17s | 357 files; 4,470 passed | Exit 0 |
| 2 workers | 183.04s | 183.38s | 357 files; 4,470 passed | Exit 0 |

A first 2-worker measurement reported passing cases but the `/usr/bin/time -l` wrapper itself exited on a macOS `sysctl kern.clockrate` permission error; it is excluded as a valid process measurement. Memory use is `NOT_MEASURED`. These are single valid samples per worker setting, not enough to characterize variance. The local results do not justify changing hosted worker settings; the GitHub-runner effective worker count is `NOT_MEASURED`.

The exact-base hosted Vitest failure was the M7V source-baseline issue, not the local worker RPC timeout. Keep these failures separately attributed.

## Source references

- Workflow and deployment gates: [`.github/workflows/pages.yml`](../../.github/workflows/pages.yml)
- Production build and preview configuration: [`package.json`](../../package.json), [`vite.config.ts`](../../vite.config.ts), [`playwright.production.config.ts`](../../playwright.production.config.ts)
- Browser contracts: [`smoke.spec.ts`](../../src/tests/e2e/smoke.spec.ts), [`architecture-rise-webgpu-production.spec.ts`](../../src/tests/e2e/architecture-rise-webgpu-production.spec.ts)
- Full test command and default worker configuration: [`scripts/test.mjs`](../../scripts/test.mjs), [`vitest.config.ts`](../../vitest.config.ts)
- Exact-source fetch implementation: [`fetch-m7k-execution-source.mjs`](../../scripts/fetch-m7k-execution-source.mjs)

## Cost boundaries and limitations

- Workflow wall time, job wall time, step wall time, and test-runner duration are separate measures above.
- Aggregate GitHub runner usage and billed cost are `NOT_MEASURED`; no cost is inferred from elapsed time.
- Hosted Production Preview and smoke timing at the exact baseline are unavailable because the earlier Vitest failure skipped those steps.
- The historic successful GH run is a separate revision, not a matched baseline.
- Browser launch, server readiness, frame readiness, pixel-analysis, and teardown are not independently timed. Do not infer those phase durations from a test timeout.
- No full Playwright matrix, native WebGPU qualification, deployment, or production promotion was run for this profile.
