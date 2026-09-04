# PR12A — Interior Corner Scene Foundation

- Objective: establish the free-mode Interior Corner — Rise + Swing scene, neutral photographic problem, public integration, multilingual metadata, deterministic reset, and generated catalog artwork.
- Branch/base/head: `feature/interior-corner-scene-foundation`; based on `origin/main` `bd6d113b127eb58f1acb89d6ab77124ea3ef5cb2`; implementation head `5ddf2f4` (`feat: add interior corner scene foundation`). The final handoff commit is this status update and is recorded in the final report.
- Changed surfaces: canonical millimetre scene geometry and neutral state; shared R3F/RTT subject registration and disposal; scene registry, catalog, free route, and localization; existing geometry presentation/readouts; focused contract tests; generated raster card asset.
- Design decisions: the receding wall is one physical target plane with near/mid/far anchors at approximately 5800/8000/10400 mm; neutral state is level with 150 mm focal length, 8000 mm focus, f/5.6, and zero movements; only existing Front Rise and Front Swing controls are enabled; no reference camera or new rendering/optics abstraction was added.
- Validation: prior PR12A checks remain green (`npm test` 157 files/1,523 tests, typecheck, lint, CSS, build, diff check, browser validation); this review fix adds a focused 4-file/24-test run, fresh typecheck, lint, and diff check. Current bundled Node 24 was used because the host Node 16 cannot run the repository's current toolchain.
- Not run: full `npm run ci:local:e2e`; this is a geometry-range/test-only review fix with no public runtime or renderer behavior change.
- Image: built-in image generation produced the scene-card source; the final asset is the 360×240 PNG at `public/assets/interior-corner.png`. No SVG or placeholder fallback was used.
- Since previous review:
  - The reviewer found that the explicit `11,300 mm` maximum excluded the future canonical Swing + Focus state. The existing finite-focus solver independently derives approximately `+3.5953°` Front Swing and `38,144.4267 mm` optical-axis focus for the unchanged wall anchors.
  - The public range is now `{ min: 4000, max: 40000 }` mm, rounded to the existing 10 mm Focus step. Neutral focus remains `8000 mm`; wall geometry, scene identity, controls, catalog, routing, localization, RTT subject, and artwork are unchanged.
  - Added a regression test proving raw and public-grid reachability and proving the previous `11,300 mm` ceiling would fail. PR12C calibration/task work remains deferred.
- Remaining gaps: guided lesson, Rise success evaluation, Swing/Scheimpflug calibration, raw/public-step calibration, Near/Mid/Far sharpness scoring, aperture lesson, and any new optics, blur, shader, or renderer pipeline work.
- Reviewer focus: scene ID/route/catalog/localization/asset consistency; canonical level neutral framing; one-wall focus-anchor registration; shared subject disposal; and absence of unintended guided-task behavior.
- Explicitly deferred: PR12B — Rise Composition Slice; PR12C — Swing + Focus Calibration; PR12D — Guided Lesson + Final Integration.
