# Test Audit Plan

## Executive findings

The pinned baseline has 349 Vitest files and 4,279 collected unit/integration test declarations, plus 276 ordinary Chromium cases and four separate production-preview cases. The complete configured Vitest run passed at the pinned SHA. M7 adds 495 collected Vitest cases across B–W plus native-gated runtime declarations. The audit found a large historical-evidence surface in mandatory PR CI, but its source-provenance fetches and archive checks protect reproducibility contracts that must move together.

The safest high-confidence reductions are narrow:

1. The direct M7F replay step duplicates the M7F child replay performed by the M7G consolidated evidence evaluator. Remove only that duplicate CI invocation after M7G reproduces the same fresh report from a clean shallow checkout. Keep the evaluator, M7F parser/CLI unit contracts, historical artifacts, and PR 304 source retrieval.
2. Three assertions in groundGlassRttOrientation.test.ts repeat fixed orientation/coordinate checks owned more independently by groundGlassCoordinateContract.test.ts. Candidate consolidation is about 60 test lines; retain the other orientation cases and all fixed asymmetric coordinates, both display modes, and crop proof.
3. clearGroundGlassApertureGatherCaptureForTest has six source lines and no caller was found. It is a later removal candidate after a full caller check and focused aperture-gather proof.

Two Ground Glass browser suites exercise public controls but use diagnostic attributes and legends as their main output proof. Preserve their interaction coverage and strengthen the proof of rendered overlay pixels before claiming visual rendering coverage.

Do not remove stored evidence, provenance checks, evaluator unit coverage, native lifecycle controls, or public renderer regressions as part of PR A. M7L/M source/raw-capture limits, M7S discovery, exact production-bundle impact, and browser/CI step timing remain explicit uncertainties. Fix the three misleading M7P claims, M7R raw-failure derivation claim, and M7V SHA claim before relying on those descriptions as proof.

## Highest-priority cleanup candidates

| Candidate | Intended action | Measured size | Expected cost change | Proof and risk |
|---|---|---|---|---|
| .github/workflows/pages.yml direct M7F replay | Consolidate the invocation into M7G’s existing child replay; retain M7F replay tooling and unit/CLI tests | 0 test/support/production lines; removes one standalone workflow invocation | CI seconds NOT_MEASURED; one duplicate invocation is removed | M7G currently runs M7E and M7F child replay and checks their reports. Verify exact invocation and report equality before removing the direct step. |
| groundGlassRttOrientation.test.ts three assertions | Consolidate only the fixed orientation/film-coordinate checks into groundGlassCoordinateContract.test.ts | Approximately 60 test lines; no production/support lines identified | Test runtime savings NOT_MEASURED | Keep the fixed asymmetric references, physical-side mapping, both display modes, and crop proof. Other derived-scene and large-frame orientation cases remain in the orientation suite. |
| clearGroundGlassApertureGatherCaptureForTest | Potentially delete after caller verification | 6 production-source lines | Runtime or CI savings NOT_MEASURED | No production/test/research caller was found. Repeat a repository-wide caller search and run the aperture-gather owner test/evidence path before removal. |
| physical-image-circle.spec.ts and nonparallel-coverage.spec.ts visual claims | Fix proof; retain public workflow assertions | No removal estimate | No savings claimed; additional raster proof may add cost | Add independent rendered-output observation that fails if the overlay draw is suppressed while diagnostics remain correct. Preserve public movement, scene, and mode transitions. |

No CI savings are assigned to a candidate without a measured timing record. GitHub status/run lookup returned no timing record for the baseline commit.

## Critical contracts to retain

- Fixed, asymmetric Ground Glass coordinate references; Raw and Upright orientation; physically correct left/right and top/bottom; source-to-film mapping; crop and pan behavior.
- Canonical finite image-circle and non-parallel conic geometry, including tilted/swung cases and image-plane coverage.
- Agreement between 2D/3D coverage and Ground Glass state while preserving independent geometric references.
- Scheimpflug and physical focus-plane behavior; no threshold reduction or control values unreachable by public steps.
- Actual browser frame delivery, Raw/Upright raster relationships, and client-side SPA scene replacement.
- Renderer lifecycle ordering, stale-frame rejection, owned WebGPU device loss/disposal, WebGL fallback, and no replacement before cleanup acknowledgement.
- Public routes, scene availability, and production-preview WebGL-only isolation.
- M7 evidence schemas, exact source provenance, capture/evaluator version roles, fail-closed qualification rules, and documented limits of private or unreplayable source evidence.

Diagnostic attributes can supplement these contracts. They do not establish rendered pixels by themselves.

## CI tier proposal

### Tier 1 — Mandatory PR CI

Keep the current application checks:

- npm run lint
- npm run typecheck
- npm run test, including the full configured Vitest suite
- ordinary Chromium smoke on smoke.spec.ts
- production-preview WebGL isolation, including its current npm run build and preview server
- M7V E2E qualification/skip-governance policy validation, because it constrains the current declared E2E lane

The production-preview test already runs a complete npm run build through its webServer command. Do not add a second build invocation without a distinct acceptance need. Keep production WebGPU exclusion, protected deployment, and the production isolation check intact.

Keep Vitest contracts for active M7 evaluators, parsers, provenance handling, source fetching, and qualification policy in the mandatory unit/integration run even when a report replay moves to Tier 3.

Keep M7V source-declaration and skip/fixme policy validation in Tier 1 because current E2E source changes can invalidate it. Keep M7A/M7B native failure-host and M7G stale-frame browser tests in targeted renderer validation, and M7U public Swing tests in targeted ordinary Chromium validation. M7V inventory checks do not replace these runtime tests.

### Tier 2 — Targeted / Risk-Based Validation

Select owner suites when changed files or a reviewer request reaches their contract:

- optics/coordinate changes: fixed-reference geometry and Ground Glass coordinate owners;
- renderer, RTT, lifecycle, or WebGPU changes: Ground Glass host/renderer tests and relevant real-browser specs;
- public route, scene, or control changes: public route/interaction integration and browser specs;
- visual overlay changes: browser pixel/raster checks with asymmetric references.

Native WebGPU tests currently have explicit environment and browser requirements. Keep them addressable through dedicated configs/commands and a documented renderer qualification path. Their historical report validators must never substitute for executing current runtime behavior.

### Tier 3 — Historical Qualification / Research Archive

Move only frozen capture replay and historical report qualification that cannot be invalidated meaningfully by ordinary application edits. Candidates are M7G report replay (with its M7E/F children), M7H–M7R report checks, and M7W report validation. Retain original artifacts and evaluator code. Move each history fetch, retained PR ref, exact source SHA/tree-path check, and replay command with its qualification step. Keep M7V in Tier 1. The M7E/F CLIs currently verify exact source commit objects but were not found to check tree paths at those SHAs; preserve the object checks and document any path-check strengthening separately.

Use an explicitly invoked workflow against a clean shallow checkout. It must fail closed if a retained ref, source object, source path, capture artifact, digest, or declared tool revision is unavailable. Keep a simple way to run the same command locally. Retain committed historical files and provenance records.

## PR B — CI and Historical Evidence Separation

### Scope

1. Keep Tier 1 application checks, the production build/isolation path, M7V current E2E skip governance, and all Vitest evidence-infrastructure tests.
2. Add an explicit Tier 3 manual qualification workflow for M7G report replay and H–R/W historical report validation. Initially add and validate the lane while existing mandatory report steps remain.
3. Remove only the direct M7F replay invocation after confirming the M7G child replay reports the same pinned source, exit state, scenario counts, and qualification decision. Keep M7E/F CLI tests, replay tooling, artifacts, and retained source retrieval.
4. After the manual lane passes from a clean shallow checkout, move each eligible report step and its complete source-provenance fetch set together. Keep every Category 1 current-runtime regression in Tier 1 or Tier 2 with a runnable browser proof path.
5. Preserve M7V in Tier 1. Move M7W's frozen ordinary-WebGL/renderer-serial report validation to Tier 3; keep its evaluator tests in Tier 1. M7W does not rerun current app behavior.

### Rollback

Land the manual lane before removing mandatory steps. If a retained source ref or artifact is unavailable, leave the existing gate in place, repair reproducibility, and rerun the archive lane. If moved validation fails, restore the original mandatory invocation and fetches as one unit. Do not delete archived files or provenance as a fallback.

### Acceptance criteria

- Tier 1 still runs lint, typecheck, all Vitest tests (including M7 evidence-infrastructure tests), ordinary Chromium smoke, production-preview WebGL isolation/build, and M7V skip-governance/discovery validation.
- Current-runtime contracts retain effective runtime proof; static report validation is not presented as a replacement.
- M7A/M7B native failure-host and M7G stale-frame tests remain runnable in targeted native WebGPU validation; M7U public Swing remains in targeted ordinary Chromium validation.
- Every moved report passes from a clean shallow checkout with its required exact source commit object, source-tree paths, retained PR ref, evaluator/tool revision, artifacts, and digest checked.
- The manual lane can reproduce M7E/M7F child replay and H–R/W archive reports from preserved artifacts. It fails closed if any ref, commit, path, input, digest, or source role is unavailable.
- Remove the direct M7F step only after equivalence with the M7G child replay is proven; retain the M7F replay implementation and tests.
- PR body and workflow document all retained PR heads, exact SHAs, source roles, and commands.
- Before/after CI timings are recorded from actual workflow steps; unavailable measurements remain NOT_MEASURED.
- A rollback of routing edits restores the original fail-closed validation without changing qualification criteria.

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
7. A historical qualification artifact records the capture source SHA, tool/evaluator/normalizer source roles, exact required paths, artifact digest, environment, and limitations. Keep replayability checks with the archive lane.
8. Mark environment-gated, native-GPU, research, benchmark, production-preview, and diagnostic-only tests by their actual discovery/trigger path. Do not count a test as ordinary CI coverage when the workflow does not execute it.
9. Measure runtime for changed/added suites where a representative command exists. State NOT_MEASURED when no reliable timing exists; timeouts are not runtime measurements.
10. After consolidation, perform an independent preservation review and targeted mutation against the original defect before claiming the keeper is equivalent.

## Recommended content for a future test-audit skill

Do not add the skill in PR A. A later repository skill should make the audit reproducible by requiring: a pinned base SHA and runner inventory; per-runner discovery versus repository file counts; contract, credible-regression, overlap, and coupling fields for each declaration/group; the R/F/C/D/NEEDS_EVIDENCE rubric; exact CI command/provenance mapping; current-runtime versus evaluator versus historical replay separation; `NOT_MEASURED` for unsupported costs; explicit unreviewed scope; and a keeper/mutation/rollback proof before consolidation. It should teach the methodology without importing OpenClaw-specific commands or infrastructure.

## Audit gaps carried forward

The ledger records unreviewed renderer declarations explicitly. No full E2E matrix, native WebGPU capture, M7S Playwright discovery, or RQ qualification was run. M7L and M7M raw provenance has known private-local gaps. Emitted production-bundle contribution from test-seam source, historical CI timing, and browser suite runtime are NOT_MEASURED. These are limits on the plan, not reasons to delete the related checks.
