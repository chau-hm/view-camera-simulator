import { clamp } from "../core/math/clamps";
import type {
  ActiveStandard,
  CameraMovementLessonState,
  MovementStudy,
} from "../types/camera";
import type {
  CameraRigPlacement,
  CameraRigViewpointAnchor,
} from "../types/optics";
import {
  resolveCameraRigViewpointPlacementAtT,
  type CameraRigViewpointArcCalibration,
} from "./cameraRigViewpointGeometry";
import {
  CAMERA_MOVEMENT_VERTICAL_FRAMING_ENDPOINTS,
  createCameraMovementVerticalFramingEndpoints,
  CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
  type CameraMovementPresentationRegion,
  type CameraMovementTargetRegion,
  type CameraMovementVerticalFramingEndpoints,
} from "./cameraMovementSceneCalibration";

export { CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS } from "./cameraMovementSceneCalibration";

export const DEFAULT_CAMERA_MOVEMENT_LESSON_STATE: CameraMovementLessonState = Object.freeze({
  study: "viewpoint",
  viewpointT: 0,
  activeStandard: "front",
  tiltDeg: 0,
  framingT: 0,
});

const isMovementStudy = (value: unknown): value is MovementStudy =>
  value === "viewpoint" || value === "tilt" || value === "vertical-framing";

const isActiveStandard = (value: unknown): value is ActiveStandard =>
  value === "front" || value === "rear";

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

const LESSON_TILT_LIMIT_DEG = Math.abs(CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.tiltDeg);

/**
 * Normalize the lesson state at the canonical state boundary. Inactive study
 * dimensions are zeroed here so stale values cannot leak into physical views.
 */
export const normalizeCameraMovementLessonState = (
  input?: Partial<CameraMovementLessonState> | null,
): CameraMovementLessonState => {
  const study = isMovementStudy(input?.study)
    ? input!.study
    : DEFAULT_CAMERA_MOVEMENT_LESSON_STATE.study;
  const activeStandard = isActiveStandard(input?.activeStandard)
    ? input!.activeStandard
    : DEFAULT_CAMERA_MOVEMENT_LESSON_STATE.activeStandard;
  const viewpointT = clamp(
    finiteOr(input?.viewpointT, 0),
    -1,
    1,
  );
  const tiltDeg = clamp(
    finiteOr(input?.tiltDeg, 0),
    -LESSON_TILT_LIMIT_DEG,
    LESSON_TILT_LIMIT_DEG,
  );
  const framingT = clamp(finiteOr(input?.framingT, 0), -1, 1);

  return Object.freeze({
    study,
    viewpointT: study === "viewpoint" ? viewpointT : 0,
    activeStandard,
    tiltDeg: study === "tilt" ? tiltDeg : 0,
    framingT: study === "vertical-framing" ? framingT : 0,
  });
};

export const cameraMovementLessonStatesEqual = (
  first: CameraMovementLessonState,
  second: CameraMovementLessonState,
): boolean => {
  const a = normalizeCameraMovementLessonState(first);
  const b = normalizeCameraMovementLessonState(second);
  if (a.study !== b.study) return false;
  switch (a.study) {
    case "viewpoint":
      // The selected standard is retained as a future-control preference, but
      // has no physical or semantic meaning while the whole camera moves.
      return a.viewpointT === b.viewpointT;
    case "tilt":
      return (
        a.activeStandard === b.activeStandard &&
        a.tiltDeg === b.tiltDeg
      );
    case "vertical-framing":
      return (
        a.activeStandard === b.activeStandard &&
        a.framingT === b.framingT
      );
  }
};

/**
 * Compatibility projection consumed by the canonical optics resolver. The
 * repository does not store a separate camera quaternion/target in lesson
 * state: `deriveOpticsState` materializes the equivalent camera position,
 * target, and orientation as `lensCenterWorld`, `focusPointWorld`, and the
 * normalized `opticalAxis` for every downstream view.
 */
export type CameraMovementLessonDerivedState = Readonly<{
  lessonState: CameraMovementLessonState;
  viewpointT: number;
  activeStandard: ActiveStandard;
  tiltDeg: number;
  framingT: number;
  viewpointAnchor: CameraRigViewpointAnchor;
  cameraRigPlacement: CameraRigPlacement;
  cameraBodyPitchDeg: number;
  frontRiseMm: number;
  frontTiltDeg: number;
  frontSwingDeg: 0;
  rearRiseMm: number;
  rearTiltDeg: number;
  targetRegion: CameraMovementTargetRegion;
  presentationTargetRegion: CameraMovementPresentationRegion;
}>;

const targetRegionForSignedT = (value: number): CameraMovementTargetRegion =>
  value > 0 ? "upper" : value < 0 ? "lower" : "middle";

const resolveVerticalFramingMillimetres = (
  framingT: number,
  activeStandard: ActiveStandard,
  endpoints: CameraMovementVerticalFramingEndpoints,
): number => {
  const endpoint = endpoints[activeStandard];
  if (framingT >= 0) return framingT * endpoint.upperMm;
  return -framingT * endpoint.lowerMm;
};

/**
 * Derive all legacy camera fields required by optics/render consumers from the
 * continuous lesson state. Viewpoint interpolation is piecewise Low -> Mid
 * and Mid -> High, using each endpoint's own calibration; Low and High are
 * never assumed to be symmetrical. Vertical framing similarly interpolates
 * between the selected standard's signed lower and upper endpoints.
 */
export const resolveCameraMovementLessonState = (
  lessonState: CameraMovementLessonState,
  cameraRig: CameraRigViewpointArcCalibration,
  teachingMovements: typeof CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS =
    CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS,
  verticalFramingEndpoints?: CameraMovementVerticalFramingEndpoints,
): CameraMovementLessonDerivedState => {
  const normalized = normalizeCameraMovementLessonState(lessonState);
  const viewpointT = normalized.study === "viewpoint" ? normalized.viewpointT : 0;
  const tiltDeg = normalized.study === "tilt" ? normalized.tiltDeg : 0;
  const framingT = normalized.study === "vertical-framing" ? normalized.framingT : 0;
  const cameraRigPlacement = resolveCameraRigViewpointPlacementAtT(
    cameraRig,
    viewpointT,
  );
  const viewpointAnchor = cameraRigPlacement.anchor;
  const resolvedVerticalFramingEndpoints =
    verticalFramingEndpoints ??
    (teachingMovements === CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS
      ? CAMERA_MOVEMENT_VERTICAL_FRAMING_ENDPOINTS
      : createCameraMovementVerticalFramingEndpoints(teachingMovements.riseMm));
  const riseMm = resolveVerticalFramingMillimetres(
    framingT,
    normalized.activeStandard,
    resolvedVerticalFramingEndpoints,
  );
  const targetRegion =
    normalized.study === "viewpoint"
      ? targetRegionForSignedT(viewpointT)
      : "middle";
  const presentationTargetRegion =
    normalized.study === "vertical-framing"
      ? targetRegionForSignedT(framingT)
      : normalized.study === "viewpoint"
        ? "whole"
        : "middle";
  const highBodyPitchDeg =
    cameraRig.highBodyPitchDeg ?? teachingMovements.bodyPitchDeg;
  const lowBodyPitchDeg =
    cameraRig.lowBodyPitchDeg ?? -teachingMovements.bodyPitchDeg;
  const cameraBodyPitchDeg =
    viewpointT > 0
      ? highBodyPitchDeg * viewpointT
      : viewpointT < 0
        ? lowBodyPitchDeg * -viewpointT
        : 0;

  return Object.freeze({
    lessonState: normalized,
    viewpointT,
    activeStandard: normalized.activeStandard,
    tiltDeg,
    framingT,
    viewpointAnchor,
    cameraRigPlacement,
    cameraBodyPitchDeg,
    frontRiseMm: normalized.activeStandard === "front" ? riseMm : 0,
    frontTiltDeg: normalized.activeStandard === "front" ? tiltDeg : 0,
    frontSwingDeg: 0,
    rearRiseMm: normalized.activeStandard === "rear" ? riseMm : 0,
    rearTiltDeg: normalized.activeStandard === "rear" ? tiltDeg : 0,
    targetRegion,
    presentationTargetRegion,
  });
};

export const resolveCameraMovementLessonPresentationTargetRegion = (
  lessonState: CameraMovementLessonState,
): CameraMovementPresentationRegion => {
  const normalized = normalizeCameraMovementLessonState(lessonState);
  return normalized.study === "vertical-framing"
    ? targetRegionForSignedT(normalized.framingT)
    : normalized.study === "viewpoint"
      ? "whole"
      : "middle";
};
