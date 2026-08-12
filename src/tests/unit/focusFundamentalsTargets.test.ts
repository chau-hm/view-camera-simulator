import { describe, expect, it } from "vitest";
import {
  focusFundamentalsFocusDetails,
  focusFundamentalsObjectBoundsMm,
  focusFundamentalsObjectDimensionsMm,
  focusFundamentalsObjectRotationYDeg,
  focusFundamentalsFocalLengthMm,
  focusFundamentalsNearFocusDepthMm,
  focusFundamentalsFarFocusDepthMm,
  focusFundamentalsReferenceFocusDepthMm,
  focusFundamentalsFocusDepthRangeMm,
  focusFundamentalsSceneBoundsMm,
  focusFundamentalsFrameGeometry,
  focusFundamentalsMarkerOffsetMm,
  getFocusFundamentalsDetailMarkerLocalPosition,
  focusTargetsDefs,
} from "../../scenes/focusFundamentalsTargets";

describe("Focus Fundamentals canonical subject geometry", () => {
  it("keeps both focus details on the same rotated object", () => {
    const [near, far] = focusFundamentalsFocusDetails;
    const nearTarget = focusTargetsDefs[0];
    const farTarget = focusTargetsDefs[1];

    expect(focusTargetsDefs).toHaveLength(2);
    expect(near.surface).toBe("front");
    expect(far.surface).toBe("back");
    expect(nearTarget.worldPosition).toEqual(near.worldPositionMm);
    expect(farTarget.worldPosition).toEqual(far.worldPositionMm);
    expect(near.worldPositionMm.z).toBe(near.focusDepthMm);
    expect(far.worldPositionMm.z).toBe(far.focusDepthMm);
    expect(near.focusDepthMm).toBeLessThan(focusFundamentalsReferenceFocusDepthMm);
    expect(focusFundamentalsReferenceFocusDepthMm).toBeLessThan(far.focusDepthMm);

    const focusDepthSpanMm = far.focusDepthMm - near.focusDepthMm;
    expect(near.focusDepthMm).toBe(focusFundamentalsNearFocusDepthMm);
    expect(far.focusDepthMm).toBe(focusFundamentalsFarFocusDepthMm);
    expect(focusDepthSpanMm).toBe(300);
    expect(focusDepthSpanMm).toBeLessThan(2000);

    expect(focusFundamentalsFocalLengthMm).toBe(180);
    expect(focusFundamentalsObjectRotationYDeg).toBeGreaterThan(25);
    expect(focusFundamentalsObjectDimensionsMm.width).toBeLessThan(520);
    expect(focusFundamentalsObjectDimensionsMm.height).toBeLessThan(380);
    expect(focusFundamentalsObjectDimensionsMm.depth).toBeLessThan(560);
    expect(focusFundamentalsFrameGeometry.back.widthMm).toBeLessThan(
      focusFundamentalsFrameGeometry.front.widthMm,
    );
    expect(focusFundamentalsFrameGeometry.back.heightMm).toBeLessThan(
      focusFundamentalsFrameGeometry.front.heightMm,
    );

    for (const detail of focusFundamentalsFocusDetails) {
      const expectedSurfaceZ =
        detail.surface === "front"
          ? focusFundamentalsFrameGeometry.front.centerZMm -
            focusFundamentalsFrameGeometry.depthMm / 2
          : focusFundamentalsFrameGeometry.back.centerZMm -
            focusFundamentalsFrameGeometry.depthMm / 2;
      expect(detail.localPositionMm.z).toBeCloseTo(expectedSurfaceZ, 12);
      expect(getFocusFundamentalsDetailMarkerLocalPosition(detail).z).toBeCloseTo(
        expectedSurfaceZ - focusFundamentalsMarkerOffsetMm,
        12,
      );
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
    expect(focusFundamentalsSceneBoundsMm.min.z).toBe(focusFundamentalsFocusDepthRangeMm.min);
    expect(focusFundamentalsSceneBoundsMm.max.z).toBe(focusFundamentalsFocusDepthRangeMm.max);
  });
});
