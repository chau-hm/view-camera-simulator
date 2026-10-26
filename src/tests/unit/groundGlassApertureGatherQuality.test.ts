import { describe, expect, it } from "vitest";
import {
  evaluateGroundGlassApertureGatherR3,
  type GroundGlassApertureGatherR3Capture,
  type GroundGlassApertureGatherR3CaptureMatrix,
  type GroundGlassApertureGatherR3Thresholds,
  type GroundGlassR3QualityMode,
} from "../../render/webgpu/groundGlassApertureGatherQuality";

type TestDimensions = Readonly<{ widthPx: number; heightPx: number }>;
const source: TestDimensions = { widthPx: 8, heightPx: 8 };
const film = { widthMm: 36, heightMm: 24 } as const;

const makeSource = (dimensions: TestDimensions = source): Float32Array => {
  const data = new Float32Array(dimensions.widthPx * dimensions.heightPx * 4);
  for (let y = 0; y < dimensions.heightPx; y += 1) {
    for (let x = 0; x < dimensions.widthPx; x += 1) {
      const checker = (x + y) % 2 === 0 ? 0.1 : 0.9;
      const offset = (y * dimensions.widthPx + x) * 4;
      data.set([checker, 1 - checker, x % 2 === 0 ? 0.2 : 0.8, 1], offset);
    }
  }
  return data;
};

const boxBlur3x3 = (rgba: Float32Array, dimensions: TestDimensions = source): Float32Array => {
  const output = new Float32Array(rgba.length);
  for (let y = 0; y < dimensions.heightPx; y += 1) {
    for (let x = 0; x < dimensions.widthPx; x += 1) {
      const sum = [0, 0, 0];
      let count = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const nx = Math.min(dimensions.widthPx - 1, Math.max(0, x + dx));
          const ny = Math.min(dimensions.heightPx - 1, Math.max(0, y + dy));
          const offset = (ny * dimensions.widthPx + nx) * 4;
          for (let channel = 0; channel < 3; channel += 1) sum[channel]! += rgba[offset + channel]!;
          count += 1;
        }
      }
      const outputOffset = (y * dimensions.widthPx + x) * 4;
      output.set([sum[0]! / count, sum[1]! / count, sum[2]! / count, 1], outputOffset);
    }
  }
  return output;
};

const maxPixelRadius = (dimensions: TestDimensions = source, major = 50, minor = 25): number => {
  const coc = 0.5;
  void coc;
  const angle = 0.1 * Math.PI;
  const a = Math.cos(angle) * major * dimensions.widthPx / film.widthMm;
  const b = -Math.sin(angle) * major * dimensions.heightPx / film.heightMm;
  const c = -Math.sin(angle) * minor * dimensions.widthPx / film.widthMm;
  const d = -Math.cos(angle) * minor * dimensions.heightPx / film.heightMm;
  const traceHalf = (a * a + b * b + c * c + d * d) / 2;
  const discriminant = Math.hypot((a * a + b * b - c * c - d * d) / 2, a * c + b * d);
  return Math.sqrt(traceHalf + discriminant);
};

const radiusCapPx = 2;
const fallbackEvidencePixel = 11;

const makeCapture = (
  qualityMode: GroundGlassR3QualityMode,
  captureId: string,
  dimensions: TestDimensions = source,
): GroundGlassApertureGatherR3Capture => {
  const scale = qualityMode === "half32" ? 0.5 : 1;
  const gather = {
    widthPx: Math.max(1, Math.round(dimensions.widthPx * scale)),
    heightPx: Math.max(1, Math.round(dimensions.heightPx * scale)),
  };
  const sourceRgba = makeSource(dimensions);
  const reference = boxBlur3x3(sourceRgba, dimensions);
  sourceRgba.set(reference.subarray(fallbackEvidencePixel * 4, fallbackEvidencePixel * 4 + 4), fallbackEvidencePixel * 4);
  const physicalRgba = new Float32Array(dimensions.widthPx * dimensions.heightPx * 4);
  const validity = new Uint8Array(dimensions.widthPx * dimensions.heightPx).fill(1);
  const depth = new Float32Array(dimensions.widthPx * dimensions.heightPx);
  for (let y = 0; y < dimensions.heightPx; y += 1) {
    for (let x = 0; x < dimensions.widthPx; x += 1) {
      const pixel = y * dimensions.widthPx + x;
      const signedCoc = x < dimensions.widthPx / 2 ? -0.5 : 0.5;
      physicalRgba.set([signedCoc, 50, 25, 0.1], pixel * 4);
      depth[pixel] = x < dimensions.widthPx / 2 ? 0.35 : 0.7;
    }
  }
  const gatherPixels = gather.widthPx * gather.heightPx;
  const farGatherRgba = new Float32Array(gatherPixels * 4);
  const observedSelectedGatherIds = new Int32Array(dimensions.widthPx * dimensions.heightPx * 2);
  const observedGatherCenterSourceIds = new Int32Array(gatherPixels * 2);
  for (let y = 0; y < gather.heightPx; y += 1) {
    for (let x = 0; x < gather.widthPx; x += 1) {
      const gatherPixel = y * gather.widthPx + x;
      const sourceX = Math.min(dimensions.widthPx - 1,
        Math.floor(((x + 0.5) / gather.widthPx) * dimensions.widthPx));
      const sourceY = Math.min(dimensions.heightPx - 1,
        Math.floor(((y + 0.5) / gather.heightPx) * dimensions.heightPx));
      observedGatherCenterSourceIds.set([sourceX, sourceY], gatherPixel * 2);
      const sourceOffset = (sourceY * dimensions.widthPx + sourceX) * 4;
      farGatherRgba.set(reference.subarray(sourceOffset, sourceOffset + 4), gatherPixel * 4);
    }
  }
  for (let y = 0; y < dimensions.heightPx; y += 1) {
    for (let x = 0; x < dimensions.widthPx; x += 1) {
      const pixel = y * dimensions.widthPx + x;
      const gx = Math.min(gather.widthPx - 1, Math.floor(((x + 0.5) / dimensions.widthPx) * gather.widthPx));
      const gy = Math.min(gather.heightPx - 1, Math.floor(((y + 0.5) / dimensions.heightPx) * gather.heightPx));
      observedSelectedGatherIds.set([gx, gy], pixel * 2);
    }
  }
  const nearBeforeB1Rgba = new Float32Array(gatherPixels * 4);
  for (let pixel = 0; pixel < gatherPixels; pixel += 1) {
    nearBeforeB1Rgba.set([0.2, 0.3, 0.4, pixel % 2 === 0 ? 0.25 : 0], pixel * 4);
  }
  const b1DecisionRgba = new Uint8Array(dimensions.widthPx * dimensions.heightPx * 4);
  for (let pixel = 0; pixel < dimensions.widthPx * dimensions.heightPx; pixel += 1) {
    b1DecisionRgba.set([1, 0, 1, 255], pixel * 4);
  }
  b1DecisionRgba.set([0, 4, 0, 255], fallbackEvidencePixel * 4);
  return {
    captureId,
    requestId: "request-" + captureId,
    sceneId: "architecture-rise",
    sceneSourceRevision: "architecture-rise-test-r1",
    effectiveOpticalRequestFingerprint: "focus-f8-crop-full-camera-state-a",
    cameraStateFingerprint: "camera-matrix-a",
    readbackOrigin: "top",
    qualityMode,
    sourceDimensions: dimensions,
    gatherDimensions: gather,
    sampledFilmDimensionsMm: film,
    sampleCount: qualityMode === "full64" ? 64 : 32,
    maximumRadiusPx: radiusCapPx,
    colorDomain: "source-target-readback-values",
    targetFormats: {
      sourceColor: "rgba8unorm",
      physical: "rgba16float",
      validity: "rgba8unorm",
      far: "rgba16float",
      near: "rgba16float",
      b1: "rgba16float",
    },
    reportedRadiusEvidence: {
      maximumUncappedRadiusPx: maxPixelRadius(dimensions),
      cappedPixelCount: gatherPixels / 2,
    },
    readbackBuffers: {
      sourceRgba,
      depth,
      physicalRgba,
      validity,
      farGatherRgba,
      b1FarRgba: reference.slice(),
      nearBeforeB1Rgba,
      nearAfterB1Rgba: nearBeforeB1Rgba.slice(),
      nearCpuReferenceRgba: nearBeforeB1Rgba.slice(),
      observedSelectedGatherIds,
      observedGatherCenterSourceIds,
      b1DecisionRgba,
    },
  };
};

const makeMatrix = (dimensions: TestDimensions = source): GroundGlassApertureGatherR3CaptureMatrix => ({
  half32: makeCapture("half32", "capture-half-1", dimensions),
  full32: makeCapture("full32", "capture-full-32", dimensions),
  full64: makeCapture("full64", "capture-full-64", dimensions),
});

const thresholds: GroundGlassApertureGatherR3Thresholds = {
  revision: "synthetic-r3-thresholds-v1",
  evidenceScope: "single-native-state",
  frozenBeforeConfirmatory: true,
  minimumInteriorFarPixels: 4,
  minimumDepthEdgePixels: 4,
  minimumNearFarBoundaryPairs: 1,
  minimumNearCoveragePixels: 4,
  minimumFractionalCoveragePixels: 2,
  minimumNearFarBoundaryCoveragePixels: 1,
  minimumSpreadOutsideSharpNearPixels: 1,
  minimumFallbackBoundaryPairs: 1,
  minimumStrongOverrunPx: 1,
  maximumReferenceRmse: 0.005,
  maximumReferenceChannelError: 0.02,
  maximumReferenceInteriorFarRmse: 0.005,
  maximumReferenceDepthEdgeRmse: 0.005,
  maximumB1FullFrameRmse: 0.01,
  maximumB1InteriorFarRmse: 0.01,
  maximumB1DepthEdgeRmse: 0.01,
  maximumB1SignedBoundaryRmse: 0.01,
  maximumBlurGradientRelativeError: 0.25,
  maximumMeaningfulBlurFallbackFraction: 0.1,
  maximumFallbackBoundaryGradientRelativeError: 0.25,
  maximumFallbackSourceError: 0.001,
  maximumNearCpuRgbRmse: 0.001,
  maximumNearCpuAlphaRmse: 0.001,
  maximumNearB1RgbMaximumError: 0.001,
  maximumNearB1AlphaMaximumError: 0.001,
  minimumMeaningfulBlurRgbDifference: 0.01,
  depthEdgeThreshold: 0.0001,
};

describe("Ground Glass M5 independent R3 quality evaluator", () => {
  it("measures the matched native reference matrix and scopes a qualified result to one state", () => {
    const result = evaluateGroundGlassApertureGatherR3(makeMatrix(), thresholds);
    expect(result.qualityDecision.status).toBe("bounded-qualified");
    expect(result.evidenceScope).toBe("single-native-webgpu-state");
    expect(result.requestIds.half32).not.toBe(result.requestIds.full32);
    expect(result.provenance.status).toBe("matched");
    expect(result.provenance.fingerprints.half32.sourceColor).toMatch(/^fnv1a32:/);
    expect(result.captureProvenance.half32.sceneSourceRevision).toBe("architecture-rise-test-r1");
    expect(result.referenceConvergence.status).toBe("converged");
    expect(result.fullFrameMetrics.half32B1VsFull32.rmse).toBe(0);
    expect(result.interiorFarMetrics.pixelCount).toBeGreaterThan(0);
    expect(result.interiorFarMetrics.expectedBlurMeanRgbDifference).toBeGreaterThan(0);
    expect(result.depthEdgeMetrics.depthEdgePairCount).toBeGreaterThan(0);
    expect(result.depthEdgeMetrics.nearSidePixelCount).toBeGreaterThan(0);
    expect(result.depthEdgeMetrics.farSidePixelCount).toBeGreaterThan(0);
    expect(result.depthEdgeMetrics.averageFull32RgbEdgeContrast).toBeGreaterThan(0);
    expect(result.signedBoundaryEvidence.adjacentNearFarPairCount).toBeGreaterThan(0);
    expect(result.radiusCapEvidence.maximumOverrunPx).toBeGreaterThan(1);
    expect(result.nearInvariance.nonzeroCoveragePixelCount).toBeGreaterThan(0);
    expect(result.nearInvariance.fractionalCoveragePixelCount).toBeGreaterThan(0);
  });

  it("matches odd half-resolution dimensions using nearest-integer rounding", () => {
    const matrix = makeMatrix({ widthPx: 379, heightPx: 8 });
    const boundaryGatherX = Math.floor(((Math.floor(379 / 2) + 0.5) / 379) * matrix.half32.gatherDimensions.widthPx);
    for (let y = 0; y < matrix.half32.gatherDimensions.heightPx; y += 1) {
      const offset = (y * matrix.half32.gatherDimensions.widthPx + boundaryGatherX) * 4;
      for (const data of [
        matrix.half32.readbackBuffers.nearBeforeB1Rgba,
        matrix.half32.readbackBuffers.nearAfterB1Rgba,
        matrix.half32.readbackBuffers.nearCpuReferenceRgba,
      ]) data.set([0.2, 0.3, 0.4, 0.25], offset);
    }
    const result = evaluateGroundGlassApertureGatherR3(matrix, thresholds);
    expect(result.captureProvenance.half32.sourceDimensions.widthPx).toBe(379);
    expect(result.captureProvenance.half32.gatherDimensions.widthPx).toBe(190);
    expect(result.provenance.status).toBe("matched");
    expect(result.qualityDecision.status).toBe("bounded-qualified");
  });

  it("leaves a converged, otherwise-good comparison unqualified without meaningful reference blur", () => {
    const matrix = makeMatrix();
    matrix.full32.readbackBuffers.farGatherRgba.set(matrix.full32.readbackBuffers.sourceRgba);
    matrix.full64.readbackBuffers.farGatherRgba.set(matrix.full64.readbackBuffers.sourceRgba);
    matrix.half32.readbackBuffers.b1FarRgba.set(matrix.full32.readbackBuffers.farGatherRgba);

    const result = evaluateGroundGlassApertureGatherR3(matrix, thresholds);

    expect(result.referenceConvergence.status).toBe("converged");
    expect(result.interiorFarMetrics.expectedBlurMeanRgbDifference).toBe(0);
    expect(result.qualityDecision.status).toBe("insufficient-roi-support");
    expect(result.qualityDecision.reasons.join(" ")).toContain("reference blur signal is below");
  });

  it("rejects a zero meaningful-blur floor instead of allowing zero-signal qualification", () => {
    const noBlur = { ...thresholds, minimumMeaningfulBlurRgbDifference: 0 };
    const result = evaluateGroundGlassApertureGatherR3(makeMatrix(), noBlur);
    expect(result.qualityDecision.status).toBe("not-evaluated");
    expect(result.qualityDecision.reasons.join(" ")).toContain("must be positive");
  });

  it("rejects zero minimum evidence thresholds", () => {
    const minimumKeys = [
      "minimumInteriorFarPixels", "minimumDepthEdgePixels", "minimumNearFarBoundaryPairs",
      "minimumNearCoveragePixels", "minimumFractionalCoveragePixels", "minimumNearFarBoundaryCoveragePixels",
      "minimumSpreadOutsideSharpNearPixels", "minimumFallbackBoundaryPairs", "minimumStrongOverrunPx",
    ] as const;
    for (const key of minimumKeys) {
      const invalid = { ...thresholds, [key]: 0 } as GroundGlassApertureGatherR3Thresholds;
      const result = evaluateGroundGlassApertureGatherR3(makeMatrix(), invalid);
      expect(result.qualityDecision.status, key).toBe("not-evaluated");
      expect(result.qualityDecision.reasons.join(" "), key).toContain("positive");
    }
  });

  it("reports matched metrics without frozen thresholds but never qualifies by default", () => {
    const result = evaluateGroundGlassApertureGatherR3(makeMatrix());
    expect(result.qualityDecision.status).toBe("not-evaluated");
    expect(result.qualityDecision.thresholdsFrozenBeforeConfirmatory).toBe(false);
    expect(result.fullFrameMetrics.half32B1VsFull32.status).toBe("measured");
  });

  it("rejects source, physical, focus/crop, and cap provenance mismatches", () => {
    const sourceMismatch = makeMatrix();
    sourceMismatch.full64.readbackBuffers.sourceRgba[0] = 0.333;
    expect(evaluateGroundGlassApertureGatherR3(sourceMismatch, thresholds).qualityDecision.status)
      .toBe("invalid-comparison");
    expect(evaluateGroundGlassApertureGatherR3(sourceMismatch, thresholds).provenance.reasons.join(" "))
      .toContain("sourceRgba content differs");
    const sourceReport = evaluateGroundGlassApertureGatherR3(sourceMismatch, thresholds);
    expect(sourceReport.provenance.fingerprints.half32.sourceColor)
      .not.toBe(sourceReport.provenance.fingerprints.full64.sourceColor);

    const physicalMismatch = makeMatrix();
    physicalMismatch.full32.readbackBuffers.physicalRgba[1] += 0.25;
    expect(evaluateGroundGlassApertureGatherR3(physicalMismatch, thresholds).provenance.reasons.join(" "))
      .toContain("physicalRgba content differs");

    const depthMismatch = makeMatrix();
    depthMismatch.full64.readbackBuffers.depth[0] += 0.1;
    expect(evaluateGroundGlassApertureGatherR3(depthMismatch, thresholds).provenance.reasons.join(" "))
      .toContain("depth content differs");

    const validityMismatch = makeMatrix();
    validityMismatch.full64.readbackBuffers.validity[0] = 2;
    expect(evaluateGroundGlassApertureGatherR3(validityMismatch, thresholds).provenance.reasons.join(" "))
      .toContain("validity content differs");

    const opticsBase = makeMatrix();
    const opticsMismatch = {
      ...opticsBase,
      full64: { ...opticsBase.full64, effectiveOpticalRequestFingerprint: "focus-or-crop-changed" },
    };
    expect(evaluateGroundGlassApertureGatherR3(opticsMismatch, thresholds).provenance.reasons.join(" "))
      .toContain("effective optical request differs");

    const capBase = makeMatrix();
    const capMismatch = { ...capBase, full32: { ...capBase.full32, maximumRadiusPx: 3 } };
    expect(evaluateGroundGlassApertureGatherR3(capMismatch, thresholds).provenance.reasons.join(" "))
      .toContain("radius cap differs");
  });

  it("rejects a camera mismatch and non-converged Full32/Full64 reference", () => {
    const cameraBase = makeMatrix();
    const cameraMismatch = {
      ...cameraBase,
      full64: { ...cameraBase.full64, cameraStateFingerprint: "different-camera" },
    };
    expect(evaluateGroundGlassApertureGatherR3(cameraMismatch, thresholds).qualityDecision.status)
      .toBe("invalid-comparison");

    const unstableReference = makeMatrix();
    unstableReference.full64.readbackBuffers.farGatherRgba[0] += 0.2;
    const result = evaluateGroundGlassApertureGatherR3(unstableReference, thresholds);
    expect(result.referenceConvergence.status).toBe("not-converged");
    expect(result.qualityDecision.status).toBe("reference-not-converged");
  });

  it("reports empty interior-far or depth-edge ROIs as insufficient support", () => {
    const noFar = makeMatrix();
    for (const capture of [noFar.half32, noFar.full32, noFar.full64]) {
      for (let pixel = 0; pixel < capture.readbackBuffers.validity.length; pixel += 1) {
        capture.readbackBuffers.physicalRgba[pixel * 4] = -0.5;
      }
    }
    const noFarResult = evaluateGroundGlassApertureGatherR3(noFar, thresholds);
    expect(noFarResult.interiorFarMetrics.pixelCount).toBe(0);
    expect(noFarResult.qualityDecision.status).toBe("insufficient-roi-support");

    const noEdges = makeMatrix();
    for (const capture of [noEdges.half32, noEdges.full32, noEdges.full64]) capture.readbackBuffers.depth.fill(0.5);
    const noEdgeResult = evaluateGroundGlassApertureGatherR3(noEdges, thresholds);
    expect(noEdgeResult.depthEdgeMetrics.pixelCount).toBe(0);
    expect(noEdgeResult.qualityDecision.status).toBe("insufficient-roi-support");
  });

  it("detects sharp source fallback replacing legitimately blurred reference output", () => {
    const matrix = makeMatrix();
    matrix.half32.readbackBuffers.b1FarRgba.set(matrix.half32.readbackBuffers.sourceRgba);
    const result = evaluateGroundGlassApertureGatherR3(matrix, thresholds);
    expect(result.blurSpreadMetrics.relativeGradientError).toBeGreaterThan(0.25);
    expect(result.fullFrameMetrics.half32B1VsFull32.rmse).toBeGreaterThan(0);
    expect(result.qualityDecision.status).toBe("candidate-quality-failed");
  });

  it("detects added depth-edge contamination and incorrect source fallback output", () => {
    const contaminated = makeMatrix();
    const baseline = evaluateGroundGlassApertureGatherR3(contaminated, thresholds);
    const edgePixel = contaminated.half32.sourceDimensions.widthPx * 2 + 3;
    contaminated.half32.readbackBuffers.b1FarRgba[edgePixel * 4] += 0.5;
    const changed = evaluateGroundGlassApertureGatherR3(contaminated, thresholds);
    expect(changed.foregroundLeakageMetrics.half32B1VsFull32AtDepthEdges.rmse)
      .toBeGreaterThan(baseline.foregroundLeakageMetrics.half32B1VsFull32AtDepthEdges.rmse ?? 0);

    const wrongFallback = makeMatrix();
    const pixel = fallbackEvidencePixel;
    wrongFallback.half32.readbackBuffers.b1FarRgba[pixel * 4] += 0.1;
    const fallbackResult = evaluateGroundGlassApertureGatherR3(wrongFallback, thresholds);
    expect(fallbackResult.fallbackMetrics.pixelCount).toBe(1);
    expect(fallbackResult.fallbackMetrics.sourceColorMismatchPixelCount).toBe(1);
    expect(fallbackResult.qualityDecision.status).toBe("candidate-quality-failed");
  });

  it("checks near GPU/CPU RGBA and keeps before/after-B1 invariance separate", () => {
    const matrix = makeMatrix();
    matrix.half32.readbackBuffers.nearAfterB1Rgba[3] = 0.5;
    const result = evaluateGroundGlassApertureGatherR3(matrix, thresholds);
    expect(result.nearInvariance.gpuVsCpuAlpha.rmse).toBe(0);
    expect(result.nearInvariance.beforeVsAfterB1Alpha.maximumChannelError).toBe(0.25);
    expect(result.qualityDecision.status).toBe("candidate-quality-failed");
  });

  it("rejects self-capture and detects a false uncapped-radius report", () => {
    const duplicateBase = makeMatrix();
    const duplicate = {
      ...duplicateBase,
      full64: { ...duplicateBase.full64, captureId: duplicateBase.full32.captureId },
    };
    expect(evaluateGroundGlassApertureGatherR3(duplicate, thresholds).qualityDecision.status)
      .toBe("invalid-comparison");

    const radiusBase = makeMatrix();
    const falseRadius = {
      ...radiusBase,
      half32: {
        ...radiusBase.half32,
        reportedRadiusEvidence: { maximumUncappedRadiusPx: 0, cappedPixelCount: 0 },
      },
    };
    const result = evaluateGroundGlassApertureGatherR3(falseRadius, thresholds);
    expect(result.radiusCapEvidence.status).toBe("inconsistent");
    expect(result.radiusCapEvidence.reportedEvidenceMatches).toBe(false);
    expect(result.qualityDecision.status).toBe("invalid-comparison");
  });

  it("requires fallback-boundary evidence before qualifying a state", () => {
    const matrix = makeMatrix();
    for (let pixel = 0; pixel < matrix.half32.readbackBuffers.validity.length; pixel += 1) {
      matrix.half32.readbackBuffers.b1DecisionRgba.set([1, 0, 1, 255], pixel * 4);
    }

    const result = evaluateGroundGlassApertureGatherR3(matrix, thresholds);

    expect(result.fallbackMetrics.boundaryGradient.status).toBe("insufficient-support");
    expect(result.qualityDecision.status).toBe("insufficient-roi-support");
    expect(result.qualityDecision.reasons.join(" ")).toContain("fallback-boundary halo ROI support is insufficient");
  });

  it("gates signed near/far-boundary error independently from aggregate depth-edge error", () => {
    const matrix = makeMatrix();
    for (const capture of [matrix.half32, matrix.full32, matrix.full64]) {
      const signBoundaryPixel = 3 * source.widthPx + 2;
      capture.readbackBuffers.physicalRgba[signBoundaryPixel * 4] = 0.5;
    }
    const nearBoundaryPixel = 3 * source.widthPx + 1;
    matrix.half32.readbackBuffers.b1FarRgba[nearBoundaryPixel * 4] += 0.5;
    const relaxedFullFrame = { ...thresholds, maximumB1FullFrameRmse: 1 };

    const result = evaluateGroundGlassApertureGatherR3(matrix, relaxedFullFrame);

    expect(result.foregroundLeakageMetrics.half32B1VsFull32AtSignedBoundary.rmse).toBeGreaterThan(0.01);
    expect(result.foregroundLeakageMetrics.half32B1VsFull32AtDepthEdges.rmse).toBe(0);
    expect(result.qualityDecision.status).toBe("candidate-quality-failed");
    expect(result.qualityDecision.reasons.join(" ")).toContain("signed near/far-boundary error exceeds its limit");
  });

  it("computes Full32/Full64 convergence from the signed-boundary mask independently of depth edges", () => {
    const matrix = makeMatrix();
    for (const capture of [matrix.half32, matrix.full32, matrix.full64]) {
      for (let y = 0; y < source.heightPx; y += 1) {
        for (let x = 0; x < source.widthPx; x += 1) {
          // Keep the near/far sign transition at x=3/4 separate from a far/far depth edge at x=5/6.
          capture.readbackBuffers.depth[y * source.widthPx + x] = x < 6 ? 0.4 : 0.7;
        }
      }
    }

    const converged = evaluateGroundGlassApertureGatherR3(matrix, thresholds);
    expect(converged.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.status).toBe("measured");
    expect(converged.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.pixelCount)
      .toBe(converged.signedBoundaryEvidence.participatingPixelCount);
    expect(converged.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.channelCount)
      .toBe(converged.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.pixelCount * 3);
    expect(converged.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.mae).toBe(0);
    expect(converged.depthEdgeMetrics.full32VsFull64.rmse).toBe(0);

    const signedBoundaryPixel = 3 * source.widthPx + 3;
    matrix.full64.readbackBuffers.farGatherRgba[signedBoundaryPixel * 4] += 0.5;
    const divergent = evaluateGroundGlassApertureGatherR3(matrix, thresholds);
    expect(divergent.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.rmse).toBeGreaterThan(0.01);
    expect(divergent.depthEdgeMetrics.full32VsFull64.rmse).toBe(0);
  });

  it("requires validity-one adjacent pixels and opposite CoC signs for its reference boundary mask", () => {
    const farFar = makeMatrix();
    for (const capture of [farFar.half32, farFar.full32, farFar.full64]) {
      for (let pixel = 0; pixel < capture.readbackBuffers.validity.length; pixel += 1) {
        capture.readbackBuffers.physicalRgba[pixel * 4] = 0.5;
      }
    }
    const noSignBoundary = evaluateGroundGlassApertureGatherR3(farFar, thresholds);
    expect(noSignBoundary.signedBoundaryEvidence.status).toBe("absent");
    expect(noSignBoundary.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.status)
      .toBe("insufficient-support");

    const invalidAdjacent = makeMatrix();
    for (const capture of [invalidAdjacent.half32, invalidAdjacent.full32, invalidAdjacent.full64]) {
      for (let y = 0; y < source.heightPx; y += 1) {
        capture.readbackBuffers.validity[y * source.widthPx + 3] = 0;
        capture.readbackBuffers.validity[y * source.widthPx + 4] = 0;
      }
    }
    const excluded = evaluateGroundGlassApertureGatherR3(invalidAdjacent, thresholds);
    expect(excluded.signedBoundaryEvidence.status).toBe("absent");
    expect(excluded.foregroundLeakageMetrics.full32VsFull64AtSignedBoundary.pixelCount).toBe(0);
  });

  it("does not count over-cap physical data from validity-code-2 pixels", () => {
    const base = makeMatrix();
    const invalidCenter = source.widthPx + 7;
    for (const capture of [base.half32, base.full32, base.full64]) {
      for (let pixel = 0; pixel < capture.readbackBuffers.validity.length; pixel += 1) {
        capture.readbackBuffers.physicalRgba[pixel * 4 + 1] = 1;
        capture.readbackBuffers.physicalRgba[pixel * 4 + 2] = 0.5;
      }
      capture.readbackBuffers.validity[invalidCenter] = 2;
      capture.readbackBuffers.physicalRgba.set([0.5, 50, 25, 0.1], invalidCenter * 4);
    }
    const expectedValidFarRadius = maxPixelRadius(source, 1, 0.5);
    const matrix = {
      ...base,
      half32: {
        ...base.half32,
        reportedRadiusEvidence: { maximumUncappedRadiusPx: expectedValidFarRadius, cappedPixelCount: 0 },
      },
    };

    const result = evaluateGroundGlassApertureGatherR3(matrix, thresholds);

    expect(result.radiusCapEvidence.status).toBe("matched");
    expect(result.radiusCapEvidence.maximumUncappedRadiusPx).toBeCloseTo(expectedValidFarRadius, 8);
    expect(result.radiusCapEvidence.cappedPixelCount).toBe(0);
    expect(result.radiusCapEvidence.maximumOverrunPx).toBe(0);
    expect(result.qualityDecision.status).toBe("insufficient-roi-support");
    expect(result.qualityDecision.reasons.join(" ")).toContain("does not strongly overrun");
  });

  it("requires valid adjacent near/far signs and rejects a universal threshold claim", () => {
    const farFar = makeMatrix();
    for (const capture of [farFar.half32, farFar.full32, farFar.full64]) {
      for (let pixel = 0; pixel < capture.readbackBuffers.validity.length; pixel += 1) {
        capture.readbackBuffers.physicalRgba[pixel * 4] = 0.5;
      }
    }
    const farFarResult = evaluateGroundGlassApertureGatherR3(farFar, thresholds);
    expect(farFarResult.signedBoundaryEvidence.status).toBe("absent");
    expect(farFarResult.qualityDecision.status).toBe("insufficient-roi-support");

    const universal = { ...thresholds, evidenceScope: "all-scenes" } as unknown as GroundGlassApertureGatherR3Thresholds;
    const universalResult = evaluateGroundGlassApertureGatherR3(makeMatrix(), universal);
    expect(universalResult.qualityDecision.status).toBe("not-evaluated");
    expect(universalResult.qualityDecision.reasons.join(" ")).toContain("single-state");

    const unfrozen = { ...thresholds, frozenBeforeConfirmatory: false };
    expect(evaluateGroundGlassApertureGatherR3(makeMatrix(), unfrozen).qualityDecision.status)
      .toBe("not-evaluated");
  });

  it("rejects unknown B1 reason codes and non-finite readbacks", () => {
    const unknownReason = makeMatrix();
    unknownReason.half32.readbackBuffers.b1DecisionRgba.set([1, 99, 1, 255], 0);
    expect(evaluateGroundGlassApertureGatherR3(unknownReason, thresholds).qualityDecision.status)
      .toBe("invalid-comparison");

    const nonFinite = makeMatrix();
    nonFinite.full32.readbackBuffers.physicalRgba[0] = Number.NaN;
    expect(evaluateGroundGlassApertureGatherR3(nonFinite, thresholds).qualityDecision.status)
      .toBe("invalid-comparison");
  });
});
