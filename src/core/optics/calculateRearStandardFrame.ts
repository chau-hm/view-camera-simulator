import type { FilmPlaneCorners, Plane, StandardFrame, Vec3 } from "../../types/optics";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { planeFromPointNormal } from "../math/plane";
import { add, dot, rotateAroundX, safeNormalize, scale, subtract, vec } from "../math/vec";

/**
 * Construct the canonical rear-standard frame and oriented film corners
 * from a baseline film centre, rear rise, and rear tilt.
 *
 * Transform order:
 * 1. Start with the existing baseline film centre.
 * 2. Translate the rear-standard centre by rearRiseMm along world +Y.
 * 3. Rotate the rear-standard local up and normal axes around world X by rearTiltDeg.
 * 4. Rotate around the translated film centre (centre-axis tilt).
 * 5. Construct the film plane from the transformed centre and normal.
 * 6. Construct all four corners from the transformed centre, right axis, and up axis.
 *
 * At rearTiltDeg = 0: rightWorld = +X, upWorld = +Y, normalWorld = +Z.
 * At rearRiseMm = 0 and rearTiltDeg = 0: matches the previous world-aligned implementation.
 */
export const calculateRearStandardFrame = (
  baselineFilmCenterWorld: Vec3,
  rearRiseMm: number,
  rearTiltDeg: number,
  filmWidthMm: number = CAMERA_CONSTANTS.filmWidthMm,
  filmHeightMm: number = CAMERA_CONSTANTS.filmHeightMm,
): { frame: StandardFrame; corners: FilmPlaneCorners } => {
  const rightWorld = vec(1, 0, 0);

  const baseUp = vec(0, 1, 0);
  const baseNormal = vec(0, 0, 1);

  const upWorld = safeNormalize(rotateAroundX(baseUp, rearTiltDeg), baseUp);
  const normalWorld = safeNormalize(rotateAroundX(baseNormal, rearTiltDeg), baseNormal);

  const centerWorld = add(baselineFilmCenterWorld, vec(0, rearRiseMm, 0));

  const plane: Plane = planeFromPointNormal(centerWorld, normalWorld);

  const halfWidth = filmWidthMm / 2;
  const halfHeight = filmHeightMm / 2;

  const rightHalf = scale(rightWorld, halfWidth);
  const upHalf = scale(upWorld, halfHeight);

  const corners: FilmPlaneCorners = {
    topLeft: add(subtract(centerWorld, rightHalf), upHalf),
    topRight: add(add(centerWorld, rightHalf), upHalf),
    bottomLeft: subtract(subtract(centerWorld, rightHalf), upHalf),
    bottomRight: subtract(add(centerWorld, rightHalf), upHalf),
  };

  return {
    frame: {
      centerWorld,
      rightWorld,
      upWorld,
      normalWorld,
      plane,
    },
    corners,
  };
};

/**
 * Verify oriented film-corner invariants.
 * Returns null if all checks pass, or an error message string.
 */
export const validateFilmCorners = (
  corners: FilmPlaneCorners,
  frame: StandardFrame,
  filmWidthMm: number,
  filmHeightMm: number,
): string | null => {
  const { centerWorld, rightWorld, upWorld, normalWorld } = frame;

  const topEdge = subtract(corners.topRight, corners.topLeft);
  const bottomEdge = subtract(corners.bottomRight, corners.bottomLeft);
  const leftEdge = subtract(corners.bottomLeft, corners.topLeft);
  const rightEdge = subtract(corners.bottomRight, corners.topRight);

  const topLen = Math.abs(dot(topEdge, rightWorld));
  const bottomLen = Math.abs(dot(bottomEdge, rightWorld));
  if (Math.abs(topLen - filmWidthMm) > 1e-9 || Math.abs(bottomLen - filmWidthMm) > 1e-9) {
    return "top/bottom edge length mismatch";
  }

  const leftLen = Math.abs(dot(leftEdge, upWorld));
  const rightLen = Math.abs(dot(rightEdge, upWorld));
  if (Math.abs(leftLen - filmHeightMm) > 1e-9 || Math.abs(rightLen - filmHeightMm) > 1e-9) {
    return "left/right edge length mismatch";
  }

  const avg = scale(
    add(add(corners.topLeft, corners.topRight), add(corners.bottomLeft, corners.bottomRight)),
    0.25,
  );
  if (
    Math.abs(avg.x - centerWorld.x) > 1e-9 ||
    Math.abs(avg.y - centerWorld.y) > 1e-9 ||
    Math.abs(avg.z - centerWorld.z) > 1e-9
  ) {
    return "corner average does not equal centre";
  }

  for (const corner of [corners.topLeft, corners.topRight, corners.bottomLeft, corners.bottomRight]) {
    const d = dot(normalWorld, subtract(corner, centerWorld));
    if (Math.abs(d) > 1e-9) {
      return "corner not on film plane";
    }
  }

  return null;
};
