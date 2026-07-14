import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { createTableTiltGroup, disposeTableTiltGroup } from "../../render/TableTiltSubjectFactory";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { projectSceneFocusTargetsToGroundGlass } from "../../render/groundGlassTargetProjection";
import { toWorld } from "../../render/rttUtils";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import geometry, {
  getFloorWorldCorners,
  getSubjectWorldBoundsCorners,
  getTabletopWorldCorners,
  subjectLocalToWorld,
  tabletopLocalToWorld,
  type TableTiltVec3,
} from "../../scenes/tableTiltGeometry";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const TOLERANCE = 1e-7;

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

const cameraFor = (overrides: Partial<typeof DEFAULT_CAMERA_STATE> = {}) => ({
  ...DEFAULT_CAMERA_STATE,
  ...tableTiltScene.cameraPreset,
  activeSceneId: tableTiltScene.id,
  ...overrides,
});

describe("canonical Table Tilt geometry", () => {
  it("keeps the physical tabletop horizontal at every depth", () => {
    expect(geometry.tabletop.tiltAngleDeg).toBe(0);
    expect(geometry.tabletop.tiltAngleRad).toBe(0);
    expect(geometry.tabletop.slopeYPerDepth).toBe(0);
    expect(geometry.tabletopTopSurfacePlane.normal).toEqual({ x: 0, y: 1, z: 0 });

    const near = tabletopLocalToWorld({ localX: 0, localDepth: -1200 });
    const centre = tabletopLocalToWorld({ localX: 0, localDepth: 0 });
    const far = tabletopLocalToWorld({ localX: 0, localDepth: 1200 });
    expect(near.y).toBeCloseTo(centre.y, 10);
    expect(far.y).toBeCloseTo(centre.y, 10);
    expect(near.z).toBeLessThan(centre.z);
    expect(centre.z).toBeLessThan(far.z);
  });

  it("derives the tabletop height from the calibrated lens hinge geometry", () => {
    const calibration = geometry.tableTiltCalibration;
    const tiltRadians = (calibration.frontTiltDeg * Math.PI) / 180;
    const expectedProbePlaneY = -calibration.focalLengthMm / Math.tan(tiltRadians);
    const expectedFocusDistance =
      (calibration.focalLengthMm * Math.cos(tiltRadians)) / Math.sin(tiltRadians) ** 2;

    expect(calibration.focusPlaneY).toBeCloseTo(expectedProbePlaneY, 8);
    expect(calibration.focusDistanceMm).toBeCloseTo(expectedFocusDistance, 8);
    expect(geometry.tabletopTopSurfacePlane.point.y).toBeCloseTo(
      expectedProbePlaneY - calibration.focusProbeHeightAboveTabletopMm,
      8,
    );
    expect(geometry.tabletopTopSurfacePlane.point.y).toBeLessThan(0);
  });

  it("maps scene focus targets to visible high-frequency detail probes", () => {
    expect(tableTiltScene.focusTargets.map((target) => target.id)).toEqual([
      "near-cup",
      "mid-notebook",
      "far-book",
    ]);

    for (const subject of geometry.subjects) {
      const target = tableTiltScene.focusTargets.find((candidate) => candidate.id === subject.id);
      const derivedProbe = subjectLocalToWorld(subject, subject.focusProbeLocalPosition);
      expect(target?.worldPosition).toEqual(subject.focusDetailProbeWorld);
      expect(target?.sampleWorldPositions).toEqual(
        subject.focusSamples.map((sample) => sample.worldPosition),
      );
      expect(subject.focusAnchorWorld).toEqual(subject.focusDetailProbeWorld);
      expect(derivedProbe).toEqual(subject.focusDetailProbeWorld);
      expect(subject.focusProbeSemanticName).toContain("focus-probe");
      expect(signedDistanceToTabletop(subject.focusDetailProbeWorld)).toBeCloseTo(
        geometry.tableTiltCalibration.focusProbeHeightAboveTabletopMm,
        8,
      );
      expect(subject.focusDetailProbeWorld).not.toEqual(subject.worldPosition);
      expect(subject.focusSamples.map((sample) => sample.id)).toEqual([
        "centre",
        "near-edge",
        "far-edge",
        "left-edge",
        "right-edge",
      ]);
      expect(subject.focusSamples[0].worldPosition).toEqual(subject.focusDetailProbeWorld);
      subject.focusSamples.forEach((sample) => {
        expect(sample.worldPosition.y).toBeCloseTo(
          geometry.tableTiltCalibration.focusPlaneY,
          8,
        );
      });
      expect(subject.focusPatch.normalLocal).toEqual({ x: 0, y: 1, z: 0 });
    }
  });

  it("keeps every detail probe on the calibrated horizontal focus plane", () => {
    for (const subject of geometry.subjects) {
      expect(subject.focusDetailProbeWorld.y).toBeCloseTo(
        geometry.tableTiltCalibration.focusPlaneY,
        8,
      );
    }
  });

  it("orders subjects away from the simulated lens along positive Z", () => {
    const depths = geometry.subjects.map((subject) => subject.focusDetailProbeWorld.z);
    expect(depths[0]).toBeGreaterThan(0);
    expect(depths[0]).toBeLessThan(depths[1]);
    expect(depths[1]).toBeLessThan(depths[2]);
  });

  it("frames all detail probes and the intended tabletop surface at the baseline state", () => {
    const camera = cameraFor();
    const opticsState = deriveOpticsState(camera, tableTiltScene);
    const projectedTargets = projectSceneFocusTargetsToGroundGlass({
      sceneDef: tableTiltScene,
      opticsState,
      aperture: camera.aperture,
      previewMode: "raw",
    });

    projectedTargets.forEach((target) => {
      expect(target.visible, `${target.id} should be inside the initial film frame`).toBe(true);
      expect(target.rawUv.u).toBeGreaterThan(0.02);
      expect(target.rawUv.u).toBeLessThan(0.98);
      expect(target.rawUv.v).toBeGreaterThan(0.02);
      expect(target.rawUv.v).toBeLessThan(0.98);
    });

    [-1100, 0, 1100].forEach((localDepth) => {
      const projected = projectWorldPointToFilmPlaneGroundGlass({
        worldPoint: tabletopLocalToWorld({ localX: 0, localDepth }),
        lensCenterWorld: opticsState.lensCenterWorld,
        filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
      });
      expect(projected.visible).toBe(true);
    });
  });

  it("derives scene camera, bounds, preset, and composition from canonical geometry", () => {
    expect(tableTiltScene.cameraPreset.focusDistanceMm).toBe(geometry.canonicalFocusDistanceMm);
    expect(tableTiltScene.cameraPreset.frontTiltDeg).toBe(0);
    expect(tableTiltScene.cameraPlacement).toEqual(geometry.observerCamera);
    expect(tableTiltScene.bounds).toEqual(geometry.sceneBounds);
    expect(tableTiltScene.compositionTargets[0].worldBounds).toEqual(
      geometry.compositionTargetBounds,
    );
  });

  it("contains the floor, tabletop, supports, subjects, and probes in scene bounds", () => {
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

    [
      ...getFloorWorldCorners(),
      ...getTabletopWorldCorners(),
      ...supportCorners,
      ...geometry.subjects.flatMap(getSubjectWorldBoundsCorners),
      ...geometry.subjects.map((subject) => subject.focusDetailProbeWorld),
    ].forEach(expectPointInsideBounds);
  });

  it("keeps canonical dimensions and generated positions finite", () => {
    const dimensions = [
      geometry.floor.width,
      geometry.floor.depth,
      geometry.tabletop.width,
      geometry.tabletop.depth,
      geometry.tabletop.thickness,
      ...geometry.tableSupports.flatMap((support) => [support.width, support.height, support.depth]),
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
      ...geometry.subjects.flatMap((subject) => [
        subject.worldPosition,
        subject.focusDetailProbeWorld,
      ]),
    ];
    positions.flatMap((position) => [position.x, position.y, position.z]).forEach((coordinate) => {
      expect(Number.isFinite(coordinate)).toBe(true);
    });
  });

  it("creates stable semantic subject and focus-probe nodes without debug spheres", () => {
    const group = createTableTiltGroup();
    try {
      expect(group.name).toBe("table-tilt-subject");
      expect(group.getObjectByName("table-tilt-tabletop")).toBeInstanceOf(THREE.Mesh);

      for (const subject of geometry.subjects) {
        expect(group.getObjectByName(subject.semanticName)).toBeInstanceOf(THREE.Mesh);
        const anchor = group.getObjectByName(`${subject.semanticName}-anchor`);
        const probe = group.getObjectByName(subject.focusProbeSemanticName);
        expect(anchor).toBeInstanceOf(THREE.Group);
        expect(probe).toBeInstanceOf(THREE.Object3D);
        expect(anchor?.position.toArray()).toEqual([
          toWorld(subject.worldPosition.x),
          toWorld(subject.worldPosition.y),
          toWorld(subject.worldPosition.z),
        ]);
        group.updateMatrixWorld(true);
        const probeWorld = new THREE.Vector3();
        probe?.getWorldPosition(probeWorld);
        expect(probeWorld.x).toBeCloseTo(toWorld(subject.focusDetailProbeWorld.x), 10);
        expect(probeWorld.y).toBeCloseTo(toWorld(subject.focusDetailProbeWorld.y), 10);
        expect(probeWorld.z).toBeCloseTo(toWorld(subject.focusDetailProbeWorld.z), 10);
        for (const sample of subject.focusSamples) {
          const sampleNode = group.getObjectByName(
            `${subject.semanticName}-focus-sample-${sample.id}`,
          );
          expect(sampleNode).toBeInstanceOf(THREE.Object3D);
          const sampleWorld = new THREE.Vector3();
          sampleNode!.getWorldPosition(sampleWorld);
          expect(sampleWorld.x).toBeCloseTo(toWorld(sample.worldPosition.x), 10);
          expect(sampleWorld.y).toBeCloseTo(toWorld(sample.worldPosition.y), 10);
          expect(sampleWorld.z).toBeCloseTo(toWorld(sample.worldPosition.z), 10);
        }
      }

      const sphereMeshes: THREE.Mesh[] = [];
      group.traverse((object) => {
        if (object instanceof THREE.Mesh && object.geometry.type === "SphereGeometry") {
          sphereMeshes.push(object);
        }
      });
      expect(sphereMeshes).toHaveLength(0);
    } finally {
      disposeTableTiltGroup(group);
    }
  });

  it("lays notebook lines and the far checker chart parallel to the calibrated focus plane", () => {
    const group = createTableTiltGroup();
    try {
      group.updateMatrixWorld(true);
      const assertHorizontalDetailSurface = (prefix: string, expectedCount: number) => {
        const meshes: THREE.Mesh[] = [];
        group.traverse((object) => {
          if (object instanceof THREE.Mesh && new RegExp(`^${prefix}\\d+(?:-\\d+)?$`).test(object.name)) meshes.push(object);
        });
        expect(meshes).toHaveLength(expectedCount);
        const surfaceYs = meshes.map((mesh) => {
          expect(mesh.geometry).toBeInstanceOf(THREE.BoxGeometry);
          const parameters = (mesh.geometry as THREE.BoxGeometry).parameters;
          expect(parameters.height).toBeLessThan(parameters.depth);
          const center = new THREE.Vector3();
          mesh.getWorldPosition(center);
          return center.y + parameters.height / 2;
        });
        surfaceYs.forEach((surfaceY) => {
          expect(
            toWorld(geometry.tableTiltCalibration.focusPlaneY) - surfaceY,
          ).toBeCloseTo(toWorld(geometry.detailGeometry.focusProbeSurfaceGap), 10);
        });
        expect(Math.max(...surfaceYs) - Math.min(...surfaceYs)).toBeLessThan(1e-10);
      };

      assertHorizontalDetailSurface(
        `${geometry.nearSubject.semanticName}-focus-card-band-`,
        geometry.detailGeometry.cup.focusCard.bandCount,
      );
      assertHorizontalDetailSurface(
        `${geometry.middleSubject.semanticName}-line-`,
        geometry.detailGeometry.notebook.focusPanel.lineCount,
      );
      assertHorizontalDetailSurface(
        `${geometry.farSubject.semanticName}-chart-`,
        geometry.detailGeometry.book.focusChart.columns *
          geometry.detailGeometry.book.focusChart.rows,
      );
    } finally {
      disposeTableTiltGroup(group);
    }
  });
});
