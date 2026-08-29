# Geometry label metadata — focused refactor

- Work identifier: `refactor/geometry-label-metadata` / PR #106.
- Branch/base: `refactor/geometry-label-metadata` from latest `origin/main` `8642ca1` (PR #104 is included).
- Substantive HEAD: `ce47c3a` (`refactor(geometry): centralize label metadata`).
- Objective: make scene Geometry metadata the single source for guide/target label semantics while `OpticalSectionDiagram` only translates and renders them.

## Architecture decision

- Before: guide fallback metadata and an English target registry lived in `sceneGeometryGuides.ts`, while `OpticalSectionDiagram` duplicated guide/target scene-ID routing switches.
- After: guides carry optional `labelMessageKey`; the same metadata module owns one canonical scene/target `SimulatorMessageKey` map and resolver. The obsolete English target registry/function was removed after repository audit found no production callers.
- `OpticalSectionDiagram` now consumes guide metadata and `getSceneGeometryTargetMessageKey`; label placement, translation keys, fallback labels, and visible text remain unchanged. `GeometryPresentationProfile`, Scheimpflug support, `GeometryViewport`, Ground Glass, and 3D code are unchanged.

## Scope and evidence

- Changed: `sceneGeometryGuides.ts`, `OpticalSectionDiagram.tsx`, and focused guide/target plus Table Tilt, Shelf Swing, Focus Fundamentals, and Architecture + Foreground viewport tests.
- Static audit: no `sceneGeometryGuideMessageKey`, `sceneGeometryTargetMessageKey`, `getSceneGeometryTargetLabel`, or old target registry remains in `src`; guide/target routing is no longer defined in the SVG renderer.
- Focused unit set passed: 6 files / 82 tests. Final full unit/integration suite passed: 145 files / 1,392 tests. Typecheck, lint, CSS check, build, and `git diff --check` passed.
- Focused browser batch: 31 passed / 10 failed; failures were existing WebGL screenshot stability, RTT readiness, layout, focus restoration, or task timing paths, with no label assertion failure. `npm run ci:local:e2e` passed CSS/lint/typecheck/unit/build, then stopped at `mirror-shift-teaching-geometry.spec.ts:3` waiting 30s for `ground-glass-rtt[data-rtt-final-contentful="true"]`; its second test passed.
- Remote Actions: PR #106 checks were in progress at handoff. The known hosted `npm ci` failure is infrastructure/dependency state; no dependency/workflow changes were made.

## Reviewer focus

- Verify all explicit guide keys and 15 target mappings, plus near/far/generic fallback resolution, remain identical to the former renderer switches.
- Verify representative rendered labels remain learner-facing identical and guide geometry/label placement is unchanged.
- Remaining risk is the documented repository WebGL/RTT E2E baseline; no optical geometry, Scheimpflug, viewport, Ground Glass, or 3D behavior was intended to change.
