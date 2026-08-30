# PR #113 correction — aperture visibility and final-step navigation

- Objective: make Lesson 0's Aperture step legible from its deterministic inspection view and remove the dead Next control from the final Recap step. No PR 9F work, optics changes, new lesson state, or layout redesign.
- Branch: `feature/lesson-0-view-camera-anatomy`; existing PR #113 branch/worktree only. After the final fetch, `origin/main` is `1aa5cef7c1ca8843bb242d57707493fa6ea35109`; GitHub reports PR #113 already merged, so no new PR will be created.
- Aperture rendering: the shared conceptual lens now uses a shallow convex transparent front-glass element, a presentation-readable aperture opening, and eight conceptual iris blade sectors. The existing canonical aperture / Lesson 0 presentation value remains the only input; no optical derivation changed.
- Aperture framing: anatomy target changes participate in the existing view-reset key, so the Aperture step applies its closer deterministic inspection framing instead of preserving the prior whole-camera orbit distance.
- Navigation: `AnatomyLessonPanel` omits Next when the current step is Recap; Previous, Restart lesson, and Back to Scenes remain available.
- Tests: focused conceptual-camera, framing, Lesson 0 panel/integration, anatomy, and workspace suites pass (69 tests); the updated Lesson 0 Playwright walkthrough passes, including final-step omission and normal-scene return.
- Full validation: `npm run ci:local` passes (152 test files / 1,467 tests, CSS check, lint, typecheck, build); `git diff --check` passes. Existing unrelated RTT/WebGL baseline remains documented and is not changed here.
