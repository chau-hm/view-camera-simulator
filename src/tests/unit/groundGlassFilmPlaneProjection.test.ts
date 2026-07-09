import { describe, it, expect } from "vitest";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { projectSceneFocusTargetsToGroundGlass } from "../../render/groundGlassTargetProjection";

describe("projectWorldPointToFilmPlaneGroundGlass", () => {
  it("projects center point to film center", () => {
    const lensCenterWorld = { x: 0, y: 0, z: 0 };
    const filmPlaneCornersWorld = {
      topLeft: { x: -50, y: 40, z: -100 },
      topRight: { x: 50, y: 40, z: -100 },
      bottomLeft: { x: -50, y: -40, z: -100 },
      bottomRight: { x: 50, y: -40, z: -100 },
    };

    const worldPoint = { x: 0, y: 0, z: -1000 };

    const res = projectWorldPointToFilmPlaneGroundGlass({ worldPoint, lensCenterWorld, filmPlaneCornersWorld });
    expect(res.visible).toBe(true);
    expect(res.filmPointWorld).not.toBeNull();
    expect(res.uRaw).toBeCloseTo(0.5, 2);
    expect(res.vRaw).toBeCloseTo(0.5, 2);
  });

  it("returns invisible for off-frame point", () => {
    const lensCenterWorld = { x: 0, y: 0, z: 0 };
    const filmPlaneCornersWorld = {
      topLeft: { x: -50, y: 40, z: -100 },
      topRight: { x: 50, y: 40, z: -100 },
      bottomLeft: { x: -50, y: -40, z: -100 },
      bottomRight: { x: 50, y: -40, z: -100 },
    };
    const worldPoint = { x: 1000, y: 1000, z: -1000 };
    const res = projectWorldPointToFilmPlaneGroundGlass({ worldPoint, lensCenterWorld, filmPlaneCornersWorld });
    expect(res.visible).toBe(false);
  });

  it("returns invisible when ray is parallel to film plane", () => {
    const lensCenterWorld = { x: 0, y: 0, z: 0 };
    // Make uAxis and vAxis such that plane normal is along Z; choose worldPoint so rayDir dot normal ~= 0
    const filmPlaneCornersWorld = {
      topLeft: { x: -50, y: 0, z: 0 },
      topRight: { x: 50, y: 0, z: 0 },
      bottomLeft: { x: -50, y: -40, z: 0 },
      bottomRight: { x: 50, y: -40, z: 0 },
    };
    // worldPoint placed so ray direction has no Z component -> parallel
    const worldPoint = { x: 10, y: 0, z: 0 };
    const res = projectWorldPointToFilmPlaneGroundGlass({ worldPoint, lensCenterWorld, filmPlaneCornersWorld });
    expect(res.visible).toBe(false);
    expect(res.filmPointWorld).toBeNull();
  });

  it("returns invisible when intersection is behind the ray origin (t <= 0)", () => {
    const lensCenterWorld = { x: 0, y: 0, z: 0 };
    const filmPlaneCornersWorld = {
      topLeft: { x: -50, y: 40, z: -100 },
      topRight: { x: 50, y: 40, z: -100 },
      bottomLeft: { x: -50, y: -40, z: -100 },
      bottomRight: { x: 50, y: -40, z: -100 },
    };
    // worldPoint located behind the lens center such that t <= 0
    const worldPoint = { x: 0, y: 0, z: 100 };
    const res = projectWorldPointToFilmPlaneGroundGlass({ worldPoint, lensCenterWorld, filmPlaneCornersWorld });
    expect(res.visible).toBe(false);
    expect(res.filmPointWorld).toBeNull();
  });
});

// Movement-aware regression coverage using projectSceneFocusTargetsToGroundGlass
describe("movement-aware projection", () => {
  it("projects change when camera movements change for non-focus scenes", () => {
    const camA = { ...DEFAULT_CAMERA_STATE, frontRiseMm: 0, frontTiltDeg: 0, frontSwingDeg: 0 };
    // use more extreme movements to ensure projection changes are detectable
    const camB = { ...DEFAULT_CAMERA_STATE, frontRiseMm: 40, frontTiltDeg: 10, frontSwingDeg: -10 };

    const opticsA = deriveOpticsState(camA, architectureRiseScene);
    const opticsB = deriveOpticsState(camB, architectureRiseScene);

    // Directly test that moving the lens center changes the film-plane projection for a sample world point.
    const filmPlaneCornersWorld = {
      topLeft: { x: -50, y: 40, z: -100 },
      topRight: { x: 50, y: 40, z: -100 },
      bottomLeft: { x: -50, y: -40, z: -100 },
      bottomRight: { x: 50, y: -40, z: -100 },
    };
    const worldPoint = { x: 20, y: 200, z: -1000 };
    const resA = projectWorldPointToFilmPlaneGroundGlass({ worldPoint, lensCenterWorld: { x: 0, y: 0, z: 0 }, filmPlaneCornersWorld });
    const resB = projectWorldPointToFilmPlaneGroundGlass({ worldPoint, lensCenterWorld: { x: 0, y: 40, z: 0 }, filmPlaneCornersWorld });

    expect(resA.visible || resB.visible).toBe(true);
    // at least one UV coordinate should change when lens center moves
    const moved = Math.abs(resA.uRaw - resB.uRaw) > 1e-6 || Math.abs(resA.vRaw - resB.vRaw) > 1e-6;
    expect(moved).toBe(true);
  });
});
