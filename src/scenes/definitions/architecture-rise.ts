import type { SceneDefinition } from "../../types/scene";

export const architectureRiseScene: SceneDefinition = {
  id: "architecture-rise",
  name: "Architecture Rise",
  description: "Use rise to include building top without tilting camera body.",
  bounds: {
    min: { x: -2000, y: 0, z: 0 },
    max: { x: 2000, y: 5000, z: 10000 },
  },
  focusTargets: [
    { id: "building-mid", worldPosition: { x: 0, y: 2000, z: 6000 }, importance: "primary" },
  ],
};
