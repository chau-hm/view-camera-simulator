import type { FilmPlaneCorners, OffAxisProjectionInput, Plane, Vec3 } from "../../types/optics";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { vec } from "../math/vec";

const DEFAULT_NEAR_MM = 10;
const DEFAULT_FAR_MM = 50000;

export const calculateFilmPlaneCorners = (filmPlane: Plane): FilmPlaneCorners => {
  const halfWidth = CAMERA_CONSTANTS.filmWidthMm / 2;
  const halfHeight = CAMERA_CONSTANTS.filmHeightMm / 2;
  const { x, y, z } = filmPlane.point;

  return {
    topLeft: vec(x - halfWidth, y + halfHeight, z),
    topRight: vec(x + halfWidth, y + halfHeight, z),
    bottomLeft: vec(x - halfWidth, y - halfHeight, z),
    bottomRight: vec(x + halfWidth, y - halfHeight, z),
  };
};

export const createOffAxisProjectionInput = (
  lensCenterWorld: Vec3,
  filmCornersWorld: FilmPlaneCorners,
): OffAxisProjectionInput => ({
  lensCenterWorld,
  filmCornersWorld,
});

export const calculateOffAxisProjectionMatrix = (
  input: OffAxisProjectionInput,
  nearMm = DEFAULT_NEAR_MM,
  farMm = DEFAULT_FAR_MM,
): number[] => {
  const { lensCenterWorld, filmCornersWorld } = input;
  const dz = Math.abs(filmCornersWorld.topLeft.z - lensCenterWorld.z);
  if (!Number.isFinite(dz) || dz <= 0) {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, -1, -1,
      0, 0, -2, 0,
    ];
  }

  const scale = nearMm / dz;
  const left = (filmCornersWorld.topLeft.x - lensCenterWorld.x) * scale;
  const right = (filmCornersWorld.topRight.x - lensCenterWorld.x) * scale;
  const top = (filmCornersWorld.topLeft.y - lensCenterWorld.y) * scale;
  const bottom = (filmCornersWorld.bottomLeft.y - lensCenterWorld.y) * scale;

  const width = right - left;
  const height = top - bottom;
  const depth = farMm - nearMm;

  if (width === 0 || height === 0 || depth === 0) {
    return [
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, -1, -1,
      0, 0, -2, 0,
    ];
  }

  return [
    (2 * nearMm) / width,
    0,
    0,
    0,
    0,
    (2 * nearMm) / height,
    0,
    0,
    (right + left) / width,
    (top + bottom) / height,
    -(farMm + nearMm) / depth,
    -1,
    0,
    0,
    (-2 * farMm * nearMm) / depth,
    0,
  ];
};
