# Current Work Handoff

## PR 7C — Architecture + Foreground: Front Tilt + Focus Slice

- Branch: `feature/architecture-foreground-tilt-focus`
- Base: `origin/main` @ `cc20652ecc20de0215bb5b62a7d8a503911e4587`
- Substantive implementation HEAD: `6b31073`.
- Objective: preserve PR7B’s solved Rise composition and teach Front Tilt plus
  Focus as a second, observable focus-plane problem.

## Implemented surfaces

- Scene capability: Free Practice now exposes Front Rise, Front Tilt, Focus,
  and Geometry View; Swing, rear movements, and Aperture remain unavailable or
  fixed. The existing 3D/RTT subject and side-view geometry pipeline are
  unchanged.
- Guided task: registered `architecture-foreground-tilt-focus-01`; it starts
  at solved Rise composition, Tilt 0°, canonical PR7B focus, fixed Aperture,
  and exposes only Tilt, Focus, and Geometry View for solving.
- Evaluator: reuses roof/base projected composition targets and level-camera
  truth; requires useful positive Tilt, Focus adjustment, near foreground and
  building-middle sharpness, and rejects Tilt-only, Focus-only, excessive-Tilt,
  lost-roof, and non-level states.
- Public integration: Architecture + Foreground now has two direct guided task
  IDs (Rise and Tilt + Focus), valid routes, cumulative Free Practice copy,
  English and zh-HK task copy, and a verified visible Scenes-page card using
  `public/assets/architecture-foreground.png`.

## 7C calibration and teaching distinction

- Initial 7C state: Rise `+20 mm`, Tilt `0°`, Focus `9490 mm`, Aperture `f/11`;
  roof/base remain framed, verticals remain parallel, building-middle is
  sharp, and near foreground is soft.
- Canonical solved reference: Tilt `+2.0°`, Focus `6830 mm`; positive Tilt is
  the calibrated direction toward the foreground under the existing sign
  convention.
- Useful accepted Tilt range: `+1.7°` to `+2.6°`; public steps are `0.1°` and
  Focus steps are `10 mm`. Nearby probes `+1.8° / 6750 mm` and
  `+2.2° / 6930 mm` pass the same sharpness criteria.
- Solved 7C state keeps Aperture at `f/11`; the building-base and
  middle-foreground targets remain below the 0.7 sharpness threshold, leaving
  a meaningful finite-DOF problem for PR7D.

## Validation

- `npm test -- --run`: PASS — 124 files / 1,159 tests.
- `npm run typecheck`: PASS.
- `npm run lint`: PASS.
- `npm run check:css`: PASS.
- `npm run build`: PASS.
- Focused Chromium E2E: PASS — 6 tests covering Scenes-page discovery and
  navigation, cumulative Free Practice/RTT response, existing Rise behavior,
  and Tilt + Focus task completion/restart.
- `git diff --check`: PASS.

## Checks not run / deliberate exclusions

- Full `npm run ci:local:e2e` was not run: no renderer lifecycle, shared RTT
  architecture, GPU resource ownership, or broad routing changes were made;
  focused Chromium coverage passed.
- PR7D–7F remain deliberately deferred: Aperture/DOF task, compound challenge,
  guided lesson/stage integration, future task IDs, and any
  `PublicGuidedLessonTaskStageId` extension.

## Reviewer focus / known risks

- Confirm the modest positive Tilt range and `0.7` sharpness threshold remain
  legible with the current Ground Glass presentation and task feedback.
- Confirm the new `focus-used` criterion’s initial-state comparison remains
  appropriate for future tasks that may reuse the shared evaluator.
- Confirm the Scenes-page primary Guided CTA pointing to the newest direct task
  matches the project’s multi-task catalog convention; the older Rise route
  remains directly valid.
- No global optics formulas, movement signs, shared RTT architecture, renderer
  lifecycle, or unrelated scene behavior were changed.
