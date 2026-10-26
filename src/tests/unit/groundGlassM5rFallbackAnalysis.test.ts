import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_B1_FALLBACK_REASON,
} from "../../render/webgpu/groundGlassB1Reference";
import {
  analyzeGroundGlassM5rFallbacks,
  GROUND_GLASS_M5R_BOUNDARY_DIFFERENCE_THRESHOLD,
  GROUND_GLASS_M5R_MEANINGFUL_BLUR_FLOOR,
  type GroundGlassM5rFallbackAnalysis,
} from "../../render/webgpu/groundGlassM5rFallbackAnalysis";
import type {
  GroundGlassApertureGatherR3Capture,
  GroundGlassApertureGatherR3CaptureMatrix,
  GroundGlassR3QualityMode,
} from "../../render/webgpu/groundGlassApertureGatherQuality";

const dimensions = { widthPx: 8, heightPx: 8 } as const;
const sourcePixels = dimensions.widthPx * dimensions.heightPx;
const film = { widthMm: 36, heightMm: 24 } as const;

const pixelOffset = (x: number, y: number): number => (y * dimensions.widthPx + x) * 4;
const pixelIndex = (x: number, y: number): number => y * dimensions.widthPx + x;

const makeCapture = (
  qualityMode: GroundGlassR3QualityMode,
  captureId: string,
): GroundGlassApertureGatherR3Capture => {
  const gatherScale = qualityMode === "half32" ? 0.5 : 1;
  const gatherDimensions = {
    widthPx: Math.round(dimensions.widthPx * gatherScale),
    heightPx: Math.round(dimensions.heightPx * gatherScale),
  };
  const gatherPixels = gatherDimensions.widthPx * gatherDimensions.heightPx;
  const sourceRgba = new Float32Array(sourcePixels * 4);
  const farReference = new Float32Array(sourcePixels * 4);
  const physicalRgba = new Float32Array(sourcePixels * 4);
  const validity = new Uint8Array(sourcePixels).fill(1);
  const depth = new Float32Array(sourcePixels);
  for (let y = 0; y < dimensions.heightPx; y += 1) {
    for (let x = 0; x < dimensions.widthPx; x += 1) {
      const pixel = pixelIndex(x, y);
      const sourceValue = (x + y) % 2 === 0 ? 0.1 : 0.9;
      sourceRgba.set([sourceValue, sourceValue, sourceValue, 1], pixel * 4);
      farReference.set([0.5, 0.5, 0.5, 1], pixel * 4);
      physicalRgba.set([x === 0 ? -0.5 : 0.5, 5, 2, 0.1], pixel * 4);
      depth[pixel] = y < 4 ? 0.4 : 0.8;
    }
  }
  const b1FarRgba = farReference.slice();
  const b1DecisionRgba = new Uint8Array(sourcePixels * 4);
  for (let pixel = 0; pixel < sourcePixels; pixel += 1) b1DecisionRgba.set([1, 0, 1, 255], pixel * 4);
  const farGatherRgba = new Float32Array(gatherPixels * 4);
  for (let pixel = 0; pixel < gatherPixels; pixel += 1) farGatherRgba.set([0.5, 0.5, 0.5, 1], pixel * 4);
  const zeroGather = new Float32Array(gatherPixels * 4);
  const observedSelectedGatherIds = new Int32Array(sourcePixels * 2);
  const observedGatherCenterSourceIds = new Int32Array(gatherPixels * 2);

  return {
    captureId,
    requestId: `request-${captureId}`,
    sceneId: "architecture-rise",
    sceneSourceRevision: "architecture-rise-m5r-test-r1",
    effectiveOpticalRequestFingerprint: "focus-f8-camera-state-a",
    cameraStateFingerprint: "camera-matrix-a",
    readbackOrigin: "top",
    qualityMode,
    sourceDimensions: dimensions,
    gatherDimensions,
    sampledFilmDimensionsMm: film,
    sampleCount: qualityMode === "full64" ? 64 : 32,
    maximumRadiusPx: 12,
    colorDomain: "source-target-readback-values",
    targetFormats: {
      sourceColor: "rgba8unorm",
      physical: "rgba16float",
      validity: "rgba8unorm",
      far: "rgba16float",
      near: "rgba16float",
      b1: "rgba16float",
    },
    reportedRadiusEvidence: { maximumUncappedRadiusPx: 3, cappedPixelCount: 0 },
    readbackBuffers: {
      sourceRgba,
      depth,
      physicalRgba,
      validity,
      farGatherRgba,
      b1FarRgba,
      nearBeforeB1Rgba: zeroGather.slice(),
      nearAfterB1Rgba: zeroGather.slice(),
      nearCpuReferenceRgba: zeroGather.slice(),
      observedSelectedGatherIds,
      observedGatherCenterSourceIds,
      b1DecisionRgba,
    },
  };
};

const makeMatrix = (): GroundGlassApertureGatherR3CaptureMatrix => ({
  half32: makeCapture("half32", "half32-a"),
  full32: makeCapture("full32", "full32-a"),
  full64: makeCapture("full64", "full64-a"),
});

const setGpuReason = (
  capture: GroundGlassApertureGatherR3Capture,
  pixel: number,
  reason: number,
  options: Readonly<{ copySourceToB1?: boolean }> = {},
): void => {
  const offset = pixel * 4;
  const accepted = reason === GROUND_GLASS_B1_FALLBACK_REASON.farGatherAccepted;
  capture.readbackBuffers.b1DecisionRgba.set([accepted ? 1 : 0, reason, accepted ? 1 : 0, 255], offset);
  if (!accepted && options.copySourceToB1 !== false) {
    capture.readbackBuffers.b1FarRgba.set(
      capture.readbackBuffers.sourceRgba.subarray(offset, offset + 4), offset,
    );
  }
};

const addReasonTaxonomy = (capture: GroundGlassApertureGatherR3Capture): void => {
  setGpuReason(capture, pixelIndex(0, 2), GROUND_GLASS_B1_FALLBACK_REASON.missingOrOutOfBoundsProvenance);
  setGpuReason(capture, pixelIndex(1, 2), GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterProvenanceMismatch);
  setGpuReason(capture, pixelIndex(2, 3), GROUND_GLASS_B1_FALLBACK_REASON.invalidOrUnresolvedCenter);
  setGpuReason(capture, pixelIndex(3, 4), GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible);
  setGpuReason(capture, pixelIndex(6, 6), GROUND_GLASS_B1_FALLBACK_REASON.unusableGatherData);
};

const matrixWithAllFallbackReasons = (): GroundGlassApertureGatherR3CaptureMatrix => {
  const matrix = makeMatrix();
  addReasonTaxonomy(matrix.half32);
  return matrix;
};

const setSourcePixelAcrossMatrix = (
  matrix: GroundGlassApertureGatherR3CaptureMatrix,
  x: number,
  y: number,
  value: number,
): void => {
  const offset = pixelOffset(x, y);
  for (const capture of [matrix.half32, matrix.full32, matrix.full64]) {
    capture.readbackBuffers.sourceRgba.set([value, value, value, 1], offset);
  }
};

const replaceEveryB1PixelWithSource = (capture: GroundGlassApertureGatherR3Capture): void => {
  capture.readbackBuffers.b1FarRgba.set(capture.readbackBuffers.sourceRgba);
};

const computeHistoricalRelativeMean = (analysis: GroundGlassM5rFallbackAnalysis): number => {
  const fallback = analysis.fallbackBoundaryGradient;
  return fallback.historicalRelativeMeanError ?? Number.NaN;
};

describe("M5R B1 GPU-reason fallback analysis", () => {
  it("B1: counts every actual GPU reason byte and keeps accepted pixels separate from fallbacks", () => {
    const matrix = matrixWithAllFallbackReasons();
    const result = analyzeGroundGlassM5rFallbacks(matrix);

    expect(result.reasonCounts).toEqual({
      farGatherAccepted: sourcePixels - 5,
      missingOrOutOfBoundsProvenance: 1,
      selectedCenterProvenanceMismatch: 1,
      invalidOrUnresolvedCenter: 1,
      selectedCenterNotFarEligible: 1,
      unusableGatherData: 1,
    });
    expect(result.fallbackSummary.pixelCount).toBe(5);
    expect(result.fallbackSummary.meaningfulBlurFraction).toBe(1);
    expect(result.byReason.selectedCenterNotFarEligible.reasonName)
      .toBe("selected-center-not-far-eligible");
    expect(result.byReason.farGatherAccepted.fallbackPixelCount).toBe(0);
    expect(result.byReason.unusableGatherData.fallbackPixelCount).toBe(1);
    expect(analyzeGroundGlassM5rFallbacks(makeMatrix()).fallbackSummary.meaningfulBlurFraction).toBeNull();
  });

  it("B2: reports meaningful and negligible reference blur per reason and at valid-far fallbacks", () => {
    const matrix = matrixWithAllFallbackReasons();
    setSourcePixelAcrossMatrix(matrix, 0, 2, 0.5);
    setSourcePixelAcrossMatrix(matrix, 1, 2, 0.5);

    const result = analyzeGroundGlassM5rFallbacks(matrix);

    expect(result.minimumMeaningfulBlurRgbDifference).toBe(GROUND_GLASS_M5R_MEANINGFUL_BLUR_FLOOR);
    expect(result.byReason.missingOrOutOfBoundsProvenance.meaningfulBlurFallbackPixelCount).toBe(0);
    expect(result.byReason.missingOrOutOfBoundsProvenance.negligibleBlurFallbackPixelCount).toBe(1);
    expect(result.byReason.selectedCenterProvenanceMismatch.meaningfulBlurFallbackPixelCount).toBe(0);
    expect(result.byReason.selectedCenterProvenanceMismatch.negligibleBlurFallbackPixelCount).toBe(1);
    expect(result.fallbackSummary.meaningfulBlurPixelCount).toBe(3);
    expect(result.fallbackSummary.negligibleBlurPixelCount).toBe(2);
    expect(result.fallbackSummary.meaningfulBlurFraction).toBeCloseTo(3 / 5);
    expect(result.fallbackSummary.meaningfulBlurValidFarPixelCount).toBe(3);
    expect(result.fallbackSummary.validFarPixelCount).toBe(4);
    expect(result.blurPreservation.meaningfulReferenceBlurPixelCount).toBe(55);
    expect(result.blurPreservation.negligibleReferenceBlurPixelCount).toBe(1);
  });

  it("B3: attributes valid-far, depth-edge, signed-boundary overlap and Full32/Full64 errors by reason", () => {
    const matrix = matrixWithAllFallbackReasons();
    const contaminatedPixel = pixelIndex(2, 3);
    const offset = contaminatedPixel * 4;
    matrix.half32.readbackBuffers.b1FarRgba[offset] += 0.25;
    matrix.full64.readbackBuffers.farGatherRgba[offset] += 0.05;

    const result = analyzeGroundGlassM5rFallbacks(matrix);
    const reason = result.byReason.invalidOrUnresolvedCenter;

    expect(result.fallbackSummary.validFarPixelCount).toBe(4);
    expect(reason.validFarFallbackPixelCount).toBe(1);
    expect(reason.depthEdgeFallbackOverlapPixelCount).toBe(1);
    expect(reason.signedBoundaryFallbackOverlapPixelCount).toBe(0);
    expect(result.byReason.selectedCenterProvenanceMismatch.signedBoundaryFallbackOverlapPixelCount).toBe(1);
    expect(reason.full32Error.depthEdge.pixelCount).toBe(1);
    expect(reason.full32Error.depthEdge.maximumChannelError).toBeCloseTo(0.65);
    expect(reason.full64Error.all.maximumChannelError).toBeCloseTo(0.6);
    expect(reason.sourceColorDelta.depthEdge.maximumChannelError).toBeCloseTo(0.25);
  });

  it("B4: summarizes fallback-boundary absolute and relative error distributions", () => {
    const matrix = matrixWithAllFallbackReasons();
    const result = analyzeGroundGlassM5rFallbacks(matrix);
    const gradients = result.fallbackBoundaryGradient;

    expect(gradients.status).toBe("measured");
    expect(gradients.pairCount).toBeGreaterThan(0);
    expect(gradients.absoluteError.sampleCount).toBe(gradients.pairCount);
    expect(gradients.relativeError.sampleCount).toBe(gradients.pairCount);
    expect(gradients.absoluteError.p50).not.toBeNull();
    expect(gradients.absoluteError.p90).not.toBeNull();
    expect(gradients.absoluteError.p95).not.toBeNull();
    expect(gradients.absoluteError.p99).not.toBeNull();
    expect(gradients.absoluteError.maximum).toBeGreaterThanOrEqual(gradients.absoluteError.p99 ?? 0);
    expect(computeHistoricalRelativeMean(result)).toBe(gradients.relativeError.mean);
    expect(gradients.historicalRelativeMeanError).toBe(gradients.relativeError.mean);
  });

  it("B5: keeps source delta distinct from Full32 and Full64 reference error", () => {
    const matrix = matrixWithAllFallbackReasons();
    const pixel = pixelIndex(6, 6);
    const offset = pixel * 4;
    matrix.half32.readbackBuffers.b1FarRgba.set([0.8, 0.8, 0.8, 1], offset);
    matrix.full64.readbackBuffers.farGatherRgba.set([0.6, 0.6, 0.6, 1], offset);

    const result = analyzeGroundGlassM5rFallbacks(matrix);
    const reason = result.byReason.unusableGatherData;

    expect(reason.sourceColorDelta.all.maximumChannelError).toBeCloseTo(0.7);
    expect(reason.full32Error.all.maximumChannelError).toBeCloseTo(0.3);
    expect(reason.full64Error.all.maximumChannelError).toBeCloseTo(0.2);
    expect(result.fallbackSummary.sourceColorDelta.maximumChannelError).toBeCloseTo(0.7);
  });

  it("B6: rejects unmatched inputs and inconsistent GPU reason/path bytes", () => {
    const mismatched = makeMatrix();
    mismatched.full64.readbackBuffers.depth[0] = 0.9;
    expect(() => analyzeGroundGlassM5rFallbacks(mismatched)).toThrow(/depth input differs/);

    const inconsistent = makeMatrix();
    inconsistent.half32.readbackBuffers.b1DecisionRgba.set([0, 4, 1, 255], 0);
    expect(() => analyzeGroundGlassM5rFallbacks(inconsistent)).toThrow(/GPU decision bytes are inconsistent/);
  });

  it("B7: attributes small reference-gradient denominators to the historical floor", () => {
    const matrix = makeMatrix();
    const fallbackPixel = pixelIndex(3, 3);
    const fallbackOffset = fallbackPixel * 4;
    setGpuReason(matrix.half32, fallbackPixel, GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible, {
      copySourceToB1: false,
    });
    setSourcePixelAcrossMatrix(matrix, 3, 3, 0.6);
    matrix.half32.readbackBuffers.b1FarRgba.set([0.6, 0.6, 0.6, 1], fallbackOffset);
    const reference = matrix.full32.readbackBuffers.farGatherRgba;
    reference.set([0.5005, 0.5005, 0.5005, 1], fallbackOffset);
    matrix.full64.readbackBuffers.farGatherRgba.set(reference);
    for (const capture of [matrix.half32, matrix.full32, matrix.full64]) {
      capture.readbackBuffers.sourceRgba.set([0.5, 0.5, 0.5, 1], pixelOffset(4, 3));
    }

    const result = analyzeGroundGlassM5rFallbacks(matrix);
    const gradient = result.fallbackBoundaryGradient;

    expect(gradient.denominatorFloor.appliedPairCount).toBe(gradient.pairCount);
    expect(gradient.denominatorFloor.appliedPairFraction).toBe(1);
    expect(gradient.absoluteError.p50).toBeCloseTo(0.0995);
    expect(gradient.absoluteError.p90).toBeCloseTo(0.0995);
    expect(gradient.absoluteError.p95).toBeCloseTo(0.0995);
    expect(gradient.absoluteError.p99).toBeCloseTo(0.0995);
    expect(gradient.absoluteError.maximum).toBeCloseTo(0.0995);
    expect(gradient.relativeError.p50).toBeCloseTo(9.95);
    expect(gradient.relativeError.p90).toBeCloseTo(9.95);
    expect(gradient.relativeError.p95).toBeCloseTo(9.95);
    expect(gradient.relativeError.p99).toBeCloseTo(9.95);
    expect(gradient.relativeError.maximum).toBeCloseTo(9.95);
    expect(gradient.relativeError.mean).toBeCloseTo((gradient.absoluteError.mean ?? 0) / 0.01);
    expect(gradient.relativeError.mean).toBeLessThan(
      gradient.absoluteError.mean! / 0.0005,
    );
    expect(gradient.historicalRelativeMeanError).toBe(gradient.relativeError.mean);
  });

  it("B8: measures the spatial width of B1-vs-reference error from actual fallback boundaries", () => {
    const noFallback = analyzeGroundGlassM5rFallbacks(makeMatrix());
    expect(noFallback.boundaryDifferenceSupport.status).toBe("insufficient-support");
    expect(noFallback.boundaryDifferenceSupport.full32.status).toBe("insufficient-support");
    expect(noFallback.boundaryDifferenceSupport.full32.supportedWidthPx).toBeNull();

    const matrix = makeMatrix();
    const fallback = pixelIndex(3, 3);
    setGpuReason(matrix.half32, fallback, GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible);
    const atBoundary = analyzeGroundGlassM5rFallbacks(matrix).boundaryDifferenceSupport;

    expect(atBoundary.status).toBe("measured");
    expect(atBoundary.boundaryPairCount).toBe(4);
    expect(atBoundary.boundaryPixelCount).toBe(5);
    expect(atBoundary.thresholdRgbDifference).toBe(GROUND_GLASS_M5R_BOUNDARY_DIFFERENCE_THRESHOLD);
    expect(atBoundary.distanceDefinition).toContain("4-neighbor Manhattan distance");
    expect(atBoundary.full32.maximumSupportedDistancePx).toBe(0);
    expect(atBoundary.full32.supportedWidthPx).toBe(1);
    expect(atBoundary.full32.byDistance[0]?.atOrAboveThresholdPixelCount).toBe(1);
    expect(atBoundary.full32.byDistance[1]?.atOrAboveThresholdPixelCount).toBe(0);
    expect(atBoundary.full64.maximumSupportedDistancePx).toBe(0);

    const distanceOnePixel = pixelOffset(1, 3);
    matrix.half32.readbackBuffers.b1FarRgba.set([0.7, 0.7, 0.7, 1], distanceOnePixel);
    const extended = analyzeGroundGlassM5rFallbacks(matrix).boundaryDifferenceSupport;

    expect(extended.full32.maximumSupportedDistancePx).toBe(1);
    expect(extended.full32.supportedWidthPx).toBe(2);
    expect(extended.full32.byDistance[1]?.atOrAboveThresholdPixelCount).toBe(1);
    expect(extended.full64.maximumSupportedDistancePx).toBe(1);
  });

  it("B9: reports whether B1 moves farther-side colors toward the near-side source at valid boundaries", () => {
    const matrix = makeMatrix();
    const baseline = analyzeGroundGlassM5rFallbacks(matrix).foregroundLeakageDirection;

    expect(baseline.depthEdge.status).toBe("measured");
    expect(baseline.signedBoundary.status).toBe("measured");
    expect(baseline.signedBoundary.full32.tiePixelCount).toBe(baseline.signedBoundary.pairCount);
    expect(baseline.depthEdge.full32.tiePixelCount).toBe(baseline.depthEdge.pairCount);
    expect(baseline.sampleDefinition).toContain("farther-side B1/reference pixel");

    // x=0 is negative-CoC near; its source value at y=3 is 0.9.
    matrix.half32.readbackBuffers.b1FarRgba.set([0.9, 0.9, 0.9, 1], pixelOffset(1, 3));
    // y=3 has nearer depth than y=4; the near-side source at x=1,y=3 is 0.1.
    matrix.half32.readbackBuffers.b1FarRgba.set([0.1, 0.1, 0.1, 1], pixelOffset(1, 4));
    const towardNear = analyzeGroundGlassM5rFallbacks(matrix).foregroundLeakageDirection;

    expect(towardNear.signedBoundary.full32.b1CloserToNearSourcePixelCount).toBeGreaterThan(0);
    expect(towardNear.signedBoundary.full32.meanReferenceMinusB1NearSourceDifference).toBeGreaterThan(0);
    expect(towardNear.depthEdge.full32.b1CloserToNearSourcePixelCount).toBeGreaterThan(0);
    expect(towardNear.depthEdge.full64.b1CloserToNearSourcePixelCount).toBeGreaterThan(0);

    const awayMatrix = makeMatrix();
    awayMatrix.half32.readbackBuffers.b1FarRgba.set([0, 0, 0, 1], pixelOffset(1, 3));
    const away = analyzeGroundGlassM5rFallbacks(awayMatrix).foregroundLeakageDirection;
    expect(away.signedBoundary.full32.referenceCloserToNearSourcePixelCount).toBeGreaterThan(0);
    expect(away.signedBoundary.full32.meanReferenceMinusB1NearSourceDifference).toBeLessThan(0);
  });

  it("N7: detects wrong source-color fallback through source delta and matched-reference error", () => {
    const matrix = matrixWithAllFallbackReasons();
    const pixel = pixelIndex(1, 2);
    const offset = pixel * 4;
    const baseline = analyzeGroundGlassM5rFallbacks(matrix);
    matrix.half32.readbackBuffers.b1FarRgba.set([0, 0, 0, 1], offset);

    const changed = analyzeGroundGlassM5rFallbacks(matrix);

    expect(changed.byReason.selectedCenterProvenanceMismatch.sourceColorDelta.all.maximumChannelError)
      .toBeGreaterThan(baseline.byReason.selectedCenterProvenanceMismatch.sourceColorDelta.all.maximumChannelError ?? 0);
    expect(changed.byReason.selectedCenterProvenanceMismatch.full32Error.all.rmse)
      .toBeGreaterThan(baseline.byReason.selectedCenterProvenanceMismatch.full32Error.all.rmse ?? 0);
  });

  it("N8: detects foreground contamination at depth and signed boundaries", () => {
    const matrix = makeMatrix();
    const pixel = pixelIndex(1, 3);
    const offset = pixel * 4;
    const before = analyzeGroundGlassM5rFallbacks(matrix);
    matrix.half32.readbackBuffers.b1FarRgba[offset] += 0.4;

    const after = analyzeGroundGlassM5rFallbacks(matrix);
    const accepted = after.byReason.farGatherAccepted;

    expect(accepted.depthEdgeOverlapPixelCount).toBeGreaterThan(0);
    expect(accepted.signedBoundaryOverlapPixelCount).toBeGreaterThan(0);
    expect(accepted.full32Error.depthEdge.rmse).toBeGreaterThan(before.byReason.farGatherAccepted.full32Error.depthEdge.rmse ?? 0);
    expect(accepted.full32Error.signedBoundary.rmse)
      .toBeGreaterThan(before.byReason.farGatherAccepted.full32Error.signedBoundary.rmse ?? 0);
  });

  it("N9: detects sharp-source substitution as lost blur and increased Full32/Full64 error", () => {
    const matrix = makeMatrix();
    setGpuReason(matrix.half32, pixelIndex(3, 3), GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible, {
      copySourceToB1: false,
    });
    const baseline = analyzeGroundGlassM5rFallbacks(matrix);
    replaceEveryB1PixelWithSource(matrix.half32);

    const changed = analyzeGroundGlassM5rFallbacks(matrix);

    expect(baseline.blurPreservation.candidateToReferenceMeanSignalRatio).toBeCloseTo(1);
    expect(changed.blurPreservation.candidateToReferenceMeanSignalRatio).toBe(0);
    expect(changed.blurPreservation.relativeMeanSignalLoss).toBe(1);
    expect(changed.fallbackSummary.full32Error.rmse).toBeGreaterThan(baseline.fallbackSummary.full32Error.rmse ?? 0);
    expect(changed.fallbackSummary.full64Error.rmse).toBeGreaterThan(baseline.fallbackSummary.full64Error.rmse ?? 0);
  });

  it("N10: detects a GPU fallback-mask-only mutation without changing B1 color output", () => {
    const matrix = makeMatrix();
    const pixel = pixelIndex(3, 3);
    const pixelsBefore = matrix.half32.readbackBuffers.b1FarRgba.slice();
    const before = analyzeGroundGlassM5rFallbacks(matrix);
    setGpuReason(matrix.half32, pixel, GROUND_GLASS_B1_FALLBACK_REASON.selectedCenterNotFarEligible, {
      copySourceToB1: false,
    });

    const after = analyzeGroundGlassM5rFallbacks(matrix);

    expect(matrix.half32.readbackBuffers.b1FarRgba).toEqual(pixelsBefore);
    expect(after.fallbackSummary.pixelCount).toBe(before.fallbackSummary.pixelCount + 1);
    expect(after.reasonCounts.selectedCenterNotFarEligible).toBe(1);
    expect(after.fallbackBoundaryGradient.pairCount).toBeGreaterThan(before.fallbackBoundaryGradient.pairCount);
    expect(after.byReason.selectedCenterNotFarEligible.sourceColorDelta.all.rmse).toBeGreaterThan(0);
  });
});
