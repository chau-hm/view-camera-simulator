import type { SceneVariationDescriptor } from "../types/sceneVariation";

export const ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS = Object.freeze({
  buildingShell: "building-shell",
  roofParapet: "roof-parapet",
  groundConcrete: "ground-concrete",
  forecourtTrim: "forecourt-trim",
  windowFrame: "window-frame",
} as const);

export type ArchitectureForegroundSurfaceRole =
  keyof typeof ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS;

export type ArchitectureForegroundSurfaceVariation = Readonly<{
  variationSeed: number;
  color: string;
  repeat: readonly [number, number];
  roughness: number;
  normalStrength: number;
}>;

export type ArchitectureForegroundMaterialVariations = Readonly<
  Record<ArchitectureForegroundSurfaceRole, ArchitectureForegroundSurfaceVariation>
>;

const roleRecipes: Readonly<Record<ArchitectureForegroundSurfaceRole, Readonly<{
  palette: readonly string[];
  repeat: readonly [number, number];
  repeatScale: readonly [number, number];
  roughness: readonly [number, number];
  normalStrength: readonly [number, number];
}>>> = {
  buildingShell: {
    palette: ["#92a7b8", "#8ea2b0", "#96aab8", "#91a4b2"],
    repeat: [2, 2],
    repeatScale: [0.92, 1.08],
    roughness: [0.9, 0.95],
    normalStrength: [0.035, 0.065],
  },
  roofParapet: {
    palette: ["#dbe5ec", "#d6e0e6", "#e0e8ed", "#d8e2e8"],
    repeat: [2, 2],
    repeatScale: [0.92, 1.08],
    roughness: [0.8, 0.87],
    normalStrength: [0.02, 0.045],
  },
  groundConcrete: {
    palette: ["#d8e1e7", "#d2dce2", "#d5dfe5", "#dbe3e8"],
    repeat: [4, 5],
    repeatScale: [0.94, 1.06],
    roughness: [0.95, 0.99],
    normalStrength: [0.025, 0.055],
  },
  forecourtTrim: {
    palette: ["#b9c5cc", "#b5c2c9", "#bdc8ce", "#b7c4cb"],
    repeat: [1.2, 1.2],
    repeatScale: [0.92, 1.08],
    roughness: [0.86, 0.93],
    normalStrength: [0.02, 0.045],
  },
  windowFrame: {
    palette: ["#e5edf2", "#e0e8ed", "#e7eef2", "#dfe8ed"],
    repeat: [1, 1],
    repeatScale: [0.95, 1.05],
    roughness: [0.78, 0.85],
    normalStrength: [0.012, 0.03],
  },
};

const rounded = (value: number, precision: number): number => {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
};

const resolveRole = (
  descriptor: SceneVariationDescriptor,
  role: ArchitectureForegroundSurfaceRole,
): ArchitectureForegroundSurfaceVariation => {
  const recipe = roleRecipes[role];
  const stream = descriptor.createRandomStream(
    "materials",
    ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS[role],
  );
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

/** Pure, role-addressed finish parameters for Architecture + Foreground. */
export const resolveArchitectureForegroundMaterialVariations = (
  descriptor: SceneVariationDescriptor | undefined,
): ArchitectureForegroundMaterialVariations | undefined => {
  if (!descriptor) return undefined;

  return Object.freeze({
    buildingShell: resolveRole(descriptor, "buildingShell"),
    roofParapet: resolveRole(descriptor, "roofParapet"),
    groundConcrete: resolveRole(descriptor, "groundConcrete"),
    forecourtTrim: resolveRole(descriptor, "forecourtTrim"),
    windowFrame: resolveRole(descriptor, "windowFrame"),
  });
};
