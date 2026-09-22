import type { DerivedLensCoverage } from "../../types/lens";
import type { GroundGlassCoverageState } from "../../types/optics";
import {
  deriveGroundGlassParallelFilmGeometry,
  type GroundGlassParallelFilmGeometryInput,
} from "./groundGlassParallelFilmGeometry";

export type GroundGlassCoverageGeometry = GroundGlassParallelFilmGeometryInput;

export const createNeutralGroundGlassCoverage = (
  reason: "non-parallel-lens-film" | "invalid-coverage" | "invalid-geometry",
): GroundGlassCoverageState => ({
  kind: "neutral",
  reason,
});

/**
 * Derive the finite circular coverage state for the Ground Glass.
 *
 * `DerivedLensCoverage` owns the image-circle radius. This helper only
 * combines that canonical lens result with the current parallel-film
 * optical-axis intersection; it never recalculates angular coverage.
 */
export const deriveGroundGlassCoverage = (input: {
  lensCoverage: DerivedLensCoverage | null;
  geometry: GroundGlassCoverageGeometry;
}): GroundGlassCoverageState => {
  const { lensCoverage, geometry } = input;
  if (!lensCoverage) return createNeutralGroundGlassCoverage("invalid-coverage");
  if (lensCoverage.kind === "unbounded-ideal") return { kind: "unbounded" };
  if (!geometry.isParallelLensFilm) {
    return createNeutralGroundGlassCoverage("non-parallel-lens-film");
  }

  const parallelFilmGeometry = deriveGroundGlassParallelFilmGeometry(geometry);
  if (!parallelFilmGeometry) {
    return createNeutralGroundGlassCoverage("invalid-geometry");
  }

  const radius = lensCoverage.imageCircleRadiusMm;
  if (!Number.isFinite(radius) || radius <= 0) {
    return createNeutralGroundGlassCoverage("invalid-coverage");
  }

  return {
    kind: "parallel-circle",
    imageCircleRadiusMm: radius,
    opticalAxisOffsetXMm: parallelFilmGeometry.opticalAxisOffsetXMm,
    opticalAxisOffsetYMm: parallelFilmGeometry.opticalAxisOffsetYMm,
  };
};

/**
 * Resolve binary physical coverage for one rear-standard film point.
 * Renderer anti-aliasing is deliberately not part of this optics helper.
 */
export const calculateGroundGlassCoverageGain = (
  state: GroundGlassCoverageState,
  filmPointXMm: number,
  filmPointYMm: number,
): number => {
  if (
    state.kind !== "parallel-circle" ||
    !Number.isFinite(state.imageCircleRadiusMm) ||
    state.imageCircleRadiusMm <= 0 ||
    !Number.isFinite(state.opticalAxisOffsetXMm) ||
    !Number.isFinite(state.opticalAxisOffsetYMm) ||
    !Number.isFinite(filmPointXMm) ||
    !Number.isFinite(filmPointYMm)
  ) {
    return 1;
  }

  const deltaX = filmPointXMm - state.opticalAxisOffsetXMm;
  const deltaY = filmPointYMm - state.opticalAxisOffsetYMm;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;
  const radiusSquared = state.imageCircleRadiusMm * state.imageCircleRadiusMm;
  if (!Number.isFinite(distanceSquared) || !Number.isFinite(radiusSquared)) {
    return 1;
  }

  return distanceSquared <= radiusSquared ? 1 : 0;
};
