import type { SceneDefinition } from "../../types/scene";

export const shelfSwingScene: SceneDefinition = {
  id: "shelf-swing",
  name: "Shelf Swing",
  description: "Use swing to align focus plane with diagonal subject layout.",
  assets: [
    {
      id: "shelf-floor",
      kind: "model",
      source: "placeholder://shelf-floor.webp",
      textureFormat: "webp",
      loadStrategy: "eager",
    },
    {
      id: "shelf-diagonal-structure",
      kind: "model",
      source: "placeholder://shelf-structure.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "eager",
    },
    {
      id: "shelf-decor",
      kind: "model",
      source: "placeholder://shelf-decor.ktx2",
      textureFormat: "ktx2",
      loadStrategy: "lazy",
    },
  ],
  cameraPreset: {
    focusDistanceMm: 3200,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  cameraPlacement: {
    position: { x: -800, y: 1450, z: -450 },
    target: { x: 0, y: 1250, z: 3400 },
  },
  bounds: {
    min: { x: -2400, y: 700, z: 1100 },
    max: { x: 2400, y: 2600, z: 6200 },
  },
  focusTargets: [
    { id: "shelf-front", label: "Front shelf item", worldPosition: { x: -1100, y: 1250, z: 1700 }, weight: 1 },
    { id: "shelf-middle", label: "Middle shelf item", worldPosition: { x: 0, y: 1250, z: 3300 }, weight: 1 },
    { id: "shelf-back", label: "Back shelf item", worldPosition: { x: 1200, y: 1250, z: 5100 }, weight: 1 },
  ],
  compositionTargets: [
    {
      id: "shelf-diagonal",
      label: "Diagonal shelf coverage",
      worldBounds: {
        min: { x: -1300, y: 980, z: 1500 },
        max: { x: 1300, y: 1650, z: 5400 },
      },
    },
  ],
};
