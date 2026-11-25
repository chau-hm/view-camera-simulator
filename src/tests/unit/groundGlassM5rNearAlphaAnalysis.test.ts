import { describe, expect, it } from "vitest";
import {
  analyzeGroundGlassM5rNearAlpha,
  type GroundGlassM5rNearAlphaCapture,
  type GroundGlassM5rNearAlphaIdentity,
  type GroundGlassM5rNearAlphaIntermediates,
  type GroundGlassM5rNearAlphaCpuCapture,
  type GroundGlassM5rNearAlphaGpuCapture,
} from "../../render/webgpu/groundGlassM5rNearAlphaAnalysis";

const identity = (widthPx = 2, heightPx = 2): GroundGlassM5rNearAlphaIdentity => ({
  captureId: "capture-1",
  requestId: "request-1",
  sceneId: "scene-1",
  inputFingerprint: "physical-inputs-1",
  outputWidthPx: widthPx,
  outputHeightPx: heightPx,
  sampleCount: 4,
  pixelOrder: "top-origin",
});

const makeIntermediates = (
  count: number,
  overrides: Partial<GroundGlassM5rNearAlphaIntermediates> = {},
): GroundGlassM5rNearAlphaIntermediates => ({
  nearCenterIsNear: new Uint8Array(count),
  nearEvaluatedProposalCount: new Uint16Array(count).fill(4),
  nearAcceptedProposalCount: new Uint16Array(count),
  nearNonzeroMembershipCount: new Uint16Array(count),
  nearWeightSum: new Float32Array(count),
  nearCoverageMass: new Float32Array(count),
  nearEstimatedCoverage: new Float32Array(count),
  nearFinalAlpha: new Float32Array(count),
  nearAcceptedAreaRatioMean: new Float32Array(count),
  nearAcceptedCompensationMaximum: new Float32Array(count),
  ...overrides,
});

const makeCapture = (
  side: "gpu" | "cpu",
  options: Readonly<{
    identity?: GroundGlassM5rNearAlphaIdentity;
    intermediates?: GroundGlassM5rNearAlphaIntermediates;
    nearRgba?: Float32Array;
    rawNearAlphaHalfBits?: Uint16Array;
  }> = {},
): GroundGlassM5rNearAlphaGpuCapture | GroundGlassM5rNearAlphaCpuCapture => {
  const currentIdentity = options.identity ?? identity();
  const count = currentIdentity.outputWidthPx * currentIdentity.outputHeightPx;
  const base: GroundGlassM5rNearAlphaCapture = {
    identity: currentIdentity,
    intermediates: options.intermediates ?? makeIntermediates(count),
    nearRgba: options.nearRgba ?? new Float32Array(count * 4),
    ...(options.rawNearAlphaHalfBits !== undefined
      ? { rawNearAlphaHalfBits: options.rawNearAlphaHalfBits }
      : {}),
  };
  return side === "gpu"
    ? {
      ...base,
      renderer: {
        rendererFamily: "webgpu-renderer",
        actualExecutionApi: "webgpu",
        internalFallback: "none",
        rendererGenerationId: "generation-1",
      },
    }
    : { ...base, referenceId: "independent-cpu-near-v1" };
};

const pair = (
  gpu: GroundGlassM5rNearAlphaGpuCapture,
  cpu: GroundGlassM5rNearAlphaCpuCapture,
) => analyzeGroundGlassM5rNearAlpha({ gpu, cpu });

describe("M5R Near alpha research analyzer", () => {
  it("reports zero-only and binary output populations without inventing fractional support", () => {
    const zero = pair(
      makeCapture("gpu") as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu") as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(zero.gpu.outputAlpha).toMatchObject({ zeroCount: 4, oneCount: 0, fractionalCount: 0 });
    expect(zero.gpu.validOffCenterFractionalCoveragePixelCount).toBe(0);

    const binaryAlpha = new Float32Array([
      0, 0, 0, 0,
      0, 0, 0, 1,
      0, 0, 0, 1,
      0, 0, 0, 0,
    ]);
    const binary = pair(
      makeCapture("gpu", { nearRgba: binaryAlpha }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", { nearRgba: binaryAlpha.slice() }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(binary.gpu.outputAlpha).toMatchObject({ zeroCount: 2, oneCount: 2, fractionalCount: 0 });
    expect(binary.nearOutputErrors.alpha.exactMismatchCount).toBe(0);
  });

  it("separates center-Near and off-center accepted versus rejected populations", () => {
    const flags = new Uint8Array([1, 1, 0, 0]);
    const accepted = new Uint16Array([0, 2, 1, 0]);
    const nearAlpha = new Float32Array([
      0, 0, 0, 1,
      0, 0, 0, 1,
      0, 0, 0, 0.5,
      0, 0, 0, 0,
    ]);
    const intermediates = makeIntermediates(4, {
      nearCenterIsNear: flags,
      nearAcceptedProposalCount: accepted,
      nearNonzeroMembershipCount: accepted.slice(),
      nearEstimatedCoverage: new Float32Array([0.1, 0.4, 0.5, 0]),
      nearFinalAlpha: new Float32Array([1, 1, 0.5, 0]),
    });
    const result = pair(
      makeCapture("gpu", { intermediates, nearRgba: nearAlpha }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", { intermediates, nearRgba: nearAlpha.slice() }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(result.gpu.populations.centerNear.all.outputCount).toBe(2);
    expect(result.gpu.populations.centerNear.withAcceptedProposals.outputCount).toBe(1);
    expect(result.gpu.populations.centerNear.withoutAcceptedProposals.outputCount).toBe(1);
    expect(result.gpu.populations.offCenter.withAcceptedProposals.outputCount).toBe(1);
    expect(result.gpu.populations.offCenter.withoutAcceptedProposals.outputCount).toBe(1);
    expect(result.gpu.populations.offCenter.all.acceptedProposalTotal).toBe(1);
    expect(result.gpu.populations.offCenter.all.rejectedProposalTotal).toBe(7);
  });

  it("isolates alpha-only and RGB-only output mismatches", () => {
    const alphaGpu = new Float32Array(16);
    const alphaCpu = alphaGpu.slice();
    alphaGpu[3] = 0.25;
    alphaCpu[3] = 0.5;
    const alphaResult = pair(
      makeCapture("gpu", { nearRgba: alphaGpu }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", { nearRgba: alphaCpu }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(alphaResult.nearOutputErrors.alpha.exactMismatchCount).toBe(1);
    expect(alphaResult.nearOutputErrors.rgb.exactMismatchCount).toBe(0);
    expect(alphaResult.rejectionVsPrecisionAttribution.numericOnlyDifferencePixels).toBe(1);

    const rgbGpu = new Float32Array(16);
    const rgbCpu = rgbGpu.slice();
    rgbGpu[0] = 0.75;
    const rgbResult = pair(
      makeCapture("gpu", { nearRgba: rgbGpu }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", { nearRgba: rgbCpu }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(rgbResult.nearOutputErrors.red.exactMismatchCount).toBe(1);
    expect(rgbResult.nearOutputErrors.rgb.exactMismatchCount).toBe(1);
    expect(rgbResult.nearOutputErrors.alpha.exactMismatchCount).toBe(0);
  });

  it("detects a broken center-Near alpha override independently of the CPU formula", () => {
    const centerFlags = new Uint8Array([1, 0, 0, 0]);
    const gpuFinal = new Float32Array([0.75, 0, 0, 0]);
    const cpuFinal = new Float32Array([1, 0, 0, 0]);
    const gpuRgba = new Float32Array([0.1, 0.2, 0.3, 0.75, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const cpuRgba = gpuRgba.slice();
    cpuRgba[3] = 1;
    const result = pair(
      makeCapture("gpu", {
        intermediates: makeIntermediates(4, {
          nearCenterIsNear: centerFlags,
          nearEstimatedCoverage: new Float32Array([0.75, 0, 0, 0]),
          nearFinalAlpha: gpuFinal,
        }),
        nearRgba: gpuRgba,
      }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", {
        intermediates: makeIntermediates(4, {
          nearCenterIsNear: centerFlags,
          nearEstimatedCoverage: new Float32Array([0.75, 0, 0, 0]),
          nearFinalAlpha: cpuFinal,
        }),
        nearRgba: cpuRgba,
      }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(result.centerOverride.gpuCenterNearAlphaNotOneCount).toBe(1);
    expect(result.centerOverride.cpuCenterNearAlphaNotOneCount).toBe(0);
    expect(result.centerOverride.gpuFinalAlphaFormulaError.maximumAbsoluteError).toBe(0.25);
    expect(result.centerOverride.cpuFinalAlphaFormulaError.maximumAbsoluteError).toBe(0);
  });

  it("counts a valid fractional off-center population when accepted proposals support it", () => {
    const flags = new Uint8Array([0, 1, 0, 0]);
    const accepted = new Uint16Array([2, 0, 0, 0]);
    const estimate = new Float32Array([0.375, 0, 0, 0]);
    const finalAlpha = estimate.slice();
    const rgba = new Float32Array([0.2, 0.4, 0.6, 0.375, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0]);
    const intermediates = makeIntermediates(4, {
      nearCenterIsNear: flags,
      nearAcceptedProposalCount: accepted,
      nearNonzeroMembershipCount: new Uint16Array([2, 0, 0, 0]),
      nearWeightSum: new Float32Array([0.8, 0, 0, 0]),
      nearCoverageMass: new Float32Array([1.88, 0, 0, 0]),
      nearEstimatedCoverage: estimate,
      nearFinalAlpha: finalAlpha,
    });
    const result = pair(
      makeCapture("gpu", { intermediates, nearRgba: rgba }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", { intermediates, nearRgba: rgba.slice() }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(result.gpu.validOffCenterFractionalCoveragePixelCount).toBe(1);
    expect(result.cpu.validOffCenterFractionalCoveragePixelCount).toBe(1);
    expect(result.gpu.outputAlpha.fractionalCount).toBe(1);
    expect(result.gpu.populations.offCenter.withAcceptedProposals.outputCount).toBe(1);
    expect(result.nearOutputErrors.alpha.maximumAbsoluteError).toBe(0);
  });

  it("classifies target alpha as a valid binary16 round trip within the same half bin", () => {
    const gpuAlpha = 0.5001;
    const cpuAlpha = 0.5002;
    const gpuRgba = new Float32Array([
      0, 0, 0, 0.5,
      0, 0, 0, 1,
      0, 0, 0, 0.25,
      0, 0, 0, 0,
    ]);
    const cpuRgba = gpuRgba.slice();
    cpuRgba[3] = cpuAlpha;
    const result = pair(
      makeCapture("gpu", {
        intermediates: makeIntermediates(4, {
          nearEstimatedCoverage: new Float32Array([gpuAlpha, 1, 0.25, 0]),
          nearFinalAlpha: new Float32Array([gpuAlpha, 1, 0.25, 0]),
        }),
        nearRgba: gpuRgba,
        rawNearAlphaHalfBits: new Uint16Array([0x3800, 0x3c00, 0x3400, 0]),
      }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", {
        intermediates: makeIntermediates(4, {
          nearEstimatedCoverage: new Float32Array([cpuAlpha, 1, 0.25, 0]),
          nearFinalAlpha: new Float32Array([cpuAlpha, 1, 0.25, 0]),
        }),
        nearRgba: cpuRgba,
      }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(result.binary16.available).toBe(true);
    expect(result.binary16.storedAlpha).toMatchObject({
      zeroCount: 1,
      oneCount: 1,
      fractionalCount: 2,
      minimum: 0,
      maximum: 1,
    });
    expect(result.gpu.outputAlpha).toMatchObject({ zeroCount: 1, oneCount: 1, fractionalCount: 2 });
    expect(result.binary16.rawBitsRoundTripMismatchCount).toBe(0);
    expect(result.binary16.decodedBitsVsGpuTargetAlpha?.maximumAbsoluteError).toBe(0);
    expect(result.binary16.sameHalfBinCount).toBe(4);
    expect(result.binary16.preQuantizationDifferenceWithinSameHalfBinCount).toBe(1);
    expect(result.binary16.gpuDiagnosticVsStoredAlpha?.maximumAbsoluteError).toBeCloseTo(0.0001, 6);
  });

  it("attributes proposal rejections separately from numeric-only precision differences", () => {
    const gpuAccepted = new Uint16Array([1, 1, 0, 0]);
    const cpuAccepted = new Uint16Array([2, 1, 0, 0]);
    const gpuMass = new Float32Array([0.5, 0.25, 0, 0]);
    const cpuMass = new Float32Array([0.5, 0.2501, 0, 0]);
    const gpuAlpha = new Float32Array([0.39, 0.21, 0, 0]);
    const cpuAlpha = new Float32Array([0.39, 0.2101, 0, 0]);
    const gpuIntermediates = makeIntermediates(4, {
      nearAcceptedProposalCount: gpuAccepted,
      nearNonzeroMembershipCount: gpuAccepted.slice(),
      nearCoverageMass: gpuMass,
      nearEstimatedCoverage: gpuAlpha,
      nearFinalAlpha: gpuAlpha,
    });
    const cpuIntermediates = makeIntermediates(4, {
      nearAcceptedProposalCount: cpuAccepted,
      nearNonzeroMembershipCount: cpuAccepted.slice(),
      nearCoverageMass: cpuMass,
      nearEstimatedCoverage: cpuAlpha,
      nearFinalAlpha: cpuAlpha,
    });
    const gpuRgba = new Float32Array([0, 0, 0, 0.39, 0, 0, 0, 0.21, 0, 0, 0, 0, 0, 0, 0, 0]);
    const cpuRgba = gpuRgba.slice();
    cpuRgba[7] = 0.2101;
    const result = pair(
      makeCapture("gpu", { intermediates: gpuIntermediates, nearRgba: gpuRgba }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", { intermediates: cpuIntermediates, nearRgba: cpuRgba }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(result.rejectionVsPrecisionAttribution.proposalDecisionMismatchPixels).toBe(1);
    expect(result.rejectionVsPrecisionAttribution.decisionOnlyDifferencePixels).toBe(1);
    expect(result.rejectionVsPrecisionAttribution.numericOnlyDifferencePixels).toBe(1);
    expect(result.rejectionVsPrecisionAttribution.decisionAndNumericDifferencePixels).toBe(0);
  });

  it("allows pre-gate nonzero memberships to exceed post-gate accepted proposals", () => {
    const evaluated = new Uint16Array([4, 4, 4, 4]);
    const accepted = new Uint16Array([1, 0, 0, 0]);
    const nonzeroMembership = new Uint16Array([3, 0, 0, 0]);
    const intermediates = makeIntermediates(4, {
      nearEvaluatedProposalCount: evaluated,
      nearAcceptedProposalCount: accepted,
      nearNonzeroMembershipCount: nonzeroMembership,
    });
    const result = pair(
      makeCapture("gpu", { intermediates }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu", { intermediates }) as GroundGlassM5rNearAlphaCpuCapture,
    );
    expect(result.gpu.populations.offCenter.all.evaluatedProposalTotal).toBe(16);
    expect(result.gpu.populations.offCenter.all.acceptedProposalTotal).toBe(1);
    expect(result.gpu.populations.offCenter.all.nonzeroMembershipProposalTotal).toBe(3);
    expect(result.gpu.populations.offCenter.all.rejectedProposalTotal).toBe(15);
  });

  it("fails closed when capture provenance or any bounded array shape disagrees", () => {
    const gpu = makeCapture("gpu") as GroundGlassM5rNearAlphaGpuCapture;
    const cpu = makeCapture("cpu", { identity: { ...identity(), captureId: "other-capture" } }) as
      GroundGlassM5rNearAlphaCpuCapture;
    expect(() => pair(gpu, cpu)).toThrow(/provenance mismatch at captureId/);

    const wrongShape = makeIntermediates(3);
    expect(() => pair(
      makeCapture("gpu", { intermediates: wrongShape }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu") as GroundGlassM5rNearAlphaCpuCapture,
    )).toThrow(/length does not match/);

    expect(() => pair(
      makeCapture("gpu", { rawNearAlphaHalfBits: new Uint16Array(3) }) as GroundGlassM5rNearAlphaGpuCapture,
      makeCapture("cpu") as GroundGlassM5rNearAlphaCpuCapture,
    )).toThrow(/one Uint16 per output/);
  });
});
