import { describe, it, expect } from "vitest";
import { formatGroundGlassFocusLabel } from "../../render/groundGlassFocusLabel";

describe("formatGroundGlassFocusLabel", () => {
  it("shows focus and sharpness for RTT target", () => {
    const s = formatGroundGlassFocusLabel({ isRttScene: true, isInfinityFocus: false, focusDistanceMm: 8890, primaryTarget: { sharpness: 0.997, normalizedDefocus: 0.01 } });
    expect(s).toContain('8890');
    expect(s).toMatch(/target|defocus/);
  });

  it("shows infinity for RTT infinite focus", () => {
    const s = formatGroundGlassFocusLabel({ isRttScene: true, isInfinityFocus: true, focusDistanceMm: Infinity });
    expect(s).toBe('Focus ∞');
  });

  it("falls back to focus distance when no target diagnostics", () => {
    const s = formatGroundGlassFocusLabel({ isRttScene: true, isInfinityFocus: false, focusDistanceMm: 8080 });
    expect(s).toContain('8080');
  });

  it("preserves legacy delta for non-RTT scenes", () => {
    const s = formatGroundGlassFocusLabel({ isRttScene: false, isInfinityFocus: false, focusDistanceMm: 8860, legacyDistanceToFocusPlaneMm: 8838 });
    expect(s).toContain('8860');
    expect(s).toContain('delta');
  });
});
