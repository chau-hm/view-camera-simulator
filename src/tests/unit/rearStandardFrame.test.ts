import { describe, it, expect } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { calculateLensNormal } from "../../core/optics/calculateLensPlane";
import {
  calculateRearStandardFrame,
  isStandardFrameLevel,
  validateFilmCorners,
} from "../../core/optics/calculateRearStandardFrame";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { rotateAroundY, vec } from "../../core/math/vec";
import type { ApertureValue, CameraState } from "../../types/camera";


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

      // Verify frame orthonormality at zero tilt
      const frame = optics.rearStandardFrame;
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

  it("keeps explicit zero rear shift and swing identical to the default", () => {
    const implicit = deriveOpticsState(
      cameraFor(architectureRiseScene),
      architectureRiseScene,
    );
    const explicit = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearShiftMm: 0, rearSwingDeg: 0 }),
      architectureRiseScene,
    );

    expect(explicit.lensCenterWorld).toEqual(implicit.lensCenterWorld);
    expect(explicit.filmCenterWorld).toEqual(implicit.filmCenterWorld);
    expect(explicit.rearStandardFrame).toEqual(implicit.rearStandardFrame);
    expect(explicit.filmPlaneCornersWorld).toEqual(implicit.filmPlaneCornersWorld);
    expect(explicit.offAxisProjectionMatrix).toEqual(implicit.offAxisProjectionMatrix);
  });
});

describe("front-standard shift", () => {
  it("translates the canonical front standard without moving the rear standard", () => {
    const base = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const shifted = deriveOpticsState(
      cameraFor(architectureRiseScene, { frontShiftMm: 18 }),
      architectureRiseScene,
    );

    expect(shifted.lensCenterWorld.x - base.lensCenterWorld.x).toBeCloseTo(18, 10);
    expect(shifted.lensCenterWorld.y).toBeCloseTo(base.lensCenterWorld.y, 10);
    expect(shifted.lensCenterWorld.z).toBeCloseTo(base.lensCenterWorld.z, 10);
    expect(shifted.filmCenterWorld).toEqual(base.filmCenterWorld);
    expect(shifted.rearStandardFrame).toEqual(base.rearStandardFrame);
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

describe("rear-standard shift", () => {
  it("translates the film-plane assembly laterally without moving the lens", () => {
    const base = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const shifted = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearShiftMm: 22 }),
      architectureRiseScene,
    );

    expect(shifted.lensCenterWorld).toEqual(base.lensCenterWorld);
    expect(shifted.filmCenterWorld.x - base.filmCenterWorld.x).toBeCloseTo(22, 10);
    expect(shifted.filmCenterWorld.y).toBeCloseTo(base.filmCenterWorld.y, 10);
    expect(shifted.filmCenterWorld.z).toBeCloseTo(base.filmCenterWorld.z, 10);
    expect(shifted.filmNormalWorld).toEqual(base.filmNormalWorld);

    for (const key of ["topLeft", "topRight", "bottomLeft", "bottomRight"] as const) {
      expect(shifted.filmPlaneCornersWorld[key].x - base.filmPlaneCornersWorld[key].x).toBeCloseTo(22, 10);
      expect(shifted.filmPlaneCornersWorld[key].y).toBeCloseTo(base.filmPlaneCornersWorld[key].y, 10);
      expect(shifted.filmPlaneCornersWorld[key].z).toBeCloseTo(base.filmPlaneCornersWorld[key].z, 10);
    }
    expect(shifted.offAxisProjectionMatrix).not.toEqual(base.offAxisProjectionMatrix);
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

describe("rear-standard swing", () => {
  it("rotates the film-plane orientation around its unchanged centre", () => {
    const base = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const swung = deriveOpticsState(
      cameraFor(architectureRiseScene, { rearSwingDeg: 8 }),
      architectureRiseScene,
    );
    const radians = (8 * Math.PI) / 180;

    expect(swung.lensCenterWorld).toEqual(base.lensCenterWorld);
    expect(swung.lensNormalWorld).toEqual(base.lensNormalWorld);
    expect(swung.filmCenterWorld).toEqual(base.filmCenterWorld);
    expect(swung.rearStandardFrame.rightWorld.x).toBeCloseTo(Math.cos(radians), 10);
    expect(swung.rearStandardFrame.rightWorld.z).toBeCloseTo(-Math.sin(radians), 10);
    expect(swung.rearStandardFrame.normalWorld.x).toBeCloseTo(Math.sin(radians), 10);
    expect(swung.rearStandardFrame.normalWorld.z).toBeCloseTo(Math.cos(radians), 10);
    expect(swung.filmPlaneCornersWorld).not.toEqual(base.filmPlaneCornersWorld);
    expect(swung.offAxisProjectionMatrix).not.toEqual(base.offAxisProjectionMatrix);
    expect(validateFilmCorners(
      swung.filmPlaneCornersWorld,
      swung.rearStandardFrame,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
    )).toBeNull();
  });
});

describe("rear-standard level orientation", () => {
  it("allows horizontal yaw but rejects a tilted frame", () => {
    const baseline = calculateRearStandardFrame(vec(0, 0, -150), 0, 0).frame;
    const yawed = {
      ...baseline,
      rightWorld: rotateAroundY(baseline.rightWorld, 30),
      normalWorld: rotateAroundY(baseline.normalWorld, 30),
    };

    expect(isStandardFrameLevel(yawed)).toBe(true);
    expect(
      isStandardFrameLevel(calculateRearStandardFrame(vec(0, 0, -150), 0, 10).frame),
    ).toBe(false);
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

    // Matching front and rear tilt: planes are genuinely parallel
    expect(optics.diagnostics.isParallelLensFilm).toBe(true);
    expect(optics.lensFilmHingeLine).toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("parallel");
    expect(optics.diagnostics.depthOfFieldModel).toBe("parallel");
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


describe("Case 8: geometry-based Table Tilt parallelism", () => {
  it("rear tilt only is non-parallel with finite common line", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { frontTiltDeg: 0, rearTiltDeg: 8 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(optics.focusPlane).not.toBeNull();
  });

  it("0.01-degree relative tilt is non-parallel", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { frontTiltDeg: 0.01, rearTiltDeg: 0 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
  });

  it("matching front tilt plus front swing is non-parallel", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { frontTiltDeg: 5, frontSwingDeg: 3, rearTiltDeg: 5 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
  });
});

describe("Case 9: infinity focus lens/film relationship", () => {
  it("zero rear movement is parallel with null common line", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusMode: "infinity" }),
      tableTiltScene,
    );
    expect(optics.diagnostics.isParallelLensFilm).toBe(true);
    expect(optics.lensFilmHingeLine).toBeNull();
    expect(optics.focusPlane).toBeNull();
    expect(optics.depthOfFieldFarPlane).toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("parallel");
    expect(optics.diagnostics.isInfinityFocus).toBe(true);
  });

  it("rear tilt makes planes non-parallel with finite common line", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusMode: "infinity", rearTiltDeg: 8 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
    const line = optics.lensFilmHingeLine!;
    expect(Number.isFinite(line.point.x)).toBe(true);
    expect(Number.isFinite(line.point.y)).toBe(true);
    expect(Number.isFinite(line.point.z)).toBe(true);
  });

  it("infinity rear tilt focusPlane remains null", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusMode: "infinity", rearTiltDeg: 8 }),
      tableTiltScene,
    );
    expect(optics.focusPlane).toBeNull();
    expect(optics.depthOfFieldFarPlane).toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
  });
});

describe("film corner invariants", () => {
  it("validates corners at zero movement", () => {
    const optics = deriveOpticsState(cameraFor(architectureRiseScene), architectureRiseScene);
    const result = validateFilmCorners(
      optics.filmPlaneCornersWorld,
      optics.rearStandardFrame,
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
      optics.rearStandardFrame,
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
      optics.rearStandardFrame,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
    );
    expect(result).toBeNull();
  });
});


describe("Case 10: fallback state remains self-consistent and finite", () => {
  const expectVec3Finite = (label: string, v: { x: number; y: number; z: number }) => {
    expect(Number.isFinite(v.x), `${label}.x`).toBe(true);
    expect(Number.isFinite(v.y), `${label}.y`).toBe(true);
    expect(Number.isFinite(v.z), `${label}.z`).toBe(true);
  };
  const expectPlaneFinite = (label: string, p: { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number }; distance: number }) => {
    expect(Number.isFinite(p.point.x), `${label}.point.x`).toBe(true);
    expect(Number.isFinite(p.point.y), `${label}.point.y`).toBe(true);
    expect(Number.isFinite(p.point.z), `${label}.point.z`).toBe(true);
    expect(Number.isFinite(p.normal.x), `${label}.normal.x`).toBe(true);
    expect(Number.isFinite(p.normal.y), `${label}.normal.y`).toBe(true);
    expect(Number.isFinite(p.normal.z), `${label}.normal.z`).toBe(true);
    expect(Number.isFinite(p.distance), `${label}.distance`).toBe(true);
  };

  const expectAllDerivedFinite = (optics: ReturnType<typeof deriveOpticsState>, scene: string) => {
    expectVec3Finite(`${scene} lensCenterWorld`, optics.lensCenterWorld);
    expectVec3Finite(`${scene} lensNormalWorld`, optics.lensNormalWorld);
    expectPlaneFinite(`${scene} lensPlane`, optics.lensPlane);
    expectVec3Finite(`${scene} rearStd.centerWorld`, optics.rearStandardFrame.centerWorld);
    expectVec3Finite(`${scene} rearStd.rightWorld`, optics.rearStandardFrame.rightWorld);
    expectVec3Finite(`${scene} rearStd.upWorld`, optics.rearStandardFrame.upWorld);
    expectVec3Finite(`${scene} rearStd.normalWorld`, optics.rearStandardFrame.normalWorld);
    expectPlaneFinite(`${scene} rearStd.plane`, optics.rearStandardFrame.plane);
    expectVec3Finite(`${scene} filmCenterWorld`, optics.filmCenterWorld);
    expectVec3Finite(`${scene} filmNormalWorld`, optics.filmNormalWorld);
    expectPlaneFinite(`${scene} filmPlane`, optics.filmPlane);
    for (const key of ["topLeft","topRight","bottomLeft","bottomRight"] as const) {
      expectVec3Finite(`${scene} ${key}`, optics.filmPlaneCornersWorld[key]);
    }
    expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
    if (optics.lensFilmHingeLine) {
      expectVec3Finite(`${scene} commonLine.point`, optics.lensFilmHingeLine.point);
      expectVec3Finite(`${scene} commonLine.dir`, optics.lensFilmHingeLine.direction);
    }
    if (optics.focusPlane) expectPlaneFinite(`${scene} focusPlane`, optics.focusPlane);
    if (optics.depthOfFieldNearPlane) expectPlaneFinite(`${scene} nearDof`, optics.depthOfFieldNearPlane);
    if (optics.depthOfFieldFarPlane) expectPlaneFinite(`${scene} farDof`, optics.depthOfFieldFarPlane);
  };

  it("invalid focusDistance with rear tilt produces non-parallel fallback", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: -1, rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expectAllDerivedFinite(optics, "case1");
  });

  it("NaN focusDistance with rear tilt produces non-parallel fallback", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: NaN, rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
    expectAllDerivedFinite(optics, "case2");
  });

  it("NaN focalLength with rearRise produces safe fallback", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focalLengthMm: NaN, rearRiseMm: 20 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    // rearRise is finite so it should be preserved
    expect(optics.filmCenterWorld.y).not.toBeCloseTo(0, 6);
    expectAllDerivedFinite(optics, "case3");
  });

  it("all invalid movements replaced by safe neutral values", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, {
        frontRiseMm: Infinity,
        frontTiltDeg: NaN,
        rearTiltDeg: Infinity,
      }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.isParallelLensFilm).toBe(true);
    expect(optics.lensFilmHingeLine).toBeNull();
    expectAllDerivedFinite(optics, "case4");
  });

  it("invalid infinity input produces finite parallel fallback", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", rearRiseMm: NaN, rearTiltDeg: Infinity }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.isParallelLensFilm).toBe(true);
    expect(optics.lensFilmHingeLine).toBeNull();
    expectAllDerivedFinite(optics, "case5");
  });
});


describe("Case 11: scene-aware fallback policy", () => {
  it("Table Tilt 0.01° tilt fallback uses strict threshold", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusDistanceMm: -1, frontTiltDeg: 0.01 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    // 0.01° relative tilt: strict Table Tilt threshold should report non-parallel
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
  });

  it("matching front/rear tilt fallback is parallel", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusDistanceMm: -1, frontTiltDeg: 5, rearTiltDeg: 5 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.diagnostics.isParallelLensFilm).toBe(true);
    expect(optics.lensFilmHingeLine).toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("parallel");
    expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
  });

  it("fallback DOF planes satisfy plane distance invariant", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: -1, rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    if (optics.depthOfFieldNearPlane) {
      const n = optics.depthOfFieldNearPlane;
      expect(n.distance).toBeCloseTo(n.normal.x * n.point.x + n.normal.y * n.point.y + n.normal.z * n.point.z, 10);
    }
    if (optics.depthOfFieldFarPlane) {
      const f = optics.depthOfFieldFarPlane;
      expect(f.distance).toBeCloseTo(f.normal.x * f.point.x + f.normal.y * f.point.y + f.normal.z * f.point.z, 10);
    }
    // Near/far normals align with focusPlane.normal
    if (optics.focusPlane && optics.depthOfFieldNearPlane && optics.depthOfFieldFarPlane) {
      const fpNorm = optics.focusPlane.normal;
      const nearNorm = optics.depthOfFieldNearPlane.normal;
      const farNorm = optics.depthOfFieldFarPlane.normal;
      const dotNear = fpNorm.x * nearNorm.x + fpNorm.y * nearNorm.y + fpNorm.z * nearNorm.z;
      const dotFar = fpNorm.x * farNorm.x + fpNorm.y * farNorm.y + fpNorm.z * farNorm.z;
      expect(Math.abs(dotNear)).toBeGreaterThan(0.999);
      expect(Math.abs(dotFar)).toBeGreaterThan(0.999);
    }
  });

  it("all Plane objects satisfy distance = dot(normal, point)", () => {
    const assertPlaneDist = (label: string, p: { point: {x:number;y:number;z:number}; normal: {x:number;y:number;z:number}; distance: number }) => {
      expect(p.distance, label).toBeCloseTo(
        p.normal.x * p.point.x + p.normal.y * p.point.y + p.normal.z * p.point.z, 10,
      );
    };
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: -1, rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    assertPlaneDist("lensPlane", optics.lensPlane);
    assertPlaneDist("filmPlane", optics.filmPlane);
    assertPlaneDist("rearFrame.plane", optics.rearStandardFrame.plane);
    if (optics.focusPlane) assertPlaneDist("focusPlane", optics.focusPlane);
    if (optics.depthOfFieldNearPlane) assertPlaneDist("nearDof", optics.depthOfFieldNearPlane);
    if (optics.depthOfFieldFarPlane) assertPlaneDist("farDof", optics.depthOfFieldFarPlane);
  });
});


describe("Case 12: infinity input validation", () => {
  const expectFiniteDiagnostics = (optics: ReturnType<typeof deriveOpticsState>) => {
    expect(Number.isFinite(optics.diagnostics.tiltAngleDeg)).toBe(true);
    expect(Number.isFinite(optics.diagnostics.swingAngleDeg)).toBe(true);
    expect(optics.offAxisProjectionMatrix.every(Number.isFinite)).toBe(true);
  };

  it("NaN frontTiltDeg in infinity falls back with finite diagnostics", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", frontTiltDeg: NaN as unknown as number }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expectFiniteDiagnostics(optics);
    expect(optics.diagnostics.tiltAngleDeg).not.toBeNaN();
  });

  it("Infinity frontSwingDeg in infinity falls back with finite diagnostics", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", frontSwingDeg: Infinity as unknown as number }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expectFiniteDiagnostics(optics);
    expect(optics.diagnostics.swingAngleDeg).not.toBe(Infinity);
  });

  it("NaN frontRiseMm in infinity falls back", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", frontRiseMm: NaN }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expectFiniteDiagnostics(optics);
  });

  it("invalid aperture in infinity falls back", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", aperture: 99 as unknown as ApertureValue }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expectFiniteDiagnostics(optics);
  });
});

describe("Case 13: positive fallback focus distance", () => {
  it("negative focusDistance produces positive sanitized focusPointWorld", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: -1, rearTiltDeg: 8 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.focusPointWorld.z).toBeGreaterThan(0);
    // Non-parallel relationship preserved
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    // Plane distance invariant
    if (optics.depthOfFieldNearPlane) {
      const n = optics.depthOfFieldNearPlane;
      expect(n.distance).toBeCloseTo(n.normal.x * n.point.x + n.normal.y * n.point.y + n.normal.z * n.point.z, 10);
    }
  });

  it("zero focusDistance produces positive sanitized focusPointWorld", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: 0 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.focusPointWorld.z).toBeGreaterThan(0);
  });

  it("NaN focusDistance produces positive sanitized focusPointWorld", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: NaN }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.focusPointWorld.z).toBeGreaterThan(0);
  });

  it("-Infinity focusDistance produces positive sanitized focusPointWorld", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusDistanceMm: -Infinity as unknown as number }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(true);
    expect(optics.focusPointWorld.z).toBeGreaterThan(0);
  });
});


describe("Case 14: infinity front movements drive lens geometry", () => {
  it("infinity front rise moves lens centre Y", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", frontRiseMm: 20 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.lensCenterWorld.y).toBeCloseTo(20, 10);
    expect(optics.lensCenterWorld.z).toBeCloseTo(CAMERA_CONSTANTS.focalLengthMm, 10);
    expect(optics.opticalAxis.origin).toEqual(optics.lensCenterWorld);
    // Film centre unchanged by front rise
    expect(optics.filmCenterWorld.y).toBeCloseTo(0, 8);
  });

  it("infinity front tilt rotates lens normal", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", frontTiltDeg: 5 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    const expected = calculateLensNormal(5, 0);
    expect(optics.lensNormalWorld.x).toBeCloseTo(expected.x, 10);
    expect(optics.lensNormalWorld.y).toBeCloseTo(expected.y, 10);
    expect(optics.lensNormalWorld.z).toBeCloseTo(expected.z, 10);
    expect(optics.opticalAxis.direction).toEqual(optics.lensNormalWorld);
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
    expect(optics.focusPlane).toBeNull();
    expect(optics.depthOfFieldFarPlane).toBeNull();
  });

  it("infinity front swing rotates lens normal", () => {
    const optics = deriveOpticsState(
      cameraFor(architectureRiseScene, { focusMode: "infinity", frontSwingDeg: 5 }),
      architectureRiseScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    const expected = calculateLensNormal(0, 5);
    expect(optics.lensNormalWorld.x).toBeCloseTo(expected.x, 10);
    expect(optics.lensNormalWorld.z).toBeCloseTo(expected.z, 10);
    expect(optics.opticalAxis.direction).toEqual(optics.lensNormalWorld);
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
  });

  it("infinity matching front/rear tilt is parallel (Table Tilt)", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusMode: "infinity", frontTiltDeg: 5, rearTiltDeg: 5 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.isParallelLensFilm).toBe(true);
    expect(optics.lensFilmHingeLine).toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("parallel");
    expect(optics.focusPlane).toBeNull();
  });

  it("infinity different front/rear tilt is non-parallel", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusMode: "infinity", frontTiltDeg: 5, rearTiltDeg: 3 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
    expect(optics.diagnostics.focusPlaneModel).toBe("scheimpflug");
    expect(optics.focusPlane).toBeNull();
  });

  it("infinity matching tilt plus swing is non-parallel", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { focusMode: "infinity", frontTiltDeg: 5, rearTiltDeg: 5, frontSwingDeg: 3 }),
      tableTiltScene,
    );
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
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

  it("translates the rear frame along world +X for rear shift", () => {
    const { frame } = calculateRearStandardFrame(
      vec(0, 0, -150),
      20,
      0,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      15,
      0,
    );
    expect(frame.centerWorld).toEqual(vec(15, 20, -150));
    expect(frame.rightWorld).toEqual(vec(1, 0, 0));
    expect(frame.normalWorld).toEqual(vec(0, 0, 1));
  });

  it("applies rear swing around world Y after rear tilt", () => {
    const { frame } = calculateRearStandardFrame(
      vec(0, 0, -150),
      0,
      0,
      CAMERA_CONSTANTS.filmWidthMm,
      CAMERA_CONSTANTS.filmHeightMm,
      0,
      10,
    );
    expect(frame.centerWorld).toEqual(vec(0, 0, -150));
    expect(frame.rightWorld.x).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 8);
    expect(frame.rightWorld.z).toBeCloseTo(-Math.sin((10 * Math.PI) / 180), 8);
    expect(frame.normalWorld.x).toBeCloseTo(Math.sin((10 * Math.PI) / 180), 8);
    expect(frame.normalWorld.z).toBeCloseTo(Math.cos((10 * Math.PI) / 180), 8);
  });
});
