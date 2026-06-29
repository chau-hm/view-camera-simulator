import type { SceneDefinition } from "../../types/scene";

export const architectureRiseScene: SceneDefinition = {
  id: "architecture-rise",
  name: "Architecture Rise",
  description: "Use rise to include building top without tilting camera body.",
  assets: [{ id: "architecture-block", kind: "model", source: "placeholder://architecture-block" }],
  cameraPreset: {
    focusDistanceMm: 2000,
    aperture: 11,
    frontRiseMm: 0,
    frontTiltDeg: 0,
    frontSwingDeg: 0,
  },
  bounds: {
    min: { x: -2000, y: 0, z: 0 },
    max: { x: 2000, y: 5000, z: 10000 },
  },
  focusTargets: [
    { id: "building-mid", label: "Building mid facade", worldPosition: { x: 0, y: 2000, z: 6000 }, weight: 1 },
  ],
  compositionTargets: [
    {
      id: "building-frame",
      label: "Building should fit in frame",
      worldBounds: {
        min: { x: -1000, y: 500, z: 5000 },
        max: { x: 1000, y: 4200, z: 7600 },
      },
    },
  ],
};
