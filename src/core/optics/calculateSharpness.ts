import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";

export const calculateSharpness = (scene: SceneDefinition): FocusTargetSharpness[] =>
  scene.focusTargets.map((target) => ({
    id: target.id,
    sharpness: target.weight >= 1 ? 0.9 : 0.75,
    status: target.weight >= 1 ? "sharp" : "acceptable",
  }));
