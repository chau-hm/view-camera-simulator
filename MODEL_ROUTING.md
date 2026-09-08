# View Camera Simulator — Codex Model Routing

This file documents the current executable custom-agent routing.

The executable source of truth is:

```text
.codex/agents/*.toml
```

If this document and the TOML files disagree, the TOML files win.

## Current routing

| Role | Custom agent | Model | Reasoning effort | Purpose |
|---|---|---|---:|---|
| Planner / coordinator | `vcs_orchestrator` | `gpt-5.6-sol` | `high` | Multi-domain planning, decomposition, and integration |
| Worker | `vcs_optics_geometry` | `gpt-6-astra` | `low` | Bounded optics / canonical-geometry work |
| Worker | `vcs_threejs_rtt` | `gpt-6-astra` | `low` | Bounded Three.js / RTT / lifecycle work |
| Worker | `vcs_ui_tasks` | `gpt-6-astra` | `low` | Bounded UI / accessibility / routes / tasks work |
| Worker | `vcs_test_worker` | `gpt-6-astra` | `low` | Independent bounded regression/evidence work |
| Optional internal reviewer | `vcs_pr_reviewer` | `gpt-5.6-sol` | `high` | Explicitly requested or unusually high-risk internal pre-review |

`low` is the configured GPT-6 Astra reasoning-effort value used for the initial worker experiment.

## Routing philosophy

Worker agents are **bounded-context execution roles**, not lower-capability tiers.

Delegation is useful when it provides one or more of:

- a smaller task-specific starting context;
- independent reasoning that reduces anchoring;
- safe parallel execution.

Do not delegate merely to move work to a cheaper model.

The planner may keep a task in its own context when transferring the task would require most of the same context or would create unnecessary integration overhead.

## Planner and reviewer stability

The initial GPT-6 Astra experiment changes worker routing only.

The planner and reviewer remain on their existing GPT-5.6 Sol assignments so worker-model quality/cost can be evaluated without simultaneously changing planning and review behaviour.

## Experimental context management

The repository contains a commented-out experimental context-management configuration in:

```text
.codex/config.toml
```

It is intentionally disabled by default.

Runtime context-management features may reduce the cost or context pressure of long worker sessions, but they do not replace:

- bounded delegation;
- independent testing/review roles;
- worktree-local working state;
- durable PR handoff.

Enable the experimental feature only as a separate deliberate experiment.

## Changing routing

When changing model routing:

1. update the relevant `.codex/agents/*.toml`;
2. update this file to match;
3. do not change delegation semantics solely because the model changes;
4. compare output quality, correction rounds, runtime/context usage, and cost before broadening the migration.
