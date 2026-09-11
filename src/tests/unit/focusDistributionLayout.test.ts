import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  createFocusDistributionLayout,
  quantizeFocusDistributionDisplayUv,
  type FocusDistributionTarget,
} from "../../components/simulator/focusDistributionLayout";
import {
  mapGroundGlassUvToDisplayUv,
  projectSceneFocusTargetsToGroundGlass,
  type GroundGlassPreviewMode,
} from "../../render/groundGlassTargetProjection";
import { architectureForegroundScene } from "../../scenes/definitions/architecture-foreground";
import { obliqueTabletopScene } from "../../scenes/definitions/oblique-tabletop";
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
) => layout.rows.flat().find((cell) => cell.target?.id === targetId)?.target;

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
        const placedTarget = targetCell(layout, projectedTarget.id);
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
    expect(targetCell(layout, "building-base")?.gridPosition).toEqual(buildingBasePosition);
    expect(buildingMiddlePosition).toEqual(buildingBasePosition);
    expect(targetCell(layout, "building-base")?.gridPosition.columnIndex).toBe(
      buildingMiddlePosition?.columnIndex,
    );
    expect(targetCell(layout, "building-middle")).toBeUndefined();
    expect(layout.unplaced.map((target) => target.id)).toContain("building-middle");

    const rawProjectedTargets = projectedTargetsForScene(architectureForegroundScene, "raw");
    const rawLayout = createFocusDistributionLayout(
      architectureForegroundScene.id,
      toLayoutTargets(rawProjectedTargets),
    );
    for (const targetId of ["building-base", "building-middle"] as const) {
      const uprightTarget = projectedTargets.find((target) => target.id === targetId);
      const rawTarget = rawProjectedTargets.find((target) => target.id === targetId);
      expect(rawTarget?.displayUv).toEqual(
        mapGroundGlassUvToDisplayUv(uprightTarget?.rawUv ?? { u: Number.NaN, v: Number.NaN }, "raw"),
      );
      const rawPosition = quantizeFocusDistributionDisplayUv(
        rawTarget?.displayUv ?? null,
        rawTarget?.visible ?? false,
      );
      if (rawPosition && targetCell(rawLayout, targetId)) {
        expect(targetCell(rawLayout, targetId)?.gridPosition).toEqual(rawPosition);
      } else {
        expect(rawLayout.unplaced.map((target) => target.id)).toContain(targetId);
      }
    }
    for (const target of rawProjectedTargets) {
      const expectedPosition = quantizeFocusDistributionDisplayUv(target.displayUv, target.visible);
      if (!expectedPosition) {
        expect(rawLayout.unplaced.map((unplaced) => unplaced.id)).toContain(target.id);
      } else if (targetCell(rawLayout, target.id)) {
        expect(targetCell(rawLayout, target.id)?.gridPosition).toEqual(expectedPosition);
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

    expect(targetCell(layout, "near")?.gridPosition).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(targetCell(layout, "middle")?.gridPosition).toEqual({ rowIndex: 1, columnIndex: 1 });
    expect(layout.rows.flat().filter((cell) => cell.target)).toHaveLength(2);
  });

  it("preserves a quantization collision without moving a target to a false cell", () => {
    const layout = createFocusDistributionLayout("unknown-scene", [
      { id: "first", sharpnessPercent: 40, displayUv: { u: 0.2, v: 0.2 }, visible: true },
      { id: "second", sharpnessPercent: 60, displayUv: { u: 0.25, v: 0.25 }, visible: true },
    ]);

    expect(targetCell(layout, "first")?.gridPosition).toEqual({ rowIndex: 0, columnIndex: 0 });
    expect(targetCell(layout, "second")).toBeUndefined();
    expect(layout.unplaced.map((target) => target.id)).toEqual(["second"]);
  });

  it("keeps off-frame and unusable targets in the truthful fallback", () => {
    const layout = createFocusDistributionLayout("unknown-scene", [
      { id: "off-frame", sharpnessPercent: 20, displayUv: { u: 0.5, v: 0.5 }, visible: false },
      { id: "invalid", sharpnessPercent: 30, displayUv: { u: Number.NaN, v: 0.5 }, visible: true },
    ]);

    expect(layout.rows.flat().every((cell) => !cell.target)).toBe(true);
    expect(layout.unplaced.map((target) => target.id)).toEqual(["off-frame", "invalid"]);
  });
});
