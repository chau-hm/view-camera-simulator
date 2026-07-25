import type { Bounds3, Vec3 } from "../types/optics";

const cubeCenter: Vec3 = { x: 0, y: 0, z: 4000 };
const cubeSizeMm = 400;

const geometry = {
  cube: {
    center: cubeCenter,
    sizeMm: cubeSizeMm,
    halfSizeMm: cubeSizeMm / 2,
  },
  grid: {
    /** Grid lies on the XZ plane, centred under the cube */
    center: { x: 0, y: -cubeSizeMm / 2 - 100, z: cubeCenter.z } as Vec3,
    /** Half-extent of the grid quad in X and Z directions */
    halfExtentMm: 1000,
    /** Grid cell size */
    cellSizeMm: 200,
  },
  subjectBounds: {
    min: { x: -1500, y: -1000, z: cubeCenter.z - 1000 },
    max: { x: 1500, y: 1000, z: cubeCenter.z + 1000 },
  } as Bounds3,
  /** Camera preset values */
  cameraPreset: {
    focusDistanceMm: 4000,
    aperture: 11 as const,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
  },
} as const;

export default geometry;
