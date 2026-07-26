import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import {
  CAMERA_MOVEMENTS_FOCAL_CALIBRATION,
  DEFAULT_SUBJECT_COUNT,
  canonicalSubjectCubes,
  getSubjectLayout,
  subjectLayouts,
  type CanonicalSubjectCube,
  type SubjectCount,
} from "../../scenes/understandingCameraMovementsGeometry";
import geometry from "../../scenes/understandingCameraMovementsGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import { shelfSwingScene } from "../../scenes/definitions/shelf-swing";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import type { CameraState } from "../../types/camera";
import type { Bounds3, Vec3 } from "../../types/optics";
import { CAMERA_CONSTANTS, DEFAULT_CAMERA_STATE } from "../../utils/constants";

const isFinitePoint = (point: Vec3): boolean => [point.x, point.y, point.z].every(Number.isFinite);

const containsPoint = (bounds: Bounds3, point: Vec3): boolean =>
  point.x >= bounds.min.x &&
  point.x <= bounds.max.x &&
  point.y >= bounds.min.y &&
  point.y <= bounds.max.y &&
  point.z >= bounds.min.z &&
  point.z <= bounds.max.z;

const cubesIntersect = (first: CanonicalSubjectCube, second: CanonicalSubjectCube): boolean =>
  first.bounds.min.x < second.bounds.max.x &&
  first.bounds.max.x > second.bounds.min.x &&
  first.bounds.min.y < second.bounds.max.y &&
  first.bounds.max.y > second.bounds.min.y &&
  first.bounds.min.z < second.bounds.max.z &&
  first.bounds.max.z > second.bounds.min.z;

const cameraAtFocalLength = (
  focalLengthMm: number,
  overrides: Partial<CameraState> = {},
): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...understandingCameraMovementsScene.cameraPreset,
  focalLengthMm,
  activeSceneId: understandingCameraMovementsScene.id,
  ...overrides,
});

const projectDefaultLayout = (focalLengthMm: number, overrides: Partial<CameraState> = {}) => {
  const optics = deriveOpticsState(
    cameraAtFocalLength(focalLengthMm, overrides),
    understandingCameraMovementsScene,
  );
  return getSubjectLayout().cubes.flatMap((cube) =>
    cube.vertices.map((worldPoint) =>
      projectWorldPointToFilmPlaneGroundGlass({
        worldPoint,
        lensCenterWorld: optics.lensCenterWorld,
        filmPlaneCornersWorld: optics.filmPlaneCornersWorld,
      }),
    ),
  );
};

const minimumEdgeMargin = (projections: ReturnType<typeof projectDefaultLayout>): number =>
  Math.min(...projections.flatMap(({ uRaw, vRaw }) => [uRaw, 1 - uRaw, vRaw, 1 - vRaw]));

describe("Understanding Camera Movements canonical subject layouts", () => {
  it.each([1, 2, 3] as const)(
    "provides the canonical %i-cube variant with stable roles",
    (count) => {
      const layout = getSubjectLayout(count);
      expect(layout).toBe(subjectLayouts[count]);
      expect(layout.count).toBe(count);
      expect(layout.cubes).toHaveLength(count);
      expect(new Set(layout.cubes.map((cube) => cube.id)).size).toBe(count);
    },
  );

  it("defaults to the upper/middle/lower three-cube stack", () => {
    expect(DEFAULT_SUBJECT_COUNT).toBe(3);
    expect(getSubjectLayout().cubes).toEqual([
      canonicalSubjectCubes.upper,
      canonicalSubjectCubes.middle,
      canonicalSubjectCubes.lower,
    ]);
    expect(getSubjectLayout(2).cubes).toEqual([
      canonicalSubjectCubes.upper,
      canonicalSubjectCubes.lower,
    ]);
    expect(getSubjectLayout(1).cubes).toEqual([canonicalSubjectCubes.middle]);
  });

  it("keeps every cube finite, on the common depth plane, and non-interpenetrating", () => {
    const cubes = getSubjectLayout().cubes;
    for (const cube of cubes) {
      expect(isFinitePoint(cube.center)).toBe(true);
      expect(cube.center.z).toBe(geometry.focusReferenceWorld.z);
      expect(cube.vertices).toHaveLength(8);
      expect(cube.vertices.every(isFinitePoint)).toBe(true);
      expect(cube.vertices.every((vertex) => containsPoint(cube.bounds, vertex))).toBe(true);
    }

    for (let firstIndex = 0; firstIndex < cubes.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < cubes.length; secondIndex += 1) {
        expect(cubesIntersect(cubes[firstIndex], cubes[secondIndex])).toBe(false);
      }
    }
  });

  it.each([1, 2, 3] as SubjectCount[])(
    "derives finite layout bounds containing every vertex for count %i",
    (count) => {
      const layout = getSubjectLayout(count);
      expect(isFinitePoint(layout.bounds.min)).toBe(true);
      expect(isFinitePoint(layout.bounds.max)).toBe(true);
      expect(
        layout.cubes
          .flatMap((cube) => cube.vertices)
          .every((vertex) => containsPoint(layout.bounds, vertex)),
      ).toBe(true);
      expect(containsPoint(layout.bounds, layout.focusReferenceWorld)).toBe(true);
    },
  );

  it("keeps all default cube vertices inside the scene subject bounds", () => {
    expect(
      getSubjectLayout()
        .cubes.flatMap((cube) => cube.vertices)
        .every((vertex) => containsPoint(geometry.subjectBounds, vertex)),
    ).toBe(true);
  });
});

describe("Understanding Camera Movements focal calibration", () => {
  it("selects the longest candidate with full containment and at least 10% edge margin", () => {
    const evidence = CAMERA_MOVEMENTS_FOCAL_CALIBRATION.candidateFocalLengthsMm.map(
      (focalLengthMm) => {
        const projections = projectDefaultLayout(focalLengthMm);
        const finite = projections.every(
          ({ uRaw, vRaw, filmPointWorld }) =>
            Number.isFinite(uRaw) &&
            Number.isFinite(vRaw) &&
            filmPointWorld !== null &&
            isFinitePoint(filmPointWorld),
        );
        const contained = projections.every(({ visible }) => visible);
        return {
          focalLengthMm,
          finite,
          contained,
          minimumEdgeMargin: minimumEdgeMargin(projections),
        };
      },
    );

    expect(evidence.map(({ focalLengthMm }) => focalLengthMm)).toEqual([150, 120, 105, 90]);
    expect(evidence.every(({ finite, contained }) => finite && contained)).toBe(true);

    const accepted = evidence.filter(
      ({ minimumEdgeMargin: margin }) =>
        margin >= CAMERA_MOVEMENTS_FOCAL_CALIBRATION.minimumBaselineEdgeMarginFraction,
    );
    expect(accepted.map(({ focalLengthMm }) => focalLengthMm)).toEqual([120, 105, 90]);
    expect(Math.max(...accepted.map(({ focalLengthMm }) => focalLengthMm))).toBe(
      CAMERA_MOVEMENTS_FOCAL_CALIBRATION.selectedFocalLengthMm,
    );

    const selected = evidence.find(
      ({ focalLengthMm }) =>
        focalLengthMm === CAMERA_MOVEMENTS_FOCAL_CALIBRATION.selectedFocalLengthMm,
    );
    expect(selected?.minimumEdgeMargin).toBeGreaterThanOrEqual(0.1);
    expect(selected?.minimumEdgeMargin).toBeLessThanOrEqual(0.15);
    expect(evidence[0].minimumEdgeMargin).toBeLessThan(0.1);
  });

  it("keeps every vertex projection finite at each supported single-movement endpoint", () => {
    const endpoints: Partial<CameraState>[] = [
      { frontRiseMm: CAMERA_CONSTANTS.riseMinMm },
      { frontRiseMm: CAMERA_CONSTANTS.riseMaxMm },
      { rearRiseMm: CAMERA_CONSTANTS.riseMinMm },
      { rearRiseMm: CAMERA_CONSTANTS.riseMaxMm },
      { frontTiltDeg: CAMERA_CONSTANTS.tiltMinDeg },
      { frontTiltDeg: CAMERA_CONSTANTS.tiltMaxDeg },
      { rearTiltDeg: CAMERA_CONSTANTS.tiltMinDeg },
      { rearTiltDeg: CAMERA_CONSTANTS.tiltMaxDeg },
    ];

    for (const endpoint of endpoints) {
      const projections = projectDefaultLayout(
        CAMERA_MOVEMENTS_FOCAL_CALIBRATION.selectedFocalLengthMm,
        endpoint,
      );
      expect(
        projections.every(
          ({ uRaw, vRaw, filmPointWorld }) =>
            Number.isFinite(uRaw) &&
            Number.isFinite(vRaw) &&
            filmPointWorld !== null &&
            isFinitePoint(filmPointWorld),
        ),
      ).toBe(true);
    }
  });

  it("publishes the selected focal length only for this scene", () => {
    expect(understandingCameraMovementsScene.cameraPreset.focalLengthMm).toBe(
      CAMERA_MOVEMENTS_FOCAL_CALIBRATION.selectedFocalLengthMm,
    );
    expect(architectureRiseScene.cameraPreset.focalLengthMm).toBeUndefined();
    expect(tableTiltScene.cameraPreset.focalLengthMm).toBeUndefined();
    expect(shelfSwingScene.cameraPreset.focalLengthMm).toBeUndefined();
    expect(focusFundamentalsTwoTargets.cameraPreset.focalLengthMm).toBeUndefined();
    expect(DEFAULT_CAMERA_STATE.focalLengthMm).toBe(CAMERA_CONSTANTS.focalLengthMm);
    expect(CAMERA_CONSTANTS.focalLengthMm).toBe(150);
  });
});
