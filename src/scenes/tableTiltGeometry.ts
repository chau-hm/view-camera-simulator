// Canonical world-space geometry for the Table Tilt scene.
// All distances and positions in this module are expressed in millimetres.

export type TableTiltVec3 = {
  x: number;
  y: number;
  z: number;
};

export type TabletopLocalPosition = {
  localX: number;
  localDepth: number;
  verticalOffsetMm?: number;
};

export type TableTiltSubjectRole = "near" | "middle" | "far";
export type TableTiltDetailType = "vertical-stripes" | "line-pattern" | "focus-chart";

export type TableTiltSubjectDefinition = {
  id: "near-cup" | "mid-notebook" | "far-book";
  role: TableTiltSubjectRole;
  label: string;
  semanticName: string;
  tabletopLocalPosition: TabletopLocalPosition;
  worldPosition: TableTiltVec3;
  focusAnchorWorld: TableTiltVec3;
  focusAnchorSurfaceOffsetMm: number;
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  bounds: {
    centerLocal: TableTiltVec3;
    size: TableTiltVec3;
  };
  yawDeg: number;
  detailType: TableTiltDetailType;
  materialHints: {
    primary: string;
    secondary: string;
    detail: string;
  };
};

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export const floor = {
  center: { x: 0, y: -1350, z: 2000 },
  width: 8000,
  depth: 7000,
  nearZ: -1500,
  farZ: 5500,
  color: "#e7e5e4",
} as const;

const tabletopTiltAngleDeg = 6;
const tabletopTiltAngleRad = degreesToRadians(tabletopTiltAngleDeg);

export const tabletop = {
  // The simulated lens remains at the optics datum near Y=0. Keeping the
  // tabletop below that axis lets the physical camera see its top surface.
  center: { x: 0, y: -500, z: 2400 },
  width: 2800,
  depth: 3600,
  thickness: 80,
  tiltAngleDeg: tabletopTiltAngleDeg,
  tiltAngleRad: tabletopTiltAngleRad,
  slopeYPerDepth: -Math.tan(tabletopTiltAngleRad),
  nearLocalDepth: -1800,
  farLocalDepth: 1800,
  color: "#a16207",
  edgeColor: "#713f12",
} as const;

// Procedural detail dimensions are canonical too: the factory only converts
// these millimetre values to Three.js units at its render boundary.
export const detailGeometry = {
  tabletopGuides: {
    count: 9,
    width: 5,
    height: 3,
    surfaceGap: 1,
    edgeMargin: 20,
  },
  cup: {
    bodyRadialSegments: 32,
    bottomRadiusRatio: 0.92,
    stripes: {
      anglesDeg: [-48, -24, 0, 24, 48],
      width: 12,
      heightRatio: 0.68,
      depth: 4,
      surfaceGap: 3,
      centerHeightRatio: 0.52,
    },
    rim: {
      radiusOffset: 2,
      tubeRadius: 8,
      radialSegments: 10,
      tubularSegments: 36,
      heightOffset: 2,
    },
    handle: {
      radius: 52,
      tubeRadius: 12,
      radialSegments: 10,
      tubularSegments: 30,
      centerXOffsetFromBodyRadius: 45,
      centerHeightRatio: 0.56,
    },
  },
  notebook: {
    pageInset: 8,
    pageHeightReduction: 8,
    coverThickness: 4,
    lines: {
      count: 8,
      widthRatio: 0.72,
      thickness: 3,
      depth: 7,
      xOffsetRatio: 0.04,
      depthSpanRatio: 0.68,
      centerOffsetAboveTop: 2.5,
    },
    binding: {
      width: 18,
      height: 7,
      depthRatio: 0.9,
      insetFromLeftEdge: 18,
      centerOffsetAboveTop: 2,
    },
  },
  book: {
    pageHorizontalInset: 9,
    pageDepthInset: 8,
    pageHeightReduction: 14,
    coverThickness: 6,
    focusChart: {
      widthRatio: 0.72,
      depthRatio: 0.66,
      columns: 6,
      rows: 4,
      thickness: 3,
      centerOffsetAboveTop: 2.5,
    },
  },
} as const;

/**
 * Convert a tabletop-local surface position to absolute world space.
 *
 * `localDepth` increases toward the far edge. `verticalOffsetMm` is measured
 * along the tabletop's rotated surface normal; zero therefore lies exactly on
 * the canonical top surface rather than at the tabletop box centre.
 */
export function tabletopLocalToWorld({
  localX,
  localDepth,
  verticalOffsetMm = 0,
}: TabletopLocalPosition): TableTiltVec3 {
  const localYFromTableCenter = tabletop.thickness / 2 + verticalOffsetMm;
  const cosine = Math.cos(tabletop.tiltAngleRad);
  const sine = Math.sin(tabletop.tiltAngleRad);

  return {
    x: tabletop.center.x + localX,
    y: tabletop.center.y + localYFromTableCenter * cosine - localDepth * sine,
    z: tabletop.center.z + localYFromTableCenter * sine + localDepth * cosine,
  };
}

const tabletopBoxLocalToWorld = (local: TableTiltVec3): TableTiltVec3 => {
  const cosine = Math.cos(tabletop.tiltAngleRad);
  const sine = Math.sin(tabletop.tiltAngleRad);
  return {
    x: tabletop.center.x + local.x,
    y: tabletop.center.y + local.y * cosine - local.z * sine,
    z: tabletop.center.z + local.y * sine + local.z * cosine,
  };
};

export const tabletopTopSurfacePlane = {
  point: tabletopLocalToWorld({ localX: 0, localDepth: 0 }),
  normal: {
    x: 0,
    y: Math.cos(tabletop.tiltAngleRad),
    z: Math.sin(tabletop.tiltAngleRad),
  },
} as const;

export const tabletopExtents = {
  near: {
    localDepth: tabletop.nearLocalDepth,
    topSurfaceCenterWorld: tabletopLocalToWorld({
      localX: 0,
      localDepth: tabletop.nearLocalDepth,
    }),
  },
  far: {
    localDepth: tabletop.farLocalDepth,
    topSurfaceCenterWorld: tabletopLocalToWorld({
      localX: 0,
      localDepth: tabletop.farLocalDepth,
    }),
  },
} as const;

const subjectInputs = [
  {
    id: "near-cup",
    role: "near",
    label: "Near cup",
    semanticName: "table-tilt-near-cup",
    tabletopLocalPosition: { localX: -320, localDepth: -1200, verticalOffsetMm: 0 },
    dimensions: { width: 190, height: 180, depth: 190 },
    // Includes the handle and rim, not only the cylindrical body.
    bounds: { centerLocal: { x: 55, y: 100, z: 0 }, size: { x: 320, y: 210, z: 210 } },
    yawDeg: 0,
    detailType: "vertical-stripes",
    materialHints: { primary: "#3b82f6", secondary: "#dbeafe", detail: "#f8fafc" },
  },
  {
    id: "mid-notebook",
    role: "middle",
    label: "Middle notebook",
    semanticName: "table-tilt-mid-notebook",
    tabletopLocalPosition: { localX: 50, localDepth: 0, verticalOffsetMm: 0 },
    dimensions: { width: 420, height: 28, depth: 300 },
    bounds: { centerLocal: { x: 0, y: 18, z: 0 }, size: { x: 430, y: 36, z: 310 } },
    yawDeg: -8,
    detailType: "line-pattern",
    materialHints: { primary: "#f59e0b", secondary: "#fffbeb", detail: "#78350f" },
  },
  {
    id: "far-book",
    role: "far",
    label: "Far book",
    semanticName: "table-tilt-far-book",
    tabletopLocalPosition: { localX: 550, localDepth: 1200, verticalOffsetMm: 0 },
    dimensions: { width: 340, height: 72, depth: 250 },
    bounds: { centerLocal: { x: 0, y: 38, z: 0 }, size: { x: 350, y: 76, z: 260 } },
    yawDeg: 10,
    detailType: "focus-chart",
    materialHints: { primary: "#7e22ce", secondary: "#f3e8ff", detail: "#111827" },
  },
] as const;

export const subjects: TableTiltSubjectDefinition[] = subjectInputs.map((subject) => {
  const worldPosition = tabletopLocalToWorld(subject.tabletopLocalPosition);
  return {
    ...subject,
    tabletopLocalPosition: { ...subject.tabletopLocalPosition },
    worldPosition,
    // The semantic anchor is the centre of the subject's footprint on the top
    // surface. The factory places the visible subject group at this exact point.
    focusAnchorWorld: { ...worldPosition },
    focusAnchorSurfaceOffsetMm: subject.tabletopLocalPosition.verticalOffsetMm,
    dimensions: { ...subject.dimensions },
    bounds: {
      centerLocal: { ...subject.bounds.centerLocal },
      size: { ...subject.bounds.size },
    },
    materialHints: { ...subject.materialHints },
  };
});

export const nearSubject = subjects.find((subject) => subject.id === "near-cup")!;
export const middleSubject = subjects.find((subject) => subject.id === "mid-notebook")!;
export const farSubject = subjects.find((subject) => subject.id === "far-book")!;

const supportLocalPositions = [
  { id: "near-left", localX: -1120, localDepth: -1250 },
  { id: "near-right", localX: 1120, localDepth: -1250 },
  { id: "far-left", localX: -1120, localDepth: 1250 },
  { id: "far-right", localX: 1120, localDepth: 1250 },
] as const;

export const tableSupports = supportLocalPositions.map((support) => {
  const undersideWorld = tabletopLocalToWorld({
    localX: support.localX,
    localDepth: support.localDepth,
    verticalOffsetMm: -tabletop.thickness,
  });
  const height = undersideWorld.y - floor.center.y;
  return {
    ...support,
    width: 110,
    depth: 110,
    height,
    center: {
      x: undersideWorld.x,
      y: floor.center.y + height / 2,
      z: undersideWorld.z,
    },
    topWorld: undersideWorld,
    color: "#57534e",
  };
});

export const observerCamera = {
  position: { x: 3600, y: 1000, z: -1800 },
  target: { x: 0, y: -500, z: 2500 },
} as const;

export const focusTargets = subjects.map((subject) => ({
  id: subject.id,
  label: subject.label,
  worldPosition: subject.focusAnchorWorld,
  weight: 1,
}));

export const canonicalFocusDistanceMm = middleSubject.focusAnchorWorld.z;

const getBoxCorners = (center: TableTiltVec3, size: TableTiltVec3): TableTiltVec3[] => {
  const corners: TableTiltVec3[] = [];
  for (const xSign of [-1, 1]) {
    for (const ySign of [-1, 1]) {
      for (const zSign of [-1, 1]) {
        corners.push({
          x: center.x + (xSign * size.x) / 2,
          y: center.y + (ySign * size.y) / 2,
          z: center.z + (zSign * size.z) / 2,
        });
      }
    }
  }
  return corners;
};

export function getTabletopWorldCorners(): TableTiltVec3[] {
  return getBoxCorners(
    { x: 0, y: 0, z: 0 },
    { x: tabletop.width, y: tabletop.thickness, z: tabletop.depth },
  ).map(tabletopBoxLocalToWorld);
}

export function getFloorWorldCorners(): TableTiltVec3[] {
  return [
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.farZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.farZ },
  ];
}

export function getSubjectWorldBoundsCorners(subject: TableTiltSubjectDefinition): TableTiltVec3[] {
  const yawRadians = degreesToRadians(subject.yawDeg);
  const yawCosine = Math.cos(yawRadians);
  const yawSine = Math.sin(yawRadians);
  const tiltCosine = Math.cos(tabletop.tiltAngleRad);
  const tiltSine = Math.sin(tabletop.tiltAngleRad);

  return getBoxCorners(subject.bounds.centerLocal, subject.bounds.size).map((local) => {
    // The factory applies subject yaw inside the tabletop-tilted anchor group.
    const yawedX = local.x * yawCosine + local.z * yawSine;
    const yawedZ = -local.x * yawSine + local.z * yawCosine;
    return {
      x: subject.worldPosition.x + yawedX,
      y: subject.worldPosition.y + local.y * tiltCosine - yawedZ * tiltSine,
      z: subject.worldPosition.z + local.y * tiltSine + yawedZ * tiltCosine,
    };
  });
}

const topSurfaceCorners = [
  tabletopLocalToWorld({ localX: -tabletop.width / 2, localDepth: tabletop.nearLocalDepth }),
  tabletopLocalToWorld({ localX: tabletop.width / 2, localDepth: tabletop.nearLocalDepth }),
  tabletopLocalToWorld({ localX: -tabletop.width / 2, localDepth: tabletop.farLocalDepth }),
  tabletopLocalToWorld({ localX: tabletop.width / 2, localDepth: tabletop.farLocalDepth }),
];

const boundsFromPoints = (points: TableTiltVec3[], paddingMm = 0) => ({
  min: {
    x: Math.min(...points.map((point) => point.x)) - paddingMm,
    y: Math.min(...points.map((point) => point.y)) - paddingMm,
    z: Math.min(...points.map((point) => point.z)) - paddingMm,
  },
  max: {
    x: Math.max(...points.map((point) => point.x)) + paddingMm,
    y: Math.max(...points.map((point) => point.y)) + paddingMm,
    z: Math.max(...points.map((point) => point.z)) + paddingMm,
  },
});

export const compositionTargetBounds = boundsFromPoints(topSurfaceCorners, 100);

const supportCorners = tableSupports.flatMap((support) =>
  getBoxCorners(support.center, {
    x: support.width,
    y: support.height,
    z: support.depth,
  }),
);

const allPhysicalGeometryPoints = [
  ...getFloorWorldCorners(),
  ...getTabletopWorldCorners(),
  ...supportCorners,
  ...subjects.flatMap(getSubjectWorldBoundsCorners),
];

export const sceneBounds = boundsFromPoints(allPhysicalGeometryPoints, 150);

export default {
  floor,
  tabletop,
  detailGeometry,
  tabletopTopSurfacePlane,
  tabletopExtents,
  tableSupports,
  subjects,
  nearSubject,
  middleSubject,
  farSubject,
  observerCamera,
  focusTargets,
  canonicalFocusDistanceMm,
  compositionTargetBounds,
  sceneBounds,
  tabletopLocalToWorld,
  getTabletopWorldCorners,
  getFloorWorldCorners,
  getSubjectWorldBoundsCorners,
};
