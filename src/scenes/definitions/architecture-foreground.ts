import type { SceneDefinition } from "../../types/scene";
import geometry from "../architectureForegroundGeometry";

export const architectureForegroundScene: SceneDefinition = {
  id: "architecture-foreground",
  name: "Architecture + Foreground",
  description:
    "Frame a level architectural subject while observing how foreground depth creates a second focusing problem.",
  assets: [
    {
      id: "architecture-foreground-ground",
      kind: "model",
      source: "placeholder://architecture-foreground-ground.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
    {
      id: "architecture-foreground-building",
      kind: "model",
      source: "placeholder://architecture-foreground-building.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "eager",
    },
    {
      id: "architecture-foreground-sky",
      kind: "helper",
      source: "placeholder://architecture-foreground-sky.webp",
      textureFormat: "webp",
      loadStrategy: "lazy",
    },
  ],
  cameraPreset: {
    focalLengthMm: geometry.cameraCalibration.focalLengthMm,
    focusDistanceMm: geometry.canonicalFocusDistanceMm,
    aperture: geometry.cameraCalibration.startingAperture,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
    rearRiseMm: 0,
    rearShiftMm: 0,
    rearTiltDeg: 0,
    rearSwingDeg: 0,
  },
  cameraPlacement: geometry.observerCamera,
  bounds: geometry.sceneBounds,
  focusTargets: geometry.focusTargets,
  finiteFocusStrategy: {
    kind: "rear-standard-thin-lens",
    lensDatum: "baseline-origin",
    focusDistanceReference: "lens-to-focus-plane",
    // This guided Tilt + Focus lesson measures focus distance along the
    // current tilted optical axis, so the rear film depth remains conjugate
    // to that axis rather than retaining a fixed rear-standard Z datum.
    filmDepthReference: "optical-axis-conjugate",
  },
  compositionTargets: [
    {
      id: "building-top",
      label: "Required building roof region",
      worldBounds: geometry.compositionTargets.buildingTop,
    },
    {
      id: "building-base",
      label: "Required building base region",
      worldBounds: geometry.compositionTargets.buildingBase,
    },
    {
      id: "building-main-body",
      label: "Main building body",
      worldBounds: geometry.compositionTargets.buildingMain,
    },
  ],
  focusDistanceRangeMm: geometry.focusDistanceRangeMm,
  movementCapabilities: {
    available: ["frontRiseMm", "frontTiltDeg"],
    selectionMode: "multiple",
    defaultMovement: "frontRiseMm",
  },
  cameraControlPolicy: {
    infinityReset: false,
  },
};
