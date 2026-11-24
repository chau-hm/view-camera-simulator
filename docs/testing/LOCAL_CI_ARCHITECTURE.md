# Local CI Architecture

## Purpose and trust boundary

Local CI is the primary development feedback loop. Its JSON report identifies the exact commit and tracked/untracked worktree state that the local tools checked. The report is local evidence; it is not a GitHub Required Check and cannot replace the independently executed PR merge gate.

The compatibility reference is the repository's Node 24 GitHub setup in `.github/workflows/pages.yml`. The runner requires Node 24.x and checks npm, the installed Vitest dependency, and requested Playwright/browser prerequisites. It does not run `npm install`, download browsers, or alter system packages. Set up dependencies and browser binaries through the developer's normal setup process, then rerun validation.

## Commands

| Command | Runs | Scope statement |
|---|---|---|
| `npm run ci:local` | CSS structure, ESLint, TypeScript, configured full Vitest suite, production build | Full local application CI. Does not imply E2E, production-preview, visual, or native GPU qualification. |
| `npm run ci:local:e2e` | The same full local sequence, then each top-level development Playwright spec serially with one worker | Retains the previous extended development E2E route. Production-preview `*-production.spec.ts` files remain excluded by `scripts/e2e-spec-policy.mjs`. |
| `npm run ci:local:focused -- --tests <path>` | Explicit Vitest files | Fast selected feedback. It cannot claim full repository validation. |
| `npm run ci:local:focused -- --owner <id>` | The selected owner group's Vitest tests | Owner IDs and tests are in `scripts/local-ci/owners.json`. Add `--with-e2e` to execute that owner's mapped browser specs. |
| `npm run ci:local:affected -- --base origin/main` | Tests mapped to changed source contracts | Uses the explicit owner map and includes changed files from the base-to-HEAD diff and the current worktree. Add `--with-e2e` to run mapped browser checks. |
| `npm run ci:local:core` | The candidate Vitest files in `coreRegressionOwnerIds` | Non-authoritative Core Regression pilot. It does not replace full Vitest locally or on GitHub. |

Additional tests are additive in affected mode:

```bash
npm run ci:local:affected -- --base origin/main --tests src/tests/unit/extraContract.test.ts
npm run ci:local:affected -- --base origin/main --with-e2e
npm run ci:local:focused -- --e2e-spec src/tests/e2e/smoke.spec.ts
```

Specialized browser routes are explicit:

```bash
npm run ci:local:focused -- --e2e-spec src/tests/e2e/architecture-rise-webgpu-production.spec.ts --production-preview
npm run ci:local:focused -- --e2e-spec src/tests/e2e/architecture-rise-webgpu-validation.spec.ts --native-webgpu
```

The production-preview route uses `playwright.production.config.ts` and its existing build/preview server. Native WebGPU uses the headed system Chrome project and test-specific required-backend flags. The test must assert the native backend; skipped native cases result in `INCOMPLETE`. Ordinary Chromium, production-preview WebGL isolation, visual evidence, and native WebGPU remain distinct qualifications. A passing local browser report does not identify a physical GPU model unless the test reports one.

## Full and E2E compatibility

The full sequence in `ci:local` remains CSS structure → lint → typecheck → full Vitest → production build. The JSON reporter is added to the existing test invocation; test selection is not reduced. `ci:local:e2e` retains the prior development-spec policy and serial per-spec execution. Production-preview specs are still an explicit qualification and are never added to ordinary E2E discovery.

Playwright work is not included in `ci:local` by default. GPU-heavy tests should not be launched in parallel with full Vitest or other renderer-sensitive checks. Use one explicit browser qualification at a time when the environment requires it.

## Affected-test ownership

The maintained source-to-owner map is `scripts/local-ci/owners.json`. It records source path patterns, the owning Vitest files, browser requirements, and the reason for each mapping. It is based on the contract owners in `TEST_AUDIT_LEDGER.md`; it is deliberately conservative for shared paths.

- A change under `src/core/optics/**` selects fixed-reference optics and downstream projection/coordinate tests, and recommends the mapped public-browser checks.
- A change under `src/render/**` selects Ground Glass coordinate and renderer/frame/resource owners. Mapped browser checks run only when requested with `--with-e2e` or an explicit `--e2e-spec`.
- A change under `src/render/webgpu/**` also selects deterministic adapter/runtime owners and records native WebGPU qualification as a separate requirement. Ordinary Chromium does not satisfy it.
- Scene route/config, controls, and task paths select their registry, integration, and public-control owners. Any `src/scenes/**` implementation change is explicitly `INCOMPLETE` in affected mode because scene-specific geometry, materials, tasks, and renderer dependencies are not exhaustively mapped; use full local CI for a complete result. This avoids a misleading narrow PASS without triggering unrelated WebGPU research suites.
- A change under `src/tests/**` selects full Vitest. A direct E2E spec is recorded as its own browser target; an E2E helper/fixture change recommends all development E2E specs.
- Changes to scripts, package metadata, runner configuration, or workflow files select full local CI.
- A rename contributes both old and new paths.
- `--tests` paths are retained in addition to mapped owners.

If an affected path has no owner, or an owner references a missing test, the runner selects full Vitest and records `INCOMPLETE`; it does not turn unknown ownership into a complete PASS. If there are no changed files relative to the requested base, the result is `NOT_RUN`.

This is a path-to-contract map, not a complete dependency graph. A shared change outside its known paths uses the safe fallback. Reviewers should add or broaden an owner when an import/data-flow relationship shows that a mapped contract can be affected.

## Reports and result meanings

Each invocation writes to an ignored, worktree-local directory:

```text
.agents/output/ci-local/<timestamp>-<pid>-<run-id>/report.json
```

The directory is unique per invocation and worktree, so parallel worktrees do not overwrite each other's reports. Runner JSON and Playwright output are stored alongside it. Generated reports are not committed by default.

Each step's stdout and stderr are captured in a mode-0600 local `.log` artifact and included in the report by relative path and SHA-256 digest. Normal output prints a concise step result; add `--verbose` to stream the child output. A failed or incomplete step names its log path. Full logs are never embedded in the JSON report.

The report includes schema version, repository identifier, commit SHA, branch, mode, requested/resolved base, staged/unstaged/untracked paths, source fingerprint, Node/npm/Vitest/Playwright/ESLint/TypeScript/Vite versions, OS/architecture, configured worker setting, exact command arguments, timestamps/durations, runner-derived discovery/execution counts, exit codes, artifact digests, and qualification status. It omits the local worktree root and normalizes test file paths to repository-relative paths.

The source fingerprint is SHA-256 over the Git binary diff from `HEAD`, sorted Git status entries, and sorted untracked file names/content (with symlink targets recorded). Untracked files above the 100 MiB fingerprint limit block a complete result. A second snapshot runs after validation. A changed commit, content fingerprint, or staged-state fingerprint makes the overall result `INCOMPLETE`.

Vitest counts come from its JSON reporter: `testResults.length` is the discovered file count; `numTotalTests`, `numPassedTests`, `numFailedTests`, `numPendingTests`, and `numTodoTests` provide case counts; Vitest's suite count is recorded separately. The case totals must reconcile, and explicitly selected files must exactly match the runner's discovered paths. Playwright reports must include flaky counts and discovered spec names, which are compared with each explicit one-spec command; Playwright's JSON reporter exposes a basename rather than a repository-relative spec path, so the exact command path is retained separately in the report. Missing/malformed reporter data or a selection mismatch is `INCOMPLETE`, never estimated from source text. A nonzero failure count remains `FAIL`; skipped, todo, or flaky cases cannot produce a complete PASS.

| Status | Meaning | Exit code |
|---|---|---:|
| `PASS` | Every step in the requested scope executed and passed with no failed, skipped, or flaky runner cases. Focused/core modes still report `repositoryCoverage: partial`. | 0 |
| `FAIL` | A validation command failed. | 1 |
| `INCOMPLETE` | Environment unavailable, source changed during execution, ownership/browser/GPU proof missing, runner evidence malformed, or a selected runner reported skipped/flaky cases. | 2 |
| `NOT_RUN` | Invalid/empty selection or requested base did not permit validation to start. | 2 |

An incomplete focused report is not a full CI failure; it means the report cannot support a complete claim for the requested contract set. A dirty worktree may pass if its exact content and index state remain stable during the run, but that is a dirty-source result and does not prove the commit alone.

## Compare with GitHub CI

Use the local report to see the exact source and commands exercised, then inspect the PR's actual Required Checks. The authoritative GitHub `ci` job continues to run lint, typecheck, full `npm run test`, ordinary Chromium smoke, production-preview WebGL isolation, M7R evidence integrity, and M7V policy/skip governance. B1 feature-push routing and B2 historical qualification remain unchanged by this PR.

Historical qualification remains automatic for Evidence-sensitive changes and manual full replay remains available through `.github/workflows/historical-qualification.yml`. Historical report replay is separate from current browser/renderer behavior. A local PASS does not satisfy either the Required Check or an applicable historical qualification result.
