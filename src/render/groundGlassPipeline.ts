import { mapApertureToToleranceMm } from "../core/optics/calculateDepthOfField";
import { pointToPlaneDistance } from "../core/math/plane";
import type { DerivedOpticsState, Plane, Vec3 } from "../types/optics";

export type GroundGlassRenderTarget = {
  widthPx: number;
  heightPx: number;
  textureId: string;
};

export type GroundGlassDepthTarget = {
  widthPx: number;
  heightPx: number;
  depthTextureId: string;
};

export type GroundGlassCamera = {
  projectionMatrix: number[];
  source: "ground-glass";
};

export type HalfResolutionBlurPass = {
  widthPx: number;
  heightPx: number;
};

export type GroundGlassDofPipeline = {
  colorTarget: GroundGlassRenderTarget;
  depthTarget: GroundGlassDepthTarget;
  camera: GroundGlassCamera;
  blurPass: HalfResolutionBlurPass;
  verticalFrameOffsetPx: number;
};

export const createGroundGlassRenderTarget = (widthPx: number, heightPx: number): GroundGlassRenderTarget => ({
  widthPx,
  heightPx,
  textureId: `gg-color-${widthPx}x${heightPx}`,
});

export const createGroundGlassDepthTarget = (
  colorTarget: GroundGlassRenderTarget,
): GroundGlassDepthTarget => ({
  widthPx: colorTarget.widthPx,
  heightPx: colorTarget.heightPx,
  depthTextureId: `gg-depth-${colorTarget.widthPx}x${colorTarget.heightPx}`,
});

export const createGroundGlassCamera = (projectionMatrix: number[]): GroundGlassCamera => ({
  projectionMatrix,
  source: "ground-glass",
});

export const applyOffAxisProjectionMatrix = (
  camera: GroundGlassCamera,
  projectionMatrix: number[],
): GroundGlassCamera => ({
  ...camera,
  projectionMatrix,
});

export const computeGroundGlassVerticalFrameOffsetPx = (
  projectionMatrix: number[],
  heightPx: number,
): number => {
  const projectionYOffset = projectionMatrix[9] ?? 0;
  return projectionYOffset * (heightPx / 2);
};

export const linearizeDepthSample = (
  depthSample: number,
  nearPlane = 0.01,
  farPlane = 200,
): number => {
  const clampedDepth = Math.min(1, Math.max(0, depthSample));
  const z = clampedDepth * 2 - 1;
  return (2 * nearPlane * farPlane) / (farPlane + nearPlane - z * (farPlane - nearPlane));
};

export const reconstructWorldPosition = (
  normalizedX: number,
  normalizedY: number,
  linearDepthMm: number,
  opticsState: DerivedOpticsState,
): Vec3 => {
  const spanX = opticsState.filmPlaneCornersWorld.topRight.x - opticsState.filmPlaneCornersWorld.topLeft.x;
  const spanY = opticsState.filmPlaneCornersWorld.topLeft.y - opticsState.filmPlaneCornersWorld.bottomLeft.y;
  return {
    x: opticsState.filmPlaneCornersWorld.topLeft.x + spanX * normalizedX,
    y: opticsState.filmPlaneCornersWorld.bottomLeft.y + spanY * normalizedY,
    z: opticsState.lensCenterWorld.z + linearDepthMm,
  };
};

export const calculateFocusPlaneDistanceMm = (worldPosition: Vec3, focusPlane: Plane): number =>
  pointToPlaneDistance(worldPosition, focusPlane);

export const calculateApertureBlurStrength = (
  distanceToFocusPlaneMm: number,
  aperture: number,
): number => {
  const acceptableRangeMm = mapApertureToToleranceMm(aperture);
  const normalized = Math.min(1, distanceToFocusPlaneMm / acceptableRangeMm);
  return Number(normalized.toFixed(4));
};

export const createHalfResolutionBlurPass = (
  colorTarget: GroundGlassRenderTarget,
): HalfResolutionBlurPass => ({
  widthPx: Math.max(1, Math.floor(colorTarget.widthPx / 2)),
  heightPx: Math.max(1, Math.floor(colorTarget.heightPx / 2)),
});

export const createGroundGlassDofPipeline = (
  opticsState: DerivedOpticsState,
  widthPx: number,
  heightPx: number,
): GroundGlassDofPipeline => {
  const colorTarget = createGroundGlassRenderTarget(widthPx, heightPx);
  const depthTarget = createGroundGlassDepthTarget(colorTarget);
  const camera = applyOffAxisProjectionMatrix(
    createGroundGlassCamera(opticsState.offAxisProjectionMatrix),
    opticsState.offAxisProjectionMatrix,
  );
  const blurPass = createHalfResolutionBlurPass(colorTarget);
  const verticalFrameOffsetPx = computeGroundGlassVerticalFrameOffsetPx(
    opticsState.offAxisProjectionMatrix,
    colorTarget.heightPx,
  );

  return {
    colorTarget,
    depthTarget,
    camera,
    blurPass,
    verticalFrameOffsetPx,
  };
};
