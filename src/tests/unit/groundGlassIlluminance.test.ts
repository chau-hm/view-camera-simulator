import { describe, expect, it } from "vitest";
import { resolveGroundGlassRelativeIlluminance } from "../../core/optics/groundGlassIlluminance";

describe("Ground Glass relative illuminance", () => {
  it("normalizes f/11 to one", () => {
    expect(resolveGroundGlassRelativeIlluminance(11)).toBe(1);
  });

  it("follows the inverse-square f-number relationship", () => {
    expect(resolveGroundGlassRelativeIlluminance(8)).toBeCloseTo((11 / 8) ** 2, 12);
    expect(resolveGroundGlassRelativeIlluminance(22)).toBeCloseTo(0.25, 12);
    expect(resolveGroundGlassRelativeIlluminance(16)).toBeCloseTo((11 / 16) ** 2, 12);
    expect(resolveGroundGlassRelativeIlluminance(5.6)).toBeCloseTo((11 / 5.6) ** 2, 12);
    expect(resolveGroundGlassRelativeIlluminance(32)).toBeCloseTo((11 / 32) ** 2, 12);
  });

  it("decreases monotonically as the aperture is stopped down", () => {
    const gains = [5.6, 8, 11, 16, 22, 32].map((aperture) =>
      resolveGroundGlassRelativeIlluminance(aperture),
    );

    expect(gains[0]).toBeGreaterThan(gains[1]);
    expect(gains[1]).toBeGreaterThan(gains[2]);
    expect(gains[2]).toBeGreaterThan(gains[3]);
    expect(gains[3]).toBeGreaterThan(gains[4]);
    expect(gains[4]).toBeGreaterThan(gains[5]);
  });
});
