import { describe, it, expect } from "vitest";
import geometry from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";

describe("Architecture Rise focus chart canonicalization and helpers", () => {
  it("scene focus target equals canonical focusChart.targetWorldPosition", () => {
    const sceneTarget = architectureRiseScene.focusTargets[0].worldPosition;
    const chartTarget = geometry.focusChart.targetWorldPosition;
    expect(sceneTarget).toEqual(chartTarget);
  });

  it("target, surface and marker share X and Y and have explicit Z offsets", () => {
    const t = geometry.focusChart.targetWorldPosition;
    const s = geometry.focusChart.surfaceCenterWorld;
    const m = geometry.focusChart.markerCenterWorld;
    expect(t.x).toBe(s.x);
    expect(t.y).toBe(s.y);
    expect(t.x).toBe(m.x);
    expect(t.y).toBe(m.y);
    // marker should be slightly in front of surface by markerOffsetMm
    expect(s.z - m.z).toBeCloseTo(geometry.focusChart.markerOffsetMm, 6);
    // surface z should differ from target z (target is physical focus point, surface in front)
    expect(t.z).not.toBe(s.z);
  });

  it("helpers produce expected cell and bar counts and sane values", () => {
    const cells = geometry.getArchitectureFocusChartCells();
    const bars = geometry.getArchitectureFocusChartBars();
    expect(cells.length).toBe(geometry.focusChart.cells * geometry.focusChart.cells);
    expect(bars.length).toBe(2);
    // verify bounds and alternation
    const xs = cells.map((c) => c.x);
    const ys = cells.map((c) => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    expect(centerX).toBeCloseTo(geometry.focusChart.surfaceCenterWorld.x, 6);
    expect(centerY).toBeCloseTo(geometry.focusChart.surfaceCenterWorld.y, 6);
    // sizes positive
    cells.forEach((c) => {
      expect(Number.isFinite(c.width) && c.width > 0).toBe(true);
      expect(Number.isFinite(c.height) && c.height > 0).toBe(true);
    });
    // verify crosshair bars intersect at marker centre
    bars.forEach((b) => {
      expect(Number.isFinite(b.x)).toBe(true);
      expect(Number.isFinite(b.y)).toBe(true);
      expect(Number.isFinite(b.z)).toBe(true);
      expect(b.x).toBeCloseTo(geometry.focusChart.markerCenterWorld.x, 6);
      expect(b.y).toBeCloseTo(geometry.focusChart.markerCenterWorld.y, 6);
    });
  });
});
