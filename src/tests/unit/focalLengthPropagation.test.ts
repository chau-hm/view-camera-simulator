import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { configureGroundGlassCamera } from "../../render/configureGroundGlassCamera";
import { createGroundGlassDofUniformState } from "../../render/createGroundGlassDofUniformState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import { getGroundGlassClipRangeWorld } from "../../render/groundGlassRttScenes";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const FOCAL_LENGTHS_MM = [90, 105, 120, 150] as const;

describe("scene focal length propagation", () => {
  it.each(FOCAL_LENGTHS_MM)(
    "propagates %i mm through optics, projection, image distance, and DOF uniforms",
    (focalLengthMm) => {
      const cameraState = {
        ...DEFAULT_CAMERA_STATE,
        ...understandingCameraMovementsScene.cameraPreset,
        activeSceneId: understandingCameraMovementsScene.id,
        focalLengthMm,
      };
      const optics = deriveOpticsState(
        cameraState,
        understandingCameraMovementsScene,
      );

      expect(optics.filmCenterWorld.z).toBeCloseTo(-focalLengthMm, 8);
      expect(
        Object.values(optics.filmPlaneCornersWorld).flatMap((point) =>
          point ? [point.x, point.y, point.z] : [],
        ).every(Number.isFinite),
      ).toBe(true);

      const camera = new THREE.PerspectiveCamera();
      const clip = getGroundGlassClipRangeWorld(
        understandingCameraMovementsScene,
        optics.lensCenterWorld,
      );
      const projection = configureGroundGlassCamera(
        camera,
        optics,
        clip.near,
        clip.far,
      );
      expect(projection.ok).toBe(true);
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);

      const uniforms = createGroundGlassDofUniformState(
        optics,
        camera,
        focalLengthMm,
        127,
        101.6,
        0.1,
        32,
        500,
        400,
        12,
      );
      expect(uniforms.focalLengthMm).toBe(focalLengthMm);
      expect(Number.isFinite(uniforms.imageDistanceMm)).toBe(true);
      expect(uniforms.imageDistanceMm).toBeCloseTo(focalLengthMm, 8);
      expect(uniforms.inverseProjectionMatrix.every(Number.isFinite)).toBe(true);
    },
  );
});
