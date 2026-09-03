# PR 10B — Oblique Tabletop Tilt Limitation

- Branch: `feature/oblique-tabletop-tilt`; base: `origin/main` `c3dc8a8d08fd13fcb0f02c36ebfa722fcc464644` (PR 10A squash merge).
- Objective/scope: expose Front Tilt + Focus on the existing Oblique Tabletop scene; keep f/11 fixed and Front Swing, all rise/shift, and rear movements unavailable. No guided lesson or compound solution.
- Canonical geometry: `tabletopTopSurfacePlane` and `tabletopLocalToWorld` remain the source of truth. Live focus coverage uses seven derived surface samples: near/middle/far rows with left/centre/right positions. The shared `ObliqueTabletopSubjectFactory` registers matching non-rendering RTT/3D sample nodes.
- Tilt sign: with the repository's existing `calculateLensNormal` / Front Tilt convention, negative Front Tilt reduces the canonical near-to-far focus error; positive Tilt moves in the opposite direction. No optics sign or core model was changed.
- Public evidence state: Front Tilt `-9.7°`, Focus `1770 mm`, f/11. The value is reachable on the shared `0.1°` Tilt and `10 mm` Focus steps within the scene's `160–6400 mm` range.
- Physical evidence: at neutral, canonical coverage is inconsistent. At the public Tilt + Focus state, near-centre/middle/far-centre CoC spread is asserted below 70% of neutral and its maximum below 80%; off-axis corner samples remain materially worse (average and maximum above the principal-axis values by more than 10%, with CoC above the 0.1 mm acceptable threshold).
- Files: scene capability/controls, canonical tabletop samples and focus targets, shared subject registration, English/zh-HK free-practice copy, focused optics/scene/RTT/public-control tests, and this status handoff.
- Validation: focused scene/optics/control suite (8 files, 82 tests); `npm test` (155 files, 1,507 tests); `npm run typecheck`; `npm run lint`; `npm run check:css`; `npm run build`; `git diff --check`; focused Chromium `scene-switching.spec.ts` smoke (1 passed).
- Not run: full `npm run ci:local:e2e`; shared renderer lifecycle and projection contracts were unchanged, and the focused public scene-switching smoke passed.
- PR 10C: add Front Swing, calibrate the compound Tilt + Swing solution, and add the guided lesson. Those behaviors are intentionally not included here.
