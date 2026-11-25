import { describe, expect, it } from "vitest";
import {
  APERTURE_GATHER_CASES,
  clampPixelEllipse,
  depthToleranceMm,
  ellipseMembership,
  estimateNearCoverage,
  farDepthSampleWeight,
  goldenAngleDiskSample,
  mapPhysicalEllipseToSourcePixels,
  maximumPixelEllipseRadius,
  nearDepthSampleWeight,
  orientedSampleOffsetPx,
  requireGatherReferenceProbePair,
  referenceGatherProbe,
} from "../e2e/fixtures/ground-glass-webgpu-aperture-gather-cases";

const denseMaximumRadius = (
  ellipse: { major: readonly [number, number]; minor: readonly [number, number]; clampScale: number },
  steps = 32_768,
): number => {
  let maximum = 0;
  for (let index = 0; index < steps; index += 1) {
    const angle = index * Math.PI * 2 / steps;
    const u = Math.cos(angle);
    const v = Math.sin(angle);
    const x = (ellipse.major[0] * u + ellipse.minor[0] * v) * ellipse.clampScale;
    const y = (ellipse.major[1] * u + ellipse.minor[1] * v) * ellipse.clampScale;
    maximum = Math.max(maximum, Math.hypot(x, y));
  }
  return maximum;
};

describe("Phase F independent aperture-gather reference", () => {
  it("maps physical ellipse axes through a non-square source and film", () => {
    const ellipse = mapPhysicalEllipseToSourcePixels(
      3,
      1,
      0,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );

    expect(ellipse.major[0]).toBeCloseTo(128 / 12, 12);
    expect(ellipse.major[1]).toBeCloseTo(0, 12);
    expect(ellipse.minor[0]).toBeCloseTo(0, 12);
    expect(ellipse.minor[1]).toBeCloseTo(-4, 12);
  });

  it("preserves quarter-turn orientation and distinguishes horizontal from vertical spread", () => {
    const quarterTurn = mapPhysicalEllipseToSourcePixels(
      3,
      1,
      Math.PI / 2,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );

    expect(quarterTurn.major[0]).toBeCloseTo(0, 12);
    expect(quarterTurn.major[1]).toBeCloseTo(-12, 12);
    expect(quarterTurn.minor[0]).toBeCloseTo(-128 / 36, 12);
    expect(quarterTurn.minor[1]).toBeCloseTo(0, 12);
    expect(ellipseMembership([0, -11.9], quarterTurn)).toBe(1);
    expect(ellipseMembership([11.9, 0], quarterTurn)).toBe(0);
  });

  it("maps the same physical ellipse to four times the pixels for an off-center 4x crop", () => {
    const full = mapPhysicalEllipseToSourcePixels(
      2,
      1,
      0,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    const crop = mapPhysicalEllipseToSourcePixels(
      2,
      1,
      0,
      { widthMm: 9, heightMm: 6 },
      { widthPx: 128, heightPx: 96 },
    );

    expect(crop.major[0] / full.major[0]).toBe(4);
    expect(crop.minor[1] / full.minor[1]).toBe(4);
  });

  it("uses film aspect ratio and source resolution independently of physical millimetres", () => {
    const reference = mapPhysicalEllipseToSourcePixels(
      2,
      1,
      0,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    const portraitFilm = mapPhysicalEllipseToSourcePixels(
      2,
      1,
      0,
      { widthMm: 36, heightMm: 48 },
      { widthPx: 128, heightPx: 96 },
    );
    const doubledSource = mapPhysicalEllipseToSourcePixels(
      2,
      1,
      0,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 256, heightPx: 192 },
    );

    expect(portraitFilm.major[0]).toBe(reference.major[0]);
    expect(portraitFilm.minor[1]).toBe(reference.minor[1] / 2);
    expect(doubledSource.major[0]).toBe(reference.major[0] * 2);
    expect(doubledSource.minor[1]).toBe(reference.minor[1] * 2);
  });

  it("rejects invalid film or source dimensions before they create non-finite sample offsets", () => {
    expect(() => mapPhysicalEllipseToSourcePixels(
      1,
      1,
      0,
      { widthMm: 0, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    )).toThrow(RangeError);
    expect(() => mapPhysicalEllipseToSourcePixels(
      1,
      1,
      0,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 0 },
    )).toThrow(RangeError);
  });

  it("caps the true maximum radius of a rotated anisotropic pixel ellipse", () => {
    const ellipse = mapPhysicalEllipseToSourcePixels(
      8,
      4,
      Math.PI / 4,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    const capped = clampPixelEllipse(ellipse, 12);
    const analyticRadius = maximumPixelEllipseRadius(ellipse);
    const denseRadius = denseMaximumRadius(ellipse);
    const legacyAxisMaximum = Math.max(
      Math.hypot(...ellipse.major),
      Math.hypot(...ellipse.minor),
    );
    const legacyScale = Math.min(1, 12 / legacyAxisMaximum);
    const legacyEllipse = { ...ellipse, clampScale: legacyScale };

    expect(capped.clampScale).toBeLessThan(1);
    expect(capped.clampScale).toBeGreaterThan(0);
    expect(analyticRadius).toBeCloseTo(denseRadius, 6);
    expect(analyticRadius).toBeGreaterThan(legacyAxisMaximum);
    expect(denseMaximumRadius(capped)).toBeLessThanOrEqual(12 + 1e-9);
    expect(denseMaximumRadius(capped)).toBeCloseTo(12, 6);
    // Demonstrates that the pre-fix max-axis approximation exceeds the declared cap.
    expect(denseMaximumRadius(legacyEllipse)).toBeGreaterThan(12.02);
    expect(ellipse.major).toEqual(mapPhysicalEllipseToSourcePixels(
      8,
      4,
      Math.PI / 4,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    ).major);
  });

  it("matches a dense unit-circle sweep for several rotated and nearly degenerate ellipses", () => {
    const cases = [
      { majorRadius: 8, minorRadius: 4, angle: 0.37 },
      { majorRadius: 8, minorRadius: 4, angle: Math.PI / 4 },
      { majorRadius: 8, minorRadius: 4, angle: Math.PI / 2 },
      { majorRadius: 8, minorRadius: 4, angle: Math.PI },
      { majorRadius: 1000, minorRadius: 0.000001, angle: 0.93 },
    ];
    for (const current of cases) {
      const ellipse = mapPhysicalEllipseToSourcePixels(
        current.majorRadius,
        current.minorRadius,
        current.angle,
        { widthMm: 36, heightMm: 24 },
        { widthPx: 128, heightPx: 96 },
      );
      const capped = clampPixelEllipse(ellipse, 12);
      expect(maximumPixelEllipseRadius(ellipse)).toBeCloseTo(denseMaximumRadius(ellipse), 5);
      expect(denseMaximumRadius(capped)).toBeLessThanOrEqual(12 + 1e-8);
      expect(Number.isFinite(capped.clampScale)).toBe(true);
    }
  });

  it("reduces to the prior maximum-axis result for orthogonal pixel axes", () => {
    const ellipse = mapPhysicalEllipseToSourcePixels(
      8,
      4,
      0,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    const expected = Math.max(Math.hypot(...ellipse.major), Math.hypot(...ellipse.minor));
    expect(ellipse.major[0] * ellipse.minor[0] + ellipse.major[1] * ellipse.minor[1]).toBeCloseTo(0, 12);
    expect(maximumPixelEllipseRadius(ellipse)).toBeCloseTo(expected, 12);
  });

  it("is orientation invariant under isotropic pixel scaling", () => {
    const orientations = [0, 0.31, Math.PI / 4, Math.PI / 2, 2.7];
    const results = orientations.map((orientation) => maximumPixelEllipseRadius(
      mapPhysicalEllipseToSourcePixels(
        8,
        4,
        orientation,
        { widthMm: 36, heightMm: 24 },
        { widthPx: 144, heightPx: 96 },
      ),
    ));
    for (const radius of results) expect(radius).toBeCloseTo(32, 10);
  });

  it("uses the larger pixel scale for a circular physical footprint under anisotropic scaling", () => {
    for (const orientation of [0, Math.PI / 4, Math.PI / 2, Math.PI]) {
      const ellipse = mapPhysicalEllipseToSourcePixels(
        4,
        4,
        orientation,
        { widthMm: 36, heightMm: 24 },
        { widthPx: 128, heightPx: 96 },
      );
      expect(maximumPixelEllipseRadius(ellipse)).toBeCloseTo(16, 10);
    }
  });

  it("preserves the extent under π-periodic orientation and handles zero-size caps", () => {
    const first = mapPhysicalEllipseToSourcePixels(
      7,
      2,
      0.63,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    const periodic = mapPhysicalEllipseToSourcePixels(
      7,
      2,
      0.63 + Math.PI,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    expect(maximumPixelEllipseRadius(periodic)).toBeCloseTo(maximumPixelEllipseRadius(first), 10);
    expect(clampPixelEllipse(first, 12).clampScale).toBeCloseTo(clampPixelEllipse(periodic, 12).clampScale, 10);

    const zero = mapPhysicalEllipseToSourcePixels(
      0,
      0,
      0,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    expect(maximumPixelEllipseRadius(zero)).toBe(0);
    expect(clampPixelEllipse(zero, 0).clampScale).toBe(1);
    expect(clampPixelEllipse(first, 0).clampScale).toBe(0);
    expect(denseMaximumRadius(clampPixelEllipse(first, 0))).toBe(0);
    expect(() => clampPixelEllipse(first, -1)).toThrow(RangeError);
    expect(() => maximumPixelEllipseRadius({ major: [Number.NaN, 0], minor: [0, 1] })).toThrow(RangeError);
  });

  it("requires exactly one far and one near reference probe instead of passing vacuously", () => {
    const pair = requireGatherReferenceProbePair([
      { layer: "far", id: "far-probe" },
      { layer: "near", id: "near-probe" },
    ]);
    expect(pair.far.id).toBe("far-probe");
    expect(pair.near.id).toBe("near-probe");
    expect(() => requireGatherReferenceProbePair([{ layer: "near" }])).toThrow("exactly one far");
    expect(() => requireGatherReferenceProbePair([{ layer: "far" }])).toThrow("exactly one near");
    expect(() => requireGatherReferenceProbePair([])).toThrow("exactly one far");
    expect(() => requireGatherReferenceProbePair([
      { layer: "far" },
      { layer: "far" },
      { layer: "near" },
    ])).toThrow("exactly one far");
  });

  it("generates deterministic bounded golden-angle aperture proposals", () => {
    const first = goldenAngleDiskSample(0, 32);
    const second = goldenAngleDiskSample(1, 32);
    expect(first).toEqual(goldenAngleDiskSample(0, 32));
    expect(first).not.toEqual(second);
    expect(Math.hypot(...first)).toBeLessThan(1);
    expect(Math.hypot(...second)).toBeLessThan(1);
    expect(() => goldenAngleDiskSample(APERTURE_GATHER_CASES.maxApertureSamples, 64)).toThrow(RangeError);

    const ellipse = mapPhysicalEllipseToSourcePixels(
      3,
      1,
      Math.PI / 4,
      { widthMm: 36, heightMm: 24 },
      { widthPx: 128, heightPx: 96 },
    );
    const offset = orientedSampleOffsetPx(first, ellipse);
    expect(Number.isFinite(offset[0])).toBe(true);
    expect(Number.isFinite(offset[1])).toBe(true);
  });

  it("keeps far and near occlusion decisions separate from physical footprint math", () => {
    expect(depthToleranceMm(1000)).toBe(20);
    expect(depthToleranceMm(2000)).toBe(30);
    expect(farDepthSampleWeight({
      centerDistanceMm: 500,
      sampleDistanceMm: 480,
      sampleSignedCocMm: 1,
      sampleValid: true,
    })).toBe(1);
    expect(farDepthSampleWeight({
      centerDistanceMm: 500,
      sampleDistanceMm: 400,
      sampleSignedCocMm: -1,
      sampleValid: true,
    })).toBe(0);
    expect(farDepthSampleWeight({
      centerDistanceMm: 500,
      sampleDistanceMm: 600,
      sampleSignedCocMm: 1,
      sampleValid: false,
    })).toBe(0);
    expect(nearDepthSampleWeight({
      centerDistanceMm: 320,
      sampleDistanceMm: 330,
      centerSignedCocMm: -1,
      sampleSignedCocMm: -0.5,
      sampleValid: true,
    })).toBe(1);
    expect(nearDepthSampleWeight({
      centerDistanceMm: 320,
      sampleDistanceMm: 500,
      centerSignedCocMm: -1,
      sampleSignedCocMm: -0.5,
      sampleValid: true,
    })).toBe(0);
    expect(nearDepthSampleWeight({
      centerDistanceMm: 320,
      sampleDistanceMm: 500,
      centerSignedCocMm: 0,
      sampleSignedCocMm: -0.5,
      sampleValid: false,
    })).toBe(0);
  });

  it("bounds sparse near-coverage estimates and preserves focused-center coverage", () => {
    expect(estimateNearCoverage({
      acceptedWeight: 0,
      footprintAreaRatio: 1,
      sampleCount: 16,
      centerForeground: false,
    })).toBe(0);
    expect(estimateNearCoverage({
      acceptedWeight: 1,
      footprintAreaRatio: 0.02,
      sampleCount: 16,
      centerForeground: false,
    })).toBeGreaterThan(0);
    expect(estimateNearCoverage({
      acceptedWeight: 0,
      footprintAreaRatio: 0,
      sampleCount: 16,
      centerForeground: true,
    })).toBe(1);
  });

  it("does not turn unresolved physical input into a near or far gather sample", () => {
    const common = {
      x: 0,
      y: 0,
      source: { widthPx: 1, heightPx: 1 },
      film: { widthMm: 36, heightMm: 24 },
      sampleCount: 1,
      maximumCoCRadiusPx: 12,
      cameraZMm: -120,
      patch: {
        left: 0,
        top: 0,
        width: 1,
        height: 1,
        colors: [[0.1, 0.2, 0.3] as const],
        physical: [[0, 0, 0, 0] as const],
        validity: [4],
        worldAndDepth: [[0, 0, 500, 0.9] as const],
      },
    };
    const far = referenceGatherProbe({
      ...common,
      layer: "far",
      actualRgba: [0.1, 0.2, 0.3, 1],
    });
    const near = referenceGatherProbe({
      ...common,
      layer: "near",
      actualRgba: [0, 0, 0, 0],
    });

    expect(far.rgba).toEqual([0.1, 0.2, 0.3, 1]);
    expect(near.rgba).toEqual([0, 0, 0, 0]);
    expect(far.maxRgbError).toBe(0);
    expect(near.alphaError).toBe(0);
  });
});
