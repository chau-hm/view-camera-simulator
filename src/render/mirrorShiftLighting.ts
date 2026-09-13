import type { Vec3 } from "../types/optics";
import {
  mirrorShiftGeometry,
  reflectPointAcrossMirrorPlane,
} from "../scenes/mirrorShiftGeometry";
import { TEACHING_LIGHTING_CONFIG } from "./TeachingLighting";
import type { SceneSubjectRttLighting } from "./sceneSubjectRegistry";
import { WORLD_SCALE } from "./rttUtils";

const mirrorShiftRealLightingTargetMm: Vec3 = {
  x: mirrorShiftGeometry.mirror.center.x,
  y: mirrorShiftGeometry.mirror.center.y,
  z: mirrorShiftGeometry.floor.centerZ,
};

const mirrorShiftRealKeyOffsetWorld = {
  x: TEACHING_LIGHTING_CONFIG.defaultKeyOffsetWorld[0],
  y: TEACHING_LIGHTING_CONFIG.defaultKeyOffsetWorld[1],
  z: TEACHING_LIGHTING_CONFIG.defaultKeyOffsetWorld[2],
} as const;

const mirrorShiftRealFillOffsetWorld = {
  x: 2.5,
  y: 1.5,
  z: -1.5,
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
 * Resolve the two lighting placements needed by the Mirror Shift split:
 * the inspection subject remains on the real side, while the RTT subject is
 * a virtual mirror-side copy. Reflect the real light positions first, then
 * express the result using the existing target-relative lighting contract.
 */
export const resolveMirrorShiftLighting = (): Readonly<{
  viewport: SceneSubjectRttLighting;
  rtt: SceneSubjectRttLighting;
}> => {
  const realTargetMm = mirrorShiftRealLightingTargetMm;
  const realKeyPositionMm = addWorldOffsetToMm(
    realTargetMm,
    mirrorShiftRealKeyOffsetWorld,
  );
  const realFillPositionMm = addWorldOffsetToMm(
    realTargetMm,
    mirrorShiftRealFillOffsetWorld,
  );
  const mirrorPlane = mirrorShiftGeometry.mirror.plane;
  const reflectedTargetMm = reflectPointAcrossMirrorPlane(realTargetMm, mirrorPlane);
  const reflectedKeyPositionMm = reflectPointAcrossMirrorPlane(
    realKeyPositionMm,
    mirrorPlane,
  );
  const reflectedFillPositionMm = reflectPointAcrossMirrorPlane(
    realFillPositionMm,
    mirrorPlane,
  );

  return {
    viewport: {
      targetMm: { ...realTargetMm },
      keyOffsetWorld: { ...mirrorShiftRealKeyOffsetWorld },
      fillOffsetWorld: { ...mirrorShiftRealFillOffsetWorld },
    },
    rtt: {
      targetMm: reflectedTargetMm,
      keyOffsetWorld: subtractMm(reflectedKeyPositionMm, reflectedTargetMm),
      fillOffsetWorld: subtractMm(reflectedFillPositionMm, reflectedTargetMm),
    },
  };
};
