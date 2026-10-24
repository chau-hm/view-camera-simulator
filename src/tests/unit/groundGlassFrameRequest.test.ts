import { describe, expect, it } from "vitest";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import type { EffectiveCameraMovementCalibration } from "../../scenes/cameraMovementEffectiveCalibration";
import type { DerivedOpticsState } from "../../types/optics";
import type { SceneDefinition } from "../../types/scene";
import {
  createGroundGlassFrameRequest,
  createGroundGlassFrameRequestFingerprint,
} from "../../render/groundGlassFrameRequest";
import { createGroundGlassRequestInput } from "./groundGlassFrameRequestFixtures";

const identity = {
  requestId: "request-1",
  channelId: "default",
  sceneId: "architecture-rise",
} as const;

describe("Ground Glass accepted frame requests", () => {
  it("uses semantic values instead of object references for stable fingerprints", () => {
    const first = createGroundGlassRequestInput();
    const second = createGroundGlassRequestInput({
      scene: structuredClone(first.scene) as unknown as SceneDefinition,
      opticsState: structuredClone(first.opticsState) as unknown as DerivedOpticsState,
    });

    expect(first.scene).not.toBe(second.scene);
    expect(first.opticsState).not.toBe(second.opticsState);
    expect(createGroundGlassFrameRequestFingerprint(first)).toBe(
      createGroundGlassFrameRequestFingerprint(second),
    );
  });

  it("changes the fingerprint for render-relevant canonical, display, crop, quality, and dimension inputs", () => {
    const base = createGroundGlassRequestInput();
    const baseKey = createGroundGlassFrameRequestFingerprint(base);
    const changedInputs = [
      createGroundGlassRequestInput({ camera: { focusDistanceMm: 1800 } }),
      createGroundGlassRequestInput({ camera: { frontRiseMm: 12 } }),
      createGroundGlassRequestInput({ aperture: 22 }),
      createGroundGlassRequestInput({ scene: understandingCameraMovementsScene }),
      createGroundGlassRequestInput({
        inspectionWindow: {
          active: true,
          centerU: 0.55,
          centerV: 0.5,
          widthFraction: 0.25,
          heightFraction: 0.25,
        },
      }),
      createGroundGlassRequestInput({ previewMode: "upright" }),
      createGroundGlassRequestInput({ rawDebug: true }),
      createGroundGlassRequestInput({ renderQuality: "high" }),
      createGroundGlassRequestInput({ widthPx: 501 }),
      createGroundGlassRequestInput({ channel: "camera-movement-current" }),
      createGroundGlassRequestInput({ presentationRegion: "upper" }),
      createGroundGlassRequestInput({
        effectiveCameraMovementCalibration: { effectiveKey: "calibration-b" } as EffectiveCameraMovementCalibration,
      }),
    ];

    changedInputs.forEach((input) => {
      expect(createGroundGlassFrameRequestFingerprint(input)).not.toBe(baseKey);
    });
  });

  it("preserves exact small canonical changes in the request fingerprint", () => {
    const base = createGroundGlassRequestInput();
    const changedOptics = {
      ...base.opticsState,
      lensCenterWorld: {
        ...base.opticsState.lensCenterWorld,
        x: base.opticsState.lensCenterWorld.x + 0.0000001,
      },
    };
    const changed = createGroundGlassRequestInput({
      opticsState: changedOptics as unknown as DerivedOpticsState,
    });

    expect(createGroundGlassFrameRequestFingerprint(changed)).not.toBe(
      createGroundGlassFrameRequestFingerprint(base),
    );
  });

  it("includes renderer-consumed canonical frame fields beyond the common optics readouts", () => {
    const base = createGroundGlassRequestInput();
    const changedOptics = structuredClone(base.opticsState) as DerivedOpticsState;
    changedOptics.rearStandardFrame.rightWorld.x += 0.25;
    const changed = createGroundGlassRequestInput({ opticsState: changedOptics });

    expect(createGroundGlassFrameRequestFingerprint(changed)).not.toBe(
      createGroundGlassFrameRequestFingerprint(base),
    );
  });

  it("deep-copies and freezes the accepted snapshot without freezing application inputs", () => {
    const input = createGroundGlassRequestInput();
    const scene = structuredClone(input.scene) as unknown as SceneDefinition;
    const mutableInput = { ...input, scene };
    const originalMinX = scene.bounds.min.x;
    const request = createGroundGlassFrameRequest(mutableInput, identity);

    scene.bounds.min.x += 10;

    expect(request.scene.bounds.min.x).toBe(originalMinX);
    expect(Object.isFrozen(request)).toBe(true);
    expect(Object.isFrozen(request.scene)).toBe(true);
    expect(Object.isFrozen(request.scene.bounds.min)).toBe(true);
    expect(Object.isFrozen(request.opticsState.offAxisProjectionMatrix)).toBe(true);
    expect(Object.isFrozen(scene)).toBe(false);
  });
});
