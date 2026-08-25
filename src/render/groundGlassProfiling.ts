import type { GroundGlassCocStorageFormat } from "./groundGlassCocTarget";
import type { RenderQualityProfile } from "../types/ui";

export const GROUND_GLASS_PROFILING_WINDOW_SIZE = 60;
export const GROUND_GLASS_PROFILING_QUERY_POOL_SIZE = 24;
export const GROUND_GLASS_PROFILING_PUBLISH_INTERVAL_MS = 250;

export type GroundGlassProfilingBackend =
  | "gpu-query"
  | "cpu-fallback"
  | "unavailable"
  | "disabled";

export type GroundGlassProfilingTimingUnit =
  | "gpu-ms"
  | "cpu-submit-ms"
  | "none";

export type GroundGlassGpuQueryState =
  | "unavailable"
  | "detected"
  | "active"
  | "stalled"
  | "disjoint"
  | "error";

export type GroundGlassProfilingPass =
  | "sceneRender"
  | "cocFootprint"
  | "farGather"
  | "nearGather"
  | "composite";

export type GroundGlassProfilingTimingStats = {
  latestMs: number | null;
  averageMs: number | null;
  p50Ms: number | null;
  p95Ms: number | null;
  count: number;
};

export type GroundGlassProfilingDiagnostics = {
  gpuQueryState: GroundGlassGpuQueryState;
  framesAttempted: number;
  framesAccepted: number;
  framesRejectedCapacity: number;
  framesInvalidated: number;
  framesCompletedGpu: number;
  queriesBegun: number;
  queriesBeginFailed: number;
  queriesEnded: number;
  queriesEndFailed: number;
  queriesPolled: number;
  queriesCompleted: number;
  queriesUnavailable: number;
  disjointEvents: number;
  queriesDiscardedDisjoint: number;
  queriesDroppedOwnership: number;
  pendingQueries: number;
  queryPoolSize: number;
  availableQuerySlots: number;
  pendingFrames: number;
  sessionResets: number;
  lastResetReason: string | null;
  lastRejectedReason: string | null;
  lastGpuQueryError: string | null;
};

export type GroundGlassProfilingConfiguration = {
  sceneId: string | null;
  renderQuality: RenderQualityProfile;
  internalResolution: [number, number];
  gatherResolution: [number, number];
  gatherScale: number;
  sampleCount: number;
  maximumCoCRadiusPx: number;
  cocStorageFormat: GroundGlassCocStorageFormat | null;
  footprintRepresentation: "local-affine-ellipse";
  dofTechnique: string;
  previewMode: "raw" | "upright";
  rawDebug: boolean;
  devicePixelRatio: number;
  zoomEnabled: boolean;
};

export type GroundGlassProfilingSnapshot = GroundGlassProfilingConfiguration & {
  enabled: boolean;
  profilingBackend: GroundGlassProfilingBackend;
  timingUnit: GroundGlassProfilingTimingUnit;
  frame: GroundGlassProfilingTimingStats;
  approxFps: number | null;
  groundGlassGpu: GroundGlassProfilingTimingStats | null;
  physicalDofGpu: GroundGlassProfilingTimingStats | null;
  groundGlassCpuSubmit: GroundGlassProfilingTimingStats | null;
  physicalDofCpuSubmit: GroundGlassProfilingTimingStats | null;
  profilingDiagnostics: GroundGlassProfilingDiagnostics;
  passes: {
    sceneRenderMs: GroundGlassProfilingTimingStats | null;
    cocFootprintMs: GroundGlassProfilingTimingStats | null;
    farGatherMs: GroundGlassProfilingTimingStats | null;
    nearGatherMs: GroundGlassProfilingTimingStats | null;
    compositeMs: GroundGlassProfilingTimingStats | null;
  };
};

const PASS_NAMES: readonly GroundGlassProfilingPass[] = [
  "sceneRender",
  "cocFootprint",
  "farGather",
  "nearGather",
  "composite",
];

const EMPTY_TIMING_STATS: GroundGlassProfilingTimingStats = {
  latestMs: null,
  averageMs: null,
  p50Ms: null,
  p95Ms: null,
  count: 0,
};

export const createEmptyGroundGlassTimingStats = (): GroundGlassProfilingTimingStats => ({
  ...EMPTY_TIMING_STATS,
});

/**
 * Compute bounded timing statistics using nearest-rank percentiles. Invalid
 * and negative samples are ignored so a disjoint/failed timer cannot publish
 * NaN or Infinity into diagnostics.
 */
export const calculateGroundGlassTimingStats = (
  samples: readonly number[],
): GroundGlassProfilingTimingStats => {
  const finiteSamples = samples.filter((sample) => Number.isFinite(sample) && sample >= 0);
  if (finiteSamples.length === 0) return createEmptyGroundGlassTimingStats();

  const sorted = [...finiteSamples].sort((a, b) => a - b);
  const percentile = (fraction: number): number => {
    const rank = Math.max(1, Math.ceil(sorted.length * fraction));
    return sorted[rank - 1];
  };

  return {
    latestMs: finiteSamples[finiteSamples.length - 1],
    averageMs: finiteSamples.reduce((sum, sample) => sum + sample, 0) / finiteSamples.length,
    p50Ms: percentile(0.5),
    p95Ms: percentile(0.95),
    count: finiteSamples.length,
  };
};

/** A small FIFO timing window with no unbounded history. */
export class RollingTimingWindow {
  private readonly samples: number[] = [];

  public readonly limit: number;

  public constructor(limit = GROUND_GLASS_PROFILING_WINDOW_SIZE) {
    this.limit = Math.max(1, Math.floor(limit));
  }

  public push(sample: number): boolean {
    if (!Number.isFinite(sample) || sample < 0) return false;
    this.samples.push(sample);
    if (this.samples.length > this.limit) this.samples.shift();
    return true;
  }

  public clear(): void {
    this.samples.length = 0;
  }

  public snapshot(): GroundGlassProfilingTimingStats {
    return calculateGroundGlassTimingStats(this.samples);
  }
}

export const readGroundGlassProfilingClockMs = (): number => {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
};

/** Profiling is developer opt-in and has no public UI or telemetry side effect. */
export const isGroundGlassProfilingEnabled = (search?: string): boolean => {
  const locationSearch = search ?? (typeof window !== "undefined" ? window.location.search : "");
  const params = new URLSearchParams(locationSearch);
  return params.get("dofProfiling") === "1" || params.get("groundGlassProfiling") === "1";
};

export type GroundGlassTimerExtension = {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
};

/** Minimal WebGL2 surface used by the timer-query adapter and its tests. */
export type GroundGlassGpuTimerContext = {
  readonly QUERY_RESULT_AVAILABLE: number;
  readonly QUERY_RESULT: number;
  readonly getExtension?: (name: string) => unknown;
  readonly createQuery?: () => unknown | null;
  readonly beginQuery?: (target: number, query: unknown) => void;
  readonly endQuery?: (target: number) => void;
  /** WebGL2 query-object result access; getQuery is not a result API. */
  readonly getQueryParameter?: (query: unknown, parameter: number) => unknown;
  readonly getParameter?: (parameter: number) => unknown;
  readonly deleteQuery?: (query: unknown) => void;
};

export type GroundGlassGpuTimerRenderer = {
  getContext: () => unknown;
};

export type GroundGlassGpuTiming = {
  frameId: number;
  pass: GroundGlassProfilingPass;
  durationMs: number;
};

export type GroundGlassGpuTimerFailure = {
  reason: string;
  frameId: number;
  pass: GroundGlassProfilingPass;
};

export type GroundGlassGpuPollResult = {
  timings: GroundGlassGpuTiming[];
  failure: string | null;
  disjoint: boolean;
  discardedFrameIds: number[];
};

type QuerySlot = {
  query: unknown;
  active: {
    frameId: number;
    pass: GroundGlassProfilingPass;
    ended: boolean;
  } | null;
};

export type GroundGlassGpuTimerToken = {
  slot: QuerySlot;
  ended: boolean;
};

export type GroundGlassGpuTimerDiagnostics = {
  gpuQueryState: Exclude<GroundGlassGpuQueryState, "unavailable">;
  queriesBegun: number;
  queriesBeginFailed: number;
  queriesEnded: number;
  queriesEndFailed: number;
  queriesPolled: number;
  queriesCompleted: number;
  queriesUnavailable: number;
  disjointEvents: number;
  queriesDiscardedDisjoint: number;
  pendingQueries: number;
  queryPoolSize: number;
  availableQuerySlots: number;
  lastGpuQueryError: string | null;
};

/**
 * Non-blocking EXT_disjoint_timer_query_webgl2 adapter.
 *
 * A fixed query pool is reused after QUERY_RESULT_AVAILABLE becomes true.
 * No finish/readPixels call is made, and result reads are deferred to a later
 * poll so timing cannot synchronize the renderer with the GPU.
 */
export class GroundGlassGpuTimer {
  private readonly slots: QuerySlot[] = [];
  private disposed = false;
  private readonly context: GroundGlassGpuTimerContext;
  private readonly extension: GroundGlassTimerExtension;
  private readonly maxQueries: number;
  private gpuQueryState: Exclude<GroundGlassGpuQueryState, "unavailable"> = "detected";
  private queriesBegun = 0;
  private queriesBeginFailed = 0;
  private queriesEnded = 0;
  private queriesEndFailed = 0;
  private queriesPolled = 0;
  private queriesCompleted = 0;
  private queriesUnavailable = 0;
  private disjointEvents = 0;
  private queriesDiscardedDisjoint = 0;
  private lastGpuQueryError: string | null = null;

  public constructor(
    context: GroundGlassGpuTimerContext,
    extension: GroundGlassTimerExtension,
    maxQueries = GROUND_GLASS_PROFILING_QUERY_POOL_SIZE,
  ) {
    this.context = context;
    this.extension = extension;
    this.maxQueries = maxQueries;
  }

  public get poolSize(): number {
    return this.slots.length;
  }

  public get pendingCount(): number {
    return this.slots.filter((slot) => slot.active !== null).length;
  }

  public get availableSlots(): number {
    return Math.max(0, this.maxQueries - this.pendingCount);
  }

  /** Checks logical pool capacity without allocating or reserving a query. */
  public canReserve(count: number): boolean {
    return Number.isInteger(count) && count > 0 && count <= this.availableSlots;
  }

  public begin(frameId: number, pass: GroundGlassProfilingPass): GroundGlassGpuTimerToken | null {
    if (this.disposed ||
        !this.context.createQuery ||
        !this.context.beginQuery ||
        !this.context.endQuery) {
      this.queriesBeginFailed += 1;
      this.setError("query-api-unavailable");
      return null;
    }

    let slot = this.slots.find((candidate) => candidate.active === null);
    if (!slot) {
      if (this.slots.length >= this.maxQueries) {
        this.queriesBeginFailed += 1;
        this.setError("query-pool-exhausted");
        return null;
      }
      let query: unknown | null;
      try {
        query = this.context.createQuery();
      } catch {
        query = null;
      }
      if (query === null || query === undefined) {
        this.queriesBeginFailed += 1;
        this.setError("create-query-failed");
        return null;
      }
      slot = { query, active: null };
      this.slots.push(slot);
    }

    try {
      this.context.beginQuery(this.extension.TIME_ELAPSED_EXT, slot.query);
      slot.active = { frameId, pass, ended: false };
    } catch {
      slot.active = null;
      this.queriesBeginFailed += 1;
      this.setError("begin-query-failed");
      return null;
    }
    this.queriesBegun += 1;
    // A successful begin can start recovery, but it must not erase an
    // unconsumed failure from an earlier end/poll operation. A later healthy
    // poll clears the error after the profiler has had a chance to invalidate
    // the affected frame.
    if (this.lastGpuQueryError === null) this.gpuQueryState = "active";
    return { slot, ended: false };
  }

  public end(token: GroundGlassGpuTimerToken | null): GroundGlassGpuTimerFailure | null {
    if (!token || token.ended || this.disposed || !this.context.endQuery) return null;
    token.ended = true;
    const active = token.slot.active;
    if (!active) return null;
    active.ended = true;
    try {
      this.context.endQuery(this.extension.TIME_ELAPSED_EXT);
      this.queriesEnded += 1;
    } catch {
      token.slot.active = null;
      this.queriesEndFailed += 1;
      this.setError("end-query-failed");
      return {
        reason: "end-query-failed",
        frameId: active.frameId,
        pass: active.pass,
      };
    }
    return null;
  }

  /**
   * Compatibility wrapper for callers that only need completed timings.
   * GroundGlassProfiler uses pollWithEvents() so transient failures cannot be
   * hidden by a later successful result in the same poll.
   */
  public poll(): GroundGlassGpuTiming[] {
    return this.pollWithEvents().timings;
  }

  public pollWithEvents(): GroundGlassGpuPollResult {
    const result: GroundGlassGpuPollResult = {
      timings: [],
      failure: null,
      disjoint: false,
      discardedFrameIds: [],
    };
    const discardedFrameIds = new Set<number>();
    const discardActiveQueries = (): void => {
      this.slots.forEach((slot) => {
        if (slot.active) discardedFrameIds.add(slot.active.frameId);
        slot.active = null;
      });
      result.discardedFrameIds = [...discardedFrameIds];
    };
    const fail = (reason: string): void => {
      result.failure = reason;
      discardActiveQueries();
      this.setError(reason);
    };

    if (this.disposed || !this.context.getQueryParameter || !this.context.getParameter) {
      fail("query-api-unavailable");
      return result;
    }

    let disjoint = false;
    try {
      // Keep the native WebGL context receiver. WebGL methods are not
      // transferable callbacks; invoking a destructured getParameter throws
      // Illegal invocation in real browsers even though test doubles often do
      // not require a receiver.
      disjoint = Boolean(
        this.context.getParameter!(this.extension.GPU_DISJOINT_EXT),
      );
    } catch {
      // The disjoint flag itself could not be read. Fail closed and release
      // the outstanding slots, but do not mislabel an API failure as a GPU
      // disjoint event.
      fail("get-parameter-failed");
      return result;
    }
    if (disjoint) {
      // The GPU clock was invalidated. Discard every pending result rather
      // than publishing a measurement from an unknown time base.
      this.disjointEvents += 1;
      this.queriesDiscardedDisjoint += this.pendingCount;
      discardActiveQueries();
      this.gpuQueryState = "disjoint";
      result.disjoint = true;
      return result;
    }

    const completed: GroundGlassGpuTiming[] = [];
    let pendingPolled = 0;
    for (const slot of this.slots) {
      const active = slot.active;
      if (!active || !active.ended) continue;
      this.queriesPolled += 1;
      pendingPolled += 1;

      let available = false;
      try {
        available = Boolean(
          this.context.getQueryParameter!(slot.query, this.context.QUERY_RESULT_AVAILABLE),
        );
      } catch {
        fail("get-query-parameter-failed");
        break;
      }
      if (!available) {
        this.queriesUnavailable += 1;
        continue;
      }

      let nanoseconds: number;
      try {
        nanoseconds = Number(
          this.context.getQueryParameter!(slot.query, this.context.QUERY_RESULT),
        );
      } catch {
        fail("get-query-result-failed");
        break;
      }
      slot.active = null;
      const durationMs = nanoseconds / 1e6;
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        completed.push({ frameId: active.frameId, pass: active.pass, durationMs });
        this.queriesCompleted += 1;
      }
    }
    result.timings = completed;
    result.discardedFrameIds = [...discardedFrameIds];
    if (result.failure !== null) {
      // Failure dominates partial success. Do not let completed timings from
      // earlier slots make this poll look healthy.
      this.gpuQueryState = "error";
    } else if (completed.length > 0) {
      this.gpuQueryState = "active";
      this.lastGpuQueryError = null;
    } else if (pendingPolled > 0 && this.pendingCount > 0) {
      if (this.lastGpuQueryError === null) this.gpuQueryState = "stalled";
    }
    return result;
  }

  public getDiagnostics(): GroundGlassGpuTimerDiagnostics {
    return {
      gpuQueryState: this.gpuQueryState,
      queriesBegun: this.queriesBegun,
      queriesBeginFailed: this.queriesBeginFailed,
      queriesEnded: this.queriesEnded,
      queriesEndFailed: this.queriesEndFailed,
      queriesPolled: this.queriesPolled,
      queriesCompleted: this.queriesCompleted,
      queriesUnavailable: this.queriesUnavailable,
      disjointEvents: this.disjointEvents,
      queriesDiscardedDisjoint: this.queriesDiscardedDisjoint,
      pendingQueries: this.pendingCount,
      queryPoolSize: this.maxQueries,
      availableQuerySlots: this.availableSlots,
      lastGpuQueryError: this.lastGpuQueryError,
    };
  }

  /** Discards pending results without waiting for GPU completion. */
  public reset(): void {
    this.slots.forEach((slot) => {
      try { this.context.deleteQuery?.(slot.query); } catch { /* best effort */ }
    });
    this.slots.length = 0;
    this.gpuQueryState = "detected";
    this.lastGpuQueryError = null;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
  }

  private setError(reason: string): void {
    this.gpuQueryState = "error";
    this.lastGpuQueryError = reason;
  }
}

export const createGroundGlassGpuTimer = (
  renderer: GroundGlassGpuTimerRenderer,
  maxQueries = GROUND_GLASS_PROFILING_QUERY_POOL_SIZE,
): GroundGlassGpuTimer | null => {
  let context: GroundGlassGpuTimerContext;
  try {
    context = renderer.getContext() as GroundGlassGpuTimerContext;
  } catch {
    return null;
  }
  if (!context ||
      typeof context.getExtension !== "function" ||
      typeof context.createQuery !== "function" ||
      typeof context.beginQuery !== "function" ||
      typeof context.endQuery !== "function" ||
      typeof context.getQueryParameter !== "function" ||
      typeof context.getParameter !== "function" ||
      typeof context.deleteQuery !== "function") return null;

  let extension: GroundGlassTimerExtension | null = null;
  try {
    extension = context.getExtension("EXT_disjoint_timer_query_webgl2") as GroundGlassTimerExtension | null;
  } catch {
    extension = null;
  }
  if (!extension ||
      !Number.isFinite(extension.TIME_ELAPSED_EXT) ||
      !Number.isFinite(extension.GPU_DISJOINT_EXT) ||
      !Number.isFinite(context.QUERY_RESULT_AVAILABLE) ||
      !Number.isFinite(context.QUERY_RESULT)) return null;
  return new GroundGlassGpuTimer(context, extension, maxQueries);
};

type FrameRecord = {
  id: number;
  rawDebug: boolean;
  expected: readonly GroundGlassProfilingPass[];
  timings: Partial<Record<GroundGlassProfilingPass, number>>;
  measurementAccepted: boolean;
  valid: boolean;
  finished: boolean;
  completed: boolean;
};

type GroundGlassPassScope = { end: () => void };

const NOOP_SCOPE: GroundGlassPassScope = { end: () => undefined };

const statsOrNull = (
  window: RollingTimingWindow,
  enabled: boolean,
): GroundGlassProfilingTimingStats | null => enabled ? window.snapshot() : null;

/**
 * Owns pass scopes, async result aggregation, bounded windows, and throttled
 * snapshot publication for one mounted Ground Glass renderer.
 */
export class GroundGlassProfiler {
  private readonly gpuTimer: GroundGlassGpuTimer | null;
  private readonly windows: Record<GroundGlassProfilingPass, RollingTimingWindow> = {
    sceneRender: new RollingTimingWindow(),
    cocFootprint: new RollingTimingWindow(),
    farGather: new RollingTimingWindow(),
    nearGather: new RollingTimingWindow(),
    composite: new RollingTimingWindow(),
  };
  private readonly frameWindow = new RollingTimingWindow();
  private readonly groundGlassWindow = new RollingTimingWindow();
  private readonly physicalDofWindow = new RollingTimingWindow();
  private readonly pendingFrames = new Map<number, FrameRecord>();
  private frameId = 0;
  private currentFrame: FrameRecord | null = null;
  private measurementKey: string | null = null;
  private lastConfig: GroundGlassProfilingConfiguration | null = null;
  private lastPublishedAt = Number.NEGATIVE_INFINITY;
  private lastSnapshot: GroundGlassProfilingSnapshot | null = null;
  private framesAttempted = 0;
  private framesAccepted = 0;
  private framesRejectedCapacity = 0;
  private framesInvalidated = 0;
  private framesCompletedGpu = 0;
  private queriesDroppedOwnership = 0;
  private sessionResets = 0;
  private lastResetReason: string | null = null;
  private lastRejectedReason: string | null = null;
  private readonly discardedFrameIds = new Set<number>();
  private readonly enabled: boolean;
  private readonly onSnapshot?: (snapshot: GroundGlassProfilingSnapshot) => void;
  private readonly publishIntervalMs: number;

  public readonly backend: GroundGlassProfilingBackend;

  public constructor(
    enabled: boolean,
    renderer: GroundGlassGpuTimerRenderer,
    onSnapshot?: (snapshot: GroundGlassProfilingSnapshot) => void,
    publishIntervalMs = GROUND_GLASS_PROFILING_PUBLISH_INTERVAL_MS,
    maxGpuQueries = GROUND_GLASS_PROFILING_QUERY_POOL_SIZE,
  ) {
    this.enabled = enabled;
    this.onSnapshot = onSnapshot;
    this.publishIntervalMs = publishIntervalMs;
    if (!enabled) {
      this.backend = "disabled";
      this.gpuTimer = null;
      return;
    }
    this.gpuTimer = createGroundGlassGpuTimer(renderer, maxGpuQueries);
    this.backend = this.gpuTimer ? "gpu-query" : "cpu-fallback";
  }

  public beginFrame(
    configuration: GroundGlassProfilingConfiguration,
    frameTimeMs?: number,
  ): void {
    if (!this.enabled) return;
    this.framesAttempted += 1;
    this.pollGpuResults();

    const key = JSON.stringify([
      configuration.sceneId,
      configuration.renderQuality,
      configuration.internalResolution,
      configuration.gatherResolution,
      configuration.gatherScale,
      configuration.sampleCount,
      configuration.maximumCoCRadiusPx,
      configuration.cocStorageFormat,
      configuration.previewMode,
      configuration.rawDebug,
      configuration.zoomEnabled,
    ]);
    if (this.measurementKey !== key) {
      this.resetSession("measurement-key-change");
      this.measurementKey = key;
    }

    this.lastConfig = configuration;
    if (Number.isFinite(frameTimeMs) && (frameTimeMs ?? 0) >= 0) {
      this.frameWindow.push(frameTimeMs as number);
    }

    const expected = configuration.rawDebug
      ? (["sceneRender", "composite"] as const)
      : PASS_NAMES;
    const measurementAccepted = this.backend !== "gpu-query" ||
      (this.gpuTimer?.canReserve(expected.length) ?? false);
    if (measurementAccepted) {
      this.framesAccepted += 1;
    } else {
      this.framesRejectedCapacity += 1;
      this.lastRejectedReason = `query-capacity:${expected.length}`;
    }
    this.currentFrame = {
      id: ++this.frameId,
      rawDebug: configuration.rawDebug,
      expected,
      timings: {},
      measurementAccepted,
      valid: this.backend !== "unavailable",
      finished: false,
      completed: false,
    };
  }

  public beginPass(pass: GroundGlassProfilingPass): GroundGlassPassScope {
    const frame = this.currentFrame;
    if (!this.enabled || !frame || !frame.expected.includes(pass) ||
        !frame.measurementAccepted || !frame.valid) {
      return NOOP_SCOPE;
    }

    if (this.backend === "gpu-query") {
      const token = this.gpuTimer?.begin(frame.id, pass) ?? null;
      if (!token) {
        this.invalidateFrame(frame, "begin-query-failed");
        return NOOP_SCOPE;
      }
      let ended = false;
      return {
        end: () => {
          if (ended) return;
          ended = true;
          const failure = this.gpuTimer?.end(token) ?? null;
          if (failure) this.invalidateFrame(frame, failure.reason);
        },
      };
    }

    if (this.backend !== "cpu-fallback") return NOOP_SCOPE;
    const startedAt = readGroundGlassProfilingClockMs();
    let ended = false;
    return {
      end: () => {
        if (ended) return;
        ended = true;
        this.recordTiming(frame.id, pass, readGroundGlassProfilingClockMs() - startedAt);
      },
    };
  }

  public endFrame(): void {
    const frame = this.currentFrame;
    if (!frame) return;
    frame.finished = true;
    this.currentFrame = null;
    if (!frame.measurementAccepted || !frame.valid || this.backend === "unavailable") {
      if (!frame.valid) {
        if (this.discardedFrameIds.size >= GROUND_GLASS_PROFILING_QUERY_POOL_SIZE * 2) {
          const oldest = this.discardedFrameIds.values().next().value;
          if (oldest !== undefined) this.discardedFrameIds.delete(oldest);
        }
        this.discardedFrameIds.add(frame.id);
      }
      this.pendingFrames.delete(frame.id);
    } else {
      this.pendingFrames.set(frame.id, frame);
      this.tryCompleteFrame(frame);
      this.trimPendingFrames();
    }
    this.maybePublish();
  }

  public pollGpuResults(): void {
    if (this.backend !== "gpu-query") return;
    const timer = this.gpuTimer;
    if (!timer) return;
    const result = timer.pollWithEvents();
    if (result.disjoint) {
      this.invalidatePendingGpuFrames("gpu-disjoint");
    } else if (result.failure) {
      const reason = `gpu-query:${result.failure}`;
      if (result.discardedFrameIds.length > 0) {
        this.invalidateGpuFrames(result.discardedFrameIds, reason);
      } else {
        this.invalidatePendingGpuFrames(reason);
      }
    } else if (result.discardedFrameIds.length > 0) {
      // Defensive handling for a timer implementation that discards query
      // ownership without classifying it as a disjoint or API failure.
      this.invalidateGpuFrames(result.discardedFrameIds, "gpu-query:discarded");
    }
    result.timings.forEach((timing) => {
      this.recordTiming(timing.frameId, timing.pass, timing.durationMs);
    });
  }

  /** Reset windows and discard pending GPU results after a resource/config change. */
  public resetSession(reason = "explicit-reset"): void {
    if (this.pendingFrames.size > 0 || this.currentFrame) {
      this.framesInvalidated += this.pendingFrames.size + (this.currentFrame ? 1 : 0);
    }
    this.sessionResets += 1;
    this.lastResetReason = reason;
    this.gpuTimer?.reset();
    this.pendingFrames.clear();
    this.currentFrame = null;
    this.discardedFrameIds.clear();
    this.frameWindow.clear();
    this.groundGlassWindow.clear();
    this.physicalDofWindow.clear();
    PASS_NAMES.forEach((pass) => this.windows[pass].clear());
    this.lastPublishedAt = Number.NEGATIVE_INFINITY;
    this.lastSnapshot = null;
  }

  public snapshot(configuration = this.lastConfig): GroundGlassProfilingSnapshot {
    const config = configuration ?? {
      sceneId: null,
      renderQuality: "standard" as RenderQualityProfile,
      internalResolution: [0, 0] as [number, number],
      gatherResolution: [0, 0] as [number, number],
      gatherScale: 0,
      sampleCount: 0,
      maximumCoCRadiusPx: 0,
      cocStorageFormat: null,
      footprintRepresentation: "local-affine-ellipse" as const,
      dofTechnique: "physical-coc-near-far-oriented-gather",
      previewMode: "upright" as const,
      rawDebug: false,
      devicePixelRatio: 1,
      zoomEnabled: false,
    };
    const rawDebug = config.rawDebug;
    const passStats = (pass: GroundGlassProfilingPass): GroundGlassProfilingTimingStats | null =>
      statsOrNull(this.windows[pass], !rawDebug || pass === "sceneRender" || pass === "composite");
    const gpuStats = this.backend === "gpu-query";
    const cpuStats = this.backend === "cpu-fallback";
    const frameStats = this.frameWindow.snapshot();
    const timerDiagnostics = this.gpuTimer?.getDiagnostics();
    return {
      ...config,
      internalResolution: [...config.internalResolution] as [number, number],
      gatherResolution: [...config.gatherResolution] as [number, number],
      enabled: this.enabled,
      profilingBackend: this.backend,
      timingUnit: gpuStats ? "gpu-ms" : cpuStats ? "cpu-submit-ms" : "none",
      frame: frameStats,
      approxFps: frameStats.averageMs && frameStats.averageMs > 0
        ? 1000 / frameStats.averageMs
        : null,
      groundGlassGpu: gpuStats ? this.groundGlassWindow.snapshot() : null,
      physicalDofGpu: gpuStats && !rawDebug ? this.physicalDofWindow.snapshot() : null,
      groundGlassCpuSubmit: cpuStats ? this.groundGlassWindow.snapshot() : null,
      physicalDofCpuSubmit: cpuStats && !rawDebug ? this.physicalDofWindow.snapshot() : null,
      profilingDiagnostics: {
        gpuQueryState: timerDiagnostics?.gpuQueryState ?? "unavailable",
        framesAttempted: this.framesAttempted,
        framesAccepted: this.framesAccepted,
        framesRejectedCapacity: this.framesRejectedCapacity,
        framesInvalidated: this.framesInvalidated,
        framesCompletedGpu: this.framesCompletedGpu,
        queriesBegun: timerDiagnostics?.queriesBegun ?? 0,
        queriesBeginFailed: timerDiagnostics?.queriesBeginFailed ?? 0,
        queriesEnded: timerDiagnostics?.queriesEnded ?? 0,
        queriesEndFailed: timerDiagnostics?.queriesEndFailed ?? 0,
        queriesPolled: timerDiagnostics?.queriesPolled ?? 0,
        queriesCompleted: timerDiagnostics?.queriesCompleted ?? 0,
        queriesUnavailable: timerDiagnostics?.queriesUnavailable ?? 0,
        disjointEvents: timerDiagnostics?.disjointEvents ?? 0,
        queriesDiscardedDisjoint: timerDiagnostics?.queriesDiscardedDisjoint ?? 0,
        queriesDroppedOwnership: this.queriesDroppedOwnership,
        pendingQueries: timerDiagnostics?.pendingQueries ?? 0,
        queryPoolSize: timerDiagnostics?.queryPoolSize ?? 0,
        availableQuerySlots: timerDiagnostics?.availableQuerySlots ?? 0,
        pendingFrames: this.pendingFrames.size,
        sessionResets: this.sessionResets,
        lastResetReason: this.lastResetReason,
        lastRejectedReason: this.lastRejectedReason,
        lastGpuQueryError: timerDiagnostics?.lastGpuQueryError ?? null,
      },
      passes: {
        sceneRenderMs: passStats("sceneRender"),
        cocFootprintMs: passStats("cocFootprint"),
        farGatherMs: passStats("farGather"),
        nearGatherMs: passStats("nearGather"),
        compositeMs: passStats("composite"),
      },
    };
  }

  public getLatestSnapshot(): GroundGlassProfilingSnapshot | null {
    return this.lastSnapshot;
  }

  public dispose(): void {
    this.resetSession();
    this.gpuTimer?.dispose();
  }

  private recordTiming(
    frameId: number,
    pass: GroundGlassProfilingPass,
    durationMs: number,
  ): void {
    const frame = this.currentFrame?.id === frameId
      ? this.currentFrame
      : this.pendingFrames.get(frameId);
    if (!frame) {
      if (!this.discardedFrameIds.has(frameId)) this.queriesDroppedOwnership += 1;
      return;
    }
    if (!frame.valid || !Number.isFinite(durationMs) || durationMs < 0) return;
    frame.timings[pass] = durationMs;
    if (frame.finished) this.tryCompleteFrame(frame);
  }

  private tryCompleteFrame(frame: FrameRecord): void {
    if (!frame.finished || !frame.valid) return;
    if (!frame.expected.every((pass) => Number.isFinite(frame.timings[pass]))) return;

    const timings = frame.timings as Record<GroundGlassProfilingPass, number>;
    PASS_NAMES.forEach((pass) => {
      if (frame.expected.includes(pass)) this.windows[pass].push(timings[pass]);
    });
    const groundGlassMs = timings.sceneRender + timings.composite +
      (frame.rawDebug
        ? 0
        : timings.cocFootprint + timings.farGather + timings.nearGather);
    this.groundGlassWindow.push(groundGlassMs);
    if (!frame.rawDebug) {
      this.physicalDofWindow.push(
        timings.cocFootprint + timings.farGather + timings.nearGather + timings.composite,
      );
    }
    if (this.backend === "gpu-query" && !frame.completed) {
      this.framesCompletedGpu += 1;
      frame.completed = true;
    }
    this.pendingFrames.delete(frame.id);
  }

  private trimPendingFrames(): void {
    while (this.pendingFrames.size > GROUND_GLASS_PROFILING_QUERY_POOL_SIZE * 2) {
      const oldest = this.pendingFrames.keys().next().value;
      if (oldest === undefined) break;
      this.pendingFrames.delete(oldest);
      this.framesInvalidated += 1;
    }
  }

  private invalidateFrame(frame: FrameRecord, reason: string): void {
    if (!frame.valid) return;
    frame.valid = false;
    this.framesInvalidated += 1;
    this.lastRejectedReason = reason;
  }

  private rememberDiscardedFrame(frameId: number): void {
    if (this.discardedFrameIds.size >= GROUND_GLASS_PROFILING_QUERY_POOL_SIZE * 2) {
      const oldest = this.discardedFrameIds.values().next().value;
      if (oldest !== undefined) this.discardedFrameIds.delete(oldest);
    }
    this.discardedFrameIds.add(frameId);
  }

  private invalidateGpuFrames(frameIds: readonly number[], reason: string): void {
    for (const frameId of frameIds) {
      const frame = this.currentFrame?.id === frameId
        ? this.currentFrame
        : this.pendingFrames.get(frameId);
      if (frame) {
        this.invalidateFrame(frame, reason);
        if (this.pendingFrames.get(frameId) === frame) this.pendingFrames.delete(frameId);
      }
      this.rememberDiscardedFrame(frameId);
    }
    this.lastRejectedReason = reason;
  }

  private invalidatePendingGpuFrames(reason: string): void {
    for (const frame of this.pendingFrames.values()) {
      this.invalidateFrame(frame, reason);
      this.rememberDiscardedFrame(frame.id);
    }
    this.pendingFrames.clear();
    this.lastRejectedReason = reason;
  }

  private maybePublish(): void {
    if (!this.enabled || !this.lastConfig || !this.onSnapshot) return;
    const now = readGroundGlassProfilingClockMs();
    if (now - this.lastPublishedAt < this.publishIntervalMs) return;
    this.lastPublishedAt = now;
    this.lastSnapshot = this.snapshot(this.lastConfig);
    this.onSnapshot(this.lastSnapshot);
  }
}
