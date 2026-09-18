import { describe, expect, it } from "vitest";
import {
  resolveGroundGlassApertureIlluminance,
  resolveGroundGlassBellowsIlluminance,
  resolveGroundGlassRelativeIlluminance,
} from "../../core/optics/groundGlassIlluminance";

const resolveIlluminance = (overrides: {
  apertureFNumber?: number;
  focalLengthMm?: number | null;
  imageDistanceMm?: number | null;
} = {}) =>
  resolveGroundGlassRelativeIlluminance({
    apertureFNumber: overrides.apertureFNumber ?? 11,
    focalLengthMm: overrides.focalLengthMm === undefined ? 150 : overrides.focalLengthMm,
    imageDistanceMm: overrides.imageDistanceMm === undefined ? 150 : overrides.imageDistanceMm,
  });

describe("Ground Glass relative illuminance", () => {
  it("normalizes f/11 at nominal extension to one", () => {
    expect(resolveIlluminance()).toBe(1);
  });

  it("preserves aperture throughput at nominal extension", () => {
    expect(resolveGroundGlassApertureIlluminance({ apertureFNumber: 8 })).toBeCloseTo((11 / 8) ** 2, 12);
    expect(resolveGroundGlassApertureIlluminance({ apertureFNumber: 22 })).toBeCloseTo(0.25, 12);
    expect(resolveGroundGlassApertureIlluminance({ apertureFNumber: 16 })).toBeCloseTo((11 / 16) ** 2, 12);
    expect(resolveGroundGlassApertureIlluminance({ apertureFNumber: 5.6 })).toBeCloseTo((11 / 5.6) ** 2, 12);
    expect(resolveGroundGlassApertureIlluminance({ apertureFNumber: 32 })).toBeCloseTo((11 / 32) ** 2, 12);
  });

  it("models moderate 150 mm extension at f/11", () => {
    expect(resolveGroundGlassBellowsIlluminance({ focalLengthMm: 150, imageDistanceMm: 180 })).toBeCloseTo(
      1 / 1.44,
      12,
    );
    expect(resolveIlluminance({ imageDistanceMm: 180 })).toBeCloseTo(1 / 1.44, 12);
  });

  it("models the 1:1 extension at f/11", () => {
    expect(resolveGroundGlassBellowsIlluminance({ focalLengthMm: 150, imageDistanceMm: 300 })).toBeCloseTo(0.25, 12);
    expect(resolveIlluminance({ imageDistanceMm: 300 })).toBeCloseTo(0.25, 12);
  });

  it("models the 450 mm focus conjugate at f/11", () => {
    expect(resolveGroundGlassBellowsIlluminance({ focalLengthMm: 150, imageDistanceMm: 225 })).toBeCloseTo(
      (150 / 225) ** 2,
      12,
    );
    expect(resolveIlluminance({ imageDistanceMm: 225 })).toBeCloseTo((150 / 225) ** 2, 12);
  });

  it("multiplies aperture and bellows-extension throughput", () => {
    expect(resolveIlluminance({ apertureFNumber: 22, imageDistanceMm: 300 })).toBeCloseTo(0.0625, 12);
  });

  it("decreases monotonically as image distance increases", () => {
    const gains = [150, 180, 225, 300].map((imageDistanceMm) =>
      resolveIlluminance({ imageDistanceMm }),
    );

    expect(gains[0]).toBeGreaterThan(gains[1]);
    expect(gains[1]).toBeGreaterThan(gains[2]);
    expect(gains[2]).toBeGreaterThan(gains[3]);
  });

  it("decreases monotonically as the aperture is stopped down", () => {
    const gains = [5.6, 8, 11, 16, 22, 32].map((aperture) =>
      resolveIlluminance({ apertureFNumber: aperture }),
    );

    expect(gains[0]).toBeGreaterThan(gains[1]);
    expect(gains[1]).toBeGreaterThan(gains[2]);
    expect(gains[2]).toBeGreaterThan(gains[3]);
    expect(gains[3]).toBeGreaterThan(gains[4]);
    expect(gains[4]).toBeGreaterThan(gains[5]);
  });

  it("uses a neutral bellows component when canonical extension data is invalid", () => {
    expect(resolveGroundGlassBellowsIlluminance({ focalLengthMm: 150, imageDistanceMm: null })).toBe(1);
    expect(resolveGroundGlassBellowsIlluminance({ focalLengthMm: Number.NaN, imageDistanceMm: 300 })).toBe(1);
    expect(resolveGroundGlassBellowsIlluminance({ focalLengthMm: 150, imageDistanceMm: 100 })).toBe(1);
    expect(resolveGroundGlassBellowsIlluminance({ focalLengthMm: 150, imageDistanceMm: Number.POSITIVE_INFINITY })).toBe(1);
    expect(resolveIlluminance({ apertureFNumber: 22, imageDistanceMm: null })).toBeCloseTo(0.25, 12);
  });

  it("uses a neutral complete gain when aperture inputs are invalid", () => {
    expect(resolveGroundGlassRelativeIlluminance({
      apertureFNumber: Number.NaN,
      focalLengthMm: 150,
      imageDistanceMm: 300,
    })).toBe(1);
    expect(resolveGroundGlassRelativeIlluminance({
      apertureFNumber: 11,
      referenceFNumber: 0,
      focalLengthMm: 150,
      imageDistanceMm: 300,
    })).toBe(1);
  });
});
