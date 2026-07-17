import { describe, expect, it } from "vitest";
import { CAMERA_CONSTANTS, CAMERA_CONTROL_STEPS } from "../../utils/constants";

describe("CAMERA_CONSTANTS", () => {
  it("keeps fixed 4x5 film dimensions", () => {
    expect(CAMERA_CONSTANTS.filmWidthMm).toBe(127);
    expect(CAMERA_CONSTANTS.filmHeightMm).toBe(101.6);
  });

  it("matches movement ranges from spec", () => {
    expect(CAMERA_CONSTANTS.riseMinMm).toBe(0);
    expect(CAMERA_CONSTANTS.riseMaxMm).toBe(40);
    expect(CAMERA_CONSTANTS.tiltMinDeg).toBe(-10);
    expect(CAMERA_CONSTANTS.tiltMaxDeg).toBe(10);
    expect(CAMERA_CONSTANTS.swingMinDeg).toBe(-10);
    expect(CAMERA_CONSTANTS.swingMaxDeg).toBe(10);
  });

  it("shares the public movement-control precision", () => {
    expect(CAMERA_CONTROL_STEPS).toEqual({ riseMm: 1, tiltDeg: 0.1, swingDeg: 0.1 });
  });
});
