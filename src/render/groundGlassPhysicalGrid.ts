import {
  resolveSampledFilmDimensionsMm,
  type GroundGlassInspectionWindow,
} from "./groundGlassInspectionWindow";
import {
  mapPhysicalFilmUvToGroundGlassDisplayUv,
  type GroundGlassPreviewMode,
} from "./groundGlassTargetProjection";

/**
 * CSS geometry for a grid whose spacing and phase are derived from the
 * physical Ground Glass film window rather than from a decorative screen
 * pixel size.
 *
 * `origin*Px` is the display-space position of the physical film origin
 * (u/v = 0). The repeating CSS pattern continues in both directions; its
 * origin follows the selected Raw/Upright screen transform without changing
 * the underlying film coordinates.
 */
export type GroundGlassPhysicalGrid = {
  gridSquareMm: number;
  spacingXPx: number;
  spacingYPx: number;
  originXPx: number;
  originYPx: number;
  sampledFilmWidthMm: number;
  sampledFilmHeightMm: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

const isPositiveFinite = (value: number): boolean => Number.isFinite(value) && value > 0;

/**
 * Resolve the display-space CSS grid for a physical film square size.
 *
 * The inspection window is expressed in displayed Ground Glass coordinates,
 * while `resolveSampledFilmDimensionsMm` supplies the corresponding physical
 * crop size. This keeps the grid aligned when the 4x loupe is panned and
 * keeps the square size unchanged between Raw and Upright presentations.
 */
export const resolveGroundGlassPhysicalGrid = (input: {
  filmWidthMm: number;
  filmHeightMm: number;
  gridSquareMm: number;
  displayWidthPx: number;
  displayHeightPx: number;
  inspectionWindow: GroundGlassInspectionWindow;
  previewMode: GroundGlassPreviewMode;
}): GroundGlassPhysicalGrid | null => {
  if (
    !isPositiveFinite(input.filmWidthMm) ||
    !isPositiveFinite(input.filmHeightMm) ||
    !isPositiveFinite(input.gridSquareMm) ||
    !isPositiveFinite(input.displayWidthPx) ||
    !isPositiveFinite(input.displayHeightPx)
  ) {
    return null;
  }

  const widthFraction = clamp(
    finiteOr(input.inspectionWindow.widthFraction, 1),
    Number.EPSILON,
    1,
  );
  const heightFraction = clamp(
    finiteOr(input.inspectionWindow.heightFraction, 1),
    Number.EPSILON,
    1,
  );
  const halfWidth = widthFraction / 2;
  const halfHeight = heightFraction / 2;
  const centerU = clamp(
    finiteOr(input.inspectionWindow.centerU, 0.5),
    halfWidth,
    1 - halfWidth,
  );
  const centerV = clamp(
    finiteOr(input.inspectionWindow.centerV, 0.5),
    halfHeight,
    1 - halfHeight,
  );
  const window = {
    ...input.inspectionWindow,
    widthFraction,
    heightFraction,
    centerU,
    centerV,
  };
  const sampledFilm = resolveSampledFilmDimensionsMm({
    filmWidthMm: input.filmWidthMm,
    filmHeightMm: input.filmHeightMm,
    inspectionWindow: window,
  });
  if (!isPositiveFinite(sampledFilm.widthMm) || !isPositiveFinite(sampledFilm.heightMm)) {
    return null;
  }

  const spacingXPx = input.displayWidthPx * input.gridSquareMm / sampledFilm.widthMm;
  const spacingYPx = input.displayHeightPx * input.gridSquareMm / sampledFilm.heightMm;
  if (!isPositiveFinite(spacingXPx) || !isPositiveFinite(spacingYPx)) return null;

  const windowOriginU = centerU - halfWidth;
  const windowOriginV = centerV - halfHeight;
  const displayOrigin = mapPhysicalFilmUvToGroundGlassDisplayUv(
    { u: 0, v: 0 },
    input.previewMode,
  );

  return {
    gridSquareMm: input.gridSquareMm,
    spacingXPx,
    spacingYPx,
    originXPx: (displayOrigin.u - windowOriginU) / widthFraction * input.displayWidthPx,
    originYPx: (displayOrigin.v - windowOriginV) / heightFraction * input.displayHeightPx,
    sampledFilmWidthMm: sampledFilm.widthMm,
    sampledFilmHeightMm: sampledFilm.heightMm,
  };
};
