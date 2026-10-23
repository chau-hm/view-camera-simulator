import { describe, expect, it } from "vitest";
import {
  analyzeInteriorCocPreflight,
  measurePhaseLQuality,
  PHASE_L_CANDIDATES,
  PHASE_L_INTERIOR_TARGETS,
  resolvePhaseLCandidateWindow,
} from "../e2e/fixtures/ground-glass-webgpu-interior-coc-cases";

describe("Phase L interior large-CoC preflight", () => {
  it("uses the canonical normalized pan direction and a bounded geometry-only candidate set", () => {
    expect(PHASE_L_CANDIDATES).toHaveLength(12);
    expect(PHASE_L_CANDIDATES.map((candidate) => candidate.magnification)).toEqual([
      8, 8, 8, 8, 12, 12, 12, 12, 16, 16, 16, 16,
    ]);
    const center = resolvePhaseLCandidateWindow(PHASE_L_CANDIDATES[0]!);
    expect(center).toMatchObject({ active: true, widthFraction: 1 / 8, centerU: 0.5, centerV: 0.5 });
    const positive = resolvePhaseLCandidateWindow({ id: "positive", magnification: 8, pan: { x: 1, y: 1 } });
    const negative = resolvePhaseLCandidateWindow({ id: "negative", magnification: 8, pan: { x: -1, y: -1 } });
    expect(positive.centerU).toBeLessThan(0.5);
    expect(positive.centerV).toBeLessThan(0.5);
    expect(negative.centerU).toBeGreaterThan(0.5);
    expect(negative.centerV).toBeGreaterThan(0.5);
  });

  it("counts only physically capped interior far-edge pixels and excludes border-touching support", () => {
    const width = 64;
    const height = 64;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        const isInteriorCap = x >= 16 && x <= 47 && y >= 16 && y <= 47;
        const isBorderCap = x >= 4 && x <= 10 && y === 0;
        const capped = isInteriorCap || isBorderCap;
        world[offset + 2] = x < 32 ? 100 : 120;
        world[offset + 3] = 0.5;
        physical[offset] = x < 32 ? -1 : 1;
        source[offset] = x < 32 ? 0.1 : 0.8;
        source[offset + 1] = 0.2;
        source[offset + 2] = x < 32 ? 0.3 : 0.9;
        radius[offset] = capped ? 20 : 4;
        radius[offset + 1] = capped ? 0.6 : 1;
      }
    }
    const result = analyzeInteriorCocPreflight({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.counts.interiorCapPixels).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumInteriorCapPixels);
    expect(result.counts.largestInteriorCapComponentPixels).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumLargestInteriorCapComponent);
    expect(result.counts.interiorCapFarDepthEdgePixels).toBe(32);
    expect(result.counts.capFarDepthEdgePairs).toBe(32);
    expect(result.counts.highContrastFarDepthEdgePairs).toBe(32);
    expect(result.counts.capPixels).toBeGreaterThan(result.counts.interiorCapPixels);
    expect(result.borderClearance.minimumCapBorderDistancePx).toBe(0);
    expect(result.borderClearance.minimumInteriorCapBorderDistancePx).toBeGreaterThanOrEqual(16);
    expect(result.counts.uncappedReferenceClearCapPixels).toBe(400);
    expect(result.borderClearance.minimumUncappedClearCapBorderDistancePx).toBe(22);
    expect(result.largestInteriorCapComponent.bounds).toEqual({ left: 16, top: 16, right: 47, bottom: 47 });
    expect(result.edgePairs.every((pair) => pair.farSideCapPixel)).toBe(true);
    expect(result.edgePairs.every((pair) => pair.a.signedCoCMm * pair.b.signedCoCMm <= 0)).toBe(true);
    expect(result.candidateQualified).toBe(true);
  });

  it("does not qualify a border-only cap region as an interior stress case", () => {
    const width = 40;
    const height = 32;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        world[offset + 2] = x < 20 ? 100 : 200;
        physical[offset] = 1;
        const borderCap = y < 10;
        radius[offset] = borderCap ? 18 : 4;
        radius[offset + 1] = borderCap ? 0.6 : 1;
      }
    }
    const result = analyzeInteriorCocPreflight({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.counts.capPixels).toBeGreaterThan(0);
    expect(result.counts.interiorCapPixels).toBe(0);
    expect(result.counts.interiorCapFarDepthEdgePixels).toBe(0);
    expect(result.candidateQualified).toBe(false);
  });

  it("measures far-only interior cap edges separately from near edges and composites", () => {
    const width = 64;
    const height = 64;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    const referenceFar = new Float32Array(size * 4);
    const candidateFar = new Float32Array(size * 4);
    const near = new Float32Array(size * 4);
    const referenceComposite = new Float32Array(size * 4);
    const candidateComposite = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        const far = x >= 32;
        const capped = x >= 16 && x <= 47 && y >= 16 && y <= 47;
        world[offset + 2] = far ? 120 : 100;
        physical[offset] = far ? 1 : -1;
        radius[offset] = capped ? 14 : 8;
        source[offset] = far ? 0.8 : 0.1;
        source[offset + 1] = 0.2;
        source[offset + 2] = far ? 0.9 : 0.3;
        source[offset + 3] = 1;
        referenceFar.set(source.subarray(offset, offset + 4), offset);
        candidateFar.set(source.subarray(offset, offset + 4), offset);
        candidateFar[offset] += 0.02;
        near[offset] = 0.2;
        near[offset + 1] = 0.1;
        near[offset + 2] = 0.05;
        near[offset + 3] = 0;
        referenceComposite.set(referenceFar.subarray(offset, offset + 4), offset);
        candidateComposite.set(candidateFar.subarray(offset, offset + 4), offset);
      }
    }
    const result = measurePhaseLQuality({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      referenceFarRgba: referenceFar,
      candidateFarRgba: candidateFar,
      referenceCompositeRgba: referenceComposite,
      candidateCompositeRgba: candidateComposite,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      sourceFallbackMask: new Uint8Array(size),
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.farQuality.interiorCap12FarDepthEdge.rgb.pixelCount).toBe(64);
    expect(result.farQuality.interiorCap12FarDepthEdge.rgb.rgbRootMeanSquareError).toBeGreaterThan(0);
    expect(result.finalCompositeQuality.interiorCap12FarDepthEdge.rgb.pixelCount).toBe(64);
    expect(result.farQuality.cap12NearDepthEdge.rgb.pixelCount).toBe(64);
  });
});
