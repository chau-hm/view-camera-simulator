import type { SceneDefinition } from "../../types/scene";

/**
 * A quiet, finite-focus scene used only to introduce the shared conceptual
 * camera anatomy. It intentionally exposes no movement or task controls.
 */
export const viewCameraAnatomyScene: SceneDefinition = {
  id: "view-camera-anatomy",
  name: "Meet the View Camera",
  description: "Identify the major physical parts of a conceptual view camera.",
  assets: [],
  cameraPreset: {
    focusDistanceMm: 2000,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearShiftMm: 0,
    rearTiltDeg: 0,
    rearSwingDeg: 0,
  },
  focusDistanceRangeMm: {
    min: 2000,
    max: 2000,
  },
  cameraPlacement: {
    position: { x: 720, y: 360, z: 820 },
    target: { x: 0, y: 0, z: -20 },
  },
  bounds: {
    min: { x: -420, y: -260, z: -360 },
    max: { x: 420, y: 260, z: 240 },
  },
  focusTargets: [],
  compositionTargets: [],
  cameraInspectionAnchorSide: "rear",
  cameraControlPolicy: {
    movement: "fixed",
    focusDistance: "fixed",
    aperture: "fixed",
    infinityReset: false,
  },
};
