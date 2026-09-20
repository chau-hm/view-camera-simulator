import type { Bounds3, Vec3 } from "../types/optics";
import type { FocusTarget } from "../types/scene";

/** The public-step state used to calibrate the canonical oblique subject plane. */
export const MACRO_OBLIQUE_PLANE_PUBLIC_CALIBRATION = {
  frontTiltDeg: 6.3,
  focusDistanceMm: 390,
} as const;

export const MACRO_OBLIQUE_PLANE_FOCAL_LENGTH_MM = 150;
export const MACRO_OBLIQUE_PLANE_INITIAL_FOCUS_DISTANCE_MM = 400;
export const MACRO_OBLIQUE_PLANE_FOCUS_DISTANCE_RANGE_MM = {
  min: 360,
  max: 440,
} as const;

/**
 * The subject plane is the focus plane derived at the public calibration
 * state above. These values are recorded from the canonical Scheimpflug
 * solver so geometry, focus metadata, and tests share one physical surface.
 */
export const MACRO_OBLIQUE_PLANE_SURFACE_CENTER_Z_MM = 400.1734880185999;
export const MACRO_OBLIQUE_PLANE_SURFACE_SLOPE = 0.29275174683081145;
export const MACRO_OBLIQUE_PLANE_SURFACE_ANGLE_RAD = Math.atan(
  MACRO_OBLIQUE_PLANE_SURFACE_SLOPE,
);

export const MACRO_OBLIQUE_PLANE_SURFACE_NORMAL = {
  x: 0,
  y: Math.sin(MACRO_OBLIQUE_PLANE_SURFACE_ANGLE_RAD),
  z: -Math.cos(MACRO_OBLIQUE_PLANE_SURFACE_ANGLE_RAD),
} as const;

export const MACRO_OBLIQUE_PLATE_DIMENSIONS_MM = {
  x: 112,
  y: 112,
  thickness: 2.4,
} as const;

export const MACRO_OBLIQUE_PLATE_CENTER_MM = {
  x: 0,
  y: 0,
  z: MACRO_OBLIQUE_PLANE_SURFACE_CENTER_Z_MM,
} as const;

export const MACRO_OBLIQUE_TARGET_Y_MM = [-45, 0, 45] as const;
export const MACRO_OBLIQUE_TARGET_SAMPLE_X_MM = [-34, 0, 34] as const;
export const MACRO_OBLIQUE_TARGET_SAMPLE_Y_OFFSETS_MM = [-1, 0, 1] as const;

export const macroObliquePlaneSurfaceZAtY = (yMm: number): number =>
  MACRO_OBLIQUE_PLANE_SURFACE_CENTER_Z_MM +
  MACRO_OBLIQUE_PLANE_SURFACE_SLOPE * yMm;

export const macroObliquePlaneSurfacePoint = (xMm: number, yMm: number): Vec3 => ({
  x: xMm,
  y: yMm,
  z: macroObliquePlaneSurfaceZAtY(yMm),
});

const TARGET_IDS = [
  "macro-oblique-near",
  "macro-oblique-middle",
  "macro-oblique-far",
] as const;

const TARGET_LABELS = [
  "Near planar detail",
  "Middle planar detail",
  "Far planar detail",
] as const;

/** Physical focus regions distributed along one shared oblique plane. */
export const macroObliquePlaneFocusTargets: FocusTarget[] = MACRO_OBLIQUE_TARGET_Y_MM.map(
  (yMm, index) => ({
    id: TARGET_IDS[index],
    label: TARGET_LABELS[index],
    worldPosition: macroObliquePlaneSurfacePoint(0, yMm),
    sampleWorldPositions: MACRO_OBLIQUE_TARGET_SAMPLE_Y_OFFSETS_MM.flatMap(
      (yOffsetMm) =>
        MACRO_OBLIQUE_TARGET_SAMPLE_X_MM.map((xMm) =>
          macroObliquePlaneSurfacePoint(xMm, yMm + yOffsetMm),
        ),
    ),
    weight: 1,
  }),
);

/** Bounds for the rendered plate and its shallow relief / rear support. */
export const macroObliquePlaneSubjectBoundsMm: Bounds3 = {
  min: {
    x: -62,
    y: -62,
    z: macroObliquePlaneSurfaceZAtY(-62) - 0.8,
  },
  max: {
    x: 62,
    y: 62,
    z: macroObliquePlaneSurfaceZAtY(62) + MACRO_OBLIQUE_PLATE_DIMENSIONS_MM.thickness + 2.8,
  },
};

/** Includes the close-focus camera assembly, support rail, and subject. */
export const macroObliquePlaneSceneBoundsMm: Bounds3 = {
  min: { x: -240, y: -230, z: -360 },
  max: { x: 240, y: 220, z: 450 },
};

export const macroObliquePlaneCameraPlacement = {
  position: { x: -280, y: 150, z: -220 },
  target: { x: 0, y: 0, z: 300 },
} as const;

export const macroObliquePlaneCompositionTargetBounds: Bounds3 = {
  min: { x: -56, y: -56, z: macroObliquePlaneSurfaceZAtY(-56) },
  max: { x: 56, y: 56, z: macroObliquePlaneSurfaceZAtY(56) },
};
