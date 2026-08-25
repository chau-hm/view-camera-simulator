# PR 91 corrective pass — attach focus detail to canonical surfaces

- Branch: `feature/focus-legibility-surface-detail`.
- Reviewed base/head before correction: `origin/main` / `71d88a5ab178e02b3b89c0780acd1bed3507fc90`.
- Scope: repair only two scene-detail coordinate-space defects from PR #91.

## Fixes

- Table Tilt near-cup fine bands now include `card.centerZ`, so their generated
  depth extents remain inside the generated focus-card mesh.
- Shelf Swing comparison motif now declares `chartLocalCenter: { x: 0, y: -100,
  z: 0 }`. It remains parented to the chart group, whose station-local center
  is y=560 mm, yielding the intended station-local y=460 mm placement.
- Regression coverage resolves generated mesh/group transforms for the near
  cup and all three Shelf Swing stations; canonical dimensions and motif
  equality checks remain in place.

No optics, DOF renderer, calibration, focus range, quality, profiler, or scene
detail redesign changes are included. The existing U <= focal-length close-focus
bug is explicitly deferred.

## Validation

- Focused placement suite: 3 files, 19 tests passed.
- Full unit/integration suite: 138 files, 1,303 tests passed.
- Typecheck, lint, CSS check, build, and diff check passed.
- Table Tilt, Shelf Swing, and Architecture + Foreground bounded Chromium
  checks passed. Architecture Rise passed in a serial rerun; its parallel run
  timed out during an existing reset-view interaction under contention.
- Post-fix Raw screenshots showed the Shelf motifs inside the chart regions;
  no stray upper-shelf motif was visible.
