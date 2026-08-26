// Canonical geometry for the Architecture + Foreground foundation scene.
// All dimensions are millimetres in the simulator's world coordinate system:
// the lens is at (0, 0, 0), the optical axis points toward +Z, and Y is up.

import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../utils/constants";
import { roundToStep } from "../utils/roundToStep";
import type { Bounds3, Vec3 } from "../types/optics";
import type { CameraPlacement, FocusTarget } from "../types/scene";

export type ArchitectureForegroundGroundGeometry = {
  y: number;
  nearZ: number;
  farZ: number;
  width: number;
  depth: number;
  centerZ: number;
  slabWidthMm: number;
  slabDepthMm: number;
  seamWidthMm: number;
};

export type ArchitectureForegroundWindow = {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
};

const groundNearZ = 700;
const groundFarZ = 12500;

export const ground: ArchitectureForegroundGroundGeometry = {
  y: -1400,
  nearZ: groundNearZ,
  farZ: groundFarZ,
  width: 15000,
  depth: groundFarZ - groundNearZ,
  centerZ: (groundNearZ + groundFarZ) / 2,
  slabWidthMm: 760,
  slabDepthMm: 720,
  seamWidthMm: 18,
};

export const building = {
  center: { x: 0, y: 0, z: 10000 },
  width: 4200,
  height: 4500,
  topHeight: 450,
  depth: 1000,
  facadeVerticalDivisionCount: 6,
  facadeHorizontalDivisionCount: 5,
  windowColumns: 5,
  windowRows: 4,
  windowWidth: 520,
  windowHeight: 650,
  windowFrameMm: 28,
};

building.center.y = ground.y + building.height / 2;

export const facade = {
  mainBodyBottomY: building.center.y - building.height / 2,
  mainBodyTopY: building.center.y + building.height / 2,
  parapetBottomY: 0,
  parapetTopY: 0,
  frontFacadeZ: building.center.z - building.depth / 2,
  backFacadeZ: building.center.z + building.depth / 2,
};

facade.parapetBottomY = facade.mainBodyTopY;
facade.parapetTopY = facade.parapetBottomY + building.topHeight;

export const windowRowCenters = Array.from({ length: building.windowRows }, (_, row) =>
  ground.y + 720 + row * 900,
);

export const windowColumnCenters = Array.from(
  { length: building.windowColumns },
  (_, column) =>
    -building.width / 2 + 520 + (column * (building.width - 1040)) / (building.windowColumns - 1),
);

export const getWindows = (): ArchitectureForegroundWindow[] =>
  windowRowCenters.flatMap((y, row) =>
    windowColumnCenters.map((x, column) => ({
      id: `window-${row + 1}-${column + 1}`,
      x,
      y,
      z: facade.frontFacadeZ - 14,
      width: building.windowWidth,
      height: building.windowHeight,
    })),
  );

export const getPavingSeamPositions = () => ({
  longitudinalX: Array.from(
    { length: Math.floor(ground.width / ground.slabWidthMm) + 1 },
    (_, index) =>
      -ground.width / 2 + index * ground.slabWidthMm,
  ),
  depthZ: Array.from(
    { length: Math.floor(ground.depth / ground.slabDepthMm) + 1 },
    (_, index) => ground.nearZ + index * ground.slabDepthMm,
  ),
});

export const compositionTargets = {
  buildingTop: {
    min: {
      x: -building.width / 2 - 120,
      y: facade.parapetBottomY - 80,
      z: facade.frontFacadeZ - 80,
    },
    max: {
      x: building.width / 2 + 120,
      y: facade.parapetTopY + 80,
      z: facade.backFacadeZ + 80,
    },
  },
  buildingBase: {
    min: {
      x: -building.width / 2 - 120,
      y: ground.y,
      z: facade.frontFacadeZ - 80,
    },
    max: {
      x: building.width / 2 + 120,
      y: ground.y + 520,
      z: facade.backFacadeZ + 80,
    },
  },
  buildingMain: {
    min: {
      x: -building.width / 2 - 120,
      y: ground.y + 180,
      z: facade.frontFacadeZ - 80,
    },
    max: {
      x: building.width / 2 + 120,
      y: facade.mainBodyTopY - 260,
      z: facade.backFacadeZ + 80,
    },
  },
} as const;

const focusSurfaceOffsetMm = 12;

const targetAtGround = (id: string, label: string, z: number): FocusTarget => ({
  id,
  label,
  worldPosition: { x: 0, y: ground.y + focusSurfaceOffsetMm, z },
  sampleWorldPositions: [
    { x: -ground.slabWidthMm * 0.28, y: ground.y + focusSurfaceOffsetMm, z },
    { x: 0, y: ground.y + focusSurfaceOffsetMm, z },
    { x: ground.slabWidthMm * 0.28, y: ground.y + focusSurfaceOffsetMm, z },
  ],
  weight: 1,
});

const targetOnFacade = (id: string, label: string, y: number): FocusTarget => ({
  id,
  label,
  worldPosition: { x: 0, y, z: facade.frontFacadeZ - focusSurfaceOffsetMm },
  sampleWorldPositions: [
    { x: -building.width * 0.26, y, z: facade.frontFacadeZ - focusSurfaceOffsetMm },
    { x: 0, y, z: facade.frontFacadeZ - focusSurfaceOffsetMm },
    { x: building.width * 0.26, y, z: facade.frontFacadeZ - focusSurfaceOffsetMm },
  ],
  weight: 1,
});

export const focusTargets: FocusTarget[] = [
  targetAtGround("foreground-near", "Near foreground", 4700),
  targetAtGround("foreground-middle", "Middle foreground", 6900),
  targetOnFacade("building-base", "Building base", ground.y + 520),
  targetOnFacade("building-middle", "Building middle", ground.y + 2450),
];

export const focusTargetById = (id: string): FocusTarget => {
  const target = focusTargets.find((candidate) => candidate.id === id);
  if (!target) throw new Error(`Unknown Architecture + Foreground focus target: ${id}`);
  return target;
};

export const cameraCalibration = {
  focalLengthMm: 150,
  rawFocusDistanceMm: focusTargetById("building-middle").worldPosition.z,
  startingAperture: 11,
  futureRiseMm: 20,
  futureTiltProbeDeg: 5,
  rawTiltFocusSolutionDeg: 2,
  rawTiltFocusFocusDistanceMm: 6830,
  tiltFocusRangeDeg: { min: 1.7, max: 2.6 },
  tiltFocusSharpnessMinimum: 0.7,
  tiltFocusMinimumFocusAdjustmentMm: 100,
  // Physical patch sharpness at the public f/22 solution is approximately
  // 0.424 at its worst target. Keep a small margin for the rounded public
  // tilt/focus steps while remaining stricter than the 0.1 mm CoC boundary.
  dofSharpnessMinimum: 0.4,
  dofPassingApertures: [22, 32] as const,
} as const;

export const canonicalFocusDistanceMm = roundToStep(
  cameraCalibration.rawFocusDistanceMm,
  CAMERA_CONTROL_STEPS.focusDistanceMm,
);

export const canonicalTiltFocusTiltDeg = roundToStep(
  cameraCalibration.rawTiltFocusSolutionDeg,
  CAMERA_CONTROL_STEPS.tiltDeg,
);

export const canonicalTiltFocusFocusDistanceMm = roundToStep(
  cameraCalibration.rawTiltFocusFocusDistanceMm,
  CAMERA_CONTROL_STEPS.focusDistanceMm,
);

export const focusDistanceRangeMm = {
  min: roundToStep(3500, CAMERA_CONTROL_STEPS.focusDistanceMm),
  max: roundToStep(ground.farZ, CAMERA_CONTROL_STEPS.focusDistanceMm),
} as const;

export const sceneBounds: Bounds3 = {
  min: {
    x: -ground.width / 2,
    y: ground.y - 30,
    z: ground.nearZ - 30,
  },
  max: {
    x: ground.width / 2,
    y: facade.parapetTopY + 160,
    z: ground.farZ + 30,
  },
};

export const observerCamera: CameraPlacement = {
  position: { x: 5600, y: 3000, z: -6500 },
  target: { x: 0, y: 250, z: 6900 },
};

export const inspectionCamera: CameraPlacement = {
  position: { x: 3000, y: 1900, z: -3600 },
  target: { x: 0, y: 150, z: 6500 },
};

/**
 * Values used by later movement slices. They are kept separate from the
 * rounded public-control values so calibration evidence remains physical.
 */
export const neutralCalibration = {
  cameraPitchDeg: 0,
  frontRiseMm: 0,
  frontTiltDeg: 0,
  frontSwingDeg: 0,
  rearRiseMm: 0,
  rearTiltDeg: 0,
  roofRegion: compositionTargets.buildingTop,
  baseRegion: compositionTargets.buildingBase,
  rawFocusDistanceMm: cameraCalibration.rawFocusDistanceMm,
  publicFocusDistanceMm: canonicalFocusDistanceMm,
  futureRiseMm: cameraCalibration.futureRiseMm,
  futureTiltProbeDeg: cameraCalibration.futureTiltProbeDeg,
  rawTiltFocusSolutionDeg: cameraCalibration.rawTiltFocusSolutionDeg,
  publicTiltFocusSolutionDeg: canonicalTiltFocusTiltDeg,
  rawTiltFocusFocusDistanceMm: cameraCalibration.rawTiltFocusFocusDistanceMm,
  publicTiltFocusFocusDistanceMm: canonicalTiltFocusFocusDistanceMm,
  tiltFocusRangeDeg: cameraCalibration.tiltFocusRangeDeg,
  tiltFocusSharpnessMinimum: cameraCalibration.tiltFocusSharpnessMinimum,
  tiltFocusMinimumFocusAdjustmentMm: cameraCalibration.tiltFocusMinimumFocusAdjustmentMm,
  dofSharpnessMinimum: cameraCalibration.dofSharpnessMinimum,
  dofPassingApertures: cameraCalibration.dofPassingApertures,
  aperture: cameraCalibration.startingAperture,
} as const;

export const buildingVerticalEdges: { bottom: Vec3; top: Vec3 }[] = [
  {
    bottom: { x: -building.width / 2, y: ground.y, z: facade.frontFacadeZ },
    top: { x: -building.width / 2, y: facade.parapetTopY, z: facade.frontFacadeZ },
  },
  {
    bottom: { x: building.width / 2, y: ground.y, z: facade.frontFacadeZ },
    top: { x: building.width / 2, y: facade.parapetTopY, z: facade.frontFacadeZ },
  },
];

export default {
  ground,
  building,
  facade,
  windowRowCenters,
  windowColumnCenters,
  getWindows,
  getPavingSeamPositions,
  compositionTargets,
  focusTargets,
  focusTargetById,
  cameraCalibration,
  canonicalFocusDistanceMm,
  focusDistanceRangeMm,
  sceneBounds,
  observerCamera,
  inspectionCamera,
  neutralCalibration,
  buildingVerticalEdges,
  filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
};
