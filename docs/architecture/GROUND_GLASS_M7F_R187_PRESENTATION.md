# M7F — Three.js r187 M6 Presentation Requalification

**Result:** Scoped r187 M6 implementation conformance passed for the captured Chrome/macOS environment. Photographic quality remains unqualified. M7 is incomplete; this result does not authorize M8, M9, or production WebGPU.

## Scope and compatibility boundary

This qualification covers the Architecture Rise final presentation path consuming the existing M3 Raw RTT, M4 Physical CoC, M5 Far/Near Gather and B1 reconstruction, and opaque M6 composite. It validates final-output implementation behavior on the installed Three.js `0.187.0` package. It does not requalify the M5Q photographic-quality matrix or establish physical-overlay alignment on the registered Architecture Rise scene.

The accepted revision-specific M6 record is `m6-architecture-rise-native-presentation-r187-v1`. Its scoped state is `implementation-verified`; its quality state remains `quality-unqualified`. M6 presentation evidence is not renderer-selection authority. The r187 M3 Raw RTT record remains the only renderer-attempt authority. M4 and M5 retain their separate `research-only` evidence records, historical r186 records are unchanged, and production Ground Glass remains WebGL-only.

## Runtime and provenance

Native captures were collected from source SHA `b10118bd0f656296451520ba10f4d32347a9a552` with Three.js package `0.187.0`, runtime revision `r187`, renderer family `webgpu-renderer`, actual execution API `webgpu`, and internal fallback `none`. The browser was Chrome `156.0.8078.76` on `darwin 27.0.0 arm64`, with Node `v24.3.0`. No hardware-acceleration claim is made from browser capability alone.

Native project invocation:

```bash
GROUND_GLASS_NATIVE_WEBGPU_REQUIRED=1 \
GROUND_GLASS_WEBGPU_M6_PRESENTATION_REQUIRED=1 \
GROUND_GLASS_WEBGPU_M6_R187_QUALIFICATION_REQUIRED=1 \
VITE_GROUND_GLASS_WEBGPU_RAW_PILOT=true \
npx playwright test \
  src/tests/e2e/ground-glass-webgpu-m6-presentation.spec.ts \
  src/tests/e2e/ground-glass-webgpu-m6b-conformance.spec.ts \
  src/tests/e2e/ground-glass-webgpu-m6c-alpha.spec.ts \
  src/tests/e2e/ground-glass-webgpu-aperture-gather-app.spec.ts \
  --project=chrome-native-webgpu --workers=1 --grep "native M6"
```

The full native invocation and per-capture provenance are persisted with the [M7F report](GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json) and [capture artifacts](ground-glass-m7f-r187-presentation/). The native-required run passed 14 Playwright tests. Offline replay re-evaluated the persisted records and accepted all 17 declared evidence scenarios: 17 passed, 0 failed, 0 blocked, 0 not-run; declared and computed counts match. Replay validates captured evidence and does not reproduce GPU execution.

## Presentation and output results

The M6D production composite node was evaluated against five controlled Near-coverage inputs in an observed `rgba16float` target. All outputs matched the expected Far/Near blend, from `[0.75, 0.5, 0.25, 1]` at zero Near coverage through `[0.25, 0.75, 0.5, 1]` at full coverage. Target allocation, renderer-state restoration, queue completion, and temporary-resource disposal were observed. The persisted M5 input capture identified the accepted current request, channel, scene, and renderer generation.

M6B spatial conformance passed all 14 frozen controlled-fixture states. Across 77 measured visible landmarks, maximum error was `1.5492 CSS px` under the unchanged `2 CSS px` limit; aggregate RMS was `0.6824 CSS px` under the per-capture `1.25 CSS px` limit. Another 105 landmarks were outside the active crop; there were no unsupported measurements. The nine-state RGB oracle covered 206 samples with maximum error of 1 eight-bit code and RMSE `0.0805` codes, within the unchanged gates of 4 codes and 2.5 RMSE.

These spatial measurements use the development calibration fixture. The registered Architecture Rise scene's visible grid is decorative CSS and does not provide physical-overlay alignment evidence. The registered app capture does show the current M3–M6 request and completed research composite rendered to a contentful output, but does not qualify photographic quality.

M6C exercised the same presentation material over 15 source-alpha inputs and held readbacks across request and generation retirement. The output contract remains explicitly opaque: the canvas is opaque and the RGBA8 probe target read alpha 255 for each selected sample. This confirms the existing opaque M6D contract; it does not establish preservation of source alpha. The separate historical M6C `alpha-observable-contract-different` status remains meaningful and unchanged. The probe allocated and disposed 13 temporary targets with no normal-frame target allocation.

## Lifecycle and failure evidence

The new native inventory covers:

- Native M3/M4/M5/M6 request identity and Raw-first resource provisioning.
- Incomplete M5 composite input: the injected aperture-composite failure was observed; the M6 prerequisite check failed the presentation operation, published no M6 frame, and the adapter cleanup and host acknowledgement preceded bounded WebGL fallback.
- Optical resource initialization, presentation-node initialization, presentation-pass, and final-display failure paths.
- Stale presentation data after resize, request change, and retired-generation/unmount transitions.
- Unsupported scene denial.
- Production isolation under hostile development flags and an explicit WebGPU query.

The evaluator checks native runtime identity, request/generation evidence, failure stage, cleanup acknowledgement, replacement order, stale-result decisions, capture SHA, and inventory counts. The production preview ran two tests; its report records WebGL selection and mounted `webgl-renderer` / `webgl2`, zero WebGPU pilot attempts, no test-seam global, and no WebGPU module requests. It passed with hostile WebGPU build flags and explicit query parameters.

The new incomplete-composite case verifies that an M5 composite failure cannot be published as successful M6 output. It does not hold the M5 composite itself pending while changing the request; that specific interleaving remains a gap. No spontaneous device-loss or cross-device/browser matrix is claimed by M7F.

## Qualification decision and limits

The persisted evaluator reports `passed` for the bounded r187 M6 implementation-conformance inventory. `photographicQuality` remains `unqualified`; historical M5Q `m5q-architecture-rise-r186-v3` and M6D `m6d-opaque-presentation-v1` were not rewritten. M5Q measurements and thresholds are unchanged. M6 evidence does not select or retry a renderer. r187 M4/M5 remain separately scoped research-only evidence, and M6 is limited to the exact development Architecture Rise request.

Remaining gaps include registered-scene physical overlay evidence, an M5-composite-pending request interleaving, broader browser/device coverage, and photographic-quality qualification. M7 remains incomplete. M8 and M9 are not authorized, and production WebGPU remains disabled.

## Review-Fix Round 1 — Evidence integrity

The first review found four evidence-integrity defects. The replay command returned success when one or more required records were missing or a scenario was blocked; the stale-resize evaluator trusted summary booleans without rejecting a contradictory accepted host event; the RGB CPU oracle used the serialized sample color as its source; and the M6 policy summary said 16 of 16 while the required inventory contained 17 scenarios.

The corrected offline replay exits nonzero unless all 17 required scenarios pass, report and evaluator identities match, declared and computed inventories agree, the six conformance decisions pass, scoped authorization remains valid, the native capture commit exists locally, and all required JSON parses cleanly. The report now separates native capture source SHA `b10118bd0f656296451520ba10f4d32347a9a552`, replay implementation commit, and report-generation commit. The evaluator revision is `m7f-r187-presentation-evaluator-v2`.

Stale-resize replay derives the latest-request boundary from ordered events. Any stale host acceptance after that boundary fails; a stale adapter completion requires a later host rejection with matching attempt, host, channel, scene, and generation. Current publication must follow the native runtime/mount, scene-render queue settlement, and adapter completion, then match the final host request and generation snapshot. Regression controls cover accepted stale results, missing or wrong-generation rejection, out-of-order events, and a valid stale completion rejected by the current host. A prior accepted frame before the new-request boundary remains valid.

For RGB replay, the CPU oracle now regenerates the deterministic calibration texture from each captured presentation state and crop, derives the sampled texel from the display pixel and mapped source UV, then compares the serialized source sample, expected linear output, sRGB expectation, measured canvas value, and summaries against that independent result. Source/destination dimensions, texture fingerprint, and the nearest-edge saturated-red boundary are validated. The GPU observations and frozen error limits are unchanged.

The M6 policy record now states 17 of 17 and a unit test ties that statement to the evaluator inventory. The persisted native captures were not rewritten, and no M6 rendering code, RGB thresholds, M5Q evidence, or r186 evidence changed. The review-fix verification is offline replay plus mutation-sensitive unit and CLI integration tests; no new native GPU run was required because this correction changes replay logic and report integrity only. The complete updated replay result and provenance are in the [M7F report](GROUND_GLASS_M7F_R187_PRESENTATION_REPORT.json).
