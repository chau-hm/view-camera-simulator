import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createGroundGlassGpuTimer,
  GroundGlassGpuTimer,
  GroundGlassProfiler,
  isGroundGlassProfilingEnabled,
  RollingTimingWindow,
  type GroundGlassGpuTimerContext,
  type GroundGlassProfilingConfiguration,
  type GroundGlassProfilingPass,
} from "../../render/groundGlassProfiling";

const makeConfiguration = (
  rawDebug = false,
): GroundGlassProfilingConfiguration => ({
  sceneId: "architecture-foreground",
  renderQuality: "standard",
  internalResolution: [800, 640],
  gatherResolution: [800, 640],
  gatherScale: 1,
  sampleCount: 32,
  maximumCoCRadiusPx: 42,
  cocStorageFormat: "half-float-mm",
  footprintRepresentation: "local-affine-ellipse",
  dofTechnique: "physical-coc-near-far-oriented-gather",
  previewMode: "upright",
  rawDebug,
  devicePixelRatio: 1,
  zoomEnabled: false,
});

type FakeGpuContext = GroundGlassGpuTimerContext & {
  getExtension: ReturnType<typeof vi.fn>;
  createQuery: ReturnType<typeof vi.fn>;
  beginQuery: ReturnType<typeof vi.fn>;
  endQuery: ReturnType<typeof vi.fn>;
  getQueryParameter: ReturnType<typeof vi.fn>;
  getParameter: ReturnType<typeof vi.fn>;
  deleteQuery: ReturnType<typeof vi.fn>;
  available: boolean;
  disjoint: boolean;
  resultNanoseconds: number;
  queryParameterCalls: number;
  throwOnQueryParameterCall: number | null;
  throwOnEndQuery: boolean;
  createdQueries: unknown[];
  deletedQueries: unknown[];
  finish: ReturnType<typeof vi.fn>;
  readPixels: ReturnType<typeof vi.fn>;
};

const makeFakeGpuContext = () => {
  let nextQueryId = 0;
  const extension = {
    TIME_ELAPSED_EXT: 0x88bf,
    GPU_DISJOINT_EXT: 0x8fbb,
  };
  let activeQuery: unknown = null;
  const context: FakeGpuContext = {
    QUERY_RESULT_AVAILABLE: 0x8867,
    QUERY_RESULT: 0x8866,
    available: false,
    disjoint: false,
    resultNanoseconds: 2_000_000,
    queryParameterCalls: 0,
    throwOnQueryParameterCall: null,
    throwOnEndQuery: false,
    createdQueries: [],
    deletedQueries: [],
    finish: vi.fn(),
    readPixels: vi.fn(),
    getExtension: vi.fn((name: string) =>
      name === "EXT_disjoint_timer_query_webgl2" ? extension : null,
    ),
    createQuery: vi.fn(() => {
      const query = { id: nextQueryId++ };
      context.createdQueries.push(query);
      return query;
    }),
    beginQuery: vi.fn((_target: number, query: unknown) => {
      activeQuery = query;
    }),
    endQuery: vi.fn(() => {
      if (context.throwOnEndQuery) {
        context.throwOnEndQuery = false;
        throw new Error("end failed");
      }
      activeQuery = null;
    }),
    getQueryParameter: vi.fn(function (this: FakeGpuContext, _query: unknown, parameter: number) {
      if (this !== context) throw new TypeError("Illegal invocation");
      context.queryParameterCalls += 1;
      if (context.throwOnQueryParameterCall === context.queryParameterCalls) {
        context.throwOnQueryParameterCall = null;
        throw new Error("query parameter failed");
      }
      if (parameter === context.QUERY_RESULT_AVAILABLE) return context.available;
      if (parameter === context.QUERY_RESULT) return context.resultNanoseconds;
      return 0;
    }),
    getParameter: vi.fn(function (this: FakeGpuContext, parameter: number) {
      if (this !== context) throw new TypeError("Illegal invocation");
      return parameter === extension.GPU_DISJOINT_EXT ? context.disjoint : false;
    }),
    deleteQuery: vi.fn((query: unknown) => {
      context.deletedQueries.push(query);
    }),
  };
  return { context, extension, get activeQuery() { return activeQuery; } };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Ground Glass profiling rolling statistics", () => {
  it("reports bounded average, p50, p95, latest, and count", () => {
    const window = new RollingTimingWindow(3);

    expect(window.snapshot()).toEqual({
      latestMs: null,
      averageMs: null,
      p50Ms: null,
      p95Ms: null,
      count: 0,
    });
    expect(window.push(1)).toBe(true);
    expect(window.push(2)).toBe(true);
    expect(window.push(3)).toBe(true);
    expect(window.push(4)).toBe(true);
    expect(window.snapshot()).toEqual({
      latestMs: 4,
      averageMs: 3,
      p50Ms: 3,
      p95Ms: 4,
      count: 3,
    });
  });

  it("rejects non-finite and negative samples", () => {
    const window = new RollingTimingWindow();

    expect(window.push(Number.NaN)).toBe(false);
    expect(window.push(Number.POSITIVE_INFINITY)).toBe(false);
    expect(window.push(-1)).toBe(false);
    expect(window.snapshot().count).toBe(0);
  });
});

describe("Ground Glass profiling capability and timer lifecycle", () => {
  it("detects the opt-in URL switch without enabling ordinary URLs", () => {
    expect(isGroundGlassProfilingEnabled("?dofProfiling=1")).toBe(true);
    expect(isGroundGlassProfilingEnabled("?groundGlassProfiling=1")).toBe(true);
    expect(isGroundGlassProfilingEnabled("?dofProfiling=0")).toBe(false);
    expect(isGroundGlassProfilingEnabled("")).toBe(false);
  });

  it("returns no GPU timer when the timer-query extension is unavailable", () => {
    const context = makeFakeGpuContext().context;
    (context as { getExtension?: (name: string) => unknown }).getExtension = vi.fn(() => null);

    expect(createGroundGlassGpuTimer({ getContext: () => context })).toBeNull();
    expect(context.createQuery).not.toHaveBeenCalled();
  });

  it("returns no GPU timer when WebGL2 query-result retrieval is unavailable", () => {
    const context = makeFakeGpuContext().context;
    (context as { getQueryParameter?: unknown }).getQueryParameter = undefined;

    expect(createGroundGlassGpuTimer({ getContext: () => context })).toBeNull();
    expect(context.createQuery).not.toHaveBeenCalled();

    const profiler = new GroundGlassProfiler(true, { getContext: () => context });
    expect(profiler.backend).toBe("cpu-fallback");
    profiler.dispose();
  });

  it("reads completed timer results asynchronously and discards disjoint results", () => {
    const fake = makeFakeGpuContext();
    const timer = createGroundGlassGpuTimer({ getContext: () => fake.context });
    expect(timer).toBeInstanceOf(GroundGlassGpuTimer);

    const token = timer!.begin(1, "sceneRender");
    expect(token).not.toBeNull();
    timer!.end(token);
    expect(timer!.pendingCount).toBe(1);
    expect(timer!.poll()).toEqual([]);
    expect(fake.context.finish).not.toHaveBeenCalled();
    expect(fake.context.readPixels).not.toHaveBeenCalled();

    fake.context.available = true;
    expect(timer!.poll()).toEqual([
      { frameId: 1, pass: "sceneRender", durationMs: 2 },
    ]);
    expect(fake.context.getQueryParameter).toHaveBeenCalledWith(
      expect.anything(),
      fake.context.QUERY_RESULT_AVAILABLE,
    );
    expect(fake.context.getQueryParameter).toHaveBeenCalledWith(
      expect.anything(),
      fake.context.QUERY_RESULT,
    );
    expect(fake.context.getParameter).toHaveBeenCalledWith(fake.extension.GPU_DISJOINT_EXT);
    expect(timer!.pendingCount).toBe(0);

    const disjointToken = timer!.begin(2, "composite");
    expect(disjointToken).not.toBeNull();
    expect(fake.context.createdQueries).toHaveLength(1);
    timer!.end(disjointToken);
    fake.context.disjoint = true;
    expect(timer!.poll()).toEqual([]);
    expect(timer!.pendingCount).toBe(0);
    expect(timer!.getDiagnostics().disjointEvents).toBe(1);
    expect(timer!.getDiagnostics().queriesDiscardedDisjoint).toBe(1);

    timer!.dispose();
    expect(fake.context.deletedQueries).toHaveLength(1);
    expect(timer!.begin(3, "sceneRender")).toBeNull();
  });

  it("resets pending queries without publishing stale results", () => {
    const fake = makeFakeGpuContext();
    const timer = createGroundGlassGpuTimer({ getContext: () => fake.context });
    const token = timer!.begin(1, "sceneRender");
    timer!.end(token);

    timer!.reset();
    fake.context.available = true;

    expect(timer!.poll()).toEqual([]);
    expect(timer!.poolSize).toBe(0);
    expect(fake.context.deletedQueries).toHaveLength(1);
  });

  it("returns partial timings together with an explicit poll failure and recovers", () => {
    const fake = makeFakeGpuContext();
    const timer = createGroundGlassGpuTimer({ getContext: () => fake.context }, 5)!;
    const passes: GroundGlassProfilingPass[] = [
      "sceneRender",
      "cocFootprint",
      "farGather",
      "nearGather",
      "composite",
    ];

    passes.forEach((pass) => timer.end(timer.begin(1, pass)));
    fake.context.available = true;
    // Each available result consumes two getQueryParameter calls. Throw on
    // the third query's availability check after two valid timings.
    fake.context.throwOnQueryParameterCall = fake.context.queryParameterCalls + 5;

    const failedPoll = timer.pollWithEvents();
    expect(failedPoll.timings).toHaveLength(2);
    expect(failedPoll.failure).toBe("get-query-parameter-failed");
    expect(failedPoll.disjoint).toBe(false);
    expect(failedPoll.discardedFrameIds).toEqual([1]);
    expect(timer.pendingCount).toBe(0);
    expect(timer.getDiagnostics().gpuQueryState).toBe("error");
    expect(timer.getDiagnostics().lastGpuQueryError).toBe("get-query-parameter-failed");

    const recoveryToken = timer.begin(2, "sceneRender");
    timer.end(recoveryToken);
    const recoveryPoll = timer.pollWithEvents();
    expect(recoveryPoll.failure).toBeNull();
    expect(recoveryPoll.timings).toEqual([
      { frameId: 2, pass: "sceneRender", durationMs: 2 },
    ]);
    expect(timer.getDiagnostics().gpuQueryState).toBe("active");
    expect(timer.getDiagnostics().lastGpuQueryError).toBeNull();
    timer.dispose();
  });

  it("skips a pass when the bounded query pool is full", () => {
    const fake = makeFakeGpuContext();
    const timer = createGroundGlassGpuTimer({ getContext: () => fake.context }, 1);
    const first = timer!.begin(1, "sceneRender");
    timer!.end(first);

    expect(timer!.begin(2, "sceneRender")).toBeNull();
    expect(fake.context.createdQueries).toHaveLength(1);
    timer!.dispose();
  });

  it("reports logical capacity without allocating query objects", () => {
    const fake = makeFakeGpuContext();
    const timer = createGroundGlassGpuTimer({ getContext: () => fake.context }, 5)!;

    expect(timer.availableSlots).toBe(5);
    expect(timer.canReserve(5)).toBe(true);
    expect(timer.canReserve(6)).toBe(false);
    expect(timer.canReserve(0)).toBe(false);
    expect(timer.canReserve(-1)).toBe(false);
    expect(timer.canReserve(Number.NaN)).toBe(false);
    expect(fake.context.createdQueries).toHaveLength(0);

    const first = timer.begin(1, "sceneRender");
    timer.end(first);
    const second = timer.begin(1, "composite");
    timer.end(second);

    expect(timer.pendingCount).toBe(2);
    expect(timer.availableSlots).toBe(3);
    expect(timer.canReserve(3)).toBe(true);
    expect(timer.canReserve(4)).toBe(false);
    expect(fake.context.createdQueries).toHaveLength(2);

    fake.context.available = true;
    expect(timer.poll()).toHaveLength(2);
    expect(timer.availableSlots).toBe(5);
    timer.dispose();
  });
});

describe("Ground Glass profiling pass contract", () => {
  const processedPasses: readonly GroundGlassProfilingPass[] = [
    "sceneRender",
    "cocFootprint",
    "farGather",
    "nearGather",
    "composite",
  ];

  it("admits a processed frame atomically before issuing GPU queries", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );
    const configuration = makeConfiguration();

    // Leave one completed-but-unavailable query pending so only four slots
    // remain for the next processed frame.
    profiler.beginFrame(configuration, 16);
    profiler.beginPass("sceneRender").end();
    profiler.endFrame();
    const beginCallsBeforeRejectedFrame = fake.context.beginQuery.mock.calls.length;
    const createCallsBeforeRejectedFrame = fake.context.createQuery.mock.calls.length;

    profiler.beginFrame(configuration, 16);
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();

    expect(fake.context.beginQuery).toHaveBeenCalledTimes(beginCallsBeforeRejectedFrame);
    expect(fake.context.createQuery).toHaveBeenCalledTimes(createCallsBeforeRejectedFrame);
    expect(profiler.snapshot().frame.count).toBe(2);
    expect(profiler.snapshot().groundGlassGpu?.count).toBe(0);
    expect(profiler.snapshot().physicalDofGpu?.count).toBe(0);
    processedPasses.forEach((pass) => {
      const key = `${pass}Ms` as const;
      expect(profiler.snapshot().passes[key]?.count).toBe(0);
    });
    profiler.dispose();
  });

  it("admits a processed frame when exactly five slots are available", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );

    profiler.beginFrame(makeConfiguration(), 16);
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();

    expect(fake.context.beginQuery).toHaveBeenCalledTimes(5);
    expect(fake.context.createQuery).toHaveBeenCalledTimes(5);
    profiler.dispose();
  });

  it("retains delayed multi-pass results until the owning frame completes", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      10,
    );
    const configuration = makeConfiguration();

    const issueProcessedFrame = () => {
      profiler.beginFrame(configuration, 16);
      processedPasses.forEach((pass) => profiler.beginPass(pass).end());
      profiler.endFrame();
    };

    // Two frames can remain in flight while the GPU reports both results
    // unavailable. The next frame polls them before allocating new queries.
    issueProcessedFrame();
    issueProcessedFrame();
    expect(profiler.snapshot().groundGlassGpu?.count).toBe(0);
    expect(profiler.snapshot().profilingDiagnostics.pendingQueries).toBe(10);

    fake.context.available = true;
    profiler.beginFrame(configuration, 16);
    const snapshot = profiler.snapshot();
    expect(snapshot.groundGlassGpu?.count).toBe(2);
    expect(snapshot.physicalDofGpu?.count).toBe(2);
    processedPasses.forEach((pass) => {
      const key = `${pass}Ms` as const;
      expect(snapshot.passes[key]?.count).toBe(2);
    });
    expect(snapshot.profilingDiagnostics.framesCompletedGpu).toBe(2);
    expect(snapshot.profilingDiagnostics.queriesDroppedOwnership).toBe(0);
    expect(snapshot.profilingDiagnostics.pendingQueries).toBe(0);
    profiler.endFrame();
    profiler.dispose();
  });

  it("keeps unavailable results pending across polls and then recovers", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );
    const configuration = makeConfiguration();

    profiler.beginFrame(configuration, 16);
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();

    fake.context.available = false;
    profiler.beginFrame(configuration, 16);
    expect(profiler.snapshot().profilingDiagnostics.queriesUnavailable).toBe(5);
    expect(profiler.snapshot().profilingDiagnostics.gpuQueryState).toBe("stalled");
    profiler.endFrame();

    fake.context.available = true;
    profiler.beginFrame(configuration, 16);
    expect(profiler.snapshot().groundGlassGpu?.count).toBe(1);
    expect(profiler.snapshot().physicalDofGpu?.count).toBe(1);
    profiler.endFrame();
    profiler.dispose();
  });

  it("discards stale frame ownership on an explicit session reset", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );
    const configuration = makeConfiguration();

    profiler.beginFrame(configuration, 16);
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();
    profiler.resetSession("test-config-change");
    fake.context.available = true;
    profiler.beginFrame(configuration, 16);
    expect(profiler.snapshot().groundGlassGpu?.count).toBe(0);
    expect(profiler.snapshot().profilingDiagnostics.sessionResets).toBe(2);
    expect(profiler.snapshot().profilingDiagnostics.lastResetReason).toBe("test-config-change");
    profiler.endFrame();
    profiler.dispose();
  });

  it("surfaces a begin-query failure instead of presenting a valid frame", () => {
    const fake = makeFakeGpuContext();
    fake.context.beginQuery.mockImplementationOnce(() => {
      throw new Error("begin failed");
    });
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );

    profiler.beginFrame(makeConfiguration(), 16);
    profiler.beginPass("sceneRender").end();
    profiler.endFrame();
    const diagnostics = profiler.snapshot().profilingDiagnostics;
    expect(diagnostics.framesInvalidated).toBe(1);
    expect(diagnostics.queriesBeginFailed).toBe(1);
    expect(diagnostics.lastGpuQueryError).toBe("begin-query-failed");
    profiler.dispose();
  });

  it("invalidates a frame on end-query failure and recovers without a partial sample", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );
    const configuration = makeConfiguration();

    fake.context.throwOnEndQuery = true;
    profiler.beginFrame(configuration, 16);
    profiler.beginPass("sceneRender").end();
    profiler.endFrame();

    const failedSnapshot = profiler.snapshot();
    expect(failedSnapshot.profilingDiagnostics.framesInvalidated).toBe(1);
    expect(failedSnapshot.profilingDiagnostics.queriesEndFailed).toBe(1);
    expect(failedSnapshot.profilingDiagnostics.lastGpuQueryError).toBe("end-query-failed");
    expect(failedSnapshot.profilingDiagnostics.pendingFrames).toBe(0);
    expect(failedSnapshot.groundGlassGpu?.count).toBe(0);
    expect(failedSnapshot.physicalDofGpu?.count).toBe(0);

    // A later begin may start a new frame, but it cannot erase the end-query
    // failure before a healthy asynchronous poll has completed.
    profiler.beginFrame(configuration, 16);
    expect(profiler.snapshot().profilingDiagnostics.lastGpuQueryError).toBe("end-query-failed");
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();

    fake.context.available = true;
    profiler.beginFrame(configuration, 16);
    const recoveredSnapshot = profiler.snapshot();
    expect(recoveredSnapshot.profilingDiagnostics.gpuQueryState).toBe("active");
    expect(recoveredSnapshot.profilingDiagnostics.lastGpuQueryError).toBeNull();
    expect(recoveredSnapshot.groundGlassGpu?.count).toBe(1);
    expect(recoveredSnapshot.physicalDofGpu?.count).toBe(1);
    processedPasses.forEach((pass) => {
      const key = `${pass}Ms` as const;
      expect(recoveredSnapshot.passes[key]?.count).toBe(1);
    });
    profiler.endFrame();
    profiler.dispose();
  });

  it("invalidates a partially completed frame when a later poll query throws", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );
    const configuration = makeConfiguration();

    profiler.beginFrame(configuration, 16);
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();

    fake.context.available = true;
    fake.context.throwOnQueryParameterCall = fake.context.queryParameterCalls + 5;
    profiler.beginFrame(configuration, 16);
    const failedSnapshot = profiler.snapshot();
    expect(failedSnapshot.profilingDiagnostics.queriesCompleted).toBe(2);
    expect(failedSnapshot.profilingDiagnostics.framesInvalidated).toBe(1);
    expect(failedSnapshot.profilingDiagnostics.pendingFrames).toBe(0);
    expect(failedSnapshot.profilingDiagnostics.lastGpuQueryError).toBe("get-query-parameter-failed");
    expect(failedSnapshot.profilingDiagnostics.gpuQueryState).toBe("error");
    expect(failedSnapshot.profilingDiagnostics.queriesDroppedOwnership).toBe(0);
    expect(failedSnapshot.groundGlassGpu?.count).toBe(0);
    expect(failedSnapshot.physicalDofGpu?.count).toBe(0);
    processedPasses.forEach((pass) => {
      const key = `${pass}Ms` as const;
      expect(failedSnapshot.passes[key]?.count).toBe(0);
    });

    // The next complete frame is accepted once the failed frame's ownership
    // has been discarded, proving temporary query errors do not disable the
    // profiler permanently.
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();
    profiler.beginFrame(configuration, 16);
    const recoveredSnapshot = profiler.snapshot();
    expect(recoveredSnapshot.profilingDiagnostics.gpuQueryState).toBe("active");
    expect(recoveredSnapshot.profilingDiagnostics.lastGpuQueryError).toBeNull();
    expect(recoveredSnapshot.profilingDiagnostics.pendingFrames).toBe(0);
    expect(recoveredSnapshot.groundGlassGpu?.count).toBe(1);
    expect(recoveredSnapshot.physicalDofGpu?.count).toBe(1);
    expect(recoveredSnapshot.profilingDiagnostics.framesInvalidated).toBe(1);
    profiler.endFrame();
    profiler.dispose();
  });

  it("uses only two slots for Raw RTT and rejects before a partial allocation", () => {
    const admittedFake = makeFakeGpuContext();
    const admittedProfiler = new GroundGlassProfiler(
      true,
      { getContext: () => admittedFake.context },
      undefined,
      0,
      2,
    );
    const rawConfiguration = makeConfiguration(true);

    admittedProfiler.beginFrame(rawConfiguration, 16);
    admittedProfiler.beginPass("sceneRender").end();
    admittedProfiler.beginPass("composite").end();
    admittedProfiler.endFrame();
    expect(admittedFake.context.beginQuery).toHaveBeenCalledTimes(2);
    expect(admittedProfiler.snapshot().passes.cocFootprintMs).toBeNull();
    expect(admittedProfiler.snapshot().passes.farGatherMs).toBeNull();
    expect(admittedProfiler.snapshot().passes.nearGatherMs).toBeNull();
    expect(admittedProfiler.snapshot().physicalDofGpu).toBeNull();
    admittedProfiler.dispose();

    const rejectedFake = makeFakeGpuContext();
    const rejectedProfiler = new GroundGlassProfiler(
      true,
      { getContext: () => rejectedFake.context },
      undefined,
      0,
      2,
    );
    rejectedProfiler.beginFrame(rawConfiguration, 16);
    rejectedProfiler.beginPass("sceneRender").end();
    rejectedProfiler.endFrame();
    const beginCallsBeforeRejectedFrame = rejectedFake.context.beginQuery.mock.calls.length;

    rejectedProfiler.beginFrame(rawConfiguration, 16);
    rejectedProfiler.beginPass("sceneRender").end();
    rejectedProfiler.beginPass("composite").end();
    rejectedProfiler.beginPass("cocFootprint").end();
    rejectedProfiler.endFrame();

    expect(rejectedFake.context.beginQuery).toHaveBeenCalledTimes(beginCallsBeforeRejectedFrame);
    expect(rejectedFake.context.createQuery).toHaveBeenCalledTimes(1);
    expect(rejectedProfiler.snapshot().frame.count).toBe(2);
    expect(rejectedProfiler.snapshot().physicalDofGpu).toBeNull();
    rejectedProfiler.dispose();
  });

  it("resumes GPU profiling after pending queries complete", () => {
    const fake = makeFakeGpuContext();
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => fake.context },
      undefined,
      0,
      5,
    );
    const configuration = makeConfiguration();

    profiler.beginFrame(configuration, 16);
    profiler.beginPass("sceneRender").end();
    profiler.endFrame();
    const beginCallsAfterFirstFrame = fake.context.beginQuery.mock.calls.length;

    // Capacity is still four, so this whole frame is skipped.
    profiler.beginFrame(configuration, 16);
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();
    expect(fake.context.beginQuery).toHaveBeenCalledTimes(beginCallsAfterFirstFrame);

    fake.context.available = true;
    profiler.beginFrame(configuration, 16);
    processedPasses.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();

    expect(fake.context.beginQuery).toHaveBeenCalledTimes(beginCallsAfterFirstFrame + 5);
    expect(fake.context.createQuery).toHaveBeenCalledTimes(5);
    expect(profiler.snapshot().frame.count).toBe(3);
    profiler.dispose();
  });

  it("uses labeled CPU submission scopes when GPU queries are unavailable", () => {
    const snapshots: ReturnType<GroundGlassProfiler["snapshot"]>[] = [];
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => ({}) },
      (snapshot) => snapshots.push(snapshot),
      0,
    );
    expect(profiler.backend).toBe("cpu-fallback");

    profiler.beginFrame(makeConfiguration(), 16);
    const passes: GroundGlassProfilingPass[] = [
      "sceneRender",
      "cocFootprint",
      "farGather",
      "nearGather",
      "composite",
    ];
    passes.forEach((pass) => profiler.beginPass(pass).end());
    profiler.endFrame();

    const snapshot = snapshots.at(-1);
    expect(snapshot?.timingUnit).toBe("cpu-submit-ms");
    expect(snapshot?.frame.count).toBe(1);
    expect(snapshot?.approxFps).toBeGreaterThan(0);
    expect(snapshot?.groundGlassCpuSubmit?.count).toBe(1);
    expect(snapshot?.physicalDofCpuSubmit?.count).toBe(1);
    expect(snapshot?.passes.sceneRenderMs?.count).toBe(1);
    expect(snapshot?.passes.cocFootprintMs?.count).toBe(1);
    expect(snapshot?.passes.farGatherMs?.count).toBe(1);
    expect(snapshot?.passes.nearGatherMs?.count).toBe(1);
    expect(snapshot?.passes.compositeMs?.count).toBe(1);
    expect(snapshot?.passes.compositeMs?.latestMs).toBeGreaterThanOrEqual(0);
    profiler.dispose();
  });

  it("does not issue or publish DOF pass timings for Raw RTT", () => {
    const snapshots: ReturnType<GroundGlassProfiler["snapshot"]>[] = [];
    const profiler = new GroundGlassProfiler(
      true,
      { getContext: () => ({}) },
      (snapshot) => snapshots.push(snapshot),
      0,
    );

    profiler.beginFrame(makeConfiguration(true), 16);
    profiler.beginPass("sceneRender").end();
    profiler.beginPass("composite").end();
    profiler.endFrame();

    const snapshot = snapshots.at(-1);
    expect(snapshot?.rawDebug).toBe(true);
    expect(snapshot?.passes.sceneRenderMs?.count).toBe(1);
    expect(snapshot?.passes.compositeMs?.count).toBe(1);
    expect(snapshot?.passes.cocFootprintMs).toBeNull();
    expect(snapshot?.passes.farGatherMs).toBeNull();
    expect(snapshot?.passes.nearGatherMs).toBeNull();
    expect(snapshot?.physicalDofCpuSubmit).toBeNull();
    profiler.dispose();
  });

  it("does not create timing resources or publish snapshots when disabled", () => {
    const callback = vi.fn();
    const profiler = new GroundGlassProfiler(
      false,
      { getContext: () => { throw new Error("must not inspect WebGL"); } },
      callback,
    );

    profiler.beginFrame(makeConfiguration(), 16);
    profiler.beginPass("sceneRender").end();
    profiler.endFrame();

    expect(profiler.backend).toBe("disabled");
    expect(callback).not.toHaveBeenCalled();
    profiler.dispose();
  });
});
