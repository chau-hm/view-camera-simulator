# PR 379 qualification

**Decision: MACRO_TOURBILLON_QUALIFICATION_NEEDS_REFINEMENT**. This is not a merge or visual acceptance verdict. The qualification work preserves the accepted watch and lighting.

## Historical qualification

The hardware capture is a current evidence producer, not an archive consumer. The routing audit pins the capture, its local slider helper and hardware configuration; changed or missing bytes and unrelated unknown evidence dependencies remain fail-closed. Focused routing tests passed 28/28 and the historical incident regression passed. Local changed-file qualification against the PR diff plus routing edits returned **QUALIFIED** with all selected M7E–M7Q and M7W validators passing. This does not independently verify current capture images or substitute for hosted event qualification.

## Depth precision

**DEPTH24_NEEDS_REFINEMENT.** [Controlled A/B and framebuffer evidence](depth/README.md) shows 16-bit loss of dial features in scene color before DOF and recovery at 24 bits. The actual target has a complete 24-bit depth attachment on Chrome Metal and Chromium SwiftShader; the internal format is inferred from Three.js r187's implementation. Seven focused resource/optical suites passed 47 tests. The additional 24-bit cross-scene capture timed out at B5 before reaching control scenes, so shared cross-scene optical equivalence and direct CoC/depth image evidence remain open. No production optical formula or watch geometry changed.

## Architecture attribution

Both prior failures remain **UNRESOLVED**. Original-spec runs on base 97651a38, previous integration 811456d2, and head bc859508 each passed discovery and timed out operating public focus sliders before either original assertion. Base and previous runs overlapped other work; their seeds and load differed. Focused head runs also timed out before their assertions, including Free Practice with the base-observed public seed 4109674240, schema version 1. Traces are retained under /private/tmp/macro-arch-{base,previous,head}-results and /private/tmp/macro-arch-head-focused-{free,guided}. These timeouts do not establish regression attribution.

## Animation and lifecycle

The public catalog re-entry restarts the cage epoch; store reset actions are separate and Macro Bellows has no public Movement Reset button. Focus and aperture do not reset the epoch. Circular comparisons now tolerate 60-second wrap. Hardware Macro Bellows E2E passed 3/3 and SPA scene switching 1/1. The canvas diagnostic samples the mesh before RTT completion, so it is not proof of accepted-frame phase or presentation latency. Focused tests verify source texture, PMREM generator, target disposal and restoration across two softbox entries; SPA tests show fresh ownership and environment isolation, not direct GPU allocation counters.

## Local validation and blockers

Focused lifecycle tests passed 62/62. Typecheck, lint, CSS check, and build passed. One full unit run under concurrent browser and build load failed one watch-subject timeout and reported a Vitest worker timeout (359 files passed, 1 failed); this result is not a clean full-suite pass. A second full unit run had 360 files and 4,517 assertions pass but exited nonzero because of an unhandled Vitest worker onTaskUpdate timeout. The requested ci:local:e2e passed CSS, lint and typecheck, then stopped at the same unit worker timeout (all 4,517 assertions passed); its E2E stage did not run. Hosted CI remains to be checked on the published head. Accepted-frame phase, cross-scene depth A/B, Architecture attribution and final CI are outstanding. Existing [visual evidence](../macro-tourbillon-reviewfix/REPORT.md) is from the unchanged watch rendering source at bc859508.

## Serial closeout — 2026-11-27

Execution was serialized: Chrome 158 hardware WebGL2 ANGLE Metal on Apple M4 Pro, Node 24.3.0, one Playwright worker. Host initially reported load 9.12/16.31/15.86, 111 GiB disk free and 50% memory free. Two stale Vite servers from the earlier macro worktree were stopped; unrelated user processes were left running. No full unit, browser, build or capture blocks were intentionally overlapped.

**Architecture:** On the recorded base 97651a38 the original Free Practice and guided tests passed 2/2 in 11.3 seconds on hardware Chrome; on head 919a2aca the cases passed individually in 4.9 and 5.3 seconds. Both original failures are **NOT_REPRODUCED in this serial hardware environment**, not proven fixed or attributed: the free-scene runs generated different seeds, and the original failure seed was not recovered. Previous software Chromium runs timed out while sending public Shift+Arrow input, before their assertions. The hardware runs reached the original 70% sharpness and Restart assertions without bypassing the public controls. Browser traces remain local under /private/tmp/macro-serial-architecture-{head,guided,base}; the base's temporary Playwright config is not committed.

**Depth:** Independent 16/24-bit diagnostic runs each rendered five default control scenes on hardware Chrome (5/5 each), with completed frame status and matching recorded focal length, DOF mode and near/far values. PNGs and diagnostic JSON remain local in /private/tmp/tourbillon-depth-serial. These are preliminary: default states and UI overlays do not establish the requested optical equivalence across meaningful focus/tilt states. **DEPTH24_NEEDS_REFINEMENT** remains the decision. The 24-bit B5 timeout was not separately reproduced in this round; the earlier dedicated B1–B5 run remains valid.

**Cage:** The browser test compares observed phase with the elapsed-time 60-second model across loupe, focus and aperture changes, starting from a nonzero phase and using circular error. Focused tests reject a reset, reverse motion and a large jump and accept wrap-around (2/2); hardware Macro Bellows suite passed 3/3, followed by the revised focused interaction 1/1. The 0.2 rad tolerance allows approximately 1.9 seconds of sampling lag. **ACCEPTED_FRAME_PHASE_NOT_DIRECTLY_MEASURED**: diagnostics read sampled transforms rather than presented-frame metadata.

**Runner and final validation:** Hosted CI for 919a2aca failed watch-construction tests at their 5- and 15-second test limits; hosted Historical Qualification passed. Serial `npm run ci:local:e2e` passed CSS, lint and typecheck, then exited 1 at unit stage: all 361 files and 4,519 assertions passed, but Vitest emitted an unhandled worker `onTaskUpdate` timeout. The E2E stage did not run. The M7M replay took 60.15 seconds in that run; a separate one-worker M7M file diagnostic passed 63/63 in 29.33 seconds. This supports a workload/scheduling association, not a proven RPC root cause. Logs remain local at /private/tmp/macro-serial-ci.log and /private/tmp/macro-serial-m7m.log. The existing production build and lifecycle evidence are unchanged. Full CI, representative cross-scene optical qualification and independent review remain open gates.
