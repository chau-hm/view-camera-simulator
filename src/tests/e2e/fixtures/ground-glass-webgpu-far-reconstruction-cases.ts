import {
  clampPixelEllipse,
  depthToleranceMm,
  goldenAngleDiskSample,
  mapPhysicalEllipseToSourcePixels,
  orientedSampleOffsetPx,
  type FilmDimensions,
  type SourceDimensions,
} from "./ground-glass-webgpu-aperture-gather-cases";

export type Pixel = readonly [number, number];
export type Rgb = readonly [number, number, number];

export const nearestTexelAtTopUv = (
  uvTop: readonly [number, number],
  dimensions: SourceDimensions,
): Pixel => {
  if (!uvTop.every(Number.isFinite)
      || ![dimensions.widthPx, dimensions.heightPx].every(Number.isInteger)
      || dimensions.widthPx <= 0
      || dimensions.heightPx <= 0) {
    throw new RangeError("Top-origin nearest sampling requires finite UVs and positive integer dimensions");
  }
  const x = Math.min(1, Math.max(0, uvTop[0]));
  const y = Math.min(1, Math.max(0, uvTop[1]));
  return [
    Math.min(dimensions.widthPx - 1, Math.floor(x * dimensions.widthPx)),
    Math.min(dimensions.heightPx - 1, Math.floor(y * dimensions.heightPx)),
  ];
};

export const gatherTexelForSourcePixelCenter = (
  sourcePixel: Pixel,
  source: SourceDimensions,
  gather: SourceDimensions,
): Pixel => {
  if (!sourcePixel.every(Number.isInteger)
      || sourcePixel[0] < 0 || sourcePixel[1] < 0
      || sourcePixel[0] >= source.widthPx || sourcePixel[1] >= source.heightPx) {
    throw new RangeError("Source pixel must be an in-bounds integer coordinate");
  }
  return nearestTexelAtTopUv(
    [(sourcePixel[0] + 0.5) / source.widthPx, (sourcePixel[1] + 0.5) / source.heightPx],
    gather,
  );
};

export const sourcePixelAtGatherPixelCenter = (
  gatherPixel: Pixel,
  gather: SourceDimensions,
  source: SourceDimensions,
): Pixel => {
  if (!gatherPixel.every(Number.isInteger)
      || gatherPixel[0] < 0 || gatherPixel[1] < 0
      || gatherPixel[0] >= gather.widthPx || gatherPixel[1] >= gather.heightPx) {
    throw new RangeError("Gather pixel must be an in-bounds integer coordinate");
  }
  return [
    Math.min(source.widthPx - 1, Math.floor((gatherPixel[0] + 0.5) * source.widthPx / gather.widthPx)),
    Math.min(source.heightPx - 1, Math.floor((gatherPixel[1] + 0.5) * source.heightPx / gather.heightPx)),
  ];
};

export type FarGatherInput = Readonly<{
  source: SourceDimensions;
  gather: SourceDimensions;
  film: FilmDimensions;
  sampleCount: number;
  maximumCoCRadiusPx: number;
  cameraZMm: number;
  colors: Float32Array;
  physical: Float32Array;
  validity: Uint8Array;
  worldAndDepth: Float32Array;
  /** Native ID-pass source texels actually selected for each gather center. */
  centerSourcePixels?: Int16Array;
}>;

const validateInput = (input: FarGatherInput) => {
  const sourcePixels = input.source.widthPx * input.source.heightPx;
  const gatherPixels = input.gather.widthPx * input.gather.heightPx;
  if (![input.source.widthPx, input.source.heightPx, input.gather.widthPx, input.gather.heightPx]
    .every((value) => Number.isInteger(value) && value > 0)
      || input.colors.length !== sourcePixels * 4
      || input.physical.length !== sourcePixels * 4
      || input.validity.length !== sourcePixels
      || input.worldAndDepth.length !== sourcePixels * 4
      || (input.centerSourcePixels !== undefined && input.centerSourcePixels.length !== gatherPixels * 2)
      || !Number.isInteger(input.sampleCount) || input.sampleCount <= 0 || input.sampleCount > 64
      || !Number.isFinite(input.maximumCoCRadiusPx) || input.maximumCoCRadiusPx <= 0
      || !Number.isFinite(input.cameraZMm)) {
    throw new RangeError("Far gather reference input dimensions or numerical settings are invalid");
  }
  return { sourcePixels, gatherPixels };
};

const pixelOffset = (pixel: Pixel, width: number) => (pixel[1] * width + pixel[0]) * 4;

/**
 * Independent CPU reference for the current low-resolution far gather.
 * Inputs are native GPU readbacks normalized to top-origin rows. Sampling,
 * aperture proposal, depth acceptance, and accumulation are recomputed here.
 */
export const referenceFarGatherTarget = (input: FarGatherInput): {
  rgba: Float32Array;
  centerSourcePixels: Int16Array;
  validFarCenterCount: number;
} => {
  const { gatherPixels } = validateInput(input);
  const rgba = new Float32Array(gatherPixels * 4);
  const centerSourcePixels = new Int16Array(gatherPixels * 2);
  let validFarCenterCount = 0;
  const activeSamples = Math.max(input.sampleCount, 1);

  for (let gatherY = 0; gatherY < input.gather.heightPx; gatherY += 1) {
    for (let gatherX = 0; gatherX < input.gather.widthPx; gatherX += 1) {
      const gatherPixel: Pixel = [gatherX, gatherY];
      const centerIndexInGather = centerIndexFor(gatherPixel, input.gather);
      const centerPixel: Pixel = input.centerSourcePixels
        ? [input.centerSourcePixels[centerIndexInGather]!, input.centerSourcePixels[centerIndexInGather + 1]!]
        : sourcePixelAtGatherPixelCenter(gatherPixel, input.gather, input.source);
      if (!centerPixel.every(Number.isInteger)
          || centerPixel[0] < 0 || centerPixel[1] < 0
          || centerPixel[0] >= input.source.widthPx || centerPixel[1] >= input.source.heightPx) {
        throw new RangeError("Observed gather-center source pixels must be in-bounds integer coordinates");
      }
      const centerIndex = centerPixel[1] * input.source.widthPx + centerPixel[0];
      const centerOffset = pixelOffset(centerPixel, input.source.widthPx);
      centerSourcePixels[centerIndexInGather] = centerPixel[0];
      centerSourcePixels[centerIndexInGather + 1] = centerPixel[1];
      const centerCoc = input.physical[centerOffset] ?? 0;
      const centerFar = input.validity[centerIndex] === 1 && centerCoc > 0.00001;
      if (centerFar) validFarCenterCount += 1;
      const centerDistanceMm = Math.abs((input.worldAndDepth[centerOffset + 2] ?? 0) - input.cameraZMm);
      const physicalMajorMm = input.physical[centerOffset + 1] ?? 0;
      const physicalMinorMm = input.physical[centerOffset + 2] ?? 0;
      const orientationRad = (input.physical[centerOffset + 3] ?? 0) * Math.PI;
      const ellipse = clampPixelEllipse(
        mapPhysicalEllipseToSourcePixels(
          physicalMajorMm,
          physicalMinorMm,
          orientationRad,
          input.film,
          input.source,
        ),
        input.maximumCoCRadiusPx,
      );
      const accumulated = [0, 0, 0];
      let weightAccum = 0;
      if (centerFar) {
        for (let channel = 0; channel < 3; channel += 1) accumulated[channel] = input.colors[centerOffset + channel] ?? 0;
        weightAccum = 1;
      }

      const centerUvTop: readonly [number, number] = [
        (gatherX + 0.5) / input.gather.widthPx,
        (gatherY + 0.5) / input.gather.heightPx,
      ];
      for (let sampleIndex = 0; sampleIndex < input.sampleCount; sampleIndex += 1) {
        const disk = goldenAngleDiskSample(sampleIndex, activeSamples);
        const offset = orientedSampleOffsetPx(disk, ellipse);
        const samplePixel = nearestTexelAtTopUv([
          centerUvTop[0] + offset[0] / input.source.widthPx,
          centerUvTop[1] + offset[1] / input.source.heightPx,
        ], input.source);
        const sampleIndexInSource = samplePixel[1] * input.source.widthPx + samplePixel[0];
        const sampleOffset = pixelOffset(samplePixel, input.source.widthPx);
        const sampleCoc = input.physical[sampleOffset] ?? 0;
        const sampleDepth = input.worldAndDepth[sampleOffset + 3] ?? 1;
        const sampleDistanceMm = Math.abs((input.worldAndDepth[sampleOffset + 2] ?? 0) - input.cameraZMm);
        const accepted = centerFar
          && input.validity[sampleIndexInSource] === 1
          && sampleDepth < 1
          && sampleCoc >= -0.00001
          && sampleDistanceMm >= centerDistanceMm - depthToleranceMm(centerDistanceMm);
        if (!accepted) continue;
        for (let channel = 0; channel < 3; channel += 1) accumulated[channel] += input.colors[sampleOffset + channel] ?? 0;
        weightAccum += 1;
      }

      const outputIndex = (gatherY * input.gather.widthPx + gatherX) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        rgba[outputIndex + channel] = weightAccum > 0
          ? accumulated[channel]! / weightAccum
          : input.colors[centerOffset + channel] ?? 0;
      }
      rgba[outputIndex + 3] = 1;
    }
  }
  return { rgba, centerSourcePixels, validFarCenterCount };
};

const centerIndexFor = (pixel: Pixel, dimensions: SourceDimensions) =>
  (pixel[1] * dimensions.widthPx + pixel[0]) * 2;

export type ReconstructedFar = Readonly<{
  baselineFar: Float32Array;
  compatibleFar: Float32Array;
  gatherX: Uint16Array;
  gatherY: Uint16Array;
  candidateAccepted: Uint8Array;
  candidateGatherPixels: Uint16Array;
}>;

/** Baseline nearest reconstruction and one bounded far-center-compatible candidate. */
export const reconstructFarToSourceGrid = (input: {
  source: SourceDimensions;
  gather: SourceDimensions;
  gatherFar: Float32Array;
  colors: Float32Array;
  physical: Float32Array;
  validity: Uint8Array;
  /** Native ID-pass gather texels selected for each full-resolution source pixel. */
  selectedGatherPixels?: Uint16Array;
  /** Native ID-pass source texels selected at each gather-center coordinate. */
  centerSourcePixels?: Int16Array;
}): ReconstructedFar => {
  const sourcePixels = input.source.widthPx * input.source.heightPx;
  const gatherPixels = input.gather.widthPx * input.gather.heightPx;
  if (input.gatherFar.length !== gatherPixels * 4
      || input.colors.length !== sourcePixels * 4
      || input.physical.length !== sourcePixels * 4
      || input.validity.length !== sourcePixels
      || (input.selectedGatherPixels !== undefined && input.selectedGatherPixels.length !== sourcePixels * 2)
      || (input.centerSourcePixels !== undefined && input.centerSourcePixels.length !== gatherPixels * 2)) {
    throw new RangeError("Far reconstruction input arrays do not match their target dimensions");
  }
  const baselineFar = new Float32Array(sourcePixels * 4);
  const compatibleFar = new Float32Array(sourcePixels * 4);
  const gatherX = new Uint16Array(sourcePixels);
  const gatherY = new Uint16Array(sourcePixels);
  const candidateAccepted = new Uint8Array(sourcePixels);
  const candidateGatherPixels = new Uint16Array(sourcePixels * 2);
  for (let y = 0; y < input.source.heightPx; y += 1) {
    for (let x = 0; x < input.source.widthPx; x += 1) {
      const sourceIndex = y * input.source.widthPx + x;
      const sourceOffset = sourceIndex * 4;
      const selectedIndex = sourceIndex * 2;
      const [gx, gy]: Pixel = input.selectedGatherPixels
        ? [input.selectedGatherPixels[selectedIndex]!, input.selectedGatherPixels[selectedIndex + 1]!]
        : gatherTexelForSourcePixelCenter([x, y], input.source, input.gather);
      if (!Number.isInteger(gx) || !Number.isInteger(gy)
          || gx < 0 || gy < 0 || gx >= input.gather.widthPx || gy >= input.gather.heightPx) {
        throw new RangeError("Observed selected gather texels must be in-bounds integer coordinates");
      }
      const gatherIndex = (gy * input.gather.widthPx + gx) * 4;
      gatherX[sourceIndex] = gx;
      gatherY[sourceIndex] = gy;
      const centerOffset = (gy * input.gather.widthPx + gx) * 2;
      const centerPixel: Pixel = input.centerSourcePixels
        ? [input.centerSourcePixels[centerOffset]!, input.centerSourcePixels[centerOffset + 1]!]
        : sourcePixelAtGatherPixelCenter([gx, gy], input.gather, input.source);
      if (!centerPixel.every(Number.isInteger)
          || centerPixel[0] < 0 || centerPixel[1] < 0
          || centerPixel[0] >= input.source.widthPx || centerPixel[1] >= input.source.heightPx) {
        throw new RangeError("Observed gather-center source pixels must be in-bounds integer coordinates");
      }
      const centerIndex = centerPixel[1] * input.source.widthPx + centerPixel[0];
      const farCenterEligible = input.validity[centerIndex] === 1
        && (input.physical[centerIndex * 4] ?? 0) > 0.00001;
      candidateAccepted[sourceIndex] = farCenterEligible ? 1 : 0;
      candidateGatherPixels[sourceIndex * 2] = gx;
      candidateGatherPixels[sourceIndex * 2 + 1] = gy;
      for (let channel = 0; channel < 3; channel += 1) {
        const sampledFar = input.gatherFar[gatherIndex + channel] ?? 0;
        baselineFar[sourceOffset + channel] = sampledFar;
        compatibleFar[sourceOffset + channel] = farCenterEligible
          ? sampledFar
          : input.colors[sourceOffset + channel] ?? 0;
      }
      baselineFar[sourceOffset + 3] = 1;
      compatibleFar[sourceOffset + 3] = 1;
    }
  }
  return { baselineFar, compatibleFar, gatherX, gatherY, candidateAccepted, candidateGatherPixels };
};

export const compositeFarAndNear = (far: Float32Array, near: Float32Array): Float32Array => {
  if (far.length !== near.length || far.length % 4 !== 0) {
    throw new RangeError("Far and near composite targets must have matching RGBA dimensions");
  }
  const result = new Float32Array(far.length);
  for (let offset = 0; offset < far.length; offset += 4) {
    const alpha = Math.min(1, Math.max(0, near[offset + 3] ?? 0));
    for (let channel = 0; channel < 3; channel += 1) {
      result[offset + channel] = (far[offset + channel] ?? 0) * (1 - alpha)
        + (near[offset + channel] ?? 0) * alpha;
    }
    result[offset + 3] = 1;
  }
  return result;
};

export const compareRgba = (expected: Float32Array, actual: Float32Array) => {
  if (expected.length !== actual.length || expected.length % 4 !== 0) {
    throw new RangeError("RGBA comparisons require equal-length four-channel arrays");
  }
  let maxRgbError = 0;
  let totalRgbError = 0;
  let samples = 0;
  for (let offset = 0; offset < expected.length; offset += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs((expected[offset + channel] ?? 0) - (actual[offset + channel] ?? 0));
      maxRgbError = Math.max(maxRgbError, error);
      totalRgbError += error;
      samples += 1;
    }
  }
  return { samples, maxRgbError, meanRgbError: totalRgbError / Math.max(samples, 1) };
};

export type FarSignalMetricsInput = Readonly<{
  source: SourceDimensions;
  sourceColors: Float32Array;
  farRgba: Float32Array;
  roiMask: Uint8Array;
  featureCenterPx: readonly [number, number];
  backgroundRgb: Rgb;
  signalWeights: Rgb;
  threshold: number;
  radialBinWidthPx: number;
  radialBinCount: number;
}>;

/**
 * Measures a declared linear-RGB signal over one fixed source-grid ROI.
 * Signal extraction is intentionally supplied by the caller: this helper is
 * a spatial-statistics tool, not an optical or color-classification model.
 */
export const measureFarSignalMetrics = (input: FarSignalMetricsInput) => {
  const pixelCount = input.source.widthPx * input.source.heightPx;
  if (input.sourceColors.length !== pixelCount * 4
      || input.farRgba.length !== pixelCount * 4
      || input.roiMask.length !== pixelCount
      || !input.featureCenterPx.every(Number.isFinite)
      || ![...input.backgroundRgb, ...input.signalWeights, input.threshold, input.radialBinWidthPx, input.radialBinCount]
        .every(Number.isFinite)
      || input.threshold < 0
      || input.radialBinWidthPx <= 0
      || !Number.isInteger(input.radialBinCount)
      || input.radialBinCount <= 0) {
    throw new RangeError("Far signal metrics require matching source-grid arrays and finite settings");
  }

  let roiPixelCount = 0;
  let signalEnergy = 0;
  let thresholdedSignalEnergy = 0;
  let peakSignal = 0;
  let thresholdClassifiedPixelCount = 0;
  let weightedX = 0;
  let weightedY = 0;
  const radialBins = Array.from({ length: input.radialBinCount }, (_, index) => ({
    minDistancePx: index * input.radialBinWidthPx,
    maxDistancePx: (index + 1) * input.radialBinWidthPx,
    roiPixelCount: 0,
    signalEnergy: 0,
    meanSignal: 0,
  }));
  const samples: Array<{ x: number; y: number; signal: number }> = [];

  for (let y = 0; y < input.source.heightPx; y += 1) {
    for (let x = 0; x < input.source.widthPx; x += 1) {
      const pixelIndex = y * input.source.widthPx + x;
      if (input.roiMask[pixelIndex] !== 1) continue;
      roiPixelCount += 1;
      const offset = pixelIndex * 4;
      const red = (input.farRgba[offset] ?? 0) - input.backgroundRgb[0];
      const green = (input.farRgba[offset + 1] ?? 0) - input.backgroundRgb[1];
      const blue = (input.farRgba[offset + 2] ?? 0) - input.backgroundRgb[2];
      const signal = Math.max(0,
        red * input.signalWeights[0]
        + green * input.signalWeights[1]
        + blue * input.signalWeights[2],
      );
      const distance = Math.hypot(x - input.featureCenterPx[0], y - input.featureCenterPx[1]);
      const radialIndex = Math.floor(distance / input.radialBinWidthPx);
      if (radialIndex < radialBins.length) {
        radialBins[radialIndex]!.roiPixelCount += 1;
        radialBins[radialIndex]!.signalEnergy += signal;
      }
      signalEnergy += signal;
      peakSignal = Math.max(peakSignal, signal);
      if (signal > input.threshold) {
        thresholdClassifiedPixelCount += 1;
        thresholdedSignalEnergy += signal;
      }
      weightedX += signal * x;
      weightedY += signal * y;
      samples.push({ x, y, signal });
    }
  }

  for (const bin of radialBins) {
    bin.meanSignal = bin.roiPixelCount > 0 ? bin.signalEnergy / bin.roiPixelCount : 0;
  }
  const centroidPx: [number, number] | null = signalEnergy > 0
    ? [weightedX / signalEnergy, weightedY / signalEnergy]
    : null;
  let covariance: { xx: number; xy: number; yy: number } | null = null;
  if (centroidPx) {
    let xx = 0;
    let xy = 0;
    let yy = 0;
    for (const sample of samples) {
      const dx = sample.x - centroidPx[0];
      const dy = sample.y - centroidPx[1];
      xx += sample.signal * dx * dx;
      xy += sample.signal * dx * dy;
      yy += sample.signal * dy * dy;
    }
    covariance = { xx: xx / signalEnergy, xy: xy / signalEnergy, yy: yy / signalEnergy };
  }

  return {
    roiPixelCount,
    signalEnergy,
    thresholdedSignalEnergy,
    normalizedSignalEnergy: roiPixelCount > 0 ? signalEnergy / roiPixelCount : 0,
    meanSignalPerRoiPixel: roiPixelCount > 0 ? signalEnergy / roiPixelCount : 0,
    peakSignal,
    threshold: input.threshold,
    thresholdClassifiedPixelCount,
    signalWeightedCentroidPx: centroidPx,
    signalWeightedCovariancePx2: covariance,
    radialProfile: radialBins,
    profileCenterPx: input.featureCenterPx,
    profileBinWidthPx: input.radialBinWidthPx,
  };
};

export type FarSignalMetrics = ReturnType<typeof measureFarSignalMetrics>;

/** Compares radial energy shape separately from total energy magnitude. */
export const compareRadialEnergyProfiles = (
  reference: FarSignalMetrics,
  candidate: FarSignalMetrics,
) => {
  const referenceBins = reference.radialProfile;
  const candidateBins = candidate.radialProfile;
  const sameCenter = reference.profileCenterPx.every((value, index) =>
    Math.abs(value - (candidate.profileCenterPx[index] ?? Number.NaN)) <= 1e-6,
  );
  if (referenceBins.length === 0
      || referenceBins.length !== candidateBins.length
      || !sameCenter
      || reference.profileBinWidthPx !== candidate.profileBinWidthPx
      || referenceBins.some((bin, index) => {
        const other = candidateBins[index];
        return !other
          || bin.minDistancePx !== other.minDistancePx
          || bin.maxDistancePx !== other.maxDistancePx
          || bin.roiPixelCount !== other.roiPixelCount;
      })) {
    throw new RangeError("Radial profile comparisons require matching centers, bins, and source-grid ROI coverage");
  }
  const referenceCoveredEnergy = referenceBins.reduce((sum, bin) => sum + bin.signalEnergy, 0);
  const candidateCoveredEnergy = candidateBins.reduce((sum, bin) => sum + bin.signalEnergy, 0);
  if (!(referenceCoveredEnergy > 0) || !(candidateCoveredEnergy > 0)) {
    throw new RangeError("Radial profile comparisons require positive signal in the measured radius range");
  }
  const bins = referenceBins.map((bin, index) => {
    const other = candidateBins[index]!;
    const referenceShare = bin.signalEnergy / referenceCoveredEnergy;
    const candidateShare = other.signalEnergy / candidateCoveredEnergy;
    return {
      minDistancePx: bin.minDistancePx,
      maxDistancePx: bin.maxDistancePx,
      referenceEnergy: bin.signalEnergy,
      candidateEnergy: other.signalEnergy,
      referenceEnergyShare: referenceShare,
      candidateEnergyShare: candidateShare,
      absoluteEnergyShareError: Math.abs(referenceShare - candidateShare),
    };
  });
  const squaredShareError = bins.reduce((sum, bin) => sum + bin.absoluteEnergyShareError ** 2, 0);
  return {
    binCount: bins.length,
    profileCenterPx: reference.profileCenterPx,
    radialBinWidthPx: reference.profileBinWidthPx,
    referenceCoveredEnergy,
    candidateCoveredEnergy,
    referenceCoveredEnergyFraction: referenceCoveredEnergy / reference.signalEnergy,
    candidateCoveredEnergyFraction: candidateCoveredEnergy / candidate.signalEnergy,
    meanAbsoluteEnergyShareError: bins.reduce((sum, bin) => sum + bin.absoluteEnergyShareError, 0) / bins.length,
    rootMeanSquareEnergyShareError: Math.sqrt(squaredShareError / bins.length),
    bins,
  };
};

export const compareRgbaOnMask = (
  expected: Float32Array,
  actual: Float32Array,
  mask: Uint8Array,
) => {
  if (expected.length !== actual.length || expected.length % 4 !== 0 || mask.length !== expected.length / 4) {
    throw new RangeError("Masked RGBA comparisons require matching pixels and mask dimensions");
  }
  let pixelCount = 0;
  let absoluteError = 0;
  let squaredError = 0;
  let maxRgbError = 0;
  let samples = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (mask[pixel] !== 1) continue;
    pixelCount += 1;
    const offset = pixel * 4;
    for (let channel = 0; channel < 3; channel += 1) {
      const error = Math.abs((expected[offset + channel] ?? 0) - (actual[offset + channel] ?? 0));
      absoluteError += error;
      squaredError += error * error;
      maxRgbError = Math.max(maxRgbError, error);
      samples += 1;
    }
  }
  return {
    pixelCount,
    samples,
    meanAbsoluteRgbError: absoluteError / Math.max(samples, 1),
    rootMeanSquareRgbError: Math.sqrt(squaredError / Math.max(samples, 1)),
    maxRgbError,
  };
};

/** Compares the complete Near Gather RGBA target without changing RGB-only image metrics. */
export const compareNearTargetRgba = (
  expected: Float32Array,
  actual: Float32Array,
) => {
  if (expected.length === 0
      || expected.length !== actual.length
      || expected.length % 4 !== 0) {
    throw new RangeError("Near-target RGBA comparisons require matching, non-empty complete pixels");
  }

  let squaredRgbError = 0;
  let maxRgbError = 0;
  let squaredAlphaError = 0;
  let maxAlphaError = 0;
  const pixelCount = expected.length / 4;

  for (let offset = 0; offset < expected.length; offset += 4) {
    for (let channel = 0; channel < 4; channel += 1) {
      const expectedValue = expected[offset + channel]!;
      const actualValue = actual[offset + channel]!;
      if (!Number.isFinite(expectedValue) || !Number.isFinite(actualValue)) {
        throw new RangeError("Near-target RGBA comparisons require finite channel values");
      }
      const error = Math.abs(expectedValue - actualValue);
      if (channel === 3) {
        squaredAlphaError += error * error;
        maxAlphaError = Math.max(maxAlphaError, error);
      } else {
        squaredRgbError += error * error;
        maxRgbError = Math.max(maxRgbError, error);
      }
    }
  }

  return {
    pixelCount,
    rootMeanSquareRgbError: Math.sqrt(squaredRgbError / (pixelCount * 3)),
    maxRgbError,
    rootMeanSquareAlphaError: Math.sqrt(squaredAlphaError / pixelCount),
    maxAlphaError,
  };
};

export type SurfaceAwareFarInput = Readonly<{
  source: SourceDimensions;
  gather: SourceDimensions;
  gatherFar: Float32Array;
  colors: Float32Array;
  physical: Float32Array;
  validity: Uint8Array;
  worldAndDepth: Float32Array;
  selectedGatherPixels?: Uint16Array;
  centerSourcePixels?: Int16Array;
  cameraZMm: number;
  depthTolerance: (distanceMm: number) => number;
  spatialWeight: (dx: number, dy: number) => number;
  fullResolutionPassthrough?: boolean;
}>;

export type SurfaceAwareFarResult = Readonly<{
  rgba: Float32Array;
  acceptedNeighborCount: Uint8Array;
  acceptedWeightSum: Float32Array;
  fallbackReason: Uint8Array;
  selectedGatherPixels: Uint16Array;
  neighborRecords: Array<Array<{
    gatherPixel: Pixel;
    centerSourcePixel: Pixel;
    centerDistanceMm: number;
    centerDepth: number;
    centerSignedCoCMm: number;
    validityCode: number;
    depthCompatible: boolean;
    spatialWeight: number;
    accepted: boolean;
  }>>;
}>;

/** Independent CPU oracle for a 3×3 surface-aware far reconstruction. */
export const reconstructSurfaceAwareFar = (input: SurfaceAwareFarInput): SurfaceAwareFarResult => {
  const sourcePixelCount = input.source.widthPx * input.source.heightPx;
  const gatherPixelCount = input.gather.widthPx * input.gather.heightPx;
  if (input.gatherFar.length !== gatherPixelCount * 4
      || input.colors.length !== sourcePixelCount * 4
      || input.physical.length !== sourcePixelCount * 4
      || input.validity.length !== sourcePixelCount
      || input.worldAndDepth.length !== sourcePixelCount * 4
      || (input.selectedGatherPixels && input.selectedGatherPixels.length !== sourcePixelCount * 2)
      || (input.centerSourcePixels && input.centerSourcePixels.length !== gatherPixelCount * 2)
      || !Number.isFinite(input.cameraZMm)) {
    throw new RangeError("Surface-aware reconstruction inputs do not match their source/gather dimensions");
  }
  const rgba = new Float32Array(sourcePixelCount * 4);
  const acceptedNeighborCount = new Uint8Array(sourcePixelCount);
  const acceptedWeightSum = new Float32Array(sourcePixelCount);
  const fallbackReason = new Uint8Array(sourcePixelCount);
  const selectedGatherPixels = new Uint16Array(sourcePixelCount * 2);
  const neighborRecords: SurfaceAwareFarResult["neighborRecords"] = Array.from({ length: sourcePixelCount }, () => []);
  const isFullResolution = input.fullResolutionPassthrough
    ?? (input.source.widthPx === input.gather.widthPx && input.source.heightPx === input.gather.heightPx);

  for (let y = 0; y < input.source.heightPx; y += 1) {
    for (let x = 0; x < input.source.widthPx; x += 1) {
      const sourceIndex = y * input.source.widthPx + x;
      const sourceOffset = sourceIndex * 4;
      const selectedIndex = sourceIndex * 2;
      const selectedPixel: Pixel = input.selectedGatherPixels
        ? [input.selectedGatherPixels[selectedIndex]!, input.selectedGatherPixels[selectedIndex + 1]!]
        : gatherTexelForSourcePixelCenter([x, y], input.source, input.gather);
      if (!selectedPixel.every(Number.isInteger)
          || selectedPixel[0] < 0 || selectedPixel[1] < 0
          || selectedPixel[0] >= input.gather.widthPx || selectedPixel[1] >= input.gather.heightPx) {
        throw new RangeError("Observed selected gather pixels must be in-bounds integer coordinates");
      }
      selectedGatherPixels[selectedIndex] = selectedPixel[0];
      selectedGatherPixels[selectedIndex + 1] = selectedPixel[1];
      const selectedFarOffset = pixelOffset(selectedPixel, input.gather.widthPx);
      const destinationValid = input.validity[sourceIndex] === 1;
      const destinationCoc = input.physical[sourceOffset] ?? 0;
      const destinationFar = destinationValid && destinationCoc > 0.00001;
      const destinationDepth = input.worldAndDepth[sourceOffset + 3] ?? 1;
      const destinationDistance = Math.abs((input.worldAndDepth[sourceOffset + 2] ?? 0) - input.cameraZMm);

      if (isFullResolution) {
        for (let channel = 0; channel < 3; channel += 1) rgba[sourceOffset + channel] = input.gatherFar[selectedFarOffset + channel] ?? 0;
        rgba[sourceOffset + 3] = -2;
        fallbackReason[sourceIndex] = 3;
        continue;
      }

      if (!destinationFar || destinationDepth >= 1) {
        for (let channel = 0; channel < 3; channel += 1) rgba[sourceOffset + channel] = input.gatherFar[selectedFarOffset + channel] ?? 0;
        rgba[sourceOffset + 3] = -1;
        fallbackReason[sourceIndex] = 2;
        continue;
      }

      let acceptedCount = 0;
      let acceptedWeight = 0;
      const accumulated = [0, 0, 0];
      const records: SurfaceAwareFarResult["neighborRecords"][number] = [];
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const neighborX = selectedPixel[0] + dx;
          const neighborY = selectedPixel[1] + dy;
          if (neighborX < 0 || neighborX >= input.gather.widthPx || neighborY < 0 || neighborY >= input.gather.heightPx) continue;
          const neighborPixel: Pixel = [neighborX, neighborY];
          const neighborIndex = (neighborY * input.gather.widthPx + neighborX) * 2;
          const centerPixel: Pixel = input.centerSourcePixels
            ? [input.centerSourcePixels[neighborIndex]!, input.centerSourcePixels[neighborIndex + 1]!]
            : sourcePixelAtGatherPixelCenter(neighborPixel, input.gather, input.source);
          if (!centerPixel.every(Number.isInteger)
              || centerPixel[0] < 0 || centerPixel[1] < 0
              || centerPixel[0] >= input.source.widthPx || centerPixel[1] >= input.source.heightPx) {
            throw new RangeError("Observed neighbor gather centers must be in-bounds integer coordinates");
          }
          const centerIndex = centerPixel[1] * input.source.widthPx + centerPixel[0];
          const centerOffset = centerIndex * 4;
          const centerDistance = Math.abs((input.worldAndDepth[centerOffset + 2] ?? 0) - input.cameraZMm);
          const centerCoc = input.physical[centerOffset] ?? 0;
          const centerValid = input.validity[centerIndex] === 1 && (input.worldAndDepth[centerOffset + 3] ?? 1) < 1;
          const depthCompatible = Math.abs(centerDistance - destinationDistance) <= input.depthTolerance(destinationDistance);
          const weight = input.spatialWeight(dx, dy);
          const accepted = centerValid && centerCoc > 0.00001 && depthCompatible && weight > 0;
          records.push({
            gatherPixel: neighborPixel,
            centerSourcePixel: centerPixel,
            centerDistanceMm: centerDistance,
            centerDepth: input.worldAndDepth[centerOffset + 3] ?? 1,
            centerSignedCoCMm: centerCoc,
            validityCode: input.validity[centerIndex] ?? 0,
            depthCompatible,
            spatialWeight: weight,
            accepted,
          });
          if (!accepted) continue;
          const gatherOffset = pixelOffset(neighborPixel, input.gather.widthPx);
          for (let channel = 0; channel < 3; channel += 1) accumulated[channel] += (input.gatherFar[gatherOffset + channel] ?? 0) * weight;
          acceptedCount += 1;
          acceptedWeight += weight;
        }
      }
      neighborRecords[sourceIndex] = records;
      acceptedNeighborCount[sourceIndex] = acceptedCount;
      acceptedWeightSum[sourceIndex] = acceptedWeight;
      if (acceptedWeight > 0) {
        for (let channel = 0; channel < 3; channel += 1) rgba[sourceOffset + channel] = accumulated[channel]! / acceptedWeight;
        fallbackReason[sourceIndex] = 0;
        rgba[sourceOffset + 3] = acceptedCount + acceptedWeight / 10;
      } else {
        for (let channel = 0; channel < 3; channel += 1) rgba[sourceOffset + channel] = input.colors[sourceOffset + channel] ?? 0;
        fallbackReason[sourceIndex] = 1;
        rgba[sourceOffset + 3] = 0;
      }
    }
  }
  return { rgba, acceptedNeighborCount, acceptedWeightSum, fallbackReason, selectedGatherPixels, neighborRecords };
};

/** Computes the test-only camera-axis depth tolerance used by the CPU oracle. */
export const phaseIFarDepthToleranceMm = (destinationDistanceMm: number) => Math.max(20, destinationDistanceMm * 0.015);

/** The candidate's bounded spatial weighting: center=1, axial=1/2, diagonal=1/3. */
export const phaseISpatialWeight = (dx: number, dy: number) => 1 / (1 + dx * dx + dy * dy);

export const auditCompatibleFarNeighbors = (input: SurfaceAwareFarInput & Readonly<{
  baselineFar: Float32Array;
  blueRoiMask: Uint8Array;
  foregroundMask: Uint8Array;
}>): {
  problematicPixelCount: number;
  currentCenterFarCount: number;
  compatibleNeighborAtLeastOneCount: number;
  compatibleNeighborAtLeastTwoCount: number;
  noCompatibleNeighborCount: number;
  farNeighborsRejectedByDepthCount: number;
  invalidOrUnresolvedNeighborObservations: number;
  records: Array<Record<string, unknown>>;
} => {
  const sourcePixelCount = input.source.widthPx * input.source.heightPx;
  if (input.baselineFar.length !== sourcePixelCount * 4
      || input.blueRoiMask.length !== sourcePixelCount
      || input.foregroundMask.length !== sourcePixelCount) {
    throw new RangeError("Neighbor coverage audit requires source-grid raster and mask arrays");
  }
  const records: Array<Record<string, unknown>> = [];
  let currentCenterFarCount = 0;
  let compatibleNeighborAtLeastOneCount = 0;
  let compatibleNeighborAtLeastTwoCount = 0;
  let noCompatibleNeighborCount = 0;
  let farNeighborsRejectedByDepthCount = 0;
  let invalidOrUnresolvedNeighborObservations = 0;
  const sourcePixelIsRed = (index: number) => input.foregroundMask[index] === 1;
  for (let sourceIndex = 0; sourceIndex < sourcePixelCount; sourceIndex += 1) {
    if (input.blueRoiMask[sourceIndex] !== 1) continue;
    const sourceOffset = sourceIndex * 4;
    const red = input.baselineFar[sourceOffset] ?? 0;
    const green = input.baselineFar[sourceOffset + 1] ?? 0;
    const blue = input.baselineFar[sourceOffset + 2] ?? 0;
    if (!(red > 0.5 && green < 0.12 && blue < 0.12) || sourcePixelIsRed(sourceIndex)) continue;
    const sourceX = sourceIndex % input.source.widthPx;
    const sourceY = Math.floor(sourceIndex / input.source.widthPx);
    const selectedOffset = sourceIndex * 2;
    const selectedPixel: Pixel = input.selectedGatherPixels
      ? [input.selectedGatherPixels[selectedOffset]!, input.selectedGatherPixels[selectedOffset + 1]!]
      : gatherTexelForSourcePixelCenter([sourceX, sourceY], input.source, input.gather);
    const selectedCenterIndex = (selectedPixel[1] * input.gather.widthPx + selectedPixel[0]) * 2;
    const currentCenter: Pixel = input.centerSourcePixels
      ? [input.centerSourcePixels[selectedCenterIndex]!, input.centerSourcePixels[selectedCenterIndex + 1]!]
      : sourcePixelAtGatherPixelCenter(selectedPixel, input.gather, input.source);
    const currentCenterSourceIndex = currentCenter[1] * input.source.widthPx + currentCenter[0];
    const currentCenterFar = input.validity[currentCenterSourceIndex] === 1
      && (input.physical[currentCenterSourceIndex * 4] ?? 0) > 0.00001;
    if (currentCenterFar) currentCenterFarCount += 1;
    const destinationOffset = sourceOffset;
    const destinationDistance = Math.abs((input.worldAndDepth[destinationOffset + 2] ?? 0) - input.cameraZMm);
    const compatibleNeighbors: Array<Record<string, unknown>> = [];
    const observedNeighbors: Array<Record<string, unknown>> = [];
    for (let dy = -1; dy <= 1; dy += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const gx = selectedPixel[0] + dx;
        const gy = selectedPixel[1] + dy;
        if (gx < 0 || gx >= input.gather.widthPx || gy < 0 || gy >= input.gather.heightPx) continue;
        const gatherPixel: Pixel = [gx, gy];
        const centerIndex = (gy * input.gather.widthPx + gx) * 2;
        const center: Pixel = input.centerSourcePixels
          ? [input.centerSourcePixels[centerIndex]!, input.centerSourcePixels[centerIndex + 1]!]
          : sourcePixelAtGatherPixelCenter(gatherPixel, input.gather, input.source);
        const sourceCenterIndex = center[1] * input.source.widthPx + center[0];
        const centerOffset = sourceCenterIndex * 4;
        const validityCode = input.validity[sourceCenterIndex] ?? 0;
        const signedCoc = input.physical[centerOffset] ?? 0;
        const depth = input.worldAndDepth[centerOffset + 3] ?? 1;
        const distance = Math.abs((input.worldAndDepth[centerOffset + 2] ?? 0) - input.cameraZMm);
        const validFar = validityCode === 1 && depth < 1 && signedCoc > 0.00001;
        const depthDelta = Math.abs(distance - destinationDistance);
        const depthCompatible = depthDelta <= input.depthTolerance(destinationDistance);
        if (validityCode !== 1) invalidOrUnresolvedNeighborObservations += 1;
        const record = {
          gatherPixel,
          centerSourcePixel: center,
          validityCode,
          depth,
          distanceMm: distance,
          signedCoCMm: signedCoc,
          validFar,
          depthDeltaMm: depthDelta,
          depthToleranceMm: input.depthTolerance(destinationDistance),
          depthCompatible,
        };
        observedNeighbors.push(record);
        if (validFar && !depthCompatible) farNeighborsRejectedByDepthCount += 1;
        if (validFar && depthCompatible) compatibleNeighbors.push(record);
      }
    }
    if (compatibleNeighbors.length >= 1) compatibleNeighborAtLeastOneCount += 1;
    if (compatibleNeighbors.length >= 2) compatibleNeighborAtLeastTwoCount += 1;
    if (compatibleNeighbors.length === 0) noCompatibleNeighborCount += 1;
    records.push({
      sourcePixel: [sourceX, sourceY],
      selectedGatherPixel: selectedPixel,
      currentCenterSourcePixel: currentCenter,
      currentCenterFar,
      destinationDistanceMm: destinationDistance,
      destinationSignedCoCMm: input.physical[destinationOffset] ?? 0,
      compatibleNeighborCount: compatibleNeighbors.length,
      compatibleNeighbors,
      observedNeighbors,
    });
  }
  return {
    problematicPixelCount: records.length,
    currentCenterFarCount,
    compatibleNeighborAtLeastOneCount,
    compatibleNeighborAtLeastTwoCount,
    noCompatibleNeighborCount,
    farNeighborsRejectedByDepthCount,
    invalidOrUnresolvedNeighborObservations,
    records,
  };
};
