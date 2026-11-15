import { describe, expect, it } from "vitest";
import { taskRegistry } from "../../core/tasks/taskRegistry";
import geometry from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";

describe("Architecture Rise v2 locked contracts", () => {
  it("retains the canonical building, stage, composition, and focus anchors", () => {
    expect(geometry.ground.y).toBe(-1200);
    expect(geometry.building).toMatchObject({
      center: { x: 0, y: 900, z: 9500 },
      width: 2800,
      height: 4200,
      topHeight: 650,
      depth: 1200,
    });
    expect(geometry.facade).toMatchObject({
      mainBodyBottomY: -1200,
      mainBodyTopY: 3000,
      frontFacadeZ: 8900,
      backFacadeZ: 10100,
      parapetBottomY: 3000,
      parapetTopY: 3650,
    });
    expect(geometry.sceneBounds).toEqual({
      min: { x: -3900, y: -1500, z: -1800 },
      max: { x: 3900, y: 4050, z: 13000 },
    });
    expect(geometry.compositionTargets.buildingTop).toEqual({
      min: { x: -900, y: 2920, z: 8500 },
      max: { x: 900, y: 3730, z: 10500 },
    });
    expect(geometry.compositionTargets.buildingMain).toEqual({
      min: { x: -1400, y: -1000, z: 8300 },
      max: { x: 1400, y: 2600, z: 11500 },
    });
    expect(architectureRiseScene.id).toBe("architecture-rise");
    expect(architectureRiseScene.focusTargets[0]?.worldPosition).toEqual({ x: 0, y: 900, z: 8890 });
  });

  it("retains the exact checkerboard and full fine-detail assembly", () => {
    expect(geometry.focusChart).toMatchObject({
      targetWorldPosition: { x: 0, y: 900, z: 8890 },
      sizeMm: 750,
      cells: 8,
      cellDepthMm: 2,
      crosshairLengthMm: 180,
      crosshairThicknessMm: 16,
      crosshairDepthMm: 3,
      markerOffsetMm: 3,
    });
    expect(geometry.getArchitectureFocusChartCells()).toHaveLength(64);
    expect(geometry.getArchitectureFocusChartBars()).toHaveLength(2);

    expect(geometry.facadeFineDetail).toMatchObject({
      center: { x: 820, y: 2200 },
      width: 360,
      height: 420,
      panelDepth: 14,
      frameThickness: 18,
      frameDepth: 18,
      frameColumns: 4,
      frameRows: 4,
      fineLineCount: 6,
      fineLineHeight: 5,
      fineLineWidth: 300,
      fineLineRegionHeight: 150,
      fineLineDepth: 10,
      surfaceGap: 2,
    });
    const pieces = geometry.getArchitectureFacadeFineDetailPieces();
    expect(pieces).toHaveLength(15);
    expect(pieces[0]).toMatchObject({
      id: "architecture-rise-facade-fine-detail-panel",
      role: "panel",
      x: 820,
      y: 2200,
      z: 8891,
      width: 360,
      height: 420,
      depth: 14,
    });
    expect(pieces.filter(({ role }) => role === "frame")).toHaveLength(8);
    const lines = pieces.filter(({ role }) => role === "fine");
    expect(lines).toHaveLength(6);
    expect(lines.map(({ id }) => id)).toEqual([
      "architecture-rise-facade-fine-detail-line-1",
      "architecture-rise-facade-fine-detail-line-2",
      "architecture-rise-facade-fine-detail-line-3",
      "architecture-rise-facade-fine-detail-line-4",
      "architecture-rise-facade-fine-detail-line-5",
      "architecture-rise-facade-fine-detail-line-6",
    ]);
    expect(lines[1]).toMatchObject({ x: 820, z: 8877, width: 300, height: 5, depth: 10 });
    expect(lines[1]?.y).toBeCloseTo(2232.142857142857, 10);
  });

  it("keeps camera, focus range, public movement steps, and rise-task outcomes", () => {
    expect(CAMERA_CONSTANTS).toMatchObject({
      focalLengthMm: 150,
      filmWidthMm: 127,
      filmHeightMm: 101.6,
      riseMinMm: 0,
      riseMaxMm: 40,
      tiltMinDeg: -10,
      tiltMaxDeg: 10,
      swingMinDeg: -10,
      swingMaxDeg: 10,
    });
    expect(CAMERA_CONTROL_STEPS).toMatchObject({ riseMm: 1, tiltDeg: 0.1, swingDeg: 0.1, focusDistanceMm: 10 });
    expect(architectureRiseScene.cameraPreset).toMatchObject({
      focusDistanceMm: 8890,
      aperture: 11,
      frontRiseMm: 0,
      frontTiltDeg: 0,
      frontSwingDeg: 0,
      rearRiseMm: 0,
      rearShiftMm: 0,
      rearTiltDeg: 0,
      rearSwingDeg: 0,
    });
    expect(architectureRiseScene.focusDistanceRangeMm).toEqual({ min: 3090, max: 13000 });
    expect(taskRegistry["rise-01"]).toMatchObject({
      sceneId: "architecture-rise",
      enabledControls: ["rise", "focusDistance", "aperture", "geometryView"],
      criteria: [
        { id: "rise-building-top-visible", minimumCoverage: 0.95 },
        { id: "rise-building-main-visible", minimumCoverage: 0.7 },
        { id: "rise-movement-used", minimumAbs: 12 },
        { id: "rise-movement-range", min: 12, max: 35 },
      ],
    });
  });
});
