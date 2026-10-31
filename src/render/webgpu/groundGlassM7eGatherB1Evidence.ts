import {
  evaluateGroundGlassApertureGatherR3,
  type GroundGlassApertureGatherR3CaptureMatrix,
  type GroundGlassApertureGatherR3Evaluation,
  type GroundGlassApertureGatherR3Thresholds,
} from "./groundGlassApertureGatherQuality";
import {
  evaluateGroundGlassM5qDimensions,
  GROUND_GLASS_M5Q_R186_FROZEN_THRESHOLDS,
  type GroundGlassM5qDimensionId,
  type GroundGlassM5qEvidenceContext,
  type GroundGlassM5qPairedCapEvidence,
  type GroundGlassM5qFrozenThresholds,
  type GroundGlassM5qDimensionDecision,
} from "./groundGlassM5qQualification";
import {
  reconstructGroundGlassB1Reference,
  type GroundGlassB1FallbackReason,
  type GroundGlassB1SelectedPath,
} from "./groundGlassB1Reference";
import { DataUtils } from "three";
import {
  ARCHITECTURE_RISE_APERTURE_GATHER_R187_EVIDENCE_REVISION,
  ARCHITECTURE_RISE_B1_R187_RESEARCH_EVIDENCE_REVISION,
} from "./groundGlassRawWebGpuCompatibility";
import type {
  GroundGlassApertureGatherCaptureReadback,
  GroundGlassB1BoundaryProbeReadback,
} from "./groundGlassWebGpuTestSeam";

export const GROUND_GLASS_M7E_EVALUATOR_REVISION = "m7e-r187-gather-b1-evaluator-v1";
export const GROUND_GLASS_M7E_R187_M5Q_REVISION = "m5q-architecture-rise-r187-v1";
export const GROUND_GLASS_M7E_R187_GATHER_REVISION = ARCHITECTURE_RISE_APERTURE_GATHER_R187_EVIDENCE_REVISION;
export const GROUND_GLASS_M7E_R187_B1_REVISION = ARCHITECTURE_RISE_B1_R187_RESEARCH_EVIDENCE_REVISION;
export const GROUND_GLASS_M7E_SCENE_ID = "architecture-rise";
export const GROUND_GLASS_M7E_SCENE_SOURCE_REVISION = "architecture-rise-raw-rtt-v1";

/**
 * M7E uses the frozen M5Q numbers without adjustment. The revision identifies
 * the new r187 captures; sourceThresholdRevision preserves the historical
 * r186 threshold provenance.
 */
export const GROUND_GLASS_M7E_R187_THRESHOLDS = Object.freeze({
  revision: GROUND_GLASS_M7E_R187_M5Q_REVISION,
  sourceThresholdRevision: GROUND_GLASS_M5Q_R186_FROZEN_THRESHOLDS.revision,
  frozenBeforeConfirmatory: true,
  evidenceScope: "single-native-state",
  minimumInteriorFarPixels: 1000,
  minimumDepthEdgePixels: 100,
  minimumNearFarBoundaryPairs: 100,
  minimumNearCoveragePixels: 100,
  minimumFractionalCoveragePixels: 32,
  minimumNearFarBoundaryCoveragePixels: 20,
  minimumSpreadOutsideSharpNearPixels: 20,
  minimumFallbackBoundaryPairs: 100,
  minimumStrongOverrunPx: 4,
  minimumFallbackPixels: 100,
  minimumMeaningfulBlurFallbackPixels: 20,
  minimumSignedBoundaryPairs: 100,
  minimumSignedBoundarySidePixels: 100,
  minimumCappedPixels: 100,
  maximumReferenceRmse: 0.001,
  maximumReferenceFullFrameRmse: 0.001,
  maximumReferenceChannelError: 0.01,
  maximumReferenceInteriorFarRmse: 0.001,
  maximumReferenceDepthEdgeRmse: 0.001,
  maximumB1FullFrameRmse: 0.05,
  maximumB1InteriorFarRmse: 0.05,
  maximumB1DepthEdgeRmse: 0.05,
  maximumB1SignedBoundaryRmse: 0.1,
  maximumB1FallbackRmse: 0.05,
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
} satisfies GroundGlassApertureGatherR3Thresholds & GroundGlassM5qFrozenThresholds & Readonly<{
  sourceThresholdRevision: string;
}>);

export type GroundGlassM7eRuntimeIdentity = Readonly<{
  rendererRevision: "r187";
  rendererFamily: "webgpu-renderer";
  actualExecutionApi: "webgpu";
  internalFallback: "none";
  applicationFallback: false;
  browserVersion: string;
  operatingSystem: string;
  nodeVersion: string;
  nativeRequired: true;
}>;

export type GroundGlassM7eCaptureEnvelope = Readonly<{
  scenarioId: string;
  capture: GroundGlassApertureGatherCaptureReadback;
  runtime: GroundGlassM7eRuntimeIdentity;
  sourceCommitSha: string;
  testInvocation: string;
  supportingArtifact: string;
  hostFrameResult: Readonly<{
    status: "completed" | "failed" | "pending";
    accepted: boolean;
    requestId: string;
    sceneId: string;
    rendererGenerationId: string;
  }>;
}>;

export type GroundGlassM7eCaptureIssue = Readonly<{
  code: string;
  field: string;
  detail: string;
}>;

export type GroundGlassM7eCaptureEvaluation = Readonly<{
  scenarioId: string;
  status: "passed" | "failed";
  issues: readonly GroundGlassM7eCaptureIssue[];
  measured: Readonly<{
    farRgbRmse: number | null;
    farMaximumChannelError: number | null;
    nearRgbRmse: number | null;
    nearAlphaRmse: number | null;
    nearB1RgbMaximumError: number | null;
    nearB1AlphaMaximumError: number | null;
    b1FullFrameRmse: number | null;
    b1InvalidPixels: number | null;
  }>;
}>;

export type GroundGlassM7eQualityMatrixRole = "q1-control" | "q5-stress" | "q2-q7" | "q3-q4";

export type GroundGlassM7eQualityMatrix = Readonly<{
  role: GroundGlassM7eQualityMatrixRole;
  context: GroundGlassM5qEvidenceContext;
  r3: GroundGlassApertureGatherR3Evaluation;
  captures: GroundGlassApertureGatherR3CaptureMatrix;
  pairedCapEvidence?: GroundGlassM5qPairedCapEvidence;
}>;

export type GroundGlassM7eQualityEvaluation = Readonly<{
  status: "research-qualified" | "partially-qualified" | "not-qualified";
  dimensions: Readonly<Record<GroundGlassM5qDimensionId, GroundGlassM5qDimensionDecision>>;
  matrixEvaluations: Readonly<Record<GroundGlassM7eQualityMatrixRole, GroundGlassApertureGatherR3Evaluation>>;
  issues: readonly string[];
}>;

export type GroundGlassM7eReportScenario = Readonly<{
  id: string;
  status: "passed" | "failed" | "blocked" | "not-run";
  capture?: GroundGlassM7eCaptureEnvelope;
}>;

export type GroundGlassM7eReportInventory = Readonly<{
  schemaVersion: 1;
  reportId: "ground-glass-m7e-r187-gather-b1";
  evaluatorRevision: string;
  sourceCommitSha: string;
  runtime: GroundGlassM7eRuntimeIdentity;
  declaredCounts: Readonly<Record<"passed" | "failed" | "blocked" | "not-run", number>>;
  scenarios: readonly GroundGlassM7eReportScenario[];
  b1BoundaryProbe: GroundGlassB1BoundaryProbeReadback | null;
  m3RendererSelectionAuthority: "m3-raw-pilot" | "m5-evidence" | "unknown";
  m5RendererAttemptAuthorized: boolean;
  m5GatherEvidenceStatus: "research-only" | "verified" | "implementation-verified";
  m5B1EvidenceStatus: "research-only" | "verified" | "implementation-verified";
  m6R187Authorized: boolean;
  productionWebGpuEnabled: boolean;
}>;

export type GroundGlassM7eReportIssue = Readonly<{
  code: string;
  field: string;
  detail: string;
}>;

export const GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS = [
  "q5-stress-cap2-half32", "q5-stress-cap2-full32", "q5-stress-cap2-full64",
  "q1-control-cap60-half32", "q1-control-cap60-full32", "q1-control-cap60-full64",
  "q2-q7-cap60-half32", "q2-q7-cap60-full32", "q2-q7-cap60-full64",
  "q3-q4-cap60-half32", "q3-q4-cap60-full32", "q3-q4-cap60-full64",
] as const;

export type GroundGlassM7eBoundaryProbeEvaluation = Readonly<{
  status: "passed" | "failed";
  issues: readonly GroundGlassM7eCaptureIssue[];
  observedCaseIds: readonly string[];
}>;

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const isFiniteArray = (values: ArrayLike<number>): boolean => {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) return false;
  }
  return true;
};
const selectedChannelRmse = (
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  channels: readonly number[],
): number | null => {
  if (actual.length !== expected.length || actual.length === 0) return null;
  let squared = 0;
  let count = 0;
  for (let index = 0; index < actual.length; index += 1) {
    if (!channels.includes(index % 4)) continue;
    const error = actual[index] - expected[index];
    squared += error * error;
    count += 1;
  }
  return count === 0 ? null : Math.sqrt(squared / count);
};
const selectedChannelMaxAbsError = (
  actual: ArrayLike<number>,
  expected: ArrayLike<number>,
  channels: readonly number[],
): number | null => {
  if (actual.length !== expected.length || actual.length === 0) return null;
  let maximum = 0;
  for (let index = 0; index < actual.length; index += 1) {
    if (channels.includes(index % 4)) maximum = Math.max(maximum, Math.abs(actual[index] - expected[index]));
  }
  return maximum;
};

/** Validate one registered-app native capture from observed values, not test labels. */
export const evaluateGroundGlassM7eNativeCapture = (
  envelope: GroundGlassM7eCaptureEnvelope,
  expectedRadiusCapPx?: number,
): GroundGlassM7eCaptureEvaluation => {
  const { capture, runtime } = envelope;
  const issues: GroundGlassM7eCaptureIssue[] = [];
  const add = (code: string, field: string, detail: string): void => { issues.push({ code, field, detail }); };
  if (runtime.rendererRevision !== "r187" || capture.rendererRevision !== "r187") {
    add("wrong-renderer-revision", "runtime.rendererRevision", "M7E native M5 evidence requires r187 in both the mounted capture and runtime envelope");
  }
  if (runtime.rendererFamily !== "webgpu-renderer" || capture.rendererFamily !== "webgpu-renderer") {
    add("wrong-renderer-family", "runtime.rendererFamily", "M7E requires the mounted Three.js WebGPURenderer");
  }
  if (runtime.actualExecutionApi !== "webgpu" || capture.actualExecutionApi !== "webgpu" || runtime.internalFallback !== "none" || capture.internalFallback !== "none") {
    add("not-native-webgpu", "runtime.actualExecutionApi", "WebGL2 internal compatibility execution is not native WebGPU evidence");
  }
  if (runtime.applicationFallback !== false) add("application-fallback", "runtime.applicationFallback", "application WebGL fallback must not be active for a native capture");
  if (runtime.nativeRequired !== true) add("native-not-required", "runtime.nativeRequired", "the native-required project must be recorded");
  if (!nonEmpty(runtime.browserVersion) || !nonEmpty(runtime.operatingSystem) || !nonEmpty(runtime.nodeVersion)) {
    add("incomplete-runtime-provenance", "runtime", "browser, operating system, and Node runtime must be recorded");
  }
  if (!/^[0-9a-f]{40}$/i.test(envelope.sourceCommitSha)) add("invalid-source-revision", "sourceCommitSha", "envelope must identify the full source commit SHA");
  if (!envelope.testInvocation.includes("chrome-native-webgpu")) add("missing-native-invocation", "testInvocation", "the actual native-required Playwright project invocation is missing");
  if (!nonEmpty(envelope.supportingArtifact)) add("missing-artifact", "supportingArtifact", "native capture artifact reference is required");
  if (!nonEmpty(envelope.scenarioId)) add("missing-scenario-id", "scenarioId", "native capture must have an inventory identity");

  if (capture.sceneId !== GROUND_GLASS_M7E_SCENE_ID || capture.sceneSourceRevision !== GROUND_GLASS_M7E_SCENE_SOURCE_REVISION) {
    add("wrong-scene-source", "capture.sceneId", "capture must identify the registered Architecture Rise source revision");
  }
  if (!nonEmpty(capture.requestId) || !nonEmpty(capture.channelId) || !nonEmpty(capture.rendererGenerationId)) {
    add("missing-lifecycle-identity", "capture", "request, channel, and renderer generation identities are required");
  }
  if (envelope.hostFrameResult.status !== "completed" || envelope.hostFrameResult.accepted !== true
      || envelope.hostFrameResult.requestId !== capture.requestId || envelope.hostFrameResult.sceneId !== capture.sceneId
      || envelope.hostFrameResult.rendererGenerationId !== capture.rendererGenerationId) {
    add("stale-or-unaccepted-frame", "hostFrameResult", "capture must match a current host-accepted completed frame in the same generation");
  }
  const m4 = capture.m4Input;
  if (!m4 || m4.status !== "completed" || !nonEmpty(m4.requestId) || m4.requestId !== capture.requestId
      || !nonEmpty(m4.rendererGenerationId) || m4.rendererGenerationId !== capture.rendererGenerationId
      || m4.sceneId !== capture.sceneId || m4.sceneSourceRevision !== capture.sceneSourceRevision) {
    add("m4-input-identity", "capture.m4Input", "the completed M4 inputs must belong to this request, scene, source revision, and generation");
  }
  if (m4 && (m4.targetFormats.depth !== "depth24plus" || m4.targetFormats.physical !== "rgba16float" || m4.targetFormats.validity !== "rgba8unorm")) {
    add("m4-storage-format", "capture.m4Input.targetFormats", "M4 native source formats must be observed as depth24plus/rgba16float/rgba8unorm");
  }
  if (capture.targetFormats.far !== "rgba16float" || capture.targetFormats.near !== "rgba16float"
      || capture.targetFormats.b1 !== "rgba16float" || capture.targetFormats.composite !== "rgba16float"
      || capture.targetFormats.sourceColor !== "rgba8unorm" || capture.targetFormats.provenance !== "rgba32float"
      || capture.targetFormats.decisions !== "rgba8unorm") {
    add("m5-storage-format", "capture.targetFormats", "observed native M5 target formats do not match the supported storage contract");
  }
  if (!capture.resourceInventory || capture.resourceInventory.m5OwnedRenderTargetCount !== 10
      || capture.resourceInventory.targetAllocations.length !== 10) {
    add("m5-target-inventory", "capture.resourceInventory", "the capture must show the established ten adapter-owned M5 targets");
  }
  if (!capture.inputFingerprints || Object.values(capture.inputFingerprints).some((value) => !nonEmpty(value))) {
    add("missing-input-fingerprints", "capture.inputFingerprints", "all source, depth, M4 physical, validity, and camera fingerprints are required");
  }

  const modeExpected = capture.qualityMode === "half32" ? 32 : capture.qualityMode === "full32" ? 32 : capture.qualityMode === "full64" ? 64 : null;
  if (modeExpected === null || capture.sampleCount !== modeExpected) add("quality-sample-count", "capture.sampleCount", "sample count does not match the supported Half32/Full32/Full64 profile");
  if (!Number.isFinite(capture.sourceWidthPx) || !Number.isFinite(capture.sourceHeightPx) || capture.sourceWidthPx < 1 || capture.sourceHeightPx < 1
      || !Number.isFinite(capture.farGatherWidthPx) || !Number.isFinite(capture.farGatherHeightPx) || capture.farGatherWidthPx < 1 || capture.farGatherHeightPx < 1) {
    add("invalid-capture-dimensions", "capture", "source and gather dimensions must be positive finite values");
  }
  if (expectedRadiusCapPx !== undefined && capture.maximumRadiusPx !== expectedRadiusCapPx) add("wrong-radius-cap", "capture.maximumRadiusPx", "capture radius cap does not match its declared matrix role");

  const b = capture.readbackBuffers;
  const measured = {
    farRgbRmse: null as number | null,
    farMaximumChannelError: null as number | null,
    nearRgbRmse: null as number | null,
    nearAlphaRmse: null as number | null,
    nearB1RgbMaximumError: null as number | null,
    nearB1AlphaMaximumError: null as number | null,
    b1FullFrameRmse: null as number | null,
    b1InvalidPixels: null as number | null,
  };
  if (!b) {
    add("missing-readback", "capture.readbackBuffers", "actual GPU readback and independent CPU references are required");
  } else {
    const sourcePixels = capture.sourceWidthPx * capture.sourceHeightPx;
    const gatherPixels = capture.farGatherWidthPx * capture.farGatherHeightPx;
    const expectedLengths: readonly [string, ArrayLike<number>, number][] = [
      ["sourceRgba", b.sourceRgba, sourcePixels * 4],
      ["depth", b.depth, sourcePixels],
      ["physicalRgba", b.physicalRgba, sourcePixels * 4],
      ["validity", b.validity, sourcePixels],
      ["farGatherRgba", b.farGatherRgba, gatherPixels * 4],
      ["farCpuReferenceRgba", b.farCpuReferenceRgba, gatherPixels * 4],
      ["nearRgba", b.nearRgba, gatherPixels * 4],
      ["nearCpuReferenceRgba", b.nearCpuReferenceRgba, gatherPixels * 4],
      ["nearBeforeB1Rgba", b.nearBeforeB1Rgba, gatherPixels * 4],
      ["nearAfterB1Rgba", b.nearAfterB1Rgba, gatherPixels * 4],
      ["b1FarRgba", b.b1FarRgba, sourcePixels * 4],
      ["observedGatherCenterSourceIds", b.observedGatherCenterSourceIds, gatherPixels * 2],
      ["observedSelectedGatherIds", b.observedSelectedGatherIds, sourcePixels * 2],
      ["observedSelectedCenterSourceIds", b.observedSelectedCenterSourceIds, sourcePixels * 2],
      ["b1Decision", b.b1Decision, sourcePixels * 4],
    ];
    for (const [name, values, expected] of expectedLengths) {
      if (!values || values.length !== expected) add("readback-length", `capture.readbackBuffers.${name}`, `expected ${expected} values, observed ${values?.length ?? "missing"}`);
      else if (!isFiniteArray(values)) add("non-finite-readback", `capture.readbackBuffers.${name}`, "readback contains NaN or infinity");
    }
    measured.farRgbRmse = selectedChannelRmse(b.farGatherRgba, b.farCpuReferenceRgba, [0, 1, 2]);
    measured.farMaximumChannelError = selectedChannelMaxAbsError(b.farGatherRgba, b.farCpuReferenceRgba, [0, 1, 2]);
    measured.nearRgbRmse = selectedChannelRmse(b.nearRgba, b.nearCpuReferenceRgba, [0, 1, 2]);
    measured.nearAlphaRmse = selectedChannelRmse(b.nearRgba, b.nearCpuReferenceRgba, [3]);
    if (b.nearRgba.length === b.nearBeforeB1Rgba.length && b.nearRgba.length === b.nearAfterB1Rgba.length) {
      measured.nearB1RgbMaximumError = selectedChannelMaxAbsError(b.nearBeforeB1Rgba, b.nearAfterB1Rgba, [0, 1, 2]);
      measured.nearB1AlphaMaximumError = selectedChannelMaxAbsError(b.nearRgba, b.nearAfterB1Rgba, [3]);
    }
    if (measured.farRgbRmse === null || measured.farMaximumChannelError === null
        || measured.farRgbRmse > 0.001 || measured.farMaximumChannelError > 0.001) {
      add("far-cpu-comparison", "capture.readbackBuffers.farGatherRgba", "native Far GPU output exceeds the frozen CPU comparison limits");
    }
    if (measured.nearRgbRmse === null || measured.nearAlphaRmse === null
        || measured.nearRgbRmse > 0.001 || measured.nearAlphaRmse > 0.001) {
      add("near-cpu-comparison", "capture.readbackBuffers.nearRgba", "native Near GPU output exceeds the frozen CPU comparison limits");
    }
    if (measured.nearB1RgbMaximumError === null || measured.nearB1RgbMaximumError > 0.001
        || measured.nearB1AlphaMaximumError === null || measured.nearB1AlphaMaximumError > 0.001) {
      add("near-b1-independence", "capture.readbackBuffers.nearAfterB1Rgba", "B1 changed Near output or Near alpha beyond the frozen limit");
    }

    if (expectedLengths.every(([, values, expected]) => values && values.length === expected)) {
      const cpu = reconstructGroundGlassB1Reference({
        source: { widthPx: capture.sourceWidthPx, heightPx: capture.sourceHeightPx },
        gather: { widthPx: capture.farGatherWidthPx, heightPx: capture.farGatherHeightPx },
        sourceRgba: b.sourceRgba,
        gatherFarRgba: b.farGatherRgba,
        physicalRgba: b.physicalRgba,
        validity: b.validity,
        observedSelectedGatherIds: b.observedSelectedGatherIds,
        observedSelectedCenterSourceIds: b.observedSelectedCenterSourceIds,
        observedGatherCenterSourceIds: b.observedGatherCenterSourceIds,
      });
      measured.b1FullFrameRmse = selectedChannelRmse(b.b1FarRgba, cpu.farRgba, [0, 1, 2]);
      measured.b1InvalidPixels = cpu.counts.invalidOrUnresolvedCenter;
      if (measured.b1FullFrameRmse === null || measured.b1FullFrameRmse > 0.05) {
        add("b1-cpu-comparison", "capture.readbackBuffers.b1FarRgba", "native B1 output differs from the independent CPU reconstruction");
      }
      const decisions = b.b1Decision;
      for (let pixel = 0; pixel < sourcePixels; pixel += 1) {
        const offset = pixel * 4;
        const expectedPath: GroundGlassB1SelectedPath = cpu.selectedPath[pixel] as GroundGlassB1SelectedPath;
        const expectedReason: GroundGlassB1FallbackReason = cpu.fallbackReason[pixel] as GroundGlassB1FallbackReason;
        if (decisions[offset] !== (cpu.eligible[pixel] ? 1 : 0)
            || decisions[offset + 1] !== expectedReason
            || decisions[offset + 2] !== expectedPath) {
          add("b1-decision-mismatch", `capture.readbackBuffers.b1Decision[${pixel}]`, "GPU validity, fallback reason, or selected path differs from the independent B1 decision");
          break;
        }
      }
      if (capture.cpuB1Conformance.selectedCenterProvenanceMismatchCount !== cpu.counts.selectedCenterProvenanceMismatch
          || capture.cpuB1Conformance.eligibilityMismatchCount !== 0
          || capture.cpuB1Conformance.fallbackReasonMismatchCount !== 0
          || capture.cpuB1Conformance.selectedPathMismatchCount !== 0) {
        add("b1-summary-mismatch", "capture.cpuB1Conformance", "published B1 summary disagrees with the independent reconstruction of captured inputs");
      }
    }
  }

  return { scenarioId: envelope.scenarioId, status: issues.length === 0 ? "passed" : "failed", issues, measured };
};

const M7E_REQUIRED_B1_BOUNDARY_CASES = [
  "physical-positive-half-maximum-and-gather-rgba-maximum",
  "physical-negative-half-maximum-is-near-side",
  "physical-largest-half-value-below-maximum",
  "m4-unrepresentable-overflow-preserves-validity-code-two",
  "physical-nan",
  "physical-positive-infinity",
  "physical-negative-infinity",
  "m4-validity-code-two-remains-authoritative",
  "far-gather-nan-channel-fails-closed",
  "far-gather-infinity-channel-fails-closed",
] as const;

/** Validate observed binary16 bits and B1 fail-closed decisions from the native boundary probe. */
export const evaluateGroundGlassM7eB1BoundaryProbe = (
  probe: GroundGlassB1BoundaryProbeReadback,
): GroundGlassM7eBoundaryProbeEvaluation => {
  const issues: GroundGlassM7eCaptureIssue[] = [];
  const add = (code: string, field: string, detail: string): void => { issues.push({ code, field, detail }); };
  if (probe.rendererRevision !== "r187") add("wrong-renderer-revision", "probe.rendererRevision", "B1 boundary capture must be observed on Three.js r187");
  if (probe.rendererFamily !== "webgpu-renderer" || probe.actualExecutionApi !== "webgpu" || probe.internalFallback !== "none") {
    add("not-native-webgpu", "probe.runtime", "boundary probe requires native WebGPU without internal fallback");
  }
  if (probe.sceneId !== GROUND_GLASS_M7E_SCENE_ID || !nonEmpty(probe.requestId) || !nonEmpty(probe.channelId) || !nonEmpty(probe.rendererGenerationId)) {
    add("missing-probe-identity", "probe", "probe must identify Architecture Rise request, channel, and generation");
  }
  const expectedFormats = {
    sourceColor: "rgba8unorm", physical: "rgba16float", validity: "rgba8unorm",
    farGather: "rgba16float", provenance: "rgba32float", b1: "rgba16float", decision: "rgba8unorm",
  } as const;
  for (const [name, expected] of Object.entries(expectedFormats)) {
    if (probe.targetFormats[name as keyof typeof expectedFormats] !== expected) {
      add("unsupported-boundary-storage", `probe.targetFormats.${name}`, `expected observed ${expected} storage`);
    }
  }
  const ids = probe.cases.map(({ id }) => id);
  if (ids.length !== M7E_REQUIRED_B1_BOUNDARY_CASES.length
      || new Set(ids).size !== ids.length
      || M7E_REQUIRED_B1_BOUNDARY_CASES.some((id) => !ids.includes(id))) {
    add("boundary-case-inventory", "probe.cases", "the ten required unique binary16 and fail-closed cases must be present exactly once");
  }
  for (const item of probe.cases) {
    const prefix = `probe.cases.${item.id}`;
    if (item.inputSourceRgba.length !== 4
        || item.inputSourceRgba.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
      add("boundary-source-input", `${prefix}.inputSourceRgba`, "the actual finite RGBA8 source texel must be retained for independent fallback comparison");
      continue;
    }
    const expectedHalfBits = (value: number): number => Number.isNaN(value) ? 0x7e00
      : value === Number.POSITIVE_INFINITY ? 0x7c00
        : value === Number.NEGATIVE_INFINITY ? 0xfc00
          : value > 65504 ? 0x7bff
            : value < -65504 ? 0xfbff
              : DataUtils.toHalfFloat(value);
    const storedBits = item.storedPhysicalHalfBits[0];
    const expectedBits = expectedHalfBits(item.inputSignedCocMm);
    if (storedBits !== expectedBits) add("physical-half-storage", `${prefix}.storedPhysicalHalfBits`, "stored binary16 bits do not match Three.js conversion and overflow handling");
    const decodedPhysical = DataUtils.fromHalfFloat(storedBits);
    const storedPhysical = item.storedPhysicalRgba[0];
    if (!(Number.isNaN(decodedPhysical) && Number.isNaN(storedPhysical))
        && decodedPhysical !== storedPhysical) {
      add("physical-half-decode", `${prefix}.storedPhysicalRgba`, "decoded physical storage disagrees with observed binary16 bits");
    }
    const decodedGather = item.storedGatherHalfBits.map((bits) => DataUtils.fromHalfFloat(bits));
    if (decodedGather.some((value, channel) => !(Number.isNaN(value) && Number.isNaN(item.storedGatherRgba[channel])) && value !== item.storedGatherRgba[channel])) {
      add("gather-half-decode", `${prefix}.storedGatherRgba`, "decoded Far storage disagrees with observed binary16 bits");
    }
    if (item.storedGatherHalfBits.some((bits, channel) => bits !== expectedHalfBits(item.inputFarRgba[channel]))) {
      add("gather-half-storage", `${prefix}.storedGatherHalfBits`, "Far storage bits do not match the controlled native RGBA16F input");
    }
    const cpu = reconstructGroundGlassB1Reference({
      source: { widthPx: 1, heightPx: 1 },
      gather: { widthPx: 1, heightPx: 1 },
      sourceRgba: Float32Array.from(item.inputSourceRgba),
      gatherFarRgba: Float32Array.from(item.storedGatherRgba),
      physicalRgba: Float32Array.from(item.storedPhysicalRgba),
      validity: Uint8Array.of(item.inputValidityCode),
      observedSelectedGatherIds: new Int32Array([0, 0]),
      observedSelectedCenterSourceIds: new Int32Array([0, 0]),
      observedGatherCenterSourceIds: new Int32Array([0, 0]),
    });
    const decodedB1 = item.gpuB1HalfBits.map((bits) => DataUtils.fromHalfFloat(bits));
    if (decodedB1.some((value, channel) => !(Number.isNaN(value) && Number.isNaN(item.gpuB1Rgba[channel])) && value !== item.gpuB1Rgba[channel])) {
      add("b1-half-decode", `${prefix}.gpuB1Rgba`, "decoded B1 storage disagrees with observed binary16 bits");
    }
    const expectedReasonByCase: Readonly<Record<string, number>> = {
      "physical-positive-half-maximum-and-gather-rgba-maximum": 0,
      "physical-negative-half-maximum-is-near-side": 4,
      "physical-largest-half-value-below-maximum": 0,
      "m4-unrepresentable-overflow-preserves-validity-code-two": 3,
      "physical-nan": 3,
      "physical-positive-infinity": 3,
      "physical-negative-infinity": 3,
      "m4-validity-code-two-remains-authoritative": 3,
      "far-gather-nan-channel-fails-closed": 5,
      "far-gather-infinity-channel-fails-closed": 5,
    };
    const expectedEligible = expectedReasonByCase[item.id] === 0 ? 1 : 0;
    const expectedPath = expectedEligible ? 1 : 0;
    if (item.cpuFallbackReason !== cpu.fallbackReason[0]
        || item.cpuEligible !== cpu.eligible[0] || item.cpuSelectedPath !== cpu.selectedPath[0]
        || item.cpuFallbackReason !== expectedReasonByCase[item.id]
        || item.cpuEligible !== expectedEligible || item.cpuSelectedPath !== expectedPath) {
      add("boundary-cpu-classification", `${prefix}.cpuFallbackReason`, "CPU oracle did not preserve the required overflow/sign/non-finite decision");
    }
    if (item.gpuDecisionRgba8[0] !== cpu.eligible[0]
        || item.gpuDecisionRgba8[1] !== cpu.fallbackReason[0]
        || item.gpuDecisionRgba8[2] !== cpu.selectedPath[0]) {
      add("boundary-gpu-classification", `${prefix}.gpuDecisionRgba8`, "GPU decision differs from the independent CPU B1 result");
    }
    const actualError = Math.max(...item.gpuB1Rgba.map((value, channel) => Math.abs(value - cpu.farRgba[channel])));
    const storedB1Error = Math.max(...item.gpuB1Rgba.map((value, channel) =>
      Math.abs(value - DataUtils.fromHalfFloat(item.gpuB1HalfBits[channel])),
    ));
    if (!Number.isFinite(item.gpuCpuMaximumError) || item.gpuCpuMaximumError > 0.001
        || Math.abs(actualError - item.gpuCpuMaximumError) > 0.00001
        || actualError > 0.001 || storedB1Error !== 0) {
      add("boundary-output-comparison", `${prefix}.gpuCpuMaximumError`, "stored B1 output exceeds or misreports the native GPU/CPU maximum error");
    }
    if (item.id === "m4-unrepresentable-overflow-preserves-validity-code-two" && item.inputValidityCode !== 2) {
      add("overflow-validity-code", `${prefix}.inputValidityCode`, "unrepresentable M4 overflow must preserve validity code 2");
    }
    if (item.id === "m4-validity-code-two-remains-authoritative" && item.inputValidityCode !== 2) {
      add("overflow-validity-code", `${prefix}.inputValidityCode`, "B1 must treat M4 validity code 2 as authoritative");
    }
  }
  return { status: issues.length === 0 ? "passed" : "failed", issues, observedCaseIds: ids };
};

/** Re-evaluate the frozen Q1-Q7 decisions from revision-specific M5 captures. */
export const evaluateGroundGlassM7eQuality = (
  matrices: readonly GroundGlassM7eQualityMatrix[],
): GroundGlassM7eQualityEvaluation => {
  const issues: string[] = [];
  const byRole = new Map<GroundGlassM7eQualityMatrixRole, GroundGlassM7eQualityMatrix>();
  for (const matrix of matrices) {
    if (byRole.has(matrix.role)) issues.push(`duplicate quality matrix role: ${matrix.role}`);
    byRole.set(matrix.role, matrix);
  }
  const requiredRoles: readonly GroundGlassM7eQualityMatrixRole[] = ["q1-control", "q5-stress", "q2-q7", "q3-q4"];
  for (const role of requiredRoles) if (!byRole.has(role)) issues.push(`missing quality matrix role: ${role}`);
  const r3Thresholds: GroundGlassApertureGatherR3Thresholds = GROUND_GLASS_M7E_R187_THRESHOLDS;
  const m5qThresholds: GroundGlassM5qFrozenThresholds = GROUND_GLASS_M7E_R187_THRESHOLDS;
  const evaluatedR3: Partial<Record<GroundGlassM7eQualityMatrixRole, GroundGlassApertureGatherR3Evaluation>> = {};
  const dimensions = {} as Record<GroundGlassM5qDimensionId, GroundGlassM5qDimensionDecision>;
  const source = (role: GroundGlassM7eQualityMatrixRole): GroundGlassM7eQualityMatrix | undefined => byRole.get(role);
  for (const role of requiredRoles) {
    const matrix = source(role);
    if (!matrix) continue;
    if (matrix.context.runtime.rendererRevision !== "r187"
        || matrix.context.runtime.actualExecutionApi !== "webgpu"
        || matrix.context.runtime.rendererFamily !== "webgpu-renderer"
        || matrix.context.runtime.internalFallback !== "none"
        || matrix.context.runtime.applicationFallback !== false
        || matrix.context.sceneId !== GROUND_GLASS_M7E_SCENE_ID
        || matrix.context.sceneSourceRevision !== GROUND_GLASS_M7E_SCENE_SOURCE_REVISION) {
      issues.push(`${role}: runtime or scene provenance is not native r187 Architecture Rise evidence`);
    }
    const captures: GroundGlassApertureGatherR3CaptureMatrix = matrix.captures;
    const recomputed = evaluateGroundGlassApertureGatherR3(captures, r3Thresholds);
    evaluatedR3[role] = recomputed;
    if (recomputed.provenance.status !== matrix.r3.provenance.status
        || recomputed.referenceConvergence.status !== matrix.r3.referenceConvergence.status
        || recomputed.captureIds.half32 !== matrix.r3.captureIds.half32
        || recomputed.captureIds.full32 !== matrix.r3.captureIds.full32
        || recomputed.captureIds.full64 !== matrix.r3.captureIds.full64) {
      issues.push(`${role}: stored R3 summary disagrees with recomputed captures`);
    }
    if (recomputed.provenance.status !== "matched") issues.push(`${role}: R3 capture provenance is not matched`);
    if (matrix.r3.provenance.status !== "matched") issues.push(`${role}: supplied R3 provenance is not matched`);
  }
  const dimensionRole: Readonly<Record<GroundGlassM5qDimensionId, GroundGlassM7eQualityMatrixRole>> = {
    Q1: "q1-control", Q2: "q2-q7", Q3: "q3-q4", Q4: "q3-q4", Q5: "q5-stress", Q6: "q1-control", Q7: "q2-q7",
  };
  for (const dimension of Object.keys(dimensionRole) as GroundGlassM5qDimensionId[]) {
    const role = dimensionRole[dimension];
    const matrix = source(role);
    const r3 = evaluatedR3[role];
    if (!matrix || !r3) continue;
    const qualification = evaluateGroundGlassM5qDimensions({
      context: matrix.context,
      r3,
      thresholds: m5qThresholds,
      ...(dimension === "Q5" && matrix.pairedCapEvidence ? { pairedCapEvidence: matrix.pairedCapEvidence } : {}),
    });
    dimensions[dimension] = qualification.dimensions[dimension];
    if (qualification.dimensions[dimension].status === "invalid-comparison") issues.push(`${dimension}: invalid-comparison`);
  }
  const complete = (Object.keys(dimensionRole) as GroundGlassM5qDimensionId[]).every((dimension) => dimensions[dimension] !== undefined);
  const passed = complete && Object.values(dimensions).every((dimension) => dimension.status === "bounded-qualified");
  const hasAnyQualified = Object.values(dimensions).some((dimension) => dimension.status === "bounded-qualified");
  return {
    status: passed ? "research-qualified" : hasAnyQualified ? "partially-qualified" : "not-qualified",
    dimensions: dimensions as Readonly<Record<GroundGlassM5qDimensionId, GroundGlassM5qDimensionDecision>>,
    matrixEvaluations: evaluatedR3 as Readonly<Record<GroundGlassM7eQualityMatrixRole, GroundGlassApertureGatherR3Evaluation>>,
    issues,
  };
};

/** Validate declared evidence counts and keep research status from becoming policy authority. */
export const validateGroundGlassM7eReportInventory = (
  report: GroundGlassM7eReportInventory,
): readonly GroundGlassM7eReportIssue[] => {
  const issues: GroundGlassM7eReportIssue[] = [];
  const add = (code: string, field: string, detail: string): void => { issues.push({ code, field, detail }); };
  if (report.schemaVersion !== 1 || report.reportId !== "ground-glass-m7e-r187-gather-b1") add("report-identity", "reportId", "report identity or schema version is unsupported");
  if (report.evaluatorRevision !== GROUND_GLASS_M7E_EVALUATOR_REVISION) add("evaluator-revision", "evaluatorRevision", "report evaluator revision does not match this evaluator");
  if (!/^[0-9a-f]{40}$/i.test(report.sourceCommitSha)) add("source-provenance", "sourceCommitSha", "report source commit must be a full SHA");
  if (report.runtime.rendererRevision !== "r187" || report.runtime.rendererFamily !== "webgpu-renderer"
      || report.runtime.actualExecutionApi !== "webgpu" || report.runtime.internalFallback !== "none"
      || report.runtime.applicationFallback !== false || report.runtime.nativeRequired !== true) {
    add("runtime-identity", "runtime", "report runtime is not actual native WebGPU on Three.js r187");
  }
  const actual = { passed: 0, failed: 0, blocked: 0, "not-run": 0 };
  const ids = new Set<string>();
  const captureIds = new Set<string>();
  if (report.scenarios.length !== GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.length
      || GROUND_GLASS_M7E_REQUIRED_NATIVE_SCENARIO_IDS.some((id) => !report.scenarios.some((scenario) => scenario.id === id))) {
    add("required-scenario-inventory", "scenarios", "all twelve predeclared Q1-Q7 role/profile captures must be inventoried exactly once");
  }
  for (const scenario of report.scenarios) {
    if (ids.has(scenario.id)) add("duplicate-scenario", "scenarios", `scenario identity is duplicated: ${scenario.id}`);
    ids.add(scenario.id);
    actual[scenario.status] += 1;
    if (scenario.status === "passed") {
      if (!scenario.capture) add("missing-capture-provenance", `scenarios.${scenario.id}`, "a passed scenario must include its native capture envelope");
      else {
        if (scenario.capture.scenarioId !== scenario.id) add("scenario-capture-identity", `scenarios.${scenario.id}.capture.scenarioId`, "scenario and capture identities must match");
        const expectedQualityMode = scenario.id.endsWith("-half32") ? "half32"
          : scenario.id.endsWith("-full32") ? "full32"
            : scenario.id.endsWith("-full64") ? "full64" : null;
        const expectedRadiusCapPx = scenario.id.startsWith("q5-stress-cap2-") ? 2 : 60;
        if (scenario.capture.capture.qualityMode !== expectedQualityMode
            || scenario.capture.capture.maximumRadiusPx !== expectedRadiusCapPx) {
          add("scenario-profile-mismatch", `scenarios.${scenario.id}.capture.capture`, "quality profile and radius cap must match the declared M5Q matrix role");
        }
        if (scenario.capture.sourceCommitSha !== report.sourceCommitSha) add("capture-source-revision", `scenarios.${scenario.id}.capture.sourceCommitSha`, "capture source SHA must match the report source SHA");
        if (scenario.capture.runtime.rendererRevision !== report.runtime.rendererRevision
            || scenario.capture.runtime.rendererFamily !== report.runtime.rendererFamily
            || scenario.capture.runtime.actualExecutionApi !== report.runtime.actualExecutionApi
            || scenario.capture.runtime.browserVersion !== report.runtime.browserVersion
            || scenario.capture.runtime.operatingSystem !== report.runtime.operatingSystem
            || scenario.capture.runtime.nodeVersion !== report.runtime.nodeVersion) {
          add("capture-runtime-identity", `scenarios.${scenario.id}.capture.runtime`, "capture runtime identity must match the report runtime");
        }
        const captureId = scenario.capture.capture.captureId;
        if (captureIds.has(captureId)) add("duplicate-capture", `scenarios.${scenario.id}.capture.capture.captureId`, `capture identity is duplicated: ${captureId}`);
        captureIds.add(captureId);
        const evaluation = evaluateGroundGlassM7eNativeCapture(scenario.capture);
        if (evaluation.status !== "passed") add("invalid-passed-capture", `scenarios.${scenario.id}`, evaluation.issues.map((issue) => issue.code).join(", "));
      }
    }
  }
  for (const status of ["passed", "failed", "blocked", "not-run"] as const) {
    if (report.declaredCounts[status] !== actual[status]) add("scenario-count-mismatch", `declaredCounts.${status}`, `declared ${report.declaredCounts[status]}, observed ${actual[status]}`);
  }
  if (!report.b1BoundaryProbe) add("missing-b1-boundary-probe", "b1BoundaryProbe", "native M5 qualification requires the actual binary16/B1 boundary probe");
  else {
    const boundary = evaluateGroundGlassM7eB1BoundaryProbe(report.b1BoundaryProbe);
    if (boundary.status !== "passed") add("invalid-b1-boundary-probe", "b1BoundaryProbe", boundary.issues.map((issue) => issue.code).join(", "));
  }
  if (report.m3RendererSelectionAuthority !== "m3-raw-pilot" || report.m5RendererAttemptAuthorized !== false) {
    add("m5-authorization-boundary", "m5RendererAttemptAuthorized", "M5 research evidence must not authorize an M3 renderer attempt");
  }
  if (report.m5GatherEvidenceStatus !== "research-only" || report.m5B1EvidenceStatus !== "research-only") {
    add("research-only-status", "m5GatherEvidenceStatus", "r187 M5 evidence remains research-only");
  }
  if (report.m6R187Authorized !== false) add("m6-authorization-boundary", "m6R187Authorized", "M7E does not authorize r187 M6");
  if (report.productionWebGpuEnabled !== false) add("production-boundary", "productionWebGpuEnabled", "production Ground Glass remains WebGL only");
  return issues;
};
