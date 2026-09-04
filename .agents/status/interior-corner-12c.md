# Interior Corner 12C — Swing + Focus Calibration

## Objective

Establish the finite-focus Front Swing + Focus solution for the one receding vertical side-wall plane while keeping Rise composition independent and guided lesson work deferred.

## Branch / worktree / base / head

`feature/interior-swing-focus-calibration` · `/Users/homan/repo/view-camera-interior-corner-12c` · base `abe81a2fcc812ec516215dad4bc884df7114de5e` · head `8f2fab8`

## PR12A / PR12B contracts preserved

The 150 mm lens, neutral 8000 mm focus, f/5.6 aperture, zero movements, widened 40000 mm Focus ceiling, wall geometry, canonical anchors, free-only route, RTT subject, and PR12B projected Rise evaluator remain unchanged.

## Canonical receding-wall plane

Near / middle / far centres remain at x=2392 mm, y=1850 mm, z=5800 / 8000 / 10400 mm. The shared vertical-plane calibration reports zero collinearity error; the perpendicular back wall is contextual only.

## Raw physical calibration

Existing Shelf Swing math was extracted into a generic vertical-plane helper without changing its optical convention. Interior Corner raw calibration: Front Swing `+3.5953°`; optical-axis Focus `38144.43 mm`; finite, positive, and inside the scene’s physical/public domain.

## Public calibration

Rounded with shared controls: Front Swing `+3.6°`, Focus `38140 mm`, aperture `f/5.6`; public steps are `0.1°` and `10 mm`; ranges are `-10°…+10°` and `4000…40000 mm`.

## Physical evidence

- Neutral `0° / 8000 mm / f/5.6`: Near `0.220769`, Middle `0.012479`, Far `0.124447` mm CoC; maximum `0.220769` mm, so the wall is not aligned.
- Focus-only public scan: 3601 states from 4000–40000 mm at 10 mm; best sampled maximum CoC was about `0.173071` mm at 7310 mm, so no Focus-only state passes the shared `0.1 mm` threshold.
- Swing-only `+3.6° / 8000 mm`: plane orientation changes but maximum CoC remains about `0.410167` mm; Focus placement is still required.
- Wrong sign `-3.6° / 38140 mm`: Near `1.4208`, Middle `1.0209`, Far `0.7812` mm CoC; materially worse.
- Final public `+3.6° / 38140 mm / f/5.6`: Near `0.000682`, Middle `0.000411`, Far `0.000250` mm CoC; maximum `0.000682` mm, all below the shared `0.1 mm` threshold.
- The first public PR12B-valid Rise state remains `33 mm`; combined with the public Swing + Focus state, both composition and wall-focus evaluators pass.

## Files / surfaces changed

Added the generic vertical-plane calibration helper, Interior Corner calibration/evaluator, free-mode Workspace/Feedback wiring, aligned English and zh-HK copy, focused unit/integration/E2E coverage, and a stale catalog-order assertion update required by the merged Interior Corner catalog entry. No RTT, route, catalog metadata, task registry, or guided-task behavior was added.

## Validation run

Focused calibration/scene/integration tests: 65 tests passed. Full Vitest: 162 files / 1563 tests passed. `npm run typecheck`, `npm run lint`, `npm run check:css`, `npm run build`, and `git diff --check` passed. Focused Playwright Interior Corner Swing + Focus flow passed with fresh server reuse disabled (`CI=1`).

## Validation not run / known limitation

`CI=1 npm run ci:local:e2e` was run twice. The first run exposed and was cleared by updating a stale pre-existing catalog-order assertion. The final run passed all unit/integration/build stages and preceding E2E files, then stopped on the unrelated existing `groundglass-interaction.spec.ts` Architecture Rise timeout after 2 of 3 tests; the focused Interior Corner browser flow passes independently.

## Reviewer focus

Check raw versus public-grid calibration, one-wall-plane targeting, shared CoC threshold use, Focus-only insufficiency, wrong-sign protection, f/5.6 enforcement, and preservation of the independent Rise composition contract.

## Deferred

- PR12D — Guided Lesson + Final Integration
