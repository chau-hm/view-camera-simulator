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
