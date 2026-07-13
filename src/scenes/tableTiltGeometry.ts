// Canonical world-space geometry for the Table Tilt lesson.
// Every distance and position in this module is expressed in millimetres.

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

export type SubjectLocalPosition = {
  x: number;
  y: number;
  z: number;
};

export type TableTiltSubjectRole = "near" | "middle" | "far";
export type TableTiltDetailType = "vertical-stripes" | "line-pattern" | "focus-chart";

export type TableTiltSubjectDefinition = {
  id: "near-cup" | "mid-notebook" | "far-book";
  role: TableTiltSubjectRole;
  label: string;
  semanticName: string;
  focusProbeSemanticName: string;
  tabletopLocalPosition: TabletopLocalPosition;
  worldPosition: TableTiltVec3;
  focusProbeLocalPosition: SubjectLocalPosition;
  focusDetailProbeWorld: TableTiltVec3;
  /** Compatibility alias used by scene/task consumers; always the visible detail probe. */
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

/**
 * Calibration is derived from the actual 150 mm lens/film geometry.
 *
 * With front tilt θ, the lens/film hinge is y = -f·cot(θ). A focus point on
 * that same height produces a horizontal Scheimpflug focus plane. Its distance
 * along the tilted optical axis is f·cos(θ)/sin²(θ). The tabletop is placed one
 * canonical probe height below that plane so the visible detail probes—not the
 * hidden subject footprints—sit on the known-correct plane.
 */
const calibrationTiltDeg = 9;
const calibrationTiltRad = degreesToRadians(calibrationTiltDeg);
const focusProbeHeightAboveTabletopMm = 180 * 0.52;
const calibratedFocusPlaneY = -150 / Math.tan(calibrationTiltRad);
const calibratedFocusDistanceMm =
  (150 * Math.cos(calibrationTiltRad)) / Math.sin(calibrationTiltRad) ** 2;
const tabletopTopSurfaceY = calibratedFocusPlaneY - focusProbeHeightAboveTabletopMm;

export const tableTiltCalibration = {
  focalLengthMm: 150,
  frontTiltDeg: calibrationTiltDeg,
  focusDistanceMm: calibratedFocusDistanceMm,
  aperture: 11 as const,
  frontRiseMm: 0,
  frontSwingDeg: 0,
  focusPlaneY: calibratedFocusPlaneY,
  focusProbeHeightAboveTabletopMm,
  tabletopTopSurfaceY,
  allowedTiltMinDeg: 8.5,
  allowedTiltMaxDeg: 9.5,
  targetSharpnessMinimum: 0.8,
} as const;

export const floor = {
  center: { x: 0, y: -1800, z: 4500 },
  width: 8000,
  depth: 9000,
  nearZ: 0,
  farZ: 9000,
  color: "#e7e5e4",
} as const;

export const tabletop = {
  center: { x: 0, y: tabletopTopSurfaceY - 40, z: 4600 },
  width: 2400,
  depth: 3400,
  thickness: 80,
  tiltAngleDeg: 0,
  tiltAngleRad: 0,
  slopeYPerDepth: 0,
  nearLocalDepth: -1700,
  farLocalDepth: 1700,
  color: "#a16207",
  edgeColor: "#713f12",
} as const;

// Procedural detail dimensions remain canonical so both R3F and RTT consume
// identical geometry at the millimetre-to-world render boundary.
export const detailGeometry = {
  focusProbeSurfaceGap: 1,
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
    focusPanel: {
      width: 260,
      height: 112,
      thickness: 4,
      frontGap: 3,
      centerHeight: focusProbeHeightAboveTabletopMm,
      lineCount: 7,
      lineWidthRatio: 0.82,
      lineHeight: 4,
      lineDepth: 3,
      lineGap: 1,
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
      width: 240,
      height: 112,
      thickness: 4,
      frontGap: 3,
      centerHeight: focusProbeHeightAboveTabletopMm,
      columns: 5,
      rows: 5,
      cellDepth: 3,
      cellGap: 1,
    },
  },
} as const;

/** Convert a tabletop-local surface position to absolute world space. */
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

/** Apply subject yaw and tabletop orientation to a subject-local detail point. */
export function subjectLocalToWorld(
  subject: Pick<TableTiltSubjectDefinition, "worldPosition" | "yawDeg">,
  local: SubjectLocalPosition,
): TableTiltVec3 {
  const yaw = degreesToRadians(subject.yawDeg);
  const yawedX = local.x * Math.cos(yaw) + local.z * Math.sin(yaw);
  const yawedZ = -local.x * Math.sin(yaw) + local.z * Math.cos(yaw);
  const tiltCosine = Math.cos(tabletop.tiltAngleRad);
  const tiltSine = Math.sin(tabletop.tiltAngleRad);

  return {
    x: subject.worldPosition.x + yawedX,
    y: subject.worldPosition.y + local.y * tiltCosine - yawedZ * tiltSine,
    z: subject.worldPosition.z + local.y * tiltSine + yawedZ * tiltCosine,
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
  normal: { x: 0, y: 1, z: 0 },
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

const cupRadius = 95;
const cupProbeLocal: SubjectLocalPosition = {
  x: 0,
  y: focusProbeHeightAboveTabletopMm,
  z:
    -(cupRadius + detailGeometry.cup.stripes.surfaceGap) -
    detailGeometry.cup.stripes.depth / 2 -
    detailGeometry.focusProbeSurfaceGap,
};
const notebookPanelCenterZ =
  -300 / 2 -
  detailGeometry.notebook.focusPanel.frontGap -
  detailGeometry.notebook.focusPanel.thickness / 2;
const notebookProbeLocal: SubjectLocalPosition = {
  x: 0,
  y: focusProbeHeightAboveTabletopMm,
  z:
    notebookPanelCenterZ -
    detailGeometry.notebook.focusPanel.thickness / 2 -
    detailGeometry.notebook.focusPanel.lineDepth -
    detailGeometry.notebook.focusPanel.lineGap -
    detailGeometry.focusProbeSurfaceGap,
};
const bookPanelCenterZ =
  -250 / 2 - detailGeometry.book.focusChart.frontGap - detailGeometry.book.focusChart.thickness / 2;
const bookProbeLocal: SubjectLocalPosition = {
  x: 0,
  y: focusProbeHeightAboveTabletopMm,
  z:
    bookPanelCenterZ -
    detailGeometry.book.focusChart.thickness / 2 -
    detailGeometry.book.focusChart.cellDepth -
    detailGeometry.book.focusChart.cellGap -
    detailGeometry.focusProbeSurfaceGap,
};

const subjectInputs = [
  {
    id: "near-cup",
    role: "near",
    label: "Near cup stripe",
    semanticName: "table-tilt-near-cup",
    focusProbeSemanticName: "table-tilt-near-cup-focus-probe",
    tabletopLocalPosition: { localX: -350, localDepth: -1300, verticalOffsetMm: 0 },
    focusProbeLocalPosition: cupProbeLocal,
    dimensions: { width: 190, height: 180, depth: 190 },
    bounds: { centerLocal: { x: 55, y: 100, z: 0 }, size: { x: 320, y: 210, z: 220 } },
    yawDeg: 0,
    detailType: "vertical-stripes",
    materialHints: { primary: "#3b82f6", secondary: "#dbeafe", detail: "#f8fafc" },
  },
  {
    id: "mid-notebook",
    role: "middle",
    label: "Middle notebook line chart",
    semanticName: "table-tilt-mid-notebook",
    focusProbeSemanticName: "table-tilt-mid-notebook-focus-probe",
    tabletopLocalPosition: { localX: 0, localDepth: 0, verticalOffsetMm: 0 },
    focusProbeLocalPosition: notebookProbeLocal,
    dimensions: { width: 420, height: 28, depth: 300 },
    bounds: { centerLocal: { x: 0, y: 70, z: -25 }, size: { x: 430, y: 140, z: 340 } },
    yawDeg: -5,
    detailType: "line-pattern",
    materialHints: { primary: "#f59e0b", secondary: "#fffbeb", detail: "#78350f" },
  },
  {
    id: "far-book",
    role: "far",
    label: "Far book focus chart",
    semanticName: "table-tilt-far-book",
    focusProbeSemanticName: "table-tilt-far-book-focus-probe",
    tabletopLocalPosition: { localX: 350, localDepth: 1300, verticalOffsetMm: 0 },
    focusProbeLocalPosition: bookProbeLocal,
    dimensions: { width: 340, height: 72, depth: 250 },
    bounds: { centerLocal: { x: 0, y: 70, z: -20 }, size: { x: 350, y: 140, z: 290 } },
    yawDeg: 5,
    detailType: "focus-chart",
    materialHints: { primary: "#7e22ce", secondary: "#f3e8ff", detail: "#111827" },
  },
] as const;

export const subjects: TableTiltSubjectDefinition[] = subjectInputs.map((input) => {
  const worldPosition = tabletopLocalToWorld(input.tabletopLocalPosition);
  const subjectForTransform = { worldPosition, yawDeg: input.yawDeg };
  const focusDetailProbeWorld = subjectLocalToWorld(
    subjectForTransform,
    input.focusProbeLocalPosition,
  );
  return {
    ...input,
    tabletopLocalPosition: { ...input.tabletopLocalPosition },
    worldPosition,
    focusProbeLocalPosition: { ...input.focusProbeLocalPosition },
    focusDetailProbeWorld,
    focusAnchorWorld: { ...focusDetailProbeWorld },
    focusAnchorSurfaceOffsetMm: input.focusProbeLocalPosition.y,
    dimensions: { ...input.dimensions },
    bounds: {
      centerLocal: { ...input.bounds.centerLocal },
      size: { ...input.bounds.size },
    },
    materialHints: { ...input.materialHints },
  };
});

export const nearSubject = subjects.find((subject) => subject.id === "near-cup")!;
export const middleSubject = subjects.find((subject) => subject.id === "mid-notebook")!;
export const farSubject = subjects.find((subject) => subject.id === "far-book")!;

const supportLocalPositions = [
  { id: "near-left", localX: -950, localDepth: -1250 },
  { id: "near-right", localX: 950, localDepth: -1250 },
  { id: "far-left", localX: -950, localDepth: 1250 },
  { id: "far-right", localX: 950, localDepth: 1250 },
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
  position: { x: 3600, y: 700, z: 1200 },
  target: { x: 0, y: -1000, z: 4700 },
} as const;

export const focusTargets = subjects.map((subject) => ({
  id: subject.id,
  label: subject.label,
  worldPosition: subject.focusDetailProbeWorld,
  weight: 1,
}));

/** Initial zero-tilt focus: approximately focus the middle visible detail probe. */
export const canonicalFocusDistanceMm = middleSubject.focusDetailProbeWorld.z;

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
  return getBoxCorners(subject.bounds.centerLocal, subject.bounds.size).map((local) =>
    subjectLocalToWorld(subject, local),
  );
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
  tableTiltCalibration,
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
  subjectLocalToWorld,
  getTabletopWorldCorners,
  getFloorWorldCorners,
  getSubjectWorldBoundsCorners,
};
