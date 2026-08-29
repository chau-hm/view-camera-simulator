# Expanded 3D Scene viewport fill

- Work identifier: `fix/expanded-3d-scene-fill-viewport` / PR title `fix(ui): let expanded 3D scene fill viewport`.
- Branch/base: `fix/expanded-3d-scene-fill-viewport` from `origin/main` `c09bc408`.
- Substantive HEAD: `de4f71a` (`fix(ui): let expanded 3d scene fill viewport`).
- Objective: make the expanded 3D Scene render surface use the available simulator main width and height while preserving normal, Ground Glass, Geometry, and controls layouts.

## Root cause and fix

- `SimulatorWorkspace` embeds `SceneViewport` with `showHeader={false}`, leaving the scene panel with only toolbar and viewport-shell children.
- `.scene-panel--expanded` reserved three grid rows (`auto auto 1fr`), so the shell stayed at its intrinsic/aspect-ratio height and the unused third row received the remaining space.
- The expanded scene grid now uses `auto minmax(0, 1fr)`. The existing 100%-height host and Canvas sizing then grow with the panel and follow browser resize.

## Scope and evidence

- Changed: `src/index.css` and `src/tests/e2e/scene-viewport-expansion.spec.ts`.
- Normal mode behavior is unchanged; expanded mode fills the available height, follows window resize, and restores cleanly.
- Focused integration: 17/17 passed. Focused expanded-scene browser test: 1/1 passed, including repeated restore and live resize.
- Full unit/integration: 145 files / 1,392 tests passed. Typecheck, lint, CSS check, build, and `git diff --check` passed.
- Full viewport-expansion browser file: 3/4 passed. The unrelated Ground Glass quality test consistently retains the existing RTT mismatch (`colorWidth` 172 vs `blurWidth` 86); no Ground Glass code was changed.

## Remaining risks and reviewer focus

- Remaining risk is the pre-existing WebGL/RTT quality-test baseline noted above.
- Verify the two-row expanded scene chain, canvas bottom alignment, browser-height resize, collapse/restore, and unchanged normal/Ground Glass/Geometry/control layout behavior.
