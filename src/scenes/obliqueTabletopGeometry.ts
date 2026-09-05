// Canonical world-space geometry for the Oblique Tabletop scene.
// All distances and positions in this module are expressed in millimetres.

import type { Bounds3, Vec3 } from "../types/optics";
import type { CameraPlacement, FocusTarget } from "../types/scene";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../utils/constants";
import { roundToStep } from "../utils/roundToStep";

const degreesToRadians = (degrees: number): number => (degrees * Math.PI) / 180;

export type ObliqueTabletopLocalPosition = {
  x: number;
  y: number;
  z: number;
};

export type ObliqueTabletopSubjectSampleId =
  | "near-left"
  | "near-centre"
  | "near-right"
  | "middle"
  | "far-left"
  | "far-centre"
  | "far-right";

export type ObliqueTabletopBoardMarker = {
  id: "near-left" | "middle" | "far-right";
  label: string;
  localPosition: { x: number; z: number };
  color: string;
  worldPosition: Vec3;
  focusSampleWorldPositions: Vec3[];
};

export type ObliqueTabletopSubjectSample = {
  id: ObliqueTabletopSubjectSampleId;
  label: string;
  localPosition: { x: number; z: number };
  worldPosition: Vec3;
};

/** The physical table is intentionally level; the inclined object is separate. */
export const tabletop = {
  center: { x: 0, y: -350, z: 4550 },
  width: 4000,
  depth: 4200,
  thickness: 100,
  nearLocalDepth: -2100,
  farLocalDepth: 2100,
  rotationXDeg: 0,
  rotationYDeg: 0,
  color: "#a98f73",
  edgeColor: "#70553b",
} as const;

export const markerGeometry = {
  width: 320,
  depth: 220,
  height: 14,
  surfaceGap: 2,
  topThickness: 3,
  stripeCount: 5,
  stripeWidth: 24,
  stripeDepth: 164,
} as const;

export const floor = {
  center: { x: 0, y: -2050, z: 4400 },
  width: 8200,
  depth: 9000,
  nearZ: 0,
  farZ: 9000,
  color: "#d7d0c6",
} as const;

const subjectBoardRotationXDeg = 15;
const subjectBoardRotationYDeg = -45;
const subjectBoardRotationXRad = degreesToRadians(subjectBoardRotationXDeg);
const subjectBoardRotationYRad = degreesToRadians(subjectBoardRotationYDeg);
const tabletopTopY = tabletop.center.y + tabletop.thickness / 2;
const subjectBoardWidthMm = 2600;
const subjectBoardDepthMm = 3000;
const subjectBoardThicknessMm = 60;

/** A drafting/copy board resting on the level table's far edge. */
export const subjectBoard = {
  center: {
    x: tabletop.center.x,
    y:
      tabletopTopY +
      (subjectBoardThicknessMm / 2) * Math.cos(subjectBoardRotationXRad) +
      (subjectBoardDepthMm / 2) * Math.sin(subjectBoardRotationXRad),
    z: tabletop.center.z,
  },
  width: subjectBoardWidthMm,
  depth: subjectBoardDepthMm,
  thickness: subjectBoardThicknessMm,
  rotationXDeg: subjectBoardRotationXDeg,
  rotationYDeg: subjectBoardRotationYDeg,
  rotationXRad: subjectBoardRotationXRad,
  rotationYRad: subjectBoardRotationYRad,
  nearLocalDepth: -1500,
  farLocalDepth: 1500,
  color: "#d7c7ad",
  edgeColor: "#6b5845",
  planLineColor: "#8f6f4e",
} as const;

const markerSurfaceOffsetMm = markerGeometry.height + markerGeometry.surfaceGap;

/** The photographed face is the side facing the level camera. */
export const subjectBoardFaceLocalY = -subjectBoard.thickness / 2;
export const subjectBoardFocusSurfaceLocalY =
  subjectBoardFaceLocalY - markerSurfaceOffsetMm;
/** Presentation details on the upper side keep the board readable in the 3D observer view. */
export const subjectBoardPresentationFaceLocalY = subjectBoard.thickness / 2;

/** Rotate a board-local direction without applying the board translation. */
export const subjectBoardLocalDirectionToWorld = (local: Vec3): Vec3 => {
  const afterX = {
    x: local.x,
    y:
      local.y * Math.cos(subjectBoard.rotationXRad) -
      local.z * Math.sin(subjectBoard.rotationXRad),
    z:
      local.y * Math.sin(subjectBoard.rotationXRad) +
      local.z * Math.cos(subjectBoard.rotationXRad),
  };

  return {
    x:
      afterX.x * Math.cos(subjectBoard.rotationYRad) +
      afterX.z * Math.sin(subjectBoard.rotationYRad),
    y: afterX.y,
    z:
      -afterX.x * Math.sin(subjectBoard.rotationYRad) +
      afterX.z * Math.cos(subjectBoard.rotationYRad),
  };
};

/** Apply the canonical inclined-board transform to an arbitrary local point. */
export const subjectBoardLocalPointToWorld = (
  local: ObliqueTabletopLocalPosition,
): Vec3 => {
  const rotated = subjectBoardLocalDirectionToWorld(local);
  return {
    x: subjectBoard.center.x + rotated.x,
    y: subjectBoard.center.y + rotated.y,
    z: subjectBoard.center.z + rotated.z,
  };
};

/** Convert a point on the board's raised focus-detail surface to world space. */
export const subjectBoardSurfaceToWorld = ({
  localX,
  localDepth,
  verticalOffsetMm = 0,
}: {
  localX: number;
  localDepth: number;
  verticalOffsetMm?: number;
}): Vec3 =>
  subjectBoardLocalPointToWorld({
    x: localX,
    y: subjectBoardFocusSurfaceLocalY + verticalOffsetMm,
    z: localDepth,
  });

/** The level table transform remains available for scene structure and bounds. */
export const tabletopLocalDirectionToWorld = (local: Vec3): Vec3 => ({ ...local });

export const tabletopLocalPointToWorld = (
  local: ObliqueTabletopLocalPosition,
): Vec3 => ({
  x: tabletop.center.x + local.x,
  y: tabletop.center.y + local.y,
  z: tabletop.center.z + local.z,
});

export const tabletopLocalToWorld = ({
  localX,
  localDepth,
  verticalOffsetMm = 0,
}: {
  localX: number;
  localDepth: number;
  verticalOffsetMm?: number;
}): Vec3 =>
  tabletopLocalPointToWorld({
    x: localX,
    y: tabletop.thickness / 2 + verticalOffsetMm,
    z: localDepth,
  });

export const subjectBoardTransformBasis = {
  localX: subjectBoardLocalDirectionToWorld({ x: 1, y: 0, z: 0 }),
  localY: subjectBoardLocalDirectionToWorld({ x: 0, y: 1, z: 0 }),
  localZ: subjectBoardLocalDirectionToWorld({ x: 0, y: 0, z: 1 }),
} as const;

export const tabletopTransformBasis = {
  localX: tabletopLocalDirectionToWorld({ x: 1, y: 0, z: 0 }),
  localY: tabletopLocalDirectionToWorld({ x: 0, y: 1, z: 0 }),
  localZ: tabletopLocalDirectionToWorld({ x: 0, y: 0, z: 1 }),
} as const;

export const tabletopTopSurfacePlane = {
  point: tabletopLocalToWorld({ localX: 0, localDepth: 0 }),
  normal: tabletopTransformBasis.localY,
} as const;

/** Plane through the visible target-detail surfaces on the inclined board. */
export const subjectBoardPlane = {
  point: subjectBoardSurfaceToWorld({ localX: 0, localDepth: 0 }),
  normal: subjectBoardTransformBasis.localY,
} as const;

export const subjectBoardFrontSurfacePlane = {
  point: subjectBoardLocalPointToWorld({
    x: 0,
    y: subjectBoardFaceLocalY,
    z: 0,
  }),
  normal: subjectBoardTransformBasis.localY,
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
  left: {
    localX: -tabletop.width / 2,
    topSurfaceCenterWorld: tabletopLocalToWorld({
      localX: -tabletop.width / 2,
      localDepth: 0,
    }),
  },
  right: {
    localX: tabletop.width / 2,
    topSurfaceCenterWorld: tabletopLocalToWorld({
      localX: tabletop.width / 2,
      localDepth: 0,
    }),
  },
} as const;

export const subjectBoardExtents = {
  near: {
    localDepth: subjectBoard.nearLocalDepth,
    surfaceCenterWorld: subjectBoardSurfaceToWorld({
      localX: 0,
      localDepth: subjectBoard.nearLocalDepth,
    }),
  },
  far: {
    localDepth: subjectBoard.farLocalDepth,
    surfaceCenterWorld: subjectBoardSurfaceToWorld({
      localX: 0,
      localDepth: subjectBoard.farLocalDepth,
    }),
  },
  left: {
    localX: -subjectBoard.width / 2,
    surfaceCenterWorld: subjectBoardSurfaceToWorld({
      localX: -subjectBoard.width / 2,
      localDepth: 0,
    }),
  },
  right: {
    localX: subjectBoard.width / 2,
    surfaceCenterWorld: subjectBoardSurfaceToWorld({
      localX: subjectBoard.width / 2,
      localDepth: 0,
    }),
  },
} as const;

const markerInputs = [
  {
    id: "near-left" as const,
    label: "Near-left plan-board marker",
    localPosition: { x: -900, z: -800 },
    color: "#64748b",
  },
  {
    id: "middle" as const,
    label: "Middle plan-board marker",
    localPosition: { x: 0, z: 0 },
    color: "#7c3aed",
  },
  {
    id: "far-right" as const,
    label: "Far-right plan-board marker",
    localPosition: { x: 900, z: 800 },
    color: "#0f766e",
  },
] as const;

const markerSampleOffsets = [
  { x: 0, z: 0 },
  { x: -markerGeometry.width * 0.28, z: 0 },
  { x: markerGeometry.width * 0.28, z: 0 },
  { x: 0, z: -markerGeometry.depth * 0.28 },
  { x: 0, z: markerGeometry.depth * 0.28 },
] as const;

export const boardMarkers: ObliqueTabletopBoardMarker[] = markerInputs.map((marker) => {
  const worldPosition = subjectBoardSurfaceToWorld({
    localX: marker.localPosition.x,
    localDepth: marker.localPosition.z,
  });
  return {
    ...marker,
    localPosition: { ...marker.localPosition },
    worldPosition,
    focusSampleWorldPositions: markerSampleOffsets.map((offset) =>
      subjectBoardSurfaceToWorld({
        localX: marker.localPosition.x + offset.x,
        localDepth: marker.localPosition.z + offset.z,
      }),
    ),
  };
});

/** Full-board validation coverage, inset only enough to avoid board-edge thickness. */
const subjectBoardAnalyticalSurfaceSampleInputs = [
  { id: "near-left" as const, label: "Near-left plan-board surface", localPosition: { x: -1250, z: -1450 } },
  { id: "near-centre" as const, label: "Near-centre plan-board surface", localPosition: { x: 0, z: -1450 } },
  { id: "near-right" as const, label: "Near-right plan-board surface", localPosition: { x: 1250, z: -1450 } },
  { id: "middle" as const, label: "Middle plan-board surface", localPosition: { x: 0, z: 0 } },
  { id: "far-left" as const, label: "Far-left plan-board surface", localPosition: { x: -1250, z: 1450 } },
  { id: "far-centre" as const, label: "Far-centre plan-board surface", localPosition: { x: 0, z: 1450 } },
  { id: "far-right" as const, label: "Far-right plan-board surface", localPosition: { x: 1250, z: 1450 } },
] as const;

/** Interior board details used as the learner-visible public focus targets. */
const subjectBoardVisibleFocusSampleInputs = [
  { id: "near-left" as const, label: "Near-left plan-board detail", localPosition: { x: -700, z: -900 } },
  { id: "near-centre" as const, label: "Near-centre plan-board detail", localPosition: { x: 0, z: -900 } },
  { id: "near-right" as const, label: "Near-right plan-board detail", localPosition: { x: 700, z: -900 } },
  { id: "middle" as const, label: "Middle plan-board detail", localPosition: { x: 0, z: 0 } },
  { id: "far-left" as const, label: "Far-left plan-board detail", localPosition: { x: -700, z: 900 } },
  { id: "far-centre" as const, label: "Far-centre plan-board detail", localPosition: { x: 0, z: 900 } },
  { id: "far-right" as const, label: "Far-right plan-board detail", localPosition: { x: 700, z: 900 } },
] as const;

type SubjectBoardSampleInput = {
  id: ObliqueTabletopSubjectSampleId;
  label: string;
  localPosition: { x: number; z: number };
};

const createSubjectBoardSamples = (
  inputs: readonly SubjectBoardSampleInput[],
): ObliqueTabletopSubjectSample[] =>
  inputs.map((sample) => ({
    ...sample,
    localPosition: { ...sample.localPosition },
    worldPosition: subjectBoardSurfaceToWorld({
      localX: sample.localPosition.x,
      localDepth: sample.localPosition.z,
    }),
  }));

/** Full-board analytical coverage used by physical regression and task criteria. */
export const subjectBoardAnalyticalSurfaceSamples = createSubjectBoardSamples(
  subjectBoardAnalyticalSurfaceSampleInputs,
);

/** Learner-visible details are derived from the same board transform and points. */
export const subjectBoardVisibleFocusSamples = createSubjectBoardSamples(
  subjectBoardVisibleFocusSampleInputs,
);

export const subjectBoardPrincipalDepthSampleIds = [
  "near-centre",
  "middle",
  "far-centre",
] as const satisfies readonly ObliqueTabletopSubjectSampleId[];

export const subjectBoardOffAxisSampleIds = [
  "near-left",
  "near-right",
  "far-left",
  "far-right",
] as const satisfies readonly ObliqueTabletopSubjectSampleId[];

export const subjectBoardAnalyticalFocusTargets: FocusTarget[] =
  subjectBoardAnalyticalSurfaceSamples.map((sample) => ({
    id: sample.id,
    label: sample.label,
    worldPosition: sample.worldPosition,
    weight: 1,
  }));

export const subjectBoardVisibleFocusTargets: FocusTarget[] =
  subjectBoardVisibleFocusSamples.map((sample) => ({
    id: sample.id,
    label: sample.label,
    worldPosition: sample.worldPosition,
    weight: 1,
  }));

export const focusTargets: FocusTarget[] = subjectBoardVisibleFocusTargets;

/** Public Tilt + Focus evidence for the intentionally incomplete first movement stage. */
export const tiltOnlyCalibration = {
  frontTiltDeg: -4.8,
  focusDistanceMm: 4020,
  aperture: 11 as const,
} as const;

export const middleBoardMarker = boardMarkers.find((marker) => marker.id === "middle")!;

/** Neutral focus is aligned to the middle visible board detail. */
export const canonicalFocusDistanceMm = roundToStep(
  middleBoardMarker.worldPosition.z,
  CAMERA_CONTROL_STEPS.focusDistanceMm,
);

const supportLocalPositions = [
  { id: "near-left", x: -1120, z: -1450 },
  { id: "near-right", x: 1120, z: -1450 },
  { id: "far-left", x: -1120, z: 1450 },
  { id: "far-right", x: 1120, z: 1450 },
] as const;

export const tableSupports = supportLocalPositions.map((support) => {
  const undersideWorld = tabletopLocalPointToWorld({
    x: support.x,
    y: -tabletop.thickness / 2,
    z: support.z,
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
    color: "#57534e",
  };
});

/** Two simple upright copy-stand supports hold the board above the level table. */
const boardSupportInputs = [
  { id: "left", localX: -500, localDepth: -450 },
  { id: "right", localX: 500, localDepth: -450 },
] as const;

export const subjectBoardSupports = boardSupportInputs.map((support) => {
  const topWorld = subjectBoardLocalPointToWorld({
    x: support.localX,
    y: -subjectBoard.thickness / 2,
    z: support.localDepth,
  });
  const height = topWorld.y - tabletopTopY;
  return {
    ...support,
    width: 70,
    depth: 70,
    height,
    center: {
      x: topWorld.x,
      y: tabletopTopY + height / 2,
      z: topWorld.z,
    },
    color: "#6b6258",
  };
});

export const observerCamera: CameraPlacement = {
  position: { x: 3600, y: 3400, z: 900 },
  target: { x: 0, y: -80, z: 4550 },
};

const getBoxCorners = (center: Vec3, size: Vec3): Vec3[] => {
  const corners: Vec3[] = [];
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

export function getTabletopWorldCorners(): Vec3[] {
  return getBoxCorners(
    { x: 0, y: 0, z: 0 },
    { x: tabletop.width, y: tabletop.thickness, z: tabletop.depth },
  ).map((local) => tabletopLocalPointToWorld(local));
}

export function getSubjectBoardWorldCorners(): Vec3[] {
  return getBoxCorners(
    { x: 0, y: 0, z: 0 },
    { x: subjectBoard.width, y: subjectBoard.thickness, z: subjectBoard.depth },
  ).map((local) => subjectBoardLocalPointToWorld(local));
}

export function getSubjectBoardFrontSurfaceCorners(): Vec3[] {
  return [
    { x: -subjectBoard.width / 2, y: subjectBoardFaceLocalY, z: subjectBoard.nearLocalDepth },
    { x: subjectBoard.width / 2, y: subjectBoardFaceLocalY, z: subjectBoard.nearLocalDepth },
    { x: -subjectBoard.width / 2, y: subjectBoardFaceLocalY, z: subjectBoard.farLocalDepth },
    { x: subjectBoard.width / 2, y: subjectBoardFaceLocalY, z: subjectBoard.farLocalDepth },
  ].map((local) => subjectBoardLocalPointToWorld(local));
}

const getBoardMarkerWorldCorners = (marker: ObliqueTabletopBoardMarker): Vec3[] =>
  getBoxCorners(
    {
      x: marker.localPosition.x,
      y: subjectBoardFaceLocalY - markerGeometry.height / 2,
      z: marker.localPosition.z,
    },
    { x: markerGeometry.width, y: markerGeometry.height, z: markerGeometry.depth },
  ).map((local) => subjectBoardLocalPointToWorld(local));

const getBoardDetailWorldCorners = (sample: ObliqueTabletopSubjectSample): Vec3[] =>
  getBoxCorners(
    {
      x: sample.localPosition.x,
      y: subjectBoardFaceLocalY - markerGeometry.height / 2,
      z: sample.localPosition.z,
    },
    { x: 250, y: markerGeometry.height, z: 170 },
  ).map((local) => subjectBoardLocalPointToWorld(local));

const boundsFromPoints = (points: Vec3[], paddingMm = 0): Bounds3 => ({
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

export const compositionTargetBounds = boundsFromPoints(
  getSubjectBoardFrontSurfaceCorners(),
  100,
);

const tableSupportCorners = tableSupports.flatMap((support) =>
  getBoxCorners(support.center, {
    x: support.width,
    y: support.height,
    z: support.depth,
  }),
);

const boardSupportCorners = subjectBoardSupports.flatMap((support) =>
  getBoxCorners(support.center, {
    x: support.width,
    y: support.height,
    z: support.depth,
  }),
);

const allPhysicalGeometryPoints = [
  ...getFloorWorldCorners(),
  ...getTabletopWorldCorners(),
  ...tableSupportCorners,
  ...getSubjectBoardWorldCorners(),
  ...boardSupportCorners,
  ...boardMarkers.flatMap(getBoardMarkerWorldCorners),
  ...subjectBoardVisibleFocusSamples.flatMap(getBoardDetailWorldCorners),
];

export const sceneBounds = boundsFromPoints(allPhysicalGeometryPoints, 150);

// Keep the public Focus range wide enough for the optical-axis intersection of
// the compound plane, while retaining the real-image minimum centrally.
const focusTargetDepths = subjectBoardAnalyticalSurfaceSamples.map(
  (sample) => sample.worldPosition.z,
);
export const focusDistanceRangeMm = {
  min: CAMERA_CONSTANTS.focalLengthMm + CAMERA_CONTROL_STEPS.focusDistanceMm,
  max: roundToStep(
    Math.max(...focusTargetDepths) + 600,
    CAMERA_CONTROL_STEPS.focusDistanceMm,
  ),
} as const;

export function getFloorWorldCorners(): Vec3[] {
  return [
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.farZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.farZ },
  ];
}

export default {
  floor,
  tabletop,
  subjectBoard,
  markerGeometry,
  tabletopLocalPointToWorld,
  tabletopLocalDirectionToWorld,
  tabletopLocalToWorld,
  tabletopTransformBasis,
  tabletopTopSurfacePlane,
  subjectBoardLocalPointToWorld,
  subjectBoardLocalDirectionToWorld,
  subjectBoardSurfaceToWorld,
  subjectBoardFaceLocalY,
  subjectBoardFocusSurfaceLocalY,
  subjectBoardPresentationFaceLocalY,
  subjectBoardTransformBasis,
  subjectBoardPlane,
  subjectBoardFrontSurfacePlane,
  tabletopExtents,
  subjectBoardExtents,
  boardMarkers,
  middleBoardMarker,
  focusTargets,
  subjectBoardAnalyticalFocusTargets,
  subjectBoardVisibleFocusTargets,
  subjectBoardAnalyticalSurfaceSamples,
  subjectBoardVisibleFocusSamples,
  subjectBoardPrincipalDepthSampleIds,
  subjectBoardOffAxisSampleIds,
  tiltOnlyCalibration,
  canonicalFocusDistanceMm,
  tableSupports,
  subjectBoardSupports,
  observerCamera,
  compositionTargetBounds,
  focusDistanceRangeMm,
  sceneBounds,
  getTabletopWorldCorners,
  getSubjectBoardWorldCorners,
  getSubjectBoardFrontSurfaceCorners,
  getFloorWorldCorners,
};
