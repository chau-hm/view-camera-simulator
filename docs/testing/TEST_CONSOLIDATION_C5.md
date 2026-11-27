# C5 — WebGPU seam and lifecycle preservation audit

Audit base `f2a55e62853a237953b3c1484b72a1d311328910` (`origin/main`, including C4). Application package `0.0.0`; Node 24.3.0, Vite 8.1.4, Three 0.187.0/r187, Playwright 1.61.1. This is an audit, not native qualification or authorization to remove code. No production, test, CI, historical artifact, or source-pin changes are proposed.

## Inventory and interpretation

[Machine-readable inventory](TEST_CONSOLIDATION_C5_INVENTORY.json) records **85 exports**: seam 37 values and 32 types; M7N trace 8 values and 8 types. It records tracked `src/` and `scripts/` TypeScript/JavaScript syntax identifiers, declaration lines, named import sources (including type-only versus runtime/mixed), direct calls and other references. It also lists the declared M3 control fields and same-name property-access candidates. Search `rg -n --hidden --glob '!node_modules/**' --glob '!dist/**' --glob '!.git/**' 'groundGlassWebGpuTestSeam|__groundGlassWebGpuM3TestControl|m7nRendererLifecycleTrace|GroundGlassRenderHostStateProvider' .` and individual export names, inspect dynamic imports, namespace/re-export use, browser globals, scripts and historical reports. No namespace import or re-export of either audited module was found in the tracked source and script search; dynamic import and import-original mocking remain separately relevant. Historical report/log mentions are not active imports. Syntactic same-name references are candidates, not a call graph or proof of execution; computed keys, aliases and out-of-repository consumers cannot be excluded. Each value has a direct call or another source reference; four are not directly called: the lazy React initializer `initialGroundGlassRawDebugForTest`, two M7N constants used internally, and the trace-enabled boolean. **No value is established unused**, and all exports/types are retained. The inventory groups symbols for navigation; its group labels and property-name hits do not independently prove a contract or a native test outcome.

| Group | Decision | Principal owners and evidence | Qualification limit |
|---|---|---|---|
| A M3 control/events | R | `GroundGlassRenderHost`, `GroundGlassWebGPUAdapter`, `GroundGlassRenderer`, `GroundGlassViewport`, `SimulatorWorkspace`; browser setup in `ground-glass-webgpu-failure-host.spec.ts` and M5/M6/M7G specs | Narrow seam Unit test covers recovery action routing, not all controls |
| B loss/injection | R | Adapter loss registration and native destroy at lines 4859/4888; M7A/M7B in failure-host spec | Current native boundary blocked below |
| C holds | R | Adapter and Host real async operations; M4/M5/M6/M7G and failure-host browser owners | Native owners not qualified by this audit |
| D M6b/M6c | R, relocation **NEEDS_EVIDENCE** | Renderer fixture import; M6B conformance and M6C alpha specs | No current native fixture pass |
| E CoC/gather/B1 | R | Adapter, B1 probe and M4/M5 native specs; M7E/F/G historical evaluators | Historical captures do not prove a current device |
| F M7N trace | R, relocation **NEEDS_EVIDENCE** | `pages.tsx`, workspace, viewport, Observer lifecycle, SceneRenderer, Host; M7N collector/evaluator tests | Collector test is not browser event truth |
| G provider injection | R; `NEEDS_EQUIVALENT_HOST_OWNERSHIP_PROOF` for removal | `App.tsx` creates app-lifetime provider; `GroundGlassRenderHost.test.tsx` supplies owners to construct lifecycle states | No equivalent replacement demonstrated |

No C or D deletion is authorized by this audit. Bounded relocation may be investigated only with equivalent native fault reproduction, cleanup, event ordering and production comparison. C3's removed clear helper was independently unused; it is not evidence that other helpers are unused.

## Control, injection and lifecycle boundaries

`groundGlassWebGpuTestSeam.ts` uses `import.meta.env.DEV && VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true"` in `getControl`. Tests install `window.__groundGlassWebGpuM3TestControl` with `page.addInitScript`; the module reads it only through the gate. The control contains initial Raw Debug, attempt/generation and ordered event data, injected failure points, compatibility selection, fixtures, barrier callbacks, device triggers, capture requests and recovery actions. Workspace passes the gated initial-state helper as a React initializer. No URL or local-storage activation is used by `getControl`; pure identity/type helpers and ordinary Host state are not themselves evidence of a global being installed. The production test exercises backend/raw-debug/diagnostic query-shaped inputs, not every conceivable fixture query. It does not prove that a user-provided arbitrary script could not itself create a similarly named global.

Adapter `throwIfGroundGlassWebGpuFailureInjected` can throw at initialization, submitted work, readback, presentation, queue completion and disposal; the Host handles the resulting real adapter failure and recovery. M7A's `requestGroundGlassDeviceLoss` invokes the adapter's active-generation loss handler as a **test equivalent**. M7B instead calls `destroy()` on the adapter-owned GPUDevice and observes its actual `device.lost` promise. Registrations are channel-scoped and unregistered on retirement; events include attempt and generation. The failure-host M7A/M7B tests check failure/cleanup and retry/new-session boundaries. These stimuli cannot be merged: a thrown error or equivalent callback does not establish an actual device-loss promise. Current native runs of those tests are **NOT_RUN** here; M7G's blocked preflight is not their result.

## Barriers and protected failures

Every hold below uses the gated control and retains actual operation/request identity in its caller or captured event. Unless noted, its promise waits for the test release callback, which clears hold/reached/callback state; the hold helper itself has no timeout or abort listener. Tests must release in cleanup and adapter retirement/`disposeOwned` must settle the actual work; the audit does not infer that every unmount automatically releases a held promise. This is a preservation and test-harness risk, not a proposed behavior change.

| Mechanism and suspension | Arming / release and owner | Protected failure and current evidence |
|---|---|---|
| Queue completion, Adapter `:2793`, `:4282` | `holdQueueCompletion`; `releaseQueueCompletion`; failure-host D5/M7B and M6 | Pending real work must settle before replacement/cleanup; native **NOT_RUN** |
| Presentation queue, Adapter `:4280` | `holdPresentationQueueCompletion`; explicit release; M6 resize test | Submitted presentation becomes stale after resize; native **NOT_RUN** |
| M5 composite, Adapter `:3397` | matching generation ID, identity contains request/channel/scene/generation; release or **20 s automatic timeout**; M7G `finally` releases | Older submitted R1 cannot publish after R2; current preflight **BLOCKED** before hold; retained M7G capture **HISTORICAL_ONLY** |
| Post-failure operation, Adapter `:4408` | `holdAdapterOperationAfterFailure`; explicit release; failure-host | Hold real failure cleanup while later operations occur; native **NOT_RUN** |
| Completed frame, Host `:495` | matching request ID or next completed frame; callback delivers held result on `releaseHeldFrame`; failure-host | Old completed result cannot replace newer request; native **NOT_RUN** |
| M4 physical CoC readback, Adapter `:3060` | `holdPhysicalCocProbeReadback`; explicit release; physical-coc-app resize and SPA unmount tests | Stale result/retired generation rejected and cleanup confirmed after release; native **NOT_RUN** |
| M5 gather readback, Adapter `:3505` | `holdApertureGatherReadback`; explicit release; aperture-gather-app stale/recovery/resize/SPA tests | Token, capture and request identities distinguish current from superseded publications; native **NOT_RUN** |
| M6c alpha readback, Adapter `:2434` | fixture `holdReadback`; explicit `releaseReadback`; M6c alpha tests | Request change and SPA generation retirement discard held capture; native **NOT_RUN** |

Removing any hold without an equivalent real-boundary negative control would remove or weaken its named reproduction. Test timeout and explicit teardown are not equivalent to a helper-level automatic release. M5's 20 s timeout resets barrier metadata after settling; it is the only bounded automatic release established in these helpers.

## Fault-reproduction evidence map

Evidence labels describe what C5 actually observed; they do not promote the named historical or native tests to current passes.

| Fault / stimulus | Observable guard and named owner | Backend / gate | C5 evidence |
|---|---|---|---|
| Injected adapter failure at queue/initialization stages | Host failure and recovery, `ground-glass-webgpu-failure-host.spec.ts` | Native seam / DEV | NOT_RUN |
| Actual device destroy | `GPUDevice.lost`, active generation failure and cleanup, M7B failure-host | Native seam / DEV | NOT_RUN |
| Held queue work during retirement | No unsafe replacement before actual settlement, D5 and M7C failure-host | Native seam / DEV | NOT_RUN |
| Old frame delivered after newer request | Host rejects stale frame, failure-host held-frame case | Native seam / DEV | NOT_RUN |
| M5 held composite / newer R2 | Retired/stale R1 not published, M7G lifecycle | Native seam / DEV | BLOCKED before stimulus; retained report HISTORICAL_ONLY |
| Held M6c alpha readback | New request or SPA retirement rejects stale capture, M6c alpha spec | Native seam / DEV | NOT_RUN |
| Retired renderer generation | Cleanup and stale publication suppression, M4/M5/M6c browser owners and Host Unit tests | Native DEV / simulated Unit | UNIT_PROVEN for exercised Host states; native NOT_RUN |
| SPA unmount before held readback cleanup | No publication from retired generation after release, M4 unmount and M6c SPA tests | Native seam / DEV | NOT_RUN |
| Missing Canvas / renderer initialization failure | M7N records absence/failure separately from activation; M7N trace Unit and retained investigation | Trace DEV opt-in / historical browser | UNIT_PROVEN collector; HISTORICAL_ONLY runtime; current fault injection NOT_RUN |
| Native required but WebGL fallback | Native specs reject mismatched renderer/API; production preview deliberately expects WebGL | Native required / production default | BLOCKED preflight; BROWSER_PROVEN production WebGL, not native qualification |

## Fixtures, readbacks and Host ownership

`GroundGlassRenderer.tsx:194–223` gates M6b by DEV, non-raw mode and explicit authorized scene/control. The effect derives a dev-server URL and uses `import(/* @vite-ignore */ moduleUrl)`; an `active` cancellation flag suppresses late state publication, the catch clears the module, and cleanup sets the flag false. The adapter also has a DEV-gated, URL-rewriting `@vite-ignore` loader at `GroundGlassWebGPUAdapter.tsx:1963`; it memoizes its promise/module for the adapter lifetime and does not use the renderer effect’s `active` flag. Its callers at lines 2068 and 2752 initialize/update the calibration texture; the evidence publication caller at 4313 rechecks `isRequestCurrent()` after awaiting. Those earlier loader paths must be assessed with their surrounding generation/cleanup logic before relocation; this audit does not claim equivalent cancellation. `ground-glass-webgpu-m6b-conformance.spec.ts` owns mounted physical-overlay alignment, resize and output, and asserts fixture disposal after client-side route retirement. M6c requires DEV, raw pilot, M6 presentation, seam, explicit fixture and exact registered scene. The M6c spec checks real alpha, token identity, hold/release, stale requests, retirement and allocation/disposal counters. These are retained test claims; C5 did not run them to completion. Relocation needs matched native initialization, alpha/capture identity, allocation/disposal and isolation evidence.

Physical CoC requests/readbacks, Aperture Gather tokenized capture/publication records and B1 boundary probes are distinct contracts. The adapter owns native GPU buffers and checks request/generation freshness before publication; the seam consumes a request separately from publishing a result. M4 physical-coc-app owns resize/unmount stale cases, M5 aperture-gather-app owns B1 provenance, fallback and held stale/recovery cases, and M7G owns matched R1/R2 composite publication. CPU reference and saved M7E/F/G reports do not substitute for current native GPU readback. Preserve requested versus actual backend, token/capture versus frame IDs, and active versus retired generations. M7E retained source and digests remain historical.

`GroundGlassRenderHostStateProvider` constructs an owner once with `useState`; an optional supplied owner enables `GroundGlassRenderHost.test.tsx` to set up ownership/generation and pending cleanup states. App uses the default provider. Retain injection pending equivalent multi-channel, generation, cleanup and recovery tests.

## M7N observation and provenance

The trace uses `DEV && VITE_M7N_RENDERER_LIFECYCLE_TRACE === "true"`. Its collector has 512 bounded slots, sequence/time/identity fields, immutable snapshots and a read-only browser snapshot API installed on first event; instrumentation exceptions are swallowed. `pages.tsx` records route/module, workspace records commit/setup/cleanup, SceneViewport and `useObserverRendererLifecycle` record backend, generation and capability transitions, SceneRenderer records container/Canvas/renderer creation and absence, and Host records accepted/stale frame, generation, mount, retirement and failure. The Unit collector test proves buffer/snapshot behavior; event call sites prove instrumentation exists, not that every runtime event occurred. Production preview below verifies absence of the global on its tested route.

The retained `GROUND_GLASS_M7N_RENDERER_LIFECYCLE_REPORT.json` pins execution/instrumentation `5034edf1551466649623a920024057b57f8dddbf` and evaluator `ef79ee9886dacc0a1402fd9271318564e7ccfae6`. The historical report records conflicting Canvas-count and later snapshot observations, not a proven missing Canvas, GPU saturation or renderer failure. Its A→B→A SPA trace is historical browser evidence; collector and evaluator tests here are current Unit evidence. Do not recast it as a current reproduction.

## Production and development output

Canonical `npm run build` exited 0 after `tsc -b`; no `VITE_*`, `GROUND_GLASS*` or `NODE_ENV` variables were set in the shell, Vite production mode and default base `/view-camera-simulator/`. Output was the build-cleared `dist/`, 11 JS chunks totaling **3,401,354 bytes**. JS filename / bytes / SHA-256 prefix (16 hex digits):

| Chunk | Bytes | SHA-256 prefix |
|---|---:|---|
| `GroundGlassWebGPUAdapter-CzadZE68.js` | 124046 | `951be66c9fe66a23` |
| `SimulatorWorkspace-eOj_QOtx.js` | 453269 | `de9ee39eac3d8c84` |
| `index-DRUX6X3G.js` | 903638 | `d96048e7c82620fd` |
| `react-BwGFFZJM.js` | 8708 | `1c456a63242a98fb` |
| `react-fiber-BGRwGTNw.js` | 924396 | `45c477671c8a7495` |
| `react-runtime-CFdvXQJG.js` | 181789 | `552ac4c95d2f6709` |
| `rolldown-runtime-QTnfLwEv.js` | 694 | `5db5ba82eef00d1d` |
| `three-CQk4CGqO.js` | 225726 | `f10a34c33bb68762` |
| `three-stdlib-Cxw2KCsn.js` | 14357 | `eaefd53052dfa13f` |
| `three-webgpu-C1okyZIw.js` | 421481 | `542db343a0250137` |
| `vendor-Ch_qpgZg.js` | 143250 | `3fde822814b15465` |

The complete 58-file output manifest, exact byte counts and full SHA-256 hashes are in the machine-readable inventory; it also includes `index.html`, CSS and copied public assets. Readable `__m7nRendererLifecycleTrace`, injected-failure string, `holdNextM5CompositeGenerationId`, `m6bCalibrationFixture`, `requestGroundGlassDeviceDestroy`, and `releaseApertureGatherReadback` occur in the production index chunk; `__groundGlassWebGpuM3TestControl`, `groundGlassPhysicalOverlayConformance`, `GROUND_GLASS_M6B_GRID_SQUARE_MM`, `m6cAlphaFixture`, and `holdReadback` do not occur as literals. The adapter and `three-webgpu` chunks **exist**: chunk presence is not a request during default navigation, and a missing minified identifier does not prove module absence. Exact module-level byte attribution, reachability of every fragment, and M6b/M6c implementation elimination are **BUNDLE_CONTRIBUTION_UNRESOLVED**. The DEV gate prevents the tested activation; it does not erase all source text. No byte savings are claimed.

A separate temporary dev-server browser probe used Playwright Chromium 149.0.7827.55, base `/`, port 4197 and `page.addInitScript` to install `{initialRawDebug: true}` before navigating to `/simulator/free/architecture-rise`. With both `VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true` and `VITE_M7N_RENDERER_LIFECYCLE_TRACE=true`, Raw RTT was checked and the read-only trace snapshot contained 49 events. With both flags `false`, the same injected object remained present but Raw RTT was unchecked and the trace global absent (zero events). Both probes exited 0. This demonstrates gated control consumption and trace installation for this route; it does not demonstrate native GPU fault reproduction. The scripts are disposable `/private/tmp/c5-dev-probe.cjs` and `/private/tmp/c5-dev-probe-off.cjs`; the control object was supplied by the browser test, not installed by the application.

Comparison build: `NODE_ENV=development VITE_BASE_PATH=/ VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION=true VITE_M7N_RENDERER_LIFECYCLE_TRACE=true vite build --mode development --outDir /private/tmp/c5-development-dist` exited 0, 19 JS files / 4,096,216 bytes, with both global names and the listed seam strings present. Vite warned the external output directory was not automatically emptied; this is an inspection of this output, not a controlled size delta or a dev-server/runtime availability proof. Different NODE_ENV, base, flags and module graph make raw sizes non-comparable.

`npm run test:e2e -- --config=playwright.production.config.ts --project=chromium-production-preview src/tests/e2e/architecture-rise-webgpu-production.spec.ts --workers=1 --retries=0 --output=/private/tmp/c5-production-results` passed **4/4**. The configuration builds with base `/`, then serves production preview. The Architecture Rise case checks contentful Observer and Ground Glass screenshots, WebGL2 selection, no default WebGPU module requests, M3 global undefined and M7N global absent, and denial of query-shaped backend/raw-debug inputs. Other cases deny explicit WebGPU candidates. This demonstrates behavior on tested routes and inputs, not absence of all emitted WebGPU code or exhaustive fixture-query denial. The initial sandboxed attempt could not bind 127.0.0.1 (`EPERM`); the permitted local-server rerun produced the result above.

## Native preflight, evidence layers and CI

`playwright.config.ts` uses `chromium` and the dependent single-worker `chromium-renderer-serial` by default; explicit native flags select headed `chrome-native-webgpu` instead. `playwright.production.config.ts` separately uses `chromium-production-preview`.

On macOS 27.0.1 arm64, Chrome 158.0.8127.88, project `chrome-native-webgpu` (headed), Three r187, one worker, zero retries, C5 ran the M7G held-composite test with `GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1`, `GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED=1`, `GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED=1`, `GROUND_GLASS_WEBGPU_M7G_R187_QUALIFICATION_REQUIRED=1`, and port 4195. The config enables DEV seam, raw pilot and M6 presentation, with a separate WebGL baseline server. Command: `GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED=1 GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED=1 GROUND_GLASS_WEBGPU_M7G_R187_QUALIFICATION_REQUIRED=1 PLAYWRIGHT_WEB_SERVER_PORT=4195 npm run test:e2e -- --project=chrome-native-webgpu --workers=1 --retries=0 --output=/private/tmp/c5-native src/tests/e2e/ground-glass-webgpu-m7g-lifecycle.spec.ts -g 'M7G holds a submitted M5 composite'`. Exit 1: the ready pane reported `webgl-renderer` / attempted WebGL at the native renderer assertion; the test did not reach the actual-execution-API assertion, device availability check or hold. Device availability and precise cause are **unresolved**, not a claim that no GPU exists. Native proof is **BLOCKED**; fallback does not satisfy it. C3 separately saw the same M7G/M6 mismatch on its own base, M5 CoC candidate mismatch, and M7C policy-version mismatch; these are historical leads, not current C5 reproductions. The initial sandboxed preflight failed to bind 4195; the local-server rerun reached the browser result above. No repeats, frozen capture writes, qualification promotion or policy edits were made.

Focused `npm run test -- --run src/tests/unit/groundGlassWebGpuTestSeam.test.ts src/tests/unit/m7nRendererLifecycleTrace.test.ts src/tests/unit/m7nRendererLifecycleEvidence.test.ts src/tests/unit/GroundGlassRenderHost.test.tsx`: **50 passed**, 4 files, 5.66 s, exit 0. The report evaluator is historical-integrity evidence; it is not native GPU execution. Local historical classifier for these two documentation paths returned `NOT_APPLICABLE`, no selected families, because neither changes a frozen-evidence dependency; this is not a native qualification. `webgpu-test-seam` and `webgpu-lifecycle` owners remain provisional with full Vitest/native requirements. The `renderer-lifecycle` owner separately requires the scene-switching E2E test for SPA navigation and real frame delivery. The M7N trace-buffer owner is marked complete for its narrow collector contract; that does not extend to the complete renderer or runtime observation. B1/B2, M7R, M7V, full GitHub Vitest, smoke and preview isolation are unchanged. Current-head GitHub status belongs in the PR handoff.

## Follow-up and rollback

1. Investigate the native WebGPU eligibility/backend prerequisite separately, preserving native assertions and reporting actual device and policy compatibility; rerun M7G, M6 and device loss only after it is resolved.
2. Measure module-level production contribution with reliable bundle attribution and a clean, controlled build pair; extend the development control and trace opt-in probes across other routes and controls. Test explicitly chosen fixture-like query inputs if that broader isolation claim is needed.
3. Only then consider development-only relocation with matched barrier, event-order, resource-disposal and native negative controls. Provider injection requires its own equivalent Host-ownership proof.

Rollback: revert the C5 documentation commit; it changes no runtime behavior. Full native qualification, complete computed-property/external consumer discovery, and module-level production byte attribution remain unresolved. No current cleanup or runtime savings are claimed.

## Independent preservation review

The independent reviewer inspected source, inventory, all 58 artifact hashes, production preview and native preflight evidence. They found no unsupported native-qualification or bundle-elimination claim. Their requested additions identify the adapter loader’s separate cancellation boundary, `GroundGlassViewport`, project list, full artifact manifest, native command, M6b resize/route-retirement assertions, and the renderer-lifecycle E2E requirement. Current-head GitHub CI is reported in the PR handoff.
