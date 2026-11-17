import type { Bounds3, Vec3 } from "../types/optics";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import {
  stillLifeStudioBackdrop,
  stillLifeStudioDepthRegions,
  stillLifeStudioFocusReferences,
  stillLifeStudioFocusTileHalfSizeMm,
  stillLifeStudioSceneBounds,
  stillLifeStudioTable,
} from "./stillLifeStudioGeometry";
import {
  areBounds3Finite,
  findPairwiseIntersections,
  hasPositiveFiniteBoxDimensionsMm,
  intersectsProtectedRegionXZ,
  isSupportedAtHeightMm,
  isWithinBounds3,
  isWithinBoundsXZ,
} from "./variation/placementConstraints";
import {
  getBoundsXZMm,
  getSupportSurfaceBoundsXZMm,
  getYawRotatedBoxBoundsMm,
  type BoxDimensionsMm,
  type SupportSurfaceMm,
} from "./variation/placementGeometry";

export const STILL_LIFE_STUDIO_VARIATION_SCHEMA_VERSION = 1 as const;

export type StillLifeCompositionId =
  | "vertical-emphasis"
  | "horizontal-grouping"
  | "layered-depth"
  | "asymmetric-still-life";

export type StillLifeObjectFamily = "vessel" | "books" | "wooden-form" | "bowl";
export type StillLifeObjectVariant =
  | "round-shoulder"
  | "narrow-neck"
  | "wide-low"
  | "deep-bowl"
  | "two-book-stack"
  | "three-book-stack"
  | "rounded-block"
  | "stepped-block";
export type StillLifePalette = "clay" | "sage" | "ochre" | "slate" | "linen" | "charcoal";

export type StillLifeObjectPlacement = Readonly<{
  id: string;
  family: StillLifeObjectFamily;
  variant: StillLifeObjectVariant;
  dimensionsMm: BoxDimensionsMm;
  /** Object centre in canonical world millimetres. */
  positionMm: Vec3;
  rotationYDeg: number;
  supportId: "studio-table";
  palette: StillLifePalette;
  surfaceVariationSeed: number;
}>;

export type StillLifeStudioPlan = Readonly<{
  schemaVersion: typeof STILL_LIFE_STUDIO_VARIATION_SCHEMA_VERSION;
  compositionId: StillLifeCompositionId;
  objects: readonly StillLifeObjectPlacement[];
  fallbackUsed: boolean;
  fallbackIssues: readonly string[];
}>;

type StillLifeRole = "low" | "medium" | "tall" | "accent";
type Slot = Readonly<{
  id: string;
  role: StillLifeRole;
  families: readonly StillLifeObjectFamily[];
  x: number;
  z: number;
  optional?: boolean;
}>;

const compositionSlots: Readonly<Record<StillLifeCompositionId, readonly Slot[]>> = {
  "vertical-emphasis": [
    { id: "hero", role: "tall", families: ["vessel", "wooden-form"], x: -320, z: 4100 },
    { id: "near-study", role: "low", families: ["bowl", "books"], x: 360, z: 3200 },
    { id: "far-study", role: "low", families: ["books", "wooden-form"], x: 260, z: 5100 },
    { id: "small-accent", role: "accent", families: ["bowl", "books", "wooden-form"], x: 650, z: 4300, optional: true },
  ],
  "horizontal-grouping": [
    { id: "left-form", role: "low", families: ["bowl", "books"], x: -450, z: 3200 },
    { id: "centre-form", role: "low", families: ["books", "bowl"], x: 0, z: 4100 },
    { id: "right-form", role: "low", families: ["wooden-form", "books", "bowl"], x: 450, z: 5100 },
    { id: "small-accent", role: "accent", families: ["bowl", "books", "wooden-form"], x: 700, z: 4400, optional: true },
  ],
  "layered-depth": [
    { id: "near-form", role: "low", families: ["bowl", "wooden-form"], x: -350, z: 3200 },
    { id: "middle-form", role: "tall", families: ["vessel", "wooden-form"], x: 250, z: 4100 },
    { id: "far-form", role: "medium", families: ["books", "bowl", "wooden-form"], x: -250, z: 5100 },
  ],
  "asymmetric-still-life": [
    { id: "near-counterweight", role: "low", families: ["bowl", "books"], x: -420, z: 3200 },
    { id: "hero", role: "tall", families: ["vessel", "wooden-form"], x: 380, z: 4100 },
    { id: "far-counterweight", role: "low", families: ["books", "bowl", "wooden-form"], x: -260, z: 5100 },
    { id: "small-accent", role: "accent", families: ["books", "wooden-form"], x: -700, z: 4300, optional: true },
  ],
};

const palettes: readonly StillLifePalette[] = [
  "clay",
  "sage",
  "ochre",
  "slate",
  "linen",
  "charcoal",
];

const studioTableSupport: SupportSurfaceMm = {
  center: { x: 0, y: stillLifeStudioTable.topYmm, z: stillLifeStudioTable.centerMm.z },
  size: {
    x: stillLifeStudioTable.sizeMm.width,
    y: stillLifeStudioTable.sizeMm.height,
    z: stillLifeStudioTable.sizeMm.depth,
  },
  topY: stillLifeStudioTable.topYmm,
};

const focusProtectedRegions = stillLifeStudioFocusReferences.map((reference) => ({
  minX: reference.x - stillLifeStudioFocusTileHalfSizeMm - 26,
  maxX: reference.x + stillLifeStudioFocusTileHalfSizeMm + 26,
  minZ: reference.z - stillLifeStudioFocusTileHalfSizeMm - 26,
  maxZ: reference.z + stillLifeStudioFocusTileHalfSizeMm + 26,
}));

const roundTo10 = (value: number): number => Math.round(value / 10) * 10;

const variantForFamily = (
  family: StillLifeObjectFamily,
  stream: ReturnType<SceneVariationDescriptor["createRandomStream"]>,
): StillLifeObjectVariant => {
  switch (family) {
    case "vessel":
      return stream.pick(["round-shoulder", "narrow-neck"] as const);
    case "bowl":
      return stream.pick(["wide-low", "deep-bowl"] as const);
    case "books":
      return stream.pick(["two-book-stack", "three-book-stack"] as const);
    case "wooden-form":
      return stream.pick(["rounded-block", "stepped-block"] as const);
  }
};

const dimensionsFor = (
  family: StillLifeObjectFamily,
  variant: StillLifeObjectVariant,
  role: StillLifeRole,
  stream: ReturnType<SceneVariationDescriptor["createRandomStream"]>,
): BoxDimensionsMm => {
  const between = (min: number, max: number) => roundTo10(stream.nextRange(min, max));
  if (role === "accent") {
    const height = between(180, 280);
    return {
      width: between(230, 300),
      height,
      depth: between(230, 300),
    };
  }

  if (family === "vessel") {
    const width = between(360, 440);
    return {
      width,
      height: role === "tall" ? between(620, 760) : between(500, 600),
      depth: width,
    };
  }

  if (family === "bowl") {
    const width = between(470, 560);
    return {
      width,
      height: role === "medium" || variant === "deep-bowl"
        ? between(230, 320)
        : between(180, 250),
      depth: width,
    };
  }

  if (family === "books") {
    const stackCount = variant === "three-book-stack" ? 3 : 2;
    return {
      width: between(470, 560),
      height: stackCount === 3 ? between(280, 350) : between(220, 300),
      depth: between(340, 420),
    };
  }

  return {
    width: between(380, 500),
    height: role === "tall" ? between(500, 640) : role === "medium" ? between(340, 460) : between(220, 320),
    depth: between(380, 500),
  };
};

const createPlacement = (
  descriptor: SceneVariationDescriptor,
  slot: Slot,
): StillLifeObjectPlacement => {
  const familyStream = descriptor.createRandomStream("props", `${slot.id}:family`);
  const family = familyStream.pick(slot.families);
  const variant = variantForFamily(
    family,
    descriptor.createRandomStream("props", `${slot.id}:form`),
  );
  const dimensionsMm = dimensionsFor(
    family,
    variant,
    slot.role,
    descriptor.createRandomStream("props", `${slot.id}:dimensions`),
  );
  const layout = descriptor.createRandomStream("layout", slot.id);
  const material = descriptor.createRandomStream("materials", slot.id);

  return Object.freeze({
    id: slot.id,
    family,
    variant,
    dimensionsMm: Object.freeze(dimensionsMm),
    positionMm: Object.freeze({
      x: roundTo10(slot.x + layout.nextRange(-36, 36)),
      y: stillLifeStudioTable.topYmm + dimensionsMm.height / 2,
      z: roundTo10(slot.z + layout.nextRange(-42, 42)),
    }),
    rotationYDeg: roundTo10(layout.nextRange(-12, 12)),
    supportId: "studio-table",
    palette: material.pick(palettes),
    surfaceVariationSeed: material.nextUint32(),
  });
};

export const getStillLifeObjectBoundsMm = (
  placement: StillLifeObjectPlacement,
): Bounds3 => getYawRotatedBoxBoundsMm(
  placement.positionMm,
  placement.dimensionsMm,
  placement.rotationYDeg,
);

const isInDepthRegion = (zMm: number): boolean =>
  stillLifeStudioDepthRegions.some((region) => zMm >= region.minZmm && zMm <= region.maxZmm);

/** Scene-specific constraints composed from the shared placement primitives. */
export const validateStillLifeStudioPlan = (
  plan: Pick<StillLifeStudioPlan, "compositionId" | "objects">,
): string[] => {
  const issues: string[] = [];
  if (plan.objects.length < 3 || plan.objects.length > 4) issues.push("object-count-out-of-range");

  const boundsById = new Map<string, Bounds3>();
  for (const placement of plan.objects) {
    const bounds = getStillLifeObjectBoundsMm(placement);
    boundsById.set(placement.id, bounds);
    if (!hasPositiveFiniteBoxDimensionsMm(placement.dimensionsMm)) issues.push(`${placement.id}:invalid-dimensions`);
    if (!areBounds3Finite(bounds)) issues.push(`${placement.id}:non-finite-bounds`);
    if (!isWithinBoundsXZ(getBoundsXZMm(bounds), getSupportSurfaceBoundsXZMm(studioTableSupport))) {
      issues.push(`${placement.id}:outside-table`);
    }
    if (!isSupportedAtHeightMm(bounds.min.y, studioTableSupport.topY, 1e-6)) {
      issues.push(`${placement.id}:unsupported`);
    }
    if (bounds.min.y < studioTableSupport.topY - 1e-6) {
      issues.push(`${placement.id}:penetrates-table`);
    }
    if (!isWithinBounds3(bounds, stillLifeStudioSceneBounds)) issues.push(`${placement.id}:outside-scene`);
    if (bounds.max.z >= stillLifeStudioBackdrop.nearSurfaceZmm - 250) {
      issues.push(`${placement.id}:backdrop-clearance`);
    }
    if (!isInDepthRegion(placement.positionMm.z)) issues.push(`${placement.id}:outside-depth-regions`);
    if (placement.supportId !== "studio-table") issues.push(`${placement.id}:unknown-support`);
    if (!Number.isInteger(placement.surfaceVariationSeed) || placement.surfaceVariationSeed < 0 || placement.surfaceVariationSeed > 0xffff_ffff) {
      issues.push(`${placement.id}:invalid-material-seed`);
    }
    focusProtectedRegions.forEach((region, index) => {
      if (intersectsProtectedRegionXZ(getBoundsXZMm(bounds), region)) {
        issues.push(`${placement.id}:focus-reference-${index + 1}-occluded`);
      }
    });
  }

  const collisions = findPairwiseIntersections(plan.objects, (placement) => boundsById.get(placement.id)!);
  collisions.forEach(({ left, right }) => issues.push(`${left.id}:intersects:${right.id}`));
  return issues;
};

const createCandidatePlan = (descriptor: SceneVariationDescriptor): StillLifeStudioPlan => {
  const compositionId = descriptor
    .createRandomStream("layout", "composition-strategy")
    .pick([
      "vertical-emphasis",
      "horizontal-grouping",
      "layered-depth",
      "asymmetric-still-life",
    ] as const);
  const objects = compositionSlots[compositionId]
    .filter((slot) => {
      if (!slot.optional) return true;
      return descriptor.createRandomStream("props", `${slot.id}:presence`).nextInt(0, 1) === 1;
    })
    .map((slot) => createPlacement(descriptor, slot));

  return Object.freeze({
    schemaVersion: STILL_LIFE_STUDIO_VARIATION_SCHEMA_VERSION,
    compositionId,
    objects: Object.freeze(objects),
    fallbackUsed: false,
    fallbackIssues: Object.freeze([]),
  });
};

export const createStillLifeStudioFallbackPlan = (): StillLifeStudioPlan =>
  Object.freeze({
    schemaVersion: STILL_LIFE_STUDIO_VARIATION_SCHEMA_VERSION,
    compositionId: "vertical-emphasis",
    objects: Object.freeze([
      Object.freeze({
        id: "hero",
        family: "vessel",
        variant: "round-shoulder",
        dimensionsMm: Object.freeze({ width: 420, height: 680, depth: 420 }),
        positionMm: Object.freeze({ x: -320, y: 340, z: 4100 }),
        rotationYDeg: 0,
        supportId: "studio-table",
        palette: "clay",
        surfaceVariationSeed: 1460271361,
      }),
      Object.freeze({
        id: "near-study",
        family: "bowl",
        variant: "wide-low",
        dimensionsMm: Object.freeze({ width: 500, height: 220, depth: 500 }),
        positionMm: Object.freeze({ x: 360, y: 110, z: 3200 }),
        rotationYDeg: 0,
        supportId: "studio-table",
        palette: "sage",
        surfaceVariationSeed: 3356496473,
      }),
      Object.freeze({
        id: "far-study",
        family: "books",
        variant: "two-book-stack",
        dimensionsMm: Object.freeze({ width: 510, height: 260, depth: 380 }),
        positionMm: Object.freeze({ x: 260, y: 130, z: 5100 }),
        rotationYDeg: 0,
        supportId: "studio-table",
        palette: "ochre",
        surfaceVariationSeed: 2585573477,
      }),
    ]),
    fallbackUsed: true,
    fallbackIssues: Object.freeze([]),
  });

/** Resolve one deterministic schema-v1 still-life composition. */
export const resolveStillLifeStudioPlan = (
  descriptor?: SceneVariationDescriptor,
): StillLifeStudioPlan => {
  const candidate = descriptor
    ? createCandidatePlan(descriptor)
    : createStillLifeStudioFallbackPlan();
  const issues = validateStillLifeStudioPlan(candidate);
  if (issues.length === 0) return candidate;

  const fallback = createStillLifeStudioFallbackPlan();
  const fallbackIssues = validateStillLifeStudioPlan(fallback);
  if (fallbackIssues.length > 0) {
    throw new Error(`Still-Life Studio fallback is invalid: ${fallbackIssues.join(", ")}`);
  }
  return Object.freeze({ ...fallback, fallbackUsed: true, fallbackIssues: Object.freeze(issues) });
};

