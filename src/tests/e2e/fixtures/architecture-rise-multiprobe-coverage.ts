import * as THREE from "three";
import { architectureRiseScene } from "../../../scenes/definitions/architecture-rise";
import { ARCHITECTURE_RISE_PRESENTATION } from "../../../scenes/presentation/architectureRise";
import {
  createArchitectureRiseGroup,
  disposeArchitectureRiseGroup,
} from "../../../render/ArchitectureRiseSubjectFactory";
import { toWorld } from "../../../render/rttUtils";
import {
  correctProbeDirectionFromRadialHit,
} from "./probe-distance-cube-correction";
import {
  selectRuntimeProbeByPaneRay,
  type RuntimeProbeCandidate,
} from "./multi-probe-runtime-selector";

const BASE_SHA = "635fd868063759e61c284046d0bac0515ee82632";
const PROBE_A_ORIGIN = new THREE.Vector3(-1.2725, 1.5, 6.972);
const PROBE_FAR = 100;
const PROBE_NEAR = 0.05;
const CLEARANCE_M = PROBE_NEAR * 1.25;
const FRONT_PANE_PREFIX = "architecture-rise-facade-window-bay-";
const SAMPLE_FRACTIONS = [0.1, 0.3, 0.7, 0.9] as const;
const WIDTH = 514;
const HEIGHT = 411;
const PROBE_A_ID = "probe-a-pr-s-r";
const DUPLICATE_ORIGIN_TOLERANCE_M = 0.1;
const GRID_SIZE = { x: 5, y: 4, z: 4 } as const;

type ViewId = "A" | "B" | "C";
type Vec3Tuple = readonly [number, number, number];
type AxisBounds = Readonly<{ min: number; max: number }>;

type ObserverPaneSample = {
  key: string;
  pane: string;
  row: number;
  column: number;
  u: number;
  v: number;
  panePoint: THREE.Vector3;
  normal: THREE.Vector3;
  reflectedDirection: THREE.Vector3;
  physicalQ: THREE.Vector3 | null;
  physicalHitObject: string | null;
};

type ProbeCandidateHit = RuntimeProbeCandidate & {
  hitObject: string;
  direction: THREE.Vector3;
  runtimeResidualM: number;
  correctionDirectionChangeDeg: number;
  finalRadialDistanceM: number;
};

type GeometryMetrics = {
  sampleCount: number;
  physicalFiniteHitCount: number;
  physicalNoHitCount: number;
  candidateValidCount: number;
  candidateNoHitCount: number;
  sameObjectHitCount: number;
  wrongObjectCount: number;
  falsePositiveCount: number;
  falseNegativeCount: number;
  sameObjectCoverage: number | null;
  falsePositiveRate: number | null;
  falseNegativeRate: number | null;
  wrongObjectRate: number | null;
  medianQErrorM: number | null;
  p95QErrorM: number | null;
  medianAngularErrorDeg: number | null;
  p95AngularErrorDeg: number | null;
};

type ObserverView = {
  id: ViewId;
  position: THREE.Vector3;
  target: THREE.Vector3;
  camera: THREE.PerspectiveCamera;
};

type OriginCandidate = {
  id: string;
  gridIndex: number;
  origin: THREE.Vector3;
};

type ViewData = {
  id: ViewId;
  samples: ObserverPaneSample[];
  candidatesByProbeId: Map<string, Array<ProbeCandidateHit | null>>;
};

type SelectionDiagnostics = {
  validCandidateOverlap: Record<string, number>;
  selectedByProbe: Record<string, { count: number; fraction: number }>;
  multiValidSampleCount: number;
  multiValidSameObjectCount: number;
  multiValidSameObjectRate: number | null;
  selectedResidualMedianM: number | null;
  selectedResidualP95M: number | null;
  candidateRuntimeDiagnostics: Record<string, {
    validCount: number;
    medianResidualM: number | null;
    p95ResidualM: number | null;
    medianCorrectionDirectionChangeDeg: number | null;
    medianFinalRadialDistanceM: number | null;
  }>;
};

type ConfigurationView = {
  metrics: GeometryMetrics;
  selection: SelectionDiagnostics;
};

type ConfigurationEvaluation = {
  probeIds: string[];
  byView: Record<ViewId, ConfigurationView>;
  trainingAB: ConfigurationView;
};

type PairRank = {
  candidate: OriginCandidate;
  evaluation: ConfigurationEvaluation;
  dataByView: Record<"A" | "B", ViewData>;
};

type TripleRank = {
  candidate: OriginCandidate;
  evaluation: ConfigurationEvaluation;
  dataByView: Record<"A" | "B", ViewData>;
};

type PublicConfiguration = {
  probeIds: string[];
  probeOriginsM: Record<string, Vec3Tuple>;
  probeOnlyMetrics: Record<string, Record<ViewId, GeometryMetrics>>;
  combined: ConfigurationEvaluation;
  marginalVsProbeA: {
    sameObjectHits: number;
    falseNegatives: number;
    falsePositives: number;
    p95QErrorM: number | null;
  };
};

type CoverageProof = {
  baseSha: string;
  phase: "CPU ideal one-step Probe study; no color or distance cube is allocated";
  probeContract: {
    probeAOriginM: Vec3Tuple;
    correctionUpdates: 1;
    correctionAuthority: string;
    selection: string;
    selectionInputs: readonly string[];
    selectionUsesPhysicalQ: false;
    selectionUsesPhysicalHitObject: false;
    blending: false;
  };
  views: Record<ViewId, { positionM: Vec3Tuple; targetM: Vec3Tuple; fovDeg: number; nearM: number; farM: number }>;
  sampleDomain: Record<ViewId, {
    paneCount: number;
    totalPaneSamples: number;
    visibleFrontFaceSamples: number;
    physicalFiniteHitCount: number;
    physicalNoHitCount: number;
    sampleFractions: readonly number[];
  }>;
  search: {
    derivation: readonly string[];
    boundsM: { x: AxisBounds; y: AxisBounds; z: AxisBounds };
    gridSize: typeof GRID_SIZE;
    rawCandidateCount: number;
    rejectedCandidateCount: number;
    validCandidateCount: number;
    rejectionCounts: Record<"outsideCorridor" | "duplicateProbeA" | "glazingIntersection" | "insideSceneAabb" | "nearSolidGeometry", number>;
    evaluatedCandidateCount: number;
    probeOrigins: Array<{ id: string; originM: Vec3Tuple }>;
    selectedProbeOrigins: Array<{ id: string; originM: Vec3Tuple }>;
    probeNearM: number;
    duplicateToleranceM: number;
  };
  probeAOnly: {
    originM: Vec3Tuple;
    byView: Record<ViewId, GeometryMetrics>;
    trainingAB: GeometryMetrics;
    baselineGate: { passed: boolean; expectedAuthority: string };
  };
  placement: {
    optimizedViews: readonly ["A", "B"];
    holdoutView: "C";
    rankingOrder: readonly string[];
    evaluatedProbeBPairCount: number;
    bestTwo: PublicConfiguration & { probeB: { id: string; originM: Vec3Tuple }; placementRank: number };
    topTwoProbeRankings: Array<{
      rank: number;
      probeBOriginM: Vec3Tuple;
      sameObjectHitCount: number;
      falseNegativeCount: number;
      falsePositiveCount: number;
      wrongObjectCount: number;
      p95QErrorM: number | null;
      p95AngularErrorDeg: number | null;
    }>;
    probeBMateriallyImprovesProbeA: boolean;
    evaluatedProbeCCount: number;
    bestThree: (PublicConfiguration & {
      probeC: { id: string; originM: Vec3Tuple };
      placementRank: number;
      marginalVsBestTwo: { sameObjectHits: number; falseNegatives: number; falsePositives: number };
    }) | null;
    selectedConfiguration: PublicConfiguration & {
      holdoutC: ConfigurationView;
      selectedProbeCount: number;
      selectionByView: Record<ViewId, SelectionDiagnostics>;
    };
  };
  resourceScaling: {
    nominalBytesPerColorCube: number;
    nominalBytesPerDistanceCube: number;
    nominalMebibytesPerCorrectedProbe: number;
    selectedProbeCount: number;
    selectedNominalMebibytes: number;
    captureSceneRendersByProbeCount: Record<"1" | "2" | "3", number>;
    correctedDistanceSamplesPerPanePixelByProbeCount: Record<"1" | "2" | "3", number>;
    winningColorSamplesPerPanePixel: 1;
    hardwareGpuTiming: "unmeasured";
    worldChangeRecaptureScalesAs: "12 scene face renders per corrected Probe";
  };
  decision: {
    classification:
      | "BOUNDED MULTI-PROBE GEOMETRY PROMISING"
      | "MULTI-PROBE COVERAGE IMPROVES BUT COMPLEXITY / VALIDITY IS NOT JUSTIFIED"
      | "BOUNDED MULTI-PROBE APPROACH NOT JUSTIFIED";
    basis: readonly string[];
    gpuValidationPerformed: false;
    recommendation: string;
  };
};

declare global {
  interface Window {
    __architectureRiseMultiProbeCoverage?: { proof: CoverageProof };
  }
}

const tuple = (value: THREE.Vector3): Vec3Tuple => [value.x, value.y, value.z];
const sortNumbers = (values: readonly number[]): number[] => [...values].sort((a, b) => a - b);
const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = sortNumbers(values);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
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
const isGlazing = (mesh: THREE.Mesh): boolean => mesh.name.endsWith("-glazing");

const collectMeshes = (root: THREE.Object3D): THREE.Mesh[] => {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  return meshes;
};

const boundsForMeshes = (meshes: readonly THREE.Mesh[]): THREE.Box3 => {
  const bounds = new THREE.Box3().makeEmpty();
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    mesh.geometry.computeBoundingBox();
    bounds.union(new THREE.Box3().setFromObject(mesh));
  }
  if (bounds.isEmpty()) throw new Error("Expected non-empty Architecture Rise geometry bounds");
  return bounds;
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
    for (let row = 0; row < SAMPLE_FRACTIONS.length; row += 1) {
      for (let column = 0; column < SAMPLE_FRACTIONS.length; column += 1) {
        const u = SAMPLE_FRACTIONS[column];
        const v = SAMPLE_FRACTIONS[row];
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
        if (directHit.face.normal.dot(new THREE.Vector3(0, 0, -1)) < 0.999) continue;

        const normal = directHit.face.normal.clone().applyMatrix3(
          new THREE.Matrix3().getNormalMatrix(pane.matrixWorld),
        ).normalize();
        if (normal.dot(camera.position.clone().sub(directHit.point)) < 0) normal.negate();
        if (normal.dot(new THREE.Vector3(0, 0, -1)) < 0.999) continue;

        const incident = directHit.point.clone().sub(camera.position).normalize();
        const reflectedDirection = incident.clone().reflect(normal).normalize();
        reflectedRay.set(directHit.point.clone().addScaledVector(reflectedDirection, 0.12), reflectedDirection);
        reflectedRay.near = 0;
        reflectedRay.far = PROBE_FAR;
        const physicalHit = reflectedRay.intersectObjects(reflectionMeshes, false)[0] ?? null;
        samples.push({
          key: pane.name + "|" + row + "|" + column,
          pane: pane.name,
          row,
          column,
          u,
          v,
          panePoint: directHit.point.clone(),
          normal,
          reflectedDirection,
          physicalQ: physicalHit?.point.clone() ?? null,
          physicalHitObject: physicalHit?.object.name ?? null,
        });
      }
    }
  }

  return samples;
};

const probeRayHit = (
  origin: THREE.Vector3,
  direction: THREE.Vector3,
  reflectionMeshes: THREE.Mesh[],
): THREE.Intersection<THREE.Object3D> | null => {
  const ray = new THREE.Raycaster(origin, direction.clone().normalize());
  ray.near = 0;
  ray.far = PROBE_FAR;
  return ray.intersectObjects(reflectionMeshes, false)[0] ?? null;
};

const traceOneStepProbe = (
  origin: THREE.Vector3,
  samples: readonly ObserverPaneSample[],
  reflectionMeshes: THREE.Mesh[],
  probeIndex: number,
): Array<ProbeCandidateHit | null> => samples.map((sample) => {
  const initialDirection = sample.reflectedDirection.clone().normalize();
  const initialHit = probeRayHit(origin, initialDirection, reflectionMeshes);
  if (!initialHit) return null;
  const correctedDirection = correctProbeDirectionFromRadialHit(
    origin,
    sample.panePoint,
    sample.reflectedDirection,
    initialHit.point,
  );
  if (!correctedDirection) return null;
  const finalHit = probeRayHit(origin, correctedDirection, reflectionMeshes);
  if (!finalHit) return null;

  const q = finalHit.point.clone();
  const projectedDistance = q.clone().sub(sample.panePoint).dot(sample.reflectedDirection);
  const pointOnPhysicalRay = sample.panePoint.clone().addScaledVector(
    sample.reflectedDirection,
    Math.max(projectedDistance, 1e-4),
  );
  const runtimeResidualM = q.distanceTo(pointOnPhysicalRay);
  if (!Number.isFinite(runtimeResidualM) || !Number.isFinite(q.lengthSq())) return null;

  return {
    probeIndex,
    q,
    hitObject: finalHit.object.name,
    direction: q.clone().sub(origin).normalize(),
    runtimeResidualM,
    correctionDirectionChangeDeg: angleDegrees(initialDirection, correctedDirection),
    finalRadialDistanceM: q.distanceTo(origin),
  };
});

const measureGeometry = (
  samples: readonly ObserverPaneSample[],
  selected: readonly (ProbeCandidateHit | null)[],
): GeometryMetrics => {
  const qErrors: number[] = [];
  const angularErrors: number[] = [];
  let physicalFiniteHitCount = 0;
  let physicalNoHitCount = 0;
  let candidateValidCount = 0;
  let sameObjectHitCount = 0;
  let wrongObjectCount = 0;
  let candidateNoHitCount = 0;
  let falsePositiveCount = 0;
  let falseNegativeCount = 0;

  samples.forEach((sample, index) => {
    const candidate = selected[index] ?? null;
    if (sample.physicalQ) physicalFiniteHitCount += 1;
    else physicalNoHitCount += 1;
    if (candidate) candidateValidCount += 1;
    else candidateNoHitCount += 1;

    if (!sample.physicalQ) {
      if (candidate) falsePositiveCount += 1;
      return;
    }
    if (!candidate) {
      falseNegativeCount += 1;
      return;
    }
    if (candidate.hitObject === sample.physicalHitObject) sameObjectHitCount += 1;
    else wrongObjectCount += 1;
    qErrors.push(candidate.q.distanceTo(sample.physicalQ));
    const physicalDirection = sample.physicalQ.clone().sub(sample.panePoint).normalize();
    const candidateDirection = candidate.q.clone().sub(sample.panePoint).normalize();
    angularErrors.push(angleDegrees(physicalDirection, candidateDirection));
  });

  return {
    sampleCount: samples.length,
    physicalFiniteHitCount,
    physicalNoHitCount,
    candidateValidCount,
    candidateNoHitCount,
    sameObjectHitCount,
    wrongObjectCount,
    falsePositiveCount,
    falseNegativeCount,
    sameObjectCoverage: physicalFiniteHitCount === 0 ? null : sameObjectHitCount / physicalFiniteHitCount,
    falsePositiveRate: physicalNoHitCount === 0 ? null : falsePositiveCount / physicalNoHitCount,
    falseNegativeRate: physicalFiniteHitCount === 0 ? null : falseNegativeCount / physicalFiniteHitCount,
    wrongObjectRate: physicalFiniteHitCount === 0 ? null : wrongObjectCount / physicalFiniteHitCount,
    medianQErrorM: median(qErrors),
    p95QErrorM: percentile(qErrors, 0.95),
    medianAngularErrorDeg: median(angularErrors),
    p95AngularErrorDeg: percentile(angularErrors, 0.95),
  };
};

const summarizeConfiguration = (
  viewData: ViewData,
  probeIds: readonly string[],
): ConfigurationView => {
  const sampleCount = viewData.samples.length;
  const selected: Array<ProbeCandidateHit | null> = [];
  const overlapCounts: Record<string, number> = {};
  const selectedCounts = Object.fromEntries(probeIds.map((probeId) => [probeId, 0])) as Record<string, number>;
  const candidateResiduals: number[] = [];
  let multiValidSampleCount = 0;
  let multiValidSameObjectCount = 0;

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const candidatesByProbe = probeIds.map((probeId, probeIndex) => {
      const result = viewData.candidatesByProbeId.get(probeId)?.[sampleIndex] ?? null;
      if (!result) return null;
      return { probeIndex, q: result.q } satisfies RuntimeProbeCandidate;
    });
    const validCount = candidatesByProbe.filter((candidate) => candidate !== null).length;
    const overlapKey = String(validCount);
    overlapCounts[overlapKey] = (overlapCounts[overlapKey] ?? 0) + 1;
    const sample = viewData.samples[sampleIndex];
    const winner = selectRuntimeProbeByPaneRay(sample.panePoint, sample.reflectedDirection, candidatesByProbe);
    if (!winner) {
      selected.push(null);
      continue;
    }
    const probeId = probeIds[winner.probeIndex];
    const result = viewData.candidatesByProbeId.get(probeId)?.[sampleIndex] ?? null;
    selected.push(result);
    selectedCounts[probeId] += 1;
    candidateResiduals.push(winner.residualM);
    if (validCount >= 2) {
      multiValidSampleCount += 1;
      if (sample.physicalQ && result?.hitObject === sample.physicalHitObject) multiValidSameObjectCount += 1;
    }
  }

  const candidateRuntimeDiagnostics = Object.fromEntries(probeIds.map((probeId) => {
    const valid = (viewData.candidatesByProbeId.get(probeId) ?? []).filter(
      (candidate): candidate is ProbeCandidateHit => candidate !== null,
    );
    return [probeId, {
      validCount: valid.length,
      medianResidualM: median(valid.map((candidate) => candidate.runtimeResidualM)),
      p95ResidualM: percentile(valid.map((candidate) => candidate.runtimeResidualM), 0.95),
      medianCorrectionDirectionChangeDeg: median(valid.map((candidate) => candidate.correctionDirectionChangeDeg)),
      medianFinalRadialDistanceM: median(valid.map((candidate) => candidate.finalRadialDistanceM)),
    }];
  }));

  return {
    metrics: measureGeometry(viewData.samples, selected),
    selection: {
      validCandidateOverlap: overlapCounts,
      selectedByProbe: Object.fromEntries(probeIds.map((probeId) => [probeId, {
        count: selectedCounts[probeId],
        fraction: sampleCount === 0 ? 0 : selectedCounts[probeId] / sampleCount,
      }])),
      multiValidSampleCount,
      multiValidSameObjectCount,
      multiValidSameObjectRate: multiValidSampleCount === 0 ? null : multiValidSameObjectCount / multiValidSampleCount,
      selectedResidualMedianM: median(candidateResiduals),
      selectedResidualP95M: percentile(candidateResiduals, 0.95),
      candidateRuntimeDiagnostics,
    },
  };
};

const mergeViewData = (views: readonly ViewData[], id: ViewId): ViewData => {
  const probeIds = [...new Set(views.flatMap((view) => [...view.candidatesByProbeId.keys()]))];
  return {
    id,
    samples: views.flatMap((view) => view.samples),
    candidatesByProbeId: new Map(probeIds.map((probeId) => [
      probeId,
      views.flatMap((view) => view.candidatesByProbeId.get(probeId) ?? []),
    ])),
  };
};

const evaluateConfiguration = (
  viewData: Record<ViewId, ViewData>,
  probeIds: readonly string[],
): ConfigurationEvaluation => ({
  probeIds: [...probeIds],
  byView: {
    A: summarizeConfiguration(viewData.A, probeIds),
    B: summarizeConfiguration(viewData.B, probeIds),
    C: summarizeConfiguration(viewData.C, probeIds),
  },
  trainingAB: summarizeConfiguration(mergeViewData([viewData.A, viewData.B], "A"), probeIds),
});

const addProbeResults = (
  view: ViewData,
  probeId: string,
  candidates: Array<ProbeCandidateHit | null>,
): ViewData => ({
  ...view,
  candidatesByProbeId: new Map(view.candidatesByProbeId).set(probeId, candidates),
});

const evenlySpaced = (min: number, max: number, count: number): number[] =>
  Array.from({ length: count }, (_, index) => min + (max - min) * index / Math.max(count - 1, 1));

const createOriginGrid = (
  frontPaneBounds: THREE.Box3,
  facadeBounds: THREE.Box3,
  reflectedWorldBounds: THREE.Box3,
  target: THREE.Vector3,
  supportSurfaceY: number,
  glazingBounds: readonly THREE.Box3[],
  solidBounds: readonly THREE.Box3[],
): { bounds: THREE.Box3; candidates: OriginCandidate[]; rejectionCounts: CoverageProof["search"]["rejectionCounts"] } => {
  const paneSize = frontPaneBounds.getSize(new THREE.Vector3());
  const facadeSize = facadeBounds.getSize(new THREE.Vector3());
  const horizontalSpan = Math.max(paneSize.x, facadeSize.x);
  const xMin = Math.max(
    reflectedWorldBounds.min.x,
    Math.min(frontPaneBounds.min.x, facadeBounds.min.x, target.x) - horizontalSpan * 0.75,
  );
  const xMax = Math.min(
    reflectedWorldBounds.max.x,
    Math.max(frontPaneBounds.max.x, facadeBounds.max.x, target.x) + horizontalSpan * 0.75,
  );
  const yMin = Math.max(supportSurfaceY + Math.max(0.4, CLEARANCE_M), target.y - facadeSize.y * 0.5);
  const yMax = Math.min(facadeBounds.max.y - CLEARANCE_M, target.y + facadeSize.y * 0.5);
  const zMin = Math.max(target.z + Math.max(0.2, CLEARANCE_M), reflectedWorldBounds.min.z);
  const zMax = Math.min(frontPaneBounds.min.z, facadeBounds.min.z) - CLEARANCE_M;
  const bounds = new THREE.Box3(new THREE.Vector3(xMin, yMin, zMin), new THREE.Vector3(xMax, yMax, zMax));
  if (bounds.isEmpty() || ![xMin, xMax, yMin, yMax, zMin, zMax].every(Number.isFinite)) {
    throw new Error("Geometry-derived local Probe corridor is empty or non-finite");
  }

  const xValues = evenlySpaced(xMin, xMax, GRID_SIZE.x);
  const yValues = evenlySpaced(yMin, yMax, GRID_SIZE.y);
  const zValues = evenlySpaced(zMin, zMax, GRID_SIZE.z);
  const rejectionCounts = {
    outsideCorridor: 0,
    duplicateProbeA: 0,
    glazingIntersection: 0,
    insideSceneAabb: 0,
    nearSolidGeometry: 0,
  };
  const candidates: OriginCandidate[] = [];
  let gridIndex = 0;

  for (const x of xValues) {
    for (const y of yValues) {
      for (const z of zValues) {
        const origin = new THREE.Vector3(x, y, z);
        const id = `probe-grid-${String(gridIndex).padStart(2, "0")}`;
        gridIndex += 1;
        if (!bounds.containsPoint(origin)) {
          rejectionCounts.outsideCorridor += 1;
        } else if (origin.distanceTo(PROBE_A_ORIGIN) < DUPLICATE_ORIGIN_TOLERANCE_M) {
          rejectionCounts.duplicateProbeA += 1;
        } else if (glazingBounds.some((box) => box.clone().expandByScalar(CLEARANCE_M).containsPoint(origin))) {
          rejectionCounts.glazingIntersection += 1;
        } else if (solidBounds.some((box) => box.containsPoint(origin))) {
          rejectionCounts.insideSceneAabb += 1;
        } else if (solidBounds.some((box) => box.distanceToPoint(origin) < CLEARANCE_M)) {
          rejectionCounts.nearSolidGeometry += 1;
        } else {
          candidates.push({ id, gridIndex: gridIndex - 1, origin });
        }
      }
    }
  }

  return { bounds, candidates, rejectionCounts };
};

const publicMetrics = (configuration: ConfigurationView): GeometryMetrics => configuration.metrics;

const publicConfiguration = (
  probeIds: readonly string[],
  origins: ReadonlyMap<string, THREE.Vector3>,
  byViewData: Record<ViewId, ViewData>,
): PublicConfiguration => {
  const evaluation = evaluateConfiguration(byViewData, probeIds);
  const probeOnlyMetrics = Object.fromEntries(probeIds.map((probeId) => [
    probeId,
    Object.fromEntries((Object.keys(byViewData) as ViewId[]).map((viewId) => [
      viewId,
      publicMetrics(summarizeConfiguration(byViewData[viewId], [probeId])),
    ])) as Record<ViewId, GeometryMetrics>,
  ])) as Record<string, Record<ViewId, GeometryMetrics>>;
  const baselineA = evaluateConfiguration(byViewData, [PROBE_A_ID]).trainingAB.metrics;
  const combined = evaluation.trainingAB.metrics;
  return {
    probeIds: [...probeIds],
    probeOriginsM: Object.fromEntries(probeIds.map((probeId) => {
      const origin = origins.get(probeId);
      if (!origin) throw new Error(`No frozen origin was recorded for ${probeId}`);
      return [probeId, tuple(origin)];
    })),
    probeOnlyMetrics,
    combined: evaluation,
    marginalVsProbeA: {
      sameObjectHits: combined.sameObjectHitCount - baselineA.sameObjectHitCount,
      falseNegatives: baselineA.falseNegativeCount - combined.falseNegativeCount,
      falsePositives: combined.falsePositiveCount - baselineA.falsePositiveCount,
      p95QErrorM: combined.p95QErrorM,
    },
  };
};

const requiredNumber = (value: number | null, label: string): number => {
  if (value === null || !Number.isFinite(value)) throw new Error(`${label} must be a finite measured value`);
  return value;
};

const comparePairRanks = (left: PairRank, right: PairRank): number => {
  const a = left.evaluation.trainingAB.metrics;
  const b = right.evaluation.trainingAB.metrics;
  const fields: Array<readonly [number, number]> = [
    [b.sameObjectHitCount, a.sameObjectHitCount],
    [a.falseNegativeCount, b.falseNegativeCount],
    [a.falsePositiveCount, b.falsePositiveCount],
    [a.wrongObjectCount, b.wrongObjectCount],
    [requiredNumber(a.p95QErrorM, "Probe-pair p95 Q error"), requiredNumber(b.p95QErrorM, "Probe-pair p95 Q error")],
    [requiredNumber(a.p95AngularErrorDeg, "Probe-pair p95 angular error"), requiredNumber(b.p95AngularErrorDeg, "Probe-pair p95 angular error")],
    [left.candidate.gridIndex, right.candidate.gridIndex],
  ];
  for (const [leftValue, rightValue] of fields) {
    if (leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
};

const compareTripleRanks = (left: TripleRank, right: TripleRank): number => {
  const a = left.evaluation.trainingAB.metrics;
  const b = right.evaluation.trainingAB.metrics;
  const fields: Array<readonly [number, number]> = [
    [b.sameObjectHitCount, a.sameObjectHitCount],
    [a.falseNegativeCount, b.falseNegativeCount],
    [a.falsePositiveCount, b.falsePositiveCount],
    [a.wrongObjectCount, b.wrongObjectCount],
    [requiredNumber(a.p95QErrorM, "Probe-triplet p95 Q error"), requiredNumber(b.p95QErrorM, "Probe-triplet p95 Q error")],
    [requiredNumber(a.p95AngularErrorDeg, "Probe-triplet p95 angular error"), requiredNumber(b.p95AngularErrorDeg, "Probe-triplet p95 angular error")],
    [left.candidate.gridIndex, right.candidate.gridIndex],
  ];
  for (const [leftValue, rightValue] of fields) {
    if (leftValue !== rightValue) return leftValue - rightValue;
  }
  return 0;
};

const runStudy = (): CoverageProof => {
  const scene = new THREE.Scene();
  const subject = createArchitectureRiseGroup({ presentation: ARCHITECTURE_RISE_PRESENTATION });
  try {
  scene.add(subject);
  subject.updateMatrixWorld(true);
  const allMeshes = collectMeshes(subject);
  const frontPanes = allMeshes.filter(isFrontGlazing);
  const allGlazing = allMeshes.filter(isGlazing);
  const reflectionMeshes = allMeshes.filter((mesh) => !isGlazing(mesh));
  if (frontPanes.length === 0 || allGlazing.length < frontPanes.length) {
    throw new Error("Architecture Rise did not expose the expected front and total glazing families");
  }

  const placement = architectureRiseScene.cameraPlacement;
  const defaultPosition = new THREE.Vector3(toWorld(placement.position.x), toWorld(placement.position.y), toWorld(placement.position.z));
  const target = new THREE.Vector3(toWorld(placement.target.x), toWorld(placement.target.y), toWorld(placement.target.z));
  const alternatePosition = new THREE.Vector3(11.037666, 3, 0.323947);
  const holdoutPosition = new THREE.Vector3(
    (defaultPosition.x + alternatePosition.x) / 2,
    (defaultPosition.y + alternatePosition.y) / 2,
    (defaultPosition.z + alternatePosition.z) / 2,
  );
  const views: Record<ViewId, ObserverView> = {
    A: { id: "A", position: defaultPosition, target: target.clone(), camera: createPerspectiveCamera(defaultPosition, target) },
    B: { id: "B", position: alternatePosition, target: target.clone(), camera: createPerspectiveCamera(alternatePosition, target) },
    C: { id: "C", position: holdoutPosition, target: target.clone(), camera: createPerspectiveCamera(holdoutPosition, target) },
  };

  const paneBounds = boundsForMeshes(frontPanes);
  const facadeMesh = allMeshes.find((mesh) => mesh.name === "architecture-rise-primary-facade");
  const groundMesh = allMeshes.find((mesh) => mesh.name === "architecture-rise-ground");
  if (!facadeMesh || !groundMesh) throw new Error("Geometry-derived search requires the primary facade and support ground");
  const facadeBounds = boundsForMeshes([facadeMesh]);
  const groundBounds = boundsForMeshes([groundMesh]);
  const reflectedWorldBounds = boundsForMeshes(allMeshes.filter((mesh) => !isGlazing(mesh) && mesh !== groundMesh));
  const glazingBounds = allGlazing.map((mesh) => new THREE.Box3().setFromObject(mesh));
  const solidBounds = allMeshes
    .filter((mesh) => !isGlazing(mesh))
    .map((mesh) => new THREE.Box3().setFromObject(mesh));
  const grid = createOriginGrid(
    paneBounds,
    facadeBounds,
    reflectedWorldBounds,
    target,
    groundBounds.max.y,
    glazingBounds,
    solidBounds,
  );
  const viewSamples = Object.fromEntries((Object.keys(views) as ViewId[]).map((viewId) => [
    viewId,
    collectObserverPaneSamples(views[viewId].camera, allMeshes, frontPanes, reflectionMeshes),
  ])) as Record<ViewId, ObserverPaneSample[]>;

  const probeAData = {} as Record<ViewId, ViewData>;
  for (const viewId of ["A", "B", "C"] as const) {
    probeAData[viewId] = {
      id: viewId,
      samples: viewSamples[viewId],
      candidatesByProbeId: new Map([[PROBE_A_ID, traceOneStepProbe(
        PROBE_A_ORIGIN,
        viewSamples[viewId],
        reflectionMeshes,
        0,
      )]]),
    };
  }

  const probeAOnly = evaluateConfiguration(probeAData, [PROBE_A_ID]);
  const a = probeAOnly.byView.A.metrics;
  const b = probeAOnly.byView.B.metrics;
  const baselinePassed =
    a.sampleCount === 238 && a.physicalFiniteHitCount === 54 && a.physicalNoHitCount === 184 &&
    a.sameObjectHitCount === 22 && a.wrongObjectCount === 24 && a.falsePositiveCount === 46 && a.falseNegativeCount === 8 &&
    b.sampleCount === 171 && b.physicalFiniteHitCount === 29 && b.physicalNoHitCount === 142 &&
    b.candidateValidCount === 0 && b.falseNegativeCount === 29;
  if (!baselinePassed) {
    throw new Error("PR S CPU Probe A baseline did not reproduce; bounded placement scoring stopped before multi-Probe conclusions");
  }

  const pairRanks: PairRank[] = [];
  for (const candidate of grid.candidates) {
    const pairData = {} as Record<"A" | "B", ViewData>;
    for (const viewId of ["A", "B"] as const) {
      const bResults = traceOneStepProbe(candidate.origin, probeAData[viewId].samples, reflectionMeshes, 1);
      pairData[viewId] = addProbeResults(probeAData[viewId], candidate.id, bResults);
    }
    const trainData = mergeViewData([pairData.A, pairData.B], "A");
    const pairEvaluation = {
      probeIds: [PROBE_A_ID, candidate.id],
      byView: {
        A: summarizeConfiguration(pairData.A, [PROBE_A_ID, candidate.id]),
        B: summarizeConfiguration(pairData.B, [PROBE_A_ID, candidate.id]),
        C: probeAOnly.byView.C,
      },
      trainingAB: summarizeConfiguration(trainData, [PROBE_A_ID, candidate.id]),
    } satisfies ConfigurationEvaluation;
    pairRanks.push({ candidate, evaluation: pairEvaluation, dataByView: pairData });
  }
  if (pairRanks.length === 0) throw new Error("Geometry-derived grid yielded no valid Probe B origin");
  pairRanks.sort(comparePairRanks);
  const bestTwo = pairRanks[0];
  const baseTrainingMetrics = probeAOnly.trainingAB.metrics;
  const bestTwoTraining = bestTwo.evaluation.trainingAB.metrics;
  const probeBMateriallyImprovesProbeA =
    bestTwoTraining.sameObjectHitCount >= baseTrainingMetrics.sameObjectHitCount + 8 &&
    bestTwo.evaluation.byView.B.metrics.falseNegativeCount <= b.falseNegativeCount - 10 &&
    bestTwoTraining.falsePositiveRate !== null && baseTrainingMetrics.falsePositiveRate !== null &&
    bestTwoTraining.falsePositiveRate <= baseTrainingMetrics.falsePositiveRate + 0.1;

  let bestThree: TripleRank | null = null;
  let evaluatedProbeCCount = 0;
  if (probeBMateriallyImprovesProbeA) {
    const selectedBDataForC = {} as Record<ViewId, ViewData>;
    selectedBDataForC.A = bestTwo.dataByView.A;
    selectedBDataForC.B = bestTwo.dataByView.B;
    for (const viewId of ["A", "B", "C"] as const) {
      if (viewId === "C") {
        selectedBDataForC.C = addProbeResults(
          probeAData.C,
          bestTwo.candidate.id,
          traceOneStepProbe(bestTwo.candidate.origin, probeAData.C.samples, reflectionMeshes, 1),
        );
      }
    }
    for (const candidate of grid.candidates) {
      if (
        candidate.id === bestTwo.candidate.id ||
        candidate.origin.distanceTo(PROBE_A_ORIGIN) < DUPLICATE_ORIGIN_TOLERANCE_M ||
        candidate.origin.distanceTo(bestTwo.candidate.origin) < DUPLICATE_ORIGIN_TOLERANCE_M
      ) continue;
      evaluatedProbeCCount += 1;
      const tripleData = {} as Record<"A" | "B", ViewData>;
      for (const viewId of ["A", "B"] as const) {
        tripleData[viewId] = addProbeResults(
          selectedBDataForC[viewId],
          candidate.id,
          traceOneStepProbe(candidate.origin, selectedBDataForC[viewId].samples, reflectionMeshes, 2),
        );
      }
      const training = mergeViewData([tripleData.A, tripleData.B], "A");
      const evaluation = {
        probeIds: [PROBE_A_ID, bestTwo.candidate.id, candidate.id],
        byView: {
          A: summarizeConfiguration(tripleData.A, [PROBE_A_ID, bestTwo.candidate.id, candidate.id]),
          B: summarizeConfiguration(tripleData.B, [PROBE_A_ID, bestTwo.candidate.id, candidate.id]),
          C: probeAOnly.byView.C,
        },
        trainingAB: summarizeConfiguration(training, [PROBE_A_ID, bestTwo.candidate.id, candidate.id]),
      } satisfies ConfigurationEvaluation;
      const baseForTriple = {
        A: tripleData.A,
        B: tripleData.B,
      };
      const tripleRank = { candidate, evaluation, dataByView: baseForTriple } satisfies TripleRank;
      if (bestThree === null || compareTripleRanks(tripleRank, bestThree) < 0) bestThree = tripleRank;
    }
  }

  const bestThreeTraining = bestThree?.evaluation.trainingAB.metrics ?? null;
  const bestTwoForComparison = bestTwo.evaluation.trainingAB.metrics;
  const bestThreeMarginal = bestThreeTraining ? {
    sameObjectHits: bestThreeTraining.sameObjectHitCount - bestTwoForComparison.sameObjectHitCount,
    falseNegatives: bestTwoForComparison.falseNegativeCount - bestThreeTraining.falseNegativeCount,
    falsePositives: bestThreeTraining.falsePositiveCount - bestTwoForComparison.falsePositiveCount,
  } : null;
  const threeProbeBenefitIsMaterial = bestThreeMarginal !== null &&
    (bestThreeMarginal.sameObjectHits >= 5 || bestThreeMarginal.falseNegatives >= 5) &&
    bestThreeTraining !== null && bestTwoForComparison.falsePositiveRate !== null && bestThreeTraining.falsePositiveRate !== null &&
    bestThreeTraining.falsePositiveRate <= bestTwoForComparison.falsePositiveRate + 0.05 &&
    bestThreeTraining.wrongObjectCount <= bestTwoForComparison.wrongObjectCount + 5;
  const selectedProbeIds = threeProbeBenefitIsMaterial && bestThree
    ? [PROBE_A_ID, bestTwo.candidate.id, bestThree.candidate.id]
    : [PROBE_A_ID, bestTwo.candidate.id];

  const bestTwoDataByView = {} as Record<ViewId, ViewData>;
  for (const viewId of ["A", "B"] as const) bestTwoDataByView[viewId] = bestTwo.dataByView[viewId];
  bestTwoDataByView.C = addProbeResults(
    probeAData.C,
    bestTwo.candidate.id,
    traceOneStepProbe(bestTwo.candidate.origin, probeAData.C.samples, reflectionMeshes, 1),
  );

  let bestThreeDataByView: Record<ViewId, ViewData> | null = null;
  if (bestThree) {
    bestThreeDataByView = {
      A: bestThree.dataByView.A,
      B: bestThree.dataByView.B,
      C: addProbeResults(
        bestTwoDataByView.C,
        bestThree.candidate.id,
        traceOneStepProbe(bestThree.candidate.origin, probeAData.C.samples, reflectionMeshes, 2),
      ),
    };
  }
  const selectedDataByView = selectedProbeIds.length === 3 && bestThreeDataByView
    ? bestThreeDataByView
    : bestTwoDataByView;

  const origins = new Map<string, THREE.Vector3>([[PROBE_A_ID, PROBE_A_ORIGIN]]);
  origins.set(bestTwo.candidate.id, bestTwo.candidate.origin);
  if (bestThree) origins.set(bestThree.candidate.id, bestThree.candidate.origin);

  const bestTwoPublic = publicConfiguration([PROBE_A_ID, bestTwo.candidate.id], origins, bestTwoDataByView);
  const bestThreePublic = bestThree && bestThreeDataByView
    ? publicConfiguration([PROBE_A_ID, bestTwo.candidate.id, bestThree.candidate.id], origins, bestThreeDataByView)
    : null;
  const selectedPublic = selectedProbeIds.length === 3 && bestThreePublic ? bestThreePublic : bestTwoPublic;
  const selectedEvaluation = evaluateConfiguration(selectedDataByView, selectedProbeIds);
  const holdoutC = selectedEvaluation.byView.C;
  const aTrain = probeAOnly.trainingAB.metrics;
  const selectedTrain = selectedEvaluation.trainingAB.metrics;
  const selectedB = selectedEvaluation.byView.B.metrics;
  const selectedC = holdoutC.metrics;
  const holdoutA = probeAOnly.byView.C.metrics;
  const meetsOutcomeA =
    (selectedTrain.sameObjectCoverage ?? 0) >= 0.7 &&
    (selectedB.falseNegativeRate ?? 1) < 0.2 &&
    (selectedTrain.falsePositiveRate ?? 1) < 0.15 &&
    (selectedTrain.wrongObjectRate ?? 1) < 0.2 &&
    (selectedC.sameObjectCoverage ?? 0) >= 0.7 &&
    (selectedC.falsePositiveRate ?? 1) < 0.15 &&
    selectedC.sameObjectHitCount > holdoutA.sameObjectHitCount &&
    selectedC.falseNegativeCount < holdoutA.falseNegativeCount;
  const materialTrainingGain =
    selectedTrain.sameObjectHitCount >= aTrain.sameObjectHitCount + 8 &&
    selectedB.falseNegativeCount <= b.falseNegativeCount - 10;
  const holdoutImproves =
    selectedC.sameObjectHitCount >= holdoutA.sameObjectHitCount + 2 &&
    selectedC.falseNegativeCount <= holdoutA.falseNegativeCount - 2;
  const classification: CoverageProof["decision"]["classification"] = meetsOutcomeA
    ? "BOUNDED MULTI-PROBE GEOMETRY PROMISING"
    : materialTrainingGain && holdoutImproves
      ? "MULTI-PROBE COVERAGE IMPROVES BUT COMPLEXITY / VALIDITY IS NOT JUSTIFIED"
      : "BOUNDED MULTI-PROBE APPROACH NOT JUSTIFIED";

  const selectedOrigins = new Map(selectedProbeIds.map((probeId) => {
    const origin = origins.get(probeId);
    if (!origin) throw new Error(`Selected Probe origin missing: ${probeId}`);
    return [probeId, tuple(origin)] as const;
  }));
  const selectedHoldout = selectedEvaluation.byView.C;
  const pairRankingOutput = pairRanks.slice(0, 10).map((rank, index) => {
    const metrics = rank.evaluation.trainingAB.metrics;
    return {
      rank: index + 1,
      probeBOriginM: tuple(rank.candidate.origin),
      sameObjectHitCount: metrics.sameObjectHitCount,
      falseNegativeCount: metrics.falseNegativeCount,
      falsePositiveCount: metrics.falsePositiveCount,
      wrongObjectCount: metrics.wrongObjectCount,
      p95QErrorM: metrics.p95QErrorM,
      p95AngularErrorDeg: metrics.p95AngularErrorDeg,
    };
  });

  const viewProof = {} as CoverageProof["views"];
  const sampleDomain = {} as CoverageProof["sampleDomain"];
  for (const viewId of ["A", "B", "C"] as const) {
    const view = views[viewId];
    const samples = viewSamples[viewId];
    const finiteCount = samples.filter((sample) => sample.physicalQ).length;
    viewProof[viewId] = {
      positionM: tuple(view.position),
      targetM: tuple(view.target),
      fovDeg: 45,
      nearM: 0.01,
      farM: 200,
    };
    sampleDomain[viewId] = {
      paneCount: frontPanes.length,
      totalPaneSamples: frontPanes.length * SAMPLE_FRACTIONS.length ** 2,
      visibleFrontFaceSamples: samples.length,
      physicalFiniteHitCount: finiteCount,
      physicalNoHitCount: samples.length - finiteCount,
      sampleFractions: SAMPLE_FRACTIONS,
    };
  }

  const chosenProbeOrigins = selectedProbeIds.map((probeId) => ({
    id: probeId,
    originM: selectedOrigins.get(probeId) as Vec3Tuple,
  }));
  const selectedNominalMebibytes = selectedProbeIds.length * 1.5;
  const proof: CoverageProof = {
    baseSha: BASE_SHA,
    phase: "CPU ideal one-step Probe study; no color or distance cube is allocated",
    probeContract: {
      probeAOriginM: tuple(PROBE_A_ORIGIN),
      correctionUpdates: 1,
      correctionAuthority: "correctProbeDirectionFromRadialHit from probe-distance-cube-correction.ts",
      selection: "discard invalid candidates, choose minimum pane-ray perpendicular residual, exact tie to lower Probe index",
      selectionInputs: ["panePoint", "physicalReflectedDirection", "candidate.valid", "candidate.Q"],
      selectionUsesPhysicalQ: false,
      selectionUsesPhysicalHitObject: false,
      blending: false,
    },
    views: viewProof,
    sampleDomain,
    search: {
      derivation: [
        "front-pane world bounds and primary-facade world bounds set the lateral footprint and front boundary",
        "world bounds of non-glazing reflected-scene geometry clip the local search corridor",
        "the production Observer target anchors the corridor depth and vertical region",
        "the architecture ground mesh bounds set the support-height clearance",
        "front-façade height and width scale the coarse vertical/lateral margins",
      ],
      boundsM: {
        x: { min: grid.bounds.min.x, max: grid.bounds.max.x },
        y: { min: grid.bounds.min.y, max: grid.bounds.max.y },
        z: { min: grid.bounds.min.z, max: grid.bounds.max.z },
      },
      gridSize: GRID_SIZE,
      rawCandidateCount: GRID_SIZE.x * GRID_SIZE.y * GRID_SIZE.z,
      rejectedCandidateCount: Object.values(grid.rejectionCounts).reduce((sum, count) => sum + count, 0),
      validCandidateCount: grid.candidates.length,
      rejectionCounts: grid.rejectionCounts,
      evaluatedCandidateCount: pairRanks.length,
      probeOrigins: grid.candidates.map((candidate) => ({ id: candidate.id, originM: tuple(candidate.origin) })),
      selectedProbeOrigins: chosenProbeOrigins,
      probeNearM: PROBE_NEAR,
      duplicateToleranceM: DUPLICATE_ORIGIN_TOLERANCE_M,
    },
    probeAOnly: {
      originM: tuple(PROBE_A_ORIGIN),
      byView: {
        A: probeAOnly.byView.A.metrics,
        B: probeAOnly.byView.B.metrics,
        C: probeAOnly.byView.C.metrics,
      },
      trainingAB: probeAOnly.trainingAB.metrics,
      baselineGate: {
        passed: baselinePassed,
        expectedAuthority: "PR S CPU corrected Probe A: View A 22 same/24 wrong/46 false positives/8 false negatives; View B 0 valid/29 false negatives",
      },
    },
    placement: {
      optimizedViews: ["A", "B"],
      holdoutView: "C",
      rankingOrder: [
        "higher same-object physical-hit count",
        "lower false-negative count",
        "lower false-positive count",
        "lower wrong-object count",
        "lower p95 Q error",
        "lower p95 angular error",
        "fewer Probes when marginal gains do not meet the complexity gate",
        "lower deterministic grid index for candidate ties",
      ],
      evaluatedProbeBPairCount: pairRanks.length,
      bestTwo: {
        ...bestTwoPublic,
        probeB: { id: bestTwo.candidate.id, originM: tuple(bestTwo.candidate.origin) },
        placementRank: 1,
      },
      topTwoProbeRankings: pairRankingOutput,
      probeBMateriallyImprovesProbeA,
      evaluatedProbeCCount,
      bestThree: bestThree && bestThreePublic && bestThreeMarginal
        ? {
          ...bestThreePublic,
          probeC: { id: bestThree.candidate.id, originM: tuple(bestThree.candidate.origin) },
          placementRank: 1,
          marginalVsBestTwo: bestThreeMarginal,
        }
        : null,
      selectedConfiguration: {
        ...selectedPublic,
        holdoutC: selectedHoldout,
        selectedProbeCount: selectedProbeIds.length,
        selectionByView: {
          A: selectedEvaluation.byView.A.selection,
          B: selectedEvaluation.byView.B.selection,
          C: selectedEvaluation.byView.C.selection,
        },
      },
    },
    resourceScaling: {
      nominalBytesPerColorCube: 786_432,
      nominalBytesPerDistanceCube: 786_432,
      nominalMebibytesPerCorrectedProbe: 1.5,
      selectedProbeCount: selectedProbeIds.length,
      selectedNominalMebibytes,
      captureSceneRendersByProbeCount: { "1": 12, "2": 24, "3": 36 },
      correctedDistanceSamplesPerPanePixelByProbeCount: { "1": 2, "2": 4, "3": 6 },
      winningColorSamplesPerPanePixel: 1,
      hardwareGpuTiming: "unmeasured",
      worldChangeRecaptureScalesAs: "12 scene face renders per corrected Probe",
    },
    decision: {
      classification,
      basis: [
        `training A+B same-object hits changed from ${aTrain.sameObjectHitCount} with Probe A to ${selectedTrain.sameObjectHitCount} with the selected configuration`,
        `View B false negatives changed from ${b.falseNegativeCount} to ${selectedB.falseNegativeCount}`,
        `combined training false-positive rate is ${selectedTrain.falsePositiveRate === null ? "unavailable" : (selectedTrain.falsePositiveRate * 100).toFixed(2) + "%"}`,
        `holdout C same-object hits changed from ${holdoutA.sameObjectHitCount} to ${selectedC.sameObjectHitCount}`,
        `holdout C false negatives changed from ${holdoutA.falseNegativeCount} to ${selectedC.falseNegativeCount}`,
      ],
      gpuValidationPerformed: false,
      recommendation: classification === "BOUNDED MULTI-PROBE GEOMETRY PROMISING"
        ? "Run a separately scoped normal-scale multi-Probe GPU geometry/appearance validation; do not productionize."
        : classification === "MULTI-PROBE COVERAGE IMPROVES BUT COMPLEXITY / VALIDITY IS NOT JUSTIFIED"
          ? "Close Probe planning for the current Architecture Rise production path and resume the technique decision between Planar, another candidate, or no local reflection."
          : "Close Probe research for the current Architecture Rise Observer production path; do not add more Probes. Reopen only with new evidence or requirements.",
    },
  };

  return proof;
  } finally {
    disposeArchitectureRiseGroup(subject);
  }
};

const start = (): void => {
  const body = document.body;
  const output = document.getElementById("measurements");
  try {
    const proof = runStudy();
    window.__architectureRiseMultiProbeCoverage = { proof };
    if (output) output.textContent = JSON.stringify(proof, null, 2);
    body.dataset.proofReady = "true";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (output) output.textContent = message;
    body.dataset.proofError = message;
  }
};

start();
