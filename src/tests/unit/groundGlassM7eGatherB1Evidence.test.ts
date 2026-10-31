import { describe, expect, it } from "vitest";
import { DataUtils } from "three";
import type {
  GroundGlassApertureGatherCaptureReadback,
  GroundGlassB1BoundaryProbeCaseReadback,
  GroundGlassB1BoundaryProbeReadback,
} from "../../render/webgpu/groundGlassWebGpuTestSeam";
import {
  GROUND_GLASS_M7E_EVALUATOR_REVISION,
  GROUND_GLASS_M7E_R187_THRESHOLDS,
  GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS,
  evaluateGroundGlassM7eB1BoundaryProbe,
  evaluateGroundGlassM7eNativeCapture,
  validateGroundGlassM7eReportInventory,
  type GroundGlassM7eCaptureEnvelope,
  type GroundGlassM7eReportInventory,
  type GroundGlassM7eRuntimeIdentity,
} from "../../render/webgpu/groundGlassM7eGatherB1Evidence";
import { GROUND_GLASS_M5Q_R186_FROZEN_THRESHOLDS } from "../../render/webgpu/groundGlassM5qQualification";
import { reconstructGroundGlassB1Reference } from "../../render/webgpu/groundGlassB1Reference";
import { referenceGroundGlassApertureGather } from "../../render/webgpu/groundGlassApertureGatherReference";

const runtime: GroundGlassM7eRuntimeIdentity = {
  rendererRevision: "r187",
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
  applicationFallback: false,
  browserVersion: "Chrome 156.0.8078.76",
  operatingSystem: "Darwin arm64",
  nodeVersion: "v24.3.0",
  nativeRequired: true,
};

const halfBits = (value: number): number => Number.isNaN(value) ? 0x7e00
  : value === Number.POSITIVE_INFINITY ? 0x7c00
    : value === Number.NEGATIVE_INFINITY ? 0xfc00
      : value > 65504 ? 0x7bff
        : value < -65504 ? 0xfbff
          : DataUtils.toHalfFloat(value);

const makeCapture = (sampleCount: 32 | 64 = 32, maximumRadiusPx = 60): GroundGlassApertureGatherCaptureReadback => {
  const sourceRgba = new Float32Array([
    0.2, 0.3, 0.4, 1, 0.8, 0.2, 0.1, 1,
    0.1, 0.7, 0.3, 1, 0.4, 0.5, 0.9, 1,
  ]);
  const physicalRgba = new Float32Array([
    0.1, 30, 18, 0, 0.1, 30, 18, 0,
    0.1, 30, 18, 0, 0.1, 30, 18, 0,
  ]);
  const validity = new Uint8Array([1, 1, 1, 1]);
  const depth = new Float32Array([0.35, 0.45, 0.55, 0.65]);
  const gatherCenterIds = new Int32Array([0, 0, 1, 0, 0, 1, 1, 1]);
  const gatherCenterUvs = new Float32Array([0.25, 0.25, 0.75, 0.25, 0.25, 0.75, 0.75, 0.75]);
  const gatherReference = referenceGroundGlassApertureGather({
    source: { widthPx: 2, heightPx: 2 },
    gather: { widthPx: 2, heightPx: 2 },
    film: { widthMm: 36, heightMm: 24 },
    sourceRgba,
    physicalRgba,
    validity,
    depth,
    observedGatherCenterSourceIds: gatherCenterIds,
    observedGatherCenterSourceUvs: gatherCenterUvs,
    inverseProjectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    sampleCount,
    maximumRadiusPx,
  });
  const b1Reference = reconstructGroundGlassB1Reference({
    source: { widthPx: 2, heightPx: 2 }, gather: { widthPx: 2, heightPx: 2 },
    sourceRgba, gatherFarRgba: gatherReference.farRgba, physicalRgba, validity,
    observedSelectedGatherIds: gatherCenterIds,
    observedSelectedCenterSourceIds: gatherCenterIds,
    observedGatherCenterSourceIds: gatherCenterIds,
  });
  const b1Decision = new Uint8Array(16);
  for (let pixel = 0; pixel < 4; pixel += 1) {
    b1Decision[pixel * 4] = b1Reference.eligible[pixel]!;
    b1Decision[pixel * 4 + 1] = b1Reference.fallbackReason[pixel]!;
    b1Decision[pixel * 4 + 2] = b1Reference.selectedPath[pixel]!;
    b1Decision[pixel * 4 + 3] = 255;
  }
  return ({
  token: "capture-token",
  captureId: "capture-1",
  requestId: "request-1",
  channelId: "default",
  sceneId: "architecture-rise",
  rendererGenerationId: "generation-1",
  rendererFamily: "webgpu-renderer",
  actualExecutionApi: "webgpu",
  internalFallback: "none",
  rendererRevision: "r187",
  readbackOrigin: "top",
  sceneSourceRevision: "architecture-rise-raw-rtt-v1",
  effectiveOpticalRequestFingerprint: "optics-fingerprint",
  cameraStateFingerprint: "camera-fingerprint",
  inverseProjectionMatrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
  sampledFilmDimensionsMm: { widthMm: 36, heightMm: 24 },
  colorDomain: "source-target-readback-values",
  qualityMode: "half32",
  sampleCount,
  maximumRadiusPx,
  sourceWidthPx: 2,
  sourceHeightPx: 2,
  farGatherWidthPx: 2,
  farGatherHeightPx: 2,
  nearGatherWidthPx: 2,
  nearGatherHeightPx: 2,
  targetFormats: {
    sourceColor: "rgba8unorm", physical: "rgba16float", validity: "rgba8unorm",
    far: "rgba16float", near: "rgba16float", b1: "rgba16float", composite: "rgba16float",
    provenance: "rgba32float", decisions: "rgba8unorm",
  },
  m4Input: {
    status: "completed",
    requestId: "request-1",
    rendererGenerationId: "generation-1",
    sceneId: "architecture-rise",
    sceneSourceRevision: "architecture-rise-raw-rtt-v1",
    targetFormats: { depth: "depth24plus", physical: "rgba16float", validity: "rgba8unorm" },
  },
  completedPasses: ["sourceIdentity", "gatherIdentity", "gatherCenterProvenance", "selectedProvenance", "farGather", "nearGather", "farReconstructionB1", "researchComposite"],
  cpuB1Conformance: {
    status: "passed", selectedCenterProvenanceMismatchCount: 0, eligibilityMismatchCount: 0,
    fallbackReasonMismatchCount: 0, selectedPathMismatchCount: 0, rgbRmse: 0, rgbMaximumError: 0,
    fallbackSourceMaximumError: 0,
  },
  farGatherCpuReference: { rgbRmse: 0, rgbMaximumError: 0, pixelsOverMaximumErrorTolerance: 0 },
  performance: {
    sceneRender: { rendererCallCpuMs: 1, queueCompletionWaitMs: 1, wallClockMs: 2 },
    physicalCocFootprint: { rendererCallCpuMs: 1, queueCompletionWaitMs: 1, wallClockMs: 2 },
    physicalValidity: { rendererCallCpuMs: 1, queueCompletionWaitMs: 1, wallClockMs: 2 },
    operations: [], readPixelsWaitWallMs: 1, readbackConversionCpuMs: 1, cpuReferenceWallClockMs: 1,
    gpuTimestampQueries: "not-collected",
  },
  resourceInventory: {
    m5OwnedRenderTargetCount: 10,
    adapterOwnedFullscreenMaterialCount: 10,
    adapterOwnedFullscreenSceneCount: 10,
    adapterOwnedFullscreenGeometryCount: 1,
    estimatedTargetAttachmentBytes: 40,
    memoryScope: "m5-owned-target-attachments-only",
    targetAllocations: Array.from({ length: 10 }, (_value, index) => ({
      name: index === 9 ? "depthReadback" as const : "farGather" as const,
      widthPx: 1, heightPx: 1, format: "rgba16float", bytesPerPixel: 8, estimatedBytes: 4,
    })),
  },
  sourceToGatherMappingConformance: { status: "passed", mismatchCount: 0 },
  nominalGatherCenterMappingConformance: { status: "exact", mismatchCount: 0 },
  physicalDataFingerprint: "physical-fingerprint",
  inputFingerprints: { sourceColor: "source", depth: "depth", physical: "physical", validity: "validity" },
  m5rDiagnostics: { status: "not-requested", diagnosticTargetFormat: null, diagnosticTargetCount: 0, nearFinalAlphaMaximumError: null },
  m5rNearFixture: null,
  nearCoveragePixelCount: 1,
  nearRgbInvariantMaximumError: 0,
  nearAlphaInvariantMaximumError: 0,
  nearCoverageNontrivial: true,
  nearCoverageFractionalPixelCount: 1,
  nearReferenceCoverageNontrivial: true,
  nearReferenceCoveragePixelCount: 1,
  nearReferenceCoverageFractionalPixelCount: 1,
  nearReferenceAlphaMaximumError: 0,
  radius: { maximumUncappedRadiusPx: 1, cappedPixelCount: 0, physicalValuesUnchanged: true },
  readbackBuffers: {
    sourceRgba,
    physicalRgba,
    validity,
    depth,
    farGatherRgba: gatherReference.farRgba,
    farCpuReferenceRgba: gatherReference.farRgba,
    nearRgba: gatherReference.nearRgba,
    nearCpuReferenceRgba: gatherReference.nearRgba,
    nearBeforeB1Rgba: gatherReference.nearRgba,
    nearAfterB1Rgba: gatherReference.nearRgba,
    nearCpuCenterIsNear: gatherReference.nearCenterIsNear,
    nearCpuEvaluatedProposalCount: gatherReference.nearEvaluatedProposalCount,
    nearCpuAcceptedProposalCount: gatherReference.nearAcceptedProposalCount,
    nearCpuNonzeroMembershipCount: gatherReference.nearNonzeroMembershipCount,
    nearCpuWeightSum: gatherReference.nearWeightSum,
    nearCpuCoverageMass: gatherReference.nearCoverageMass,
    nearCpuEstimatedCoverage: gatherReference.nearEstimatedCoverage,
    nearCpuAcceptedAreaRatioMean: gatherReference.nearAcceptedAreaRatioMean,
    nearCpuAcceptedCompensationMaximum: gatherReference.nearAcceptedCompensationMaximum,
    b1FarRgba: b1Reference.farRgba,
    researchCompositeRgba: b1Reference.farRgba,
    observedSelectedGatherIds: gatherCenterIds,
    observedSelectedCenterSourceIds: gatherCenterIds,
    observedGatherCenterSourceIds: gatherCenterIds,
    observedGatherCenterSourceUvs: gatherCenterUvs,
    b1Decision,
  },
  });
};

const makeEnvelope = (capture = makeCapture()): GroundGlassM7eCaptureEnvelope => ({
  scenarioId: "q1-control-half32",
  capture,
  runtime,
  sourceCommitSha: "a".repeat(40),
  testInvocation: "npx playwright test --project=chrome-native-webgpu",
  supportingArtifact: "captures/q1-control-half32.json;captures/q1-control-half32.bin.gz",
  hostFrameResult: {
    status: "completed", accepted: true, requestId: capture.requestId, sceneId: capture.sceneId,
    rendererGenerationId: capture.rendererGenerationId,
  },
});

const makeBoundaryCase = (
  id: string,
  inputSignedCocMm: number,
  inputValidityCode: number,
  inputFarRgba: readonly [number, number, number, number],
): GroundGlassB1BoundaryProbeCaseReadback => {
  const storedPhysicalHalfBits = [halfBits(inputSignedCocMm), 0, 0, 0] as const;
  const storedPhysicalRgba = [DataUtils.fromHalfFloat(storedPhysicalHalfBits[0]), 0, 0, 0] as const;
  const storedGatherHalfBits = inputFarRgba.map(halfBits) as unknown as readonly [number, number, number, number];
  const storedGatherRgba = storedGatherHalfBits.map((bits) => DataUtils.fromHalfFloat(bits)) as unknown as readonly [number, number, number, number];
  const cpu = reconstructGroundGlassB1Reference({
    source: { widthPx: 1, heightPx: 1 }, gather: { widthPx: 1, heightPx: 1 },
    sourceRgba: new Float32Array([64 / 255, 128 / 255, 192 / 255, 1]),
    gatherFarRgba: Float32Array.from(storedGatherRgba), physicalRgba: Float32Array.from(storedPhysicalRgba),
    validity: Uint8Array.of(inputValidityCode), observedSelectedGatherIds: [0, 0],
    observedSelectedCenterSourceIds: [0, 0], observedGatherCenterSourceIds: [0, 0],
  });
  const gpuB1Rgba = cpu.farRgba.map((value) => DataUtils.fromHalfFloat(DataUtils.toHalfFloat(value))) as unknown as readonly [number, number, number, number];
  const gpuB1HalfBits = cpu.farRgba.map(DataUtils.toHalfFloat) as unknown as readonly [number, number, number, number];
  const gpuCpuMaximumError = Math.max(...gpuB1Rgba.map((value, channel) => Math.abs(value - cpu.farRgba[channel])));
  const cpuB1Rgba = Array.from(cpu.farRgba) as [number, number, number, number];
  return {
    id, inputSignedCocMm, inputValidityCode,
    inputSourceRgba: [64 / 255, 128 / 255, 192 / 255, 1], inputFarRgba,
    storedPhysicalHalfBits, storedPhysicalRgba, storedGatherHalfBits, storedGatherRgba,
    gpuDecisionRgba8: [cpu.eligible[0], cpu.fallbackReason[0], cpu.selectedPath[0], 0],
    gpuB1HalfBits, gpuB1Rgba,
    cpuEligible: cpu.eligible[0], cpuFallbackReason: cpu.fallbackReason[0], cpuSelectedPath: cpu.selectedPath[0],
    cpuB1Rgba, gpuCpuMaximumError,
  };
};

const makeBoundaryProbe = (): GroundGlassB1BoundaryProbeReadback => ({
  token: "boundary-token", requestId: "request-1", channelId: "default", sceneId: "architecture-rise",
  rendererGenerationId: "generation-1", rendererFamily: "webgpu-renderer", actualExecutionApi: "webgpu",
  internalFallback: "none", rendererRevision: "r187",
  targetFormats: {
    sourceColor: "rgba8unorm", physical: "rgba16float", validity: "rgba8unorm",
    farGather: "rgba16float", provenance: "rgba32float", b1: "rgba16float", decision: "rgba8unorm",
  },
  cases: [
    makeBoundaryCase("physical-positive-half-maximum-and-gather-rgba-maximum", 65504, 1, [65504, 65504, 65504, 1]),
    makeBoundaryCase("physical-negative-half-maximum-is-near-side", -65504, 1, [0.6, 0.2, 0.1, 1]),
    makeBoundaryCase("physical-largest-half-value-below-maximum", 65472, 1, [0.6, 0.2, 0.1, 1]),
    makeBoundaryCase("m4-unrepresentable-overflow-preserves-validity-code-two", 65536, 2, [0.6, 0.2, 0.1, 1]),
    makeBoundaryCase("physical-nan", Number.NaN, 1, [0.6, 0.2, 0.1, 1]),
    makeBoundaryCase("physical-positive-infinity", Number.POSITIVE_INFINITY, 1, [0.6, 0.2, 0.1, 1]),
    makeBoundaryCase("physical-negative-infinity", Number.NEGATIVE_INFINITY, 1, [0.6, 0.2, 0.1, 1]),
    makeBoundaryCase("m4-validity-code-two-remains-authoritative", 65504, 2, [0.6, 0.2, 0.1, 1]),
    makeBoundaryCase("far-gather-nan-channel-fails-closed", 1, 1, [Number.NaN, 0.2, 0.1, 1]),
    makeBoundaryCase("far-gather-infinity-channel-fails-closed", 1, 1, [0.6, Number.POSITIVE_INFINITY, 0.1, 1]),
  ],
});

const makeReport = (envelope = makeEnvelope(), probe = makeBoundaryProbe()): GroundGlassM7eReportInventory => ({
  schemaVersion: 1, reportId: "ground-glass-m7e-r187-gather-b1",
  evaluatorRevision: GROUND_GLASS_M7E_EVALUATOR_REVISION, sourceCommitSha: envelope.sourceCommitSha, runtime,
  declaredCounts: { passed: GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.length, failed: 0, blocked: 0, "not-run": 0 },
  scenarios: GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.map((scenarioId, index) => {
    const qualityMode = scenarioId.endsWith("-half32") ? "half32" as const
      : scenarioId.endsWith("-full32") ? "full32" as const : "full64" as const;
    const sampleCount = qualityMode === "full64" ? 64 : 32;
    const maximumRadiusPx = scenarioId.startsWith("q5-stress-cap2-") ? 2 : 60;
    const capture = {
      ...makeCapture(sampleCount, maximumRadiusPx),
      captureId: `capture-${index + 1}`,
      qualityMode,
      sampleCount,
      maximumRadiusPx,
    };
    return {
      id: scenarioId,
      status: "passed" as const,
      capture: {
        ...envelope,
        scenarioId,
        capture,
        hostFrameResult: { ...envelope.hostFrameResult, requestId: capture.requestId },
      },
    };
  }),
  b1BoundaryProbe: probe,
  m3RendererSelectionAuthority: "m3-raw-pilot", m5RendererAttemptAuthorized: false,
  m5GatherEvidenceStatus: "research-only", m5B1EvidenceStatus: "research-only",
  m6R187Authorized: false, productionWebGpuEnabled: false,
});

describe("M7E r187 M5 evidence integrity", () => {
  it("uses the exact historical M5Q thresholds under a distinct r187 evidence revision", () => {
    const { revision, sourceThresholdRevision, ...r187Thresholds } = GROUND_GLASS_M7E_R187_THRESHOLDS;
    expect({ ...r187Thresholds, revision: sourceThresholdRevision })
      .toEqual(GROUND_GLASS_M5Q_R186_FROZEN_THRESHOLDS);
    expect(revision).toBe("m5q-architecture-rise-r187-v1");
  });

  it("accepts current native r187 Far/Near/B1 evidence with an independent CPU decision", () => {
    expect(evaluateGroundGlassM7eNativeCapture(makeEnvelope(), 60).status).toBe("passed");
  });

  it("recomputes Far and Near CPU references from their serialized optical and raster inputs", () => {
    const capture = makeCapture();
    const buffers = capture.readbackBuffers!;
    const staleFarReference = Float32Array.from(buffers.farCpuReferenceRgba);
    staleFarReference[0] += 0.1;
    const staleFarButSelfConsistentGpu = {
      ...capture,
      readbackBuffers: {
        ...buffers,
        farCpuReferenceRgba: staleFarReference,
        farGatherRgba: Float32Array.from(staleFarReference),
      },
    };
    const farEvaluation = evaluateGroundGlassM7eNativeCapture(makeEnvelope(staleFarButSelfConsistentGpu));
    expect(farEvaluation.issues.map(({ code }) => code)).toContain("far-cpu-reference-recomputation");

    const staleNearReference = Float32Array.from(buffers.nearCpuReferenceRgba);
    staleNearReference[0] += 0.1;
    const staleNearButSelfConsistentGpu = {
      ...capture,
      readbackBuffers: {
        ...buffers,
        nearCpuReferenceRgba: staleNearReference,
        nearRgba: Float32Array.from(staleNearReference),
        nearBeforeB1Rgba: Float32Array.from(staleNearReference),
        nearAfterB1Rgba: Float32Array.from(staleNearReference),
      },
    };
    const nearEvaluation = evaluateGroundGlassM7eNativeCapture(makeEnvelope(staleNearButSelfConsistentGpu));
    expect(nearEvaluation.issues.map(({ code }) => code)).toContain("near-cpu-reference-recomputation");
  });

  it.each([
    ["source color input", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const buffers = capture.readbackBuffers!;
      const sourceRgba = Float32Array.from(buffers.sourceRgba);
      sourceRgba[0] += 0.1;
      return { ...capture, readbackBuffers: { ...buffers, sourceRgba } };
    }],
    ["signed CoC input", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const physicalRgba = Float32Array.from(capture.readbackBuffers!.physicalRgba);
      physicalRgba[0] = -4;
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, physicalRgba } };
    }],
    ["depth", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const depth = Float32Array.from(capture.readbackBuffers!.depth);
      depth[0] = 1;
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, depth } };
    }],
    ["film dimensions", (capture: GroundGlassApertureGatherCaptureReadback) => ({
      ...capture, sampledFilmDimensionsMm: { widthMm: 30, heightMm: 24 },
    })],
    ["inverse projection", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const inverseProjectionMatrix = [...capture.inverseProjectionMatrix];
      inverseProjectionMatrix[3] = 0.8;
      return { ...capture, inverseProjectionMatrix };
    }],
    ["observed gather center IDs and UV", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const observedGatherCenterSourceIds = Int32Array.from(capture.readbackBuffers!.observedGatherCenterSourceIds);
      const observedGatherCenterSourceUvs = Float32Array.from(capture.readbackBuffers!.observedGatherCenterSourceUvs);
      observedGatherCenterSourceIds[0] = 1;
      observedGatherCenterSourceUvs[0] = 0.75;
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, observedGatherCenterSourceIds, observedGatherCenterSourceUvs } };
    }],
    ["sample count", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, qualityMode: "full64" as const, sampleCount: 64 })],
    ["radius cap", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, maximumRadiusPx: 1 })],
  ])("rejects CPU-reference replay when %s changes but persisted references do not", (_label, mutate) => {
    const evaluation = evaluateGroundGlassM7eNativeCapture(makeEnvelope(mutate(makeCapture())));
    expect(evaluation.issues.map(({ code }) => code)).toContain("far-cpu-reference-recomputation");
  });

  it.each([
    ["Near RGB", 0, 0.0015],
    ["Near alpha", 3, -0.0015],
  ])("enforces the per-channel native limit for %s even when aggregate RMSE is below it", (_label, channel, delta) => {
    const capture = makeCapture();
    const buffers = capture.readbackBuffers!;
    const nearRgba = Float32Array.from(buffers.nearRgba);
    const nearBeforeB1Rgba = Float32Array.from(buffers.nearBeforeB1Rgba);
    const nearAfterB1Rgba = Float32Array.from(buffers.nearAfterB1Rgba);
    nearRgba[channel] += delta;
    nearBeforeB1Rgba[channel] += delta;
    nearAfterB1Rgba[channel] += delta;
    const evaluation = evaluateGroundGlassM7eNativeCapture(makeEnvelope({
      ...capture,
      readbackBuffers: { ...buffers, nearRgba, nearBeforeB1Rgba, nearAfterB1Rgba },
    }));
    expect(evaluation.measured.nearRgbRmse).toBeLessThan(0.001);
    expect(evaluation.measured.nearAlphaRmse).toBeLessThan(0.001);
    if (channel === 0) expect(evaluation.measured.nearRgbMaximumChannelError).toBeGreaterThan(0.001);
    else expect(evaluation.measured.nearAlphaMaximumError).toBeGreaterThan(0.001);
    expect(evaluation.issues.map(({ code }) => code)).toContain("near-cpu-comparison");
  });

  it("rejects a B1 output even when its summary is updated to agree with the mutated output", () => {
    const capture = makeCapture();
    const buffers = capture.readbackBuffers!;
    const b1FarRgba = Float32Array.from(buffers.b1FarRgba);
    b1FarRgba[0] += 0.01;
    const cpu = reconstructGroundGlassB1Reference({
      source: { widthPx: capture.sourceWidthPx, heightPx: capture.sourceHeightPx },
      gather: { widthPx: capture.farGatherWidthPx, heightPx: capture.farGatherHeightPx },
      sourceRgba: buffers.sourceRgba,
      gatherFarRgba: buffers.farGatherRgba,
      physicalRgba: buffers.physicalRgba,
      validity: buffers.validity,
      observedSelectedGatherIds: buffers.observedSelectedGatherIds,
      observedSelectedCenterSourceIds: buffers.observedSelectedCenterSourceIds,
      observedGatherCenterSourceIds: buffers.observedGatherCenterSourceIds,
    });
    let squared = 0;
    let channels = 0;
    let maximum = 0;
    for (let index = 0; index < b1FarRgba.length; index += 1) {
      if (index % 4 === 3) continue;
      const error = Math.abs(b1FarRgba[index]! - cpu.farRgba[index]!);
      squared += error * error;
      maximum = Math.max(maximum, error);
      channels += 1;
    }
    const rgbRmse = Math.sqrt(squared / channels);
    const mutated = {
      ...capture,
      readbackBuffers: { ...buffers, b1FarRgba },
      cpuB1Conformance: {
        ...capture.cpuB1Conformance,
        status: "failed" as const,
        rgbRmse,
        rgbMaximumError: maximum,
      },
    };
    const evaluation = evaluateGroundGlassM7eNativeCapture(makeEnvelope(mutated));
    const codes = evaluation.issues.map(({ code }) => code);
    expect(codes).toContain("b1-cpu-comparison");
    expect(codes).not.toContain("b1-summary-mismatch");
  });

  it.each([
    ["renderer revision", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, rendererRevision: "r186" }), "wrong-renderer-revision"],
    ["WebGL2 compatibility", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, actualExecutionApi: "webgl2" as const, internalFallback: "webgl2" as const }) as unknown as GroundGlassApertureGatherCaptureReadback, "not-native-webgpu"],
    ["scene/source", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, sceneSourceRevision: "unknown-scene-revision" }), "wrong-scene-source"],
    ["M4 request", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, m4Input: { ...capture.m4Input, requestId: "retired" } }), "m4-input-identity"],
    ["target storage", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, targetFormats: { ...capture.targetFormats, b1: "rgba8unorm" } }), "m5-storage-format"],
    ["missing CPU Far reference", (capture: GroundGlassApertureGatherCaptureReadback) => ({ ...capture, readbackBuffers: { ...capture.readbackBuffers!, farCpuReferenceRgba: new Float32Array() } }), "readback-length"],
    ["signed CoC", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const physicalRgba = Float32Array.from(capture.readbackBuffers!.physicalRgba);
      physicalRgba[0] = -0.1;
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, physicalRgba } };
    }, "b1-decision-mismatch"],
    ["mm to metre scale", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const physicalRgba = Float32Array.from(capture.readbackBuffers!.physicalRgba);
      for (let index = 1; index < physicalRgba.length; index += 4) {
        physicalRgba[index] = 0.03;
        physicalRgba[index + 1] = 0.03;
      }
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, physicalRgba } };
    }, "far-cpu-reference-recomputation"],
    ["major/minor axis swap", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const physicalRgba = Float32Array.from(capture.readbackBuffers!.physicalRgba);
      for (let index = 0; index < physicalRgba.length; index += 4) {
        [physicalRgba[index + 1], physicalRgba[index + 2]] = [physicalRgba[index + 2]!, physicalRgba[index + 1]!];
      }
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, physicalRgba } };
    }, "far-cpu-reference-recomputation"],
    ["ellipse orientation", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const physicalRgba = Float32Array.from(capture.readbackBuffers!.physicalRgba);
      for (let index = 3; index < physicalRgba.length; index += 4) physicalRgba[index] = 0.25;
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, physicalRgba } };
    }, "far-cpu-reference-recomputation"],
    ["validity code 2", (capture: GroundGlassApertureGatherCaptureReadback) => {
      const validity = Uint8Array.from(capture.readbackBuffers!.validity);
      validity[0] = 2;
      return { ...capture, readbackBuffers: { ...capture.readbackBuffers!, validity } };
    }, "b1-decision-mismatch"],
  ])("rejects %s evidence mutations for their relevant contract", (_label, mutate, expectedCode) => {
    const evaluation = evaluateGroundGlassM7eNativeCapture(makeEnvelope(mutate(makeCapture())));
    expect(evaluation.issues.map(({ code }) => code)).toContain(expectedCode);
  });

  it("rejects stale host publication even when capture request metadata is internally consistent", () => {
    const envelope = makeEnvelope();
    const stale = { ...envelope, hostFrameResult: { ...envelope.hostFrameResult, requestId: "newer-request" } };
    expect(evaluateGroundGlassM7eNativeCapture(stale).issues.map(({ code }) => code)).toContain("stale-or-unaccepted-frame");
  });

  it("rejects a synthesized current capture without full commit provenance", () => {
    expect(evaluateGroundGlassM7eNativeCapture({ ...makeEnvelope(), supportingArtifact: "" }).issues.map(({ code }) => code)).toContain("missing-artifact");
    expect(evaluateGroundGlassM7eNativeCapture({ ...makeEnvelope(), sourceCommitSha: "short" }).issues.map(({ code }) => code)).toContain("invalid-source-revision");
  });

  it("checks binary16 storage and recomputes the ten B1 boundary decisions", () => {
    expect(evaluateGroundGlassM7eB1BoundaryProbe(makeBoundaryProbe()).status).toBe("passed");
    const probe = makeBoundaryProbe();
    const overflowIndex = probe.cases.findIndex(({ id }) => id === "m4-unrepresentable-overflow-preserves-validity-code-two");
    const overflow = probe.cases[overflowIndex]!;
    const changed = [...probe.cases];
    changed[overflowIndex] = { ...overflow, inputValidityCode: 1 };
    const evaluation = evaluateGroundGlassM7eB1BoundaryProbe({ ...probe, cases: changed });
    expect(evaluation.issues.map(({ code }) => code)).toContain("boundary-cpu-classification");
    expect(evaluation.issues.map(({ code }) => code)).toContain("overflow-validity-code");
  });

  it("recomputes B1 fallback output from the recorded RGBA8 source texel", () => {
    const probe = makeBoundaryProbe();
    const target = probe.cases.find(({ id }) => id === "physical-negative-half-maximum-is-near-side");
    const mutatedProbe = {
      ...probe,
      cases: probe.cases.map((item) => item === target
        ? { ...item, inputSourceRgba: [0.25, 0.5, 0.75, 1] as const }
        : item),
    };
    const evaluation = evaluateGroundGlassM7eB1BoundaryProbe(mutatedProbe);
    expect(evaluation.issues.map(({ code }) => code)).toContain("boundary-output-comparison");
  });

  it("reproduces the legacy lossy-null B1 serialization as a rejected boundary probe", () => {
    const probe = makeBoundaryProbe();
    const cases = probe.cases.map((item) => {
      if (item.id === "physical-nan") return { ...item, inputSignedCocMm: null } as unknown as GroundGlassB1BoundaryProbeCaseReadback;
      if (item.id === "far-gather-nan-channel-fails-closed") return {
        ...item,
        inputFarRgba: [null, ...item.inputFarRgba.slice(1)],
        storedGatherRgba: [null, ...item.storedGatherRgba.slice(1)],
      } as unknown as GroundGlassB1BoundaryProbeCaseReadback;
      return item;
    });
    const evaluation = evaluateGroundGlassM7eB1BoundaryProbe({ ...probe, cases });
    const codes = evaluation.issues.map(({ code }) => code);
    expect(codes).toContain("physical-half-storage");
    expect(codes).toContain("boundary-cpu-classification");
    expect(codes).toContain("gather-half-decode");
  });

  it.each([
    ["missing controlled case", (probe: GroundGlassB1BoundaryProbeReadback) => ({ ...probe, cases: probe.cases.slice(1) }), "boundary-case-inventory"],
    ["duplicated controlled case", (probe: GroundGlassB1BoundaryProbeReadback) => ({ ...probe, cases: [...probe.cases, probe.cases[0]!] }), "boundary-case-inventory"],
    ["unsupported half bits", (probe: GroundGlassB1BoundaryProbeReadback) => ({ ...probe, cases: probe.cases.map((item, index) => index === 0 ? { ...item, storedPhysicalHalfBits: [1, 0, 0, 0] as const } : item) }), "physical-half-storage"],
    ["wrong revision", (probe: GroundGlassB1BoundaryProbeReadback) => ({ ...probe, rendererRevision: "r186" }), "wrong-renderer-revision"],
    ["WebGL2", (probe: GroundGlassB1BoundaryProbeReadback) => ({ ...probe, actualExecutionApi: "webgl2" as const, internalFallback: "webgl2" as const }) as unknown as GroundGlassB1BoundaryProbeReadback, "not-native-webgpu"],
    ["unsupported allocation", (probe: GroundGlassB1BoundaryProbeReadback) => ({ ...probe, targetFormats: { ...probe.targetFormats, b1: null } }), "unsupported-boundary-storage"],
  ])("rejects %s boundary probe mutations", (_label, mutate, expectedCode) => {
    const evaluation = evaluateGroundGlassM7eB1BoundaryProbe(mutate(makeBoundaryProbe()));
    expect(evaluation.issues.map(({ code }) => code)).toContain(expectedCode);
  });

  it("recomputes the report inventory and denies M5/M6/production authorization", () => {
    expect(validateGroundGlassM7eReportInventory(makeReport())).toEqual([]);
    const report = makeReport();
    expect(validateGroundGlassM7eReportInventory({ ...report, declaredCounts: { ...report.declaredCounts, passed: 2 } })
      .map(({ code }) => code)).toContain("scenario-count-mismatch");
    expect(validateGroundGlassM7eReportInventory({ ...report, m5RendererAttemptAuthorized: true })
      .map(({ code }) => code)).toContain("m5-authorization-boundary");
    expect(validateGroundGlassM7eReportInventory({ ...report, m6R187Authorized: true })
      .map(({ code }) => code)).toContain("m6-authorization-boundary");
    expect(validateGroundGlassM7eReportInventory({ ...report, productionWebGpuEnabled: true })
      .map(({ code }) => code)).toContain("production-boundary");
  });

  it("reproduces why the committed split report cannot validate before binary rehydration", () => {
    const inMemory = makeReport();
    const persistedShape = {
      ...inMemory,
      scenarios: inMemory.scenarios.map((scenario) => ({
        ...scenario,
        capture: {
          ...scenario.capture!,
          capture: { ...scenario.capture!.capture, readbackBuffers: null },
        },
      })),
    } as unknown as GroundGlassM7eReportInventory;
    const captureIssues = validateGroundGlassM7eReportInventory(persistedShape)
      .filter(({ code }) => code === "invalid-passed-capture");
    expect(captureIssues).toHaveLength(GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.length);
    expect(captureIssues.every(({ detail }) => detail.includes("missing-readback"))).toBe(true);
  });

  it.each([
    ["missing required scenario", (report: GroundGlassM7eReportInventory) => ({ ...report, scenarios: report.scenarios.slice(1) }), "required-scenario-inventory"],
    ["duplicate scenario identity", (report: GroundGlassM7eReportInventory) => ({ ...report, scenarios: [...report.scenarios.slice(0, -1), report.scenarios[0]!] }), "duplicate-scenario"],
    ["duplicate capture identity", (report: GroundGlassM7eReportInventory) => ({ ...report, scenarios: report.scenarios.map((scenario, index) => index === 1 ? { ...scenario, capture: { ...scenario.capture!, capture: { ...scenario.capture!.capture, captureId: report.scenarios[0]!.capture!.capture.captureId } } } : scenario) }), "duplicate-capture"],
    ["missing native capture provenance", (report: GroundGlassM7eReportInventory) => ({ ...report, scenarios: report.scenarios.map((scenario, index) => index === 0 ? { ...scenario, capture: undefined } : scenario) }), "missing-capture-provenance"],
    ["capture from another source revision", (report: GroundGlassM7eReportInventory) => ({ ...report, scenarios: report.scenarios.map((scenario, index) => index === 0 ? { ...scenario, capture: { ...scenario.capture!, sourceCommitSha: "b".repeat(40) } } : scenario) }), "capture-source-revision"],
    ["capture with the wrong quality profile", (report: GroundGlassM7eReportInventory) => ({ ...report, scenarios: report.scenarios.map((scenario, index) => index === 0 ? { ...scenario, capture: { ...scenario.capture!, capture: { ...scenario.capture!.capture, maximumRadiusPx: 60 } } } : scenario) }), "scenario-profile-mismatch"],
  ])("rejects %s report inventory", (_label, mutate, expectedCode) => {
    expect(validateGroundGlassM7eReportInventory(mutate(makeReport())).map(({ code }) => code)).toContain(expectedCode);
  });
});
