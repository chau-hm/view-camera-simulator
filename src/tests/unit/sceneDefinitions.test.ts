import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  getAllScenes,
  getLazySceneAssets,
  getNextSceneId,
  getPreloadSceneAssets,
  getRequiredSceneAssets,
  sceneOrder,
  sceneRegistry,
} from "../../scenes/definitions";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { mirrorShiftScene } from "../../scenes/definitions/mirror-shift";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

describe("scene definitions", () => {
  it("registers the core scenes", () => {
    // allow additional debug scenes to be registered in tests/environments
    expect(Object.keys(sceneRegistry)).toEqual(
      expect.arrayContaining([
        "architecture-rise",
        "oblique-architecture",
        "table-tilt",
        "shelf-swing",
      ]),
    );
    expect(sceneRegistry["table-tilt"]).toBe(tableTiltScene);
    expect(sceneRegistry["mirror-shift"]).toBe(mirrorShiftScene);
    expect(sceneRegistry["oblique-architecture"]).toBe(obliqueArchitectureScene);
    expect(sceneOrder).toContain("table-tilt");
    expect(sceneOrder).toContain("mirror-shift");
    expect(getAllScenes().length).toBeGreaterThanOrEqual(3);
  });

  it("defines architecture composition targets for top and main building", () => {
    const compositionTargetIds = architectureRiseScene.compositionTargets.map(
      (target) => target.id,
    );
    expect(compositionTargetIds).toContain("building-top");
    expect(compositionTargetIds).toContain("building-main-body");
    expect(architectureRiseScene.cameraPreset.frontRiseMm).toBe(0);
  });

  it("defines near/mid/far table focus targets", () => {
    const focusTargetIds = tableTiltScene.focusTargets.map((target) => target.id);
    expect(focusTargetIds).toEqual(["near-cup", "mid-notebook", "far-book"]);
  });

  it("locks Focus Fundamentals to its fixed f/32 teaching aperture", () => {
    expect(focusFundamentalsTwoTargets.cameraPreset.aperture).toBe(32);
    expect(focusFundamentalsTwoTargets.cameraControlPolicy?.aperture).toBe("fixed");
  });

  it("keeps Mirror Shift in a fixed neutral camera state", () => {
    expect(mirrorShiftScene.name).toBe("Mirror Shift");
    expect(mirrorShiftScene.cameraControlPolicy).toEqual({
      movement: "fixed",
      focusDistance: "fixed",
      aperture: "fixed",
      infinityReset: false,
    });
    expect(mirrorShiftScene.focusTargets).toHaveLength(0);
    expect(mirrorShiftScene.compositionTargets).toHaveLength(0);
  });

  it("defines the Oblique Architecture static problem without a guided task", () => {
    expect(obliqueArchitectureScene.cameraPreset.focusDistanceMm).toBe(
      obliqueArchitectureGeometry.canonicalFocusDistanceMm,
    );
    expect(obliqueArchitectureScene.cameraControlPolicy).toEqual({
      movement: "fixed",
      focusDistance: "fixed",
      aperture: "fixed",
      infinityReset: false,
    });
    expect(obliqueArchitectureScene.focusTargets).toEqual(
      obliqueArchitectureGeometry.focusTargets,
    );
    expect(obliqueArchitectureScene.compositionTargets.map((target) => target.id)).toEqual([
      "building-top",
      "target-facade",
    ]);
    expect(sceneOrder).toContain("oblique-architecture");
  });

  it("defines near/mid/far shelf focus targets", () => {
    const focusTargetIds = shelfSwingScene.focusTargets.map((target) => target.id);
    expect(focusTargetIds).toEqual(["shelf-front", "shelf-middle", "shelf-back"]);
    expect(shelfSwingScene.cameraPreset.focusDistanceMm).toBe(
      shelfSwingGeometry.canonicalFocusDistanceMm,
    );
    expect(shelfSwingScene.cameraPlacement).toEqual(shelfSwingGeometry.observerCamera);
    expect(shelfSwingScene.bounds).toEqual(shelfSwingGeometry.sceneBounds);
    expect(shelfSwingScene.focusTargets).toEqual(shelfSwingGeometry.focusTargets);
    expect(shelfSwingScene.compositionTargets[0].worldBounds).toEqual(
      shelfSwingGeometry.compositionTargetBounds,
    );
  });

  it("keeps three table targets not all sharp at zero tilt and f/22", () => {
    const opticsState = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        activeSceneId: tableTiltScene.id,
        aperture: 22,
        frontTiltDeg: 0,
      },
      tableTiltScene,
    );

    const allSharp = opticsState.focusTargets.every((target) => target.sharpness >= 0.8);
    expect(allSharp).toBe(false);
  });

  it("keeps three shelf targets not all sharp at zero swing and f/22", () => {
    const opticsState = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        activeSceneId: shelfSwingScene.id,
        aperture: 22,
        frontSwingDeg: 0,
      },
      shelfSwingScene,
    );

    const allSharp = opticsState.focusTargets.every((target) => target.sharpness >= 0.8);
    expect(allSharp).toBe(false);
  });

  it("exposes required, lazy, and preload scene assets", () => {
    const required = getRequiredSceneAssets("architecture-rise");
    const lazy = getLazySceneAssets("architecture-rise");
    const nextSceneId = getNextSceneId("architecture-rise");
    const preload = getPreloadSceneAssets("architecture-rise");

    expect(required.length).toBeGreaterThan(0);
    expect(lazy.length).toBeGreaterThan(0);
    expect(nextSceneId).toBe("table-tilt");
    expect(preload.length).toBeGreaterThan(0);
    expect(sceneOrder.at(-1)).toBe("oblique-architecture");
    expect(getNextSceneId("mirror-shift")).toBe("oblique-architecture");
    expect(getNextSceneId("oblique-architecture")).toBeNull();
  });
});
