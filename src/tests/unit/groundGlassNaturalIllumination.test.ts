import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  calculateGroundGlassNaturalIlluminationGain,
  deriveGroundGlassNaturalIllumination,
} from "../../core/optics/groundGlassNaturalIllumination";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { CameraState } from "../../types/camera";
import { planeFromPointNormal } from "../../core/math/plane";
import { vec } from "../../core/math/vec";

const parallelState = (imageDistanceMm: number) => ({
  kind: "parallel-cos4" as const,
  imageDistanceMm,
  opticalAxisOffsetXMm: 0,
  opticalAxisOffsetYMm: 0,
});

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  ...overrides,
});

describe("Ground Glass natural illumination", () => {
  it("represents non-parallel geometry as neutral rather than applying parallel cos^4", () => {
    const optics = deriveOpticsState(
      cameraFor({ frontTiltDeg: 5 }),
      architectureRiseScene,
    );

    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.groundGlassNaturalIllumination).toEqual({
      kind: "neutral",
      reason: "non-parallel-lens-film",
    });
  });

  it("keeps the optical axis centre at unit gain", () => {
    expect(
      calculateGroundGlassNaturalIlluminationGain(parallelState(150), 0, 0),
    ).toBeCloseTo(1, 12);
  });

  it("matches the nominal 4x5 corner gain at 150 mm", () => {
    const gain = calculateGroundGlassNaturalIlluminationGain(
      parallelState(150),
      CAMERA_CONSTANTS.filmWidthMm / 2,
      CAMERA_CONSTANTS.filmHeightMm / 2,
    );

    expect(gain).toBeCloseTo(0.5973, 4);
  });

  it.each([
    [90, 0.3031],
    [300, 0.8678],
  ])("matches the nominal 4x5 corner gain at %d mm", (imageDistanceMm, expected) => {
    const gain = calculateGroundGlassNaturalIlluminationGain(
      parallelState(imageDistanceMm),
      CAMERA_CONSTANTS.filmWidthMm / 2,
      CAMERA_CONSTANTS.filmHeightMm / 2,
    );

    expect(gain).toBeCloseTo(expected, 4);
  });

  it("falls off monotonically with distance from the optical axis", () => {
    const state = parallelState(150);
    const gains = [0, 40, 80].map((distanceMm) =>
      calculateGroundGlassNaturalIlluminationGain(state, distanceMm, 0),
    );

    expect(gains[0]).toBeGreaterThan(gains[1]);
    expect(gains[1]).toBeGreaterThan(gains[2]);
  });

  it("becomes less severe at a longer bellows image distance", () => {
    const filmPoint = [63.5, 50.8] as const;
    const shortImageDistanceGain = calculateGroundGlassNaturalIlluminationGain(
      parallelState(90),
      filmPoint[0],
      filmPoint[1],
    );
    const longImageDistanceGain = calculateGroundGlassNaturalIlluminationGain(
      parallelState(300),
      filmPoint[0],
      filmPoint[1],
    );

    expect(longImageDistanceGain).toBeGreaterThan(shortImageDistanceGain);
  });

  it("moves the physical illumination centre with front rise and shift", () => {
    const neutral = deriveOpticsState(cameraFor(), architectureRiseScene);
    const moved = deriveOpticsState(
      cameraFor({ frontRiseMm: 20, frontShiftMm: 18 }),
      architectureRiseScene,
    );

    expect(neutral.groundGlassNaturalIllumination.kind).toBe("parallel-cos4");
    expect(moved.groundGlassNaturalIllumination.kind).toBe("parallel-cos4");
    if (
      neutral.groundGlassNaturalIllumination.kind !== "parallel-cos4" ||
      moved.groundGlassNaturalIllumination.kind !== "parallel-cos4"
    ) {
      throw new Error("Expected parallel natural-illumination state");
    }

    expect(neutral.groundGlassNaturalIllumination.opticalAxisOffsetXMm).toBeCloseTo(0, 9);
    expect(neutral.groundGlassNaturalIllumination.opticalAxisOffsetYMm).toBeCloseTo(0, 9);
    expect(moved.groundGlassNaturalIllumination.opticalAxisOffsetXMm).toBeCloseTo(18, 9);
    expect(moved.groundGlassNaturalIllumination.opticalAxisOffsetYMm).toBeCloseTo(20, 9);

    const neutralLeft = calculateGroundGlassNaturalIlluminationGain(
      neutral.groundGlassNaturalIllumination,
      -40,
      0,
    );
    const neutralRight = calculateGroundGlassNaturalIlluminationGain(
      neutral.groundGlassNaturalIllumination,
      40,
      0,
    );
    expect(neutralLeft).toBeCloseTo(neutralRight, 12);

    const riseCloser = calculateGroundGlassNaturalIlluminationGain(
      moved.groundGlassNaturalIllumination,
      0,
      40,
    );
    const riseFarther = calculateGroundGlassNaturalIlluminationGain(
      moved.groundGlassNaturalIllumination,
      0,
      -40,
    );
    const shiftCloser = calculateGroundGlassNaturalIlluminationGain(
      moved.groundGlassNaturalIllumination,
      40,
      0,
    );
    const shiftFarther = calculateGroundGlassNaturalIlluminationGain(
      moved.groundGlassNaturalIllumination,
      -40,
      0,
    );
    expect(riseCloser).toBeGreaterThan(riseFarther);
    expect(shiftCloser).toBeGreaterThan(shiftFarther);
  });

  it("fails closed for invalid geometry and non-physical state", () => {
    const invalidGeometry = deriveGroundGlassNaturalIllumination({
      lensCenterWorld: vec(Number.NaN, 0, 0),
      filmPlane: planeFromPointNormal(vec(0, 0, -150), vec(0, 0, 1)),
      rearStandardFrame: {
        centerWorld: vec(0, 0, -150),
        rightWorld: vec(1, 0, 0),
        upWorld: vec(0, 1, 0),
        normalWorld: vec(0, 0, 1),
        plane: planeFromPointNormal(vec(0, 0, -150), vec(0, 0, 1)),
      },
      opticalAxis: { origin: vec(0, 0, 0), direction: vec(0, 0, 1) },
      isParallelLensFilm: true,
    });

    expect(invalidGeometry).toEqual({ kind: "neutral", reason: "invalid-geometry" });
    expect(
      calculateGroundGlassNaturalIlluminationGain(
        parallelState(Number.NaN),
        0,
        0,
      ),
    ).toBe(1);
    expect(
      calculateGroundGlassNaturalIlluminationGain(parallelState(-1), 0, 0),
    ).toBe(1);
  });
});
