# GitHub CI Trigger Routing

This note records the feature-push routing added to `pages.yml`. It changes when the existing full CI job runs; it does not change the commands, tests, browser settings, M7 checks, or deployment artifact.

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

Repository branch-protection/ruleset configuration was not accessible to the implementation token. The PR check name was retained to avoid requiring a Required Check migration; reviewers should confirm the live PR check context and current ruleset in GitHub before merge.

Concurrency groups separate each PR number, each pushed branch, and each manual run. Newer commits can replace older work on the same PR or branch. PR and feature-push runs cannot cancel one another; manual runs cannot cancel protected-branch validation or deployment. A newer production push may supersede an older production push, matching the existing same-ref cancellation policy.

The `deploy` condition and `needs: ci` dependency are unchanged. Only a successful CI run caused by a push to `production` reaches deployment.

## Verification and limits

The routing helper's unit tests cover no-PR, absent or stale checks, active and successful PR checks, multiple PRs, API failure, forks, branch deletion, and non-feature events. The repository's M7 workflow assertions remain unchanged and continue to require the broad push trigger and unconditional full validation definition.

Live Actions runs are the evidence for event timing and Required Check identity. Local routing tests cannot prove GitHub event ordering, branch protection configuration, fork-token visibility, or runner behavior. API uncertainty deliberately causes an extra full validation rather than a skipped validation.

## Rollback

Revert the B1 commit through a normal follow-up PR. This restores the previous trigger concurrency key and removes the router, while leaving test semantics, historical evidence, and deployment configuration untouched. Do not force-push or edit the production branch.
