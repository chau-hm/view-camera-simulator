import { describe, expect, it } from "vitest";
import {
  imageDistanceMm,
  focusPlaneWidthMm,
  projectPointToGroundGlass,
  cocDiameterMm,
  computePhysicalCoCDiameterMm,
  computeSignedPhysicalCoCDiameterMm,
  verticalFovDegreesFromImageDistance,
} from "../../core/optics/thinLensModel";

const focalLengthMm = 150;
const apertureFNumber = 11;
const sensorWidthMm = 127;
const sensorHeightMm = 101.6;

describe("thinLensModel", () => {
  it("computes image distance for focus at 1000 mm (approx 176.4706)", () => {
    const D = 1000;
    const image = imageDistanceMm(focalLengthMm, D);
    expect(image).toBeGreaterThan(176.4);
    expect(image).toBeLessThan(176.6);
  });

  it("computes focus plane width for focus at 1000 mm (approx 719.67)", () => {
    const D = 1000;
    const image = imageDistanceMm(focalLengthMm, D);
    const width = focusPlaneWidthMm(sensorWidthMm, D, image);
    expect(width).toBeGreaterThan(719.6);
    expect(width).toBeLessThan(719.8);
  });

  it("computes image distance for focus at 3000 mm (approx 157.8947)", () => {
    const D = 3000;
    const image = imageDistanceMm(focalLengthMm, D);
    expect(image).toBeGreaterThan(157.8);
    expect(image).toBeLessThan(158.0);
  });

  it("computes focus plane width for focus at 3000 mm (approx 2413.0)", () => {
    const D = 3000;
    const image = imageDistanceMm(focalLengthMm, D);
    const width = focusPlaneWidthMm(sensorWidthMm, D, image);
    expect(width).toBeGreaterThan(2412.9);
    expect(width).toBeLessThan(2413.2);
  });

  it("projects a world point to ground glass film coordinates", () => {
    const D = 1000;
    const image = imageDistanceMm(focalLengthMm, D);
    const pt = { x: 200, y: 50, z: 1000 };
    const proj = projectPointToGroundGlass(pt, image);
    expect(proj).not.toBeNull();
    if (proj) {
      expect(proj.xFilm).toBeCloseTo(-image * 200 / 1000, 8);
      expect(proj.yFilm).toBeCloseTo(-image * 50 / 1000, 8);
    }
  });

  it("computes CoC diameter: CoC at focus distance is ~0", () => {
    const focusD = 1000;
    const image = imageDistanceMm(focalLengthMm, focusD);
    const coc = cocDiameterMm(focalLengthMm, apertureFNumber, image, focusD);
    expect(coc).toBeCloseTo(0, 8);
  });

  it("computes non-zero CoC for a different object distance", () => {
    const focusD = 1000;
    const image = imageDistanceMm(focalLengthMm, focusD);
    const cocNear = cocDiameterMm(focalLengthMm, apertureFNumber, image, 1200);
    expect(cocNear).toBeGreaterThan(0);
  });

  describe("neutral physical CoC kernel", () => {
    it("matches an independent thin-lens reference fixture in millimetres", () => {
      const input = {
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: 1200,
        filmDistanceMm: 200,
      };

      // 1/150 = 1/1200 + 1/V, so V = 1200/7 mm.
      const expectedImageDistanceMm = 1200 / 7;
      const expectedApertureDiameterMm = 150 / 8;
      const expectedCoCDiameterMm =
        expectedApertureDiameterMm * Math.abs(1 - 200 / expectedImageDistanceMm);

      expect(expectedImageDistanceMm).toBeCloseTo(171.42857142857142, 12);
      expect(expectedCoCDiameterMm).toBeCloseTo(3.125, 12);
      expect(computePhysicalCoCDiameterMm(input)).toBeCloseTo(
        expectedCoCDiameterMm,
        12,
      );
    });

    it("is zero when the film distance equals the ideal image distance", () => {
      const focusedInput = {
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: 900,
        filmDistanceMm: 180,
      };

      expect(computePhysicalCoCDiameterMm(focusedInput)).toBeCloseTo(0, 12);
    });

    it("is positive for object points nearer than and farther than the focused point", () => {
      const baseInput = {
        focalLengthMm: 150,
        apertureFNumber: 8,
        filmDistanceMm: 180,
      };

      const nearerObjectCoC = computePhysicalCoCDiameterMm({
        ...baseInput,
        objectDistanceMm: 600,
      });
      const fartherObjectCoC = computePhysicalCoCDiameterMm({
        ...baseInput,
        objectDistanceMm: 1200,
      });

      expect(nearerObjectCoC).toBeGreaterThan(0);
      expect(fartherObjectCoC).toBeGreaterThan(0);
    });

    it("uses negative near-side and positive far-side signed CoC with unchanged magnitude", () => {
      const baseInput = {
        focalLengthMm: 150,
        apertureFNumber: 8,
        filmDistanceMm: 180,
      };
      const nearInput = { ...baseInput, objectDistanceMm: 600 };
      const farInput = { ...baseInput, objectDistanceMm: 1200 };

      expect(computeSignedPhysicalCoCDiameterMm(nearInput)).toBeLessThan(0);
      expect(computeSignedPhysicalCoCDiameterMm(farInput)).toBeGreaterThan(0);
      expect(Math.abs(computeSignedPhysicalCoCDiameterMm(nearInput))).toBeCloseTo(
        computePhysicalCoCDiameterMm(nearInput),
        12,
      );
      expect(Math.abs(computeSignedPhysicalCoCDiameterMm(farInput))).toBeCloseTo(
        computePhysicalCoCDiameterMm(farInput),
        12,
      );
    });

    it("keeps focus, infinity, and the focal-boundary sign deterministic", () => {
      expect(
        computeSignedPhysicalCoCDiameterMm({
          focalLengthMm: 150,
          apertureFNumber: 8,
          objectDistanceMm: 900,
          filmDistanceMm: 180,
        }),
      ).toBeCloseTo(0, 12);
      expect(
        computeSignedPhysicalCoCDiameterMm({
          focalLengthMm: 150,
          apertureFNumber: 8,
          objectDistanceMm: Number.POSITIVE_INFINITY,
          filmDistanceMm: 200,
        }),
      ).toBeCloseTo(6.25, 12);
      expect(
        computeSignedPhysicalCoCDiameterMm({
          focalLengthMm: 150,
          apertureFNumber: 8,
          objectDistanceMm: 150,
          filmDistanceMm: 200,
        }),
      ).toBeCloseTo(-18.75, 12);
    });

    it("gets larger as the f-number gets smaller for fixed defocus", () => {
      const input = {
        focalLengthMm: 150,
        objectDistanceMm: 1200,
        filmDistanceMm: 200,
      };

      const f8CoC = computePhysicalCoCDiameterMm({ ...input, apertureFNumber: 8 });
      const f22CoC = computePhysicalCoCDiameterMm({ ...input, apertureFNumber: 22 });

      expect(f8CoC).toBeGreaterThan(f22CoC);
    });

    it("keeps a focused point at zero CoC for every valid aperture", () => {
      const input = {
        focalLengthMm: 150,
        objectDistanceMm: 900,
        filmDistanceMm: 180,
      };

      expect(
        computePhysicalCoCDiameterMm({ ...input, apertureFNumber: 4 }),
      ).toBeCloseTo(0, 12);
      expect(
        computePhysicalCoCDiameterMm({ ...input, apertureFNumber: 64 }),
      ).toBeCloseTo(0, 12);
    });

    it("agrees with the retained positional cocDiameterMm API on the normal finite domain", () => {
      const input = {
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: 1200,
        filmDistanceMm: 200,
      };

      expect(cocDiameterMm(
        input.focalLengthMm,
        input.apertureFNumber,
        input.filmDistanceMm,
        input.objectDistanceMm,
      )).toBeCloseTo(computePhysicalCoCDiameterMm(input), 12);
    });

    it("preserves the legacy Infinity sentinel at U = f", () => {
      const input = {
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: 150,
        filmDistanceMm: 200,
      };

      expect(computePhysicalCoCDiameterMm(input)).toBeCloseTo(18.75, 12);
      expect(
        cocDiameterMm(
          input.focalLengthMm,
          input.apertureFNumber,
          input.filmDistanceMm,
          input.objectDistanceMm,
        ),
      ).toBe(Number.POSITIVE_INFINITY);
    });

    it("handles infinity focus and the U = f optical limit without zeroing the aperture", () => {
      const infinityObjectCoC = computePhysicalCoCDiameterMm({
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: Number.POSITIVE_INFINITY,
        filmDistanceMm: 200,
      });
      const focalObjectCoC = computePhysicalCoCDiameterMm({
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: 150,
        filmDistanceMm: 200,
      });

      expect(infinityObjectCoC).toBeCloseTo(6.25, 12);
      expect(imageDistanceMm(150, 150)).toBe(Number.POSITIVE_INFINITY);
      expect(focalObjectCoC).toBeCloseTo(150 / 8, 12);
    });

    it("keeps the virtual-image side of the focal boundary deterministic", () => {
      const coc = computePhysicalCoCDiameterMm({
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: 100,
        filmDistanceMm: 200,
      });

      // V = 150*100/(100-150) = -300 mm; CoC = (150/8)|1 - 200/-300|.
      expect(coc).toBeCloseTo(31.25, 12);
    });

    it.each([
      { name: "zero focal length", focalLengthMm: 0 },
      { name: "negative focal length", focalLengthMm: -150 },
      { name: "non-finite focal length", focalLengthMm: Number.NaN },
      { name: "zero f-number", apertureFNumber: 0 },
      { name: "negative f-number", apertureFNumber: -8 },
      { name: "non-finite f-number", apertureFNumber: Number.POSITIVE_INFINITY },
      { name: "zero object distance", objectDistanceMm: 0 },
      { name: "negative object distance", objectDistanceMm: -100 },
      { name: "non-finite object distance", objectDistanceMm: Number.NaN },
      { name: "negative infinite object distance", objectDistanceMm: Number.NEGATIVE_INFINITY },
      { name: "zero film distance", filmDistanceMm: 0 },
      { name: "non-finite film distance", filmDistanceMm: Number.POSITIVE_INFINITY },
    ])("returns NaN for $name", (invalidInput) => {
      const result = computePhysicalCoCDiameterMm({
        focalLengthMm: 150,
        apertureFNumber: 8,
        objectDistanceMm: 1200,
        filmDistanceMm: 200,
        ...invalidInput,
      });

      expect(Number.isNaN(result)).toBe(true);
    });
  });

  it("computes vertical FOV degrees from image distance", () => {
    const D = 1000;
    const image = imageDistanceMm(focalLengthMm, D);
    const vFov = verticalFovDegreesFromImageDistance(sensorHeightMm, image);
    expect(vFov).toBeGreaterThan(0);
    expect(typeof vFov).toBe("number");
  });
});
