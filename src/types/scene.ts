import type { Bounds3, Vec3 } from "./optics";

export type FocusTarget = {
  id: string;
  worldPosition: Vec3;
  importance: "primary" | "secondary";
};

export type SceneDefinition = {
  id: string;
  name: string;
  description: string;
  bounds: Bounds3;
  focusTargets: FocusTarget[];
};
