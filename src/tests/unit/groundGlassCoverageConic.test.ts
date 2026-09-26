import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  calculateGroundGlassCoverageGain,
  deriveGroundGlassCoverage,
} from "../../core/optics/groundGlassCoverage";
import { deriveGroundGlassCoverageConic } from "../../core/optics/groundGlassCoverageConic";
import { deriveLensCoverage } from "../../core/optics/lensCoverage";
import { planeFromPointNormal } from "../../core/math/plane";
import {
  add,
  cross,
  dot,
  normalize,
  rotateAroundX,
  scale,
  subtract,
  vec,
} from "../../core/math/vec";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { macroCompoundMovementsScene } from "../../scenes/definitions/macro-compound-movements";
import { macroObliquePlaneScene } from "../../scenes/definitions/macro-oblique-plane";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { resolvePhysicalImageCircleRenderGeometry } from "../../render/imageCircleGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { CameraState } from "../../types/camera";
import type { SceneDefinition } from "../../types/scene";
import type { DerivedLensCoverage } from "../../types/lens";
import type {
  GroundGlassCoverageState,
  Plane,
  StandardFrame,
  Vec3,
} from "../../types/optics";
import type { GroundGlassCoverageGeometry } from "../../core/optics/groundGlassCoverage";

const finiteCoverage = deriveLensCoverage(
  { kind: "angular", fullCoverageAngleDeg: 72 },
  150,
);
if (!finiteCoverage || finiteCoverage.kind !== "angular") {
  throw new Error("Expected a finite 150 mm angular coverage fixture");
}

const geometryForFilm = (
  tiltDeg = 0,
  swingDeg = 0,
  filmCenter = vec(0, 0, -150),
): GroundGlassCoverageGeometry => {
  const tilt = (tiltDeg * Math.PI) / 180;
  const swing = (swingDeg * Math.PI) / 180;
  const right = vec(Math.cos(swing), 0, -Math.sin(swing));
  const up = vec(
    Math.sin(swing) * Math.sin(tilt),
    Math.cos(tilt),
    Math.cos(swing) * Math.sin(tilt),
  );
  const normal = normalize(cross(right, up));
  const filmPlane = planeFromPointNormal(filmCenter, normal);
  const rearStandardFrame: StandardFrame = {
    centerWorld: filmCenter,
    rightWorld: right,
    upWorld: up,
    normalWorld: normal,
    plane: filmPlane,
  };
  return {
    lensCenterWorld: vec(0, 0, 0),
    filmPlane,
    rearStandardFrame,
    opticalAxis: { origin: vec(0, 0, 0), direction: vec(0, 0, 1) },
    isParallelLensFilm: tiltDeg === 0 && swingDeg === 0,
  };
};

const conicState = (state: GroundGlassCoverageState): Extract<
  GroundGlassCoverageState,
  { kind: "nonparallel-conic" }
> => {
  expect(state.kind).toBe("nonparallel-conic");
  if (state.kind !== "nonparallel-conic") throw new Error("Expected a conic state");
  return state;
};

const conicValue = (
  state: Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>,
  x: number,
  y: number,
) => {
  const { a, b, c, d, e, f } = state.quadratic;
  return a * x * x + b * x * y + c * y * y + d * x + e * y + f;
};

const cameraFor = (
  scene: SceneDefinition,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  ...overrides,
  activeSceneId: scene.id,
});

const deriveFor = (scene: SceneDefinition, overrides: Partial<CameraState> = {}) =>
  deriveOpticsState(cameraFor(scene, overrides), scene);

const sampleGrid = [
  [-120, -100], [-100, -100], [0, -100], [100, -100], [120, -100],
  [-120, 0], [-100, 0], [0, 0], [100, 0], [120, 0],
  [-120, 100], [-100, 100], [0, 100], [100, 100], [120, 100],
] as const;

describe("non-parallel finite Ground Glass coverage conic", () => {
  it("reduces analytically to the canonical circle in the parallel limit", () => {
    const result = deriveGroundGlassCoverageConic({
      lensCoverage: finiteCoverage,
      geometry: { ...geometryForFilm(), isParallelLensFilm: false },
    });
    expect(result).not.toBeNull();
    if (!result) return;

    const k = 1 / (1 + (finiteCoverage.imageCircleRadiusMm / finiteCoverage.imageDistanceMm) ** 2);
    expect(result.quadratic.a).toBeCloseTo(k, 12);
    expect(result.quadratic.b).toBeCloseTo(0, 12);
    expect(result.quadratic.c).toBeCloseTo(k, 12);
    expect(result.quadratic.d).toBeCloseTo(0, 12);
    expect(result.quadratic.e).toBeCloseTo(0, 12);
    expect(result.quadratic.f).toBeCloseTo(-k * finiteCoverage.imageCircleRadiusMm ** 2, 9);
    expect(-result.quadratic.f / result.quadratic.a).toBeCloseTo(
      finiteCoverage.imageCircleRadiusMm ** 2,
      9,
    );
  });

  it("puts independently intersected cone-generator rays on Q=0", () => {
    const geometry = geometryForFilm(7, 4);
    const state = deriveGroundGlassCoverage({ lensCoverage: finiteCoverage, geometry });
    const conic = conicState(state);
    const axis = scale(normalize(geometry.opticalAxis.direction), -1);
    const slope = finiteCoverage.imageCircleRadiusMm / finiteCoverage.imageDistanceMm;
    const { lensCenterWorld: lens, filmPlane, rearStandardFrame: frame } = geometry;

    for (let index = 0; index < 12; index += 1) {
      const azimuth = (index / 12) * Math.PI * 2;
      const radial = vec(Math.cos(azimuth), Math.sin(azimuth), 0);
      const direction = normalize(add(axis, scale(radial, slope)));
      const denominator = dot(filmPlane.normal, direction);
      const distance = dot(filmPlane.normal, subtract(filmPlane.point, lens)) / denominator;
      expect(distance).toBeGreaterThan(0);
      const worldPoint = add(lens, scale(direction, distance));
      const relativePoint = subtract(worldPoint, frame.centerWorld);
      const x = dot(relativePoint, frame.rightWorld);
      const y = dot(relativePoint, frame.upWorld);
      expect(conicValue(conic, x, y)).toBeCloseTo(0, 6);
      expect(conic.axial.x * x + conic.axial.y * y + conic.axial.constant)
        .toBeGreaterThan(0);
    }
  });

  it("enforces the image-side half-space independently of the double-cone quadratic", () => {
    const geometry = geometryForFilm(5, 0, vec(0, 0, 150));
    const state = deriveGroundGlassCoverage({ lensCoverage: finiteCoverage, geometry });
    const conic = conicState(state);
    expect(conicValue(conic, 0, 0)).toBeLessThan(0);
    expect(conic.axial.constant).toBeLessThan(0);
    expect(calculateGroundGlassCoverageGain(state, 0, 0)).toBe(0);
  });

  it("fails closed for invalid geometry and canonical coverage values", () => {
    const geometry = geometryForFilm(5, 0);
    for (const invalidGeometry of [
      { ...geometry, opticalAxis: { ...geometry.opticalAxis, direction: vec(0, 0, 0) } },
      {
        ...geometry,
        opticalAxis: { ...geometry.opticalAxis, direction: vec(1.2e308, 1.2e308, 1.2e308) },
      },
      {
        ...geometry,
        rearStandardFrame: {
          ...geometry.rearStandardFrame,
          rightWorld: vec(0, 0, 0),
        },
      },
      { ...geometry, lensCenterWorld: vec(Number.NaN, 0, 0) },
    ]) {
      expect(deriveGroundGlassCoverage({
        lensCoverage: finiteCoverage,
        geometry: invalidGeometry,
      })).toEqual({ kind: "neutral", reason: "invalid-geometry" });
    }

    const invalidCoverage = {
      ...finiteCoverage,
      imageDistanceMm: Number.POSITIVE_INFINITY,
    } as DerivedLensCoverage;
    expect(deriveGroundGlassCoverage({
      lensCoverage: invalidCoverage,
      geometry,
    })).toEqual({ kind: "neutral", reason: "invalid-coverage" });
  });

  it("mirrors physical coverage under equal and opposite Tilt", () => {
    const positive = conicState(deriveFor(architectureRiseScene, { frontTiltDeg: 5 }).groundGlassCoverage);
    const negative = conicState(deriveFor(architectureRiseScene, { frontTiltDeg: -5 }).groundGlassCoverage);
    let varied = false;
    for (const [x, y] of sampleGrid) {
      const positiveGain = calculateGroundGlassCoverageGain(positive, x, y);
      const mirroredGain = calculateGroundGlassCoverageGain(negative, x, -y);
      expect(positiveGain).toBe(mirroredGain);
      varied ||= positiveGain !== calculateGroundGlassCoverageGain(positive, x, -y);
    }
    expect(varied).toBe(true);
  });

  it("mirrors physical coverage under equal and opposite Swing", () => {
    const positive = deriveFor(architectureRiseScene, { frontSwingDeg: 5 }).groundGlassCoverage;
    const negative = deriveFor(architectureRiseScene, { frontSwingDeg: -5 }).groundGlassCoverage;
    conicState(positive);
    conicState(negative);
    let varied = false;
    for (const [x, y] of sampleGrid) {
      const positiveGain = calculateGroundGlassCoverageGain(positive, x, y);
      expect(positiveGain).toBe(calculateGroundGlassCoverageGain(negative, -x, y));
      varied ||= positiveGain !== calculateGroundGlassCoverageGain(positive, -x, y);
    }
    expect(varied).toBe(true);
  });

  it("uses derived geometry for front and rear standard Tilt, Swing, Rise, and Shift", () => {
    const movementCases: Partial<CameraState>[] = [
      { frontTiltDeg: 4 },
      { frontSwingDeg: 4 },
      { rearTiltDeg: 4 },
      { rearSwingDeg: 4 },
      { frontTiltDeg: 4, frontRiseMm: 20, frontShiftMm: -12 },
      { rearSwingDeg: 4, rearRiseMm: 20, rearShiftMm: 12 },
    ];
    for (const movements of movementCases) {
      const optics = deriveFor(architectureRiseScene, movements);
      expect(optics.groundGlassCoverage.kind).toBe("nonparallel-conic");
      if (optics.groundGlassCoverage.kind === "nonparallel-conic") {
        expect(Object.values(optics.groundGlassCoverage.quadratic).every(Number.isFinite)).toBe(true);
        expect(Object.values(optics.groundGlassCoverage.axial).every(Number.isFinite)).toBe(true);
      }
    }
  });

  it("handles compound Tilt and Swing without fallback and classifies axis/interior/exterior samples", () => {
    const optics = deriveFor(architectureRiseScene, { frontTiltDeg: 5, frontSwingDeg: 5 });
    const state = conicState(optics.groundGlassCoverage);
    expect(Object.values(state.quadratic).every(Number.isFinite)).toBe(true);
    expect(Object.values(state.axial).every(Number.isFinite)).toBe(true);

    const axis = scale(normalize(optics.opticalAxis.direction), -1);
    const denominator = dot(optics.filmPlane.normal, axis);
    const distance = dot(
      optics.filmPlane.normal,
      subtract(optics.filmPlane.point, optics.lensCenterWorld),
    ) / denominator;
    const axisPoint = add(optics.lensCenterWorld, scale(axis, distance));
    const relativeAxisPoint = subtract(axisPoint, optics.rearStandardFrame.centerWorld);
    const axisX = dot(relativeAxisPoint, optics.rearStandardFrame.rightWorld);
    const axisY = dot(relativeAxisPoint, optics.rearStandardFrame.upWorld);

    expect(calculateGroundGlassCoverageGain(optics.groundGlassCoverage, axisX, axisY)).toBe(1);
    expect(calculateGroundGlassCoverageGain(optics.groundGlassCoverage, 1500, 1500)).toBe(0);
    expect(conicValue(state, axisX, axisY)).toBeLessThan(0);
  });

  it("is invariant to a rigid translation and camera-body pitch", () => {
    const geometry = geometryForFilm(8, -5);
    const baseline = deriveGroundGlassCoverageConic({ lensCoverage: finiteCoverage, geometry });
    expect(baseline).not.toBeNull();
    if (!baseline) return;

    const pitchDeg = 23;
    const translation = vec(720, -340, 125);
    const point = (value: Vec3) => add(rotateAroundX(value, pitchDeg), translation);
    const direction = (value: Vec3) => rotateAroundX(value, pitchDeg);
    const plane = (value: Plane) => planeFromPointNormal(point(value.point), direction(value.normal));
    const movedFilmPlane = plane(geometry.filmPlane);
    const movedFramePlane = plane(geometry.rearStandardFrame.plane);
    const transformed: GroundGlassCoverageGeometry = {
      ...geometry,
      lensCenterWorld: point(geometry.lensCenterWorld),
      filmPlane: movedFilmPlane,
      rearStandardFrame: {
        centerWorld: point(geometry.rearStandardFrame.centerWorld),
        rightWorld: direction(geometry.rearStandardFrame.rightWorld),
        upWorld: direction(geometry.rearStandardFrame.upWorld),
        normalWorld: direction(geometry.rearStandardFrame.normalWorld),
        plane: movedFramePlane,
      },
      opticalAxis: {
        origin: point(geometry.opticalAxis.origin),
        direction: direction(geometry.opticalAxis.direction),
      },
    };
    const moved = deriveGroundGlassCoverageConic({ lensCoverage: finiteCoverage, geometry: transformed });
    expect(moved).not.toBeNull();
    if (!moved) return;
    for (const key of Object.keys(baseline.quadratic) as (keyof typeof baseline.quadratic)[]) {
      expect(moved.quadratic[key]).toBeCloseTo(baseline.quadratic[key], 9);
    }
    for (const key of Object.keys(baseline.axial) as (keyof typeof baseline.axial)[]) {
      expect(moved.axial[key]).toBeCloseTo(baseline.axial[key], 9);
    }
  });

  it("stays finite across representative public Tilt and Swing values", () => {
    for (const movement of ["frontTiltDeg", "frontSwingDeg"] as const) {
      for (const value of [-10, -5, -0.1, 0, 0.1, 5, 10]) {
        const optics = deriveFor(architectureRiseScene, { [movement]: value });
        expect(optics.groundGlassCoverage.kind).not.toBe("neutral");
        if (optics.diagnostics.isParallelLensFilm) {
          expect(optics.groundGlassCoverage.kind).toBe("parallel-circle");
        } else {
          expect(optics.groundGlassCoverage.kind).toBe("nonparallel-conic");
          if (optics.groundGlassCoverage.kind === "nonparallel-conic") {
            expect(Object.values(optics.groundGlassCoverage.quadratic).every(Number.isFinite)).toBe(true);
            expect(Object.values(optics.groundGlassCoverage.axial).every(Number.isFinite)).toBe(true);
          }
        }
      }
    }
  });

  it("uses the existing strict Table Tilt threshold and preserves unbounded profiles", () => {
    const table = deriveFor(tableTiltScene, { focalLengthMm: 150, frontTiltDeg: 0.01 });
    expect(table.groundGlassCoverage.kind).toBe("nonparallel-conic");

    const unboundedLensCoverage: DerivedLensCoverage = {
      kind: "unbounded-ideal",
      imageCircleRadiusMm: null,
      imageCircleDiameterMm: null,
    };
    const unbounded = deriveGroundGlassCoverage({
      lensCoverage: unboundedLensCoverage,
      geometry: { ...geometryForFilm(5, 0), isParallelLensFilm: false },
    });
    expect(unbounded).toEqual({ kind: "unbounded" });

    const catalogUnbounded = deriveFor(architectureRiseScene, {
      focalLengthMm: 210,
      frontTiltDeg: 5,
    });
    expect(catalogUnbounded.lensCoverage?.kind).toBe("unbounded-ideal");
    expect(catalogUnbounded.groundGlassCoverage).toEqual({ kind: "unbounded" });
  });

  it("keeps non-parallel finite coverage separate from natural illumination and 3D circle rendering", () => {
    const macroOblique = deriveFor(macroObliquePlaneScene, { frontTiltDeg: 5 });
    expect(macroOblique.lensCoverage?.kind).toBe("angular");
    expect(macroOblique.groundGlassCoverage.kind).toBe("nonparallel-conic");
    expect(macroOblique.groundGlassNaturalIllumination).toEqual({
      kind: "neutral",
      reason: "non-parallel-lens-film",
    });
    expect(resolvePhysicalImageCircleRenderGeometry({
      coverage: macroOblique.groundGlassCoverage,
      rearStandardFrame: macroOblique.rearStandardFrame,
    })).toBeNull();

    const compound = deriveFor(macroCompoundMovementsScene, {
      frontTiltDeg: 4,
      frontSwingDeg: 4,
    });
    expect(compound.lensCoverage?.kind).toBe("angular");
    expect(compound.groundGlassCoverage.kind).toBe("nonparallel-conic");
  });

  it("keeps Oblique Architecture clipping asymmetric and mirrors it when Swing reverses", () => {
    const positive = deriveFor(obliqueArchitectureScene, {
      focalLengthMm: 150,
      frontRiseMm: 40,
      frontSwingDeg: 5,
    }).groundGlassCoverage;
    const negative = deriveFor(obliqueArchitectureScene, {
      focalLengthMm: 150,
      frontRiseMm: 40,
      frontSwingDeg: -5,
    }).groundGlassCoverage;
    conicState(positive);
    conicState(negative);

    const corners = [
      [-63.5, -50.8], [-63.5, 50.8], [63.5, -50.8], [63.5, 50.8],
      [0, 0], [0, 35], [0, -35],
    ] as const;
    const gains = corners.map(([x, y]) => calculateGroundGlassCoverageGain(positive, x, y));
    expect(new Set(gains).size).toBeGreaterThan(1);
    for (const [x, y] of corners) {
      expect(calculateGroundGlassCoverageGain(positive, x, y)).toBe(
        calculateGroundGlassCoverageGain(negative, -x, y),
      );
    }
  });
});
