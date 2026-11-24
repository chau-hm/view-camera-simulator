# Core Regression Preservation Audit

## Decision

**`RETAIN_FULL_GITHUB_SUITE`** for the current merge gate. The 48-file Core Regression set remains a useful shadow candidate, but current evidence does not justify replacing mandatory GitHub Vitest or routing omitted files away from it. See [the decision record](./CORE_REGRESSION_CI_DECISION.md) and the [per-file inventory](./CORE_REGRESSION_TEST_INVENTORY.json).

This audit adds evidence and a decision only. It changes no test, application, or workflow behavior.

## Baseline and evidence identity

| Field | Value |
|---|---|
| Repository | `chau-hm/view-camera-simulator` |
| Implementation base | `af680d7f9409bab13c6654abaaa2dad5aeac8079` (`origin/main`, PR #364 merge; fast-forwarded from the initial B4 checkout at `1fc33bf3`) |
| Local full/candidate source-state fingerprint | `c4831df4eebc2e27846e3280ba9b126478568050e9049442244f39f6d36a1c07` |
| Source stability | Full/candidate reports recorded a clean and stable checkout. The Local CI fingerprint hashes index/worktree/untracked deltas, not committed source contents; exact commit SHA is the source identity. |
| Environment | macOS `Darwin 27.0.0`, arm64; Node `v24.3.0`; npm `11.12.0`; Vitest `3.2.7`; Playwright `1.61.1`; ESLint `9.39.5`; TypeScript `6.0.2`; Vite `8.1.4` |
| Worker settings | Vitest `maxWorkers=4`; focused Playwright `workers=1` |

All current counts below are from fresh discovery or runner JSON at `af680d7f`. The earlier B3 measurements (354 files / 4,365 cases; later PR #363 review-fix evidence recorded 4,375 cases; and 48 files / 611 candidate cases) remain tied to their recorded source identities and are not reused as current counts. The first B4 measurement pass at `1fc33bf3` was superseded when PR #364 advanced main; current findings include that Table Tilt update.

## Current inventory and execution routing

Vitest configuration includes `src/tests/unit/**/*.test.ts`, `src/tests/unit/**/*.test.tsx`, and `src/tests/integration/**/*.test.tsx`, with `src/tests/setup.ts`. The current full run reconciled to **354 files and 4,384 test cases**: 328 Unit files and 26 Integration files. The candidate manifest resolved to 48 distinct files and 611 cases; the runner's actual selected file set exactly matched the manifest with no missing or extra files.

| Runner / route | Current discovery | What executed in this audit |
|---|---:|---|
| Full Vitest (included in full Local CI) | 354 files / 4,384 cases | Two full Local CI runs PASS; all 4,384 cases passed in both, with no failures, skips, or todos |
| Core candidate (`npm run ci:local:core -- --workers=4`) | 48 files / 611 cases | Two candidate runs PASS; all 611 cases passed in both |
| Development Playwright (`playwright.config.ts`) | `--list`: 80 spec files / 280 tests over configured projects | Exact-base ordinary Chromium smoke executed and passed 2/2 cases; full E2E matrix not run |
| Production-preview Playwright (`playwright.production.config.ts`) | `--list`: 1 spec file / 4 tests | Exact-base Production Preview executed and passed 4/4 cases |
| Research/benchmark Playwright | Separate configs and explicit scripts, including two `*.bench.ts` suites | `NOT_MEASURED`; not part of default Vitest or ordinary smoke |
| Native WebGPU / renderer-specific qualification | Separate conditional projects, explicit specs, and hardware requirements | `NOT_MEASURED`; no native GPU qualification was run |
| Full source declaration count | Vitest expands parameterized cases; source-level declaration count was not separately counted | `NOT_MEASURED`; 4,384 is the runner-discovered case count, not source declaration count |

The development Playwright `--list` result is discovery, not execution. It includes conditional and research-oriented specs. Native WebGPU is not established by ordinary Chromium or by a listed spec. The Production Preview has its own config and was separately executed.

The full per-file record includes assertion names, actual case totals, owner candidates, candidate membership, direct local imports, historical-family tags, runtime signals, confidence, overlap, and missing proof. Rows marked `INVENTORY_ONLY` have not received full assertion-body/equivalence review and remain Category D. This is an explicit unresolved disposition, not an inferred deletion opportunity.

## Matched local runtime evidence

Reports were produced at exact source SHA `af680d7f9409bab13c6654abaaa2dad5aeac8079` on the same macOS arm64 / Node 24 / tool versions and `maxWorkers=4` setting. Both full/candidate pairs reported a clean, stable source-state snapshot and fingerprint `c4831df4eebc2e27846e3280ba9b126478568050e9049442244f39f6d36a1c07`.

| Run | Full Local CI total | Full Vitest | Core candidate total | Candidate Vitest | Order |
|---|---:|---:|---:|---:|---|
| 1 | 160.413 s | 84.027 s; 354 files / 4,384 cases | 11.163 s | 11.012 s; 48 files / 611 cases | Full, then candidate |
| 2 | 163.271 s | 124.032 s; 354 files / 4,384 cases | 16.456 s | 16.223 s; 48 files / 611 cases | Candidate, then full |

Run 1 full-step breakdown: CSS 0.273 s, ESLint 32.881 s, TypeScript 31.769 s, Vitest 84.027 s, build 10.939 s. Run 2: CSS 0.098 s, ESLint 10.765 s, TypeScript 13.350 s, Vitest 124.032 s, build 14.867 s. The four run records and final full/candidate Vitest JSON SHA-256 values are recorded in the inventory JSON's top-level `source` fields; the corresponding ignored report directories are retained locally under `.agents/output/ci-local/`. The same source and worker setting produced substantial runtime variation, so preserve the raw runs and do not turn their differences into a stable saving estimate.

The current exact-base browser runs were separately executed:

| Browser gate | Result | Evidence |
|---|---|---|
| Ordinary Chromium `smoke.spec.ts` | 2/2 passed; Playwright step 25.702 s | `.agents/output/ci-local/2026-11-24T14-35-59-507Z-55330-f3481d11/report.json` |
| Production Preview `architecture-rise-webgpu-production.spec.ts` | 4/4 passed; Playwright step 69.833 s | `.agents/output/ci-local/2026-11-24T14-36-33-136Z-82400-ea349c5b/report.json` |

Those focused browser reports record commit `af680d7f`, stable during execution. Their only dirty-state entry was the untracked audit inventory JSON in the disposable checkout; no tracked source was changed. The browser reports' source-state fingerprint therefore differs from the clean full/candidate fingerprint.

The local full-versus-candidate Vitest steps differ by 73.015 s in Run 1 and 107.809 s in Run 2. Those are measured differences for this macOS environment only. They are not GitHub runner estimates, billed-time estimates, full-workflow savings, or a basis to apply the same delta to CI. The full `ci:local` command includes CSS, lint, typecheck, build, and Vitest; the candidate command does not repeat those other steps, so command totals are not an end-to-end comparison.

Exact-current-source GitHub Actions job duration, runner minutes, source-history fetch duration, and historical qualification decision are `NOT_MEASURED` until the B4 PR head run completes. Older GitHub runs are not treated as current-source timing evidence. GitHub billing data is unavailable to this audit unless a run-level billing/runner report exposes it.

## Candidate and exclusion reconciliation

| Proposed preservation category | Files | Meaning in this audit |
|---|---:|---|
| A — Mandatory GitHub Core | 62 | 48 candidate files plus 14 reviewed high-impact omitted files with distinct critical contracts |
| B — Mandatory Conditional GitHub Validation | 0 | No omitted Unit-test group has a proven conditional GitHub route that executes its semantic test contract |
| C — Local / Developer-Targeted | 0 | No file is moved to Local-only execution by this audit |
| D — Unresolved / Must Retain | 292 | Not selected as a reviewed core keeper; retain in full GitHub Vitest until ownership, impact, and regression sensitivity are resolved |

The 62 Category A files are not a replacement suite. All 354 files remain in mandatory full GitHub Vitest under this decision. Category B is empty because B2 archive replay is not the same as executing active M7 evaluator/provenance Unit tests, and B3 owner selection is not complete enough for GitHub affected-test selection.

## Source-to-test impact findings

The current `owners.json` map is useful for focused Local CI, but it is not a complete GitHub test-impact graph.

| Actual change | Current owner selection evidence | Why it is insufficient for narrowing mandatory GitHub Vitest |
|---|---|---|
| `src/core/optics/deriveOpticsState.ts` | `canonical-optics` selects 15 Unit tests and four E2E specs; other consumers include public task/focus contracts | The owner is a useful direct layer, but source consumers and public browser contracts cross owners. A fixed owner list is not a complete transitive graph. |
| `src/render/groundGlassRttOrientation.ts` | `ground-glass-coordinates` selects six coordinate Unit tests and `groundglass-interaction.spec.ts` | Rendering output is also used by coverage, presentation, illumination, inspection-window, and other tests. Similar orientation names do not establish duplicate proof. |
| `src/render/groundGlassFrameRequest.ts` / `groundGlassFrameExecution.ts` | Coordinate path matching can select the broad coordinate owner; direct frame request/execution tests are separate owners | Stale-frame and request-retirement behavior needs its direct deterministic tests plus real browser delivery/lifecycle evidence. |
| `src/render/sceneSubjectRegistry.tsx` | Broad `src/render/**` matching reaches coordinate ownership; direct registry and shared-resource tests are not all selected by that owner | Path breadth can select a plausible but incomplete owner; renderer lifecycle and resource ownership span several test groups. |
| `src/render/table-tilt/TableTiltStudioFurnishings.ts` (current main commit #364) | Exact `resolveOwnerSelection` result is only `ground-glass-coordinates` plus its six Unit tests and one browser spec; it omits `tableTiltMountedVisibility.test.ts` and reports `incomplete: false`, `fullVitest: false`. A related `src/scenes/**` change carries an incomplete owner result. | Current inventory records the 15-case Table Tilt mounted-geometry/studio test as Category D. This is a concrete new source-to-test ownership gap; retain it in full until reviewed and mapped. |
| `src/scenes/**` | `scene-implementation-incomplete` selects publication/route tests and `scene-switching.spec.ts`, while returning an explicit incomplete reason | `resolveOwnerSelection` records incomplete coverage but does not itself force full Vitest. A future GitHub selector must convert this and any unknown impact to a broad safe path. |
| `src/render/testing/**` or shared evaluator code | Renderer and evidence owners select a subset of support tests | Direct M7K/M7M evaluator and provenance Unit contracts can remain outside the selected owner. B2 archive replay does not execute those Unit tests. |
| Test helpers, fixtures, setup, scripts, schemas, or config | `test-source-changes` / infrastructure owners can broaden selection, and source-state collection includes changes, additions, deletions, and both sides of renames | The static local import list does not represent dynamic imports, `vi.doMock`, `importActual`, filesystem source checks, data-driven schemas, environment variables, and runner setup. GitHub narrowing needs explicit conservative dependency coverage. |

`source-state.mjs` parses `git diff --name-status -z`, includes both old and new rename paths, sees staged/worktree edits and untracked files, and the selection layer chooses full Vitest for unknown or stale owner paths. This behavior is useful local feedback. The scene-owner incomplete result remains a concrete exception that a GitHub reduction must handle as full-suite fallback, not as a narrow successful selection.

## Mutation and preservation evidence

| Contract | Mutation / control | Result and applicability |
|---|---|---|
| Thin-lens physical calculation | `D - f` changed to `D + f` in `thinLensModel.ts` | Existing B3 mutation: 10 failed / 21 passed; exit 1. The implementation and test files are unchanged at B4 base `af680d7f`. |
| Ground Glass Raw orientation | Suppress Raw X flip while retaining Y | Existing B3 mutation: 4 failed / 2 passed; exit 1. Exact source/test files are unchanged at B4 base. |
| RTT target ownership | Omit disposal for the first owned render target | Existing B3 mutation: 3 failed / 3 passed; exit 1. Exact source/test files are unchanged at B4 base. |
| Fail-closed qualification | Accept `FAILED` as a merge-safe result | Existing B3 mutation: 1 failed / 18 passed; exit 1. Exact gate/test files are unchanged at B4 base. |
| Omitted B1 far reconstruction contract | In a disposable local clone at `af680d7f`, replace the far-gather output with source-color output | Core candidate passed (48 files / 611 cases; 16.780 s Vitest step); omitted `groundGlassWebGpuB1Reference.test.ts` failed 4 / 17 cases; exit 1. This is direct evidence that candidate PASS is not equivalent to the full suite. Clone mutation was removed. |

The B3 controls are reused only after verifying the exact affected source and test files are unchanged between their recorded source revision and current B4 base `af680d7f`. They are representative controls, not exhaustive mutation coverage. Untested defects in Scheimpflug, image-circle rendering, task reachability, provenance, and browser lifecycle remain a reason to retain the full suite until further proof exists.

## Current CI and historical lane boundary

At current B4 base `af680d7f`, `.github/workflows/pages.yml` still runs full `npm run test` in authoritative CI, ordinary Chromium smoke, Production Preview WebGL isolation, M7R integrity, and M7V qualification/skip governance. Its `ci` job also fetches exact retained source history for active evidence contracts. `.github/workflows/historical-qualification.yml` handles automatic change-triggered archive qualification and manual full archive replay.

The archive lane validates frozen artifacts, evaluator output, retained source identity, and qualification policy. It does **not** substitute for the current Vitest evaluator, normalizer, parser, CLI, or provenance tests. M7R and M7V remain unconditional ordinary-CI integrity/policy owners. No M7 archive, source provenance record, or mandatory CI check is removed by this audit.

## Limitations

- 271 inventory rows are `INVENTORY_ONLY`; their declaration names and case counts are captured, but full assertion-body and sibling-equivalence review is not complete. All remain Category D and mandatory.
- Static imports/re-exports and literal mocks are recorded, but this is not a complete runtime dependency graph.
- No full development E2E matrix, native WebGPU experiment, visual/raster qualification, or full historical archive replay was run as part of the local baseline.
- Matched GitHub-hosted timing and billed runner minutes are `NOT_MEASURED` at documentation authoring time; inspect the exact B4 PR head Actions before finalizing a GitHub cost claim.
- The local report files are ignored worktree artifacts; the committed JSON inventory and this measurement record preserve their key results, hashes, source identity, and commands. The candidate-vs-omitted mutation used an isolated clone at the same `af680d7f` base.

The next step is to keep full mandatory GitHub Vitest while collecting exact-head GitHub workflow evidence and closing the specific ownership/mutation gaps listed in the decision record.
