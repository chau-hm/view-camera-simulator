import { describe, expect, it } from "vitest";
import { cagePhaseError } from "../e2e/helpers/cagePhase";

describe("cage phase continuity evidence", () => {
  it("accepts expected movement through the revolution boundary", () => {
    expect(cagePhaseError(-6.2, -0.126253, 2000)).toBeLessThan(0.001);
  });
  it("rejects resets, wrong direction, and large jumps", () => {
    const before = -1.2;
    const elapsed = 2000;
    for (const after of [0, before + 0.21, before - 1]) {
      expect(cagePhaseError(before, after, elapsed)).toBeGreaterThan(0.2);
    }
  });
});
