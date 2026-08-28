# Ground Glass scene profiles — Standard PR

- Work identifier: PR #100 review/implementation, `refactor/ground-glass-scene-profiles`.
- Branch/base: `refactor/ground-glass-scene-profiles` from `origin/main` at `b0698432bad1c096b32e2ac083e8ecb209dd990a` (PR #99).
- Substantive HEAD: `d86eb10` (`refactor(render): centralize Ground Glass scene profiles`).
- Objective: keep GroundGlassRTT generic by resolving scene subject lifecycle, dynamic updates, and effective bounds through a small profile layer.

## Profile boundary

- `groundGlassSceneProfiles.ts` composes `sceneSubjectRegistry`, the Camera Movement RTT lifecycle helper, and the Mirror Shift reflection updater; it has no Zustand access.
- Ordinary scenes use the registered subject factory/disposer and `SceneDefinition.bounds`.
- Understanding Camera Movements owns specialized mount/presentation updates, runtime lattice metadata, and `cameraMovementRenderModel.subjectBounds` through its profile.
- Mirror Shift owns in-place reflected-camera proxy updates through its profile. `GroundGlassRTT` now has one generic mounted-subject handle and no covered public scene-ID lifecycle/bounds branches.

## Evidence

- Changed files: `src/render/GroundGlassRTT.tsx`, `src/render/groundGlassSceneProfiles.ts`, `src/tests/unit/groundGlassSceneProfiles.test.ts`.
- Focused unit/lifecycle: pass, 7 files / 93 tests. Full unit/integration: pass, 142 files / 1,354 tests.
- Typecheck, lint, CSS structure check, build, and `git diff --check`: pass.
- Focused E2E: 14/15 pass. The only failure is the existing `understanding-camera-movements.spec.ts:182` SPA-route diagnostic assertion at line 308, missing `data-rtt-focal-length-mm="150"` after the route transition.
- `npm run ci:local:e2e`: CSS, lint, typecheck, all unit/integration, build, and preceding E2E suites passed; stopped at unrelated `mirror-shift-teaching-geometry.spec.ts:32` after 30s waiting for the RTT element on the Geometry-only path.
- Remote Actions: PR #100 `ci` run `33194385685` failed during `npm ci` with `No matching version found for eslint-plugin-react-hooks@^6.8.0`; a second `ci` run is pending and deploy is skipped. No dependency or workflow changes made.

## Reviewer focus

- Confirm generic RTT orchestration delegates mount, update, disposal, lighting, and bounds to the profile while GPU/post-processing resources remain RTT-owned.
- Verify Camera Movement presentation updates and Mirror Shift lateral/front-shift updates preserve subject identity and runtime/resource-generation behavior.
- Confirm no shader, optics, projection, CoC, scene geometry, or Zustand boundary changes; remaining risks are the two unrelated/pre-existing E2E diagnostics above.
