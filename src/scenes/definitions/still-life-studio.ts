import type { SceneDefinition } from "../../types/scene";
import {
  stillLifeStudioCameraPlacement,
  stillLifeStudioCompositionBounds,
  stillLifeStudioFocusTargets,
  stillLifeStudioSceneBounds,
} from "../stillLifeStudioGeometry";

export const stillLifeStudioScene: SceneDefinition = {
  id: "still-life-studio",
  sceneVariation: { enabled: true, schemaVersion: 1 },
  name: "Still-Life Studio",
  description:
    "Explore seeded still-life arrangements across near, middle and far tabletop subjects. Practice composition, focus, depth of field and large-format camera movements.",
  assets: [],
  cameraPreset: {
    focalLengthMm: 150,
    focusDistanceMm: 4100,
    aperture: 11,
    frontRiseMm: 0,
    frontShiftMm: 0,
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
  focusDistanceRangeMm: { min: 2600, max: 6500 },
  cameraPlacement: stillLifeStudioCameraPlacement,
  bounds: stillLifeStudioSceneBounds,
  focusTargets: stillLifeStudioFocusTargets,
  compositionTargets: [
    {
      id: "still-life-arrangement",
      label: "Still-life arrangement",
      worldBounds: stillLifeStudioCompositionBounds,
    },
  ],
  movementCapabilities: {
    available: [
      "frontRiseMm",
      "frontShiftMm",
      "frontTiltDeg",
      "frontSwingDeg",
      "rearRiseMm",
      "rearShiftMm",
      "rearTiltDeg",
      "rearSwingDeg",
    ],
    selectionMode: "single",
    defaultMovement: "frontTiltDeg",
  },
};
