# Ground Glass presentation policy — Standard refactor

- Work identifier: `refactor/ground-glass-presentation-policy`.
- Branch/base: `refactor/ground-glass-presentation-policy` from `origin/main` at `b97f024134b5b697b8773370991fef068e7a0fc8` (PR #100).
- Substantive HEAD: `3ed5ee913357eaa8432a5350e05454e04199d795` (`refactor(render): simplify Ground Glass presentation policy`).
- Objective: remove obsolete legacy Ground Glass scene branches while keeping the live presentation distinction explicit and renderer-local.

## Dead-code evidence and policy

- `RTT_SCENES` contains every current public scene, and `GroundGlassRenderer` renders `LegacyGroundGlassScene` and `GroundGlassFocusRing` only on the non-RTT path; no production caller bypasses that boundary.
- Removed the unreachable Focus Fundamentals legacy thin-lens pipeline branch, dead Focus Fundamentals/Table Tilt focus-ring checks, and dead Table Tilt/Architecture Rise legacy-scene branches. The generic legacy fallback artwork remains available.
- Added `groundGlassPresentationPolicy.ts` with only `showDecorativeVignette`: default `true`, Focus Fundamentals `false`. Overlays consume that semantic prop; they do not know scene identity.
- Removed `sceneId` from the legacy scene and focus ring APIs and `isFocusFundamentals` from the overlay API. `RTT_SCENES`, `groundGlassSceneProfiles.ts`, `GroundGlassRTT`, shaders, optics, and GPU ownership are unchanged.

## Evidence

- Changed files: `GroundGlassRenderer.tsx`, `GroundGlassOverlays.tsx`, `GroundGlassFocusRing.tsx`, `LegacyGroundGlassScene.tsx`, `groundGlassPresentationPolicy.ts`, and focused presentation/renderer tests.
- Focused unit: policy/overlay/focus-ring/legacy tests pass (22 tests); full unit/integration suite passes (143 files / 1,358 tests).
- Typecheck, lint, CSS structure check, build, and `git diff --check`: pass.
- Focused E2E: 28/29 pass. The only failure is the existing `understanding-camera-movements.spec.ts:308` SPA diagnostic assertion expecting `data-rtt-focal-length-mm="150"` after navigation to Architecture Rise; the RTT attribute is absent. No unrelated layout/diagnostic test was changed.
- `npm run ci:local:e2e`: CSS, lint, typecheck, unit/integration, and build passed; E2E stopped at the known `mirror-shift-teaching-geometry.spec.ts:32` Geometry-only case because the expected RTT element was absent while waiting for `data-rtt-final-contentful="true"`.
- Remote Actions: not run for this new branch/PR yet. The known hosted `npm ci` failure for `eslint-plugin-react-hooks@^6.8.0` remains baseline infrastructure state; no dependency or workflow changes were made.

## Reviewer focus

- Confirm all removed scene branches are unreachable under the current RTT eligibility boundary and that only the declarative Focus Fundamentals presentation policy retains scene identity.
- Verify RTT routing, resource/lifecycle behavior, Focus Fundamentals vignette suppression, generic legacy fallback, and focus-ring positioning remain unchanged; remaining risks are the two documented baseline E2E issues and hosted dependency installation.
