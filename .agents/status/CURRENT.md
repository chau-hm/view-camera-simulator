# Current Work Handoff

## PR 8C — Depth-aware physical DOF occlusion

- Objective: extend the merged PR 8B pipeline with signed/sided physical CoC,
  asymmetric near/far aperture gathers, and near-over-far visibility policy.
- Branch: `feature/physical-dof-occlusion`.
- Base: merged PR 8B in `origin/main` at branch creation (`745c105`).

## Implementation

- Neutral thin-lens CoC now has an explicit signed API. Negative means the ideal
  image plane is behind the film / foreground-side defocus; positive means it is
  in front of the film / background-side defocus. Magnitude remains the PR 8A
  physical CoC diameter in millimetres.
- The full-resolution CoC buffer carries signed millimetres on the half-float
  path and a reversible `[-maxCoC,+maxCoC]` normalized byte encoding on the
  capability fallback path.
- Ground Glass renders separate far/background and near/foreground gathers to
  the same quality-scaled dimensions. Far gathering rejects foreground
  occluders; near gathering uses each foreground sample's own CoC footprint and
  composites its coverage over the far result.
- Raw debug remains a true full-resolution scene-color bypass. Normal frames
  still use one scene color/depth render followed by CoC, two screen-space
  gathers, and a full-resolution composite.
- The single-view limitation is intentional: fully hidden background color
  cannot be reconstructed from one color/depth view.

## Tests and validation

- Focused optics/storage/shader/resource/RTT tests: PASS — 6 files / 76 tests.
- Full unit/integration suite: PASS — 128 files / 1,237 tests.
- Typecheck, lint, CSS structure check, and production build: PASS.
- Bounded Chromium Ground Glass DOF stability spec: PASS — 2/2 tests.
- `npm run ci:local:e2e` passed CSS, lint, typecheck, unit/integration, build,
  and the preceding browser files, then stopped at the known baseline failure
  in `focus-fundamentals-selectable-focus.spec.ts` test 1: RTT
  `ownerId/resourceGeneration` diagnostics were incomplete. Its test 2 passed;
  the focused Ground Glass DOF spec independently passed 2/2.

## Scope

- No Gaussian fallback, adaptive sampling, alternate aperture shapes, hidden
  background reconstruction, multi-render aperture sampling, task semantics,
  UI controls, or PR 8D work was added.
- Review focus: signed CoC side consistency, byte/half-float storage decoding,
  asymmetric visibility ordering, near-layer footprint coverage, full-resolution
  raw bypass, and target resize/disposal lifecycle.
