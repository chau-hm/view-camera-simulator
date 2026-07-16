import { describe, expect, it } from "vitest";
import { roundToStep } from "../../utils/roundToStep";

describe("roundToStep", () => {
  it.each([
    [-4.202040434, 0.1, -4.2],
    [-3.402040434, 0.1, -3.4],
    [-3.85, 0.1, -3.8],
    [2.499, 0.25, 2.5],
    [12.4, 1, 12],
  ])("rounds %s to step %s without decimal residue", (value, step, expected) => {
    const result = roundToStep(value, step);
    expect(result).toBe(expected);
    expect(String(result)).not.toContain("0000000000000004");
  });

  it.each([
    [Number.NaN, 0.1, /finite value/],
    [1, 0, /positive finite step/],
    [1, -0.1, /positive finite step/],
    [1, Number.POSITIVE_INFINITY, /positive finite step/],
  ])("rejects invalid input value=%s step=%s", (value, step, message) => {
    expect(() => roundToStep(value, step)).toThrow(message);
  });
});
