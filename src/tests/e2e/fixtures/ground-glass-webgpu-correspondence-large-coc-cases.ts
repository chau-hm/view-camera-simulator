import * as THREE from "three";

/** Native r186 source-identity readback matched top-origin rows; keep one measured convention for all research arrays. */
export const PHASE_K_READBACK_ORIGIN = "top" as const;

export const readbackRowForTopOriginPixel = (
  y: number,
  height: number,
  origin: "top" | "bottom" = PHASE_K_READBACK_ORIGIN,
): number => origin === "top" ? y : height - 1 - y;

export const countSourceIdentityMismatches = (
  raw: Float32Array,
  width: number,
  height: number,
  origin: "top" | "bottom",
): number => {
  if (raw.length !== width * height * 4) throw new RangeError("Source identity buffer dimensions do not match");
  let mismatches = 0;
  for (let y = 0; y < height; y += 1) {
    const readbackY = readbackRowForTopOriginPixel(y, height, origin);
    for (let x = 0; x < width; x += 1) {
      const offset = (readbackY * width + x) * 4;
      if (raw[offset] !== x || raw[offset + 1] !== y) mismatches += 1;
    }
  }
  return mismatches;
};

export type ProjectedPixelCenter = Readonly<{
  cameraSpaceM: readonly [number, number, number];
  clipSpace: readonly [number, number, number, number];
  ndc: readonly [number, number, number];
  continuousPixelTopOrigin: readonly [number, number];
  pixelTopOrigin: readonly [number, number];
  pixelCenterTopOrigin: readonly [number, number];
  inBounds: boolean;
}>;

export const projectWorldPointToPixelCenter = (input: {
  worldPointM: readonly [number, number, number];
  worldMatrixElements: readonly number[];
  projectionMatrixElements: readonly number[];
  width: number;
  height: number;
}): ProjectedPixelCenter => {
  if (input.worldMatrixElements.length !== 16 || input.projectionMatrixElements.length !== 16) {
    throw new RangeError("Camera matrices must contain 16 elements");
  }
  const world = new THREE.Matrix4().fromArray([...input.worldMatrixElements]);
  const projection = new THREE.Matrix4().fromArray([...input.projectionMatrixElements]);
  const cameraSpace = new THREE.Vector3(...input.worldPointM).applyMatrix4(world.clone().invert());
  const clip = new THREE.Vector4(...input.worldPointM, 1).applyMatrix4(projection.clone().multiply(world.clone().invert()));
  const ndc = new THREE.Vector3(clip.x / clip.w, clip.y / clip.w, clip.z / clip.w);
  const continuousX = (ndc.x + 1) * 0.5 * input.width;
  const continuousY = (1 - ndc.y) * 0.5 * input.height;
  const pixelX = Math.floor(continuousX);
  const pixelY = Math.floor(continuousY);
  return {
    cameraSpaceM: [cameraSpace.x, cameraSpace.y, cameraSpace.z],
    clipSpace: [clip.x, clip.y, clip.z, clip.w],
    ndc: [ndc.x, ndc.y, ndc.z],
    continuousPixelTopOrigin: [continuousX, continuousY],
    pixelTopOrigin: [pixelX, pixelY],
    pixelCenterTopOrigin: [pixelX + 0.5, pixelY + 0.5],
    inBounds: pixelX >= 0 && pixelX < input.width && pixelY >= 0 && pixelY < input.height,
  };
};

const rgbMetrics = (reference: Float32Array, actual: Float32Array, mask: Uint8Array) => {
  let squared = 0;
  let absolute = 0;
  let maximum = 0;
  let channels = 0;
  let pixels = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    pixels += 1;
    for (let channel = 0; channel < 3; channel += 1) {
      const offset = pixel * 4 + channel;
      const error = Math.abs((reference[offset] ?? 0) - (actual[offset] ?? 0));
      squared += error * error;
      absolute += error;
      maximum = Math.max(maximum, error);
      channels += 1;
    }
  }
  return {
    pixelCount: pixels,
    rgbMeanAbsoluteError: channels ? absolute / channels : null,
    rgbRootMeanSquareError: channels ? Math.sqrt(squared / channels) : null,
    maximumChannelError: channels ? maximum : null,
  };
};

const absoluteLinearLumaMetrics = (reference: Float32Array, actual: Float32Array, mask: Uint8Array) => {
  let absolute = 0;
  let maximum = 0;
  let pixels = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const difference = absoluteLinearLumaDifference(reference, actual, pixel * 4);
    absolute += difference;
    maximum = Math.max(maximum, difference);
    pixels += 1;
  }
  return {
    pixelCount: pixels,
    meanAbsoluteLumaDifference: pixels ? absolute / pixels : null,
    maximumAbsoluteLumaDifference: pixels ? maximum : null,
  };
};

/**
 * Absolute difference of linear luminance values. The fixture's floating-point
 * render targets use NoColorSpace and NoToneMapping, so readback RGB is linear.
 */
export const absoluteLinearLumaDifference = (left: Float32Array, right: Float32Array, offset: number): number => {
  if (!Number.isInteger(offset) || offset < 0 || offset + 2 >= left.length || offset + 2 >= right.length) {
    throw new RangeError("Linear RGB sample is outside the supplied raster");
  }
  const deltaR = left[offset]! - right[offset]!;
  const deltaG = left[offset + 1]! - right[offset + 1]!;
  const deltaB = left[offset + 2]! - right[offset + 2]!;
  if (![deltaR, deltaG, deltaB].every(Number.isFinite)) {
    throw new RangeError("Linear RGB sample contains a non-finite channel");
  }
  return Math.abs(0.2126 * deltaR + 0.7152 * deltaG + 0.0722 * deltaB);
};

const assertFiniteRaster = (name: string, values: Float32Array) => {
  for (let index = 0; index < values.length; index += 1) {
    if (!Number.isFinite(values[index])) throw new RangeError(`${name} raster contains a non-finite value at ${index}`);
  }
};

export const compareLinearRgbaRasters = (
  baseline: Float32Array,
  capped: Float32Array,
  mask: Uint8Array,
  changedPixelThresholdLinear = 1e-5,
) => {
  if (baseline.length !== capped.length || baseline.length !== mask.length * 4) {
    throw new RangeError("Raster difference inputs do not match");
  }
  if (!Number.isFinite(changedPixelThresholdLinear) || changedPixelThresholdLinear < 0) {
    throw new RangeError("Changed-pixel threshold must be finite and non-negative");
  }
  assertFiniteRaster("baseline", baseline);
  assertFiniteRaster("capped", capped);
  let pixelCount = 0;
  let changedPixelCount = 0;
  let absoluteRgb = 0;
  let squaredRgb = 0;
  let maximumChannelDifference = 0;
  let absoluteLuma = 0;
  let maximumAbsoluteLumaDifference = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    pixelCount += 1;
    const offset = pixel * 4;
    let pixelMaximum = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const difference = Math.abs(baseline[offset + channel]! - capped[offset + channel]!);
      absoluteRgb += difference;
      squaredRgb += difference * difference;
      pixelMaximum = Math.max(pixelMaximum, difference);
      maximumChannelDifference = Math.max(maximumChannelDifference, difference);
    }
    if (pixelMaximum > changedPixelThresholdLinear) changedPixelCount += 1;
    const lumaDifference = absoluteLinearLumaDifference(baseline, capped, offset);
    absoluteLuma += lumaDifference;
    maximumAbsoluteLumaDifference = Math.max(maximumAbsoluteLumaDifference, lumaDifference);
  }
  const rgbChannels = pixelCount * 3;
  return {
    pixelCount,
    changedPixelCount,
    changedPixelThresholdLinear,
    rgbMeanAbsoluteError: rgbChannels ? absoluteRgb / rgbChannels : null,
    rgbRootMeanSquareError: rgbChannels ? Math.sqrt(squaredRgb / rgbChannels) : null,
    maximumChannelDifference: pixelCount ? maximumChannelDifference : null,
    meanAbsoluteLumaDifference: pixelCount ? absoluteLuma / pixelCount : null,
    maximumAbsoluteLumaDifference: pixelCount ? maximumAbsoluteLumaDifference : null,
  };
};

export const countFallbackSourceColorMismatches = (
  source: Float32Array,
  candidate: Float32Array,
  fallbackMask: Uint8Array,
  tolerance = 0.002,
): number => {
  if (source.length !== candidate.length || source.length !== fallbackMask.length * 4) {
    throw new RangeError("Fallback comparison buffers do not match");
  }
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new RangeError("Fallback comparison tolerance must be finite and non-negative");
  let mismatches = 0;
  for (let pixel = 0; pixel < fallbackMask.length; pixel += 1) {
    if (!fallbackMask[pixel]) continue;
    const offset = pixel * 4;
    const maxRgbError = Math.max(
      Math.abs((source[offset] ?? 0) - (candidate[offset] ?? 0)),
      Math.abs((source[offset + 1] ?? 0) - (candidate[offset + 1] ?? 0)),
      Math.abs((source[offset + 2] ?? 0) - (candidate[offset + 2] ?? 0)),
    );
    if (maxRgbError > tolerance) mismatches += 1;
  }
  return mismatches;
};

export const depthBoundaryDistances = (validity: Uint8Array, depthMm: Float32Array, width: number, height: number) => {
  const size = width * height;
  if (validity.length !== size || depthMm.length !== size) throw new RangeError("Depth boundary inputs do not match source dimensions");
  const maxDistance = width + height + 1;
  const distances = new Uint16Array(size);
  distances.fill(maxDistance);
  let boundaryPixels = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (validity[index] !== 1) continue;
      const depth = depthMm[index] ?? 0;
      const neighbors = [[x + 1, y], [x, y + 1]] as const;
      for (const [nx, ny] of neighbors) {
        if (nx >= width || ny >= height) continue;
        const neighbor = ny * width + nx;
        if (validity[neighbor] === 1 && Math.abs(depth - (depthMm[neighbor] ?? 0)) >= 1) {
          if (distances[index] !== 0) boundaryPixels += 1;
          if (distances[index] !== 0) distances[index] = 0;
          if (distances[neighbor] !== 0) boundaryPixels += 1;
          distances[neighbor] = 0;
        }
      }
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (validity[index] !== 1 || distances[index] === 0) continue;
      const left = x > 0 ? distances[index - 1]! + 1 : maxDistance;
      const up = y > 0 ? distances[index - width]! + 1 : maxDistance;
      distances[index] = Math.min(distances[index]!, left, up);
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      if (validity[index] !== 1 || distances[index] === 0) continue;
      const right = x + 1 < width ? distances[index + 1]! + 1 : maxDistance;
      const down = y + 1 < height ? distances[index + width]! + 1 : maxDistance;
      distances[index] = Math.min(distances[index]!, right, down);
    }
  }
  return { distances, boundaryPixels };
};

const lumaDifference = absoluteLinearLumaDifference;

const spatialBlurMoment = (source: Float32Array, output: Float32Array, mask: Uint8Array, width: number) => {
  let energy = 0;
  let weightedX = 0;
  let weightedY = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const weight = lumaDifference(source, output, pixel * 4);
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    energy += weight;
    weightedX += x * weight;
    weightedY += y * weight;
  }
  if (energy <= 1e-12) return { signalEnergy: energy, centroidPx: null, covariancePx2: null, rmsSpreadPx: null };
  const cx = weightedX / energy;
  const cy = weightedY / energy;
  let xx = 0;
  let yy = 0;
  let xy = 0;
  for (let pixel = 0; pixel < mask.length; pixel += 1) {
    if (!mask[pixel]) continue;
    const weight = lumaDifference(source, output, pixel * 4);
    const dx = pixel % width - cx;
    const dy = Math.floor(pixel / width) - cy;
    xx += dx * dx * weight;
    yy += dy * dy * weight;
    xy += dx * dy * weight;
  }
  xx /= energy;
  yy /= energy;
  xy /= energy;
  return { signalEnergy: energy, centroidPx: [cx, cy], covariancePx2: [xx, xy, xy, yy], rmsSpreadPx: Math.sqrt(xx + yy) };
};

/** Independent, readback-based far-layer and edge/fallback quality measurements. */
export const measureLargeCocFarQuality = (input: {
  width: number;
  height: number;
  referenceIdentity: string;
  sourceRgba: Float32Array;
  referenceRgba: Float32Array;
  candidateRgba: Float32Array;
  signedCocMm: Float32Array;
  validity: Uint8Array;
  depthMm: Float32Array;
  sourceFallbackMask: Uint8Array;
  fallbackSignalThreshold?: number;
}) => {
  if (!Number.isInteger(input.width) || input.width <= 0 || !Number.isInteger(input.height) || input.height <= 0) {
    throw new RangeError("Quality raster dimensions must be positive integers");
  }
  if (!input.referenceIdentity) throw new RangeError("A matched full-resolution reference identity is required");
  const size = input.width * input.height;
  for (const [name, data, expected] of [
    ["source", input.sourceRgba, size * 4],
    ["reference", input.referenceRgba, size * 4],
    ["candidate", input.candidateRgba, size * 4],
    ["CoC", input.signedCocMm, size],
    ["validity", input.validity, size],
    ["depth", input.depthMm, size],
    ["fallback", input.sourceFallbackMask, size],
  ] as const) {
    if (data.length !== expected) throw new RangeError(`${name} raster length does not match dimensions`);
  }
  assertFiniteRaster("source color", input.sourceRgba);
  assertFiniteRaster("reference color", input.referenceRgba);
  assertFiniteRaster("candidate color", input.candidateRgba);
  assertFiniteRaster("signed CoC", input.signedCocMm);
  assertFiniteRaster("depth", input.depthMm);
  const farMask = new Uint8Array(size);
  let farPixels = 0;
  for (let pixel = 0; pixel < size; pixel += 1) {
    if (input.validity[pixel] === 1 && input.signedCocMm[pixel]! > 0.00001) {
      farMask[pixel] = 1;
      farPixels += 1;
    }
  }
  const rgb = rgbMetrics(input.referenceRgba, input.candidateRgba, new Uint8Array(size).fill(1));
  const farRgb = rgbMetrics(input.referenceRgba, input.candidateRgba, farMask);
  const fullFrameLuma = absoluteLinearLumaMetrics(input.referenceRgba, input.candidateRgba, new Uint8Array(size).fill(1));
  const validFarLuma = absoluteLinearLumaMetrics(input.referenceRgba, input.candidateRgba, farMask);
  const referenceBlur = spatialBlurMoment(input.sourceRgba, input.referenceRgba, farMask, input.width);
  const candidateBlur = spatialBlurMoment(input.sourceRgba, input.candidateRgba, farMask, input.width);
  const { distances, boundaryPixels } = depthBoundaryDistances(input.validity, input.depthMm, input.width, input.height);
  const fallbackWithinBoundaryBands = { "0-1px": 0, "2-4px": 0, "5-8px": 0, "9px+": 0 };
  const depthEdgeMask = new Uint8Array(size);
  const validFarDepthEdgeMask = new Uint8Array(size);
  let depthEdgePixelCount = 0;
  let validFarDepthEdgePixelCount = 0;
  for (let pixel = 0; pixel < size; pixel += 1) {
    if (input.validity[pixel] === 1 && distances[pixel]! <= 1) {
      depthEdgeMask[pixel] = 1;
      depthEdgePixelCount += 1;
      if (farMask[pixel]) {
        validFarDepthEdgeMask[pixel] = 1;
        validFarDepthEdgePixelCount += 1;
      }
    }
  }
  const depthEdgeRgb = rgbMetrics(input.referenceRgba, input.candidateRgba, depthEdgeMask);
  const validFarDepthEdgeRgb = rgbMetrics(input.referenceRgba, input.candidateRgba, validFarDepthEdgeMask);
  const depthEdgeLuma = absoluteLinearLumaMetrics(input.referenceRgba, input.candidateRgba, depthEdgeMask);
  const validFarDepthEdgeLuma = absoluteLinearLumaMetrics(input.referenceRgba, input.candidateRgba, validFarDepthEdgeMask);
  let fallbackFarPixels = 0;
  let farBackgroundSharpFallbackPixelCount = 0;
  let farBlurSuppressionEnergy = 0;
  let farBoundaryContaminationEnergy = 0;
  let farHaloWidthPx = 0;
  let farFallbackBeyondBoundaryPx = 0;
  let maximumLocalizedRgbError = 0;
  let fallbackBounds: null | { left: number; top: number; right: number; bottom: number } = null;
  const threshold = input.fallbackSignalThreshold ?? 0.01;
  for (let pixel = 0; pixel < size; pixel += 1) {
    if (!farMask[pixel] || !input.sourceFallbackMask[pixel]) continue;
    fallbackFarPixels += 1;
    const distance = distances[pixel]!;
    if (distance <= 1) fallbackWithinBoundaryBands["0-1px"] += 1;
    else if (distance <= 4) fallbackWithinBoundaryBands["2-4px"] += 1;
    else if (distance <= 8) fallbackWithinBoundaryBands["5-8px"] += 1;
    else fallbackWithinBoundaryBands["9px+"] += 1;
    const offset = pixel * 4;
    const expectedBlur = lumaDifference(input.referenceRgba, input.sourceRgba, offset);
    const candidateBlur = lumaDifference(input.candidateRgba, input.sourceRgba, offset);
    const discrepancy = lumaDifference(input.candidateRgba, input.referenceRgba, offset);
    const pixelError = Math.max(
      Math.abs((input.candidateRgba[offset] ?? 0) - (input.referenceRgba[offset] ?? 0)),
      Math.abs((input.candidateRgba[offset + 1] ?? 0) - (input.referenceRgba[offset + 1] ?? 0)),
      Math.abs((input.candidateRgba[offset + 2] ?? 0) - (input.referenceRgba[offset + 2] ?? 0)),
    );
    maximumLocalizedRgbError = Math.max(maximumLocalizedRgbError, pixelError);
    const x = pixel % input.width;
    const y = Math.floor(pixel / input.width);
    fallbackBounds = fallbackBounds
      ? { left: Math.min(fallbackBounds.left, x), top: Math.min(fallbackBounds.top, y), right: Math.max(fallbackBounds.right, x), bottom: Math.max(fallbackBounds.bottom, y) }
      : { left: x, top: y, right: x, bottom: y };
    farBlurSuppressionEnergy += Math.max(0, expectedBlur - candidateBlur);
    if (distance <= 4) farBoundaryContaminationEnergy += discrepancy;
    if (expectedBlur >= threshold) {
      farHaloWidthPx = Math.max(farHaloWidthPx, distance);
      if (candidateBlur < threshold) farBackgroundSharpFallbackPixelCount += 1;
      if (distance > 8) farFallbackBeyondBoundaryPx += 1;
    }
  }
  return {
    referenceIdentity: input.referenceIdentity,
    validFarPixelCount: farPixels,
    fullFrameRgbError: rgb,
    validFarRgbError: farRgb,
    fullFrameAbsoluteLumaError: fullFrameLuma,
    validFarAbsoluteLumaError: validFarLuma,
    depthBoundaryPixelCount: boundaryPixels,
    depthEdgeRgbError: depthEdgeRgb,
    depthEdgeAbsoluteLumaError: depthEdgeLuma,
    depthEdgePixelCount,
    validFarDepthEdgeRgbError: validFarDepthEdgeRgb,
    validFarDepthEdgeAbsoluteLumaError: validFarDepthEdgeLuma,
    validFarDepthEdgePixelCount,
    roiDefinitions: {
      fullFrame: "All source-grid pixels.",
      validFar: "Validity code 1 and signed physical CoC greater than 0.00001 mm.",
      depthEdge: "Validity code 1 and four-connected Manhattan distance at most 1 px from a detected >=1 mm adjacent depth discontinuity.",
      validFarDepthEdge: "The validFar mask intersected with the depthEdge mask.",
    },
    sourceFallbackFarPixelCount: fallbackFarPixels,
    sourceFallbackBounds: fallbackBounds,
    sourceFallbackNearDepthBoundary: fallbackWithinBoundaryBands,
    farBackgroundSharpFallbackPixelCount,
    farHaloWidthPx,
    farFallbackBeyondBoundaryPx,
    maximumLocalizedRgbError,
    farBlurSuppressionEnergy,
    farBoundaryContaminationEnergy,
    blurSpread: {
      definition: "Signal-weighted spatial covariance of absolute luma change from sharp source to far output, over valid positive-CoC pixels; this is a comparative image-space spread proxy, not an optical PSF estimate.",
      fullReference: referenceBlur,
      candidate: candidateBlur,
      candidateToReferenceSignalEnergyRatio: referenceBlur.signalEnergy > 1e-12
        ? candidateBlur.signalEnergy / referenceBlur.signalEnergy
        : null,
    },
  };
};

type B1QualityEvidence = Readonly<{
  variant: string;
  opticalStateFingerprint: unknown;
  physicalFingerprint: unknown;
  inputFingerprints: unknown;
  appliedState: unknown;
  quality: unknown;
}>;

const asRecord = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};

const requireString = (value: unknown, label: string): string => {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} is missing`);
  return value;
};

/** Enforce the three fixed Phase K B1-vs-B0 quality claims against one Full ×32 reference. */
export const assertB1LargeCocReferenceAdvantage = (input: {
  caseId: string;
  reference: B1QualityEvidence;
  b0: B1QualityEvidence;
  b1: B1QualityEvidence;
}) => {
  const { caseId, reference, b0, b1 } = input;
  if (reference.variant !== "Full32") throw new Error(`${caseId}: quality comparison requires the matched Full ×32 reference`);
  if (b0.variant !== "B0" || b1.variant !== "B1") {
    throw new Error(`${caseId}: expected B0/B1 candidates, received ${b0.variant}/${b1.variant}`);
  }
  const referenceFingerprint = requireString(reference.opticalStateFingerprint, `${caseId}: Full ×32 optical fingerprint`);
  const physicalFingerprint = requireString(reference.physicalFingerprint, `${caseId}: Full ×32 physical fingerprint`);
  const referenceQuality = asRecord(reference.quality);
  const referenceId = requireString(referenceQuality.referenceIdentity, `${caseId}: Full ×32 reference identity`);
  const expectedInputFingerprints = asRecord(reference.inputFingerprints);
  const fingerprintKeys = ["sourceColor", "worldPositionAndDepth", "validity", "physical"] as const;
  for (const key of fingerprintKeys) requireString(expectedInputFingerprints[key], `${caseId}: Full ×32 ${key} fingerprint`);

  const b0Quality = asRecord(b0.quality);
  const b1Quality = asRecord(b1.quality);
  const referenceApplied = asRecord(reference.appliedState);
  const b0Applied = asRecord(b0.appliedState);
  const b1Applied = asRecord(b1.appliedState);
  const sharedAppliedStateKeys = [
    "scene", "filmTiltDeg", "filmNormal", "filmBasisX", "filmBasisY", "crop", "sampledFilmWidthMm",
    "sampledFilmHeightMm", "focusOffsetMm", "apertureFNumber", "sourceWidthPx", "sourceHeightPx",
    "sampleCount", "maximumCoCRadiusPx",
  ] as const;
  for (const key of sharedAppliedStateKeys) {
    if (referenceApplied[key] === undefined || b0Applied[key] === undefined || b1Applied[key] === undefined) {
      throw new Error(`${caseId}: applied optical state is missing ${key}`);
    }
    if (JSON.stringify(referenceApplied[key]) !== JSON.stringify(b0Applied[key])
      || JSON.stringify(referenceApplied[key]) !== JSON.stringify(b1Applied[key])) {
      throw new Error(`${caseId}: Full ×32, B0 and B1 applied state differs at ${key}`);
    }
  }
  for (const [label, candidate] of [["B0", b0], ["B1", b1]] as const) {
    if (candidate.opticalStateFingerprint !== referenceFingerprint) {
      throw new Error(`${caseId}: ${label} optical state does not match the Full ×32 reference`);
    }
    if (candidate.physicalFingerprint !== physicalFingerprint) {
      throw new Error(`${caseId}: ${label} physical CoC/footprint input does not match the Full ×32 reference`);
    }
    const candidateFingerprints = asRecord(candidate.inputFingerprints);
    for (const key of fingerprintKeys) {
      if (candidateFingerprints[key] !== expectedInputFingerprints[key]) {
        throw new Error(`${caseId}: ${label} ${key} input does not match the Full ×32 reference`);
      }
    }
    const candidateQuality = asRecord(candidate.quality);
    if (candidateQuality.referenceIdentity !== referenceId) {
      throw new Error(`${caseId}: ${label} used a different Full ×32 reference`);
    }
  }

  for (const key of [
    ...sharedAppliedStateKeys, "farGatherWidthPx", "farGatherHeightPx", "gatherScale",
  ]) {
    if (b0Applied[key] === undefined || b1Applied[key] === undefined) {
      throw new Error(`${caseId}: candidate applied state is missing ${key}`);
    }
    if (JSON.stringify(b0Applied[key]) !== JSON.stringify(b1Applied[key])) {
      throw new Error(`${caseId}: B0 and B1 applied state differs at ${key}`);
    }
  }

  const roiDefinitions = JSON.stringify(asRecord(referenceQuality.roiDefinitions));
  if (!roiDefinitions || roiDefinitions !== JSON.stringify(asRecord(b0Quality.roiDefinitions))
    || roiDefinitions !== JSON.stringify(asRecord(b1Quality.roiDefinitions))) {
    throw new Error(`${caseId}: Full ×32/B0/B1 ROI definitions do not match`);
  }
  const metrics = [
    ["full-frame RGB RMSE", "fullFrameRgbError"],
    ["valid-far RGB RMSE", "validFarRgbError"],
    ["valid-far depth-edge RGB RMSE", "validFarDepthEdgeRgbError"],
  ] as const;
  const results: Record<string, { b0Rmse: number; b1Rmse: number; pixelCount: number }> = {};
  for (const [label, key] of metrics) {
    const referenceMetric = asRecord(referenceQuality[key]);
    const b0Metric = asRecord(b0Quality[key]);
    const b1Metric = asRecord(b1Quality[key]);
    const referenceCount = referenceMetric.pixelCount;
    const b0Count = b0Metric.pixelCount;
    const b1Count = b1Metric.pixelCount;
    if (!Number.isInteger(referenceCount) || !Number.isInteger(b0Count) || !Number.isInteger(b1Count)
      || (referenceCount as number) <= 0 || b0Count !== referenceCount || b1Count !== referenceCount) {
      throw new Error(`${caseId}: ${label} requires the same nonempty ROI population for Full ×32, B0, and B1`);
    }
    const b0Rmse = b0Metric.rgbRootMeanSquareError;
    const b1Rmse = b1Metric.rgbRootMeanSquareError;
    if (typeof b0Rmse !== "number" || !Number.isFinite(b0Rmse) || typeof b1Rmse !== "number" || !Number.isFinite(b1Rmse)) {
      throw new Error(`${caseId}: ${label} is missing a finite B0 or B1 RMSE`);
    }
    if (!(b1Rmse < b0Rmse)) {
      throw new Error(`${caseId}: B1 ${label} ${b1Rmse} must be lower than B0 ${b0Rmse} (pixels=${referenceCount})`);
    }
    results[key] = { b0Rmse, b1Rmse, pixelCount: referenceCount as number };
  }
  return { caseId, referenceIdentity: referenceId, metrics: results };
};

export const PHASE_K_LARGE_COC_STATE = {
  opticalCaseId: "macro-focus-middle-f5_6" as const,
  apertureFNumber: 5.6 as const,
  focusDistanceMm: 400,
  cropMagnification: 16,
  sourceWidthPx: 512,
  sourceHeightPx: 384,
  sampleCount: 32,
} as const;

export const largestBinaryComponent = (mask: Uint8Array, width: number, height: number) => {
  if (mask.length !== width * height) throw new RangeError("Component mask dimensions do not match");
  const visited = new Uint8Array(mask.length);
  let largest = { pixelCount: 0, bounds: null as null | { left: number; top: number; right: number; bottom: number } };
  for (let start = 0; start < mask.length; start += 1) {
    if (!mask[start] || visited[start]) continue;
    const queue = [start];
    visited[start] = 1;
    let head = 0;
    let count = 0;
    let left = width;
    let top = height;
    let right = -1;
    let bottom = -1;
    while (head < queue.length) {
      const pixel = queue[head++]!;
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      count += 1;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const next = ny * width + nx;
        if (!mask[next] || visited[next]) continue;
        visited[next] = 1;
        queue.push(next);
      }
    }
    if (count > largest.pixelCount) largest = { pixelCount: count, bounds: { left, top, right, bottom } };
  }
  return largest;
};
