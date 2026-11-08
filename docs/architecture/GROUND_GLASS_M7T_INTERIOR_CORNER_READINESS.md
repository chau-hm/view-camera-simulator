# M7T — Interior Corner Public Route & Workspace Readiness

## Decision

**T3 — No justified correction.** The bounded current-source runs did not establish a public-route, workspace-mount, lesson-state, or control-availability defect. No application behavior, E2E assertion, timeout, or retry setting changed.

The three M7S failure identities remain in the qualification backlog. M7T does not reclassify M7S evidence or claim a verified fix.

## Scope and public contract

M7S recorded three different Interior Corner outcomes in its four-worker run: the lesson drawer did not resolve at the `Step 1 of 5` assertion, the Rise slider did not resolve at its enabled assertion, and the Swing + Focus test reached its 120-second timeout without a recorded last stage. These are observations, not evidence of a shared cause.

The public routes are:

- Free mode: `/simulator/free/interior-corner`
- Lesson entry: `/simulator/free/interior-corner?lesson=1`

`SimulatorRoutePage` validates the mode, public scene, and optional task. It renders `SimulatorWorkspace` through React `lazy()`/`Suspense`, so a valid URL can appear while `Loading simulator workspace…` is still visible. The workspace, Camera Controls, Learning Drawer, guided lesson content, and Ground Glass contentful state have separate readiness boundaries. M7T found no basis for treating the route URL alone as proof of those later states.

The target assertions already wait on the specific required controls or lesson content. M7T kept those assertions and the desktop drawer identity-transform contract unchanged. The primary runs show that the expected controls and lesson content eventually appeared, but they did not instrument exact mount timestamps.

## Bounded current-source runs

The tested behavior source was the M7S merge, `638b3b598f5aa6da930993c70f44d7d51e89e152`. Runs used Playwright Chromium, application-default WebGL, the repository Playwright config, and zero retries.

| Condition | Target outcomes | Duration | Actual worker evidence |
|---|---|---:|---|
| One worker, three Interior Corner targets | 3/3 passed | 204.7 s | Worker 0; sequential |
| Four workers, three targets plus responsive-grid public-page peer | 4/4 passed | 169.7 s | Worker indexes 0–3; all four tests overlapped for 1.304 s; the three Interior Corner tests overlapped for 60.526 s |

In the repository-config four-worker run, the lesson target passed in 168.896 s, Rise Composition in 60.535 s, and Swing + Focus in 116.521 s. The peer completed in 1.307 s. This was real but brief four-test overlap, and it does not represent sustained full-suite contention.

All test identities, start times, durations, worker indexes, retry counts, and the machine-readable outcomes are in [the attempt summary](ground-glass-m7t-interior-corner/capture/final/attempt-summary.json).

### Trace-enabled diagnostic runs

An initial diagnostic run used a temporary Playwright config with `trace: retain-on-failure`, unlike the repository config (`on-first-retry`, with zero retries). These results are retained separately and are not the primary M7T comparison.

The trace-enabled four-worker run passed the lesson and Rise targets but timed out on Swing + Focus while `setStepRangeInput` was moving Swing toward `+3.6°`. The failure occurred in the press operation with the public slider still present at `3.3°`. By that point, the correct Interior Corner route, Camera Controls, Learning Feedback content, final-contentful Ground Glass, and Rise value `33` were observed. This localizes that attempt to the Swing interaction stage; it does not establish an application defect.

The corresponding repository-config four-worker run passed Swing + Focus in 116.521 s. One run per configuration cannot distinguish trace overhead from ordinary run-to-run variability, so M7T does not claim that tracing caused the timeout. The diagnostic capture does show that the 120-second workflow has little margin under this environment.

## Per-target disposition

1. **Guided Lesson entry — `not-reproduced`.** The original `Step 1 of 5` drawer-absent failure did not recur in either primary run. The full lesson sequence passed, including the exact initial stage and subsequent transitions.
2. **Rise Composition — `not-reproduced`.** The original missing Rise slider did not recur in either primary run. The enabled/value, Feedback, and composition assertions passed.
3. **Swing + Focus — `passed-once-not-verified`.** It passed the primary one-worker and four-worker runs. The four-worker pass took 116.521 s against the unchanged 120-second limit, while the separate trace-enabled run timed out during the first `+3.6°` Swing input. This remains a reliability concern, not a route-readiness finding or a verified fix.

The M7S cohort remains historically **8 passed once, 3 different failures, 0 verified fixes**. M7T does not promote any of those identities to fixed.

## Negative and neighboring coverage

- The route-availability integration suite passed 68 tests, including accepted Interior Corner routes and redirects for unsupported routes.
- The existing Interior Corner tests retained the exact lesson-stage, Rise-slider, and content assertions; no generic workspace-visible check replaced them.
- Two Learning Drawer regressions passed: desktop peek/open/pin/close behavior, and keyboard focus/Escape behavior.
- The M7S open-state contract and its captured reports remain unchanged.

## Evidence limits and next action

The new Playwright JSON reports were used to create the public-safe normalized summary, but the raw reports and diagnostic trace are not committed. No raw artifact digest or raw-to-summary replay claim is made. The historical M7R and M7S report/capture digests are recorded unchanged in the summary.

The next M7 work should prioritize the current Broad E2E failure inventory using fresh evidence rather than infer a route fix from the M7S signatures. Keep this Interior Corner trio unresolved until current CI or a separately bounded reproduction establishes a repeatable failure. If Swing + Focus again reaches its 120-second limit, handle the existing native range-input interaction as a narrowly scoped test reliability issue while preserving the `+3.6°`/`-3.6°` grid values and meaningful user-control coverage.

## Qualification boundary

M7R remains `278 discovered, 118 passed, 85 unexpected, 75 skipped`; Broad E2E remains `not-qualified`; M7 remains `partially-qualified`; M8 entry remains denied; spontaneous/external GPU device loss remains blocked; production Ground Glass remains WebGL-only; production WebGPU remains disabled. M7T's focused passes do not change those decisions.

## Validation

- Repository-config single-worker targets: **3 passed**, zero retries.
- Repository-config four-worker targets plus peer: **4 passed**, zero retries.
- Route-availability integration: **68 passed**.
- Learning Drawer regressions: **2 passed**.
- `npm run evidence:check:m7r`: passed; historical counts unchanged.
- `npm run typecheck`: passed.
- Targeted ESLint for the three Interior Corner specs: passed.
- Full 278-test Broad E2E suite: not run.
- No separate `evidence:check:m7s` command is registered in `package.json`.
