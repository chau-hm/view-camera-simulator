---
name: vcs-optics-geometry
description: Analyze, implement, or review optical calculations and canonical scene geometry in View Camera Simulator. Use for Scheimpflug construction, tilt or swing sign conventions, lens/film/focus planes, depth-of-field planes, calibration solutions, scene geometry, target placement, and consistency among 2D geometry, 3D overlays, Ground Glass optics, and task evaluation.
---

# View Camera Optics and Geometry

Own physical and canonical geometry decisions. Do not use UI or renderer adjustments to conceal an optical-model defect.

## Establish the contract first

Before editing, identify:

- coordinate axes and world units
- film and lens plane point/normal conventions
- optical-axis direction
- front tilt and swing sign convention
- camera datum and pivot assumptions
- canonical target plane or focus probes
- whether the requested output is physical, instructional, or visual-only

Search for the existing calculation and its tests before adding another helper.

Read `references/optics-checklist.md`.

## Separate three kinds of values

Keep distinct:

1. raw physical or calculated solution
2. rounded value reachable through public controls
3. visual cap or instructional display extent

Never overwrite the physical solution with a rounded UI value.

## Preserve ownership boundaries

Prefer changes in:

```text
src/core/optics/**
src/core/math/**
src/scenes/*Geometry.ts
src/components/geometry/**
src/types/optics.ts
```

Avoid changing:

- React layout
- route or catalog metadata
- shaders
- renderer lighting
- task thresholds

unless the work packet explicitly includes them.

## Validate invariants

For each change, test as applicable:

- finite, normalized plane normals
- non-fallback optics at valid states
- continuous response around nearby public control steps
- correct signed movement
- canonical targets lie on or near the intended plane
- 2D and 3D derive from the same state
- Ground Glass uses the same lens, film, and focus construction
- opposite movement sign behaves distinctly
- zero movement remains a meaningful baseline
- no duplicated plane or projection calculation

Use numerical tolerances derived from the model or public control step, not arbitrary epsilon added to force a pass.

## Output contract

Report:

- coordinate and sign convention used
- root cause or derivation
- raw physical solution
- public control solution when relevant
- changed ownership boundary
- numerical invariants
- focused tests
- risks requiring renderer or UI follow-up
