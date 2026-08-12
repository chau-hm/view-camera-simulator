import { describe, expect, it } from "vitest";
import {
  CAMERA_MOVEMENT_LATTICE,
  generateCameraMovementLattice,
} from "../../scenes/cameraMovementLatticeGeometry";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
  type CameraMovementSubjectCalibration,
} from "../../scenes/cameraMovementSceneCalibration";

const defaultSubject = CAMERA_MOVEMENT_SCENE_CALIBRATION.subject;

const subjectWith = (
  overrides: Partial<CameraMovementSubjectCalibration>,
): CameraMovementSubjectCalibration => ({
  ...defaultSubject,
  ...overrides,
  originWorld: overrides.originWorld ?? defaultSubject.originWorld,
});

const allCoordinates = (lattice: ReturnType<typeof generateCameraMovementLattice>): number[] =>
  lattice.vertices.flatMap(({ positionWorld }) => [
    positionWorld.x,
    positionWorld.y,
    positionWorld.z,
  ]);

/**
 * A contiguous C × R × L cell grid has:
 * - C(L + 1)(R + 1) edges parallel to X;
 * - L(C + 1)(R + 1) edges parallel to Y;
 * - R(C + 1)(L + 1) edges parallel to Z.
 *
 * For the provisional 3 × 3 × 5 lattice this is
 * 3×6×4 + 5×4×4 + 3×4×6 = 72 + 80 + 72 = 224 unique edges.
 */
const expectedContiguousGridEdgeCount = (columns: number, rows: number, levels: number): number =>
  columns * (levels + 1) * (rows + 1) +
  levels * (columns + 1) * (rows + 1) +
  rows * (columns + 1) * (levels + 1);

describe("camera movement scene calibration", () => {
  it("defines the provisional 3 × 3 × 5 lattice and preserves 90 mm finite focus", () => {
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.calibrationStatus).toBe("provisional");
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.geometryAndOpticsUnits).toBe("millimetres");
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.subject).toMatchObject({
      columns: 3,
      rows: 3,
      levels: 5,
    });
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.optics).toMatchObject({
      provisionalFocalLengthMm: 90,
      provisionalFocusDistanceMm: 2000,
    });
  });

  it("defaults target presentation to middle with no reference camera", () => {
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.defaultTargetRegion).toBe("middle");
    expect(CAMERA_MOVEMENT_SCENE_CALIBRATION.presentation.showReferenceCamera).toBe(false);
  });
});

describe("canonical camera movement lattice", () => {
  it("is deterministic and retains stable IDs for identical calibration", () => {
    const first = generateCameraMovementLattice(defaultSubject);
    const second = generateCameraMovementLattice({ ...defaultSubject });

    expect(second).toEqual(first);
    expect(second.vertices.map(({ id }) => id)).toEqual(first.vertices.map(({ id }) => id));
    expect(second.edges.map(({ id }) => id)).toEqual(first.edges.map(({ id }) => id));
  });

  it("generates the mathematically complete unique edge set without shared duplicates", () => {
    const expectedCount = expectedContiguousGridEdgeCount(3, 3, 5);
    expect(expectedCount).toBe(224);
    expect(CAMERA_MOVEMENT_LATTICE.edges).toHaveLength(expectedCount);

    const endpointKeys = CAMERA_MOVEMENT_LATTICE.edges.map(({ vertexIds }) =>
      [...vertexIds].sort().join("--"),
    );
    expect(new Set(endpointKeys).size).toBe(endpointKeys.length);
  });

  it("returns only finite coordinates and non-degenerate edges", () => {
    expect(allCoordinates(CAMERA_MOVEMENT_LATTICE).every(Number.isFinite)).toBe(true);
    CAMERA_MOVEMENT_LATTICE.edges.forEach((edge) => {
      expect(
        edge.startWorld.x !== edge.endWorld.x ||
          edge.startWorld.y !== edge.endWorld.y ||
          edge.startWorld.z !== edge.endWorld.z,
      ).toBe(true);
      expect(
        [
          edge.startWorld.x,
          edge.startWorld.y,
          edge.startWorld.z,
          edge.endWorld.x,
          edge.endWorld.y,
          edge.endWorld.z,
        ].every(Number.isFinite),
      ).toBe(true);
    });
  });

  it("provides finite complete bounds that enclose every vertex", () => {
    const { bounds, vertices } = CAMERA_MOVEMENT_LATTICE;
    expect(
      [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(
        Number.isFinite,
      ),
    ).toBe(true);
    expect(bounds.max.x).toBeGreaterThan(bounds.min.x);
    expect(bounds.max.y).toBeGreaterThan(bounds.min.y);
    expect(bounds.max.z).toBeGreaterThan(bounds.min.z);

    vertices.forEach(({ positionWorld }) => {
      expect(positionWorld.x).toBeGreaterThanOrEqual(bounds.min.x);
      expect(positionWorld.x).toBeLessThanOrEqual(bounds.max.x);
      expect(positionWorld.y).toBeGreaterThanOrEqual(bounds.min.y);
      expect(positionWorld.y).toBeLessThanOrEqual(bounds.max.y);
      expect(positionWorld.z).toBeGreaterThanOrEqual(bounds.min.z);
      expect(positionWorld.z).toBeLessThanOrEqual(bounds.max.z);
    });
  });

  it("provides one valid finite bound and explicit region identity per level", () => {
    expect(CAMERA_MOVEMENT_LATTICE.perLevelBounds).toHaveLength(5);
    CAMERA_MOVEMENT_LATTICE.perLevelBounds.forEach(({ levelIndex, bounds }) => {
      expect(levelIndex).toBeGreaterThanOrEqual(0);
      expect(levelIndex).toBeLessThan(5);
      expect(bounds.max.x).toBeGreaterThan(bounds.min.x);
      expect(bounds.max.y).toBeGreaterThan(bounds.min.y);
      expect(bounds.max.z).toBeGreaterThan(bounds.min.z);
      expect(
        [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(
          Number.isFinite,
        ),
      ).toBe(true);
    });
    expect(CAMERA_MOVEMENT_LATTICE.perLevelBounds.map((level) => level.targetRegion)).toEqual([
      "lower",
      "neutral",
      "middle",
      "neutral",
      "upper",
    ]);
  });

  it("resolves upper, middle, and lower regions to valid configured levels", () => {
    const { targetLevelByRegion, perLevelBounds } = CAMERA_MOVEMENT_LATTICE;
    expect(targetLevelByRegion).toEqual({ upper: 4, middle: 2, lower: 0 });
    Object.entries(targetLevelByRegion).forEach(([region, levelIndex]) => {
      expect(levelIndex).toBeGreaterThanOrEqual(0);
      expect(levelIndex).toBeLessThan(perLevelBounds.length);
      expect(perLevelBounds[levelIndex]?.targetRegion).toBe(region);
    });
  });

  it("classifies outer vertical, outer horizontal, and internal edges", () => {
    expect(new Set(CAMERA_MOVEMENT_LATTICE.edges.map(({ role }) => role))).toEqual(
      new Set(["outer-vertical", "outer-horizontal", "internal"]),
    );
  });

  it.each([
    ["columns", subjectWith({ columns: 4 })],
    ["rows", subjectWith({ rows: 4 })],
    ["levels", subjectWith({ levels: 6, upperTargetLevel: 5, middleTargetLevel: 3 })],
    ["cube size", subjectWith({ cubeSizeMm: defaultSubject.cubeSizeMm + 20 })],
    ["horizontal spacing", subjectWith({ horizontalGapMm: defaultSubject.horizontalGapMm + 20 })],
    ["vertical spacing", subjectWith({ verticalGapMm: defaultSubject.verticalGapMm + 20 })],
  ])("derives changed geometry when %s changes", (_label, changedCalibration) => {
    const changed = generateCameraMovementLattice(changedCalibration);
    expect(changed).not.toEqual(CAMERA_MOVEMENT_LATTICE);
  });
});
