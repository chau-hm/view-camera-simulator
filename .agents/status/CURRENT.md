# Focused fix — Ground Glass GPU profiler runtime completion

- Branch: `fix/ground-glass-gpu-profiler-runtime`.
- Base: `origin/main` at `67ee0e38d6283a11708d2d0e3b8194cd43ed5b9e`.
- Scope: make the existing opt-in GPU timer-query path operational and
  observable without changing Ground Glass rendering or quality settings.

## Root cause

`GroundGlassGpuTimer.poll()` copied native WebGL `getParameter` and
`getQueryParameter` methods into local variables before calling them. Native
WebGL methods require their context receiver, so the real Ground Glass context
failed at the first asynchronous poll. The old fake context accepted the
unbound calls and masked the integration defect. Queries were begun/ended but
no results reached frame aggregation.

## Fix and diagnostics

- Polls invoke the WebGL methods through the owning context, preserving `this`.
- GPU query state is reported separately from backend capability: detected,
  active, stalled, disjoint, or error.
- Bounded counters expose frame admission, query begin/end/poll/completion,
  unavailable/disjoint/error, pending-frame, ownership, and session-reset
  state in the profiling snapshot.
- The debug panel labels browser-frame samples separately from completed GPU
  frames. Raw RTT continues to profile only scene render and composite.
- GPU timing remains asynchronous and uses no `gl.finish`, `readPixels`, or
  automatic CPU fallback when the GPU backend is available.

## Validation status

- Focused profiler and Ground Glass RTT unit suites pass, including receiver-
  bound WebGL fakes, delayed multi-pass ownership, reset/disjoint/failure,
  atomic admission, Raw RTT, and CPU fallback coverage.
- Focused profiling Chromium suite passes in the default CPU-fallback runner.
- Edge on this Mac with a Metal-backed timer-query context reaches 60 samples
  for all five processed passes, Ground Glass, and physical DOF; diagnostics
  report active state, no disjoint/error, and zero ownership drops. Raw High
  reports scene/composite only and `physicalDofGpu: null`.
- Full unit/integration tests pass: 136 files, 1,292 tests; typecheck, lint,
  CSS check, build, and diff check pass.
- Independent affected Chromium matrix passes all 37 profiling/stability,
  Shelf Swing, Table Tilt, and Oblique Architecture cases.
- `npm run ci:local:e2e` reaches the known unrelated baseline failure at
  `focus-fundamentals-selectable-focus.spec.ts:155` (“Ground Glass RTT
  diagnostics were incomplete”); the remaining test in that file passes.

No optical equations, DOF shaders, gather settings, scene geometry, task
thresholds, or PR 8F work are in scope.
