import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  groundGlassViewDistanceMmAtTopUv,
  nearestGroundGlassSourcePixelAtTopUv,
} from "../../render/webgpu/groundGlassApertureGatherReference";
import {
  GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL,
  GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS,
  runGroundGlassM5tAdaptiveQuadrature,
  runGroundGlassM5tFixedGridReference,
  type GroundGlassM5tFarReferenceInput,
  type GroundGlassM5tQuadratureRun,
} from "../../render/webgpu/groundGlassM5tQuadrature";
import {
  evaluateGroundGlassM5uPixelEvidence,
  getGroundGlassM5uR256BaselinePixelEvidence,
  getGroundGlassM5uRequiredM5sReferences,
  runGroundGlassM5uQuadrature,
  summarizeGroundGlassM5uEvidence,
  summarizeGroundGlassM5uR256Costs,
} from "../../render/webgpu/groundGlassM5uQuadrature";

const makeInput = (options: Readonly<{
  size?: number;
  centerX?: number;
  centerY?: number;
  radius?: number;
  minorRadius?: number;
  orientationRad?: number;
  cap?: number;
  sourceColor?: (x: number, y: number) => readonly [number, number, number];
  validity?: (x: number, y: number) => number;
  signedCoc?: (x: number, y: number) => number;
  depth?: (x: number, y: number) => number;
  inverseProjection?: ArrayLike<number>;
  centerUv?: readonly [number, number];
}> = {}): GroundGlassM5tFarReferenceInput => {
  const size = options.size ?? 65;
  const centerX = options.centerX ?? Math.floor(size / 2);
  const centerY = options.centerY ?? Math.floor(size / 2);
  const radius = options.radius ?? 8;
  const minorRadius = options.minorRadius ?? radius;
  const physicalRgba = new Float32Array(size * size * 4);
  const sourceRgba = new Float32Array(size * size * 4);
  const validity = new Uint8Array(size * size);
  const depth = new Float32Array(size * size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const pixelId = y * size + x;
      const offset = pixelId * 4;
      const color = options.sourceColor?.(x, y) ?? [0.2, 0.4, 0.6];
      sourceRgba.set([color[0], color[1], color[2], 1], offset);
      physicalRgba.set([options.signedCoc?.(x, y) ?? 1, radius, minorRadius,
        (options.orientationRad ?? 0) / Math.PI], offset);
      validity[pixelId] = options.validity?.(x, y) ?? 1;
      depth[pixelId] = options.depth?.(x, y) ?? 0.5;
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
    observedGatherCenterSourceUvs: new Float32Array(options.centerUv
      ?? [(centerX + 0.5) / size, (centerY + 0.5) / size]),
    inverseProjectionMatrix: options.inverseProjection ?? new Float64Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]),
    maximumRadiusPx: options.cap ?? 64,
    inputFingerprints: {
      sourceColor: "source-v1", depth: "depth-v1", physical: "physical-v1", validity: "validity-v1",
    },
  };
};

const run = (referenceInput: GroundGlassM5tFarReferenceInput, maxEvaluationsPerPixel?: number) =>
  runGroundGlassM5uQuadrature({
    referenceInput,
    selectedGatherPixelIds: [0],
    maxEvaluationsPerPixel,
  }).pixels[0]!;

const evidenceFingerprints = makeInput().inputFingerprints;
const zeroIndependentComparisons = (gatherPixelId = 0) => [
  {
    reference: "m5t-fixed-grid-512" as const,
    gatherPixelId,
    inputFingerprints: evidenceFingerprints,
    status: "measured" as const,
    rgbRmse: 0,
    maximumChannelError: 0,
    acceptedAreaRelativeError: 0,
    fixedGrid: {
      algorithm: "ground-glass-m5t-fixed-midpoint-v1" as const,
      method: "independent-square-grid-midpoint" as const,
      resolution: 512 as const,
    },
  },
  ...getGroundGlassM5uRequiredM5sReferences().map(({ descriptor, proposalCoordinateFingerprint }) => ({
    reference: "m5s-finite-sampling" as const,
    gatherPixelId,
    inputFingerprints: evidenceFingerprints,
    status: "measured" as const,
    rgbRmse: 0,
    maximumChannelError: 0,
    acceptedAreaRelativeError: null,
    descriptor,
    proposalCoordinateFingerprint,
  })),
];

type PixelEvidenceInput = Parameters<typeof evaluateGroundGlassM5uPixelEvidence>[0];
const evaluateEvidence = (input: Pick<PixelEvidenceInput, "candidate">
  & Partial<Omit<PixelEvidenceInput, "candidate">>) => evaluateGroundGlassM5uPixelEvidence({
  evidenceId: `unit-fixture:${input.candidate.gatherPixelId}`,
  inputFingerprintsMatch: true,
  expectedInputFingerprints: evidenceFingerprints,
  candidateInputFingerprints: evidenceFingerprints,
  analyticControlsPassed: true,
  evidenceScope: "registered-app",
  baselineClassification: "evaluation-budget-exceeded",
  baselinePixel: {
    initialResolution: 256,
    gatherPixelId: input.candidate.gatherPixelId,
    actualPointEvaluations: 250_000,
  },
  independentComparisons: zeroIndependentComparisons(input.candidate.gatherPixelId),
  ...input,
});

describe("Ground Glass M5U texel-footprint quadrature", () => {
  it("N1/N6/N7: conserves unit-disk area across source partitions without integrating outside the disk", () => {
    const input = makeInput({ radius: 12, sourceColor: (x, y) => x === 0 || y === 0
      ? [1, 0, 0] : [0.2, 0.4, 0.6] });
    const pixel = run(input);
    expect(pixel.classification).toBe("integrated");
    expect(pixel.knownPartitionArea).toBeCloseTo(Math.PI, 8);
    expect(pixel.unresolvedArea).toBeLessThan(1e-8);
    expect(pixel.acceptedAreaEstimate).toBeCloseTo(Math.PI, 8);
    expect(pixel.conditionalMeanRgb?.[0]).toBeCloseTo(0.2, 6);
    expect(pixel.acceptedAreaEstimate).toBeLessThanOrEqual(Math.PI + 1e-10);
  });

  it("N6: conserves area when a source-texel edge is tangent to the aperture circle", () => {
    const pixel = run(makeInput({ size: 65, centerX: 23, centerY: 23, radius: 2 }));
    expect(pixel.classification).toBe("integrated");
    expect(pixel.partitionResidual).toBeGreaterThanOrEqual(-1e-8);
    expect(pixel.knownPartitionArea).toBeCloseTo(Math.PI, 8);
    expect(pixel.acceptedAreaEstimate).toBeCloseTo(Math.PI, 8);
  });

  it("N2: preserves an analytic two-color boundary through the source-texel footprint", () => {
    const radius = 16;
    const input = makeInput({ radius, sourceColor: (x) => x >= 33 ? [1, 0, 0] : [0, 0, 0] });
    const pixel = run(input);
    const actualBoundaryOffset = 0.5 / radius;
    const expected = (Math.acos(actualBoundaryOffset)
      - actualBoundaryOffset * Math.sqrt(1 - actualBoundaryOffset ** 2)) / Math.PI;
    expect(pixel.classification).toBe("integrated");
    expect(pixel.conditionalMeanRgb?.[0]).toBeCloseTo(expected, 6);
  });

  it("matches affine and compact-source integrals and keeps small or empty accepted areas explicit", () => {
    const gradient = run(makeInput({ radius: 8, sourceColor: (x, y) => [
      0.5 + (x + 0.5 - 32.5) / 130,
      0.5 + (y + 0.5 - 32.5) / 130,
      0.25,
    ] }));
    expect(gradient.conditionalMeanRgb?.[0]).toBeCloseTo(0.5, 6);
    expect(gradient.conditionalMeanRgb?.[1]).toBeCloseTo(0.5, 6);
    expect(gradient.conditionalMeanRgb?.[2]).toBeCloseTo(0.25, 6);

    const compactSilhouette = run(makeInput({ radius: 8,
      sourceColor: (x, y) => x === 32 && y === 32 ? [1, 0, 0] : [0, 0, 0] }));
    // The source mapping rounds UV to f32 before nearest-texel selection, so
    // the exact implementation boundary differs from the ideal 1/64 square
    // by a few nanounits while remaining within this analytic tolerance.
    expect(compactSilhouette.conditionalMeanRgb?.[0]).toBeCloseTo((1 / 64) / Math.PI, 7);

    const smallAcceptedInput = makeInput({ radius: 8,
      validity: (x, y) => x === 32 && y === 32 ? 1 : 0 });
    const smallAccepted = run(smallAcceptedInput);
    expect(smallAccepted.classification).toBe("integrated");
    expect(smallAccepted.acceptedAreaEstimate).toBeCloseTo(1 / 64, 7);
    const centerRgbOffset = (32 * smallAcceptedInput.source.widthPx + 32) * 4;
    expect(smallAccepted.conditionalMeanRgb).toEqual(
      Array.from(smallAcceptedInput.sourceRgba.slice(centerRgbOffset, centerRgbOffset + 3)),
    );

    const emptyAccepted = run(makeInput({ radius: 8, depth: () => 1 }));
    expect(emptyAccepted.classification).toBe("empty-accepted-area");
    expect(emptyAccepted.knownPartitionArea).toBeCloseTo(Math.PI, 8);
    expect(emptyAccepted.acceptedAreaEstimate).toBe(0);
    expect(emptyAccepted.conditionalMeanRgb).toBeNull();
  });

  it("N2: preserves high-frequency texel changes, thin strips, offset segments, and a near-tangent footprint", () => {
    const checker = makeInput({ radius: 8, sourceColor: (x, y) => (x + y) % 2 === 0
      ? [1, 0, 0] : [0, 0, 1] });
    const checkerResult = run(checker);
    const fixedChecker = runGroundGlassM5tFixedGridReference({
      referenceInput: checker, selectedGatherPixelIds: [0],
    }).pixels[0]!;
    expect(checkerResult.classification).toBe("integrated");
    expect(Math.abs(checkerResult.conditionalMeanRgb![0] - fixedChecker.conditionalMeanRgb![0])).toBeLessThan(0.001);
    expect(Math.abs(checkerResult.conditionalMeanRgb![2] - fixedChecker.conditionalMeanRgb![2])).toBeLessThan(0.001);

    const radius = 16;
    for (const boundaryX of [24, 32, 40]) {
      const actualOffset = (boundaryX - 32.5) / radius;
      const expectedRight = (Math.acos(actualOffset)
        - actualOffset * Math.sqrt(1 - actualOffset ** 2)) / Math.PI;
      const segment = run(makeInput({ radius, sourceColor: (x) => x >= boundaryX ? [1, 0, 0] : [0, 0, 0] }));
      expect(segment.conditionalMeanRgb?.[0], `boundary source x=${boundaryX}`).toBeCloseTo(expectedRight, 5);
    }

    const strip = run(makeInput({ radius: 16, sourceColor: (x) => x === 33 ? [1, 0, 0] : [0, 0, 0] }));
    expect(strip.classification).toBe("integrated");
    expect(strip.conditionalMeanRgb?.[0]).toBeGreaterThan(0);
    expect(strip.conditionalMeanRgb?.[0]).toBeLessThan(0.1);

    const tangentOffset = 0.98;
    const tangentCenterU = (33 - tangentOffset) / 65;
    const tangent = run(makeInput({ radius: 1, centerUv: [tangentCenterU, 32.5 / 65],
      sourceColor: (x) => x >= 33 ? [1, 0, 0] : [0, 0, 0] }));
    const tangentExpected = (Math.acos(tangentOffset)
      - tangentOffset * Math.sqrt(1 - tangentOffset ** 2)) / Math.PI;
    expect(tangent.classification).toBe("integrated");
    expect(tangent.conditionalMeanRgb?.[0]).toBeCloseTo(tangentExpected, 5);
  });

  it("N3/N12: rejects a same-texel shortcut when UV-dependent view distance can cross eligibility", () => {
    const inverseProjection = new Float64Array([
      1, 0, 100, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const input = makeInput({ radius: 0.05, inverseProjection });
    const centerU = input.observedGatherCenterSourceUvs[0]!;
    const firstUv = Math.fround(centerU - 0.05 / input.source.widthPx);
    const secondUv = Math.fround(centerU + 0.05 / input.source.widthPx);
    expect(nearestGroundGlassSourcePixelAtTopUv(firstUv, 0.5, input.source)[0])
      .toBe(nearestGroundGlassSourcePixelAtTopUv(secondUv, 0.5, input.source)[0]);
    const leftDistance = groundGlassViewDistanceMmAtTopUv(firstUv, 0.5, 0.5, inverseProjection);
    const rightDistance = groundGlassViewDistanceMmAtTopUv(secondUv, 0.5, 0.5, inverseProjection);
    expect(leftDistance).not.toBe(rightDistance);
    expect(run(input).classification).toBe("unsupported-uv-dependent-view-distance");
  });

  it("N4/N5: excludes invalid physical samples and near-side CoC from the Far numerator and denominator", () => {
    const input = makeInput({ radius: 8, sourceColor: () => [1, 0, 0],
      signedCoc: (x) => x < 32 ? -1 : 1,
      validity: (x, y) => x === 33 && y === 32 ? 0 : 1 });
    const pixel = run(input);
    expect(pixel.classification).toBe("integrated");
    expect(pixel.acceptedAreaEstimate).toBeLessThan(Math.PI);
    expect(pixel.conditionalMeanRgb).toEqual([1, 0, 0]);
  });

  it("N6: partitions overlapping disk, clamped-source, and texel boundaries once", () => {
    const edge = makeInput({ centerX: 2, centerY: 32, radius: 8,
      sourceColor: (x) => x === 0 ? [1, 0, 0] : [0, 0, 1] });
    const pixel = run(edge);
    expect(pixel.classification).toBe("integrated");
    expect(pixel.knownPartitionArea).toBeCloseTo(Math.PI, 8);
    expect(pixel.acceptedAreaEstimate).toBeLessThanOrEqual(Math.PI + 1e-10);
    expect(pixel.partitionResidual).toBeLessThan(1e-8);
  });

  it("N8/N9: preserves ellipse orientation and radius-cap activation", () => {
    const sourceColor = (x: number) => x >= 38 ? [1, 0, 0] as const : [0, 0, 0] as const;
    const horizontal = run(makeInput({ radius: 20, minorRadius: 4, sourceColor }));
    const vertical = run(makeInput({ radius: 20, minorRadius: 4,
      orientationRad: Math.PI / 2, sourceColor }));
    expect(horizontal.conditionalMeanRgb?.[0]).toBeGreaterThan(vertical.conditionalMeanRgb?.[0] ?? 1);
    const capped = run(makeInput({ radius: 20, minorRadius: 20, cap: 2 }));
    expect(capped.capApplied).toBe(true);
    expect(capped.effectiveMaximumRadiusPx).toBeCloseTo(2);
  });

  it("N10: retains source-edge clamping contributions", () => {
    const input = makeInput({ centerX: 2, centerY: 32, radius: 8,
      sourceColor: (x) => x === 0 ? [1, 0, 0] : [0, 0, 1] });
    const pixel = run(input);
    expect(pixel.classification).toBe("integrated");
    expect(pixel.conditionalMeanRgb?.[0]).toBeGreaterThan(0);
    expect(pixel.conditionalMeanRgb?.[2]).toBeGreaterThan(0);
  });

  it("N11: honors f32 nearest-texel behavior immediately around a source boundary", () => {
    const boundary = 3 / 8;
    const previousF32 = new Float32Array([boundary])[0]!;
    const previousBits = new Uint32Array(new Float32Array([previousF32]).buffer);
    previousBits[0] -= 1;
    const below = new Float32Array(previousBits.buffer)[0]!;
    const colors = (x: number): readonly [number, number, number] => x === 2 ? [1, 0, 0] : [0, 0, 1];
    const lowerInput = makeInput({ size: 8, centerX: 2, centerY: 4, radius: 0, centerUv: [below, 0.5625], sourceColor: colors });
    const upperInput = makeInput({ size: 8, centerX: 2, centerY: 4, radius: 0, centerUv: [boundary, 0.5625], sourceColor: colors });
    expect(nearestGroundGlassSourcePixelAtTopUv(below, 0.5625, lowerInput.source)[0]).toBe(2);
    expect(nearestGroundGlassSourcePixelAtTopUv(boundary, 0.5625, upperInput.source)[0]).toBe(3);
    expect(run(lowerInput).conditionalMeanRgb?.[0]).toBe(1);
    expect(run(upperInput).conditionalMeanRgb?.[0]).toBe(0);
  });

  it("N13/N14: keeps denominator uncertainty separate from RGB stability", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const withUncertainArea = { ...candidate, estimatedAreaError: 0.02 };
    const evidence = evaluateEvidence({ candidate: withUncertainArea });
    candidate.conditionalMeanRgb!.forEach((value, index) =>
      expect(value).toBeCloseTo([0.2, 0.4, 0.6][index]!, 6));
    expect(evidence.acceptedAreaStable).toBe(false);
    expect(evidence.classification).toBe("unresolved");
  });

  it("N13: rejects a corrupted accepted-area comparison even when RGB agrees", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const comparisons = zeroIndependentComparisons(candidate.gatherPixelId).map((comparison) =>
      comparison.reference === "m5t-fixed-grid-512"
        ? { ...comparison, acceptedAreaRelativeError: 0.1 }
        : comparison);
    const evidence = evaluateEvidence({ candidate, independentComparisons: comparisons });
    expect(evidence.rgbStable).toBe(true);
    expect(evidence.acceptedAreaStable).toBe(false);
    expect(evidence.classification).toBe("unresolved");
  });

  it("N15: enforces the unchanged 250000 integrand-evaluation ceiling", () => {
    const result = runGroundGlassM5uQuadrature({ referenceInput: makeInput({ radius: 20 }),
      selectedGatherPixelIds: [0], maxEvaluationsPerPixel: 1 });
    expect(result.pixels[0]!.classification).toBe("evaluation-budget-exceeded");
    expect(result.pixels[0]!.integrandEvaluations).toBeLessThanOrEqual(1);
    expect(result.evaluationBudgetPerPixel).toBe(1);
    expect(GROUND_GLASS_M5T_MAX_EVALUATIONS_PER_PIXEL).toBe(250_000);
  });

  it("N16: recomputes after source mutation and has no cross-input integrand cache", () => {
    const input = makeInput({ radius: 0 });
    const before = run(input);
    input.sourceRgba.fill(1);
    const after = run(input);
    before.conditionalMeanRgb!.forEach((value, index) =>
      expect(value).toBeCloseTo([0.2, 0.4, 0.6][index]!, 6));
    expect(after.conditionalMeanRgb).toEqual([1, 1, 1]);
  });

  it("N17: lower evaluation count cannot overrule independent RGB disagreement", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const comparisons = zeroIndependentComparisons(candidate.gatherPixelId).map((comparison, index) =>
      comparison.reference === "m5s-finite-sampling" && index === 1
        ? { ...comparison, rgbRmse: 0.1, maximumChannelError: 0.2 }
        : comparison);
    const evidence = evaluateEvidence({ candidate, independentComparisons: comparisons });
    expect(evidence.evaluationReductionRatio).toBeGreaterThan(0.99);
    expect(evidence.rgbStable).toBe(false);
    expect(evidence.classification).toBe("unresolved");
  });

  it("N18: agreement with the old adaptive estimate cannot overrule a failed analytic control", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const comparisons = zeroIndependentComparisons(candidate.gatherPixelId);
    const evidence = evaluateEvidence({
      analyticControlsPassed: false,
      candidate,
      independentComparisons: [
        { reference: "m5t-adaptive", gatherPixelId: candidate.gatherPixelId,
          inputFingerprints: evidenceFingerprints, status: "measured", rgbRmse: 0,
          maximumChannelError: 0, acceptedAreaRelativeError: 0 },
        ...comparisons,
      ],
    });
    expect(evidence.analyticControlsPassed).toBe(false);
    expect(evidence.rgbStable).toBe(true);
    expect(evidence.classification).toBe("unresolved");
  });

  it("N19: agreement with one finite M5S method cannot hide disagreement with another", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const comparisons = zeroIndependentComparisons(candidate.gatherPixelId).map((comparison, index) => {
      if (comparison.reference === "m5s-finite-sampling" && index === 1) {
        return { ...comparison, rgbRmse: 0.1, maximumChannelError: 0.2 };
      }
      return comparison;
    });
    const evidence = evaluateEvidence({ candidate, independentComparisons: comparisons });
    expect(evidence.rgbStable).toBe(false);
    expect(evidence.classification).toBe("unresolved");
  });

  it("N20/N21/N24: partial and fixture-only results cannot support registered pixels, M5Q, M6 quality, or production", () => {
    const partial = run(makeInput({ radius: 20 }), 1);
    const evidence = evaluateEvidence({ candidate: partial, evidenceScope: "controlled-fixture" });
    expect(evidence.candidateResolved).toBe(false);
    expect(evidence.classification).toBe("unresolved");
    expect(evidence.m5qPromotionAllowed).toBe(false);
    expect(evidence.m6QualityPresentationAllowed).toBe(false);
    expect(evidence.productionWebGpuAllowed).toBe(false);
  });

  it("M5U-F1: requires and accepts the complete fixed-grid plus four-method M5S matrix", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const evidence = evaluateEvidence({ candidate });
    expect(evidence.referenceMatrix).toMatchObject({
      status: "complete", requiredReferenceCount: 5, measuredReferenceCount: 5,
      missingReferences: [], unavailableReferences: [], duplicateIdentities: [], mismatchedIdentities: [],
    });
    expect(evidence.rgbStable).toBe(true);
    expect(evidence.classification).toBe("supported");
  });

  it("M5U-F2/F10/F13: one unavailable M5S method stays unresolved without invalidating completed integration", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const comparisons = zeroIndependentComparisons(candidate.gatherPixelId).map((comparison, index) =>
      comparison.reference === "m5s-finite-sampling" && index === 1
        ? { ...comparison, status: "unavailable" as const, rgbRmse: null, maximumChannelError: null }
        : comparison);
    const evidence = evaluateEvidence({ candidate, independentComparisons: comparisons });
    expect(evidence.candidateResolved).toBe(true);
    expect(evidence.referenceMatrix.status).toBe("incomplete");
    expect(evidence.referenceMatrix.unavailableReferences).toHaveLength(1);
    expect(evidence.rgbStable).toBe(false);
    expect(evidence.classification).toBe("unresolved");
  });

  it("M5U-F3/F4: omitted Halton or stratified seed 130363 cannot establish support", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const complete = zeroIndependentComparisons(candidate.gatherPixelId);
    for (const omitted of [
      (comparison: (typeof complete)[number]) => comparison.reference === "m5s-finite-sampling"
        && comparison.descriptor.method === "halton-2-3-progressive",
      (comparison: (typeof complete)[number]) => comparison.reference === "m5s-finite-sampling"
        && comparison.descriptor.seed === 130363,
    ]) {
      const evidence = evaluateEvidence({ candidate, independentComparisons: complete.filter((item) => !omitted(item)) });
      expect(evidence.rgbStable).toBe(false);
      expect(evidence.referenceMatrix.status).toBe("incomplete");
      expect(evidence.referenceMatrix.missingReferences).toHaveLength(1);
      expect(evidence.classification).toBe("unresolved");
    }
  });

  it("M5U-F5: duplicate seed identity is invalid and cannot stand in for the missing independent seed", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const complete = zeroIndependentComparisons(candidate.gatherPixelId);
    const seedA = complete.find((item) => item.reference === "m5s-finite-sampling" && item.descriptor.seed === 104729)!;
    const withoutSeedB = complete.filter((item) => !(item.reference === "m5s-finite-sampling"
      && item.descriptor.seed === 130363));
    const evidence = evaluateEvidence({ candidate, independentComparisons: [...withoutSeedB, { ...seedA }] });
    expect(evidence.referenceMatrix.status).toBe("invalid-comparison");
    expect(evidence.referenceMatrix.duplicateIdentities).toHaveLength(1);
    expect(evidence.referenceMatrix.missingReferences).toHaveLength(1);
    expect(evidence.classification).toBe("invalid-comparison");
  });

  it("M5U-F6/F7: incorrect sequence identity or sample count is rejected visibly", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const complete = zeroIndependentComparisons(candidate.gatherPixelId);
    type M5sComparison = Extract<(typeof complete)[number], { reference: "m5s-finite-sampling" }>;
    const golden = complete.find((item): item is M5sComparison => item.reference === "m5s-finite-sampling"
      && item.descriptor.method === "golden-angle-count-dependent")!;
    for (const mutated of [
      { ...golden, descriptor: { ...golden.descriptor, sequenceId: "wrong-sequence" } },
      { ...golden, descriptor: { ...golden.descriptor, sampleCount: 512 as const } },
    ]) {
      const evidence = evaluateEvidence({ candidate, independentComparisons: complete.map((item) => item === golden ? mutated : item) });
      expect(evidence.referenceMatrix.status).toBe("invalid-comparison");
      expect(evidence.referenceMatrix.mismatchedIdentities.length).toBeGreaterThan(0);
      expect(evidence.classification).toBe("invalid-comparison");
    }
  });

  it("M5U-F8/F9: nonfinite or null measured comparison metrics fail closed", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const complete = zeroIndependentComparisons(candidate.gatherPixelId);
    const halton = complete.find((item) => item.reference === "m5s-finite-sampling"
      && item.descriptor.method === "halton-2-3-progressive")!;
    for (const mutated of [
      { ...halton, rgbRmse: Number.NaN },
      { ...halton, maximumChannelError: Number.POSITIVE_INFINITY },
      { ...halton, rgbRmse: null },
    ]) {
      const evidence = evaluateEvidence({ candidate, independentComparisons: complete.map((item) => item === halton ? mutated : item) });
      expect(evidence.referenceMatrix.status).toBe("invalid-comparison");
      expect(evidence.rgbStable).toBe(false);
      expect(evidence.classification).toBe("invalid-comparison");
    }
  });

  it("M5U-F11: unavailable or mismatched historical adaptive output remains optional", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const adaptive = {
      reference: "m5t-adaptive" as const,
      gatherPixelId: candidate.gatherPixelId,
      inputFingerprints: { ...evidenceFingerprints, depth: "unmatched-historical-diagnostic" },
      status: "unavailable" as const,
      rgbRmse: null,
      maximumChannelError: null,
      acceptedAreaRelativeError: null,
    };
    const evidence = evaluateEvidence({ candidate,
      independentComparisons: [...zeroIndependentComparisons(candidate.gatherPixelId), adaptive] });
    expect(evidence.referenceMatrix.status).toBe("complete");
    expect(evidence.rgbStable).toBe(true);
    expect(evidence.classification).toBe("supported");
  });

  it("M5U-F12: required evidence from mismatched pixel input provenance is invalid", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const comparisons = zeroIndependentComparisons(candidate.gatherPixelId).map((comparison) =>
      comparison.reference === "m5s-finite-sampling" && comparison.descriptor.seed === 104729
        ? { ...comparison, inputFingerprints: { ...evidenceFingerprints, depth: "stale-depth" } }
        : comparison);
    const evidence = evaluateEvidence({ candidate, independentComparisons: comparisons });
    expect(evidence.referenceMatrix.status).toBe("invalid-comparison");
    expect(evidence.referenceMatrix.mismatchedIdentities).toContain(
      "seeded-stratified-square-to-disk:N1024:seed=104729:seeded-jittered-equal-area-square-grid-concentric-v1:input-fingerprints",
    );
    expect(evidence.classification).toBe("invalid-comparison");
  });

  it("M5U-F14: per-pixel reduction uses the matching R256 pixel's actual count", () => {
    const result = run(makeInput({ radius: 8 }));
    const candidate = { ...result, integrandEvaluations: 40 };
    const evidence = evaluateEvidence({ candidate,
      baselinePixel: { initialResolution: 256, gatherPixelId: result.gatherPixelId, actualPointEvaluations: 200_000 } });
    expect(evidence.baselineActualPointEvaluations).toBe(200_000);
    expect(evidence.candidateActualIntegrandEvaluations).toBe(40);
    expect(evidence.evaluationReductionRatio).toBe(1 - 40 / 200_000);
  });

  it("M5U-F15/F16: extracts R256 actual pixel work, never batch charged calls", () => {
    const result = run(makeInput({ radius: 8 }));
    const baselinePixel = (gatherPixelId: number, actualPointEvaluations: number) => ({
      gatherPixelId,
      costBreakdown: { actualPointEvaluations },
    });
    const batch = {
      initialResolution: 256,
      pixels: [baselinePixel(0, 200_000), baselinePixel(1, 190_000)],
      evaluatedPoints: 2_500_000,
      costBreakdown: { actualPointEvaluations: 390_000, budgetChargedEvaluationUnits: 2_500_000 },
    } as unknown as GroundGlassM5tQuadratureRun;
    const extracted = getGroundGlassM5uR256BaselinePixelEvidence(batch, 1);
    expect(extracted).toEqual({ initialResolution: 256, gatherPixelId: 1, actualPointEvaluations: 190_000 });
    const candidate = { ...result, gatherPixelId: 1, integrandEvaluations: 40 };
    const evidence = evaluateEvidence({ candidate, baselinePixel: extracted });
    expect(evidence.evaluationReductionRatio).toBe(1 - 40 / 190_000);
    expect(evidence.evaluationReductionRatio).not.toBe(1 - 40 / 2_500_000);
  });

  it("M5U-F17/F18: zero baseline yields no ratio and batch timing is never exposed as per-pixel time", () => {
    const result = run(makeInput({ radius: 8 }));
    const evidence = evaluateEvidence({ candidate: result,
      baselinePixel: { initialResolution: 256, gatherPixelId: result.gatherPixelId, actualPointEvaluations: 0 } });
    expect(evidence.evaluationReductionRatio).toBeNull();
    expect(evidence.evaluationReductionUnavailableReason).toMatch(/zero actual point evaluations/);
    expect("elapsedTimeRatio" in evidence).toBe(false);
  });

  it("M5U-F19: R256 per-pixel cost sums conserve the corresponding baseline and candidate batches", () => {
    const base = run(makeInput({ radius: 8 }));
    const evidence = [0, 1].map((gatherPixelId, index) => evaluateEvidence({
      candidate: { ...base, gatherPixelId, integrandEvaluations: 40 + index },
      independentComparisons: zeroIndependentComparisons(gatherPixelId),
      baselinePixel: { initialResolution: 256, gatherPixelId, actualPointEvaluations: 200_000 + index },
    }));
    const summary = summarizeGroundGlassM5uR256Costs({
      evidence,
      expectedBaselineActualPointEvaluations: 400_001,
      expectedCandidateActualIntegrandEvaluations: 81,
    });
    expect(summary.status).toBe("conserved");
    expect(summary.evaluationReductionRatio).toBe(1 - 81 / 400_001);
    expect(summarizeGroundGlassM5uR256Costs({ ...{
      evidence,
      expectedBaselineActualPointEvaluations: 400_002,
      expectedCandidateActualIntegrandEvaluations: 81,
    } }).status).toBe("mismatch");
  });

  it("M5U-F20/F21: classification counts conserve the 50-pixel population and cannot promote M5Q or production", () => {
    const base = run(makeInput({ radius: 8 }));
    const pixels = Array.from({ length: 50 }, (_, gatherPixelId) => evaluateEvidence({
      candidate: { ...base, gatherPixelId },
      independentComparisons: zeroIndependentComparisons(gatherPixelId),
      baselinePixel: { initialResolution: 256, gatherPixelId, actualPointEvaluations: 200_000 },
    }));
    const counts = summarizeGroundGlassM5uEvidence(pixels);
    expect(counts).toEqual({ pixelCount: 50, supported: 50, unresolved: 0, invalidComparison: 0, countsConserved: true });
    const failedEvidence = evaluateEvidence({
      candidate: base,
      independentComparisons: zeroIndependentComparisons(base.gatherPixelId).filter((comparison) =>
        comparison.reference !== "m5s-finite-sampling" || comparison.descriptor.seed !== 130363),
    });
    expect(failedEvidence.candidateResolved).toBe(true);
    expect(failedEvidence.classification).toBe("unresolved");
    expect(failedEvidence.m5qPromotionAllowed).toBe(false);
    expect(failedEvidence.m6QualityPresentationAllowed).toBe(false);
    expect(failedEvidence.productionWebGpuAllowed).toBe(false);
  });

  it("M5U-F22: serialized evidence preserves computed matrix, counts, and bounded disposition", () => {
    const candidate = run(makeInput({ radius: 8 }));
    const evidence = evaluateEvidence({ candidate });
    const counts = summarizeGroundGlassM5uEvidence([evidence]);
    const report = JSON.parse(JSON.stringify({
      evidence: [evidence],
      classificationCounts: counts,
      researchClosure: { m5qPromotionAllowed: evidence.m5qPromotionAllowed,
        m6QualityPresentationAllowed: evidence.m6QualityPresentationAllowed,
        productionWebGpuAllowed: evidence.productionWebGpuAllowed },
    })) as {
      evidence: typeof evidence[];
      classificationCounts: typeof counts;
      researchClosure: { m5qPromotionAllowed: boolean; m6QualityPresentationAllowed: boolean; productionWebGpuAllowed: boolean };
    };
    expect(report.evidence[0]!.referenceMatrix.status).toBe("complete");
    expect(report.evidence[0]!.classification).toBe("supported");
    expect(report.classificationCounts.supported).toBe(1);
    expect(report.classificationCounts.countsConserved).toBe(true);
    expect(report.researchClosure).toEqual({
      m5qPromotionAllowed: false, m6QualityPresentationAllowed: false, productionWebGpuAllowed: false,
    });
  });

  it("N22/N23: leaves historical M5S anchors and frozen M5Q statuses untouched", () => {
    const m5tReport = JSON.parse(readFileSync(
      "docs/architecture/GROUND_GLASS_M5T_QUADRATURE_SPATIAL_VALIDATION_REPORT.json", "utf8")) as {
        m5sRegressionAnchors: Record<string, { selectedGatherPixelIds: number[]; historicalM5sClassification: string }>;
      };
    expect(m5tReport.m5sRegressionAnchors.primary4xS1.selectedGatherPixelIds).toEqual(
      [6384, 17781, 33899, 47388, 63961, 78006, 99883, 118094, 136935, 168492]);
    expect(m5tReport.m5sRegressionAnchors.focusDistanceS4.selectedGatherPixelIds).toEqual(
      [63186, 120251, 133286, 133668, 134044, 134427, 139867, 140295, 140723, 141145]);
    const m5q = JSON.parse(readFileSync("docs/architecture/GROUND_GLASS_M5Q_FROZEN_THRESHOLDS.json", "utf8")) as {
      revision: string;
    };
    const reviewFix = JSON.parse(readFileSync("docs/architecture/GROUND_GLASS_M5Q_REVIEW_FIX_2_REPORT.json", "utf8")) as {
      qualificationMatrix: Record<string, { status: string }>;
    };
    expect(m5q.revision).toBe("m5q-architecture-rise-r186-v3");
    expect(Object.fromEntries(Object.entries(reviewFix.qualificationMatrix).map(([key, value]) => [key, value.status]))).toEqual({
      Q1: "reference-not-converged", Q2: "insufficient-support", Q3: "bounded-qualified",
      Q4: "insufficient-support", Q5: "reference-not-converged", Q6: "reference-not-converged",
      Q7: "reference-not-converged",
    });
  });

  it("keeps M5T's original resolution sequence and cost accounting independent from M5U", () => {
    expect(GROUND_GLASS_M5T_QUADRATURE_RESOLUTIONS).toEqual([32, 64, 128, 256]);
    const result = runGroundGlassM5tAdaptiveQuadrature({ referenceInput: makeInput({ radius: 8 }),
      selectedGatherPixelIds: [0], initialResolution: 8 });
    expect(result.costBreakdown.initialRootCellCount).toBe(64);
    expect(result.costBreakdown.rootCellsOutsideDisk + result.costBreakdown.rootCellsInsideDisk
      + result.costBreakdown.rootCellsCrossingDisk).toBe(64);
    expect(result.costBreakdown.budgetChargedEvaluationUnits).toBe(result.evaluatedPoints);
    expect(result.costBreakdown.pointFunctionCalls).toBeGreaterThanOrEqual(result.costBreakdown.actualPointEvaluations);
    expect(result.costBreakdown.depthProbeEvaluations).toBeGreaterThanOrEqual(0);
    expect(result.costBreakdown.estimatedPeakWorkingMemoryBytes).toBeGreaterThan(0);
  });

  it("keeps the fixed 512 grid independent from the new geometry method", () => {
    const referenceInput = makeInput({ radius: 8 });
    const fixed = runGroundGlassM5tFixedGridReference({ referenceInput, selectedGatherPixelIds: [0] });
    const candidate = runGroundGlassM5uQuadrature({ referenceInput, selectedGatherPixelIds: [0] });
    expect(fixed.resolution).toBe(512);
    expect(fixed.evaluatedPoints).toBeGreaterThan(0);
    expect(candidate.pixels[0]!.sourceTexelRegions).toBeGreaterThan(0);
    expect(candidate.pixels[0]!.integrandEvaluations).toBeLessThan(fixed.evaluatedPoints);
  });
});
