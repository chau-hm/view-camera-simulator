import type { CameraRigViewpointAnchor } from "../types/optics";
import {
  CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION,
  type CameraMovementTargetRegion,
} from "./cameraMovementSceneCalibration";

export const CAMERA_MOVEMENT_TEACHING_CASE_IDS = [
  "neutral",
  "A-front-tilt",
  "B-rear-tilt",
  "C1-front-rise",
  "C2-rear-rise",
  "C3-high-viewpoint",
  "D1-front-fall",
  "D2-rear-fall",
  "D3-low-viewpoint",
] as const;

export type CameraMovementTeachingCaseId = (typeof CAMERA_MOVEMENT_TEACHING_CASE_IDS)[number];

export const CAMERA_MOVEMENT_OPPOSITE_REAR_TILT_PROBE_ID = "B-opposite-rear-tilt-probe" as const;

export type CameraMovementTeachingCalibrationCandidate = Readonly<{
  subject: Readonly<{
    columns: number;
    rows: number;
    levels: number;
    cubeSizeMm: number;
    horizontalGapMm: number;
    verticalGapMm: number;
  }>;
  subjectDistanceMm: number;
  focalLengthMm: number;
  focusDistanceMm: number;
  arcAngleDeg: number;
  tiltDeg: number;
  riseMm: number;
  bodyPitchDeg: number;
}>;

/** Internal teaching movements selected after the physical scene evaluation. */
export const CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS = Object.freeze({
  tiltDeg: 5,
  riseMm: 20,
  bodyPitchDeg: 34,
});

const selectedPhysical = CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION;

/**
 * Lightweight runtime contract for the selected teaching cases.
 *
 * It derives physical values from the one raw selection. The candidate does
 * not store a rig radius; the effective calibration derives the mid-anchor
 * radius and carries the selected high-viewpoint radius plus the D3 low-only
 * distance override.
 */
export const CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION = Object.freeze({
  subject: Object.freeze({
    columns: selectedPhysical.subject.columns,
    rows: selectedPhysical.subject.rows,
    levels: selectedPhysical.subject.levels,
    cubeSizeMm: selectedPhysical.subject.cubeSizeMm,
    horizontalGapMm: selectedPhysical.subject.horizontalGapMm,
    verticalGapMm: selectedPhysical.subject.verticalGapMm,
  }),
  subjectDistanceMm: selectedPhysical.subject.subjectDistanceMm,
  focalLengthMm: selectedPhysical.optics.focalLengthMm,
  focusDistanceMm: selectedPhysical.optics.focusDistanceMm,
  arcAngleDeg: selectedPhysical.cameraRig.arcAngleDeg,
  ...CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
}) satisfies CameraMovementTeachingCalibrationCandidate;

export type CameraMovementTeachingMovements = Readonly<{
  frontRiseMm: number;
  rearRiseMm: number;
  frontTiltDeg: number;
  rearTiltDeg: number;
  frontSwingDeg: 0;
  cameraBodyPitchDeg: number;
}>;

export type CameraMovementTeachingCase = Readonly<{
  id: CameraMovementTeachingCaseId;
  anchor: CameraRigViewpointAnchor;
  targetRegion: CameraMovementTargetRegion;
  camera: CameraMovementTeachingMovements;
}>;

export type CameraMovementOppositeRearTiltProbe = Readonly<{
  id: typeof CAMERA_MOVEMENT_OPPOSITE_REAR_TILT_PROBE_ID;
  anchor: "mid";
  targetRegion: "middle";
  camera: CameraMovementTeachingMovements;
}>;

const CASE_ID_SET: ReadonlySet<string> = new Set(CAMERA_MOVEMENT_TEACHING_CASE_IDS);

const freezeCamera = (camera: CameraMovementTeachingMovements): CameraMovementTeachingMovements =>
  Object.freeze({ ...camera });

const teachingCase = (
  id: CameraMovementTeachingCaseId,
  anchor: CameraRigViewpointAnchor,
  targetRegion: CameraMovementTargetRegion,
  camera: CameraMovementTeachingMovements,
): CameraMovementTeachingCase =>
  Object.freeze({
    id,
    anchor,
    targetRegion,
    camera: freezeCamera(camera),
  });

const neutralMovements = (): CameraMovementTeachingMovements => ({
  frontRiseMm: 0,
  rearRiseMm: 0,
  frontTiltDeg: 0,
  rearTiltDeg: 0,
  frontSwingDeg: 0,
  cameraBodyPitchDeg: 0,
});

export const createCameraMovementTeachingCases = (
  candidate: CameraMovementTeachingCalibrationCandidate,
): Readonly<Record<CameraMovementTeachingCaseId, CameraMovementTeachingCase>> => {
  const neutral = neutralMovements();
  const cases: Record<CameraMovementTeachingCaseId, CameraMovementTeachingCase> = {
    neutral: teachingCase("neutral", "mid", "middle", neutral),
    "A-front-tilt": teachingCase("A-front-tilt", "mid", "middle", {
      ...neutral,
      frontTiltDeg: candidate.tiltDeg,
    }),
    "B-rear-tilt": teachingCase("B-rear-tilt", "mid", "middle", {
      ...neutral,
      rearTiltDeg: candidate.tiltDeg,
    }),
    "C1-front-rise": teachingCase("C1-front-rise", "mid", "middle", {
      ...neutral,
      frontRiseMm: candidate.riseMm,
    }),
    "C2-rear-rise": teachingCase("C2-rear-rise", "mid", "middle", {
      ...neutral,
      rearRiseMm: candidate.riseMm,
    }),
    "C3-high-viewpoint": teachingCase("C3-high-viewpoint", "high", "upper", {
      ...neutral,
      cameraBodyPitchDeg: candidate.bodyPitchDeg,
    }),
    "D1-front-fall": teachingCase("D1-front-fall", "mid", "middle", {
      ...neutral,
      frontRiseMm: -candidate.riseMm,
    }),
    "D2-rear-fall": teachingCase("D2-rear-fall", "mid", "middle", {
      ...neutral,
      rearRiseMm: -candidate.riseMm,
    }),
    "D3-low-viewpoint": teachingCase("D3-low-viewpoint", "low", "lower", {
      ...neutral,
      cameraBodyPitchDeg: -candidate.bodyPitchDeg,
    }),
  };
  return Object.freeze(cases);
};

/** Canonical negative-sign probe paired with the positive B teaching case. */
export const createCameraMovementOppositeRearTiltProbe = (
  candidate: CameraMovementTeachingCalibrationCandidate,
): CameraMovementOppositeRearTiltProbe =>
  Object.freeze({
    id: CAMERA_MOVEMENT_OPPOSITE_REAR_TILT_PROBE_ID,
    anchor: "mid",
    targetRegion: "middle",
    camera: freezeCamera({
      ...neutralMovements(),
      rearTiltDeg: -candidate.tiltDeg,
    }),
  });

export const getCameraMovementTeachingCase = (
  cases: Readonly<Record<CameraMovementTeachingCaseId, CameraMovementTeachingCase>>,
  id: string,
): CameraMovementTeachingCase => {
  if (!CASE_ID_SET.has(id)) {
    throw new Error(`Unknown camera-movement teaching case: ${id}`);
  }
  return cases[id as CameraMovementTeachingCaseId];
};
