/**
 * Independent, fixture-specific optical reference for the A1 depth-edge
 * qualification. The reference is an untilted 150 mm thin lens focused at
 * 400 mm, with the measured background at 410 mm and f/2.8. It is deliberately
 * bounded to this parallel-plane fixture; it is not a general DOF model.
 */
export const GROUND_GLASS_A1_OPTICAL_REFERENCE = Object.freeze({
  focalLengthMm: 150,
  focusDistanceMm: 400,
  defocusedDistanceMm: 410,
  fNumber: 2.8,
  renderWidthPx: 512,
  renderHeightPx: 384,
  filmWidthMm: 127,
  backgroundPatternWidthMm: 420,
  backgroundPatternCycles: 24,
  gatherSamples: 32,
  cocStorageMaxMm: 12,
  cocStorageCodeCount: 127,
  footprintStorageMaxMm: 6,
  depthNearMm: 10,
  depthFarMm: 4000,
  depthCodeCount: 65535,
  localRoi: Object.freeze({ x0: 84, x1: 212 }),
  /** Mean red-channel rise allowed at the adjacent background edge. Two 8-bit
   * codes are under 1% of the known foreground/background red separation. */
  maximumEdgeRedIncrease: 2,
  focusedContrastRatioMinimum: 0.97,
  focusedContrastRatioMaximum: 1.03,
});

export type GroundGlassA1OpticalMeasurement = Readonly<{
  signedCoCDiameterMm: number;
  majorRadiusMm: number;
  /** Descriptive projection of majorRadiusMm through the declared film scale. */
  majorRadiusPx: number;
  sourceDefocusedContrast: number;
  processedDefocusedContrast: number;
  sourceFocusedContrast: number;
  processedFocusedContrast: number;
  edgeRedIncrease: number;
}>;

export type GroundGlassA1OpticalFailure =
  | "signed-coc-mismatch"
  | "optical-footprint-mismatch"
  | "insufficient-defocus"
  | "excessive-blur"
  | "focused-detail-loss"
  | "depth-rejection-contamination";

export type GroundGlassA1OpticalDecision = Readonly<{
  accepted: boolean;
  failureReasons: readonly GroundGlassA1OpticalFailure[];
  expected: Readonly<{
    signedCoCDiameterMm: number;
    cocToleranceMm: number;
    majorRadiusMm: number;
    majorRadiusToleranceMm: number;
    majorRadiusPx: number;
    localContrastRatio: number;
    localContrastRatioRange: readonly [number, number];
    localContrastRatioTolerance: number;
  }>;
  observed: Readonly<{
    localContrastRatio: number;
  }>;
}>;

const thinLensImageDistanceMm = (distanceMm: number): number => {
  const { focalLengthMm } = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  return focalLengthMm * distanceMm / (distanceMm - focalLengthMm);
};

/** Thin-lens signed CoC diameter; positive denotes the fixture's far side. */
const thinLensSignedCocDiameterMm = (distanceMm: number): number => {
  const reference = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  return reference.focalLengthMm / reference.fNumber * (
    thinLensImageDistanceMm(reference.focusDistanceMm) /
      thinLensImageDistanceMm(distanceMm) - 1
  );
};

const perspectiveDepthCode = (distanceMm: number): number => {
  const { depthNearMm: near, depthFarMm: far } = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  return far / (far - near) - far * near / ((far - near) * distanceMm);
};

const distanceAtPerspectiveDepth = (depth: number): number => {
  const { depthNearMm: near, depthFarMm: far } = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  return far * near / (far - depth * (far - near));
};

const maximumDepthQuantizationCocErrorMm = (distanceMm: number): number => {
  const { depthCodeCount } = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  const code = perspectiveDepthCode(distanceMm);
  const halfCode = 0.5 / depthCodeCount;
  const depthErrorMm = Math.max(
    Math.abs(distanceAtPerspectiveDepth(code - halfCode) - distanceMm),
    Math.abs(distanceAtPerspectiveDepth(code + halfCode) - distanceMm),
  );
  const reference = thinLensSignedCocDiameterMm(distanceMm);
  return Math.max(
    Math.abs(thinLensSignedCocDiameterMm(distanceMm - depthErrorMm) - reference),
    Math.abs(thinLensSignedCocDiameterMm(distanceMm + depthErrorMm) - reference),
  );
};

const signedCocToleranceMm = (): number => {
  const reference = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  const expected = thinLensSignedCocDiameterMm(reference.defocusedDistanceMm);
  const codeStepMm = expected < 0
    ? reference.cocStorageMaxMm / 128
    : reference.cocStorageMaxMm / reference.cocStorageCodeCount;
  return maximumDepthQuantizationCocErrorMm(reference.defocusedDistanceMm) + codeStepMm / 2;
};

const physicalCircleRadiusMm = (): number => {
  const reference = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  const objectDistanceMm = reference.defocusedDistanceMm;
  const focusImageDistanceMm = thinLensImageDistanceMm(reference.focusDistanceMm);
  const objectImageDistanceMm = thinLensImageDistanceMm(objectDistanceMm);
  const apertureRadiusMm = reference.focalLengthMm / (2 * reference.fNumber);
  // In this fixture the aperture, lens and film are parallel. An aperture
  // point maps to the film with scale |1 - vF/vD|, yielding this circle radius.
  return apertureRadiusMm * Math.abs(1 - focusImageDistanceMm / objectImageDistanceMm);
};

const physicalRadiusToleranceMm = (): number => {
  const reference = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  return maximumDepthQuantizationCocErrorMm(reference.defocusedDistanceMm) / 2 +
    reference.footprintStorageMaxMm / 255 / 2;
};

const contrast = (values: readonly number[]): number => {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(Math.max(0, variance));
};

/**
 * Predict this fixture's finite-sample response from the actual GPU source-row
 * readback. The expectation uses the independently derived physical radius,
 * the declared uniform-area 32-point disk quadrature plus its center sample,
 * and the source target's nearest filtering. Vertical offsets do not change
 * the horizontal stripe pattern. This predicts the renderer's declared
 * approximation; it is not a photographic ground-truth blur model.
 */
const predictedGatherContrastRatio = (
  sourceLuminanceRow: readonly number[],
  sourceContrast: number,
  majorRadiusMm: number,
): number => {
  const reference = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  const { x0, x1 } = reference.localRoi;
  if (sourceLuminanceRow.length !== reference.renderWidthPx || sourceContrast <= 0) return Number.NaN;
  const majorRadiusPx = majorRadiusMm * reference.renderWidthPx / reference.filmWidthMm;
  const offsets = [0];
  for (let index = 0; index < reference.gatherSamples; index += 1) {
    const radial = Math.sqrt((index + 0.5) / reference.gatherSamples);
    const angle = (index + 0.5) * 2.39996323;
    const projectedOffsetPx = radial * Math.cos(angle) * majorRadiusPx;
    // At pixel center x + 0.5, nearest filtering selects
    // floor(x + 0.5 + offset), giving this integer displacement.
    offsets.push(Math.floor(0.5 + projectedOffsetPx));
  }
  const processedLuminance = Array.from({ length: x1 - x0 }, (_, roiIndex) => {
    const x = x0 + roiIndex;
    return offsets.reduce((sum, offset) => sum + (sourceLuminanceRow[x + offset] ?? 0), 0) /
      offsets.length;
  });
  return contrast(processedLuminance) / sourceContrast;
};

export const deriveGroundGlassA1OpticalExpectation = (
  sourceLuminanceRow: readonly number[],
  sourceDefocusedContrast: number,
) => {
  const reference = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  const signedCoCDiameterMm = thinLensSignedCocDiameterMm(reference.defocusedDistanceMm);
  const majorRadiusMm = physicalCircleRadiusMm();
  const localContrastRatio = predictedGatherContrastRatio(
    sourceLuminanceRow,
    sourceDefocusedContrast,
    majorRadiusMm,
  );
  // The model begins with actual RGBA8 source bytes. Final per-channel UNORM8
  // conversion gives at most 0.5 luminance code error because the luma weights
  // sum to one; population standard deviation is 1-Lipschitz in that error.
  // 0.51 allows a small margin for float accumulation in the GPU gather.
  const tolerance = sourceDefocusedContrast > 0
    ? 0.51 / sourceDefocusedContrast
    : Number.NaN;
  const filmPixelsPerMm = reference.renderWidthPx / reference.filmWidthMm;
  return Object.freeze({
    signedCoCDiameterMm,
    cocToleranceMm: signedCocToleranceMm(),
    majorRadiusMm,
    majorRadiusToleranceMm: physicalRadiusToleranceMm(),
    majorRadiusPx: majorRadiusMm * filmPixelsPerMm,
    localContrastRatio,
    localContrastRatioRange: [
      Math.max(0, localContrastRatio - tolerance),
      Math.min(1, localContrastRatio + tolerance),
    ] as const,
    localContrastRatioTolerance: tolerance,
  });
};

export const evaluateGroundGlassA1OpticalResponse = (
  measurement: GroundGlassA1OpticalMeasurement,
  sourceLuminanceRow: readonly number[],
): GroundGlassA1OpticalDecision => {
  const reference = GROUND_GLASS_A1_OPTICAL_REFERENCE;
  const expected = deriveGroundGlassA1OpticalExpectation(
    sourceLuminanceRow,
    measurement.sourceDefocusedContrast,
  );
  const failureReasons: GroundGlassA1OpticalFailure[] = [];
  const localContrastRatio = measurement.sourceDefocusedContrast > 0
    ? measurement.processedDefocusedContrast / measurement.sourceDefocusedContrast
    : Number.NaN;
  const focusedContrastRatio = measurement.sourceFocusedContrast > 0
    ? measurement.processedFocusedContrast / measurement.sourceFocusedContrast
    : Number.NaN;

  if (
    !Number.isFinite(measurement.signedCoCDiameterMm) ||
    Math.abs(measurement.signedCoCDiameterMm - expected.signedCoCDiameterMm) > expected.cocToleranceMm
  ) {
    failureReasons.push("signed-coc-mismatch");
  }

  const radiusErrorMm = measurement.majorRadiusMm - expected.majorRadiusMm;
  if (!Number.isFinite(radiusErrorMm) || Math.abs(radiusErrorMm) > expected.majorRadiusToleranceMm) {
    failureReasons.push("optical-footprint-mismatch");
    if (radiusErrorMm > expected.majorRadiusToleranceMm) failureReasons.push("excessive-blur");
  }

  if (
    !Number.isFinite(localContrastRatio) || !Number.isFinite(expected.localContrastRatio) ||
    localContrastRatio < expected.localContrastRatioRange[0]
  ) {
    failureReasons.push("excessive-blur");
  } else if (localContrastRatio > expected.localContrastRatioRange[1]) {
    failureReasons.push("insufficient-defocus");
  }

  if (
    !Number.isFinite(focusedContrastRatio) ||
    focusedContrastRatio < reference.focusedContrastRatioMinimum ||
    focusedContrastRatio > reference.focusedContrastRatioMaximum
  ) {
    failureReasons.push("focused-detail-loss");
  }

  if (
    !Number.isFinite(measurement.edgeRedIncrease) ||
    measurement.edgeRedIncrease > reference.maximumEdgeRedIncrease
  ) {
    failureReasons.push("depth-rejection-contamination");
  }

  return Object.freeze({
    accepted: failureReasons.length === 0,
    failureReasons: Object.freeze([...new Set(failureReasons)]),
    expected,
    observed: Object.freeze({ localContrastRatio }),
  });
};
