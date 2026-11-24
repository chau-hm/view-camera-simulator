# Core Regression GitHub CI Decision

## Final decision

# `RETAIN_FULL_GITHUB_SUITE`

Keep `npm run test` on every authoritative GitHub `ci` execution. Do not replace it with the 48-file Core Regression candidate in this change. This is the final B4 decision because the candidate has demonstrated blind spots, the owner map is not complete enough for GitHub impact routing, and historical evaluator/provenance Unit contracts do not have equivalent conditional owners. The full GitHub run is now measured; candidate-on-GitHub timing and billed runner cost remain unavailable, so there is no matched savings evidence to justify added routing complexity.

This decision does not make the audit unsuccessful. It resolves B3's `CORE_REGRESSION_NEEDS_REVIEW` by retaining the current gate until the required preservation proof exists.

## Current measured and unmeasured cost

| Measurement | Result | Interpretation |
|---|---:|---|
| Full Vitest, local macOS arm64, Node 24.3.0, `maxWorkers=4` | 354 files / 4,384 cases; 84.027 s and 124.032 s in two runs | Measured at B4 base SHA `af680d7f9409bab13c6654abaaa2dad5aeac8079`; both runs passed |
| Core candidate, same local source/tool/worker conditions | 48 files / 611 cases; 11.012 s and 16.223 s | Measured candidate-only Vitest steps; not an equivalent full Local CI pipeline |
| Paired local Vitest step differences | 73.015 s and 107.809 s | Run-to-run variation is substantial; descriptive only, not a GitHub or billing projection |
| Full `ci:local` duration | 160.413 s and 163.271 s | Includes CSS check, lint, typecheck, full Vitest, and build |
| Current exact B4 PR-head GitHub workflow | Run #2215, `pull_request`, head `c6b1957facf73ebaea92aee38e57cc43814c16c8`, base `af680d7f9409bab13c6654abaaa2dad5aeac8079`; Ubuntu `ubuntu-26.04`, Node 24 | Entire workflow 17m21s; authoritative `ci` job 16m54s; both concluded success |
| GitHub `ci` step durations | Install 58s; Chromium setup 19s; lint 24s; typecheck 31s; full Unit/Integration 298s; ordinary smoke 126s; Production Preview 431s; M7R 1s; M7V 5s | Measured step wall times from GitHub job timestamps. Vitest reported 354 files / 4,384 tests passed in 297.51s. Browser results: 2/2 and 4/4 passed. Production Preview step includes its production build/browser qualification. |
| Historical qualification on exact B4 PR head | Decision job 11s; result `NOT_APPLICABLE`; result artifact 761 bytes, SHA-256 `1ae3820d673c2d247b073f3848bb324473d0cfefba676888d4e1dfcb1b28932c` | Changed-mode qualification ran and preserved an explicit result; docs-only change selected no historical family. |
| Retained source-history fetches | 9 steps; all passed; summed reported step wall time 9s | Sum of per-step GitHub timestamps (rounded to whole seconds); per-fetch values were 0–2s |
| Current GitHub billed runner minutes / cost | `NOT_MEASURED` | GitHub API job elapsed times are not billed-runner usage data |
| Core candidate runtime on GitHub-hosted runner | `NOT_MEASURED` | No matched candidate/full execution exists on the same GitHub runner and source revision |

Local candidate runtime is shorter in both matched pairs, but full and candidate times each vary materially between runs. These measurements show only a smaller local Vitest selection, not a stable saving or whole-workflow reduction. Ordinary browser smoke, Production Preview, package installation, Chromium setup, build, source-history fetches, job startup, and historical qualification remain separate costs. Neither paired local difference can be applied to total GitHub elapsed time or billed runner minutes.

## Architecture comparison

| Option | Coverage model | Advantages | B4 evidence and risks | Decision |
|---|---|---|---|---|
| A — Retain full mandatory Vitest | Run `npm run test` on every authoritative application CI event | Existing, simple, independent proof across all 354 files / 4,384 cases; no changed-file classifier can omit a test; preserves all M7 Unit contracts | Continues full Vitest cost. Exact B4 `ci` elapsed time is 16m54s; candidate-on-GitHub time and billed cost remain unmeasured. | **Select** |
| B — Core mandatory plus automatically affected tests | Run candidate, then resolve changed files to affected tests; unknown impact must run full suite | Could reduce routine work while keeping Unit tests independent of local execution | B3 owner data is not a complete transitive dependency graph. `src/scenes/**` reports incomplete without selecting full Vitest; renderer, shared optics, fixtures, dynamic imports, schemas, and history evaluators can cross owner boundaries. Candidate misses at least the demonstrated B1 defect. | Reject for now |
| C — Core plus dedicated domain gates | Use stable required jobs for optics, rendering, scenes, historical evaluator/provenance, and other domains | Named domain ownership could preserve contracts more clearly than one broad selector | More job startup; possible duplicate installs/builds/browser runs/source fetches; harder Required Check and skipped-result aggregation; no evidence that added jobs reduce aggregate runner time. Archive jobs do not execute active evaluator Unit tests. | Reject for now |
| Hybrid B/C | Core plus conservative affected selection and independent domain jobs | Could eventually combine clear owners with a broad fallback | Highest routing and maintenance complexity; all impact/fail-closed and cost questions above remain unresolved. | No current authorization |

The simplest safe architecture is the existing Option A. No status-check identity, GitHub workflow, test assertion, or production deployment behavior changes in B4.

## Why the candidate is not equivalent

The controlled B1 counterexample is decisive: on an isolated clone of the exact current B4 source `af680d7f`, a deliberate far-output mutation left all 48 candidate files / 611 cases green, while omitted `groundGlassWebGpuB1Reference.test.ts` failed four cases. Other omitted tests own fixed projection values, finite-focus boundaries, focal-length propagation, scene-specific mounted geometry, coverage rendering, M7D evaluator controls, B1/B2 routing, and Local CI report integrity. See the [omitted-test ledger](./CORE_REGRESSION_OMITTED_TESTS.md).

The current local owner map remains useful for developer feedback, not GitHub suite reduction. Static local imports are incomplete evidence for runtime ownership. A selector must also account for re-exports, literal and non-literal dynamic imports, `vi.doMock`, `importActual`, filesystem-source tests, test support, setup, environment variables, generated files, schemas, package scripts, additions, deletions, and both sides of renames. Unknown or incomplete impact must widen to full Vitest.

## Historical evidence and provenance policy

1. Keep active M7 evaluator, normalizer, parser, CLI, schema, and provenance Unit tests in full mandatory `npm run test`.
2. Keep the B2 automatic historical archive qualification and explicit full replay. Replay checks frozen artifacts and exact source identity; it is not a substitute for those Unit tests.
3. Keep M7R's unconditional ordinary-CI integrity owner and M7V's mandatory source-declaration/skip-governance policy checks.
4. Keep the exact-source tests for shallow history, retained PR refs, and verified source-tree paths. Any future source-fetch/provenance changes must execute those contracts before merge.
5. Keep the current ordinary Chromium smoke, Production Preview WebGL-isolation/build gate, renderer lifecycle evidence, and any required native/visual qualification on their appropriate independent paths. Vitest cannot establish browser pixels, GPU backend execution, or public frame delivery.
6. An unknown historical family dependency, changed evaluator import, or ambiguous provenance impact must run a broader qualification and full Vitest, never be classified as not applicable by an empty result.

## Bounded follow-up plan

### Next work packet — Close preservation evidence without changing the gate

Do this only if measured GitHub runtime gives a concrete reason to consider reduction:

1. Preserve B4 run #2215 as the measured full-suite baseline: `ci` 16m54s, workflow 17m21s, historical decision `NOT_APPLICABLE` in 11s, and nine successful source-history fetches totaling 9s. Keep billed runner minutes and candidate-on-GitHub time `NOT_MEASURED`; obtain a same-runner comparison only if a separate shadow experiment is justified.
2. Review the 271 `INVENTORY_ONLY` files in bounded contract-owner groups. Promote a file out of Category D only after reading its full assertions, source owner, callers, sibling tests, CI route, and realistic fault model.
3. Extend mutation evidence to the high-impact gaps without changing production or required-CI behavior: focus/focus-plane boundaries, fixed image-circle/raster references, stale-frame and renderer generations, scene/task reachability, shared evaluator routing, exact-source provenance, and browser pixel delivery. Use throwaway worktrees and report survivors as uncovered contracts.
4. Build a reviewed test-impact map for actual source paths, including dynamic/data/test-support dependencies and new, removed, and renamed paths. Add negative routing proof for unknown paths and every incomplete owner. An empty or incomplete impact result must resolve to full Vitest.
5. Keep any comparison job or candidate execution explicitly non-authoritative until it has exact-commit, clean/dirty-state, environment, discovery, command, pass/skip, timing, and artifact-integrity evidence. Do not change Required Checks during this evidence-closure phase.
6. Obtain an independent preservation review that can reject any future narrowing without invalidating this audit.

### Only after those criteria pass — Separate reduction implementation PR

A later reduction PR must be narrow and reversible. It must name the exact files/contracts moved, the new automatic owner, source-impact trigger, conservative full-suite fallback, stable Required Check identity, real test execution evidence, rollback procedure, and current-head GitHub comparison. Start with one well-bounded group; do not replace the full suite with the candidate in one step. Keep a test in mandatory coverage if a mutation survives the proposed mandatory set or if its impact is unknown.

No immediate Core Regression reduction PR is recommended. If the evidence-closure work cannot produce reliable independent owners or meaningful GitHub cost improvement, retain full Vitest as the durable policy.

## Required invariants for any future proposal

- The authoritative GitHub result executes the test contract; a skipped or neutral job cannot masquerade as a pass.
- Changes to test code, fixtures, setup, CI routing, owner manifests, package scripts, schemas, or source-history logic receive broad validation.
- Unknown, incomplete, stale, added, deleted, renamed, or ambiguous paths widen to full coverage.
- M7 archive replay and active M7 Unit tests remain distinct owners.
- M7R and M7V remain unconditional unless a separately reviewed equivalent is live and independently enforced.
- Ordinary browser behavior, Production Preview isolation, visual pixels, native GPU behavior, and historical provenance remain named independent contracts.
- Matched timing compares the same commit, runner image, Node/tool versions, dependency state, worker configuration, and workflow stages. Report elapsed time separately from billed runner minutes.
