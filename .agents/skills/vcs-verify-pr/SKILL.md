---
name: vcs-verify-pr
description: Independently review View Camera Simulator branches or PRs when an internal merge verdict or high-risk pre-review is explicitly needed.
---

# VCS Verify PR

## Purpose

Provide an optional internal independent review.

The normal project flow publishes the implementation PR first and then uses an external independent reviewer.

This skill is not a mandatory post-step for implementation.

## Use this skill when

- the user explicitly requests internal branch/PR review;
- an unusually high-risk change materially benefits from a pre-review;
- current-head CI/review evidence must be independently challenged before external review;
- the normal external review path is unavailable.

## Do not require this skill when

- ordinary implementation is ready for PR publication;
- a Micro/Focused change has already been proportionally proven;
- invoking this review would simply repeat the implementation agent's checks.

## Independence

The implementation owner must not be the sole final reviewer when a merge verdict is required.

Verification should not become the production implementation owner.

## Review discovery

Read the actual PR metadata first:

- actual base branch;
- actual head;
- merge base/commits when relevant;
- changed files;
- current-head CI;
- unresolved review threads;
- implementation claims;
- runtime/test evidence.

For PRs targeting an integration branch, review against that integration base.

For the final integration PR to `main`, review the complete integrated change and verify that `main` remains production-releasable.

## Durable handoff orientation

Use the PR body's `Implementation handoff` section as navigation only.

It may identify:

- objective;
- expected scope;
- changed surfaces;
- claimed validation;
- known gaps;
- reviewer focus;
- `Since previous review` mapping.

It is an implementation claim, not evidence.

Do not depend on a tracked `.agents/status/CURRENT.md`. That file is worktree-local and ignored.

## Review priorities

Inspect only changed risk surfaces, prioritizing as applicable:

1. optical/canonical correctness;
2. renderer/GPU lifecycle;
3. route/catalog/task identity;
4. public-control reachability;
5. accessibility/responsive behaviour;
6. test ability to detect the original defect;
7. scope control;
8. release safety and correct PR-base topology.

Do not activate every domain checklist merely because the repository contains those domains.

## Test-integrity challenges

Reject evidence hidden by:

- full reloads used to prove SPA lifecycle;
- direct injection of unreachable slider values;
- prop-derived DOM attributes used to prove internal replacement;
- screenshot byte size as the only rendering evidence;
- broad WebGL warning suppression;
- task-threshold reductions used instead of correcting implementation.

For each important claim ask:

```text
What is claimed?
What observable evidence proves it?
Would the original defect fail this evidence?
Does the test use the real public workflow when that is part of the claim?
```

## Release-safety review

For a PR targeting `main`, ask:

> If this PR merged now and `origin/main` were promoted immediately, would production remain safe?

If not, the PR should not merge to `main` in its current form.

Possible corrections:

- keep the incomplete feature dormant/non-public;
- retarget non-releasable child work to an integration branch;
- complete the missing atomic integration before merging.

Do not recommend selective cherry-picking into production as the normal solution.

## Validation depth

Match review validation to risk.

Do not demand full E2E merely because a PR exists.

Require broader integration/E2E only when the changed behaviour genuinely depends on it.

## Verdict

Issue exactly one:

- **Ready to merge**
- **Ready after minor fixes**
- **Not ready**

Lead with blockers.

Cite paths, tests, logs, CI state, review threads, and runtime evidence.

Give the smallest exact correction scope.

## Output

Include:

- verdict;
- blockers ordered by severity;
- verified completed work;
- validation evidence checked;
- missing/weak evidence;
- release-safety/base-topology assessment;
- smallest required next correction.
