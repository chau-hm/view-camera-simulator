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
    focusDistanceMm: 7200,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  cameraPlacement: {
    position: { x: 0, y: 1550, z: -1200 },
    target: { x: 0, y: 2600, z: 6500 },
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
