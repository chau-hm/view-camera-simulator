# M7K — Controlled Broad E2E Qualification Baseline

## Decision

M7K captured a complete two-lane application regression baseline from the accepted PR #308 merge source. Evidence integrity passed, and all 278 discovered identities reconcile exactly once across the ordinary and renderer-serial lanes. Broad E2E is **not qualified**: the ordinary lane had 82 unexpected outcomes and 75 skips. No skipped test was accepted as an exclusion.

This is a complete, reviewable failing baseline. It is not a passing 278-test run and does not qualify native WebGPU.

## Source and environment

| Item | Value |
|---|---|
| Base / execution source | `e6066a244510387c32995c1e973a771667b04d10` |
| Required PR #308 ancestor | `e6066a244510387c32995c1e973a771667b04d10` |
| M7J retained candidate capture | `17a2616b151aa50ad34b2d137eee0a43c5759ad3` |
| M7K evaluator source commit | `0bef49c208030de8870262ef64895934ff215666` |
| OS / architecture | macOS / arm64 |
| Node / npm | 24.3.0 / 11.12.0 |
| Playwright / Chromium | 1.61.1 / 149.0.7827.55 |
| Three.js | 0.187.0; raw Observer runtime reports revision 187 |
| Browser mode / renderer | Headless Chromium / WebGL2 fallback with SwiftShader software rendering |
| Viewport / device profile | Playwright `Desktop Chrome`: 1280 × 720, device scale factor 1 |
| Launch flags / timeouts | Playwright default headless Chromium launch flags; no custom launch arguments; 30 s default test timeout and 120 s Vite startup timeout, with test-authored overrides unchanged |
| Workers / retries | Ordinary: 4 actual workers; serial: 1 actual worker; 0 retries in both |
| Native WebGPU / test seam | Not required; disabled for this capture |
| Production-preview tests | Excluded from this development inventory |

The accepted capture is attributed to the pinned execution source above. The original one-worktree description was not reproducible: that source predates the M7K runner and evaluator. Review-Fix Round 1 separates current M7K tooling from an isolated execution worktree pinned to this source. It preserves ports 4471 and 4472, and binds browser and Three.js claims to measured runtime evidence.

The Vite command is `npm run dev -- --host 127.0.0.1 --port <4471|4472> --strictPort`; `VITE_BASE_PATH=/`, the raw WebGPU pilot, test seam, physical CoC, gather, M6 presentation, and M6 qualification flags are false. Native-required and research-only environment switches are cleared by the runner.

Discovery ran independently:

```bash
npm run test:e2e -- --project=chromium --workers=4 --list
npm run test:e2e -- --project=chromium-renderer-serial --no-deps --workers=1 --list
```

The original report documented this one-worktree invocation:

```bash
PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH \
npm run e2e:run:m7k -- \
  --output-dir=docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187
```

Review-Fix Round 1 confirmed that this documented invocation could not work: the pinned execution commit predates the runner and the runner required its own source to be at that commit. The accepted raw capture predates the runner commit. The reproducible two-worktree command is documented in the review-fix section below; no full capture was repeated during this round.

The exact test commands were:

```bash
PLAYWRIGHT_WEB_SERVER_PORT=4471 \
PLAYWRIGHT_JSON_OUTPUT_NAME=<absolute-path>/ordinary-playwright.json \
npm run test:e2e -- --project=chromium --workers=4 --retries=0 --reporter=list,json

PLAYWRIGHT_WEB_SERVER_PORT=4472 \
PLAYWRIGHT_JSON_OUTPUT_NAME=<absolute-path>/renderer-serial-playwright.json \
npm run test:e2e -- --project=chromium-renderer-serial --no-deps --workers=1 --retries=0 --reporter=list,json
```

The new runner stores report paths relative to the tooling worktree and passes absolute destinations to Playwright. It invokes both execution lanes sequentially. The renderer-serial invocation uses `--no-deps`, so a nonzero ordinary result cannot suppress it.

## Discovery and execution results

| Lane | Discovered | Passed | Failed / timed out | Skipped | Flaky | Incomplete | Exit |
|---|---:|---:|---:|---:|---:|---:|---:|
| Ordinary `chromium` | 274 | 117 | 82 | 75 | 0 | 0 | 1 |
| `chromium-renderer-serial` | 4 | 4 | 0 | 0 | 0 | 0 | 0 |
| **Combined** | **278** | **121** | **82** | **75** | **0** | **0** | — |

The ordinary lane produced 199 non-skipped results; combined with the four serial passes, 203 of the 278 identities have non-skipped outcomes. All four required renderer-sensitive tests passed in the one-worker serial lane. The full discovery identity set has no duplicates, no project overlap, and no added or removed identity relative to M7J. The 80 ordinary spec files include the four files that contribute the serial tests.

All 75 skips have raw Playwright skip annotations and recorded reasons in `skipAudit`. They are not treated as passes; no skip exclusion was approved. The complete identity inventory is therefore accounted for, but the unsupported skips and unexpected ordinary outcomes prevent qualification.

The 82 ordinary unexpected results are grouped by their recorded failure signatures: test timeout 36, predicate timeout 9, other timeout 1, CSS assertion 11, attribute assertion 8, visibility assertion 7, count assertion 6, text assertion 2, value assertion 1, and other assertion 1. These are symptom groups only; they do not establish a shared root cause. The machine report retains each test identity and its raw error summary.

## Historical comparison and backlog

The immutable M7G history remains 277 discovered, 103 expected, 99 unexpected, 75 skipped, and 0 flaky. Its raw report SHA-256 remains `393d1360f32a85c83664ca3ed7ec4d5bec217e77edd8045f4ace61b054ae32d6`.

Across the 99 historical failures, M7K found 31 currently passing once, 68 still failing, 0 currently skipped, and 0 not discovered. The 14 unexpected outcomes outside that historical failure set remain listed as new failures. A single current pass does not change an earlier cause or promote a test to a verified fix.

The M7I dispositions remain intact: 16 inherited verified fixes, two matched M7I fixes, 15 tentative drawer cases still marked `not-reproduced`, 65 original unknown cases not verified fixed, and 80 unresolved historical identities (the 15 tentative cases plus 65 unknown cases). The partially addressed compound Restart case remains separately documented. The two M7I fixes and their matched evidence are not rewritten by this broad run.

M7J's four selected tests remain required. Their 4/4 serial pass supports only that one-worker lane; unrestricted four-worker stability remains unstable. M7J reported no identity additions or removals relative to the M7K combined discovery.

## Qualification and authorization

| Gate | M7K result |
|---|---|
| Evidence integrity | Passed |
| Execution completeness | Complete: all 278 identities have exactly one raw outcome |
| Ordinary lane | Failed: 82 unexpected, 75 skipped |
| Renderer-serial lane | Passed: 4/4, one worker, zero retries |
| Broad E2E | **Not qualified** |
| M7 overall | Partially qualified |
| M8 entry | Denied |
| Spontaneous/external GPU device loss | Blocked |
| M5Q | Partially qualified |
| M6 | Development-only |
| Production Ground Glass | WebGL-only |
| Production WebGPU | Disabled |
| Next recommendation | Targeted application regression remediation |

The 75 recorded skips remain in the ordinary discovery inventory and block Broad E2E qualification; many are gated on native or development-only conditions, and none was approved as an exclusion. A future run that passes ordinary Chromium would still not qualify native WebGPU or close the independent GPU device-loss blocker.

## Capture attempts and artifacts

The first attempted capture was superseded because the isolated worktree initially resolved Three.js 0.186.0 from a parent installation. Its raw runtime reported revision 186, so it is explicitly excluded from M7K outcomes. The preserved attempt is under `ground-glass-m7k-broad-e2e/execution/superseded-three-r186/`.

A later Three.js 0.187 attempt discovered the expected tests but both Vite servers failed before any tests ran because the sandbox denied binding to `127.0.0.1` (`EPERM`). Those zero-test reports are retained under `execution/superseded-r187-sandbox-bind-failure/` and are not treated as test outcomes. The final capture ran with the authorized local runner and independent ports.

## Initial shallow post-squash provenance check

I created a disposable synthetic squash snapshot whose tree contains the M7K report and whose parent is the pinned execution source. A separate shallow clone started at depth 1 with no shared object store. Before fetching, `git cat-file -e 'e6066a244510387c32995c1e973a771667b04d10^{commit}'` exited 128, and `npm run evidence:check:m7k` exited 1 with `execution-source-commit-missing`.

The original workflow then fetched a fixed 50-commit window:

```bash
git fetch --no-tags --depth=50 origin refs/heads/main
git cat-file -e 'e6066a244510387c32995c1e973a771667b04d10^{commit}'
```

The pinned commit became available in that simulation, but this did not prove availability after main advanced beyond the arbitrary fetch depth. Review-Fix Round 1 replaces this step with exact pinned-source retrieval and an unshallow-main fallback, then tests a synthetic history more than 50 commits beyond the source. The earlier temporary simulation did not modify an active repository. The Pages deploy job remains dependent on successful CI, and this correction does not deploy or promote production.

Accepted M7K raw artifacts:

| Artifact | SHA-256 |
|---|---|
| Ordinary raw Playwright JSON | `95a7abebfaa7abe53805be7171d0ff84166dbb9e3e3d45eaa134a68f098963de` |
| Renderer-serial raw Playwright JSON | `4be43aa1e68c5bd45d861092cf298db6f43e77576f3a338dc4533f162e32d71a` |
| Ordinary discovery | `6b339b0f67ea6ce495ecc2d5d95d2944a45d7b29f38ba99f8dcee275c2713f9d` |
| Renderer-serial discovery | `7f459699b90d51432e363a01f250626aad9c488459b6c091a23452d063f11f8d` |
| M7I historical report | `486f1c7ac010cd4d4fbede55fdb669f448c26adfaaee6de5717814ddff9bccde` |
| M7J report | `a89e8dc590d1d8c3572b65633f5aad84b2a81720b068669ca668b14cd8bc19bc` |

The complete lane and discovery metadata, console digests, per-test outcomes, skip audit, and historical identity comparison are in [the machine-readable M7K report](GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json) and its capture artifacts under `ground-glass-m7k-broad-e2e/`.

## Evaluator, CI, and validation

The accepted historical report remains schema 1 and records `m7k-broad-e2e-qualification-evaluator-v1`. The current evaluator is v2: it keeps that report readable and validates new schema-v2 capture manifests with separate execution, tooling, and evaluator source identities, measured runtime metadata, and output-directory-scoped raw artifacts. It derives outcomes from raw reports, reconciles Playwright summary counts, validates every discovery identity and source attribution, binds browser and Three.js claims to raw runtime diagnostics, and separates evidence integrity from qualification. `npm run evidence:check:m7k` exits 0 for the internally consistent failing baseline. `npm run evidence:require-qualified:m7k` exits 3 because the report is valid but not qualified.

The original 45-test suite covered 40 named mutation controls plus positive controls. Review-Fix Round 1 adds metadata, source-provenance, output-boundary, and fetch-workflow controls. The runner captures both lanes even when ordinary Chromium exits nonzero, then invokes the offline evaluator. Hosted CI adds deterministic M7K evidence validation but does not automatically rerun the 278-test suite. The original source fetch was:

```bash
node scripts/fetch-m7k-execution-source.mjs --sha=e6066a244510387c32995c1e973a771667b04d10
```

The existing M7E, M7F, and M7J source fetches remain, and the deploy job still depends on successful CI.

The earlier validation snapshot recorded `npm test` at 317 files / 3,680 tests and the original focused M7K suite at 45 tests. Those counts predate Review-Fix Round 1. The accepted full Chromium capture is the run reported above; it was not repeated to seek a different result.

## M7K Review-Fix Round 1 — Capture Reproducibility and Durable Provenance

Review-Fix Round 1 addresses the P2 metadata finding and the independent worktree and source-fetch defects. The original retained raw manifest lacks `playwrightVersion`, `browserVersion`, and `threeJsVersion`, and its `evaluationCommitSha` is empty. Re-running `npm run evidence:check:m7k -- --capture-manifest=docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187/capture-manifest.json --report-output=/tmp/m7k-r1-original-manifest-report.json --evaluation-output=/tmp/m7k-r1-original-manifest-evaluation.json` against that manifest exited 1 with `evaluation-commit-sha-invalid`, `playwright-environment-mismatch:ordinary`, `browser-runtime-environment-mismatch`, `three-runtime-revision-mismatch`, and `playwright-environment-mismatch:rendererSerial`. The separately enriched top-level accepted report remains valid; neither it nor the accepted raw capture was rewritten.

The pinned execution commit `e6066a244510387c32995c1e973a771667b04d10` does not contain the M7K runner, evaluator, or `e2e:run:m7k` script. M7K now requires distinct clean worktrees: the tooling worktree contains the runner and evaluator, and the execution worktree is detached at the pinned application source. The runner rejects a wrong execution `HEAD`, a shared tooling/execution directory, dirty worktrees, missing execution-local `node_modules`, dependency/lock mismatches, and any Three.js version other than 0.187.0. The reviewed one-worktree command therefore could not execute from either role: the historical source lacks the command, while the tooling branch is not the pinned execution SHA.

Prepare the execution worktree with its own lockfile installation:

```bash
git worktree add --detach /path/to/m7k-execution e6066a244510387c32995c1e973a771667b04d10
cd /path/to/m7k-execution
PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH npm ci
```

Then, from a clean tooling worktree, run the discovery/browser preflight without executing test cases:

```bash
PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH \
npm run e2e:run:m7k -- \
  --execution-worktree=/path/to/m7k-execution \
  --output-dir=docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/preflight \
  --preflight-only
```

A bounded six-test capture can be requested with the ordinary WebGL/WebGPU Observer pair and all four required renderer-serial tests:

```bash
PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH \
npm run e2e:run:m7k -- \
  --execution-worktree=/path/to/m7k-execution \
  --output-dir=docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/selected \
  --ordinary-grep='webgl Observer PMREM changes only the reflective subject region|webgpu Observer PMREM changes only the reflective subject region' \
  --renderer-serial-grep='@m7j-renderer-contention'
```

Selected captures record `captureMode: selected`, the filter expressions, raw report paths and digests, both lane exit codes, and a partial/blocked qualification. They cannot claim full-suite completeness. The runner gathers installed Playwright, Chromium, and Three.js versions from the execution worktree; checks the installed dependency tree against that worktree's lockfile; launches Chromium to measure browser version, viewport, and WebGL2 availability; and binds the browser and Three.js versions to raw Observer runtime diagnostics. It records the tooling commit and the commit containing the evaluator separately from the pinned execution commit. Uncommitted tooling is rejected. The v2 CLI verifies the referenced Git commit and source file for each declared tooling/evaluator identity before accepting evidence.

The manifest is evaluated directly by the offline CLI after capture, without hand-editing metadata. To evaluate later, use `npm run evidence:check:m7k -- --report-path=<report>`; no browser is needed. Runner output directories must be new and inside the tooling worktree, and raw/discovery paths must remain beneath the manifest's declared output directory. Existing outputs are not overwritten.

The final bounded run used tooling and evaluator commit `23104069bc3acb2078722979b9591b0293e4fa39`, with evaluator source path `src/render/testing/groundGlassM7kBroadE2eQualification.ts`; execution remained pinned at `e6066a244510387c32995c1e973a771667b04d10`. The runner-generated manifest recorded Node `v24.3.0`, npm `11.12.0`, Playwright `1.61.1`, Chromium `149.0.7827.55`, Three.js `0.187.0` / revision `187`, a 1280×720 viewport, and WebGL2 SwiftShader fallback. The evaluator accepted the direct runner output with exit 0, evidence integrity passed, execution completeness incomplete, and Broad E2E blocked. The two selected ordinary Observer tests passed 2/2; Playwright configured four workers but used one actual worker for this two-test selection, so the ordinary lane remains incomplete. The required renderer-serial lane passed all 4/4 tests on one worker. This six-test sample does not reclassify historical failures or qualify the full suite.

The final discovery-only preflight used the same tooling/evaluator and execution commits, executed no Playwright test cases, and passed with 274 ordinary identities across 80 spec files plus all 4 renderer-serial identities (278 unique total). It measured the installed dependency versions and Chromium/WebGL runtime above. A real runner invocation pointed at the wrong execution `HEAD` exited 1 before discovery. A disposable execution worktree with Three.js temporarily changed to `0.186.0` was rejected before capture with exit 1; the dependency was restored to `0.187.0` afterward. Focused test coverage includes wrong-source, worktree collision, output-scope/overwrite, dependency mismatch, evaluator provenance, and selected-capture mutations.

CI now fetches the exact execution SHA first and verifies it with `git cat-file`. If the remote rejects a direct SHA fetch, the helper unshallows `refs/heads/main` and verifies the same pinned object. It never substitutes current main for the source SHA and fails if the exact commit remains unavailable. The regression test created a bare remote with the pinned source followed by 60 future main commits, then two independent depth-1 clones with no shared object store. In both clones the pinned commit was initially unavailable. The helper's exact-commit fetch and full-main-history fallback each made the pinned commit and its tree entry available; a nonexistent SHA remained unavailable and the helper exited 1. The workflow uses this helper without a fixed history-depth assumption. The existing M7E, M7F, and M7J fetches remain, and production deployment still requires successful `ci`.

On the corrected tree, `npm test` passed 318 files / 3,701 tests. The focused M7K evaluator and runner suites passed 66/66 (60 evaluator tests and 6 workflow tests). Typecheck, lint, CSS structure, and production build passed. M7H, M7I, M7J, and the accepted M7K evidence checks passed; the generated selected M7K report also passed the CLI with exit 0. M7F replay passed 17/17, and M7G integrity reported 5 passed / 2 blocked, M8 denied. `npm run evidence:require-qualified:m7k` returned its expected exit code 3 because the valid accepted 278-test report remains not qualified.

Hosted CI run [41753120709](https://github.com/chau-hm/view-camera-simulator/actions/runs/41753120709) passed on code head `0e0a3f2f6948590066af9f1f587c29ecf771ccff`. Its M7E/M7F/M7J/M7K source fetches, lint, typecheck, unit/integration, ordinary Chromium smoke, production-preview WebGL isolation, M7F replay, and M7G/M7H/M7I/M7J/M7K evidence checks all passed. The deploy job was skipped for the PR event; production-push deployment remains gated on successful CI. The current final PR-head run is linked from [PR #309 checks](https://github.com/chau-hm/view-camera-simulator/pull/309/checks).

The accepted 278-test result remains unchanged at 121 passed, 82 unexpected, 75 skipped, zero flaky, and zero incomplete. No new full capture is claimed here. Broad E2E remains not qualified; M7 remains partially qualified; M8 remains denied; external GPU device loss remains blocked; production Ground Glass remains WebGL-only and production WebGPU remains disabled. Future Broad E2E qualification requires its own complete capture and independent evidence review.

## M7K Review-Fix Round 2 — Squash-Safe Schema-v2 Evidence Replay

Review-Fix Round 1 retained a schema-v2 selected capture whose tooling and evaluator source is commit `23104069bc3acb2078722979b9591b0293e4fa39`. The original execution source remains `e6066a244510387c32995c1e973a771667b04d10`; the accepted schema-v1 evaluator source remains `0bef49c208030de8870262ef64895934ff215666`. These roles are independent. A squash merge retains the report and evidence tree but need not retain the original tooling commit in `main` history. The M7K evaluator correctly rejects unavailable source objects; CI previously fetched only the execution source and checked only schema v1.

The defect was reproduced in a disposable synthetic squash checkout. I copied the tracked PR tree into a new root commit, served that snapshot and the retained PR head from an isolated bare remote, and cloned synthetic `main` with depth 1 over `file://`; this clone shared no object store with the worktree. Before retrieving tooling, `git cat-file -e '23104069bc3acb2078722979b9591b0293e4fa39^{commit}'` returned 128. The runner and evaluator tree-entry checks at that SHA also returned 128. After fetching the pinned execution source, the schema-v1 CLI passed. The actual schema-v2 command exited 1 with `tooling-source-file-unavailable` and `evaluator-source-file-unavailable`.

CI now attempts exact-SHA retrieval first. If the exact object is unavailable, it fetches the full retained PR #309 history, then verifies the exact commit and both required tree entries:

```bash
node scripts/fetch-m7k-execution-source.mjs \
  --sha=23104069bc3acb2078722979b9591b0293e4fa39 \
  --retained-ref=refs/pull/309/head \
  --verify-path=scripts/run-m7k-broad-e2e.mjs \
  --verify-path=src/render/testing/groundGlassM7kBroadE2eQualification.ts
```

The helper fails if the pinned SHA is unavailable from both retrieval paths, if a successful fetch does not make that exact commit available, or if either source path is absent at that commit. It never substitutes the latest `main`, PR head, execution source, or a squash commit. An isolated depth-1 replay forced the retained-ref fallback: commit `23104069bc3acb2078722979b9591b0293e4fa39` and both tree entries became available, and the same schema-v2 offline evaluation then exited 0 with evidence integrity passed, execution completeness incomplete, and Broad E2E blocked. The report still records six selected passes; that sample does not qualify the suite.

The regression test also creates a retained PR source alongside a `main` history advanced by 60 commits, then uses independent shallow clones. It verifies initial source absence, exact-SHA retrieval, retained-ref fallback, both source tree entries, unavailable-SHA rejection, missing-path rejection, and invalid-ref rejection. No fetch relies on an arbitrary `main` history depth.

CI now has separate required offline checks for the accepted schema-v1 full-suite report and schema-v2 selected report. The selected check uses `npm run evidence:check:m7k -- --report-path=docs/architecture/ground-glass-m7k-broad-e2e/review-fix-r1/selected/qualification-report.json`; it requires no browser execution. Both checks run in the `ci` job for PRs and pushes, including production-branch pushes. Existing M7E/M7F/M7J source checks, production-preview WebGL isolation, and `deploy.needs: ci` remain enabled. On implementation HEAD `84a28dd6c5dff2d5a4648f088cf18b9ad054454d`, PR workflow run [41832346528](https://github.com/chau-hm/view-camera-simulator/actions/runs/41832346528) passed every step, including both M7K schema checks; paired branch-push run [41832336810](https://github.com/chau-hm/view-camera-simulator/actions/runs/41832336810) also passed. Deployment was skipped for both non-production events. The current final-head result is available from [PR #309 checks](https://github.com/chau-hm/view-camera-simulator/pull/309/checks).

F5, safe handling of generated preflight output, is deferred. The runner's clean-worktree and output-scope checks remain strict; generated preflight output must be removed, moved outside the tooling worktree, or committed as intentional evidence before a subsequent capture. This round does not broaden ignore rules or relax provenance checks.

The accepted schema-v1 report remains complete at 278 tests: 121 passed, 82 unexpected, 75 skipped, zero flaky, and zero incomplete; its qualification remains not-qualified. The schema-v2 selected report remains integrity-passed, incomplete, and blocked. M7 remains partially qualified, M8 remains denied, external GPU device loss remains blocked, production Ground Glass remains WebGL-only, and production WebGPU remains disabled.
