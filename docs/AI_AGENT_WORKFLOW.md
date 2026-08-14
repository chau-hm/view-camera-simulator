# View Camera Simulator — AI Agent Workflow

## 1. Purpose

This document defines how ChatGPT, Codex, and project-local agents plan, route, implement, test, and review work for the View Camera Simulator project.

The workflow has four goals:

1. use the smallest execution harness that can safely prove a requested change;
2. reduce repeated context, unnecessary orchestration, and token usage;
3. route domain reasoning only when a task actually depends on that domain;
4. preserve independent verification for merge-critical work.

This document is a planning and coordination reference. Executable repository instructions remain in:

```text
AGENTS.md
.agents/skills/**
```

If this document conflicts with repository `AGENTS.md` or `.agents/skills/**`, the repository version takes precedence.

---

## 2. Project scope

View Camera Simulator is a browser-based learning tool for large-format camera movements. Its current scope includes:

- 2D optical geometry diagrams;
- Three.js and React Three Fiber scenes;
- Ground Glass render-to-texture previews;
- rise, tilt, swing, focus, and aperture controls;
- guided tasks for focus-plane and camera-movement concepts;
- illustrative depth-of-field and sharpness feedback.

Do not introduce unrelated product scope unless a task explicitly requires it.

---

## 3. Sources of truth

Use the following priority order:

1. current repository code and tests;
2. repository `AGENTS.md`;
3. repository `.agents/skills/**`;
4. current PR or work-packet acceptance criteria;
5. this workflow document;
6. previous conversation summaries and historical prompts.

Historical discussion provides context but must not override current code or explicit task requirements.

When present, `.agents/status/CURRENT.md` is compact reviewer navigation and an implementation-agent claim, not an additional source of truth. Use the actual branch, diff, tests, and PR metadata to resolve any discrepancy.

---

## 4. Core routing principle

### Smallest safe harness first

Start with the lightest execution path that can prove the requested behaviour.

Do not activate a specialist because a file happens to fall inside that specialist's ownership area.

```text
touches a domain
≠
changes or depends on that domain's contract
```

Examples:

```text
Change a button label inside a renderer-adjacent component
→ Micro edit

Change Ground Glass render-target ownership
→ Renderer specialist

Change a camera calibration constant whose meaning is already established
→ Micro or Focused fix

Derive a new camera position from optical constraints
→ Optics specialist
```

### Evidence-driven escalation

Escalation must be caused by concrete evidence, such as:

- root cause is not locally explainable;
- the local edit would change a shared contract;
- more than one subsystem must agree on a new source of truth;
- optics/projection mathematics require derivation;
- RTT/GPU ownership or lifecycle is involved;
- route/task/public-control semantics change across modules;
- existing tests can pass while hiding the defect;
- repeated local attempts have failed.

Do not escalate merely as a precaution.

### Stop condition

If the requested behaviour can be fixed locally without changing an existing contract or abstraction:

- make only that change;
- do not proactively refactor;
- do not generalize unrelated code;
- do not add diagnostics unrelated to proving the change;
- do not strengthen unrelated tests;
- do not expand the task into a PR-wide review.

---

## 5. Project-local agents

### 5.1 `$vcs-orchestrate-pr`

**Role:** coordinator for multi-domain, ambiguous, or high-risk work.

**Use when:**

- several technical domains must change together;
- root cause or ownership is unclear after focused inspection;
- a PR needs bounded work packets and integration order;
- parallel work or multiple worktrees require coordination;
- optics, renderer, UI/task, and test contracts must be reconciled.

**Do not use when:**

- the task qualifies as a micro edit;
- one domain can complete and prove a focused fix locally;
- orchestration adds no additional safety or decision value.

The orchestrator should actively downgrade unnecessary orchestration.

---

### 5.2 `$vcs-optics-geometry`

Use when the task depends on optical reasoning or canonical geometry contracts, including:

- Scheimpflug construction;
- tilt/swing sign conventions;
- film, lens, focus, or DOF plane mathematics;
- canonical subject geometry;
- calibration derived from physical constraints;
- disagreement between 2D, 3D, Ground Glass, and task geometry.

Do not activate it solely because a file is under `src/core/optics/**` or a camera-related constant changes.

---

### 5.3 `$vcs-threejs-rtt`

Use when the task depends on renderer reasoning or WebGL lifecycle contracts, including:

- blank, stale, duplicated, or inconsistent Ground Glass output;
- RTT camera, clipping, render targets, shaders, or post-processing;
- scene-subject registration;
- GPU resource ownership or disposal;
- client-side scene switching and lifecycle evidence;
- renderer diagnostics that expose internal state.

Do not activate it for cosmetic or local UI edits in renderer-adjacent components.

---

### 5.4 `$vcs-ui-tasks`

Use when the task depends on shared UI/task contracts, including:

- responsive simulator layout;
- modal/menu accessibility;
- public scene or route metadata;
- guided-task identity;
- enabled controls, shared step constants, or task reachability;
- cross-component state or restart behaviour.

Do not activate it for a local text/style correction whose behaviour is explicit and isolated.

---

### 5.5 `$vcs-verify-pr`

**Role:** independent merge-gate reviewer.

Use when:

- the user asks for branch/PR review;
- the work is ready for a merge verdict;
- review comments have allegedly been fixed;
- CI/current-head evidence must be validated;
- regression risk is substantial enough to require independent challenge.

Do not require a separate verification pass for every micro edit or focused local implementation.

Allowed verdicts:

- **Ready to merge**
- **Ready after minor fixes**
- **Not ready**

The primary implementation agent must not be the sole final reviewer when a merge verdict is required.

---

## 6. Task complexity and routing

### Level 0 — Micro edit

Use when all apply:

- one explicit observable change;
- root cause known or locally obvious;
- normally one to three files;
- no new abstraction;
- no shared contract change;
- no optics derivation/sign-convention change;
- no renderer lifecycle/RTT ownership change;
- no public route/task schema change.

Typical flow:

```text
local inspection
→ minimal edit
→ nearest focused validation
```

Do not invoke:

- `$vcs-orchestrate-pr`;
- independent `$vcs-verify-pr`;
- full repository validation.

Escalate only if new evidence reveals broader impact.

Examples:

- adjust established camera calibration value;
- fix copy or label;
- correct one local conditional;
- small CSS/layout correction with no responsive-system redesign;
- update one test expectation after an intentional local copy change.

---

### Level 1 — Focused fix

Use when:

- one domain contract matters;
- the root cause is understood;
- a handful of files may change;
- focused tests can prove the outcome;
- no multi-domain coordination is needed.

Typical flow:

```text
one relevant implementation skill
→ focused validation
```

Independent review is optional unless explicitly requested or merge-critical.

Examples:

- one keyboard-control bug affecting shared step semantics;
- one accessibility defect in a reusable dialog;
- one renderer bug with known local ownership;
- one optics correction with a known formula and bounded consumers.

---

### Level 2 — Standard PR

Use when:

- two related concerns cross a component boundary;
- UI and task metadata change together;
- a scene feature requires coordinated implementation and tests;
- integration needs explicit file ownership or sequencing.

Typical flow:

```text
$vcs-orchestrate-pr
├── bounded packet A
├── bounded packet B
└── integration checks
```

Use `$vcs-verify-pr` when the branch is being evaluated for merge.

---

### Level 3 — High-risk simulation PR

Use when any apply:

- tilt, swing, Scheimpflug, focus-plane, DOF, or projection mathematics change materially;
- canonical geometry or movement sign conventions change;
- RTT architecture, shaders, render-target ownership, clipping, or GPU lifecycle changes;
- a defect crosses 2D, 3D, Ground Glass, and task evaluation;
- existing tests may pass while hiding the defect;
- prior local fixes failed or evidence conflicts.

Typical flow:

```text
$vcs-orchestrate-pr
├── specialist analysis as required
├── bounded implementation packets
├── integration validation
└── $vcs-verify-pr at merge gate
```

---

## 7. Optional complexity budget

Use this only as an internal routing aid, not as a rigid scoring system.

```text
0  textual / cosmetic / established constant tweak
1  local behavioural logic
1  more than ~3 relevant files
2  shared cross-component contract
2  canonical state
3  optics / projection derivation
3  RTT / GPU lifecycle
2  route / task / public workflow contract
2  uncertain root cause
```

Suggested interpretation:

```text
0–1  Micro
2–3  Focused
4–6  Standard
7+   High-risk
```

Concrete task evidence overrides the score.

---

## 8. Work-packet policy

Work packets are for Standard and High-risk work. Do not manufacture work packets for micro edits.

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
- <current facts or failing behaviour>

Allowed files or ownership:
- <paths or module boundary>

Do not modify:
- <explicit exclusions>

Required behaviour:
- <acceptance criterion>

Required validation:
- <focused evidence>

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

Guidelines:

- target under 600 words;
- one concern per packet;
- explicit file ownership;
- avoid complete project history;
- prefer two to four packets;
- more than four packets usually means the PR should be split.

---

## 9. Handoff policy

Use compact handoffs only when work passes between agents.

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
- <only missing context>

Commit:
<SHA or not committed>
```

Do not require formal handoffs for a single-agent micro edit.

### 9.1 Durable review handoff

For Standard PR work, High-risk PR work, and review-fix rounds, the integrated implementation state must update `.agents/status/CURRENT.md` before the final handoff. A Focused fix may update it when the context would materially help a later reviewer; a Micro edit does not require it.

`CURRENT.md` is one overwritten current-work file, not append-only history and not one file per PR. Keep it compact and include the work identifier, branch/base/head context, observable objective, implemented and changed surfaces, claimed validation and not-run checks, decisions, remaining risks, reviewer focus, and a `Since previous review` delta when the work is a review-fix round. Mention material areas intentionally unchanged when that prevents unnecessary re-review.

Its purpose is durable reviewer navigation: a later agent can orient from the current objective, scope, decisions, evidence claims, and known gaps without reconstructing them from the entire repository. It remains an implementation-agent claim. The reviewer must read relevant `CURRENT.md` content early, then independently inspect the actual branch/diff and merge-critical evidence; the file never replaces code, tests, PR metadata, or verification.

The intended lifecycle is:

```text
implementation
    ↓
compact CURRENT.md update
    ↓
reviewer reads CURRENT.md for orientation
    ↓
targeted diff / tests / evidence inspection
    ↓
independent verdict
```

If final bookkeeping changes the branch HEAD after the substantive implementation commit, record the substantive commit in `CURRENT.md` and clearly identify the status-only bookkeeping convention rather than creating recursive self-referencing commits.

---

## 10. Validation strategy

Validation must be proportional to the claimed behaviour and risk.

### Level 0 — Micro

Run the nearest focused test or static check that directly proves the edit, plus:

```bash
git diff --check
git status --short
```

Do not run full CI by default.

### Level 1 — Focused

Run:

1. focused unit/integration test;
2. relevant typecheck/lint/CSS/build check when applicable;
3. diff/status checks.

### Level 2 — Standard integration

Run affected suites first, then:

```bash
npm test
npm run typecheck
npm run lint
npm run check:css
npm run build
git diff --check
git status --short
```

### Level 3 / merge gate

Run Standard checks plus relevant E2E.

Run `npm run ci:local:e2e` when:

- renderer-wide risk exists;
- scene lifecycle or GPU ownership changed;
- the public workflow requires E2E proof;
- the work packet explicitly requires it;
- the branch reaches a merge gate where E2E is relevant.

---

## 11. Test-integrity rules

For each important claim ask:

1. What behaviour is claimed?
2. What observable evidence proves it?
3. Would the old defect fail this evidence?
4. Can reloads, mocks, injected values, prop-derived attributes, warning filters, or screenshot-only assertions hide the defect?
5. Is the test layer appropriate?

Invalid evidence includes:

- `page.goto()` between scenes while claiming SPA lifecycle cleanup;
- directly injecting a high-precision slider value while claiming public reachability;
- checking only a prop-derived DOM attribute while claiming internal resource replacement;
- screenshot byte size as the only rendering proof;
- broad suppression of unknown WebGL warnings;
- lowering task thresholds instead of correcting the real defect.

---

## 12. Domain boundaries

### Canonical simulation state

Derive from canonical camera and scene state:

- 2D geometry;
- 3D overlays;
- Ground Glass camera and blur state;
- focus-target readouts;
- task evaluation;
- diagnostics.

### Optics versus renderer

- optics defines physical planes and camera state;
- renderer visualizes that state;
- renderer must not reinterpret movement signs;
- visual clipping or display caps must not mutate physical geometry.

### UI versus task logic

- UI exposes public controls and state;
- task definitions specify allowed controls, initial state, criteria, and feedback;
- route/catalog validation binds the correct scene and task;
- public control steps must agree with task solutions and tests.

### Verification

Verification reads across boundaries but should remain independent at merge gate.

---

## 13. Standard orchestration sequence

Use this sequence only for Level 2 or Level 3 work.

### Phase 1 — Focused discovery

Inspect branch/base, working tree, focused diff, relevant architecture/tests, and review/CI state when applicable.

### Phase 2 — Contract decision

Relevant specialists establish root cause, source of truth, file boundary, acceptance criteria, and proof strategy.

### Phase 3 — Bounded implementation

Assign non-overlapping ownership and explicit exclusions.

### Phase 4 — Focused verification

Run the smallest tests that can detect the original defect.

### Phase 5 — Integration

Resolve assumptions and run integration-level validation.

### Phase 6 — Merge gate

Use `$vcs-verify-pr` only when an independent merge verdict is required.

---

## 14. Token-efficiency rules

- Treat repository files as durable memory.
- Load only the skill required by the current reasoning problem.
- Pass current differences, not full project history.
- Do not create work packets for micro edits.
- Do not reactivate specialists merely because their files are touched.
- Do not repeatedly run full E2E during iterative implementation.
- Reference commits, paths, tests, and logs instead of copying them.
- When reviewing a relevant branch, read the current handoff early to identify files, decisions, known gaps, reviewer-focus areas, and claimed validation before broad repository exploration.
- Use independent review once, near a real merge gate.

---

## 15. Maintenance

Update this document when:

- a skill is added, removed, or renamed;
- routing boundaries materially change;
- validation policy changes;
- repeated failure reveals a missing workflow rule;
- a new major subsystem is introduced.

When changing agent policy:

1. update repository `.agents/skills/**`;
2. update repository `AGENTS.md`;
3. synchronize this workflow;
4. update any custom-agent TOML instructions that duplicate old routing language;
5. treat committed repository instructions as authoritative.

Keep the durable handoff policy synchronized at those boundaries, but do not mechanically add `CURRENT.md` ceremony to domain-specialist skills or Micro edits. `CURRENT.md` remains current-work state, not project history or policy storage.
