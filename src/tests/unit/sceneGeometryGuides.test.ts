import { describe, expect, it } from "vitest";
import {
  getSceneGeometryGuides,
  getSceneGeometryTargetLabel,
} from "../../components/geometry/sceneGeometryGuides";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";
import {
  computeOpticalSectionData,
  normalizedSegmentCrossResidual,
  PROJECTED_COLLINEARITY_TOLERANCE,
  type PlaneSegment,
} from "../../components/geometry/opticalSectionProjection";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const createProjection = (frontSwingDeg: number, focusDistanceMm: number) => {
  const opticsState = deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...shelfSwingScene.cameraPreset,
      activeSceneId: shelfSwingScene.id,
      frontSwingDeg,
      focusDistanceMm,
    },
    shelfSwingScene,
  );
  const profile = getGeometryPresentationProfile(shelfSwingScene);
  if (profile.depthWindow.mode !== "fixed") throw new Error("Expected fixed Shelf Swing depth window");
  return computeOpticalSectionData({
    opticsState,
    scene: shelfSwingScene,
    svgWidth: 900,
    svgHeight: 520,
    depthWindow: {
      minMm: profile.depthWindow.minMm,
      maxMm: profile.depthWindow.maxMm,
    },
    lateralWindow: profile.lateralWindow,
    paddingPx: profile.diagramPaddingPx,
  });
};

const projectedSubjectTrace = (projection: ReturnType<typeof createProjection>): PlaneSegment => ({
  id: "subject-trace",
  color: "#115e59",
  p1: projection.views.top.projectWorldPoint(
    shelfSwingGeometry.frontSubject.focusDetailProbeWorld,
  ),
  p2: projection.views.top.projectWorldPoint(
    shelfSwingGeometry.backSubject.focusDetailProbeWorld,
  ),
});

const normalizedPointCrossResidual = (
  segment: Pick<PlaneSegment, "p1" | "p2">,
  point: { x: number; y: number },
): number => {
  const direction = { x: segment.p2.x - segment.p1.x, y: segment.p2.y - segment.p1.y };
  const offset = { x: point.x - segment.p1.x, y: point.y - segment.p1.y };
  return Math.abs(direction.x * offset.y - direction.y * offset.x) /
    (Math.hypot(direction.x, direction.y) * Math.max(Math.hypot(offset.x, offset.y), 1));
};

describe("scene geometry guides", () => {
  it("registers one canonical Top-view Shelf Swing subject trace", () => {
    const guides = getSceneGeometryGuides("shelf-swing");
    expect(guides).toHaveLength(1);
    expect(guides[0]).toMatchObject({
      id: "shelf-swing-subject-trace",
      label: "Diagonal subject plane",
      view: "top",
      testId: "shelf-swing-subject-trace",
    });
    expect(guides[0].startWorld).toEqual(
      shelfSwingGeometry.frontSubject.focusDetailProbeWorld,
    );
    expect(guides[0].endWorld).toEqual(
      shelfSwingGeometry.backSubject.focusDetailProbeWorld,
    );
    expect(getSceneGeometryGuides("unknown-scene")).toEqual([]);
  });

  it("uses explicit scene target labels while preserving generic fallbacks", () => {
    expect(getSceneGeometryTargetLabel("shelf-swing", "shelf-front")).toBe("Front chart");
    expect(getSceneGeometryTargetLabel("shelf-swing", "shelf-middle")).toBe("Middle chart");
    expect(getSceneGeometryTargetLabel("shelf-swing", "shelf-back")).toBe("Back chart");
    expect(getSceneGeometryTargetLabel("table-tilt", "near-cup")).toBe("Near card");
    expect(getSceneGeometryTargetLabel("table-tilt", "mid-notebook")).toBe(
      "Middle notebook",
    );
    expect(getSceneGeometryTargetLabel("table-tilt", "far-book")).toBe("Far chart");
    expect(getSceneGeometryTargetLabel("another-scene", "near-one")).toBe("Near board");
    expect(getSceneGeometryTargetLabel("another-scene", "far-one")).toBe("Far board");
    expect(getSceneGeometryTargetLabel("another-scene", "centre")).toBe("Target");
  });

  it("selects a dedicated Top-view-compatible Shelf Swing presentation profile", () => {
    const profile = getGeometryPresentationProfile(shelfSwingScene);
    expect(profile.depthWindow).toEqual({ mode: "fixed", minMm: -250, maxMm: 6100 });
    expect(profile.lateralWindow?.top).toEqual({ minMm: -1500, maxMm: 1500 });
    expect(profile.diagramPaddingPx).toBe(36);
    expect(profile.dofFillOpacity).toBe(0.08);
    expect(profile.showTabletopGuide).toBe(false);
  });

  it("projects the calibrated focus plane collinearly with every canonical chart centre", () => {
    const projection = createProjection(
      shelfSwingGeometry.shelfSwingCalibration.frontSwingDeg,
      shelfSwingGeometry.shelfSwingCalibration.focusDistanceMm,
    );
    const subjectTrace = projectedSubjectTrace(projection);
    const focusPlane = projection.views.top.planeSegments.find((segment) => segment.id === "focus");
    expect(focusPlane).toBeDefined();
    expect(normalizedSegmentCrossResidual(subjectTrace, focusPlane!)).toBeLessThan(
      PROJECTED_COLLINEARITY_TOLERANCE,
    );
    shelfSwingGeometry.subjects.forEach((subject) => {
      expect(
        normalizedPointCrossResidual(
          subjectTrace,
          projection.views.top.projectWorldPoint(subject.focusDetailProbeWorld),
        ),
      ).toBeLessThan(PROJECTED_COLLINEARITY_TOLERANCE);
    });
  });

  it.each([0, Math.abs(shelfSwingGeometry.shelfSwingCalibration.frontSwingDeg)])(
    "keeps the focus plane visibly distinct from the subject trace at swing %s",
    (frontSwingDeg) => {
      const projection = createProjection(
        frontSwingDeg,
        shelfSwingGeometry.shelfSwingCalibration.focusDistanceMm,
      );
      const subjectTrace = projectedSubjectTrace(projection);
      const focusPlane = projection.views.top.planeSegments.find((segment) => segment.id === "focus");
      expect(focusPlane).toBeDefined();
      expect(normalizedSegmentCrossResidual(subjectTrace, focusPlane!)).toBeGreaterThan(0.01);
      [...Object.values(subjectTrace.p1), ...Object.values(subjectTrace.p2)].forEach((coordinate) =>
        expect(Number.isFinite(coordinate)).toBe(true),
      );
    },
  );
});
