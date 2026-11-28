# D1 — Native WebGPU qualification prerequisite

Classification: **SOURCE_REVISION_GATE_DENIED**. With all trusted native M6 test flags enabled, the active Architecture Rise Raw source is v2 while the historical M6 compatibility is bound to v1. The M6 build decision returns false **before** the non-Raw request asks for WebGPU. The backend policy therefore defaults to WebGL; it did not deny an explicit WebGPU request or fall back after a failed native initialization. This is a deliberate source-bound compatibility guard, not evidence of GPU unavailability. The independent capability probe and current v2 Raw M3 pass below support that distinction but do not qualify M6.

Source base `9608989875b425ff7f6dd8ae73782d9ff00db879` (`origin/main`, C5 included). Node 24.3.0, Vite 8.1.4, Three 0.187.0/r187, Playwright 1.61.1; macOS 27.0.1 arm64, headed Chrome 158.0.8127.88. App version `0.0.0`. Default discovery `npm run test:e2e -- --list`: 280 cases in 80 files across `chromium` and `chromium-renderer-serial`; native-required flags select headed `chrome-native-webgpu` instead. Production preview is a separate project. These counts are discovery, not executed qualification. The [D1 result](NATIVE_WEBGPU_QUALIFICATION_PREREQUISITE_D1.json) contains the observed diagnostics and scope.

## Decision chain: first divergence

| Boundary | Inputs / source | Result and evidence |
|---|---|---|
| Playwright configuration | `playwright.config.ts:5–34`: `GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1`, `GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED=1`, `GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED=1`, `GROUND_GLASS_WEBGPU_M7G_R187_QUALIFICATION_REQUIRED=1` | Headed Chrome; Vite DEV, Raw pilot, M6 presentation, seam and r187 qualification flags true. Native-required is not an authorization by itself. |
| Source and M6 gate | `groundGlassRawWebGpuCompatibility.ts:8–11`, `groundGlassM6PresentationPolicy.ts:12–15,139–153` | Active `architecture-rise-raw-rtt-v2` differs from pinned `architecture-rise-raw-rtt-v1+m6-presentation-v1`. With r187 and all flags true the pure harness-flag check is true, but `isGroundGlassM6R187PresentationEvidenceMatched` and `isGroundGlassM6PresentationBuildEnabledForRevision` are false. Browser-loaded `isGroundGlassM6PresentationBuildEnabled()` also returned false. **This is the first decisive divergence.** |
| Request construction | `groundGlassRawWebGpuPolicyInput.ts:68–122`; initial `rawDebug=false` | `m6Requested=false`; independent M3 predicate is also false because it requires Raw Debug. `requestedBackend=null`, authorization `unauthorized/disabled`, features `[]`, preflight `unresolved`. The pure test asserts each. |
| Host acceptance and policy | `GroundGlassRenderHost.tsx:160,180–192`, `groundGlassBackendPolicy.ts:207–228` | Host accepts the request; `selectGroundGlassBackend` returns `selectedBackend=webgl`, `selectionReason=webgl-default`, `policyDecision=defaulted/webgl-default`. This reason comes from the pure function with the recorded inputs: the DOM does not expose it. |
| Mounted runtime | `GroundGlassRenderSurface.tsx:90–103`; browser diagnostics | Request `default`, selected `webgl`, attempted backend `webgl` / `mounted`, Host `ready`, renderer `webgl-renderer`, API `webgl2`, internal fallback `none`, application fallback `not-observed`; accepted request equals last completed request. M3 test-control `adapterAttemptGenerations=[]`; host/WebGL events existed but no native adapter attempt event. |

The Vite-loaded policy result and raw browser attributes are observations; the source-guard explanation and `webgl-default` reason are corroborated by the explicit pure-policy tests. Browser `data-policy-evidence-revisions` was absent for the default request. The independent GPU probe was issued **after** capturing the application decision and creates/destroys its own device; it is not an application attempt. An explicit WebGPU request denied by scene policy or capability preflight, a failed adapter initialization, `WebGPURenderer` on WebGL compatibility, and application fallback after a genuine attempt are different branches; none was observed for this M7G initial request.

## Current runtime checks

A bounded temporary Playwright probe used the same trusted M6 Vite flags, headed Chrome, `page.addInitScript` to install the development-only M3 event control, and `/simulator/free/architecture-rise?rttDiagnostics=1`. It waited for Host `ready`, recorded the surface `data-*` fields and attempt events, imported the existing M6 policy module from the Vite server, then independently called `navigator.gpu.requestAdapter()` and `adapter.requestDevice()`. No adapter-identifying details were collected. The probe exited 0; the GPU API was present, adapter returned, device succeeded, and `timestamp-query` and `float32-filterable` were available. The device was destroyed after the probe. There were no page errors. This establishes browser/device availability for that probe, not hardware acceleration, M6 compatibility, a WebGPU application mount, or optical quality. The normalized result is committed alongside this document; the full transient output is `/private/tmp/d1-browser-policy-probe.json`. No production global was added.

A reproducible bounded diagnostic can be run from the repository root. Start an isolated server with the same effective Vite flags (no frozen-capture output), then run the following in a second shell; stop the server afterward:

```bash
VITE_BASE_PATH=/ VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION=true \
VITE_GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION=true \
npm run dev -- --host 127.0.0.1 --port 4195 --strictPort
```

```js
// Run with node --input-type=module from the repository root.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: false,
  ignoreDefaultArgs: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 760 } });
  await page.addInitScript(() => { window.__groundGlassWebGpuM3TestControl = { adapterEvents: [], adapterAttemptGenerations: [] }; });
  await page.goto("http://127.0.0.1:4195/simulator/free/architecture-rise?rttDiagnostics=1");
  await page.waitForFunction(() => document.querySelector('[data-testid="ground-glass-rtt"]')?.getAttribute("data-render-host-lifecycle") === "ready");
  console.log(await page.evaluate(async () => {
    const el = document.querySelector('[data-testid="ground-glass-rtt"]');
    const attrs = Object.fromEntries([...el.attributes].filter(a => a.name.startsWith("data-")).map(a => [a.name, a.value]));
    const policy = await import("/src/render/webgpu/groundGlassM6PresentationPolicy.ts");
    const attempts = window.__groundGlassWebGpuM3TestControl?.adapterAttemptGenerations ?? [];
    let gpu = { present: !!navigator.gpu, adapter: false, device: false, error: null };
    try { const adapter = await navigator.gpu?.requestAdapter(); gpu.adapter = !!adapter;
      if (adapter) { const device = await adapter.requestDevice(); gpu.device = !!device; device.destroy(); }
    } catch (error) { gpu.error = String(error); }
    return { buildEnabled: policy.isGroundGlassM6PresentationBuildEnabled(), attrs, attempts, gpu };
  }));
} finally { await browser.close(); }
```

This equivalent diagnostic is a browser observation, not an automated classifier or a substitute for the existing native tests. `data-policy-requested-backend`, attempted-backend and event fields require the DEV test-seam flag.

Current M3 positive control, exit 0, 1 passed, no retries:

```bash
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 GROUND_GLASS_WEBGPU_FAILURE_INTEGRATION=1 \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true PLAYWRIGHT_WEB_SERVER_PORT=4174 \
npm run test:e2e -- --config=playwright.rq21.config.ts --project=chrome-native-webgpu \
  --workers=1 --retries=0 --output=/private/tmp/d1-rq21 \
  scripts/render-quality/rq2.1-native-m3.spec.ts
```

The existing test independently requires `webgpu-renderer`, actual `webgpu`, r187, source v2 and `m3-architecture-rise-raw-rtt-native-r187-v2`, no internal or application fallback, contentful current frame, and confirmed cleanup during client-side scene transition. Those assertions passed on this host. This authorizes no non-Raw M6 behavior. The retained RQ2.1 report is separate historical evidence from source `887930d73315d9cc64cf37c66385a8a7ddfe4296`.

Current M7G prerequisite, exit 1, 1 failed, no retry:

```bash
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED=1 \
GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED=1 GROUND_GLASS_WEBGPU_M7G_R187_QUALIFICATION_REQUIRED=1 \
PLAYWRIGHT_WEB_SERVER_PORT=4195 npm run test:e2e -- --project=chrome-native-webgpu \
  --workers=1 --retries=0 --output=/private/tmp/d1-m7g \
  src/tests/e2e/ground-glass-webgpu-m7g-lifecycle.spec.ts -g 'M7G holds a submitted M5 composite'
```

The ready pane had Raw Debug false and `data-attempted-backend=webgl`; the first native renderer assertion expected `webgpu-renderer` and received `webgl-renderer`. The M7G test never reached its WebGPU API, barrier, stale-frame, capture, or cleanup assertions. Its failure is **BLOCKED at prerequisite**, not a native test pass, and no frozen capture was generated. The separate browser diagnostic provides the actual API, request, absence of native attempts and capability evidence; it did not run the M7G barrier.

## Controls and conservative alternatives

The added focused test starts from exact v2/v1 strings and complete flags, checks the runtime and pure M6 gates, verifies a non-Raw request defaults to WebGL even when a mocked browser GPU is present, and independently exercises the r187 qualification-harness flags with each Raw pilot, M6 presentation, seam and r187 qualification flag disabled. The latter checks the *harness flag contract*, not a claim that the general M6 gate would always fail for each flag: matched accepted evidence is another branch of that gate. The v2 Raw case independently requests only `raw-rtt` and is eligible with valid session/capability inputs; it does not enable M6. Altered bounds, unsupported scene and r188 remain denied. Existing `groundGlassBackendPolicy.test.ts` checks source/evidence mismatch, historical v1 record preservation, unsupported renderer/scene, capability denial, and production denial. No compatibility records or assertions were weakened.

No new general classification engine is introduced. These are the evidence rules used for this result:

- Source gate false + valid trusted flags + default request + no native attempt → `SOURCE_REVISION_GATE_DENIED`, not GPU unavailable.
- A WebGL mount alone with no build/request/attempt evidence → `INDETERMINATE`, not a source or device diagnosis.
- An explicit request rejected by scene policy or capability preflight, initialization failure, internal WebGL compatibility, application fallback after an attempt, and actual native mount require their own distinct observed decision and runtime evidence. None can be inferred solely from a WebGL surface.
- A WebGL mount is not native success. A v1 historical M6 report is not v2 authorization. A current v2 M3 Raw pass is not M6 authorization.

## Historical and secondary prerequisites

The retained M6 r186 presentation record and M7F r187 17-scenario implementation record use the v1 source; M7F's accepted presentation evidence remains `m6-architecture-rise-native-presentation-r187-v1`, quality unqualified. M7G consolidates historical r187 lifecycle and M4/M5/M6 evidence, not an authorization for the changed v2 raster source. M7X's earlier bounded Raw smoke was v1; RQ2.1's v2 Raw record is the separate active r187 eligibility. None proves full M6 quality or production eligibility.

**M5/M4:** C3's `physical-coc-evidence-does-not-match-candidate` is a separate historical preflight finding, not rerun in D1. Current `GROUND_GLASS_RAW_WEBGPU_R187_COMPATIBILITY` exposes a v2 aggregate with the r187 physical-CoC, gather and B1 research features still source-bound to v1; `isGroundGlassPhysicalCocResearchEvidenceRevisionMatched` requires feature and aggregate source revisions to match. M5 research additionally checks each feature revision and native renderer. The relationship explains a source-compatibility prerequisite; the exact C3 runtime condition is not re-established by this inspection and must be independently tested before a D2 qualification. No M4/M5 policy or threshold changed.

**M7C:** `ground-glass-webgpu-failure-host.spec.ts:21,72–74` has a hardcoded v1 Raw evidence expectation in a currently selectable native failure-host test, while the active Raw v2 record produces `m3-architecture-rise-raw-rtt-native-r187-v2`. It is a current test-source prerequisite that conflicts with the v2 path, not proof that v1 archives should be rewritten. C3 reached the mismatch; D1 did not rerun M7C. A separate version-aware current test or new lane needs review while historical v1 expectations remain pinned.

## D2: bounded current-source requalification proposal

1. Define a **development-only, explicitly controlled execution candidate** for the exact v2 source and r187, with provenance and fail-closed scene/bounds/backend gates; review how it can gather new evidence without modifying or pretending the accepted v1 record is v2. A test-only candidate must not become an accepted record merely because it runs.
2. Establish v2 physical CoC inputs and M5 Gather/B1 source compatibility, recording current native backend, exact source/renderer, readback provenance and existing unqualified quality limits. Keep M5Q and historical captures separate.
3. Run native M6 presentation with no internal fallback; verify crop and Raw/Upright correspondence, focus/aperture/rise, current request/frame identity, held stale-result rejection, resize, generation retirement, SPA cleanup and actual resource ownership. Preserve real asynchronous boundaries and use zero retries for qualification.
4. Independently evaluate optical-quality gates and persist a new source/renderer/commit-bound evidence record only after the matching tests and artifact review pass. The record must enumerate feature set, test/artifact paths, runtime/backend provenance, unknowns and limits. Keep the v1 record immutable.
5. Separate execution authorization, native runtime conformance, optical quality, archival replay and production eligibility. Neither a development native pass nor a new record automatically enables production WebGPU or upgrades broad M7 qualification.

## Validation, limits and rollback

Untouched baseline: `npm run test -- --run src/tests/unit/groundGlassBackendPolicy.test.ts src/tests/unit/groundGlassM6Presentation.test.ts src/tests/unit/groundGlassWebGpuRuntime.test.ts`: 62 passed. With the D1 prerequisite test added, the same command plus `src/tests/unit/nativeWebGpuQualificationPrerequisite.test.ts`: **69 passed**, four files, exit 0. `npm run lint` and `npm run typecheck` passed. Exact M3/M7G commands and expected M7G nonzero are above. The browser capability success does not establish hardware acceleration; policy diagnosis does not establish M6 runtime conformance. No production code, flags, CI workflows, source pins or historical artifacts changed. The D1 test initially produced B2 `UNVERIFIED` for an unmapped verification dependency; the exact test path is now registered as a shared qualification path, so it conservatively requires all supported historical replays. A routing regression verifies that ownership; no family ownership, source pin or fail-closed rule changed. The final local `npm run evidence:qualification:historical -- --files=src/tests/unit/nativeWebGpuQualificationPrerequisite.test.ts,src/tests/unit/historicalEvidenceRouting.test.ts,scripts/historical-evidence-manifest.json,docs/testing/NATIVE_WEBGPU_QUALIFICATION_PREREQUISITE_D1.md,docs/testing/NATIVE_WEBGPU_QUALIFICATION_PREREQUISITE_D1.json` returned `QUALIFIED`: M7E, M7F, M7G, M7H, M7I, M7J, M7K, M7L, M7M, M7N, M7O, M7P, M7Q and M7W; all 16 validators exited 0, including M7F/M7G equivalence. The routing Unit suite passed 28 tests. Current-head CI and B2 selection are reported in the PR handoff.

Rollback: revert the D1 test, exact-path historical routing registration, routing regression and investigation documents; there is no runtime behavior to revert. M6 remains source-gated, M7G remains blocked on current v2, M5/M7C remain separate follow-ups, M7V remains mandatory, and production remains WebGL-only.

## Independent review

The independent reviewer traced the source gate, request construction and backend selection and confirmed the no-native-attempt interpretation. They independently reran the current v2 M3 positive control on a separate port: one passed, zero skipped or retries, with the native backend, evidence identity, accepted frame and SPA cleanup assertions intact. They also reviewed the exact-path B2 registration as a conservative shared dependency, with no source-pin or family-ownership change. Current-head GitHub CI belongs in the PR handoff.
