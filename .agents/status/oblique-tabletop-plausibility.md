# Oblique Tabletop — Photographic Plausibility

## Scope

Focused corrective PR replacing the implausible tilted whole-table subject with a level worktable supporting a separate inclined drafting/copy board. The board is the canonical optical subject for the existing Tilt + Swing + Focus sequence; PR10C/10D/10E architecture remains bounded to the existing public lesson and geometry paths.

## Branch / worktree / base

`fix/oblique-tabletop-photographic-plausibility` · `/Users/homan/repo/view-camera-oblique-tabletop-plausibility` · base `766332e95ca42066f2f05e6f2f93d234ba45a79e`

## Canonical scene geometry

- Table: level, `4000 × 4200 × 100 mm`, centre `{x: 0, y: -350, z: 4550}`, four normal supports.
- Subject: `2600 × 3000 × 60 mm` board, centre `{x: 0, y: 117.206, z: 4550}`, supported at the table's far edge, orientation `rotationX=15°`, `rotationY=-45°`.
- Board focus-surface plane: normal `(-0.183012702, 0.965925826, 0.183012702)`, signed distance `899.920427 mm`.
- The rejected old whole-table plane was approximately normal `(-0.021771, 0.987688, 0.154912)` at signed distance `112.85 mm`; its 150 mm lens feasibility ratio exceeded one.
- One explicit board-local Rx-then-Ry basis drives board mesh, details, markers, analytical samples, visible targets, bounds, guides, RTT registration, and calibration. The photographic rig remains the existing level origin/base pitch.

## Optical evidence

- Seven analytical samples cover near-left/centre/right, middle, and far-left/centre/right on the board plane; seven separate interior samples are the learner-visible targets.
- Continuous calibration: Front Tilt `-9.265053°`, Front Swing `-1.771182°`, Focus `2634.139 mm`.
- Public calibration: Front Tilt `-9.3°`, Front Swing `-1.8°`, Focus `2630 mm`, f/11.
- PR10B Tilt-only calibration remains `-4.8° / 4020 mm`; it materially improves the principal near/far samples but leaves the full analytical surface incomplete. Swing remains materially necessary and the opposite sign is worse.
- Public compound analytical CoC values: `[0.000766, 0.002793, 0.003998, 0.001766, 0.000362, 0.001112, 0.002175] mm`; maximum `0.003998 mm`. Existing threshold is unchanged.

## Ground Glass / visual contract

- Actual film-plane projection keeps every learner-visible target inside the physical frame at neutral, Tilt-only, and compound states. Target bounds are approximately `u=.191–.789, v=.448–.636` at neutral and `u=.188–.792, v=.447–.638` at compound; spans remain useful (`Δu≈.60`, `Δv≈.19`).
- Board front-corner bounds remain within a small meaningful intersection (`u≈-.042–1.015`, `v≈.400–.783`) with two corners directly visible; the subject board and its target details remain the primary readable Ground Glass object.
- Manual browser capture showed the normal table, inclined supported board, details, stable RTT, and final public compound state through the real UI. The catalog remains a committed raster scene card.

## Integration / validation state

Existing guided/free routes, task criteria, copy, teaching geometry, and RTT lifecycle are updated to refer to the board while retaining the accepted public behavior. `.agents/status/CURRENT.md` is intentionally untouched; this file is the work-specific handoff.

Final validation: focused Vitest 9 files / 115 tests passed; full `npm test` 164 files / 1595 tests passed; typecheck, lint, CSS, and build passed; focused Oblique Tabletop Chromium specs passed serially (2/2, 1.7 minutes). The required `CI=1 npm run ci:local:e2e` passed CSS, lint, typecheck, unit/integration, and build, then stopped at the unrelated `camera-movement-ground-glass-comparison.spec.ts` Current-RTT test after its 150-second timeout. The exact test was reproduced on clean `main` and failed in the same test with the same 150-second timeout during the post-navigation RTT identity/contentfulness checks, confirming a baseline renderer/E2E issue rather than an Oblique regression.

## Reviewer focus

Photographic plausibility of the level table plus separate board, canonical transform consistency, real film-footprint visibility, re-derived compound calibration, Tilt-only insufficiency, public reachability, and preservation of guided/free integration.
