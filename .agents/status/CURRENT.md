# Geometry presentation policy — focused refactor

- Work identifier: `refactor/geometry-presentation-profile` / PR #104.
- Branch/base: `refactor/geometry-presentation-profile` from `origin/main` `8f72c435`.
- Substantive HEAD: `6a580bab` (`refactor(geometry): centralize presentation policy`).
- Objective: centralize Geometry-specific default subject view and diagram-variant semantics without changing shared Scheimpflug capability or optical geometry.

## Architecture decision

- `GeometryPresentationProfile` now owns `defaultSubjectView` and `diagramVariant` alongside its existing static Geometry presentation settings.
- `getPreferredSubjectGeometryView` is a pure movement resolver accepting only `defaultView`, tilt, and swing; its scene-ID map was removed.
- `GeometryViewport` resolves the profile and routes Mirror Shift teaching behavior through `diagramVariant`. Focus Fundamentals reference-optics logic remains its explicit physical-special-case branch.
- `scheimpflugSceneSupport.ts` remains the shared capability source for both viewports; `SceneViewport` is unchanged.

## Scope and evidence

- Changed: `geometryPresentationProfiles.ts`, `getPreferredSubjectGeometryView.ts`, `GeometryViewport.tsx`, and focused profile/resolver/viewport tests.
- Static audit: no scene-ID map or `sceneId` parameter remains in the movement resolver; GeometryViewport has no Mirror Shift scene-ID presentation branch. No labels/guides, math, Ground Glass, 3D, or Scheimpflug files changed.
- Focused Geometry unit coverage passed; final full unit/integration suite passed 144 files / 1,377 tests. Typecheck, lint, CSS check, build, and `git diff --check` passed.
- Focused browser batch: 33 passed / 10 failed; failures were existing RTT/WebGL, resource, layout, or task-baseline paths, with no profile/resolver assertion failure. `npm run ci:local:e2e` passed CSS/lint/typecheck/unit/build, then stopped at `mirror-shift-teaching-geometry.spec.ts:3` waiting 30s for `ground-glass-rtt[data-rtt-final-contentful="true"]`; its second test passed.
- Remote Actions: PR #104 push run `33230353071` and pull-request run `33230381351` both fail during `npm ci` with `No matching version found for eslint-plugin-react-hooks@^6.8.0`; lint/tests are skipped and deploy is skipped. No dependency/workflow changes were made.

## Reviewer focus

- Verify profile defaults: ordinary scenes side/optical-section, Oblique Architecture top, Shelf Swing top, and Mirror Shift top/mirror-shift-teaching.
- Verify movement tie semantics and GeometryViewport Mirror Shift routing remain unchanged while Scheimpflug capability stays shared and separate.
- Remaining risk is the documented repository WebGL/RTT E2E baseline; no visual or physical geometry changes are intended.
