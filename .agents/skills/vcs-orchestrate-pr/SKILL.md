---
name: vcs-orchestrate-pr
description: Coordinate multi-domain or high-risk View Camera Simulator work, decompose it into bounded packets, and control integration without over-orchestrating local fixes.
---

# VCS Orchestrate PR

## Purpose

Coordinate work only when orchestration adds real decision, ownership, or integration value.

This skill is an escalation tool, not the default entry point.

## First decision: should this task be orchestrated?

Before decomposing anything, check whether the task qualifies as a micro edit or focused fix under `AGENTS.md`.

Do **not** orchestrate when:

- the requested behaviour is explicit;
- the root cause is known or locally obvious;
- one concern can be fixed and proven locally;
- no shared domain contract changes;
- no multi-agent coordination is required.

If the task can be completed safely as a micro edit, recommend or return the lighter path instead of creating work packets.

Do not create artificial packets merely to use the harness.

## Use this skill when

- multiple domains must change together;
- ownership is ambiguous after focused inspection;
- integration order matters;
- parallel work needs non-overlapping file ownership;
- optics/geometry, renderer, UI/task, and test contracts must be reconciled;
- a high-risk PR needs explicit merge gates.

## Discovery

Inspect only what is needed to classify and bound the work:

- current branch and intended base;
- working-tree status;
- focused diff or failing surface;
- relevant architecture and tests;
- current PR review/CI evidence when applicable.

Do not read the entire repository by default.

## Routing rule

A file path does not automatically imply a specialist.

Invoke a specialist only if the task depends on that specialist's reasoning or invariants.

Examples:

- local copy change in a renderer component → no renderer specialist;
- changing render-target ownership → `$vcs-threejs-rtt`;
- established camera constant adjustment → local/focused path;
- deriving a camera solution from physical geometry → `$vcs-optics-geometry`.

## Work packets

Create two to four packets only when decomposition is useful.

Each packet must include:

```text
WORK PACKET

ID:
Objective:
Owner skill:
Branch and base:
Known evidence:
Allowed files or ownership:
Do not modify:
Required behaviour:
Required validation:
Dependencies:
Output:
```

Rules:

- one concern per packet;
- explicit, non-overlapping ownership where possible;
- no complete project history;
- no full diffs;
- no speculative extra work;
- more than four packets usually means the PR should be split.

## Parallel work

Parallelize only when:

- file ownership does not overlap;
- dependencies are resolved;
- shared contracts are already established;
- integration order is explicit.

Do not parallelize optics and renderer implementation while their shared coordinate/state contract is still unresolved.

## Integration

After implementation:

- review compact handoffs;
- reconcile shared assumptions;
- inspect final focused diff;
- run validation appropriate to the task level;
- use `$vcs-verify-pr` only when a merge verdict or explicit independent review is needed.

Do not automatically invoke a reviewer merely because implementation completed.

## Stop condition

Do not broaden the task beyond the requested behaviour.

If a local implementation proves sufficient:

- stop;
- do not refactor unrelated modules;
- do not add general infrastructure;
- do not create extra packets to consume available agents.

## Output

Return:

- task level;
- why orchestration is or is not necessary;
- packet list when used;
- dependencies/integration order;
- required validation;
- known risks.
