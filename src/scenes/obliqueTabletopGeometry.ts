// Canonical world-space geometry for the Oblique Tabletop foundation scene.
// Every distance and position in this module is expressed in millimetres.

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

export type ObliqueTabletopMarker = {
  id: "near-left" | "middle" | "far-right";
  label: string;
  localPosition: { x: number; z: number };
  color: string;
  worldPosition: Vec3;
  focusSampleWorldPositions: Vec3[];
};

export type ObliqueTabletopSurfaceSampleId =
  | "near-left"
  | "near-centre"
  | "near-right"
  | "middle"
  | "far-left"
  | "far-centre"
  | "far-right";

/** Non-rendering coverage samples used to evaluate the entire tabletop plane. */
export type ObliqueTabletopSurfaceSample = {
  id: ObliqueTabletopSurfaceSampleId;
  label: string;
  localPosition: { x: number; z: number };
  worldPosition: Vec3;
};

// The original PR10A plane was too close to the physical lens datum for a
// finite compound solution with the shared 150 mm lens. For a unit subject
// normal N and plane point P, the optical-axis-conjugate model requires the
// lens horizontal-normal magnitude s = f*|N_xy|/(N·P); the original plane
// yielded s ≈ 1.31, outside the unit sphere before public movement limits
// are considered. This moderate compound orientation and datum keep the
// tabletop dimensions unchanged while making both public movements useful.
const tabletopRotationXDeg = 20;
const tabletopRotationYDeg = -35;
const tabletopRotationXRad = degreesToRadians(tabletopRotationXDeg);
const tabletopRotationYRad = degreesToRadians(tabletopRotationYDeg);

export const floor = {
  center: { x: 0, y: -2050, z: 4400 },
  width: 8200,
  depth: 9000,
  nearZ: 0,
  farZ: 9000,
  color: "#e5e7eb",
} as const;

export const tabletop = {
  center: { x: 0, y: -332, z: 4550 },
  width: 2800,
  depth: 3800,
  thickness: 100,
  rotationXDeg: tabletopRotationXDeg,
  rotationYDeg: tabletopRotationYDeg,
  rotationXRad: tabletopRotationXRad,
  rotationYRad: tabletopRotationYRad,
  nearLocalDepth: -1900,
  farLocalDepth: 1900,
  color: "#c8b79f",
  edgeColor: "#8b7355",
} as const;

export const markerGeometry = {
  width: 360,
  depth: 260,
  height: 14,
  surfaceGap: 2,
  topThickness: 3,
  stripeCount: 5,
  stripeWidth: 26,
  stripeDepth: 196,
} as const;

const topSurfaceLocalY = tabletop.thickness / 2;
const markerSurfaceOffsetMm = markerGeometry.height + markerGeometry.surfaceGap;

/** Rotate a tabletop-local direction without applying the tabletop translation. */
export const tabletopLocalDirectionToWorld = (local: Vec3): Vec3 => {
  // Apply the near-to-far X tilt first, then rotate that tilted plane around
  // world Y. This explicit composition gives the surface both vertical and
  // lateral slope components; the renderer consumes the same derived basis.
  const afterX = {
    x: local.x,
    y:
      local.y * Math.cos(tabletop.rotationXRad) -
      local.z * Math.sin(tabletop.rotationXRad),
    z:
      local.y * Math.sin(tabletop.rotationXRad) +
      local.z * Math.cos(tabletop.rotationXRad),
  };
  return {
    x:
      afterX.x * Math.cos(tabletop.rotationYRad) +
      afterX.z * Math.sin(tabletop.rotationYRad),
    y: afterX.y,
    z:
      -afterX.x * Math.sin(tabletop.rotationYRad) +
      afterX.z * Math.cos(tabletop.rotationYRad),
  };
};

/** Rotate a tabletop-local point with the canonical subject transform. */
export const tabletopLocalPointToWorld = (
  local: ObliqueTabletopLocalPosition,
): Vec3 => {
  const rotated = tabletopLocalDirectionToWorld(local);
  return {
    x: tabletop.center.x + rotated.x,
    y: tabletop.center.y + rotated.y,
    z: tabletop.center.z + rotated.z,
  };
};

/** Convert a position on the tabletop surface to absolute world space. */
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
    y: topSurfaceLocalY + verticalOffsetMm,
    z: localDepth,
  });

export const tabletopTransformBasis = {
  localX: tabletopLocalDirectionToWorld({ x: 1, y: 0, z: 0 }),
  localY: tabletopLocalDirectionToWorld({ x: 0, y: 1, z: 0 }),
  localZ: tabletopLocalDirectionToWorld({ x: 0, y: 0, z: 1 }),
} as const;

export const tabletopTopSurfacePlane = {
  point: tabletopLocalToWorld({ localX: 0, localDepth: 0 }),
  normal: tabletopTransformBasis.localY,
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

const markerInputs = [
  {
    id: "near-left" as const,
    label: "Near-left tabletop marker",
    localPosition: { x: -820, z: -1250 },
    color: "#64748b",
  },
  {
    id: "middle" as const,
    label: "Middle tabletop marker",
    localPosition: { x: 0, z: 0 },
    color: "#7c3aed",
  },
  {
    id: "far-right" as const,
    label: "Far-right tabletop marker",
    localPosition: { x: 820, z: 1250 },
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

export const markers: ObliqueTabletopMarker[] = markerInputs.map((marker) => {
  const worldPosition = tabletopLocalToWorld({
    localX: marker.localPosition.x,
    localDepth: marker.localPosition.z,
    verticalOffsetMm: markerSurfaceOffsetMm,
  });
  return {
    ...marker,
    localPosition: { ...marker.localPosition },
    worldPosition,
    focusSampleWorldPositions: markerSampleOffsets.map((offset) =>
      tabletopLocalToWorld({
        localX: marker.localPosition.x + offset.x,
        localDepth: marker.localPosition.z + offset.z,
        verticalOffsetMm: markerSurfaceOffsetMm,
      }),
    ),
  };
});

// Cover the full surface instead of relying on the three approximately
// collinear visible markers. Every analytical sample is derived from the same
// tabletop-local transform and lies on the canonical top surface; the render
// factory registers matching non-rendering Object3D nodes for RTT/3D
// inspection.
const tabletopAnalyticalSurfaceSampleInputs = [
  { id: "near-left" as const, label: "Near-left tabletop surface", localPosition: { x: -1400, z: -1900 } },
  { id: "near-centre" as const, label: "Near-centre tabletop surface", localPosition: { x: 0, z: -1900 } },
  { id: "near-right" as const, label: "Near-right tabletop surface", localPosition: { x: 1400, z: -1900 } },
  { id: "middle" as const, label: "Middle tabletop surface", localPosition: { x: 0, z: 0 } },
  { id: "far-left" as const, label: "Far-left tabletop surface", localPosition: { x: -1400, z: 1900 } },
  { id: "far-centre" as const, label: "Far-centre tabletop surface", localPosition: { x: 0, z: 1900 } },
  { id: "far-right" as const, label: "Far-right tabletop surface", localPosition: { x: 1400, z: 1900 } },
] as const;

const tabletopVisibleFocusSampleInputs = [
  { id: "near-left" as const, label: "Near-left tabletop focus region", localPosition: { x: -820, z: -1250 } },
  { id: "near-centre" as const, label: "Near-centre tabletop focus region", localPosition: { x: 0, z: -1250 } },
  { id: "near-right" as const, label: "Near-right tabletop focus region", localPosition: { x: 820, z: -1250 } },
  { id: "middle" as const, label: "Middle tabletop focus region", localPosition: { x: 0, z: 0 } },
  { id: "far-left" as const, label: "Far-left tabletop focus region", localPosition: { x: -820, z: 1250 } },
  { id: "far-centre" as const, label: "Far-centre tabletop focus region", localPosition: { x: 0, z: 1250 } },
  { id: "far-right" as const, label: "Far-right tabletop focus region", localPosition: { x: 820, z: 1250 } },
] as const;

type TabletopSurfaceSampleInput = {
  id: ObliqueTabletopSurfaceSampleId;
  label: string;
  localPosition: { x: number; z: number };
};

const createTabletopSurfaceSamples = (
  inputs: readonly TabletopSurfaceSampleInput[],
): ObliqueTabletopSurfaceSample[] =>
  inputs.map((sample) => ({
    ...sample,
    localPosition: { ...sample.localPosition },
    worldPosition: tabletopLocalToWorld({
      localX: sample.localPosition.x,
      localDepth: sample.localPosition.z,
    }),
  }));

/** Full-surface analytical coverage retained for physical regression proof. */
export const tabletopAnalyticalSurfaceSamples: ObliqueTabletopSurfaceSample[] =
  createTabletopSurfaceSamples(tabletopAnalyticalSurfaceSampleInputs);

/** Film-visible learner coverage, derived from the same canonical transform. */
export const tabletopVisibleFocusSamples: ObliqueTabletopSurfaceSample[] =
  createTabletopSurfaceSamples(tabletopVisibleFocusSampleInputs);

export const tabletopPrincipalDepthSampleIds = [
  "near-centre",
  "middle",
  "far-centre",
] as const satisfies readonly ObliqueTabletopSurfaceSampleId[];

export const tabletopOffAxisSampleIds = [
  "near-left",
  "near-right",
  "far-left",
  "far-right",
] as const satisfies readonly ObliqueTabletopSurfaceSampleId[];

export const tabletopAnalyticalFocusTargets: FocusTarget[] = tabletopAnalyticalSurfaceSamples.map((sample) => ({
  id: sample.id,
  label: sample.label,
  worldPosition: sample.worldPosition,
  weight: 1,
}));

/** Live optics/readout targets stay within the physical Ground Glass footprint. */
export const tabletopVisibleFocusTargets: FocusTarget[] = tabletopVisibleFocusSamples.map((sample) => ({
  id: sample.id,
  label: sample.label,
  worldPosition: sample.worldPosition,
  weight: 1,
}));

export const focusTargets: FocusTarget[] = tabletopVisibleFocusTargets;

/**
 * Public-step evidence state for the intentionally incomplete Tilt slice.
 * The negative sign follows the shared Front Tilt convention and aligns the
 * principal near-to-far sample axis. Focus is independently refined at the
 * public 10 mm step; the state intentionally leaves the lateral samples soft.
 */
export const tiltOnlyCalibration = {
  frontTiltDeg: -4.9,
  focusDistanceMm: 3310,
  aperture: 11 as const,
} as const;

export const middleMarker = markers.find((marker) => marker.id === "middle")!;

/** Neutral focus is aligned to the middle marker on the canonical tabletop. */
export const canonicalFocusDistanceMm = roundToStep(
  middleMarker.worldPosition.z,
  CAMERA_CONTROL_STEPS.focusDistanceMm,
);

const supportLocalPositions = [
  { id: "near-left", x: -1120, z: -1450 },
  { id: "near-right", x: 1120, z: -1450 },
  { id: "far-left", x: -1120, z: 1450 },
  { id: "far-right", x: 1120, z: 1450 },
] as const;

export const tableSupports = supportLocalPositions.map((support) => {
  const topWorld = tabletopLocalPointToWorld({
    x: support.x,
    y: -tabletop.thickness / 2,
    z: support.z,
  });
  const height = topWorld.y - floor.center.y;
  return {
    ...support,
    width: 110,
    depth: 110,
    height,
    center: {
      x: topWorld.x,
      y: floor.center.y + height / 2,
      z: topWorld.z,
    },
    color: "#6b7280",
  };
});

export const observerCamera: CameraPlacement = {
  position: { x: 4300, y: 2500, z: -1500 },
  target: { x: 0, y: -650, z: 4300 },
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

export function getFloorWorldCorners(): Vec3[] {
  return [
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.nearZ },
    { x: floor.center.x - floor.width / 2, y: floor.center.y, z: floor.farZ },
    { x: floor.center.x + floor.width / 2, y: floor.center.y, z: floor.farZ },
  ];
}

const getMarkerWorldCorners = (marker: ObliqueTabletopMarker): Vec3[] =>
  getBoxCorners(
    { x: marker.localPosition.x, y: topSurfaceLocalY + markerGeometry.height / 2, z: marker.localPosition.z },
    { x: markerGeometry.width, y: markerGeometry.height, z: markerGeometry.depth },
  ).map((local) => tabletopLocalPointToWorld(local));

const topSurfaceCorners = [
  tabletopLocalToWorld({ localX: -tabletop.width / 2, localDepth: tabletop.nearLocalDepth }),
  tabletopLocalToWorld({ localX: tabletop.width / 2, localDepth: tabletop.nearLocalDepth }),
  tabletopLocalToWorld({ localX: -tabletop.width / 2, localDepth: tabletop.farLocalDepth }),
  tabletopLocalToWorld({ localX: tabletop.width / 2, localDepth: tabletop.farLocalDepth }),
];

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
  ...markers.flatMap(getMarkerWorldCorners),
];

export const sceneBounds = boundsFromPoints(allPhysicalGeometryPoints, 150);

// Keep the public focus range large enough to cover the full canonical plane,
// including analytical edge samples that are intentionally not learner targets.
const focusTargetDepths = tabletopAnalyticalSurfaceSamples.map((sample) => sample.worldPosition.z);
export const focusDistanceRangeMm = {
  // A tilted focus plane can intersect the optical axis much closer than the
  // neutral tabletop depth. The real-image floor remains enforced centrally
  // by getSceneFocusDistanceRange; this explicit lower bound keeps that
  // physically valid Tilt + Focus state publicly reachable.
  min: CAMERA_CONSTANTS.focalLengthMm + CAMERA_CONTROL_STEPS.focusDistanceMm,
  max: roundToStep(Math.max(...focusTargetDepths) + 500, CAMERA_CONTROL_STEPS.focusDistanceMm),
} as const;

export default {
  floor,
  tabletop,
  markerGeometry,
  tabletopLocalPointToWorld,
  tabletopLocalDirectionToWorld,
  tabletopLocalToWorld,
  tabletopTransformBasis,
  tabletopTopSurfacePlane,
  tabletopExtents,
  markers,
  middleMarker,
  focusTargets,
  tabletopAnalyticalFocusTargets,
  tabletopVisibleFocusTargets,
  tabletopAnalyticalSurfaceSamples,
  tabletopVisibleFocusSamples,
  tabletopPrincipalDepthSampleIds,
  tabletopOffAxisSampleIds,
  tiltOnlyCalibration,
  canonicalFocusDistanceMm,
  tableSupports,
  observerCamera,
  compositionTargetBounds,
  focusDistanceRangeMm,
  sceneBounds,
  getTabletopWorldCorners,
  getFloorWorldCorners,
};
