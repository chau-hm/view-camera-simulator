import { describe, expect, it } from "vitest";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { macroBellowsExtensionScene } from "../../scenes/definitions/macro-bellows-extension";
import { macroDepthOfFieldScene } from "../../scenes/definitions/macro-depth-of-field";
import {
  compareFocusTargetPresentationMetrics,
  resolveMacroDepthOfFieldTeaching,
} from "../../scenes/macroDepthOfFieldTeaching";
import type { ApertureValue, CameraState } from "../../types/camera";
import { DEFAULT_CAMERA_STATE } from "../../utils/constants";

const cameraAt = (focusDistanceMm: number, aperture: ApertureValue = 5.6): CameraState => ({
  ...DEFAULT_CAMERA_STATE,
  ...macroDepthOfFieldScene.cameraPreset,
  activeSceneId: macroDepthOfFieldScene.id,
  mode: "free",
  activeTaskId: null,
  focusDistanceMm,
  aperture,
  focusMode: "finite",
});

const teachingAt = (focusDistanceMm: number, aperture: ApertureValue = 5.6) => {
  const camera = cameraAt(focusDistanceMm, aperture);
  const optics = deriveOpticsState(camera, macroDepthOfFieldScene);
  return resolveMacroDepthOfFieldTeaching({
    capability: macroDepthOfFieldScene.macroTeachingCapability,
    focusObjectDistanceMm: optics.diagnostics.focusObjectDistanceMm,
    aperture,
    focusTargets: optics.focusTargets,
  });
};

describe("Macro Scene 2 teaching model", () => {
  it("is declaratively enabled for Scene 2 but not inherited by Scene 1", () => {
    expect(macroDepthOfFieldScene.macroTeachingCapability).toEqual({ kind: "depth-of-field" });
    expect(macroBellowsExtensionScene.macroTeachingCapability).toMatchObject({ kind: "bellows-extension" });
    expect(
      resolveMacroDepthOfFieldTeaching({
        capability: macroBellowsExtensionScene.macroTeachingCapability,
        focusObjectDistanceMm: 400,
        aperture: 5.6,
        focusTargets: [],
      }),
    ).toBeNull();
  });

  it("follows the physically strongest target as focus moves near, middle, and far", () => {
    const near = teachingAt(390);
    const middle = teachingAt(400);
    const far = teachingAt(410);

    expect(near).toMatchObject({ stage: "wide-open", focusedRegion: "near" });
    expect(middle).toMatchObject({ stage: "wide-open", focusedRegion: "middle" });
    expect(far).toMatchObject({ stage: "wide-open", focusedRegion: "far" });
    expect(near?.statuses).toMatchObject({ near: "sharp", middle: "soft", far: "soft" });
    expect(middle?.statuses).toMatchObject({ near: "soft", middle: "sharp", far: "soft" });
    expect(far?.statuses).toMatchObject({ near: "soft", middle: "soft", far: "sharp" });
  });

  it("uses the smaller equivalent CoC when learner sharpness is tied", () => {
    const lessBlurred = {
      sharpness: 0,
      status: "soft" as const,
      equivalentCoCDiameterMm: 0.24,
    };
    const moreBlurred = {
      sharpness: 0,
      status: "soft" as const,
      equivalentCoCDiameterMm: 0.36,
    };

    expect(compareFocusTargetPresentationMetrics(lessBlurred, moreBlurred)).toBeGreaterThan(0);
    expect(compareFocusTargetPresentationMetrics(moreBlurred, lessBlurred)).toBeLessThan(0);
  });

  it("keeps the least-blurred region meaningful when sharpness saturates at the public endpoints", () => {
    const nearSide = teachingAt(360);
    const nearIntermediate = teachingAt(370);
    const farSide = teachingAt(440);

    if (!nearSide || !nearIntermediate || !farSide) {
      throw new Error("Expected physical Macro Scene 2 teaching metrics at public focus endpoints");
    }

    const nearSideNearCoC = nearSide.metrics.near.equivalentCoCDiameterMm;
    const nearSideMiddleCoC = nearSide.metrics.middle.equivalentCoCDiameterMm;
    const nearSideFarCoC = nearSide.metrics.far.equivalentCoCDiameterMm;
    const nearIntermediateNearCoC = nearIntermediate.metrics.near.equivalentCoCDiameterMm;
    const nearIntermediateMiddleCoC = nearIntermediate.metrics.middle.equivalentCoCDiameterMm;
    const farSideNearCoC = farSide.metrics.near.equivalentCoCDiameterMm;
    const farSideMiddleCoC = farSide.metrics.middle.equivalentCoCDiameterMm;
    const farSideFarCoC = farSide.metrics.far.equivalentCoCDiameterMm;

    if (
      nearSideNearCoC === null ||
      nearSideMiddleCoC === null ||
      nearSideFarCoC === null ||
      nearIntermediateNearCoC === null ||
      nearIntermediateMiddleCoC === null ||
      farSideNearCoC === null ||
      farSideMiddleCoC === null ||
      farSideFarCoC === null
    ) {
      throw new Error("Expected equivalent physical CoC values at public focus endpoints");
    }

    expect(nearSide.focusedRegion).toBe("near");
    expect(nearSide.metrics.near.sharpness).toBe(nearSide.metrics.middle.sharpness);
    expect(nearSide.metrics.middle.sharpness).toBe(nearSide.metrics.far.sharpness);
    expect(nearSideNearCoC).toBeLessThan(nearSideMiddleCoC);
    expect(nearSideMiddleCoC).toBeLessThan(nearSideFarCoC);

    expect(nearIntermediate.focusedRegion).toBe("near");
    expect(nearIntermediate.metrics.near.sharpness).toBe(nearIntermediate.metrics.middle.sharpness);
    expect(nearIntermediate.metrics.middle.sharpness).toBe(nearIntermediate.metrics.far.sharpness);
    expect(nearIntermediateNearCoC).toBeLessThan(nearIntermediateMiddleCoC);

    expect(farSide.focusedRegion).toBe("far");
    expect(farSide.metrics.near.sharpness).toBe(farSide.metrics.middle.sharpness);
    expect(farSide.metrics.middle.sharpness).toBe(farSide.metrics.far.sharpness);
    expect(farSideFarCoC).toBeLessThan(farSideMiddleCoC);
    expect(farSideMiddleCoC).toBeLessThan(farSideNearCoC);
  });

  it("separates aperture stages and preserves the f/32 physical limitation", () => {
    expect(teachingAt(400, 5.6)?.stage).toBe("wide-open");
    expect(teachingAt(400, 8)?.stage).toBe("begin-stopping-down");
    expect(teachingAt(400, 11)?.stage).toBe("begin-stopping-down");
    expect(teachingAt(400, 16)?.stage).toBe("moderate-stopping-down");
    expect(teachingAt(400, 22)?.stage).toBe("moderate-stopping-down");

    const wide = teachingAt(400, 5.6)!;
    const stopped = teachingAt(400, 32)!;
    expect(stopped.stage).toBe("minimum-aperture");
    expect(stopped.softRegions.length).toBeGreaterThan(0);
    expect(stopped.metrics.near.equivalentCoCDiameterMm).toBeLessThan(
      wide.metrics.near.equivalentCoCDiameterMm!,
    );
    expect(stopped.metrics.far.equivalentCoCDiameterMm).toBeLessThan(
      wide.metrics.far.equivalentCoCDiameterMm!,
    );
  });

  it("fails closed when canonical focus or target metrics are unavailable", () => {
    expect(
      resolveMacroDepthOfFieldTeaching({
        capability: macroDepthOfFieldScene.macroTeachingCapability,
        focusObjectDistanceMm: null,
        aperture: 5.6,
        focusTargets: [],
      }),
    ).toBeNull();
  });
});
