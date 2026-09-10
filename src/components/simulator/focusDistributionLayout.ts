import { getSceneGeometryTargetMessageKey } from "../geometry/sceneGeometryGuides";
import { readoutMessageKeys, type ReadoutMessageKey } from "../../i18n/readoutMessageKeys";
import type { SimulatorMessageKey } from "../../i18n/simulatorMessageKeys";
import {
  mapGroundGlassUvToDisplayUv,
  type GroundGlassPreviewMode,
} from "../../render/groundGlassTargetProjection";

export type FocusDistributionTarget = {
  id: string;
  status?: string;
  sharpnessPercent: number;
};

export type FocusDistributionSlotKey =
  | "near-left"
  | "near-centre"
  | "near-right"
  | "middle"
  | "far-left"
  | "far-centre"
  | "far-right";

type GridIndex = 0 | 1 | 2;

export type FocusDistributionSlotDefinition = {
  key: FocusDistributionSlotKey;
  rowIndex: GridIndex;
  columnIndex: GridIndex;
  uv: { u: number; v: number };
  labelKey: ReadoutMessageKey;
};

export const focusDistributionSlots: readonly FocusDistributionSlotDefinition[] = [
  {
    key: "near-left",
    rowIndex: 0,
    columnIndex: 0,
    uv: { u: 0, v: 0 },
    labelKey: readoutMessageKeys.focusDistribution.positions.nearLeft,
  },
  {
    key: "near-centre",
    rowIndex: 0,
    columnIndex: 1,
    uv: { u: 0.5, v: 0 },
    labelKey: readoutMessageKeys.focusDistribution.positions.nearCentre,
  },
  {
    key: "near-right",
    rowIndex: 0,
    columnIndex: 2,
    uv: { u: 1, v: 0 },
    labelKey: readoutMessageKeys.focusDistribution.positions.nearRight,
  },
  {
    key: "middle",
    rowIndex: 1,
    columnIndex: 1,
    uv: { u: 0.5, v: 0.5 },
    labelKey: readoutMessageKeys.focusDistribution.positions.middle,
  },
  {
    key: "far-left",
    rowIndex: 2,
    columnIndex: 0,
    uv: { u: 0, v: 1 },
    labelKey: readoutMessageKeys.focusDistribution.positions.farLeft,
  },
  {
    key: "far-centre",
    rowIndex: 2,
    columnIndex: 1,
    uv: { u: 0.5, v: 1 },
    labelKey: readoutMessageKeys.focusDistribution.positions.farCentre,
  },
  {
    key: "far-right",
    rowIndex: 2,
    columnIndex: 2,
    uv: { u: 1, v: 1 },
    labelKey: readoutMessageKeys.focusDistribution.positions.farRight,
  },
] as const;

const slotByKey = Object.fromEntries(
  focusDistributionSlots.map((slot) => [slot.key, slot]),
) as Record<FocusDistributionSlotKey, FocusDistributionSlotDefinition>;

/**
 * Scene focus IDs have different physical names, but the learner-facing panel
 * uses the same small spatial vocabulary. This is the single presentation
 * mapping for the currently supported focus-target arrangements.
 */
const targetSlotBySceneId: Readonly<Record<string, Readonly<Record<string, FocusDistributionSlotKey>>>> = {
  "oblique-tabletop": {
    "near-left": "near-left",
    "near-centre": "near-centre",
    "near-right": "near-right",
    middle: "middle",
    "far-left": "far-left",
    "far-centre": "far-centre",
    "far-right": "far-right",
  },
  "table-tilt": {
    "near-cup": "near-centre",
    "mid-notebook": "middle",
    "far-book": "far-centre",
  },
  "shelf-swing": {
    "shelf-front": "near-left",
    "shelf-middle": "middle",
    "shelf-back": "far-right",
  },
  "focus-fundamentals-two-targets": {
    "focus-near-detail": "near-centre",
    "focus-far-detail": "far-centre",
  },
  "oblique-architecture": {
    "facade-near": "near-centre",
    "facade-middle": "middle",
    "facade-far": "far-centre",
  },
  "architecture-foreground": {
    "foreground-near": "near-left",
    "foreground-middle": "middle",
    "building-base": "far-left",
    "building-middle": "far-right",
  },
  "architecture-rise": {
    "building-mid-facade": "middle",
  },
  "interior-corner": {
    "interior-wall-near": "near-centre",
    "interior-wall-middle": "middle",
    "interior-wall-far": "far-centre",
  },
};

export type ResolvedFocusDistributionTarget = FocusDistributionTarget & {
  canonicalSlotKey: FocusDistributionSlotKey;
  slotLabelKey: ReadoutMessageKey;
  /** Existing scene target translation, when the target has one. */
  targetLabelKey?: SimulatorMessageKey;
};

export type FocusDistributionGridCell = {
  rowIndex: GridIndex;
  columnIndex: GridIndex;
  target?: ResolvedFocusDistributionTarget;
};

export type FocusDistributionUnplacedTarget = FocusDistributionTarget & {
  targetLabelKey?: SimulatorMessageKey;
};

export function resolveFocusDistributionSlot(
  sceneId: string,
  targetId: string,
): FocusDistributionSlotKey | null {
  return targetSlotBySceneId[sceneId]?.[targetId] ?? null;
}

export function mapFocusDistributionSlotToDisplayPosition(
  slotKey: FocusDistributionSlotKey,
  previewMode: GroundGlassPreviewMode,
): { rowIndex: GridIndex; columnIndex: GridIndex } {
  const slot = slotByKey[slotKey];
  const displayUv = mapGroundGlassUvToDisplayUv(slot.uv, previewMode);

  return {
    rowIndex: Math.round(displayUv.v * 2) as GridIndex,
    columnIndex: Math.round(displayUv.u * 2) as GridIndex,
  };
}

export function createFocusDistributionLayout(
  sceneId: string,
  focusTargets: readonly FocusDistributionTarget[],
  previewMode: GroundGlassPreviewMode,
): {
  rows: readonly (readonly FocusDistributionGridCell[])[];
  unplaced: readonly FocusDistributionUnplacedTarget[];
} {
  const cells: FocusDistributionGridCell[] = Array.from({ length: 9 }, (_, index) => ({
    rowIndex: Math.floor(index / 3) as GridIndex,
    columnIndex: (index % 3) as GridIndex,
  }));
  const unplaced: FocusDistributionUnplacedTarget[] = [];

  for (const target of focusTargets) {
    const canonicalSlotKey = resolveFocusDistributionSlot(sceneId, target.id);
    const targetLabelKey = sceneId === "oblique-tabletop" && canonicalSlotKey
      ? undefined
      : getSceneGeometryTargetMessageKey(sceneId, target.id);

    if (!canonicalSlotKey) {
      unplaced.push({ ...target, targetLabelKey });
      continue;
    }

    const displayPosition = mapFocusDistributionSlotToDisplayPosition(canonicalSlotKey, previewMode);
    const cellIndex = displayPosition.rowIndex * 3 + displayPosition.columnIndex;
    const cell = cells[cellIndex];
    if (cell.target) {
      unplaced.push({ ...target, targetLabelKey });
      continue;
    }

    cell.target = {
      ...target,
      canonicalSlotKey,
      slotLabelKey: slotByKey[canonicalSlotKey].labelKey,
      targetLabelKey,
    };
  }

  return {
    rows: [0, 1, 2].map((rowIndex) =>
      cells.filter((cell) => cell.rowIndex === rowIndex) as readonly FocusDistributionGridCell[],
    ),
    unplaced,
  };
}
