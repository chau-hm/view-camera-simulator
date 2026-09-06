# PR131 — Oblique Tabletop photographic plausibility

## Objective

Make Oblique Tabletop photographically plausible with a normal level worktable supporting one separate inclined subject/plan board, while preserving the existing optical, RTT, and guided-lesson contracts.

## Branch / base / head

- Branch: `fix/oblique-tabletop-photographic-plausibility`
- Worktree: `/Users/homan/repo/view-camera-oblique-tabletop-plausibility`
- Base: `origin/main` at `766332e95ca42066f2f05e6f2f93d234ba45a79e`
- Reviewed head before this bookkeeping correction: `24bcf5edac0e5da25859ff15efe599cf7ad87270`
- Final head: documentation-only descendant at the PR tip; see PR #131 metadata.

## Canonical geometry and surface

- Level table: `4000 × 4200 × 100 mm`, with zero X/Y rotation.
- Subject board: `2600 × 3000 × 60 mm`, `rotationX=-25°`, `rotationY=+40°`, centre `{x: 0, y: 361.116626, z: 4550}`.
- `subjectBoardPlane` is the canonical optical and teaching subject plane. The upper physical board face is the single rendered photographed surface; the raised visible detail outer surface is the focus sample plane. The 3D subject, RTT, markers, samples, bounds, guides, and calibration all derive from the same board transform. No mirrored presentation copy remains.
- Canonical board normal: `(-0.271654, 0.906308, -0.323744)`; camera-facing face dot-product evidence is `0.244851`.

## Calibration and physical evidence

- Continuous compound solution: Tilt `+7.062058°`, Swing `+2.128033°`, Focus `2498.863421 mm`.
- Public compound solution: Tilt `+7.1°`, Swing `+2.1°`, Focus `2500 mm`, f/11.
- Tilt-only state: Tilt `+3.6°`, Swing `0°`, Focus `3530 mm`, f/11.
- All seven analytical samples pass at the public compound state; maximum measured CoC is `0.006784 mm`. The exhaustive public Tilt + Focus search still finds zero full-plane solutions, and opposite Swing remains materially worse.
- Learner-visible interior targets remain inside the physical film footprint at neutral and compound states.

## Guided progression

- Swing stage: `+7.1° / +2.1° / 2440 mm` establishes lateral improvement while the full-target gate remains incomplete.
- Refine Focus: preserves the same Tilt/Swing, changes Focus `2440 → 2500 mm`, and is the first full learner-visible-target sharpness gate.
- Aperture remains the final f/22 stage; Free Practice remains fixed at f/11.

## Thumbnail provenance

The Oblique Tabletop raster scene card was regenerated earlier in PR131 to match the corrected normal-table / inclined-board concept. Later geometry refinements did not require another regeneration, and the current asset remains representative of the final scene. Current blob: `aec6f62a245458608a06aa54f69e9e5b59b133e0`.

## Validation

- Focused Oblique Tabletop Vitest: 10 files / 141 tests passed.
- Full `npm test`: 164 files / 1596 tests passed.
- Typecheck, lint, `check:css`, build, and `git diff --check`: passed.
- Focused Oblique Tabletop Chromium: 2/2 passed; manual neutral, Tilt-only, and compound Ground Glass inspection passed.
- `CI=1 npm run ci:local:e2e` passed CSS, lint, typecheck, unit/integration, and build, then stopped at the unrelated `architecture-foreground-tilt-focus.spec.ts` because two tests timed out waiting for the shared `Focus distance` slider. The exact two failures reproduced on clean `main` at `766332e95ca42066f2f05e6f2f93d234ba45a79e`.
- Current-head GitHub CI at reviewed head `24bcf5e` passed lint, type-check, and unit/integration; this bookkeeping commit requires its own exact-head check.

## Scope and known gaps

No optics, geometry, renderer, lesson, calibration, test, or asset changes are included in this bookkeeping correction. The known architecture Foreground E2E baseline issue remains outside PR131 scope; later E2E specs after that failure were not run by the stopped full command.
