/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import * as THREE from "three";
import { MeshBasicNodeMaterial, WebGPURenderer } from "three/webgpu";
import {
  abs,
  atan,
  cross,
  dot,
  floor,
  float,
  fract,
  getViewPosition,
  int,
  length,
  max,
  select,
  sqrt,
  texture,
  uniform,
  uniformArray,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { resolveObserverRendererRuntime } from "../../../render/backend/observerVisualPipelineCapabilities";
import { resolveSampledFilmDimensionsMm } from "../../../render/groundGlassInspectionWindow";
import { DEPTH_PROBE_CASES, PHYSICAL_CLASSIFICATION_CASES, type PhysicalClassificationCase } from "./ground-glass-webgpu-physical-coc-cases";

const WIDTH = 320;
const HEIGHT = 240;
const FULL_FILM_WIDTH_MM = 36;
const FULL_FILM_HEIGHT_MM = 24;
const DEPTH_PROBE_COUNT = DEPTH_PROBE_CASES.length;
const CHANGE_EVENT = "ground-glass-webgpu-physical-coc-change";

type ProbeResult = {
  id: string;
  pixel: { x: number; y: number };
  uvTopOrigin: [number, number];
  expectedSurfaceId: string;
  actualSurfaceId: string | null;
  occludedSurfaceIds: string[];
  gpuDepth: number;
  reconstructedWorldM: [number, number, number];
  expectedWorldM: [number, number, number] | null;
  absoluteErrorM: [number, number, number] | null;
  errorMagnitudeM: number | null;
  valid: boolean;
};

type LifecycleOperationEvidence = {
  operationId: string;
  kind: "held-readback" | "post-depth-failure" | "post-physical-failure";
  state: "accepted" | "running" | "completed" | "failed" | "retired";
  stage: string;
  failureClassification: "readback" | "execution" | "test-injected-readback" | null;
  readbackStarted: boolean;
  readbackOutcome: "not-started" | "pending" | "succeeded" | "failed";
  resultPublished: boolean;
  error: string | null;
};

type CropEvidence = {
  sourceProbeId: string;
  cropViewOffsetPx: { fullWidth: number; fullHeight: number; x: number; y: number; width: number; height: number };
  cropOutputSizePx: { width: number; height: number };
  actualDepthGpuFormat: string | null;
  fullFilmUv: [number, number];
  cropFilmUv: [number, number];
  cropPixel: { x: number; y: number };
  expectedSurfaceId: string;
  actualSurfaceId: string | null;
  gpuDepth: number;
  expectedWorldMm: [number, number, number] | null;
  reconstructedWorldMm: [number, number, number];
  worldErrorMm: number | null;
  fullPhysicalRgba16Float: [number, number, number, number];
  cropPhysicalRgba16Float: [number, number, number, number];
  sampledFilmDimensionsMm: { full: { widthMm: number; heightMm: number }; crop: { widthMm: number; heightMm: number } };
  physicalCoCDifferenceMm: number;
  validityCode: number;
  cameraProjectionMatrix: number[];
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
  } | null;
  depth: {
    requestedFormat: string;
    requestedType: string;
    actualGpuFormat: string | null;
    width: number;
    height: number;
    sampleCount: number;
    clearDepth: number;
  } | null;
  camera: {
    positionWorldM: [number, number, number];
    near: number;
    far: number;
    coordinateSystem: number;
    projectionMatrix: number[];
    projectionMatrixInverse: number[];
    worldMatrix: number[];
    offAxisViewOffsetPx: { x: number; y: number };
  } | null;
  probes: ProbeResult[];
  crop: CropEvidence | null;
  operations: LifecycleOperationEvidence[];
  physical: {
    requestedFormat: string;
    actualGpuFormat: string | null;
    validityFormat: string;
    actualValidityGpuFormat: string | null;
    samples: Array<{
      id: string;
      sourceProbeId: string;
      input: ResolvedPhysicalCase;
      gpuDepth: number;
      reconstructedWorldMm: [number, number, number];
      storedRgba16Float: [number, number, number, number];
      validityCode: number;
      storageRepresentable: boolean;
      classification: "near" | "neutral" | "far" | "no-depth" | "invalid-geometry" | "unrepresentable";
    }>;
  } | null;
  resources: Array<{ id: string; role: string; state: "active" | "disposed" | "failed"; error: string | null }>;
  error: string | null;
};

type MountedHandle = {
  evidence: HandleEvidence;
  dispose: () => Promise<void>;
  startHeldReadback: () => string;
  injectPostDepthFailure: () => Promise<void>;
  injectPostPhysicalFailure: () => Promise<void>;
};
type FixtureStore = {
  nextGeneration: number;
  handles: HandleEvidence[];
  status: string;
  activeHandle: MountedHandle | null;
  releaseHeldReadback: ((outcome: "release" | "reject") => void) | null;
};
type WindowWithFixtureStore = Window & { __groundGlassWebGpuPhysicalCoc?: FixtureStore };
const store = (window as WindowWithFixtureStore).__groundGlassWebGpuPhysicalCoc ??= {
  nextGeneration: 1,
  handles: [],
  status: "idle",
  activeHandle: null,
  releaseHeldReadback: null,
};
const signal = () => window.dispatchEvent(new Event(CHANGE_EVENT));
const vec3Array = (value: THREE.Vector3): [number, number, number] => [value.x, value.y, value.z];
const messageOf = (error: unknown) => error instanceof Error ? error.message : String(error);

type Surface = { id: string; mesh: THREE.Mesh; geometry: THREE.BufferGeometry; material: THREE.Material };
type ResolvedPhysicalCase = Omit<PhysicalClassificationCase, "focalLengthMm"> & {
  focalLengthMm: number;
  sourceUv: [number, number];
};

const rayPlaneIntersection = (ray: THREE.Ray, surface: Surface) => {
  const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(surface.mesh.quaternion).normalize();
  const point = surface.mesh.position;
  const denominator = ray.direction.dot(normal);
  if (Math.abs(denominator) < 1e-9) return null;
  const distance = point.clone().sub(ray.origin).dot(normal) / denominator;
  if (distance <= 0) return null;
  const hit = ray.at(distance, new THREE.Vector3());
  const local = surface.mesh.worldToLocal(hit.clone());
  const attributes = surface.geometry.attributes.position;
  const x = Math.max(...Array.from({ length: attributes.count }, (_, i) => attributes.getX(i)));
  const minX = Math.min(...Array.from({ length: attributes.count }, (_, i) => attributes.getX(i)));
  const y = Math.max(...Array.from({ length: attributes.count }, (_, i) => attributes.getY(i)));
  const minY = Math.min(...Array.from({ length: attributes.count }, (_, i) => attributes.getY(i)));
  return local.x >= minX - 1e-5 && local.x <= x + 1e-5 && local.y >= minY - 1e-5 && local.y <= y + 1e-5
    ? { surfaceId: surface.id, distance, point: hit }
    : null;
};

const createSceneSurfaces = (scene: THREE.Scene): Surface[] => {
  const definitions = [
    { id: "near-front-plane", size: [0.28, 0.25] as const, position: [-0.13, 0.015, 0.32] as const, rotation: [0, 0, 0] as const, color: 0xdd5544 },
    { id: "far-front-plane", size: [0.20, 0.22] as const, position: [-0.22, 0.1, 0.55] as const, rotation: [0, 0, 0] as const, color: 0x44aa66 },
    { id: "occlusion-marker", size: [0.055, 0.055] as const, position: [-0.1, 0.1, 0.72] as const, rotation: [0, 0, 0] as const, color: 0xffff44 },
    { id: "tilted-plane", size: [0.20, 0.20] as const, position: [0.17, 0, 0.45] as const, rotation: [0.12, 0.28, 0] as const, color: 0x4477dd },
  ];
  return definitions.map((definition) => {
    const geometry = new THREE.PlaneGeometry(definition.size[0], definition.size[1]);
    const material = new THREE.MeshBasicMaterial({ color: definition.color, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = definition.id;
    mesh.position.set(definition.position[0], definition.position[1], definition.position[2]);
    mesh.rotation.set(definition.rotation[0], definition.rotation[1], definition.rotation[2]);
    mesh.updateMatrixWorld(true);
    scene.add(mesh);
    return { id: definition.id, mesh, geometry, material };
  });
};

const makeDepthAndFootprintNodes = (input: {
  depthTexture: THREE.DepthTexture;
  projectionInverse: THREE.Matrix4;
  cameraWorld: THREE.Matrix4;
  cases: readonly ResolvedPhysicalCase[];
}) => {
  const count = input.cases.length;
  const caseStride = 28;
  const physicalInput = uniformArray<"float">(input.cases.flatMap((entry) => [
    ...entry.sourceUv,
    ...entry.lensCenterMm,
    ...entry.lensPlaneNormal,
    ...entry.lensPlaneBasisX,
    ...entry.lensPlaneBasisY,
    ...entry.filmPlanePointMm,
    ...entry.filmPlaneNormal,
    ...entry.filmPlaneBasisX,
    ...entry.filmPlaneBasisY,
    entry.focalLengthMm,
    entry.apertureFNumber,
  ]), "float");
  const projectionInverse = uniform(input.projectionInverse);
  const cameraWorld = uniform(input.cameraWorld);
  const index = int(floor(uv().x.mul(count)));
  const caseBase = index.mul(caseStride);
  const scalarAt = (offset: number) => physicalInput.element(caseBase.add(offset));
  const vec3At = (offset: number) => {
    return vec3(
      scalarAt(offset),
      scalarAt(offset + 1),
      scalarAt(offset + 2),
    );
  };
  const sourceUv = vec2(scalarAt(0), scalarAt(1));
  const sampledDepth = texture(input.depthTexture, sourceUv).r;
  const viewPosition = getViewPosition(sourceUv, sampledDepth, projectionInverse);
  const worldPositionM = cameraWorld.mul(vec4(viewPosition, 1)).xyz;
  const objectPointMm = worldPositionM.mul(1000);

  const makeBasis = (normalInput: ReturnType<typeof vec3At>, primaryInput: ReturnType<typeof vec3At>, secondaryInput: ReturnType<typeof vec3At>) => {
    const normalLength = length(normalInput);
    const normal = normalInput.div(max(normalLength, 1e-7));
    const projectedPrimary = primaryInput.sub(normal.mul(dot(primaryInput, normal)));
    const projectedSecondary = secondaryInput.sub(normal.mul(dot(secondaryInput, normal)));
    const primaryLength = length(projectedPrimary);
    const projected = select(primaryLength.greaterThan(1e-7), projectedPrimary, projectedSecondary);
    const projectedLength = length(projected);
    const x = projected.div(max(projectedLength, 1e-7));
    const yUnnormalized = cross(normal, x);
    const yLength = length(yUnnormalized);
    const yCandidate = yUnnormalized.div(max(yLength, 1e-7));
    const y = select(dot(yCandidate, secondaryInput).lessThan(0), yCandidate.mul(-1), yCandidate);
    const valid = normalLength.greaterThan(1e-7)
      .and(projectedLength.greaterThan(1e-7))
      .and(yLength.greaterThan(1e-7));
    return { normal, x, y, valid };
  };

  const lens = makeBasis(vec3At(5), vec3At(8), vec3At(11));
  const film = makeBasis(vec3At(17), vec3At(20), vec3At(23));
  const lensCenterMm = vec3At(2);
  const filmPlanePointMm = vec3At(14);
  const fMm = scalarAt(26);
  const number = scalarAt(27);
  const objectDelta = objectPointMm.sub(lensCenterMm);
  const objectDistanceMm = dot(objectDelta, lens.normal);
  const lateralOffsetMm = objectDelta.sub(lens.normal.mul(objectDistanceMm));
  const focalPlaneToleranceMm = 0.002;
  const finiteImage = abs(objectDistanceMm.sub(fMm)).greaterThan(focalPlaneToleranceMm);
  const safeObjectDistance = select(abs(objectDistanceMm).greaterThan(1e-7), objectDistanceMm, 1);
  const imageDenominator = objectDistanceMm.sub(fMm);
  const safeImageDenominator = select(abs(imageDenominator).greaterThan(1e-7), imageDenominator, 1);
  const idealImageDistanceMm = fMm.mul(objectDistanceMm).div(safeImageDenominator);
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
  const centerDistance = dot(filmPlanePointMm.sub(lensCenterMm), film.normal).div(safeFilmDenominator);
  const filmDelta = filmPlanePointMm.sub(lensCenterMm);
  const apertureRadiusMm = fMm.div(number.mul(2));
  const apertureX = lens.x.mul(apertureRadiusMm);
  const apertureY = lens.y.mul(apertureRadiusMm);
  const imageVector = imagePointUsed.sub(lensCenterMm);
  const finiteDenominator = dot(imageVector, film.normal);
  const safeFiniteDenominator = select(abs(finiteDenominator).greaterThan(1e-7), finiteDenominator, 1);
  const rayParameter = dot(filmDelta, film.normal).div(safeFiniteDenominator);
  const mapFiniteOffset = (apertureOffset: typeof apertureX) => apertureOffset
    .sub(imageVector.mul(dot(apertureOffset, film.normal).div(safeFiniteDenominator)))
    .mul(float(1).sub(rayParameter));
  const mapParallelOffset = (apertureOffset: typeof apertureX) => apertureOffset
    .sub(imageDirection.mul(dot(apertureOffset, film.normal).div(safeFilmDenominator)));
  const finiteMappedX = mapFiniteOffset(apertureX).toVar();
  const parallelMappedX = mapParallelOffset(apertureX).toVar();
  const finiteMappedY = mapFiniteOffset(apertureY).toVar();
  const parallelMappedY = mapParallelOffset(apertureY).toVar();
  const mappedX = select(finiteImage, finiteMappedX, parallelMappedX);
  const mappedY = select(finiteImage, finiteMappedY, parallelMappedY);
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
  const angle = atan(covariance01.mul(2), covariance00.sub(covariance11)).mul(0.5);
  const orientationRad = select(
    majorRadiusMm.sub(minorRadiusMm).greaterThan(1e-7),
    fract(angle.div(Math.PI)).mul(Math.PI),
    0,
  );
  const imagePlaneDeltaMm = dot(imagePoint.sub(filmPlanePointMm), film.normal);
  const finiteSide = select(
    abs(imagePlaneDeltaMm).greaterThan(1e-7),
    select(imagePlaneDeltaMm.lessThan(0), -1, 1),
    0,
  );
  const signedSide = select(finiteImage, finiteSide, -1);
  const signedCoCDiameterMm = signedSide.mul(2).mul(sqrt(max(0, majorRadiusMm.mul(minorRadiusMm))));
  const depthValid = sampledDepth.lessThan(0.999999);
  const geometryValid = lens.valid
    .and(film.valid)
    .and(objectDistanceMm.greaterThan(1e-7))
    .and(fMm.greaterThan(0))
    .and(number.greaterThan(0))
    .and(length(imageDirectionInput).greaterThan(1e-7))
    .and(centerDistance.greaterThan(1e-14))
    .and(abs(filmDenominator).greaterThan(1e-7))
    .and(abs(select(finiteImage, finiteDenominator, filmDenominator)).greaterThan(1e-7));
  const physicalValid = depthValid.and(geometryValid);
  const storageRepresentable = abs(signedCoCDiameterMm).lessThanEqual(65504)
    .and(majorRadiusMm.lessThanEqual(65504))
    .and(minorRadiusMm.lessThanEqual(65504))
    .and(orientationRad.lessThanEqual(65504));
  const storeValid = physicalValid.and(storageRepresentable);
  const storedFootprint = vec4(
    select(storeValid, signedCoCDiameterMm, 0),
    select(storeValid, majorRadiusMm, 0),
    select(storeValid, minorRadiusMm, 0),
    select(storeValid, orientationRad, 0),
  );
  const validityCode = select(
    depthValid,
    select(geometryValid, select(storageRepresentable, 1, 2), 3),
    0,
  );
  return {
    sourceUv,
    worldPositionM,
    sampledDepth,
    storedFootprint,
    validityCode,
  };
};

const createDepthProbeMaterial = (input: {
  depthTexture: THREE.DepthTexture;
  projectionInverse: THREE.Matrix4;
  cameraWorld: THREE.Matrix4;
  probeUvs: Array<[number, number]>;
}) => {
  const sampleCount = input.probeUvs.length;
  const sampleU = uniformArray<"float">(input.probeUvs.map(([u]) => u), "float");
  const sampleV = uniformArray<"float">(input.probeUvs.map(([, v]) => v), "float");
  const projectionInverse = uniform(input.projectionInverse);
  const cameraWorld = uniform(input.cameraWorld);
  const index = int(floor(uv().x.mul(sampleCount)));
  const sourceUv = vec2(sampleU.element(index), sampleV.element(index));
  const depth = texture(input.depthTexture, sourceUv).r;
  const viewPosition = getViewPosition(sourceUv, depth, projectionInverse);
  const worldPosition = cameraWorld.mul(vec4(viewPosition, 1)).xyz;
  const material = new MeshBasicNodeMaterial({ toneMapped: false });
  material.outputNode = vec4(worldPosition, depth);
  return { material, sourceUv };
};

const buildHandle = async (canvas: HTMLCanvasElement): Promise<MountedHandle> => {
  const generation = store.nextGeneration++;
  const evidence: HandleEvidence = {
    instanceId: `physical-coc-g${generation}-${crypto.randomUUID()}`,
    generation,
    state: "initializing",
    runtime: null,
    depth: null,
    camera: null,
    probes: [],
    crop: null,
    operations: [],
    physical: null,
    resources: [],
    error: null,
  };
  store.handles.push(evidence);
  signal();

  const renderer = new WebGPURenderer({ canvas, antialias: false, alpha: false });
  try {
    await renderer.init();
  } catch (error) {
    renderer.dispose();
    evidence.state = "failed";
    evidence.error = messageOf(error);
    store.status = "failed";
    signal();
    throw error;
  }
  renderer.setPixelRatio(1);
  renderer.setSize(WIDTH, HEIGHT, false);
  renderer.outputColorSpace = THREE.NoColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const scene = new THREE.Scene();
  scene.background = null;
  const surfaces = createSceneSurfaces(scene);
  const camera = new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.01, 2);
  camera.position.set(0.02, 0.01, 0.95);
  camera.lookAt(0.02, 0.01, 0.39);
  camera.setViewOffset(WIDTH, HEIGHT, -13, 7, WIDTH, HEIGHT);
  camera.coordinateSystem = renderer.coordinateSystem;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  const probeSeeds = DEPTH_PROBE_CASES.map((probe) => new THREE.Vector3(...probe.pointWorldM));
  const probeUvs = probeSeeds.map((point) => {
    const ndc = point.clone().project(camera);
    const x = Math.max(0, Math.min(WIDTH - 1, Math.floor((ndc.x + 1) * 0.5 * WIDTH)));
    const y = Math.max(0, Math.min(HEIGHT - 1, Math.floor((1 - ndc.y) * 0.5 * HEIGHT)));
    return [(x + 0.5) / WIDTH, (y + 0.5) / HEIGHT] as [number, number];
  });
  const probePixels = probeUvs.map(([u, v]) => ({ x: Math.floor(u * WIDTH), y: Math.floor(v * HEIGHT) }));
  const analyticReferences = DEPTH_PROBE_CASES.map((probe, index) => {
    const [u, v] = probeUvs[index]!;
    const viewPoint = new THREE.Vector3(u * 2 - 1, 1 - v * 2, 0.5).unproject(camera);
    const ray = new THREE.Ray(camera.position.clone(), viewPoint.sub(camera.position).normalize());
    const intersections = surfaces
      .map((surface) => rayPlaneIntersection(ray, surface))
      .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
      .sort((a, b) => a.distance - b.distance);
    return { probe, hit: intersections[0] ?? null, occludedSurfaceIds: intersections.slice(1).map((entry) => entry.surfaceId) };
  });
  const cropProbeIndex = DEPTH_PROBE_CASES.findIndex((entry) => entry.id === "tilted-plane-right-edge");
  const cropReference = analyticReferences[cropProbeIndex]?.hit;
  if (!cropReference) throw new Error("The fixed off-center crop reference point is unavailable");
  const cropAnchorCamera = camera.clone() as THREE.PerspectiveCamera;
  cropAnchorCamera.clearViewOffset();
  cropAnchorCamera.coordinateSystem = renderer.coordinateSystem;
  cropAnchorCamera.updateProjectionMatrix();
  cropAnchorCamera.updateMatrixWorld(true);
  const anchorNdc = cropReference.point.clone().project(cropAnchorCamera);
  const anchorPixel = {
    x: (anchorNdc.x + 1) * 0.5 * WIDTH,
    y: (1 - anchorNdc.y) * 0.5 * HEIGHT,
  };
  const cropViewOffset = {
    fullWidth: WIDTH,
    fullHeight: HEIGHT,
    x: anchorPixel.x - (WIDTH / 2 + 0.5) * (WIDTH / 4) / WIDTH,
    y: anchorPixel.y - (HEIGHT / 2 + 0.5) * (HEIGHT / 4) / HEIGHT,
    width: WIDTH / 4,
    height: HEIGHT / 4,
  };
  const cropInspectionWindow = {
    active: true,
    centerU: (cropViewOffset.x + cropViewOffset.width / 2) / cropViewOffset.fullWidth,
    centerV: (cropViewOffset.y + cropViewOffset.height / 2) / cropViewOffset.fullHeight,
    widthFraction: cropViewOffset.width / cropViewOffset.fullWidth,
    heightFraction: cropViewOffset.height / cropViewOffset.fullHeight,
  };
  const sampledCropFilmDimensionsMm = resolveSampledFilmDimensionsMm({
    filmWidthMm: FULL_FILM_WIDTH_MM,
    filmHeightMm: FULL_FILM_HEIGHT_MM,
    inspectionWindow: cropInspectionWindow,
  });
  const probeIndexById = new Map(DEPTH_PROBE_CASES.map((probe, index) => [probe.id, index]));
  const resolvedPhysicalCases: ResolvedPhysicalCase[] = PHYSICAL_CLASSIFICATION_CASES.map((entry) => {
    const probeIndex = probeIndexById.get(entry.sourceProbeId);
    if (probeIndex === undefined) throw new Error(`Physical case references missing probe ${entry.sourceProbeId}`);
    const reference = analyticReferences[probeIndex]?.hit?.point;
    const lensNormal = new THREE.Vector3(...entry.lensPlaneNormal).normalize();
    const objectDistance = reference
      ? reference.clone().multiplyScalar(1000).sub(new THREE.Vector3(...entry.lensCenterMm)).dot(lensNormal)
      : 0;
    const focalLengthMm = entry.focalLengthMm === "object-distance" ? objectDistance : entry.focalLengthMm;
    let filmPlanePointMm = entry.filmPlanePointMm;
    if (entry.id === "in-focus" && objectDistance > focalLengthMm) {
      const imageDistanceMm = focalLengthMm * objectDistance / (objectDistance - focalLengthMm);
      const lensCenterMm = new THREE.Vector3(...entry.lensCenterMm);
      filmPlanePointMm = lensCenterMm.sub(lensNormal.multiplyScalar(imageDistanceMm)).toArray() as [number, number, number];
    }
    return {
      ...entry,
      focalLengthMm,
      filmPlanePointMm,
      sourceUv: probeUvs[probeIndex]!,
    };
  });
  const sceneTarget = new THREE.RenderTarget(WIDTH, HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  sceneTarget.texture.colorSpace = THREE.NoColorSpace;
  sceneTarget.depthTexture = new THREE.DepthTexture(WIDTH, HEIGHT, THREE.UnsignedIntType);
  sceneTarget.depthTexture.format = THREE.DepthFormat;
  sceneTarget.depthTexture.minFilter = THREE.NearestFilter;
  sceneTarget.depthTexture.magFilter = THREE.NearestFilter;
  sceneTarget.depthTexture.generateMipmaps = false;
  const diagnosticTarget = new THREE.RenderTarget(DEPTH_PROBE_COUNT, 1, {
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  diagnosticTarget.texture.colorSpace = THREE.NoColorSpace;
  diagnosticTarget.texture.minFilter = THREE.NearestFilter;
  diagnosticTarget.texture.magFilter = THREE.NearestFilter;
  diagnosticTarget.texture.generateMipmaps = false;
  const physicalTarget = new THREE.RenderTarget(PHYSICAL_CLASSIFICATION_CASES.length, 1, {
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
  const validityTarget = new THREE.RenderTarget(PHYSICAL_CLASSIFICATION_CASES.length, 1, {
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
  const cropCamera = camera.clone() as THREE.PerspectiveCamera;
  cropCamera.clearViewOffset();
  cropCamera.setViewOffset(
    cropViewOffset.fullWidth,
    cropViewOffset.fullHeight,
    cropViewOffset.x,
    cropViewOffset.y,
    cropViewOffset.width,
    cropViewOffset.height,
  );
  cropCamera.coordinateSystem = renderer.coordinateSystem;
  cropCamera.updateProjectionMatrix();
  cropCamera.updateMatrixWorld(true);
  const cropSceneTarget = new THREE.RenderTarget(WIDTH, HEIGHT, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: true,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  cropSceneTarget.texture.colorSpace = THREE.NoColorSpace;
  cropSceneTarget.depthTexture = new THREE.DepthTexture(WIDTH, HEIGHT, THREE.UnsignedIntType);
  cropSceneTarget.depthTexture.format = THREE.DepthFormat;
  cropSceneTarget.depthTexture.minFilter = THREE.NearestFilter;
  cropSceneTarget.depthTexture.magFilter = THREE.NearestFilter;
  cropSceneTarget.depthTexture.generateMipmaps = false;
  const cropDiagnosticTarget = new THREE.RenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  cropDiagnosticTarget.texture.colorSpace = THREE.NoColorSpace;
  cropDiagnosticTarget.texture.minFilter = THREE.NearestFilter;
  cropDiagnosticTarget.texture.magFilter = THREE.NearestFilter;
  cropDiagnosticTarget.texture.generateMipmaps = false;
  const cropPhysicalTarget = new THREE.RenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  cropPhysicalTarget.texture.colorSpace = THREE.NoColorSpace;
  cropPhysicalTarget.texture.minFilter = THREE.NearestFilter;
  cropPhysicalTarget.texture.magFilter = THREE.NearestFilter;
  cropPhysicalTarget.texture.generateMipmaps = false;
  const cropValidityTarget = new THREE.RenderTarget(1, 1, {
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
    depthBuffer: false,
    stencilBuffer: false,
    samples: 0,
    generateMipmaps: false,
  });
  cropValidityTarget.texture.colorSpace = THREE.NoColorSpace;
  cropValidityTarget.texture.minFilter = THREE.NearestFilter;
  cropValidityTarget.texture.magFilter = THREE.NearestFilter;
  cropValidityTarget.texture.generateMipmaps = false;
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  postCamera.position.z = 0;
  postCamera.updateMatrixWorld(true);
  const postGeometry = new THREE.PlaneGeometry(2, 2);
  const { material: postMaterial } = createDepthProbeMaterial({
    depthTexture: sceneTarget.depthTexture,
    projectionInverse: camera.projectionMatrixInverse.clone(),
    cameraWorld: camera.matrixWorld.clone(),
    probeUvs,
  });
  const physicalNodes = makeDepthAndFootprintNodes({
    depthTexture: sceneTarget.depthTexture,
    projectionInverse: camera.projectionMatrixInverse.clone(),
    cameraWorld: camera.matrixWorld.clone(),
    cases: resolvedPhysicalCases,
  });
  const physicalMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
  physicalMaterial.outputNode = physicalNodes.storedFootprint;
  const validityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
  validityMaterial.outputNode = vec4(physicalNodes.validityCode.div(255), 0, 0, 1);
  const cropSubjectIndex = PHYSICAL_CLASSIFICATION_CASES.findIndex((entry) => entry.id === "off-axis-tilted-surface");
  const cropSubject = resolvedPhysicalCases[cropSubjectIndex];
  if (!cropSubject) throw new Error("The fixed off-center crop physical case is unavailable");
  const cropProjected = cropReference.point.clone().project(cropCamera);
  const cropPixel = {
    x: Math.max(0, Math.min(WIDTH - 1, Math.floor((cropProjected.x + 1) * 0.5 * WIDTH))),
    y: Math.max(0, Math.min(HEIGHT - 1, Math.floor((1 - cropProjected.y) * 0.5 * HEIGHT))),
  };
  const cropUv: [number, number] = [(cropPixel.x + 0.5) / WIDTH, (cropPixel.y + 0.5) / HEIGHT];
  const cropRayPoint = new THREE.Vector3(cropUv[0] * 2 - 1, 1 - cropUv[1] * 2, 0.5).unproject(cropCamera);
  const cropRay = new THREE.Ray(cropCamera.position.clone(), cropRayPoint.sub(cropCamera.position).normalize());
  const cropExpectedHit = surfaces
    .map((surface) => rayPlaneIntersection(cropRay, surface))
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((a, b) => a.distance - b.distance)[0] ?? null;
  const cropDepthMaterial = createDepthProbeMaterial({
    depthTexture: cropSceneTarget.depthTexture,
    projectionInverse: cropCamera.projectionMatrixInverse.clone(),
    cameraWorld: cropCamera.matrixWorld.clone(),
    probeUvs: [cropUv],
  });
  const cropPhysicalNodes = makeDepthAndFootprintNodes({
    depthTexture: cropSceneTarget.depthTexture,
    projectionInverse: cropCamera.projectionMatrixInverse.clone(),
    cameraWorld: cropCamera.matrixWorld.clone(),
    cases: [{ ...cropSubject, sourceUv: cropUv }],
  });
  const cropPhysicalMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
  cropPhysicalMaterial.outputNode = cropPhysicalNodes.storedFootprint;
  const cropValidityMaterial = new MeshBasicNodeMaterial({ toneMapped: false });
  cropValidityMaterial.outputNode = vec4(cropPhysicalNodes.validityCode.div(255), 0, 0, 1);
  const postScene = new THREE.Scene();
  const physicalScene = new THREE.Scene();
  const validityScene = new THREE.Scene();
  const cropDiagnosticScene = new THREE.Scene();
  const cropPhysicalScene = new THREE.Scene();
  const cropValidityScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(postGeometry, postMaterial));
  physicalScene.add(new THREE.Mesh(postGeometry, physicalMaterial));
  validityScene.add(new THREE.Mesh(postGeometry, validityMaterial));
  cropDiagnosticScene.add(new THREE.Mesh(postGeometry, cropDepthMaterial.material));
  cropPhysicalScene.add(new THREE.Mesh(postGeometry, cropPhysicalMaterial));
  cropValidityScene.add(new THREE.Mesh(postGeometry, cropValidityMaterial));

  const owned = [
    { id: `${evidence.instanceId}:renderer`, role: "renderer", dispose: () => renderer.dispose() },
    { id: `${evidence.instanceId}:scene-target`, role: "scene-color-depth-target", dispose: () => sceneTarget.dispose() },
    { id: `${evidence.instanceId}:diagnostic-target`, role: "world-position-diagnostic-target", dispose: () => diagnosticTarget.dispose() },
    { id: `${evidence.instanceId}:physical-target`, role: "physical-rgba16float-target", dispose: () => physicalTarget.dispose() },
    { id: `${evidence.instanceId}:validity-target`, role: "physical-validity-target", dispose: () => validityTarget.dispose() },
    { id: `${evidence.instanceId}:crop-scene-target`, role: "off-center-crop-color-depth-target", dispose: () => cropSceneTarget.dispose() },
    { id: `${evidence.instanceId}:crop-diagnostic-target`, role: "off-center-crop-position-target", dispose: () => cropDiagnosticTarget.dispose() },
    { id: `${evidence.instanceId}:crop-physical-target`, role: "off-center-crop-rgba16float-target", dispose: () => cropPhysicalTarget.dispose() },
    { id: `${evidence.instanceId}:crop-validity-target`, role: "off-center-crop-validity-target", dispose: () => cropValidityTarget.dispose() },
    { id: `${evidence.instanceId}:post-material`, role: "depth-reconstruction-material", dispose: () => postMaterial.dispose() },
    { id: `${evidence.instanceId}:physical-material`, role: "physical-footprint-material", dispose: () => physicalMaterial.dispose() },
    { id: `${evidence.instanceId}:validity-material`, role: "physical-validity-material", dispose: () => validityMaterial.dispose() },
    { id: `${evidence.instanceId}:crop-depth-material`, role: "off-center-crop-depth-reconstruction-material", dispose: () => cropDepthMaterial.material.dispose() },
    { id: `${evidence.instanceId}:crop-physical-material`, role: "off-center-crop-footprint-material", dispose: () => cropPhysicalMaterial.dispose() },
    { id: `${evidence.instanceId}:crop-validity-material`, role: "off-center-crop-validity-material", dispose: () => cropValidityMaterial.dispose() },
    { id: `${evidence.instanceId}:post-geometry`, role: "fullscreen-geometry", dispose: () => postGeometry.dispose() },
    ...surfaces.flatMap((surface) => [
      { id: `${evidence.instanceId}:${surface.id}:geometry`, role: "fixture-geometry", dispose: () => surface.geometry.dispose() },
      { id: `${evidence.instanceId}:${surface.id}:material`, role: "fixture-material", dispose: () => surface.material.dispose() },
    ]),
  ];
  evidence.resources = owned.map(({ id, role }) => ({ id, role, state: "active", error: null }));
  let retired = false;
  let disposePromise: Promise<void> | null = null;
  const pendingOperations = new Set<Promise<void>>();
  const dispose = async () => {
    if (disposePromise) return disposePromise;
    if (evidence.state === "disposed") return;
    retired = true;
    evidence.state = "retiring";
    signal();
    disposePromise = (async () => {
      await Promise.allSettled([...pendingOperations]);
      try {
        renderer.setRenderTarget(null);
      } catch (error) {
        evidence.error ??= messageOf(error);
      }
      for (let i = owned.length - 1; i >= 0; i--) {
        const resource = evidence.resources[i];
        try {
          await owned[i]!.dispose();
          if (resource) resource.state = "disposed";
        } catch (error) {
          if (resource) {
            resource.state = "failed";
            resource.error = messageOf(error);
          }
        }
      }
      evidence.state = evidence.resources.every((resource) => resource.state === "disposed") ? "disposed" : "failed";
      signal();
    })();
    return disposePromise;
  };

  const startHeldReadback = (): string => {
    if (retired) throw new Error(`Cannot read back retired handle ${evidence.instanceId}`);
    const operation: LifecycleOperationEvidence = {
      operationId: `${evidence.instanceId}:readback-${evidence.operations.length + 1}`,
      kind: "held-readback",
      state: "accepted",
      stage: "readback-accepted",
      failureClassification: null,
      readbackStarted: false,
      readbackOutcome: "not-started",
      resultPublished: false,
      error: null,
    };
    evidence.operations.push(operation);
    let resolveBarrier!: (outcome: "release" | "reject") => void;
    const barrier = new Promise<"release" | "reject">((resolve) => { resolveBarrier = resolve; });
    store.releaseHeldReadback = (outcome) => resolveBarrier(outcome);
    signal();
    const task = (async () => {
      operation.state = "running";
      operation.readbackStarted = true;
      operation.readbackOutcome = "pending";
      operation.stage = "readback-started";
      signal();
      try {
        const pixels = await renderer.readRenderTargetPixelsAsync(
          physicalTarget,
          0,
          0,
          PHYSICAL_CLASSIFICATION_CASES.length,
          1,
        );
        operation.readbackOutcome = "succeeded";
        operation.stage = "readback-settled-held";
        signal();
        const outcome = await barrier;
        if (outcome === "reject") {
          const injected = new Error("Injected test-only operation failure after native GPU readback completed");
          operation.failureClassification = "test-injected-readback";
          operation.state = "failed";
          operation.stage = "test-injected-readback-failure-after-retirement";
          operation.error = messageOf(injected);
          signal();
          return;
        }
        if (retired) {
          operation.state = "retired";
          operation.stage = "stale-readback-discarded";
          operation.resultPublished = false;
        } else {
          operation.state = "completed";
          operation.stage = `readback-published-${(pixels as ArrayBufferView).byteLength}-bytes`;
          operation.resultPublished = true;
        }
      } catch (error) {
        operation.readbackOutcome = "failed";
        operation.failureClassification = "readback";
        operation.state = "failed";
        operation.stage = retired ? "readback-failed-after-retirement" : "readback-failed";
        operation.error = messageOf(error);
      } finally {
        if (store.releaseHeldReadback) store.releaseHeldReadback = null;
        signal();
      }
    })();
    pendingOperations.add(task);
    void task.finally(() => pendingOperations.delete(task));
    return operation.operationId;
  };

  const injectPostPhysicalFailure = async () => {
    if (retired) throw new Error(`Cannot process retired handle ${evidence.instanceId}`);
    const operation: LifecycleOperationEvidence = {
      operationId: `${evidence.instanceId}:failure-${evidence.operations.length + 1}`,
      kind: "post-physical-failure",
      state: "running",
      stage: "physical-pass-restarted",
      failureClassification: null,
      readbackStarted: false,
      readbackOutcome: "not-started",
      resultPublished: false,
      error: null,
    };
    evidence.operations.push(operation);
    const task = (async () => {
      try {
        renderer.setRenderTarget(physicalTarget);
        renderer.clear(true, false, false);
        renderer.render(physicalScene, postCamera);
        const backend = renderer.backend as unknown as { device?: GPUDevice };
        await backend.device?.queue.onSubmittedWorkDone();
        operation.stage = "physical-pass-completed";
        throw new Error("Injected Phase E failure after native physical footprint processing");
      } catch (error) {
        operation.state = "failed";
        operation.failureClassification = "execution";
        operation.stage = "physical-pass-failed";
        operation.error = messageOf(error);
        evidence.error = operation.error;
      } finally {
        signal();
      }
    })();
    pendingOperations.add(task);
    await task;
    pendingOperations.delete(task);
    await dispose();
  };

  const injectPostDepthFailure = async () => {
    if (retired) throw new Error(`Cannot process retired handle ${evidence.instanceId}`);
    const operation: LifecycleOperationEvidence = {
      operationId: `${evidence.instanceId}:depth-failure-${evidence.operations.length + 1}`,
      kind: "post-depth-failure",
      state: "running",
      stage: "native-depth-pass-restarted",
      failureClassification: null,
      readbackStarted: false,
      readbackOutcome: "not-started",
      resultPublished: false,
      error: null,
    };
    evidence.operations.push(operation);
    const task = (async () => {
      try {
        renderer.setRenderTarget(sceneTarget);
        renderer.clear(true, true, true);
        renderer.render(scene, camera);
        const backend = renderer.backend as unknown as { device?: GPUDevice };
        await backend.device?.queue.onSubmittedWorkDone();
        operation.stage = "native-depth-pass-completed";
        throw new Error("Injected Phase E failure after native scene depth rendering");
      } catch (error) {
        operation.state = "failed";
        operation.failureClassification = "execution";
        operation.stage = "native-depth-pass-failed";
        operation.error = messageOf(error);
        evidence.error = operation.error;
      } finally {
        signal();
      }
    })();
    pendingOperations.add(task);
    await task;
    pendingOperations.delete(task);
    await dispose();
  };

  try {
    const runtime = resolveObserverRendererRuntime(renderer);
    evidence.runtime = { ...runtime, applicationFallback: false, initialized: true, threeRevision: THREE.REVISION };

    renderer.setRenderTarget(sceneTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.setRenderTarget(cropSceneTarget);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, cropCamera);
    const backend = renderer.backend as unknown as {
      device?: GPUDevice;
      get?: (resource: unknown) => unknown;
    };
    await backend.device?.queue.onSubmittedWorkDone();
    const textureFormat = (value: THREE.Texture) => {
      const data = backend.get?.(value) as { texture?: { format?: string }; textureDescriptorGPU?: { format?: string } } | undefined;
      return data?.texture?.format ?? data?.textureDescriptorGPU?.format ?? null;
    };
    const depthBackendFormat = textureFormat(sceneTarget.depthTexture);
    evidence.depth = {
      requestedFormat: "DepthFormat",
      requestedType: "UnsignedIntType",
      actualGpuFormat: depthBackendFormat,
      width: WIDTH,
      height: HEIGHT,
      sampleCount: DEPTH_PROBE_COUNT,
      clearDepth: 1,
    };
    evidence.camera = {
      positionWorldM: vec3Array(camera.position),
      near: camera.near,
      far: camera.far,
      coordinateSystem: camera.coordinateSystem,
      projectionMatrix: [...camera.projectionMatrix.elements],
      projectionMatrixInverse: [...camera.projectionMatrixInverse.elements],
      worldMatrix: [...camera.matrixWorld.elements],
      offAxisViewOffsetPx: { x: -13, y: 7 },
    };

    renderer.setRenderTarget(diagnosticTarget);
    renderer.clear(true, false, false);
    renderer.render(postScene, postCamera);
    renderer.setRenderTarget(physicalTarget);
    renderer.clear(true, false, false);
    renderer.render(physicalScene, postCamera);
    renderer.setRenderTarget(validityTarget);
    renderer.clear(true, false, false);
    renderer.render(validityScene, postCamera);
    renderer.setRenderTarget(cropDiagnosticTarget);
    renderer.clear(true, false, false);
    renderer.render(cropDiagnosticScene, postCamera);
    renderer.setRenderTarget(cropPhysicalTarget);
    renderer.clear(true, false, false);
    renderer.render(cropPhysicalScene, postCamera);
    renderer.setRenderTarget(cropValidityTarget);
    renderer.clear(true, false, false);
    renderer.render(cropValidityScene, postCamera);
    await backend.device?.queue.onSubmittedWorkDone();
    const pixels = await renderer.readRenderTargetPixelsAsync(diagnosticTarget, 0, 0, DEPTH_PROBE_COUNT, 1) as Float32Array;
    const probeResults = DEPTH_PROBE_CASES.map((probe, index) => {
      const gpu = new THREE.Vector3(pixels[index * 4]!, pixels[index * 4 + 1]!, pixels[index * 4 + 2]!);
      const gpuDepth = pixels[index * 4 + 3]!;
      const [uvX, uvY] = probeUvs[index]!;
      const pixel = probePixels[index]!;
      const expected = analyticReferences[index]?.hit ?? null;
      const error = expected ? gpu.clone().sub(expected.point) : null;
      return {
        id: probe.id,
        pixel,
        uvTopOrigin: [uvX, uvY] as [number, number],
        expectedSurfaceId: probe.expectedSurfaceId,
        actualSurfaceId: expected?.surfaceId ?? null,
        occludedSurfaceIds: analyticReferences[index]?.occludedSurfaceIds ?? [],
        gpuDepth,
        reconstructedWorldM: vec3Array(gpu),
        expectedWorldM: expected ? vec3Array(expected.point) : null,
        absoluteErrorM: error ? [Math.abs(error.x), Math.abs(error.y), Math.abs(error.z)] as [number, number, number] : null,
        errorMagnitudeM: error?.length() ?? null,
        valid: gpuDepth < 0.999999 && Boolean(expected),
      };
    });
    evidence.probes = probeResults;
    const physicalReadback = await renderer.readRenderTargetPixelsAsync(
      physicalTarget,
      0,
      0,
      PHYSICAL_CLASSIFICATION_CASES.length,
      1,
    );
    const validityReadback = await renderer.readRenderTargetPixelsAsync(
      validityTarget,
      0,
      0,
      PHYSICAL_CLASSIFICATION_CASES.length,
      1,
    );
    if (!(physicalReadback instanceof Uint16Array)) {
      throw new Error(`Expected RGBA16F physical readback, received ${physicalReadback.constructor.name}`);
    }
    if (!(validityReadback instanceof Uint8Array)) {
      throw new Error(`Expected byte validity readback, received ${validityReadback.constructor.name}`);
    }
    const probeById = new Map(probeResults.map((probe) => [probe.id, probe]));
    evidence.physical = {
      requestedFormat: "rgba16float",
      actualGpuFormat: textureFormat(physicalTarget.texture),
      validityFormat: "rgba8unorm",
      actualValidityGpuFormat: textureFormat(validityTarget.texture),
      samples: resolvedPhysicalCases.map((entry, index) => {
        const offset = index * 4;
        const stored = [0, 1, 2, 3].map((channel) =>
          THREE.DataUtils.fromHalfFloat(physicalReadback[offset + channel]!),
        ) as [number, number, number, number];
        const sourceProbe = probeById.get(entry.sourceProbeId);
        if (!sourceProbe) throw new Error(`Missing depth probe result ${entry.sourceProbeId}`);
        const validityCode = validityReadback[offset]!;
        return {
          id: entry.id,
          sourceProbeId: entry.sourceProbeId,
          input: entry,
          gpuDepth: sourceProbe.gpuDepth,
          reconstructedWorldMm: sourceProbe.reconstructedWorldM.map((value) => value * 1000) as [number, number, number],
          storedRgba16Float: stored,
          validityCode,
          storageRepresentable: validityCode === 1,
          classification: validityCode === 0
            ? "no-depth"
            : validityCode === 2
              ? "unrepresentable"
              : validityCode === 3
                ? "invalid-geometry"
                : Math.abs(stored[0]) <= 0.0001
                  ? "neutral"
                  : stored[0] < 0 ? "near" : "far",
        };
      }),
    };
    const cropPositionPixels = await renderer.readRenderTargetPixelsAsync(cropDiagnosticTarget, 0, 0, 1, 1) as Float32Array;
    const cropPhysicalPixels = await renderer.readRenderTargetPixelsAsync(cropPhysicalTarget, 0, 0, 1, 1);
    const cropValidityPixels = await renderer.readRenderTargetPixelsAsync(cropValidityTarget, 0, 0, 1, 1);
    if (!(cropPhysicalPixels instanceof Uint16Array) || !(cropValidityPixels instanceof Uint8Array)) {
      throw new Error("Expected native half-float and byte reads for the off-center crop");
    }
    const cropWorld = new THREE.Vector3(cropPositionPixels[0]!, cropPositionPixels[1]!, cropPositionPixels[2]!);
    const cropWorldErrorMm = cropExpectedHit
      ? cropWorld.clone().sub(cropExpectedHit.point).length() * 1000
      : null;
    const cropFootprint = [0, 1, 2, 3].map((channel) =>
      THREE.DataUtils.fromHalfFloat(cropPhysicalPixels[channel]!),
    ) as [number, number, number, number];
    const fullOffset = cropSubjectIndex * 4;
    const fullFootprint = [0, 1, 2, 3].map((channel) =>
      THREE.DataUtils.fromHalfFloat(physicalReadback[fullOffset + channel]!),
    ) as [number, number, number, number];
    const cropValidityCode = cropValidityPixels[0]!;
    evidence.crop = {
      sourceProbeId: cropSubject.sourceProbeId,
      cropViewOffsetPx: cropViewOffset,
      cropOutputSizePx: { width: WIDTH, height: HEIGHT },
      actualDepthGpuFormat: textureFormat(cropSceneTarget.depthTexture),
      fullFilmUv: cropSubject.sourceUv,
      cropFilmUv: cropUv,
      cropPixel,
      expectedSurfaceId: cropReference.surfaceId,
      actualSurfaceId: cropExpectedHit?.surfaceId ?? null,
      gpuDepth: cropPositionPixels[3]!,
      expectedWorldMm: cropExpectedHit ? vec3Array(cropExpectedHit.point.clone().multiplyScalar(1000)) : null,
      reconstructedWorldMm: vec3Array(cropWorld.clone().multiplyScalar(1000)),
      worldErrorMm: cropWorldErrorMm,
      fullPhysicalRgba16Float: fullFootprint,
      cropPhysicalRgba16Float: cropFootprint,
      sampledFilmDimensionsMm: {
        full: { widthMm: FULL_FILM_WIDTH_MM, heightMm: FULL_FILM_HEIGHT_MM },
        crop: sampledCropFilmDimensionsMm,
      },
      physicalCoCDifferenceMm: Math.abs(fullFootprint[0] - cropFootprint[0]),
      validityCode: cropValidityCode,
      cameraProjectionMatrix: [...cropCamera.projectionMatrix.elements],
    };
    evidence.state = "active";
    store.status = "completed";
    signal();
    return { evidence, dispose, startHeldReadback, injectPostDepthFailure, injectPostPhysicalFailure };
  } catch (error) {
    evidence.error = messageOf(error);
    evidence.state = "failed";
    store.status = "failed";
    signal();
    await dispose();
    throw error;
  }
};

const ExperimentRoute = () => {
  const [, setRevision] = useState(0);
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const update = () => setRevision((value) => value + 1);
    window.addEventListener(CHANGE_EVENT, update);
    return () => window.removeEventListener(CHANGE_EVENT, update);
  }, []);
  useEffect(() => {
    if (!canvas) return;
    let alive = true;
    let handle: MountedHandle | null = null;
    store.status = "initializing";
    void buildHandle(canvas).then((created) => {
      handle = created;
      if (!alive) return created.dispose();
      store.activeHandle = created;
      signal();
      return undefined;
    }).catch((error: unknown) => {
      store.status = "failed";
      const latest = store.handles.at(-1);
      if (latest && !latest.error) latest.error = messageOf(error);
      signal();
    });
    return () => {
      alive = false;
      if (store.activeHandle === handle) store.activeHandle = null;
      if (handle) void handle.dispose();
    };
  }, [canvas]);
  const latest = store.handles.at(-1) ?? null;
  return (
    <main data-testid="physical-coc-experiment" data-status={store.status} data-backend={latest?.runtime?.executionBackend ?? "unknown"}>
      <h1>Native WebGPU depth-driven physical CoC</h1>
      <canvas ref={setCanvas} width={WIDTH} height={HEIGHT} aria-label="Depth fixture renderer" />
      <button type="button" onClick={() => store.activeHandle?.startHeldReadback()}>Start held readback</button>
      <button type="button" onClick={() => void store.activeHandle?.injectPostDepthFailure()}>Inject post-depth failure</button>
      <button type="button" onClick={() => void store.activeHandle?.injectPostPhysicalFailure()}>Inject post-physical failure</button>
    </main>
  );
};

const AwayRoute = () => {
  const navigate = useNavigate();
  useEffect(() => {
    store.status = "away";
    signal();
  }, []);
  return <main data-testid="physical-coc-away">
    <h1>Fixture renderer unmounted</h1>
    {store.releaseHeldReadback && <>
      <button type="button" onClick={() => store.releaseHeldReadback?.("release")}>Release held readback</button>
      <button type="button" onClick={() => store.releaseHeldReadback?.("reject")}>Inject post-readback failure (test only)</button>
    </>}
    <button onClick={() => navigate("/experiment")}>Return to experiment</button>
  </main>;
};

const App = () => {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const update = () => setRevision((value) => value + 1);
    window.addEventListener(CHANGE_EVENT, update);
    return () => window.removeEventListener(CHANGE_EVENT, update);
  }, []);
  return <HashRouter>
    <nav><Link to="/experiment">Experiment</Link> <Link to="/away">Navigate away</Link></nav>
    <Routes>
      <Route path="/" element={<Navigate to="/experiment" replace />} />
      <Route path="/experiment" element={<ExperimentRoute />} />
      <Route path="/away" element={<AwayRoute />} />
    </Routes>
    <output data-testid="physical-coc-diagnostics" data-revision={revision}>
      {JSON.stringify({ status: store.status, handles: store.handles })}
    </output>
  </HashRouter>;
};

const root = document.getElementById("ground-glass-webgpu-physical-coc");
if (!root) throw new Error("Physical CoC feasibility fixture root was not found");
createRoot(root).render(<App />);
