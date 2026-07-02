import { describe, expect, it } from "vitest";
import {
  imageDistanceMm,
  focusPlaneWidthMm,
  projectPointToGroundGlass,
  cocDiameterMm,
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

  it("computes vertical FOV degrees from image distance", () => {
    const D = 1000;
    const image = imageDistanceMm(focalLengthMm, D);
    const vFov = verticalFovDegreesFromImageDistance(sensorHeightMm, image);
    expect(vFov).toBeGreaterThan(0);
    expect(typeof vFov).toBe("number");
  });
});
