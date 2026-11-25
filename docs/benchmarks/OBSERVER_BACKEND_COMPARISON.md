# Observer WebGL2 / Native WebGPU comparison

## Purpose and repeatable run

This opt-in benchmark compares the Observer on View Camera Anatomy and
Architecture Rise using the same development build, browser, viewport, scene
controls, and deterministic camera poses. It records three paired trials per
scene, alternates backend order, exercises the real OrbitControls pointer
path, compares actual Observer-canvas captures, checks Ground Glass separately,
and tests bounded renderer recovery.

Run it on a machine with headed Chrome and native WebGPU available:

```bash
npm run benchmark:observer-backends
```

The command starts a dedicated Vite server on port 4176 and a dedicated
Playwright project. It is excluded from the regular development and
production-preview E2E suites. A timestamped, ignored directory under
`test-results/observer-backend-comparison/` contains `run.json`, `summary.md`,
paired PNG captures, `visual-report.html`, and the Playwright attachment.
Invalid trials and their reasons remain in the report; a partial matrix is not
presented as complete.

WebGPU trials qualify only when the mounted Observer reports
`webgpu-renderer / webgpu`, the approved pilot request, an available adapter,
one initialization attempt, no initialization failure, and no application
fallback. Three.js internal `webgl2-fallback` does not qualify. WebGL trials
must report `webgl-renderer / webgl2` and no WebGPU initialization.

## Measurement definitions

- **Context/page setup** uses Node's monotonic `performance.now()` from before
  browser-context creation to immediately before navigation.
- **Navigation to DOMContentLoaded** starts immediately before `page.goto()`.
- **Navigation to observed active renderer** ends only after the matching scene
  reports an active renderer, known mounted family and execution backend, and
  a current renderer generation. This is browser wall time across navigation,
  module loading, initialization, and scene realization; it is not GPU time.
- **Adapter diagnostic** is observed asynchronously from the active-renderer
  boundary. Its completion is reported separately and is not a prerequisite
  for active-renderer or first-capture timing.
- **Navigation to verified Observer capture** ends after an actual canvas
  screenshot has meaningful pixels in the scene's geometry-derived subject
  region. It is a verified screenshot milestone, not a claimed first frame.
- **Observed browser frame cadence** uses `requestAnimationFrame` intervals
  whose two endpoints are both inside the same real pointerdown/up gesture on
  the Observer canvas. It reports active-gesture and inter-gesture cadence
  separately and excludes pre/post idle intervals. Four drags must each change
  the camera pose. This measures browser presentation scheduling, not a Three.js
  render on every interval, input-to-present latency, or GPU time.
- **Ground Glass restoration** captures three same-mode baselines at a
  one-level RGB threshold, switches Raw/Upright mode, and compares the restored
  image with the original. Acceptance is bounded by the largest repeated-capture
  variation in changed-pixel fraction, RGB MAE, and absolute signed-luminance
  difference. A separate 16-level comparison remains descriptive.
- **Visual comparison** uses actual Observer canvas PNGs at matched canonical
  state, pose, viewport, and DPR. Changed-pixel fraction counts pixels with at
  least one RGB channel differing by 16 or more. Anatomy includes the camera
  model and registered target-board regions; Architecture Rise includes facade,
  glazing, roof/side-return, and background regions.

The benchmark does not collect GPU timestamp queries, VRAM, renderer-owned GPU
memory, or hardware-specific resource counts. Ground Glass is reported as its
own WebGL2 surface and is not combined with Observer measurements.

## Corrected measured run

The prior report is superseded for timing boundaries, interaction cadence, and
Ground Glass restoration acceptance. The corrected implementation was measured
at commit `91d621b7815b69a142d4543401330ea9f1641c6a`; the completed report was
generated at `2026-10-12T17:09:22.541Z` in
`test-results/observer-backend-comparison/2026-10-12T17-08-31.178Z-91d621b7815b/`.

Environment: headed Chromium 155.0.8059.39 on macOS Darwin 27.0.0 arm64,
Three.js r186, viewport 1440 × 1000, DPR 1. `navigator.gpu` and an adapter
were available. All six WebGPU trials mounted `webgpu-renderer / webgpu`; all
six paired WebGL trials mounted `webgl-renderer / webgl2`. All 12 trials were
valid, with no page or console errors. WebGPU initialization made one attempt
per trial and had no application fallback. Chrome DevTools Protocol reported
Metal and no software renderer; this does not identify the adapter used by
WebGPU, so hardware acceleration remains **unconfirmed**.

| Scene | Backend | Navigation to active renderer, range (median) | Navigation to verified capture, range (median) | Active gesture cadence |
| --- | --- | ---: | ---: | --- |
| View Camera Anatomy | WebGL2 | 727–1,034 ms (749 ms) | 876–1,214 ms (916 ms) | 36 samples/trial; median 16.7 ms; p95 16.8–18.4 ms |
| View Camera Anatomy | Native WebGPU | 1,324–1,371 ms (1,367 ms) | 1,496–1,544 ms (1,532 ms) | 36 samples/trial; median 16.7 ms; p95 17.7–18.2 ms |
| Architecture Rise | WebGL2 | 811–881 ms (859 ms) | 973–1,043 ms (1,024 ms) | 36 samples/trial; median 16.7 ms; p95 17.8–18.6 ms |
| Architecture Rise | Native WebGPU | 1,378–1,439 ms (1,417 ms) | 1,551–1,609 ms (1,601 ms) | 36 samples/trial; median 16.7 ms; p95 16.8–17.9 ms |

Each trial recorded four complete drags, nine active rAF intervals per drag,
and a camera-pose change after each gesture. Inter-gesture intervals were
recorded separately; idle intervals were excluded. No active interval exceeded
50 ms. WebGPU adapter diagnostics completed 10.5–16.6 ms after renderer
readiness and did not delay the verified capture.

| Scene | View | Whole-canvas MAE (0–255) | Pixels changed at 16/255 | Subject-region MAE |
| --- | --- | ---: | ---: | ---: |
| View Camera Anatomy | Camera inspection | 22.10 | 89.44% | Camera model: 15.42 |
| View Camera Anatomy | Registered target-board view | 21.34 | 86.39% | Target board: 14.06 |
| Architecture Rise | Default | 13.76 | 57.08% | Facade: 22.76 |
| Architecture Rise | Close facade | 20.48 | 90.66% | Facade: 21.83 |

The measured pixel differences include background/tone and Architecture Rise
facade/glazing differences. WebGL and WebGPU need not be pixel-identical;
human review must decide whether those differences affect teaching use.

Ground Glass remained on its existing WebGL2 context, was contentful, and
responded visibly to Raw/Upright mode changes across all trials. Restored pixels
matched the initial captures exactly in this run and passed the repeat-derived
tolerance. Same-mode Anatomy baselines showed at most 0.1559% changed pixels
and 0.00112 RGB MAE; Architecture Rise baseline captures were identical. No
Observer remount occurred during Ground Glass interaction.

Both scene recovery sequences completed WebGL2 → native WebGPU → WebGL2 →
native WebGPU with stable canvas counts, advancing renderer generations, no
application fallback, and no page errors. Architecture Rise environment
readiness remained active throughout.

## Decision

| Area | Result | Basis |
| --- | --- | --- |
| Functional rendering | **Verified** | Both development pilots mounted through the actual native WebGPU backend, passed their scene and interaction evidence, and recovered across backend changes. |
| Visual equivalence | **Inconclusive** | Subject-region and whole-canvas differences are measured, but teaching-use acceptability needs human review. |
| Performance | **Inconclusive** | WebGPU route-to-active and verified-capture wall times were higher in these three pairs per scene. Those wall times combine browser, module, renderer, and scene work; rAF cadence is not GPU time. No sustained performance ranking is established. |
| Hardware qualification | **Unconfirmed** | Chrome reported Metal and no software renderer, but did not independently prove which adapter WebGPU used. |

**Recommended next direction: A — Continue development-only pilots.** The run
does not establish a practical performance advantage or decision-grade visual
parity. It does not authorize production WebGPU, additional scene eligibility,
or a Ground Glass migration. Results cover one macOS/Chrome combination and do
not establish behavior on other drivers, GPUs, operating systems, or browsers.

## PR G visual-parity follow-up

PR G added a separate matched-pose Architecture Rise visual diagnostic without
changing the performance benchmark's renderer or timing behavior. On headed
Chrome 155 / Three.js r186, native WebGPU background samples were
`[225,225,226]` versus WebGL `[248,250,252]`; same-backend overlay deltas also
showed color-response differences over the façade and background. The
renderer-path diagnosis and the NO-GO parity decision are recorded separately
in `docs/VISUAL_PIPELINE_READINESS.md` under **PR G — Observer Background and
Transparent Overlay Parity**. PR F's historical performance and timing results
remain unchanged.
