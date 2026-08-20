# Current Work Handoff

## PR 7B — Architecture + Foreground: Front Rise Composition Slice

- Branch: `feature/architecture-foreground-rise`
- Base: `origin/main` @ `c1fa5f941d7c45f3a39a11de439d776b81d42906`
- Substantive implementation HEAD: `94a7952`.
- Objective: make Front Rise the only public solving movement for the
  Architecture + Foreground composition problem and add the direct guided task
  `architecture-foreground-rise-01`.

## Implemented surfaces

- Scene policy: `architecture-foreground` now exposes only `frontRiseMm` in
  Free Practice and keeps focus, aperture, and all other movements fixed.
- Task/evaluator: roof and base projected-corner coverage, level camera/rear
  standard, and nonzero Rise; no exact slider value or focus criterion.
- Public integration: `availableModes: ["free", "guided"]`, direct
  `guidedTaskId`, route/catalog validation, English and zh-HK task/free-practice
  copy, and Rise-only task controls.
- Asset: generated raster scene-card thumbnail at
  `public/assets/architecture-foreground.png`.
- Tests: canonical Rise calibration, catalog/routes/copy, existing neutral
  foundation regression, and focused Chromium Free Practice/guided workflows.

## Rise calibration and teaching distinction

- Neutral: `Front Rise = 0 mm`; projected roof coverage is below the 0.95
  requirement while the base remains visible; camera/rear standard stay level.
- Canonical solved reference: `+20 mm` (PR7A future-rise probe).
- Nearby accepted public steps: `+10, +11, +20, and +25 mm` pass the same
  observable roof/base criteria; `+1 mm` leaves the roof cropped and `+30 mm`
  loses the base.
- Solved Rise state preserves parallel architectural verticals and the
  building/near-foreground sharpness difference; foreground sharpness remains
  intentionally unresolved for later slices.

## Validation

- `npm test -- --run`: PASS — 123 files / 1,148 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:css`: PASS.
- `npm run build`: PASS.
- Focused Chromium E2E: PASS — 3 tests covering neutral Free Practice, Rise
  interaction/RTT, and guided completion/restart.
- `git diff --check`: PASS.

## Checks not run / deliberate exclusions

- Full `npm run ci:local:e2e` was not run: no renderer-wide lifecycle, RTT
  architecture, or GPU-resource ownership changes were introduced, and focused
  Chromium proof passed.
- PRs 7C–7F remain deferred: Front Tilt + Focus, Aperture/DOF, compound
  challenge, guided lesson/stage integration, future task IDs, and any
  `PublicGuidedLessonTaskStageId` extension.

## Reviewer focus / known risks

- Confirm the projected-corner thresholds remain legible as the canonical
  framing contract and that the base-loss guard at excessive Rise is desirable.
- Confirm the generated thumbnail matches the existing card style and that the
  foreground pattern remains visually distinguishable in Ground Glass.
- No global optics formulas, movement signs, shared RTT architecture, or
  existing-scene behavior were changed.
