// Canonical geometry for the Interior Corner — Rise + Swing foundation scene.
// All positions and dimensions are millimetres. The lens datum is (0, 0, 0),
// the optical axis points toward +Z, and Y is up.

import type { Bounds3, Vec3 } from "../types/optics";
import type { CameraPlacement, FocusTarget } from "../types/scene";

const floorY = -1400;
const ceilingY = 4200;
const backWallZ = 11000;
const sideWallX = 2500;
const wallThickness = 180;
const roomWidth = 5600;
const roomDepth = backWallZ - 1400;
const roomHeight = ceilingY - floorY;

export const room = {
  floorY,
  ceilingY,
  backWallZ,
  sideWallX,
  wallThickness,
  width: roomWidth,
  depth: roomDepth,
  height: roomHeight,
  nearZ: 1400,
  farZ: backWallZ,
  interiorBackSurfaceZ: backWallZ - wallThickness / 2,
  interiorSideSurfaceX: sideWallX - wallThickness / 2,
} as const;

export type InteriorCornerWallDetail = {
  id: "interior-wall-near" | "interior-wall-middle" | "interior-wall-far";
  label: string;
  z: number;
  y: number;
  width: number;
  height: number;
};

export const wallDetails: readonly InteriorCornerWallDetail[] = [
  {
    id: "interior-wall-near",
    label: "Near receding-wall detail",
    z: 5800,
    y: 1850,
    width: 620,
    height: 820,
  },
  {
    id: "interior-wall-middle",
    label: "Middle receding-wall detail",
    z: 8000,
    y: 1850,
    width: 560,
    height: 760,
  },
  {
    id: "interior-wall-far",
    label: "Far receding-wall detail",
    z: 10400,
    y: 1850,
    width: 500,
    height: 700,
  },
] as const;

const focusSurfaceOffsetMm = 18;

const wallFocusTarget = (detail: InteriorCornerWallDetail): FocusTarget => {
  const worldPosition = {
    x: room.interiorSideSurfaceX - focusSurfaceOffsetMm,
    y: detail.y,
    z: detail.z,
  };

  return {
    id: detail.id,
    label: detail.label,
    worldPosition,
    sampleWorldPositions: [
      worldPosition,
      { ...worldPosition, y: detail.y - detail.height * 0.34 },
      { ...worldPosition, y: detail.y + detail.height * 0.34 },
      { ...worldPosition, z: detail.z - detail.width * 0.34 },
      { ...worldPosition, z: detail.z + detail.width * 0.34 },
    ],
    weight: 1,
  };
};

/** Stable near/middle/far anchors on one vertical side-wall plane. */
export const focusTargets: FocusTarget[] = wallDetails.map(wallFocusTarget);

export const canonicalFocusDistanceMm = wallDetails[1].z;

export const focusDistanceRangeMm = {
  min: 4000,
  max: room.farZ + 300,
} as const;

export const compositionTargets = {
  upperArchitecture: {
    min: {
      x: -room.width / 2,
      y: ceilingY - 700,
      z: room.nearZ,
    },
    max: {
      x: room.sideWallX + 80,
      y: ceilingY + 100,
      z: room.farZ + 80,
    },
  },
  roomCorner: {
    min: {
      x: room.sideWallX - 140,
      y: floorY,
      z: room.backWallZ - 160,
    },
    max: {
      x: room.sideWallX + 140,
      y: ceilingY + 120,
      z: room.backWallZ + 160,
    },
  },
  recedingWall: {
    min: {
      x: room.interiorSideSurfaceX - 40,
      y: floorY,
      z: room.nearZ,
    },
    max: {
      x: room.interiorSideSurfaceX + 40,
      y: ceilingY,
      z: room.farZ,
    },
  },
} as const;

export const sceneBounds: Bounds3 = {
  min: {
    x: -room.width / 2 - 80,
    y: floorY - 40,
    z: room.nearZ - 80,
  },
  max: {
    x: room.sideWallX + wallThickness / 2 + 80,
    y: ceilingY + 120,
    z: room.backWallZ + wallThickness / 2 + 80,
  },
};

export const observerCamera: CameraPlacement = {
  position: { x: -6600, y: 2900, z: -5600 },
  target: { x: 450, y: 850, z: 6700 },
};

export const upperArchitectureFocusPoint: Vec3 = {
  x: 200,
  y: ceilingY - 250,
  z: 8200,
};

export default {
  room,
  wallDetails,
  focusTargets,
  canonicalFocusDistanceMm,
  focusDistanceRangeMm,
  compositionTargets,
  sceneBounds,
  observerCamera,
  upperArchitectureFocusPoint,
};
