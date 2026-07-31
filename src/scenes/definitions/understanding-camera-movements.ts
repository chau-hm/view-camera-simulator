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
    /** Three-quarter view balancing the full rig arc with a prominent lattice */
    position: { x: 1800, y: 1100, z: -1800 },
    target: { x: 0, y: 300, z: 1300 },
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
    /** Pulled-back three-quarter angle spanning the full rig arc so the camera stays centred and non-clipped at high/low */
    position: { x: 2200, y: 1100, z: -2300 },
    target: { x: 0, y: 0, z: 100 },
  },
};
