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

## Validation

- Focused shader/resource/RTT tests: PASS — 4 files / 24 tests.
- Related optics/render uniform tests: PASS — 5 files / 53 tests.
- Full unit/integration suite: PASS — 127 files / 1,220 tests.
- Typecheck, lint, build, and `git diff --check`: PASS.
- Bounded Chromium Ground Glass DOF stability spec: first test PASS; the second
  initially hit a transient local-server connection refusal after the first
  test. Isolated rerun of the second test PASS. The browser run also caught and
  fixed one shader uniform identifier mismatch before the passing rerun.

## Scope and reviewer focus

- No task evaluators, guided-task semantics, UI controls, Ground Glass CPU
  diagnostics, Scheimpflug construction, or arbitrary-plane footprint geometry
  were changed.
- Review that CoC remains full resolution while gather quality is independently
  scaled, the CoC buffer uses a float-capable target, and the active RTT path
  no longer references the old horizontal/vertical shader exports.
- Follow-up PR 8C can improve adaptive sampling, occlusion reconstruction,
  composite policy, and alternate aperture shapes.
