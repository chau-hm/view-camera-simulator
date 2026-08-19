---
name: vcs-verify-pr
description: Independently review View Camera Simulator branches or PRs, validate evidence, and issue a merge verdict without becoming a mandatory step for every local edit.
---

# VCS Verify PR

## Purpose

Provide independent review when a merge verdict, explicit PR review, or independent challenge is required.

This skill is a merge-gate tool, not a mandatory post-step for every implementation.

## Use this skill when

- the user explicitly asks to review a branch or PR;
- the branch is ready for a merge verdict;
- review comments were allegedly fixed;
- current-head CI/review-thread evidence must be checked;
- the change is high-risk enough to require independent challenge.

## Do not require this skill when

- a micro edit was completed and locally proven;
- a focused fix is not yet at a merge gate;
- no independent verdict was requested;
- invoking review would only repeat the implementation agent's local checks.

If a micro edit later becomes part of a merge-critical PR, review the PR at that merge gate rather than reviewing each micro edit separately.

## Independence

The primary implementation agent must not be the sole final reviewer when a merge verdict is required.

Verification should not become the implementation owner unless the correction is limited to review/test tooling and explicitly assigned.

## Review discovery

Inspect:

- intended base and current head;
- merge base and commit list when relevant;
- working-tree state for branch reviews;
- focused changed files;
- current-head CI;
- unresolved review threads;
- implementation claims;
- tests and runtime evidence relevant to those claims.

Do not re-read unrelated project history.

### Durable handoff orientation

When `.agents/status/CURRENT.md` exists and is relevant to the branch under review:

1. read it early for orientation;
2. use it to identify the objective, expected scope, changed surfaces, claimed validation, known gaps, reviewer-focus areas, and any `Since previous review` delta;
3. independently inspect the actual PR/branch diff and merge-critical evidence against those claims;
4. detect and report stale or contradictory handoff data rather than silently trusting it.

`CURRENT.md` is a navigation aid and implementation claim, not review evidence. Its presence does not require a full repository scan; use it to make focused review discovery more efficient.

## Review priorities

1. optical and canonical-geometry correctness when changed;
2. renderer and GPU/resource lifecycle when changed;
3. route/catalog/task identity;
4. public-control reachability;
5. accessibility and responsive behaviour;
6. whether tests detect the original defect;
7. scope control and cleanup.

Do not activate every domain checklist when the PR did not change that domain.

## Test-integrity challenges

Reject evidence that can hide the claimed defect, including:

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

## Validation depth

Review validation should match PR risk.

Do not demand full E2E merely because a PR exists.

Require full repository integration checks at a standard/high-risk merge gate when appropriate. Require E2E when the changed behaviour genuinely depends on a public browser workflow, SPA lifecycle, or renderer integration.

## Verdict

Issue exactly one:

- **Ready to merge**
- **Ready after minor fixes**
- **Not ready**

Lead with concrete blockers if any.

Cite paths, tests, logs, CI state, review threads, and runtime evidence.

Give the smallest exact correction scope. Do not propose opportunistic refactors.

## Output

Include:

- verdict;
- blockers, ordered by severity;
- verified completed work;
- validation evidence checked;
- tests/evidence missing or weak;
- smallest required next correction.
