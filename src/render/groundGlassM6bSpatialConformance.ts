import type { GroundGlassInspectionWindow } from "./groundGlassInspectionWindow";
import {
  GROUND_GLASS_M6B_CALIBRATION_LANDMARKS,
  type GroundGlassM6bAlignmentMeasurement,
  type GroundGlassM6bExpectedLandmark,
  type GroundGlassM6bLandmarkMeasurement,
} from "./groundGlassPhysicalOverlayConformance";
import type { GroundGlassPreviewMode } from "./groundGlassTargetProjection";

export const GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX = 2;
export const GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX = 1.25;
export const GROUND_GLASS_M6B_SPATIAL_GATE_REVISION = "m6b-spatial-gate-r1";

export const GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS = Object.freeze([
  "m6b-raw-full-film",
  "m6b-upright-full-film",
  "m6b-raw-round-trip",
  "m6b-loupe-centered",
  "m6b-loupe-horizontal-pan",
  "m6b-loupe-vertical-pan",
  "m6b-loupe-diagonal-pan",
  "m6b-loupe-left-limit",
  "m6b-loupe-right-limit",
  "m6b-loupe-top-limit",
  "m6b-loupe-bottom-limit",
  "m6b-upright-cropped-loupe",
  "m6b-loupe-reset-full-film",
  "m6b-resized-standard-quality",
] as const);

export const GROUND_GLASS_M6B_FULL_FILM_CAPTURE_IDS = Object.freeze([
  "m6b-raw-full-film",
  "m6b-upright-full-film",
  "m6b-raw-round-trip",
  "m6b-loupe-reset-full-film",
  "m6b-resized-standard-quality",
] as const);

export const GROUND_GLASS_M6B_LOUPE_CAPTURE_IDS = Object.freeze([
  "m6b-loupe-centered",
  "m6b-loupe-horizontal-pan",
  "m6b-loupe-vertical-pan",
  "m6b-loupe-diagonal-pan",
  "m6b-loupe-left-limit",
  "m6b-loupe-right-limit",
  "m6b-loupe-top-limit",
  "m6b-loupe-bottom-limit",
  "m6b-upright-cropped-loupe",
] as const);

export type GroundGlassM6bSpatialCaptureInput = Readonly<{
  captureId: string | null;
  captureName: string | null;
  previewMode: GroundGlassPreviewMode | null;
  focusLoupeActive: boolean | null;
  crop: GroundGlassInspectionWindow | null;
  displaySizePx: Readonly<{ widthPx: number; heightPx: number }> | null;
  internalTargetSizePx: Readonly<{ widthPx: number; heightPx: number }> | null;
  previousInternalTargetSizePx: Readonly<{ widthPx: number; heightPx: number }> | null;
  requestId: string | null;
  channelId: string | null;
  sceneId: string | null;
  rendererGenerationId: string | null;
  expectedLandmarks: readonly GroundGlassM6bExpectedLandmark[] | null;
  minimumMeasuredLandmarkCount: number | null;
  maximumSpatialErrorPx: number | null;
  maximumSpatialRmsPx: number | null;
  alignment: GroundGlassM6bAlignmentMeasurement | null;
}>;

export type GroundGlassM6bSpatialCaptureClassification = "passed" | "failed" | "unsupported";
export type GroundGlassM6bSpatialIssue = Readonly<{
  code: string;
  severity: "failure" | "unsupported";
  message: string;
  landmarkIds: readonly string[];
}>;

export type GroundGlassM6bSpatialCaptureResult = Readonly<{
  captureId: string;
  captureName: string | null;
  previewMode: GroundGlassPreviewMode | null;
  focusLoupeActive: boolean | null;
  crop: GroundGlassInspectionWindow | null;
  displaySizePx: Readonly<{ widthPx: number; heightPx: number }> | null;
  internalTargetSizePx: Readonly<{ widthPx: number; heightPx: number }> | null;
  previousInternalTargetSizePx: Readonly<{ widthPx: number; heightPx: number }> | null;
  requestId: string | null;
  channelId: string | null;
  sceneId: string | null;
  rendererGenerationId: string | null;
  classification: GroundGlassM6bSpatialCaptureClassification;
  maximumErrorPx: number | null;
  rmsErrorPx: number | null;
  recomputedMaximumErrorPx: number | null;
  recomputedRmsErrorPx: number | null;
  maximumSpatialErrorPx: number;
  maximumSpatialRmsPx: number;
  expectedLandmarkCount: number;
  expectedVisibleLandmarkCount: number;
  measuredLandmarkCount: number;
  outsideCurrentCropCount: number;
  unsupportedCount: number;
  errorSampleCount: number;
  spatialErrorSamples: readonly number[];
  metricsComplete: boolean;
  affectedLandmarkIds: readonly string[];
  issues: readonly GroundGlassM6bSpatialIssue[];
}>;

export type GroundGlassM6bSpatialConformanceResult = Readonly<{
  spatialGateRevision: string;
  requiredCaptureIds: readonly string[];
  captureCount: number;
  physicalOverlayConformant: boolean;
  physicalOverlayDecision: "physical-overlay-conformant" | "physical-overlay-partial" | "physical-overlay-failed";
  evidenceScope: "controlled-calibration-fixture";
  registeredAppPhysicalOverlay: "not-evaluated";
  finalOutputAlpha: "unobservable";
  m6Architecture: "architecture-partially-implemented";
  m6PhotographicQuality: "quality-unqualified";
  stateSpecificAssertionsPassed: boolean;
  allRequiredCaptureIdsPresentExactlyOnce: boolean;
  missingCaptureIds: readonly string[];
  duplicateCaptureIds: readonly string[];
  unexpectedCaptureIds: readonly string[];
  perCaptureClassifications: readonly GroundGlassM6bSpatialCaptureResult[];
  overallMaximumErrorPx: number | null;
  overallRmsErrorPx: number | null;
  totalMeasuredLandmarks: number | null;
  totalOutsideCurrentCrop: number | null;
  totalUnsupported: number | null;
  missingCaptureCount: number;
  unsupportedMeasurementCount: number;
  failureReasons: readonly string[];
}>;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isFinitePoint = (value: unknown): value is Readonly<{ x: number; y: number }> =>
  typeof value === "object" && value !== null &&
  isFiniteNumber((value as { x?: unknown }).x) && isFiniteNumber((value as { y?: unknown }).y);

const closeEnough = (left: number, right: number): boolean =>
  Math.abs(left - right) <= 1e-9 * Math.max(1, Math.abs(left), Math.abs(right));

const distance = (left: Readonly<{ x: number; y: number }>, right: Readonly<{ x: number; y: number }>): number =>
  Math.hypot(left.x - right.x, left.y - right.y);

const hasText = (value: string | null): value is string => typeof value === "string" && value.trim().length > 0;

const recomputeVisibilityAndPoint = (
  landmark: GroundGlassM6bExpectedLandmark,
  crop: GroundGlassInspectionWindow,
  displaySizePx: Readonly<{ widthPx: number; heightPx: number }>,
): Readonly<{ visible: boolean; x: number; y: number }> => {
  const width = crop.active ? crop.widthFraction : 1;
  const height = crop.active ? crop.heightFraction : 1;
  const centerU = crop.active ? crop.centerU : 0.5;
  const centerV = crop.active ? crop.centerV : 0.5;
  const u = (landmark.displayUv.u - (centerU - width / 2)) / width;
  const v = (landmark.displayUv.v - (centerV - height / 2)) / height;
  return {
    visible: u >= 0 && u <= 1 && v >= 0 && v <= 1,
    x: u * displaySizePx.widthPx,
    y: v * displaySizePx.heightPx,
  };
};

const errorFieldsForOutsideMeasurement = (measurement: GroundGlassM6bLandmarkMeasurement): readonly unknown[] => [
  measurement.measuredImagePx,
  measurement.measuredTargetPx,
  measurement.measuredGridIntersectionPx,
  measurement.imageErrorXPx,
  measurement.imageErrorYPx,
  measurement.imageMappingErrorPx,
  measurement.targetErrorXPx,
  measurement.targetErrorYPx,
  measurement.overlayMappingErrorPx,
  measurement.gridErrorXPx,
  measurement.gridErrorYPx,
  measurement.gridMappingErrorPx,
  measurement.gridToLandmarkErrorPx,
];

type LandmarkValidation = Readonly<{
  gateStatus: "measured" | "outside-current-crop" | "unsupported";
  validErrorValues: readonly number[];
  issues: readonly GroundGlassM6bSpatialIssue[];
  metricsComplete: boolean;
}>;

const issue = (
  code: string,
  severity: GroundGlassM6bSpatialIssue["severity"],
  message: string,
  landmarkIds: readonly string[] = [],
): GroundGlassM6bSpatialIssue => ({ code, severity, message, landmarkIds });

const validateLandmarkMeasurement = (
  expected: GroundGlassM6bExpectedLandmark,
  measurement: GroundGlassM6bLandmarkMeasurement | undefined,
  crop: GroundGlassInspectionWindow,
  displaySizePx: Readonly<{ widthPx: number; heightPx: number }>,
): LandmarkValidation => {
  const issues: GroundGlassM6bSpatialIssue[] = [];
  const expectedDisplay = recomputeVisibilityAndPoint(expected, crop, displaySizePx);
  const visible = expectedDisplay.visible;
  const landmarkIds = [expected.id];
  const metricError = (
    code: string,
    actual: unknown,
    calculated: number | null,
    description: string,
    nonnegative = true,
  ): number | null => {
    if (!isFiniteNumber(actual)) {
      issues.push(issue(code, "unsupported", `${description} is missing or nonfinite`, landmarkIds));
      return null;
    }
    if (nonnegative && actual < 0) {
      issues.push(issue(`${code}-negative`, "unsupported", `${description} must be nonnegative`, landmarkIds));
      return null;
    }
    if (calculated === null || !closeEnough(actual, calculated)) {
      issues.push(issue(`${code}-inconsistent`, "unsupported", `${description} is inconsistent with its measured points`, landmarkIds));
      return null;
    }
    return calculated;
  };

  if (expected.visibleInCrop !== visible ||
    !closeEnough(expected.cssContentBoxPx.x, expectedDisplay.x) ||
    !closeEnough(expected.cssContentBoxPx.y, expectedDisplay.y)) {
    issues.push(issue("expected-landmark-geometry-mismatch", "unsupported",
      "Expected visibility or CSS position does not match the capture crop and display size", landmarkIds));
  }
  if (!measurement) {
    if (visible) {
      issues.push(issue("missing-visible-landmark", "unsupported", "Visible expected landmark has no measurement", landmarkIds));
      return { gateStatus: "unsupported", validErrorValues: [], issues, metricsComplete: false };
    }
    issues.push(issue("missing-outside-crop-classification", "unsupported", "Outside-crop landmark has no classification", landmarkIds));
    return { gateStatus: "unsupported", validErrorValues: [], issues, metricsComplete: false };
  }

  if (!visible) {
    const outsideClassified = measurement.status === "outside-current-crop" &&
      errorFieldsForOutsideMeasurement(measurement).every((value) => value === null);
    if (!outsideClassified) {
      issues.push(issue("outside-crop-classification-mismatch", "unsupported",
        "Landmark outside the current crop must be classified outside-current-crop with no measured point", landmarkIds));
      return { gateStatus: "unsupported", validErrorValues: [], issues, metricsComplete: false };
    }
    return { gateStatus: "outside-current-crop", validErrorValues: [], issues, metricsComplete: true };
  }

  if (measurement.status !== "measured") {
    issues.push(issue("visible-landmark-not-measured", "unsupported",
      "Visible landmark must be measured; outside-crop and unsupported statuses cannot satisfy the gate", landmarkIds));
    return { gateStatus: "unsupported", validErrorValues: [], issues, metricsComplete: false };
  }

  const expectedPointMatches = isFinitePoint(measurement.expectedImagePx) &&
    isFinitePoint(measurement.expectedTargetPx) &&
    closeEnough(measurement.expectedImagePx.x, expected.cssContentBoxPx.x) &&
    closeEnough(measurement.expectedImagePx.y, expected.cssContentBoxPx.y) &&
    closeEnough(measurement.expectedTargetPx.x, expected.cssContentBoxPx.x) &&
    closeEnough(measurement.expectedTargetPx.y, expected.cssContentBoxPx.y);
  if (!expectedPointMatches) {
    issues.push(issue("measurement-expected-point-mismatch", "unsupported",
      "Measurement expectations do not match the canonical crop-projected landmark", landmarkIds));
  }

  if (!isFinitePoint(measurement.measuredImagePx) || !isFinitePoint(measurement.measuredTargetPx)) {
    issues.push(issue("visible-landmark-coordinate-missing", "unsupported",
      "Visible landmark image and target coordinates must be finite", landmarkIds));
    return { gateStatus: "unsupported", validErrorValues: [], issues, metricsComplete: false };
  }

  const imageDx = measurement.measuredImagePx.x - expected.cssContentBoxPx.x;
  const imageDy = measurement.measuredImagePx.y - expected.cssContentBoxPx.y;
  const targetDx = measurement.measuredTargetPx.x - expected.cssContentBoxPx.x;
  const targetDy = measurement.measuredTargetPx.y - expected.cssContentBoxPx.y;
  const imageErrorXPx = metricError("image-error-x", measurement.imageErrorXPx, imageDx, "Image X error", false);
  const imageErrorYPx = metricError("image-error-y", measurement.imageErrorYPx, imageDy, "Image Y error", false);
  const imageMappingErrorPx = metricError("image-mapping-error", measurement.imageMappingErrorPx,
    Math.hypot(imageDx, imageDy), "Image mapping error");
  const targetErrorXPx = metricError("target-error-x", measurement.targetErrorXPx, targetDx, "Target X error", false);
  const targetErrorYPx = metricError("target-error-y", measurement.targetErrorYPx, targetDy, "Target Y error", false);
  const overlayMappingErrorPx = metricError("overlay-mapping-error", measurement.overlayMappingErrorPx,
    Math.hypot(targetDx, targetDy), "Overlay mapping error");
  const validErrorValues = [imageMappingErrorPx, overlayMappingErrorPx]
    .filter((value): value is number => value !== null);
  let componentMetricsComplete = imageErrorXPx !== null && imageErrorYPx !== null && imageMappingErrorPx !== null &&
    targetErrorXPx !== null && targetErrorYPx !== null && overlayMappingErrorPx !== null;

  if (expected.onGridIntersection) {
    if (!isFinitePoint(measurement.measuredGridIntersectionPx) || !isFinitePoint(measurement.expectedGridIntersectionPx) ||
      !closeEnough(measurement.expectedGridIntersectionPx.x, expected.cssContentBoxPx.x) ||
      !closeEnough(measurement.expectedGridIntersectionPx.y, expected.cssContentBoxPx.y)) {
      issues.push(issue("visible-grid-intersection-missing", "unsupported",
        "Visible grid landmark requires finite measured and expected intersection coordinates", landmarkIds));
      componentMetricsComplete = false;
    } else {
      const gridDx = measurement.measuredGridIntersectionPx.x - expected.cssContentBoxPx.x;
      const gridDy = measurement.measuredGridIntersectionPx.y - expected.cssContentBoxPx.y;
      const gridErrorXPx = metricError("grid-error-x", measurement.gridErrorXPx, gridDx, "Grid X error", false);
      const gridErrorYPx = metricError("grid-error-y", measurement.gridErrorYPx, gridDy, "Grid Y error", false);
      const gridMappingErrorPx = metricError("grid-mapping-error", measurement.gridMappingErrorPx,
        Math.hypot(gridDx, gridDy), "Grid mapping error");
      const gridToLandmarkErrorPx = metricError("grid-to-landmark-error", measurement.gridToLandmarkErrorPx,
        distance(measurement.measuredGridIntersectionPx, measurement.measuredImagePx), "Grid-to-landmark error");
      if (gridErrorXPx !== null && gridErrorYPx !== null && gridMappingErrorPx !== null && gridToLandmarkErrorPx !== null) {
        validErrorValues.push(gridMappingErrorPx, gridToLandmarkErrorPx);
      } else {
        componentMetricsComplete = false;
      }
    }
  } else {
    const gridFieldsAreAbsent = measurement.expectedGridIntersectionPx === null &&
      measurement.measuredGridIntersectionPx === null && measurement.gridErrorXPx === null &&
      measurement.gridErrorYPx === null && measurement.gridMappingErrorPx === null &&
      measurement.gridToLandmarkErrorPx === null;
    if (!gridFieldsAreAbsent) {
      issues.push(issue("unexpected-grid-error-component", "unsupported",
        "Non-grid landmark contains a grid error component", landmarkIds));
      componentMetricsComplete = false;
    }
  }

  return {
    gateStatus: componentMetricsComplete && expectedPointMatches && issues.length === 0 ? "measured" : "unsupported",
    validErrorValues,
    issues,
    metricsComplete: componentMetricsComplete && expectedPointMatches && issues.length === 0,
  };
};

export const evaluateGroundGlassM6bCaptureSpatialConformance = (
  input: GroundGlassM6bSpatialCaptureInput,
): GroundGlassM6bSpatialCaptureResult => {
  const issues: GroundGlassM6bSpatialIssue[] = [];
  const addIssue = (code: string, message: string, severity: GroundGlassM6bSpatialIssue["severity"] = "unsupported") => {
    issues.push(issue(code, severity, message));
  };
  const captureId = hasText(input.captureId) ? input.captureId : "<missing-capture-id>";
  if (!hasText(input.captureId)) addIssue("missing-capture-id", "Capture identity is missing");
  if (!hasText(input.captureName)) addIssue("missing-capture-name", "Capture name is missing");
  if (!input.previewMode) addIssue("missing-preview-mode", "Preview mode is missing");
  if (typeof input.focusLoupeActive !== "boolean") addIssue("missing-focus-loupe-state", "Focus Loupe state is missing");
  if (!input.crop) addIssue("missing-crop", "Capture crop is missing");
  if (input.crop && input.focusLoupeActive !== null && input.crop.active !== input.focusLoupeActive) {
    addIssue("focus-loupe-crop-mismatch", "Focus Loupe state does not match the captured crop active state");
  }
  if (input.crop && (!isFiniteNumber(input.crop.centerU) || !isFiniteNumber(input.crop.centerV) ||
    !isFiniteNumber(input.crop.widthFraction) || !isFiniteNumber(input.crop.heightFraction) ||
    input.crop.widthFraction <= 0 || input.crop.widthFraction > 1 || input.crop.heightFraction <= 0 || input.crop.heightFraction > 1 ||
    input.crop.centerU < input.crop.widthFraction / 2 || input.crop.centerU > 1 - input.crop.widthFraction / 2 ||
    input.crop.centerV < input.crop.heightFraction / 2 || input.crop.centerV > 1 - input.crop.heightFraction / 2)) {
    addIssue("invalid-crop", "Crop must contain finite, normalized center and positive dimensions");
  }
  if (!input.displaySizePx || !isFiniteNumber(input.displaySizePx.widthPx) || !isFiniteNumber(input.displaySizePx.heightPx) ||
    input.displaySizePx.widthPx <= 0 || input.displaySizePx.heightPx <= 0) {
    addIssue("invalid-display-size", "Display content-box dimensions must be positive finite numbers");
  }
  if (!input.internalTargetSizePx || !isFiniteNumber(input.internalTargetSizePx.widthPx) ||
    !isFiniteNumber(input.internalTargetSizePx.heightPx) || input.internalTargetSizePx.widthPx <= 0 ||
    input.internalTargetSizePx.heightPx <= 0) {
    addIssue("invalid-internal-target-size", "Internal target dimensions must be positive finite numbers");
  }
  if (!hasText(input.requestId)) addIssue("missing-request-id", "Accepted frame request identity is missing");
  if (!hasText(input.channelId)) addIssue("missing-channel-id", "Logical channel identity is missing");
  if (!hasText(input.sceneId)) addIssue("missing-scene-id", "Scene identity is missing");
  if (!hasText(input.rendererGenerationId)) addIssue("missing-renderer-generation", "Renderer generation identity is missing");
  if (!isFiniteNumber(input.maximumSpatialErrorPx) || input.maximumSpatialErrorPx !== GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX) {
    addIssue("maximum-threshold-contract-mismatch", `Maximum threshold must remain ${GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX} CSS px`);
  }
  if (!isFiniteNumber(input.maximumSpatialRmsPx) || input.maximumSpatialRmsPx !== GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX) {
    addIssue("rms-threshold-contract-mismatch", `RMS threshold must remain ${GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX} CSS px`);
  }
  if (!isFiniteNumber(input.minimumMeasuredLandmarkCount) || !Number.isInteger(input.minimumMeasuredLandmarkCount) ||
    input.minimumMeasuredLandmarkCount < 1) {
    addIssue("invalid-minimum-landmark-count", "Capture-specific minimum measured landmark count must be a positive integer");
  }
  if (!input.expectedLandmarks || input.expectedLandmarks.length === 0) {
    addIssue("missing-expected-landmarks", "Capture has no expected landmark population");
  }
  if (!input.alignment) addIssue("missing-alignment-result", "Capture has no alignment result");

  if (GROUND_GLASS_M6B_FULL_FILM_CAPTURE_IDS.includes(input.captureId as (typeof GROUND_GLASS_M6B_FULL_FILM_CAPTURE_IDS)[number]) &&
    (input.crop?.active !== false || input.focusLoupeActive !== false)) {
    addIssue("full-film-capture-not-full-film", "Required full-film capture must have the Focus Loupe reset and an inactive crop");
  }
  if (GROUND_GLASS_M6B_LOUPE_CAPTURE_IDS.includes(input.captureId as (typeof GROUND_GLASS_M6B_LOUPE_CAPTURE_IDS)[number]) &&
    (input.crop?.active !== true || input.focusLoupeActive !== true)) {
    addIssue("loupe-capture-not-cropped", "Required Loupe capture must have an active crop and Focus Loupe state");
  }
  if (input.captureId === "m6b-upright-full-film" || input.captureId === "m6b-upright-cropped-loupe") {
    if (input.previewMode !== "upright") addIssue("upright-capture-mode-mismatch", "Required Upright capture was not made in Upright mode");
  } else if (hasText(input.captureId) && input.previewMode !== "raw") {
    addIssue("raw-capture-mode-mismatch", "Required Raw capture was not made in Raw mode");
  }
  if (input.captureId === "m6b-resized-standard-quality") {
    const previous = input.previousInternalTargetSizePx;
    const current = input.internalTargetSizePx;
    if (!previous || !current || !isFiniteNumber(previous.widthPx) || !isFiniteNumber(previous.heightPx) ||
      previous.widthPx === current.widthPx || previous.heightPx === current.heightPx) {
      addIssue("internal-target-resize-unverified", "Resized capture requires changed internal target width and height evidence");
    }
  }

  const expectedLandmarks = input.expectedLandmarks ?? [];
  const expectedIds = expectedLandmarks.map(({ id }) => id);
  if (new Set(expectedIds).size !== expectedIds.length) addIssue("duplicate-expected-landmark-id", "Expected landmark IDs must be unique");
  if (expectedIds.length !== GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.length ||
    GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.some(({ id }) => !expectedIds.includes(id))) {
    addIssue("expected-landmark-population-mismatch", "Every capture must classify the complete 13-landmark fixture population");
  }

  const alignmentMeasurements = input.alignment?.measurements ?? [];
  const measurementCounts = new Map<string, number>();
  for (const measurement of alignmentMeasurements) {
    measurementCounts.set(measurement.id, (measurementCounts.get(measurement.id) ?? 0) + 1);
  }
  const measurementById = new Map(alignmentMeasurements.map((measurement) => [measurement.id, measurement]));
  for (const [id, count] of measurementCounts) {
    if (count > 1) addIssue("duplicate-measurement-id", `Landmark ${id} has ${count} measurements`, "unsupported");
    if (!expectedIds.includes(id)) addIssue("unexpected-measurement-id", `Unexpected landmark measurement ${id}`, "unsupported",);
  }
  if (input.alignment && alignmentMeasurements.length !== expectedLandmarks.length) {
    addIssue("landmark-classification-count-mismatch", "Every expected landmark must have exactly one classification");
  }

  const expectedVisibleLandmarkCount = expectedLandmarks.filter(({ visibleInCrop }) => visibleInCrop).length;
  const errors: number[] = [];
  let measuredLandmarkCount = 0;
  let outsideCurrentCropCount = 0;
  let unsupportedCount = 0;
  let landmarkMetricsComplete = Boolean(input.alignment && input.crop && input.displaySizePx);

  if (input.crop && input.displaySizePx) {
    for (const expected of expectedLandmarks) {
      const measurement = measurementById.get(expected.id);
      const validation = validateLandmarkMeasurement(expected, measurement, input.crop, input.displaySizePx);
      issues.push(...validation.issues);
      errors.push(...validation.validErrorValues);
      if (!validation.metricsComplete) landmarkMetricsComplete = false;
      if (validation.gateStatus === "measured") measuredLandmarkCount += 1;
      else if (validation.gateStatus === "outside-current-crop") outsideCurrentCropCount += 1;
      else unsupportedCount += 1;
    }
  }

  if (expectedVisibleLandmarkCount === 0) addIssue("zero-visible-landmark-population", "A conformance capture must include at least one visible landmark");
  if (measuredLandmarkCount === 0) addIssue("zero-measured-landmarks", "A conformance capture cannot pass with zero measured landmarks");
  if (isFiniteNumber(input.minimumMeasuredLandmarkCount) && measuredLandmarkCount < input.minimumMeasuredLandmarkCount) {
    addIssue("insufficient-measured-landmarks", `Measured ${measuredLandmarkCount}; minimum is ${input.minimumMeasuredLandmarkCount}`);
  }
  if (measuredLandmarkCount !== expectedVisibleLandmarkCount) {
    addIssue("visible-landmark-count-mismatch", `Measured ${measuredLandmarkCount} of ${expectedVisibleLandmarkCount} expected visible landmarks`);
  }
  if (outsideCurrentCropCount !== expectedLandmarks.length - expectedVisibleLandmarkCount) {
    addIssue("outside-crop-count-mismatch", "Outside-crop population is not fully classified");
  }
  if (unsupportedCount !== 0) addIssue("unsupported-landmark-measurement", `${unsupportedCount} required landmark measurements are unsupported`);

  const derivedMaximum = errors.length > 0 ? Math.max(...errors) : null;
  const derivedRms = errors.length > 0
    ? Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length)
    : null;
  const reportedMaximum = input.alignment?.maximumErrorPx ?? null;
  const reportedRms = input.alignment?.rmsErrorPx ?? null;
  if (!isFiniteNumber(reportedMaximum)) {
    addIssue("maximum-error-nonfinite", "maximumErrorPx must be a finite number");
    landmarkMetricsComplete = false;
  } else if (reportedMaximum < 0) {
    addIssue("maximum-error-negative", "maximumErrorPx must be nonnegative");
    landmarkMetricsComplete = false;
  } else if (derivedMaximum === null || !closeEnough(reportedMaximum, derivedMaximum)) {
    addIssue("maximum-error-inconsistent", "maximumErrorPx does not include every required measured error component");
    landmarkMetricsComplete = false;
  }
  if (!isFiniteNumber(reportedRms)) {
    addIssue("rms-error-nonfinite", "rmsErrorPx must be a finite number");
    landmarkMetricsComplete = false;
  } else if (reportedRms < 0) {
    addIssue("rms-error-negative", "rmsErrorPx must be nonnegative");
    landmarkMetricsComplete = false;
  } else if (derivedRms === null || !closeEnough(reportedRms, derivedRms)) {
    addIssue("rms-error-inconsistent", "rmsErrorPx does not include every required measured error component");
    landmarkMetricsComplete = false;
  }

  if (input.alignment) {
    if (input.alignment.measuredLandmarkCount !== measuredLandmarkCount) {
      addIssue("measured-count-inconsistent", "Alignment measuredLandmarkCount disagrees with per-landmark results");
      landmarkMetricsComplete = false;
    }
    if (input.alignment.outsideCurrentCropCount !== outsideCurrentCropCount) {
      addIssue("outside-count-inconsistent", "Alignment outsideCurrentCropCount disagrees with per-landmark results");
      landmarkMetricsComplete = false;
    }
    if (input.alignment.unsupportedCount !== unsupportedCount) {
      addIssue("unsupported-count-inconsistent", "Alignment unsupportedCount disagrees with per-landmark results");
      landmarkMetricsComplete = false;
    }
  }

  if (isFiniteNumber(reportedMaximum) && reportedMaximum > GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX) {
    const affected = alignmentMeasurements.filter((measurement) => [
      measurement.imageMappingErrorPx,
      measurement.overlayMappingErrorPx,
      measurement.gridMappingErrorPx,
      measurement.gridToLandmarkErrorPx,
    ].some((value) => isFiniteNumber(value) && value > GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX)).map(({ id }) => id);
    issues.push(issue("maximum-error-exceeds-threshold", "failure",
      `Maximum spatial error ${reportedMaximum} exceeds ${GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX} CSS px`, affected));
  }
  if (isFiniteNumber(reportedRms) && reportedRms > GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX) {
    issues.push(issue("rms-error-exceeds-threshold", "failure",
      `Spatial RMS ${reportedRms} exceeds ${GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX} CSS px`,
      alignmentMeasurements.filter(({ status }) => status === "measured").map(({ id }) => id)));
  }

  const affectedLandmarkIds = [...new Set(issues.flatMap(({ landmarkIds }) => landmarkIds))];
  const classification: GroundGlassM6bSpatialCaptureClassification = issues.some(({ severity }) => severity === "unsupported")
    ? "unsupported"
    : issues.length > 0 ? "failed" : "passed";
  return {
    captureId,
    captureName: input.captureName,
    previewMode: input.previewMode,
    focusLoupeActive: input.focusLoupeActive,
    crop: input.crop,
    displaySizePx: input.displaySizePx,
    internalTargetSizePx: input.internalTargetSizePx,
    previousInternalTargetSizePx: input.previousInternalTargetSizePx,
    requestId: input.requestId,
    channelId: input.channelId,
    sceneId: input.sceneId,
    rendererGenerationId: input.rendererGenerationId,
    classification,
    maximumErrorPx: isFiniteNumber(reportedMaximum) ? reportedMaximum : null,
    rmsErrorPx: isFiniteNumber(reportedRms) ? reportedRms : null,
    recomputedMaximumErrorPx: derivedMaximum,
    recomputedRmsErrorPx: derivedRms,
    maximumSpatialErrorPx: GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX,
    maximumSpatialRmsPx: GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX,
    expectedLandmarkCount: expectedLandmarks.length,
    expectedVisibleLandmarkCount,
    measuredLandmarkCount,
    outsideCurrentCropCount,
    unsupportedCount,
    errorSampleCount: errors.length,
    spatialErrorSamples: errors,
    metricsComplete: landmarkMetricsComplete && isFiniteNumber(reportedMaximum) && isFiniteNumber(reportedRms),
    affectedLandmarkIds,
    issues,
  };
};

export const evaluateGroundGlassM6bSpatialConformance = (input: Readonly<{
  captures: readonly GroundGlassM6bSpatialCaptureInput[];
  stateSpecificAssertionsPassed: boolean;
}>): GroundGlassM6bSpatialConformanceResult => {
  const perCaptureClassifications = input.captures.map(evaluateGroundGlassM6bCaptureSpatialConformance);
  const counts = new Map<string, number>();
  for (const capture of perCaptureClassifications) counts.set(capture.captureId, (counts.get(capture.captureId) ?? 0) + 1);
  const requiredIds = [...GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS];
  const requiredSet = new Set<string>(requiredIds);
  const missingCaptureIds = requiredIds.filter((captureId) => !counts.has(captureId));
  const duplicateCaptureIds = [...counts.entries()].filter(([, count]) => count !== 1).filter(([id]) => requiredSet.has(id)).map(([id]) => id);
  const unexpectedCaptureIds = [...counts.keys()].filter((captureId) => !requiredSet.has(captureId));
  const inventoryValid = missingCaptureIds.length === 0 && duplicateCaptureIds.length === 0 && unexpectedCaptureIds.length === 0 &&
    perCaptureClassifications.length === requiredIds.length;
  const allCapturesPass = perCaptureClassifications.length === requiredIds.length &&
    perCaptureClassifications.every(({ classification }) => classification === "passed");
  const allRequiredCaptureIdsPresentExactlyOnce = inventoryValid;
  const metricsCanBeAggregated = inventoryValid && perCaptureClassifications.every(({ metricsComplete }) => metricsComplete);
  const maxErrorValues = perCaptureClassifications.map(({ recomputedMaximumErrorPx }) => recomputedMaximumErrorPx)
    .filter((value): value is number => isFiniteNumber(value));
  const sumSquares = perCaptureClassifications.reduce((sum, capture) => {
    if (!capture.metricsComplete) return sum;
    return sum + capture.spatialErrorSamples.reduce((inner, value) => inner + value * value, 0);
  }, 0);
  const errorSampleCount = perCaptureClassifications.reduce((sum, capture) => sum + (capture.metricsComplete ? capture.errorSampleCount : 0), 0);
  const unsupportedMeasurementCount = perCaptureClassifications.reduce((sum, capture) => sum + capture.unsupportedCount, 0);
  const failureReasons = [
    ...missingCaptureIds.map((captureId) => `Missing required capture ${captureId}`),
    ...duplicateCaptureIds.map((captureId) => `Required capture ${captureId} appeared more than once`),
    ...unexpectedCaptureIds.map((captureId) => `Unexpected capture ${captureId} is not in the required inventory`),
    ...perCaptureClassifications.filter(({ classification }) => classification !== "passed")
      .flatMap((capture) => capture.issues.map(({ message }) => `${capture.captureId}: ${message}`)),
    ...(!input.stateSpecificAssertionsPassed ? ["One or more M6B state-transition assertions failed"] : []),
  ];
  const hasMeasurementFailure = perCaptureClassifications.some(({ classification }) => classification === "failed");
  const physicalOverlayDecision = allRequiredCaptureIdsPresentExactlyOnce && allCapturesPass && input.stateSpecificAssertionsPassed
    ? "physical-overlay-conformant" as const
    : hasMeasurementFailure || !input.stateSpecificAssertionsPassed
      ? "physical-overlay-failed" as const
      : "physical-overlay-partial" as const;

  return {
    spatialGateRevision: GROUND_GLASS_M6B_SPATIAL_GATE_REVISION,
    requiredCaptureIds: requiredIds,
    captureCount: perCaptureClassifications.length,
    physicalOverlayConformant: physicalOverlayDecision === "physical-overlay-conformant",
    physicalOverlayDecision,
    evidenceScope: "controlled-calibration-fixture",
    registeredAppPhysicalOverlay: "not-evaluated",
    finalOutputAlpha: "unobservable",
    m6Architecture: "architecture-partially-implemented",
    m6PhotographicQuality: "quality-unqualified",
    stateSpecificAssertionsPassed: input.stateSpecificAssertionsPassed,
    allRequiredCaptureIdsPresentExactlyOnce,
    missingCaptureIds,
    duplicateCaptureIds,
    unexpectedCaptureIds,
    perCaptureClassifications,
    overallMaximumErrorPx: metricsCanBeAggregated && maxErrorValues.length > 0 ? Math.max(...maxErrorValues) : null,
    overallRmsErrorPx: metricsCanBeAggregated && errorSampleCount > 0 ? Math.sqrt(sumSquares / errorSampleCount) : null,
    totalMeasuredLandmarks: inventoryValid ? perCaptureClassifications.reduce((sum, capture) => sum + capture.measuredLandmarkCount, 0) : null,
    totalOutsideCurrentCrop: inventoryValid ? perCaptureClassifications.reduce((sum, capture) => sum + capture.outsideCurrentCropCount, 0) : null,
    totalUnsupported: inventoryValid ? unsupportedMeasurementCount : null,
    missingCaptureCount: missingCaptureIds.length,
    unsupportedMeasurementCount,
    failureReasons,
  };
};
