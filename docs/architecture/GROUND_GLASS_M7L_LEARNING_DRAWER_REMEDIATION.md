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

The original Playwright JSON capture digests are stored as `sourceCaptureSha256` in the normalized evidence reports. Persisted evidence keeps the exact test identities, outcome statuses, errors, durations, worker IDs, retries, and timestamps used for overlap calculation. It omits local runner environment variables, output paths, and attachments. The focused controlled traces keep bounded state, frame, and transition events rather than repeated pointer-entry logs.

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

The new `m7l-learning-drawer-remediation-evaluator-v1` checker validates the pinned M7K report and raw digests, all 82 identities and historical messages, the exact eleven-case cohort, all persisted Playwright result digests, configured workers, actual overlap derived from start times/durations, retry/flaky/incomplete outcomes, focused regression evidence, and unchanged M7/M8 authorization. Twenty-two named mutation cases cover digest tampering, identity loss/addition, false worker/concurrency claims, hidden retries/incomplete runs, unverified fixes, promoted outcomes, and qualification-boundary changes. A CLI regression verifies that a mutated full-suite qualification exits nonzero.

The GitHub Actions workflow now requires `evidence:check:m7l` after the existing M7K v1/v2 checks. The ordinary Chromium smoke, production-preview WebGL isolation, M7F–M7K gates, and `deploy.needs: ci` remain enabled. The 278-test Broad E2E suite is not added to hosted CI.

## Qualification

M7L’s finding is **scheduling-sensitive and unresolved**, with zero verified fixes. M7K evidence integrity and completeness remain accepted; its Broad E2E qualification remains **not-qualified**. M7 remains **partially-qualified**, M8 entry stays **denied**, spontaneous/external GPU loss remains blocked, M5Q remains partially qualified, M6 remains development-only, Production Ground Glass remains WebGL-only, and Production WebGPU remains disabled.
