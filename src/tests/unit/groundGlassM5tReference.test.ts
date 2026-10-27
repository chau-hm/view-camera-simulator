import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_M5T_FIXED_GRID_RESOLUTION,
  compareGroundGlassM5tPixelEstimates,
  evaluateGroundGlassM5tReferenceEvidence,
  groundGlassM5tUnitDiskRightSegmentArea,
  runGroundGlassM5tAdaptiveQuadrature,
  runGroundGlassM5tFixedGridReference,
  type GroundGlassM5tFarReferenceInput,
  type GroundGlassM5tInputFingerprints,
  type GroundGlassM5tPixelComparison,
} from "../../render/webgpu/groundGlassM5tQuadrature";
import {
  analyzeGroundGlassM5tEdgeSpread,
  analyzeGroundGlassM5tLineSpread,
  compareGroundGlassM5tSpatialProfiles,
  createGroundGlassM5tSpatialProfile,
  evaluateGroundGlassM5tEvidenceScope,
  validateGroundGlassM5tRoiSelection,
  type GroundGlassM5tSpatialProfile,
} from "../../render/webgpu/groundGlassM5tSpatialBlurAnalysis";

const fingerprints: GroundGlassM5tInputFingerprints = {
  sourceColor: "source-v1",
  depth: "depth-v1",
  physical: "physical-v1",
  validity: "validity-v1",
};

const makeInput = (options: Readonly<{
  size?: number;
  centerX?: number;
  centerY?: number;
  majorRadiusPx?: number;
  minorRadiusPx?: number;
  orientationRad?: number;
  maximumRadiusPx?: number;
  sourceColor?: (x: number, y: number) => readonly [number, number, number];
  valid?: (x: number, y: number) => boolean;
  signedCoc?: (x: number, y: number) => number;
  depth?: (x: number, y: number) => number;
}> = {}): GroundGlassM5tFarReferenceInput => {
  const size = options.size ?? 129;
  const centerX = options.centerX ?? Math.floor(size / 2);
  const centerY = options.centerY ?? Math.floor(size / 2);
  const sourceRgba = new Float32Array(size * size * 4);
  const physicalRgba = new Float32Array(size * size * 4);
  const validity = new Uint8Array(size * size);
  const depth = new Float32Array(size * size);
  const orientation = (options.orientationRad ?? 0) / Math.PI;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const id = y * size + x;
      const color = options.sourceColor?.(x, y) ?? [0.2, 0.4, 0.6];
      sourceRgba.set([color[0], color[1], color[2], 1], id * 4);
      physicalRgba.set([options.signedCoc?.(x, y) ?? 1,
        options.majorRadiusPx ?? 24, options.minorRadiusPx ?? 24, orientation], id * 4);
      validity[id] = options.valid?.(x, y) === false ? 0 : 1;
      depth[id] = options.depth?.(x, y) ?? 0.5;
    }
  }
  return {
    source: { widthPx: size, heightPx: size },
    gather: { widthPx: 1, heightPx: 1 },
    film: { widthMm: size, heightMm: size },
    sourceRgba,
    physicalRgba,
    validity,
    depth,
    observedGatherCenterSourceIds: new Int32Array([centerX, centerY]),
    observedGatherCenterSourceUvs: new Float32Array([(centerX + 0.5) / size, (centerY + 0.5) / size]),
    inverseProjectionMatrix: new Float64Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]),
    maximumRadiusPx: options.maximumRadiusPx ?? 64,
    inputFingerprints: fingerprints,
  };
};

const adaptive = (
  referenceInput: GroundGlassM5tFarReferenceInput,
  options: Readonly<{ resolution?: 32 | 64 | 128 | 256; depth?: number; budget?: number }> = {},
) => runGroundGlassM5tAdaptiveQuadrature({
  referenceInput,
  selectedGatherPixelIds: [0],
  initialResolution: options.resolution ?? 32,
  maximumDepth: options.depth ?? 8,
  maxEvaluationsPerPixel: options.budget,
});

const measuredComparison = (areaRelativeError = 0.0001, rmse = 0.0001): GroundGlassM5tPixelComparison => ({
  gatherPixelId: 0,
  acceptedAreaAbsoluteError: areaRelativeError,
  acceptedAreaRelativeError: areaRelativeError,
  rgb: { status: "measured", valueCount: 3, rmse, maximumChannelError: rmse, maximumErrorIndex: 0 },
});

const evaluate = (overrides: Partial<Parameters<typeof evaluateGroundGlassM5tReferenceEvidence>[0]> = {}) =>
  evaluateGroundGlassM5tReferenceEvidence({
    inputFingerprintSets: [fingerprints, fingerprints],
    refinementComparisons: [measuredComparison()],
    fixedGridComparisons: [measuredComparison()],
    comparedPixelCount: 10,
    requiredPixelCount: 10,
    latestUnresolvedAreaFractions: [0.0001],
    analyticControlsPassed: true,
    ...overrides,
  });

const makeProfile = (
  values: readonly number[],
  options: Readonly<{ roiId?: string; y?: number; xStart?: number }> = {},
): GroundGlassM5tSpatialProfile => createGroundGlassM5tSpatialProfile({
  roiId: options.roiId ?? "controlled-edge",
  captureId: "fixture-capture",
  evidenceScope: "controlled-synthetic-fixture",
  colorDomain: "source-target-readback-values",
  valueConvention: "source-target-readback-channel-r",
  samples: values.map((value, index) => ({ xPx: (options.xStart ?? 0) + index, yPx: options.y ?? 0, value })),
});

describe("Ground Glass M5T independent aperture quadrature", () => {
  it("N1: a one-texel RGB mutation changes the actual conditional integral", () => {
    const baseline = makeInput({ majorRadiusPx: 2, minorRadiusPx: 2, sourceColor: () => [0.2, 0.2, 0.2] });
    const changed = makeInput({ majorRadiusPx: 2, minorRadiusPx: 2, sourceColor: () => [0.2, 0.2, 0.2] });
    const center = 65 * 129 + 65;
    changed.sourceRgba.set([1, 1, 1, 1], center * 4);
    const before = adaptive(baseline, { depth: 7 }).pixels[0]!;
    const after = adaptive(changed, { depth: 7 }).pixels[0]!;
    const comparison = compareGroundGlassM5tPixelEstimates([before], [after])[0]!;
    expect(before.conditionalMeanRgb).not.toBeNull();
    expect(comparison.rgb.status).toBe("measured");
    expect(comparison.rgb.maximumChannelError, JSON.stringify({
      before: before.conditionalMeanRgb, after: after.conditionalMeanRgb,
      evaluatedPoints: before.evaluatedPoints, sourceId: center,
    })).toBeGreaterThan(0);
  });

  it("A/B/C: uniform, affine, and offset planar boundaries match independent analytic expectations", () => {
    const uniform = adaptive(makeInput({ sourceColor: () => [0.12, 0.55, 0.91] }), { depth: 7 }).pixels[0]!;
    expect(uniform.conditionalMeanRgb?.[0]).toBeCloseTo(0.12, 6);
    expect(uniform.conditionalMeanRgb?.[1]).toBeCloseTo(0.55, 6);
    expect(uniform.conditionalMeanRgb?.[2]).toBeCloseTo(0.91, 6);

    const affine = adaptive(makeInput({ majorRadiusPx: 28, minorRadiusPx: 28,
      sourceColor: (x) => [x / 128, 0.25, 0.5] }), { depth: 7 }).pixels[0]!;
    expect(affine.conditionalMeanRgb?.[0]).toBeGreaterThan(0.48);
    expect(affine.conditionalMeanRgb?.[0]).toBeLessThan(0.52);

    for (const requestedOffset of [-0.35, 0, 0.3]) {
      const radius = 32;
      const boundaryX = Math.round(64.5 + requestedOffset * radius);
      const actualOffset = (boundaryX - 64.5) / radius;
      const input = makeInput({ majorRadiusPx: radius, minorRadiusPx: radius,
        sourceColor: (x) => x >= boundaryX ? [1, 0, 0] : [0, 0, 0] });
      const result = adaptive(input, { depth: 8 }).pixels[0]!;
      const expectedRightArea = groundGlassM5tUnitDiskRightSegmentArea(actualOffset) / Math.PI;
      expect(result.conditionalMeanRgb?.[0], `offset ${requestedOffset}`).toBeCloseTo(expectedRightArea, 1);
      expect(result.estimatedAreaError).toBeGreaterThanOrEqual(0);
    }
  });

  it("D/E/G/H: excludes nearer depth, respects ellipse orientation and radius cap", () => {
    const depthInput = makeInput({ majorRadiusPx: 24, minorRadiusPx: 24,
      sourceColor: (x) => x < 64 ? [1, 0, 0] : [0, 0, 1],
      depth: (x) => x < 64 ? 0.3 : 0.5 });
    const depthResult = adaptive(depthInput, { depth: 7 }).pixels[0]!;
    expect(depthResult.acceptedAreaEstimate).toBeLessThan(Math.PI);
    expect(depthResult.conditionalMeanRgb?.[0]).toBe(0);
    expect(depthResult.conditionalMeanRgb?.[2]).toBe(1);

    const boundaryColor = (x: number) => x >= 74 ? [1, 0, 0] as const : [0, 0, 0] as const;
    const horizontalMajor = adaptive(makeInput({ majorRadiusPx: 40, minorRadiusPx: 10,
      orientationRad: 0, sourceColor: boundaryColor }), { depth: 7 }).pixels[0]!;
    const rotatedMajor = adaptive(makeInput({ majorRadiusPx: 40, minorRadiusPx: 10,
      orientationRad: Math.PI / 2, sourceColor: boundaryColor }), { depth: 7 }).pixels[0]!;
    expect(horizontalMajor.conditionalMeanRgb?.[0]).toBeGreaterThan(rotatedMajor.conditionalMeanRgb?.[0] ?? 1);

    const capped = adaptive(makeInput({ majorRadiusPx: 40, minorRadiusPx: 40, maximumRadiusPx: 5 }), { depth: 6 }).pixels[0]!;
    expect(capped.uncappedMaximumRadiusPx).toBeCloseTo(40);
    expect(capped.effectiveMaximumRadiusPx).toBeCloseTo(5);
    expect(capped.capApplied).toBe(true);
  });

  it("D/E/F/H/K: resolves compact silhouettes, shifted depth edges, rotated ellipses, clamps, and texture phases", () => {
    const silhouetteIntegral = (offset: number) => adaptive(makeInput({
      majorRadiusPx: 30,
      minorRadiusPx: 30,
      sourceColor: (x, y) => (x - (64 + offset)) ** 2 + (y - 64) ** 2 <= 16 ** 2
        ? [1, 0, 0] : [0, 0, 0],
    }), { resolution: 64, depth: 8 }).pixels[0]!;
    const centeredSilhouette = silhouetteIntegral(0);
    const shiftedSilhouette = silhouetteIntegral(24);
    const edgeSilhouette = silhouetteIntegral(44);
    expect(centeredSilhouette.conditionalMeanRgb?.[0]).toBeGreaterThan(shiftedSilhouette.conditionalMeanRgb?.[0] ?? 1);
    expect(shiftedSilhouette.conditionalMeanRgb?.[0]).toBeGreaterThan(edgeSilhouette.conditionalMeanRgb?.[0] ?? 1);
    expect(edgeSilhouette.conditionalMeanRgb?.[0]).toBeGreaterThan(0);

    const depthAreas = [56, 60, 64].map((boundaryX) => adaptive(makeInput({
      majorRadiusPx: 28,
      minorRadiusPx: 28,
      sourceColor: (x) => x < boundaryX ? [1, 0, 0] : [0, 0, 1],
      depth: (x) => x < boundaryX ? 0.3 : 0.5,
    }), { resolution: 64, depth: 7 }).pixels[0]!);
    expect(depthAreas[0]!.acceptedAreaEstimate).toBeGreaterThan(depthAreas[1]!.acceptedAreaEstimate);
    expect(depthAreas[1]!.acceptedAreaEstimate).toBeGreaterThan(depthAreas[2]!.acceptedAreaEstimate);
    expect(depthAreas.every(({ conditionalMeanRgb }) => conditionalMeanRgb?.[0] === 0
      && conditionalMeanRgb[2] === 1)).toBe(true);

    const boundaryColor = (x: number) => x >= 74 ? [1, 0, 0] as const : [0, 0, 0] as const;
    const orientationMeans = [0, Math.PI / 6, Math.PI / 3].map((orientationRad) => adaptive(makeInput({
      majorRadiusPx: 40, minorRadiusPx: 10, orientationRad, sourceColor: boundaryColor,
    }), { resolution: 64, depth: 7 }).pixels[0]!.conditionalMeanRgb?.[0] ?? Number.NaN);
    expect(orientationMeans[0]).toBeGreaterThan(orientationMeans[1]!);
    expect(orientationMeans[1]).toBeGreaterThan(orientationMeans[2]!);

    const edgeInput = makeInput({ size: 129, centerX: 4, centerY: 64,
      majorRadiusPx: 8, minorRadiusPx: 6,
      sourceColor: (x) => x === 0 ? [1, 0, 0] : [0, 0, 1] });
    const edgeResult = adaptive(edgeInput, { resolution: 32, depth: 5 }).pixels[0]!;
    expect(edgeResult.classification).toBe("estimated");
    expect(edgeResult.conditionalMeanRgb?.[0]).toBeGreaterThan(0);

    const textureResults = [2, 4, 8].flatMap((period) => [0, 1].map((phase) => adaptive(makeInput({
      majorRadiusPx: 26,
      minorRadiusPx: 26,
      sourceColor: (x, y) => ((Math.floor((x + phase) / period) + Math.floor(y / period)) % 2)
        ? [1, 1, 1] : [0, 0, 0],
    }), { resolution: 64, depth: 7 }).pixels[0]!));
    expect(textureResults.every((pixel) => pixel.conditionalMeanRgb !== null
      && pixel.cellClassCounts["source-texel-boundary"] > 0)).toBe(true);
    expect(new Set(textureResults.map(({ conditionalMeanRgb }) => conditionalMeanRgb![0])).size).toBeGreaterThan(1);
  });

  it("I/J/N3/N4/N13: empty and unstable accepted areas never become black or a convergence pass", () => {
    const emptyInput = makeInput({ majorRadiusPx: 20, minorRadiusPx: 20, depth: () => 1 });
    const empty = adaptive(emptyInput, { depth: 4 }).pixels[0]!;
    expect(empty.classification).toBe("empty-accepted-area");
    expect(empty.acceptedAreaEstimate).toBe(0);
    expect(empty.conditionalMeanRgb).toBeNull();

    const tinyInput = makeInput({ majorRadiusPx: 30, minorRadiusPx: 30,
      valid: (x, y) => x === 64 && y === 64 });
    const tiny = adaptive(tinyInput, { depth: 2 }).pixels[0]!;
    expect(tiny.unresolvedAreaFraction).toBeGreaterThan(0);
    const unstableArea = evaluate({
      refinementComparisons: [measuredComparison(0.02)],
      latestUnresolvedAreaFractions: [tiny.unresolvedAreaFraction],
    });
    expect(unstableArea.acceptedAreaStable).toBe(false);
    expect(unstableArea.classification).not.toBe("converged-with-independent-support");
    const denominatorMutation = evaluate({ refinementComparisons: [measuredComparison(0.1)] });
    expect(denominatorMutation.acceptedAreaStable).toBe(false);
    expect(denominatorMutation.classification).toBe("converging-but-unresolved");
  });

  it("N5/N6/N23: unresolved boundaries and budget exhaustion fail closed with bounded diagnostics", () => {
    const halfPlane = makeInput({ majorRadiusPx: 32, minorRadiusPx: 32,
      sourceColor: (x) => x >= 65 ? [1, 0, 0] : [0, 0, 0] });
    const noBoundaryRefinement = adaptive(halfPlane, { depth: 0 });
    expect(noBoundaryRefinement.pixels[0]!.unresolvedCellCount).toBeGreaterThan(0);
    expect(noBoundaryRefinement.pixels[0]!.unresolvedAreaFraction).toBeGreaterThan(0);

    const checkerboard = makeInput({ majorRadiusPx: 28, minorRadiusPx: 28,
      sourceColor: (x, y) => (x + y) % 2 ? [1, 1, 1] : [0, 0, 0] });
    const discontinuous = adaptive(checkerboard, { depth: 2 });
    expect(discontinuous.pixels[0]!.cellClassCounts["source-texel-boundary"]).toBeGreaterThan(0);
    expect(discontinuous.pixels[0]!.unresolvedAreaFraction).toBeGreaterThan(0);

    const exhausted = adaptive(makeInput({ majorRadiusPx: 20, minorRadiusPx: 20 }), { depth: 12, budget: 1 });
    expect(exhausted.pixels[0]!.classification).toBe("evaluation-budget-exceeded");
    expect(exhausted.pixels[0]!.evaluatedPoints).toBeLessThanOrEqual(1);
    const budgetEvidence = evaluate({ budgetExceededPixelCount: 1 });
    expect(budgetEvidence.classification).toBe("budget-limited-unresolved");
    expect(budgetEvidence.budgetExceededPixelCount).toBe(1);
    expect(budgetEvidence.reasons.join(" ")).toContain("exhausted the declared evaluation budget");
    const invalidProvenanceStillFailsClosed = evaluate({
      budgetExceededPixelCount: 1,
      inputFingerprintSets: [fingerprints, { ...fingerprints, sourceColor: "different-source" }],
    });
    expect(invalidProvenanceStillFailsClosed.classification).toBe("invalid-comparison");
  });

  it("N7/N9/N10: depth, cap, and asymmetric top-origin source evidence affect the actual integral", () => {
    const withNearRejection = makeInput({ majorRadiusPx: 24, minorRadiusPx: 24,
      sourceColor: (x) => x < 64 ? [1, 0, 0] : [0, 0, 1],
      depth: (x) => x < 64 ? 0.3 : 0.5 });
    const withoutNearLayer = makeInput({ majorRadiusPx: 24, minorRadiusPx: 24,
      sourceColor: (x) => x < 64 ? [1, 0, 0] : [0, 0, 1], depth: () => 0.5 });
    expect(adaptive(withNearRejection).pixels[0]!.conditionalMeanRgb?.[0]).toBe(0);
    expect(adaptive(withoutNearLayer).pixels[0]!.conditionalMeanRgb?.[0]).toBeGreaterThan(0);

    const topOrigin = makeInput({ centerY: 12, centerX: 64, majorRadiusPx: 34, minorRadiusPx: 9,
      orientationRad: Math.PI / 6,
      sourceColor: (_x, y) => y < 12 ? [1, 0, 0] : [0, 0, 0] });
    const topResult = adaptive(topOrigin, { depth: 7 }).pixels[0]!;
    expect(topResult.conditionalMeanRgb?.[0]).toBeGreaterThan(0);
    expect(topResult.cellClassCounts["source-texel-boundary"]).toBeGreaterThan(0);
  });

  it("N11/N12: shared refinement values cannot qualify without analytic and independent support", () => {
    const levelsAgreeButAnalyticFails = evaluate({ analyticControlsPassed: false });
    expect(levelsAgreeButAnalyticFails.classification).toBe("converging-but-unresolved");
    expect(levelsAgreeButAnalyticFails.analyticControlsPassed).toBe(false);

    const fixedGridDisagrees = evaluate({ fixedGridComparisons: [measuredComparison(0.0001, 0.02)] });
    expect(fixedGridDisagrees.classification).toBe("quadrature-method-disagreement");
  });

  it("uses a separate 512 midpoint grid and rejects mismatched or insufficient evidence", () => {
    const input = makeInput({ majorRadiusPx: 18, minorRadiusPx: 18, sourceColor: () => [0.3, 0.5, 0.8] });
    const tree = adaptive(input, { depth: 6 }).pixels[0]!;
    const midpoint = runGroundGlassM5tFixedGridReference({ referenceInput: input, selectedGatherPixelIds: [0] });
    expect(midpoint.method).toBe("independent-square-grid-midpoint");
    expect(midpoint.resolution).toBe(GROUND_GLASS_M5T_FIXED_GRID_RESOLUTION);
    expect(midpoint.evaluatedPoints).toBeLessThanOrEqual(250_000);
    expect(tree.evaluatedPoints).not.toBe(midpoint.pixels[0]!.evaluatedPoints);
    expect(midpoint.pixels[0]!.conditionalMeanRgb?.[1]).toBeCloseTo(0.5, 6);
    expect(midpoint.pixels[0]!.unresolvedArea).toBe(0);

    const budgetExhaustedGrid = runGroundGlassM5tFixedGridReference({
      referenceInput: input, selectedGatherPixelIds: [0], maxEvaluationsPerPixel: 1,
    });
    expect(budgetExhaustedGrid.pixels[0]!.classification).toBe("evaluation-budget-exceeded");
    expect(budgetExhaustedGrid.pixels[0]!.unresolvedArea).toBe(Math.PI);
    const budgetComparison = compareGroundGlassM5tPixelEstimates(
      [tree], budgetExhaustedGrid.pixels,
    )[0]!;
    expect(budgetComparison.rgb.status).toBe("unavailable");
    expect(budgetComparison.acceptedAreaRelativeError).toBeNull();

    const mismatch = evaluate({ inputFingerprintSets: [fingerprints, { ...fingerprints, depth: "changed" }] });
    expect(mismatch.classification).toBe("invalid-comparison");
    const insufficient = evaluate({ comparedPixelCount: 2, requiredPixelCount: 10 });
    expect(insufficient.classification).toBe("insufficient-support");
    expect(insufficient.m5qPromotionAllowed).toBe(false);
  });
});

describe("Ground Glass M5T spatial ESF/LSF analysis", () => {
  const rising = [0, 0, 0.05, 0.15, 0.35, 0.65, 0.85, 0.95, 1, 1, 1];

  it("N14: detects a sharp source substituted for a validated blurred transition", () => {
    const sharp = makeProfile([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
    const blurred = makeProfile(rising);
    const result = compareGroundGlassM5tSpatialProfiles({ reference: blurred, candidate: sharp, sharpSource: sharp });
    expect(analyzeGroundGlassM5tEdgeSpread(blurred).transitionWidth10To90Px).toBeGreaterThan(1);
    expect(result.classification).toBe("sharp-source-substitution");
  });

  it("N15/N16: rejects noncontiguous points and withholds widths without an edge transition", () => {
    const scattered = createGroundGlassM5tSpatialProfile({
      roiId: "scattered", captureId: "fixture", evidenceScope: "controlled-synthetic-fixture",
      colorDomain: "source-target-readback-values", valueConvention: "source-target-readback-channel-r",
      samples: rising.map((value, index) => ({ xPx: index * (index === 5 ? 2 : 1), yPx: 0, value })),
    });
    expect(scattered.status).toBe("invalid-profile");
    expect(analyzeGroundGlassM5tEdgeSpread(scattered).transitionWidth10To90Px).toBeNull();
    const noEdge = analyzeGroundGlassM5tEdgeSpread(makeProfile(Array(11).fill(0.25)));
    expect(noEdge.status).toBe("spatial-profile-insufficient-support");
    expect(noEdge.transitionWidth20To80Px).toBeNull();
  });

  it("N17/N18: reports LSF sidelobes, detects overshoot, and withholds ambiguous FWHM", () => {
    const overshoot = makeProfile([0, 0, 0.05, 0.2, 0.4, 1.2, 0.8, 0.95, 1, 1, 1]);
    const esf = analyzeGroundGlassM5tEdgeSpread(overshoot);
    expect(esf.overshoot).toBeGreaterThan(0.1);
    const lsf = analyzeGroundGlassM5tLineSpread(overshoot, esf);
    expect(lsf.negativeSidelobeMinimum).toBeLessThan(0);
    expect(lsf.integralConsistencyError).toBeLessThan(1e-8);

    const multiplePeaks = makeProfile([0, 0, 0, 0.7, 0.1, 0.8, 1, 1, 1, 1, 1]);
    const multiLsf = analyzeGroundGlassM5tLineSpread(multiplePeaks);
    expect(multiLsf.status).toBe("ambiguous-peaks");
    expect(multiLsf.fwhmPx).toBeNull();
  });

  it("N19: measures foreground-color pull separately from overall profile error", () => {
    const reference = makeProfile(rising);
    const contaminated = makeProfile([0, 0, 0.05, 0.15, 0.35, 0.65, 0.8, 0.75, 0.75, 0.75, 0.75]);
    const result = compareGroundGlassM5tSpatialProfiles({
      reference, candidate: contaminated, foregroundColorSignal: 0,
    });
    expect(result.foregroundLeakageFraction).toBeGreaterThan(0.2);
    expect(result.classification).toBe("foreground-contamination-observed");
  });

  it("N20/N21/N22: rejects candidate-selected ROIs and keeps fixture/M5Q authority separate", () => {
    const invalidRoi = validateGroundGlassM5tRoiSelection({
      roiId: "selected-after-low-error", selectedPixelIds: [1, 2, 3, 4],
      evidenceInputs: ["source", "depth", "physical", "validity"],
      candidateQualityOutputConsulted: true, evidenceScope: "registered-app-adapter",
    });
    expect(invalidRoi.status).toBe("invalid");
    expect(invalidRoi.issues.join(" ")).toContain("candidate/reference error");
    const fixtureScope = evaluateGroundGlassM5tEvidenceScope({
      evidenceScope: "controlled-synthetic-fixture",
      numericClassification: "converged-with-independent-support",
      spatialClassification: "spatial-agreement",
    });
    expect(fixtureScope.classification).toBe("fixture-only");
    expect(fixtureScope.canEstablishRegisteredAppSupport).toBe(false);
    expect(fixtureScope.canPromoteM5q).toBe(false);

    const m5q = JSON.parse(readFileSync("docs/architecture/GROUND_GLASS_M5Q_REVIEW_FIX_2_REPORT.json", "utf8")) as {
      thresholdContract: { revision: string };
      qualificationMatrix: Record<string, { status: string }>;
    };
    expect(m5q.thresholdContract.revision).toBe("m5q-architecture-rise-r186-v3");
    expect(["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"].map((id) => m5q.qualificationMatrix[id]!.status)).toEqual([
      "reference-not-converged", "insufficient-support", "bounded-qualified", "insufficient-support",
      "reference-not-converged", "reference-not-converged", "reference-not-converged",
    ]);
  });

  it("N24: preserves M5S S1/S4 anchor identities and historical classifications", () => {
    const report = JSON.parse(readFileSync("docs/architecture/GROUND_GLASS_M5S_REFERENCE_CONVERGENCE_REPORT.json", "utf8")) as {
      opticalStates: readonly Readonly<{
        opticalStateId: string;
        roiStrata: readonly Readonly<{
          stratum: Readonly<{ id: string; selectedGatherPixelIds: readonly number[] }>;
          evidence: Readonly<{ classification: string }>;
        }>[];
      }>[];
    };
    const primary = report.opticalStates.find(({ opticalStateId }) =>
      opticalStateId === "ar-f3200-f5p6-loupe4-rise0")!;
    const focus = report.opticalStates.find(({ opticalStateId }) =>
      opticalStateId === "ar-f5200-f5p6-full-rise0")!;
    const s1 = primary.roiStrata.find(({ stratum }) => stratum.id === "S1-smooth-valid-far-interior")!;
    const s4 = focus.roiStrata.find(({ stratum }) => stratum.id === "S4-depth-discontinuity-valid-far")!;
    expect(s1.stratum.selectedGatherPixelIds).toEqual([6384, 17781, 33899, 47388, 63961,
      78006, 99883, 118094, 136935, 168492]);
    expect(s1.evidence.classification).toBe("converged-and-cross-validated");
    expect(s4.stratum.selectedGatherPixelIds).toHaveLength(10);
    expect(s4.evidence.classification).toBe("converged-and-cross-validated");
  });
});
