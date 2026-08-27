import type { SceneDefinition } from "../../types/scene";
import { mirrorShiftGeometry } from "../mirrorShiftGeometry";

export const mirrorShiftScene: SceneDefinition = {
  id: "mirror-shift",
  name: "Mirror Shift",
  description:
    "See a planar mirror as a viewing aperture containing reflected props and a simplified view-camera reflection.",
  assets: [],
  cameraPreset: {
    focalLengthMm: 120,
    focusDistanceMm: 6000,
    aperture: 32,
    frontRiseMm: 0,
    frontShiftMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearTiltDeg: 0,
  },
  cameraPlacement: {
    position: { x: 7600, y: 4200, z: -8200 },
    target: { x: 0, y: -100, z: 3000 },
  },
  cameraInspectionPlacement: {
    position: { x: 3000, y: 1800, z: -3200 },
  },
  bounds: mirrorShiftGeometry.sceneBounds,
  focusTargets: [],
  compositionTargets: [],
  cameraControlPolicy: {
    movement: "fixed",
    focusDistance: "fixed",
    aperture: "fixed",
    infinityReset: false,
  },
  cameraRigTranslationCapability: {
    enabled: true,
    axis: "x",
    state: "mirrorShiftLessonState",
  },
  cameraFrontShiftCapability: {
    enabled: true,
    axis: "x",
  },
};
