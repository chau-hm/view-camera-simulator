import type { SceneDefinition } from "../types/scene";
import type { DerivedOpticsState, Vec3 } from "../types/optics";
import { calculateImageDistanceAlongOpticalAxisMm } from "../core/optics/calculateImageDistance";

export const RTT_SCENES = [
  "view-camera-anatomy",
  "focus-fundamentals-two-targets",
  "architecture-rise",
  "architecture-foreground",
  "oblique-architecture",
  "table-tilt",
  "shelf-swing",
  "oblique-tabletop",
  "understanding-camera-movements",
  "mirror-shift",
  "interior-corner",
] as const;
export type RttSceneId = (typeof RTT_SCENES)[number];

export function isGroundGlassRttScene(sceneId?: string): sceneId is RttSceneId {
  return typeof sceneId === "string" && (RTT_SCENES as readonly string[]).includes(sceneId);
}

export const resolveGroundGlassImageDistanceMm = (
  opticsState: DerivedOpticsState,
): number =>
  calculateImageDistanceAlongOpticalAxisMm({
    lensCenterWorld: opticsState.lensCenterWorld,
    filmPlanePointWorld: opticsState.filmPlane.point,
    opticalAxisDirection: opticsState.opticalAxis.direction,
  }) ?? 1e-6;

export function getGroundGlassClipRangeWorld(
  scene: SceneDefinition | undefined,
  lensCenterWorld: Vec3,
  cameraForwardWorld?: Vec3,
): { near: number; far: number } {
  const bounds = scene?.bounds ?? {
    min: { x: -12000, y: -12000, z: -12000 },
    max: { x: 12000, y: 12000, z: 12000 },
  };
  const forwardLength = cameraForwardWorld
    ? Math.hypot(cameraForwardWorld.x, cameraForwardWorld.y, cameraForwardWorld.z)
    : 0;
  const forward = cameraForwardWorld && forwardLength > 1e-9
    ? {
        x: cameraForwardWorld.x / forwardLength,
        y: cameraForwardWorld.y / forwardLength,
        z: cameraForwardWorld.z / forwardLength,
      }
    : { x: 0, y: 0, z: 1 };
  let maximumForwardDepthMm = 0;
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        maximumForwardDepthMm = Math.max(
          maximumForwardDepthMm,
          (x - lensCenterWorld.x) * forward.x +
            (y - lensCenterWorld.y) * forward.y +
            (z - lensCenterWorld.z) * forward.z,
        );
      }
    }
  }
  return {
    near: 0.01,
    far: Math.max(4, maximumForwardDepthMm * 0.001 + 1),
  };
}
