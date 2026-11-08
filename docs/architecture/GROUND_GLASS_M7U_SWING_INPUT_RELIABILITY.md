# M7U — Interior Corner Swing Input Reliability

## Decision

**U1 — Verified test-workload improvement.** The primary Swing + Focus test now uses a validated direct update of the existing public Swing range input for the two bulk optical endpoints. A separate regression still uses real keyboard input for adjacent Swing grid values and verifies the rendered movement readout in both directions.

The matched runs support a focused test-efficiency and current four-worker outcome improvement. They do not prove that the earlier M7T trace-enabled timeout is permanently fixed, identify its cause, or qualify the full Broad E2E suite.

## Source and experiment

- Baseline source: M7T merge `2df452727c37f25743aa2c2574da379d12f07d14`.
- Candidate behavior source: `37af8b3f1da9040d00c752eabf69afdb48d036dd`.
- Environment: macOS 27.0.1 arm64, Node 24.3.0, Playwright 1.61.1, Chromium 149.0.7827.55, `chromium` project, application-default WebGL, zero retries.
- The primary test's 120,000 ms timeout and its feedback, route, slider, and Ground Glass assertions are unchanged.
- Four-worker captures used the same fixed set: Swing + Focus, Interior Corner Guided Lesson, Interior Corner Rise Composition, and the public responsive-grid home test. Playwright reported four actual workers with worker indexes 0–3. All four tests overlapped for about 1.3 seconds; the three Interior Corner tests overlapped for 57–60 seconds. This is a bounded selected workload, not a full-suite load claim.
- Lightweight `test.step` boundaries recorded the route, feedback, Ground Glass, Rise, positive Swing, Focus, and reverse Swing stages. Baseline and candidate comparisons use the same boundaries.

The first baseline four-worker command used a grep expression that treated the `+` in the Swing test title as a regular-expression operator. It ran only the three peers, so it is retained as a selection-invalid attempt and excluded from the matched result. A corrected `--list` check confirmed the intended four tests before the valid four-worker captures.

## Public input contract

Interior Corner's Swing control is the enabled public range slider named **Swing**, with `min=-10`, `max=10`, and `step=0.1`. `MovementControls` handles the range input through React `onChange`, which calls the same `setSwing(Number(event.target.value))` action used by keyboard interaction. The existing `setRangeDirect()` helper sets the native range value and dispatches a bubbling `input` event; existing E2E coverage uses this mechanism for public controls.

The new `setRangeDirectOnGrid()` wrapper verifies the slider is present and enabled, reads its actual min/max/step attributes, rejects non-finite, out-of-range, and off-grid targets, uses that existing native setter plus `input` event, and asserts the resulting public slider value. The primary test then checks scene-specific feedback at each endpoint, so a DOM value change without the application state update cannot pass the optical workflow.

The original positive and reverse optical states remain `+3.6°` and `−3.6°`; Rise remains keyboard-driven at `33`, Focus remains `38140`, and the final-contentful Ground Glass assertion remains in place. The change removes 18 repeated Playwright keyboard presses from the two bulk Swing moves and replaces them with two validated public-input updates.

## Matched results

| Configuration | Baseline Swing + Focus | Candidate Swing + Focus | Peer results |
|---|---:|---:|---|
| One worker, target only | 61.375 s, passed | 36.841 s, passed | — |
| Four workers, attempt 1 | Timed out at 120.203 s during reverse Swing at `−2.4°` | 74.603 s, passed | 3/3 passed in both arms |
| Four workers, attempt 2 | Timed out at 120.277 s during reverse Swing at `−2.4°` | 71.880 s, passed | 3/3 passed in both arms |

In the single-worker run, positive/reverse Swing stages decreased from 19.238/15.845 seconds to 3.826/2.773 seconds. In the two valid four-worker runs, the corresponding baseline stages took 32.897/35.186 and 20.156/19.167 seconds; candidate stages took 5.826/5.952 and 4.381/2.365 seconds. Feedback and rendering assertions stayed the same. Rise remained keyboard-driven and measured 37.887/37.947 seconds at baseline versus 36.387/36.450 seconds for the candidate under four workers.

The single-worker primary test was 24.534 seconds faster (about 40%). Both candidate four-worker target attempts completed roughly 45–48 seconds before the existing timeout, while both baseline attempts reached the timeout. These are two matched pairs under one local environment; they do not establish a general reliability rate or isolate why M7T's trace-enabled run timed out.

The candidate also passed a separate real-keyboard test: two ArrowRight steps and one ArrowLeft step moved Swing through three adjacent values derived from the public `step` attribute, and the visible, application-derived movement readout updated after each action. The direct-input negative controls rejected a missing slider, a disabled slider, NaN, an off-grid value, and an out-of-range value without changing the slider.

## Evidence handling

The machine-readable report contains the per-attempt outcomes, worker identities, stage durations, and SHA-256 digests of the Playwright JSON reporter exports. The complete reporter exports are not committed because they include local runner configuration and absolute workspace paths. The committed summary is therefore not independently replayable from the original raw reporter bytes; no raw-to-summary replay claim is made.

An additional uninstrumented one-worker baseline also passed (`1.1m` in Playwright's rounded line output). It is retained as a supplemental pass, not used for the stage-duration comparison. The selection-invalid peer-only run is likewise recorded separately.

## Scope and qualification

Only E2E helper/spec files changed. No application, optical, renderer, route, timeout, retry, or worker policy changed. M7R's accepted full-suite result remains 278 discovered, 118 passed, 85 unexpected, and 75 skipped; Broad E2E remains `not-qualified`; M7 remains `partially-qualified`; M8 entry remains denied; spontaneous/external GPU device loss remains blocked; production Ground Glass remains WebGL-only and production WebGPU remains disabled.

Validation completed: the primary test, both four-worker candidate cohorts, the real-keyboard and negative-control tests, 68 route-availability integration tests, M7R evidence check, typecheck, targeted ESLint, and `git diff --check`. The full Broad E2E suite was not run.
