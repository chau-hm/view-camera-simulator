import type { FocusTargetSharpness } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";

export const calculateSharpness = (scene: SceneDefinition): FocusTargetSharpness[] =>
  scene.focusTargets.map((target) => ({
    id: target.id,
    sharpness: target.importance === "primary" ? 0.9 : 0.75,
    status: target.importance === "primary" ? "sharp" : "acceptable",
  }));
