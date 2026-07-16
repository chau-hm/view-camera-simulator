import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { createGroundGlassDofUniformState } from "../../render/createGroundGlassDofUniformState";
import {
  getGroundGlassDofVisualSettings,
  resolveGroundGlassDisplayOpticsState,
} from "../../render/groundGlassVisualSettings";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry from "../../scenes/shelfSwingGeometry";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("Ground Glass visual settings", () => {
  it("calibrates Shelf Swing display blur without changing the source optics state", () => {
    const optics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...shelfSwingScene.cameraPreset,
        activeSceneId: shelfSwingScene.id,
        frontSwingDeg: 0,
        focusDistanceMm: geometry.middleSubject.focusDetailProbeWorld.z,
      },
      shelfSwingScene,
    );
    const display = resolveGroundGlassDisplayOpticsState(shelfSwingScene.id, optics);

    expect(getGroundGlassDofVisualSettings(shelfSwingScene.id)).toEqual({
      maximumBlurRadiusPx: 42,
      displayBlurScale: 3.2,
      planeMode: "derived-planes",
    });
    expect(optics.diagnostics.groundGlassDofModel).toBe("parallel-thin-lens");
    expect(display.diagnostics.groundGlassDofModel).toBe("derived-planes");
    expect(display.focusPlane).toBe(optics.focusPlane);
    expect(display.depthOfFieldNearPlane).toBe(optics.depthOfFieldNearPlane);
    expect(display.depthOfFieldFarPlane).toBe(optics.depthOfFieldFarPlane);
  });

  it("leaves unrelated scene optics untouched", () => {
    const optics = deriveOpticsState(
      { ...DEFAULT_CAMERA_STATE, ...shelfSwingScene.cameraPreset },
      shelfSwingScene,
    );
    expect(resolveGroundGlassDisplayOpticsState("architecture-rise", optics)).toBe(optics);
  });

  it("does not force finite derived planes during Shelf Swing infinity focus", () => {
    const infinityOptics = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...shelfSwingScene.cameraPreset,
        activeSceneId: shelfSwingScene.id,
        focusMode: "infinity",
      },
      shelfSwingScene,
    );

    expect(infinityOptics.focusPlane).toBeNull();
    const displayOptics = resolveGroundGlassDisplayOpticsState(
      shelfSwingScene.id,
      infinityOptics,
    );
    expect(displayOptics).toBe(infinityOptics);
    const uniforms = createGroundGlassDofUniformState(
      displayOptics,
      new THREE.PerspectiveCamera(),
      CAMERA_CONSTANTS.focalLengthMm,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      0.1,
      11,
      500,
      400,
      42,
      3.2,
    );
    expect(uniforms.mode).toBe(0);
    expect(uniforms.imageDistanceMm).toBeGreaterThan(0);
  });
});
