import { describe, expect, it } from "vitest";
import { getVisibleSceneLegendKeys } from "../../render/sceneLegendHelpers";

const input = (overrides: Partial<Parameters<typeof getVisibleSceneLegendKeys>[0]> = {}) => ({
  showFocusPlane: false,
  showDofRegion: false,
  showOpticalGeometry: true,
  hasFiniteImageCircle: true,
  isInfinityFocus: true,
  hasFiniteFarPlane: false,
  ...overrides,
});

describe("Scene Optical Geometry legend visibility", () => {
  it("includes Image Circle only when optical geometry and a finite circle are available", () => {
    expect(getVisibleSceneLegendKeys(input())).toContain("imageCircle");
    expect(getVisibleSceneLegendKeys(input({ hasFiniteImageCircle: false }))).not.toContain("imageCircle");
    expect(getVisibleSceneLegendKeys(input({ showOpticalGeometry: false }))).not.toContain("imageCircle");
  });

  it("keeps existing optical legend entries unchanged", () => {
    expect(getVisibleSceneLegendKeys(input())).toEqual(["film", "lens", "fov", "axis", "imageCircle"]);
  });
});
