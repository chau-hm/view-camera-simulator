# M7V — E2E Qualification Lanes and Skip Governance

## Decision

**V1 — Governance established, approvals pending.** M7V reconciles every M7R skipped identity with its current source-level guard, assigns each historical identity to a proposed lane, and adds a fail-closed policy check. The policy check passes. No lane execution or owner approval is claimed, so strict approval and qualification checks remain blocked.

This is policy and inventory evidence. It does not qualify Broad E2E, M7, native WebGPU, or production WebGPU.

## Historical and current inventory

The immutable M7R report records 278 discovered, 118 passed, 85 unexpected, 75 skipped, zero retries, and zero incomplete results. Its skip audit records zero approved exclusions. The report SHA-256 is `b39b3c4b4a0c56b8d62120ccc62dfcca509e37356c565538316d983dc44b4823`, and its execution source is `d34fe8b39f6c1e0509b3ffecb6fcc6566282d9f8`.

On the M7U merge source `6e236d2ef4f248bfd3ad081d8d1786a7c0f8f382`, Playwright 1.61.1 discovery found:

| Inventory | Identities | Projects |
|---|---:|---|
| Standard configuration | 280 | 276 `chromium`, 4 `chromium-renderer-serial` |
| Native-required configuration | 280 | 280 `chrome-native-webgpu` |
| Production-preview configuration | 4 | 4 `chromium-production-preview` |

The standard inventory adds exactly the two M7U Swing tests to M7R and removes or renames none:

- `chromium::interior-corner-swing-focus.spec.ts::Interior Corner Swing keyboard steps update the public movement readout in both directions`
- `chromium::interior-corner-swing-focus.spec.ts::validated direct Swing input rejects inaccessible and off-grid targets`

The detailed identity, title-path, project, and source-line inventory is in [current-inventory-reconciliation.json](ground-glass-m7v-skip-governance/current-inventory-reconciliation.json). The historical M7R identities are taken directly from `actionPlan[2].affectedIdentities`; they are not reconstructed from annotation text.

## Historical 75 identity decisions

| Proposed lane | Identities | Requirement | Approval |
|---|---:|---|---|
| `native-webgpu` | 73 | Conditional mandatory in a real native WebGPU environment | Pending for all 73 |
| `research-development` | 2 | Keep the dedicated research workflow | Pending for both |
| **Total** | **75** | No identity is deleted or counted as passed | **75 pending, 0 approved, 0 rejected** |

Each row in [historical-75-identity-matrix.json](ground-glass-m7v-skip-governance/historical-75-identity-matrix.json) preserves the exact identity, M7R skipped outcome, source file, source expression and reason, suite/test scope, required environment names, build flags, entrypoint, lane obligation, rationale, validation status, and approval status. The 73 native rows remain conditional mandatory requirements; a normal WebGL skip does not discharge them. The two research assignments preserve their workflows and are not approvals to remove or omit them.

All approvals remain `pending` with `approvalEvidence: null`. A historical annotation, an agent recommendation, or a platform gate is not owner authorization. An approval must be made explicitly against the enumerated identity or exact identity group and recorded with evidence before `require-approved` can pass.

### Source-level gate audit

The evaluator parses the discovered test definitions and records applicable suite- and test-level `test.skip()` calls, including the literal predicate and reason. It follows local identifiers used by those predicates to record the referenced environment variables and `VITE_` build flags. Every one of the 75 historical identities has at least one source guard, and its matrix row is compared with current source on every policy check.

The matrix also records the current Playwright configuration's environment-to-build-flag contract as **conditional assignments per gate**. For example, the failure-integration gate enables `VITE_GROUND_GLASS_WEBGPU_TEST_SEAM`; the physical-research gate enables that seam and `VITE_GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH`; the gather-research gate enables the seam and `VITE_GROUND_GLASS_WEBGPU_GATHER_RESEARCH`; the r187 gates select their matching qualification flags; and M6 sets its presentation/raw-pilot flags while explicitly holding research-only flags false. These assignments describe separate environment profiles and must not be flattened into one set of simultaneous values. Directly required `VITE_` values, such as Raw Pilot, are preserved separately per identity. The policy snapshot includes the standard project selection, native headed-Chrome selection, renderer-serial one-worker settings, production-preview project, and production spec suffix. A relevant config change therefore requires an updated, reviewed policy snapshot.

There are ten additional source-guarded tests not in the historical 75. They are ordinary Chromium compatibility/fallback controls whose guard applies in the native-required project. They remain mandatory in `ordinary-webgl`; the separate native project does not use those fallback controls as native evidence. Their M7R outcomes are preserved individually in the reconciliation, including one timed-out result. The evaluator requires these ten project-specific guard records and rejects an unregistered new source skip.

Playwright `--list` is discovery evidence only. It does not establish runtime skip outcomes or native eligibility. M7V did not execute the 280-test suite, the 73 native tests, the Dream Loop capture, or the Scene Capacity benchmark.

## Lane decision policy

### `ordinary-webgl`

The 201 assigned identities cover ordinary public simulator regression under the application's default WebGL path, including routes, controls, lessons, Ground Glass, optical behavior, application lifecycle, and responsive layout. They remain mandatory; an unexpected skip blocks qualification. The lane command is:

```bash
npm run test:e2e -- --project=chromium --retries=0
```

The ten native-project-only fallback controls remain in this lane and are not omitted from ordinary execution.

### `renderer-serial`

The four identities retain the existing `chromium-renderer-serial` project, one-worker, non-parallel policy:

- `camera-controls-compact.spec.ts` — camera control rows keep useful rendered tracks across rail widths.
- `fringe-club-dev-integration.spec.ts` — Stage 2N-A Observer and RTT instances survive independent sibling removal.
- `scene-view-focus.spec.ts` — View Focus preserves independent Scene and Camera views and resets the active preset.
- `table-tilt.spec.ts` — Table Tilt RTT survives focus, preview, zoom, quality, and tilt resource stress.

These are mandatory and cannot be satisfied by ordinary project results:

```bash
npm run test:e2e -- --project=chromium-renderer-serial --no-deps --workers=1 --retries=0
```

### `native-webgpu`

The 73 identities remain conditional-mandatory. Native lane evidence requires headed Chrome from the `chrome-native-webgpu` project, an actual `webgpu-renderer` / WebGPU execution API, no application fallback, and no WebGL compatibility backend. A native-required environment flag alone is not proof of native execution. Every identity retains its own skip predicates and required environment/build-flag names; tests with additional M3/M4/M5/M6/M7G research or qualification gates must run under the corresponding gate combination.

The project-selection pattern is:

```bash
OBSERVER_NATIVE_WEBGPU_REQUIRED=1 \
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 \
npm run test:e2e -- --project=chrome-native-webgpu --retries=0
```

Use the per-identity environment and build requirements in the matrix; do not flatten these to a single `native=true` flag. If the actual native runtime is unavailable, report `blocked` or `not-run`. Do not count a skip, fallback result, compatibility backend, or unavailable device as a pass.

### `research-development`

The two existing entrypoints remain intact:

```bash
npm run dream-loop:capture -- --pilot <approved-pilot-id>
npm run benchmark:scene-capacity
```

Dream Loop validates a selected pilot manifest and writes separate clean and teaching captures under `.dream-loop/`. The runner supplies `DREAM_LOOP_CAPTURE`, the manifest path, and both output paths. Scene Capacity supplies its commit identity, one-worker Playwright configuration, and output directory. These are deliberate research/development workflows, not ordinary public-regression tests; M7V did not run them.

### `production-preview`

The four production-preview identities stay in their separate production config and WebGL-isolation lane:

```bash
npm run test:e2e -- --config=playwright.production.config.ts \
  --project=chromium-production-preview --workers=1 --retries=0
```

The existing Pages workflow's production-preview check remains required. Native research does not grant production WebGPU permission, and the deployment job remains dependent on successful CI.

## Policy states and commands

These states answer different questions:

- `qualified`: all applicable mandatory identities have complete, correct-lane evidence, no retries/flakes/incomplete/skips, required approvals exist, and runtime identity matches the lane.
- `not-qualified`: executed evidence includes failing, unexpected, skipped, flaky, or incomplete required outcomes.
- `blocked`: a required environment or hardware prerequisite is unavailable.
- `not-run`: no valid execution evidence has been collected.
- `pending-approval`: an exclusion or lane decision lacks explicit authorization.

The commands intentionally separate policy integrity from approval and execution:

```bash
npm run evidence:check:m7v
npm run evidence:require-approved:m7v
npm run evidence:require-qualified:m7v
```

The first validates the historical identity matrix, source guards, current project discovery, lane assignments, package-script entrypoints, approval-state consistency, and milestone boundaries. It may pass with pending approvals. The second and third are strict and return nonzero while approval or lane evidence is missing. Neither command can promote M7 or M8.

Policy integrity compares only the required M7V package scripts and their executable targets. It does not byte-pin `package.json` or dependencies, so unrelated manifest maintenance is allowed.

Validation completed with 19/19 focused M7V policy tests, the repository unit suite (327 test files, 3,941 tests), typecheck, lint, and the M7R, M7Q, and M7K evidence checks passing. Both strict M7V commands returned exit code 1 as intended: the 75 owner decisions remain pending, and the ordinary, renderer-serial, native, and production-preview qualification evidence is not-run. This PR did not execute the full Broad E2E suite, native WebGPU lane, Dream Loop capture, or Scene Capacity benchmark.

## Current result and next action

M7V policy integrity passes. Owner approval is pending for all 75 rows. Ordinary, serial, native, research, and production-preview lane evidence is not represented as newly executed by this PR. The strict approval and qualification commands therefore remain nonzero by design.

The next qualification step is an owner-reviewed adjudication of the exact 75-row matrix, followed by lane execution in the corresponding environments. Start with ordinary WebGL and the preserved renderer-serial lane; schedule native-required identities only on a runtime that can independently prove native WebGPU. Do not treat lane integrity as a new full-suite result.

Preserved boundaries:

```text
M7R historical baseline: 278 discovered / 118 passed / 85 unexpected / 75 skipped
Broad E2E: not-qualified
M7: partially-qualified
M8 entry: denied
Spontaneous/external native GPU device loss: blocked
Production Ground Glass: WebGL-only
Production WebGPU: disabled
```
