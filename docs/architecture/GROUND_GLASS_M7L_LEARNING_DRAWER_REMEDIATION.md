# M7L — Learning Drawer Failure-Cohort Remediation

## Result

M7L investigated the eleven Learning Drawer / Overlay identities selected from the accepted M7K baseline. The exact cohort passed **11/11 with one worker**, fell to **9/11 with two workers**, and **4/11 with four workers**, all with zero retries. This is reproducible concurrency sensitivity, but it does not establish one shared application defect.

The four-worker failures divide into intermediate drawer-transform assertions and content/task assertions. A one-run controlled comparison showed slower sampled frame/transition progress with WebGL-heavy peers than with lightweight peers, while both target runs passed. This supports scheduling pressure as a possible contributor. It does not prove renderer contention as the sole cause. The Oblique Tabletop missing-step failure remains separate from the transform failures.

No application or assertion change is justified by this evidence. M7L records **zero verified fixes**, preserves the eleven cases and all 82 historical failures, and leaves the Broad E2E result **not-qualified**.

## Baseline and provenance

- M7L base and UI implementation under test: `ed51a370689421befc9e33b8367f05e2e71308eb` (PR #309 merge, ancestor of `origin/main` when this worktree was created).
- The M7L PR changes evidence, offline evaluation, and tests only. There is no changed application candidate to compare; its behavior source remains the same base commit.
- Environment: macOS arm64, Node `v24.3.0`, npm `11.12.0`, Playwright `1.61.1`, Chromium `149.0.7827.55`, Three.js `0.187.0`, headless ordinary Chromium at `1280×720`, WebGL2 SwiftShader path, no native WebGPU or research seams.
- All primary runs used zero retries and completed the discovered 11-test cohort. The clean four-worker capture had no diagnostic instrumentation.
- Configured worker limits and actual maximum overlapping test pages agreed: 1, 2, and 4. Playwright restarted workers after failures, so its worker indexes reached 10 in the four-worker report; worker indexes are not used as the concurrency measurement.
- The accepted M7K full-suite reports and raw captures remain unchanged.

The normalized evidence files retain the original values in `sourceCaptureSha256`; these are recorded source-capture digests, not proof that the original bytes remain available. Persisted evidence keeps the test identities, outcome statuses, errors, durations, worker IDs, retries, and timestamps used for overlap calculation. It omits local runner environment variables, output paths, and attachments. The focused controlled traces keep bounded state, frame, and transition events rather than repeated pointer-entry logs.

| Run | Configured / actual overlap | Result | Duration | Source capture SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Representative Architecture + Foreground DOF alone | 1 / 1 | 1 passed | 35.5 s | `c72c864bb506d1a86dae17826249a00eae7d5cf36c0ade319f2ec22ed42cecc8` |
| Eleven-case cohort | 1 / 1 | 11 passed, 0 failed | 14m 22s | `34611073b34e7ca57c131fcb097e41a5944724dc9eba41e62608407036d8edf3` |
| Eleven-case cohort | 2 / 2 | 9 passed, 2 timed out | 10m 43s | `0aca6f968973fd5e33e44503b9d7bb20ebdd652e06b496c6de6b1d9ced7de621` |
| Eleven-case cohort, clean and uninstrumented | 4 / 4 | 4 passed, 7 failed | 1m 49s | `ed628e6fa7d96771ea461bacbc2bb3587d85a9e98acd5648fa2d3c43633bec99` |

The compact outcome files and their independently pinned digests are under [`ground-glass-m7l-learning-drawer/`](ground-glass-m7l-learning-drawer/). The complete 82-identity inventory is [`historical-82-failure-inventory.json`](ground-glass-m7l-learning-drawer/historical-82-failure-inventory.json).

## Eleven-case matrix

All 11 identities passed in the one-worker run. At two workers, the Oblique Architecture compound task and four-stage guided lesson timed out while Playwright waited for task actions. At four workers, five tests failed the completed-position CSS assertion, one Oblique Architecture test failed on missing lesson-stage text, and Oblique Tabletop failed on missing `Step 1 of 6` text. The four remaining identities passed. Per-test results and the historical error messages are in the inventory file.

| Identity | M7K historical signature | 1 worker | 2 workers | 4 workers |
| --- | --- | --- | --- | --- |
| `architecture-foreground-dof.spec.ts` — Architecture + Foreground DOF task starts solved through PR7C and completes with Aperture only | CSS transform | passed | passed | passed |
| `architecture-foreground-guided-lesson.spec.ts` — Architecture + Foreground lesson entry resets after Free Practice and direct task routes stay standalone | CSS transform | passed | passed | passed |
| `interior-corner-guided-lesson.spec.ts` — Interior Corner completes the public Compose → Swing → Refine → Aperture lesson | CSS transform | passed | passed | CSS assertion failed |
| `interior-corner-guided-lesson.spec.ts` — Interior Corner keeps the solved focus state when returning to Swing | CSS transform | passed | passed | CSS assertion failed |
| `interior-corner-rise-composition.spec.ts` — Interior Corner free mode exposes reachable Rise composition feedback | CSS transform | passed | passed | passed |
| `mirror-shift-guided-lesson.spec.ts` — Mirror Shift guided task teaches camera movement followed by opposite Front Shift | CSS transform | passed | passed | CSS assertion failed |
| `oblique-architecture.spec.ts` — Oblique Architecture compound task solves Rise, Swing, and Focus from neutral | CSS transform | passed | timed out | CSS assertion failed |
| `oblique-architecture.spec.ts` — Oblique Architecture guided lesson progresses through the four stages | CSS transform | passed | timed out | lesson-stage text assertion failed |
| `oblique-architecture.spec.ts` — Oblique Architecture guided Rise task solves observable framing and restarts to neutral | CSS transform | passed | passed | CSS assertion failed |
| `oblique-tabletop-guided-lesson.spec.ts` — Oblique Tabletop completes the public Focus → Tilt → Swing → Focus → Aperture lesson | missing drawer step text | passed | passed | `Step 1 of 6` text missing |
| `table-tilt.spec.ts` — Table Tilt zero-tilt point focus moves from near to middle to far | CSS transform | passed | passed | passed |

## Drawer behavior and diagnosis

The canonical desktop states are `peek`, `transient`, and `pinned`; narrow layouts initialize in `flow`. Hover, focus, and click on the desktop rail open the drawer transiently; touch activation uses stable open behavior. Pinning changes transient to pinned. The rail publishes `aria-expanded`, the panel publishes `data-drawer-state`, and the drawer sets `aria-hidden=false` whenever the state is not `peek`.

Pointer movement outside the rail and drawer schedules a 400 ms close only for an unfocused transient drawer. Focus inside the panel clears the close timer. Escape and the close action explicitly close and restore rail focus. A route, mode, scene, task, or narrow-layout change resets the drawer state. Desktop CSS uses a 190 ms transform/visibility transition. Narrow layouts use an in-flow panel with no transition; reduced-motion also disables the transition.

The clean four-worker failures show a nonzero negative transform while the drawer is semantically open. In the controlled diagnostic traces, opening changed the drawer to `transient`, `aria-hidden` became false, the element stayed mounted, and the page stayed visible while the transform initially remained at `-288px`. One guided run with three renderer-heavy peers observed a transition start about **1.60 s** after the open-state mutation; the same target with three lightweight peers observed about **0.59 s**. The controlled profiles were each run once, and both passed, so this is a signal for further investigation rather than a causal proof.

The focused existing overlay regressions passed **6/6** with one worker and zero retries. They cover pointer-out close behavior, keyboard focus and Escape, internal scrolling, narrow in-flow behavior, and desktop/narrow Ground Glass expansion. This supports the conclusion that the prior M7I pointer-out correction and the current accessibility behavior remain intact.

| Hypothesis | Finding |
| --- | --- |
| Shared open/close state race | Not demonstrated. The sampled transform failures retain the requested open state; no superseding close was observed. A race in an unobserved run is not ruled out. |
| CSS transition scheduling | Supported as a contributor. Intermediate transforms and delayed sampled frames/transitions appear under concurrent load. No product timing change is justified from one controlled comparison. |
| Pointer hit testing | Not demonstrated in the sampled failures. Pointer-out regression passed; this does not prove every pointer ordering is safe. |
| Renderer contention | Plausible, not established. Heavy and light profiles both passed; one guided sample was slower with heavy peers. |
| Missing lesson content | Separate unresolved mechanism. Content assertions are not evidence of the same transform cause. |

The drawer tests assert a completed open transform after a bounded Playwright wait. M7L did not replace that with visibility-only checks, arbitrary sleeps, retries, or a longer global timeout. No confirmed shared defect or test-only synchronization defect was isolated, so the safest result is to retain the current behavior and assertions.

## Preserved backlog and next cohort

The historical M7K result remains **278 discovered, 121 passed, 82 unexpected, 75 skipped, 0 flaky, 0 incomplete**. Ten of the target failures were CSS assertions and one was missing drawer content. The primary M7L matrix adds a current source observation only; it does not rewrite those historical outcomes or the accepted full-suite qualification.

The inventory retains all **82** unexpected identities with the original outcome, signature, and error message. Eleven are the drawer investigation cohort; the other **71** remain unexecuted in M7L. M7L verified **zero** fixes. Passing at one worker is recorded as a non-reproduction under that configuration, not a repaired test.

Recommended next cohort: the 12 historical cases grouped by explicit scene/renderer readiness selectors such as missing `scene-canvas`, Scene heading, or RTT content. This is a triage candidate, not a common-root-cause claim. The inventory lists each identity and ranks it by its historical assertion surface. The investigation should first reproduce a small matched subset before any production lifecycle changes.

## Evidence gate and CI

The `m7l-learning-drawer-remediation-evaluator-v2` checker validates the persisted normalized artifact bytes, pinned M7K raw artifacts and report, all 82 identities and historical messages, the exact eleven-case cohort, configured workers, overlap derived from start times/durations, retry/flaky/incomplete outcomes, focused regression evidence, and unchanged M7/M8 authorization. It reports normalized artifact integrity separately from the original M7L raw-capture and raw-to-normalized statuses. Twenty-nine named mutation cases cover digest tampering, identity loss/addition, false worker/concurrency claims, hidden retries/incomplete runs, unverified fixes, promoted outcomes, and raw-provenance overclaims. CLI regressions verify that false Broad E2E qualification and false raw-verification claims exit nonzero.

The GitHub Actions workflow now requires `evidence:check:m7l` after the existing M7K v1/v2 checks. The ordinary Chromium smoke, production-preview WebGL isolation, M7F–M7K gates, and `deploy.needs: ci` remain enabled. The 278-test Broad E2E suite is not added to hosted CI.

The original M7L implementation passed hosted CI on reviewed HEAD `7a184c46df10c409324997f05293ab23f71d0b23`: [CI run 1894](https://github.com/chau-hm/view-camera-simulator/actions/runs/41859951700). That run predates evaluator v2 and does not validate this review fix. Round 1's final-head CI result is recorded below after the updated branch is checked.

## M7L Review-Fix Round 1 — Raw Capture Provenance Verification Boundary

The review finding was that the evaluator compared each normalized artifact's `sourceCaptureSha256` metadata with a pinned string but did not have the original M7L Playwright bytes to recompute that digest or replay a raw-to-normalized transformation. The normalized bytes and their pinned artifact digests were independently checked; the original raw-to-normalized relationship was not.

During this review, all seven original Playwright JSON files were found under `/private/tmp`. Their local byte lengths and recomputed SHA-256 values matched the recorded source digests. None was unavailable during this local audit. However, the files contain developer-specific absolute paths, complete process environment values, and local Codex session identifiers. They are not committed, no durable external raw-artifact store exists, and the offline CI evaluator cannot retrieve them. No deterministic M7L normalizer was found, and raw-to-normalized replay was not performed. The local digest checks are recorded for traceability; they are not presented as a reproducible CI verification.

| Experiment | Local raw path | Bytes | Expected and locally computed raw SHA-256 | Normalized artifact SHA-256 | Offline raw / normalization status |
| --- | --- | ---: | --- | --- | --- |
| `single-case-w1` | `/private/tmp/m7l-baseline-single-architecture-foreground.json` | 9,857 | `c72c864bb506d1a86dae17826249a00eae7d5cf36c0ade319f2ec22ed42cecc8` | `27ebfa11c8f0d32363d8d6b6f97c7d63148d81a16b018d82c6cfe98c7341bf04` | Unverified / unverified |
| `cohort-w1` | `/private/tmp/m7l-baseline-w1-attempt-1.json` | 22,612 | `34611073b34e7ca57c131fcb097e41a5944724dc9eba41e62608407036d8edf3` | `6235e161419b8398d8a8b7739657d776de55ca030c49ff4a0b0de6d05e7da2e7` | Unverified / unverified |
| `cohort-w2` | `/private/tmp/m7l-baseline-w2-attempt-1.json` | 27,358 | `0aca6f968973fd5e33e44503b9d7bb20ebdd652e06b496c6de6b1d9ced7de621` | `42ed4f4ddc21f438dc3ab86098c23244d9950a1b4f52e9bcff284da49546ad26` | Unverified / unverified |
| `cohort-w4` | `/private/tmp/m7l-baseline-w4-clean-attempt-1.json` | 64,803 | `ed628e6fa7d96771ea461bacbc2bb3587d85a9e98acd5648fa2d3c43633bec99` | `dc7a1151818d855b8353e9010c6edd127c301d4ea3f63f939118e6869d5c62ef` | Unverified / unverified |
| `controlled-heavy-free-w4` | `/private/tmp/m7l-controlled-heavy.json` | 32,754 | `c3e310cfc0c2c11181403c6607285f22048465a18dee9abb2beb2a803bce6048` | `070599e80d6eee511fc1ae2835cfc9530fa94b2c2cae5fbe9749f1dc2b3cc9a1` | Unverified / unverified |
| `controlled-heavy-guided-w4` | `/private/tmp/m7l-controlled-heavy-guided.json` | 38,726 | `d740041258592627531be1101229784218e19121c78f1e7d1a8555d3228c005c` | `e561049449352901b61e8e74544db265d0f426807961715effb5962104507c2c` | Unverified / unverified |
| `controlled-light-guided-w4` | `/private/tmp/m7l-controlled-light.json` | 38,717 | `d870796260a9073b6b89042509f77bb9a1053716766c00d056b337494ff8d03a` | `c308e99787c7e88b39bf012f07a360aaac78def37686c4adb260680aaf757ed1` | Unverified / unverified |

Evaluator v2 accepts `evidenceIntegrity: passed` only for the stated scope of persisted normalized M7L artifacts and the independently retained M7K evidence. It separately returns `normalizedArtifactIntegrity: passed`, `originalRawCaptureProvenance: unverified`, and `rawToNormalizedNormalization: unverified`. The seven source SHA values remain in the report as recorded metadata. A claim that the raw sources are available to the offline evaluator or that normalization was reproduced is rejected.

The CLI prints all three statuses and labels the overall pass as normalized-scope evidence integrity. The expanded 29-case mutation manifest includes false raw and normalization verification claims, a changed local audit digest, contradictory availability/retention claims, and replacing a source digest with a normalized artifact digest. The focused M7L suite passed 33/33 tests. The unchanged normalized artifact digests and M7L results remain 11/11, 9/11, and 4/11; six focused regressions pass, and verified application fixes remain zero.

Local validation passed: `npm test` (319 files, 3,736 tests), typecheck, lint, CSS structure, build, and M7H/I/J/K/L evidence checks. M7F replay passed 17 scenarios, and the M7G diagnostic report passed evidence integrity with 5 passed and 2 blocked scenarios. Both generated reports used temporary output files that were removed afterward. No browser suite or new capture was run for this provenance correction.

The correction does not establish raw-to-normalized reproducibility or change the causal interpretation. Concurrency sensitivity remains observed, CSS transition scheduling remains a supported contributor, renderer contention remains plausible, the shared application root cause remains unestablished, and Broad E2E remains not-qualified. Final Round 1 validation and hosted CI are recorded in the final reviewer handoff.

## Qualification

M7L’s finding is **scheduling-sensitive and unresolved**, with zero verified fixes. M7K evidence integrity and completeness remain accepted; its Broad E2E qualification remains **not-qualified**. M7 remains **partially-qualified**, M8 entry stays **denied**, spontaneous/external GPU loss remains blocked, M5Q remains partially qualified, M6 remains development-only, Production Ground Glass remains WebGL-only, and Production WebGPU remains disabled.
