export const M7N_RENDERER_LIFECYCLE_TRACE_CAPACITY = 512;
export const M7N_RENDERER_LIFECYCLE_TRACE_SCHEMA_VERSION = 1;

export type RendererLifecycleTraceSurface =
  | "route"
  | "simulator"
  | "scene"
  | "observer"
  | "ground-glass";

export type RendererLifecycleTraceValue = string | number | boolean | null;

export type RendererLifecycleTraceInput = Readonly<{
  surface: RendererLifecycleTraceSurface;
  event: string;
  routeId?: string | null;
  sceneId?: string | null;
  mountGeneration?: string | number | null;
  rendererGeneration?: string | number | null;
  status?: string | null;
  detail?: Readonly<Record<string, RendererLifecycleTraceValue>>;
}>;

export type RendererLifecycleTraceEvent = Readonly<{
  pageId: string;
  sequence: number;
  timestampMs: number;
  timeOriginMs: number;
  surface: RendererLifecycleTraceSurface;
  event: string;
  routeId: string | null;
  sceneId: string | null;
  mountGeneration: string | number | null;
  rendererGeneration: string | number | null;
  status: string | null;
  detail?: Readonly<Record<string, RendererLifecycleTraceValue>>;
}>;

export type RendererLifecycleTraceSnapshot = Readonly<{
  schemaVersion: number;
  pageId: string;
  timeOriginMs: number;
  capacity: number;
  droppedEventCount: number;
  events: readonly RendererLifecycleTraceEvent[];
}>;

export type RendererLifecycleTraceCollector = Readonly<{
  record: (input: RendererLifecycleTraceInput) => RendererLifecycleTraceEvent;
  snapshot: () => RendererLifecycleTraceSnapshot;
}>;

export type RendererLifecycleTraceRuntime = Readonly<{
  record: (input: RendererLifecycleTraceInput) => RendererLifecycleTraceEvent | null;
  snapshot: () => RendererLifecycleTraceSnapshot | null;
  isInitialized: () => boolean;
}>;

type CollectorOptions = Readonly<{
  capacity?: number;
  now?: () => number;
  timeOriginMs?: number;
  pageId?: string;
}>;

const defaultPageId = () =>
  `m7n-${Math.random().toString(36).slice(2, 10)}`;

const sanitizeDetail = (
  detail: RendererLifecycleTraceInput["detail"],
): Readonly<Record<string, RendererLifecycleTraceValue>> | undefined => {
  if (!detail) return undefined;
  const sanitized: Record<string, RendererLifecycleTraceValue> = {};
  for (const [key, value] of Object.entries(detail)) {
    if (
      typeof value === "string" ||
      typeof value === "boolean" ||
      value === null ||
      (typeof value === "number" && Number.isFinite(value))
    ) {
      sanitized[key] = value;
    }
  }
  return Object.freeze(sanitized);
};

export const createRendererLifecycleTraceCollector = (
  options: CollectorOptions = {},
): RendererLifecycleTraceCollector => {
  const capacity = Math.max(1, Math.floor(options.capacity ?? M7N_RENDERER_LIFECYCLE_TRACE_CAPACITY));
  const now = options.now ?? (() => globalThis.performance.now());
  const timeOriginMs = options.timeOriginMs ?? globalThis.performance.timeOrigin;
  const pageId = options.pageId ?? defaultPageId();
  const events: RendererLifecycleTraceEvent[] = new Array(capacity);
  let nextIndex = 0;
  let storedCount = 0;
  let sequence = 0;
  let droppedEventCount = 0;
  let lastTimestampMs = 0;

  return Object.freeze({
    record(input: RendererLifecycleTraceInput) {
      const observedNow = now();
      const timestampMs = Math.max(lastTimestampMs, Number.isFinite(observedNow) ? observedNow : lastTimestampMs);
      lastTimestampMs = timestampMs;
      const event: RendererLifecycleTraceEvent = Object.freeze({
        pageId,
        sequence: ++sequence,
        timestampMs,
        timeOriginMs,
        surface: input.surface,
        event: input.event,
        routeId: input.routeId ?? null,
        sceneId: input.sceneId ?? null,
        mountGeneration: input.mountGeneration ?? null,
        rendererGeneration: input.rendererGeneration ?? null,
        status: input.status ?? null,
        ...(input.detail ? { detail: sanitizeDetail(input.detail) } : {}),
      });

      if (storedCount === capacity) {
        droppedEventCount += 1;
      } else {
        storedCount += 1;
      }
      events[nextIndex] = event;
      nextIndex = (nextIndex + 1) % capacity;
      return event;
    },
    snapshot() {
      const startIndex = storedCount === capacity ? nextIndex : 0;
      const orderedEvents = Array.from({ length: storedCount }, (_, index) =>
        events[(startIndex + index) % capacity],
      );
      return Object.freeze({
        schemaVersion: M7N_RENDERER_LIFECYCLE_TRACE_SCHEMA_VERSION,
        pageId,
        timeOriginMs,
        capacity,
        droppedEventCount,
        events: Object.freeze(orderedEvents),
      });
    },
  });
};

export const createRendererLifecycleTraceRuntime = (
  enabled: boolean,
  createCollector: () => RendererLifecycleTraceCollector,
): RendererLifecycleTraceRuntime => {
  let collector: RendererLifecycleTraceCollector | null = null;
  return Object.freeze({
    record(input: RendererLifecycleTraceInput) {
      if (!enabled) return null;
      collector ??= createCollector();
      return collector.record(input);
    },
    snapshot: () => collector?.snapshot() ?? null,
    isInitialized: () => collector !== null,
  });
};

export type M7nRendererLifecycleTraceApi = Readonly<{
  snapshot: () => RendererLifecycleTraceSnapshot | null;
}>;

declare global {
  interface Window {
    readonly __m7nRendererLifecycleTrace?: M7nRendererLifecycleTraceApi;
  }
}

export const shouldEnableRendererLifecycleTrace = (
  developmentBuild: boolean,
  explicitOptIn: string | undefined,
) => developmentBuild && explicitOptIn === "true";

export const rendererLifecycleTraceEnabled = shouldEnableRendererLifecycleTrace(
  import.meta.env.DEV,
  import.meta.env.VITE_M7N_RENDERER_LIFECYCLE_TRACE,
);

const pageTraceRuntime = createRendererLifecycleTraceRuntime(
  rendererLifecycleTraceEnabled,
  () => createRendererLifecycleTraceCollector(),
);
let traceApiInstalled = false;
let nextTraceMountIdentity = 0;

export const allocateRendererLifecycleMountIdentity = (
  owner: "observer-viewport" | "scene-renderer",
): string | null => {
  if (!rendererLifecycleTraceEnabled) return null;
  nextTraceMountIdentity += 1;
  return `m7n-${owner}-${nextTraceMountIdentity}`;
};

const installReadOnlyTraceApi = () => {
  if (traceApiInstalled || typeof window === "undefined") return;
  traceApiInstalled = true;
  try {
    if ("__m7nRendererLifecycleTrace" in window) return;
    Object.defineProperty(window, "__m7nRendererLifecycleTrace", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: Object.freeze({
        snapshot: pageTraceRuntime.snapshot,
      }),
    });
  } catch {
    // Diagnostics are best effort and must never interfere with rendering.
  }
};

export const recordRendererLifecycleEvent = (
  input: RendererLifecycleTraceInput,
): void => {
  if (!rendererLifecycleTraceEnabled) return;
  try {
    if (typeof window === "undefined" || typeof performance === "undefined") return;
    installReadOnlyTraceApi();
    pageTraceRuntime.record(input);
  } catch {
    // Instrumentation errors must not affect the simulator lifecycle.
  }
};
