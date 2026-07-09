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

    // world point is in front of the lens (positive Z) in repo convention
    const worldPoint = { x: 0, y: 0, z: 1000 };

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
    const worldPoint = { x: 1000, y: 1000, z: 1000 };
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
    // worldPoint placed on the film side (behind the lens) so the traced ray points away from the film
    const worldPoint = { x: 0, y: 0, z: -1000 };
    const res = projectWorldPointToFilmPlaneGroundGlass({ worldPoint, lensCenterWorld, filmPlaneCornersWorld });
    expect(res.visible).toBe(false);
    expect(res.filmPointWorld).toBeNull();
  });
});

// Movement-aware regression coverage using projectSceneFocusTargetsToGroundGlass
describe("movement-aware projection", () => {
  it("projects change when camera movements change for non-focus scenes", () => {
    const camA = { ...DEFAULT_CAMERA_STATE, frontRiseMm: 0, frontTiltDeg: 0, frontSwingDeg: 0 };
    const camB = { ...DEFAULT_CAMERA_STATE, frontRiseMm: 40, frontTiltDeg: 10, frontSwingDeg: -10 };

    const opticsA = deriveOpticsState(camA, architectureRiseScene);
    const opticsB = deriveOpticsState(camB, architectureRiseScene);

    const projectedA = projectSceneFocusTargetsToGroundGlass({ sceneDef: architectureRiseScene, opticsState: opticsA, aperture: camA.aperture, previewMode: "raw" });
    const projectedB = projectSceneFocusTargetsToGroundGlass({ sceneDef: architectureRiseScene, opticsState: opticsB, aperture: camB.aperture, previewMode: "raw" });

    expect(projectedA.length).toBeGreaterThan(0);
    expect(projectedB.length).toBeGreaterThan(0);

    expect(projectedA.some((pt) => pt.visible)).toBe(true);
    expect(projectedB.some((pt) => pt.visible)).toBe(true);

    for (const pt of projectedA) {
      if (pt.visible) {
        expect(pt.leftPercent).not.toBe(-999);
        expect(pt.topPercent).not.toBe(-999);
      }
    }

    const moved = projectedA.some((a, index) => {
      const b = projectedB[index];
      if (!b) return false;
      return Math.abs(a.rawUv.u - b.rawUv.u) > 1e-6 || Math.abs(a.rawUv.v - b.rawUv.v) > 1e-6;
    });

    expect(moved).toBe(true);
  });
});
