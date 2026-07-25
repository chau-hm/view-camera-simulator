import type { FilmPlaneCorners, OffAxisProjectionInput, Plane, Vec3 } from "../../types/optics";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { cross, dot, safeNormalize, subtract, vec } from "../math/vec";

const DEFAULT_NEAR_MM = 10;
const DEFAULT_FAR_MM = 50000;

const FALLBACK_MATRIX = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, -1, -1,
  0, 0, -2, 0,
];

/**
 * Compatibility wrapper: construct world-aligned film corners from a plane.
 * Used only by the fallback state and callers that have only a Plane.
 */
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

/**
 * Generalized off-axis projection matrix.
 *
 * Derives a lens-centred local projection basis from the ordered film frame:
 *   right  = normalize(TR - TL)
 *   up     = normalize(TL - BL)
 *   forward = normalize(cross(right, up))   — points from lens toward film
 *
 * Transforms film corners into that local basis before calculating near-plane
 * extents. This correctly handles translated and tilted film planes.
 *
 * Matrix layout: 16-element column-major array, compatible with Three.js / groundGlassPipeline.
 */
export const calculateOffAxisProjectionMatrix = (
  input: OffAxisProjectionInput,
  nearMm = DEFAULT_NEAR_MM,
  farMm = DEFAULT_FAR_MM,
): number[] => {
  const { lensCenterWorld, filmCornersWorld } = input;
  const { topLeft, topRight, bottomLeft, bottomRight } = filmCornersWorld;

  // Derive local film basis from ordered corners
  const uAxis = subtract(topRight, topLeft);
  const vAxis = subtract(topLeft, bottomLeft);
  const rawNormal = cross(uAxis, vAxis);

  const right = safeNormalize(uAxis, vec(1, 0, 0));
  const up = safeNormalize(vAxis, vec(0, 1, 0));
  const forward = safeNormalize(rawNormal, vec(0, 0, 1));

  // Transform each corner into lens-centred local coordinates.
  // localForward is the depth from lens to corner along forward axis.
  // For a standard setup, film is behind the lens, so forward (film→lens)
  // means corners have negative localForward when forward points lens→film.
  // We use forward pointing from lens toward film (same direction as film normal
  // in the standard convention where normal = +Z and film is at -Z from lens).
  // So localForward = dot(corner - lens, forward) will be negative (film behind lens).
  const corners = [topLeft, topRight, bottomLeft, bottomRight];

  const localCoords = corners.map((c) => {
    const delta = subtract(c, lensCenterWorld);
    return {
      x: dot(delta, right),
      y: dot(delta, up),
      z: dot(delta, forward),
    };
  });

  // Depth is |localForward| — must be positive and finite
  const depths = localCoords.map((p) => Math.abs(p.z));
  if (!depths.every(Number.isFinite) || depths.some((d) => d <= 0)) {
    return FALLBACK_MATRIX;
  }

  // Use the minimum depth as the reference depth for the frustum.
  // All corners should be at approximately the same depth when the film is
  // parallel to the lens. When tilted, depths differ, but we use the
  // individual corner depths to compute per-corner near-plane extents.
  const nearExtents = localCoords.map((p, i) => ({
    x: (p.x * nearMm) / depths[i],
    y: (p.y * nearMm) / depths[i],
  }));

  const left = Math.min(...nearExtents.map((p) => p.x));
  const rightExtent = Math.max(...nearExtents.map((p) => p.x));
  const bottom = Math.min(...nearExtents.map((p) => p.y));
  const top = Math.max(...nearExtents.map((p) => p.y));

  const width = rightExtent - left;
  const height = top - bottom;
  const depth = farMm - nearMm;

  if (width === 0 || height === 0 || depth === 0) {
    return FALLBACK_MATRIX;
  }

  if (!Number.isFinite(left) || !Number.isFinite(rightExtent) ||
      !Number.isFinite(top) || !Number.isFinite(bottom)) {
    return FALLBACK_MATRIX;
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
    (rightExtent + left) / width,
    (top + bottom) / height,
    -(farMm + nearMm) / depth,
    -1,
    0,
    0,
    (-2 * farMm * nearMm) / depth,
    0,
  ];
};
