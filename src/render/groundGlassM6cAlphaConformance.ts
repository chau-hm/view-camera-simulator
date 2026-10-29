import type { GroundGlassPresentationRgba } from "./webgpu/groundGlassPresentationReference";

export const GROUND_GLASS_M6C_ALPHA_GATE_REVISION = "m6c-alpha-rgba8-r2";
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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isSampleId = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.trim() === value;

const isFiniteRgba = (value: unknown): value is GroundGlassPresentationRgba =>
  Array.isArray(value) && value.length === 4 && value.every(Number.isFinite);

const isSourceRgba = (value: unknown): value is GroundGlassPresentationRgba =>
  isFiniteRgba(value) && value.every((channel) => channel >= 0 && channel <= 1);

const isExpectedRgba = (value: unknown): value is GroundGlassPresentationRgba =>
  isFiniteRgba(value) && value[0] >= 0 && value[1] >= 0 && value[2] >= 0 &&
  value[3] >= 0 && value[3] <= 1;

const isNormalizedUv = (value: unknown): value is Readonly<{ u: number; v: number }> =>
  isRecord(value) && typeof value.u === "number" && Number.isFinite(value.u) && value.u >= 0 && value.u <= 1 &&
  typeof value.v === "number" && Number.isFinite(value.v) && value.v >= 0 && value.v <= 1;

const isSourceTexel = (value: unknown): value is Readonly<{ x: number; y: number }> =>
  isRecord(value) && typeof value.x === "number" && Number.isInteger(value.x) && value.x >= 0 &&
  typeof value.y === "number" && Number.isInteger(value.y) && value.y >= 0;

const isTargetByteRgba = (value: unknown): value is readonly [number, number, number, number] =>
  Array.isArray(value) && value.length === 4 && value.every((channel) =>
    typeof channel === "number" && Number.isInteger(channel) && channel >= 0 && channel <= 255);

const isStructurallyValidSample = (value: unknown): value is GroundGlassM6cAlphaSampleInput =>
  isRecord(value) && isSampleId(value.id) && isSourceTexel(value.sourceTexel) &&
  isNormalizedUv(value.sourceUvTopOrigin) && isNormalizedUv(value.displayUvTopOrigin) &&
  isSourceRgba(value.sourceLinearRgba) && isExpectedRgba(value.expectedFragmentRgba) &&
  isTargetByteRgba(value.actualTargetBytes);

/** Compares native RGBA8 target observations with the independent CPU presentation result. */
export const evaluateGroundGlassM6cAlphaConformance = (input: Readonly<{
  status: "measured" | "unsupported" | "failed" | "stale";
  identityCurrent: boolean;
  expectedSampleIds: readonly string[];
  samples: readonly GroundGlassM6cAlphaSampleInput[];
  expectedStoredAlpha?: (sample: GroundGlassM6cAlphaSampleInput) => number;
}>): GroundGlassM6cAlphaConformanceResult => {
  const expectedSampleCount = Array.isArray(input.expectedSampleIds) ? input.expectedSampleIds.length : 0;
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
      unavailableSampleCount: expectedSampleCount,
      invalidComparisonCount: 0,
      failedConditions: [reason],
    };
  }
  const expectedIdsInput: readonly unknown[] = Array.isArray(input.expectedSampleIds) ? input.expectedSampleIds : [];
  const samplesInput: readonly unknown[] = Array.isArray(input.samples) ? input.samples : [];
  const failedConditions: string[] = [];
  const validExpectedIds = expectedIdsInput.filter(isSampleId);
  const expectedIds = new Set(validExpectedIds);
  const duplicateExpectedCount = validExpectedIds.length - expectedIds.size;
  const invalidExpectedIdCount = expectedIdsInput.length - validExpectedIds.length;
  const expectedInventoryValid = Array.isArray(input.expectedSampleIds) && expectedIdsInput.length > 0 &&
    invalidExpectedIdCount === 0 && duplicateExpectedCount === 0;
  if (expectedIdsInput.length === 0) failedConditions.push("empty-expected-sample-inventory");
  if (invalidExpectedIdCount > 0 || !Array.isArray(input.expectedSampleIds)) {
    failedConditions.push("invalid-expected-sample-id");
  }
  if (duplicateExpectedCount > 0) failedConditions.push("duplicate-expected-sample-id");

  const actualIds = samplesInput.flatMap((sample) =>
    isRecord(sample) && isSampleId(sample.id) ? [sample.id] : []);
  const actualIdCounts = new Map<string, number>();
  for (const id of actualIds) actualIdCounts.set(id, (actualIdCounts.get(id) ?? 0) + 1);
  const duplicateSampleCount = [...actualIdCounts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  const invalidSampleIdCount = samplesInput.filter((sample) => !isRecord(sample) || !isSampleId(sample.id)).length;
  const unexpectedCount = actualIds.filter((id) => !expectedIds.has(id)).length;
  const missingIds = [...expectedIds].filter((id) => !actualIdCounts.has(id));
  const invalidSamples = samplesInput.filter((sample) => !isStructurallyValidSample(sample));
  const validSamples = samplesInput.filter(isStructurallyValidSample);
  if (duplicateSampleCount > 0) failedConditions.push("duplicate-sample-id");
  if (invalidSampleIdCount > 0) failedConditions.push("invalid-sample-id");
  if (unexpectedCount > 0) failedConditions.push("unexpected-sample-id");
  if (missingIds.length > 0) failedConditions.push("missing-sample");
  if (invalidSamples.length > 0) failedConditions.push("invalid-sample-value");
  const referenceAlphaFailures = validSamples.filter((sample) =>
    sample.expectedFragmentRgba[3] !== sample.sourceLinearRgba[3]);
  if (referenceAlphaFailures.length > 0) failedConditions.push("reference-alpha-contract-mismatch");
  const sourceIdentityFailures = validSamples.filter((sample) => sample.sourceSampleIdentityMatches !== true);
  if (sourceIdentityFailures.length > 0) failedConditions.push("source-sample-identity-mismatch");
  const materialEquivalenceFailures = validSamples.filter((sample) => sample.materialEquivalent !== true);
  if (materialEquivalenceFailures.length > 0) failedConditions.push("presentation-material-equivalence-failed");

  const results: GroundGlassM6cAlphaSampleResult[] = [];
  const measuredRgbErrors: number[] = [];
  let invalidStoredAlphaCount = 0;
  for (const sample of validSamples) {
    if (!expectedIds.has(sample.id)) continue;
    const actual = sample.actualTargetBytes.map(normalizeByte) as [number, number, number, number];
    const expectedRgbBytes = sample.expectedFragmentRgba.slice(0, 3).map((value) =>
      Math.max(0, Math.min(255, Math.round(value * 255)))) as [number, number, number];
    const expectedRgb = expectedRgbBytes.map((value) => value / 255) as [number, number, number];
    const rgbErrors = expectedRgbBytes.map((value, index) =>
      Math.abs(value - sample.actualTargetBytes[index]!) / 255);
    measuredRgbErrors.push(...rgbErrors);
    let expectedStoredTargetAlpha: number;
    try {
      const expectedStoredAlpha = input.expectedStoredAlpha as unknown;
      expectedStoredTargetAlpha = expectedStoredAlpha === undefined
        ? sample.expectedFragmentRgba[3]
        : typeof expectedStoredAlpha === "function"
          ? (expectedStoredAlpha as (current: GroundGlassM6cAlphaSampleInput) => number)(sample)
          : Number.NaN;
    } catch {
      expectedStoredTargetAlpha = Number.NaN;
    }
    if (!Number.isFinite(expectedStoredTargetAlpha) || expectedStoredTargetAlpha < 0 || expectedStoredTargetAlpha > 1) {
      invalidStoredAlphaCount += 1;
      failedConditions.push("invalid-expected-stored-alpha");
      continue;
    }
    const absoluteAlphaError = Math.abs(expectedStoredTargetAlpha - actual[3]);
    const sourceAlphaPreservationError = Math.abs(sample.expectedFragmentRgba[3] - actual[3]);
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
  const rgbErrors = measuredRgbErrors;
  if (results.length !== expectedSampleCount) failedConditions.push("incomplete-sample-matrix");
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
  const targetStoragePass = maximumAlphaError !== null && maximumAlphaError <= GROUND_GLASS_M6C_MAX_ALPHA_ERROR;
  const evidenceValid = expectedInventoryValid && results.length === expectedSampleCount &&
    invalidStoredAlphaCount === 0 && missingIds.length === 0 && invalidSamples.length === 0 &&
    invalidSampleIdCount === 0 && referenceAlphaFailures.length === 0 && sourceIdentityFailures.length === 0 &&
    materialEquivalenceFailures.length === 0 && duplicateSampleCount === 0 && unexpectedCount === 0 && targetStoragePass;
  const alphaPass = evidenceValid && targetStoragePass &&
    maximumSourceAlphaPreservationError !== null &&
    maximumSourceAlphaPreservationError <= GROUND_GLASS_M6C_MAX_ALPHA_ERROR &&
    results.every((sample) => sample.expectedStoredTargetAlpha === sample.expectedFragmentAlpha);
  if (maximumAlphaError !== null && maximumAlphaError > GROUND_GLASS_M6C_MAX_ALPHA_ERROR) {
    failedConditions.push("alpha-target-storage-limit-exceeded");
  }
  if (maximumSourceAlphaPreservationError !== null &&
      maximumSourceAlphaPreservationError > GROUND_GLASS_M6C_MAX_ALPHA_ERROR) {
    failedConditions.push("alpha-preservation-limit-exceeded");
  }
  if (maximumAlphaError !== null && !targetStoragePass) failedConditions.push("target-storage-evidence-invalid");
  const materialOutputContractDiffers = results.some((sample) =>
    sample.expectedStoredTargetAlpha !== sample.expectedFragmentAlpha);
  if (materialOutputContractDiffers) failedConditions.push("material-alpha-output-contract-differs-from-source");
  const rgbNumericalPass = maximumRgbError !== null && maximumRgbError <= GROUND_GLASS_M6C_MAX_RGB_ERROR;
  if (!evidenceValid) failedConditions.push("rgb-evidence-incomplete-or-invalid");
  if (maximumRgbError === null) failedConditions.push("rgb-comparison-unavailable");
  if (maximumRgbError !== null && !rgbNumericalPass) failedConditions.push("rgb-regression-limit-exceeded");
  const observedContractDiffers = evidenceValid && !alphaPass && maximumSourceAlphaPreservationError !== null &&
    maximumSourceAlphaPreservationError > GROUND_GLASS_M6C_MAX_ALPHA_ERROR &&
    targetStoragePass && materialOutputContractDiffers;
  const alphaDecision = alphaPass ? "alpha-preservation-conformant"
    : observedContractDiffers ? "alpha-observable-contract-different"
      : "alpha-failed";
  const invalidComparisonCount = duplicateExpectedCount + invalidExpectedIdCount + duplicateSampleCount +
    invalidSampleIdCount + unexpectedCount + invalidSamples.length + invalidStoredAlphaCount +
    referenceAlphaFailures.length + sourceIdentityFailures.length + materialEquivalenceFailures.length;
  return {
    status: failedConditions.length === 0 ? "measured" : "failed",
    alphaDecision,
    rgbDecision: evidenceValid && rgbNumericalPass ? "rgb-regression-passed" : "rgb-regression-failed",
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
    invalidComparisonCount,
    failedConditions,
  };
};
