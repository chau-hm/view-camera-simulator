import type { GroundGlassFrameResult } from "../backend/groundGlassBackendContracts";
import type { GroundGlassPhysicalCocProbeUv } from "./groundGlassPhysicalCocNodes";
import type { GroundGlassDofRenderState } from "../groundGlassDofRenderState";
import type { GroundGlassPhysicalDepthConfidence } from "./groundGlassPhysicalCocContract";
import type { GroundGlassApertureGatherQualityMode } from "./groundGlassApertureGatherPolicy";

export type GroundGlassApertureGatherCaptureRequest = Readonly<{
  token: string;
  qualityMode: GroundGlassApertureGatherQualityMode;
  maximumRadiusPx?: number;
  /** Retain bounded typed-array readbacks only for the duration of an explicit test capture. */
  retainReadbackBuffers?: boolean;
}>;

export type GroundGlassGpuPassTiming = Readonly<{
  /** Synchronous JavaScript time inside renderer.render for this pass. */
  rendererCallCpuMs: number;
  /** Wall time awaiting GPU queue completion; not GPU execution time. */
  queueCompletionWaitMs: number;
  /** Total measured wall time around render submission and queue completion. */
  wallClockMs: number;
}>;

export type GroundGlassApertureGatherOperationName =
  | "sourceIdentity"
  | "gatherIdentity"
  | "gatherCenterProvenance"
  | "farGather"
  | "nearGather"
  | "selectedProvenance"
  | "b1Reconstruction"
  | "b1Decision"
  | "researchComposite"
  | "depthReadback";

export type GroundGlassApertureGatherTargetAllocation = Readonly<{
  name: GroundGlassApertureGatherOperationName;
  widthPx: number;
  heightPx: number;
  format: string;
  bytesPerPixel: number;
  estimatedBytes: number;
}>;

export type GroundGlassApertureGatherPerformanceEvidence = Readonly<{
  sceneRender: GroundGlassGpuPassTiming;
  physicalCocFootprint: GroundGlassGpuPassTiming | null;
  physicalValidity: GroundGlassGpuPassTiming | null;
  operations: readonly Readonly<{
    name: GroundGlassApertureGatherOperationName;
    timing: GroundGlassGpuPassTiming;
  }>[];
  readPixelsWaitWallMs: number;
  readbackConversionCpuMs: number;
  cpuReferenceWallClockMs: number;
  gpuTimestampQueries: "not-collected";
}>;

export type GroundGlassFramePerformanceEvidence = Readonly<{
  generationId: string;
  requestId: string;
  sourceWidthPx: number;
  sourceHeightPx: number;
  sceneRender: GroundGlassGpuPassTiming;
  physicalCocFootprint: GroundGlassGpuPassTiming | null;
  physicalValidity: GroundGlassGpuPassTiming | null;
}>;

export type GroundGlassApertureGatherCaptureReadback = Readonly<{
  token: string;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  readbackOrigin: "top" | "bottom" | "unresolved";
  qualityMode: GroundGlassApertureGatherQualityMode;
  sampleCount: number;
  maximumRadiusPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
  farGatherWidthPx: number;
  farGatherHeightPx: number;
  nearGatherWidthPx: number;
  nearGatherHeightPx: number;
  targetFormats: Readonly<{
    sourceColor: string | null;
    physical: string | null;
    validity: string | null;
    far: string | null;
    near: string | null;
    b1: string | null;
    composite: string | null;
    provenance: string | null;
    decisions: string | null;
  }>;
  completedPasses: readonly (
    | "sourceIdentity"
    | "gatherIdentity"
    | "gatherCenterProvenance"
    | "selectedProvenance"
    | "farGather"
    | "nearGather"
    | "farReconstructionB1"
    | "researchComposite"
  )[];
  cpuB1Conformance: Readonly<{
    status: "passed" | "failed";
    selectedCenterProvenanceMismatchCount: number;
    eligibilityMismatchCount: number;
    fallbackReasonMismatchCount: number;
    selectedPathMismatchCount: number;
    rgbRmse: number;
    rgbMaximumError: number;
    fallbackSourceMaximumError: number;
  }>;
  farGatherCpuReference: Readonly<{
    rgbRmse: number;
    rgbMaximumError: number;
    pixelsOverMaximumErrorTolerance: number;
  }>;
  performance: GroundGlassApertureGatherPerformanceEvidence;
  resourceInventory: Readonly<{
    m5OwnedRenderTargetCount: number;
    adapterOwnedFullscreenMaterialCount: number;
    adapterOwnedFullscreenSceneCount: number;
    adapterOwnedFullscreenGeometryCount: number;
    estimatedTargetAttachmentBytes: number;
    memoryScope: "m5-owned-target-attachments-only";
    targetAllocations: readonly GroundGlassApertureGatherTargetAllocation[];
  }>;
  sourceToGatherMappingConformance: Readonly<{
    status: "passed" | "failed";
    mismatchCount: number;
  }>;
  nominalGatherCenterMappingConformance: Readonly<{
    status: "exact" | "observed-offset";
    mismatchCount: number;
  }>;
  physicalDataFingerprint: string;
  nearCoveragePixelCount: number;
  nearRgbInvariantMaximumError: number;
  nearAlphaInvariantMaximumError: number;
  nearCoverageNontrivial: boolean;
  nearCoverageFractionalPixelCount: number;
  nearReferenceCoverageNontrivial: boolean;
  nearReferenceCoveragePixelCount: number;
  nearReferenceCoverageFractionalPixelCount: number;
  nearReferenceAlphaMaximumError: number;
  radius: Readonly<{
    maximumUncappedRadiusPx: number;
    cappedPixelCount: number;
    physicalValuesUnchanged: boolean;
  }>;
  /** Present only when `retainReadbackBuffers` was explicitly requested by a development test. */
  readbackBuffers: Readonly<{
    sourceRgba: Float32Array;
    physicalRgba: Float32Array;
    validity: Uint8Array;
    depth: Float32Array;
    farGatherRgba: Float32Array;
    nearRgba: Float32Array;
    b1FarRgba: Float32Array;
    researchCompositeRgba: Float32Array;
    observedSelectedGatherIds: Int32Array;
    observedSelectedCenterSourceIds: Int32Array;
    observedGatherCenterSourceIds: Int32Array;
    b1Decision: Uint8Array;
  }> | null;
}>;

export type GroundGlassPhysicalCocProbeKernelOverride = Readonly<{
  lens: Readonly<Pick<GroundGlassDofRenderState["lens"],
    "centerWorldM" | "planeNormal" | "planeBasisX" | "planeBasisY">>;
  film: Readonly<Pick<GroundGlassDofRenderState["film"],
    "planePointWorldM" | "planeNormal" | "planeBasisX" | "planeBasisY">>;
  optics: Readonly<Pick<GroundGlassDofRenderState["optics"], "focalLengthMm" | "apertureFNumber">>;
}>;

export type GroundGlassPhysicalCocControlledKernelCase = Readonly<{
  id: string;
  kernelOverride: GroundGlassPhysicalCocProbeKernelOverride;
  probe: GroundGlassPhysicalCocProbeUv;
}>;

export type GroundGlassPhysicalCocControlledKernelReadback = Readonly<{
  id: string;
  probeId: string;
  calculatedFootprintMm: readonly [number, number, number, number];
  orientationPrincipalAngleRad: number;
  orientationDefined: boolean;
  validityCode: number;
  focalBranchCode: number;
  storageFormat: string | null;
  storedHalfFloatBits: readonly [number, number, number, number] | null;
  readbackFootprintMm: readonly [number, number, number, number] | null;
  sampledFootprintMm: readonly [number, number, number, number] | null;
}>;

export type GroundGlassPhysicalCocProbeSample = Readonly<{
  id: string;
  u: number;
  v: number;
  depth: number;
  reconstructedWorldM: readonly [number, number, number];
  kernelObjectPositionM: readonly [number, number, number];
  controlledObjectPoint: boolean;
  expectedWorldM: readonly [number, number, number] | null;
  expectedSurfaceId: string | null;
  kernelFootprintMm: readonly [number, number, number, number];
  storedFootprintMm: readonly [number, number, number, number] | null;
  validityCode: number;
  focalBranchCode: number;
  depthConfidence: GroundGlassPhysicalDepthConfidence;
}>;

export type GroundGlassPhysicalCocProbeReadback = Readonly<{
  token: string;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  widthPx: number;
  heightPx: number;
  depthFormat: string | null;
  cocStorageFormat: string | null;
  validityStorageFormat: string | null;
  samples: readonly GroundGlassPhysicalCocProbeSample[];
  controlledKernelCases: readonly GroundGlassPhysicalCocControlledKernelReadback[];
}>;

export type GroundGlassPhysicalCocProbeRequest = Readonly<{
  token: string;
  probes: readonly GroundGlassPhysicalCocProbeUv[];
  controlledKernelCases?: readonly GroundGlassPhysicalCocControlledKernelCase[];
}>;

export type GroundGlassWebGpuTestFailurePoint =
  | "initialization-after-target"
  | "scene-render-after-submit"
  | "physical-coc-after-submit"
  | "physical-validity-after-submit"
  | "aperture-far-after-submit"
  | "aperture-near-after-submit"
  | "aperture-b1-after-submit"
  | "aperture-composite-after-submit"
  | "aperture-readback"
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
  | Readonly<{
      kind: "gather-research";
      generationId: string;
      requestId: string;
      status: "completed" | "unsupported" | "failed";
      qualityMode: GroundGlassApertureGatherQualityMode | null;
      failureReason: string | null;
    }>
  | Readonly<{
      kind: "frame-performance";
      evidence: GroundGlassFramePerformanceEvidence;
    }>
  | Readonly<{
      kind: "cleanup";
      generationId: string;
      outcome: "confirmed" | "failed" | "uncertain";
      wallClockMs: number;
    }>;

/** Internal browser control object. It is read only by a Vite development build explicitly
 * started with VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true; it is never read from URL or storage. */
export type GroundGlassWebGpuTestControl = {
  adapterAttemptGenerations?: string[];
  adapterEvents?: GroundGlassWebGpuTestEvent[];
  failurePoint?: GroundGlassWebGpuTestFailurePoint;
  /** Ordered controlled faults allow a runtime fault followed by a disposal fault. */
  failurePoints?: GroundGlassWebGpuTestFailurePoint[];
  /** Exercise Three.js's actual WebGL2 compatibility backend through the M3 adapter boundary. */
  forceWebGlCompatibilityBackend?: boolean;
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
  physicalCocProbeRequest?: GroundGlassPhysicalCocProbeRequest | null;
  physicalCocProbeReadback?: GroundGlassPhysicalCocProbeReadback | null;
  forcePhysicalCocUnsupported?: boolean;
  holdPhysicalCocProbeReadback?: boolean;
  physicalCocProbeReadbackBarrierReached?: boolean;
  releasePhysicalCocProbeReadback?: (() => void) | undefined;
  apertureGatherCaptureRequest?: GroundGlassApertureGatherCaptureRequest | null;
  apertureGatherCaptureReadback?: GroundGlassApertureGatherCaptureReadback | null;
  holdApertureGatherReadback?: boolean;
  apertureGatherReadbackBarrierReached?: boolean;
  releaseApertureGatherReadback?: (() => void) | undefined;
  /** Explicit test-only trigger for the adapter's current accepted request. */
  requestApertureGatherCapture?: (() => void) | undefined;
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

export const forceGroundGlassWebGlCompatibilityBackendForTest = (): boolean =>
  getControl()?.forceWebGlCompatibilityBackend === true;

export const forceGroundGlassPhysicalCocUnsupportedForTest = (): boolean =>
  getControl()?.forcePhysicalCocUnsupported === true;

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

export const consumeGroundGlassPhysicalCocProbeRequestForTest = ():
  GroundGlassPhysicalCocProbeRequest | null => {
  const control = getControl();
  const request = control?.physicalCocProbeRequest ?? null;
  if (control && request) control.physicalCocProbeRequest = null;
  return request;
};

export const publishGroundGlassPhysicalCocProbeReadbackForTest = (
  result: GroundGlassPhysicalCocProbeReadback,
): void => {
  const control = getControl();
  if (control) control.physicalCocProbeReadback = result;
};

export const consumeGroundGlassApertureGatherCaptureForTest = (): GroundGlassApertureGatherCaptureRequest | null => {
  const control = getControl();
  const request = control?.apertureGatherCaptureRequest ?? null;
  if (control && request) control.apertureGatherCaptureRequest = null;
  return request;
};

export const publishGroundGlassApertureGatherCaptureForTest = (
  readback: GroundGlassApertureGatherCaptureReadback,
): void => {
  const control = getControl();
  if (control) control.apertureGatherCaptureReadback = readback;
};

export const clearGroundGlassApertureGatherCaptureForTest = (): void => {
  const control = getControl();
  if (!control) return;
  control.apertureGatherCaptureReadback = null;
  control.apertureGatherCaptureRequest = null;
};

export const holdGroundGlassApertureGatherReadbackForTest = async (): Promise<void> => {
  const control = getControl();
  if (!control?.holdApertureGatherReadback) return;
  control.apertureGatherReadbackBarrierReached = true;
  await new Promise<void>((resolve) => {
    control.releaseApertureGatherReadback = () => {
      control.holdApertureGatherReadback = false;
      control.apertureGatherReadbackBarrierReached = false;
      control.releaseApertureGatherReadback = undefined;
      resolve();
    };
  });
};

export const registerGroundGlassApertureGatherCaptureTriggerForTest = (
  trigger: (() => void) | null,
): void => {
  const control = getControl();
  if (!control) return;
  control.requestApertureGatherCapture = trigger ?? undefined;
};

export const holdGroundGlassPhysicalCocProbeReadbackForTest = async (): Promise<void> => {
  const control = getControl();
  if (!control?.holdPhysicalCocProbeReadback) return;
  control.physicalCocProbeReadbackBarrierReached = true;
  await new Promise<void>((resolve) => {
    control.releasePhysicalCocProbeReadback = () => {
      control.holdPhysicalCocProbeReadback = false;
      control.physicalCocProbeReadbackBarrierReached = false;
      control.releasePhysicalCocProbeReadback = undefined;
      resolve();
    };
  });
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
