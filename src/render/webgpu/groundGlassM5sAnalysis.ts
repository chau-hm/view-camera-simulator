/**
 * M5S ROI selection and evidence-gated convergence analysis.
 * Diagnostic-only; production renderers must not import this module.
 */
import {
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
  GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
  GROUND_GLASS_APERTURE_SIGN_EPSILON_MM,
  groundGlassViewDistanceMmAtTopUv,
  nearestGroundGlassSourcePixelAtTopUv,
  mapGroundGlassPhysicalEllipseToSourcePixels,
  capGroundGlassPixelEllipse,
  type GroundGlassPixelAxis,
} from "./groundGlassApertureGatherReference";
import {
  GROUND_GLASS_M5S_PROPOSAL_ALGORITHM_REVISION,
  GROUND_GLASS_M5S_DECLARED_MAXIMUM_CHANNEL_ERROR,
  GROUND_GLASS_M5S_DECLARED_REFERENCE_RMSE_LIMIT,
  auditGroundGlassM5sProposalStrategy,
  compareGroundGlassM5sRgb,
  fingerprintGroundGlassM5sProposalCoordinates,
  groundGlassM5sProposalIdentityKey,
  integrateGroundGlassM5sUnitDiskFunction,
  runGroundGlassM5sSparseFarReference,
  type GroundGlassM5sProposalDescriptor,
  type GroundGlassM5sProposalStrategy,
  type GroundGlassM5sFarReferenceInput,
  type GroundGlassM5sFarReferenceResult,
  type GroundGlassM5sInputFingerprints,
  type GroundGlassM5sRgbMetrics,
  type GroundGlassM5sSamplingMethod,
} from "./groundGlassM5sReference";

export type GroundGlassM5sRoiStratumId =
  | "S1-smooth-valid-far-interior"
  | "S2-strong-defocus-textured-interior"
  | "S3-high-source-gradient-valid-far"
  | "S4-depth-discontinuity-valid-far"
  | "S5-signed-coc-boundary-neighborhood"
  | "S6-cap-activated-valid-far";

export type GroundGlassM5sRoiStratum = Readonly<{
  id: GroundGlassM5sRoiStratumId;
  selectionRule: string;
  candidateCount: number;
  selectedGatherPixelIds: readonly number[];
  selectedSourcePixelIds: readonly number[];
  minimumSupport: number;
  status: "measured" | "insufficient-support";
  physicalRadiusPx: Readonly<{ minimum: number | null; median: number | null; maximum: number | null }>;
  effectiveRadiusPx: Readonly<{ minimum: number | null; median: number | null; maximum: number | null }>;
  signedCocMm: Readonly<{ minimum: number | null; median: number | null; maximum: number | null }>;
  selectedDepthEdgeCount: number;
  selectedCapActivatedCount: number;
  sourceGradient: Readonly<{ minimum: number | null; median: number | null; maximum: number | null }>;
  depthEdgeRelativeThreshold: number;
  gradientThresholds: Readonly<{ p25: number | null; p75: number | null; p90: number | null }>;
}>;

type FarCandidate = Readonly<{
  gatherPixelId: number;
  radius: number;
  effectiveRadius: number;
  signedCocMm: number;
  gradient: number;
  depthEdge: boolean;
  signedBoundary: boolean;
  capActive: boolean;
}>;

const quantile = (values: readonly number[], q: number): number | null => {
  if (!values.length) return null;
  return [...values].sort((a, b) => a - b)[Math.floor((values.length - 1) * q)]!;
};

const evenlySelect = (ids: readonly number[], maximum: number): number[] =>
  ids.length <= maximum
    ? [...ids]
    : Array.from({ length: maximum }, (_value, index) =>
      ids[Math.floor((index + 0.5) * ids.length / maximum)]!,
    );

/** Selects strata from physical, validity, depth, and source evidence only. */
export const selectGroundGlassM5sRoiStrata = (input: Readonly<{
  referenceInput: GroundGlassM5sFarReferenceInput;
  maximumPixelsPerStratum?: number;
  minimumSupport?: number;
  depthEdgeRelativeThreshold?: number;
}>): readonly GroundGlassM5sRoiStratum[] => {
  const maximumPixels = input.maximumPixelsPerStratum ?? 16;
  const minimumSupport = input.minimumSupport ?? 12;
  const depthEdgeThreshold = input.depthEdgeRelativeThreshold ?? 0.03;
  if (!Number.isSafeInteger(maximumPixels) || maximumPixels < 1 || maximumPixels > 32
      || !Number.isSafeInteger(minimumSupport) || minimumSupport < 1 || minimumSupport > maximumPixels
      || !Number.isFinite(depthEdgeThreshold) || depthEdgeThreshold <= 0) {
    throw new RangeError("M5S ROI selection requires bounded support and a positive depth-edge threshold");
  }
  const ref = input.referenceInput;
  const sw = ref.source.widthPx;
  const sh = ref.source.heightPx;
  const gatherPixels = ref.gather.widthPx * ref.gather.heightPx;
  const gradientAt = (x: number, y: number): number => {
    const centerOffset = (y * sw + x) * 4;
    let total = 0;
    let count = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
      const neighborOffset = (ny * sw + nx) * 4;
      total += Math.abs(ref.sourceRgba[centerOffset]! - ref.sourceRgba[neighborOffset]!)
        + Math.abs(ref.sourceRgba[centerOffset + 1]! - ref.sourceRgba[neighborOffset + 1]!)
        + Math.abs(ref.sourceRgba[centerOffset + 2]! - ref.sourceRgba[neighborOffset + 2]!);
      count += 1;
    }
    return count ? total / (count * 3) : 0;
  };
  const distanceAt = (pixelId: number): number => {
    const x = pixelId % sw;
    const y = Math.floor(pixelId / sw);
    return groundGlassViewDistanceMmAtTopUv(
      (x + 0.5) / sw, (y + 0.5) / sh, ref.depth[pixelId]!, ref.inverseProjectionMatrix,
    );
  };
  const candidates: FarCandidate[] = [];
  for (let gatherPixelId = 0; gatherPixelId < gatherPixels; gatherPixelId += 1) {
    const x = ref.observedGatherCenterSourceIds[gatherPixelId * 2]!;
    const y = ref.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
    if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y) || x < 0 || y < 0 || x >= sw || y >= sh) continue;
    const sourcePixelId = y * sw + x;
    const offset = sourcePixelId * 4;
    if (ref.validity[sourcePixelId] !== 1
        || ref.physicalRgba[offset]! <= GROUND_GLASS_APERTURE_SIGN_EPSILON_MM) continue;
    const ellipse = mapGroundGlassPhysicalEllipseToSourcePixels({
      majorRadiusMm: ref.physicalRgba[offset + 1]!,
      minorRadiusMm: ref.physicalRgba[offset + 2]!,
      orientationRad: ref.physicalRgba[offset + 3]! * Math.PI,
      film: ref.film,
      source: ref.source,
    });
    const capped = capGroundGlassPixelEllipse(ellipse, ref.maximumRadiusPx);
    let depthEdge = false;
    let signedBoundary = false;
    const centerDistance = distanceAt(sourcePixelId);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= sw || ny >= sh) continue;
      const neighbor = ny * sw + nx;
      if (ref.validity[neighbor] !== 1) continue;
      const neighborCoc = ref.physicalRgba[neighbor * 4]!;
      if (neighborCoc < -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM) signedBoundary = true;
      const neighborDistance = distanceAt(neighbor);
      const relative = Math.abs(centerDistance - neighborDistance)
        / Math.max(1, Math.min(Math.abs(centerDistance), Math.abs(neighborDistance)));
      if (relative > depthEdgeThreshold) depthEdge = true;
    }
    candidates.push({
      gatherPixelId,
      radius: capped.uncappedMaximumRadiusPx,
      effectiveRadius: capped.effectiveMaximumRadiusPx,
      signedCocMm: ref.physicalRgba[offset]!,
      gradient: gradientAt(x, y),
      depthEdge,
      signedBoundary,
      capActive: capped.capApplied,
    });
  }

  const gradients = candidates.map(({ gradient }) => gradient);
  const radii = candidates.map(({ radius }) => radius);
  const p25 = quantile(gradients, 0.25);
  const p75 = quantile(gradients, 0.75);
  const p90 = quantile(gradients, 0.90);
  const radius75 = quantile(radii, 0.75);
  const definitions: ReadonlyArray<Readonly<{
    id: GroundGlassM5sRoiStratumId;
    selectionRule: string;
    predicate: (candidate: FarCandidate) => boolean;
  }>> = [
    { id: "S1-smooth-valid-far-interior",
      selectionRule: "valid Far center, no 3% relative four-neighbor depth edge, RGB-gradient at or below valid-Far p25",
      predicate: (c) => !c.depthEdge && p25 !== null && c.gradient <= p25 },
    { id: "S2-strong-defocus-textured-interior",
      selectionRule: "valid Far center, no 3% relative depth edge, uncapped radius >= max(8 px, valid-Far p75), RGB-gradient at or above p75",
      predicate: (c) => !c.depthEdge && radius75 !== null && c.radius >= Math.max(8, radius75)
        && p75 !== null && c.gradient >= p75 },
    { id: "S3-high-source-gradient-valid-far",
      selectionRule: "valid Far center, no 3% relative four-neighbor depth edge, RGB-gradient at or above valid-Far p90",
      predicate: (c) => !c.depthEdge && p90 !== null && c.gradient >= p90 },
    { id: "S4-depth-discontinuity-valid-far",
      selectionRule: "valid Far center with an adjacent validity-one source pixel above 3% relative view-distance difference",
      predicate: (c) => c.depthEdge },
    { id: "S5-signed-coc-boundary-neighborhood",
      selectionRule: "valid Far center adjacent to a validity-one negative signed-CoC source pixel",
      predicate: (c) => c.signedBoundary },
    { id: "S6-cap-activated-valid-far",
      selectionRule: "valid Far center whose physical ellipse exceeds this capture's radius cap",
      predicate: (c) => c.capActive },
  ];
  return definitions.map((definition) => {
    const population = candidates.filter(definition.predicate).sort((a, b) => a.gatherPixelId - b.gatherPixelId);
    const selected = evenlySelect(population.map(({ gatherPixelId }) => gatherPixelId), maximumPixels);
    const selectedSet = new Set(selected);
    const selectedCandidates = population.filter(({ gatherPixelId }) => selectedSet.has(gatherPixelId));
    const selectedRadii = selectedCandidates.map(({ radius }) => radius);
    const selectedEffectiveRadii = selectedCandidates.map(({ effectiveRadius }) => effectiveRadius);
    const selectedSignedCoc = selectedCandidates.map(({ signedCocMm }) => signedCocMm);
    const selectedGradients = selectedCandidates.map(({ gradient }) => gradient);
    return {
      id: definition.id,
      selectionRule: definition.selectionRule,
      candidateCount: population.length,
      selectedGatherPixelIds: selected,
      selectedSourcePixelIds: selected.map((gatherPixelId) => {
        const x = ref.observedGatherCenterSourceIds[gatherPixelId * 2]!;
        const y = ref.observedGatherCenterSourceIds[gatherPixelId * 2 + 1]!;
        return y * sw + x;
      }),
      minimumSupport,
      status: selected.length >= minimumSupport ? "measured" : "insufficient-support",
      physicalRadiusPx: {
        minimum: selectedRadii.length ? Math.min(...selectedRadii) : null,
        median: quantile(selectedRadii, 0.5),
        maximum: selectedRadii.length ? Math.max(...selectedRadii) : null,
      },
      effectiveRadiusPx: {
        minimum: selectedEffectiveRadii.length ? Math.min(...selectedEffectiveRadii) : null,
        median: quantile(selectedEffectiveRadii, 0.5),
        maximum: selectedEffectiveRadii.length ? Math.max(...selectedEffectiveRadii) : null,
      },
      signedCocMm: {
        minimum: selectedSignedCoc.length ? Math.min(...selectedSignedCoc) : null,
        median: quantile(selectedSignedCoc, 0.5),
        maximum: selectedSignedCoc.length ? Math.max(...selectedSignedCoc) : null,
      },
      selectedDepthEdgeCount: selectedCandidates.filter(({ depthEdge }) => depthEdge).length,
      selectedCapActivatedCount: selectedCandidates.filter(({ capActive }) => capActive).length,
      sourceGradient: {
        minimum: selectedGradients.length ? Math.min(...selectedGradients) : null,
        median: quantile(selectedGradients, 0.5),
        maximum: selectedGradients.length ? Math.max(...selectedGradients) : null,
      },
      depthEdgeRelativeThreshold: depthEdgeThreshold,
      gradientThresholds: { p25, p75, p90 },
    };
  });
};

export type GroundGlassM5sFingerprintComparison = Readonly<{
  status: "matched" | "mismatched" | "incomplete";
  referenceFingerprint: GroundGlassM5sInputFingerprints | null;
  comparedCaptureIds: readonly string[];
  mismatchedFields: readonly string[];
}>;

export const compareGroundGlassM5sInputFingerprints = (
  captures: readonly Readonly<{ captureId: string; fingerprints: GroundGlassM5sInputFingerprints }>[],
): GroundGlassM5sFingerprintComparison => {
  if (captures.length < 2 || captures.some(({ captureId, fingerprints }) =>
    !captureId || Object.values(fingerprints).some((value) => !value || !value.trim()))) {
    return {
      status: "incomplete",
      referenceFingerprint: captures[0]?.fingerprints ?? null,
      comparedCaptureIds: captures.map(({ captureId }) => captureId),
      mismatchedFields: [],
    };
  }
  const reference = captures[0]!.fingerprints;
  const keys: (keyof GroundGlassM5sInputFingerprints)[] = ["sourceColor", "depth", "physical", "validity"];
  const mismatchedFields = keys.filter((key) =>
    captures.some(({ fingerprints }) => fingerprints[key] !== reference[key]));
  return {
    status: mismatchedFields.length ? "mismatched" : "matched",
    referenceFingerprint: reference,
    comparedCaptureIds: captures.map(({ captureId }) => captureId),
    mismatchedFields,
  };
};

export type GroundGlassM5sBlurPreservation = Readonly<{
  status: "preserved" | "failed" | "unresolved";
  sourceToExpectedBlur: GroundGlassM5sRgbMetrics;
  sourceToCandidate: GroundGlassM5sRgbMetrics;
  expectedToCandidate: GroundGlassM5sRgbMetrics;
  expectedBlurSignalPresent: boolean | null;
  candidateRetainsBlurSignal: boolean | null;
  reason: string;
}>;

export const evaluateGroundGlassM5sBlurPreservation = (input: Readonly<{
  sourceRgb: ArrayLike<number>;
  expectedBlurRgb: ArrayLike<number>;
  candidateRgb: ArrayLike<number>;
  minimumBlurSignal?: number;
  maximumExpectedError?: number;
}>): GroundGlassM5sBlurPreservation => {
  const minimumSignal = input.minimumBlurSignal ?? 0.01;
  const maximumError = input.maximumExpectedError ?? GROUND_GLASS_M5S_DECLARED_REFERENCE_RMSE_LIMIT;
  const sourceToExpectedBlur = compareGroundGlassM5sRgb(input.sourceRgb, input.expectedBlurRgb);
  const sourceToCandidate = compareGroundGlassM5sRgb(input.sourceRgb, input.candidateRgb);
  const expectedToCandidate = compareGroundGlassM5sRgb(input.expectedBlurRgb, input.candidateRgb);
  const metrics = [sourceToExpectedBlur, sourceToCandidate, expectedToCandidate];
  if (metrics.some((metric) => metric.status !== "measured" || metric.rmse === null)) {
    return { status: "unresolved", sourceToExpectedBlur, sourceToCandidate, expectedToCandidate,
      expectedBlurSignalPresent: null, candidateRetainsBlurSignal: null,
      reason: "blur comparison is missing, non-finite, or has mismatched support" };
  }
  const expectedSignal = sourceToExpectedBlur.rmse! >= minimumSignal;
  const candidateSignal = sourceToCandidate.rmse! >= minimumSignal;
  if (!expectedSignal) {
    return { status: "unresolved", sourceToExpectedBlur, sourceToCandidate, expectedToCandidate,
      expectedBlurSignalPresent: false, candidateRetainsBlurSignal: candidateSignal,
      reason: "expected reference does not contain meaningful defocus signal" };
  }
  if (!candidateSignal) {
    return { status: "failed", sourceToExpectedBlur, sourceToCandidate, expectedToCandidate,
      expectedBlurSignalPresent: true, candidateRetainsBlurSignal: false,
      reason: "candidate collapses the expected defocus signal back toward sharp source color" };
  }
  const preserved = expectedToCandidate.rmse! <= maximumError;
  return { status: preserved ? "preserved" : "unresolved", sourceToExpectedBlur, sourceToCandidate,
    expectedToCandidate, expectedBlurSignalPresent: true, candidateRetainsBlurSignal: true,
    reason: preserved
      ? "candidate retains and matches the independently validated defocus transition"
      : "candidate retains blur but differs from the expected reference beyond the declared comparison limit" };
};

export type GroundGlassM5sConvergenceClassification =
  | "converged-and-cross-validated"
  | "converged-within-one-method-only"
  | "convergence-trending-but-unresolved"
  | "systematic-method-disagreement"
  | "analytically-invalid"
  | "insufficient-support"
  | "invalid-comparison";

export type GroundGlassM5sEvidenceAssessment = Readonly<{
  classification: GroundGlassM5sConvergenceClassification;
  confidence: "bounded-high" | "low" | "none";
  referenceAuthority: "supported-for-exact-stratum" | "candidate-only" | "unresolved" | "none";
  provenanceValid: boolean | null;
  adequateSupport: boolean | null;
  analyticAuthority: GroundGlassM5sAnalyticAuthority;
  blurPreservationPassed: boolean | null;
  finiteSampleReferenceConverged: boolean | null;
  withinMethodConvergencePassed: boolean | null;
  crossMethodAgreementPassed: boolean | null;
  randomizedUncertaintyPassed: boolean | null;
  supportingEvidence: readonly string[];
  failedConditions: readonly string[];
}>;

export type GroundGlassM5sAnalyticAuthority = Readonly<{
  status: "passed" | "failed" | "invalid";
  expectedStrategyIds: readonly string[];
  observedStrategyIds: readonly string[];
  qualifiedStrategyIds: readonly string[];
  failedStrategies: readonly Readonly<{
    strategyId: string;
    method: GroundGlassM5sSamplingMethod;
    seed: number | null;
    failedCriteria: readonly string[];
  }>[];
  missingStrategyIds: readonly string[];
  unexpectedStrategyIds: readonly string[];
  duplicateStrategyIds: readonly string[];
  identityMismatchStrategyIds: readonly string[];
}>;

const strategyId = (descriptor: GroundGlassM5sProposalDescriptor): string =>
  groundGlassM5sProposalIdentityKey(descriptor);

/** Requires exact per-method/per-seed analytic evidence for every high-tier participant. */
export const evaluateGroundGlassM5sAnalyticAuthority = (input: Readonly<{
  requiredStrategies: readonly GroundGlassM5sProposalDescriptor[];
  observedParticipants: readonly Readonly<{
    descriptor: GroundGlassM5sProposalDescriptor;
    coordinateFingerprint: string | null;
  }>[];
  analyticResults: readonly GroundGlassM5sAnalyticControlReport[];
}>): GroundGlassM5sAnalyticAuthority => {
  const ids = (descriptors: readonly GroundGlassM5sProposalDescriptor[]) => descriptors.map(strategyId);
  const expectedStrategyIds = ids(input.requiredStrategies);
  const observedStrategyIds = ids(input.observedParticipants.map(({ descriptor }) => descriptor));
  const observedCoordinateFingerprints = new Map(input.observedParticipants.map(({ descriptor, coordinateFingerprint }) =>
    [strategyId(descriptor), coordinateFingerprint] as const));
  const resultStrategyIds = input.analyticResults.map((result) => groundGlassM5sProposalIdentityKey({
    method: result.method,
    sequenceId: result.sequenceId,
    algorithmRevision: result.algorithmRevision,
    sampleCount: result.sampleCount as GroundGlassM5sProposalDescriptor["sampleCount"],
    seed: result.seed,
    progressivePrefix: result.progressivePrefix,
  }));
  const duplicateIds = (values: readonly string[]) => {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) duplicates.add(value);
      seen.add(value);
    }
    return [...duplicates];
  };
  const expectedSet = new Set(expectedStrategyIds);
  const resultCounts = new Map<string, number>();
  for (const id of resultStrategyIds) resultCounts.set(id, (resultCounts.get(id) ?? 0) + 1);
  const missingStrategyIds = expectedStrategyIds.filter((id) => !resultCounts.has(id));
  const unexpectedStrategyIds = resultStrategyIds.filter((id) => !expectedSet.has(id));
  const strategyIdMismatches = input.analyticResults.flatMap((result, index) =>
    result.strategyId === resultStrategyIds[index]
      && observedCoordinateFingerprints.get(resultStrategyIds[index]!) === result.coordinateFingerprint
      && result.coordinateFingerprint !== null
      ? [] : [resultStrategyIds[index]!]);
  const duplicateStrategyIds = [
    ...duplicateIds(expectedStrategyIds),
    ...duplicateIds(observedStrategyIds),
    ...duplicateIds(resultStrategyIds),
  ];
  const observedSet = new Set(observedStrategyIds);
  for (const id of expectedStrategyIds) if (!observedSet.has(id)) missingStrategyIds.push(id);
  for (const id of observedStrategyIds) if (!expectedSet.has(id)) unexpectedStrategyIds.push(id);
  const failedStrategies = input.analyticResults.flatMap((result, index) => {
    const id = resultStrategyIds[index]!;
    if (!expectedSet.has(id) || result.analyticStatus === "passed") return [];
    return [{ strategyId: id, method: result.method, seed: result.seed, failedCriteria: result.failedCriteria }];
  });
  const invalid = expectedStrategyIds.length === 0 || missingStrategyIds.length > 0
    || unexpectedStrategyIds.length > 0 || duplicateStrategyIds.length > 0
    || strategyIdMismatches.length > 0;
  const status = invalid ? "invalid" : failedStrategies.length ? "failed" : "passed";
  return {
    status,
    expectedStrategyIds,
    observedStrategyIds,
    qualifiedStrategyIds: input.analyticResults.flatMap((result, index) =>
      result.analyticStatus === "passed" && expectedSet.has(resultStrategyIds[index]!)
        ? [resultStrategyIds[index]!] : []),
    failedStrategies,
    missingStrategyIds: [...new Set(missingStrategyIds)],
    unexpectedStrategyIds: [...new Set(unexpectedStrategyIds)],
    duplicateStrategyIds: [...new Set(duplicateStrategyIds)],
    identityMismatchStrategyIds: [...new Set(strategyIdMismatches)],
  };
};

export const evaluateGroundGlassM5sEvidence = (input: Readonly<{
  provenanceStatus: "matched" | "mismatched" | "incomplete";
  candidateCount: number;
  selectedPixelCount: number;
  minimumSupport: number;
  analyticAuthority: GroundGlassM5sAnalyticAuthority;
  blurPreservationStatus: "preserved" | "failed" | "unresolved";
  withinMethodConvergence: readonly GroundGlassM5sRgbMetrics[] | null;
  crossMethodAgreement: readonly GroundGlassM5sRgbMetrics[] | null;
  randomizedSeedVariationRmse: number | null;
  randomizedSeedVariationMaximumChannelError: number | null;
  declaredReferenceRmseLimit?: number;
  declaredMaximumChannelError?: number;
  declaredRandomizedUncertaintyLimit?: number;
  declaredRandomizedMaximumChannelError?: number;
}>): GroundGlassM5sEvidenceAssessment => {
  const rmseLimit = input.declaredReferenceRmseLimit ?? GROUND_GLASS_M5S_DECLARED_REFERENCE_RMSE_LIMIT;
  const maximumErrorLimit = input.declaredMaximumChannelError ?? GROUND_GLASS_M5S_DECLARED_MAXIMUM_CHANNEL_ERROR;
  const uncertaintyLimit = input.declaredRandomizedUncertaintyLimit ?? rmseLimit;
  const randomizedMaximumErrorLimit = input.declaredRandomizedMaximumChannelError ?? maximumErrorLimit;
  const supportPassed = input.candidateCount >= input.minimumSupport
    && input.selectedPixelCount >= input.minimumSupport;
  const supportingEvidence: string[] = [];
  const failedConditions: string[] = [];
  const measured = (metrics: readonly GroundGlassM5sRgbMetrics[] | null): boolean =>
    metrics !== null && metrics.length > 0 && metrics.every((metric) =>
      metric.status === "measured" && metric.rmse !== null && metric.maximumChannelError !== null
      && Number.isFinite(metric.rmse) && Number.isFinite(metric.maximumChannelError));
  const withinMeasured = measured(input.withinMethodConvergence);
  const crossMeasured = measured(input.crossMethodAgreement);
  if (input.provenanceStatus !== "matched") {
    failedConditions.push("input fingerprints are mismatched or incomplete");
    return { classification: "invalid-comparison", confidence: "none", referenceAuthority: "none",
      provenanceValid: false, adequateSupport: supportPassed, analyticAuthority: input.analyticAuthority,
      blurPreservationPassed: input.blurPreservationStatus === "preserved",
      finiteSampleReferenceConverged: null, withinMethodConvergencePassed: null,
      crossMethodAgreementPassed: null, randomizedUncertaintyPassed: null,
      supportingEvidence, failedConditions };
  }
  supportingEvidence.push("source, depth, physical, and validity fingerprints match exactly");
  if (!supportPassed) {
    failedConditions.push("selected population is below the predeclared minimum support");
    return { classification: "insufficient-support", confidence: "none", referenceAuthority: "none",
      provenanceValid: true, adequateSupport: false, analyticAuthority: input.analyticAuthority,
      blurPreservationPassed: input.blurPreservationStatus === "preserved",
      finiteSampleReferenceConverged: null, withinMethodConvergencePassed: null,
      crossMethodAgreementPassed: null, randomizedUncertaintyPassed: null,
      supportingEvidence, failedConditions };
  }
  supportingEvidence.push("predeclared candidate and selected-pixel support floors are met");
  if (input.analyticAuthority.status === "failed" || input.blurPreservationStatus === "failed") {
    if (input.analyticAuthority.status === "failed") {
      failedConditions.push("one or more required method/seed analytic controls failed");
    }
    if (input.blurPreservationStatus === "failed") failedConditions.push("blur-preservation control failed");
    return { classification: "analytically-invalid", confidence: "none", referenceAuthority: "none",
      provenanceValid: true, adequateSupport: true, analyticAuthority: input.analyticAuthority,
      blurPreservationPassed: input.blurPreservationStatus === "preserved", finiteSampleReferenceConverged: null,
      withinMethodConvergencePassed: null, crossMethodAgreementPassed: null,
      randomizedUncertaintyPassed: null, supportingEvidence, failedConditions };
  }
  if (input.analyticAuthority.status !== "passed") {
    failedConditions.push("required method/seed analytic evidence is missing, duplicated, or mismatched");
    return { classification: "invalid-comparison", confidence: "none", referenceAuthority: "none",
      provenanceValid: true, adequateSupport: true, analyticAuthority: input.analyticAuthority,
      blurPreservationPassed: input.blurPreservationStatus === "preserved",
      finiteSampleReferenceConverged: null, withinMethodConvergencePassed: null,
      crossMethodAgreementPassed: null, randomizedUncertaintyPassed: null,
      supportingEvidence, failedConditions };
  }
  supportingEvidence.push("every declared high-tier method and seed has matching passing analytic evidence");
  if (input.blurPreservationStatus !== "preserved"
      || !withinMeasured || !crossMeasured || input.randomizedSeedVariationRmse === null
      || !Number.isFinite(input.randomizedSeedVariationRmse)
      || input.randomizedSeedVariationMaximumChannelError === null
      || !Number.isFinite(input.randomizedSeedVariationMaximumChannelError)) {
    failedConditions.push("analytic, blur, tier, cross-method, or randomized uncertainty evidence is missing");
    return { classification: "convergence-trending-but-unresolved", confidence: "low",
      referenceAuthority: "unresolved", provenanceValid: true, adequateSupport: true,
      analyticAuthority: input.analyticAuthority,
      blurPreservationPassed: input.blurPreservationStatus === "preserved",
      finiteSampleReferenceConverged: null, withinMethodConvergencePassed: withinMeasured ? null : false,
      crossMethodAgreementPassed: crossMeasured ? null : false, randomizedUncertaintyPassed: null,
      supportingEvidence, failedConditions };
  }

  const withinPass = input.withinMethodConvergence!.every((metric) =>
    metric.rmse! <= rmseLimit && metric.maximumChannelError! <= maximumErrorLimit);
  const crossPass = input.crossMethodAgreement!.every((metric) =>
    metric.rmse! <= rmseLimit && metric.maximumChannelError! <= maximumErrorLimit);
  const uncertaintyPass = input.randomizedSeedVariationRmse! <= uncertaintyLimit
    && input.randomizedSeedVariationMaximumChannelError! <= randomizedMaximumErrorLimit;
  const withinAnyPass = input.withinMethodConvergence!.some((metric) =>
    metric.rmse! <= rmseLimit && metric.maximumChannelError! <= maximumErrorLimit);
  if (withinPass) supportingEvidence.push("all final tier-to-tier comparisons meet RMSE and maximum-channel limits");
  else failedConditions.push("one or more final tier-to-tier comparisons exceed a declared limit");
  if (crossPass) supportingEvidence.push("independent high-tier methods agree within both declared limits");
  else failedConditions.push("independent high-tier methods disagree beyond a declared limit");
  if (uncertaintyPass) supportingEvidence.push("randomized seed RMSE and maximum-channel variation are within declared uncertainty limits");
  else failedConditions.push("randomized seed RMSE or maximum-channel variation exceeds a declared uncertainty limit");

  if (withinPass && crossPass && uncertaintyPass) {
    return { classification: "converged-and-cross-validated", confidence: "bounded-high",
      referenceAuthority: "supported-for-exact-stratum", provenanceValid: true, adequateSupport: true,
      analyticAuthority: input.analyticAuthority, blurPreservationPassed: true, finiteSampleReferenceConverged: true,
      withinMethodConvergencePassed: true, crossMethodAgreementPassed: true,
      randomizedUncertaintyPassed: true, supportingEvidence, failedConditions };
  }
  if (withinAnyPass && !crossPass) {
    return { classification: "converged-within-one-method-only", confidence: "low",
      referenceAuthority: "candidate-only", provenanceValid: true, adequateSupport: true,
      analyticAuthority: input.analyticAuthority, blurPreservationPassed: true, finiteSampleReferenceConverged: false,
      withinMethodConvergencePassed: false, crossMethodAgreementPassed: false,
      randomizedUncertaintyPassed: uncertaintyPass, supportingEvidence, failedConditions };
  }
  if (!crossPass && !withinPass) {
    return { classification: "systematic-method-disagreement", confidence: "low",
      referenceAuthority: "unresolved", provenanceValid: true, adequateSupport: true,
      analyticAuthority: input.analyticAuthority, blurPreservationPassed: true, finiteSampleReferenceConverged: false,
      withinMethodConvergencePassed: false, crossMethodAgreementPassed: false,
      randomizedUncertaintyPassed: uncertaintyPass, supportingEvidence, failedConditions };
  }
  return { classification: "convergence-trending-but-unresolved", confidence: "low",
    referenceAuthority: "unresolved", provenanceValid: true, adequateSupport: true,
    analyticAuthority: input.analyticAuthority, blurPreservationPassed: true, finiteSampleReferenceConverged: false,
    withinMethodConvergencePassed: false, crossMethodAgreementPassed: crossPass,
    randomizedUncertaintyPassed: uncertaintyPass, supportingEvidence, failedConditions };
};

export type GroundGlassM5sStratumStudy = Readonly<{
  stratum: GroundGlassM5sRoiStratum;
  convergenceCurves: readonly Readonly<{
    method: GroundGlassM5sSamplingMethod;
    seed: number | null;
    samplePair: readonly [number, number];
    finiteEstimator: GroundGlassM5sRgbMetrics;
    limitingIntegral: GroundGlassM5sRgbMetrics;
    finiteCenterContributionEffectAtHigherTier: GroundGlassM5sRgbMetrics;
  }>[];
  finalTierWithinMethod: readonly GroundGlassM5sRgbMetrics[];
  highTierCrossMethodAgreement: readonly Readonly<{
    methods: readonly [string, string];
    metrics: GroundGlassM5sRgbMetrics;
  }>[];
  randomizedSeedVariation: GroundGlassM5sRgbMetrics;
  maximumSeedRmse: number | null;
  maximumSeedChannelError: number | null;
  evidence: GroundGlassM5sEvidenceAssessment;
}>;

const rgbFor = (
  run: GroundGlassM5sFarReferenceResult,
  ids: readonly number[],
  field: "finiteEstimatorRgb" | "limitingIntegralRgb",
): Float64Array | null => {
  const byId = new Map(run.pixels.map((pixel) => [pixel.gatherPixelId, pixel]));
  const values = new Float64Array(ids.length * 3);
  for (let index = 0; index < ids.length; index += 1) {
    const rgb = byId.get(ids[index]!)?.[field];
    if (!rgb) return null;
    values.set(rgb, index * 3);
  }
  return values;
};

const compareRuns = (
  a: GroundGlassM5sFarReferenceResult,
  b: GroundGlassM5sFarReferenceResult,
  ids: readonly number[],
  field: "finiteEstimatorRgb" | "limitingIntegralRgb",
): GroundGlassM5sRgbMetrics => {
  const first = rgbFor(a, ids, field);
  const second = rgbFor(b, ids, field);
  return first && second ? compareGroundGlassM5sRgb(first, second) : compareGroundGlassM5sRgb([], []);
};

const compareFields = (
  run: GroundGlassM5sFarReferenceResult,
  ids: readonly number[],
): GroundGlassM5sRgbMetrics => {
  const finite = rgbFor(run, ids, "finiteEstimatorRgb");
  const limiting = rgbFor(run, ids, "limitingIntegralRgb");
  return finite && limiting ? compareGroundGlassM5sRgb(finite, limiting) : compareGroundGlassM5sRgb([], []);
};

const meanSeedRgb = (
  runs: readonly GroundGlassM5sFarReferenceResult[],
  ids: readonly number[],
): Float64Array | null => {
  if (!runs.length) return null;
  const arrays = runs.map((run) => rgbFor(run, ids, "limitingIntegralRgb"));
  if (arrays.some((array) => array === null)) return null;
  const mean = new Float64Array(ids.length * 3);
  for (const array of arrays) {
    for (let index = 0; index < mean.length; index += 1) mean[index]! += array![index]! / arrays.length;
  }
  return mean;
};

export const analyzeGroundGlassM5sReferenceMatrix = (input: Readonly<{
  strata: readonly GroundGlassM5sRoiStratum[];
  runs: readonly GroundGlassM5sFarReferenceResult[];
  provenanceStatus: "matched" | "mismatched" | "incomplete";
  requiredAnalyticStrategies: readonly GroundGlassM5sProposalDescriptor[];
  analyticResults: readonly GroundGlassM5sAnalyticControlReport[];
  blurPreservationByStratum?: Partial<Record<GroundGlassM5sRoiStratumId, "preserved" | "failed" | "unresolved">>;
}>): readonly GroundGlassM5sStratumStudy[] => {
  const analyticAuthority = evaluateGroundGlassM5sAnalyticAuthority({
    requiredStrategies: input.requiredAnalyticStrategies,
    observedParticipants: input.runs
      .filter((run) => run.descriptor.sampleCount === 1024)
      .map((run) => ({ descriptor: run.descriptor, coordinateFingerprint: run.proposalCoordinateFingerprint })),
    analyticResults: input.analyticResults,
  });
  return input.strata.map((stratum) => {
  const ids = stratum.selectedGatherPixelIds;
  const groups = new Map<string, GroundGlassM5sFarReferenceResult[]>();
  for (const run of input.runs) {
    const key = JSON.stringify([
      run.descriptor.method,
      run.descriptor.sequenceId,
      run.descriptor.algorithmRevision,
      run.descriptor.seed,
    ]);
    const group = groups.get(key) ?? [];
    group.push(run);
    groups.set(key, group);
  }
  const families = [...groups.values()].map((group) =>
    group.sort((a, b) => a.descriptor.sampleCount - b.descriptor.sampleCount));
  const convergenceCurves: GroundGlassM5sStratumStudy["convergenceCurves"][number][] = [];
  const finalTierWithinMethod: GroundGlassM5sRgbMetrics[] = [];
  for (const family of families) {
    for (let index = 0; index + 1 < family.length; index += 1) {
      const low = family[index]!;
      const high = family[index + 1]!;
      if (low.descriptor.sampleCount >= high.descriptor.sampleCount) continue;
      const limitingIntegral = compareRuns(low, high, ids, "limitingIntegralRgb");
      convergenceCurves.push({
        method: high.descriptor.method,
        seed: high.descriptor.seed,
        samplePair: [low.descriptor.sampleCount, high.descriptor.sampleCount],
        finiteEstimator: compareRuns(low, high, ids, "finiteEstimatorRgb"),
        limitingIntegral,
        finiteCenterContributionEffectAtHigherTier: compareFields(high, ids),
      });
      if (low.descriptor.sampleCount === 512 && high.descriptor.sampleCount === 1024) {
        finalTierWithinMethod.push(limitingIntegral);
      }
    }
  }

  const runAt = (method: GroundGlassM5sSamplingMethod) => input.runs.find((run) =>
    run.descriptor.method === method && run.descriptor.sampleCount === 1024
    && run.descriptor.seed === null);
  const seedRuns = input.runs.filter((run) =>
    run.descriptor.method === "seeded-stratified-square-to-disk"
    && run.descriptor.sampleCount === 1024);
  const seedMean = meanSeedRgb(seedRuns, ids);
  const crossPairs: readonly (readonly [string, GroundGlassM5sFarReferenceResult | Float64Array | null | undefined,
    string, GroundGlassM5sFarReferenceResult | Float64Array | null | undefined])[] = [
    ["golden-angle", runAt("golden-angle-count-dependent"), "halton-2-3", runAt("halton-2-3-progressive")],
    ["golden-angle", runAt("golden-angle-count-dependent"), "stratified-seed-mean", seedMean],
    ["halton-2-3", runAt("halton-2-3-progressive"), "stratified-seed-mean", seedMean],
  ];
  const highTierCrossMethodAgreement: GroundGlassM5sStratumStudy["highTierCrossMethodAgreement"][number][] = [];
  for (const [nameA, valueA, nameB, valueB] of crossPairs) {
    const a = valueA instanceof Float64Array ? valueA
      : valueA ? rgbFor(valueA, ids, "limitingIntegralRgb") : null;
    const b = valueB instanceof Float64Array ? valueB
      : valueB ? rgbFor(valueB, ids, "limitingIntegralRgb") : null;
    highTierCrossMethodAgreement.push({
      methods: [nameA, nameB],
      metrics: a && b ? compareGroundGlassM5sRgb(a, b) : compareGroundGlassM5sRgb([], []),
    });
  }

  let maximumSeedRmse = 0;
  let maximumSeedChannelError = 0;
  let seedVariationAvailable = seedRuns.length >= 2 && seedMean !== null;
  for (const run of seedRuns) {
    const values = rgbFor(run, ids, "limitingIntegralRgb");
    if (!values || !seedMean) {
      seedVariationAvailable = false;
      continue;
    }
    const metric = compareGroundGlassM5sRgb(values, seedMean);
    if (metric.rmse === null || metric.maximumChannelError === null) seedVariationAvailable = false;
    else {
      maximumSeedRmse = Math.max(maximumSeedRmse, metric.rmse);
      maximumSeedChannelError = Math.max(maximumSeedChannelError, metric.maximumChannelError);
    }
  }
  const seedVariation = seedRuns[0] && seedMean
    ? compareGroundGlassM5sRgb(rgbFor(seedRuns[0], ids, "limitingIntegralRgb") ?? [], seedMean)
    : compareGroundGlassM5sRgb([], []);
  const evidence = evaluateGroundGlassM5sEvidence({
    provenanceStatus: input.provenanceStatus,
    candidateCount: stratum.candidateCount,
    selectedPixelCount: ids.length,
    minimumSupport: stratum.minimumSupport,
    analyticAuthority,
    blurPreservationStatus: input.blurPreservationByStratum?.[stratum.id] ?? "unresolved",
    withinMethodConvergence: finalTierWithinMethod.length ? finalTierWithinMethod : null,
    crossMethodAgreement: highTierCrossMethodAgreement.map(({ metrics }) => metrics),
    randomizedSeedVariationRmse: seedVariationAvailable ? maximumSeedRmse : null,
    randomizedSeedVariationMaximumChannelError: seedVariationAvailable ? maximumSeedChannelError : null,
  });
  return {
    stratum,
    convergenceCurves,
    finalTierWithinMethod,
    highTierCrossMethodAgreement,
    randomizedSeedVariation: seedVariation,
    maximumSeedRmse: seedVariationAvailable ? maximumSeedRmse : null,
    maximumSeedChannelError: seedVariationAvailable ? maximumSeedChannelError : null,
    evidence,
  };
  });
};

export const aggregateGroundGlassM5sStrata = (
  studies: readonly GroundGlassM5sStratumStudy[],
): Readonly<{
  classification: GroundGlassM5sConvergenceClassification;
  supportedStrata: readonly GroundGlassM5sRoiStratumId[];
  unresolvedStrata: readonly GroundGlassM5sRoiStratumId[];
  referenceAuthority: "supported-for-exact-strata-only" | "unresolved" | "none";
}> => {
  const supportedStrata = studies.filter(({ evidence }) =>
    evidence.classification === "converged-and-cross-validated").map(({ stratum }) => stratum.id);
  const unresolvedStrata = studies.filter(({ evidence }) =>
    evidence.classification !== "converged-and-cross-validated").map(({ stratum }) => stratum.id);
  const adequatelySupported = studies.filter(({ evidence }) => evidence.adequateSupport === true);
  if (!studies.length || !adequatelySupported.length) {
    return { classification: "insufficient-support", supportedStrata, unresolvedStrata, referenceAuthority: "none" };
  }
  if (!supportedStrata.length) {
    const classifications = adequatelySupported.map(({ evidence }) => evidence.classification);
    const classification = classifications.includes("analytically-invalid")
      ? "analytically-invalid"
      : classifications.includes("invalid-comparison")
        ? "invalid-comparison"
        : classifications.includes("systematic-method-disagreement")
          ? "systematic-method-disagreement"
          : classifications.includes("converged-within-one-method-only")
            ? "converged-within-one-method-only"
            : "convergence-trending-but-unresolved";
    return { classification, supportedStrata, unresolvedStrata, referenceAuthority: "unresolved" };
  }
  if (!unresolvedStrata.length) {
    return { classification: "converged-and-cross-validated", supportedStrata, unresolvedStrata,
      referenceAuthority: "supported-for-exact-strata-only" };
  }
  return { classification: "convergence-trending-but-unresolved", supportedStrata, unresolvedStrata,
    referenceAuthority: "supported-for-exact-strata-only" };
};


export const GROUND_GLASS_M5S_UNIT_DISK_SECOND_MOMENT_EXPECTATION = 0.5;
/** 0.03 is a fixed 3-sigma-scale allowance for N=1024 and rejects 1/8 or 1/3 bias. */
export const GROUND_GLASS_M5S_UNIT_DISK_SECOND_MOMENT_TOLERANCE = 0.03;

export type GroundGlassM5sAnalyticCaseId =
  | "uniformColor"
  | "affineGradient"
  | "planarBoundary"
  | "compactSilhouette"
  | "depthRejection"
  | "radiusCap"
  | "unitDiskAreaMoment"
  | "sharpSourceNegativeControl";

export type GroundGlassM5sAnalyticCaseResult = Readonly<{
  status: "passed" | "failed" | "not-run";
  observed: number | null;
  expected: number | null;
  absoluteError: number | null;
  tolerance: number;
  detail: string;
}>;

export type GroundGlassM5sAnalyticControlReport = Readonly<{
  method: GroundGlassM5sSamplingMethod;
  sequenceId: string;
  algorithmRevision: typeof GROUND_GLASS_M5S_PROPOSAL_ALGORITHM_REVISION;
  sampleCount: number;
  seed: number | null;
  progressivePrefix: boolean;
  strategyId: string;
  coordinateFingerprint: string | null;
  proposalAudit: ReturnType<typeof auditGroundGlassM5sProposalStrategy>;
  analyticCases: Readonly<Record<GroundGlassM5sAnalyticCaseId, GroundGlassM5sAnalyticCaseResult>>;
  analyticStatus: "passed" | "failed";
  failedCriteria: readonly string[];
  observedErrors: Readonly<Record<GroundGlassM5sAnalyticCaseId, number | null>>;
  declaredTolerances: Readonly<Record<GroundGlassM5sAnalyticCaseId, number>>;
  independentRasterOracle: Readonly<{
    method: "512x512 midpoint quadrature over unit disk and nearest-source raster cells";
    resolutionPerAxis: number;
    evaluatedDiskPoints: number | null;
  }>;
}>;

const makeAnalyticFixture = (size = 65): GroundGlassM5sFarReferenceInput => {
  const pixelCount = size * size;
  const center = Math.floor(size / 2);
  const sourceRgba = new Float32Array(pixelCount * 4);
  const physicalRgba = new Float32Array(pixelCount * 4);
  const validity = new Uint8Array(pixelCount).fill(1);
  const depth = new Float32Array(pixelCount).fill(0.5);
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    sourceRgba.set([0, 0, 0, 1], pixel * 4);
    physicalRgba.set([1, 16, 16, 0], pixel * 4);
  }
  return {
    source: { widthPx: size, heightPx: size },
    gather: { widthPx: 1, heightPx: 1 },
    film: { widthMm: size, heightMm: size },
    sourceRgba,
    physicalRgba,
    validity,
    depth,
    observedGatherCenterSourceIds: new Int32Array([center, center]),
    observedGatherCenterSourceUvs: new Float32Array([(center + 0.5) / size, (center + 0.5) / size]),
    inverseProjectionMatrix: new Float64Array([
      1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1,
    ]),
    maximumRadiusPx: 32,
    inputFingerprints: {
      sourceColor: "synthetic-source-v1",
      depth: "synthetic-depth-v1",
      physical: "synthetic-physical-v1",
      validity: "synthetic-validity-v1",
    },
  };
};

const runAnalytic = (
  referenceInput: GroundGlassM5sFarReferenceInput,
  strategy: GroundGlassM5sProposalStrategy,
) => runGroundGlassM5sSparseFarReference({
  referenceInput,
  selectedGatherPixelIds: [0],
  strategy,
}).pixels[0]!;

const rasterMidpointLimit = (
  input: GroundGlassM5sFarReferenceInput,
  resolution: number,
): Readonly<{ rgb: readonly [number, number, number]; evaluatedDiskPoints: number }> => {
  const centerX = input.observedGatherCenterSourceIds[0]!;
  const centerY = input.observedGatherCenterSourceIds[1]!;
  const centerSourceId = centerY * input.source.widthPx + centerX;
  const centerOffset = centerSourceId * 4;
  const centerUv: GroundGlassPixelAxis = [
    input.observedGatherCenterSourceUvs[0]!,
    input.observedGatherCenterSourceUvs[1]!,
  ];
  const ellipse = capGroundGlassPixelEllipse(mapGroundGlassPhysicalEllipseToSourcePixels({
    majorRadiusMm: input.physicalRgba[centerOffset + 1]!,
    minorRadiusMm: input.physicalRgba[centerOffset + 2]!,
    orientationRad: input.physicalRgba[centerOffset + 3]! * Math.PI,
    film: input.film,
    source: input.source,
  }), input.maximumRadiusPx);
  const centerDistance = groundGlassViewDistanceMmAtTopUv(
    centerUv[0], centerUv[1], input.depth[centerSourceId]!, input.inverseProjectionMatrix,
  );
  const depthTolerance = Math.max(
    GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FLOOR_MM,
    centerDistance * GROUND_GLASS_APERTURE_DEPTH_TOLERANCE_FRACTION,
  );
  const sum = [0, 0, 0];
  let acceptedCount = 0;
  let evaluatedDiskPoints = 0;
  for (let row = 0; row < resolution; row += 1) {
    const diskY = -1 + (row + 0.5) * 2 / resolution;
    for (let column = 0; column < resolution; column += 1) {
      const diskX = -1 + (column + 0.5) * 2 / resolution;
      if (diskX * diskX + diskY * diskY > 1) continue;
      evaluatedDiskPoints += 1;
      const offsetX = (ellipse.majorAxisPx[0] * diskX + ellipse.minorAxisPx[0] * diskY)
        * ellipse.clampScale;
      const offsetY = (ellipse.majorAxisPx[1] * diskX + ellipse.minorAxisPx[1] * diskY)
        * ellipse.clampScale;
      const u = Math.fround(Math.min(1, Math.max(0,
        centerUv[0] + offsetX / input.source.widthPx)));
      const v = Math.fround(Math.min(1, Math.max(0,
        centerUv[1] + offsetY / input.source.heightPx)));
      const [sampleX, sampleY] = nearestGroundGlassSourcePixelAtTopUv(u, v, input.source);
      const sampleId = sampleY * input.source.widthPx + sampleX;
      const sampleOffset = sampleId * 4;
      const distance = groundGlassViewDistanceMmAtTopUv(
        u, v, input.depth[sampleId]!, input.inverseProjectionMatrix,
      );
      const accepted = input.validity[sampleId] === 1
        && input.depth[sampleId]! < 1
        && input.physicalRgba[sampleOffset]! >= -GROUND_GLASS_APERTURE_SIGN_EPSILON_MM
        && distance >= centerDistance - depthTolerance;
      if (!accepted) continue;
      acceptedCount += 1;
      for (let channel = 0; channel < 3; channel += 1) {
        sum[channel]! += input.sourceRgba[sampleOffset + channel]!;
      }
    }
  }
  return {
    rgb: acceptedCount
      ? [sum[0]! / acceptedCount, sum[1]! / acceptedCount, sum[2]! / acceptedCount]
      : [Number.NaN, Number.NaN, Number.NaN],
    evaluatedDiskPoints,
  };
};

/** Runs the bounded analytic suite against exactly the supplied proposal sequence. */
export const evaluateGroundGlassM5sProposalAnalyticControls = (
  strategy: GroundGlassM5sProposalStrategy,
): GroundGlassM5sAnalyticControlReport => {
  const proposalAudit = auditGroundGlassM5sProposalStrategy(strategy);
  const tolerances: Record<GroundGlassM5sAnalyticCaseId, number> = {
    uniformColor: 1e-7,
    affineGradient: 0.02,
    planarBoundary: 0.025,
    compactSilhouette: 0.025,
    depthRejection: 1e-7,
    radiusCap: 1e-8,
    unitDiskAreaMoment: GROUND_GLASS_M5S_UNIT_DISK_SECOND_MOMENT_TOLERANCE,
    sharpSourceNegativeControl: 0.01,
  };
  const cases: Partial<Record<GroundGlassM5sAnalyticCaseId, GroundGlassM5sAnalyticCaseResult>> = {};
  let rasterOracle: ReturnType<typeof rasterMidpointLimit> | null = null;
  const notRun = (id: GroundGlassM5sAnalyticCaseId, detail: string) => {
    cases[id] = { status: "not-run", observed: null, expected: null, absoluteError: null,
      tolerance: tolerances[id], detail };
  };

  if (proposalAudit.status !== "valid") {
    for (const id of Object.keys(tolerances) as GroundGlassM5sAnalyticCaseId[]) {
      notRun(id, "proposal sequence failed structural validation; numerical case was not run");
    }
  } else {

  const uniform = makeAnalyticFixture();
  for (let pixel = 0; pixel < uniform.source.widthPx * uniform.source.heightPx; pixel += 1) {
    uniform.sourceRgba.set([0.2, 0.4, 0.7, 1], pixel * 4);
  }
  const uniformResult = runAnalytic(uniform, strategy);
  const uniformError = Math.max(...uniformResult.limitingIntegralRgb!
    .map((value, channel) => Math.abs(value - [0.2, 0.4, 0.7][channel]!)));
  cases.uniformColor = {
    status: uniformError <= tolerances.uniformColor ? "passed" : "failed",
    observed: uniformResult.limitingIntegralRgb![0],
    expected: 0.2,
    absoluteError: uniformError,
    tolerance: tolerances.uniformColor,
    detail: "uniform valid Far color is invariant under aperture integration",
  };

  const gradient = makeAnalyticFixture();
  const center = Math.floor(gradient.source.widthPx / 2);
  for (let y = 0; y < gradient.source.heightPx; y += 1) {
    for (let x = 0; x < gradient.source.widthPx; x += 1) {
      const pixel = y * gradient.source.widthPx + x;
      gradient.sourceRgba.set([
        0.5 + 0.3 * (x - center) / 20,
        0.5 + 0.2 * (y - center) / 20,
        0.4,
        1,
      ], pixel * 4);
    }
  }
  const gradientResult = runAnalytic(gradient, strategy);
  const gradientError = Math.max(...gradientResult.limitingIntegralRgb!
    .map((value, channel) => Math.abs(value - [0.5, 0.5, 0.4][channel]!)));
  cases.affineGradient = {
    status: gradientError <= tolerances.affineGradient ? "passed" : "failed",
    observed: gradientResult.limitingIntegralRgb![0],
    expected: 0.5,
    absoluteError: gradientError,
    tolerance: tolerances.affineGradient,
    detail: "symmetric continuous-disk average equals center color; raster field is symmetric around center texel",
  };

  const boundary = makeAnalyticFixture();
  for (let y = 0; y < boundary.source.heightPx; y += 1) {
    for (let x = 0; x < boundary.source.widthPx; x += 1) {
      const red = x < center ? 0 : x > center ? 1 : 0.5;
      boundary.sourceRgba.set([red, 0, 0, 1], (y * boundary.source.widthPx + x) * 4);
    }
  }
  const boundaryResult = runAnalytic(boundary, strategy);
  const boundaryError = Math.abs(boundaryResult.limitingIntegralRgb![0] - 0.5);
  cases.planarBoundary = {
    status: boundaryError <= tolerances.planarBoundary ? "passed" : "failed",
    observed: boundaryResult.limitingIntegralRgb![0],
    expected: 0.5,
    absoluteError: boundaryError,
    tolerance: tolerances.planarBoundary,
    detail: "symmetric half-plane integral with explicit half-coverage center source texel",
  };

  const silhouette = makeAnalyticFixture();
  const silhouetteRadiusPx = 6;
  for (let y = 0; y < silhouette.source.heightPx; y += 1) {
    for (let x = 0; x < silhouette.source.widthPx; x += 1) {
      const inside = Math.hypot(x - center, y - center) <= silhouetteRadiusPx;
      silhouette.sourceRgba.set([inside ? 1 : 0, 0, 0, 1],
        (y * silhouette.source.widthPx + x) * 4);
    }
  }
  const silhouetteResult = runAnalytic(silhouette, strategy);
  rasterOracle = rasterMidpointLimit(silhouette, 512);
  const silhouetteError = Math.abs(silhouetteResult.limitingIntegralRgb![0] - rasterOracle.rgb[0]);
  cases.compactSilhouette = {
    status: silhouetteError <= tolerances.compactSilhouette ? "passed" : "failed",
    observed: silhouetteResult.limitingIntegralRgb![0],
    expected: rasterOracle.rgb[0],
    absoluteError: silhouetteError,
    tolerance: tolerances.compactSilhouette,
    detail: "the supplied proposal sequence is compared with independent 512x512 raster midpoint quadrature",
  };

  const depthLayers = makeAnalyticFixture();
  for (let y = 0; y < depthLayers.source.heightPx; y += 1) {
    for (let x = 0; x < depthLayers.source.widthPx; x += 1) {
      const pixel = y * depthLayers.source.widthPx + x;
      if (x > center + 3) {
        depthLayers.sourceRgba.set([1, 1, 1, 1], pixel * 4);
        depthLayers.physicalRgba[pixel * 4] = 0;
        depthLayers.depth[pixel] = 0.4;
      }
    }
  }
  const depthResult = runAnalytic(depthLayers, strategy);
  const depthError = Math.max(...depthResult.limitingIntegralRgb!.map((value) => Math.abs(value)));
  cases.depthRejection = {
    status: depthError <= tolerances.depthRejection ? "passed" : "failed",
    observed: depthResult.limitingIntegralRgb![0],
    expected: 0,
    absoluteError: depthError,
    tolerance: tolerances.depthRejection,
    detail: "nearer zero-CoC samples pass signed-CoC eligibility but fail depth acceptance",
  };

  const capped = makeAnalyticFixture();
  const centerPixel = center * capped.source.widthPx + center;
  capped.physicalRgba.set([1, 40, 20, 0], centerPixel * 4);
  const capResult = runAnalytic({ ...capped, maximumRadiusPx: 5 }, strategy);
  const capPassed = capResult.effectiveMaximumRadiusPx <= 5 + 1e-8
    && capResult.capApplied
    && Math.abs(capResult.effectiveMaximumRadiusPx - 5) <= 1e-8;
  cases.radiusCap = {
    status: capPassed ? "passed" : "failed",
    observed: capResult.effectiveMaximumRadiusPx,
    expected: 5,
    absoluteError: Math.abs(capResult.effectiveMaximumRadiusPx - 5),
    tolerance: tolerances.radiusCap,
    detail: "physical ellipse is mapped to source pixels before the 5 px radius cap is applied",
  };

  const moment = integrateGroundGlassM5sUnitDiskFunction(strategy, ([x, y]) => x * x + y * y);
  const momentError = Math.abs(moment - GROUND_GLASS_M5S_UNIT_DISK_SECOND_MOMENT_EXPECTATION);
  cases.unitDiskAreaMoment = {
    status: momentError <= tolerances.unitDiskAreaMoment ? "passed" : "failed",
    observed: moment,
    expected: GROUND_GLASS_M5S_UNIT_DISK_SECOND_MOMENT_EXPECTATION,
    absoluteError: momentError,
    tolerance: tolerances.unitDiskAreaMoment,
    detail: "equal-area unit-disk proposals satisfy E[x^2 + y^2] = 1/2; a fixed 0.03 finite-sample tolerance rejects center and uniform-radius bias",
  };

  const blur = evaluateGroundGlassM5sBlurPreservation({
    sourceRgb: silhouetteResult.centerRgb,
    expectedBlurRgb: silhouetteResult.limitingIntegralRgb!,
    candidateRgb: silhouetteResult.centerRgb,
  });
  cases.sharpSourceNegativeControl = {
    status: blur.status === "failed" && blur.expectedBlurSignalPresent === true ? "passed" : "failed",
    observed: blur.sourceToCandidate.rmse,
    expected: blur.sourceToExpectedBlur.rmse,
    absoluteError: blur.expectedToCandidate.rmse,
    tolerance: tolerances.sharpSourceNegativeControl,
    detail: "sharp-source substitution is rejected because it removes the analytic defocus transition",
  };
  }

  const analyticCases = cases as Readonly<Record<GroundGlassM5sAnalyticCaseId, GroundGlassM5sAnalyticCaseResult>>;
  const failedCriteria = [
    ...(proposalAudit.status !== "valid" ? ["proposalAudit"] : []),
    ...Object.entries(analyticCases).flatMap(([id, result]) => result.status === "passed" ? [] : [id]),
  ];
  const strategyDescriptor = strategy.descriptor;
  const strategyIdValue = groundGlassM5sProposalIdentityKey(strategyDescriptor);
  const observedErrors = Object.fromEntries(Object.entries(analyticCases)
    .map(([id, result]) => [id, result.absoluteError])) as Record<GroundGlassM5sAnalyticCaseId, number | null>;
  let coordinateFingerprint: string | null = null;
  try {
    coordinateFingerprint = fingerprintGroundGlassM5sProposalCoordinates(strategy);
  } catch {
    failedCriteria.push("coordinateFingerprint");
  }
  return {
    method: strategyDescriptor.method,
    sequenceId: strategyDescriptor.sequenceId,
    algorithmRevision: strategyDescriptor.algorithmRevision,
    sampleCount: strategyDescriptor.sampleCount,
    seed: strategyDescriptor.seed,
    progressivePrefix: strategyDescriptor.progressivePrefix,
    strategyId: strategyIdValue,
    coordinateFingerprint,
    proposalAudit,
    analyticCases,
    analyticStatus: failedCriteria.length === 0 ? "passed" : "failed",
    failedCriteria,
    observedErrors,
    declaredTolerances: tolerances,
    independentRasterOracle: {
      method: "512x512 midpoint quadrature over unit disk and nearest-source raster cells",
      resolutionPerAxis: 512,
      evaluatedDiskPoints: rasterOracle?.evaluatedDiskPoints ?? null,
    },
  };
};

