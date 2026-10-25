import { describe, expect, it } from "vitest";
import {
  decodeGroundGlassPhysicalCocOrientation,
  encodeGroundGlassPhysicalCocOrientation,
  GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16,
  GROUND_GLASS_PHYSICAL_COC_VALIDITY,
  groundGlassPhysicalCocOrientationErrorModuloPi,
  isGroundGlassPhysicalCocRepresentable,
} from "../../render/webgpu/groundGlassPhysicalCocContract";

describe("Ground Glass physical CoC storage contract", () => {
  it("encodes orientation as a normalized unoriented line direction", () => {
    const encoded = encodeGroundGlassPhysicalCocOrientation(-0.2);
    expect(encoded).not.toBeNull();
    expect(encoded!).toBeGreaterThanOrEqual(0);
    expect(encoded!).toBeLessThan(1);
    const decoded = decodeGroundGlassPhysicalCocOrientation(encoded!);
    expect(decoded).not.toBeNull();
    expect(groundGlassPhysicalCocOrientationErrorModuloPi(decoded!, -0.2)).toBeLessThan(1e-12);
    expect(groundGlassPhysicalCocOrientationErrorModuloPi(0.001, Math.PI - 0.001)).toBeCloseTo(0.002, 10);
  });

  it("rejects invalid axes and values outside finite binary16 range without clamping", () => {
    expect(GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16).toBe(65504);
    expect(isGroundGlassPhysicalCocRepresentable(-0.1, 0.04, 0.02)).toBe(true);
    expect(isGroundGlassPhysicalCocRepresentable(65505, 1, 0.5)).toBe(false);
    expect(isGroundGlassPhysicalCocRepresentable(0.1, 0.2, 0.3)).toBe(false);
    expect(isGroundGlassPhysicalCocRepresentable(0.1, 0.2, -0.01)).toBe(false);
    expect(isGroundGlassPhysicalCocRepresentable(Number.NaN, 0.2, 0.1)).toBe(false);
  });

  it("keeps clear depth, invalid geometry, range overflow and focal ambiguity distinct", () => {
    expect(GROUND_GLASS_PHYSICAL_COC_VALIDITY).toEqual({
      noDepth: 0,
      valid: 1,
      outsideBinary16Range: 2,
      invalidGeometry: 3,
      unresolvedFocalBoundary: 4,
    });
  });

  it("rejects malformed normalized orientation values", () => {
    expect(encodeGroundGlassPhysicalCocOrientation(Number.POSITIVE_INFINITY)).toBeNull();
    expect(decodeGroundGlassPhysicalCocOrientation(-0.01)).toBeNull();
    expect(decodeGroundGlassPhysicalCocOrientation(1.01)).toBeNull();
    expect(groundGlassPhysicalCocOrientationErrorModuloPi(Number.NaN, 0)).toBeNull();
  });
});
