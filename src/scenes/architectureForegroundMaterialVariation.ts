import type { SceneVariationDescriptor } from "../types/sceneVariation";

export const ARCHITECTURE_FOREGROUND_SCENE_STYLE_ROLE_ID = "scene-style";

export const ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS = Object.freeze({
  buildingShell: "building-shell",
  frontFacade: "front-facade",
  roofParapet: "roof-parapet",
  groundConcrete: "ground-concrete",
  forecourtTrim: "forecourt-trim",
  windowFrame: "window-frame",
} as const);

export const ARCHITECTURE_FOREGROUND_STYLE_IDS = [
  "cool-contemporary",
  "warm-stone",
  "dark-contemporary",
  "light-mineral",
] as const;

export type ArchitectureForegroundStyleId =
  (typeof ARCHITECTURE_FOREGROUND_STYLE_IDS)[number];
export type ArchitectureForegroundSurfaceRole =
  keyof typeof ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS;

export type ArchitectureForegroundSurfaceVariation = Readonly<{
  variationSeed: number;
  color: string;
  repeat: readonly [number, number];
  roughness: number;
  normalStrength: number;
}>;

export type ArchitectureForegroundFacadeVariation = Readonly<{
  variationSeed: number;
  primaryColor: string;
  secondaryColor: string;
  repeat: readonly [5, 4];
  roughness: 0.88;
}>;

export type ArchitectureForegroundMaterialVariations = Readonly<{
  appearanceFamily: ArchitectureForegroundStyleId;
  buildingShell: ArchitectureForegroundSurfaceVariation;
  frontFacade: ArchitectureForegroundFacadeVariation;
  roofParapet: ArchitectureForegroundSurfaceVariation;
  groundConcrete: ArchitectureForegroundSurfaceVariation;
  forecourtTrim: ArchitectureForegroundSurfaceVariation;
  windowFrame: ArchitectureForegroundSurfaceVariation;
}>;

type SurfaceRecipe = Readonly<{
  repeat: readonly [number, number];
  repeatScale: readonly [number, number];
  roughness: readonly [number, number];
  normalStrength: readonly [number, number];
}>;

type ArchitectureStyleRecipe = Readonly<{
  buildingShell: readonly string[];
  frontFacade: readonly (readonly [primaryColor: string, secondaryColor: string])[];
  roofParapet: readonly string[];
  groundConcrete: readonly string[];
  forecourtTrim: readonly string[];
  windowFrame: readonly string[];
}>;

const surfaceRecipes: Readonly<Record<Exclude<ArchitectureForegroundSurfaceRole, "frontFacade">, SurfaceRecipe>> = {
  buildingShell: {
    repeat: [2, 2],
    repeatScale: [0.96, 1.04],
    roughness: [0.9, 0.95],
    normalStrength: [0.035, 0.065],
  },
  roofParapet: {
    repeat: [2, 2],
    repeatScale: [0.96, 1.04],
    roughness: [0.8, 0.87],
    normalStrength: [0.02, 0.045],
  },
  groundConcrete: {
    repeat: [4, 5],
    repeatScale: [0.97, 1.03],
    roughness: [0.95, 0.99],
    normalStrength: [0.025, 0.055],
  },
  forecourtTrim: {
    repeat: [1.2, 1.2],
    repeatScale: [0.96, 1.04],
    roughness: [0.86, 0.93],
    normalStrength: [0.02, 0.045],
  },
  windowFrame: {
    repeat: [1, 1],
    repeatScale: [0.97, 1.03],
    roughness: [0.78, 0.85],
    normalStrength: [0.012, 0.03],
  },
};

const styleRecipes: Readonly<Record<ArchitectureForegroundStyleId, ArchitectureStyleRecipe>> = {
  "cool-contemporary": {
    buildingShell: ["#8197a5", "#879ba8"],
    frontFacade: [["#9eafb8", "#8799a3"], ["#a3b3bb", "#8c9da6"]],
    roofParapet: ["#cbd4d9", "#d1d9dd"],
    groundConcrete: ["#bec8cc", "#c4cdd1"],
    forecourtTrim: ["#a2adb1", "#aab4b7"],
    windowFrame: ["#d3dcdf", "#dbe2e5"],
  },
  "warm-stone": {
    buildingShell: ["#a08d73", "#a7947b"],
    frontFacade: [["#c9b99f", "#ad9d82"], ["#cdbda3", "#b2a287"]],
    roofParapet: ["#d9ccb7", "#dfd2bd"],
    groundConcrete: ["#bdb5a8", "#c5bcae"],
    forecourtTrim: ["#a99e8c", "#b2a793"],
    windowFrame: ["#8a7d6d", "#938675"],
  },
  "dark-contemporary": {
    buildingShell: ["#535d61", "#5b6467"],
    frontFacade: [["#747d80", "#5b6467"], ["#798184", "#60696c"]],
    roofParapet: ["#959d9f", "#9ea5a6"],
    groundConcrete: ["#929795", "#999d9b"],
    forecourtTrim: ["#747c7d", "#7b8282"],
    windowFrame: ["#b3bbbc", "#bac1c2"],
  },
  "light-mineral": {
    buildingShell: ["#b6bcba", "#bec3c1"],
    frontFacade: [["#e0e1dc", "#c5c9c7"], ["#e3e4df", "#c9cdcb"]],
    roofParapet: ["#e1e4e1", "#e7e9e7"],
    groundConcrete: ["#aeb5b5", "#b6bcbb"],
    forecourtTrim: ["#c4cac8", "#ccd1cf"],
    windowFrame: ["#879296", "#909a9d"],
  },
};

const rounded = (value: number, precision: number): number => {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
};

const resolveRole = (
  descriptor: SceneVariationDescriptor,
  role: Exclude<ArchitectureForegroundSurfaceRole, "frontFacade">,
  family: ArchitectureStyleRecipe,
): ArchitectureForegroundSurfaceVariation => {
  const recipe = surfaceRecipes[role];
  const stream = descriptor.createRandomStream(
    "materials",
    ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS[role],
  );
  const variationSeed = stream.nextUint32();
  const color = stream.pick(family[role]);
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

const resolveFacade = (
  descriptor: SceneVariationDescriptor,
  family: ArchitectureStyleRecipe,
): ArchitectureForegroundFacadeVariation => {
  const stream = descriptor.createRandomStream(
    "materials",
    ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS.frontFacade,
  );
  const variationSeed = stream.nextUint32();
  const [primaryColor, secondaryColor] = stream.pick(family.frontFacade);
  return Object.freeze({
    variationSeed,
    primaryColor,
    secondaryColor,
    repeat: [5, 4] as const,
    roughness: 0.88,
  });
};

/** Pure, scene-coordinated, role-addressed finishes for Architecture + Foreground. */
export const resolveArchitectureForegroundMaterialVariations = (
  descriptor: SceneVariationDescriptor | undefined,
): ArchitectureForegroundMaterialVariations | undefined => {
  if (!descriptor) return undefined;

  const styleStream = descriptor.createRandomStream(
    "materials",
    ARCHITECTURE_FOREGROUND_SCENE_STYLE_ROLE_ID,
  );
  const appearanceFamily = styleStream.pick(ARCHITECTURE_FOREGROUND_STYLE_IDS);
  const family = styleRecipes[appearanceFamily];

  return Object.freeze({
    appearanceFamily,
    buildingShell: resolveRole(descriptor, "buildingShell", family),
    frontFacade: resolveFacade(descriptor, family),
    roofParapet: resolveRole(descriptor, "roofParapet", family),
    groundConcrete: resolveRole(descriptor, "groundConcrete", family),
    forecourtTrim: resolveRole(descriptor, "forecourtTrim", family),
    windowFrame: resolveRole(descriptor, "windowFrame", family),
  });
};
