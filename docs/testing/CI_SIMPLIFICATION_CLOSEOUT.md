# CI simplification closeout

**Disposition: `CI_SIMPLIFICATION_COMPLETE`.** The reviewed initiative is closed; future improvements remain possible. The original audit baseline is `658487f468d14d6129f4ac7091ebd71c32afd5ed`; the historical C5 closeout reference is `9608989875b425ff7f6dd8ae73782d9ff00db879`. The freshly fetched implementation base for this documentation is also `9608989875b425ff7f6dd8ae73782d9ff00db879` (2026-11-28 Hong Kong time). D1 is independent research, not a prerequisite for closing this initiative. The [command guide](CI_COMMANDS.md) preserves the existing interface.

## Completed phases

GitHub merge identities were verified against current history. Each report is linked; its findings, scope and limitations remain authoritative evidence for that phase.

| Phase | Merged PR and merge commit | Outcome and report |
| --- | --- | --- |
| A | [#358](https://github.com/chau-hm/view-camera-simulator/pull/358) `f5510587` | Audit foundation: [baseline](TEST_AUDIT_BASELINE.md), [plan](TEST_AUDIT_PLAN.md), [ledger](TEST_AUDIT_LEDGER.md). |
| B1 | [#360](https://github.com/chau-hm/view-camera-simulator/pull/360) `981fea7e` | Conservative feature-push deduplication: [routing](CI_TRIGGER_ROUTING.md). |
| B2 | [#361](https://github.com/chau-hm/view-camera-simulator/pull/361) `a0b2fa4b` | Conditional archive qualification: [qualification](HISTORICAL_EVIDENCE_QUALIFICATION.md). |
| B3 | [#363](https://github.com/chau-hm/view-camera-simulator/pull/363) `1fc33bf3` | Local-first modes and shadow Core pilot: [architecture](LOCAL_CI_ARCHITECTURE.md), [evaluation](CORE_REGRESSION_EVALUATION.md). |
| B4 | [#366](https://github.com/chau-hm/view-camera-simulator/pull/366) `7c9b18e8` | Retain full GitHub suite: [decision](CORE_REGRESSION_CI_DECISION.md). |
| B5 | [#371](https://github.com/chau-hm/view-camera-simulator/pull/371) `9a529d8a` | Harden ownership and completeness: [evidence](LOCAL_CI_B5_EVIDENCE.md). |
| B6 | [#376](https://github.com/chau-hm/view-camera-simulator/pull/376) `97651a38` | Profile and bounded Preview optimization: [decision](CI_RUNTIME_OPTIMIZATION_DECISION.md). |
| C1 | [#377](https://github.com/chau-hm/view-camera-simulator/pull/377) `3a0f92e5` | Removed three redundant orientation declarations after asymmetric reference and mutation proof: [report](TEST_CONSOLIDATION_C1.md). |
| C2 | [#380](https://github.com/chau-hm/view-camera-simulator/pull/380) `9945859f` | Strengthened rendered-pixel assertions in four existing browser cases, improving evidence rather than claiming runtime reduction: [report](TEST_CONSOLIDATION_C2.md). |
| C3 | [#381](https://github.com/chau-hm/view-camera-simulator/pull/381) `7e86bda8` | Removed one unused six-line test-seam helper and separating blank line; no measured runtime or bundle saving: [report](TEST_CONSOLIDATION_C3.md). |
| C4 | [#383](https://github.com/chau-hm/view-camera-simulator/pull/383) `f2a55e62` | Corrected five evidence assertion gaps using independent mutations and raw-input verification; focused executed cases rose 107 to 114: [report](TEST_CONSOLIDATION_C4.md). |
| C5 | [#385](https://github.com/chau-hm/view-camera-simulator/pull/385) `96089898` | Audited 85 exports and 51 browser control fields; retained active mechanisms without safe deletion proof. Observed production runtime isolation, not module-level bundle attribution or elimination of emitted instrumentation. Native M7G blocked before lifecycle boundary: [report](TEST_CONSOLIDATION_C5.md). |

## Before and after

Counts refer to the original audit and reviewed C5 reports, with the current base identical to C5. The successful [C5 runner log](https://github.com/chau-hm/view-camera-simulator/actions/runs/46021421686) reports 361 files and 4,520 passed cases. Full Vitest totals are successful runner results, not static declarations; unrelated scene and test additions must not be attributed to this initiative.

| Metric | Original baseline | C5 and current base |
| --- | ---: | ---: |
| npm scripts | 70 | 75 |
| Unconditional ordinary CI evidence commands | 16 | 2 |
| Named historical source-fetch steps in ordinary CI | 14 | 10 |
| Full Vitest files / cases | 349 / 4,279 | 361 / 4,520 |
| Mandatory ordinary browser smoke cases | 2 | 2 |
| Mandatory Production Preview cases | 4 | 4 |
| TypeScript checks in CI plus Preview preparation | 2 | 1 |

The 14 fewer unconditional evidence executions represent 87.5% of the original 16, not an 87.5% runtime or billing reduction. Mandatory browser coverage and full Vitest were preserved; full test counts increased. The five added scripts are `build:production-preview:after-typecheck`, `evidence:qualification:historical`, `ci:local:focused`, `ci:local:affected`, and `ci:local:core`; the 70 existing implementations are unchanged. `package.json` is a historical qualification dependency and evaluators may verify registered commands. Removal or migration needs separate compatibility evidence.

## What was measured

**B1 routing.** A feature push with no open PR retains validation. Once exact-head PR coverage is established, a redundant feature-push full validation can be suppressed; API or identity uncertainty falls back to running it. Main and production pushes and manual dispatch retain validation; manual dispatch does not deploy. A successfully deduplicated commit can reduce two redundant full validations to one. This is not a 50% reduction in total Actions consumption; run frequency and aggregate usage were not measured. See [routing](CI_TRIGGER_ROUTING.md).

**B2 historical qualification.** [Pre-B2 run 45202761520](https://github.com/chau-hm/view-camera-simulator/actions/runs/45202761520) shows the period from 15:26:50 to 15:28:15 UTC (85 seconds) across the former evidence validators and intervening M7V/M7W source fetches; earlier named source fetches ran 15:13:47–15:14:04 UTC and are outside that window; retained M7R/M7V occupy approximately four seconds. This suggests roughly 80 seconds gross work avoided on a comparable non-applicable change, not a proven net saving per PR. The separate routing/decision job, queue and overlap are additional costs and were not subtracted in a matched comparison. A `NOT_APPLICABLE` route avoids dependency installation and archive replay; shared infrastructure and historical dependencies may select broad qualification. Production releases retain cumulative qualification. See [qualification evidence](HISTORICAL_EVIDENCE_QUALIFICATION.md#cost-evidence).

**B6 Preview.** In the matched local comparison standalone checked Preview took 59.81 seconds; optimized CI-path Preview took 49.08 and 50.34 seconds, a 10.73 and 9.47 second reduction respectively. Both paths produced identical 58-file output manifests and four passing browser cases. This does not establish a hosted saving. [B6 decision](CI_RUNTIME_OPTIMIZATION_DECISION.md).

**Local Core candidate.** In B3's matched local comparison, full Vitest ran 4,365 cases in 41.071 seconds versus 611 candidate cases in 10.010 seconds: approximately 75.6% shorter for the Vitest step. This is not a GitHub runner measurement or equivalent coverage. B4's realistic B1 Far Gather mutation survived the candidate, so full GitHub Vitest remains mandatory. Focused and Affected are development feedback with explicit limits. [Evaluation](CORE_REGRESSION_EVALUATION.md), [decision](CORE_REGRESSION_CI_DECISION.md).

**Hosted variability.** B6 successful [run 45821749289](https://github.com/chau-hm/view-camera-simulator/actions/runs/45821749289) had a 10m04s `ci` job and 15m53s whole workflow; [run 45824795513](https://github.com/chau-hm/view-camera-simulator/actions/runs/45824795513) had an 18m28s `ci` job, with Preview rising from 194s to 468s despite unchanged workflow and test code. The job duration is not the entire workflow; the workflow includes historical qualification and queueing. For C4 [run 46012812526](https://github.com/chau-hm/view-camera-simulator/actions/runs/46012812526), historical qualification took 51s, `ci` 14m21s, and workflow creation-to-completion 15m24s. For C5 [run 46021421686](https://github.com/chau-hm/view-camera-simulator/actions/runs/46021421686), those figures were 13s, 18m15s, and 18m40s respectively. These decision-job durations include their setup and are not matched net-cost measurements. The [B6 profile](CI_RUNTIME_PROFILE.md) records more samples. Queue delay, aggregate runner minutes, billed cost reduction, and stable end-to-end percentage saving are `NOT_MEASURED`; do not equate wall-clock duration with billed cost.

## Final architecture and safeguards

```text
Local: focused / affected / explicit browser or native / full local CI
                                  |
GitHub event -> feature-push routing
                         |-> validation gate -----------+
                         |-> historical decision ------+--> authoritative application ci
                         |     -> NOT_APPLICABLE       |    lint, typecheck, full Vitest,
                         |     -> applicable validators|    Chromium smoke, Production Preview,
                         +-----------------------------+    M7R integrity and M7V policy
                                                                    |
                                                production push only -> deploy after ci
```

The application job depends on routing, the validation gate and the historical decision; it checks their results. Covered feature pushes or deleted refs are skipped. Exact-source fetches and evidence integrity remain; production-release qualification uses the cumulative policy and all registered validators. Deployment is separate and requires the production push and successful CI. See [workflow](../../.github/workflows/pages.yml) and [release qualification](HISTORICAL_EVIDENCE_QUALIFICATION.md). The stable `ci` workflow check is authoritative; this document does not assert GitHub branch-protection enforcement, which has not been verified. Native WebGPU is not unconditionally qualified or activated in production.

Accepted policy: `RETAIN_FULL_GITHUB_SUITE`; local-first focused and affected feedback; conditional historical qualification; conservative fallback for uncertain routing and incomplete ownership; existing production build and deployment protections. Future CI changes should be separately scoped to an actual defect, demonstrated compatibility issue, necessary new contract, or measured optimization opportunity. This is an operational freeze on speculative migration, not a technical lock or a ban on maintenance.

## Parallel worktree synchronization

At closeout, open PRs were [#359](https://github.com/chau-hm/view-camera-simulator/pull/359), [#379](https://github.com/chau-hm/view-camera-simulator/pull/379), [#382](https://github.com/chau-hm/view-camera-simulator/pull/382), [#384](https://github.com/chau-hm/view-camera-simulator/pull/384), and independent D1 [#386](https://github.com/chau-hm/view-camera-simulator/pull/386). Their numbers and branch histories suggest some predate major CI changes; this is not evidence that any PR is broken. Inspect each actual merge base, diff, and current checks before deciding whether to synchronize.

1. In the feature's own worktree, fetch `origin`, record `git rev-parse HEAD` and `git merge-base HEAD origin/main`, and inspect its diff. Refresh using the project's established integration policy when appropriate; do not automatically merge or rebase another branch.
2. Reconcile intentional edits to B1 routing, B2 qualification, local ownership/reporting, M7R/M7V, exact-source fetching and production release conditions against the latest reviewed versions. Never resolve blindly in favor of either side.
3. Shared infrastructure or unclassified evidence paths can trigger broad qualification. Investigate `UNVERIFIED`; do not rename files, remove validators or bypass the gate to get green checks.
4. Use distinct worktrees, browser/server ports, temporary outputs and reports. Keep exact commit and source-state provenance. Avoid concurrent GPU-heavy browser runs competing for the same renderer; never overwrite another worktree's captures or reports.
5. Run relevant focused checks after synchronization and inspect the authoritative GitHub PR workflow at the current head. A successful older head does not validate the new one. Do not modify other active branches as part of this closeout.

## Separate follow-up backlog

| Work | Why deferred and source | Independent trigger / release relevance |
| --- | --- | --- |
| D1 native WebGPU prerequisite investigation | Native M7G blocked before lifecycle proof; [C5](TEST_CONSOLIDATION_C5.md). | Existing independent D1 worktree; research, not closeout or a new production activation. |
| Current-source M4/M5/M6 requalification; native lifecycle recovery | Historical evidence is not current native proof; [C5](TEST_CONSOLIDATION_C5.md). | Resolved native prerequisites and a separately scoped qualification; research unless a future release explicitly requires that contract. |
| Production bundle module attribution | Runtime isolation observed; exact emitted module contribution unresolved; [C5](TEST_CONSOLIDATION_C5.md). | A specific bundle question and measurement method; development research. |
| Development instrumentation relocation; Host State Provider owner injection | No safe relocation demonstrated; [C5](TEST_CONSOLIDATION_C5.md). | Separate ownership and behavior proof; development work. |
| npm command removal or migration | Historical compatibility and package manifest dependencies; [qualification](HISTORICAL_EVIDENCE_QUALIFICATION.md). | Explicit migration with consumer and provenance evidence; maintenance, not required for release. |
| Additional affected-owner coverage | Provisional or unmapped contracts require conservative results; [B5](LOCAL_CI_B5_EVIDENCE.md). | Independent contract and mutation proof; development feedback. |
| Potential test-audit skill | No new skill is needed to close the audit; [plan](TEST_AUDIT_PLAN.md). | Demonstrated recurring need; development only. |
| Further CI timing or cost optimization | Hosted variance and billed costs remain unmeasured; [B6](CI_RUNTIME_PROFILE.md). | Measured opportunity and separate safety review; not required for release. |

No D2 is started by this closeout. Any future production release remains subject to the existing production qualification policy, independently of this backlog.
