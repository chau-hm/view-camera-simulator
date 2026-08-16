import { describe, expect, it } from "vitest";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { getGroundGlassDofVisualSettings } from "../../render/groundGlassVisualSettings";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import geometry from "../../scenes/obliqueArchitectureGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const sceneCamera = {
  ...DEFAULT_CAMERA_STATE,
  ...obliqueArchitectureScene.cameraPreset,
  activeSceneId: obliqueArchitectureScene.id,
  activeTaskId: null,
  mode: "free" as const,
};

describe("Oblique Architecture — Static Problem", () => {
  it("declares a fixed, level before-state with a receding façade", () => {
    expect(obliqueArchitectureScene.cameraControlPolicy).toEqual({
      movement: "fixed",
      focusDistance: "fixed",
      aperture: "fixed",
      infinityReset: false,
    });
    expect(obliqueArchitectureScene.cameraPreset).toMatchObject({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
    });
    expect(geometry.focusTargets.map((target) => target.worldPosition.z)).toEqual([
      geometry.sideWindowColumnCenters[0],
      geometry.sideWindowColumnCenters[3],
      geometry.sideWindowColumnCenters[6],
    ]);
    expect(geometry.focusTargets[0].worldPosition.z).toBeLessThan(
      geometry.focusTargets[1].worldPosition.z,
    );
    expect(geometry.focusTargets[1].worldPosition.z).toBeLessThan(
      geometry.focusTargets[2].worldPosition.z,
    );
  });

  it("keeps the rear standard level so a building vertical projects vertically", () => {
    const optics = deriveOpticsState(sceneCamera, obliqueArchitectureScene);

    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.rearStandardFrame.rightWorld.x).toBeCloseTo(1, 8);
    expect(optics.rearStandardFrame.rightWorld.y).toBeCloseTo(0, 8);
    expect(optics.rearStandardFrame.upWorld.x).toBeCloseTo(0, 8);
    expect(optics.rearStandardFrame.upWorld.y).toBeCloseTo(1, 8);
    expect(optics.rearStandardFrame.normalWorld.y).toBeCloseTo(0, 8);

    const project = (worldPoint: { x: number; y: number; z: number }) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      });
    const bottom = project({
      x: geometry.building.leftX + 900,
      y: geometry.ground.y + 200,
      z: geometry.building.nearZ,
    });
    const top = project({
      x: geometry.building.leftX + 900,
      y: geometry.buildingTopY,
      z: geometry.building.nearZ,
    });
    const farVerticalBottom = project({
      x: geometry.building.leftX + 900,
      y: geometry.ground.y + 200,
      z: geometry.building.farZ,
    });

    expect(bottom.visible).toBe(true);
    expect(top.visible).toBe(false);
    expect(bottom.uRaw).toBeCloseTo(top.uRaw, 8);
    expect(farVerticalBottom.uRaw).not.toBeCloseTo(bottom.uRaw, 2);
  });

  it("keeps the near and far façade samples from being uniformly sharp", () => {
    const optics = deriveOpticsState(sceneCamera, obliqueArchitectureScene);
    const sharpnessById = new Map(
      optics.focusTargets.map((target) => [target.id, target.sharpness]),
    );

    expect(optics.focusTargets).toHaveLength(3);
    expect(sharpnessById.get("facade-middle")).toBeGreaterThan(
      sharpnessById.get("facade-near") ?? 1,
    );
    expect(sharpnessById.get("facade-middle")).toBeGreaterThan(
      sharpnessById.get("facade-far") ?? 1,
    );
    expect(optics.focusTargets.some((target) => target.status !== "sharp")).toBe(true);
  });

  it("uses the canonical physical defocus with a restrained Ground Glass display calibration", () => {
    const settings = getGroundGlassDofVisualSettings(obliqueArchitectureScene.id);

    expect(settings.planeMode).toBe("automatic");
    expect(settings.maximumBlurRadiusPx).toBe(48);
    expect(settings.displayBlurScale).toBeGreaterThan(1);
    expect(obliqueArchitectureScene.cameraPreset.aperture).toBe(5.6);
  });
});
