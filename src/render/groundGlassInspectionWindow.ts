import type { GroundGlassPanOffset } from "./groundGlassStageTransform";
import {
  mapGroundGlassUvToDisplayUv,
  type GroundGlassPreviewMode,
} from "./groundGlassTargetProjection";

/**
 * A film-space inspection window. u/v use the complete film image as their
 * coordinate system: u=0 is left, u=1 is right, v=0 is top, and v=1 is
 * bottom. The window is independent of the CSS/layout viewport.
 */
export type GroundGlassInspectionWindow = {
  active: boolean;
  centerU: number;
  centerV: number;
  widthFraction: number;
  heightFraction: number;
};

export type GroundGlassInspectionPreviewMode = GroundGlassPreviewMode;

export type GroundGlassFrustum = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  near: number;
  far: number;
};

export const FULL_GROUND_GLASS_INSPECTION_WINDOW: GroundGlassInspectionWindow = {
  active: false,
  centerU: 0.5,
  centerV: 0.5,
  widthFraction: 1,
  heightFraction: 1,
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const finiteOr = (value: number, fallback: number): number =>
  Number.isFinite(value) ? value : fallback;

/**
 * Convert Stage's normalized CSS-style pan to a film-space window. Positive
 * screen-space pan reveals content farther to the left, hence the subtraction
 * in both axes. The returned window is always contained by the full film.
 */
export const resolveGroundGlassInspectionWindow = (input: {
  active: boolean;
  normalizedPan?: GroundGlassPanOffset;
  magnification?: number;
}): GroundGlassInspectionWindow => {
  if (!input.active) return FULL_GROUND_GLASS_INSPECTION_WINDOW;

  const magnification = finiteOr(input.magnification ?? 4, 4);
  const safeMagnification = Math.max(1, magnification);
  const widthFraction = 1 / safeMagnification;
  const heightFraction = 1 / safeMagnification;
  const normalizedPan = input.normalizedPan ?? { x: 0, y: 0 };
  const maxCenterU = 1 - widthFraction / 2;
  const maxCenterV = 1 - heightFraction / 2;

  return {
    active: true,
    centerU: clamp(
      0.5 - finiteOr(normalizedPan.x, 0) * (1 - widthFraction) / 2,
      widthFraction / 2,
      maxCenterU,
    ),
    centerV: clamp(
      0.5 - finiteOr(normalizedPan.y, 0) * (1 - heightFraction) / 2,
      heightFraction / 2,
      maxCenterV,
    ),
    widthFraction,
    heightFraction,
  };
};

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Resolve a sub-frustum from the canonical full-film near-plane frustum.
 * v=0 is the top edge, so top/bottom interpolation follows top -> bottom.
 */
export const resolveGroundGlassInspectionFrustum = (
  fullFrustum: GroundGlassFrustum,
  window: GroundGlassInspectionWindow,
): GroundGlassFrustum => {
  const widthFraction = clamp(
    finiteOr(window.widthFraction, 1),
    Number.EPSILON,
    1,
  );
  const heightFraction = clamp(
    finiteOr(window.heightFraction, 1),
    Number.EPSILON,
    1,
  );
  const halfWidth = widthFraction / 2;
  const halfHeight = heightFraction / 2;
  const centerU = clamp(finiteOr(window.centerU, 0.5), halfWidth, 1 - halfWidth);
  const centerV = clamp(finiteOr(window.centerV, 0.5), halfHeight, 1 - halfHeight);
  const u0 = centerU - halfWidth;
  const u1 = centerU + halfWidth;
  const v0 = centerV - halfHeight;
  const v1 = centerV + halfHeight;

  return {
    left: lerp(fullFrustum.left, fullFrustum.right, u0),
    right: lerp(fullFrustum.left, fullFrustum.right, u1),
    top: lerp(fullFrustum.top, fullFrustum.bottom, v0),
    bottom: lerp(fullFrustum.top, fullFrustum.bottom, v1),
    near: fullFrustum.near,
    far: fullFrustum.far,
  };
};

export const resolveSampledFilmDimensionsMm = (input: {
  filmWidthMm: number;
  filmHeightMm: number;
  inspectionWindow: GroundGlassInspectionWindow;
}): { widthMm: number; heightMm: number } => ({
  widthMm: input.filmWidthMm * clamp(input.inspectionWindow.widthFraction, Number.EPSILON, 1),
  heightMm: input.filmHeightMm * clamp(input.inspectionWindow.heightFraction, Number.EPSILON, 1),
});

/**
 * Stage pan coordinates follow the displayed Ground Glass image. The same
 * physical-film-to-display transform used for focus targets is an involution,
 * so applying it to the displayed window centre maps it back to the camera /
 * film coordinate system without maintaining a second Raw/Upright rule.
 */
export const mapGroundGlassInspectionWindowToFilmSpace = (
  window: GroundGlassInspectionWindow,
  previewMode: GroundGlassInspectionPreviewMode,
): GroundGlassInspectionWindow => {
  if (!window.active) return window;
  const filmCenter = mapGroundGlassUvToDisplayUv(
    { u: window.centerU, v: window.centerV },
    previewMode,
  );
  return {
    ...window,
    centerU: filmCenter.u,
    centerV: filmCenter.v,
  };
};
