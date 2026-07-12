import type { DerivedOpticsState } from "../types/optics";
import { sampleDofWedge } from "../core/optics/dofWedge";
import { cocDiameterMm } from "../core/optics/thinLensModel";
import * as dofBlurModel from "../core/optics/dofBlurModel";
import { intersectRayPlane } from "../core/math/ray";
import { calculateImageDistanceAlongOpticalAxisMm } from "../core/optics/calculateImageDistance";

export type GroundGlassDofRegion =
  | "before-near"
  | "near-to-focus"
  | "focus-to-far"
  | "beyond-far"
  | "inside-open-far"
  | "unresolved";

export type GroundGlassWorldBlurSample = {
  worldPoint: { x: number; y: number; z: number };
  objectDistanceAlongAxisMm: number;
  targetRayDistanceMm: number;

  nearRayDistanceMm: number | null;
  focusRayDistanceMm: number | null;
  farRayDistanceMm: number | null;

  region: GroundGlassDofRegion;
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

    // region classification based on wedge samples
    const region: GroundGlassDofRegion = (() => {
      const t = wedge.targetDistanceMm;
      const n = wedge.nearDistanceMm;
      const f = wedge.farDistanceMm;
      const focus = wedge.focusDistanceMm;
      if (n === null || focus === null) return "unresolved";
      if (t < n) return "before-near";
      if (t <= focus) return "near-to-focus";
      if (f === null) return "inside-open-far";
      if (t <= f) return "focus-to-far";
      return "beyond-far";
    })();

    return {
      worldPoint,
      objectDistanceAlongAxisMm,
      targetRayDistanceMm,
      nearRayDistanceMm: wedge.nearDistanceMm,
      focusRayDistanceMm: wedge.focusDistanceMm,
      farRayDistanceMm: wedge.farDistanceMm,
      region,
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
  const imageDistance = calculateImageDistanceAlongOpticalAxisMm({
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlanePointWorld: opticsState.filmPlane.point,
    opticalAxisDirection: opticsState.opticalAxis.direction,
  });

  const cocDiameterMmFinal = (function () {
    if (imageDistance === null) return 0;
    try {
      const val = cocDiameterMm(focalLengthMm, aperture, imageDistance as number, U);
      return Number.isFinite(val) ? Math.abs(val) : 0;
    } catch {
      return 0;
    }
  })();

  // convert to pixels and radius
  const circleOfConfusionDiameterPx = (cocDiameterMmFinal * renderWidthPx) / filmWidthMm;
  const blurRadiusPxRaw = circleOfConfusionDiameterPx * 0.5 * displayBlurScale;
  const blurRadiusPxClamped = Math.min(maximumBlurRadiusPx, Math.max(0, blurRadiusPxRaw));

  // Prepare ray and intersect with DOF planes for diagnostics
  const ray = {
    origin: lensCenter,
    direction: {
      x: toPoint.x / Math.max(1e-9, targetRayDistanceMm),
      y: toPoint.y / Math.max(1e-9, targetRayDistanceMm),
      z: toPoint.z / Math.max(1e-9, targetRayDistanceMm),
    },
  };

  const nearHit = opticsState.depthOfFieldNearPlane ? intersectRayPlane(ray, opticsState.depthOfFieldNearPlane) : null;
  const focusHit = opticsState.focusPlane ? intersectRayPlane(ray, opticsState.focusPlane) : null;
  const farHit = opticsState.depthOfFieldFarPlane ? intersectRayPlane(ray, opticsState.depthOfFieldFarPlane) : null;

  const nearRayDistanceMm = nearHit ? nearHit.distance : null;
  const focusRayDistanceMm = focusHit ? focusHit.distance : null;
  const farRayDistanceMm = farHit ? farHit.distance : null;

  // normalized defocus: physical CoC diameter divided by acceptable CoC (circleOfConfusionMm)
  const normalizedDefocus = Number.isFinite(cocDiameterMmFinal) && Number.isFinite(circleOfConfusionMm) && circleOfConfusionMm > 0
    ? cocDiameterMmFinal / circleOfConfusionMm
    : Number.NaN;

  const numericTolerance = 1e-6;
  const insideDepthOfField = Number.isFinite(normalizedDefocus) ? (normalizedDefocus <= (1.0 + numericTolerance)) : false;

  // region classification for parallel
  const region: GroundGlassDofRegion = (() => {
    const t = targetRayDistanceMm;
    const n = nearRayDistanceMm;
    const f = farRayDistanceMm;
    const focus = focusRayDistanceMm;
    if (!Number.isFinite(t) || t <= 0) return "unresolved";
    if (n === null || focus === null) return "unresolved";
    if (t < n) return "before-near";
    if (t <= focus) return "near-to-focus";
    if (f === null) return "inside-open-far";
    if (t <= f) return "focus-to-far";
    return "beyond-far";
  })();

  return {
    worldPoint,
    objectDistanceAlongAxisMm,
    targetRayDistanceMm,
    nearRayDistanceMm,
    focusRayDistanceMm,
    farRayDistanceMm,
    region,
    insideDepthOfField,
    normalizedDefocus,
    circleOfConfusionDiameterMm: cocDiameterMmFinal,
    circleOfConfusionDiameterPx,
    blurRadiusPx: blurRadiusPxClamped,
    depthOfFieldModel: "parallel",
  };
}
