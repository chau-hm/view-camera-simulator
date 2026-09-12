import { getSceneGeometryTargetMessageKey } from "../geometry/sceneGeometryGuides";
import { readoutMessageKeys, type ReadoutMessageKey } from "../../i18n/readoutMessageKeys";
import type { SimulatorMessageKey } from "../../i18n/simulatorMessageKeys";

export type FocusDistributionDisplayUv = Readonly<{
  u: number;
  v: number;
}>;

export type FocusDistributionTarget = {
  id: string;
  status?: string;
  sharpnessPercent: number;
  /** Display-space coordinates from the canonical Ground Glass projection. */
  displayUv: FocusDistributionDisplayUv | null;
  /** Projection visibility; false targets remain available outside the grid. */
  visible: boolean;
};

type GridIndex = 0 | 1 | 2;

export type FocusDistributionGridPosition = {
  rowIndex: GridIndex;
  columnIndex: GridIndex;
};

export type ResolvedFocusDistributionTarget = FocusDistributionTarget & {
  gridPosition: FocusDistributionGridPosition;
  /** Existing scene target translation, when the target has one. */
  targetLabelKey?: SimulatorMessageKey;
};

export type FocusDistributionGridCell = FocusDistributionGridPosition & {
  positionLabelKey: ReadoutMessageKey;
  /** Every visible target that truthfully quantizes to this display cell. */
  targets: ResolvedFocusDistributionTarget[];
};

export type FocusDistributionUnplacedTarget = FocusDistributionTarget & {
  targetLabelKey?: SimulatorMessageKey;
};

const positionLabelKeys: readonly (readonly ReadoutMessageKey[])[] = [
  [
    readoutMessageKeys.focusDistribution.positions.upperLeft,
    readoutMessageKeys.focusDistribution.positions.upperCentre,
    readoutMessageKeys.focusDistribution.positions.upperRight,
  ],
  [
    readoutMessageKeys.focusDistribution.positions.middleLeft,
    readoutMessageKeys.focusDistribution.positions.centre,
    readoutMessageKeys.focusDistribution.positions.middleRight,
  ],
  [
    readoutMessageKeys.focusDistribution.positions.lowerLeft,
    readoutMessageKeys.focusDistribution.positions.lowerCentre,
    readoutMessageKeys.focusDistribution.positions.lowerRight,
  ],
];

/**
 * Quantize an actual Ground Glass display coordinate into the compact panel.
 * Coordinates outside the visible display are deliberately left unplaced.
 */
export function quantizeFocusDistributionDisplayUv(
  displayUv: FocusDistributionDisplayUv | null,
  visible: boolean,
): FocusDistributionGridPosition | null {
  if (
    !visible ||
    !displayUv ||
    !Number.isFinite(displayUv.u) ||
    !Number.isFinite(displayUv.v) ||
    displayUv.u < 0 ||
    displayUv.u > 1 ||
    displayUv.v < 0 ||
    displayUv.v > 1
  ) {
    return null;
  }

  return {
    rowIndex: Math.min(2, Math.floor(displayUv.v * 3)) as GridIndex,
    columnIndex: Math.min(2, Math.floor(displayUv.u * 3)) as GridIndex,
  };
}

const targetLabelKeyForScene = (
  sceneId: string,
  targetId: string,
): SimulatorMessageKey | undefined => getSceneGeometryTargetMessageKey(sceneId, targetId);

/**
 * Keep colliding targets in a stable spatial order without using sharpness as
 * a proxy for position. The display coordinates are the only spatial source;
 * the id is only the deterministic final tie-break.
 */
const compareTargetsByDisplayPosition = (
  first: ResolvedFocusDistributionTarget,
  second: ResolvedFocusDistributionTarget,
): number => {
  const firstV = first.displayUv?.v ?? Number.POSITIVE_INFINITY;
  const secondV = second.displayUv?.v ?? Number.POSITIVE_INFINITY;
  if (firstV !== secondV) return firstV - secondV;

  const firstU = first.displayUv?.u ?? Number.POSITIVE_INFINITY;
  const secondU = second.displayUv?.u ?? Number.POSITIVE_INFINITY;
  if (firstU !== secondU) return firstU - secondU;

  return first.id.localeCompare(second.id);
};

export function createFocusDistributionLayout(
  sceneId: string,
  focusTargets: readonly FocusDistributionTarget[],
): {
  rows: readonly (readonly FocusDistributionGridCell[])[];
  unplaced: readonly FocusDistributionUnplacedTarget[];
} {
  const cells: FocusDistributionGridCell[] = Array.from({ length: 9 }, (_, index) => {
    const rowIndex = Math.floor(index / 3) as GridIndex;
    const columnIndex = (index % 3) as GridIndex;
    return {
      rowIndex,
      columnIndex,
      positionLabelKey: positionLabelKeys[rowIndex][columnIndex],
      targets: [],
    };
  });
  const unplaced: FocusDistributionUnplacedTarget[] = [];

  for (const target of focusTargets) {
    const targetLabelKey = targetLabelKeyForScene(sceneId, target.id);
    const gridPosition = quantizeFocusDistributionDisplayUv(target.displayUv, target.visible);

    if (!gridPosition) {
      unplaced.push({ ...target, targetLabelKey });
      continue;
    }

    const cellIndex = gridPosition.rowIndex * 3 + gridPosition.columnIndex;
    const cell = cells[cellIndex];
    cell.targets.push({
      ...target,
      gridPosition,
      targetLabelKey,
    });
  }

  cells.forEach((cell) => cell.targets.sort(compareTargetsByDisplayPosition));

  return {
    rows: [0, 1, 2].map((rowIndex) =>
      cells.filter((cell) => cell.rowIndex === rowIndex),
    ),
    unplaced,
  };
}
