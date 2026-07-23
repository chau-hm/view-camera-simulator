import { describe, it, expect } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { calculateRearStandardFrame, validateFilmCorners } from "../../core/optics/calculateRearStandardFrame";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { vec } from "../../core/math/vec";
import type { CameraState } from "../../types/camera";


const cameraFor = (scene: typeof architectureRiseScene, overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  ...overrides,
});

const allScenes = [
  { name: "architecture-rise", scene: architectureRiseScene },
  { name: "table-tilt", scene: tableTiltScene },
  { name: "shelf-swing", scene: shelfSwingScene },
  { name: "focus-fundamentals-two-targets", scene: focusFundamentalsTwoTargets },
];

describe("Case 1: zero rear movement preserves current optics", () => {
  for (const { name, scene } of allScenes) {
    it(`${name} retains derived optics within tolerance`, () => {
      const cam = cameraFor(scene);
      const optics = deriveOpticsState(cam, scene);

      // Verify rearStandardFrame exists
      expect(optics.rearStandardFrame).toBeDefined();

      // Verify frame orthonormality at zero tilt
      const frame = optics.rearStandardFrame!;
      expect(frame.rightWorld).toEqual(vec(1, 0, 0));
      expect(frame.upWorld).toEqual(vec(0, 1, 0));
      expect(frame.normalWorld).toEqual(vec(0, 0, 1));

      // Verify corners match world-aligned expectations
      const halfW = CAMERA_CONSTANTS.filmWidthMm / 2;
      const halfH = CAMERA_CONSTANTS.filmHeightMm / 2;
      const fc = optics.filmCenterWorld;
      expect(optics.filmPlaneCornersWorld.topLeft).toEqual({ x: fc.x - halfW, y: fc.y + halfH, z: fc.z });
      expect(optics.filmPlaneCornersWorld.topRight).toEqual({ x: fc.x + halfW, y: fc.y + halfH, z: fc.z });
      expect(optics.filmPlaneCornersWorld.bottomLeft).toEqual({ x: fc.x - halfW, y: fc.y - halfH, z: fc.z });
      expect(optics.filmPlaneCornersWorld.bottomRight).toEqual({ x: fc.x + halfW, y: fc.y - halfH, z: fc.z });

      // All values finite
      expect(Number.isFinite(optics.filmCenterWorld.x)).toBe(true);
      expect(Number.isFinite(optics.focusPointWorld.z)).toBe(true);
      expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    });
  }

  it("Table Tilt guided task solution still passes at zero rear movement", () => {
    const cam = cameraFor(tableTiltScene, {
      frontTiltDeg: 9,
      focusDistanceMm: 4600,
      aperture: 11,
    });
    const optics = deriveOpticsState(cam, tableTiltScene);
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
  });
});

describe("Case 2: rear rise only", () => {
  it("translates film centre by rearRiseMm without changing lens or film normal", () => {
    const base = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const risen = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 20 }),
      architectureRiseScene,
    );

    // Lens unchanged
    expect(risen.lensCenterWorld).toEqual(base.lensCenterWorld);
    expect(risen.lensNormalWorld).toEqual(base.lensNormalWorld);

    // Film centre Y changes by exactly rearRiseMm
    expect(risen.filmCenterWorld.y - base.filmCenterWorld.y).toBeCloseTo(20, 10);
    expect(risen.filmCenterWorld.x).toBeCloseTo(base.filmCenterWorld.x, 10);
    expect(risen.filmCenterWorld.z).toBeCloseTo(base.filmCenterWorld.z, 10);

    // Film normal unchanged
    expect(risen.filmNormalWorld).toEqual(base.filmNormalWorld);

    // All four corners translate by same Y amount
    const dy = 20;
    expect(risen.filmPlaneCornersWorld.topLeft.y - base.filmPlaneCornersWorld.topLeft.y).toBeCloseTo(dy, 10);
    expect(risen.filmPlaneCornersWorld.topRight.y - base.filmPlaneCornersWorld.topRight.y).toBeCloseTo(dy, 10);
    expect(risen.filmPlaneCornersWorld.bottomLeft.y - base.filmPlaneCornersWorld.bottomLeft.y).toBeCloseTo(dy, 10);
    expect(risen.filmPlaneCornersWorld.bottomRight.y - base.filmPlaneCornersWorld.bottomRight.y).toBeCloseTo(dy, 10);

    // Projection offset changes
    expect(risen.offAxisProjectionMatrix).not.toEqual(base.offAxisProjectionMatrix);

    // Matrix finite
    expect(risen.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
  });

  it("equal-magnitude front and rear rise produce opposite relative lens/film offsets", () => {
    const frontRise = deriveOpticsState(
      cameraFor(architectureRiseScene, { frontRiseMm: 20 }),
      architectureRiseScene,
    );
    const rearRise = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 20 }),
      architectureRiseScene,
    );

    // Front rise moves lens up; rear rise moves film up.
    // The relative offset lens.y - film.y should have opposite signs.
    const frontOffset = frontRise.lensCenterWorld.y - frontRise.filmCenterWorld.y;
    const rearOffset = rearRise.lensCenterWorld.y - rearRise.filmCenterWorld.y;
    expect(Math.sign(frontOffset)).not.toBe(Math.sign(rearOffset));
  });
});

describe("Case 3: rear tilt only", () => {
  it("rotates film normal and up around world X without moving centre", () => {
    const base = deriveOpticsState(cameraFor(tableTiltScene), tableTiltScene);
    const tilted = deriveOpticsState(
      cameraFor(tableTiltScene, { rearTiltDeg: 8 }),
      tableTiltScene,
    );

    // Lens unchanged
    expect(tilted.lensCenterWorld).toEqual(base.lensCenterWorld);
    expect(tilted.lensNormalWorld).toEqual(base.lensNormalWorld);

    // Film centre at baseline
    expect(tilted.filmCenterWorld).toEqual(base.filmCenterWorld);

    // Right axis = world +X
    expect(tilted.rearStandardFrame!.rightWorld).toEqual(vec(1, 0, 0));

    // Film normal and up rotate around world X
    expect(tilted.filmNormalWorld).not.toEqual(base.filmNormalWorld);
    expect(tilted.rearStandardFrame!.upWorld).not.toEqual(vec(0, 1, 0));

    // Corner dimensions remain 127 × 101.6
    const corners = tilted.filmPlaneCornersWorld;
    const topEdge = Math.hypot(
      corners.topRight.x - corners.topLeft.x,
      corners.topRight.y - corners.topLeft.y,
      corners.topRight.z - corners.topLeft.z,
    );
    const sideEdge = Math.hypot(
      corners.bottomLeft.x - corners.topLeft.x,
      corners.bottomLeft.y - corners.topLeft.y,
      corners.bottomLeft.z - corners.topLeft.z,
    );
    expect(topEdge).toBeCloseTo(CAMERA_CONSTANTS.filmWidthMm, 6);
    expect(sideEdge).toBeCloseTo(CAMERA_CONSTANTS.filmHeightMm, 6);

    // Corners coplanar
    const validation = validateFilmCorners(
      corners,
      tilted.rearStandardFrame!,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
    );
    expect(validation).toBeNull();

    // Matrix finite and changes from baseline
    expect(tilted.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    expect(tilted.offAxisProjectionMatrix).not.toEqual(base.offAxisProjectionMatrix);
  });
});

describe("Case 4: combined rear rise and rear tilt", () => {
  it("respects both translated centre and rotated axes", () => {
    const base = deriveOpticsState(cameraFor(shelfSwingScene), shelfSwingScene);
    const combined = deriveOpticsState(
      cameraFor(shelfSwingScene, { rearRiseMm: 15, rearTiltDeg: 6 }),
      shelfSwingScene,
    );

    // Centre translated by rearRiseMm
    expect(combined.filmCenterWorld.y - base.filmCenterWorld.y).toBeCloseTo(15, 10);

    // Normal rotated
    expect(combined.filmNormalWorld).not.toEqual(base.filmNormalWorld);

    // All finite
    expect(combined.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(combined.focusPlane?.normal.x ?? NaN)).toBe(true);
    expect(Number.isFinite(combined.focusPlane?.normal.y ?? NaN)).toBe(true);
    expect(Number.isFinite(combined.focusPlane?.normal.z ?? NaN)).toBe(true);

    // No corner from stale world-aligned assumptions
    const validation = validateFilmCorners(
      combined.filmPlaneCornersWorld,
      combined.rearStandardFrame!,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
    );
    expect(validation).toBeNull();
  });
});

describe("Case 5: matching front and rear tilt", () => {
  it("lens and film planes are parallel when tilts match", () => {
    const tiltDeg = 5;
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { frontTiltDeg: tiltDeg, rearTiltDeg: tiltDeg }),
      tableTiltScene,
    );

    // When front and rear tilt match, lens and film normals should be parallel
    const lensNormal = optics.lensNormalWorld;
    const filmNormal = optics.filmNormalWorld;
    const dot = lensNormal.x * filmNormal.x + lensNormal.y * filmNormal.y + lensNormal.z * filmNormal.z;
    expect(Math.abs(Math.abs(dot) - 1)).toBeLessThan(0.001);

    // No Scheimpflug common line when parallel
    expect(optics.lensFilmHingeLine).toBeNull();
  });
});

describe("Case 6: different front and rear tilt", () => {
  it("produces non-parallel planes with finite Scheimpflug common line", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { frontTiltDeg: 5, rearTiltDeg: 3 }),
      tableTiltScene,
    );

    // Lens and film are non-parallel
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);

    // Common line is finite
    expect(optics.lensFilmHingeLine).not.toBeNull();
    const line = optics.lensFilmHingeLine!;
    expect(Number.isFinite(line.point.x)).toBe(true);
    expect(Number.isFinite(line.point.y)).toBe(true);
    expect(Number.isFinite(line.point.z)).toBe(true);
    expect(Number.isFinite(line.direction.x)).toBe(true);

    // Focus plane derived using Scheimpflug model
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(optics.focusPlane).not.toBeNull();
    expect(Number.isFinite(optics.focusPlane!.normal.x) && Number.isFinite(optics.focusPlane!.normal.y) && Number.isFinite(optics.focusPlane!.normal.z)).toBe(true);
  });
});

describe("Case 7: invalid rear values", () => {
  it("NaN rear rise produces safe fallback", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: NaN }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(optics.filmPlaneCornersWorld.topLeft.x)).toBe(true);
  });

  it("Infinity rear tilt produces safe fallback", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearTiltDeg: Infinity }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(optics.filmPlaneCornersWorld.topLeft.x)).toBe(true);
  });
});

describe("film corner invariants", () => {
  it("validates corners at zero movement", () => {
    const optics = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const result = validateFilmCorners(
      optics.filmPlaneCornersWorld,
      optics.rearStandardFrame!,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
    );
    expect(result).toBeNull();
  });

  it("validates corners with rear tilt", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearTiltDeg: 10 }),
      architectureRiseScene,
    );
    const result = validateFilmCorners(
      optics.filmPlaneCornersWorld,
      optics.rearStandardFrame!,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
    );
    expect(result).toBeNull();
  });

  it("validates corners with combined rear movement", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearRiseMm: 25, rearTiltDeg: 7 }),
      architectureRiseScene,
    );
    const result = validateFilmCorners(
      optics.filmPlaneCornersWorld,
      optics.rearStandardFrame!,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
    );
    expect(result).toBeNull();
  });
});

describe("calculateRearStandardFrame direct tests", () => {
  it("returns world-aligned axes at zero movement", () => {
    const { frame } = calculateRearStandardFrame(vec(0, 0, -150), 0, 0);
    expect(frame.rightWorld).toEqual(vec(1, 0, 0));
    expect(frame.upWorld).toEqual(vec(0, 1, 0));
    expect(frame.normalWorld).toEqual(vec(0, 0, 1));
    expect(frame.centerWorld).toEqual(vec(0, 0, -150));
  });

  it("translates centre by rearRiseMm along world +Y", () => {
    const { frame } = calculateRearStandardFrame(vec(0, 0, -150), 20, 0);
    expect(frame.centerWorld).toEqual(vec(0, 20, -150));
    expect(frame.normalWorld).toEqual(vec(0, 0, 1));
  });

  it("rotates up and normal around world X at rear tilt", () => {
    const { frame } = calculateRearStandardFrame(vec(0, 0, -150), 0, 10);
    expect(frame.rightWorld).toEqual(vec(1, 0, 0));
    // up should rotate: positive tilt rotates Y toward Z
    expect(frame.upWorld.y).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 8);
    expect(frame.upWorld.z).toBeCloseTo(Math.sin((10 * Math.PI) / 180), 8);
    expect(frame.normalWorld.y).toBeCloseTo(-Math.sin((10 * Math.PI) / 180), 8);
    expect(frame.normalWorld.z).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 8);
  });
});
