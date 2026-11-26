import type { SceneVariationDescriptor } from "../types/sceneVariation";

export const TABLE_TILT_SCENE_STYLE_ROLE_ID = "scene-style";

export const TABLE_TILT_MATERIAL_ROLE_IDS = Object.freeze({
  tabletopWood: "tabletop-wood",
  tableFrame: "table-frame",
  contextWood: "context-wood",
  contextAccent: "context-accent",
} as const);

export const TABLE_TILT_STYLE_IDS = [
  "light-oak-like",
  "medium-teak-like",
  "dark-walnut-like",
] as const;

export type TableTiltStyleId = (typeof TABLE_TILT_STYLE_IDS)[number];
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
  appearanceFamily: TableTiltStyleId;
  tabletopWood: TableTiltSurfaceVariation;
  tableFrame: TableTiltScalarVariation;
  contextWood: TableTiltSurfaceVariation;
  contextAccent: TableTiltScalarVariation;
}>;

type SurfaceRecipe = Readonly<{
  palette: readonly string[];
  repeat: readonly [number, number];
  repeatScale: readonly [number, number];
  roughness: readonly [number, number];
  normalStrength: readonly [number, number];
}>;

type ScalarRecipe = Readonly<{
  palette: readonly string[];
  roughness: readonly [number, number];
}>;

type TableTiltStyleRecipe = Readonly<{
  tabletopWood: SurfaceRecipe;
  tableFrame: ScalarRecipe;
  contextWood: SurfaceRecipe;
  contextAccent: ScalarRecipe;
}>;

const styleRecipes: Readonly<Record<TableTiltStyleId, TableTiltStyleRecipe>> = {
  "light-oak-like": {
    tabletopWood: {
      palette: ["#c59a66", "#cba36e", "#bd925b"],
      repeat: [1.5, 3.2],
      repeatScale: [0.96, 1.04],
      roughness: [0.84, 0.89],
      normalStrength: [0.018, 0.032],
    },
    tableFrame: { palette: ["#62594c", "#6b6052"], roughness: [0.88, 0.93] },
    contextWood: {
      palette: ["#a87b4c", "#b08251", "#a27749"],
      repeat: [1.4, 3.2],
      repeatScale: [0.95, 1.05],
      roughness: [0.82, 0.88],
      normalStrength: [0.02, 0.035],
    },
    contextAccent: { palette: ["#485461", "#4c5965"], roughness: [0.75, 0.82] },
  },
  "medium-teak-like": {
    tabletopWood: {
      palette: ["#9c6040", "#a36745", "#945b3d"],
      repeat: [1.6, 3.8],
      repeatScale: [0.95, 1.05],
      roughness: [0.8, 0.86],
      normalStrength: [0.02, 0.036],
    },
    tableFrame: { palette: ["#4c4137", "#55483d"], roughness: [0.86, 0.92] },
    contextWood: {
      palette: ["#80533e", "#895941", "#79513c"],
      repeat: [1.5, 3.8],
      repeatScale: [0.94, 1.06],
      roughness: [0.79, 0.86],
      normalStrength: [0.02, 0.038],
    },
    contextAccent: { palette: ["#3e5362", "#435968"], roughness: [0.74, 0.82] },
  },
  "dark-walnut-like": {
    tabletopWood: {
      palette: ["#704c34", "#785139", "#684831"],
      repeat: [1.5, 3.5],
      repeatScale: [0.95, 1.05],
      roughness: [0.8, 0.86],
      normalStrength: [0.021, 0.038],
    },
    tableFrame: { palette: ["#373432", "#403a36"], roughness: [0.86, 0.92] },
    contextWood: {
      palette: ["#553d30", "#5e4435", "#4f392e"],
      repeat: [1.4, 3.5],
      repeatScale: [0.94, 1.06],
      roughness: [0.79, 0.86],
      normalStrength: [0.021, 0.039],
    },
    contextAccent: { palette: ["#3c4651", "#424c57"], roughness: [0.74, 0.82] },
  },
};

const rounded = (value: number, precision: number): number => {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
};

const resolveSurfaceRole = (
  descriptor: SceneVariationDescriptor,
  role: TableTiltSurfaceRole,
  recipe: SurfaceRecipe,
): TableTiltSurfaceVariation => {
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
  recipe: ScalarRecipe,
): TableTiltScalarVariation => {
  const stream = descriptor.createRandomStream("materials", TABLE_TILT_MATERIAL_ROLE_IDS[role]);
  return Object.freeze({
    variationSeed: stream.nextUint32(),
    color: stream.pick(recipe.palette),
    roughness: rounded(stream.nextRange(...recipe.roughness), 3),
  });
};

/** Pure, scene-coordinated, role-addressed finishes for Table Tilt. */
export const resolveTableTiltMaterialVariations = (
  descriptor: SceneVariationDescriptor | undefined,
): TableTiltMaterialVariations | undefined => {
  if (!descriptor) return undefined;

  const styleStream = descriptor.createRandomStream("materials", TABLE_TILT_SCENE_STYLE_ROLE_ID);
  const appearanceFamily = styleStream.pick(TABLE_TILT_STYLE_IDS);
  const family = styleRecipes[appearanceFamily];

  return Object.freeze({
    appearanceFamily,
    tabletopWood: resolveSurfaceRole(descriptor, "tabletopWood", family.tabletopWood),
    tableFrame: resolveScalarRole(descriptor, "tableFrame", family.tableFrame),
    contextWood: resolveSurfaceRole(descriptor, "contextWood", family.contextWood),
    contextAccent: resolveScalarRole(descriptor, "contextAccent", family.contextAccent),
  });
};
