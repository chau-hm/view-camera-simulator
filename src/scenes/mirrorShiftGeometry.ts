import type { Bounds3, Vec3 } from "../types/optics";

export type MirrorShiftPlane = {
  point: Vec3;
  normal: Vec3;
};

export type MirrorShiftProp = {
  id: "tall-marker" | "round-stool";
  label: string;
  shape: "box" | "cylinder";
  position: Vec3;
  dimensions: Vec3;
  color: string;
};

const MIRROR_PLANE_Z_MM = 4200;

export const mirrorShiftMirrorPlane: MirrorShiftPlane = {
  point: { x: 0, y: 0, z: MIRROR_PLANE_Z_MM },
  normal: { x: 0, y: 0, z: 1 },
};

/** Reflect a point across a plane while preserving the plane's parallel coordinates. */
export const reflectPointAcrossMirrorPlane = (
  point: Vec3,
  plane: MirrorShiftPlane = mirrorShiftMirrorPlane,
): Vec3 => {
  const normalLength = Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z);
  if (!Number.isFinite(normalLength) || normalLength <= 0) {
    throw new Error("Mirror Shift reflection requires a non-zero plane normal");
  }

  const normal = {
    x: plane.normal.x / normalLength,
    y: plane.normal.y / normalLength,
    z: plane.normal.z / normalLength,
  };
  const offset = {
    x: point.x - plane.point.x,
    y: point.y - plane.point.y,
    z: point.z - plane.point.z,
  };
  const signedDistance = offset.x * normal.x + offset.y * normal.y + offset.z * normal.z;

  return {
    x: point.x - 2 * signedDistance * normal.x,
    y: point.y - 2 * signedDistance * normal.y,
    z: point.z - 2 * signedDistance * normal.z,
  };
};

const mirrorCenter = { x: 0, y: 200, z: MIRROR_PLANE_Z_MM } as const;
const mirrorWidthMm = 3200;
const mirrorHeightMm = 2600;
const mirrorFrameMm = 70;
const floorY = -1200;
const wallWidthMm = 5800;
const wallTopY = 1800;

export type MirrorShiftCameraAnchorSet = {
  frontStandardCenter: Vec3;
  rearStandardCenter: Vec3;
  tripodHead: Vec3;
  leftTripodFoot: Vec3;
  rightTripodFoot: Vec3;
};

const neutralCameraAnchors: MirrorShiftCameraAnchorSet = {
  frontStandardCenter: { x: 0, y: 0, z: 0 },
  rearStandardCenter: { x: 0, y: 0, z: -160 },
  tripodHead: { x: 0, y: -180, z: -80 },
  leftTripodFoot: { x: -260, y: -1040, z: -20 },
  rightTripodFoot: { x: 260, y: -1040, z: -20 },
};

const translateAnchor = (anchor: Vec3, translation: Vec3): Vec3 => ({
  x: anchor.x + translation.x,
  y: anchor.y + translation.y,
  z: anchor.z + translation.z,
});

/** Translate the neutral camera anchors, then derive their virtual counterparts from the mirror plane. */
export const resolveMirrorShiftCameraAnchors = (
  rigTranslation: Vec3 = { x: 0, y: 0, z: 0 },
): {
  real: MirrorShiftCameraAnchorSet;
  reflected: MirrorShiftCameraAnchorSet;
} => {
  const real: MirrorShiftCameraAnchorSet = {
    frontStandardCenter: translateAnchor(
      neutralCameraAnchors.frontStandardCenter,
      rigTranslation,
    ),
    rearStandardCenter: translateAnchor(
      neutralCameraAnchors.rearStandardCenter,
      rigTranslation,
    ),
    tripodHead: translateAnchor(neutralCameraAnchors.tripodHead, rigTranslation),
    leftTripodFoot: translateAnchor(
      neutralCameraAnchors.leftTripodFoot,
      rigTranslation,
    ),
    rightTripodFoot: translateAnchor(
      neutralCameraAnchors.rightTripodFoot,
      rigTranslation,
    ),
  };

  return {
    real,
    reflected: {
      frontStandardCenter: reflectPointAcrossMirrorPlane(real.frontStandardCenter),
      rearStandardCenter: reflectPointAcrossMirrorPlane(real.rearStandardCenter),
      tripodHead: reflectPointAcrossMirrorPlane(real.tripodHead),
      leftTripodFoot: reflectPointAcrossMirrorPlane(real.leftTripodFoot),
      rightTripodFoot: reflectPointAcrossMirrorPlane(real.rightTripodFoot),
    },
  };
};

const reflectedCameraAnchors = resolveMirrorShiftCameraAnchors().reflected;

const props: readonly MirrorShiftProp[] = [
  {
    id: "tall-marker",
    label: "Tall marker",
    shape: "box",
    position: { x: -900, y: floorY + 750, z: 2400 },
    dimensions: { x: 320, y: 1500, z: 320 },
    color: "#2563eb",
  },
  {
    id: "round-stool",
    label: "Round stool",
    shape: "cylinder",
    position: { x: 850, y: floorY + 350, z: 3100 },
    dimensions: { x: 340, y: 700, z: 340 },
    color: "#f59e0b",
  },
];

const reflectedProps = props.map((prop) => ({
  ...prop,
  position: reflectPointAcrossMirrorPlane(prop.position),
})) as readonly MirrorShiftProp[];

export const mirrorShiftGeometry = {
  mirror: {
    center: mirrorCenter,
    plane: mirrorShiftMirrorPlane,
    widthMm: mirrorWidthMm,
    heightMm: mirrorHeightMm,
    frameMm: mirrorFrameMm,
    innerBounds: {
      min: {
        x: -mirrorWidthMm / 2,
        y: mirrorCenter.y - mirrorHeightMm / 2,
        z: MIRROR_PLANE_Z_MM,
      },
      max: {
        x: mirrorWidthMm / 2,
        y: mirrorCenter.y + mirrorHeightMm / 2,
        z: MIRROR_PLANE_Z_MM,
      },
    },
  },
  wall: {
    widthMm: wallWidthMm,
    sidePanelWidthMm: (wallWidthMm - mirrorWidthMm - mirrorFrameMm * 2) / 2,
    heightMm: wallTopY - floorY,
    centerY: (wallTopY + floorY) / 2,
    topPanelHeightMm: wallTopY - (mirrorCenter.y + mirrorHeightMm / 2 + mirrorFrameMm),
    topPanelCenterY: (wallTopY + mirrorCenter.y + mirrorHeightMm / 2 + mirrorFrameMm) / 2,
  },
  floor: {
    y: floorY,
    widthMm: wallWidthMm,
    depthMm: 5200,
    centerZ: 2400,
  },
  props,
  reflectedProps,
  camera: {
    neutralAnchors: neutralCameraAnchors,
    reflectedAnchors: reflectedCameraAnchors,
    frontStandard: { widthMm: 520, heightMm: 380, depthMm: 42 },
    rearStandard: { widthMm: 460, heightMm: 320, depthMm: 36 },
    bellows: { widthMm: 420, heightMm: 300 },
    lens: { radiusMm: 82, depthMm: 100 },
    tripod: { legWidthMm: 34, legDepthMm: 34 },
  },
  sceneBounds: {
    min: { x: -3200, y: floorY - 80, z: -700 },
    max: { x: 3200, y: wallTopY + 80, z: 9000 },
  } satisfies Bounds3,
} as const;
