# M7S — Learning Drawer Open-State Contract Verification

## Decision

**S3 — No justified correction.** The bounded M7S runs did not reproduce the M7R non-identity transform assertion under the focused light-peer controls or in the current four-worker M7R eleven-identity cohort. No application or shared-helper defect was established. M7S records **zero verified fixes** and does not claim that the M7R cohort is remediated.

The drawer contract is semantic openness followed by its existing visual transition, with a separate visual-ready boundary before desktop Task/Feedback interaction is treated as ready. `openLearningDrawer()` and `openPinnedLearningDrawer()` already wait for identity transform on desktop. Replacing that check with semantic visibility alone would permit an offscreen or materially translated drawer to pass.

## Sources and historical context

- M7R base and behavior under test: `25cfe4948a7cd4ff811f72b416673b26601c6aec`.
- Candidate drawer behavior: unchanged from that base. No application, CSS, or shared drawer-helper file changed.
- M7R's selected cohort is `M7R-CANDIDATE-01-LEARNING-DRAWER-OPEN-STATE`; its exact eleven identities are listed in the [machine-readable report](GROUND_GLASS_M7S_LEARNING_DRAWER_OPEN_STATE_REPORT.json).
- The accepted M7R baseline remains 278 discovered, 118 passed, 85 unexpected, and 75 skipped. Its raw evidence and report were not edited.
- The preserved M7R report digest is `b39b3c4b4a0c56b8d62120ccc62dfcca509e37356c565538316d983dc44b4823`; the M7R evidence gate still validates its normalized capture, manifest, and ordinary/renderer-serial report digests.
- M7L recorded 11/11 passes at one worker, 9/11 at two workers, and 4/11 at four workers. M7L's eleven identities are a different cohort. Its intermediate-transform and delayed-transition observations are historical context, not M7S outcomes or a shared root-cause proof.

M7R's retained raw logs showed 11 failures at the shared helper's desktop identity-transform assertion, with a connected drawer, `aria-hidden="false"`, and a nonzero horizontal transform. That identifies a common failure point; it does not identify why the drawer remained translated or prove an application defect.

## Public state and readiness contract

| State | Semantic/accessibility state | Visual and interaction contract |
| --- | --- | --- |
| `peek` | `aria-expanded="false"`; drawer `aria-hidden="true"` | Desktop drawer is hidden, translated by its width plus 8 px, and has no pointer events. Task/Feedback inside it are unavailable. |
| `transient` | `aria-expanded="true"`; drawer `aria-hidden="false"` | A 190 ms transform/visibility transition starts. Semantic openness may precede final geometry. Desktop visual readiness is the visible drawer at identity transform, within the stage; then Task/Feedback and drawer actions are available. |
| `pinned` | `aria-expanded="true"`; drawer `aria-hidden="false"` | Same fully open geometry as transient; pointer-out does not close it. |
| `flow` | Narrow layout, at or below 900 px | Drawer is in normal document flow with no desktop transform or transition. The desktop identity-transform assertion is not required. |

Reduced motion disables the transition. The drawer must reach open geometry without waiting for a `transitionend` event. No new readiness attribute or test-only application API was introduced.

The existing `toHaveCSS("transform", identity)` assertion is a visual-ready assertion, not merely an assertion of semantic visibility. A nonzero translation is materially different geometry and remains a valid failure. Task/Feedback availability is checked separately by the existing public-content and interaction assertions.

## Bounded experiments

Environment: Node 24.3.0, Playwright 1.61.1, Chromium 149.0.7827.55, macOS arm64, application-default WebGL, zero retries. Each invocation used a fresh strict-port Vite server. The original three light peers were taken from M7Q: responsive concept-learning grids, simulator-header lesson context, and application home smoke.

| Control | Workers | Result | Four-way overlap |
| --- | ---: | --- | --- |
| Architecture + Foreground transient-open M7R identity | 1 | Passed, 1/1 | — |
| Architecture + Foreground pinned-open M7R identity | 1 | Passed, 1/1 | — |
| Existing closed/peek, open, pin, outside-pointer, and close regression | 1 | Passed, 1/1 | — |
| Transient-open target plus the three M7Q light peers | 4 | Passed, 4/4 | 606 ms across worker indices 0–3; target participated |
| Pinned-open target plus the three M7Q light peers | 4 | Passed, 4/4 | 956 ms across worker indices 0–3; target participated |
| Opt-in transient transition probe plus the same three peers | 4 | Passed, 4/4 | 675 ms across worker indices 0–3; target participated |

The exact M7R eleven-identity cohort was then run once with four workers and zero retries. Four tests overlapped at peak, on worker indices 0–3, with an Architecture + Foreground target in that overlap. Results were **8 passed, 2 failed, and 1 timed out**; Playwright correctly exited 1 for those three test failures. None failed the original drawer-transform assertion:

- `Interior Corner completes the public Compose → Swing → Refine → Aperture lesson`: different failure, `Step 1 of 5` drawer content was not found.
- `Interior Corner free mode exposes reachable Rise composition feedback`: different failure, the Rise slider was not found.
- `Interior Corner free mode exposes public Swing + Focus wall alignment`: different failure, the test reached its 120-second timeout.

All eleven outcomes and their worker start/duration records are preserved in [`capture/baseline-experiment.json`](ground-glass-m7s-learning-drawer/capture/baseline-experiment.json). Passing identities are classified `passed-once-not-verified`, not fixed. The three changed failure surfaces remain unresolved.

## Transition observations

The opt-in, test-side probe records `data-drawer-state`, ARIA state, computed transform, bounds, visibility, transition duration, and `transitionrun/start/end/cancel` callbacks. A MutationObserver timestamp is explicitly treated as a callback time, not the exact DOM mutation time. Browser `performance.now()` and Node `hrtime`/wall-clock observations remain separate. The probe does not inspect Playwright's private matcher retries.

To run its bounded single-worker controls, set `M7S_DRAWER_CAPTURE=1` and use `npm run test:e2e -- --config=playwright.m7s-diagnostic.config.ts --project=chromium --workers=1 --retries=0`. The capture used an isolated `PLAYWRIGHT_WEB_SERVER_PORT`. The diagnostic filename is not matched by default Playwright discovery.

In the single-worker transient capture, the MutationObserver callback recorded `transient`, `aria-expanded=true`, `aria-hidden=false`, and the closed transform at `-288px`. Later transition callbacks recorded identity geometry and the helper settled at the fully open state. In the four-worker light-peer probe, the callback samples similarly moved from `peek`/`-288px` to `transient`/`-288px`, then recorded transition callbacks and identity geometry. The start/end callbacks shared the same recorded performance timestamp at available precision; this does not reconstruct continuous frame-by-frame animation.

In the pinned probe, `transitionrun/start` callbacks recorded a translated transform, and `transitionend` later recorded identity geometry; the pinned state remained open. The callback timestamps were about 2.5 seconds apart. This records delayed event delivery in that capture but does not establish the cause or the actual composited animation interval. No transition cancellation or return-to-peek callback was observed in the probe captures.

The reduced-motion probe recorded `transitionDuration: 0s`, no transition events, and identity geometry; the open helper passed. The four-worker light-peer probe did not reproduce the M7R transform failure. These captures support the intended semantic-open-then-visual-ready contract under the tested conditions. They do not explain the historical full-suite failures.

## Regression and negative controls

- `LearningOverlayPanel.test.tsx`: 14/14 passed, including peek/ARIA state, pinning, Escape, and focus restoration.
- The existing viewport drawer suite passed the closed/peek and pin flow, keyboard focus and Escape, Task/Feedback content and completion, narrow in-flow layout, and Ground Glass layout checks.
- Its one unrelated failure was the constrained desktop Scenes overlay test: it expected `.scene-overlay-controls-wrap` to be `position: static` but received `absolute` at `viewport-learning-overlay.spec.ts:343`. No drawer-state assertion failed and that surface was not changed.
- The opt-in reduced-motion control passed without waiting for transition events.
- The diagnostic test uses a dedicated Playwright config and a `.diagnostic.ts` filename. Default Playwright discovery does not include it; this preserves the historical 278-test inventory.

## Correction route and closure

No application change and no test-helper relaxation are justified. Single-worker opens reached the intended geometry. Four-worker light-peer opens did too. The current exact eleven-test run did not reproduce the transform failure and produced three different errors. The historical M7R failure captures do not retain transition lifecycle timestamps that could distinguish delayed transition progress, state reversal, or another browser scheduling effect.

M7S therefore closes this focused contract check as **S3**, with zero verified fixes. It does not start another general scheduling investigation or claim the historical cohort is cleared. The three current different-failure identities remain visible for M7 qualification triage.

## Qualification and validation boundary

M7R remains 278 discovered, 118 passed, 85 unexpected, 75 skipped. Broad E2E remains `not-qualified`; M7 remains `partially-qualified`; M8 entry remains denied; spontaneous/external GPU device loss remains blocked; production Ground Glass remains WebGL-only; production WebGPU remains disabled. M7S does not alter historical M7R or M7L evidence and does not qualify the broad suite.

The focused unit suite passed 14/14. Typecheck and targeted lint passed. M7K, M7L normalized-scope, and M7R offline evidence checks passed. The viewport Learning Drawer suite passed 8/9, with the separate Scene-overlay positioning failure described above. The full 278-test suite, other historical capture campaigns, and native GPU tests were not run. Both branch-push and pull-request CI passed on implementation HEAD `9ee8a87173fa94de630f5f4de4ec6955b3ec0ca2`, including ordinary Chromium smoke, production-preview WebGL isolation, and retained M7F–M7R evidence checks. The PR deploy jobs were skipped. A subsequent report-only commit is being checked separately on its final HEAD.
