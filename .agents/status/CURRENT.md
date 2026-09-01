# PR #116 follow-up — preserve Lesson 0 optical conjugacy

- Objective: keep PR #116's selectable-focus placement separation while restoring finite-focus optical conjugacy for Lesson 0.
- Branch: `fix/lesson-zero-camera-assembly-regression`; existing PR #116 branch.
- Root cause: `scene-baseline` previously added Focus Fundamentals travel deltas to the historical `film z=-f` baseline, so finite focus used a non-conjugate lens/film separation.
- Fix: `resolveSceneRelativeSelectableFocus` translates the complete rear-datum lens/film solution by one reference-derived Z offset; the selectable focus point receives the same translation.
- Geometry contract: Lesson 0 reference lens stays at its scene datum, film and focus plane use the solved reference image distance, front/rear focus preserve conjugacy, and rail/support remains a fixed rig datum.
- Validation: fresh-branch CI, typecheck, lint, focused optics/assembly/Lesson 0 suites, and the Lesson 0 Playwright walkthrough pass. No RTT/WebGL files are in scope.
