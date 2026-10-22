import { describe, expect, it } from "vitest";
import * as THREE from "three";
import {
  countFallbackSourceColorMismatches,
  countSourceIdentityMismatches,
  largestBinaryComponent,
  measureLargeCocFarQuality,
  PHASE_K_READBACK_ORIGIN,
  projectWorldPointToPixelCenter,
  readbackRowForTopOriginPixel,
} from "../e2e/fixtures/ground-glass-webgpu-correspondence-large-coc-cases";
import { compareNearTargetRgba } from "../e2e/fixtures/ground-glass-webgpu-far-reconstruction-cases";
import {
  clampPixelEllipse,
  mapPhysicalEllipseToSourcePixels,
  maximumPixelEllipseRadius,
} from "../e2e/fixtures/ground-glass-webgpu-aperture-gather-cases";

describe("Phase K native correspondence and large-CoC diagnostics", () => {
  it("uses the GPU-calibrated top-origin readback policy and rejects a vertical flip", () => {
    const width = 5;
    const height = 4;
    const raw = new Float32Array(width * height * 4);
    for (let topY = 0; topY < height; topY += 1) {
      const readbackY = readbackRowForTopOriginPixel(topY, height, PHASE_K_READBACK_ORIGIN);
      for (let x = 0; x < width; x += 1) {
        const offset = (readbackY * width + x) * 4;
        raw[offset] = x;
        raw[offset + 1] = topY;
      }
    }
    expect(PHASE_K_READBACK_ORIGIN).toBe("top");
    expect(countSourceIdentityMismatches(raw, width, height, "top")).toBe(0);
    expect(countSourceIdentityMismatches(raw, width, height, "bottom")).toBe(width * height);
  });

  it("records projected continuous coordinates separately from the selected pixel center", () => {
    const camera = new THREE.PerspectiveCamera(90, 2, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const center = projectWorldPointToPixelCenter({
      worldPointM: [0, 0, -10],
      worldMatrixElements: camera.matrixWorld.toArray(),
      projectionMatrixElements: camera.projectionMatrix.toArray(),
      width: 100,
      height: 50,
    });
    expect(center.continuousPixelTopOrigin).toEqual([50, 25]);
    expect(center.pixelTopOrigin).toEqual([50, 25]);
    expect(center.pixelCenterTopOrigin).toEqual([50.5, 25.5]);
    expect(center.inBounds).toBe(true);
  });

  it("detects projection-matrix drift and millimetre/metre confusion", () => {
    const camera = new THREE.PerspectiveCamera(90, 2, 0.1, 100);
    camera.position.set(0, 0, 0);
    camera.lookAt(0, 0, -1);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const project = (worldPointM: readonly [number, number, number], projection = camera.projectionMatrix) =>
      projectWorldPointToPixelCenter({
        worldPointM,
        worldMatrixElements: camera.matrixWorld.toArray(),
        projectionMatrixElements: projection.toArray(),
        width: 100,
        height: 50,
      });
    const expected = project([0, 0, -10]);
    expect(expected.pixelTopOrigin).toEqual([50, 25]);

    const shiftedProjection = camera.projectionMatrix.clone();
    shiftedProjection.elements[8] = 0.25;
    expect(project([0, 0, -10], shiftedProjection).pixelTopOrigin[0]).not.toBe(expected.pixelTopOrigin[0]);
    expect(project([0, 0, -10]).cameraSpaceM[2]).toBe(-10);
    const millimetresPassedAsMetres = project([0, 0, -10_000]);
    expect(millimetresPassedAsMetres.cameraSpaceM[2]).toBe(-10_000);
    expect(millimetresPassedAsMetres.ndc[2]).toBeGreaterThan(1);
  });

  it("preserves sampled-film millimetre-to-pixel scaling and enforces the effective radius cap", () => {
    const fullFilm = mapPhysicalEllipseToSourcePixels(1, 0.5, 0, { widthMm: 36, heightMm: 24 }, { widthPx: 512, heightPx: 384 });
    const fourTimesCroppedFilm = mapPhysicalEllipseToSourcePixels(1, 0.5, 0, { widthMm: 9, heightMm: 6 }, { widthPx: 512, heightPx: 384 });
    expect(fullFilm.major[0]).toBeCloseTo(512 / 36, 10);
    expect(fullFilm.minor[1]).toBeCloseTo(-0.5 * 384 / 24, 10);
    expect(fourTimesCroppedFilm.major[0]).toBeCloseTo(fullFilm.major[0] * 4, 10);
    expect(fourTimesCroppedFilm.minor[1]).toBeCloseTo(fullFilm.minor[1] * 4, 10);
    const capped = clampPixelEllipse(fourTimesCroppedFilm, 12);
    const uncappedRadius = maximumPixelEllipseRadius(fourTimesCroppedFilm);
    expect(uncappedRadius).toBeGreaterThan(12);
    expect(capped.clampScale).toBeCloseTo(12 / uncappedRadius, 10);
    expect(uncappedRadius * capped.clampScale).toBeCloseTo(12, 8);
  });

  it("measures far fallback, depth-edge distance, and spatial blur suppression from readback rasters", () => {
    const width = 8;
    const height = 4;
    const size = width * height;
    const rgba = (value: number) => {
      const result = new Float32Array(size * 4);
      for (let pixel = 0; pixel < size; pixel += 1) {
        result[pixel * 4] = value;
        result[pixel * 4 + 1] = value;
        result[pixel * 4 + 2] = value;
        result[pixel * 4 + 3] = 1;
      }
      return result;
    };
    const source = rgba(0);
    const reference = rgba(0.4);
    const candidate = rgba(0.4);
    const fallbackMask = new Uint8Array(size);
    for (let y = 0; y < height; y += 1) {
      fallbackMask[y * width + 4] = 1;
      candidate[(y * width + 4) * 4] = 0;
      candidate[(y * width + 4) * 4 + 1] = 0;
      candidate[(y * width + 4) * 4 + 2] = 0;
    }
    const validity = new Uint8Array(size).fill(1);
    const coc = new Float32Array(size).fill(1);
    const depth = new Float32Array(size);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) depth[y * width + x] = x < 3 ? 100 : 200;
    }
    const result = measureLargeCocFarQuality({
      width,
      height,
      sourceRgba: source,
      referenceRgba: reference,
      candidateRgba: candidate,
      signedCocMm: coc,
      validity,
      depthMm: depth,
      sourceFallbackMask: fallbackMask,
    });
    expect(result.validFarPixelCount).toBe(size);
    expect(result.depthBoundaryPixelCount).toBe(height * 2);
    expect(result.sourceFallbackFarPixelCount).toBe(height);
    expect(result.sourceFallbackNearDepthBoundary["0-1px"]).toBe(height);
    expect(result.farBlurSuppressionEnergy).toBeGreaterThan(0);
    expect(result.blurSpread.candidateToReferenceSignalEnergyRatio).toBeLessThan(1);
    expect(result.fullFrameRgbError.rgbRootMeanSquareError).toBeGreaterThan(0);
  });

  it("detects a B1 fallback pixel that is not copied from its source color", () => {
    const source = new Float32Array([0.2, 0.4, 0.6, 1, 0.8, 0.6, 0.4, 1]);
    const correctFallback = source.slice();
    const wrongFallback = source.slice();
    wrongFallback[4] = 0;
    const fallbackMask = new Uint8Array([0, 1]);
    expect(countFallbackSourceColorMismatches(source, correctFallback, fallbackMask)).toBe(0);
    expect(countFallbackSourceColorMismatches(source, wrongFallback, fallbackMask)).toBe(1);
  });

  it("detects near-alpha-only changes independently from unchanged RGB", () => {
    const expected = new Float32Array([0.2, 0.4, 0.6, 0.75]);
    const alphaOnlyMutation = new Float32Array([0.2, 0.4, 0.6, 0.5]);
    const comparison = compareNearTargetRgba(expected, alphaOnlyMutation);
    expect(comparison.maxRgbError).toBe(0);
    expect(comparison.rootMeanSquareRgbError).toBe(0);
    expect(comparison.maxAlphaError).toBeCloseTo(0.25, 8);
    expect(comparison.rootMeanSquareAlphaError).toBeCloseTo(0.25, 8);
  });

  it("reports the largest contiguous capped region instead of treating one pixel as a stress region", () => {
    const mask = new Uint8Array(7 * 5);
    mask[1 * 7 + 1] = 1;
    mask[1 * 7 + 2] = 1;
    mask[2 * 7 + 2] = 1;
    mask[4 * 7 + 6] = 1;
    expect(largestBinaryComponent(mask, 7, 5)).toEqual({
      pixelCount: 3,
      bounds: { left: 1, top: 1, right: 2, bottom: 2 },
    });
  });
});
