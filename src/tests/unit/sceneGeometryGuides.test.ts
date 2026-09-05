import { describe, expect, it } from "vitest";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import {
  getSceneGeometryGuides,
  getSceneGeometryTargetMessageKey,
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
import { obliqueArchitectureScene } from "../../scenes/definitions/oblique-architecture";
import shelfSwingGeometry from "../../scenes/shelfSwingGeometry";
import obliqueArchitectureGeometry from "../../scenes/obliqueArchitectureGeometry";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
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
      labelPositionT: 0.72,
      labelOffsetPx: { x: 0, y: -20 },
      labelAnchor: "middle",
    });
    expect(guides[0].startWorld).toEqual(
      shelfSwingGeometry.frontSubject.focusDetailProbeWorld,
    );
    expect(guides[0].endWorld).toEqual(
      shelfSwingGeometry.backSubject.focusDetailProbeWorld,
    );
    expect(getSceneGeometryGuides("unknown-scene")).toEqual([]);
    expect(getSceneGeometryGuides("table-tilt")[0]).toMatchObject({
      labelPositionT: 1,
      labelOffsetPx: { x: -4, y: 18 },
      labelAnchor: "end",
    });
  });

  it.each([
    ["table-tilt", "table-tilt-tabletop", simulatorMessageKeys.geometry.tabletopGuide],
    ["shelf-swing", "shelf-swing-subject-trace", simulatorMessageKeys.geometry.diagonalSubjectPlaneGuide],
    ["oblique-architecture", "oblique-architecture-target-facade", simulatorMessageKeys.geometry.targetFacadeDepthGuide],
    ["architecture-foreground", "architecture-foreground-ground", simulatorMessageKeys.geometry.architectureForegroundGroundGuide],
    ["architecture-foreground", "architecture-foreground-building-profile", simulatorMessageKeys.geometry.architectureForegroundBuildingGuide],
    ["interior-corner", "interior-corner-receding-wall", simulatorMessageKeys.geometry.interiorCornerRecedingWallGuide],
  ] as const)("keeps the canonical message key for %s/%s", (sceneId, guideId, expectedKey) => {
    const guide = getSceneGeometryGuides(sceneId).find(({ id }) => id === guideId);
    expect(guide).toMatchObject({ id: guideId, labelMessageKey: expectedKey });
  });

  it.each([
    ["table-tilt", "near-cup", simulatorMessageKeys.geometry.nearCardTarget],
    ["table-tilt", "mid-notebook", simulatorMessageKeys.geometry.middleNotebookTarget],
    ["table-tilt", "far-book", simulatorMessageKeys.geometry.farChartTarget],
    ["shelf-swing", "shelf-front", simulatorMessageKeys.geometry.frontChartTarget],
    ["shelf-swing", "shelf-middle", simulatorMessageKeys.geometry.middleChartTarget],
    ["shelf-swing", "shelf-back", simulatorMessageKeys.geometry.backChartTarget],
    ["focus-fundamentals-two-targets", "focus-near-detail", simulatorMessageKeys.geometry.nearDetailTarget],
    ["focus-fundamentals-two-targets", "focus-far-detail", simulatorMessageKeys.geometry.farDetailTarget],
    ["oblique-architecture", "facade-near", simulatorMessageKeys.geometry.nearFacadeTarget],
    ["oblique-architecture", "facade-middle", simulatorMessageKeys.geometry.middleFacadeTarget],
    ["oblique-architecture", "facade-far", simulatorMessageKeys.geometry.farFacadeTarget],
    ["architecture-foreground", "foreground-near", simulatorMessageKeys.geometry.architectureForegroundNearTarget],
    ["architecture-foreground", "foreground-middle", simulatorMessageKeys.geometry.architectureForegroundMiddleTarget],
    ["architecture-foreground", "building-base", simulatorMessageKeys.geometry.architectureForegroundBuildingBaseTarget],
    ["architecture-foreground", "building-middle", simulatorMessageKeys.geometry.architectureForegroundBuildingMiddleTarget],
    ["interior-corner", "interior-wall-near", simulatorMessageKeys.geometry.interiorCornerNearWallTarget],
    ["interior-corner", "interior-wall-middle", simulatorMessageKeys.geometry.interiorCornerMiddleWallTarget],
    ["interior-corner", "interior-wall-far", simulatorMessageKeys.geometry.interiorCornerFarWallTarget],
  ] as const)("resolves the canonical target message key for %s/%s", (sceneId, targetId, expectedKey) => {
    expect(getSceneGeometryTargetMessageKey(sceneId, targetId)).toBe(expectedKey);
  });

  it.each([
    ["near-one", simulatorMessageKeys.geometry.nearDetailTarget],
    ["far-one", simulatorMessageKeys.geometry.farDetailTarget],
    ["centre", simulatorMessageKeys.geometry.targetFallback],
  ] as const)("resolves the %s target fallback", (targetId, expectedKey) => {
    expect(getSceneGeometryTargetMessageKey("another-scene", targetId)).toBe(expectedKey);
  });

  it("registers the canonical Oblique Architecture façade depth guide", () => {
    const guides = getSceneGeometryGuides(obliqueArchitectureScene.id);
    expect(guides).toHaveLength(1);
    expect(guides[0]).toMatchObject({
      id: "oblique-architecture-target-facade",
      label: "Target façade depth",
      view: "top",
      testId: "oblique-architecture-target-facade",
    });
    expect(guides[0].startWorld).toEqual(obliqueArchitectureGeometry.focusTargets[0].worldPosition);
    expect(guides[0].endWorld).toEqual(obliqueArchitectureGeometry.focusTargets[2].worldPosition);
  });

  it("registers Oblique Tabletop side and top traces from the canonical subject-board plane", () => {
    const guides = getSceneGeometryGuides("oblique-tabletop");
    expect(guides).toHaveLength(2);
    expect(guides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "oblique-tabletop-near-far-plane",
          view: "side",
          sourcePlaneId: "subjectBoardPlane",
          teachingComponent: "near-far",
          labelMessageKey: simulatorMessageKeys.geometry.obliqueTabletopNearFarGuide,
        }),
        expect.objectContaining({
          id: "oblique-tabletop-left-right-plane",
          view: "top",
          sourcePlaneId: "subjectBoardPlane",
          teachingComponent: "left-right",
          labelMessageKey: simulatorMessageKeys.geometry.obliqueTabletopLeftRightGuide,
        }),
      ]),
    );
    expect(guides[0].startWorld).toEqual(
      obliqueTabletopGeometry.subjectBoardExtents.near.surfaceCenterWorld,
    );
    expect(guides[0].endWorld).toEqual(
      obliqueTabletopGeometry.subjectBoardExtents.far.surfaceCenterWorld,
    );
    expect(guides[1].startWorld).toEqual(
      obliqueTabletopGeometry.subjectBoardExtents.left.surfaceCenterWorld,
    );
    expect(guides[1].endWorld).toEqual(
      obliqueTabletopGeometry.subjectBoardExtents.right.surfaceCenterWorld,
    );
  });

  it("selects a dedicated Top-view-compatible Shelf Swing presentation profile", () => {
    const profile = getGeometryPresentationProfile(shelfSwingScene);
    expect(profile.depthWindow).toEqual({ mode: "fixed", minMm: -250, maxMm: 6100 });
    expect(profile.lateralWindow?.top).toEqual({ minMm: -1500, maxMm: 1500 });
    expect(profile.diagramPaddingPx).toBe(36);
    expect(profile.dofFillOpacity).toBe(0.08);
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
