# Historical Evidence Qualification

This document describes incremental historical qualification and cumulative production-release qualification. It validates retained evidence and its provenance. It does not prove that the current renderer, application, or browser behavior works.

## CI responsibilities

The `pages.yml` `ci` job remains the ordinary application validation result and keeps its existing name. It continues to run ESLint, TypeScript checking, the full Vitest suite, ordinary Chromium smoke, production build/preview isolation, M7R evidence integrity, and the M7V policy check. M7V's reviewed source declaration, E2E inventory, and skip/fixme governance remain in that job.

`historical-qualification.yml` is called by Pages CI with `mode: changed` for pull requests and ordinary pushes. It obtains the complete PR file list or exact push tree diff and executes only the matching historical family dependency closure. A no-applicable-change result is `NOT_APPLICABLE`; it avoids `npm ci`, pinned source fetching, and archive replay. A push to `production` uses `mode: production-release` and follows the cumulative release policy below. The standalone `Historical Evidence Qualification` workflow dispatch still uses `mode: full` and runs every registered archive validator, including M7R; its known M7S–M7U validator gaps remain `UNVERIFIED`.

PR #360 feature-push routing remains authoritative for event deduplication. A feature push is suppressed only when that router verifies that the current PR head has a matching PR `ci` run. The archive job is skipped with that redundant push run. A push with no PR, uncertain PR association, API failure, or missing exact-head check runs full feature-push validation, including archive qualification where applicable.

The Pages `ci` job depends on the feature-push gate and historical workflow result. Its job condition uses `always()` without a cancellation exclusion so the first-step gate can reject cancelled, skipped, or missing dependencies instead of leaving a skipped `ci` check. The gate accepts `QUALIFIED` or justified `NOT_APPLICABLE` for development routes. It accepts `QUALIFIED_WITH_LEGACY_ARCHIVAL` only when the event is a production push, the selected mode is `production-release`, and the ref is `refs/heads/production`. A production push routed as incremental qualification fails the gate. `FAILED`, `UNVERIFIED`, missing outputs, or an unexpected skip also fail `ci`. Deployment still requires successful `ci` and the exact production push condition.

This dependency makes `ci` fail closed inside the workflow. It is not a claim that GitHub Branch Protection or a Ruleset is configured.

## Change-to-family map

The source of truth is [`scripts/historical-evidence-manifest.json`](../../scripts/historical-evidence-manifest.json). It lists each family’s artifact roots, required report files, command, existing ordinary-CI test owner, retained source pins, and source-tree paths. Matching includes added, modified, deleted, and both sides of renamed files.

| Changed input | Qualification |
|---|---|
| M7E capture or replay inputs, including its listed runtime source dependencies | M7E plus M7G, then M7H/M7I/M7J and M7K consumers of the retained M7G raw report; downstream M7K consumers also run |
| M7E architecture report or audit documentation | M7E plus its registered dependency closure; the two root documentation paths are explicit manifest inputs |
| M7F capture or replay inputs, including its listed runtime source dependencies | M7F plus M7G; the lane compares the standalone and M7G child reports, then validates M7H/M7I/M7J and M7K consumers |
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
| Production qualification baseline, proof code, incident fixture, or their tests | All automatically routed archive families; production proof and baseline changes cannot narrow the validator set |
| M7S–M7U inputs, an unmapped M7 family, or an unknown evidence-like dependency | Run all automatically routed validators and return `UNVERIFIED`; there is no registered equivalent validator for these inputs |
| Application source without a historical evidence dependency | `NOT_APPLICABLE`; current application tests still run in ordinary CI |

Family dependencies follow report and tooling consumers, not just filenames. The manifest's `replaySourcePaths` lists the transitive runtime source imports of the M7E and M7F replay entry points. This explicitly routes generic-named shared modules such as `groundGlassPresentationReference.ts`, `groundGlassM6bSpatialConformance.ts`, and `groundGlassInspectionWindow.ts`, whose changes can alter M7F replay results without containing an M7 family token. A routing test recomputes both TypeScript runtime import closures and requires the manifest to match, so adding or removing a replay dependency cannot silently leave a stale path list. These are current replay dependencies; they do not replace the separate exact historical SHA and source-tree checks in `sourcePins`. M7H and M7K both validate the pinned M7G raw report; M7I consumes M7H; M7J consumes M7I; and M7K validates the M7G, M7H, M7I, and M7J report set. M7K report data is consumed by M7L/M7M/M7R. M7Q pins the M7O and M7P reports plus the M7P normalized capture. M7W validates declared M7V governance inputs. M7R is included in the dependency graph but its validator is already an unconditional Pages owner, so automatic archive routing reports that owner instead of executing it twice. A shared manifest or qualification infrastructure change expands to all automatically routed families and preserves the M7R/M7V checks in ordinary CI.

M7R remains in ordinary CI because its frozen evidence checker verifies that its analysis tooling still matches the exact historical source tree and that `pages.yml` contains one unconditional M7R validation step. Editing that evaluator or moving its required step would invalidate the evidence it is intended to protect. The manifest marks this owner explicitly; changed M7R paths return `NOT_APPLICABLE` only for the archive lane, while the ordinary M7R check still runs and can fail the authoritative `ci` job. Manual `--all` includes M7R.

The router records path ownership separately from validator selection: registered historical validators, registered ordinary-CI checks, qualification infrastructure, non-evidence content, and unresolved inputs remain distinguishable in the result. Ordinary owners are constrained to the checked-in owner registry and the Pages workflow retains the corresponding M7R/M7V commands and ordinary unit-test suite. For example, a changed M7R report is owned by `ordinary-ci:evidence:check:m7r`; `NOT_APPLICABLE` means only that the archive lane does not run M7R twice. It does not waive the ordinary check. M7V inputs retain the ordinary `evidence:check:m7v` owner and also route to the M7W evidence validator.

Unknown additions beneath the manifest's explicit nested `legacyEvidenceRoots`, beneath an archive-named directory under `docs/architecture/`, or with the existing historical-evidence path signals are unresolved in feature pushes, pull requests, main pushes, and production releases alike. These roots are detection scopes only; they do not grant archival acceptance. Generic architecture design documents without an evidence ownership signal remain non-evidence. A new report or capture must receive a registered validator or remain fail-closed before reaching production.

## Decision states

| Decision | Meaning | Can permit Pages `ci` to pass? |
|---|---|---|
| `QUALIFIED` | Every selected validator and required source-tree check ran and passed | Yes |
| `NOT_APPLICABLE` | Complete changed-path analysis found no archive dependency | Yes |
| `FAILED` | Source and required artifacts were available, but a selected evidence-integrity validator failed | No |
| `UNVERIFIED` | The path set, source, tree path, validator, artifact, API response, or execution could not be verified; this takes precedence if another validator also failed | No |
| `QUALIFIED_WITH_LEGACY_ARCHIVAL` | Every registered historical validator passed for a canonical production release; exact unchanged pre-policy archival/documentation dispositions remain explicitly unverified | Only for a production push in `production-release` mode |

API errors, stale PR heads/bases, incomplete file pagination, unavailable push history, unknown evidence paths, missing artifacts, missing permissions, or unavailable source history cannot become `NOT_APPLICABLE`. The router executes the broad supported set when it can, but preserves `UNVERIFIED` if the affected input set could not be established. A failed frozen browser qualification recorded in a report remains that historical result; it is not rewritten as a current browser failure or success.

## Source provenance and reproducibility

The archive job uses `actions/checkout` with complete Git history and does not persist checkout credentials. The runner uses the read-only workflow token for required Git fetches. Applicable routes retrieve pinned/squash-merged sources in the manifest with `scripts/fetch-m7k-execution-source.mjs`. Retained PR refs are kept for sources introduced by squash-merged PRs. The fetch helper verifies each listed source path at the exact commit, not only the commit object. The result artifact records the checkout SHA, Node/platform versions, source SHAs, retained refs, and exact verified source paths.

M7E and M7F now have explicit retained-source and tree-path checks: M7E checks its capture evidence implementation at the PR #303 source SHA; M7F checks its presentation evaluator and the capture/test files at PR #304. M7J checks the PR #308 source files. M7M–M7Q and M7W preserve the exact source SHAs, retained refs, and paths from the former Pages validation. M7R retains its four pinned sources in the ordinary Pages job and in the manual archive manifest. M7W derives its execution spec-path list from the checked-in M7V inventory and verifies those paths at the pinned execution SHA. Validators also retain their report-declared digests and schemas.

The M7K schema-v1 and schema-v2 reports are separate commands. Historical outcomes such as `not-qualified` remain unchanged; the archive lane requires the integrity evaluator to accept the recorded outcome. When both M7F and M7G are selected, the lane compares the standalone report digest and source/replay identity with M7G's child replay metadata, including the 17-scenario result and qualification decision.

The M7S, M7T, and M7U report/capture families do not currently have equivalent `evidence:check` validators. The manifest records the gap and an applicable change returns `UNVERIFIED`. Existing M7U current-runtime tests remain in the full ordinary Vitest suite.

## Cumulative production release qualification

Incremental qualification answers which historical evidence families depend on the current PR or push diff. It does not establish that a successful main workflow validated every older archive file accumulated in a production merge. Production release qualification has a separate policy and does not reuse a main workflow result, even when the promoted source SHA has a successful main run.

For a production event, the runner checks Git objects and requires all of the following:

- The checked-out SHA equals the event's exact `after` SHA and the event ref is `refs/heads/production`.
- The production result is a two-parent merge. Parent one equals event `before`; parent two is the promoted source revision.
- The source is an ancestor of the fetched `origin/main` revision.
- The production merge tree equals the promoted source tree.
- The fixed qualification baseline is an ancestor of the promoted source and its Git tree matches the pinned identity.

Commit messages and the previous production commit are not used as proof of source or deployment identity. The machine-readable result records the event before/after SHAs, verified parents, source/destination tree IDs, fetched main SHA, baseline identity, immediate event path count, and cumulative baseline-to-source path count.

Every production release runs all currently registered historical validators. It does not reuse a prior run's result. The Pages `ci` job then runs ordinary lint, typecheck, Vitest, Chromium smoke, production-preview checks, M7R evidence integrity, M7V policy validation, and build. Deployment remains behind successful `ci`.

### Fixed baseline and explicit legacy dispositions

The fixed baseline is the full Git tree at policy-introduction commit `a0b2fa4b2b9acc323c64a057599d10d3063cef8b`, tree `9643611510e9856890934097250423b7de65ded4`, whose pre-policy parent is `981fea7e0e969a7494ad58b319d906650ad7c891`. The baseline is not a last-deployed marker. Every production event rechecks the full baseline-to-source range and reruns current validators, so a failed deployment cannot disappear when a later production event has a small immediate diff.

The checked-in baseline contains one exact path and Git blob identity for every path that the change-triggered router could not classify across the full policy-introduction tree. It contains 139 entries: 84 historical reports/captures with no equivalent retained integrity validator, 8 documentation-only files whose technical claims are not validated, 45 source/test/tooling paths owned by ordinary CI, and 2 M7E root documentation paths now owned by the registered M7E validator. The 45 ordinary-CI entries include two scene-capacity helper/test paths that were already present before the failed production event; the unit test is their owner. Some report data is inspected by ordinary unit tests, but only selected fields are checked. Those tests do not turn the complete archival payload into a successfully validated artifact.

The failed run's 1,979-path event diff had 62 unsupported/unmapped family reasons and 75 unmapped dependency reasons. The full baseline inventory has 77 dependency paths because it also finds the two unchanged scene-capacity paths outside that event diff. Of the unsupported families, M7A/B/C/D/S/T/U/X still have no complete retained archive validator; ordinary tests cover some implementation code but not their full archived reports/captures. The M7E root Markdown paths were a routing defect: both now route to M7E and its dependency closure. M5/M6 and architecture/anatomy reports without an equivalent validator remain explicit unverified archive dispositions. Current ordinary tests consume selected M5S/M5T/M5U and anatomy GPU-blend report fields; this is recorded as partial ownership, not full archive integrity.

The baseline entry records exact path, blob SHA, kind, disposition, family where known, ordinary-CI owner where applicable, and a limitation. An unchanged `legacy-archival-unverified` entry is reported as such; it is never reported as a validator pass. `QUALIFIED_WITH_LEGACY_ARCHIVAL` is a distinct production-only decision. It explicitly accepts the exact retained pre-policy content as archival while preserving the fact that it has no equivalent current validator. This does not establish optical, renderer, or runtime correctness. Product-owner approval for this archival-only policy has not yet been recorded; reviewers must keep that separate from implementation and CI readiness.

If a baseline-protected path is modified, deleted, or renamed, the exact blob disposition is invalidated. The changed path goes through the same shared ownership classifier used by development; a registered validator or ordinary-CI owner is respected, and unknown/unsupported evidence remains `UNVERIFIED`. Newly added files do not inherit acceptance from a baseline directory or family name. A newly registered family validator supersedes that family's archival-only entries. Changes to the baseline or qualification infrastructure route to all automatic validators. The result records changed-path ownership and separately lists unchanged exact legacy dispositions, invalidations, ordinary-CI owners, non-evidence paths, and unresolved paths.

### Failed deployment recovery

Git promotion success is not Pages deployment success. The production branch HEAD can point at a release whose historical gate failed and deployment was skipped; it is not treated as the currently deployed revision. This design does not infer a deployed SHA from the preceding production commit and does not require a separate last-deployed-state store. Each production event is validated from the immutable policy baseline to its exact promoted main source, so the failed cumulative content remains in scope after production advances.

The exact regression reconstructs the event path list from `cee49160e9ae704a7aad2e2b8149fb72ddff965c` to `3e12da370add0d9107684dbcf73530ef5806a44b`, verifies the original 1,979-path route failure, then exercises the corrected production proof against the same merge and source objects. The compact fixture records the inspected artifact digest and the successful incremental run for source `cec404a84f9469bd21dbc3813c327f831c370e60`; that run inspected only two changed paths and is deliberately not reused as cumulative qualification evidence.

A prospective feature source that is not yet merged to `main` can be checked without publication by constructing the canonical two-parent merge in a disposable local Git remote. If used, the fixture's temporary `main` ref must point at the prospective source and be labelled as such; it is not the authoritative `origin/main`, a published production commit, or deployment evidence. Record the actual main and production refs separately, then report topology proof, shared routing, validator execution, ordinary application CI, and deployment as distinct outcomes. No test fixture may update the real `main` or `production` ref.

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

The pre-migration baseline is the successful `ci` job in GitHub Actions run [#45202761520](https://github.com/chau-hm/view-camera-simulator/actions/runs/45202761520) for base SHA `981fea7e0e969a7494ad58b319d906650ad7c891`. Its job elapsed 14m47s by the Actions timestamps. The Pages job had 14 named historical source-fetch steps and 16 direct M7 evidence replay/integrity commands. The migrated Pages job retains 10 named fetch steps: eight provenance groups required by full Vitest, the four-source M7R group, and the M7V baseline. It retains two direct evidence checks, M7R and M7V. Counts describe scheduled work, not runner-minute savings.

The corrected feature-push run [#45239461270](https://github.com/chau-hm/view-camera-simulator/actions/runs/45239461270) on `5fef8c11b6c10b338dcf6c99f17db33f12e9b252` returned `QUALIFIED`; all 16 routed archive validators passed with their pinned source paths checked. The archive job elapsed 3m43s. The full application validation job elapsed 17m00s and passed lint, typecheck, 353 Vitest files / 4,341 tests, ordinary Chromium smoke, production-preview WebGL isolation, M7R evidence integrity, and M7V policy validation. The whole workflow elapsed 21m01s. M7R's report correctly retains the historical `not-qualified` outcome while its integrity check passes. Since this commit changes shared qualification infrastructure, the broad archive run is expected; its elapsed time is not a matched estimate for an ordinary application PR. Runtime for an ordinary `NOT_APPLICABLE` PR and billed runner minutes remain `NOT_MEASURED`.

The targeted local M7F/M7G comparison measured the standalone M7F replay at 460 ms and M7G at 54,918 ms. Both commands exited successfully. The standalone and child report SHA-256 were identical (`50e0928061c2ccc31aa3d18cd8b46ee917266bc51393773ab934bafcc3fa9033`); both named capture source SHA `b10118bd0f656296451520ba10f4d32347a9a552`, replay source SHA `981fea7e0e969a7494ad58b319d906650ad7c891`, and 17 passed scenarios with no failed, blocked, or not-run scenarios. M7G retained `partially-qualified` as its historical qualification state while evidence integrity passed. This local run's final archive decision was `UNVERIFIED` because the sandbox denied writing Git's `FETCH_HEAD`; the validators and route comparison themselves passed. The clean shallow-checkout GitHub run #45239461270 proves the corrected archive and source-provenance path.

### Exact-source release qualification

The cumulative baseline-to-source planner is shared with the production-event
adapter. The production adapter still verifies the production merge topology,
source and destination trees, and main ancestry before using that planner. A
source plan verifies the exact source/tree and main ancestry but is **planning
only**: it is not artifact verification and does not establish execution.
Unchanged legacy archival dispositions remain explicitly unverified, not
validator passes.

The exact-source executor uses a disposable detached checkout of the selected
source, verifies HEAD and tree before and after execution, and refuses runner,
manifest, baseline, lockfile or other qualification-contract drift. The only
manifest compatibility exception is the explicitly listed addition of these new
qualification source and test paths; validator families, pins, ownership policy
and all other manifest fields must match. It installs
that source's locked dependencies and invokes its existing historical runner.
The shared-infrastructure path passed to the runner selects all automatic
families; it is a scope selector, not a claim that this path changed. The actual
cumulative changed paths are computed independently from the immutable baseline.
The executor verifies all required validator and pinned-source results, then
removes its checkout. It does not rerun ordinary CI or build the Pages artifact.

The operator command, using the merged reviewed Release B preflight,
is `node scripts/release-artifact-qualify.mjs <source-sha> <ci-run-id>
<ci-attempt> <producer-run-id> <producer-attempt> <artifact-id>`. It directly
invokes that local preflight, plans the same source/tree, executes validators
on that source, and rechecks main; a caller-provided result file is not trusted.
Before importing Release B, it requires the reviewed preflight and its artifact
helpers to be present on fetched `origin/main`, tracked at HEAD and byte-identical
to the reviewed blobs. Missing,
untracked, modified or unreviewed versions fail closed. Its versioned output records
candidate provenance, baseline, cumulative coverage, actual validator and fetch
outcomes, timings and `NOT_DEPLOYED`; it grants no deployment authorization.
The current reviewed workflow-version policy remains fail-closed. A separately
reviewed multi-version policy, durable retention and deployment authorization
remain future integration work before Release D.

Cumulative classification uses current reviewed ownership policy and raw Git blob bytes from the selected source for content-sensitive capture audits; missing or unreadable blobs fail closed. Source execution and the composed qualification both require the complete manifest-derived source-pin inventory, including exact commits, retained refs, verification paths and counts. M7W dynamic paths come from the selected source’s reconciliation document. Legacy archival dispositions remain unverified and qualification grants no deployment authority.
