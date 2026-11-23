# Historical Evidence Qualification

This document describes the archive lane introduced by PR B2. It validates retained M7 evidence and its provenance. It does not prove that the current renderer, application, or browser behavior works.

## CI responsibilities

The `pages.yml` `ci` job remains the ordinary application validation result and keeps its existing name. It continues to run ESLint, TypeScript checking, the full Vitest suite, ordinary Chromium smoke, production build/preview isolation, M7R evidence integrity, and the M7V policy check. M7V's reviewed source declaration, E2E inventory, and skip/fixme governance remain in that job.

`historical-qualification.yml` is called by Pages CI with `mode: changed`. It obtains the complete PR file list or the exact push tree diff and executes only the matching historical family dependency closure. A no-applicable-change result is `NOT_APPLICABLE`; it avoids `npm ci`, pinned source fetching, and archive replay. The standalone `Historical Evidence Qualification` workflow dispatch uses `mode: full` and runs every registered archive validator, including M7R; the known M7S–M7U gaps remain `UNVERIFIED`.

PR #360 feature-push routing remains authoritative for event deduplication. A feature push is suppressed only when that router verifies that the current PR head has a matching PR `ci` run. The archive job is skipped with that redundant push run. A push with no PR, uncertain PR association, API failure, or missing exact-head check runs full feature-push validation, including archive qualification where applicable.

The Pages `ci` job depends on the feature-push gate and the historical workflow result. Its job condition uses `always()` so an archive failure does not silently skip the `ci` check. A first step verifies the actual dependency result and accepts only `QUALIFIED` or justified `NOT_APPLICABLE`. `FAILED`, `UNVERIFIED`, missing outputs, or an unexpected skip fail the `ci` job. The production deploy condition and `needs: ci` dependency are unchanged.

This dependency makes `ci` fail closed inside the workflow. It is not a claim that GitHub Branch Protection or a Ruleset is configured.

## Change-to-family map

The source of truth is [`scripts/historical-evidence-manifest.json`](../../scripts/historical-evidence-manifest.json). It lists each family’s artifact roots, required report files, command, existing ordinary-CI test owner, retained source pins, and source-tree paths. Matching includes added, modified, deleted, and both sides of renamed files.

| Changed input | Qualification |
|---|---|
| M7E capture or replay inputs | M7E plus M7G, then M7H/M7I/M7J and M7K consumers of the retained M7G raw report; downstream M7K consumers also run |
| M7F capture or replay inputs | M7F plus M7G; the lane compares the standalone and M7G child reports, then validates M7H/M7I/M7J and M7K consumers |
| M7G report/evaluator inputs | M7G plus the M7H/M7I/M7J and M7K report consumers; downstream M7K consumers also run |
| M7H inputs | Archive M7H, M7I, M7J, M7K and downstream M7L, M7M, M7Q; M7R runs in ordinary CI |
| M7I inputs | M7I, M7J, M7K, and downstream M7L/M7M/M7Q; M7R runs in ordinary CI |
| M7J inputs | M7J, M7K schema-v1 and schema-v2, and downstream M7L/M7M/M7Q; M7R runs in ordinary CI |
| M7K inputs | Archive M7K schema-v1 and schema-v2, M7L, M7M, and M7Q; M7R runs in ordinary CI |
| M7L inputs | M7L and M7M |
| M7M, M7N, M7Q, or M7W inputs | The matching archive family |
| M7O or M7P inputs | The matching archive family and M7Q, which pins both reports and the M7P normalized capture |
| M7R inputs | M7R's unconditional Pages check; a manual full archive replay may also run it |
| M7V report, inventory, or validator input | M7W archive validation; current M7V policy validation remains in ordinary CI |
| Package manifest/lock, Playwright configuration, Pages or qualification workflow, source-fetch helper, manifest, or router/runner | All automatically routed archive families; M7R and M7V owners remain in ordinary CI |
| M7S–M7U inputs, an unmapped M7 family, or an unknown evidence-like dependency | Run all automatically routed validators and return `UNVERIFIED`; there is no registered equivalent validator for these inputs |
| Application source without a historical evidence dependency | `NOT_APPLICABLE`; current application tests still run in ordinary CI |

Family dependencies follow report and tooling consumers, not just filenames. M7H and M7K both validate the pinned M7G raw report; M7I consumes M7H; M7J consumes M7I; and M7K validates the M7G, M7H, M7I, and M7J report set. M7K report data is consumed by M7L/M7M/M7R. M7Q pins the M7O and M7P reports plus the M7P normalized capture. M7W validates declared M7V governance inputs. M7R is included in the dependency graph but its validator is already an unconditional Pages owner, so automatic archive routing reports that owner instead of executing it twice. A shared manifest or qualification infrastructure change expands to all automatically routed families and preserves the M7R/M7V checks in ordinary CI.

M7R remains in ordinary CI because its frozen evidence checker verifies that its analysis tooling still matches the exact historical source tree and that `pages.yml` contains one unconditional M7R validation step. Editing that evaluator or moving its required step would invalidate the evidence it is intended to protect. The manifest marks this owner explicitly; changed M7R paths return `NOT_APPLICABLE` only for the archive lane, while the ordinary M7R check still runs and can fail the authoritative `ci` job. Manual `--all` includes M7R.

## Decision states

| Decision | Meaning | Can permit Pages `ci` to pass? |
|---|---|---|
| `QUALIFIED` | Every selected validator and required source-tree check ran and passed | Yes |
| `NOT_APPLICABLE` | Complete changed-path analysis found no archive dependency | Yes |
| `FAILED` | Source and required artifacts were available, but a selected evidence-integrity validator failed | No |
| `UNVERIFIED` | The path set, source, tree path, validator, artifact, API response, or execution could not be verified; this takes precedence if another validator also failed | No |

API errors, stale PR heads/bases, incomplete file pagination, unavailable push history, unknown evidence paths, missing artifacts, missing permissions, or unavailable source history cannot become `NOT_APPLICABLE`. The router executes the broad supported set when it can, but preserves `UNVERIFIED` if the affected input set could not be established. A failed frozen browser qualification recorded in a report remains that historical result; it is not rewritten as a current browser failure or success.

## Source provenance and reproducibility

The archive job starts from `actions/checkout` with `fetch-depth: 1` and does not persist checkout credentials. On an applicable route, it expands main history and retrieves the pinned/squash-merged sources in the manifest using `scripts/fetch-m7k-execution-source.mjs`. Retained PR refs are kept for sources introduced by squash-merged PRs. The fetch helper verifies each listed source path at the exact commit, not only the commit object. The result artifact records the checkout SHA, Node/platform versions, source SHAs, retained refs, and exact verified source paths.

M7E and M7F now have explicit retained-source and tree-path checks: M7E checks its capture evidence implementation at the PR #303 source SHA; M7F checks its presentation evaluator and the capture/test files at PR #304. M7J checks the PR #308 source files. M7M–M7Q and M7W preserve the exact source SHAs, retained refs, and paths from the former Pages validation. M7R retains its four pinned sources in the ordinary Pages job and in the manual archive manifest. M7W derives its execution spec-path list from the checked-in M7V inventory and verifies those paths at the pinned execution SHA. Validators also retain their report-declared digests and schemas.

The M7K schema-v1 and schema-v2 reports are separate commands. Historical outcomes such as `not-qualified` remain unchanged; the archive lane requires the integrity evaluator to accept the recorded outcome. When both M7F and M7G are selected, the lane compares the standalone report digest and source/replay identity with M7G's child replay metadata, including the 17-scenario result and qualification decision.

The M7S, M7T, and M7U report/capture families do not currently have equivalent `evidence:check` validators. The manifest records the gap and an applicable change returns `UNVERIFIED`. Existing M7U current-runtime tests remain in the full ordinary Vitest suite.

## Local and manual use

With Node.js 24 and project dependencies installed:

```bash
npm run evidence:qualification:historical -- --files=docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION_REPORT.json
```

This runs the mapped validator closure and checks required sources. `--all` runs all supported families. Because M7S–M7U currently have no complete verifiers, a full run reports `UNVERIFIED` for those known gaps even if every supported validator passes.

For a standalone full GitHub run, dispatch the `Historical Evidence Qualification` workflow and select `full`. The result JSON and step summary record the decision, paths, selected families, pinned-source fetches, validators, and any gaps. The workflow is read-only and cannot deploy Pages.

## Debugging

1. Read the Pages `ci` first-step message and the `Historical Evidence Qualification` step summary.
2. Download the `historical-qualification-<run>-<attempt>` artifact for the machine-readable result.
3. For `UNVERIFIED`, check file pagination/head identity, Git history/ref availability, exact source-tree paths, and required artifacts before changing a validator.
4. For `FAILED`, use the failing command output and the family’s evaluator tests. Do not change a historical report to make its old qualification decision green.
5. Keep the full Vitest suite and M7V check as separate current regression/policy evidence.
6. Keep the ordinary M7R evidence check separate from archive replay; its frozen workflow contract is not current renderer or browser evidence.

## Rollback

Use a normal follow-up revert PR for the B2 workflow change. Restore the former M7E/F/J–Q/W source-fetch and evidence-check steps in `pages.yml`; M7R and M7V remain there in either state. Remove the reusable qualification job and router files only after the ordinary path again contains the complete mandatory historical checks. Keep all archived reports, captures, source records, evaluator implementations, and tests. Do not rewrite shared history or alter production deployment conditions.

## Cost evidence

The pre-migration baseline is the successful `ci` job in GitHub Actions run [#45202761520](https://github.com/chau-hm/view-camera-simulator/actions/runs/45202761520) for base SHA `981fea7e0e969a7494ad58b319d906650ad7c891`. Its job elapsed 14m47s by the Actions timestamps. The Pages job had 14 named historical source-fetch steps and 16 direct M7 evidence replay/integrity commands. The migrated Pages job retains 10 named fetch steps: eight provenance groups required by full Vitest, the four-source M7R group, and the M7V baseline. It retains two direct evidence checks, M7R and M7V. Counts describe scheduled work, not runner-minute savings. The corrected post-migration Pages run has not completed yet, so post-migration job time and runner time remain `NOT_MEASURED`.

The targeted local M7F/M7G comparison measured the standalone M7F replay at 460 ms and M7G at 54,918 ms. Both commands exited successfully. The standalone and child report SHA-256 were identical (`50e0928061c2ccc31aa3d18cd8b46ee917266bc51393773ab934bafcc3fa9033`); both named capture source SHA `b10118bd0f656296451520ba10f4d32347a9a552`, replay source SHA `981fea7e0e969a7494ad58b319d906650ad7c891`, and 17 passed scenarios with no failed, blocked, or not-run scenarios. M7G retained `partially-qualified` as its historical qualification state while evidence integrity passed. This local run's final archive decision was `UNVERIFIED` because the sandbox denied writing Git's `FETCH_HEAD`; the validators and route comparison themselves passed. The current-head GitHub Actions archive run is required to prove clean shallow-checkout reproducibility. End-to-end wall time and runner time after migration remain `NOT_MEASURED` until that run completes.
