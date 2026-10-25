import type {
  GroundGlassAcceptedRequestIdentity,
  GroundGlassFrameResult,
  GroundGlassPilotRetryState,
  GroundGlassRendererGenerationIdentity,
} from "./groundGlassBackendContracts";
import type { GroundGlassBackendSelection } from "./groundGlassBackendPolicy";
import type { GroundGlassRenderOperationId } from "../groundGlassPassGraph";

export type GroundGlassMountedRuntimeEvidence =
  | Readonly<{ status: "unknown" }>
  | Readonly<{
      status: "mounted";
      generation: GroundGlassRendererGenerationIdentity;
      rendererFamily: "webgl-renderer";
      actualExecutionApi: "webgl" | "webgl2";
      internalFallback: "none";
    }>
  | Readonly<{
      status: "mounted";
      generation: GroundGlassRendererGenerationIdentity;
      rendererFamily: "webgpu-renderer";
      actualExecutionApi: "webgpu";
      internalFallback: "none";
    }>
  | Readonly<{
      status: "mounted";
      generation: GroundGlassRendererGenerationIdentity;
      rendererFamily: "webgpu-renderer";
      actualExecutionApi: "webgl2";
      internalFallback: "webgl2-compatibility";
    }>;

export type GroundGlassAttemptEvidence =
  | Readonly<{ status: "not-started" }>
  | Readonly<{ status: "started"; backend: "webgl" | "webgpu" }>
  | Readonly<{
      status: "failed";
      backend: "webgl" | "webgpu";
      stage: "initialization" | "runtime";
      failureReason: string;
    }>
  | Readonly<{ status: "mounted"; backend: "webgl" | "webgpu" }>;

export type GroundGlassApplicationFallbackEvidence =
  | Readonly<{ status: "not-observed" }>
  | Readonly<{
      status: "occurred";
      failedBackend: "webgpu";
      fallbackRendererFamily: "webgl-renderer";
      failureStage: "initialization" | "runtime";
      reason: string;
    }>;

export type GroundGlassWebGlDiagnosticDetails = Readonly<{
  backend: "webgl";
  contextApi: "webgl" | "webgl2";
  rendererRevision: string;
  enabledExtensions: readonly string[];
}>;

export type GroundGlassPhysicalCocPassStatus =
  | "disabled"
  | "ready"
  | "completed"
  | "unsupported"
  | "failed";

export type GroundGlassPhysicalCocProbeSummary = Readonly<{
  count: number;
  valid: number;
  noDepth: number;
  invalidGeometry: number;
  unrepresentable: number;
  unresolvedFocalBoundary: number;
  depthResolved: number;
  depthLimited: number;
  depthNotAssessed: number;
  near: number;
  neutral: number;
  far: number;
  maximumWorldPositionErrorMm: number | null;
  maximumKernelSignedCoCErrorMm: number | null;
  maximumKernelMajorRadiusErrorMm: number | null;
  maximumKernelMinorRadiusErrorMm: number | null;
  maximumKernelOrientationErrorRad: number | null;
  maximumStoredSignedCoCErrorMm: number | null;
  maximumStoredMajorRadiusErrorMm: number | null;
  maximumStoredMinorRadiusErrorMm: number | null;
  maximumStoredOrientationErrorRad: number | null;
  maximumEndToEndSignedCoCErrorMm: number | null;
  maximumEndToEndMajorRadiusErrorMm: number | null;
  maximumEndToEndMinorRadiusErrorMm: number | null;
  maximumEndToEndOrientationErrorRad: number | null;
}>;

export type GroundGlassPhysicalCocDiagnosticDetails = Readonly<{
  status: GroundGlassPhysicalCocPassStatus;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  depthFormat: string | null;
  depthReconstruction: "webgpu-zero-to-one-top-origin" | null;
  cocStorageFormat: string | null;
  validityStorageFormat: string | null;
  widthPx: number;
  heightPx: number;
  completedPasses: readonly ("sceneDepth" | "physicalCoc" | "validity")[];
  /** Full-resolution physical validity does not establish canonical depth confidence. */
  depthConfidenceStatus: "not-assessed";
  probeReadbackStatus: "not-requested" | "completed" | "failed";
  probeSummary: GroundGlassPhysicalCocProbeSummary | null;
  probeReadbackFailureReason: string | null;
  unsupportedReason: string | null;
  failureReason: string | null;
}>;

export type GroundGlassWebGpuDiagnosticDetails = Readonly<{
  backend: "webgpu";
  sceneId: string;
  requestId: string;
  rendererRevision: string;
  sceneSourceRevision: string;
  verificationEvidenceRevision: string;
  sceneSubject: Readonly<{
    realization: "registered-ground-glass-profile";
    mounted: true;
    childCount: number;
  }>;
  camera: Readonly<{
    coordinateSystem: "webgpu" | "webgl";
    left: number;
    right: number;
    top: number;
    bottom: number;
    near: number;
    far: number;
  }>;
  actualExecutionApi: "webgpu" | "webgl2";
  internalFallback: "none" | "webgl2-compatibility";
  adapterFeatures: readonly string[];
  deviceFeatures: readonly string[];
  textureStorageFormats: readonly string[];
  target: Readonly<{
    widthPx: number;
    heightPx: number;
    colorFormat: "rgba8unorm";
    depthAttachment: "enabled";
    depthFormat: string | null;
    textureColorSpace: "no-color-space";
    rendererOutputColorSpace: "srgb";
    toneMapping: "none";
  }>;
  completedPasses: readonly ("sceneRender" | "textureDisplay")[];
  physicalCoc?: GroundGlassPhysicalCocDiagnosticDetails;
}>;

export type GroundGlassBackendDiagnosticDetails =
  | GroundGlassWebGlDiagnosticDetails
  | GroundGlassWebGpuDiagnosticDetails;

export type GroundGlassFrameDiagnostics = Readonly<{
  current: GroundGlassFrameResult | null;
  lastSuccessfullyCompleted: Readonly<{
    request: GroundGlassAcceptedRequestIdentity;
    generation: GroundGlassRendererGenerationIdentity;
    frameId: string;
  }> | null;
}>;

export type GroundGlassLifecycleStatus =
  | "idle"
  | "initializing"
  | "ready"
  | "rendering"
  | "failed"
  | "retiring"
  | "disposed"
  | "unavailable";

export type GroundGlassCleanupEvidence =
  | Readonly<{ status: "not-required" }>
  | Readonly<{
      status: "pending";
      generation: GroundGlassRendererGenerationIdentity;
    }>
  | Readonly<{
      status: "confirmed";
      generation: GroundGlassRendererGenerationIdentity;
    }>
  | Readonly<{
      status: "failed" | "uncertain";
      generation: GroundGlassRendererGenerationIdentity;
      reason: string;
    }>;

/**
 * Common M2-facing diagnostic envelope. Runtime identity is populated only from mounted renderer
 * evidence; policy selection and reported capability preflight remain separate fields.
 */
export type GroundGlassBackendDiagnostics = Readonly<{
  requestIdentity: GroundGlassAcceptedRequestIdentity;
  pilotSessionId: string | null;
  policySelection: GroundGlassBackendSelection;
  attemptedBackend: GroundGlassAttemptEvidence;
  mountedRuntime: GroundGlassMountedRuntimeEvidence;
  applicationFallback: GroundGlassApplicationFallbackEvidence;
  rendererGeneration: GroundGlassRendererGenerationIdentity | null;
  lifecycleStatus: GroundGlassLifecycleStatus;
  /** M2 teardown evidence; confirmed means owned disposal callbacks completed, not driver memory reclamation. */
  cleanup: GroundGlassCleanupEvidence;
  frame: GroundGlassFrameDiagnostics;
  retryState: GroundGlassPilotRetryState | null;
  backendDetails: GroundGlassBackendDiagnosticDetails | null;
  /** Latest adapter failure survives a safe fallback generation replacement. */
  lastFailure?: Readonly<{
    generation: GroundGlassRendererGenerationIdentity;
    request: GroundGlassAcceptedRequestIdentity;
    backend: "webgl" | "webgpu";
    stage: "initialization" | "runtime";
    failedPass: GroundGlassRenderOperationId | null;
    reason: string;
  }> | null;
}>;

export const isGroundGlassNativeWebGpuRuntime = (
  runtime: GroundGlassMountedRuntimeEvidence,
): boolean =>
  runtime.status === "mounted" &&
  runtime.rendererFamily === "webgpu-renderer" &&
  runtime.actualExecutionApi === "webgpu" &&
  runtime.internalFallback === "none";
