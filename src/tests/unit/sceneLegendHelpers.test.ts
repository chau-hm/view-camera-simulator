import { describe, expect, it } from "vitest";
import { getVisibleSceneLegendKeys } from "../../render/sceneLegendHelpers";

const input = (overrides: Partial<Parameters<typeof getVisibleSceneLegendKeys>[0]> = {}) => ({
  showFocusPlane: false,
  showDofRegion: false,
  showOpticalGeometry: true,
  finiteCoverageKind: "parallel-circle" as const,
  isInfinityFocus: true,
  hasFiniteFarPlane: false,
  ...overrides,
});

describe("Scene Optical Geometry legend visibility", () => {
  it("shows exactly the legend for the current finite-coverage shape", () => {
    expect(getVisibleSceneLegendKeys(input())).toContain("imageCircle");
    expect(getVisibleSceneLegendKeys(input({ finiteCoverageKind: "nonparallel-conic" })))
      .toContain("coverageFootprint");
    expect(getVisibleSceneLegendKeys(input({ finiteCoverageKind: "nonparallel-conic" })))
      .not.toContain("imageCircle");
    expect(getVisibleSceneLegendKeys(input({ finiteCoverageKind: null })))
      .not.toContain("imageCircle");
    expect(getVisibleSceneLegendKeys(input({ finiteCoverageKind: null })))
      .not.toContain("coverageFootprint");
    expect(getVisibleSceneLegendKeys(input({ showOpticalGeometry: false }))).not.toContain("imageCircle");
    expect(getVisibleSceneLegendKeys(input({
      showOpticalGeometry: false,
      finiteCoverageKind: "nonparallel-conic",
    }))).not.toContain("coverageFootprint");
  });

  it("keeps existing optical legend entries unchanged", () => {
    expect(getVisibleSceneLegendKeys(input())).toEqual(["film", "lens", "fov", "axis", "imageCircle"]);
  });
});
