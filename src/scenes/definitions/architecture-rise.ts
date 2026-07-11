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
    // camera datum is near y = 0 for optics model; place camera behind the film at z = -1200
    position: { x: 0, y: 0, z: -1200 },
    target: { x: 0, y: geometry.building.center.y + 100, z: geometry.building.center.z - 1200 },
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
