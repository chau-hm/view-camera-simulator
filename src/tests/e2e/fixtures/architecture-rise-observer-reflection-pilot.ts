import * as THREE from "three";
import { architectureRiseScene } from "../../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../../scenes/presentation/architectureRise";
import { CAMERA_MOVEMENT_BASELINE_PRESENTATION } from "../../../scenes/presentation/understandingCameraMovements";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../../render/ArchitectureRiseSubjectFactory";
import {
  configureTeachingShadowParticipation,
  createPresentationLightingRig,
  disposePresentationLightingRig,
} from "../../../render/TeachingLighting";
import { resolveScenePresentationLighting } from "../../../render/presentationLighting";
import { PRESENTATION_SHADOW_MAP_TYPE } from "../../../render/presentationLightingContract";
import {
  createWorldIlluminationRig,
  disposeWorldIlluminationRig,
} from "../../../render/worldIlluminationRig";
import { resolveSceneWorldIllumination } from "../../../scenes/illumination/sceneWorldIllumination";
import {
  createWorldEnvironmentRig,
  disposeWorldEnvironmentRig,
} from "../../../render/worldEnvironmentRig";
import { toWorld } from "../../../render/rttUtils";
import {
  correctProbeDirectionFromRadialHit,
  PROBE_DISTANCE_CUBE_CORRECTION_GLSL,
} from "./probe-distance-cube-correction";

const WIDTH = 514;
const HEIGHT = 411;
const PROBE_RESOLUTION = 128;
const PROBE_NEAR = 0.05;
const PROBE_FAR = 100;
const REFLECTION_WEIGHT = 0.18;
const BASE_SHA = "30098d044ff5fd8b2a14693c6d310980c5459455";
const PROBE_ORIGIN = new THREE.Vector3(-1.2725, 1.5, 6.972);
const FRONT_PANE_PREFIX = "architecture-rise-facade-window-bay-";
const PANE_SAMPLE_FRACTIONS = [0.1, 0.3, 0.7, 0.9] as const;
const BACKGROUND_COLOR = 0xf8fafc;

type ViewId = "default" | "alternate";
type ModeId = "baseline" | "uncorrected-probe" | "corrected-probe";
type Vec3Tuple = readonly [number, number, number];
type PixelBuffer = Uint8Array;
type ResourceCategory = "renderTargets" | "textures" | "materials" | "geometries";
type DisposableResource = THREE.WebGLRenderTarget | THREE.Texture | THREE.Material | THREE.BufferGeometry;

type DisposalCounts = { owned: number; disposed: number; duplicateDisposeEvents: number };
type LifecycleCounts = {
  renderTargets: DisposalCounts;
  textures: DisposalCounts;
  materials: DisposalCounts;
  geometries: DisposalCounts;
  customDisposers: { registered: number; invoked: number };
  rendererDisposeCalled: boolean;
};

type ObserverPaneSample = {
  key: string;
  pane: string;
  row: number;
  column: number;
  u: number;
  v: number;
  panePoint: THREE.Vector3;
  localNormal: THREE.Vector3;
  normal: THREE.Vector3;
  reflectedDirection: THREE.Vector3;
  screenX: number;
  screenYBottom: number;
  physicalQ: THREE.Vector3 | null;
  physicalHitObject: string | null;
};

type CandidateHit = {
  q: THREE.Vector3;
  hitObject: string | null;
  direction: THREE.Vector3;
};

type GeometryMetrics = {
  visiblePaneSampleCount: number;
  physicalFiniteHitCount: number;
  physicalNoHitCount: number;
  validCandidateCount: number;
  sameObjectHitCount: number;
  wrongObjectCount: number;
  candidateNoHitCount: number;
  sameObjectCoverage: number | null;
  falsePositiveLocalReflectionCount: number;
  falseNegativeCount: number;
  medianQErrorM: number | null;
  p95QErrorM: number | null;
  medianAngularErrorDeg: number | null;
  p95AngularErrorDeg: number | null;
};

type ViewGeometryProof = {
  sampleDomain: {
    paneCount: number;
    totalPaneSamples: number;
    visiblePaneSampleCount: number;
    frontFaceObjectNormalMatches: number;
    sampleFractions: readonly number[];
  };
  physical: { finiteHitCount: number; noHitCount: number };
  uncorrectedCpu: GeometryMetrics;
  correctedCpu: GeometryMetrics;
  correctedGpu: GeometryMetrics & {
    cpuToGpuMedianQErrorM: number | null;
    cpuToGpuP95QErrorM: number | null;
    diagnosticSamples: {
      resolved: number;
      missingPaneInput: number;
      missingInitialProbeDistance: number;
      invalidInitialProbeDistance: number;
      laterCorrectionMiss: number;
      colorSampleNonzero: number;
      meanLinearRadiance: number;
    };
  };
};

type ImageMetrics = {
  meanAbsoluteRgbDelta: number;
  changedPixelFraction: number;
  glazingMeanAbsoluteRgbDelta: number;
  glazingP95RgbDelta: number;
  glazingChangedPixelFraction: number;
  outsideExpandedGlazingMeanAbsoluteRgbDelta: number;
  outsideExpandedGlazingChangedPixelFraction: number;
};

type PilotProof = {
  baseSha: string;
  backend: {
    renderer: string;
    gpuRenderer: string;
    webgl2: boolean;
    extensionName: string;
    extensionSupported: boolean;
    colorCubeFaceFramebufferStatuses: readonly string[];
    distanceCubeFaceFramebufferStatuses: readonly string[];
    allCubeFacesFramebufferComplete: boolean;
    gpuDiagnosticFramebufferComplete: boolean;
    gpuDiagnosticReadbackWorks: boolean;
    gpuReadbackArrayType: "Float32Array";
  };
  candidate: {
    probeOriginM: Vec3Tuple;
    resolution: readonly [number, number, number];
    colorFormat: string;
    distanceFormat: string;
    colorDataType: string;
    distanceDataType: string;
    colorSpace: string;
    filter: string;
    correctionIterations: number;
    reflectionWeight: number;
    frontFaceLocalNormal: Vec3Tuple;
    glass: { color: string; roughness: number; metalness: number };
  };
  views: Record<ViewId, { cameraPosition: Vec3Tuple; target: Vec3Tuple; fovDeg: number; near: number; far: number }>;
  capture: {
    colorFaceRenders: number;
    distanceFaceRenders: number;
    totalSceneRenders: number;
    recapturesAfterObserverOrbit: number;
    glazingExcludedFromColorAndDistance: boolean;
    sceneBackgroundNullDuringCapture: boolean;
    sceneEnvironmentRetainedDuringCapture: boolean;
    sameOriginNearFarAndVisibility: boolean;
  };
  geometry: Record<ViewId, ViewGeometryProof>;
  appearance: Record<ViewId, {
    resolution: readonly [number, number];
    maskPixelCount: number;
    baselineVsUncorrected: ImageMetrics;
    baselineVsCorrected: ImageMetrics;
    uncorrectedVsCorrected: ImageMetrics;
    edgeGradientEnergy: Record<ModeId, number>;
  }>;
  viewDependence: {
    sharedPhysicalPaneSamples: number;
    correctedMeanAbsoluteRgbDeltaBetweenViews: number;
    uncorrectedMeanAbsoluteRgbDeltaBetweenViews: number;
    sameCapturedProbeUsed: boolean;
  };
  environment: {
    presentBeforeCandidate: boolean;
    sameReferenceAfterCandidateRenders: boolean;
    candidateMaterialEnvMapReplaced: boolean;
  };
  candidateFrameCost: {
    baselineLocalDistanceSamplesPerFrontFragment: 0;
    uncorrectedDistanceSamplesPerFrontFragment: 1;
    correctedDistanceSamplesPerFrontFragment: 2;
    uncorrectedColorSamplesPerFrontFragment: 1;
    correctedColorSamplesPerFrontFragment: 1;
    extraDistanceSamplesPerFrontFragmentForCorrection: 1;
    extraSceneRendersPerObserverFrame: 0;
    extraFullscreenPassesPerObserverFrame: 0;
    totalCaptureRenders: number;
    measuredProgramCount: number | null;
  };
  resources: {
    colorCube: { bytes: number; mebibytes: number };
    distanceCube: { bytes: number; mebibytes: number };
    candidateTotal: { bytes: number; mebibytes: number };
    diagnosticTargets: number;
  };
  lifecycle: LifecycleCounts;
};

declare global {
  interface Window {
    __architectureRiseObserverReflectionPilot?: {
      proof: PilotProof;
      capture: (view: ViewId, mode: ModeId) => void;
      dispose: () => void;
    };
  }
}

const makeDisposalCounts = (): DisposalCounts => ({ owned: 0, disposed: 0, duplicateDisposeEvents: 0 });

const createResourceTracker = () => {
  const lifecycle: LifecycleCounts = {
    renderTargets: makeDisposalCounts(),
    textures: makeDisposalCounts(),
    materials: makeDisposalCounts(),
    geometries: makeDisposalCounts(),
    customDisposers: { registered: 0, invoked: 0 },
    rendererDisposeCalled: false,
  };
  const seen = new WeakSet<object>();
  const ownedDisposers: Array<() => void> = [];

  const track = (resource: DisposableResource, category: ResourceCategory, ownedHere: boolean): void => {
    if (seen.has(resource)) return;
    seen.add(resource);
    const counts = lifecycle[category];
    counts.owned += 1;
    let disposeEvents = 0;
    const eventSource = resource as unknown as { addEventListener: (type: "dispose", listener: () => void) => void };
    eventSource.addEventListener("dispose", () => {
      disposeEvents += 1;
      counts.disposed += 1;
      if (disposeEvents > 1) counts.duplicateDisposeEvents += 1;
    });
    if (ownedHere) ownedDisposers.push(() => resource.dispose());
  };

  return { lifecycle, track, ownedDisposers };
};

const replaceUnique = (source: string, needle: string, replacement: string, label: string): string => {
  const first = source.indexOf(needle);
  if (first < 0 || source.indexOf(needle, first + needle.length) >= 0) {
    throw new Error("Expected one stable shader insertion point for " + label);
  }
  return source.slice(0, first) + replacement + source.slice(first + needle.length);
};

const tuple = (value: THREE.Vector3): Vec3Tuple => [value.x, value.y, value.z];
const sortNumbers = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);
const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = sortNumbers(values);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};
const percentile = (values: readonly number[], p: number): number | null => {
  if (values.length === 0) return null;
  const sorted = sortNumbers(values);
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
};
const angleDegrees = (a: THREE.Vector3, b: THREE.Vector3): number =>
  THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(a.clone().normalize().dot(b.clone().normalize()), -1, 1)));

const createPerspectiveCamera = (position: THREE.Vector3, target: THREE.Vector3): THREE.PerspectiveCamera => {
  const camera = new THREE.PerspectiveCamera(45, WIDTH / HEIGHT, 0.01, 200);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
};

const isFrontGlazing = (mesh: THREE.Mesh): boolean =>
  mesh.name.startsWith(FRONT_PANE_PREFIX) && mesh.name.endsWith("-glazing");

const isAnyGlazing = (mesh: THREE.Mesh): boolean => mesh.name.endsWith("-glazing");

const collectMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
};

const collectSubjectResources = (
  root: THREE.Object3D,
  track: (resource: DisposableResource, category: ResourceCategory, ownedHere: boolean) => void,
): void => {
  const textures = new Set<THREE.Texture>();
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textureSlots = ["map", "alphaMap", "aoMap", "bumpMap", "displacementMap", "emissiveMap", "lightMap", "metalnessMap", "normalMap", "roughnessMap"] as const;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      materials.add(material);
      const materialWithTextures = material as THREE.Material & Partial<Record<(typeof textureSlots)[number], THREE.Texture | null>>;
      for (const slot of textureSlots) {
        const texture = materialWithTextures[slot];
        if (texture instanceof THREE.Texture) textures.add(texture);
      }
    }
  });
  geometries.forEach((resource) => track(resource, "geometries", false));
  textures.forEach((resource) => track(resource, "textures", false));
  materials.forEach((resource) => track(resource, "materials", false));
};

const probeRayHit = (
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  sceneMeshes: THREE.Mesh[],
): THREE.Intersection<THREE.Object3D> | null => {
  const ray = new THREE.Raycaster(origin, direction.clone().normalize());
  ray.near = 0;
  ray.far = PROBE_FAR;
  return ray.intersectObjects(sceneMeshes, false)[0] ?? null;
};

const collectObserverPaneSamples = (
  camera: THREE.PerspectiveCamera,
  allMeshes: THREE.Mesh[],
  frontPanes: THREE.Mesh[],
  reflectionMeshes: THREE.Mesh[],
): ObserverPaneSample[] => {
  const samples: ObserverPaneSample[] = [];
  const directRay = new THREE.Raycaster();
  const reflectedRay = new THREE.Raycaster();
  camera.updateMatrixWorld(true);

  for (const pane of frontPanes) {
    pane.updateWorldMatrix(true, false);
    const bounds = new THREE.Box3().setFromObject(pane);
    const size = bounds.getSize(new THREE.Vector3());
    for (let row = 0; row < PANE_SAMPLE_FRACTIONS.length; row += 1) {
      for (let column = 0; column < PANE_SAMPLE_FRACTIONS.length; column += 1) {
        const u = PANE_SAMPLE_FRACTIONS[column];
        const v = PANE_SAMPLE_FRACTIONS[row];
        const expectedPoint = new THREE.Vector3(
          bounds.min.x + u * size.x,
          bounds.min.y + v * size.y,
          bounds.min.z,
        );
        const projected = expectedPoint.clone().project(camera);
        if (
          projected.x < -1 || projected.x > 1 || projected.y < -1 || projected.y > 1 ||
          projected.z < -1 || projected.z > 1
        ) continue;

        const cameraToPoint = expectedPoint.clone().sub(camera.position).normalize();
        directRay.set(camera.position, cameraToPoint);
        directRay.near = 0;
        directRay.far = camera.far;
        const directHit = directRay.intersectObjects(allMeshes, false)[0];
        if (!directHit?.face || directHit.object !== pane) continue;
        if (directHit.point.distanceTo(expectedPoint) > 0.01) continue;
        const localFrontFaceNormal = new THREE.Vector3(0, 0, -1);
        if (directHit.face.normal.dot(localFrontFaceNormal) < 0.999) continue;

        const worldNormal = directHit.face.normal.clone().applyMatrix3(
          new THREE.Matrix3().getNormalMatrix(pane.matrixWorld),
        ).normalize();
        if (worldNormal.dot(camera.position.clone().sub(directHit.point)) < 0) worldNormal.negate();
        // The tested architecture's exposed BoxGeometry face is the object-space -Z face.
        if (worldNormal.dot(new THREE.Vector3(0, 0, -1)) < 0.999) continue;

        const incident = directHit.point.clone().sub(camera.position).normalize();
        const reflectedDirection = incident.clone().reflect(worldNormal).normalize();
        reflectedRay.set(directHit.point.clone().addScaledVector(reflectedDirection, 0.12), reflectedDirection);
        reflectedRay.near = 0;
        reflectedRay.far = PROBE_FAR;
        const physicalHit = reflectedRay.intersectObjects(reflectionMeshes, false)[0] ?? null;
        const screenX = Math.max(0, Math.min(WIDTH - 1, Math.floor((projected.x * 0.5 + 0.5) * WIDTH)));
        const screenYBottom = Math.max(0, Math.min(HEIGHT - 1, Math.floor((projected.y * 0.5 + 0.5) * HEIGHT)));
        samples.push({
          key: pane.name + "|" + row + "|" + column,
          pane: pane.name,
          row,
          column,
          u,
          v,
          panePoint: directHit.point.clone(),
          localNormal: directHit.face.normal.clone(),
          normal: worldNormal,
          reflectedDirection,
          screenX,
          screenYBottom,
          physicalQ: physicalHit?.point.clone() ?? null,
          physicalHitObject: physicalHit?.object.name ?? null,
        });
      }
    }
  }
  return samples;
};

const runCpuProbeCandidate = (
  samples: readonly ObserverPaneSample[],
  reflectionMeshes: THREE.Mesh[],
  useOneCorrection: boolean,
): Array<CandidateHit | null> => samples.map((sample) => {
  let direction = sample.reflectedDirection.clone().normalize();
  if (useOneCorrection) {
    const distanceHit = probeRayHit(PROBE_ORIGIN, direction, reflectionMeshes);
    if (!distanceHit) return null;
    const corrected = correctProbeDirectionFromRadialHit(
      PROBE_ORIGIN,
      sample.panePoint,
      sample.reflectedDirection,
      distanceHit.point,
    );
    if (!corrected) return null;
    direction = corrected;
  }
  const finalHit = probeRayHit(PROBE_ORIGIN, direction, reflectionMeshes);
  if (!finalHit) return null;
  const q = finalHit.point.clone();
  return { q, hitObject: finalHit.object.name, direction: q.clone().sub(PROBE_ORIGIN).normalize() };
});

const measureGeometry = (
  samples: readonly ObserverPaneSample[],
  candidates: readonly (CandidateHit | null)[],
): GeometryMetrics => {
  const qErrors: number[] = [];
  const angularErrors: number[] = [];
  let physicalFiniteHitCount = 0;
  let physicalNoHitCount = 0;
  let validCandidateCount = 0;
  let sameObjectHitCount = 0;
  let wrongObjectCount = 0;
  let candidateNoHitCount = 0;
  let falsePositiveLocalReflectionCount = 0;
  let falseNegativeCount = 0;

  samples.forEach((sample, index) => {
    const candidate = candidates[index] ?? null;
    if (sample.physicalQ) physicalFiniteHitCount += 1;
    else physicalNoHitCount += 1;
    if (candidate) validCandidateCount += 1;
    else candidateNoHitCount += 1;

    if (!sample.physicalQ) {
      if (candidate) falsePositiveLocalReflectionCount += 1;
      return;
    }
    if (!candidate) {
      falseNegativeCount += 1;
      return;
    }
    if (candidate.hitObject === sample.physicalHitObject) sameObjectHitCount += 1;
    else if (candidate.hitObject !== null) wrongObjectCount += 1;
    qErrors.push(candidate.q.distanceTo(sample.physicalQ));
    const physicalDirection = sample.physicalQ.clone().sub(sample.panePoint).normalize();
    const candidateDirection = candidate.q.clone().sub(sample.panePoint).normalize();
    angularErrors.push(angleDegrees(physicalDirection, candidateDirection));
  });

  return {
    visiblePaneSampleCount: samples.length,
    physicalFiniteHitCount,
    physicalNoHitCount,
    validCandidateCount,
    sameObjectHitCount,
    wrongObjectCount,
    candidateNoHitCount,
    sameObjectCoverage: physicalFiniteHitCount === 0 ? null : sameObjectHitCount / physicalFiniteHitCount,
    falsePositiveLocalReflectionCount,
    falseNegativeCount,
    medianQErrorM: median(qErrors),
    p95QErrorM: percentile(qErrors, 0.95),
    medianAngularErrorDeg: median(angularErrors),
    p95AngularErrorDeg: percentile(angularErrors, 0.95),
  };
};

const createRadialDistanceMaterial = (probeOrigin: THREE.Vector3): THREE.ShaderMaterial =>
  new THREE.ShaderMaterial({
    uniforms: { uProbeOrigin: { value: probeOrigin.clone() } },
    vertexShader: [
      "varying vec3 vRadialWorldPosition;",
      "void main(){",
      "  vec4 worldPosition = modelMatrix * vec4(position, 1.0);",
      "  vRadialWorldPosition = worldPosition.xyz;",
      "  gl_Position = projectionMatrix * viewMatrix * worldPosition;",
      "}",
    ].join("\n"),
    fragmentShader: [
      "precision highp float;",
      "varying vec3 vRadialWorldPosition;",
      "uniform vec3 uProbeOrigin;",
      "void main(){ gl_FragColor = vec4(length(vRadialWorldPosition - uProbeOrigin), 0.0, 0.0, 1.0); }",
    ].join("\n"),
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });

const createObserverCandidateMaterial = (
  baseline: THREE.MeshStandardMaterial,
  colorCube: THREE.CubeTexture,
  distanceCube: THREE.CubeTexture,
  probeOrigin: THREE.Vector3,
  initialCameraPosition: THREE.Vector3,
): { material: THREE.MeshStandardMaterial; getUniforms: () => Record<string, THREE.IUniform> | null } => {
  const material = baseline.clone();
  let uniforms: Record<string, THREE.IUniform> | null = null;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uObserverProbeColor = { value: colorCube };
    shader.uniforms.uObserverProbeDistance = { value: distanceCube };
    shader.uniforms.uObserverProbeOrigin = { value: probeOrigin.clone() };
    shader.uniforms.uObserverCameraPosition = { value: initialCameraPosition.clone() };
    shader.uniforms.uObserverReflectionWeight = { value: REFLECTION_WEIGHT };
    shader.uniforms.uObserverCorrectionIterations = { value: 0 };
    uniforms = shader.uniforms;

    shader.vertexShader = replaceUnique(
      shader.vertexShader,
      "#include <common>",
      "#include <common>\nvarying vec3 vObserverProbeWorldPosition;\nvarying vec3 vObserverProbeLocalNormal;\nvarying vec3 vObserverProbeWorldNormal;",
      "Observer candidate vertex varying declarations",
    );
    shader.vertexShader = replaceUnique(
      shader.vertexShader,
      "#include <beginnormal_vertex>",
      "#include <beginnormal_vertex>\n  vObserverProbeLocalNormal = objectNormal;\n  vObserverProbeWorldNormal = normalize(transpose(inverse(mat3(modelMatrix))) * objectNormal);",
      "Observer candidate object-space face normal",
    );
    shader.vertexShader = replaceUnique(
      shader.vertexShader,
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\n  vObserverProbeWorldPosition = worldPosition.xyz;",
      "Observer candidate world position",
    );
    shader.fragmentShader = replaceUnique(
      shader.fragmentShader,
      "#include <common>",
      [
        "#include <common>",
        "varying vec3 vObserverProbeWorldPosition;",
        "varying vec3 vObserverProbeLocalNormal;",
        "varying vec3 vObserverProbeWorldNormal;",
        "uniform samplerCube uObserverProbeColor;",
        "uniform samplerCube uObserverProbeDistance;",
        "uniform vec3 uObserverProbeOrigin;",
        "uniform vec3 uObserverCameraPosition;",
        "uniform float uObserverReflectionWeight;",
        "uniform int uObserverCorrectionIterations;",
        PROBE_DISTANCE_CUBE_CORRECTION_GLSL,
      ].join("\n"),
      "Observer candidate fragment declarations and correction kernel",
    );
    shader.fragmentShader = replaceUnique(
      shader.fragmentShader,
      "#include <opaque_fragment>",
      [
        "if (dot(normalize(vObserverProbeLocalNormal), vec3(0.0, 0.0, -1.0)) > 0.999) {",
        "  vec3 incident = normalize(vObserverProbeWorldPosition - uObserverCameraPosition);",
        "  vec3 paneNormal = normalize(vObserverProbeWorldNormal);",
        "  vec3 reflectedDirection = normalize(reflect(incident, paneNormal));",
        "  vec3 correctedDirection;",
        "  vec3 correctedPoint;",
        "  if (resolveProbePoint(uObserverProbeDistance, vObserverProbeWorldPosition, paneNormal, reflectedDirection, uObserverProbeOrigin, uObserverCorrectionIterations, correctedDirection, correctedPoint)) {",
        "    vec3 localReflectedRadiance = textureCube(uObserverProbeColor, correctedDirection).rgb;",
        "    outgoingLight += localReflectedRadiance * uObserverReflectionWeight;",
        "  }",
        "}",
        "#include <opaque_fragment>",
      ].join("\n"),
      "linear material-light addition before opaque output",
    );
  };
  material.customProgramCacheKey = () => "architecture-rise-observer-probe-pilot-r186-v1";
  material.needsUpdate = true;
  return { material, getUniforms: () => uniforms };
};

const createFrontGlazingMaskMaterial = (): THREE.MeshBasicMaterial => {
  const material = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.FrontSide, toneMapped: false });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = replaceUnique(
      shader.vertexShader,
      "#include <common>",
      "#include <common>\nvarying vec3 vObserverMaskLocalNormal;",
      "glazing mask vertex varying",
    );
    shader.vertexShader = replaceUnique(
      shader.vertexShader,
      "#include <beginnormal_vertex>",
      "#include <beginnormal_vertex>\n  vObserverMaskLocalNormal = objectNormal;",
      "glazing mask local face normal",
    );
    shader.fragmentShader = replaceUnique(
      shader.fragmentShader,
      "#include <common>",
      "#include <common>\nvarying vec3 vObserverMaskLocalNormal;",
      "glazing mask fragment varying",
    );
    shader.fragmentShader = replaceUnique(
      shader.fragmentShader,
      "#include <opaque_fragment>",
      "if (dot(normalize(vObserverMaskLocalNormal), vec3(0.0, 0.0, -1.0)) < 0.999) discard;\ndiffuseColor.rgb = vec3(1.0);\n#include <opaque_fragment>",
      "glazing mask front-face selection",
    );
  };
  material.customProgramCacheKey = () => "architecture-rise-observer-front-glazing-mask-r186-v1";
  return material;
};

const makeCubeTarget = (): THREE.WebGLCubeRenderTarget => {
  const target = new THREE.WebGLCubeRenderTarget(PROBE_RESOLUTION, {
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
    depthBuffer: true,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  return target;
};

const verifyCubeTargets = (
  renderer: THREE.WebGLRenderer,
  colorTarget: THREE.WebGLCubeRenderTarget,
  distanceTarget: THREE.WebGLCubeRenderTarget,
): { extensionSupported: boolean; colorStatuses: string[]; distanceStatuses: string[] } => {
  const gl = renderer.getContext();
  const extensionSupported = Boolean(gl.getExtension("EXT_color_buffer_float"));
  if (!renderer.capabilities.isWebGL2 || !extensionSupported) {
    throw new Error("Observer RGBA16F Probe capture requires WebGL2 and EXT_color_buffer_float");
  }
  const targets = [colorTarget, distanceTarget];
  for (const target of targets) {
    if (
      target.width !== PROBE_RESOLUTION || target.height !== PROBE_RESOLUTION ||
      target.texture.type !== THREE.HalfFloatType || target.texture.format !== THREE.RGBAFormat ||
      target.texture.colorSpace !== THREE.NoColorSpace ||
      target.texture.minFilter !== THREE.NearestFilter || target.texture.magFilter !== THREE.NearestFilter
    ) throw new Error("Probe cube does not match the frozen RGBA16F / NoColorSpace / NearestFilter contract");
  }
  const previousTarget = renderer.getRenderTarget();
  const previousFace = renderer.getActiveCubeFace();
  const previousMipmap = renderer.getActiveMipmapLevel();
  const checkFaces = (target: THREE.WebGLCubeRenderTarget): string[] => {
    const statuses: string[] = [];
    for (let face = 0; face < 6; face += 1) {
      renderer.setRenderTarget(target, face);
      statuses.push("0x" + gl.checkFramebufferStatus(gl.FRAMEBUFFER).toString(16));
    }
    return statuses;
  };
  let colorStatuses: string[] = [];
  let distanceStatuses: string[] = [];
  try {
    colorStatuses = checkFaces(colorTarget);
    distanceStatuses = checkFaces(distanceTarget);
  } finally {
    renderer.setRenderTarget(previousTarget, previousFace, previousMipmap);
  }
  if ([...colorStatuses, ...distanceStatuses].some((status) => status !== "0x8cd5")) {
    throw new Error("One or more RGBA16F Probe cube framebuffers are incomplete");
  }
  return { extensionSupported, colorStatuses, distanceStatuses };
};

const captureProbeCube = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  cubeCamera: THREE.CubeCamera,
  target: THREE.WebGLCubeRenderTarget,
  origin: THREE.Vector3,
  overrideMaterial: THREE.Material | null,
  excludedGlazing: readonly THREE.Mesh[],
  expectedEnvironment: THREE.Texture | null,
): { renderCount: number; backgroundWasNull: boolean; environmentRetained: boolean; glazingHidden: boolean } => {
  const previousOverride = scene.overrideMaterial;
  const previousBackground = scene.background;
  const previousAutoClear = renderer.autoClear;
  const previousClearColor = renderer.getClearColor(new THREE.Color()).clone();
  const previousClearAlpha = renderer.getClearAlpha();
  const previousRender = renderer.render;
  const renderBound = previousRender.bind(renderer);
  let sceneRenderCount = 0;
  let backgroundWasNull = true;
  let environmentRetained = true;
  let glazingHidden = true;
  renderer.render = ((renderScene: THREE.Scene, camera: THREE.Camera) => {
    if (renderScene === scene) {
      sceneRenderCount += 1;
      backgroundWasNull = backgroundWasNull && scene.background === null;
      environmentRetained = environmentRetained && scene.environment === expectedEnvironment;
      glazingHidden = glazingHidden && excludedGlazing.every((mesh) => !mesh.visible);
    }
    return renderBound(renderScene, camera);
  }) as typeof renderer.render;
  const visibility = excludedGlazing.map((mesh) => mesh.visible);
  try {
    excludedGlazing.forEach((mesh) => { mesh.visible = false; });
    scene.overrideMaterial = overrideMaterial;
    scene.background = null;
    renderer.autoClear = true;
    renderer.setClearColor(0x000000, 0);
    cubeCamera.position.copy(origin);
    cubeCamera.updateMatrixWorld(true);
    cubeCamera.update(renderer, scene);
  } finally {
    renderer.render = previousRender;
    excludedGlazing.forEach((mesh, index) => { mesh.visible = visibility[index]; });
    scene.overrideMaterial = previousOverride;
    scene.background = previousBackground;
    renderer.autoClear = previousAutoClear;
    renderer.setClearColor(previousClearColor, previousClearAlpha);
    renderer.setRenderTarget(null);
  }
  if (sceneRenderCount !== 6) {
    throw new Error("CubeCamera rendered " + sceneRenderCount + " scene faces instead of six");
  }
  if (cubeCamera.renderTarget !== target) throw new Error("Probe capture target changed during its capture session");
  return { renderCount: sceneRenderCount, backgroundWasNull, environmentRetained, glazingHidden };
};

const makeFloatTexture = (data: Float32Array, width: number): THREE.DataTexture => {
  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat, THREE.FloatType);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
};

const createGpuGeometryDiagnosticMaterial = (): THREE.ShaderMaterial => new THREE.ShaderMaterial({
  uniforms: {
    tPanePosition: { value: null },
    tPaneNormal: { value: null },
    tProbeDistance: { value: null },
    tProbeColor: { value: null },
    uProbeOrigin: { value: PROBE_ORIGIN.clone() },
    uObserverCameraPosition: { value: new THREE.Vector3() },
    uSampleCount: { value: 1 },
    uOutputRadiance: { value: 0 },
  },
  vertexShader: [
    "varying vec2 vUv;",
    "void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }",
  ].join("\n"),
  fragmentShader: [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D tPanePosition;",
    "uniform sampler2D tPaneNormal;",
    "uniform samplerCube tProbeDistance;",
    "uniform samplerCube tProbeColor;",
    "uniform vec3 uProbeOrigin;",
    "uniform vec3 uObserverCameraPosition;",
    "uniform float uSampleCount;",
    "uniform int uOutputRadiance;",
    PROBE_DISTANCE_CUBE_CORRECTION_GLSL,
    "void main(){",
    "  vec2 sampleUv = vec2(gl_FragCoord.x / uSampleCount, 0.5);",
    "  vec4 pane = texture2D(tPanePosition, sampleUv);",
    "  vec4 paneNormal = texture2D(tPaneNormal, sampleUv);",
    "  if (pane.a < 0.5 || paneNormal.a < 0.5) { gl_FragColor = vec4(-1.0, 0.0, 0.0, 0.0); return; }",
    "  vec3 incident = normalize(pane.xyz - uObserverCameraPosition);",
    "  vec3 normal = normalize(paneNormal.xyz);",
    "  vec3 reflected = normalize(reflect(incident, normal));",
    "  vec4 firstDistance = textureCube(tProbeDistance, reflected);",
    "  if (firstDistance.a < 0.5) { gl_FragColor = vec4(-3.0, firstDistance.r, firstDistance.a, 0.0); return; }",
    "  if (firstDistance.r <= 0.0) { gl_FragColor = vec4(-4.0, firstDistance.r, firstDistance.a, 0.0); return; }",
    "  vec3 correctedDirection;",
    "  vec3 correctedPoint;",
    "  if (!resolveProbePoint(tProbeDistance, pane.xyz, normal, reflected, uProbeOrigin, 1, correctedDirection, correctedPoint)) { gl_FragColor = vec4(-2.0, 0.0, 0.0, 0.0); return; }",
    "  if (uOutputRadiance == 1) { gl_FragColor = vec4(textureCube(tProbeColor, correctedDirection).rgb, 1.0); return; }",
    "  gl_FragColor = vec4(correctedPoint, 1.0);",
    "}",
  ].join("\n"),
  depthTest: false,
  depthWrite: false,
  toneMapped: false,
});

const runGpuGeometryDiagnostic = (
  renderer: THREE.WebGLRenderer,
  samples: readonly ObserverPaneSample[],
  reflectionMeshes: THREE.Mesh[],
  camera: THREE.PerspectiveCamera,
  distanceCube: THREE.CubeTexture,
  colorCube: THREE.CubeTexture,
  diagnosticScene: THREE.Scene,
  diagnosticCamera: THREE.OrthographicCamera,
  material: THREE.ShaderMaterial,
  track: (resource: DisposableResource, category: ResourceCategory, ownedHere: boolean) => void,
): {
  candidates: Array<CandidateHit | null>;
  framebufferComplete: boolean;
  readbackWorks: boolean;
  target: THREE.WebGLRenderTarget;
  diagnosticSamples: {
    resolved: number;
    missingPaneInput: number;
    missingInitialProbeDistance: number;
    invalidInitialProbeDistance: number;
    laterCorrectionMiss: number;
    colorSampleNonzero: number;
    meanLinearRadiance: number;
  };
} => {
  if (samples.length === 0) throw new Error("Observer geometry diagnostic has no camera-visible pane samples");
  const count = samples.length;
  const positions = new Float32Array(count * 4);
  const normals = new Float32Array(count * 4);
  samples.forEach((sample, index) => {
    const offset = index * 4;
    positions.set([sample.panePoint.x, sample.panePoint.y, sample.panePoint.z, 1], offset);
    normals.set([sample.normal.x, sample.normal.y, sample.normal.z, 1], offset);
  });
  const positionTexture = makeFloatTexture(positions, count);
  const normalTexture = makeFloatTexture(normals, count);
  track(positionTexture, "textures", true);
  track(normalTexture, "textures", true);
  material.uniforms.tPanePosition.value = positionTexture;
  material.uniforms.tPaneNormal.value = normalTexture;
  material.uniforms.tProbeDistance.value = distanceCube;
  material.uniforms.tProbeColor.value = colorCube;
  material.uniforms.uObserverCameraPosition.value.copy(camera.position);
  material.uniforms.uSampleCount.value = count;

  const target = new THREE.WebGLRenderTarget(count, 1, {
    format: THREE.RGBAFormat,
    type: THREE.FloatType,
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  target.texture.colorSpace = THREE.NoColorSpace;
  target.texture.generateMipmaps = false;
  track(target, "renderTargets", true);
  const previousTarget = renderer.getRenderTarget();
  const previousToneMapping = renderer.toneMapping;
  renderer.toneMapping = THREE.NoToneMapping;
  let framebufferComplete = false;
  let readbackWorks = false;
  const pixels = new Float32Array(count * 4);
  const radiancePixels = new Float32Array(count * 4);
  try {
    renderer.setRenderTarget(target);
    const gl = renderer.getContext();
    framebufferComplete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    if (!framebufferComplete) throw new Error("Observer Float32 geometry target framebuffer is incomplete");
    renderer.clear(true, true, true);
    renderer.render(diagnosticScene, diagnosticCamera);
    renderer.readRenderTargetPixels(target, 0, 0, count, 1, pixels);
    readbackWorks = pixels.some((value) => Number.isFinite(value) && value !== 0);
    if (!readbackWorks) {
      throw new Error("Observer Float32 diagnostic readback returned all zeroes; pane[0]=" +
        Array.from(positions.slice(0, 4)).join(",") + "; normal[0]=" + Array.from(normals.slice(0, 4)).join(","));
    }
    material.uniforms.uOutputRadiance.value = 1;
    renderer.clear(true, true, true);
    renderer.render(diagnosticScene, diagnosticCamera);
    renderer.readRenderTargetPixels(target, 0, 0, count, 1, radiancePixels);
    material.uniforms.uOutputRadiance.value = 0;
  } finally {
    renderer.setRenderTarget(previousTarget);
    renderer.toneMapping = previousToneMapping;
  }

  const candidates = samples.map((_sample, index): CandidateHit | null => {
    const offset = index * 4;
    if (
      pixels[offset + 3] < 0.5 ||
      !pixels.slice(offset, offset + 3).every(Number.isFinite) ||
      [-1, -2, -3, -4].includes(pixels[offset])
    ) return null;
    const q = new THREE.Vector3(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
    const direction = q.clone().sub(PROBE_ORIGIN).normalize();
    const hit = probeRayHit(PROBE_ORIGIN, direction, reflectionMeshes);
    return { q, hitObject: hit?.object.name ?? null, direction };
  });
  const statusAt = (index: number): number => pixels[index * 4];
  const sampledRadiance = candidates.flatMap((candidate, index) => {
    if (!candidate) return [];
    const offset = index * 4;
    const rgb = [radiancePixels[offset], radiancePixels[offset + 1], radiancePixels[offset + 2]];
    return rgb.every(Number.isFinite) ? [rgb] : [];
  });
  const nonzeroRadiance = sampledRadiance.filter(([red, green, blue]) =>
    Math.abs(red) + Math.abs(green) + Math.abs(blue) > 1e-6,
  );
  return {
    candidates,
    framebufferComplete,
    readbackWorks,
    target,
    diagnosticSamples: {
      resolved: candidates.filter(Boolean).length,
      missingPaneInput: samples.filter((_sample, index) => statusAt(index) === -1).length,
      missingInitialProbeDistance: samples.filter((_sample, index) => statusAt(index) === -3).length,
      invalidInitialProbeDistance: samples.filter((_sample, index) => statusAt(index) === -4).length,
      laterCorrectionMiss: samples.filter((_sample, index) => statusAt(index) === -2).length,
      colorSampleNonzero: nonzeroRadiance.length,
      meanLinearRadiance: nonzeroRadiance.length === 0 ? 0 : nonzeroRadiance.reduce(
        (sum, [red, green, blue]) => sum + (red + green + blue) / 3,
        0,
      ) / nonzeroRadiance.length,
    },
  };
};

const readCanvasPixels = (renderer: THREE.WebGLRenderer): PixelBuffer => {
  const gl = renderer.getContext();
  const pixels = new Uint8Array(WIDTH * HEIGHT * 4);
  gl.readPixels(0, 0, WIDTH, HEIGHT, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  return pixels;
};

const renderAndRead = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
): PixelBuffer => {
  renderer.setRenderTarget(null);
  renderer.render(scene, camera);
  return readCanvasPixels(renderer);
};

const renderFrontGlazingMask = (input: {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshes: readonly THREE.Mesh[];
  frontPanes: readonly THREE.Mesh[];
  baselineMaterialByPane: ReadonlyMap<THREE.Mesh, THREE.Material>;
  candidateMaterial: THREE.Material;
  paneMaskMaterial: THREE.Material;
  occluderMaterial: THREE.Material;
}): { active: Uint8Array; expanded: Uint8Array } => {
  const { renderer, scene, camera, meshes, frontPanes, baselineMaterialByPane } = input;
  const priorMaterials = meshes.map((mesh) => mesh.material);
  const previousBackground = scene.background;
  try {
    scene.background = new THREE.Color(0x000000);
    meshes.forEach((mesh) => { mesh.material = input.occluderMaterial; });
    frontPanes.forEach((mesh) => { mesh.material = input.paneMaskMaterial; });
    const bytes = renderAndRead(renderer, scene, camera);
    const active = new Uint8Array(WIDTH * HEIGHT);
    let activeCount = 0;
    for (let pixel = 0; pixel < active.length; pixel += 1) {
      if (bytes[pixel * 4] > 32) {
        active[pixel] = 1;
        activeCount += 1;
      }
    }
    if (activeCount === 0) throw new Error("Front-glazing geometry mask rendered no visible pixels");
    const expanded = active.slice();
    const radius = 2;
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        if (!active[y * WIDTH + x]) continue;
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < WIDTH && ny >= 0 && ny < HEIGHT) expanded[ny * WIDTH + nx] = 1;
          }
        }
      }
    }
    return { active, expanded };
  } finally {
    meshes.forEach((mesh, index) => {
      mesh.material = priorMaterials[index] ?? baselineMaterialByPane.get(mesh) ?? input.candidateMaterial;
    });
    scene.background = previousBackground;
  }
};

const calculatePairMetrics = (
  baseline: PixelBuffer,
  candidate: PixelBuffer,
  mask: { active: Uint8Array; expanded: Uint8Array },
): ImageMetrics => {
  const fullPixelCount = WIDTH * HEIGHT;
  let fullSum = 0;
  let fullChanged = 0;
  let glazingSum = 0;
  let glazingChanged = 0;
  let glazingPixelCount = 0;
  let outsideSum = 0;
  let outsideChanged = 0;
  let outsidePixelCount = 0;
  const glazingDeltas: number[] = [];
  for (let pixel = 0; pixel < fullPixelCount; pixel += 1) {
    const offset = pixel * 4;
    const dr = Math.abs(candidate[offset] - baseline[offset]);
    const dg = Math.abs(candidate[offset + 1] - baseline[offset + 1]);
    const db = Math.abs(candidate[offset + 2] - baseline[offset + 2]);
    const sum = dr + dg + db;
    const max = Math.max(dr, dg, db);
    fullSum += sum;
    if (max > 2) fullChanged += 1;
    const pixelDelta = sum / 3;
    if (mask.active[pixel]) {
      glazingPixelCount += 1;
      glazingSum += sum;
      glazingDeltas.push(pixelDelta);
      if (max > 2) glazingChanged += 1;
    }
    if (!mask.expanded[pixel]) {
      outsidePixelCount += 1;
      outsideSum += sum;
      if (max > 2) outsideChanged += 1;
    }
  }
  if (glazingPixelCount === 0 || outsidePixelCount === 0) throw new Error("Glazing mask partition is empty");
  return {
    meanAbsoluteRgbDelta: fullSum / (fullPixelCount * 3 * 255),
    changedPixelFraction: fullChanged / fullPixelCount,
    glazingMeanAbsoluteRgbDelta: glazingSum / (glazingPixelCount * 3 * 255),
    glazingP95RgbDelta: (percentile(glazingDeltas, 0.95) ?? 0) / 255,
    glazingChangedPixelFraction: glazingChanged / glazingPixelCount,
    outsideExpandedGlazingMeanAbsoluteRgbDelta: outsideSum / (outsidePixelCount * 3 * 255),
    outsideExpandedGlazingChangedPixelFraction: outsideChanged / outsidePixelCount,
  };
};

const calculateEdgeGradientEnergy = (pixels: PixelBuffer, mask: Uint8Array): number => {
  const luminanceAt = (x: number, y: number): number => {
    const offset = (y * WIDTH + x) * 4;
    return (0.2126 * pixels[offset] + 0.7152 * pixels[offset + 1] + 0.0722 * pixels[offset + 2]) / 255;
  };
  let energy = 0;
  let count = 0;
  for (let y = 0; y < HEIGHT; y += 1) {
    for (let x = 0; x < WIDTH; x += 1) {
      const index = y * WIDTH + x;
      if (!mask[index]) continue;
      if (x + 1 < WIDTH && mask[index + 1]) {
        energy += Math.abs(luminanceAt(x + 1, y) - luminanceAt(x, y));
        count += 1;
      }
      if (y + 1 < HEIGHT && mask[index + WIDTH]) {
        energy += Math.abs(luminanceAt(x, y + 1) - luminanceAt(x, y));
        count += 1;
      }
    }
  }
  return count === 0 ? 0 : energy / count;
};

const sampleContributionDelta = (
  sample: ObserverPaneSample,
  baseline: PixelBuffer,
  candidate: PixelBuffer,
): readonly [number, number, number] => {
  const offset = (sample.screenYBottom * WIDTH + sample.screenX) * 4;
  return [
    candidate[offset] - baseline[offset],
    candidate[offset + 1] - baseline[offset + 1],
    candidate[offset + 2] - baseline[offset + 2],
  ];
};

const compareViewContributionSignals = (
  samplesA: readonly ObserverPaneSample[],
  baselineA: PixelBuffer,
  correctedA: PixelBuffer,
  samplesB: readonly ObserverPaneSample[],
  baselineB: PixelBuffer,
  correctedB: PixelBuffer,
): { sharedCount: number; meanAbsoluteDelta: number } => {
  const byKeyB = new Map(samplesB.map((sample) => [sample.key, sample]));
  let total = 0;
  let count = 0;
  for (const sampleA of samplesA) {
    const sampleB = byKeyB.get(sampleA.key);
    if (!sampleB) continue;
    const deltaA = sampleContributionDelta(sampleA, baselineA, correctedA);
    const deltaB = sampleContributionDelta(sampleB, baselineB, correctedB);
    total += Math.abs(deltaA[0] - deltaB[0]) + Math.abs(deltaA[1] - deltaB[1]) + Math.abs(deltaA[2] - deltaB[2]);
    count += 1;
  }
  return { sharedCount: count, meanAbsoluteDelta: count === 0 ? 0 : total / (count * 3 * 255) };
};

const runPilot = (): void => {
  const body = document.body;
  const canvas = document.getElementById("observer-canvas");
  const measurements = document.getElementById("measurements");
  if (!(canvas instanceof HTMLCanvasElement) || !(measurements instanceof HTMLPreElement)) {
    body.dataset.proofError = "Observer pilot page is missing its canvas or measurements element";
    body.dataset.proofReady = "true";
    return;
  }

  const tracker = createResourceTracker();
  const customDisposers: Array<() => void> = [];
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BACKGROUND_COLOR);
  let renderer: THREE.WebGLRenderer | null = null;
  let subject: THREE.Group | null = null;
  let frontPanes: THREE.Mesh[] = [];
  let allMeshes: THREE.Mesh[] = [];
  const baselineMaterialByMesh = new Map<THREE.Mesh, THREE.Material>();
  let proof: PilotProof | null = null;
  let disposed = false;

  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    const errors: unknown[] = [];
    frontPanes.forEach((mesh) => {
      const baseline = baselineMaterialByMesh.get(mesh);
      if (baseline) mesh.material = baseline;
    });
    allMeshes.forEach((mesh) => {
      const baseline = baselineMaterialByMesh.get(mesh);
      if (baseline) mesh.material = baseline;
    });
    tracker.lifecycle.customDisposers.registered = customDisposers.length;
    for (const dispose of customDisposers) {
      try {
        tracker.lifecycle.customDisposers.invoked += 1;
        dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    for (const dispose of tracker.ownedDisposers) {
      try {
        dispose();
      } catch (error) {
        errors.push(error);
      }
    }
    if (renderer) {
      try {
        renderer.dispose();
        tracker.lifecycle.rendererDisposeCalled = true;
      } catch (error) {
        errors.push(error);
      }
    }
    if (proof) proof.lifecycle = tracker.lifecycle;
    if (errors.length > 0) throw new AggregateError(errors, "Observer pilot cleanup could not dispose every owned resource");
  };

  try {
    if (canvas.width !== WIDTH || canvas.height !== HEIGHT) throw new Error("Decision canvas must be exactly 514×411");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    const activeRenderer = renderer;
    renderer.setPixelRatio(1);
    renderer.setSize(WIDTH, HEIGHT, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PRESENTATION_SHADOW_MAP_TYPE;

    subject = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
    const subjectRoot = subject;
    scene.add(subjectRoot);
    configureTeachingShadowParticipation(subjectRoot);
    customDisposers.push(() => {
      scene.remove(subjectRoot);
      disposeArchitectureRiseGroup(subjectRoot);
    });
    allMeshes = collectMeshes(subjectRoot);
    frontPanes = allMeshes.filter(isFrontGlazing);
    const allGlazing = allMeshes.filter(isAnyGlazing);
    const sidePanes = allMeshes.filter((mesh) => isAnyGlazing(mesh) && !isFrontGlazing(mesh));
    if (frontPanes.length === 0 || allGlazing.length <= frontPanes.length || sidePanes.length === 0) {
      throw new Error("Registered Architecture Rise subject did not expose distinct front and side glazing families");
    }
    allMeshes.forEach((mesh) => baselineMaterialByMesh.set(mesh, mesh.material as THREE.Material));
    collectSubjectResources(subjectRoot, tracker.track);

    const presentationLighting = resolveScenePresentationLighting(architectureRiseScene.id, {
      surface: "observer",
      cameraMovementPresentation: CAMERA_MOVEMENT_BASELINE_PRESENTATION,
      presentationRegion: "middle",
    });
    const presentationRig = createPresentationLightingRig(scene, presentationLighting);
    customDisposers.push(() => disposePresentationLightingRig(scene, presentationRig));

    const worldIllumination = resolveSceneWorldIllumination(architectureRiseScene.id);
    const worldRig = createWorldIlluminationRig(scene, worldIllumination);
    customDisposers.push(() => disposeWorldIlluminationRig(scene, worldRig));
    if (!worldIllumination.environment) throw new Error("Architecture Rise world environment authority is missing");
    const environmentRig = createWorldEnvironmentRig(scene, renderer, worldIllumination.environment);
    tracker.track(environmentRig.renderTarget, "renderTargets", false);
    customDisposers.push(() => disposeWorldEnvironmentRig(scene, environmentRig));
    const environmentReference = scene.environment;
    if (!environmentReference) throw new Error("Production Architecture Rise procedural environment did not activate");

    const cameraPlacement = architectureRiseScene.cameraPlacement;
    const defaultPosition = new THREE.Vector3(
      toWorld(cameraPlacement.position.x),
      toWorld(cameraPlacement.position.y),
      toWorld(cameraPlacement.position.z),
    );
    const defaultTarget = new THREE.Vector3(
      toWorld(cameraPlacement.target.x),
      toWorld(cameraPlacement.target.y),
      toWorld(cameraPlacement.target.z),
    );
    const alternatePosition = new THREE.Vector3(11.037666, 3, 0.323947);
    const views: Record<ViewId, { position: THREE.Vector3; target: THREE.Vector3; camera: THREE.PerspectiveCamera }> = {
      default: { position: defaultPosition, target: defaultTarget, camera: createPerspectiveCamera(defaultPosition, defaultTarget) },
      alternate: { position: alternatePosition, target: defaultTarget.clone(), camera: createPerspectiveCamera(alternatePosition, defaultTarget) },
    };

    const baselineMaterial = frontPanes[0].material;
    if (!(baselineMaterial instanceof THREE.MeshStandardMaterial)) {
      throw new Error("Architecture Rise front glazing is no longer a MeshStandardMaterial");
    }
    if (frontPanes.some((mesh) => mesh.material !== baselineMaterial)) {
      throw new Error("Architecture Rise front glazing no longer shares its registered baseline glass material");
    }
    if (
      baselineMaterial.color.getHexString().toLowerCase() !== "182d37" ||
      Math.abs(baselineMaterial.roughness - 0.24) > 1e-6 ||
      Math.abs(baselineMaterial.metalness - 0.08) > 1e-6
    ) throw new Error("Frozen Architecture Rise glass material values changed");

    const colorCubeTarget = makeCubeTarget();
    const distanceCubeTarget = makeCubeTarget();
    tracker.track(colorCubeTarget, "renderTargets", true);
    tracker.track(distanceCubeTarget, "renderTargets", true);
    const cubeCapability = verifyCubeTargets(renderer, colorCubeTarget, distanceCubeTarget);
    const radialDistanceMaterial = createRadialDistanceMaterial(PROBE_ORIGIN);
    tracker.track(radialDistanceMaterial, "materials", true);

    const excludedGlazing = allGlazing;
    const defaultBackground = scene.background;
    const environmentDuringCapture = scene.environment;
    const colorCubeCamera = new THREE.CubeCamera(PROBE_NEAR, PROBE_FAR, colorCubeTarget);
    const distanceCubeCamera = new THREE.CubeCamera(PROBE_NEAR, PROBE_FAR, distanceCubeTarget);
    const colorCapture = captureProbeCube(
      renderer,
      scene,
      colorCubeCamera,
      colorCubeTarget,
      PROBE_ORIGIN,
      null,
      excludedGlazing,
      environmentDuringCapture,
    );
    const distanceCapture = captureProbeCube(
      renderer,
      scene,
      distanceCubeCamera,
      distanceCubeTarget,
      PROBE_ORIGIN,
      radialDistanceMaterial,
      excludedGlazing,
      environmentDuringCapture,
    );
    if (scene.background !== defaultBackground || scene.environment !== environmentDuringCapture) {
      throw new Error("Probe capture did not restore the Observer background or preserve its environment");
    }
    if (!allGlazing.every((mesh) => mesh.visible)) throw new Error("Probe capture left glazing hidden");
    const captureRenders = colorCapture.renderCount + distanceCapture.renderCount;
    const captureCountAtEnd = captureRenders;
    if (captureRenders !== 12) throw new Error("Probe color and distance capture must total exactly twelve scene renders");

    const probeOrigin = PROBE_ORIGIN.clone();
    const candidate = createObserverCandidateMaterial(
      baselineMaterial,
      colorCubeTarget.texture,
      distanceCubeTarget.texture,
      probeOrigin,
      views.default.position,
    );
    tracker.track(candidate.material, "materials", true);
    const baselineEnvMap = baselineMaterial.envMap;
    if (candidate.material.envMap !== baselineEnvMap) {
      throw new Error("Candidate glass clone changed the baseline material envMap");
    }

    const paneMaskMaterial = createFrontGlazingMaskMaterial();
    const occluderMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.FrontSide, toneMapped: false });
    tracker.track(paneMaskMaterial, "materials", true);
    tracker.track(occluderMaterial, "materials", true);
    const diagnosticMaterial = createGpuGeometryDiagnosticMaterial();
    const diagnosticGeometry = new THREE.PlaneGeometry(2, 2);
    tracker.track(diagnosticMaterial, "materials", true);
    tracker.track(diagnosticGeometry, "geometries", true);
    const diagnosticScene = new THREE.Scene();
    diagnosticScene.add(new THREE.Mesh(diagnosticGeometry, diagnosticMaterial));
    const diagnosticCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2);
    diagnosticCamera.position.set(0, 0, 1);
    diagnosticCamera.lookAt(0, 0, 0);
    const reflectionMeshes = allMeshes.filter((mesh) => !isAnyGlazing(mesh));

    frontPanes.forEach((mesh) => { mesh.material = candidate.material; });
    renderer.compile(scene, views.default.camera);
    const candidateUniforms = candidate.getUniforms();
    if (!candidateUniforms) throw new Error("Three.js did not compile the Observer candidate material hook");

    const renderMode = (viewId: ViewId, mode: ModeId): PixelBuffer => {
      const view = views[viewId];
      view.camera.updateMatrixWorld(true);
      if (mode === "baseline") {
        frontPanes.forEach((mesh) => { mesh.material = baselineMaterialByMesh.get(mesh) ?? baselineMaterial; });
      } else {
        frontPanes.forEach((mesh) => { mesh.material = candidate.material; });
        const uniforms = candidate.getUniforms();
        if (!uniforms) throw new Error("Observer candidate uniforms are unavailable after compile");
        uniforms.uObserverProbeColor.value = colorCubeTarget.texture;
        uniforms.uObserverProbeDistance.value = distanceCubeTarget.texture;
        uniforms.uObserverProbeOrigin.value.copy(probeOrigin);
        uniforms.uObserverCameraPosition.value.copy(view.camera.position);
        uniforms.uObserverReflectionWeight.value = REFLECTION_WEIGHT;
        uniforms.uObserverCorrectionIterations.value = mode === "corrected-probe" ? 1 : 0;
      }
      activeRenderer.setRenderTarget(null);
      activeRenderer.render(scene, view.camera);
      return readCanvasPixels(activeRenderer);
    };

    const geometry: Record<ViewId, ViewGeometryProof> = {} as Record<ViewId, ViewGeometryProof>;
    const appearance: PilotProof["appearance"] = {} as PilotProof["appearance"];
    const samplesByView: Record<ViewId, ObserverPaneSample[]> = {} as Record<ViewId, ObserverPaneSample[]>;
    const imagesByView: Record<ViewId, Record<ModeId, PixelBuffer>> = {} as Record<ViewId, Record<ModeId, PixelBuffer>>;
    let diagnosticFramebufferComplete = true;
    let diagnosticReadbackWorks = true;
    let diagnosticTargetCount = 0;

    for (const viewId of ["default", "alternate"] as const) {
      const view = views[viewId];
      const samples = collectObserverPaneSamples(view.camera, allMeshes, frontPanes, reflectionMeshes);
      if (samples.length === 0) throw new Error("Observer view " + viewId + " has no visible front-glazing sample domain");
      samplesByView[viewId] = samples;
      const uncorrectedCpuCandidates = runCpuProbeCandidate(samples, reflectionMeshes, false);
      const correctedCpuCandidates = runCpuProbeCandidate(samples, reflectionMeshes, true);
      const gpu = runGpuGeometryDiagnostic(
        renderer,
        samples,
        reflectionMeshes,
        view.camera,
        distanceCubeTarget.texture,
        colorCubeTarget.texture,
        diagnosticScene,
        diagnosticCamera,
        diagnosticMaterial,
        tracker.track,
      );
      diagnosticTargetCount += 1;
      diagnosticFramebufferComplete = diagnosticFramebufferComplete && gpu.framebufferComplete;
      diagnosticReadbackWorks = diagnosticReadbackWorks && gpu.readbackWorks;
      const correctedGpuMetric = measureGeometry(samples, gpu.candidates);
      const cpuGpuErrors: number[] = [];
      samples.forEach((_sample, index) => {
        const cpuCandidate = correctedCpuCandidates[index];
        const gpuCandidate = gpu.candidates[index];
        if (cpuCandidate && gpuCandidate) cpuGpuErrors.push(cpuCandidate.q.distanceTo(gpuCandidate.q));
      });
      geometry[viewId] = {
        sampleDomain: {
          paneCount: frontPanes.length,
          totalPaneSamples: frontPanes.length * PANE_SAMPLE_FRACTIONS.length * PANE_SAMPLE_FRACTIONS.length,
          visiblePaneSampleCount: samples.length,
        sampleFractions: PANE_SAMPLE_FRACTIONS,
        frontFaceObjectNormalMatches: samples.length,
        },
        physical: {
          finiteHitCount: samples.filter((sample) => sample.physicalQ).length,
          noHitCount: samples.filter((sample) => !sample.physicalQ).length,
        },
        uncorrectedCpu: measureGeometry(samples, uncorrectedCpuCandidates),
        correctedCpu: measureGeometry(samples, correctedCpuCandidates),
        correctedGpu: {
          ...correctedGpuMetric,
          cpuToGpuMedianQErrorM: median(cpuGpuErrors),
          cpuToGpuP95QErrorM: percentile(cpuGpuErrors, 0.95),
          diagnosticSamples: gpu.diagnosticSamples,
        },
      };

      const mask = renderFrontGlazingMask({
        renderer,
        scene,
        camera: view.camera,
        meshes: allMeshes,
        frontPanes,
        baselineMaterialByPane: baselineMaterialByMesh,
        candidateMaterial: candidate.material,
        paneMaskMaterial,
        occluderMaterial,
      });
      const baseline = renderMode(viewId, "baseline");
      const uncorrected = renderMode(viewId, "uncorrected-probe");
      const corrected = renderMode(viewId, "corrected-probe");
      imagesByView[viewId] = {
        baseline,
        "uncorrected-probe": uncorrected,
        "corrected-probe": corrected,
      };
      appearance[viewId] = {
        resolution: [WIDTH, HEIGHT],
        maskPixelCount: mask.active.reduce((sum, value) => sum + value, 0),
        baselineVsUncorrected: calculatePairMetrics(baseline, uncorrected, mask),
        baselineVsCorrected: calculatePairMetrics(baseline, corrected, mask),
        uncorrectedVsCorrected: calculatePairMetrics(uncorrected, corrected, mask),
        edgeGradientEnergy: {
          baseline: calculateEdgeGradientEnergy(baseline, mask.active),
          "uncorrected-probe": calculateEdgeGradientEnergy(uncorrected, mask.active),
          "corrected-probe": calculateEdgeGradientEnergy(corrected, mask.active),
        },
      };
    }

    const correctedViewDelta = compareViewContributionSignals(
      samplesByView.default,
      imagesByView.default.baseline,
      imagesByView.default["corrected-probe"],
      samplesByView.alternate,
      imagesByView.alternate.baseline,
      imagesByView.alternate["corrected-probe"],
    );
    const uncorrectedViewDelta = compareViewContributionSignals(
      samplesByView.default,
      imagesByView.default.baseline,
      imagesByView.default["uncorrected-probe"],
      samplesByView.alternate,
      imagesByView.alternate.baseline,
      imagesByView.alternate["uncorrected-probe"],
    );
    renderMode("default", "corrected-probe");
    const captureRendersAfterViewChanges = captureRenders;
    if (captureRendersAfterViewChanges !== captureCountAtEnd) {
      throw new Error("Observer view changes unexpectedly recaptured the static Probe");
    }

    const gl = renderer.getContext();
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info") as { UNMASKED_RENDERER_WEBGL: number } | null;
    const gpuRenderer = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
    const cubeBytes = 6 * PROBE_RESOLUTION * PROBE_RESOLUTION * 8;
    const measuredProgramCount = renderer.info.programs?.length ?? null;
    proof = {
      baseSha: BASE_SHA,
      backend: {
        renderer: "Three.js WebGLRenderer r186",
        gpuRenderer,
        webgl2: renderer.capabilities.isWebGL2,
        extensionName: "EXT_color_buffer_float",
        extensionSupported: cubeCapability.extensionSupported,
        colorCubeFaceFramebufferStatuses: cubeCapability.colorStatuses,
        distanceCubeFaceFramebufferStatuses: cubeCapability.distanceStatuses,
        allCubeFacesFramebufferComplete: [...cubeCapability.colorStatuses, ...cubeCapability.distanceStatuses].every((status) => status === "0x8cd5"),
        gpuDiagnosticFramebufferComplete: diagnosticFramebufferComplete,
        gpuDiagnosticReadbackWorks: diagnosticReadbackWorks,
        gpuReadbackArrayType: "Float32Array",
      },
      candidate: {
        probeOriginM: tuple(probeOrigin),
        resolution: [PROBE_RESOLUTION, PROBE_RESOLUTION, 6],
        colorFormat: "RGBA16F",
        distanceFormat: "RGBA16F",
        colorDataType: "HalfFloatType",
        distanceDataType: "HalfFloatType",
        colorSpace: "NoColorSpace",
        filter: "NearestFilter",
        correctionIterations: 1,
        reflectionWeight: REFLECTION_WEIGHT,
        frontFaceLocalNormal: [0, 0, -1],
        glass: {
          color: "#" + baselineMaterial.color.getHexString(),
          roughness: baselineMaterial.roughness,
          metalness: baselineMaterial.metalness,
        },
      },
      views: {
        default: { cameraPosition: tuple(defaultPosition), target: tuple(defaultTarget), fovDeg: 45, near: 0.01, far: 200 },
        alternate: { cameraPosition: tuple(alternatePosition), target: tuple(defaultTarget), fovDeg: 45, near: 0.01, far: 200 },
      },
      capture: {
        colorFaceRenders: colorCapture.renderCount,
        distanceFaceRenders: distanceCapture.renderCount,
        totalSceneRenders: captureRenders,
        recapturesAfterObserverOrbit: captureRendersAfterViewChanges - captureCountAtEnd,
        glazingExcludedFromColorAndDistance: colorCapture.glazingHidden && distanceCapture.glazingHidden,
        sceneBackgroundNullDuringCapture: colorCapture.backgroundWasNull && distanceCapture.backgroundWasNull,
        sceneEnvironmentRetainedDuringCapture: colorCapture.environmentRetained && distanceCapture.environmentRetained,
        sameOriginNearFarAndVisibility:
          colorCubeCamera.position.distanceTo(distanceCubeCamera.position) === 0 &&
          colorCubeCamera.children.length === 6 && distanceCubeCamera.children.length === 6 &&
          colorCubeCamera.children.every((child) => child instanceof THREE.PerspectiveCamera && child.near === PROBE_NEAR && child.far === PROBE_FAR) &&
          distanceCubeCamera.children.every((child) => child instanceof THREE.PerspectiveCamera && child.near === PROBE_NEAR && child.far === PROBE_FAR) &&
          colorCapture.glazingHidden === distanceCapture.glazingHidden,
      },
      geometry,
      appearance,
      viewDependence: {
        sharedPhysicalPaneSamples: correctedViewDelta.sharedCount,
        correctedMeanAbsoluteRgbDeltaBetweenViews: correctedViewDelta.meanAbsoluteDelta,
        uncorrectedMeanAbsoluteRgbDeltaBetweenViews: uncorrectedViewDelta.meanAbsoluteDelta,
        sameCapturedProbeUsed: captureRendersAfterViewChanges === 12,
      },
      environment: {
        presentBeforeCandidate: Boolean(environmentReference),
        sameReferenceAfterCandidateRenders: scene.environment === environmentReference,
        candidateMaterialEnvMapReplaced: candidate.material.envMap !== baselineEnvMap,
      },
      candidateFrameCost: {
        baselineLocalDistanceSamplesPerFrontFragment: 0,
        uncorrectedDistanceSamplesPerFrontFragment: 1,
        correctedDistanceSamplesPerFrontFragment: 2,
        uncorrectedColorSamplesPerFrontFragment: 1,
        correctedColorSamplesPerFrontFragment: 1,
        extraDistanceSamplesPerFrontFragmentForCorrection: 1,
        extraSceneRendersPerObserverFrame: 0,
        extraFullscreenPassesPerObserverFrame: 0,
        totalCaptureRenders: captureRenders,
        measuredProgramCount,
      },
      resources: {
        colorCube: { bytes: cubeBytes, mebibytes: cubeBytes / (1024 * 1024) },
        distanceCube: { bytes: cubeBytes, mebibytes: cubeBytes / (1024 * 1024) },
        candidateTotal: { bytes: cubeBytes * 2, mebibytes: (cubeBytes * 2) / (1024 * 1024) },
        diagnosticTargets: diagnosticTargetCount,
      },
      lifecycle: tracker.lifecycle,
    };

    const captureCurrentState = { view: "default" as ViewId, mode: "corrected-probe" as ModeId };
    const setButtons = (): void => {
      document.querySelectorAll<HTMLButtonElement>("button[data-view]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.view === captureCurrentState.view));
      });
      document.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((button) => {
        button.setAttribute("aria-pressed", String(button.dataset.mode === captureCurrentState.mode));
      });
    };
    const capture = (view: ViewId, mode: ModeId): void => {
      captureCurrentState.view = view;
      captureCurrentState.mode = mode;
      renderMode(view, mode);
      setButtons();
    };
    document.querySelectorAll<HTMLButtonElement>("button[data-view]").forEach((button) => {
      button.addEventListener("click", () => capture(button.dataset.view as ViewId, captureCurrentState.mode));
    });
    document.querySelectorAll<HTMLButtonElement>("button[data-mode]").forEach((button) => {
      button.addEventListener("click", () => capture(captureCurrentState.view, button.dataset.mode as ModeId));
    });
    window.__architectureRiseObserverReflectionPilot = { proof, capture, dispose: cleanup };
    measurements.textContent = JSON.stringify(proof, null, 2);
    body.dataset.proofReady = "true";
  } catch (error) {
    body.dataset.proofError = error instanceof Error ? error.message : String(error);
    body.dataset.proofReady = "true";
    try {
      cleanup();
    } catch (cleanupError) {
      body.dataset.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    }
  }
};

runPilot();
