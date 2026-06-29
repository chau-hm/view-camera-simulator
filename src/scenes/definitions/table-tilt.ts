import type { SceneDefinition } from "../../types/scene";

export const tableTiltScene: SceneDefinition = {
  id: "table-tilt",
  name: "Table Tilt",
  description: "Use tilt to align focus plane with the table surface.",
  bounds: {
    min: { x: -1500, y: 0, z: 0 },
    max: { x: 1500, y: 1200, z: 5000 },
  },
  focusTargets: [
    { id: "near-cup", worldPosition: { x: -200, y: 800, z: 1200 }, importance: "primary" },
    { id: "far-book", worldPosition: { x: 200, y: 800, z: 3000 }, importance: "secondary" },
  ],
};
