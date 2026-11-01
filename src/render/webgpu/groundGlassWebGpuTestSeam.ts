import type { GroundGlassFrameResult } from "../backend/groundGlassBackendContracts";
import type {
  GroundGlassPilotRecoveryAction,
  GroundGlassPilotRecoveryActionEvidence,
} from "../backend/groundGlassBackendDiagnostics";
import { isGroundGlassPilotRecoveryAction } from "../backend/groundGlassBackendDiagnostics";
import type { GroundGlassFrameRequest } from "../groundGlassFrameRequest";
import type { GroundGlassRttChannel } from "../groundGlassRttDimensions";
import type { GroundGlassPresentationNodeState } from "./groundGlassPresentationNodes";
import type { GroundGlassPhysicalCocProbeUv } from "./groundGlassPhysicalCocNodes";
import type { GroundGlassDofRenderState } from "../groundGlassDofRenderState";
import type { GroundGlassPhysicalDepthConfidence } from "./groundGlassPhysicalCocContract";
import type { GroundGlassApertureGatherQualityMode } from "./groundGlassApertureGatherPolicy";
import type {
  GroundGlassM6cAlphaSampleInput,
  GroundGlassM6cReadbackIdentity,
} from "../groundGlassM6cAlphaConformance";
import { isGroundGlassM6cBuildAuthorized } from "../groundGlassM6cAlphaConformance";
import { isGroundGlassM6bFixtureSceneEnabled } from "./groundGlassM6PresentationPolicy";

export type GroundGlassM6bPresentationEffectOverrides = Readonly<{
  throughputGain?: number;
  coverage?: Readonly<Partial<Pick<GroundGlassPresentationNodeState["coverage"], "active" | "geometry" | "edgeFeatherMm">>>;
  naturalIllumination?: Readonly<Partial<Pick<GroundGlassPresentationNodeState["naturalIllumination"], "enabled" | "geometry">>>;
}>;

export type GroundGlassM6bPresentationFixtureEvidence = Readonly<{
  fixtureRevision: "m6b-physical-overlay-v1";
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  previewMode: "raw" | "upright";
  sourceSampling: "nearest";
  sourceColorDomain: "linear-no-color-space";
  sourceWidthPx: number;
  sourceHeightPx: number;
  sourceDataFingerprint: string;
  presentationStateFingerprint: string;
  presentationMaterialUuid: string;
  outputWidthPx: number;
  outputHeightPx: number;
  sourceCrop: GroundGlassFrameRequest["inspectionWindow"];
  presentationState: GroundGlassPresentationNodeState;
}>;

export type GroundGlassM6bCalibrationFixtureControl = {
  enabled: true;
  presentationState?: "neutral" | "request";
  effectOverrides?: GroundGlassM6bPresentationEffectOverrides;
  presentationEvidence?: GroundGlassM6bPresentationFixtureEvidence | null;
  resourceDisposed?: boolean;
};

export type GroundGlassM6cAlphaCaptureRequest = Readonly<{ token: string }>;

export type GroundGlassM6cAlphaCaptureReadback = Readonly<{
  token: string;
  captureId: string;
  status: "measured" | "unsupported" | "failed" | "stale";
  failureReason: string | null;
  evidenceScope: "controlled-native-presentation-fixture";
  rendererRevision: string;
  rendererFamily: "webgpu-renderer" | "webgl-renderer" | "unknown";
  actualExecutionApi: "webgpu" | "webgl2" | "webgl" | "unknown";
  internalFallback: "none" | "webgl2-compatibility" | "unknown";
  applicationFallback: boolean | null;
  identity: GroundGlassM6cReadbackIdentity | null;
  source: Readonly<{
    format: "rgba32float";
    colorSpace: "no-color-space";
    sampling: "nearest";
    widthPx: number;
    heightPx: number;
    sourceDataFingerprint: string;
  }> | null;
  target: Readonly<{
    format: "rgba8unorm";
    colorSpace: "no-color-space";
    channelOrder: "rgba";
    widthPx: number;
    heightPx: number;
    estimatedBytes: number;
    readbackBytes: number;
    clearRgba: readonly [0, 0, 0, 0];
  }> | null;
  rendererOutputColorSpace: string | null;
  rendererToneMapping: number | null;
  material: Readonly<{
    uuid: string;
    transparent: boolean;
    opacity: number;
    blending: "none" | "normal" | "other";
    depthWrite: boolean;
    depthTest: boolean;
    colorWrite: boolean;
    alphaTest: number;
    premultipliedAlpha: boolean;
    toneMapped: boolean;
    samePresentationMaterialInstance: true;
  }> | null;
  samples: readonly GroundGlassM6cAlphaSampleInput[];
  resourceAccounting: Readonly<{
    allocationOperation: "explicit-m6c-test-capture" | null;
    disposalOperation: "capture-finally" | null;
    targetAllocated: boolean;
    targetDisposed: boolean;
    disposalOutcome: "confirmed" | "failed" | "not-allocated";
    previousRenderTargetRestored: boolean;
    allocationCount: number;
    disposalCount: number;
  }>;
}>;

export type GroundGlassM6cAlphaFixtureControl = {
  enabled: true;
  holdReadback?: boolean;
  readbackBarrierReached?: boolean;
  releaseReadback?: (() => void) | undefined;
  targetAllocationCount?: number;
  targetDisposalCount?: number;
  resourceDisposed?: boolean;
};

export type GroundGlassApertureGatherCaptureRequest = Readonly<{
  token: string;
  qualityMode: GroundGlassApertureGatherQualityMode;
  maximumRadiusPx?: number;
  /** Retain bounded typed-array readbacks only for the duration of an explicit test capture. */
  retainReadbackBuffers?: boolean;
  /** Run temporary M5R-only precision and Near-intermediate renders for this capture. */
  includeM5rDiagnostics?: boolean;
  /** Exercise the actual M5 Near TSL node with bounded synthetic native inputs. */
  includeM5rNearFixture?: boolean;
  /** Exercise the actual M5 composite TSL node on known Near coverage values. */
  includeM6dCompositeContractProbe?: boolean;
}>;

export type GroundGlassM6dCompositeContractProbeCase = Readonly<{
  id: string;
  coverage: number;
  farRgba: readonly [number, number, number, number];
  nearRgba: readonly [number, number, number, number];
  measuredCompositeRgba: readonly [number, number, number, number];
}>;

/** Test-only readback from the real M5 research-composite TSL node. */
export type GroundGlassM6dCompositeContractProbeReadback = Readonly<{
  token: string;
  contractRevision: "m6d-opaque-presentation-v1";
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererRevision: string;
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  applicationFallback: false;
  sourceTextureIdentity: Readonly<{ farUuid: string; nearUuid: string }>;
  sourceTextureFormat: string | null;
  nearTextureFormat: string | null;
  targetIdentity: Readonly<{ uuid: string; widthPx: number; heightPx: number }>;
  targetFormat: string | null;
  targetColorSpace: "no-color-space";
  targetAllocationObserved: boolean;
  rendererStateRestored: boolean;
  temporaryResourcesDisposed: boolean;
  cases: readonly GroundGlassM6dCompositeContractProbeCase[];
}>;

/** A bounded test-only request to exercise the mounted adapter's real B1 TSL node. */
export type GroundGlassB1BoundaryProbeRequest = Readonly<{
  token: string;
}>;

export type GroundGlassB1BoundaryProbeCaseReadback = Readonly<{
  id: string;
  inputSignedCocMm: number;
  inputValidityCode: number;
  inputSourceRgba: readonly [number, number, number, number];
  inputFarRgba: readonly [number, number, number, number];
  storedPhysicalHalfBits: readonly [number, number, number, number];
  storedPhysicalRgba: readonly [number, number, number, number];
  storedGatherHalfBits: readonly [number, number, number, number];
  storedGatherRgba: readonly [number, number, number, number];
  gpuDecisionRgba8: readonly [number, number, number, number];
  gpuB1HalfBits: readonly [number, number, number, number];
  gpuB1Rgba: readonly [number, number, number, number];
  cpuEligible: number;
  cpuFallbackReason: number;
  cpuSelectedPath: number;
  cpuB1Rgba: readonly [number, number, number, number];
  gpuCpuMaximumError: number;
}>;

export type GroundGlassB1BoundaryProbeReadback = Readonly<{
  token: string;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  rendererRevision: string;
  targetFormats: Readonly<{
    sourceColor: string | null;
    physical: string | null;
    validity: string | null;
    farGather: string | null;
    provenance: string | null;
    b1: string | null;
    decision: string | null;
  }>;
  cases: readonly GroundGlassB1BoundaryProbeCaseReadback[];
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
  captureId: string;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  rendererRevision: string;
  readbackOrigin: "top" | "bottom" | "unresolved";
  sceneSourceRevision: string;
  effectiveOpticalRequestFingerprint: string;
  cameraStateFingerprint: string;
  /** Exact inverse projection values used by M5 and its independent CPU reference. */
  inverseProjectionMatrix: readonly number[];
  sampledFilmDimensionsMm: Readonly<{ widthMm: number; heightMm: number }>;
  colorDomain: "source-target-readback-values";
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
  m4Input: Readonly<{
    status: "completed";
    requestId: string;
    rendererGenerationId: string;
    sceneId: string;
    sceneSourceRevision: string;
    targetFormats: Readonly<{
      depth: string | null;
      physical: string | null;
      validity: string | null;
    }>;
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
  inputFingerprints: Readonly<{
    sourceColor: string;
    depth: string;
    physical: string;
    validity: string;
  }>;
  m5rDiagnostics: Readonly<{
    status: "captured" | "not-requested";
    diagnosticTargetFormat: "rgba32float" | null;
    diagnosticTargetCount: number;
    nearFinalAlphaMaximumError: number | null;
  }>;
  m5rNearFixture: GroundGlassM5rNearFixtureReadback | null;
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
    farCpuReferenceRgba: Float32Array;
    nearBeforeB1Rgba: Float32Array;
    nearAfterB1Rgba: Float32Array;
    nearCpuReferenceRgba: Float32Array;
    nearCpuCenterIsNear: Uint8Array;
    nearCpuEvaluatedProposalCount: Uint16Array;
    nearCpuAcceptedProposalCount: Uint16Array;
    nearCpuNonzeroMembershipCount: Uint16Array;
    nearCpuWeightSum: Float32Array;
    nearCpuCoverageMass: Float32Array;
    nearCpuEstimatedCoverage: Float32Array;
    nearCpuAcceptedAreaRatioMean: Float32Array;
    nearCpuAcceptedCompensationMaximum: Float32Array;
    b1FarRgba: Float32Array;
    researchCompositeRgba: Float32Array;
    observedSelectedGatherIds: Int32Array;
    observedSelectedCenterSourceIds: Int32Array;
    observedGatherCenterSourceIds: Int32Array;
    observedGatherCenterSourceUvs: Float32Array;
    b1Decision: Uint8Array;
    /** Present only for explicit M5R diagnostic captures. */
    farGatherRgba32?: Float32Array;
    nearProposalCountsRgba?: Float32Array;
    nearCoverageDiagnosticsRgba?: Float32Array;
    nearAcceptedFootprintRgba?: Float32Array;
    /** Raw channel-order binary16 bits from the native RGBA16F Near target. */
    nearAlphaHalfBits?: Uint16Array;
    /** Raw channel-order binary16 bits from the native RGBA16F Far target. */
    farGatherHalfBits?: Uint16Array;
    /** Controlled fixture arrays are present only when includeM5rNearFixture was requested. */
    m5rFixtureNearRgba?: Float32Array;
    m5rFixtureProposalCountsRgba?: Float32Array;
    m5rFixtureCoverageRgba?: Float32Array;
    m5rFixtureAcceptedFootprintRgba?: Float32Array;
    m5rFixtureNearAlphaHalfBits?: Uint16Array;
  }> | null;
  m6dCompositeContractProbe?: GroundGlassM6dCompositeContractProbeReadback | null;
}>;

export type GroundGlassApertureGatherCapturePublication = Readonly<{
  token: string;
  captureId: string;
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
}>;

/** Synthetic-input evidence is always labeled separately from registered app captures. */
export type GroundGlassM5rNearFixtureReadback = Readonly<{
  evidenceScope: "native-research-fixture";
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  rendererGenerationId: string;
  requestId: string;
  sceneId: string;
  widthPx: number;
  heightPx: number;
  centerPixel: Readonly<{ x: number; y: number }>;
  foregroundShape: Readonly<{
    kind: "disc";
    centerPixel: Readonly<{ x: number; y: number }>;
    radiusPx: number;
    signedCocNearMm: number;
    signedCocBackgroundMm: number;
    depthNear: number;
    depthBackground: number;
    maximumRadiusPx: number;
  }>;
  targetFormat: "rgba16float";
  diagnosticTargetFormat: "rgba32float";
  finalAlphaMatchesNearTargetMaximumError: number;
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
  | "queue-completion"
  | "physical-coc-after-submit"
  | "physical-validity-after-submit"
  | "aperture-far-after-submit"
  | "aperture-near-after-submit"
  | "aperture-provenance-after-submit"
  | "aperture-b1-after-submit"
  | "aperture-decision-after-submit"
  | "aperture-composite-after-submit"
  | "aperture-target-initialization"
  | "m6-presentation-target-initialization"
  | "m6-optical-resource-initialization"
  | "m6-presentation-node-initialization"
  | "m6-presentation-before-render"
  | "m6-presentation-after-submit"
  | "aperture-readback"
  | "texture-display-after-submit"
  | "dispose-target";

export type GroundGlassWebGpuTestEvent =
  | Readonly<{ kind: "host-attached"; channelId: string; hostId: string }>
  | Readonly<{
      kind: "attempt";
      attemptId: string;
      channelId: string;
      generationId: string;
      requestId: string;
      sceneId: string;
      rendererRevision: string;
    }>
  | Readonly<{
      kind: "failure";
      attemptId: string;
      channelId: string;
      generationId: string;
      requestId: string;
      sceneId: string;
      stage: "initialization" | "runtime";
      operation: string;
      reason: string;
    }>
  | Readonly<{
      kind: "runtime-observed";
      attemptId: string;
      generationId: string;
      rendererRevision: string;
      rendererFamily: "webgpu-renderer" | "webgl-renderer";
      executionApi: "webgpu" | "webgl2" | "webgl";
      internalFallback: "none" | "webgl2-compatibility";
    }>
  | Readonly<{
      kind: "renderer-mounted";
      attemptId: string;
      channelId: string;
      hostId: string;
      generationId: string;
      requestId: string;
      sceneId: string;
      rendererFamily: "webgpu-renderer" | "webgl-renderer";
      executionApi: "webgpu" | "webgl2" | "webgl";
      internalFallback: "none" | "webgl2-compatibility";
    }>
  | Readonly<{
      kind: "host-frame-result";
      attemptId: string;
      channelId: string;
      hostId: string;
      generationId: string;
      requestId: string;
      sceneId: string;
      frameStatus: "completed";
      acceptedByHost: boolean;
      latestAcceptedRequestId: string | null;
      latestAcceptedSceneId: string | null;
      activeGenerationId: string | null;
      activeRendererFamily: "webgl-renderer" | "webgpu-renderer" | null;
    }>
  | Readonly<{
      kind: "failed-frame-result";
      attemptId: string;
      channelId: string;
      hostId: string;
      generationId: string;
      requestId: string;
      sceneId: string;
      failedStage: string | null;
      failureReason: string;
      acceptedByHost: boolean;
    }>
  | Readonly<{
      kind: "cleanup-acknowledged";
      channelId: string;
      hostId: string;
      generationId: string;
      outcome: "confirmed" | "failed" | "uncertain";
      reason: string | null;
    }>
  | Readonly<{
      kind: "device-destroy-requested";
      attemptId: string;
      generationId: string;
      cause: "test-destroy";
    }>
  | Readonly<{
      kind: "device-loss-equivalent-requested";
      attemptId: string;
      generationId: string;
      cause: "test-callback-equivalent";
    }>
  | Readonly<{
      kind: "device-lost-observed";
      attemptId: string;
      generationId: string;
      cause: "test-destroy" | "runtime-loss";
      reason: string;
      message: string;
    }>
  | Readonly<{ kind: "frame-completed"; attemptId: string; generationId: string; requestId: string }>
  | Readonly<{
      kind: "queue-completion-settled";
      attemptId: string;
      generationId: string;
      requestId: string;
      operation: "sceneRender";
    }>
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
      attemptId: string;
      generationId: string;
      outcome: "confirmed" | "failed" | "uncertain";
      wallClockMs: number;
    }>;

export type GroundGlassWebGpuTestEventWithSequence = GroundGlassWebGpuTestEvent & Readonly<{
  sequence?: number;
}>;

export type GroundGlassWebGpuAttemptIdentity = Readonly<{
  attemptId: string;
  channelId: string;
  generationId: string;
  requestId: string;
  sceneId: string;
}>;

export const createGroundGlassWebGpuAttemptIdentity = (
  channelId: string,
  generationId: string,
  requestId: string,
  sceneId: string,
): GroundGlassWebGpuAttemptIdentity => ({
  attemptId: JSON.stringify([channelId, generationId]),
  channelId,
  generationId,
  requestId,
  sceneId,
});

type GroundGlassPilotRecoveryActionRegistration = Readonly<{
  handler: (action: GroundGlassPilotRecoveryAction) => GroundGlassPilotRecoveryActionEvidence;
  rejectInvalidAction: (action: unknown) => GroundGlassPilotRecoveryActionEvidence;
  isEligible: () => boolean;
}>;

/** Internal browser control object. It is read only by a Vite development build explicitly
 * started with VITE_GROUND_GLASS_WEBGPU_TEST_SEAM=true; it is never read from URL or storage. */
export type GroundGlassWebGpuTestControl = {
  /** Set the application's first accepted Ground Glass request to Raw Debug in an isolated test. */
  initialRawDebug?: boolean;
  adapterAttemptGenerations?: string[];
  adapterEvents?: GroundGlassWebGpuTestEventWithSequence[];
  configuredFailurePoints?: GroundGlassWebGpuTestFailurePoint[];
  failurePoint?: GroundGlassWebGpuTestFailurePoint;
  /** Ordered controlled faults allow a runtime fault followed by a disposal fault. */
  failurePoints?: GroundGlassWebGpuTestFailurePoint[];
  /** Exercise Three.js's actual WebGL2 compatibility backend through the M3 adapter boundary. */
  forceWebGlCompatibilityBackend?: boolean;
  /** Test-only calibration source and Stage overlay; requires all trusted M6 build gates. */
  m6bCalibrationFixture?: GroundGlassM6bCalibrationFixtureControl;
  /** Controlled alpha source and readback are opt-in for the M6C native test only. */
  m6cAlphaFixture?: GroundGlassM6cAlphaFixtureControl;
  m6cAlphaCaptureRequest?: GroundGlassM6cAlphaCaptureRequest | null;
  m6cAlphaCaptureReadback?: GroundGlassM6cAlphaCaptureReadback | null;
  requestM6cAlphaCapture?: (() => void) | undefined;
  holdAdapterOperationAfterFailure?: boolean;
  adapterOperationBarrierReached?: boolean;
  releaseAdapterOperation?: (() => void) | undefined;
  holdQueueCompletion?: boolean;
  queueCompletionBarrierReached?: boolean;
  releaseQueueCompletion?: (() => void) | undefined;
  holdPresentationQueueCompletion?: boolean;
  presentationQueueCompletionBarrierReached?: boolean;
  releasePresentationQueueCompletion?: (() => void) | undefined;
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
  apertureGatherCapturePublications?: GroundGlassApertureGatherCapturePublication[];
  holdApertureGatherReadback?: boolean;
  apertureGatherReadbackBarrierReached?: boolean;
  releaseApertureGatherReadback?: (() => void) | undefined;
  groundGlassB1BoundaryProbeRequest?: GroundGlassB1BoundaryProbeRequest | null;
  groundGlassB1BoundaryProbeReadback?: GroundGlassB1BoundaryProbeReadback | null;
  /** Explicit test-only trigger for the adapter's current accepted request. */
  requestGroundGlassB1BoundaryProbe?: (() => void) | undefined;
  /** Explicit test-only trigger for the adapter's current accepted request. */
  requestApertureGatherCapture?: (() => void) | undefined;
  /** Explicit retry/new-session action, available only through the gated development seam. */
  pilotRecoveryActionHandlers?: Partial<Record<GroundGlassRttChannel, Record<string, GroundGlassPilotRecoveryActionRegistration>>>;
  requestGroundGlassPilotRecoveryAction?: (
    channelId: GroundGlassRttChannel,
    action: unknown,
  ) => GroundGlassPilotRecoveryActionEvidence | null;
  /** Routes a test-only device-loss equivalent through the adapter's real loss handler. */
  deviceLossTriggers?: Partial<Record<GroundGlassRttChannel, () => boolean>>;
  requestGroundGlassDeviceLoss?: (channelId: GroundGlassRttChannel) => boolean;
  /** Destroys only the adapter-owned test GPUDevice so its actual `lost` Promise can be observed. */
  deviceDestroyTriggers?: Partial<Record<GroundGlassRttChannel, () => boolean>>;
  requestGroundGlassDeviceDestroy?: (channelId: GroundGlassRttChannel) => boolean;
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

export const registerGroundGlassPilotRecoveryActionForTest = (
  channelId: GroundGlassRttChannel,
  registrationId: string,
  handler: ((action: GroundGlassPilotRecoveryAction) => GroundGlassPilotRecoveryActionEvidence) | null,
  isEligible: () => boolean,
  rejectInvalidAction: (action: unknown) => GroundGlassPilotRecoveryActionEvidence,
): (() => void) => {
  const control = getControl();
  if (!control) return () => undefined;
  const channelRegistrations = control.pilotRecoveryActionHandlers?.[channelId] ?? {};
  if (handler) channelRegistrations[registrationId] = { handler, rejectInvalidAction, isEligible };
  else delete channelRegistrations[registrationId];
  control.pilotRecoveryActionHandlers = {
    ...control.pilotRecoveryActionHandlers,
    [channelId]: channelRegistrations,
  };
  if (handler) {
    control.requestGroundGlassPilotRecoveryAction = (targetChannel, action) => {
      const registrations = Object.values(control.pilotRecoveryActionHandlers?.[targetChannel] ?? {});
      let activeRegistration: GroundGlassPilotRecoveryActionRegistration | null = null;
      for (const registration of registrations) {
        if (registration.isEligible()) activeRegistration = registration;
      }
      if (!activeRegistration) return null;
      return isGroundGlassPilotRecoveryAction(action)
        ? activeRegistration.handler(action)
        : activeRegistration.rejectInvalidAction(action);
    };
  }
  return () => {
    const currentRegistrations = control.pilotRecoveryActionHandlers?.[channelId];
    if (currentRegistrations?.[registrationId]?.handler !== handler) return;
    delete currentRegistrations[registrationId];
    if (Object.keys(currentRegistrations).length === 0) {
      const remainingChannels = { ...control.pilotRecoveryActionHandlers };
      delete remainingChannels[channelId];
      control.pilotRecoveryActionHandlers = Object.keys(remainingChannels).length > 0
        ? remainingChannels
        : undefined;
    }
    if (!control.pilotRecoveryActionHandlers) {
      control.requestGroundGlassPilotRecoveryAction = undefined;
    }
  };
};

export const registerGroundGlassDeviceLossTriggerForTest = (
  channelId: GroundGlassRttChannel,
  trigger: (() => boolean) | null,
): (() => void) => {
  const control = getControl();
  if (!control) return () => undefined;
  const triggers = control.deviceLossTriggers ?? {};
  if (trigger) triggers[channelId] = trigger;
  else delete triggers[channelId];
  control.deviceLossTriggers = triggers;
  if (trigger) {
    control.requestGroundGlassDeviceLoss = (targetChannel) =>
      control.deviceLossTriggers?.[targetChannel]?.() ?? false;
  }
  return () => {
    if (control.deviceLossTriggers?.[channelId] !== trigger) return;
    delete control.deviceLossTriggers[channelId];
    if (Object.keys(control.deviceLossTriggers).length === 0) {
      control.deviceLossTriggers = undefined;
      control.requestGroundGlassDeviceLoss = undefined;
    }
  };
};

export const registerGroundGlassDeviceDestroyTriggerForTest = (
  channelId: GroundGlassRttChannel,
  trigger: (() => boolean) | null,
): (() => void) => {
  const control = getControl();
  if (!control) return () => undefined;
  const triggers = control.deviceDestroyTriggers ?? {};
  if (trigger) triggers[channelId] = trigger;
  else delete triggers[channelId];
  control.deviceDestroyTriggers = triggers;
  if (trigger) {
    control.requestGroundGlassDeviceDestroy = (targetChannel) =>
      control.deviceDestroyTriggers?.[targetChannel]?.() ?? false;
  }
  return () => {
    if (control.deviceDestroyTriggers?.[channelId] !== trigger) return;
    delete control.deviceDestroyTriggers[channelId];
    if (Object.keys(control.deviceDestroyTriggers).length === 0) {
      control.deviceDestroyTriggers = undefined;
      control.requestGroundGlassDeviceDestroy = undefined;
    }
  };
};

export const initialGroundGlassRawDebugForTest = (): boolean =>
  getControl()?.initialRawDebug === true;

export const isGroundGlassM6bCalibrationFixtureEnabledForScene = (
  scene: Pick<GroundGlassFrameRequest["scene"], "id" | "bounds">,
): boolean => {
  const fixture = getControl()?.m6bCalibrationFixture;
  return fixture?.enabled === true && isGroundGlassM6bFixtureSceneEnabled(scene, true);
};

export const isGroundGlassM6bCalibrationFixtureEnabledForRequest = (
  request: GroundGlassFrameRequest,
): boolean => !request.rawDebug &&
  isGroundGlassM6bCalibrationFixtureEnabledForScene(request.scene);

export const isGroundGlassM6cAlphaFixtureEnabledForRequest = (
  request: GroundGlassFrameRequest,
): boolean => isGroundGlassM6cBuildAuthorized({
  developmentBuild: import.meta.env.DEV,
  rawPilotFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT === "true",
  m6PresentationFlag: import.meta.env.VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION === "true",
  testSeamFlag: isEnabled,
  explicitFixtureControl: getControl()?.m6cAlphaFixture?.enabled === true,
  exactRegisteredScene: !request.rawDebug && isGroundGlassM6bCalibrationFixtureEnabledForRequest(request),
});

export const resolveGroundGlassM6bPresentationStateForTest = (
  request: GroundGlassFrameRequest,
  state: GroundGlassPresentationNodeState,
): GroundGlassPresentationNodeState | null => {
  if (!isGroundGlassM6bCalibrationFixtureEnabledForRequest(request)) return null;
  const fixture = getControl()?.m6bCalibrationFixture;
  const neutralState = fixture?.presentationState === "neutral"
    ? {
        ...state,
        coverage: { ...state.coverage, active: false, geometry: null, edgeFeatherMm: 0 },
        naturalIllumination: { ...state.naturalIllumination, enabled: false, geometry: null },
        throughputGain: 1,
      }
    : state;
  const overrides = fixture?.effectOverrides;
  return {
    ...neutralState,
    previewMode: request.previewMode,
    ...(overrides?.throughputGain !== undefined ? { throughputGain: overrides.throughputGain } : {}),
    ...(overrides?.coverage ? {
      coverage: { ...neutralState.coverage, ...overrides.coverage },
    } : {}),
    ...(overrides?.naturalIllumination ? {
      naturalIllumination: { ...neutralState.naturalIllumination, ...overrides.naturalIllumination },
    } : {}),
  };
};

export const publishGroundGlassM6bPresentationEvidenceForTest = (
  evidence: GroundGlassM6bPresentationFixtureEvidence,
): void => {
  const fixture = getControl()?.m6bCalibrationFixture;
  if (!fixture?.enabled) return;
  fixture.presentationEvidence = evidence;
};

export const consumeGroundGlassM6cAlphaCaptureForTest = (): GroundGlassM6cAlphaCaptureRequest | null => {
  const control = getControl();
  const request = control?.m6cAlphaCaptureRequest ?? null;
  if (control && request) control.m6cAlphaCaptureRequest = null;
  return request;
};

export const publishGroundGlassM6cAlphaCaptureForTest = (
  readback: GroundGlassM6cAlphaCaptureReadback,
): void => {
  const control = getControl();
  if (control) control.m6cAlphaCaptureReadback = readback;
};

export const registerGroundGlassM6cAlphaCaptureTriggerForTest = (
  trigger: (() => void) | null,
): void => {
  const control = getControl();
  if (control) control.requestM6cAlphaCapture = trigger ?? undefined;
};

export const holdGroundGlassM6cAlphaReadbackForTest = async (): Promise<void> => {
  const fixture = getControl()?.m6cAlphaFixture;
  if (!fixture?.holdReadback) return;
  fixture.readbackBarrierReached = true;
  await new Promise<void>((resolve) => {
    fixture.releaseReadback = () => {
      fixture.holdReadback = false;
      fixture.readbackBarrierReached = false;
      fixture.releaseReadback = undefined;
      resolve();
    };
  });
};

export const recordGroundGlassM6cAlphaTargetAllocatedForTest = (): number => {
  const fixture = getControl()?.m6cAlphaFixture;
  if (!fixture) return 0;
  fixture.targetAllocationCount = (fixture.targetAllocationCount ?? 0) + 1;
  return fixture.targetAllocationCount;
};

export const recordGroundGlassM6cAlphaTargetDisposedForTest = (disposed: boolean): number => {
  const fixture = getControl()?.m6cAlphaFixture;
  if (!fixture) return 0;
  fixture.targetDisposalCount = (fixture.targetDisposalCount ?? 0) + 1;
  fixture.resourceDisposed = disposed;
  return fixture.targetDisposalCount;
};

export const recordGroundGlassM6bFixtureResourceDisposedForTest = (): void => {
  const fixture = getControl()?.m6bCalibrationFixture;
  if (fixture?.enabled) fixture.resourceDisposed = true;
};

export const forceGroundGlassWebGlCompatibilityBackendForTest = (): boolean =>
  getControl()?.forceWebGlCompatibilityBackend === true;

export const forceGroundGlassPhysicalCocUnsupportedForTest = (): boolean =>
  getControl()?.forcePhysicalCocUnsupported === true;

export const recordGroundGlassWebGpuAdapterAttemptForTest = (
  identity: GroundGlassWebGpuAttemptIdentity,
  rendererRevision: string,
): void => {
  const control = getControl();
  if (!control) return;
  control.adapterAttemptGenerations ??= [];
  control.adapterAttemptGenerations.push(identity.generationId);
  recordGroundGlassWebGpuTestEvent({
    kind: "attempt",
    ...identity,
    rendererRevision,
  });
};

export const recordGroundGlassWebGpuTestEvent = (event: GroundGlassWebGpuTestEvent): void => {
  const control = getControl();
  if (!control) return;
  control.adapterEvents ??= [];
  control.adapterEvents.push({ ...event, sequence: control.adapterEvents.length });
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
  if (!control) return;
  control.apertureGatherCapturePublications ??= [];
  control.apertureGatherCapturePublications.push({
    token: readback.token,
    captureId: readback.captureId,
    requestId: readback.requestId,
    channelId: readback.channelId,
    sceneId: readback.sceneId,
    rendererGenerationId: readback.rendererGenerationId,
  });
  control.apertureGatherCaptureReadback = readback;
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

export const consumeGroundGlassB1BoundaryProbeForTest = (): GroundGlassB1BoundaryProbeRequest | null => {
  const control = getControl();
  const request = control?.groundGlassB1BoundaryProbeRequest ?? null;
  if (control && request) control.groundGlassB1BoundaryProbeRequest = null;
  return request;
};

export const publishGroundGlassB1BoundaryProbeForTest = (
  readback: GroundGlassB1BoundaryProbeReadback,
): void => {
  const control = getControl();
  if (control) control.groundGlassB1BoundaryProbeReadback = readback;
};

export const registerGroundGlassB1BoundaryProbeTriggerForTest = (
  trigger: (() => void) | null,
): void => {
  const control = getControl();
  if (control) control.requestGroundGlassB1BoundaryProbe = trigger ?? undefined;
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

/** Holds only after the M6 final presentation draw has been submitted, for stale-request tests. */
export const holdGroundGlassWebGpuPresentationQueueCompletion = async (): Promise<void> => {
  const control = getControl();
  if (!control?.holdPresentationQueueCompletion) return;
  control.presentationQueueCompletionBarrierReached = true;
  await new Promise<void>((resolve) => {
    control.releasePresentationQueueCompletion = () => {
      control.holdPresentationQueueCompletion = false;
      control.presentationQueueCompletionBarrierReached = false;
      control.releasePresentationQueueCompletion = undefined;
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
