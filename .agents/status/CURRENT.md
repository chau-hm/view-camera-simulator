# PR #130 / PR12D — Review-fix handoff

## Branch / base

`feature/interior-corner-guided-lesson-12d` · `/private/tmp/view-camera-interior-corner-12d-fresh` · base `main` (latest fetched `origin/main` `766332e95ca42066f2f05e6f2f93d234ba45a79e`)

## Objective

Harden the Interior Corner guided lesson integration so every guided task re-enters with the declarative finite-focus state while preserving the accepted Rise, Swing + Focus, and final Aperture contracts.

## Lesson contract

- Observe → Compose with Rise → Front Swing orientation → Refine Focus → Aperture.
- Compose reaches the first valid public Rise at approximately `+33 mm`.
- Swing is partial orientation only: `Swing +3.6° / Focus 8000 mm` passes Swing while still failing Refine.
- Refine Focus is the first full near/middle/far wall-sharpness gate at `Swing +3.6° / Focus 38140 mm / f/5.6`.
- Aperture preserves the aligned plane and completes at `f/11`; unrelated controls remain locked.
- One receding wall remains the subject-plane contract; Free Practice remains unchanged at `f/5.6` with Rise, Swing, and Focus available.

## Review-fix delta

- Shared Interior Corner guided initial camera state now explicitly includes `focusMode: "finite"`; existing route clamping records the same finite distance in `lastFiniteFocusDepthMm`.
- Route/store regression starts from the real public Infinity action in another scene, enters the guided Aperture route, verifies finite `38140 mm` focus and physical focus preservation, then completes at `f/11`.
- Re-entry after clearing route initialization and Restart Task both restore the finite task state.
- Canonical durable handoff is this file; stale PR11B content was overwritten and duplicate `.agents/status/interior-corner-12d.md` was removed.

## Validation

- Focused affected suite: `15` files, `146` tests passed.
- Full Vitest: `165` files, `1600` tests passed.
- Typecheck, lint, CSS structure check, production build, and `git diff --check` passed.
- Required `CI=1 npm run ci:local:e2e` passed CSS/lint/typecheck/Vitest/build and the earlier Chromium specs, then stopped at the baseline-only `mirror-shift-teaching-geometry.spec.ts` failure (1 failed, 1 passed; missing RTT marker). The exact spec reproduced the same result in a clean detached `origin/main` worktree at `766332e95ca42066f2f05e6f2f93d234ba45a79e`.
- Current-head GitHub CI: pending publication of this corrective head.

## Tests not run

The remaining E2E specs after the baseline-only fail-fast stop were not run by `ci:local:e2e`; no new browser spec was added because the existing Interior Corner public lesson spec ran successfully within the required command.

## Deferred

No new Interior Corner slice, lesson engine, optics/geometry change, renderer change, or task-boundary change is included. Further lesson work remains outside PR12D.
