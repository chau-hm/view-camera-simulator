import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { createTableTiltGroup, disposeTableTiltGroup } from "../../render/TableTiltSubjectFactory";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { projectSceneFocusTargetsToGroundGlass } from "../../render/groundGlassTargetProjection";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import geometry, {
  getFloorWorldCorners,
  getSubjectWorldBoundsCorners,
  getTabletopWorldCorners,
  tabletopLocalToWorld,
  type TableTiltVec3,
} from "../../scenes/tableTiltGeometry";
import { toWorld } from "../../render/rttUtils";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const TOLERANCE = 1e-7;

const distance = (a: TableTiltVec3, b: TableTiltVec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

const signedDistanceToTabletop = (point: TableTiltVec3) => {
  const plane = geometry.tabletopTopSurfacePlane;
  return (
    (point.x - plane.point.x) * plane.normal.x +
    (point.y - plane.point.y) * plane.normal.y +
    (point.z - plane.point.z) * plane.normal.z
  );
};

const expectPointInsideBounds = (point: TableTiltVec3) => {
  expect(point.x).toBeGreaterThanOrEqual(geometry.sceneBounds.min.x - TOLERANCE);
  expect(point.x).toBeLessThanOrEqual(geometry.sceneBounds.max.x + TOLERANCE);
  expect(point.y).toBeGreaterThanOrEqual(geometry.sceneBounds.min.y - TOLERANCE);
  expect(point.y).toBeLessThanOrEqual(geometry.sceneBounds.max.y + TOLERANCE);
  expect(point.z).toBeGreaterThanOrEqual(geometry.sceneBounds.min.z - TOLERANCE);
  expect(point.z).toBeLessThanOrEqual(geometry.sceneBounds.max.z + TOLERANCE);
};

describe("canonical Table Tilt geometry", () => {
  it("aligns scene focus targets with their semantic subject anchors", () => {
    expect(tableTiltScene.focusTargets.map((target) => target.id)).toEqual([
      "near-cup",
      "mid-notebook",
      "far-book",
    ]);

    for (const subject of geometry.subjects) {
      const target = tableTiltScene.focusTargets.find((candidate) => candidate.id === subject.id);
      expect(target, `missing target for ${subject.id}`).toBeDefined();
      expect(target?.worldPosition).toEqual(subject.focusAnchorWorld);
      expect(target?.label).toBe(subject.label);
      expect(subject.role).toBe(
        subject.id === "near-cup" ? "near" : subject.id === "mid-notebook" ? "middle" : "far",
      );
    }
  });

  it("derives scene camera, bounds, focus preset, and composition from canonical geometry", () => {
    expect(tableTiltScene.cameraPreset.focusDistanceMm).toBe(geometry.canonicalFocusDistanceMm);
    expect(tableTiltScene.cameraPlacement).toEqual(geometry.observerCamera);
    expect(tableTiltScene.bounds).toEqual(geometry.sceneBounds);
    expect(tableTiltScene.compositionTargets).toEqual([
      {
        id: "table-surface",
        label: "Table surface alignment",
        worldBounds: geometry.compositionTargetBounds,
      },
    ]);
  });

  it("places the tabletop below the simulated lens datum", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...tableTiltScene.cameraPreset,
      activeSceneId: tableTiltScene.id,
    };
    const opticsState = deriveOpticsState(cameraState, tableTiltScene);
    expect(opticsState.lensCenterWorld).toEqual({ x: 0, y: 0, z: 0 });

    const surfaceCentreY = geometry.tabletopTopSurfacePlane.point.y;
    expect(surfaceCentreY).toBeGreaterThanOrEqual(-500);
    expect(surfaceCentreY).toBeLessThanOrEqual(-350);

    const topSurfaceCorners = [
      tabletopLocalToWorld({
        localX: -geometry.tabletop.width / 2,
        localDepth: geometry.tabletop.nearLocalDepth,
      }),
      tabletopLocalToWorld({
        localX: geometry.tabletop.width / 2,
        localDepth: geometry.tabletop.nearLocalDepth,
      }),
      tabletopLocalToWorld({
        localX: -geometry.tabletop.width / 2,
        localDepth: geometry.tabletop.farLocalDepth,
      }),
      tabletopLocalToWorld({
        localX: geometry.tabletop.width / 2,
        localDepth: geometry.tabletop.farLocalDepth,
      }),
    ];
    topSurfaceCorners.forEach((corner) => expect(corner.y).toBeLessThan(0));
    geometry.subjects.forEach((subject) => expect(subject.worldPosition.y).toBeLessThan(0));
    expect(geometry.floor.center.y).toBeLessThan(
      Math.min(...getTabletopWorldCorners().map((corner) => corner.y)),
    );
  });

  it("frames the tabletop surface and all subject anchors in the initial optical view", () => {
    const cameraState = {
      ...DEFAULT_CAMERA_STATE,
      ...tableTiltScene.cameraPreset,
      activeSceneId: tableTiltScene.id,
    };
    const opticsState = deriveOpticsState(cameraState, tableTiltScene);
    const projectedTargets = projectSceneFocusTargetsToGroundGlass({
      sceneDef: tableTiltScene,
      opticsState,
      aperture: cameraState.aperture,
      previewMode: "raw",
    });

    expect(projectedTargets.map((target) => target.id)).toEqual([
      "near-cup",
      "mid-notebook",
      "far-book",
    ]);
    projectedTargets.forEach((target) => {
      expect(target.visible, `${target.id} should be inside the initial film frame`).toBe(true);
      expect(target.rawUv.u).toBeGreaterThan(0.04);
      expect(target.rawUv.u).toBeLessThan(0.96);
      expect(target.rawUv.v).toBeGreaterThan(0.04);
      expect(target.rawUv.v).toBeLessThan(0.96);
    });

    const tabletopSamples = [-1200, 0, 1200].map((localDepth) =>
      tabletopLocalToWorld({ localX: 0, localDepth }),
    );
    tabletopSamples.forEach((worldPoint) => {
      const projected = projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: opticsState.lensCenterWorld,
        filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
      });
      expect(projected.visible).toBe(true);
    });
  });

  it("derives every subject anchor from the rotated tabletop surface", () => {
    for (const subject of geometry.subjects) {
      const converted = tabletopLocalToWorld(subject.tabletopLocalPosition);
      expect(converted).toEqual(subject.worldPosition);
      expect(subject.focusAnchorWorld).toEqual(converted);
      expect(signedDistanceToTabletop(converted)).toBeCloseTo(
        subject.focusAnchorSurfaceOffsetMm,
        7,
      );
    }

    const distinctHeights = new Set(
      geometry.subjects.map((subject) => subject.worldPosition.y.toFixed(6)),
    );
    expect(distinctHeights.size).toBe(3);
  });

  it("orders the semantic subjects from near to far relative to the observer camera", () => {
    const camera = geometry.observerCamera.position;
    const nearDistance = distance(camera, geometry.nearSubject.focusAnchorWorld);
    const middleDistance = distance(camera, geometry.middleSubject.focusAnchorWorld);
    const farDistance = distance(camera, geometry.farSubject.focusAnchorWorld);

    expect(nearDistance).toBeLessThan(middleDistance);
    expect(middleDistance).toBeLessThan(farDistance);
  });

  it("contains the floor, tabletop, supports, and complete subject bounds", () => {
    const supportCorners = geometry.tableSupports.flatMap((support) => {
      const corners: TableTiltVec3[] = [];
      for (const xSign of [-1, 1]) {
        for (const ySign of [-1, 1]) {
          for (const zSign of [-1, 1]) {
            corners.push({
              x: support.center.x + (xSign * support.width) / 2,
              y: support.center.y + (ySign * support.height) / 2,
              z: support.center.z + (zSign * support.depth) / 2,
            });
          }
        }
      }
      return corners;
    });

    const physicalPoints = [
      ...getFloorWorldCorners(),
      ...getTabletopWorldCorners(),
      ...supportCorners,
      ...geometry.subjects.flatMap(getSubjectWorldBoundsCorners),
    ];
    physicalPoints.forEach(expectPointInsideBounds);
    expect(tableTiltScene.bounds).toEqual(geometry.sceneBounds);
  });

  it("keeps dimensions and generated positions finite and positive", () => {
    const dimensions = [
      geometry.floor.width,
      geometry.floor.depth,
      geometry.tabletop.width,
      geometry.tabletop.depth,
      geometry.tabletop.thickness,
      ...geometry.tableSupports.flatMap((support) => [
        support.width,
        support.height,
        support.depth,
      ]),
      ...geometry.subjects.flatMap((subject) => [
        subject.dimensions.width,
        subject.dimensions.height,
        subject.dimensions.depth,
        subject.bounds.size.x,
        subject.bounds.size.y,
        subject.bounds.size.z,
      ]),
    ];
    dimensions.forEach((dimension) => {
      expect(Number.isFinite(dimension)).toBe(true);
      expect(dimension).toBeGreaterThan(0);
    });

    const positions = [
      geometry.tabletop.center,
      geometry.observerCamera.position,
      geometry.observerCamera.target,
      ...geometry.tableSupports.flatMap((support) => [support.center, support.topWorld]),
      ...geometry.subjects.flatMap((subject) => [subject.worldPosition, subject.focusAnchorWorld]),
    ];
    positions
      .flatMap((position) => [position.x, position.y, position.z])
      .forEach((coordinate) => {
        expect(Number.isFinite(coordinate)).toBe(true);
      });
  });

  it("converts the tabletop centre and multiple depths consistently", () => {
    const centre = tabletopLocalToWorld({ localX: 0, localDepth: 0 });
    expect(centre).toEqual(geometry.tabletopTopSurfacePlane.point);

    const near = tabletopLocalToWorld({ localX: 0, localDepth: -900 });
    const far = tabletopLocalToWorld({ localX: 0, localDepth: 900 });
    expect(signedDistanceToTabletop(near)).toBeCloseTo(0, 7);
    expect(signedDistanceToTabletop(far)).toBeCloseTo(0, 7);
    expect(near.y).toBeGreaterThan(centre.y);
    expect(centre.y).toBeGreaterThan(far.y);
    expect(near.z).toBeLessThan(centre.z);
    expect(centre.z).toBeLessThan(far.z);

    const raised = tabletopLocalToWorld({
      localX: 125,
      localDepth: 700,
      verticalOffsetMm: 35,
    });
    expect(signedDistanceToTabletop(raised)).toBeCloseTo(35, 7);
  });

  it("creates stable semantic nodes at the canonical anchors", () => {
    const group = createTableTiltGroup();
    try {
      expect(group.name).toBe("table-tilt-subject");
      expect(group.getObjectByName("table-tilt-tabletop")).toBeInstanceOf(THREE.Mesh);

      for (const subject of geometry.subjects) {
        expect(group.getObjectByName(subject.semanticName)).toBeInstanceOf(THREE.Mesh);
        const anchor = group.getObjectByName(`${subject.semanticName}-anchor`);
        expect(anchor).toBeInstanceOf(THREE.Group);
        expect(anchor?.position.toArray()).toEqual([
          toWorld(subject.focusAnchorWorld.x),
          toWorld(subject.focusAnchorWorld.y),
          toWorld(subject.focusAnchorWorld.z),
        ]);
        expect(anchor?.userData.focusTargetId).toBe(subject.id);
      }
    } finally {
      disposeTableTiltGroup(group);
    }
  });
});
