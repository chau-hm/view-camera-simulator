# PR 8D — Arbitrary-plane physical blur footprint

- Branch: `feature/arbitrary-plane-blur-footprint`.
- Base: `origin/main` at `2b2795c`, containing merged PR #84 / PR 8C.
- Objective: extend the full-resolution signed CoC stage with a local-affine
  oriented ellipse derived from canonical lens/film geometry, then use that
  field in the existing far/near aperture gathers.

## Implementation decisions

- `computePhysicalBlurFootprint` is a pure millimetre-based CPU reference. It
  derives the ideal thin-lens image point, intersects the centre ray with the
  actual film plane, and uses the closed-form first derivative of the
  symmetric +/- aperture-edge projection for the local affine map. Singular
  values are the ellipse semi-axes; the sign remains negative near / positive
  far. The derivative is algebraically the first-order form of the required
  symmetric edge construction and avoids four redundant full-resolution GPU
  intersections.
- Canonical `DerivedOpticsState` lens/film planes and rear-standard frame are
  converted to typed renderer uniforms. The CoC RGBA field stores signed CoC,
  major radius, minor radius, and orientation modulo pi. Half-float stores
  physical radii; the existing neutral-safe RGBA8 path stores bounded,
  quantized normalized channels.
- Far gathering transforms the circular proposal disk by the centre ellipse.
  Near gathering keeps its conservative search disk, checks each sampled
  foreground object's own ellipse, and compensates coverage using ellipse area.
  Existing near-over-far visibility ordering and the one-scene-render
  architecture remain unchanged.
- Invalid geometry writes a neutral unresolved field. Raw RTT still bypasses
  CoC/gather and uses the full-resolution scene color target.

## Validation

- Focused optics, footprint storage, coverage, shader, CoC target, RTT
  lifecycle, resize, and scene-optics tests pass.
- Typecheck, lint, CSS structure check, build, and `git diff --check` pass.
- The focused Architecture + Foreground Chromium Raw RTT toggle and transition
  regressions pass after the shader's local-affine derivative optimization.
  Table Tilt RTT diagnostics and Shelf Swing contentful RTT checks also pass.
- `npm run ci:local:e2e` stops at the repository baseline
  `focus-fundamentals-selectable-focus.spec.ts` test 1 because
  `ownerId/resourceGeneration` diagnostics are incomplete; its test 2 passes.

## Known limitation

The implementation is a local affine ellipse approximation of the projective
aperture projection. It remains a single-view color/depth renderer and cannot
reconstruct background surfaces fully hidden behind foreground geometry.
