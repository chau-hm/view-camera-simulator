# Current Work Handoff

## PR 7A — Architecture + Foreground: Scene Foundation + Neutral Photographic Problem

- Branch: `feature/architecture-foreground-foundation`
- Base: `origin/main` @ `f8faecaf642981c227ad3cfb7de4ea7f6234efb1`
- Substantive implementation HEAD: `c844fcd`
- Objective: add a public Free Practice foundation scene that shows a level,
  front-on building with a cropped roof and a visibly softer near foreground,
  without exposing solving controls or guided tasks.

## Implemented surfaces

- Canonical geometry: `src/scenes/architectureForegroundGeometry.ts` and the
  scene definition with reusable composition/focus targets and finite bounds.
- Native subject/RTT: `ArchitectureForegroundSubjectFactory`, scene-subject
  registry entry, centralized RTT registration, and calibrated display blur
  settings using the shared physical optics state.
- Teaching geometry: side-view ground/building guides, target labels, and
  Geometry View integration.
- Public integration: scene registry/order, Free-only catalog entry, English
  and zh-HK copy, and scene-specific Free Practice observation guidance.
- Tests: canonical optics/subject/RTT contracts, catalog/route contracts,
  copy/view contracts, and focused Chromium E2E.

## Neutral calibration

- Lens: 150 mm; raw building-middle focus distance 9,488 mm; public rounded
  focus value 9,490 mm; starting aperture f/11.
- Ground: y = -1,400 mm, z = 700–12,500 mm; building front façade z = 9,500
  mm, width 4,200 mm, main height 4,500 mm, roof top y = 3,550 mm.
- Camera and standards: level body/optical axis; Front Rise/Tilt/Swing and
  Rear Rise/Tilt are all 0 at neutral.
- Neutral evidence: roof-top region is cropped, parapet/base remains framed,
  vertical edges project with constant horizontal coordinates, building
  middle sharpness is at least 0.8, and near foreground sharpness is below
  0.5 and below the building.
- Future viability probes: +20 mm rise recovers the roof, +5° tilt changes
  the focus plane, focus range is 3,500–12,500 mm, and f/22 is available to
  later aperture calibration. These values are not public controls in PR 7A.

## Validation

- `npm test` (bundled Node): PASS — 122 files / 1,140 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:css`: PASS.
- `npm run build`: PASS.
- Focused Chromium E2E: PASS — Architecture + Foreground neutral workflow.
- `git diff --check`: PASS before commit.

## Deliberate exclusions

- No Front Rise, Front Tilt, Front Swing, rear movement, focus, or aperture
  solving controls are enabled.
- No guided task IDs, guided lesson stages/copy, evaluator, or extension of
  `PublicGuidedLessonTaskStageId` (PRs 7B–7F).
- No global optics formulas, movement signs, RTT architecture/lifecycle,
  persistence, new movement types, or existing-scene behavior changes.

## Checks not run / known risks

- Full `npm run ci:local:e2e` was not run: no renderer-wide lifecycle or GPU
  ownership changes were introduced, and the focused Chromium proof passed.
- Reviewer focus: subjective Ground Glass legibility of the patterned paving,
  the intentionally partial roof crop, and future 7B–7D calibration range.
  The catalog currently reuses the existing Architecture Rise thumbnail as the
  established foundation asset.
