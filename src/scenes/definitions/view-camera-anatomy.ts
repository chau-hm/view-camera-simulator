import type { SceneDefinition } from "../../types/scene";

/** A finite-focus scene used by Lesson 0's anatomy and control walkthrough. */
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
    min: 800,
    max: 4000,
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
  showReferenceCamera: false,
  movementCapabilities: {
    available: [
      "frontRiseMm",
      "frontShiftMm",
      "frontTiltDeg",
      "frontSwingDeg",
    ],
    selectionMode: "multiple",
    defaultMovement: "frontRiseMm",
  },
  focusStandardCapability: {
    enabled: true,
    defaultStandard: "front",
    referenceFocusDepthMm: 2000,
    minimumFocusDepthMm: 800,
  },
  cameraControlPolicy: {
    infinityReset: false,
  },
};
