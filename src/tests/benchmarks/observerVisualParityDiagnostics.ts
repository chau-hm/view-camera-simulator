import {
  comparePixelRegions,
  observerBackendMismatches,
  type DecodedPng,
  type ImageDifferenceSummary,
  type MountedObserverEvidence,
  type PixelRegion,
} from "./observerBackendBenchmark";

export type AdapterAvailability =
  | "pending"
  | "available"
  | "unavailable"
  | "api-absent"
  | "request-rejected"
  | "timed-out"
  | "not-requested"
  | string
  | null;

export type AdapterWaitOptions = Readonly<{
  timeoutMs?: number;
  pollIntervalMs?: number;
  now?: () => number;
  wait?: (milliseconds: number) => Promise<void>;
}>;

const terminalAdapterStates = new Set([
  "unavailable",
  "api-absent",
  "request-rejected",
  "timed-out",
  "not-requested",
]);

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export const waitForNativeAdapterAvailability = async (
  readAvailability: () => Promise<AdapterAvailability>,
  options: AdapterWaitOptions = {},
): Promise<void> => {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const pollIntervalMs = options.pollIntervalMs ?? 100;
  const now = options.now ?? Date.now;
  const wait = options.wait ?? delay;
  const startedAt = now();

  while (true) {
    const availability = await readAvailability();
    if (availability === "available") return;
    if (availability && terminalAdapterStates.has(availability)) {
      throw new Error(`WebGPU adapter diagnostic ended as ${availability}`);
    }

    const remainingMs = timeoutMs - (now() - startedAt);
    if (remainingMs <= 0) {
      throw new Error(`Timed out waiting for WebGPU adapter availability (last status: ${availability ?? "unknown"})`);
    }
    await wait(Math.min(pollIntervalMs, remainingMs));
  }
};

const nativeMountIdentityAttributes = [
  "data-observer-renderer-status",
  "data-observer-renderer-generation",
  "data-observer-renderer-request",
  "data-observer-renderer-family",
  "data-observer-execution-backend",
  "data-observer-application-fallback",
  "data-observer-webgpu-initialization-attempts",
  "data-observer-renderer-failure-stage",
] as const;

export type NativeObserverQualification = Readonly<{
  initial: MountedObserverEvidence;
  final: MountedObserverEvidence;
  adapterWaitError: string | null;
  mountIdentityMismatches: readonly string[];
  backendMismatches: readonly string[];
  mismatches: readonly string[];
}>;

export const readNativeObserverAfterAdapterProbe = async (
  readEvidence: () => Promise<MountedObserverEvidence>,
  waitForAdapter: () => Promise<void>,
): Promise<NativeObserverQualification> => {
  const initial = await readEvidence();
  let adapterWaitError: string | null = null;
  try {
    await waitForAdapter();
  } catch (error) {
    adapterWaitError = error instanceof Error ? error.message : String(error);
  }
  const final = await readEvidence();
  const mountIdentityMismatches = nativeMountIdentityAttributes.flatMap((attribute) =>
    initial[attribute] === final[attribute]
      ? []
      : [`mounted renderer identity changed while awaiting adapter evidence: ${attribute}`],
  );
  const backendMismatches = observerBackendMismatches(final, "native-webgpu");
  const mismatches = [
    ...(adapterWaitError ? [`adapter availability was not established: ${adapterWaitError}`] : []),
    ...mountIdentityMismatches,
    ...backendMismatches,
  ];
  return { initial, final, adapterWaitError, mountIdentityMismatches, backendMismatches, mismatches };
};

export type OverlayResponseMetric = Readonly<{
  region: PixelRegion | null;
  activePixelUnion: number;
  activePixelIntersection: number;
  webglActivePixels: number;
  webgpuActivePixels: number;
  intersectionOverUnion: number;
  meanAbsoluteResponseDifference: number;
  meanWebglResponseRgb?: readonly [number, number, number];
  meanWebgpuResponseRgb?: readonly [number, number, number];
  measurementError?: string;
}>;

export type OverlayResponseState = Readonly<{
  wholeCanvas?: OverlayResponseMetric | null;
  subjectRoi?: OverlayResponseMetric | null;
  backgroundRegions?: Readonly<Record<string, OverlayResponseMetric | null | undefined>>;
}>;

export type BackgroundReferenceEvidence = Readonly<{
  eligible: boolean;
  reason?: string;
  pixelCount: number | null;
  baselineDifference: ImageDifferenceSummary | null;
}>;

export type CompositedStateEvidence = Readonly<{
  wholeCanvas: ImageDifferenceSummary | null;
  subjectRoi: ImageDifferenceSummary | null;
  backgroundRegions: Readonly<Record<string, Readonly<{
    eligible: boolean;
    reason?: string;
    difference: ImageDifferenceSummary | null;
  }>>>;
}>;

export const compareBaselineAndCompositedRegion = (
  baselineWebgl: DecodedPng,
  baselineWebgpu: DecodedPng,
  stateWebgl: DecodedPng,
  stateWebgpu: DecodedPng,
  region: PixelRegion,
): Readonly<{
  baselineDifference: ImageDifferenceSummary | null;
  compositedDifference: ImageDifferenceSummary | null;
}> => {
  const compare = (webgl: DecodedPng, webgpu: DecodedPng): ImageDifferenceSummary | null => {
    try {
      return comparePixelRegions(webgl, webgpu, region, 4);
    } catch {
      return null;
    }
  };
  return {
    baselineDifference: compare(baselineWebgl, baselineWebgpu),
    compositedDifference: compare(stateWebgl, stateWebgpu),
  };
};

export type VisualParityAcceptanceInput = Readonly<{
  baselineBackgroundRegions: Readonly<Record<string, BackgroundReferenceEvidence>>;
  compositedStates: Readonly<Record<string, CompositedStateEvidence>>;
  overlayContribution: Readonly<Record<string, OverlayResponseState>>;
  subjectEvidence: Readonly<Record<string, Readonly<{
    meaningful: boolean;
    sampleCount: number | null;
    distinctColorBuckets: number | null;
    luminanceStandardDeviation: number | null;
  }>>>;
  overlayGeometry: Readonly<Record<string, Readonly<{
    focusVertices: number;
    nearDofVertices: number;
    farDofVertices: number;
  }>>>;
  restoredNoOverlay: Readonly<Record<string, ImageDifferenceSummary | null>>;
  consistency: Readonly<Record<string, boolean>>;
}>;

export type VisualParityCriterion = Readonly<{
  id: string;
  status: "pass" | "fail" | "not-applicable";
  measured: number | boolean | null;
  threshold: string;
  reason: string;
}>;

export type VisualParityAcceptance = Readonly<{
  status: "pass" | "fail";
  criteria: readonly VisualParityCriterion[];
  failures: readonly VisualParityCriterion[];
  nonApplicable: readonly VisualParityCriterion[];
  thresholds: Readonly<Record<string, unknown>>;
}>;

const thresholds = {
  minimumSharedBaselineBackgroundRegions: 2,
  maximumBaselineBackgroundMeanAbsoluteRgbDifference: 4,
  maximumCompositedWholeCanvasMeanAbsoluteRgbDifference: 16,
  maximumCompositedFacadeMeanAbsoluteRgbDifference: 8,
  maximumCompositedBackgroundMeanAbsoluteRgbDifference: 10,
  wholeCanvasMinimumPixelsPerBackend: 250,
  wholeCanvasMinimumUnionPixels: 500,
  facadeMinimumPixelsPerBackend: 100,
  facadeMinimumUnionPixels: 200,
  backgroundMinimumPixelsPerBackend: 100,
  backgroundMinimumUnionPixels: 200,
  minimumMaskIntersectionOverUnionExclusive: 0.7,
  maximumWholeCanvasOverlayResponseDifference: 10,
  maximumFacadeOverlayResponseDifference: 8,
  maximumBackgroundOverlayResponseDifference: 6,
  maximumRestorationMeanAbsoluteRgbDifference: 1,
  maximumRestorationChangedPixelFraction: 0.01,
} as const;

const requiredBackgroundOverlayRegions: Readonly<Record<string, readonly string[]>> = {
  focusOnly: ["topLeft"],
  dofOnly: ["topLeft", "topRight"],
  combined: ["topLeft", "topRight"],
};

const validRegion = (region: PixelRegion | null | undefined): region is PixelRegion => Boolean(
  region &&
  [region.left, region.top, region.right, region.bottom].every(Number.isFinite) &&
  region.left >= 0 && region.top >= 0 &&
  region.right > region.left && region.bottom > region.top,
);

const finiteDifference = (difference: ImageDifferenceSummary | null | undefined): boolean => Boolean(
  difference &&
  Number.isFinite(difference.meanAbsoluteRgbDifference) &&
  difference.meanAbsoluteRgbDifference >= 0 &&
  Number.isInteger(difference.changedPixelCount) &&
  difference.changedPixelCount >= 0 &&
  Number.isFinite(difference.changedPixelFraction) &&
  difference.changedPixelFraction >= 0 &&
  difference.changedPixelFraction <= 1 &&
  Number.isFinite(difference.meanSignedLuminanceDifference),
);

const responseMetricError = (metric: OverlayResponseMetric): string | null => {
  if (metric.measurementError) return metric.measurementError;
  if (!validRegion(metric.region)) return "region is missing, invalid, or has no pixels";
  const counts = [
    metric.activePixelUnion,
    metric.activePixelIntersection,
    metric.webglActivePixels,
    metric.webgpuActivePixels,
  ];
  if (!counts.every((value) => Number.isInteger(value) && value >= 0)) {
    return "overlay response contains missing or invalid active-pixel counts";
  }
  if (
    metric.activePixelIntersection > Math.min(metric.webglActivePixels, metric.webgpuActivePixels) ||
    metric.activePixelUnion !== metric.webglActivePixels + metric.webgpuActivePixels - metric.activePixelIntersection
  ) return "overlay response active-pixel masks are internally inconsistent";
  const regionPixelArea = Math.max(0, Math.ceil(metric.region.bottom) - Math.floor(metric.region.top)) *
    Math.max(0, Math.ceil(metric.region.right) - Math.floor(metric.region.left));
  if (metric.activePixelUnion > regionPixelArea) return "overlay response pixel count exceeds its measured region";
  if (!Number.isFinite(metric.intersectionOverUnion) || metric.intersectionOverUnion < 0 || metric.intersectionOverUnion > 1) {
    return "overlay response mask intersection-over-union is invalid";
  }
  const expectedIou = metric.activePixelUnion > 0
    ? metric.activePixelIntersection / metric.activePixelUnion
    : 0;
  if (Math.abs(metric.intersectionOverUnion - expectedIou) > 1e-6) {
    return "overlay response mask intersection-over-union does not match its pixel counts";
  }
  if (!Number.isFinite(metric.meanAbsoluteResponseDifference) || metric.meanAbsoluteResponseDifference < 0) {
    return "overlay response difference is missing or invalid";
  }
  return null;
};

export const evaluateVisualParityAcceptance = (
  input: VisualParityAcceptanceInput,
): VisualParityAcceptance => {
  const criteria: VisualParityCriterion[] = [];
  const add = (
    id: string,
    status: VisualParityCriterion["status"],
    measured: VisualParityCriterion["measured"],
    threshold: string,
    reason: string,
  ) => criteria.push({ id, status, measured, threshold, reason });
  const addDifference = (
    id: string,
    difference: ImageDifferenceSummary | null | undefined,
    maximum: number,
    label: string,
  ) => {
    if (!difference || !finiteDifference(difference)) {
      add(id, "fail", difference?.meanAbsoluteRgbDifference ?? null, `mean absolute RGB difference ≤ ${maximum}`, "pixel comparison evidence is missing or invalid");
      return;
    }
    const value = difference.meanAbsoluteRgbDifference;
    add(id, value <= maximum ? "pass" : "fail", value, `mean absolute RGB difference ≤ ${maximum}`,
      value <= maximum ? `${label} is within tolerance` : `${label} exceeds tolerance`);
  };

  const baselineEligibleCount = Object.values(input.baselineBackgroundRegions)
    .filter((region) => region.eligible && region.pixelCount !== null && region.pixelCount > 0).length;
  add(
    "baseline-background:shared-reference-count",
    baselineEligibleCount >= thresholds.minimumSharedBaselineBackgroundRegions ? "pass" : "fail",
    baselineEligibleCount,
    `at least ${thresholds.minimumSharedBaselineBackgroundRegions} shared stable regions`,
    baselineEligibleCount >= thresholds.minimumSharedBaselineBackgroundRegions
      ? "enough subject-free regions are stable in both baseline captures"
      : "too few valid shared subject-free baseline regions",
  );
  for (const [name, region] of Object.entries(input.baselineBackgroundRegions)) {
    const id = `baseline-background:${name}`;
    if (!region.eligible) {
      add(id, "not-applicable", null, `mean absolute RGB difference ≤ ${thresholds.maximumBaselineBackgroundMeanAbsoluteRgbDifference}`,
        region.reason ?? "region was not a stable clean reference in both backends");
      continue;
    }
    if (region.pixelCount === null || region.pixelCount <= 0) {
      add(id, "fail", region.pixelCount, "valid non-empty pixel region", "baseline reference region is empty or unavailable");
      continue;
    }
    addDifference(id, region.baselineDifference, thresholds.maximumBaselineBackgroundMeanAbsoluteRgbDifference,
      "clear-scene background parity");
  }
  for (const requiredName of ["topLeft", "topRight"]) {
    if (input.baselineBackgroundRegions[requiredName] === undefined) {
      add(`baseline-background:${requiredName}`, "fail", null, "baseline reference measurement", "expected background ROI evidence is missing");
    }
  }

  for (const [stateName, state] of Object.entries(input.compositedStates)) {
    addDifference(`composited:${stateName}:whole-canvas`, state.wholeCanvas,
      thresholds.maximumCompositedWholeCanvasMeanAbsoluteRgbDifference, "whole-canvas composited parity");
    addDifference(`composited:${stateName}:facade`, state.subjectRoi,
      thresholds.maximumCompositedFacadeMeanAbsoluteRgbDifference, "façade composited parity");
    for (const [regionName, region] of Object.entries(state.backgroundRegions)) {
      const id = `composited:${stateName}:background:${regionName}`;
      if (!region.eligible) {
        add(id, "not-applicable", null,
          `mean absolute RGB difference ≤ ${thresholds.maximumCompositedBackgroundMeanAbsoluteRgbDifference}`,
          region.reason ?? "no shared stable clean reference region is available");
      } else {
        addDifference(id, region.difference, thresholds.maximumCompositedBackgroundMeanAbsoluteRgbDifference,
          "state-composited background parity");
      }
    }
    for (const requiredName of ["topLeft", "topRight"]) {
      if (state.backgroundRegions[requiredName] === undefined) {
        const eligible = input.baselineBackgroundRegions[requiredName]?.eligible === true;
        add(`composited:${stateName}:background:${requiredName}`, eligible ? "fail" : "not-applicable", null,
          `mean absolute RGB difference ≤ ${thresholds.maximumCompositedBackgroundMeanAbsoluteRgbDifference}`,
          eligible ? "required state-composited background comparison is missing" : "no shared stable clean reference region is available");
      }
    }
  }
  for (const requiredStateName of ["no-overlays", "focus-plane-only", "dof-planes-only", "combined-overlays"]) {
    if (input.compositedStates[requiredStateName] === undefined) {
      add(`composited:${requiredStateName}:whole-canvas`, "fail", null, "valid selected-state image comparison", "required composited state is missing");
      add(`composited:${requiredStateName}:facade`, "fail", null, "valid selected-state façade comparison", "required composited state is missing");
      for (const regionName of ["topLeft", "topRight"]) {
        const eligible = input.baselineBackgroundRegions[regionName]?.eligible === true;
        add(`composited:${requiredStateName}:background:${regionName}`, eligible ? "fail" : "not-applicable", null,
          `mean absolute RGB difference ≤ ${thresholds.maximumCompositedBackgroundMeanAbsoluteRgbDifference}`,
          eligible ? "required state-composited background comparison is missing" : "no shared stable clean reference region is available");
      }
    }
  }

  const overlayThresholds = {
    wholeCanvas: {
      minimumPixelsPerBackend: thresholds.wholeCanvasMinimumPixelsPerBackend,
      minimumUnionPixels: thresholds.wholeCanvasMinimumUnionPixels,
      maximumResponseDifference: thresholds.maximumWholeCanvasOverlayResponseDifference,
    },
    subjectRoi: {
      minimumPixelsPerBackend: thresholds.facadeMinimumPixelsPerBackend,
      minimumUnionPixels: thresholds.facadeMinimumUnionPixels,
      maximumResponseDifference: thresholds.maximumFacadeOverlayResponseDifference,
    },
    background: {
      minimumPixelsPerBackend: thresholds.backgroundMinimumPixelsPerBackend,
      minimumUnionPixels: thresholds.backgroundMinimumUnionPixels,
      maximumResponseDifference: thresholds.maximumBackgroundOverlayResponseDifference,
    },
  } as const;
  const evaluateOverlayRegion = (
    stateName: string,
    regionName: "wholeCanvas" | "subjectRoi" | `background:${string}`,
    metric: OverlayResponseMetric | null | undefined,
    required: boolean,
  ) => {
    const idPrefix = `overlay:${stateName}:${regionName}`;
    if (!metric) {
      const status = required ? "fail" : "fail";
      const reason = required
        ? "required overlay evidence is missing"
        : "baseline-clean background region has no overlay measurement evidence";
      add(`${idPrefix}:evidence`, status, null, "valid measured region and response", reason);
      add(`${idPrefix}:participation`, "fail", null, "required contribution measured in both backends", reason);
      add(`${idPrefix}:mask-alignment`, "fail", null, `IoU > ${thresholds.minimumMaskIntersectionOverUnionExclusive}`, reason);
      add(`${idPrefix}:response-difference`, "fail", null, `mean absolute RGB response difference ≤ ${overlayThresholds[regionName === "wholeCanvas" ? "wholeCanvas" : regionName === "subjectRoi" ? "subjectRoi" : "background"].maximumResponseDifference}`, reason);
      return;
    }
    const invalidReason = responseMetricError(metric);
    if (invalidReason) {
      add(`${idPrefix}:evidence`, "fail", null, "valid measured region and response", invalidReason);
      add(`${idPrefix}:participation`, "fail", metric.activePixelUnion, "valid overlay contribution", invalidReason);
      add(`${idPrefix}:mask-alignment`, "fail", metric.intersectionOverUnion, `IoU > ${thresholds.minimumMaskIntersectionOverUnionExclusive}`, invalidReason);
      const maximum = overlayThresholds[regionName === "wholeCanvas" ? "wholeCanvas" : regionName === "subjectRoi" ? "subjectRoi" : "background"].maximumResponseDifference;
      add(`${idPrefix}:response-difference`, "fail", metric.meanAbsoluteResponseDifference, `mean absolute RGB response difference ≤ ${maximum}`, invalidReason);
      return;
    }
    add(`${idPrefix}:evidence`, "pass", metric.activePixelUnion, "valid measured region and response", "region and response evidence is finite and internally consistent");

    const bothInactive = metric.webglActivePixels === 0 && metric.webgpuActivePixels === 0 && metric.activePixelUnion === 0;
    if (!required && bothInactive) {
      add(`${idPrefix}:participation`, "not-applicable", 0, "conditional background contribution", "no material overlay contribution was measured in this background region");
      add(`${idPrefix}:mask-alignment`, "not-applicable", null, `IoU > ${thresholds.minimumMaskIntersectionOverUnionExclusive}`, "there are no changed pixels to align");
      add(`${idPrefix}:response-difference`, "not-applicable", null, "applicable only when overlay contributes pixels", "there is no overlay response in this region");
      return;
    }

    const selectedThreshold = overlayThresholds[
      regionName === "wholeCanvas" ? "wholeCanvas" : regionName === "subjectRoi" ? "subjectRoi" : "background"
    ];
    const participationPass = metric.webglActivePixels >= selectedThreshold.minimumPixelsPerBackend &&
      metric.webgpuActivePixels >= selectedThreshold.minimumPixelsPerBackend &&
      metric.activePixelUnion >= selectedThreshold.minimumUnionPixels;
    add(
      `${idPrefix}:participation`,
      participationPass ? "pass" : "fail",
      metric.activePixelUnion,
      `each backend ≥ ${selectedThreshold.minimumPixelsPerBackend} active pixels; union ≥ ${selectedThreshold.minimumUnionPixels}`,
      participationPass
        ? "overlay contributed a measurable number of pixels in both backends"
        : required && bothInactive
          ? "required teaching region has no overlay contribution"
          : "overlay contribution is absent from one backend or too small to measure reliably",
    );
    const maskPass = metric.intersectionOverUnion > thresholds.minimumMaskIntersectionOverUnionExclusive;
    add(
      `${idPrefix}:mask-alignment`,
      maskPass ? "pass" : "fail",
      metric.intersectionOverUnion,
      `IoU > ${thresholds.minimumMaskIntersectionOverUnionExclusive}`,
      maskPass ? "changed-pixel masks are spatially aligned" : "changed-pixel masks do not align sufficiently",
    );
    const responsePass = metric.meanAbsoluteResponseDifference <= selectedThreshold.maximumResponseDifference;
    add(
      `${idPrefix}:response-difference`,
      responsePass ? "pass" : "fail",
      metric.meanAbsoluteResponseDifference,
      `mean absolute RGB response difference ≤ ${selectedThreshold.maximumResponseDifference}`,
      responsePass ? "incremental overlay response is within tolerance" : "incremental overlay response exceeds tolerance",
    );
  };

  for (const [stateName, state] of Object.entries(input.overlayContribution)) {
    evaluateOverlayRegion(stateName, "wholeCanvas", state.wholeCanvas, true);
    evaluateOverlayRegion(stateName, "subjectRoi", state.subjectRoi, true);
    for (const [regionName, metric] of Object.entries(state.backgroundRegions ?? {})) {
      const baselineReference = input.baselineBackgroundRegions[regionName];
      if (!baselineReference?.eligible) {
        add(`overlay:${stateName}:background:${regionName}:participation`, "not-applicable", null,
          "requires a shared clean background reference",
          baselineReference?.reason ?? "no shared stable clean reference region is available");
        continue;
      }
      const participationRequired = requiredBackgroundOverlayRegions[stateName]?.includes(regionName) ?? false;
      evaluateOverlayRegion(stateName, `background:${regionName}`, metric, participationRequired);
    }
    for (const requiredBackgroundName of Object.keys(input.baselineBackgroundRegions)) {
      if (state.backgroundRegions?.[requiredBackgroundName] === undefined) {
        evaluateOverlayRegion(stateName, `background:${requiredBackgroundName}`, null, false);
      }
    }
  }
  for (const requiredStateName of ["focusOnly", "dofOnly", "combined"]) {
    if (input.overlayContribution[requiredStateName] === undefined) {
      evaluateOverlayRegion(requiredStateName, "wholeCanvas", null, true);
      evaluateOverlayRegion(requiredStateName, "subjectRoi", null, true);
      for (const regionName of ["topLeft", "topRight"]) {
        if (input.baselineBackgroundRegions[regionName]?.eligible) {
          const participationRequired = requiredBackgroundOverlayRegions[requiredStateName]?.includes(regionName) ?? false;
          evaluateOverlayRegion(requiredStateName, `background:${regionName}`, null, participationRequired);
        }
      }
    }
  }

  for (const backend of ["webgl", "webgpu"]) {
    const evidence = input.subjectEvidence[backend];
    if (!evidence) {
      add(`subject:${backend}:façade-rendered-content`, "fail", null,
        "meaningful façade pixels: ≥500 samples, >24 color buckets, luminance deviation >6",
        "subject-rendering evidence is missing for this backend");
      continue;
    }
    add(
      `subject:${backend}:façade-rendered-content`,
      evidence.meaningful && Number.isInteger(evidence.sampleCount) && evidence.sampleCount! >= 500 &&
        Number.isInteger(evidence.distinctColorBuckets) && evidence.distinctColorBuckets! > 24 &&
        Number.isFinite(evidence.luminanceStandardDeviation) && evidence.luminanceStandardDeviation! > 6 ? "pass" : "fail",
      evidence.sampleCount,
      "meaningful façade pixels: ≥500 samples, >24 color buckets, luminance deviation >6",
      evidence.meaningful && Number.isInteger(evidence.sampleCount) && evidence.sampleCount! >= 500 &&
        Number.isInteger(evidence.distinctColorBuckets) && evidence.distinctColorBuckets! > 24 &&
        Number.isFinite(evidence.luminanceStandardDeviation) && evidence.luminanceStandardDeviation! > 6
        ? "the actual projected Architecture Rise façade contains varied visible pixels"
        : "the projected façade evidence is absent, invalid, or lacks meaningful rendered subject pixels",
    );
  }

  for (const backend of ["webgl", "webgpu"]) {
    const geometry = input.overlayGeometry[backend];
    if (!geometry) {
      for (const name of ["focusPlane", "nearDofPlane", "farDofPlane"]) {
        add(`geometry:${backend}:${name}`, "fail", null,
          "at least one rendered source vertex", "overlay geometry evidence is missing for this backend");
      }
      continue;
    }
    for (const [name, count] of Object.entries({
      focusPlane: geometry.focusVertices,
      nearDofPlane: geometry.nearDofVertices,
      farDofPlane: geometry.farDofVertices,
    })) {
      const valid = Number.isInteger(count) && count > 0;
      add(`geometry:${backend}:${name}`, valid ? "pass" : "fail", count,
        "at least one rendered source vertex", valid ? "overlay geometry is registered" : "overlay geometry evidence is missing");
    }
  }

  for (const backend of ["webgl", "webgpu"]) {
    const difference = input.restoredNoOverlay[backend];
    if (!difference || !finiteDifference(difference)) {
      add(`restoration:${backend}:evidence`, "fail", null, "valid restored image comparison", "restoration evidence is missing or invalid");
      continue;
    }
    const meanPass = difference.meanAbsoluteRgbDifference <= thresholds.maximumRestorationMeanAbsoluteRgbDifference;
    const changedPass = difference.changedPixelFraction <= thresholds.maximumRestorationChangedPixelFraction;
    add(`restoration:${backend}:mean-difference`, meanPass ? "pass" : "fail", difference.meanAbsoluteRgbDifference,
      `mean absolute RGB difference ≤ ${thresholds.maximumRestorationMeanAbsoluteRgbDifference}`,
      meanPass ? "the no-overlay state returned within color tolerance" : "the no-overlay state did not restore within color tolerance");
    add(`restoration:${backend}:changed-pixel-fraction`, changedPass ? "pass" : "fail", difference.changedPixelFraction,
      `changed pixel fraction ≤ ${thresholds.maximumRestorationChangedPixelFraction}`,
      changedPass ? "the restored image changed only within the permitted pixel fraction" : "too many pixels remain changed after restoration");
  }

  for (const [name, matched] of Object.entries(input.consistency)) {
    add(`capture-consistency:${name}`, matched ? "pass" : "fail", matched,
      "matched capture contract", matched ? "capture state is consistent" : "capture state did not satisfy the matched-pose contract");
  }
  for (const requiredName of ["webgl", "webgpu"]) {
    if (input.consistency[requiredName] === undefined) {
      add(`capture-consistency:${requiredName}`, "fail", null, "matched capture contract", "required backend capture consistency evidence is missing");
    }
  }

  const failures = criteria.filter((criterion) => criterion.status === "fail");
  return {
    status: failures.length === 0 ? "pass" : "fail",
    criteria,
    failures,
    nonApplicable: criteria.filter((criterion) => criterion.status === "not-applicable"),
    thresholds: {
      ...thresholds,
      overlayResponse: overlayThresholds,
      requiredBackgroundOverlayRegions,
      notes: "The façade threshold is tighter because it carries teaching geometry. At this fixed view, focus is expected in topLeft; DOF and combined overlays are expected in both corners. Other clean regions with no measured contribution are reported not-applicable.",
    },
  };
};
