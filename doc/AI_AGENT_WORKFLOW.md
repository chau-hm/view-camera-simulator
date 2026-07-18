# View Camera Simulator — AI Agent Workflow

## 1. Purpose

This document defines how ChatGPT and Codex should plan, delegate, implement, test, and review work for the View Camera Simulator project.

The workflow has three goals:

1. reduce repeated context and token usage;
2. route each task to the smallest suitable project-local specialist;
3. preserve independent verification before merge.

This document is a planning and coordination reference. The executable Codex instructions remain in:

```text
AGENTS.md
.agents/skills/**
```

If this document conflicts with the repository versions of `AGENTS.md` or `.agents/skills/**`, the repository version takes precedence.

---

## 2. Project scope

View Camera Simulator is a browser-based learning tool for large-format camera movements. Its current scope includes:

- 2D optical geometry diagrams;
- Three.js and React Three Fiber scenes;
- Ground Glass render-to-texture previews;
- rise, tilt, swing, focus, and aperture controls;
- guided tasks for focus-plane and camera-movement concepts;
- illustrative depth-of-field and sharpness feedback.

The agent workflow must not introduce unrelated product scope such as accounts, persistence, multiplayer, unsupported camera movements, or photorealistic asset pipelines unless a task explicitly requires them.

---

## 3. Sources of truth

Use the following priority order:

1. current repository code and tests;
2. repository `AGENTS.md`;
3. repository `.agents/skills/**`;
4. current PR or work-packet acceptance criteria;
5. this workflow document;
6. previous conversation summaries and historical prompts.

Historical discussion is useful for context but must not override the current branch, source code, or explicit task requirements.

### ChatGPT Project knowledge

Store this file in ChatGPT Project sources so planning conversations can consistently identify the available agents and delegation policy.

### Repository source

Store and commit the following in the repository:

```text
AGENTS.md
.agents/skills/**
```

The repository copy governs Codex execution in local projects, branches, and worktrees.

---

## 4. Project-local agents

The project uses five project-local agent roles. These are not independent permanent teams. They are bounded instruction sets invoked only when relevant.

### 4.1 `$vcs-orchestrate-pr`

**Role:** coordinator for multi-domain or high-risk work.

**Use when:**

- rebuilding a scene across several subsystems;
- planning a new PR or PR sequence;
- changing more than one technical domain;
- splitting a long prompt into bounded work packets;
- coordinating parallel agents or worktrees;
- integrating optics, renderer, UI, task, and test changes.

**Primary responsibilities:**

- inspect branch, base, diff, and relevant architecture;
- classify task complexity;
- create two to four bounded work packets;
- assign file ownership and dependencies;
- recommend model strength per packet;
- control focused tests, integration, and merge gates;
- prevent overlapping edits and scope creep.

**Must not:**

- become the default implementation agent;
- read the entire repository before task classification;
- send the full project history to every subagent;
- allow two agents to edit the same files concurrently without an explicit integration plan.

---

### 4.2 `$vcs-optics-geometry`

**Role:** optical model and canonical scene-geometry specialist.

**Use when:**

- Scheimpflug construction is involved;
- tilt or swing sign conventions are questioned;
- film, lens, focus, near-DOF, or far-DOF planes change;
- canonical subject geometry or target placement changes;
- scene calibration changes;
- 2D, 3D, Ground Glass, and task geometry disagree;
- public control values must be derived from a physical solution.

**Primary ownership:**

```text
src/core/optics/**
src/core/math/**
src/scenes/*Geometry.ts
src/components/geometry/**
src/types/optics.ts
related optics and geometry tests
```

**Required principles:**

- establish coordinate axes and movement signs before editing;
- keep raw physical calibration separate from rounded UI-operable values;
- derive all views from canonical state;
- use explicit millimetre and degree units;
- verify finite, normalized plane data and nearby-step continuity;
- avoid scene-specific exceptions inside generic optics.

**Must not:**

- change task thresholds merely to force a pass;
- change renderer lighting or CSS to conceal an optical error;
- duplicate existing projection, plane, vector, or calibration helpers.

---

### 4.3 `$vcs-threejs-rtt`

**Role:** Three.js, React Three Fiber, Ground Glass RTT, and WebGL lifecycle specialist.

**Use when:**

- Ground Glass is blank, stale, too dark, duplicated, or inconsistent;
- RTT camera, clipping, render-target dimensions, shaders, or DOF passes change;
- scene subject registration changes;
- WebGL resources may leak or be disposed incorrectly;
- scene switching must prove client-side renderer cleanup;
- render quality, DPR, zoom rendering, or content diagnostics change.

**Primary ownership:**

```text
src/render/**
renderer-specific components
renderer-specific tests and diagnostics
```

**Required principles:**

- trace the complete render path from canonical state to displayed canvas;
- identify ownership and teardown for every GPU resource;
- dispose only owned resources;
- keep WebGL-independent and WebGL-dependent tests separate;
- use meaningful diagnostics, not attributes that merely mirror current props;
- use true SPA navigation when testing resource lifecycle.

**Must not:**

- use full page reloads to prove scene cleanup;
- add decorative DOM fallbacks that hide renderer defects;
- change physical calibration just to improve the image;
- accept screenshot size as the only evidence of correctness.

---

### 4.4 `$vcs-ui-tasks`

**Role:** React UI, responsive layout, accessibility, controls, state, route, catalog, and guided-task specialist.

**Use when:**

- simulator layout or scroll behaviour changes;
- 1024px responsive behaviour changes;
- dialogs, menus, overlays, focus, or keyboard access changes;
- public scene cards or routes change;
- task definitions, enabled controls, feedback, or restart state change;
- control min, max, step, labels, or disabled states change;
- route and task identity must be validated.

**Primary ownership:**

```text
src/app/**
src/components/**
src/core/tasks/**
src/state/**
src/ui/**
src/index.css
UI, task, route, and accessibility tests
```

**Required principles:**

- available scenes must resolve and support free mode;
- guided mode and `guidedTaskId` must appear together;
- guided tasks must exist and belong to the same scene;
- free routes must not accept task IDs;
- controls must use shared step constants;
- task completion must be reachable through real public controls;
- modal UI must support initial focus, containment, Escape, and focus restoration;
- simulator main and controls should retain independent scrolling.

**Must not:**

- alter optics or renderer internals to make a UI test pass;
- use direct DOM value injection as proof that a user can complete a task;
- silently broaden a focused UI fix into a project-wide redesign.

---

### 4.5 `$vcs-verify-pr`

**Role:** independent PR reviewer and merge gatekeeper.

**Use when:**

- a branch or PR is ready for inspection;
- the user asks whether work can close or merge;
- review comments have allegedly been fixed;
- CI and regression evidence must be checked;
- the next PR should only begin after the current PR is sound.

**Primary responsibilities:**

- inspect base, head, merge base, commit list, and changed files;
- verify current-head CI and unresolved review threads;
- challenge PR claims against actual code and tests;
- check optical, renderer, route, task, accessibility, and regression risks;
- determine whether tests would fail for the original defect;
- issue one precise merge verdict.

**Allowed verdicts:**

- **Ready to merge**
- **Ready after minor fixes**
- **Not ready**

**Independence rule:**

The primary implementation agent must not be the sole final reviewer of its own work.

---

## 5. Task complexity and routing

### 5.1 Small fix

Use when:

- there is one primary concern;
- optics and renderer architecture are unchanged;
- no more than roughly five files are relevant;
- focused tests can prove the outcome.

Typical flow:

```text
one implementation agent
→ $vcs-verify-pr
```

Examples:

- stable centering for a resizable dialog;
- route typo or public catalog inconsistency;
- one keyboard-control bug;
- one focused test correction.

### 5.2 Standard PR

Use when:

- two related concerns cross a component boundary;
- UI and task metadata change together;
- a scene change requires unit, integration, and one E2E spec;
- no new optics derivation or renderer architecture is required.

Typical flow:

```text
$vcs-orchestrate-pr
├── implementation packet A
├── implementation packet B
└── $vcs-verify-pr
```

### 5.3 High-risk simulation PR

Use when any apply:

- tilt, swing, Scheimpflug, focus-plane, DOF, or projection mathematics change;
- canonical geometry or sign convention changes;
- RTT, shaders, render targets, clipping, or camera configuration changes;
- scene subject ownership or GPU disposal changes;
- a defect crosses 2D, 3D, Ground Glass, and task evaluation;
- existing tests may pass while hiding the defect.

Typical flow:

```text
$vcs-orchestrate-pr
├── $vcs-optics-geometry analysis
├── $vcs-threejs-rtt analysis
├── bounded implementation packets
└── $vcs-verify-pr
```

---

## 6. Model routing

Model choice should follow task risk rather than agent name alone.

### Strongest reasoning model

Use for:

- orchestration of large or ambiguous PRs;
- optical derivations and sign conventions;
- renderer architecture and hidden lifecycle state;
- conflicting evidence;
- failed prior implementation attempts;
- final merge-critical review.

### Balanced coding model

Use for:

- React UI implementation;
- routes, tasks, and state;
- bounded renderer implementation after design is established;
- focused unit, integration, and E2E changes;
- mechanical refactors with clear acceptance criteria.

### Lightweight model

Use only for:

- locating files and symbol references;
- inventorying tests and helpers;
- summarizing raw logs;
- documentation-only updates;
- mechanical edits with no architectural decision.

A lightweight agent must not decide optical correctness, GPU ownership, lifecycle validity, or final merge readiness.

---

## 7. Work-packet policy

Subagents should receive a bounded work packet rather than the original long prompt.

### Required format

```text
WORK PACKET

ID:
<short identifier>

Objective:
<one observable outcome>

Owner skill:
<one project-local skill>

Branch and base:
<head branch>
<base branch or commit>

Known evidence:
- <current facts, failing behaviour, review thread, log, screenshot, or test>

Allowed files or ownership:
- <paths or module boundary>

Do not modify:
- <explicit exclusions>

Required behaviour:
- <acceptance criterion>
- <acceptance criterion>

Required validation:
- <focused command or observable evidence>

Dependencies:
- <packet IDs or none>

Output:
- status
- root cause or decision
- files changed
- tests run and results
- tests not run
- remaining risks
- commit SHA when committed
```

### Packet limits

- target length: under 600 words;
- one concern per packet;
- explicitly assign file ownership;
- avoid complete project history;
- include code excerpts only when the exact contract is ambiguous;
- prefer two to four packets per PR;
- more than four packets usually means the PR should be split.

### Parallel work

Parallelize only when:

- file ownership does not overlap;
- one packet does not depend on unresolved output from another;
- shared contracts are already established;
- integration order is explicit.

Do not parallelize optics and renderer implementation before their shared coordinate and state contracts are resolved.

---

## 8. Handoff policy

Each agent should return a compact evidence-based handoff.

```text
HANDOFF

Packet:
<packet ID>

Status:
completed / partial / blocked

Finding or decision:
<concise evidence-backed result>

Files changed:
- <path>

Validation:
- <command>: passed / failed / not run

Unresolved:
- <remaining issue or none>

Next agent needs:
- <only context not already in the repository>

Commit:
<SHA or not committed>
```

Rules:

- ordinary handoffs should stay under 500 words;
- optics or renderer handoffs should stay under 1,000 words;
- do not paste full diffs;
- reference paths, test names, logs, review threads, and commit SHAs;
- clearly distinguish tests run from tests claimed or inferred.

---

## 9. Validation strategy

Run the smallest relevant checks first:

1. focused unit tests;
2. focused integration tests;
3. one relevant E2E spec;
4. affected-scene regressions;
5. full unit and integration suite;
6. full E2E only at integration or merge gate.

Required repository checks before completion:

```bash
npm test
npm run typecheck
npm run lint
npm run check:css
npm run build
git diff --check
git status --short
```

Run `npm run ci:local:e2e` when:

- the work packet explicitly requires it;
- renderer-wide risk exists;
- scene lifecycle or WebGL resources changed;
- the branch reaches the merge gate.

Do not repeatedly run the full E2E suite after every small edit. Use focused specs during implementation and one full pass near integration.

---

## 10. Test-integrity rules

A passing test is only valid evidence when it can detect the original failure.

For each important claim, ask:

1. What behaviour is being claimed?
2. What observable evidence proves it?
3. Can a reload, mock, injected value, wrapper attribute, broad warning filter, or screenshot-only assertion hide the defect?
4. Is the chosen test layer appropriate?
5. Does the test follow the public user workflow?

### Examples of invalid evidence

- using `page.goto()` between scenes while claiming SPA resource cleanup;
- directly injecting a high-precision slider value while claiming keyboard reachability;
- checking only a prop-derived DOM attribute while claiming internal resource replacement;
- accepting screenshot byte size as the only proof of correct rendering;
- broadly suppressing unknown WebGL warnings;
- lowering a task threshold instead of correcting optics or public steps.

---

## 11. Domain boundaries

### Canonical simulation state

Treat canonical camera and scene state as the single source of truth. Derive from it:

- 2D geometry;
- 3D overlays;
- Ground Glass camera and blur state;
- focus-target readouts;
- task evaluation;
- diagnostics.

### Optics versus renderer

- optics defines the physical planes and camera state;
- renderer visualizes that state;
- renderer must not reinterpret movement signs;
- visual clipping or display caps must not mutate physical geometry.

### UI versus task logic

- UI exposes public controls and state;
- task definitions specify allowed controls, initial state, criteria, and feedback;
- route and catalog validation bind the correct scene and task;
- user-operable steps must be shared across controls, task solutions, and tests.

### Verification

Verification reads across all boundaries but should avoid becoming the implementation owner unless the required correction is limited to tests or review tooling.

---

## 12. Standard orchestration sequence

### Phase 1 — Discovery

Coordinator inspects:

- current branch and base;
- working-tree status;
- focused diff;
- relevant architecture and tests;
- existing review threads and CI when applicable.

### Phase 2 — Design decision

Relevant specialist establishes:

- root cause;
- source-of-truth contract;
- allowed file boundary;
- acceptance criteria;
- proof strategy.

For optics or renderer work, prefer an analysis pass before implementation.

### Phase 3 — Bounded implementation

Each packet receives:

- one owner;
- non-overlapping files;
- explicit exclusions;
- focused validation.

### Phase 4 — Focused verification

Run focused checks before full CI. Confirm that tests prove the intended behaviour.

### Phase 5 — Integration

Coordinator:

- reviews handoffs;
- resolves overlapping assumptions;
- inspects final diff;
- runs full required checks;
- hands the branch to `$vcs-verify-pr`.

### Phase 6 — Merge gate

Reviewer confirms:

- branch is based on the intended `main`;
- CI belongs to the current head SHA;
- high-priority threads are resolved;
- acceptance criteria are proven;
- regression risk is bounded;
- merge verdict is explicit.

---

## 13. Example routing for PR #16 corrections

The PR #16 follow-up should not reactivate every project agent.

### Packet A — SPA scene lifecycle test

**Owner:** `$vcs-verify-pr` or a test-focused balanced coding agent under its criteria.

Scope:

- replace full reloads with client-side navigation;
- preserve diagnostics without reloading;
- verify meaningful subject or RTT lifecycle evidence;
- monitor relevant console and page errors.

Escalate to `$vcs-threejs-rtt` only if current diagnostics cannot prove resource replacement or disposal.

### Packet B — Geometry dialog UX

**Owner:** `$vcs-ui-tasks`.

Scope:

- stable initial centering;
- resize from the expected handle without transform-induced movement;
- focus containment;
- Escape and focus restoration;
- viewport bounds at 1024×768 and 1024×900.

### Final gate

**Owner:** `$vcs-verify-pr`.

Confirm:

- both review threads are resolved;
- scene-switching test performs real SPA navigation;
- modal behaviour is complete;
- focused and full checks pass;
- PR is ready to merge.

The optics specialist is not required unless a newly exposed renderer issue reveals an optical inconsistency.

---

## 14. Token-efficiency rules

- Use repository files as durable memory instead of repeating background in prompts.
- Load only the relevant skill for the current task.
- Pass current differences, not the complete project history.
- Use temporary lightweight exploration only when file discovery is genuinely needed.
- Separate analysis from implementation for high-risk work.
- Avoid repeated full E2E runs during iterative editing.
- Keep PRs and work packets bounded by concern and file ownership.
- Reference existing documents and commits instead of copying them.
- Use an independent reviewer once, near the merge gate, rather than asking every implementation agent to re-review the whole PR.

---

## 15. Maintenance

Update this document when:

- a project-local skill is added, removed, or renamed;
- file ownership boundaries materially change;
- testing policy changes;
- a repeated failure reveals a missing workflow rule;
- a new major subsystem is introduced.

When updating agent definitions:

1. update repository `.agents/skills/**` first;
2. update repository `AGENTS.md` when routing or global rules change;
3. synchronize this consolidated workflow;
4. replace the copy in ChatGPT Project sources;
5. treat the committed repository version as authoritative.
