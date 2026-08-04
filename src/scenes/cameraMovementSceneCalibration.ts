import type { Vec3 } from "../types/optics";
import {
  CANONICAL_MID_RIG_ORIGIN_WORLD,
  resolveCameraRigArcRadiusMm,
  type CameraRigViewpointArcCalibration,
} from "./cameraRigViewpointGeometry";

export type CameraMovementTargetRegion = "upper" | "middle" | "lower";
/** Visual lattice styling only; never use this for physical targeting. */
export type CameraMovementPresentationRegion = CameraMovementTargetRegion | "whole";
export type CameraMovementLatticeRegion = CameraMovementTargetRegion | "neutral";
export const DEFAULT_CAMERA_MOVEMENT_TARGET_REGION: CameraMovementTargetRegion = "middle";

/** Existing instructional endpoint magnitudes, kept in scene calibration. */
export const CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS = Object.freeze({
  tiltDeg: 5,
  riseMm: 20,
  bodyPitchDeg: 34,
});

export type CameraMovementSubjectCalibration = Readonly<{
  columns: number;
  rows: number;
  levels: number;
  cubeSizeMm: number;
  horizontalGapMm: number;
  verticalGapMm: number;
  /**
   * Geometric centre of the complete lattice in canonical scene millimetres.
   * +X is camera-right, +Y is up, and +Z runs from lens to subject.
   */
  originWorld: Readonly<Vec3>;
  /** Zero-based level indices, counted from the bottom of the lattice. */
  upperTargetLevel: number;
  middleTargetLevel: number;
  lowerTargetLevel: number;
}>;

export type CameraMovementOpticsCalibration = Readonly<{
  focalLengthCandidatesMm: readonly number[];
  provisionalFocalLengthMm: number;
  provisionalFocusDistanceMm: number;
}>;

export type CameraMovementPresentationCalibration = Readonly<{
  outerVerticalWeight: number;
  outerHorizontalWeight: number;
  internalEdgeWeight: number;
  internalEdgeOpacity: number;
  upperRegionColour: `#${string}`;
  middleRegionColour: `#${string}`;
  lowerRegionColour: `#${string}`;
  inactiveColour: `#${string}`;
  showReferenceCamera: boolean;
  defaultTargetRegion: CameraMovementTargetRegion;
}>;

export type CameraMovementSceneCalibration = Readonly<{
  calibrationStatus: "provisional";
  geometryAndOpticsUnits: "millimetres";
  subject: CameraMovementSubjectCalibration;
  optics: CameraMovementOpticsCalibration;
  cameraRig: CameraRigViewpointArcCalibration;
  presentation: CameraMovementPresentationCalibration;
}>;

export type CameraMovementSelectedPhysicalCalibration = Readonly<{
  subject: Readonly<{
    columns: number;
    rows: number;
    levels: number;
    cubeSizeMm: number;
    horizontalGapMm: number;
    verticalGapMm: number;
    subjectDistanceMm: number;
  }>;
  optics: Readonly<{
    focalLengthMm: number;
    focusDistanceMm: number;
  }>;
  cameraRig: Readonly<{
    /** Positive half-angle of the YZ viewpoint arc; low is its exact negative. */
    arcAngleDeg: number;
    /** Closer shared radius for the high teaching viewpoint. */
    highLowArcRadiusMm: number;
    /** D3-only radius for the lower teaching viewpoint. */
    lowArcRadiusMm: number;
  }>;
}>;

/**
 * Raw physical selection produced by the bounded calibration exercise.
 *
 * Subject placement and optical focus are stored independently. The mid-rig
 * arc radius is always derived as the distance between the subject centre
 * (arc centre) and the mid-anchor lens datum. The selected high/low teaching
 * radius is a separate symmetric viewpoint calibration so C3/D3 can move
 * closer without changing Neutral or the mid-anchor cases.
 */
export const CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION = Object.freeze({
  subject: Object.freeze({
    columns: 3,
    rows: 3,
    levels: 5,
    cubeSizeMm: 260,
    horizontalGapMm: 0,
    verticalGapMm: 0,
    subjectDistanceMm: 2000,
  }),
  optics: Object.freeze({
    focalLengthMm: 90,
    focusDistanceMm: 2000,
  }),
  cameraRig: Object.freeze({
    arcAngleDeg: 35,
    highLowArcRadiusMm: 1520,
    lowArcRadiusMm: 1520,
  }),
}) satisfies CameraMovementSelectedPhysicalCalibration;

const selectedPhysical = CAMERA_MOVEMENT_SELECTED_PHYSICAL_CALIBRATION;
const cameraMovementLatticeOriginWorld: Readonly<Vec3> = Object.freeze({
  x: 0,
  y: 0,
  z: selectedPhysical.subject.subjectDistanceMm,
});

const cameraMovementMidRigOriginWorld: Readonly<Vec3> =
  CANONICAL_MID_RIG_ORIGIN_WORLD;
const cameraMovementArcRadiusMm = resolveCameraRigArcRadiusMm(
  cameraMovementLatticeOriginWorld,
  cameraMovementMidRigOriginWorld,
);

/**
 * Scene-specific tuning scaffold for Understanding Camera Movements.
 *
 * Every numerical value here is provisional. The calibration deliberately
 * uses the measured provisional 90 mm / 2,000 mm finite-focus selection while
 * the lattice replaces the former subject-count layouts. Renderers consume
 * the canonical lattice generated from this contract; they must not reproduce
 * these dimensions or reinterpret these millimetre values.
 */
export const CAMERA_MOVEMENT_SCENE_CALIBRATION: CameraMovementSceneCalibration = {
  calibrationStatus: "provisional",
  geometryAndOpticsUnits: "millimetres",
  subject: {
    columns: selectedPhysical.subject.columns,
    rows: selectedPhysical.subject.rows,
    levels: selectedPhysical.subject.levels,
    cubeSizeMm: selectedPhysical.subject.cubeSizeMm,
    horizontalGapMm: selectedPhysical.subject.horizontalGapMm,
    verticalGapMm: selectedPhysical.subject.verticalGapMm,
    originWorld: cameraMovementLatticeOriginWorld,
    upperTargetLevel: selectedPhysical.subject.levels - 1,
    middleTargetLevel: Math.floor((selectedPhysical.subject.levels - 1) / 2),
    lowerTargetLevel: 0,
  },
  optics: {
    focalLengthCandidatesMm: [90, 105, 120, 150],
    provisionalFocalLengthMm: selectedPhysical.optics.focalLengthMm,
    provisionalFocusDistanceMm: selectedPhysical.optics.focusDistanceMm,
  },
  cameraRig: {
    arcPlane: "yz",
    arcCenterWorld: cameraMovementLatticeOriginWorld,
    midRigOriginWorld: cameraMovementMidRigOriginWorld,
    arcRadiusMm: cameraMovementArcRadiusMm,
    highLowArcRadiusMm: selectedPhysical.cameraRig.highLowArcRadiusMm,
    lowArcRadiusMm: selectedPhysical.cameraRig.lowArcRadiusMm,
    highArcAngleDeg: selectedPhysical.cameraRig.arcAngleDeg,
    lowArcAngleDeg: -selectedPhysical.cameraRig.arcAngleDeg,
    highBodyPitchDeg: CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg,
    lowBodyPitchDeg: -CAMERA_MOVEMENT_PROVISIONAL_TEACHING_MOVEMENTS.bodyPitchDeg,
    provisionalBasePitchDeg: 0,
    defaultAnchor: "mid",
    anchorMetadata: {
      mid: { identity: "mid", relativeHeight: "at-mid" },
      high: { identity: "high", relativeHeight: "above-mid" },
      low: { identity: "low", relativeHeight: "below-mid" },
    },
  },
  presentation: {
    outerVerticalWeight: 3,
    outerHorizontalWeight: 2,
    internalEdgeWeight: 1,
    internalEdgeOpacity: 0.46,
    upperRegionColour: "#b7791f",
    middleRegionColour: "#4f46e5",
    lowerRegionColour: "#0f766e",
    inactiveColour: "#64748b",
    showReferenceCamera: false,
    defaultTargetRegion: DEFAULT_CAMERA_MOVEMENT_TARGET_REGION,
  },
};
