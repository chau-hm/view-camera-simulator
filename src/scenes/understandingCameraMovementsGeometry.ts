import type { Vec3 } from "../types/optics";
import { imageDistanceMm } from "../core/optics/thinLensModel";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { CAMERA_MOVEMENT_LATTICE } from "./cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "./cameraMovementSceneCalibration";

/**
 * Canonical coordinate contract for Understanding Camera Movements:
 * - all values are millimetres;
 * - +X is camera-right, +Y is up, and +Z runs from the lens toward the subject;
 * - the zero-movement lens centre is the origin and finite-focus film datum is
 *   Z = -v, where v = fU / (U - f);
 * - front and rear rise are positive along +Y;
 * - positive tilt rotates a standard normal about +X, around the standard centre;
 * - the provisional lattice is centred at its calibrated world origin;
 * - its focus reference remains independently calibrated on the optical axis.
 */
const canonicalFocusReferenceWorld: Vec3 = {
  x: CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld.x,
  y: CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld.y,
  z: CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocusDistanceMm,
};

/**
 * Compatibility names retained for existing scene/optics consumers. Values
 * come only from the provisional scene calibration; the scaffold deliberately
 * makes no final framing or edge-margin claim.
 */
export const CAMERA_MOVEMENTS_FOCAL_CALIBRATION = {
  candidateFocalLengthsMm: CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.focalLengthCandidatesMm,
  selectedFocalLengthMm: CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
} as const;

const CAMERA_BODY_RAIL_CLEARANCE_MM = 20;
const CAMERA_BODY_RAIL_OVERHANG_MM = 60;
const CAMERA_BODY_RAIL_WIDTH_MM = 36;
const CAMERA_BODY_RAIL_HEIGHT_MM = 24;
const cameraBodyImageDistanceMm = imageDistanceMm(
  CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
  CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocusDistanceMm,
);

/**
 * Fixed tripod/rail mount for rigid camera-body pitch.
 *
 * X remains on the optical centreline. Y sits one standard half-height plus a
 * 20 mm rail clearance below the optical axis. Z is the zero-movement midpoint
 * between the finite-focus film datum (-v) and lens datum (0). This pivot is
 * calibrated once and does not follow front/rear rise, tilt, swing, or focus.
 */
export const CAMERA_BODY_PIVOT_WORLD: Vec3 = {
  x: 0,
  y: -(CAMERA_CONSTANTS.frontStandardHeightMm / 2) - CAMERA_BODY_RAIL_CLEARANCE_MM,
  z: -cameraBodyImageDistanceMm / 2,
};

/**
 * Canonical fixed rail spans 60 mm beyond both zero-movement standards,
 * leaving a modest carriage allowance without tying its length to movement.
 * Its centre is the tripod/body pivot, so body pitch rotates the rail and both
 * standards as one rigid assembly.
 */
export const CAMERA_BODY_RAIL_GEOMETRY = {
  centerWorld: CAMERA_BODY_PIVOT_WORLD,
  dimensionsMm: {
    x: CAMERA_BODY_RAIL_WIDTH_MM,
    y: CAMERA_BODY_RAIL_HEIGHT_MM,
    z: cameraBodyImageDistanceMm + CAMERA_BODY_RAIL_OVERHANG_MM * 2,
  } as Vec3,
  rearEndpointWorld: {
    x: CAMERA_BODY_PIVOT_WORLD.x,
    y: CAMERA_BODY_PIVOT_WORLD.y,
    z: -cameraBodyImageDistanceMm - CAMERA_BODY_RAIL_OVERHANG_MM,
  } as Vec3,
  frontEndpointWorld: {
    x: CAMERA_BODY_PIVOT_WORLD.x,
    y: CAMERA_BODY_PIVOT_WORLD.y,
    z: CAMERA_BODY_RAIL_OVERHANG_MM,
  } as Vec3,
  standardOverhangMm: CAMERA_BODY_RAIL_OVERHANG_MM,
} as const;

const latticeWidthMm = CAMERA_MOVEMENT_LATTICE.bounds.max.x - CAMERA_MOVEMENT_LATTICE.bounds.min.x;
const latticeDepthMm = CAMERA_MOVEMENT_LATTICE.bounds.max.z - CAMERA_MOVEMENT_LATTICE.bounds.min.z;
const gridHalfExtentMm =
  Math.max(latticeWidthMm, latticeDepthMm) / 2 +
  CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.cubeSizeMm;

const geometry = {
  coordinateContract: {
    units: "millimetres",
    axes: {
      x: "camera-right",
      y: "up",
      z: "lens-to-subject",
    },
    zeroMovementLensCenter: { x: 0, y: 0, z: 0 } as Vec3,
    filmDatum: "Z = -(focalLengthMm * focusDistanceMm) / (focusDistanceMm - focalLengthMm)",
    standardPivot: "standard-centre",
    bodyPitch: {
      axis: "world +X",
      positiveDirection: "+Z rotates toward -Y",
      hierarchy: "local standard movements, then rigid body pitch",
      pivotWorld: CAMERA_BODY_PIVOT_WORLD,
      pivotBasis: "tripod/rail point below the standards at the zero-body lens-film midpoint",
    },
  },
  calibration: CAMERA_MOVEMENT_SCENE_CALIBRATION,
  lattice: CAMERA_MOVEMENT_LATTICE,
  cameraBody: {
    pivotWorld: CAMERA_BODY_PIVOT_WORLD,
    rail: CAMERA_BODY_RAIL_GEOMETRY,
  },
  focusReferenceWorld: canonicalFocusReferenceWorld,
  grid: {
    /** Provisional XZ reference grid derived from the calibrated lattice. */
    center: {
      x: CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld.x,
      y:
        CAMERA_MOVEMENT_LATTICE.bounds.min.y -
        CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.cubeSizeMm / 2,
      z: CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.originWorld.z,
    } as Vec3,
    halfExtentMm: gridHalfExtentMm,
    cellSizeMm: CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.cubeSizeMm,
  },
  /** Exact finite bounds of the canonical provisional subject. */
  subjectBounds: CAMERA_MOVEMENT_LATTICE.bounds,
  focalCalibration: CAMERA_MOVEMENTS_FOCAL_CALIBRATION,
  /** Camera preset values. */
  cameraPreset: {
    focalLengthMm: CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocalLengthMm,
    focusDistanceMm: CAMERA_MOVEMENT_SCENE_CALIBRATION.optics.provisionalFocusDistanceMm,
    aperture: 32 as const,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
    cameraBodyPitchDeg: 0,
    cameraBodyPivotWorld: CAMERA_BODY_PIVOT_WORLD,
  },
} as const;

export default geometry;
