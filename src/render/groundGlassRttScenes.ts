export const RTT_SCENES = ["focus-fundamentals-two-targets", "architecture-rise"] as const;
export type RttSceneId = (typeof RTT_SCENES)[number];

export function isGroundGlassRttScene(sceneId?: string): sceneId is RttSceneId {
  return typeof sceneId === "string" && (RTT_SCENES as readonly string[]).includes(sceneId);
}
