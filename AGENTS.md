# View Camera Simulator — Agent Instructions

## Project

View Camera Simulator is a browser-based learning tool for large-format camera movements.

Current product scope:

- 2D optical geometry diagrams
- Three.js / React Three Fiber scenes
- Ground Glass render-to-texture previews
- interactive rise, tilt, swing, focus, and aperture controls
- guided tasks for movement and focus-plane concepts
- illustrative depth-of-field and sharpness feedback

Do not add accounts, persistence, multiplayer, photorealistic rendering, unsupported movements, or unrelated product features unless the task explicitly requires them.

## Project-local skills

Use only the skill relevant to the current task. Do not load all skills by default.

- `$vcs-orchestrate-pr` — decompose multi-domain work, assign bounded work packets, and control integration.
- `$vcs-optics-geometry` — analyze or change optical calculations, canonical scene geometry, calibration, or 2D/3D geometric consistency.
- `$vcs-threejs-rtt` — analyze or change Three.js, React Three Fiber, Ground Glass RTT, shaders, scene subjects, WebGL diagnostics, or resource disposal.
- `$vcs-ui-tasks` — change React UI, responsive layout, accessibility, controls, state, public scene metadata, routes, tasks, or feedback.
- `$vcs-verify-pr` — independently review a branch or PR, validate tests and CI evidence, and issue a merge verdict.

For small, single-concern fixes, use one implementation skill and then `$vcs-verify-pr`.
For multi-domain or high-risk changes, start with `$vcs-orchestrate-pr`.

If a project-local skill is not visible in the Codex skill picker, read its `.agents/skills/<skill-name>/SKILL.md` file directly and follow the same instructions.

## Before changing code

- Read this file, `README.md`, `package.json`, the lockfile, and only the feature documents relevant to the task.
- Inspect the current branch, base branch, working tree, and focused diff before editing.
- Search for existing helpers, constants, registries, tests, and established patterns before adding new abstractions.
- Keep changes limited to the explicit work packet or user request.
- Preserve existing public APIs and user-visible behavior unless the task requires a change.
- Do not silently broaden a bug fix into a refactor.

## Simulation rules

- Treat canonical simulation state as the single source of truth.
- Derive 2D geometry, 3D overlays, Ground Glass output, task evaluation, and readouts from that state.
- Keep optical and geometric calculations independent from UI components and rendering code.
- Use explicit millimetre and degree units at module boundaries.
- Do not duplicate projection, plane, vector, calibration, or unit-conversion logic.
- Do not silently change movement sign conventions.
- Preserve raw physical calibration separately from rounded UI-operable values.
- Do not claim metrological precision for heuristic blur, sharpness, or depth-of-field output.

## Rendering rules

- Keep scene subject registration and lifecycle ownership explicit.
- Dispose only resources owned by the component or registered scene subject.
- Do not use full page reloads to prove SPA lifecycle or resource cleanup.
- Do not hide renderer defects with decorative legacy DOM fallbacks.
- Keep WebGL-independent tests separate from WebGL-dependent tests.
- Any test that claims resource cleanup must observe client-side navigation and meaningful lifecycle evidence.

## UI and task rules

- Keep public scene metadata, routes, task registry entries, enabled controls, and guided-task identity consistent.
- A free route must not accept a task ID.
- A guided route must resolve to the configured guided task for the same public scene.
- Controls must expose and honor shared step constants.
- Keyboard tests must use values reachable through the public control step.
- Dialogs and menus must support keyboard access, focus restoration, and viewport constraints.
- Preserve independent scrolling of simulator main content and controls.

## Validation policy

Run the smallest relevant checks first:

1. focused unit tests
2. focused integration tests
3. one relevant E2E spec
4. affected-scene regressions
5. full unit/integration suite
6. full E2E only at the integration or merge gate

Required repository checks before declaring a change complete:

```bash
npm test
npm run typecheck
npm run lint
npm run check:css
npm run build
git diff --check
git status --short
```

Run `npm run ci:local:e2e` only when required by the work packet, renderer-wide risk, or merge gate. Report checks that could not be run and why.

## Token and handoff policy

- Pass subagents only the current objective, relevant files, known evidence, constraints, and acceptance criteria.
- Do not paste project history, complete PR prompts, or full diffs into every handoff.
- Keep work packets bounded by file ownership and one concern.
- Keep ordinary handoffs under 500 words; optics or renderer handoffs under 1,000 words.
- Reference commit SHAs, paths, test names, and raw logs instead of retelling the investigation.
- An implementation agent must not issue the final merge verdict for its own work.
