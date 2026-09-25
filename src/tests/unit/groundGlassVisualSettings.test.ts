import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { ACCEPTABLE_COC_DIAMETER_MM } from "../../core/optics/physicalSharpness";
import { createGroundGlassDofUniformState } from "../../render/createGroundGlassDofUniformState";
import {
  getGroundGlassDofVisualSettings,
  resolveGroundGlassDisplayOpticsState,
} from "../../render/groundGlassVisualSettings";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import geometry from "../../scenes/shelfSwingGeometry";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("Ground Glass visual settings", () => {
  it("keeps Shelf Swing plane presentation separate from physical blur scale", () => {
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
      displayBlurScale: 16,
      planeMode: "derived-planes",
    });
    expect(optics.diagnostics.groundGlassDofModel).toBe("parallel-thin-lens");
    expect(display.diagnostics.groundGlassDofModel).toBe("derived-planes");
    expect(display.focusPlane).toBe(optics.focusPlane);
    expect(display.depthOfFieldNearPlane).toBe(optics.depthOfFieldNearPlane);
    expect(display.depthOfFieldFarPlane).toBe(optics.depthOfFieldFarPlane);
  });

  it("uses one pedagogical blur scale across scenes without changing physical CoC", () => {
    for (const sceneId of [
      "architecture-rise",
      "focus-fundamentals-two-targets",
      "table-tilt",
      "shelf-swing",
      "oblique-tabletop",
      "oblique-architecture",
      "architecture-foreground",
    ]) {
      const settings = getGroundGlassDofVisualSettings(sceneId);
      expect(settings.displayBlurScale).toBe(16);
      expect("inspectionMagnification" in settings).toBe(false);
    }
    expect(getGroundGlassDofVisualSettings(architectureRiseScene.id).displayBlurScale).toBe(
      getGroundGlassDofVisualSettings(focusFundamentalsTwoTargets.id).displayBlurScale,
    );
  });

  it("preserves Architecture Rise physical sharpness while magnifying the preview gather", () => {
    const camera = {
      ...DEFAULT_CAMERA_STATE,
      ...architectureRiseScene.cameraPreset,
      activeSceneId: architectureRiseScene.id,
      focusDistanceMm: 13000,
      aperture: 5.6 as const,
      frontRiseMm: 22,
      frontTiltDeg: 0.4,
      frontSwingDeg: -1.1,
    };
    const optics = deriveOpticsState(camera, architectureRiseScene);
    const target = optics.focusTargets[0];
    const visual = getGroundGlassDofVisualSettings(architectureRiseScene.id);
    const uniformState = createGroundGlassDofUniformState(
      optics,
      new THREE.PerspectiveCamera(),
      camera.focalLengthMm,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      ACCEPTABLE_COC_DIAMETER_MM,
      camera.aperture,
      500,
      400,
      visual.maximumBlurRadiusPx,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      visual.displayBlurScale,
    );

    expect(target.pointEquivalentCoCDiameterMm).toBeCloseTo(0.169, 2);
    expect(target.physicalPointSharpness).toBe(0);
    expect(uniformState.circleOfConfusionMm).toBe(ACCEPTABLE_COC_DIAMETER_MM);
    expect(uniformState.displayBlurScale).toBe(16);
    expect(uniformState.displayBoundaryBlurRadiusPx).toBeCloseTo(
      uniformState.boundaryBlurRadiusPx * 16,
      12,
    );
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
    );
    expect(uniforms.mode).toBe(0);
    expect(uniforms.imageDistanceMm).toBeGreaterThan(0);
  });
});
