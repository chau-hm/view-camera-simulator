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

const tiltedGeometry = (tiltDeg: number, filmCenterYmm = 0) => {
  const angle = (tiltDeg * Math.PI) / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const center = vec(0, filmCenterYmm, -150);
  const normal = vec(0, sine, cosine);
  const frame = {
    centerWorld: center,
    rightWorld: vec(1, 0, 0),
    upWorld: vec(0, cosine, -sine),
    normalWorld: normal,
    plane: planeFromPointNormal(center, normal),
  };
  return {
    lensCenterWorld: vec(0, 0, 0),
    filmPlane: planeFromPointNormal(center, normal),
    rearStandardFrame: frame,
    opticalAxis: { origin: vec(0, 0, 0), direction: vec(0, 0, 1) },
  };
};

const swungGeometry = (swingDeg: number) => {
  const angle = (swingDeg * Math.PI) / 180;
  const sine = Math.sin(angle);
  const cosine = Math.cos(angle);
  const center = vec(0, 0, -150);
  const normal = vec(sine, 0, cosine);
  return {
    lensCenterWorld: vec(0, 0, 0),
    filmPlane: planeFromPointNormal(center, normal),
    rearStandardFrame: {
      centerWorld: center,
      rightWorld: vec(cosine, 0, -sine),
      upWorld: vec(0, 1, 0),
      normalWorld: normal,
      plane: planeFromPointNormal(center, normal),
    },
    opticalAxis: { origin: vec(0, 0, 0), direction: vec(0, 0, 1) },
  };
};

const gainAt = (
  state: Parameters<typeof calculateGroundGlassNaturalIlluminationGain>[0],
  point: readonly [number, number],
): number => calculateGroundGlassNaturalIlluminationGain(state, point[0], point[1]);

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...architectureRiseScene.cameraPreset,
  activeSceneId: architectureRiseScene.id,
  ...overrides,
});

describe("Ground Glass natural illumination", () => {
  it("derives geometric natural illumination for non-parallel film", () => {
    const optics = deriveOpticsState(
      cameraFor({ frontTiltDeg: 5 }),
      architectureRiseScene,
    );

    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.groundGlassNaturalIllumination.kind).toBe("nonparallel-geometric");
    expect(calculateGroundGlassNaturalIlluminationGain(
      optics.groundGlassNaturalIllumination,
      40,
      0,
    )).toBeGreaterThan(0);
  });

  it("normalizes at the optical-axis intersection without forcing the displaced film center to unity", () => {
    const state = deriveGroundGlassNaturalIllumination(tiltedGeometry(5, 12));
    if (state.kind !== "nonparallel-geometric") throw new Error("Expected a non-parallel fixture");

    const axisParameter = state.lensToFilmCenterLocalMm[2] / state.imageSideAxisLocal[2];
    const axisIntersectionX = axisParameter * state.imageSideAxisLocal[0] - state.lensToFilmCenterLocalMm[0];
    const axisIntersectionY = axisParameter * state.imageSideAxisLocal[1] - state.lensToFilmCenterLocalMm[1];
    expect(calculateGroundGlassNaturalIlluminationGain(
      state,
      axisIntersectionX,
      axisIntersectionY,
    )).toBeCloseTo(1, 12);
    expect(calculateGroundGlassNaturalIlluminationGain(state, 0, 0)).not.toBeCloseTo(1, 3);
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

  it("preserves the parallel cos^4 formula at multiple physical-film points", () => {
    const state = deriveGroundGlassNaturalIllumination(tiltedGeometry(0));
    expect(state.kind).toBe("parallel-cos4");
    for (const point of [[0, 0], [63.5, 50.8], [-40, 20], [12.5, -47]] as const) {
      expect(gainAt(state, point)).toBeCloseTo(
        gainAt(parallelState(150), point),
        12,
      );
    }
  });

  it.each([-5, -1, -0.1, 0.1, 1, 5])(
    "keeps Tilt %s degrees finite in the geometric illumination model",
    (tiltDeg) => {
      const state = deriveGroundGlassNaturalIllumination(tiltedGeometry(tiltDeg));
      expect(state.kind).toBe("nonparallel-geometric");
      for (const point of [[0, 0], [63.5, 50.8], [-63.5, -50.8], [0, 40]] as const) {
        const gain = gainAt(state, point);
        expect(Number.isFinite(gain)).toBe(true);
        expect(gain).toBeGreaterThanOrEqual(0);
      }
      expect(calculateGroundGlassNaturalIlluminationGain(state, 0, 0)).toBeCloseTo(1, 12);
    },
  );

  it.each([-5, -1, -0.1, 0.1, 1, 5])(
    "keeps Swing %s degrees finite in the geometric illumination model",
    (swingDeg) => {
      const state = deriveGroundGlassNaturalIllumination(swungGeometry(swingDeg));
      expect(state.kind).toBe("nonparallel-geometric");
      for (const point of [[0, 0], [63.5, 50.8], [-63.5, -50.8], [40, 0]] as const) {
        const gain = gainAt(state, point);
        expect(Number.isFinite(gain)).toBe(true);
        expect(gain).toBeGreaterThanOrEqual(0);
      }
    },
  );

  it("approaches the existing parallel result continuously as Tilt approaches zero", () => {
    const parallel = deriveGroundGlassNaturalIllumination(tiltedGeometry(0));
    const tinyPositive = deriveGroundGlassNaturalIllumination(tiltedGeometry(1e-5));
    const tinyNegative = deriveGroundGlassNaturalIllumination(tiltedGeometry(-1e-5));
    for (const point of [[-63.5, -50.8], [0, 0], [63.5, 50.8]] as const) {
      const reference = gainAt(parallel, point);
      expect(gainAt(tinyPositive, point)).toBeCloseTo(reference, 6);
      expect(gainAt(tinyNegative, point)).toBeCloseTo(reference, 6);
    }
  });

  it("approaches the existing parallel result continuously as Swing approaches zero", () => {
    const parallel = deriveGroundGlassNaturalIllumination(swungGeometry(0));
    const tinyPositive = deriveGroundGlassNaturalIllumination(swungGeometry(1e-5));
    const tinyNegative = deriveGroundGlassNaturalIllumination(swungGeometry(-1e-5));
    for (const point of [[-63.5, -50.8], [0, 0], [63.5, 50.8]] as const) {
      const reference = gainAt(parallel, point);
      expect(gainAt(tinyPositive, point)).toBeCloseTo(reference, 6);
      expect(gainAt(tinyNegative, point)).toBeCloseTo(reference, 6);
    }
  });

  it("mirrors the physical illumination field when Tilt changes sign", () => {
    const positive = deriveGroundGlassNaturalIllumination(tiltedGeometry(5));
    const negative = deriveGroundGlassNaturalIllumination(tiltedGeometry(-5));
    for (const y of [-50.8, -20, 0, 20, 50.8]) {
      expect(calculateGroundGlassNaturalIlluminationGain(positive, 12, y)).toBeCloseTo(
        calculateGroundGlassNaturalIlluminationGain(negative, 12, -y),
        12,
      );
    }
    expect(calculateGroundGlassNaturalIlluminationGain(positive, 0, 40)).not.toBeCloseTo(
      calculateGroundGlassNaturalIlluminationGain(positive, 0, -40),
      5,
    );
  });

  it("mirrors the physical illumination field when Swing changes sign", () => {
    const positive = deriveGroundGlassNaturalIllumination(swungGeometry(5));
    const negative = deriveGroundGlassNaturalIllumination(swungGeometry(-5));
    expect(positive.kind).toBe("nonparallel-geometric");
    expect(negative.kind).toBe("nonparallel-geometric");
    for (const x of [-63.5, -20, 0, 20, 63.5]) {
      expect(calculateGroundGlassNaturalIlluminationGain(positive, x, 12)).toBeCloseTo(
        calculateGroundGlassNaturalIlluminationGain(negative, -x, 12),
        12,
      );
    }
  });

  it("keeps combined rise, shift, Tilt, and Swing geometry finite", () => {
    const optics = deriveOpticsState(cameraFor({
      frontRiseMm: 15,
      frontShiftMm: -12,
      frontTiltDeg: 3,
      frontSwingDeg: -2,
    }), architectureRiseScene);
    expect(optics.groundGlassNaturalIllumination.kind).toBe("nonparallel-geometric");
    for (const point of [[0, 0], [-63.5, -50.8], [63.5, 50.8]] as const) {
      expect(Number.isFinite(gainAt(optics.groundGlassNaturalIllumination, point))).toBe(true);
    }
  });

  it("keeps aperture throughput independent from the spatial natural-illumination field", () => {
    const wide = deriveOpticsState(cameraFor({ frontTiltDeg: 5, aperture: 5.6 }), architectureRiseScene);
    const stopped = deriveOpticsState(cameraFor({ frontTiltDeg: 5, aperture: 22 }), architectureRiseScene);
    expect(stopped.groundGlassNaturalIllumination).toEqual(wide.groundGlassNaturalIllumination);
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
    const incorrectSign = {
      kind: "nonparallel-geometric" as const,
      referenceImageDistanceMm: 150,
      referenceFilmIncidenceCosine: 0.99,
      lensToFilmCenterLocalMm: [0, 0, -150] as const,
      imageSideAxisLocal: [0, 0, -1] as const,
      filmNormalTowardLensSign: 0 as -1 | 1,
    };
    expect(calculateGroundGlassNaturalIlluminationGain(incorrectSign, 0, 0)).toBe(1);
    const validTiltState = deriveGroundGlassNaturalIllumination(tiltedGeometry(5));
    if (validTiltState.kind !== "nonparallel-geometric") throw new Error("Expected a non-parallel fixture");
    expect(calculateGroundGlassNaturalIlluminationGain({
      ...validTiltState,
      filmNormalTowardLensSign: -validTiltState.filmNormalTowardLensSign as -1 | 1,
    }, 0, 0)).toBe(1);
  });

  it("rejects degenerate plane bases and image-side intersections behind the lens", () => {
    const tilted = tiltedGeometry(5);
    expect(deriveGroundGlassNaturalIllumination({
      ...tilted,
      rearStandardFrame: {
        ...tilted.rearStandardFrame,
        upWorld: tilted.rearStandardFrame.rightWorld,
      },
    })).toEqual({ kind: "neutral", reason: "invalid-geometry" });

    const behindLensCenter = vec(0, 0, 150);
    expect(deriveGroundGlassNaturalIllumination({
      ...tilted,
      filmPlane: planeFromPointNormal(behindLensCenter, tilted.filmPlane.normal),
      rearStandardFrame: {
        ...tilted.rearStandardFrame,
        centerWorld: behindLensCenter,
      },
    })).toEqual({ kind: "neutral", reason: "invalid-geometry" });
  });

  it("does not emit light from the image-side back hemisphere", () => {
    const state = deriveGroundGlassNaturalIllumination(tiltedGeometry(5));
    expect(state.kind).toBe("nonparallel-geometric");
    expect(calculateGroundGlassNaturalIlluminationGain(state, 0, -10_000)).toBe(0);
  });
});
