import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createScenePlaneOverlayGeometry,
  getScenePlaneOverlayBounds,
} from "../../render/scenePlaneOverlayGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("scene-clipped optical overlays", () => {
  for (const scene of [architectureRiseScene, focusFundamentalsTwoTargets]) {
    it(`keeps ${scene.name} finite overlays renderable`, () => {
      const camera = {
        ...DEFAULT_CAMERA_STATE,
        ...scene.cameraPreset,
        activeSceneId: scene.id,
      };
      const optics = deriveOpticsState(camera, scene);
      const bounds = getScenePlaneOverlayBounds(scene);

      [optics.focusPlane, optics.depthOfFieldNearPlane, optics.depthOfFieldFarPlane]
        .filter((plane) => plane !== null && plane !== undefined)
        .forEach((plane) => {
          const geometry = createScenePlaneOverlayGeometry(plane!, bounds);
          expect(geometry).not.toBeNull();
          expect(geometry!.verticesMm.length).toBeGreaterThanOrEqual(3);
        });
    });
  }
});
