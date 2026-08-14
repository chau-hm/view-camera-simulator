# Current Work Handoff

## Work

PR / work identifier: PR 5G — Safe Feature-Branch Publishing
Branch: `chore/safe-feature-branch-publishing`
Base: `origin/main` @ `5f3a6447843cc1325119c939718670a7ae71f3c0`
Head convention: record the substantive implementation commit here; a final
status-only bookkeeping commit is intentionally not self-referenced.

## Objective

Strengthen the repository harness so PR-oriented feature branches are created,
published, and handed to PR creation with explicit and verified refs rather
than inherited upstream or push.default behaviour.

## Implemented

- Added a no-track PR branch creation contract using origin/main as the base.
- Added fail-closed validation for the current branch, intended PR head/base,
  origin, protected destinations, and diagnostic upstream/config state.
- Established explicit HEAD:refs/heads/<same-feature-branch> publication.
- Added remote feature-head and remote-main before/after postconditions before
  PR creation, including non-destructive handling of existing remote branches.
- Kept the guard at the integrated orchestration boundary; local non-published
  work and Micro edits remain lightweight.

## Changed surface

- `AGENTS.md`
- `docs/AI_AGENT_WORKFLOW.md`
- `.agents/skills/vcs-orchestrate-pr/SKILL.md`
- `.agents/status/CURRENT.md`

`vcs-verify-pr`, custom Codex/TOML instructions, simulator/runtime code,
package files, CI, and global Git configuration were intentionally unchanged.

## Validation

- `git diff --check`: passed for the substantive policy diff.
- Final scope inspection: passed; only the three policy owners changed before
  this handoff update.
- Current branch creation: passed; the requested branch has no upstream before
  first publication.
- Policy search: passed for no-track creation, explicit refspec, branch/base
  validation, remote-main before/after checks, PR gating, and no-force rules.
- Non-destructive reasoning pass: scenarios A–H covered safe branch creation,
  inherited origin/main upstream, main/master rejection, fast-forward update,
  divergence, missing/mismatched feature refs, and unexpected main movement.

## Not run

- Application tests, typecheck, lint, CSS check, build, and E2E: not run; this
  PR changes repository harness documentation only.
- Destructive remote tests: not run; the guard is validated by policy review
  and the actual non-destructive PR 5G publication postconditions.

## Publishing-safety decisions

- PR publication never relies on upstream, push.default, remote.pushDefault,
  or a bare git push.
- A normal push may update an existing same-named remote feature branch only
  when it is accepted as a fast-forward; divergence fails closed.
- Remote main is observed before and after publication. Unexpected movement
  stops PR creation without reset, revert, or force-push repair.
- PR 6A history remains untouched and is treated only as failure evidence.
- PR creation receives explicit head/base refs only after remote verification.

## Remaining risks / known gaps

- The contract is instruction-based; no repository-local publishing helper or
  automated static check enforces it independently.
- GitHub authentication or a concurrent remote update can still block PR
  creation; the workflow must report the state rather than repair it.
- Independent merge-gate review remains required when the PR reaches that
  boundary.

## Reviewer focus

1. Verify implicit upstream and push.default behaviour cannot determine the PR
   publish destination.
2. Verify the canonical command publishes HEAD to the same-named remote
   feature branch.
3. Verify remote feature state is checked before PR creation.
4. Verify remote main is protected by before/after verification rather than
   automatic repair.
5. Verify no force-push or direct-to-main fallback exists.
6. Verify Micro edits and non-published local work remain lightweight.
7. Verify PR 6A history was left untouched.

## Since previous review

Not applicable.

## Commit

Substantive implementation: `a164068a1110b85ff91a9b308d7f0374b331a871`

Final bookkeeping: the status-only commit that adds this file; intentionally
not self-referenced to avoid recursive commits.
