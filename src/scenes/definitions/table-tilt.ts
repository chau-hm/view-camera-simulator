import type { SceneDefinition } from "../../types/scene";

export const tableTiltScene: SceneDefinition = {
  id: "table-tilt",
  name: "Table Tilt",
  description: "Use tilt to align focus plane with the table surface.",
  assets: [
    {
      id: "table-floor",
      kind: "model",
      source: "placeholder://table-floor.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
    {
      id: "table-top",
      kind: "model",
      source: "placeholder://table-top.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "eager",
    },
    {
      id: "table-props",
      kind: "model",
      source: "placeholder://table-props.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "lazy",
    },
  ],
  cameraPreset: {
    focusDistanceMm: 2400,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  cameraPlacement: {
    position: { x: 0, y: 1350, z: -500 },
    target: { x: 0, y: 860, z: 2600 },
  },
  bounds: {
    min: { x: -1800, y: 650, z: 900 },
    max: { x: 1800, y: 1300, z: 4200 },
  },
  focusTargets: [
    { id: "near-cup", label: "Near cup", worldPosition: { x: -650, y: 840, z: 1200 }, weight: 1 },
    { id: "mid-notebook", label: "Middle notebook", worldPosition: { x: 50, y: 840, z: 2400 }, weight: 1 },
    { id: "far-book", label: "Far book", worldPosition: { x: 550, y: 840, z: 3600 }, weight: 1 },
  ],
  compositionTargets: [
    {
      id: "table-surface",
      label: "Table surface alignment",
      worldBounds: {
        min: { x: -1400, y: 760, z: 1000 },
        max: { x: 1400, y: 980, z: 3800 },
      },
    },
  ],
};
