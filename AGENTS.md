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

## Instruction authority and implementation evidence

Separate **what should change** from **what currently exists**.

Instruction authority, highest first:

1. the explicit current task and current acceptance criteria;
2. repository `AGENTS.md` project invariants;
3. the invoked `.agents/skills/**/SKILL.md` domain instructions;
4. current work-packet constraints when a packet exists;
5. `docs/AI_AGENT_WORKFLOW.md` as human-readable guidance.

Implementation evidence, strongest first:

1. the actual current branch, diff, runtime behaviour, and repository state;
2. relevant current tests and CI evidence;
3. the PR implementation handoff;
4. local `.agents/status/CURRENT.md` working notes;
5. historical documents, prompts, and conversation summaries.

Existing code and tests describe current behaviour. They do not override an explicit request to change that behaviour.

If instructions conflict, follow the higher-authority current instruction and report the conflict when it materially affects the implementation.

## Execution model

Task **complexity** and task **delivery mode** are separate decisions.

### Complexity levels

#### Level 0 — Micro

Use when all apply:

- one explicit observable change;
- root cause known or locally obvious;
- normally one to three files;
- no new abstraction;
- no shared contract change;
- no optics derivation or sign-convention change;
- no renderer lifecycle or RTT ownership change;
- no public route/task schema change.

Typical flow:

```text
local inspection
→ minimal edit
→ nearest focused validation
```

#### Level 1 — Focused

Use when:

- one domain contract matters;
- root cause is understood;
- a handful of files may change;
- focused evidence can prove the result;
- multi-domain coordination is unnecessary.

Typical flow:

```text
one relevant implementation path or specialist
→ focused validation
```

#### Level 2 — Coordinated

Use when:

- related concerns cross component or subsystem boundaries;
- integration order or ownership matters;
- a bounded worker would materially improve context isolation, independent reasoning, or parallel execution;
- the primary agent cannot safely complete the change as one coherent focused implementation.

The primary agent may still implement Level 2 work directly when delegation would add more transfer/integration overhead than value.

#### Level 3 — High-risk simulation

Use when any apply:

- tilt, swing, Scheimpflug, focus-plane, DOF, or projection mathematics change materially;
- canonical geometry or movement sign conventions change;
- RTT architecture, shaders, render-target ownership, clipping, or GPU lifecycle changes;
- a defect crosses 2D, 3D, Ground Glass, and task evaluation;
- existing tests may pass while hiding the defect;
- previous local fixes failed or evidence conflicts.

### Delivery modes

A task may be either:

- **Local-only** — explicitly requested local work with no PR delivery; or
- **PR delivery** — the normal implementation workflow unless the user explicitly requests local-only work.

PR delivery does **not** increase the task complexity level. A Micro change may still be delivered through a PR using Micro validation.

## Initiative and completion

When the requested implementation is clear and existing repository conventions resolve routine details, complete the authorized workflow without intermediate approval.

For normal PR-delivery implementation, completion means:

```text
inspect
→ implement
→ validate proportionally
→ commit
→ publish the intended feature branch safely
→ verify the remote feature ref
→ create or update the PR against the explicit intended base
→ provide a review-ready handoff
```

Do not stop merely after planning, editing, testing, or committing when the requested work is otherwise ready for PR review.

Ask only when:

- an unresolved decision would materially change requested product behaviour;
- no safe repository convention resolves the ambiguity;
- a destructive or history-rewriting operation would be required;
- the intended remote repository, PR base, merge target, or production destination cannot be resolved safely.

The following remain separate control boundaries:

- merging a PR;
- production promotion;
- force push, reset of shared history, destructive branch repair, or history rewriting;
- publication to an unintended remote or protected branch.

## Project-local skills

Load only the skill relevant to the reasoning problem.

- `$vcs-orchestrate-pr` — coordinate genuinely multi-domain, ambiguous, integration-sensitive, or high-risk work.
- `$vcs-optics-geometry` — optical calculations, canonical scene geometry, calibration, Scheimpflug geometry, or movement-sign reasoning.
- `$vcs-threejs-rtt` — Three.js/R3F, Ground Glass RTT, shaders, renderer diagnostics, WebGL resources, or lifecycle.
- `$vcs-ui-tasks` — React UI, responsive layout, accessibility, controls, state, routes, catalog, or guided tasks.
- `$vcs-verify-pr` — optional internal independent review when explicitly requested or useful before an unusually high-risk gate.

A file path is not an activation trigger.

```text
touches a domain
≠
depends on that domain's reasoning or invariants
```

If a project-local skill is not visible in the Codex skill picker, read its `.agents/skills/<skill-name>/SKILL.md` file directly.

## Subagent policy

Worker agents are **bounded-context execution roles**, not lower-capability tiers.

Use a subagent when delegation materially improves at least one of:

- **context isolation** — the worker can solve the problem from substantially less context than the primary agent;
- **independent reasoning** — a fresh context reduces anchoring or provides a useful independent implementation/test analysis;
- **parallelism** — independent work can proceed concurrently without unresolved shared contracts or overlapping writes.

Do not delegate merely because:

- a specialist exists;
- a file falls inside a specialist's nominal ownership;
- the task is large;
- a worker model is cheaper.

Keep work in the primary agent when delegation would require transferring most of the same context or create more integration overhead than it removes.

Parallelize only when:

- shared contracts are already established;
- write ownership is non-overlapping or explicitly sequenced;
- dependencies are resolved;
- integration order is clear.

Do not parallelize optics and renderer implementation while their shared coordinate/state contract is unresolved.

Subagents do not independently publish branches, create PRs, merge PRs, or promote production unless a work packet explicitly delegates a safe publication action. Normal publication happens at the integrated primary-agent boundary.

## Before changing code

Scale discovery to the task.

For Micro work, inspect only:

- current branch/worktree state;
- the exact target;
- nearby dependencies;
- nearest relevant tests.

For broader work, additionally inspect as needed:

- intended PR base;
- focused diff;
- relevant architecture;
- package scripts;
- feature documents;
- current PR/CI/review state.

Always:

- search for existing helpers, constants, registries, tests, and established patterns before adding abstractions;
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

## Releasable-main contract

`origin/main` must remain safe to promote to production after every merge.

A partially implemented feature may merge incrementally to `main` only when the merged slice is independently production-safe. Typical acceptable states include:

- implementation exists but is not publicly registered or reachable;
- a new scene remains absent from the public catalog until final activation;
- dormant code is fully compatible with current public behaviour;
- tests/infrastructure land without changing incomplete public behaviour.

Do not merge an intermediate slice to `main` when that slice would leave production broken, internally inconsistent, or publicly expose an incomplete feature.

### Integration-branch exception

When a multi-PR change cannot remain production-safe at every intermediate merge, use a temporary integration branch.

Typical flow:

```text
origin/main
    │
    └── integration/<feature>
          ├── child PR A
          ├── child PR B
          └── child PR C
                │
                └── final integration PR → main
```

Rules:

- child PRs explicitly target the integration branch;
- each child PR is reviewed against its actual base;
- the integration branch may contain non-releasable intermediate states;
- `main` must not receive those states;
- the final integration PR to `main` must restore the normal releasable-main contract;
- delete or retire the integration branch after successful integration.

Prefer normal releasable vertical slices to `main`. Use an integration branch only when the intermediate states genuinely cannot be production-safe.

Do not solve selective release by cherry-picking arbitrary completed feature commits into `production`.

## Worktree-local status and durable PR handoff

`.agents/status/CURRENT.md` is **worktree-local state**.

It must:

- be ignored by Git;
- never be committed;
- never be used as shared cross-worktree state;
- never be treated as authoritative evidence.

For Level 2, Level 3, and review-fix work, maintain a compact local `CURRENT.md` when it materially helps continuity. Micro and Focused work may skip it.

Use `.agents/status/README.md` for the local template and lifecycle.

Before PR creation or update, transfer the relevant current-work summary into the PR body under an implementation-handoff section.

The PR body is the durable reviewer navigation surface. It remains an implementation-agent claim, not verification evidence.

A reviewer should orient from the PR body, then independently inspect:

- actual PR metadata and base/head;
- changed files/diff;
- current-head CI;
- relevant runtime/test evidence;
- unresolved review threads.

For review-fix rounds, update the PR handoff with a compact `Since previous review` mapping.

## Validation policy

Validation depth follows change risk, not delivery mode.

### Level 0 — Micro

Use the nearest evidence that directly proves the requested change.

Typical checks:

```bash
# nearest focused test or relevant static check
git diff --check
git status --short
```

Do not run the full repository suite merely because a file was edited or because the change will be delivered through a PR.

Do not add a new regression test for a reversible, low-impact change when the test would merely mirror the implementation.

Once required focused evidence passes, do not broaden or repeat validation unless a new change, failure, or unresolved concern justifies it.

### Level 1 — Focused

Run:

1. focused unit/integration tests;
2. relevant typecheck, lint, CSS, or build check when the changed surface can affect it;
3. `git diff --check`;
4. `git status --short`.

### Level 2 — Coordinated integration

Run affected suites first, then the repository integration checks when the integrated change crosses shared contracts:

```bash
npm test
npm run typecheck
npm run lint
npm run check:css
npm run build
git diff --check
git status --short
```

Do not mechanically require every repository-wide command when the coordinated change is still safely proven by a narrower set. Report what was not run and why.

### Level 3 / merge-critical high-risk work

Run Level 2 integration checks plus relevant E2E coverage.

Run `npm run ci:local:e2e` when:

- renderer-wide risk exists;
- scene lifecycle or GPU ownership changed;
- a public workflow requires E2E proof;
- the work packet explicitly requires it;
- the branch reaches a merge gate where E2E is relevant.

## Test-integrity rules

A passing test is evidence only when it could detect the original defect.

Do not:

- use a full reload to prove SPA cleanup;
- inject unreachable control values to prove user completion;
- use prop-mirroring attributes to prove internal lifecycle state;
- rely on screenshot byte size as the only rendering proof;
- broadly suppress unknown WebGL warnings;
- lower a task threshold instead of fixing optics or public-control reachability.

For each important claim ask:

```text
What behaviour is claimed?
What observable evidence proves it?
Would the old defect fail this evidence?
Does the test use the real public workflow when that is part of the claim?
```

## Safe PR branch publication

PR publication is the normal completion step for PR-delivery work.

Always resolve explicitly:

- repository remote;
- current intended feature branch;
- intended PR base branch;
- local HEAD.

Do not infer a publication destination from upstream, `push.default`, `remote.pushDefault`, or prior shell state.

### Creating a PR branch

For a new PR targeting `main`:

```bash
git fetch origin
git switch --no-track -c <feature-branch> origin/main
```

For a child PR targeting an integration branch:

```bash
git fetch origin
git switch --no-track -c <feature-branch> origin/<integration-branch>
```

Before publication, fail closed unless:

- the current branch is the intended non-protected PR head;
- `origin` exists;
- the destination is exactly `refs/heads/<feature-branch>`;
- the intended PR base is explicit.

Publish only with an explicit feature refspec:

```bash
local_head="$(git rev-parse --verify HEAD)"
git push -u origin "HEAD:refs/heads/<feature-branch>"
```

After publication:

- require the remote feature ref to exist;
- require it to equal `local_head`;
- create or update the PR with explicit head and base;
- if the intended base advanced concurrently, fetch it and ensure the PR still targets the correct base rather than treating unrelated base movement as evidence that the feature push was unsafe.

Never use:

- a bare `git push`;
- a direct-to-`main`, direct-to-`production`, or direct-to-integration-base refspec for feature publication;
- `--force`;
- `--force-with-lease`.

Existing remote feature branches may be updated only by a normal non-destructive fast-forward. Divergence is a fail-closed stop unless the user explicitly authorizes a repair strategy.

## Production promotion

Production promotion is a separate release operation.

The normal release invariant is:

```text
origin/main       = production-releasable source
origin/production = release destination
```

Use the canonical repository command when available:

```bash
npm run promote:preflight
npm run promote:production
```

The promotion implementation must operate from authoritative remote refs, use an isolated worktree, publish only to `refs/heads/production`, avoid force pushes, detect concurrent remote movement, and verify the result.

Do not replace the canonical promotion with:

- local `main` → local `production` merging;
- ad-hoc cherry-picking of selected feature commits;
- a bare push;
- force publication.

If `main` is not safe to release, that is a workflow violation to fix at the feature-integration boundary, not a reason to make production promotion selective.

## Handoff and review

For subagent handoffs, pass only:

- current objective;
- relevant files;
- evidence;
- constraints;
- acceptance criteria;
- validation needs.

Keep handoffs compact and reference paths, tests, logs, and commit SHAs instead of pasting full diffs or project history.

The normal project review flow is:

```text
implementation
→ safe feature publication
→ PR with durable implementation handoff
→ independent external review
→ correction or merge decision
```

Do not automatically invoke `$vcs-verify-pr` before every PR publication.

Use `$vcs-verify-pr` only when:

- explicitly requested;
- an internal independent pre-review is materially useful for unusually high-risk work;
- the normal external review path is unavailable.

An implementation agent must not be the sole final reviewer when a merge verdict is required.
