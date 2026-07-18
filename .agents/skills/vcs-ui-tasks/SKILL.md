---
name: vcs-ui-tasks
description: Implement or review View Camera Simulator React UI, responsive layout, accessibility, controls, state, public scene catalog, route validation, guided tasks, feedback, and task-facing tests. Use for simulator layout, dialogs, overlay menus, scroll behavior, scene cards, keyboard controls, public control steps, task metadata, route/task pairing, restart behavior, and 1024px usability.
---

# View Camera UI, Tasks, and Routes

Own user interaction and public workflow integrity. Do not alter optics or renderer internals to make a UI test pass.

## Determine the concern

Classify the task as one or more of:

- responsive layout
- component interaction
- accessibility and focus
- control semantics and steps
- state initialization or reset
- public scene catalog
- route validation
- guided task definition or feedback

Keep the implementation inside the relevant boundary.

Read `references/ui-task-checklist.md`.

## Public workflow invariants

Maintain:

- available public scene resolves to a registered scene
- available scene supports free mode
- guided mode has exactly one configured guided task
- guided task exists, is guided, and belongs to the same scene
- free routes contain no task ID
- invalid task/scene combinations redirect before workspace initialization
- restart restores the declared initial state
- enabled controls match task metadata
- public values are reachable with declared steps

## Accessibility

For dialogs and menus:

- provide an accessible name
- use correct dialog/menu semantics
- focus a meaningful element on open
- contain focus when modal
- support Escape
- restore focus to the trigger
- close or safely update on route/scene change
- remain within the viewport

For controls:

- expose readable labels
- explain disabled state
- use shared step constants
- preserve keyboard behavior
- expose progress and toggle state through valid ARIA

## Responsive behavior

At approximately 1024px verify:

- main and aside remain independently scrollable
- viewport headings remain visible
- overlays collapse instead of covering the scene
- no page-level horizontal scrollbar
- dialog controls remain reachable
- 2D labels stay within the SVG
- task and feedback remain readable

## Scope boundary

Prefer changes in:

```text
src/app/**
src/components/**
src/core/tasks/**
src/state/**
src/ui/**
src/index.css
UI/task tests
```

Escalate optical or geometry ambiguity to `$vcs-optics-geometry`.
Escalate WebGL, RTT, or disposal issues to `$vcs-threejs-rtt`.

## Output contract

Report:

- public behavior changed
- catalog/route/task invariants affected
- accessibility behavior
- responsive evidence
- files changed
- focused unit/integration/E2E results
- systems intentionally left unchanged
