import type { Bounds3 } from "../types/optics";
import type { SceneVariationDescriptor } from "../types/sceneVariation";
import {
  detailGeometry,
  observerCamera,
  sceneBounds,
  subjectLocalToWorld,
  subjects,
  type ShelfSwingSubjectDefinition,
  type ShelfSwingVec3,
} from "./shelfSwingGeometry";
import {
  areBounds3Finite,
  findPairwiseIntersections,
  hasPositiveFiniteBoxDimensionsMm,
  intersectsBounds3,
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

export const SHELF_SWING_PROP_VARIATION_SCHEMA_VERSION = 1 as const;
export const SHELF_SWING_PROP_VARIATION_SCHEMA_V2 = 2 as const;

export type ShelfSwingPropFamilyV1 = "box" | "cylinder" | "vessel";
export type ShelfSwingPropFamily = ShelfSwingPropFamilyV1 | "bowl" | "necked-vessel" | "faceted";

type ShelfSwingPropVariationBase = Readonly<{
  id: string;
  dimensionsMm: BoxDimensionsMm;
  positionMm: ShelfSwingVec3;
  rotationYDeg: number;
  palette: Readonly<{ body: string }>;
}>;

export type ShelfSwingPropVariation = ShelfSwingPropVariationBase & Readonly<{
  family: ShelfSwingPropFamily;
}>;

type ShelfSwingPropVariationV1 = ShelfSwingPropVariationBase & Readonly<{
  family: ShelfSwingPropFamilyV1;
}>;

export type ShelfSwingStationVariationV1 = Readonly<{
  stationId: ShelfSwingSubjectDefinition["id"];
  props: readonly ShelfSwingPropVariationV1[];
}>;

export type ShelfSwingStationVariationV2 = Readonly<{
  stationId: ShelfSwingSubjectDefinition["id"];
  composition: "single" | "paired";
  props: readonly ShelfSwingPropVariation[];
}>;

export type ShelfSwingStationVariation = ShelfSwingStationVariationV1 | ShelfSwingStationVariationV2;

export type ShelfSwingPropVariationCandidate = Readonly<{
  schemaVersion: typeof SHELF_SWING_PROP_VARIATION_SCHEMA_VERSION;
  stations: readonly ShelfSwingStationVariationV1[];
}>;

export type ShelfSwingPropVariationPlan = ShelfSwingPropVariationCandidate & Readonly<{
  fallbackUsed: boolean;
  fallbackIssues: readonly string[];
}>;

export type ShelfSwingPropVariationCandidateV2 = Readonly<{
  schemaVersion: typeof SHELF_SWING_PROP_VARIATION_SCHEMA_V2;
  stations: readonly ShelfSwingStationVariationV2[];
}>;

export type ShelfSwingPropVariationPlanV2 = ShelfSwingPropVariationCandidateV2 & Readonly<{
  fallbackUsed: boolean;
  fallbackIssues: readonly string[];
}>;

export type ResolvedShelfSwingPropVariationPlan =
  | ShelfSwingPropVariationPlan
  | ShelfSwingPropVariationPlanV2;

type ShelfSwingPropVariationCandidateForValidation =
  | ShelfSwingPropVariationCandidate
  | ShelfSwingPropVariationCandidateV2;

const LOWER_SHELF_TOP_Y_MM = detailGeometry.shelfThickness;
const LOWER_SHELF_SUPPORT_TOLERANCE_MM = 1e-6;
const FRAME_CLEARANCE_MM = 12;
const DISPLAY_ZONE_XZ = Object.freeze({
  minX: -198,
  maxX: 198,
  minZ: 50,
  maxZ: 220,
});
const CHART_VISIBILITY_PROTECTION_XZ = Object.freeze({
  minX: -detailGeometry.chart.width / 2 - detailGeometry.frameThickness,
  maxX: detailGeometry.chart.width / 2 + detailGeometry.frameThickness,
  minZ: -40,
  maxZ: 40,
});

type PlacementProp = Readonly<{
  id: string;
  dimensionsMm: BoxDimensionsMm;
  positionMm: ShelfSwingVec3;
  rotationYDeg: number;
}>;

type ContextBookFootprint = Readonly<{
  id: string;
  bounds: Bounds3;
}>;

const getLowerShelfSupport = (subject: ShelfSwingSubjectDefinition): SupportSurfaceMm => ({
  center: {
    x: 0,
    y: LOWER_SHELF_TOP_Y_MM,
    z: subject.dimensions.depth / 2,
  },
  size: {
    x: subject.dimensions.width - detailGeometry.frameThickness * 2,
    y: 0,
    z: subject.dimensions.depth,
  },
  topY: LOWER_SHELF_TOP_Y_MM,
});

const getFrameClearanceBounds = (
  subject: ShelfSwingSubjectDefinition,
): readonly Bounds3[] => {
  const { width, height, depth } = subject.dimensions;
  const frameWidth = detailGeometry.frameThickness + FRAME_CLEARANCE_MM * 2;
  const frameX = (width - detailGeometry.frameThickness) / 2;
  return [-frameX, frameX].map((x) => getYawRotatedBoxBoundsMm(
    { x, y: height / 2, z: depth / 2 },
    { width: frameWidth, height, depth },
  ));
};

const getBackdropBounds = (
  subject: ShelfSwingSubjectDefinition,
): Bounds3 => getYawRotatedBoxBoundsMm(
  {
    x: 0,
    y: subject.dimensions.height / 2,
    z: subject.dimensions.depth - 14,
  },
  {
    width: subject.dimensions.width - detailGeometry.frameThickness * 2,
    height: subject.dimensions.height - detailGeometry.shelfThickness * 2,
    depth: 28,
  },
);

const getChartBackingBounds = (
  subject: ShelfSwingSubjectDefinition,
): Bounds3 => getYawRotatedBoxBoundsMm(
  {
    x: subject.focusChart.centerLocal.x,
    y: subject.focusChart.centerLocal.y,
    z: subject.focusChart.centerLocal.z + detailGeometry.chartBackingGap + detailGeometry.backingThickness / 2,
  },
  {
    width: subject.focusChart.width + detailGeometry.frameThickness * 2,
    height: subject.focusChart.height + detailGeometry.frameThickness * 2,
    depth: detailGeometry.backingThickness,
  },
);

/** Focus samples, probe, chart tiles, and comparison motif all lie in this protected volume. */
const getFocusChartProtectedBounds = (
  subject: ShelfSwingSubjectDefinition,
): Bounds3 => getYawRotatedBoxBoundsMm(
  {
    x: subject.focusChart.centerLocal.x,
    y: subject.focusChart.centerLocal.y,
    z: subject.focusChart.centerLocal.z,
  },
  {
    width: subject.focusChart.width,
    height: subject.focusChart.height,
    depth: 80,
  },
);

/**
 * Conservative footprints of the authored context books in ShelfSwingSubjectFactory.
 * Their small Z-axis lean is included by expanding X/Y before using shared bounds math.
 */
const getContextBookFootprints = (
  subject: ShelfSwingSubjectDefinition,
): readonly ContextBookFootprint[] => {
  const geometries = [
    { width: 58, height: 230, depth: 105 },
    { width: 72, height: 190, depth: 112 },
    { width: 48, height: 270, depth: 98 },
  ] as const;
  const rows = [
    { y: detailGeometry.shelfThickness + 115, z: subject.dimensions.depth * 0.68, lean: 0 },
    {
      y: subject.dimensions.height - detailGeometry.shelfThickness - 145,
      z: subject.dimensions.depth * 0.68,
      lean: 0.035,
    },
  ] as const;
  return rows.flatMap((row, rowIndex) =>
    Array.from({ length: 4 }, (_, index) => {
      const geometry = geometries[(index + rowIndex) % geometries.length]!;
      const expandedWidth = geometry.width + geometry.height * row.lean;
      const expandedHeight = geometry.height + geometry.width * row.lean;
      const x = -165 + index * 72;
      return {
        id: `context-book-${rowIndex + 1}-${index + 1}`,
        bounds: getYawRotatedBoxBoundsMm(
          { x, y: row.y, z: row.z },
          {
            width: expandedWidth,
            height: expandedHeight,
            depth: geometry.depth,
          },
        ),
      };
    }),
  );
};

const getLocalPropBounds = (prop: PlacementProp): Bounds3 =>
  getYawRotatedBoxBoundsMm(prop.positionMm, prop.dimensionsMm, prop.rotationYDeg);

const getWorldPropBounds = (
  subject: ShelfSwingSubjectDefinition,
  prop: PlacementProp,
): Bounds3 => getYawRotatedBoxBoundsMm(
  subjectLocalToWorld(subject, prop.positionMm),
  prop.dimensionsMm,
  subject.yawDeg + prop.rotationYDeg,
);

const getWorldStationBounds = (subject: ShelfSwingSubjectDefinition): Bounds3 =>
  getYawRotatedBoxBoundsMm(
    subjectLocalToWorld(subject, subject.bounds.centerLocal),
    {
      width: subject.bounds.size.x,
      height: subject.bounds.size.y,
      depth: subject.bounds.size.z,
    },
    subject.yawDeg,
  );

const observerIsOnChartFrontSide = (subject: ShelfSwingSubjectDefinition): boolean => {
  const yaw = (subject.yawDeg * Math.PI) / 180;
  const localPositiveZWorld = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const cameraOffsetWorld = {
    x: observerCamera.position.x - subject.worldPosition.x,
    z: observerCamera.position.z - subject.worldPosition.z,
  };
  const cameraLocalZ =
    cameraOffsetWorld.x * localPositiveZWorld.x +
    cameraOffsetWorld.z * localPositiveZWorld.z;
  return cameraLocalZ < 0;
};

const stationPositionId = (stationId: string, slot: "left" | "right"): string =>
  `${stationId}-display-${slot}`;

const generateStationProps = (
  descriptor: SceneVariationDescriptor,
  subject: ShelfSwingSubjectDefinition,
): readonly ShelfSwingPropVariationV1[] => {
  const count = descriptor
    .createRandomStream("layout", `${subject.id}/display-count`)
    .nextInt(1, 2);
  const slots: readonly ("left" | "right")[] = count === 1
    ? [descriptor.createRandomStream("layout", `${subject.id}/single-display-side`).pick(["left", "right"] as const)]
    : ["left", "right"];
  return slots.map((slot) => {
    const semanticId = stationPositionId(subject.id, slot);
    const family = descriptor
      .createRandomStream("props", `${semanticId}/family`)
      .pick(["box", "cylinder", "vessel"] as const);
    const dimensionsStream = descriptor.createRandomStream("props", `${semanticId}/dimensions`);
    const dimensionsMm: BoxDimensionsMm = family === "box"
      ? {
          width: dimensionsStream.nextInt(76, 100),
          height: dimensionsStream.nextInt(105, 165),
          depth: dimensionsStream.nextInt(68, 90),
        }
      : family === "cylinder"
        ? (() => {
            const diameter = dimensionsStream.nextInt(78, 100);
            return {
              width: diameter,
              height: dimensionsStream.nextInt(100, 160),
              depth: diameter,
            };
          })()
        : (() => {
            const diameter = dimensionsStream.nextInt(84, 104);
            return {
              width: diameter,
              height: dimensionsStream.nextInt(118, 170),
              depth: diameter,
            };
          })();
    const layoutStream = descriptor.createRandomStream("layout", `${semanticId}/placement`);
    const xRange = slot === "left" ? [-130, -115] : [115, 130];
    const positionMm = {
      x: layoutStream.nextRange(xRange[0]!, xRange[1]!),
      y: LOWER_SHELF_TOP_Y_MM + dimensionsMm.height / 2,
      z: layoutStream.nextRange(110, 155),
    };
    const rotationYDeg = descriptor
      .createRandomStream("layout", `${semanticId}/orientation`)
      .nextInt(-8, 8);
    const colorStream = descriptor.createRandomStream("props", `${semanticId}/palette`);
    const bodyColor = colorStream.pick([
      subject.materialHints.primary,
      subject.materialHints.secondary,
      subject.materialHints.detail,
    ] as const);
    return Object.freeze({
      id: semanticId,
      family,
      dimensionsMm: Object.freeze(dimensionsMm),
      positionMm: Object.freeze(positionMm),
      rotationYDeg,
      palette: Object.freeze({ body: bodyColor }),
    });
  });
};

export const serializeShelfSwingPropVariationPlan = (
  plan: ResolvedShelfSwingPropVariationPlan,
): string => JSON.stringify(plan);

/** Return stable, scene-specific issue IDs for one candidate plan. */
export const getShelfSwingPropVariationSafetyIssues = (
  plan: ShelfSwingPropVariationCandidateForValidation,
): readonly string[] => {
  const issues: string[] = [];
  const allIds = new Set<string>();
  if (
    plan.schemaVersion !== SHELF_SWING_PROP_VARIATION_SCHEMA_VERSION &&
    plan.schemaVersion !== SHELF_SWING_PROP_VARIATION_SCHEMA_V2
  ) {
    issues.push("unsupported-schema");
  }
  if (plan.stations.length !== subjects.length) issues.push("station-count");

  subjects.forEach((subject, subjectIndex) => {
    const station = plan.stations[subjectIndex];
    if (!station || station.stationId !== subject.id) {
      issues.push(`station-order:${subject.id}`);
      return;
    }
    if (plan.schemaVersion === SHELF_SWING_PROP_VARIATION_SCHEMA_V2) {
      if (!("composition" in station)) {
        issues.push(`composition-missing:${subject.id}`);
      } else if (
        (station.composition === "single" && station.props.length !== 1) ||
        (station.composition === "paired" && station.props.length !== 2)
      ) {
        issues.push(`composition-count:${subject.id}`);
      }
    }

    const localStationBounds = getYawRotatedBoxBoundsMm(
      subject.bounds.centerLocal,
      {
        width: subject.bounds.size.x,
        height: subject.bounds.size.y,
        depth: subject.bounds.size.z,
      },
    );
    const worldStationBounds = getWorldStationBounds(subject);
    const support = getLowerShelfSupport(subject);
    const supportBounds = getSupportSurfaceBoundsXZMm(support);
    const frameBounds = getFrameClearanceBounds(subject);
    const backdropBounds = getBackdropBounds(subject);
    const chartBackingBounds = getChartBackingBounds(subject);
    const focusChartBounds = getFocusChartProtectedBounds(subject);
    const contextBooks = getContextBookFootprints(subject);
    const placementProps = station.props.map((prop) => ({
      id: prop.id,
      dimensionsMm: prop.dimensionsMm,
      positionMm: prop.positionMm,
      rotationYDeg: prop.rotationYDeg,
    }));

    if (!observerIsOnChartFrontSide(subject)) {
      issues.push(`observer-facing:${subject.id}`);
    }

    for (const prop of station.props) {
      if (allIds.has(prop.id)) issues.push(`duplicate-id:${prop.id}`);
      allIds.add(prop.id);
      const supportedFamilies: readonly ShelfSwingPropFamily[] = plan.schemaVersion === 1
        ? ["box", "cylinder", "vessel"]
        : ["box", "cylinder", "vessel", "bowl", "necked-vessel", "faceted"];
      if (!supportedFamilies.includes(prop.family)) {
        issues.push(`unsupported-family:${prop.id}`);
      }
      if (!hasPositiveFiniteBoxDimensionsMm(prop.dimensionsMm)) {
        issues.push(`invalid-dimensions:${prop.id}`);
        continue;
      }
      const localBounds = getLocalPropBounds(prop);
      const localXZ = getBoundsXZMm(localBounds);
      if (!areBounds3Finite(localBounds)) issues.push(`non-finite-bounds:${prop.id}`);
      if (!isWithinBounds3(localBounds, localStationBounds)) {
        issues.push(`outside-station:${prop.id}`);
      }
      if (!isWithinBoundsXZ(localXZ, supportBounds)) {
        issues.push(`outside-support:${prop.id}`);
      }
      if (!isSupportedAtHeightMm(
        localBounds.min.y,
        support.topY,
        LOWER_SHELF_SUPPORT_TOLERANCE_MM,
      )) {
        issues.push(`unsupported:${prop.id}`);
      }
      if (!isWithinBoundsXZ(localXZ, DISPLAY_ZONE_XZ)) {
        issues.push(`outside-display-zone:${prop.id}`);
      }
      if (frameBounds.some((bounds) => intersectsBounds3(localBounds, bounds))) {
        issues.push(`frame-clearance:${prop.id}`);
      }
      if (intersectsBounds3(localBounds, backdropBounds)) {
        issues.push(`backdrop:${prop.id}`);
      }
      if (intersectsBounds3(localBounds, chartBackingBounds)) {
        issues.push(`chart-backing:${prop.id}`);
      }
      if (intersectsBounds3(localBounds, focusChartBounds)) {
        issues.push(`focus-chart-volume:${prop.id}`);
      }
      if (intersectsProtectedRegionXZ(localXZ, CHART_VISIBILITY_PROTECTION_XZ)) {
        issues.push(`chart-visibility:${prop.id}`);
      }
      if (contextBooks.some((book) => intersectsBounds3(localBounds, book.bounds))) {
        issues.push(`context-book-collision:${prop.id}`);
      }

      const worldBounds = getWorldPropBounds(subject, prop);
      if (!areBounds3Finite(worldBounds)) issues.push(`non-finite-world-bounds:${prop.id}`);
      if (!isWithinBounds3(worldBounds, worldStationBounds)) {
        issues.push(`outside-world-station:${prop.id}`);
      }
      if (!isWithinBounds3(worldBounds, sceneBounds)) {
        issues.push(`outside-scene:${prop.id}`);
      }
    }

    const intersections = findPairwiseIntersections(placementProps, getLocalPropBounds);
    intersections.forEach(({ left, right }) => {
      issues.push(`prop-collision:${left.id}:${right.id}`);
    });
  });
  return Object.freeze(issues);
};

const createFallbackCandidate = (): ShelfSwingPropVariationCandidate => ({
  schemaVersion: SHELF_SWING_PROP_VARIATION_SCHEMA_VERSION,
  stations: subjects.map((subject) => ({
    stationId: subject.id,
    props: [{
      id: `${subject.id}-safe-fallback-box`,
      family: "box",
      dimensionsMm: { width: 90, height: 110, depth: 80 },
      positionMm: {
        x: 0,
        y: LOWER_SHELF_TOP_Y_MM + 55,
        z: 135,
      },
      rotationYDeg: 0,
      palette: { body: subject.materialHints.primary },
    }],
  })),
});

/** Validate once, then use the fixed supported arrangement if any rule fails. */
export const resolveShelfSwingPropVariationCandidate = (
  candidate: ShelfSwingPropVariationCandidate,
): ShelfSwingPropVariationPlan => {
  const issues = getShelfSwingPropVariationSafetyIssues(candidate);
  if (issues.length === 0) {
    return Object.freeze({
      schemaVersion: candidate.schemaVersion,
      stations: Object.freeze(candidate.stations.map((station) => Object.freeze({
        stationId: station.stationId,
        props: Object.freeze(station.props.map((prop) => Object.freeze({
          ...prop,
          dimensionsMm: Object.freeze({ ...prop.dimensionsMm }),
          positionMm: Object.freeze({ ...prop.positionMm }),
          palette: Object.freeze({ ...prop.palette }),
        }))),
      }))),
      fallbackUsed: false,
      fallbackIssues: Object.freeze([]),
    });
  }

  const fallback = createFallbackCandidate();
  const fallbackIssues = getShelfSwingPropVariationSafetyIssues(fallback);
  if (fallbackIssues.length > 0) {
    throw new Error(`Shelf Swing safe prop fallback is invalid: ${fallbackIssues.join(", ")}`);
  }
  return Object.freeze({
    schemaVersion: fallback.schemaVersion,
    stations: Object.freeze(fallback.stations.map((station) => Object.freeze({
      stationId: station.stationId,
      props: Object.freeze(station.props.map((prop) => Object.freeze({
        ...prop,
        dimensionsMm: Object.freeze({ ...prop.dimensionsMm }),
        positionMm: Object.freeze({ ...prop.positionMm }),
        palette: Object.freeze({ ...prop.palette }),
      }))),
    }))),
    fallbackUsed: true,
    fallbackIssues: issues,
  });
};

const V2_SINGLE_FAMILIES = [
  "box",
  "cylinder",
  "vessel",
  "bowl",
  "necked-vessel",
  "faceted",
] as const satisfies readonly ShelfSwingPropFamily[];

const V2_PAIR_PROFILES = [
  { families: ["bowl", "faceted"] },
  { families: ["bowl", "necked-vessel"] },
  { families: ["faceted", "necked-vessel"] },
] as const satisfies readonly Readonly<{
  families: readonly [ShelfSwingPropFamily, ShelfSwingPropFamily];
}>[];

const V2_PALETTE_BY_STATION: Readonly<Record<
  ShelfSwingSubjectDefinition["id"],
  readonly [string, string, string]
>> = Object.freeze({
  "shelf-front": ["#cfc7ae", "#91a79a", "#b77e67"],
  "shelf-middle": ["#8ca3ad", "#a5ad97", "#d1c4a8"],
  "shelf-back": ["#c0a86f", "#b67c68", "#aab6b3"],
});

const createV2PropDimensions = (
  family: ShelfSwingPropFamily,
  stream: ReturnType<SceneVariationDescriptor["createRandomStream"]>,
  compact: boolean,
): BoxDimensionsMm => {
  switch (family) {
    case "box":
      return {
        width: stream.nextInt(compact ? 58 : 82, compact ? 72 : 100),
        height: stream.nextInt(compact ? 66 : 108, compact ? 88 : 142),
        depth: stream.nextInt(compact ? 56 : 78, compact ? 70 : 96),
      };
    case "cylinder": {
      const diameter = stream.nextInt(compact ? 58 : 82, compact ? 72 : 100);
      return {
        width: diameter,
        height: stream.nextInt(compact ? 70 : 108, compact ? 92 : 150),
        depth: diameter,
      };
    }
    case "vessel": {
      const diameter = stream.nextInt(compact ? 60 : 84, compact ? 74 : 102);
      return {
        width: diameter,
        height: stream.nextInt(compact ? 76 : 126, compact ? 96 : 160),
        depth: diameter,
      };
    }
    case "bowl": {
      const diameter = stream.nextInt(compact ? 78 : 112, compact ? 96 : 128);
      return {
        width: diameter,
        height: stream.nextInt(compact ? 38 : 48, compact ? 52 : 64),
        depth: diameter,
      };
    }
    case "necked-vessel": {
      const diameter = stream.nextInt(compact ? 54 : 82, compact ? 68 : 98);
      return {
        width: diameter,
        height: stream.nextInt(compact ? 80 : 136, compact ? 104 : 172),
        depth: diameter,
      };
    }
    case "faceted":
      return {
        width: stream.nextInt(compact ? 56 : 90, compact ? 70 : 112),
        height: stream.nextInt(compact ? 58 : 86, compact ? 80 : 112),
        depth: stream.nextInt(compact ? 54 : 82, compact ? 68 : 108),
      };
  }
};

const getV2PropRotation = (
  family: ShelfSwingPropFamily,
  descriptor: SceneVariationDescriptor,
  propId: string,
): number => {
  if (["cylinder", "vessel", "bowl", "necked-vessel"].includes(family)) return 0;
  return descriptor
    .createRandomStream("layout", `${propId}/orientation`)
    .nextInt(-18, 18);
};

const createV2Prop = (
  descriptor: SceneVariationDescriptor,
  subject: ShelfSwingSubjectDefinition,
  id: string,
  family: ShelfSwingPropFamily,
  dimensionsMm: BoxDimensionsMm,
  positionMm: ShelfSwingVec3,
): ShelfSwingPropVariation => {
  const rotationYDeg = getV2PropRotation(family, descriptor, id);
  const body = descriptor
    .createRandomStream("materials", `${id}/palette`)
    .pick(V2_PALETTE_BY_STATION[subject.id]);
  return Object.freeze({
    id,
    family,
    dimensionsMm: Object.freeze(dimensionsMm),
    positionMm: Object.freeze(positionMm),
    rotationYDeg,
    palette: Object.freeze({ body }),
  });
};

const generateV2StationVariation = (
  descriptor: SceneVariationDescriptor,
  subject: ShelfSwingSubjectDefinition,
): ShelfSwingStationVariationV2 => {
  const composition = descriptor
    .createRandomStream("layout", `${subject.id}/display-composition`)
    .pick(["single", "paired"] as const);

  if (composition === "single") {
    const propId = `${subject.id}-display-hero`;
    const family = descriptor
      .createRandomStream("props", `${subject.id}/single-family`)
      .pick(V2_SINGLE_FAMILIES);
    const dimensionsMm = createV2PropDimensions(
      family,
      descriptor.createRandomStream("props", `${propId}/dimensions`),
      false,
    );
    const placement = descriptor.createRandomStream("layout", `${propId}/placement`);
    return Object.freeze({
      stationId: subject.id,
      composition,
      props: Object.freeze([createV2Prop(
        descriptor,
        subject,
        propId,
        family,
        dimensionsMm,
        {
          x: placement.nextRange(-18, 18),
          y: LOWER_SHELF_TOP_Y_MM + dimensionsMm.height / 2,
          z: placement.nextRange(115, 140),
        },
      )]),
    });
  }

  const profile = descriptor
    .createRandomStream("props", `${subject.id}/paired-profile`)
    .pick(V2_PAIR_PROFILES);
  const ids = [`${subject.id}-display-pair-left`, `${subject.id}-display-pair-right`] as const;
  const props = profile.families.map((family, index) => {
    const propId = ids[index]!;
    const dimensionsMm = createV2PropDimensions(
      family,
      descriptor.createRandomStream("props", `${propId}/dimensions`),
      true,
    );
    return { family, propId, dimensionsMm };
  });
  const rotations = props.map(({ family, propId }) =>
    getV2PropRotation(family, descriptor, propId));
  const halfWidths = props.map(({ dimensionsMm }, index) =>
    getYawRotatedBoxBoundsMm(
      { x: 0, y: 0, z: 0 },
      dimensionsMm,
      rotations[index],
    ).max.x);
  const centerOffset = (halfWidths[0]! + halfWidths[1]! + 12) / 2;
  const centerZ = descriptor
    .createRandomStream("layout", `${subject.id}/paired-placement`)
    .nextRange(110, 128);
  return Object.freeze({
    stationId: subject.id,
    composition,
    props: Object.freeze(props.map(({ family, propId, dimensionsMm }, index) =>
      createV2Prop(
        descriptor,
        subject,
        propId,
        family,
        dimensionsMm,
        {
          x: index === 0 ? -centerOffset : centerOffset,
          y: LOWER_SHELF_TOP_Y_MM + dimensionsMm.height / 2,
          z: centerZ,
        },
      ))),
  });
};

const createV2FallbackCandidate = (): ShelfSwingPropVariationCandidateV2 => ({
  schemaVersion: SHELF_SWING_PROP_VARIATION_SCHEMA_V2,
  stations: subjects.map((subject) => ({
    stationId: subject.id,
    composition: "single",
    props: [{
      id: `${subject.id}-safe-v2-fallback-bowl`,
      family: "bowl",
      dimensionsMm: { width: 96, height: 48, depth: 96 },
      positionMm: { x: 0, y: LOWER_SHELF_TOP_Y_MM + 24, z: 120 },
      rotationYDeg: 0,
      palette: { body: V2_PALETTE_BY_STATION[subject.id][0] },
    }],
  })),
});

/** Validate once, then use a fixed, separately validated schema-v2 fallback. */
export const resolveShelfSwingPropVariationCandidateV2 = (
  candidate: ShelfSwingPropVariationCandidateV2,
): ShelfSwingPropVariationPlanV2 => {
  const issues = getShelfSwingPropVariationSafetyIssues(candidate);
  const resolvedCandidate = issues.length === 0 ? candidate : createV2FallbackCandidate();
  const fallbackIssues = issues.length === 0
    ? []
    : getShelfSwingPropVariationSafetyIssues(resolvedCandidate);
  if (fallbackIssues.length > 0) {
    throw new Error(`Shelf Swing schema-v2 fallback is invalid: ${fallbackIssues.join(", ")}`);
  }
  return Object.freeze({
    schemaVersion: SHELF_SWING_PROP_VARIATION_SCHEMA_V2,
    stations: Object.freeze(resolvedCandidate.stations.map((station) => Object.freeze({
      stationId: station.stationId,
      composition: station.composition,
      props: Object.freeze(station.props.map((prop) => Object.freeze({
        ...prop,
        dimensionsMm: Object.freeze({ ...prop.dimensionsMm }),
        positionMm: Object.freeze({ ...prop.positionMm }),
        palette: Object.freeze({ ...prop.palette }),
      }))),
    }))),
    fallbackUsed: issues.length > 0,
    fallbackIssues: Object.freeze(issues),
  });
};

export const resolveShelfSwingPropVariationPlan = (
  descriptor: SceneVariationDescriptor | undefined,
): ResolvedShelfSwingPropVariationPlan | null => {
  if (!descriptor) return null;
  if (descriptor.identity.sceneId !== "shelf-swing") {
    throw new RangeError("Shelf Swing prop variation requires the canonical Shelf Swing identity");
  }
  if (descriptor.identity.schemaVersion === SHELF_SWING_PROP_VARIATION_SCHEMA_V2) {
    return resolveShelfSwingPropVariationCandidateV2({
      schemaVersion: SHELF_SWING_PROP_VARIATION_SCHEMA_V2,
      stations: subjects.map((subject) => generateV2StationVariation(descriptor, subject)),
    });
  }
  if (descriptor.identity.schemaVersion !== SHELF_SWING_PROP_VARIATION_SCHEMA_VERSION) {
    throw new RangeError("Shelf Swing prop variation supports schema versions 1 and 2 only");
  }
  const candidate: ShelfSwingPropVariationCandidate = {
    schemaVersion: SHELF_SWING_PROP_VARIATION_SCHEMA_VERSION,
    stations: subjects.map((subject) => ({
      stationId: subject.id,
      props: generateStationProps(descriptor, subject),
    })),
  };
  return resolveShelfSwingPropVariationCandidate(candidate);
};
