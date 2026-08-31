# PR #115 follow-up — restore Lesson 0 camera assembly geometry

- Objective: preserve PR 9F's interactive Lesson 0 focus teaching while restoring the pre-PR9F conceptual camera body datum and neutral assembly.
- Branch: `feature/controls-to-camera-anatomy-teaching`; existing PR #115 branch. The PR is now merged into `origin/main` at `02ea5ca7dd7b70c36ce886365cb06322e02f793b`; this correction remains on the existing feature branch as requested.
- Root cause: generalized selectable-focus construction applied Focus Fundamentals' absolute rear-datum `lensZMm`/`filmZMm` directly to Lesson 0, replacing its neutral `lens z=0` / `film z=-f` body baseline.
- Fix: `SceneFocusStandardCapability.placement` declares `rear-datum` or `scene-baseline`; Lesson 0 uses baseline-relative standard travel derived from the shared focus solver, while Focus Fundamentals retains its absolute rear-datum contract.
- Geometry contract: front focus moves only the lens/front standard from baseline; rear focus moves only the film/rear standard from baseline; rail/support remains a fixed rig datum and follows only whole-camera transforms.
- Validation: focused optics, camera-render, scene, and Lesson 0 integration suites pass after the fix. Full `npm run ci:local` and Lesson 0 E2E remain to be rerun; no RTT/WebGL files are in scope.
