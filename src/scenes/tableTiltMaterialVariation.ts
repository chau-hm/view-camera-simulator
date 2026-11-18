import type { SceneVariationDescriptor } from "../types/sceneVariation";

export const TABLE_TILT_MATERIAL_ROLE_IDS = Object.freeze({
  tabletopWood: "tabletop-wood",
  tableFrame: "table-frame",
  contextWood: "context-wood",
  contextAccent: "context-accent",
} as const);

export type TableTiltSurfaceRole = "tabletopWood" | "contextWood";
export type TableTiltScalarRole = "tableFrame" | "contextAccent";

export type TableTiltSurfaceVariation = Readonly<{
  variationSeed: number;
  color: string;
  repeat: readonly [number, number];
  roughness: number;
  normalStrength: number;
}>;

export type TableTiltScalarVariation = Readonly<{
  variationSeed: number;
  color: string;
  roughness: number;
}>;

export type TableTiltMaterialVariations = Readonly<{
  tabletopWood: TableTiltSurfaceVariation;
  tableFrame: TableTiltScalarVariation;
  contextWood: TableTiltSurfaceVariation;
  contextAccent: TableTiltScalarVariation;
}>;

const surfaceRecipes: Readonly<Record<TableTiltSurfaceRole, Readonly<{
  palette: readonly string[];
  repeat: readonly [number, number];
  repeatScale: readonly [number, number];
  roughness: readonly [number, number];
  normalStrength: readonly [number, number];
}>>> = {
  tabletopWood: {
    palette: ["#a16207", "#9c6516", "#a4691d", "#9d6214"],
    repeat: [1.5, 4.5],
    repeatScale: [0.94, 1.06],
    roughness: [0.8, 0.85],
    normalStrength: [0.018, 0.038],
  },
  contextWood: {
    palette: ["#8b5e3c", "#8f6240", "#875a38", "#946746"],
    repeat: [1.5, 5],
    repeatScale: [0.92, 1.08],
    roughness: [0.78, 0.85],
    normalStrength: [0.02, 0.045],
  },
};

const scalarRecipes: Readonly<Record<TableTiltScalarRole, Readonly<{
  palette: readonly string[];
  roughness: readonly [number, number];
}>>> = {
  tableFrame: {
    palette: ["#57534e", "#5b5752", "#534f4b", "#5c5853"],
    roughness: [0.88, 0.93],
  },
  contextAccent: {
    palette: ["#334155", "#364654", "#394958", "#304251"],
    roughness: [0.74, 0.81],
  },
};

const rounded = (value: number, precision: number): number => {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
};

const resolveSurfaceRole = (
  descriptor: SceneVariationDescriptor,
  role: TableTiltSurfaceRole,
): TableTiltSurfaceVariation => {
  const recipe = surfaceRecipes[role];
  const stream = descriptor.createRandomStream("materials", TABLE_TILT_MATERIAL_ROLE_IDS[role]);
  const variationSeed = stream.nextUint32();
  const color = stream.pick(recipe.palette);
  const repeat = Object.freeze([
    rounded(recipe.repeat[0] * stream.nextRange(...recipe.repeatScale), 3),
    rounded(recipe.repeat[1] * stream.nextRange(...recipe.repeatScale), 3),
  ]) as readonly [number, number];

  return Object.freeze({
    variationSeed,
    color,
    repeat,
    roughness: rounded(stream.nextRange(...recipe.roughness), 3),
    normalStrength: rounded(stream.nextRange(...recipe.normalStrength), 3),
  });
};

const resolveScalarRole = (
  descriptor: SceneVariationDescriptor,
  role: TableTiltScalarRole,
): TableTiltScalarVariation => {
  const recipe = scalarRecipes[role];
  const stream = descriptor.createRandomStream("materials", TABLE_TILT_MATERIAL_ROLE_IDS[role]);
  return Object.freeze({
    variationSeed: stream.nextUint32(),
    color: stream.pick(recipe.palette),
    roughness: rounded(stream.nextRange(...recipe.roughness), 3),
  });
};

/** Pure, role-addressed finish parameters for Table Tilt. */
export const resolveTableTiltMaterialVariations = (
  descriptor: SceneVariationDescriptor | undefined,
): TableTiltMaterialVariations | undefined => {
  if (!descriptor) return undefined;

  return Object.freeze({
    tabletopWood: resolveSurfaceRole(descriptor, "tabletopWood"),
    tableFrame: resolveScalarRole(descriptor, "tableFrame"),
    contextWood: resolveSurfaceRole(descriptor, "contextWood"),
    contextAccent: resolveScalarRole(descriptor, "contextAccent"),
  });
};
