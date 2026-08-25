# PR 8F — focus-legibility surface detail

- Branch: `feature/focus-legibility-surface-detail`.
- Base: `origin/main` at `35399514c6d8fe83dee3d19799d81dc49dd60b18`.
- Scope: add restrained, physically placed multi-frequency detail to the
  Architecture Rise, Table Tilt, and Shelf Swing subjects. Architecture +
  Foreground is intentionally unchanged because its existing windows,
  mullions, façade bands, and paving seams already provide useful depth detail.

## Implementation

- Architecture Rise has a canonical 360 × 420 mm façade detail panel with a
  4 × 4 architectural frame and six fine horizontal lines. The same canonical
  pieces feed the R3F and imperative RTT subject paths.
- Table Tilt retains its cup, notebook, and book identities while adding
  modest physical fine bands/lines/grid cells to the existing focus surfaces.
- Shelf Swing adds one shared 240 × 72 mm comparison motif to each station.
  Coarse, medium, and fine row dimensions and spacing are identical for front,
  middle, and back; perspective alone changes their apparent size.
- No external assets, screen-space overlays, focus-state material changes, or
  renderer/optics changes were introduced. Shared factories own the added
  geometry/material resources through their existing lifecycle paths.

## Validation status

- Focused scene-detail and regression unit tests pass.
- Typecheck, lint, CSS check, build, and diff check pass.
- Bounded Chromium smoke checks pass for Architecture Rise, Table Tilt, Shelf
  Swing, and Architecture + Foreground. Raw/processed RTT content and existing
  focus-transition checks remain green. The Table Tilt responsive Ground Glass
  check at 390 × 844 also passes.
- Full repository tests pass: 138 files, 1,303 tests. The local E2E workflow
  passes the affected Architecture + Foreground specs before stopping at the
  known unrelated Focus Fundamentals baseline in
  `focus-fundamentals-selectable-focus.spec.ts:155` ("Ground Glass RTT
  diagnostics were incomplete").

## Known limits

The new coverage is structural and deterministic; this PR does not claim
pixel-perfect visual calibration or change physical DOF strength. Manual visual
inspection should confirm that the fine features remain readable at both normal
desktop and smaller responsive Ground Glass sizes.
