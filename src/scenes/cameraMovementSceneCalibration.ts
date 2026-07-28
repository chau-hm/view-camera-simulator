import type { Vec3 } from "../types/optics";

export type CameraMovementTargetRegion = "upper" | "middle" | "lower";
export type CameraMovementLatticeRegion = CameraMovementTargetRegion | "neutral";
export const DEFAULT_CAMERA_MOVEMENT_TARGET_REGION: CameraMovementTargetRegion = "middle";

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
  presentation: CameraMovementPresentationCalibration;
}>;

/**
 * Scene-specific tuning scaffold for Understanding Camera Movements.
 *
 * Every numerical value here is provisional. The calibration deliberately
 * preserves the scene's existing 105 mm finite-focus architecture while the
 * lattice replaces the former subject-count layouts. Renderers consume the
 * canonical lattice generated from this contract; they must not reproduce
 * these dimensions or reinterpret these millimetre values.
 */
export const CAMERA_MOVEMENT_SCENE_CALIBRATION: CameraMovementSceneCalibration = {
  calibrationStatus: "provisional",
  geometryAndOpticsUnits: "millimetres",
  subject: {
    columns: 3,
    rows: 3,
    levels: 5,
    cubeSizeMm: 260,
    horizontalGapMm: 0,
    verticalGapMm: 0,
    originWorld: { x: 0, y: 0, z: 2000 },
    upperTargetLevel: 4,
    middleTargetLevel: 2,
    lowerTargetLevel: 0,
  },
  optics: {
    focalLengthCandidatesMm: [150, 120, 105, 90],
    provisionalFocalLengthMm: 105,
    provisionalFocusDistanceMm: 2000,
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
