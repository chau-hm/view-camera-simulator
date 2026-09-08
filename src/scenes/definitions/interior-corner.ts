import type { SceneDefinition } from "../../types/scene";
import geometry from "../interiorCornerGeometry";

export const interiorCornerScene: SceneDefinition = {
  id: "interior-corner",
  name: "Interior Corner — Rise + Swing",
  description:
    "Explore a neutral interior corner where upper architectural detail presses against the frame and one receding wall creates a future Front Swing and Focus problem.",
  assets: [
    {
      id: "interior-corner-room",
      kind: "model",
      source: "placeholder://interior-corner-room.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
  ],
  cameraPreset: {
    focalLengthMm: 150,
    focusDistanceMm: geometry.canonicalFocusDistanceMm,
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
  focusDistanceRangeMm: geometry.focusDistanceRangeMm,
  cameraPlacement: geometry.observerCamera,
  bounds: geometry.sceneBounds,
  focusTargets: geometry.focusTargets,
  compositionTargets: [
    {
      id: "upper-architecture",
      label: "Upper architectural detail",
      worldBounds: geometry.compositionTargets.upperArchitecture,
    },
    {
      id: "room-corner",
      label: "Interior room corner",
      worldBounds: geometry.compositionTargets.roomCorner,
    },
    {
      id: "receding-wall",
      label: "Receding side wall",
      worldBounds: geometry.compositionTargets.recedingWall,
    },
  ],
  movementCapabilities: {
    available: ["frontRiseMm", "frontSwingDeg"],
    selectionMode: "multiple",
    defaultMovement: "frontRiseMm",
  },
  cameraControlPolicy: {
    infinityReset: false,
  },
  showReferenceCamera: false,
};
