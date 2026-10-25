import { useEffect, useLayoutEffect, useRef, useState } from "react";
import * as THREE from "three";
import { REVISION } from "three";
import { MeshBasicNodeMaterial, PMREMGenerator, WebGPURenderer } from "three/webgpu";
import { texture, uv, vec2 } from "three/tsl";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../scenes/presentation/understandingCameraMovements";
import { resolveSceneWorldIllumination } from "../../scenes/illumination/sceneWorldIllumination";
import type { SceneDefinition } from "../../types/scene";
import type { GroundGlassFrameRequest } from "../groundGlassFrameRequest";
import type {
  GroundGlassFrameResult,
  GroundGlassRendererGenerationIdentity,
} from "../backend/groundGlassBackendContracts";
import type {
  GroundGlassBackendDiagnosticDetails,
  GroundGlassMountedRuntimeEvidence,
} from "../backend/groundGlassBackendDiagnostics";
import type { GroundGlassCleanupOutcome } from "../groundGlassRenderHostState";
import type { GroundGlassRenderOperationId } from "../groundGlassPassGraph";
import { getGroundGlassSceneProfile } from "../groundGlassSceneProfiles";
import {
  configureGroundGlassCamera,
} from "../configureGroundGlassCamera";
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
  holdGroundGlassWebGpuOperationAfterFailure,
  holdGroundGlassWebGpuQueueCompletion,
  recordGroundGlassWebGpuAdapterAttemptForTest,
  recordGroundGlassWebGpuTestEvent,
  throwIfGroundGlassWebGpuFailureInjected,
} from "./groundGlassWebGpuTestSeam";
import {
  ARCHITECTURE_RISE_RAW_RTT_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
} from "./groundGlassRawWebGpuCompatibility";

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
      depthFormat: "depth24plus",
      textureColorSpace: "no-color-space",
      rendererOutputColorSpace: "srgb",
      toneMapping: "none",
    },
    completedPasses: input.completedPasses,
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
          propsRef.current.onBackendDetails(makeDiagnosticDetails({
            request: latest,
            target,
            camera: cameraFrustum,
            subjectChildCount: subject.group.children.length,
            runtime,
            backend: mountedBackend,
            completedPasses,
          }));
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
        renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
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
          generateMipmaps: false,
        });
        target.texture.colorSpace = THREE.NoColorSpace;
        target.texture.minFilter = THREE.LinearFilter;
        target.texture.magFilter = THREE.LinearFilter;
        target.texture.generateMipmaps = false;
        const cameraConfiguration = makeCamera(renderer, currentRequest, target.width, target.height);
        camera = cameraConfiguration.camera;
        cameraFrustum = cameraConfiguration.frustum;
        setCameraEvidence({
          configured: true,
          coordinateSystem: runtime.actualExecutionApi === "webgpu" ? "webgpu" : "webgl",
          frustum: cameraConfiguration.frustum,
        });
        if (!target.depthBuffer) throw new Error("Raw WebGPU render target must own an enabled depth attachment");
        setTargetDepthEnabled(true);
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
