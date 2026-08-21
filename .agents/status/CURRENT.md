# Current Work Handoff

## Ground Glass DOF stability fix

- Objective: stabilize the shared Ground Glass DOF post-process for valid
  finite camera states without changing projection, scene calibration, or Raw
  RTT behavior.
- Branch: `fix/ground-glass-dof-stability`.
- Base: `origin/main` @ `7272cce` (`Architecture + Foreground` PR 7E
  baseline).
- Substantive HEAD: `87b17eb`.

## Reproduction and root cause

- Reproduction: Architecture + Foreground, Rise `20 mm`, Tilt `6.6°`, Swing
  `0°`, Focus `7750 mm`, Aperture `f/11`.
- Raw RTT was contentful and visually correct; the processed path was
  contentful but showed a corrupted horizontal smear/band. `Building Middle`
  reported `NaN%`.
- First invalid value: the building-middle ray’s signed focus-plane
  intersection was `-22791.2048 mm`. The forward-only ray/plane helper
  correctly returned `null`; the CPU wedge then emitted `normalizedDefocus =
  NaN`, which propagated through `calculateSharpness` to the diagnostic.
- The shader independently substituted target distance for the missing focus
  intersection. That produced a reversed focus/near interval and an
  epsilon-sized denominator, sending excessive blur toward the configured
  maximum. Raw RTT bypassed this downstream path, proving the base projection
  was unaffected.

## Implementation

- `src/core/optics/dofWedge.ts`: added an explicit finite fail-closed wedge
  contract. Missing focus, degenerate/reversed finite intervals, invalid
  distances, and non-finite results return boundary defocus `1` with
  `insideDepthOfField: false`; positive-infinite far remains the supported
  open-ended representation. An unreachable per-ray far boundary is treated
  as open-ended rather than inventing a reversed finite interval.
- `src/render/groundGlassDofShaders.ts`: mirrored forward-intersection,
  finite-value, interval-order, world-position, CoC, and blur-radius checks in
  GLSL. Removed the unsafe target-distance focus fallback; invalid wedge
  samples use a finite boundary blur. Parallel-path depth/CoC checks are also
  fail-closed.
- `src/core/optics/dofBlurModel.ts` and `src/render/groundGlassBlur.ts`:
  bounded finite conversion and defensive zero-blur handling at the blur
  boundary; invalid normalized defocus no longer maps to maximum blur.
- `src/render/createGroundGlassDofUniformState.ts`: validates plane distances,
  image distance, and boundary blur calibration before shader state is built.
- Added unit regression coverage in
  `src/tests/unit/groundGlassDofStability.test.ts` and shader-source assertions
  in `src/tests/unit/groundGlassShaders.test.ts`.
- Added focused Chromium coverage in
  `src/tests/e2e/ground-glass-dof-stability.spec.ts` for the exact state,
  Raw RTT toggles, transition history, finite diagnostics, and bounded RTT
  sanity output.

## Evidence

- Exact CPU state and a `6.0–7.0°` / `7500–7900 mm` neighborhood now keep all
  focus-target scores, normalized defocus values, and applicable boundaries
  finite. The exact building-middle wedge resolves to the finite boundary
  fallback instead of NaN.
- Focused unit regressions: PASS — 4 files / 39 tests, including Architecture
  + Foreground DOF, Table Tilt, and Shelf Swing.
- Focused Chromium DOF regression: PASS — 2 tests, including repeated
  processed/raw transitions. Exact-state focus diagnostics remain finite and
  RTT sanity remains contentful with finite variance.
- Cross-scene focused Chromium checks: PASS — Oblique Architecture free RTT,
  Shelf Swing calibrated DOF, and Table Tilt raw/final RTT diagnostics (3/3).
- Manual screenshots: the exact processed reproduction no longer has the
  baseline horizontal smear/banding; Raw RTT remains crisp. PR 7C f/11 and PR
  7D f/22 remain contentful and show the expected finite-DOF progression.

## Validation

- `npm test -- --run`: PASS — 127 files / 1,182 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:css`: PASS.
- `npm run build`: PASS.
- `git diff --check`: PASS before status update.
- `npm run ci:local:e2e`: ATTEMPTED but stopped at the existing Focus
  Fundamentals selectable-focus spec: its first test saw missing
  `data-rtt-owner-id` / `data-rtt-resource-generation` after contentful RTT
  checks; its second test passed. A fresh-server rerun reproduced the same
  diagnostic race. The Architecture + Foreground tests completed before that
  stop, and the three representative cross-scene checks above passed
  independently.

## Scope and reviewer focus

- No scene-specific branching, projection changes, movement-sign changes,
  renderer lifecycle changes, UI redesign, or Raw RTT default change.
- No global optics formula or existing scene calibration was changed.
- PR 7A–7E guided behavior remains unchanged; this is only a shared numerical
  stability correction. PR 7F is unrelated and remains outside scope.
- Review the CPU/GLSL parity for unresolved wedge samples, the decision to
  treat an unreachable far boundary as open-ended per ray, and the remaining
  Focus Fundamentals owner/generation diagnostic race in full E2E.
