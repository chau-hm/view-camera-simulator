import type { CameraMovementLessonState, CameraState } from "../types/camera";
import type { CameraRigViewpointAnchor } from "../types/optics";
import { formatDegrees, formatMillimeter } from "../utils/formatters";
import {
  cameraMovementLessonStatesEqual,
} from "./cameraMovementLessonState";
import {
  CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION,
  createCameraMovementTeachingCases,
  getCameraMovementTeachingCase,
  type CameraMovementTeachingCaseId,
} from "./cameraMovementTeachingCases";
import type { CameraMovementTargetRegion } from "./cameraMovementSceneCalibration";

/**
 * Public teaching-case contract for Understanding Camera Movements.
 *
 * Values are resolved only through the canonical PR #32 candidate and are never
 * duplicated as literals in UI components or display helpers. UI layers consume
 * the resolved case and format labels from shared helpers.
 */
export const CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES = Object.freeze(
  createCameraMovementTeachingCases(CAMERA_MOVEMENT_SELECTED_TEACHING_CALIBRATION),
);

export type CameraMovementPublicCaseId = CameraMovementTeachingCaseId;

/**
 * Documented numerical tolerance used by the active-case matcher.
 *
 * Public control steps round tilt/swing to 0.1° and rise to 1 mm, and the
 * canonical values are whole degrees/millimetres. A 1e-6 relative comparison
 * is far tighter than the public step yet absorbs floating-point noise from
 * resolving canonical placements. It deliberately does not accept arbitrary
 * user-entered drift, so manual/calibration states resolve to "custom".
 */
export const CAMERA_MOVEMENT_CASE_MATCH_TOLERANCE = 1e-6;

const CAMERA_MOVEMENT_TEACHING_CASE_ORDER = [
  "neutral",
  "A-front-tilt",
  "B-rear-tilt",
  "C1-front-rise",
  "C2-rear-rise",
  "C3-high-viewpoint",
  "D1-front-fall",
  "D2-rear-fall",
  "D3-low-viewpoint",
] as const satisfies ReadonlyArray<CameraMovementPublicCaseId>;

const approxEqual = (a: number, b: number): boolean =>
  Number.isFinite(a) &&
  Number.isFinite(b) &&
  Math.abs(a - b) <= CAMERA_MOVEMENT_CASE_MATCH_TOLERANCE * Math.max(1, Math.abs(a), Math.abs(b));

const matchMovement = (
  camera: Pick<
    CameraState,
    | "frontRiseMm"
    | "rearRiseMm"
    | "frontTiltDeg"
    | "rearTiltDeg"
    | "frontSwingDeg"
    | "cameraBodyPitchDeg"
  >,
  expected: Pick<
    CameraState,
    | "frontRiseMm"
    | "rearRiseMm"
    | "frontTiltDeg"
    | "rearTiltDeg"
    | "frontSwingDeg"
    | "cameraBodyPitchDeg"
  >,
): boolean =>
  approxEqual(camera.frontRiseMm, expected.frontRiseMm) &&
  approxEqual(camera.rearRiseMm, expected.rearRiseMm) &&
  approxEqual(camera.frontTiltDeg, expected.frontTiltDeg) &&
  approxEqual(camera.rearTiltDeg, expected.rearTiltDeg) &&
  approxEqual(camera.frontSwingDeg, expected.frontSwingDeg) &&
  approxEqual(camera.cameraBodyPitchDeg, expected.cameraBodyPitchDeg);

/**
 * Match the effective scene state against a teaching case. Returns the case id
 * when the anchor, target region, and every movement agree with the canonical
 * case within the documented tolerance, otherwise null ("custom").
 */
export const matchCameraMovementTeachingCase = (input: {
  anchor: CameraRigViewpointAnchor;
  targetRegion: CameraMovementTargetRegion;
  camera: Pick<
    CameraState,
    | "frontRiseMm"
    | "rearRiseMm"
    | "frontTiltDeg"
    | "rearTiltDeg"
    | "frontSwingDeg"
    | "cameraBodyPitchDeg"
    | "focusMode"
    | "cameraMovementLessonState"
  >;
}): CameraMovementPublicCaseId | null => {
  // Public teaching cases are finite-focus instructional states. Keep legacy
  // fixtures that omit focusMode compatible, but never classify an explicit
  // infinity state as a case.
  if (input.camera.focusMode === "infinity") return null;

  if (input.camera.cameraMovementLessonState) {
    for (const id of CAMERA_MOVEMENT_TEACHING_CASE_ORDER) {
      if (
        cameraMovementLessonStatesEqual(
          input.camera.cameraMovementLessonState,
          CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id].lessonState,
        )
      ) {
        return id;
      }
    }
    return null;
  }

  for (const id of CAMERA_MOVEMENT_TEACHING_CASE_ORDER) {
    const teachingCase = CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[id];
    if (
      teachingCase.anchor === input.anchor &&
      teachingCase.targetRegion === input.targetRegion &&
      matchMovement(input.camera, teachingCase.camera)
    ) {
      return id;
    }
  }
  return null;
};

/**
 * Build the atomic patch that applies one teaching case in a single state
 * transaction. Only canonical fields change; focal length, focus distance,
 * aperture, render quality, overlay options, orbit/observer state, expanded
 * viewport, and Ground Glass pan/zoom are deliberately left untouched by the
 * caller's spread of the previous camera/scene state.
 */
export const buildCameraMovementTeachingCasePatch = (
  caseId: CameraMovementPublicCaseId,
): {
  camera: Pick<
    CameraState,
    | "frontRiseMm"
    | "rearRiseMm"
    | "frontTiltDeg"
    | "rearTiltDeg"
    | "frontSwingDeg"
    | "cameraBodyPitchDeg"
    | "viewpointAnchor"
  >;
  lessonState: CameraMovementLessonState;
  targetRegion: CameraMovementTargetRegion;
} => {
  const teachingCase = getCameraMovementTeachingCase(
    CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES,
    caseId,
  );
  return {
    lessonState: teachingCase.lessonState,
    camera: {
      frontRiseMm: teachingCase.camera.frontRiseMm,
      rearRiseMm: teachingCase.camera.rearRiseMm,
      frontTiltDeg: teachingCase.camera.frontTiltDeg,
      rearTiltDeg: teachingCase.camera.rearTiltDeg,
      frontSwingDeg: teachingCase.camera.frontSwingDeg,
      cameraBodyPitchDeg: teachingCase.camera.cameraBodyPitchDeg,
      viewpointAnchor: teachingCase.anchor,
    },
    targetRegion: teachingCase.targetRegion,
  };
};

/** Public readout for the active movement, derived from the matched case. */
export type CameraMovementPublicReadout = {
  caseId: CameraMovementPublicCaseId;
  title: string;
  label: string;
  value: string;
};

const CASE_TITLES: Readonly<Record<CameraMovementPublicCaseId, string>> = {
  neutral: "No movement",
  "A-front-tilt": "Front tilt",
  "B-rear-tilt": "Rear tilt",
  "C1-front-rise": "Front rise",
  "C2-rear-rise": "Rear rise",
  "C3-high-viewpoint": "Higher viewpoint",
  "D1-front-fall": "Front fall",
  "D2-rear-fall": "Rear fall",
  "D3-low-viewpoint": "Lower viewpoint",
};

const CASE_CODES: Readonly<Record<CameraMovementPublicCaseId, string>> = {
  neutral: "Neutral",
  "A-front-tilt": "A",
  "B-rear-tilt": "B",
  "C1-front-rise": "C1",
  "C2-rear-rise": "C2",
  "C3-high-viewpoint": "C3",
  "D1-front-fall": "D1",
  "D2-rear-fall": "D2",
  "D3-low-viewpoint": "D3",
};

/**
 * Format one case's primary movement for display.
 *
 * The label is the complete single-line readout (matching the public
 * examples). Negative rise values are described as "fall" and never shown as
 * "rise −20 mm"; C2/D2 are never described as front rise. Values are derived
 * from the canonical teaching case, not duplicated as literals here.
 */
export const formatCameraMovementPublicReadout = (
  caseId: CameraMovementPublicCaseId,
): CameraMovementPublicReadout => {
  const teachingCase = CAMERA_MOVEMENT_PUBLIC_TEACHING_CASES[caseId];
  const title = CASE_TITLES[caseId];
  const code = CASE_CODES[caseId];

  const signedPitch = (deg: number): string =>
    deg >= 0 ? `+${formatDegrees(deg)}` : `−${formatDegrees(Math.abs(deg))}`;
  const signedDeg = (deg: number): string =>
    deg >= 0 ? `+${formatDegrees(deg)}` : formatDegrees(deg);

  let label: string;
  if (caseId === "neutral") {
    label = `${code} · ${title}`;
  } else if (caseId === "C3-high-viewpoint") {
    label = `${code} · ${title} · Body pitch ${signedPitch(teachingCase.camera.cameraBodyPitchDeg)}`;
  } else if (caseId === "D3-low-viewpoint") {
    label = `${code} · ${title} · Body pitch ${signedPitch(teachingCase.camera.cameraBodyPitchDeg)}`;
  } else if (caseId === "A-front-tilt" || caseId === "B-rear-tilt") {
    const deg = teachingCase.camera.frontTiltDeg || teachingCase.camera.rearTiltDeg;
    label = `${code} · ${title} ${signedDeg(deg)}`;
  } else {
    const riseField = caseId.includes("front") ? "frontRiseMm" : "rearRiseMm";
    const riseMm = teachingCase.camera[riseField];
    const isFall = riseMm < 0;
    const magnitudeMm = Math.abs(riseMm);
    label = isFall
      ? `${code} · ${title} ${formatMillimeter(magnitudeMm)}`
      : `${code} · ${title} +${formatMillimeter(riseMm)}`;
  }

  return { caseId, title, label, value: "" };
};
