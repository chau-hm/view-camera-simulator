# Oblique Tabletop — Photographic Plausibility

## Scope

Focused PR131 review fix: a level worktable supports one inclined drafting/copy board, which is the single canonical optical subject for the existing Tilt + Swing + Focus sequence. PR10C/10D/10E behavior remains bounded to the existing public lesson and geometry paths.

## Branch / worktree / base

`fix/oblique-tabletop-photographic-plausibility` · `/Users/homan/repo/view-camera-oblique-tabletop-plausibility` · base `766332e95ca42066f2f05e6f2f93d234ba45a79e`

## Canonical scene geometry

- Table remains level: `4000 × 4200 × 100 mm`, centre `{x: 0, y: -350, z: 4550}`.
- One subject board: `2600 × 3000 × 60 mm`, centre `{x: 0, y: 361.116626, z: 4550}`, supported at the table's near edge, orientation `rotationX=-25°`, `rotationY=+40°`.
- The upper board face is the real camera-facing photographed surface (`local y=+30`); its focus/detail surface is derived at `local y=+40`. The same board assembly drives 3D, RTT, details, markers, samples, bounds, guides, and calibration. The duplicate underside/presentation rendering was removed.
- Canonical board/focus-plane normal is `(-0.271653782, 0.906307787, -0.323744371)` with canonical signed distance `-1105.754078 mm`. Calibration uses the equivalent front-facing plane normal with positive z and distance `+1105.754078 mm` without changing the core optics model.

## Optical evidence

- Continuous compound calibration: Front Tilt `+7.062058°`, Front Swing `+2.128033°`, Focus `2498.863421 mm`.
- Public compound calibration: Front Tilt `+7.1°`, Front Swing `+2.1°`, Focus `2500 mm`, f/11.
- Recalibrated PR10B Tilt-only state: Front Tilt `+3.6°`, Swing `0°`, Focus `3530 mm`; it improves the principal near/far relationship but remains unable to solve the full analytical board. Swing remains materially necessary and the opposite sign is worse.
- Seven analytical samples remain full-surface edge coverage; learner-visible targets remain a distinct interior set. The public compound analytical CoCs and the exhaustive Tilt-only proof are unchanged in meaning and use the real photographed/focus surface.

## Ground Glass / visual contract

- The actual film-plane projection keeps every learner-visible target inside the physical frame at neutral, Tilt-only, and compound states. Current visible-target bounds are approximately `u=.191–.789, v=.448–.636` at neutral and `u=.188–.792, v=.447–.638` at compound; spans remain useful (`Δu≈.60`, `Δv≈.19`).
- Board bounds remain finite and meaningfully intersect the frame. The prior invalid bounds mapping was corrected so RTT camera configuration receives finite near/far values.
- Focus probes and the visible detail outer surface coincide with the canonical focus surface. The face-orientation and rendered-normal tests prove the photographed face points toward the unchanged photographic camera and the renderer/RTT basis matches canonical geometry.

## Guided lesson correction

- Swing starts from the recalibrated Tilt-only state `+3.6° / 0° / 3530 mm`, then establishes public compound orientation at `+7.1° / +2.1°` with intermediate Focus `2440 mm`; Swing passes on lateral improvement while the full-plane criterion remains incomplete.
- Refine starts from that same useful compound orientation and `2440 mm`, exposes Focus plus Geometry View, and is completed by Focus-only refinement to `2500 mm`. Aperture remains the final f/22 stage; Free Practice remains fixed at f/11.
- Existing guided and teaching-geometry E2E specs passed after the real subject-face and finite-bounds corrections (`2/2`).

## Since review

- Removed duplicated underside/presentation subject rendering and established one real camera-facing board surface.
- Re-derived board placement/orientation, compound calibration, and PR10B Tilt-only calibration; preserved the existing optics engine, ranges, steps, threshold, and camera.
- Preserved analytical full-surface proof and separated learner-visible targets; confirmed finite film-footprint bounds and focus/detail-plane coincidence.
- Corrected Step 4 to establish the useful compound orientation and Step 5 to be a genuine Focus-only refinement; focused regressions cover the partial Swing boundary and preserved movements.

## Integration / validation state

Focused Vitest: 10 files / 141 tests passed. Full `npm test`: 164 files / 1596 tests passed. Typecheck, lint, CSS structure, and production build passed. Focused Oblique Tabletop Chromium specs passed serially (`2/2`). `CI=1 npm run ci:local:e2e` passed CSS, lint, typecheck, unit/integration (164/1596), and build, then failed at the unrelated `architecture-foreground-tilt-focus.spec.ts` after both free/guided tests timed out waiting for the shared `Focus distance` slider. The exact spec reproduced the same two failures on clean `main` at `766332e95ca42066f2f05e6f2f93d234ba45a79e` (baseline, not an Oblique regression). Exact-head GitHub CI remains to be run for this review fix.

`.agents/status/CURRENT.md` is intentionally untouched; this file is the work-specific handoff. The catalog raster card was not regenerated because it remains an accurate representation of the level table and inclined board.

## Reviewer focus

Verify one real photographed board face, canonical/render/RTT consistency, finite bounds and target visibility, re-derived public calibration, Tilt-only insufficiency, Swing necessity, and the Focus-only Step 5 progression.
