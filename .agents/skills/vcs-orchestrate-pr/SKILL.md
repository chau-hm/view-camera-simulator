---
name: vcs-orchestrate-pr
description: Plan and coordinate multi-file or multi-domain work in the View Camera Simulator repository. Use for new scene rebuilds, cross-cutting refactors, PR planning, large fixes, work that spans optics, Three.js/RTT, UI/tasks, or test infrastructure, and requests to split a long prompt across Codex agents or models.
---

# Orchestrate View Camera Simulator PRs

Act as the project coordinator. Decompose and integrate; do not become the default implementation owner.

## Start with bounded discovery

Inspect:

```bash
git status --short
git branch --show-current
git log -5 --oneline
git diff --stat <base>...HEAD
```

Read `AGENTS.md`, the task request, and only the most relevant source and test files.

Do not read every project document before classifying the task.

## Classify complexity

Read `references/routing-matrix.md`.

Choose one mode:

- **Small fix** — one concern, usually one implementation skill plus verification.
- **Standard PR** — two related concerns, one or two implementation skills plus verification.
- **High-risk simulation PR** — optics, projection, RTT, shaders, or resource lifecycle; require domain analysis and independent verification.

## Produce work packets

Use `references/work-packet-template.md`.

Each packet must define:

- one objective
- one owner skill
- allowed files or ownership boundary
- forbidden scope
- known evidence
- acceptance criteria
- focused validation
- dependencies on other packets

Prefer two to four packets. More than four usually indicates the PR should be split.

Parallelize only packets with non-overlapping files and no unresolved design dependency.

## Model routing

Recommend, but do not pretend to enforce, the model choice:

- strongest reasoning model: orchestration, optics, renderer architecture, final review
- balanced coding model: UI, tasks, state, focused tests
- lightweight model: search, inventories, documentation, mechanical test updates

Escalate to a stronger model when a task involves ambiguous geometry, hidden lifecycle state, conflicting evidence, or a failed implementation attempt.

## Integration gates

Before implementation:

- resolve sign conventions and canonical ownership
- identify shared files
- prevent two agents from editing the same file concurrently
- identify which tests prove the behavior rather than merely exercise it

Before full CI:

- require compact handoffs from every packet
- inspect `git diff --check`
- run focused tests
- resolve overlaps and stale assumptions

Before merge:

- invoke `$vcs-verify-pr`
- require a merge verdict independent from implementation agents

## Output contract

Return:

1. complexity mode
2. shared baseline
3. work packets
4. dependency order
5. model recommendation per packet
6. integration sequence
7. merge gates
