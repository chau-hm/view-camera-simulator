import { mapApertureToToleranceMm } from "../core/optics/calculateDepthOfField";
import { pointToPlaneDistance } from "../core/math/plane";
import type { DerivedOpticsState, Plane, Vec3 } from "../types/optics";
import type { RenderQualityProfile } from "../types/ui";
import { getRenderQualitySettings, scaleResolution } from "./renderQuality";

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

export const createScaledBlurPass = (
  colorTarget: GroundGlassRenderTarget,
  blurPassScale: number,
): HalfResolutionBlurPass => ({
  widthPx: Math.max(1, Math.floor(colorTarget.widthPx * blurPassScale)),
  heightPx: Math.max(1, Math.floor(colorTarget.heightPx * blurPassScale)),
});

type ThinLensParams = {
  useThinLens: boolean;
  focalLengthMm: number;
  imageDistanceMm: number;
  sensorWidthMm: number;
  sensorHeightMm: number;
};

export const createGroundGlassDofPipeline = (
  opticsState: DerivedOpticsState,
  widthPx: number,
  heightPx: number,
  renderQuality: RenderQualityProfile,
  thinLensParams?: ThinLensParams,
): GroundGlassDofPipeline => {
  const qualitySettings = getRenderQualitySettings(renderQuality);
  const colorTarget = createGroundGlassRenderTarget(
    scaleResolution(widthPx, qualitySettings.groundGlassScale),
    scaleResolution(heightPx, qualitySettings.groundGlassScale),
  );
  const depthTarget = createGroundGlassDepthTarget(colorTarget);

  let projectionMatrix = opticsState.offAxisProjectionMatrix;

  if (thinLensParams && thinLensParams.useThinLens) {
    // build a symmetric perspective projection matrix from sensor size and image distance
    const nearMm = 10;
    const farMm = 50000;
    const aspect = thinLensParams.sensorWidthMm / thinLensParams.sensorHeightMm;
    const verticalFovRadians = 2 * Math.atan(thinLensParams.sensorHeightMm / (2 * thinLensParams.imageDistanceMm));
    const top = nearMm * Math.tan(verticalFovRadians / 2);
    const bottom = -top;
    const right = top * aspect;
    const left = -right;

    const width = right - left;
    const height = top - bottom;
    const depth = farMm - nearMm;

    projectionMatrix = [
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
  }

  const camera = applyOffAxisProjectionMatrix(createGroundGlassCamera(projectionMatrix), projectionMatrix);
  const blurPass = createScaledBlurPass(colorTarget, qualitySettings.blurPassScale);
  const verticalFrameOffsetPx = computeGroundGlassVerticalFrameOffsetPx(projectionMatrix, colorTarget.heightPx);

  return {
    colorTarget,
    depthTarget,
    camera,
    blurPass,
    verticalFrameOffsetPx,
  };
};
