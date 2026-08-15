# Current Work Handoff

## Work

PR / work identifier: PR 6F — Scene-aware Learner Readouts
Branch: `feature/scene-aware-learner-readouts`
Base: `origin/main` @ `440ca708f08f1bfb8c0e5b03defe393e792b6c06`
Head convention: record the substantive implementation commit here; the
final status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Make the learner readouts above Task/Feedback scene-aware and localizable in
`en` and `zh-HK`, while preserving simulator state, task behavior, controls,
routes, optics, calibration, and rendering.

## Implemented

- Added a presentation-only resolver for the six public scenes plus a safe
  standard fallback for unknown scenes.
- Understanding Camera Movements now shows the movement/teaching relationship,
  preserves the continuous teaching readout, hides Focus Targets, and omits
  generic Exposure & focus content.
- Focus Fundamentals now shows Focus method plus Exposure & focus, including
  Front/Rear relationships and the fixed f/32 value.
- Architecture Rise, Table Tilt, and Shelf Swing show their relevant Front
  movement with Focus and Aperture alongside Focus Targets.
- Mirror Shift now shows Camera Position from the existing rig-lateral state
  and Front Shift, with a single-card Viewpoint & framing readout and no empty
  Focus Targets card.
- Added typed learner-readout message catalogs and semantic keys for English
  and Hong Kong Traditional Chinese, including localized statuses, metrics,
  progress labels, and accessible names. Target IDs remain stable state data.
- Added the smallest single-column grid modifier when a second readout card is
  intentionally absent, and documented the presentation-only i18n boundary.

## Changed surface

- `src/components/simulator/learnerReadoutPolicy.ts`
- `src/components/simulator/GroundGlassReadouts.tsx`
- `src/components/layout/SimulatorWorkspace.tsx`
- `src/i18n/readoutMessageKeys.ts`
- `src/i18n/messages/en/readouts.ts`
- `src/i18n/messages/zh-HK/readouts.ts`
- `src/i18n/messages/en/index.ts`, `src/i18n/messages/zh-HK/index.ts`
- `src/index.css`
- `docs/I18N.md`
- Directly affected workspace/readout policy integration and unit tests

No task panel, feedback panel, evaluator, task registry, task copy, scene
metadata, route, camera store, control, optics, calibration, renderer, RTT,
package, dependency, or CI files changed.

## Validation

- Focused policy/readout tests: passed; 2 files, 9 tests.
- Existing affected workspace/focus/i18n integration tests: passed; 3 files,
  19 tests.
- Latest `npm test`: passed; 115 test files, 1,070 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `git status --short`: no output after the substantive commit and before this
  handoff update; the final status-only commit is expected to restore the same
  clean state.

## Validation not run

- E2E was not run; the affected readout behavior has focused integration
  coverage, and no renderer, optics, scene lifecycle, or public control
  behavior changed.
- Full `npm run ci:local:e2e` was not run for the same proportional-validation
  reason.

## Important decisions

- Readout policy is derived from stable scene IDs and actual focus-target
  presence at the presentation boundary; it is not stored in Zustand or added
  to `SceneDefinition`.
- Focus Targets render only when policy allows them and the resolved target
  array is non-empty. Understanding Camera Movements and Mirror Shift therefore
  have no empty-card or “No focus targets” state.
- English remains canonical; `zh-HK` preserves the same semantic message
  shape. Locale changes affect presentation only, not camera or optics state.
- The public movement readout localizes the existing teaching relationship and
  strips legacy A/B/C/D calibration labels from that learner-facing surface.
- Render quality, diagnostics, controls, task/free-practice copy, and other
  simulator strings remain deferred to their own content work.

## Remaining risks / known gaps

- Remaining simulator controls, diagnostics, and unrelated simulator copy are
  still outside this localized readout surface.
- The new `zh-HK` readout terminology has automated coverage but still merits
  separate native-language editorial review.
- Target IDs remain formatted stable identifiers rather than translated
  domain state; later content work may provide localized display names if the
  product adds that semantic layer.

## Reviewer focus

1. Verify each public scene receives the intended Current Settings variant and
   Focus Targets visibility policy.
2. Verify Viewpoint, Framing, Front/Rear movement, focus method, and fixed f/32
   relationships are clearly separated in the learner readouts.
3. Verify Mirror Shift uses the existing rig-lateral and Front Shift state and
   remains a Viewpoint-versus-Framing readout.
4. Verify English and `zh-HK` message shapes, accessible names, statuses, and
   metrics are localized without putting translated strings in state.
5. Verify the one-card layout does not create an empty second column and that
   Task/Feedback and Optical Debug layout behavior remains unchanged.
6. Verify no task/evaluator/control/route/scene-state/optics/calibration/
   renderer/runtime or i18n-architecture changes entered the PR.

## Since previous review

Not applicable

## Commit

Substantive implementation: `f9cc819948c903e45b6dd428130190faddc02148`

Final bookkeeping: the status-only commit that records this handoff is
intentionally not self-referenced to avoid recursive commits.
