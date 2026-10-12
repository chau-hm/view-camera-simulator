# Observer WebGL2 / Native WebGPU comparison

## Purpose and repeatable run

This opt-in benchmark compares the Observer on View Camera Anatomy and
Architecture Rise using the same development build, browser, viewport, scene
controls, and deterministic camera poses. It collects three paired trials per
scene, alternates backend order, performs a fixed OrbitControls pointer
workload, and checks bounded WebGL2 → native WebGPU → WebGL2 → native WebGPU
recovery. It also confirms that the independent Ground Glass surface remains
WebGL2-backed, contentful, and responsive to its Raw Ground Glass / Upright
Assist control.

Run it on a machine with stable headed Chrome and native WebGPU available:

```bash
npm run benchmark:observer-backends
```

The command starts a dedicated Vite server on port 4176 and a dedicated
Playwright project. The suite is not discovered by ordinary development E2E or
production-preview E2E. It writes a timestamped, ignored directory under
`test-results/observer-backend-comparison/` containing `run.json`,
`summary.md`, paired PNG captures, a side-by-side `visual-report.html`, and the
Playwright attachment. Failed/incomplete trials stay in the report and cannot
be presented as a complete comparison.

The WebGPU side is accepted only when the actual mounted Observer reports
`webgpu-renderer / webgpu`, an approved development pilot request, one
initialization attempt, no initialization failure, and no application
fallback. Three.js's internal WebGL2 fallback does not qualify. WebGL trials
must report the actual `webgl-renderer / webgl2` and no WebGPU initialization.

## What is measured

- **Route-to-active-renderer wall time** starts at navigation and ends when
  the mounted Observer reports an active renderer. It includes browser route,
  module, renderer, and scene work; it is not pure renderer initialization or
  GPU time.
- **Observer frame cadence** is sampled from browser `requestAnimationFrame`
  intervals during a fixed real pointer-drag orbit sequence. It is presentation
  scheduling context, not proof that a Three.js render occurred on every
  interval and not GPU render time.
- **Visual comparison** uses PNG captures of the actual Observer canvas at a
  matched canonical state, camera pose, viewport, and DPR. The report records
  whole-canvas and scene-specific regions, mean absolute RGB difference, and
  the share of pixels with a channel delta of at least 16/255. The Anatomy
  target-board region is projected from its registered geometry; Architecture
  regions cover the main facade, glazing, roof/side return, and background.
  A separate Anatomy camera-model view captures the normal inspection pose.
- **Ground Glass** is checked separately for its existing WebGL2 context,
  contentful output, and visible Raw/Upright mode response. Its rendering and
  timings are not aggregated with Observer measurements.
- **Recovery** checks the mounted renderer generation and actual backend after
  each request transition. Architecture Rise environment readiness is
  recorded independently.

The benchmark does not collect GPU timestamp queries, input-to-present latency,
VRAM, renderer GPU memory, or hardware-specific resource counts. It does not
infer these from JavaScript timers or incompatible renderer counters.

## PR F runtime result

Final committed-run evidence: commit `8d96769994e36796a367fad6512b7950b79804aa`,
generated at `2026-10-12T15:50:54.363Z`. The ignored machine-readable report,
Markdown summary, and captures are in
`test-results/observer-backend-comparison/2026-10-12T15-49-45.432Z-8d96769994e3/`.

The completed native run used stable headed Chrome 155.0.8059.39 on macOS
Darwin 27.0.0 arm64 with Three.js r186, a 1440 × 1000 viewport, and DPR 1.
`navigator.gpu` was present and the bounded adapter probe reported available.
All six WebGPU scene-trials mounted `webgpu-renderer / webgpu`, made one
initialization attempt, and reported no application fallback; all six paired
WebGL trials mounted `webgl-renderer / webgl2`. The three pairs for each scene
were valid, with no page or console errors. Both recovery sequences completed
as WebGL2 → native WebGPU → WebGL2 → native WebGPU with increasing mount
generations. The Architecture Rise environment became active. Ground Glass
remained on WebGL2, stayed contentful, and changed visibly when switching Raw
Ground Glass / Upright Assist; restoring the original mode returned the image
exactly to its initial capture in this run.

| Scene | WebGL2 route-to-active-renderer | Native WebGPU route-to-active-renderer | Observed browser frame cadence | Visual comparison |
| --- | ---: | ---: | --- | --- |
| View Camera Anatomy | 827–1,328 ms (median 869 ms) | 1,520–1,617 ms (median 1,563 ms) | Median 16.7 ms; p95 18.0–18.5 ms across samples | Camera inspection: full-canvas MAE 22.10/255, 89.44% changed, camera-model ROI MAE 15.42. Registered target view: full-canvas MAE 21.34/255, 86.39% changed, target-board ROI MAE 14.06 |
| Architecture Rise | 953–1,041 ms (median 1,041 ms) | 1,528–1,584 ms (median 1,573 ms) | Median 16.7 ms; p95 17.6–18.5 ms across samples | Default: full-canvas MAE 13.76/255, 57.08% changed, facade ROI MAE 22.76. Close facade: MAE 20.48/255, 90.66% changed, facade ROI MAE 21.83 |

The wall times are paired navigation-to-active-renderer observations and do
not isolate compilation or GPU startup. The similar frame cadence is bounded
by browser/display scheduling and does not show a performance advantage.
Side-by-side captures retain the same model structure, while background/tone
and some Architecture Rise facade/glazing appearance differences remain
visible. Pixel identity is not expected; teaching-use acceptability needs
human review. No visual tuning was made in this benchmark.

## Evidence-based decision

| Area | Result | Basis |
| --- | --- | --- |
| Functional rendering | **Verified** | Actual native WebGPU mounts for both eligible scenes; subject, controls, environment, Ground Glass, and bounded backend recovery checks passed. |
| Visual equivalence | **Inconclusive** | ROI and whole-canvas differences are measured, but the visible tone/facade differences require human teaching-use judgment. |
| Performance | **Inconclusive** | No GPU timing is available. Browser rAF cadence is similar and route-to-active-renderer wall time is slower in these WebGPU samples, but neither establishes sustained render performance. |
| Hardware qualification | **Unconfirmed** | Chrome CDP reported Metal and did not identify a software renderer, but this does not independently prove hardware-backed adapter execution. |

**Recommended next direction: A — Continue development-only pilots.** This run
does not establish a practical performance advantage or decision-grade visual
parity. It does not justify production WebGPU, additional eligible scenes, or a
Ground Glass migration. A focused follow-up is warranted only if human review
finds the measured differences affect the scenes' teaching purpose, or a
separate GPU-timing design becomes available.

The report intentionally distinguishes **native WebGPU API execution** from
**hardware acceleration**. The API path was verified; hardware acceleration
remains unconfirmed. These results cover one macOS/Chrome combination and do
not establish behavior on other drivers, GPUs, operating systems, or browsers.
