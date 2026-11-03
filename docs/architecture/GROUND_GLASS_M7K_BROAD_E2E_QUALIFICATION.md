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

The M7K runner pins execution to the merge source above and refuses to start from another `HEAD`. It uses isolated Vite ports 4471 and 4472. The raw ordinary runtime diagnostics bind the reported Chromium version, Three.js revision, platform, and architecture to captured browser output.

The Vite command is `npm run dev -- --host 127.0.0.1 --port <4471|4472> --strictPort`; `VITE_BASE_PATH=/`, the raw WebGPU pilot, test seam, physical CoC, gather, M6 presentation, and M6 qualification flags are false. Native-required and research-only environment switches are cleared by the runner.

Discovery ran independently:

```bash
npm run test:e2e -- --project=chromium --workers=4 --list
npm run test:e2e -- --project=chromium-renderer-serial --no-deps --workers=1 --list
```

The capture runner was invoked on the pinned merge source:

```bash
PATH=/Users/homan/.nvm/versions/node/v24.3.0/bin:$PATH \
npm run e2e:run:m7k -- \
  --output-dir=docs/architecture/ground-glass-m7k-broad-e2e/execution/three-r187
```

The exact test commands were:

```bash
PLAYWRIGHT_WEB_SERVER_PORT=4471 \
PLAYWRIGHT_JSON_OUTPUT_NAME=<absolute-path>/ordinary-playwright.json \
npm run test:e2e -- --project=chromium --workers=4 --retries=0 --reporter=list,json

PLAYWRIGHT_WEB_SERVER_PORT=4472 \
PLAYWRIGHT_JSON_OUTPUT_NAME=<absolute-path>/renderer-serial-playwright.json \
npm run test:e2e -- --project=chromium-renderer-serial --no-deps --workers=1 --retries=0 --reporter=list,json
```

The runner stores the absolute report destinations in its capture manifest. The execution lanes ran sequentially. The renderer-serial invocation used `--no-deps`, so the ordinary lane's nonzero result could not suppress it.

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

## Shallow post-squash provenance check

I created a disposable synthetic squash snapshot whose tree contains the M7K report and whose parent is the pinned execution source. A separate shallow clone started at depth 1 with no shared object store. Before fetching, `git cat-file -e 'e6066a244510387c32995c1e973a771667b04d10^{commit}'` exited 128, and `npm run evidence:check:m7k` exited 1 with `execution-source-commit-missing`.

The clone then ran the same source-history step as CI:

```bash
git fetch --no-tags --depth=50 origin refs/heads/main
git cat-file -e 'e6066a244510387c32995c1e973a771667b04d10^{commit}'
```

The pinned commit became available and the unchanged M7K evidence check passed with exit 0. The simulation used a temporary bare remote and checkout; it did not add or remove objects in any active repository. The Pages deploy job remains dependent on successful CI, and this correction does not deploy or promote production.

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

The offline evaluator is `m7k-broad-e2e-qualification-evaluator-v1`. It derives outcomes from the two persisted raw reports, reconciles Playwright summary counts, validates every discovery identity and source attribution, binds browser and Three.js claims to raw runtime diagnostics, and separates evidence integrity from qualification. `npm run evidence:check:m7k` exits 0 for this internally consistent failing baseline. `npm run evidence:require-qualified:m7k` exits 3 because the report is valid but not qualified.

The 45-test focused suite covers 40 named mutation controls plus positive controls. The runner captures both lanes even when ordinary Chromium exits nonzero, then invokes the offline evaluator. Hosted CI adds the deterministic M7K evidence check but does not automatically rerun the 278-test suite. Before evidence validation, CI runs:

```bash
git fetch --no-tags --depth=50 origin refs/heads/main
git cat-file -e 'e6066a244510387c32995c1e973a771667b04d10^{commit}'
```

The existing M7E, M7F, and M7J source fetches remain, and the deploy job still depends on successful CI.

Local validation passed: `npm test` (317 files / 3,680 tests), the focused M7K suite (45/45), typecheck, lint, CSS structure, build, M7H/M7I/M7J/M7K evidence checks, M7F replay (17/17), and M7G integrity report (5 passed / 2 blocked, M8 denied). The full Chromium capture is the run reported above; it is not repeated to seek a different result. Final hosted CI status is tracked on the M7K PR's final head.
