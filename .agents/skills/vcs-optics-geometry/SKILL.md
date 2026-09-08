---
name: vcs-optics-geometry
description: Analyze or change View Camera Simulator optical calculations, canonical scene geometry, calibration, Scheimpflug relationships, and movement-sign conventions.
---

# VCS Optics Geometry

## Activation rule

Use this skill only when the task depends on optical/geometry reasoning or invariants.

Do not activate it solely because:

- a changed file is under `src/core/optics/**`;
- the task mentions a camera;
- an established calibration constant changes locally;
- a UI label or renderer presentation displays optical data.

## Use this skill when

- Scheimpflug geometry is involved;
- tilt/swing sign conventions are questioned;
- lens, film, focus, near-DOF, or far-DOF planes change;
- canonical subject geometry changes;
- calibration must be derived from physical constraints;
- 2D, 3D, Ground Glass, and task geometry disagree;
- public values must be derived from a physical solution.

## Primary ownership

Prefer:

```text
src/core/optics/**
src/core/math/**
src/scenes/*Geometry.ts
src/components/geometry/**
src/types/optics.ts
related optics/geometry tests
```

Ownership is a boundary, not an activation trigger.

## Context discipline

Work from the smallest sufficient assigned context.

Establish only the relevant:

- coordinate axes;
- explicit units;
- movement signs;
- lens/film/subject plane definitions;
- pivot/datum assumptions;
- canonical source of truth;
- existing helpers/tests.

Do not re-derive unrelated optics for a bounded known correction.

## Required principles

- Canonical simulation state is the source of truth.
- Derive 2D geometry, 3D overlays, Ground Glass inputs, readouts, and task evaluation from canonical state.
- Use explicit millimetre and degree units at module boundaries.
- Preserve raw physical calibration separately from rounded public-control values.
- Keep public values reachable on the actual control step grid.
- Verify finite, normalized plane/vector data where relevant.
- Check nearby-step continuity when changing a continuous optical relation.
- Avoid scene-specific exceptions inside generic optics.

## Must not

- change task thresholds merely to force a pass;
- change renderer lighting, shaders, or CSS to conceal an optical defect;
- duplicate projection, plane, vector, calibration, or unit helpers;
- silently reverse movement signs;
- claim precision unsupported by the model;
- refactor unrelated optics during a focused correction.

## Validation

For focused optical work:

- run nearest numerical/unit tests;
- test the original failure condition;
- test nearby values when continuity matters;
- broaden only when shared contracts changed.

For high-risk work, validate consistency across canonical-state consumers and use integration/E2E evidence when public behaviour requires it.

## Release safety

Optical work may merge incrementally to `main` only when each merged state is production-safe.

If an optical migration requires incompatible intermediate states across several PRs, report that it requires an integration branch rather than merging an unsafe slice to `main`.

## Escalation

Escalate to `$vcs-threejs-rtt` only when the optical result is correct but renderer/projection/lifecycle behaviour remains inconsistent.

Escalate to `$vcs-ui-tasks` only when public-control semantics, task reachability, or shared UI state must change.

## Output

Return a compact handoff with:

- root cause or geometric decision;
- relevant sign/unit assumptions;
- files changed;
- tests/results;
- tests not run;
- remaining risks;
- release-safety note when relevant;
- commit SHA when applicable.
