import type { SceneDefinition } from "../../types/scene";
import {
  macroBellowsExtensionCameraPlacement,
  macroBellowsExtensionFocusTargets,
  macroBellowsExtensionSceneBoundsMm,
} from "../macroSpecimenGeometry";

export const macroBellowsExtensionScene: SceneDefinition = {
  id: "macro-bellows-extension",
  name: "Macro — Bellows Extension",
  description: "Explore bellows extension, magnification, and life-size reproduction.",
  assets: [],
  cameraPreset: {
    focalLengthMm: 150,
    focusDistanceMm: 900,
    aperture: 11,
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
  focusDistanceRangeMm: { min: 300, max: 900 },
  cameraControlPolicy: { movement: "fixed", aperture: "fixed", infinityReset: false },
  macroFocusMetricsCapability: { enabled: true },
  cameraPlacement: macroBellowsExtensionCameraPlacement,
  bounds: macroBellowsExtensionSceneBoundsMm,
  focusTargets: macroBellowsExtensionFocusTargets,
  compositionTargets: [],
};
