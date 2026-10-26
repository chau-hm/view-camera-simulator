import { describe, expect, it } from "vitest";
import {
  GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT,
  capGroundGlassPixelEllipse,
  groundGlassGoldenAngleDiskProposal,
  groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting,
  groundGlassViewDistanceMmAtTopUv,
  mapGroundGlassPhysicalEllipseToSourcePixels,
  nearestGroundGlassSourcePixelAtTopUv,
  referenceGroundGlassApertureGather,
  referenceGroundGlassApertureGatherDiagnostic,
  referenceGroundGlassApertureGatherNestedGoldenAngle64ForTesting,
  type GroundGlassApertureGatherDiagnosticInput,
  type GroundGlassApertureGatherReferenceInput,
  type GroundGlassApertureDimensions,
} from "../../render/webgpu/groundGlassApertureGatherReference";

const identityProjectionInverse = (): Float64Array => new Float64Array([
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
]);

const makeInput = (
  source: GroundGlassApertureDimensions = { widthPx: 5, heightPx: 5 },
  gather: GroundGlassApertureDimensions = source,
): GroundGlassApertureGatherReferenceInput => {
  const sourcePixels = source.widthPx * source.heightPx;
  const sourceRgba = new Float32Array(sourcePixels * 4);
  const physicalRgba = new Float32Array(sourcePixels * 4);
  const validity = new Uint8Array(sourcePixels).fill(1);
  const depth = new Float32Array(sourcePixels).fill(0.5);
  for (let y = 0; y < source.heightPx; y += 1) {
    for (let x = 0; x < source.widthPx; x += 1) {
      const pixel = y * source.widthPx + x;
      sourceRgba.set([pixel / 100, x / 10, y / 10, 1], pixel * 4);
      physicalRgba.set([0, 0, 0, 0], pixel * 4);
    }
  }
  return {
    source,
    gather,
    film: { widthMm: source.widthPx, heightMm: source.heightPx },
    sourceRgba,
    physicalRgba,
    validity,
    depth,
    inverseProjectionMatrix: identityProjectionInverse(),
    sampleCount: 1,
    maximumRadiusPx: 4,
  };
};

const setPhysical = (
  input: GroundGlassApertureGatherReferenceInput,
  x: number,
  y: number,
  rgba: readonly [number, number, number, number],
) => {
  input.physicalRgba.set(rgba, (y * input.source.widthPx + x) * 4);
};

describe("Ground Glass independent aperture-gather CPU reference", () => {
  it("matches WebGPU f32 nearest-texel selection at a normalized pixel boundary", () => {
    expect(nearestGroundGlassSourcePixelAtTopUv(0.49999999, 0.25, { widthPx: 2, heightPx: 4 }))
      .toEqual([1, 1]);
    expect(nearestGroundGlassSourcePixelAtTopUv(0.49999995, 0.25, { widthPx: 2, heightPx: 4 }))
      .toEqual([0, 1]);
  });

  it("uses top-origin source sampling for reduced gather centers", () => {
    const input = makeInput({ widthPx: 4, heightPx: 4 }, { widthPx: 2, heightPx: 2 });
    for (let index = 0; index < input.validity.length; index += 1) {
      input.physicalRgba[index * 4] = 1;
    }
    const result = referenceGroundGlassApertureGather(input);
    const lowerLeftGatherIndex = 2;
    expect([...result.gatherCenterSourceIds.slice(lowerLeftGatherIndex * 2, lowerLeftGatherIndex * 2 + 2)])
      .toEqual([1, 3]);
    expect([...result.farRgba.slice(lowerLeftGatherIndex * 4, lowerLeftGatherIndex * 4 + 3)])
      .toEqual([...input.sourceRgba.slice((3 * input.source.widthPx + 1) * 4, (3 * input.source.widthPx + 1) * 4 + 3)]);
  });

  it("uses GPU-observed gather-center identity while reporting nominal center mapping separately", () => {
    const input = makeInput({ widthPx: 4, heightPx: 4 }, { widthPx: 2, heightPx: 2 });
    const observed = new Int32Array([0, 0, 3, 1, 1, 3, 3, 3]);
    const result = referenceGroundGlassApertureGather({
      ...input,
      sampleCount: 1,
      maximumRadiusPx: 0,
      observedGatherCenterSourceIds: observed,
    });
    expect([...result.gatherCenterSourceIds.slice(0, 2)]).toEqual([0, 0]);
    expect([...result.nominalGatherCenterSourceIds.slice(0, 2)]).toEqual([1, 1]);
    expect([...result.farRgba.slice(0, 3)]).toEqual([...input.sourceRgba.slice(0, 3)]);
    expect(() => referenceGroundGlassApertureGather({
      ...input,
      observedGatherCenterSourceIds: new Int32Array([4, 0, 3, 1, 1, 3, 3, 3]),
    })).toThrow(/provenance is outside/);
  });

  it("uses the GPU-observed continuous gather-center UV for depth and aperture proposals", () => {
    const inverseProjectionMatrix = identityProjectionInverse();
    inverseProjectionMatrix[2] = 1;
    inverseProjectionMatrix[6] = 1;
    inverseProjectionMatrix[10] = 0;
    const input = {
      ...makeInput({ widthPx: 2, heightPx: 2 }, { widthPx: 1, heightPx: 1 }),
      inverseProjectionMatrix,
    };
    const observed = referenceGroundGlassApertureGather({
      ...input,
      observedGatherCenterSourceIds: new Int32Array([1, 0]),
      observedGatherCenterSourceUvs: new Float32Array([0.75, 0.25]),
    });
    const nominal = referenceGroundGlassApertureGather(input);
    expect(observed.centerViewDistanceMm[0]).toBe(1000);
    expect(nominal.centerViewDistanceMm[0]).toBe(0);
    expect(() => referenceGroundGlassApertureGather({
      ...input,
      observedGatherCenterSourceUvs: new Float32Array([0.5, 0.5, 0.5, 0.5]),
    })).toThrow(/dimensions/);
  });

  it("reconstructs view distance from top-origin UV, normalized depth, and Three.js inverse-projection layout", () => {
    const inverseProjection = identityProjectionInverse();
    inverseProjection[6] = 0.2;
    inverseProjection[14] = -1;
    expect(groundGlassViewDistanceMmAtTopUv(0.5, 0, 0.5, inverseProjection)).toBeCloseTo(300, 8);
    expect(groundGlassViewDistanceMmAtTopUv(0.5, 1, 0.5, inverseProjection)).toBeCloseTo(700, 8);
  });

  it("uses the golden-angle disk proposal sequence deterministically", () => {
    const first = groundGlassGoldenAngleDiskProposal(0, 1);
    expect(first[0]).toBeCloseTo(0.2562377421, 9);
    expect(first[1]).toBeCloseTo(0.6590464472, 9);
  });

  it("keeps the test-only nested variant separately named and selects the 64-master subsets", () => {
    for (const sampleCount of [16, 32, 64] as const) {
      const stride = 64 / sampleCount;
      for (let index = 0; index < sampleCount; index += 1) {
        expect(groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting(index, sampleCount))
          .toEqual(groundGlassGoldenAngleDiskProposal(index * stride, 64));
      }
    }
    expect(groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting(0, 32))
      .not.toEqual(groundGlassGoldenAngleDiskProposal(0, 32));
    expect(() => groundGlassGoldenAngleNestedDiskProposalFrom64ForTesting(16, 16)).toThrow(/index/);
  });

  it("runs the nested sequence through a separately named shared-kernel CPU variant", () => {
    const input = makeInput({ widthPx: 17, heightPx: 17 }, { widthPx: 1, heightPx: 1 });
    for (let y = 0; y < input.source.heightPx; y += 1) {
      for (let x = 0; x < input.source.widthPx; x += 1) {
        const pixel = y * input.source.widthPx + x;
        input.sourceRgba.set([x / 17, y / 17, (x + y) / 34, 1], pixel * 4);
        setPhysical(input, x, y, [1, 6.5, 6.5, 0]);
      }
    }

    const nativeSequence = referenceGroundGlassApertureGather({
      ...input,
      sampleCount: 32,
      maximumRadiusPx: 8,
    });
    const nestedSequence = referenceGroundGlassApertureGatherNestedGoldenAngle64ForTesting({
      ...input,
      sampleCount: 32,
      maximumRadiusPx: 8,
    });

    expect(nestedSequence.farRgba).not.toEqual(nativeSequence.farRgba);
    expect(nestedSequence.nearEvaluatedProposalCount[0]).toBe(32);
    expect(nestedSequence.nearCoverageMass[0]).toBe(nativeSequence.nearCoverageMass[0]);
  });

  it("keeps negative signed CoC in the near layer and out of the far layer", () => {
    const input = makeInput();
    const center = 2 * input.source.widthPx + 2;
    setPhysical(input, 2, 2, [-1, 0, 0, 0]);
    const result = referenceGroundGlassApertureGather(input);
    expect([...result.nearRgba.slice(center * 4, center * 4 + 4)])
      .toEqual([...input.sourceRgba.slice(center * 4, center * 4 + 3), 1]);
    expect([...result.farRgba.slice(center * 4, center * 4 + 3)])
      .toEqual([...input.sourceRgba.slice(center * 4, center * 4 + 3)]);
  });

  it("preserves the strict center sign boundary at plus/minus 0.00001 mm", () => {
    const farInput = makeInput();
    const farCenterIndex = 2 * farInput.source.widthPx + 2;
    const farSampleIndex = 2 * farInput.source.widthPx + 3;
    setPhysical(farInput, 2, 2, [0.00001, 3, 0, 0]);
    setPhysical(farInput, 3, 2, [1, 0, 0, 0]);
    const far = referenceGroundGlassApertureGather(farInput);
    expect([...far.farRgba.slice(farCenterIndex * 4, farCenterIndex * 4 + 3)])
      .toEqual([...farInput.sourceRgba.slice(farCenterIndex * 4, farCenterIndex * 4 + 3)]);
    expect(far.farRgba[farSampleIndex * 4]).toBe(farInput.sourceRgba[farSampleIndex * 4]);

    const nearInput = makeInput();
    const nearCenterIndex = 2 * nearInput.source.widthPx + 2;
    for (let pixel = 0; pixel < nearInput.validity.length; pixel += 1) {
      nearInput.physicalRgba[pixel * 4] = -0.00001;
    }
    const near = referenceGroundGlassApertureGather({ ...nearInput, maximumRadiusPx: 0 });
    expect(near.nearRgba[nearCenterIndex * 4 + 3]).toBe(0);
  });

  it("excludes validity code 4 from far and near sample contribution", () => {
    const input = makeInput();
    const centerX = 2;
    const centerY = 2;
    const centerIndex = centerY * input.source.widthPx + centerX;
    const sampleIndex = centerY * input.source.widthPx + centerX + 1;
    setPhysical(input, centerX, centerY, [1, 3, 0, 0]);
    setPhysical(input, centerX + 1, centerY, [0, 0, 0, 0]);
    input.validity[sampleIndex] = 4;

    const farResult = referenceGroundGlassApertureGather(input);
    expect([...farResult.farRgba.slice(centerIndex * 4, centerIndex * 4 + 3)])
      .toEqual([...input.sourceRgba.slice(centerIndex * 4, centerIndex * 4 + 3)]);

    const nearInput = makeInput();
    for (let index = 0; index < nearInput.validity.length; index += 1) nearInput.validity[index] = 4;
    setPhysical(nearInput, centerX, centerY, [0, 0, 0, 0]);
    setPhysical(nearInput, centerX + 1, centerY, [-1, 4, 4, 0]);
    nearInput.validity[centerIndex] = 1;
    nearInput.validity[sampleIndex] = 4;
    const nearResult = referenceGroundGlassApertureGather({ ...nearInput, maximumRadiusPx: 2 });
    expect(nearResult.nearRgba[centerIndex * 4 + 3]).toBe(0);
    expect(nearResult.nearRgba[centerIndex * 4]).toBe(0);
  });

  it("maps anisotropic physical axes independently and uses the largest singular radius", () => {
    const ellipse = mapGroundGlassPhysicalEllipseToSourcePixels({
      majorRadiusMm: 10,
      minorRadiusMm: 2,
      orientationRad: Math.PI / 4,
      film: { widthMm: 100, heightMm: 100 },
      source: { widthPx: 200, heightPx: 100 },
    });
    expect(ellipse.majorAxisPx[0]).toBeCloseTo(14.1421356, 6);
    expect(ellipse.majorAxisPx[1]).toBeCloseTo(-7.0710678, 6);
    expect(ellipse.minorAxisPx[0]).toBeCloseTo(-2.8284271, 6);
    expect(ellipse.minorAxisPx[1]).toBeCloseTo(-1.4142136, 6);
    expect(ellipse.uncappedMaximumRadiusPx).toBeCloseTo(15.9277484, 6);
  });

  it("applies the cap after source-pixel mapping without mutating physical millimeters", () => {
    const input = makeInput();
    for (let index = 0; index < input.validity.length; index += 1) {
      input.physicalRgba[index * 4] = 1;
    }
    setPhysical(input, 2, 2, [1, 3, 3, 0]);
    const physicalBefore = input.physicalRgba.slice();
    const result = referenceGroundGlassApertureGather({ ...input, maximumRadiusPx: 1 });
    const center = 2 * input.source.widthPx + 2;
    expect(result.farUncappedMaximumRadiusPx[center]).toBeCloseTo(3, 6);
    expect(result.farEffectiveMaximumRadiusPx[center]).toBeCloseTo(1, 6);
    expect(result.farCapApplied[center]).toBe(1);
    expect(input.physicalRgba).toEqual(physicalBefore);
  });

  it("rejects closer far samples and accepts deeper valid far samples through inverse projection", () => {
    const input = makeInput();
    const centerIndex = 2 * input.source.widthPx + 2;
    const proposalIndex = 2 * input.source.widthPx + 3;
    setPhysical(input, 2, 2, [1, 3, 0, 0]);
    setPhysical(input, 3, 2, [-0.00001, 0, 0, 0]);
    input.depth[proposalIndex] = 0.1;
    const closer = referenceGroundGlassApertureGather(input);
    expect([...closer.farRgba.slice(centerIndex * 4, centerIndex * 4 + 3)])
      .toEqual([...input.sourceRgba.slice(centerIndex * 4, centerIndex * 4 + 3)]);

    input.depth[proposalIndex] = 0.9;
    const deeper = referenceGroundGlassApertureGather(input);
    const centerColor = input.sourceRgba.slice(centerIndex * 4, centerIndex * 4 + 3);
    const sampleColor = input.sourceRgba.slice(proposalIndex * 4, proposalIndex * 4 + 3);
    const actual = deeper.farRgba.slice(centerIndex * 4, centerIndex * 4 + 3);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(actual[channel]).toBeCloseTo((centerColor[channel]! + sampleColor[channel]!) / 2, 6);
    }
  });

  it("uses each near candidate's own oriented ellipse and reports nontrivial coverage alpha", () => {
    const input = makeInput();
    for (let index = 0; index < input.validity.length; index += 1) input.validity[index] = 4;
    const centerX = 2;
    const centerY = 2;
    const centerIndex = centerY * input.source.widthPx + centerX;
    const proposalIndex = 3 * input.source.widthPx + 3;
    input.validity[centerIndex] = 1;
    input.validity[proposalIndex] = 1;
    setPhysical(input, centerX, centerY, [0, 0, 0, 0]);
    setPhysical(input, 3, 3, [-1, 0.5, 0.5, 0]);
    const apertureInput = { ...input, maximumRadiusPx: 2, sampleCount: 1 };
    const outside = referenceGroundGlassApertureGather(apertureInput);
    expect(outside.nearRgba[centerIndex * 4 + 3]).toBe(0);

    setPhysical(input, 3, 3, [-1, 4, 4, 0]);
    const inside = referenceGroundGlassApertureGather(apertureInput);
    expect(inside.nearRgba[centerIndex * 4]).toBe(input.sourceRgba[proposalIndex * 4]);
    expect(inside.nearRgba[centerIndex * 4 + 3]).toBeGreaterThan(0);

    for (let index = 0; index < input.validity.length; index += 1) {
      input.validity[index] = 1;
      setPhysical(input, index % input.source.widthPx, Math.floor(index / input.source.widthPx), [-1, 4, 4, 0]);
    }
    setPhysical(input, centerX, centerY, [0, 0, 0, 0]);
    const coverage = referenceGroundGlassApertureGather({ ...input, maximumRadiusPx: 2, sampleCount: 16 });
    const alpha = coverage.nearRgba[centerIndex * 4 + 3]!;
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(1);
  });

  it("returns per-output near proposal intermediates without changing the near-alpha formula", () => {
    const input = makeInput({ widthPx: 5, heightPx: 5 }, { widthPx: 1, heightPx: 1 });
    for (let pixel = 0; pixel < input.validity.length; pixel += 1) {
      setPhysical(input, pixel % input.source.widthPx, Math.floor(pixel / input.source.widthPx), [-1, 4, 4, 0]);
    }
    setPhysical(input, 2, 2, [0, 0, 0, 0]);

    const result = referenceGroundGlassApertureGather({
      ...input,
      maximumRadiusPx: 2,
      sampleCount: 16,
    });
    const estimatedCoverage = 1 - Math.exp(-result.nearCoverageMass[0]! / 16);

    expect(result.nearCenterIsNear[0]).toBe(0);
    expect(result.nearEvaluatedProposalCount[0]).toBe(16);
    expect(result.nearAcceptedProposalCount[0]).toBeGreaterThan(0);
    expect(result.nearAcceptedProposalCount[0]).toBeLessThanOrEqual(result.nearEvaluatedProposalCount[0]!);
    expect(result.nearNonzeroMembershipCount[0]).toBeGreaterThanOrEqual(result.nearAcceptedProposalCount[0]!);
    expect(result.nearWeightSum[0]).toBeGreaterThan(0);
    expect(result.nearCoverageMass[0]).toBeGreaterThan(0);
    expect(result.nearEstimatedCoverage[0]).toBeCloseTo(estimatedCoverage, 7);
    expect(result.nearRgba[3]).toBeCloseTo(estimatedCoverage, 7);
    expect(result.nearAcceptedAreaRatioMean[0]).toBeGreaterThan(0);
    expect(result.nearAcceptedCompensationMaximum[0]).toBeGreaterThan(0);
    expect(result.nearCandidateFootprintEvaluationCount[0]).toBe(16);

    setPhysical(input, 2, 2, [-1, 4, 4, 0]);
    const nearCenter = referenceGroundGlassApertureGather({
      ...input,
      maximumRadiusPx: 2,
      sampleCount: 16,
    });
    expect(nearCenter.nearCenterIsNear[0]).toBe(1);
    expect(nearCenter.nearEstimatedCoverage[0]).toBeLessThan(1);
    expect(nearCenter.nearRgba[3]).toBe(1);
  });

  it("keeps the 64-sample API bound and accepts only 128/256 in the explicit diagnostic API", () => {
    const input = makeInput({ widthPx: 1, heightPx: 1 });
    expect(GROUND_GLASS_APERTURE_MAX_SAMPLE_COUNT).toBe(64);
    expect(referenceGroundGlassApertureGather({ ...input, sampleCount: 64 }).nearEvaluatedProposalCount[0])
      .toBe(64);
    expect(() => referenceGroundGlassApertureGather({ ...input, sampleCount: 65 })).toThrow(/sample count/);

    const diagnosticInput = (sampleCount: number): GroundGlassApertureGatherDiagnosticInput => ({
      ...input,
      sampleCount: sampleCount as 128 | 256,
    });
    expect(referenceGroundGlassApertureGatherDiagnostic(diagnosticInput(128)).nearEvaluatedProposalCount[0])
      .toBe(128);
    expect(referenceGroundGlassApertureGatherDiagnostic(diagnosticInput(256)).nearEvaluatedProposalCount[0])
      .toBe(256);
    expect(() => referenceGroundGlassApertureGatherDiagnostic(diagnosticInput(64))).toThrow(/128 or 256/);
  });

  it("applies near foreground ordering using reconstructed view distances", () => {
    const input = makeInput();
    const centerIndex = 2 * input.source.widthPx + 2;
    const proposalIndex = 3 * input.source.widthPx + 3;
    setPhysical(input, 2, 2, [-1, 4, 4, 0]);
    setPhysical(input, 3, 3, [-1, 4, 4, 0]);
    const inputWithRadiusCap = { ...input, maximumRadiusPx: 2 };
    input.depth[proposalIndex] = 0.9;
    const behind = referenceGroundGlassApertureGather(inputWithRadiusCap);
    expect([...behind.nearRgba.slice(centerIndex * 4, centerIndex * 4 + 3)])
      .toEqual([...input.sourceRgba.slice(centerIndex * 4, centerIndex * 4 + 3)]);

    input.depth[proposalIndex] = 0.1;
    const inFront = referenceGroundGlassApertureGather(inputWithRadiusCap);
    expect(inFront.nearRgba[centerIndex * 4]).not.toBe(input.sourceRgba[centerIndex * 4]);
    expect(inFront.nearRgba[centerIndex * 4 + 3]).toBe(1);
  });

  it("rejects malformed readback dimensions, invalid sample counts, and non-finite depth evidence", () => {
    const input = makeInput();
    expect(() => referenceGroundGlassApertureGather({ ...input, validity: new Uint8Array(1) })).toThrow(/readbacks/);
    expect(() => referenceGroundGlassApertureGather({ ...input, sampleCount: 65 })).toThrow(/sample count/);
    const invalidDepth = input.depth.slice();
    invalidDepth[0] = Number.NaN;
    expect(() => referenceGroundGlassApertureGather({ ...input, depth: invalidDepth })).toThrow(/depth/);
  });

  it("caps singular pixel radius without changing the mapped physical ellipse", () => {
    const ellipse = mapGroundGlassPhysicalEllipseToSourcePixels({
      majorRadiusMm: 3,
      minorRadiusMm: 1,
      orientationRad: 0,
      film: { widthMm: 5, heightMm: 5 },
      source: { widthPx: 5, heightPx: 5 },
    });
    const capped = capGroundGlassPixelEllipse(ellipse, 1);
    expect(ellipse.uncappedMaximumRadiusPx).toBe(3);
    expect(capped.effectiveMaximumRadiusPx).toBe(1);
    expect(capped.capApplied).toBe(true);
    expect(capped.majorAxisPx).toEqual(ellipse.majorAxisPx);
    expect(capped.minorAxisPx).toEqual(ellipse.minorAxisPx);
  });

  it("reports far radius-cap evidence only from valid far centers", () => {
    const input = makeInput();
    setPhysical(input, 1, 1, [1, 100, 0, 0]);
    setPhysical(input, 2, 2, [65504, 1000, 0, 0]);
    input.validity[2 * input.source.widthPx + 2] = 2;

    const result = referenceGroundGlassApertureGather(input);

    expect(result.summary.maximumFarUncappedRadiusPx).toBeCloseTo(100, 10);
    expect(result.summary.farCappedCenterCount).toBe(1);
  });
});
