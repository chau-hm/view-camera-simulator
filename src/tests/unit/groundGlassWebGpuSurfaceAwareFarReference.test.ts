import { describe, expect, it } from "vitest";
import {
  auditCompatibleFarNeighbors,
  compareRadialEnergyProfiles,
  compareRgbaOnMask,
  measureFarSignalMetrics,
  phaseIFarDepthToleranceMm,
  phaseISpatialWeight,
  reconstructSurfaceAwareFar,
  type SurfaceAwareFarInput,
} from "../e2e/fixtures/ground-glass-webgpu-far-reconstruction-cases";

const source = { widthPx: 6, heightPx: 4 };
const gather = { widthPx: 3, heightPx: 2 };

const makeInput = (): SurfaceAwareFarInput => {
  const sourcePixels = source.widthPx * source.heightPx;
  const gatherPixels = gather.widthPx * gather.heightPx;
  const colors = new Float32Array(sourcePixels * 4);
  const physical = new Float32Array(sourcePixels * 4);
  const validity = new Uint8Array(sourcePixels).fill(1);
  const worldAndDepth = new Float32Array(sourcePixels * 4);
  const gatherFar = new Float32Array(gatherPixels * 4);
  const selectedGatherPixels = new Uint16Array(sourcePixels * 2);
  const centerSourcePixels = new Int16Array(gatherPixels * 2);
  for (let index = 0; index < sourcePixels; index += 1) {
    colors.set([0.02, 0.08, 0.85, 1], index * 4);
    physical.set([1, 0.4, 0.2, 0.25], index * 4);
    worldAndDepth.set([0, 0, 500, 0.5], index * 4);
    const x = index % source.widthPx;
    const y = Math.floor(index / source.widthPx);
    const gx = Math.min(gather.widthPx - 1, Math.floor((x + 0.5) * gather.widthPx / source.widthPx));
    const gy = Math.min(gather.heightPx - 1, Math.floor((y + 0.5) * gather.heightPx / source.heightPx));
    selectedGatherPixels[index * 2] = gx;
    selectedGatherPixels[index * 2 + 1] = gy;
  }
  for (let gy = 0; gy < gather.heightPx; gy += 1) {
    for (let gx = 0; gx < gather.widthPx; gx += 1) {
      const gatherIndex = gy * gather.widthPx + gx;
      const x = Math.min(source.widthPx - 1, Math.floor((gx + 0.5) * source.widthPx / gather.widthPx));
      const y = Math.min(source.heightPx - 1, Math.floor((gy + 0.5) * source.heightPx / gather.heightPx));
      centerSourcePixels[gatherIndex * 2] = x;
      centerSourcePixels[gatherIndex * 2 + 1] = y;
      gatherFar.set([gx + 1, gy + 1, 0.25, 1], gatherIndex * 4);
    }
  }
  // Destination (2,1) selects gather texel (1,0); classify that center as near.
  physical.set([-1, 0.4, 0.2, 0.25], (1 * source.widthPx + 3) * 4);
  return {
    source,
    gather,
    gatherFar,
    colors,
    physical,
    validity,
    worldAndDepth,
    selectedGatherPixels,
    centerSourcePixels,
    cameraZMm: 0,
    depthTolerance: phaseIFarDepthToleranceMm,
    spatialWeight: phaseISpatialWeight,
  };
};

const setCenterState = (
  input: SurfaceAwareFarInput,
  gatherX: number,
  gatherY: number,
  state: { coc?: number; validity?: number; distanceMm?: number },
) => {
  const centerIndex = (gatherY * gather.widthPx + gatherX) * 2;
  const x = input.centerSourcePixels![centerIndex]!;
  const y = input.centerSourcePixels![centerIndex + 1]!;
  const sourceIndex = y * source.widthPx + x;
  const offset = sourceIndex * 4;
  if (state.coc !== undefined) input.physical.set([state.coc, 0.4, 0.2, 0.25], offset);
  if (state.validity !== undefined) input.validity[sourceIndex] = state.validity;
  if (state.distanceMm !== undefined) input.worldAndDepth[offset + 2] = state.distanceMm;
};

describe("Ground Glass WebGPU surface-aware far reconstruction oracle", () => {
  it("uses one compatible neighbor and records the actual selected gather coordinates", () => {
    const input = makeInput();
    // Keep the selected center near and every neighbor invalid except the right neighbor.
    for (let gy = 0; gy < gather.heightPx; gy += 1) {
      for (let gx = 0; gx < gather.widthPx; gx += 1) {
        if (gx !== 1 || gy !== 0) setCenterState(input, gx, gy, { validity: 4 });
      }
    }
    setCenterState(input, 1, 0, { coc: -1 });
    setCenterState(input, 2, 0, { coc: 1, validity: 1 });
    const result = reconstructSurfaceAwareFar(input);
    const destination = 1 * source.widthPx + 2;
    expect(result.selectedGatherPixels.slice(destination * 2, destination * 2 + 2)).toEqual(new Uint16Array([1, 0]));
    expect(result.acceptedNeighborCount[destination]).toBe(1);
    expect(result.acceptedWeightSum[destination]).toBe(0.5);
    expect(result.fallbackReason[destination]).toBe(0);
    expect([...result.rgba.slice(destination * 4, destination * 4 + 3)]).toEqual([3, 1, 0.25]);
    expect(result.neighborRecords[destination]?.find((neighbor) => neighbor.gatherPixel[0] === 2)).toMatchObject({ accepted: true });
  });

  it("uses observed half-resolution texel-center identities instead of rebuilding a nominal center", () => {
    const input = makeInput();
    for (let gy = 0; gy < gather.heightPx; gy += 1) {
      for (let gx = 0; gx < gather.widthPx; gx += 1) setCenterState(input, gx, gy, { validity: 4 });
    }
    setCenterState(input, 1, 0, { coc: -1 });
    const shiftedCenterIndex = (0 * gather.widthPx + 2) * 2;
    input.centerSourcePixels![shiftedCenterIndex] = 4;
    input.centerSourcePixels![shiftedCenterIndex + 1] = 0;
    setCenterState(input, 2, 0, { coc: 1, validity: 1 });
    // The nominal source center (5,0) is unresolved; the observed GPU identity is (4,0).
    input.validity[0 * source.widthPx + 5] = 4;
    const result = reconstructSurfaceAwareFar(input);
    const destination = 1 * source.widthPx + 2;
    const observedNeighbor = result.neighborRecords[destination]?.find((neighbor) => neighbor.gatherPixel[0] === 2 && neighbor.gatherPixel[1] === 0);
    expect(observedNeighbor).toMatchObject({ centerSourcePixel: [4, 0], validityCode: 1, accepted: true });
    expect(result.acceptedNeighborCount[destination]).toBe(1);
    expect(result.acceptedWeightSum[destination]).toBe(0.5);
  });

  it("uses the provided non-centered gather mapping for an already-cropped source window", () => {
    const input = makeInput();
    const destination = 2 * source.widthPx + 4;
    input.selectedGatherPixels!.set([2, 1], destination * 2);
    for (let gy = 0; gy < gather.heightPx; gy += 1) {
      for (let gx = 0; gx < gather.widthPx; gx += 1) setCenterState(input, gx, gy, { validity: 4 });
    }
    setCenterState(input, 2, 1, { coc: -1 });
    setCenterState(input, 1, 0, { coc: 1, validity: 1 });
    const result = reconstructSurfaceAwareFar(input);
    expect(result.selectedGatherPixels.slice(destination * 2, destination * 2 + 2)).toEqual(new Uint16Array([2, 1]));
    expect(result.neighborRecords[destination]?.find((neighbor) => neighbor.gatherPixel[0] === 1 && neighbor.gatherPixel[1] === 0))
      .toMatchObject({ accepted: true, spatialWeight: 1 / 3 });
    expect(result.acceptedNeighborCount[destination]).toBe(1);
  });

  it("keeps the far reconstruction independent of the already-derived non-circular footprint axes", () => {
    const input = makeInput();
    const destination = 1 * source.widthPx + 2;
    const changedAxes = {
      ...input,
      physical: input.physical.slice(),
    };
    for (let index = 0; index < source.widthPx * source.heightPx; index += 1) {
      changedAxes.physical.set([
        input.physical[index * 4] ?? 0,
        1.7,
        0.08,
        0.91,
      ], index * 4);
    }
    const original = reconstructSurfaceAwareFar(input);
    const changed = reconstructSurfaceAwareFar(changedAxes);
    expect(changed.rgba.slice(destination * 4, destination * 4 + 4))
      .toEqual(original.rgba.slice(destination * 4, destination * 4 + 4));
    expect(changed.acceptedNeighborCount[destination]).toBe(original.acceptedNeighborCount[destination]);
    expect(changed.acceptedWeightSum[destination]).toBe(original.acceptedWeightSum[destination]);
  });

  it("combines several compatible samples but rejects near, invalid, unresolved, and depth-separated centers", () => {
    const input = makeInput();
    setCenterState(input, 1, 0, { coc: -1 });
    setCenterState(input, 0, 0, { validity: 4 });
    setCenterState(input, 2, 0, { distanceMm: 700 });
    setCenterState(input, 1, 1, { coc: 0 });
    const result = reconstructSurfaceAwareFar(input);
    const destination = 1 * source.widthPx + 2;
    expect(result.acceptedNeighborCount[destination]).toBeGreaterThanOrEqual(2);
    expect(result.fallbackReason[destination]).toBe(0);
    expect(result.neighborRecords[destination]?.some((neighbor) => neighbor.validityCode === 4 && !neighbor.accepted)).toBe(true);
    expect(result.neighborRecords[destination]?.some((neighbor) => neighbor.centerDistanceMm === 700 && !neighbor.depthCompatible)).toBe(true);
  });

  it("uses the declared source-color fallback when no compatible neighbor or positive weight exists", () => {
    const input = makeInput();
    for (let gy = 0; gy < gather.heightPx; gy += 1) {
      for (let gx = 0; gx < gather.widthPx; gx += 1) setCenterState(input, gx, gy, { coc: -1 });
    }
    const zeroWeightInput = { ...input, spatialWeight: () => 0 };
    const result = reconstructSurfaceAwareFar(zeroWeightInput);
    const destination = 1 * source.widthPx + 2;
    expect(result.acceptedNeighborCount[destination]).toBe(0);
    expect(result.acceptedWeightSum[destination]).toBe(0);
    expect(result.fallbackReason[destination]).toBe(1);
    expect(result.rgba[destination * 4]).toBeCloseTo(0.02, 6);
    expect(result.rgba[destination * 4 + 1]).toBeCloseTo(0.08, 6);
    expect(result.rgba[destination * 4 + 2]).toBeCloseTo(0.85, 6);
  });

  it("preserves exact full-resolution far output and handles a boundary destination without out-of-range neighbors", () => {
    const input = makeInput();
    const full = {
      ...input,
      gather: source,
      gatherFar: new Float32Array(source.widthPx * source.heightPx * 4),
      centerSourcePixels: new Int16Array(source.widthPx * source.heightPx * 2),
      selectedGatherPixels: new Uint16Array(source.widthPx * source.heightPx * 2),
      fullResolutionPassthrough: true,
    };
    for (let index = 0; index < source.widthPx * source.heightPx; index += 1) {
      full.gatherFar.set([index, index + 1, index + 2, 1], index * 4);
      full.centerSourcePixels[index * 2] = index % source.widthPx;
      full.centerSourcePixels[index * 2 + 1] = Math.floor(index / source.widthPx);
      full.selectedGatherPixels[index * 2] = index % source.widthPx;
      full.selectedGatherPixels[index * 2 + 1] = Math.floor(index / source.widthPx);
    }
    const fullResult = reconstructSurfaceAwareFar(full);
    for (let index = 0; index < source.widthPx * source.heightPx; index += 1) {
      expect(fullResult.rgba.slice(index * 4, index * 4 + 3)).toEqual(full.gatherFar.slice(index * 4, index * 4 + 3));
      expect(fullResult.rgba[index * 4 + 3]).toBe(-2);
    }
    expect([...fullResult.fallbackReason].every((value) => value === 3)).toBe(true);

    const halfResult = reconstructSurfaceAwareFar(input);
    const corner = 0;
    expect(halfResult.neighborRecords[corner]?.every((neighbor) => neighbor.gatherPixel.every((value) => value >= 0))).toBe(true);
    expect(halfResult.neighborRecords[corner]).toHaveLength(4);
  });

  it("audits compatible neighboring far centers independently of final GPU output", () => {
    const input = makeInput();
    setCenterState(input, 1, 0, { coc: -1 });
    const baselineFar = new Float32Array(source.widthPx * source.heightPx * 4);
    const blueRoiMask = new Uint8Array(source.widthPx * source.heightPx);
    const foregroundMask = new Uint8Array(source.widthPx * source.heightPx);
    const leakIndex = 1 * source.widthPx + 2;
    input.colors.set([0.02, 0.08, 0.85, 1], leakIndex * 4);
    baselineFar.set([0.95, 0.015, 0.015, 1], leakIndex * 4);
    blueRoiMask[leakIndex] = 1;
    const audit = auditCompatibleFarNeighbors({ ...input, baselineFar, blueRoiMask, foregroundMask });
    expect(audit.problematicPixelCount).toBe(1);
    expect(audit.currentCenterFarCount).toBe(0);
    expect(audit.compatibleNeighborAtLeastOneCount).toBe(1);
    expect(audit.records[0]?.selectedGatherPixel).toEqual([1, 0]);
  });

  it("reports fixed-ROI signal energy, centroid, spread, radial profile, and masked RGB errors", () => {
    const dimensions = { widthPx: 3, heightPx: 2 };
    const sourceColors = new Float32Array(3 * 2 * 4);
    const farRgba = new Float32Array(3 * 2 * 4);
    const roiMask = new Uint8Array(3 * 2).fill(1);
    for (let index = 0; index < 6; index += 1) {
      sourceColors.set([0, 0, 0, 1], index * 4);
      farRgba.set([0, 0, 0, 1], index * 4);
    }
    farRgba.set([1, 0, 0, 1], 1 * 4);
    farRgba.set([0.5, 0, 0, 1], 4 * 4);
    const metrics = measureFarSignalMetrics({
      source: dimensions,
      sourceColors,
      farRgba,
      roiMask,
      featureCenterPx: [1, 0],
      backgroundRgb: [0, 0, 0],
      signalWeights: [1, 0, 0],
      threshold: 0.1,
      radialBinWidthPx: 1,
      radialBinCount: 4,
    });
    expect(metrics.roiPixelCount).toBe(6);
    expect(metrics.signalEnergy).toBe(1.5);
    expect(metrics.peakSignal).toBe(1);
    expect(metrics.thresholdClassifiedPixelCount).toBe(2);
    expect(metrics.signalWeightedCentroidPx).toEqual([1, 1 / 3]);
    expect(metrics.signalWeightedCovariancePx2?.yy).toBeCloseTo(2 / 9, 6);
    expect(metrics.radialProfile[0]?.signalEnergy).toBe(1);
    const compareMask = new Uint8Array([0, 1, 0, 0, 1, 0]);
    const compare = compareRgbaOnMask(sourceColors, farRgba, compareMask);
    expect(compare.pixelCount).toBe(2);
    expect(compare.meanAbsoluteRgbError).toBeGreaterThan(0);
    expect(compare.rootMeanSquareRgbError).toBeGreaterThan(0);
  });

  it("compares radial energy shape independently from equal total signal energy", () => {
    const dimensions = { widthPx: 4, heightPx: 1 };
    const sourceColors = new Float32Array(4 * 4);
    const roiMask = new Uint8Array(4).fill(1);
    const referenceFar = new Float32Array(4 * 4);
    const candidateFar = new Float32Array(4 * 4);
    referenceFar.set([1, 0, 0, 1], 1 * 4);
    referenceFar.set([1, 0, 0, 1], 3 * 4);
    candidateFar.set([2, 0, 0, 1], 2 * 4);
    const measure = (farRgba: Float32Array) => measureFarSignalMetrics({
      source: dimensions,
      sourceColors,
      farRgba,
      roiMask,
      featureCenterPx: [0, 0],
      backgroundRgb: [0, 0, 0],
      signalWeights: [1, 0, 0],
      threshold: 0,
      radialBinWidthPx: 1,
      radialBinCount: 4,
    });
    const reference = measure(referenceFar);
    const candidate = measure(candidateFar);
    expect(reference.signalEnergy).toBe(candidate.signalEnergy);
    const shape = compareRadialEnergyProfiles(reference, candidate);
    expect(shape.binCount).toBe(4);
    expect(shape.meanAbsoluteEnergyShareError).toBe(0.5);
    expect(shape.rootMeanSquareEnergyShareError).toBeCloseTo(Math.sqrt(0.375), 6);
    expect(compareRadialEnergyProfiles(reference, reference).meanAbsoluteEnergyShareError).toBe(0);
    expect(() => compareRadialEnergyProfiles(reference, measureFarSignalMetrics({
      source: dimensions,
      sourceColors,
      farRgba: candidateFar,
      roiMask,
      featureCenterPx: [1, 0],
      backgroundRgb: [0, 0, 0],
      signalWeights: [1, 0, 0],
      threshold: 0,
      radialBinWidthPx: 1,
      radialBinCount: 4,
    }))).toThrow(/matching centers/);
  });
});
