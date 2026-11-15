import type { Vec3 } from "../types/optics";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import { SCENE_VARIATION_SCHEMA_V2 } from "./sceneVariation";
import { furnitureSupportSurfacesMm, room, wallDetails } from "./interiorCornerGeometry";

export type InteriorCornerVaseProfile = "bottle" | "round" | "flared";
export type InteriorCornerPropPalette =
  | "clay"
  | "sage"
  | "ochre"
  | "slate"
  | "linen"
  | "charcoal"
  | "ivory";
export type InteriorCornerRugPattern = "plain" | "bordered" | "striped";

export type InteriorCornerPropPlacement =
  | Readonly<{
      kind: "vase";
      id: "console-vase";
      positionMm: Vec3;
      profile: InteriorCornerVaseProfile;
      heightMm: number;
      baseRadiusMm: number;
      topRadiusMm: number;
      palette: InteriorCornerPropPalette;
    }>
  | Readonly<{
      kind: "book";
      id: `console-book-${number}`;
      positionMm: Vec3;
      dimensionsMm: Readonly<{ width: number; height: number; depth: number }>;
      rotationYDeg: number;
      palette: InteriorCornerPropPalette;
    }>
  | Readonly<{
      kind: "sculpture";
      id: "console-sculpture";
      positionMm: Vec3;
      dimensionsMm: Readonly<{ width: number; height: number; depth: number }>;
      shape: "orb" | "faceted";
      palette: InteriorCornerPropPalette;
    }>
  | Readonly<{
      kind: "cushion";
      id: "bench-cushion-single" | "bench-cushion-left" | "bench-cushion-right";
      positionMm: Vec3;
      dimensionsMm: Readonly<{ width: number; height: number; depth: number }>;
      rotationYDeg: number;
      palette: InteriorCornerPropPalette;
    }>
  | Readonly<{
      kind: "rug";
      id: "room-rug";
      positionMm: Vec3;
      dimensionsMm: Readonly<{ width: number; height: number; depth: number }>;
      rotationYDeg: number;
      pattern: InteriorCornerRugPattern;
      palette: InteriorCornerPropPalette;
    }>;

export type InteriorCornerPropVariationPlan = Readonly<{
  schemaVersion: typeof SCENE_VARIATION_SCHEMA_V2;
  arrangementId: string;
  props: readonly InteriorCornerPropPlacement[];
}>;

const vaseProfiles: readonly Readonly<{
  id: InteriorCornerVaseProfile;
  heightMm: number;
  baseRadiusMm: number;
  topRadiusMm: number;
}>[] = [
  { id: "bottle", heightMm: 330, baseRadiusMm: 86, topRadiusMm: 48 },
  { id: "round", heightMm: 260, baseRadiusMm: 112, topRadiusMm: 94 },
  { id: "flared", heightMm: 300, baseRadiusMm: 82, topRadiusMm: 116 },
];

const vasePalettes: readonly InteriorCornerPropPalette[] = ["clay", "sage", "ivory"];
const bookPalettes: readonly InteriorCornerPropPalette[] = ["linen", "ochre", "slate", "sage"];
const sculpturePalettes: readonly InteriorCornerPropPalette[] = ["ivory", "clay", "slate"];
const cushionPalettes: readonly InteriorCornerPropPalette[] = ["clay", "ochre", "sage", "slate"];
const rugPalettes: readonly InteriorCornerPropPalette[] = ["linen", "charcoal", "ochre"];

const createBooks = (
  descriptor: SceneVariationDescriptor,
  centerX: number,
): InteriorCornerPropPlacement[] => {
  const consoleTop = furnitureSupportSurfacesMm.consoleTop;
  const count = descriptor.createRandomStream("props", "console-book-stack-count").nextInt(2, 3);
  let stackHeightMm = 0;
  const books: InteriorCornerPropPlacement[] = [];

  for (let index = 0; index < count; index += 1) {
    const id = `console-book-${index + 1}` as const;
    const stream = descriptor.createRandomStream("props", id);
    const dimensionsMm = Object.freeze({
      width: stream.nextInt(280, 350),
      height: stream.nextInt(26, 38),
      depth: stream.nextInt(190, 240),
    });
    books.push(Object.freeze({
      kind: "book",
      id,
      positionMm: Object.freeze({
        x: centerX,
        y: consoleTop.topY + stackHeightMm + dimensionsMm.height / 2,
        z: consoleTop.center.z,
      }),
      dimensionsMm,
      rotationYDeg: stream.nextInt(-2, 2),
      palette: bookPalettes[stream.nextInt(0, bookPalettes.length - 1)]!,
    }));
    stackHeightMm += dimensionsMm.height;
  }
  return books;
};

const createVase = (
  descriptor: SceneVariationDescriptor,
  x: number,
): InteriorCornerPropPlacement => {
  const consoleTop = furnitureSupportSurfacesMm.consoleTop;
  const profileStream = descriptor.createRandomStream("props", "console-vase-profile");
  const profile = vaseProfiles[profileStream.nextInt(0, vaseProfiles.length - 1)]!;
  const paletteStream = descriptor.createRandomStream("props", "console-vase-palette");
  return Object.freeze({
    kind: "vase",
    id: "console-vase",
    positionMm: Object.freeze({
      x,
      y: consoleTop.topY + profile.heightMm / 2,
      z: consoleTop.center.z,
    }),
    profile: profile.id,
    heightMm: profile.heightMm,
    baseRadiusMm: profile.baseRadiusMm,
    topRadiusMm: profile.topRadiusMm,
    palette: vasePalettes[paletteStream.nextInt(0, vasePalettes.length - 1)]!,
  });
};

const createSculpture = (descriptor: SceneVariationDescriptor, x: number): InteriorCornerPropPlacement => {
  const consoleTop = furnitureSupportSurfacesMm.consoleTop;
  const stream = descriptor.createRandomStream("props", "console-sculpture");
  const heightMm = stream.nextInt(140, 185);
  const widthMm = stream.nextInt(135, 180);
  const depthMm = stream.nextInt(125, 170);
  return Object.freeze({
    kind: "sculpture",
    id: "console-sculpture",
    positionMm: Object.freeze({
      x,
      y: consoleTop.topY + heightMm / 2,
      z: consoleTop.center.z,
    }),
    dimensionsMm: Object.freeze({ width: widthMm, height: heightMm, depth: depthMm }),
    shape: stream.nextInt(0, 1) === 0 ? "orb" : "faceted",
    palette: sculpturePalettes[stream.nextInt(0, sculpturePalettes.length - 1)]!,
  });
};

const createCushions = (descriptor: SceneVariationDescriptor): InteriorCornerPropPlacement[] => {
  const bench = furnitureSupportSurfacesMm.benchSeat;
  const count = descriptor.createRandomStream("props", "bench-cushion-count").nextInt(1, 2);
  const paletteStream = descriptor.createRandomStream("props", "bench-cushion-palette");
  const paletteStart = paletteStream.nextInt(0, cushionPalettes.length - 1);
  const rowStream = descriptor.createRandomStream("layout", "bench-cushion-row");
  const centerZ = [6445, 6460, 6475][rowStream.nextInt(0, 2)]!;

  if (count === 1) {
    const stream = descriptor.createRandomStream("props", "bench-cushion-single");
    const dimensionsMm = stream.nextInt(0, 1) === 0
      ? Object.freeze({ width: 580, height: 145, depth: 330 })
      : Object.freeze({ width: 470, height: 155, depth: 390 });
    const xOffset = descriptor.createRandomStream("layout", "bench-cushion-single-position").nextInt(-120, 120);
    return [Object.freeze({
      kind: "cushion",
      id: "bench-cushion-single",
      positionMm: Object.freeze({
        x: bench.center.x + xOffset,
        y: bench.topY + dimensionsMm.height / 2,
        z: centerZ,
      }),
      dimensionsMm,
      rotationYDeg: stream.nextInt(-5, 5),
      palette: cushionPalettes[paletteStart]!,
    })];
  }

  return (["left", "right"] as const).map((side, index) => {
    const id = `bench-cushion-${side}` as const;
    const stream = descriptor.createRandomStream("props", id);
    const layoutStream = descriptor.createRandomStream("layout", id);
    const dimensionsMm = Object.freeze({ width: 420, height: 135, depth: 350 });
    const xDirection = index === 0 ? -1 : 1;
    const palette = cushionPalettes[(paletteStart + index) % cushionPalettes.length]!;
    return Object.freeze({
      kind: "cushion",
      id,
      positionMm: Object.freeze({
        x: bench.center.x + xDirection * (420 + layoutStream.nextInt(-20, 20)),
        y: bench.topY + dimensionsMm.height / 2,
        z: centerZ + layoutStream.nextInt(-12, 12),
      }),
      dimensionsMm,
      rotationYDeg: stream.nextInt(-4, 4),
      palette,
    });
  });
};

const createRug = (descriptor: SceneVariationDescriptor): InteriorCornerPropPlacement => {
  const rug = furnitureSupportSurfacesMm.rug;
  const patternStream = descriptor.createRandomStream("props", "rug-pattern");
  const pattern: InteriorCornerRugPattern[] = ["plain", "bordered", "striped"];
  const layoutStream = descriptor.createRandomStream("layout", "rug-arrangement");
  const rotationYDeg = [-1.5, -0.5, 0.5, 1.5][layoutStream.nextInt(0, 3)]!;
  const positionX = rug.center.x + layoutStream.nextInt(-80, 80);
  const positionZ = rug.center.z + layoutStream.nextInt(-90, 90);
  const paletteStream = descriptor.createRandomStream("props", "rug-palette");
  return Object.freeze({
    kind: "rug",
    id: "room-rug",
    positionMm: Object.freeze({ x: positionX, y: rug.center.y, z: positionZ }),
    dimensionsMm: Object.freeze({
      width: rug.size.x,
      height: rug.size.y,
      depth: rug.size.z,
    }),
    rotationYDeg,
    pattern: pattern[patternStream.nextInt(0, pattern.length - 1)]!,
    palette: rugPalettes[paletteStream.nextInt(0, rugPalettes.length - 1)]!,
  });
};

/** Resolve one pure, millimetre-based plan for the shared Observer and RTT subject factory. */
export const resolveInteriorCornerPropVariationPlan = (
  descriptor: SceneVariationDescriptor | undefined,
): InteriorCornerPropVariationPlan | null => {
  if (!descriptor || descriptor.identity.schemaVersion !== SCENE_VARIATION_SCHEMA_V2) return null;
  if (descriptor.identity.sceneId !== "interior-corner") {
    throw new RangeError("Interior Corner prop variation requires the canonical Interior Corner identity");
  }

  const arrangement = descriptor.createRandomStream("props", "console-arrangement").nextInt(0, 3);
  const pairVaseSide = descriptor.createRandomStream("layout", "console-pair-vase-side").nextInt(0, 1);
  const trioDirection = descriptor.createRandomStream("layout", "console-trio-direction").nextInt(0, 1);
  const leftX = furnitureSupportSurfacesMm.consoleTop.center.x - 520;
  const rightX = furnitureSupportSurfacesMm.consoleTop.center.x + 520;
  const centerX = furnitureSupportSurfacesMm.consoleTop.center.x;
  const vaseX = arrangement === 0
    ? centerX
    : arrangement === 3
      ? trioDirection === 0 ? leftX : rightX
      : pairVaseSide === 0 ? leftX : rightX;
  const props: InteriorCornerPropPlacement[] = [createVase(descriptor, vaseX)];

  if (arrangement === 1) {
    props.push(...createBooks(descriptor, vaseX === leftX ? rightX : leftX));
  } else if (arrangement === 2) {
    props.push(createSculpture(descriptor, vaseX === leftX ? rightX : leftX));
  } else if (arrangement === 3) {
    props.push(...createBooks(descriptor, centerX));
    props.push(createSculpture(descriptor, trioDirection === 0 ? rightX : leftX));
  }

  const cushions = createCushions(descriptor);
  props.push(...cushions, createRug(descriptor));
  const cushionCount = cushions.length === 1 ? "one-cushion" : "two-cushions";
  const rug = props[props.length - 1];
  if (rug?.kind !== "rug") throw new Error("Interior Corner prop plan must include its rug descriptor");
  const vase = props.find((prop) => prop.kind === "vase");
  const bookCount = props.filter((prop) => prop.kind === "book").length;
  const sculpture = props.find((prop) => prop.kind === "sculpture");
  const arrangementId = [
    `console-${arrangement}-${vase?.kind === "vase" ? `${vase.profile}-${vase.palette}` : "no-vase"}`,
    `${bookCount}-books`,
    sculpture?.kind === "sculpture" ? `sculpture-${sculpture.shape}` : "no-sculpture",
    `${cushionCount}-${cushions.map((cushion) => cushion.palette).join("-")}`,
    `rug-${rug.pattern}-${rug.palette}`,
  ].join("_");

  const proposedPlan = Object.freeze({
    schemaVersion: SCENE_VARIATION_SCHEMA_V2,
    arrangementId,
    props: Object.freeze(props),
  });
  const draftIssues = getInteriorCornerPropVariationPlanSafetyIssues(proposedPlan);
  if (draftIssues.length === 0) {
    return proposedPlan;
  }

  const safeVase: InteriorCornerPropPlacement = Object.freeze({
    kind: "vase",
    id: "console-vase",
    positionMm: Object.freeze({
      x: centerX,
      y: furnitureSupportSurfacesMm.consoleTop.topY + 130,
      z: furnitureSupportSurfacesMm.consoleTop.center.z,
    }),
    profile: "round",
    heightMm: 260,
    baseRadiusMm: 110,
    topRadiusMm: 90,
    palette: "sage",
  });
  const safeCushion: InteriorCornerPropPlacement = Object.freeze({
    kind: "cushion",
    id: "bench-cushion-single",
    positionMm: Object.freeze({
      x: furnitureSupportSurfacesMm.benchSeat.center.x,
      y: furnitureSupportSurfacesMm.benchSeat.topY + 70,
      z: 6435,
    }),
    dimensionsMm: Object.freeze({ width: 580, height: 140, depth: 330 }),
    rotationYDeg: 0,
    palette: "slate",
  });
  const safeRug: InteriorCornerPropPlacement = Object.freeze({
    kind: "rug",
    id: "room-rug",
    positionMm: Object.freeze({ ...furnitureSupportSurfacesMm.rug.center }),
    dimensionsMm: Object.freeze({
      width: furnitureSupportSurfacesMm.rug.size.x,
      height: furnitureSupportSurfacesMm.rug.size.y,
      depth: furnitureSupportSurfacesMm.rug.size.z,
    }),
    rotationYDeg: 0,
    pattern: "plain",
    palette: "linen",
  });
  const fallbackPlan: InteriorCornerPropVariationPlan = Object.freeze({
    schemaVersion: SCENE_VARIATION_SCHEMA_V2,
    arrangementId: "safe-console_one-cushion_rug-plain-linen",
    props: Object.freeze([safeVase, safeCushion, safeRug]),
  });
  if (getInteriorCornerPropVariationPlanSafetyIssues(fallbackPlan).length > 0) {
    throw new Error("Interior Corner v2 safe prop fallback violated its support constraints");
  }
  return fallbackPlan;
};

const footprint = (prop: InteriorCornerPropPlacement) => {
  const dimensions = prop.kind === "vase"
    ? {
        width: Math.max(prop.baseRadiusMm, prop.topRadiusMm) * 2,
        depth: Math.max(prop.baseRadiusMm, prop.topRadiusMm) * 2,
        height: prop.heightMm,
      }
    : { width: prop.dimensionsMm.width, depth: prop.dimensionsMm.depth, height: prop.dimensionsMm.height };
  const angle = (prop.kind === "vase" || prop.kind === "sculpture")
    ? 0
    : (prop.rotationYDeg * Math.PI) / 180;
  const halfWidth = Math.abs(Math.cos(angle)) * dimensions.width / 2 +
    Math.abs(Math.sin(angle)) * dimensions.depth / 2;
  const halfDepth = Math.abs(Math.sin(angle)) * dimensions.width / 2 +
    Math.abs(Math.cos(angle)) * dimensions.depth / 2;
  const halfHeight = dimensions.height / 2;
  return {
    minX: prop.positionMm.x - halfWidth,
    maxX: prop.positionMm.x + halfWidth,
    minY: prop.positionMm.y - halfHeight,
    maxY: prop.positionMm.y + halfHeight,
    minZ: prop.positionMm.z - halfDepth,
    maxZ: prop.positionMm.z + halfDepth,
  };
};

/** Domain-specific constraint audit used by tests and deterministic safe fallback selection. */
export const getInteriorCornerPropVariationPlanSafetyIssues = (
  plan: InteriorCornerPropVariationPlan,
): readonly string[] => {
  const issues: string[] = [];
  const roomXMin = -room.width / 2;
  const roomXMax = room.sideWallX;
  const console = furnitureSupportSurfacesMm.consoleTop;
  const bench = furnitureSupportSurfacesMm.benchSeat;
  const rug = furnitureSupportSurfacesMm.rug;
  const consoleItems = plan.props.filter((prop) =>
    prop.kind === "vase" || prop.kind === "book" || prop.kind === "sculpture",
  );
  const supportBounds = (centerX: number, centerZ: number, width: number, depth: number) => ({
    minX: centerX - width / 2,
    maxX: centerX + width / 2,
    minZ: centerZ - depth / 2,
    maxZ: centerZ + depth / 2,
  });
  const within = (child: ReturnType<typeof footprint>, bounds: ReturnType<typeof supportBounds>) =>
    child.minX >= bounds.minX && child.maxX <= bounds.maxX &&
    child.minZ >= bounds.minZ && child.maxZ <= bounds.maxZ;

  plan.props.forEach((prop) => {
    const bounds = footprint(prop);
    const dimensions = prop.kind === "vase"
      ? [prop.heightMm, prop.baseRadiusMm, prop.topRadiusMm]
      : [prop.dimensionsMm.width, prop.dimensionsMm.height, prop.dimensionsMm.depth];
    if (!dimensions.every((value) => Number.isFinite(value) && value > 0)) {
      issues.push(`${prop.id}: dimensions must be positive and finite`);
    }
    if (![bounds.minX, bounds.maxX, bounds.minY, bounds.maxY, bounds.minZ, bounds.maxZ]
      .every(Number.isFinite)) issues.push(`${prop.id}: non-finite bounds`);
    if (bounds.minX < roomXMin || bounds.maxX > roomXMax ||
      bounds.minY < room.floorY || bounds.maxY > room.ceilingY ||
      bounds.minZ < room.nearZ || bounds.maxZ > room.farZ) {
      issues.push(`${prop.id}: outside room bounds`);
    }
    if (prop.kind === "vase" || prop.kind === "book" || prop.kind === "sculpture") {
      if (!within(bounds, supportBounds(console.center.x, console.center.z, console.size.x, console.size.z))) {
        issues.push(`${prop.id}: outside console top footprint`);
      }
      if (prop.kind !== "book" && Math.abs(bounds.minY - console.topY) > 1e-6) {
        issues.push(`${prop.id}: not supported by console top`);
      }
    }
    if (prop.kind === "cushion") {
      if (!within(bounds, supportBounds(bench.center.x, bench.center.z, bench.size.x, bench.size.z))) {
        issues.push(`${prop.id}: outside bench seat footprint`);
      }
      if (Math.abs(bounds.minY - bench.topY) > 1e-6) {
        issues.push(`${prop.id}: not supported by bench seat`);
      }
      if (bounds.maxZ > 6690) {
        issues.push(`${prop.id}: intersects the fixed bench back`);
      }
    }
    if (prop.kind === "rug") {
      if (Math.abs(bounds.minY - room.floorY) > 1e-6 ||
        Math.abs(prop.positionMm.x - rug.center.x) > 80 ||
        Math.abs(prop.positionMm.z - rug.center.z) > 90 ||
        Math.abs(prop.rotationYDeg) > 1.5) {
        issues.push(`${prop.id}: rug exceeds its canonical floor footprint`);
      }
    }
    const focusTargetX = room.interiorSideSurfaceX - 18;
    if (bounds.maxX >= focusTargetX - 250 &&
      wallDetails.some((detail) => bounds.maxZ >= detail.z - detail.width / 2 && bounds.minZ <= detail.z + detail.width / 2)) {
      issues.push(`${prop.id}: overlaps a protected focus-target region`);
    }
  });

  const books = consoleItems.filter((prop) => prop.kind === "book").sort(
    (left, right) => footprint(left).minY - footprint(right).minY,
  );
  if (books.length > 0 && Math.abs(footprint(books[0]!).minY - console.topY) > 1e-6) {
    issues.push("console book stack is not supported by the console top");
  }
  for (let index = 1; index < books.length; index += 1) {
    if (Math.abs(footprint(books[index]!).minY - footprint(books[index - 1]!).maxY) > 1e-6) {
      issues.push(`${books[index]!.id}: not supported by the preceding book`);
    }
  }

  const checkIntersections = (items: readonly InteriorCornerPropPlacement[]) => {
    for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) {
      const left = items[leftIndex]!;
      const leftBounds = footprint(left);
      for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
        const right = items[rightIndex]!;
        const rightBounds = footprint(right);
      const intersects = leftBounds.minX < rightBounds.maxX && leftBounds.maxX > rightBounds.minX &&
        leftBounds.minY < rightBounds.maxY && leftBounds.maxY > rightBounds.minY &&
        leftBounds.minZ < rightBounds.maxZ && leftBounds.maxZ > rightBounds.minZ;
        if (intersects) issues.push(`${left.id} intersects ${right.id}`);
      }
    }
  };
  checkIntersections(consoleItems);
  checkIntersections(plan.props.filter((prop) => prop.kind === "cushion"));

  return Object.freeze(issues);
};

/** Stable normalized summary used by E2E diagnostics without exposing renderer internals. */
export const serializeInteriorCornerPropVariationPlan = (
  plan: InteriorCornerPropVariationPlan,
): string => JSON.stringify(plan);

