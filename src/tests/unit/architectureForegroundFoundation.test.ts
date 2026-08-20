import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  projectWorldPointToFilmPlaneGroundGlass,
} from "../../render/groundGlassFilmPlaneProjection";
import {
  createRegisteredRttSubject,
  disposeRegisteredRttSubject,
  getSceneSubjectRegistration,
} from "../../render/sceneSubjectRegistry";
import { getSceneGeometryGuides } from "../../components/geometry/sceneGeometryGuides";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import geometry from "../../scenes/architectureForegroundGeometry";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const neutralCamera = {
  ...DEFAULT_CAMERA_STATE,
  ...architectureForegroundScene.cameraPreset,
  activeSceneId: architectureForegroundScene.id,
  activeTaskId: null,
  mode: "free" as const,
};

describe("Architecture + Foreground foundation", () => {
  it("defines a finite neutral scene with reusable composition and focus targets", () => {
    expect(architectureForegroundScene.id).toBe("architecture-foreground");
    expect(architectureForegroundScene.cameraPreset).toMatchObject({
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearTiltDeg: 0,
      focusDistanceMm: geometry.canonicalFocusDistanceMm,
      aperture: 11,
    });
    expect(architectureForegroundScene.cameraControlPolicy).toEqual({
      aperture: "fixed",
      infinityReset: false,
    });
    expect(architectureForegroundScene.movementCapabilities).toEqual({
      available: ["frontRiseMm", "frontTiltDeg"],
      selectionMode: "multiple",
      defaultMovement: "frontRiseMm",
    });
    expect(architectureForegroundScene.compositionTargets.map((target) => target.id)).toEqual([
      "building-top",
      "building-base",
      "building-main-body",
    ]);
    expect(architectureForegroundScene.focusTargets.map((target) => target.id)).toEqual([
      "foreground-near",
      "foreground-middle",
      "building-base",
      "building-middle",
    ]);
    expect(architectureForegroundScene.focusDistanceRangeMm).toEqual(
      geometry.focusDistanceRangeMm,
    );
    expect(architectureForegroundScene.bounds.min.z).toBeLessThan(
      architectureForegroundScene.bounds.max.z,
    );
    expect(architectureForegroundScene.bounds.min.y).toBeLessThan(
      architectureForegroundScene.bounds.max.y,
    );
    expect(geometry.getPavingSeamPositions().depthZ.length).toBeGreaterThan(10);
  });

  it("keeps the physical camera level, crops the roof, retains the base, and separates sharpness by depth", () => {
    const optics = deriveOpticsState(neutralCamera, architectureForegroundScene);
    const roofPoint = {
      x: 0,
      y: geometry.facade.parapetTopY,
      z: geometry.facade.frontFacadeZ,
    };
    const basePoint = {
      x: 0,
      y: geometry.ground.y,
      z: geometry.facade.frontFacadeZ,
    };
    const project = (state: typeof optics, worldPoint: typeof roofPoint) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: state.lensCenterWorld,
        filmPlaneCornersWorld: state.filmPlaneCornersWorld,
      });

    expect(optics.opticalAxis.direction.y).toBeCloseTo(0, 8);
    expect(optics.diagnostics.tiltAngleDeg).toBe(0);
    expect(optics.diagnostics.swingAngleDeg).toBe(0);
    expect(optics.cameraRigTransform.bodyPitchDeg).toBe(0);
    expect(optics.lensCenterWorld.y).toBe(0);
    expect(optics.rearStandardFrame.centerWorld.y).toBe(0);

    const projectedRoof = project(optics, roofPoint);
    const projectedBase = project(optics, basePoint);
    expect(projectedRoof.visible).toBe(false);
    expect(projectedBase.visible).toBe(true);

    const parapetBasePoint = { ...roofPoint, y: geometry.facade.parapetBottomY };
    expect(project(optics, parapetBasePoint).visible).toBe(true);

    const [leftEdge, rightEdge] = geometry.buildingVerticalEdges;
    const leftBottom = project(optics, leftEdge.bottom);
    const leftTop = project(optics, leftEdge.top);
    const rightBottom = project(optics, rightEdge.bottom);
    const rightTop = project(optics, rightEdge.top);
    expect(Math.abs(leftBottom.uRaw - leftTop.uRaw)).toBeLessThan(1e-8);
    expect(Math.abs(rightBottom.uRaw - rightTop.uRaw)).toBeLessThan(1e-8);

    const sharpness = Object.fromEntries(
      optics.focusTargets.map((target) => [target.id, target.sharpness]),
    );
    expect(sharpness["foreground-near"]).toBeLessThan(sharpness["building-middle"]);
    expect(sharpness["building-middle"]).toBeGreaterThanOrEqual(0.8);
    expect(sharpness["foreground-near"]).toBeLessThan(0.5);
    expect(sharpness["foreground-middle"]).toBeGreaterThan(sharpness["foreground-near"]);

    const riseOptics = deriveOpticsState(
      { ...neutralCamera, frontRiseMm: geometry.neutralCalibration.futureRiseMm },
      architectureForegroundScene,
    );
    expect(project(riseOptics, roofPoint).visible).toBe(true);

    const tiltedOptics = deriveOpticsState(
      { ...neutralCamera, frontTiltDeg: geometry.neutralCalibration.futureTiltProbeDeg },
      architectureForegroundScene,
    );
    expect(tiltedOptics.diagnostics.tiltAngleDeg).toBeGreaterThan(0);
    expect(tiltedOptics.focusPlane).not.toBeNull();
    expect(tiltedOptics.focusPlane?.normal.y).not.toBeCloseTo(optics.focusPlane?.normal.y ?? 0, 6);
    expect(geometry.cameraCalibration.rawFocusDistanceMm).toBeGreaterThanOrEqual(
      geometry.focusDistanceRangeMm.min,
    );
    expect(geometry.cameraCalibration.rawFocusDistanceMm).toBeLessThanOrEqual(
      geometry.focusDistanceRangeMm.max,
    );
    expect(CAMERA_CONSTANTS.apertureOptions).toEqual(expect.arrayContaining([11, 22]));
  });

  it("uses one registered native subject for the 3D scene and RTT", () => {
    const registration = getSceneSubjectRegistration(architectureForegroundScene.id);
    expect(registration).toBeDefined();
    const group = createRegisteredRttSubject(architectureForegroundScene.id);
    expect(group).not.toBeNull();
    expect(group?.name).toBe("architecture-foreground-subject");
    expect(group?.children.length).toBeGreaterThan(20);
    expect(group?.getObjectByName("architecture-foreground-building")).toBeDefined();
    expect(group?.getObjectByName("architecture-foreground-ground")).toBeDefined();
    disposeRegisteredRttSubject(architectureForegroundScene.id, group!);
  });

  it("provides side-view ground and building teaching guides", () => {
    expect(getSceneGeometryGuides(architectureForegroundScene.id)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "architecture-foreground-ground",
          view: "side",
        }),
        expect.objectContaining({
          id: "architecture-foreground-building-profile",
          view: "side",
        }),
      ]),
    );
  });
});
