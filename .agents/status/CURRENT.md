# PR #117 follow-up — Lesson 0 interaction polish

- Branch: `feature/lesson-zero-ground-glass-rtt`
- Baseline: `origin/main` `e65ef4e6bb99be6152d5a5624d3fb1b97540fd8f` (PR #116 merged); prior PR head `e3c389b73a75e20be6194b1f29a38688bbbb3cdc`.
- Objective: keep Lesson 0 movement/focus teaching steps anchored to the stable whole-camera inspection datum, and make the `Next` presentation match its `canAdvance` state.
- Decisions: anatomy inspection targets remain part-specific; control/focus steps pass through the existing stable camera anchor; Aperture keeps its close lens target. Semantic highlighting, thresholds, canonical optics, RTT, camera geometry, and lesson progression are unchanged.
- Validation: focused tests (34 passed), `npm run ci:local` (154 files / 1,494 tests and build), standalone typecheck/lint, diff check, Lesson 0 Playwright walkthrough (1 passed), and representative Table Tilt/Understanding Camera Movements smoke tests (2 passed). Manual screenshots confirmed stable Front Rise/Shift framing, muted disabled `Next`, enabled completion state, and no `Next` on Recap.
