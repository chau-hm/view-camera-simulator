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

const depthBoundaryDistances = (validity: Uint8Array, depthMm: Float32Array, width: number, height: number) => {
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

const lumaDifference = (left: Float32Array, right: Float32Array, offset: number) =>
  Math.abs((left[offset] ?? 0) - (right[offset] ?? 0)) * 0.2126
  + Math.abs((left[offset + 1] ?? 0) - (right[offset + 1] ?? 0)) * 0.7152
  + Math.abs((left[offset + 2] ?? 0) - (right[offset + 2] ?? 0)) * 0.0722;

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
  sourceRgba: Float32Array;
  referenceRgba: Float32Array;
  candidateRgba: Float32Array;
  signedCocMm: Float32Array;
  validity: Uint8Array;
  depthMm: Float32Array;
  sourceFallbackMask: Uint8Array;
  fallbackSignalThreshold?: number;
}) => {
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
  const referenceBlur = spatialBlurMoment(input.sourceRgba, input.referenceRgba, farMask, input.width);
  const candidateBlur = spatialBlurMoment(input.sourceRgba, input.candidateRgba, farMask, input.width);
  const { distances, boundaryPixels } = depthBoundaryDistances(input.validity, input.depthMm, input.width, input.height);
  const fallbackWithinBoundaryBands = { "0-1px": 0, "2-4px": 0, "5-8px": 0, "9px+": 0 };
  const edgeMask = new Uint8Array(size);
  let edgePixelCount = 0;
  for (let pixel = 0; pixel < size; pixel += 1) {
    if (input.validity[pixel] === 1 && distances[pixel]! <= 1) {
      edgeMask[pixel] = 1;
      edgePixelCount += 1;
    }
  }
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
    validFarPixelCount: farPixels,
    fullFrameRgbError: rgb,
    validFarRgbError: farRgb,
    depthBoundaryPixelCount: boundaryPixels,
    validFarEdgeRgbError: rgbMetrics(input.referenceRgba, input.candidateRgba, edgeMask),
    validFarEdgePixelCount: edgePixelCount,
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
