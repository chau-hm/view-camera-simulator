import type { SceneVariationDescriptor } from "../types/sceneVariation";

export const INTERIOR_CORNER_MATERIAL_ROLE_IDS = {
  wall: "wall-plaster",
  ceiling: "ceiling-plaster",
  floor: "floor-wood",
  trim: "trim-plaster",
  wood: "furniture-wood",
  artwork: "artwork-paper",
  fabric: "bench-fabric",
} as const;

export type InteriorCornerMaterialRole = keyof typeof INTERIOR_CORNER_MATERIAL_ROLE_IDS;
export type InteriorCornerMaterialVariationSeeds = Readonly<
  Record<InteriorCornerMaterialRole, number>
>;

/** Resolve role-scoped seeds once from the shared scene identity for all subject owners. */
export const resolveInteriorCornerMaterialVariationSeeds = (
  descriptor: SceneVariationDescriptor | undefined,
): InteriorCornerMaterialVariationSeeds | undefined => {
  if (!descriptor) return undefined;
  return Object.freeze(Object.fromEntries(
    Object.entries(INTERIOR_CORNER_MATERIAL_ROLE_IDS).map(([role, objectId]) => [
      role,
      descriptor.createRandomStream("materials", objectId).nextUint32(),
    ]),
  ) as Record<InteriorCornerMaterialRole, number>);
};
