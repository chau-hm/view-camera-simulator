import type { DerivedLensCoverage } from "../../types/lens";
import type { GroundGlassCoverageState } from "../../types/optics";
import {
  deriveGroundGlassParallelFilmGeometry,
  type GroundGlassParallelFilmGeometryInput,
} from "./groundGlassParallelFilmGeometry";
import { deriveGroundGlassCoverageConic } from "./groundGlassCoverageConic";

export type GroundGlassCoverageGeometry = GroundGlassParallelFilmGeometryInput;

export const createNeutralGroundGlassCoverage = (
  reason: "invalid-coverage" | "invalid-geometry",
): GroundGlassCoverageState => ({
  kind: "neutral",
  reason,
});

/**
 * Derive the finite film-plane coverage state for the Ground Glass.
 *
 * `DerivedLensCoverage` owns the perpendicular-reference-plane circle. The
 * established parallel path uses its canonical optical-axis intersection;
 * the non-parallel path intersects the same cone with the actual film plane.
 * Neither path recalculates the coverage angle.
 */
export const deriveGroundGlassCoverage = (input: {
  lensCoverage: DerivedLensCoverage | null;
  geometry: GroundGlassCoverageGeometry;
}): GroundGlassCoverageState => {
  const { lensCoverage, geometry } = input;
  if (!lensCoverage) return createNeutralGroundGlassCoverage("invalid-coverage");
  if (lensCoverage.kind === "unbounded-ideal") return { kind: "unbounded" };
  const radius = lensCoverage.imageCircleRadiusMm;
  if (
    !Number.isFinite(radius) ||
    radius <= 0 ||
    (lensCoverage.kind === "angular" &&
      (!Number.isFinite(lensCoverage.imageDistanceMm) || lensCoverage.imageDistanceMm <= 0))
  ) {
    return createNeutralGroundGlassCoverage("invalid-coverage");
  }

  if (geometry.isParallelLensFilm) {
    const parallelFilmGeometry = deriveGroundGlassParallelFilmGeometry(geometry);
    if (!parallelFilmGeometry) {
      return createNeutralGroundGlassCoverage("invalid-geometry");
    }

    return {
      kind: "parallel-circle",
      imageCircleRadiusMm: radius,
      opticalAxisOffsetXMm: parallelFilmGeometry.opticalAxisOffsetXMm,
      opticalAxisOffsetYMm: parallelFilmGeometry.opticalAxisOffsetYMm,
    };
  }

  const conic = deriveGroundGlassCoverageConic({ lensCoverage, geometry });
  if (!conic) return createNeutralGroundGlassCoverage("invalid-geometry");

  return {
    kind: "nonparallel-conic",
    ...conic,
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
  if (!Number.isFinite(filmPointXMm) || !Number.isFinite(filmPointYMm)) {
    return 1;
  }

  if (state.kind === "nonparallel-conic") {
    const { a, b, c, d, e, f } = state.quadratic;
    const { x, y, constant } = state.axial;
    if (
      ![a, b, c, d, e, f, x, y, constant].every(Number.isFinite)
    ) {
      return 1;
    }
    const conicValue =
      a * filmPointXMm * filmPointXMm +
      b * filmPointXMm * filmPointYMm +
      c * filmPointYMm * filmPointYMm +
      d * filmPointXMm +
      e * filmPointYMm +
      f;
    const imageSideDistance = x * filmPointXMm + y * filmPointYMm + constant;
    if (!Number.isFinite(conicValue) || !Number.isFinite(imageSideDistance)) return 1;
    return conicValue <= 0 && imageSideDistance > 0 ? 1 : 0;
  }

  if (state.kind !== "parallel-circle") return 1;
  if (
    !Number.isFinite(state.imageCircleRadiusMm) ||
    state.imageCircleRadiusMm <= 0 ||
    !Number.isFinite(state.opticalAxisOffsetXMm) ||
    !Number.isFinite(state.opticalAxisOffsetYMm)
  ) return 1;

  const deltaX = filmPointXMm - state.opticalAxisOffsetXMm;
  const deltaY = filmPointYMm - state.opticalAxisOffsetYMm;
  const distanceSquared = deltaX * deltaX + deltaY * deltaY;
  const radiusSquared = state.imageCircleRadiusMm * state.imageCircleRadiusMm;
  if (!Number.isFinite(distanceSquared) || !Number.isFinite(radiusSquared)) {
    return 1;
  }

  return distanceSquared <= radiusSquared ? 1 : 0;
};
