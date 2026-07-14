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
export type TableTiltDetailType = "horizontal-focus-card" | "line-pattern" | "focus-chart";

export type TableTiltFocusSample = {
  id: "centre" | "near-edge" | "far-edge" | "left-edge" | "right-edge";
  localPosition: SubjectLocalPosition;
  worldPosition: TableTiltVec3;
};

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
  focusPatch: {
    width: number;
    depth: number;
    centerLocal: SubjectLocalPosition;
    normalLocal: TableTiltVec3;
    visibleSurfaceHeightLocalMm: number;
    sampleOffsetX: number;
    sampleOffsetZ: number;
  };
  focusSamples: TableTiltFocusSample[];
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
const focusProbeSurfaceGapMm = 1;
const detailPanelThicknessMm = 4;
const notebookLineThicknessMm = 3;
const notebookLineGapMm = 1;
const bookCellThicknessMm = 3;
const bookCellGapMm = 2;

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
  focusProbeSurfaceGap: focusProbeSurfaceGapMm,
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
      width: 18,
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
    focusCard: {
      width: 160,
      depth: 110,
      thickness: detailPanelThicknessMm,
      centerZ: -152,
      centerHeight:
        focusProbeHeightAboveTabletopMm -
        focusProbeSurfaceGapMm -
        notebookLineThicknessMm -
        notebookLineGapMm -
        detailPanelThicknessMm / 2,
      bandCount: 7,
      bandThickness: notebookLineThicknessMm,
      bandGap: notebookLineGapMm,
      supportWidth: 8,
    },
  },
  notebook: {
    pageInset: 8,
    pageHeightReduction: 8,
    coverThickness: 4,
    focusPanel: {
      width: 260,
      depth: 112,
      thickness: detailPanelThicknessMm,
      centerHeight:
        focusProbeHeightAboveTabletopMm -
        focusProbeSurfaceGapMm -
        notebookLineThicknessMm -
        notebookLineGapMm -
        detailPanelThicknessMm / 2,
      lineCount: 7,
      lineWidthRatio: 0.82,
      lineDepth: 7,
      lineThickness: notebookLineThicknessMm,
      lineGap: notebookLineGapMm,
      supportWidth: 8,
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
      depth: 112,
      thickness: detailPanelThicknessMm,
      centerHeight:
        focusProbeHeightAboveTabletopMm -
        focusProbeSurfaceGapMm -
        bookCellThicknessMm -
        bookCellGapMm -
        detailPanelThicknessMm / 2,
      columns: 5,
      rows: 5,
      cellThickness: bookCellThicknessMm,
      cellGap: bookCellGapMm,
      supportWidth: 8,
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

const cupProbeLocal: SubjectLocalPosition = {
  x: 0,
  y: focusProbeHeightAboveTabletopMm,
  z: detailGeometry.cup.focusCard.centerZ,
};
const notebookProbeLocal: SubjectLocalPosition = {
  x: 0,
  y: focusProbeHeightAboveTabletopMm,
  z: 0,
};
const bookProbeLocal: SubjectLocalPosition = {
  x: 0,
  y: focusProbeHeightAboveTabletopMm,
  z: 0,
};

const subjectInputs = [
  {
    id: "near-cup",
    role: "near",
    label: "Near cup focus card",
    semanticName: "table-tilt-near-cup",
    focusProbeSemanticName: "table-tilt-near-cup-focus-probe",
    tabletopLocalPosition: { localX: -350, localDepth: -1300, verticalOffsetMm: 0 },
    focusProbeLocalPosition: cupProbeLocal,
    focusPatch: {
      width: detailGeometry.cup.focusCard.width,
      depth: detailGeometry.cup.focusCard.depth,
      centerLocal: { x: 0, y: focusProbeHeightAboveTabletopMm, z: detailGeometry.cup.focusCard.centerZ },
      sampleOffsetX: detailGeometry.cup.focusCard.width * 0.38,
      sampleOffsetZ:
        (detailGeometry.cup.focusCard.depth *
          (detailGeometry.cup.focusCard.bandCount - 1)) /
        (2 * detailGeometry.cup.focusCard.bandCount),
    },
    dimensions: { width: 190, height: 180, depth: 190 },
    bounds: { centerLocal: { x: 55, y: 100, z: -50 }, size: { x: 320, y: 210, z: 330 } },
    yawDeg: 0,
    detailType: "horizontal-focus-card",
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
    focusPatch: {
      width: detailGeometry.notebook.focusPanel.width,
      depth: detailGeometry.notebook.focusPanel.depth,
      centerLocal: { x: 0, y: focusProbeHeightAboveTabletopMm, z: 0 },
      sampleOffsetX: detailGeometry.notebook.focusPanel.width * 0.38,
      sampleOffsetZ:
        (detailGeometry.notebook.focusPanel.depth *
          (detailGeometry.notebook.focusPanel.lineCount - 1)) /
        (2 * (detailGeometry.notebook.focusPanel.lineCount + 1)),
    },
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
    focusPatch: {
      width: detailGeometry.book.focusChart.width,
      depth: detailGeometry.book.focusChart.depth,
      centerLocal: { x: 0, y: focusProbeHeightAboveTabletopMm, z: 0 },
      sampleOffsetX:
        (detailGeometry.book.focusChart.width *
          (detailGeometry.book.focusChart.columns - 1)) /
        (2 * detailGeometry.book.focusChart.columns),
      sampleOffsetZ:
        (detailGeometry.book.focusChart.depth *
          (detailGeometry.book.focusChart.rows - 1)) /
        (2 * detailGeometry.book.focusChart.rows),
    },
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
  const focusSampleInputs = [
    { id: "centre", x: 0, z: 0 },
    { id: "near-edge", x: 0, z: -input.focusPatch.sampleOffsetZ },
    { id: "far-edge", x: 0, z: input.focusPatch.sampleOffsetZ },
    { id: "left-edge", x: -input.focusPatch.sampleOffsetX, z: 0 },
    { id: "right-edge", x: input.focusPatch.sampleOffsetX, z: 0 },
  ] as const;
  const focusSamples: TableTiltFocusSample[] = focusSampleInputs.map((sample) => {
    const localPosition = {
      x: input.focusPatch.centerLocal.x + sample.x,
      y: input.focusPatch.centerLocal.y,
      z: input.focusPatch.centerLocal.z + sample.z,
    };
    return {
      id: sample.id,
      localPosition,
      worldPosition: subjectLocalToWorld(subjectForTransform, localPosition),
    };
  });
  return {
    ...input,
    tabletopLocalPosition: { ...input.tabletopLocalPosition },
    worldPosition,
    focusProbeLocalPosition: { ...input.focusProbeLocalPosition },
    focusDetailProbeWorld,
    focusPatch: {
      ...input.focusPatch,
      centerLocal: { ...input.focusPatch.centerLocal },
      normalLocal: { x: 0, y: 1, z: 0 },
      visibleSurfaceHeightLocalMm:
        input.focusPatch.centerLocal.y - detailGeometry.focusProbeSurfaceGap,
    },
    focusSamples,
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
  sampleWorldPositions: subject.focusSamples.map((sample) => sample.worldPosition),
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
