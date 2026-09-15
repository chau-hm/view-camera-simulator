import type { Bounds3, Vec3 } from "../types/optics";
import type { FocusTarget } from "../types/scene";

/** Shared physical placement for the three-dimensional precision specimen. */
export const MACRO_DEPTH_SPECIMEN_CENTER_MM = {
  x: 0,
  y: 0,
  z: 400,
} as const;

export const MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM = {
  min: 360,
  max: 440,
} as const;

export const MACRO_DEPTH_INITIAL_FOCUS_DISTANCE_MM = 400;

export const MACRO_DEPTH_BRIDGE_DIMENSIONS_MM = {
  x: 104,
  y: 5,
  z: 4,
} as const;

export const MACRO_DEPTH_BRIDGE_CENTER_MM = {
  x: 0,
  y: 5,
  z: 416,
} as const;

export const MACRO_DEPTH_FRONT_LIP_DIMENSIONS_MM = {
  x: 98,
  y: 2.2,
  z: 3,
} as const;

export const MACRO_DEPTH_FRONT_LIP_CENTER_MM = {
  x: 0,
  y: 2,
  z: 419,
} as const;

/** The first lens-facing surface of each station's flat detail plate. */
export const MACRO_DEPTH_FOCUS_ZONE_SPECS = [
  {
    id: "macro-depth-near",
    label: "Near precision detail",
    centerMm: { x: -40, y: 5, z: 390 },
    surfaceZMm: 390,
    sampleOffsetsMm: [
      { x: -1.8, y: -1.1 },
      { x: 1.7, y: -1.4 },
      { x: -1.2, y: 1.6 },
      { x: 2.2, y: 1.4 },
    ],
  },
  {
    id: "macro-depth-middle",
    label: "Middle precision detail",
    centerMm: { x: 0, y: 5, z: 400 },
    surfaceZMm: 400,
    sampleOffsetsMm: [
      { x: -1.8, y: -1.1 },
      { x: 1.7, y: -1.4 },
      { x: -1.2, y: 1.6 },
      { x: 2.2, y: 1.4 },
    ],
  },
  {
    id: "macro-depth-far",
    label: "Far precision detail",
    centerMm: { x: 40, y: 5, z: 410 },
    surfaceZMm: 410,
    sampleOffsetsMm: [
      { x: -1.8, y: -1.1 },
      { x: 1.7, y: -1.4 },
      { x: -1.2, y: 1.6 },
      { x: 2.2, y: 1.4 },
    ],
  },
] as const;

const translateSample = (
  center: Vec3,
  surfaceZMm: number,
  offset: { x: number; y: number },
): Vec3 => ({
  x: center.x + offset.x,
  y: center.y + offset.y,
  z: surfaceZMm,
});

/** Physical focus targets consumed by the canonical sharpness pipeline. */
export const macroDepthOfFieldFocusTargets: FocusTarget[] =
  MACRO_DEPTH_FOCUS_ZONE_SPECS.map((zone) => ({
    id: zone.id,
    label: zone.label,
    worldPosition: { ...zone.centerMm },
    sampleWorldPositions: zone.sampleOffsetsMm.map((offset) =>
      translateSample(zone.centerMm, zone.surfaceZMm, offset),
    ),
    weight: 1,
  }));

export const MACRO_DEPTH_STATION_BODY_RADIUS_MM = 12;
export const MACRO_DEPTH_STATION_BODY_DEPTH_MM = 4;
export const MACRO_DEPTH_STATION_BODY_CENTER_OFFSET_MM = 3;
export const MACRO_DEPTH_STATION_SUPPORT_DIMENSIONS_MM = {
  x: 6,
  y: 6,
} as const;
export const MACRO_DEPTH_STATION_SUPPORT_OVERLAP_MM = 0.5;
export const MACRO_DEPTH_STATION_FACE_RADIUS_MM = 9;
export const MACRO_DEPTH_STATION_FACE_THICKNESS_MM = 1.2;
export const MACRO_DEPTH_STATION_OUTER_RING_RADIUS_MM = 7;
export const MACRO_DEPTH_STATION_OUTER_RING_TUBE_MM = 0.35;
export const MACRO_DEPTH_STATION_INNER_RING_RADIUS_MM = 4.1;
export const MACRO_DEPTH_STATION_INNER_RING_TUBE_MM = 0.28;

export const MACRO_DEPTH_BASE_DIMENSIONS_MM = {
  x: 104,
  y: 24,
  z: 8,
} as const;

export const MACRO_DEPTH_BASE_CENTER_MM = {
  x: 0,
  y: -10,
  z: 424,
} as const;

export const macroDepthOfFieldSubjectBoundsMm: Bounds3 = {
  min: { x: -54, y: -24, z: 389 },
  max: { x: 54, y: 20, z: 429 },
};

/** Includes the close-focus camera assembly, support rail, and specimen. */
export const macroDepthOfFieldSceneBoundsMm: Bounds3 = {
  min: { x: -240, y: -230, z: -360 },
  max: { x: 240, y: 220, z: 440 },
};

export const macroDepthOfFieldCameraPlacement = {
  position: { x: -220, y: 130, z: -500 },
  target: { x: 0, y: 30, z: 260 },
};
