import type { SceneDefinition } from "../../types/scene";
import geometry from "../obliqueTabletopGeometry";

export const obliqueTabletopScene: SceneDefinition = {
  id: "oblique-tabletop",
  name: "Oblique Tabletop",
  description:
    "Photograph an oblique tabletop from an angle. In the neutral setup, different parts of the table fall at different depths, so you cannot keep the whole surface sharp at once.",
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
      id: "tabletop-surface",
      label: "Canonical tabletop surface",
      worldBounds: geometry.compositionTargetBounds,
    },
  ],
  cameraControlPolicy: {
    movement: "fixed",
    aperture: "fixed",
    infinityReset: false,
  },
};
