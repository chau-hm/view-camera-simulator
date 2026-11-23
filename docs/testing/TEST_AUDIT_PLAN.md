# Test Audit Plan

## Executive findings

The audit remains pinned to `origin/main` at `658487f468d14d6129f4ac7091ebd71c32afd5ed`. Its inventory, measurements, and test ownership findings are unchanged by this review-fix round. The baseline recorded 349 Vitest files and 4,279 collected Unit/Integration declarations, plus 276 ordinary Chromium cases and four production-preview cases. The complete configured Vitest run passed at that pinned SHA. M7 added 495 collected Vitest cases across B–W, with native-gated runtime declarations separately identified.

The current `.github/workflows/pages.yml` runs on `pull_request`, `push` to every branch (`**`), and `workflow_dispatch`. Its concurrency key uses workflow name plus `github.ref`; a feature branch push and its PR event use different refs and may execute substantially the same validation separately. This is a distinct CI-efficiency candidate. Historical Actions time and cost savings are **NOT_MEASURED**.

The roadmap now has three bounded CI changes before the separate test cleanup:

1. **PR B1 — GitHub CI trigger deduplication:** reduce duplicate open-PR feature-branch runs while retaining automatic validation for feature branches before a PR exists, protected-branch checks, manual dispatch, and production deployment conditions.
2. **PR B2 — Historical Evidence qualification separation:** move only frozen report replay out of ordinary application CI after automatic Evidence-sensitive qualification is in place. M7V current E2E qualification and skip governance remain mandatory on every PR.
3. **PR B3 — Local-first CI and core regression strategy:** improve local validation and its evidence, then evaluate a smaller GitHub Core Regression suite. Full Vitest remains in mandatory GitHub CI until independent merge-gate evidence justifies a change.

The highest-confidence test-level candidates remain narrow:

- The standalone M7F replay duplicates the M7F child replay performed by M7G. Consider removing only the duplicate invocation after the M7G child reproduces the same fresh report from a clean shallow checkout. Keep the evaluator, M7F parser/CLI tests, historical artifacts, and PR 304 source retrieval.
- Three declarations in `groundGlassRttOrientation.test.ts` overlap with the stronger fixed-reference owner in `groundGlassCoordinateContract.test.ts`. About 60 test lines are estimated removable; runtime savings are **NOT_MEASURED**. Keep the other orientation cases and all asymmetric coordinates, both display modes, physical-side relationships, and crop proof.
- `clearGroundGlassApertureGatherCaptureForTest` is a six-line potential removal after a fresh full-repository caller search and focused capture/cleanup proof.
- Two Ground Glass browser suites need stronger rendered-pixel evidence before their visual claims are considered proven. Keep their public interaction coverage.

The workflow trigger candidate does not imply a measured saving. No historical test, source-provenance record, archived capture, evaluator, or current-runtime regression is disposable solely because it is old. M7L/M raw-capture limitations, M7S discovery, emitted production-bundle impact, and browser/CI timings remain explicit uncertainties.

## Highest-priority cleanup and efficiency candidates

| Candidate | Intended action | Measured size | Expected cost change | Required proof |
|---|---|---|---|---|
| Pages workflow feature-push / PR duplication | In PR B1, make PR validation authoritative for open PRs, retain automatic feature-push validation before a PR exists, and preserve main/production and manual runs. | No test or production lines; workflow change only. | Actions executions and cost **NOT_MEASURED** until measured before/after. | Verify event matrix, stable PR Required Checks, pre-PR branch coverage, protected-branch checks, integration workflows, and production deployment. |
| Direct M7F replay invocation | Consider consolidating into M7G's existing child replay; retain all implementation, tests, evidence, and provenance. | 0 test/support/production lines; one workflow invocation. | CI seconds **NOT_MEASURED**. | From a clean shallow checkout, compare fresh M7F source, exit status, scenario counts, report, and qualification decision produced directly and through M7G. |
| Three Ground Glass orientation declarations | Consolidate only the fixed orientation/film-coordinate assertions into `groundGlassCoordinateContract.test.ts`. | About 60 test lines estimated; no support/production lines identified. | Test runtime **NOT_MEASURED**. | Keep fixed asymmetric references, physical-side mapping, both display modes, crop proof, and a mutation that flips the Raw axis. |
| Unused aperture-gather clear helper | Potentially remove after caller verification. | 6 production-source lines. | Runtime and CI savings **NOT_MEASURED**. | Repeat repository-wide caller search and run the real aperture-gather capture/cleanup owner proof. |
| Physical image-circle and non-parallel visual claims | Strengthen output proof and retain public controls and transitions. | No removal estimate. | No savings claimed; pixel proof may add runtime. | Suppress drawing while leaving diagnostics intact; the browser proof must fail on missing pixels. |

No CI savings are assigned without actual timing records. The pinned baseline lookup returned no reliable per-step GitHub Actions timing.

## Critical contracts to retain

- Fixed asymmetric Ground Glass coordinate references; Raw and Upright orientation; physically correct left/right and top/bottom; source-to-film mapping; crop and pan behavior.
- Canonical finite image-circle and non-parallel conic geometry, including tilted/swung cases and image-plane coverage.
- Agreement between 2D/3D coverage and Ground Glass state while preserving independent geometric references.
- Scheimpflug and physical focus-plane behavior; no lowered task threshold or values unreachable through public controls.
- Real browser frame delivery, Raw/Upright raster relationships, and client-side SPA scene replacement.
- Renderer lifecycle ordering, stale-frame rejection, owned WebGPU device loss/disposal, WebGL fallback, and no replacement before cleanup acknowledgement.
- Public routes, scene availability, and production-preview WebGL-only isolation.
- M7 evidence schemas, exact source provenance, capture/evaluator version roles, fail-closed qualification rules, and the documented limits of private or unreplayable source evidence.

Diagnostics can supplement these contracts. They do not prove rendered pixels by themselves. A frozen historical report never proves that the current renderer or browser behavior works.

## Local-first and GitHub CI responsibilities

### Local CI — primary development validation

Use the local environment for the main implementation feedback loop:

- run focused tests during implementation;
- run full Unit and Integration validation before PR delivery;
- run linting, TypeScript checking, CSS structure checking, and the application build;
- run Playwright tests affected by the change;
- run renderer, visual, or native-GPU qualification on suitable local hardware;
- run broader qualification when the task's risk justifies it.

This does not require every developer to run the entire Playwright suite for every change. The existing `npm run ci:local` runs CSS structure, lint, typecheck, Vitest, and build; `npm run ci:local:e2e` adds its enumerated development E2E specs serially. Keep the per-change selection risk-based.

Any future machine-readable Local CI report should record:

- exact Git commit SHA and whether the worktree is clean, or the explicit dirty state;
- OS/architecture and runtime environment, including Node and relevant tool versions;
- exact commands and configuration used;
- discovered and executed test counts, with pass/fail/skip results;
- timestamps or measured durations where available;
- artifact paths and integrity digests when artifacts are produced.

A local PASS is useful development evidence. It is not equivalent to an independently executed GitHub Required Check. Do not build this report mechanism in PR #358.

### GitHub CI — independent merge gate

Retain independently executed checks for:

- build and TypeScript integrity;
- representative core application regression contracts;
- ordinary Chromium smoke;
- production-preview WebGL isolation;
- current M7V E2E qualification and skip-governance policy;
- automatic historical qualification when a PR changes applicable Evidence or its verification infrastructure.

Do not remove the full `npm run test` Vitest suite from mandatory GitHub CI in this audit or in PR B1/B2. A reduced Core Regression subset is only a later PR B3 investigation. Before changing the mandatory suite, require a documented owner-to-test map, full-versus-subset results on representative changes, mutation evidence that the subset catches protected regressions, independent review of omitted contracts, and measured Actions timing. Local execution alone cannot replace the GitHub merge gate.

The current production-preview Playwright server runs `npm run build && npm run preview`, so the PR workflow already performs a complete application build. Do not add another identical build job without a distinct acceptance need. Preserve the current production-only deploy condition and its dependency on successful CI.

### Tier 1 — Mandatory PR CI

Keep the current application and merge-gate checks:

- lint and typecheck;
- the full configured Vitest suite;
- ordinary Chromium smoke;
- production-preview build and WebGL isolation;
- M7V policy validation and source-declaration/skip-governance checks;
- the stable historical-qualification decision check described below.

Keep M7V mandatory because current E2E source changes can invalidate its declaration, inventory, and skip policy. Its static source policy does not replace browser execution. Keep active M7 evaluator, parser, provenance, source-fetch, and qualification-policy unit tests in full Vitest even when historical report replay moves out of ordinary PR CI.

### Tier 2 — Targeted / risk-based validation

Run owner suites when changed files, the change's dependency closure, or reviewer direction reaches their contracts:

- optics and coordinate changes: fixed-reference geometry and Ground Glass coordinate owners;
- renderer, RTT, lifecycle, or WebGPU changes: Ground Glass host/renderer tests and relevant real-browser specs;
- public route, scene, or control changes: public route/interaction integration and browser specs;
- visual overlay changes: browser pixel/raster checks with asymmetric references;
- native WebGPU changes: the dedicated environment-qualified native lifecycle and failure paths.

Native tests retain their explicit environment and browser requirements. Historical report validation must never substitute for current runtime execution.

### Tier 3 — Historical Qualification / Research Archive

Tier 3 has two execution modes. It must not become manual-only for Evidence-sensitive changes.

#### Mode A — automatic change-triggered qualification

Every PR gets a stable qualification decision check. The decision job examines the PR's complete changed-file set and a reviewed dependency map, then either runs the applicable validator set or records an explicit **not applicable** result. It is created for every PR; do not put a path filter on the whole workflow that can leave a required check permanently pending.

The current repository's relevant inputs and routing are:

| Evidence-sensitive input at the audit baseline | Qualification family and minimum route |
|---|---|
| Frozen M7E/M7F/M7G reports, manifests, capture metadata, and captures under `docs/architecture/GROUND_GLASS_M7E_*`, `GROUND_GLASS_M7F_*`, `GROUND_GLASS_M7G_*`, and `docs/architecture/ground-glass-m7e-r187-gather-b1/**`, `ground-glass-m7f-r187-presentation/**`, `ground-glass-m7g-r187/**` | Route to the corresponding E, F, or G replay. A G report or orchestration change runs G and its E/F child replay. The current commands are `evidence:replay:m7e`, `evidence:replay:m7f`, and `evidence:replay:m7g`; the current CI invokes F directly and G's consolidated report. |
| M7H–M7R reports, schemas, manifests, raw/normalized captures, and artifacts under their matching `GROUND_GLASS_M7H_*` … `GROUND_GLASS_M7R_*` files and `docs/architecture/ground-glass-m7h-*/**` … `ground-glass-m7r-*/**` roots | Run the matching `evidence:check:m7h` through `evidence:check:m7r` command. M7K's schema-v1 and schema-v2 reports are both in scope. |
| M7S–M7U stored reports and captures: `docs/architecture/GROUND_GLASS_M7S_*` through `GROUND_GLASS_M7U_*`, plus `docs/architecture/ground-glass-m7s-learning-drawer/**` and `ground-glass-m7t-interior-corner/**` | The baseline has no `evidence:check:m7s`, `m7t`, or `m7u` package command and no corresponding Pages validator. M7S has an opt-in diagnostic command/config but no evaluator for its timeline schema; M7T/U have no historical report replay command. Treat changes to these stored reports/captures as applicable and **unverified** until PR B2 provides a repeatable validator or a verifiable qualification-result path; do not mark them not applicable or passed. M7U current Swing behavior remains current-runtime E2E coverage and M7V inventory policy, not historical report validation. |
| M7W reports and selected WebGL/renderer-serial artifacts under `GROUND_GLASS_M7W_*` and `docs/architecture/ground-glass-m7w-qualification/**` | Run `evidence:check:m7w`. |
| Family evaluator, normalizer, replay runner, schema, or evidence tests: the family scripts named by `package.json` (including `scripts/run-m7*.mjs`, `scripts/evaluateM7*`, `scripts/normalizeM7*`), corresponding `src/render/testing/groundGlassM7*` or `src/render/webgpu/groundGlassM7*`, and family `src/tests/unit/*M7*` | Run the affected family validator/replay and its evaluator/CLI unit tests. Follow imported shared helpers to the full dependent family set; do not rely on filename matching alone. |
| M7 capture/replay E2E helpers or source inputs: `src/tests/e2e/helpers/groundGlassM7*`, `src/tests/e2e/helpers/m7*`, and matching M7 E2E source | Run the associated family qualification when the source is pinned as an evidence input. Run M7V policy validation for current E2E declaration or skip-governance changes. Current M7G lifecycle runtime E2E remains current-runtime proof, not archive replay. |
| Current E2E policy: `scripts/e2e-spec-policy.mjs`, `scripts/run-m7v-qualification.mjs`, M7V evaluator/policy tests, and relevant E2E specs | Keep `evidence:check:m7v` mandatory on every PR. Do not move it to the manual archive lane. |
| Shared workflow/provenance/tooling: `.github/workflows/pages.yml`, `scripts/fetch-m7k-execution-source.mjs`, shared M7 replay/orchestration or schema helpers, `package.json`, `package-lock.json`, and Playwright configuration used by pinned source runs | Run every family in the reviewed dependency closure. If the closure is unknown or a shared dependency cannot be safely classified, run all applicable historical M7E–M7R and M7W validators plus mandatory M7V. Changes to the routing workflow itself receive the broadest route. |

This table is a baseline path map, not permission to implement a bare glob filter. PR B2 must make the family/dependency manifest explicit from current imports, command references, workflow `--verify-path` declarations, and report inputs. It must account for added, deleted, and renamed files. Shared evaluator, normalizer, provenance-fetch, schema, runtime, dependency-lock, or qualification-manifest changes expand to every dependent family; an unresolved dependency uses the broad route.

For every applicable qualification, keep the verification fail-closed:

- resolve the exact declared source SHA to a commit object; retain and verify any required PR head ref when the source is not reachable from the checked-out history;
- verify each declared source-tree path at that SHA, not merely the existence of the commit;
- verify the pinned runner, tool, evaluator, and normalizer revisions and their source paths;
- verify required evidence manifests, capture/artifact paths, schema versions, and cryptographic digests;
- replay the captured inputs and compare the resulting report, counts, status, and qualification decision against the declared expected result.

A missing retained ref, source object, source path, tool revision, artifact, digest, replay result, or required runner must produce failure or an explicit unverified/could-not-execute result. It must never be treated as a pass. Current M7E/F CLIs were found to verify exact source commit objects but not source-tree paths at those SHAs; preserve their existing object check and add/verify path proof before relying on them in the separated lane.

The Required Check design must avoid both silent bypass and permanently pending checks. Use an always-created, stable-name decision job on each PR and require that check for merge. It must distinguish:

| Qualification decision | Required Check result |
|---|---|
| Applicable and all required validation passes | Success: qualified |
| No Evidence-sensitive input in the complete PR/dependency map | Success: not applicable, with the reason recorded |
| Applicable and a validator fails | Failure |
| Applicable but a validator, source, artifact, tool, or runner could not execute or could not be verified | Failure: unverified/could not execute |

A skipped family job is acceptable only when the always-running decision job has established that the family is not applicable. If the decision job itself cannot classify inputs or collect results, fail the Required Check. Configure and verify the stable required check during PR B2 implementation; branch protection is not changed in PR #358.

#### Mode B — manual or scheduled historical qualification

Keep explicit dispatch for periodic archive-integrity audits, full historical replay, reproducing completed research, investigating provenance/evaluator changes, and reviewer-requested qualification. A scheduled audit may be added later. Manual dispatch complements Mode A; it does not replace its PR merge gate.

Retain historical artifacts, evaluators, source-provenance records, and reproducibility guarantees. Historical report validation only validates the frozen report/evidence contract; it is not proof that the current renderer or browser works.

## PR B1 — GitHub CI Trigger Deduplication

### Scope

- Make PR-triggered validation authoritative for feature branches with an open PR, while avoiding a second substantially identical push run for the same branch update.
- Retain automatic GitHub validation for feature branches pushed before an open PR exists. Do not silently change that state to local-only. Once a PR opens, its PR event must run the required merge gate.
- Preserve PR validation for PRs targeting intended integration branches and retain automatic validation for integration branches pushed before a PR exists.
- Retain push validation on `main` and `production`. Preserve the production deployment condition: only a `push` to `production`, after successful CI, may deploy. Keep `workflow_dispatch`; a manual run must not become a production deployment.
- Review the existing concurrency behavior. Its workflow/ref key does not identify a feature push and its PR run as the same work. Any deduplication must not cancel or omit the required PR check.
- Verify the event matrix for feature push with and without an open PR, PR opened/updated, main push, production push, manual dispatch, and integration-branch workflows. Measure actual before/after Actions runs and durations.

| Event | Current behavior at the pinned baseline | Target behavior for B1 |
|---|---|---|
| Feature branch push before a PR exists | `push` runs CI on every branch. | Keep automatic GitHub validation for that branch head. |
| Feature branch push with an open PR | The `push` and `pull_request` events can start separate CI runs; their concurrency refs differ. | Keep the PR event as the Required Check. Suppress the duplicate push validation only after the matching open PR and active/complete PR check are reliably identified. |
| PR opened or synchronized, including a PR to an integration branch | `pull_request` starts CI. | Continue to run required PR validation for every relevant PR update/base. |
| Push to `main` | `push` starts CI; the deployment job is not selected. | Continue CI on `main`; do not deploy. |
| Push to `production` | `push` starts CI and selects deployment only after CI succeeds. | Preserve CI and the existing gated production deployment. |
| Manual `workflow_dispatch` | Manually starts CI; the deploy condition requires a `push` event. | Preserve manual CI on the selected ref without making it a deployment trigger. |

### Acceptance and rollback

- Each feature head receives automatic GitHub validation before a PR exists; opening or updating a PR creates its required checks.
- The PR Required Check remains stable and reports against the PR event.
- Main and production validation and the existing deploy condition remain intact.
- If the implementation cannot reliably determine whether a matching open PR exists, keep the feature-push validation until the PR validation is confirmed; do not create an unvalidated gap.
- Keep the current workflow triggers and restore them if the event matrix, required checks, or deployment behavior regress. No test or qualification gate is removed in B1.

## PR B2 — Historical Evidence Qualification Separation

### Scope

1. Keep Tier 1 application checks, full Vitest, production build/isolation, M7V current E2E skip governance, and evidence-infrastructure unit tests.
2. Implement Mode A's always-created qualification decision job and reviewed change-to-family/dependency manifest before moving any archive validation.
3. Add automatic Evidence-sensitive routing for M7E/F/G, H–R, and W, with M7V continuing on every PR. Shared changes run all dependent validators; uncertainty runs the broad applicable archive set.
4. Add or retain Mode B manual full replay for archive integrity and research reproduction.
5. Resolve the M7S–M7U gap: add a repeatable validator or a verifiable qualification-result path for applicable stored evidence; until then, the decision check must report such changes as unverified/failing rather than not applicable.
6. Prove exact source commit, retained PR refs, source-tree paths, tool/evaluator/normalizer revisions, artifact digests, and replay output from a clean shallow checkout. Strengthen the known M7E/F path-proof gap before relying on those checks as complete provenance.
7. Remove the standalone M7F replay invocation only after M7G reproduces the same child report and decision. Keep the M7F evaluator, parser/CLI unit tests, replay code, artifacts, and PR 304 source retrieval.
8. Move a frozen report validation only after its automatic trigger, manual replay, required check, and rollback are operational. Keep current runtime regression tests in Tier 1 or Tier 2 with a runnable real-browser path.

### Acceptance and rollback

- Every PR has one stable qualification decision check with explicit qualified/not-applicable/failed/unverified outcomes; applicable evidence cannot be skipped into success.
- Evidence-sensitive dependency and provenance changes trigger every affected family; ambiguous dependencies trigger the broad route.
- M7V stays in mandatory validation on every PR and all existing application/renderer checks remain intact.
- Every moved report reproduces in a clean shallow checkout with exact refs, SHAs, paths, tool revisions, artifacts, and digests verified.
- Introduce the new lane before removing existing mandatory invocations. If required history or evidence is unavailable, leave its current gate in place and repair reproducibility. If a moved check fails, restore the prior invocation and its fetches together. Do not delete evidence or provenance as a fallback.

## PR B3 — Local-First CI and Core Regression Strategy

### Scope

- Improve the existing `npm run ci:local` and `npm run ci:local:e2e` workflow for clear focused/full/affected-subsystem use and reliable result metadata.
- Define local commands for focused tests, full Unit/Integration validation, lint/typecheck/CSS/build, affected E2E, and optional renderer/visual/native qualification. Do not require the full Playwright matrix for every change.
- Prototype a machine-readable local result with SHA, dirty state, environment, tool versions, commands, discovered/executed counts, pass/fail/skip, timestamps/durations, and artifact integrity where appropriate.
- Investigate a future GitHub Core Regression subset while retaining full Vitest in the merge gate. Compare subset versus full-suite results over representative PRs and record mutation results for each protected contract.
- Require an independent coverage review and measured GitHub timing before proposing any reduction to mandatory GitHub tests. A green local report alone does not preserve independent merge-gate assurance.

### Acceptance and rollback

- Local results identify exactly which source state, environment, and test set they represent; partial or dirty runs are declared as such.
- Candidate suite selection is checked against the contract owner map, current test discovery, representative regressions, and mutation evidence.
- No GitHub coverage is removed until a separate review accepts the evidence. Keep the current full Vitest gate if the subset cannot prove equivalent required contracts.
- Local reporting failure or ambiguous metadata must not be represented as a successful complete run.

## PR C — Test Consolidation and Seam Cleanup

### Scope and order

1. Consolidate only the three named redundant Ground Glass orientation declarations into groundGlassCoordinateContract.test.ts. Keep the configured-camera, shifted Architecture Rise, and large-frame orientation declarations in groundGlassRttOrientation.test.ts. Add independent fixed asymmetric references if the keeper cannot preserve each claim.
2. Preserve the distinct owners in groundGlassCoverage.test.ts, imageCircleGeometry.test.ts, and physicalLensCoverageGeometry.test.ts. Do not merge them based on similar file names; they cover canonical state, direct circle mesh geometry, and generic circle/conic renderer geometry.
3. Strengthen physical-image-circle.spec.ts and nonparallel-coverage.spec.ts so their visual-rendering claims observe rendered pixels or an independent image reference. Keep current public controls, legends, and circle-to-conic transitions.
4. Remove clearGroundGlassApertureGatherCaptureForTest only after a complete caller search and proof that aperture-gather capture/cleanup remains supported through the real owner.
5. Fix the three M7P declaration weaknesses (trace-loss vs digest, GPU vs renderer-causation, bounded duration vs Canvas observation), the M7R raw-failure classification claim, and the M7V historical-report SHA claim. Give each guard its own mutation.
6. Retain the M3 WebGPU control global, failure injection, async barriers, M6 fixture controls, and M7N lifecycle trace until moved proof demonstrates equivalent rare failure reproduction and production isolation. Consider relocating helpers to development-only instrumentation only with emitted-bundle evidence.
7. Keep GroundGlassRenderHostStateProvider owner injection unless tests retain equivalent host ownership and multi-channel evidence.

### Preservation proof

Before removing or consolidating each group:

- name the original defect and prove the old assertion fails on it;
- run the keeper and sibling owner suites;
- use a fixed asymmetric physical reference for Raw/Upright and crop transformations;
- deliberately suppress circle/conic drawing while keeping diagnostic state intact; the improved browser proof must fail;
- deliberately accept a stale held frame, bypass device-loss cleanup, and remount before SPA cleanup acknowledgement; the relevant runtime keepers must fail;
- verify production preview excludes the opt-in WebGPU test global and preserves WebGL rendering;
- mutate each M7P/R/V input separately so no sibling mutation masks a missing validator;
- have an independent reviewer compare removed declarations against the keeper proof for that contract.

Use one focused cleanup batch per owner group. Stop and restore a removed assertion if any independent contract lacks a failing keeper. Record test/support/production line deltas and actual targeted runtime for each batch.

### Acceptance criteria

- No fixed asymmetric orientation, physical coverage, focus-plane, lifecycle, or user-flow contract loses its only proof.
- All retained visual claims have an observable rendered-output assertion.
- The existing critical browser/GPU paths remain runnable and conditionally skipped only for documented environment requirements.
- Production-only behavior remains isolated; no new production test global or injection hook is added.
- Independent preservation review records each contract-to-keeper mapping and mutation result.
- Cost reports distinguish measured test/runtime savings from line-count estimates.

## Permanent test-authoring rules proposed

1. Before adding a test, state its observable contract, a credible regression, its production owner, and why existing proof misses that regression.
2. Give each contract one primary owner at its strongest boundary. Add another layer only for a distinct user-flow, transport, environment, or lifecycle risk.
3. Use fixed independent expected values. Use asymmetric spatial references for orientation and crop work; do not infer correctness from two diagnostics derived from the same state.
4. A rendered-output claim needs raster/image evidence or real user-visible behavior. Attributes and legends can supplement that proof.
5. Current-runtime regression tests must fail on the old defect. Synthetic fixtures are valid for parser/evaluator contracts only when the fixture does not fabricate the behavior being asserted.
6. Test-only exports, globals, wrappers, barriers, and injection hooks require a named rare failure they make reproducible, explicit caller inventory, a development/opt-in gate, and production-isolation proof.
7. A historical qualification artifact records the capture source SHA, tool/evaluator/normalizer source roles, exact required paths, artifact digest, environment, and limitations. Run its applicable qualification automatically when the evidence or verifier dependency changes; retain manual full replay for archive qualification.
8. Mark environment-gated, native-GPU, research, benchmark, production-preview, and diagnostic-only tests by their actual discovery/trigger path. Keep M7V current E2E policy validation mandatory; do not count a test as ordinary CI coverage when the workflow does not execute it.
9. Measure runtime for changed/added suites where a representative command exists. State NOT_MEASURED when no reliable timing exists; timeouts are not runtime measurements.
10. After consolidation, perform an independent preservation review and targeted mutation against the original defect before claiming the keeper is equivalent.
11. Local validation reports identify the exact commit, dirty state, environment, tools, commands, test counts, outcomes, timing, and artifact integrity where available. Treat them as local evidence, not a replacement for GitHub Required Checks.

## Recommended content for a future test-audit skill

Do not add the skill in PR A. A later repository skill should make the audit reproducible by requiring: a pinned base SHA and runner inventory; per-runner discovery versus repository file counts; contract, credible-regression, overlap, and coupling fields for each declaration/group; the R/F/C/D/NEEDS_EVIDENCE rubric; exact CI command/provenance mapping; current-runtime versus evaluator versus historical replay separation; `NOT_MEASURED` for unsupported costs; explicit unreviewed scope; and a keeper/mutation/rollback proof before consolidation. It should teach the methodology without importing OpenClaw-specific commands or infrastructure.

## Audit gaps carried forward

The ledger records unreviewed renderer declarations explicitly. No full E2E matrix, native WebGPU capture, M7S Playwright discovery, or RQ qualification was run. M7L and M7M raw provenance has known private-local gaps. Emitted production-bundle contribution from test-seam source, historical CI timing, and browser suite runtime are NOT_MEASURED. These are limits on the plan, not reasons to delete the related checks.
