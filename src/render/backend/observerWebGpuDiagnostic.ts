export type ObserverWebGpuAdapterAvailability =
  | "not-requested"
  | "pending"
  | "api-absent"
  | "available"
  | "unavailable"
  | "request-rejected"
  | "timed-out";

type WebGpuAdapterRequester = Readonly<{
  requestAdapter: () => PromiseLike<unknown | null>;
}>;

const ADAPTER_PROBE_TIMEOUT_MS = 5_000;

/**
 * Performs a bounded API-only probe. The adapter is reduced to a serializable
 * status immediately; this diagnostic never requests a device or retains a GPU
 * object.
 */
export const probeObserverWebGpuAdapterAvailability = async (
  api: WebGpuAdapterRequester | null | undefined,
  timeoutMs = ADAPTER_PROBE_TIMEOUT_MS,
): Promise<ObserverWebGpuAdapterAvailability> => {
  if (!api || typeof api.requestAdapter !== "function") return "api-absent";

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve(api.requestAdapter()).then(
        (adapter) => adapter == null ? "unavailable" as const : "available" as const,
        () => "request-rejected" as const,
      ),
      new Promise<"timed-out">((resolve) => {
        timeoutHandle = setTimeout(() => resolve("timed-out"), timeoutMs);
      }),
    ]);
    return result;
  } catch {
    return "request-rejected";
  } finally {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
  }
};

let cachedAdapterProbe: Promise<ObserverWebGpuAdapterAvailability> | null = null;

/** Requests adapter availability at most once per page, only when the pilot asks. */
export const getObserverWebGpuAdapterAvailability =
  (): Promise<ObserverWebGpuAdapterAvailability> => {
    if (cachedAdapterProbe) return cachedAdapterProbe;

    const api = typeof navigator === "undefined"
      ? undefined
      : (navigator as Navigator & { gpu?: WebGpuAdapterRequester }).gpu;
    cachedAdapterProbe = probeObserverWebGpuAdapterAvailability(api);
    return cachedAdapterProbe;
  };
