# Current Work Handoff

## Work

PR / work identifier: PR 6G — Localization UX + Terminology & Scene Copy Polish
Branch: `content/localization-ux-polish`
Base: `origin/main` @ `8f9e7e9390f84e1aca0317b7576efe117a80d180`
Head convention: record the substantive implementation commit here; the
final status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Make the bilingual learner experience consistent with the canonical learning
model by exposing locale switching in the simulator header, correcting
zh-HK camera terminology, and aligning the six public scene titles and
learning-purpose descriptions without changing simulator behavior.

## Implemented

- Reused the existing `LanguageSelector` in the full-bleed simulator header;
  shared site pages continue to use `SiteHeader`.
- Added a small narrow-width header wrap adjustment without redesigning the
  simulator layout or changing independent scrolling behavior.
- Updated zh-HK explanatory uses of large format/view camera to
  `大片幅相機`.
- Established and applied the distinction between technical standard
  movements (`相機移軸`) and physical whole-camera movement
  (`整部相機移動` / `移動整部相機`). Individual named movements remain
  `前組上移`, `前組傾斜`, `前組擺動`, and `前組橫移`.
- Replaced the six zh-HK public scene titles with the canonical learner-facing
  titles and rewrote all six English and zh-HK catalog descriptions as concise
  learning-purpose statements.
- Updated only directly affected Free Practice, i18n, scene-catalog, and
  simulator-header assertions.

## Changed surface

- `src/components/layout/SimulatorWorkspace.tsx`
- `src/index.css`
- `src/i18n/messages/en/scenes.ts`
- `src/i18n/messages/zh-HK/common.ts`
- `src/i18n/messages/zh-HK/home.ts`
- `src/i18n/messages/zh-HK/readouts.ts`
- `src/i18n/messages/zh-HK/scenes.ts`
- `src/i18n/messages/zh-HK/simulator.ts`
- `docs/I18N.md`
- Directly affected integration tests under `src/tests/integration/`

No scene IDs, public catalog order, route IDs, guided task IDs, task or
evaluator logic, optics, calibration, renderer, RTT, package, dependency,
or deployment workflow files changed.

## Validation

- Focused header/i18n/catalog/Free Practice integration tests: passed; 4
  files, 11 tests.
- Full `npm test`: passed; 115 test files, 1,073 tests.
- `npm run typecheck`: passed.
- `npm run lint`: passed with zero warnings.
- `npm run check:css`: passed.
- `npm run build`: passed.
- `git diff --check`: passed.
- Final `git status --short` will be verified after the handoff commit and
  after feature-branch publication.

## Validation not run

- Browser E2E was not run: no targeted language-selector browser spec exists;
  the nearest focused React integration coverage exercises the simulator
  header through accessible controls, locale switching, route preservation,
  document language, persisted locale, and camera-state preservation. No
  renderer, optics, lifecycle, or public-control behavior changed.
- Production release validation and publication were not run. PR 6G must be
  reviewed and merged to `main` before the separately authorized release
  phase begins.

## Important decisions

- The simulator header reuses `LanguageSelector`; no second locale store,
  route prefix, reload, or locale architecture was added.
- Locale switching remains presentation-only. Focused integration coverage
  verifies the route, scene, viewpoint lesson state, target region, document
  language, and persisted locale behavior.
- `docs/I18N.md` now records `大片幅相機`, `相機移軸`, and the separate
  whole-camera movement terms, and documents selector availability in both
  headers.
- Scene identity, ordering, routes, task identity, evaluator facts, and
  learner-readout behavior remain stable.

## Remaining risks / known gaps

- Some remaining simulator shell/control and diagnostic strings are outside
  this bounded localization sweep and remain deferred.
- zh-HK wording has semantic integration coverage but still merits native
  language editorial review.
- Production remains unreleased until the reviewed PR 6G snapshot is merged
  to `main` and the dedicated release procedure is followed.

## Reviewer focus

1. Verify the selector is available in Home, Scenes, Free Practice, and
   Guided Task through the shared site/simulator headers, with Result and Not
   Found retaining shared site-shell access.
2. Verify `大片幅相機`, `相機移軸`, and `整部相機移動` are used naturally and
   whole-camera movement is not conflated with standard movement.
3. Verify the six zh-HK titles and the English/zh-HK catalog descriptions
   explain learning purpose rather than operating instructions.
4. Verify simulator locale switching does not reset route, scene, camera
   state, current task, or learner readout facts.
5. Verify scene IDs/order, routes, guided task IDs, and available modes are
   unchanged.
6. Verify no task/evaluator/optics/calibration/rendering/deployment or broad
   simulator localization changes entered the PR.
7. Verify no production release is attempted before PR 6G is reviewed and
   merged to `main`.

## Production release authorization

The user authorized release of PR 6G after the reviewed PR has successfully
merged to `main`. This feature phase does not publish or merge to
`production`; the release branch and production PR are deferred until the
post-merge release gate.

## Since previous review

Not applicable

## Commit

Substantive implementation: `d7d3b13e0605f2625fbc97f2a55e43397250ce5f`

Final bookkeeping: the status-only commit that records this handoff is
intentionally not self-referenced to avoid recursive commits.
