import { deriveOpticsState } from "../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../scenes/definitions/architecture-rise";
import { getSceneById } from "../scenes/definitions";
import type { CameraState } from "../types/camera";
import type { DerivedOpticsState } from "../types/optics";

export const selectDerivedOpticsState = (camera: CameraState): DerivedOpticsState => {
  const scene = getSceneById(camera.activeSceneId) ?? architectureRiseScene;
  return deriveOpticsState(camera, scene);
};
