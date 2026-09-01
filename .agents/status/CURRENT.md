# PR 9G — Lesson 0 Ground Glass RTT migration

- Branch: `feature/lesson-zero-ground-glass-rtt`
- Baseline: `origin/main` `e65ef4e6bb99be6152d5a5624d3fb1b97540fd8f` (PR #116 merged)
- Objective: route `view-camera-anatomy` through the canonical RTT renderer with a real finite-focus subject and explicit public-scene rendering coverage.
- Scope: add one shared Lesson 0 subject factory, RTT registration/bounds, RTT scene membership, and remove implicit production fallback to the legacy Ground Glass placeholder. Do not change optics, camera anatomy, bellows, aperture, or lesson UI.
- Validation: focused RTT/subject/registry tests (49 passed), `npm run ci:local` (154 files / 1,490 tests, build and lint included), `npm run typecheck`, and Lesson 0 Playwright smoke (1 passed). Browser screenshots confirmed a contentful RTT target in the default and Aperture views; no known baseline failure was encountered.
