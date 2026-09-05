# Oblique Tabletop — Photographic Plausibility

## Objective

Replace the implausible tilted whole-table subject with a normal horizontal table supporting a separate inclined plan board. The board is the canonical optical subject for the existing Tilt + Swing + Focus lesson.

## Branch / worktree / base / head

`fix/oblique-tabletop-photographic-plausibility` · `/Users/homan/repo/view-camera-oblique-tabletop-plausibility` · base `766332e95ca42066f2f05e6f2f93d234ba45a79e` · head recorded in the final report

## Corrective geometry

- Table: level, `4500 × 4500 × 100 mm`, centre `{x: 0, y: -350, z: 4550}`, with four normal supports.
- Subject: separate `3200 × 3000 × 60 mm` board, centre `{x: 0, y: 117.21, z: 4550}`, orientation `rotationX=15°`, `rotationY=-45°`; canonical normal `(-0.1830, 0.9659, 0.1830)`.
- One board-local transform drives rendering, RTT registration, guides, visible/analytical samples, markers, bounds, and calibration. The physical camera rig remains at the existing level origin/base pitch.

## Optical evidence

- Seven canonical samples cover near-left/centre/right, middle, and far-left/centre/right on the same board plane.
- Raw continuous calibration: Front Tilt `-9.265053°`, Front Swing `-1.771182°`, Focus `2634.139 mm`.
- Public calibration: Front Tilt `-9.3°`, Front Swing `-1.8°`, Focus `2630 mm`, f/11.
- Tilt-only evidence remains incomplete; Swing removes the material lateral CoC error, and opposite-sign Swing remains materially worse. Existing CoC threshold is unchanged.
- Public target CoC at the compound state: `[0.000056, 0.002793, 0.004218, 0.001766, 0.000804, 0.001112, 0.002388] mm`; maximum `0.004218 mm`.

## Ground Glass / visual evidence

- Neutral, Tilt-only, and compound projection tests keep all seven learner targets visible with useful horizontal and vertical spread; board corners remain meaningfully in frame.
- Manual browser capture showed a stable, contentful Ground Glass with the plan board as the primary subject and a 3D observer view showing the level table, inclined board, supports, and target details.
- The generated raster thumbnail was replaced with an architectural scene showing the same normal-table/inclined-board concept.

## Guided/free integration

Existing Oblique Tabletop guided stages and free-mode controls remain in place. Task criteria and copy now refer to the board/subject plane while preserving the existing lesson sequence and public control grids.

## Validation run

- Focused Vitest: 9 files, 115 tests passed.
- Full `npm test`: 164 files, 1595 tests passed.
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm run check:css`: passed.
- `npm run build`: passed; 582 modules transformed.
- Focused Oblique Tabletop Playwright: 2 passed.
- Manual 3D/Ground Glass visual capture completed.
- `git diff --check`: passed.

## Validation not run / known limitation

`CI=1 npm run ci:local:e2e` completed CSS, lint, typecheck, unit/integration, and build, then stopped at the unrelated existing `src/tests/e2e/camera-movement-ground-glass-comparison.spec.ts` test `public camera-movement Ground Glass renders one live Current view through the default RTT channel`: timeout clicking `Reset Ground Glass preview view` at line 138. The Oblique Tabletop specs passed before this stop in the focused run.

## Reviewer focus

Photographic plausibility of the normal table plus separate board, canonical transform consistency, Ground Glass visibility, re-derived compound calibration, Tilt-only insufficiency, public-grid reachability, and guided-lesson regression. `CURRENT.md` is intentionally untouched.
