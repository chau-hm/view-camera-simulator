# C3 — Aperture Gather test seam cleanup

Implementation base `093bc33ba12721cb4f296171dde7a6ffe2afd1e0` from `origin/main`. This includes C2 (#380) and the Pages artifact work (#378).

## Caller inventory and decision

Delete `clearGroundGlassApertureGatherCaptureForTest` from `src/render/webgpu/groundGlassWebGpuTestSeam.ts`. Before the edit, the checkout contained four exact matches: the declaration, two mentions in the Test Audit Plan, and one row in the Test Audit Ledger. No import, call, alias, re-export, namespace/property access, bracket access or global registration for this symbol was found. The browser setup and teardown code operate directly on the gated control fields and functions.

Run from the dedicated worktree before and after the edit:

```bash
rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**' \
  'clearGroundGlassApertureGatherCaptureForTest' .
git grep -Fin 'cleargroundglassaperturegathercapturefortest' -- src scripts .github
git grep -il 'groundGlassWebGpuTestSeam' -- src scripts .github
git grep -nE 'export (\*|\{[^}]*\}) from .*groundGlassWebGpuTestSeam|import \* as .*TestSeam|clearGroundGlassApertureGather' -- src scripts
git log --all -G 'clearGroundGlassApertureGatherCaptureForTest' --format='%h %s' -- src scripts
```

The exact-name worktree search respects ignore files and excludes generated dependencies, output and Git metadata. The tracked search separately examines checked-in source, scripts and workflows irrespective of ignores. The module-level search identifies consumers even if a symbol name could be constructed. It leads to named imports in the renderer, host, simulator and B1/M6D probes, E2E control types, the recovery Unit test's dynamic import of a different function, the host test's import-original mock spread, and evidence types consumed by the M7E evaluator and replay loader. None accesses the candidate. Source history finds the M5 introduction on retained feature and merge revisions (`5097bf56` and `116c4ecb`). Historical module names in logs and pinned capture paths refer to the module or revision, rather than invoking this symbol. After deletion, the only exact matches across the checkout are the audit prose and this report, and application/test/script searches have zero hits.

The root package is private and has no published module entry point, package exports or type declaration entry for the seam. The browser interface is the explicitly typed `window.__groundGlassWebGpuM3TestControl`, which contains capture fields, trigger and release functions. The removed function was solely a module export. No maintained external interface or downstream consumer was found. An out-of-repository development script that imports an internal source path directly cannot be excluded by checkout analysis.

## Active contract ownership

`getControl` still requires `import.meta.env.DEV`, `VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"`, and a browser control object. The adapter and its real cleanup path are byte-identical to the base.

| Contract | Active path | Preserved checks |
| --- | --- | --- |
| Request setup and consumption | Browser specs clear the previous readback directly and set a tokenized request. The registered trigger requeues the accepted request on the adapter. `consumeGroundGlassApertureGatherCaptureForTest` takes and clears the pending request in the native gather path. | M5 and M6 wait for token-matched readbacks. M7G expects exactly the R2 publication. |
| Current readback | The adapter validates the current generation and frame before publication. `publishGroundGlassApertureGatherCaptureForTest` stores the readback and appends token, capture, request, channel, scene and generation identity. | M5 current-capture/accepted-frame agreement, M6 mounted composite and presentation data, M7G R2-only acceptance and M4/M5/M6 identities. |
| Stale readback and async release | `holdGroundGlassApertureGatherReadbackForTest` installs a release callback. Release resets the hold and reached flags, clears the callback and resolves the waiter. Current-request guards still run in the adapter. | M5 rejects superseded and resized tokens through publication history. M7G checks the held R1 event sequence, stale discard, no host acceptance and current R2 publication. |
| Local gather recovery | The adapter records failure and can complete a later valid gather. | M5 exercises its existing local gather failure and subsequent recovery while asserting native WebGPU. |
| Retired generation cleanup | Unmount retires the generation and unregisters the trigger. `disposeOwned` waits for queued work and initialization, disposes owned resources and records the cleanup outcome. | M5 navigates client-side through All Scenes, verifies canvas detachment, releases the hold, checks the retired generation's confirmed cleanup, and rejects the retired token. |

The focused seam Unit test exercises legal recovery-action routing and invalid actions. M7E Unit tests and replay cover serialized request identity, simulated stale host publication, stored readbacks and exact-source provenance. M7F/M7G Unit tests cover saved-report evaluation and lifecycle validation. The native browser tests exercise GPU execution, operations and lifecycle. These are separate evidence layers.

## Historical controls and scope

The retained [M7E native lifecycle capture](../architecture/ground-glass-m7e-r187-gather-b1/m5-lifecycle-capture.json) records real WebGPU execution with no fallback, confirmed cleanup, and false resize/unmount stale-publication flags at source `9382217c7820be87a596124fd78c28239d416653`. The [M7G consolidation](../architecture/GROUND_GLASS_M7G_R187_LIFECYCLE_CONSOLIDATION.md) records independent held-R1 rejection and R2 acceptance, and its evaluator mutations exercise report integrity. The M7E Unit stale-host mutation also rejects a consistent capture envelope falsely attributed to the current request. These are retained controls, with native assertions preferred for current execution. No temporary source mutation was needed for the unused-export deletion.

The existing historical classifier returns `NOT_APPLICABLE` for the complete two-path change, with no frozen historical replay dependency. The seam's Local Affected owner remains provisional and retains its required native failure-host target and full Vitest fallback. The scoped checks do not establish complete Affected ownership.

The source-only delta is six function lines plus one adjacent blank line, zero additions. The exact hunk can be reproduced with:

```bash
git diff 093bc33ba12721cb4f296171dde7a6ffe2afd1e0 -- \
  src/render/webgpu/groundGlassWebGpuTestSeam.ts
```

The diff preserves the global, adapter, request/readback/publication contracts, barrier, types, tests, development and Production Preview gates, and historical inputs and schemas. Emitted bundle size and CI cost were not measured. `RUNTIME_SAVING_NOT_ESTABLISHED`.

## Validation and qualification

Five focused Vitest files passed 209 cases (seam 1, M7E evaluator 44, M7E artifact replay 26, M7F evaluator 68, M7G evaluator 70). TypeScript, ESLint and diff checks passed. The post-edit exact-name search was repeated before this report was written.

```bash
npm run test -- --run \
  src/tests/unit/groundGlassWebGpuTestSeam.test.ts \
  src/tests/unit/groundGlassM7eGatherB1Evidence.test.ts \
  src/tests/unit/groundGlassM7eArtifactReplay.test.ts \
  src/tests/unit/groundGlassM7fPresentationEvidence.test.ts \
  src/tests/unit/groundGlassM7gConsolidatedEvidence.test.ts
npm run typecheck
npm run lint
git diff --check
git status --short
```

Current native lifecycle qualification **NOT_RUN** to completion. Headed Chrome 158.0.8127.88, macOS 27.0.1 arm64, Node 24.3.0 and Three r187 reached the selected declarations in `chrome-native-webgpu`, with one worker and zero retries. These were failed attempts at prerequisites, with zero skips and zero lifecycle PASS results. The same three prerequisite failures reproduced at the exact unmodified base in a separate detached worktree.

| Owner | C3 attempt | Clean base comparison |
| --- | --- | --- |
| M5 stale, recovery, resize and SPA cleanup | Mounted native WebGPU identity, then M5 eligibility rejected `physical-coc-evidence-does-not-match-candidate` before the hold. One failed, exit 1. | Same assertion and reason, exit 1. |
| M6 mounted presentation | Expected `webgpu-renderer`, observed `webgl-renderer` before the capture. | Same backend assertion. |
| M7G held composite | Expected `webgpu-renderer`, observed `webgl-renderer` before the hold. | Same backend assertion. |

The combined M6/M7G command exited 1 with two failures on both trees. WebGL did not satisfy any native assertion. Frozen captures were not written or regenerated. The retained reports and unchanged declarations provide the historical proof while current-host qualification remains unavailable. The matching base failures and unchanged lifecycle implementation isolate this limitation from the removal.

```bash
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 \
GROUND_GLASS_WEBGPU_APERTURE_GATHER_RESEARCH=1 \
GROUND_GLASS_WEBGPU_APERTURE_GATHER_R187_QUALIFICATION=1 \
GROUND_GLASS_WEBGPU_PHYSICAL_COC_RESEARCH=1 \
GROUND_GLASS_WEBGPU_PHYSICAL_COC_R187_QUALIFICATION=1 \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true PLAYWRIGHT_WEB_SERVER_PORT=4194 \
npm run test:e2e -- --project=chrome-native-webgpu --workers=1 --retries=0 \
  --output=/private/tmp/vcs-c3-m5 \
  src/tests/e2e/ground-glass-webgpu-aperture-gather-app.spec.ts \
  -g 'native M5 rejects stale captures and recovers from a local gather failure$'

GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 \
GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED=1 \
GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED=1 \
GROUND_GLASS_WEBGPU_M7G_R187_QUALIFICATION_REQUIRED=1 \
PLAYWRIGHT_WEB_SERVER_PORT=4195 npm run test:e2e -- \
  --project=chrome-native-webgpu --workers=1 --retries=0 \
  --output=/private/tmp/vcs-c3-m6-m7g \
  src/tests/e2e/ground-glass-webgpu-m6-presentation.spec.ts \
  src/tests/e2e/ground-glass-webgpu-m7g-lifecycle.spec.ts \
  -g 'native M6 displays the M5 composite with shared crop and presentation behavior|M7G holds a submitted M5 composite, rejects its stale request, and publishes the latest M4/M5/M6 result'
```

The clean base commands changed only the output directory prefix to `vcs-c3-base-`. Local logs are under `/private/tmp/vcs-c3-*.log`. GitHub PR CI supplies current-head Full Vitest, Chromium smoke, Production Preview isolation, and the historical/M7R/M7V gate results separately in the PR handoff.

The affected fallback ran with `npm run ci:local:affected -- --base 093bc33ba12721cb4f296171dde7a6ffe2afd1e0 --workers=4`. All 4,513 cases in 360 files passed. The runner reported `INCOMPLETE` (exit 2) because the seam owner remains provisional and its required native failure-host spec was unverified.

A separate focused run of the mapped failure-host spec selected the M7C SPA cleanup case. It reached a policy prerequisite that still expects `m3-architecture-rise-raw-rtt-native-r187-v1`, while the unchanged current compatibility record reports `m3-architecture-rise-raw-rtt-native-r187-v2`. The case exited 1 before lifecycle proof. The assertion and policy record both match the clean base. That mismatch is outside C3. The broad owner remains provisional and its required native target remains unverified.

```bash
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true PLAYWRIGHT_WEB_SERVER_PORT=4194 \
npm run test:e2e -- --project=chrome-native-webgpu --workers=1 --retries=0 \
  --output=/private/tmp/vcs-c3-m7c src/tests/e2e/ground-glass-webgpu-failure-host.spec.ts \
  -g 'M7C scene navigation during pending cleanup'
```

## Independent preservation review

The reviewer independently checked the exact deletion, caller and global boundaries, retained capture setup and request/readback flow, barrier and disposal owners, historical evidence and CI scope. They found no active dependency and concluded that current GPU execution is not necessary to establish the semantic safety of this unreachable export deletion. They flagged the separate provisional native owner requirement. The Affected fallback and failed native prerequisites are reported above, and the retained native tests and gate requirements are unchanged.

## Rollback

Revert the C3 change to restore the export from the base revision. Recheck the import and native owner contracts if a new consumer appears.
