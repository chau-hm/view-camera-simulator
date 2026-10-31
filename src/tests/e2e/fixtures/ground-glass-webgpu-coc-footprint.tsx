/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import * as THREE from "three";
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu";
import {
  abs,
  clamp,
  floor,
  float,
  fract,
  int,
  max,
  round,
  select,
  texture,
  uniformArray,
  uv,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";
import { groundGlassFootprintAxesToRttPixels } from "../../../render/groundGlassFootprintCoordinates";
import {
  FULL_GROUND_GLASS_INSPECTION_WINDOW,
  resolveGroundGlassInspectionWindow,
  resolveSampledFilmDimensionsMm,
} from "../../../render/groundGlassInspectionWindow";
import { resolveObserverRendererRuntime } from "../../../render/backend/observerVisualPipelineCapabilities";
import {
  decodeGroundGlassFootprintAxesMm,
  decodeGroundGlassFootprintOrientation,
  decodeGroundGlassSignedCoC,
} from "../../../render/groundGlassCocTarget";
import {
  BINARY16_RANGE_PROBE_SAMPLES,
  FOOTPRINT_STORAGE_MAX_MM,
  MAX_FINITE_BINARY16,
  PHYSICAL_STORAGE_SAMPLES,
  SIGNED_COC_STORAGE_MAX_MM,
} from "./ground-glass-webgpu-coc-footprint-cases";
import "./ground-glass-webgpu-coc-footprint.css";

type StorageCandidate = "half-float-mm" | "encoded-byte";
type OperationState = "queued" | "running" | "completed" | "failed" | "retired";
type OperationEvidence = {
  operationId: string;
  candidate: StorageCandidate | "lifecycle";
  kind: "roundtrip" | "binary16-range-probe" | "held-readback" | "injected-failure";
  state: OperationState;
  stage: string;
  failureClassification: "readback" | "execution" | null;
  error: string | null;
  acceptedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  writerCompleted: boolean;
  consumerCompleted: boolean;
  readbackStarted: boolean;
  readbackOutcome: "not-started" | "pending" | "succeeded" | "failed";
  readbackError: string | null;
  resultPublished: boolean;
};

type ResourceEvidence = {
  role: string;
  resourceId: string;
  state: "active" | "disposed" | "failed";
  disposalRequestCount: number;
  disposalCompletionCount: number;
  disposalFailed: string | null;
  disposeEventCount: number;
  gpuTextureId?: string | null;
};

type StoredSampleEvidence = {
  id: string;
  source: string;
  input: {
    signedCoCDiameterMm: number;
    majorRadiusMm: number;
    minorRadiusMm: number;
    orientationRad: number;
  };
  storedRaw: number[];
  storedPhysical: number[];
  gpuDecoded: number[];
  gpuClassification: number;
};

type SerializableFloat = number | "Infinity" | "-Infinity" | "NaN";
type Binary16RangeProbeEvidence = {
  maxFiniteBinary16: number;
  actualGpuFormat: string | null;
  policy: string;
  storageReadback: { status: "completed"; typedArray: string; sampleCount: number };
  metrics: {
    unsupportedPhysicalSampleCount: number;
    unrepresentableChannelCount: number;
    channelsSaturatedToMaxFinite: number;
  };
  samples: Array<{
    id: string;
    input: {
      signedCoCDiameterMm: number;
      majorRadiusMm: number;
      minorRadiusMm: number;
      orientationRad: number;
    };
    representableChannels: [boolean, boolean, boolean, boolean];
    storedHalfBits: number[];
    storedValues: SerializableFloat[];
    gpuDecodedValues: SerializableFloat[];
    absolutePhysicalChannelErrorMm: [SerializableFloat, SerializableFloat, SerializableFloat];
    gpuClassification: number;
    physicalInterpretation: "supported-binary16-range" | "unsupported-binary16-range";
  }>;
};

type CandidateEvidence = {
  candidate: StorageCandidate;
  requested: { format: string; type: string };
  actualGpuFormat: string | null;
  actualGpuUsage: number | null;
  texture: {
    colorSpace: string;
    minFilter: string;
    magFilter: string;
    generateMipmaps: boolean;
    width: number;
    height: number;
    textureUuid: string;
  };
  range: { cocDiameterMm: number; footprintRadiusMm: number };
  writerCompleted: boolean;
  storageReadback: { status: string; typedArray: string; sampleCount: number };
  consumerCompleted: boolean;
  classificationCompleted: boolean;
  outputColorSpace: string;
  toneMapping: number;
  filtering: {
    targetMinFilter: string;
    targetMagFilter: string;
    sourceCoCValuesMm: number[];
    midpointCoCMm: number;
    midpointClassification: "negative" | "neutral" | "positive";
  };
  resize: {
    completed: boolean;
    from: { width: number; height: number };
    to: { width: number; height: number };
    targetDisposeEvents: number;
    actualGpuFormatAfterResize: string | null;
    readbackSampleCount: number;
  };
  samples: StoredSampleEvidence[];
  metrics: {
    maximumSignedCoCErrorMm: number;
    maximumUnsaturatedSignedCoCErrorMm: number;
    maximumMajorRadiusErrorMm: number;
    maximumUnsaturatedMajorRadiusErrorMm: number;
    maximumMinorRadiusErrorMm: number;
    maximumUnsaturatedMinorRadiusErrorMm: number;
    maximumOrientationPeriodicErrorRad: number;
    maximumAnisotropyRatioAbsoluteError: number;
    signPreservedCount: number;
    nonzeroCoCCount: number;
    invalidAxisFailClosedCount: number;
    neutralByteCount: number;
    saturatedSignedCoCCount: number;
    saturatedFootprintAxisCount: number;
  };
};

type HandleEvidence = {
  instanceId: string;
  generation: number;
  state: "initializing" | "active" | "retiring" | "disposed" | "failed";
  runtime: {
    rendererFamily: string;
    executionBackend: string;
    applicationFallback: boolean;
    initialized: boolean;
    threeRevision: string;
    deviceFeatures: string[];
  } | null;
  operations: OperationEvidence[];
  candidates: CandidateEvidence[];
  binary16RangeProbe: Binary16RangeProbeEvidence | null;
  resources: ResourceEvidence[];
  cleanupStartedAt: number | null;
  cleanupCompletedAt: number | null;
  cleanupError: string | null;
};

type FixtureStore = {
  documentId: string;
  nextGeneration: number;
  nextInstance: number;
  nextGpuTexture: number;
  handles: HandleEvidence[];
  releaseHeldReadback: ((outcome: "release" | "reject") => void) | null;
  status: string;
  error: string | null;
  filmScale: null | {
    physicalRadiusMm: number;
    targetWidthPx: number;
    full: {
      sampledWidthMm: number;
      sampledHeightMm: number;
      majorAxisPx: [number, number];
      window: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    };
    centeredFourX: {
      sampledWidthMm: number;
      sampledHeightMm: number;
      majorAxisPx: [number, number];
      window: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    };
    offCenterFourX: {
      sampledWidthMm: number;
      sampledHeightMm: number;
      majorAxisPx: [number, number];
      window: { centerU: number; centerV: number; widthFraction: number; heightFraction: number };
    };
  };
};

type WindowWithFixtureStore = Window & { __groundGlassCocFootprintStore?: FixtureStore };

const store = (window as WindowWithFixtureStore).__groundGlassCocFootprintStore ??= {
  documentId: crypto.randomUUID(),
  nextGeneration: 1,
  nextInstance: 1,
  nextGpuTexture: 1,
  handles: [],
  releaseHeldReadback: null,
  status: "idle",
  error: null,
  filmScale: null,
};

const FIXTURE_SIZE = { width: 256, height: 64 };
const MAX_FINITE_FLOAT32 = 3.4028234663852886e38;
const CANDIDATES: readonly StorageCandidate[] = ["half-float-mm", "encoded-byte"];
const eventName = "ground-glass-webgpu-coc-footprint-change";
const publish = () => window.dispatchEvent(new Event(eventName));
const messageOf = (error: unknown): string => error instanceof Error ? error.message : String(error);

const filterName = (filter: number): string => filter === THREE.NearestFilter
  ? "NearestFilter"
  : filter === THREE.LinearFilter
    ? "LinearFilter"
    : String(filter);

const resolveFilmScaleEvidence = () => {
  const physicalRadiusMm = 0.05;
  const targetWidthPx = 1270;
  const fullWindow = FULL_GROUND_GLASS_INSPECTION_WINDOW;
  const centeredWindow = resolveGroundGlassInspectionWindow({ active: true, magnification: 4 });
  const offCenterWindow = resolveGroundGlassInspectionWindow({
    active: true,
    magnification: 4,
    normalizedPan: { x: 0.5, y: -0.25 },
  });
  const resolve = (inspectionWindow: typeof fullWindow) => {
    const sampled = resolveSampledFilmDimensionsMm({
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      inspectionWindow,
    });
    const axes = groundGlassFootprintAxesToRttPixels({
      majorRadiusMm: physicalRadiusMm,
      minorRadiusMm: physicalRadiusMm / 2,
      orientationRad: 0,
      renderWidthPx: targetWidthPx,
      renderHeightPx: 1016,
      filmWidthMm: sampled.widthMm,
      filmHeightMm: sampled.heightMm,
    });
    return {
      sampledWidthMm: sampled.widthMm,
      sampledHeightMm: sampled.heightMm,
      majorAxisPx: [...axes.majorAxisPx] as [number, number],
      window: {
        centerU: inspectionWindow.centerU,
        centerV: inspectionWindow.centerV,
        widthFraction: inspectionWindow.widthFraction,
        heightFraction: inspectionWindow.heightFraction,
      },
    };
  };
  return {
    physicalRadiusMm,
    targetWidthPx,
    full: resolve(fullWindow),
    centeredFourX: resolve(centeredWindow),
    offCenterFourX: resolve(offCenterWindow),
  };
};

const halfFloatDecoded = (data: Uint16Array, channel: number): number =>
  THREE.DataUtils.fromHalfFloat(data[channel]);

const serializeDiagnosticFloat = (value: number): SerializableFloat => {
  if (Number.isNaN(value)) return "NaN";
  if (value === Number.POSITIVE_INFINITY) return "Infinity";
  if (value === Number.NEGATIVE_INFINITY) return "-Infinity";
  return value;
};

type NativeBackendEvidence = {
  get?: (resource: unknown) => unknown;
  device?: {
    features?: Iterable<string>;
    queue?: { onSubmittedWorkDone?: () => Promise<void> };
  };
};

const getNativeTextureEvidence = (renderer: InstanceType<typeof WebGPURenderer>, texture: THREE.Texture) => {
  const backend = (renderer as unknown as { backend?: NativeBackendEvidence }).backend;
  let rawData: unknown;
  try {
    rawData = backend?.get?.(texture);
  } catch {
    rawData = undefined;
  }
  const data = rawData as {
    texture?: { format?: unknown; usage?: unknown };
    textureDescriptorGPU?: { format?: unknown };
  } | undefined;
  return {
    format: typeof data?.texture?.format === "string"
      ? data.texture.format
      : typeof data?.textureDescriptorGPU?.format === "string"
        ? data.textureDescriptorGPU.format
        : null,
    usage: typeof data?.texture?.usage === "number" ? data.texture.usage : null,
    gpuTexture: data?.texture && typeof data.texture === "object" ? data.texture : null,
    device: backend?.device,
  };
};

const createResourceEvidence = (
  handle: HandleEvidence,
  role: string,
  resourceId: string,
  dispose: () => void | Promise<void>,
  disposeEventCount?: () => number,
) => {
  const evidence: ResourceEvidence = {
    role,
    resourceId,
    state: "active",
    disposalRequestCount: 0,
    disposalCompletionCount: 0,
    disposalFailed: null,
    disposeEventCount: 0,
  };
  handle.resources.push(evidence);
  return {
    evidence,
    dispose: async () => {
      if (evidence.state !== "active") return;
      evidence.disposalRequestCount += 1;
      try {
        await dispose();
        evidence.disposalCompletionCount += 1;
        evidence.state = "disposed";
      } catch (error) {
        evidence.disposalFailed = messageOf(error);
        evidence.state = "failed";
      }
      if (disposeEventCount) evidence.disposeEventCount = disposeEventCount();
      publish();
    },
  };
};

type OwnedResource = ReturnType<typeof createResourceEvidence>;
type CandidateTargets = {
  storage: THREE.RenderTarget;
  decoded: THREE.RenderTarget;
  classification: THREE.RenderTarget;
  filterProbe: THREE.RenderTarget;
  storageResource: OwnedResource;
};

type StorageExperimentHandle = {
  instanceId: string;
  lifecycle: HandleEvidence;
  runCandidate: (candidate: StorageCandidate) => Promise<void>;
  runBinary16RangeProbe: () => Promise<void>;
  startHeldReadback: () => Promise<void>;
  injectWriterFailure: () => Promise<void>;
  dispose: () => Promise<void>;
};

const makeNumericTarget = (
  width: number,
  height: number,
  type: typeof THREE.HalfFloatType | typeof THREE.UnsignedByteType,
): THREE.RenderTarget => {
  const target = new THREE.RenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type,
    colorSpace: THREE.NoColorSpace,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  return target;
};

const createIndexedInput = () => ({
  coc: uniformArray<"float">(PHYSICAL_STORAGE_SAMPLES.map((sample) => sample.signedCoCDiameterMm), "float"),
  major: uniformArray<"float">(PHYSICAL_STORAGE_SAMPLES.map((sample) => sample.majorRadiusMm), "float"),
  minor: uniformArray<"float">(PHYSICAL_STORAGE_SAMPLES.map((sample) => sample.minorRadiusMm), "float"),
  orientation: uniformArray<"float">(PHYSICAL_STORAGE_SAMPLES.map((sample) => sample.orientationRad), "float"),
});

const buildStorageWriterNode = (candidate: StorageCandidate) => {
  const input = createIndexedInput();
  const index = int(floor(uv().x.mul(PHYSICAL_STORAGE_SAMPLES.length)));
  const sampleCoC = input.coc.element(index);
  const sampleMajor = input.major.element(index);
  const sampleMinor = input.minor.element(index);
  const sampleOrientation = input.orientation.element(index);
  const finiteCoC = abs(sampleCoC).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const cocMm = select(finiteCoC, sampleCoC, float(0));
  const finiteMajor = abs(sampleMajor).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const finiteMinor = abs(sampleMinor).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const positiveMajor = sampleMajor.greaterThan(0);
  const positiveMinor = sampleMinor.greaterThan(0);
  const sanitizedMajor = select(finiteMajor.and(positiveMajor), sampleMajor, float(0));
  const sanitizedMinor = select(finiteMinor.and(positiveMinor), sampleMinor, float(0));
  const orderedAxes = sanitizedMinor.lessThanEqual(sanitizedMajor);
  const majorMm = select(orderedAxes, sanitizedMajor, float(0));
  const minorMm = select(orderedAxes, sanitizedMinor, float(0));
  const finiteOrientation = abs(sampleOrientation).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const angle = select(finiteOrientation, sampleOrientation, float(0));
  const orientationNormalized = fract(angle.div(float(Math.PI)));

  if (candidate === "half-float-mm") {
    return vec4(cocMm, majorMm, minorMm, orientationNormalized);
  }

  const normalizedCoc = clamp(cocMm.div(float(SIGNED_COC_STORAGE_MAX_MM)), -1, 1);
  const negativeCode = round(float(128).add(normalizedCoc.mul(128)));
  const positiveCode = round(float(128).add(normalizedCoc.mul(127)));
  const cocCode = select(normalizedCoc.lessThan(0), negativeCode, positiveCode);
  const largestRadius = max(majorMm, minorMm);
  const pairScale = select(
    largestRadius.greaterThan(float(FOOTPRINT_STORAGE_MAX_MM)),
    float(FOOTPRINT_STORAGE_MAX_MM).div(max(largestRadius, float(1e-20))),
    float(1),
  );
  const majorNormalized = clamp(
    majorMm.mul(pairScale).div(float(FOOTPRINT_STORAGE_MAX_MM)),
    0,
    1,
  );
  const minorNormalized = clamp(
    minorMm.mul(pairScale).div(float(FOOTPRINT_STORAGE_MAX_MM)),
    0,
    1,
  );
  const orientationByteNormalized = orientationNormalized;
  return vec4(
    cocCode.div(255),
    round(majorNormalized.mul(255)).div(255),
    round(minorNormalized.mul(255)).div(255),
    round(orientationByteNormalized.mul(255)).div(255),
  );
};

const buildBinary16RangeWriterNode = () => {
  const input = {
    coc: uniformArray<"float">(BINARY16_RANGE_PROBE_SAMPLES.map((sample) => sample.signedCoCDiameterMm), "float"),
    major: uniformArray<"float">(BINARY16_RANGE_PROBE_SAMPLES.map((sample) => sample.majorRadiusMm), "float"),
    minor: uniformArray<"float">(BINARY16_RANGE_PROBE_SAMPLES.map((sample) => sample.minorRadiusMm), "float"),
    orientation: uniformArray<"float">(BINARY16_RANGE_PROBE_SAMPLES.map((sample) => sample.orientationRad), "float"),
  };
  const index = int(floor(uv().x.mul(BINARY16_RANGE_PROBE_SAMPLES.length)));
  const sampleCoC = input.coc.element(index);
  const sampleMajor = input.major.element(index);
  const sampleMinor = input.minor.element(index);
  const sampleOrientation = input.orientation.element(index);
  // This is input-finiteness validation in float32. It deliberately does not
  // constrain values to the binary16 range being measured by this probe.
  const finiteCoC = abs(sampleCoC).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const finiteMajor = abs(sampleMajor).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const finiteMinor = abs(sampleMinor).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const finiteOrientation = abs(sampleOrientation).lessThanEqual(float(MAX_FINITE_FLOAT32));
  const cocMm = select(finiteCoC, sampleCoC, float(0));
  const majorMm = select(finiteMajor.and(sampleMajor.greaterThan(0)), sampleMajor, float(0));
  const minorMm = select(finiteMinor.and(sampleMinor.greaterThan(0)), sampleMinor, float(0));
  const orientationRad = select(finiteOrientation, sampleOrientation, float(0));
  return vec4(cocMm, majorMm, minorMm, fract(orientationRad.div(float(Math.PI))));
};

const decodeStoredSample = (candidate: StorageCandidate, sampled: Node<"vec4">) => {
  if (candidate === "half-float-mm") {
    return {
      cocMm: sampled.r,
      majorMm: sampled.g,
      minorMm: sampled.b,
      angleRad: sampled.a.mul(float(Math.PI)),
    };
  }

  const cocCode = round(sampled.r.mul(255));
  const decodedNegative = cocCode.sub(128).div(128).mul(float(SIGNED_COC_STORAGE_MAX_MM));
  const decodedPositive = cocCode.sub(128).div(127).mul(float(SIGNED_COC_STORAGE_MAX_MM));
  const cocMm = select(
    cocCode.lessThan(128),
    decodedNegative,
    select(cocCode.greaterThan(128), decodedPositive, float(0)),
  );
  const majorMm = round(sampled.g.mul(255)).div(255).mul(float(FOOTPRINT_STORAGE_MAX_MM));
  const minorMm = round(sampled.b.mul(255)).div(255).mul(float(FOOTPRINT_STORAGE_MAX_MM));
  const orientation = round(sampled.a.mul(255)).div(255).mul(float(Math.PI));
  return { cocMm, majorMm, minorMm, angleRad: orientation };
};

const makePass = (
  geometry: THREE.PlaneGeometry,
  material: MeshBasicNodeMaterial,
): { scene: THREE.Scene; camera: THREE.OrthographicCamera } => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
  camera.position.z = 1;
  camera.updateMatrixWorld();
  scene.add(new THREE.Mesh(geometry, material));
  return { scene, camera };
};

const readTarget = async (
  renderer: InstanceType<typeof WebGPURenderer>,
  target: THREE.RenderTarget,
): Promise<Uint8Array | Uint16Array> => {
  const data = await renderer.readRenderTargetPixelsAsync(target, 0, 0, target.width, target.height);
  if (!(data instanceof Uint8Array) && !(data instanceof Uint16Array)) {
    throw new Error(`Unexpected r186 numerical readback type: ${data.constructor.name}`);
  }
  if (data.length !== target.width * target.height * 4) {
    throw new Error(`Unexpected unpadded one-row readback length ${data.length}`);
  }
  return data;
};

const getGpuTargetEvidence = (
  renderer: InstanceType<typeof WebGPURenderer>,
  target: THREE.RenderTarget,
  resource?: ResourceEvidence,
): { format: string | null; usage: number | null; gpuTexture: object | null } => {
  const targetEvidence = getNativeTextureEvidence(renderer, target.texture);
  const gpuTexture = targetEvidence.gpuTexture;
  if (!gpuTexture) return { format: targetEvidence.format, usage: targetEvidence.usage, gpuTexture: null };
  const identityMap = gpuTextureIdentities;
  let gpuTextureId = identityMap.get(gpuTexture);
  if (!gpuTextureId) {
    gpuTextureId = `gpu-texture-${store.nextGpuTexture++}`;
    identityMap.set(gpuTexture, gpuTextureId);
  }
  if (resource) resource.gpuTextureId = gpuTextureId;
  return { format: targetEvidence.format, usage: targetEvidence.usage, gpuTexture };
};

const gpuTextureIdentities = new WeakMap<object, string>();

const createStorageHandle = async (
  canvas: HTMLCanvasElement,
  generation: number,
  isCurrent: () => boolean,
): Promise<StorageExperimentHandle | null> => {
  const instanceId = `webgpu-coc-storage-g${generation}-i${store.nextInstance++}`;
  const lifecycle: HandleEvidence = {
    instanceId,
    generation,
    state: "initializing",
    runtime: null,
    operations: [],
    candidates: [],
    binary16RangeProbe: null,
    resources: [],
    cleanupStartedAt: null,
    cleanupCompletedAt: null,
    cleanupError: null,
  };
  store.handles.push(lifecycle);
  publish();

  const owned: OwnedResource[] = [];
  let renderer: InstanceType<typeof WebGPURenderer> | null = null;
  let retired = false;
  let operationSequence = 1;
  let operationQueue: Promise<void> = Promise.resolve();
  let disposePromise: Promise<void> | null = null;
  const targets = new Map<StorageCandidate, CandidateTargets>();
  const writerPasses = new Map<StorageCandidate, ReturnType<typeof makePass>>();
  const decodedPasses = new Map<StorageCandidate, ReturnType<typeof makePass>>();
  const classificationPasses = new Map<StorageCandidate, ReturnType<typeof makePass>>();
  const filterPasses = new Map<StorageCandidate, ReturnType<typeof makePass>>();
  const geometry = new THREE.PlaneGeometry(2, 2);

  const ownGeometry = createResourceEvidence(
    lifecycle,
    "writer-and-consumer-geometry",
    geometry.uuid,
    () => geometry.dispose(),
  );
  owned.push(ownGeometry);

  const ownMaterial = (role: string, material: MeshBasicNodeMaterial) => {
    const resource = createResourceEvidence(lifecycle, role, material.uuid, () => material.dispose());
    owned.push(resource);
    return resource;
  };

  const ownTarget = (role: string, target: THREE.RenderTarget): OwnedResource => {
    let disposeEventCount = 0;
    const resource = createResourceEvidence(
      lifecycle,
      role,
      target.texture.uuid,
      () => target.dispose(),
      () => disposeEventCount,
    );
    target.addEventListener("dispose", () => {
      disposeEventCount += 1;
      resource.evidence.disposeEventCount = disposeEventCount;
      publish();
    });
    owned.push(resource);
    return resource;
  };

  const allocateTarget = (
    candidate: StorageCandidate,
    role: string,
    width: number,
    height: number,
    type: typeof THREE.HalfFloatType | typeof THREE.UnsignedByteType,
  ) => {
    const target = makeNumericTarget(width, height, type);
    const resource = ownTarget(`${candidate}:${role}`, target);
    if (!renderer) throw new Error("Renderer was not initialized before target allocation");
    renderer.initRenderTarget(target);
    getGpuTargetEvidence(renderer, target, resource.evidence);
    return { target, resource };
  };

  const disposeOwned = async () => {
    const errors: string[] = [];
    for (const resource of [...owned].reverse()) {
      await resource.dispose();
      if (resource.evidence.disposalFailed) errors.push(`${resource.evidence.role}: ${resource.evidence.disposalFailed}`);
    }
    if (errors.length) lifecycle.cleanupError = errors.join("; ");
    return errors;
  };

  const createPassMaterial = (role: string, colorNode: Node<"vec4">) => {
    const material = new MeshBasicNodeMaterial({ toneMapped: false });
    // The built-in material color path clamps negative light and forces alpha
    // opaque. This fixture is a numeric storage probe, so use the explicit
    // fragment output to preserve signed CoC and normalized orientation.
    material.fragmentNode = colorNode;
    material.depthTest = false;
    material.depthWrite = false;
    material.transparent = false;
    ownMaterial(role, material);
    return material;
  };

  try {
    renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
    const rendererResource = createResourceEvidence(
      lifecycle,
      "renderer",
      `${instanceId}:renderer`,
      async () => renderer?.dispose(),
    );
    owned.push(rendererResource);
    await renderer.init();
    if (!isCurrent()) {
      retired = true;
      lifecycle.state = "retiring";
      lifecycle.cleanupStartedAt = Date.now();
      await disposeOwned();
      lifecycle.cleanupCompletedAt = Date.now();
      lifecycle.state = "disposed";
      publish();
      return null;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(FIXTURE_SIZE.width, FIXTURE_SIZE.height, false);
    renderer.outputColorSpace = THREE.NoColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    const runtime = resolveObserverRendererRuntime(renderer);
    const backend = (renderer as unknown as { backend?: NativeBackendEvidence }).backend;
    lifecycle.runtime = {
      ...runtime,
      applicationFallback: false,
      initialized: renderer.initialized,
      threeRevision: THREE.REVISION,
      deviceFeatures: Array.from(backend?.device?.features ?? []),
    };

    for (const candidate of CANDIDATES) {
      const storageType = candidate === "half-float-mm" ? THREE.HalfFloatType : THREE.UnsignedByteType;
      const storageAllocation = allocateTarget(
        candidate,
        "storage-target",
        PHYSICAL_STORAGE_SAMPLES.length,
        1,
        storageType,
      );
      const decodedAllocation = allocateTarget(
        candidate,
        "decoded-diagnostic-target",
        PHYSICAL_STORAGE_SAMPLES.length,
        1,
        THREE.HalfFloatType,
      );
      const classificationAllocation = allocateTarget(
        candidate,
        "classification-target",
        PHYSICAL_STORAGE_SAMPLES.length,
        1,
        THREE.HalfFloatType,
      );
      const filterAllocation = allocateTarget(
        candidate,
        "nearest-filter-probe-target",
        3,
        1,
        THREE.HalfFloatType,
      );
      targets.set(candidate, {
        storage: storageAllocation.target,
        decoded: decodedAllocation.target,
        classification: classificationAllocation.target,
        filterProbe: filterAllocation.target,
        storageResource: storageAllocation.resource,
      });

      const writer = createPassMaterial(
        `${candidate}:writer-material`,
        buildStorageWriterNode(candidate),
      );
      const writerPass = makePass(geometry, writer);
      writerPasses.set(candidate, writerPass);

      const stored = texture<"vec4">(storageAllocation.target.texture, uv());
      const decoded = decodeStoredSample(candidate, stored);
      const decoder = createPassMaterial(
        `${candidate}:consumer-decode-material`,
        vec4(decoded.cocMm, decoded.majorMm, decoded.minorMm, decoded.angleRad),
      );
      decodedPasses.set(candidate, makePass(geometry, decoder));

      const classifiedCoc = select(
        decoded.cocMm.lessThan(0),
        float(-1),
        select(decoded.cocMm.greaterThan(0), float(1), float(0)),
      );
      const classifier = createPassMaterial(
        `${candidate}:consumer-classification-material`,
        vec4(classifiedCoc, float(0), float(0), float(1)),
      );
      classificationPasses.set(candidate, makePass(geometry, classifier));

      const adjacentSourceIndex = (id: string) => {
        const index = PHYSICAL_STORAGE_SAMPLES.findIndex((sample) => sample.id === id);
        if (index < 0) throw new Error(`Missing nearest-filter source sample ${id}`);
        return index;
      };
      const negativeSourceIndex = adjacentSourceIndex("adjacent-negative");
      const positiveSourceIndex = adjacentSourceIndex("adjacent-positive");
      const filterUvs = uniformArray([
        new THREE.Vector2((negativeSourceIndex + 0.5) / PHYSICAL_STORAGE_SAMPLES.length, 0.5),
        new THREE.Vector2((positiveSourceIndex + 0.5) / PHYSICAL_STORAGE_SAMPLES.length, 0.5),
        new THREE.Vector2(((negativeSourceIndex + positiveSourceIndex + 1) / 2) / PHYSICAL_STORAGE_SAMPLES.length, 0.5),
      ], "vec2");
      const probeIndex = int(floor(uv().x.mul(3)));
      const probeStored = texture(storageAllocation.target.texture, filterUvs.element(probeIndex));
      const probeDecoded = decodeStoredSample(candidate, probeStored);
      const filterMaterial = createPassMaterial(
        `${candidate}:consumer-nearest-filter-material`,
        vec4(probeDecoded.cocMm, float(0), float(0), float(1)),
      );
      filterPasses.set(candidate, makePass(geometry, filterMaterial));
    }

    lifecycle.state = "active";
    store.filmScale = resolveFilmScaleEvidence();
    store.status = "running";
    store.error = null;
    publish();

    const runBinary16RangeProbe = () => enqueueOperation(
      "half-float-mm",
      "binary16-range-probe",
      async (operation) => {
        if (!renderer) throw new Error("Renderer is unavailable for binary16 range probe");
        const sampleCount = BINARY16_RANGE_PROBE_SAMPLES.length;
        const storage = allocateTarget(
          "half-float-mm",
          "binary16-range-storage-target",
          sampleCount,
          1,
          THREE.HalfFloatType,
        ).target;
        const decoded = allocateTarget(
          "half-float-mm",
          "binary16-range-decoded-target",
          sampleCount,
          1,
          THREE.HalfFloatType,
        ).target;
        const classification = allocateTarget(
          "half-float-mm",
          "binary16-range-classification-target",
          sampleCount,
          1,
          THREE.HalfFloatType,
        ).target;
        const writer = makePass(geometry, createPassMaterial(
          "half-float-mm:binary16-range-writer-material",
          buildBinary16RangeWriterNode(),
        ));
        const sampled = texture(storage.texture, uv());
        const decoder = makePass(geometry, createPassMaterial(
          "half-float-mm:binary16-range-decoder-material",
          vec4(sampled.r, sampled.g, sampled.b, sampled.a),
        ));
        const classificationNode = select(
          sampled.r.lessThan(0),
          float(-1),
          select(sampled.r.greaterThan(0), float(1), float(0)),
        );
        const classifier = makePass(geometry, createPassMaterial(
          "half-float-mm:binary16-range-classifier-material",
          vec4(classificationNode, float(0), float(0), float(1)),
        ));
        const readProbeTarget = async (target: THREE.RenderTarget) => {
          operation.readbackStarted = true;
          operation.readbackOutcome = "pending";
          try {
            const result = await readTarget(renderer!, target);
            operation.readbackOutcome = "succeeded";
            return result;
          } catch (error) {
            operation.readbackOutcome = "failed";
            operation.readbackError = messageOf(error);
            operation.failureClassification = "readback";
            throw error;
          }
        };

        operation.stage = "binary16-range-writer";
        await renderTargetPass(renderer, storage, writer);
        operation.writerCompleted = true;
        const storedReadback = await readProbeTarget(storage);
        if (!(storedReadback instanceof Uint16Array)) {
          throw new Error(`Expected binary16 storage readback, received ${storedReadback.constructor.name}`);
        }

        operation.stage = "binary16-range-consumer";
        await renderTargetPass(renderer, decoded, decoder);
        const decodedReadback = await readProbeTarget(decoded);
        if (!(decodedReadback instanceof Uint16Array)) {
          throw new Error(`Expected binary16 decoded readback, received ${decodedReadback.constructor.name}`);
        }
        operation.consumerCompleted = true;

        operation.stage = "binary16-range-classification";
        await renderTargetPass(renderer, classification, classifier);
        const classificationReadback = await readProbeTarget(classification);
        if (!(classificationReadback instanceof Uint16Array)) {
          throw new Error(`Expected binary16 classification readback, received ${classificationReadback.constructor.name}`);
        }

        const storageGpuEvidence = getNativeTextureEvidence(renderer, storage.texture);
        const samples = BINARY16_RANGE_PROBE_SAMPLES.map((sample, index) => {
          const offset = index * 4;
          const storedHalfBits = [0, 1, 2, 3].map((channel) => storedReadback[offset + channel]);
          const storedValues = storedHalfBits.map((bits) => serializeDiagnosticFloat(THREE.DataUtils.fromHalfFloat(bits)));
          const gpuDecodedValues = [0, 1, 2, 3].map((channel) =>
            serializeDiagnosticFloat(halfFloatDecoded(decodedReadback, offset + channel)),
          );
          const physicalInputs = [sample.signedCoCDiameterMm, sample.majorRadiusMm, sample.minorRadiusMm];
          const absolutePhysicalChannelErrorMm = physicalInputs.map((inputValue, channel) => {
            const decodedValue = gpuDecodedValues[channel];
            return typeof decodedValue === "number"
              ? serializeDiagnosticFloat(Math.abs(decodedValue - inputValue))
              : "Infinity";
          }) as [SerializableFloat, SerializableFloat, SerializableFloat];
          const cocRepresentable = Math.abs(sample.signedCoCDiameterMm) <= MAX_FINITE_BINARY16;
          const majorRepresentable = sample.majorRadiusMm <= MAX_FINITE_BINARY16;
          const minorRepresentable = sample.minorRadiusMm <= MAX_FINITE_BINARY16;
          const orientationRepresentable = Math.abs(sample.orientationRad / Math.PI) <= 1;
          const representableChannels: [boolean, boolean, boolean, boolean] = [
            cocRepresentable,
            majorRepresentable,
            minorRepresentable,
            orientationRepresentable,
          ];
          const physicallyRepresentable = representableChannels.every(Boolean);
          return {
            id: sample.id,
            input: {
              signedCoCDiameterMm: sample.signedCoCDiameterMm,
              majorRadiusMm: sample.majorRadiusMm,
              minorRadiusMm: sample.minorRadiusMm,
              orientationRad: sample.orientationRad,
            },
            representableChannels,
            storedHalfBits,
            storedValues,
            gpuDecodedValues,
            absolutePhysicalChannelErrorMm,
            gpuClassification: halfFloatDecoded(classificationReadback, offset),
            physicalInterpretation: physicallyRepresentable
              ? "supported-binary16-range" as const
              : "unsupported-binary16-range" as const,
          };
        });
        const unrepresentableChannelCount = samples.reduce(
          (count, sample) => count + sample.representableChannels.filter((representable) => !representable).length,
          0,
        );
        const channelsSaturatedToMaxFinite = samples.reduce((count, sample) => {
          const physicalChannels = [
            sample.input.signedCoCDiameterMm,
            sample.input.majorRadiusMm,
            sample.input.minorRadiusMm,
          ];
          return count + physicalChannels.reduce((channelCount, inputValue, channel) => {
            if (sample.representableChannels[channel]) return channelCount;
            const expectedSaturatedValue = channel === 0 && inputValue < 0
              ? -MAX_FINITE_BINARY16
              : MAX_FINITE_BINARY16;
            return channelCount + (sample.storedValues[channel] === expectedSaturatedValue ? 1 : 0);
          }, 0);
        }, 0);
        lifecycle.binary16RangeProbe = {
          maxFiniteBinary16: MAX_FINITE_BINARY16,
          actualGpuFormat: storageGpuEvidence.format,
          policy: "Out-of-range values are probe evidence only; max-finite storage is explicitly unsupported physical data, not a valid clamped CoC or footprint.",
          storageReadback: {
            status: "completed",
            typedArray: storedReadback.constructor.name,
            sampleCount,
          },
          metrics: {
            unsupportedPhysicalSampleCount: samples.filter((sample) =>
              sample.physicalInterpretation === "unsupported-binary16-range",
            ).length,
            unrepresentableChannelCount,
            channelsSaturatedToMaxFinite,
          },
          samples,
        };
        operation.stage = "binary16-range-probe-published";
        publish();
      },
    );

    const handle: StorageExperimentHandle = {
      instanceId,
      lifecycle,
      runCandidate: (candidate) => enqueueOperation(candidate, "roundtrip", async (operation) => {
        if (!renderer) throw new Error("Renderer was disposed before the candidate operation");
        const candidateTargets = targets.get(candidate);
        const writer = writerPasses.get(candidate);
        const decoder = decodedPasses.get(candidate);
        const classifier = classificationPasses.get(candidate);
        const filter = filterPasses.get(candidate);
        if (!candidateTargets || !writer || !decoder || !classifier || !filter) {
          throw new Error(`Missing allocated resources for ${candidate}`);
        }

        operation.stage = "gpu-writer";
        await renderTargetPass(renderer, candidateTargets.storage, writer);
        operation.writerCompleted = true;
        const storedReadback = await readTarget(renderer, candidateTargets.storage);
        operation.readbackStarted = true;
        operation.readbackOutcome = "succeeded";
        operation.stage = "storage-readback-completed";

        operation.stage = "gpu-consumer-decode";
        await renderTargetPass(renderer, candidateTargets.decoded, decoder);
        const decodedReadback = await readTarget(renderer, candidateTargets.decoded);
        operation.consumerCompleted = true;

        operation.stage = "gpu-consumer-classification";
        await renderTargetPass(renderer, candidateTargets.classification, classifier);
        const classReadback = await readTarget(renderer, candidateTargets.classification);

        operation.stage = "gpu-nearest-filter-probe";
        await renderTargetPass(renderer, candidateTargets.filterProbe, filter);
        const filterReadback = await readTarget(renderer, candidateTargets.filterProbe);

        const samples = PHYSICAL_STORAGE_SAMPLES.map((sample, index): StoredSampleEvidence => {
          const channelIndex = index * 4;
          const storageChannels = candidate === "half-float-mm"
            ? [0, 1, 2, 3].map((channel) => halfFloatDecoded(storedReadback as Uint16Array, channelIndex + channel))
            : [0, 1, 2, 3].map((channel) => (storedReadback as Uint8Array)[channelIndex + channel]);
          const storedPhysical = candidate === "half-float-mm"
            ? storageChannels
            : [
              decodeGroundGlassSignedCoC(storageChannels[0] / 255, candidate, SIGNED_COC_STORAGE_MAX_MM),
              decodeGroundGlassFootprintAxesMm({
                encodedMajorRadius: storageChannels[1] / 255,
                encodedMinorRadius: storageChannels[2] / 255,
                storageFormat: candidate,
                maximumRadiusMm: FOOTPRINT_STORAGE_MAX_MM,
              }).majorRadiusMm,
              decodeGroundGlassFootprintAxesMm({
                encodedMajorRadius: storageChannels[1] / 255,
                encodedMinorRadius: storageChannels[2] / 255,
                storageFormat: candidate,
                maximumRadiusMm: FOOTPRINT_STORAGE_MAX_MM,
              }).minorRadiusMm,
              decodeGroundGlassFootprintOrientation(storageChannels[3] / 255, candidate),
            ];
          const gpuDecoded = [0, 1, 2, 3].map((channel) => halfFloatDecoded(decodedReadback as Uint16Array, channelIndex + channel));
          const gpuClassification = halfFloatDecoded(classReadback as Uint16Array, channelIndex);
          return {
            id: sample.id,
            source: sample.source,
            input: {
              signedCoCDiameterMm: sample.signedCoCDiameterMm,
              majorRadiusMm: sample.majorRadiusMm,
              minorRadiusMm: sample.minorRadiusMm,
              orientationRad: sample.orientationRad,
            },
            storedRaw: storageChannels,
            storedPhysical,
            gpuDecoded,
            gpuClassification,
          };
        });

        const cocErrors = samples.map((sample) => Math.abs(sample.gpuDecoded[0] - sample.input.signedCoCDiameterMm));
        const unsaturatedCocErrors = samples
          .filter((sample) => Math.abs(sample.input.signedCoCDiameterMm) <= SIGNED_COC_STORAGE_MAX_MM)
          .map((sample) => Math.abs(sample.gpuDecoded[0] - sample.input.signedCoCDiameterMm));
        const validFootprints = samples.filter((sample) =>
          sample.input.majorRadiusMm >= sample.input.minorRadiusMm
          && sample.input.minorRadiusMm >= 0,
        );
        const inRangeFootprints = validFootprints.filter((sample) =>
          Math.max(sample.input.majorRadiusMm, sample.input.minorRadiusMm) <= FOOTPRINT_STORAGE_MAX_MM,
        );
        const majorErrors = validFootprints.map((sample) => Math.abs(sample.gpuDecoded[1] - sample.input.majorRadiusMm));
        const unsaturatedMajorErrors = inRangeFootprints.map((sample) =>
          Math.abs(sample.gpuDecoded[1] - sample.input.majorRadiusMm),
        );
        const minorErrors = validFootprints.map((sample) => Math.abs(sample.gpuDecoded[2] - sample.input.minorRadiusMm));
        const unsaturatedMinorErrors = inRangeFootprints.map((sample) =>
          Math.abs(sample.gpuDecoded[2] - sample.input.minorRadiusMm),
        );
        const orientationErrors = samples.map((sample) => periodicOrientationError(
          sample.gpuDecoded[3],
          sample.input.orientationRad,
        ));
        const anisotropyErrors = samples
          .filter((sample) => sample.input.majorRadiusMm > 0 && sample.input.minorRadiusMm > 0 && sample.gpuDecoded[2] > 0)
          .map((sample) => Math.abs(
            sample.gpuDecoded[1] / sample.gpuDecoded[2]
            - sample.input.majorRadiusMm / sample.input.minorRadiusMm,
          ));
        const storageEvidence = getNativeTextureEvidence(renderer, candidateTargets.storage.texture);
        const filterValues = [0, 1, 2].map((index) => halfFloatDecoded(filterReadback as Uint16Array, index * 4));
        const midpointClass = filterValues[2] < 0
          ? "negative"
          : filterValues[2] > 0
            ? "positive"
            : "neutral";
        const storageCodes = candidate === "encoded-byte" ? storedReadback as Uint8Array : null;
        const signedSaturationCount = storageCodes
          ? samples.filter((sample, index) => {
            const cocCode = storageCodes[index * 4];
            return Math.abs(sample.input.signedCoCDiameterMm) > SIGNED_COC_STORAGE_MAX_MM &&
              (cocCode === 0 || cocCode === 255);
          }).length
          : 0;
        const axisSaturationCount = storageCodes
          ? samples.reduce((count, sample, index) => {
            if (Math.max(sample.input.majorRadiusMm, sample.input.minorRadiusMm) <= FOOTPRINT_STORAGE_MAX_MM) return count;
            const majorCode = storageCodes[index * 4 + 1];
            return count + (majorCode === 255 ? 1 : 0);
          }, 0)
          : 0;

        const startSize = { width: candidateTargets.storage.width, height: candidateTargets.storage.height };
        const priorTarget = renderer.getRenderTarget();
        try {
          candidateTargets.storage.setSize(startSize.width + 1, startSize.height);
          renderer.initRenderTarget(candidateTargets.storage);
          await renderTargetPass(renderer, candidateTargets.storage, writer);
          const resizedReadback = await readTarget(renderer, candidateTargets.storage);
          const resizedTextureEvidence = getNativeTextureEvidence(renderer, candidateTargets.storage.texture);
          const candidateEvidence: CandidateEvidence = {
            candidate,
            requested: {
              format: "RGBAFormat",
              type: candidate === "half-float-mm" ? "HalfFloatType" : "UnsignedByteType",
            },
            actualGpuFormat: storageEvidence.format,
            actualGpuUsage: storageEvidence.usage,
            texture: {
              colorSpace: candidateTargets.storage.texture.colorSpace,
              minFilter: filterName(candidateTargets.storage.texture.minFilter),
              magFilter: filterName(candidateTargets.storage.texture.magFilter),
              generateMipmaps: candidateTargets.storage.texture.generateMipmaps,
              width: startSize.width,
              height: startSize.height,
              textureUuid: candidateTargets.storage.texture.uuid,
            },
            range: {
              cocDiameterMm: SIGNED_COC_STORAGE_MAX_MM,
              footprintRadiusMm: FOOTPRINT_STORAGE_MAX_MM,
            },
            writerCompleted: operation.writerCompleted,
            storageReadback: {
              status: "completed",
              typedArray: storedReadback.constructor.name,
              sampleCount: PHYSICAL_STORAGE_SAMPLES.length,
            },
            consumerCompleted: operation.consumerCompleted,
            classificationCompleted: true,
            outputColorSpace: renderer.outputColorSpace,
            toneMapping: renderer.toneMapping,
            filtering: {
              targetMinFilter: filterName(candidateTargets.storage.texture.minFilter),
              targetMagFilter: filterName(candidateTargets.storage.texture.magFilter),
              sourceCoCValuesMm: filterValues.slice(0, 2),
              midpointCoCMm: filterValues[2],
              midpointClassification: midpointClass,
            },
            resize: {
              completed: resizedReadback.length === (startSize.width + 1) * 4,
              from: startSize,
              to: { width: candidateTargets.storage.width, height: candidateTargets.storage.height },
              targetDisposeEvents: candidateTargets.storageResource.evidence.disposeEventCount,
              actualGpuFormatAfterResize: resizedTextureEvidence.format,
              readbackSampleCount: resizedReadback.length / 4,
            },
            samples,
            metrics: {
              maximumSignedCoCErrorMm: Math.max(...cocErrors),
              maximumUnsaturatedSignedCoCErrorMm: Math.max(...unsaturatedCocErrors),
              maximumMajorRadiusErrorMm: Math.max(...majorErrors),
              maximumUnsaturatedMajorRadiusErrorMm: Math.max(...unsaturatedMajorErrors),
              maximumMinorRadiusErrorMm: Math.max(...minorErrors),
              maximumUnsaturatedMinorRadiusErrorMm: Math.max(...unsaturatedMinorErrors),
              maximumOrientationPeriodicErrorRad: Math.max(...orientationErrors),
              maximumAnisotropyRatioAbsoluteError: anisotropyErrors.length ? Math.max(...anisotropyErrors) : 0,
              signPreservedCount: samples.filter((sample) =>
                sample.input.signedCoCDiameterMm !== 0
                && Math.sign(sample.input.signedCoCDiameterMm) === Math.sign(sample.gpuClassification),
              ).length,
              nonzeroCoCCount: samples.filter((sample) => sample.input.signedCoCDiameterMm !== 0).length,
              invalidAxisFailClosedCount: samples.filter((sample) =>
                sample.input.minorRadiusMm > sample.input.majorRadiusMm
                && sample.gpuDecoded[1] === 0
                && sample.gpuDecoded[2] === 0,
              ).length,
              neutralByteCount: candidate === "encoded-byte"
                ? samples.filter((sample) => sample.storedRaw[0] === 128).length
                : 0,
              saturatedSignedCoCCount: signedSaturationCount,
              saturatedFootprintAxisCount: axisSaturationCount,
            },
          };
          lifecycle.candidates = [
            ...lifecycle.candidates.filter((entry) => entry.candidate !== candidate),
            candidateEvidence,
          ];
          operation.stage = "diagnostics-published";
          publish();
        } finally {
          renderer.setRenderTarget(priorTarget);
        }
      }),
      runBinary16RangeProbe,
      startHeldReadback: () => enqueueOperation("lifecycle", "held-readback", async (operation) => {
        if (!renderer) throw new Error("Renderer is unavailable for held readback");
        const candidateTargets = targets.get("half-float-mm");
        const writer = writerPasses.get("half-float-mm");
        if (!candidateTargets || !writer) throw new Error("Half-float readback target is unavailable");
        await renderTargetPass(renderer, candidateTargets.storage, writer);
        operation.writerCompleted = true;
        operation.stage = "readback-started";
        operation.readbackStarted = true;
        operation.readbackOutcome = "pending";
        let releaseBarrier!: (outcome: "release" | "reject") => void;
        const barrier = new Promise<"release" | "reject">((resolve) => { releaseBarrier = resolve; });
        store.releaseHeldReadback = releaseBarrier;
        const readbackPromise = readTarget(renderer, candidateTargets.storage).then((result) => {
          operation.readbackOutcome = "succeeded";
          operation.stage = "readback-settled-held";
          publish();
          return result;
        }, (error: unknown) => {
          operation.readbackOutcome = "failed";
          operation.readbackError = messageOf(error);
          operation.failureClassification = "readback";
          throw error;
        });
        publish();
        const [pixels, outcome] = await Promise.all([readbackPromise, barrier]);
        if (outcome === "reject") {
          const injectedError = new Error("Injected test-only rejection of the accepted WebGPU readback Promise");
          operation.readbackOutcome = "failed";
          operation.readbackError = injectedError.message;
          operation.failureClassification = "readback";
          operation.stage = "readback-failed";
          throw injectedError;
        }
        if (retired) {
          operation.state = "retired";
          operation.stage = "stale-readback-discarded";
          operation.resultPublished = false;
          return;
        }
        operation.readbackOutcome = "succeeded";
        operation.stage = `readback-released-${pixels.length}-values`;
        operation.resultPublished = true;
      }),
      injectWriterFailure: () => enqueueOperation("lifecycle", "injected-failure", async (operation) => {
        if (!renderer) throw new Error("Renderer is unavailable for writer failure probe");
        const candidateTargets = targets.get("encoded-byte");
        const writer = writerPasses.get("encoded-byte");
        if (!candidateTargets || !writer) throw new Error("Byte writer target is unavailable");
        await renderTargetPass(renderer, candidateTargets.storage, writer);
        operation.writerCompleted = true;
        operation.stage = "injected-writer-post-pass-failure";
        throw new Error("Injected Phase D failure after native numeric writer pass");
      }),
      dispose: () => {
        if (disposePromise) return disposePromise;
        retired = true;
        lifecycle.state = "retiring";
        lifecycle.cleanupStartedAt = Date.now();
        publish();
        disposePromise = (async () => {
          await operationQueue;
          store.releaseHeldReadback?.("release");
          const errors = await disposeOwned();
          lifecycle.cleanupCompletedAt = Date.now();
          lifecycle.cleanupError = errors.length ? errors.join("; ") : null;
          lifecycle.state = errors.length ? "failed" : "disposed";
          store.releaseHeldReadback = null;
          store.status = "disposed";
          publish();
        })();
        return disposePromise;
      },
    };

    return handle;
  } catch (error) {
    lifecycle.state = "retiring";
    lifecycle.cleanupStartedAt = Date.now();
    retired = true;
    const errors = await disposeOwned();
    lifecycle.cleanupCompletedAt = Date.now();
    lifecycle.cleanupError = errors.length ? errors.join("; ") : null;
    lifecycle.state = "failed";
    store.status = "failed";
    store.error = messageOf(error);
    publish();
    throw error;
  }

  function enqueueOperation(
    candidate: StorageCandidate | "lifecycle",
    kind: OperationEvidence["kind"],
    work: (operation: OperationEvidence) => Promise<void>,
  ): Promise<void> {
    if (retired) return Promise.reject(new Error(`Handle ${instanceId} is retired`));
    const operation: OperationEvidence = {
      operationId: `${instanceId}-op${operationSequence++}`,
      candidate,
      kind,
      state: "queued",
      stage: "queued",
      failureClassification: null,
      error: null,
      acceptedAt: Date.now(),
      startedAt: null,
      completedAt: null,
      writerCompleted: false,
      consumerCompleted: false,
      readbackStarted: false,
      readbackOutcome: "not-started",
      readbackError: null,
      resultPublished: false,
    };
    lifecycle.operations.push(operation);
    const running = operationQueue.then(async () => {
      if (retired) {
        operation.state = "retired";
        operation.stage = "retired-before-start";
        operation.completedAt = Date.now();
        publish();
        return;
      }
      operation.state = "running";
      operation.startedAt = Date.now();
      operation.stage = "started";
      publish();
      try {
        await work(operation);
        if (operation.state === "running") {
          operation.state = retired ? "retired" : "completed";
          if (operation.stage === "diagnostics-published" && retired) {
            operation.stage = "result-discarded-after-retirement";
            operation.resultPublished = false;
          }
          if (!retired) operation.resultPublished = true;
        }
      } catch (error) {
        operation.state = "failed";
        operation.stage = operation.readbackStarted && operation.readbackOutcome === "failed"
          ? "readback-failed"
          : "operation-failed";
        operation.error = messageOf(error);
        if (operation.readbackOutcome === "failed") {
          operation.readbackError ??= operation.error;
          operation.failureClassification = "readback";
        } else {
          operation.failureClassification = "execution";
        }
        operation.resultPublished = false;
      }
      operation.completedAt = Date.now();
      if (operation.kind === "roundtrip" && operation.state === "completed") store.status = "ready";
      publish();
    });
    operationQueue = running.then(() => undefined, () => undefined);
    return running;
  }
};

const periodicOrientationError = (a: number, b: number): number => {
  const period = Math.PI;
  const raw = Math.abs(a - b) % period;
  return Math.min(raw, period - raw);
};

const renderTargetPass = async (
  renderer: InstanceType<typeof WebGPURenderer>,
  target: THREE.RenderTarget,
  pass: { scene: THREE.Scene; camera: THREE.OrthographicCamera },
) => {
  const priorTarget = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target);
    renderer.clear(true, false, false);
    renderer.render(pass.scene, pass.camera);
  } finally {
    renderer.setRenderTarget(priorTarget);
  }
  const backend = (renderer as unknown as { backend?: NativeBackendEvidence }).backend;
  if (backend?.device?.queue?.onSubmittedWorkDone) await backend.device.queue.onSubmittedWorkDone();
};

const ExperimentRoute = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<StorageExperimentHandle | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const generation = store.nextGeneration++;
    const canvas = canvasRef.current;
    if (!canvas) {
      store.status = "failed";
      store.error = "Experiment canvas did not mount";
      publish();
      return;
    }

    void createStorageHandle(canvas, generation, () => active).then(async (handle) => {
      if (!handle) return;
      if (!active) {
        await handle.dispose();
        return;
      }
      handleRef.current = handle;
      await handle.runCandidate("half-float-mm");
      if (active) await handle.runCandidate("encoded-byte");
    }).catch((error: unknown) => {
      store.status = "failed";
      store.error = messageOf(error);
      setLocalError(store.error);
      publish();
    });

    return () => {
      active = false;
      const handle = handleRef.current;
      handleRef.current = null;
      if (handle) void handle.dispose();
    };
  }, []);

  return (
    <section className="coc-storage-fixture" data-testid="coc-storage-experiment" data-mount-state="mounted">
      <h1>Native WebGPU physical CoC storage experiment</h1>
      <canvas ref={canvasRef} data-testid="coc-storage-canvas" />
      <div className="coc-storage-controls">
        <button type="button" onClick={() => {
          const handle = handleRef.current;
          if (handle) void handle.startHeldReadback().catch((error: unknown) => setLocalError(messageOf(error)));
        }}>Start held readback</button>
        <button type="button" data-testid="coc-storage-run-binary16-range-probe" onClick={() => {
          const handle = handleRef.current;
          if (handle) void handle.runBinary16RangeProbe().catch((error: unknown) => setLocalError(messageOf(error)));
        }}>Run binary16 range probe</button>
        <button type="button" onClick={() => {
          const handle = handleRef.current;
          if (handle) void handle.injectWriterFailure();
        }}>Inject writer failure</button>
      </div>
      {localError ? <p role="alert">{localError}</p> : null}
    </section>
  );
};

const AwayRoute = () => (
  <section className="coc-storage-fixture" data-testid="coc-storage-away" data-mount-state="mounted">
    <h1>No experimental renderer is mounted on this route</h1>
  </section>
);

const Diagnostics = () => {
  const location = useLocation();
  const [, setRevision] = useState(0);
  useEffect(() => {
    const refresh = () => setRevision((value) => value + 1);
    window.addEventListener(eventName, refresh);
    const interval = window.setInterval(refresh, 100);
    return () => {
      window.removeEventListener(eventName, refresh);
      window.clearInterval(interval);
    };
  }, []);
  return (
    <>
      <nav className="coc-storage-nav">
        <Link to="/experiment" data-testid="coc-storage-nav-experiment">Experiment</Link>
        <Link to="/away" data-testid="coc-storage-nav-away">Away</Link>
        <button type="button" data-testid="coc-storage-release-readback" onClick={() => {
          store.releaseHeldReadback?.("release");
          publish();
        }}>Release held readback</button>
        <button type="button" data-testid="coc-storage-reject-readback" onClick={() => {
          store.releaseHeldReadback?.("reject");
          publish();
        }}>Reject held readback (test only)</button>
      </nav>
      <pre data-testid="coc-storage-diagnostics">
        {JSON.stringify({
          route: location.pathname,
          documentId: store.documentId,
          status: store.status,
          error: store.error,
          filmScale: store.filmScale,
          handles: store.handles,
        })}
      </pre>
    </>
  );
};

const App = () => (
  <HashRouter>
    <main className="coc-storage-fixture">
      <Diagnostics />
      <Routes>
        <Route path="/experiment" element={<ExperimentRoute />} />
        <Route path="/away" element={<AwayRoute />} />
        <Route path="*" element={<Navigate to="/experiment" replace />} />
      </Routes>
    </main>
  </HashRouter>
);

const rootElement = document.getElementById("ground-glass-webgpu-coc-footprint");
if (!rootElement) throw new Error("Ground Glass WebGPU CoC fixture root is missing");
createRoot(rootElement).render(<App />);
