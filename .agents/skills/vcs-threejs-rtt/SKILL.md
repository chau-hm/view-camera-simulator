---
name: vcs-threejs-rtt
description: Analyze or change View Camera Simulator Three.js/R3F rendering, Ground Glass RTT, shaders, diagnostics, projection plumbing, and WebGL resource lifecycle.
---

# VCS Three.js RTT

## Activation rule

Use this skill only when the task depends on renderer/WebGL reasoning or lifecycle invariants.

Do **not** activate it solely because:

- the edited file lives under `src/render/**`;
- a renderer-adjacent button, label, CSS rule, or local presentation value changes;
- a known local conditional can be fixed without changing render ownership or projection contracts.

## Use this skill when

- Ground Glass is blank, stale, duplicated, too dark, or inconsistent;
- RTT camera/clipping/render-target dimensions change;
- shaders or post-processing change;
- scene-subject registration changes;
- GPU resource ownership/disposal is involved;
- SPA scene switching must prove resource replacement or cleanup;
- renderer diagnostics must expose meaningful internal state;
- projection plumbing between canonical state and displayed canvas changes.

## Primary ownership

Prefer:

```text
src/render/**
renderer-specific components
renderer-specific diagnostics
renderer-specific tests
```

Ownership is a boundary, not an activation trigger.

## Trace the render path

When the problem is genuinely renderer-related, follow:

```text
canonical state
→ scene subject / camera
→ RTT target
→ shader or post-process
→ displayed canvas
→ cleanup / replacement
```

Identify the owner and teardown path for resources relevant to the defect, including as applicable:

- geometries;
- materials;
- textures;
- depth textures;
- render targets;
- post-processing scenes;
- controls;
- registered scene groups.

Dispose only resources owned by the component or registered subject.

## Required principles

- Renderer visualizes canonical physical state; it must not reinterpret movement signs.
- Visual clipping or display caps must not mutate physical geometry.
- Diagnostics must expose meaningful internal state, not merely mirror incoming props.
- Separate WebGL-independent from WebGL-dependent tests.
- Use true client-side navigation when claiming SPA lifecycle behaviour.
- Prefer semantic evidence over screenshot size or incidental rendering output.

## Must not

- change physical calibration to make an image look better;
- change task thresholds to hide a rendering defect;
- add decorative DOM fallbacks that conceal renderer failure;
- use full page reloads to prove cleanup;
- broadly suppress unknown WebGL warnings;
- refactor unrelated renderer infrastructure during a focused fix.

## Validation

For a focused known renderer defect:

- run the nearest renderer/unit/integration test;
- prove the original failure observable;
- inspect relevant lifecycle diagnostics if needed.

For lifecycle or resource-ownership changes:

- use SPA navigation;
- verify meaningful replacement/disposal evidence;
- run relevant E2E and integration checks.

Run full E2E only when the work reaches the appropriate integration/merge gate or when the public workflow is the only valid proof.

## Escalation

Escalate to `$vcs-optics-geometry` if the renderer receives inconsistent or physically invalid canonical state.

Escalate to `$vcs-ui-tasks` if the defect is actually a public-control/state/route issue.

## Output

Return:

- root cause;
- render-path segment affected;
- ownership/disposal decision when relevant;
- files changed;
- tests and runtime evidence;
- tests not run;
- remaining risks;
- commit SHA when applicable.
