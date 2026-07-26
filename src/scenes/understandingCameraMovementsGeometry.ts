import type { Bounds3, Vec3 } from "../types/optics";
import { imageDistanceMm } from "../core/optics/thinLensModel";
import { CAMERA_CONSTANTS } from "../utils/constants";

/**
 * Canonical coordinate contract for Understanding Camera Movements:
 * - all values are millimetres;
 * - +X is camera-right, +Y is up, and +Z runs from the lens toward the subject;
 * - the zero-movement lens centre is the origin and finite-focus film datum is
 *   Z = -v, where v = fU / (U - f);
 * - front and rear rise are positive along +Y;
 * - positive tilt rotates a standard normal about +X, around the standard centre;
 * - every cube shares the Z = 2000 mm centre plane so count changes do not alter focus.
 */
export type SubjectCount = 1 | 2 | 3;
export type SubjectRole = "upper" | "middle" | "lower";

export type CanonicalSubjectCube = {
  id: `camera-movements-cube-${SubjectRole}`;
  role: SubjectRole;
  center: Vec3;
  dimensionsMm: Vec3;
  halfDimensionsMm: Vec3;
  /** Compatibility dimensions for code that treats these subjects as true cubes. */
  sizeMm: number;
  halfSizeMm: number;
  bounds: Bounds3;
  /** All eight finite physical vertices; consumers must not reconstruct them. */
  vertices: readonly Vec3[];
};

export type CanonicalSubjectLayout = {
  count: SubjectCount;
  cubes: readonly CanonicalSubjectCube[];
  bounds: Bounds3;
  /** Optical-axis reference on the common cube-centre depth plane. */
  focusReferenceWorld: Vec3;
};

const CUBE_SIZE_MM = 300;
const CUBE_HALF_SIZE_MM = CUBE_SIZE_MM / 2;
const SUBJECT_DEPTH_MM = 2000;
const VERTICAL_SLOT_OFFSET_MM = 450;

const cubeDimensionsMm: Vec3 = {
  x: CUBE_SIZE_MM,
  y: CUBE_SIZE_MM,
  z: CUBE_SIZE_MM,
};

const cubeHalfDimensionsMm: Vec3 = {
  x: CUBE_HALF_SIZE_MM,
  y: CUBE_HALF_SIZE_MM,
  z: CUBE_HALF_SIZE_MM,
};

const canonicalFocusReferenceWorld: Vec3 = {
  x: 0,
  y: 0,
  z: SUBJECT_DEPTH_MM,
};

const boundsForCenter = (center: Vec3): Bounds3 => ({
  min: {
    x: center.x - cubeHalfDimensionsMm.x,
    y: center.y - cubeHalfDimensionsMm.y,
    z: center.z - cubeHalfDimensionsMm.z,
  },
  max: {
    x: center.x + cubeHalfDimensionsMm.x,
    y: center.y + cubeHalfDimensionsMm.y,
    z: center.z + cubeHalfDimensionsMm.z,
  },
});

const verticesForBounds = (bounds: Bounds3): readonly Vec3[] => [
  { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
  { x: bounds.max.x, y: bounds.min.y, z: bounds.min.z },
  { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z },
  { x: bounds.max.x, y: bounds.max.y, z: bounds.min.z },
  { x: bounds.min.x, y: bounds.min.y, z: bounds.max.z },
  { x: bounds.max.x, y: bounds.min.y, z: bounds.max.z },
  { x: bounds.min.x, y: bounds.max.y, z: bounds.max.z },
  { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
];

const createCube = (role: SubjectRole, center: Vec3): CanonicalSubjectCube => {
  const bounds = boundsForCenter(center);
  return {
    id: `camera-movements-cube-${role}`,
    role,
    center,
    dimensionsMm: cubeDimensionsMm,
    halfDimensionsMm: cubeHalfDimensionsMm,
    sizeMm: CUBE_SIZE_MM,
    halfSizeMm: CUBE_HALF_SIZE_MM,
    bounds,
    vertices: verticesForBounds(bounds),
  };
};

/**
 * Centres exist only in this registry. Layout variants select these slots by
 * reference, preventing renderer, RTT, and UI consumers from drifting apart.
 */
export const canonicalSubjectCubes = {
  upper: createCube("upper", {
    x: 0,
    y: VERTICAL_SLOT_OFFSET_MM,
    z: SUBJECT_DEPTH_MM,
  }),
  middle: createCube("middle", {
    x: 0,
    y: 0,
    z: SUBJECT_DEPTH_MM,
  }),
  lower: createCube("lower", {
    x: 0,
    y: -VERTICAL_SLOT_OFFSET_MM,
    z: SUBJECT_DEPTH_MM,
  }),
} as const;

const boundsForCubes = (cubes: readonly CanonicalSubjectCube[]): Bounds3 => ({
  min: {
    x: Math.min(...cubes.map((cube) => cube.bounds.min.x)),
    y: Math.min(...cubes.map((cube) => cube.bounds.min.y)),
    z: Math.min(...cubes.map((cube) => cube.bounds.min.z)),
  },
  max: {
    x: Math.max(...cubes.map((cube) => cube.bounds.max.x)),
    y: Math.max(...cubes.map((cube) => cube.bounds.max.y)),
    z: Math.max(...cubes.map((cube) => cube.bounds.max.z)),
  },
});

const createLayout = (
  count: SubjectCount,
  cubes: readonly CanonicalSubjectCube[],
): CanonicalSubjectLayout => ({
  count,
  cubes,
  bounds: boundsForCubes(cubes),
  focusReferenceWorld: canonicalFocusReferenceWorld,
});

export const subjectLayouts: Readonly<Record<SubjectCount, CanonicalSubjectLayout>> = {
  1: createLayout(1, [canonicalSubjectCubes.middle]),
  2: createLayout(2, [canonicalSubjectCubes.upper, canonicalSubjectCubes.lower]),
  3: createLayout(3, [
    canonicalSubjectCubes.upper,
    canonicalSubjectCubes.middle,
    canonicalSubjectCubes.lower,
  ]),
};

export const DEFAULT_SUBJECT_COUNT: SubjectCount = 3;

export const getSubjectLayout = (
  count: SubjectCount = DEFAULT_SUBJECT_COUNT,
): CanonicalSubjectLayout => subjectLayouts[count];

/**
 * Raw scene calibration. The fixed three-cube layout is evaluated longest
 * lens first on 4×5 film using every physical cube vertex. A candidate must
 * be fully finite and contained at zero movement and retain at least 10%
 * margin at every film edge. With the physical finite-focus extension,
 * 150 mm clips the nearest vertices and 120 mm leaves only about 9.2%;
 * 105 mm is the longest candidate that retains useful margin (~14.6%).
 *
 * Rise deliberately moves framing: at the supported +40 mm endpoint, full
 * stack containment is physically incompatible with useful cube dimensions.
 * Movement endpoints must remain finite/stable, not be hidden by shrinking
 * the canonical subjects or changing the public movement range.
 */
export const CAMERA_MOVEMENTS_FOCAL_CALIBRATION = {
  candidateFocalLengthsMm: [150, 120, 105, 90] as const,
  selectedFocalLengthMm: 105,
  minimumBaselineEdgeMarginFraction: 0.1,
  targetBaselineEdgeMarginFractionRange: [0.1, 0.15] as const,
} as const;

const CAMERA_BODY_RAIL_CLEARANCE_MM = 20;
const CAMERA_BODY_RAIL_OVERHANG_MM = 60;
const CAMERA_BODY_RAIL_WIDTH_MM = 36;
const CAMERA_BODY_RAIL_HEIGHT_MM = 24;
const cameraBodyImageDistanceMm = imageDistanceMm(
  CAMERA_MOVEMENTS_FOCAL_CALIBRATION.selectedFocalLengthMm,
  canonicalFocusReferenceWorld.z,
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

const defaultLayout = getSubjectLayout();

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
  defaultSubjectCount: DEFAULT_SUBJECT_COUNT,
  subjectLayouts,
  getSubjectLayout,
  cameraBody: {
    pivotWorld: CAMERA_BODY_PIVOT_WORLD,
    rail: CAMERA_BODY_RAIL_GEOMETRY,
  },
  /** Compatibility alias for the original single-cube consumer. */
  cube: canonicalSubjectCubes.middle,
  cubes: defaultLayout.cubes,
  focusReferenceWorld: canonicalFocusReferenceWorld,
  grid: {
    /** Grid lies on the XZ plane below the lower cube. */
    center: {
      x: 0,
      y: defaultLayout.bounds.min.y - 150,
      z: SUBJECT_DEPTH_MM,
    } as Vec3,
    /** Half-extent of the grid quad in X and Z directions. */
    halfExtentMm: 1400,
    /** Grid cell size. */
    cellSizeMm: 200,
  },
  /** Scene/overlay bounds include the full grid as well as every default cube. */
  subjectBounds: {
    min: {
      x: -1400,
      y: defaultLayout.bounds.min.y - 300,
      z: SUBJECT_DEPTH_MM - 1400,
    },
    max: {
      x: 1400,
      y: defaultLayout.bounds.max.y + 300,
      z: SUBJECT_DEPTH_MM + 1400,
    },
  } as Bounds3,
  focalCalibration: CAMERA_MOVEMENTS_FOCAL_CALIBRATION,
  /** Camera preset values. */
  cameraPreset: {
    focalLengthMm: CAMERA_MOVEMENTS_FOCAL_CALIBRATION.selectedFocalLengthMm,
    focusDistanceMm: canonicalFocusReferenceWorld.z,
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
