import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  calculateGroundGlassCoverageGain,
  deriveGroundGlassCoverage,
} from "../../core/optics/groundGlassCoverage";
import { deriveLensCoverage } from "../../core/optics/lensCoverage";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import { planeFromPointNormal } from "../../core/math/plane";
import { vec } from "../../core/math/vec";
import type { CameraState } from "../../types/camera";

const angularCoverage = deriveLensCoverage(
  { kind: "angular", fullCoverageAngleDeg: 72 },
  150,
);

const parallelGeometry = (lensY = 0) => ({
  lensCenterWorld: vec(0, lensY, 0),
  filmPlane: planeFromPointNormal(vec(0, 0, -150), vec(0, 0, 1)),
  rearStandardFrame: {
    centerWorld: vec(0, 0, -150),
    rightWorld: vec(1, 0, 0),
    upWorld: vec(0, 1, 0),
    normalWorld: vec(0, 0, 1),
    plane: planeFromPointNormal(vec(0, 0, -150), vec(0, 0, 1)),
  },
  opticalAxis: { origin: vec(0, lensY, 0), direction: vec(0, 0, 1) },
  isParallelLensFilm: true,
});

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  ...overrides,
});

const filmCorners = [
  [-CAMERA_CONSTANTS.filmWidthMm / 2, -CAMERA_CONSTANTS.filmHeightMm / 2],
  [CAMERA_CONSTANTS.filmWidthMm / 2, -CAMERA_CONSTANTS.filmHeightMm / 2],
  [-CAMERA_CONSTANTS.filmWidthMm / 2, CAMERA_CONSTANTS.filmHeightMm / 2],
  [CAMERA_CONSTANTS.filmWidthMm / 2, CAMERA_CONSTANTS.filmHeightMm / 2],
] as const;

describe("Ground Glass finite coverage state", () => {
  it("keeps unbounded ideal coverage explicit", () => {
    const state = deriveGroundGlassCoverage({
      lensCoverage: {
        kind: "unbounded-ideal",
        imageCircleRadiusMm: null,
        imageCircleDiameterMm: null,
      },
      geometry: parallelGeometry(),
    });

    expect(state).toEqual({ kind: "unbounded" });
  });

  it("uses the canonical finite radius and parallel optical-axis intersection", () => {
    expect(angularCoverage?.kind).toBe("angular");
    if (angularCoverage?.kind !== "angular") return;

    const state = deriveGroundGlassCoverage({
      lensCoverage: angularCoverage,
      geometry: parallelGeometry(20),
    });

    expect(state).toMatchObject({
      kind: "parallel-circle",
      imageCircleRadiusMm: angularCoverage.imageCircleRadiusMm,
      opticalAxisOffsetXMm: 0,
      opticalAxisOffsetYMm: 20,
    });
    expect(state.kind === "parallel-circle" ? state.imageCircleRadiusMm : 0)
      .toBeCloseTo(108.98, 2);
  });

  it("disables finite coverage for non-parallel film geometry", () => {
    expect(angularCoverage).not.toBeNull();
    const state = deriveGroundGlassCoverage({
      lensCoverage: angularCoverage,
      geometry: {
        ...parallelGeometry(),
        isParallelLensFilm: false,
      },
    });

    expect(state).toEqual({ kind: "neutral", reason: "non-parallel-lens-film" });
  });

  it("keeps canonical finite coverage neutral for a materially tilted lens", () => {
    const optics = deriveOpticsState(
      cameraFor({ frontTiltDeg: 5 }),
      architectureRiseScene,
    );

    expect(optics.lensCoverage?.kind).toBe("angular");
    expect(optics.groundGlassCoverage).toEqual({
      kind: "neutral",
      reason: "non-parallel-lens-film",
    });
  });

  it("keeps canonical finite coverage neutral for a materially swung lens", () => {
    const optics = deriveOpticsState(
      cameraFor({ frontSwingDeg: 5 }),
      architectureRiseScene,
    );

    expect(optics.lensCoverage?.kind).toBe("angular");
    expect(optics.groundGlassCoverage).toEqual({
      kind: "neutral",
      reason: "non-parallel-lens-film",
    });
  });

  it("moves the finite circle centre with canonical Front Rise and Shift", () => {
    const optics = deriveOpticsState(
      cameraFor({ frontRiseMm: 20, frontShiftMm: 18 }),
      architectureRiseScene,
    );

    expect(optics.groundGlassCoverage.kind).toBe("parallel-circle");
    if (optics.groundGlassCoverage.kind !== "parallel-circle") return;
    expect(optics.groundGlassCoverage.opticalAxisOffsetXMm).toBeCloseTo(18, 9);
    expect(optics.groundGlassCoverage.opticalAxisOffsetYMm).toBeCloseTo(20, 9);
  });

  it("uses binary point coverage for the physical optics helper", () => {
    expect(angularCoverage?.kind).toBe("angular");
    if (angularCoverage?.kind !== "angular") return;
    const state = deriveGroundGlassCoverage({
      lensCoverage: angularCoverage,
      geometry: parallelGeometry(),
    });
    expect(state.kind).toBe("parallel-circle");
    if (state.kind !== "parallel-circle") return;

    expect(calculateGroundGlassCoverageGain(state, 0, 0)).toBe(1);
    expect(calculateGroundGlassCoverageGain(state, state.imageCircleRadiusMm - 0.01, 0)).toBe(1);
    expect(calculateGroundGlassCoverageGain(state, state.imageCircleRadiusMm + 0.01, 0)).toBe(0);
    expect(calculateGroundGlassCoverageGain({ kind: "unbounded" }, 1e9, 1e9)).toBe(1);
    expect(calculateGroundGlassCoverageGain({ kind: "neutral", reason: "invalid-geometry" }, 1e9, 1e9)).toBe(1);
  });

  it("locks the first-corner Rise threshold to the actual derived radius", () => {
    const neutral = deriveOpticsState(
      cameraFor({ focusDistanceMm: 12000 }),
      architectureRiseScene,
    );
    expect(neutral.groundGlassCoverage.kind).toBe("parallel-circle");
    if (neutral.groundGlassCoverage.kind !== "parallel-circle") return;

    const radiusMm = neutral.groundGlassCoverage.imageCircleRadiusMm;
    const halfWidthMm = CAMERA_CONSTANTS.filmWidthMm / 2;
    const halfHeightMm = CAMERA_CONSTANTS.filmHeightMm / 2;
    const riseThresholdMm = Math.sqrt(radiusMm * radiusMm - halfWidthMm * halfWidthMm) - halfHeightMm;
    expect(riseThresholdMm).toBeGreaterThan(0);
    expect(riseThresholdMm).toBeLessThan(CAMERA_CONSTANTS.riseMaxMm);

    const below = deriveOpticsState(
      cameraFor({ focusDistanceMm: 12000, frontRiseMm: riseThresholdMm - 0.05 }),
      architectureRiseScene,
    );
    const above = deriveOpticsState(
      cameraFor({ focusDistanceMm: 12000, frontRiseMm: riseThresholdMm + 0.05 }),
      architectureRiseScene,
    );
    expect(below.groundGlassCoverage.kind).toBe("parallel-circle");
    expect(above.groundGlassCoverage.kind).toBe("parallel-circle");
    if (
      below.groundGlassCoverage.kind !== "parallel-circle" ||
      above.groundGlassCoverage.kind !== "parallel-circle"
    ) return;

    const belowGains = filmCorners.map(([xMm, yMm]) =>
      calculateGroundGlassCoverageGain(below.groundGlassCoverage, xMm, yMm),
    );
    const aboveGains = filmCorners.map(([xMm, yMm]) =>
      calculateGroundGlassCoverageGain(above.groundGlassCoverage, xMm, yMm),
    );
    expect(belowGains.every((gain) => gain === 1)).toBe(true);
    expect(aboveGains.some((gain) => gain === 0)).toBe(true);
  });
});
