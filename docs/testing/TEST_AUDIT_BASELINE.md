# Test Audit Baseline

Audit date: 2026-11-23

Repository: chau-hm/view-camera-simulator

Pinned baseline: 658487f468d14d6129f4ac7091ebd71c32afd5ed

Intended PR base: origin/main

## Pin and counting method

GitHub’s current main commit and a fresh fetch of origin/main both resolved to 658487f468d14d6129f4ac7091ebd71c32afd5ed. The audit feature branch was fast-forwarded to that commit before files were inventoried. The earlier cached ref was 2fca13103504b6c714979ccfcd853516df0e2ab3. The nine files between those commits are a conceptual camera appearance change and do not touch M7, Ground Glass, renderer, test configuration, or CI evidence files. M7 and Ground Glass read-only reviews began at the earlier SHA; their reviewed owners are unchanged at the pinned SHA.

Counts use tracked files from git ls-files at the pinned commit. No linked worktrees, node_modules, generated output, or untracked files are counted. “Lines” means newline-counted source lines, including comments and blank lines; it is not SLOC. Test file count and collected test declaration count are reported separately.

## Repository inventory

| Inventory | Files | Lines | Counting boundary |
|---|---:|---:|---|
| Unit tests | 323 | 90,183 | src/tests/unit, .test.ts and .test.tsx |
| Integration tests | 26 | 6,054 | src/tests/integration, .test.tsx |
| E2E specifications | 81 | 40,425 | src/tests/e2e, .spec.ts; includes the production-preview spec |
| Benchmark specifications | 5 | 12,485 | src/tests/benchmarks, .spec.ts |
| Other named test/spec files | 24 | 9,821 | Experiments, render-quality, scene-variation, and still-life paths described below |
| All .test.* and .spec.* files | 459 | 158,968 | Sum of the five preceding rows |
| Benchmark files | 2 | 3,526 | src/tests/benchmarks, .bench.ts |
| Opt-in diagnostic test source | 1 | 166 | src/tests/e2e/m7s-learning-drawer-contract.diagnostic.ts |
| All inventoried test/benchmark/diagnostic sources | 462 | 162,660 | Patterned tests plus benchmark and diagnostic sources |

The “other named” 24 files consist of two experiment specs, two scripts/render-quality specs, nine src/tests/render-quality E2E specs, nine src/tests/scene-variation-e2e specs, and two src/tests/still-life-studio-e2e specs. These are separate from the default Vitest and Playwright directories and use dedicated configs or package scripts.

| Test-support inventory | Files | Lines | Counting boundary |
|---|---:|---:|---|
| src/tests helpers, fixtures, and other support, excluding the M7S diagnostic test | 72 | 30,384 | Non-test, non-benchmark files under src/tests |
| Renderer testing support | 7 | 4,396 | src/render/testing |
| M7-named evidence scripts and support | 53 | 13,777 | scripts files with M7 evidence names |
| Path-based support subtotal | 132 | 48,557 | These disjoint path groups only |

This subtotal is a path-based measure. It does not classify every helper outside these roots or count test-only logic embedded in shared production owners.

## Vitest discovery

vitest.config.ts includes src/tests/unit/**/*.test.ts, src/tests/unit/**/*.test.tsx, and src/tests/integration/**/*.test.tsx. The unit and integration directories match those globs: 323 plus 26 files. The collected Vitest list at the pinned SHA contained 4,279 test declarations in 349 files. This is the runner’s discovered declaration count, not a count inferred from filenames.

package.json routes npm test to scripts/test.mjs, which invokes vitest run. That wrapper removes the legacy --runInBand and -i arguments. The configured runner does not include E2E, benchmark, experiment, render-quality, scene-variation, or still-life directories.

## Playwright discovery and exclusions

The default playwright.config.ts sets testDir to src/tests/e2e and excludes every *-production.spec.ts using scripts/e2e-spec-policy.mjs. At the pinned SHA:

| Discovery command | Discovered cases | Files | Meaning |
|---|---:|---:|---|
| playwright test --list --project=chromium | 276 | 80 | Ordinary development Chromium project; list only, no browser launched |
| playwright test --config=playwright.production.config.ts --list | 4 | 1 | Production-preview WebGL isolation spec; separate config; discovery only, browser not launched |
| M7S diagnostic config | NOT_MEASURED | 1 configured source | The source declares three cases and the config targets that diagnostic source. No local `node_modules` was present; a `npx playwright ... --list` attempt did not resolve within 40 seconds and was stopped before browser launch. No package script or workflow invocation was found |

The default e2e directory has 81 spec files. The one production-preview file is excluded from the default config and is instead selected by playwright.production.config.ts. The M7S diagnostic source uses a nonstandard filename, so it is not found by the default Playwright matcher; its separate config matches it, but no automated invocation was found. Its declarations skip unless M7S_DRAWER_CAPTURE=1. Actual Playwright list discovery remains NOT_MEASURED because dependencies were not installed in this worktree.

The default config defines a Chromium project and a separate chromium-renderer-serial project for tagged renderer-contention coverage. Ordinary Pages smoke explicitly selects only chromium. package.json also exposes test:e2e:m7j-renderer to invoke the renderer-serial project directly. Native WebGPU, physical CoC, and research suites are gated by environment variables and are not part of the ordinary smoke command.

The 24 other named specs are not discovered by the default Playwright config because they are outside src/tests/e2e. They have dedicated configs or explicit commands in package.json. They are not included in the ordinary Pages workflow.

## CI routing at the pinned SHA

The pull_request CI job in .github/workflows/pages.yml performs, in order:

1. Checkout with fetch-depth 50, then retained-history and exact-source fetches for M7 evidence.
2. Node 24 setup and npm ci.
3. Chromium installation.
4. npm run lint, npm run typecheck, and npm run test.
5. Ordinary application smoke: npm run test:e2e -- --project=chromium --workers=1 src/tests/e2e/smoke.spec.ts.
6. Production-preview isolation: Playwright with playwright.production.config.ts on chromium-production-preview.
7. M7 persisted-evidence and qualification checks listed in the M7 lane of TEST_AUDIT_LEDGER.md.

The PR workflow does perform a complete application build. playwright.production.config.ts starts its web server with npm run build && npm run preview; npm run build runs TypeScript project checking followed by vite build. The build is implicit in the production-preview step rather than a separately named CI step. The production push deployment also builds with the Pages base path after the ci job succeeds.

The PR workflow does not run npm run check:css; that check is included by scripts/ci-local.mjs. Local ci:local runs CSS, lint, typecheck, Vitest, and build. Its optional --with-e2e mode enumerates top-level development specs in src/tests/e2e and runs them one file at a time. It excludes production-preview filenames. It does not run the separate benchmark, render-quality, experiment, scene-variation, or still-life qualifications.

### M7 history and evidence routing footprint

pages.yml has 14 named M7 source-history steps and 27 source-fetch operations: 24 calls to scripts/fetch-m7k-execution-source.mjs plus direct git fetches of retained PR heads 303, 304, and 308. The workflow runs 16 M7 validation commands: M7F, M7G, M7H, M7I, M7J, M7K schema v1, M7K selected schema v2, M7L, M7M, M7N, M7O, M7P, M7Q, M7R, M7V, and M7W. M7G also performs M7E and M7F child replay. The M7F replay command is therefore invoked once directly and again through M7G; see the evidence-backed recommendation in TEST_AUDIT_LEDGER.md.

The source fetches are not interchangeable with the evidence checks. Several reports refer to commits no longer reachable from main after squash merge, and checks verify exact source tree paths at those SHAs through retained PR heads. Removing a fetch without moving its exact-SHA/path check with the qualification command would make replay fail or become unverifiable.

## Baseline execution evidence

| Check | Result at pinned SHA | Runtime / limitation |
|---|---|---|
| Vitest full configured suite, Node 24.3.0, --maxWorkers=4 | 349 files passed; 4,279 tests passed; zero failures | Vitest reported 142.73 seconds. Worker cap and local hardware differ from GitHub Actions defaults. |
| Vitest collection list | 4,279 declarations in 349 files | Collection only; no test bodies run by this command. |
| Default Playwright Chromium discovery | 276 tests in 80 files | Discovery only; no browser launched. |
| Production-preview Playwright discovery | 4 tests in 1 file | Discovery only; no production browser run beyond what the later baseline Vitest did not include. |
| M7 evidence CLI and historical capture replay | NOT_MEASURED | Not run during this audit; individual CI step timing records were not returned by the connected GitHub status/run lookup. |
| E2E runtime by suite, including WebGL/native WebGPU | NOT_MEASURED | No E2E matrix was run for this audit. |
| GitHub status/run timing for pinned SHA | NOT_AVAILABLE | The connected API returned no combined status entries or PR-associated runs for this commit; no CI seconds are inferred. |

The final Vitest baseline ran in a writable temporary worktree at the exact pinned SHA because the M7 tests intentionally create and remove repo-local file/symlink probes. The temporary checkout was clean after the run and removed afterward. Two earlier diagnostic attempts are not treated as baseline failures: a run on the stale 2fca SHA with host Node 26 failed with localStorage environment errors and a worker RPC timeout; a run in the managed non-writable test worktree failed on EPERM probe writes. The exact pinned SHA was then rerun under Node 24 in the writable temporary checkout and passed as recorded above.

### Known failures and qualification status

No failures occurred in the executed full Vitest suite at the pinned SHA. Playwright browser tests were not executed for this audit, so no current browser pass/fail claim is made. Historical M7 reports intentionally retain failing outcomes: M7K's accepted captured report records 278 discovered, 121 passed, 82 failed, and 75 skipped; M7R records 278 discovered, 118 passed, 85 unexpected, and 75 skipped. Those report statuses are historical evidence, not failures observed by the current baseline run, and the reports do not qualify the broad E2E suite. M7S records zero verified fixes and is a manual diagnostic, not an automated pass.

## Initial cost profile

Measured:

- Full configured Vitest suite: 142.73 seconds with Node 24.3.0 and four workers.
- Test-source inventory: 162,660 newline-counted lines across 462 test/benchmark/diagnostic sources.
- Path-based test-support subtotal: 48,557 lines across 132 files.
- Test-only production paths identified so far: src/render/testing is 4,396 lines; src/render/webgpu/groundGlassWebGpuTestSeam.ts is 1,291 lines in total. The latter includes type/schema material and opt-in gated runtime helpers; approximately 460 lines are gated helper implementation by source inspection. This is not an emitted-bundle measurement.

NOT_MEASURED:

- GitHub Actions time for Vitest, E2E, production build, M7 source fetches, or each M7 replay/validator.
- Browser execution time for ordinary smoke and production-preview isolation.
- Emitted production bytes attributable to test seams.
- Full semantic test-support LOC outside the explicitly inventoried roots.

## References

- Repository workflow: docs/AI_AGENT_WORKFLOW.md and AGENTS.md.
- Test runner/configuration: package.json, vitest.config.ts, playwright.config.ts, playwright.production.config.ts, scripts/test.mjs, scripts/ci-local.mjs, scripts/e2e-spec-policy.mjs, .github/workflows/pages.yml.
- Methodology: [test-audit SKILL.md](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/SKILL.md), [CAMPAIGN.md](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/CAMPAIGN.md), [references/audit.md](https://github.com/openclaw/openclaw/blob/main/.agents/skills/test-audit/references/audit.md), and [writing-tests.md](https://github.com/openclaw/openclaw/blob/main/docs/help/testing/writing-tests.md). The audit adopts their evidence and ownership criteria, not their commands or infrastructure.
