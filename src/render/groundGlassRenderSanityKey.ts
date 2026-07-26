import type { DerivedOpticsState } from "../types/optics";

const finiteOrNull = (value: number): string =>
  Number.isFinite(value) ? value.toFixed(6) : "null";

const vec3Key = (v: { x: number; y: number; z: number } | null | undefined): string =>
  v == null ? "null" : `${finiteOrNull(v.x)}:${finiteOrNull(v.y)}:${finiteOrNull(v.z)}`;

const filmCornerKey = (fc: { x: number; y: number; z: number } | undefined): string =>
  fc ? vec3Key(fc) : "null";

const matrixKey = (m: number[] | null | undefined): string => {
  if (!m || !Array.isArray(m)) return "null";
  if (m.length === 0) return "empty";
  return m.map(finiteOrNull).join(",");
};

export type RenderSanityKeyInputs = {
  resourceGeneration: number;
  sceneId?: string;
  previewMode?: string;
  rawDebug: boolean;
  zoomEnabled: boolean;
  aperture: number;
  internalWidthPx: number;
  internalHeightPx: number;
  opticsState: DerivedOpticsState;
};

/**
 * Compute a deterministic cache key that includes every canonical-optics input
 * that can change the rendered Ground Glass output.
 *
 * This MUST invalidate when any of the following changes:
 * - lens centre or normal
 * - film centre, normal, or corners
 * - optical axis
 * - off-axis projection matrix
 * - DOF uniform inputs
 * - RTT dimensions or metadata
 */
export function createGroundGlassRenderSanityStateKey(
  inputs: RenderSanityKeyInputs,
): string {
  const { resourceGeneration, sceneId, previewMode, rawDebug, zoomEnabled, aperture,
    internalWidthPx, internalHeightPx, opticsState: o } = inputs;

  const parts: string[] = [
    String(resourceGeneration),
    sceneId ?? "no-scene",
    previewMode ?? "raw",
    rawDebug ? "1" : "0",
    zoomEnabled ? "1" : "0",
    String(aperture),
    String(internalWidthPx),
    String(internalHeightPx),

    // Lens geometry
    vec3Key(o.lensCenterWorld),
    vec3Key(o.lensNormalWorld),

    // Film geometry
    vec3Key(o.filmCenterWorld),
    vec3Key(o.filmNormalWorld),
    vec3Key(o.filmPlane?.point),
    vec3Key(o.filmPlane?.normal),
    filmCornerKey(o.filmPlaneCornersWorld?.topLeft),
    filmCornerKey(o.filmPlaneCornersWorld?.topRight),
    filmCornerKey(o.filmPlaneCornersWorld?.bottomLeft),
    filmCornerKey(o.filmPlaneCornersWorld?.bottomRight),

    // Optical axis
    vec3Key(o.opticalAxis?.origin),
    vec3Key(o.opticalAxis?.direction),

    // Focus
    vec3Key(o.focusPlane?.point),
    vec3Key(o.focusPlane?.normal),

    // DOF planes
    vec3Key(o.depthOfFieldNearPlane?.point),
    vec3Key(o.depthOfFieldNearPlane?.normal),
    vec3Key(o.depthOfFieldFarPlane?.point),
    vec3Key(o.depthOfFieldFarPlane?.normal),

    // Off-axis projection
    matrixKey(o.offAxisProjectionMatrix),
  ];

  return parts.join("|");
}
