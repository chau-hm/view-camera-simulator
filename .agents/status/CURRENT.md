# Current Work Handoff

## Work

Oblique Architecture Aperture Tuning Follow-up — PR #69

- Branch: `fix/oblique-architecture-aperture-tuning`
- Base: `main` (`origin/main` @ `b6ef012`)
- Current objective: reduce distracting building blur without changing the
  existing lesson contract.

## Objective

The fixed `f/5.6` aperture made too much of the Oblique Architecture building
appear oddly blurred. The follow-up keeps Aperture fixed and changes the scene
preset to `f/11`.

## Decision

- Selected solution: fixed-aperture tuning (Option A).
- Aperture is fixed at `f/11` in Observe, Compose, Align Focus, and Final
  Challenge.
- No Final Challenge Aperture-control fallback was required.

## Preserved teaching invariants

- Neutral remains incomplete for the façade sharpness problem.
- Rise-only still solves composition without solving façade sharpness.
- Swing + Focus without Rise still fails composition.
- The public `20 mm / 9.7° / 5260 mm` compound verification state passes.
- The previously verified nearby public Swing step remains valid.
- Geometry, Focus range, movement ranges, evaluator threshold, routing, lesson
  structure, and optics remain unchanged.

## Validation

- Focused Oblique tests: `19/19` passed.
- `npm test`: `121 files / 1,125 tests` passed.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:css`: PASS.
- `npm run build`: PASS.
- Focused Chromium Oblique Architecture E2E: `5/5` passed.
- `git diff --check`: PASS.
- Full `npm run ci:local:e2e`: not run for this two-file fixed-preset change.

## Known gaps

Automated checks verify the task and optical invariants; final subjective blur
appearance remains a visual acceptance consideration.

## Commit / branch evidence

- Aperture implementation: `ba3afbf` (`fix(scene): tune Oblique Architecture
  aperture behavior`).
- `ba3afbf` is an ancestor of the current branch HEAD.
