import {
  absoluteLinearLumaDifference,
  compareLinearRgbaRasters,
  countFallbackSourceColorMismatches,
  depthBoundaryDistances,
  largestBinaryComponent,
} from "./ground-glass-webgpu-correspondence-large-coc-cases";
import { resolveGroundGlassInspectionWindow } from "../../../render/groundGlassInspectionWindow";

export type InteriorCocCandidate = Readonly<{
  id: string;
  magnification: 8 | 12 | 16;
  pan: Readonly<{ x: number; y: number }>;
}>;

/** Geometry-only search, declared before native quality measurements. */
export const PHASE_L_CANDIDATES: readonly InteriorCocCandidate[] = [8, 12, 16].flatMap((magnification) =>
  [0, -0.5, -0.75, -1].map((y) => ({
    id: `m${magnification}-y${String(y).replace("-", "n").replace(".", "p")}`,
    magnification: magnification as 8 | 12 | 16,
    pan: { x: 0, y },
  })),
);

export const PHASE_L_INTERIOR_TARGETS = {
  radiusCapPx: 12,
  minimumInteriorCapPixels: 200,
  minimumLargestInteriorCapComponent: 128,
  minimumInteriorCapFarDepthEdgePixels: 32,
  minimumHighContrastFarDepthEdgePairs: 32,
  minimumSourceContrastRgb: 0.05,
  cappedSupportMarginPx: 16,
  edgeDepthDeltaMm: 1,
} as const;

/**
 * Post-exploration engineering limits frozen prospectively for the corrective
 * confirmatory run. These are fixture-specific normalized-linear-RGB bounds,
 * not universal photographic quality standards.
 */
export const PHASE_L_QUALITY_ACCEPTANCE = {
  minimumInteriorCapFarPixels: 200,
  minimumInteriorCapFarDepthEdgePixels: 32,
  maximumReferenceEdgeRmse: 0.002,
  maximumReferenceInteriorFarRmse: 0.001,
  maximumCandidateEdgeRmse: 0.005,
  maximumCandidateInteriorFarRmse: 0.003,
  maximumCandidateToReferenceUncertaintyRatio: 3,
  referenceUncertaintyFloor: 0.0005,
  maximumNearRgbError: 0.0001,
  maximumNearAlphaError: 0.0001,
} as const;

type PhaseLRoiQuality = Readonly<{
  interiorFarRmse: number | null;
  edgeRmse: number | null;
}>;

type PhaseLRoiPopulations = Readonly<{
  interiorFar: Readonly<{ full32: number | null; full64: number | null; b0: number | null; b1: number | null }>;
  edge: Readonly<{ full32: number | null; full64: number | null; b0: number | null; b1: number | null }>;
}>;

export type PhaseLQualityDecisionInput = Readonly<{
  candidateQualified: boolean;
  matchedNativeProvenance: boolean;
  referenceConvergence: PhaseLRoiQuality;
  b0Quality: PhaseLRoiQuality;
  b1Quality: PhaseLRoiQuality;
  roiPopulations: PhaseLRoiPopulations;
  nearRgba: Readonly<{ rgbRmse: number | null; rgbMax: number | null; alphaRmse: number | null; alphaMax: number | null }>;
  fallbackEvidence: Readonly<{ interiorFarFallbackPixels: number | null; interiorFarSharpFallbackPixels: number | null; sourceRgbMismatchPixels: number | null }>;
  acceptance?: typeof PHASE_L_QUALITY_ACCEPTANCE;
}>;

/** Pure, fail-closed decision over matched Phase L readback evidence. */
export function evaluatePhaseLQualityDecision(input: PhaseLQualityDecisionInput) {
  const acceptance = input.acceptance ?? PHASE_L_QUALITY_ACCEPTANCE;
  const finite = (value: number | null): value is number => value !== null && Number.isFinite(value);
  const finiteNonNegative = (value: number | null): value is number => finite(value) && value >= 0;
  const populationValues = (values: PhaseLRoiPopulations[keyof PhaseLRoiPopulations]) =>
    [values.full32, values.full64, values.b0, values.b1];
  const roiPopulationValid = (values: PhaseLRoiPopulations[keyof PhaseLRoiPopulations], minimum: number) => {
    const samples = populationValues(values);
    return samples.every((value) => value !== null && Number.isInteger(value) && value >= minimum)
      && samples.every((value) => value === samples[0]);
  };
  const roiPopulationsValid = roiPopulationValid(input.roiPopulations.interiorFar, acceptance.minimumInteriorCapFarPixels)
    && roiPopulationValid(input.roiPopulations.edge, acceptance.minimumInteriorCapFarDepthEdgePixels);
  const values = [
    input.referenceConvergence.interiorFarRmse,
    input.referenceConvergence.edgeRmse,
    input.b0Quality.interiorFarRmse,
    input.b0Quality.edgeRmse,
    input.b1Quality.interiorFarRmse,
    input.b1Quality.edgeRmse,
    input.nearRgba.rgbRmse,
    input.nearRgba.rgbMax,
    input.nearRgba.alphaRmse,
    input.nearRgba.alphaMax,
    input.fallbackEvidence.interiorFarFallbackPixels,
    input.fallbackEvidence.interiorFarSharpFallbackPixels,
    input.fallbackEvidence.sourceRgbMismatchPixels,
    ...populationValues(input.roiPopulations.interiorFar),
    ...populationValues(input.roiPopulations.edge),
  ];
  const measurementsFinite = values.every(finiteNonNegative);
  const referenceConverged = finiteNonNegative(input.referenceConvergence.interiorFarRmse)
    && finiteNonNegative(input.referenceConvergence.edgeRmse)
    && input.referenceConvergence.interiorFarRmse <= acceptance.maximumReferenceInteriorFarRmse
    && input.referenceConvergence.edgeRmse <= acceptance.maximumReferenceEdgeRmse;
  const candidateWithinAbsoluteBounds = finiteNonNegative(input.b1Quality.interiorFarRmse)
    && finiteNonNegative(input.b1Quality.edgeRmse)
    && input.b1Quality.interiorFarRmse <= acceptance.maximumCandidateInteriorFarRmse
    && input.b1Quality.edgeRmse <= acceptance.maximumCandidateEdgeRmse;
  const acceptableRelativeError = (candidate: number | null, reference: number | null, absoluteLimit: number) =>
    finiteNonNegative(candidate) && finiteNonNegative(reference)
      && candidate <= Math.min(
        absoluteLimit,
        acceptance.maximumCandidateToReferenceUncertaintyRatio * Math.max(reference, acceptance.referenceUncertaintyFloor),
      );
  const candidateWithinUncertaintyBounds = acceptableRelativeError(
    input.b1Quality.interiorFarRmse,
    input.referenceConvergence.interiorFarRmse,
    acceptance.maximumCandidateInteriorFarRmse,
  ) && acceptableRelativeError(
    input.b1Quality.edgeRmse,
    input.referenceConvergence.edgeRmse,
    acceptance.maximumCandidateEdgeRmse,
  );
  const nearRgbaInvariant = finiteNonNegative(input.nearRgba.rgbRmse)
    && finiteNonNegative(input.nearRgba.rgbMax)
    && finiteNonNegative(input.nearRgba.alphaRmse)
    && finiteNonNegative(input.nearRgba.alphaMax)
    && input.nearRgba.rgbRmse <= acceptance.maximumNearRgbError
    && input.nearRgba.rgbMax <= acceptance.maximumNearRgbError
    && input.nearRgba.alphaRmse <= acceptance.maximumNearAlphaError
    && input.nearRgba.alphaMax <= acceptance.maximumNearAlphaError;
  const fallbackValues = [
    input.fallbackEvidence.interiorFarFallbackPixels,
    input.fallbackEvidence.interiorFarSharpFallbackPixels,
    input.fallbackEvidence.sourceRgbMismatchPixels,
  ];
  const fallbackEvidenceValid = fallbackValues.every((value) => finite(value) && Number.isInteger(value) && value === 0);
  const checks = {
    candidateQualified: input.candidateQualified,
    matchedNativeProvenance: input.matchedNativeProvenance,
    measurementsFinite,
    roiPopulationValid: roiPopulationsValid,
    referenceConverged,
    candidateWithinAbsoluteBounds,
    candidateWithinUncertaintyBounds,
    nearRgbaInvariant,
    fallbackEvidenceValid,
  };
  const failedCriteria = Object.entries(checks).filter(([, passed]) => !passed).map(([name]) => name);
  const outcome = !input.candidateQualified
    ? "L-D"
    : !input.matchedNativeProvenance || !measurementsFinite || !roiPopulationsValid || !referenceConverged
      ? "L-E"
      : !candidateWithinAbsoluteBounds || !candidateWithinUncertaintyBounds || !nearRgbaInvariant || !fallbackEvidenceValid
        ? "L-B"
        : "L-A";
  return {
    outcome,
    checks,
    measurements: {
      referenceInteriorRmse: input.referenceConvergence.interiorFarRmse,
      referenceEdgeRmse: input.referenceConvergence.edgeRmse,
      b0InteriorRmse: input.b0Quality.interiorFarRmse,
      b0EdgeRmse: input.b0Quality.edgeRmse,
      b1InteriorRmse: input.b1Quality.interiorFarRmse,
      b1EdgeRmse: input.b1Quality.edgeRmse,
      acceptableB1InteriorRmse: finite(input.referenceConvergence.interiorFarRmse)
        ? Math.min(acceptance.maximumCandidateInteriorFarRmse, acceptance.maximumCandidateToReferenceUncertaintyRatio * Math.max(input.referenceConvergence.interiorFarRmse, acceptance.referenceUncertaintyFloor))
        : null,
      acceptableB1EdgeRmse: finite(input.referenceConvergence.edgeRmse)
        ? Math.min(acceptance.maximumCandidateEdgeRmse, acceptance.maximumCandidateToReferenceUncertaintyRatio * Math.max(input.referenceConvergence.edgeRmse, acceptance.referenceUncertaintyFloor))
        : null,
    },
    failedCriteria,
  } as const;
}

export type PhaseLCandidateSelectionRecord = Readonly<{
  id: string;
  score: readonly number[];
  qualified: boolean;
  rejectionReasons: readonly string[];
}>;

export function selectPhaseLCandidates<T extends PhaseLCandidateSelectionRecord>(candidates: readonly T[]) {
  const sortedCandidates = [...candidates].sort((left, right) => {
    for (let index = 0; index < Math.max(left.score.length, right.score.length); index += 1) {
      const delta = (right.score[index] ?? 0) - (left.score[index] ?? 0);
      if (delta) return delta;
    }
    return 0;
  });
  const qualifiedCandidates = sortedCandidates.filter((candidate) => candidate.qualified);
  const selectedCandidate = qualifiedCandidates[0] ?? null;
  return {
    sortedCandidates,
    qualifiedCandidates,
    selectedCandidate,
    bestUnqualifiedCandidate: selectedCandidate ? null : sortedCandidates[0] ?? null,
  } as const;
}

export type PhaseLCandidateSearchArtifact<T extends PhaseLCandidateSelectionRecord> = Readonly<{
  discoveryCandidateCount: number;
  qualifiedCandidateCount: number;
  predeclaredCriteria: unknown;
  qualityAcceptance: typeof PHASE_L_QUALITY_ACCEPTANCE;
  candidates: readonly T[];
  selectedForConfirmation: string | null;
  bestUnqualifiedCandidateForExplorationOnly: string | null;
  nativeRuntime: unknown;
  selectionPolicy: string;
}>;

export function buildPhaseLCandidateSearchArtifact<T extends PhaseLCandidateSelectionRecord>(input: {
  candidates: readonly T[];
  selectedCandidateId: string | null;
  bestUnqualifiedCandidateId: string | null;
  predeclaredCriteria: unknown;
  qualityAcceptance: typeof PHASE_L_QUALITY_ACCEPTANCE;
  nativeRuntime: unknown;
  selectionPolicy: string;
}): PhaseLCandidateSearchArtifact<T> {
  const qualifiedCandidateCount = input.candidates.filter((candidate) => candidate.qualified).length;
  const selected = input.selectedCandidateId === null
    ? null
    : input.candidates.find((candidate) => candidate.id === input.selectedCandidateId) ?? null;
  const bestUnqualified = input.bestUnqualifiedCandidateId === null
    ? null
    : input.candidates.find((candidate) => candidate.id === input.bestUnqualifiedCandidateId) ?? null;
  if (input.selectedCandidateId !== null && (!selected || !selected.qualified)) {
    throw new Error("Phase L selected candidate must exist and be geometry-qualified");
  }
  if (input.selectedCandidateId === null && qualifiedCandidateCount > 0) {
    throw new Error("Phase L cannot omit selection when a qualified candidate exists");
  }
  if (input.bestUnqualifiedCandidateId !== null && (!bestUnqualified || bestUnqualified.qualified)) {
    throw new Error("Phase L exploratory candidate must exist and remain unqualified");
  }

  return {
    discoveryCandidateCount: input.candidates.length,
    qualifiedCandidateCount,
    predeclaredCriteria: input.predeclaredCriteria,
    qualityAcceptance: input.qualityAcceptance,
    candidates: input.candidates,
    selectedForConfirmation: input.selectedCandidateId,
    bestUnqualifiedCandidateForExplorationOnly: input.bestUnqualifiedCandidateId,
    nativeRuntime: input.nativeRuntime,
    selectionPolicy: input.selectionPolicy,
  };
}

export function buildPhaseLNoCandidateReport<T extends PhaseLCandidateSelectionRecord>(input: {
  candidateSearch: PhaseLCandidateSearchArtifact<T>;
  nativeRuntime: unknown;
}) {
  if (input.candidateSearch.selectedForConfirmation !== null || input.candidateSearch.qualifiedCandidateCount !== 0) {
    throw new Error("Phase L L-D report requires no qualified or selected candidate");
  }

  const noMeasurement: PhaseLRoiQuality = { interiorFarRmse: null, edgeRmse: null };
  const noPopulation: PhaseLRoiPopulations[keyof PhaseLRoiPopulations] = {
    full32: null,
    full64: null,
    b0: null,
    b1: null,
  };
  const qualityDecisionEvidence = evaluatePhaseLQualityDecision({
    candidateQualified: false,
    matchedNativeProvenance: false,
    referenceConvergence: noMeasurement,
    b0Quality: noMeasurement,
    b1Quality: noMeasurement,
    roiPopulations: { interiorFar: noPopulation, edge: noPopulation },
    nearRgba: { rgbRmse: null, rgbMax: null, alphaRmse: null, alphaMax: null },
    fallbackEvidence: {
      interiorFarFallbackPixels: null,
      interiorFarSharpFallbackPixels: null,
      sourceRgbMismatchPixels: null,
    },
  });
  const bestUnqualified = input.candidateSearch.bestUnqualifiedCandidateForExplorationOnly === null
    ? null
    : input.candidateSearch.candidates.find((candidate) => candidate.id === input.candidateSearch.bestUnqualifiedCandidateForExplorationOnly) ?? null;

  return {
    discoveryCandidateCount: input.candidateSearch.discoveryCandidateCount,
    qualifiedCandidateCount: 0,
    selectedCandidate: null,
    bestUnqualifiedCandidate: bestUnqualified ? {
      id: bestUnqualified.id,
      score: bestUnqualified.score,
      rejectionReasons: bestUnqualified.rejectionReasons,
    } : null,
    decision: qualityDecisionEvidence.outcome,
    decisionReason: "No candidate satisfies the frozen geometry qualification.",
    qualityMatrixStatus: "not-run-no-qualified-candidate",
    qualityMatrix: null,
    nativeRuntime: input.nativeRuntime,
    qualityAcceptance: input.candidateSearch.qualityAcceptance,
    qualityDecisionEvidence,
  } as const;
}

export function passesPhaseLConfirmatoryAcceptance(
  evaluation: ReturnType<typeof evaluatePhaseLQualityDecision> | null,
) {
  return evaluation !== null
    && evaluation.outcome === "L-A"
    && evaluation.failedCriteria.length === 0
    && Object.values(evaluation.checks).every((passed) => passed === true);
}

export const resolvePhaseLCandidateWindow = (candidate: InteriorCocCandidate) =>
  resolveGroundGlassInspectionWindow({
    active: true,
    magnification: candidate.magnification,
    normalizedPan: candidate.pan,
  });

const count = (mask: Uint8Array) => mask.reduce((sum, value) => sum + (value ? 1 : 0), 0);

export type PhaseLPreflightResult = ReturnType<typeof analyzeInteriorCocPreflight>;

/** Analyze actual top-origin GPU readbacks; no B0/B1 quality values enter candidate selection. */
export function analyzeInteriorCocPreflight(input: {
  width: number;
  height: number;
  capPx: number;
  sourceRgba: Float32Array;
  worldPositionRgba: Float32Array;
  physicalRgba: Float32Array;
  validity: Uint8Array;
  radiusDiagnosticsRgba: Float32Array;
  cameraForwardWorld: readonly [number, number, number];
}) {
  const { width, height } = input;
  const size = width * height;
  for (const [name, values, expected] of [
    ["source", input.sourceRgba, size * 4],
    ["world position", input.worldPositionRgba, size * 4],
    ["physical", input.physicalRgba, size * 4],
    ["validity", input.validity, size],
    ["radius diagnostics", input.radiusDiagnosticsRgba, size * 4],
  ] as const) {
    if (values.length !== expected) throw new RangeError(`${name} dimensions do not match Phase L source size`);
  }
  if (!Number.isInteger(width) || width < 1 || !Number.isInteger(height) || height < 1 || !Number.isFinite(input.capPx) || input.capPx <= 0) {
    throw new RangeError("Phase L dimensions and cap must be valid");
  }
  const valid = new Uint8Array(size);
  const far = new Uint8Array(size);
  const capped = new Uint8Array(size);
  const capFar = new Uint8Array(size);
  const borderDistance = new Uint16Array(size);
  const depthMm = new Float32Array(size);
  const edge = new Uint8Array(size);
  const interiorCap = new Uint8Array(size);
  const interiorCapFarEdge = new Uint8Array(size);
  const uncappedClear = new Uint8Array(size);
  const cameraForward = input.cameraForwardWorld;
  let validPixels = 0;
  let farPixels = 0;
  let capPixels = 0;
  let capFarPixels = 0;
  let interiorCapPixels = 0;
  let uncappedClearCapPixels = 0;
  let nonBlackCapPixels = 0;
  let maximumUncappedRadiusPx = 0;
  let minimumCapBorderDistancePx = Number.POSITIVE_INFINITY;
  let minimumUncappedClearBorderDistancePx = Number.POSITIVE_INFINITY;
  const depthBuckets = new Set<number>();

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      const isValid = input.validity[pixel] === 1;
      const coc = input.physicalRgba[offset] ?? 0;
      const radius = input.radiusDiagnosticsRgba[offset] ?? 0;
      const appliedScale = input.radiusDiagnosticsRgba[offset + 1] ?? 1;
      const distance = Math.min(x, y, width - 1 - x, height - 1 - y);
      const worldX = input.worldPositionRgba[offset] ?? 0;
      const worldY = input.worldPositionRgba[offset + 1] ?? 0;
      const worldZ = input.worldPositionRgba[offset + 2] ?? 0;
      // The native world-position diagnostic target stores world coordinates in millimetres.
      const axialDepth = worldX * cameraForward[0] + worldY * cameraForward[1] + worldZ * cameraForward[2];
      borderDistance[pixel] = distance;
      depthMm[pixel] = axialDepth;
      if (!isValid) continue;
      valid[pixel] = 1;
      validPixels += 1;
      if (coc > 0.00001) {
        far[pixel] = 1;
        farPixels += 1;
      }
      const isCapped = appliedScale < 0.9999 && radius > input.capPx;
      if (!isCapped) continue;
      capped[pixel] = 1;
      capPixels += 1;
      maximumUncappedRadiusPx = Math.max(maximumUncappedRadiusPx, radius);
      minimumCapBorderDistancePx = Math.min(minimumCapBorderDistancePx, distance);
      if (coc > 0.00001) {
        capFar[pixel] = 1;
        capFarPixels += 1;
      }
      if ((input.sourceRgba[offset] ?? 0) + (input.sourceRgba[offset + 1] ?? 0) + (input.sourceRgba[offset + 2] ?? 0) > 0.015) {
        nonBlackCapPixels += 1;
      }
      depthBuckets.add(Math.round(axialDepth / 2));
      if (distance >= PHASE_L_INTERIOR_TARGETS.cappedSupportMarginPx) {
        interiorCap[pixel] = 1;
        interiorCapPixels += 1;
      }
      const localUncappedClearance = Math.ceil(radius) + 2;
      if (distance >= localUncappedClearance) {
        uncappedClear[pixel] = 1;
        uncappedClearCapPixels += 1;
        minimumUncappedClearBorderDistancePx = Math.min(minimumUncappedClearBorderDistancePx, distance);
      }
    }
  }

  const edgePairs: Array<{
    a: { x: number; y: number; valid: boolean; depthMm: number; signedCoCMm: number; sourceRgb: [number, number, number]; capped: boolean; farCapped: boolean; borderClearancePx: number; insideInteriorSupport: boolean };
    b: { x: number; y: number; valid: boolean; depthMm: number; signedCoCMm: number; sourceRgb: [number, number, number]; capped: boolean; farCapped: boolean; borderClearancePx: number; insideInteriorSupport: boolean };
    depthDeltaMm: number;
    sourceContrastRgb: number;
    farSideCapPixel: boolean;
    interiorFarSideCapPixel: boolean;
    cappedEndpointPresent: boolean;
    globalHighContrastEligible: boolean;
    interiorHighContrastEligible: boolean;
  }> = [];
  let highContrastFarDepthEdgePairCount = 0;
  let interiorHighContrastFarDepthEdgePairCount = 0;
  let cappedDepthEdgePairCount = 0;
  let farDepthEdgePairCount = 0;
  let interiorFarDepthEdgePairCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      if (!valid[pixel]) continue;
      for (const [nx, ny] of [[x + 1, y], [x, y + 1]] as const) {
        if (nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (!valid[neighbor]) continue;
        const delta = Math.abs(depthMm[pixel]! - depthMm[neighbor]!);
        if (delta < PHASE_L_INTERIOR_TARGETS.edgeDepthDeltaMm) continue;
        edge[pixel] = 1;
        edge[neighbor] = 1;
        const farSideCapPixel = Boolean(capFar[pixel] || capFar[neighbor]);
        const interiorFarSideCapPixel = Boolean((capFar[pixel] && interiorCap[pixel]) || (capFar[neighbor] && interiorCap[neighbor]));
        const hasCappedPixel = Boolean(capped[pixel] || capped[neighbor]);
        if (hasCappedPixel) cappedDepthEdgePairCount += 1;
        if (farSideCapPixel) farDepthEdgePairCount += 1;
        if (interiorFarSideCapPixel) interiorFarDepthEdgePairCount += 1;
        const offset = pixel * 4;
        const otherOffset = neighbor * 4;
        const sourceRgb: [number, number, number] = [0, 1, 2].map((channel) => input.sourceRgba[offset + channel] ?? 0) as [number, number, number];
        const otherRgb: [number, number, number] = [0, 1, 2].map((channel) => input.sourceRgba[otherOffset + channel] ?? 0) as [number, number, number];
        const sourceContrastRgb = Math.hypot(...sourceRgb.map((value, channel) => value - otherRgb[channel]!));
        const globalHighContrastEligible = farSideCapPixel && sourceContrastRgb > PHASE_L_INTERIOR_TARGETS.minimumSourceContrastRgb;
        const interiorHighContrastEligible = interiorFarSideCapPixel && sourceContrastRgb > PHASE_L_INTERIOR_TARGETS.minimumSourceContrastRgb;
        if (globalHighContrastEligible) highContrastFarDepthEdgePairCount += 1;
        if (interiorHighContrastEligible) interiorHighContrastFarDepthEdgePairCount += 1;
        if (farSideCapPixel && edgePairs.length < 256) {
          edgePairs.push({
            a: { x, y, valid: Boolean(valid[pixel]), depthMm: depthMm[pixel]!, signedCoCMm: input.physicalRgba[offset] ?? 0, sourceRgb, capped: Boolean(capped[pixel]), farCapped: Boolean(capFar[pixel]), borderClearancePx: borderDistance[pixel]!, insideInteriorSupport: Boolean(interiorCap[pixel]) },
            b: { x: nx, y: ny, valid: Boolean(valid[neighbor]), depthMm: depthMm[neighbor]!, signedCoCMm: input.physicalRgba[otherOffset] ?? 0, sourceRgb: otherRgb, capped: Boolean(capped[neighbor]), farCapped: Boolean(capFar[neighbor]), borderClearancePx: borderDistance[neighbor]!, insideInteriorSupport: Boolean(interiorCap[neighbor]) },
            depthDeltaMm: delta,
            sourceContrastRgb,
            farSideCapPixel,
            interiorFarSideCapPixel,
            cappedEndpointPresent: hasCappedPixel,
            globalHighContrastEligible,
            interiorHighContrastEligible,
          });
        }
      }
    }
  }
  for (let pixel = 0; pixel < size; pixel += 1) {
    if (interiorCap[pixel] && edge[pixel] && capFar[pixel]) interiorCapFarEdge[pixel] = 1;
  }
  const component = largestBinaryComponent(interiorCap, width, height);
  let interiorCapBorderMin: number | null = null;
  for (let pixel = 0; pixel < size; pixel += 1) {
    if (interiorCap[pixel]) interiorCapBorderMin = interiorCapBorderMin === null
      ? borderDistance[pixel]!
      : Math.min(interiorCapBorderMin, borderDistance[pixel]!);
  }
  edgePairs.sort((left, right) => right.sourceContrastRgb - left.sourceContrastRgb);
  return {
    dimensions: { width, height },
    maskDefinitions: {
      valid: "Native physical validity code 1.",
      far: "Valid and signed physical CoC > 0.00001 mm.",
      cap12: "Valid native radius diagnostics report scale < 0.9999 and unclamped maximum singular radius > configured cap.",
      edge: "Adjacent valid reconstructed world-position depths differ by at least 1 mm; both pixels marked.",
      interior: "Pixel border distance >= configured cap + 4 px (16 px for cap 12).",
      uncappedReferenceClearance: "Per-pixel border distance >= ceil(local uncapped radius) + 2 px.",
    },
    thresholds: PHASE_L_INTERIOR_TARGETS,
    counts: {
      validPixels,
      farPixels,
      capPixels,
      capFarPixels,
      interiorCapPixels,
      largestInteriorCapComponentPixels: component.pixelCount,
      interiorCapFarDepthEdgePixels: count(interiorCapFarEdge),
      capDepthEdgePairs: cappedDepthEdgePairCount,
      capFarDepthEdgePairs: farDepthEdgePairCount,
      interiorCapFarDepthEdgePairs: interiorFarDepthEdgePairCount,
      highContrastFarDepthEdgePairs: highContrastFarDepthEdgePairCount,
      interiorHighContrastFarDepthEdgePairs: interiorHighContrastFarDepthEdgePairCount,
      nonBlackCapPixels,
      uncappedReferenceClearCapPixels: uncappedClearCapPixels,
      distinctTwoMillimeterDepthBucketsInCap: depthBuckets.size,
    },
    borderClearance: {
      minimumCapBorderDistancePx: Number.isFinite(minimumCapBorderDistancePx) ? minimumCapBorderDistancePx : null,
      minimumInteriorCapBorderDistancePx: interiorCapBorderMin,
      minimumUncappedClearCapBorderDistancePx: Number.isFinite(minimumUncappedClearBorderDistancePx) ? minimumUncappedClearBorderDistancePx : null,
      maximumUncappedRadiusPx: maximumUncappedRadiusPx || null,
    },
    largestInteriorCapComponent: component,
    edgePairs: edgePairs.slice(0, 64),
    candidateQualified: interiorCapPixels >= PHASE_L_INTERIOR_TARGETS.minimumInteriorCapPixels
      && component.pixelCount >= PHASE_L_INTERIOR_TARGETS.minimumLargestInteriorCapComponent
      && count(interiorCapFarEdge) >= PHASE_L_INTERIOR_TARGETS.minimumInteriorCapFarDepthEdgePixels
      && interiorHighContrastFarDepthEdgePairCount >= PHASE_L_INTERIOR_TARGETS.minimumHighContrastFarDepthEdgePairs,
    selectionPolicy: "Geometry/physical readback only; high-contrast qualification requires a capped far endpoint inside the 16 px interior-support mask; no B0/B1 quality metric is used.",
  };
}

const makePhaseLMasks = (input: {
  width: number;
  height: number;
  capPx: number;
  worldPositionRgba: Float32Array;
  physicalRgba: Float32Array;
  validity: Uint8Array;
  radiusDiagnosticsRgba: Float32Array;
  cameraForwardWorld: readonly [number, number, number];
}) => {
  const size = input.width * input.height;
  const depthMm = new Float32Array(size);
  for (let pixel = 0; pixel < size; pixel += 1) {
    const offset = pixel * 4;
    depthMm[pixel] = (input.worldPositionRgba[offset]! * input.cameraForwardWorld[0]
      + input.worldPositionRgba[offset + 1]! * input.cameraForwardWorld[1]
      + input.worldPositionRgba[offset + 2]! * input.cameraForwardWorld[2]);
  }
  const distance = depthBoundaryDistances(input.validity, depthMm, input.width, input.height).distances;
  const validFar = new Uint8Array(size);
  const cap12 = new Uint8Array(size);
  const interiorCap12 = new Uint8Array(size);
  const interiorCap12Far = new Uint8Array(size);
  const interiorCap12FarDepthEdge = new Uint8Array(size);
  const cap12NearDepthEdge = new Uint8Array(size);
  const cap12FarDepthEdge = new Uint8Array(size);
  const cap12AwayFromDepthEdge = new Uint8Array(size);
  const uncappedValid = new Uint8Array(size);
  const borderDistance = new Uint16Array(size);
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const pixel = y * input.width + x;
      const offset = pixel * 4;
      const isValid = input.validity[pixel] === 1;
      const far = (input.physicalRgba[offset] ?? 0) > 0.00001;
      const radius = input.radiusDiagnosticsRgba[offset] ?? 0;
      const border = Math.min(x, y, input.width - 1 - x, input.height - 1 - y);
      borderDistance[pixel] = border;
      if (isValid && far) validFar[pixel] = 1;
      if (!isValid) continue;
      if (radius > input.capPx) {
        cap12[pixel] = 1;
        if (border >= PHASE_L_INTERIOR_TARGETS.cappedSupportMarginPx) interiorCap12[pixel] = 1;
        if (far && border >= PHASE_L_INTERIOR_TARGETS.cappedSupportMarginPx) interiorCap12Far[pixel] = 1;
        if (distance[pixel]! <= 1) {
          if (far) cap12FarDepthEdge[pixel] = 1;
          else if ((input.physicalRgba[offset] ?? 0) < -0.00001) cap12NearDepthEdge[pixel] = 1;
        } else {
          cap12AwayFromDepthEdge[pixel] = 1;
        }
      } else {
        uncappedValid[pixel] = 1;
      }
    }
  }
  for (let y = 0; y < input.height; y += 1) {
    for (let x = 0; x < input.width; x += 1) {
      const pixel = y * input.width + x;
      if (!interiorCap12Far[pixel]) continue;
      if (distance[pixel]! <= 1) interiorCap12FarDepthEdge[pixel] = 1;
    }
  }
  return {
    masks: {
      validFar,
      cap12,
      interiorCap12,
      interiorCap12Far,
      interiorCap12FarDepthEdge,
      cap12NearDepthEdge,
      cap12FarDepthEdge,
      cap12AwayFromDepthEdge,
      uncappedValid,
    },
    depthBoundaryDistancePx: distance,
    borderDistancePx: borderDistance,
  };
};

const measureWeightedSpread = (source: Float32Array, output: Float32Array, mask: Uint8Array, width: number) => {
  let energy = 0;
  let xWeighted = 0;
  let yWeighted = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const weight = absoluteLinearLumaDifference(source, output, pixel * 4);
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    energy += weight;
    xWeighted += x * weight;
    yWeighted += y * weight;
  }
  if (energy <= 1e-12) return { signalEnergy: energy, centroidPx: null, covariancePx2: null, rmsSpreadPx: null };
  const centroidX = xWeighted / energy;
  const centroidY = yWeighted / energy;
  let xx = 0;
  let xy = 0;
  let yy = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const weight = absoluteLinearLumaDifference(source, output, pixel * 4);
    const dx = pixel % width - centroidX;
    const dy = Math.floor(pixel / width) - centroidY;
    xx += dx * dx * weight;
    xy += dx * dy * weight;
    yy += dy * dy * weight;
  }
  xx /= energy;
  xy /= energy;
  yy /= energy;
  return { signalEnergy: energy, centroidPx: [centroidX, centroidY], covariancePx2: [xx, xy, xy, yy], rmsSpreadPx: Math.sqrt(xx + yy) };
};

const lumaRoiMetrics = (reference: Float32Array, actual: Float32Array, mask: Uint8Array) => {
  let absolute = 0;
  let maximum = 0;
  let countPixels = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const difference = absoluteLinearLumaDifference(reference, actual, pixel * 4);
    absolute += difference;
    maximum = Math.max(maximum, difference);
    countPixels += 1;
  }
  return {
    pixelCount: countPixels,
    meanAbsoluteLumaDifference: countPixels ? absolute / countPixels : null,
    maximumAbsoluteLumaDifference: countPixels ? maximum : null,
  };
};

/** Matched readback quality and fallback evidence for the predeclared cap-12 physical ROI. */
export function measurePhaseLQuality(input: {
  width: number;
  height: number;
  capPx: number;
  sourceRgba: Float32Array;
  referenceFarRgba: Float32Array;
  candidateFarRgba: Float32Array;
  referenceCompositeRgba: Float32Array;
  candidateCompositeRgba: Float32Array;
  worldPositionRgba: Float32Array;
  physicalRgba: Float32Array;
  validity: Uint8Array;
  radiusDiagnosticsRgba: Float32Array;
  sourceFallbackMask: Uint8Array;
  cameraForwardWorld: readonly [number, number, number];
}) {
  const size = input.width * input.height;
  const { masks, depthBoundaryDistancePx, borderDistancePx } = makePhaseLMasks(input);
  const all = new Uint8Array(size).fill(1);
  const roiEntries = {
    fullSourceFrame: all,
    validFar: masks.validFar,
    physicalRadiusOverCap: masks.cap12,
    interiorCap12: masks.interiorCap12,
    interiorCap12Far: masks.interiorCap12Far,
    interiorCap12FarDepthEdge: masks.interiorCap12FarDepthEdge,
    cap12NearDepthEdge: masks.cap12NearDepthEdge,
    cap12FarDepthEdge: masks.cap12FarDepthEdge,
    cap12AwayFromDepthEdge: masks.cap12AwayFromDepthEdge,
    uncappedValidControl: masks.uncappedValid,
  } as const;
  const farQuality = Object.fromEntries(Object.entries(roiEntries).map(([name, mask]) => [name, {
    rgb: compareLinearRgbaRasters(input.referenceFarRgba, input.candidateFarRgba, mask),
    absoluteLinearLuma: lumaRoiMetrics(input.referenceFarRgba, input.candidateFarRgba, mask),
  }]));
  const compositeQuality = Object.fromEntries(Object.entries(roiEntries).map(([name, mask]) => [name, {
    rgb: compareLinearRgbaRasters(input.referenceCompositeRgba, input.candidateCompositeRgba, mask),
    absoluteLinearLuma: lumaRoiMetrics(input.referenceCompositeRgba, input.candidateCompositeRgba, mask),
  }]));

  const fallbackDistanceBands = { "0-1px": 0, "2-4px": 0, "5-8px": 0, "9-12px": 0, "13px+": 0 };
  const fallbackSharpAgainstReference = { "0-1px": 0, "2-4px": 0, "5-8px": 0, "9-12px": 0, "13px+": 0 };
  const interiorFallbackDistanceBands = { "0-1px": 0, "2-4px": 0, "5-8px": 0, "9-12px": 0, "13px+": 0 };
  const interiorSharpFallbackByBand = { "0-1px": 0, "2-4px": 0, "5-8px": 0, "9-12px": 0, "13px+": 0 };
  const interiorSharpFallbackSamples: Array<Record<string, unknown> & { sourceToReferenceLumaDifference: number }> = [];
  let farFallbackCount = 0;
  let fallbackSourceMismatchCount = 0;
  let totalReferenceBlurAtFallback = 0;
  let totalCandidateBlurAtFallback = 0;
  let interiorFarFallbackCount = 0;
  let interiorFarDepthEdgeFallbackCount = 0;
  let maximumSharpFallbackBoundaryDistancePx = 0;
  let maximumSharpFallbackRadiusPx = 0;
  const lumaAt = (rgba: Float32Array, pixel: number) => {
    const offset = pixel * 4;
    return (rgba[offset] ?? 0) * 0.2126 + (rgba[offset + 1] ?? 0) * 0.7152 + (rgba[offset + 2] ?? 0) * 0.0722;
  };
  const localLumaGradientMean = (rgba: Float32Array, x: number, y: number) => {
    const center = lumaAt(rgba, y * input.width + x);
    let sum = 0;
    let neighbors = 0;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= input.width || ny >= input.height) continue;
      sum += Math.abs(center - lumaAt(rgba, ny * input.width + nx));
      neighbors += 1;
    }
    return neighbors ? sum / neighbors : 0;
  };
  for (let pixel = 0; pixel < size; pixel += 1) {
    if (!input.sourceFallbackMask[pixel] || !masks.validFar[pixel]) continue;
    farFallbackCount += 1;
    const distance = depthBoundaryDistancePx[pixel]!;
    const band = distance <= 1 ? "0-1px"
      : distance <= 4 ? "2-4px"
        : distance <= 8 ? "5-8px"
          : distance <= 12 ? "9-12px" : "13px+";
    fallbackDistanceBands[band] += 1;
    const offset = pixel * 4;
    const referenceBlurSignal = absoluteLinearLumaDifference(input.referenceFarRgba, input.sourceRgba, offset);
    const candidateBlurSignal = absoluteLinearLumaDifference(input.candidateFarRgba, input.sourceRgba, offset);
    totalReferenceBlurAtFallback += referenceBlurSignal;
    totalCandidateBlurAtFallback += candidateBlurSignal;
    if (referenceBlurSignal >= 0.01 && candidateBlurSignal < 0.01) fallbackSharpAgainstReference[band] += 1;
    if (masks.interiorCap12Far[pixel]) {
      interiorFarFallbackCount += 1;
      interiorFallbackDistanceBands[band] += 1;
      if (depthBoundaryDistancePx[pixel]! <= 1) interiorFarDepthEdgeFallbackCount += 1;
      if (referenceBlurSignal >= 0.01 && candidateBlurSignal < 0.01) {
        interiorSharpFallbackByBand[band] += 1;
        maximumSharpFallbackBoundaryDistancePx = Math.max(maximumSharpFallbackBoundaryDistancePx, distance);
        const offset = pixel * 4;
        const x = pixel % input.width;
        const y = Math.floor(pixel / input.width);
        const adjacentSigns = new Set<number>();
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= input.width || ny >= input.height) continue;
          const neighbor = ny * input.width + nx;
          if (input.validity[neighbor] !== 1) continue;
          const neighborCoc = input.physicalRgba[neighbor * 4] ?? 0;
          if (neighborCoc < -0.00001) adjacentSigns.add(-1);
          else if (neighborCoc > 0.00001) adjacentSigns.add(1);
        }
        const radiusPx = input.radiusDiagnosticsRgba[offset] ?? 0;
        maximumSharpFallbackRadiusPx = Math.max(maximumSharpFallbackRadiusPx, radiusPx);
        interiorSharpFallbackSamples.push({
          pixelTopOrigin: [x, y],
          sourceColorLinearRgb: Array.from(input.sourceRgba.subarray(offset, offset + 3)),
          referenceFarColorLinearRgb: Array.from(input.referenceFarRgba.subarray(offset, offset + 3)),
          candidateFarColorLinearRgb: Array.from(input.candidateFarRgba.subarray(offset, offset + 3)),
          signedCoCMm: input.physicalRgba[offset] ?? 0,
          uncappedRadiusPx: radiusPx,
          appliedRadiusScale: input.radiusDiagnosticsRgba[offset + 1] ?? 1,
          capActivated: radiusPx > input.capPx,
          depthBoundaryDistancePx: distance,
          rasterBorderDistancePx: borderDistancePx[pixel],
          sourceToReferenceLumaDifference: referenceBlurSignal,
          sourceToCandidateLumaDifference: candidateBlurSignal,
          sourceLocalLumaGradientMean: localLumaGradientMean(input.sourceRgba, x, y),
          referenceLocalLumaGradientMean: localLumaGradientMean(input.referenceFarRgba, x, y),
          candidateLocalLumaGradientMean: localLumaGradientMean(input.candidateFarRgba, x, y),
          adjacentNearFarTransition: adjacentSigns.has(-1) && adjacentSigns.has(1),
        });
      }
    }
    const maxRgbDifference = Math.max(
      Math.abs(input.candidateFarRgba[offset]! - input.sourceRgba[offset]!),
      Math.abs(input.candidateFarRgba[offset + 1]! - input.sourceRgba[offset + 1]!),
      Math.abs(input.candidateFarRgba[offset + 2]! - input.sourceRgba[offset + 2]!),
    );
    if (maxRgbDifference > 0.002) fallbackSourceMismatchCount += 1;
  }
  const sourceFallbackMask = input.sourceFallbackMask;
  const sourceFallbackRgbMismatchCount = countFallbackSourceColorMismatches(
    input.sourceRgba,
    input.candidateFarRgba,
    sourceFallbackMask,
  );
  return {
    roiDefinitions: {
      physicalRadiusOverCap: "Valid pixel with native uncapped maximum singular ellipse radius > configured radius cap; region is computed from actual GPU radius diagnostics.",
      interiorCap12: `physicalRadiusOverCap intersect pixel border distance >= ${PHASE_L_INTERIOR_TARGETS.cappedSupportMarginPx}px.`,
      interiorCap12Far: "interiorCap12 intersect valid positive signed physical CoC.",
      interiorCap12FarDepthEdge: "interiorCap12Far intersect exact paired valid-pixel depth discontinuity (>=1 mm).",
      uncappedValidControl: "Valid pixels whose native uncapped physical ellipse radius does not exceed the comparison cap.",
      depthDistance: "Four-connected distance to adjacent valid world-position samples separated by >=1 mm along camera direction.",
    },
    farQuality,
    finalCompositeQuality: compositeQuality,
    blurSpread: {
      definition: "Signal-weighted spatial covariance of absolute linear-luma change from sharp source to far output. Comparative image-space spread proxy, not optical PSF.",
      referenceInteriorCapFar: measureWeightedSpread(input.sourceRgba, input.referenceFarRgba, masks.interiorCap12Far, input.width),
      candidateInteriorCapFar: measureWeightedSpread(input.sourceRgba, input.candidateFarRgba, masks.interiorCap12Far, input.width),
      referenceValidFar: measureWeightedSpread(input.sourceRgba, input.referenceFarRgba, masks.validFar, input.width),
      candidateValidFar: measureWeightedSpread(input.sourceRgba, input.candidateFarRgba, masks.validFar, input.width),
    },
    fallback: {
      farFallbackPixelCount: farFallbackCount,
      allFallbackSourceRgbMismatchCount: sourceFallbackRgbMismatchCount,
      validFarFallbackRgbMismatchCount: fallbackSourceMismatchCount,
      depthBoundaryDistanceBands: fallbackDistanceBands,
      sharpRelativeToReferenceAtFallbackByBand: fallbackSharpAgainstReference,
      meanReferenceLumaBlurAtFallback: farFallbackCount ? totalReferenceBlurAtFallback / farFallbackCount : null,
      meanCandidateLumaBlurAtFallback: farFallbackCount ? totalCandidateBlurAtFallback / farFallbackCount : null,
      haloCriterion: "Only counts fallback far pixels where matched full-resolution reference luma differs from source by >=0.01, while B1 candidate luma differs from source by <0.01. This is a comparative localized sharp-fallback indicator, not an optical halo/PSF measurement.",
      interiorCap12Far: {
        fallbackPixelCount: interiorFarFallbackCount,
        depthEdgeFallbackPixelCount: interiorFarDepthEdgeFallbackCount,
        depthBoundaryDistanceBands: interiorFallbackDistanceBands,
        sharpRelativeToReferenceByBand: interiorSharpFallbackByBand,
        sharpFallbackPixelCount: Object.values(interiorSharpFallbackByBand).reduce((sum, value) => sum + value, 0),
        outermostSharpFallbackDepthBoundaryDistancePx: maximumSharpFallbackBoundaryDistancePx || null,
        maximumSharpFallbackUncappedRadiusPx: maximumSharpFallbackRadiusPx || null,
        edgeDistanceProfileInterpretation: "Depth-boundary distance bands describe spatial distance from a reconstructed depth discontinuity; they are not blur radii or halo widths.",
        sharpFallbackSamples: interiorSharpFallbackSamples
          .sort((left, right) => right.sourceToReferenceLumaDifference - left.sourceToReferenceLumaDifference)
          .slice(0, 32)
          .map((sample) => sample),
      },
    },
  };
}
