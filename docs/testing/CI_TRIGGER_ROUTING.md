# GitHub CI Trigger Routing

This note records the feature-push routing from PR #360 and the historical qualification dependency added by PR B2. Feature-push routing still controls when the full application job runs. B2 moves eligible frozen M7 replay responsibility to a change-triggered workflow while preserving current application checks and the production deployment boundary.

## Routing decisions

| Event | Routing result |
|---|---|
| Feature branch push with no open same-repository PR | Run the full `ci` job as `feature-push-validation`. |
| Feature branch push with uncertain PR association, stale head SHA, missing PR check, API error, missing permission, or rate limit | Run the full `ci` job as `feature-push-validation`. |
| Feature branch push covered by current PR checks | Skip the redundant push `ci` job only after every open PR from that branch has a matching `pull_request` workflow run for the exact source SHA and its `ci` job is in progress or completed successfully. The job name is `feature-push-validation`; the PR's separate `ci` check remains authoritative. |
| Feature branch deletion | Skip validation because the push has no commit to test. |
| Pull request opened, synchronized, or reopened, including a PR to an integration branch | Run the existing full `ci` job under its `ci` name. |
| Push to `main` | Run the existing full `ci` job under its `ci` name. |
| Push to `production` | Run the existing full `ci` job, then deploy only when that job succeeds. |
| `workflow_dispatch` | Run the existing full `ci` job; the production deploy condition remains false. |
| Fork-originated push | Run full validation. The router does not infer parent-repository PR coverage from a fork-scoped token. |

The router helper is checked out at the pushed commit so pre-PR feature validation and a follow-up open-PR push can both use it before this PR is merged. Its feature-push job has a distinct check name and cannot satisfy the PR `ci` check. The helper verifies the base repository, source branch, open PR state, exact PR head SHA, base repository/target, workflow event, run SHA, PR association, and actual `ci` job. It checks every open PR associated with the same branch. A queued job, failed/cancelled/skipped job, missing run, stale SHA, or unverified API response is not enough to suppress push validation. The router waits up to 30 seconds for a concurrent PR run to start; if that evidence does not appear, it runs full CI.

The routing helper uses read-only `GITHUB_TOKEN` permissions for pull requests, Actions runs, and repository contents. It does not execute branch names or PR data in a shell command. API failures are logged only as a routing reason and fail open to full validation.

## Required checks and concurrency

The existing `ci` job stays unconditional and keeps the name `ci` on PR events, protected-branch pushes, and manual dispatch. Feature push runs have a distinct `feature-push-validation` check name, including when the redundant job is skipped. Therefore, a skipped feature-push result cannot substitute for the independently executed PR `ci` result.

The GitHub API reported `main` as unprotected with no required status checks, and the repository ruleset collection was empty when checked for this implementation. The workflow therefore enforces the archive decision inside `ci`; it does not establish a GitHub merge restriction. The PR check name remains `ci` for compatibility with existing consumers and future policy configuration.

Concurrency groups separate each PR number, each pushed branch, and each manual run. Newer commits can replace older work on the same PR or branch. PR and feature-push runs cannot cancel one another; manual runs cannot cancel protected-branch validation or deployment. A newer production push may supersede an older production push, matching the existing same-ref cancellation policy.

The `deploy` condition and `needs: ci` dependency are unchanged. Only a successful CI run caused by a push to `production` reaches deployment.

## Historical evidence qualification

`pages.yml` retains the PR #360 router and calls `.github/workflows/historical-qualification.yml` for every event that is not a verified redundant feature push or branch deletion. That reusable workflow classifies the actual PR changed-file pages or push before/after tree diff against `scripts/historical-evidence-manifest.json`. A feature push before a PR exists is still validated automatically by the distinct `feature-push-validation` path.

The ordinary Pages job retains eight historical source-fetch groups because full Vitest includes provenance tests that inspect exact M7F, M7K, M7M, and M7N–M7Q source trees. An initial trial removing those fetches failed 9 tests across 7 files in run [#45235154628](https://github.com/chau-hm/view-camera-simulator/actions/runs/45235154628): `groundGlassM7fReplayCli.test.ts`, `groundGlassM7kBroadE2eQualification.test.ts`, `m7mSceneReadiness.test.ts`, and the M7N–M7Q evidence tests. Restoring the exact pins is necessary to keep the full suite passing. The dedicated replay and integrity commands remain in the qualification lane. This is a known overlap between historical provenance tests and ordinary application CI, not evidence that frozen report replay belongs in every PR.

The `ci` job now depends on the feature-push gate and the reusable qualification result. Its `always()` condition preserves the named `ci` job when historical validation fails or cannot run; the first step checks both dependency results and accepts only `QUALIFIED` or justified `NOT_APPLICABLE`. This prevents a failed, unverified, or unexpectedly skipped archive job from appearing as a successful application `ci` result. A covered feature push keeps the B1 suppression behavior: the push validation job and its archive job are skipped only after the exact source SHA has a current PR `ci` run, while that PR `ci` remains authoritative.

For an ordinary application change, the archive decision is `NOT_APPLICABLE` and does not install dependencies or fetch historical sources. Evidence changes select their affected family closure; shared workflow, manifest, package, Playwright, or provenance-fetch changes select the broad automatically routed archive. M7R remains in ordinary CI because its frozen verifier requires an unconditional Pages workflow step and exact historical source parity; routing reports that existing owner instead of executing M7R twice. M7V current-policy and skip-governance validation also remains in ordinary CI. The full Vitest suite is unchanged. Full family ownership, the M7R exception, and known M7S–M7U gaps are documented in [Historical Evidence Qualification](HISTORICAL_EVIDENCE_QUALIFICATION.md).

Dispatching `pages.yml` still requests ordinary application CI without deployment. A separate manual `Historical Evidence Qualification` dispatch runs the full supported archive independently; it reports M7S–M7U as `UNVERIFIED` because no complete archive validators are currently registered for those families.

## Verification and limits

The routing helper's unit tests cover no-PR, absent or stale checks, active and successful PR checks, multiple PRs, API failure, forks, branch deletion, and non-feature events. M7 workflow assertions continue to require the broad push trigger, the full application suite, the mandatory M7V policy check, and M7R's frozen unconditional workflow owner.

On the pre-migration base run, ordinary Pages CI executed 14 named historical source-fetch steps and 16 evidence validator/replay commands. The migrated job retains 10 named source-fetch steps and two evidence checks: eight source-history groups are required by provenance tests inside full Vitest, and the other two support M7R and M7V. The reusable workflow handles the dedicated historical validators when a relevant change or uncertainty requires it. This is a work-count comparison, not a runner-time claim. The baseline `ci` job elapsed 14m47s in [Actions run #45202761520](https://github.com/chau-hm/view-camera-simulator/actions/runs/45202761520). A successful post-migration Pages run on the corrected source-fetch set is still pending, so post-migration wall time and runner time remain `NOT_MEASURED`.

Live Actions runs are the evidence for event timing and Required Check identity. Local routing tests cannot prove GitHub event ordering, branch protection configuration, fork-token visibility, or runner behavior. API uncertainty deliberately causes an extra full validation rather than a skipped validation.

## Rollback

Revert the B1 commit through a normal follow-up PR. This restores the previous trigger concurrency key and removes the router, while leaving test semantics, historical evidence, and deployment configuration untouched. Do not force-push or edit the production branch.
