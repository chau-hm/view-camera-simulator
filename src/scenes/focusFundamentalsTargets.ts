import type { Bounds3, Vec3 } from "../types/optics";

/**
 * Canonical subject geometry for Focus Fundamentals.
 *
 * The scene is one rigid block.  The two focus targets are surface details on
 * that block; all render paths and focus controls derive from this module.
 */
export const focusFundamentalsReferenceFocusDepthMm = 2000;
export const focusFundamentalsFloorYmm = -150;

export const focusFundamentalsObjectCenterMm: Readonly<Vec3> = {
  x: 0,
  y: focusFundamentalsFloorYmm + 190,
  z: focusFundamentalsReferenceFocusDepthMm,
};

export const focusFundamentalsObjectDimensionsMm = {
  width: 520,
  height: 380,
  depth: 560,
} as const;

export const focusFundamentalsObjectRotationYDeg = 18;
export const focusFundamentalsObjectRotationYRad =
  (focusFundamentalsObjectRotationYDeg * Math.PI) / 180;

export const focusFundamentalsMarkerSizeMm = {
  width: 100,
  height: 100,
} as const;
export const focusFundamentalsMarkerOffsetMm = 2;

type FocusDetailSurface = "front" | "right";

export type FocusFundamentalsFocusDetail = {
  id: string;
  label: string;
  surface: FocusDetailSurface;
  focusDepthMm: number;
  localPositionMm: Vec3;
  worldPositionMm: Vec3;
};

const sinRotationY = Math.sin(focusFundamentalsObjectRotationYRad);
const cosRotationY = Math.cos(focusFundamentalsObjectRotationYRad);
const halfObjectWidthMm = focusFundamentalsObjectDimensionsMm.width / 2;
const halfObjectHeightMm = focusFundamentalsObjectDimensionsMm.height / 2;
const halfObjectDepthMm = focusFundamentalsObjectDimensionsMm.depth / 2;

/** Transform a point in the block's local millimetre coordinates to world mm. */
export const transformFocusFundamentalsLocalPointToWorld = (
  localPositionMm: Vec3,
): Vec3 => ({
  x:
    focusFundamentalsObjectCenterMm.x +
    cosRotationY * localPositionMm.x +
    sinRotationY * localPositionMm.z,
  y: focusFundamentalsObjectCenterMm.y + localPositionMm.y,
  z:
    focusFundamentalsObjectCenterMm.z +
    -sinRotationY * localPositionMm.x +
    cosRotationY * localPositionMm.z,
});

const localXForFrontDepth = (focusDepthMm: number): number =>
  (focusFundamentalsObjectCenterMm.z -
    cosRotationY * halfObjectDepthMm -
    focusDepthMm) /
  sinRotationY;

const localZForRightDepth = (focusDepthMm: number): number =>
  (focusDepthMm -
    focusFundamentalsObjectCenterMm.z +
    sinRotationY * halfObjectWidthMm) /
  cosRotationY;

const focusDetailSpecs = [
  {
    id: "focus-near-detail",
    label: "Focus Near Detail",
    surface: "front" as const,
    focusDepthMm: 1720,
    localPositionMm: {
      x: localXForFrontDepth(1720),
      y: 50,
      z: -halfObjectDepthMm,
    },
  },
  {
    id: "focus-far-detail",
    label: "Focus Far Detail",
    surface: "right" as const,
    focusDepthMm: 2180,
    localPositionMm: {
      x: halfObjectWidthMm,
      y: 50,
      z: localZForRightDepth(2180),
    },
  },
] as const;

export const focusFundamentalsFocusDetails: readonly FocusFundamentalsFocusDetail[] =
  focusDetailSpecs.map((detail) => ({
    ...detail,
    localPositionMm: { ...detail.localPositionMm },
    worldPositionMm: transformFocusFundamentalsLocalPointToWorld(
      detail.localPositionMm,
    ),
  }));

export const getFocusFundamentalsDetailMarkerLocalPosition = (
  detail: FocusFundamentalsFocusDetail,
): Vec3 =>
  detail.surface === "front"
    ? {
        ...detail.localPositionMm,
        z: detail.localPositionMm.z - focusFundamentalsMarkerOffsetMm,
      }
    : {
        ...detail.localPositionMm,
        x: detail.localPositionMm.x + focusFundamentalsMarkerOffsetMm,
      };

export const getFocusFundamentalsDetailMarkerRotationY = (
  detail: FocusFundamentalsFocusDetail,
): number => (detail.surface === "front" ? Math.PI : Math.PI / 2);

const objectCornersLocalMm: Vec3[] = [
  { x: -halfObjectWidthMm, y: -halfObjectHeightMm, z: -halfObjectDepthMm },
  { x: halfObjectWidthMm, y: -halfObjectHeightMm, z: -halfObjectDepthMm },
  { x: -halfObjectWidthMm, y: halfObjectHeightMm, z: -halfObjectDepthMm },
  { x: halfObjectWidthMm, y: halfObjectHeightMm, z: -halfObjectDepthMm },
  { x: -halfObjectWidthMm, y: -halfObjectHeightMm, z: halfObjectDepthMm },
  { x: halfObjectWidthMm, y: -halfObjectHeightMm, z: halfObjectDepthMm },
  { x: -halfObjectWidthMm, y: halfObjectHeightMm, z: halfObjectDepthMm },
  { x: halfObjectWidthMm, y: halfObjectHeightMm, z: halfObjectDepthMm },
];

const objectCornerWorldMm = objectCornersLocalMm.map(
  transformFocusFundamentalsLocalPointToWorld,
);

export const focusFundamentalsObjectBoundsMm: Bounds3 = {
  min: {
    x: Math.min(...objectCornerWorldMm.map((point) => point.x)),
    y: Math.min(...objectCornerWorldMm.map((point) => point.y)),
    z: Math.min(...objectCornerWorldMm.map((point) => point.z)),
  },
  max: {
    x: Math.max(...objectCornerWorldMm.map((point) => point.x)),
    y: Math.max(...objectCornerWorldMm.map((point) => point.y)),
    z: Math.max(...objectCornerWorldMm.map((point) => point.z)),
  },
};

/** Camera/clip bounds include a modest teaching margin around the block. */
export const focusFundamentalsSceneBoundsMm: Bounds3 = {
  min: { x: -500, y: -200, z: 1500 },
  max: { x: 500, y: 300, z: 2500 },
};

// IDs are intentionally descriptive now; the previous compatibility IDs were
// not public API and no longer describe the subject.
export const focusTargetsDefs = focusFundamentalsFocusDetails.map((detail) => ({
  id: detail.id,
  label: detail.label,
  worldPosition: detail.worldPositionMm,
  weight: 1,
  focusReferenceDepthFromRearDatumMm: detail.focusDepthMm,
}));
