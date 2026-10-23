import { describe, expect, it } from "vitest";
import {
  analyzeInteriorCocPreflight,
  buildPhaseLCandidateSearchArtifact,
  buildPhaseLNoCandidateReport,
  evaluatePhaseLQualityDecision,
  measurePhaseLQuality,
  passesPhaseLConfirmatoryAcceptance,
  PHASE_L_CANDIDATES,
  PHASE_L_INTERIOR_TARGETS,
  PHASE_L_QUALITY_ACCEPTANCE,
  resolvePhaseLCandidateWindow,
  selectPhaseLCandidates,
} from "../e2e/fixtures/ground-glass-webgpu-interior-coc-cases";

describe("Phase L interior large-CoC preflight", () => {
  it("uses the canonical normalized pan direction and a bounded geometry-only candidate set", () => {
    expect(PHASE_L_CANDIDATES).toHaveLength(12);
    expect(PHASE_L_CANDIDATES.map((candidate) => candidate.magnification)).toEqual([
      8, 8, 8, 8, 12, 12, 12, 12, 16, 16, 16, 16,
    ]);
    const center = resolvePhaseLCandidateWindow(PHASE_L_CANDIDATES[0]!);
    expect(center).toMatchObject({ active: true, widthFraction: 1 / 8, centerU: 0.5, centerV: 0.5 });
    const positive = resolvePhaseLCandidateWindow({ id: "positive", magnification: 8, pan: { x: 1, y: 1 } });
    const negative = resolvePhaseLCandidateWindow({ id: "negative", magnification: 8, pan: { x: -1, y: -1 } });
    expect(positive.centerU).toBeLessThan(0.5);
    expect(positive.centerV).toBeLessThan(0.5);
    expect(negative.centerU).toBeGreaterThan(0.5);
    expect(negative.centerV).toBeGreaterThan(0.5);
  });

  it("counts only physically capped interior far-edge pixels and excludes border-touching support", () => {
    const width = 64;
    const height = 64;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        const isInteriorCap = x >= 16 && x <= 47 && y >= 16 && y <= 47;
        const isBorderCap = x >= 4 && x <= 10 && y === 0;
        const capped = isInteriorCap || isBorderCap;
        world[offset + 2] = x < 32 ? 100 : 120;
        world[offset + 3] = 0.5;
        physical[offset] = x < 32 ? -1 : 1;
        source[offset] = x < 32 ? 0.1 : 0.8;
        source[offset + 1] = 0.2;
        source[offset + 2] = x < 32 ? 0.3 : 0.9;
        radius[offset] = capped ? 20 : 4;
        radius[offset + 1] = capped ? 0.6 : 1;
      }
    }
    const result = analyzeInteriorCocPreflight({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.counts.interiorCapPixels).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumInteriorCapPixels);
    expect(result.counts.largestInteriorCapComponentPixels).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumLargestInteriorCapComponent);
    expect(result.counts.interiorCapFarDepthEdgePixels).toBe(32);
    expect(result.counts.capFarDepthEdgePairs).toBe(32);
    expect(result.counts.highContrastFarDepthEdgePairs).toBe(32);
    expect(result.counts.interiorHighContrastFarDepthEdgePairs).toBe(32);
    expect(result.counts.capPixels).toBeGreaterThan(result.counts.interiorCapPixels);
    expect(result.borderClearance.minimumCapBorderDistancePx).toBe(0);
    expect(result.borderClearance.minimumInteriorCapBorderDistancePx).toBeGreaterThanOrEqual(16);
    expect(result.counts.uncappedReferenceClearCapPixels).toBe(400);
    expect(result.borderClearance.minimumUncappedClearCapBorderDistancePx).toBe(22);
    expect(result.largestInteriorCapComponent.bounds).toEqual({ left: 16, top: 16, right: 47, bottom: 47 });
    expect(result.edgePairs.every((pair) => pair.farSideCapPixel)).toBe(true);
    expect(result.edgePairs.every((pair) => pair.interiorFarSideCapPixel && pair.interiorHighContrastEligible)).toBe(true);
    expect(result.edgePairs.every((pair) => pair.a.valid && pair.b.valid && pair.cappedEndpointPresent)).toBe(true);
    expect(result.edgePairs.every((pair) => pair.a.signedCoCMm * pair.b.signedCoCMm <= 0)).toBe(true);
    expect(result.candidateQualified).toBe(true);
  });

  it("rejects low-contrast interior edges when high-contrast capped far edges exist only at the raster border", () => {
    const width = 96;
    const height = 80;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        const borderPair = y >= 20 && y <= 60 && x <= 10;
        const interior = x >= 20 && x <= 60 && y >= 20 && y <= 60;
        const capped = borderPair || interior;
        const borderHighSide = borderPair && x >= 5;
        const interiorHighSide = interior && x >= 40;
        world[offset + 2] = borderPair
          ? x < 5 ? 100 : 120
          : interior ? x < 40 ? 200 : 220 : 0;
        physical[offset] = 1;
        const color = borderPair
          ? borderHighSide ? 0.8 : 0.1
          : interior ? interiorHighSide ? 0.11 : 0.1 : 0.1;
        source[offset] = color;
        source[offset + 1] = color;
        source[offset + 2] = color;
        radius[offset] = capped ? 20 : 4;
        radius[offset + 1] = capped ? 0.6 : 1;
      }
    }
    const result = analyzeInteriorCocPreflight({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.counts.interiorCapPixels).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumInteriorCapPixels);
    expect(result.counts.largestInteriorCapComponentPixels).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumLargestInteriorCapComponent);
    expect(result.counts.interiorCapFarDepthEdgePixels).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumInteriorCapFarDepthEdgePixels);
    expect(result.counts.highContrastFarDepthEdgePairs).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumHighContrastFarDepthEdgePairs);
    expect(result.counts.interiorHighContrastFarDepthEdgePairs).toBeLessThan(PHASE_L_INTERIOR_TARGETS.minimumHighContrastFarDepthEdgePairs);
    expect(result.candidateQualified).toBe(false);
  });

  it("qualifies a high-contrast far depth edge only when its capped far endpoint has interior support", () => {
    const width = 64;
    const height = 64;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        const interiorCap = x >= 16 && x <= 47 && y >= 16 && y <= 47;
        world[offset + 2] = x < 32 ? 100 : 120;
        physical[offset] = x < 32 ? -1 : 1;
        source[offset] = x < 32 ? 0.1 : 0.8;
        source[offset + 1] = 0.2;
        source[offset + 2] = x < 32 ? 0.3 : 0.9;
        radius[offset] = interiorCap ? 20 : 4;
        radius[offset + 1] = interiorCap ? 0.6 : 1;
      }
    }
    const result = analyzeInteriorCocPreflight({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.counts.interiorHighContrastFarDepthEdgePairs).toBeGreaterThanOrEqual(PHASE_L_INTERIOR_TARGETS.minimumHighContrastFarDepthEdgePairs);
    expect(result.edgePairs.some((pair) => pair.interiorHighContrastEligible && Math.min(pair.a.borderClearancePx, pair.b.borderClearancePx) >= PHASE_L_INTERIOR_TARGETS.cappedSupportMarginPx)).toBe(true);
    expect(result.candidateQualified).toBe(true);
  });

  it("does not qualify a border-only cap region as an interior stress case", () => {
    const width = 40;
    const height = 32;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        world[offset + 2] = x < 20 ? 100 : 200;
        physical[offset] = 1;
        const borderCap = y < 10;
        radius[offset] = borderCap ? 18 : 4;
        radius[offset + 1] = borderCap ? 0.6 : 1;
      }
    }
    const result = analyzeInteriorCocPreflight({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.counts.capPixels).toBeGreaterThan(0);
    expect(result.counts.interiorCapPixels).toBe(0);
    expect(result.counts.interiorCapFarDepthEdgePixels).toBe(0);
    expect(result.counts.interiorHighContrastFarDepthEdgePairs).toBe(0);
    expect(result.candidateQualified).toBe(false);
  });

  it("measures far-only interior cap edges separately from near edges and composites", () => {
    const width = 64;
    const height = 64;
    const size = width * height;
    const source = new Float32Array(size * 4);
    const world = new Float32Array(size * 4);
    const physical = new Float32Array(size * 4);
    const validity = new Uint8Array(size).fill(1);
    const radius = new Float32Array(size * 4);
    const referenceFar = new Float32Array(size * 4);
    const candidateFar = new Float32Array(size * 4);
    const near = new Float32Array(size * 4);
    const referenceComposite = new Float32Array(size * 4);
    const candidateComposite = new Float32Array(size * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pixel = y * width + x;
        const offset = pixel * 4;
        const far = x >= 32;
        const capped = x >= 16 && x <= 47 && y >= 16 && y <= 47;
        world[offset + 2] = far ? 120 : 100;
        physical[offset] = far ? 1 : -1;
        radius[offset] = capped ? 14 : 8;
        source[offset] = far ? 0.8 : 0.1;
        source[offset + 1] = 0.2;
        source[offset + 2] = far ? 0.9 : 0.3;
        source[offset + 3] = 1;
        referenceFar.set(source.subarray(offset, offset + 4), offset);
        candidateFar.set(source.subarray(offset, offset + 4), offset);
        candidateFar[offset] += 0.02;
        near[offset] = 0.2;
        near[offset + 1] = 0.1;
        near[offset + 2] = 0.05;
        near[offset + 3] = 0;
        referenceComposite.set(referenceFar.subarray(offset, offset + 4), offset);
        candidateComposite.set(candidateFar.subarray(offset, offset + 4), offset);
      }
    }
    const result = measurePhaseLQuality({
      width,
      height,
      capPx: 12,
      sourceRgba: source,
      referenceFarRgba: referenceFar,
      candidateFarRgba: candidateFar,
      referenceCompositeRgba: referenceComposite,
      candidateCompositeRgba: candidateComposite,
      worldPositionRgba: world,
      physicalRgba: physical,
      validity,
      radiusDiagnosticsRgba: radius,
      sourceFallbackMask: new Uint8Array(size),
      cameraForwardWorld: [0, 0, 1],
    });
    expect(result.farQuality.interiorCap12FarDepthEdge.rgb.pixelCount).toBe(64);
    expect(result.farQuality.interiorCap12FarDepthEdge.rgb.rgbRootMeanSquareError).toBeGreaterThan(0);
    expect(result.finalCompositeQuality.interiorCap12FarDepthEdge.rgb.pixelCount).toBe(64);
    expect(result.farQuality.cap12NearDepthEdge.rgb.pixelCount).toBe(64);
  });
});

const goodDecisionInput = () => ({
  candidateQualified: true,
  matchedNativeProvenance: true,
  referenceConvergence: { interiorFarRmse: 0.00028, edgeRmse: 0.00107 },
  b0Quality: { interiorFarRmse: 0.00038, edgeRmse: 0.00138 },
  b1Quality: { interiorFarRmse: 0.00038, edgeRmse: 0.00138 },
  roiPopulations: {
    interiorFar: { full32: 47058, full64: 47058, b0: 47058, b1: 47058 },
    edge: { full32: 1058, full64: 1058, b0: 1058, b1: 1058 },
  },
  nearRgba: { rgbRmse: 0, rgbMax: 0, alphaRmse: 0, alphaMax: 0 },
  fallbackEvidence: { interiorFarFallbackPixels: 0, interiorFarSharpFallbackPixels: 0, sourceRgbMismatchPixels: 0 },
});

describe("Phase L frozen confirmatory quality decision", () => {
  it("accepts a valid bounded reference and candidate result", () => {
    expect(evaluatePhaseLQualityDecision(goodDecisionInput()).outcome).toBe("L-A");
  });

  it("rejects identically wrong B0/B1 output even when both have zero fallback", () => {
    const input = goodDecisionInput();
    input.b0Quality.interiorFarRmse = 0.08;
    input.b0Quality.edgeRmse = 0.08;
    input.b1Quality.interiorFarRmse = 0.08;
    input.b1Quality.edgeRmse = 0.08;
    const result = evaluatePhaseLQualityDecision(input);
    expect(result.checks.fallbackEvidenceValid).toBe(true);
    expect(result.checks.candidateWithinAbsoluteBounds).toBe(false);
    expect(result.outcome).toBe("L-B");
  });

  it("classifies poor Full ×32/×64 convergence as insufficient reference confidence", () => {
    const input = goodDecisionInput();
    input.referenceConvergence.edgeRmse = 0.01;
    expect(evaluatePhaseLQualityDecision(input).outcome).toBe("L-E");
  });

  it("rejects an empty edge ROI instead of accepting a vacuous measurement", () => {
    const input = goodDecisionInput();
    input.roiPopulations.edge.b1 = 0;
    expect(evaluatePhaseLQualityDecision(input).checks.roiPopulationValid).toBe(false);
    expect(evaluatePhaseLQualityDecision(input).outcome).toBe("L-E");
  });

  it("rejects missing and non-finite metrics", () => {
    for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
      const input = goodDecisionInput();
      (input.b1Quality as { interiorFarRmse: number | null; edgeRmse: number | null }).edgeRmse = value;
      const result = evaluatePhaseLQualityDecision(input);
      expect(result.checks.measurementsFinite).toBe(false);
      expect(result.outcome).toBe("L-E");
    }
  });

  it("fails the frozen candidate bound when a measured B1 edge error is too large", () => {
    const input = goodDecisionInput();
    input.b1Quality.edgeRmse = 0.006;
    const result = evaluatePhaseLQualityDecision(input);
    expect(result.checks.candidateWithinAbsoluteBounds).toBe(false);
    expect(result.outcome).toBe("L-B");
  });

  it("rejects a candidate that changes Near RGBA despite acceptable far quality", () => {
    const input = goodDecisionInput();
    input.nearRgba.rgbMax = 0.0002;
    const result = evaluatePhaseLQualityDecision(input);
    expect(result.checks.nearRgbaInvariant).toBe(false);
    expect(result.outcome).toBe("L-B");
  });

  it("reports L-D when no candidate satisfies geometry qualification", () => {
    const input = goodDecisionInput();
    input.candidateQualified = false;
    expect(evaluatePhaseLQualityDecision(input).outcome).toBe("L-D");
  });

  it("accepts only the fixed L-A baseline with every acceptance check passing", () => {
    const evaluation = evaluatePhaseLQualityDecision(goodDecisionInput());
    expect(evaluation.outcome).toBe("L-A");
    expect(evaluation.failedCriteria).toEqual([]);
    expect(passesPhaseLConfirmatoryAcceptance(evaluation)).toBe(true);
  });

  it("rejects L-B when measured B1 quality exceeds the fixed bound", () => {
    const input = goodDecisionInput();
    input.b1Quality.edgeRmse = PHASE_L_QUALITY_ACCEPTANCE.maximumCandidateEdgeRmse + 0.001;
    const evaluation = evaluatePhaseLQualityDecision(input);
    expect(evaluation.outcome).toBe("L-B");
    expect(evaluation.failedCriteria).toContain("candidateWithinAbsoluteBounds");
    expect(passesPhaseLConfirmatoryAcceptance(evaluation)).toBe(false);
  });

  it("rejects L-E when Full reference convergence exceeds the fixed bound", () => {
    const input = goodDecisionInput();
    input.referenceConvergence.edgeRmse = PHASE_L_QUALITY_ACCEPTANCE.maximumReferenceEdgeRmse + 0.001;
    const evaluation = evaluatePhaseLQualityDecision(input);
    expect(evaluation.outcome).toBe("L-E");
    expect(evaluation.failedCriteria).toContain("referenceConverged");
    expect(passesPhaseLConfirmatoryAcceptance(evaluation)).toBe(false);
  });

  it("rejects L-B when only Near alpha exceeds the fixed tolerance", () => {
    const input = goodDecisionInput();
    input.nearRgba.alphaMax = PHASE_L_QUALITY_ACCEPTANCE.maximumNearAlphaError + 0.001;
    const evaluation = evaluatePhaseLQualityDecision(input);
    expect(evaluation.outcome).toBe("L-B");
    expect(evaluation.checks.nearRgbaInvariant).toBe(false);
    expect(passesPhaseLConfirmatoryAcceptance(evaluation)).toBe(false);
  });

  it("rejects L-D for the fixed baseline while preserving L-D as a valid research classification", () => {
    const input = goodDecisionInput();
    input.candidateQualified = false;
    const evaluation = evaluatePhaseLQualityDecision(input);
    expect(evaluation.outcome).toBe("L-D");
    expect(evaluation.failedCriteria).toContain("candidateQualified");
    expect(passesPhaseLConfirmatoryAcceptance(evaluation)).toBe(false);
  });
});

describe("Phase L candidate-search and no-candidate artifacts", () => {
  it("serializes all 12 unqualified candidates and a complete L-D report with nullable selection", () => {
    const candidates = Array.from({ length: 12 }, (_, index) => ({
      id: `m${8 + (index % 3) * 4}-candidate-${index}`,
      score: [12 - index, 0, 0],
      qualified: false,
      rejectionReasons: [`candidate ${index} failed interior support`],
      counts: { interiorCapped: 0, interiorHighContrastPairs: 0 },
    }));
    const selection = selectPhaseLCandidates(candidates);
    expect(selection.qualifiedCandidates).toHaveLength(0);
    expect(selection.selectedCandidate).toBeNull();

    const candidateSearch = buildPhaseLCandidateSearchArtifact({
      candidates: selection.sortedCandidates,
      selectedCandidateId: selection.selectedCandidate?.id ?? null,
      bestUnqualifiedCandidateId: selection.bestUnqualifiedCandidate?.id ?? null,
      predeclaredCriteria: PHASE_L_INTERIOR_TARGETS,
      qualityAcceptance: PHASE_L_QUALITY_ACCEPTANCE,
      nativeRuntime: {
        rendererFamily: "webgpu-renderer",
        executionBackend: "webgpu",
        applicationFallback: false,
        threeRevision: "186",
      },
      selectionPolicy: "Geometry-only score; unqualified candidates are never used for confirmatory quality.",
    });
    const report = buildPhaseLNoCandidateReport({
      candidateSearch,
      nativeRuntime: candidateSearch.nativeRuntime,
    });

    const serializedSearch = JSON.parse(JSON.stringify(candidateSearch)) as typeof candidateSearch;
    const serializedReport = JSON.parse(JSON.stringify(report)) as typeof report;
    expect(serializedSearch.discoveryCandidateCount).toBe(12);
    expect(serializedSearch.qualifiedCandidateCount).toBe(0);
    expect(serializedSearch.selectedForConfirmation).toBeNull();
    expect(serializedSearch.bestUnqualifiedCandidateForExplorationOnly).toBe(candidates[0]!.id);
    expect(serializedSearch.candidates).toHaveLength(12);
    expect(serializedSearch.candidates.every((candidate) => candidate.rejectionReasons.length === 1)).toBe(true);
    expect(serializedSearch.predeclaredCriteria).toEqual(PHASE_L_INTERIOR_TARGETS);
    expect(serializedReport.decision).toBe("L-D");
    expect(serializedReport.decisionReason).toBe("No candidate satisfies the frozen geometry qualification.");
    expect(serializedReport.qualityMatrixStatus).toBe("not-run-no-qualified-candidate");
    expect(serializedReport.qualityMatrix).toBeNull();
    expect(serializedReport.selectedCandidate).toBeNull();
    expect(serializedReport.bestUnqualifiedCandidate?.id).toBe(candidates[0]!.id);
    expect(serializedReport.qualityDecisionEvidence.outcome).toBe("L-D");
    expect(passesPhaseLConfirmatoryAcceptance(serializedReport.qualityDecisionEvidence)).toBe(false);
    expect(serializedReport.qualityDecisionEvidence.measurements).toMatchObject({
      referenceInteriorRmse: null,
      referenceEdgeRmse: null,
      b1InteriorRmse: null,
      b1EdgeRmse: null,
    });
  });

  it("refuses to publish an L-D report if a candidate is qualified", () => {
    const candidateSearch = buildPhaseLCandidateSearchArtifact({
      candidates: [{ id: "qualified", score: [1], qualified: true, rejectionReasons: [] }],
      selectedCandidateId: "qualified",
      bestUnqualifiedCandidateId: null,
      predeclaredCriteria: PHASE_L_INTERIOR_TARGETS,
      qualityAcceptance: PHASE_L_QUALITY_ACCEPTANCE,
      nativeRuntime: null,
      selectionPolicy: "geometry-only",
    });
    expect(() => buildPhaseLNoCandidateReport({ candidateSearch, nativeRuntime: null })).toThrow(/requires no qualified/);
  });
});
