import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  getAllScenes,
  getSceneFocusDistanceRange,
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
import { viewCameraAnatomyScene } from "../../scenes/definitions/view-camera-anatomy";
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

  it("keeps canonical shift and rear swing dormant outside Lesson 0", () => {
    for (const scene of getAllScenes().filter((candidate) => candidate.id !== viewCameraAnatomyScene.id)) {
      expect(scene.movementCapabilities?.available ?? []).not.toContain("frontShiftMm");
      expect(scene.movementCapabilities?.available ?? []).not.toContain("rearShiftMm");
      expect(scene.movementCapabilities?.available ?? []).not.toContain("rearSwingDeg");
    }
  });

  it("exposes only the front movement controls needed by Lesson 0", () => {
    expect(viewCameraAnatomyScene.movementCapabilities).toEqual({
      available: [
        "frontRiseMm",
        "frontShiftMm",
        "frontTiltDeg",
        "frontSwingDeg",
      ],
      selectionMode: "multiple",
      defaultMovement: "frontRiseMm",
    });
    expect(viewCameraAnatomyScene.movementCapabilities?.available).not.toContain("rearShiftMm");
    expect(viewCameraAnatomyScene.movementCapabilities?.available).not.toContain("rearSwingDeg");
  });

  it("declares Lesson 0's selectable focus as travel relative to its scene baseline", () => {
    expect(viewCameraAnatomyScene.focusStandardCapability?.placement).toBe("scene-baseline");
    expect(focusFundamentalsTwoTargets.focusStandardCapability?.placement).toBe("rear-datum");
  });

  it("defines architecture composition targets for top and main building", () => {
    const compositionTargetIds = architectureRiseScene.compositionTargets.map(
      (target) => target.id,
    );
    expect(compositionTargetIds).toContain("building-top");
    expect(compositionTargetIds).toContain("building-main-body");
    expect(architectureRiseScene.cameraPreset.frontRiseMm).toBe(0);
  });

  it("keeps real-image finite-focus ranges strictly beyond the current focal length", () => {
    expect(architectureRiseScene.finiteFocusStrategy?.focusDistanceReference).toBe(
      "lens-to-focus-plane",
    );
    expect(getSceneFocusDistanceRange(architectureRiseScene.id, 150).min).toBe(160);
    expect(getSceneFocusDistanceRange(tableTiltScene.id, 150).min).toBe(160);
    expect(getSceneFocusDistanceRange(architectureRiseScene.id, 150).min).toBeGreaterThan(150);
    expect(getSceneFocusDistanceRange(tableTiltScene.id, 150).min).toBeGreaterThan(150);
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

  it("defines the Oblique Architecture scene with the shared Rise/Swing capability", () => {
    expect(obliqueArchitectureScene.description).toBe(
      "Combine Front Rise and Front Swing to frame an oblique building while keeping verticals parallel and the receding façade sharp.",
    );
    expect(obliqueArchitectureScene.cameraPreset.focusDistanceMm).toBe(
      obliqueArchitectureGeometry.canonicalFocusDistanceMm,
    );
    expect(obliqueArchitectureScene.focusDistanceRangeMm).toEqual(
      obliqueArchitectureGeometry.focusDistanceRangeMm,
    );
    expect(getSceneFocusDistanceRange(obliqueArchitectureScene.id)).toEqual(
      obliqueArchitectureGeometry.focusDistanceRangeMm,
    );
    expect(obliqueArchitectureScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
    expect(obliqueArchitectureScene.movementCapabilities).toEqual({
      available: ["frontRiseMm", "frontSwingDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontRiseMm",
    });
    expect(obliqueArchitectureScene.focusTargets).toEqual(
      obliqueArchitectureGeometry.focusTargets,
    );
    expect(obliqueArchitectureScene.compositionTargets.map((target) => target.id)).toEqual([
      "building-top",
      "building-base",
      "target-facade",
    ]);
    expect(sceneOrder).toContain("oblique-architecture");
  });

  it("preserves larger explicit focus ranges above the physical floor", () => {
    expect(getSceneFocusDistanceRange("architecture-foreground", 150).min).toBe(
      3500,
    );
    expect(getSceneFocusDistanceRange(obliqueArchitectureScene.id, 150)).toEqual(
      obliqueArchitectureGeometry.focusDistanceRangeMm,
    );
  });

  it("derives the table range from scene bounds while applying the real-image floor", () => {
    expect(getSceneFocusDistanceRange(tableTiltScene.id)).toEqual({
      min: Math.max(160, tableTiltScene.bounds.min.z),
      max: Math.max(tableTiltScene.bounds.min.z, tableTiltScene.bounds.max.z),
    });
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
    expect(nextSceneId).toBe("architecture-foreground");
    expect(preload.length).toBeGreaterThan(0);
    expect(sceneOrder.at(-1)).toBe("oblique-architecture");
    expect(getNextSceneId("mirror-shift")).toBe("oblique-architecture");
    expect(getNextSceneId("oblique-architecture")).toBeNull();
  });
});
