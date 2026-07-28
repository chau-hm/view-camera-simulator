import type { SceneDefinition } from "../../types/scene";
import geometry from "../understandingCameraMovementsGeometry";

export const understandingCameraMovementsScene: SceneDefinition = {
  id: "understanding-camera-movements",
  name: "Understanding Camera Movements",
  description:
    "Observe front and rear camera movements and how each movement changes the camera geometry and image.",
  assets: [],
  cameraPreset: {
    focalLengthMm: geometry.cameraPreset.focalLengthMm,
    focusDistanceMm: geometry.cameraPreset.focusDistanceMm,
    aperture: geometry.cameraPreset.aperture,
    frontRiseMm: geometry.cameraPreset.frontRiseMm,
    frontTiltDeg: geometry.cameraPreset.frontTiltDeg,
    frontSwingDeg: geometry.cameraPreset.frontSwingDeg,
    rearRiseMm: geometry.cameraPreset.rearRiseMm,
    rearTiltDeg: geometry.cameraPreset.rearTiltDeg,
    cameraBodyPitchDeg: geometry.cameraPreset.cameraBodyPitchDeg,
    cameraBodyPivotWorld: geometry.cameraPreset.cameraBodyPivotWorld,
  },
  cameraPlacement: {
    /** Three-quarter view to show cube, grid, and full camera assembly */
    position: { x: 700, y: 500, z: -700 },
    target: { x: 0, y: 0, z: 2000 },
  },
  bounds: {
    min: geometry.subjectBounds.min,
    max: geometry.subjectBounds.max,
  },
  focusTargets: [],
  compositionTargets: [],
  finiteFocusStrategy: {
    kind: "rear-standard-thin-lens",
    lensDatum: "baseline-origin",
    focusDistanceReference: "lens-to-focus-plane",
  },
  cameraBodyPitchCapability: {
    enabled: true,
  },
  movementCapabilities: {
    available: ["frontRiseMm", "rearRiseMm", "frontTiltDeg", "rearTiltDeg"],
    selectionMode: "single",
    defaultMovement: "frontRiseMm",
  },
  cameraControlPolicy: {
    focusDistance: "fixed",
    aperture: "fixed",
    infinityReset: false,
  },
  cameraInspectionPlacement: {
    /** Three-quarter angle centred on the camera body midpoint */
    position: { x: 800, y: 600, z: -600 },
    target: { x: 0, y: 0, z: -75 },
  },
};
