import { describe, expect, it } from "vitest";
import {
  buildDofPolygonPoints,
  computeOpticalSectionData,
  normalizedSegmentCrossResidual,
  PROJECTED_COLLINEARITY_TOLERANCE,
  type ScreenPoint,
} from "../../components/geometry/opticalSectionProjection";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
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

const assertPhysicalCameraCollinear = (
  opticsState: DerivedOpticsState,
  scene: SceneDefinition,
  viewId: GeometryView,
) => {
  const view = projectionFor(opticsState, scene).views[viewId];
  for (const id of ["film", "lens"] as const) {
    const physical = view.physicalPlaneSegments.find(
      (segment) => segment.id === `physical-${id}`,
    );
    const trace = view.planeSegments.find((segment) => segment.id === id);
    expect(physical, `${scene.id} ${viewId} physical ${id}`).toBeDefined();
    expect(trace, `${scene.id} ${viewId} ${id} trace`).toBeDefined();
    for (const point of [physical!.p1, physical!.p2, trace!.p1, trace!.p2]) {
      expect(Number.isFinite(point.x)).toBe(true);
      expect(Number.isFinite(point.y)).toBe(true);
    }
    const residual = normalizedSegmentCrossResidual(physical!, trace!);
    expect(Number.isFinite(residual)).toBe(true);
    expect(residual).toBeLessThan(PROJECTED_COLLINEARITY_TOLERANCE);
  }
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

  it("keeps Side physical film/lens segments collinear at zero and signed Tilt", () => {
    for (const frontTiltDeg of [0, 7, -7]) {
      const optics = deriveOpticsState(
        cameraFor(tableTiltScene, { frontTiltDeg }),
        tableTiltScene,
      );
      assertPhysicalCameraCollinear(optics, tableTiltScene, "side");
    }
  });

  it("keeps Top physical film/lens segments collinear at zero and signed Swing", () => {
    for (const frontSwingDeg of [0, 7, -7]) {
      const optics = deriveOpticsState(
        cameraFor(shelfSwingScene, { frontSwingDeg }),
        shelfSwingScene,
      );
      assertPhysicalCameraCollinear(optics, shelfSwingScene, "top");
    }
  });

  it("keeps the calibrated Scheimpflug physical camera collinear and finite", () => {
    const optics = deriveOpticsState(
      cameraFor(tableTiltScene, {
        frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
        focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
      }),
      tableTiltScene,
    );
    assertPhysicalCameraCollinear(optics, tableTiltScene, "scheimpflug");
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

describe("computeOpticalSectionData rear-movement consumer tests", () => {
  const tableTiltDepth = { minMm: -2000, maxMm: 8000 };

  it("rear tilt Side view physical film has non-zero slope and is collinear with trace", () => {
    const cam = cameraFor(tableTiltScene, { frontTiltDeg: 0, rearTiltDeg: 8 });
    const optics = deriveOpticsState(cam, tableTiltScene);
    const data = computeOpticalSectionData({
      opticsState: optics, scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const view = data.views.side;
    const physical = view.physicalPlaneSegments.find((s) => s.id === "physical-film");
    const trace = view.planeSegments.find((s) => s.id === "film");
    expect(physical).toBeDefined();
    expect(trace).toBeDefined();
    expect(Math.abs(physical!.p2.x - physical!.p1.x)).toBeGreaterThan(0);
    const residual = normalizedSegmentCrossResidual(physical!, trace!);
    expect(residual).toBeLessThan(PROJECTED_COLLINEARITY_TOLERANCE);
    const projectedCentre = view.projectWorldPoint(optics.filmCenterWorld);
    const mid = { x: (physical!.p1.x + physical!.p2.x) / 2, y: (physical!.p1.y + physical!.p2.y) / 2 };
    expect(Math.abs(mid.x - projectedCentre.x)).toBeLessThan(2);
    expect(Math.abs(mid.y - projectedCentre.y)).toBeLessThan(2);
  });

  it("negative rear tilt Side view physical film slope changes sign", () => {
    const neg = cameraFor(tableTiltScene, { frontTiltDeg: 0, rearTiltDeg: -8 });
    const pos = cameraFor(tableTiltScene, { frontTiltDeg: 0, rearTiltDeg: 8 });
    const dn = computeOpticalSectionData({
      opticsState: deriveOpticsState(neg, tableTiltScene), scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const dp = computeOpticalSectionData({
      opticsState: deriveOpticsState(pos, tableTiltScene), scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const pn = dn.views.side.physicalPlaneSegments.find((s) => s.id === "physical-film");
    const pp = dp.views.side.physicalPlaneSegments.find((s) => s.id === "physical-film");
    expect(pn).toBeDefined(); expect(pp).toBeDefined();
    const sn = (pn!.p2.y - pn!.p1.y) / (pn!.p2.x - pn!.p1.x || 1);
    const sp = (pp!.p2.y - pp!.p1.y) / (pp!.p2.x - pp!.p1.x || 1);
    expect(sn * sp).toBeLessThan(0);
  });

  it("rear tilt Top view remains consistent with right axis", () => {
    const cam = cameraFor(tableTiltScene, { rearTiltDeg: 8 });
    const optics = deriveOpticsState(cam, tableTiltScene);
    const data = computeOpticalSectionData({
      opticsState: optics, scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const physical = data.views.top.physicalPlaneSegments.find((s) => s.id === "physical-film");
    const trace = data.views.top.planeSegments.find((s) => s.id === "film");
    expect(physical).toBeDefined(); expect(trace).toBeDefined();
    const residual = normalizedSegmentCrossResidual(physical!, trace!);
    expect(residual).toBeLessThan(PROJECTED_COLLINEARITY_TOLERANCE);
  });

  it("matching front/rear tilt Side has parallel lens and film traces", () => {
    const cam = cameraFor(tableTiltScene, { frontTiltDeg: 5, rearTiltDeg: 5 });
    const optics = deriveOpticsState(cam, tableTiltScene);
    const data = computeOpticalSectionData({
      opticsState: optics, scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const filmTrace = data.views.side.planeSegments.find((s) => s.id === "film");
    const lensTrace = data.views.side.planeSegments.find((s) => s.id === "lens");
    expect(filmTrace).toBeDefined(); expect(lensTrace).toBeDefined();
    expect(normalizedSegmentCrossResidual(filmTrace!, lensTrace!)).toBeLessThan(PROJECTED_COLLINEARITY_TOLERANCE);
    expect(data.views.side.scheimpflugIntersection).toBeNull();
    const phys = data.views.side.physicalPlaneSegments.find((s) => s.id === "physical-film");
    expect(phys).toBeDefined();
    expect(normalizedSegmentCrossResidual(phys!, filmTrace!)).toBeLessThan(PROJECTED_COLLINEARITY_TOLERANCE);
  });

  it("FOV rays are collinear with lens and distinct film endpoints", () => {
    const cam = cameraFor(tableTiltScene, { frontTiltDeg: 0, rearTiltDeg: 8 });
    const optics = deriveOpticsState(cam, tableTiltScene);
    const data = computeOpticalSectionData({
      opticsState: optics, scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const view = data.views.side;
    const lensScreen = view.projectWorldPoint(optics.lensCenterWorld);
    const physical = view.physicalPlaneSegments.find((s) => s.id === "physical-film");
    expect(physical).toBeDefined();

    // 2D cross-product: |(p2-p1) × (q-p1)| / |p2-p1|
    const cross2d_residual = (a: ScreenPoint, b: ScreenPoint, p: ScreenPoint) => {
      const abx = b.x - a.x, aby = b.y - a.y;
      const apx = p.x - a.x, apy = p.y - a.y;
      return Math.abs(abx * apy - aby * apx) / Math.hypot(abx, aby) || 0;
    };

    const fovSegments = view.fovSegments;
    expect(fovSegments.length).toBeGreaterThanOrEqual(2);

    // Each FOV segment should be collinear with the lens centre
    for (const seg of fovSegments) {
      expect(cross2d_residual(seg.p1, seg.p2, lensScreen)).toBeLessThan(1.5);
    }

    // Map each physical endpoint to its nearest FOV segment
    const physEndpoints = [physical!.p1, physical!.p2];
    const matchedEndpoints = new Set<number>();
    for (const seg of fovSegments) {
      let bestIdx = -1, bestDist = Infinity;
      for (let i = 0; i < 2; i++) {
        const d = cross2d_residual(seg.p1, seg.p2, physEndpoints[i]);
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      expect(bestIdx).not.toBe(-1);
      expect(bestDist).toBeLessThan(1.5);
      matchedEndpoints.add(bestIdx);
    }
    // Both physical endpoints should be matched by different rays
    expect(matchedEndpoints.size).toBe(2);

    // Ray direction vectors differ
    expect(fovSegments.length).toBe(2);
    const d0x = fovSegments[0].p2.x - fovSegments[0].p1.x;
    const d0y = fovSegments[0].p2.y - fovSegments[0].p1.y;
    const d1x = fovSegments[1].p2.x - fovSegments[1].p1.x;
    const d1y = fovSegments[1].p2.y - fovSegments[1].p1.y;
    expect(Math.abs(d0x * d1y - d0y * d1x)).toBeGreaterThan(1e-6);
  });

  it("signed positive/negative rear tilt produce mirrored FOV rays via actual segments", () => {
    const computeState = (tilt: number) => {
      const cam = cameraFor(tableTiltScene, { frontTiltDeg: 0, rearTiltDeg: tilt });
      const optics = deriveOpticsState(cam, tableTiltScene);
      const data = computeOpticalSectionData({
        opticsState: optics, scene: tableTiltScene,
        svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
      });
      return { view: data.views.side, optics, cam };
    };

    const cross2d_resid = (a: ScreenPoint, b: ScreenPoint, p: ScreenPoint) => {
      const abx = b.x - a.x, aby = b.y - a.y;
      const apx = p.x - a.x, apy = p.y - a.y;
      return Math.abs(abx * apy - aby * apx) / Math.hypot(abx, aby) || 0;
    };

    const getActualFovAngles = (tilt: number) => {
      const { view, optics } = computeState(tilt);
      const lens = view.projectWorldPoint(optics.lensCenterWorld);
      const physical = view.physicalPlaneSegments.find((s) => s.id === "physical-film")!;
      const fovs = [...view.fovSegments];

      expect(fovs).toHaveLength(2);

      // Each FOV segment must be collinear with the lens centre
      for (const seg of fovs) {
        expect(cross2d_resid(seg.p1, seg.p2, lens)).toBeLessThan(1.5);
      }

      // Pair each FOV segment to one distinct physical endpoint
      const paired: { segment: typeof fovs[0]; endpointIndex: number; angle: number }[] = [];
      const usedEndpoints = new Set<number>();
      const physEndpoints = [physical.p1, physical.p2];

      for (const seg of fovs) {
        let bestIdx = -1, bestDist = Infinity;
        for (let i = 0; i < 2; i++) {
          if (usedEndpoints.has(i)) continue;
          const d = cross2d_resid(seg.p1, seg.p2, physEndpoints[i]);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        expect(bestIdx).not.toBe(-1);
        expect(bestDist).toBeLessThan(1.5);
        usedEndpoints.add(bestIdx);

        // Angle from the FOV segment direction
        const dx = seg.p2.x - seg.p1.x;
        const dy = seg.p2.y - seg.p1.y;
        paired.push({ segment: seg, endpointIndex: bestIdx, angle: Math.atan2(dy, dx) });
      }

      // Both endpoints must be paired exactly once
      expect(usedEndpoints.size).toBe(2);

      return paired.sort((a, b) => physEndpoints[a.endpointIndex].y - physEndpoints[b.endpointIndex].y);
    };

    const zeroAngles = getActualFovAngles(0);
    const posAngles = getActualFovAngles(8);
    const negAngles = getActualFovAngles(-8);

    expect(posAngles.length).toBe(2);
    expect(negAngles.length).toBe(2);

    // Opposite-signed tilts produce opposite angular deltas
    const posDeltas = [posAngles[0].angle - zeroAngles[0].angle, posAngles[1].angle - zeroAngles[1].angle];
    const negDeltas = [negAngles[0].angle - zeroAngles[0].angle, negAngles[1].angle - zeroAngles[1].angle];

    expect(posDeltas[0] * negDeltas[0]).toBeLessThan(0);
    expect(posDeltas[1] * negDeltas[1]).toBeLessThan(0);

    // Magnitudes approximately symmetric
    expect(Math.abs(posDeltas[0] + negDeltas[0])).toBeLessThan(0.01);
    expect(Math.abs(posDeltas[1] + negDeltas[1])).toBeLessThan(0.01);

    // FOV direction vectors from positive vs negative are not identical
    const posVec = [
      posAngles[0].segment.p2.x - posAngles[0].segment.p1.x,
      posAngles[0].segment.p2.y - posAngles[0].segment.p1.y,
    ];
    const negVec = [
      negAngles[0].segment.p2.x - negAngles[0].segment.p1.x,
      negAngles[0].segment.p2.y - negAngles[0].segment.p1.y,
    ];
    expect(Math.abs(posVec[0] - negVec[0]) + Math.abs(posVec[1] - negVec[1])).toBeGreaterThan(1e-6);
  });

  it("Scheimpflug view physical-film remains on canonical film plane", () => {
    const cam = cameraFor(tableTiltScene, {
      frontTiltDeg: tableTiltGeometry.tableTiltCalibration.frontTiltDeg,
      focusDistanceMm: tableTiltGeometry.tableTiltCalibration.focusDistanceMm,
    });
    const optics = deriveOpticsState(cam, tableTiltScene);
    const data = computeOpticalSectionData({
      opticsState: optics, scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const phys = data.views.scheimpflug.physicalPlaneSegments.find((s) => s.id === "physical-film");
    const trace = data.views.scheimpflug.planeSegments.find((s) => s.id === "film");
    expect(phys).toBeDefined(); expect(trace).toBeDefined();
    expect(normalizedSegmentCrossResidual(phys!, trace!)).toBeLessThan(PROJECTED_COLLINEARITY_TOLERANCE);
  });
});



describe("infinity movement 2D geometry", () => {
  const tableTiltDepth = { minMm: -2000, maxMm: 8000 };

  it("infinity front rise moves lens centre in Side view", () => {
    const cam = cameraFor(tableTiltScene, { focusMode: "infinity", frontRiseMm: 30 });
    const optics = deriveOpticsState(cam, tableTiltScene);
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    // In the Side YZ section, world +Y is the lateral axis (up along screen),
    // so a front rise changes the lateral coordinate.
    const zeroCam = cameraFor(tableTiltScene, { focusMode: "infinity" });
    expect(optics.lensCenterWorld.y).toBeCloseTo(30, 8);
    const zeroOptics = deriveOpticsState(zeroCam, tableTiltScene);
    expect(zeroOptics.lensCenterWorld.y).toBeCloseTo(0, 8);
    // The lens Z position remains the focal length
    expect(optics.lensCenterWorld.z).toBeGreaterThan(0);
  });

  it("infinity front tilt rotates Side lens trace", () => {
    const cam = cameraFor(tableTiltScene, { focusMode: "infinity", frontTiltDeg: 5 });
    const optics = deriveOpticsState(cam, tableTiltScene);
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    // Lens normal is no longer world-Z
    expect(Math.abs(optics.lensNormalWorld.z - 1)).toBeGreaterThan(1e-6);
    // focusPlane remains null in infinity
    expect(optics.focusPlane).toBeNull();
    expect(optics.depthOfFieldFarPlane).toBeNull();
    // Non-parallel relationship
    expect(optics.diagnostics.isParallelLensFilm).toBe(false);
    expect(optics.lensFilmHingeLine).not.toBeNull();
  });

  it("infinity front swing rotates Top lens trace", () => {
    const cam = cameraFor(tableTiltScene, { focusMode: "infinity", frontSwingDeg: 5 });
    const optics = deriveOpticsState(cam, tableTiltScene);
    expect(optics.diagnostics.fallbackApplied).toBe(false);
    const data = computeOpticalSectionData({
      opticsState: optics, scene: tableTiltScene,
      svgWidth: WIDTH, svgHeight: HEIGHT, depthWindow: tableTiltDepth,
    });
    const lensTrace = data.views.top.planeSegments.find((s) => s.id === "lens");
    expect(lensTrace).toBeDefined();
    expect(Math.abs(lensTrace!.p2.y - lensTrace!.p1.y)).toBeGreaterThan(0.5);
  });
});

});
