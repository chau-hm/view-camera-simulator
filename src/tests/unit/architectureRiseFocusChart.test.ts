import { describe, it, expect } from "vitest";
import geometry from "../../scenes/architectureRiseGeometry";
import { architectureRiseScene } from "../../scenes/definitions/architecture-rise";

describe("Architecture Rise focus chart canonicalization", () => {
  it("scene focus target equals canonical focusChart.center", () => {
    const sceneTarget = architectureRiseScene.focusTargets[0].worldPosition;
    const chartCenter = geometry.focusChart.center;
    expect(sceneTarget).toEqual(chartCenter);
  });

  it("focusChart center equals legacy focusTarget.worldPosition (sanity)", () => {
    // geometry.focusTarget was the previous source of truth; focusChart should derive from it
    expect(geometry.focusTarget.worldPosition).toEqual(geometry.focusChart.center);
  });
});
