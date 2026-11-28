import { describe, expect, it } from "vitest";
import { compareGroundGlassOrientations } from "../e2e/helpers/groundGlassA1Orientation";

const width = 4;
const height = 3;
const upright = Uint8Array.from([
  10, 20, 30, 255, 40, 50, 60, 255, 70, 80, 90, 255, 100, 110, 120, 255,
  130, 140, 150, 255, 160, 170, 180, 255, 190, 200, 210, 255, 220, 230, 240, 255,
  15, 25, 35, 255, 55, 65, 75, 255, 95, 105, 115, 255, 135, 145, 155, 255,
]);

function transform(horizontal: boolean, vertical: boolean) {
  const output = new Uint8Array(upright.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const sourceX = horizontal ? width - 1 - x : x;
      const sourceY = vertical ? height - 1 - y : y;
      const source = (sourceY * width + sourceX) * 4;
      output.set(upright.subarray(source, source + 4), (y * width + x) * 4);
    }
  }
  return output;
}

describe("A1 orientation readback comparison", () => {
  it("accepts a 180-degree turn and rejects each wrong mapping", () => {
    const compare = (raw: Uint8Array) =>
      compareGroundGlassOrientations(raw, upright, width, height, 0, 1);
    expect(compare(transform(true, true)).accepted).toBe(true);
    expect(compare(transform(true, false)).accepted).toBe(false);
    expect(compare(transform(false, true)).accepted).toBe(false);
    expect(compare(transform(false, false)).accepted).toBe(false);
  });

  it("rejects symmetric or malformed readbacks instead of treating them as proof", () => {
    const blank = new Uint8Array(width * height * 4);
    expect(compareGroundGlassOrientations(blank, blank, width, height, 0, 1).accepted).toBe(false);
    expect(() => compareGroundGlassOrientations(blank.subarray(1), blank, width, height, 0, 1)).toThrow();
    expect(() => compareGroundGlassOrientations(blank, blank, width, height, NaN, 1)).toThrow();
  });
});
