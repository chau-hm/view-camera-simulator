import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { calculateGroundGlassCoverageGain } from "../../core/optics/groundGlassCoverage";
import { add, dot, rotateAroundX, subtract, vec } from "../../core/math/vec";
import { macroCompoundMovementsScene } from "../../scenes/definitions/macro-compound-movements";
import { macroObliquePlaneScene } from "../../scenes/definitions/macro-oblique-plane";
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import type { GroundGlassCoverageState, StandardFrame, Vec3 } from "../../types/optics";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import {
  createPhysicalLensCoverageSurfaceMesh,
  PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT,
  PHYSICAL_IMAGE_CIRCLE_SEGMENT_COUNT,
  resolvePhysicalLensCoverageRays,
  resolvePhysicalLensCoverageRenderGeometry,
} from "../../render/imageCircleGeometry";
import type { CameraState } from "../../types/camera";
import type { SceneDefinition } from "../../types/scene";

const frame = (centerWorld: Vec3 = vec(0, 0, -150)): StandardFrame => ({
  centerWorld,
  rightWorld: vec(1, 0, 0),
  upWorld: vec(0, 1, 0),
  normalWorld: vec(0, 0, 1),
  plane: { point: centerWorld, normal: vec(0, 0, 1), distance: centerWorld.z },
});

const ellipseCoverage = (input: {
  centerX?: number;
  centerY?: number;
  semiAxisX?: number;
  semiAxisY?: number;
  orientationRad?: number;
  coefficientScale?: number;
  coefficientSign?: 1 | -1;
  axial?: { x: number; y: number; constant: number };
} = {}): GroundGlassCoverageState => {
  const centerX = input.centerX ?? 0;
  const centerY = input.centerY ?? 0;
  const semiAxisX = input.semiAxisX ?? 20;
  const semiAxisY = input.semiAxisY ?? 30;
  const orientationRad = input.orientationRad ?? 0;
  const cosine = Math.cos(orientationRad);
  const sine = Math.sin(orientationRad);
  const lambdaX = 1 / (semiAxisX * semiAxisX);
  const lambdaY = 1 / (semiAxisY * semiAxisY);
  const a = lambdaX * cosine * cosine + lambdaY * sine * sine;
  const b = 2 * (lambdaX - lambdaY) * cosine * sine;
  const c = lambdaX * sine * sine + lambdaY * cosine * cosine;
  const d = -2 * a * centerX - b * centerY;
  const e = -b * centerX - 2 * c * centerY;
  const f =
    a * centerX * centerX +
    b * centerX * centerY +
    c * centerY * centerY -
    1;
  const coefficientScale = input.coefficientScale ?? 1;
  const coefficientSign = input.coefficientSign ?? 1;
  return {
    kind: "nonparallel-conic",
    quadratic: {
      a: a * coefficientScale * coefficientSign,
      b: b * coefficientScale * coefficientSign,
      c: c * coefficientScale * coefficientSign,
      d: d * coefficientScale * coefficientSign,
      e: e * coefficientScale * coefficientSign,
      f: f * coefficientScale * coefficientSign,
    },
    axial: input.axial ?? { x: 0, y: 0, constant: 150 },
  };
};

const cameraFor = (scene: SceneDefinition, overrides: Partial<CameraState> = {}) => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  ...overrides,
  activeSceneId: scene.id,
});

const deriveFor = (scene: SceneDefinition, overrides: Partial<CameraState> = {}) =>
  deriveOpticsState(cameraFor(scene, overrides), scene);

const localPoint = (point: Vec3, standard: StandardFrame) => {
  const relative = subtract(point, standard.centerWorld);
  return {
    x: dot(relative, standard.rightWorld),
    y: dot(relative, standard.upWorld),
  };
};

const evaluateQ = (
  coverage: Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>,
  x: number,
  y: number,
) => {
  const { a, b, c, d, e, f } = coverage.quadratic;
  const terms = [a * x * x, b * x * y, c * y * y, d * x, e * y, f];
  return {
    value: terms.reduce((sum, term) => sum + term, 0),
    scale: terms.reduce((sum, term) => sum + Math.abs(term), 0),
  };
};

const evaluateT = (
  coverage: Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>,
  x: number,
  y: number,
) => coverage.axial.x * x + coverage.axial.y * y + coverage.axial.constant;

const expectBoundaryAndImageSide = (
  geometry: NonNullable<ReturnType<typeof resolvePhysicalLensCoverageRenderGeometry>>,
  coverage: Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>,
  standard: StandardFrame,
) => {
  geometry.perimeterWorld.forEach((point) => {
    const local = localPoint(point, standard);
    const { value, scale: termScale } = evaluateQ(coverage, local.x, local.y);
    expect(Math.abs(value) / Math.max(termScale, 1e-12)).toBeLessThan(1e-8);
    expect(evaluateT(coverage, local.x, local.y)).toBeGreaterThan(0);
    expect(Math.abs(dot(standard.normalWorld, subtract(point, standard.plane.point))))
      .toBeLessThan(1e-5);
  });
};

describe("physical finite lens coverage render geometry", () => {
  it("preserves the 72-point parallel circle and its 12 canonical sparse rays", () => {
    const coverage: GroundGlassCoverageState = {
      kind: "parallel-circle",
      imageCircleRadiusMm: 108.98,
      opticalAxisOffsetXMm: 4,
      opticalAxisOffsetYMm: -6,
    };
    const geometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage,
      rearStandardFrame: frame(),
    });

    expect(geometry?.kind).toBe("parallel-circle");
    expect(geometry?.perimeterWorld).toHaveLength(PHYSICAL_IMAGE_CIRCLE_SEGMENT_COUNT);
    expect(geometry?.coverageRayEndpointsWorld).toHaveLength(
      PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT,
    );
    if (geometry?.kind !== "parallel-circle") return;
    expect(geometry.radiusMm).toBe(108.98);
    expect(geometry.opticalAxisOffsetXMm).toBe(4);
    expect(geometry.opticalAxisOffsetYMm).toBe(-6);
  });

  it("decomposes an axis-aligned ellipse from Q without changing the canonical state", () => {
    const coverage = ellipseCoverage({ semiAxisX: 20, semiAxisY: 30 });
    const standard = frame();
    const geometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage,
      rearStandardFrame: standard,
    });

    expect(geometry?.kind).toBe("nonparallel-conic");
    if (geometry?.kind !== "nonparallel-conic") return;
    expect(geometry.centerFilmXMm).toBeCloseTo(0, 10);
    expect(geometry.centerFilmYMm).toBeCloseTo(0, 10);
    expect(geometry.semiAxis1Mm).toBeCloseTo(20, 10);
    expect(geometry.semiAxis2Mm).toBeCloseTo(30, 10);
    expect(geometry.orientationRad).toBeCloseTo(0, 10);
    expect(geometry.centerWorld).toEqual(standard.centerWorld);
    expect(coverage).toEqual(ellipseCoverage({ semiAxisX: 20, semiAxisY: 30 }));
    expectBoundaryAndImageSide(geometry, coverage as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>, standard);
  });

  it("finds the translated conic centre and lifts it through the film basis", () => {
    const coverage = ellipseCoverage({
      centerX: 12,
      centerY: -7,
      semiAxisX: 30,
      semiAxisY: 20,
    });
    const standard = frame(vec(10, 5, -150));
    const geometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage,
      rearStandardFrame: standard,
    });

    expect(geometry?.kind).toBe("nonparallel-conic");
    if (geometry?.kind !== "nonparallel-conic") return;
    expect(geometry.centerFilmXMm).toBeCloseTo(12, 10);
    expect(geometry.centerFilmYMm).toBeCloseTo(-7, 10);
    expect(geometry.centerWorld.x).toBeCloseTo(22, 10);
    expect(geometry.centerWorld.y).toBeCloseTo(-2, 10);
    const translatedAxes = [geometry.semiAxis1Mm, geometry.semiAxis2Mm].sort((x, y) => x - y);
    expect(translatedAxes[0]).toBeCloseTo(20, 10);
    expect(translatedAxes[1]).toBeCloseTo(30, 10);
    expectBoundaryAndImageSide(geometry, coverage as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>, standard);
  });

  it("preserves the ellipse under positive coefficient scaling", () => {
    const base = ellipseCoverage({
      centerX: -9,
      centerY: 11,
      semiAxisX: 20,
      semiAxisY: 40,
      orientationRad: Math.PI / 6,
    });
    const scaled = ellipseCoverage({
      centerX: -9,
      centerY: 11,
      semiAxisX: 20,
      semiAxisY: 40,
      orientationRad: Math.PI / 6,
      coefficientScale: 7.5,
    });
    const standard = frame();
    const geometries = [base, scaled].map((coverage) =>
      resolvePhysicalLensCoverageRenderGeometry({ coverage, rearStandardFrame: standard }),
    );

    geometries.forEach((geometry) => expect(geometry?.kind).toBe("nonparallel-conic"));
    const [baseGeometry, scaledGeometry] = geometries;
    if (
      baseGeometry?.kind !== "nonparallel-conic" ||
      scaledGeometry?.kind !== "nonparallel-conic"
    ) return;
    expect(baseGeometry.centerFilmXMm).toBeCloseTo(-9, 10);
    expect(baseGeometry.centerFilmYMm).toBeCloseTo(11, 10);
    expect(baseGeometry.orientationRad).not.toBeCloseTo(0, 3);
    expect(scaledGeometry.centerFilmXMm).toBeCloseTo(baseGeometry.centerFilmXMm, 10);
    expect(scaledGeometry.centerFilmYMm).toBeCloseTo(baseGeometry.centerFilmYMm, 10);
    expect(scaledGeometry.semiAxis1Mm).toBeCloseTo(baseGeometry.semiAxis1Mm, 10);
    expect(scaledGeometry.semiAxis2Mm).toBeCloseTo(baseGeometry.semiAxis2Mm, 10);
    expect(scaledGeometry.orientationRad).toBeCloseTo(baseGeometry.orientationRad, 10);
    const rotatedAxes = [baseGeometry.semiAxis1Mm, baseGeometry.semiAxis2Mm].sort((x, y) => x - y);
    expect(rotatedAxes[0]).toBeCloseTo(20, 10);
    expect(rotatedAxes[1]).toBeCloseTo(40, 10);
    for (let index = 0; index < baseGeometry.perimeterWorld.length; index += 1) {
      expect(scaledGeometry.perimeterWorld[index].x).toBeCloseTo(baseGeometry.perimeterWorld[index].x, 8);
      expect(scaledGeometry.perimeterWorld[index].y).toBeCloseTo(baseGeometry.perimeterWorld[index].y, 8);
      expect(scaledGeometry.perimeterWorld[index].z).toBeCloseTo(baseGeometry.perimeterWorld[index].z, 8);
    }
    const baseSurface = createPhysicalLensCoverageSurfaceMesh(baseGeometry);
    const scaledSurface = createPhysicalLensCoverageSurfaceMesh(scaledGeometry);
    expect(baseSurface).not.toBeNull();
    expect(scaledSurface).not.toBeNull();
    if (!baseSurface || !scaledSurface) return;
    expect(scaledSurface.triangleIndices).toEqual(baseSurface.triangleIndices);
    scaledSurface.verticesWorld.forEach((point, index) => {
      expect(point.x).toBeCloseTo(baseSurface.verticesWorld[index].x, 8);
      expect(point.y).toBeCloseTo(baseSurface.verticesWorld[index].y, 8);
      expect(point.z).toBeCloseTo(baseSurface.verticesWorld[index].z, 8);
    });
    const positiveState = base as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>;
    const scaledState = scaled as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>;
    expect(calculateGroundGlassCoverageGain(positiveState, -9, 11)).toBe(1);
    expect(calculateGroundGlassCoverageGain(scaledState, -9, 11)).toBe(1);
    expectBoundaryAndImageSide(baseGeometry, base as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>, standard);
  });

  it("rejects negative coefficient scaling because Q<=0 defines the covered side", () => {
    const positive = ellipseCoverage({
      centerX: -9,
      centerY: 11,
      semiAxisX: 20,
      semiAxisY: 40,
      orientationRad: Math.PI / 6,
    }) as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>;
    const signReversed = ellipseCoverage({
      centerX: -9,
      centerY: 11,
      semiAxisX: 20,
      semiAxisY: 40,
      orientationRad: Math.PI / 6,
      coefficientScale: 3,
      coefficientSign: -1,
    }) as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>;
    const standard = frame();
    const centerX = -9;
    const centerY = 11;

    expect(evaluateQ(positive, centerX, centerY).value).toBeLessThan(0);
    expect(calculateGroundGlassCoverageGain(positive, centerX, centerY)).toBe(1);
    expect(resolvePhysicalLensCoverageRenderGeometry({
      coverage: positive,
      rearStandardFrame: standard,
    })).not.toBeNull();

    expect(evaluateQ(signReversed, centerX, centerY).value).toBeGreaterThan(0);
    expect(calculateGroundGlassCoverageGain(signReversed, centerX, centerY)).toBe(0);
    expect(resolvePhysicalLensCoverageRenderGeometry({
      coverage: signReversed,
      rearStandardFrame: standard,
    })).toBeNull();
  });

  it("rejects open, singular, empty, invalid, and wrong-image-side conics", () => {
    const standard = frame();
    const rejected = [
      {
        kind: "nonparallel-conic",
        quadratic: { a: 1, b: 0, c: -1, d: 0, e: 0, f: -1 },
        axial: { x: 0, y: 0, constant: 150 },
      },
      {
        kind: "nonparallel-conic",
        quadratic: { a: 1, b: 2, c: 1, d: 0, e: 0, f: -1 },
        axial: { x: 0, y: 0, constant: 150 },
      },
      {
        kind: "nonparallel-conic",
        quadratic: { a: 1, b: 0, c: 1, d: 0, e: 0, f: 1 },
        axial: { x: 0, y: 0, constant: 150 },
      },
      {
        kind: "nonparallel-conic",
        quadratic: { a: Number.NaN, b: 0, c: 1, d: 0, e: 0, f: -1 },
        axial: { x: 0, y: 0, constant: 150 },
      },
      {
        ...ellipseCoverage(),
        axial: { x: 1, y: 0, constant: 0 },
      },
    ] as GroundGlassCoverageState[];

    rejected.forEach((coverage) => {
      expect(resolvePhysicalLensCoverageRenderGeometry({
        coverage,
        rearStandardFrame: standard,
      })).toBeNull();
    });
    expect(resolvePhysicalLensCoverageRenderGeometry({
      coverage: ellipseCoverage(),
      rearStandardFrame: { ...standard, rightWorld: vec(0, 0, 0) },
    })).toBeNull();
    expect(resolvePhysicalLensCoverageRenderGeometry({
      coverage: { kind: "unbounded" },
      rearStandardFrame: standard,
    })).toBeNull();
    expect(resolvePhysicalLensCoverageRenderGeometry({
      coverage: { kind: "neutral", reason: "invalid-geometry" },
      rearStandardFrame: standard,
    })).toBeNull();
  });

  it("uses the real Oblique Architecture conic and validates every lifted boundary sample", () => {
    const optics = deriveFor(obliqueArchitectureScene, {
      focalLengthMm: 150,
      frontRiseMm: 40,
      frontSwingDeg: 5,
    });
    expect(optics.groundGlassCoverage.kind).toBe("nonparallel-conic");
    if (optics.groundGlassCoverage.kind !== "nonparallel-conic") return;

    const geometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage: optics.groundGlassCoverage,
      rearStandardFrame: optics.rearStandardFrame,
    });
    expect(geometry?.kind).toBe("nonparallel-conic");
    if (geometry?.kind !== "nonparallel-conic") return;
    expect(geometry.perimeterWorld).toHaveLength(PHYSICAL_IMAGE_CIRCLE_SEGMENT_COUNT);
    expectBoundaryAndImageSide(geometry, optics.groundGlassCoverage, optics.rearStandardFrame);
  });

  it("mirrors real Swing and Tilt cases in film coordinates and supports compound movement", () => {
    const swingPositive = deriveFor(obliqueArchitectureScene, {
      focalLengthMm: 150,
      frontRiseMm: 40,
      frontSwingDeg: 5,
    });
    const swingNegative = deriveFor(obliqueArchitectureScene, {
      focalLengthMm: 150,
      frontRiseMm: 40,
      frontSwingDeg: -5,
    });
    const positiveSwingGeometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage: swingPositive.groundGlassCoverage,
      rearStandardFrame: swingPositive.rearStandardFrame,
    });
    const negativeSwingGeometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage: swingNegative.groundGlassCoverage,
      rearStandardFrame: swingNegative.rearStandardFrame,
    });
    expect(positiveSwingGeometry?.kind).toBe("nonparallel-conic");
    expect(negativeSwingGeometry?.kind).toBe("nonparallel-conic");
    if (
      positiveSwingGeometry?.kind !== "nonparallel-conic" ||
      negativeSwingGeometry?.kind !== "nonparallel-conic"
    ) return;
    expect(positiveSwingGeometry.centerFilmXMm).toBeCloseTo(
      -negativeSwingGeometry.centerFilmXMm,
      7,
    );
    expect(positiveSwingGeometry.centerFilmYMm).toBeCloseTo(
      negativeSwingGeometry.centerFilmYMm,
      7,
    );

    const tiltPositive = deriveFor(macroObliquePlaneScene, { frontTiltDeg: 5 });
    const tiltNegative = deriveFor(macroObliquePlaneScene, { frontTiltDeg: -5 });
    const positiveTiltGeometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage: tiltPositive.groundGlassCoverage,
      rearStandardFrame: tiltPositive.rearStandardFrame,
    });
    const negativeTiltGeometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage: tiltNegative.groundGlassCoverage,
      rearStandardFrame: tiltNegative.rearStandardFrame,
    });
    expect(positiveTiltGeometry?.kind).toBe("nonparallel-conic");
    expect(negativeTiltGeometry?.kind).toBe("nonparallel-conic");
    if (
      positiveTiltGeometry?.kind !== "nonparallel-conic" ||
      negativeTiltGeometry?.kind !== "nonparallel-conic"
    ) return;
    expect(positiveTiltGeometry.centerFilmXMm).toBeCloseTo(
      negativeTiltGeometry.centerFilmXMm,
      7,
    );
    expect(positiveTiltGeometry.centerFilmYMm).toBeCloseTo(
      -negativeTiltGeometry.centerFilmYMm,
      7,
    );

    const compound = deriveFor(macroCompoundMovementsScene, {
      frontTiltDeg: 4,
      frontSwingDeg: 4,
    });
    const compoundGeometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage: compound.groundGlassCoverage,
      rearStandardFrame: compound.rearStandardFrame,
    });
    expect(compoundGeometry?.kind).toBe("nonparallel-conic");
    if (compoundGeometry?.kind !== "nonparallel-conic") return;
    expect(Math.abs(Math.sin(2 * compoundGeometry.orientationRad))).toBeGreaterThan(0.01);
    expectBoundaryAndImageSide(
      compoundGeometry,
      compound.groundGlassCoverage as Extract<GroundGlassCoverageState, { kind: "nonparallel-conic" }>,
      compound.rearStandardFrame,
    );
  });

  it("keeps local ellipse parameters invariant under a rigid body pitch and translation", () => {
    const optics = deriveFor(obliqueArchitectureScene, {
      focalLengthMm: 150,
      frontRiseMm: 40,
      frontSwingDeg: 5,
    });
    const original = resolvePhysicalLensCoverageRenderGeometry({
      coverage: optics.groundGlassCoverage,
      rearStandardFrame: optics.rearStandardFrame,
    });
    expect(original?.kind).toBe("nonparallel-conic");
    if (original?.kind !== "nonparallel-conic") return;

    const pitchDeg = 17;
    const translation = vec(125, -80, 42);
    const transformPoint = (point: Vec3) => add(rotateAroundX(point, pitchDeg), translation);
    const transformDirection = (direction: Vec3) => rotateAroundX(direction, pitchDeg);
    const originalFrame = optics.rearStandardFrame;
    const transformedCenter = transformPoint(originalFrame.centerWorld);
    const transformedNormal = transformDirection(originalFrame.normalWorld);
    const transformedFrame: StandardFrame = {
      centerWorld: transformedCenter,
      rightWorld: transformDirection(originalFrame.rightWorld),
      upWorld: transformDirection(originalFrame.upWorld),
      normalWorld: transformedNormal,
      plane: {
        point: transformedCenter,
        normal: transformedNormal,
        distance: dot(transformedNormal, transformedCenter),
      },
    };
    const moved = resolvePhysicalLensCoverageRenderGeometry({
      coverage: optics.groundGlassCoverage,
      rearStandardFrame: transformedFrame,
    });
    expect(moved?.kind).toBe("nonparallel-conic");
    if (moved?.kind !== "nonparallel-conic") return;
    expect(moved.centerFilmXMm).toBeCloseTo(original.centerFilmXMm, 9);
    expect(moved.centerFilmYMm).toBeCloseTo(original.centerFilmYMm, 9);
    expect(moved.semiAxis1Mm).toBeCloseTo(original.semiAxis1Mm, 9);
    expect(moved.semiAxis2Mm).toBeCloseTo(original.semiAxis2Mm, 9);
    expect(moved.orientationRad).toBeCloseTo(original.orientationRad, 9);
    expect(moved.perimeterWorld).toHaveLength(original.perimeterWorld.length);
    original.perimeterWorld.forEach((point, index) => {
      const expected = transformPoint(point);
      expect(moved.perimeterWorld[index].x).toBeCloseTo(expected.x, 8);
      expect(moved.perimeterWorld[index].y).toBeCloseTo(expected.y, 8);
      expect(moved.perimeterWorld[index].z).toBeCloseTo(expected.z, 8);
    });
  });

  it("uses one exact perimeter for the filled surface and all sparse rays", () => {
    const coverage = ellipseCoverage({ orientationRad: Math.PI / 6 });
    const geometry = resolvePhysicalLensCoverageRenderGeometry({
      coverage,
      rearStandardFrame: frame(),
    });
    expect(geometry?.kind).toBe("nonparallel-conic");
    if (geometry?.kind !== "nonparallel-conic") return;

    const surface = createPhysicalLensCoverageSurfaceMesh(geometry);
    const rays = resolvePhysicalLensCoverageRays({
      geometry,
      lensCenterWorld: vec(0, 0, 0),
    });
    expect(surface).not.toBeNull();
    if (!surface) return;
    expect(surface.verticesWorld[0]).toBe(geometry.centerWorld);
    expect(surface.verticesWorld.slice(1)).toEqual(geometry.perimeterWorld);
    expect(surface.triangleIndices).toHaveLength(geometry.perimeterWorld.length * 3);
    expect(surface.triangleIndices.length / 3).toBe(geometry.perimeterWorld.length);
    expect(rays).toHaveLength(PHYSICAL_IMAGE_CIRCLE_COVERAGE_RAY_COUNT);
    rays.forEach((ray, index) => {
      expect(ray.startWorld).toEqual(vec(0, 0, 0));
      expect(geometry.coverageRayEndpointsWorld).toContain(ray.endWorld);
      expect(ray.endWorld).toBe(geometry.perimeterWorld[
        Math.floor((index * geometry.perimeterWorld.length) / rays.length)
      ]);
    });
  });
});
