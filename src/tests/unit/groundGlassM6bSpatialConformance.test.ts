import { describe, expect, it } from "vitest";
import {
  evaluateGroundGlassM6bAlignment,
  GROUND_GLASS_M6B_CALIBRATION_LANDMARKS,
  resolveGroundGlassM6bExpectedLandmarks,
} from "../../render/groundGlassPhysicalOverlayConformance";
import {
  evaluateGroundGlassM6bCaptureSpatialConformance,
  evaluateGroundGlassM6bSpatialConformance,
  GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX,
  GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX,
  GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS,
  type GroundGlassM6bSpatialCaptureInput,
} from "../../render/groundGlassM6bSpatialConformance";
import { CAMERA_CONSTANTS } from "../../utils/constants";
import { FULL_GROUND_GLASS_INSPECTION_WINDOW } from "../../render/groundGlassInspectionWindow";

const displaySizePx = { widthPx: 514, heightPx: 411 } as const;
const initialTargetSizePx = { widthPx: 334, heightPx: 267 } as const;
const resizedTargetSizePx = { widthPx: 437, heightPx: 349 } as const;

const loupeCrop = (centerU = 0.5, centerV = 0.5) => ({
  active: true,
  centerU,
  centerV,
  widthFraction: 0.25,
  heightFraction: 0.25,
});

const expectedFor = (
  crop = FULL_GROUND_GLASS_INSPECTION_WINDOW,
  size = displaySizePx,
  previewMode: "raw" | "upright" = "raw",
) => resolveGroundGlassM6bExpectedLandmarks({
  filmWidthMm: CAMERA_CONSTANTS.filmWidthMm,
  filmHeightMm: CAMERA_CONSTANTS.filmHeightMm,
  gridSquareMm: 10,
  displayWidthPx: size.widthPx,
  displayHeightPx: size.heightPx,
  inspectionWindow: crop,
  previewMode,
});

type MeasurementMutation = (id: string, point: Readonly<{ x: number; y: number }>) => Readonly<{ x: number; y: number }>;

const createAlignment = (
  expected: ReturnType<typeof expectedFor>,
  mutation: Readonly<{
    image?: MeasurementMutation;
    target?: MeasurementMutation;
    grid?: MeasurementMutation;
  }> = {},
) => evaluateGroundGlassM6bAlignment({
  expected,
  measuredImageById: Object.fromEntries(expected.map((landmark) => [landmark.id,
    landmark.visibleInCrop ? mutation.image?.(landmark.id, landmark.cssContentBoxPx) ?? landmark.cssContentBoxPx : null])),
  measuredTargetById: Object.fromEntries(expected.map((landmark) => [landmark.id,
    landmark.visibleInCrop ? mutation.target?.(landmark.id, landmark.cssContentBoxPx) ?? landmark.cssContentBoxPx : null])),
  measuredGridById: Object.fromEntries(expected.map((landmark) => [landmark.id,
    landmark.visibleInCrop && landmark.onGridIntersection
      ? mutation.grid?.(landmark.id, landmark.cssContentBoxPx) ?? landmark.cssContentBoxPx
      : null])),
});

const cropForCapture = (captureId: string) => {
  if (captureId === "m6b-loupe-horizontal-pan") return loupeCrop(0.46988327679467107, 0.5);
  if (captureId === "m6b-loupe-vertical-pan") return loupeCrop(0.46988327679467107, 0.46986884792355726);
  if (captureId === "m6b-loupe-diagonal-pan") return loupeCrop(0.4397665535893422, 0.4924672259031421);
  if (captureId === "m6b-loupe-left-limit") return loupeCrop(0.125, 0.4924672259031421);
  if (captureId === "m6b-loupe-right-limit") return loupeCrop(0.875, 0.4924672259031421);
  if (captureId === "m6b-loupe-top-limit") return loupeCrop(0.875, 0.125);
  if (captureId === "m6b-loupe-bottom-limit" || captureId === "m6b-upright-cropped-loupe") return loupeCrop(0.875, 0.875);
  if (captureId === "m6b-loupe-centered") return loupeCrop();
  return FULL_GROUND_GLASS_INSPECTION_WINDOW;
};

const createCapture = (
  captureId: string,
  overrides: Partial<GroundGlassM6bSpatialCaptureInput> & Readonly<{ mutation?: Parameters<typeof createAlignment>[1] }> = {},
): GroundGlassM6bSpatialCaptureInput => {
  const { mutation, ...captureOverrides } = overrides;
  const crop = captureOverrides.crop ?? cropForCapture(captureId);
  const previewMode = captureOverrides.previewMode ?? (captureId === "m6b-upright-full-film" || captureId === "m6b-upright-cropped-loupe" ? "upright" : "raw");
  const expectedLandmarks = captureOverrides.expectedLandmarks ?? expectedFor(crop, displaySizePx, previewMode);
  const alignment = captureOverrides.alignment === undefined
    ? createAlignment(expectedLandmarks, mutation)
    : captureOverrides.alignment;
  const internalTargetSizePx = captureOverrides.internalTargetSizePx ??
    (captureId === "m6b-resized-standard-quality" ? resizedTargetSizePx : initialTargetSizePx);
  return {
    captureId,
    captureName: captureId,
    previewMode,
    focusLoupeActive: captureOverrides.focusLoupeActive ?? crop.active,
    crop,
    displaySizePx,
    internalTargetSizePx,
    previousInternalTargetSizePx: captureOverrides.previousInternalTargetSizePx ??
      (captureId === "m6b-resized-standard-quality" ? initialTargetSizePx : null),
    requestId: `${captureId}-request-1`,
    channelId: "default",
    sceneId: "architecture-rise",
    rendererGenerationId: "generation-1",
    expectedLandmarks,
    minimumMeasuredLandmarkCount: captureOverrides.minimumMeasuredLandmarkCount ?? expectedLandmarks.filter(({ visibleInCrop }) => visibleInCrop).length,
    maximumSpatialErrorPx: GROUND_GLASS_M6B_MAXIMUM_SPATIAL_ERROR_PX,
    maximumSpatialRmsPx: GROUND_GLASS_M6B_MAXIMUM_SPATIAL_RMS_PX,
    alignment,
    ...captureOverrides,
  };
};

const captureWithTranslation = (
  captureId: string,
  target: "image" | "target" | "grid",
  dx: number,
  dy: number,
  landmarkId = "center",
) => createCapture(captureId, {
  mutation: {
    [target]: ((id: string, point: Readonly<{ x: number; y: number }>) =>
      id === landmarkId ? { x: point.x + dx, y: point.y + dy } : point) satisfies MeasurementMutation,
  },
});

const allValidCaptures = (mutate?: (captureId: string) => GroundGlassM6bSpatialCaptureInput | null) =>
  GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS.map((captureId) => mutate?.(captureId) ?? createCapture(captureId));

describe("M6B per-capture physical spatial conformance", () => {
  it("passes all 14 required captures and computes totals without pooling away per-capture checks", () => {
    const result = evaluateGroundGlassM6bSpatialConformance({
      captures: allValidCaptures(),
      stateSpecificAssertionsPassed: true,
    });
    expect(result.physicalOverlayDecision).toBe("physical-overlay-conformant");
    expect(result.allRequiredCaptureIdsPresentExactlyOnce).toBe(true);
    expect(result.captureCount).toBe(14);
    expect(result.totalMeasuredLandmarks).toBe(77);
    expect(result.totalOutsideCurrentCrop).toBe(105);
    expect(result.totalUnsupported).toBe(0);
    expect(result.overallMaximumErrorPx).toBe(0);
    expect(result.overallRmsErrorPx).toBe(0);
    expect(result.perCaptureClassifications.every(({ classification }) => classification === "passed")).toBe(true);
  });

  it("rejects an individual maximum error above 2 px even when the capture RMS remains below 1.25 px", () => {
    const capture = captureWithTranslation("m6b-raw-full-film", "image", 2.01, 0);
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(capture);
    expect(result.maximumErrorPx).toBeGreaterThan(2);
    expect(result.rmsErrorPx).toBeLessThan(1.25);
    expect(result.classification).toBe("failed");
    expect(result.issues.map(({ code }) => code)).toContain("maximum-error-exceeds-threshold");
    expect(result.affectedLandmarkIds).toContain("center");
  });

  it("rejects RMS above 1.25 px when the maximum is at the 2 px boundary", () => {
    const shiftAll = (_id: string, point: Readonly<{ x: number; y: number }>) => ({ x: point.x + 2, y: point.y });
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(createCapture("m6b-raw-full-film", {
      mutation: { image: shiftAll, target: shiftAll, grid: shiftAll },
    }));
    expect(result.maximumErrorPx).toBe(2);
    expect(result.rmsErrorPx).toBeGreaterThan(1.25);
    expect(result.classification).toBe("failed");
    expect(result.issues.map(({ code }) => code)).toContain("rms-error-exceeds-threshold");
  });

  it("rejects RMS above threshold even when maximum remains within threshold", () => {
    const shiftAll = (_id: string, point: Readonly<{ x: number; y: number }>) => ({ x: point.x + 2, y: point.y });
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(createCapture("m6b-raw-full-film", {
      mutation: { image: shiftAll, target: shiftAll, grid: shiftAll },
    }));
    expect(result.maximumErrorPx).toBeLessThanOrEqual(2);
    expect(result.rmsErrorPx).toBeGreaterThan(1.25);
    expect(result.classification).not.toBe("passed");
  });

  it("rejects maximum above threshold when RMS remains within threshold", () => {
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(captureWithTranslation("m6b-raw-full-film", "image", 3, 0));
    expect(result.maximumErrorPx).toBeGreaterThan(2);
    expect(result.rmsErrorPx).toBeLessThanOrEqual(1.25);
    expect(result.classification).toBe("failed");
  });

  it("accepts exact maximum and RMS thresholds when all measured components are consistent", () => {
    const expected = expectedFor();
    const highErrorIds = new Set(expected.slice(0, 6).map(({ id }) => id));
    const exactRmsLandmarkId = expected[6]?.id;
    if (!exactRmsLandmarkId) throw new Error("Fixture omitted required threshold landmark");
    const translateSelected = (ids: ReadonlySet<string>, dx: number) => (id: string, point: Readonly<{ x: number; y: number }>) =>
      ids.has(id) ? { x: point.x + dx, y: point.y } : point;
    const image = translateSelected(new Set([...highErrorIds, exactRmsLandmarkId]), 2);
    const grid = translateSelected(new Set([...highErrorIds, exactRmsLandmarkId]), 2);
    const target = (id: string, point: Readonly<{ x: number; y: number }>) => highErrorIds.has(id)
      ? { x: point.x + 2, y: point.y }
      : id === exactRmsLandmarkId
        ? { x: point.x + Math.sqrt(1.25), y: point.y }
        : point;
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(createCapture("m6b-raw-full-film", {
      expectedLandmarks: expected,
      mutation: { image, target, grid },
    }));
    expect(result.maximumErrorPx).toBe(2);
    expect(result.rmsErrorPx).toBeCloseTo(1.25, 12);
    expect(result.classification).toBe("passed");
  });

  it.each([
    ["missing maximumErrorPx", { maximumErrorPx: undefined }],
    ["missing rmsErrorPx", { rmsErrorPx: undefined }],
    ["null maximumErrorPx", { maximumErrorPx: null }],
    ["null rmsErrorPx", { rmsErrorPx: null }],
    ["NaN maximumErrorPx", { maximumErrorPx: Number.NaN }],
    ["NaN rmsErrorPx", { rmsErrorPx: Number.NaN }],
    ["Infinity maximumErrorPx", { maximumErrorPx: Number.POSITIVE_INFINITY }],
    ["Infinity rmsErrorPx", { rmsErrorPx: Number.POSITIVE_INFINITY }],
    ["negative maximumErrorPx", { maximumErrorPx: -1 }],
    ["negative rmsErrorPx", { rmsErrorPx: -1 }],
  ] as const)("fails closed for %s", (_name, change) => {
    const valid = createCapture("m6b-raw-full-film");
    const alignment = { ...valid.alignment!, ...change } as typeof valid.alignment;
    const result = evaluateGroundGlassM6bCaptureSpatialConformance({ ...valid, alignment });
    expect(result.classification).not.toBe("passed");
    expect(result.metricsComplete).toBe(false);
  });

  it("fails closed for nonfinite individual point coordinates and error components", () => {
    const valid = createCapture("m6b-raw-full-film");
    const first = valid.alignment!.measurements[0];
    if (!first) throw new Error("Fixture omitted first alignment measurement");
    const alignment = {
      ...valid.alignment!,
      measurements: valid.alignment!.measurements.map((measurement) => measurement.id === first.id
        ? { ...measurement, measuredTargetPx: { x: Number.NaN, y: measurement.expectedTargetPx.y } }
        : measurement),
    };
    const result = evaluateGroundGlassM6bCaptureSpatialConformance({ ...valid, alignment });
    expect(result.classification).toBe("unsupported");
    expect(result.issues.some(({ code }) => code === "visible-landmark-coordinate-missing")).toBe(true);
  });

  it.each([
    "imageErrorXPx",
    "imageErrorYPx",
    "imageMappingErrorPx",
    "targetErrorXPx",
    "targetErrorYPx",
    "overlayMappingErrorPx",
    "gridErrorXPx",
    "gridErrorYPx",
    "gridMappingErrorPx",
    "gridToLandmarkErrorPx",
  ] as const)("fails closed when the %s component is nonfinite", (field) => {
    const valid = createCapture("m6b-raw-full-film");
    const source = field.startsWith("grid")
      ? valid.alignment!.measurements.find(({ expectedGridIntersectionPx }) => expectedGridIntersectionPx !== null)
      : valid.alignment!.measurements[0];
    if (!source) throw new Error(`Fixture omitted measurement for ${field}`);
    const alignment = {
      ...valid.alignment!,
      measurements: valid.alignment!.measurements.map((measurement) => measurement.id === source.id
        ? { ...measurement, [field]: Number.NaN }
        : measurement),
    };
    const result = evaluateGroundGlassM6bCaptureSpatialConformance({ ...valid, alignment });
    expect(result.classification).toBe("unsupported");
    expect(result.metricsComplete).toBe(false);
  });

  it("rejects zero observed landmarks", () => {
    const expected = expectedFor();
    const alignment = evaluateGroundGlassM6bAlignment({
      expected,
      measuredImageById: Object.fromEntries(expected.map(({ id }) => [id, null])),
      measuredTargetById: Object.fromEntries(expected.map(({ id }) => [id, null])),
      measuredGridById: Object.fromEntries(expected.map(({ id }) => [id, null])),
    });
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(createCapture("m6b-raw-full-film", { alignment }));
    expect(result.classification).toBe("unsupported");
    expect(result.measuredLandmarkCount).toBe(0);
    expect(result.issues.map(({ code }) => code)).toContain("zero-measured-landmarks");
  });

  it("rejects a missing visible landmark instead of silently dropping it from aggregate metrics", () => {
    const valid = createCapture("m6b-raw-full-film");
    const alignment = { ...valid.alignment!, measurements: valid.alignment!.measurements.slice(1) };
    const result = evaluateGroundGlassM6bCaptureSpatialConformance({ ...valid, alignment });
    expect(result.classification).toBe("unsupported");
    expect(result.issues.map(({ code }) => code)).toContain("missing-visible-landmark");
    expect(result.metricsComplete).toBe(false);
  });

  it("accepts correctly classified landmarks outside a real Loupe crop", () => {
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(createCapture("m6b-loupe-bottom-limit"));
    expect(result.classification).toBe("passed");
    expect(result.measuredLandmarkCount).toBeGreaterThan(0);
    expect(result.outsideCurrentCropCount).toBeGreaterThan(0);
    expect(result.unsupportedCount).toBe(0);
  });

  it("rejects a visible landmark mislabeled outside the crop", () => {
    const valid = createCapture("m6b-raw-full-film");
    const alignment = {
      ...valid.alignment!,
      measurements: valid.alignment!.measurements.map((measurement, index) => index === 0
        ? { ...measurement, status: "outside-current-crop" as const }
        : measurement),
    };
    const result = evaluateGroundGlassM6bCaptureSpatialConformance({ ...valid, alignment });
    expect(result.classification).toBe("unsupported");
    expect(result.issues.map(({ code }) => code)).toContain("visible-landmark-not-measured");
  });

  it("requires every registered capture exactly once and rejects duplicate or missing IDs", () => {
    const captures = allValidCaptures();
    const duplicate = captures.map((capture, index) => index === 1 ? { ...capture, captureId: captures[0]!.captureId } : capture);
    const duplicateResult = evaluateGroundGlassM6bSpatialConformance({ captures: duplicate, stateSpecificAssertionsPassed: true });
    expect(duplicateResult.physicalOverlayConformant).toBe(false);
    expect(duplicateResult.duplicateCaptureIds).toContain(captures[0]!.captureId);
    expect(duplicateResult.missingCaptureIds).toContain(captures[1]!.captureId);

    const missingResult = evaluateGroundGlassM6bSpatialConformance({ captures: captures.slice(0, -1), stateSpecificAssertionsPassed: true });
    expect(missingResult.physicalOverlayConformant).toBe(false);
    expect(missingResult.missingCaptureIds).toContain(GROUND_GLASS_M6B_REQUIRED_CAPTURE_IDS.at(-1));
    expect(missingResult.overallRmsErrorPx).toBeNull();
  });

  it("rejects correct marker counts with a displaced target overlay", () => {
    const capture = captureWithTranslation("m6b-raw-full-film", "target", 3, 0);
    expect(capture.alignment?.measuredLandmarkCount).toBe(GROUND_GLASS_M6B_CALIBRATION_LANDMARKS.length);
    expect(capture.alignment?.unsupportedCount).toBe(0);
    expect(evaluateGroundGlassM6bCaptureSpatialConformance(capture).classification).toBe("failed");
  });

  it("fails overall when horizontal pan alone introduces 3 px while Raw and centered Loupe pass", () => {
    const captures = allValidCaptures((captureId) => captureId === "m6b-loupe-horizontal-pan"
      ? captureWithTranslation(captureId, "target", 3, 0)
      : null);
    const result = evaluateGroundGlassM6bSpatialConformance({ captures, stateSpecificAssertionsPassed: true });
    expect(result.perCaptureClassifications.find(({ captureId }) => captureId === "m6b-raw-full-film")?.classification).toBe("passed");
    expect(result.perCaptureClassifications.find(({ captureId }) => captureId === "m6b-loupe-centered")?.classification).toBe("passed");
    expect(result.perCaptureClassifications.find(({ captureId }) => captureId === "m6b-loupe-horizontal-pan")?.classification).toBe("failed");
    expect(result.physicalOverlayConformant).toBe(false);
  });

  it("fails vertical pan displacement", () => {
    expect(evaluateGroundGlassM6bCaptureSpatialConformance(
      captureWithTranslation("m6b-loupe-vertical-pan", "image", 0, 3),
    ).classification).toBe("failed");
  });

  it("detects diagonal pan displacement by Euclidean maximum error without axis cancellation", () => {
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(
      captureWithTranslation("m6b-loupe-diagonal-pan", "target", 3, -3),
    );
    expect(result.maximumErrorPx).toBeCloseTo(Math.hypot(3, 3), 12);
    expect(result.classification).toBe("failed");
  });

  it("fails the actual resized target capture when overlay geometry is stale", () => {
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(
      captureWithTranslation("m6b-resized-standard-quality", "target", 3, 0),
    );
    expect(result.previousInternalTargetSizePx).toEqual(initialTargetSizePx);
    expect(result.internalTargetSizePx).toEqual(resizedTargetSizePx);
    expect(result.issues.map(({ code }) => code)).toContain("maximum-error-exceeds-threshold");
    expect(result.classification).toBe("failed");
  });

  it("fails crop reset when overlay measurements still use the prior Loupe window", () => {
    const fullExpected = expectedFor();
    const staleCrop = loupeCrop(0.875, 0.875);
    const staleExpected = expectedFor(staleCrop);
    const staleById = new Map(staleExpected.map((landmark) => [landmark.id,
      landmark.visibleInCrop ? landmark.cssContentBoxPx : null]));
    const alignment = evaluateGroundGlassM6bAlignment({
      expected: fullExpected,
      measuredImageById: Object.fromEntries(fullExpected.map(({ id, cssContentBoxPx }) => [id, cssContentBoxPx])),
      measuredTargetById: Object.fromEntries(fullExpected.map(({ id }) => [id, staleById.get(id) ?? null])),
      measuredGridById: Object.fromEntries(fullExpected.map(({ id, visibleInCrop, onGridIntersection, cssContentBoxPx }) => [id,
        visibleInCrop && onGridIntersection ? cssContentBoxPx : null])),
    });
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(createCapture("m6b-loupe-reset-full-film", { alignment }));
    expect(result.classification).toBe("unsupported");
    expect(result.unsupportedCount).toBeGreaterThan(0);
    expect(result.issues.map(({ code }) => code)).toContain("visible-landmark-not-measured");
  });

  it("fails Raw round-trip when the returned overlay keeps Upright vertical orientation", () => {
    const expected = expectedFor();
    const upright = expectedFor(FULL_GROUND_GLASS_INSPECTION_WINDOW, displaySizePx, "upright");
    const uprightById = new Map(upright.map(({ id, cssContentBoxPx }) => [id, cssContentBoxPx]));
    const alignment = evaluateGroundGlassM6bAlignment({
      expected,
      measuredImageById: Object.fromEntries(expected.map(({ id, cssContentBoxPx }) => [id, cssContentBoxPx])),
      measuredTargetById: Object.fromEntries(expected.map(({ id }) => [id, uprightById.get(id) ?? null])),
      measuredGridById: Object.fromEntries(expected.map(({ id, onGridIntersection, cssContentBoxPx }) => [id,
        onGridIntersection ? cssContentBoxPx : null])),
    });
    const result = evaluateGroundGlassM6bCaptureSpatialConformance(createCapture("m6b-raw-round-trip", { alignment }));
    expect(result.maximumErrorPx).toBeGreaterThan(2);
    expect(result.classification).toBe("failed");
  });

  it("does not let a missing or failing capture disappear from aggregate conformance", () => {
    const captures = allValidCaptures().slice(0, -1);
    const missingResult = evaluateGroundGlassM6bSpatialConformance({ captures, stateSpecificAssertionsPassed: true });
    expect(missingResult.physicalOverlayConformant).toBe(false);
    expect(missingResult.missingCaptureCount).toBe(1);

    const failingCaptures = allValidCaptures((captureId) => captureId === "m6b-loupe-horizontal-pan"
      ? captureWithTranslation(captureId, "target", 3, 0)
      : null);
    const failingResult = evaluateGroundGlassM6bSpatialConformance({ captures: failingCaptures, stateSpecificAssertionsPassed: true });
    expect(failingResult.overallRmsErrorPx).toBeLessThan(1.25);
    expect(failingResult.physicalOverlayConformant).toBe(false);
    expect(failingResult.physicalOverlayDecision).toBe("physical-overlay-failed");
  });

  it("keeps controlled-fixture spatial evidence separate from registered-app qualification", () => {
    const result = evaluateGroundGlassM6bSpatialConformance({ captures: allValidCaptures(), stateSpecificAssertionsPassed: true });
    expect(result.physicalOverlayDecision).toBe("physical-overlay-conformant");
    expect(result.evidenceScope).toBe("controlled-calibration-fixture");
    expect(result.registeredAppPhysicalOverlay).toBe("not-evaluated");
  });

  it("does not promote a spatial pass into final-output alpha conformance", () => {
    const result = evaluateGroundGlassM6bSpatialConformance({ captures: allValidCaptures(), stateSpecificAssertionsPassed: true });
    expect(result.physicalOverlayConformant).toBe(true);
    expect(result.finalOutputAlpha).toBe("unobservable");
  });

  it("does not promote a spatial pass into M5 photographic quality", () => {
    const result = evaluateGroundGlassM6bSpatialConformance({ captures: allValidCaptures(), stateSpecificAssertionsPassed: true });
    expect(result.physicalOverlayConformant).toBe(true);
    expect(result.m6PhotographicQuality).toBe("quality-unqualified");
  });

  it("fails the report gate when an independent required state assertion fails", () => {
    const result = evaluateGroundGlassM6bSpatialConformance({ captures: allValidCaptures(), stateSpecificAssertionsPassed: false });
    expect(result.physicalOverlayDecision).toBe("physical-overlay-failed");
    expect(result.physicalOverlayConformant).toBe(false);
  });
});
