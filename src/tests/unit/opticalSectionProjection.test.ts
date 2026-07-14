import { describe, expect, it } from "vitest";
import {
  buildDofPolygonPoints,
  computeOpticalSectionData,
  type ScreenPoint,
} from "../../components/geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import tableTiltGeometry from "../../scenes/tableTiltGeometry";
import type { CameraState, GeometryView } from "../../types/camera";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const WIDTH = 640;
const HEIGHT = 360;

const projectionFor = (
  opticsState: DerivedOpticsState,
  scene: SceneDefinition,
  lateralWindow: Parameters<typeof computeOpticalSectionData>[0]["lateralWindow"] =
    getGeometryPresentationProfile(scene).lateralWindow,
) => {
  const profile = getGeometryPresentationProfile(scene);
  const depthWindow = profile.depthWindow.mode === "fixed"
    ? { minMm: profile.depthWindow.minMm, maxMm: profile.depthWindow.maxMm }
    : {
        minMm: Math.min(-250, scene.bounds.min.z - profile.depthWindow.marginMm),
        maxMm: scene.bounds.max.z + profile.depthWindow.marginMm,
      };
  return computeOpticalSectionData({
    opticsState,
    scene,
    svgWidth: WIDTH,
    svgHeight: HEIGHT,
    depthWindow,
    lateralWindow,
    paddingPx: profile.diagramPaddingPx,
  });
};

const cameraFor = (scene: SceneDefinition, overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  ...overrides,
});

const cross2d = (a: ScreenPoint, b: ScreenPoint) => a.x * b.y - a.y * b.x;

const assertAxisMatchesDerivedDirection = (
  opticsState: DerivedOpticsState,
  scene: SceneDefinition,
  viewId: GeometryView,
) => {
  const view = projectionFor(opticsState, scene).views[viewId];
  expect(view.opticalAxisSegment).not.toBeNull();
  const projectedOrigin = view.projectWorldPoint(opticsState.lensCenterWorld);
  const projectedDirectionPoint = view.projectWorldPoint({
    x: opticsState.lensCenterWorld.x + opticsState.opticalAxis.direction.x * 1000,
    y: opticsState.lensCenterWorld.y + opticsState.opticalAxis.direction.y * 1000,
    z: opticsState.lensCenterWorld.z + opticsState.opticalAxis.direction.z * 1000,
  });
  const expected = {
    x: projectedDirectionPoint.x - projectedOrigin.x,
    y: projectedDirectionPoint.y - projectedOrigin.y,
  };
  const actual = {
    x: view.opticalAxisSegment!.p2.x - view.opticalAxisSegment!.p1.x,
    y: view.opticalAxisSegment!.p2.y - view.opticalAxisSegment!.p1.y,
  };
  expect(Math.abs(cross2d(expected, actual))).toBeLessThan(1e-6);
  return actual;
};

const orientation = (a: ScreenPoint, b: ScreenPoint, c: ScreenPoint) =>
  cross2d({ x: b.x - a.x, y: b.y - a.y }, { x: c.x - a.x, y: c.y - a.y });

const properIntersection = (
  a: ScreenPoint,
  b: ScreenPoint,
  c: ScreenPoint,
  d: ScreenPoint,
) => orientation(a, b, c) * orientation(a, b, d) < 0 && orientation(c, d, a) * orientation(c, d, b) < 0;

const assertValidDofPolygon = (
  opticsState: DerivedOpticsState,
  scene: SceneDefinition,
  viewId: GeometryView,
  lateralWindow?: Parameters<typeof computeOpticalSectionData>[0]["lateralWindow"],
) => {
  const segments = projectionFor(opticsState, scene, lateralWindow).views[viewId].planeSegments;
  const near = segments.find((segment) => segment.id === "nearDof");
  const far = segments.find((segment) => segment.id === "farDof");
  expect(near, `${scene.id} ${viewId} near DOF`).toBeDefined();
  expect(far, `${scene.id} ${viewId} far DOF`).toBeDefined();
  const points = buildDofPolygonPoints(near!, far!);
  points.flatMap((point) => [point.x, point.y]).forEach((coordinate) =>
    expect(Number.isFinite(coordinate)).toBe(true),
  );
  expect(points[0].x).toBeLessThanOrEqual(points[1].x);
  expect(points[3].x).toBeLessThanOrEqual(points[2].x);
  expect(
    properIntersection(points[0], points[1], points[2], points[3]),
    JSON.stringify(points),
  ).toBe(false);
  expect(properIntersection(points[1], points[2], points[3], points[0])).toBe(false);
};

describe("optical section projection", () => {
  it("projects front tilt into the real Side optical-axis slope", () => {
    const zero = deriveOpticsState(cameraFor(tableTiltScene, { frontTiltDeg: 0 }), tableTiltScene);
    const tilted = deriveOpticsState(cameraFor(tableTiltScene, { frontTiltDeg: 7 }), tableTiltScene);
    const zeroDirection = assertAxisMatchesDerivedDirection(zero, tableTiltScene, "side");
    const tiltedDirection = assertAxisMatchesDerivedDirection(tilted, tableTiltScene, "side");
    expect(Math.abs(zeroDirection.y)).toBeLessThan(1e-8);
    expect(Math.abs(tiltedDirection.y)).toBeGreaterThan(1);
  });

  it("projects front swing into the real Top optical-axis slope", () => {
    const zero = deriveOpticsState(cameraFor(architectureRiseScene, { frontSwingDeg: 0 }), architectureRiseScene);
    const swung = deriveOpticsState(cameraFor(architectureRiseScene, { frontSwingDeg: 7 }), architectureRiseScene);
    const zeroDirection = assertAxisMatchesDerivedDirection(zero, architectureRiseScene, "top");
    const swungDirection = assertAxisMatchesDerivedDirection(swung, architectureRiseScene, "top");
    expect(Math.abs(zeroDirection.y)).toBeLessThan(1e-8);
    expect(Math.abs(swungDirection.y)).toBeGreaterThan(1);
  });

  it("builds non-self-crossing DOF regions for both tilt signs and the calibrated state", () => {
    const near = { p1: { x: 20, y: 80 }, p2: { x: 600, y: 120 } };
    const far = { p1: { x: 20, y: 160 }, p2: { x: 600, y: 210 } };
    for (const [nearSegment, farSegment] of [
      [near, far],
      [{ p1: near.p2, p2: near.p1 }, { p1: far.p2, p2: far.p1 }],
    ] as const) {
      const points = buildDofPolygonPoints(nearSegment, farSegment);
      expect(points.map((point) => point.x)).toEqual([20, 600, 600, 20]);
      expect(properIntersection(points[0], points[1], points[2], points[3])).toBe(false);
      expect(properIntersection(points[1], points[2], points[3], points[0])).toBe(false);
    }

    const calibrated = deriveOpticsState(
      cameraFor(tableTiltScene, {
        frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
        focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
      }),
      tableTiltScene,
    );
    assertValidDofPolygon(calibrated, tableTiltScene, "side");
  });

  it("keeps Architecture Rise and Focus Fundamentals DOF regions valid", () => {
    for (const scene of [architectureRiseScene, focusFundamentalsTwoTargets]) {
      const optics = deriveOpticsState(
        { ...DEFAULT_CAMERA_STATE, activeSceneId: scene.id },
        scene,
      );
      assertValidDofPolygon(optics, scene, "side");
      assertValidDofPolygon(optics, scene, "top");
    }
  });

  it("shows the three extended planes meeting at one point in the perpendicular section", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, {
        frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
        focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
      }),
      tableTiltScene,
    );
    const view = projectionFor(optics, tableTiltScene).views.scheimpflug;
    expect(view.scheimpflugIntersection).not.toBeNull();
    const point = view.scheimpflugIntersection!;
    const distanceToSegmentLine = (segment: { p1: ScreenPoint; p2: ScreenPoint }) => {
      const direction = { x: segment.p2.x - segment.p1.x, y: segment.p2.y - segment.p1.y };
      const delta = { x: point.x - segment.p1.x, y: point.y - segment.p1.y };
      return Math.abs(cross2d(direction, delta)) / Math.hypot(direction.x, direction.y);
    };
    for (const id of ["film", "lens", "focus"]) {
      const segment = view.planeSegments.find((candidate) => candidate.id === id);
      expect(segment).toBeDefined();
      expect(distanceToSegmentLine(segment!)).toBeLessThan(1e-6);
    }
  });

  it("matches conventional Side and Top section bases for pure tilt and pure swing", () => {
    const tilted = deriveOpticsState(
      cameraFor(tableTiltScene, { frontTiltDeg: 7, frontSwingDeg: 0 }),
      tableTiltScene,
    );
    const tiltedProjection = projectionFor(tilted, tableTiltScene);
    expect(tiltedProjection.views.scheimpflug.section.depthAxis).toEqual(
      tiltedProjection.views.side.section.depthAxis,
    );
    expect(tiltedProjection.views.scheimpflug.section.lateralAxis.x).toBeCloseTo(0, 12);
    expect(tiltedProjection.views.scheimpflug.section.lateralAxis.y).toBeCloseTo(1, 12);
    expect(tiltedProjection.views.scheimpflug.section.lateralAxis.z).toBeCloseTo(0, 12);

    const swung = deriveOpticsState(
      cameraFor(architectureRiseScene, { frontTiltDeg: 0, frontSwingDeg: 7 }),
      architectureRiseScene,
    );
    const swungProjection = projectionFor(swung, architectureRiseScene);
    expect(swungProjection.views.scheimpflug.section.depthAxis).toEqual(
      swungProjection.views.top.section.depthAxis,
    );
    expect(swungProjection.views.scheimpflug.section.lateralAxis.x).toBeCloseTo(1, 12);
    expect(swungProjection.views.scheimpflug.section.lateralAxis.y).toBeCloseTo(0, 12);
    expect(swungProjection.views.scheimpflug.section.lateralAxis.z).toBeCloseTo(0, 12);
  });

  it("keeps the combined-movement perpendicular basis finite, orthonormal, and stable", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, { frontTiltDeg: 6, frontSwingDeg: 5 }),
      tableTiltScene,
    );
    const first = projectionFor(optics, tableTiltScene).views.scheimpflug.section;
    const second = projectionFor(optics, tableTiltScene).views.scheimpflug.section;
    for (const vector of [first.depthAxis, first.lateralAxis, first.normal]) {
      [vector.x, vector.y, vector.z].forEach((coordinate) =>
        expect(Number.isFinite(coordinate)).toBe(true),
      );
      expect(Math.hypot(vector.x, vector.y, vector.z)).toBeCloseTo(1, 10);
    }
    const dot = (a: typeof first.depthAxis, b: typeof first.depthAxis) =>
      a.x * b.x + a.y * b.y + a.z * b.z;
    expect(Math.abs(dot(first.depthAxis, first.lateralAxis))).toBeLessThan(1e-10);
    expect(Math.abs(dot(first.depthAxis, first.normal))).toBeLessThan(1e-10);
    expect(Math.abs(dot(first.lateralAxis, first.normal))).toBeLessThan(1e-10);
    expect(second.depthAxis).toEqual(first.depthAxis);
    expect(second.lateralAxis).toEqual(first.lateralAxis);
    expect(second.normal).toEqual(first.normal);
  });
});
