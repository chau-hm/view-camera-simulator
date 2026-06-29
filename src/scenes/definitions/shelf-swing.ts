import type { SceneDefinition } from "../../types/scene";

export const shelfSwingScene: SceneDefinition = {
  id: "shelf-swing",
  name: "Shelf Swing",
  description: "Use swing to align focus plane with diagonal subject layout.",
  bounds: {
    min: { x: -2000, y: 0, z: 0 },
    max: { x: 2000, y: 2800, z: 7000 },
  },
  focusTargets: [
    { id: "shelf-front", worldPosition: { x: -1000, y: 1200, z: 1800 }, importance: "primary" },
    { id: "shelf-back", worldPosition: { x: 1000, y: 1200, z: 5200 }, importance: "secondary" },
  ],
};
