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
    a: { x: number; y: number; depthMm: number; signedCoCMm: number; sourceRgb: [number, number, number] };
    b: { x: number; y: number; depthMm: number; signedCoCMm: number; sourceRgb: [number, number, number] };
    depthDeltaMm: number;
    sourceContrastRgb: number;
    farSideCapPixel: boolean;
  }> = [];
  let highContrastFarDepthEdgePairCount = 0;
  let cappedDepthEdgePairCount = 0;
  let farDepthEdgePairCount = 0;
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
        const hasCappedPixel = Boolean(capped[pixel] || capped[neighbor]);
        if (hasCappedPixel) cappedDepthEdgePairCount += 1;
        if (farSideCapPixel) farDepthEdgePairCount += 1;
        const offset = pixel * 4;
        const otherOffset = neighbor * 4;
        const sourceRgb: [number, number, number] = [0, 1, 2].map((channel) => input.sourceRgba[offset + channel] ?? 0) as [number, number, number];
        const otherRgb: [number, number, number] = [0, 1, 2].map((channel) => input.sourceRgba[otherOffset + channel] ?? 0) as [number, number, number];
        const sourceContrastRgb = Math.hypot(...sourceRgb.map((value, channel) => value - otherRgb[channel]!));
        if (farSideCapPixel && sourceContrastRgb > PHASE_L_INTERIOR_TARGETS.minimumSourceContrastRgb) highContrastFarDepthEdgePairCount += 1;
        if (farSideCapPixel && edgePairs.length < 256) {
          edgePairs.push({
            a: { x, y, depthMm: depthMm[pixel]!, signedCoCMm: input.physicalRgba[offset] ?? 0, sourceRgb },
            b: { x: nx, y: ny, depthMm: depthMm[neighbor]!, signedCoCMm: input.physicalRgba[otherOffset] ?? 0, sourceRgb: otherRgb },
            depthDeltaMm: delta,
            sourceContrastRgb,
            farSideCapPixel,
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
      highContrastFarDepthEdgePairs: highContrastFarDepthEdgePairCount,
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
      && highContrastFarDepthEdgePairCount >= PHASE_L_INTERIOR_TARGETS.minimumHighContrastFarDepthEdgePairs,
    selectionPolicy: "Geometry/physical readback only; no B0/B1 reference error or candidate output metric used.",
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
