# Corrective fix — preserve Ground Glass GPU query failures

- Branch: `fix/ground-glass-gpu-profiler-runtime`.
- Base: `origin/main` at `67ee0e38d6283a11708d2d0e3b8194cd43ed5b9e`.
- Scope: preserve transient GPU-query failures through frame invalidation and
  make profiling E2E acceptance branch on the reported timing backend/state.

The original PR 8E.1 receiver-binding fix remains intact. This pass changes
profiler error propagation and test observability only; it does not change
Ground Glass rendering, quality settings, optics, or performance policy.

## Root cause

`GroundGlassGpuTimer.poll()` copied native WebGL `getParameter` and
`getQueryParameter` methods into local variables before calling them. Native
WebGL methods require their context receiver, so the real Ground Glass context
failed at the first asynchronous poll. The old fake context accepted the
unbound calls and masked the integration defect. Queries were begun/ended but
no results reached frame aggregation.

The remaining review defect was separate: profiler failure detection compared
only the timer state before and after a poll. A poll that completed some query
slots and then threw could therefore end in an apparently healthy state, while
the owning frame retained only partial timings. `endQuery()` failures had the
same transient-state risk because a later `begin()` could clear the error.

## Fix and diagnostics

- Polls invoke the WebGL methods through the owning context, preserving `this`.
- `pollWithEvents()` returns partial timings together with an explicit failure,
  disjoint flag, and discarded frame IDs; partial success can no longer erase
  a later query API error.
- `end()` returns an explicit end-query failure to the owning pass scope, which
  invalidates the current frame immediately. A later `begin()` does not clear
  the error before a healthy asynchronous poll proves recovery.
- Failed/discarded frame ownership is removed from pending records before any
  returned partial timings are considered, so incomplete frames cannot remain
  pending or enter timing windows.
- GPU query state is reported separately from backend capability: detected,
  active, stalled, disjoint, or error.
- Bounded counters expose frame admission, query begin/end/poll/completion,
  unavailable/disjoint/error, pending-frame, ownership, and session-reset
  state in the profiling snapshot.
- The debug panel labels browser-frame samples separately from cumulative GPU
  frames. Raw RTT continues to profile only scene render and composite.
- Profiling E2E first waits for backend/state readiness: healthy GPU and CPU
  paths require their own positive samples, while stalled/disjoint/error GPU
  paths are accepted only with explicit diagnostics.
- GPU timing remains asynchronous and uses no `gl.finish`, `readPixels`, or
  automatic CPU fallback when the GPU backend is available.

## Validation status

- Focused profiler suite passes with receiver-bound fakes, partial-success plus
  poll-failure recovery, end-query failure recovery, delayed ownership,
  reset/disjoint/failure, atomic admission, Raw RTT, and CPU fallback coverage.
- Focused Ground Glass RTT unit suite passes.
- Focused profiling Chromium suite passes both backend-aware tests; the suite
  now accepts a zero-sample GPU result only when the snapshot explicitly
  reports stalled/disjoint/error evidence.
- Focused profiling Chromium suite passes in the default CPU-fallback runner.
- Edge on this Mac with a Metal-backed timer-query context reaches 60 samples
  for all five processed passes, Ground Glass, and physical DOF; diagnostics
  report active state, no disjoint/error, and zero ownership drops. Raw High
  reports scene/composite only and `physicalDofGpu: null`.
- Full unit/integration tests pass: 136 files, 1,295 tests; typecheck, lint,
  CSS check, build, and diff check pass.
- The affected Chromium matrix initially had 31/37 pass under five-worker
  contention; the six timed-out Shelf Swing/Table Tilt/Ground Glass stability
  cases all passed on serial rerun. The dedicated profiling suite passed 2/2.
- Headless Microsoft Edge with Metal flags reports WebGL2 and
  `EXT_disjoint_timer_query_webgl2` on both canvases. Processed Ground Glass
  reached active GPU state with all five pass windows and Ground Glass/physical
  DOF counts at 16, with zero query errors/disjoints/ownership drops. Raw RTT
  reached active GPU state with scene/composite counts at 16 and
  `physicalDofGpu: null`.
- `npm run ci:local:e2e` reaches the known unrelated baseline failure at
  `focus-fundamentals-selectable-focus.spec.ts:155` (“Ground Glass RTT
  diagnostics were incomplete”); the remaining test in that file passes.

No optical equations, DOF shaders, gather settings, scene geometry, task
thresholds, or PR 8F work are in scope.
