# PR 8E — Ground Glass Physical DOF profiling

- Branch: `perf/ground-glass-dof-profiling`.
- Base: `origin/main` at `ef91bd8`, containing merged PR #85 / PR 8D.
- Objective: measure the existing Ground Glass physical-DOF pipeline without
  changing optical calculations, gather quality, or rendered output.

## Instrumentation contract

- Profiling is developer opt-in with `?dofProfiling=1` (the alias
  `?groundGlassProfiling=1` is also accepted).
- The active RTT frame scopes the real scene, CoC/footprint, far gather, near
  gather, and composite render calls. Raw RTT scopes only scene and composite;
  CoC/far/near are not executed or reported.
- `EXT_disjoint_timer_query_webgl2` is used asynchronously when available. A
  bounded 24-query pool is reused; pending/disjoint results are discarded and
  all query objects are disposed with the RTT resources. Unsupported contexts
  use explicitly labeled CPU submission timing.
- A bounded 60-sample window publishes latest, mean, p50, and p95 statistics.
  Snapshots include the measured resolution, gather settings, storage format,
  technique, preview/raw state, timing backend, and pass data in the existing
  runtime/debug diagnostics.

## Manual benchmark protocol

For each scene/profile: reset or reload the scene, enable `?dofProfiling=1`,
allow warm-up, wait for at least 60 completed `frame.count` samples, capture
the JSON snapshot from the Ground Glass profiling debug group, avoid camera
interaction during sampling, and record whether the display appears capped by
vsync. Compare frame timing separately from Ground Glass GPU/CPU-submit timing;
do not infer uncapped FPS or application FPS from Ground Glass GPU time.

Suggested matrix:

- Architecture + Foreground — High, Standard, Low
- Table Tilt — High, Standard, Low
- Shelf Swing — High, Standard, Low
- Raw RTT reference — High

Run the same procedure later on the Mac mini M4 Pro and iPad mini 7. This PR
has no performance target and introduces no automatic quality changes.

## Known limitations

- CPU fallback measures browser-side submission duration, not GPU execution.
- Browser frame time includes React, the main viewport, UI, and compositor
  work; it is not a Ground Glass-only FPS measurement.
- GPU timing is asynchronous, so the first snapshots may be sparse until
  timer results become available. No telemetry leaves the browser.
