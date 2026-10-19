/* eslint-disable react-refresh/only-export-components */
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import * as THREE from "three";
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu";
import { texture, uv, vec2 } from "three/tsl";
import { deriveOpticsState } from "../../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../../scenes/definitions/architecture-rise";
import {
  DEFAULT_CAMERA_STATE,
} from "../../../utils/constants";
import {
  configureGroundGlassCamera,
} from "../../../render/configureGroundGlassCamera";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  mapGroundGlassInspectionWindowToRttSourceCrop,
  resolveGroundGlassInspectionWindow,
  resolveSampledFilmDimensionsMm,
  type GroundGlassInspectionWindow,
} from "../../../render/groundGlassInspectionWindow";
import {
  resolveGroundGlassRttDisplayTransform,
} from "../../../render/groundGlassRttOrientation";
import {
  getGroundGlassClipRangeWorld,
} from "../../../render/groundGlassRttScenes";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "../../../render/sceneSubjectRegistry";
import {
  createPresentationLightingRig,
  disposePresentationLightingRig,
} from "../../../render/TeachingLighting";
import {
  resolvePresentationLightingPlacement,
} from "../../../render/presentationLighting";
import {
  TEACHING_PRESENTATION_LIGHTING_PROFILE,
} from "../../../render/presentationLightingContract";
import {
  createWorldIlluminationRig,
  disposeWorldIlluminationRig,
} from "../../../render/worldIlluminationRig";
import {
  createObserverWorldEnvironmentRig,
} from "../../../render/observerWorldEnvironmentRig";
import {
  disposeWorldEnvironmentRig,
  type WorldEnvironmentRig,
} from "../../../render/worldEnvironmentRig";
import {
  resolveSceneWorldIllumination,
} from "../../../scenes/illumination/sceneWorldIllumination";
import { CAMERA_CONSTANTS } from "../../../utils/constants";
import {
  resolveObserverRendererRuntime,
} from "../../../render/backend/observerVisualPipelineCapabilities";
import type { DerivedOpticsState } from "../../../types/optics";
import "./ground-glass-webgpu-raw-rtt.css";

const FIXTURE_SIZE = { width: 320, height: 256 };
const RESIZED_FIXTURE_SIZE = { width: 400, height: 320 };
const TARGET_SCENE_ID = "architecture-rise";

type BackendKind = "webgl-reference" | "webgpu-candidate";
type PreviewMode = "raw" | "upright";
type CropChoice = "full" | "center-4x" | "off-center-4x";
type FixtureFailure = "after-target-allocation" | "texture-display";
type RenderTargetLike = THREE.WebGLRenderTarget | THREE.RenderTarget;
type RendererLike = THREE.WebGLRenderer | InstanceType<typeof WebGPURenderer>;

type RenderEvidence = {
  targetWidth: number;
  targetHeight: number;
  targetReadback: {
    sampleCount: number;
    luminanceRange: number;
    contentfulSampleCount: number;
  } | null;
  sceneRenderCount: number;
  displayRenderCount: number;
  failedPass: string | null;
  lastError: string | null;
  resizeCount: number;
  targetResizeDisposeEvents: number;
  targetDisposeEvents: number;
  subjectDisposeCount: number;
  staleReadbacksDiscarded: number;
  outputColorSpace: string;
  toneMapping: string;
  inspectionWindow: GroundGlassInspectionWindow | null;
  sourceCropWindow: GroundGlassInspectionWindow | null;
  sampledFilmWidthMm: number;
  sampledFilmHeightMm: number;
  cameraFrustum: { left: number; right: number; top: number; bottom: number } | null;
};

type RuntimeEvidence = {
  rendererFamily: string;
  executionBackend: string;
  applicationFallback: boolean;
  initialized: boolean;
  targetKind: string;
  targetTextureUuid: string;
};

type ExperimentHandle = {
  kind: BackendKind;
  mountGeneration: number;
  instanceId: string;
  runtime: RuntimeEvidence;
  render: (
    mode: PreviewMode,
    crop: CropChoice,
    failDisplay?: boolean,
    options?: { holdAfterReadbackStarts?: Promise<void> },
  ) => Promise<RenderEvidence>;
  resize: (width: number, height: number) => Promise<RenderEvidence>;
  getEvidence: () => RenderEvidence;
  dispose: () => Promise<void>;
};

type AdapterProbe = {
  available: boolean;
  apiAvailable: boolean;
  error: string | null;
};

type ResourceRole =
  | "renderer"
  | "target"
  | "registeredSubject"
  | "presentationLighting"
  | "worldLighting"
  | "environmentRig"
  | "displayMaterial"
  | "displayGeometry";

type ResourceLifecycleEvidence = {
  role: ResourceRole;
  resourceId: string;
  allocated: boolean;
  disposalRequested: boolean;
  disposalRequestCount: number;
  disposalCompleted: boolean;
  disposalCompletionCount: number;
  disposalFailed: string | null;
  disposeEventObserved?: boolean;
  disposeEventCount: number;
};

type OperationLifecycleEvidence = {
  operationId: string;
  kind: "render" | "resize";
  state: "queued" | "running" | "completed" | "failed" | "retired";
  stage: string;
  error: string | null;
};

type HandleLifecycleEvidence = {
  backendKind: BackendKind;
  mountGeneration: number;
  instanceId: string;
  state: "initializing" | "active" | "retiring" | "disposed" | "failed";
  runtime: RuntimeEvidence | null;
  resources: ResourceLifecycleEvidence[];
  operations: OperationLifecycleEvidence[];
  failedInitialization: boolean;
  cleanupStartedAt: number | null;
  cleanupCompletedAt: number | null;
  cleanupError: string | null;
};

type LifecycleStore = {
  nextMountGeneration: number;
  nextInstanceId: number;
  handles: HandleLifecycleEvidence[];
};

type WindowWithEvidence = Window & {
  __groundGlassWebGpuRawRttLifecycle?: LifecycleStore;
};

const LIFECYCLE_CHANGE_EVENT = "ground-glass-webgpu-lifecycle-change";
const lifecycleStore = (window as WindowWithEvidence).__groundGlassWebGpuRawRttLifecycle ??= {
  nextMountGeneration: 1,
  nextInstanceId: 1,
  handles: [],
};

const signalLifecycleChange = () => {
  window.dispatchEvent(new Event(LIFECYCLE_CHANGE_EVENT));
};

const allocateMountGeneration = () => lifecycleStore.nextMountGeneration++;

const pendingReadbackReleases = new Map<string, () => void>();

const releasePendingReadbacks = () => {
  for (const release of pendingReadbackReleases.values()) release();
};

const createDeferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

const createLifecycleRecord = (kind: BackendKind, mountGeneration: number): HandleLifecycleEvidence => {
  const instanceId = `${kind}-g${mountGeneration}-i${lifecycleStore.nextInstanceId++}`;
  const record: HandleLifecycleEvidence = {
    backendKind: kind,
    mountGeneration,
    instanceId,
    state: "initializing",
    runtime: null,
    resources: [],
    operations: [],
    failedInitialization: false,
    cleanupStartedAt: null,
    cleanupCompletedAt: null,
    cleanupError: null,
  };
  lifecycleStore.handles.push(record);
  signalLifecycleChange();
  return record;
};

const allocateLifecycleResource = (
  record: HandleLifecycleEvidence,
  role: ResourceRole,
  resourceId: string,
): ResourceLifecycleEvidence => {
  const resource: ResourceLifecycleEvidence = {
    role,
    resourceId,
    allocated: true,
    disposalRequested: false,
    disposalRequestCount: 0,
    disposalCompleted: false,
    disposalCompletionCount: 0,
    disposalFailed: null,
    disposeEventCount: 0,
  };
  record.resources.push(resource);
  signalLifecycleChange();
  return resource;
};

const disposeLifecycleResource = async (
  resource: ResourceLifecycleEvidence | null,
  dispose: () => void | Promise<void>,
  errors: unknown[],
): Promise<void> => {
  if (!resource || resource.disposalRequested) return;
  resource.disposalRequested = true;
  resource.disposalRequestCount += 1;
  signalLifecycleChange();
  try {
    await dispose();
    resource.disposalCompleted = true;
    resource.disposalCompletionCount += 1;
  } catch (error) {
    resource.disposalFailed = error instanceof Error ? error.message : String(error);
    errors.push(error);
  }
  signalLifecycleChange();
};

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);

const getAdapterProbe = async (): Promise<AdapterProbe> => {
  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter: () => Promise<unknown | null> };
  }).gpu;
  if (!gpu) return { available: false, apiAvailable: false, error: null };
  try {
    return {
      available: (await gpu.requestAdapter()) !== null,
      apiAvailable: true,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      apiAvailable: true,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const makeCameraState = () => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: TARGET_SCENE_ID,
  activeTaskId: null,
  mode: "free" as const,
  // A reachable teaching-control value gives this fixture a genuinely shifted
  // canonical film projection without changing the scene or optics formulas.
  frontRiseMm: 20,
});

const resolveCameraInput = () => {
  const camera = makeCameraState();
  return {
    sceneId: TARGET_SCENE_ID,
    focalLengthMm: camera.focalLengthMm,
    focusDistanceMm: camera.focusDistanceMm,
    aperture: camera.aperture,
    frontRiseMm: camera.frontRiseMm,
    filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
    filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
  };
};

const resolveInspectionWindow = (crop: CropChoice): GroundGlassInspectionWindow => {
  if (crop === "full") return FULL_GROUND_GLASS_INSPECTION_WINDOW;
  return resolveGroundGlassInspectionWindow({
    active: true,
    magnification: 4,
    normalizedPan: crop === "center-4x"
      ? { x: 0, y: 0 }
      : { x: -0.55, y: 0.35 },
  });
};

const resolveCamera = (
  renderer: RendererLike,
  opticsState: DerivedOpticsState,
  inspectionWindow: GroundGlassInspectionWindow,
  mode: PreviewMode,
): {
  camera: THREE.PerspectiveCamera;
  frustum: { left: number; right: number; top: number; bottom: number };
  sourceCrop: GroundGlassInspectionWindow;
} => {
  const registration = getSceneSubjectRegistration(TARGET_SCENE_ID);
  const sceneBounds = registration?.rttBounds ?? architectureRiseScene.bounds;
  const effectiveScene = { ...architectureRiseScene, bounds: sceneBounds };
  const preliminary = getGroundGlassClipRangeWorld(effectiveScene, opticsState.lensCenterWorld);
  const camera = new THREE.PerspectiveCamera(
    45,
    FIXTURE_SIZE.width / FIXTURE_SIZE.height,
    preliminary.near,
    preliminary.far,
  );
  // Three r186 updates a camera's projection when renderer and camera
  // coordinate systems differ. The production helper supplies the physical
  // off-axis frustum, so preserve those extents and adapt only clip-space Z.
  camera.coordinateSystem = renderer.coordinateSystem;
  const sourceCrop = mapGroundGlassInspectionWindowToRttSourceCrop(
    inspectionWindow,
    mode,
  );
  const first = configureGroundGlassCamera(
    camera,
    opticsState,
    preliminary.near,
    preliminary.far,
    sourceCrop,
  );
  if (!first.ok) throw new Error("Ground Glass camera configuration failed: " + first.reason);

  const finalClip = getGroundGlassClipRangeWorld(
    effectiveScene,
    opticsState.lensCenterWorld,
    {
      x: first.pose.forwardWorld[0],
      y: first.pose.forwardWorld[1],
      z: first.pose.forwardWorld[2],
    },
  );
  camera.near = finalClip.near;
  camera.far = finalClip.far;
  const configured = configureGroundGlassCamera(
    camera,
    opticsState,
    finalClip.near,
    finalClip.far,
    sourceCrop,
  );
  if (!configured.ok) throw new Error("Ground Glass camera configuration failed: " + configured.reason);
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
  return {
    camera,
    sourceCrop,
    frustum: {
      left: configured.left,
      right: configured.right,
      top: configured.top,
      bottom: configured.bottom,
    },
  };
};

const readbackSummary = (pixels: ArrayLike<number>): RenderEvidence["targetReadback"] => {
  const sampleStride = Math.max(4, Math.floor(pixels.length / 2048 / 4) * 4);
  const luminances: number[] = [];
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let contentfulSampleCount = 0;
  for (let index = 0; index + 2 < pixels.length; index += sampleStride) {
    const red = pixels[index] ?? 0;
    const green = pixels[index + 1] ?? 0;
    const blue = pixels[index + 2] ?? 0;
    const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
    luminances.push(luminance);
    min = Math.min(min, luminance);
    max = Math.max(max, luminance);
  }
  const baseline = luminances[0] ?? 0;
  for (const luminance of luminances) {
    if (Math.abs(luminance - baseline) > 10) contentfulSampleCount += 1;
  }
  return {
    sampleCount: luminances.length,
    luminanceRange: Number.isFinite(min) && Number.isFinite(max) ? max - min : 0,
    contentfulSampleCount,
  };
};

const createDisplayOperation = (
  kind: BackendKind,
  target: RenderTargetLike,
  mode: PreviewMode,
): { scene: THREE.Scene; camera: THREE.OrthographicCamera; geometry: THREE.PlaneGeometry; material: THREE.Material } => {
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 0;
  camera.updateMatrixWorld();
  const transform = resolveGroundGlassRttDisplayTransform(mode);
  const material: THREE.Material = kind === "webgpu-candidate"
    ? new MeshBasicNodeMaterial({ toneMapped: false })
    : new THREE.MeshBasicMaterial({ map: target.texture, toneMapped: false });
  if (kind === "webgpu-candidate") {
    const coordinates = uv();
    const sampleU = transform.flipDisplayX ? coordinates.x.oneMinus() : coordinates.x;
    // A WebGPU render-target view uses a top-origin texture Y axis. Convert it
    // to the shared display sampling convention before applying Raw/Upright.
    const sampleV = transform.flipDisplayY ? coordinates.y : coordinates.y.oneMinus();
    (material as MeshBasicNodeMaterial).colorNode = texture(
      target.texture,
      vec2(sampleU, sampleV),
    );
  } else {
    const textureMap = target.texture;
    textureMap.repeat.set(
      transform.flipDisplayX ? -1 : 1,
      transform.flipDisplayY ? -1 : 1,
    );
    textureMap.offset.set(
      transform.flipDisplayX ? 1 : 0,
      transform.flipDisplayY ? 1 : 0,
    );
    textureMap.updateMatrix();
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -0.5;
  scene.add(mesh);
  return { scene, camera, geometry, material };
};

const renderTargetReadback = async (
  kind: BackendKind,
  renderer: RendererLike,
  target: RenderTargetLike,
): Promise<RenderEvidence["targetReadback"]> => {
  const width = target.width;
  const height = target.height;
  if (kind === "webgpu-candidate") {
    const pixels = await (renderer as InstanceType<typeof WebGPURenderer>)
      .readRenderTargetPixelsAsync(target, 0, 0, width, height);
    return readbackSummary(pixels);
  }
  const pixels = new Uint8Array(width * height * 4);
  (renderer as THREE.WebGLRenderer).readRenderTargetPixels(
    target as THREE.WebGLRenderTarget,
    0,
    0,
    width,
    height,
    pixels,
  );
  return readbackSummary(pixels);
};

const createExperimentHandle = async (input: {
  kind: BackendKind;
  mountGeneration: number;
  canvas: HTMLCanvasElement;
  isCurrent: () => boolean;
  failure?: FixtureFailure;
}): Promise<ExperimentHandle> => {
  const { kind, mountGeneration, canvas, isCurrent, failure } = input;
  const lifecycle = createLifecycleRecord(kind, mountGeneration);
  const instanceId = lifecycle.instanceId;
  const cameraState = makeCameraState();
  const opticsState = deriveOpticsState(cameraState, architectureRiseScene);
  let renderer: RendererLike | null = null;
  let target: RenderTargetLike | null = null;
  let scene: THREE.Scene | null = null;
  let display: ReturnType<typeof createDisplayOperation> | null = null;
  const displayResources: Array<{
    display: ReturnType<typeof createDisplayOperation>;
    material: ResourceLifecycleEvidence;
    geometry: ResourceLifecycleEvidence;
  }> = [];
  let subject: THREE.Group | null = null;
  let presentationLighting: ReturnType<typeof createPresentationLightingRig> | null = null;
  let worldLighting: ReturnType<typeof createWorldIlluminationRig> | null = null;
  let environment: WorldEnvironmentRig | null = null;
  let retired = false;
  let disposePromise: Promise<void> | null = null;
  let operationTail: Promise<void> = Promise.resolve();
  let operationSequence = 0;
  let targetDisposalInProgress = false;
  let rendererResource: ResourceLifecycleEvidence | null = null;
  let targetResource: ResourceLifecycleEvidence | null = null;
  let subjectResource: ResourceLifecycleEvidence | null = null;
  let presentationResource: ResourceLifecycleEvidence | null = null;
  let worldLightingResource: ResourceLifecycleEvidence | null = null;
  let environmentResource: ResourceLifecycleEvidence | null = null;
  let targetDisposeEvents = 0;
  let targetResizeDisposeEvents = 0;
  let resizeCount = 0;
  let sceneRenderCount = 0;
  let displayRenderCount = 0;
  let staleReadbacksDiscarded = 0;
  let currentInspectionWindow: GroundGlassInspectionWindow | null = null;
  let currentSourceCropWindow: GroundGlassInspectionWindow | null = null;
  let currentCameraFrustum: RenderEvidence["cameraFrustum"] = null;
  let failedPass: string | null = null;
  let lastError: string | null = null;
  let latestReadback: RenderEvidence["targetReadback"] = null;
  let runtimeEvidence: RuntimeEvidence = {
    rendererFamily: "unknown",
    executionBackend: "unknown",
    applicationFallback: false,
    initialized: false,
    targetKind: "unallocated",
    targetTextureUuid: "unallocated",
  };

  const recordDisplay = (value: ReturnType<typeof createDisplayOperation>) => {
    const resources = {
      display: value,
      material: allocateLifecycleResource(lifecycle, "displayMaterial", value.material.uuid),
      geometry: allocateLifecycleResource(lifecycle, "displayGeometry", value.geometry.uuid),
    };
    displayResources.push(resources);
    return resources;
  };

  const releaseDisplay = async (
    resources: (typeof displayResources)[number],
    errors: unknown[],
  ) => {
    try {
      resources.display.scene.clear();
    } catch (error) {
      errors.push(error);
    }
    await disposeLifecycleResource(resources.material, () => resources.display.material.dispose(), errors);
    await disposeLifecycleResource(resources.geometry, () => resources.display.geometry.dispose(), errors);
  };

  const evidence = (): RenderEvidence => ({
    targetWidth: target?.width ?? 0,
    targetHeight: target?.height ?? 0,
    targetReadback: latestReadback,
    sceneRenderCount,
    displayRenderCount,
    failedPass,
    lastError,
    resizeCount,
    targetResizeDisposeEvents,
    targetDisposeEvents,
    subjectDisposeCount: subjectResource?.disposalCompleted ? 1 : 0,
    staleReadbacksDiscarded,
    outputColorSpace: renderer?.outputColorSpace ?? "unavailable",
    toneMapping: renderer ? String(renderer.toneMapping) : "unavailable",
    inspectionWindow: currentInspectionWindow,
    sourceCropWindow: currentSourceCropWindow,
    sampledFilmWidthMm: currentInspectionWindow
      ? resolveSampledFilmDimensionsMm({
          filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
          filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
          inspectionWindow: currentInspectionWindow,
        }).widthMm
      : CAMERA_CONSTANTS.filmWidthMm,
    sampledFilmHeightMm: currentInspectionWindow
      ? resolveSampledFilmDimensionsMm({
          filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
          filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
          inspectionWindow: currentInspectionWindow,
        }).heightMm
      : CAMERA_CONSTANTS.filmHeightMm,
    cameraFrustum: currentCameraFrustum,
  });

  const disposeOwned = (): Promise<void> => {
    if (disposePromise) return disposePromise;
    retired = true;
    lifecycle.state = "retiring";
    lifecycle.cleanupStartedAt = Date.now();
    signalLifecycleChange();
    disposePromise = (async () => {
      const errors: unknown[] = [];
      await operationTail;
      for (const resources of [...displayResources].reverse()) {
        await releaseDisplay(resources, errors);
      }
      display = null;
      await disposeLifecycleResource(targetResource, () => {
        if (!target) return;
        targetDisposalInProgress = true;
        try {
          target.dispose();
        } finally {
          targetDisposalInProgress = false;
          target = null;
        }
      }, errors);
      await disposeLifecycleResource(subjectResource, () => {
        if (subject && scene) {
          scene.remove(subject);
          disposeRegisteredRttSubject(TARGET_SCENE_ID, subject);
          subject = null;
        }
      }, errors);
      await disposeLifecycleResource(environmentResource, () => {
        if (environment && scene) {
          disposeWorldEnvironmentRig(scene, environment);
          environment = null;
        }
      }, errors);
      await disposeLifecycleResource(worldLightingResource, () => {
        if (worldLighting && scene) {
          disposeWorldIlluminationRig(scene, worldLighting);
          worldLighting = null;
        }
      }, errors);
      await disposeLifecycleResource(presentationResource, () => {
        if (presentationLighting && scene) {
          disposePresentationLightingRig(scene, presentationLighting);
          presentationLighting = null;
        }
      }, errors);
      try {
        scene?.clear();
      } catch (error) {
        errors.push(error);
      }
      await disposeLifecycleResource(rendererResource, async () => {
        if (renderer) {
          await renderer.dispose();
          renderer = null;
        }
      }, errors);
      lifecycle.cleanupCompletedAt = Date.now();
      lifecycle.cleanupError = errors.length ? errors.map(errorMessage).join("; ") : null;
      lifecycle.state = errors.length ? "failed" : lifecycle.failedInitialization ? "failed" : "disposed";
      signalLifecycleChange();
      if (errors.length) throw new AggregateError(errors, "One or more owned fixture resources failed to dispose");
    })();
    return disposePromise;
  };

  const enqueueOperation = <T,>(
    kind: OperationLifecycleEvidence["kind"],
    run: (operation: OperationLifecycleEvidence) => Promise<T>,
  ): Promise<T> => {
    if (retired) return Promise.reject(new Error("Experiment handle is retired"));
    const operation: OperationLifecycleEvidence = {
      operationId: `${instanceId}-op${++operationSequence}`,
      kind,
      state: "queued",
      stage: "queued",
      error: null,
    };
    lifecycle.operations.push(operation);
    signalLifecycleChange();
    const result = operationTail.then(async () => {
      if (retired) {
        operation.state = "retired";
        operation.stage = "retired-before-start";
        signalLifecycleChange();
        throw new Error("Experiment operation was retired before execution");
      }
      operation.state = "running";
      operation.stage = "starting";
      signalLifecycleChange();
      try {
        const value = await run(operation);
        if (operation.state === "running") {
          operation.state = retired ? "retired" : "completed";
          operation.stage = retired ? "retired" : "completed";
        }
        signalLifecycleChange();
        return value;
      } catch (error) {
        if (operation.state === "running") operation.state = retired ? "retired" : "failed";
        operation.stage = operation.state;
        operation.error = errorMessage(error);
        signalLifecycleChange();
        throw error;
      }
    });
    operationTail = result.then(() => undefined, () => undefined);
    return result;
  };

  const renderNow = async (
    mode: PreviewMode,
    crop: CropChoice,
    failDisplay: boolean,
    operation: OperationLifecycleEvidence,
    holdAfterReadbackStarts?: Promise<void>,
  ): Promise<RenderEvidence> => {
    if (retired || !renderer || !target || !scene || !subject || !display) {
      throw new Error("Experiment resources are not mounted");
    }
    failedPass = null;
    lastError = null;
    const inspectionWindow = resolveInspectionWindow(crop);
    currentInspectionWindow = inspectionWindow;
    const configuredCamera = resolveCamera(renderer, opticsState, inspectionWindow, mode);
    currentSourceCropWindow = configuredCamera.sourceCrop;
    currentCameraFrustum = configuredCamera.frustum;
    const previousTarget = renderer.getRenderTarget() as RenderTargetLike | null;
    let targetBindingAttempted = false;
    let primaryFailure: unknown;
    try {
      failedPass = "sceneRender";
      targetBindingAttempted = true;
      if (kind === "webgl-reference") {
        (renderer as THREE.WebGLRenderer).setRenderTarget(target as THREE.WebGLRenderTarget);
      } else {
        (renderer as InstanceType<typeof WebGPURenderer>).setRenderTarget(target);
      }
      renderer.clear(true, true, true);
      renderer.render(scene, configuredCamera.camera);
      sceneRenderCount += 1;
      const readbackResult = renderTargetReadback(kind, renderer, target).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      operation.stage = "readback-in-flight";
      signalLifecycleChange();
      if (holdAfterReadbackStarts) await holdAfterReadbackStarts;
      const settledReadback = await readbackResult;
      if ("error" in settledReadback) throw settledReadback.error;
      latestReadback = settledReadback.value;
    } catch (error) {
      primaryFailure = error;
    }
    if (targetBindingAttempted) {
      try {
        if (kind === "webgl-reference") {
          (renderer as THREE.WebGLRenderer).setRenderTarget(
            previousTarget as THREE.WebGLRenderTarget | null,
          );
        } else {
          (renderer as InstanceType<typeof WebGPURenderer>).setRenderTarget(previousTarget);
        }
      } catch (cleanupError) {
        primaryFailure ??= cleanupError;
        lastError = "Render-target restoration failed: " + errorMessage(cleanupError);
      }
    }
    if (primaryFailure !== undefined) {
      failedPass = failedPass ?? "sceneRender";
      lastError ??= errorMessage(primaryFailure);
      throw primaryFailure;
    }
    if (retired || !isCurrent()) {
      staleReadbacksDiscarded += 1;
      operation.state = "retired";
      operation.stage = "stale-readback-discarded";
      signalLifecycleChange();
      return evidence();
    }
    failedPass = "textureDisplay";
    if (failDisplay) throw new Error("Injected texture-display operation failure");
    const replacement = createDisplayOperation(kind, target, mode);
    recordDisplay(replacement);
    const currentResources = displayResources.find((resources) => resources.display === display);
    if (currentResources) {
      const releaseErrors: unknown[] = [];
      await releaseDisplay(currentResources, releaseErrors);
      if (releaseErrors.length) throw releaseErrors[0];
    }
    display = replacement;
    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    renderer.render(display.scene, display.camera);
    displayRenderCount += 1;
    failedPass = null;
    operation.stage = "display-completed";
    signalLifecycleChange();
    return evidence();
  };

  try {
    if (kind === "webgpu-candidate") {
      renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
      rendererResource = allocateLifecycleResource(lifecycle, "renderer", `${instanceId}:renderer`);
      await (renderer as InstanceType<typeof WebGPURenderer>).init();
    } else {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
      rendererResource = allocateLifecycleResource(lifecycle, "renderer", `${instanceId}:renderer`);
    }
    if (!isCurrent()) {
      await disposeOwned();
      throw new Error("Experiment initialization was cancelled by unmount");
    }
    renderer.setPixelRatio(1);
    renderer.setSize(FIXTURE_SIZE.width, FIXTURE_SIZE.height, true);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const runtime = resolveObserverRendererRuntime(renderer);
    runtimeEvidence = {
      ...runtime,
      applicationFallback: false,
      initialized: true,
      targetKind: kind === "webgpu-candidate" ? "THREE.RenderTarget" : "THREE.WebGLRenderTarget",
      targetTextureUuid: "pending",
    };
    lifecycle.runtime = runtimeEvidence;
    signalLifecycleChange();

    scene = new THREE.Scene();
    scene.background = new THREE.Color("#dfe5ec");
    subject = createRegisteredRttSubject(TARGET_SCENE_ID);
    if (!subject) throw new Error("Registered Architecture Rise RTT subject was not created");
    subjectResource = allocateLifecycleResource(lifecycle, "registeredSubject", subject.uuid);
    scene.add(subject);
    const registration = getSceneSubjectRegistration(TARGET_SCENE_ID);
    presentationLighting = createPresentationLightingRig(scene, {
      profile: TEACHING_PRESENTATION_LIGHTING_PROFILE,
      placement: resolvePresentationLightingPlacement(registration?.presentationLighting),
    });
    presentationResource = allocateLifecycleResource(
      lifecycle,
      "presentationLighting",
      `${instanceId}:presentation-lighting`,
    );
    const illumination = resolveSceneWorldIllumination(TARGET_SCENE_ID);
    worldLighting = createWorldIlluminationRig(scene, illumination);
    worldLightingResource = allocateLifecycleResource(
      lifecycle,
      "worldLighting",
      `${instanceId}:world-lighting`,
    );
    if (illumination.environment) {
      const resolvedEnvironment = await createObserverWorldEnvironmentRig(
        scene,
        renderer,
        illumination.environment,
        isCurrent,
      );
      if (resolvedEnvironment && "then" in resolvedEnvironment) {
        environment = await resolvedEnvironment;
      } else {
        environment = resolvedEnvironment;
      }
      if (environment) {
        environmentResource = allocateLifecycleResource(
          lifecycle,
          "environmentRig",
          `${instanceId}:environment-rig`,
        );
      }
    }
    if (!isCurrent()) {
      await disposeOwned();
      throw new Error("Experiment initialization was cancelled by unmount");
    }
    target = kind === "webgpu-candidate"
      ? new THREE.RenderTarget(FIXTURE_SIZE.width, FIXTURE_SIZE.height, {
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
          depthBuffer: true,
          stencilBuffer: false,
          generateMipmaps: false,
        })
      : new THREE.WebGLRenderTarget(FIXTURE_SIZE.width, FIXTURE_SIZE.height, {
          format: THREE.RGBAFormat,
          type: THREE.UnsignedByteType,
          depthBuffer: true,
          stencilBuffer: false,
          generateMipmaps: false,
        });
    targetResource = allocateLifecycleResource(lifecycle, "target", target.texture.uuid);
    target.addEventListener("dispose", () => {
      targetDisposeEvents += 1;
      if (targetDisposalInProgress && targetResource) {
        targetResource.disposeEventObserved = true;
        targetResource.disposeEventCount += 1;
      }
    });
    runtimeEvidence = {
      ...runtimeEvidence,
      targetTextureUuid: target.texture.uuid,
    };
    lifecycle.runtime = runtimeEvidence;
    signalLifecycleChange();
    if (failure === "after-target-allocation") {
      throw new Error("Injected partial initialization failure after target allocation");
    }
    display = createDisplayOperation(kind, target, "raw");
    recordDisplay(display);
    const handle: ExperimentHandle = {
      kind,
      mountGeneration,
      instanceId,
      runtime: runtimeEvidence,
      getEvidence: evidence,
      render: (mode, crop, failDisplay = false, options) => enqueueOperation(
        "render",
        (operation) => renderNow(mode, crop, failDisplay, operation, options?.holdAfterReadbackStarts),
      ).catch((error: unknown) => {
        lastError = errorMessage(error);
        throw error;
      }),
      resize: (width, height) => enqueueOperation("resize", async (operation) => {
        if (retired || !renderer || !target) throw new Error("Experiment resources are not mounted");
        const beforeTextureUuid = target.texture.uuid;
        const disposalCountBeforeResize = targetDisposeEvents;
        target.setSize(width, height);
        renderer.setSize(width, height, true);
        resizeCount += 1;
        targetResizeDisposeEvents += targetDisposeEvents - disposalCountBeforeResize;
        if (target.texture.uuid !== beforeTextureUuid) {
          throw new Error("RenderTarget.setSize unexpectedly replaced its owned texture");
        }
        return renderNow("raw", "full", false, operation);
      }),
      dispose: disposeOwned,
    };
    lifecycle.state = "active";
    signalLifecycleChange();
    return handle;
  } catch (error) {
    lifecycle.failedInitialization = true;
    lifecycle.state = "retiring";
    signalLifecycleChange();
    try {
      await disposeOwned();
    } catch (cleanupError) {
      lastError = "Initialization failure: " + (
        errorMessage(error)
      ) + "; cleanup failure: " + (
        errorMessage(cleanupError)
      );
      lifecycle.state = "failed";
      signalLifecycleChange();
      throw error;
    }
    lifecycle.state = "failed";
    signalLifecycleChange();
    throw error;
  }
};

type HandleStatus = {
  runtime: RuntimeEvidence | null;
  render: RenderEvidence | null;
  error: string | null;
};

type FixtureDiagnostic = {
  status: "starting" | "ready" | "failed" | "disposed";
  generation: number;
  mode: PreviewMode;
  crop: CropChoice;
  adapter: AdapterProbe;
  browser: { userAgent: string; platform: string; threeRevision: string };
  cameraInput: ReturnType<typeof resolveCameraInput>;
  webgl: HandleStatus;
  webgpu: HandleStatus;
  lifecycle: { handles: HandleLifecycleEvidence[] };
  lastAction: string;
};

const initialHandleStatus = (): HandleStatus => ({
  runtime: null,
  render: null,
  error: null,
});

const createInitialDiagnostic = (generation: number): FixtureDiagnostic => ({
  status: "starting",
  generation,
  mode: "raw",
  crop: "full",
  adapter: { available: false, apiAvailable: false, error: null },
  browser: {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    threeRevision: THREE.REVISION,
  },
  cameraInput: resolveCameraInput(),
  webgl: initialHandleStatus(),
  webgpu: initialHandleStatus(),
  lifecycle: { handles: lifecycleStore.handles },
  lastAction: "mount",
});

const Fixture = ({
  onDiagnosticChange,
}: {
  onDiagnosticChange: (diagnostic: FixtureDiagnostic) => void;
}) => {
  const webglCanvasRef = useRef<HTMLCanvasElement>(null);
  const webgpuCanvasRef = useRef<HTMLCanvasElement>(null);
  const handlesRef = useRef<Partial<Record<BackendKind, ExperimentHandle>>>({});
  const [generation, setGeneration] = useState(allocateMountGeneration);
  const [resized, setResized] = useState(false);
  const [mode, setMode] = useState<PreviewMode>("raw");
  const [crop, setCrop] = useState<CropChoice>("full");
  const [diagnostic, setDiagnostic] = useState(() => createInitialDiagnostic(generation));
  const diagnosticRef = useRef(diagnostic);
  const activeRoute = useRef(true);
  const publish = useCallback((update: Partial<FixtureDiagnostic>) => {
    const next = {
      ...diagnosticRef.current,
      ...update,
      generation,
      lifecycle: { handles: lifecycleStore.handles },
    };
    diagnosticRef.current = next;
    setDiagnostic(next);
    onDiagnosticChange(next);
  }, [generation, onDiagnosticChange]);
  const failure = new URLSearchParams(window.location.search).get("fixtureFailure") as FixtureFailure | null;

  useEffect(() => {
    let active = true;
    activeRoute.current = true;
    handlesRef.current = {};
    const publishIfCurrent = (update: Partial<FixtureDiagnostic>) => {
      if (active) publish(update);
    };
    publishIfCurrent({
      status: "starting",
      generation,
      webgl: initialHandleStatus(),
      webgpu: initialHandleStatus(),
      lastAction: "mount",
    });

    const run = async () => {
      const adapter = await getAdapterProbe();
      publishIfCurrent({ adapter });
      const webglCanvas = webglCanvasRef.current;
      const webgpuCanvas = webgpuCanvasRef.current;
      if (!webglCanvas || !webgpuCanvas) throw new Error("Fixture canvases did not mount");

      try {
        const webgl = await createExperimentHandle({
          kind: "webgl-reference",
          mountGeneration: generation,
          canvas: webglCanvas,
          isCurrent: () => active,
        });
        if (!active) {
          await webgl.dispose();
          return;
        }
        handlesRef.current["webgl-reference"] = webgl;
        publishIfCurrent({ webgl: { runtime: webgl.runtime, render: webgl.getEvidence(), error: null } });
      } catch (error) {
        publishIfCurrent({ webgl: { runtime: null, render: null, error: errorMessage(error) } });
      }

      try {
        const webgpu = await createExperimentHandle({
          kind: "webgpu-candidate",
          mountGeneration: generation,
          canvas: webgpuCanvas,
          isCurrent: () => active,
          failure: failure ?? undefined,
        });
        if (!active) {
          await webgpu.dispose();
          return;
        }
        handlesRef.current["webgpu-candidate"] = webgpu;
        const failedDisplay = failure === "texture-display";
        let webgpuResult: RenderEvidence;
        let webgpuRenderError: string | null = null;
        try {
          webgpuResult = await webgpu.render("raw", "full", failedDisplay);
        } catch (error) {
          webgpuResult = webgpu.getEvidence();
          webgpuRenderError = errorMessage(error);
        }
        publishIfCurrent({
          webgpu: {
            runtime: webgpu.runtime,
            render: webgpuResult,
            error: webgpuRenderError,
          },
        });
        if (failedDisplay) {
          publishIfCurrent({ status: "failed", lastAction: "injected texture-display failure" });
        }
      } catch (error) {
        publishIfCurrent({
          webgpu: {
            runtime: null,
            render: null,
            error: errorMessage(error),
          },
          status: failure ? "failed" : "ready",
          lastAction: "webgpu initialization",
        });
      }

      if (active) {
        const webgl = handlesRef.current["webgl-reference"];
        if (webgl) {
          try {
            const result = await webgl.render("raw", "full");
            publishIfCurrent({ webgl: { runtime: webgl.runtime, render: result, error: null } });
          } catch (error) {
            publishIfCurrent({ webgl: { runtime: webgl.runtime, render: webgl.getEvidence(), error: errorMessage(error) } });
          }
        }
        if (!failure) publishIfCurrent({ status: "ready", lastAction: "initial render" });
      }
    };
    void run().catch((error) => publishIfCurrent({
      status: "failed",
      lastAction: errorMessage(error),
    }));

    return () => {
      active = false;
      activeRoute.current = false;
      onDiagnosticChange({
        ...diagnosticRef.current,
        status: "disposed",
        lastAction: "SPA route unmount",
        lifecycle: { handles: lifecycleStore.handles },
      });
      const handles = Object.values(handlesRef.current);
      handlesRef.current = {};
      for (const handle of handles) {
        if (handle) {
          // Both lifecycle owners ask for teardown; the handle must share one idempotent cleanup.
          const cleanup = handle.dispose();
          void Promise.all([cleanup, handle.dispose()]).catch(() => undefined);
        }
      }
    };
  }, [generation, failure, onDiagnosticChange, publish]);

  const renderCurrent = async (
    nextMode: PreviewMode,
    nextCrop: CropChoice,
    failDisplay = false,
  ) => {
    setMode(nextMode);
    setCrop(nextCrop);
    const entries = Object.entries(handlesRef.current) as [BackendKind, ExperimentHandle][];
    const updates = await Promise.all(entries.map(async ([kind, handle]) => {
      try {
        const render = await handle.render(nextMode, nextCrop, failDisplay && kind === "webgpu-candidate");
        return [
          kind === "webgpu-candidate" ? "webgpu" : "webgl",
          { runtime: handle.runtime, render, error: null },
        ] as const;
      } catch (error) {
        return [kind === "webgpu-candidate" ? "webgpu" : "webgl", {
          runtime: handle.runtime,
          render: handle.getEvidence(),
          error: errorMessage(error),
        }] as const;
      }
    }));
    publish({
      mode: nextMode,
      crop: nextCrop,
      lastAction: failDisplay ? "injected texture-display failure" : "render",
      status: failDisplay ? "failed" : "ready",
      ...Object.fromEntries(updates),
    });
  };

  const remount = () => {
    publish({ lastAction: "local remount requested" });
    setGeneration(allocateMountGeneration());
    setResized(false);
    setMode("raw");
    setCrop("full");
  };

  const resize = async () => {
    const next = !resized;
    const dimensions = next ? RESIZED_FIXTURE_SIZE : FIXTURE_SIZE;
    const updates = await Promise.all(
      (Object.entries(handlesRef.current) as [BackendKind, ExperimentHandle][]).map(async ([kind, handle]) => {
        const render = await handle.resize(dimensions.width, dimensions.height);
        return [
          kind === "webgpu-candidate" ? "webgpu" : "webgl",
          { runtime: handle.runtime, render, error: null },
        ] as const;
      }),
    );
    setResized(next);
    publish({
      lastAction: "resize",
      ...Object.fromEntries(updates),
    });
  };

  const queueRapidOperationsAndHoldReadback = () => {
    const handle = handlesRef.current["webgpu-candidate"];
    if (!handle) return;
    const release = createDeferred();
    pendingReadbackReleases.set(handle.instanceId, release.resolve);
    const consume = (operation: Promise<RenderEvidence>) => {
      void operation.catch(() => undefined);
    };
    consume(handle.render("raw", "full"));
    consume(handle.resize(RESIZED_FIXTURE_SIZE.width, RESIZED_FIXTURE_SIZE.height));
    consume(handle.render("upright", "off-center-4x"));
    const heldOperation = handle.render("raw", "off-center-4x", false, {
      holdAfterReadbackStarts: release.promise,
    });
    void heldOperation.then((render) => {
      if (activeRoute.current && diagnosticRef.current.generation === handle.mountGeneration) {
        publish({ webgpu: { runtime: handle.runtime, render, error: null } });
      }
    }).catch((error: unknown) => {
      if (activeRoute.current && diagnosticRef.current.generation === handle.mountGeneration) {
        publish({ webgpu: { runtime: handle.runtime, render: handle.getEvidence(), error: errorMessage(error) } });
      }
    }).finally(() => pendingReadbackReleases.delete(handle.instanceId));
  };

  return (
    <main
      className="gg-feasibility"
      data-testid="ground-glass-webgpu-fixture"
      data-status={diagnostic.status}
      data-generation={generation}
      data-renderer-backend={diagnostic.webgpu.runtime?.executionBackend ?? "unknown"}
      data-scene-id={TARGET_SCENE_ID}
    >
      <h1>Ground Glass WebGPU Raw RTT feasibility</h1>
      <div className="gg-controls">
        <button type="button" onClick={() => void renderCurrent("raw", crop)}>Raw</button>
        <button type="button" onClick={() => void renderCurrent("upright", crop)}>Upright Assist</button>
        <button type="button" onClick={() => void renderCurrent(mode, "full")}>Full film</button>
        <button type="button" onClick={() => void renderCurrent(mode, "center-4x")}>4× centered crop</button>
        <button type="button" onClick={() => void renderCurrent(mode, "off-center-4x")}>4× off-center crop</button>
        <button type="button" onClick={() => void resize()}>Resize targets</button>
        <button type="button" onClick={() => void renderCurrent(mode, crop, true)}>Inject display failure</button>
        <button type="button" onClick={remount}>Unmount and remount</button>
        <button type="button" onClick={queueRapidOperationsAndHoldReadback}>
          Queue rapid operations and hold WebGPU readback
        </button>
      </div>
      <div className="gg-canvases">
        <section className="gg-canvas-panel">
          <strong>WebGL reference</strong>
          <canvas key={generation} data-testid="webgl-reference-canvas" ref={webglCanvasRef} />
        </section>
        <section className="gg-canvas-panel">
          <strong>WebGPU candidate</strong>
          <canvas key={generation} data-testid="webgpu-candidate-canvas" ref={webgpuCanvasRef} />
        </section>
      </div>
    </main>
  );
};

const AwayRoute = () => (
  <main className="gg-feasibility" data-testid="ground-glass-away-route">
    <h1>Renderer host unmounted</h1>
    <p>The test-only route has no WebGL or WebGPU renderer mounted.</p>
    <button type="button" onClick={releasePendingReadbacks}>Release pending WebGPU readback</button>
  </main>
);

const FixtureShell = () => {
  const [diagnostic, setDiagnostic] = useState(() => createInitialDiagnostic(0));
  const [, setLifecycleRevision] = useState(0);
  const handleDiagnosticChange = useCallback((next: FixtureDiagnostic) => {
    setDiagnostic(next);
  }, []);

  useEffect(() => {
    const update = () => setLifecycleRevision((revision) => revision + 1);
    window.addEventListener(LIFECYCLE_CHANGE_EVENT, update);
    return () => window.removeEventListener(LIFECYCLE_CHANGE_EVENT, update);
  }, []);

  return (
    <HashRouter>
      <nav className="gg-router-nav" aria-label="Fixture routes">
        <Link to="/experiment">Experiment route</Link>
        <Link to="/away">Navigate away</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/experiment" replace />} />
        <Route path="/experiment" element={<Fixture onDiagnosticChange={handleDiagnosticChange} />} />
        <Route path="/away" element={<AwayRoute />} />
      </Routes>
      <pre data-testid="ground-glass-webgpu-diagnostics">
        {JSON.stringify({
          ...diagnostic,
          lifecycle: { handles: lifecycleStore.handles },
        }, null, 2)}
      </pre>
    </HashRouter>
  );
};

const root = document.getElementById("ground-glass-webgpu-raw-rtt");
if (!root) throw new Error("Ground Glass WebGPU fixture root was not found");
createRoot(root).render(<FixtureShell />);
