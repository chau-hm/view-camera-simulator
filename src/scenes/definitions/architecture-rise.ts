import type { SceneDefinition } from "../../types/scene";
import geometry from "../architectureRiseGeometry";

export const architectureRiseScene: SceneDefinition = {
  id: "architecture-rise",
  name: "Architecture Rise",
  description: "Use rise to include building top without tilting camera body.",
  assets: [
    {
      id: "architecture-ground",
      kind: "model",
      source: "placeholder://architecture-ground.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
    {
      id: "architecture-building-facade",
      kind: "model",
      source: "placeholder://architecture-facade.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "eager",
    },
    {
      id: "architecture-sky",
      kind: "helper",
      source: "placeholder://architecture-sky.webp",
      textureFormat: "webp",
      loadStrategy: "lazy",
    },
  ],
  cameraPreset: {
    // initial focus distance set to the canonical façade focus distance
    focusDistanceMm: geometry.architectureFacadeFocusDistanceMm,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  cameraPlacement: {
    // Observer camera is intentionally separate from the physical camera datum.
    // This three-quarter view keeps the full camera, ground, and building visible.
    position: { x: 6500, y: 3000, z: -6500 },
    target: { x: 0, y: 900, z: 5600 },
  },
  bounds: {
    min: geometry.sceneBounds.min,
    max: geometry.sceneBounds.max,
  },
  focusTargets: [
    {
      id: "building-mid-facade",
      label: "Building mid facade",
      worldPosition: geometry.focusTarget.worldPosition,
      weight: 1,
    },
  ],
  compositionTargets: [
    {
      id: "building-top",
      label: "Building top should be visible",
      worldBounds: {
        min: geometry.compositionTargets.buildingTop.min,
        max: geometry.compositionTargets.buildingTop.max,
      },
    },
    {
      id: "building-main-body",
      label: "Main building body should stay framed",
      worldBounds: {
        min: geometry.compositionTargets.buildingMain.min,
        max: geometry.compositionTargets.buildingMain.max,
      },
    },
  ],
};
