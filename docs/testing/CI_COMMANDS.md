# CI command reference

This is the canonical interface for developers and agents. The current npm registrations and retained compatibility exceptions are listed below; historical invocations are preserved in their original reports. See [Local CI architecture](LOCAL_CI_ARCHITECTURE.md) for report semantics and [closeout](CI_SIMPLIFICATION_CLOSEOUT.md) for authority and outcomes.

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
| `evidence`, retained M7 aliases | Historical replay, checks, captures and normalization; pinned source trees, stored evidence and sometimes browser/native prerequisites apply. Some validators run automatically through [historical qualification](HISTORICAL_EVIDENCE_QUALIFICATION.md) or ordinary CI. Capture/normalization and migration can write artifacts; read the named scripts and family reports before running. No deployment. |
| `render-quality:*` | Research capture, verify and image measurements; needs relevant browser, fixtures and GPU setup. Captures/measurements can write artifacts under render-quality locations. See `docs/render-quality/`; not ordinary CI or deployment. |
| `benchmark:*` | Observer/scene capacity measurements, with appropriate local hardware/browser prerequisites; may produce measurement outputs. See `docs/` and script help. Not ordinary CI or deployment. |
| `dream-loop:*` | Visual capture and guard tooling; needs the scene/server and configured output paths; can write images/reports. See `docs/` and script help. Not ordinary CI or deployment. |
| `*still-life-studio*` | Scene-specific build and browser qualification; requires relevant browser and scene setup, can write build/test output. Not ordinary CI or deployment. |
| `promote:*` | [Release promotion](../../README.md#cicd-and-deployment): preflight checks remote refs; production promotion changes the production branch and can trigger deployment. Requires the release prerequisites and authorization. |
| `preview`, `test:watch` | Interactive local server or Vitest watch mode; no deployment. |

Native renderer research also uses selected `test:e2e` or focused routes with the specific report's environment gates; it is not an unconditional CI claim. Builds and tests may write local outputs. The `build:production-preview:after-typecheck` internal command is consumed by the CI preview config only after its successful typecheck; do not use it as a standalone checked build.

### Evidence interface

```bash
npm run evidence -- list
npm run evidence -- check m7p
npm run evidence -- replay m7f
npm run evidence -- normalize m7o-matrix
npm run evidence -- qualify --all
```

Use `help` for available actions. Arguments after the family are passed in order to the existing operation. `qualify` delegates to the existing historical runner. Some historical records use removed aliases; consult the [migration and compatibility table](EVIDENCE_COMMAND_CONSOLIDATION.md) rather than changing recorded invocations. Captures and normalization may write artifacts; verify their prerequisites and output paths first.

## Complete registered inventory

Each entry below is the literal `package.json` implementation. See the [consolidation report](EVIDENCE_COMMAND_CONSOLIDATION.md) for historical consumers, provenance, and retired alias mappings. CI uses M7R and M7V through their retained exact registrations.

| Command | Implementation |
| --- | --- |
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `build:production-preview:after-typecheck` | `vite build` |
| `build:still-life-studio-qualification` | `tsc -b && vite build --mode still-life-studio-qualification` |
| `evidence:replay:m7e` | `node ./scripts/run-m7e-offline-replay.mjs` |
| `evidence:normalize:m7p` | `node ./scripts/normalizeM7pAssertionSchedulingCapture.mjs` |
| `evidence:normalize:m7q` | `node ./scripts/normalizeM7qLightPeerTraceAb.mjs` |
| `evidence:normalize:m7r` | `node ./scripts/normalizeM7rBroadE2eCapture.mjs` |
| `evidence:check:m7r` | `node ./scripts/run-m7r-evidence.mjs` |
| `evidence:check:m7v` | `node ./scripts/run-m7v-qualification.mjs validate-policy` |
| `evidence:require-approved:m7v` | `node ./scripts/run-m7v-qualification.mjs require-approved` |
| `evidence:require-qualified:m7v` | `node ./scripts/run-m7v-qualification.mjs require-qualified` |
| `benchmark:observer-backends` | `node ./scripts/run-observer-backend-benchmark.mjs` |
| `benchmark:scene-capacity` | `node ./scripts/run-scene-capacity-benchmark.mjs` |
| `benchmark:scene-capacity:hardware` | `node ./scripts/run-scene-capacity-hardware-benchmark.mjs` |
| `dream-loop:capture` | `node ./scripts/dream-loop/capture.mjs` |
| `dream-loop:guard` | `node ./scripts/dream-loop/guard.mjs` |
| `render-quality:rq1:capture` | `node ./scripts/render-quality/rq1-capture.mjs` |
| `render-quality:rq1:check` | `node ./scripts/render-quality/rq1-check.mjs` |
| `render-quality:rq3d:measure` | `node ./scripts/render-quality/rq3d-macro-image-metrics.mjs` |
| `render-quality:rq3a:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3a-runs/current src/tests/render-quality/e2e/render-quality-rq3a-capture.spec.ts` |
| `render-quality:rq3e:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3e-runs/current src/tests/render-quality/e2e/rq3e-macro-oblique-capture.spec.ts` |
| `render-quality:rq3e:measure` | `node ./scripts/render-quality/rq3e-macro-image-metrics.mjs` |
| `render-quality:rq3f:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3f-runs/current src/tests/render-quality/e2e/rq3f-macro-compound-capture.spec.ts` |
| `render-quality:rq3f:measure` | `node ./scripts/render-quality/rq3f-macro-image-metrics.mjs` |
| `render-quality:rq3g:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3g-runs/current src/tests/render-quality/e2e/rq3g-macro-bellows-capture.spec.ts` |
| `render-quality:rq3g:measure` | `node ./scripts/render-quality/rq3g-macro-image-metrics.mjs` |
| `render-quality:rq3d:capture-support` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3a-runs/support-current src/tests/render-quality/e2e/rq3d-macro-capture-support.spec.ts` |
| `render-quality:rq3a:verify` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 src/tests/render-quality/e2e/ground-glass-dof-edge.spec.ts` |
| `render-quality:rq3b:capture` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3b-runs/current src/tests/render-quality/e2e/rq3b-nonparallel-illumination-capture.spec.ts` |
| `render-quality:rq3b:gpu-verify` | `GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 playwright test --config=playwright.rq3a.config.ts --project=chromium --workers=1 --retries=0 --output=docs/render-quality/.rq3b-runs/current src/tests/render-quality/e2e/ground-glass-natural-illumination-gpu.spec.ts` |
| `render-quality:rq2:capture` | `node ./scripts/render-quality/rq1-capture.mjs --profile rq2` |
| `render-quality:rq2:check` | `node ./scripts/render-quality/rq1-check.mjs --profile rq2` |
| `test` | `node ./scripts/test.mjs` |
| `test:watch` | `vitest` |
| `test:e2e` | `playwright test` |
| `test:e2e:still-life-studio` | `playwright test --config=playwright.still-life-studio.config.ts` |
| `test:e2e:m7j-renderer` | `playwright test --project=chromium-renderer-serial --no-deps --workers=1 --retries=0 --reporter=list,json` |
| `lint` | `eslint . --max-warnings=0` |
| `typecheck` | `tsc -b` |
| `check:css` | `node ./scripts/check-css-structure.mjs` |
| `ci:local` | `node ./scripts/ci-local.mjs` |
| `ci:local:e2e` | `node ./scripts/ci-local.mjs --with-e2e` |
| `ci:local:focused` | `node ./scripts/ci-local.mjs --mode=focused` |
| `ci:local:affected` | `node ./scripts/ci-local.mjs --mode=affected` |
| `ci:local:core` | `node ./scripts/ci-local.mjs --mode=core` |
| `promote:preflight` | `node ./scripts/promote-production.mjs -- --check` |
| `promote:production` | `node ./scripts/promote-production.mjs` |
| `preview` | `vite preview` |
| `evidence` | `node ./scripts/evidence.mjs` |
