import type { Bounds3, Vec3 } from "../types/optics";

/**
 * Canonical subject geometry for Focus Fundamentals.
 *
 * The scene is one rigid connected open-frame subject. The two focus targets
 * are details on its front and back structure; all render paths and focus
 * controls derive from this module.
 */
export const focusFundamentalsReferenceFocusDepthMm = 2000;
export const focusFundamentalsFloorYmm = -150;

export const focusFundamentalsObjectDimensionsMm = {
  width: 420,
  height: 300,
  depth: 440,
} as const;

export const focusFundamentalsObjectCenterMm: Readonly<Vec3> = {
  x: 0,
  y: focusFundamentalsFloorYmm + focusFundamentalsObjectDimensionsMm.height / 2,
  z: focusFundamentalsReferenceFocusDepthMm,
};

export const focusFundamentalsObjectRotationYDeg = 38;
export const focusFundamentalsObjectRotationYRad =
  (focusFundamentalsObjectRotationYDeg * Math.PI) / 180;

export const focusFundamentalsFrameMemberWidthMm = 52;
export const focusFundamentalsFrameDepthMm = 36;
export const focusFundamentalsBackFrameDimensionsMm = {
  width: 300,
  height: 210,
} as const;

/** Canonical connected front/back frame structure for both subject render paths. */
export const focusFundamentalsFrameGeometry = {
  memberWidthMm: focusFundamentalsFrameMemberWidthMm,
  depthMm: focusFundamentalsFrameDepthMm,
  front: {
    widthMm: focusFundamentalsObjectDimensionsMm.width,
    heightMm: focusFundamentalsObjectDimensionsMm.height,
    centerZMm:
      -focusFundamentalsObjectDimensionsMm.depth / 2 +
      focusFundamentalsFrameDepthMm / 2,
  },
  back: {
    widthMm: focusFundamentalsBackFrameDimensionsMm.width,
    heightMm: focusFundamentalsBackFrameDimensionsMm.height,
    centerZMm:
      focusFundamentalsObjectDimensionsMm.depth / 2 -
      focusFundamentalsFrameDepthMm / 2,
  },
} as const;

const frontFrameSurfaceZMm =
  focusFundamentalsFrameGeometry.front.centerZMm -
  focusFundamentalsFrameGeometry.depthMm / 2;
const backFrameFrontSurfaceZMm =
  focusFundamentalsFrameGeometry.back.centerZMm -
  focusFundamentalsFrameGeometry.depthMm / 2;

export const focusFundamentalsMarkerSizeMm = {
  width: 64,
  height: 64,
} as const;
export const focusFundamentalsMarkerOffsetMm = 2;

type FocusDetailSurface = "front" | "back";

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

/** Transform a point in the subject's local millimetre coordinates to world mm. */
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

const localXForFocusDepth = (
  focusDepthMm: number,
  localZMm: number,
): number =>
  (focusFundamentalsObjectCenterMm.z +
    cosRotationY * localZMm -
    focusDepthMm) /
  sinRotationY;

const focusDetailSpecs = [
  {
    id: "focus-near-detail",
    label: "Focus Near Detail",
    surface: "front" as const,
    focusDepthMm: 1720,
    localPositionMm: {
      x: localXForFocusDepth(1720, frontFrameSurfaceZMm),
      y: 42,
      z: frontFrameSurfaceZMm,
    },
  },
  {
    id: "focus-far-detail",
    label: "Focus Far Detail",
    surface: "back" as const,
    focusDepthMm: 2180,
    localPositionMm: {
      x: localXForFocusDepth(2180, backFrameFrontSurfaceZMm),
      y:
        -focusFundamentalsFrameGeometry.back.heightMm / 2 +
        focusFundamentalsFrameGeometry.memberWidthMm / 2,
      z: backFrameFrontSurfaceZMm,
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
): Vec3 => ({
  ...detail.localPositionMm,
  z: detail.localPositionMm.z - focusFundamentalsMarkerOffsetMm,
});

export const getFocusFundamentalsDetailMarkerRotationY = (
  detail: FocusFundamentalsFocusDetail,
): number => (detail.surface === "front" || detail.surface === "back" ? Math.PI : 0);

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
