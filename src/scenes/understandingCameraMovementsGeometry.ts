import { transformRigLocalPointToWorld } from "../core/optics/applyCameraBodyPitch";
import { imageDistanceMm } from "../core/optics/thinLensModel";
import type { Bounds3, CameraRigTransform, Vec3 } from "../types/optics";
import { CAMERA_CONSTANTS } from "../utils/constants";
import { CAMERA_MOVEMENT_LATTICE } from "./cameraMovementLatticeGeometry";
import { CAMERA_MOVEMENT_SCENE_CALIBRATION } from "./cameraMovementSceneCalibration";
import { resolveCameraRigViewpointAnchors } from "./cameraRigViewpointGeometry";

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
export const CAMERA_BODY_PIVOT_RIG_LOCAL: Vec3 = {
  x: 0,
  y: -(CAMERA_CONSTANTS.frontStandardHeightMm / 2) - CAMERA_BODY_RAIL_CLEARANCE_MM,
  z: -cameraBodyImageDistanceMm / 2,
};

/**
 * @deprecated Compatibility adapter for state/render consumers predating
 * explicit rig placement. The value is rig-local, not resolved world space.
 */
export const CAMERA_BODY_PIVOT_WORLD = CAMERA_BODY_PIVOT_RIG_LOCAL;

export const CAMERA_RIG_VIEWPOINT_ANCHORS = resolveCameraRigViewpointAnchors(
  CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig,
);
export const DEFAULT_CAMERA_RIG_VIEWPOINT =
  CAMERA_RIG_VIEWPOINT_ANCHORS[CAMERA_MOVEMENT_SCENE_CALIBRATION.cameraRig.defaultAnchor];

/**
 * Canonical fixed rail spans 60 mm beyond both zero-movement standards,
 * leaving a modest carriage allowance without tying its length to movement.
 * Its centre is the tripod/body pivot, so body pitch rotates the rail and both
 * standards as one rigid assembly.
 */
export const CAMERA_BODY_RAIL_GEOMETRY = {
  centerRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
  dimensionsMm: {
    x: CAMERA_BODY_RAIL_WIDTH_MM,
    y: CAMERA_BODY_RAIL_HEIGHT_MM,
    z: cameraBodyImageDistanceMm + CAMERA_BODY_RAIL_OVERHANG_MM * 2,
  } as Vec3,
  rearEndpointRigLocal: {
    x: CAMERA_BODY_PIVOT_RIG_LOCAL.x,
    y: CAMERA_BODY_PIVOT_RIG_LOCAL.y,
    z: -cameraBodyImageDistanceMm - CAMERA_BODY_RAIL_OVERHANG_MM,
  } as Vec3,
  frontEndpointRigLocal: {
    x: CAMERA_BODY_PIVOT_RIG_LOCAL.x,
    y: CAMERA_BODY_PIVOT_RIG_LOCAL.y,
    z: CAMERA_BODY_RAIL_OVERHANG_MM,
  } as Vec3,
  /** @deprecated Rig-local compatibility name for existing renderer consumers. */
  centerWorld: CAMERA_BODY_PIVOT_RIG_LOCAL,
  /** @deprecated Rig-local compatibility name for existing 2D consumers. */
  rearEndpointWorld: {
    x: CAMERA_BODY_PIVOT_RIG_LOCAL.x,
    y: CAMERA_BODY_PIVOT_RIG_LOCAL.y,
    z: -cameraBodyImageDistanceMm - CAMERA_BODY_RAIL_OVERHANG_MM,
  } as Vec3,
  /** @deprecated Rig-local compatibility name for existing 2D consumers. */
  frontEndpointWorld: {
    x: CAMERA_BODY_PIVOT_RIG_LOCAL.x,
    y: CAMERA_BODY_PIVOT_RIG_LOCAL.y,
    z: CAMERA_BODY_RAIL_OVERHANG_MM,
  } as Vec3,
  standardOverhangMm: CAMERA_BODY_RAIL_OVERHANG_MM,
} as const;

const latticeWidthMm = CAMERA_MOVEMENT_LATTICE.bounds.max.x - CAMERA_MOVEMENT_LATTICE.bounds.min.x;
const latticeDepthMm = CAMERA_MOVEMENT_LATTICE.bounds.max.z - CAMERA_MOVEMENT_LATTICE.bounds.min.z;
const gridHalfExtentMm =
  Math.max(latticeWidthMm, latticeDepthMm) / 2 +
  CAMERA_MOVEMENT_SCENE_CALIBRATION.subject.cubeSizeMm;

/**
 * Conservative rig-local AABB of the complete camera body before body pitch.
 *
 * This is a static framing proxy, not renderer geometry. It conservatively
 * covers the front standard, rear standard, rail, bellows, and the fixed
 * tripod/rail pivot. All values are derived from the canonical body constants
 * so a framing change can never drift from the rendered assembly.
 */
const CAMERA_BODY_RIG_LOCAL_BOUNDS: Bounds3 = (() => {
  const { frontStandardWidthMm, frontStandardHeightMm } = CAMERA_CONSTANTS;
  const frontStandardHalfWidthMm = frontStandardWidthMm / 2;
  const frontStandardHalfHeightMm = frontStandardHeightMm / 2;
  const frontStandardHalfDepthMm = 6;
  const rearStandardHalfDepthMm = 9;
  const railHalfWidthMm = CAMERA_BODY_RAIL_WIDTH_MM / 2;
  const railHalfHeightMm = CAMERA_BODY_RAIL_HEIGHT_MM / 2;
  const railRearZ = -cameraBodyImageDistanceMm - CAMERA_BODY_RAIL_OVERHANG_MM;
  const railFrontZ = CAMERA_BODY_RAIL_OVERHANG_MM;
  const bellowsHalfWidthMm = 60;
  const bellowsHalfHeightMm = 45;

  const points: Vec3[] = [
    // Front standard (centred on the lens datum).
    {
      x: -frontStandardHalfWidthMm,
      y: -frontStandardHalfHeightMm,
      z: -frontStandardHalfDepthMm,
    },
    {
      x: frontStandardHalfWidthMm,
      y: frontStandardHalfHeightMm,
      z: frontStandardHalfDepthMm,
    },
    // Rear standard (centred on the finite-focus film datum at Z = -v).
    {
      x: -frontStandardHalfWidthMm,
      y: -frontStandardHalfHeightMm,
      z: -cameraBodyImageDistanceMm - rearStandardHalfDepthMm,
    },
    {
      x: frontStandardHalfWidthMm,
      y: frontStandardHalfHeightMm,
      z: -cameraBodyImageDistanceMm + rearStandardHalfDepthMm,
    },
    // Rail (spans rear overhang to front overhang at the pivot Y level).
    {
      x: -railHalfWidthMm,
      y: CAMERA_BODY_PIVOT_RIG_LOCAL.y - railHalfHeightMm,
      z: railRearZ,
    },
    {
      x: railHalfWidthMm,
      y: CAMERA_BODY_PIVOT_RIG_LOCAL.y + railHalfHeightMm,
      z: railFrontZ,
    },
    // Bellows (between the rear film datum and the front lens datum).
    {
      x: -bellowsHalfWidthMm,
      y: -bellowsHalfHeightMm,
      z: -cameraBodyImageDistanceMm,
    },
    {
      x: bellowsHalfWidthMm,
      y: bellowsHalfHeightMm,
      z: 0,
    },
    // Fixed tripod/rail pivot (anchor placement).
    CAMERA_BODY_PIVOT_RIG_LOCAL,
  ];

  return {
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
  };
})();

/**
 * Resolve the world-space AABB of the complete camera body for a rig transform.
 *
 * The rig-local body AABB corners are passed through the canonical
 * `transformRigLocalPointToWorld` helper so body pitch and outer rig placement
 * are applied exactly once. This is the shared canonical framing proxy used by
 * the scene framing tests and the static observer presets; it never duplicates
 * renderer transforms or hand-writes anchor-only bounds.
 */
export const resolveCameraBodyBoundsWorld = (
  transform: CameraRigTransform,
): Bounds3 => {
  const corners: Vec3[] = [];
  for (const x of [CAMERA_BODY_RIG_LOCAL_BOUNDS.min.x, CAMERA_BODY_RIG_LOCAL_BOUNDS.max.x]) {
    for (const y of [CAMERA_BODY_RIG_LOCAL_BOUNDS.min.y, CAMERA_BODY_RIG_LOCAL_BOUNDS.max.y]) {
      for (const z of [CAMERA_BODY_RIG_LOCAL_BOUNDS.min.z, CAMERA_BODY_RIG_LOCAL_BOUNDS.max.z]) {
        corners.push(transformRigLocalPointToWorld({ x, y, z }, transform));
      }
    }
  }
  return {
    min: {
      x: Math.min(...corners.map((point) => point.x)),
      y: Math.min(...corners.map((point) => point.y)),
      z: Math.min(...corners.map((point) => point.z)),
    },
    max: {
      x: Math.max(...corners.map((point) => point.x)),
      y: Math.max(...corners.map((point) => point.y)),
      z: Math.max(...corners.map((point) => point.z)),
    },
  };
};

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
      axis: "rig-local +X",
      positiveDirection: "rig-local +Z rotates toward rig-local -Y",
      hierarchy: "local standard movements, then local body pitch, then outer rig placement",
      pivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
      pivotBasis: "tripod/rail point below the standards at the zero-body lens-film midpoint",
    },
  },
  calibration: CAMERA_MOVEMENT_SCENE_CALIBRATION,
  lattice: CAMERA_MOVEMENT_LATTICE,
  cameraBody: {
    pivotRigLocal: CAMERA_BODY_PIVOT_RIG_LOCAL,
    rail: CAMERA_BODY_RAIL_GEOMETRY,
  },
  cameraRig: {
    viewpointAnchors: CAMERA_RIG_VIEWPOINT_ANCHORS,
    defaultViewpoint: DEFAULT_CAMERA_RIG_VIEWPOINT,
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
    /** Legacy state boundary; value is the canonical rig-local pivot. */
    cameraBodyPivotWorld: CAMERA_BODY_PIVOT_RIG_LOCAL,
  },
} as const;

export default geometry;
