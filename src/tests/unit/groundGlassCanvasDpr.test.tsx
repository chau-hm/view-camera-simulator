import { describe, expect, it } from "vitest";
import { getRenderQualitySettings } from "../../render/renderQuality";

describe("GroundGlass render quality settings", () => {
  it("maps profiles to expected DPR values", () => {
    const low = getRenderQualitySettings("low");
    const standard = getRenderQualitySettings("standard");
    const high = getRenderQualitySettings("high");

    expect(low.dpr).toBe(1);
    expect(standard.dpr).toBe(1.5);
    expect(high.dpr).toBe(2);
  });
});
