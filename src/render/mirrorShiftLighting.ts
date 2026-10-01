import type { Vec3 } from "../types/optics";
import {
  mirrorShiftGeometry,
  reflectPointAcrossMirrorPlane,
} from "../scenes/mirrorShiftGeometry";
import { DEFAULT_PRESENTATION_LIGHTING_PLACEMENT } from "./presentationLightingContract";
import type { ScenePresentationLightingIntent } from "./presentationLighting";
import { WORLD_SCALE } from "./rttUtils";

const mirrorShiftRealLightingTargetMm: Vec3 = {
  x: mirrorShiftGeometry.mirror.center.x,
  y: mirrorShiftGeometry.mirror.center.y,
  z: mirrorShiftGeometry.floor.centerZ,
};

const mirrorShiftRealKeyOffsetWorld = {
  x: DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld[0],
  y: DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld[1],
  z: DEFAULT_PRESENTATION_LIGHTING_PLACEMENT.keyOffsetWorld[2],
} as const;

const addWorldOffsetToMm = (
  point: Vec3,
  offsetWorld: { x: number; y: number; z: number },
): Vec3 => ({
  x: point.x + offsetWorld.x / WORLD_SCALE,
  y: point.y + offsetWorld.y / WORLD_SCALE,
  z: point.z + offsetWorld.z / WORLD_SCALE,
});

const subtractMm = (first: Vec3, second: Vec3) => ({
  x: (first.x - second.x) * WORLD_SCALE,
  y: (first.y - second.y) * WORLD_SCALE,
  z: (first.z - second.z) * WORLD_SCALE,
});

/**
 * Resolve presentation key placements for the real inspection subject and
 * reflected Ground Glass subject. Hemisphere fill is unpositioned, so only the
 * directional key is reflected here.
 */
export const resolveMirrorShiftPresentationLighting = (): Readonly<{
  observer: ScenePresentationLightingIntent;
  groundGlass: ScenePresentationLightingIntent;
}> => {
  const realTargetMm = mirrorShiftRealLightingTargetMm;
  const realKeyPositionMm = addWorldOffsetToMm(
    realTargetMm,
    mirrorShiftRealKeyOffsetWorld,
  );
  const mirrorPlane = mirrorShiftGeometry.mirror.plane;
  const reflectedTargetMm = reflectPointAcrossMirrorPlane(realTargetMm, mirrorPlane);
  const reflectedKeyPositionMm = reflectPointAcrossMirrorPlane(
    realKeyPositionMm,
    mirrorPlane,
  );

  return {
    observer: {
      targetMm: { ...realTargetMm },
      keyOffsetWorld: { ...mirrorShiftRealKeyOffsetWorld },
    },
    groundGlass: {
      targetMm: reflectedTargetMm,
      keyOffsetWorld: subtractMm(reflectedKeyPositionMm, reflectedTargetMm),
    },
  };
};
