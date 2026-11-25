import type { SceneVariationDescriptor } from "../types/sceneVariation";

export const ARCHITECTURE_RISE_MATERIAL_ROLE_IDS = Object.freeze({
  sceneStyle: "scene-style",
  masonryBrick: "masonry-brick",
  masonryMortar: "masonry-mortar",
  stoneBase: "stone-base",
  stoneJoints: "stone-joints",
  quietFacade: "quiet-facade",
  windowTrim: "window-trim",
  roofSurface: "roof-surface",
  doorWood: "door-wood",
  sidewalk: "sidewalk",
  pavement: "pavement",
  groundPlane: "ground-plane",
} as const);

export type ArchitectureRiseMaterialFamilyId =
  | "traditional-red-brick"
  | "weathered-brown-brick"
  | "light-clay-brick"
  | "dark-fired-brick";

export type ArchitectureRiseRgb = readonly [number, number, number];

export type ArchitectureRiseBrickAppearance = Readonly<{
  palette: readonly ArchitectureRiseRgb[];
  mortarColor: ArchitectureRiseRgb;
  realizationSeed: number;
  mortarSeed: number;
  roughness: number;
  normalStrength: number;
}>;

export type ArchitectureRiseSurfaceAppearance = Readonly<{
  color: string;
  repeat: readonly [number, number];
  roughness: number;
  normalStrength: number;
  variationSeed: number;
}>;

export type ArchitectureRiseMaterialVariation = Readonly<{
  familyId: ArchitectureRiseMaterialFamilyId;
  brick: ArchitectureRiseBrickAppearance;
  mortarJointColor: string;
  quietFacadeColor: string;
  base: ArchitectureRiseSurfaceAppearance;
  door: ArchitectureRiseSurfaceAppearance;
  roof: ArchitectureRiseSurfaceAppearance;
  trim: ArchitectureRiseSurfaceAppearance;
  sidewalk: ArchitectureRiseSurfaceAppearance;
  pavementColor: string;
  groundColor: string;
}>;

type FamilyRecipe = Readonly<{
  id: ArchitectureRiseMaterialFamilyId;
  brickPalette: readonly ArchitectureRiseRgb[];
  mortarColor: ArchitectureRiseRgb;
  mortarJointColor: string;
  quietFacadeColor: string;
  base: Omit<ArchitectureRiseSurfaceAppearance, "variationSeed">;
  door: Omit<ArchitectureRiseSurfaceAppearance, "variationSeed">;
  roof: Omit<ArchitectureRiseSurfaceAppearance, "variationSeed">;
  trim: Omit<ArchitectureRiseSurfaceAppearance, "variationSeed">;
  sidewalk: Omit<ArchitectureRiseSurfaceAppearance, "variationSeed">;
  pavementColor: string;
  groundColor: string;
}>;

const FAMILIES: readonly FamilyRecipe[] = [
  {
    id: "traditional-red-brick",
    brickPalette: [
      [151, 83, 62], [157, 89, 67], [145, 79, 61], [165, 96, 72],
      [153, 86, 64], [142, 78, 59], [160, 92, 68], [149, 83, 64],
    ],
    mortarColor: [160, 144, 123],
    mortarJointColor: "#9b8b75",
    quietFacadeColor: "#98553f",
    base: { color: "#c2b299", repeat: [5, 4], roughness: 0.92, normalStrength: 0.2 },
    door: { color: "#50352b", repeat: [1, 2], roughness: 0.86, normalStrength: 0.14 },
    roof: { color: "#929791", repeat: [1, 1], roughness: 0.9, normalStrength: 0.18 },
    trim: { color: "#e5dac5", repeat: [1, 1], roughness: 0.78, normalStrength: 0.09 },
    sidewalk: { color: "#9b988e", repeat: [12, 10], roughness: 0.96, normalStrength: 0.14 },
    pavementColor: "#696c68",
    groundColor: "#9a9c95",
  },
  {
    id: "weathered-brown-brick",
    brickPalette: [
      [112, 73, 56], [126, 81, 61], [137, 88, 65], [104, 69, 55],
      [145, 94, 70], [119, 78, 62], [130, 84, 66], [99, 66, 53],
    ],
    mortarColor: [157, 148, 133],
    mortarJointColor: "#898174",
    quietFacadeColor: "#795d4f",
    base: { color: "#c5b9a5", repeat: [5, 4], roughness: 0.93, normalStrength: 0.19 },
    door: { color: "#49372d", repeat: [1, 2], roughness: 0.88, normalStrength: 0.13 },
    roof: { color: "#858b88", repeat: [1, 1], roughness: 0.92, normalStrength: 0.17 },
    trim: { color: "#d8cdb8", repeat: [1, 1], roughness: 0.8, normalStrength: 0.09 },
    sidewalk: { color: "#918d84", repeat: [12, 10], roughness: 0.97, normalStrength: 0.13 },
    pavementColor: "#686b68",
    groundColor: "#969891",
  },
  {
    id: "light-clay-brick",
    brickPalette: [
      [166, 124, 92], [178, 137, 105], [153, 112, 82], [184, 143, 109],
      [172, 130, 98], [158, 117, 86], [188, 147, 113], [162, 120, 89],
    ],
    mortarColor: [143, 122, 101],
    mortarJointColor: "#89745f",
    quietFacadeColor: "#a17c61",
    base: { color: "#d0c5b0", repeat: [5, 4], roughness: 0.92, normalStrength: 0.2 },
    door: { color: "#594334", repeat: [1, 2], roughness: 0.86, normalStrength: 0.14 },
    roof: { color: "#9a9a93", repeat: [1, 1], roughness: 0.9, normalStrength: 0.18 },
    trim: { color: "#d6cbb6", repeat: [1, 1], roughness: 0.79, normalStrength: 0.09 },
    sidewalk: { color: "#a09b90", repeat: [12, 10], roughness: 0.96, normalStrength: 0.14 },
    pavementColor: "#71736d",
    groundColor: "#a1a198",
  },
  {
    id: "dark-fired-brick",
    brickPalette: [
      [78, 64, 59], [91, 69, 60], [102, 74, 62], [84, 67, 64],
      [111, 82, 67], [73, 61, 57], [96, 72, 67], [86, 66, 58],
    ],
    mortarColor: [145, 136, 124],
    mortarJointColor: "#827a70",
    quietFacadeColor: "#65554f",
    base: { color: "#b9b3a6", repeat: [5, 4], roughness: 0.93, normalStrength: 0.19 },
    door: { color: "#3e342e", repeat: [1, 2], roughness: 0.88, normalStrength: 0.13 },
    roof: { color: "#777e7d", repeat: [1, 1], roughness: 0.92, normalStrength: 0.17 },
    trim: { color: "#c7bead", repeat: [1, 1], roughness: 0.8, normalStrength: 0.09 },
    sidewalk: { color: "#898a84", repeat: [12, 10], roughness: 0.97, normalStrength: 0.13 },
    pavementColor: "#626662",
    groundColor: "#8d918b",
  },
];

const boundedColor = (color: string, stream: ReturnType<SceneVariationDescriptor["createRandomStream"]>): string => {
  const value = color.replace(/^#/, "");
  const channels = [0, 2, 4].map((offset) =>
    Math.max(0, Math.min(255, Number.parseInt(value.slice(offset, offset + 2), 16) + stream.nextInt(-3, 3))),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
};

const resolveSurface = (
  roleId: string,
  recipe: Omit<ArchitectureRiseSurfaceAppearance, "variationSeed">,
  descriptor: SceneVariationDescriptor,
): ArchitectureRiseSurfaceAppearance => {
  const stream = descriptor.createRandomStream("materials", roleId);
  const scale = stream.nextRange(0.97, 1.03);
  return Object.freeze({
    color: boundedColor(recipe.color, stream),
    repeat: Object.freeze([recipe.repeat[0] * scale, recipe.repeat[1] * scale]) as readonly [number, number],
    roughness: Math.max(0.72, Math.min(0.98, recipe.roughness + stream.nextRange(-0.012, 0.012))),
    normalStrength: Math.max(0.07, Math.min(0.22, recipe.normalStrength + stream.nextRange(-0.008, 0.008))),
    variationSeed: stream.nextUint32(),
  });
};

/** Resolve one coherent, renderer-neutral material family and independently addressed role recipes. */
export const resolveArchitectureRiseMaterialVariation = (
  descriptor: SceneVariationDescriptor | undefined,
): ArchitectureRiseMaterialVariation | undefined => {
  if (!descriptor) return undefined;
  const family = descriptor.createRandomStream("materials", ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.sceneStyle)
    .pick(FAMILIES);
  const brickStream = descriptor.createRandomStream("materials", ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.masonryBrick);
  const mortarStream = descriptor.createRandomStream("materials", ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.masonryMortar);
  const stoneJointsStream = descriptor.createRandomStream("materials", ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.stoneJoints);
  const quietFacadeStream = descriptor.createRandomStream("materials", ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.quietFacade);

  return Object.freeze({
    familyId: family.id,
    brick: Object.freeze({
      palette: family.brickPalette,
      mortarColor: Object.freeze(family.mortarColor.map((channel) =>
        Math.max(0, Math.min(255, channel + mortarStream.nextInt(-2, 2))),
      )) as ArchitectureRiseRgb,
      realizationSeed: brickStream.nextUint32(),
      mortarSeed: mortarStream.nextUint32(),
      roughness: 0.91 + brickStream.nextRange(-0.01, 0.01),
      normalStrength: 0.11 + brickStream.nextRange(-0.008, 0.008),
    }),
    mortarJointColor: boundedColor(family.mortarJointColor, stoneJointsStream),
    quietFacadeColor: boundedColor(family.quietFacadeColor, quietFacadeStream),
    base: resolveSurface(ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.stoneBase, family.base, descriptor),
    door: resolveSurface(ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.doorWood, family.door, descriptor),
    roof: resolveSurface(ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.roofSurface, family.roof, descriptor),
    trim: resolveSurface(ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.windowTrim, family.trim, descriptor),
    sidewalk: resolveSurface(ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.sidewalk, family.sidewalk, descriptor),
    pavementColor: boundedColor(
      family.pavementColor,
      descriptor.createRandomStream("materials", ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.pavement),
    ),
    groundColor: boundedColor(
      family.groundColor,
      descriptor.createRandomStream("materials", ARCHITECTURE_RISE_MATERIAL_ROLE_IDS.groundPlane),
    ),
  });
};
