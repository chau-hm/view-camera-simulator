// Canonical world-space geometry for the Shelf Swing lesson.
// Every distance and position in this module is expressed in millimetres.

import { planeFromPointNormal } from "../core/math/plane";
import {
  distance,
  dot,
  isFiniteVec3,
  magnitude,
  rotateAroundY,
  subtract,
  vec,
} from "../core/math/vec";

export type ShelfSwingVec3 = {
  x: number;
  y: number;
  z: number;
};

export type ShelfSwingSubjectRole = "front" | "middle" | "back";
export type ShelfSwingFocusSampleId = "centre" | "top" | "bottom" | "left" | "right";
export type ShelfSwingChartPattern = "vertical-stripes" | "checker" | "horizontal-lines";

export type ShelfSwingFocusSample = {
  id: ShelfSwingFocusSampleId;
  localPosition: ShelfSwingVec3;
  worldPosition: ShelfSwingVec3;
};

export type ShelfSwingDisplayObject = {
  id: string;
  shape: "box" | "cylinder";
  localPosition: ShelfSwingVec3;
  dimensions: ShelfSwingVec3;
  color: string;
};

export type ShelfSwingSubjectDefinition = {
  id: "shelf-front" | "shelf-middle" | "shelf-back";
  role: ShelfSwingSubjectRole;
  label: string;
  semanticName: string;
  focusProbeSemanticName: string;
  worldPosition: ShelfSwingVec3;
  yawDeg: number;
  focusProbeLocalPosition: ShelfSwingVec3;
  focusDetailProbeWorld: ShelfSwingVec3;
  focusSamples: ShelfSwingFocusSample[];
  focusChart: {
    semanticName: string;
    pattern: ShelfSwingChartPattern;
    centerLocal: ShelfSwingVec3;
    width: number;
    height: number;
    columns: number;
    rows: number;
  };
  displayObjects: ShelfSwingDisplayObject[];
  dimensions: {
    width: number;
    height: number;
    depth: number;
  };
  bounds: {
    centerLocal: ShelfSwingVec3;
    size: ShelfSwingVec3;
  };
  materialHints: {
    primary: string;
    secondary: string;
    detail: string;
  };
};

export type ShelfSwingCalibrationInput = {
  focalLengthMm: number;
  focusProbes: readonly [ShelfSwingVec3, ShelfSwingVec3, ShelfSwingVec3];
  collinearityEpsilonMm?: number;
};

export type ShelfSwingCalibrationResult = {
  subjectPlane: {
    point: ShelfSwingVec3;
    normal: ShelfSwingVec3;
    distance: number;
    topViewTrace: {
      xPerZ: number;
      xInterceptMm: number;
    };
  };
  hingeLine: {
    point: ShelfSwingVec3;
    direction: ShelfSwingVec3;
  };
  frontSwingDeg: number;
  opticalAxis: {
    origin: ShelfSwingVec3;
    direction: ShelfSwingVec3;
  };
  opticalAxisIntersection: ShelfSwingVec3;
  focusDistanceMm: number;
  collinearityErrorMm: number;
};

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const radiansToDegrees = (radians: number): number => (radians * 180) / Math.PI;

const requireFinitePoint = (point: ShelfSwingVec3, label: string): void => {
  if (!isFiniteVec3(point)) {
    throw new Error(`Shelf Swing calibration requires a finite ${label} focus probe`);
  }
};

/**
 * Derive the signed front-swing solution from three probes on one vertical plane.
 *
 * The film plane is z = -f and the existing rotateAroundY convention gives the
 * swung lens normal (sin(theta), 0, cos(theta)). The lens/film hinge therefore
 * satisfies f*cot(theta) = hingeX. The focus distance is then the positive ray
 * parameter where that swung optical axis intersects the canonical subject plane.
 */
export function calibrateShelfSwing({
  focalLengthMm,
  focusProbes,
  collinearityEpsilonMm = 1e-6,
}: ShelfSwingCalibrationInput): ShelfSwingCalibrationResult {
  if (!Number.isFinite(focalLengthMm) || focalLengthMm <= 0) {
    throw new Error("Shelf Swing calibration requires a positive finite focal length");
  }
  if (!Number.isFinite(collinearityEpsilonMm) || collinearityEpsilonMm <= 0) {
    throw new Error("Shelf Swing calibration requires a positive finite collinearity epsilon");
  }

  const [front, middle, back] = focusProbes;
  requireFinitePoint(front, "front");
  requireFinitePoint(middle, "middle");
  requireFinitePoint(back, "back");

  if (
    distance(front, middle) <= collinearityEpsilonMm ||
    distance(middle, back) <= collinearityEpsilonMm ||
    distance(front, back) <= collinearityEpsilonMm
  ) {
    throw new Error("Shelf Swing calibration focus probes must not coincide");
  }

  const sharedYErrorMm = Math.max(Math.abs(middle.y - front.y), Math.abs(back.y - front.y));
  if (sharedYErrorMm > collinearityEpsilonMm) {
    throw new Error("Shelf Swing calibration focus probes must define a vertical subject plane");
  }

  const trace = subtract(back, front);
  const traceLengthTopView = Math.hypot(trace.x, trace.z);
  if (!Number.isFinite(traceLengthTopView) || traceLengthTopView <= collinearityEpsilonMm) {
    throw new Error("Shelf Swing calibration requires a finite top-view subject trace");
  }
  const middleOffset = subtract(middle, front);
  const crossTopView = middleOffset.x * trace.z - middleOffset.z * trace.x;
  const collinearityErrorMm = Math.abs(crossTopView) / traceLengthTopView;
  if (collinearityErrorMm > collinearityEpsilonMm) {
    throw new Error(
      `Shelf Swing calibration focus probes are not collinear (${collinearityErrorMm} mm error)`,
    );
  }
  if (Math.abs(trace.z) <= collinearityEpsilonMm) {
    throw new Error("Shelf Swing calibration requires a subject trace with finite Z extent");
  }

  const xPerZ = trace.x / trace.z;
  const xInterceptMm = front.x - xPerZ * front.z;
  const hingeX = xInterceptMm - xPerZ * focalLengthMm;
  if (!Number.isFinite(hingeX) || Math.abs(hingeX) <= collinearityEpsilonMm) {
    throw new Error("Shelf Swing calibration produced an invalid lens/film hinge position");
  }

  const frontSwingRad = Math.atan(focalLengthMm / hingeX);
  const frontSwingDeg = radiansToDegrees(frontSwingRad);
  if (!Number.isFinite(frontSwingDeg) || Math.abs(frontSwingDeg) <= 1e-9) {
    throw new Error("Shelf Swing calibration produced an invalid zero swing solution");
  }

  const subjectNormalLength = Math.hypot(trace.x, trace.z);
  const subjectNormal = vec(trace.z / subjectNormalLength, 0, -trace.x / subjectNormalLength);
  const subjectPlane = planeFromPointNormal(front, subjectNormal);
  const opticalAxisDirection = rotateAroundY(vec(0, 0, 1), frontSwingDeg);
  const axisPlaneDenominator = dot(subjectPlane.normal, opticalAxisDirection);
  if (!Number.isFinite(axisPlaneDenominator) || Math.abs(axisPlaneDenominator) <= 1e-12) {
    throw new Error("Shelf Swing calibration optical axis does not intersect the subject plane");
  }
  const focusDistanceMm = subjectPlane.distance / axisPlaneDenominator;
  if (!Number.isFinite(focusDistanceMm) || focusDistanceMm <= 0) {
    throw new Error("Shelf Swing calibration has no positive optical-axis intersection");
  }
  const opticalAxisIntersection = vec(
    opticalAxisDirection.x * focusDistanceMm,
    opticalAxisDirection.y * focusDistanceMm,
    opticalAxisDirection.z * focusDistanceMm,
  );
  if (!isFiniteVec3(opticalAxisIntersection)) {
    throw new Error("Shelf Swing calibration produced a non-finite optical-axis intersection");
  }

  return {
    subjectPlane: {
      point: { ...subjectPlane.point },
      normal: { ...subjectPlane.normal },
      distance: subjectPlane.distance,
      topViewTrace: { xPerZ, xInterceptMm },
    },
    hingeLine: {
      point: { x: hingeX, y: 0, z: -focalLengthMm },
      direction: { x: 0, y: 1, z: 0 },
    },
    frontSwingDeg,
    opticalAxis: {
      origin: { x: 0, y: 0, z: 0 },
      direction: opticalAxisDirection,
    },
    opticalAxisIntersection,
    focusDistanceMm,
    collinearityErrorMm,
  };
}

const stationDimensions = {
  width: 560,
  height: 1050,
  depth: 420,
} as const;

export const detailGeometry = {
  frameThickness: 45,
  backingThickness: 35,
  chartBackingGap: 1,
  shelfThickness: 38,
  chart: {
    width: 420,
    height: 300,
    centerY: 560,
    columns: 8,
    rows: 8,
    sampleOffsetX: 147,
    sampleOffsetY: 105,
  },
} as const;

export const opticalAxisHeightAboveFloorMm = detailGeometry.chart.centerY;

export const floor = {
  center: { x: 0, y: -opticalAxisHeightAboveFloorMm, z: 3850 },
  width: 6200,
  depth: 6500,
  nearZ: 600,
  farZ: 7100,
  color: "#e7e5e4",
} as const;

const stationOrigins = [
  { id: "shelf-front", role: "front", x: -800, z: 2400 },
  { id: "shelf-middle", role: "middle", x: 0, z: 3800 },
  { id: "shelf-back", role: "back", x: 800, z: 5200 },
] as const;

const stationTrace = {
  x: stationOrigins[2].x - stationOrigins[0].x,
  y: 0,
  z: stationOrigins[2].z - stationOrigins[0].z,
};
const stationYawDeg = radiansToDegrees(Math.atan2(-stationTrace.z, stationTrace.x));

export function subjectLocalToWorld(
  subject: Pick<ShelfSwingSubjectDefinition, "worldPosition" | "yawDeg">,
  local: ShelfSwingVec3,
): ShelfSwingVec3 {
  const yaw = degreesToRadians(subject.yawDeg);
  return {
    x: subject.worldPosition.x + local.x * Math.cos(yaw) + local.z * Math.sin(yaw),
    y: subject.worldPosition.y + local.y,
    z: subject.worldPosition.z - local.x * Math.sin(yaw) + local.z * Math.cos(yaw),
  };
}

const subjectInputs = [
  {
    ...stationOrigins[0],
    label: "Front vertical-stripe chart",
    semanticName: "shelf-swing-front-station",
    focusProbeSemanticName: "shelf-swing-front-focus-probe",
    pattern: "vertical-stripes",
    materialHints: { primary: "#2563eb", secondary: "#dbeafe", detail: "#172554" },
    displayObjects: [
      {
        id: "blue-block",
        shape: "box",
        localPosition: { x: -145, y: 180, z: 110 },
        dimensions: { x: 120, y: 190, z: 120 },
        color: "#60a5fa",
      },
      {
        id: "white-cylinder",
        shape: "cylinder",
        localPosition: { x: 145, y: 155, z: 125 },
        dimensions: { x: 90, y: 140, z: 90 },
        color: "#f8fafc",
      },
    ],
  },
  {
    ...stationOrigins[1],
    label: "Middle checker chart",
    semanticName: "shelf-swing-middle-station",
    focusProbeSemanticName: "shelf-swing-middle-focus-probe",
    pattern: "checker",
    materialHints: { primary: "#d97706", secondary: "#fef3c7", detail: "#451a03" },
    displayObjects: [
      {
        id: "amber-cylinder",
        shape: "cylinder",
        localPosition: { x: -140, y: 155, z: 125 },
        dimensions: { x: 100, y: 140, z: 100 },
        color: "#f59e0b",
      },
      {
        id: "dark-block",
        shape: "box",
        localPosition: { x: 140, y: 170, z: 115 },
        dimensions: { x: 120, y: 170, z: 120 },
        color: "#78350f",
      },
    ],
  },
  {
    ...stationOrigins[2],
    label: "Back horizontal-line chart",
    semanticName: "shelf-swing-back-station",
    focusProbeSemanticName: "shelf-swing-back-focus-probe",
    pattern: "horizontal-lines",
    materialHints: { primary: "#7c3aed", secondary: "#ede9fe", detail: "#2e1065" },
    displayObjects: [
      {
        id: "violet-block",
        shape: "box",
        localPosition: { x: -145, y: 170, z: 115 },
        dimensions: { x: 125, y: 170, z: 115 },
        color: "#8b5cf6",
      },
      {
        id: "pale-cylinder",
        shape: "cylinder",
        localPosition: { x: 145, y: 160, z: 120 },
        dimensions: { x: 95, y: 150, z: 95 },
        color: "#ddd6fe",
      },
    ],
  },
] as const;

export const subjects: ShelfSwingSubjectDefinition[] = subjectInputs.map((input) => {
  const worldPosition = { x: input.x, y: floor.center.y, z: input.z };
  const transform = { worldPosition, yawDeg: stationYawDeg };
  const focusProbeLocalPosition = {
    x: 0,
    y: detailGeometry.chart.centerY,
    z: 0,
  };
  const focusChart = {
    semanticName: `${input.semanticName}-focus-chart-surface`,
    pattern: input.pattern,
    centerLocal: { ...focusProbeLocalPosition },
    width: detailGeometry.chart.width,
    height: detailGeometry.chart.height,
    columns: detailGeometry.chart.columns,
    rows: detailGeometry.chart.rows,
  };
  const focusSampleInputs = [
    { id: "centre", x: 0, y: 0 },
    { id: "top", x: 0, y: detailGeometry.chart.sampleOffsetY },
    { id: "bottom", x: 0, y: -detailGeometry.chart.sampleOffsetY },
    { id: "left", x: -detailGeometry.chart.sampleOffsetX, y: 0 },
    { id: "right", x: detailGeometry.chart.sampleOffsetX, y: 0 },
  ] as const;
  const focusSamples = focusSampleInputs.map((sample): ShelfSwingFocusSample => {
    const localPosition = {
      x: focusProbeLocalPosition.x + sample.x,
      y: focusProbeLocalPosition.y + sample.y,
      z: focusProbeLocalPosition.z,
    };
    return {
      id: sample.id,
      localPosition,
      worldPosition: subjectLocalToWorld(transform, localPosition),
    };
  });
  const focusDetailProbeWorld = subjectLocalToWorld(transform, focusProbeLocalPosition);

  return {
    id: input.id,
    role: input.role,
    label: input.label,
    semanticName: input.semanticName,
    focusProbeSemanticName: input.focusProbeSemanticName,
    worldPosition,
    yawDeg: stationYawDeg,
    focusProbeLocalPosition,
    focusDetailProbeWorld,
    focusSamples,
    focusChart,
    displayObjects: input.displayObjects.map((object) => ({
      ...object,
      localPosition: { ...object.localPosition },
      dimensions: { ...object.dimensions },
    })),
    dimensions: { ...stationDimensions },
    bounds: {
      centerLocal: {
        x: 0,
        y: stationDimensions.height / 2,
        z: stationDimensions.depth / 2,
      },
      size: {
        x: stationDimensions.width,
        y: stationDimensions.height,
        z: stationDimensions.depth,
      },
    },
    materialHints: { ...input.materialHints },
  };
});

export const frontSubject = subjects[0];
export const middleSubject = subjects[1];
export const backSubject = subjects[2];

const centreFocusProbes = subjects.map((subject) => subject.focusDetailProbeWorld) as [
  ShelfSwingVec3,
  ShelfSwingVec3,
  ShelfSwingVec3,
];

export const calibrationSolution = calibrateShelfSwing({
  focalLengthMm: 150,
  focusProbes: centreFocusProbes,
});

export const subjectPlane = calibrationSolution.subjectPlane;
export const focusProbes = subjects.map((subject) => ({
  id: subject.id,
  semanticName: subject.focusProbeSemanticName,
  worldPosition: subject.focusDetailProbeWorld,
}));
export const focusSamples = subjects.flatMap((subject) =>
  subject.focusSamples.map((sample) => ({
    focusTargetId: subject.id,
    ...sample,
  })),
);
export const focusChartSurfaces = subjects.map((subject) => ({
  focusTargetId: subject.id,
  semanticName: subject.focusChart.semanticName,
  centerWorld: subject.focusDetailProbeWorld,
  width: subject.focusChart.width,
  height: subject.focusChart.height,
  pattern: subject.focusChart.pattern,
  plane: subjectPlane,
}));

export const shelfSwingCalibration = {
  focalLengthMm: 150,
  frontRiseMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: calibrationSolution.frontSwingDeg,
  focusDistanceMm: calibrationSolution.focusDistanceMm,
  aperture: 11 as const,
  targetSharpnessMinimum: 0.8,
  swingToleranceDeg: 0.4,
  collinearityEpsilonMm: 1e-6,
  planeIntersectionToleranceMm: 1e-6,
} as const;

export const canonicalFocusDistanceMm = shelfSwingCalibration.focusDistanceMm;

export const observerCamera = {
  position: { x: -2500, y: 1850 - opticalAxisHeightAboveFloorMm, z: -450 },
  target: { x: 0, y: 520 - opticalAxisHeightAboveFloorMm, z: 3850 },
} as const;

export const focusTargets = subjects.map((subject) => ({
  id: subject.id,
  label: subject.label,
  worldPosition: subject.focusDetailProbeWorld,
  sampleWorldPositions: subject.focusSamples.map((sample) => sample.worldPosition),
  weight: 1,
}));

const getBoxCorners = (center: ShelfSwingVec3, size: ShelfSwingVec3): ShelfSwingVec3[] => {
  const corners: ShelfSwingVec3[] = [];
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

export function getFloorWorldCorners(): ShelfSwingVec3[] {
  return [
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.farZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.farZ },
  ];
}

export function getSubjectWorldBoundsCorners(
  subject: ShelfSwingSubjectDefinition,
): ShelfSwingVec3[] {
  return getBoxCorners(subject.bounds.centerLocal, subject.bounds.size).map((local) =>
    subjectLocalToWorld(subject, local),
  );
}

const boundsFromPoints = (points: ShelfSwingVec3[], paddingMm = 0) => ({
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

const stationBoundsPoints = subjects.flatMap(getSubjectWorldBoundsCorners);
export const compositionTargetBounds = boundsFromPoints(stationBoundsPoints, 100);
export const sceneBounds = boundsFromPoints(
  [
    ...getFloorWorldCorners(),
    ...stationBoundsPoints,
    ...subjects.flatMap((subject) => subject.focusSamples.map((sample) => sample.worldPosition)),
  ],
  150,
);

const canonicalFiniteValues = [
  shelfSwingCalibration.frontSwingDeg,
  shelfSwingCalibration.focusDistanceMm,
  subjectPlane.distance,
  magnitude(subjectPlane.normal),
];
if (!canonicalFiniteValues.every(Number.isFinite)) {
  throw new Error("Shelf Swing canonical geometry contains a non-finite calibration value");
}

export default {
  floor,
  detailGeometry,
  opticalAxisHeightAboveFloorMm,
  subjects,
  frontSubject,
  middleSubject,
  backSubject,
  focusChartSurfaces,
  focusProbes,
  focusSamples,
  subjectPlane,
  calibrationSolution,
  shelfSwingCalibration,
  canonicalFocusDistanceMm,
  observerCamera,
  focusTargets,
  compositionTargetBounds,
  sceneBounds,
  subjectLocalToWorld,
  getFloorWorldCorners,
  getSubjectWorldBoundsCorners,
};
