import { projectWorldPointToGroundGlass } from "./groundGlassProjection";
import { projectWorldPointToFilmPlaneGroundGlass } from "./groundGlassFilmPlaneProjection";
import { CAMERA_CONSTANTS } from "../utils/constants";
import type { ApertureValue } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";
import type { SceneDefinition } from "../types/scene";
import {
  calculateFocusPlaneDistanceMm,
  calculateApertureBlurStrength,
} from "./groundGlassPipeline";
import { pointToPlaneDistance } from "../core/math/plane";

export type GroundGlassPreviewMode = "raw" | "upright";

export type ProjectedGroundGlassTarget = {
  id: string;
  visible: boolean;
  leftPercent: number;
  topPercent: number;
  blurStrengthAtTarget: number;
  rawUv: {
    u: number;
    v: number;
  };
  displayUv: {
    u: number;
    v: number;
  };
};

export function mapGroundGlassUvToDisplayUv(
  rawUv: { u: number; v: number },
  previewMode: GroundGlassPreviewMode,
): { u: number; v: number } {
  if (previewMode === "raw") {
    return { u: 1 - rawUv.u, v: 1 - rawUv.v };
  }
  return { u: rawUv.u, v: rawUv.v };
}

export function projectSceneFocusTargetsToGroundGlass(params: {
  sceneDef?: SceneDefinition;
  opticsState: DerivedOpticsState;
  aperture: ApertureValue;
  previewMode: GroundGlassPreviewMode;
}): ProjectedGroundGlassTarget[] {
  const { sceneDef, opticsState, aperture, previewMode } = params;
  if (!sceneDef || !sceneDef.focusTargets || sceneDef.focusTargets.length === 0) return [];

  const imageDistanceMm = Math.abs(opticsState.filmPlane.point.z - opticsState.lensCenterWorld.z);

  const useThinLensBaselineProjection =
    !!sceneDef && sceneDef.id === "focus-fundamentals-two-targets";

  return sceneDef.focusTargets.map((t) => {
    let p: { visible: boolean; uRaw: number; vRaw: number };

    if (useThinLensBaselineProjection) {
      // Preserve the baseline thin-lens projection for Focus Fundamentals
      p = projectWorldPointToGroundGlass(
        t.worldPosition,
        opticsState.lensCenterWorld,
        imageDistanceMm,
        CAMERA_CONSTANTS.filmWidthMm,
        CAMERA_CONSTANTS.filmHeightMm,
      );
    } else if (
      opticsState.filmPlaneCornersWorld &&
      opticsState.lensCenterWorld
    ) {
      const filmRes = projectWorldPointToFilmPlaneGroundGlass({
        worldPoint: t.worldPosition,
        lensCenterWorld: opticsState.lensCenterWorld,
        filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
      });
      p = { visible: filmRes.visible, uRaw: filmRes.uRaw, vRaw: filmRes.vRaw };
    } else {
      // Fallback to original projection if film plane geometry absent
      p = projectWorldPointToGroundGlass(
        t.worldPosition,
        opticsState.lensCenterWorld,
        imageDistanceMm,
        CAMERA_CONSTANTS.filmWidthMm,
        CAMERA_CONSTANTS.filmHeightMm,
      );
    }

    const rawUv = { u: p.uRaw, v: p.vRaw };
    const displayUv = mapGroundGlassUvToDisplayUv(rawUv, previewMode);

    const leftPercent = p.visible ? Math.min(100, Math.max(0, displayUv.u * 100)) : -999;
    const topPercent = p.visible ? Math.min(100, Math.max(0, displayUv.v * 100)) : -999;

    let distanceToFocusPlaneMm: number;
    if (opticsState.focusPlane) {
      distanceToFocusPlaneMm = calculateFocusPlaneDistanceMm(
        t.worldPosition,
        opticsState.focusPlane,
      );
    } else if (opticsState.depthOfFieldNearPlane) {
      distanceToFocusPlaneMm = Math.abs(
        pointToPlaneDistance(t.worldPosition, opticsState.depthOfFieldNearPlane),
      );
    } else {
      distanceToFocusPlaneMm = Number.POSITIVE_INFINITY;
    }

    const blurStrengthAtTarget = calculateApertureBlurStrength(
      distanceToFocusPlaneMm,
      aperture as unknown as number,
    );

    return {
      id: t.id,
      visible: p.visible,
      leftPercent,
      topPercent,
      blurStrengthAtTarget,
      rawUv,
      displayUv,
    };
  });
}
