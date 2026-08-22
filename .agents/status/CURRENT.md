# Current Work Handoff

## PR 8B — Physical CoC aperture gather

- Objective: replace the active Ground Glass separable Gaussian path with
  scene color/depth → full-resolution physical CoC → neutral circular aperture
  gather → full-resolution composite.
- Branch: `feature/physical-dof-aperture-gather`.
- Base: PR 8A head `4bd31b6`.

## Implementation

- `GroundGlassRTT` now owns separate CoC, gather, and composite scenes/targets.
- The CoC target is full internal resolution and stores physical CoC diameter in
  millimetres in a half-float red channel.
- The neutral gather uses a runtime `sampleCount`, uniform-disk golden-angle
  samples, depth weighting, a negligible-CoC sharp early-out, and a runtime
  radius cap. Gather resolution is independently controlled by `gatherScale`.
- The existing derived-plane/wedge state still feeds the CoC stage for current
  tilted scenes; the renderer consumes the CoC buffer abstractly so arbitrary
  plane footprints can follow without changing the pass graph.
- Existing preview inversion, raw bypass, focus-ring composition, diagnostic
  sanity reads, and resource lifecycle ownership remain in the final composite.

## Corrective review fix

- The active camera clip range is now synchronized into both the physical CoC
  and aperture-gather materials before either pass renders.
- `synchronizeGroundGlassDofClipRange` lives with the shared DOF uniform-state
  helpers, and a behavioral RTT regression test protects a non-default far
  range from regressing to the construction placeholder `12.0`.

## Validation

- Focused shader/resource/RTT/DOF-state tests: PASS — 5 files / 49 tests.
- Full unit/integration suite: PASS — 127 files / 1,221 tests.
- Typecheck, lint, build, and `git diff --check`: PASS.
- Bounded Chromium Ground Glass DOF stability spec: PASS — 2/2 tests.
- `npm run ci:local:e2e` reached its first unrelated baseline failure in
  `architecture-foreground-guided-lesson.spec.ts`: a task slider expected
  `6830` but remained at `9460`; the second test in that file passed. The
  affected Ground Glass spec passed independently.

## Scope and reviewer focus

- No task evaluators, guided-task semantics, UI controls, Ground Glass CPU
  diagnostics, Scheimpflug construction, or arbitrary-plane footprint geometry
  were changed.
- Review that CoC remains full resolution while gather quality is independently
  scaled, the CoC buffer uses a float-capable target, and the active RTT path
  no longer references the old horizontal/vertical shader exports.
- Follow-up PR 8C can improve adaptive sampling, occlusion reconstruction,
  composite policy, and alternate aperture shapes.
