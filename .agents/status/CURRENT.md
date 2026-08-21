# Current Work Handoff

## PR 7D — Architecture + Foreground: Aperture / Depth-of-Field Slice

- Branch: `feature/architecture-foreground-depth-of-field`
- Base: `origin/main` @ `d995f36` (PR 7C baseline).
- Substantive implementation HEAD: `11a5c47`.
- Objective: start from the solved Rise + Tilt + Focus state and teach
  Aperture as the remaining usable-depth control.

## Implemented surfaces

- Free Practice: Architecture + Foreground now exposes Front Rise, Front Tilt,
  Focus, Aperture, and Geometry View. Front Swing and rear movements remain
  unavailable; the shared 3D, RTT, and side-view geometry pipelines are
  unchanged.
- Guided task: registered `architecture-foreground-dof-01` with only Aperture
  and Geometry View enabled. Rise, Tilt, Focus, Swing, and rear movements are
  locked by the existing task-control contract.
- Evaluator: reuses projected roof/base and level-camera criteria, requires a
  stopped-down supported aperture, and evaluates all four canonical focus
  targets at a calibrated 0.6 sharpness threshold.
- Public integration: `guidedTaskIds` now contains Rise, Tilt + Focus, and DOF;
  the primary Guided CTA points to the newest DOF task. The Scenes-page card
  remains visible and retains `public/assets/architecture-foreground.png`.
- Copy: cumulative Free Practice guidance and English/zh-HK task copy now
  distinguish focus-plane alignment from aperture-expanded depth of field.

## 7D starting state and calibration

- Guided initial state: Front Rise `+20 mm`, Front Tilt `+2.0°`, Focus
  `6830 mm`, Aperture `f/11`; roof/base remain framed, verticals remain
  parallel, and the established PR 7C focus plane is unchanged.
- At f/11 target sharpness: foreground-near `0.914`, foreground-middle
  `0.155`, building-base `0.000`, building-middle `0.909`.
- Calibrated DOF threshold: `0.6` across foreground-near, foreground-middle,
  building-base, and building-middle. f/11 fails because residual foreground
  and base targets remain soft.
- Passing apertures: f/22 is the canonical public reference; f/32 is a
  nearby valid smaller aperture. At f/22 the residual targets are `0.718` and
  `0.630`; at f/32 they are `0.893` and `0.906`.
- Aperture-only preservation: the focus plane, Rise, Tilt, Focus, level rear
  standard, and composition coverage remain unchanged while DOF expands. The
  f/11 near/far depth range is approximately `5158–10107 mm`; f/22 expands it
  to approximately `4155–19170 mm`.
- Negative probes: f/32 with Tilt reset to `0°` fails on near sharpness
  (`0.353`); f/32 with Focus reset to the PR 7B value fails on near sharpness
  (`0.531`). Aperture cannot hide an incorrect focus-plane setup.

## Validation

- `npm test -- --run`: PASS — 125 files / 1,167 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:css`: PASS.
- `npm run build`: PASS.
- Focused Chromium E2E: PASS — 6 tests covering Scenes-page discovery,
  cumulative Free Practice controls/RTT, Rise and Tilt + Focus regressions,
  and the Aperture-only DOF task completion/restart workflow.
- `git diff --check`: PASS.

## Checks not run / deliberate exclusions

- Full `npm run ci:local:e2e` was not run: no renderer lifecycle, shared RTT
  architecture, GPU ownership, or broad routing changes were made; focused
  Chromium coverage passed.
- PR 7E and PR 7F remain deliberately deferred: compound challenge, guided
  lesson/stage integration, future compound task ID, and any
  `PublicGuidedLessonTaskStageId` extension.

## Reviewer focus / known risks

- Confirm the 0.6 illustrative sharpness threshold and f/22/f/32 pass range
  remain visually legible on the current Ground Glass presentation.
- Confirm the task’s locked-control contract is sufficient for preserving the
  7C focus-plane state; direct negative probes cover Tilt/Focus corruption.
- Confirm the newest-task Scenes-page Guided CTA convention remains correct;
  all three direct Architecture + Foreground guided routes remain valid.
- No global optics formulas, movement signs, shared RTT architecture,
  renderer lifecycle, thumbnail asset, or unrelated scene behavior changed.
