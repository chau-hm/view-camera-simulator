import { describe, expect, it, beforeEach } from "vitest";
import { createGroundGlassRenderSanityStateKey } from "../../render/groundGlassRenderSanityKey";
import { useAppStore } from "../../state/appStore";
import { deriveOpticsState } from "../../core/optics/deriveOpticsState";
import { understandingCameraMovementsScene } from "../../scenes/definitions/understanding-camera-movements";
import type { DerivedOpticsState } from "../../types/optics";
import geometry from "../../scenes/understandingCameraMovementsGeometry";

function buildOptics(overrides: Partial<ReturnType<typeof useAppStore.getState>['camera']> = {}): DerivedOpticsState {
  const base = useAppStore.getState().camera;
  const legacyMovementKeys = [
    "frontRiseMm",
    "frontTiltDeg",
    "frontSwingDeg",
    "rearRiseMm",
    "rearTiltDeg",
    "cameraBodyPitchDeg",
    "viewpointAnchor",
    "cameraRigPlacement",
  ] as const;
  const overridesLegacyMovement = legacyMovementKeys.some((key) => key in overrides);
  return deriveOpticsState(
    {
      ...base,
      ...overrides,
      ...(overridesLegacyMovement ? { cameraMovementLessonState: undefined } : {}),
    },
    understandingCameraMovementsScene,
  );
}

function makeKey(optics: DerivedOpticsState, overrides: Partial<Parameters<typeof createGroundGlassRenderSanityStateKey>[0]> = {}) {
  return createGroundGlassRenderSanityStateKey({
    resourceGeneration: 1,
    sceneId: "understanding-camera-movements",
    previewMode: "raw",
    rawDebug: false,
    zoomEnabled: false,
    aperture: 11,
    internalWidthPx: 640,
    internalHeightPx: 480,
    opticsState: optics,
    ...overrides,
  });
}

describe("groundGlassRenderSanityKey", () => {
  beforeEach(() => {
    useAppStore.getState().initializeSimulatorRoute({
      mode: "free",
      sceneId: "understanding-camera-movements",
    });
  });

  it("identical optics produce identical keys", () => {
    const o1 = buildOptics();
    const o2 = buildOptics();
    expect(makeKey(o1)).toBe(makeKey(o2));
  });

  it("Front Rise changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ frontRiseMm: 20 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("Rear Rise changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ rearRiseMm: 20 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("Front Tilt changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ frontTiltDeg: 5 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("Rear Tilt changes the key", () => {
    const zero = buildOptics();
    const moved = buildOptics({ rearTiltDeg: 5 });
    expect(makeKey(moved)).not.toBe(makeKey(zero));
  });

  it("camera body pose changes the key", () => {
    const zero = buildOptics({ cameraBodyPitchDeg: 0 });
    const pitched = buildOptics({ cameraBodyPitchDeg: 8 });
    expect(makeKey(pitched)).not.toBe(makeKey(zero));
  });

  it("outer rig placement changes the key", () => {
    const camera = useAppStore.getState().camera;
    const placedCamera = {
      ...camera,
      viewpointAnchor: "high" as const,
      cameraRigPlacement: geometry.cameraRig.viewpointAnchors.high,
      cameraMovementLessonState: undefined,
    };
    const midpoint = deriveOpticsState(
      camera,
      understandingCameraMovementsScene,
    );
    const placed = deriveOpticsState(
      placedCamera,
      understandingCameraMovementsScene,
    );

    expect(makeKey(placed)).not.toBe(makeKey(midpoint));
  });

  it("configured camera extrinsics change the key and remain finite", () => {
    const optics = buildOptics();
    const basePose = {
      positionWorld: [0, 0, 0] as [number, number, number],
      upWorld: [0, 1, 0] as [number, number, number],
      forwardWorld: [0, 0, 1] as [number, number, number],
    };
    const pitchedPose = {
      ...basePose,
      positionWorld: [0, -0.01, 0.02] as [number, number, number],
      forwardWorld: [0, -0.139173, 0.990268] as [number, number, number],
    };
    const baseKey = makeKey(optics, { configuredCameraPose: basePose });
    const pitchedKey = makeKey(optics, { configuredCameraPose: pitchedPose });

    expect(pitchedKey).not.toBe(baseKey);
    expect(baseKey).not.toContain("NaN");
    expect(pitchedKey).not.toContain("Infinity");
  });

  it("changing aperture changes the key", () => {
    const o = buildOptics();
    expect(makeKey(o)).not.toBe(makeKey(o, { aperture: 22 }));
  });

  it("changing dimensions changes the key", () => {
    const o = buildOptics();
    expect(makeKey(o)).not.toBe(makeKey(o, { internalWidthPx: 320 }));
  });

  it("null focus/DOF planes serialize deterministically", () => {
    const o = buildOptics();
    const key1 = makeKey(o);
    const key2 = makeKey(o);
    expect(key1).toBe(key2);
    // All keys must be finite strings without NaN or Infinity
    expect(key1).not.toContain("NaN");
    expect(key1).not.toContain("Infinity");
  });

  it("all key values are finite numbers", () => {
    const o = buildOptics();
    const key = makeKey(o);
    expect(key).not.toContain("NaN");
    expect(key).not.toContain("Infinity");
    // Split by | for top-level, then : for vec, and , for matrix entries
    for (const part of key.split("|")) {
      // Each part may be a single value or contain : and , delimiters
      const tokens = part.split(/[:,]/);
      for (const token of tokens) {
        if (token === "null" || token === "no-scene" || token === "empty" || token === "understanding-camera-movements") continue;
        if (token === "raw" || token === "0" || token === "1") continue;
        if (token === "") continue;
        const num = Number(token);
        expect(Number.isFinite(num), `token "${token}" from part "${part}" is not finite`).toBe(true);
      }
    }
  });
});
