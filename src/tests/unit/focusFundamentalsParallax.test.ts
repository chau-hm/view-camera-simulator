import { describe, expect, it } from "vitest";
import { cross, distance, magnitude, subtract } from "../../core/math/vec";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { focusFundamentalsTwoTargets } from "../../scenes/definitions/focus-fundamentals-two-targets";
import {
  focusFundamentalsParallaxFarDepthMm,
  focusFundamentalsParallaxFeatures,
  focusFundamentalsParallaxNearDepthMm,
  focusFundamentalsParallaxReferenceGeometry,
  focusFundamentalsParallaxReferenceLensCenterWorldMm,
  focusFundamentalsParallaxReferenceOffsetDistanceMm,
  focusFundamentalsConnectedSubjectBoundsMm,
} from "../../scenes/focusFundamentalsParallax";
import {
  focusFundamentalsFarFocusDepthMm,
  focusFundamentalsNearFocusDepthMm,
  focusFundamentalsReferenceFocusDepthMm,
  focusFundamentalsSceneBoundsMm,
} from "../../scenes/focusFundamentalsTargets";
import {
  focusFundamentalsMinimumFrontParallaxAlignmentSeparationMm,
  projectFocusFundamentalsParallaxMetric,
} from "../../render/focusFundamentalsParallaxMetric";
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

describe("Focus Fundamentals physical parallax alignment geometry", () => {
  it("keeps two off-axis alignment features on one canonical connected subject ray", () => {
    const [near, far] = focusFundamentalsParallaxFeatures;
    const lens = focusFundamentalsParallaxReferenceLensCenterWorldMm;
    const nearVector = subtract(near.referenceWorldPositionMm, lens);
    const farVector = subtract(far.referenceWorldPositionMm, lens);
    const relativeCollinearityResidual =
      magnitude(cross(nearVector, farVector)) /
      (magnitude(nearVector) * magnitude(farVector));

    expect(focusFundamentalsParallaxFeatures).toHaveLength(2);
    expect(near.depthMm).toBe(focusFundamentalsParallaxNearDepthMm);
    expect(far.depthMm).toBe(focusFundamentalsParallaxFarDepthMm);
    expect(near.depthMm).toBeLessThan(far.depthMm);
    expect(near.depthMm).toBeGreaterThanOrEqual(focusFundamentalsSceneBoundsMm.min.z);
    expect(far.depthMm).toBeLessThanOrEqual(focusFundamentalsSceneBoundsMm.max.z);
    expect(relativeCollinearityResidual).toBeLessThan(1e-12);
    expect(focusFundamentalsParallaxReferenceOffsetDistanceMm()).toBeGreaterThan(20);

    for (const feature of focusFundamentalsParallaxFeatures) {
      expect(Number.isFinite(feature.referenceWorldPositionMm.x)).toBe(true);
      expect(Number.isFinite(feature.referenceWorldPositionMm.y)).toBe(true);
      expect(Number.isFinite(feature.referenceWorldPositionMm.z)).toBe(true);
      expect(feature.referenceWorldPositionMm.x).toBeGreaterThanOrEqual(
        focusFundamentalsConnectedSubjectBoundsMm.min.x,
      );
      expect(feature.referenceWorldPositionMm.x).toBeLessThanOrEqual(
        focusFundamentalsConnectedSubjectBoundsMm.max.x,
      );
      expect(feature.referenceWorldPositionMm.y).toBeGreaterThanOrEqual(
        focusFundamentalsConnectedSubjectBoundsMm.min.y,
      );
      expect(feature.referenceWorldPositionMm.y).toBeLessThanOrEqual(
        focusFundamentalsConnectedSubjectBoundsMm.max.y,
      );
      expect(feature.referenceWorldPositionMm.z).toBe(feature.depthMm);
      expect(feature.referenceWorldPositionMm.z).toBeGreaterThanOrEqual(
        focusFundamentalsConnectedSubjectBoundsMm.min.z,
      );
      expect(feature.referenceWorldPositionMm.z).toBeLessThanOrEqual(
        focusFundamentalsConnectedSubjectBoundsMm.max.z,
      );
      expect(distance(feature.referenceWorldPositionMm, feature.supportAnchorWorldPositionMm)).toBeGreaterThan(0);
    }

    const referenceMetric = projectFocusFundamentalsParallaxMetric(
      focusFundamentalsParallaxReferenceGeometry.opticsState,
    );
    expect(referenceMetric).not.toBeNull();
    expect(referenceMetric?.allPointsVisible).toBe(true);
    expect(referenceMetric?.separationMm).toBeLessThan(1e-10);
  });

  it("keeps Rear alignment fixed while Front alignment separates on both sides", () => {
    const states = {
      frontNear: opticsFor(focusFundamentalsNearFocusDepthMm, "front"),
      frontFar: opticsFor(focusFundamentalsFarFocusDepthMm, "front"),
      rearNear: opticsFor(focusFundamentalsNearFocusDepthMm, "rear"),
      rearReference: opticsFor(focusFundamentalsReferenceFocusDepthMm, "rear"),
      rearFar: opticsFor(focusFundamentalsFarFocusDepthMm, "rear"),
    } as const;

    for (const optics of Object.values(states)) {
      expect(optics.diagnostics.fallbackApplied).toBe(false);
      const metric = projectFocusFundamentalsParallaxMetric(optics);
      expect(metric).not.toBeNull();
      expect(metric?.allPointsVisible).toBe(true);
    }

    const frontNear = projectFocusFundamentalsParallaxMetric(states.frontNear)!;
    const frontFar = projectFocusFundamentalsParallaxMetric(states.frontFar)!;
    const rearNear = projectFocusFundamentalsParallaxMetric(states.rearNear)!;
    const rearReference = projectFocusFundamentalsParallaxMetric(states.rearReference)!;
    const rearFar = projectFocusFundamentalsParallaxMetric(states.rearFar)!;

    expect(rearReference.separationMm).toBeLessThan(1e-10);
    expect(rearNear.separationMm).toBeLessThan(1e-10);
    expect(rearFar.separationMm).toBeLessThan(1e-10);
    expect(frontNear.separationMm).toBeGreaterThan(
      focusFundamentalsMinimumFrontParallaxAlignmentSeparationMm,
    );
    expect(frontFar.separationMm).toBeGreaterThan(
      focusFundamentalsMinimumFrontParallaxAlignmentSeparationMm,
    );
    expect(frontNear.signedSeparationMm * frontFar.signedSeparationMm).toBeLessThan(0);
    expect(frontNear.separationMm).toBeGreaterThan(rearNear.separationMm + 0.05);
    expect(frontFar.separationMm).toBeGreaterThan(rearFar.separationMm + 0.05);
  });
});
