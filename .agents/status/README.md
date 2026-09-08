# Worktree-local agent status

`.agents/status/CURRENT.md` is a **local working file** for the current worktree.

It is intentionally ignored by Git and must not be committed.

## Why

A single tracked `CURRENT.md` cannot safely represent several concurrent worktrees.

The local model is:

```text
worktree A/.agents/status/CURRENT.md
worktree B/.agents/status/CURRENT.md
worktree C/.agents/status/CURRENT.md
```

Each worktree owns only its own local state.

## When to use it

Recommended for:

- Level 2 Coordinated work;
- Level 3 High-risk work;
- review-fix rounds;
- long-running work where a compact local checkpoint materially helps continuity.

Optional for:

- Micro work;
- Focused work.

## Authority

`CURRENT.md` is:

- a local implementation-agent note;
- not authoritative product documentation;
- not independent verification evidence;
- not shared durable project state.

If it conflicts with the actual branch/diff/tests/PR metadata, the actual repository state wins.

## Template

```markdown
# Current work

Objective:
- ...

Worktree / branch:
- ...

Intended PR base:
- main | integration/<feature>

Complexity / delivery:
- Level ...
- PR delivery | Local-only

Implemented:
- ...

Decisions / invariants:
- ...

Validation:
- `<command>` — passed / failed / not run

Known gaps:
- ...

Reviewer focus:
- ...

Since previous review:
- P1 → ...
- P2 → ...
```

Omit `Since previous review` when not applicable.

## Durable handoff

Before creating or updating a PR, transfer the useful current state into the PR body:

```markdown
## Implementation handoff

Objective:
...

Base / head:
...

Implemented:
- ...

Validation:
- ...

Not run:
- ...

Known gaps:
- ...

Reviewer focus:
- ...
```

For review-fix rounds, add:

```markdown
### Since previous review

- P1 → ...
- P2 → ...
```

The PR body is durable reviewer navigation, but remains an implementation claim.

The reviewer must independently inspect the actual PR diff, base/head, CI, tests, and runtime evidence.

## Cleanup

After the worktree/PR lifecycle is complete, `CURRENT.md` may be deleted without affecting repository history.
