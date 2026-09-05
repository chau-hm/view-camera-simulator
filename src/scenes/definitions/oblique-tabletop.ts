import type { SceneDefinition } from "../../types/scene";
import geometry from "../obliqueTabletopGeometry";

export const obliqueTabletopScene: SceneDefinition = {
  id: "oblique-tabletop",
  name: "Oblique Tabletop",
  description:
    "Photograph an inclined plan board resting on a normal table. Because the board recedes near-to-far and laterally, Tilt alone cannot align the whole subject plane; Swing is also required.",
  assets: [],
  cameraPreset: {
    focusDistanceMm: geometry.canonicalFocusDistanceMm,
    aperture: 11,
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
  focusDistanceRangeMm: geometry.focusDistanceRangeMm,
  cameraPlacement: geometry.observerCamera,
  bounds: geometry.sceneBounds,
  focusTargets: geometry.focusTargets,
  compositionTargets: [
    {
      id: "subject-board-plane",
      label: "Canonical inclined subject board plane",
      worldBounds: geometry.compositionTargetBounds,
    },
  ],
  movementCapabilities: {
    available: ["frontTiltDeg", "frontSwingDeg"],
    selectionMode: "multiple",
    defaultMovement: "frontTiltDeg",
  },
  cameraControlPolicy: {
    aperture: "fixed",
    infinityReset: false,
  },
};
