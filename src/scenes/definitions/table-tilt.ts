import type { SceneDefinition } from "../../types/scene";

export const tableTiltScene: SceneDefinition = {
  id: "table-tilt",
  name: "Table Tilt",
  description: "Use tilt to align focus plane with the table surface.",
  assets: [{ id: "table-setup", kind: "model", source: "placeholder://table-setup" }],
  cameraPreset: {
    focusDistanceMm: 2000,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  bounds: {
    min: { x: -1500, y: 0, z: 0 },
    max: { x: 1500, y: 1200, z: 5000 },
  },
  focusTargets: [
    { id: "near-cup", label: "Near cup", worldPosition: { x: -200, y: 800, z: 1200 }, weight: 1 },
    { id: "far-book", label: "Far book", worldPosition: { x: 200, y: 800, z: 3000 }, weight: 0.8 },
  ],
  compositionTargets: [
    {
      id: "table-surface",
      label: "Table surface alignment",
      worldBounds: {
        min: { x: -1200, y: 700, z: 900 },
        max: { x: 1200, y: 900, z: 3300 },
      },
    },
  ],
};
