import type { SceneDefinition } from "../../types/scene";
import {
  MACRO_COMPOUND_MOVEMENTS_APERTURE,
  MACRO_COMPOUND_MOVEMENTS_FOCAL_LENGTH_MM,
  MACRO_COMPOUND_MOVEMENTS_FOCUS_DISTANCE_RANGE_MM,
  MACRO_COMPOUND_MOVEMENTS_INITIAL_FOCUS_DISTANCE_MM,
  macroCompoundMovementsCameraPlacement,
  macroCompoundMovementsCompositionTargetBounds,
  macroCompoundMovementsFocusTargets,
  macroCompoundMovementsSceneBoundsMm,
} from "../macroCompoundMovementsGeometry";

export const macroCompoundMovementsScene: SceneDefinition = {
  id: "macro-compound-movements",
  name: "Macro — Compound Movements",
  description:
    "Align three separated precision surfaces that vary in both depth and lateral orientation using Front Tilt, Front Swing, and Focus Distance.",
  assets: [],
  cameraPreset: {
    focalLengthMm: MACRO_COMPOUND_MOVEMENTS_FOCAL_LENGTH_MM,
    focusDistanceMm: MACRO_COMPOUND_MOVEMENTS_INITIAL_FOCUS_DISTANCE_MM,
    aperture: MACRO_COMPOUND_MOVEMENTS_APERTURE,
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
  focusDistanceRangeMm: MACRO_COMPOUND_MOVEMENTS_FOCUS_DISTANCE_RANGE_MM,
  movementCapabilities: {
    available: ["frontTiltDeg", "frontSwingDeg"],
    selectionMode: "multiple",
    defaultMovement: "frontTiltDeg",
  },
  cameraControlPolicy: {
    aperture: "fixed",
    infinityReset: false,
  },
  macroFocusMetricsCapability: { enabled: true },
  cameraPlacement: macroCompoundMovementsCameraPlacement,
  bounds: macroCompoundMovementsSceneBoundsMm,
  focusTargets: macroCompoundMovementsFocusTargets,
  compositionTargets: [
    {
      id: "macro-compound-critical-surfaces",
      label: "Canonical compound macro focus surfaces",
      worldBounds: macroCompoundMovementsCompositionTargetBounds,
    },
  ],
};
