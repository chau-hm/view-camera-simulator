import type { DerivedOpticsState } from "../types/optics";
import type { GroundGlassCameraPose } from "./configureGroundGlassCamera";

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
  configuredCameraPose?: GroundGlassCameraPose;
};

/**
 * Compute a deterministic cache key that includes every canonical-optics input
 * that can change the rendered Ground Glass output.
 *
 * This MUST invalidate when any of the following changes:
 * - canonical rigid camera-body pose
 * - configured Three.js camera extrinsics
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
    internalWidthPx, internalHeightPx, opticsState: o, configuredCameraPose } = inputs;

  const parts: string[] = [
    String(resourceGeneration),
    sceneId ?? "no-scene",
    previewMode ?? "raw",
    rawDebug ? "1" : "0",
    zoomEnabled ? "1" : "0",
    String(aperture),
    String(internalWidthPx),
    String(internalHeightPx),

    // Canonical rigid rig pose is an explicit renderer input even when other
    // derived world points happen to be numerically unchanged.
    vec3Key(o.cameraRigTransform.rigOriginWorld),
    finiteOrNull(o.cameraRigTransform.basePitchDeg),
    finiteOrNull(o.cameraRigTransform.bodyPitchDeg),
    vec3Key(o.cameraRigTransform.bodyPitchPivotRigLocal),
    vec3Key(o.cameraBodyPivotWorld),

    // Extrinsics actually consumed by the configured Three.js camera.
    configuredCameraPose
      ? configuredCameraPose.positionWorld.map(finiteOrNull).join(":")
      : "null",
    configuredCameraPose
      ? configuredCameraPose.upWorld.map(finiteOrNull).join(":")
      : "null",
    configuredCameraPose
      ? configuredCameraPose.forwardWorld.map(finiteOrNull).join(":")
      : "null",

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
