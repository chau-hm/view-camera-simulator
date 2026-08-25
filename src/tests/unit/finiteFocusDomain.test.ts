import { describe, expect, it } from "vitest";
import { minimumRealImageFiniteFocusDistanceMm } from "../../core/optics/finiteFocusDomain";

describe("real-image finite-focus control domain", () => {
  it("returns the next control step strictly above the focal length", () => {
    expect(minimumRealImageFiniteFocusDistanceMm(150, 10)).toBe(160);
    expect(minimumRealImageFiniteFocusDistanceMm(155, 10)).toBe(160);
    expect(minimumRealImageFiniteFocusDistanceMm(160, 10)).toBe(170);
  });

  it("does not resolve an invalid physical input into a control boundary", () => {
    expect(minimumRealImageFiniteFocusDistanceMm(Number.NaN, 10)).toBeNull();
    expect(minimumRealImageFiniteFocusDistanceMm(150, 0)).toBeNull();
  });
});
