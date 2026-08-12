import type { CameraState, FocusStandard } from "../types/camera";
import type { DerivedOpticsState, Vec3 } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { DEFAULT_CAMERA_STATE } from "../utils/constants";

export type FocusFundamentalsTeachingCue = {
  activeStandard: FocusStandard;
  currentPosition: Vec3;
  referencePosition: Vec3;
  signedMovementMm: number;
  distanceMm: number;
};

const isFocusFundamentalsScene = (scene: SceneDefinition): boolean =>
  scene.id === "focus-fundamentals-two-targets";

export const resolveFocusFundamentalsActiveStandard = (
  opticsState: DerivedOpticsState,
): FocusStandard => opticsState.diagnostics.focusStandard ?? "front";

/**
 * Derive the declared Focus Fundamentals reference position through the same
 * canonical optics resolver used for the current state. This deliberately
 * does not reconstruct thin-lens geometry in the presentation layer.
 */
export const deriveFocusFundamentalsReferenceOptics = (
  opticsState: DerivedOpticsState,
  scene: SceneDefinition,
  focalLengthMm?: number,
): DerivedOpticsState | null => {
  if (!isFocusFundamentalsScene(scene) || !scene.focusStandardCapability?.enabled) {
    return null;
  }

  const referenceCamera: CameraState = {
    ...DEFAULT_CAMERA_STATE,
    ...scene.cameraPreset,
    activeSceneId: scene.id,
    focalLengthMm:
      Number.isFinite(focalLengthMm) && focalLengthMm! > 0
        ? focalLengthMm!
        : scene.cameraPreset.focalLengthMm ?? DEFAULT_CAMERA_STATE.focalLengthMm,
    focusDistanceMm: scene.focusStandardCapability.referenceFocusDepthMm,
    // The teaching reference is always the finite scene datum. Infinity is a
    // current state to compare against, not a replacement reference datum.
    focusMode: "finite",
    focusStandard: resolveFocusFundamentalsActiveStandard(opticsState),
  };

  return deriveOpticsState(referenceCamera, scene);
};

export const resolveFocusFundamentalsTeachingCue = (
  opticsState: DerivedOpticsState,
  referenceOpticsState: DerivedOpticsState,
): FocusFundamentalsTeachingCue => {
  const activeStandard = resolveFocusFundamentalsActiveStandard(opticsState);
  const currentPosition =
    activeStandard === "front"
      ? opticsState.lensCenterWorld
      : opticsState.rearStandardFrame.centerWorld;
  const referencePosition =
    activeStandard === "front"
      ? referenceOpticsState.lensCenterWorld
      : referenceOpticsState.rearStandardFrame.centerWorld;
  const delta = {
    x: currentPosition.x - referencePosition.x,
    y: currentPosition.y - referencePosition.y,
    z: currentPosition.z - referencePosition.z,
  };
  const distanceMm = Math.hypot(delta.x, delta.y, delta.z);

  return {
    activeStandard,
    currentPosition,
    referencePosition,
    signedMovementMm:
      delta.x * opticsState.opticalAxis.direction.x +
      delta.y * opticsState.opticalAxis.direction.y +
      delta.z * opticsState.opticalAxis.direction.z,
    distanceMm,
  };
};
