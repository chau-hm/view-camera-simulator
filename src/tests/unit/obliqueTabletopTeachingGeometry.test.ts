import { cleanup, render } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { GeometryViewport } from "../../components/simulator/GeometryViewport";
import {
  deriveObliqueTabletopTeachingGeometry,
  getObliqueTabletopGeometryViewCopyKey,
  getObliqueTabletopTeachingFeedbackKey,
  getObliqueTabletopTeachingState,
} from "../../components/geometry/obliqueTabletopTeachingGeometry";
import { getGeometryPresentationProfile } from "../../components/geometry/geometryPresentationProfiles";
import {
  computeOpticalSectionData,
  normalizedSegmentCrossResidual,
  type PlaneSegment,
} from "../../components/geometry/opticalSectionProjection";
import { getSceneGeometryGuides } from "../../components/geometry/sceneGeometryGuides";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { deriveScheimpflugConstruction } from "../../core/optics/scheimpflugConstruction";
import { simulatorMessageKeys } from "../../i18n/simulatorMessageKeys";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import obliqueTabletopGeometry from "../../scenes/obliqueTabletopGeometry";
import type { CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraFor = (overrides: Partial<CameraState> = {}): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...obliqueTabletopScene.cameraPreset,
  activeSceneId: obliqueTabletopScene.id,
  activeTaskId: null,
  mode: "free",
  ...overrides,
});

const opticsFor = (overrides: Partial<CameraState> = {}) =>
  deriveOpticsState(cameraFor(overrides), obliqueTabletopScene);

const projectionFor = (opticsState: ReturnType<typeof opticsFor>) => {
  const profile = getGeometryPresentationProfile(obliqueTabletopScene);
  if (profile.depthWindow.mode !== "fixed") {
    throw new Error("Oblique Tabletop requires a fixed teaching depth window");
  }
  return computeOpticalSectionData({
    opticsState,
    scene: obliqueTabletopScene,
    svgWidth: 900,
    svgHeight: 520,
    depthWindow: profile.depthWindow,
    lateralWindow: profile.lateralWindow,
    paddingPx: profile.diagramPaddingPx,
  });
};

const guideSegment = (
  view: "side" | "top",
  projection: ReturnType<typeof projectionFor>,
): PlaneSegment => {
  const guide = getSceneGeometryGuides(obliqueTabletopScene.id).find(
    (candidate) => candidate.view === view,
  );
  if (!guide) throw new Error(`Missing Oblique Tabletop ${view} guide`);
  return {
    id: guide.id,
    color: guide.color,
    p1: projection.views[view].projectWorldPoint(guide.startWorld),
    p2: projection.views[view].projectWorldPoint(guide.endWorld),
  };
};

const focusSegment = (
  view: "side" | "top",
  projection: ReturnType<typeof projectionFor>,
): PlaneSegment => {
  const segment = projection.views[view].planeSegments.find(({ id }) => id === "focus");
  if (!segment) throw new Error(`Missing Oblique Tabletop ${view} focus segment`);
  return segment;
};

const signedDistance = (
  point: { x: number; y: number; z: number },
  plane: { point: { x: number; y: number; z: number }; normal: { x: number; y: number; z: number } },
) =>
  (point.x - plane.point.x) * plane.normal.x +
  (point.y - plane.point.y) * plane.normal.y +
  (point.z - plane.point.z) * plane.normal.z;

describe("Oblique Tabletop compound teaching geometry", () => {
  afterEach(() => cleanup());

  it("derives the canonical tabletop and one live focus plane for every view", () => {
    for (const overrides of [
      { frontTiltDeg: 0, frontSwingDeg: 0, focusDistanceMm: obliqueTabletopScene.cameraPreset.focusDistanceMm },
      { frontTiltDeg: -4.9, frontSwingDeg: 0, focusDistanceMm: 3310 },
      { frontTiltDeg: -8, frontSwingDeg: -1.7, focusDistanceMm: 2450 },
    ]) {
      const optics = opticsFor(overrides);
      const teaching = deriveObliqueTabletopTeachingGeometry(optics);
      expect(teaching.subjectPlane).toBe(obliqueTabletopGeometry.tabletopTopSurfacePlane);
      expect(teaching.filmPlane).toBe(optics.filmPlane);
      expect(teaching.lensPlane).toBe(optics.lensPlane);
      expect(teaching.focusPlane).toBe(optics.focusPlane);
      expect(teaching.opticalAxis).toBe(optics.opticalAxis);
      expect(teaching.scheimpflugConstruction).toEqual(
        deriveScheimpflugConstruction({
          filmPlane: optics.filmPlane,
          lensPlane: optics.lensPlane,
          focusPlane: optics.focusPlane,
        }),
      );

      const projection = projectionFor(optics);
      for (const view of ["side", "top", "scheimpflug"] as const) {
        expect(projection.views[view].planeSegments.find(({ id }) => id === "focus")).toBeDefined();
      }
    }
  });

  it("registers side and top traces from the same canonical tabletop plane", () => {
    const guides = getSceneGeometryGuides(obliqueTabletopScene.id);
    expect(guides).toHaveLength(2);
    expect(guides.map(({ teachingComponent }) => teachingComponent)).toEqual([
      "near-far",
      "left-right",
    ]);
    guides.forEach((guide) => {
      expect(guide.sourcePlaneId).toBe("tabletopTopSurfacePlane");
      expect(signedDistance(guide.startWorld, obliqueTabletopGeometry.tabletopTopSurfacePlane)).toBeCloseTo(0, 9);
      expect(signedDistance(guide.endWorld, obliqueTabletopGeometry.tabletopTopSurfacePlane)).toBeCloseTo(0, 9);
    });
    expect(guides[0].startWorld).toEqual(
      obliqueTabletopGeometry.tabletopExtents.near.topSurfaceCenterWorld,
    );
    expect(guides[0].endWorld).toEqual(
      obliqueTabletopGeometry.tabletopExtents.far.topSurfaceCenterWorld,
    );
    expect(guides[1].startWorld).toEqual(
      obliqueTabletopGeometry.tabletopExtents.left.topSurfaceCenterWorld,
    );
    expect(guides[1].endWorld).toEqual(
      obliqueTabletopGeometry.tabletopExtents.right.topSurfaceCenterWorld,
    );
  });

  it("makes the Side trace expose the near-to-far Tilt component", () => {
    const neutral = projectionFor(opticsFor({ frontTiltDeg: 0, frontSwingDeg: 0 }));
    const tiltOnly = projectionFor(opticsFor({ frontTiltDeg: -4.9, frontSwingDeg: 0, focusDistanceMm: 3310 }));
    const neutralResidual = normalizedSegmentCrossResidual(
      guideSegment("side", neutral),
      focusSegment("side", neutral),
    );
    const tiltResidual = normalizedSegmentCrossResidual(
      guideSegment("side", tiltOnly),
      focusSegment("side", tiltOnly),
    );

    expect(neutralResidual).toBeGreaterThan(0.01);
    expect(tiltResidual).toBeLessThan(neutralResidual * 0.4);
    expect(tiltResidual).toBeGreaterThan(0);
  });

  it("makes the Top trace expose the remaining Swing contribution", () => {
    const tiltOnly = projectionFor(
      opticsFor({ frontTiltDeg: -4.9, frontSwingDeg: 0, focusDistanceMm: 3310 }),
    );
    const compound = projectionFor(
      opticsFor({ frontTiltDeg: -8, frontSwingDeg: -1.7, focusDistanceMm: 2450 }),
    );
    const tiltResidual = normalizedSegmentCrossResidual(
      guideSegment("top", tiltOnly),
      focusSegment("top", tiltOnly),
    );
    const compoundResidual = normalizedSegmentCrossResidual(
      guideSegment("top", compound),
      focusSegment("top", compound),
    );

    expect(tiltResidual).toBeGreaterThan(0.005);
    expect(compoundResidual).toBeLessThan(tiltResidual * 0.2);
  });

  it("publishes live explanatory view and state copy without creating separate focus planes", () => {
    expect(getObliqueTabletopGeometryViewCopyKey("side")).toBe(
      simulatorMessageKeys.geometry.obliqueTabletopSideView,
    );
    expect(getObliqueTabletopGeometryViewCopyKey("top")).toBe(
      simulatorMessageKeys.geometry.obliqueTabletopTopView,
    );
    expect(getObliqueTabletopGeometryViewCopyKey("scheimpflug")).toBe(
      simulatorMessageKeys.geometry.obliqueTabletopScheimpflugView,
    );
    expect(getObliqueTabletopTeachingState({ tiltDeg: 0, swingDeg: 0 })).toBe("neutral");
    expect(getObliqueTabletopTeachingState({ tiltDeg: -4.9, swingDeg: 0 })).toBe("tilt");
    expect(getObliqueTabletopTeachingState({ tiltDeg: 0, swingDeg: -1.7 })).toBe("swing");
    expect(getObliqueTabletopTeachingState({ tiltDeg: -8, swingDeg: -1.7 })).toBe("compound");
    expect(getObliqueTabletopTeachingFeedbackKey("compound")).toBe(
      simulatorMessageKeys.geometry.obliqueTabletopCompoundFeedback,
    );

    const optics = opticsFor({ frontTiltDeg: -8, frontSwingDeg: -1.7, focusDistanceMm: 2450 });
    const { container } = render(
      createElement(GeometryViewport, {
        opticsState: optics,
        geometryView: "top",
        onGeometryViewChange: () => undefined,
        focalLengthMm: DEFAULT_CAMERA_STATE.focalLengthMm,
        scene: obliqueTabletopScene,
        riseMm: 0,
      }),
    );
    const svg = container.querySelector('[data-testid="geometry-svg-top"]');
    expect(svg).toHaveAttribute("data-teaching-geometry", "oblique-tabletop");
    expect(svg).toHaveAttribute("data-teaching-subject-plane-source", "tabletopTopSurfacePlane");
    expect(svg).toHaveAttribute("data-teaching-focus-plane-source", "DerivedOpticsState.focusPlane");
    expect(svg).toHaveAttribute("data-teaching-focus-plane-present", "true");
    expect(container.querySelector('[data-testid="oblique-tabletop-left-right-plane"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="oblique-tabletop-teaching-feedback"]')?.textContent).toContain(
      "Tilt and Swing",
    );
  });
});
