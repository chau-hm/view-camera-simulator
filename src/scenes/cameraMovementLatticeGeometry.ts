import type { Bounds3, Vec3 } from "../types/optics";
import {
  CAMERA_MOVEMENT_SCENE_CALIBRATION,
  type CameraMovementLatticeRegion,
  type CameraMovementSubjectCalibration,
  type CameraMovementTargetRegion,
} from "./cameraMovementSceneCalibration";

export type CameraMovementLatticeAxis = "x" | "y" | "z";
export type CameraMovementLatticeEdgeRole = "outer-vertical" | "outer-horizontal" | "internal";

export type CanonicalLatticeVertex = Readonly<{
  id: `camera-movement-lattice-vertex-${number}`;
  positionWorld: Readonly<Vec3>;
}>;

export type CanonicalLatticeEdge = Readonly<{
  id: `camera-movement-lattice-edge-${string}`;
  vertexIds: readonly [CanonicalLatticeVertex["id"], CanonicalLatticeVertex["id"]];
  startWorld: Readonly<Vec3>;
  endWorld: Readonly<Vec3>;
  axis: CameraMovementLatticeAxis;
  role: CameraMovementLatticeEdgeRole;
  /**
   * Region used for initial presentation. Shared edges retain all contributing
   * level indices so later renderers can select a configured level precisely.
   */
  targetRegion: CameraMovementLatticeRegion;
  levelIndices: readonly number[];
}>;

export type CanonicalLatticeLevel = Readonly<{
  id: `camera-movement-lattice-level-${number}`;
  levelIndex: number;
  targetRegion: CameraMovementLatticeRegion;
  bounds: Readonly<Bounds3>;
}>;

export type CanonicalCameraMovementLattice = Readonly<{
  units: "millimetres";
  dimensions: Readonly<Pick<CameraMovementSubjectCalibration, "columns" | "rows" | "levels">>;
  vertices: readonly CanonicalLatticeVertex[];
  edges: readonly CanonicalLatticeEdge[];
  bounds: Readonly<Bounds3>;
  perLevelBounds: readonly CanonicalLatticeLevel[];
  targetLevelByRegion: Readonly<Record<CameraMovementTargetRegion, number>>;
}>;

type MutableEdge = {
  vertexIds: [CanonicalLatticeVertex["id"], CanonicalLatticeVertex["id"]];
  axis: CameraMovementLatticeAxis;
  levelIndices: Set<number>;
};

const CELL_EDGE_VERTEX_PAIRS = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
  [0, 2],
  [1, 3],
  [4, 6],
  [5, 7],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

const assertPositiveInteger = (name: string, value: number): void => {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
};

const assertFiniteNonNegative = (name: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${name} must be finite and non-negative`);
  }
};

const assertFinitePoint = (name: string, point: Readonly<Vec3>): void => {
  if (![point.x, point.y, point.z].every(Number.isFinite)) {
    throw new Error(`${name} must contain finite coordinates`);
  }
};

const validateCalibration = (calibration: CameraMovementSubjectCalibration): void => {
  assertPositiveInteger("columns", calibration.columns);
  assertPositiveInteger("rows", calibration.rows);
  assertPositiveInteger("levels", calibration.levels);
  if (!Number.isFinite(calibration.cubeSizeMm) || calibration.cubeSizeMm <= 0) {
    throw new Error("cubeSizeMm must be finite and positive");
  }
  assertFiniteNonNegative("horizontalGapMm", calibration.horizontalGapMm);
  assertFiniteNonNegative("verticalGapMm", calibration.verticalGapMm);
  assertFinitePoint("originWorld", calibration.originWorld);

  const configuredTargetLevels = [
    calibration.upperTargetLevel,
    calibration.middleTargetLevel,
    calibration.lowerTargetLevel,
  ];
  if (
    !configuredTargetLevels.every(
      (level) => Number.isInteger(level) && level >= 0 && level < calibration.levels,
    )
  ) {
    throw new Error("target levels must be valid zero-based lattice level indices");
  }
  if (new Set(configuredTargetLevels).size !== configuredTargetLevels.length) {
    throw new Error("upper, middle, and lower target levels must be distinct");
  }
};

const regionForLevel = (
  calibration: CameraMovementSubjectCalibration,
  levelIndex: number,
): CameraMovementLatticeRegion => {
  if (levelIndex === calibration.upperTargetLevel) return "upper";
  if (levelIndex === calibration.middleTargetLevel) return "middle";
  if (levelIndex === calibration.lowerTargetLevel) return "lower";
  return "neutral";
};

const axisCellBoundary = (
  minimum: number,
  cellIndex: number,
  cubeSizeMm: number,
  gapMm: number,
  maximum: boolean,
): number => {
  if (gapMm === 0) {
    return minimum + (cellIndex + (maximum ? 1 : 0)) * cubeSizeMm;
  }
  return minimum + cellIndex * (cubeSizeMm + gapMm) + (maximum ? cubeSizeMm : 0);
};

const finiteBounds = (min: Vec3, max: Vec3): Bounds3 => ({
  min: { x: min.x, y: min.y, z: min.z },
  max: { x: max.x, y: max.y, z: max.z },
});

const pointKey = ({ x, y, z }: Readonly<Vec3>): string =>
  `${Object.is(x, -0) ? 0 : x}|${Object.is(y, -0) ? 0 : y}|${Object.is(z, -0) ? 0 : z}`;

const edgeAxis = (start: Readonly<Vec3>, end: Readonly<Vec3>): CameraMovementLatticeAxis => {
  if (start.x !== end.x) return "x";
  if (start.y !== end.y) return "y";
  return "z";
};

const edgeRole = (
  axis: CameraMovementLatticeAxis,
  start: Readonly<Vec3>,
  bounds: Readonly<Bounds3>,
): CameraMovementLatticeEdgeRole => {
  const atXBoundary = start.x === bounds.min.x || start.x === bounds.max.x;
  const atYBoundary = start.y === bounds.min.y || start.y === bounds.max.y;
  const atZBoundary = start.z === bounds.min.z || start.z === bounds.max.z;

  if (axis === "y" && atXBoundary && atZBoundary) return "outer-vertical";
  if (
    (axis === "x" && atYBoundary && atZBoundary) ||
    (axis === "z" && atYBoundary && atXBoundary)
  ) {
    return "outer-horizontal";
  }
  return "internal";
};

/**
 * Generates the complete scene lattice in canonical millimetre world space.
 *
 * The subject origin is the geometric centre of the full structure. Cells are
 * enumerated bottom-to-top, camera-left-to-right, then near-to-far. Vertices
 * and edges are de-duplicated before immutable metadata is returned, so a
 * contiguous lattice represents every shared edge exactly once.
 */
export const generateCameraMovementLattice = (
  calibration: CameraMovementSubjectCalibration,
): CanonicalCameraMovementLattice => {
  validateCalibration(calibration);

  const { columns, rows, levels, cubeSizeMm, horizontalGapMm, verticalGapMm } = calibration;
  const totalWidthMm = columns * cubeSizeMm + (columns - 1) * horizontalGapMm;
  const totalDepthMm = rows * cubeSizeMm + (rows - 1) * horizontalGapMm;
  const totalHeightMm = levels * cubeSizeMm + (levels - 1) * verticalGapMm;
  const bounds = finiteBounds(
    {
      x: calibration.originWorld.x - totalWidthMm / 2,
      y: calibration.originWorld.y - totalHeightMm / 2,
      z: calibration.originWorld.z - totalDepthMm / 2,
    },
    {
      x: calibration.originWorld.x + totalWidthMm / 2,
      y: calibration.originWorld.y + totalHeightMm / 2,
      z: calibration.originWorld.z + totalDepthMm / 2,
    },
  );

  const vertices: CanonicalLatticeVertex[] = [];
  const vertexByPoint = new Map<string, CanonicalLatticeVertex>();
  const mutableEdgeByKey = new Map<string, MutableEdge>();

  const getVertex = (positionWorld: Vec3): CanonicalLatticeVertex => {
    const key = pointKey(positionWorld);
    const existing = vertexByPoint.get(key);
    if (existing) return existing;
    const vertex: CanonicalLatticeVertex = {
      id: `camera-movement-lattice-vertex-${vertices.length}`,
      positionWorld,
    };
    vertexByPoint.set(key, vertex);
    vertices.push(vertex);
    return vertex;
  };

  for (let levelIndex = 0; levelIndex < levels; levelIndex += 1) {
    const yMin = axisCellBoundary(bounds.min.y, levelIndex, cubeSizeMm, verticalGapMm, false);
    const yMax = axisCellBoundary(bounds.min.y, levelIndex, cubeSizeMm, verticalGapMm, true);
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const zMin = axisCellBoundary(bounds.min.z, rowIndex, cubeSizeMm, horizontalGapMm, false);
      const zMax = axisCellBoundary(bounds.min.z, rowIndex, cubeSizeMm, horizontalGapMm, true);
      for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
        const xMin = axisCellBoundary(
          bounds.min.x,
          columnIndex,
          cubeSizeMm,
          horizontalGapMm,
          false,
        );
        const xMax = axisCellBoundary(bounds.min.x, columnIndex, cubeSizeMm, horizontalGapMm, true);
        const cellVertices = [
          getVertex({ x: xMin, y: yMin, z: zMin }),
          getVertex({ x: xMax, y: yMin, z: zMin }),
          getVertex({ x: xMin, y: yMax, z: zMin }),
          getVertex({ x: xMax, y: yMax, z: zMin }),
          getVertex({ x: xMin, y: yMin, z: zMax }),
          getVertex({ x: xMax, y: yMin, z: zMax }),
          getVertex({ x: xMin, y: yMax, z: zMax }),
          getVertex({ x: xMax, y: yMax, z: zMax }),
        ] as const;

        CELL_EDGE_VERTEX_PAIRS.forEach(([startIndex, endIndex]) => {
          const start = cellVertices[startIndex];
          const end = cellVertices[endIndex];
          const sortedIds = [start.id, end.id].sort() as [
            CanonicalLatticeVertex["id"],
            CanonicalLatticeVertex["id"],
          ];
          const key = `${sortedIds[0]}--${sortedIds[1]}`;
          const existing = mutableEdgeByKey.get(key);
          if (existing) {
            existing.levelIndices.add(levelIndex);
            return;
          }
          mutableEdgeByKey.set(key, {
            vertexIds: sortedIds,
            axis: edgeAxis(start.positionWorld, end.positionWorld),
            levelIndices: new Set([levelIndex]),
          });
        });
      }
    }
  }

  const vertexById = new Map(vertices.map((vertex) => [vertex.id, vertex]));
  const edges: CanonicalLatticeEdge[] = [...mutableEdgeByKey.values()].map((mutableEdge) => {
    const start = vertexById.get(mutableEdge.vertexIds[0])!;
    const end = vertexById.get(mutableEdge.vertexIds[1])!;
    const levelIndices = [...mutableEdge.levelIndices].sort((a, b) => a - b);
    const regions = new Set(
      levelIndices
        .map((levelIndex) => regionForLevel(calibration, levelIndex))
        .filter((region) => region !== "neutral"),
    );
    const targetRegion =
      regions.size === 1 ? ([...regions][0] as CameraMovementTargetRegion) : ("neutral" as const);
    return {
      id: `camera-movement-lattice-edge-${mutableEdge.vertexIds[0]}-${mutableEdge.vertexIds[1]}`,
      vertexIds: mutableEdge.vertexIds,
      startWorld: start.positionWorld,
      endWorld: end.positionWorld,
      axis: mutableEdge.axis,
      role: edgeRole(mutableEdge.axis, start.positionWorld, bounds),
      targetRegion,
      levelIndices,
    };
  });

  const perLevelBounds: CanonicalLatticeLevel[] = Array.from(
    { length: levels },
    (_, levelIndex) => {
      const yMin = axisCellBoundary(bounds.min.y, levelIndex, cubeSizeMm, verticalGapMm, false);
      const yMax = axisCellBoundary(bounds.min.y, levelIndex, cubeSizeMm, verticalGapMm, true);
      return {
        id: `camera-movement-lattice-level-${levelIndex}`,
        levelIndex,
        targetRegion: regionForLevel(calibration, levelIndex),
        bounds: finiteBounds(
          { x: bounds.min.x, y: yMin, z: bounds.min.z },
          { x: bounds.max.x, y: yMax, z: bounds.max.z },
        ),
      };
    },
  );

  return {
    units: "millimetres",
    dimensions: { columns, rows, levels },
    vertices,
    edges,
    bounds,
    perLevelBounds,
    targetLevelByRegion: {
      upper: calibration.upperTargetLevel,
      middle: calibration.middleTargetLevel,
      lower: calibration.lowerTargetLevel,
    },
  };
};

export const CAMERA_MOVEMENT_LATTICE = generateCameraMovementLattice(
  CAMERA_MOVEMENT_SCENE_CALIBRATION.subject,
);
