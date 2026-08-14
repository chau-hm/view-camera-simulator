# Current Work Handoff

## Work

PR / work identifier: PR 6D — Free Practice + General Teaching Copy Alignment
Branch: `content/free-practice-teaching-copy`
Base: `origin/main` @ `9b4cf4e6df96bdd53797a72bd26fcecbc5edd37e`
Head convention: record the substantive implementation commit here; a final
status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Localize the current simulator Free Practice and Movement Help teaching copy
through the PR 6C i18n foundation, while preserving simulator behavior,
guided-task architecture, evaluator state, readouts, routes, scene identity,
optics, calibration, and rendering.

## Implemented

- Added typed `simulator` message catalogs for `en` and `zh-HK`, with one
  shared semantic key tree and English-defined resource shape.
- Refactored Free Practice guidance and live observations into pure semantic
  key lookups. All six public scenes have scene-specific objective, bullet,
  and observation coverage; unknown scenes use a neutral generic fallback.
- Translated Free Practice and FeedbackPanel content at the presentation
  boundary. Guided Task teaching, evaluator feedback, readouts, and the
  Guided no-evaluation copy remain on their existing architecture.
- Localized Movement Help for Front Rise, Front Tilt, and Front Swing using
  canonical Front-standard, lens-plane, plane-of-sharp-focus, and Ground
  Glass terminology without X/Y-axis jargon.
- Removed only the migrated simulator `UI_COPY` entries that became unused;
  left the remaining copy surface unchanged.
- Updated `docs/I18N.md` to record simulator teaching-copy coverage and the
  presentation-only translation boundary.

## Changed surface

- `docs/I18N.md`
- `src/components/controls/MovementControls.tsx`
- `src/components/simulator/FeedbackPanel.tsx`, `TaskPanel.tsx`,
  `taskHelpers.ts`
- `src/i18n/messages/en/index.ts`, `messages/en/simulator.ts`,
  `messages/zh-HK/index.ts`, `messages/zh-HK/simulator.ts`,
  `src/i18n/simulatorMessageKeys.ts`
- `src/tests/integration/freePracticeCopy.test.tsx`,
  `src/tests/unit/freePracticeKeys.test.ts`,
  `src/tests/unit/tableTiltTaskContent.test.ts`
- `src/ui/copy.ts`
- `.agents/status/CURRENT.md`

No package, dependency, CI, route, scene metadata, task definition,
evaluator, camera-state, readout, optics, calibration, renderer, or CSS
changes were made.

## Validation

- Focused tests: passed; 3 files, 14 tests.
- `npm test`: passed; 112 test files, 1,051 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- `git status --short`: clean before this handoff update (no output).

## Not run

- E2E: not run; this PR changes bundled simulator presentation copy and
  i18n-boundary wiring only, with focused UI/integration coverage and no
  route, scene-state, rendering, or WebGL behavior change.

## Key decisions

- English is the canonical simulator resource shape; `zh-HK` satisfies the
  same typed key contract and uses the learning-model terms 視點, 構圖,
  透視幾何, 前組/後組, 鏡頭平面, 底片平面, 清晰焦平面, 對焦屏, and 視差.
- Domain helpers return semantic message keys only. React presentation
  boundaries perform translation, so translated strings never drive scene
  state, task identity, or evaluator behavior.
- Free Practice copy covers Understanding Camera Movements, Focus
  Fundamentals, Architecture Rise, Table Tilt, Shelf Swing, and Mirror
  Shift. Focus remains fixed at f/32; Mirror Shift explicitly separates
  whole-camera Viewpoint movement from Front Shift framing restoration.
- Guided-task copy and the broader simulator `UI_COPY` surface are deferred
  to PR 6E/6F as requested. No simulator language selector was added.

## Remaining risks / known gaps

- Guided Task teaching/evaluator feedback, readouts, diagnostics, and other
  simulator copy remain English and are intentionally deferred.
- The new `zh-HK` simulator wording has representative automated coverage
  but no separate native-language editorial review.
- E2E/browser validation and any future simulator locale selector remain
  deferred; no route or persistence behavior was changed here.

## Reviewer focus

1. Verify the simulator message catalogs share a complete typed key shape and
   the English fallback remains intact.
2. Verify all six public scenes have correct Free Practice objective, bullet,
   live-observation, and unknown-scene fallback coverage.
3. Verify Viewpoint, Framing, Front/Rear standards, lens-plane/film-plane,
   plane-of-sharp-focus, Ground Glass, and fixed-f/32 semantics in both
   locales.
4. Verify Movement Help describes Front Rise/Tilt/Swing accurately without
   introducing X/Y-axis jargon.
5. Verify translation happens only at presentation boundaries and does not
   change scene state, task identity, evaluator criteria, readouts, routes,
   optics, calibration, or rendering.
6. Verify Guided Task teaching and evaluator/readout architecture remains
   unchanged and `src/ui/copy.ts` was not broadly migrated.
7. Verify no i18n dependency, locale-selector, route, CSS, or unrelated copy
   cleanup entered the PR.
8. Verify the change remains bounded to the requested Free Practice/general
   teaching-copy alignment.

## Since previous review

Not applicable

## Commit

Substantive implementation: `6b00f268075d3ab63bd65c23b4aa96d8e11f8278`

Final bookkeeping: the status-only commit that records this handoff update;
intentionally not self-referenced to avoid recursive commits.
