import { REVISION, type RenderTarget } from "three";
import type { GroundGlassFrameRequest } from "../groundGlassFrameRequest";
import type { GroundGlassRendererGenerationIdentity } from "../backend/groundGlassBackendContracts";
import type {
  GroundGlassApertureGatherDiagnosticDetails,
  GroundGlassBackendDiagnosticDetails,
  GroundGlassMountedRuntimeEvidence,
  GroundGlassPhysicalCocDiagnosticDetails,
  GroundGlassPresentationDiagnosticDetails,
} from "../backend/groundGlassBackendDiagnostics";
import type { GroundGlassFrustum } from "../groundGlassInspectionWindow";
import {
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
  requireGroundGlassRawWebGpuEvidenceRevision,
} from "./groundGlassRawWebGpuCompatibility";
import {
  ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION,
  getGroundGlassM6PresentationEvidenceRevisionForInstalledRenderer,
  isGroundGlassM6PresentationRequest,
} from "./groundGlassM6PresentationPolicy";

type WebGpuDiagnosticBackend = Readonly<{
  adapter?: Readonly<{ features?: Iterable<string> }>;
  device?: Readonly<{ features?: Iterable<string> }>;
}>;

export const makeGroundGlassWebGpuPresentationDiagnostic = (input: Readonly<{
  request: GroundGlassFrameRequest;
  generation: GroundGlassRendererGenerationIdentity;
  status: GroundGlassPresentationDiagnosticDetails["status"];
  source: GroundGlassPresentationDiagnosticDetails["source"];
  throughputGain: number | null;
  naturalIllumination: GroundGlassPresentationDiagnosticDetails["naturalIllumination"];
  coverage: GroundGlassPresentationDiagnosticDetails["coverage"];
  passTiming?: GroundGlassPresentationDiagnosticDetails["passTiming"];
}>): GroundGlassPresentationDiagnosticDetails => {
  const m6Presentation = isGroundGlassM6PresentationRequest(input.request);
  const rendererRevision = `r${REVISION}`;
  return {
    requestId: input.request.identity.requestId,
    channelId: input.request.identity.channelId,
    sceneId: input.request.identity.sceneId,
    rendererGenerationId: input.generation.generationId,
    mode: m6Presentation ? "m6-experimental-dof" : "raw-diagnostic",
    status: input.status,
    source: input.source,
    rendererRevision,
    sceneSourceRevision: m6Presentation
      ? ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION
      : ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
    verificationEvidenceRevision: m6Presentation
      ? getGroundGlassM6PresentationEvidenceRevisionForInstalledRenderer()
      : requireGroundGlassRawWebGpuEvidenceRevision(rendererRevision),
    opticalQuality: m6Presentation ? "unqualified" : "not-qualified",
    colorDomain: "linear-no-color-space",
    outputColorSpace: "srgb",
    toneMapping: "none",
    throughputGain: input.throughputGain,
    naturalIllumination: input.naturalIllumination,
    coverage: input.coverage,
    outputWidthPx: input.request.widthPx,
    outputHeightPx: input.request.heightPx,
    additionalRenderTargetCount: 0,
    additionalTargetAttachmentBytes: 0,
    additionalFullscreenPassCount: 0,
    passTiming: input.passTiming ?? null,
  };
};

export const makeGroundGlassWebGpuDiagnosticDetails = (input: {
  request: GroundGlassFrameRequest;
  target: RenderTarget;
  camera: GroundGlassFrustum;
  subjectChildCount: number;
  runtime: GroundGlassMountedRuntimeEvidence;
  backend: WebGpuDiagnosticBackend;
  completedPasses: readonly ("sceneRender" | "presentation" | "textureDisplay")[];
  physicalCoc?: GroundGlassPhysicalCocDiagnosticDetails;
  apertureGather?: GroundGlassApertureGatherDiagnosticDetails;
  presentation?: GroundGlassPresentationDiagnosticDetails;
  actualDepthFormat?: string | null;
}): GroundGlassBackendDiagnosticDetails => {
  if (input.runtime.status !== "mounted" || input.runtime.rendererFamily !== "webgpu-renderer") {
    throw new Error("WebGPU diagnostic details require mounted renderer evidence");
  }
  const m6Presentation = isGroundGlassM6PresentationRequest(input.request);
  const rendererRevision = `r${REVISION}`;
  return {
    backend: "webgpu",
    sceneId: input.request.scene.id,
    requestId: input.request.identity.requestId,
    rendererRevision,
    sceneSourceRevision: m6Presentation
      ? ARCHITECTURE_RISE_M6_PRESENTATION_SOURCE_REVISION
      : ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
    verificationEvidenceRevision: m6Presentation
      ? getGroundGlassM6PresentationEvidenceRevisionForInstalledRenderer()
      : requireGroundGlassRawWebGpuEvidenceRevision(rendererRevision),
    sceneSubject: {
      realization: "registered-ground-glass-profile",
      mounted: true,
      childCount: input.subjectChildCount,
    },
    camera: {
      coordinateSystem: input.runtime.actualExecutionApi === "webgpu" ? "webgpu" : "webgl",
      left: input.camera.left,
      right: input.camera.right,
      top: input.camera.top,
      bottom: input.camera.bottom,
      near: input.camera.near,
      far: input.camera.far,
    },
    actualExecutionApi: input.runtime.actualExecutionApi,
    internalFallback: input.runtime.internalFallback,
    adapterFeatures: Array.from(input.backend.adapter?.features ?? []),
    deviceFeatures: Array.from(input.backend.device?.features ?? []),
    textureStorageFormats: [],
    target: {
      widthPx: input.target.width,
      heightPx: input.target.height,
      colorFormat: "rgba8unorm",
      depthAttachment: "enabled",
      depthFormat: input.actualDepthFormat === undefined ? "depth24plus" : input.actualDepthFormat,
      textureColorSpace: "no-color-space",
      rendererOutputColorSpace: "srgb",
      toneMapping: "none",
    },
    completedPasses: input.completedPasses,
    ...(input.physicalCoc ? { physicalCoc: input.physicalCoc } : {}),
    ...(input.apertureGather ? { apertureGather: input.apertureGather } : {}),
    ...(input.presentation ? { presentation: input.presentation } : {}),
  };
};
