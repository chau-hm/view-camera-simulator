import { describe, expect, it } from "vitest";
import { deriveMacroFocusMetrics } from "../../core/optics/deriveMacroFocusMetrics";

describe("deriveMacroFocusMetrics", () => {
  it.each([
    [900, 180, 0.2, 1.44, 0.5260688116675876],
    [450, 225, 0.5, 2.25, 1.1699250014423124],
    [300, 300, 1, 4, 2],
  ])("derives raw metrics for U=%s and v=%s mm", (U, v, m, factor, stops) => {
    const result = deriveMacroFocusMetrics({
      focalLengthMm: 150, objectDistanceMm: U, imageDistanceMm: v,
    });
    expect(result).not.toBeNull();
    expect(result!.bellowsExtensionMm).toBe(v);
    expect(result!.magnification).toBeCloseTo(m, 12);
    expect(result!.bellowsFactor).toBeCloseTo(factor, 12);
    expect(result!.exposureCompensationStops).toBeCloseTo(stops, 12);
  });

  it.each(["focalLengthMm", "objectDistanceMm", "imageDistanceMm"] as const)(
    "rejects invalid %s", (key) => {
      for (const value of [0, -1, NaN, Infinity, -Infinity]) {
        expect(deriveMacroFocusMetrics({
          focalLengthMm: 150, objectDistanceMm: 900, imageDistanceMm: 180,
          [key]: value,
        })).toBeNull();
      }
    },
  );

  it.each([100, 150])("rejects non-real finite conjugate distances of %s mm", (distance) => {
    expect(deriveMacroFocusMetrics({
      focalLengthMm: 150, objectDistanceMm: distance, imageDistanceMm: 180,
    })).toBeNull();
    expect(deriveMacroFocusMetrics({
      focalLengthMm: 150, objectDistanceMm: 900, imageDistanceMm: distance,
    })).toBeNull();
  });

  it("rejects numerical overflow", () => {
    expect(deriveMacroFocusMetrics({
      focalLengthMm: Number.MIN_VALUE, objectDistanceMm: 900, imageDistanceMm: 180,
    })).toBeNull();
  });
});
