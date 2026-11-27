# CI command reference

This is the canonical interface for developers and agents. All 75 registered scripts remain compatible; a rarely run historical command is not necessarily unused. See [Local CI architecture](LOCAL_CI_ARCHITECTURE.md) for report semantics and [closeout](CI_SIMPLIFICATION_CLOSEOUT.md) for authority and outcomes.

## Tier 1: everyday development

```bash
npm run dev
npm run ci:local:focused -- --tests src/tests/unit/<test-file>.test.ts
npm run ci:local:focused -- --owner <owner-id>
npm run ci:local:affected -- --base origin/main
npm run ci:local
```

Start the server with `dev`. During implementation choose a real test file or an owner ID from `scripts/local-ci/owners.json` for quick feedback. Fetch the base and use Affected when the changed scope is understood; it includes committed and worktree changes. Read its report: provisional or unmapped ownership, missing required browser checks, unstable source, or other limitations may make the result `INCOMPLETE`, not a full pass. Use `--with-e2e` when owner-required browser coverage is needed. Add explicit browser/native proof where the contract requires it. Run full local CI when appropriate for the change; it covers CSS, lint, typecheck, full Vitest and build, but not browser, historical, or native qualification. GitHub PR validation is independently authoritative. Do not run the full suite after every small iteration.

## Tier 2: specialized validation

`npm run test` is the full Vitest runner; it accepts Vitest arguments. `npm run lint`, `npm run typecheck`, `npm run check:css`, and `npm run build` are individual checks (`build` includes typechecking). `npm run test:e2e` is the low-level Playwright entry point and can run a broad browser suite. `npm run ci:local:e2e` orchestrates full local CI plus the extended serial development E2E suite and may be expensive. Use a specific browser target for ordinary changes rather than the whole matrix. `npm run ci:local:core` is a non-authoritative pilot, not a replacement for full Vitest. These commands differ in scope and none substitutes for the authoritative GitHub PR job.

```bash
npm run ci:local:focused -- --e2e-spec src/tests/e2e/smoke.spec.ts
npm run ci:local:focused -- --e2e-spec src/tests/e2e/architecture-rise-webgpu-production.spec.ts --production-preview
npm run ci:local:focused -- --e2e-spec src/tests/e2e/architecture-rise-webgpu-validation.spec.ts --native-webgpu
```

Production Preview uses the dedicated production config and checked build by default. The native example sets its mapped `OBSERVER_NATIVE_WEBGPU_REQUIRED=1` assertion control. Native selection uses headed system Chrome, an available native WebGPU environment, and the selected spec's required-backend assertion; skipped or unproven cases are incomplete. Research-specific gates and feature flags may additionally be required: `--native-webgpu` alone does not satisfy them. See [Local CI architecture](LOCAL_CI_ARCHITECTURE.md) and the relevant research report; [C5](TEST_CONSOLIDATION_C5.md) records a blocked native M7G preflight.

## Tier 3: research, evidence and maintenance

| Family | Purpose, prerequisites, automation and effects |
| --- | --- |
| `evidence:*`, `e2e:*:m7*` | Historical replay, checks, captures and normalization; pinned source trees, stored evidence and sometimes browser/native prerequisites apply. Some validators run automatically through [historical qualification](HISTORICAL_EVIDENCE_QUALIFICATION.md) or ordinary CI. Capture/normalization and migration can write artifacts; read the named scripts and family reports before running. No deployment. |
| `render-quality:*` | Research capture, verify and image measurements; needs relevant browser, fixtures and GPU setup. Captures/measurements can write artifacts under render-quality locations. See `docs/render-quality/`; not ordinary CI or deployment. |
| `benchmark:*` | Observer/scene capacity measurements, with appropriate local hardware/browser prerequisites; may produce measurement outputs. See `docs/` and script help. Not ordinary CI or deployment. |
| `dream-loop:*` | Visual capture and guard tooling; needs the scene/server and configured output paths; can write images/reports. See `docs/` and script help. Not ordinary CI or deployment. |
| `*still-life-studio*` | Scene-specific build and browser qualification; requires relevant browser and scene setup, can write build/test output. Not ordinary CI or deployment. |
| `promote:*` | [Release promotion](../../README.md#cicd-and-deployment): preflight checks remote refs; production promotion changes the production branch and can trigger deployment. Requires the release prerequisites and authorization. |
| `preview`, `test:watch` | Interactive local server or Vitest watch mode; no deployment. |

Native renderer research also uses selected `test:e2e` or focused routes with the specific report's environment gates; it is not an unconditional CI claim. Builds and tests may write local outputs. The `build:production-preview:after-typecheck` internal command is consumed by the CI preview config only after its successful typecheck; do not use it as a standalone checked build.

## Complete registered inventory

The target column reproduces the package implementation. References list exact `npm run <name>` or `npm test` mentions in tracked workflows and documentation; script consumers are direct npm invocations in package scripts. `—` means no such textual reference found, not unused. Programmatic consumers include `scripts/ci-local.mjs`, `playwright.production.config.ts`, `scripts/run-historical-qualification.mjs`, `scripts/historical-evidence-manifest.json`, and historical evaluator tests; they may invoke a target or check registration without an npm command string. Historical `evidence:*` and M7 entries depend on family-specific reports, pinned sources and validators in [qualification](HISTORICAL_EVIDENCE_QUALIFICATION.md) and [audit ledger](TEST_AUDIT_LEDGER.md); inspect those before changing any entry. Tier 1 entries are prominent above; all others are specialist/reference entries. Documentation references show up to three exact matches; additional matches are counted.

| Command | Implementation target | Audience / tier | Direct workflow / script consumers | Documentation references |
| --- | --- | --- | --- | --- |
| `dev` | `vite` | Developer / 1 | Workflow: —; scripts: — | `README.md`, `docs/ATOMIC_TASK_INVENTORY.md`, `docs/TASK_INVENTORY.md` (+3) |
| `build` | `tsc -b && vite build` | Developer or CI / 2 | Workflow: `.github/workflows/pages.yml`; scripts: — | `.agents/status/interior-corner-12c.md`, `AGENTS.md`, `docs/TASK_INVENTORY.md` (+33) |
| `build:production-preview:after-typecheck` | `vite build` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/testing/CI_RUNTIME_OPTIMIZATION_DECISION.md` |
| `build:still-life-studio-qualification` | `tsc -b && vite build --mode still-life-studio-qualification` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/STILL_LIFE_STUDIO_MVP.md` |
| `evidence:replay:m7e` | `node ./scripts/run-m7e-offline-replay.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7E_R187_GATHER_B1.md`, `docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE.md` |
| `evidence:replay:m7f` | `node ./scripts/run-m7f-presentation-evidence-replay.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `evidence:replay:m7g` | `node ./scripts/run-m7g-consolidation.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION.md` |
| `evidence:report:m7g` | `node ./scripts/run-m7g-consolidation.mjs --diagnostic` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION.md`, `docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `e2e:triage:m7h` | `node ./scripts/run-m7h-triage.mjs --inventory` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE.md` |
| `e2e:compare:m7h` | `node ./scripts/run-m7h-triage.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE.md` |
| `evidence:check:m7h` | `node ./scripts/run-m7h-triage.mjs --diagnostic` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7H_BROAD_E2E_TRIAGE.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `evidence:check:m7i` | `node ./scripts/run-m7i-remediation.mjs --diagnostic` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/testing/TEST_AUDIT_LEDGER.md` |
| `evidence:check:m7j` | `node ./scripts/run-m7j-four-worker-stability.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7J_FOUR_WORKER_STABILITY.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `e2e:run:m7k` | `node ./scripts/run-m7k-broad-e2e.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION.md` |
| `evidence:check:m7k` | `node ./scripts/run-m7k-qualification.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION.md`, `docs/architecture/GROUND_GLASS_M7R_E2E_RECOVERY.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `evidence:require-qualified:m7k` | `node ./scripts/run-m7k-qualification.mjs --require-qualified` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7K_BROAD_E2E_QUALIFICATION.md` |
| `evidence:check:m7l` | `node ./scripts/run-m7l-learning-drawer-remediation.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/testing/TEST_AUDIT_LEDGER.md` |
| `evidence:check:m7m` | `node ./scripts/run-m7m-scene-readiness.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7M_SCENE_READINESS.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `evidence:check:m7n` | `node ./scripts/run-m7n-renderer-lifecycle.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7N_RENDERER_LIFECYCLE.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `e2e:capture:m7o` | `node ./scripts/run-m7o-canvas-assertion-timing.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:normalize:m7o` | `node ./scripts/normalizeM7oCanvasAssertionTimingCapture.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:normalize:m7o:matrix` | `node ./scripts/normalizeM7oCanvasAssertionTimingMatrix.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:check:m7o` | `node ./scripts/run-m7o-evidence.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7O_CANVAS_ASSERTION_TIMING.md`, `docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `e2e:capture:m7p` | `node ./scripts/run-m7p-assertion-scheduling.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:normalize:m7p` | `node ./scripts/normalizeM7pAssertionSchedulingCapture.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:check:m7p` | `node ./scripts/run-m7p-evidence.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7P_ASSERTION_SCHEDULING.md`, `docs/testing/TEST_AUDIT_LEDGER.md`, `docs/testing/TEST_CONSOLIDATION_C4.md` |
| `e2e:capture:m7q` | `node ./scripts/run-m7q-light-peer-trace-ab.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:normalize:m7q` | `node ./scripts/normalizeM7qLightPeerTraceAb.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:check:m7q` | `node ./scripts/run-m7q-evidence.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7Q_LIGHT_PEER_TRACE_AB.md`, `docs/architecture/GROUND_GLASS_M7R_E2E_RECOVERY.md`, `docs/testing/TEST_AUDIT_LEDGER.md` |
| `evidence:normalize:m7r` | `node ./scripts/normalizeM7rBroadE2eCapture.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:check:m7r` | `node ./scripts/run-m7r-evidence.mjs` | Research or maintenance / 3 | Workflow: `.github/workflows/pages.yml`; scripts: — | `docs/architecture/GROUND_GLASS_M7R_E2E_RECOVERY.md`, `docs/architecture/GROUND_GLASS_M7T_INTERIOR_CORNER_READINESS.md`, `docs/testing/CORE_REGRESSION_OMITTED_TESTS.md` (+2) |
| `evidence:check:m7v` | `node ./scripts/run-m7v-qualification.mjs validate-policy` | Research or maintenance / 3 | Workflow: `.github/workflows/pages.yml`; scripts: — | `docs/architecture/GROUND_GLASS_M7V_E2E_QUALIFICATION_LANES.md`, `docs/render-quality/RQ2_1_NATIVE_M3_REVALIDATION.md`, `docs/render-quality/RQ2_ARCHITECTURE_RISE_QUALITY_UPGRADE.md` (+9) |
| `evidence:require-approved:m7v` | `node ./scripts/run-m7v-qualification.mjs require-approved` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7V_E2E_QUALIFICATION_LANES.md` |
| `evidence:require-qualified:m7v` | `node ./scripts/run-m7v-qualification.mjs require-qualified` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7V_E2E_QUALIFICATION_LANES.md` |
| `evidence:normalize:m7w` | `node ./scripts/normalizeM7wQualificationCapture.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `evidence:check:m7w` | `node ./scripts/run-m7w-evidence.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7W_WEBGL_QUALIFICATION.md`, `docs/render-quality/RQ2_1_NATIVE_M3_REVALIDATION.md`, `docs/render-quality/RQ2_ARCHITECTURE_RISE_QUALITY_UPGRADE.md` (+6) |
| `evidence:qualification:historical` | `node ./scripts/run-historical-qualification.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/testing/HISTORICAL_EVIDENCE_QUALIFICATION.md`, `docs/testing/TEST_CONSOLIDATION_C4.md` |
| `evidence:migrate:m7e` | `node --experimental-strip-types ./scripts/migrateM7ePersistedCaptures.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7E_R187_GATHER_B1.md` |
| `benchmark:observer-backends` | `node ./scripts/run-observer-backend-benchmark.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/VISUAL_PIPELINE_READINESS.md`, `docs/architecture/architecture-rise-v2-pr-sequence.md`, `docs/benchmarks/OBSERVER_BACKEND_COMPARISON.md` |
| `benchmark:scene-capacity` | `node ./scripts/run-scene-capacity-benchmark.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/DREAM_LOOP_VISUAL_WORKFLOW.md`, `docs/VISUAL_PIPELINE_READINESS.md`, `docs/architecture/GROUND_GLASS_M7V_E2E_QUALIFICATION_LANES.md` (+5) |
| `benchmark:scene-capacity:hardware` | `node ./scripts/run-scene-capacity-hardware-benchmark.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/DREAM_LOOP_VISUAL_WORKFLOW.md`, `docs/benchmarks/SCENE_CAPACITY.md` |
| `dream-loop:capture` | `node ./scripts/dream-loop/capture.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `.agents/skills/vcs-dream-loop-visual-quality/SKILL.md`, `docs/DREAM_LOOP_VISUAL_WORKFLOW.md`, `docs/LOCAL_REFLECTION_TECHNIQUE_DECISION.md` (+3) |
| `dream-loop:guard` | `node ./scripts/dream-loop/guard.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `.agents/skills/vcs-dream-loop-visual-quality/SKILL.md`, `docs/DREAM_LOOP_VISUAL_WORKFLOW.md`, `docs/render-quality/PROCEDURAL_MATERIALS_INTERIOR_CORNER_PILOT.md` |
| `render-quality:rq1:capture` | `node ./scripts/render-quality/rq1-capture.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ1_BASELINE_AND_COMPARISON.md` |
| `render-quality:rq1:check` | `node ./scripts/render-quality/rq1-check.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ1_BASELINE_AND_COMPARISON.md`, `docs/render-quality/RQ2_ARCHITECTURE_RISE_QUALITY_UPGRADE.md`, `docs/render-quality/RQ3B_NONPARALLEL_NATURAL_VIGNETTING.md` (+3) |
| `render-quality:rq3d:measure` | `node ./scripts/render-quality/rq3d-macro-image-metrics.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3D_MACRO_DOF_VISUAL_READABILITY.md` |
| `render-quality:rq3a:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3a-runs/current src/tests/render-quality/e2e/render-quality-rq3a-capture.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3A_WEBGL_DOF_EDGE_QUALITY.md`, `docs/render-quality/RQ3D_MACRO_DOF_VISUAL_READABILITY.md` |
| `render-quality:rq3e:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3e-runs/current src/tests/render-quality/e2e/rq3e-macro-oblique-capture.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3E_MACRO_OBLIQUE_VISUAL_READABILITY.md` |
| `render-quality:rq3e:measure` | `node ./scripts/render-quality/rq3e-macro-image-metrics.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3E_MACRO_OBLIQUE_VISUAL_READABILITY.md` |
| `render-quality:rq3f:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3f-runs/current src/tests/render-quality/e2e/rq3f-macro-compound-capture.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3F_MACRO_COMPOUND_VISUAL_READABILITY.md` |
| `render-quality:rq3f:measure` | `node ./scripts/render-quality/rq3f-macro-image-metrics.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3F_MACRO_COMPOUND_VISUAL_READABILITY.md` |
| `render-quality:rq3g:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3g-runs/current src/tests/render-quality/e2e/rq3g-macro-bellows-capture.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3G_MACRO_BELLOWS_VISUAL_READABILITY.md` |
| `render-quality:rq3g:measure` | `node ./scripts/render-quality/rq3g-macro-image-metrics.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3G_MACRO_BELLOWS_VISUAL_READABILITY.md` |
| `render-quality:rq3d:capture-support` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3a-runs/support-current src/tests/render-quality/e2e/rq3d-macro-capture-support.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3D_MACRO_DOF_VISUAL_READABILITY.md` |
| `render-quality:rq3a:verify` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 src/tests/render-quality/e2e/ground-glass-dof-edge.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ3A_WEBGL_DOF_EDGE_QUALITY.md` |
| `render-quality:rq3b:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3b-runs/current src/tests/render-quality/e2e/rq3b-nonparallel-illumination-capture.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `render-quality:rq3b:gpu-verify` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3b-runs/current src/tests/render-quality/e2e/ground-glass-natural-illumination-gpu.spec.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `render-quality:rq2:capture` | `node ./scripts/render-quality/rq1-capture.mjs --profile rq2` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ2_ARCHITECTURE_RISE_QUALITY_UPGRADE.md` |
| `render-quality:rq2:check` | `node ./scripts/render-quality/rq1-check.mjs --profile rq2` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/render-quality/RQ2_ARCHITECTURE_RISE_QUALITY_UPGRADE.md` |
| `test` | `node ./scripts/test.mjs` | Developer or CI / 2 | Workflow: `.github/workflows/pages-artifact-pilot.yml`, `.github/workflows/pages.yml`; scripts: — | `AGENTS.md`, `README.md`, `docs/ARCHITECTURE_DIAGNOSIS.md` (+62) |
| `test:watch` | `vitest` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `test:e2e` | `playwright test` | Developer or CI / 2 | Workflow: `.github/workflows/pages-artifact-pilot.yml`, `.github/workflows/pages.yml`; scripts: — | `README.md`, `docs/ARCHITECTURE_DIAGNOSIS.md`, `docs/SCENE_VARIATION_FOUNDATION.md` (+29) |
| `test:e2e:still-life-studio` | `playwright test --config=playwright.still-life-studio.config.ts` | Research or maintenance / 3 | Workflow: —; scripts: — | — |
| `test:e2e:m7j-renderer` | `playwright test --project=chromium-renderer-serial --no-deps --workers=1 --retries=0 --reporter=list,json` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/architecture/GROUND_GLASS_M7J_FOUR_WORKER_STABILITY.md` |
| `lint` | `eslint . --max-warnings=0` | Developer or CI / 2 | Workflow: `.github/workflows/pages.yml`; scripts: — | `.agents/status/interior-corner-12b.md`, `.agents/status/interior-corner-12c.md`, `AGENTS.md` (+41) |
| `typecheck` | `tsc -b` | Developer or CI / 2 | Workflow: `.github/workflows/pages.yml`; scripts: — | `.agents/status/interior-corner-12b.md`, `.agents/status/interior-corner-12c.md`, `AGENTS.md` (+46) |
| `check:css` | `node ./scripts/check-css-structure.mjs` | Developer or CI / 2 | Workflow: —; scripts: — | `.agents/status/interior-corner-12c.md`, `AGENTS.md`, `docs/VISUAL_PIPELINE_READINESS.md` (+26) |
| `ci:local` | `node ./scripts/ci-local.mjs` | Developer / 1 | Workflow: —; scripts: — | `README.md`, `docs/architecture/THREEJS_TRANSPARENCY_UPSTREAM_REPRODUCTION.md`, `docs/development/fringe-club-stage-2n-b-vcs-validation/README.md` (+6) |
| `ci:local:e2e` | `node ./scripts/ci-local.mjs --with-e2e` | Developer or CI / 2 | Workflow: —; scripts: — | `.agents/status/interior-corner-12b.md`, `.agents/status/interior-corner-12c.md`, `.agents/status/interior-corner-12d.md` (+13) |
| `ci:local:focused` | `node ./scripts/ci-local.mjs --mode=focused` | Developer / 1 | Workflow: —; scripts: — | `README.md`, `docs/testing/LOCAL_CI_ARCHITECTURE.md` |
| `ci:local:affected` | `node ./scripts/ci-local.mjs --mode=affected` | Developer / 1 | Workflow: —; scripts: — | `README.md`, `docs/testing/LOCAL_CI_ARCHITECTURE.md`, `docs/testing/TEST_CONSOLIDATION_C3.md` |
| `ci:local:core` | `node ./scripts/ci-local.mjs --mode=core` | Developer or CI / 2 | Workflow: —; scripts: — | `docs/testing/CORE_REGRESSION_CANDIDATES.md`, `docs/testing/CORE_REGRESSION_EVALUATION.md`, `docs/testing/CORE_REGRESSION_PRESERVATION_AUDIT.md` (+1) |
| `promote:preflight` | `node ./scripts/promote-production.mjs -- --check` | Research or maintenance / 3 | Workflow: —; scripts: — | `AGENTS.md`, `README.md`, `docs/AI_AGENT_WORKFLOW.md` |
| `promote:production` | `node ./scripts/promote-production.mjs` | Research or maintenance / 3 | Workflow: —; scripts: — | `AGENTS.md`, `README.md`, `docs/AI_AGENT_WORKFLOW.md` |
| `preview` | `vite preview` | Research or maintenance / 3 | Workflow: —; scripts: — | `docs/testing/CI_RUNTIME_OPTIMIZATION_DECISION.md`, `docs/testing/CI_RUNTIME_PROFILE.md`, `docs/testing/TEST_AUDIT_BASELINE.md` (+1) |
