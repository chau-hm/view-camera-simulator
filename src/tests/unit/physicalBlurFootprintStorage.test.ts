import { describe, expect, it } from "vitest";
import {
  decodeGroundGlassFootprintAxesMm,
  decodeGroundGlassFootprintOrientation,
  decodeGroundGlassFootprintRadiusMm,
  encodeGroundGlassFootprintAxesMm,
  encodeGroundGlassFootprintOrientation,
  encodeGroundGlassFootprintRadiusMm,
  quantizeGroundGlassFootprintByte,
} from "../../render/groundGlassCocTarget";

describe("Ground Glass oriented footprint storage", () => {
  it("keeps half-float footprint radii physical and orientation bounded", () => {
    const encodedAxes = encodeGroundGlassFootprintAxesMm({
      majorRadiusMm: 3.25,
      minorRadiusMm: 1.5,
      storageFormat: "half-float-mm",
      maximumRadiusMm: 5,
    });
    const orientation = encodeGroundGlassFootprintOrientation(-Math.PI / 4);

    expect(encodedAxes.storageScale).toBe(1);
    expect(decodeGroundGlassFootprintAxesMm({
      ...encodedAxes,
      storageFormat: "half-float-mm",
      maximumRadiusMm: 5,
    })).toEqual({ majorRadiusMm: 3.25, minorRadiusMm: 1.5 });
    expect(decodeGroundGlassFootprintOrientation(orientation, "half-float-mm")).toBeCloseTo(
      (3 * Math.PI) / 4,
      12,
    );
  });

  it("models real RGBA8 quantization for axes and orientation", () => {
    const maximumRadiusMm = 5;
    const majorEncoded = encodeGroundGlassFootprintRadiusMm(
      2.5,
      "encoded-byte",
      maximumRadiusMm,
    );
    const minorEncoded = encodeGroundGlassFootprintRadiusMm(
      1,
      "encoded-byte",
      maximumRadiusMm,
    );
    const orientationEncoded = encodeGroundGlassFootprintOrientation(Math.PI / 3);

    expect(quantizeGroundGlassFootprintByte(majorEncoded)).toBe(128);
    expect(quantizeGroundGlassFootprintByte(minorEncoded)).toBe(51);
    expect(decodeGroundGlassFootprintRadiusMm(majorEncoded, "encoded-byte", maximumRadiusMm)).toBeCloseTo(
      (128 / 255) * maximumRadiusMm,
      12,
    );
    expect(decodeGroundGlassFootprintRadiusMm(minorEncoded, "encoded-byte", maximumRadiusMm)).toBeCloseTo(
      (51 / 255) * maximumRadiusMm,
      12,
    );
    expect(decodeGroundGlassFootprintOrientation(orientationEncoded, "encoded-byte")).toBeCloseTo(
      (85 / 255) * Math.PI,
      12,
    );
  });

  it("keeps zero/minimum footprint deterministic and values bounded", () => {
    expect(encodeGroundGlassFootprintRadiusMm(0, "encoded-byte", 5)).toBe(0);
    expect(decodeGroundGlassFootprintRadiusMm(0, "encoded-byte", 5)).toBe(0);
    expect(encodeGroundGlassFootprintRadiusMm(100, "encoded-byte", 5)).toBe(1);
    expect(encodeGroundGlassFootprintOrientation(Math.PI)).toBe(0);
    expect(encodeGroundGlassFootprintOrientation(Number.NaN)).toBe(0);
  });

  it("keeps both axes normally quantized when they fit the byte range", () => {
    const encodedAxes = encodeGroundGlassFootprintAxesMm({
      majorRadiusMm: 2.5,
      minorRadiusMm: 1,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });
    const decodedAxes = decodeGroundGlassFootprintAxesMm({
      ...encodedAxes,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });

    expect(encodedAxes.storageScale).toBe(1);
    expect(encodedAxes.encodedMajorRadius).toBe(128 / 255);
    expect(encodedAxes.encodedMinorRadius).toBe(51 / 255);
    expect(decodedAxes.majorRadiusMm).toBeCloseTo((128 / 255) * 5, 12);
    expect(decodedAxes.minorRadiusMm).toBeCloseTo((51 / 255) * 5, 12);
  });

  it("uniformly scales an over-range anisotropic pair before RGBA8 storage", () => {
    const encodedAxes = encodeGroundGlassFootprintAxesMm({
      majorRadiusMm: 10,
      minorRadiusMm: 2.5,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });
    const decodedAxes = decodeGroundGlassFootprintAxesMm({
      ...encodedAxes,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });

    expect(encodedAxes.storageScale).toBeCloseTo(0.5, 12);
    expect(encodedAxes.encodedMajorRadius).toBe(1);
    expect(encodedAxes.encodedMinorRadius).toBe(64 / 255);
    expect(decodedAxes.majorRadiusMm).toBeCloseTo(5, 12);
    expect(decodedAxes.minorRadiusMm).toBeCloseTo((64 / 255) * 5, 12);
    // Independent channel clipping would reduce the original 4:1 ratio to
    // 2:1 by saturating only the major axis.
    expect(decodedAxes.majorRadiusMm / decodedAxes.minorRadiusMm).toBeCloseTo(4, 1);
    expect(decodedAxes.majorRadiusMm).toBeGreaterThan(decodedAxes.minorRadiusMm);
  });

  it("uniformly scales a pair when both axes exceed the byte range", () => {
    const encodedAxes = encodeGroundGlassFootprintAxesMm({
      majorRadiusMm: 10,
      minorRadiusMm: 8,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });
    const decodedAxes = decodeGroundGlassFootprintAxesMm({
      ...encodedAxes,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });

    expect(encodedAxes.storageScale).toBeCloseTo(0.5, 12);
    expect(decodedAxes.majorRadiusMm / decodedAxes.minorRadiusMm).toBeCloseTo(1.25, 2);
  });

  it("keeps zero and ordering deterministic for the pair contract", () => {
    const encodedAxes = encodeGroundGlassFootprintAxesMm({
      majorRadiusMm: 0,
      minorRadiusMm: 0,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });
    expect(encodedAxes).toEqual({
      encodedMajorRadius: 0,
      encodedMinorRadius: 0,
      storageScale: 1,
    });

    const invalidOrdering = encodeGroundGlassFootprintAxesMm({
      majorRadiusMm: 1,
      minorRadiusMm: 2,
      storageFormat: "encoded-byte",
      maximumRadiusMm: 5,
    });
    expect(invalidOrdering.encodedMajorRadius).toBe(0);
    expect(invalidOrdering.encodedMinorRadius).toBe(0);
  });
});
