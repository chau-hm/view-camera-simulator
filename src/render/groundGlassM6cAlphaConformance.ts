import type { GroundGlassPresentationRgba } from "./webgpu/groundGlassPresentationReference";

export const GROUND_GLASS_M6C_ALPHA_GATE_REVISION = "m6c-alpha-rgba8-r1";
export const GROUND_GLASS_M6C_MAX_ALPHA_ERROR = 2 / 255;
export const GROUND_GLASS_M6C_MAX_RGB_ERROR = 4 / 255;

export type GroundGlassM6cReadbackIdentity = Readonly<{
  requestId: string;
  channelId: string;
  sceneId: string;
  rendererGenerationId: string;
  sourceDataFingerprint: string;
  presentationStateFingerprint: string;
  targetWidthPx: number;
  targetHeightPx: number;
  previewMode: "raw" | "upright";
  inspectionWindow: Readonly<{
    active: boolean;
    centerU: number;
    centerV: number;
    widthFraction: number;
    heightFraction: number;
  }>;
}>;

export type GroundGlassM6cAlphaSampleInput = Readonly<{
  id: string;
  sourceTexel: Readonly<{ x: number; y: number }>;
  sourceUvTopOrigin: Readonly<{ u: number; v: number }>;
  displayUvTopOrigin: Readonly<{ u: number; v: number }>;
  sourceLinearRgba: GroundGlassPresentationRgba;
  expectedFragmentRgba: GroundGlassPresentationRgba;
  actualTargetBytes: readonly [number, number, number, number];
  sourceSampleIdentityMatches: boolean;
  materialEquivalent: boolean;
}>;

export type GroundGlassM6cAlphaSampleResult = Readonly<{
  id: string;
  sourceTexel: Readonly<{ x: number; y: number }>;
  sourceUvTopOrigin: Readonly<{ u: number; v: number }>;
  displayUvTopOrigin: Readonly<{ u: number; v: number }>;
  sourceLinearRgba: GroundGlassPresentationRgba;
  expectedFragmentAlpha: number;
  expectedStoredTargetAlpha: number;
  actualGpuTargetAlpha: number;
  absoluteAlphaError: number;
  sourceAlphaPreservationError: number;
  expectedRgb: readonly [number, number, number];
  actualGpuRgb: readonly [number, number, number];
  maximumRgbError: number;
  rgbRmse: number;
}>;

export type GroundGlassM6cAlphaConformanceResult = Readonly<{
  status: "measured" | "unsupported" | "failed" | "stale";
  alphaDecision: "alpha-preservation-conformant" | "alpha-observable-contract-different" | "alpha-unsupported" | "alpha-failed";
  rgbDecision: "rgb-regression-passed" | "rgb-regression-failed";
  samples: readonly GroundGlassM6cAlphaSampleResult[];
  maximumAlphaError: number | null;
  alphaRmse: number | null;
  meanAbsoluteAlphaError: number | null;
  maximumSourceAlphaPreservationError: number | null;
  sourceAlphaPreservationRmse: number | null;
  meanSourceAlphaPreservationError: number | null;
  maximumRgbError: number | null;
  rgbRmse: number | null;
  supportedSampleCount: number;
  unavailableSampleCount: number;
  invalidComparisonCount: number;
  failedConditions: readonly string[];
}>;

export type GroundGlassM6cMaterialEvidence = Readonly<{
  samePresentationMaterialInstance: boolean;
  transparent: boolean;
  opacity: number;
  blending: "none" | "normal" | "other";
  alphaTest: number;
  premultipliedAlpha: boolean;
  colorWrite: boolean;
}>;

export const isGroundGlassM6cBuildAuthorized = (input: Readonly<{
  developmentBuild: boolean;
  rawPilotFlag: boolean;
  m6PresentationFlag: boolean;
  testSeamFlag: boolean;
  explicitFixtureControl: boolean;
  exactRegisteredScene: boolean;
}>): boolean => input.developmentBuild && input.rawPilotFlag && input.m6PresentationFlag &&
  input.testSeamFlag && input.explicitFixtureControl && input.exactRegisteredScene;

export const isGroundGlassM6cMaterialEquivalent = (
  material: GroundGlassM6cMaterialEvidence,
): boolean => material.samePresentationMaterialInstance &&
  material.transparent === false && material.opacity === 1 && material.blending === "normal" &&
  material.alphaTest === 0 && material.premultipliedAlpha === false && material.colorWrite === true;

export const isGroundGlassM6cTargetLifecycleComplete = (input: Readonly<{
  allocated: boolean;
  disposed: boolean;
  previousRenderTargetRestored: boolean;
  outstandingCaptureCount: number;
}>): boolean => input.allocated && input.disposed && input.previousRenderTargetRestored &&
  input.outstandingCaptureCount === 0;

const sameInspectionWindow = (
  left: GroundGlassM6cReadbackIdentity["inspectionWindow"],
  right: GroundGlassM6cReadbackIdentity["inspectionWindow"],
): boolean => left.active === right.active && left.centerU === right.centerU && left.centerV === right.centerV &&
  left.widthFraction === right.widthFraction && left.heightFraction === right.heightFraction;

export const isGroundGlassM6cReadbackCurrent = (
  captured: GroundGlassM6cReadbackIdentity,
  current: GroundGlassM6cReadbackIdentity,
): boolean => captured.requestId === current.requestId &&
  captured.channelId === current.channelId &&
  captured.sceneId === current.sceneId &&
  captured.rendererGenerationId === current.rendererGenerationId &&
  captured.sourceDataFingerprint === current.sourceDataFingerprint &&
  captured.presentationStateFingerprint === current.presentationStateFingerprint &&
  captured.targetWidthPx === current.targetWidthPx &&
  captured.targetHeightPx === current.targetHeightPx &&
  captured.previewMode === current.previewMode &&
  sameInspectionWindow(captured.inspectionWindow, current.inspectionWindow);

const normalizeByte = (value: number): number => Math.max(0, Math.min(255, Math.round(value))) / 255;

/** Compares native RGBA8 target observations with the independent CPU presentation result. */
export const evaluateGroundGlassM6cAlphaConformance = (input: Readonly<{
  status: "measured" | "unsupported" | "failed" | "stale";
  identityCurrent: boolean;
  expectedSampleIds: readonly string[];
  samples: readonly GroundGlassM6cAlphaSampleInput[];
  expectedStoredAlpha?: (sample: GroundGlassM6cAlphaSampleInput) => number;
}>): GroundGlassM6cAlphaConformanceResult => {
  if (input.status !== "measured" || !input.identityCurrent) {
    const reason = input.identityCurrent ? input.status : "stale";
    return {
      status: reason,
      alphaDecision: reason === "unsupported" ? "alpha-unsupported" : "alpha-failed",
      rgbDecision: "rgb-regression-failed",
      samples: [],
      maximumAlphaError: null,
      alphaRmse: null,
      meanAbsoluteAlphaError: null,
      maximumSourceAlphaPreservationError: null,
      sourceAlphaPreservationRmse: null,
      meanSourceAlphaPreservationError: null,
      maximumRgbError: null,
      rgbRmse: null,
      supportedSampleCount: 0,
      unavailableSampleCount: input.expectedSampleIds.length,
      invalidComparisonCount: 0,
      failedConditions: [reason],
    };
  }
  const byId = new Map(input.samples.map((sample) => [sample.id, sample]));
  const failedConditions: string[] = [];
  const expectedIds = new Set(input.expectedSampleIds);
  const duplicateCount = input.samples.length - byId.size;
  const unexpectedCount = input.samples.filter((sample) => !expectedIds.has(sample.id)).length;
  const missingIds = input.expectedSampleIds.filter((id) => !byId.has(id));
  const invalidSamples = input.samples.filter((sample) =>
    !sample.sourceLinearRgba.every(Number.isFinite) ||
    !sample.expectedFragmentRgba.every(Number.isFinite) ||
    !sample.actualTargetBytes.every((value) => Number.isInteger(value) && value >= 0 && value <= 255));
  if (duplicateCount > 0) failedConditions.push("duplicate-sample-id");
  if (unexpectedCount > 0) failedConditions.push("unexpected-sample-id");
  if (missingIds.length > 0) failedConditions.push("missing-sample");
  if (invalidSamples.length > 0) failedConditions.push("invalid-sample-value");
  const referenceAlphaFailures = input.samples.filter((sample) =>
    sample.expectedFragmentRgba[3] !== sample.sourceLinearRgba[3]);
  if (referenceAlphaFailures.length > 0) failedConditions.push("reference-alpha-contract-mismatch");
  const sourceIdentityFailures = input.samples.filter((sample) => !sample.sourceSampleIdentityMatches);
  if (sourceIdentityFailures.length > 0) failedConditions.push("source-sample-identity-mismatch");
  const materialEquivalenceFailures = input.samples.filter((sample) => sample.materialEquivalent !== true);
  if (materialEquivalenceFailures.length > 0) failedConditions.push("presentation-material-equivalence-failed");

  const results: GroundGlassM6cAlphaSampleResult[] = [];
  let invalidStoredAlphaCount = 0;
  for (const sampleId of input.expectedSampleIds) {
    const sample = byId.get(sampleId);
    if (!sample || invalidSamples.includes(sample)) continue;
    const actual = sample.actualTargetBytes.map(normalizeByte) as [number, number, number, number];
    const expectedStoredTargetAlpha = input.expectedStoredAlpha?.(sample) ?? sample.expectedFragmentRgba[3];
    if (!Number.isFinite(expectedStoredTargetAlpha) || expectedStoredTargetAlpha < 0 || expectedStoredTargetAlpha > 1) {
      invalidStoredAlphaCount += 1;
      failedConditions.push("invalid-expected-stored-alpha");
      continue;
    }
    const absoluteAlphaError = Math.abs(expectedStoredTargetAlpha - actual[3]);
    const sourceAlphaPreservationError = Math.abs(sample.expectedFragmentRgba[3] - actual[3]);
    const expectedRgb = sample.expectedFragmentRgba.slice(0, 3).map((value) => normalizeByte(value * 255)) as [number, number, number];
    const rgbErrors = expectedRgb.map((value, index) => Math.abs(value - actual[index]!));
    results.push({
      id: sample.id,
      sourceTexel: sample.sourceTexel,
      sourceUvTopOrigin: sample.sourceUvTopOrigin,
      displayUvTopOrigin: sample.displayUvTopOrigin,
      sourceLinearRgba: sample.sourceLinearRgba,
      expectedFragmentAlpha: sample.expectedFragmentRgba[3],
      expectedStoredTargetAlpha,
      actualGpuTargetAlpha: actual[3],
      absoluteAlphaError,
      sourceAlphaPreservationError,
      expectedRgb,
      actualGpuRgb: [actual[0], actual[1], actual[2]],
      maximumRgbError: Math.max(...rgbErrors),
      rgbRmse: Math.sqrt(rgbErrors.reduce((sum, error) => sum + error * error, 0) / rgbErrors.length),
    });
  }
  const alphaErrors = results.map((sample) => sample.absoluteAlphaError);
  const sourceAlphaPreservationErrors = results.map((sample) => sample.sourceAlphaPreservationError);
  const rgbErrors = results.flatMap((sample) => sample.expectedRgb.map((value, index) => Math.abs(value - sample.actualGpuRgb[index]!)));
  if (results.length !== input.expectedSampleIds.length) failedConditions.push("incomplete-sample-matrix");
  const maximumAlphaError = alphaErrors.length ? Math.max(...alphaErrors) : null;
  const alphaRmse = alphaErrors.length
    ? Math.sqrt(alphaErrors.reduce((sum, error) => sum + error * error, 0) / alphaErrors.length)
    : null;
  const meanAbsoluteAlphaError = alphaErrors.length
    ? alphaErrors.reduce((sum, error) => sum + error, 0) / alphaErrors.length
    : null;
  const maximumSourceAlphaPreservationError = sourceAlphaPreservationErrors.length
    ? Math.max(...sourceAlphaPreservationErrors)
    : null;
  const sourceAlphaPreservationRmse = sourceAlphaPreservationErrors.length
    ? Math.sqrt(sourceAlphaPreservationErrors.reduce((sum, error) => sum + error * error, 0) / sourceAlphaPreservationErrors.length)
    : null;
  const meanSourceAlphaPreservationError = sourceAlphaPreservationErrors.length
    ? sourceAlphaPreservationErrors.reduce((sum, error) => sum + error, 0) / sourceAlphaPreservationErrors.length
    : null;
  const maximumRgbError = rgbErrors.length ? Math.max(...rgbErrors) : null;
  const rgbRmse = rgbErrors.length
    ? Math.sqrt(rgbErrors.reduce((sum, error) => sum + error * error, 0) / rgbErrors.length)
    : null;
  const evidenceValid = results.length === input.expectedSampleIds.length && invalidStoredAlphaCount === 0 &&
    missingIds.length === 0 && invalidSamples.length === 0 && referenceAlphaFailures.length === 0 &&
    sourceIdentityFailures.length === 0 && materialEquivalenceFailures.length === 0 &&
    duplicateCount === 0 && unexpectedCount === 0;
  const targetStoragePass = maximumAlphaError !== null && maximumAlphaError <= GROUND_GLASS_M6C_MAX_ALPHA_ERROR;
  const alphaPass = evidenceValid && targetStoragePass &&
    maximumSourceAlphaPreservationError !== null &&
    maximumSourceAlphaPreservationError <= GROUND_GLASS_M6C_MAX_ALPHA_ERROR &&
    results.every((sample) => sample.expectedStoredTargetAlpha === sample.expectedFragmentAlpha);
  const rgbPass = maximumRgbError !== null && maximumRgbError <= GROUND_GLASS_M6C_MAX_RGB_ERROR;
  if (maximumAlphaError !== null && maximumAlphaError > GROUND_GLASS_M6C_MAX_ALPHA_ERROR) {
    failedConditions.push("alpha-target-storage-limit-exceeded");
  }
  if (maximumSourceAlphaPreservationError !== null &&
      maximumSourceAlphaPreservationError > GROUND_GLASS_M6C_MAX_ALPHA_ERROR) {
    failedConditions.push("alpha-preservation-limit-exceeded");
  }
  const materialOutputContractDiffers = results.some((sample) =>
    sample.expectedStoredTargetAlpha !== sample.expectedFragmentAlpha);
  if (materialOutputContractDiffers) failedConditions.push("material-alpha-output-contract-differs-from-source");
  if (!rgbPass) failedConditions.push("rgb-regression-limit-exceeded");
  const allMeasuredOpaque = results.length === input.expectedSampleIds.length && results.length > 0 &&
    results.every((sample) => sample.actualGpuTargetAlpha === 1);
  const observedContractDiffers = evidenceValid && !alphaPass && maximumSourceAlphaPreservationError !== null &&
    maximumSourceAlphaPreservationError > GROUND_GLASS_M6C_MAX_ALPHA_ERROR &&
    (targetStoragePass || allMeasuredOpaque) &&
    (materialOutputContractDiffers || allMeasuredOpaque);
  const alphaDecision = alphaPass ? "alpha-preservation-conformant"
    : observedContractDiffers ? "alpha-observable-contract-different"
      : "alpha-failed";
  return {
    status: failedConditions.length === 0 ? "measured" : "failed",
    alphaDecision,
    rgbDecision: rgbPass ? "rgb-regression-passed" : "rgb-regression-failed",
    samples: results,
    maximumAlphaError,
    alphaRmse,
    meanAbsoluteAlphaError,
    maximumSourceAlphaPreservationError,
    sourceAlphaPreservationRmse,
    meanSourceAlphaPreservationError,
    maximumRgbError,
    rgbRmse,
    supportedSampleCount: results.length,
    unavailableSampleCount: missingIds.length,
    invalidComparisonCount: duplicateCount + unexpectedCount + invalidSamples.length +
      invalidStoredAlphaCount + referenceAlphaFailures.length + sourceIdentityFailures.length +
      materialEquivalenceFailures.length,
    failedConditions,
  };
};
