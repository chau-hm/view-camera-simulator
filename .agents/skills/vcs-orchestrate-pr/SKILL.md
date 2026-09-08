---
name: vcs-orchestrate-pr
description: Coordinate genuinely multi-domain, ambiguous, integration-sensitive, or high-risk View Camera Simulator work when bounded context, ownership, sequencing, or parallelism adds real value.
---

# VCS Orchestrate PR

## Purpose

Coordinate work only when coordination adds real decision, context-isolation, ownership, sequencing, or integration value.

This skill is an escalation tool, not the default entry point.

## First decision

Determine separately:

1. task complexity under `AGENTS.md`;
2. delivery mode: Local-only or PR delivery.

Do not treat "this will become a PR" as a reason to escalate task complexity.

## Do not orchestrate when

- the requested behaviour is explicit;
- the root cause is locally understood;
- one coherent implementation can solve and prove the issue;
- delegation would require transferring most of the same context;
- no shared-contract or ownership decision needs coordination.

If direct implementation is safer and simpler, return the lighter path.

## Use this skill when

- several technical domains must agree;
- ownership remains ambiguous after focused inspection;
- integration order matters;
- a worker benefits materially from a smaller context;
- a fresh independent reasoning pass is valuable;
- safe parallel work exists;
- a high-risk PR needs explicit contract decisions.

## Delegation rationale

Use a worker only when at least one is materially useful:

- **context isolation**;
- **independent reasoning**;
- **parallelism**.

Do not delegate merely because a specialist exists or because the task is large.

## Discovery

Inspect only what is needed to bound the work:

- current branch/worktree;
- intended PR base;
- working-tree state;
- focused diff/failing surface;
- relevant architecture/tests;
- current PR/CI/review state when applicable.

Do not read the entire repository by default.

## Work packets

Create two to four packets only when decomposition helps.

```text
WORK PACKET

ID:
Objective:
Owner:
Branch / intended PR base:
Known evidence:
Allowed files / ownership:
Do not modify:
Required behaviour:
Required validation:
Dependencies:
Output:
```

Rules:

- one concern per packet;
- explicit, non-overlapping ownership where possible;
- compact context;
- no complete project history;
- no full diff paste;
- no speculative extras;
- workers do not publish branches or create PRs independently.

## Parallel work

Parallelize only when:

- shared contracts are already established;
- ownership does not overlap or sequencing is explicit;
- dependencies are resolved.

Do not parallelize optics and renderer implementation while their shared coordinate/state contract is unresolved.

## Releasable-main decision

Before deciding PR bases, ask:

> Can each child PR be independently safe in production after merge?

If yes:

```text
child PRs → main
```

Keep incomplete functionality dormant/non-public until final activation when needed.

If no:

```text
child PRs → integration/<feature>
final integration PR → main
```

Do not merge non-releasable intermediate states to main.

Do not use selective production cherry-picks as a substitute for correct integration topology.

## Integration

After worker handoffs:

- reconcile shared assumptions;
- inspect final focused diff;
- run validation appropriate to complexity;
- maintain local ignored `.agents/status/CURRENT.md` for Coordinated/High-risk work when useful;
- prepare the durable PR implementation handoff.

## PR-delivery boundary

For normal PR delivery:

1. commit integrated work;
2. resolve intended feature branch and intended PR base explicitly;
3. publish only with `HEAD:refs/heads/<feature-branch>`;
4. verify the remote feature ref equals local HEAD;
5. create or update the PR with explicit head/base;
6. copy the useful current-work summary into the PR body;
7. stop for independent review.

Do not use upstream or `push.default` to select publication destination.

If the PR base advanced concurrently, refetch and verify the PR still targets the correct base.

Never use bare push, direct-to-base publication, or force push.

## Internal review

Do not automatically invoke `$vcs-verify-pr` before normal PR publication.

Use it only when explicitly requested, unusually high-risk, or needed because the normal external review path is unavailable.

## Stop condition

Do not broaden the task beyond the requested outcome.

If a direct implementation proves sufficient, stop rather than manufacturing extra workers or packets.

## Output

Return:

- complexity level;
- delivery mode;
- why orchestration is or is not useful;
- packet list when used;
- intended PR base topology;
- dependencies/integration order;
- required validation;
- release-safety decision;
- known risks.
