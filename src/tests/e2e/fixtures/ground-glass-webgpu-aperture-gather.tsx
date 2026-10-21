/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Navigate, Route, Routes } from "react-router-dom";
import * as THREE from "three";
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu";
import type Node from "three/src/nodes/core/Node.js";
import {
  Loop,
  abs,
  atan,
  clamp,
  cos,
  cross,
  dot,
  float,
  exp,
  fract,
  Fn,
  getViewPosition,
  int,
  length,
  max,
  min,
  select,
  sin,
  smoothstep,
  sqrt,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { getRenderQualitySettings } from "../../../render/renderQuality";
import { resolveObserverRendererRuntime } from "../../../render/backend/observerVisualPipelineCapabilities";
import {
  APERTURE_GATHER_CASES,
  goldenAngleDiskSample,
  mapPhysicalEllipseToSourcePixels,
  type GatherReferenceProbe,
} from "./ground-glass-webgpu-aperture-gather-cases";

const WIDTH = APERTURE_GATHER_CASES.sourceWidthPx;
const HEIGHT = APERTURE_GATHER_CASES.sourceHeightPx;
const CHANGE_EVENT = "ground-glass-webgpu-aperture-gather-change";
const GOLDEN_ANGLE = APERTURE_GATHER_CASES.goldenAngleRad;
type FailureStage = "physical-coc" | "far-gather" | "near-gather" | "composite" | "readback";
type QualityMode = "standard" | "low" | "stress-64";
type ResourceEvidence = {
  id: string;
  role: string;
  allocation: "allocated";
  state: "active" | "disposal-requested" | "disposed" | "failed";
  error: string | null;
};
type OperationEvidence = {
  operationId: string;
  kind: "initial-render" | "render" | "held-readback" | "injected-failure";
  state: "accepted" | "running" | "completed" | "failed" | "retired";
  stage: string;
  acceptedAt: number;
  completedAt: number | null;
  resultPublished: boolean;
  readbackStarted: boolean;
  readbackOutcome: "not-started" | "pending" | "succeeded" | "failed";
  error: string | null;
};
type FixtureHandleEvidence = {
  instanceId: string;
  generation: number;
  state: "initializing" | "active" | "retiring" | "disposed" | "failed";
  runtime: {
    rendererFamily: string;
    executionBackend: string;
    applicationFallback: boolean;
    initialized: boolean;
    threeRevision: string;
  } | null;
  dimensions: {
    sourceWidthPx: number;
    sourceHeightPx: number;
    physicalCocWidthPx: number;
    physicalCocHeightPx: number;
    farGatherWidthPx: number;
    farGatherHeightPx: number;
    nearGatherWidthPx: number;
    nearGatherHeightPx: number;
    compositeWidthPx: number;
    compositeHeightPx: number;
    sampledFilmWidthMm: number;
    sampledFilmHeightMm: number;
    focusOffsetMm: number;
    quality: QualityMode;
    sampleCount: number;
    maximumCoCRadiusPx: number;
  } | null;
  formats: Record<string, { requested: string; actual: string | null }> | null;
  passes: Array<{ id: string; state: "completed" | "failed"; error: string | null }>;
  metrics: {
    rawRedPixelCount: number;
    compositeRedPixelCount: number;
    nearSpreadPixelGain: number;
    rawYellowPixelCount: number;
    compositeYellowPixelCount: number;
    farSpreadPixelGain: number;
    farYellowSignalOutsideBluePixelCount: number;
    farYellowSignalOutsideBlueEnergy: number;
    nearRedSpreadOutsideSharpPixelCount: number;
    nearBlueBackgroundLeakPixelCount: number;
    farRedForegroundLeakPixelCount: number;
    nonzeroNearAlphaPixels: number;
    validPhysicalPixelCount: number;
    noDepthPixelCount: number;
    invalidPhysicalPixelCount: number;
    unresolvedPixelCount: number;
    nearSidePixelCount: number;
    farSidePixelCount: number;
    maximumAbsSignedCoCMm: number;
    maximumPhysicalAxisMm: number;
  } | null;
  pointProbes: Array<{
    id: string;
    worldPointM: [number, number, number];
    pixelTopOrigin: { x: number; y: number };
    pixelReadbackOrigin: "top" | "bottom";
    gpuDepth: number;
    worldPositionMm: [number, number, number];
    physicalRgba16Float: [number, number, number, number];
    sourceColor: [number, number, number];
    farGatherRgba: [number, number, number, number];
    nearGatherRgba: [number, number, number, number];
    compositeColor: [number, number, number];
    validityCode: number;
  }>;
  gatherReferenceProbes: GatherReferenceProbe[];
  unresolvedSample: null | {
    validityCode: number;
    storedFootprint: [number, number, number, number];
    sourceColor: [number, number, number];
    farGather: [number, number, number, number];
    nearGather: [number, number, number, number];
  };
  sampleDiagnostics: {
    majorAxisPx: [number, number];
    minorAxisPx: [number, number];
    clampedMajorAxisPx: [number, number];
    clampedMinorAxisPx: [number, number];
    clampScale: number;
    firstGoldenDiskSample: [number, number];
    firstFarSampleOffsetPx: [number, number];
    sampleCount: number;
    maximumCoCRadiusPx: number;
  } | null;
  operations: OperationEvidence[];
  resources: ResourceEvidence[];
  error: string | null;
  cleanupError: string | null;
  cleanupCompletedAt: number | null;
};
type MountedHandle = {
  evidence: FixtureHandleEvidence;
  render: (input?: { quality?: QualityMode; apertureFNumber?: number; filmTiltDeg?: number; focusOffsetMm?: number; crop?: boolean; forceUnresolved?: boolean }) => Promise<string>;
  startHeldReadback: () => string;
  injectFailure: (stage: FailureStage) => Promise<string>;
  dispose: () => Promise<void>;
};
type FixtureStore = {
  revision: number;
  nextGeneration: number;
  handles: FixtureHandleEvidence[];
  activeHandleId: string | null;
  status: string;
  releaseReadback: (() => void) | null;
};
type WindowWithFixtureStore = Window & { __groundGlassWebGpuApertureGather?: FixtureStore };
const store = (window as WindowWithFixtureStore).__groundGlassWebGpuApertureGather ??= {
  revision: 0,
  nextGeneration: 1,
  handles: [],
  activeHandleId: null,
  status: "idle",
  releaseReadback: null,
};
const signal = () => {
  store.revision += 1;
  window.dispatchEvent(new Event(CHANGE_EVENT));
};
const subscribeToFixture = (callback: () => void) => {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
};
const getFixtureRevision = () => store.revision;
const useDiagnosticsVersion = () => useSyncExternalStore(subscribeToFixture, getFixtureRevision, getFixtureRevision);
const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error);
const half = (data: Uint16Array, index: number) => THREE.DataUtils.fromHalfFloat(data[index] ?? 0);
const countColor = (data: Uint16Array, predicate: (r: number, g: number, b: number) => boolean) => {
  let count = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    if (predicate(half(data, offset), half(data, offset + 1), half(data, offset + 2))) count += 1;
  }
  return count;
};
const configureTargetTexture = (target: THREE.RenderTarget) => {
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.minFilter = THREE.NearestFilter;
  target.texture.magFilter = THREE.NearestFilter;
  target.texture.generateMipmaps = false;
  target.texture.wrapS = THREE.ClampToEdgeWrapping;
  target.texture.wrapT = THREE.ClampToEdgeWrapping;
};
const makeTarget = (width: number, height: number, options: {
  type?: THREE.TextureDataType;
  depthBuffer?: boolean;
}) => {
  const target = new THREE.RenderTarget(width, height, {
    format: THREE.RGBAFormat,
    type: options.type ?? THREE.HalfFloatType,
    depthBuffer: options.depthBuffer ?? false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  configureTargetTexture(target);
  if (options.depthBuffer) {
    target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
    target.depthTexture.format = THREE.DepthFormat;
    target.depthTexture.minFilter = THREE.NearestFilter;
    target.depthTexture.magFilter = THREE.NearestFilter;
    target.depthTexture.generateMipmaps = false;
  }
  return target;
};

const makeBasis = (
  normalInput: Node<"vec3">,
  primaryInput: Node<"vec3">,
  secondaryInput: Node<"vec3">,
) => {
  const normalLength = length(normalInput);
  const normal = normalInput.div(max(normalLength, 1e-7));
  const projectedPrimary = primaryInput.sub(normal.mul(dot(primaryInput, normal)));
  const projectedSecondary = secondaryInput.sub(normal.mul(dot(secondaryInput, normal)));
  const primaryLength = length(projectedPrimary);
  const projected = select(primaryLength.greaterThan(1e-7), projectedPrimary, projectedSecondary);
  const projectedLength = length(projected);
  const x = projected.div(max(projectedLength, 1e-7));
  const yCandidate = cross(normal, x).div(max(length(cross(normal, x)), 1e-7));
  const y = select(dot(yCandidate, secondaryInput).lessThan(0), yCandidate.mul(-1), yCandidate);
  const valid = normalLength.greaterThan(1e-7)
    .and(projectedLength.greaterThan(1e-7))
    .and(length(cross(normal, x)).greaterThan(1e-7));
  return { normal, x, y, valid };
};

const buildHandle = async (canvas: HTMLCanvasElement): Promise<MountedHandle> => {
  const generation = store.nextGeneration++;
  const evidence: FixtureHandleEvidence = {
    instanceId: `aperture-g${generation}-${crypto.randomUUID()}`,
    generation,
    state: "initializing",
    runtime: null,
    dimensions: null,
    formats: null,
    passes: [],
    metrics: null,
    pointProbes: [],
    gatherReferenceProbes: [],
    unresolvedSample: null,
    sampleDiagnostics: null,
    operations: [],
    resources: [],
    error: null,
    cleanupError: null,
    cleanupCompletedAt: null,
  };
  store.handles.push(evidence);
  signal();
  const renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
  const owned: Array<{ id: string; role: string; dispose: () => void | Promise<void> }> = [];
  const register = (id: string, role: string, dispose: () => void | Promise<void>) => {
    owned.push({ id, role, dispose });
    evidence.resources.push({ id, role, allocation: "allocated", state: "active", error: null });
  };
  register(`${evidence.instanceId}:renderer`, "webgpu-renderer", () => renderer.dispose());
  let retired = false;
  let disposePromise: Promise<void> | null = null;
  const pendingOperations = new Set<Promise<void>>();
  let operationChain: Promise<void> = Promise.resolve();

  const failAt = (expected: FailureStage | undefined, actual: FailureStage) => {
    if (expected === actual) throw new Error(`Injected Phase F failure after ${actual} pass`);
  };

  try {
    await renderer.init();
    renderer.setPixelRatio(1);
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.outputColorSpace = THREE.NoColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 1);

    const scene = new THREE.Scene();
    scene.background = null;
    const sceneObjects: Array<{ id: string; mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: MeshBasicNodeMaterial }> = [];
    const addPlane = (definition: {
      id: string;
      worldPointM: [number, number, number];
      sizeM: [number, number];
      linearColor: [number, number, number];
    }) => {
      const geometry = new THREE.PlaneGeometry(...definition.sizeM);
      const material = new MeshBasicNodeMaterial({ toneMapped: false });
      material.side = THREE.DoubleSide;
      material.outputNode = vec4(...definition.linearColor, 1);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = definition.id;
      mesh.position.set(...definition.worldPointM);
      scene.add(mesh);
      sceneObjects.push({ id: definition.id, mesh, geometry, material });
    };
    addPlane({ id: "far-blue-background", worldPointM: [0, 0, 0.75], sizeM: [0.72, 0.56], linearColor: [0.025, 0.08, 0.85] });
    addPlane({ id: "focused-green-target", worldPointM: [0.11, 0.015, 0.5], sizeM: [0.085, 0.085], linearColor: [0.03, 0.9, 0.04] });
    addPlane({ id: "far-yellow-feature", worldPointM: [0.07, 0.075, 0.7499], sizeM: [0.075, 0.065], linearColor: [0.95, 0.62, 0.025] });
    addPlane({ id: "near-red-foreground", worldPointM: [-0.075, -0.005, 0.32], sizeM: [0.12, 0.15], linearColor: [0.95, 0.015, 0.015] });
    for (const object of sceneObjects) {
      register(`${evidence.instanceId}:${object.id}:geometry`, "owned-scene-geometry", () => object.geometry.dispose());
      register(`${evidence.instanceId}:${object.id}:material`, "owned-scene-material", () => object.material.dispose());
    }

    const camera = new THREE.PerspectiveCamera(40, WIDTH / HEIGHT, 0.01, 2);
    camera.position.set(0, 0, -0.12);
    camera.lookAt(0, 0, 0.5);
    camera.coordinateSystem = renderer.coordinateSystem;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const sourceTarget = makeTarget(WIDTH, HEIGHT, { depthBuffer: true });
    const cocTarget = makeTarget(WIDTH, HEIGHT, { type: THREE.HalfFloatType });
    const validityTarget = makeTarget(WIDTH, HEIGHT, { type: THREE.UnsignedByteType });
    const worldTarget = makeTarget(WIDTH, HEIGHT, { type: THREE.FloatType });
    register(`${evidence.instanceId}:source-target`, "rgba16float-scene-color-plus-depth-target", () => sourceTarget.dispose());
    register(`${evidence.instanceId}:physical-coc-target`, "rgba16float-physical-coc-footprint-target", () => cocTarget.dispose());
    register(`${evidence.instanceId}:validity-target`, "rgba8unorm-physical-validity-target", () => validityTarget.dispose());
    register(`${evidence.instanceId}:world-diagnostic-target`, "rgba32float-world-position-diagnostic-target", () => worldTarget.dispose());

    const postGeometry = new THREE.PlaneGeometry(2, 2);
    register(`${evidence.instanceId}:fullscreen-geometry`, "owned-fullscreen-geometry", () => postGeometry.dispose());
    const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postCamera.position.z = 0;
    postCamera.updateMatrixWorld(true);
    const physicalProjectionInverse = uniform(camera.projectionMatrixInverse.clone());
    const physicalCameraWorld = uniform(camera.matrixWorld.clone());
    const lensCenterMm = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensCenterMm));
    const lensNormalInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensNormal));
    const lensBasisXInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensBasisX));
    const lensBasisYInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.lensBasisY));
    const filmPointMm = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmPointMm));
    const filmNormalInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmNormal));
    const filmBasisXInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmBasisX));
    const filmBasisYInput = uniform(new THREE.Vector3(...APERTURE_GATHER_CASES.filmBasisY));
    const focalLengthMm = uniform(APERTURE_GATHER_CASES.focalLengthMm);
    const apertureFNumber = uniform(APERTURE_GATHER_CASES.apertureFNumber);
    const explicitParallelLimitIdentity = uniform(0);
    const sampledFilmWidthMm = uniform(APERTURE_GATHER_CASES.fullFilmWidthMm);
    const sampledFilmHeightMm = uniform(APERTURE_GATHER_CASES.fullFilmHeightMm);
    const forceUnresolvedMask = uniform(0);

    const sourceUvTop = vec2(uv().x, uv().y.oneMinus());
    const sampledDepth = texture(sourceTarget.depthTexture!, sourceUvTop).r;
    const viewPosition = getViewPosition(sourceUvTop, sampledDepth, physicalProjectionInverse);
    const worldPositionMm = physicalCameraWorld.mul(vec4(viewPosition, 1)).xyz.mul(1000);
    const objectDelta = worldPositionMm.sub(lensCenterMm);
    const lens = makeBasis(lensNormalInput, lensBasisXInput, lensBasisYInput);
    const film = makeBasis(filmNormalInput, filmBasisXInput, filmBasisYInput);
    const objectDistanceMm = dot(objectDelta, lens.normal);
    const lateralOffsetMm = objectDelta.sub(lens.normal.mul(objectDistanceMm));
    const imageDenominator = objectDistanceMm.sub(focalLengthMm);
    const finiteImage = abs(imageDenominator).greaterThan(0);
    const parallelImageLimit = explicitParallelLimitIdentity.greaterThan(0.5).and(finiteImage.not());
    const focalBranchResolved = finiteImage.or(parallelImageLimit);
    const safeObjectDistance = select(abs(objectDistanceMm).greaterThan(1e-7), objectDistanceMm, 1);
    const safeImageDenominator = select(finiteImage, imageDenominator, 1);
    const idealImageDistanceMm = focalLengthMm.mul(objectDistanceMm).div(safeImageDenominator);
    const imagePoint = lensCenterMm
      .sub(lens.normal.mul(idealImageDistanceMm))
      .sub(lateralOffsetMm.mul(idealImageDistanceMm.div(safeObjectDistance)));
    const finiteDirection = select(
      idealImageDistanceMm.lessThan(0),
      lensCenterMm.sub(imagePoint),
      imagePoint.sub(lensCenterMm),
    );
    const parallelDirectionInput = lens.normal.mul(-1).sub(lateralOffsetMm.div(safeObjectDistance));
    const parallelDirection = parallelDirectionInput.div(max(length(parallelDirectionInput), 1e-7));
    const imageDirectionInput = select(finiteImage, finiteDirection, parallelDirection);
    const imageDirection = imageDirectionInput.div(max(length(imageDirectionInput), 1e-7));
    const imagePointUsed = select(finiteImage, imagePoint, lensCenterMm);
    const filmDenominator = dot(imageDirection, film.normal);
    const safeFilmDenominator = select(abs(filmDenominator).greaterThan(1e-7), filmDenominator, 1);
    const centerFilmDistance = dot(filmPointMm.sub(lensCenterMm), film.normal).div(safeFilmDenominator);
    const filmDelta = filmPointMm.sub(lensCenterMm);
    const apertureRadiusMm = focalLengthMm.div(apertureFNumber.mul(2));
    const apertureX = lens.x.mul(apertureRadiusMm);
    const apertureY = lens.y.mul(apertureRadiusMm);
    const imageVector = imagePointUsed.sub(lensCenterMm);
    const finiteDenominator = dot(imageVector, film.normal);
    const safeFiniteDenominator = select(abs(finiteDenominator).greaterThan(1e-7), finiteDenominator, 1);
    const rayParameter = dot(filmDelta, film.normal).div(safeFiniteDenominator);
    const mapFiniteOffset = (apertureOffset: Node<"vec3">) => apertureOffset
      .sub(imageVector.mul(dot(apertureOffset, film.normal).div(safeFiniteDenominator)))
      .mul(float(1).sub(rayParameter));
    const mapParallelOffset = (apertureOffset: Node<"vec3">) => apertureOffset
      .sub(imageDirection.mul(dot(apertureOffset, film.normal).div(safeFilmDenominator)));
    const mappedX = select(finiteImage, mapFiniteOffset(apertureX), mapParallelOffset(apertureX));
    const mappedY = select(finiteImage, mapFiniteOffset(apertureY), mapParallelOffset(apertureY));
    const matrix00 = dot(mappedX, film.x);
    const matrix10 = dot(mappedX, film.y);
    const matrix01 = dot(mappedY, film.x);
    const matrix11 = dot(mappedY, film.y);
    const covariance00 = matrix00.mul(matrix00).add(matrix01.mul(matrix01));
    const covariance01 = matrix00.mul(matrix10).add(matrix01.mul(matrix11));
    const covariance11 = matrix10.mul(matrix10).add(matrix11.mul(matrix11));
    const traceHalf = covariance00.add(covariance11).mul(0.5);
    const discriminant = length(vec2(covariance00.sub(covariance11).mul(0.5), covariance01));
    const majorRadiusMm = sqrt(max(0, traceHalf.add(discriminant)));
    const minorRadiusMm = sqrt(max(0, traceHalf.sub(discriminant)));
    const orientationVector = vec2(covariance01.mul(2), covariance00.sub(covariance11));
    const orientationVectorDefined = length(orientationVector).greaterThan(1e-12);
    const orientationPrincipalRad = atan(
      select(orientationVectorDefined, orientationVector.x, 0),
      select(orientationVectorDefined, orientationVector.y, 1),
    ).mul(0.5);
    const orientationDefined = majorRadiusMm.sub(minorRadiusMm).greaterThan(1e-7).and(orientationVectorDefined);
    const orientationRad = select(orientationDefined, orientationPrincipalRad, 0);
    const orientationNormalized = select(orientationDefined, fract(orientationRad.div(Math.PI)), 0);
    const imagePlaneDeltaMm = dot(imagePoint.sub(filmPointMm), film.normal);
    const finiteSide = select(
      abs(imagePlaneDeltaMm).greaterThan(1e-7),
      select(imagePlaneDeltaMm.lessThan(0), -1, 1),
      0,
    );
    const signedSide = select(parallelImageLimit, -1, finiteSide);
    const signedCoCDiameterMm = signedSide.mul(2).mul(sqrt(max(0, majorRadiusMm.mul(minorRadiusMm))));
    const geometryValid = lens.valid
      .and(film.valid)
      .and(objectDistanceMm.greaterThan(1e-7))
      .and(focalLengthMm.greaterThan(0))
      .and(apertureFNumber.greaterThan(0))
      .and(sampledFilmWidthMm.greaterThan(0))
      .and(sampledFilmHeightMm.greaterThan(0))
      .and(length(imageDirectionInput).greaterThan(1e-7))
      .and(centerFilmDistance.greaterThan(1e-14))
      .and(abs(filmDenominator).greaterThan(1e-7));
    const storageRepresentable = abs(signedCoCDiameterMm).lessThanEqual(65504)
      .and(majorRadiusMm.lessThanEqual(65504))
      .and(minorRadiusMm.lessThanEqual(65504))
      .and(orientationNormalized.greaterThanEqual(0))
      .and(orientationNormalized.lessThanEqual(1));
    const depthValid = sampledDepth.lessThan(1);
    const unresolved = depthValid.and(geometryValid).and(focalBranchResolved.not());
    const forcedUnresolved = forceUnresolvedMask.greaterThan(0.5)
      .and(uv().x.greaterThan(0.49)).and(uv().x.lessThan(0.51))
      .and(uv().y.greaterThan(0.49)).and(uv().y.lessThan(0.51));
    const code = select(
      depthValid,
      select(geometryValid, select(focalBranchResolved, select(storageRepresentable, 1, 2), 4), 3),
      0,
    );
    const validityCode = select(forcedUnresolved.or(unresolved), 4, code);
    const validStore = validityCode.equal(1);
    const storedFootprint = vec4(
      select(validStore, signedCoCDiameterMm, 0),
      select(validStore, majorRadiusMm, 0),
      select(validStore, minorRadiusMm, 0),
      select(validStore, orientationNormalized, 0),
    );
    const worldPositionDiagnostic = vec4(worldPositionMm, sampledDepth);
    const physicalMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    physicalMaterial.outputNode = storedFootprint;
    const validityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    validityMaterial.outputNode = vec4(validityCode.div(255), 0, 0, 1);
    const worldMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    worldMaterial.outputNode = worldPositionDiagnostic;
    const physicalScene = new THREE.Scene();
    const validityScene = new THREE.Scene();
    const worldScene = new THREE.Scene();
    physicalScene.add(new THREE.Mesh(postGeometry, physicalMaterial));
    validityScene.add(new THREE.Mesh(postGeometry, validityMaterial));
    worldScene.add(new THREE.Mesh(postGeometry, worldMaterial));
    register(`${evidence.instanceId}:physical-material`, "physical-coc-tsl-material", () => physicalMaterial.dispose());
    register(`${evidence.instanceId}:validity-material`, "validity-tsl-material", () => validityMaterial.dispose());
    register(`${evidence.instanceId}:world-material`, "world-position-tsl-diagnostic-material", () => worldMaterial.dispose());

    const projectionInverse = uniform(camera.projectionMatrixInverse.clone());
    const maximumRadiusPx = uniform(0);
    const sampleCount = uniform(0);
    const textureUvTop = vec2(uv().x, uv().y.oneMinus());
    const validCodeAt = (sourceUv: Node<"vec2">) => {
      const codeValue = texture(validityTarget.texture, sourceUv).r;
      return codeValue.greaterThan(0.5 / 255).and(codeValue.lessThan(1.5 / 255));
    };
    const physicalAt = (sourceUv: Node<"vec2">) => texture(cocTarget.texture, sourceUv);
    const depthAt = (sourceUv: Node<"vec2">) => texture(sourceTarget.depthTexture!, sourceUv).r;
    const colorAt = (sourceUv: Node<"vec2">) => texture(sourceTarget.texture, sourceUv).rgb;
    const axesToPixels = (physical: Node<"vec4">) => {
      const angle = physical.a.mul(Math.PI);
      const safeFilmWidthMm = max(sampledFilmWidthMm, 1e-6);
      const safeFilmHeightMm = max(sampledFilmHeightMm, 1e-6);
      const major = vec2(
        cos(angle).mul(physical.g).mul(WIDTH).div(safeFilmWidthMm),
        sin(angle).mul(-1).mul(physical.g).mul(HEIGHT).div(safeFilmHeightMm),
      );
      const minor = vec2(
        sin(angle).mul(-1).mul(physical.b).mul(WIDTH).div(safeFilmWidthMm),
        cos(angle).mul(-1).mul(physical.b).mul(HEIGHT).div(safeFilmHeightMm),
      );
      const extent = max(length(major), length(minor));
      const scale = select(
        extent.greaterThan(0),
        min(1, maximumRadiusPx.div(max(extent, 1e-6))),
        1,
      );
      return { major, minor, scale, extent };
    };
    const distanceMmAt = (sourceUv: Node<"vec2">, depth: Node<"float">) =>
      abs(getViewPosition(sourceUv, depth, projectionInverse).z).mul(1000);
    const depthToleranceAt = (distance: Node<"float">) => max(20, distance.mul(0.015));
    const determinant = (major: Node<"vec2">, minor: Node<"vec2">, scale: Node<"float">) =>
      major.mul(scale).x.mul(minor.mul(scale).y).sub(major.mul(scale).y.mul(minor.mul(scale).x));
    const footprintWeight = (
      offsetPx: Node<"vec2">,
      major: Node<"vec2">,
      minor: Node<"vec2">,
      scale: Node<"float">,
    ) => {
      const majorScaled = major.mul(scale);
      const minorScaled = minor.mul(scale);
      const det = determinant(majorScaled, minorScaled, float(1));
      const safeDet = select(abs(det).greaterThan(1e-6), det, 1);
      const localX = offsetPx.x.mul(minorScaled.y).sub(offsetPx.y.mul(minorScaled.x)).div(safeDet);
      const localY = offsetPx.y.mul(majorScaled.x).sub(offsetPx.x.mul(majorScaled.y)).div(safeDet);
      const radius = length(vec2(localX, localY));
      const edge = float(1).sub(smoothstep(1, 1.02, radius));
      return select(abs(det).greaterThan(1e-6), edge, 0);
    };

    const createGatherMaterial = (layer: "far" | "near") => {
      const node = Fn(() => {
        const sourceUv = textureUvTop;
        const centerColor = colorAt(sourceUv);
        const centerPhysical = physicalAt(sourceUv);
        const centerValid = validCodeAt(sourceUv);
        const centerSignedCoC = centerPhysical.r;
        const centerDepth = depthAt(sourceUv);
        const centerDistance = distanceMmAt(sourceUv, centerDepth);
        const centerNear = centerValid.and(centerSignedCoC.lessThan(-0.00001));
        const centerFar = centerValid.and(centerSignedCoC.greaterThan(0.00001));
        const activeSamples = max(sampleCount, 1);
        const colorAccum = vec3(0).toVar();
        const weightAccum = float(0).toVar();
        const coverageMass = float(0).toVar();
        if (layer === "far") {
          const centerAxes = axesToPixels(centerPhysical);
          const centerMajor = centerAxes.major.mul(centerAxes.scale);
          const centerMinor = centerAxes.minor.mul(centerAxes.scale);
          const centerContribution = select(centerFar, 1, 0);
          colorAccum.assign(centerColor.mul(centerContribution));
          weightAccum.assign(centerContribution);
          Loop({ start: int(0), end: int(APERTURE_GATHER_CASES.maxApertureSamples) }, ({ i }) => {
            const index = float(i);
            const radial = sqrt(index.add(0.5).div(activeSamples));
            const angle = index.add(0.5).mul(GOLDEN_ANGLE);
            const disk = radial.mul(vec2(cos(angle), sin(angle)));
            const offsetPx = centerMajor.mul(disk.x).add(centerMinor.mul(disk.y));
            const sampleUv = clamp(
              sourceUv.add(vec2(offsetPx.x.div(WIDTH), offsetPx.y.div(HEIGHT))),
              vec2(0),
              vec2(1),
            );
            const samplePhysical = physicalAt(sampleUv);
            const sampleDepth = depthAt(sampleUv);
            const sampleDistance = distanceMmAt(sampleUv, sampleDepth);
            const sampleCoc = samplePhysical.r;
            const sampleValid = validCodeAt(sampleUv).and(sampleDepth.lessThan(1));
            const depthOk = sampleDistance.greaterThanEqual(centerDistance.sub(depthToleranceAt(centerDistance)));
            const accepted = centerFar
              .and(sampleValid)
              .and(sampleCoc.greaterThanEqual(-0.00001))
              .and(depthOk)
              .and(index.lessThan(sampleCount));
            const weight = select(accepted, 1, 0);
            colorAccum.addAssign(colorAt(sampleUv).mul(weight));
            weightAccum.addAssign(weight);
          });
          const gathered = select(weightAccum.greaterThan(1e-6), colorAccum.div(max(weightAccum, 1e-6)), centerColor);
          return vec4(gathered, 1);
        }

        const centerForeground = centerNear;
        const centerWeight = select(centerNear, 1, 0);
        colorAccum.assign(centerColor.mul(centerWeight));
        weightAccum.assign(centerWeight);
        Loop({ start: int(0), end: int(APERTURE_GATHER_CASES.maxApertureSamples) }, ({ i }) => {
          const index = float(i);
          const radial = sqrt(index.add(0.5).div(activeSamples));
          const angle = index.add(0.5).mul(GOLDEN_ANGLE);
          const disk = radial.mul(vec2(cos(angle), sin(angle)));
          const proposalOffsetPx = disk.mul(maximumRadiusPx);
          const sampleUv = clamp(
            sourceUv.add(vec2(proposalOffsetPx.x.div(WIDTH), proposalOffsetPx.y.div(HEIGHT))),
            vec2(0),
            vec2(1),
          );
          const samplePhysical = physicalAt(sampleUv);
          const sampleDepth = depthAt(sampleUv);
          const sampleDistance = distanceMmAt(sampleUv, sampleDepth);
          const sampleCoc = samplePhysical.r;
          const sampleValid = validCodeAt(sampleUv).and(sampleDepth.lessThan(1));
          const sampleAxes = axesToPixels(samplePhysical);
          const member = footprintWeight(proposalOffsetPx, sampleAxes.major, sampleAxes.minor, sampleAxes.scale);
          const behindNearCenter = centerNear.not().or(
            sampleDistance.lessThanEqual(centerDistance.add(depthToleranceAt(centerDistance))),
          );
          const accepted = sampleValid
            .and(sampleCoc.lessThan(-0.00001))
            .and(member.greaterThan(0))
            .and(behindNearCenter)
            .and(index.lessThan(sampleCount));
          const weight = select(accepted, member, 0);
          colorAccum.addAssign(colorAt(sampleUv).mul(weight));
          weightAccum.addAssign(weight);
          const area = abs(determinant(sampleAxes.major, sampleAxes.minor, sampleAxes.scale));
          const areaRatio = clamp(area.div(max(maximumRadiusPx.mul(maximumRadiusPx), 1e-6)), 0, 1);
          const areaFloor = float(1).div(activeSamples);
          const compensation = min(activeSamples, float(1).div(max(areaRatio, areaFloor)));
          coverageMass.addAssign(weight.mul(compensation));
        });
        const nearColor = select(weightAccum.greaterThan(1e-6), colorAccum.div(max(weightAccum, 1e-6)), vec3(0));
        const estimatedCoverage = float(1).sub(exp(coverageMass.div(activeSamples).mul(-1)));
        const coverage = select(centerForeground, 1, clamp(estimatedCoverage, 0, 1));
        return vec4(nearColor, coverage);
      })();
      const material = new MeshBasicNodeMaterial({ toneMapped: false });
      material.outputNode = node;
      return material;
    };
    const farMaterial = createGatherMaterial("far");
    const nearMaterial = createGatherMaterial("near");
    register(`${evidence.instanceId}:far-gather-material`, "native-tsl-far-gather-material", () => farMaterial.dispose());
    register(`${evidence.instanceId}:near-gather-material`, "native-tsl-near-gather-material", () => nearMaterial.dispose());
    const farScene = new THREE.Scene();
    const nearScene = new THREE.Scene();
    farScene.add(new THREE.Mesh(postGeometry, farMaterial));
    nearScene.add(new THREE.Mesh(postGeometry, nearMaterial));

    const farTarget = makeTarget(WIDTH, HEIGHT, {});
    const nearTarget = makeTarget(WIDTH, HEIGHT, {});
    const compositeTarget = makeTarget(WIDTH, HEIGHT, {});
    register(`${evidence.instanceId}:far-gather-target`, "rgba16float-far-gather-target", () => farTarget.dispose());
    register(`${evidence.instanceId}:near-gather-target`, "rgba16float-near-gather-and-coverage-target", () => nearTarget.dispose());
    register(`${evidence.instanceId}:composite-target`, "rgba16float-research-composite-target", () => compositeTarget.dispose());

    const compositeNode = Fn(() => {
      const sourceUv = textureUvTop;
      const farColor = texture(farTarget.texture, sourceUv).rgb;
      const nearValue = texture(nearTarget.texture, sourceUv);
      const alpha = clamp(nearValue.a, 0, 1);
      return vec4(farColor.mul(float(1).sub(alpha)).add(nearValue.rgb.mul(alpha)), 1);
    })();
    const compositeMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    compositeMaterial.outputNode = compositeNode;
    register(`${evidence.instanceId}:composite-material`, "native-tsl-near-far-composite-material", () => compositeMaterial.dispose());
    const compositeScene = new THREE.Scene();
    compositeScene.add(new THREE.Mesh(postGeometry, compositeMaterial));
    const displayMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
    displayMaterial.colorNode = texture(compositeTarget.texture, vec2(uv().x, uv().y.oneMinus()));
    register(`${evidence.instanceId}:display-material`, "native-tsl-diagnostic-display-material", () => displayMaterial.dispose());
    const displayScene = new THREE.Scene();
    displayScene.add(new THREE.Mesh(postGeometry, displayMaterial));

    const backend = renderer.backend as unknown as {
      device?: GPUDevice;
      get?: (resource: unknown) => unknown;
    };
    const resourceFormat = (value: THREE.Texture) => {
      const backendResource = backend.get?.(value) as {
        texture?: { format?: string };
        textureDescriptorGPU?: { format?: string };
      } | undefined;
      return backendResource?.texture?.format ?? backendResource?.textureDescriptorGPU?.format ?? null;
    };
    const recordPass = (id: string, error: unknown = null) => {
      evidence.passes.push({ id, state: error ? "failed" : "completed", error: error ? errorMessage(error) : null });
      signal();
    };
    const renderScene = () => {
      renderer.setRenderTarget(sourceTarget);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
    };
    const renderPhysical = () => {
      renderer.setRenderTarget(cocTarget);
      renderer.setClearColor(0x000000, 0);
      renderer.clear(true, false, false);
      renderer.render(physicalScene, postCamera);
      renderer.setRenderTarget(validityTarget);
      renderer.clear(true, false, false);
      renderer.render(validityScene, postCamera);
      renderer.setRenderTarget(worldTarget);
      renderer.clear(true, false, false);
      renderer.render(worldScene, postCamera);
    };
    const qualitySettings = (mode: QualityMode) => {
      const profile = getRenderQualitySettings(mode === "low" ? "low" : "standard");
      return {
        gatherScale: mode === "stress-64" ? 1 : profile.gatherScale,
        sampleCount: mode === "stress-64" ? APERTURE_GATHER_CASES.maxApertureSamples : profile.sampleCount,
        maximumCoCRadiusPx: Math.min(profile.maximumCoCRadiusPx, 12),
      };
    };
    let currentApertureFNumber: number = APERTURE_GATHER_CASES.apertureFNumber;
    let currentFilmTiltDeg = 0;
    let currentCrop = false;
    let currentFocusOffsetMm = 0;
    const render = (input: {
      operationKind: OperationEvidence["kind"];
      quality?: QualityMode;
      apertureFNumber?: number;
      filmTiltDeg?: number;
      focusOffsetMm?: number;
      crop?: boolean;
      forceUnresolved?: boolean;
      holdReadback?: boolean;
      failureStage?: FailureStage;
    } = { operationKind: "render" }) => {
      if (retired) throw new Error(`Cannot queue work on retired renderer ${evidence.instanceId}`);
      const operation: OperationEvidence = {
        operationId: `${evidence.instanceId}:op-${evidence.operations.length + 1}`,
        kind: input.operationKind,
        state: "accepted",
        stage: "operation-accepted",
        acceptedAt: performance.now(),
        completedAt: null,
        resultPublished: false,
        readbackStarted: false,
        readbackOutcome: "not-started",
        error: null,
      };
      evidence.operations.push(operation);
      signal();
      const execute = async () => {
        if (retired) {
          operation.state = "retired";
          operation.stage = "retired-before-execution";
          operation.completedAt = performance.now();
          signal();
          return;
        }
        operation.state = "running";
        operation.stage = "scene-color-depth";
        signal();
        try {
          evidence.passes = [];
          const settings = qualitySettings(input.quality ?? "standard");
          if (input.apertureFNumber !== undefined) currentApertureFNumber = input.apertureFNumber;
          if (input.filmTiltDeg !== undefined) currentFilmTiltDeg = input.filmTiltDeg;
          if (input.focusOffsetMm !== undefined) currentFocusOffsetMm = input.focusOffsetMm;
          if (input.crop !== undefined) currentCrop = input.crop;
          const crop = currentCrop;
          camera.clearViewOffset();
          if (crop) camera.setViewOffset(WIDTH, HEIGHT, 40, 22, WIDTH / 4, HEIGHT / 4);
          camera.coordinateSystem = renderer.coordinateSystem;
          camera.updateProjectionMatrix();
          camera.updateMatrixWorld(true);
          physicalProjectionInverse.value.copy(camera.projectionMatrixInverse);
          physicalCameraWorld.value.copy(camera.matrixWorld);
          projectionInverse.value.copy(camera.projectionMatrixInverse);
          sampledFilmWidthMm.value = crop ? APERTURE_GATHER_CASES.fullFilmWidthMm / 4 : APERTURE_GATHER_CASES.fullFilmWidthMm;
          sampledFilmHeightMm.value = crop ? APERTURE_GATHER_CASES.fullFilmHeightMm / 4 : APERTURE_GATHER_CASES.fullFilmHeightMm;
          apertureFNumber.value = currentApertureFNumber;
          filmPointMm.value.set(
            APERTURE_GATHER_CASES.filmPointMm[0],
            APERTURE_GATHER_CASES.filmPointMm[1],
            APERTURE_GATHER_CASES.filmPointMm[2] + currentFocusOffsetMm,
          );
          forceUnresolvedMask.value = input.forceUnresolved ? 1 : 0;
          const tilt = currentFilmTiltDeg * Math.PI / 180;
          filmNormalInput.value.set(0, -Math.sin(tilt), Math.cos(tilt));
          filmBasisXInput.value.set(1, 0, 0);
          filmBasisYInput.value.set(0, Math.cos(tilt), Math.sin(tilt));
          maximumRadiusPx.value = settings.maximumCoCRadiusPx;
          sampleCount.value = settings.sampleCount;
          renderScene();
          await backend.device?.queue.onSubmittedWorkDone();
          recordPass("scene-color-depth");
          operation.stage = "physical-coc";
          renderer.setRenderTarget(cocTarget);
          renderPhysical();
          await backend.device?.queue.onSubmittedWorkDone();
          recordPass("physical-coc-and-validity");
          failAt(input.failureStage, "physical-coc");
          operation.stage = "far-gather";
          farTarget.setSize(
            Math.max(1, Math.floor(WIDTH * settings.gatherScale)),
            Math.max(1, Math.floor(HEIGHT * settings.gatherScale)),
          );
          nearTarget.setSize(farTarget.width, farTarget.height);
          renderer.setRenderTarget(farTarget);
          renderer.setViewport(0, 0, farTarget.width, farTarget.height);
          renderer.setScissorTest(false);
          renderer.clear(true, false, false);
          renderer.render(farScene, postCamera);
          await backend.device?.queue.onSubmittedWorkDone();
          recordPass("far-gather");
          failAt(input.failureStage, "far-gather");
          operation.stage = "near-gather";
          renderer.setRenderTarget(nearTarget);
          renderer.setViewport(0, 0, nearTarget.width, nearTarget.height);
          renderer.clear(true, false, false);
          renderer.render(nearScene, postCamera);
          await backend.device?.queue.onSubmittedWorkDone();
          recordPass("near-gather");
          failAt(input.failureStage, "near-gather");
          operation.stage = "research-composite";
          compositeTarget.setSize(WIDTH, HEIGHT);
          renderer.setRenderTarget(compositeTarget);
          renderer.setViewport(0, 0, WIDTH, HEIGHT);
          renderer.clear(true, false, false);
          renderer.render(compositeScene, postCamera);
          await backend.device?.queue.onSubmittedWorkDone();
          recordPass("research-composite");
          failAt(input.failureStage, "composite");
          operation.stage = "display-pass";
          renderer.setRenderTarget(null);
          renderer.setViewport(0, 0, WIDTH, HEIGHT);
          renderer.clear(true, false, false);
          renderer.render(displayScene, postCamera);
          await backend.device?.queue.onSubmittedWorkDone();
          recordPass("display-pass");
          failAt(input.failureStage, "readback");
          operation.stage = "native-readback";
          operation.readbackStarted = true;
          operation.readbackOutcome = "pending";
          signal();
          const colorPromise = renderer.readRenderTargetPixelsAsync(sourceTarget, 0, 0, WIDTH, HEIGHT);
          const physicalPromise = renderer.readRenderTargetPixelsAsync(cocTarget, 0, 0, WIDTH, HEIGHT);
          const validityPromise = renderer.readRenderTargetPixelsAsync(validityTarget, 0, 0, WIDTH, HEIGHT);
          const farPromise = renderer.readRenderTargetPixelsAsync(farTarget, 0, 0, farTarget.width, farTarget.height);
          const nearPromise = renderer.readRenderTargetPixelsAsync(nearTarget, 0, 0, nearTarget.width, nearTarget.height);
          const compositePromise = renderer.readRenderTargetPixelsAsync(compositeTarget, 0, 0, WIDTH, HEIGHT);
          const worldPromise = renderer.readRenderTargetPixelsAsync(worldTarget, 0, 0, WIDTH, HEIGHT);
          let releaseHeld: (() => void) | null = null;
          const gate = input.holdReadback
            ? new Promise<void>((resolve) => { releaseHeld = resolve; store.releaseReadback = resolve; })
            : Promise.resolve();
          const [colorReadback, physicalReadback, validityReadback, farReadback, nearReadback, compositeReadback, worldReadback] = await Promise.all([
            Promise.all([colorPromise, gate]).then(([pixels]) => pixels),
            physicalPromise,
            validityPromise,
            farPromise,
            nearPromise,
            compositePromise,
            worldPromise,
          ]);
          if (releaseHeld && retired) {
            operation.readbackOutcome = "succeeded";
            operation.state = "retired";
            operation.stage = "stale-readback-discarded";
            operation.resultPublished = false;
            store.releaseReadback = null;
            operation.completedAt = performance.now();
            signal();
            return;
          }
          if (!(colorReadback instanceof Uint16Array)
              || !(physicalReadback instanceof Uint16Array)
              || !(validityReadback instanceof Uint8Array)
              || !(farReadback instanceof Uint16Array)
              || !(nearReadback instanceof Uint16Array)
              || !(compositeReadback instanceof Uint16Array)
              || !(worldReadback instanceof Float32Array)) {
            throw new Error("Native Phase F readback returned an unexpected typed-array representation");
          }
          operation.readbackOutcome = "succeeded";
          const red = (r: number, g: number, b: number) => r > 0.5 && g < 0.12 && b < 0.12;
          const yellow = (r: number, g: number, b: number) => r > 0.6 && g > 0.25 && b < 0.12;
          const rawRedPixelCount = countColor(colorReadback, red);
          const compositeRedPixelCount = countColor(compositeReadback, red);
          const rawYellowPixelCount = countColor(colorReadback, yellow);
          const compositeYellowPixelCount = countColor(compositeReadback, yellow);
          let validPhysicalPixelCount = 0;
          let noDepthPixelCount = 0;
          let invalidPhysicalPixelCount = 0;
          let unresolvedPixelCount = 0;
          let nearSidePixelCount = 0;
          let farSidePixelCount = 0;
          let maximumAbsSignedCoCMm = 0;
          let maximumPhysicalAxisMm = 0;
          let nonzeroNearAlphaPixels = 0;
          let farYellowSignalOutsideBluePixelCount = 0;
          let farYellowSignalOutsideBlueEnergy = 0;
          let nearRedSpreadOutsideSharpPixelCount = 0;
          let nearBlueBackgroundLeakPixelCount = 0;
          let farRedForegroundLeakPixelCount = 0;
          let farReferenceProbeIndex: number | null = null;
          let nearReferenceProbeIndex: number | null = null;
          let unresolvedSampleIndex: number | null = null;
          for (let index = 0; index < WIDTH * HEIGHT; index += 1) {
            const offset = index * 4;
            const code = validityReadback[offset] ?? 0;
            const cocMm = half(physicalReadback, offset);
            const majorMm = half(physicalReadback, offset + 1);
            const minorMm = half(physicalReadback, offset + 2);
            if (code === 1) {
              validPhysicalPixelCount += 1;
              if (cocMm < -0.00001) nearSidePixelCount += 1;
              if (cocMm > 0.00001) farSidePixelCount += 1;
              maximumAbsSignedCoCMm = Math.max(maximumAbsSignedCoCMm, Math.abs(cocMm));
              maximumPhysicalAxisMm = Math.max(maximumPhysicalAxisMm, majorMm, minorMm);
            } else if (code === 0) noDepthPixelCount += 1;
            else if (code === 4) {
              unresolvedPixelCount += 1;
              unresolvedSampleIndex ??= index;
            }
            else invalidPhysicalPixelCount += 1;
            const sourceX = index % WIDTH;
            const sourceY = Math.floor(index / WIDTH);
            const gatherXFar = Math.min(farTarget.width - 1, Math.floor((sourceX + 0.5) * farTarget.width / WIDTH));
            const gatherYFar = Math.min(farTarget.height - 1, Math.floor((sourceY + 0.5) * farTarget.height / HEIGHT));
            const farOffset = (gatherYFar * farTarget.width + gatherXFar) * 4;
            const sourceR = half(colorReadback, offset);
            const sourceG = half(colorReadback, offset + 1);
            const sourceB = half(colorReadback, offset + 2);
            const farR = half(farReadback, farOffset);
            const farG = half(farReadback, farOffset + 1);
            const farB = half(farReadback, farOffset + 2);
            const sourceIsBlue = sourceB > 0.5 && sourceR < 0.15 && sourceG < 0.2;
            const yellowSignal = Math.max(
              0,
              (farR - 0.025) * 0.925 + (farG - 0.08) * 0.54 + (farB - 0.85) * -0.825,
            );
            if (sourceIsBlue && yellowSignal > 0.02) {
              farYellowSignalOutsideBluePixelCount += 1;
              farYellowSignalOutsideBlueEnergy += yellowSignal;
              farReferenceProbeIndex ??= index;
            }
            const gatherXNear = Math.min(nearTarget.width - 1, Math.floor((sourceX + 0.5) * nearTarget.width / WIDTH));
            const gatherYNear = Math.min(nearTarget.height - 1, Math.floor((sourceY + 0.5) * nearTarget.height / HEIGHT));
            const nearOffset = (gatherYNear * nearTarget.width + gatherXNear) * 4;
            const nearR = half(nearReadback, nearOffset);
            const nearG = half(nearReadback, nearOffset + 1);
            const nearB = half(nearReadback, nearOffset + 2);
            const nearA = half(nearReadback, nearOffset + 3);
            if (sourceIsBlue && red(farR, farG, farB)) farRedForegroundLeakPixelCount += 1;
            if (sourceIsBlue && nearA > 0.02 && nearB > 0.5 && nearR < 0.15 && nearG < 0.2) {
              nearBlueBackgroundLeakPixelCount += 1;
            }
            if (!red(sourceR, sourceG, sourceB)
                && nearA > 0.02
                && red(nearR, nearG, nearB)) {
              nearRedSpreadOutsideSharpPixelCount += 1;
              nearReferenceProbeIndex ??= index;
            }
          }
          for (let offset = 3; offset < nearReadback.length; offset += 4) {
            if (half(nearReadback, offset) > 0.02) nonzeroNearAlphaPixels += 1;
          }
          const quality = qualitySettings(input.quality ?? "standard");
          const centerFootprintOffset = Math.floor(HEIGHT / 2) * WIDTH * 4 + Math.floor(WIDTH / 2) * 4;
          const centerFootprint = [0, 1, 2, 3].map((channel) => half(physicalReadback, centerFootprintOffset + channel)) as [number, number, number, number];
          const physicalEllipse = mapPhysicalEllipseToSourcePixels(
            centerFootprint[1],
            centerFootprint[2],
            centerFootprint[3] * Math.PI,
            { widthMm: sampledFilmWidthMm.value, heightMm: sampledFilmHeightMm.value },
            { widthPx: WIDTH, heightPx: HEIGHT },
          );
          const major = physicalEllipse.major;
          const minor = physicalEllipse.minor;
          const extent = Math.max(Math.hypot(...major), Math.hypot(...minor));
          const clampScale = extent > 0 ? Math.min(1, quality.maximumCoCRadiusPx / extent) : 1;
          const firstDisk = goldenAngleDiskSample(0, quality.sampleCount);
          evidence.sampleDiagnostics = {
            majorAxisPx: [...major],
            minorAxisPx: [...minor],
            clampedMajorAxisPx: [major[0] * clampScale, major[1] * clampScale],
            clampedMinorAxisPx: [minor[0] * clampScale, minor[1] * clampScale],
            clampScale,
            firstGoldenDiskSample: [...firstDisk],
            firstFarSampleOffsetPx: [
              (major[0] * firstDisk[0] + minor[0] * firstDisk[1]) * clampScale,
              (major[1] * firstDisk[0] + minor[1] * firstDisk[1]) * clampScale,
            ],
            sampleCount: quality.sampleCount,
            maximumCoCRadiusPx: quality.maximumCoCRadiusPx,
          };
          evidence.dimensions = {
            sourceWidthPx: WIDTH,
            sourceHeightPx: HEIGHT,
            physicalCocWidthPx: WIDTH,
            physicalCocHeightPx: HEIGHT,
            farGatherWidthPx: farTarget.width,
            farGatherHeightPx: farTarget.height,
            nearGatherWidthPx: nearTarget.width,
            nearGatherHeightPx: nearTarget.height,
            compositeWidthPx: WIDTH,
            compositeHeightPx: HEIGHT,
            sampledFilmWidthMm: sampledFilmWidthMm.value,
            sampledFilmHeightMm: sampledFilmHeightMm.value,
            focusOffsetMm: currentFocusOffsetMm,
            quality: input.quality ?? "standard",
            sampleCount: quality.sampleCount,
            maximumCoCRadiusPx: quality.maximumCoCRadiusPx,
          };
          evidence.metrics = {
            rawRedPixelCount,
            compositeRedPixelCount,
            nearSpreadPixelGain: compositeRedPixelCount - rawRedPixelCount,
            rawYellowPixelCount,
            compositeYellowPixelCount,
            farSpreadPixelGain: compositeYellowPixelCount - rawYellowPixelCount,
            farYellowSignalOutsideBluePixelCount,
            farYellowSignalOutsideBlueEnergy,
            nearRedSpreadOutsideSharpPixelCount,
            nearBlueBackgroundLeakPixelCount,
            farRedForegroundLeakPixelCount,
            nonzeroNearAlphaPixels,
            validPhysicalPixelCount,
            noDepthPixelCount,
            invalidPhysicalPixelCount,
            unresolvedPixelCount,
            nearSidePixelCount,
            farSidePixelCount,
            maximumAbsSignedCoCMm,
            maximumPhysicalAxisMm,
          };
          const objectDefinitions = [
            { id: "near-red-foreground", worldPointM: [-0.075, -0.005, 0.32] as [number, number, number] },
            { id: "focused-green-target", worldPointM: [0.11, 0.015, 0.5] as [number, number, number] },
            { id: "far-yellow-feature", worldPointM: [0.07, 0.075, 0.7499] as [number, number, number] },
          ];
          evidence.pointProbes = objectDefinitions.map((definition) => {
            const ndc = new THREE.Vector3(...definition.worldPointM).project(camera);
            const x = Math.max(0, Math.min(WIDTH - 1, Math.floor((ndc.x + 1) * 0.5 * WIDTH)));
            const y = Math.max(0, Math.min(HEIGHT - 1, Math.floor((1 - ndc.y) * 0.5 * HEIGHT)));
            const read = (readbackY: number) => {
              const index = readbackY * WIDTH + x;
              const offset = index * 4;
              const gatherX = Math.min(farTarget.width - 1, Math.floor((x + 0.5) * farTarget.width / WIDTH));
              const gatherY = Math.min(farTarget.height - 1, Math.floor((readbackY + 0.5) * farTarget.height / HEIGHT));
              const gatherOffset = (gatherY * farTarget.width + gatherX) * 4;
              return {
                gpuDepth: worldReadback[offset + 3]!,
                worldPositionMm: [worldReadback[offset]!, worldReadback[offset + 1]!, worldReadback[offset + 2]!] as [number, number, number],
                physicalRgba16Float: [0, 1, 2, 3].map((channel) => half(physicalReadback, offset + channel)) as [number, number, number, number],
                sourceColor: [0, 1, 2].map((channel) => half(colorReadback, offset + channel)) as [number, number, number],
                farGatherRgba: [0, 1, 2, 3].map((channel) => half(farReadback, gatherOffset + channel)) as [number, number, number, number],
                nearGatherRgba: [0, 1, 2, 3].map((channel) => half(nearReadback, gatherOffset + channel)) as [number, number, number, number],
                compositeColor: [0, 1, 2].map((channel) => half(compositeReadback, offset + channel)) as [number, number, number],
                validityCode: validityReadback[offset]!,
              };
            };
            const top = read(y);
            const bottom = read(HEIGHT - 1 - y);
            const expectedPointMm = new THREE.Vector3(...definition.worldPointM).multiplyScalar(1000);
            const topErrorMm = new THREE.Vector3(...top.worldPositionMm).distanceTo(expectedPointMm);
            const bottomErrorMm = new THREE.Vector3(...bottom.worldPositionMm).distanceTo(expectedPointMm);
            const selected = topErrorMm <= bottomErrorMm
              ? { value: top, row: y, origin: "top" as const, errorMm: topErrorMm }
              : { value: bottom, row: HEIGHT - 1 - y, origin: "bottom" as const, errorMm: bottomErrorMm };
            return {
              id: definition.id,
              worldPointM: definition.worldPointM,
              pixelTopOrigin: { x, y },
              pixelReadbackOrigin: selected.origin,
              worldPositionErrorMm: selected.errorMm,
              ...selected.value,
            };
          });
          const patchRadius = Math.ceil(settings.maximumCoCRadiusPx) + 2;
          const readbackOrigin = evidence.pointProbes[0]?.pixelReadbackOrigin ?? "bottom";
          const buildGatherReferenceProbe = (
            layer: "far" | "near",
            readbackIndex: number | null,
          ): GatherReferenceProbe | null => {
            if (readbackIndex === null || farTarget.width !== WIDTH || nearTarget.width !== WIDTH) return null;
            const readbackY = Math.floor(readbackIndex / WIDTH);
            const x = readbackIndex % WIDTH;
            const y = readbackOrigin === "top" ? readbackY : HEIGHT - 1 - readbackY;
            const left = Math.max(0, x - patchRadius);
            const top = Math.max(0, y - patchRadius);
            const right = Math.min(WIDTH - 1, x + patchRadius);
            const bottom = Math.min(HEIGHT - 1, y + patchRadius);
            const patchWidth = right - left + 1;
            const patchHeight = bottom - top + 1;
            const colors: Array<[number, number, number]> = [];
            const physical: Array<[number, number, number, number]> = [];
            const validity: number[] = [];
            const worldAndDepth: Array<[number, number, number, number]> = [];
            for (let patchY = top; patchY <= bottom; patchY += 1) {
              const sourceReadbackY = readbackOrigin === "top" ? patchY : HEIGHT - 1 - patchY;
              for (let patchX = left; patchX <= right; patchX += 1) {
                const index = sourceReadbackY * WIDTH + patchX;
                const offset = index * 4;
                colors.push([
                  half(colorReadback, offset),
                  half(colorReadback, offset + 1),
                  half(colorReadback, offset + 2),
                ]);
                physical.push([
                  half(physicalReadback, offset),
                  half(physicalReadback, offset + 1),
                  half(physicalReadback, offset + 2),
                  half(physicalReadback, offset + 3),
                ]);
                validity.push(validityReadback[offset] ?? 0);
                worldAndDepth.push([
                  worldReadback[offset] ?? 0,
                  worldReadback[offset + 1] ?? 0,
                  worldReadback[offset + 2] ?? 0,
                  worldReadback[offset + 3] ?? 1,
                ]);
              }
            }
            const output = layer === "far" ? farReadback : nearReadback;
            const outputY = readbackOrigin === "top" ? y : HEIGHT - 1 - y;
            const outputOffset = (outputY * WIDTH + x) * 4;
            return {
              layer,
              x,
              y,
              source: { widthPx: WIDTH, heightPx: HEIGHT },
              film: { widthMm: sampledFilmWidthMm.value, heightMm: sampledFilmHeightMm.value },
              sampleCount: settings.sampleCount,
              maximumCoCRadiusPx: settings.maximumCoCRadiusPx,
              cameraZMm: camera.position.z * 1000,
              patch: {
                left,
                top,
                width: patchWidth,
                height: patchHeight,
                colors,
                physical,
                validity,
                worldAndDepth,
              },
              actualRgba: [0, 1, 2, 3].map((channel) => half(output, outputOffset + channel)) as [number, number, number, number],
            };
          };
          evidence.gatherReferenceProbes = [
            buildGatherReferenceProbe("far", farReferenceProbeIndex),
            buildGatherReferenceProbe("near", nearReferenceProbeIndex),
          ].filter((probe): probe is GatherReferenceProbe => probe !== null);
          if (unresolvedSampleIndex !== null) {
            const offset = unresolvedSampleIndex * 4;
            const readbackY = Math.floor(unresolvedSampleIndex / WIDTH);
            const x = unresolvedSampleIndex % WIDTH;
            const farX = Math.min(farTarget.width - 1, Math.floor((x + 0.5) * farTarget.width / WIDTH));
            const farY = Math.min(farTarget.height - 1, Math.floor((readbackY + 0.5) * farTarget.height / HEIGHT));
            const nearX = Math.min(nearTarget.width - 1, Math.floor((x + 0.5) * nearTarget.width / WIDTH));
            const nearY = Math.min(nearTarget.height - 1, Math.floor((readbackY + 0.5) * nearTarget.height / HEIGHT));
            const farOffset = (farY * farTarget.width + farX) * 4;
            const nearOffset = (nearY * nearTarget.width + nearX) * 4;
            evidence.unresolvedSample = {
              validityCode: validityReadback[offset] ?? 0,
              storedFootprint: [0, 1, 2, 3].map((channel) => half(physicalReadback, offset + channel)) as [number, number, number, number],
              sourceColor: [0, 1, 2].map((channel) => half(colorReadback, offset + channel)) as [number, number, number],
              farGather: [0, 1, 2, 3].map((channel) => half(farReadback, farOffset + channel)) as [number, number, number, number],
              nearGather: [0, 1, 2, 3].map((channel) => half(nearReadback, nearOffset + channel)) as [number, number, number, number],
            };
          } else evidence.unresolvedSample = null;
          evidence.formats = {
            sceneColor: { requested: "rgba16float", actual: resourceFormat(sourceTarget.texture) },
            sceneDepth: { requested: "DepthFormat/UnsignedIntType", actual: sourceTarget.depthTexture ? resourceFormat(sourceTarget.depthTexture) : null },
            physicalCoC: { requested: "rgba16float; R signed CoC mm, G/B ellipse radii mm, A orientation over pi", actual: resourceFormat(cocTarget.texture) },
            validity: { requested: "rgba8unorm; 0 no depth, 1 valid, 2 unrepresentable, 3 invalid, 4 unresolved", actual: resourceFormat(validityTarget.texture) },
            farGather: { requested: "rgba16float; linear color", actual: resourceFormat(farTarget.texture) },
            nearGather: { requested: "rgba16float; linear RGB and coverage alpha", actual: resourceFormat(nearTarget.texture) },
            composite: { requested: "rgba16float; linear research composite", actual: resourceFormat(compositeTarget.texture) },
          };
          operation.stage = "readback-published";
          operation.resultPublished = true;
          operation.state = "completed";
          operation.completedAt = performance.now();
          signal();
        } catch (error) {
          operation.state = "failed";
          operation.stage = operation.stage.includes("readback") ? "readback-failed" : `${operation.stage}-failed`;
          operation.error = errorMessage(error);
          evidence.error = operation.error;
          if (operation.readbackStarted) operation.readbackOutcome = "failed";
          operation.completedAt = performance.now();
          signal();
        }
      };
      const task = operationChain.then(execute, execute);
      operationChain = task.then(() => undefined, () => undefined);
      pendingOperations.add(task);
      void task.finally(() => pendingOperations.delete(task));
      return operation.operationId;
    };

    const dispose = async () => {
      if (disposePromise) return disposePromise;
      retired = true;
      evidence.state = "retiring";
      evidence.resources.forEach((resource) => { if (resource.state === "active") resource.state = "disposal-requested"; });
      signal();
      disposePromise = (async () => {
        await Promise.allSettled([...pendingOperations]);
        for (let index = owned.length - 1; index >= 0; index -= 1) {
          const resource = evidence.resources.find((entry) => entry.id === owned[index]!.id);
          try {
            await owned[index]!.dispose();
            if (resource) resource.state = "disposed";
          } catch (error) {
            if (resource) {
              resource.state = "failed";
              resource.error = errorMessage(error);
            }
            evidence.cleanupError ??= errorMessage(error);
          }
        }
        evidence.state = evidence.resources.every((resource) => resource.state === "disposed") ? "disposed" : "failed";
        evidence.cleanupCompletedAt = performance.now();
        store.activeHandleId = null;
        signal();
      })();
      return disposePromise;
    };

    const startHeldReadback = () => render({ operationKind: "held-readback", holdReadback: true });
    const injectFailure = async (stage: FailureStage) => {
      const operationId = render({ operationKind: "injected-failure", failureStage: stage });
      await operationChain;
      await dispose();
      return operationId;
    };
    const handle: MountedHandle = {
      evidence,
      render: (input) => {
        const operationId = render({ operationKind: evidence.operations.length === 0 ? "initial-render" : "render", ...input });
        return operationChain.then(() => operationId);
      },
      startHeldReadback,
      injectFailure,
      dispose,
    };
    evidence.runtime = {
      ...resolveObserverRendererRuntime(renderer),
      applicationFallback: false,
      initialized: true,
      threeRevision: THREE.REVISION,
    };
    evidence.state = "active";
    store.activeHandleId = evidence.instanceId;
    store.status = "initialized";
    signal();
    await handle.render({ quality: "standard" });
    return handle;
  } catch (error) {
    evidence.state = "failed";
    evidence.error = errorMessage(error);
    for (let index = owned.length - 1; index >= 0; index -= 1) {
      const resource = evidence.resources.find((entry) => entry.id === owned[index]!.id);
      try {
        await owned[index]!.dispose();
        if (resource) resource.state = "disposed";
      } catch (cleanupError) {
        if (resource) {
          resource.state = "failed";
          resource.error = errorMessage(cleanupError);
        }
        evidence.cleanupError ??= errorMessage(cleanupError);
      }
    }
    store.status = "failed";
    signal();
    throw error;
  }
};

const Experiment = () => {
  const diagnosticsVersion = useDiagnosticsVersion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<MountedHandle | null>(null);
  const [handle, setHandle] = useState<MountedHandle | null>(null);
  const [status, setStatus] = useState("initializing native renderer");
  useEffect(() => {
    let cancelled = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void buildHandle(canvas).then((mounted) => {
      if (cancelled) {
        void mounted.dispose();
        return;
      }
      handleRef.current = mounted;
      setHandle(mounted);
      setStatus("ready");
    }).catch((error: unknown) => {
      setStatus(`failed: ${errorMessage(error)}`);
    });
    return () => {
      cancelled = true;
      const mounted = handleRef.current;
      handleRef.current = null;
      if (mounted) void mounted.dispose();
    };
  }, []);
  const queueRender = async (input: Parameters<MountedHandle["render"]>[0]) => {
    if (!handle) return;
    setStatus("render queued");
    await handle.render(input);
    setStatus(handle.evidence.operations.at(-1)?.state ?? "render complete");
  };
  return (
    <main>
      <h1>Native WebGPU physical aperture gather</h1>
      <p data-testid="fixture-status">{status}</p>
      <p>
        <Link to="/away">Navigate away (SPA)</Link>
      </p>
      <div className="fixture-layout">
        <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Native WebGPU aperture gather composite" />
        <section aria-label="Phase F controls">
          <button type="button" onClick={() => void queueRender({ quality: "standard" })}>Standard gather</button>
          <button type="button" onClick={() => void queueRender({ quality: "low" })}>Low resolution gather</button>
          <button type="button" onClick={() => void queueRender({ quality: "stress-64" })}>64 sample gather</button>
          <button type="button" onClick={() => void queueRender({ apertureFNumber: 2 })}>Aperture f/2</button>
          <button type="button" onClick={() => void queueRender({ apertureFNumber: 1 })}>Aperture f/1</button>
          <button type="button" onClick={() => void queueRender({ filmTiltDeg: 12 })}>Tilt film 12 degrees</button>
          <button type="button" onClick={() => void queueRender({ filmTiltDeg: 0 })}>Until film</button>
          <button type="button" onClick={() => void queueRender({ focusOffsetMm: 1 })}>Shift focus plane +1mm</button>
          <button type="button" onClick={() => void queueRender({ focusOffsetMm: 0 })}>Reset focus plane</button>
          <button type="button" onClick={() => void queueRender({ crop: true })}>Off-center 4x crop</button>
          <button type="button" onClick={() => void queueRender({ crop: false })}>Full film</button>
          <button type="button" onClick={() => void queueRender({ forceUnresolved: true })}>Force unresolved diagnostic</button>
          <button type="button" onClick={() => void queueRender({ forceUnresolved: false })}>Clear unresolved diagnostic</button>
          <button type="button" onClick={() => { if (handle) { store.releaseReadback = null; handle.startHeldReadback(); } }}>Start held native readback</button>
          <button type="button" onClick={() => void handle?.injectFailure("physical-coc")}>Fail after physical CoC</button>
          <button type="button" onClick={() => void handle?.injectFailure("far-gather")}>Fail after far gather</button>
          <button type="button" onClick={() => void handle?.injectFailure("near-gather")}>Fail after near gather</button>
          <button type="button" onClick={() => void handle?.injectFailure("composite")}>Fail after composite</button>
          <button type="button" onClick={() => void handle?.injectFailure("readback")}>Fail before readback</button>
        </section>
      </div>
      <pre data-testid="fixture-diagnostics" data-version={diagnosticsVersion}>{JSON.stringify({
        status: store.status,
        activeHandleId: store.activeHandleId,
        handles: store.handles,
      })}</pre>
    </main>
  );
};

const Away = () => {
  const diagnosticsVersion = useDiagnosticsVersion();
  return (
    <main>
      <h1>Phase F lifecycle diagnostics</h1>
      <p data-testid="away-route">GPU renderer host is unmounted on this route.</p>
      <Link to="/experiment">Return to experiment (SPA)</Link>
      <button type="button" onClick={() => store.releaseReadback?.()}>Release held readback</button>
      <pre data-testid="fixture-diagnostics" data-version={diagnosticsVersion}>{JSON.stringify({
        status: store.status,
        activeHandleId: store.activeHandleId,
        handles: store.handles,
      })}</pre>
    </main>
  );
};

const App = () => (
  <HashRouter>
    <Routes>
      <Route path="/experiment" element={<Experiment />} />
      <Route path="/away" element={<Away />} />
      <Route path="*" element={<Navigate to="/experiment" replace />} />
    </Routes>
  </HashRouter>
);

const style = document.createElement("style");
style.textContent = `
  :root { color-scheme: light; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 20px; color: #172033; background: #f4f6fa; }
  main { max-width: 1100px; margin: 0 auto; }
  .fixture-layout { display: grid; grid-template-columns: minmax(480px, 640px) 1fr; gap: 20px; align-items: start; }
  canvas { width: 640px; height: 480px; border: 1px solid #35425e; background: #000; image-rendering: pixelated; }
  section { display: grid; gap: 8px; }
  button, a { min-height: 36px; padding: 8px 12px; }
  pre { overflow: auto; max-height: 320px; background: #fff; padding: 12px; font-size: 11px; }
  @media (max-width: 800px) { .fixture-layout { grid-template-columns: 1fr; } canvas { width: min(100%, 640px); height: auto; } }
`;
document.head.append(style);
createRoot(document.getElementById("ground-glass-webgpu-aperture-gather")!).render(<App />);
