---
name: vcs-ui-tasks
description: Implement bounded View Camera Simulator React UI, responsive layout, accessibility, controls, state, routes, catalog, and guided-task changes.
---

# VCS UI Tasks

## Activation rule

Use this skill only when the task depends on shared UI/task behaviour or invariants.

Do **not** activate it solely because:

- the edited file is a React component;
- copy, a label, or a local style value changes;
- a tiny visual correction can be proven locally without changing shared behaviour.

Such work may remain a micro edit.

## Use this skill when

- responsive simulator layout or scroll behaviour changes;
- dialogs, menus, overlays, focus, or keyboard accessibility change;
- public scene cards, routes, or catalog metadata change;
- task definitions, enabled controls, feedback, or restart state change;
- shared control min/max/step semantics change;
- route/task identity or public reachability must be validated;
- state changes cross component boundaries.

## Primary ownership

Prefer:

```text
src/app/**
src/components/**
src/core/tasks/**
src/state/**
src/ui/**
src/index.css
UI/task/route/accessibility tests
```

Ownership is a boundary, not an activation trigger.

## Required principles

- Available scenes must resolve and support free mode.
- Guided mode and `guidedTaskId` must be consistent.
- Guided tasks must exist and belong to the same scene.
- Free routes must not accept task IDs.
- Controls must use shared step constants.
- Task completion must be reachable through real public controls.
- Keyboard tests must use publicly reachable values.
- Modal/dialog UI must support initial focus, containment where required, Escape, focus restoration, and viewport constraints.
- Preserve independent simulator-main and controls scrolling where the layout contract requires it.

## Scope control

For a focused UI fix:

- change only the component/state/test surface necessary;
- do not redesign neighbouring UI;
- do not introduce a new abstraction unless the existing contract cannot support the requested behaviour;
- do not modify optics or renderer internals to make a UI test pass.

## Must not

- inject direct DOM values as proof of task reachability;
- alter optics or canonical geometry to satisfy presentation;
- alter RTT/shader/resource ownership without explicit escalation;
- silently broaden a local UI fix into a site-wide refactor.

## Validation

For local UI behaviour:

- run the nearest component/integration test;
- use accessibility queries/public interactions where appropriate;
- add viewport-specific checks only when responsive behaviour changed.

For route/task/control contracts:

- verify registry/route identity;
- verify public-control reachability;
- use E2E only when integration behaviour cannot be proven at a smaller layer or at merge gate.

## Escalation

Escalate to `$vcs-optics-geometry` only when the requested UI behaviour requires a new physical solution or canonical-state contract.

Escalate to `$vcs-threejs-rtt` only when renderer lifecycle or projection behaviour is the actual cause.

## Output

Return:

- root cause or UI contract changed;
- files changed;
- tests run/results;
- tests not run;
- responsive/accessibility evidence when relevant;
- remaining risks;
- commit SHA when applicable.
