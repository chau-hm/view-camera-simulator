# View Camera Simulator — AI Agent Workflow

## 1. Purpose

This document explains how ChatGPT, Codex, project-local skills, and custom agents should plan, implement, publish, and review work for View Camera Simulator.

It is a human-readable workflow reference.

Executable repository instructions remain in:

```text
AGENTS.md
.agents/skills/**
.codex/agents/*.toml
.codex/config.toml
```

If this document conflicts with those executable instructions, the executable repository configuration wins.

The workflow has six goals:

1. use the smallest safe execution harness;
2. keep task complexity separate from PR delivery;
3. use subagents for bounded context, independent reasoning, or useful parallelism;
4. make PR publication a routine, deterministic completion step;
5. make worktree-local state safe under concurrent work;
6. keep `main` continuously releasable to production.

---

## 2. Core architecture

The normal project flow is:

```text
Planner / primary agent
        │
        ├─ may implement directly
        │
        └─ may delegate bounded work
               │
               ├─ optics worker
               ├─ renderer worker
               ├─ UI/task worker
               └─ test worker
        │
        ▼
integration + proportional validation
        │
        ▼
commit
        │
        ▼
safe feature-branch publication
        │
        ▼
PR with durable implementation handoff
        │
        ▼
independent reviewer
        │
        ▼
fixes / merge decision
```

The planner, workers, and reviewer are roles, not capability tiers.

---

## 3. Requirement authority versus repository evidence

Do not treat current tests as higher authority than a current request to change behaviour.

Use two separate concepts.

### Instruction authority

1. explicit current task / acceptance criteria;
2. `AGENTS.md`;
3. invoked `SKILL.md`;
4. current work packet;
5. this workflow.

### Implementation evidence

1. current branch/diff/runtime;
2. current tests and CI;
3. PR implementation handoff;
4. local worktree notes;
5. historical material.

Code and tests show what the repository currently does. They do not veto an explicitly requested change.

---

## 4. Complexity is not delivery

Use four complexity levels.

### Level 0 — Micro

One explicit, locally obvious, reversible concern with no shared-contract change.

```text
inspect locally
→ edit minimally
→ nearest focused proof
```

### Level 1 — Focused

One domain contract matters, root cause is understood, and a bounded set of files/tests can prove the result.

```text
focused implementation
→ focused validation
```

### Level 2 — Coordinated

Several related concerns must integrate, or context isolation/ownership/dependencies make bounded delegation useful.

The primary agent may still implement directly if decomposition adds no value.

### Level 3 — High-risk simulation

Use for materially changed optics/projection/canonical state, renderer/GPU lifecycle, or defects crossing several simulation layers.

### Delivery modes

Any complexity level may use:

- Local-only delivery; or
- PR delivery.

PR delivery is the normal implementation mode unless the user explicitly asks for local-only work.

A Micro PR remains a Micro change and should not receive High-risk ceremony merely because a PR will be created.

---

## 5. Subagents as bounded-context workers

The main reason to delegate is no longer simply model cost.

Use a subagent when at least one is materially useful:

### Context isolation

The worker can start from a much smaller, task-specific context.

Example:

```text
Primary agent knows:
- entire PR objective
- integration decisions
- review history
- branch topology

Optics worker receives:
- one optical objective
- coordinate/sign assumptions
- affected optics files
- focused tests
```

### Independent reasoning

A fresh context helps avoid implementation anchoring.

This is especially useful for test design or a second domain analysis.

### Parallelism

Independent packets may run concurrently when:

- shared contracts are already resolved;
- file ownership does not overlap;
- dependencies are explicit.

Do not parallelize implementation that still requires a shared-contract decision.

### When not to delegate

Keep work in the primary agent when:

- most of the same context must be copied to the worker;
- integration overhead exceeds the value of isolation;
- one coherent implementation is simpler and safer.

Runtime context-management features may reduce the cost of a long worker session, but they do not replace bounded delegation, independent roles, or durable PR handoff.

---

## 6. Project-local roles

### `$vcs-orchestrate-pr`

Use when coordination itself adds value:

- ambiguous ownership;
- multi-domain contracts;
- non-trivial integration order;
- safe parallel work;
- high-risk decomposition.

Do not invoke it solely because a task is Level 2 or because several files change.

### `$vcs-optics-geometry`

Use for:

- Scheimpflug/focus/DOF geometry;
- sign conventions;
- canonical physical planes;
- physically derived calibration;
- cross-view optical disagreement.

### `$vcs-threejs-rtt`

Use for:

- Ground Glass RTT;
- shaders/post-processing;
- renderer lifecycle;
- GPU ownership/disposal;
- projection plumbing;
- SPA lifecycle evidence.

### `$vcs-ui-tasks`

Use for:

- responsive simulator UI;
- accessibility;
- scene catalog/routes;
- guided-task identity;
- public control reachability;
- cross-component UI/task state.

### `vcs_test_worker`

Use for an independent bounded testing role when fresh context adds value.

### `$vcs-verify-pr`

This is an optional internal verifier, not the normal final review path.

The normal merge-gate review occurs externally after the implementation PR is published.

---

## 7. Work packets

Use work packets only when decomposition helps.

Recommended format:

```text
WORK PACKET

ID:
Objective:
Owner:
Branch / intended PR base:
Known evidence:
Allowed files / ownership:
Do not modify:
Required behaviour:
Required validation:
Dependencies:
Output:
```

Guidelines:

- one concern per packet;
- prefer two to four packets;
- explicit ownership;
- compact context;
- no full project history;
- no full diff paste;
- no publication by internal workers.

More than four packets usually means the feature should be reconsidered or split.

---

## 8. Worktree-safe current state

The old tracked singleton:

```text
.agents/status/CURRENT.md
```

is not safe when several worktrees operate concurrently.

The new model is:

```text
worktree A/.agents/status/CURRENT.md   ignored
worktree B/.agents/status/CURRENT.md   ignored
worktree C/.agents/status/CURRENT.md   ignored
```

Each worktree may maintain its own current-work notes.

For Coordinated, High-risk, and review-fix work, maintaining a compact local `CURRENT.md` is recommended.

The file is:

- local;
- ignored by Git;
- non-authoritative;
- disposable after the PR lifecycle.

The tracked `.agents/status/README.md` contains the template and rules.

---

## 9. Durable review handoff lives in the PR

Before PR creation or update, convert the useful local worktree state into a PR-body section.

Recommended format:

```text
## Implementation handoff

Objective:
...

Base / head:
...

Implemented:
- ...

Validation:
- ...

Not run:
- ...

Known gaps:
- ...

Reviewer focus:
- ...
```

For review-fix rounds:

```text
### Since previous review

- P1 → ...
- P2 → ...
```

The PR handoff is durable reviewer navigation, not independent evidence.

The reviewer must inspect the actual branch/diff/tests/CI.

---

## 10. PR publication is normal completion

For PR-delivery work:

```text
implementation
→ validation
→ commit
→ safe feature push
→ verify remote feature ref
→ create/update PR with explicit base
→ reviewer handoff
```

Do not stop after commit waiting for routine approval to publish the intended feature branch.

Publication safety comes from deterministic Git operations, not from relying on implicit upstream state.

Always use an explicit feature refspec:

```bash
git push -u origin "HEAD:refs/heads/<feature-branch>"
```

Never use:

- bare `git push`;
- direct feature publication to `main`, `production`, or an integration-base branch;
- force push.

PR head and base must be explicit.

If the intended base moves concurrently, refetch and ensure the PR still targets the correct base. Unrelated base movement is not itself proof that the explicit feature push was unsafe.

---

## 11. Main must always be releasable

The production promotion mechanism deliberately promotes the whole current `origin/main`.

Therefore:

> Every merge to `main` must leave `main` safe to deploy.

This is the central release invariant.

### Releasable vertical slices

A large feature may land in small PRs when each merged slice is production-safe.

Typical pattern for a new scene:

```text
PR A — internal geometry/component, not public
PR B — controls/optics, still not public
PR C — guided task, still not public
PR D — integration, still not public
PR E — public activation/catalog entry
```

Every intermediate `main` remains releasable.

### Non-releasable intermediate states

When child PRs cannot independently be safe on `main`, use:

```text
integration/<feature>
```

Child PRs target that branch.

After the integrated feature is production-safe:

```text
integration/<feature>
        ↓
final integration PR
        ↓
main
```

The final PR is reviewed as the complete change against `main`.

Do not solve the problem by selectively cherry-picking finished feature commits into `production`.

---

## 12. Production promotion

The existing release topology remains:

```text
origin/main
     │
     ▼
isolated promotion worktree
     │
     ▼
origin/production
     │
     ▼
GitHub Pages
```

Production promotion remains a separate controlled operation.

Use:

```bash
npm run promote:preflight
npm run promote:production
```

`npm run promote:preflight` reads the current authoritative `origin/main` and
`origin/production` SHAs, checks that the fetched tracking refs match, rejects a
shallow repository or incomplete reachable object graph, and confirms that the
recorded commits share Git ancestry. It reports the common ancestor, branch-only
commit counts, and whether either branch contains the other. A diverged history
with a common ancestor is valid and is checked using the normal promotion merge.

When promotion is needed, preflight creates a detached temporary worktree at the
recorded production SHA and runs the same `git merge --no-ff` operation used by
promotion, with Git's recorded `rerere` conflict resolutions disabled so an
unresolved conflict cannot be silently reused. It reports conflicting paths
when that merge cannot complete and removes the temporary worktree on success
or failure. The merge may create an unreferenced commit object in the local
object database; preflight does not update local branch refs or publish to the
remote.

A `PROMOTION_READY` result means the two recorded commits were merge-compatible
at the time of the check. It does not reserve either remote ref or guarantee a
future promotion: refs and repository conditions can change after preflight.
Actual promotion remains a separate, user-controlled command and independently
fetches and validates the current remote state.

If preflight reports shallow history, recover it manually and rerun preflight:

```bash
git fetch --unshallow origin
npm run promote:preflight
```

If preflight reports no common ancestor, it could not establish shared Git
history for the recorded commits. Confirm that the expected remote refs were
selected and that the repository has complete objects. The promotion must stop;
do not use `--allow-unrelated-histories`. Merge conflicts are reported with the
conflicting paths and require resolution through the normal release process
before promotion is attempted.

The canonical script should continue to:

- read authoritative remote refs;
- use an isolated temporary worktree;
- validate repository history and normal merge feasibility before publication;
- detect concurrent remote movement;
- publish only to `production`;
- use a normal non-force push;
- verify the result.

If `main` contains an unsafe incomplete feature, fix the integration workflow rather than making the release script selectively reconstruct production history.

### Historical qualification and deployment state

Git promotion and Pages deployment are separate outcomes. A successful merge
and push advances `origin/production`; it does not establish that the resulting
site was deployed. In particular, production branch HEAD is not a reliable
proxy for the currently deployed revision after a failed CI gate or skipped
deployment.

Historical qualification has two policies. Pull requests and ordinary pushes
qualify the changed paths and their registered evidence dependency closure. A
production push proves the canonical merge from its event `before` and `after`
objects, verifies the promoted second parent as a main revision, checks exact
source and destination tree identity, and qualifies the cumulative range from
the fixed historical policy baseline to that source. A successful incremental
main workflow is not reused as proof that every cumulative archive was
qualified. All currently registered historical validators run for production
releases, and ordinary application CI, browser smoke, production preview,
evidence integrity, and build checks still gate deployment.

All event modes use the same evidence ownership classifier. A changed path can
belong to a registered historical validator, an explicitly registered
ordinary-CI owner, qualification infrastructure, legitimate non-evidence
documentation, or an unresolved evidence dependency. `NOT_APPLICABLE` for an
ordinary-CI-owned path means only that the historical archive lane does not
run that owner twice; the corresponding ordinary check remains mandatory.
Nested legacy evidence roots are fail-closed detection scopes, not archival
exemptions, and unknown additions under them must be resolved during
development qualification rather than first appearing in a production gate.

The fixed baseline records exact pre-policy Git blob identities and explicit
ownership/disposition metadata. Unchanged archival material without a current
equivalent validator may be accepted only as a distinct
`QUALIFIED_WITH_LEGACY_ARCHIVAL` production decision; that decision does not
claim a validator passed or establish optical, renderer, or runtime
correctness. Modifying, deleting, or renaming baseline content invalidates
that disposition and returns the changed path to normal qualification. New
unknown evidence stays fail-closed. A newly registered validator supersedes
its family's archival-only disposition.

Because production qualification always starts at the fixed baseline rather
than the immediately preceding production commit, a failed cumulative release
cannot disappear when a later production event has a small Git diff. The
baseline is not a last-deployed marker, and this policy does not infer
deployment success from production history. Do not bypass either qualification
or the ordinary CI/deployment gates to recover a skipped release.

---

## 13. Validation strategy

Validation follows complexity, not PR existence.

### Micro

Nearest meaningful proof plus diff/status checks.

Avoid full CI and avoid implementation-mirroring tests for trivial reversible changes.

### Focused

Focused tests plus relevant type/lint/build/CSS checks where applicable.

### Coordinated

Affected suites first; repository integration checks when shared contracts are involved.

### High-risk

Integration checks plus relevant E2E when the public browser flow, renderer lifecycle, or high-risk simulation behaviour requires it.

Stop broadening validation once the required evidence passes unless new evidence creates a reason to continue.

---

## 14. Test integrity

A test is useful only if it could detect the original defect.

Invalid proof patterns include:

- full reload used to prove SPA cleanup;
- unreachable control values injected directly;
- prop-mirroring attributes used to prove internal lifecycle;
- screenshot size as the only render proof;
- broad warning suppression;
- task-threshold reduction instead of fixing reachability/physics.

---

## 15. Model routing philosophy

Custom-agent model assignments are executable in:

```text
.codex/agents/*.toml
```

`MODEL_ROUTING.md` documents those assignments and their rationale.

Worker agents are bounded-context roles, not weak-model roles.

The current model experiment may change worker models or reasoning effort without changing:

- delegation semantics;
- PR delivery;
- release topology;
- worktree handoff;
- domain skill contracts.

Experimental context-management configuration should be treated separately from the durable harness until explicitly enabled.

---

## 16. Maintenance

Update this workflow when:

- skill/agent roles materially change;
- publication or release topology changes;
- a repeated failure reveals a missing invariant;
- model-routing rationale changes enough to affect the human explanation.

When changing executable agent policy, update the actual owning file first and keep this document synchronized as explanatory documentation.
