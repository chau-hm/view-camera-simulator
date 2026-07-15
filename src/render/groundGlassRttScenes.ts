import type { SceneDefinition } from "../types/scene";
import type { Vec3 } from "../types/optics";

export const RTT_SCENES = [
  "focus-fundamentals-two-targets",
  "architecture-rise",
  "table-tilt",
] as const;
export type RttSceneId = (typeof RTT_SCENES)[number];

export function isGroundGlassRttScene(sceneId?: string): sceneId is RttSceneId {
  return typeof sceneId === "string" && (RTT_SCENES as readonly string[]).includes(sceneId);
}

export function getGroundGlassClipRangeWorld(
  scene: SceneDefinition | undefined,
  lensCenterWorld: Vec3,
): { near: number; far: number } {
  const sceneMaxDepthMm = scene?.bounds.max.z ?? 12000;
  return {
    near: 0.01,
    far: Math.max(4, (sceneMaxDepthMm - lensCenterWorld.z) * 0.001 + 1),
  };
}
