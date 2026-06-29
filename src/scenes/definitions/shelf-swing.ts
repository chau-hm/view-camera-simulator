import type { SceneDefinition } from "../../types/scene";

export const shelfSwingScene: SceneDefinition = {
  id: "shelf-swing",
  name: "Shelf Swing",
  description: "Use swing to align focus plane with diagonal subject layout.",
  assets: [{ id: "shelf-layout", kind: "model", source: "placeholder://shelf-layout" }],
  cameraPreset: {
    focusDistanceMm: 2000,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  bounds: {
    min: { x: -2000, y: 0, z: 0 },
    max: { x: 2000, y: 2800, z: 7000 },
  },
  focusTargets: [
    { id: "shelf-front", label: "Front shelf item", worldPosition: { x: -1000, y: 1200, z: 1800 }, weight: 1 },
    { id: "shelf-back", label: "Back shelf item", worldPosition: { x: 1000, y: 1200, z: 5200 }, weight: 0.8 },
  ],
  compositionTargets: [
    {
      id: "shelf-diagonal",
      label: "Diagonal shelf coverage",
      worldBounds: {
        min: { x: -1200, y: 900, z: 1500 },
        max: { x: 1200, y: 1500, z: 5500 },
      },
    },
  ],
};
