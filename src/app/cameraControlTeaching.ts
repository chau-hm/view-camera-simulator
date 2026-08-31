import type { FocusStandard, CameraState } from "../types/camera";
import type { CameraMovementField } from "../types/scene";
import type { LessonZeroAnatomyTarget } from "./anatomyLesson";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../utils/constants";

export type CameraControlTeachingId =
  | "front-rise"
  | "front-shift"
  | "front-tilt"
  | "front-swing"
  | "rear-rise"
  | "rear-shift"
  | "rear-tilt"
  | "rear-swing"
  | "focus-front"
  | "focus-rear"
  | "aperture";

export type CameraMovementTeachingKind = "rise" | "shift" | "tilt" | "swing";

export type CameraControlTeachingDefinition =
  | {
      id: CameraControlTeachingId;
      kind: "movement";
      anatomyTargets: readonly LessonZeroAnatomyTarget[];
      movementField: CameraMovementField;
      movementKind: CameraMovementTeachingKind;
    }
  | {
      id: CameraControlTeachingId;
      kind: "focus";
      anatomyTargets: readonly LessonZeroAnatomyTarget[];
      focusStandard: FocusStandard;
    }
  | {
      id: CameraControlTeachingId;
      kind: "aperture";
      anatomyTargets: readonly LessonZeroAnatomyTarget[];
    };

const movement = (
  id: CameraControlTeachingId,
  movementField: CameraMovementField,
  movementKind: CameraMovementTeachingKind,
  anatomyTargets: readonly LessonZeroAnatomyTarget[],
): CameraControlTeachingDefinition => ({
  id,
  kind: "movement",
  anatomyTargets,
  movementField,
  movementKind,
});

/**
 * One reusable mapping from public control identity to the physical camera
 * anatomy and canonical state field it affects. Rear entries are intentionally
 * available to future lessons without being exposed by Lesson 0.
 */
export const CAMERA_CONTROL_TEACHING: Record<
  CameraControlTeachingId,
  CameraControlTeachingDefinition
> = {
  "front-rise": movement("front-rise", "frontRiseMm", "rise", ["front-standard"]),
  "front-shift": movement("front-shift", "frontShiftMm", "shift", ["front-standard"]),
  "front-tilt": movement("front-tilt", "frontTiltDeg", "tilt", ["front-standard"]),
  "front-swing": movement("front-swing", "frontSwingDeg", "swing", ["front-standard"]),
  "rear-rise": movement("rear-rise", "rearRiseMm", "rise", ["rear-standard"]),
  "rear-shift": movement("rear-shift", "rearShiftMm", "shift", ["rear-standard"]),
  "rear-tilt": movement("rear-tilt", "rearTiltDeg", "tilt", ["rear-standard"]),
  "rear-swing": movement("rear-swing", "rearSwingDeg", "swing", ["rear-standard"]),
  "focus-front": {
    id: "focus-front",
    kind: "focus",
    anatomyTargets: ["front-standard", "bellows"],
    focusStandard: "front",
  },
  "focus-rear": {
    id: "focus-rear",
    kind: "focus",
    anatomyTargets: ["rear-standard", "bellows"],
    focusStandard: "rear",
  },
  aperture: {
    id: "aperture",
    kind: "aperture",
    anatomyTargets: ["aperture"],
  },
};

export const getCameraControlTeachingDefinition = (
  id: CameraControlTeachingId,
): CameraControlTeachingDefinition => CAMERA_CONTROL_TEACHING[id];

const movementCompletionThreshold = (
  movementKind: CameraMovementTeachingKind,
): number => {
  switch (movementKind) {
    case "rise":
    case "shift":
      return 8;
    case "tilt":
    case "swing":
      return 2;
  }
};

const resolveMovementValue = (
  camera: CameraState,
  field: CameraMovementField,
): number => camera[field];

/**
 * A forgiving completion contract: the learner only needs to make the
 * physical change visible, not land on a hidden target value.
 */
export const resolveCameraControlTeachingCompletion = (
  id: CameraControlTeachingId,
  camera: CameraState,
): boolean => {
  const definition = getCameraControlTeachingDefinition(id);

  switch (definition.kind) {
    case "movement":
      return (
        Math.abs(resolveMovementValue(camera, definition.movementField)) >=
        movementCompletionThreshold(definition.movementKind)
      );
    case "focus":
      return (
        camera.focusStandard === definition.focusStandard &&
        Number.isFinite(camera.focusDistanceMm) &&
        Math.abs(camera.focusDistanceMm - CAMERA_CONSTANTS.defaultFocusDistanceMm) >= 50
      );
    case "aperture":
      return camera.aperture !== DEFAULT_CAMERA_STATE.aperture;
  }
};
