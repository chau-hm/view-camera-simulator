# Current Work Handoff

## PR 8B — Physical CoC aperture gather

- Objective: replace the active Ground Glass separable Gaussian path with
  scene color/depth → full-resolution physical CoC → neutral circular aperture
  gather → full-resolution composite.
- Branch: `feature/physical-dof-aperture-gather`.
- Base: PR 8A head `4bd31b6`.

## Implementation

- `GroundGlassRTT` now owns separate CoC, gather, and composite scenes/targets.
- The CoC target is full internal resolution. It stores physical CoC diameter
  in millimetres in a verified half-float target when available, otherwise it
  stores a normalized byte encoding whose range is decoded centrally in the
  gather shader.
- The neutral gather uses a runtime `sampleCount`, uniform-disk golden-angle
  samples, depth weighting, a negligible-CoC sharp early-out, and a runtime
  radius cap. Gather resolution is independently controlled by `gatherScale`.
- The existing derived-plane/wedge state still feeds the CoC stage for current
  tilted scenes; the renderer consumes the CoC buffer abstractly so arbitrary
  plane footprints can follow without changing the pass graph.
- Existing preview inversion, raw bypass, focus-ring composition, diagnostic
  sanity reads, and resource lifecycle ownership remain in the final composite.

## Corrective review fixes

- The active camera clip range is now synchronized into both the physical CoC
  and aperture-gather materials before either pass renders.
- `synchronizeGroundGlassDofClipRange` lives with the shared DOF uniform-state
  helpers, and a behavioral RTT regression test protects a non-default far
  range from regressing to the construction placeholder `12.0`.
- Raw debug now skips both CoC and gather rendering and composites the
  full-resolution scene color target directly, so Low quality `gatherScale`
  cannot soften the raw path.
- CoC target creation checks actual framebuffer completeness, falls back from
  half-float millimetres to an explicit normalized byte representation when
  necessary, and exposes the selected storage format in runtime diagnostics.
- The RTT harness now exercises the active frame callback for both clip-range
  synchronization and the raw full-resolution bypass.

## Validation

- Focused shader/resource/RTT/DOF-state/CoC-target tests: PASS — 6 files / 56 tests.
- Full unit/integration suite: PASS — 128 files / 1,228 tests.
- Typecheck, lint, build, and `git diff --check`: PASS.
- Bounded Chromium Ground Glass DOF stability spec: PASS — 2/2 tests.
- `npm run ci:local:e2e` passed CSS, lint, typecheck, unit/integration, build,
  and the E2E files through its first failure in
  `focus-fundamentals-selectable-focus.spec.ts`: its first test reported
  incomplete RTT diagnostics (`ownerId/resourceGeneration` absent), while its
  second test passed. The failure reproduces independently in that spec; the
  focused Ground Glass DOF spec passed 2/2.

## Scope and reviewer focus

- No task evaluators, guided-task semantics, UI controls, Ground Glass CPU
  diagnostics, Scheimpflug construction, or arbitrary-plane footprint geometry
  were changed.
- Review that CoC remains full resolution while gather quality is independently
  scaled, the target capability fallback preserves the encoded CoC contract,
  raw debug bypasses scaled gather, and the active RTT path no longer
  references the old horizontal/vertical shader exports.
- Follow-up PR 8C can improve adaptive sampling, occlusion reconstruction,
  composite policy, and alternate aperture shapes.
