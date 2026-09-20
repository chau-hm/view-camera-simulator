import type { SceneDefinition } from "../../types/scene";
import {
  MACRO_OBLIQUE_PLANE_FOCUS_DISTANCE_RANGE_MM,
  MACRO_OBLIQUE_PLANE_FOCAL_LENGTH_MM,
  MACRO_OBLIQUE_PLANE_INITIAL_FOCUS_DISTANCE_MM,
  macroObliquePlaneCameraPlacement,
  macroObliquePlaneCompositionTargetBounds,
  macroObliquePlaneFocusTargets,
  macroObliquePlaneSceneBoundsMm,
} from "../macroObliquePlaneGeometry";

export const macroObliquePlaneScene: SceneDefinition = {
  id: "macro-oblique-plane",
  name: "Macro — Oblique Plane",
  description:
    "Align an oblique precision plate with the plane of sharp focus using Front Tilt and Focus Distance.",
  assets: [],
  cameraPreset: {
    focalLengthMm: MACRO_OBLIQUE_PLANE_FOCAL_LENGTH_MM,
    focusDistanceMm: MACRO_OBLIQUE_PLANE_INITIAL_FOCUS_DISTANCE_MM,
    aperture: 5.6,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearShiftMm: 0,
    rearTiltDeg: 0,
    rearSwingDeg: 0,
  },
  finiteFocusStrategy: {
    kind: "rear-standard-thin-lens",
    lensDatum: "baseline-origin",
    focusDistanceReference: "lens-to-focus-plane",
    filmDepthReference: "optical-axis-conjugate",
  },
  focusDistanceRangeMm: MACRO_OBLIQUE_PLANE_FOCUS_DISTANCE_RANGE_MM,
  movementCapabilities: {
    available: ["frontTiltDeg"],
    selectionMode: "single",
    defaultMovement: "frontTiltDeg",
  },
  cameraControlPolicy: {
    aperture: "fixed",
    infinityReset: false,
  },
  macroFocusMetricsCapability: { enabled: true },
  cameraPlacement: macroObliquePlaneCameraPlacement,
  bounds: macroObliquePlaneSceneBoundsMm,
  focusTargets: macroObliquePlaneFocusTargets,
  compositionTargets: [
    {
      id: "macro-oblique-subject-plane",
      label: "Canonical oblique macro subject plane",
      worldBounds: macroObliquePlaneCompositionTargetBounds,
    },
  ],
};
