import { describe, expect, it } from "vitest";
import {
  assessGroundGlassPhysicalDepthConfidence,
  decodeGroundGlassPhysicalCocOrientation,
  encodeGroundGlassPhysicalCocOrientation,
  GROUND_GLASS_PHYSICAL_COC_MAX_BINARY16,
  GROUND_GLASS_PHYSICAL_COC_VALIDITY,
  groundGlassPhysicalCocOrientationErrorModuloPi,
  isGroundGlassPhysicalCocRepresentable,
} from "../../render/webgpu/groundGlassPhysicalCocContract";

describe("Ground Glass physical CoC storage contract", () => {
  it("keeps physical depth confidence separate and scoped to a paired reference probe", () => {
    const input = {
      expectedWorldM: [0, 0, 0.2] as const,
      reconstructedWorldM: [0, 0, 0.199999] as const,
      expectedSurfaceId: "analytic-plane-a",
      lensCenterWorldM: [0, 0, 0] as const,
      lensNormal: [0, 0, 1] as const,
      focalLengthMm: 100,
      sampledDepth: 0.5,
      controlledObjectPoint: false,
      kernelBranchCode: 3,
    };
    const resolved = assessGroundGlassPhysicalDepthConfidence(input);
    expect(resolved.status).toBe("resolved");
    expect(resolved.scope).toBe("probe-only");
    expect(resolved.status === "not-assessed" ? null : resolved.canonicalUMinusFmm).toBe(100);
    expect(resolved.status === "not-assessed" ? null : resolved.reconstructedUMinusFmm).toBeCloseTo(99.999, 9);

    const inverted = assessGroundGlassPhysicalDepthConfidence({
      ...input,
      expectedWorldM: [0, 0, 0.100001] as const,
      reconstructedWorldM: [0, 0, 0.099999512] as const,
      kernelBranchCode: 1,
    });
    expect(inverted).toMatchObject({
      status: "depth-limited",
      scope: "probe-only",
      canonicalExpectedBranch: "finite-real",
      reconstructedBranch: "finite-virtual",
      kernelSelectedBranch: "finite-virtual",
    });
    if (inverted.status !== "not-assessed") {
      expect(inverted.signedReconstructionErrorMm).toBeCloseTo(-0.001488, 7);
      expect(inverted.observedUMinusFIntervalMm[0]).toBeLessThan(0);
      expect(inverted.observedUMinusFIntervalMm[1]).toBeGreaterThan(0);
    }
  });

  it("treats an exact reconstructed U=f boundary as depth-limited and preserves near-clip evidence", () => {
    const exactBoundary = assessGroundGlassPhysicalDepthConfidence({
      expectedWorldM: [0, 0, 0.100001] as const,
      reconstructedWorldM: [0, 0, 0.1] as const,
      expectedSurfaceId: "analytic-plane-boundary",
      lensCenterWorldM: [0, 0, 0] as const,
      lensNormal: [0, 0, 1] as const,
      focalLengthMm: 100,
      sampledDepth: 0.999999,
      controlledObjectPoint: false,
      kernelBranchCode: 2,
    });
    expect(exactBoundary).toMatchObject({
      status: "depth-limited",
      scope: "probe-only",
      canonicalExpectedBranch: "finite-real",
      reconstructedBranch: "parallel-limit",
      kernelSelectedBranch: "parallel-limit",
    });
    if (exactBoundary.status !== "not-assessed") {
      expect(exactBoundary.observedUMinusFIntervalMm[0]).toBe(0);
      expect(exactBoundary.observedUMinusFIntervalMm[1]).toBeGreaterThan(0);
    }
  });

  it("does not assess unreferenced, controlled, or clear-depth samples", () => {
    const input = {
      expectedWorldM: null,
      reconstructedWorldM: [0, 0, 1] as const,
      expectedSurfaceId: null,
      lensCenterWorldM: [0, 0, 0] as const,
      lensNormal: [0, 0, 1] as const,
      focalLengthMm: 100,
      sampledDepth: 0.5,
      controlledObjectPoint: false,
      kernelBranchCode: 3,
    };
    expect(assessGroundGlassPhysicalDepthConfidence(input)).toMatchObject({ status: "not-assessed", reason: "no-independent-reference" });
    expect(assessGroundGlassPhysicalDepthConfidence({ ...input, controlledObjectPoint: true }))
      .toMatchObject({ status: "not-assessed", reason: "controlled-object-point" });
    expect(assessGroundGlassPhysicalDepthConfidence({ ...input, sampledDepth: 1 }))
      .toMatchObject({ status: "not-assessed", reason: "clear-depth" });
  });

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
