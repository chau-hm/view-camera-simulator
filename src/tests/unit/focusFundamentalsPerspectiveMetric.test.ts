import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import {
  focusFundamentalsFarFocusDepthMm,
  focusFundamentalsNearFocusDepthMm,
  focusFundamentalsReferenceFocusDepthMm,
} from "../../scenes/focusFundamentalsTargets";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import {
  focusFundamentalsMinimumFrontPerspectiveDelta,
  projectFocusFundamentalsPerspectiveMetric,
} from "../../render/focusFundamentalsPerspectiveMetric";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const opticsFor = (focusDistanceMm: number, focusStandard: "front" | "rear") =>
  deriveOpticsState(
    {
      ...DEFAULT_CAMERA_STATE,
      ...focusFundamentalsTwoTargets.cameraPreset,
      activeSceneId: focusFundamentalsTwoTargets.id,
      focusDistanceMm,
      focusStandard,
    },
    focusFundamentalsTwoTargets,
  );

describe("Focus Fundamentals physical perspective calibration", () => {
  it("keeps the Rear normalized frame relationship invariant while Front responds", () => {
    const frontNear = opticsFor(focusFundamentalsNearFocusDepthMm, "front");
    const frontFar = opticsFor(focusFundamentalsFarFocusDepthMm, "front");
    const rearNear = opticsFor(focusFundamentalsNearFocusDepthMm, "rear");
    const rearFar = opticsFor(focusFundamentalsFarFocusDepthMm, "rear");
    const metrics = [frontNear, frontFar, rearNear, rearFar].map(
      projectFocusFundamentalsPerspectiveMetric,
    );

    for (const optics of [frontNear, frontFar, rearNear, rearFar]) {
      expect(optics.diagnostics.fallbackApplied).toBe(false);
    }
    for (const metric of metrics) {
      expect(metric).not.toBeNull();
      expect(metric?.front.allPointsVisible).toBe(true);
      expect(metric?.back.allPointsVisible).toBe(true);
    }

    const frontDelta = Math.abs(
      metrics[0]!.backToFrontWidthRatio - metrics[1]!.backToFrontWidthRatio,
    );
    const rearDelta = Math.abs(
      metrics[2]!.backToFrontWidthRatio - metrics[3]!.backToFrontWidthRatio,
    );

    expect(rearDelta).toBeLessThan(1e-10);
    expect(frontDelta).toBeGreaterThan(focusFundamentalsMinimumFrontPerspectiveDelta);
    expect(frontDelta).toBeGreaterThan(rearDelta + focusFundamentalsMinimumFrontPerspectiveDelta);
  });

  it("keeps Front and Rear projection geometry coincident at the reference depth", () => {
    const front = projectFocusFundamentalsPerspectiveMetric(
      opticsFor(focusFundamentalsReferenceFocusDepthMm, "front"),
    );
    const rear = projectFocusFundamentalsPerspectiveMetric(
      opticsFor(focusFundamentalsReferenceFocusDepthMm, "rear"),
    );

    expect(front).not.toBeNull();
    expect(rear).not.toBeNull();
    expect(front!.backToFrontWidthRatio).toBeCloseTo(rear!.backToFrontWidthRatio, 12);
  });
});
