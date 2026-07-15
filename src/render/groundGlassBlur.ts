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
  // normalizedDefocus may be null when unresolved
  normalizedDefocus: number | null;

  circleOfConfusionDiameterMm: number;
  circleOfConfusionDiameterPx: number;
  blurRadiusPx: number;

  depthOfFieldModel: "parallel" | "scheimpflug-wedge";

  // optional diagnostic reason when the sample could not be resolved
  diagnosticReason?: string;
};

function createUnresolvedGroundGlassBlurSample(worldPoint: { x: number; y: number; z: number }, objectDistanceAlongAxisMm: number, targetRayDistanceMm: number, reason: string): GroundGlassWorldBlurSample {
  return {
    worldPoint,
    objectDistanceAlongAxisMm,
    targetRayDistanceMm,
    nearRayDistanceMm: null,
    focusRayDistanceMm: null,
    farRayDistanceMm: null,
    region: "unresolved",
    insideDepthOfField: false,
    normalizedDefocus: null,
    circleOfConfusionDiameterMm: 0,
    circleOfConfusionDiameterPx: 0,
    blurRadiusPx: 0,
    depthOfFieldModel: "parallel",
    diagnosticReason: reason,
  };
}

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

  const groundGlassModel =
    opticsState.diagnostics.groundGlassDofModel ??
    (opticsState.diagnostics.depthOfFieldModel === "scheimpflug-wedge"
      ? "derived-planes"
      : "parallel-thin-lens");
  const model = groundGlassModel === "derived-planes" ? "scheimpflug-wedge" : "parallel";

  // Basic input validation — return unresolved if any fundamental optical parameter is invalid
  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid focal length");
  }
  if (!Number.isFinite(aperture) || aperture <= 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid aperture");
  }
  if (!Number.isFinite(circleOfConfusionMm) || circleOfConfusionMm <= 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid circleOfConfusionMm");
  }
  if (!Number.isFinite(filmWidthMm) || filmWidthMm <= 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid filmWidthMm");
  }
  if (!Number.isFinite(renderWidthPx) || renderWidthPx <= 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid renderWidthPx");
  }
  if (!Number.isFinite(maximumBlurRadiusPx) || maximumBlurRadiusPx < 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid maximumBlurRadiusPx");
  }
  if (!Number.isFinite(displayBlurScale) || displayBlurScale <= 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid displayBlurScale");
  }

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

    // Basic validation: wedge must return finite distances and normalizedDefocus
    if (!Number.isFinite(wedge.targetDistanceMm) || wedge.targetDistanceMm <= 0 || !Number.isFinite(wedge.normalizedDefocus)) {
      return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Invalid wedge sample from DOF wedge evaluator");
    }

    const normalizedDefocus = wedge.normalizedDefocus;
    const insideDepthOfField = wedge.insideDepthOfField;

    if (!Number.isFinite(normalizedDefocus)) {
      return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Non-finite normalized defocus in wedge path");
    }

    const cocDiameterMm = normalizedDefocus * circleOfConfusionMm;
    // validate numeric conversions
    if (!Number.isFinite(cocDiameterMm)) {
      return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Non-finite CoC in wedge path");
    }

    const cocDiameterPx = dofBlurModel.calculateBoundaryCoCDiameterPx(
      cocDiameterMm,
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

  if (imageDistance === null) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Unable to compute image distance");
  }

  let cocDiameterMmFinal: number;
  try {
    const val = cocDiameterMm(focalLengthMm, aperture, imageDistance as number, U);
    cocDiameterMmFinal = Number.isFinite(val) ? Math.abs(val) : NaN;
  } catch {
    cocDiameterMmFinal = NaN;
  }

  if (!Number.isFinite(cocDiameterMmFinal) || cocDiameterMmFinal <= 0) {
    return createUnresolvedGroundGlassBlurSample(worldPoint, objectDistanceAlongAxisMm, targetRayDistanceMm, "Computed CoC invalid or non-positive");
  }

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
    : null;

  const numericTolerance = 1e-6;
  const insideDepthOfField = normalizedDefocus !== null ? (normalizedDefocus <= (1.0 + numericTolerance)) : false;

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
