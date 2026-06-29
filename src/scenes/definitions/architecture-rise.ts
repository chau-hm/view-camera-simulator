import type { SceneDefinition } from "../../types/scene";

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
    min: { x: -2600, y: 0, z: 800 },
    max: { x: 2600, y: 10800, z: 13200 },
  },
  focusTargets: [
    {
      id: "building-mid-facade",
      label: "Building mid facade",
      worldPosition: { x: 0, y: 3600, z: 9000 },
      weight: 1,
    },
  ],
  compositionTargets: [
    {
      id: "building-top",
      label: "Building top should be visible",
      worldBounds: {
        min: { x: -900, y: 9300, z: 9000 },
        max: { x: 900, y: 10200, z: 9800 },
      },
    },
    {
      id: "building-main-body",
      label: "Main building body should stay framed",
      worldBounds: {
        min: { x: -1400, y: 1200, z: 8600 },
        max: { x: 1400, y: 9200, z: 10100 },
      },
    },
  ],
};
