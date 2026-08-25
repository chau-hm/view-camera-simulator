import { describe, expect, it } from "vitest";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { getGroundGlassDofVisualSettings } from "../../render/groundGlassVisualSettings";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import geometry, { reachableFrontRiseMm } from "../../scenes/obliqueArchitectureGeometry";
import {
  CAMERA_CONSTANTS,
  CAMERA_CONTROL_STEPS,
  DEFAULT_CAMERA_STATE,
} from "../../utils/constants";

const sceneCamera = {
  ...DEFAULT_CAMERA_STATE,
  ...obliqueArchitectureScene.cameraPreset,
  activeSceneId: obliqueArchitectureScene.id,
  activeTaskId: null,
  mode: "free" as const,
};

const projectRegion = (riseMm: number, y: number) => {
  const optics = deriveOpticsState(
    { ...sceneCamera, frontRiseMm: riseMm },
    obliqueArchitectureScene,
  );
  const project = (worldPoint: { x: number; y: number; z: number }) =>
    projectWorldPointToFilmPlaneGroundGlass({
      worldPoint,
      lensCenterWorld: optics.lensCenterWorld,
      filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
    });
  const corners = [geometry.building.leftX, geometry.building.rightX].flatMap((x) =>
    [geometry.building.nearZ, geometry.building.farZ].map((z) =>
      project({ x, y, z }),
    ),
  );

  return {
    optics,
    corners,
    minU: Math.min(...corners.map((corner) => corner.uRaw)),
    maxU: Math.max(...corners.map((corner) => corner.uRaw)),
    minV: Math.min(...corners.map((corner) => corner.vRaw)),
    maxV: Math.max(...corners.map((corner) => corner.vRaw)),
    allVisible: corners.every((corner) => corner.visible),
  };
};

describe("Oblique Architecture scene", () => {
  it("declares a level scene with Rise and Swing available for the compound slices", () => {
    expect(obliqueArchitectureScene.name).toBe("Oblique Architecture");
    expect(obliqueArchitectureScene.movementCapabilities).toEqual({
      available: ["frontRiseMm", "frontSwingDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontRiseMm",
    });
    expect(obliqueArchitectureScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
    expect(obliqueArchitectureScene.focusDistanceRangeMm).toEqual(
      geometry.focusDistanceRangeMm,
    );
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

  it("keeps the roof cropped at neutral and reachable through the public Rise step", () => {
    const neutralRoof = projectRegion(0, geometry.buildingTopY);
    const neutralBase = projectRegion(0, geometry.ground.y);
    const risenRoof = projectRegion(reachableFrontRiseMm, geometry.buildingTopY);
    const risenBase = projectRegion(reachableFrontRiseMm, geometry.ground.y);

    expect(neutralRoof.optics.diagnostics.fallbackApplied).toBe(false);
    expect(neutralRoof.allVisible).toBe(false);
    expect(neutralRoof.corners.some((corner) => corner.visible)).toBe(true);
    expect(neutralRoof.maxV).toBeGreaterThan(1);
    expect(neutralBase.allVisible).toBe(true);

    expect(reachableFrontRiseMm).toBeGreaterThan(0);
    expect(reachableFrontRiseMm).toBeLessThanOrEqual(CAMERA_CONSTANTS.riseMaxMm);
    expect(reachableFrontRiseMm % CAMERA_CONTROL_STEPS.riseMm).toBe(0);
    expect(risenRoof.allVisible).toBe(true);
    expect(risenRoof.minU).toBeGreaterThan(0);
    expect(risenRoof.maxU).toBeLessThan(1);
    expect(risenRoof.maxV).toBeLessThan(1);
    expect(risenBase.allVisible).toBe(true);
    expect(risenBase.minU).toBeGreaterThan(0);
    expect(risenBase.maxU).toBeLessThan(1);
    expect(risenBase.minV).toBeGreaterThan(0);
    expect(risenRoof.optics.rearStandardFrame).toEqual(
      neutralRoof.optics.rearStandardFrame,
    );
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

  it("uses the canonical physical defocus with an independent pixel cap", () => {
    const settings = getGroundGlassDofVisualSettings(obliqueArchitectureScene.id);

    expect(settings.planeMode).toBe("automatic");
    expect(settings.maximumBlurRadiusPx).toBe(48);
    expect("displayBlurScale" in settings).toBe(false);
    expect(obliqueArchitectureScene.cameraPreset.aperture).toBe(11);
  });
});
