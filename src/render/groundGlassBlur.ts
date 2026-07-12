import type { DerivedOpticsState } from "../types/optics";
import { sampleDofWedge } from "../core/optics/dofWedge";
import { cocDiameterMm } from "../core/optics/thinLensModel";
import * as dofBlurModel from "../core/optics/dofBlurModel";

export type GroundGlassWorldBlurSample = {
  worldPoint: { x: number; y: number; z: number };
  objectDistanceAlongAxisMm: number;
  targetRayDistanceMm: number;

  nearRayDistanceMm: number | null;
  focusRayDistanceMm: number | null;
  farRayDistanceMm: number | null;

  insideDepthOfField: boolean;
  normalizedDefocus: number;

  circleOfConfusionDiameterMm: number;
  circleOfConfusionDiameterPx: number;
  blurRadiusPx: number;

  depthOfFieldModel: "parallel" | "scheimpflug-wedge";
};

export function sampleGroundGlassBlurAtWorldPoint(input: {
  worldPoint: { x: number; y: number; z: number };
  opticsState: DerivedOpticsState;
  focalLengthMm: number;
  aperture: number;
  circleOfConfusionMm: number;
  filmWidthMm: number;
  renderWidthPx: number;
  maximumBlurRadiusPx: number;
  displayBlurScale: number;
}): GroundGlassWorldBlurSample {
  const {
    worldPoint,
    opticsState,
    focalLengthMm,
    aperture,
    circleOfConfusionMm,
    filmWidthMm,
    renderWidthPx,
    maximumBlurRadiusPx,
    displayBlurScale,
  } = input;

  const lensCenter = opticsState.lensCenterWorld;
  const axisDir = opticsState.opticalAxis.direction;
  const toPoint = {
    x: worldPoint.x - lensCenter.x,
    y: worldPoint.y - lensCenter.y,
    z: worldPoint.z - lensCenter.z,
  };

  // distance along optical axis (signed)
  const objectDistanceAlongAxisMm =
    toPoint.x * axisDir.x + toPoint.y * axisDir.y + toPoint.z * axisDir.z;
  const targetRayDistanceMm = Math.sqrt(
    toPoint.x * toPoint.x + toPoint.y * toPoint.y + toPoint.z * toPoint.z,
  );

  const model = opticsState.diagnostics.depthOfFieldModel ?? "parallel";

  if (model === "scheimpflug-wedge") {
    // form ray and sample wedge
    const ray = {
      origin: lensCenter,
      direction: {
        x: toPoint.x / Math.max(1e-9, targetRayDistanceMm),
        y: toPoint.y / Math.max(1e-9, targetRayDistanceMm),
        z: toPoint.z / Math.max(1e-9, targetRayDistanceMm),
      },
    };
    const wedge = sampleDofWedge({
      ray,
      targetDistanceMm: targetRayDistanceMm,
      nearPlane: opticsState.depthOfFieldNearPlane ?? null,
      focusPlane: opticsState.focusPlane ?? null,
      farPlane: opticsState.depthOfFieldFarPlane ?? null,
    });

    const normalizedDefocus = wedge.normalizedDefocus;
    const insideDepthOfField = wedge.insideDepthOfField;
    const cocDiameterMm = normalizedDefocus * circleOfConfusionMm;
    const cocDiameterPx = dofBlurModel.calculateBoundaryCoCDiameterPx(
      circleOfConfusionMm * normalizedDefocus,
      filmWidthMm,
      renderWidthPx,
    );
    const blurRadiusPx = dofBlurModel.calculateDofBlurRadiusPx({
      normalizedDefocus,
      circleOfConfusionMm,
      filmWidthMm,
      renderWidthPx,
      maximumBlurRadiusPx,
      displayBlurScale,
    });

    return {
      worldPoint,
      objectDistanceAlongAxisMm,
      targetRayDistanceMm,
      nearRayDistanceMm: wedge.nearDistanceMm,
      focusRayDistanceMm: wedge.focusDistanceMm,
      farRayDistanceMm: wedge.farDistanceMm,
      insideDepthOfField,
      normalizedDefocus,
      circleOfConfusionDiameterMm: cocDiameterMm,
      circleOfConfusionDiameterPx: cocDiameterPx,
      blurRadiusPx,
      depthOfFieldModel: "scheimpflug-wedge",
    };
  }

  // Parallel thin-lens model
  // object distance along axis is used as U
  const U = objectDistanceAlongAxisMm;
  // use thin-lens model helper to compute physical CoC diameter in mm
  const imageDistance = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);
  const cocMmPhysical = cocDiameterMm(focalLengthMm, aperture, imageDistance, U);
  const cocDiameterMmFinal = Math.abs(cocMmPhysical);
  // convert to pixels and radius
  const circleOfConfusionDiameterPx = (cocDiameterMmFinal * renderWidthPx) / filmWidthMm;
  const blurRadiusPxRaw = circleOfConfusionDiameterPx * 0.5 * displayBlurScale;
  const blurRadiusPxClamped = Math.min(maximumBlurRadiusPx, Math.max(0, blurRadiusPxRaw));

  const normalizedDefocus = 0; // not defined for parallel
  const insideDepthOfField = false;

  return {
    worldPoint,
    objectDistanceAlongAxisMm,
    targetRayDistanceMm,
    nearRayDistanceMm: null,
    focusRayDistanceMm: null,
    farRayDistanceMm: null,
    insideDepthOfField,
    normalizedDefocus,
    circleOfConfusionDiameterMm: cocDiameterMmFinal,
    circleOfConfusionDiameterPx,
    blurRadiusPx: blurRadiusPxClamped,
    depthOfFieldModel: "parallel",
  };
}
