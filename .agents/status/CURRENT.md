# PR10E — Oblique Tabletop Guided Lesson

- Branch/base: `feature/oblique-tabletop-guided-lesson` from `origin/main` at `e5bc750ac1019c9942698ea205a6913179338681` (merged PR10D state verified in the base tree).
- Objective: add the bounded public Oblique Tabletop progression `Observe → Focus → Front Tilt → Front Swing → Refine Focus → Aperture`; guided lesson and final modest stop-down only. PR10C optics and PR10D teaching geometry remain unchanged.
- Task sequence: `oblique-tabletop-focus-01`, `oblique-tabletop-tilt-01`, `oblique-tabletop-swing-01`, `oblique-tabletop-refine-01`, and `oblique-tabletop-aperture-01`. Early stages keep f/11 and withhold aperture; the final stage starts from the accepted compound state at f/11 and permits f/22.
- Physical criteria: Focus uses the visible middle target; Tilt requires the signed negative PR10B range and sharp near/middle/far principal targets; Swing requires the accepted compound Tilt plus signed negative Swing and all visible targets; Refine requires a public Focus adjustment and all visible targets; Aperture requires f/22 while preserving the compound movement ranges and sharp targets. Wrong-sign and stopped-down wrong-plane states fail.
- Aperture policy: Free Practice and early guided tasks remain fixed at f/11. The final guided task is the only task-enabled exception to the scene-level fixed-aperture policy; switching back to Free mode restores the lock.
- Copy/locales: complete English and zh-HK task and lesson copy explains that movements orient one plane, Focus places it, and Aperture adds depth around it.
- Validation: focused guided-task/route/store/scene/lesson suites passed (138 tests); focused public Chromium lesson flow passed (1 test, ~1.1 minutes); full `npm test` passed (161 files, 1,553 tests); typecheck, lint, CSS structure, build, and diff check passed.
- Not run: full `npm run ci:local:e2e`; the new public Chromium flow is covered directly and no renderer/lifecycle infrastructure changed.
- Remaining: no additional lesson stages, aperture teaching beyond the f/22 step, guided completion redesign, or PR10F work in this slice.
