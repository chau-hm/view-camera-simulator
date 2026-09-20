import type { Bounds3, Plane, Vec3 } from "../types/optics";
import type { FocusTarget } from "../types/scene";
import { planeFromPointNormal } from "../core/math/plane";
import { cross, safeNormalize } from "../core/math/vec";
import { calibrateCompoundFocusPlane } from "../core/optics/calibrateCompoundFocusPlane";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../utils/constants";

export const MACRO_COMPOUND_MOVEMENTS_ID = "macro-compound-movements" as const;
export const MACRO_COMPOUND_MOVEMENTS_FOCAL_LENGTH_MM = 150;
export const MACRO_COMPOUND_MOVEMENTS_APERTURE = 5.6 as const;
export const MACRO_COMPOUND_MOVEMENTS_INITIAL_FOCUS_DISTANCE_MM = 500;
export const MACRO_COMPOUND_MOVEMENTS_FOCUS_DISTANCE_RANGE_MM = {
  min: 450,
  max: 540,
} as const;

/** A shallow compound surface: z varies with both lateral x and vertical y. */
export const MACRO_COMPOUND_MOVEMENTS_PLANE_ORIGIN_MM = {
  x: 0,
  y: 0,
  z: 498.14661051623375,
} as const;
// Derived from the exact public 3.4° Tilt, -2.8° Swing, 490 mm Focus
// lattice state under the existing 150 mm optical-axis-conjugate model.
export const MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_X = 0.16194343073108916;
export const MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_Y = 0.196955126525832;

export const macroCompoundMovementsPlaneZAt = (xMm: number, yMm: number): number =>
  MACRO_COMPOUND_MOVEMENTS_PLANE_ORIGIN_MM.z +
  MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_X * xMm +
  MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_Y * yMm;

export const macroCompoundMovementsCanonicalPlane: Plane = planeFromPointNormal(
  MACRO_COMPOUND_MOVEMENTS_PLANE_ORIGIN_MM,
  {
    x: -MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_X,
    y: -MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_Y,
    z: 1,
  },
);

/** Stable tangent frame used by every critical face and physical focus probe. */
export const macroCompoundMovementsPlaneBasis = {
  u: safeNormalize(
    {
      x: 1,
      y: 0,
      z: MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_X,
    },
    { x: 1, y: 0, z: 0 },
  ),
  v: safeNormalize(
    cross(
      macroCompoundMovementsCanonicalPlane.normal,
      safeNormalize(
        {
          x: 1,
          y: 0,
          z: MACRO_COMPOUND_MOVEMENTS_PLANE_SLOPE_X,
        },
        { x: 1, y: 0, z: 0 },
      ),
    ),
    { x: 0, y: 1, z: 0 },
  ),
  normal: macroCompoundMovementsCanonicalPlane.normal,
} as const;

export const macroCompoundMovementsPlanePoint = (xMm: number, yMm: number): Vec3 => ({
  x: xMm,
  y: yMm,
  z: macroCompoundMovementsPlaneZAt(xMm, yMm),
});

export const macroCompoundMovementsPointOnFace = (
  centerMm: Vec3,
  localUmm: number,
  localVmm: number,
): Vec3 => ({
  x:
    centerMm.x +
    macroCompoundMovementsPlaneBasis.u.x * localUmm +
    macroCompoundMovementsPlaneBasis.v.x * localVmm,
  y:
    centerMm.y +
    macroCompoundMovementsPlaneBasis.u.y * localUmm +
    macroCompoundMovementsPlaneBasis.v.y * localVmm,
  z:
    centerMm.z +
    macroCompoundMovementsPlaneBasis.u.z * localUmm +
    macroCompoundMovementsPlaneBasis.v.z * localVmm,
});

export type MacroCompoundStationId = "near-left" | "centre" | "far-right";
export type MacroCompoundStationKind = "gear-scale" | "concentric-target" | "fine-array";

export type MacroCompoundStationSpec = {
  id: MacroCompoundStationId;
  targetId: `macro-compound-${MacroCompoundStationId}`;
  label: string;
  kind: MacroCompoundStationKind;
  centerMm: Vec3;
  faceWidthMm: number;
  faceHeightMm: number;
  faceThicknessMm: number;
  focusAnchorLocalMm: { u: number; v: number };
  patchSampleOffsetsLocalMm: readonly { u: number; v: number }[];
};

export const macroCompoundMovementsStationSpecs: readonly MacroCompoundStationSpec[] = [
  {
    id: "near-left",
    targetId: "macro-compound-near-left",
    label: "Near-left engraved scale",
    kind: "gear-scale",
    centerMm: {
      x: -82,
      y: -28,
      z: macroCompoundMovementsPlaneZAt(-82, -28),
    },
    faceWidthMm: 48,
    faceHeightMm: 40,
    faceThicknessMm: 1.4,
    focusAnchorLocalMm: { u: 0, v: -10 },
    patchSampleOffsetsLocalMm: [
      { u: -11, v: -3 },
      { u: 0, v: -4 },
      { u: 11, v: -3 },
      { u: -10, v: 6 },
      { u: 10, v: 7 },
    ],
  },
  {
    id: "centre",
    targetId: "macro-compound-centre",
    label: "Centre concentric target",
    kind: "concentric-target",
    centerMm: {
      x: 0,
      y: 22,
      z: macroCompoundMovementsPlaneZAt(0, 22),
    },
    faceWidthMm: 48,
    faceHeightMm: 42,
    faceThicknessMm: 1.4,
    focusAnchorLocalMm: { u: 0, v: -13 },
    patchSampleOffsetsLocalMm: [
      { u: -11, v: -2 },
      { u: 0, v: -3 },
      { u: 11, v: -2 },
      { u: -10, v: 7 },
      { u: 10, v: 8 },
    ],
  },
  {
    id: "far-right",
    targetId: "macro-compound-far-right",
    label: "Far-right fine array",
    kind: "fine-array",
    centerMm: {
      x: 82,
      y: -12,
      z: macroCompoundMovementsPlaneZAt(82, -12),
    },
    faceWidthMm: 48,
    faceHeightMm: 40,
    faceThicknessMm: 1.4,
    focusAnchorLocalMm: { u: 0, v: -10 },
    patchSampleOffsetsLocalMm: [
      { u: -11, v: -3 },
      { u: 0, v: -4 },
      { u: 11, v: -3 },
      { u: -10, v: 6 },
      { u: 10, v: 7 },
    ],
  },
] as const;

export type MacroCompoundFocusFaceTransform = {
  targetId: string;
  centerMm: Vec3;
  normal: Vec3;
  basisU: Vec3;
  basisV: Vec3;
  widthMm: number;
  heightMm: number;
  thicknessMm: number;
};

export const macroCompoundMovementsFocusFaceTransforms: readonly MacroCompoundFocusFaceTransform[] =
  macroCompoundMovementsStationSpecs.map((station) => ({
    targetId: station.targetId,
    centerMm: station.centerMm,
    normal: macroCompoundMovementsPlaneBasis.normal,
    basisU: macroCompoundMovementsPlaneBasis.u,
    basisV: macroCompoundMovementsPlaneBasis.v,
    widthMm: station.faceWidthMm,
    heightMm: station.faceHeightMm,
    thicknessMm: station.faceThicknessMm,
  }));

const faceTransformFor = (station: MacroCompoundStationSpec): MacroCompoundFocusFaceTransform =>
  macroCompoundMovementsFocusFaceTransforms.find(
    (transform) => transform.targetId === station.targetId,
  )!;

export const macroCompoundMovementsFocusFaceCorners = (
  station: MacroCompoundStationSpec,
): Vec3[] => {
  const transform = faceTransformFor(station);
  return [
    macroCompoundMovementsPointOnFace(
      transform.centerMm,
      -transform.widthMm / 2,
      -transform.heightMm / 2,
    ),
    macroCompoundMovementsPointOnFace(
      transform.centerMm,
      transform.widthMm / 2,
      -transform.heightMm / 2,
    ),
    macroCompoundMovementsPointOnFace(
      transform.centerMm,
      transform.widthMm / 2,
      transform.heightMm / 2,
    ),
    macroCompoundMovementsPointOnFace(
      transform.centerMm,
      -transform.widthMm / 2,
      transform.heightMm / 2,
    ),
  ];
};

const boundsFromPoints = (points: readonly Vec3[]): Bounds3 => ({
  min: {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
    z: Math.min(...points.map((point) => point.z)),
  },
  max: {
    x: Math.max(...points.map((point) => point.x)),
    y: Math.max(...points.map((point) => point.y)),
    z: Math.max(...points.map((point) => point.z)),
  },
});

export const macroCompoundMovementsFocusTargets: FocusTarget[] =
  macroCompoundMovementsStationSpecs.map((station) => {
    const focusAnchor = macroCompoundMovementsPointOnFace(
      station.centerMm,
      station.focusAnchorLocalMm.u,
      station.focusAnchorLocalMm.v,
    );
    return {
      id: station.targetId,
      label: station.label,
      worldPosition: focusAnchor,
      sampleWorldPositions: station.patchSampleOffsetsLocalMm.map((offset) =>
        macroCompoundMovementsPointOnFace(
          station.centerMm,
          station.focusAnchorLocalMm.u + offset.u,
          station.focusAnchorLocalMm.v + offset.v,
        ),
      ),
      weight: 1,
    };
  });

export const macroCompoundMovementsSubjectBoundsMm: Bounds3 = {
  min: { x: -125, y: -90, z: 460 },
  max: { x: 125, y: 52, z: 540 },
};

const macroCompoundMovementsCriticalFaceCorners = macroCompoundMovementsStationSpecs.flatMap(
  macroCompoundMovementsFocusFaceCorners,
);

export const macroCompoundMovementsCompositionTargetBounds: Bounds3 = boundsFromPoints(
  macroCompoundMovementsCriticalFaceCorners,
);

export const macroCompoundMovementsSceneBoundsMm: Bounds3 = {
  min: { x: -300, y: -240, z: -360 },
  max: { x: 300, y: 240, z: 600 },
};

export const macroCompoundMovementsCameraPlacement = {
  position: { x: -285, y: 150, z: -300 },
  target: { x: 0, y: -4, z: 270 },
} as const;

const calibration = calibrateCompoundFocusPlane({
  focalLengthMm: MACRO_COMPOUND_MOVEMENTS_FOCAL_LENGTH_MM,
  subjectPlane: macroCompoundMovementsCanonicalPlane,
  tiltRangeDeg: {
    min: CAMERA_CONSTANTS.tiltMinDeg,
    max: CAMERA_CONSTANTS.tiltMaxDeg,
  },
  swingRangeDeg: {
    min: CAMERA_CONSTANTS.swingMinDeg,
    max: CAMERA_CONSTANTS.swingMaxDeg,
  },
  focusDistanceRangeMm: MACRO_COMPOUND_MOVEMENTS_FOCUS_DISTANCE_RANGE_MM,
  publicStep: {
    frontTiltDeg: CAMERA_CONTROL_STEPS.tiltDeg,
    frontSwingDeg: CAMERA_CONTROL_STEPS.swingDeg,
    focusDistanceMm: CAMERA_CONTROL_STEPS.focusDistanceMm,
  },
  label: "Macro Compound Movements",
});

export const macroCompoundMovementsContinuousCalibration = calibration.continuous;
export const macroCompoundMovementsPublicCalibration = {
  ...calibration.public,
  aperture: MACRO_COMPOUND_MOVEMENTS_APERTURE,
} as const;

export const macroCompoundMovementsLightingTargetMm =
  macroCompoundMovementsFocusTargets[1]?.worldPosition ??
  macroCompoundMovementsPlanePoint(0, 0);
