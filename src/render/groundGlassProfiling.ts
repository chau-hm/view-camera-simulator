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

  public begin(frameId: number, pass: GroundGlassProfilingPass): GroundGlassGpuTimerToken | null {
    if (this.disposed ||
        !this.context.createQuery ||
        !this.context.beginQuery ||
        !this.context.endQuery) return null;

    let slot = this.slots.find((candidate) => candidate.active === null);
    if (!slot) {
      if (this.slots.length >= this.maxQueries) return null;
      const query = this.context.createQuery();
      if (query === null || query === undefined) return null;
      slot = { query, active: null };
      this.slots.push(slot);
    }

    try {
      this.context.beginQuery(this.extension.TIME_ELAPSED_EXT, slot.query);
      slot.active = { frameId, pass, ended: false };
      return { slot, ended: false };
    } catch {
      slot.active = null;
      return null;
    }
  }

  public end(token: GroundGlassGpuTimerToken | null): void {
    if (!token || token.ended || this.disposed || !this.context.endQuery) return;
    token.ended = true;
    if (!token.slot.active) return;
    token.slot.active.ended = true;
    try {
      this.context.endQuery(this.extension.TIME_ELAPSED_EXT);
    } catch {
      token.slot.active = null;
    }
  }

  public poll(): GroundGlassGpuTiming[] {
    const getQueryParameter = this.context.getQueryParameter;
    const getParameter = this.context.getParameter;
    if (this.disposed || !getQueryParameter || !getParameter) return [];

    let disjoint = false;
    try {
      disjoint = Boolean(getParameter(this.extension.GPU_DISJOINT_EXT));
    } catch {
      disjoint = true;
    }
    if (disjoint) {
      // The GPU clock was invalidated. Discard every pending result rather
      // than publishing a measurement from an unknown time base.
      this.slots.forEach((slot) => { slot.active = null; });
      return [];
    }

    const completed: GroundGlassGpuTiming[] = [];
    this.slots.forEach((slot) => {
      const active = slot.active;
      if (!active || !active.ended) return;

      let available = false;
      try {
        available = Boolean(
          getQueryParameter(slot.query, this.context.QUERY_RESULT_AVAILABLE),
        );
      } catch {
        slot.active = null;
        return;
      }
      if (!available) return;

      let nanoseconds: number;
      try {
        nanoseconds = Number(getQueryParameter(slot.query, this.context.QUERY_RESULT));
      } catch {
        slot.active = null;
        return;
      }
      slot.active = null;
      const durationMs = nanoseconds / 1e6;
      if (Number.isFinite(durationMs) && durationMs >= 0) {
        completed.push({ frameId: active.frameId, pass: active.pass, durationMs });
      }
    });
    return completed;
  }

  /** Discards pending results without waiting for GPU completion. */
  public reset(): void {
    this.slots.forEach((slot) => {
      try { this.context.deleteQuery?.(slot.query); } catch { /* best effort */ }
    });
    this.slots.length = 0;
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.reset();
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
  valid: boolean;
  finished: boolean;
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
  private readonly enabled: boolean;
  private readonly onSnapshot?: (snapshot: GroundGlassProfilingSnapshot) => void;
  private readonly publishIntervalMs: number;

  public readonly backend: GroundGlassProfilingBackend;

  public constructor(
    enabled: boolean,
    renderer: GroundGlassGpuTimerRenderer,
    onSnapshot?: (snapshot: GroundGlassProfilingSnapshot) => void,
    publishIntervalMs = GROUND_GLASS_PROFILING_PUBLISH_INTERVAL_MS,
  ) {
    this.enabled = enabled;
    this.onSnapshot = onSnapshot;
    this.publishIntervalMs = publishIntervalMs;
    if (!enabled) {
      this.backend = "disabled";
      this.gpuTimer = null;
      return;
    }
    this.gpuTimer = createGroundGlassGpuTimer(renderer);
    this.backend = this.gpuTimer ? "gpu-query" : "cpu-fallback";
  }

  public beginFrame(
    configuration: GroundGlassProfilingConfiguration,
    frameTimeMs?: number,
  ): void {
    if (!this.enabled) return;
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
      this.resetSession();
      this.measurementKey = key;
    }

    this.lastConfig = configuration;
    if (Number.isFinite(frameTimeMs) && (frameTimeMs ?? 0) >= 0) {
      this.frameWindow.push(frameTimeMs as number);
    }

    const expected = configuration.rawDebug
      ? (["sceneRender", "composite"] as const)
      : PASS_NAMES;
    this.currentFrame = {
      id: ++this.frameId,
      rawDebug: configuration.rawDebug,
      expected,
      timings: {},
      valid: this.backend !== "unavailable",
      finished: false,
    };
  }

  public beginPass(pass: GroundGlassProfilingPass): GroundGlassPassScope {
    const frame = this.currentFrame;
    if (!this.enabled || !frame || !frame.expected.includes(pass) || !frame.valid) {
      return NOOP_SCOPE;
    }

    if (this.backend === "gpu-query") {
      const token = this.gpuTimer?.begin(frame.id, pass) ?? null;
      if (!token) {
        frame.valid = false;
        return NOOP_SCOPE;
      }
      let ended = false;
      return {
        end: () => {
          if (ended) return;
          ended = true;
          this.gpuTimer?.end(token);
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
    if (!frame.valid || this.backend === "unavailable") {
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
    this.gpuTimer?.poll().forEach((timing) => {
      this.recordTiming(timing.frameId, timing.pass, timing.durationMs);
    });
  }

  /** Reset windows and discard pending GPU results after a resource/config change. */
  public resetSession(): void {
    this.gpuTimer?.reset();
    this.pendingFrames.clear();
    this.currentFrame = null;
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
    if (!frame || !frame.valid || !Number.isFinite(durationMs) || durationMs < 0) return;
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
    this.pendingFrames.delete(frame.id);
  }

  private trimPendingFrames(): void {
    while (this.pendingFrames.size > GROUND_GLASS_PROFILING_QUERY_POOL_SIZE * 2) {
      const oldest = this.pendingFrames.keys().next().value;
      if (oldest === undefined) break;
      this.pendingFrames.delete(oldest);
    }
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
