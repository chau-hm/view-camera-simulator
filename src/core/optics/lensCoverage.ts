import type { DerivedLensCoverage, LensCoverageSpec } from "../../types/lens";

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

type AngularCoverageDimensions = {
  halfCoverageAngleDeg: number;
  imageCircleRadiusMm: number;
  imageCircleDiameterMm: number;
};

const deriveAngularCoverageDimensions = (
  fullCoverageAngleDeg: number,
  imageDistanceMm: number,
): AngularCoverageDimensions | null => {
  if (
    !Number.isFinite(fullCoverageAngleDeg) ||
    fullCoverageAngleDeg <= 0 ||
    fullCoverageAngleDeg >= 180 ||
    !Number.isFinite(imageDistanceMm) ||
    imageDistanceMm <= 0
  ) {
    return null;
  }

  const halfCoverageAngleDeg = fullCoverageAngleDeg / 2;
  const imageCircleRadiusMm = imageDistanceMm * Math.tan(degreesToRadians(halfCoverageAngleDeg));
  const imageCircleDiameterMm = 2 * imageCircleRadiusMm;

  if (
    !Number.isFinite(imageCircleRadiusMm) ||
    imageCircleRadiusMm <= 0 ||
    !Number.isFinite(imageCircleDiameterMm) ||
    imageCircleDiameterMm <= 0
  ) {
    return null;
  }

  return {
    halfCoverageAngleDeg,
    imageCircleRadiusMm,
    imageCircleDiameterMm,
  };
};

/**
 * Derive an angular lens' perpendicular image-plane circle diameter.
 *
 * The angle is a complete included angle in degrees, and the image distance
 * is in millimetres. Invalid physical inputs return null rather than a
 * plausible finite fallback.
 */
export const calculateAngularImageCircleDiameterMm = (
  fullCoverageAngleDeg: number,
  imageDistanceMm: number,
): number | null =>
  deriveAngularCoverageDimensions(fullCoverageAngleDeg, imageDistanceMm)?.imageCircleDiameterMm ??
  null;

/**
 * Derive lens coverage at a supplied physical image distance.
 *
 * The result describes a plane perpendicular to the optical axis. It does
 * not intersect an arbitrarily tilted or swung film plane.
 */
export const deriveLensCoverage = (
  coverage: LensCoverageSpec,
  imageDistanceMm: number,
): DerivedLensCoverage | null => {
  if (
    !coverage ||
    typeof coverage !== "object" ||
    !Number.isFinite(imageDistanceMm) ||
    imageDistanceMm <= 0
  ) {
    return null;
  }

  switch (coverage.kind) {
    case "unbounded-ideal":
      return {
        kind: "unbounded-ideal",
        imageCircleRadiusMm: null,
        imageCircleDiameterMm: null,
      };
    case "angular": {
      const dimensions = deriveAngularCoverageDimensions(
        coverage.fullCoverageAngleDeg,
        imageDistanceMm,
      );
      if (!dimensions) return null;

      return {
        kind: "angular",
        fullCoverageAngleDeg: coverage.fullCoverageAngleDeg,
        ...dimensions,
        imageDistanceMm,
      };
    }
    default:
      return null;
  }
};
