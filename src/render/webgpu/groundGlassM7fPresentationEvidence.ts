import {
  evaluateGroundGlassM6bCaptureSpatialConformance,
  GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS,
  evaluateGroundGlassM6bSpatialConformance,
} from "../groundGlassM6bSpatialConformance";
import {
  GROUND_GLASS_M6C_ALPHA_GATE_REVISION,
  evaluateGroundGlassM6cAlphaConformance,
} from "../groundGlassM6cAlphaConformance";
import {
  fingerprintGroundGlassM6bPresentationState,
  GROUND_GLASS_M6C_ALPHA_MATRIX,
} from "../groundGlassPhysicalOverlayConformance";
import {
  encodeGroundGlassLinearChannelToSrgb,
  evaluateGroundGlassPresentationReference,
  type GroundGlassPresentationRgba,
} from "./groundGlassPresentationReference";
import type { GroundGlassM6cReadbackIdentity } from "../groundGlassM6cAlphaConformance";
import type { GroundGlassPresentationNodeState } from "./groundGlassPresentationNodes";
import { ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION } from "./groundGlassRawWebGpuCompatibility";

export const GROUND_GLASS_M7F_EVALUATOR_REVISION = "m7f-r187-presentation-evaluator-v1";
export const GROUND_GLASS_M7F_REPORT_ID = "ground-glass-m7f-r187-presentation";
export const GROUND_GLASS_M7F_PRESENTATION_EVIDENCE_REVISION =
  "m6-architecture-rise-native-presentation-r187-v1";

export const GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS = Object.freeze([
  "m5-m6-source-contract",
  "m6d-opaque-composite",
  "m6b-spatial-fixture",
  "m6b-final-rgb",
  "m6c-opaque-target-alpha",
  "registered-architecture-rise-m3-m6",
  "raw-first-resource-provisioning",
  "optical-resource-initialization-failure",
  "presentation-node-initialization-failure",
  "presentation-pass-failure",
  "final-display-failure",
  "presentation-stale-resize",
  "m6c-stale-request-readback",
  "m6c-retired-generation-readback",
  "unsupported-scene-denied",
  "production-webgl-isolation",
] as const);

export type GroundGlassM7fScenarioStatus = "passed" | "failed" | "blocked" | "not-run";
export type GroundGlassM7fDecision = "passed" | "failed" | "blocked" | "not-run";

export type GroundGlassM7fScenario = Readonly<{
  id: typeof GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS[number];
  status: GroundGlassM7fScenarioStatus;
  sourceCommitSha: string | null;
  testInvocation: string | null;
  rendererRevision: string | null;
  runtimeIdentity: Readonly<Record<string, unknown>> | null;
  supportingArtifacts: readonly string[];
  orderedEvents: readonly unknown[];
  limitations: readonly string[];
  issues: readonly string[];
}>;

export type GroundGlassM7fPresentationEvaluation = Readonly<{
  schemaVersion: 1;
  reportId: typeof GROUND_GLASS_M7F_REPORT_ID;
  evaluatorRevision: typeof GROUND_GLASS_M7F_EVALUATOR_REVISION;
  sourceCommitSha: string | null;
  declaredCounts: Readonly<Record<GroundGlassM7fScenarioStatus, number>>;
  computedCounts: Readonly<Record<GroundGlassM7fScenarioStatus, number>>;
  scenarios: readonly GroundGlassM7fScenario[];
  decisions: Readonly<{
    implementationConformance: GroundGlassM7fDecision;
    spatialConformance: GroundGlassM7fDecision;
    finalRgbConformance: GroundGlassM7fDecision;
    opaqueAlphaConformance: GroundGlassM7fDecision;
    lifecycleConformance: GroundGlassM7fDecision;
    productionIsolation: GroundGlassM7fDecision;
    photographicQuality: "unqualified";
    m5qChanged: false;
    m6DevelopmentAuthorization: boolean;
    productionWebGpuEnabled: false;
    m8M9Authorized: false;
  }>;
  inventoryConsistent: boolean;
}>;

export type GroundGlassM7fPresentationEvidenceBundle = Readonly<{
  schemaVersion: number;
  reportId: string;
  evaluatorRevision: string;
  sourceCommitSha: string;
  testInvocation: string;
  authorization: unknown;
  m6dComposite: unknown;
  m6bConformance: unknown;
  m6cAlpha: unknown;
  registeredApp: unknown;
  lifecycle: Readonly<Record<string, unknown>>;
  productionIsolation: unknown;
  declaredCounts?: Readonly<Record<string, number>>;
}>;

type JsonRecord = Record<string, unknown>;
const asRecord = (value: unknown): JsonRecord | null =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as JsonRecord : null;
const asArray = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const close = (left: number, right: number, tolerance = 1e-8): boolean =>
  Math.abs(left - right) <= tolerance * Math.max(1, Math.abs(left), Math.abs(right));
const equalJson = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const validSha = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{40}$/i.test(value);
const stringArray = (value: unknown): readonly string[] => asArray(value).filter((item): item is string => typeof item === "string");
const countByStatus = (scenarios: readonly GroundGlassM7fScenario[]) => ({
  passed: scenarios.filter(({ status }) => status === "passed").length,
  failed: scenarios.filter(({ status }) => status === "failed").length,
  blocked: scenarios.filter(({ status }) => status === "blocked").length,
  "not-run": scenarios.filter(({ status }) => status === "not-run").length,
});

const provenanceIssues = (artifact: JsonRecord | null, nativeRequired: boolean): string[] => {
  const issues: string[] = [];
  if (!artifact) return ["artifact-invalid"];
  const provenance = asRecord(artifact.captureProvenance ?? artifact.sourceProvenance);
  if (!provenance) return ["capture-provenance-missing"];
  if (!validSha(provenance.sourceCommitSha ?? artifact.sourceCommit ?? artifact.captureSourceSha)) {
    issues.push("capture-source-sha-invalid");
  }
  if (!text(provenance.testInvocation ?? artifact.testInvocation ?? artifact.invocation)) issues.push("test-invocation-missing");
  if (!text(provenance.threePackageVersion) || provenance.threePackageVersion !== "0.187.0") {
    issues.push("three-package-version-mismatch");
  }
  if (provenance.rendererRevision !== "r187" && provenance.rendererRevision !== "187") {
    issues.push("renderer-revision-mismatch");
  }
  if (!text(provenance.nodeVersion) || !text(provenance.operatingSystem)) issues.push("runtime-environment-provenance-missing");
  if (nativeRequired && provenance.browserProject !== "chrome-native-webgpu") issues.push("native-project-provenance-missing");
  if (nativeRequired && (
    provenance.rendererFamily !== "webgpu-renderer" ||
    provenance.actualExecutionApi !== "webgpu" ||
    provenance.internalFallback !== "none"
  )) issues.push("native-runtime-provenance-invalid");
  return issues;
};

const nativeRuntimeIssues = (runtime: unknown): string[] => {
  const record = asRecord(runtime);
  if (!record) return ["runtime-identity-missing"];
  const revision = record.rendererRevision;
  return [
    ...(revision === "r187" || revision === "187" ? [] : ["renderer-revision-mismatch"]),
    ...(record.rendererFamily === "webgpu-renderer" ? [] : ["renderer-family-not-webgpu"]),
    ...(record.actualExecutionApi === "webgpu" || record.executionApi === "webgpu" ? [] : ["execution-api-not-native-webgpu"]),
    ...(record.internalFallback === "none" ? [] : ["renderer-internal-fallback-present"]),
  ];
};

const acceptedFrameIssues = (
  eventValue: unknown,
  identity: Readonly<{ requestId: unknown; channelId: unknown; sceneId: unknown; generationId: unknown }>,
  prefix: string,
): string[] => {
  if (!text(identity.requestId) || !text(identity.channelId) || !text(identity.sceneId) || !text(identity.generationId)) {
    return [`${prefix}-request-generation-identity-missing`];
  }
  const matching = asArray(eventValue).map(asRecord).filter((event): event is JsonRecord =>
    event !== null && event.kind === "host-frame-result" && event.requestId === identity.requestId &&
    event.channelId === identity.channelId && event.sceneId === identity.sceneId &&
    event.generationId === identity.generationId,
  );
  if (!matching.some((event) => event.frameStatus === "completed" && event.acceptedByHost === true &&
      event.latestAcceptedRequestId === identity.requestId && event.latestAcceptedSceneId === identity.sceneId &&
      event.activeGenerationId === identity.generationId && event.activeRendererFamily === "webgpu-renderer")) {
    return [`${prefix}-no-host-accepted-current-frame-result`];
  }
  return [];
};

const nativeRuntimeEventIssues = (
  eventValue: unknown,
  identity: Readonly<{ attemptId: unknown; generationId: unknown; requestId: unknown; channelId: unknown; sceneId: unknown }>,
  prefix: string,
): string[] => {
  if (!text(identity.generationId) || !text(identity.requestId) ||
      !text(identity.channelId) || !text(identity.sceneId)) return [`${prefix}-native-event-identity-missing`];
  const events = asArray(eventValue).map(asRecord).filter((event): event is JsonRecord => event !== null);
  const runtime = events.find((event) => event.kind === "runtime-observed" &&
    (!text(identity.attemptId) || event.attemptId === identity.attemptId) && event.generationId === identity.generationId);
  const mounted = events.find((event) => event.kind === "renderer-mounted" &&
    event.generationId === identity.generationId && (!runtime || event.attemptId === runtime.attemptId) &&
    event.requestId === identity.requestId && event.channelId === identity.channelId && event.sceneId === identity.sceneId);
  const issues: string[] = [];
  if (!runtime || !text(runtime.attemptId) || runtime.rendererRevision !== "r187" || runtime.rendererFamily !== "webgpu-renderer" ||
      runtime.executionApi !== "webgpu" || runtime.internalFallback !== "none") {
    issues.push(`${prefix}-native-runtime-event-invalid`);
  }
  if (!mounted || mounted.rendererFamily !== "webgpu-renderer" || mounted.executionApi !== "webgpu" ||
      mounted.internalFallback !== "none") issues.push(`${prefix}-native-mounted-renderer-event-invalid`);
  return issues;
};

const m6dIssues = (artifact: JsonRecord | null): string[] => {
  if (!artifact) return ["m6d-capture-missing"];
  const issues = provenanceIssues(artifact, true);
  const registered = asRecord(artifact.registeredM5Capture);
  const probe = asRecord(artifact.controlledCompositeProbe);
  if (!registered || !probe) return [...issues, "m6d-capture-shape-invalid"];
  if (registered.sceneId !== "architecture-rise" ||
      registered.rendererFamily !== "webgpu-renderer" ||
      registered.actualExecutionApi !== "webgpu" ||
      registered.internalFallback !== "none" ||
      registered.sourceRevision !== ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION ||
      registered.compositeTargetFormat !== "rgba16float" ||
      !stringArray(registered.completedPasses).includes("researchComposite")) {
    issues.push("registered-m5-composite-identity-invalid");
  }
  if (probe.contractRevision !== "m6d-opaque-presentation-v1") issues.push("m6d-contract-revision-invalid");
  issues.push(...nativeRuntimeIssues(probe));
  if (probe.applicationFallback !== false) issues.push("application-fallback-observed");
  if (probe.requestId !== registered.requestId || probe.channelId !== registered.channelId ||
      probe.sceneId !== registered.sceneId || probe.rendererGenerationId !== registered.rendererGenerationId) {
    issues.push("m6d-request-generation-mismatch");
  }
  issues.push(...acceptedFrameIssues(artifact.adapterEvents, {
    requestId: probe.requestId,
    channelId: probe.channelId,
    sceneId: probe.sceneId,
    generationId: probe.rendererGenerationId,
  }, "m6d"));
  issues.push(...nativeRuntimeEventIssues(artifact.adapterEvents, {
    attemptId: null,
    requestId: probe.requestId,
    channelId: probe.channelId,
    sceneId: probe.sceneId,
    generationId: probe.rendererGenerationId,
  }, "m6d"));
  const formats = [probe.sourceTextureFormat, probe.nearTextureFormat, probe.targetFormat];
  if (formats.some((format) => format !== "rgba16float")) issues.push("m6d-rgba16f-storage-invalid");
  const sourceIdentity = asRecord(probe.sourceTextureIdentity);
  const targetIdentity = asRecord(probe.targetIdentity);
  if (!sourceIdentity || !text(sourceIdentity.farUuid) || !text(sourceIdentity.nearUuid) ||
      sourceIdentity.farUuid === sourceIdentity.nearUuid || !targetIdentity || !text(targetIdentity.uuid) ||
      targetIdentity.uuid === sourceIdentity.farUuid || targetIdentity.uuid === sourceIdentity.nearUuid ||
      targetIdentity.widthPx !== 5 || targetIdentity.heightPx !== 1 || probe.targetAllocationObserved !== true) {
    issues.push("m6d-target-ownership-or-allocation-invalid");
  }
  if (probe.targetColorSpace !== "no-color-space" || probe.rendererStateRestored !== true ||
      probe.temporaryResourcesDisposed !== true) issues.push("m6d-lifecycle-contract-invalid");

  const coverages = [0, 0.25, 0.5, 0.75, 1] as const;
  const cases = asArray(probe.cases).map(asRecord);
  if (cases.length !== coverages.length) issues.push("m6d-case-count-invalid");
  for (const [index, coverage] of coverages.entries()) {
    const sample = cases[index];
    if (!sample || sample.id !== `near-coverage-${coverage}` || sample.coverage !== coverage) {
      issues.push(`m6d-coverage-case-${coverage}-missing-or-duplicate`);
      continue;
    }
    const far = asArray(sample.farRgba);
    const near = asArray(sample.nearRgba);
    const measured = asArray(sample.measuredCompositeRgba);
    if (far.length !== 4 || near.length !== 4 || measured.length !== 4 ||
        [...far, ...near, ...measured].some((value) => !finite(value))) {
      issues.push(`m6d-coverage-case-${coverage}-values-invalid`);
      continue;
    }
    const clamped = Math.max(0, Math.min(1, coverage));
    const expected = [0, 1, 2].map((channel) =>
      Number(far[channel]) * (1 - clamped) + Number(near[channel]) * clamped,
    );
    if (expected.some((value, channel) => !close(Number(measured[channel]), value, 0.001))) {
      issues.push(`m6d-coverage-case-${coverage}-composite-rgb-invalid`);
    }
    if (!close(Number(measured[3]), 1, 0.001)) issues.push(`m6d-coverage-case-${coverage}-opaque-alpha-invalid`);
  }
  return issues;
};

const sourceCropIssues = (m6b: JsonRecord, pixelCases: readonly JsonRecord[]): string[] => {
  const issues: string[] = [];
  const captures = asArray(m6b.captures).map(asRecord).filter((item): item is JsonRecord => item !== null);
  for (const pixelCase of pixelCases) {
    const capture = captures.find((item) => item.captureId === pixelCase.captureId);
    if (capture && !equalJson(pixelCase.sourceCrop, capture.crop)) {
      issues.push(`rgb-crop-does-not-match-spatial-capture:${String(pixelCase.captureId)}`);
    }
    const crop = asRecord(pixelCase.sourceCrop);
    if (!crop || typeof crop.active !== "boolean" || !finite(crop.centerU) || !finite(crop.centerV) ||
        !finite(crop.widthFraction) || !finite(crop.heightFraction)) {
      issues.push(`rgb-source-crop-invalid:${String(pixelCase.captureId)}`);
    }
  }
  return issues;
};

const m6bSpatialIssues = (artifact: JsonRecord | null): string[] => {
  if (!artifact) return ["m6b-spatial-capture-missing"];
  const issues = provenanceIssues(artifact, true);
  const runtime = asRecord(artifact.nativeRuntime);
  issues.push(...nativeRuntimeIssues(runtime));
  if (artifact.spatialGateRevision !== "m6b-spatial-gate-r1") issues.push("spatial-gate-revision-invalid");
  if (artifact.fixtureRevision !== "m6b-physical-overlay-v1") issues.push("spatial-fixture-revision-invalid");
  const evidenceScopes = asRecord(artifact.evidenceScopes);
  if (evidenceScopes?.controlledFixture !== "measured" ||
      evidenceScopes.registeredArchitectureRise !==
        "separately covered by native M6 registered-app integration capture; not combined with fixture pixels") {
    issues.push("spatial-fixture-scope-misrepresented");
  }
  const inputs = asArray(artifact.spatialConformanceInputs);
  const inputRecords = inputs.map(asRecord).filter((item): item is JsonRecord => item !== null);
  const loupeCaptureIds = new Set([
    "m6b-loupe-centered", "m6b-loupe-horizontal-pan", "m6b-loupe-vertical-pan", "m6b-loupe-diagonal-pan",
    "m6b-loupe-left-limit", "m6b-loupe-right-limit", "m6b-loupe-top-limit", "m6b-loupe-bottom-limit",
    "m6b-upright-cropped-loupe",
  ]);
  const uprightCaptureIds = new Set(["m6b-upright-full-film", "m6b-upright-cropped-loupe"]);
  const stateSpecificAssertionsPassed = inputRecords.length === GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS.length &&
    inputRecords.every((capture, index) => {
      const id = String(capture.captureId);
      const isLoupe = loupeCaptureIds.has(id);
      const replay = evaluateGroundGlassM6bCaptureSpatialConformance(
        capture as unknown as Parameters<typeof evaluateGroundGlassM6bCaptureSpatialConformance>[0],
      );
      return id === GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS[index] && capture.captureName === id &&
        capture.previewMode === (uprightCaptureIds.has(id) ? "upright" : "raw") &&
        capture.focusLoupeActive === isLoupe && asRecord(capture.crop)?.active === isLoupe &&
        replay.classification === "passed";
    });
  if (!stateSpecificAssertionsPassed) issues.push("spatial-state-transitions-not-replayed");
  const result = evaluateGroundGlassM6bSpatialConformance({
    captures: inputRecords as unknown as Parameters<typeof evaluateGroundGlassM6bSpatialConformance>[0]["captures"],
    stateSpecificAssertionsPassed,
  });
  if (!result.allRequiredCaptureIdsPresentExactlyOnce) issues.push("spatial-capture-inventory-invalid");
  if (!result.physicalOverlayConformant) issues.push("spatial-per-capture-threshold-or-landmark-gate-failed");
  if (result.perCaptureClassifications.some((capture) => capture.maximumErrorPx === null || capture.rmsErrorPx === null ||
      capture.maximumErrorPx > 2 || capture.rmsErrorPx > 1.25)) issues.push("spatial-per-capture-error-exceeds-frozen-limit");
  const captureIds = inputs.map((item) => asRecord(item)?.captureId);
  if (captureIds.length !== GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS.length ||
      new Set(captureIds).size !== captureIds.length) issues.push("spatial-capture-identity-duplicate-or-missing");
  const report = asRecord(artifact.spatialConformance);
  if (!equalJson(report, result)) {
    issues.push("stored-spatial-result-disagrees-with-replay");
  }
  const observedCaptures = asArray(artifact.captures).map(asRecord).filter((item): item is JsonRecord => item !== null);
  if (observedCaptures.length !== GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS.length ||
      GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS.some((id) => observedCaptures.filter((capture) => capture.captureId === id).length !== 1)) {
    issues.push("spatial-observed-capture-inventory-invalid");
  }
  for (const capture of observedCaptures) {
    const input = inputRecords.find((item) => item.captureId === capture.captureId);
    const replay = result.perCaptureClassifications.find((item) => item.captureId === capture.captureId);
    if (!input || !replay || !equalJson(capture.spatialConformanceInput, input) ||
        !equalJson(capture.spatialConformance, replay) || capture.requestId !== input.requestId ||
        capture.channelId !== input.channelId || capture.sceneId !== input.sceneId ||
        capture.rendererGenerationId !== input.rendererGenerationId) {
      issues.push(`spatial-capture-${String(capture.captureId)}-identity-or-replay-mismatch`);
    }
  }
  const resources = asRecord(artifact.resourceAccounting);
  if (resources?.fixtureResourceDisposedAfterRetirement !== true) issues.push("spatial-fixture-resource-retirement-unconfirmed");
  if (!runtime || runtime.sceneId !== "architecture-rise" ||
      runtime.sceneSourceRevision !== "architecture-rise-raw-rtt-v1+m6-presentation-v1" ||
      runtime.applicationFallback !== false) issues.push("spatial-native-scene-identity-invalid");
  for (const capture of observedCaptures) {
    issues.push(...nativeRuntimeEventIssues(artifact.adapterEvents, {
      attemptId: null,
      requestId: capture.requestId,
      channelId: capture.channelId,
      sceneId: capture.sceneId,
      generationId: capture.rendererGenerationId,
    }, `spatial-${String(capture.captureId)}`));
    issues.push(...acceptedFrameIssues(artifact.adapterEvents, {
      requestId: capture.requestId,
      channelId: capture.channelId,
      sceneId: capture.sceneId,
      generationId: capture.rendererGenerationId,
    }, `spatial-${String(capture.captureId)}`));
  }
  return issues;
};

const m6bRgbIssues = (artifact: JsonRecord | null): string[] => {
  if (!artifact) return ["m6b-rgb-capture-missing"];
  const issues = provenanceIssues(artifact, true);
  const cases = asArray(artifact.pixelOracleCases).map(asRecord).filter((item): item is JsonRecord => item !== null);
  const requiredNames = [
    "neutral-raw", "m6b-throughput-half", "m6b-natural-cos4", "m6b-circle-centered",
    "m6b-circle-shifted", "m6b-conic-coverage", "m6b-combined-effects", "loupe-centered-crop",
    "resized-standard-quality",
  ];
  if (cases.length !== 9 || requiredNames.some((name) => cases.filter((item) => item.name === name).length !== 1)) {
    issues.push("rgb-nine-state-inventory-invalid");
  }
  issues.push(...sourceCropIssues(artifact, cases));
  const identityPairs = new Set<string>();
  const allErrors: number[] = [];
  const resourceAccounting = asRecord(artifact.resourceAccounting);
  const sourceFingerprint = resourceAccounting?.fixtureSourceDataFingerprint;
  if (!text(sourceFingerprint)) issues.push("rgb-fixture-source-fingerprint-missing");
  for (const pixelCase of cases) {
    const name = String(pixelCase.name);
    const oracle = asRecord(pixelCase.oracle);
    const state = pixelCase.presentationState as GroundGlassPresentationNodeState | undefined;
    const inputFingerprints = asRecord(pixelCase.inputFingerprints);
    if (!oracle || !state || !inputFingerprints || !text(inputFingerprints.sourceData) || !text(inputFingerprints.presentationState)) {
      issues.push(`rgb-case-inputs-missing:${name}`);
      continue;
    }
    if (pixelCase.sceneId !== "architecture-rise" || !text(pixelCase.requestId) ||
        !text(pixelCase.channelId) || !text(pixelCase.rendererGenerationId)) {
      issues.push(`rgb-current-frame-identity-missing:${name}`);
    } else {
      issues.push(...nativeRuntimeEventIssues(artifact.adapterEvents, {
        attemptId: null,
        requestId: pixelCase.requestId,
        channelId: pixelCase.channelId,
        sceneId: pixelCase.sceneId,
        generationId: pixelCase.rendererGenerationId,
      }, `rgb-${name}`));
      issues.push(...acceptedFrameIssues(artifact.adapterEvents, {
        requestId: pixelCase.requestId,
        channelId: pixelCase.channelId,
        sceneId: pixelCase.sceneId,
        generationId: pixelCase.rendererGenerationId,
      }, `rgb-${name}`));
    }
    if (fingerprintGroundGlassM6bPresentationState(state) !== inputFingerprints.presentationState) {
      issues.push(`rgb-state-fingerprint-mismatch:${name}`);
    }
    if (inputFingerprints.sourceData !== sourceFingerprint) issues.push(`rgb-source-fingerprint-mismatch:${name}`);
    const sourceSampling = oracle.sourceSampling;
    const sourceColorDomain = oracle.sourceColorDomain;
    if (sourceSampling !== "nearest" || sourceColorDomain !== "linear-no-color-space") {
      issues.push(`rgb-source-sampling-or-color-domain-invalid:${name}`);
    }
    const samples = asArray(oracle.samples).map(asRecord).filter((item): item is JsonRecord => item !== null);
    if (samples.length < 14) issues.push(`rgb-sample-inventory-incomplete:${name}`);
    const sampleIds = new Set<string>();
    const stateErrors: number[] = [];
    const outputSize = asRecord(oracle.outputDimensions);
    const sourceSize = asRecord(oracle.sourceDimensions);
    if (!outputSize || !finite(outputSize.widthPx) || !finite(outputSize.heightPx) ||
        !sourceSize || !finite(sourceSize.widthPx) || !finite(sourceSize.heightPx)) {
      issues.push(`rgb-capture-dimensions-invalid:${name}`);
    }
    for (const sample of samples) {
      const id = sample.id;
      if (!text(id) || sampleIds.has(id)) issues.push(`rgb-sample-identity-invalid:${name}`);
      if (text(id)) {
        sampleIds.add(id);
        const pair = `${String(pixelCase.captureId)}:${id}`;
        if (identityPairs.has(pair)) issues.push(`rgb-sample-duplicate:${pair}`);
        identityPairs.add(pair);
      }
      const displayUv = asRecord(sample.displayUvTopOrigin);
      const inputRgba = asArray(sample.inputLinearRgba);
      const measuredRgba = asArray(sample.measuredSrgbRgba);
      if (!displayUv || !finite(displayUv.u) || !finite(displayUv.v) || inputRgba.length !== 4 ||
          inputRgba.some((value) => !finite(value)) || measuredRgba.length !== 4 ||
          measuredRgba.some((value) => !finite(value) || Number(value) < 0 || Number(value) > 255)) {
        issues.push(`rgb-sample-values-invalid:${name}:${String(id)}`);
        continue;
      }
      const reference = evaluateGroundGlassPresentationReference({
        displayUvTopOrigin: { u: Number(displayUv.u), v: Number(displayUv.v) },
        previewMode: state.previewMode,
        filmWindow: state.coverage.filmWindow,
        coverage: state.coverage,
        naturalIllumination: state.naturalIllumination,
        throughputGain: state.throughputGain,
        sampleSource: () => inputRgba as unknown as GroundGlassPresentationRgba,
      });
      const recordedSourceUv = asRecord(sample.sourceUvTopOrigin);
      const recordedFilmPoint = asRecord(sample.physicalFilmPointMm);
      if (!recordedSourceUv || !close(Number(recordedSourceUv.u), reference.sourceUvTopOrigin.u) ||
          !close(Number(recordedSourceUv.v), reference.sourceUvTopOrigin.v)) {
        issues.push(`rgb-orientation-or-crop-origin-invalid:${name}:${String(id)}`);
      }
      if (!recordedFilmPoint || !close(Number(recordedFilmPoint.x), reference.physicalFilmPointMm.x) ||
          !close(Number(recordedFilmPoint.y), reference.physicalFilmPointMm.y)) {
        issues.push(`rgb-physical-coordinate-mapping-invalid:${name}:${String(id)}`);
      }
      const expectedSrgb = reference.outputLinearRgba.slice(0, 3).map((linear) =>
        Math.round(Math.min(1, Math.max(0, encodeGroundGlassLinearChannelToSrgb(linear))) * 255));
      const recordedExpected = asArray(sample.expectedSrgbRgb);
      if (recordedExpected.length !== 3 || expectedSrgb.some((value, channel) => !close(Number(recordedExpected[channel]), value))) {
        issues.push(`rgb-linear-srgb-or-gain-reference-invalid:${name}:${String(id)}`);
      }
      const errors = expectedSrgb.map((value, channel) => Math.abs(value - Number(measuredRgba[channel])));
      stateErrors.push(...errors);
      allErrors.push(...errors);
      const expectedLinear = asArray(sample.expectedOutputLinearRgba);
      if (expectedLinear.length !== 4 || reference.outputLinearRgba.some((value, channel) =>
        !close(Number(expectedLinear[channel]), value))) {
        issues.push(`rgb-linear-output-or-gain-invalid:${name}:${String(id)}`);
      }
      if (measuredRgba[3] !== 255) issues.push(`rgb-visible-canvas-not-opaque:${name}:${String(id)}`);
      const measuredErrors = asArray(sample.absoluteChannelError);
      if (measuredErrors.length !== 3 || errors.some((value, channel) => Number(measuredErrors[channel]) !== value)) {
        issues.push(`rgb-recorded-error-disagrees-with-observation:${name}:${String(id)}`);
      }
    }
    const maxError = Math.max(...stateErrors, Number.NEGATIVE_INFINITY);
    const rmse = stateErrors.length === 0 ? Number.POSITIVE_INFINITY
      : Math.sqrt(stateErrors.reduce((sum, error) => sum + error * error, 0) / stateErrors.length);
    if (maxError > 4) issues.push(`rgb-channel-error-exceeds-frozen-limit:${name}`);
    if (rmse > 2.5) issues.push(`rgb-rmse-exceeds-frozen-limit:${name}`);
    if (Number(oracle.maximumChannelError) !== maxError || !finite(oracle.rgbRmse) || !close(Number(oracle.rgbRmse), rmse)) {
      issues.push(`rgb-state-summary-disagrees-with-replay:${name}`);
    }
  }
  if (identityPairs.size !== 206) issues.push("rgb-total-sample-count-not-206");
  if (allErrors.length === 0 || Math.max(...allErrors) > 4 ||
      Math.sqrt(allErrors.reduce((sum, error) => sum + error * error, 0) / allErrors.length) > 2.5) {
    issues.push("rgb-aggregate-threshold-failed");
  }
  const aggregate = asRecord(artifact.pixelOracleAggregate ?? artifact.pixelOracle);
  const replayMaximum = allErrors.length > 0 ? Math.max(...allErrors) : Number.POSITIVE_INFINITY;
  const replayRmse = allErrors.length > 0
    ? Math.sqrt(allErrors.reduce((sum, error) => sum + error * error, 0) / allErrors.length)
    : Number.POSITIVE_INFINITY;
  if (!aggregate || aggregate.sampleCount !== 206 || Number(aggregate.maximumChannelError) !== replayMaximum || !finite(aggregate.rgbRmse) ||
      !close(Number(aggregate.rgbRmse), replayRmse)) issues.push("rgb-aggregate-summary-disagrees-with-replay");
  return issues;
};

const M6C_CAPTURE_IDS = [
  "m6c-neutral-raw", "m6c-throughput-half", "m6c-throughput-above-one", "m6c-natural-cos4",
  "m6c-circle-centered", "m6c-circle-shifted", "m6c-conic-coverage", "m6c-combined-effects",
  "m6c-upright", "m6c-raw-round-trip", "m6c-loupe-centered", "m6c-loupe-panned", "m6c-resized-target",
] as const;

const m6cIssues = (artifact: JsonRecord | null): string[] => {
  if (!artifact) return ["m6c-alpha-capture-missing"];
  const issues = provenanceIssues(artifact, true);
  if (artifact.evaluatorRevision !== GROUND_GLASS_M6C_ALPHA_GATE_REVISION) issues.push("m6c-evaluator-revision-invalid");
  const captures = asArray(artifact.captures).map(asRecord).filter((item): item is JsonRecord => item !== null);
  if (captures.length !== M6C_CAPTURE_IDS.length || M6C_CAPTURE_IDS.some((id) => captures.filter((item) => item.id === id).length !== 1)) {
    issues.push("m6c-capture-inventory-invalid");
  }
  for (const capture of captures) {
    const readback = asRecord(capture.readback);
    const decision = asRecord(capture.decision);
    const presentation = asRecord(capture.presentationEvidence);
    if (!readback || !decision || !presentation) {
      issues.push(`m6c-capture-shape-invalid:${String(capture.id)}`);
      continue;
    }
    if (readback.status !== "measured" || readback.rendererRevision !== "187" ||
        readback.rendererFamily !== "webgpu-renderer" || readback.actualExecutionApi !== "webgpu" ||
        readback.internalFallback !== "none" || readback.applicationFallback !== false) {
      issues.push(`m6c-runtime-or-status-invalid:${String(capture.id)}`);
    }
    const source = asRecord(readback.source);
    const target = asRecord(readback.target);
    const material = asRecord(readback.material);
    const resourceAccounting = asRecord(readback.resourceAccounting);
    const identity = asRecord(readback.identity) as GroundGlassM6cReadbackIdentity | null;
    if (source?.format !== "rgba32float" || source.colorSpace !== "no-color-space" || source.sampling !== "nearest" ||
        target?.format !== "rgba8unorm" || target.colorSpace !== "no-color-space" || target.channelOrder !== "rgba") {
      issues.push(`m6c-storage-domain-invalid:${String(capture.id)}`);
    }
    if (!material || material.samePresentationMaterialInstance !== true ||
        material.uuid !== presentation.presentationMaterialUuid || material.transparent !== false ||
        material.opacity !== 1 || material.blending !== "normal" || material.alphaTest !== 0 ||
        material.premultipliedAlpha !== false || material.toneMapped !== false ||
        readback.rendererToneMapping !== 0 || readback.rendererOutputColorSpace !== "srgb") {
      issues.push(`m6c-material-equivalence-invalid:${String(capture.id)}`);
    }
    if (!resourceAccounting || resourceAccounting.targetAllocated !== true || resourceAccounting.targetDisposed !== true ||
        resourceAccounting.previousRenderTargetRestored !== true || resourceAccounting.disposalOutcome !== "confirmed" ||
        resourceAccounting.allocationCount !== resourceAccounting.disposalCount) {
      issues.push(`m6c-owned-target-lifecycle-invalid:${String(capture.id)}`);
    }
    if (!identity || identity.requestId !== presentation.requestId || identity.channelId !== presentation.channelId ||
        identity.sceneId !== presentation.sceneId || identity.rendererGenerationId !== presentation.rendererGenerationId ||
        identity.sourceDataFingerprint !== presentation.sourceDataFingerprint ||
        identity.presentationStateFingerprint !== presentation.presentationStateFingerprint) {
      issues.push(`m6c-request-or-generation-stale:${String(capture.id)}`);
    }
    issues.push(...acceptedFrameIssues(artifact.adapterEvents, {
      requestId: presentation.requestId,
      channelId: presentation.channelId,
      sceneId: presentation.sceneId,
      generationId: presentation.rendererGenerationId,
    }, `m6c-${String(capture.id)}`));
    issues.push(...nativeRuntimeEventIssues(artifact.adapterEvents, {
      attemptId: null,
      requestId: presentation.requestId,
      channelId: presentation.channelId,
      sceneId: presentation.sceneId,
      generationId: presentation.rendererGenerationId,
    }, `m6c-${String(capture.id)}`));
    const expected = GROUND_GLASS_M6C_ALPHA_MATRIX.map(({ id }) => id);
    const replay = evaluateGroundGlassM6cAlphaConformance({
      status: readback.status as "measured" | "unsupported" | "failed" | "stale",
      identityCurrent: true,
      expectedSampleIds: expected,
      samples: asArray(readback.samples) as Parameters<typeof evaluateGroundGlassM6cAlphaConformance>[0]["samples"],
      expectedStoredAlpha: () => 1,
    });
    if (replay.alphaDecision !== "alpha-observable-contract-different" ||
        replay.rgbDecision !== "rgb-regression-passed" || replay.maximumAlphaError !== 0 ||
        replay.maximumRgbError === null || replay.maximumRgbError > 4 / 255 ||
        replay.supportedSampleCount !== GROUND_GLASS_M6C_ALPHA_MATRIX.length ||
        replay.unavailableSampleCount !== 0) {
      issues.push(`m6c-opaque-alpha-or-rgb-contract-failed:${String(capture.id)}`);
    }
    if (decision.alphaDecision !== replay.alphaDecision || decision.rgbDecision !== replay.rgbDecision ||
        decision.maximumAlphaError !== replay.maximumAlphaError ||
        decision.maximumSourceAlphaPreservationError !== replay.maximumSourceAlphaPreservationError) {
      issues.push(`m6c-stored-decision-disagrees-with-replay:${String(capture.id)}`);
    }
  }
  const resources = asRecord(artifact.resourceAccounting);
  if (!resources || resources.normalFrameAllocationsBeforeCapture !== 0 ||
      resources.allocations !== M6C_CAPTURE_IDS.length || resources.disposals !== M6C_CAPTURE_IDS.length) {
    issues.push("m6c-resource-accounting-invalid");
  }
  if (asRecord(artifact.visibleCanvas)?.remainsOpaque !== true) issues.push("m6c-visible-canvas-not-opaque");
  return issues;
};

const registeredAppIssues = (artifact: JsonRecord | null): string[] => {
  if (!artifact) return ["registered-m6-app-capture-missing"];
  const issues = provenanceIssues(artifact, true);
  issues.push(...nativeRuntimeIssues(artifact));
  if (artifact.sceneId !== "architecture-rise" ||
      artifact.sceneSourceRevision !== "architecture-rise-raw-rtt-v1+m6-presentation-v1" ||
      artifact.rendererRevision !== "r187" || artifact.rendererFamily !== "webgpu-renderer" ||
      artifact.actualExecutionApi !== "webgpu" || artifact.internalFallback !== "none" ||
      artifact.applicationFallback !== "not-observed" || artifact.presentationStatus !== "completed" ||
      artifact.presentationSource !== "m5-research-composite" || artifact.presentationQuality !== "unqualified") {
    issues.push("registered-m6-presentation-identity-or-status-invalid");
  }
  const optical = asRecord(artifact.opticalReadback);
  const requiredPasses = ["physicalCoC", "farGather", "nearGather", "farReconstructionB1", "researchComposite"];
  if (!optical || optical.exactIdentityMatch !== true ||
      optical.requestId !== artifact.requestId || optical.rendererGenerationId !== artifact.rendererGenerationId ||
      optical.sourceRevision !== ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION ||
      !requiredPasses.every((pass) => stringArray(optical.completedPasses).includes(pass)) ||
      asRecord(optical.targetFormats)?.composite !== "rgba16float") {
    issues.push("registered-m5-composite-incomplete-or-stale");
  }
  if (!text(artifact.requestId) || !text(artifact.rendererGenerationId) ||
      artifact.opticalReadback && asRecord(artifact.opticalReadback)?.requestId !== artifact.requestId) {
    issues.push("registered-m6-current-request-identity-missing");
  }
  const comparisons = asRecord(artifact.comparisons);
  const orientation = asRecord(comparisons?.orientationMetrics);
  if (!orientation || !finite(orientation.correct180DegreeMatchMeanRgbError) ||
      !finite(orientation.horizontalOnlyNegativeControlMeanRgbError) ||
      !finite(orientation.verticalOnlyNegativeControlMeanRgbError) ||
      Number(orientation.correct180DegreeMatchMeanRgbError) + 4 >= Number(orientation.horizontalOnlyNegativeControlMeanRgbError) ||
      Number(orientation.correct180DegreeMatchMeanRgbError) + 4 >= Number(orientation.verticalOnlyNegativeControlMeanRgbError)) {
    issues.push("registered-raw-upright-orientation-not-verified");
  }
  if (artifact.presentationRequestId !== artifact.requestId ||
      artifact.presentationChannelId !== artifact.channelId || artifact.presentationSceneId !== artifact.sceneId ||
      artifact.presentationRendererGenerationId !== artifact.rendererGenerationId) {
    issues.push("registered-presentation-request-generation-mismatch");
  }
  issues.push(...acceptedFrameIssues(artifact.adapterEvents, {
    requestId: artifact.requestId,
    channelId: artifact.channelId,
    sceneId: artifact.sceneId,
    generationId: artifact.rendererGenerationId,
  }, "registered-m6"));
  issues.push(...nativeRuntimeEventIssues(artifact.adapterEvents, {
    attemptId: null,
    requestId: artifact.requestId,
    channelId: artifact.channelId,
    sceneId: artifact.sceneId,
    generationId: artifact.rendererGenerationId,
  }, "registered-m6"));
  const resized = asRecord(artifact.resize);
  if (!resized || !finite(resized.width) || !finite(resized.height) ||
      !finite(resized.targetWidth) || !finite(resized.targetHeight) ||
      Number(resized.width) <= 0 || Number(resized.height) <= 0) issues.push("registered-resize-output-invalid");
  return issues;
};

const lifecycleIssues = (
  id: typeof GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS[number],
  artifact: JsonRecord | undefined,
): string[] => {
  if (!artifact) return ["lifecycle-capture-missing"];
  const issues = provenanceIssues(artifact, false);
  const provenance = asRecord(artifact.captureProvenance ?? artifact.sourceProvenance);
  if (provenance?.browserProject !== "chrome-native-webgpu") issues.push("native-project-provenance-missing");
  if (artifact.scenarioId !== id) issues.push("lifecycle-scenario-identity-mismatch");
  const events = asArray(artifact.events).map(asRecord).filter((item): item is JsonRecord => item !== null);
  if (id === "raw-first-resource-provisioning") {
    const provisioned = asRecord(artifact.provisionedResources);
    const hold = asRecord(artifact.rawToM6QueueHold);
    if (!provisioned || provisioned.sessionStatus !== "ready" || provisioned.physicalResourcesReady !== true ||
        provisioned.gatherResourcesReady !== true || !Array.isArray(provisioned.rawFrameM4Passes) ||
        provisioned.rawFrameM4Passes.length !== 0 || !Array.isArray(provisioned.rawFrameM5Passes) ||
        provisioned.rawFrameM5Passes.length !== 0 || !hold || hold.staleRequestPublished !== false ||
        hold.latestRequestCompleted !== true || !text(artifact.rendererGenerationId) || !text(artifact.pilotSessionId)) {
      issues.push("raw-first-session-provisioning-or-latest-request-invalid");
    }
    const runtime = asRecord(artifact.runtime);
    if (runtime?.actualExecutionApi !== "webgpu" || runtime.rendererFamily !== "webgpu-renderer" ||
        runtime.internalFallback !== "none" || !text(runtime.rendererRevision)) {
      issues.push("raw-first-native-runtime-not-observed");
    }
    const attempt = events.find((event) => event.kind === "attempt");
    issues.push(...nativeRuntimeEventIssues(events, {
      attemptId: attempt?.attemptId,
      requestId: attempt?.requestId,
      channelId: attempt?.channelId,
      sceneId: attempt?.sceneId,
      generationId: attempt?.generationId,
    }, "raw-first"));
    if (events.filter((event) => event.kind === "attempt").length !== 1) issues.push("raw-first-retried-renderer-attempt");
  } else if (id === "unsupported-scene-denied") {
    const host = asRecord(artifact.host);
    if (artifact.sceneId !== "macro-depth-of-field" ||
        !host || host["data-mounted-renderer-family"] !== "webgl-renderer" ||
        events.some((event) => event.kind === "attempt")) issues.push("unsupported-scene-was-not-denied");
    return issues;
  } else if (id === "m6c-stale-request-readback" || id === "m6c-retired-generation-readback") {
    const readback = asRecord(artifact.staleReadback);
    if (!readback || readback.status !== "stale" || asArray(readback.samples).length !== 0) {
      issues.push("stale-alpha-readback-not-rejected");
    }
    const resources = asRecord(readback?.resourceAccounting);
    if (!resources || resources.targetDisposed !== true || resources.previousRenderTargetRestored !== true ||
        resources.disposalOutcome !== "confirmed") issues.push("stale-alpha-readback-cleanup-incomplete");
    if (id === "m6c-stale-request-readback" && artifact.currentRequestId === artifact.initialRequestId) {
      issues.push("stale-request-not-replaced");
    }
    if (id === "m6c-retired-generation-readback" && artifact.cleanupOutcome !== "confirmed") {
      issues.push("retired-generation-cleanup-not-confirmed");
    }
    if (id === "m6c-retired-generation-readback" &&
        (artifact.currentHostMounted !== false || artifact.currentRequestId !== null ||
         typeof artifact.routeAfterNavigation !== "string" || !artifact.routeAfterNavigation.includes("/scenes"))) {
      issues.push("retired-generation-host-still-published-after-navigation");
    }
    const identity = asRecord(readback?.identity);
    if (!identity) {
      issues.push("stale-readback-identity-missing");
    } else {
      issues.push(...nativeRuntimeEventIssues(artifact.events, {
        attemptId: null,
        requestId: identity.requestId,
        channelId: identity.channelId,
        sceneId: identity.sceneId,
        generationId: identity.rendererGenerationId,
      }, `m6c-lifecycle-${id}`));
      issues.push(...acceptedFrameIssues(artifact.events, {
        requestId: identity.requestId,
        channelId: identity.channelId,
        sceneId: identity.sceneId,
        generationId: identity.rendererGenerationId,
      }, `m6c-lifecycle-${id}-source`));
    }
    if (id === "m6c-stale-request-readback") {
      issues.push(...acceptedFrameIssues(artifact.events, {
        requestId: artifact.currentRequestId,
        channelId: artifact.channelId,
        sceneId: artifact.sceneId,
        generationId: artifact.rendererGenerationId,
      }, "m6c-stale-request-latest"));
    }
  } else if (id === "presentation-stale-resize") {
    if (!text(artifact.staleRequestId) || !text(artifact.latestRequestId) ||
        artifact.staleRequestId === artifact.latestRequestId || artifact.staleRequestPublished !== false ||
        artifact.latestRequestPublished !== true) issues.push("stale-presentation-result-published-or-current-missing");
    const currentResult = events.find((event) => event.kind === "host-frame-result" && event.requestId === artifact.latestRequestId);
    if (currentResult) {
      issues.push(...nativeRuntimeEventIssues(events, {
        attemptId: currentResult.attemptId,
        requestId: currentResult.requestId,
        channelId: currentResult.channelId,
        sceneId: currentResult.sceneId,
        generationId: currentResult.generationId,
      }, "presentation-stale-resize"));
    } else {
      issues.push("presentation-stale-resize-latest-frame-event-missing");
    }
    issues.push(...acceptedFrameIssues(events, {
      requestId: artifact.latestRequestId,
      channelId: asRecord(artifact.host)?.["data-frame-channel-id"],
      sceneId: asRecord(artifact.host)?.["data-frame-scene-id"],
      generationId: asRecord(artifact.host)?.["data-renderer-generation"],
    }, "presentation-stale-resize-latest"));
  } else {
    const failure = events.find((event) => event.kind === "failure");
    const cleanup = events.find((event) => event.kind === "cleanup" && event.outcome === "confirmed");
    const hostCleanup = events.find((event) => event.kind === "cleanup-acknowledged" &&
      event.outcome === "confirmed" && event.generationId === failure?.generationId);
    const fallbackMount = events.find((event) => event.kind === "renderer-mounted" && event.rendererFamily === "webgl-renderer");
    if (!failure || failure.stage !== (id === "optical-resource-initialization-failure" ||
      id === "presentation-node-initialization-failure" ? "initialization" : "runtime")) {
      issues.push("expected-m6-failure-event-missing");
    }
    if (!cleanup || events.indexOf(cleanup) < events.indexOf(failure!)) issues.push("confirmed-cleanup-not-observed-after-failure");
    if (!hostCleanup || !cleanup || events.indexOf(hostCleanup) < events.indexOf(cleanup)) {
      issues.push("host-cleanup-acknowledgement-missing-or-contradictory");
    }
    if (!fallbackMount || !hostCleanup || events.indexOf(fallbackMount) < events.indexOf(hostCleanup)) {
      issues.push("fallback-mounted-before-confirmed-cleanup");
    }
    if (!text(failure?.attemptId) || !text(failure?.generationId) || !text(failure?.requestId) ||
        !text(failure?.operation) || !text(failure?.reason) || cleanup?.generationId !== failure?.generationId ||
        hostCleanup?.generationId !== failure?.generationId) {
      issues.push("m6-failure-cleanup-generation-or-operation-identity-invalid");
    }
    issues.push(...nativeRuntimeEventIssues(events, {
      attemptId: failure?.attemptId,
      requestId: failure?.requestId,
      channelId: failure?.channelId,
      sceneId: failure?.sceneId,
      generationId: failure?.generationId,
    }, `failure-${id}`));
    if (events.some((event) => event.kind === "frame-completed" && event.generationId === failure?.generationId &&
        event.requestId === failure?.requestId)) issues.push("failed-m6-request-published-as-complete");
    if (asRecord(artifact.observations)?.fallbackBackend !== "webgl-renderer" &&
        id !== "presentation-node-initialization-failure") issues.push("m6-failure-fallback-backend-invalid");
  }
  return issues;
};

const productionIssues = (artifact: JsonRecord | null): string[] => {
  if (!artifact) return ["production-preview-capture-missing"];
  const issues: string[] = [];
  const provenance = asRecord(artifact.sourceProvenance);
  if (!provenance || !validSha(provenance.sourceCommitSha) || !text(provenance.testInvocation) ||
      provenance.browserProject !== "production-preview") issues.push("production-capture-provenance-invalid");
  if (artifact.build !== "Vite production preview" || artifact.threeRevision !== "187" ||
      artifact.productionWebGpuEnabled !== false || artifact.webglOnlyDecision !== true) {
    issues.push("production-webgpu-enabled-or-runtime-revision-invalid");
  }
  const requests = asArray(artifact.webgpuModuleRequests);
  if (requests.length !== 0) issues.push("production-webgpu-modules-requested");
  const evidence = asRecord(artifact.evidence);
  if (!evidence || evidence.rendererAttempt !== "webgl" || evidence.rendererFamily !== "webgl-renderer" ||
      evidence.executionBackend !== "webgl2" || evidence.initializationAttempts !== "0" ||
      evidence.hasTestProbeAttribute !== false || evidence.hasDevelopmentFixtureAttribute !== false) {
    issues.push("production-ground-glass-webgl-isolation-failed");
  }
  const groundGlass = asRecord(artifact.groundGlassEvidence);
  if (!groundGlass || groundGlass.policySelectedBackend !== "webgl" ||
      groundGlass.rendererFamily !== "webgl-renderer" || groundGlass.actualExecutionApi !== "webgl2" ||
      groundGlass.pilotCount !== 0 || groundGlass.testSeamGlobal !== false) {
    issues.push("production-ground-glass-runtime-or-seam-isolation-failed");
  }
  return issues;
};

const passed = (issues: readonly string[]): boolean => issues.length === 0;
const statusDecision = (scenario: GroundGlassM7fScenario | undefined): GroundGlassM7fDecision =>
  scenario?.status ?? "blocked";

/** Replays persisted M6 native measurements and keeps each contract decision separate. */
export const evaluateGroundGlassM7fPresentationEvidence = (
  bundle: GroundGlassM7fPresentationEvidenceBundle,
): GroundGlassM7fPresentationEvaluation => {
  const sourceCommit = validSha(bundle.sourceCommitSha) ? bundle.sourceCommitSha : null;
  const rootIssues = [
    ...(bundle.schemaVersion === 1 && bundle.reportId === GROUND_GLASS_M7F_REPORT_ID ? [] : ["report-identity-invalid"]),
    ...(bundle.evaluatorRevision === GROUND_GLASS_M7F_EVALUATOR_REVISION ? [] : ["evaluator-revision-invalid"]),
    ...(sourceCommit ? [] : ["source-commit-sha-invalid"]),
    ...(text(bundle.testInvocation) ? [] : ["native-test-invocation-missing"]),
    ...(asRecord(bundle.authorization)?.rendererAttemptAuthority === "m3-raw-pilot" ? [] : ["m6-evidence-may-authorize-renderer-attempt"]),
    ...(asRecord(bundle.authorization)?.m4Status === "research-only" && asRecord(bundle.authorization)?.m5Status === "research-only"
      ? [] : ["m4-or-m5-boundary-invalid"]),
    ...(asRecord(bundle.authorization)?.m6EvidenceUsedForRendererSelection === false ? [] : ["m6-evidence-selection-boundary-invalid"]),
    ...(asRecord(bundle.authorization)?.productionWebGpuEnabled === false ? [] : ["production-webgpu-boundary-invalid"]),
    ...(asRecord(bundle.authorization)?.m5qChanged === false ? [] : ["m5q-history-modified"]),
    ...(asRecord(bundle.authorization)?.m8Authorized === false && asRecord(bundle.authorization)?.m9Authorized === false
      ? [] : ["future-stage-authorization-invalid"]),
  ];
  const artifacts = {
    m6d: asRecord(bundle.m6dComposite),
    m6b: asRecord(bundle.m6bConformance),
    m6c: asRecord(bundle.m6cAlpha),
    app: asRecord(bundle.registeredApp),
    production: asRecord(bundle.productionIsolation),
  };
  const scenarioIssues = new Map<typeof GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS[number], readonly string[]>();
  const remember = (id: typeof GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS[number], issues: readonly string[]) => {
    scenarioIssues.set(id, [...rootIssues, ...issues]);
  };
  const m6d = m6dIssues(artifacts.m6d);
  const spatial = m6bSpatialIssues(artifacts.m6b);
  const rgb = m6bRgbIssues(artifacts.m6b);
  const alpha = m6cIssues(artifacts.m6c);
  const app = registeredAppIssues(artifacts.app);
  remember("m5-m6-source-contract", [
    ...app.filter((issue) => issue.includes("composite") || issue.includes("request") || issue.includes("source")),
    ...(artifacts.m6d && artifacts.m6d.registeredM5Capture ? [] : ["registered-m5-source-identity-missing"]),
    ...(artifacts.app?.presentationSource === "m5-research-composite" ? [] : ["m6-source-is-not-current-m5-composite"]),
    ...(artifacts.app?.opticalReadback && asRecord(artifacts.app.opticalReadback)?.exactIdentityMatch === true
      ? [] : ["current-m5-composite-identity-not-confirmed"]),
    ...(artifacts.app?.opticalReadback &&
      asRecord(artifacts.app.opticalReadback)?.sourceRevision === ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION
      ? [] : ["m5-source-revision-invalid"]),
    ...(artifacts.m6d?.registeredM5Capture &&
      asRecord(artifacts.m6d.registeredM5Capture)?.sourceRevision === ARCHITECTURE_RISE_RAW_RTT_SOURCE_REVISION
      ? [] : ["m6d-m5-source-revision-invalid"]),
  ]);
  remember("m6d-opaque-composite", m6d);
  remember("m6b-spatial-fixture", spatial);
  remember("m6b-final-rgb", rgb);
  remember("m6c-opaque-target-alpha", alpha);
  remember("registered-architecture-rise-m3-m6", app);

  const lifecycleMapping: Partial<Record<typeof GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS[number], string>> = {
    "raw-first-resource-provisioning": "raw-first-provisioning.json",
    "optical-resource-initialization-failure": "optical-resource-initialization-failure.json",
    "presentation-node-initialization-failure": "presentation-node-initialization-failure.json",
    "presentation-pass-failure": "presentation-pass-failure.json",
    "final-display-failure": "final-display-failure.json",
    "presentation-stale-resize": "presentation-stale-resize.json",
    "m6c-stale-request-readback": "m6c-stale-request.json",
    "m6c-retired-generation-readback": "m6c-retired-generation.json",
    "unsupported-scene-denied": "unsupported-scene-denied.json",
  };
  for (const id of Object.keys(lifecycleMapping) as (keyof typeof lifecycleMapping)[]) {
    const file = lifecycleMapping[id];
    const artifact = file ? bundle.lifecycle[file] : undefined;
    remember(id, lifecycleIssues(id, asRecord(artifact) ?? undefined));
  }
  remember("production-webgl-isolation", productionIssues(artifacts.production));

  const scenarios: GroundGlassM7fScenario[] = GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS.map((id) => {
    const artifact = id === "m6d-opaque-composite" ? artifacts.m6d
      : id === "m6b-spatial-fixture" || id === "m6b-final-rgb" ? artifacts.m6b
        : id === "m6c-opaque-target-alpha" ? artifacts.m6c
          : id === "registered-architecture-rise-m3-m6" || id === "m5-m6-source-contract" ? artifacts.app
            : id === "production-webgl-isolation" ? artifacts.production
              : asRecord(bundle.lifecycle[lifecycleMapping[id] ?? ""]);
    const validationIssues = [...(scenarioIssues.get(id) ?? ["required-scenario-not-evaluated"])] as string[];
    const notRun = artifact === null || artifact === undefined;
    const provenance = asRecord(artifact?.captureProvenance ?? artifact?.sourceProvenance);
    const captureSourceCommit = provenance?.sourceCommitSha ?? artifact?.sourceCommit ?? artifact?.captureSourceSha;
    if (!notRun && (!validSha(captureSourceCommit) || captureSourceCommit !== sourceCommit)) {
      validationIssues.push("capture-source-sha-does-not-match-report");
    }
    const nativeRuntime = id === "m6d-opaque-composite"
      ? asRecord(artifact?.controlledCompositeProbe)
      : id === "m6c-opaque-target-alpha"
        ? asRecord(asRecord(asArray(artifact?.captures)[0])?.readback)
        : id === "registered-architecture-rise-m3-m6" || id === "m5-m6-source-contract"
          ? artifact
          : id === "production-webgl-isolation"
            ? asRecord(artifact?.groundGlassEvidence)
            : asRecord(artifact?.nativeRuntime) ?? asRecord(artifact?.runtime) ??
              asRecord(asArray(artifact?.events).map(asRecord).find((event) => event?.kind === "runtime-observed")) ??
              asRecord(artifact?.host);
    if (!notRun && id !== "production-webgl-isolation" && !nativeRuntime) {
      validationIssues.push("runtime-identity-not-observed");
    }
    const runtimeIdentity = nativeRuntime ? {
      ...nativeRuntime,
      browserProject: provenance?.browserProject ?? artifact?.testProject ?? null,
      browserVersion: artifact?.browserVersion ?? null,
      operatingSystem: artifact?.operatingSystem ?? provenance?.operatingSystem ?? null,
      nodeVersion: provenance?.nodeVersion ?? null,
      threePackageVersion: provenance?.threePackageVersion ?? null,
      rendererRevision: nativeRuntime.rendererRevision ?? provenance?.rendererRevision ?? null,
    } : null;
    const scenarioStatus: GroundGlassM7fScenarioStatus = notRun ? "blocked"
      : passed(validationIssues) ? "passed" : "failed";
    const orderedEvents = asArray(artifact?.events ?? artifact?.adapterEvents);
    const artifactName = id === "m6d-opaque-composite" ? "m6d-composite.json"
      : id === "m6b-spatial-fixture" || id === "m6b-final-rgb" ? "m6b-conformance.json"
        : id === "m6c-opaque-target-alpha" ? "m6c-alpha-conformance.json"
          : id === "registered-architecture-rise-m3-m6" || id === "m5-m6-source-contract" ? "registered-app-m6.json"
            : id === "production-webgl-isolation" ? "production-isolation.json"
              : `lifecycle/${lifecycleMapping[id] ?? "missing.json"}`;
    return {
      id,
      status: scenarioStatus,
      sourceCommitSha: typeof captureSourceCommit === "string" ? captureSourceCommit : null,
      testInvocation: typeof (provenance?.testInvocation ?? artifact?.testInvocation ?? artifact?.invocation) === "string"
        ? String(provenance?.testInvocation ?? artifact?.testInvocation ?? artifact?.invocation) : null,
      rendererRevision: typeof (provenance?.rendererRevision ?? nativeRuntime?.rendererRevision ?? artifact?.rendererRevision) === "string"
        ? String(provenance?.rendererRevision ?? nativeRuntime?.rendererRevision ?? artifact?.rendererRevision) : null,
      runtimeIdentity,
      supportingArtifacts: [artifactName],
      orderedEvents,
      limitations: ["Native implementation conformance does not qualify photographic quality or production WebGPU."],
      issues: validationIssues,
    };
  });

  const computedCounts = countByStatus(scenarios);
  const declaredCounts = {
    passed: Number(bundle.declaredCounts?.passed ?? -1),
    failed: Number(bundle.declaredCounts?.failed ?? -1),
    blocked: Number(bundle.declaredCounts?.blocked ?? -1),
    "not-run": Number(bundle.declaredCounts?.["not-run"] ?? -1),
  };
  const declaredCountsComplete = Object.values(declaredCounts).every((count) => Number.isInteger(count) && count >= 0);
  const inventoryConsistent = GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS.every((id) => scenarios.some((item) => item.id === id)) &&
    scenarios.length === GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS.length &&
    declaredCountsComplete &&
    Object.keys(computedCounts).every((key) => declaredCounts[key as keyof typeof declaredCounts] === computedCounts[key as keyof typeof computedCounts]);
  const byId = new Map(scenarios.map((scenario) => [scenario.id, scenario]));
  const allPassed = scenarios.length === GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS.length &&
    scenarios.every((scenario) => scenario.status === "passed") && inventoryConsistent;
  const decision = (scenarioIds: readonly (typeof GROUND_GLASS_M7F_REQUIRED_SCENARIO_IDS[number])[]): GroundGlassM7fDecision => {
    if (scenarioIds.some((id) => byId.get(id)?.status === "failed")) return "failed";
    if (scenarioIds.every((id) => byId.get(id)?.status === "passed")) return "passed";
    return "blocked";
  };
  const authorization = asRecord(bundle.authorization);
  const m6DevelopmentAuthorization = allPassed &&
    authorization?.rendererAttemptAuthority === "m3-raw-pilot" &&
    authorization.m4Status === "research-only" && authorization.m5Status === "research-only" &&
    authorization.m6EvidenceUsedForRendererSelection === false && authorization.productionWebGpuEnabled === false &&
    authorization.m5qChanged === false && authorization.m8Authorized === false && authorization.m9Authorized === false;
  return {
    schemaVersion: 1,
    reportId: GROUND_GLASS_M7F_REPORT_ID,
    evaluatorRevision: GROUND_GLASS_M7F_EVALUATOR_REVISION,
    sourceCommitSha: sourceCommit,
    declaredCounts,
    computedCounts,
    scenarios,
    decisions: {
      implementationConformance: decision([
        "m6d-opaque-composite", "m6c-opaque-target-alpha", "registered-architecture-rise-m3-m6",
      ]),
      spatialConformance: decision(["m6b-spatial-fixture"]),
      finalRgbConformance: decision(["m6b-final-rgb"]),
      opaqueAlphaConformance: decision(["m6d-opaque-composite", "m6c-opaque-target-alpha"]),
      lifecycleConformance: decision([
        "raw-first-resource-provisioning", "optical-resource-initialization-failure",
        "presentation-node-initialization-failure", "presentation-pass-failure", "final-display-failure",
        "presentation-stale-resize", "m6c-stale-request-readback", "m6c-retired-generation-readback",
      ]),
      productionIsolation: statusDecision(byId.get("production-webgl-isolation")),
      photographicQuality: "unqualified",
      m5qChanged: false,
      m6DevelopmentAuthorization,
      productionWebGpuEnabled: false,
      m8M9Authorized: false,
    },
    inventoryConsistent,
  };
};
