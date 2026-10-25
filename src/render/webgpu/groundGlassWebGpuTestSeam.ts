import type { GroundGlassFrameResult } from "../backend/groundGlassBackendContracts";

export type GroundGlassWebGpuTestFailurePoint =
  | "initialization-after-target"
  | "scene-render-after-submit"
  | "texture-display-after-submit"
  | "dispose-target";

export type GroundGlassWebGpuTestEvent =
  | Readonly<{ kind: "attempt"; generationId: string }>
  | Readonly<{
      kind: "failure";
      generationId: string;
      stage: "initialization" | "runtime";
      operation: string;
      reason: string;
    }>
  | Readonly<{
      kind: "runtime-observed";
      generationId: string;
      rendererFamily: "webgpu-renderer" | "webgl-renderer";
      executionApi: "webgpu" | "webgl2" | "webgl";
    }>
  | Readonly<{ kind: "frame-completed"; generationId: string; requestId: string }>
  | Readonly<{ kind: "cleanup"; generationId: string; outcome: "confirmed" | "failed" | "uncertain" }>;

/** Internal browser control object. It is read only by a Vite development build explicitly
 * started with VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true; it is never read from URL or storage. */
export type GroundGlassWebGpuTestControl = {
  adapterAttemptGenerations?: string[];
  adapterEvents?: GroundGlassWebGpuTestEvent[];
  failurePoint?: GroundGlassWebGpuTestFailurePoint;
  /** Ordered controlled faults allow a runtime fault followed by a disposal fault. */
  failurePoints?: GroundGlassWebGpuTestFailurePoint[];
  holdAdapterOperationAfterFailure?: boolean;
  adapterOperationBarrierReached?: boolean;
  releaseAdapterOperation?: (() => void) | undefined;
  holdQueueCompletion?: boolean;
  queueCompletionBarrierReached?: boolean;
  releaseQueueCompletion?: (() => void) | undefined;
  holdFrameRequestId?: string | null;
  holdNextCompletedFrame?: boolean;
  heldFrameRequestId?: string | null;
  releaseHeldFrame?: (() => void) | undefined;
};

declare global {
  interface Window {
    __groundGlassWebGpuM3TestControl?: GroundGlassWebGpuTestControl;
  }
}

const isEnabled = import.meta.env.DEV &&
  import.meta.env.VITE_GROUND_GLASS_WEBGPU_TEST_SEAM === "true";

const getControl = (): GroundGlassWebGpuTestControl | null =>
  isEnabled && typeof window !== "undefined"
    ? window.__groundGlassWebGpuM3TestControl ?? null
    : null;

export const recordGroundGlassWebGpuAdapterAttemptForTest = (generationId: string): void => {
  const control = getControl();
  if (!control) return;
  control.adapterAttemptGenerations ??= [];
  control.adapterAttemptGenerations.push(generationId);
  control.adapterEvents ??= [];
  control.adapterEvents.push({ kind: "attempt", generationId });
};

export const recordGroundGlassWebGpuTestEvent = (event: GroundGlassWebGpuTestEvent): void => {
  const control = getControl();
  if (!control) return;
  control.adapterEvents ??= [];
  control.adapterEvents.push(event);
};

export const throwIfGroundGlassWebGpuFailureInjected = (
  point: GroundGlassWebGpuTestFailurePoint,
): void => {
  const control = getControl();
  if (!control) return;
  const index = control.failurePoints?.indexOf(point) ?? -1;
  if (control.failurePoint !== point && index < 0) return;
  if (control.failurePoint === point) control.failurePoint = undefined;
  if (index >= 0) control.failurePoints?.splice(index, 1);
  throw new Error(`Injected test-only Ground Glass WebGPU failure at ${point}`);
};

export const holdGroundGlassWebGpuQueueCompletion = async (): Promise<void> => {
  const control = getControl();
  if (!control?.holdQueueCompletion) return;
  control.queueCompletionBarrierReached = true;
  await new Promise<void>((resolve) => {
    control.releaseQueueCompletion = () => {
      control.holdQueueCompletion = false;
      control.queueCompletionBarrierReached = false;
      control.releaseQueueCompletion = undefined;
      resolve();
    };
  });
};

export const holdGroundGlassWebGpuOperationAfterFailure = async (): Promise<void> => {
  const control = getControl();
  if (!control?.holdAdapterOperationAfterFailure) return;
  control.adapterOperationBarrierReached = true;
  await new Promise<void>((resolve) => {
    control.releaseAdapterOperation = () => {
      control.holdAdapterOperationAfterFailure = false;
      control.adapterOperationBarrierReached = false;
      control.releaseAdapterOperation = undefined;
      resolve();
    };
  });
};

/** Test-only frame-delivery gate for delivering an older real adapter result after a newer request. */
export const holdGroundGlassFrameResultForTest = (
  result: GroundGlassFrameResult,
  deliver: () => void,
): boolean => {
  const control = getControl();
  if (
    !control ||
    result.status !== "completed" ||
    (control.holdFrameRequestId !== result.request.requestId && !control.holdNextCompletedFrame)
  ) return false;
  control.holdNextCompletedFrame = false;
  control.heldFrameRequestId = result.request.requestId;
  control.releaseHeldFrame = () => {
    control.holdFrameRequestId = null;
    control.holdNextCompletedFrame = false;
    control.heldFrameRequestId = null;
    control.releaseHeldFrame = undefined;
    deliver();
  };
  return true;
};
