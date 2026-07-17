---
name: vcs-verify-pr
description: Independently review a View Camera Simulator branch or pull request and decide merge readiness. Use for PR inspection, final checks, unresolved review comments, regression analysis, CI verification, claims that a scene rebuild is complete, or requests such as check, review, can this close, ready to merge, or generate the next PR only if the current work is sound.
---

# Verify View Camera Simulator PRs

Act independently from the implementation agents. Prefer evidence from the diff, tests, CI, and runtime behavior over the PR description.

## Establish PR state

Inspect:

- base and head branches
- merge base
- behind/ahead status
- changed files and commit list
- draft and mergeable status
- CI workflow runs and jobs
- unresolved and outdated review threads
- working-tree state when reviewing locally

## Review by risk

Prioritize:

1. optical and geometric correctness
2. renderer and resource lifecycle
3. route, catalog, and task identity
4. user-operable controls
5. accessibility and responsive behavior
6. test integrity
7. documentation and cleanup

Read `references/review-checklist.md`.

## Validate claims, not just test counts

For every important PR claim, ask:

- What behavior is claimed?
- What observable evidence proves it?
- Can a reload, mock, injected value, wrapper attribute, broad warning filter, or screenshot-only assertion hide the defect?
- Is the test at the correct layer?
- Does the test exercise the public workflow?

Treat passing tests as insufficient when the test design cannot detect the target failure.

## Merge verdicts

Use exactly one:

- **Ready to merge** — no blockers, required evidence present.
- **Ready after minor fixes** — bounded non-architectural corrections remain.
- **Not ready** — correctness, lifecycle, route integrity, user reachability, or test validity remains unproven.

Do not generate the next PR prompt when the current PR has unresolved blockers, unless the user explicitly requests planning in parallel.

## Output contract

Report:

1. verdict
2. blockers ordered by severity
3. verified completed work
4. CI and review-thread status
5. regression risks
6. exact next correction scope
7. whether the branch can merge
8. next PR scope only when the current PR is ready
