# PR131 — Oblique Tabletop photographic plausibility

## Objective

Make Oblique Tabletop photographically plausible with a normal level worktable supporting one separate inclined subject/plan board, while preserving the existing optical, RTT, and guided-lesson contracts.

## Branch / base / head

- Branch: `fix/oblique-tabletop-photographic-plausibility`
- Worktree: `/Users/homan/repo/view-camera-oblique-tabletop-plausibility`
- Base: `origin/main` at `8c8a211796ac81f20f560bc5076217251a4a13f2` (PR 11D.1 merged)
- Previous reviewed PR131 head: `b51285ca7cd8d6398d0c4ac55aa85c99a4cb098b`
- Post-sync merge commit: `3970a19ed2e567ad82a4dfd66a03e3c243926bdb`.
- Final validation handoff: this file is refreshed at the post-sync branch tip; the exact final head is reported with the publication record.

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

- Focused Oblique Tabletop Vitest: 7 files / 106 tests passed, including marker/detail separation; the exhaustive Tilt-only proof completed in 3,163 ms.
- Full `npm test`: 164 files / 1,599 tests passed in 14.06 s.
- Typecheck, lint, `check:css`, build, and `git diff --check`: passed.
- Focused Oblique Tabletop Chromium: 2/2 public guided-lesson and teaching-geometry specs passed in 1.1 min; Ground Glass remained present through both flows.
- `CI=1 npm run ci:local:e2e`: CSS, lint, typecheck, 164/1,599 unit/integration tests, build, and earlier E2E specs passed; it stopped at `mirror-shift-teaching-geometry.spec.ts` because `data-rtt-final-contentful=true` was not observed within 30 s (1 test failed, 1 passed).
- The same exact Mirror Shift spec reproduced on clean `origin/main` `8c8a211796ac81f20f560bc5076217251a4a13f2` with the same 1 failure / 1 pass result, so this remains an unrelated baseline E2E issue.
- Current-head GitHub CI: pending for the final post-sync tip; deploy is expected to be skipped for the PR.

## Scope and known gaps

PR131 is a high-risk Oblique Tabletop simulation correction. Relative to its current main base it changes the subject geometry from a tilted whole table to a level table plus inclined board; updates the shared 3D/RTT renderer, optical calibration, teaching geometry, guided-task states/copy, physical regressions, and scene-card asset. Subsequent review corrections updated the canonical handoff, fixed asset provenance, and separated the learner-visible middle focus detail from the visual middle marker. No further recalibration or lesson redesign was introduced by the review fixes.

The middle focus detail remains canonical at board-local `{x: 0, z: 0}`, while its marker is a nearby marker-only reference at `{x: 360, z: 0}`; a board-local regression prevents marker/detail coverage and the existing rendered-surface/probe contract remains intact. PR11D.1 landing files are part of the synchronized base, not PR131 scope. The current thumbnail remains unchanged at blob `aec6f62a245458608a06aa54f69e9e5b59b133e0`.
