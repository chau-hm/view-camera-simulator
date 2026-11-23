import type { SceneVariationDescriptor } from "../types/sceneVariation";

export const ARCHITECTURE_FOREGROUND_SCENE_STYLE_ROLE_ID = "scene-style";

/** Stable v2 surface identities; each role owns an independent scene substream. */
export const ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS = Object.freeze({
  plaster: "plaster",
  rusticatedLimestone: "rusticated-limestone",
  trim: "limestone-trim",
  cap: "limestone-cap",
  mullion: "mullion",
  roof: "roof-slate",
  paving: "paving",
  curb: "curb",
  returns: "returns",
} as const);

export const ARCHITECTURE_FOREGROUND_STYLE_IDS = [
  "cool-contemporary",
  "warm-stone",
  "dark-contemporary",
  "light-mineral",
] as const;

export type ArchitectureForegroundStyleId =
  (typeof ARCHITECTURE_FOREGROUND_STYLE_IDS)[number];
type ArchitectureForegroundRole = keyof typeof ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS;
type ProceduralSurfaceRole = "plaster" | "rusticatedLimestone";
type SolidSurfaceRole = Exclude<ArchitectureForegroundRole, ProceduralSurfaceRole>;

export type ArchitectureForegroundProceduralVariation = Readonly<{
  variationSeed: number;
  color: string;
  repeat: readonly [number, number];
  roughness: number;
  normalStrength: number;
}>;

export type ArchitectureForegroundSolidVariation = Readonly<{
  variationSeed: number;
  color: string;
  roughness: number;
}>;

export type ArchitectureForegroundMaterialVariations = Readonly<{
  appearanceFamily: ArchitectureForegroundStyleId;
  plaster: ArchitectureForegroundProceduralVariation;
  rusticatedLimestone: ArchitectureForegroundProceduralVariation;
  trim: ArchitectureForegroundSolidVariation;
  cap: ArchitectureForegroundSolidVariation;
  mullion: ArchitectureForegroundSolidVariation;
  roof: ArchitectureForegroundSolidVariation;
  paving: ArchitectureForegroundSolidVariation;
  curb: ArchitectureForegroundSolidVariation;
  returns: ArchitectureForegroundSolidVariation;
}>;

type SurfaceRecipe = Readonly<{
  repeat: readonly [number, number];
  roughness: readonly [number, number];
  normalStrength: readonly [number, number];
}>;

type SolidRecipe = Readonly<{
  roughness: readonly [number, number];
}>;

type ArchitectureStyleRecipe = Readonly<Record<ArchitectureForegroundRole, readonly string[]>>;

const surfaceRecipes: Readonly<Record<ProceduralSurfaceRole, SurfaceRecipe>> = {
  plaster: {
    repeat: [1, 1],
    roughness: [0.89, 0.93],
    normalStrength: [0.13, 0.18],
  },
  rusticatedLimestone: {
    repeat: [1.12, 2.1],
    roughness: [0.89, 0.93],
    normalStrength: [0.22, 0.27],
  },
};

const solidRecipes: Readonly<Record<SolidSurfaceRole, SolidRecipe>> = {
  trim: { roughness: [0.82, 0.88] },
  cap: { roughness: [0.8, 0.88] },
  mullion: { roughness: [0.76, 0.84] },
  roof: { roughness: [0.9, 0.97] },
  paving: { roughness: [0.975, 0.995] },
  curb: { roughness: [0.82, 0.9] },
  returns: { roughness: [0.82, 0.9] },
};

const styleRecipes: Readonly<Record<ArchitectureForegroundStyleId, ArchitectureStyleRecipe>> = {
  "cool-contemporary": {
    plaster: ["#bac8cc", "#c2ced0"],
    rusticatedLimestone: ["#aab0ad", "#b3b7b2"],
    trim: ["#c0c8c8", "#c7cecd"],
    cap: ["#d9dfde", "#e0e5e4"],
    mullion: ["#a6b0af", "#afb8b7"],
    roof: ["#697274", "#707879"],
    paving: ["#e5e9e8", "#e1e5e4"],
    curb: ["#a4acab", "#aeb5b3"],
    returns: ["#b0b7b5", "#b9bfbd"],
  },
  "warm-stone": {
    plaster: ["#d4c1a0", "#d9c8aa"],
    rusticatedLimestone: ["#b9a486", "#c1ad8f"],
    trim: ["#c7b18f", "#c2aa84"],
    cap: ["#e0cba8", "#e7d8bc"],
    mullion: ["#9e8c71", "#a89578"],
    roof: ["#716d65", "#78746c"],
    paving: ["#f0e5d1", "#f3ebdc"],
    curb: ["#a99a81", "#b09e82"],
    returns: ["#b7a788", "#bdaa8d"],
  },
  "dark-contemporary": {
    plaster: ["#737d7f", "#7b8485"],
    rusticatedLimestone: ["#938e83", "#9a9489"],
    trim: ["#c0c4c1", "#c7cbc7"],
    cap: ["#dcdfda", "#d7dad6"],
    mullion: ["#b5bbb8", "#bec2bf"],
    roof: ["#54595a", "#5f6464"],
    paving: ["#d0d4d3", "#d5d8d7"],
    curb: ["#999e9c", "#a2a5a2"],
    returns: ["#a9ada9", "#b1b4b0"],
  },
  "light-mineral": {
    plaster: ["#e3dfd4", "#e6e2d8"],
    rusticatedLimestone: ["#c8bda8", "#cfc4ae"],
    trim: ["#d1c5ab", "#d7cbb2"],
    cap: ["#e6dfce", "#e9e4d9"],
    mullion: ["#98958d", "#a19c91"],
    roof: ["#7c7b76", "#85837c"],
    paving: ["#ece9df", "#efebe1"],
    curb: ["#aaa69b", "#b2aea3"],
    returns: ["#bab5a8", "#c0baad"],
  },
};

const rounded = (value: number): number => Math.round(value * 1000) / 1000;

const resolveProceduralRole = (
  descriptor: SceneVariationDescriptor,
  role: ProceduralSurfaceRole,
  family: ArchitectureStyleRecipe,
): ArchitectureForegroundProceduralVariation => {
  const recipe = surfaceRecipes[role];
  const stream = descriptor.createRandomStream(
    "materials",
    ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS[role],
  );
  const variationSeed = stream.nextUint32();
  return Object.freeze({
    variationSeed,
    color: stream.pick(family[role]),
    repeat: recipe.repeat,
    roughness: rounded(stream.nextRange(...recipe.roughness)),
    normalStrength: rounded(stream.nextRange(...recipe.normalStrength)),
  });
};

const resolveSolidRole = (
  descriptor: SceneVariationDescriptor,
  role: SolidSurfaceRole,
  family: ArchitectureStyleRecipe,
): ArchitectureForegroundSolidVariation => {
  const stream = descriptor.createRandomStream(
    "materials",
    ARCHITECTURE_FOREGROUND_MATERIAL_ROLE_IDS[role],
  );
  const variationSeed = stream.nextUint32();
  return Object.freeze({
    variationSeed,
    color: stream.pick(family[role]),
    roughness: rounded(stream.nextRange(...solidRecipes[role].roughness)),
  });
};

/** Pure, scene-coordinated v2 material recipes for Architecture + Foreground. */
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
    plaster: resolveProceduralRole(descriptor, "plaster", family),
    rusticatedLimestone: resolveProceduralRole(descriptor, "rusticatedLimestone", family),
    trim: resolveSolidRole(descriptor, "trim", family),
    cap: resolveSolidRole(descriptor, "cap", family),
    mullion: resolveSolidRole(descriptor, "mullion", family),
    roof: resolveSolidRole(descriptor, "roof", family),
    paving: resolveSolidRole(descriptor, "paving", family),
    curb: resolveSolidRole(descriptor, "curb", family),
    returns: resolveSolidRole(descriptor, "returns", family),
  });
};
