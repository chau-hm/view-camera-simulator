import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createFocusDistributionLayout,
  quantizeFocusDistributionDisplayUv,
  type FocusDistributionTarget,
} from "../../components/simulator/focusDistributionLayout";
import {
  projectSceneFocusTargetsToGroundGlass,
  type GroundGlassPreviewMode,
} from "../../render/groundGlassTargetProjection";
import { projectWorldPointToFilmPlaneGroundGlass } from "../../render/groundGlassFilmPlaneProjection";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
import { tableTiltScene } from "../../scenes/definitions/table-tilt";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";
import type { SceneDefinition } from "../../types/scene";

const cameraForScene = (scene: SceneDefinition) => ({
  ...DEFAULT_CAMERA_STATE,
  ...scene.cameraPreset,
  activeSceneId: scene.id,
  activeTaskId: null,
  mode: "free" as const,
});

const projectedTargetsForScene = (
  scene: SceneDefinition,
  previewMode: GroundGlassPreviewMode,
) => {
  const camera = cameraForScene(scene);
  const opticsState = deriveOpticsState(camera, scene);
  return projectSceneFocusTargetsToGroundGlass({
    sceneDef: scene,
    opticsState,
    aperture: camera.aperture,
    previewMode,
  });
};

const toLayoutTargets = (
  projectedTargets: ReturnType<typeof projectedTargetsForScene>,
): FocusDistributionTarget[] =>
  projectedTargets.map((target) => ({
    id: target.id,
    sharpnessPercent: 50,
    status: "soft",
    displayUv: target.displayUv,
    visible: target.visible,
  }));

const targetCell = (
  layout: ReturnType<typeof createFocusDistributionLayout>,
  targetId: string,
) => layout.rows.flat().find((cell) => cell.targets.some((target) => target.id === targetId));

const targetInCell = (
  layout: ReturnType<typeof createFocusDistributionLayout>,
  targetId: string,
) => targetCell(layout, targetId)?.targets.find((target) => target.id === targetId);

describe("focus distribution layout", () => {
  it("quantizes the actual Oblique Tabletop projection in Upright and Raw modes", () => {
    for (const previewMode of ["upright", "raw"] as const) {
      const projectedTargets = projectedTargetsForScene(obliqueTabletopScene, previewMode);
      const layout = createFocusDistributionLayout(
        obliqueTabletopScene.id,
        toLayoutTargets(projectedTargets),
      );

      expect(projectedTargets).toHaveLength(7);
      for (const projectedTarget of projectedTargets) {
        const expectedPosition = quantizeFocusDistributionDisplayUv(
          projectedTarget.displayUv,
          projectedTarget.visible,
        );
        if (!expectedPosition) {
          expect(layout.unplaced.map((target) => target.id)).toContain(projectedTarget.id);
          continue;
        }
        const placedTarget = targetInCell(layout, projectedTarget.id);
        if (placedTarget) {
          expect(placedTarget.gridPosition).toEqual(expectedPosition);
        } else {
          expect(layout.unplaced.map((target) => target.id)).toContain(projectedTarget.id);
        }
      }
    }
  });

  it("uses projected Architecture + Foreground coordinates instead of invented horizontal slots", () => {
    const projectedTargets = projectedTargetsForScene(architectureForegroundScene, "upright");
    const layout = createFocusDistributionLayout(
      architectureForegroundScene.id,
      toLayoutTargets(projectedTargets),
    );
    const buildingBase = projectedTargets.find((target) => target.id === "building-base");
    const buildingMiddle = projectedTargets.find((target) => target.id === "building-middle");

    expect(buildingBase?.visible).toBe(true);
    expect(buildingMiddle?.visible).toBe(true);
    const buildingBasePosition = quantizeFocusDistributionDisplayUv(
      buildingBase?.displayUv ?? null,
      buildingBase?.visible ?? false,
    );
    const buildingMiddlePosition = quantizeFocusDistributionDisplayUv(
      buildingMiddle?.displayUv ?? null,
      buildingMiddle?.visible ?? false,
    );
    expect(targetInCell(layout, "building-base")?.gridPosition).toEqual(buildingBasePosition);
    expect(buildingMiddlePosition).toEqual(buildingBasePosition);
    expect(targetInCell(layout, "building-base")?.gridPosition.columnIndex).toBe(
      buildingMiddlePosition?.columnIndex,
    );
    expect(targetCell(layout, "building-base")?.targets.map((target) => target.id)).toEqual([
      "building-middle",
      "building-base",
    ]);
    expect(targetInCell(layout, "building-middle")?.gridPosition).toEqual(buildingMiddlePosition);
    expect(layout.unplaced.map((target) => target.id)).not.toContain("building-middle");

    const rawProjectedTargets = projectedTargetsForScene(architectureForegroundScene, "raw");
    const rawLayout = createFocusDistributionLayout(
      architectureForegroundScene.id,
      toLayoutTargets(rawProjectedTargets),
    );
    for (const targetId of ["building-base", "building-middle"] as const) {
      const uprightTarget = projectedTargets.find((target) => target.id === targetId);
      const rawTarget = rawProjectedTargets.find((target) => target.id === targetId);
      expect(rawTarget?.displayUv).toEqual(uprightTarget?.rawUv);
      const rawPosition = quantizeFocusDistributionDisplayUv(
        rawTarget?.displayUv ?? null,
        rawTarget?.visible ?? false,
      );
      if (rawPosition && targetInCell(rawLayout, targetId)) {
        expect(targetInCell(rawLayout, targetId)?.gridPosition).toEqual(rawPosition);
      } else {
        expect(rawLayout.unplaced.map((target) => target.id)).toContain(targetId);
      }
    }
    for (const target of rawProjectedTargets) {
      const expectedPosition = quantizeFocusDistributionDisplayUv(target.displayUv, target.visible);
      if (!expectedPosition) {
        expect(rawLayout.unplaced.map((unplaced) => unplaced.id)).toContain(target.id);
      } else if (targetInCell(rawLayout, target.id)) {
        expect(targetInCell(rawLayout, target.id)?.gridPosition).toEqual(expectedPosition);
      } else {
        expect(rawLayout.unplaced.map((unplaced) => unplaced.id)).toContain(target.id);
      }
    }
  });

  it("keeps partial target data sparse and does not fabricate positions", () => {
    const layout = createFocusDistributionLayout("unknown-scene", [
      { id: "near", sharpnessPercent: 35, status: "soft", displayUv: { u: 0.1, v: 0.1 }, visible: true },
      { id: "middle", sharpnessPercent: 75, status: "acceptable", displayUv: { u: 0.5, v: 0.5 }, visible: true },
    ]);

    expect(targetInCell(layout, "near")?.gridPosition).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(targetInCell(layout, "middle")?.gridPosition).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(layout.rows.flat().filter((cell) => cell.targets.length > 0)).toHaveLength(2);
  });

  it("keeps a quantization collision in one cell with deterministic spatial order", () => {
    const layout = createFocusDistributionLayout("unknown-scene", [
      { id: "first", sharpnessPercent: 40, displayUv: { u: 0.2, v: 0.2 }, visible: true },
      { id: "second", sharpnessPercent: 60, displayUv: { u: 0.25, v: 0.25 }, visible: true },
    ]);

    expect(targetCell(layout, "first")?.targets.map((target) => target.id)).toEqual([
      "first",
      "second",
    ]);
    expect(targetInCell(layout, "first")?.gridPosition).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(targetInCell(layout, "second")?.gridPosition).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(layout.unplaced).toEqual([]);
  });

  it("keeps all three Table Tilt targets in their real coarse region and follows the renderer orientation", () => {
    const camera = cameraForScene(tableTiltScene);
    const opticsState = deriveOpticsState(camera, tableTiltScene);
    const expectedDisplayUv = (rawUv: { u: number; v: number }, previewMode: GroundGlassPreviewMode) =>
      // Independent renderer oracle: the RTT composite samples the raw scene
      // with a 180-degree flip for Raw output, so physical film coordinates
      // appear directly in Raw and are flipped only for Upright Assist.
      previewMode === "raw"
        ? rawUv
        : { u: 1 - rawUv.u, v: 1 - rawUv.v };

    const layouts = (['raw', 'upright'] as const).map((previewMode) => {
      const projected = projectSceneFocusTargetsToGroundGlass({
        sceneDef: tableTiltScene,
        opticsState,
        aperture: camera.aperture,
        previewMode,
      });
      const expected = tableTiltScene.focusTargets.map((target) => {
        const physical = projectWorldPointToFilmPlaneGroundGlass({
          worldPoint: target.worldPosition,
          lensCenterWorld: opticsState.lensCenterWorld,
          filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
        });
        return {
          id: target.id,
          visible: physical.visible,
          displayUv: expectedDisplayUv({ u: physical.uRaw, v: physical.vRaw }, previewMode),
        };
      });

      projected.forEach((target, index) => {
        const physical = projectWorldPointToFilmPlaneGroundGlass({
          worldPoint: tableTiltScene.focusTargets[index].worldPosition,
          lensCenterWorld: opticsState.lensCenterWorld,
          filmPlaneCornersWorld: opticsState.filmPlaneCornersWorld,
        });
        expect(target.rawUv.u).toBeCloseTo(physical.uRaw, 10);
        expect(target.rawUv.v).toBeCloseTo(physical.vRaw, 10);
        expect(target.displayUv.u).toBeCloseTo(expected[index].displayUv.u, 10);
        expect(target.displayUv.v).toBeCloseTo(expected[index].displayUv.v, 10);
        expect(target.visible).toBe(expected[index].visible);
      });

      const layout = createFocusDistributionLayout(
        tableTiltScene.id,
        projected.map((target) => ({
          id: target.id,
          sharpnessPercent: 50,
          displayUv: target.displayUv,
          visible: target.visible,
        })),
      );
      expect(layout.unplaced).toEqual([]);
      expect(layout.rows.flat().filter((cell) => cell.targets.length > 0)).toHaveLength(1);
      const expectedOrder = expected
        .filter((target) => target.visible)
        .sort((first, second) =>
          first.displayUv.v - second.displayUv.v ||
          first.displayUv.u - second.displayUv.u ||
          first.id.localeCompare(second.id),
        )
        .map((target) => target.id);
      expect(layout.rows.flat().find((cell) => cell.targets.length > 0)?.targets.map((target) => target.id)).toEqual(expectedOrder);
      return layout;
    });

    const rawTarget = targetInCell(layouts[0], "near-cup");
    const uprightTarget = targetInCell(layouts[1], "near-cup");
    expect(rawTarget?.gridPosition).toEqual({ rowIndex: 0, columnIndex: 1 });
    expect(uprightTarget?.gridPosition).toEqual({ rowIndex: 2, columnIndex: 1 });
  });

  it("keeps off-frame and unusable targets in the truthful fallback", () => {
    const layout = createFocusDistributionLayout("unknown-scene", [
      { id: "off-frame", sharpnessPercent: 20, displayUv: { u: 0.5, v: 0.5 }, visible: false },
      { id: "invalid", sharpnessPercent: 30, displayUv: { u: Number.NaN, v: 0.5 }, visible: true },
    ]);

    expect(layout.rows.flat().every((cell) => cell.targets.length === 0)).toBe(true);
    expect(layout.unplaced.map((target) => target.id)).toEqual(["off-frame", "invalid"]);
  });
});
