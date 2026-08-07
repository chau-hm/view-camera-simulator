import { describe, expect, it } from "vitest";
import {
  focusFundamentalsFocusDetails,
  focusFundamentalsObjectBoundsMm,
  focusFundamentalsObjectDimensionsMm,
  focusFundamentalsReferenceFocusDepthMm,
  focusFundamentalsSceneBoundsMm,
  focusTargetsDefs,
} from "../../scenes/focusFundamentalsTargets";

describe("Focus Fundamentals canonical subject geometry", () => {
  it("keeps both focus details on the same rotated object", () => {
    const [near, far] = focusFundamentalsFocusDetails;
    const nearTarget = focusTargetsDefs[0];
    const farTarget = focusTargetsDefs[1];

    expect(focusTargetsDefs).toHaveLength(2);
    expect(near.surface).toBe("front");
    expect(far.surface).toBe("right");
    expect(nearTarget.worldPosition).toEqual(near.worldPositionMm);
    expect(farTarget.worldPosition).toEqual(far.worldPositionMm);
    expect(near.worldPositionMm.z).toBe(near.focusDepthMm);
    expect(far.worldPositionMm.z).toBe(far.focusDepthMm);
    expect(near.focusDepthMm).toBeLessThan(focusFundamentalsReferenceFocusDepthMm);
    expect(focusFundamentalsReferenceFocusDepthMm).toBeLessThan(far.focusDepthMm);

    const focusDepthSpanMm = far.focusDepthMm - near.focusDepthMm;
    expect(focusDepthSpanMm).toBe(460);
    expect(focusDepthSpanMm).toBeLessThan(2000);

    for (const detail of focusFundamentalsFocusDetails) {
      expect(detail.worldPositionMm.x).toBeGreaterThanOrEqual(
        focusFundamentalsObjectBoundsMm.min.x,
      );
      expect(detail.worldPositionMm.x).toBeLessThanOrEqual(
        focusFundamentalsObjectBoundsMm.max.x,
      );
      expect(detail.worldPositionMm.y).toBeGreaterThanOrEqual(
        focusFundamentalsObjectBoundsMm.min.y,
      );
      expect(detail.worldPositionMm.y).toBeLessThanOrEqual(
        focusFundamentalsObjectBoundsMm.max.y,
      );
      expect(detail.worldPositionMm.z).toBeGreaterThanOrEqual(
        focusFundamentalsObjectBoundsMm.min.z,
      );
      expect(detail.worldPositionMm.z).toBeLessThanOrEqual(
        focusFundamentalsObjectBoundsMm.max.z,
      );
    }

    expect(focusFundamentalsObjectBoundsMm.min.y).toBe(
      focusFundamentalsObjectBoundsMm.max.y - focusFundamentalsObjectDimensionsMm.height,
    );
    expect(focusFundamentalsSceneBoundsMm.min.x).toBeLessThan(
      focusFundamentalsObjectBoundsMm.min.x,
    );
    expect(focusFundamentalsSceneBoundsMm.max.x).toBeGreaterThan(
      focusFundamentalsObjectBoundsMm.max.x,
    );
    expect(focusFundamentalsSceneBoundsMm.min.z).toBeLessThan(
      focusFundamentalsObjectBoundsMm.min.z,
    );
    expect(focusFundamentalsSceneBoundsMm.max.z).toBeGreaterThan(
      focusFundamentalsObjectBoundsMm.max.z,
    );
  });
});
