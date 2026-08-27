const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

/**
 * Compensates a foreground sample for the proposal density of a uniform
 * search disk. The cap is derived from the active sample count so one sparse
 * proposal cannot become an opaque layer by itself.
 */
export const nearCoverageProposalCompensation = (
  sampleMajorRadiusPx: number,
  sampleMinorRadiusPx: number,
  searchRadiusPx: number,
  sampleCount: number,
): number => {
  if (
    !Number.isFinite(sampleMajorRadiusPx) ||
    sampleMajorRadiusPx <= 0 ||
    !Number.isFinite(sampleMinorRadiusPx) ||
    sampleMinorRadiusPx <= 0 ||
    !Number.isFinite(searchRadiusPx) ||
    searchRadiusPx <= 0 ||
    !Number.isFinite(sampleCount) ||
    sampleCount <= 0
  ) {
    return 0;
  }

  const footprintAreaRatio = clamp01(
    (sampleMajorRadiusPx * sampleMinorRadiusPx) /
      (searchRadiusPx * searchRadiusPx),
  );
  const minimumResolvableAreaRatio = 1 / sampleCount;
  return Math.min(
    sampleCount,
    1 / Math.max(footprintAreaRatio, minimumResolvableAreaRatio),
  );
};

/**
 * Finalizes the near-layer coverage from proposal-density-compensated mass.
 * The exponential is a bounded union/opacity estimator: it keeps a single
 * sparse proposal below full opacity while repeated contributing footprints
 * approach one smoothly.
 */
export const estimateNearLayerCoverage = (input: {
  coverageMass: number;
  sampleCount: number;
  centerForeground?: boolean;
}): number => {
  if (input.centerForeground) return 1;
  if (
    !Number.isFinite(input.coverageMass) ||
    !Number.isFinite(input.sampleCount) ||
    input.sampleCount <= 0
  ) {
    return 0;
  }

  return clamp01(1 - Math.exp(-Math.max(0, input.coverageMass) / input.sampleCount));
};
