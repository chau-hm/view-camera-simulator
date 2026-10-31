import {
  evaluateGroundGlassApertureGatherR3,
  type GroundGlassApertureGatherR3Capture,
  type GroundGlassApertureGatherR3CaptureMatrix,
  type GroundGlassApertureGatherR3Evaluation,
  type GroundGlassR3QualityMode,
} from "./groundGlassApertureGatherQuality";
import {
  GROUND_GLASS_M7E_EVALUATOR_REVISION,
  GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS,
  GROUND_GLASS_M7E_R187_THRESHOLDS,
  evaluateGroundGlassM7eB1BoundaryProbe,
  evaluateGroundGlassM7eNativeCapture,
  evaluateGroundGlassM7eQuality,
  validateGroundGlassM7eReportInventory,
  type GroundGlassM7eCaptureEnvelope,
  type GroundGlassM7eQualityEvaluation,
  type GroundGlassM7eQualityMatrix,
  type GroundGlassM7eQualityMatrixRole,
  type GroundGlassM7eReportInventory,
} from "./groundGlassM7eGatherB1Evidence";
import type { GroundGlassM5qDimensionId, GroundGlassM5qPairedCapEvidence } from "./groundGlassM5qQualification";
import type { GroundGlassB1BoundaryProbeReadback } from "./groundGlassWebGpuTestSeam";
import { equalGroundGlassM7eLosslessJsonValue } from "./groundGlassM7eLosslessEvidenceJson";

export type GroundGlassM7eSerializedReport = Readonly<{
  schemaVersion: 1;
  reportId: "ground-glass-m7e-r187-gather-b1";
  evaluatorRevision: string;
  sourceCommitSha: string;
  testInvocation: string;
  runtime: GroundGlassM7eReportInventory["runtime"];
  thresholds: typeof GROUND_GLASS_M7E_R187_THRESHOLDS;
  qualification: GroundGlassM7eQualityEvaluation;
  inventory: Omit<GroundGlassM7eReportInventory, "b1BoundaryProbe"> & Readonly<{ b1BoundaryProbe: null }>;
  b1BoundaryProbe: Readonly<{
    status: "passed" | "failed";
    observedCaseIds: readonly string[];
    issues: readonly unknown[];
    readback: unknown;
  }>;
  supportingArtifacts: readonly Readonly<{
    scenarioId: string;
    files: string;
    sha256: string;
    manifestSha256: string;
  }>[];
}>;

export type GroundGlassM7eReportReplay = Readonly<{
  status: "passed" | "failed";
  captureCount: number;
  captureEvaluations: ReturnType<typeof evaluateGroundGlassM7eNativeCapture>[];
  boundaryProbe: ReturnType<typeof evaluateGroundGlassM7eB1BoundaryProbe>;
  inventoryIssues: ReturnType<typeof validateGroundGlassM7eReportInventory>;
  qualityEvaluation: GroundGlassM7eQualityEvaluation;
  issues: readonly string[];
}>;

const same = (left: unknown, right: unknown): boolean => equalGroundGlassM7eLosslessJsonValue(left, right);

const r3CaptureFromEnvelope = (envelope: GroundGlassM7eCaptureEnvelope): GroundGlassApertureGatherR3Capture => {
  const { capture } = envelope;
  const buffers = capture.readbackBuffers;
  if (!buffers) throw new Error(`M7E replay capture ${envelope.scenarioId} has no rehydrated readback buffers`);
  return {
    captureId: capture.captureId,
    requestId: capture.requestId,
    sceneId: capture.sceneId,
    sceneSourceRevision: capture.sceneSourceRevision,
    effectiveOpticalRequestFingerprint: capture.effectiveOpticalRequestFingerprint,
    cameraStateFingerprint: capture.cameraStateFingerprint,
    readbackOrigin: capture.readbackOrigin,
    qualityMode: capture.qualityMode as GroundGlassR3QualityMode,
    sourceDimensions: { widthPx: capture.sourceWidthPx, heightPx: capture.sourceHeightPx },
    gatherDimensions: { widthPx: capture.farGatherWidthPx, heightPx: capture.farGatherHeightPx },
    sampledFilmDimensionsMm: capture.sampledFilmDimensionsMm,
    sampleCount: capture.sampleCount as 32 | 64,
    maximumRadiusPx: capture.maximumRadiusPx,
    colorDomain: capture.colorDomain,
    targetFormats: {
      sourceColor: capture.targetFormats.sourceColor ?? "",
      physical: capture.targetFormats.physical ?? "",
      validity: capture.targetFormats.validity ?? "",
      far: capture.targetFormats.far ?? "",
      near: capture.targetFormats.near ?? "",
      b1: capture.targetFormats.b1 ?? "",
    },
    reportedRadiusEvidence: {
      maximumUncappedRadiusPx: capture.radius.maximumUncappedRadiusPx,
      cappedPixelCount: capture.radius.cappedPixelCount,
    },
    readbackBuffers: {
      sourceRgba: Float32Array.from(buffers.sourceRgba),
      depth: Float32Array.from(buffers.depth),
      physicalRgba: Float32Array.from(buffers.physicalRgba),
      validity: Uint8Array.from(buffers.validity),
      farGatherRgba: Float32Array.from(buffers.farGatherRgba),
      b1FarRgba: Float32Array.from(buffers.b1FarRgba),
      nearBeforeB1Rgba: Float32Array.from(buffers.nearBeforeB1Rgba),
      nearAfterB1Rgba: Float32Array.from(buffers.nearAfterB1Rgba),
      nearCpuReferenceRgba: Float32Array.from(buffers.nearCpuReferenceRgba),
      observedSelectedGatherIds: Int32Array.from(buffers.observedSelectedGatherIds),
      observedGatherCenterSourceIds: Int32Array.from(buffers.observedGatherCenterSourceIds),
      b1DecisionRgba: Uint8Array.from(buffers.b1Decision),
    },
  };
};

const rmseChannels = (left: ArrayLike<number>, right: ArrayLike<number>, channels: readonly number[]): number | null => {
  if (left.length === 0 || left.length !== right.length || left.length % 4 !== 0) return null;
  let squared = 0;
  let count = 0;
  for (let index = 0; index < left.length; index += 1) {
    if (!channels.includes(index % 4)) continue;
    const error = left[index]! - right[index]!;
    if (!Number.isFinite(error)) return null;
    squared += error * error;
    count += 1;
  }
  return count === 0 ? null : Math.sqrt(squared / count);
};

const pairedCapEvidence = (
  stress: GroundGlassApertureGatherR3Evaluation,
  control: GroundGlassApertureGatherR3Evaluation,
  stressCaptures: GroundGlassApertureGatherR3CaptureMatrix,
  controlCaptures: GroundGlassApertureGatherR3CaptureMatrix,
  opticalStateId: string,
): GroundGlassM5qPairedCapEvidence => ({
  opticalStateId,
  stressedCapPx: 2,
  controlCapPx: 60,
  maximumUncappedRadiusPx: stress.radiusCapEvidence.maximumUncappedRadiusPx,
  stressedCappedPixelCount: stress.radiusCapEvidence.cappedPixelCount,
  controlCappedPixelCount: control.radiusCapEvidence.cappedPixelCount,
  captureIds: {
    stressedHalf32: stress.captureIds.half32,
    stressedFull32: stress.captureIds.full32,
    stressedFull64: stress.captureIds.full64,
    controlHalf32: control.captureIds.half32,
    controlFull32: control.captureIds.full32,
    controlFull64: control.captureIds.full64,
  },
  fingerprints: {
    stressed: {
      depth: stress.provenance.fingerprints.half32.depth ?? "",
      physical: stress.provenance.fingerprints.half32.physical ?? "",
      validity: stress.provenance.fingerprints.half32.validity ?? "",
      sourceColor: stress.provenance.fingerprints.half32.sourceColor ?? "",
      camera: stress.captureProvenance.half32.cameraStateFingerprint,
    },
    control: {
      depth: control.provenance.fingerprints.half32.depth ?? "",
      physical: control.provenance.fingerprints.half32.physical ?? "",
      validity: control.provenance.fingerprints.half32.validity ?? "",
      sourceColor: control.provenance.fingerprints.half32.sourceColor ?? "",
      camera: control.captureProvenance.half32.cameraStateFingerprint,
    },
  },
  sameCapReferences: {
    stressed: {
      fullFrameRmse: stress.referenceConvergence.fullFrame.rmse,
      fullFramePixelCount: stress.referenceConvergence.fullFrame.pixelCount,
      maximumChannelError: stress.referenceConvergence.fullFrame.maximumChannelError,
      interiorFarRmse: stress.referenceConvergence.interiorFar.rmse,
      interiorFarPixelCount: stress.referenceConvergence.interiorFar.pixelCount,
      depthEdgeRmse: stress.referenceConvergence.depthEdge.rmse,
      depthEdgePixelCount: stress.referenceConvergence.depthEdge.pixelCount,
    },
    control: {
      fullFrameRmse: control.referenceConvergence.fullFrame.rmse,
      fullFramePixelCount: control.referenceConvergence.fullFrame.pixelCount,
      maximumChannelError: control.referenceConvergence.fullFrame.maximumChannelError,
      interiorFarRmse: control.referenceConvergence.interiorFar.rmse,
      interiorFarPixelCount: control.referenceConvergence.interiorFar.pixelCount,
      depthEdgeRmse: control.referenceConvergence.depthEdge.rmse,
      depthEdgePixelCount: control.referenceConvergence.depthEdge.pixelCount,
    },
  },
  crossCapSensitivity: {
    full32FarRmse: rmseChannels(stressCaptures.full32.readbackBuffers.farGatherRgba, controlCaptures.full32.readbackBuffers.farGatherRgba, [0, 1, 2]),
    half32B1Rmse: rmseChannels(stressCaptures.half32.readbackBuffers.b1FarRgba, controlCaptures.half32.readbackBuffers.b1FarRgba, [0, 1, 2]),
    nearRgbRmse: rmseChannels(stressCaptures.half32.readbackBuffers.nearBeforeB1Rgba, controlCaptures.half32.readbackBuffers.nearBeforeB1Rgba, [0, 1, 2]),
    nearAlphaRmse: rmseChannels(stressCaptures.half32.readbackBuffers.nearBeforeB1Rgba, controlCaptures.half32.readbackBuffers.nearBeforeB1Rgba, [3]),
    fallbackBoundaryGradientDelta: stress.fallbackMetrics.boundaryGradient.meanRelativeError !== null
      && control.fallbackMetrics.boundaryGradient.meanRelativeError !== null
      ? Math.abs(stress.fallbackMetrics.boundaryGradient.meanRelativeError - control.fallbackMetrics.boundaryGradient.meanRelativeError) : null,
  },
});

const ROLE_SCENARIOS: Readonly<Record<GroundGlassM7eQualityMatrixRole, Readonly<Record<GroundGlassR3QualityMode, string>>>> = {
  "q1-control": {
    half32: "q1-control-cap60-half32", full32: "q1-control-cap60-full32", full64: "q1-control-cap60-full64",
  },
  "q5-stress": {
    half32: "q5-stress-cap2-half32", full32: "q5-stress-cap2-full32", full64: "q5-stress-cap2-full64",
  },
  "q2-q7": {
    half32: "q2-q7-cap60-half32", full32: "q2-q7-cap60-full32", full64: "q2-q7-cap60-full64",
  },
  "q3-q4": {
    half32: "q3-q4-cap60-half32", full32: "q3-q4-cap60-full32", full64: "q3-q4-cap60-full64",
  },
};
const ROLE_DIMENSION: Readonly<Record<GroundGlassM7eQualityMatrixRole, GroundGlassM5qDimensionId>> = {
  "q1-control": "Q1", "q5-stress": "Q5", "q2-q7": "Q2", "q3-q4": "Q3",
};

const matrixCapturesFromEnvelopes = (
  role: GroundGlassM7eQualityMatrixRole,
  captures: ReadonlyMap<string, GroundGlassM7eCaptureEnvelope>,
): GroundGlassApertureGatherR3CaptureMatrix => {
  const scenarioIds = ROLE_SCENARIOS[role];
  const half32 = captures.get(scenarioIds.half32);
  const full32 = captures.get(scenarioIds.full32);
  const full64 = captures.get(scenarioIds.full64);
  if (!half32 || !full32 || !full64) throw new Error(`M7E quality role ${role} is missing a persisted profile capture`);
  return {
    half32: r3CaptureFromEnvelope(half32),
    full32: r3CaptureFromEnvelope(full32),
    full64: r3CaptureFromEnvelope(full64),
  };
};

const compareSerializedCaptureMetadata = (
  storedEnvelope: GroundGlassM7eCaptureEnvelope,
  replayedEnvelope: GroundGlassM7eCaptureEnvelope,
): boolean => {
  const storedCapture = { ...storedEnvelope.capture, readbackBuffers: null };
  const replayedCapture = { ...replayedEnvelope.capture, readbackBuffers: null };
  return same({ ...storedEnvelope, capture: storedCapture }, { ...replayedEnvelope, capture: replayedCapture });
};

/** Offline re-evaluation of all M7E captures, B1 boundary cases, and frozen Q metrics. */
export const replayGroundGlassM7eReport = (
  report: GroundGlassM7eSerializedReport,
  captures: readonly GroundGlassM7eCaptureEnvelope[],
  boundaryProbe: GroundGlassB1BoundaryProbeReadback,
  standaloneBoundaryProbe: GroundGlassB1BoundaryProbeReadback,
): GroundGlassM7eReportReplay => {
  const issues: string[] = [];
  const add = (message: string): void => { issues.push(message); };
  if (report.schemaVersion !== 1 || report.reportId !== "ground-glass-m7e-r187-gather-b1") add("report identity or schema mismatch");
  if (report.evaluatorRevision !== GROUND_GLASS_M7E_EVALUATOR_REVISION
      || report.inventory.evaluatorRevision !== GROUND_GLASS_M7E_EVALUATOR_REVISION) add("report and inventory must use the M7E evaluator v2 revision");
  if (!same(report.thresholds, GROUND_GLASS_M7E_R187_THRESHOLDS)) add("M7E thresholds differ from the frozen r187 decision contract");
  if (report.inventory.sourceCommitSha !== report.sourceCommitSha) add("top-level and inventory source commit provenance differ");
  if (!same(report.inventory.runtime, report.runtime)) add("top-level and inventory runtime identity differ");
  if (report.inventory.b1BoundaryProbe !== null) add("serialized inventory must refer to the canonical lossless boundary probe separately");
  if (captures.length !== GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.length) add("twelve native captures are required for offline M7E replay");

  const byScenario = new Map<string, GroundGlassM7eCaptureEnvelope>();
  for (const envelope of captures) {
    if (byScenario.has(envelope.scenarioId)) add(`duplicate capture scenario ${envelope.scenarioId}`);
    byScenario.set(envelope.scenarioId, envelope);
  }
  for (const scenarioId of GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS) {
    if (!byScenario.has(scenarioId)) add(`missing capture ${scenarioId}`);
  }
  if (byScenario.size !== GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.length) add("capture inventory contains an unexpected scenario");

  const captureEvaluations = captures.map((envelope) => evaluateGroundGlassM7eNativeCapture(envelope,
    envelope.scenarioId.startsWith("q5-stress-cap2-") ? 2 : 60));
  for (const evaluation of captureEvaluations) {
    if (evaluation.status !== "passed") add(`${evaluation.scenarioId}: ${evaluation.issues.map(({ code }) => code).join(",")}`);
  }
  for (const storedScenario of report.inventory.scenarios) {
    const replayed = byScenario.get(storedScenario.id);
    if (!replayed) continue;
    if (storedScenario.status !== "passed" || !storedScenario.capture) {
      add(`${storedScenario.id}: persisted inventory does not claim a passed capture with provenance`);
      continue;
    }
    if (!compareSerializedCaptureMetadata(storedScenario.capture, replayed)) add(`${storedScenario.id}: report capture metadata differs from the persisted artifact manifest`);
  }

  const boundaryEvaluation = evaluateGroundGlassM7eB1BoundaryProbe(boundaryProbe);
  if (!same(boundaryProbe, standaloneBoundaryProbe)) add("standalone and embedded B1 boundary probe payloads differ");
  if (boundaryEvaluation.status !== report.b1BoundaryProbe.status
      || !same(boundaryEvaluation.observedCaseIds, report.b1BoundaryProbe.observedCaseIds)
      || !same(boundaryEvaluation.issues, report.b1BoundaryProbe.issues)) {
    add("stored B1 boundary probe decision differs from its independently recomputed result");
  }

  const hydratedInventory: GroundGlassM7eReportInventory = {
    ...report.inventory,
    b1BoundaryProbe: boundaryProbe,
    scenarios: report.inventory.scenarios.map((scenario) => ({
      ...scenario,
      ...(byScenario.has(scenario.id) ? { capture: byScenario.get(scenario.id)! } : {}),
    })),
  };
  const inventoryIssues = validateGroundGlassM7eReportInventory(hydratedInventory);
  for (const issue of inventoryIssues) add(`inventory ${issue.code}: ${issue.field}`);

  let qualityEvaluation: GroundGlassM7eQualityEvaluation;
  try {
    const matrixCaptures = new Map<GroundGlassM7eQualityMatrixRole, GroundGlassApertureGatherR3CaptureMatrix>();
    const matrixR3 = new Map<GroundGlassM7eQualityMatrixRole, GroundGlassApertureGatherR3Evaluation>();
    for (const role of Object.keys(ROLE_SCENARIOS) as GroundGlassM7eQualityMatrixRole[]) {
      const matrixCapturesValue = matrixCapturesFromEnvelopes(role, byScenario);
      matrixCaptures.set(role, matrixCapturesValue);
      matrixR3.set(role, evaluateGroundGlassApertureGatherR3(matrixCapturesValue, GROUND_GLASS_M7E_R187_THRESHOLDS));
    }
    const dimensionRole: Readonly<Record<GroundGlassM7eQualityMatrixRole, GroundGlassM5qDimensionId>> = ROLE_DIMENSION;
    const dimensionData = report.qualification.dimensions;
    const matrixInputs: GroundGlassM7eQualityMatrix[] = [];
    for (const role of Object.keys(ROLE_SCENARIOS) as GroundGlassM7eQualityMatrixRole[]) {
      const dimension = dimensionData[dimensionRole[role]];
      const r3 = matrixR3.get(role);
      const capturesForRole = matrixCaptures.get(role);
      const storedR3 = report.qualification.matrixEvaluations[role];
      if (!dimension || !r3 || !capturesForRole || !storedR3) throw new Error(`Persisted quality input ${role} is incomplete`);
      if (!same(r3, storedR3)) add(`${role}: recomputed R3 metrics differ from persisted capture metrics`);
      const context = {
        opticalStateId: dimension.opticalStateId,
        sceneId: dimension.sceneId,
        evidenceSource: dimension.evidenceSource,
        m5ExecutionPath: "ground-glass-webgpu-adapter" as const,
        sceneSourceRevision: dimension.sceneSourceRevision,
        candidateSelectionReason: dimension.candidateSelectionReason,
        runtime: dimension.runtime,
      };
      if (!context.candidateSelectionReason.trim()) add(`${role}: optical-state selection provenance is missing`);
      const pair = role === "q5-stress"
        ? pairedCapEvidence(
          r3,
          matrixR3.get("q1-control")!,
          capturesForRole,
          matrixCaptures.get("q1-control")!,
          dimension.opticalStateId,
        )
        : undefined;
      matrixInputs.push({ role, context, r3: storedR3, captures: capturesForRole, ...(pair ? { pairedCapEvidence: pair } : {}) });
    }
    qualityEvaluation = evaluateGroundGlassM7eQuality(matrixInputs);
    if (!same(qualityEvaluation, report.qualification)) add("recomputed Q1-Q7 metrics or decisions differ from the persisted qualification results");
  } catch (error) {
    add(`quality replay failed: ${error instanceof Error ? error.message : "unknown replay error"}`);
    qualityEvaluation = report.qualification;
  }

  return {
    status: issues.length === 0 ? "passed" : "failed",
    captureCount: captures.length,
    captureEvaluations,
    boundaryProbe: boundaryEvaluation,
    inventoryIssues,
    qualityEvaluation,
    issues,
  };
};
