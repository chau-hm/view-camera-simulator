import type { Bounds3, Vec3 } from "../types/optics";
import { resolveFocusFundamentalsFocusing } from "../core/optics/focusFundamentalsFocusing";
import { DEFAULT_CAMERA_STATE } from "../utils/constants";
import { viewCameraAnatomyScene } from "./definitions/view-camera-anatomy";

const lessonZeroFocusCapability = viewCameraAnatomyScene.focusStandardCapability;
if (!lessonZeroFocusCapability?.enabled) {
  throw new Error("Lesson 0 subject requires selectable finite-focus scene metadata");
}

const lessonZeroDefaultFocalLengthMm =
  viewCameraAnatomyScene.cameraPreset.focalLengthMm ?? DEFAULT_CAMERA_STATE.focalLengthMm;

/**
 * The Lesson 0 target is a neutral studio object, not a focus-task target.
 * Its depth is derived from the same finite-focus solution used by the scene.
 */
export const lessonZeroGroundGlassSubjectReferenceFocusDepthMm =
  lessonZeroFocusCapability.referenceFocusDepthMm;

export type LessonZeroGroundGlassSubjectBox = Readonly<{
  id: string;
  center: Vec3;
  size: Vec3;
}>;

export type LessonZeroGroundGlassSubjectGeometry = Readonly<{
  focusDepthMm: number;
  boxes: readonly LessonZeroGroundGlassSubjectBox[];
  bounds: Bounds3;
}>;

export const resolveLessonZeroGroundGlassSubjectFocusDepthMm = (
  focalLengthMm: number = lessonZeroDefaultFocalLengthMm,
  referenceFocusDepthMm: number = lessonZeroGroundGlassSubjectReferenceFocusDepthMm,
): number => {
  const solution = resolveFocusFundamentalsFocusing({
    standard: "front",
    focusMode: "finite",
    focusDepthMm: referenceFocusDepthMm,
    focalLengthMm,
    referenceFocusDepthMm,
  });

  if (
    solution.fallbackApplied ||
    solution.focusDepthMm === null ||
    !Number.isFinite(solution.focusDepthMm) ||
    !Number.isFinite(solution.lensZMm)
  ) {
    throw new Error("Lesson 0 subject requires a finite canonical focus solution");
  }

  // In the scene-baseline contract the rear-datum focus depth is translated by
  // the solved reference lens position so the scene lens datum remains fixed.
  return solution.focusDepthMm - solution.lensZMm;
};

const boundsFromBoxes = (boxes: readonly LessonZeroGroundGlassSubjectBox[]): Bounds3 => {
  const initial: Bounds3 = {
    min: { x: Number.POSITIVE_INFINITY, y: Number.POSITIVE_INFINITY, z: Number.POSITIVE_INFINITY },
    max: { x: Number.NEGATIVE_INFINITY, y: Number.NEGATIVE_INFINITY, z: Number.NEGATIVE_INFINITY },
  };

  return boxes.reduce((bounds, box) => {
    const half = {
      x: box.size.x / 2,
      y: box.size.y / 2,
      z: box.size.z / 2,
    };
    bounds.min.x = Math.min(bounds.min.x, box.center.x - half.x);
    bounds.min.y = Math.min(bounds.min.y, box.center.y - half.y);
    bounds.min.z = Math.min(bounds.min.z, box.center.z - half.z);
    bounds.max.x = Math.max(bounds.max.x, box.center.x + half.x);
    bounds.max.y = Math.max(bounds.max.y, box.center.y + half.y);
    bounds.max.z = Math.max(bounds.max.z, box.center.z + half.z);
    return bounds;
  }, initial);
};

/**
 * Resolve one shared, high-contrast subject layout for both the interactive
 * R3F scene and the offscreen Ground Glass RTT scene.
 */
export const resolveLessonZeroGroundGlassSubjectGeometry = ({
  focalLengthMm = lessonZeroDefaultFocalLengthMm,
  referenceFocusDepthMm = lessonZeroGroundGlassSubjectReferenceFocusDepthMm,
}: {
  focalLengthMm?: number;
  referenceFocusDepthMm?: number;
} = {}): LessonZeroGroundGlassSubjectGeometry => {
  const focusDepthMm = resolveLessonZeroGroundGlassSubjectFocusDepthMm(
    focalLengthMm,
    referenceFocusDepthMm,
  );
  const boardCenterY = 30;
  const boardWidth = 520;
  const boardHeight = 360;
  const boardFrameWidth = 24;
  const boardFrontZ = focusDepthMm;
  const foregroundZ = focusDepthMm - 4;

  const boxes: LessonZeroGroundGlassSubjectBox[] = [
    {
      id: "target-board",
      center: { x: 0, y: boardCenterY, z: focusDepthMm + 12 },
      size: { x: boardWidth, y: boardHeight, z: 24 },
    },
    {
      id: "target-frame-top",
      center: { x: 0, y: boardCenterY + boardHeight / 2 - boardFrameWidth / 2, z: boardFrontZ - 4 },
      size: { x: boardWidth, y: boardFrameWidth, z: 8 },
    },
    {
      id: "target-frame-bottom",
      center: { x: 0, y: boardCenterY - boardHeight / 2 + boardFrameWidth / 2, z: boardFrontZ - 4 },
      size: { x: boardWidth, y: boardFrameWidth, z: 8 },
    },
    {
      id: "target-frame-left",
      center: { x: -boardWidth / 2 + boardFrameWidth / 2, y: boardCenterY, z: boardFrontZ - 4 },
      size: { x: boardFrameWidth, y: boardHeight - boardFrameWidth * 2, z: 8 },
    },
    {
      id: "target-frame-right",
      center: { x: boardWidth / 2 - boardFrameWidth / 2, y: boardCenterY, z: boardFrontZ - 4 },
      size: { x: boardFrameWidth, y: boardHeight - boardFrameWidth * 2, z: 8 },
    },
    {
      id: "nested-target-panel",
      center: { x: 0, y: boardCenterY, z: foregroundZ },
      size: { x: 300, y: 220, z: 8 },
    },
    {
      id: "nested-target-top",
      center: { x: 0, y: boardCenterY + 110 - 12, z: foregroundZ - 5 },
      size: { x: 300, y: 24, z: 6 },
    },
    {
      id: "nested-target-bottom",
      center: { x: 0, y: boardCenterY - 110 + 12, z: foregroundZ - 5 },
      size: { x: 300, y: 24, z: 6 },
    },
    {
      id: "nested-target-left",
      center: { x: -150 + 12, y: boardCenterY, z: foregroundZ - 5 },
      size: { x: 24, y: 220 - 48, z: 6 },
    },
    {
      id: "nested-target-right",
      center: { x: 150 - 12, y: boardCenterY, z: foregroundZ - 5 },
      size: { x: 24, y: 220 - 48, z: 6 },
    },
    {
      id: "target-cross-horizontal",
      center: { x: 0, y: boardCenterY, z: foregroundZ - 10 },
      size: { x: 210, y: 18, z: 6 },
    },
    {
      id: "target-cross-vertical",
      center: { x: 0, y: boardCenterY, z: foregroundZ - 10 },
      size: { x: 18, y: 160, z: 6 },
    },
    {
      id: "target-centre-square",
      center: { x: 0, y: boardCenterY, z: foregroundZ - 15 },
      size: { x: 42, y: 42, z: 6 },
    },
    {
      id: "target-stand",
      center: { x: 0, y: -210, z: focusDepthMm + 72 },
      size: { x: 28, y: 120, z: 24 },
    },
    {
      id: "target-base",
      center: { x: 0, y: -280, z: focusDepthMm + 90 },
      size: { x: 240, y: 24, z: 110 },
    },
    {
      id: "depth-marker-left",
      center: { x: -325, y: boardCenterY, z: focusDepthMm + 100 },
      size: { x: 26, y: 180, z: 26 },
    },
    {
      id: "depth-marker-right",
      center: { x: 325, y: boardCenterY, z: focusDepthMm + 160 },
      size: { x: 26, y: 180, z: 26 },
    },
  ];

  return {
    focusDepthMm,
    boxes,
    bounds: boundsFromBoxes(boxes),
  };
};

export const lessonZeroGroundGlassSubjectGeometry =
  resolveLessonZeroGroundGlassSubjectGeometry();

export const lessonZeroGroundGlassSubjectFocusDepthMm =
  lessonZeroGroundGlassSubjectGeometry.focusDepthMm;

export const lessonZeroGroundGlassSubjectCenterMm: Vec3 = {
  x: 0,
  y: 0,
  z: lessonZeroGroundGlassSubjectFocusDepthMm,
};

export const lessonZeroGroundGlassSubjectBoundsMm =
  lessonZeroGroundGlassSubjectGeometry.bounds;
