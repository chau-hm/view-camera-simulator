import type { SceneDefinition } from "../../types/scene";
import {
  macroDepthOfFieldCameraPlacement,
  macroDepthOfFieldFocusTargets,
  macroDepthOfFieldSceneBoundsMm,
  MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM,
  MACRO_DEPTH_INITIAL_FOCUS_DISTANCE_MM,
} from "../macroDepthOfFieldGeometry";

export const macroDepthOfFieldScene: SceneDefinition = {
  id: "macro-depth-of-field",
  name: "Macro — Depth of Field",
  description: "Compare focus position and aperture across a three-dimensional macro subject.",
  assets: [],
  cameraPreset: {
    focalLengthMm: 150,
    focusDistanceMm: MACRO_DEPTH_INITIAL_FOCUS_DISTANCE_MM,
    aperture: 5.6,
    frontRiseMm: 0,
    frontShiftMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearShiftMm: 0,
    rearTiltDeg: 0,
    rearSwingDeg: 0,
    cameraBodyPitchDeg: 0,
  },
  finiteFocusStrategy: {
    kind: "rear-standard-thin-lens",
    lensDatum: "baseline-origin",
    focusDistanceReference: "lens-to-focus-plane",
    filmDepthReference: "optical-axis-conjugate",
  },
  focusDistanceRangeMm: MACRO_DEPTH_FOCUS_DISTANCE_RANGE_MM,
  cameraControlPolicy: { movement: "fixed", infinityReset: false },
  macroFocusMetricsCapability: { enabled: true },
  macroTeachingCapability: { kind: "depth-of-field" },
  cameraPlacement: macroDepthOfFieldCameraPlacement,
  bounds: macroDepthOfFieldSceneBoundsMm,
  focusTargets: macroDepthOfFieldFocusTargets,
  compositionTargets: [],
};
