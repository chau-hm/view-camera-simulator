---
name: vcs-threejs-rtt
description: Analyze or change View Camera Simulator Three.js/R3F rendering, Ground Glass RTT, shaders, diagnostics, projection plumbing, and WebGL resource lifecycle.
---

# VCS Three.js RTT

## Activation rule

Use this skill only when the task depends on renderer/WebGL reasoning or lifecycle invariants.

Do not activate it solely because:

- the edited file lives under `src/render/**`;
- a renderer-adjacent button, label, CSS rule, or presentation value changes;
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

## Context discipline

Work from the smallest sufficient assigned context.

When the problem is genuinely renderer-related, trace only the relevant path:

```text
canonical state
→ scene subject / camera
→ RTT target
→ shader/post-process
→ displayed canvas
→ cleanup/replacement
```

Identify ownership/teardown only for resources relevant to the defect.

## Required principles

- Renderer visualizes canonical physical state; it must not reinterpret movement signs.
- Visual clipping/display caps must not mutate physical geometry.
- Diagnostics must expose meaningful internal state, not mirror incoming props.
- Separate WebGL-independent from WebGL-dependent tests.
- Use true client-side navigation for SPA lifecycle claims.
- Dispose only resources owned by the component or registered subject.

## Must not

- change physical calibration to make an image look better;
- change task thresholds to hide a rendering defect;
- add decorative DOM fallbacks that conceal renderer failure;
- use full page reloads to prove cleanup;
- broadly suppress unknown WebGL warnings;
- refactor unrelated renderer infrastructure.

## Validation

For a focused renderer defect:

- run nearest renderer/unit/integration evidence;
- prove the original failure observable;
- inspect relevant lifecycle diagnostics if needed.

For lifecycle/resource-ownership changes:

- use SPA navigation;
- verify meaningful replacement/disposal evidence;
- run relevant integration/E2E.

## Release safety

A renderer slice may merge to `main` only if the merged state remains production-safe.

Use an integration branch when a renderer migration requires non-functional or incompatible intermediate states across child PRs.

## Escalation

Escalate to `$vcs-optics-geometry` if the renderer receives inconsistent or physically invalid canonical state.

Escalate to `$vcs-ui-tasks` if the defect is actually a public-control/state/route issue.

## Output

Return:

- root cause;
- render-path segment affected;
- ownership/disposal decision when relevant;
- files changed;
- tests/runtime evidence;
- tests not run;
- remaining risks;
- release-safety note when relevant;
- commit SHA when applicable.
