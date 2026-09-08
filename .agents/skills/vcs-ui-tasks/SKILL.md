---
name: vcs-ui-tasks
description: Implement bounded View Camera Simulator React UI, responsive layout, accessibility, controls, state, routes, catalog, and guided-task changes.
---

# VCS UI Tasks

## Activation rule

Use this skill only when the task depends on shared UI/task behaviour or invariants.

Do not activate it solely because:

- the edited file is a React component;
- copy, a label, or a local style value changes;
- a tiny visual correction can be proven locally without changing shared behaviour.

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

## Context discipline

Work from the smallest sufficient assigned context.

## Required principles

- Available scenes must resolve and support free mode.
- Guided mode and `guidedTaskId` must be consistent.
- Guided tasks must exist and belong to the same scene.
- Free routes must not accept task IDs.
- Controls must use shared step constants.
- Task completion must be reachable through real public controls.
- Keyboard tests must use publicly reachable values.
- Modal/dialog UI must support keyboard/focus behaviour and viewport constraints where relevant.
- Preserve independent simulator-main and controls scrolling where required.

## Releasable-main behaviour

Use public registration/activation boundaries to keep incomplete features production-safe where practical.

For a multi-PR scene feature, prefer:

```text
internal implementation
→ controls/geometry/task
→ integration
→ final public catalog/route activation
```

Do not expose an incomplete feature merely because some implementation has landed.

If an intermediate UI migration cannot remain production-safe, report the need for an integration branch.

## Scope control

For focused UI work:

- change only the necessary component/state/test surface;
- do not redesign neighbouring UI;
- do not introduce a new abstraction unless required by the existing contract;
- do not modify optics or renderer internals to make a UI test pass.

## Must not

- inject direct DOM values as proof of task reachability;
- alter optics/canonical geometry to satisfy presentation;
- alter RTT/shader/resource ownership without explicit escalation;
- silently broaden a local UI fix into a site-wide refactor.

## Validation

For local UI behaviour:

- run nearest component/integration evidence;
- use accessibility queries/public interactions where appropriate;
- add viewport-specific checks when responsive behaviour changed.

For route/task/control contracts:

- verify registry/route identity;
- verify public-control reachability;
- use E2E only when integration behaviour cannot be proven smaller or when merge-critical.

## Escalation

Escalate to `$vcs-optics-geometry` only when the requested UI behaviour requires a new physical solution or canonical-state contract.

Escalate to `$vcs-threejs-rtt` only when renderer lifecycle/projection is the actual cause.

## Output

Return:

- root cause or UI contract changed;
- files changed;
- tests/results;
- tests not run;
- responsive/accessibility evidence when relevant;
- release-activation decision when relevant;
- remaining risks;
- commit SHA when applicable.
