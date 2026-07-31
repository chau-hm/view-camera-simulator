import { angleDeg, magnitude } from "../core/math/vec";
import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { imageDistanceMm } from "../core/optics/thinLensModel";
import type { CameraState } from "../types/camera";
import type { Bounds3, CameraRigViewpointAnchor, Vec3 } from "../types/optics";
import { DEFAULT_CAMERA_STATE } from "../utils/constants";
import {
  CAMERA_MOVEMENT_CALIBRATION_BASELINE,
  resolveEffectiveCameraMovementCalibration,
  validateEffectiveCameraMovementCalibration,
  type EffectiveCameraMovementCalibration,
} from "./cameraMovementEffectiveCalibration";
import { generateCameraMovementLattice } from "./cameraMovementLatticeGeometry";
import {
  calculateCameraMovementProjectionDiagnostics,
  type CameraMovementDiagnosticMetric,
  type CameraMovementProjectedUv,
} from "./cameraMovementProjectionDiagnostics";
import type { CameraMovementTargetRegion } from "./cameraMovementSceneCalibration";
import { resolveCameraRigViewpointAnchor } from "./cameraRigViewpointGeometry";
import {
  CAMERA_MOVEMENT_TEACHING_CASE_IDS,
  createCameraMovementOppositeRearTiltProbe,
  createCameraMovementTeachingCases,
  getCameraMovementTeachingCase,
  type CameraMovementOppositeRearTiltProbe,
  type CameraMovementTeachingCalibrationCandidate,
  type CameraMovementTeachingCase,
  type CameraMovementTeachingCaseId,
} from "./cameraMovementTeachingCases";
import { understandingCameraMovementsScene } from "./definitions/understanding-camera-movements";
import { CAMERA_BODY_PIVOT_RIG_LOCAL } from "./understandingCameraMovementsGeometry";

export const CAMERA_MOVEMENT_CALIBRATION_SEARCH_SPACE = Object.freeze({
  subject: Object.freeze({
    columns: Object.freeze([3] as const),
    rows: Object.freeze([3] as const),
    levels: Object.freeze([5] as const),
    cubeSizeMm: Object.freeze([200, 260, 320] as const),
    horizontalGapMm: Object.freeze([0, 50, 100] as const),
    verticalGapMm: Object.freeze([0, 50, 100] as const),
    subjectDistanceMm: Object.freeze([1800, 2000, 2400, 3000] as const),
  }),
  focalLengthMm: Object.freeze([90, 105, 120, 150] as const),
  focusDistanceMm: Object.freeze([1800, 2000, 2400, 3000] as const),
  arcRadiusMm: Object.freeze([1800, 2000, 2400, 3000] as const),
  arcAngleDeg: Object.freeze([10, 12, 15, 18, 20] as const),
  tiltDeg: Object.freeze([5, 7.5, 10] as const),
  riseMm: Object.freeze([20, 40, 60, 80, 120, 160] as const),
  bodyPitchDeg: Object.freeze([6, 8, 10, 12] as const),
});

/** Minimum finite-focus separation used before evaluating the thin-lens denominator. */
export const CAMERA_MOVEMENT_FOCUS_DISTANCE_SAFE_EPSILON_MM = 1e-6;

type CameraMovementEvaluatedCaseId =
  CameraMovementTeachingCaseId | CameraMovementOppositeRearTiltProbe["id"];

export type CameraMovementTeachingCaseMetrics<
  Id extends CameraMovementEvaluatedCaseId = CameraMovementEvaluatedCaseId,
> = Readonly<{
  id: Id;
  anchor: CameraRigViewpointAnchor;
  targetRegion: CameraMovementTargetRegion;
  camera: CameraMovementTeachingCase["camera"];
  statusCode: "all-in-frame" | "partially-off-frame" | "fully-off-frame";
  fallback: Readonly<{
    applied: false;
    reason: null;
  }>;
  identity: Readonly<{
    geometryId: string;
    edgeCount: number;
  }>;
  targetUv: CameraMovementProjectedUv;
  targetInFrame: boolean;
  targetOffsetFromFilmCentreUv: CameraMovementProjectedUv;
  projectedBoundsUv: Readonly<{
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
  }>;
  marginsUv: Readonly<{
    left: number;
    right: number;
    top: number;
    bottom: number;
  }>;
  coverage: Readonly<{
    horizontal: number;
    vertical: number;
    projectedBoundsInsideFrame: number;
    filmFrameCovered: number;
    visibleVertexFraction: number;
  }>;
  convergenceSignal: number;
  lensCentreWorld: Readonly<Vec3>;
  filmCentreWorld: Readonly<Vec3>;
  rigOriginWorld: Readonly<Vec3>;
  bodyPitchPivotRigLocal: Readonly<Vec3>;
  lensNormalWorld: Readonly<Vec3>;
  filmNormalWorld: Readonly<Vec3>;
  focusNormalWorld: Readonly<Vec3>;
  lensNormalMagnitude: number;
  filmNormalMagnitude: number;
  focusNormalMagnitude: number;
  lensFilmDistanceMm: number;
  lensTargetDistanceMm: number;
}>;

export type CameraMovementTeachingCaseComparison = Readonly<{
  id: CameraMovementTeachingCaseId;
  targetDeltaFromNeutralUv: CameraMovementProjectedUv;
  targetDisplacementFromNeutralUv: number;
  convergenceDeltaFromNeutral: number;
  lensNormalAngleFromNeutralDeg: number;
  filmNormalAngleFromNeutralDeg: number;
  focusNormalAngleFromNeutralDeg: number;
}>;

export type CameraMovementTeachingCalibrationEvaluation = Readonly<{
  candidate: CameraMovementTeachingCalibrationCandidate;
  effectiveCalibration: EffectiveCameraMovementCalibration;
  subjectBoundsWorld: Readonly<Bounds3>;
  cases: Readonly<
    Record<
      CameraMovementTeachingCaseId,
      CameraMovementTeachingCaseMetrics<CameraMovementTeachingCaseId>
    >
  >;
  probes: Readonly<{
    oppositeRearTilt: CameraMovementTeachingCaseMetrics<CameraMovementOppositeRearTiltProbe["id"]>;
  }>;
  comparisons: Readonly<Record<CameraMovementTeachingCaseId, CameraMovementTeachingCaseComparison>>;
  summary: Readonly<{
    minimumMarginUv: number;
    minimumProjectedBoundsCoverage: number;
    maximumTargetOffsetFromFilmCentreUv: number;
    minimumNonNeutralTargetDisplacementUv: number;
  }>;
}>;

const freezeVec = (value: Readonly<Vec3>): Readonly<Vec3> =>
  Object.freeze({ x: value.x, y: value.y, z: value.z });
const metricValue = <T>(metric: CameraMovementDiagnosticMetric<T>, name: string): T => {
  if (metric.status !== "available") {
    throw new Error(`Camera-movement teaching metric ${name} is unavailable: ${metric.reason}`);
  }
  return metric.value;
};

const assertFiniteNumber = (value: number, name: string): number => {
  if (!Number.isFinite(value)) {
    throw new Error(`Camera-movement teaching metric ${name} is not finite`);
  }
  return value;
};

const assertFiniteVec = (value: Readonly<Vec3>, name: string): Readonly<Vec3> => {
  assertFiniteNumber(value.x, `${name}.x`);
  assertFiniteNumber(value.y, `${name}.y`);
  assertFiniteNumber(value.z, `${name}.z`);
  return freezeVec(value);
};

const bodyPivotForCandidate = (
  candidate: CameraMovementTeachingCalibrationCandidate,
): Readonly<Vec3> => {
  const baselineImageDistance = imageDistanceMm(
    CAMERA_MOVEMENT_CALIBRATION_BASELINE.optics.provisionalFocalLengthMm,
    CAMERA_MOVEMENT_CALIBRATION_BASELINE.optics.provisionalFocusDistanceMm,
  );
  const candidateImageDistance = imageDistanceMm(
    candidate.focalLengthMm,
    candidate.focusDistanceMm,
  );
  return Object.freeze({
    x: CAMERA_BODY_PIVOT_RIG_LOCAL.x,
    y: CAMERA_BODY_PIVOT_RIG_LOCAL.y,
    z: CAMERA_BODY_PIVOT_RIG_LOCAL.z + (baselineImageDistance - candidateImageDistance) / 2,
  });
};

const cameraStateForCase = (
  calibration: EffectiveCameraMovementCalibration,
  teaching: CameraMovementTeachingCase | CameraMovementOppositeRearTiltProbe,
  bodyPitchPivotRigLocal: Readonly<Vec3>,
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  focalLengthMm: calibration.optics.provisionalFocalLengthMm,
  focusDistanceMm: calibration.optics.provisionalFocusDistanceMm,
  ...teaching.camera,
  cameraBodyPivotWorld: { ...bodyPitchPivotRigLocal },
  viewpointAnchor: teaching.anchor,
  cameraRigPlacement: resolveCameraRigViewpointAnchor(calibration.cameraRig, teaching.anchor),
  activeSceneId: understandingCameraMovementsScene.id,
  activeTaskId: null,
  mode: "free",
  focusMode: "finite",
});

const finiteCaseMetrics = <
  Teaching extends CameraMovementTeachingCase | CameraMovementOppositeRearTiltProbe,
>(
  candidate: CameraMovementTeachingCalibrationCandidate,
  calibration: EffectiveCameraMovementCalibration,
  teaching: Teaching,
  subjectBoundsWorld: Readonly<Bounds3>,
  bodyPitchPivotRigLocal: Readonly<Vec3>,
): CameraMovementTeachingCaseMetrics<Teaching["id"]> => {
  const lattice = generateCameraMovementLattice(calibration.subject);
  const scene = {
    ...understandingCameraMovementsScene,
    bounds: subjectBoundsWorld,
    cameraPreset: {
      ...understandingCameraMovementsScene.cameraPreset,
      focalLengthMm: candidate.focalLengthMm,
      focusDistanceMm: candidate.focusDistanceMm,
      cameraBodyPivotWorld: { ...bodyPitchPivotRigLocal },
    },
  };
  const opticsState = deriveOpticsState(
    cameraStateForCase(calibration, teaching, bodyPitchPivotRigLocal),
    scene,
    calibration,
  );
  if (opticsState.diagnostics.fallbackApplied || opticsState.focusPlane === null) {
    throw new Error(
      `Camera-movement teaching case ${teaching.id} produced fallback or absent focus geometry`,
    );
  }
  const diagnostics = calculateCameraMovementProjectionDiagnostics({
    effectiveCalibration: calibration,
    lattice,
    calibrationIdentity: {
      sessionActive: false,
      revision: 0,
      geometryId: calibration.subjectGeometryKey,
    },
    currentAnchor: teaching.anchor,
    targetRegion: teaching.targetRegion,
    opticsState,
  });
  if (diagnostics.status.level === "error") {
    throw new Error(
      `Camera-movement teaching case ${teaching.id} projection failed: ${diagnostics.status.code}`,
    );
  }
  if (
    diagnostics.status.code !== "all-in-frame" &&
    diagnostics.status.code !== "partially-off-frame" &&
    diagnostics.status.code !== "fully-off-frame"
  ) {
    throw new Error(
      `Camera-movement teaching case ${teaching.id} has unexpected projection status: ${diagnostics.status.code}`,
    );
  }

  const targetProjection = metricValue(diagnostics.selectedTarget.uv, `${teaching.id}.targetUv`);
  const projectedBoundsUv = metricValue(
    diagnostics.projectedBoundsUv,
    `${teaching.id}.projectedBoundsUv`,
  );
  const marginsUv = {
    left: metricValue(diagnostics.marginsUv.left, `${teaching.id}.margins.left`),
    right: metricValue(diagnostics.marginsUv.right, `${teaching.id}.margins.right`),
    top: metricValue(diagnostics.marginsUv.top, `${teaching.id}.margins.top`),
    bottom: metricValue(diagnostics.marginsUv.bottom, `${teaching.id}.margins.bottom`),
  };
  const coverage = {
    horizontal: metricValue(diagnostics.coverage.horizontal, `${teaching.id}.coverage.horizontal`),
    vertical: metricValue(diagnostics.coverage.vertical, `${teaching.id}.coverage.vertical`),
    projectedBoundsInsideFrame: metricValue(
      diagnostics.coverage.projectedBoundsInsideFrame,
      `${teaching.id}.coverage.projectedBoundsInsideFrame`,
    ),
    filmFrameCovered: metricValue(
      diagnostics.coverage.filmFrameCovered,
      `${teaching.id}.coverage.filmFrameCovered`,
    ),
    visibleVertexFraction: metricValue(
      diagnostics.coverage.visibleVertexFraction,
      `${teaching.id}.coverage.visibleVertexFraction`,
    ),
  };
  const lensCentreWorld = metricValue(
    diagnostics.worldGeometry.lensCentreWorld,
    `${teaching.id}.lensCentreWorld`,
  );
  const filmCentreWorld = metricValue(
    diagnostics.worldGeometry.filmCentreWorld,
    `${teaching.id}.filmCentreWorld`,
  );
  const rigOriginWorld = metricValue(
    diagnostics.worldGeometry.rigOriginWorld,
    `${teaching.id}.rigOriginWorld`,
  );
  const lensNormalWorld = metricValue(
    diagnostics.worldGeometry.lensNormalWorld,
    `${teaching.id}.lensNormalWorld`,
  );
  const filmNormalWorld = metricValue(
    diagnostics.worldGeometry.filmNormalWorld,
    `${teaching.id}.filmNormalWorld`,
  );
  const focusNormalWorld = opticsState.focusPlane.normal;

  return Object.freeze({
    id: teaching.id,
    anchor: teaching.anchor,
    targetRegion: teaching.targetRegion,
    camera: teaching.camera,
    statusCode: diagnostics.status.code,
    fallback: Object.freeze({
      applied: false,
      reason: null,
    }),
    identity: Object.freeze({
      geometryId: metricValue(
        diagnostics.identity.geometryId,
        `${teaching.id}.identity.geometryId`,
      ),
      edgeCount: assertFiniteNumber(
        metricValue(diagnostics.identity.edgeCount, `${teaching.id}.identity.edgeCount`),
        `${teaching.id}.identity.edgeCount`,
      ),
    }),
    targetUv: Object.freeze({
      u: assertFiniteNumber(targetProjection.uv.u, `${teaching.id}.targetUv.u`),
      v: assertFiniteNumber(targetProjection.uv.v, `${teaching.id}.targetUv.v`),
    }),
    targetInFrame: targetProjection.inFrame,
    targetOffsetFromFilmCentreUv: Object.freeze({
      u: assertFiniteNumber(targetProjection.uv.u - 0.5, `${teaching.id}.targetOffset.u`),
      v: assertFiniteNumber(targetProjection.uv.v - 0.5, `${teaching.id}.targetOffset.v`),
    }),
    projectedBoundsUv: Object.freeze({
      minU: assertFiniteNumber(projectedBoundsUv.minU, `${teaching.id}.bounds.minU`),
      maxU: assertFiniteNumber(projectedBoundsUv.maxU, `${teaching.id}.bounds.maxU`),
      minV: assertFiniteNumber(projectedBoundsUv.minV, `${teaching.id}.bounds.minV`),
      maxV: assertFiniteNumber(projectedBoundsUv.maxV, `${teaching.id}.bounds.maxV`),
    }),
    marginsUv: Object.freeze(
      Object.fromEntries(
        Object.entries(marginsUv).map(([key, value]) => [
          key,
          assertFiniteNumber(value, `${teaching.id}.margins.${key}`),
        ]),
      ) as CameraMovementTeachingCaseMetrics["marginsUv"],
    ),
    coverage: Object.freeze(
      Object.fromEntries(
        Object.entries(coverage).map(([key, value]) => [
          key,
          assertFiniteNumber(value, `${teaching.id}.coverage.${key}`),
        ]),
      ) as CameraMovementTeachingCaseMetrics["coverage"],
    ),
    convergenceSignal: assertFiniteNumber(
      metricValue(diagnostics.convergence.normalizedSignal, `${teaching.id}.convergenceSignal`),
      `${teaching.id}.convergenceSignal`,
    ),
    lensCentreWorld: assertFiniteVec(lensCentreWorld, `${teaching.id}.lensCentreWorld`),
    filmCentreWorld: assertFiniteVec(filmCentreWorld, `${teaching.id}.filmCentreWorld`),
    rigOriginWorld: assertFiniteVec(rigOriginWorld, `${teaching.id}.rigOriginWorld`),
    bodyPitchPivotRigLocal: assertFiniteVec(
      opticsState.cameraRigTransform.bodyPitchPivotRigLocal,
      `${teaching.id}.bodyPitchPivotRigLocal`,
    ),
    lensNormalWorld: assertFiniteVec(lensNormalWorld, `${teaching.id}.lensNormalWorld`),
    filmNormalWorld: assertFiniteVec(filmNormalWorld, `${teaching.id}.filmNormalWorld`),
    focusNormalWorld: assertFiniteVec(focusNormalWorld, `${teaching.id}.focusNormalWorld`),
    lensNormalMagnitude: assertFiniteNumber(
      magnitude(lensNormalWorld),
      `${teaching.id}.lensNormalMagnitude`,
    ),
    filmNormalMagnitude: assertFiniteNumber(
      magnitude(filmNormalWorld),
      `${teaching.id}.filmNormalMagnitude`,
    ),
    focusNormalMagnitude: assertFiniteNumber(
      magnitude(focusNormalWorld),
      `${teaching.id}.focusNormalMagnitude`,
    ),
    lensFilmDistanceMm: assertFiniteNumber(
      metricValue(
        diagnostics.worldGeometry.lensFilmDistanceMm,
        `${teaching.id}.lensFilmDistanceMm`,
      ),
      `${teaching.id}.lensFilmDistanceMm`,
    ),
    lensTargetDistanceMm: assertFiniteNumber(
      metricValue(
        diagnostics.worldGeometry.lensTargetDistanceMm,
        `${teaching.id}.lensTargetDistanceMm`,
      ),
      `${teaching.id}.lensTargetDistanceMm`,
    ),
  });
};

const compareWithNeutral = (
  metrics: CameraMovementTeachingCaseMetrics<CameraMovementTeachingCaseId>,
  neutral: CameraMovementTeachingCaseMetrics<CameraMovementTeachingCaseId>,
): CameraMovementTeachingCaseComparison => {
  const deltaU = metrics.targetUv.u - neutral.targetUv.u;
  const deltaV = metrics.targetUv.v - neutral.targetUv.v;
  return Object.freeze({
    id: metrics.id,
    targetDeltaFromNeutralUv: Object.freeze({ u: deltaU, v: deltaV }),
    targetDisplacementFromNeutralUv: assertFiniteNumber(
      Math.hypot(deltaU, deltaV),
      `${metrics.id}.targetDisplacementFromNeutralUv`,
    ),
    convergenceDeltaFromNeutral: assertFiniteNumber(
      metrics.convergenceSignal - neutral.convergenceSignal,
      `${metrics.id}.convergenceDeltaFromNeutral`,
    ),
    lensNormalAngleFromNeutralDeg: assertFiniteNumber(
      angleDeg(metrics.lensNormalWorld, neutral.lensNormalWorld),
      `${metrics.id}.lensNormalAngleFromNeutralDeg`,
    ),
    filmNormalAngleFromNeutralDeg: assertFiniteNumber(
      angleDeg(metrics.filmNormalWorld, neutral.filmNormalWorld),
      `${metrics.id}.filmNormalAngleFromNeutralDeg`,
    ),
    focusNormalAngleFromNeutralDeg: assertFiniteNumber(
      angleDeg(metrics.focusNormalWorld, neutral.focusNormalWorld),
      `${metrics.id}.focusNormalAngleFromNeutralDeg`,
    ),
  });
};

export const evaluateCameraMovementTeachingCalibrationCandidate = (
  candidate: CameraMovementTeachingCalibrationCandidate,
): CameraMovementTeachingCalibrationEvaluation => {
  for (const [name, value] of Object.entries({
    subjectDistanceMm: candidate.subjectDistanceMm,
    focalLengthMm: candidate.focalLengthMm,
    focusDistanceMm: candidate.focusDistanceMm,
    arcRadiusMm: candidate.arcRadiusMm,
    arcAngleDeg: candidate.arcAngleDeg,
  })) {
    if (!Number.isFinite(value)) {
      throw new Error(`Camera-movement teaching candidate ${name} must be finite`);
    }
  }
  if (candidate.subjectDistanceMm <= 0) {
    throw new Error("Camera-movement teaching candidate subjectDistanceMm must be positive");
  }
  if (candidate.focalLengthMm <= 0) {
    throw new Error("Camera-movement teaching candidate focalLengthMm must be positive");
  }
  if (
    candidate.focusDistanceMm - candidate.focalLengthMm <=
    CAMERA_MOVEMENT_FOCUS_DISTANCE_SAFE_EPSILON_MM
  ) {
    throw new Error(
      `Camera-movement teaching candidate focusDistanceMm must exceed focalLengthMm by more than ${CAMERA_MOVEMENT_FOCUS_DISTANCE_SAFE_EPSILON_MM} mm`,
    );
  }
  if (candidate.arcRadiusMm <= 0) {
    throw new Error("Camera-movement teaching candidate arcRadiusMm must be positive");
  }

  const effectiveCalibration = resolveEffectiveCameraMovementCalibration(
    CAMERA_MOVEMENT_CALIBRATION_BASELINE,
    {
      geometry: {
        columns: candidate.subject.columns,
        rows: candidate.subject.rows,
        levels: candidate.subject.levels,
        cubeSizeMm: candidate.subject.cubeSizeMm,
        horizontalGapMm: candidate.subject.horizontalGapMm,
        verticalGapMm: candidate.subject.verticalGapMm,
        subjectDistanceMm: candidate.subjectDistanceMm,
      },
      optics: {
        focalLengthCandidatesMm: [...CAMERA_MOVEMENT_CALIBRATION_SEARCH_SPACE.focalLengthMm],
        provisionalFocalLengthMm: candidate.focalLengthMm,
        provisionalFocusDistanceMm: candidate.focusDistanceMm,
      },
      rig: {
        midRigOriginWorld: {
          x: CAMERA_MOVEMENT_CALIBRATION_BASELINE.subject.originWorld.x,
          y: CAMERA_MOVEMENT_CALIBRATION_BASELINE.subject.originWorld.y,
          z: candidate.subjectDistanceMm - candidate.arcRadiusMm,
        },
        arcAngleDeg: candidate.arcAngleDeg,
      },
    },
  );
  const validation = validateEffectiveCameraMovementCalibration(effectiveCalibration);
  if (!validation.valid) {
    throw new Error(
      `Invalid camera-movement teaching calibration candidate: ${validation.errors
        .map(({ path }) => path)
        .join(", ")}`,
    );
  }
  for (const [name, value] of Object.entries({
    tiltDeg: candidate.tiltDeg,
    riseMm: candidate.riseMm,
    bodyPitchDeg: candidate.bodyPitchDeg,
  })) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new Error(`Camera-movement teaching candidate ${name} must be finite and positive`);
    }
  }

  const lattice = generateCameraMovementLattice(effectiveCalibration.subject);
  const subjectBoundsWorld = Object.freeze({
    min: freezeVec(lattice.bounds.min),
    max: freezeVec(lattice.bounds.max),
  });
  const bodyPitchPivotRigLocal = bodyPivotForCandidate(candidate);
  const teachingCases = createCameraMovementTeachingCases(candidate);
  const oppositeRearTiltProbe = createCameraMovementOppositeRearTiltProbe(candidate);
  const caseEntries = CAMERA_MOVEMENT_TEACHING_CASE_IDS.map((id) => {
    const teaching = getCameraMovementTeachingCase(teachingCases, id);
    return [
      id,
      finiteCaseMetrics(
        candidate,
        effectiveCalibration,
        teaching,
        subjectBoundsWorld,
        bodyPitchPivotRigLocal,
      ),
    ] as const;
  });
  const cases = Object.freeze(
    Object.fromEntries(caseEntries) as Record<
      CameraMovementTeachingCaseId,
      CameraMovementTeachingCaseMetrics<CameraMovementTeachingCaseId>
    >,
  );
  const probes = Object.freeze({
    oppositeRearTilt: finiteCaseMetrics(
      candidate,
      effectiveCalibration,
      oppositeRearTiltProbe,
      subjectBoundsWorld,
      bodyPitchPivotRigLocal,
    ),
  });
  const neutral = cases.neutral;
  const comparisons = Object.freeze(
    Object.fromEntries(
      CAMERA_MOVEMENT_TEACHING_CASE_IDS.map((id) => [id, compareWithNeutral(cases[id], neutral)]),
    ) as Record<CameraMovementTeachingCaseId, CameraMovementTeachingCaseComparison>,
  );
  const allMargins = Object.values(cases).flatMap(({ marginsUv }) => Object.values(marginsUv));
  const nonNeutral = CAMERA_MOVEMENT_TEACHING_CASE_IDS.filter((id) => id !== "neutral");
  const targetOffsets = Object.values(cases).map(({ targetOffsetFromFilmCentreUv }) =>
    Math.hypot(targetOffsetFromFilmCentreUv.u, targetOffsetFromFilmCentreUv.v),
  );

  return Object.freeze({
    candidate: Object.freeze({
      ...candidate,
      subject: Object.freeze({ ...candidate.subject }),
    }),
    effectiveCalibration,
    subjectBoundsWorld,
    cases,
    probes,
    comparisons,
    summary: Object.freeze({
      minimumMarginUv: assertFiniteNumber(Math.min(...allMargins), "summary.minimumMarginUv"),
      minimumProjectedBoundsCoverage: assertFiniteNumber(
        Math.min(
          ...Object.values(cases).map(({ coverage }) => coverage.projectedBoundsInsideFrame),
        ),
        "summary.minimumProjectedBoundsCoverage",
      ),
      maximumTargetOffsetFromFilmCentreUv: assertFiniteNumber(
        Math.max(...targetOffsets),
        "summary.maximumTargetOffsetFromFilmCentreUv",
      ),
      minimumNonNeutralTargetDisplacementUv: assertFiniteNumber(
        Math.min(...nonNeutral.map((id) => comparisons[id].targetDisplacementFromNeutralUv)),
        "summary.minimumNonNeutralTargetDisplacementUv",
      ),
    }),
  });
};
