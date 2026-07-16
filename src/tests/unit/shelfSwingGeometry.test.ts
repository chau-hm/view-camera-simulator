import { describe, expect, it } from "vitest";
import { pointToPlaneDistance } from "../../core/math/plane";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import geometry, {
  calibrateShelfSwing,
  getFloorWorldCorners,
  getSubjectWorldBoundsCorners,
  type ShelfSwingVec3,
} from "../../scenes/shelfSwingGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const STRICT_EPSILON = 1e-7;

const expectPointInside = (point: ShelfSwingVec3, bounds: typeof geometry.sceneBounds): void => {
  expect(point.x).toBeGreaterThanOrEqual(bounds.min.x - STRICT_EPSILON);
  expect(point.x).toBeLessThanOrEqual(bounds.max.x + STRICT_EPSILON);
  expect(point.y).toBeGreaterThanOrEqual(bounds.min.y - STRICT_EPSILON);
  expect(point.y).toBeLessThanOrEqual(bounds.max.y + STRICT_EPSILON);
  expect(point.z).toBeGreaterThanOrEqual(bounds.min.z - STRICT_EPSILON);
  expect(point.z).toBeLessThanOrEqual(bounds.max.z + STRICT_EPSILON);
};

const collectNumbers = (value: unknown): number[] => {
  if (typeof value === "number") return [value];
  if (Array.isArray(value)) return value.flatMap(collectNumbers);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap(collectNumbers);
  }
  return [];
};

describe("canonical Shelf Swing geometry", () => {
  it("views across the diagonal station trace instead of stacking the stations", () => {
    const stationTrace = {
      x: geometry.backSubject.focusDetailProbeWorld.x - geometry.frontSubject.focusDetailProbeWorld.x,
      z: geometry.backSubject.focusDetailProbeWorld.z - geometry.frontSubject.focusDetailProbeWorld.z,
    };
    const sightline = {
      x: geometry.observerCamera.target.x - geometry.observerCamera.position.x,
      z: geometry.observerCamera.target.z - geometry.observerCamera.position.z,
    };
    const normalizedDot = Math.abs(
      (stationTrace.x * sightline.x + stationTrace.z * sightline.z) /
        (Math.hypot(stationTrace.x, stationTrace.z) * Math.hypot(sightline.x, sightline.z)),
    );
    expect(normalizedDot).toBeLessThan(0.15);
    expect(geometry.observerCamera.position.y).toBeGreaterThan(geometry.floor.center.y);
  });

  it("keeps every canonical numeric value finite", () => {
    const numbers = collectNumbers({
      floor: geometry.floor,
      detailGeometry: geometry.detailGeometry,
      subjects: geometry.subjects,
      calibration: geometry.shelfSwingCalibration,
      solution: geometry.calibrationSolution,
      observerCamera: geometry.observerCamera,
      sceneBounds: geometry.sceneBounds,
      compositionTargetBounds: geometry.compositionTargetBounds,
    });
    expect(numbers.length).toBeGreaterThan(0);
    numbers.forEach((number) => expect(Number.isFinite(number)).toBe(true));
  });

  it("preserves the three stable target ids", () => {
    expect(geometry.subjects.map((subject) => subject.id)).toEqual([
      "shelf-front",
      "shelf-middle",
      "shelf-back",
    ]);
    expect(geometry.focusTargets.map((target) => target.id)).toEqual([
      "shelf-front",
      "shelf-middle",
      "shelf-back",
    ]);
  });

  it("places all centre probes at one height and exactly collinear in top view", () => {
    const [front, middle, back] = geometry.subjects.map((subject) => subject.focusDetailProbeWorld);
    expect(middle.y).toBeCloseTo(front.y, 12);
    expect(back.y).toBeCloseTo(front.y, 12);

    const cross =
      (middle.x - front.x) * (back.z - front.z) - (middle.z - front.z) * (back.x - front.x);
    expect(Math.abs(cross)).toBeLessThan(STRICT_EPSILON);
    expect(geometry.calibrationSolution.collinearityErrorMm).toBeLessThan(STRICT_EPSILON);
  });

  it("uses the optical axis as the vertical datum above a derived floor height", () => {
    expect(geometry.floor.center.y).toBeLessThan(0);
    expect(-geometry.floor.center.y).toBe(geometry.opticalAxisHeightAboveFloorMm);
    expect(geometry.opticalAxisHeightAboveFloorMm).toBe(
      geometry.detailGeometry.chart.centerY,
    );
    expect(geometry.opticalAxisHeightAboveFloorMm).toBeGreaterThanOrEqual(400);
    geometry.subjects.forEach((subject) => {
      expect(subject.worldPosition.y).toBe(geometry.floor.center.y);
      expect(subject.focusDetailProbeWorld.y).toBeCloseTo(0, 10);
    });
  });

  it("keeps every focus sample on its visible chart surface", () => {
    geometry.subjects.forEach((subject) => {
      expect(subject.focusSamples.map((sample) => sample.id)).toEqual([
        "centre",
        "top",
        "bottom",
        "left",
        "right",
      ]);
      expect(subject.focusSamples[0].worldPosition).toEqual(subject.focusDetailProbeWorld);
      subject.focusSamples.forEach((sample) => {
        expect(sample.localPosition.z).toBe(subject.focusChart.centerLocal.z);
        expect(
          Math.abs(sample.localPosition.x - subject.focusChart.centerLocal.x),
        ).toBeLessThanOrEqual(subject.focusChart.width / 2);
        expect(
          Math.abs(sample.localPosition.y - subject.focusChart.centerLocal.y),
        ).toBeLessThanOrEqual(subject.focusChart.height / 2);
        expect(pointToPlaneDistance(sample.worldPosition, geometry.subjectPlane)).toBeLessThan(
          STRICT_EPSILON,
        );
      });
    });
  });

  it("keeps all chart samples comfortably inside the baseline film frame", () => {
    const opticsState = deriveOpticsState(
      {
        ...DEFAULT_CAMERA_STATE,
        ...shelfSwingScene.cameraPreset,
        activeSceneId: shelfSwingScene.id,
      },
      shelfSwingScene,
    );

    geometry.subjects
      .flatMap((subject) => subject.focusSamples)
      .forEach((sample) => {
        const projected = projectWorldPointToFilmPlaneGroundGlass({
          worldPoint: sample.worldPosition,
          lensCenterWorld: opticsState.lensCenterWorld,
          filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
        });
        expect(projected.visible).toBe(true);
        expect(projected.uRaw).toBeGreaterThan(0.02);
        expect(projected.uRaw).toBeLessThan(0.98);
        expect(projected.vRaw).toBeGreaterThan(0.02);
        expect(projected.vRaw).toBeLessThan(0.98);
      });
  });

  it("contains the floor, all station structures, and all focus samples in scene bounds", () => {
    [
      ...getFloorWorldCorners(),
      ...geometry.subjects.flatMap(getSubjectWorldBoundsCorners),
      ...geometry.subjects.flatMap((subject) =>
        subject.focusSamples.map((sample) => sample.worldPosition),
      ),
    ].forEach((point) => expectPointInside(point, geometry.sceneBounds));
  });

  it("contains all three stations in the composition target bounds", () => {
    geometry.subjects
      .flatMap(getSubjectWorldBoundsCorners)
      .forEach((point) => expectPointInside(point, geometry.compositionTargetBounds));
  });

  it("derives a practical non-zero negative front-swing calibration", () => {
    const calibration = geometry.shelfSwingCalibration;
    expect(calibration.frontSwingDeg).not.toBe(0);
    expect(calibration.frontSwingDeg).toBeLessThan(0);
    expect(Math.abs(calibration.frontSwingDeg)).toBeGreaterThanOrEqual(3);
    expect(Math.abs(calibration.frontSwingDeg)).toBeLessThanOrEqual(5);
    expect(calibration.focusDistanceMm).toBeGreaterThanOrEqual(3000);
    expect(calibration.focusDistanceMm).toBeLessThanOrEqual(3500);
    expect(calibration.frontSwingDeg).toBeCloseTo(-3.802, 3);
    expect(calibration.focusDistanceMm).toBeCloseTo(3411.62, 1);
  });

  it("places the hinge on the film plane and the top-view subject trace", () => {
    const { hingeLine, subjectPlane } = geometry.calibrationSolution;
    expect(hingeLine.point.z).toBe(-geometry.shelfSwingCalibration.focalLengthMm);
    expect(hingeLine.direction).toEqual({ x: 0, y: 1, z: 0 });
    expect(
      hingeLine.point.x -
        (subjectPlane.topViewTrace.xPerZ * hingeLine.point.z +
          subjectPlane.topViewTrace.xInterceptMm),
    ).toBeCloseTo(0, 10);
  });

  it("intersects the diagonal subject plane along the calibrated optical axis", () => {
    const solution = geometry.calibrationSolution;
    expect(solution.focusDistanceMm).toBeGreaterThan(0);
    expect(
      pointToPlaneDistance(solution.opticalAxisIntersection, geometry.subjectPlane),
    ).toBeLessThan(geometry.shelfSwingCalibration.planeIntersectionToleranceMm);
    expect(solution.opticalAxisIntersection.x).toBeLessThan(0);
    expect(solution.opticalAxisIntersection.z).toBeGreaterThan(0);
  });

  it("fails clearly for invalid, coincident, non-collinear, and rearward layouts", () => {
    const valid = geometry.subjects.map((subject) => subject.focusDetailProbeWorld) as [
      ShelfSwingVec3,
      ShelfSwingVec3,
      ShelfSwingVec3,
    ];
    expect(() =>
      calibrateShelfSwing({
        focalLengthMm: Number.NaN,
        focusProbes: valid,
      }),
    ).toThrow(/positive finite focal length/);
    expect(() =>
      calibrateShelfSwing({
        focalLengthMm: 150,
        focusProbes: [valid[0], valid[0], valid[2]],
      }),
    ).toThrow(/must not coincide/);
    expect(() =>
      calibrateShelfSwing({
        focalLengthMm: 150,
        focusProbes: [valid[0], { ...valid[1], x: valid[1].x + 1 }, valid[2]],
      }),
    ).toThrow(/not collinear/);
    expect(() =>
      calibrateShelfSwing({
        focalLengthMm: 150,
        focusProbes: [
          { x: -800, y: 560, z: -5200 },
          { x: 0, y: 560, z: -3800 },
          { x: 800, y: 560, z: -2400 },
        ],
      }),
    ).toThrow(/no positive optical-axis intersection/);
  });
});
