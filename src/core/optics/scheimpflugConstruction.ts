import { intersectPlanes } from "../math/plane";
import { dot, normalize, scale, subtract } from "../math/vec";
import type { Line3, Plane, Vec3 } from "../../types/optics";

export const SCHEIMPFLUG_POINT_TOLERANCE_MM = 1e-6;
export const SCHEIMPFLUG_DIRECTION_TOLERANCE = 1e-9;

export type ScheimpflugConstruction = {
  commonLine: Line3 | null;
  pointResidualMm: number | null;
  directionResidual: number | null;
  isValid: boolean;
  unavailableReason?: string;
};

const isFiniteVector = (value: Vec3) =>
  [value.x, value.y, value.z].every((coordinate) => Number.isFinite(coordinate));

/** Normalize and canonicalize line direction so equivalent frames do not flip it. */
export const canonicalizeLineDirection = (direction: Vec3): Vec3 => {
  const normalized = normalize(direction);
  const epsilon = 1e-12;
  const firstSignificant = [normalized.x, normalized.y, normalized.z].find(
    (component) => Math.abs(component) > epsilon,
  );
  return firstSignificant !== undefined && firstSignificant < 0
    ? scale(normalized, -1)
    : normalized;
};

/**
 * Derive and validate the textbook Scheimpflug common line. The film/lens
 * intersection is authoritative; residuals verify that the current focus
 * plane contains the exact same line.
 */
export const deriveScheimpflugConstruction = ({
  filmPlane,
  lensPlane,
  focusPlane,
}: {
  filmPlane: Plane;
  lensPlane: Plane;
  focusPlane: Plane | null;
}): ScheimpflugConstruction => {
  const intersection = intersectPlanes(filmPlane, lensPlane);
  if (!intersection) {
    return {
      commonLine: null,
      pointResidualMm: null,
      directionResidual: null,
      isValid: false,
      unavailableReason: "Film and lens planes are parallel.",
    };
  }
  if (!focusPlane) {
    return {
      commonLine: null,
      pointResidualMm: null,
      directionResidual: null,
      isValid: false,
      unavailableReason: "A finite plane of sharp focus is unavailable.",
    };
  }

  const commonLine = {
    point: intersection.point,
    direction: canonicalizeLineDirection(intersection.direction),
  };
  if (!isFiniteVector(commonLine.point) || !isFiniteVector(commonLine.direction)) {
    return {
      commonLine: null,
      pointResidualMm: null,
      directionResidual: null,
      isValid: false,
      unavailableReason: "The plane intersection produced non-finite geometry.",
    };
  }

  const rawPointResidualMm = dot(
    focusPlane.normal,
    subtract(commonLine.point, focusPlane.point),
  );
  const rawDirectionResidual = dot(focusPlane.normal, commonLine.direction);
  const pointResidualMm = Math.abs(rawPointResidualMm) < 1e-12 ? 0 : rawPointResidualMm;
  const directionResidual = Math.abs(rawDirectionResidual) < 1e-12 ? 0 : rawDirectionResidual;
  const residualsAreFinite =
    Number.isFinite(pointResidualMm) && Number.isFinite(directionResidual);
  const isValid =
    residualsAreFinite &&
    Math.abs(pointResidualMm) <= SCHEIMPFLUG_POINT_TOLERANCE_MM &&
    Math.abs(directionResidual) <= SCHEIMPFLUG_DIRECTION_TOLERANCE;

  return {
    commonLine,
    pointResidualMm: residualsAreFinite ? pointResidualMm : null,
    directionResidual: residualsAreFinite ? directionResidual : null,
    isValid,
    ...(!residualsAreFinite
      ? { unavailableReason: "The construction residuals are non-finite." }
      : !isValid
        ? { unavailableReason: "The focus plane does not contain the film/lens intersection line." }
        : {}),
  };
};
