import { describe, expect, it } from "vitest";
import {
  decodeGroundGlassFootprintOrientation,
  decodeGroundGlassFootprintRadiusMm,
  encodeGroundGlassFootprintOrientation,
  encodeGroundGlassFootprintRadiusMm,
  quantizeGroundGlassFootprintByte,
} from "../../render/groundGlassCocTarget";

describe("Ground Glass oriented footprint storage", () => {
  it("keeps half-float footprint radii physical and orientation bounded", () => {
    const major = encodeGroundGlassFootprintRadiusMm(3.25, "half-float-mm", 5);
    const minor = encodeGroundGlassFootprintRadiusMm(1.5, "half-float-mm", 5);
    const orientation = encodeGroundGlassFootprintOrientation(-Math.PI / 4);

    expect(decodeGroundGlassFootprintRadiusMm(major, "half-float-mm", 5)).toBe(3.25);
    expect(decodeGroundGlassFootprintRadiusMm(minor, "half-float-mm", 5)).toBe(1.5);
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
});
