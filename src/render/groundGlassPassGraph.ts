/** Semantic Ground Glass DOF stages that the current renderer realizes. */
export type GroundGlassPassId =
  | "sceneRender"
  | "cocFootprint"
  | "farGather"
  | "nearGather"
  | "composite";

/** The normal physical-DOF path, in its current execution order. */
export const GROUND_GLASS_PASS_ORDER = [
  "sceneRender",
  "cocFootprint",
  "farGather",
  "nearGather",
  "composite",
] as const satisfies readonly GroundGlassPassId[];

/** Raw RTT Debug bypasses classification and both gathers, then composites scene color directly. */
export const GROUND_GLASS_RAW_DEBUG_PASS_ORDER = [
  "sceneRender",
  "composite",
] as const satisfies readonly GroundGlassPassId[];

/** Returns the semantic passes expected for the selected Ground Glass path. */
export const resolveGroundGlassPassOrder = (
  rawDebug: boolean,
): readonly GroundGlassPassId[] =>
  rawDebug ? GROUND_GLASS_RAW_DEBUG_PASS_ORDER : GROUND_GLASS_PASS_ORDER;
