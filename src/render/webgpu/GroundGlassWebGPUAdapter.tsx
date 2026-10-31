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
import {
  createGroundGlassFrameRequestFingerprint,
  type GroundGlassFrameRequest,
} from "../groundGlassFrameRequest";
import type {
  GroundGlassFrameResult,
  GroundGlassRendererGenerationIdentity,
} from "../backend/groundGlassBackendContracts";
import type {
  GroundGlassBackendDiagnosticDetails,
  GroundGlassPhysicalCocDiagnosticDetails,
  GroundGlassPhysicalCocProbeSummary,
  GroundGlassApertureGatherDiagnosticDetails,
  GroundGlassApertureGatherStatus,
  GroundGlassMountedRuntimeEvidence,
  GroundGlassPresentationDiagnosticDetails,
} from "../backend/groundGlassBackendDiagnostics";
import type { GroundGlassDofRenderState } from "../groundGlassDofRenderState";
import type { GroundGlassCleanupOutcome } from "../groundGlassRenderHostState";
import type { GroundGlassRenderOperationId } from "../groundGlassPassGraph";
import { getGroundGlassSceneProfile } from "../groundGlassSceneProfiles";
import {
  configureGroundGlassCamera,
} from "../configureGroundGlassCamera";
import { createGroundGlassDofRenderState } from "../groundGlassDofRenderState";
import { getGroundGlassDofVisualSettings, resolveGroundGlassDisplayOpticsState } from "../groundGlassVisualSettings";
import {
  mapGroundGlassInspectionWindowToRttSourceCrop,
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
  createGroundGlassApertureGatherNodes,
  createGroundGlassB1ReconstructionNodes,
  createGroundGlassGatherCenterProvenanceNode,
  createGroundGlassDepthReadbackNode,
  createGroundGlassGatherIdentityNode,
  createGroundGlassResearchCompositeNode,
  createGroundGlassSelectedGatherProvenanceNode,
  createGroundGlassSourceIdentityNode,
} from "./groundGlassApertureGatherNodes";
import { runGroundGlassB1BoundaryProbe } from "./groundGlassB1BoundaryProbe";
import {
  isGroundGlassApertureGatherResearchEnabled,
  isGroundGlassApertureGatherResourceProvisioningEnabled,
  resolveGroundGlassApertureGatherSettings,
  resolveGroundGlassApertureGatherResearchEligibility,
  resolveGroundGlassApertureGatherFormatEligibility,
  type GroundGlassApertureGatherSettings,
} from "./groundGlassApertureGatherPolicy";
import {
  compositeGroundGlassB1ResearchReference,
  reconstructGroundGlassB1Reference,
} from "./groundGlassB1Reference";
import {
  referenceGroundGlassApertureGather,
} from "./groundGlassApertureGatherReference";
import {
  createGroundGlassPhysicalCocNodes,
  createGroundGlassPhysicalCocProbeSampleNodes,
} from "./groundGlassPhysicalCocNodes";
import {
  isGroundGlassPhysicalCocResearchEnabled,
  isGroundGlassPhysicalCocResourceProvisioningEnabled,
} from "./groundGlassPhysicalCocPolicy";
import {
  type GroundGlassPhysicalCocControlledKernelCase,
  type GroundGlassPhysicalCocControlledKernelReadback,
  type GroundGlassPhysicalCocProbeKernelOverride,
  consumeGroundGlassPhysicalCocProbeRequestForTest,
  holdGroundGlassWebGpuOperationAfterFailure,
  holdGroundGlassPhysicalCocProbeReadbackForTest,
  holdGroundGlassApertureGatherReadbackForTest,
  type GroundGlassPhysicalCocProbeReadback,
  type GroundGlassApertureGatherCaptureReadback,
  type GroundGlassM5rNearFixtureReadback,
  type GroundGlassApertureGatherOperationName,
  type GroundGlassApertureGatherTargetAllocation,
  type GroundGlassGpuPassTiming,
  type GroundGlassM6cAlphaCaptureReadback,
  type GroundGlassM6dCompositeContractProbeReadback,
  holdGroundGlassWebGpuPresentationQueueCompletion,
  holdGroundGlassWebGpuQueueCompletion,
  isGroundGlassM6bCalibrationFixtureEnabledForRequest,
  isGroundGlassM6cAlphaFixtureEnabledForRequest,
  consumeGroundGlassM6cAlphaCaptureForTest,
  holdGroundGlassM6cAlphaReadbackForTest,
  publishGroundGlassM6cAlphaCaptureForTest,
  recordGroundGlassM6cAlphaTargetAllocatedForTest,
  recordGroundGlassM6cAlphaTargetDisposedForTest,
  registerGroundGlassM6cAlphaCaptureTriggerForTest,
  publishGroundGlassM6bPresentationEvidenceForTest,
  recordGroundGlassM6bFixtureResourceDisposedForTest,
  resolveGroundGlassM6bPresentationStateForTest,
  recordGroundGlassWebGpuAdapterAttemptForTest,
  recordGroundGlassWebGpuTestEvent,
  registerGroundGlassDeviceLossTriggerForTest,
  registerGroundGlassDeviceDestroyTriggerForTest,
  createGroundGlassWebGpuAttemptIdentity,
  publishGroundGlassPhysicalCocProbeReadbackForTest,
  consumeGroundGlassApertureGatherCaptureForTest,
  consumeGroundGlassB1BoundaryProbeForTest,
  publishGroundGlassApertureGatherCaptureForTest,
  publishGroundGlassB1BoundaryProbeForTest,
  registerGroundGlassApertureGatherCaptureTriggerForTest,
  registerGroundGlassB1BoundaryProbeTriggerForTest,
  forceGroundGlassWebGlCompatibilityBackendForTest,
  forceGroundGlassPhysicalCocUnsupportedForTest,
  throwIfGroundGlassWebGpuFailureInjected,
} from "./groundGlassWebGpuTestSeam";
import {
  ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
} from "./groundGlassRawWebGpuCompatibility";
import {
  makeGroundGlassWebGpuDiagnosticDetails as makeDiagnosticDetails,
  makeGroundGlassWebGpuPresentationDiagnostic as makePresentationDiagnostic,
} from "./groundGlassWebGpuDiagnostics";
import {
  assessGroundGlassPhysicalDepthConfidence,
  groundGlassPhysicalCocOrientationErrorModuloPi,
} from "./groundGlassPhysicalCocContract";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { resolveGroundGlassCoverageRenderState } from "../groundGlassCoverage";
import { resolveGroundGlassNaturalIlluminationRenderState } from "../groundGlassNaturalIllumination";
import { resolveGroundGlassRelativeIlluminance } from "../../core/optics/groundGlassIlluminance";
import {
  createGroundGlassPresentationNode,
  type GroundGlassPresentationNodeState,
} from "./groundGlassPresentationNodes";
import { evaluateGroundGlassPresentationReference } from "./groundGlassPresentationReference";
import {
  isGroundGlassM6cReadbackCurrent,
  isGroundGlassM6cMaterialEquivalent,
  type GroundGlassM6cAlphaSampleInput,
  type GroundGlassM6cReadbackIdentity,
} from "../groundGlassM6cAlphaConformance";
import {
  getGroundGlassM6BuildConfigurationEvidence,
  isGroundGlassM6CapablePilotSessionForBuild,
  isGroundGlassM6PresentationBuildEnabled,
  isGroundGlassM6PresentationRequest,
} from "./groundGlassM6PresentationPolicy";

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

class GroundGlassPhysicalSubmissionFailure extends Error {
  constructor(cause: unknown) {
    super(`Ground Glass physical pass queue submission failed: ${errorMessage(cause)}`);
    this.name = "GroundGlassPhysicalSubmissionFailure";
  }
}

const submitPhysicalWork = async (device: GpuDeviceLike): Promise<void> => {
  try {
    await device.queue.onSubmittedWorkDone();
  } catch (error) {
    throw new GroundGlassPhysicalSubmissionFailure(error);
  }
};

class GroundGlassGatherSubmissionFailure extends Error {
  constructor(cause: unknown) {
    super(`Ground Glass aperture gather queue submission failed: ${errorMessage(cause)}`);
    this.name = "GroundGlassGatherSubmissionFailure";
  }
}

const submitGatherWork = async (device: GpuDeviceLike): Promise<void> => {
  try {
    await device.queue.onSubmittedWorkDone();
  } catch (error) {
    throw new GroundGlassGatherSubmissionFailure(error);
  }
};

type GroundGlassApertureGatherResources = {
  targets: THREE.RenderTarget[];
  materials: MeshBasicNodeMaterial[];
  scenes: THREE.Scene[];
  geometry: THREE.PlaneGeometry;
  farTarget: THREE.RenderTarget;
  nearTarget: THREE.RenderTarget;
  b1Target: THREE.RenderTarget;
  researchCompositeTarget: THREE.RenderTarget;
  sourceIdentityTarget: THREE.RenderTarget;
  gatherIdentityTarget: THREE.RenderTarget;
  gatherCenterProvenanceTarget: THREE.RenderTarget;
  selectedProvenanceTarget: THREE.RenderTarget;
  b1DecisionTarget: THREE.RenderTarget;
  ensureDepthReadbackResources: () => Readonly<{
    target: THREE.RenderTarget;
    scene: THREE.Scene;
  }>;
  farScene: THREE.Scene;
  nearScene: THREE.Scene;
  sourceIdentityScene: THREE.Scene;
  gatherIdentityScene: THREE.Scene;
  gatherCenterProvenanceScene: THREE.Scene;
  selectedProvenanceScene: THREE.Scene;
  b1Scene: THREE.Scene;
  b1DecisionScene: THREE.Scene;
  researchCompositeScene: THREE.Scene;
  gatherNodes: ReturnType<typeof createGroundGlassApertureGatherNodes>;
  sourceIdentityNodes: ReturnType<typeof createGroundGlassSourceIdentityNode>;
  gatherIdentityNodes: ReturnType<typeof createGroundGlassGatherIdentityNode>;
  gatherCenterProvenanceNodes: ReturnType<typeof createGroundGlassGatherCenterProvenanceNode>;
  b1Nodes: ReturnType<typeof createGroundGlassB1ReconstructionNodes>;
};

const createGroundGlassApertureGatherResources = (input: Readonly<{
  sourceColorTarget: THREE.RenderTarget;
  sceneDepthTexture: THREE.DepthTexture;
  physicalTarget: THREE.RenderTarget;
  validityTarget: THREE.RenderTarget;
  sourceWidthPx: number;
  sourceHeightPx: number;
  sampledFilmWidthMm: number;
  sampledFilmHeightMm: number;
  inverseProjection: THREE.Matrix4;
  settings: GroundGlassApertureGatherSettings;
}>): GroundGlassApertureGatherResources => {
  const targets: THREE.RenderTarget[] = [];
  const materials: MeshBasicNodeMaterial[] = [];
  const scenes: THREE.Scene[] = [];
  let geometry: THREE.PlaneGeometry | null = null;
  const initialGatherWidthPx = Math.max(1, Math.round(input.sourceWidthPx * input.settings.gatherScale));
  const initialGatherHeightPx = Math.max(1, Math.round(input.sourceHeightPx * input.settings.gatherScale));
  const makeTarget = (widthPx: number, heightPx: number, type: THREE.TextureDataType) => {
    const target = new THREE.RenderTarget(widthPx, heightPx, {
      format: THREE.RGBAFormat,
      type,
      depthBuffer: false,
      stencilBuffer: false,
      samples: 0,
      generateMipmaps: false,
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    target.texture.wrapS = THREE.ClampToEdgeWrapping;
    target.texture.wrapT = THREE.ClampToEdgeWrapping;
    targets.push(target);
    return target;
  };
  const makeScene = (outputNode: MeshBasicNodeMaterial["outputNode"]): THREE.Scene => {
    const material = new MeshBasicNodeMaterial({ toneMapped: false });
    materials.push(material);
    material.outputNode = outputNode;
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(geometry!, material);
    mesh.position.z = -0.5;
    scene.add(mesh);
    scenes.push(scene);
    return scene;
  };
  try {
    geometry = new THREE.PlaneGeometry(2, 2);
    const farTarget = makeTarget(initialGatherWidthPx, initialGatherHeightPx, THREE.HalfFloatType);
    const nearTarget = makeTarget(initialGatherWidthPx, initialGatherHeightPx, THREE.HalfFloatType);
    const b1Target = makeTarget(input.sourceWidthPx, input.sourceHeightPx, THREE.HalfFloatType);
    const researchCompositeTarget = makeTarget(input.sourceWidthPx, input.sourceHeightPx, THREE.HalfFloatType);
    const sourceIdentityTarget = makeTarget(input.sourceWidthPx, input.sourceHeightPx, THREE.FloatType);
    const gatherIdentityTarget = makeTarget(initialGatherWidthPx, initialGatherHeightPx, THREE.FloatType);
    const gatherCenterProvenanceTarget = makeTarget(initialGatherWidthPx, initialGatherHeightPx, THREE.FloatType);
    const selectedProvenanceTarget = makeTarget(input.sourceWidthPx, input.sourceHeightPx, THREE.FloatType);
    const b1DecisionTarget = makeTarget(input.sourceWidthPx, input.sourceHeightPx, THREE.UnsignedByteType);
    let depthReadbackTarget: THREE.RenderTarget | null = null;
    let depthReadbackScene: THREE.Scene | null = null;

    const gatherNodes = createGroundGlassApertureGatherNodes({
      sourceColorTexture: input.sourceColorTarget.texture,
      sceneDepthTexture: input.sceneDepthTexture,
      physicalTexture: input.physicalTarget.texture,
      validityTexture: input.validityTarget.texture,
      state: {
        sourceWidthPx: input.sourceWidthPx,
        sourceHeightPx: input.sourceHeightPx,
        sampledFilmWidthMm: input.sampledFilmWidthMm,
        sampledFilmHeightMm: input.sampledFilmHeightMm,
        maximumRadiusPx: input.settings.maximumRadiusPx,
        sampleCount: input.settings.sampleCount,
        inverseProjection: input.inverseProjection,
      },
    });
    const sourceIdentityNodes = createGroundGlassSourceIdentityNode(input.sourceWidthPx, input.sourceHeightPx);
    const gatherIdentityNodes = createGroundGlassGatherIdentityNode(initialGatherWidthPx, initialGatherHeightPx);
    const gatherCenterProvenanceNodes = createGroundGlassGatherCenterProvenanceNode(
      sourceIdentityTarget.texture,
      input.sourceWidthPx,
      input.sourceHeightPx,
    );
    const selectedProvenanceNode = createGroundGlassSelectedGatherProvenanceNode({
      gatherIdentityTexture: gatherIdentityTarget.texture,
      gatherCenterProvenanceTexture: gatherCenterProvenanceTarget.texture,
    });
    const b1Nodes = createGroundGlassB1ReconstructionNodes({
      sourceColorTexture: input.sourceColorTarget.texture,
      gatherFarTexture: farTarget.texture,
      physicalTexture: input.physicalTarget.texture,
      validityTexture: input.validityTarget.texture,
      gatherCenterProvenanceTexture: gatherCenterProvenanceTarget.texture,
      selectedProvenanceTexture: selectedProvenanceTarget.texture,
      sourceWidthPx: input.sourceWidthPx,
      sourceHeightPx: input.sourceHeightPx,
      gatherWidthPx: initialGatherWidthPx,
      gatherHeightPx: initialGatherHeightPx,
    });

    return {
      targets,
      materials,
      scenes,
      geometry,
      farTarget,
      nearTarget,
      b1Target,
      researchCompositeTarget,
      sourceIdentityTarget,
      gatherIdentityTarget,
      gatherCenterProvenanceTarget,
      selectedProvenanceTarget,
      b1DecisionTarget,
      farScene: makeScene(gatherNodes.farOutput),
      nearScene: makeScene(gatherNodes.nearOutput),
      sourceIdentityScene: makeScene(sourceIdentityNodes.outputNode),
      gatherIdentityScene: makeScene(gatherIdentityNodes.outputNode),
      gatherCenterProvenanceScene: makeScene(gatherCenterProvenanceNodes.outputNode),
      selectedProvenanceScene: makeScene(selectedProvenanceNode),
      b1Scene: makeScene(b1Nodes.farOutput),
      b1DecisionScene: makeScene(b1Nodes.decisionOutput),
      researchCompositeScene: makeScene(createGroundGlassResearchCompositeNode({
        farTexture: b1Target.texture,
        nearTexture: nearTarget.texture,
      })),
      ensureDepthReadbackResources: () => {
        depthReadbackTarget ??= makeTarget(input.sourceWidthPx, input.sourceHeightPx, THREE.FloatType);
        depthReadbackScene ??= makeScene(createGroundGlassDepthReadbackNode(input.sceneDepthTexture));
        return { target: depthReadbackTarget, scene: depthReadbackScene };
      },
      gatherNodes,
      sourceIdentityNodes,
      gatherIdentityNodes,
      gatherCenterProvenanceNodes,
      b1Nodes,
    };
  } catch (error) {
    scenes.forEach((scene) => scene.clear());
    materials.forEach((material) => material.dispose());
    geometry?.dispose();
    const cleanupErrors: unknown[] = [];
    targets.forEach((target) => {
      try { target.dispose(); } catch (cleanupError) { cleanupErrors.push(cleanupError); }
    });
    if (cleanupErrors.length > 0) {
      throw new AggregateError([error, ...cleanupErrors], "M5 partial target initialization cleanup failed");
    }
    throw error;
  }
};

const mergePhysicalProbeKernelOverride = (
  base: GroundGlassDofRenderState,
  override: GroundGlassPhysicalCocProbeKernelOverride,
): GroundGlassDofRenderState => ({
  ...base,
  lens: { ...base.lens, ...override.lens },
  film: { ...base.film, ...override.film },
  optics: { ...base.optics, ...override.optics },
});

const readControlledPhysicalKernelCase = async (input: Readonly<{
  renderer: WebGpuRenderer;
  device: GpuDeviceLike;
  backend: WebGpuBackendLike;
  depthTexture: THREE.DepthTexture;
  camera: THREE.OrthographicCamera;
  dof: GroundGlassDofRenderState;
  testCase: GroundGlassPhysicalCocControlledKernelCase;
}>): Promise<GroundGlassPhysicalCocControlledKernelReadback> => {
  const dof = mergePhysicalProbeKernelOverride(input.dof, input.testCase.kernelOverride);
  const nodes = createGroundGlassPhysicalCocNodes({
    depthTexture: input.depthTexture,
    state: { dof },
    probes: [input.testCase.probe],
  });
  const targets: THREE.RenderTarget[] = [];
  const materials: MeshBasicNodeMaterial[] = [];
  const scenes: THREE.Scene[] = [];
  let geometry: THREE.PlaneGeometry | null = null;
  try {
    geometry = new THREE.PlaneGeometry(2, 2);
    const makeMaterial = (outputNode: MeshBasicNodeMaterial["outputNode"]) => {
      const material = new MeshBasicNodeMaterial({ toneMapped: false });
      materials.push(material);
      material.outputNode = outputNode;
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(geometry!, material));
      scenes.push(scene);
      return scene;
    };
    const makeTarget = (type: THREE.TextureDataType) => {
      const target = new THREE.RenderTarget(1, 1, {
        format: THREE.RGBAFormat,
        type,
        depthBuffer: false,
        stencilBuffer: false,
        samples: 0,
        generateMipmaps: false,
      });
      targets.push(target);
      target.texture.colorSpace = THREE.NoColorSpace;
      target.texture.minFilter = THREE.NearestFilter;
      target.texture.magFilter = THREE.NearestFilter;
      target.texture.generateMipmaps = false;
      return target;
    };
    const calculatedTarget = makeTarget(THREE.FloatType);
    const orientationTarget = makeTarget(THREE.FloatType);
    const validityTarget = makeTarget(THREE.UnsignedByteType);
    const storedTarget = makeTarget(THREE.HalfFloatType);
    const sampledTarget = makeTarget(THREE.FloatType);
    const renderPairs = [
      [makeMaterial(nodes.rawFootprint), calculatedTarget],
      [makeMaterial(nodes.orientationDiagnostics), orientationTarget],
      [makeMaterial(vec4(nodes.validityCode.div(255), 0, 0, 1)), validityTarget],
      [makeMaterial(nodes.storedFootprint), storedTarget],
      [makeMaterial(vec4(texture(storedTarget.texture, vec2(0.5, 0.5)))), sampledTarget],
    ] as const;

    for (const [scene, target] of renderPairs) {
      input.renderer.setRenderTarget(target);
      input.renderer.setViewport(0, 0, 1, 1);
      input.renderer.setScissorTest(false);
      input.renderer.clear(true, false, false);
      input.renderer.render(scene, input.camera);
    }
    await submitPhysicalWork(input.device);
    const calculated = await input.renderer.readRenderTargetPixelsAsync(
      calculatedTarget, 0, 0, 1, 1,
    ) as Float32Array;
    const orientation = await input.renderer.readRenderTargetPixelsAsync(
      orientationTarget, 0, 0, 1, 1,
    ) as Float32Array;
    const validity = await input.renderer.readRenderTargetPixelsAsync(
      validityTarget, 0, 0, 1, 1,
    ) as Uint8Array;
    const sampled = await input.renderer.readRenderTargetPixelsAsync(
      sampledTarget, 0, 0, 1, 1,
    ) as Float32Array;
    if (
      !(calculated instanceof Float32Array) ||
      !(orientation instanceof Float32Array) ||
      !(validity instanceof Uint8Array) ||
      !(sampled instanceof Float32Array)
    ) throw new Error("Controlled physical kernel returned an unexpected diagnostic readback type");

    const storageFormat = observeTextureFormat(input.backend, storedTarget.texture);
    let storedHalfFloatBits: readonly [number, number, number, number] | null = null;
    let readbackFootprintMm: readonly [number, number, number, number] | null = null;
    let sampledFootprintMm: readonly [number, number, number, number] | null = null;
    if (storageFormat === "rgba16float") {
      const stored = await input.renderer.readRenderTargetPixelsAsync(
        storedTarget, 0, 0, 1, 1,
      ) as Uint16Array;
      if (!(stored instanceof Uint16Array)) {
        throw new Error("Controlled RGBA16F target did not return binary16 storage bits");
      }
      storedHalfFloatBits = [stored[0]!, stored[1]!, stored[2]!, stored[3]!];
      readbackFootprintMm = storedHalfFloatBits.map((bits) => THREE.DataUtils.fromHalfFloat(bits)) as
        unknown as readonly [number, number, number, number];
      sampledFootprintMm = [sampled[0]!, sampled[1]!, sampled[2]!, sampled[3]!];
    }

    return {
      id: input.testCase.id,
      probeId: input.testCase.probe.id,
      calculatedFootprintMm: [calculated[0]!, calculated[1]!, calculated[2]!, calculated[3]!],
      orientationPrincipalAngleRad: orientation[0]!,
      orientationDefined: Math.round(orientation[1]!) === 1,
      validityCode: validity[0]!,
      focalBranchCode: Math.round(orientation[3]!),
      storageFormat,
      storedHalfFloatBits,
      readbackFootprintMm,
      sampledFootprintMm,
    };
  } finally {
    try {
      input.renderer.setRenderTarget(null);
    } finally {
      scenes.forEach((scene) => scene.clear());
      materials.forEach((material) => material.dispose());
      geometry?.dispose();
      targets.forEach((target) => target.dispose());
    }
  }
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

type GroundGlassReadbackPixels = Uint8Array | Uint16Array | Float32Array;
type GroundGlassReadbackOrigin = "top" | "bottom" | "unresolved";

/**
 * WebGPU texture-to-buffer copies use 256-byte row pitches. Three.js returns
 * those rows with their padding intact, so compact each RGBA row before the
 * M5 CPU oracle interprets pixel coordinates.
 */
const compactWebGpuReadbackRows = (
  pixels: GroundGlassReadbackPixels,
  widthPx: number,
  heightPx: number,
): GroundGlassReadbackPixels => {
  if (!Number.isSafeInteger(widthPx) || widthPx < 1
      || !Number.isSafeInteger(heightPx) || heightPx < 1) {
    throw new RangeError("Ground Glass WebGPU readback requires positive integer dimensions");
  }
  const elementsPerRow = widthPx * 4;
  const tightLength = elementsPerRow * heightPx;
  if (pixels.length === tightLength) return pixels;
  const bytesPerElement = pixels.BYTES_PER_ELEMENT;
  const bytesPerRow = elementsPerRow * bytesPerElement;
  const paddedRowElements = Math.ceil(bytesPerRow / 256) * 256 / bytesPerElement;
  const paddedReadbackLength = (heightPx - 1) * paddedRowElements + elementsPerRow;
  if (pixels.length !== paddedReadbackLength) {
    throw new RangeError(
      `Ground Glass WebGPU readback length ${pixels.length} does not match tightly packed `
      + `${tightLength} or 256-byte row-padded ${paddedReadbackLength} RGBA elements`,
    );
  }

  const output = pixels instanceof Uint8Array
    ? new Uint8Array(tightLength)
    : pixels instanceof Uint16Array
      ? new Uint16Array(tightLength)
      : new Float32Array(tightLength);
  for (let y = 0; y < heightPx; y += 1) {
    const sourceOffset = y * paddedRowElements;
    const destinationOffset = y * elementsPerRow;
    output.set(pixels.subarray(sourceOffset, sourceOffset + elementsPerRow), destinationOffset);
  }
  return output;
};

const toStoredFloat = (pixels: GroundGlassReadbackPixels, index: number): number => {
  const value = pixels[index] ?? 0;
  if (pixels instanceof Uint8Array) return value / 255;
  if (pixels instanceof Uint16Array) return THREE.DataUtils.fromHalfFloat(value);
  return value;
};

const inferReadbackOrigin = (
  pixels: GroundGlassReadbackPixels,
  widthPx: number,
  heightPx: number,
): Readonly<{ origin: GroundGlassReadbackOrigin; evidence: string }> => {
  if (!(pixels instanceof Float32Array) || widthPx < 1 || heightPx < 2
      || pixels.length !== widthPx * heightPx * 4) {
    const actualType = ArrayBuffer.isView(pixels) ? pixels.constructor.name : typeof pixels;
    return {
      origin: "unresolved",
      evidence: `identity readback type/size mismatch; type=${actualType}, length=${pixels.length}, `
        + `expected=${widthPx * heightPx * 4}, dimensions=${widthPx}x${heightPx}`,
    };
  }
  let topMismatches = 0;
  let bottomMismatches = 0;
  let topFirstMismatch = "none";
  let bottomFirstMismatch = "none";
  for (let y = 0; y < heightPx; y += 1) {
    for (let x = 0; x < widthPx; x += 1) {
      const offset = (y * widthPx + x) * 4;
      const observedX = pixels[offset];
      const observedY = pixels[offset + 1];
      const expectedTopY = y;
      const expectedBottomY = heightPx - 1 - y;
      if (observedX !== x || observedY !== expectedTopY) {
        topMismatches += 1;
        if (topFirstMismatch === "none") {
          topFirstMismatch = `(${x},${y}) observed (${observedX},${observedY})`;
        }
      }
      if (observedX !== x || observedY !== expectedBottomY) {
        bottomMismatches += 1;
        if (bottomFirstMismatch === "none") {
          bottomFirstMismatch = `(${x},${y}) observed (${observedX},${observedY})`;
        }
      }
    }
  }
  if (topMismatches === 0) return { origin: "top", evidence: "all source identities match top-origin rows" };
  if (bottomMismatches === 0) return { origin: "bottom", evidence: "all source identities match bottom-origin rows" };
  const evidence = `identity grid mismatch; top=${topMismatches} (first ${topFirstMismatch}); `
    + `bottom=${bottomMismatches} (first ${bottomFirstMismatch})`;
  return { origin: "unresolved", evidence };
};

const rgbaReadbackToTopFloat = (
  pixels: GroundGlassReadbackPixels,
  widthPx: number,
  heightPx: number,
  origin: GroundGlassReadbackOrigin,
): Float32Array => {
  if (origin === "unresolved" || pixels.length !== widthPx * heightPx * 4) {
    throw new Error("Ground Glass readback origin or RGBA dimensions could not be resolved");
  }
  const output = new Float32Array(pixels.length);
  for (let y = 0; y < heightPx; y += 1) {
    const readY = origin === "top" ? y : heightPx - 1 - y;
    for (let x = 0; x < widthPx; x += 1) {
      const inputOffset = (readY * widthPx + x) * 4;
      const outputOffset = (y * widthPx + x) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        output[outputOffset + channel] = toStoredFloat(pixels, inputOffset + channel);
      }
    }
  }
  return output;
};

const redReadbackToTopBytes = (
  pixels: GroundGlassReadbackPixels,
  widthPx: number,
  heightPx: number,
  origin: GroundGlassReadbackOrigin,
): Uint8Array => {
  if (origin === "unresolved" || pixels.length !== widthPx * heightPx * 4
      || !(pixels instanceof Uint8Array)) {
    throw new Error("Ground Glass validity readback requires resolved RGBA8 source orientation");
  }
  const output = new Uint8Array(widthPx * heightPx);
  for (let y = 0; y < heightPx; y += 1) {
    const readY = origin === "top" ? y : heightPx - 1 - y;
    for (let x = 0; x < widthPx; x += 1) {
      output[y * widthPx + x] = pixels[(readY * widthPx + x) * 4] ?? 0;
    }
  }
  return output;
};

const rgbaIdentityToTopIds = (
  pixels: GroundGlassReadbackPixels,
  widthPx: number,
  heightPx: number,
  origin: GroundGlassReadbackOrigin,
  xChannel: 0 | 2,
  yChannel: 1 | 3,
): Int32Array => {
  if (!(pixels instanceof Float32Array) || origin === "unresolved"
      || pixels.length !== widthPx * heightPx * 4) {
    throw new Error("Ground Glass provenance readback requires RGBA32F identity data");
  }
  const output = new Int32Array(widthPx * heightPx * 2);
  for (let y = 0; y < heightPx; y += 1) {
    const readY = origin === "top" ? y : heightPx - 1 - y;
    for (let x = 0; x < widthPx; x += 1) {
      const inputOffset = (readY * widthPx + x) * 4;
      const outputOffset = (y * widthPx + x) * 2;
      output[outputOffset] = Math.round(pixels[inputOffset + xChannel] ?? Number.NaN);
      output[outputOffset + 1] = Math.round(pixels[inputOffset + yChannel] ?? Number.NaN);
    }
  }
  return output;
};

const groundGlassReadbackFingerprint = (pixels: GroundGlassReadbackPixels): string => {
  const bytes = new Uint8Array(pixels.buffer, pixels.byteOffset, pixels.byteLength);
  let hash = 2166136261;
  for (const byte of bytes) hash = Math.imul(hash ^ byte, 16777619);
  return (hash >>> 0).toString(16).padStart(8, "0");
};

const compareRgbRms = (left: Float32Array, right: Float32Array) => {
  if (left.length !== right.length || left.length % 4 !== 0) {
    throw new RangeError("Ground Glass RGB comparison requires matching RGBA buffers");
  }
  let sumSquared = 0;
  let maximum = 0;
  let maximumOffset = 0;
  let count = 0;
  for (let offset = 0; offset < left.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs((left[offset + channel] ?? 0) - (right[offset + channel] ?? 0));
      if (error > maximum) {
        maximum = error;
        maximumOffset = offset + channel;
      }
      sumSquared += error * error;
      count += 1;
    }
  }
  return { rmse: Math.sqrt(sumSquared / Math.max(1, count)), maximum, maximumOffset };
};

const compareAlphaRms = (left: Float32Array, right: Float32Array) => {
  if (left.length !== right.length || left.length % 4 !== 0) {
    throw new RangeError("Ground Glass alpha comparison requires matching RGBA buffers");
  }
  let sumSquared = 0;
  let maximum = 0;
  let count = 0;
  for (let offset = 3; offset < left.length; offset += 4) {
    const error = Math.abs((left[offset] ?? 0) - (right[offset] ?? 0));
    maximum = Math.max(maximum, error);
    sumSquared += error * error;
    count += 1;
  }
  return { rmse: Math.sqrt(sumSquared / Math.max(1, count)), maximum };
};

const runGroundGlassApertureGatherPass = async (input: Readonly<{
  renderer: WebGpuRenderer;
  device: GpuDeviceLike;
  target: THREE.RenderTarget;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  isCurrent: () => boolean;
}>): Promise<GroundGlassGpuPassTiming | null> => {
  const startedAt = performance.now();
  input.renderer.setRenderTarget(input.target);
  input.renderer.setViewport(0, 0, input.target.width, input.target.height);
  input.renderer.setScissorTest(false);
  input.renderer.clear(true, false, false);
  const rendererCallStartedAt = performance.now();
  input.renderer.render(input.scene, input.camera);
  const rendererCallCpuMs = performance.now() - rendererCallStartedAt;
  const queueWaitStartedAt = performance.now();
  await submitGatherWork(input.device);
  const queueCompletionWaitMs = performance.now() - queueWaitStartedAt;
  if (!input.isCurrent()) return null;
  return {
    rendererCallCpuMs,
    queueCompletionWaitMs,
    wallClockMs: performance.now() - startedAt,
  };
};

const renderM5rFloatDiagnosticTarget = async (input: Readonly<{
  renderer: WebGpuRenderer;
  device: GpuDeviceLike;
  outputNode: MeshBasicNodeMaterial["outputNode"];
  widthPx: number;
  heightPx: number;
  camera: THREE.OrthographicCamera;
  isCurrent: () => boolean;
}>): Promise<Readonly<{ values: Float32Array; format: string | null }> | null> => {
  const target = new THREE.RenderTarget(input.widthPx, input.heightPx, {
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  const geometry = new THREE.PlaneGeometry(2, 2);
  const material = new MeshBasicNodeMaterial({ toneMapped: false });
  material.outputNode = input.outputNode;
  const scene = new THREE.Scene();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -0.5;
  scene.add(mesh);
  try {
    input.renderer.initRenderTarget(target);
    const timing = await runGroundGlassApertureGatherPass({
      renderer: input.renderer,
      device: input.device,
      target,
      scene,
      camera: input.camera,
      isCurrent: input.isCurrent,
    });
    if (timing === null) return null;
    const format = observeTextureFormat(input.renderer.backend as WebGpuBackendLike, target.texture);
    const readback = compactWebGpuReadbackRows(
      await input.renderer.readRenderTargetPixelsAsync(
        target, 0, 0, input.widthPx, input.heightPx,
      ) as GroundGlassReadbackPixels,
      input.widthPx,
      input.heightPx,
    );
    if (!(readback instanceof Float32Array)) {
      throw new Error("M5R diagnostic target did not return RGBA32F readback values");
    }
    if (!input.isCurrent()) return null;
    return { values: readback, format };
  } finally {
    scene.clear();
    material.dispose();
    geometry.dispose();
    target.dispose();
  }
};

const nearAlphaHalfBitsTop = (
  pixels: GroundGlassReadbackPixels,
  widthPx: number,
  heightPx: number,
  origin: GroundGlassReadbackOrigin,
): Uint16Array => {
  if (!(pixels instanceof Uint16Array) || origin === "unresolved"
      || pixels.length !== widthPx * heightPx * 4) {
    throw new Error("M5R Near storage diagnostic requires tightly packed RGBA16F readback bits");
  }
  const output = new Uint16Array(widthPx * heightPx);
  for (let y = 0; y < heightPx; y += 1) {
    const readY = origin === "top" ? y : heightPx - 1 - y;
    for (let x = 0; x < widthPx; x += 1) {
      output[y * widthPx + x] = pixels[(readY * widthPx + x) * 4 + 3] ?? 0;
    }
  }
  return output;
};

const rgbaHalfBitsTop = (
  pixels: GroundGlassReadbackPixels,
  widthPx: number,
  heightPx: number,
  origin: GroundGlassReadbackOrigin,
): Uint16Array => {
  if (!(pixels instanceof Uint16Array) || origin === "unresolved"
      || pixels.length !== widthPx * heightPx * 4) {
    throw new Error("M5R Far storage diagnostic requires tightly packed RGBA16F readback bits");
  }
  const output = new Uint16Array(pixels.length);
  for (let y = 0; y < heightPx; y += 1) {
    const readY = origin === "top" ? y : heightPx - 1 - y;
    output.set(
      pixels.subarray(readY * widthPx * 4, (readY + 1) * widthPx * 4),
      y * widthPx * 4,
    );
  }
  return output;
};

const runGroundGlassM5rNearFixture = async (input: Readonly<{
  renderer: WebGpuRenderer;
  device: GpuDeviceLike;
  backend: WebGpuBackendLike;
  camera: THREE.OrthographicCamera;
  isCurrent: () => boolean;
  rendererGenerationId: string;
  requestId: string;
  sceneId: string;
}>): Promise<Readonly<{
  metadata: GroundGlassM5rNearFixtureReadback;
  buffers: Readonly<{
    nearRgba: Float32Array;
    proposalCountsRgba: Float32Array;
    coverageRgba: Float32Array;
    acceptedFootprintRgba: Float32Array;
    nearAlphaHalfBits: Uint16Array;
  }>;
}> | null> => {
  const widthPx = 96;
  const heightPx = 96;
  const pixelCount = widthPx * heightPx;
  const foregroundCenterPixel = { x: 32, y: 48 };
  const foregroundRadiusPx = 18;
  const foregroundNearCocMm = -8;
  const backgroundFarCocMm = 1;
  const depthNear = 0.35;
  const depthBackground = 0.62;
  const maximumRadiusPx = 16;
  const centerPixel = { x: 55, y: 48 };
  const sourceData = new Float32Array(pixelCount * 4);
  const physicalData = new Float32Array(pixelCount * 4);
  const validityData = new Uint8Array(pixelCount);
  const depthData = new Float32Array(pixelCount);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    const x = pixel % widthPx;
    const y = Math.floor(pixel / widthPx);
    const dx = x - foregroundCenterPixel.x;
    const dy = y - foregroundCenterPixel.y;
    const isForeground = dx * dx + dy * dy <= foregroundRadiusPx * foregroundRadiusPx;
    sourceData.set(isForeground ? [0.92, 0.27, 0.06, 1] : [0.04, 0.12, 0.82, 1], offset);
    physicalData.set(
      isForeground
        ? [foregroundNearCocMm, 8, 8, 0]
        : [backgroundFarCocMm, 1, 1, 0],
      offset,
    );
    validityData[pixel] = 1;
    depthData[pixel] = isForeground ? depthNear : depthBackground;
  }

  const textures: THREE.Texture[] = [];
  const targets: THREE.RenderTarget[] = [];
  const materials: MeshBasicNodeMaterial[] = [];
  const scenes: THREE.Scene[] = [];
  let geometry: THREE.PlaneGeometry | null = null;
  const makeDataTexture = (
    data: Float32Array | Uint8Array,
    format: THREE.PixelFormat,
    type: THREE.TextureDataType,
  ): THREE.DataTexture => {
    const textureValue = new THREE.DataTexture(data, widthPx, heightPx, format, type);
    textureValue.colorSpace = THREE.NoColorSpace;
    textureValue.minFilter = THREE.NearestFilter;
    textureValue.magFilter = THREE.NearestFilter;
    textureValue.wrapS = THREE.ClampToEdgeWrapping;
    textureValue.wrapT = THREE.ClampToEdgeWrapping;
    textureValue.generateMipmaps = false;
    textureValue.needsUpdate = true;
    textures.push(textureValue);
    return textureValue;
  };
  const makeRenderTarget = (type: THREE.TextureDataType): THREE.RenderTarget => {
    const target = new THREE.RenderTarget(widthPx, heightPx, {
      format: THREE.RGBAFormat,
      type,
      depthBuffer: false,
      stencilBuffer: false,
      samples: 0,
      generateMipmaps: false,
    });
    target.texture.colorSpace = THREE.NoColorSpace;
    target.texture.minFilter = THREE.NearestFilter;
    target.texture.magFilter = THREE.NearestFilter;
    target.texture.generateMipmaps = false;
    targets.push(target);
    return target;
  };
  const sourceTexture = makeDataTexture(sourceData, THREE.RGBAFormat, THREE.FloatType);
  const physicalTexture = makeDataTexture(physicalData, THREE.RGBAFormat, THREE.FloatType);
  const validityTexture = makeDataTexture(validityData, THREE.RedFormat, THREE.UnsignedByteType);
  const depthTexture = makeDataTexture(depthData, THREE.RedFormat, THREE.FloatType);
  const gatherNodes = createGroundGlassApertureGatherNodes({
    sourceColorTexture: sourceTexture,
    sceneDepthTexture: depthTexture as unknown as THREE.DepthTexture,
    physicalTexture,
    validityTexture,
    state: {
      sourceWidthPx: widthPx,
      sourceHeightPx: heightPx,
      sampledFilmWidthMm: 36,
      sampledFilmHeightMm: 24,
      maximumRadiusPx,
      sampleCount: 64,
      inverseProjection: input.camera.projectionMatrixInverse.clone(),
    },
  });
  const diagnosticNodes = gatherNodes.createM5rNearDiagnosticOutputs();
  const nearTarget = makeRenderTarget(THREE.HalfFloatType);
  const identityTarget = makeRenderTarget(THREE.FloatType);
  const identityNodes = createGroundGlassSourceIdentityNode(widthPx, heightPx);
  const outputPairs = [
    [gatherNodes.nearOutput, nearTarget],
    [identityNodes.outputNode, identityTarget],
  ] as const;
  try {
    geometry = new THREE.PlaneGeometry(2, 2);
    const makeScene = (outputNode: MeshBasicNodeMaterial["outputNode"]): THREE.Scene => {
      const material = new MeshBasicNodeMaterial({ toneMapped: false });
      material.outputNode = outputNode;
      materials.push(material);
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(geometry!, material);
      mesh.position.z = -0.5;
      scene.add(mesh);
      scenes.push(scene);
      return scene;
    };
    const scenesForOutput = outputPairs.map(([outputNode]) => makeScene(outputNode));
    const readOutput = async (
      outputNode: MeshBasicNodeMaterial["outputNode"],
      target: THREE.RenderTarget,
      label: string,
    ): Promise<Readonly<{ pixels: GroundGlassReadbackPixels; format: string | null }>> => {
      const sceneIndex = outputPairs.findIndex((pair) => pair[0] === outputNode);
      const scene = sceneIndex >= 0 ? scenesForOutput[sceneIndex] : makeScene(outputNode);
      input.renderer.initRenderTarget(target);
      const timing = await runGroundGlassApertureGatherPass({
        renderer: input.renderer,
        device: input.device,
        target,
        scene: scene!,
        camera: input.camera,
        isCurrent: input.isCurrent,
      });
      if (timing === null) throw new Error(`M5R controlled Near fixture became stale during ${label}`);
      const format = observeTextureFormat(input.backend, target.texture);
      const rawPixels = await input.renderer.readRenderTargetPixelsAsync(target, 0, 0, widthPx, heightPx);
      const pixels = compactWebGpuReadbackRows(
        rawPixels as GroundGlassReadbackPixels,
        widthPx,
        heightPx,
      );
      if (!input.isCurrent()) throw new Error(`M5R controlled Near fixture became stale after ${label}`);
      return { pixels, format };
    };
    const near = await readOutput(gatherNodes.nearOutput, nearTarget, "Near target");
    const identity = await readOutput(identityNodes.outputNode, identityTarget, "orientation identity");
    const originEvidence = inferReadbackOrigin(identity.pixels, widthPx, heightPx);
    if (originEvidence.origin === "unresolved") {
      throw new Error(`M5R controlled Near fixture could not resolve row origin: ${originEvidence.evidence}`);
    }
    if (near.format !== "rgba16float") {
      throw new Error(`M5R controlled Near target format was ${near.format ?? "unresolved"}`);
    }
    const nearRgba = rgbaReadbackToTopFloat(near.pixels, widthPx, heightPx, originEvidence.origin);
    const alphaBits = nearAlphaHalfBitsTop(near.pixels, widthPx, heightPx, originEvidence.origin);
    const renderFloatOutput = async (outputNode: MeshBasicNodeMaterial["outputNode"], label: string) => {
      const target = makeRenderTarget(THREE.FloatType);
      const scene = makeScene(outputNode);
      input.renderer.initRenderTarget(target);
      const timing = await runGroundGlassApertureGatherPass({
        renderer: input.renderer,
        device: input.device,
        target,
        scene,
        camera: input.camera,
        isCurrent: input.isCurrent,
      });
      if (timing === null) throw new Error(`M5R controlled Near fixture became stale during ${label}`);
      const format = observeTextureFormat(input.backend, target.texture);
      if (format !== "rgba32float") throw new Error(`M5R controlled Near diagnostic ${label} format is ${format}`);
      const rawPixels = await input.renderer.readRenderTargetPixelsAsync(target, 0, 0, widthPx, heightPx);
      const pixels = compactWebGpuReadbackRows(
        rawPixels as GroundGlassReadbackPixels,
        widthPx,
        heightPx,
      );
      if (!(pixels instanceof Float32Array)) throw new Error(`M5R controlled Near diagnostic ${label} was not Float32`);
      if (!input.isCurrent()) throw new Error(`M5R controlled Near fixture became stale after ${label}`);
      return rgbaReadbackToTopFloat(pixels, widthPx, heightPx, originEvidence.origin);
    };
    const proposalCountsRgba = await renderFloatOutput(diagnosticNodes.proposalCounts, "proposal counts");
    const coverageRgba = await renderFloatOutput(diagnosticNodes.coverage, "coverage intermediates");
    const acceptedFootprintRgba = await renderFloatOutput(diagnosticNodes.acceptedFootprint, "accepted footprint");
    let finalAlphaMatchesNearTargetMaximumError = 0;
    for (let pixel = 0; pixel < pixelCount; pixel += 1) {
      finalAlphaMatchesNearTargetMaximumError = Math.max(
        finalAlphaMatchesNearTargetMaximumError,
        Math.abs((coverageRgba[pixel * 4 + 3] ?? 0) - (nearRgba[pixel * 4 + 3] ?? 0)),
      );
    }
    return {
      metadata: {
        evidenceScope: "native-research-fixture",
        rendererFamily: "webgpu-renderer",
        actualExecutionApi: "webgpu",
        internalFallback: "none",
        rendererGenerationId: input.rendererGenerationId,
        requestId: input.requestId,
        sceneId: input.sceneId,
        widthPx,
        heightPx,
        centerPixel,
        foregroundShape: {
          kind: "disc",
          centerPixel: foregroundCenterPixel,
          radiusPx: foregroundRadiusPx,
          signedCocNearMm: foregroundNearCocMm,
          signedCocBackgroundMm: backgroundFarCocMm,
          depthNear,
          depthBackground,
          maximumRadiusPx,
        },
        targetFormat: "rgba16float",
        diagnosticTargetFormat: "rgba32float",
        finalAlphaMatchesNearTargetMaximumError,
      },
      buffers: {
        nearRgba,
        proposalCountsRgba,
        coverageRgba,
        acceptedFootprintRgba,
        nearAlphaHalfBits: alphaBits,
      },
    };
  } finally {
    scenes.forEach((scene) => scene.clear());
    materials.forEach((material) => material.dispose());
    geometry?.dispose();
    targets.forEach((target) => target.dispose());
    textures.forEach((textureValue) => textureValue.dispose());
  }
};

const bytesPerPixelForObservedRgbaFormat = (format: string): number => {
  switch (format) {
    case "rgba8unorm": return 4;
    case "rgba16float": return 8;
    case "rgba32float": return 16;
    default: throw new Error(`No M5 attachment-size estimate for observed format ${format}`);
  }
};

const makeGroundGlassApertureGatherTargetAllocation = (
  name: GroundGlassApertureGatherOperationName,
  target: THREE.RenderTarget,
  format: string | null,
): GroundGlassApertureGatherTargetAllocation => {
  if (!format) throw new Error(`M5 target format is unresolved for ${name}`);
  const bytesPerPixel = bytesPerPixelForObservedRgbaFormat(format);
  return {
    name,
    widthPx: target.width,
    heightPx: target.height,
    format,
    bytesPerPixel,
    estimatedBytes: target.width * target.height * bytesPerPixel,
  };
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

type GroundGlassDisplayScene = Readonly<{
  scene: THREE.Scene;
  geometry: THREE.PlaneGeometry;
  material: MeshBasicNodeMaterial;
  camera: THREE.OrthographicCamera;
  mode: "raw" | "upright";
  presentationMode: "raw-diagnostic" | "m6-experimental-dof";
  updatePresentation: ((state: GroundGlassPresentationNodeState) => void) | null;
}>;

const createDisplayScene = (
  target: THREE.RenderTarget,
  mode: "raw" | "upright",
  presentation?: Readonly<{
    sourceTexture: THREE.Texture;
    state: GroundGlassPresentationNodeState;
  }>,
): GroundGlassDisplayScene => {
  const scene = new THREE.Scene();
  const geometry = new THREE.PlaneGeometry(2, 2);
  const presentationNode = presentation
    ? createGroundGlassPresentationNode(presentation.sourceTexture, presentation.state)
    : null;
  const material = presentationNode?.material ?? createDisplayMaterial(target, mode);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.z = -0.5;
  scene.add(mesh);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  camera.position.z = 0;
  camera.updateMatrixWorld();
  return {
    scene,
    geometry,
    material,
    camera,
    mode,
    presentationMode: presentationNode ? "m6-experimental-dof" : "raw-diagnostic",
    updatePresentation: presentationNode?.update ?? null,
  };
};

type GroundGlassM6bConformanceModule = typeof import("../groundGlassPhysicalOverlayConformance");

const updateGroundGlassM6bCalibrationTexture = (
  conformance: GroundGlassM6bConformanceModule,
  texture: THREE.DataTexture | null,
  requestSourceCrop: GroundGlassInspectionWindow,
  previewMode: "raw" | "upright",
  includeAlphaMatrix: boolean,
): Readonly<{ texture: THREE.DataTexture; sourceFingerprint: string }> => {
  const source = conformance.createGroundGlassM6bCalibrationSource({
    inspectionWindow: mapGroundGlassInspectionWindowToRttSourceCrop(requestSourceCrop, previewMode),
    previewMode,
    includeAlphaMatrix,
  });
  const nextTexture = texture ?? new THREE.DataTexture(
    source.rgba,
    source.widthPx,
    source.heightPx,
    THREE.RGBAFormat,
    THREE.FloatType,
  );
  if (texture) {
    const targetData = nextTexture.image.data as Float32Array;
    targetData.set(source.rgba);
  }
  nextTexture.colorSpace = THREE.NoColorSpace;
  nextTexture.minFilter = THREE.NearestFilter;
  nextTexture.magFilter = THREE.NearestFilter;
  nextTexture.wrapS = THREE.ClampToEdgeWrapping;
  nextTexture.wrapT = THREE.ClampToEdgeWrapping;
  nextTexture.generateMipmaps = false;
  nextTexture.flipY = false;
  nextTexture.unpackAlignment = 1;
  nextTexture.needsUpdate = true;
  return { texture: nextTexture, sourceFingerprint: source.sourceFingerprint };
};

const resolvePresentationNodeState = (
  request: GroundGlassFrameRequest,
  camera: THREE.PerspectiveCamera,
  widthPx: number,
  heightPx: number,
): GroundGlassPresentationNodeState => {
  const inspectionWindow = {
    active: request.inspectionWindow.active,
    centerU: request.inspectionWindow.centerU,
    centerV: request.inspectionWindow.centerV,
    widthFraction: request.inspectionWindow.widthFraction,
    heightFraction: request.inspectionWindow.heightFraction,
  };
  const coverage = resolveGroundGlassCoverageRenderState({
    state: request.opticsState.groundGlassCoverage,
    rawDebug: false,
    filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
    filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
    inspectionWindow,
    renderWidthPx: widthPx,
    renderHeightPx: heightPx,
  });
  const naturalIllumination = resolveGroundGlassNaturalIlluminationRenderState({
    state: request.opticsState.groundGlassNaturalIllumination,
    rawDebug: false,
    filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
    filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
    inspectionWindow,
  });
  const dof = createPhysicalDofState(request, camera, widthPx, heightPx);
  const throughputGain = resolveGroundGlassRelativeIlluminance({
    apertureFNumber: request.aperture,
    focalLengthMm: request.focalLengthMm,
    // Match WebGL: fallback optics may render, but cannot supply trusted bellows loss.
    imageDistanceMm: request.opticsState.diagnostics.fallbackApplied
      ? null
      : dof.optics.imageDistanceMm,
  });
  return {
    previewMode: request.previewMode,
    coverage,
    naturalIllumination,
    throughputGain,
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
  depthConfidenceStatus: "not-assessed",
  probeReadbackStatus: input.probeReadbackStatus ?? "not-requested",
  probeSummary: input.probeSummary ?? null,
  probeReadbackFailureReason: input.probeReadbackFailureReason ?? null,
  unsupportedReason: input.unsupportedReason ?? null,
  failureReason: input.failureReason ?? null,
});

const makeApertureGatherDiagnostic = (input: Readonly<{
  status: GroundGlassApertureGatherStatus;
  request: GroundGlassFrameRequest;
  generation: GroundGlassRendererGenerationIdentity;
  target: THREE.RenderTarget;
  settings?: GroundGlassApertureGatherSettings | null;
  farWidthPx?: number | null;
  farHeightPx?: number | null;
  actualFormats?: Readonly<{
    sourceColor: string | null;
    physical: string | null;
    validity: string | null;
    far: string | null;
    near: string | null;
    b1: string | null;
    composite: string | null;
    provenance: string | null;
  }>;
  completedPasses?: GroundGlassApertureGatherDiagnosticDetails["completedPasses"];
  physicalInputRequestId?: string | null;
  physicalInputFormatVerified?: boolean | null;
  b1Counts?: Partial<Pick<GroundGlassApertureGatherDiagnosticDetails,
    | "b1SelectedCenterCount"
    | "b1FallbackCount"
    | "fallbackFarGatherAccepted"
    | "fallbackGatherSelectionMismatch"
    | "fallbackMissingOrOutOfBoundsProvenance"
    | "fallbackSelectedCenterProvenanceMismatch"
    | "fallbackInvalidOrUnresolvedCenter"
    | "fallbackSelectedCenterNotFarEligible"
    | "fallbackUnusableGatherData"
    | "provenanceMismatchCount"
    | "sourceToGatherMappingMismatchCount"
    | "nominalGatherCenterMappingMismatchCount"
    | "farEligibilityRejectedCount"
  >> | null;
  cappedPixelCount?: number | null;
  maximumUncappedRadiusPx?: number | null;
  nearCoveragePixelCount?: number | null;
  nearRgbError?: number | null;
  nearAlphaError?: number | null;
  b1ReferenceError?: number | null;
  failureReason?: string | null;
  qualityGateReason?: string | null;
}>): GroundGlassApertureGatherDiagnosticDetails => ({
  status: input.status,
  requestId: input.request.identity.requestId,
  channelId: input.request.identity.channelId,
  sceneId: input.request.identity.sceneId,
  rendererGenerationId: input.generation.generationId,
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
  qualityMode: input.settings?.qualityMode ?? null,
  sampleCount: input.settings?.sampleCount ?? null,
  maximumRadiusPx: input.settings?.maximumRadiusPx ?? null,
  sourceWidthPx: input.target.width,
  sourceHeightPx: input.target.height,
  farGatherWidthPx: input.farWidthPx ?? null,
  farGatherHeightPx: input.farHeightPx ?? null,
  nearGatherWidthPx: input.farWidthPx ?? null,
  nearGatherHeightPx: input.farHeightPx ?? null,
  sourceColorFormat: input.actualFormats?.sourceColor ?? null,
  physicalInputFormat: input.actualFormats?.physical ?? null,
  validityInputFormat: input.actualFormats?.validity ?? null,
  farTargetFormat: input.actualFormats?.far ?? null,
  nearTargetFormat: input.actualFormats?.near ?? null,
  b1TargetFormat: input.actualFormats?.b1 ?? null,
  researchCompositeFormat: input.actualFormats?.composite ?? null,
  provenanceFormat: input.actualFormats?.provenance ?? null,
  physicalInputRequestId: input.physicalInputRequestId ?? null,
  validityInputRequestId: input.physicalInputRequestId ?? null,
  physicalInputFormatVerified: input.physicalInputFormatVerified ?? null,
  completedPasses: input.completedPasses ?? [],
  b1SelectedCenterCount: input.b1Counts?.b1SelectedCenterCount ?? null,
  b1FallbackCount: input.b1Counts?.b1FallbackCount ?? null,
  fallbackFarGatherAccepted: input.b1Counts?.fallbackFarGatherAccepted ?? null,
  fallbackGatherSelectionMismatch: input.b1Counts?.fallbackGatherSelectionMismatch ?? null,
  fallbackMissingOrOutOfBoundsProvenance: input.b1Counts?.fallbackMissingOrOutOfBoundsProvenance ?? null,
  fallbackSelectedCenterProvenanceMismatch: input.b1Counts?.fallbackSelectedCenterProvenanceMismatch ?? null,
  fallbackInvalidOrUnresolvedCenter: input.b1Counts?.fallbackInvalidOrUnresolvedCenter ?? null,
  fallbackSelectedCenterNotFarEligible: input.b1Counts?.fallbackSelectedCenterNotFarEligible ?? null,
  fallbackUnusableGatherData: input.b1Counts?.fallbackUnusableGatherData ?? null,
  provenanceMismatchCount: input.b1Counts?.provenanceMismatchCount ?? null,
  sourceToGatherMappingMismatchCount: input.b1Counts?.sourceToGatherMappingMismatchCount ?? null,
  nominalGatherCenterMappingMismatchCount: input.b1Counts?.nominalGatherCenterMappingMismatchCount ?? null,
  farEligibilityRejectedCount: input.b1Counts?.farEligibilityRejectedCount ?? null,
  cappedPixelCount: input.cappedPixelCount ?? null,
  maximumUncappedRadiusPx: input.maximumUncappedRadiusPx ?? null,
  nearCoveragePixelCount: input.nearCoveragePixelCount ?? null,
  nearRgbError: input.nearRgbError ?? null,
  nearAlphaError: input.nearAlphaError ?? null,
  full32Full64ReferenceError: null,
  b1ReferenceError: input.b1ReferenceError ?? null,
  b0ReferenceError: null,
  edgeRoiError: null,
  interiorFarRoiError: null,
  blurSuppressionMetric: null,
  fallbackHaloMetric: null,
  qualityGateStatus: "not-evaluated",
  qualityGateReason: input.qualityGateReason ?? "M5 remains research-only; no state has passed the full quality matrix",
  failureReason: input.failureReason ?? null,
  cleanupOutcome: "not-yet-run",
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
  let depthResolved = 0;
  let depthLimited = 0;
  let depthNotAssessed = 0;
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
    switch (sample.depthConfidence.status) {
      case "resolved": depthResolved += 1; break;
      case "depth-limited": depthLimited += 1; break;
      case "not-assessed": depthNotAssessed += 1; break;
    }
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
    depthResolved,
    depthLimited,
    depthNotAssessed,
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
  const m6BuildConfigurationEvidence = getGroundGlassM6BuildConfigurationEvidence();
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
  const [apertureGatherDiagnostics, setApertureGatherDiagnostics] =
    useState<GroundGlassApertureGatherDiagnosticDetails | null>(null);
  const [presentationDiagnostics, setPresentationDiagnostics] =
    useState<GroundGlassPresentationDiagnosticDetails | null>(null);
  const [m6ResourceProvisioning, setM6ResourceProvisioning] = useState<Readonly<{
    status: "inactive" | "provisioning" | "ready" | "failed";
    physicalReady: boolean;
    gatherReady: boolean;
    gatherTargetCount: number;
    initialRequestId: string | null;
    initialRawDebug: boolean | null;
  }>>({
    status: "inactive",
    physicalReady: false,
    gatherReady: false,
    gatherTargetCount: 0,
    initialRequestId: null,
    initialRawDebug: null,
  });
  const [lastDisplayedRequestId, setLastDisplayedRequestId] = useState<string | null>(null);
  const [lastDisplayedFrameId, setLastDisplayedFrameId] = useState<string | null>(null);

  requestRef.current = request;
  propsRef.current = { onAdapterStarted, onRendererMounted, onBackendDetails, onFrameResult, onAdapterDisposed, onFailure };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const attemptIdentity = createGroundGlassWebGpuAttemptIdentity(
      requestRef.current.identity.channelId,
      generation.generationId,
      requestRef.current.identity.requestId,
      requestRef.current.identity.sceneId,
    );
    const adapterRoot = canvas.parentElement;
    const effectToken = { generationId: generation.generationId };
    effectTokenRef.current = effectToken;
    let retired = false;
    let failureReported = false;
    let unregisterDeviceLossTestTrigger: () => void = () => undefined;
    let unregisterDeviceDestroyTestTrigger: () => void = () => undefined;
    let testDeviceDestroyRequested = false;
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
    let apertureGatherResources: GroundGlassApertureGatherResources | null = null;
    let apertureGatherResourcesProvisioned = false;
    let apertureGatherStatus: GroundGlassApertureGatherStatus = "disabled";
    let apertureGatherUnsupportedReason: string | null = null;
    let apertureGatherFailureReason: string | null = null;
    let apertureGatherSettings: GroundGlassApertureGatherSettings | null = null;
    let apertureGatherCompletedPasses: GroundGlassApertureGatherDiagnosticDetails["completedPasses"] = [];
    let apertureGatherFormats: {
      sourceColor: string | null;
      physical: string | null;
      validity: string | null;
      far: string | null;
      near: string | null;
      b1: string | null;
      composite: string | null;
      provenance: string | null;
      decisions: string | null;
    } | null = null;
    let apertureGatherDiagnostic: GroundGlassApertureGatherDiagnosticDetails | null = null;
    let physicalResourcesProvisioned = false;
    let m6SessionProvisioningAllowed = false;
    let physicalPassStatus: GroundGlassPhysicalCocDiagnosticDetails["status"] = "disabled";
    let physicalPassUnsupportedReason: string | null = null;
    let physicalPassFailureReason: string | null = null;
    let actualDepthFormat: string | null = null;
    let actualCocStorageFormat: string | null = null;
    let actualValidityStorageFormat: string | null = null;
    let physicalCompletedPasses: Array<"sceneDepth" | "physicalCoc" | "validity"> = [];
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let display: GroundGlassDisplayScene | null = null;
    let calibrationSourceTexture: THREE.DataTexture | null = null;
    let calibrationSourceDataFingerprint: string | null = null;
    let currentM6bPresentationState: GroundGlassPresentationNodeState | null = null;
    let m6bConformanceModule: GroundGlassM6bConformanceModule | null = null;
    let m6bConformanceModulePromise: Promise<GroundGlassM6bConformanceModule | null> | null = null;
    const loadM6bConformanceModule = async (): Promise<GroundGlassM6bConformanceModule | null> => {
      if (!import.meta.env.DEV) return null;
      if (m6bConformanceModule) return m6bConformanceModule;
      if (!m6bConformanceModulePromise) {
        // Resolve the fixture module only through Vite's dev server; never package its source data in production.
        const moduleUrl = import.meta.url.replace(
          /\/webgpu\/GroundGlassWebGPUAdapter\.tsx(?:\?.*)?$/,
          "/groundGlassPhysicalOverlayConformance.ts",
        );
        if (moduleUrl === import.meta.url) return null;
        m6bConformanceModulePromise = import(/* @vite-ignore */ moduleUrl)
          .then((module) => module as GroundGlassM6bConformanceModule)
          .then((module) => {
            m6bConformanceModule = module;
            return module;
          });
      }
      return m6bConformanceModulePromise;
    };
    let presentationDiagnostic: GroundGlassPresentationDiagnosticDetails | null = null;
    let subject: MountedSubject = null;
    let presentationLighting: ReturnType<typeof createPresentationLightingRig> | null = null;
    let worldLighting: ReturnType<typeof createWorldIlluminationRig> | null = null;
    let environmentRig: WorldEnvironmentRig | null = null;
    let cameraFrustum: GroundGlassFrustum | null = null;
    const firstAcceptedRequest = requestRef.current;
    setM6ResourceProvisioning((current) => ({
      ...current,
      initialRequestId: firstAcceptedRequest.identity.requestId,
      initialRawDebug: firstAcceptedRequest.rawDebug,
    }));

    const reportFailure = (error: unknown, stage: "initialization" | "runtime", failedPass: GroundGlassRenderOperationId | null) => {
      if (failureReported || retired || !isGenerationActive()) return;
      failureReported = true;
      adapterRoot?.setAttribute("data-failure-stage", stage);
      adapterRoot?.setAttribute("data-failure-operation", failedPass ?? "unknown");
      adapterRoot?.setAttribute("data-failure-reason", errorMessage(error));
      if (isGroundGlassM6PresentationRequest(requestRef.current)) {
        const previousPresentation = presentationDiagnostic ?? makePresentationDiagnostic({
          request: requestRef.current,
          generation,
          status: "pending",
          source: import.meta.env.DEV && isGroundGlassM6bCalibrationFixtureEnabledForRequest(requestRef.current)
            ? "m6b-calibration-fixture"
            : "m5-research-composite",
          throughputGain: null,
          naturalIllumination: "bypassed",
          coverage: "bypassed",
        });
        presentationDiagnostic = {
          ...previousPresentation,
          status: "failed",
          failureReason: errorMessage(error),
        };
        setPresentationDiagnostics(presentationDiagnostic);
      }
      recordGroundGlassWebGpuTestEvent({
        kind: "failure",
        attemptId: attemptIdentity.attemptId,
        channelId: requestRef.current.identity.channelId,
        generationId: generation.generationId,
        requestId: requestRef.current.identity.requestId,
        sceneId: requestRef.current.identity.sceneId,
        stage,
        operation: failedPass ?? "unknown",
        reason: errorMessage(error),
      });
      propsRef.current.onFailure(error instanceof Error ? error : new Error(errorMessage(error)), stage, failedPass);
    };

    const createRequestDisplay = async (
      displayRequest: GroundGlassFrameRequest,
      displayCamera: THREE.PerspectiveCamera,
      widthPx: number,
      heightPx: number,
    ): Promise<GroundGlassDisplayScene> => {
      if (!target) throw new Error("Ground Glass display cannot initialize without its source target");
      if (!isGroundGlassM6PresentationRequest(displayRequest)) {
        currentM6bPresentationState = null;
        presentationDiagnostic = null;
        setPresentationDiagnostics(null);
        return createDisplayScene(target, displayRequest.previewMode);
      }
      const composite = apertureGatherResources?.researchCompositeTarget;
      if (!composite) {
        throw new Error("M6 presentation requires the adapter-owned M5 composite target");
      }
      const requestState = resolvePresentationNodeState(displayRequest, displayCamera, widthPx, heightPx);
      const fixtureState = import.meta.env.DEV
        ? resolveGroundGlassM6bPresentationStateForTest(displayRequest, requestState)
        : null;
      const state = fixtureState ?? requestState;
      const fixtureEnabled = import.meta.env.DEV && fixtureState !== null &&
        isGroundGlassM6bCalibrationFixtureEnabledForRequest(displayRequest);
      currentM6bPresentationState = fixtureState;
      const presentationSource = fixtureEnabled ? "m6b-calibration-fixture" : "m5-research-composite";
      let sourceTexture: THREE.Texture;
      if (fixtureEnabled) {
        const conformance = await loadM6bConformanceModule();
        if (!conformance) throw new Error("M6B calibration helper did not load from its development-only module path");
        const updatedSource = updateGroundGlassM6bCalibrationTexture(
          conformance,
          calibrationSourceTexture,
          displayRequest.inspectionWindow,
          displayRequest.previewMode,
          isGroundGlassM6cAlphaFixtureEnabledForRequest(displayRequest),
        );
        calibrationSourceTexture = updatedSource.texture;
        calibrationSourceDataFingerprint = updatedSource.sourceFingerprint;
        sourceTexture = updatedSource.texture;
      } else {
        calibrationSourceDataFingerprint = null;
        sourceTexture = composite.texture;
      }
      presentationDiagnostic = makePresentationDiagnostic({
        request: displayRequest,
        generation,
        status: "pending",
        source: presentationSource,
        throughputGain: state.throughputGain,
        naturalIllumination: state.naturalIllumination.enabled ? "applied" : "bypassed",
        coverage: state.coverage.active ? "applied" : "bypassed",
      });
      setPresentationDiagnostics(presentationDiagnostic);
      return createDisplayScene(target, displayRequest.previewMode, {
        sourceTexture,
        state,
      });
    };

    const disposeOwned = (): Promise<void> => {
      if (disposePromise) return disposePromise;
      retired = true;
      activeRef.current = false;
      const cleanupStartedAt = performance.now();
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
          recordGroundGlassWebGpuTestEvent({
            kind: "cleanup",
            attemptId: attemptIdentity.attemptId,
            generationId: generation.generationId,
            outcome: "uncertain",
            wallClockMs: performance.now() - cleanupStartedAt,
          });
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
        if (calibrationSourceTexture) {
          await dispose(() => calibrationSourceTexture?.dispose());
          calibrationSourceTexture = null;
          calibrationSourceDataFingerprint = null;
          recordGroundGlassM6bFixtureResourceDisposedForTest();
        }
        if (apertureGatherResources) {
          apertureGatherResources.scenes.forEach((ownedScene) => ownedScene.clear());
          await dispose(() => apertureGatherResources?.materials.forEach((material) => material.dispose()));
          await dispose(() => apertureGatherResources?.geometry.dispose());
          await dispose(() => apertureGatherResources?.targets.forEach((ownedTarget) => ownedTarget.dispose()));
          apertureGatherResources = null;
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
        setApertureGatherDiagnostics(null);
        setPresentationDiagnostics(null);
        const outcome: GroundGlassCleanupOutcome = errors.length === 0 ? "confirmed" : "failed";
        const reason = errors.length ? errors.map(errorMessage).join("; ") : undefined;
        adapterRoot?.setAttribute("data-cleanup-outcome", outcome);
        if (reason) adapterRoot?.setAttribute("data-cleanup-reason", reason);
        recordGroundGlassWebGpuTestEvent({
          kind: "cleanup",
          attemptId: attemptIdentity.attemptId,
          generationId: generation.generationId,
          outcome,
          wallClockMs: performance.now() - cleanupStartedAt,
        });
        propsRef.current.onAdapterDisposed(generation, outcome, reason);
        if (errors.length) throw new AggregateError(errors, "Ground Glass WebGPU resource cleanup failed");
      })();
      return disposePromise;
    };
    disposeRef.current = disposeOwned;

    let mountedBackend: WebGpuBackendLike | null = null;
    let completedPasses: readonly ("sceneRender" | "presentation" | "textureDisplay")[] = [];
    let frameSequence = 0;
    let displayMode: "raw" | "upright" = requestRef.current.previewMode;

    const captureM6cAlphaReadback = async (
      captureRequest: Readonly<{ token: string }>,
      acceptedRequest: GroundGlassFrameRequest,
      isRequestCurrent: () => boolean,
    ): Promise<void> => {
      const runtime = runtimeRef.current;
      const mountedNativeWebGpu = runtime.status === "mounted" &&
        runtime.rendererFamily === "webgpu-renderer" &&
        runtime.actualExecutionApi === "webgpu" &&
        runtime.internalFallback === "none";
      const common: Omit<GroundGlassM6cAlphaCaptureReadback, "status" | "failureReason" | "identity" | "source" | "target" | "rendererOutputColorSpace" | "rendererToneMapping" | "material" | "samples" | "resourceAccounting"> = {
        token: captureRequest.token,
        captureId: `m6c-alpha-${captureRequest.token}`,
        evidenceScope: "controlled-native-presentation-fixture",
        rendererRevision: REVISION,
        rendererFamily: runtime.status === "mounted" ? runtime.rendererFamily : "unknown",
        actualExecutionApi: runtime.status === "mounted" ? runtime.actualExecutionApi : "unknown",
        internalFallback: runtime.status === "mounted" ? runtime.internalFallback : "unknown",
        applicationFallback: mountedNativeWebGpu ? false : null,
      };
      const publishUnavailable = (status: "unsupported" | "failed", failureReason: string): void => {
        publishGroundGlassM6cAlphaCaptureForTest({
          ...common,
          status,
          failureReason,
          identity: null,
          source: null,
          target: null,
          rendererOutputColorSpace: renderer?.outputColorSpace ?? null,
          rendererToneMapping: renderer?.toneMapping ?? null,
          material: null,
          samples: [],
          resourceAccounting: {
            allocationOperation: null,
            disposalOperation: null,
            targetAllocated: false,
            targetDisposed: false,
            disposalOutcome: "not-allocated",
            previousRenderTargetRestored: true,
            allocationCount: 0,
            disposalCount: 0,
          },
        });
      };

      if (
        !import.meta.env.DEV ||
        import.meta.env.VITE_GROUND_GLASS_WEBGPU_RAW_PILOT !== "true" ||
        import.meta.env.VITE_GROUND_GLASS_WEBGPU_M6_PRESENTATION !== "true" ||
        !isGroundGlassM6cAlphaFixtureEnabledForRequest(acceptedRequest) ||
        !isGroundGlassM6PresentationRequest(acceptedRequest) ||
        !mountedNativeWebGpu ||
        REVISION !== "186" ||
        !renderer ||
        !target ||
        !display ||
        display.presentationMode !== "m6-experimental-dof" ||
        !calibrationSourceTexture ||
        !calibrationSourceDataFingerprint ||
        !currentM6bPresentationState ||
        !m6bConformanceModule
      ) {
        publishUnavailable("unsupported", "M6C requires the authorized Architecture Rise calibration fixture and mounted Three.js r186 native WebGPU M6 material");
        return;
      }

      const sourceTexture = calibrationSourceTexture;
      const source = sourceTexture.image;
      const sourceData = source.data as Float32Array;
      const conformance = m6bConformanceModule;
      const alphaFixture = conformance.createGroundGlassM6bCalibrationSource({
        inspectionWindow: mapGroundGlassInspectionWindowToRttSourceCrop(acceptedRequest.inspectionWindow, acceptedRequest.previewMode),
        previewMode: acceptedRequest.previewMode,
        includeAlphaMatrix: true,
      });
      if (
        alphaFixture.alphaSamples.length !== 15 ||
        alphaFixture.sourceFingerprint !== calibrationSourceDataFingerprint ||
        source.width !== alphaFixture.widthPx ||
        source.height !== alphaFixture.heightPx
      ) {
        publishUnavailable("failed", "M6C controlled source alpha matrix does not match the uploaded fixture texture fingerprint");
        return;
      }

      const presentationState = currentM6bPresentationState;
      const presentationStateFingerprint = conformance.fingerprintGroundGlassM6bPresentationState(presentationState);
      const targetWidthPx = target.width;
      const targetHeightPx = target.height;
      const identity: GroundGlassM6cReadbackIdentity = {
        requestId: acceptedRequest.identity.requestId,
        channelId: acceptedRequest.identity.channelId,
        sceneId: acceptedRequest.identity.sceneId,
        rendererGenerationId: generation.generationId,
        sourceDataFingerprint: calibrationSourceDataFingerprint,
        presentationStateFingerprint,
        targetWidthPx,
        targetHeightPx,
        previewMode: acceptedRequest.previewMode,
        inspectionWindow: { ...acceptedRequest.inspectionWindow },
      };
      const material = display.material;
      const materialEvidence = {
        uuid: material.uuid,
        transparent: material.transparent,
        opacity: material.opacity,
        blending: material.blending === THREE.NoBlending ? "none" as const
          : material.blending === THREE.NormalBlending ? "normal" as const : "other" as const,
        depthWrite: material.depthWrite,
        depthTest: material.depthTest,
        colorWrite: material.colorWrite,
        alphaTest: material.alphaTest,
        premultipliedAlpha: material.premultipliedAlpha,
        samePresentationMaterialInstance: true as const,
      };
      const materialEquivalent = isGroundGlassM6cMaterialEquivalent(materialEvidence);
      const outputColorSpace = renderer.outputColorSpace;
      const toneMapping = renderer.toneMapping;
      const captureTarget = new THREE.RenderTarget(targetWidthPx, targetHeightPx, {
        format: THREE.RGBAFormat,
        type: THREE.UnsignedByteType,
        depthBuffer: false,
        stencilBuffer: false,
        samples: 0,
        generateMipmaps: false,
      });
      captureTarget.texture.colorSpace = THREE.NoColorSpace;
      captureTarget.texture.minFilter = THREE.NearestFilter;
      captureTarget.texture.magFilter = THREE.NearestFilter;
      captureTarget.texture.generateMipmaps = false;
      captureTarget.texture.wrapS = THREE.ClampToEdgeWrapping;
      captureTarget.texture.wrapT = THREE.ClampToEdgeWrapping;
      const allocationCount = recordGroundGlassM6cAlphaTargetAllocatedForTest();
      const savedTarget = renderer.getRenderTarget();
      const savedViewport = renderer.getViewport(new THREE.Vector4()).clone();
      const savedScissor = renderer.getScissor(new THREE.Vector4()).clone();
      const savedScissorTest = renderer.getScissorTest();
      const savedClearColor = renderer.getClearColor(new THREE.Color()).clone();
      const savedClearAlpha = renderer.getClearAlpha();
      const savedOutputColorSpace = renderer.outputColorSpace;
      const savedToneMapping = renderer.toneMapping;
      let rows: Map<number, Uint8Array> | null = null;
      let captureStatus: GroundGlassM6cAlphaCaptureReadback["status"] = "failed";
      let failureReason: string | null = null;
      let previousRenderTargetRestored = false;
      let targetDisposed = false;
      let disposalError: unknown = null;
      let samples: GroundGlassM6cAlphaSampleInput[] = [];
      let readbackBytes = 0;
      try {
        renderer.initRenderTarget(captureTarget);
        renderer.setRenderTarget(captureTarget);
        renderer.setViewport(0, 0, targetWidthPx, targetHeightPx);
        renderer.setScissorTest(false);
        renderer.setClearColor(new THREE.Color(0, 0, 0), 0);
        renderer.clear(true, true, true);
        renderer.render(display.scene, display.camera);
        const device = mountedBackend?.device;
        if (!device) throw new Error("M6C native alpha readback has no mounted WebGPU device");
        await device.queue.onSubmittedWorkDone();

        const samplePixels = alphaFixture.alphaSamples.map((sample) => ({
          sample,
          x: Math.max(0, Math.min(targetWidthPx - 1, Math.floor(sample.displayUvTopOrigin.u * targetWidthPx))),
          y: Math.max(0, Math.min(targetHeightPx - 1, Math.floor(sample.displayUvTopOrigin.v * targetHeightPx))),
        }));
        const readbackByRow = new Map<number, Promise<Uint8Array>>();
        samplePixels.forEach(({ y }) => {
          if (!readbackByRow.has(y)) {
            readbackByRow.set(y, renderer!.readRenderTargetPixelsAsync(captureTarget, 0, y, targetWidthPx, 1)
              .then((result) => {
                if (!(result instanceof Uint8Array) || result.length !== targetWidthPx * 4) {
                  throw new Error(`M6C RGBA8 readback returned an unsupported buffer shape: ${result.constructor.name}/${result.length}`);
                }
                return result;
              }));
          }
        });
        await holdGroundGlassM6cAlphaReadbackForTest();
        rows = new Map(await Promise.all([...readbackByRow].map(async ([y, promise]) => [y, await promise] as const)));
        readbackBytes = [...rows.values()].reduce((sum, row) => sum + row.byteLength, 0);

        const currentRequest = requestRef.current;
        const currentState = currentM6bPresentationState;
        const currentIdentity = currentState && calibrationSourceDataFingerprint
          ? {
              requestId: currentRequest.identity.requestId,
              channelId: currentRequest.identity.channelId,
              sceneId: currentRequest.identity.sceneId,
              rendererGenerationId: generation.generationId,
              sourceDataFingerprint: calibrationSourceDataFingerprint,
              presentationStateFingerprint: conformance.fingerprintGroundGlassM6bPresentationState(currentState),
              targetWidthPx: target.width,
              targetHeightPx: target.height,
              previewMode: currentRequest.previewMode,
              inspectionWindow: { ...currentRequest.inspectionWindow },
            } satisfies GroundGlassM6cReadbackIdentity
          : null;
        if (retired || !isGenerationActive() || !isRequestCurrent() || !currentIdentity ||
            !isGroundGlassM6cReadbackCurrent(identity, currentIdentity)) {
          captureStatus = "stale";
          failureReason = "Accepted request, channel, scene, generation, source, presentation, target size, preview, or inspection window changed before publication";
        } else {
          captureStatus = "measured";
          for (const { sample, x, y } of samplePixels) {
            const row = rows.get(y);
            if (!row) throw new Error(`M6C readback row ${y} is unavailable`);
            const displayUvTopOrigin = { u: (x + 0.5) / targetWidthPx, v: (y + 0.5) / targetHeightPx };
            const reference = evaluateGroundGlassPresentationReference({
              displayUvTopOrigin,
              previewMode: acceptedRequest.previewMode,
              filmWindow: presentationState.coverage.filmWindow,
              coverage: presentationState.coverage,
              naturalIllumination: presentationState.naturalIllumination,
              throughputGain: presentationState.throughputGain,
              sampleSource: ({ u, v }) => {
                const sx = Math.max(0, Math.min(source.width - 1, Math.floor(u * source.width)));
                const sy = Math.max(0, Math.min(source.height - 1, Math.floor(v * source.height)));
                const offset = (sy * source.width + sx) * 4;
                return [sourceData[offset] ?? 0, sourceData[offset + 1] ?? 0, sourceData[offset + 2] ?? 0, sourceData[offset + 3] ?? 0];
              },
            });
            const sampledX = Math.max(0, Math.min(source.width - 1, Math.floor(reference.sourceUvTopOrigin.u * source.width)));
            const sampledY = Math.max(0, Math.min(source.height - 1, Math.floor(reference.sourceUvTopOrigin.v * source.height)));
            const identityMatches = reference.inputLinearRgba.every((value, channel) => value === sample.linearRgba[channel]);
            const offset = x * 4;
            const bytes = [row[offset] ?? 0, row[offset + 1] ?? 0, row[offset + 2] ?? 0, row[offset + 3] ?? 0] as const;
            samples.push({
              id: sample.id,
              sourceTexel: { x: sampledX, y: sampledY },
              sourceUvTopOrigin: reference.sourceUvTopOrigin,
              displayUvTopOrigin,
              sourceLinearRgba: reference.inputLinearRgba,
              expectedFragmentRgba: reference.outputLinearRgba,
              actualTargetBytes: bytes,
              sourceSampleIdentityMatches: identityMatches,
              materialEquivalent,
            });
          }
        }
      } catch (error) {
        captureStatus = "failed";
        failureReason = errorMessage(error);
      } finally {
        try {
          renderer.setRenderTarget(savedTarget);
          renderer.setViewport(savedViewport);
          renderer.setScissor(savedScissor);
          renderer.setScissorTest(savedScissorTest);
          renderer.setClearColor(savedClearColor, savedClearAlpha);
          renderer.outputColorSpace = savedOutputColorSpace;
          renderer.toneMapping = savedToneMapping;
          previousRenderTargetRestored = renderer.getRenderTarget() === savedTarget;
          if (!previousRenderTargetRestored) {
            failureReason = [failureReason, "renderer state restore failed: M6C did not restore the prior render target"]
              .filter(Boolean)
              .join("; ");
            captureStatus = "failed";
          }
        } catch (error) {
          failureReason = [failureReason, `renderer state restore failed: ${errorMessage(error)}`].filter(Boolean).join("; ");
          captureStatus = "failed";
        }
        try {
          captureTarget.dispose();
          targetDisposed = true;
        } catch (error) {
          disposalError = error;
          failureReason = [failureReason, `alpha target disposal failed: ${errorMessage(error)}`].filter(Boolean).join("; ");
          captureStatus = "failed";
        }
      }
      const disposalCount = targetDisposed ? recordGroundGlassM6cAlphaTargetDisposedForTest(true) : 0;
      if (!targetDisposed) recordGroundGlassM6cAlphaTargetDisposedForTest(false);
      if (disposalError) samples = [];
      const latestAfterReadback = requestRef.current;
      const stateAfterReadback = currentM6bPresentationState;
      const identityAfterReadback = stateAfterReadback && calibrationSourceDataFingerprint
        ? {
            requestId: latestAfterReadback.identity.requestId,
            channelId: latestAfterReadback.identity.channelId,
            sceneId: latestAfterReadback.identity.sceneId,
            rendererGenerationId: generation.generationId,
            sourceDataFingerprint: calibrationSourceDataFingerprint,
            presentationStateFingerprint: conformance.fingerprintGroundGlassM6bPresentationState(stateAfterReadback),
            targetWidthPx: target.width,
            targetHeightPx: target.height,
            previewMode: latestAfterReadback.previewMode,
            inspectionWindow: { ...latestAfterReadback.inspectionWindow },
          } satisfies GroundGlassM6cReadbackIdentity
        : null;
      const stillCurrent = !retired && isGenerationActive() && isRequestCurrent() && identityAfterReadback !== null &&
        isGroundGlassM6cReadbackCurrent(identity, identityAfterReadback);
      const status: GroundGlassM6cAlphaCaptureReadback["status"] = captureStatus === "measured" && !stillCurrent
        ? "stale"
        : captureStatus;
      publishGroundGlassM6cAlphaCaptureForTest({
        ...common,
        status,
        failureReason: status === "stale"
          ? failureReason ?? "The alpha readback became stale before publication"
          : failureReason,
        identity,
        source: {
          format: "rgba32float",
          colorSpace: "no-color-space",
          sampling: "nearest",
          widthPx: source.width,
          heightPx: source.height,
          sourceDataFingerprint: calibrationSourceDataFingerprint,
        },
        target: {
          format: "rgba8unorm",
          colorSpace: "no-color-space",
          channelOrder: "rgba",
          widthPx: targetWidthPx,
          heightPx: targetHeightPx,
          estimatedBytes: targetWidthPx * targetHeightPx * 4,
          readbackBytes,
          clearRgba: [0, 0, 0, 0],
        },
        rendererOutputColorSpace: outputColorSpace,
        rendererToneMapping: toneMapping,
        material: materialEvidence,
        samples: status === "measured" ? samples : [],
        resourceAccounting: {
          allocationOperation: "explicit-m6c-test-capture",
          disposalOperation: "capture-finally",
          targetAllocated: true,
          targetDisposed,
          disposalOutcome: targetDisposed ? "confirmed" : "failed",
          previousRenderTargetRestored,
          allocationCount,
          disposalCount,
        },
      });
    };

    const renderNow: RenderNow = (requested) => {
      const queued = operationTailRef.current.then(async () => {
        const latest = requestRef.current;
        const isRequestCurrent = () => !retired
          && isGenerationActive()
          && activeRef.current
          && requestRef.current.identity.requestId === latest.identity.requestId
          && requestRef.current.identity.channelId === latest.identity.channelId
          && requestRef.current.identity.sceneId === latest.identity.sceneId;
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
        let physicalDiagnostic: GroundGlassPhysicalCocDiagnosticDetails | undefined;

        const executePhysicalForRequest =
          physicalResourcesProvisioned && isGroundGlassPhysicalCocResearchEnabled(latest);
        const executeGatherForRequest =
          apertureGatherResourcesProvisioned && isGroundGlassApertureGatherResearchEnabled(latest);
        const mountedExecutionApi = runtimeRef.current.status === "mounted"
          ? runtimeRef.current.actualExecutionApi
          : "unknown";

        let sceneRenderTiming: GroundGlassGpuPassTiming | null = null;
        let physicalCocFootprintTiming: GroundGlassGpuPassTiming | null = null;
        let physicalValidityTiming: GroundGlassGpuPassTiming | null = null;
        let presentationPassTiming: GroundGlassGpuPassTiming | null = null;
        const aperturePassTimings: Array<Readonly<{
          name: GroundGlassApertureGatherOperationName;
          timing: GroundGlassGpuPassTiming;
        }>> = [];
        let failedPass: GroundGlassRenderOperationId | null = null;
        try {
          const dimensions = resolveGroundGlassRttDimensions({
            logicalWidth: latest.widthPx,
            logicalHeight: latest.heightPx,
            renderQuality: latest.renderQuality,
            devicePixelRatio: 1,
          });
          target.setSize(dimensions.internalWidthPx, dimensions.internalHeightPx);
          const resizeInitializedTarget = (
            renderTarget: THREE.RenderTarget,
            widthPx: number,
            heightPx: number,
          ) => {
            if (renderTarget.width === widthPx && renderTarget.height === heightPx) return;
            renderTarget.setSize(widthPx, heightPx);
            renderer!.initRenderTarget(renderTarget);
          };
          if (physicalResourcesProvisioned && physicalTarget && validityTarget) {
            resizeInitializedTarget(physicalTarget, target.width, target.height);
            resizeInitializedTarget(validityTarget, target.width, target.height);
          }
          if (apertureGatherResourcesProvisioned && apertureGatherResources && apertureGatherSettings) {
            const gatherWidthPx = Math.max(1, Math.round(target.width * apertureGatherSettings.gatherScale));
            const gatherHeightPx = Math.max(1, Math.round(target.height * apertureGatherSettings.gatherScale));
            [
              [apertureGatherResources.farTarget, gatherWidthPx, gatherHeightPx],
              [apertureGatherResources.nearTarget, gatherWidthPx, gatherHeightPx],
              [apertureGatherResources.gatherIdentityTarget, gatherWidthPx, gatherHeightPx],
              [apertureGatherResources.gatherCenterProvenanceTarget, gatherWidthPx, gatherHeightPx],
              [apertureGatherResources.sourceIdentityTarget, target.width, target.height],
              [apertureGatherResources.selectedProvenanceTarget, target.width, target.height],
              [apertureGatherResources.b1Target, target.width, target.height],
              [apertureGatherResources.researchCompositeTarget, target.width, target.height],
              [apertureGatherResources.b1DecisionTarget, target.width, target.height],
            ].forEach(([renderTarget, widthPx, heightPx]) => {
              resizeInitializedTarget(
                renderTarget as THREE.RenderTarget,
                widthPx as number,
                heightPx as number,
              );
            });
          }
          renderer.setSize(Math.max(1, latest.widthPx), Math.max(1, latest.heightPx), false);
          const cameraConfiguration = makeCamera(renderer, latest, target.width, target.height);
          camera = cameraConfiguration.camera;
          cameraFrustum = cameraConfiguration.frustum;
          const mappedSourceCrop = latest.inspectionWindow as unknown as GroundGlassInspectionWindow;
          setTargetSize({ width: target.width, height: target.height });
          setSourceCrop(mappedSourceCrop);

          if (apertureGatherResourcesProvisioned && apertureGatherResources && apertureGatherSettings) {
            // Readiness includes dimensions for this accepted request; Raw still executes no M4/M5 passes.
            apertureGatherCompletedPasses = [];
            apertureGatherStatus = "ready";
            apertureGatherFailureReason = null;
            apertureGatherUnsupportedReason = null;
            apertureGatherDiagnostic = makeApertureGatherDiagnostic({
              status: "ready",
              request: latest,
              generation,
              target,
              settings: apertureGatherSettings,
              farWidthPx: Math.max(1, Math.round(target.width * apertureGatherSettings.gatherScale)),
              farHeightPx: Math.max(1, Math.round(target.height * apertureGatherSettings.gatherScale)),
              failureReason: null,
              qualityGateReason: null,
            });
            setApertureGatherDiagnostics(apertureGatherDiagnostic);
            // Let an M6 request create a fresh completion record after the actual gather passes finish.
            apertureGatherDiagnostic = null;
          }
          if (physicalResourcesProvisioned && mountedExecutionApi === "webgpu") {
            physicalPassStatus = "ready";
            physicalCompletedPasses = [];
            physicalDiagnostic = makePhysicalCocDiagnostic({
              status: "ready",
              request: latest,
              generation,
              target,
              actualExecutionApi: mountedExecutionApi,
              depthFormat: null,
              cocStorageFormat: null,
              validityStorageFormat: null,
              completedPasses: [],
            });
            setPhysicalCocDiagnostics(physicalDiagnostic);
          }

          const m6PresentationRequested = isGroundGlassM6PresentationRequest(latest);
          const requestedDisplayMode = m6PresentationRequested
            ? "m6-experimental-dof"
            : "raw-diagnostic";
          if (display.presentationMode !== requestedDisplayMode ||
              (!m6PresentationRequested && displayMode !== latest.previewMode)) {
            display.scene.clear();
            const previousMaterial = display.material;
            const previousGeometry = display.geometry;
            display = await createRequestDisplay(latest, camera, target.width, target.height);
            displayMode = latest.previewMode;
            previousMaterial.dispose();
            previousGeometry.dispose();
          } else if (m6PresentationRequested) {
            const requestState = resolvePresentationNodeState(
              latest,
              camera,
              target.width,
              target.height,
            );
            const fixtureState = import.meta.env.DEV
              ? resolveGroundGlassM6bPresentationStateForTest(latest, requestState)
              : null;
            const presentationState = fixtureState ?? requestState;
            currentM6bPresentationState = fixtureState;
            const fixtureEnabled = import.meta.env.DEV && fixtureState !== null &&
              isGroundGlassM6bCalibrationFixtureEnabledForRequest(latest);
            if (fixtureEnabled) {
              const conformance = await loadM6bConformanceModule();
              if (!conformance) throw new Error("M6B calibration helper did not load from its development-only module path");
              const updatedSource = updateGroundGlassM6bCalibrationTexture(
                conformance,
                calibrationSourceTexture,
                latest.inspectionWindow,
                latest.previewMode,
                isGroundGlassM6cAlphaFixtureEnabledForRequest(latest),
              );
              calibrationSourceTexture = updatedSource.texture;
              calibrationSourceDataFingerprint = updatedSource.sourceFingerprint;
            } else {
              calibrationSourceDataFingerprint = null;
            }
            display.updatePresentation?.(presentationState);
            presentationDiagnostic = makePresentationDiagnostic({
              request: latest,
              generation,
              status: "pending",
              source: fixtureEnabled ? "m6b-calibration-fixture" : "m5-research-composite",
              throughputGain: presentationState.throughputGain,
              naturalIllumination: presentationState.naturalIllumination.enabled ? "applied" : "bypassed",
              coverage: presentationState.coverage.active ? "applied" : "bypassed",
            });
            setPresentationDiagnostics(presentationDiagnostic);
            displayMode = latest.previewMode;
          }

          failedPass = "sceneRender";
          const scenePassStartedAt = performance.now();
          renderer.setRenderTarget(target);
          renderer.setViewport(0, 0, target.width, target.height);
          renderer.setScissorTest(false);
          renderer.setClearColor(SKY_COLOR, 1);
          renderer.clear(true, true, true);
          const sceneRendererCallStartedAt = performance.now();
          renderer.render(scene, camera);
          const sceneRendererCallCpuMs = performance.now() - sceneRendererCallStartedAt;
          const device = mountedBackend?.device;
          if (!device) throw new Error("Native WebGPU scene submission has no initialized GPU device");
          const sceneQueueWaitStartedAt = performance.now();
          await holdGroundGlassWebGpuQueueCompletion();
          throwIfGroundGlassWebGpuFailureInjected("queue-completion");
          await device.queue.onSubmittedWorkDone();
          recordGroundGlassWebGpuTestEvent({
            kind: "queue-completion-settled",
            attemptId: attemptIdentity.attemptId,
            generationId: generation.generationId,
            requestId: latest.identity.requestId,
            operation: "sceneRender",
          });
          const sceneQueueCompletionWaitMs = performance.now() - sceneQueueWaitStartedAt;
          sceneRenderTiming = {
            rendererCallCpuMs: sceneRendererCallCpuMs,
            queueCompletionWaitMs: sceneQueueCompletionWaitMs,
            wallClockMs: performance.now() - scenePassStartedAt,
          };
          if (retired || !isGenerationActive() || !activeRef.current) return;
          if (!isRequestCurrent()) return;
          throwIfGroundGlassWebGpuFailureInjected("scene-render-after-submit");

          if (
            executePhysicalForRequest &&
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
                const physicalFootprintStartedAt = performance.now();
                renderer.setRenderTarget(physicalTarget);
                renderer.setViewport(0, 0, physicalTarget.width, physicalTarget.height);
                renderer.setScissorTest(false);
                renderer.clear(true, false, false);
                const physicalFootprintRendererStartedAt = performance.now();
                renderer.render(physicalScene, physicalCamera);
                const physicalFootprintRendererCallCpuMs =
                  performance.now() - physicalFootprintRendererStartedAt;
                const physicalFootprintQueueStartedAt = performance.now();
                await submitPhysicalWork(device);
                physicalCocFootprintTiming = {
                  rendererCallCpuMs: physicalFootprintRendererCallCpuMs,
                  queueCompletionWaitMs: performance.now() - physicalFootprintQueueStartedAt,
                  wallClockMs: performance.now() - physicalFootprintStartedAt,
                };
                if (retired || !isGenerationActive() || !activeRef.current) return;
                if (!isRequestCurrent()) return;
                actualCocStorageFormat = observeTextureFormat(mountedBackend, physicalTarget.texture);
                if (actualCocStorageFormat !== "rgba16float") {
                  physicalPassStatus = "unsupported";
                  physicalPassUnsupportedReason =
                    "RGBA16F physical target required; observed " + (actualCocStorageFormat ?? "unknown");
                } else {
                  throwIfGroundGlassWebGpuFailureInjected("physical-coc-after-submit");
                  physicalCompletedPasses.push("physicalCoc");
                  const physicalValidityStartedAt = performance.now();
                  renderer.setRenderTarget(validityTarget);
                  renderer.setViewport(0, 0, validityTarget.width, validityTarget.height);
                  renderer.clear(true, false, false);
                  const physicalValidityRendererStartedAt = performance.now();
                  renderer.render(validityScene, physicalCamera);
                  const physicalValidityRendererCallCpuMs =
                    performance.now() - physicalValidityRendererStartedAt;
                  const physicalValidityQueueStartedAt = performance.now();
                  await submitPhysicalWork(device);
                  physicalValidityTiming = {
                    rendererCallCpuMs: physicalValidityRendererCallCpuMs,
                    queueCompletionWaitMs: performance.now() - physicalValidityQueueStartedAt,
                    wallClockMs: performance.now() - physicalValidityStartedAt,
                  };
                  if (retired || !isGenerationActive() || !activeRef.current) return;
                  if (!isRequestCurrent()) return;
                  actualValidityStorageFormat = observeTextureFormat(mountedBackend, validityTarget.texture);
                  if (actualValidityStorageFormat !== "rgba8unorm") {
                    physicalPassStatus = "unsupported";
                    physicalPassUnsupportedReason =
                      "RGBA8 validity target required; observed " + (actualValidityStorageFormat ?? "unknown");
                  } else {
                    throwIfGroundGlassWebGpuFailureInjected("physical-validity-after-submit");
                    physicalCompletedPasses.push("validity");
                    physicalPassStatus = "completed";
                  }
                }
              }
            } catch (error) {
              if (error instanceof GroundGlassPhysicalSubmissionFailure) throw error;
              physicalPassStatus = "failed";
              physicalPassFailureReason = errorMessage(error);
            }
            if (failureReported) return;
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
            if (!isRequestCurrent()) return;

            const probeRequest = physicalPassStatus === "completed"
              ? consumeGroundGlassPhysicalCocProbeRequestForTest()
              : null;
            if (probeRequest) {
              failedPass = "cocFootprint";
              const validProbe = (probe: GroundGlassPhysicalCocControlledKernelCase["probe"]) =>
                probe.id.trim().length > 0 &&
                Number.isFinite(probe.u) && probe.u >= 0 && probe.u <= 1 &&
                Number.isFinite(probe.v) && probe.v >= 0 && probe.v <= 1 &&
                (!probe.controlledObjectPointMm || probe.controlledObjectPointMm.every(Number.isFinite)) &&
                (!probe.explicitParallelLimitIdentity || Boolean(probe.controlledObjectPointMm)) &&
                (probe.focalLengthOverrideMm === undefined ||
                  (Number.isFinite(probe.focalLengthOverrideMm) && probe.focalLengthOverrideMm > 0));
              const validKernelOverride = (override: GroundGlassPhysicalCocProbeKernelOverride) => {
                const vectors = [
                  override.lens.centerWorldM,
                  override.lens.planeNormal,
                  override.lens.planeBasisX,
                  override.lens.planeBasisY,
                  override.film.planePointWorldM,
                  override.film.planeNormal,
                  override.film.planeBasisX,
                  override.film.planeBasisY,
                ];
                return vectors.every((value) => [value.x, value.y, value.z].every(Number.isFinite)) &&
                  Number.isFinite(override.optics.focalLengthMm) && override.optics.focalLengthMm > 0 &&
                  Number.isFinite(override.optics.apertureFNumber) && override.optics.apertureFNumber > 0;
              };
              const validProbeRequest =
                probeRequest.probes.length > 0 &&
                probeRequest.probes.length <= 16 &&
                probeRequest.probes.every(validProbe) &&
                (probeRequest.controlledKernelCases?.length ?? 0) <= 16 &&
                (probeRequest.controlledKernelCases ?? []).every((testCase) =>
                  testCase.id.trim().length > 0 &&
                  Boolean(testCase.probe.controlledObjectPointMm) &&
                  validProbe(testCase.probe) &&
                  validKernelOverride(testCase.kernelOverride),
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
                  await submitPhysicalWork(device);
                  await holdGroundGlassPhysicalCocProbeReadbackForTest();
                  if (retired || !isGenerationActive() || !activeRef.current) return;
                  if (!isRequestCurrent()) return;
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
                  if (!isRequestCurrent()) return;
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
                      storedFootprintMm: probe.controlledObjectPointMm || probe.focalLengthOverrideMm !== undefined
                        ? null
                        : [
                            storedPixels[offset]!,
                            storedPixels[offset + 1]!,
                            storedPixels[offset + 2]!,
                            storedPixels[offset + 3]!,
                          ] as const,
                      validityCode: probe.controlledObjectPointMm || probe.focalLengthOverrideMm !== undefined
                        ? kernelValidityPixels[offset]!
                        : validityPixels[offset]!,
                      focalBranchCode: Math.round(focalPixels[offset + 2]!),
                      depthConfidence: assessGroundGlassPhysicalDepthConfidence({
                        expectedWorldM: probe.expectedWorldM ?? null,
                        reconstructedWorldM: [
                          worldPixels[offset]!,
                          worldPixels[offset + 1]!,
                          worldPixels[offset + 2]!,
                        ],
                        expectedSurfaceId: probe.expectedSurfaceId ?? null,
                        lensCenterWorldM: [dof.lens.centerWorldM.x, dof.lens.centerWorldM.y, dof.lens.centerWorldM.z],
                        lensNormal: [dof.lens.planeNormal.x, dof.lens.planeNormal.y, dof.lens.planeNormal.z],
                        focalLengthMm: probe.focalLengthOverrideMm ?? dof.optics.focalLengthMm,
                        sampledDepth: worldPixels[offset + 3]!,
                        controlledObjectPoint: Boolean(probe.controlledObjectPointMm),
                        kernelBranchCode: Math.round(focalPixels[offset + 2]!),
                      }),
                    };
                  });
                  const controlledKernelCases: GroundGlassPhysicalCocControlledKernelReadback[] = [];
                  for (const testCase of probeRequest.controlledKernelCases ?? []) {
                    controlledKernelCases.push(await readControlledPhysicalKernelCase({
                      renderer,
                      device,
                      backend: mountedBackend!,
                      depthTexture: target.depthTexture,
                      camera: physicalCamera!,
                      dof,
                      testCase,
                    }));
                  }
                  if (
                    retired || failureReported || !isRequestCurrent()
                  ) return;
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
                    controlledKernelCases,
                  };
                  publishGroundGlassPhysicalCocProbeReadbackForTest(readback);
                  physicalDiagnostic = {
                    ...physicalDiagnostic,
                    probeReadbackStatus: "completed",
                    probeSummary: makePhysicalProbeSummary(readback, dof),
                    probeReadbackFailureReason: null,
                  };
                } catch (error) {
                  if (error instanceof GroundGlassPhysicalSubmissionFailure) throw error;
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
            failedPass = null;
          }

          // M5 research targets are adapter-owned and run after the exact current M4 inputs.
          // Their output never replaces the existing M3 Raw display target.
          const isApertureRequestCurrent = isRequestCurrent;
          const mountedRuntime = runtimeRef.current;
          if (executeGatherForRequest
              && mountedRuntime.status === "mounted"
              && mountedRuntime.rendererFamily === "webgpu-renderer"
              && mountedRuntime.actualExecutionApi === "webgpu") {
            const captureRequest = consumeGroundGlassApertureGatherCaptureForTest();
            const b1BoundaryProbeRequest = consumeGroundGlassB1BoundaryProbeForTest();
            const resources = apertureGatherResources;
            const eligibility = resolveGroundGlassApertureGatherResearchEligibility({
              request: latest,
              runtime: {
                rendererFamily: mountedRuntime.rendererFamily,
                actualExecutionApi: mountedRuntime.actualExecutionApi,
              },
              physicalStatus: physicalDiagnostic?.status ?? "disabled",
              physicalRequestId: physicalDiagnostic?.requestId ?? null,
              expectedRendererRevision: `r${REVISION}`,
            });
            apertureGatherCompletedPasses = [];
            apertureGatherFailureReason = null;
            apertureGatherUnsupportedReason = eligibility.status === "eligible" ? null : eligibility.reason;
            apertureGatherFormats = null;
            if (eligibility.status !== "eligible" || !resources || !physicalDiagnostic) {
              apertureGatherStatus = "unsupported";
              apertureGatherFailureReason = null;
            } else {
              try {
                const settings = resolveGroundGlassApertureGatherSettings(
                  latest.scene.id,
                  captureRequest?.qualityMode ?? "half32",
                  captureRequest?.maximumRadiusPx,
                );
                apertureGatherSettings = settings;
                const sourceWidthPx = target.width;
                const sourceHeightPx = target.height;
                const gatherWidthPx = Math.max(1, Math.round(sourceWidthPx * settings.gatherScale));
                const gatherHeightPx = Math.max(1, Math.round(sourceHeightPx * settings.gatherScale));
                resources.farTarget.setSize(gatherWidthPx, gatherHeightPx);
                resources.nearTarget.setSize(gatherWidthPx, gatherHeightPx);
                resources.gatherIdentityTarget.setSize(gatherWidthPx, gatherHeightPx);
                resources.gatherCenterProvenanceTarget.setSize(gatherWidthPx, gatherHeightPx);
                resources.sourceIdentityTarget.setSize(sourceWidthPx, sourceHeightPx);
                resources.selectedProvenanceTarget.setSize(sourceWidthPx, sourceHeightPx);
                resources.b1Target.setSize(sourceWidthPx, sourceHeightPx);
                resources.researchCompositeTarget.setSize(sourceWidthPx, sourceHeightPx);
                resources.b1DecisionTarget.setSize(sourceWidthPx, sourceHeightPx);
                resources.sourceIdentityNodes.update(sourceWidthPx, sourceHeightPx);
                resources.gatherIdentityNodes.update(gatherWidthPx, gatherHeightPx);
                resources.gatherCenterProvenanceNodes.update(sourceWidthPx, sourceHeightPx);
                resources.b1Nodes.update({
                  sourceWidthPx,
                  sourceHeightPx,
                  gatherWidthPx,
                  gatherHeightPx,
                });
                const sampledFilmWidthMm = CAMERA_CONSTANTS.filmWidthMm
                  * latest.inspectionWindow.widthFraction;
                const sampledFilmHeightMm = CAMERA_CONSTANTS.filmHeightMm
                  * latest.inspectionWindow.heightFraction;
                resources.gatherNodes.update({
                  sourceWidthPx,
                  sourceHeightPx,
                  sampledFilmWidthMm,
                  sampledFilmHeightMm,
                  maximumRadiusPx: settings.maximumRadiusPx,
                  sampleCount: settings.sampleCount,
                  inverseProjection: camera.projectionMatrixInverse,
                });
                // Recreate resized M5 attachments without drawing so the exact WebGPU
                // descriptors are available for fail-closed format preflight.
                [
                  resources.farTarget,
                  resources.nearTarget,
                  resources.b1Target,
                  resources.sourceIdentityTarget,
                  resources.gatherIdentityTarget,
                  resources.gatherCenterProvenanceTarget,
                  resources.selectedProvenanceTarget,
                  resources.b1DecisionTarget,
                ].forEach((preflightTarget) => renderer!.initRenderTarget(preflightTarget));
                if (isGroundGlassM6PresentationRequest(latest)) {
                  throwIfGroundGlassWebGpuFailureInjected("m6-presentation-target-initialization");
                }
                renderer.initRenderTarget(resources.researchCompositeTarget);
                const outputFormats = {
                  sourceColor: observeTextureFormat(mountedBackend!, target.texture),
                  depth: observeTextureFormat(mountedBackend!, target.depthTexture),
                  physical: observeTextureFormat(mountedBackend!, physicalTarget?.texture),
                  validity: observeTextureFormat(mountedBackend!, validityTarget?.texture),
                  far: observeTextureFormat(mountedBackend!, resources.farTarget.texture),
                  near: observeTextureFormat(mountedBackend!, resources.nearTarget.texture),
                  b1: observeTextureFormat(mountedBackend!, resources.b1Target.texture),
                  composite: observeTextureFormat(mountedBackend!, resources.researchCompositeTarget.texture),
                  provenance: [
                    resources.sourceIdentityTarget,
                    resources.gatherIdentityTarget,
                    resources.gatherCenterProvenanceTarget,
                    resources.selectedProvenanceTarget,
                  ].every((ownedTarget) =>
                    observeTextureFormat(mountedBackend!, ownedTarget.texture) === "rgba32float",
                  ) ? "rgba32float" : null,
                  decisions: observeTextureFormat(mountedBackend!, resources.b1DecisionTarget.texture),
                };
                apertureGatherFormats = outputFormats;
                const formatEligibility = resolveGroundGlassApertureGatherFormatEligibility({
                  observedFormats: outputFormats,
                });
                if (formatEligibility.status !== "eligible") {
                  apertureGatherStatus = "unsupported";
                  apertureGatherUnsupportedReason = formatEligibility.reason;
                  apertureGatherFailureReason = null;
                } else {
                const runPass = async (
                  operation: GroundGlassRenderOperationId,
                  targetToRender: THREE.RenderTarget,
                  sceneToRender: THREE.Scene,
                  passName: GroundGlassApertureGatherDiagnosticDetails["completedPasses"][number],
                  timingName: GroundGlassApertureGatherOperationName,
                  failurePoint?: "aperture-far-after-submit"
                    | "aperture-near-after-submit"
                    | "aperture-b1-after-submit"
                    | "aperture-composite-after-submit",
                ) => {
                  failedPass = operation;
                  const timing = await runGroundGlassApertureGatherPass({
                    renderer: renderer!,
                    device,
                    target: targetToRender,
                    scene: sceneToRender,
                    camera: physicalCamera!,
                    isCurrent: isApertureRequestCurrent,
                  });
                  if (timing === null) return null;
                  apertureGatherCompletedPasses = [...apertureGatherCompletedPasses, passName];
                  aperturePassTimings.push({ name: timingName, timing });
                  if (failurePoint) throwIfGroundGlassWebGpuFailureInjected(failurePoint);
                  failedPass = null;
                  return timing;
                };

                if (await runPass("composite", resources.sourceIdentityTarget,
                  resources.sourceIdentityScene, "sourceIdentity", "sourceIdentity") === null) return;
                if (await runPass("composite", resources.gatherIdentityTarget,
                  resources.gatherIdentityScene, "gatherIdentity", "gatherIdentity") === null) return;
                if (await runPass("composite", resources.gatherCenterProvenanceTarget,
                  resources.gatherCenterProvenanceScene, "gatherCenterProvenance", "gatherCenterProvenance") === null) return;
                if (await runPass("farGather", resources.farTarget,
                  resources.farScene, "farGather", "farGather", "aperture-far-after-submit") === null) return;
                if (await runPass("nearGather", resources.nearTarget,
                  resources.nearScene, "nearGather", "nearGather", "aperture-near-after-submit") === null) return;

                const nearBeforeB1Raw = captureRequest
                  ? compactWebGpuReadbackRows(
                      await renderer.readRenderTargetPixelsAsync(
                        resources.nearTarget, 0, 0, gatherWidthPx, gatherHeightPx,
                      ) as GroundGlassReadbackPixels,
                      gatherWidthPx,
                      gatherHeightPx,
                    )
                  : null;
                if (await runPass("composite", resources.selectedProvenanceTarget,
                  resources.selectedProvenanceScene, "selectedProvenance", "selectedProvenance") === null) return;
                if (await runPass("composite", resources.b1Target,
                  resources.b1Scene, "farReconstructionB1", "b1Reconstruction", "aperture-b1-after-submit") === null) return;
                if (await runPass("composite", resources.b1DecisionTarget,
                  resources.b1DecisionScene, "farReconstructionB1", "b1Decision") === null) return;
                if (await runPass("composite", resources.researchCompositeTarget,
                  resources.researchCompositeScene, "researchComposite", "researchComposite", "aperture-composite-after-submit") === null) return;
                apertureGatherStatus = "completed";
                apertureGatherUnsupportedReason = null;
                apertureGatherFailureReason = null;

                let m6dCompositeContractProbe: GroundGlassM6dCompositeContractProbeReadback | null = null;
                if (import.meta.env.DEV && captureRequest?.includeM6dCompositeContractProbe === true) {
                  const { runGroundGlassM6dCompositeContractProbe } = await import(
                    "./groundGlassM6dCompositeContractProbe"
                  );
                  m6dCompositeContractProbe = await runGroundGlassM6dCompositeContractProbe({
                    token: captureRequest.token,
                    requestId: latest.identity.requestId,
                    channelId: latest.identity.channelId,
                    sceneId: latest.identity.sceneId,
                    rendererGenerationId: generation.generationId,
                    rendererRevision: `r${REVISION}`,
                    renderer: renderer!,
                    queue: device.queue,
                    isCurrent: isApertureRequestCurrent,
                    textureFormat: (textureValue) => observeTextureFormat(mountedBackend!, textureValue),
                  });
                  if (!isApertureRequestCurrent()) return;
                }

                if (b1BoundaryProbeRequest) {
                  const boundaryProbe = await runGroundGlassB1BoundaryProbe({
                    request: b1BoundaryProbeRequest,
                    requestId: latest.identity.requestId,
                    channelId: latest.identity.channelId,
                    sceneId: latest.identity.sceneId,
                    rendererGenerationId: generation.generationId,
                    rendererRevision: `r${REVISION}`,
                    rendererFamily: mountedRuntime.rendererFamily,
                    actualExecutionApi: mountedRuntime.actualExecutionApi,
                    internalFallback: mountedRuntime.internalFallback,
                    renderer,
                    queue: device.queue,
                    textureFormat: (textureValue) => observeTextureFormat(mountedBackend!, textureValue),
                  });
                  if (isApertureRequestCurrent()) publishGroundGlassB1BoundaryProbeForTest(boundaryProbe);
                }

                let captureReadback: GroundGlassApertureGatherCaptureReadback | null = null;
                if (captureRequest && apertureGatherStatus === "completed") {
                  const depthReadback = resources.ensureDepthReadbackResources();
                  depthReadback.target.setSize(sourceWidthPx, sourceHeightPx);
                  failedPass = "composite";
                  const depthReadbackTiming = await runGroundGlassApertureGatherPass({
                    renderer: renderer!,
                    device,
                    target: depthReadback.target,
                    scene: depthReadback.scene,
                    camera: physicalCamera!,
                    isCurrent: isApertureRequestCurrent,
                  });
                  if (depthReadbackTiming === null) return;
                  aperturePassTimings.push({ name: "depthReadback", timing: depthReadbackTiming });
                  throwIfGroundGlassWebGpuFailureInjected("aperture-readback");
                  await holdGroundGlassApertureGatherReadbackForTest();
                  const readPixelsWaitStartedAt = performance.now();
                  const [sourceRaw, physicalRaw, validityRaw, depthRaw, farRaw, nearRaw,
                    b1Raw, compositeRaw, sourceIdentityRaw, gatherIdentityRaw,
                    centerProvenanceRaw, selectedProvenanceRaw, decisionRaw, nearAfterB1Raw] = await Promise.all([
                    renderer.readRenderTargetPixelsAsync(target, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(physicalTarget!, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(validityTarget!, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(depthReadback.target, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.farTarget, 0, 0, gatherWidthPx, gatherHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.nearTarget, 0, 0, gatherWidthPx, gatherHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.b1Target, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.researchCompositeTarget, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.sourceIdentityTarget, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.gatherIdentityTarget, 0, 0, gatherWidthPx, gatherHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.gatherCenterProvenanceTarget, 0, 0, gatherWidthPx, gatherHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.selectedProvenanceTarget, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.b1DecisionTarget, 0, 0, sourceWidthPx, sourceHeightPx),
                    renderer.readRenderTargetPixelsAsync(resources.nearTarget, 0, 0, gatherWidthPx, gatherHeightPx),
                  ]);
                  const readPixelsWaitWallMs = performance.now() - readPixelsWaitStartedAt;
                  if (!isApertureRequestCurrent()) return;
                  const readbackConversionStartedAt = performance.now();
                  const sourcePixels = compactWebGpuReadbackRows(
                    sourceRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const physicalPixels = compactWebGpuReadbackRows(
                    physicalRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const validityPixels = compactWebGpuReadbackRows(
                    validityRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const depthPixels = compactWebGpuReadbackRows(
                    depthRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const farPixels = compactWebGpuReadbackRows(
                    farRaw as GroundGlassReadbackPixels, gatherWidthPx, gatherHeightPx,
                  );
                  const nearPixels = compactWebGpuReadbackRows(
                    nearRaw as GroundGlassReadbackPixels, gatherWidthPx, gatherHeightPx,
                  );
                  const b1Pixels = compactWebGpuReadbackRows(
                    b1Raw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const compositePixels = compactWebGpuReadbackRows(
                    compositeRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const sourceIdentityPixels = compactWebGpuReadbackRows(
                    sourceIdentityRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const gatherIdentityPixels = compactWebGpuReadbackRows(
                    gatherIdentityRaw as GroundGlassReadbackPixels, gatherWidthPx, gatherHeightPx,
                  );
                  const centerProvenancePixels = compactWebGpuReadbackRows(
                    centerProvenanceRaw as GroundGlassReadbackPixels, gatherWidthPx, gatherHeightPx,
                  );
                  const selectedProvenancePixels = compactWebGpuReadbackRows(
                    selectedProvenanceRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const decisionPixels = compactWebGpuReadbackRows(
                    decisionRaw as GroundGlassReadbackPixels, sourceWidthPx, sourceHeightPx,
                  );
                  const nearAfterB1Pixels = compactWebGpuReadbackRows(
                    nearAfterB1Raw as GroundGlassReadbackPixels, gatherWidthPx, gatherHeightPx,
                  );
                  const originEvidence = inferReadbackOrigin(sourceIdentityPixels, sourceWidthPx, sourceHeightPx);
                  const readbackOrigin = originEvidence.origin;
                  if (readbackOrigin === "unresolved") {
                    throw new Error(`M5 source identity readback did not establish a top/bottom origin: ${originEvidence.evidence}`);
                  }
                  const sourceRgba = rgbaReadbackToTopFloat(sourcePixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin);
                  const physicalRgba = rgbaReadbackToTopFloat(physicalPixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin);
                  const validity = redReadbackToTopBytes(validityPixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin);
                  const depth = rgbaReadbackToTopFloat(depthPixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin).filter((_value, index) => index % 4 === 0);
                  const farGatherRgba = rgbaReadbackToTopFloat(farPixels,
                    gatherWidthPx, gatherHeightPx, readbackOrigin);
                  const nearRgba = rgbaReadbackToTopFloat(nearPixels,
                    gatherWidthPx, gatherHeightPx, readbackOrigin);
                  const b1FarRgba = rgbaReadbackToTopFloat(b1Pixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin);
                  const researchCompositeRgba = rgbaReadbackToTopFloat(compositePixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin);
                  const sourceIdentityIds = rgbaIdentityToTopIds(sourceIdentityPixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin, 0, 1);
                  const gatherIdentityIds = rgbaIdentityToTopIds(gatherIdentityPixels,
                    gatherWidthPx, gatherHeightPx, readbackOrigin, 0, 1);
                  const gatherCenterSourceIds = rgbaIdentityToTopIds(centerProvenancePixels,
                    gatherWidthPx, gatherHeightPx, readbackOrigin, 0, 1);
                  const gatherCenterProvenanceRgba = rgbaReadbackToTopFloat(
                    centerProvenancePixels,
                    gatherWidthPx,
                    gatherHeightPx,
                    readbackOrigin,
                  );
                  const gatherCenterSourceUvs = new Float32Array(gatherWidthPx * gatherHeightPx * 2);
                  for (let pixel = 0; pixel < gatherWidthPx * gatherHeightPx; pixel += 1) {
                    gatherCenterSourceUvs[pixel * 2] = gatherCenterProvenanceRgba[pixel * 4 + 2] ?? 0;
                    gatherCenterSourceUvs[pixel * 2 + 1] = gatherCenterProvenanceRgba[pixel * 4 + 3] ?? 0;
                  }
                  const observedSelectedGatherIds = rgbaIdentityToTopIds(selectedProvenancePixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin, 0, 1);
                  const observedSelectedCenterSourceIds = rgbaIdentityToTopIds(selectedProvenancePixels,
                    sourceWidthPx, sourceHeightPx, readbackOrigin, 2, 3);
                  const decisionRgbaTop = new Uint8Array(sourceWidthPx * sourceHeightPx * 4);
                  if (!(decisionPixels instanceof Uint8Array)) {
                    throw new Error("M5 decision readback did not return RGBA8 data");
                  }
                  for (let y = 0; y < sourceHeightPx; y += 1) {
                    const readY = readbackOrigin === "top" ? y : sourceHeightPx - 1 - y;
                    decisionRgbaTop.set(
                      decisionPixels.subarray(readY * sourceWidthPx * 4, (readY + 1) * sourceWidthPx * 4),
                      y * sourceWidthPx * 4,
                    );
                  }
                  const readbackConversionCpuMs = performance.now() - readbackConversionStartedAt;
                  const physicalBeforeReference = physicalRgba.slice();
                  const cpuReferenceStartedAt = performance.now();
                  const gatherReference = referenceGroundGlassApertureGather({
                    source: { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
                    gather: { widthPx: gatherWidthPx, heightPx: gatherHeightPx },
                    film: { widthMm: sampledFilmWidthMm, heightMm: sampledFilmHeightMm },
                    sourceRgba,
                    physicalRgba,
                    validity,
                    depth,
                    observedGatherCenterSourceIds: gatherCenterSourceIds,
                    observedGatherCenterSourceUvs: gatherCenterSourceUvs,
                    inverseProjectionMatrix: camera.projectionMatrixInverse.elements,
                    sampleCount: settings.sampleCount,
                    maximumRadiusPx: settings.maximumRadiusPx,
                  });
                  const nominalGatherCenterMismatchCount = gatherReference.nominalGatherCenterSourceIds.reduce(
                    (mismatchCount, pixel, index) => mismatchCount
                      + (pixel === gatherCenterSourceIds[index] ? 0 : 1), 0,
                  );
                  const gatherIdentityMismatchCount = gatherIdentityIds.reduce((count, id, index) => {
                    const coordinate = index % 2 === 0
                      ? (index / 2) % gatherWidthPx
                      : Math.floor(index / 2 / gatherWidthPx);
                    return count + (id === coordinate ? 0 : 1);
                  }, 0);
                  const farReferenceError = compareRgbRms(gatherReference.farRgba, farGatherRgba);
                  let farPixelsAboveReferenceTolerance = 0;
                  for (let offset = 0; offset < farGatherRgba.length; offset += 4) {
                    if ([0, 1, 2].some((channel) => Math.abs(
                      (gatherReference.farRgba[offset + channel] ?? 0) - (farGatherRgba[offset + channel] ?? 0),
                    ) > 0.001)) farPixelsAboveReferenceTolerance += 1;
                  }
                  const nearReferenceRgbError = compareRgbRms(gatherReference.nearRgba, nearRgba);
                  const nearReferenceAlphaError = compareAlphaRms(gatherReference.nearRgba, nearRgba);
                  const b1Reference = reconstructGroundGlassB1Reference({
                    source: { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
                    gather: { widthPx: gatherWidthPx, heightPx: gatherHeightPx },
                    sourceRgba,
                    gatherFarRgba: farGatherRgba,
                    physicalRgba,
                    validity,
                    observedSelectedGatherIds,
                    observedSelectedCenterSourceIds,
                    observedGatherCenterSourceIds: gatherCenterSourceIds,
                  });
                  const b1Error = compareRgbRms(b1Reference.farRgba, b1FarRgba);
                  const expectedB1Composite = compositeGroundGlassB1ResearchReference(
                    b1Reference.farRgba,
                    { widthPx: sourceWidthPx, heightPx: sourceHeightPx },
                    gatherReference.nearRgba,
                    { widthPx: gatherWidthPx, heightPx: gatherHeightPx },
                  );
                  const compositeReferenceError = compareRgbRms(expectedB1Composite, researchCompositeRgba);
                  let eligibilityMismatchCount = 0;
                  let fallbackReasonMismatchCount = 0;
                  let selectedPathMismatchCount = 0;
                  let fallbackSourceMaximumError = 0;
                  for (let pixel = 0; pixel < sourceWidthPx * sourceHeightPx; pixel += 1) {
                    const decisionOffset = pixel * 4;
                    const expectedSelectedPath = b1Reference.selectedPath[pixel] === 1 ? 1 : 0;
                    if ((decisionRgbaTop[decisionOffset] === 1 ? 1 : 0) !== b1Reference.eligible[pixel]) {
                      eligibilityMismatchCount += 1;
                    }
                    if (decisionRgbaTop[decisionOffset + 1] !== b1Reference.fallbackReason[pixel]) {
                      fallbackReasonMismatchCount += 1;
                    }
                    if ((decisionRgbaTop[decisionOffset + 2] === 1 ? 1 : 0) !== expectedSelectedPath) {
                      selectedPathMismatchCount += 1;
                    }
                    if (expectedSelectedPath === 0) {
                      const offset = pixel * 4;
                      for (let channel = 0; channel < 3; channel += 1) {
                        fallbackSourceMaximumError = Math.max(fallbackSourceMaximumError,
                          Math.abs((b1FarRgba[offset + channel] ?? 0) - (sourceRgba[offset + channel] ?? 0)));
                      }
                    }
                  }
                  const nearBefore = nearBeforeB1Raw as GroundGlassReadbackPixels | null;
                  const nearAfter = nearAfterB1Pixels;
                  const nearBeforeRgba = nearBefore
                    ? rgbaReadbackToTopFloat(nearBefore, gatherWidthPx, gatherHeightPx, readbackOrigin)
                    : nearRgba;
                  const nearAfterB1Rgba = rgbaReadbackToTopFloat(nearAfter,
                    gatherWidthPx, gatherHeightPx, readbackOrigin);
                  const nearRgbInvariant = compareRgbRms(nearBeforeRgba, nearAfterB1Rgba);
                  const nearAlphaInvariant = compareAlphaRms(nearBeforeRgba, nearAfterB1Rgba);
                  const nearCoveragePixelCount = Array.from({ length: gatherWidthPx * gatherHeightPx })
                    .filter((_value, pixel) => (nearRgba[pixel * 4 + 3] ?? 0) > 0).length;
                  const nearCoverageFractionalPixelCount = Array.from({ length: gatherWidthPx * gatherHeightPx })
                    .filter((_value, pixel) => {
                      const alpha = nearRgba[pixel * 4 + 3] ?? 0;
                      return alpha > 0 && alpha < 1;
                    }).length;
                  const nearCoverageNontrivial = nearCoveragePixelCount > 0;
                  const nearReferenceCoveragePixelCount = Array.from({ length: gatherWidthPx * gatherHeightPx })
                    .filter((_value, pixel) => (gatherReference.nearRgba[pixel * 4 + 3] ?? 0) > 0).length;
                  const nearReferenceCoverageFractionalPixelCount = Array.from({ length: gatherWidthPx * gatherHeightPx })
                    .filter((_value, pixel) => {
                      const alpha = gatherReference.nearRgba[pixel * 4 + 3] ?? 0;
                      return alpha > 0 && alpha < 1;
                    }).length;
                  const nearReferenceCoverageNontrivial = nearReferenceCoveragePixelCount > 0;
                  let m5rDiagnosticReadbacks: Readonly<{
                    farGatherRgba32: Float32Array;
                    farGatherHalfBits: Uint16Array;
                    nearProposalCountsRgba: Float32Array;
                    nearCoverageDiagnosticsRgba: Float32Array;
                    nearAcceptedFootprintRgba: Float32Array;
                    nearAlphaHalfBits: Uint16Array;
                    nearFinalAlphaMaximumError: number;
                    targetFormat: "rgba32float";
                  }> | null = null;
                  if (captureRequest.includeM5rDiagnostics === true) {
                    const renderDiagnostic = async (
                      outputNode: MeshBasicNodeMaterial["outputNode"],
                      label: string,
                    ): Promise<Float32Array> => {
                      const diagnostic = await renderM5rFloatDiagnosticTarget({
                        renderer: renderer!,
                        device,
                        outputNode,
                        widthPx: gatherWidthPx,
                        heightPx: gatherHeightPx,
                        camera: physicalCamera!,
                        isCurrent: isApertureRequestCurrent,
                      });
                      if (!diagnostic) throw new Error(`M5R ${label} capture became stale before completion`);
                      if (diagnostic.format !== "rgba32float") {
                        throw new Error(`M5R ${label} target format was ${diagnostic.format ?? "unresolved"}`);
                      }
                      return rgbaReadbackToTopFloat(
                        diagnostic.values,
                        gatherWidthPx,
                        gatherHeightPx,
                        readbackOrigin,
                      );
                    };
                    const diagnosticNodes = resources.gatherNodes.createM5rNearDiagnosticOutputs();
                    const farGatherRgba32 = await renderDiagnostic(
                      resources.gatherNodes.farOutput,
                      "Full32/64 far precision",
                    );
                    const nearProposalCountsRgba = await renderDiagnostic(
                      diagnosticNodes.proposalCounts,
                      "Near proposal counts",
                    );
                    const nearCoverageDiagnosticsRgba = await renderDiagnostic(
                      diagnosticNodes.coverage,
                      "Near coverage",
                    );
                    const nearAcceptedFootprintRgba = await renderDiagnostic(
                      diagnosticNodes.acceptedFootprint,
                      "Near accepted-footprint",
                    );
                    let nearFinalAlphaMaximumError = 0;
                    for (let pixel = 0; pixel < gatherWidthPx * gatherHeightPx; pixel += 1) {
                      nearFinalAlphaMaximumError = Math.max(
                        nearFinalAlphaMaximumError,
                        Math.abs(
                          (nearCoverageDiagnosticsRgba[pixel * 4 + 3] ?? 0)
                          - (nearRgba[pixel * 4 + 3] ?? 0),
                        ),
                      );
                    }
                    m5rDiagnosticReadbacks = {
                      farGatherRgba32,
                      farGatherHalfBits: rgbaHalfBitsTop(
                        farPixels,
                        gatherWidthPx,
                        gatherHeightPx,
                        readbackOrigin,
                      ),
                      nearProposalCountsRgba,
                      nearCoverageDiagnosticsRgba,
                      nearAcceptedFootprintRgba,
                      nearAlphaHalfBits: nearAlphaHalfBitsTop(
                        nearPixels,
                        gatherWidthPx,
                        gatherHeightPx,
                        readbackOrigin,
                      ),
                      nearFinalAlphaMaximumError,
                      targetFormat: "rgba32float",
                    };
                  }
                  const m5rNearFixtureCapture = captureRequest.includeM5rNearFixture === true
                    ? await runGroundGlassM5rNearFixture({
                      renderer: renderer!,
                      device,
                      backend: mountedBackend!,
                      camera: physicalCamera!,
                      isCurrent: isApertureRequestCurrent,
                      rendererGenerationId: generation.generationId,
                      requestId: latest.identity.requestId,
                      sceneId: latest.identity.sceneId,
                    })
                    : null;
                  if (captureRequest.includeM5rNearFixture === true && !m5rNearFixtureCapture) {
                    throw new Error("M5R controlled Near fixture was not completed for the accepted request");
                  }
                  const physicalValuesUnchanged = physicalRgba.every(
                    (value, index) => value === physicalBeforeReference[index],
                  );
                  const sourceIdentityMismatchCount = sourceIdentityIds.reduce((count, id, index) => {
                    const coordinate = index % 2 === 0
                      ? (index / 2) % sourceWidthPx
                      : Math.floor(index / 2 / sourceWidthPx);
                    return count + (id === coordinate ? 0 : 1);
                  }, 0);
                  const selectedCenterProvenanceMismatchCount =
                    b1Reference.counts.selectedCenterProvenanceMismatch;
                  const identityMismatchCount = selectedCenterProvenanceMismatchCount
                    + sourceIdentityMismatchCount + gatherIdentityMismatchCount;
                  const sourceToGatherMappingMismatchCount = b1Reference.counts.nominalMappingMismatch;
                  const sourceToGatherMappingStatus = sourceToGatherMappingMismatchCount === 0
                    ? "passed" as const
                    : "failed" as const;
                  const cpuB1Status = identityMismatchCount === 0
                    && eligibilityMismatchCount === 0
                    && fallbackReasonMismatchCount === 0
                    && selectedPathMismatchCount === 0
                    && b1Error.maximum <= 0.001
                    && fallbackSourceMaximumError <= 0.001
                    ? "passed" as const
                    : "failed" as const;
                  const cpuReferenceWallClockMs = performance.now() - cpuReferenceStartedAt;
                  const captureSceneRenderTiming = sceneRenderTiming;
                  if (!captureSceneRenderTiming) {
                    throw new Error("M5 capture has no timing evidence for its accepted scene render");
                  }
                  const targetAllocations = [
                    makeGroundGlassApertureGatherTargetAllocation(
                      "sourceIdentity", resources.sourceIdentityTarget, outputFormats.provenance,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "gatherIdentity", resources.gatherIdentityTarget, outputFormats.provenance,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "gatherCenterProvenance", resources.gatherCenterProvenanceTarget,
                      outputFormats.provenance,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "farGather", resources.farTarget, outputFormats.far,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "nearGather", resources.nearTarget, outputFormats.near,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "selectedProvenance", resources.selectedProvenanceTarget, outputFormats.provenance,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "b1Reconstruction", resources.b1Target, outputFormats.b1,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "b1Decision", resources.b1DecisionTarget, outputFormats.decisions,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "researchComposite", resources.researchCompositeTarget, outputFormats.composite,
                    ),
                    makeGroundGlassApertureGatherTargetAllocation(
                      "depthReadback", depthReadback.target,
                      observeTextureFormat(mountedBackend!, depthReadback.target.texture),
                    ),
                  ];
                  const estimatedTargetAttachmentBytes = targetAllocations.reduce(
                    (sum, allocation) => sum + allocation.estimatedBytes,
                    0,
                  );
                  captureReadback = {
                    token: captureRequest.token,
                    captureId: captureRequest.token,
                    requestId: latest.identity.requestId,
                    channelId: latest.identity.channelId,
                    sceneId: latest.identity.sceneId,
                    rendererGenerationId: generation.generationId,
                    rendererFamily: "webgpu-renderer",
                    actualExecutionApi: "webgpu",
                    internalFallback: "none",
                    readbackOrigin,
                    sceneSourceRevision: ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION,
                    effectiveOpticalRequestFingerprint: createGroundGlassFrameRequestFingerprint(latest),
                    cameraStateFingerprint: JSON.stringify([
                      camera.matrixWorld.elements,
                      camera.matrixWorldInverse.elements,
                      camera.projectionMatrix.elements,
                      camera.projectionMatrixInverse.elements,
                    ]),
                    inverseProjectionMatrix: Array.from(camera.projectionMatrixInverse.elements),
                    sampledFilmDimensionsMm: {
                      widthMm: sampledFilmWidthMm,
                      heightMm: sampledFilmHeightMm,
                    },
                    colorDomain: "source-target-readback-values",
                    qualityMode: settings.qualityMode,
                    sampleCount: settings.sampleCount,
                    maximumRadiusPx: settings.maximumRadiusPx,
                    sourceWidthPx,
                    sourceHeightPx,
                    farGatherWidthPx: gatherWidthPx,
                    farGatherHeightPx: gatherHeightPx,
                    nearGatherWidthPx: gatherWidthPx,
                    nearGatherHeightPx: gatherHeightPx,
                    targetFormats: {
                      sourceColor: outputFormats.sourceColor,
                      physical: outputFormats.physical,
                      validity: outputFormats.validity,
                      far: outputFormats.far,
                      near: outputFormats.near,
                      b1: outputFormats.b1,
                      composite: outputFormats.composite,
                      provenance: outputFormats.provenance,
                      decisions: outputFormats.decisions,
                    },
                    performance: {
                      sceneRender: captureSceneRenderTiming,
                      physicalCocFootprint: physicalCocFootprintTiming,
                      physicalValidity: physicalValidityTiming,
                      operations: aperturePassTimings,
                      readPixelsWaitWallMs,
                      readbackConversionCpuMs,
                      cpuReferenceWallClockMs,
                      gpuTimestampQueries: "not-collected",
                    },
                    resourceInventory: {
                      m5OwnedRenderTargetCount: resources.targets.length,
                      adapterOwnedFullscreenMaterialCount: resources.materials.length,
                      adapterOwnedFullscreenSceneCount: resources.scenes.length,
                      adapterOwnedFullscreenGeometryCount: 1,
                      estimatedTargetAttachmentBytes,
                      memoryScope: "m5-owned-target-attachments-only",
                      targetAllocations,
                    },
                    m6dCompositeContractProbe,
                    completedPasses: apertureGatherCompletedPasses,
                    cpuB1Conformance: {
                      status: cpuB1Status,
                      selectedCenterProvenanceMismatchCount,
                      eligibilityMismatchCount,
                      fallbackReasonMismatchCount,
                      selectedPathMismatchCount,
                      rgbRmse: b1Error.rmse,
                      rgbMaximumError: b1Error.maximum,
                      fallbackSourceMaximumError,
                    },
                    farGatherCpuReference: {
                      rgbRmse: farReferenceError.rmse,
                      rgbMaximumError: farReferenceError.maximum,
                      pixelsOverMaximumErrorTolerance: farPixelsAboveReferenceTolerance,
                    },
                    sourceToGatherMappingConformance: {
                      status: sourceToGatherMappingStatus,
                      mismatchCount: sourceToGatherMappingMismatchCount,
                    },
                    nominalGatherCenterMappingConformance: {
                      status: nominalGatherCenterMismatchCount === 0 ? "exact" as const : "observed-offset" as const,
                      mismatchCount: nominalGatherCenterMismatchCount,
                    },
                    physicalDataFingerprint: groundGlassReadbackFingerprint(physicalRaw as GroundGlassReadbackPixels),
                    nearCoveragePixelCount,
                    nearCoverageNontrivial,
                    nearCoverageFractionalPixelCount,
                    nearReferenceCoverageNontrivial,
                    nearReferenceCoveragePixelCount,
                    nearReferenceCoverageFractionalPixelCount,
                    nearReferenceAlphaMaximumError: nearReferenceAlphaError.maximum,
                    nearRgbInvariantMaximumError: nearRgbInvariant.maximum,
                    nearAlphaInvariantMaximumError: nearAlphaInvariant.maximum,
                    inputFingerprints: {
                      sourceColor: groundGlassReadbackFingerprint(sourcePixels),
                      depth: groundGlassReadbackFingerprint(depthPixels),
                      physical: groundGlassReadbackFingerprint(physicalPixels),
                      validity: groundGlassReadbackFingerprint(validityPixels),
                    },
                    m5rDiagnostics: {
                      status: m5rDiagnosticReadbacks ? "captured" : "not-requested",
                      diagnosticTargetFormat: m5rDiagnosticReadbacks?.targetFormat ?? null,
                      diagnosticTargetCount: m5rDiagnosticReadbacks ? 4 : 0,
                      nearFinalAlphaMaximumError: m5rDiagnosticReadbacks?.nearFinalAlphaMaximumError ?? null,
                    },
                    m5rNearFixture: m5rNearFixtureCapture?.metadata ?? null,
                    radius: {
                      maximumUncappedRadiusPx: gatherReference.summary.maximumFarUncappedRadiusPx,
                      cappedPixelCount: gatherReference.summary.farCappedCenterCount,
                      physicalValuesUnchanged,
                    },
                    readbackBuffers: captureRequest.retainReadbackBuffers === true ? {
                      sourceRgba,
                      physicalRgba,
                      validity,
                      depth,
                      farGatherRgba,
                      nearRgba,
                      nearBeforeB1Rgba: nearBeforeRgba,
                      nearAfterB1Rgba,
                      nearCpuReferenceRgba: gatherReference.nearRgba,
                      nearCpuCenterIsNear: gatherReference.nearCenterIsNear,
                      nearCpuEvaluatedProposalCount: gatherReference.nearEvaluatedProposalCount,
                      nearCpuAcceptedProposalCount: gatherReference.nearAcceptedProposalCount,
                      nearCpuNonzeroMembershipCount: gatherReference.nearNonzeroMembershipCount,
                      nearCpuWeightSum: gatherReference.nearWeightSum,
                      nearCpuCoverageMass: gatherReference.nearCoverageMass,
                      nearCpuEstimatedCoverage: gatherReference.nearEstimatedCoverage,
                      nearCpuAcceptedAreaRatioMean: gatherReference.nearAcceptedAreaRatioMean,
                      nearCpuAcceptedCompensationMaximum: gatherReference.nearAcceptedCompensationMaximum,
                      b1FarRgba,
                      researchCompositeRgba,
                      observedSelectedGatherIds,
                      observedSelectedCenterSourceIds,
                      observedGatherCenterSourceIds: gatherCenterSourceIds,
                      observedGatherCenterSourceUvs: gatherCenterSourceUvs,
                      b1Decision: decisionRgbaTop,
                      ...(m5rDiagnosticReadbacks ? {
                        farGatherRgba32: m5rDiagnosticReadbacks.farGatherRgba32,
                        farGatherHalfBits: m5rDiagnosticReadbacks.farGatherHalfBits,
                        nearProposalCountsRgba: m5rDiagnosticReadbacks.nearProposalCountsRgba,
                        nearCoverageDiagnosticsRgba: m5rDiagnosticReadbacks.nearCoverageDiagnosticsRgba,
                        nearAcceptedFootprintRgba: m5rDiagnosticReadbacks.nearAcceptedFootprintRgba,
                        nearAlphaHalfBits: m5rDiagnosticReadbacks.nearAlphaHalfBits,
                      } : {}),
                      ...(m5rNearFixtureCapture ? {
                        m5rFixtureNearRgba: m5rNearFixtureCapture.buffers.nearRgba,
                        m5rFixtureProposalCountsRgba: m5rNearFixtureCapture.buffers.proposalCountsRgba,
                        m5rFixtureCoverageRgba: m5rNearFixtureCapture.buffers.coverageRgba,
                        m5rFixtureAcceptedFootprintRgba: m5rNearFixtureCapture.buffers.acceptedFootprintRgba,
                        m5rFixtureNearAlphaHalfBits: m5rNearFixtureCapture.buffers.nearAlphaHalfBits,
                      } : {}),
                    } : null,
                  };
                  apertureGatherFailureReason = sourceToGatherMappingMismatchCount > 0
                    ? "GPU-selected gather IDs did not match the independent source-to-gather mapping"
                    : selectedCenterProvenanceMismatchCount > 0
                      ? "CPU gather center source IDs did not match GPU-observed provenance"
                    : null;
                  if (cpuB1Status === "failed" || farReferenceError.maximum > 0.001
                      || nearReferenceRgbError.maximum > 0.001 || nearReferenceAlphaError.maximum > 0.001
                      || compositeReferenceError.maximum > 0.001
                      || nearRgbInvariant.maximum > 0.001 || nearAlphaInvariant.maximum > 0.001
                      || !physicalValuesUnchanged) {
                    const metric = (value: number) => value.toFixed(7);
                    const farPixelIndex = Math.floor(farReferenceError.maximumOffset / 4);
                    const farPixelX = farPixelIndex % gatherWidthPx;
                    const farPixelY = Math.floor(farPixelIndex / gatherWidthPx);
                    const farColorOffset = farPixelIndex * 4;
                    const centerSourceOffset = farPixelIndex * 2;
                    const centerSourceX = gatherCenterSourceIds[centerSourceOffset] ?? -1;
                    const centerSourceY = gatherCenterSourceIds[centerSourceOffset + 1] ?? -1;
                    const centerPhysicalOffset = (centerSourceY * sourceWidthPx + centerSourceX) * 4;
                    apertureGatherFailureReason ??= [
                      "native pass output did not match the bounded independent CPU reference",
                      `far max=${metric(farReferenceError.maximum)} rmse=${metric(farReferenceError.rmse)}`,
                      `far pixels over 0.001=${farPixelsAboveReferenceTolerance}`,
                      `at gather (${farPixelX},${farPixelY}) channel=${farReferenceError.maximumOffset % 4}`,
                      `expected=${Array.from(gatherReference.farRgba.slice(farColorOffset, farColorOffset + 3), metric).join(",")}`,
                      `observed=${Array.from(farGatherRgba.slice(farColorOffset, farColorOffset + 3), metric).join(",")}`,
                      `centerSource=(${centerSourceX},${centerSourceY}) coc=${metric(physicalRgba[centerPhysicalOffset] ?? 0)}`,
                      `near rgb max=${metric(nearReferenceRgbError.maximum)}`,
                      `near alpha max=${metric(nearReferenceAlphaError.maximum)}`,
                      `composite max=${metric(compositeReferenceError.maximum)}`,
                      `B1 max=${metric(b1Error.maximum)}`,
                      `near invariant rgb=${metric(nearRgbInvariant.maximum)}`,
                      `near invariant alpha=${metric(nearAlphaInvariant.maximum)}`,
                      `physical unchanged=${physicalValuesUnchanged}`,
                    ].join("; ");
                  }
                  const b1Counts: Partial<Pick<GroundGlassApertureGatherDiagnosticDetails,
                    | "b1SelectedCenterCount"
                    | "b1FallbackCount"
                    | "fallbackFarGatherAccepted"
                    | "fallbackGatherSelectionMismatch"
                    | "fallbackMissingOrOutOfBoundsProvenance"
                    | "fallbackSelectedCenterProvenanceMismatch"
                    | "fallbackInvalidOrUnresolvedCenter"
                    | "fallbackSelectedCenterNotFarEligible"
                    | "fallbackUnusableGatherData"
                    | "provenanceMismatchCount"
                    | "sourceToGatherMappingMismatchCount"
                    | "nominalGatherCenterMappingMismatchCount"
                    | "farEligibilityRejectedCount"
                  >> = {
                    b1SelectedCenterCount: sourceWidthPx * sourceHeightPx,
                    b1FallbackCount: b1Reference.counts.sourceColorFallback,
                    fallbackFarGatherAccepted: b1Reference.counts.farGatherSelected,
                    fallbackGatherSelectionMismatch: null,
                    fallbackMissingOrOutOfBoundsProvenance: b1Reference.counts.missingOrOutOfBoundsProvenance,
                    fallbackSelectedCenterProvenanceMismatch: b1Reference.counts.selectedCenterProvenanceMismatch,
                    fallbackInvalidOrUnresolvedCenter: b1Reference.counts.invalidOrUnresolvedCenter,
                    fallbackSelectedCenterNotFarEligible: b1Reference.counts.selectedCenterNotFarEligible,
                    fallbackUnusableGatherData: b1Reference.counts.unusableGatherData,
                    provenanceMismatchCount: identityMismatchCount,
                    sourceToGatherMappingMismatchCount,
                    nominalGatherCenterMappingMismatchCount: nominalGatherCenterMismatchCount,
                    farEligibilityRejectedCount: b1Reference.counts.invalidOrUnresolvedCenter
                      + b1Reference.counts.selectedCenterNotFarEligible,
                  };
                  apertureGatherFailureReason = cpuB1Status === "failed"
                    ? apertureGatherFailureReason ?? "B1 conformance gate failed"
                    : apertureGatherFailureReason;
                  if (apertureGatherFailureReason) apertureGatherStatus = "failed";
                  apertureGatherDiagnostic = makeApertureGatherDiagnostic({
                    status: apertureGatherFailureReason ? "failed" : "completed",
                    request: latest,
                    generation,
                    target,
                    settings,
                    farWidthPx: gatherWidthPx,
                    farHeightPx: gatherHeightPx,
                    actualFormats: outputFormats,
                    completedPasses: apertureGatherCompletedPasses,
                    physicalInputRequestId: physicalDiagnostic.requestId,
                    physicalInputFormatVerified: true,
                    b1Counts,
                    cappedPixelCount: gatherReference.summary.farCappedCenterCount,
                    maximumUncappedRadiusPx: gatherReference.summary.maximumFarUncappedRadiusPx,
                    nearCoveragePixelCount,
                    nearRgbError: Math.max(nearReferenceRgbError.rmse, nearReferenceRgbError.maximum),
                    nearAlphaError: Math.max(nearReferenceAlphaError.rmse, nearReferenceAlphaError.maximum),
                    b1ReferenceError: b1Error.rmse,
                    failureReason: apertureGatherFailureReason,
                    qualityGateReason: "R3 matched Full32/Full64, edge, interior, blur-spread, and fallback-halo qualification remains incomplete",
                  });
                  if (observedSelectedGatherIds.length === 0) {
                    throw new Error("M5 readback omitted required GPU-observed selection identities");
                  }
                  if (isApertureRequestCurrent() && captureReadback) {
                    publishGroundGlassApertureGatherCaptureForTest(captureReadback);
                  }
                }
                }
              } catch (error) {
                if (error instanceof GroundGlassGatherSubmissionFailure) throw error;
                apertureGatherStatus = "failed";
                apertureGatherFailureReason = errorMessage(error);
                apertureGatherUnsupportedReason = null;
                apertureGatherDiagnostic = makeApertureGatherDiagnostic({
                  status: "failed",
                  request: latest,
                  generation,
                  target,
                  settings: apertureGatherSettings,
                  farWidthPx: resources.farTarget.width,
                  farHeightPx: resources.farTarget.height,
                  actualFormats: apertureGatherFormats ?? undefined,
                  completedPasses: apertureGatherCompletedPasses,
                  physicalInputRequestId: physicalDiagnostic.requestId,
                  failureReason: apertureGatherFailureReason,
                  qualityGateReason: "CPU reference or a recoverable M5 research operation failed",
                });
              }
            }
            if (apertureGatherStatus === "completed" && !apertureGatherDiagnostic) {
              apertureGatherDiagnostic = makeApertureGatherDiagnostic({
                status: "completed",
                request: latest,
                generation,
                target,
                settings: apertureGatherSettings,
                farWidthPx: resources?.farTarget.width,
                farHeightPx: resources?.farTarget.height,
                actualFormats: apertureGatherFormats ?? undefined,
                completedPasses: apertureGatherCompletedPasses,
                physicalInputRequestId: physicalDiagnostic?.requestId,
                physicalInputFormatVerified: true,
              });
            }
            if (apertureGatherStatus === "unsupported") {
              apertureGatherDiagnostic = makeApertureGatherDiagnostic({
                status: "unsupported",
                request: latest,
                generation,
                target,
                settings: apertureGatherSettings,
                farWidthPx: resources?.farTarget.width,
                farHeightPx: resources?.farTarget.height,
                actualFormats: apertureGatherFormats ?? undefined,
                completedPasses: apertureGatherCompletedPasses,
                physicalInputRequestId: physicalDiagnostic?.requestId,
                physicalInputFormatVerified: false,
                qualityGateReason: apertureGatherUnsupportedReason,
              });
            }
            setApertureGatherDiagnostics(apertureGatherDiagnostic);
            recordGroundGlassWebGpuTestEvent({
              kind: "gather-research",
              generationId: generation.generationId,
              requestId: latest.identity.requestId,
              status: apertureGatherStatus === "completed" ? "completed"
                : apertureGatherStatus === "unsupported" ? "unsupported" : "failed",
              qualityMode: apertureGatherSettings?.qualityMode ?? null,
              failureReason: apertureGatherFailureReason ?? apertureGatherUnsupportedReason,
            });
            if (isApertureRequestCurrent()) {
              const currentDetails = makeDiagnosticDetails({
                request: latest,
                target,
                camera: cameraFrustum!,
                subjectChildCount: subject!.group.children.length,
                runtime: runtimeRef.current,
                backend: mountedBackend!,
                completedPasses,
                ...(physicalDiagnostic ? { physicalCoc: physicalDiagnostic } : {}),
                ...(physicalDiagnostic ? { actualDepthFormat } : {}),
                ...(apertureGatherDiagnostic ? { apertureGather: apertureGatherDiagnostic } : {}),
              });
              propsRef.current.onBackendDetails(currentDetails);
            }
          }

          if (m6PresentationRequested) {
            const exactPhysicalInput = physicalDiagnostic?.status === "completed" &&
              physicalDiagnostic.requestId === latest.identity.requestId &&
              physicalDiagnostic.channelId === latest.identity.channelId &&
              physicalDiagnostic.sceneId === latest.identity.sceneId &&
              physicalDiagnostic.rendererGenerationId === generation.generationId;
            const exactGatherInput = apertureGatherStatus === "completed" &&
              apertureGatherDiagnostic?.requestId === latest.identity.requestId &&
              apertureGatherDiagnostic.channelId === latest.identity.channelId &&
              apertureGatherDiagnostic.sceneId === latest.identity.sceneId &&
              apertureGatherDiagnostic.rendererGenerationId === generation.generationId;
            if (!exactPhysicalInput || !exactGatherInput || !apertureGatherResources ||
                display.presentationMode !== "m6-experimental-dof") {
              failedPass = "presentation";
              throw new Error(
                "M6 presentation requires completed M4 and M5 inputs for the exact accepted request and renderer generation",
              );
            }
          }

          // M6 fuses the presentation transform and final texture display into this one fullscreen
          // operation; it samples the completed M5 composite directly and allocates no extra target.
          failedPass = m6PresentationRequested ? "presentation" : "textureDisplay";
          renderer.setRenderTarget(null);
          renderer.setViewport(0, 0, Math.max(1, latest.widthPx), Math.max(1, latest.heightPx));
          renderer.setClearColor(SKY_COLOR, 1);
          renderer.clear(true, true, true);
          if (m6PresentationRequested) {
            throwIfGroundGlassWebGpuFailureInjected("m6-presentation-before-render");
          }
          const presentationStartedAt = performance.now();
          const presentationRendererCallStartedAt = presentationStartedAt;
          renderer.render(display.scene, display.camera);
          const presentationRendererCallCpuMs = performance.now() - presentationRendererCallStartedAt;
          if (m6PresentationRequested) await holdGroundGlassWebGpuPresentationQueueCompletion();
          const presentationQueueWaitStartedAt = performance.now();
          await holdGroundGlassWebGpuQueueCompletion();
          throwIfGroundGlassWebGpuFailureInjected("queue-completion");
          await device.queue.onSubmittedWorkDone();
          const presentationQueueCompletionWaitMs = performance.now() - presentationQueueWaitStartedAt;
          presentationPassTiming = m6PresentationRequested
            ? {
                rendererCallCpuMs: presentationRendererCallCpuMs,
                queueCompletionWaitMs: presentationQueueCompletionWaitMs,
                wallClockMs: performance.now() - presentationStartedAt,
              }
            : null;
          if (!isRequestCurrent()) return;
          if (m6PresentationRequested) {
            throwIfGroundGlassWebGpuFailureInjected("m6-presentation-after-submit");
            const pendingPresentation = presentationDiagnostic;
            if (!pendingPresentation) {
              throw new Error("M6 completed its display operation without pending presentation evidence");
            }
            presentationDiagnostic = {
              ...pendingPresentation,
              status: "completed",
              passTiming: presentationPassTiming,
            };
            setPresentationDiagnostics(presentationDiagnostic);
            const mountedRuntime = runtimeRef.current;
            if (import.meta.env.DEV && currentM6bPresentationState && calibrationSourceTexture && calibrationSourceDataFingerprint &&
                isGroundGlassM6bCalibrationFixtureEnabledForRequest(latest) &&
                mountedRuntime.status === "mounted" &&
                mountedRuntime.rendererFamily === "webgpu-renderer" &&
                mountedRuntime.actualExecutionApi === "webgpu" &&
                mountedRuntime.internalFallback === "none") {
              const conformance = await loadM6bConformanceModule();
              if (!isRequestCurrent()) return;
              if (!conformance) throw new Error("M6B calibration helper did not load before evidence publication");
              const source = calibrationSourceTexture.image;
              publishGroundGlassM6bPresentationEvidenceForTest({
                fixtureRevision: conformance.GROUND_GLASS_M6B_FIXTURE_REVISION,
                requestId: latest.identity.requestId,
                channelId: latest.identity.channelId,
                sceneId: latest.identity.sceneId,
                rendererGenerationId: generation.generationId,
                rendererFamily: mountedRuntime.rendererFamily,
                actualExecutionApi: mountedRuntime.actualExecutionApi,
                internalFallback: mountedRuntime.internalFallback,
                previewMode: latest.previewMode,
                sourceSampling: "nearest",
                sourceColorDomain: "linear-no-color-space",
                sourceWidthPx: source.width,
                sourceHeightPx: source.height,
                sourceDataFingerprint: calibrationSourceDataFingerprint,
                presentationStateFingerprint: conformance.fingerprintGroundGlassM6bPresentationState(currentM6bPresentationState),
                presentationMaterialUuid: display.material.uuid,
                outputWidthPx: latest.widthPx,
                outputHeightPx: latest.heightPx,
                sourceCrop: latest.inspectionWindow,
                presentationState: currentM6bPresentationState,
              });
            }
            if (import.meta.env.DEV) {
              const alphaCaptureRequest = consumeGroundGlassM6cAlphaCaptureForTest();
              if (alphaCaptureRequest) {
                await captureM6cAlphaReadback(alphaCaptureRequest, latest, isRequestCurrent);
                if (!isRequestCurrent()) return;
              }
            }
          }
          failedPass = "textureDisplay";
          throwIfGroundGlassWebGpuFailureInjected("texture-display-after-submit");

          failedPass = null;
          completedPasses = m6PresentationRequested
            ? ["sceneRender", "presentation"]
            : ["sceneRender", "textureDisplay"];
          const runtime = runtimeRef.current;
          if (runtime.status !== "mounted" || !mountedBackend || !cameraFrustum || !subject) {
            throw new Error("Completed display has no mounted WebGPU runtime evidence");
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
            ...(apertureGatherDiagnostic ? { apertureGather: apertureGatherDiagnostic } : {}),
            ...(presentationDiagnostic ? { presentation: presentationDiagnostic } : {}),
          });
          if (physicalDiagnostic) setPhysicalCocDiagnostics(physicalDiagnostic);
          propsRef.current.onBackendDetails(details);
          if (!sceneRenderTiming) {
            throw new Error("Completed Raw frame has no scene render timing evidence");
          }
          const frameId = `${generation.generationId}:${latest.identity.requestId}:${++frameSequence}`;
          setLastDisplayedRequestId(latest.identity.requestId);
          setLastDisplayedFrameId(frameId);
          recordGroundGlassWebGpuTestEvent({
            kind: "frame-performance",
            evidence: {
              generationId: generation.generationId,
              requestId: latest.identity.requestId,
              sourceWidthPx: target.width,
              sourceHeightPx: target.height,
              sceneRender: sceneRenderTiming,
              physicalCocFootprint: physicalCocFootprintTiming,
              physicalValidity: physicalValidityTiming,
            },
          });
          recordGroundGlassWebGpuTestEvent({
            kind: "frame-completed",
            attemptId: attemptIdentity.attemptId,
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
    registerGroundGlassApertureGatherCaptureTriggerForTest(() => {
      const accepted = requestRef.current;
      renderNowRef.current?.(accepted);
    });
    registerGroundGlassB1BoundaryProbeTriggerForTest(() => {
      const accepted = requestRef.current;
      renderNowRef.current?.(accepted);
    });
    registerGroundGlassM6cAlphaCaptureTriggerForTest(() => {
      const accepted = requestRef.current;
      renderNowRef.current?.(accepted);
    });

    initialization = Promise.resolve().then(async () => {
      // StrictMode replays setup/cleanup/setup synchronously in development. Do not acquire a
      // renderer until this effect instance survives that replay.
      if (effectTokenRef.current !== effectToken || !isGenerationActive()) return;
      try {
        recordGroundGlassWebGpuAdapterAttemptForTest(attemptIdentity, THREE.REVISION);
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
            attemptId: attemptIdentity.attemptId,
            generationId: generation.generationId,
            rendererRevision: THREE.REVISION,
            rendererFamily: runtime.rendererFamily,
            executionApi: runtime.actualExecutionApi,
            internalFallback: runtime.internalFallback,
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
        m6SessionProvisioningAllowed =
          runtime.actualExecutionApi === "webgpu" &&
          isGroundGlassM6CapablePilotSessionForBuild(
            currentRequest,
            isGroundGlassM6PresentationBuildEnabled(),
            "webgpu",
            runtime.actualExecutionApi,
          );
        setM6ResourceProvisioning((current) => ({
          ...current,
          status: m6SessionProvisioningAllowed ? "provisioning" : "inactive",
          physicalReady: false,
          gatherReady: false,
          gatherTargetCount: 0,
        }));
        physicalResourcesProvisioned =
          runtime.actualExecutionApi === "webgpu" &&
          isGroundGlassPhysicalCocResourceProvisioningEnabled(currentRequest);
        apertureGatherResourcesProvisioned =
          runtime.actualExecutionApi === "webgpu" &&
          isGroundGlassApertureGatherResourceProvisioningEnabled(currentRequest);
        if (physicalResourcesProvisioned && forceGroundGlassPhysicalCocUnsupportedForTest()) {
          physicalResourcesProvisioned = false;
          physicalPassStatus = "unsupported";
          physicalPassUnsupportedReason =
            "test-only capability control: required RGBA16F physical storage is unavailable";
          if (m6SessionProvisioningAllowed) {
            throw new Error(`M6 session physical resource provisioning failed: ${physicalPassUnsupportedReason}`);
          }
        }
        if (physicalResourcesProvisioned) {
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
            physicalResourcesProvisioned = false;
            physicalPassStatus = "unsupported";
            physicalPassUnsupportedReason = "sampleable depth attachment initialization failed: " + errorMessage(error);
            if (m6SessionProvisioningAllowed) {
              throw new Error(`M6 session physical resource provisioning failed: ${physicalPassUnsupportedReason}`);
            }
          }
        }
        target.texture.colorSpace = THREE.NoColorSpace;
        target.texture.minFilter = THREE.LinearFilter;
        target.texture.magFilter = THREE.LinearFilter;
        target.texture.generateMipmaps = false;
        const cameraConfiguration = makeCamera(renderer, currentRequest, target.width, target.height);
        camera = cameraConfiguration.camera;
        cameraFrustum = cameraConfiguration.frustum;
        if (physicalResourcesProvisioned) {
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
            physicalResourcesProvisioned = false;
            physicalPassStatus = "unsupported";
            physicalPassUnsupportedReason = "physical target or kernel initialization failed: " + errorMessage(error);
            if (m6SessionProvisioningAllowed) {
              throw new Error(`M6 session physical resource provisioning failed: ${physicalPassUnsupportedReason}`);
            }
          }
        } else if (physicalPassStatus !== "unsupported") {
          physicalPassStatus = "disabled";
        }
        if (apertureGatherResourcesProvisioned) {
          if (!physicalResourcesProvisioned || !physicalTarget || !validityTarget || !target.depthTexture) {
            apertureGatherStatus = "unsupported";
            apertureGatherUnsupportedReason = "M4 physical CoC research inputs are not enabled";
            if (m6SessionProvisioningAllowed) {
              throw new Error(`M6 session gather resource provisioning failed: ${apertureGatherUnsupportedReason}`);
            }
          } else {
            try {
              apertureGatherSettings = resolveGroundGlassApertureGatherSettings(currentRequest.scene.id);
              apertureGatherResources = createGroundGlassApertureGatherResources({
                sourceColorTarget: target,
                sceneDepthTexture: target.depthTexture,
                physicalTarget,
                validityTarget,
                sourceWidthPx: target.width,
                sourceHeightPx: target.height,
                sampledFilmWidthMm: CAMERA_CONSTANTS.filmWidthMm * currentRequest.inspectionWindow.widthFraction,
                sampledFilmHeightMm: CAMERA_CONSTANTS.filmHeightMm * currentRequest.inspectionWindow.heightFraction,
                inverseProjection: camera.projectionMatrixInverse,
                settings: apertureGatherSettings,
              });
              apertureGatherStatus = "ready";
              apertureGatherUnsupportedReason = null;
            } catch (error) {
              apertureGatherStatus = "unsupported";
              apertureGatherUnsupportedReason = "M5 target or node initialization failed: " + errorMessage(error);
              if (m6SessionProvisioningAllowed) {
                throw new Error(`M6 session gather resource provisioning failed: ${apertureGatherUnsupportedReason}`);
              }
            }
          }
        } else {
          apertureGatherStatus = "disabled";
        }
        setCameraEvidence({
          configured: true,
          coordinateSystem: runtime.actualExecutionApi === "webgpu" ? "webgpu" : "webgl",
          frustum: cameraConfiguration.frustum,
        });
        if (!target.depthBuffer) throw new Error("Raw WebGPU render target must own an enabled depth attachment");
        setTargetDepthEnabled(true);
        if (m6SessionProvisioningAllowed) {
          try {
            if (!physicalResourcesProvisioned || !physicalTarget || !validityTarget ||
                !target.depthTexture || !apertureGatherResourcesProvisioned || !apertureGatherResources) {
              throw new Error("Authorized M6 session did not provision its complete M4/M5 target set");
            }
            const m6OwnedTargets = [
              target,
              physicalTarget,
              validityTarget,
              ...apertureGatherResources.targets,
            ];
            m6OwnedTargets.forEach((ownedTarget) => {
              renderer!.initRenderTarget(ownedTarget);
              if (ownedTarget === apertureGatherResources?.farTarget) {
                // Inject after a real M5 target allocation so cleanup is exercised from a
                // partially initialized M4/M5 resource set.
                throwIfGroundGlassWebGpuFailureInjected("m6-optical-resource-initialization");
              }
            });
            const observedFormats = {
              sourceColor: observeTextureFormat(mountedBackend!, target.texture),
              depth: observeTextureFormat(mountedBackend!, target.depthTexture),
              physical: observeTextureFormat(mountedBackend!, physicalTarget.texture),
              validity: observeTextureFormat(mountedBackend!, validityTarget.texture),
              far: observeTextureFormat(mountedBackend!, apertureGatherResources.farTarget.texture),
              near: observeTextureFormat(mountedBackend!, apertureGatherResources.nearTarget.texture),
              b1: observeTextureFormat(mountedBackend!, apertureGatherResources.b1Target.texture),
              composite: observeTextureFormat(mountedBackend!, apertureGatherResources.researchCompositeTarget.texture),
              provenance: [
                apertureGatherResources.sourceIdentityTarget,
                apertureGatherResources.gatherIdentityTarget,
                apertureGatherResources.gatherCenterProvenanceTarget,
                apertureGatherResources.selectedProvenanceTarget,
              ].every((ownedTarget) =>
                observeTextureFormat(mountedBackend!, ownedTarget.texture) === "rgba32float",
              ) ? "rgba32float" : null,
              decisions: observeTextureFormat(mountedBackend!, apertureGatherResources.b1DecisionTarget.texture),
            };
            const formatEligibility = resolveGroundGlassApertureGatherFormatEligibility({
              observedFormats,
            });
            if (formatEligibility.status !== "eligible") {
              throw new Error(`Authorized M6 session target preflight failed: ${formatEligibility.reason}`);
            }
            apertureGatherFormats = observedFormats;
          } catch (error) {
            setM6ResourceProvisioning((current) => ({ ...current, status: "failed" }));
            throw new Error(`M6 optical resource initialization failed: ${errorMessage(error)}`);
          }
        }
        setM6ResourceProvisioning((current) => ({
          ...current,
          status: m6SessionProvisioningAllowed ? "ready" : "inactive",
          physicalReady: physicalResourcesProvisioned && physicalPassStatus === "ready",
          gatherReady: apertureGatherResourcesProvisioned && apertureGatherStatus === "ready" && apertureGatherResources !== null,
          gatherTargetCount: apertureGatherResources?.targets.length ?? 0,
        }));
        setPhysicalCocDiagnostics(
          runtime.actualExecutionApi === "webgpu" &&
          (physicalResourcesProvisioned || physicalPassStatus === "unsupported")
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
        setApertureGatherDiagnostics(
          apertureGatherResourcesProvisioned && runtime.actualExecutionApi === "webgpu"
            ? makeApertureGatherDiagnostic({
                status: apertureGatherStatus,
                request: currentRequest,
                generation,
                target,
                settings: apertureGatherSettings,
                failureReason: apertureGatherFailureReason,
                qualityGateReason: apertureGatherUnsupportedReason,
              })
            : null,
        );
        display = await createRequestDisplay(
          currentRequest,
          camera,
          target.width,
          target.height,
        );
        if (isGroundGlassM6PresentationRequest(currentRequest)) {
          throwIfGroundGlassWebGpuFailureInjected("m6-presentation-node-initialization");
        }
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
          ...(presentationDiagnostic ? { presentation: presentationDiagnostic } : {}),
          ...(runtime.actualExecutionApi === "webgpu" &&
          (physicalResourcesProvisioned || physicalPassStatus === "unsupported")
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
          ...(apertureGatherResourcesProvisioned && runtime.actualExecutionApi === "webgpu"
            ? {
                apertureGather: makeApertureGatherDiagnostic({
                  status: apertureGatherStatus,
                  request: currentRequest,
                  generation,
                  target,
                  settings: apertureGatherSettings,
                  failureReason: apertureGatherFailureReason,
                  qualityGateReason: apertureGatherUnsupportedReason,
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
        const reportDeviceLoss = (reason: string): boolean => {
          if (retired || failureReported || !isGenerationActive()) return false;
          reportFailure(new Error(reason), "runtime", null);
          return true;
        };
        unregisterDeviceLossTestTrigger = registerGroundGlassDeviceLossTriggerForTest(
          requestRef.current.channel,
          () => {
            if (retired || failureReported || !isGenerationActive()) return false;
            recordGroundGlassWebGpuTestEvent({
              kind: "device-loss-equivalent-requested",
              attemptId: attemptIdentity.attemptId,
              generationId: generation.generationId,
              cause: "test-callback-equivalent",
            });
            return reportDeviceLoss("Injected test-only WebGPU device-loss equivalent");
          },
        );
        void device.lost?.then((info) => {
          // Adapter-owned teardown also resolves GPUDevice.lost. Count an unrequested loss only
          // while this generation is still active so normal cleanup cannot masquerade as device loss.
          if (!testDeviceDestroyRequested && (retired || failureReported || disposePromise !== null || !isGenerationActive())) return;
          const reason = info.reason ?? "unknown reason";
          const message = info.message ?? "";
          recordGroundGlassWebGpuTestEvent({
            kind: "device-lost-observed",
            attemptId: attemptIdentity.attemptId,
            generationId: generation.generationId,
            cause: testDeviceDestroyRequested ? "test-destroy" : "runtime-loss",
            reason,
            message,
          });
          reportDeviceLoss(`WebGPU device lost: ${info.message ?? info.reason ?? "unknown reason"}`);
        });
        unregisterDeviceDestroyTestTrigger = registerGroundGlassDeviceDestroyTriggerForTest(
          requestRef.current.channel,
          () => {
            if (retired || failureReported || !isGenerationActive()) return false;
            const destroyDevice = (device as typeof device & { destroy?: () => void }).destroy;
            if (typeof destroyDevice !== "function") return false;
            testDeviceDestroyRequested = true;
            recordGroundGlassWebGpuTestEvent({
              kind: "device-destroy-requested",
              attemptId: attemptIdentity.attemptId,
              generationId: generation.generationId,
              cause: "test-destroy",
            });
            destroyDevice.call(device);
            return true;
          },
        );
      } catch (error) {
        if (m6SessionProvisioningAllowed) {
          setM6ResourceProvisioning((current) => ({ ...current, status: "failed" }));
        }
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
        unregisterDeviceLossTestTrigger();
        unregisterDeviceDestroyTestTrigger();
        void disposeOwned().catch(() => undefined);
        renderNowRef.current = null;
        registerGroundGlassApertureGatherCaptureTriggerForTest(null);
        registerGroundGlassB1BoundaryProbeTriggerForTest(null);
        registerGroundGlassM6cAlphaCaptureTriggerForTest(null);
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
      data-frame-raw-debug={request.rawDebug ? "true" : "false"}
      data-preview-mode={request.previewMode}
      data-mounted-renderer-family={runtimeRef.current.status === "mounted" ? runtimeRef.current.rendererFamily : undefined}
      data-actual-execution-api={runtimeApi === "unknown" ? undefined : runtimeApi}
      data-internal-fallback={runtimeRef.current.status === "mounted" ? runtimeRef.current.internalFallback : undefined}
      data-m6-session-provisioning={m6ResourceProvisioning.status}
      data-m6-physical-resources-ready={m6ResourceProvisioning.physicalReady ? "true" : "false"}
      data-m6-gather-resources-ready={m6ResourceProvisioning.gatherReady ? "true" : "false"}
      data-m6-gather-target-count={m6ResourceProvisioning.gatherTargetCount}
      data-adapter-initial-request-id={m6ResourceProvisioning.initialRequestId ?? undefined}
      data-adapter-initial-raw-debug={m6ResourceProvisioning.initialRawDebug === null ? undefined : String(m6ResourceProvisioning.initialRawDebug)}
      data-m6-build-raw-pilot-enabled={m6BuildConfigurationEvidence.rawPilotEnabled ? "true" : "false"}
      data-m6-build-presentation-enabled={m6BuildConfigurationEvidence.m6PresentationEnabled ? "true" : "false"}
      data-m6-build-physical-research-enabled={m6BuildConfigurationEvidence.physicalCocResearchEnabled ? "true" : "false"}
      data-m6-build-gather-research-enabled={m6BuildConfigurationEvidence.apertureGatherResearchEnabled ? "true" : "false"}
      data-target-width={targetSize.width || undefined}
      data-target-height={targetSize.height || undefined}
      data-target-color-format={targetSize.width > 0 ? "rgba8unorm" : undefined}
      data-target-depth-enabled={targetDepthEnabled ? "true" : undefined}
      data-target-depth-format={targetDepthEnabled ? "depth24plus" : undefined}
      data-physical-coc-status={physicalCocDiagnostics?.status}
      data-physical-coc-request-id={physicalCocDiagnostics?.requestId}
      data-physical-coc-channel-id={physicalCocDiagnostics?.channelId}
      data-physical-coc-scene-id={physicalCocDiagnostics?.sceneId}
      data-physical-coc-renderer-generation={physicalCocDiagnostics?.rendererGenerationId}
      data-physical-coc-depth-format={physicalCocDiagnostics?.depthFormat ?? undefined}
      data-physical-coc-width-px={physicalCocDiagnostics?.widthPx}
      data-physical-coc-height-px={physicalCocDiagnostics?.heightPx}
      data-physical-coc-storage-format={physicalCocDiagnostics?.cocStorageFormat ?? undefined}
      data-physical-coc-validity-format={physicalCocDiagnostics?.validityStorageFormat ?? undefined}
      data-physical-coc-depth-confidence-status={physicalCocDiagnostics?.depthConfidenceStatus}
      data-physical-coc-passes={physicalCocDiagnostics?.completedPasses.join(",")}
      data-physical-coc-probe-readback-status={physicalCocDiagnostics?.probeReadbackStatus}
      data-physical-coc-probe-count={physicalCocDiagnostics?.probeSummary?.count}
      data-physical-coc-max-world-error-mm={physicalCocDiagnostics?.probeSummary?.maximumWorldPositionErrorMm ?? undefined}
      data-physical-coc-max-kernel-coc-error-mm={physicalCocDiagnostics?.probeSummary?.maximumKernelSignedCoCErrorMm ?? undefined}
      data-physical-coc-max-storage-coc-error-mm={physicalCocDiagnostics?.probeSummary?.maximumStoredSignedCoCErrorMm ?? undefined}
      data-aperture-gather-status={apertureGatherDiagnostics?.status}
      data-aperture-gather-request-id={apertureGatherDiagnostics?.requestId}
      data-aperture-gather-channel-id={apertureGatherDiagnostics?.channelId}
      data-aperture-gather-scene-id={apertureGatherDiagnostics?.sceneId}
      data-aperture-gather-renderer-generation={apertureGatherDiagnostics?.rendererGenerationId}
      data-aperture-gather-quality-mode={apertureGatherDiagnostics?.qualityMode ?? undefined}
      data-aperture-gather-source-width-px={apertureGatherDiagnostics?.sourceWidthPx}
      data-aperture-gather-source-height-px={apertureGatherDiagnostics?.sourceHeightPx}
      data-aperture-gather-far-width-px={apertureGatherDiagnostics?.farGatherWidthPx ?? undefined}
      data-aperture-gather-far-height-px={apertureGatherDiagnostics?.farGatherHeightPx ?? undefined}
      data-aperture-gather-near-width-px={apertureGatherDiagnostics?.nearGatherWidthPx ?? undefined}
      data-aperture-gather-near-height-px={apertureGatherDiagnostics?.nearGatherHeightPx ?? undefined}
      data-aperture-gather-passes={apertureGatherDiagnostics?.completedPasses.join(",")}
      data-aperture-gather-quality-gate-status={apertureGatherDiagnostics?.qualityGateStatus}
      data-aperture-gather-quality-gate-reason={apertureGatherDiagnostics?.qualityGateReason ?? undefined}
      data-aperture-gather-failure-reason={apertureGatherDiagnostics?.failureReason ?? undefined}
      data-presentation-mode={presentationDiagnostics?.mode}
      data-presentation-status={presentationDiagnostics?.status}
      data-presentation-source={presentationDiagnostics?.source}
      data-presentation-request-id={presentationDiagnostics?.requestId}
      data-presentation-channel-id={presentationDiagnostics?.channelId}
      data-presentation-scene-id={presentationDiagnostics?.sceneId}
      data-presentation-renderer-generation={presentationDiagnostics?.rendererGenerationId}
      data-presentation-renderer-revision={presentationDiagnostics?.rendererRevision}
      data-presentation-scene-source-revision={presentationDiagnostics?.sceneSourceRevision}
      data-presentation-evidence-revision={presentationDiagnostics?.verificationEvidenceRevision}
      data-presentation-quality={presentationDiagnostics?.opticalQuality}
      data-presentation-throughput-gain={presentationDiagnostics?.throughputGain ?? undefined}
      data-presentation-natural-illumination={presentationDiagnostics?.naturalIllumination}
      data-presentation-coverage={presentationDiagnostics?.coverage}
      data-presentation-output-width={presentationDiagnostics?.outputWidthPx}
      data-presentation-output-height={presentationDiagnostics?.outputHeightPx}
      data-presentation-additional-target-count={presentationDiagnostics?.additionalRenderTargetCount}
      data-presentation-additional-target-attachment-bytes={presentationDiagnostics?.additionalTargetAttachmentBytes}
      data-presentation-additional-fullscreen-pass-count={presentationDiagnostics?.additionalFullscreenPassCount}
      data-presentation-pass-renderer-call-cpu-ms={presentationDiagnostics?.passTiming?.rendererCallCpuMs}
      data-presentation-pass-queue-completion-wait-ms={presentationDiagnostics?.passTiming?.queueCompletionWaitMs}
      data-presentation-pass-wall-clock-ms={presentationDiagnostics?.passTiming?.wallClockMs}
      data-presentation-failure-reason={presentationDiagnostics?.failureReason}
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
      <canvas
        ref={canvasRef}
        aria-label={presentationDiagnostics?.mode === "m6-experimental-dof"
          ? "Experimental WebGPU Ground Glass presentation, optical quality unqualified"
          : "Raw WebGPU pilot output, no depth-of-field composite"}
        style={{ display: "block", width: "100%", height: "100%" }}
      />
      <div
        role="status"
        aria-live="polite"
        data-testid="ground-glass-webgpu-pilot-status"
        style={{ position: "absolute", top: 8, left: 8, padding: "4px 7px", borderRadius: 4, background: "rgba(15,23,42,.82)", color: "white", font: "600 11px/1.3 system-ui, sans-serif", pointerEvents: "none" }}
      >
        {presentationDiagnostics?.mode === "m6-experimental-dof"
          ? "WebGPU M6 Experimental · Optical quality unqualified · Production disabled"
          : "Raw WebGPU pilot · no DOF composite"}
      </div>
    </div>
  );
};
