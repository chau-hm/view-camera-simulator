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

## Execution scope: smallest safe harness first

Always use the smallest execution path that can safely prove the requested change.

Do not invoke a project-local specialist merely because a changed file falls inside that specialist's nominal ownership area. Use a specialist only when the task depends on that domain's reasoning, invariants, or shared contracts.

Start as a **micro edit** when all of the following are true:

- the requested behaviour is explicit;
- the root cause is known or locally obvious;
- the work affects one concern;
- the change is normally limited to one to three files;
- no shared architecture or abstraction changes;
- no optics derivation, sign convention, or canonical-state contract changes;
- no RTT, GPU ownership, renderer-lifecycle, or projection contract changes;
- no public route/task schema or cross-component behavioural contract changes.

For a micro edit:

- inspect only the directly relevant files and nearby tests;
- make the minimum necessary change;
- run the nearest relevant test or static check;
- run `git diff --check` and inspect `git status --short`;
- do not invoke `$vcs-orchestrate-pr`;
- do not require a separate `$vcs-verify-pr` pass unless the user explicitly requests review or the change is being evaluated at a merge gate;
- do not proactively refactor, generalize, add diagnostics, or strengthen unrelated tests.

Escalate only when concrete evidence shows that the local change crosses an existing domain contract, has an uncertain root cause, or cannot be safely proven with local evidence.

## Project-local skills

Load only the skill relevant to the current task.

- `$vcs-orchestrate-pr` — coordinate multi-domain, ambiguous, or high-risk work.
- `$vcs-optics-geometry` — optical calculations, canonical scene geometry, calibration, Scheimpflug geometry, or movement-sign reasoning.
- `$vcs-threejs-rtt` — Three.js/R3F, Ground Glass RTT, shaders, renderer diagnostics, WebGL resources, or lifecycle.
- `$vcs-ui-tasks` — React UI, responsive layout, accessibility, controls, state, routes, catalog, or guided tasks.
- `$vcs-verify-pr` — independent merge-gate review and evidence validation.

Typical routing:

```text
Micro edit
local inspection → minimal edit → nearest focused validation

Focused fix
one relevant implementation skill → focused validation

Standard PR
$vcs-orchestrate-pr → bounded implementation packets → integration

High-risk / merge-critical
$vcs-orchestrate-pr → specialists as required → integration → $vcs-verify-pr
```

If a project-local skill is not visible in the Codex skill picker, read its `.agents/skills/<skill-name>/SKILL.md` file directly.

## Before changing code

Scale discovery to the task.

For micro edits, inspect only the current branch/worktree state, the exact target, nearby dependencies, and the nearest relevant tests.

For broader work, additionally inspect the base branch, focused diff, relevant architecture, package scripts, and feature documents.

Always:

- search for existing helpers, constants, registries, tests, and established patterns before adding new abstractions;
- preserve existing public APIs and user-visible behaviour unless the task requires a change;
- keep changes limited to the explicit request or work packet;
- do not silently broaden a bug fix into a refactor.

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

- Keep scene-subject registration and lifecycle ownership explicit.
- Dispose only resources owned by the component or registered scene subject.
- Do not use full-page reloads to prove SPA lifecycle or resource cleanup.
- Do not hide renderer defects with decorative DOM fallbacks.
- Keep WebGL-independent tests separate from WebGL-dependent tests.
- Tests claiming resource cleanup must use client-side navigation and meaningful lifecycle evidence.

## UI and task rules

- Keep public scene metadata, routes, task registry entries, enabled controls, and guided-task identity consistent.
- A free route must not accept a task ID.
- A guided route must resolve to the configured guided task for the same public scene.
- Controls must expose and honor shared step constants.
- Keyboard tests must use values reachable through the public control step.
- Dialogs and menus must support keyboard access, focus restoration, and viewport constraints.
- Preserve independent scrolling of simulator main content and controls.

## Validation policy

Validation depth follows execution risk.

### Micro edit

Use the nearest evidence that directly proves the requested change.

Typical checks:

```bash
# nearest focused test or relevant static check
git diff --check
git status --short
```

Do not run the full repository suite merely because a file was edited.

### Focused fix

Run:

1. focused unit/integration tests;
2. relevant typecheck, lint, CSS, or build check when the changed surface can affect it;
3. `git diff --check`;
4. `git status --short`.

### Standard PR integration

Run affected suites first, then the repository integration checks:

```bash
npm test
npm run typecheck
npm run lint
npm run check:css
npm run build
git diff --check
git status --short
```

### High-risk or merge gate

Run the standard integration checks plus the relevant E2E coverage.

Run `npm run ci:local:e2e` when:

- the work packet explicitly requires it;
- renderer-wide risk exists;
- scene lifecycle or WebGL resource ownership changed;
- a public workflow needs E2E proof;
- the branch is at the merge gate.

Report checks not run and why.

## PR branch publishing safety

This contract applies when work is being published as a PR branch. It does
not add remote-publishing ceremony to non-published local work or Micro edits.

### Create a PR branch without inheriting the base upstream

Start from the fetched base and create the PR-oriented branch with no
upstream:

    git fetch origin
    git switch --no-track -c <feature-branch> origin/main

The invariant before first publication is:

    local feature branch
    no upstream pointing to origin/main

Do not use a branch-creation form that may configure the feature branch to
track origin/main. An existing upstream is diagnostic context only, never the
PR publication destination. Inspect it when present with:

    git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'

If that reports origin/main, warn and continue only with the explicit
feature-branch refspec below. Do not publish through the upstream.

### Resolve and validate the publication destination

Before any PR-branch push, resolve the current local branch, intended remote,
intended PR head, and intended base explicitly. Fail closed unless all of the
following are true:

- current branch is non-empty;
- current branch exactly matches the intended PR head branch;
- current branch is not main or master;
- origin exists and resolves to a remote URL;
- the destination is refs/heads/<current-feature-branch>;
- the destination is not refs/heads/main, refs/heads/master, or another
  explicitly protected/base branch;
- the intended PR head and base are different refs.

The branch, remote, destination, push.default, remote.pushDefault, and
branch-specific remote/merge values must not be inferred from one another.
The following values may be inspected for diagnostics, but must not determine
the PR destination:

    git config --get push.default
    git config --get remote.pushDefault
    git config --get branch.<branch>.remote
    git config --get branch.<branch>.merge

Do not modify global or system Git configuration to solve a publication
failure. Repository policy must remain safe under unusual local settings.

### Publish with an explicit feature-branch refspec

Record remote evidence before the push:

    local_head="$(git rev-parse --verify HEAD)"
    main_before="$(git ls-remote --exit-code origin refs/heads/main | awk 'NR == 1 { print $1 }')"

Require both values to be non-empty, then publish only with the validated
same-named feature branch:

    git push -u origin "HEAD:refs/heads/<current-feature-branch>"

For initial PR publication, never rely on a bare git push, push.default,
remote.pushDefault, or an inherited upstream. Never use a refspec ending in
refs/heads/main and never use --force or --force-with-lease. A normal explicit
push may update an existing feature branch only when the remote accepts it as
a non-destructive fast-forward. If it would require history rewriting, stop.

### Verify the remote before creating the PR

After the push, independently read the remote refs again. Before invoking
gh pr create or an equivalent PR mechanism, require:

    remote_feature_head="$(git ls-remote --exit-code origin "refs/heads/<current-feature-branch>" | awk 'NR == 1 { print $1 }')"
    main_after="$(git ls-remote --exit-code origin refs/heads/main | awk 'NR == 1 { print $1 }')"

- remote_feature_head exists and equals local_head;
- main_after exists and equals main_before;
- the explicit PR head is the validated feature branch;
- the explicit PR base is the expected base branch;
- feature and base refs are not the same.

Only after those postconditions pass may PR creation be attempted, using
explicit head and base values. If the feature ref is missing or differs from
local HEAD, stop. If remote main changed, report the before/after SHAs, stop,
and do not reset, revert, force-push, or otherwise overwrite concurrent remote
work. Do not fall back to publishing the implementation to main.

## Test-integrity rules

A passing test is evidence only when it could detect the original defect.

Do not:

- use a full reload to prove SPA cleanup;
- inject unreachable control values to prove user completion;
- use prop-mirroring attributes to prove internal lifecycle state;
- rely on screenshot byte size as the only rendering proof;
- broadly suppress unknown WebGL warnings;
- lower a task threshold instead of fixing optics or public-control reachability.

## Handoff and review

For work that uses subagents, pass only the current objective, relevant files, evidence, constraints, acceptance criteria, and validation needs.

Keep handoffs compact and reference paths, tests, logs, and commit SHAs instead of pasting full diffs or project history.

For Standard PR and High-risk PR work, and for review-fix rounds that address previously reported findings, update `.agents/status/CURRENT.md` before the final implementation handoff. Overwrite stale work-specific content rather than appending history or creating one file per PR. The file should remain compact and reviewer-oriented.

For a Focused fix, updating `.agents/status/CURRENT.md` is optional when it would materially help a later reviewer. Micro edits do not require it and must remain able to use the lightweight flow above.

`.agents/status/CURRENT.md` is durable reviewer navigation and a record of implementation-agent claims about objective, scope, decisions, validation, and known gaps. It is not authoritative product documentation, independent verification evidence, a replacement for the actual branch/diff/tests or PR metadata, or a historical changelog. If it conflicts with the branch or diff, the branch and diff win and the discrepancy should be reported.

Independent review is a **merge-gate mechanism**, not a mandatory step after every local edit.

An implementation agent must not be the sole final reviewer when a merge verdict is required.
