import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { REVISION } from "three";
import { MeshBasicNodeMaterial, PMREMGenerator, WebGPURenderer } from "three/webgpu";
import { texture, uv, vec2, vec4 } from "three/tsl";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { computePhysicalBlurFootprint } from "../../core/optics/computePhysicalBlurFootprint";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";
import type { SceneDefinition } from "../../types/scene";
import type { DerivedOpticsState } from "../../types/optics";
import type { GroundGlassFrameRequest } from "../groundGlassFrameRequest";
import type {
  GroundGlassFrameResult,
  GroundGlassRendererGenerationIdentity,
} from "../backend/groundGlassBackendContracts";
import type {
  GroundGlassBackendDiagnosticDetails,
  GroundGlassPhysicalCocDiagnosticDetails,
  GroundGlassPhysicalCocProbeSummary,
  GroundGlassMountedRuntimeEvidence,
} from "../backend/groundGlassBackendDiagnostics";
import type { GroundGlassCleanupOutcome } from "../groundGlassRenderHostState";
import type { GroundGlassRenderOperationId } from "../groundGlassPassGraph";
import { getGroundGlassSceneProfile } from "../groundGlassSceneProfiles";
import {
  configureGroundGlassCamera,
} from "../configureGroundGlassCamera";
import { createGroundGlassDofRenderState } from "../groundGlassDofRenderState";
import { getGroundGlassDofVisualSettings, resolveGroundGlassDisplayOpticsState } from "../groundGlassVisualSettings";
import {
  type GroundGlassFrustum,
  type GroundGlassInspectionWindow,
} from "../groundGlassInspectionWindow";
import { resolveGroundGlassRttDisplayTransform } from "../groundGlassRttOrientation";
import { getGroundGlassClipRangeWorld } from "../groundGlassRttScenes";
import { resolveGroundGlassRttDimensions } from "../groundGlassRttDimensions";
import {
  createPresentationLightingRig,
  disposePresentationLightingRig,
} from "../TeachingLighting";
import { resolveScenePresentationLighting } from "../presentationLighting";
import { PRESENTATION_SHADOW_MAP_TYPE } from "../presentationLightingContract";
import {
  createWorldIlluminationRig,
  disposeWorldIlluminationRig,
} from "../worldIlluminationRig";
import {
  createProceduralSkyGroundTexture,
} from "../proceduralWorldEnvironment";
import {
  createWorldEnvironmentRigFromTarget,
  disposeWorldEnvironmentRig,
  type WorldEnvironmentRig,
} from "../worldEnvironmentRig";
import { classifyGroundGlassWebGpuRuntime } from "./groundGlassWebGpuRuntime";
import {
  createGroundGlassPhysicalCocNodes,
  createGroundGlassPhysicalCocProbeSampleNodes,
} from "./groundGlassPhysicalCocNodes";
import { isGroundGlassPhysicalCocResearchEnabled } from "./groundGlassPhysicalCocPolicy";
import {
  consumeGroundGlassPhysicalCocProbeRequestForTest,
  holdGroundGlassWebGpuOperationAfterFailure,
  type GroundGlassPhysicalCocProbeReadback,
  holdGroundGlassWebGpuQueueCompletion,
  recordGroundGlassWebGpuAdapterAttemptForTest,
  recordGroundGlassWebGpuTestEvent,
  publishGroundGlassPhysicalCocProbeReadbackForTest,
  forceGroundGlassWebGlCompatibilityBackendForTest,
  throwIfGroundGlassWebGpuFailureInjected,
} from "./groundGlassWebGpuTestSeam";
import {
  ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
} from "./groundGlassRawWebGpuCompatibility";
import { groundGlassPhysicalCocOrientationErrorModuloPi } from "./groundGlassPhysicalCocContract";
import { CAMERA_CONSTANTS } from "../../utils/constants";

type WebGpuRenderer = InstanceType<typeof WebGPURenderer>;
type GpuQueue = Readonly<{ onSubmittedWorkDone: () => Promise<void> }>;
type GpuDeviceLike = Readonly<{
  features?: Iterable<string>;
  queue: GpuQueue;
  lost?: Promise<Readonly<{ message?: string; reason?: string }>>;
}>;
type WebGpuBackendLike = Readonly<{
  isWebGPUBackend?: boolean;
  isWebGLBackend?: boolean;
  adapter?: Readonly<{ features?: Iterable<string> }>;
  device?: GpuDeviceLike;
  get?: (resource: unknown) => unknown;
}>;
type MountedSubject = ReturnType<ReturnType<typeof getGroundGlassSceneProfile>["mountSubject"]>;

type GroundGlassWebGPUAdapterProps = Readonly<{
  request: GroundGlassFrameRequest;
  generation: GroundGlassRendererGenerationIdentity;
  isGenerationActive: () => boolean;
  onAdapterStarted: (generation: GroundGlassRendererGenerationIdentity) => void;
  onRendererMounted: (
    generation: GroundGlassRendererGenerationIdentity,
    runtime: GroundGlassMountedRuntimeEvidence,
    details: GroundGlassBackendDiagnosticDetails,
  ) => void;
  onBackendDetails: (details: GroundGlassBackendDiagnosticDetails) => void;
  onFrameResult: (result: GroundGlassFrameResult) => void;
  onAdapterDisposed: (
    generation: GroundGlassRendererGenerationIdentity,
    outcome: GroundGlassCleanupOutcome,
    reason?: string,
  ) => void;
  onFailure: (
    error: Error,
    stage: "initialization" | "runtime",
    failedPass: GroundGlassRenderOperationId | null,
  ) => void;
}>;

const SKY_COLOR = new THREE.Color("#dfe5ec");

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const backendObservation = (renderer: WebGpuRenderer): WebGpuBackendLike => {
  const backend = renderer.backend as unknown as WebGpuBackendLike;
  return backend;
};

const observeTextureFormat = (
  backend: WebGpuBackendLike,
  value: THREE.Texture | null | undefined,
): string | null => {
  if (!value || !backend.get) return null;
  try {
    const data = backend.get(value) as {
      texture?: { format?: string };
      textureDescriptorGPU?: { format?: string };
    } | undefined;
    return data?.texture?.format ?? data?.textureDescriptorGPU?.format ?? null;
  } catch {
    return null;
  }
};

type RenderNow = (request: GroundGlassFrameRequest) => void;

const makeCamera = (
  renderer: WebGpuRenderer,
  request: GroundGlassFrameRequest,
  targetWidth: number,
  targetHeight: number,
) => {
  const sceneDefinition = request.scene as unknown as SceneDefinition;
  const profile = getGroundGlassSceneProfile(sceneDefinition);
  const profileContext = {
    scene: sceneDefinition,
    cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
    presentationRegion: request.presentationRegion,
  } as const;
  const sceneBounds = profile.resolveRenderBounds(profileContext);
  const effectiveScene = { ...sceneDefinition, bounds: sceneBounds };
  // GroundGlassRenderer already maps the displayed Stage window through the selected Raw/Upright
  // transform before the immutable request is accepted. Applying it again would double-flip Raw.
  const sourceCrop = request.inspectionWindow as unknown as GroundGlassInspectionWindow;
  const preliminaryClip = getGroundGlassClipRangeWorld(effectiveScene, request.opticsState.lensCenterWorld);
  const camera = new THREE.PerspectiveCamera(
    45,
    targetWidth / Math.max(1, targetHeight),
    preliminaryClip.near,
    preliminaryClip.far,
  );
  // Three r186 adjusts clip-space depth for each renderer coordinate system. Preserve the
  // canonical physical frustum and only choose the initialized backend's clip convention.
  camera.coordinateSystem = renderer.coordinateSystem;
  const initial = configureGroundGlassCamera(
    camera,
    request.opticsState as unknown as import("../../types/optics").DerivedOpticsState,
    preliminaryClip.near,
    preliminaryClip.far,
    sourceCrop,
  );
  if (!initial.ok) throw new Error(`Ground Glass camera configuration failed: ${initial.reason}`);

  const clip = getGroundGlassClipRangeWorld(effectiveScene, request.opticsState.lensCenterWorld, {
    x: initial.pose.forwardWorld[0],
    y: initial.pose.forwardWorld[1],
    z: initial.pose.forwardWorld[2],
  });
  camera.near = clip.near;
  camera.far = clip.far;
  const configured = configureGroundGlassCamera(
    camera,
    request.opticsState as unknown as import("../../types/optics").DerivedOpticsState,
    clip.near,
    clip.far,
    sourceCrop,
  );
  if (!configured.ok) throw new Error(`Ground Glass camera configuration failed: ${configured.reason}`);
  camera.projectionMatrix.makePerspective(
    configured.left,
    configured.right,
    configured.top,
    configured.bottom,
    configured.near,
    configured.far,
    renderer.coordinateSystem,
  );
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.updateMatrixWorld(true);
  return { camera, sourceCrop, frustum: configured };
};

const createDisplayMaterial = (target: THREE.RenderTarget, mode: "raw" | "upright") => {
  const material = new MeshBasicNodeMaterial({ toneMapped: false });
  const coordinates = uv();
  const transform = resolveGroundGlassRttDisplayTransform(mode);
  const sampleU = transform.flipDisplayX ? coordinates.x.oneMinus() : coordinates.x;
  // WebGPU render-target views are top-origin. Convert once before applying Raw/Upright.
  const sampleV = transform.flipDisplayY ? coordinates.y : coordinates.y.oneMinus();
  material.colorNode = texture(target.texture, vec2(sampleU, sampleV));
  return material;
};

const createDisplayScene = (target: THREE.RenderTarget, mode: "raw" | "upright") => {
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = createDisplayMaterial(target, mode);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -0.5;
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 0;
  camera.updateMatrixWorld();
  return { scene, geometry, material, camera };
};

const makeDiagnosticDetails = (input: {
  request: GroundGlassFrameRequest;
  target: THREE.RenderTarget;
  camera: GroundGlassFrustum;
  subjectChildCount: number;
  runtime: GroundGlassMountedRuntimeEvidence;
  backend: WebGpuBackendLike;
  completedPasses: readonly ("sceneRender" | "textureDisplay")[];
  physicalCoc?: GroundGlassPhysicalCocDiagnosticDetails;
  actualDepthFormat?: string | null;
}): GroundGlassBackendDiagnosticDetails => {
  if (input.runtime.status !== "mounted" || input.runtime.rendererFamily !== "webgpu-renderer") {
    throw new Error("WebGPU diagnostic details require mounted renderer evidence");
  }
  return {
    backend: "webgpu",
    sceneId: input.request.scene.id,
    requestId: input.request.identity.requestId,
    rendererRevision: `r${REVISION}`,
    sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
    verificationEvidenceRevision: ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION,
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
  };
};

const createPhysicalDofState = (
  request: GroundGlassFrameRequest,
  camera: THREE.PerspectiveCamera,
  widthPx: number,
  heightPx: number,
) => createGroundGlassDofRenderState(
  resolveGroundGlassDisplayOpticsState(
    request.scene.id,
    request.opticsState as unknown as DerivedOpticsState,
  ),
  camera,
  request.focalLengthMm,
  CAMERA_CONSTANTS.filmWidthMm,
  CAMERA_CONSTANTS.filmHeightMm,
  ACCEPTABLE_COC_DIAMETER_MM,
  request.aperture,
  widthPx,
  heightPx,
  getGroundGlassDofVisualSettings(request.scene.id).maximumBlurRadiusPx,
);

const makePhysicalCocDiagnostic = (input: {
  status: GroundGlassPhysicalCocDiagnosticDetails["status"];
  request: GroundGlassFrameRequest;
  generation: GroundGlassRendererGenerationIdentity;
  target: THREE.RenderTarget;
  actualExecutionApi: "webgpu";
  depthFormat: string | null;
  cocStorageFormat: string | null;
  validityStorageFormat: string | null;
  completedPasses: readonly ("sceneDepth" | "physicalCoc" | "validity")[];
  probeSummary?: GroundGlassPhysicalCocProbeSummary | null;
  probeReadbackStatus?: GroundGlassPhysicalCocDiagnosticDetails["probeReadbackStatus"];
  probeReadbackFailureReason?: string | null;
  unsupportedReason?: string | null;
  failureReason?: string | null;
}): GroundGlassPhysicalCocDiagnosticDetails => ({
  status: input.status,
  requestId: input.request.identity.requestId,
  channelId: input.request.identity.channelId,
  sceneId: input.request.identity.sceneId,
  rendererGenerationId: input.generation.generationId,
  actualExecutionApi: input.actualExecutionApi,
  internalFallback: "none",
  depthFormat: input.depthFormat,
  depthReconstruction: input.depthFormat ? "webgpu-zero-to-one-top-origin" : null,
  cocStorageFormat: input.cocStorageFormat,
  validityStorageFormat: input.validityStorageFormat,
  widthPx: input.target.width,
  heightPx: input.target.height,
  completedPasses: input.completedPasses,
  probeReadbackStatus: input.probeReadbackStatus ?? "not-requested",
  probeSummary: input.probeSummary ?? null,
  probeReadbackFailureReason: input.probeReadbackFailureReason ?? null,
  unsupportedReason: input.unsupportedReason ?? null,
  failureReason: input.failureReason ?? null,
});

const toMillimetres = (value: Readonly<{ x: number; y: number; z: number }>) => ({
  x: value.x * 1000,
  y: value.y * 1000,
  z: value.z * 1000,
});

const makePhysicalProbeSummary = (
  readback: GroundGlassPhysicalCocProbeReadback,
  dof: ReturnType<typeof createPhysicalDofState>,
): GroundGlassPhysicalCocProbeSummary => {
  let valid = 0;
  let noDepth = 0;
  let invalidGeometry = 0;
  let unrepresentable = 0;
  let unresolvedFocalBoundary = 0;
  let near = 0;
  let neutral = 0;
  let far = 0;
  let maximumWorldPositionErrorMm: number | null = null;
  let maximumKernelSignedCoCErrorMm: number | null = null;
  let maximumKernelMajorRadiusErrorMm: number | null = null;
  let maximumKernelMinorRadiusErrorMm: number | null = null;
  let maximumKernelOrientationErrorRad: number | null = null;
  let maximumStoredSignedCoCErrorMm: number | null = null;
  let maximumStoredMajorRadiusErrorMm: number | null = null;
  let maximumStoredMinorRadiusErrorMm: number | null = null;
  let maximumStoredOrientationErrorRad: number | null = null;
  let maximumEndToEndSignedCoCErrorMm: number | null = null;
  let maximumEndToEndMajorRadiusErrorMm: number | null = null;
  let maximumEndToEndMinorRadiusErrorMm: number | null = null;
  let maximumEndToEndOrientationErrorRad: number | null = null;
  const updateMaximum = (current: number | null, value: number): number =>
    current === null ? value : Math.max(current, value);

  const filmPointMm = toMillimetres(dof.film.planePointWorldM);
  const filmPlaneDistanceMm =
    filmPointMm.x * dof.film.planeNormal.x +
    filmPointMm.y * dof.film.planeNormal.y +
    filmPointMm.z * dof.film.planeNormal.z;
  const kernelInput = (objectPoint: Readonly<{ x: number; y: number; z: number }>) => ({
    objectPoint: toMillimetres(objectPoint),
    lensCenter: toMillimetres(dof.lens.centerWorldM),
    lensPlaneNormal: dof.lens.planeNormal,
    lensPlaneBasisX: dof.lens.planeBasisX,
    lensPlaneBasisY: dof.lens.planeBasisY,
    filmPlane: {
      point: filmPointMm,
      normal: dof.film.planeNormal,
      distance: filmPlaneDistanceMm,
    },
    filmPlaneBasisX: dof.film.planeBasisX,
    filmPlaneBasisY: dof.film.planeBasisY,
    focalLengthMm: dof.optics.focalLengthMm,
    apertureFNumber: dof.optics.apertureFNumber,
  });

  for (const sample of readback.samples) {
    switch (sample.validityCode) {
      case 0: noDepth += 1; continue;
      case 1: valid += 1; break;
      case 2: unrepresentable += 1; continue;
      case 3: invalidGeometry += 1; continue;
      case 4: unresolvedFocalBoundary += 1; continue;
      default: invalidGeometry += 1; continue;
    }
    const signedStored = sample.controlledObjectPoint
      ? sample.kernelFootprintMm[0]
      : sample.storedFootprintMm?.[0] ?? 0;
    if (signedStored < 0) near += 1;
    else if (signedStored > 0) far += 1;
    else neutral += 1;

    const kernelPointM = {
      x: sample.kernelObjectPositionM[0],
      y: sample.kernelObjectPositionM[1],
      z: sample.kernelObjectPositionM[2],
    };
    const cpuAtKernelPoint = computePhysicalBlurFootprint(kernelInput(kernelPointM));
    if (!cpuAtKernelPoint.valid) continue;
    maximumKernelSignedCoCErrorMm = updateMaximum(
      maximumKernelSignedCoCErrorMm,
      Math.abs(cpuAtKernelPoint.signedCoCDiameterMm - sample.kernelFootprintMm[0]),
    );
    maximumKernelMajorRadiusErrorMm = updateMaximum(
      maximumKernelMajorRadiusErrorMm,
      Math.abs(cpuAtKernelPoint.majorRadiusMm - sample.kernelFootprintMm[1]),
    );
    maximumKernelMinorRadiusErrorMm = updateMaximum(
      maximumKernelMinorRadiusErrorMm,
      Math.abs(cpuAtKernelPoint.minorRadiusMm - sample.kernelFootprintMm[2]),
    );
    const kernelOrientation = sample.kernelFootprintMm[3] * Math.PI;
    const kernelOrientationError = groundGlassPhysicalCocOrientationErrorModuloPi(
      cpuAtKernelPoint.orientationRad,
      kernelOrientation,
    );
    if (kernelOrientationError !== null) {
      maximumKernelOrientationErrorRad = updateMaximum(
        maximumKernelOrientationErrorRad,
        kernelOrientationError,
      );
    }
    if (!sample.storedFootprintMm) continue;
    maximumStoredSignedCoCErrorMm = updateMaximum(
      maximumStoredSignedCoCErrorMm,
      Math.abs(sample.kernelFootprintMm[0] - signedStored),
    );
    maximumStoredMajorRadiusErrorMm = updateMaximum(
      maximumStoredMajorRadiusErrorMm,
      Math.abs(sample.kernelFootprintMm[1] - sample.storedFootprintMm[1]),
    );
    maximumStoredMinorRadiusErrorMm = updateMaximum(
      maximumStoredMinorRadiusErrorMm,
      Math.abs(sample.kernelFootprintMm[2] - sample.storedFootprintMm[2]),
    );
    const storedOrientationError = groundGlassPhysicalCocOrientationErrorModuloPi(
      kernelOrientation,
      sample.storedFootprintMm[3] * Math.PI,
    );
    if (storedOrientationError !== null) {
      maximumStoredOrientationErrorRad = updateMaximum(
        maximumStoredOrientationErrorRad,
        storedOrientationError,
      );
    }

    if (!sample.expectedWorldM) continue;
    const expectedPointM = {
      x: sample.expectedWorldM[0],
      y: sample.expectedWorldM[1],
      z: sample.expectedWorldM[2],
    };
    const reconstructedPointM = {
      x: sample.reconstructedWorldM[0],
      y: sample.reconstructedWorldM[1],
      z: sample.reconstructedWorldM[2],
    };
    const worldErrorMm = Math.hypot(
      (reconstructedPointM.x - expectedPointM.x) * 1000,
      (reconstructedPointM.y - expectedPointM.y) * 1000,
      (reconstructedPointM.z - expectedPointM.z) * 1000,
    );
    maximumWorldPositionErrorMm = updateMaximum(maximumWorldPositionErrorMm, worldErrorMm);
    const cpuAtExpected = computePhysicalBlurFootprint(kernelInput(expectedPointM));
    if (!cpuAtExpected.valid) continue;
    maximumEndToEndSignedCoCErrorMm = updateMaximum(
      maximumEndToEndSignedCoCErrorMm,
      Math.abs(cpuAtExpected.signedCoCDiameterMm - signedStored),
    );
    maximumEndToEndMajorRadiusErrorMm = updateMaximum(
      maximumEndToEndMajorRadiusErrorMm,
      Math.abs(cpuAtExpected.majorRadiusMm - sample.storedFootprintMm[1]),
    );
    maximumEndToEndMinorRadiusErrorMm = updateMaximum(
      maximumEndToEndMinorRadiusErrorMm,
      Math.abs(cpuAtExpected.minorRadiusMm - sample.storedFootprintMm[2]),
    );
    const endToEndOrientationError = groundGlassPhysicalCocOrientationErrorModuloPi(
      cpuAtExpected.orientationRad,
      sample.storedFootprintMm[3] * Math.PI,
    );
    if (endToEndOrientationError !== null) {
      maximumEndToEndOrientationErrorRad = updateMaximum(
        maximumEndToEndOrientationErrorRad,
        endToEndOrientationError,
      );
    }
  }

  return {
    count: readback.samples.length,
    valid,
    noDepth,
    invalidGeometry,
    unrepresentable,
    unresolvedFocalBoundary,
    near,
    neutral,
    far,
    maximumWorldPositionErrorMm,
    maximumKernelSignedCoCErrorMm,
    maximumKernelMajorRadiusErrorMm,
    maximumKernelMinorRadiusErrorMm,
    maximumKernelOrientationErrorRad,
    maximumStoredSignedCoCErrorMm,
    maximumStoredMajorRadiusErrorMm,
    maximumStoredMinorRadiusErrorMm,
    maximumStoredOrientationErrorRad,
    maximumEndToEndSignedCoCErrorMm,
    maximumEndToEndMajorRadiusErrorMm,
    maximumEndToEndMinorRadiusErrorMm,
    maximumEndToEndOrientationErrorRad,
  };
};

const createGroundGlassWorldEnvironment = (
  scene: THREE.Scene,
  renderer: WebGpuRenderer,
  environment: NonNullable<ReturnType<typeof resolveSceneWorldIllumination>["environment"]>,
): WorldEnvironmentRig => {
  const source = createProceduralSkyGroundTexture(environment);
  let generator: PMREMGenerator | null = null;
  let renderTarget: THREE.RenderTarget | null = null;
  let error: unknown;
  try {
    generator = new PMREMGenerator(renderer);
    renderTarget = generator.fromEquirectangular(source);
  } catch (cause) {
    error = cause;
  }
  try {
    generator?.dispose();
  } catch (cause) {
    error ??= cause;
  }
  try {
    source.dispose();
  } catch (cause) {
    error ??= cause;
  }
  if (error !== undefined) {
    try { renderTarget?.dispose(); } catch { /* Keep conversion failure authoritative. */ }
    throw error;
  }
  if (!renderTarget) throw new Error("Ground Glass WebGPU environment conversion returned no target");
  return createWorldEnvironmentRigFromTarget(scene, renderTarget, environment);
};

export const GroundGlassWebGPUAdapter = ({
  request,
  generation,
  isGenerationActive,
  onAdapterStarted,
  onRendererMounted,
  onBackendDetails,
  onFrameResult,
  onAdapterDisposed,
  onFailure,
}: GroundGlassWebGPUAdapterProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef(request);
  const propsRef = useRef({ onAdapterStarted, onRendererMounted, onBackendDetails, onFrameResult, onAdapterDisposed, onFailure });
  const activeRef = useRef(false);
  const readyRef = useRef(false);
  const runtimeRef = useRef<GroundGlassMountedRuntimeEvidence>({ status: "unknown" });
  const operationTailRef = useRef<Promise<void>>(Promise.resolve());
  const effectTokenRef = useRef<{ generationId: string } | null>(null);
  const disposeRef = useRef<(() => Promise<void>) | null>(null);
  const renderNowRef = useRef<RenderNow | null>(null);
  const latestRequestKey = `${request.identity.requestId}:${request.widthPx}x${request.heightPx}:${request.previewMode}`;
  const [ready, setReady] = useState(false);
  const [runtimeApi, setRuntimeApi] = useState<"webgpu" | "webgl2" | "unknown">("unknown");
  const [targetSize, setTargetSize] = useState({ width: 0, height: 0 });
  const [sourceCrop, setSourceCrop] = useState<GroundGlassInspectionWindow | null>(null);
  const [sceneSubjectEvidence, setSceneSubjectEvidence] = useState<{ mounted: boolean; childCount: number }>({ mounted: false, childCount: 0 });
  const [cameraEvidence, setCameraEvidence] = useState<{
    configured: boolean;
    coordinateSystem: "webgpu" | "webgl";
    frustum: GroundGlassFrustum | null;
  }>({ configured: false, coordinateSystem: "webgpu", frustum: null });
  const [targetDepthEnabled, setTargetDepthEnabled] = useState(false);
  const [physicalCocDiagnostics, setPhysicalCocDiagnostics] =
    useState<GroundGlassPhysicalCocDiagnosticDetails | null>(null);
  const [lastDisplayedRequestId, setLastDisplayedRequestId] = useState<string | null>(null);
  const [lastDisplayedFrameId, setLastDisplayedFrameId] = useState<string | null>(null);

  requestRef.current = request;
  propsRef.current = { onAdapterStarted, onRendererMounted, onBackendDetails, onFrameResult, onAdapterDisposed, onFailure };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const adapterRoot = canvas.parentElement;
    const effectToken = { generationId: generation.generationId };
    effectTokenRef.current = effectToken;
    let retired = false;
    let failureReported = false;
    let disposePromise: Promise<void> | null = null;
    let initialization = Promise.resolve();
    let renderer: WebGpuRenderer | null = null;
    let target: THREE.RenderTarget | null = null;
    let physicalTarget: THREE.RenderTarget | null = null;
    let validityTarget: THREE.RenderTarget | null = null;
    let physicalGeometry: THREE.PlaneGeometry | null = null;
    let physicalMaterial: MeshBasicNodeMaterial | null = null;
    let validityMaterial: MeshBasicNodeMaterial | null = null;
    let physicalScene: THREE.Scene | null = null;
    let validityScene: THREE.Scene | null = null;
    let physicalCamera: THREE.OrthographicCamera | null = null;
    let physicalNodes: ReturnType<typeof createGroundGlassPhysicalCocNodes> | null = null;
    let physicalPassEnabled = false;
    let physicalPassStatus: GroundGlassPhysicalCocDiagnosticDetails["status"] = "disabled";
    let physicalPassUnsupportedReason: string | null = null;
    let physicalPassFailureReason: string | null = null;
    let actualDepthFormat: string | null = null;
    let actualCocStorageFormat: string | null = null;
    let actualValidityStorageFormat: string | null = null;
    let physicalCompletedPasses: Array<"sceneDepth" | "physicalCoc" | "validity"> = [];
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let display: ReturnType<typeof createDisplayScene> | null = null;
    let subject: MountedSubject = null;
    let presentationLighting: ReturnType<typeof createPresentationLightingRig> | null = null;
    let worldLighting: ReturnType<typeof createWorldIlluminationRig> | null = null;
    let environmentRig: WorldEnvironmentRig | null = null;
    let cameraFrustum: GroundGlassFrustum | null = null;

    const reportFailure = (error: unknown, stage: "initialization" | "runtime", failedPass: GroundGlassRenderOperationId | null) => {
      if (failureReported || retired || !isGenerationActive()) return;
      failureReported = true;
      adapterRoot?.setAttribute("data-failure-stage", stage);
      adapterRoot?.setAttribute("data-failure-operation", failedPass ?? "unknown");
      adapterRoot?.setAttribute("data-failure-reason", errorMessage(error));
      recordGroundGlassWebGpuTestEvent({
        kind: "failure",
        generationId: generation.generationId,
        stage,
        operation: failedPass ?? "unknown",
        reason: errorMessage(error),
      });
      propsRef.current.onFailure(error instanceof Error ? error : new Error(errorMessage(error)), stage, failedPass);
    };

    const disposeOwned = (): Promise<void> => {
      if (disposePromise) return disposePromise;
      retired = true;
      activeRef.current = false;
      disposePromise = (async () => {
        const errors: unknown[] = [];
        let cleanupTimeout: ReturnType<typeof setTimeout> | undefined;
        const operationsSettled = Promise.all([operationTailRef.current, initialization]).then(() => true);
        const cleanupDeadline = new Promise<false>((resolve) => {
          cleanupTimeout = setTimeout(() => resolve(false), 20_000);
        });
        const settledBeforeDeadline = await Promise.race([operationsSettled, cleanupDeadline]);
        if (cleanupTimeout !== undefined) clearTimeout(cleanupTimeout);
        if (!settledBeforeDeadline) {
          const reason = "WebGPU initialization or queued GPU work did not settle before cleanup deadline; owned resources were retained";
          adapterRoot?.setAttribute("data-cleanup-outcome", "uncertain");
          adapterRoot?.setAttribute("data-cleanup-reason", reason);
          recordGroundGlassWebGpuTestEvent({ kind: "cleanup", generationId: generation.generationId, outcome: "uncertain" });
          propsRef.current.onAdapterDisposed(generation, "uncertain", reason);
          return;
        }
        const dispose = async (action: () => void | Promise<void>) => {
          try { await action(); } catch (error) { errors.push(error); }
        };
        if (display) {
          display.scene.clear();
          await dispose(() => display?.material.dispose());
          await dispose(() => display?.geometry.dispose());
          display = null;
        }
        physicalScene?.clear();
        validityScene?.clear();
        await dispose(() => physicalMaterial?.dispose());
        physicalMaterial = null;
        await dispose(() => validityMaterial?.dispose());
        validityMaterial = null;
        await dispose(() => physicalGeometry?.dispose());
        physicalGeometry = null;
        await dispose(async () => physicalTarget?.dispose());
        physicalTarget = null;
        await dispose(async () => validityTarget?.dispose());
        validityTarget = null;
        physicalScene = null;
        validityScene = null;
        physicalCamera = null;
        physicalNodes = null;
        await dispose(async () => {
          await target?.dispose();
          throwIfGroundGlassWebGpuFailureInjected("dispose-target");
        });
        target = null;
        if (subject) {
          await dispose(() => subject?.dispose());
          subject = null;
        }
        if (environmentRig && scene) {
          await dispose(() => disposeWorldEnvironmentRig(scene!, environmentRig!));
          environmentRig = null;
        }
        if (worldLighting && scene) {
          await dispose(() => disposeWorldIlluminationRig(scene!, worldLighting!));
          worldLighting = null;
        }
        if (presentationLighting && scene) {
          await dispose(() => disposePresentationLightingRig(scene!, presentationLighting!));
          presentationLighting = null;
        }
        scene?.clear();
        await dispose(async () => renderer?.dispose());
        renderer = null;
        readyRef.current = false;
        setReady(false);
        setRuntimeApi("unknown");
        setSceneSubjectEvidence({ mounted: false, childCount: 0 });
        setCameraEvidence({ configured: false, coordinateSystem: "webgpu", frustum: null });
        setTargetDepthEnabled(false);
        setPhysicalCocDiagnostics(null);
        const outcome: GroundGlassCleanupOutcome = errors.length === 0 ? "confirmed" : "failed";
        const reason = errors.length ? errors.map(errorMessage).join("; ") : undefined;
        adapterRoot?.setAttribute("data-cleanup-outcome", outcome);
        if (reason) adapterRoot?.setAttribute("data-cleanup-reason", reason);
        recordGroundGlassWebGpuTestEvent({ kind: "cleanup", generationId: generation.generationId, outcome });
        propsRef.current.onAdapterDisposed(generation, outcome, reason);
        if (errors.length) throw new AggregateError(errors, "Ground Glass WebGPU resource cleanup failed");
      })();
      return disposePromise;
    };
    disposeRef.current = disposeOwned;

    let mountedBackend: WebGpuBackendLike | null = null;
    let completedPasses: readonly ("sceneRender" | "textureDisplay")[] = [];
    let frameSequence = 0;
    let displayMode: "raw" | "upright" = requestRef.current.previewMode;

    const renderNow: RenderNow = (requested) => {
      const queued = operationTailRef.current.then(async () => {
        const latest = requestRef.current;
        if (
          retired ||
          !isGenerationActive() ||
          !activeRef.current ||
          !renderer ||
          !target ||
          !scene ||
          !camera ||
          !display ||
          latest.identity.requestId !== requested.identity.requestId ||
          latest.identity.channelId !== requested.identity.channelId ||
          latest.identity.sceneId !== requested.identity.sceneId
        ) return;

        let failedPass: GroundGlassRenderOperationId | null = null;
        let physicalDiagnostic: GroundGlassPhysicalCocDiagnosticDetails | undefined;
        try {
          const dimensions = resolveGroundGlassRttDimensions({
            logicalWidth: latest.widthPx,
            logicalHeight: latest.heightPx,
            renderQuality: latest.renderQuality,
            devicePixelRatio: 1,
          });
          target.setSize(dimensions.internalWidthPx, dimensions.internalHeightPx);
          renderer.setSize(Math.max(1, latest.widthPx), Math.max(1, latest.heightPx), false);
          const cameraConfiguration = makeCamera(renderer, latest, target.width, target.height);
          camera = cameraConfiguration.camera;
          cameraFrustum = cameraConfiguration.frustum;
          const mappedSourceCrop = latest.inspectionWindow as unknown as GroundGlassInspectionWindow;
          setTargetSize({ width: target.width, height: target.height });
          setSourceCrop(mappedSourceCrop);

          if (displayMode !== latest.previewMode) {
            display.scene.clear();
            const previousMaterial = display.material;
            const previousGeometry = display.geometry;
            display = createDisplayScene(target, latest.previewMode);
            displayMode = latest.previewMode;
            previousMaterial.dispose();
            previousGeometry.dispose();
          }

          failedPass = "sceneRender";
          renderer.setRenderTarget(target);
          renderer.setViewport(0, 0, target.width, target.height);
          renderer.setScissorTest(false);
          renderer.setClearColor(SKY_COLOR, 1);
          renderer.clear(true, true, true);
          renderer.render(scene, camera);
          const device = mountedBackend?.device;
          if (!device) throw new Error("Native WebGPU scene submission has no initialized GPU device");
          await holdGroundGlassWebGpuQueueCompletion();
          await device.queue.onSubmittedWorkDone();
          if (retired || !isGenerationActive() || !activeRef.current) return;
          if (requestRef.current.identity.requestId !== latest.identity.requestId) return;
          throwIfGroundGlassWebGpuFailureInjected("scene-render-after-submit");

          if (
            physicalPassEnabled &&
            physicalTarget &&
            validityTarget &&
            physicalNodes &&
            physicalScene &&
            validityScene &&
            physicalCamera &&
            mountedBackend &&
            runtimeRef.current.status === "mounted" &&
            runtimeRef.current.actualExecutionApi === "webgpu" &&
            target.depthTexture
          ) {
            physicalCompletedPasses = ["sceneDepth"];
            actualDepthFormat = observeTextureFormat(mountedBackend, target.depthTexture);
            actualCocStorageFormat = null;
            actualValidityStorageFormat = null;
            physicalPassUnsupportedReason = null;
            physicalPassFailureReason = null;
            try {
              if (!actualDepthFormat) {
                physicalPassStatus = "unsupported";
                physicalPassUnsupportedReason = "native depth texture format could not be observed";
              } else {
                physicalTarget.setSize(target.width, target.height);
                validityTarget.setSize(target.width, target.height);
                physicalNodes.setState({
                  dof: createPhysicalDofState(latest, camera, target.width, target.height),
                });
                failedPass = "cocFootprint";
                renderer.setRenderTarget(physicalTarget);
                renderer.setViewport(0, 0, physicalTarget.width, physicalTarget.height);
                renderer.setScissorTest(false);
                renderer.clear(true, false, false);
                renderer.render(physicalScene, physicalCamera);
                await device.queue.onSubmittedWorkDone();
                if (retired || !isGenerationActive() || !activeRef.current) return;
                if (requestRef.current.identity.requestId !== latest.identity.requestId) return;
                actualCocStorageFormat = observeTextureFormat(mountedBackend, physicalTarget.texture);
                if (actualCocStorageFormat !== "rgba16float") {
                  physicalPassStatus = "unsupported";
                  physicalPassUnsupportedReason =
                    "RGBA16F physical target required; observed " + (actualCocStorageFormat ?? "unknown");
                } else {
                  physicalCompletedPasses.push("physicalCoc");
                  throwIfGroundGlassWebGpuFailureInjected("physical-coc-after-submit");
                  renderer.setRenderTarget(validityTarget);
                  renderer.setViewport(0, 0, validityTarget.width, validityTarget.height);
                  renderer.clear(true, false, false);
                  renderer.render(validityScene, physicalCamera);
                  await device.queue.onSubmittedWorkDone();
                  if (retired || !isGenerationActive() || !activeRef.current) return;
                  if (requestRef.current.identity.requestId !== latest.identity.requestId) return;
                  actualValidityStorageFormat = observeTextureFormat(mountedBackend, validityTarget.texture);
                  if (actualValidityStorageFormat !== "rgba8unorm") {
                    physicalPassStatus = "unsupported";
                    physicalPassUnsupportedReason =
                      "RGBA8 validity target required; observed " + (actualValidityStorageFormat ?? "unknown");
                  } else {
                    physicalCompletedPasses.push("validity");
                    physicalPassStatus = "completed";
                  }
                }
              }
            } catch (error) {
              physicalPassStatus = "failed";
              physicalPassFailureReason = errorMessage(error);
            }
            failedPass = null;
            physicalDiagnostic = makePhysicalCocDiagnostic({
              status: physicalPassStatus,
              request: latest,
              generation,
              target,
              actualExecutionApi: "webgpu",
              depthFormat: actualDepthFormat,
              cocStorageFormat: actualCocStorageFormat,
              validityStorageFormat: actualValidityStorageFormat,
              completedPasses: physicalCompletedPasses,
              unsupportedReason: physicalPassUnsupportedReason,
              failureReason: physicalPassFailureReason,
            });
            if (retired || !isGenerationActive() || !activeRef.current) return;
            if (requestRef.current.identity.requestId !== latest.identity.requestId) return;

            const probeRequest = physicalPassStatus === "completed"
              ? consumeGroundGlassPhysicalCocProbeRequestForTest()
              : null;
            if (probeRequest) {
              const validProbeRequest =
                probeRequest.probes.length > 0 &&
                probeRequest.probes.length <= 16 &&
                probeRequest.probes.every((probe) =>
                  probe.id.trim().length > 0 &&
                  Number.isFinite(probe.u) &&
                  probe.u >= 0 &&
                  probe.u <= 1 &&
                  Number.isFinite(probe.v) &&
                  probe.v >= 0 &&
                    probe.v <= 1 &&
                    (!probe.controlledObjectPointMm || probe.controlledObjectPointMm.every(Number.isFinite)) &&
                    (!probe.explicitParallelLimitIdentity || Boolean(probe.controlledObjectPointMm)),
                );
              if (!validProbeRequest || !target.depthTexture || !physicalTarget || !validityTarget) {
                physicalDiagnostic = {
                  ...physicalDiagnostic,
                  probeReadbackStatus: "failed",
                  probeReadbackFailureReason: "bounded physical probe request or M4 target was invalid",
                };
              } else {
                let probeGeometry: THREE.PlaneGeometry | null = null;
                let probeKernelMaterial: MeshBasicNodeMaterial | null = null;
                let probeWorldMaterial: MeshBasicNodeMaterial | null = null;
                let probeFocalMaterial: MeshBasicNodeMaterial | null = null;
                let probeKernelPointMaterial: MeshBasicNodeMaterial | null = null;
                let probeStoredMaterial: MeshBasicNodeMaterial | null = null;
                let probeValidityMaterial: MeshBasicNodeMaterial | null = null;
                let probeKernelValidityMaterial: MeshBasicNodeMaterial | null = null;
                const probeTargets: THREE.RenderTarget[] = [];
                try {
                  const dof = createPhysicalDofState(latest, camera, target.width, target.height);
                  const probeNodes = createGroundGlassPhysicalCocNodes({
                    depthTexture: target.depthTexture,
                    state: { dof },
                    probes: probeRequest.probes,
                  });
                  const sampledNodes = createGroundGlassPhysicalCocProbeSampleNodes({
                    physicalTexture: physicalTarget.texture,
                    validityTexture: validityTarget.texture,
                    probes: probeRequest.probes,
                  });
                  probeGeometry = new THREE.PlaneGeometry(2, 2);
                  probeKernelMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
                  probeKernelMaterial.outputNode = probeNodes.rawFootprint;
                  probeWorldMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
                  probeWorldMaterial.outputNode = vec4(probeNodes.worldPositionM, probeNodes.sampledDepth);
                  probeFocalMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
                  probeFocalMaterial.outputNode = probeNodes.focalDiagnostics;
                  probeKernelPointMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
                  probeKernelPointMaterial.outputNode = vec4(probeNodes.kernelObjectPositionM, 1);
                  probeStoredMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
                  probeStoredMaterial.outputNode = sampledNodes.storedFootprint;
                  probeValidityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
                  probeValidityMaterial.outputNode = vec4(sampledNodes.validityCode.div(255), 0, 0, 1);
                  probeKernelValidityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
                  probeKernelValidityMaterial.outputNode = vec4(probeNodes.validityCode.div(255), 0, 0, 1);
                  const makeProbeScene = (material: MeshBasicNodeMaterial) => {
                    const probeScene = new THREE.Scene();
                    const mesh = new THREE.Mesh(probeGeometry!, material);
                    mesh.position.z = -0.5;
                    probeScene.add(mesh);
                    return probeScene;
                  };
                  const probeScenes = [
                    makeProbeScene(probeKernelMaterial),
                    makeProbeScene(probeWorldMaterial),
                    makeProbeScene(probeFocalMaterial),
                    makeProbeScene(probeKernelPointMaterial),
                    makeProbeScene(probeStoredMaterial),
                    makeProbeScene(probeValidityMaterial),
                    makeProbeScene(probeKernelValidityMaterial),
                  ];
                  const count = probeRequest.probes.length;
                  const makeProbeTarget = (type: THREE.TextureDataType) => {
                    const probeTarget = new THREE.RenderTarget(count, 1, {
                      format: THREE.RGBAFormat,
                      type,
                      depthBuffer: false,
                      stencilBuffer: false,
                      samples: 0,
                      generateMipmaps: false,
                    });
                    probeTarget.texture.colorSpace = THREE.NoColorSpace;
                    probeTarget.texture.minFilter = THREE.NearestFilter;
                    probeTarget.texture.magFilter = THREE.NearestFilter;
                    probeTarget.texture.generateMipmaps = false;
                    probeTargets.push(probeTarget);
                    return probeTarget;
                  };
                  const kernelTarget = makeProbeTarget(THREE.FloatType);
                  const worldTarget = makeProbeTarget(THREE.FloatType);
                  const focalTarget = makeProbeTarget(THREE.FloatType);
                  const kernelPointTarget = makeProbeTarget(THREE.FloatType);
                  const storedTarget = makeProbeTarget(THREE.FloatType);
                  const sampledValidityTarget = makeProbeTarget(THREE.UnsignedByteType);
                  const kernelValidityTarget = makeProbeTarget(THREE.UnsignedByteType);
                  const probeCamera = physicalCamera!;
                  for (const [probeScene, probeTarget] of [
                    [probeScenes[0]!, kernelTarget],
                    [probeScenes[1]!, worldTarget],
                    [probeScenes[2]!, focalTarget],
                    [probeScenes[3]!, kernelPointTarget],
                    [probeScenes[4]!, storedTarget],
                    [probeScenes[5]!, sampledValidityTarget],
                    [probeScenes[6]!, kernelValidityTarget],
                  ] as const) {
                    renderer.setRenderTarget(probeTarget);
                    renderer.setViewport(0, 0, count, 1);
                    renderer.setScissorTest(false);
                    renderer.clear(true, false, false);
                    renderer.render(probeScene, probeCamera);
                  }
                  await device.queue.onSubmittedWorkDone();
                  if (retired || !isGenerationActive() || !activeRef.current) return;
                  if (requestRef.current.identity.requestId !== latest.identity.requestId) return;
                  const kernelPixels = await renderer.readRenderTargetPixelsAsync(
                    kernelTarget, 0, 0, count, 1,
                  ) as Float32Array;
                  const worldPixels = await renderer.readRenderTargetPixelsAsync(
                    worldTarget, 0, 0, count, 1,
                  ) as Float32Array;
                  const focalPixels = await renderer.readRenderTargetPixelsAsync(
                    focalTarget, 0, 0, count, 1,
                  ) as Float32Array;
                  const kernelPointPixels = await renderer.readRenderTargetPixelsAsync(
                    kernelPointTarget, 0, 0, count, 1,
                  ) as Float32Array;
                  const storedPixels = await renderer.readRenderTargetPixelsAsync(
                    storedTarget, 0, 0, count, 1,
                  ) as Float32Array;
                  const validityPixels = await renderer.readRenderTargetPixelsAsync(
                    sampledValidityTarget, 0, 0, count, 1,
                  ) as Uint8Array;
                  const kernelValidityPixels = await renderer.readRenderTargetPixelsAsync(
                    kernelValidityTarget, 0, 0, count, 1,
                  ) as Uint8Array;
                  if (
                    !(kernelPixels instanceof Float32Array) ||
                    !(worldPixels instanceof Float32Array) ||
                    !(focalPixels instanceof Float32Array) ||
                    !(kernelPointPixels instanceof Float32Array) ||
                    !(storedPixels instanceof Float32Array) ||
                    !(validityPixels instanceof Uint8Array) ||
                    !(kernelValidityPixels instanceof Uint8Array)
                  ) {
                    throw new Error("Native physical CoC probe readback returned an unexpected typed array");
                  }
                  if (retired || !isGenerationActive() || !activeRef.current) return;
                  if (requestRef.current.identity.requestId !== latest.identity.requestId) return;
                  const samples = probeRequest.probes.map((probe, index) => {
                    const offset = index * 4;
                    return {
                      id: probe.id,
                      u: probe.u,
                      v: probe.v,
                      depth: worldPixels[offset + 3]!,
                      reconstructedWorldM: [
                        worldPixels[offset]!,
                        worldPixels[offset + 1]!,
                        worldPixels[offset + 2]!,
                      ] as const,
                      kernelObjectPositionM: [
                        kernelPointPixels[offset]!,
                        kernelPointPixels[offset + 1]!,
                        kernelPointPixels[offset + 2]!,
                      ] as const,
                      controlledObjectPoint: Boolean(probe.controlledObjectPointMm),
                      expectedWorldM: probe.expectedWorldM ?? null,
                      expectedSurfaceId: probe.expectedSurfaceId ?? null,
                      kernelFootprintMm: [
                        kernelPixels[offset]!,
                        kernelPixels[offset + 1]!,
                        kernelPixels[offset + 2]!,
                        kernelPixels[offset + 3]!,
                      ] as const,
                      storedFootprintMm: probe.controlledObjectPointMm
                        ? null
                        : [
                            storedPixels[offset]!,
                            storedPixels[offset + 1]!,
                            storedPixels[offset + 2]!,
                            storedPixels[offset + 3]!,
                          ] as const,
                      validityCode: probe.controlledObjectPointMm
                        ? kernelValidityPixels[offset]!
                        : validityPixels[offset]!,
                      focalBranchCode: Math.round(focalPixels[offset + 2]!),
                    };
                  });
                  const mountedRuntime = runtimeRef.current;
                  if (
                    mountedRuntime.status !== "mounted" ||
                    mountedRuntime.rendererFamily !== "webgpu-renderer" ||
                    mountedRuntime.actualExecutionApi !== "webgpu"
                  ) {
                    throw new Error("Physical CoC probe publication requires mounted native WebGPU runtime evidence");
                  }
                  const readback: GroundGlassPhysicalCocProbeReadback = {
                    token: probeRequest.token,
                    requestId: latest.identity.requestId,
                    channelId: latest.identity.channelId,
                    sceneId: latest.identity.sceneId,
                    rendererGenerationId: generation.generationId,
                    rendererFamily: mountedRuntime.rendererFamily,
                    actualExecutionApi: mountedRuntime.actualExecutionApi,
                    internalFallback: mountedRuntime.internalFallback,
                    widthPx: target.width,
                    heightPx: target.height,
                    depthFormat: actualDepthFormat,
                    cocStorageFormat: actualCocStorageFormat,
                    validityStorageFormat: actualValidityStorageFormat,
                    samples,
                  };
                  publishGroundGlassPhysicalCocProbeReadbackForTest(readback);
                  physicalDiagnostic = {
                    ...physicalDiagnostic,
                    probeReadbackStatus: "completed",
                    probeSummary: makePhysicalProbeSummary(readback, dof),
                    probeReadbackFailureReason: null,
                  };
                } catch (error) {
                  physicalDiagnostic = {
                    ...physicalDiagnostic,
                    probeReadbackStatus: "failed",
                    probeReadbackFailureReason: errorMessage(error),
                  };
                } finally {
                  renderer.setRenderTarget(null);
                  for (const targetToDispose of probeTargets) targetToDispose.dispose();
                  probeKernelMaterial?.dispose();
                  probeWorldMaterial?.dispose();
                  probeFocalMaterial?.dispose();
                  probeKernelPointMaterial?.dispose();
                  probeStoredMaterial?.dispose();
                  probeValidityMaterial?.dispose();
                  probeKernelValidityMaterial?.dispose();
                  probeGeometry?.dispose();
                }
              }
            }
            if (physicalDiagnostic) setPhysicalCocDiagnostics(physicalDiagnostic);
          }

          // The raw target blit is presentation plumbing, not a Ground Glass semantic pass.
          failedPass = "textureDisplay";
          renderer.setRenderTarget(null);
          renderer.setViewport(0, 0, Math.max(1, latest.widthPx), Math.max(1, latest.heightPx));
          renderer.setClearColor(SKY_COLOR, 1);
          renderer.clear(true, true, true);
          renderer.render(display.scene, display.camera);
          await holdGroundGlassWebGpuQueueCompletion();
          await device.queue.onSubmittedWorkDone();
          if (retired || !isGenerationActive() || !activeRef.current) return;
          if (requestRef.current.identity.requestId !== latest.identity.requestId) return;
          throwIfGroundGlassWebGpuFailureInjected("texture-display-after-submit");

          failedPass = null;
          completedPasses = ["sceneRender", "textureDisplay"];
          const runtime = runtimeRef.current;
          if (runtime.status !== "mounted" || !mountedBackend || !cameraFrustum || !subject) {
            throw new Error("Completed Raw display has no mounted WebGPU runtime evidence");
          }
          const details = makeDiagnosticDetails({
            request: latest,
            target,
            camera: cameraFrustum,
            subjectChildCount: subject.group.children.length,
            runtime,
            backend: mountedBackend,
            completedPasses,
            ...(physicalDiagnostic ? { physicalCoc: physicalDiagnostic } : {}),
            ...(physicalDiagnostic ? { actualDepthFormat } : {}),
          });
          if (physicalDiagnostic) setPhysicalCocDiagnostics(physicalDiagnostic);
          propsRef.current.onBackendDetails(details);
          const frameId = `${generation.generationId}:${latest.identity.requestId}:${++frameSequence}`;
          setLastDisplayedRequestId(latest.identity.requestId);
          setLastDisplayedFrameId(frameId);
          recordGroundGlassWebGpuTestEvent({
            kind: "frame-completed",
            generationId: generation.generationId,
            requestId: latest.identity.requestId,
          });
          propsRef.current.onFrameResult({
            status: "completed",
            generation,
            request: latest.identity,
            frameId,
            requiredOperations: "all-completed",
          });
        } catch (error) {
          activeRef.current = false;
          reportFailure(error, "runtime", failedPass);
          await holdGroundGlassWebGpuOperationAfterFailure();
        }
      });
      operationTailRef.current = queued.then(() => undefined, () => undefined);
    };
    renderNowRef.current = renderNow;

    initialization = Promise.resolve().then(async () => {
      // StrictMode replays setup/cleanup/setup synchronously in development. Do not acquire a
      // renderer until this effect instance survives that replay.
      if (effectTokenRef.current !== effectToken || !isGenerationActive()) return;
      try {
        recordGroundGlassWebGpuAdapterAttemptForTest(generation.generationId);
        renderer = new WebGPURenderer({
          canvas,
          antialias: false,
          alpha: false,
          forceWebGL: forceGroundGlassWebGlCompatibilityBackendForTest(),
        });
        propsRef.current.onAdapterStarted(generation);
        await renderer.init();
        if (retired || !isGenerationActive()) return;

        renderer.setPixelRatio(1);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.NoToneMapping;
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = PRESENTATION_SHADOW_MAP_TYPE;
        renderer.setClearColor(SKY_COLOR, 1);

        const observed = backendObservation(renderer);
        mountedBackend = observed;
        const runtime = classifyGroundGlassWebGpuRuntime(generation, {
          rendererIsWebGpu: (renderer as WebGpuRenderer & { isWebGPURenderer?: boolean }).isWebGPURenderer === true,
          backendIsWebGpu: observed.isWebGPUBackend === true,
          backendIsWebGl: observed.isWebGLBackend === true,
        });
        runtimeRef.current = runtime;
        if (runtime.status === "mounted") {
          recordGroundGlassWebGpuTestEvent({
            kind: "runtime-observed",
            generationId: generation.generationId,
            rendererFamily: runtime.rendererFamily,
            executionApi: runtime.actualExecutionApi,
          });
        }
        setRuntimeApi(runtime.status === "mounted"
          ? runtime.actualExecutionApi === "webgpu" ? "webgpu"
            : runtime.actualExecutionApi === "webgl2" ? "webgl2" : "unknown"
          : "unknown");
        if (runtime.status !== "mounted") {
          throw new Error("Initialized renderer backend identity is unknown");
        }

        const currentRequest = requestRef.current;
        const sceneDefinition = currentRequest.scene as unknown as SceneDefinition;
        const profile = getGroundGlassSceneProfile(sceneDefinition);
        const profileContext = {
          scene: sceneDefinition,
          cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
          presentationRegion: currentRequest.presentationRegion,
        } as const;
        scene = new THREE.Scene();
        scene.background = SKY_COLOR;
        subject = profile.mountSubject(scene, profileContext);
        if (!subject) throw new Error("Registered Architecture Rise RTT subject was not created");
        setSceneSubjectEvidence({ mounted: true, childCount: subject.group.children.length });
        profile.configureRttShadowParticipation(subject.group);
        const presentation = resolveScenePresentationLighting(sceneDefinition.id, {
          surface: "ground-glass",
          cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
          presentationRegion: currentRequest.presentationRegion,
        });
        presentationLighting = createPresentationLightingRig(scene, presentation);
        const illumination = resolveSceneWorldIllumination(sceneDefinition.id);
        worldLighting = createWorldIlluminationRig(scene, illumination);
        if (illumination.environment) {
          environmentRig = createGroundGlassWorldEnvironment(scene, renderer, illumination.environment);
        }

        const dimensions = resolveGroundGlassRttDimensions({
          logicalWidth: currentRequest.widthPx,
          logicalHeight: currentRequest.heightPx,
          renderQuality: currentRequest.renderQuality,
          devicePixelRatio: 1,
        });
        target = new THREE.RenderTarget(dimensions.internalWidthPx, dimensions.internalHeightPx, {
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
          depthBuffer: true,
          stencilBuffer: false,
          samples: 0,
          generateMipmaps: false,
        });
        physicalPassEnabled =
          runtime.actualExecutionApi === "webgpu" &&
          isGroundGlassPhysicalCocResearchEnabled(currentRequest);
        if (physicalPassEnabled) {
          try {
            const depthTexture = new THREE.DepthTexture(
              dimensions.internalWidthPx,
              dimensions.internalHeightPx,
              THREE.UnsignedIntType,
            );
            depthTexture.format = THREE.DepthFormat;
            depthTexture.minFilter = THREE.NearestFilter;
            depthTexture.magFilter = THREE.NearestFilter;
            depthTexture.generateMipmaps = false;
            target.depthTexture = depthTexture;
          } catch (error) {
            physicalPassEnabled = false;
            physicalPassStatus = "unsupported";
            physicalPassUnsupportedReason = "sampleable depth attachment initialization failed: " + errorMessage(error);
          }
        }
        target.texture.colorSpace = THREE.NoColorSpace;
        target.texture.minFilter = THREE.LinearFilter;
        target.texture.magFilter = THREE.LinearFilter;
        target.texture.generateMipmaps = false;
        const cameraConfiguration = makeCamera(renderer, currentRequest, target.width, target.height);
        camera = cameraConfiguration.camera;
        cameraFrustum = cameraConfiguration.frustum;
        if (physicalPassEnabled) {
          try {
          physicalTarget = new THREE.RenderTarget(target.width, target.height, {
            format: THREE.RGBAFormat,
            type: THREE.HalfFloatType,
            depthBuffer: false,
            stencilBuffer: false,
            samples: 0,
            generateMipmaps: false,
          });
          physicalTarget.texture.colorSpace = THREE.NoColorSpace;
          physicalTarget.texture.minFilter = THREE.NearestFilter;
          physicalTarget.texture.magFilter = THREE.NearestFilter;
          physicalTarget.texture.generateMipmaps = false;
          validityTarget = new THREE.RenderTarget(target.width, target.height, {
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: false,
            stencilBuffer: false,
            samples: 0,
            generateMipmaps: false,
          });
          validityTarget.texture.colorSpace = THREE.NoColorSpace;
          validityTarget.texture.minFilter = THREE.NearestFilter;
          validityTarget.texture.magFilter = THREE.NearestFilter;
          validityTarget.texture.generateMipmaps = false;
          if (!target.depthTexture) {
            throw new Error("M4 physical CoC requires an attached sampleable scene depth texture");
          }
          const dof = createPhysicalDofState(
            currentRequest,
            camera,
            target.width,
            target.height,
          );
          physicalNodes = createGroundGlassPhysicalCocNodes({
            depthTexture: target.depthTexture,
            state: { dof },
          });
          physicalGeometry = new THREE.PlaneGeometry(2, 2);
          physicalMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
          physicalMaterial.outputNode = physicalNodes.storedFootprint;
          validityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
          validityMaterial.outputNode = vec4(physicalNodes.validityCode.div(255), 0, 0, 1);
          physicalScene = new THREE.Scene();
          validityScene = new THREE.Scene();
          const physicalMesh = new THREE.Mesh(physicalGeometry, physicalMaterial);
          const validityMesh = new THREE.Mesh(physicalGeometry, validityMaterial);
          physicalMesh.position.z = -0.5;
          validityMesh.position.z = -0.5;
          physicalScene.add(physicalMesh);
          validityScene.add(validityMesh);
          physicalCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
          physicalCamera.position.z = 0;
          physicalCamera.updateMatrixWorld();
          physicalPassStatus = "ready";
          } catch (error) {
            physicalPassEnabled = false;
            physicalPassStatus = "unsupported";
            physicalPassUnsupportedReason = "physical target or kernel initialization failed: " + errorMessage(error);
          }
        } else if (physicalPassStatus !== "unsupported") {
          physicalPassStatus = "disabled";
        }
        setCameraEvidence({
          configured: true,
          coordinateSystem: runtime.actualExecutionApi === "webgpu" ? "webgpu" : "webgl",
          frustum: cameraConfiguration.frustum,
        });
        if (!target.depthBuffer) throw new Error("Raw WebGPU render target must own an enabled depth attachment");
        setTargetDepthEnabled(true);
        setPhysicalCocDiagnostics(
          runtime.actualExecutionApi === "webgpu" &&
          (physicalPassEnabled || physicalPassStatus === "unsupported")
            ? makePhysicalCocDiagnostic({
                status: physicalPassStatus,
                request: currentRequest,
                generation,
                target,
                actualExecutionApi: runtime.actualExecutionApi,
                depthFormat: null,
                cocStorageFormat: null,
                validityStorageFormat: null,
                completedPasses: [],
                unsupportedReason: physicalPassUnsupportedReason,
              })
            : null,
        );
        display = createDisplayScene(target, currentRequest.previewMode);
        throwIfGroundGlassWebGpuFailureInjected("initialization-after-target");
        renderer.setSize(Math.max(1, currentRequest.widthPx), Math.max(1, currentRequest.heightPx), false);
        setTargetSize({ width: target.width, height: target.height });

        const details = makeDiagnosticDetails({
          request: currentRequest,
          target,
          camera: cameraConfiguration.frustum,
          subjectChildCount: subject.group.children.length,
          runtime,
          backend: observed,
          completedPasses: [],
          ...(runtime.actualExecutionApi === "webgpu" &&
          (physicalPassEnabled || physicalPassStatus === "unsupported")
            ? {
                physicalCoc: makePhysicalCocDiagnostic({
                  status: physicalPassStatus,
                  request: currentRequest,
                  generation,
                  target,
                  actualExecutionApi: runtime.actualExecutionApi,
                  depthFormat: null,
                  cocStorageFormat: null,
                  validityStorageFormat: null,
                  completedPasses: [],
                  unsupportedReason: physicalPassUnsupportedReason,
                }),
              }
            : {}),
        });
        if (retired || !isGenerationActive()) return;
        propsRef.current.onRendererMounted(generation, runtime, details);

        if (runtime.actualExecutionApi !== "webgpu") {
          throw new Error("WebGPURenderer initialized with its internal WebGL2 backend; native WebGPU is required for this pilot");
        }

        activeRef.current = true;
        readyRef.current = true;
        setReady(true);
        const device = observed.device;
        if (!device) throw new Error("Native WebGPU backend exposed no initialized GPU device");
        void device.lost?.then((info) => {
          if (!retired) reportFailure(new Error(`WebGPU device lost: ${info.message ?? info.reason ?? "unknown reason"}`), "runtime", null);
        });
      } catch (error) {
        reportFailure(error, "initialization", null);
      }
    });

    return () => {
      queueMicrotask(() => {
        const currentEffect = effectTokenRef.current;
        // A replacement setup for the same generation identifies a StrictMode replay. A new
        // generation or a real unmount must retire this effect's owned resources.
        if (currentEffect !== effectToken && currentEffect?.generationId === generation.generationId) return;
        retired = true;
        activeRef.current = false;
        void disposeOwned().catch(() => undefined);
        renderNowRef.current = null;
        if (disposeRef.current === disposeOwned) disposeRef.current = null;
      });
    };
  }, [generation, isGenerationActive]);

  useLayoutEffect(() => {
    if (!ready || !readyRef.current || !activeRef.current) return;
    const currentRequest = requestRef.current;
    // The initialized renderer and its owned target remain inside one adapter generation.
    renderNowRef.current?.(currentRequest);
  }, [latestRequestKey, ready]);

  return (
    <div
      data-testid="ground-glass-webgpu-pilot"
      data-renderer-generation={generation.generationId}
      data-frame-request-id={request.identity.requestId}
      data-frame-scene-id={request.scene.id}
      data-preview-mode={request.previewMode}
      data-mounted-renderer-family={runtimeRef.current.status === "mounted" ? runtimeRef.current.rendererFamily : undefined}
      data-actual-execution-api={runtimeApi === "unknown" ? undefined : runtimeApi}
      data-target-width={targetSize.width || undefined}
      data-target-height={targetSize.height || undefined}
      data-target-color-format={targetSize.width > 0 ? "rgba8unorm" : undefined}
      data-target-depth-enabled={targetDepthEnabled ? "true" : undefined}
      data-target-depth-format={targetDepthEnabled ? "depth24plus" : undefined}
      data-physical-coc-status={physicalCocDiagnostics?.status}
      data-physical-coc-request-id={physicalCocDiagnostics?.requestId}
      data-physical-coc-depth-format={physicalCocDiagnostics?.depthFormat ?? undefined}
      data-physical-coc-storage-format={physicalCocDiagnostics?.cocStorageFormat ?? undefined}
      data-physical-coc-validity-format={physicalCocDiagnostics?.validityStorageFormat ?? undefined}
      data-physical-coc-passes={physicalCocDiagnostics?.completedPasses.join(",")}
      data-physical-coc-probe-readback-status={physicalCocDiagnostics?.probeReadbackStatus}
      data-physical-coc-probe-count={physicalCocDiagnostics?.probeSummary?.count}
      data-physical-coc-max-world-error-mm={physicalCocDiagnostics?.probeSummary?.maximumWorldPositionErrorMm ?? undefined}
      data-physical-coc-max-kernel-coc-error-mm={physicalCocDiagnostics?.probeSummary?.maximumKernelSignedCoCErrorMm ?? undefined}
      data-physical-coc-max-storage-coc-error-mm={physicalCocDiagnostics?.probeSummary?.maximumStoredSignedCoCErrorMm ?? undefined}
      data-scene-subject-realization={sceneSubjectEvidence.mounted ? "registered-ground-glass-profile" : undefined}
      data-scene-subject-mounted={sceneSubjectEvidence.mounted ? "true" : undefined}
      data-scene-subject-child-count={sceneSubjectEvidence.mounted ? sceneSubjectEvidence.childCount : undefined}
      data-camera-configured={cameraEvidence.configured ? "true" : undefined}
      data-camera-coordinate-system={cameraEvidence.configured ? cameraEvidence.coordinateSystem : undefined}
      data-camera-left={cameraEvidence.frustum?.left}
      data-camera-right={cameraEvidence.frustum?.right}
      data-camera-top={cameraEvidence.frustum?.top}
      data-camera-bottom={cameraEvidence.frustum?.bottom}
      data-camera-near={cameraEvidence.frustum?.near}
      data-camera-far={cameraEvidence.frustum?.far}
      data-source-crop={sourceCrop ? `${sourceCrop.centerU},${sourceCrop.centerV},${sourceCrop.widthFraction},${sourceCrop.heightFraction}` : undefined}
      data-frame-ready={ready ? "true" : "false"}
      data-last-displayed-request-id={lastDisplayedRequestId ?? undefined}
      data-last-displayed-frame-id={lastDisplayedFrameId ?? undefined}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    >
      <canvas ref={canvasRef} aria-label="Raw WebGPU pilot output, no depth-of-field composite" style={{ display: "block", width: "100%", height: "100%" }} />
      <div
        aria-hidden="true"
        style={{ position: "absolute", top: 8, left: 8, padding: "4px 7px", borderRadius: 4, background: "rgba(15,23,42,.82)", color: "white", font: "600 11px/1.3 system-ui, sans-serif", pointerEvents: "none" }}
      >
        Raw WebGPU pilot · no DOF composite
      </div>
    </div>
  );
};
